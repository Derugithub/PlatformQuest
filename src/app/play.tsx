import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameView, type GameViewHandle } from '@/components/game-view';
import { Hud } from '@/components/hud';
import {
  AnotherChancePopup,
  MissionCompletePopup,
  MissionFailedPopup,
  PausePopup,
  TimeUpBanner,
  TipPopup,
} from '@/components/popups';
import { bankExtraLife } from '@/core/hearts';
import { isLevelId, nextLevelId, type LevelId, type TutorialId } from '@/core/level-format';
import { getLevel } from '@/core/levels';
import { markTutorialSeen, recordLevelResult, setStoredHearts } from '@/core/progress';
import { TIP_TEXT, type GameToHost, type HudState, type LevelSummary } from '@/core/protocol';
import {
  afterDeath,
  anotherChanceOptions,
  missionFailedNavigation,
  resolveAnotherChance,
  type ChanceChoice,
  type FlowState,
  type MissionFailedAction,
} from '@/core/run-flow';
import { scoreStars, type Stars } from '@/core/scoring';
import { useAds } from '@/lib/ads/ads-context';
import { useGameData } from '@/lib/game-data';
import { COLORS } from '@/theme/tokens';

type Overlay =
  | { kind: 'none' }
  | { kind: 'paused' }
  | { kind: 'tip'; id: TutorialId }
  | { kind: 'complete'; summary: LevelSummary; stars: Stars; newBest: boolean };

const EMPTY_HUD: HudState = { hearts: 2, coins: 0, score: 0, time: 300, hurry: false, progress: 0, form: 'small', star: false, boss: null };

export default function PlayScreen() {
  const params = useLocalSearchParams<{ level?: string }>();
  const [levelId, setLevelId] = useState<LevelId>(isLevelId(params.level) ? params.level : '1-1');
  const game = useRef<GameViewHandle>(null);
  const insets = useSafeAreaInsets();
  const ads = useAds();
  const { progress, settings, updateProgress, updateSettings } = useGameData();

  const [hud, setHud] = useState<HudState>(EMPTY_HUD);
  const [started, setStarted] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>({ kind: 'none' });
  const [flow, setFlow] = useState<FlowState>({ screen: 'playing' });
  const [timeUp, setTimeUp] = useState(false);
  const [busy, setBusy] = useState(false);

  // Message handlers read the latest values through a ref, so the WebView callback stays stable.
  const latest = useRef({ levelId, progress, settings, insets });
  useEffect(() => {
    latest.current = { levelId, progress, settings, insets };
  });

  const startLevel = useCallback((id: LevelId) => {
    const { progress: p, settings: s, insets: i } = latest.current;
    const tips = s.tips ? getLevel(id).tutorials.map((t) => t.id).filter((t) => !p.tutorialsSeen.includes(t)) : [];
    setHud({ ...EMPTY_HUD, time: getLevel(id).timeLimit });
    setOverlay({ kind: 'none' });
    setFlow({ screen: 'playing' });
    setTimeUp(false);
    game.current?.send({
      type: 'start',
      level: id,
      audio: { music: s.music, sound: s.sound },
      tips,
      insets: { left: i.left, right: i.right, top: i.top, bottom: i.bottom },
    });
  }, []);

  const onMessage = useCallback(
    (message: GameToHost) => {
      switch (message.type) {
        case 'ready':
          startLevel(latest.current.levelId);
          break;
        case 'levelStarted':
          setStarted(true);
          break;
        case 'hud':
          setHud(message.hud);
          break;
        case 'tip':
          updateProgress((p) => markTutorialSeen(p, message.id));
          setOverlay({ kind: 'tip', id: message.id });
          break;
        case 'extraLife':
          updateProgress((p) => setStoredHearts(p, bankExtraLife(p.storedHearts)));
          break;
        case 'timeUp':
          setTimeUp(true);
          break;
        case 'died':
          setTimeUp(false);
          setOverlay({ kind: 'none' });
          setFlow(afterDeath(message.reason));
          break;
        case 'levelComplete': {
          const summary = message.summary;
          const def = getLevel(summary.level);
          const stars = scoreStars({
            finished: true,
            enemiesDefeated: summary.enemiesDefeated,
            enemiesTotal: summary.enemiesTotal,
            elapsedSeconds: summary.timeSeconds,
            targetSeconds: def.targetSeconds,
          });
          const newBest = summary.score > latest.current.progress.levels[summary.level].bestScore;
          updateProgress((p) => recordLevelResult(p, { level: summary.level, stars, score: summary.score, coins: summary.coins, timeSeconds: summary.timeSeconds }));
          setOverlay({ kind: 'complete', summary, stars, newBest });
          break;
        }
        case 'error':
          if (__DEV__) console.warn('[PlatformQuest game]', message.message);
          break;
      }
    },
    [startLevel, updateProgress],
  );

  const pause = useCallback(() => {
    if (overlay.kind !== 'none' || flow.screen !== 'playing' || timeUp) return;
    game.current?.send({ type: 'pause' });
    setOverlay({ kind: 'paused' });
  }, [overlay.kind, flow.screen, timeUp]);

  const resume = useCallback(() => {
    setOverlay({ kind: 'none' });
    game.current?.send({ type: 'resume' });
  }, []);

  // Leaving the app mid-level opens the pause menu.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') pause();
    });
    return () => sub.remove();
  }, [pause]);

  // Hardware back pauses, and resumes from the pause menu. Other popups need a button.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (overlay.kind === 'paused') resume();
      else pause();
      return true;
    });
    return () => sub.remove();
  }, [overlay.kind, pause, resume]);

  const setAudio = (patch: { music?: boolean; sound?: boolean }) => {
    const next = { music: patch.music ?? settings.music, sound: patch.sound ?? settings.sound };
    updateSettings(next);
    game.current?.send({ type: 'audio', audio: next });
  };

  const choose = async (kind: ChanceChoice['kind']) => {
    if (busy) return;
    let choice: ChanceChoice;
    if (kind === 'rewarded') {
      setBusy(true);
      const earned = await ads.showRewarded();
      setBusy(false);
      choice = { kind: 'rewarded', earned };
    } else {
      choice = kind === 'use' ? { kind: 'use' } : { kind: 'no_thanks' };
    }
    const result = resolveAnotherChance(flow, choice, progress.storedHearts);
    if (result.storedHearts !== progress.storedHearts) updateProgress((p) => setStoredHearts(p, result.storedHearts));
    setFlow(result.flow);
    if (result.respawn) game.current?.send({ type: 'grantHeart' });
  };

  const failedAction = (action: MissionFailedAction) => {
    const nav = missionFailedNavigation(action);
    if (nav.kind === 'restart_level') {
      setFlow({ screen: 'playing' });
      setTimeUp(false);
      game.current?.send({ type: 'restart' });
    } else {
      router.dismissTo(nav.to);
    }
  };

  const leaveComplete = async (next: 'replay' | 'next') => {
    if (busy) return;
    setBusy(true);
    await ads.levelCompleted();
    setBusy(false);
    if (next === 'replay') {
      startLevel(levelId);
      return;
    }
    const nextId = nextLevelId(levelId);
    if (!nextId) {
      router.dismissTo('/map');
      return;
    }
    setLevelId(nextId);
    startLevel(nextId);
  };

  const options = anotherChanceOptions(progress.storedHearts, ads.rewardedReady);
  const def = getLevel(levelId);

  return (
    <View style={styles.root}>
      <GameView ref={game} onMessage={onMessage} />
      {started ? <Hud hud={hud} onPause={pause} /> : null}
      {timeUp ? <TimeUpBanner /> : null}

      {overlay.kind === 'paused' ? (
        <PausePopup
          music={settings.music}
          sound={settings.sound}
          onMusic={(music) => setAudio({ music })}
          onSound={(sound) => setAudio({ sound })}
          onResume={resume}
          onRestart={() => {
            setOverlay({ kind: 'none' });
            game.current?.send({ type: 'restart' });
          }}
          onMenu={() => router.dismissTo('/')}
        />
      ) : null}

      {overlay.kind === 'tip' ? (
        <TipPopup
          title={TIP_TEXT[overlay.id].title}
          body={TIP_TEXT[overlay.id].body}
          onClose={() => {
            setOverlay({ kind: 'none' });
            game.current?.send({ type: 'tipClosed', skipAll: false });
          }}
          onSkipAll={() => {
            updateSettings({ tips: false });
            setOverlay({ kind: 'none' });
            game.current?.send({ type: 'tipClosed', skipAll: true });
          }}
        />
      ) : null}

      {flow.screen === 'another_chance' ? (
        <AnotherChancePopup
          storedHearts={progress.storedHearts}
          useEnabled={options.useEnabled}
          rewardedEnabled={options.rewardedEnabled}
          busy={busy}
          onNoThanks={() => void choose('no_thanks')}
          onUse={() => void choose('use')}
          onRewarded={() => void choose('rewarded')}
        />
      ) : null}

      {flow.screen === 'mission_failed' ? <MissionFailedPopup reason={flow.reason} onAction={failedAction} /> : null}

      {overlay.kind === 'complete' ? (
        <MissionCompletePopup
          stars={overlay.stars}
          coins={overlay.summary.coins}
          score={overlay.summary.score}
          timeSeconds={overlay.summary.timeSeconds}
          targetSeconds={def.targetSeconds}
          newBest={overlay.newBest}
          nextLabel={nextLevelId(levelId) ? 'Next Level' : 'Map'}
          busy={busy}
          onReplay={() => void leaveComplete('replay')}
          onNext={() => void leaveComplete('next')}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.ink },
});
