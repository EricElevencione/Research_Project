const { seedById, seeds } = require("../loaders/dataLoader");

function top3FertilizerIds(seed) {
  return (seed.fertilizer_compatibility || [])
    .slice(0, 3)
    .map((entry) => entry.fertilizer_id);
}

function buildShift(originalTop3, candidateTop3, candidateName) {
  const originalSet = new Set(originalTop3);
  const candidateSet = new Set(candidateTop3);

  const added = candidateTop3.filter((fertId) => !originalSet.has(fertId));
  const removed = originalTop3.filter((fertId) => !candidateSet.has(fertId));

  const hasShift = added.length > 0 || removed.length > 0;
  const message = hasShift
    ? `${candidateName} has different top fertilizer priorities. Review added and removed fertilizers before recommending this seed.`
    : "Top 3 fertilizer priorities are aligned with the original seed.";

  return {
    has_shift: hasShift,
    message,
    added,
    removed,
  };
}

function toSeedSummary(seed) {
  return {
    id: seed.id,
    name: seed.name,
    category: seed.category,
    environment: seed.environment,
    maturity_days: seed.maturity_days,
    yield_display: seed.yield_display,
    yield_max_tha: seed.yield_max_tha,
    top_3_fertilizers: top3FertilizerIds(seed),
  };
}

function resolveSeedShortage(seedId, unavailableIds = []) {
  try {
    const original = seedById.get(seedId);

    if (!original) {
      return {
        status: "error",
        original: null,
        substitutes: [],
        message: "The requested seed could not be found.",
      };
    }

    const unavailableSet = new Set(
      Array.isArray(unavailableIds) ? unavailableIds : [],
    );
    unavailableSet.add(seedId);

    const originalTop3 = top3FertilizerIds(original);
    const originalMaturity = original.maturity_days;
    const originalYield = original.yield_max_tha;

    const candidates = seeds.filter((seed) => !unavailableSet.has(seed.id));

    // FILTER 1: category must match exactly.
    const filter1 = candidates.filter(
      (seed) => seed.category === original.category,
    );

    // FILTER 2: environment must match exactly.
    const filter2 = filter1.filter(
      (seed) => seed.environment === original.environment,
    );

    // FILTER 3: maturity_days within +/-10 days. Skip if original maturity is null.
    const filter3 =
      originalMaturity == null
        ? filter2
        : filter2.filter((seed) => {
            if (seed.maturity_days == null) {
              return false;
            }
            return Math.abs(seed.maturity_days - originalMaturity) <= 10;
          });

    // FILTER 4: sort by closest yield_max_tha to original; null yields go to the bottom.
    const sorted = [...filter3].sort((a, b) => {
      const aYield = a.yield_max_tha;
      const bYield = b.yield_max_tha;

      if (aYield == null && bYield == null) {
        return 0;
      }
      if (aYield == null) {
        return 1;
      }
      if (bYield == null) {
        return -1;
      }
      if (originalYield == null) {
        return 0;
      }

      return (
        Math.abs(aYield - originalYield) - Math.abs(bYield - originalYield)
      );
    });

    const substitutes = sorted.map((candidate) => {
      const candidateTop3 = top3FertilizerIds(candidate);
      const fertilizerShift = buildShift(
        originalTop3,
        candidateTop3,
        candidate.name,
      );

      const maturityDiff =
        originalMaturity == null || candidate.maturity_days == null
          ? null
          : candidate.maturity_days - originalMaturity;

      const yieldDiff =
        originalYield == null || candidate.yield_max_tha == null
          ? null
          : Number((candidate.yield_max_tha - originalYield).toFixed(2));

      return {
        id: candidate.id,
        name: candidate.name,
        category: candidate.category,
        environment: candidate.environment,
        maturity_days: candidate.maturity_days,
        yield_display: candidate.yield_display,
        yield_max_tha: candidate.yield_max_tha,
        top_3_fertilizers: candidateTop3,
        maturity_diff_days: maturityDiff,
        yield_diff_tha: yieldDiff,
        fertilizer_shift: fertilizerShift,
      };
    });

    if (substitutes.length === 0) {
      return {
        status: "unresolvable",
        original: toSeedSummary(original),
        substitutes: [],
        message:
          "No substitute seed passed all required filters for this shortage.",
      };
    }

    return {
      status: "resolved",
      original: toSeedSummary(original),
      substitutes,
      message: `Found ${substitutes.length} compatible substitute seed option(s) for ${original.name}.`,
    };
  } catch (error) {
    return {
      status: "error",
      original: null,
      substitutes: [],
      message: `Unable to resolve seed shortage: ${error.message}`,
    };
  }
}

module.exports = {
  resolveSeedShortage,
};
