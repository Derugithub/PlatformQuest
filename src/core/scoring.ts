/** Score values and the three level stars. */

export const POINTS = {
  coin: 50,
  stomp: 200,
  shellKill: 200,
  wrenchKill: 200,
  starKill: 200,
  brick: 50,
  powerUp: 1000,
  heartAtMax: 1000,
  bossHit: 500,
  bossDefeat: 5000,
  checkpoint: 100,
  /** Per whole second left on the timer at the goal. */
  timeBonusPerSecond: 10,
} as const;

/** Consecutive kills by one moving shell or stomp chain score more, capped at 8x. */
export function chainPoints(base: number, chainIndex: number): number {
  return base * Math.min(8, 2 ** Math.max(0, chainIndex));
}

export function timeBonus(secondsLeft: number): number {
  return Math.max(0, Math.floor(secondsLeft)) * POINTS.timeBonusPerSecond;
}

export type StarInput = {
  finished: boolean;
  enemiesDefeated: number;
  enemiesTotal: number;
  elapsedSeconds: number;
  targetSeconds: number;
};

export type Stars = [boolean, boolean, boolean];

export const STAR_LABELS = ['Finish the level', 'Defeat all monsters', 'Finish under target time'] as const;

/** Star 1: finish. Star 2: defeat every monster. Star 3: finish within the target time. */
export function scoreStars(input: StarInput): Stars {
  if (!input.finished) return [false, false, false];
  return [true, input.enemiesDefeated >= input.enemiesTotal, input.elapsedSeconds <= input.targetSeconds];
}

export function starCount(stars: readonly boolean[]): number {
  return stars.filter(Boolean).length;
}

/** Best result per star slot across attempts. */
export function mergeStars(best: Stars, latest: Stars): Stars {
  return [best[0] || latest[0], best[1] || latest[1], best[2] || latest[2]];
}
