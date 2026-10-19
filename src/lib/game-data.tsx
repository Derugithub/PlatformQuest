import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import {
  defaultProgress,
  defaultSettings,
  parseProgress,
  parseSettings,
  type Progress,
  type Settings,
} from '@/core/progress';
import { KEYS, readRaw, writeRaw, writeRawSync } from '@/lib/storage';

type GameData = {
  loaded: boolean;
  progress: Progress;
  settings: Settings;
  updateProgress: (change: (prev: Progress) => Progress) => void;
  updateSettings: (patch: Partial<Omit<Settings, 'schema'>>) => void;
};

const GameDataContext = createContext<GameData>({
  loaded: false,
  progress: defaultProgress(),
  settings: defaultSettings(),
  updateProgress: () => undefined,
  updateSettings: () => undefined,
});

/** Loads and saves progress and settings under the versioned `platformquest.*.v1` keys. */
export function GameDataProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState<Progress>(defaultProgress);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const progressRef = useRef(progress);

  useEffect(() => {
    let alive = true;
    Promise.all([readRaw(KEYS.progress), readRaw(KEYS.settings)]).then(([rawProgress, rawSettings]) => {
      if (!alive) return;
      const p = parseProgress(rawProgress);
      const s = parseSettings(rawSettings);
      progressRef.current = p;
      setProgress(p);
      setSettings(s);
      setLoaded(true);
      // Rewrite once so a migrated save is stored in the current schema.
      void writeRaw(KEYS.progress, JSON.stringify(p));
      void writeRaw(KEYS.settings, JSON.stringify(s));
    });
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'background') writeRawSync(KEYS.progress, JSON.stringify(progressRef.current));
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const updateProgress = useCallback((change: (prev: Progress) => Progress) => {
    setProgress((prev) => {
      const next = change(prev);
      progressRef.current = next;
      void writeRaw(KEYS.progress, JSON.stringify(next));
      return next;
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<Omit<Settings, 'schema'>>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void writeRaw(KEYS.settings, JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ loaded, progress, settings, updateProgress, updateSettings }),
    [loaded, progress, settings, updateProgress, updateSettings],
  );
  return <GameDataContext.Provider value={value}>{children}</GameDataContext.Provider>;
}

export function useGameData(): GameData {
  return useContext(GameDataContext);
}
