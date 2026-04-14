const fs = require("fs");
const path = require("path");

function readJsonInOrder(preferredName, fallbackName) {
  const candidates = [
    path.join(__dirname, "..", "data", preferredName),
    path.join(__dirname, "..", "data", fallbackName || preferredName),
    path.join(__dirname, "..", "dss-scripts", "knowledge", preferredName),
    path.join(
      __dirname,
      "..",
      "dss-scripts",
      "knowledge",
      fallbackName || preferredName,
    ),
  ];

  const resolvedPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!resolvedPath) {
    throw new Error(
      `Missing data file. Tried: ${preferredName}${fallbackName ? ` and ${fallbackName}` : ""}`,
    );
  }

  const content = fs.readFileSync(resolvedPath, "utf8");
  return JSON.parse(content);
}

// IMPORTANT: Keep this exact load order: fertilizers -> seeds -> philrice.
const fertilizersRaw = readJsonInOrder("fertilizers.json", "fertilizer.json");
const seedsRaw = readJsonInOrder("seeds.json");
const philriceRaw = readJsonInOrder("philrice.json");

const fertilizers = Array.isArray(fertilizersRaw)
  ? fertilizersRaw
  : Array.isArray(fertilizersRaw.fertilizers)
    ? fertilizersRaw.fertilizers
    : [];

const seeds = Array.isArray(seedsRaw)
  ? seedsRaw
  : Array.isArray(seedsRaw.seeds)
    ? seedsRaw.seeds
    : [];

const fertilizerById = new Map();
for (const fertilizer of fertilizers) {
  fertilizerById.set(fertilizer.id, fertilizer);
}

const seedById = new Map();
for (const seed of seeds) {
  seedById.set(seed.id, seed);
}

const tier2ByRole = new Map();
for (const fertilizer of fertilizers) {
  if (fertilizer.tier !== 2) {
    continue;
  }

  const role = fertilizer.nutrient_role;
  if (!tier2ByRole.has(role)) {
    tier2ByRole.set(role, []);
  }
  tier2ByRole.get(role).push(fertilizer);
}

module.exports = {
  fertilizersRaw,
  seedsRaw,
  philriceRaw,
  fertilizers,
  seeds,
  fertilizerById,
  seedById,
  tier2ByRole,
};
