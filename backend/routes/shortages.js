const express = require("express");

const {
  fertilizers,
  seeds,
  fertilizerById,
  seedById,
} = require("../loaders/dataLoader");
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



module.exports = router;
