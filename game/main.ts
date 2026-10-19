/**
 * WebView entry point. Boots Phaser, bakes the procedural art, and connects the bridge, the
 * on-screen controls and the synthesized audio to the level scene.
 */

import Phaser from 'phaser';

import { isLevelId } from '../src/core/level-format';
import { PHYS, VIEW_HEIGHT } from '../src/core/physics';
import type { HostToGame } from '../src/core/protocol';
import { bakeTextures } from './art';
import { Audio } from './audio';
import { Bridge } from './bridge';
import { Controls } from './controls';
import { PlayScene, type PlaySceneData, type Services } from './play-scene';

const bridge = new Bridge();
const audio = new Audio();
const controls = new Controls(() => audio.unlock());
controls.setVisible(false);

window.addEventListener('error', (event) => bridge.send({ type: 'error', message: String(event.message) }));

let current: PlaySceneData | null = null;
let booted = false;
const pending: HostToGame[] = [];

class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    bakeTextures(this);
    this.anims.create({
      key: 'coin-spin',
      frames: [{ key: 'coin-1' }, { key: 'coin-2' }, { key: 'coin-3' }, { key: 'coin-4' }],
      frameRate: 8,
      repeat: -1,
    });
    booted = true;
    bridge.send({ type: 'ready' });
    pending.splice(0).forEach(handle);
  }
}

function playScene(): PlayScene | null {
  const scene = game.scene.getScene('play');
  return scene instanceof PlayScene && scene.sys.isActive() ? scene : null;
}

function startLevel(data: PlaySceneData): void {
  current = data;
  const manager = game.scene;
  if (manager.isActive('play') || manager.isPaused('play')) manager.getScene('play').scene.restart(data);
  else manager.start('play', data);
}

function handle(message: HostToGame): void {
  if (!booted) {
    pending.push(message);
    return;
  }
  switch (message.type) {
    case 'start':
      audio.setEnabled(message.audio.music, message.audio.sound);
      controls.setInsets(message.insets);
      startLevel({ level: message.level, tips: message.tips });
      break;
    case 'restart':
      if (current) startLevel({ level: current.level, tips: [] });
      break;
    case 'pause':
      playScene()?.pauseGame();
      break;
    case 'resume':
      playScene()?.resumeGame();
      break;
    case 'grantHeart':
      playScene()?.continueRun();
      break;
    case 'audio':
      audio.setEnabled(message.audio.music, message.audio.sound);
      break;
    case 'tipClosed':
      playScene()?.closeTip(message.skipAll);
      break;
  }
}

bridge.on(handle);

/** Logical size: 15 tiles tall, as wide as the screen's aspect ratio allows. */
function logicalWidth(): number {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  return Math.round(Phaser.Math.Clamp(VIEW_HEIGHT * aspect, 960, 1800));
}

const services: Services = { audio, controls, bridge };

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: logicalWidth(),
  height: VIEW_HEIGHT,
  backgroundColor: '#8fd3ff',
  banner: false,
  audio: { noAudio: true },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: PHYS.gravity }, fps: 60, tileBias: 24 } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true, roundPixels: true, powerPreference: 'high-performance' },
  fps: { target: 60, smoothStep: true },
  input: { keyboard: false, mouse: false, touch: false, gamepad: false },
  scene: [BootScene, PlayScene],
  callbacks: {
    preBoot: (g) => {
      g.registry.set('services', services);
    },
  },
});

// Opening the page directly (no host) with #level=1-1 starts that level, for desktop testing.
const hashLevel = new URLSearchParams(window.location.hash.slice(1)).get('level');
if (hashLevel && isLevelId(hashLevel)) {
  handle({ type: 'start', level: hashLevel, audio: { music: true, sound: true }, tips: ['move', 'jump', 'run', 'spin', 'grab', 'walljump'], insets: { left: 0, right: 0, top: 0, bottom: 0 } });
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) playScene()?.pauseGame();
});
