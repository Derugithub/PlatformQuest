/**
 * The level scene: builds the tilemap from level data, runs the player, monsters, items, the boss
 * and the countdown, and reports everything the host needs over the bridge.
 */

import Phaser from 'phaser';

import { applyHit, collectHeart, startHearts, type Form } from '../src/core/hearts';
import { ENEMY_KIND, parseLevel, type EnemyKind, type LevelDef, type ParsedLevel, type Tutorial, type TutorialId } from '../src/core/level-format';
import { getLevel } from '../src/core/levels';
import {
  canWallCling,
  clampFall,
  cutJump,
  gravityFor,
  isStomp,
  jumpLaunch,
  PHYS,
  ROWS,
  stepHorizontal,
  TILE,
  type Direction,
  type JumpKind,
} from '../src/core/physics';
import type { HudState } from '../src/core/protocol';
import { chainPoints, POINTS, timeBonus } from '../src/core/scoring';
import {
  displaySeconds,
  elapsedSeconds,
  HURRY_TEMPO,
  isHurry,
  startTimer,
  tickTimer,
  timerAfterContinue,
  type TimerState,
} from '../src/core/timer';
import { TILE_INDEX, type TileFrame } from './art';
import type { Audio } from './audio';
import type { Bridge } from './bridge';
import type { Controls } from './controls';

const T = TILE;
const SOLID_FRAMES: TileFrame[] = ['grass', 'dirt', 'hard', 'brick', 'item', 'used', 'tire', 'switch', 'dotOn', 'gate', 'switchUsed'];
const SWITCH_MS = 10_000;
const STAR_MS = 8_000;
const INVULN_MS = 1_600;
const SHELL_WAKE_MS = 8_000;
const SHELL_SPEED = 520;
const ARENA_WIDTH = 32;
const BOSS_HP = 10;
const BOSS_ID = -1;

type Body = Phaser.Physics.Arcade.Body;
type Sprite = Phaser.Physics.Arcade.Sprite;
type GameObject = Phaser.GameObjects.GameObject;
type ItemKind = 'coin' | 'tool' | 'star' | 'heart' | 'goldheart';
type EnemyState = 'walk' | 'fly' | 'hang' | 'shell' | 'shellMoving' | 'carried' | 'dead';
type Mode = 'play' | 'paused' | 'tip' | 'dying' | 'timeup' | 'waiting' | 'finished';

type Enemy = {
  id: number;
  kind: Exclude<EnemyKind, 'boss'>;
  sprite: Sprite;
  state: EnemyState;
  dir: -1 | 1;
  awake: boolean;
  /** Animation clock in ms. */
  t: number;
  /** Shell wake-up and monkey throw timers, in ms. */
  timer: number;
  baseX: number;
  baseY: number;
  chain: number;
  kickGraceMs: number;
  /** Placed in the level data (counts toward "Defeat all monsters"). */
  original: boolean;
};

type BossState = 'wait' | 'idle' | 'hop' | 'windup' | 'fire' | 'bones' | 'dead';

type Boss = {
  sprite: Sprite;
  hp: number;
  state: BossState;
  t: number;
  facing: -1 | 1;
  invulnMs: number;
  bonesLeft: number;
  boneTimer: number;
  cycle: number;
};

export type PlaySceneData = { level: LevelDef['id']; tips: TutorialId[] };

export type Services = { audio: Audio; controls: Controls; bridge: Bridge };

const key = (col: number, row: number) => `${col},${row}`;

export class PlayScene extends Phaser.Scene {
  private services!: Services;
  private def!: LevelDef;
  private level!: ParsedLevel;
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private player!: Sprite;
  private glow!: Phaser.GameObjects.Image;
  private enemies: Enemy[] = [];
  private enemyBySprite = new Map<GameObject, Enemy>();
  private enemyGroup!: Phaser.Physics.Arcade.Group;
  private items!: Phaser.Physics.Arcade.Group;
  private coins!: Phaser.Physics.Arcade.StaticGroup;
  private bonusCoins!: Phaser.Physics.Arcade.Group;
  private shots!: Phaser.Physics.Arcade.Group;
  private hazards!: Phaser.Physics.Arcade.Group;
  private platforms!: Phaser.Physics.Arcade.Group;
  private platformRange = new Map<GameObject, { min: number; max: number }>();
  private flags: { image: Phaser.GameObjects.Image; x: number; bottom: number; on: boolean }[] = [];
  private contents = new Map<string, ItemKind>();
  private hidden = new Map<string, ItemKind>();
  private vines = new Set<string>();
  private dotted: { col: number; row: number }[] = [];
  private switches: { col: number; row: number }[] = [];
  private itemKind = new Map<GameObject, ItemKind>();
  private hazardKind = new Map<GameObject, 'banana' | 'fire' | 'bone'>();

  private mode: Mode = 'play';
  private pausedFrom: Mode = 'play';
  private hearts = 2;
  private form: Form = 'small';
  private score = 0;
  private coinCount = 0;
  private timer: TimerState = startTimer(300);
  private starMs = 0;
  private invulnMs = 0;
  private facing: -1 | 1 = 1;
  private onVine = false;
  private wallDir: Direction = 0;
  private wallLockMs = 0;
  private spinning = false;
  private spinHangMs = 0;
  private coyoteMs = 0;
  private jumpBufferMs = 0;
  private bufferedSpin = false;
  private jumpCut = true;
  private jumpKind: JumpKind | null = null;
  private ducking = false;
  private carrying: Enemy | null = null;
  private shotCooldownMs = 0;
  private bumpCooldownMs = 0;
  private stompChain = 0;
  private poseClock = 0;
  private throwPoseMs = 0;
  private switchMs = 0;
  private switchTick = 0;
  private checkpoint: { x: number; bottom: number } | null = null;
  private startPoint = { x: 0, bottom: 0 };
  private goalX = 0;
  private defeated = new Set<number>();
  private nextEnemyId = 0;
  private tips: Tutorial[] = [];
  private hudKey = '';
  private hudAt = 0;
  private boss: Boss | null = null;
  private arena: { left: number; right: number } | null = null;
  private arenaLocked = false;
  private arenaWall: Phaser.GameObjects.Zone | null = null;
  private arenaToolBlock: { col: number; row: number } | null = null;
  private arenaTimer = 0;
  private bg: { far: Phaser.GameObjects.TileSprite; near: Phaser.GameObjects.TileSprite } | null = null;

  constructor() {
    super('play');
  }

  init(data: PlaySceneData): void {
    this.services = this.registry.get('services') as Services;
    this.def = getLevel(data.level);
    this.level = parseLevel(this.def);
    const allowed = new Set(data.tips);
    this.tips = this.def.tutorials.filter((tip) => allowed.has(tip.id)).sort((a, b) => a.col - b.col);
    this.enemies = [];
    this.enemyBySprite.clear();
    this.platformRange.clear();
    this.flags = [];
    this.contents.clear();
    this.hidden.clear();
    this.vines.clear();
    this.dotted = [];
    this.switches = [];
    this.itemKind.clear();
    this.hazardKind.clear();
    this.mode = 'play';
    const hs = startHearts();
    this.hearts = hs.hearts;
    this.form = hs.form;
    this.score = 0;
    this.coinCount = 0;
    this.timer = startTimer(this.def.timeLimit);
    this.starMs = 0;
    this.invulnMs = 0;
    this.facing = 1;
    this.onVine = false;
    this.wallDir = 0;
    this.ducking = false;
    this.carrying = null;
    this.switchMs = 0;
    this.checkpoint = null;
    this.goalX = 0;
    this.defeated.clear();
    this.nextEnemyId = 0;
    this.hudKey = '';
    this.boss = null;
    this.arena = null;
    this.arenaLocked = false;
    this.arenaWall = null;
    this.arenaToolBlock = null;
    this.arenaTimer = 0;
  }

  create(): void {
    const { rows, cols } = this.level;
    const width = cols * T;
    const height = ROWS * T;
    this.createBackground(width);

    const data: number[][] = [];
    for (let r = 0; r < ROWS; r += 1) {
      const line: number[] = [];
      for (let c = 0; c < cols; c += 1) line.push(this.tileFor(rows, c, r));
      data.push(line);
    }
    const map = this.make.tilemap({ data, tileWidth: T, tileHeight: T });
    const tileset = map.addTilesetImage('tiles', 'tiles', T, T, 0, 0);
    if (!tileset) throw new Error('tileset failed');
    const layer = map.createLayer(0, tileset, 0, 0);
    if (!layer) throw new Error('layer failed');
    this.layer = layer;
    this.layer.setCollision(SOLID_FRAMES.map((f) => TILE_INDEX[f]));

    this.physics.world.setBounds(0, -T * 6, width, height + T * 12);
    this.physics.world.setBoundsCollision(true, true, false, false);

    this.enemyGroup = this.physics.add.group();
    this.items = this.physics.add.group();
    this.coins = this.physics.add.staticGroup();
    this.bonusCoins = this.physics.add.group();
    this.shots = this.physics.add.group();
    this.hazards = this.physics.add.group();
    this.platforms = this.physics.add.group({ allowGravity: false, immovable: true });

    this.createPlayer();
    this.placeObjects();

    this.physics.add.collider(this.player, this.layer);
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.enemyGroup, this.layer);
    this.physics.add.collider(this.items, this.layer);
    this.physics.add.collider(this.bonusCoins, this.layer);
    this.physics.add.collider(this.shots, this.layer, (shot) => this.popShot(shot as GameObject));
    this.physics.add.collider(this.hazards, this.layer, (h) => {
      const obj = h as GameObject;
      if (this.hazardKind.get(obj) !== 'fire') this.destroyHazard(obj);
    });
    this.physics.add.overlap(this.player, this.enemyGroup, (_p, e) => this.onPlayerEnemy(e as GameObject));
    this.physics.add.overlap(this.player, this.items, (_p, i) => this.collectItem(i as GameObject));
    this.physics.add.overlap(this.player, this.coins, (_p, c) => this.collectCoin(c as GameObject));
    this.physics.add.overlap(this.player, this.bonusCoins, (_p, c) => this.collectCoin(c as GameObject));
    this.physics.add.overlap(this.shots, this.enemyGroup, (s, e) => this.onShotEnemy(s as GameObject, e as GameObject));
    this.physics.add.overlap(this.player, this.hazards, (_p, h) => this.onHazard(h as GameObject));
    this.physics.add.overlap(this.enemyGroup, this.enemyGroup, (a, b) => this.onEnemyEnemy(a as GameObject, b as GameObject));

    const cam = this.cameras.main;
    cam.setBounds(0, 0, width, height);
    cam.startFollow(this.player, true, 0.18, 0.12, 0, T);
    cam.setDeadzone(T * 2.5, T * 3);
    cam.setRoundPixels(true);

    const { audio, controls, bridge } = this.services;
    controls.flush();
    controls.setVisible(true);
    audio.setTempo(1);
    audio.playSong('hill');
    bridge.send({ type: 'levelStarted', level: this.def.id });
    this.sendHud(true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audio.stopSong());
  }

  // ---------------------------------------------------------------- level building

  private tileFor(rows: readonly string[], c: number, r: number): number {
    const ch = rows[r][c];
    const above = r > 0 ? rows[r - 1][c] : '.';
    switch (ch) {
      case '#':
        return TILE_INDEX[above === '#' ? 'dirt' : 'grass'];
      case 'X':
        return TILE_INDEX.hard;
      case 'B':
        return TILE_INDEX.brick;
      case '?':
      case 'P':
      case 'S':
      case 'H':
        this.contents.set(key(c, r), ch === '?' ? 'coin' : ch === 'P' ? 'tool' : ch === 'S' ? 'star' : 'heart');
        return TILE_INDEX.item;
      case 'h':
        this.hidden.set(key(c, r), 'goldheart');
        return -1;
      case 'T':
        return TILE_INDEX.tire;
      case '!':
        this.switches.push({ col: c, row: r });
        return TILE_INDEX.switch;
      case 'D':
        this.dotted.push({ col: c, row: r });
        return TILE_INDEX.dotOff;
      case 'W':
        return TILE_INDEX.gate;
      default:
        return -1;
    }
  }

  private createBackground(levelWidth: number): void {
    const { width, height } = this.scale;
    const boss = this.def.music === 'boss';
    this.add.image(0, 0, 'sky').setOrigin(0).setScrollFactor(0).setDisplaySize(width, height).setDepth(-20).setTint(boss ? 0xffc2a8 : 0xffffff);
    for (let i = 0; i < Math.ceil(levelWidth / 900) + 2; i += 1) {
      this.add.image(i * 420 + (i % 3) * 90, 70 + (i % 4) * 46, 'cloud').setScrollFactor(0.15, 0).setDepth(-19).setAlpha(0.95);
    }
    const far = this.add.tileSprite(0, height - 420, width, 300, 'hills-far').setOrigin(0).setScrollFactor(0).setDepth(-18).setTileScale(1.4, 1.4);
    const near = this.add.tileSprite(0, height - 330, width, 300, 'hills-near').setOrigin(0).setScrollFactor(0).setDepth(-17).setTileScale(1.2, 1.2);
    if (boss) {
      far.setTint(0xd98b6b);
      near.setTint(0xc2705a);
    }
    this.bg = { far, near };
  }

  private placeObjects(): void {
    const { rows, cols } = this.level;
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const ch = rows[r][c];
        const x = c * T + T / 2;
        const bottom = (r + 1) * T;
        if (ch === 'o') {
          const coin = this.coins.create(x, r * T + T / 2, 'coin-1') as Sprite;
          coin.play('coin-spin');
          coin.setDepth(1);
          (coin.body as Phaser.Physics.Arcade.StaticBody).setSize(26, 26);
        } else if (ch === 'V') {
          this.vines.add(key(c, r));
          this.add.image(x, r * T + T / 2, 'vine').setDepth(-4);
        } else if (ch === 'F') {
          const image = this.add.image(x, bottom, 'flag').setOrigin(0.5, 1).setDepth(-4);
          this.flags.push({ image, x, bottom, on: false });
        } else if (ch === 'G') {
          this.add.image(x, bottom, 'house').setOrigin(0.5, 1).setDepth(-4);
          this.goalX = x;
        } else if (ch === 'b') {
          this.spawnBoss(x, bottom);
        } else if (ENEMY_KIND[ch]) {
          const kind = ENEMY_KIND[ch];
          if (kind !== 'boss') this.spawnEnemy(kind, x, bottom, r, true);
        }
        if (ch === '#' && r > 0 && rows[r - 1][c] === '.' && (c * 7 + r * 3) % 17 === 0) {
          this.add.image(x, r * T + 4, 'bush').setOrigin(0.5, 1).setDepth(-5).setScale(0.8);
        }
      }
    }
    for (const p of this.level.platforms) {
      const minX = p.fromCol * T + (p.width * T) / 2;
      const maxX = p.toCol * T + (p.width * T) / 2;
      const plat = this.platforms.create(minX, p.row * T + 12, 'platform') as Phaser.Physics.Arcade.Image;
      const body = plat.body as Body;
      body.checkCollision.down = false;
      body.checkCollision.left = false;
      body.checkCollision.right = false;
      body.setVelocityX(85);
      plat.setDepth(1);
      this.platformRange.set(plat, { min: minX, max: maxX });
    }
    const gateCol = rows[2].indexOf('W');
    if (this.boss && gateCol > 0) {
      const left = (gateCol - ARENA_WIDTH + 1) * T;
      this.arena = { left, right: (gateCol + 1) * T };
      for (const [k, kind] of this.contents) {
        const [c, r] = k.split(',').map(Number);
        if (kind === 'tool' && c * T >= left) this.arenaToolBlock = { col: c, row: r };
      }
    }
  }

  private createPlayer(): void {
    const { rows, cols } = this.level;
    for (let r = 0; r < ROWS; r += 1) {
      const c = rows[r].indexOf('@');
      if (c >= 0 && c < cols) this.startPoint = { x: c * T + T / 2, bottom: (r + 1) * T };
    }
    const s = this.startPoint;
    this.glow = this.add.image(s.x, s.bottom, 'glow').setDepth(2.5).setVisible(false).setBlendMode(Phaser.BlendModes.ADD);
    this.player = this.physics.add.sprite(s.x, s.bottom, 'hero-s-idle');
    this.player.setOrigin(0.5, 1).setDepth(3);
    this.player.setCollideWorldBounds(true);
    this.applyPlayerBody();
  }

  private spawnEnemy(kind: Exclude<EnemyKind, 'boss'>, x: number, bottom: number, row: number, original: boolean): Enemy {
    const tex = kind === 'slime' ? 'slime-1' : kind === 'poison' ? 'poison-1' : kind === 'monkey' ? 'monkey-1' : kind === 'flyer' ? 'flyer-1' : `${kind}-1`;
    const sprite = this.enemyGroup.create(x, bottom, tex) as Sprite;
    sprite.setOrigin(0.5, 1).setDepth(2);
    const body = sprite.body as Body;
    const e: Enemy = {
      id: this.nextEnemyId++,
      kind,
      sprite,
      state: 'walk',
      dir: -1,
      awake: false,
      t: 0,
      timer: 0,
      baseX: x,
      baseY: bottom,
      chain: 0,
      kickGraceMs: 0,
      original,
    };
    this.sizeEnemy(e);
    if (kind === 'flyer') {
      e.state = 'fly';
      body.setAllowGravity(false);
    } else if (kind === 'monkey') {
      e.state = 'hang';
      body.setAllowGravity(false);
      body.setImmovable(true);
      // Hangs from the ceiling directly above its marker.
      sprite.setY(row * T + 64);
      e.baseY = sprite.y;
      e.timer = 1200;
    }
    body.enable = false;
    this.enemies.push(e);
    this.enemyBySprite.set(sprite, e);
    return e;
  }

  private sizeEnemy(e: Enemy): void {
    const body = e.sprite.body as Body;
    const fh = e.sprite.height;
    const fw = e.sprite.width;
    let w = 32;
    let h = 38;
    if (e.state === 'shell' || e.state === 'shellMoving' || e.state === 'carried') {
      w = 34;
      h = 28;
    } else if (e.kind === 'slime') {
      w = 34;
      h = 26;
    } else if (e.kind === 'poison') {
      w = 30;
      h = 32;
    } else if (e.kind === 'monkey') {
      w = 30;
      h = 40;
    }
    body.setSize(w, h, false);
    body.setOffset((fw - w) / 2, fh - h - 2);
  }

  private pbody(): Body {
    return this.player.body as Body;
  }

  private applyPlayerBody(): void {
    const tool = this.form === 'tool';
    const frameH = tool ? 80 : 48;
    const w = tool ? 30 : 26;
    const h = tool ? (this.ducking ? 44 : 70) : this.ducking ? 28 : 40;
    this.pbody().setSize(w, h, false);
    this.pbody().setOffset((48 - w) / 2, frameH - h - 3);
  }

  private setForm(form: Form): void {
    if (this.form === form) return;
    this.form = form;
    this.player.setTexture(`hero-${form === 'tool' ? 't' : 's'}-idle`);
    this.applyPlayerBody();
  }

  private markDefeated(e: Enemy): void {
    if (e.original) this.defeated.add(e.id);
  }

  // ---------------------------------------------------------------- host commands

  pauseGame(): void {
    if (this.mode === 'paused' || this.mode === 'tip') return;
    this.pausedFrom = this.mode;
    this.mode = 'paused';
    this.freeze(true);
  }

  resumeGame(): void {
    if (this.mode !== 'paused') return;
    this.mode = this.pausedFrom;
    this.freeze(false);
  }

  closeTip(skipAll: boolean): void {
    if (skipAll) this.tips = [];
    if (this.mode !== 'tip') return;
    this.mode = 'play';
    this.freeze(false);
  }

  private freeze(on: boolean): void {
    const { audio, controls } = this.services;
    if (on) {
      this.physics.world.pause();
      this.tweens.pauseAll();
      this.anims.pauseAll();
      this.time.paused = true;
      audio.suspend();
      controls.releaseAll();
    } else {
      if (this.mode === 'play') this.physics.world.resume();
      this.tweens.resumeAll();
      this.anims.resumeAll();
      this.time.paused = false;
      audio.resume();
      controls.flush();
    }
  }

  /** Another chance accepted: back to the last checkpoint (or the start) with one heart. */
  continueRun(): void {
    if (this.mode !== 'waiting') return;
    const point = this.checkpoint ?? this.startPoint;
    this.tweens.killTweensOf(this.player);
    const body = this.pbody();
    this.form = 'small';
    this.ducking = false;
    this.player.setTexture('hero-s-idle').setAngle(0).setAlpha(1);
    this.applyPlayerBody();
    body.setAllowGravity(true);
    body.reset(point.x, point.bottom);
    this.hearts = 1;
    this.invulnMs = 2_000;
    this.starMs = 0;
    this.onVine = false;
    this.spinning = false;
    this.timer = timerAfterContinue(this.timer);
    const { audio, controls } = this.services;
    audio.setTempo(isHurry(this.timer) ? HURRY_TEMPO : 1);
    if (this.arena && point.x < this.arena.left) this.unlockArena();
    this.hazards.clear(true, true);
    this.hazardKind.clear();
    this.mode = 'play';
    this.physics.world.resume();
    this.cameras.main.startFollow(this.player, true, 0.18, 0.12, 0, T);
    audio.playSong(this.boss && this.arenaLocked ? 'boss' : 'hill');
    controls.flush();
    controls.setVisible(true);
    this.sendHud(true);
  }

  // ---------------------------------------------------------------- main loop

  update(_time: number, delta: number): void {
    if (this.mode === 'paused' || this.mode === 'tip') return;
    const dt = Math.min(delta, 50) / 1000;
    const ms = dt * 1000;
    this.updateBackground();
    this.updatePlatforms();
    if (this.mode !== 'play') return;

    const tick = tickTimer(this.timer, dt);
    this.timer = tick.state;
    if (tick.events.includes('hurry')) this.services.audio.setTempo(HURRY_TEMPO);
    if (tick.events.includes('timeout')) {
      this.timeUp();
      return;
    }

    this.invulnMs = Math.max(0, this.invulnMs - ms);
    this.shotCooldownMs = Math.max(0, this.shotCooldownMs - ms);
    this.bumpCooldownMs = Math.max(0, this.bumpCooldownMs - ms);
    this.throwPoseMs = Math.max(0, this.throwPoseMs - ms);
    if (this.starMs > 0) {
      this.starMs = Math.max(0, this.starMs - ms);
      if (this.starMs === 0) {
        this.player.clearTint();
        this.services.audio.playSong(this.boss && this.arenaLocked ? 'boss' : 'hill');
      }
    }

    this.updatePlayer(dt);
    if (this.mode !== 'play') return;
    this.updateEnemies(dt);
    this.updateItems();
    this.updateSwitch(ms);
    this.updateFlags();
    this.updateBoss(dt);
    if (this.mode !== 'play') return;
    this.updateTips();
    this.checkGoal();
    if (this.mode === 'play' && this.pbody().top > ROWS * T + 24) this.die('pit');
    this.sendHud(false);
  }

  private updateBackground(): void {
    if (!this.bg) return;
    const sx = this.cameras.main.scrollX;
    this.bg.far.tilePositionX = (sx * 0.18) / 1.4;
    this.bg.near.tilePositionX = (sx * 0.4) / 1.2;
  }

  private updatePlatforms(): void {
    for (const [plat, range] of this.platformRange) {
      const body = (plat as Phaser.Physics.Arcade.Image).body as Body;
      if (body.center.x <= range.min && body.velocity.x < 0) body.setVelocityX(85);
      else if (body.center.x >= range.max && body.velocity.x > 0) body.setVelocityX(-85);
    }
  }

  // ---------------------------------------------------------------- player

  private updatePlayer(dt: number): void {
    const ms = dt * 1000;
    const body = this.pbody();
    const { controls, audio } = this.services;
    const input = controls.state;
    const dir: Direction = input.left === input.right ? 0 : input.left ? -1 : 1;
    const onGround = body.blocked.down || body.touching.down;
    this.coyoteMs = onGround ? PHYS.coyoteMs : Math.max(0, this.coyoteMs - ms);
    this.wallLockMs = Math.max(0, this.wallLockMs - ms);
    if (controls.pressed('jump')) {
      this.jumpBufferMs = PHYS.jumpBufferMs;
      this.bufferedSpin = false;
    } else if (controls.pressed('spin')) {
      this.jumpBufferMs = PHYS.jumpBufferMs;
      this.bufferedSpin = true;
    } else {
      this.jumpBufferMs = Math.max(0, this.jumpBufferMs - ms);
    }
    const jumpHeld = input.held.jump || input.held.spin;

    if (body.blocked.up) this.bumpAbove();
    else if (body.velocity.y < 0) this.checkHidden();

    // Vines
    const vineHere = this.vineAt(body.center.x, body.center.y);
    if (!this.onVine && vineHere && !this.carrying && (input.up || (input.down && !onGround))) {
      this.onVine = true;
      this.spinning = false;
      body.setAllowGravity(false);
    }
    if (this.onVine) {
      if (!vineHere || (onGround && input.down)) {
        this.leaveVine();
      } else if (this.jumpBufferMs > 0) {
        this.leaveVine();
        body.setVelocityY(-jumpLaunch('normal', 0) * 0.9);
        this.jumpBufferMs = 0;
        this.jumpCut = false;
        this.jumpKind = 'normal';
        audio.play('jump');
      } else {
        body.setVelocity(dir * 110, input.up ? -PHYS.climbSpeed : input.down ? PHYS.climbSpeed : 0);
        if (dir !== 0) this.facing = dir;
        this.poseClock += input.up || input.down ? ms : 0;
        this.setPose(Math.floor(this.poseClock / 140) % 2 === 0 ? 'climb1' : 'climb2');
        this.updateGrab(controls.pressed('grab'));
        this.afterPlayerMove();
        return;
      }
    }

    // Duck (stays ducked under a low ceiling)
    const wantDuck = onGround && input.down && !this.carrying;
    if (wantDuck !== this.ducking && (wantDuck || !this.ceilingAbove())) {
      this.ducking = wantDuck;
      this.applyPlayerBody();
    }

    let vx = body.velocity.x;
    if (this.wallLockMs <= 0) {
      vx = stepHorizontal(vx, { dir, run: input.held.run, onGround, ducking: this.ducking, star: this.starMs > 0 }, dt);
    }

    const intoLeft = dir < 0 && body.blocked.left;
    const intoRight = dir > 0 && body.blocked.right;
    const cling = canWallCling({
      onGround,
      vy: body.velocity.y,
      pressingIntoWall: intoLeft || intoRight,
      toolSuit: this.form === 'tool',
      carrying: this.carrying != null,
    });
    this.wallDir = cling ? (intoLeft ? -1 : 1) : 0;

    let vy = body.velocity.y;
    if (this.jumpBufferMs > 0) {
      if (this.wallDir !== 0) {
        vy = -jumpLaunch('wall', 0);
        vx = -this.wallDir * PHYS.wallJumpSpeedX;
        this.wallLockMs = PHYS.wallJumpLockMs;
        this.facing = this.wallDir > 0 ? -1 : 1;
        this.wallDir = 0;
        this.jumpBufferMs = 0;
        this.jumpCut = false;
        this.jumpKind = 'wall';
        this.spinning = this.bufferedSpin;
        audio.play('jump');
      } else if (onGround || this.coyoteMs > 0) {
        const spin = this.bufferedSpin;
        vy = -jumpLaunch(spin ? 'spin' : 'normal', vx);
        this.spinning = spin;
        this.spinHangMs = spin ? PHYS.spinHangMs : 0;
        this.coyoteMs = 0;
        this.jumpBufferMs = 0;
        this.jumpCut = false;
        this.jumpKind = spin ? 'spin' : 'normal';
        if (this.ducking) {
          this.ducking = false;
          this.applyPlayerBody();
        }
        audio.play(spin ? 'spin' : 'jump');
      }
    }
    if (!this.jumpCut && vy < 0 && !jumpHeld) {
      vy = cutJump(vy, false);
      this.jumpCut = true;
    }
    if (this.spinHangMs > 0 && Math.abs(vy) < 260) this.spinHangMs = Math.max(0, this.spinHangMs - ms);
    body.setGravityY(gravityFor(vy, this.spinHangMs) - PHYS.gravity);
    vy = clampFall(vy, this.wallDir !== 0);

    if (onGround && vy >= 0) {
      const tile = body.blocked.down ? this.layer.getTileAtWorldXY(body.center.x, body.bottom + 4) : null;
      if (tile && tile.index === TILE_INDEX.tire) {
        vy = -jumpLaunch('tire', vx);
        this.jumpCut = true;
        this.jumpKind = 'tire';
        this.spinning = false;
        audio.play('boing');
        this.squashTile(tile.x, tile.y);
      } else {
        this.spinning = false;
        this.jumpKind = null;
        this.stompChain = 0;
      }
    }
    body.setVelocity(vx, vy);

    if (this.wallDir !== 0) this.facing = this.wallDir > 0 ? -1 : 1;
    else if (dir !== 0 && this.wallLockMs <= 0) this.facing = dir;

    if (controls.pressed('shoot')) this.throwWrench();
    this.updateGrab(controls.pressed('grab'));

    this.poseClock += Math.abs(vx) * dt * 3.2;
    let pose: string;
    if (this.throwPoseMs > 0) pose = 'throw';
    else if (this.wallDir !== 0) pose = 'cling';
    else if (this.ducking) pose = 'duck';
    else if (!onGround) pose = vy < 0 ? 'jump' : 'fall';
    else if (dir !== 0 && Math.sign(vx) !== dir && Math.abs(vx) > 120) pose = 'skid';
    else if (Math.abs(vx) > 20) pose = Math.floor(this.poseClock / 40) % 2 === 0 ? 'walk1' : 'walk2';
    else pose = 'idle';
    this.setPose(pose);
    this.afterPlayerMove();
  }

  private afterPlayerMove(): void {
    const p = this.player;
    const now = this.time.now;
    const spinFx = this.spinning && !this.onVine;
    p.setFlipX(spinFx ? Math.floor(now / 55) % 2 === 0 : this.facing < 0);
    const star = this.starMs > 0;
    this.glow.setVisible(spinFx || star);
    if (spinFx || star) {
      this.glow.setPosition(p.x, p.y - (this.form === 'tool' ? 38 : 22));
      this.glow.setRotation(now / 80);
      this.glow.setScale(this.form === 'tool' ? 1.25 : 0.9);
    }
    if (star) p.setTint(Phaser.Display.Color.HSVToRGB((now / 400) % 1, 0.45, 1).color);
    p.setAlpha(this.invulnMs > 0 && Math.floor(now / 70) % 2 === 0 ? 0.35 : 1);
    if (this.carrying) {
      const s = this.carrying.sprite;
      s.setPosition(p.x + this.facing * 26, p.y - (this.form === 'tool' ? 24 : 6));
      (s.body as Body).setVelocity(0, 0);
      s.setFlipX(this.facing < 0);
      this.carriedHits();
    }
  }

  private setPose(pose: string): void {
    const tex = `hero-${this.form === 'tool' ? 't' : 's'}-${pose}`;
    if (this.player.texture.key !== tex) this.player.setTexture(tex);
  }

  private leaveVine(): void {
    this.onVine = false;
    this.pbody().setAllowGravity(true);
  }

  private vineAt(x: number, y: number): boolean {
    return this.vines.has(key(Math.floor(x / T), Math.floor(y / T)));
  }

  private ceilingAbove(): boolean {
    const body = this.pbody();
    const top = body.bottom - (this.form === 'tool' ? 70 : 40);
    for (const x of [body.left + 2, body.right - 2]) {
      const tile = this.layer.getTileAtWorldXY(x, top);
      if (tile && tile.collides) return true;
    }
    return false;
  }

  private checkHidden(): void {
    const body = this.pbody();
    const col = Math.floor(body.center.x / T);
    const row = Math.floor((body.top - 2) / T);
    const k = key(col, row);
    const kind = this.hidden.get(k);
    if (!kind) return;
    this.hidden.delete(k);
    this.layer.putTileAt(TILE_INDEX.used, col, row);
    body.setVelocityY(0);
    this.player.y += (row + 1) * T - body.top + 1;
    this.bumpAnim(col, row, 'used');
    this.spawnItem(kind, col, row);
  }

  private bumpAbove(): void {
    if (this.bumpCooldownMs > 0) return;
    const body = this.pbody();
    const row = Math.floor((body.top - 4) / T);
    const cols = [Math.floor(body.center.x / T), Math.floor((body.left + 3) / T), Math.floor((body.right - 3) / T)];
    for (const col of cols) {
      const tile = this.layer.getTileAt(col, row);
      if (!tile || !tile.collides) continue;
      this.bumpCooldownMs = 160;
      this.bumpTile(col, row, tile.index);
      return;
    }
  }

  private bumpTile(col: number, row: number, index: number): void {
    const { audio } = this.services;
    this.killOnTop(col, row);
    if (index === TILE_INDEX.item) {
      const kind = this.contents.get(key(col, row)) ?? 'coin';
      this.contents.delete(key(col, row));
      this.layer.putTileAt(TILE_INDEX.used, col, row);
      this.bumpAnim(col, row, 'used');
      this.spawnItem(kind, col, row);
    } else if (index === TILE_INDEX.brick) {
      if (this.form === 'tool') this.breakBrick(col, row);
      else {
        this.bumpAnim(col, row, 'brick');
        audio.play('bump');
      }
    } else if (index === TILE_INDEX.switch) {
      this.bumpAnim(col, row, 'switchUsed');
      this.activateSwitch();
    } else {
      audio.play('bump');
    }
  }

  private bumpAnim(col: number, row: number, frame: TileFrame): void {
    const tile = this.layer.getTileAt(col, row);
    if (tile) tile.setAlpha(0);
    const img = this.add.image(col * T + T / 2, row * T + T / 2, `tile-${frame}`).setDepth(0.5);
    this.tweens.add({
      targets: img,
      y: img.y - 12,
      duration: 80,
      yoyo: true,
      onComplete: () => {
        img.destroy();
        this.layer.getTileAt(col, row)?.setAlpha(1);
      },
    });
  }

  private squashTile(col: number, row: number): void {
    const tile = this.layer.getTileAt(col, row);
    if (!tile) return;
    tile.setAlpha(0);
    const img = this.add.image(col * T + T / 2, row * T + T, 'tile-tire').setOrigin(0.5, 1).setDepth(0.5);
    this.tweens.add({
      targets: img,
      scaleY: 0.7,
      scaleX: 1.12,
      duration: 70,
      yoyo: true,
      onComplete: () => {
        img.destroy();
        tile.setAlpha(1);
      },
    });
  }

  private breakBrick(col: number, row: number): void {
    this.layer.removeTileAt(col, row);
    this.services.audio.play('break');
    this.addScore(POINTS.brick);
    const cx = col * T + T / 2;
    const cy = row * T + T / 2;
    for (const [dx, dy] of [
      [-1, -1],
      [1, -1],
      [-1, 0],
      [1, 0],
    ]) {
      const d = this.add.image(cx + dx * 10, cy + dy * 10, 'debris').setDepth(5);
      this.tweens.add({
        targets: d,
        x: d.x + dx * 90,
        y: d.y + 420,
        angle: dx * 360,
        duration: 800,
        ease: 'Quad.easeIn',
        onComplete: () => d.destroy(),
      });
    }
  }

  private killOnTop(col: number, row: number): void {
    const top = row * T;
    for (const e of [...this.enemies]) {
      if (e.state === 'dead' || e.state === 'carried' || !e.awake) continue;
      const b = e.sprite.body as Body;
      if (Math.abs(b.bottom - top) < 6 && b.right > col * T && b.left < (col + 1) * T) this.killEnemy(e, POINTS.stomp);
    }
  }

  private activateSwitch(): void {
    this.services.audio.play('switch');
    this.switchMs = SWITCH_MS;
    this.switchTick = 0;
    for (const d of this.dotted) this.layer.putTileAt(TILE_INDEX.dotOn, d.col, d.row);
    for (const s of this.switches) this.layer.putTileAt(TILE_INDEX.switchUsed, s.col, s.row);
  }

  private updateSwitch(ms: number): void {
    if (this.switchMs <= 0) return;
    this.switchMs -= ms;
    if (this.switchMs < 3000) {
      this.switchTick -= ms;
      if (this.switchTick <= 0) {
        this.services.audio.play('tick');
        this.switchTick = 400;
      }
      const blink = Math.floor(this.switchMs / 150) % 2 === 0;
      for (const d of this.dotted) this.layer.getTileAt(d.col, d.row)?.setAlpha(blink ? 0.55 : 1);
    }
    if (this.switchMs <= 0) {
      for (const d of this.dotted) this.layer.putTileAt(TILE_INDEX.dotOff, d.col, d.row);
      for (const s of this.switches) this.layer.putTileAt(TILE_INDEX.switch, s.col, s.row);
    }
  }

  private updateFlags(): void {
    const p = this.player;
    for (const f of this.flags) {
      if (f.on || p.x < f.x - 12) continue;
      f.on = true;
      f.image.setTexture('flag-on');
      this.checkpoint = { x: f.x, bottom: f.bottom };
      this.services.audio.play('checkpoint');
      this.addScore(POINTS.checkpoint);
      this.sparkle(f.x + 14, f.bottom - 120, 6);
    }
  }

  private updateTips(): void {
    const next = this.tips[0];
    if (!next || this.player.x < next.col * T) return;
    this.tips.shift();
    this.mode = 'tip';
    this.freeze(true);
    this.services.bridge.send({ type: 'tip', id: next.id });
  }

  private checkGoal(): void {
    if (!this.goalX || this.player.x < this.goalX - 8) return;
    const body = this.pbody();
    if (!(body.blocked.down || body.touching.down)) return;
    this.finish();
  }

  // ---------------------------------------------------------------- tools and shells

  private throwWrench(): void {
    if (this.form !== 'tool' || this.shotCooldownMs > 0 || this.shots.countActive(true) >= 2 || this.carrying) return;
    const p = this.player;
    const w = this.shots.create(p.x + this.facing * 20, p.y - 46, 'wrench') as Sprite;
    w.setDepth(4);
    const body = w.body as Body;
    body.setSize(22, 14);
    body.setVelocity(this.facing * 470 + this.pbody().velocity.x * 0.3, -430);
    body.setAngularVelocity(this.facing * 900);
    this.shotCooldownMs = 280;
    this.throwPoseMs = 160;
    this.services.audio.play('throw');
    this.time.delayedCall(1600, () => this.popShot(w));
  }

  private popShot(shot: GameObject): void {
    if (!shot.active) return;
    const s = shot as Sprite;
    this.sparkle(s.x, s.y, 2);
    s.destroy();
  }

  private nearShell(): Enemy | null {
    const p = this.pbody();
    let best: Enemy | null = null;
    let bestD = 72;
    for (const e of this.enemies) {
      if (e.state !== 'shell') continue;
      const d = Math.hypot(e.sprite.x - p.center.x, e.sprite.y - p.bottom);
      if (d < bestD) {
        best = e;
        bestD = d;
      }
    }
    return best;
  }

  private updateGrab(pressed: boolean): void {
    const near = this.carrying ? null : this.nearShell();
    this.services.controls.setContext({
      shootEnabled: this.form === 'tool',
      grab: this.carrying ? 'kick' : near && !this.onVine ? 'grab' : 'hidden',
    });
    if (!pressed) return;
    if (this.carrying) this.kickCarried();
    else if (near && !this.onVine) {
      near.state = 'carried';
      const body = near.sprite.body as Body;
      body.setAllowGravity(false);
      body.checkCollision.none = true;
      body.setVelocity(0, 0);
      near.sprite.setDepth(3.5);
      this.carrying = near;
      this.services.audio.play('kick');
    }
  }

  private kickCarried(): void {
    const e = this.carrying;
    if (!e) return;
    this.carrying = null;
    const body = e.sprite.body as Body;
    body.checkCollision.none = false;
    body.setAllowGravity(true);
    e.sprite.setPosition(this.player.x + this.facing * 34, this.pbody().bottom - 2);
    this.kickShell(e, this.facing);
  }

  private dropCarried(): void {
    const e = this.carrying;
    if (!e) return;
    this.carrying = null;
    const body = e.sprite.body as Body;
    body.checkCollision.none = false;
    body.setAllowGravity(true);
    e.state = 'shell';
    e.timer = 0;
  }

  private kickShell(e: Enemy, dir: number): void {
    e.state = 'shellMoving';
    e.dir = dir < 0 ? -1 : 1;
    e.chain = 0;
    e.kickGraceMs = 220;
    e.sprite.setDepth(2);
    (e.sprite.body as Body).setVelocityX(e.dir * SHELL_SPEED);
    this.services.audio.play('kick');
  }

  /** A carried shell knocks out whatever it touches, and breaks. */
  private carriedHits(): void {
    const e = this.carrying;
    if (!e) return;
    const a = e.sprite.getBounds();
    for (const other of this.enemies) {
      if (other === e || other.state === 'dead' || !other.awake) continue;
      if (Phaser.Geom.Intersects.RectangleToRectangle(a, other.sprite.getBounds())) {
        this.carrying = null;
        this.killEnemy(other, POINTS.shellKill);
        this.killEnemy(e, 0);
        return;
      }
    }
    const boss = this.boss;
    if (boss && boss.state !== 'dead' && boss.state !== 'wait' && Phaser.Geom.Intersects.RectangleToRectangle(a, boss.sprite.getBounds())) {
      this.carrying = null;
      this.hitBoss();
      this.killEnemy(e, 0);
    }
  }

  // ---------------------------------------------------------------- enemies

  private updateEnemies(dt: number): void {
    const ms = dt * 1000;
    const cam = this.cameras.main;
    const wakeX = cam.scrollX + cam.width + T * 2;
    for (const e of [...this.enemies]) {
      const s = e.sprite;
      if (!s.active) continue;
      const body = s.body as Body;
      if (!e.awake) {
        if (s.x > wakeX || s.x < cam.scrollX - T * 4) continue;
        e.awake = true;
        body.enable = true;
        if (this.player.x > s.x) e.dir = 1;
      }
      e.t += ms;
      e.kickGraceMs = Math.max(0, e.kickGraceMs - ms);
      if (s.y > ROWS * T + 200) {
        this.removeEnemy(e, true);
        continue;
      }
      switch (e.state) {
        case 'walk': {
          const speed = e.kind === 'slime' ? 60 : e.kind === 'poison' ? 80 : e.kind === 'spine' ? 55 : 70;
          if (body.blocked.left) e.dir = 1;
          else if (body.blocked.right) e.dir = -1;
          else if (e.kind !== 'poison' && body.blocked.down) {
            const aheadX = e.dir > 0 ? body.right + 2 : body.left - 2;
            const below = this.layer.getTileAtWorldXY(aheadX, body.bottom + 6);
            if (!below || !below.collides) e.dir = e.dir > 0 ? -1 : 1;
          }
          body.setVelocityX(e.dir * speed);
          const frame = Math.floor(e.t / 220) % 2 === 0 ? 1 : 2;
          s.setTexture(`${e.kind}-${frame}`);
          s.setFlipX(e.dir < 0);
          break;
        }
        case 'fly': {
          const t = e.t / 1000;
          s.setPosition(e.baseX + Math.sin(t * 0.8) * T * 2, e.baseY + Math.sin(t * 2.2) * T * 1.3);
          body.setVelocity(0, 0);
          s.setTexture(Math.floor(e.t / 160) % 2 === 0 ? 'flyer-1' : 'flyer-2');
          s.setFlipX(this.player.x < s.x);
          break;
        }
        case 'hang': {
          s.setFlipX(this.player.x > s.x);
          s.setAngle(Math.sin(e.t / 300) * 6);
          e.timer -= ms;
          const dx = this.player.x - s.x;
          if (Math.abs(dx) < T * 9 && e.timer <= 0) {
            e.timer = 2300;
            s.setTexture('monkey-2');
            this.time.delayedCall(260, () => {
              if (s.active && e.state === 'hang') s.setTexture('monkey-1');
            });
            this.throwHazard('banana', s.x, s.y - 20, Phaser.Math.Clamp(dx * 0.9, -320, 320), -340);
          }
          break;
        }
        case 'shell': {
          body.setVelocityX(0);
          e.timer += ms;
          const base = e.kind === 'spine' ? 'spine' : 'turtle';
          s.setTexture(`${base}-shell`);
          if (e.timer > SHELL_WAKE_MS - 1500) s.setX(s.x + Math.sin(e.t / 30) * 0.8);
          if (e.timer > SHELL_WAKE_MS) this.wakeShell(e);
          break;
        }
        case 'shellMoving': {
          if (body.blocked.left || body.blocked.right) {
            e.dir = body.blocked.left ? 1 : -1;
            if (this.onScreen(s.x)) this.services.audio.play('bump');
          }
          body.setVelocityX(e.dir * SHELL_SPEED);
          const base = e.kind === 'spine' ? 'spine' : 'turtle';
          s.setTexture(Math.floor(e.t / 60) % 2 === 0 ? `${base}-shell` : `${base}-shell2`);
          const boss = this.boss;
          if (boss && boss.state !== 'dead' && boss.state !== 'wait' && Phaser.Geom.Intersects.RectangleToRectangle(s.getBounds(), boss.sprite.getBounds())) {
            this.hitBoss();
            this.killEnemy(e, 0);
          }
          break;
        }
        default:
          break;
      }
    }
  }

  private onScreen(x: number): boolean {
    const cam = this.cameras.main;
    return x > cam.scrollX - T && x < cam.scrollX + cam.width + T;
  }

  private wakeShell(e: Enemy): void {
    e.state = 'walk';
    e.timer = 0;
    e.dir = this.player.x > e.sprite.x ? 1 : -1;
    e.sprite.setTexture(`${e.kind === 'spine' ? 'spine' : 'turtle'}-1`);
    this.sizeEnemy(e);
    (e.sprite.body as Body).setVelocityY(-200);
    this.defeated.delete(e.id);
  }

  private onPlayerEnemy(obj: GameObject): void {
    if (this.mode !== 'play') return;
    const e = this.enemyBySprite.get(obj);
    if (!e || e.state === 'dead' || e.state === 'carried') return;
    if (this.starMs > 0) {
      this.killEnemy(e, POINTS.starKill);
      return;
    }
    const pb = this.pbody();
    const eb = e.sprite.body as Body;
    const stomp = isStomp({ playerVy: pb.velocity.y, playerBottom: pb.bottom, enemyTop: eb.top, enemyHeight: eb.height });
    const bounce = () => {
      const held = this.services.controls.state.held.jump || this.services.controls.state.held.spin;
      pb.setVelocityY(-jumpLaunch(held ? 'normal' : 'stomp', 0));
      this.jumpCut = !held;
      this.jumpKind = held ? 'normal' : 'stomp';
    };
    if (e.state === 'shell') {
      if (stomp) bounce();
      this.kickShell(e, Math.sign(e.sprite.x - this.player.x) || this.facing);
      return;
    }
    if (e.state === 'shellMoving') {
      if (stomp) {
        bounce();
        e.state = 'shell';
        e.timer = 0;
        eb.setVelocityX(0);
        this.services.audio.play('stomp');
      } else if (e.kickGraceMs <= 0) this.hurtPlayer();
      return;
    }
    const stompable = e.kind === 'slime' || e.kind === 'turtle' || e.kind === 'flyer' || e.kind === 'monkey';
    if (stomp && stompable) {
      bounce();
      this.stomp(e);
    } else {
      this.hurtPlayer();
    }
  }

  private stomp(e: Enemy): void {
    this.services.audio.play('stomp');
    this.addScore(chainPoints(POINTS.stomp, this.stompChain));
    this.stompChain += 1;
    const body = e.sprite.body as Body;
    if (e.kind === 'slime') {
      e.state = 'dead';
      this.markDefeated(e);
      body.enable = false;
      e.sprite.setTexture('slime-flat');
      this.time.delayedCall(450, () => this.removeEnemy(e, false));
    } else if (e.kind === 'turtle') {
      e.state = 'shell';
      e.timer = 0;
      e.sprite.setTexture('turtle-shell');
      this.sizeEnemy(e);
      body.setVelocityX(0);
      this.markDefeated(e);
    } else if (e.kind === 'flyer') {
      // The wings come off: it drops down as a walking turtle.
      e.kind = 'turtle';
      e.state = 'walk';
      body.setAllowGravity(true);
      e.sprite.setTexture('turtle-1');
      this.sizeEnemy(e);
      this.sparkle(e.sprite.x, e.sprite.y - 30, 4);
    } else if (e.kind === 'monkey') {
      this.killEnemy(e, 0);
    }
  }

  private killEnemy(e: Enemy, points: number): void {
    if (e.state === 'dead') return;
    if (this.carrying === e) this.carrying = null;
    e.state = 'dead';
    this.markDefeated(e);
    if (points > 0) this.addScore(points);
    this.services.audio.play('kick');
    const body = e.sprite.body as Body;
    body.enable = true;
    body.checkCollision.none = true;
    body.setAllowGravity(true);
    body.setImmovable(false);
    body.setVelocity(Phaser.Math.Between(-90, 90), -460);
    e.sprite.setFlipY(true).setDepth(5);
  }

  private removeEnemy(e: Enemy, countAsDefeated: boolean): void {
    if (countAsDefeated) this.markDefeated(e);
    if (this.carrying === e) this.carrying = null;
    e.state = 'dead';
    this.enemyBySprite.delete(e.sprite);
    e.sprite.destroy();
    this.enemies = this.enemies.filter((x) => x !== e);
  }

  private onEnemyEnemy(a: GameObject, b: GameObject): void {
    const ea = this.enemyBySprite.get(a);
    const eb = this.enemyBySprite.get(b);
    if (!ea || !eb || ea === eb || ea.state === 'dead' || eb.state === 'dead') return;
    const movingA = ea.state === 'shellMoving';
    const movingB = eb.state === 'shellMoving';
    if (movingA && movingB) {
      this.killEnemy(ea, POINTS.shellKill);
      this.killEnemy(eb, POINTS.shellKill);
    } else if (movingA || movingB) {
      const shell = movingA ? ea : eb;
      const victim = movingA ? eb : ea;
      if (victim.state === 'carried') return;
      this.killEnemy(victim, chainPoints(POINTS.shellKill, shell.chain));
      shell.chain += 1;
    }
  }

  private onShotEnemy(shot: GameObject, obj: GameObject): void {
    const e = this.enemyBySprite.get(obj);
    if (!e || e.state === 'dead' || e.state === 'carried' || !shot.active) return;
    this.popShot(shot);
    this.killEnemy(e, POINTS.wrenchKill);
  }

  // ---------------------------------------------------------------- items

  private spawnItem(kind: ItemKind, col: number, row: number): void {
    const x = col * T + T / 2;
    const top = row * T;
    const { audio } = this.services;
    if (kind === 'coin') {
      audio.play('coin');
      this.coinCount += 1;
      this.addScore(POINTS.coin);
      const c = this.add.sprite(x, top - 10, 'coin-1').setDepth(5);
      c.play('coin-spin');
      this.tweens.add({ targets: c, y: top - 90, duration: 260, yoyo: true, onComplete: () => c.destroy() });
      return;
    }
    const tex = kind === 'tool' ? 'toolbox' : kind === 'star' ? 'star' : kind === 'heart' ? 'heart' : 'goldheart';
    // Rises out of the block from behind it, then comes alive.
    const item = this.items.create(x, top + T - 2, tex) as Sprite;
    item.setOrigin(0.5, 1).setDepth(-0.5);
    const body = item.body as Body;
    body.enable = false;
    this.itemKind.set(item, kind);
    audio.play('bump');
    this.tweens.add({
      targets: item,
      y: top,
      duration: 420,
      onComplete: () => {
        if (!item.active) return;
        body.enable = true;
        body.reset(item.x, item.y);
        item.setDepth(1);
        if (kind === 'goldheart') {
          body.setAllowGravity(false);
          this.tweens.add({ targets: item, y: item.y - 14, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        } else {
          const dir = this.player.x < x ? 1 : -1;
          body.setVelocityX(dir * (kind === 'star' ? 170 : kind === 'heart' ? 90 : 120));
          if (kind === 'star') body.setVelocityY(-500);
        }
      },
    });
  }

  private updateItems(): void {
    for (const obj of [...this.items.getChildren()]) {
      const item = obj as Sprite;
      const body = item.body as Body;
      if (!body.enable) continue;
      if (body.blocked.left) body.setVelocityX(Math.abs(body.velocity.x) || 110);
      else if (body.blocked.right) body.setVelocityX(-(Math.abs(body.velocity.x) || 110));
      if (this.itemKind.get(item) === 'star' && body.blocked.down) body.setVelocityY(-620);
      if (item.y > ROWS * T + 100) item.destroy();
    }
  }

  private collectItem(obj: GameObject): void {
    if (this.mode !== 'play') return;
    const item = obj as Sprite;
    if (!(item.body as Body).enable) return;
    const kind = this.itemKind.get(item);
    this.itemKind.delete(item);
    this.sparkle(item.x, item.y - 16, 5);
    this.tweens.killTweensOf(item);
    item.destroy();
    const { audio, bridge } = this.services;
    switch (kind) {
      case 'tool':
        audio.play('powerup');
        this.addScore(POINTS.powerUp);
        this.setForm('tool');
        break;
      case 'star':
        audio.play('powerup');
        this.addScore(POINTS.powerUp);
        this.starMs = STAR_MS;
        audio.playSong('star');
        break;
      case 'heart': {
        audio.play('heart');
        const r = collectHeart({ hearts: this.hearts, form: this.form });
        this.hearts = r.state.hearts;
        if (!r.added) this.addScore(POINTS.heartAtMax);
        break;
      }
      case 'goldheart':
        audio.play('heart');
        bridge.send({ type: 'extraLife' });
        break;
      default:
        break;
    }
  }

  private collectCoin(obj: GameObject): void {
    if (!obj.active || this.mode !== 'play') return;
    obj.destroy();
    this.coinCount += 1;
    this.addScore(POINTS.coin);
    this.services.audio.play('coin');
  }

  private sparkle(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i += 1) {
      const s = this.add.image(x, y, 'spark').setDepth(6);
      const a = (i / n) * Math.PI * 2;
      this.tweens.add({
        targets: s,
        x: x + Math.cos(a) * 34,
        y: y + Math.sin(a) * 34,
        alpha: 0,
        scale: 0.4,
        duration: 380,
        onComplete: () => s.destroy(),
      });
    }
  }

  // ---------------------------------------------------------------- hazards

  private throwHazard(kind: 'banana' | 'fire' | 'bone', x: number, y: number, vx: number, vy: number): void {
    const h = this.hazards.create(x, y, kind) as Sprite;
    h.setDepth(4);
    const body = h.body as Body;
    this.hazardKind.set(h, kind);
    if (kind === 'fire') {
      body.setAllowGravity(false);
      body.setSize(44, 20);
      h.setFlipX(vx > 0);
    } else {
      body.setSize(kind === 'banana' ? 22 : 30, 14);
      body.setAngularVelocity(vx > 0 ? 600 : -600);
    }
    body.setVelocity(vx, vy);
    this.time.delayedCall(kind === 'fire' ? 4500 : 3500, () => this.destroyHazard(h));
  }

  private destroyHazard(obj: GameObject): void {
    if (!obj.active) return;
    this.hazardKind.delete(obj);
    obj.destroy();
  }

  private onHazard(obj: GameObject): void {
    if (this.mode !== 'play' || this.invulnMs > 0) return;
    if (this.starMs > 0) {
      this.destroyHazard(obj);
      return;
    }
    if (this.hazardKind.get(obj) !== 'fire') this.destroyHazard(obj);
    this.hurtPlayer();
  }

  // ---------------------------------------------------------------- boss

  private spawnBoss(x: number, bottom: number): void {
    const sprite = this.physics.add.sprite(x, bottom, 'boss-idle');
    sprite.setOrigin(0.5, 1).setDepth(2);
    const body = sprite.body as Body;
    body.setSize(108, 112, false);
    body.setOffset(32, 34);
    body.pushable = false;
    this.physics.add.collider(sprite, this.layer);
    this.boss = { sprite, hp: BOSS_HP, state: 'wait', t: 0, facing: -1, invulnMs: 0, bonesLeft: 0, boneTimer: 0, cycle: 0 };
  }

  private lockArena(): void {
    if (!this.arena || this.arenaLocked) return;
    this.arenaLocked = true;
    this.cameras.main.setBounds(this.arena.left, 0, this.arena.right - this.arena.left, ROWS * T);
    const zone = this.add.zone(this.arena.left - 8, (ROWS * T) / 2, 16, ROWS * T * 2);
    this.physics.add.existing(zone, true);
    this.physics.add.collider(this.player, zone);
    this.arenaWall = zone;
    if (this.boss && this.boss.state === 'wait') {
      this.boss.state = 'idle';
      this.boss.t = 0;
    }
    if (this.starMs <= 0) this.services.audio.playSong('boss');
  }

  private unlockArena(): void {
    this.arenaLocked = false;
    this.arenaWall?.destroy();
    this.arenaWall = null;
    this.cameras.main.setBounds(0, 0, this.level.cols * T, ROWS * T);
    if (this.boss && this.boss.state !== 'dead') {
      this.boss.state = 'wait';
      this.boss.t = 0;
    }
  }

  private updateBoss(dt: number): void {
    const boss = this.boss;
    const arena = this.arena;
    if (!boss || !arena) return;
    if (!this.arenaLocked && boss.state !== 'dead' && this.player.x > arena.left + T * 2) this.lockArena();
    if (boss.state === 'dead' || boss.state === 'wait') return;
    const ms = dt * 1000;
    const s = boss.sprite;
    const body = s.body as Body;
    boss.t += ms;
    boss.invulnMs = Math.max(0, boss.invulnMs - ms);
    s.setAlpha(boss.invulnMs > 0 && Math.floor(boss.invulnMs / 60) % 2 === 0 ? 0.5 : 1);
    const onGround = body.blocked.down;
    const angry = boss.hp <= BOSS_HP / 2;

    // Contact hurts: the boss is covered in spikes. A star turns contact into a hit on the boss.
    const pb = this.pbody();
    if (pb.right > body.left + 8 && pb.left < body.right - 8 && pb.bottom > body.top + 8 && pb.top < body.bottom) {
      if (this.starMs > 0) this.hitBoss();
      else this.hurtPlayer();
      if (this.mode !== 'play') return;
    }

    switch (boss.state) {
      case 'idle': {
        body.setVelocityX(0);
        boss.facing = this.player.x < s.x ? -1 : 1;
        s.setFlipX(boss.facing > 0);
        s.setTexture('boss-idle');
        if (boss.t > (angry ? 650 : 1100)) {
          const order: BossState[] = ['hop', 'windup', 'bones', 'hop', 'windup', 'hop', 'bones'];
          boss.state = order[boss.cycle % order.length];
          boss.cycle += 1;
          boss.t = 0;
          if (boss.state === 'hop') s.setTexture('boss-crouch');
          else if (boss.state === 'bones') {
            boss.bonesLeft = angry ? 4 : 3;
            boss.boneTimer = 0;
          }
        }
        break;
      }
      case 'hop':
        if (boss.t > 220 && boss.t < 400 && onGround && body.velocity.y >= 0 && s.texture.key === 'boss-crouch') {
          const nearWall = boss.facing < 0 ? s.x - arena.left < T * 4 : arena.right - s.x < T * 4;
          const dir = nearWall ? -boss.facing : boss.facing;
          body.setVelocity(dir * (angry ? 300 : 230), -900);
          s.setTexture('boss-idle');
        } else if (boss.t > 500 && onGround) {
          body.setVelocityX(0);
          this.cameras.main.shake(160, 0.006);
          this.services.audio.play('stomp');
          boss.state = 'idle';
          boss.t = 0;
        }
        break;
      case 'windup':
        s.setTexture('boss-mouth');
        if (boss.t > (angry ? 380 : 560)) {
          this.throwHazard('fire', s.x + boss.facing * 70, body.bottom - 44, boss.facing * (angry ? 440 : 360), 0);
          this.services.audio.play('fire');
          boss.state = 'fire';
          boss.t = 0;
        }
        break;
      case 'fire':
        if (boss.t > 450) {
          boss.state = 'idle';
          boss.t = 0;
        }
        break;
      case 'bones':
        boss.boneTimer -= ms;
        if (boss.boneTimer <= 0 && boss.bonesLeft > 0) {
          boss.bonesLeft -= 1;
          boss.boneTimer = angry ? 280 : 360;
          const dx = this.player.x - s.x;
          const vx = Phaser.Math.Clamp(dx * 0.85 + Phaser.Math.Between(-90, 90), -460, 460);
          this.throwHazard('bone', s.x, body.top + 10, vx, -680 - Phaser.Math.Between(0, 120));
          this.services.audio.play('throw');
        }
        if (boss.bonesLeft <= 0 && boss.boneTimer <= 0) {
          boss.state = 'idle';
          boss.t = 0;
        }
        break;
      default:
        break;
    }

    for (const obj of [...this.shots.getChildren()]) {
      const w = obj as Sprite;
      if (w.active && Phaser.Geom.Intersects.RectangleToRectangle(w.getBounds(), s.getBounds())) {
        this.popShot(w);
        this.hitBoss();
      }
    }

    // Arena support: the tool box refills, and a turtle drops in when no shell is around.
    this.arenaTimer += ms;
    if (this.arenaTimer > 9000) {
      this.arenaTimer = 0;
      const tb = this.arenaToolBlock;
      if (tb && this.form === 'small') {
        const tile = this.layer.getTileAt(tb.col, tb.row);
        if (tile && tile.index === TILE_INDEX.used) {
          this.layer.putTileAt(TILE_INDEX.item, tb.col, tb.row);
          this.contents.set(key(tb.col, tb.row), 'tool');
        }
      }
      const shells = this.enemies.filter((e) => e.state !== 'dead' && (e.kind === 'turtle' || e.kind === 'spine')).length;
      if (shells === 0) {
        const x = this.player.x < (arena.left + arena.right) / 2 ? arena.right - T * 6 : arena.left + T * 6;
        const e = this.spawnEnemy('turtle', x, T * 3, 2, false);
        e.awake = true;
        (e.sprite.body as Body).enable = true;
      }
    }
  }

  private hitBoss(): void {
    const boss = this.boss;
    if (!boss || boss.state === 'dead' || boss.state === 'wait' || boss.invulnMs > 0) return;
    boss.hp -= 1;
    boss.invulnMs = 700;
    this.addScore(POINTS.bossHit);
    this.services.audio.play('bossHit');
    this.cameras.main.shake(120, 0.005);
    this.sendHud(true);
    if (boss.hp <= 0) this.defeatBoss();
  }

  private defeatBoss(): void {
    const boss = this.boss;
    if (!boss) return;
    boss.state = 'dead';
    const s = boss.sprite;
    (s.body as Body).enable = false;
    this.defeated.add(BOSS_ID);
    this.addScore(POINTS.bossDefeat);
    this.hazards.clear(true, true);
    this.hazardKind.clear();
    this.tweens.add({
      targets: s,
      x: s.x + 6,
      duration: 50,
      yoyo: true,
      repeat: 10,
      onComplete: () => {
        this.services.audio.play('break');
        this.sparkle(s.x, s.y - 70, 12);
        for (let i = 0; i < 30; i += 1) {
          const c = this.bonusCoins.create(s.x + Phaser.Math.Between(-40, 40), s.y - 80, 'coin-1') as Sprite;
          c.play('coin-spin');
          c.setDepth(5);
          const b = c.body as Body;
          b.setSize(24, 24);
          b.setBounce(0.55, 0.55);
          b.setVelocity(Phaser.Math.Between(-320, 320), Phaser.Math.Between(-900, -400));
          this.time.delayedCall(12000, () => c.destroy());
        }
        s.destroy();
        const { rows, cols } = this.level;
        for (let r = 0; r < ROWS; r += 1) {
          for (let c = 0; c < cols; c += 1) {
            if (rows[r][c] !== 'W') continue;
            this.layer.removeTileAt(c, r);
            if (r % 3 === 0) this.sparkle(c * T + T / 2, r * T + T / 2, 3);
          }
        }
        this.unlockArena();
        this.services.audio.playSong('hill');
        this.sendHud(true);
      },
    });
  }

  // ---------------------------------------------------------------- damage, death, finish

  private hurtPlayer(): void {
    if (this.mode !== 'play' || this.invulnMs > 0 || this.starMs > 0) return;
    this.dropCarried();
    const r = applyHit({ hearts: this.hearts, form: this.form });
    this.hearts = r.state.hearts;
    this.setForm(r.state.form);
    if (r.dead) {
      this.die('hearts');
      return;
    }
    this.invulnMs = INVULN_MS;
    this.services.audio.play('hurt');
    this.pbody().setVelocity(-this.facing * 160, -380);
    this.sendHud(true);
  }

  private die(reason: 'hearts' | 'pit'): void {
    if (this.mode !== 'play') return;
    this.mode = 'dying';
    this.dropCarried();
    const { audio, controls, bridge } = this.services;
    audio.stopSong();
    audio.play('death');
    controls.setVisible(false);
    this.physics.world.pause();
    this.glow.setVisible(false);
    this.player.clearTint().setAlpha(1);
    this.sendHud(true);
    const done = () => {
      this.mode = 'waiting';
      bridge.send({ type: 'died', reason });
    };
    if (reason === 'pit') {
      this.time.delayedCall(900, done);
      return;
    }
    this.player.setTexture(`hero-${this.form === 'tool' ? 't' : 's'}-shock`);
    this.cameras.main.stopFollow();
    this.fallOffScreen(450, done);
  }

  private fallOffScreen(delay: number, done: () => void): void {
    const p = this.player;
    this.tweens.add({
      targets: p,
      y: p.y - 110,
      delay,
      duration: 360,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.tweens.add({ targets: p, y: ROWS * T + 160, duration: 900, ease: 'Quad.easeIn', onComplete: done });
      },
    });
  }

  /** Time out: freeze in a shocked pose, drop off-screen, then Mission Failed (no Another chance). */
  private timeUp(): void {
    this.mode = 'timeup';
    this.dropCarried();
    const { audio, controls, bridge } = this.services;
    audio.stopSong();
    audio.play('timeUp');
    controls.setVisible(false);
    this.physics.world.pause();
    this.glow.setVisible(false);
    this.player.clearTint().setAlpha(1).setTexture(`hero-${this.form === 'tool' ? 't' : 's'}-shock`);
    this.cameras.main.stopFollow();
    this.sendHud(true);
    bridge.send({ type: 'timeUp' });
    this.fallOffScreen(1000, () => {
      this.mode = 'waiting';
      bridge.send({ type: 'died', reason: 'time' });
    });
  }

  private finish(): void {
    this.mode = 'finished';
    const { audio, controls, bridge } = this.services;
    this.dropCarried();
    audio.stopSong();
    audio.play('clear');
    controls.setVisible(false);
    const body = this.pbody();
    body.setVelocity(0, 0);
    body.setAllowGravity(false);
    this.glow.setVisible(false);
    this.player.clearTint().setTexture(`hero-${this.form === 'tool' ? 't' : 's'}-idle`);
    this.addScore(timeBonus(displaySeconds(this.timer)));
    this.sendHud(true);
    this.tweens.add({ targets: this.player, x: this.goalX, alpha: 0, duration: 700, delay: 200 });
    const total = this.level.enemies.length;
    this.time.delayedCall(1500, () => {
      bridge.send({
        type: 'levelComplete',
        summary: {
          level: this.def.id,
          coins: this.coinCount,
          score: this.score,
          timeSeconds: Math.round(elapsedSeconds(this.timer)),
          enemiesDefeated: Math.min(total, this.defeated.size),
          enemiesTotal: total,
        },
      });
    });
  }

  private addScore(points: number): void {
    this.score += points;
  }

  private sendHud(force: boolean): void {
    const now = this.time.now;
    if (!force && now - this.hudAt < 100) return;
    const startX = this.startPoint.x;
    const span = Math.max(1, this.goalX - startX);
    const boss = this.boss;
    const hud: HudState = {
      hearts: this.hearts,
      coins: this.coinCount,
      score: this.score,
      time: displaySeconds(this.timer),
      hurry: isHurry(this.timer),
      progress: Math.round(Phaser.Math.Clamp((this.player.x - startX) / span, 0, 1) * 100) / 100,
      form: this.form,
      star: this.starMs > 0,
      boss: boss && this.arenaLocked && boss.state !== 'dead' ? { hp: boss.hp, max: BOSS_HP } : null,
    };
    const k = JSON.stringify(hud);
    if (k === this.hudKey) return;
    this.hudKey = k;
    this.hudAt = now;
    this.services.bridge.send({ type: 'hud', hud });
  }
}
