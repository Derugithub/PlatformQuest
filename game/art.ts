/**
 * Every sprite is drawn here with Phaser Graphics and baked into textures at boot, so the game ships
 * no image files and all art is original. Style: bright, saturated, rounded cartoon shapes.
 */

import Phaser from 'phaser';

import { TILE } from '../src/core/physics';

export const C = {
  outline: 0x2a1e3b,
  skin: 0xffd2a6,
  cheek: 0xff9e9e,
  cap: 0x14b8a6,
  capDark: 0x0f8f82,
  capBadge: 0xffe066,
  hoodie: 0xff8a3d,
  hoodieDark: 0xe0662a,
  shorts: 0x2b3a67,
  shoe: 0x5a3a22,
  overalls: 0xf5f7fa,
  overallsShade: 0xd5dbe5,
  belt: 0x7a4a24,
  buckle: 0xffd84d,
  grass: 0x5bd35b,
  grassDark: 0x2f9e44,
  dirt: 0xc8813f,
  dirtDark: 0xa6652c,
  dirtDot: 0xe0a060,
  brick: 0xe0703a,
  brickDark: 0xb04f22,
  mortar: 0xf4c8a0,
  item: 0xffc93c,
  itemDark: 0xe09a12,
  used: 0xa47148,
  usedDark: 0x7d5232,
  stone: 0x9aa5b8,
  stoneDark: 0x6b778c,
  switchBlue: 0x3b82f6,
  switchDark: 0x1d4ed8,
  white: 0xffffff,
  coin: 0xffd23f,
  coinDark: 0xe6a800,
  red: 0xef4444,
  redDark: 0xb91c1c,
  vine: 0x22c55e,
  vineDark: 0x15803d,
  wood: 0xb7793f,
  woodDark: 0x8a5626,
} as const;

type G = Phaser.GameObjects.Graphics;

function outlined(g: G, color: number, draw: () => void, width = 3): void {
  g.lineStyle(width, C.outline, 1);
  g.fillStyle(color, 1);
  draw();
}

/** Tile frames, in this order, baked into one strip texture for the tilemap. */
export const TILE_FRAMES = [
  'grass',
  'dirt',
  'hard',
  'brick',
  'item',
  'used',
  'tire',
  'switch',
  'dotOff',
  'dotOn',
  'gate',
  'switchUsed',
] as const;
export type TileFrame = (typeof TILE_FRAMES)[number];
export const TILE_INDEX: Record<TileFrame, number> = Object.fromEntries(TILE_FRAMES.map((n, i) => [n, i])) as Record<TileFrame, number>;

function drawTile(g: G, name: TileFrame, x: number, y: number): void {
  const T = TILE;
  switch (name) {
    case 'grass': {
      g.fillStyle(C.dirt).fillRect(x, y, T, T);
      g.fillStyle(C.dirtDot).fillCircle(x + 12, y + 30, 3).fillCircle(x + 34, y + 38, 2.5).fillCircle(x + 26, y + 24, 2);
      g.fillStyle(C.grass).fillRect(x, y, T, 15);
      g.fillStyle(C.grass);
      for (let i = 0; i < 4; i += 1) g.fillCircle(x + 6 + i * 12, y + 15, 6);
      g.fillStyle(0x86ef86).fillRect(x, y, T, 4);
      g.lineStyle(2, C.grassDark).lineBetween(x, y + 1, x + T, y + 1);
      break;
    }
    case 'dirt':
      g.fillStyle(C.dirt).fillRect(x, y, T, T);
      g.fillStyle(C.dirtDot).fillCircle(x + 10, y + 12, 3).fillCircle(x + 32, y + 22, 2.5).fillCircle(x + 20, y + 38, 3);
      g.fillStyle(C.dirtDark).fillCircle(x + 38, y + 40, 2).fillCircle(x + 14, y + 28, 1.5);
      break;
    case 'hard':
      g.fillStyle(C.stoneDark).fillRoundedRect(x + 1, y + 1, T - 2, T - 2, 6);
      g.fillStyle(C.stone).fillRoundedRect(x + 3, y + 3, T - 6, T - 9, 5);
      g.fillStyle(0xc4ccda).fillRoundedRect(x + 7, y + 6, 14, 6, 3);
      break;
    case 'brick':
      g.fillStyle(C.mortar).fillRect(x, y, T, T);
      g.fillStyle(C.brick);
      [
        [1, 1, 22, 14], [25, 1, 22, 14],
        [1, 17, 10, 14], [13, 17, 22, 14], [37, 17, 10, 14],
        [1, 33, 22, 14], [25, 33, 22, 14],
      ].forEach(([bx, by, bw, bh]) => g.fillRoundedRect(x + bx, y + by, bw, bh, 2));
      g.fillStyle(C.brickDark);
      [[1, 12], [25, 12], [13, 28], [1, 44], [25, 44]].forEach(([bx, by]) => g.fillRect(x + bx, y + by, 22, 3));
      break;
    case 'item': {
      g.fillStyle(C.itemDark).fillRoundedRect(x + 1, y + 1, T - 2, T - 2, 7);
      g.fillStyle(C.item).fillRoundedRect(x + 3, y + 3, T - 6, T - 8, 6);
      // A sparkle gem, not a question mark.
      g.fillStyle(C.white);
      g.fillTriangle(x + 24, y + 9, x + 31, y + 22, x + 17, y + 22);
      g.fillTriangle(x + 17, y + 22, x + 31, y + 22, x + 24, y + 37);
      g.fillStyle(0xfff3b0).fillTriangle(x + 24, y + 13, x + 28, y + 22, x + 20, y + 22);
      g.fillStyle(C.itemDark).fillCircle(x + 8, y + 8, 2).fillCircle(x + 40, y + 8, 2).fillCircle(x + 8, y + 38, 2).fillCircle(x + 40, y + 38, 2);
      break;
    }
    case 'used':
      g.fillStyle(C.usedDark).fillRoundedRect(x + 1, y + 1, T - 2, T - 2, 7);
      g.fillStyle(C.used).fillRoundedRect(x + 3, y + 3, T - 6, T - 8, 6);
      g.fillStyle(C.usedDark).fillCircle(x + 8, y + 8, 2).fillCircle(x + 40, y + 8, 2).fillCircle(x + 8, y + 38, 2).fillCircle(x + 40, y + 38, 2);
      break;
    case 'tire':
      g.fillStyle(0x1f2937).fillRoundedRect(x + 1, y + 6, T - 2, T - 8, 14);
      g.fillStyle(0x374151).fillRoundedRect(x + 5, y + 10, T - 10, 10, 5);
      g.fillStyle(0x9ca3af).fillCircle(x + 24, y + 30, 8);
      g.fillStyle(0x4b5563).fillCircle(x + 24, y + 30, 4);
      g.lineStyle(2, 0x111827);
      for (let i = 0; i < 5; i += 1) g.lineBetween(x + 6 + i * 9, y + 8, x + 9 + i * 9, y + 16);
      break;
    case 'switch':
    case 'switchUsed': {
      const pressed = name === 'switchUsed';
      g.fillStyle(C.switchDark).fillRoundedRect(x + 1, y + 1, T - 2, T - 2, 7);
      g.fillStyle(pressed ? 0x60a5fa : C.switchBlue).fillRoundedRect(x + 3, y + 3, T - 6, T - 8, 6);
      g.fillStyle(C.white).fillRoundedRect(x + 20, y + 9, 8, 19, 3).fillCircle(x + 24, y + 35, 4.5);
      break;
    }
    case 'dotOff':
      g.lineStyle(3, C.switchBlue, 0.9);
      for (let i = 0; i < 4; i += 1) {
        const a = 4 + i * 11;
        g.lineBetween(x + a, y + 3, x + a + 6, y + 3);
        g.lineBetween(x + a, y + T - 3, x + a + 6, y + T - 3);
        g.lineBetween(x + 3, y + a, x + 3, y + a + 6);
        g.lineBetween(x + T - 3, y + a, x + T - 3, y + a + 6);
      }
      break;
    case 'dotOn':
      g.fillStyle(C.switchDark).fillRoundedRect(x + 1, y + 1, T - 2, T - 2, 6);
      g.fillStyle(0x60a5fa).fillRoundedRect(x + 3, y + 3, T - 6, T - 8, 5);
      g.fillStyle(0xbfdbfe).fillRoundedRect(x + 7, y + 7, 12, 5, 2);
      break;
    case 'gate':
      g.fillStyle(0x3f2a3a).fillRect(x, y, T, T);
      g.fillStyle(0x5b3b52).fillRoundedRect(x + 3, y + 3, T - 6, T - 6, 4);
      g.fillStyle(0xf97316).fillCircle(x + 24, y + 24, 5);
      g.lineStyle(2, 0xf97316).strokeCircle(x + 24, y + 24, 11);
      break;
  }
}

type Pose = 'idle' | 'walk1' | 'walk2' | 'jump' | 'fall' | 'duck' | 'cling' | 'shock' | 'climb1' | 'climb2' | 'skid' | 'throw';
export const HERO_POSES: readonly Pose[] = ['idle', 'walk1', 'walk2', 'jump', 'fall', 'duck', 'cling', 'shock', 'climb1', 'climb2', 'skid', 'throw'];

/** Draws the hero facing right. `big` is the tool-suit form (48x80 frame); small is 48x48. */
function drawHero(g: G, pose: Pose, big: boolean): void {
  const W = 48;
  const H = big ? 80 : 48;
  const s = big ? 1.35 : 1;
  const cx = W / 2;
  const duck = pose === 'duck';
  const feetY = H - 3;
  const legH = (big ? 16 : 9) * (duck ? 0.4 : 1);
  const bodyH = (big ? 26 : 14) * (duck ? 0.75 : 1);
  const headR = big ? 12 : 11;
  const bodyTop = feetY - legH - bodyH;
  const headY = bodyTop - headR + (big ? 4 : 5);
  const stride = pose === 'walk1' ? 5 : pose === 'walk2' ? -5 : pose === 'jump' ? 6 : pose === 'skid' ? -6 : 0;

  // Legs and shoes
  const legColor = big ? C.overalls : C.shorts;
  outlined(g, legColor, () => {
    g.fillRoundedRect(cx - 9 * s + stride * 0.5, feetY - legH - 2, 8 * s, legH + 2, 3);
    g.strokeRoundedRect(cx - 9 * s + stride * 0.5, feetY - legH - 2, 8 * s, legH + 2, 3);
    g.fillRoundedRect(cx + 1 - stride * 0.5, feetY - legH - 2, 8 * s, legH + 2, 3);
    g.strokeRoundedRect(cx + 1 - stride * 0.5, feetY - legH - 2, 8 * s, legH + 2, 3);
  }, 2);
  outlined(g, C.shoe, () => {
    g.fillEllipse(cx - 6 * s + stride * 0.6, feetY - 2, 13 * s, 7);
    g.strokeEllipse(cx - 6 * s + stride * 0.6, feetY - 2, 13 * s, 7);
    g.fillEllipse(cx + 7 * s - stride * 0.6, feetY - 2, 13 * s, 7);
    g.strokeEllipse(cx + 7 * s - stride * 0.6, feetY - 2, 13 * s, 7);
  }, 2);

  // Body
  const bodyW = big ? 30 : 22;
  outlined(g, C.hoodie, () => {
    g.fillRoundedRect(cx - bodyW / 2, bodyTop, bodyW, bodyH + 3, 8);
    g.strokeRoundedRect(cx - bodyW / 2, bodyTop, bodyW, bodyH + 3, 8);
  }, 2.5);
  if (big) {
    // White overalls with a tool belt.
    g.fillStyle(C.overalls).fillRoundedRect(cx - 12, bodyTop + 9, 24, bodyH - 6, 5);
    g.fillStyle(C.overallsShade).fillRect(cx - 12, bodyTop + bodyH - 6, 24, 3);
    g.fillStyle(C.overalls).fillRect(cx - 10, bodyTop + 1, 4, 10).fillRect(cx + 6, bodyTop + 1, 4, 10);
    g.fillStyle(C.belt).fillRect(cx - 15, bodyTop + bodyH - 2, 30, 5);
    g.fillStyle(C.buckle).fillRect(cx - 3, bodyTop + bodyH - 2, 6, 5);
    g.fillStyle(0x94a3b8).fillRect(cx + 9, bodyTop + bodyH + 2, 3, 8);
  } else {
    g.fillStyle(C.hoodieDark).fillRect(cx - bodyW / 2 + 3, bodyTop + bodyH - 2, bodyW - 6, 3);
    g.fillStyle(C.white).fillCircle(cx + 3, bodyTop + 6, 1.6).fillCircle(cx - 3, bodyTop + 6, 1.6);
  }

  // Arms
  const armY = bodyTop + 5;
  const handColor = C.skin;
  const arm = (x1: number, y1: number, x2: number, y2: number) => {
    g.lineStyle(big ? 7 : 5, C.outline).lineBetween(x1, y1, x2, y2);
    g.lineStyle(big ? 4.5 : 3, C.hoodie).lineBetween(x1, y1, x2, y2);
    g.fillStyle(handColor).fillCircle(x2, y2, big ? 4 : 3.2);
    g.lineStyle(1.5, C.outline).strokeCircle(x2, y2, big ? 4 : 3.2);
  };
  if (pose === 'jump' || pose === 'shock' || pose === 'climb1') {
    arm(cx + bodyW / 2 - 2, armY, cx + bodyW / 2 + 5, armY - 12 * s);
    arm(cx - bodyW / 2 + 2, armY, cx - bodyW / 2 - 5, pose === 'shock' ? armY - 12 * s : armY + 6);
  } else if (pose === 'climb2') {
    arm(cx - bodyW / 2 + 2, armY, cx - bodyW / 2 - 4, armY - 12 * s);
    arm(cx + bodyW / 2 - 2, armY, cx + bodyW / 2 + 4, armY + 6);
  } else if (pose === 'cling') {
    arm(cx - bodyW / 2 + 2, armY, cx - bodyW / 2 - 8, armY - 6);
    arm(cx - bodyW / 2 + 2, armY + 6, cx - bodyW / 2 - 8, armY + 8);
  } else if (pose === 'throw') {
    arm(cx + bodyW / 2 - 2, armY, cx + bodyW / 2 + 10, armY - 2);
    arm(cx - bodyW / 2 + 2, armY, cx - bodyW / 2 - 4, armY + 8);
  } else {
    const swing = pose === 'walk1' ? 4 : pose === 'walk2' ? -4 : 0;
    arm(cx + bodyW / 2 - 2, armY, cx + bodyW / 2 + 2 + swing, armY + 9 * s);
    arm(cx - bodyW / 2 + 2, armY, cx - bodyW / 2 - 2 - swing, armY + 9 * s);
  }

  // Head
  outlined(g, C.skin, () => {
    g.fillCircle(cx + 1, headY, headR);
    g.strokeCircle(cx + 1, headY, headR);
  }, 2.5);
  g.fillStyle(C.cheek, 0.8).fillCircle(cx + 7, headY + 5, 2.6);
  // Eyes
  const eyeY = headY + 1;
  const wide = pose === 'shock';
  g.fillStyle(C.white).fillEllipse(cx + 3, eyeY, wide ? 7 : 6, wide ? 9 : 8).fillEllipse(cx + 9, eyeY, wide ? 7 : 6, wide ? 9 : 8);
  g.fillStyle(C.outline).fillCircle(cx + 4.5, eyeY + 1, wide ? 1.6 : 2).fillCircle(cx + 10.5, eyeY + 1, wide ? 1.6 : 2);
  if (wide) g.fillStyle(C.outline).fillEllipse(cx + 7, headY + 8, 4, 5);
  else g.lineStyle(1.6, C.outline).beginPath().arc(cx + 7, headY + 5, 3, 0.2, Math.PI - 0.2).strokePath();
  // Cap: dome plus a forward brim and a yellow leaf badge.
  outlined(g, C.cap, () => {
    g.beginPath();
    g.arc(cx + 1, headY - 2, headR + 1, Math.PI, 0, false);
    g.closePath();
    g.fillPath();
    g.strokePath();
  }, 2.5);
  g.fillStyle(C.capDark).fillRoundedRect(cx + 4, headY - 4, headR + 6, 5, 2.5);
  g.lineStyle(1.5, C.outline).strokeRoundedRect(cx + 4, headY - 4, headR + 6, 5, 2.5);
  g.fillStyle(C.capBadge).fillEllipse(cx - 1, headY - 8, 7, 5);
  g.lineStyle(1, C.outline).lineBetween(cx - 4, headY - 8, cx + 2, headY - 8);
}

function drawSlime(g: G, squash: number): void {
  const w = 40 + squash * 6;
  const h = 30 - squash * 6;
  outlined(g, 0x34d399, () => {
    g.fillEllipse(24, 40 - h / 2, w, h);
    g.strokeEllipse(24, 40 - h / 2, w, h);
  });
  g.fillStyle(0x10b981).fillEllipse(24, 38, w - 8, 6);
  g.fillStyle(0xa7f3d0).fillEllipse(15, 40 - h + 8, 9, 5);
  g.fillStyle(C.white).fillEllipse(18, 40 - h / 2 - 2, 8, 10).fillEllipse(30, 40 - h / 2 - 2, 8, 10);
  g.fillStyle(C.outline).fillCircle(19, 40 - h / 2, 2.4).fillCircle(31, 40 - h / 2, 2.4);
}

function drawShell(g: G, color: number, dark: number, spikes: boolean, ox: number, oy: number, shine: number): void {
  outlined(g, color, () => {
    g.beginPath();
    g.arc(ox + 22, oy + 26, 20, Math.PI, 0, false);
    g.lineTo(ox + 42, oy + 30);
    g.lineTo(ox + 2, oy + 30);
    g.closePath();
    g.fillPath();
    g.strokePath();
  });
  g.fillStyle(0xfef3c7).fillRect(ox + 3, oy + 27, 38, 5);
  g.lineStyle(2, C.outline).strokeRect(ox + 3, oy + 27, 38, 5);
  g.lineStyle(2, dark);
  g.strokeCircle(ox + 22, oy + 17, 6);
  g.lineBetween(ox + 10, oy + 22, ox + 16, oy + 19);
  g.lineBetween(ox + 34, oy + 22, ox + 28, oy + 19);
  g.fillStyle(C.white, 0.7).fillEllipse(ox + 14 + shine, oy + 12, 7, 4);
  if (spikes) {
    g.fillStyle(C.white);
    g.lineStyle(1.5, C.outline);
    [[8, 14], [16, 7], [28, 7], [36, 14], [22, 4]].forEach(([sx, sy]) => {
      g.fillTriangle(ox + sx - 4, oy + sy + 4, ox + sx + 4, oy + sy + 4, ox + sx, oy + sy - 7);
      g.strokeTriangle(ox + sx - 4, oy + sy + 4, ox + sx + 4, oy + sy + 4, ox + sx, oy + sy - 7);
    });
  }
}

function drawTurtle(g: G, step: number, shell: number, shellDark: number, skin: number, spikes: boolean, wings: number): void {
  // 48x56 frame, facing right.
  if (wings > 0) {
    outlined(g, C.white, () => {
      const wy = 18 + (wings === 1 ? -8 : 2);
      g.fillEllipse(10, wy, 22, 12);
      g.strokeEllipse(10, wy, 22, 12);
      g.fillEllipse(14, wy + 6, 18, 9);
      g.strokeEllipse(14, wy + 6, 18, 9);
    }, 2);
  }
  outlined(g, skin, () => {
    g.fillEllipse(14 + step, 52, 10, 7);
    g.strokeEllipse(14 + step, 52, 10, 7);
    g.fillEllipse(32 - step, 52, 10, 7);
    g.strokeEllipse(32 - step, 52, 10, 7);
    g.fillCircle(38, 22, 9);
    g.strokeCircle(38, 22, 9);
  }, 2);
  g.fillStyle(C.white).fillEllipse(40, 20, 6, 8);
  g.fillStyle(C.outline).fillCircle(41.5, 21, 2);
  drawShell(g, shell, shellDark, spikes, 0, 18, 0);
}

function drawPoison(g: G, step: number): void {
  outlined(g, 0xfef3c7, () => {
    g.fillRoundedRect(14, 22, 20, 18, 6);
    g.strokeRoundedRect(14, 22, 20, 18, 6);
  }, 2);
  g.fillStyle(C.outline).fillEllipse(16 + step, 42, 10, 5).fillEllipse(32 - step, 42, 10, 5);
  outlined(g, 0xa21caf, () => {
    g.beginPath();
    g.arc(24, 24, 20, Math.PI, 0, false);
    g.closePath();
    g.fillPath();
    g.strokePath();
  });
  g.fillStyle(0xbef264).fillCircle(14, 15, 4).fillCircle(26, 9, 4.5).fillCircle(35, 18, 3.5);
  // Angry eyes
  g.fillStyle(C.outline).fillCircle(20, 30, 2.2).fillCircle(28, 30, 2.2);
  g.lineStyle(2, C.outline).lineBetween(16, 25, 22, 27).lineBetween(32, 25, 26, 27);
}

function drawMonkey(g: G, throwing: boolean): void {
  // 56x64; hangs from the top edge by one arm.
  g.lineStyle(7, C.outline).lineBetween(28, 0, 26, 20);
  g.lineStyle(4.5, 0x92400e).lineBetween(28, 0, 26, 20);
  outlined(g, 0x92400e, () => {
    g.fillEllipse(28, 42, 26, 26);
    g.strokeEllipse(28, 42, 26, 26);
    g.fillCircle(28, 24, 12);
    g.strokeCircle(28, 24, 12);
    g.fillCircle(15, 22, 5);
    g.strokeCircle(15, 22, 5);
    g.fillCircle(41, 22, 5);
    g.strokeCircle(41, 22, 5);
  }, 2);
  g.fillStyle(0xfcd9a8).fillEllipse(28, 27, 16, 12).fillEllipse(28, 44, 14, 14);
  g.fillStyle(C.outline).fillCircle(24, 24, 2).fillCircle(32, 24, 2);
  g.lineStyle(1.5, C.outline).beginPath().arc(28, 29, 3, 0.3, Math.PI - 0.3).strokePath();
  // Tail
  g.lineStyle(3, 0x92400e).beginPath().arc(42, 54, 7, Math.PI * 0.5, Math.PI * 1.8).strokePath();
  if (throwing) {
    g.lineStyle(7, C.outline).lineBetween(18, 38, 6, 30);
    g.lineStyle(4.5, 0x92400e).lineBetween(18, 38, 6, 30);
  } else {
    g.lineStyle(7, C.outline).lineBetween(18, 38, 12, 50);
    g.lineStyle(4.5, 0x92400e).lineBetween(18, 38, 12, 50);
  }
}

function drawBoss(g: G, mouthOpen: boolean, crouch: boolean): void {
  // 168x150 dragon-like brute, facing left (toward the arena entrance).
  const dy = crouch ? 10 : 0;
  // Tail
  outlined(g, 0xdc2626, () => {
    g.fillTriangle(110, 118 + dy, 166, 96 + dy, 120, 138);
    g.strokeTriangle(110, 118 + dy, 166, 96 + dy, 120, 138);
  });
  // Back spikes
  g.fillStyle(0xfbbf24);
  g.lineStyle(2.5, C.outline);
  [[78, 30], [100, 38], [118, 54], [130, 74]].forEach(([sx, sy]) => {
    g.fillTriangle(sx - 10, sy + 12 + dy, sx + 10, sy + 12 + dy, sx + 4, sy - 12 + dy);
    g.strokeTriangle(sx - 10, sy + 12 + dy, sx + 10, sy + 12 + dy, sx + 4, sy - 12 + dy);
  });
  // Legs
  outlined(g, 0xb91c1c, () => {
    g.fillRoundedRect(52, 112, 26, 34, 8);
    g.strokeRoundedRect(52, 112, 26, 34, 8);
    g.fillRoundedRect(94, 112, 26, 34, 8);
    g.strokeRoundedRect(94, 112, 26, 34, 8);
  });
  g.fillStyle(C.white).fillTriangle(52, 146, 58, 146, 55, 138).fillTriangle(62, 146, 68, 146, 65, 138);
  // Body
  outlined(g, 0xef4444, () => {
    g.fillEllipse(88, 88 + dy, 96, 78);
    g.strokeEllipse(88, 88 + dy, 96, 78);
  });
  g.fillStyle(0xfde68a).fillEllipse(76, 96 + dy, 50, 54);
  g.lineStyle(2, 0xf59e0b);
  for (let i = 0; i < 4; i += 1) g.lineBetween(56, 80 + i * 10 + dy, 96, 80 + i * 10 + dy);
  // Arm
  outlined(g, 0xdc2626, () => {
    g.fillEllipse(58, 92 + dy, 18, 26);
    g.strokeEllipse(58, 92 + dy, 18, 26);
  });
  // Head
  outlined(g, 0xef4444, () => {
    g.fillEllipse(44, 48 + dy, 66, 50);
    g.strokeEllipse(44, 48 + dy, 66, 50);
  });
  // Horns
  g.fillStyle(0xfef3c7);
  g.fillTriangle(50, 28 + dy, 64, 26 + dy, 66, 2 + dy);
  g.strokeTriangle(50, 28 + dy, 64, 26 + dy, 66, 2 + dy);
  g.fillTriangle(30, 28 + dy, 42, 24 + dy, 34, 4 + dy);
  g.strokeTriangle(30, 28 + dy, 42, 24 + dy, 34, 4 + dy);
  // Snout and jaw
  if (mouthOpen) {
    g.fillStyle(0x7f1d1d).fillEllipse(20, 64 + dy, 34, 22);
    g.fillStyle(0xfb923c).fillEllipse(16, 64 + dy, 20, 10);
    g.fillStyle(C.white).fillTriangle(8, 54 + dy, 14, 54 + dy, 11, 61 + dy).fillTriangle(22, 54 + dy, 28, 54 + dy, 25, 61 + dy);
  } else {
    g.fillStyle(0xdc2626).fillEllipse(20, 60 + dy, 34, 16);
    g.lineStyle(2, C.outline).lineBetween(6, 62 + dy, 36, 64 + dy);
    g.fillStyle(C.white).fillTriangle(12, 63 + dy, 18, 63 + dy, 15, 69 + dy);
  }
  g.fillStyle(C.outline).fillCircle(12, 50 + dy, 2.5).fillCircle(22, 50 + dy, 2.5);
  // Eye
  g.fillStyle(0xfef08a).fillEllipse(42, 40 + dy, 16, 13);
  g.fillStyle(C.outline).fillEllipse(39, 41 + dy, 5, 9);
  g.lineStyle(3.5, C.outline).lineBetween(32, 30 + dy, 52, 34 + dy);
}

function bake(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

/** Builds every texture. Call once in the boot scene. */
export function bakeTextures(scene: Phaser.Scene): void {
  bake(scene, 'tiles', TILE * TILE_FRAMES.length, TILE, (g) => {
    TILE_FRAMES.forEach((name, i) => drawTile(g, name, i * TILE, 0));
  });
  TILE_FRAMES.forEach((name) => bake(scene, `tile-${name}`, TILE, TILE, (g) => drawTile(g, name, 0, 0)));

  HERO_POSES.forEach((pose) => {
    bake(scene, `hero-s-${pose}`, 48, 48, (g) => drawHero(g, pose, false));
    bake(scene, `hero-t-${pose}`, 48, 80, (g) => drawHero(g, pose, true));
  });

  bake(scene, 'slime-1', 48, 44, (g) => drawSlime(g, 0));
  bake(scene, 'slime-2', 48, 44, (g) => drawSlime(g, 1));
  bake(scene, 'slime-flat', 48, 44, (g) => {
    g.fillStyle(0x34d399).fillEllipse(24, 38, 46, 12);
    g.lineStyle(2, C.outline).strokeEllipse(24, 38, 46, 12);
  });
  const turtles: [string, number, number, number, boolean][] = [
    ['turtle', 0x38bdf8, 0x0369a1, 0xa3e635, false],
    ['spine', 0x8b5cf6, 0x5b21b6, 0x94a3b8, true],
  ];
  turtles.forEach(([key, shell, dark, skin, spikes]) => {
    bake(scene, `${key}-1`, 48, 56, (g) => drawTurtle(g, 3, shell, dark, skin, spikes, 0));
    bake(scene, `${key}-2`, 48, 56, (g) => drawTurtle(g, -3, shell, dark, skin, spikes, 0));
    bake(scene, `${key}-shell`, 44, 36, (g) => drawShell(g, shell, dark, spikes, 0, 2, 0));
    bake(scene, `${key}-shell2`, 44, 36, (g) => drawShell(g, shell, dark, spikes, 0, 2, 16));
  });
  bake(scene, 'flyer-1', 48, 56, (g) => drawTurtle(g, 0, 0x38bdf8, 0x0369a1, 0xa3e635, false, 1));
  bake(scene, 'flyer-2', 48, 56, (g) => drawTurtle(g, 0, 0x38bdf8, 0x0369a1, 0xa3e635, false, 2));
  bake(scene, 'poison-1', 48, 46, (g) => drawPoison(g, 2));
  bake(scene, 'poison-2', 48, 46, (g) => drawPoison(g, -2));
  bake(scene, 'monkey-1', 56, 64, (g) => drawMonkey(g, false));
  bake(scene, 'monkey-2', 56, 64, (g) => drawMonkey(g, true));
  bake(scene, 'banana', 30, 22, (g) => {
    g.lineStyle(9, C.outline).beginPath().arc(15, 2, 14, 0.5, Math.PI - 0.5).strokePath();
    g.lineStyle(6, 0xfde047).beginPath().arc(15, 2, 14, 0.5, Math.PI - 0.5).strokePath();
    g.fillStyle(0x713f12).fillCircle(3, 10, 2.5).fillCircle(27, 10, 2.5);
  });
  bake(scene, 'wrench', 34, 16, (g) => {
    g.fillStyle(C.outline).fillRoundedRect(4, 5, 24, 7, 3);
    g.fillStyle(0xcbd5e1).fillRoundedRect(5, 6, 22, 5, 2);
    g.fillStyle(0xcbd5e1).fillCircle(28, 8, 7);
    g.lineStyle(2, C.outline).strokeCircle(28, 8, 7);
    g.fillStyle(C.outline).fillRect(29, 5, 6, 6);
    g.fillStyle(0xf97316).fillRoundedRect(2, 4, 10, 9, 3);
  });
  [1, 0.7, 0.35, 0.7].forEach((sx, i) => {
    bake(scene, `coin-${i + 1}`, 32, 32, (g) => {
      g.fillStyle(C.outline).fillEllipse(16, 16, 26 * sx + 3, 29);
      g.fillStyle(C.coinDark).fillEllipse(16, 16, 26 * sx, 26);
      g.fillStyle(C.coin).fillEllipse(15, 15, 20 * sx, 21);
      if (sx > 0.5) g.fillStyle(C.white, 0.85).fillRoundedRect(13, 9, 4 * sx, 12, 2);
    });
  });
  bake(scene, 'toolbox', 44, 38, (g) => {
    g.lineStyle(4, C.outline).strokeRoundedRect(14, 2, 16, 12, 4);
    g.lineStyle(2.5, 0xe5e7eb).strokeRoundedRect(14, 2, 16, 12, 4);
    outlined(g, 0xef4444, () => {
      g.fillRoundedRect(2, 10, 40, 26, 5);
      g.strokeRoundedRect(2, 10, 40, 26, 5);
    });
    g.fillStyle(0xb91c1c).fillRect(2, 20, 40, 4);
    g.fillStyle(C.buckle).fillRoundedRect(18, 18, 8, 8, 2);
  });
  bake(scene, 'star', 44, 44, (g) => {
    const pts: Phaser.Types.Math.Vector2Like[] = [];
    for (let i = 0; i < 10; i += 1) {
      const r = i % 2 === 0 ? 20 : 9;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push({ x: 22 + Math.cos(a) * r, y: 23 + Math.sin(a) * r });
    }
    g.fillStyle(0xfacc15).fillPoints(pts, true);
    g.lineStyle(3, C.outline).strokePoints(pts, true);
    g.fillStyle(C.outline).fillRect(17, 19, 3, 7).fillRect(24, 19, 3, 7);
  });
  const heart = (g: G, color: number, shine: number) => {
    g.fillStyle(C.outline);
    g.fillCircle(10, 11, 10).fillCircle(24, 11, 10).fillTriangle(1, 14, 33, 14, 17, 31);
    g.fillStyle(color);
    g.fillCircle(10, 11, 8).fillCircle(24, 11, 8).fillTriangle(3, 14, 31, 14, 17, 28);
    g.fillStyle(shine, 0.9).fillEllipse(9, 8, 6, 4);
  };
  bake(scene, 'heart', 34, 32, (g) => heart(g, C.red, 0xfecaca));
  bake(scene, 'goldheart', 34, 32, (g) => {
    heart(g, 0xfbbf24, 0xfffbeb);
    g.fillStyle(C.white).fillRect(15, 10, 4, 12).fillRect(11, 14, 12, 4);
  });
  bake(scene, 'vine', 48, 48, (g) => {
    g.lineStyle(5, C.vineDark).lineBetween(24, 0, 24, 48);
    g.lineStyle(3, C.vine).lineBetween(24, 0, 24, 48);
    g.fillStyle(C.vine).fillEllipse(15, 14, 14, 8).fillEllipse(33, 34, 14, 8);
    g.lineStyle(1.5, C.vineDark).strokeEllipse(15, 14, 14, 8).strokeEllipse(33, 34, 14, 8);
  });
  bake(scene, 'platform', TILE * 3, 24, (g) => {
    outlined(g, C.wood, () => {
      g.fillRoundedRect(1, 1, TILE * 3 - 2, 22, 6);
      g.strokeRoundedRect(1, 1, TILE * 3 - 2, 22, 6);
    }, 2.5);
    g.fillStyle(C.woodDark).fillRect(48, 3, 2, 18).fillRect(96, 3, 2, 18);
    g.fillStyle(0x6b4423).fillCircle(10, 12, 2.5).fillCircle(134, 12, 2.5);
  });
  const flag = (g: G, on: boolean) => {
    g.fillStyle(C.outline).fillRect(10, 6, 6, 138);
    g.fillStyle(0xe5e7eb).fillRect(11, 7, 4, 136);
    g.fillStyle(C.outline).fillCircle(13, 6, 6);
    g.fillStyle(on ? C.coin : 0xe5e7eb).fillCircle(13, 6, 4);
    g.fillStyle(C.outline).fillTriangle(15, 12, 46, 26, 15, 42);
    g.fillStyle(on ? C.red : 0xf87171).fillTriangle(16, 15, 42, 26, 16, 39);
    g.fillStyle(C.stoneDark).fillRoundedRect(2, 136, 22, 8, 3);
  };
  bake(scene, 'flag', 48, 144, (g) => flag(g, false));
  bake(scene, 'flag-on', 48, 144, (g) => flag(g, true));
  bake(scene, 'house', 192, 192, (g) => {
    outlined(g, 0xd6a46a, () => {
      g.fillRect(24, 80, 144, 110);
      g.strokeRect(24, 80, 144, 110);
    });
    g.lineStyle(2, 0xb07f45);
    for (let y = 96; y < 190; y += 16) g.lineBetween(26, y, 166, y);
    outlined(g, 0x2563eb, () => {
      g.fillTriangle(8, 88, 184, 88, 96, 14);
      g.strokeTriangle(8, 88, 184, 88, 96, 14);
    });
    g.fillStyle(0x1d4ed8).fillTriangle(30, 82, 162, 82, 96, 28);
    outlined(g, 0x7c2d12, () => {
      g.fillRoundedRect(74, 120, 44, 70, { tl: 20, tr: 20, bl: 0, br: 0 });
      g.strokeRoundedRect(74, 120, 44, 70, { tl: 20, tr: 20, bl: 0, br: 0 });
    });
    g.fillStyle(C.coin).fillCircle(108, 158, 4);
    outlined(g, 0xbae6fd, () => {
      g.fillRect(36, 104, 26, 24);
      g.strokeRect(36, 104, 26, 24);
      g.fillRect(130, 104, 26, 24);
      g.strokeRect(130, 104, 26, 24);
    }, 2.5);
    g.fillStyle(C.coin).fillCircle(96, 60, 10);
    g.lineStyle(2.5, C.outline).strokeCircle(96, 60, 10);
  });
  bake(scene, 'boss-idle', 168, 150, (g) => drawBoss(g, false, false));
  bake(scene, 'boss-mouth', 168, 150, (g) => drawBoss(g, true, false));
  bake(scene, 'boss-crouch', 168, 150, (g) => drawBoss(g, false, true));
  bake(scene, 'fire', 56, 30, (g) => {
    g.fillStyle(0xf97316).fillEllipse(30, 15, 50, 26);
    g.fillStyle(0xfbbf24).fillEllipse(24, 15, 34, 16);
    g.fillStyle(0xfffbeb).fillEllipse(18, 15, 14, 8);
  });
  bake(scene, 'bone', 38, 18, (g) => {
    g.fillStyle(C.outline).fillRoundedRect(6, 5, 26, 8, 3).fillCircle(6, 5, 5).fillCircle(6, 13, 5).fillCircle(32, 5, 5).fillCircle(32, 13, 5);
    g.fillStyle(0xfafaf9).fillRoundedRect(7, 6, 24, 6, 2).fillCircle(6, 5, 3.5).fillCircle(6, 13, 3.5).fillCircle(32, 5, 3.5).fillCircle(32, 13, 3.5);
  });
  bake(scene, 'glow', 96, 96, (g) => {
    for (let r = 46; r > 0; r -= 4) g.fillStyle(0xfff7ae, 0.05 + (46 - r) * 0.004).fillCircle(48, 48, r);
  });
  bake(scene, 'spark', 14, 14, (g) => {
    g.fillStyle(C.white).fillTriangle(7, 0, 9, 7, 5, 7).fillTriangle(7, 14, 9, 7, 5, 7).fillTriangle(0, 7, 7, 5, 7, 9).fillTriangle(14, 7, 7, 5, 7, 9);
  });
  bake(scene, 'debris', 16, 16, (g) => {
    g.fillStyle(C.brickDark).fillRoundedRect(0, 0, 16, 16, 3);
    g.fillStyle(C.brick).fillRoundedRect(2, 2, 12, 10, 2);
  });
  bake(scene, 'cloud', 160, 80, (g) => {
    g.fillStyle(C.white, 0.95).fillCircle(50, 48, 28).fillCircle(84, 36, 34).fillCircle(118, 50, 26).fillRoundedRect(30, 50, 110, 26, 13);
  });
  bake(scene, 'bush', 120, 56, (g) => {
    g.fillStyle(C.grassDark).fillCircle(30, 34, 22).fillCircle(60, 26, 26).fillCircle(90, 34, 22);
    g.fillStyle(C.grass).fillCircle(30, 36, 18).fillCircle(60, 28, 22).fillCircle(90, 36, 18);
    g.fillStyle(0xf472b6).fillCircle(44, 24, 4).fillCircle(78, 30, 4);
    g.fillStyle(0x7c3aed).fillCircle(62, 16, 4);
  });
  const hills = (g: G, color: number, dark: number, h: number, bumps: number) => {
    g.fillStyle(color);
    for (let i = 0; i <= bumps; i += 1) g.fillEllipse((i * 512) / bumps, 300 - h * 0.35, 512 / bumps + 120, h * 1.6);
    g.fillRect(0, 300 - h * 0.35, 512, h);
    g.fillStyle(dark, 0.35);
    for (let i = 0; i < bumps; i += 1) g.fillCircle((i * 512) / bumps + 60, 300 - h * 0.6, 6);
  };
  bake(scene, 'hills-far', 512, 300, (g) => hills(g, 0x9be7a6, 0x4ade80, 170, 3));
  bake(scene, 'hills-near', 512, 300, (g) => hills(g, 0x6fd17f, 0x22a04b, 120, 2));
  bake(scene, 'sky', 4, 256, (g) => {
    for (let y = 0; y < 256; y += 1) {
      const t = y / 255;
      const r = Math.round(0x6c + (0xd6 - 0x6c) * t);
      const gg = Math.round(0xc6 + (0xf2 - 0xc6) * t);
      const b = Math.round(0xff + (0xff - 0xff) * t);
      g.fillStyle((r << 16) | (gg << 8) | b).fillRect(0, y, 4, 1);
    }
  });
}
