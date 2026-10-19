import { isLevelId, type LevelDef, type LevelId } from '../level-format';
import { ZONE_1 } from './zone-1';

export { ZONE_1 };

export function getLevel(id: LevelId): LevelDef {
  const level = ZONE_1.find((l) => l.id === id);
  if (!level) throw new Error(`Unknown level ${id}`);
  return level;
}

export function findLevel(id: unknown): LevelDef | null {
  return isLevelId(id) ? getLevel(id) : null;
}
