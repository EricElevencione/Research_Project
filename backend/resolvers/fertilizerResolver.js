const {
  fertilizerById,
  seedById,
  tier2ByRole,
} = require("../loaders/dataLoader");

function resolveFertilizerShortage(
  seedId,
  shortageFertId,
  unavailableIds = [],
) {
  try {
    const seed = seedById.get(seedId);
    const shortageFertilizer = fertilizerById.get(shortageFertId);

    if (!seed || !shortageFertilizer) {
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

    // STEP 2: Fallback to Tier 2 fertilizers with the same nutrient role.
    const role = shortageFertilizer.nutrient_role;
    const tier2Candidates = tier2ByRole.get(role) || [];

    for (const candidate of tier2Candidates) {
      if (unavailableSet.has(candidate.id)) {
        continue;
      }

      return {
        status: "tier2_fallback",
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
          rank_on_seed: null,
          reason: `Last-resort fallback in the same nutrient role (${role}).`,
        },
        message: `${candidate.name} is a Tier 2 last-resort fallback for the current shortage.`,
      };
    }

    // STEP 3: Unresolvable shortage.
    return {
      status: "unresolvable",
      seed: { id: seed.id, name: seed.name },
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
