const {
  fertilizersRaw,
  fertilizerById,
  seedById,
  tier2ByRole,
} = require("../loaders/dataLoader");

function getNutrientRoleFallbackMap() {
  if (!fertilizersRaw || Array.isArray(fertilizersRaw)) {
    return {};
  }

  return fertilizersRaw?.fallback_rules?.nutrient_role_fallback_map || {};
}

const ROLE_BRIDGE_MAP = {
  bio_nitrogen_fixer: ["nitrogen_source"],
};

function resolveFertilizerShortage(
  seedId,
  shortageFertId,
  unavailableIds = [],
) {
  try {
    const hasSeedContext = Boolean(seedId);
    const seed = hasSeedContext ? seedById.get(seedId) : null;
    const shortageFertilizer = fertilizerById.get(shortageFertId);

    if (!shortageFertilizer || (hasSeedContext && !seed)) {
      return {
        status: "error",
        seed: seed ? { id: seed.id, name: seed.name } : null,
        shortage: shortageFertilizer
          ? {
              id: shortageFertilizer.id,
              name: shortageFertilizer.name,
              nutrient_role: shortageFertilizer.nutrient_role,
            }
          : null,
        suggestion: null,
        message: "The requested seed or fertilizer could not be found.",
      };
    }

    const unavailableSet = new Set(
      Array.isArray(unavailableIds) ? unavailableIds : [],
    );
    unavailableSet.add(shortageFertId);

    if (seed) {
      // STEP 1: Walk the seed compatibility list and return the first available Tier 1 option.
      for (const entry of seed.fertilizer_compatibility || []) {
        const candidate = fertilizerById.get(entry.fertilizer_id);
        if (!candidate) {
          continue;
        }
        if (unavailableSet.has(candidate.id)) {
          continue;
        }
        if (candidate.tier !== 1) {
          continue;
        }

        return {
          status: "resolved",
          seed: { id: seed.id, name: seed.name },
          shortage: {
            id: shortageFertilizer.id,
            name: shortageFertilizer.name,
            nutrient_role: shortageFertilizer.nutrient_role,
          },
          suggestion: {
            id: candidate.id,
            name: candidate.name,
            tier: candidate.tier,
            nutrient_role: candidate.nutrient_role,
            rank_on_seed: entry.rank,
            reason: entry.reason,
          },
          message: `${candidate.name} is the best available Tier 1 substitute for ${seed.name}.`,
        };
      }
    }

    // STEP 2: Fallback to Tier 2 fertilizers with the same nutrient role.
    const role = shortageFertilizer.nutrient_role;
    const tier2Candidates = tier2ByRole.get(role) || [];
    const nutrientRoleFallbackMap = getNutrientRoleFallbackMap();
    const mappedFallbackIds = Array.isArray(nutrientRoleFallbackMap[role])
      ? nutrientRoleFallbackMap[role]
      : [];
    const mappedFallbackCandidates = mappedFallbackIds
      .map((fertId) => fertilizerById.get(fertId))
      .filter(Boolean);

    const bridgeRoles = Array.isArray(ROLE_BRIDGE_MAP[role])
      ? ROLE_BRIDGE_MAP[role]
      : [];
    const bridgedCandidates = bridgeRoles.flatMap((bridgeRole) => {
      const bridgedTier2 = tier2ByRole.get(bridgeRole) || [];
      const bridgedIds = Array.isArray(nutrientRoleFallbackMap[bridgeRole])
        ? nutrientRoleFallbackMap[bridgeRole]
        : [];
      const bridgedMapped = bridgedIds
        .map((fertId) => fertilizerById.get(fertId))
        .filter(Boolean);
      return [...bridgedTier2, ...bridgedMapped];
    });

    const fallbackCandidates = [
      ...tier2Candidates,
      ...mappedFallbackCandidates,
      ...bridgedCandidates,
    ];
    const seenCandidateIds = new Set();

    for (const candidate of fallbackCandidates) {
      if (!candidate || seenCandidateIds.has(candidate.id)) {
        continue;
      }
      seenCandidateIds.add(candidate.id);

      if (unavailableSet.has(candidate.id)) {
        continue;
      }

      return {
        status: "tier2_fallback",
        seed: seed ? { id: seed.id, name: seed.name } : null,
        shortage: {
          id: shortageFertilizer.id,
          name: shortageFertilizer.name,
          nutrient_role: shortageFertilizer.nutrient_role,
        },
        suggestion: {
          id: candidate.id,
          name: candidate.name,
          tier: candidate.tier,
          nutrient_role: candidate.nutrient_role,
          rank_on_seed: null,
          reason: `Last-resort fallback in the same nutrient role (${role}).`,
        },
        message: seed
          ? `${candidate.name} is a Tier 2 last-resort fallback for the current shortage.`
          : `${candidate.name} is a nutrient-role fallback for the current fertilizer shortage.`,
      };
    }

    // STEP 3: Unresolvable shortage.
    return {
      status: "unresolvable",
      seed: seed ? { id: seed.id, name: seed.name } : null,
      shortage: {
        id: shortageFertilizer.id,
        name: shortageFertilizer.name,
        nutrient_role: shortageFertilizer.nutrient_role,
      },
      suggestion: null,
      message:
        "No suitable fertilizer substitute is available. Please alert the operator.",
    };
  } catch (error) {
    return {
      status: "error",
      seed: null,
      shortage: null,
      suggestion: null,
      message: `Unable to resolve fertilizer shortage: ${error.message}`,
    };
  }
}

module.exports = {
  resolveFertilizerShortage,
};
