import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const repoRoot = process.cwd();
const seedsPath = path.join(repoRoot, "backend", "data", "seeds.json");
const fertilizersPath = path.join(
  repoRoot,
  "backend",
  "data",
  "fertilizer.json",
);

function loadEnvFileIfPresent(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = line.slice(0, eqIndex).trim();
    const value = line.slice(eqIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function toInt(value, fallback = null) {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function toNumber(value, fallback = null) {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function main() {
  loadEnvFileIfPresent(path.join(repoRoot, ".env"));
  loadEnvFileIfPresent(path.join(repoRoot, "backend", ".env"));

  const supabaseUrl = requireEnv("VITE_SUPABASE_URL");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for sync writes. Add it to your shell or .env and try again.",
    );
  }

  if (serviceRoleKey.startsWith("sb_publishable_")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is using a publishable (anon) key. Use the real service_role secret key from Supabase Dashboard > Project Settings > API.",
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const seedsJson = readJson(seedsPath);
  const fertilizersJson = readJson(fertilizersPath);

  const seeds = Array.isArray(seedsJson?.seeds) ? seedsJson.seeds : [];
  const fertilizers = Array.isArray(fertilizersJson?.fertilizers)
    ? fertilizersJson.fertilizers
    : [];

  if (seeds.length === 0 || fertilizers.length === 0) {
    throw new Error("No seeds/fertilizers found in source JSON files.");
  }

  const fertilizerRows = fertilizers.map((item, idx) => ({
    id: item.id,
    name: item.name,
    category: item.category ?? null,
    tier: toInt(item.tier, 2),
    nutrient_role: item.nutrient_role ?? null,
    nutrient_type: item.nutrient_type ?? null,
    application_timing: item.application_timing ?? null,
    form: item.form ?? null,
    description: item.description ?? null,
    sort_order: (idx + 1) * 10,
    is_active: true,
    updated_at: new Date().toISOString(),
  }));

  const seedRows = seeds.map((item, idx) => ({
    id: item.id,
    name: item.name,
    category: item.category ?? null,
    nsic_code: item.nsic_code ?? null,
    yield_display: item.yield_display ?? null,
    yield_min_tha: toNumber(item.yield_min_tha),
    yield_max_tha: toNumber(item.yield_max_tha),
    maturity_days: toInt(item.maturity_days),
    environment: item.environment ?? null,
    status: item.status ?? null,
    fertilizer_responsiveness_rank: toInt(item.fertilizer_responsiveness_rank),
    compatibility_source: item.compatibility_source ?? null,
    fertilizer_compatibility: Array.isArray(item.fertilizer_compatibility)
      ? item.fertilizer_compatibility
      : [],
    sort_order: (idx + 1) * 10,
    is_active: true,
    updated_at: new Date().toISOString(),
  }));

  const fallbackMap =
    fertilizersJson?.fallback_rules?.nutrient_role_fallback_map || {};

  const fallbackRows = Object.entries(fallbackMap).flatMap(
    ([role, fertilizerIds]) => {
      if (!Array.isArray(fertilizerIds)) return [];
      return fertilizerIds.map((fertId, index) => ({
        nutrient_role: role,
        fallback_fertilizer_id: fertId,
        sort_order: (index + 1) * 10,
        is_active: true,
      }));
    },
  );

  const { error: fertError } = await supabase
    .from("shortages_fertilizers")
    .upsert(fertilizerRows, { onConflict: "id" });
  if (fertError) throw fertError;

  const { error: seedError } = await supabase
    .from("shortages_seeds")
    .upsert(seedRows, { onConflict: "id" });
  if (seedError) throw seedError;

  if (fallbackRows.length > 0) {
    const { error: fallbackError } = await supabase
      .from("shortages_fertilizer_role_fallback")
      .upsert(fallbackRows, {
        onConflict: "nutrient_role,fallback_fertilizer_id",
      });
    if (fallbackError) throw fallbackError;
  }

  const { error: bridgeError } = await supabase
    .from("shortages_role_bridge")
    .upsert(
      [
        {
          from_role: "bio_nitrogen_fixer",
          to_role: "nitrogen_source",
          sort_order: 10,
          is_active: true,
        },
      ],
      { onConflict: "from_role,to_role" },
    );
  if (bridgeError) throw bridgeError;

  console.log(
    `Synced shortages catalogs: ${seedRows.length} seeds, ${fertilizerRows.length} fertilizers, ${fallbackRows.length} role-fallback mappings.`,
  );
}

main().catch((error) => {
  console.error("Failed to sync shortages catalogs:", error);
  process.exit(1);
});
