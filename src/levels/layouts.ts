import { compositions } from "./compositions";
import type {
  DistrictId,
  DistrictLayout,
  LevelComposition,
  Tier,
} from "./districts/types";
import { validateLayout } from "./districts/validate";
import { worldAssets as manifest } from "../assets/worldDefinitions";
const cache = new Map<DistrictId, Promise<DistrictLayout>>();
/** Load all selected districts before sim/render assembly. No background streaming during play. */
export async function loadLayouts(
  level: string,
  tier: Tier | undefined,
  read: (url: string) => Promise<unknown>,
): Promise<{ composition: LevelComposition; layouts: DistrictLayout[] }> {
  const composition = compositions[level];
  if (!composition) throw new Error(`Unknown composition: ${level}`);
  if (tier !== undefined && (!Number.isInteger(tier) || tier < 0 || tier > 5))
    throw new RangeError("Tier must be W0…W5");
  const layouts = await Promise.all(
    composition.districts.map(({ id }) => {
      if (!cache.has(id))
        cache.set(
          id,
          read(`/assets/layouts/${id}.layout.json`)
            .then((json) => {
              const data = json as DistrictLayout,
                errors = validateLayout(data, manifest);
              if (errors.length) throw new Error(errors.join("\n"));
              return data;
            })
            .catch((error) => {
              cache.delete(id);
              throw error;
            }),
        );
      return cache.get(id)!;
    }),
  );
  const resolvedTier = tier ?? composition.tier;
  const timeOfDay = level.startsWith("D-")
    ? (["L1", "L2", "L3", "L4", "L5", "L6"] as const)[resolvedTier]
    : composition.timeOfDay;
  return {
    composition: { ...composition, tier: resolvedTier, timeOfDay },
    layouts,
  };
}
