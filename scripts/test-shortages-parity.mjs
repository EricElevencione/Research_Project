import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const {
  resolveFertilizerShortage,
} = require("../backend/resolvers/fertilizerResolver");
const { resolveSeedShortage } = require("../backend/resolvers/seedResolver");

function loadEnvFileIfPresent(envPath) {
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for parity test.`);
  }
  return value;
}

function normalizeFertilizerSummary(result) {
  return {
    status: result?.status ?? null,
    shortageId: result?.shortage?.id ?? null,
    suggestionId: result?.suggestion?.id ?? null,
    hasSuggestion: Boolean(result?.suggestion),
    message: result?.message ?? null,
  };
}

function normalizeSeedSummary(result) {
  const first = Array.isArray(result?.substitutes)
    ? result.substitutes[0]
    : null;
  return {
    status: result?.status ?? null,
    originalId: result?.original?.id ?? null,
    firstSubstituteId: first?.id ?? null,
    substitutesCount: Array.isArray(result?.substitutes)
      ? result.substitutes.length
      : 0,
    message: result?.message ?? null,
  };
}

function isEqualSummary(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function main() {
  const repoRoot = process.cwd();
  const envPath = path.join(repoRoot, ".env");
  loadEnvFileIfPresent(envPath);

  const supabaseUrl = requireEnv("VITE_SUPABASE_URL");
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseKey) {
    throw new Error(
      "Either SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY must be set.",
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: seedsList, error: seedsListError } = await supabase.rpc(
    "list_shortages_seeds",
  );
  if (seedsListError) {
    throw new Error(
      `RPC list_shortages_seeds failed: ${seedsListError.message}`,
    );
  }

  const { data: fertilizersList, error: fertilizersListError } =
    await supabase.rpc("list_shortages_fertilizers");
  if (fertilizersListError) {
    throw new Error(
      `RPC list_shortages_fertilizers failed: ${fertilizersListError.message}`,
    );
  }

  const seedsCount = Array.isArray(seedsList) ? seedsList.length : 0;
  const fertilizersCount = Array.isArray(fertilizersList)
    ? fertilizersList.length
    : 0;

  if (seedsCount === 0 || fertilizersCount === 0) {
    throw new Error(
      `Supabase shortages catalogs appear empty (seeds=${seedsCount}, fertilizers=${fertilizersCount}). Run npm run sync:shortages first.`,
    );
  }

  const fertilizerCases = [
    {
      name: "fertilizer: seed-ranked tier1",
      payload: {
        seedId: "jackpot",
        shortageFertId: "urea",
        unavailableIds: [],
      },
    },
    {
      name: "fertilizer: null-seed fallback",
      payload: { seedId: null, shortageFertId: "azolla", unavailableIds: [] },
    },
    {
      name: "fertilizer: forced fallback via unavailable tier1",
      payload: {
        seedId: "jackpot",
        shortageFertId: "urea",
        unavailableIds: [
          "complete_14",
          "ammonium_sulfate",
          "muriate_of_potash",
        ],
      },
    },
  ];

  const seedCases = [
    {
      name: "seed: resolved substitute",
      payload: { seedId: "jackpot", unavailableIds: [] },
    },
    {
      name: "seed: unavailable excludes top options",
      payload: { seedId: "jackpot", unavailableIds: ["us88", "th82"] },
    },
  ];

  const mismatches = [];

  for (const testCase of fertilizerCases) {
    const nodeResult = resolveFertilizerShortage(
      testCase.payload.seedId,
      testCase.payload.shortageFertId,
      testCase.payload.unavailableIds,
    );

    const { data, error } = await supabase.rpc("resolve_fertilizer_shortage", {
      seed_id: testCase.payload.seedId,
      shortage_fert_id: testCase.payload.shortageFertId,
      unavailable_ids: testCase.payload.unavailableIds,
    });

    if (error) {
      mismatches.push({
        name: testCase.name,
        type: "rpc_error",
        detail: error.message,
      });
      continue;
    }

    const nodeSummary = normalizeFertilizerSummary(nodeResult);
    const supaSummary = normalizeFertilizerSummary(data);

    if (!isEqualSummary(nodeSummary, supaSummary)) {
      mismatches.push({
        name: testCase.name,
        type: "mismatch",
        node: nodeSummary,
        supabase: supaSummary,
      });
    }
  }

  for (const testCase of seedCases) {
    const nodeResult = resolveSeedShortage(
      testCase.payload.seedId,
      testCase.payload.unavailableIds,
    );

    const { data, error } = await supabase.rpc("resolve_seed_shortage", {
      seed_id: testCase.payload.seedId,
      unavailable_ids: testCase.payload.unavailableIds,
    });

    if (error) {
      mismatches.push({
        name: testCase.name,
        type: "rpc_error",
        detail: error.message,
      });
      continue;
    }

    const nodeSummary = normalizeSeedSummary(nodeResult);
    const supaSummary = normalizeSeedSummary(data);

    if (!isEqualSummary(nodeSummary, supaSummary)) {
      mismatches.push({
        name: testCase.name,
        type: "mismatch",
        node: nodeSummary,
        supabase: supaSummary,
      });
    }
  }

  if (mismatches.length > 0) {
    console.error("Shortages parity test found mismatches:\n");
    for (const mismatch of mismatches) {
      console.error(JSON.stringify(mismatch, null, 2));
    }
    process.exit(1);
  }

  console.log(
    `Shortages parity test passed (${fertilizerCases.length + seedCases.length} scenarios).`,
  );
}

main().catch((error) => {
  console.error("Parity test failed:", error.message || error);
  process.exit(1);
});
