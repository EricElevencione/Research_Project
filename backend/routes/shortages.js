const express = require("express");

const {
  fertilizers,
  seeds,
  fertilizerById,
  seedById,
} = require("../loaders/dataLoader");
const {
  resolveFertilizerShortage,
} = require("../resolvers/fertilizerResolver");
const { resolveSeedShortage } = require("../resolvers/seedResolver");

const router = express.Router();

router.get("/seeds", (req, res) => {
  const list = seeds.map((seed) => ({
    id: seed.id,
    name: seed.name,
    category: seed.category,
    environment: seed.environment,
    maturity_days: seed.maturity_days,
    yield_display: seed.yield_display,
    status: seed.status,
  }));

  res.json(list);
});

router.get("/fertilizers", (req, res) => {
  const list = fertilizers.map((fertilizer) => ({
    id: fertilizer.id,
    name: fertilizer.name,
    category: fertilizer.category,
    tier: fertilizer.tier,
    nutrient_role: fertilizer.nutrient_role,
  }));

  res.json(list);
});

router.post("/fertilizer", (req, res) => {
  const { seedId, shortageFertId, unavailableIds } = req.body || {};

  if (!seedId || !shortageFertId) {
    return res.status(400).json({
      error: "seedId and shortageFertId are required.",
    });
  }

  if (!seedById.get(seedId) || !fertilizerById.get(shortageFertId)) {
    return res.status(404).json({
      error: "Seed or fertilizer id was not found.",
    });
  }

  const result = resolveFertilizerShortage(
    seedId,
    shortageFertId,
    unavailableIds,
  );

  if (result.status === "error") {
    return res.status(500).json(result);
  }

  return res.json(result);
});

router.post("/seed", (req, res) => {
  const { seedId, unavailableIds } = req.body || {};

  if (!seedId) {
    return res.status(400).json({
      error: "seedId is required.",
    });
  }

  if (!seedById.get(seedId)) {
    return res.status(404).json({
      error: "Seed id was not found.",
    });
  }

  const result = resolveSeedShortage(seedId, unavailableIds);

  if (result.status === "error") {
    return res.status(500).json(result);
  }

  return res.json(result);
});

module.exports = router;
