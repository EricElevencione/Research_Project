/** Fertilizer/seed rows shared by JO Edit Regional Allocation modals. */

import { FERTILIZER_FIELD_MAPS } from "./shortageFieldMaps";

export type RegionalEditFertilizerRow = {
  key: string;
  label: string;
  category: "Solid" | "Liquid";
};

export type RegionalEditSeedRow = {
  key: string;
  label: string;
  category: "Hybrid" | "Inbred";
};

/**
 * Same order as JO Create Allocation / other subsidy pages: all solids, then liquids.
 * (shortageFieldMaps uses a different order; we only use it for labels + units.)
 */
const EDIT_REGIONAL_FERTILIZER_ORDER = [
  "urea_46_0_0_bags",
  "complete_14_14_14_bags",
  "ammonium_sulfate_21_0_0_bags",
  "np_16_20_0_bags",
  "muriate_potash_0_0_60_bags",
  "zinc_sulfate_bags",
  "vermicompost_bags",
  "chicken_manure_bags",
  "rice_straw_kg",
  "carbonized_rice_hull_bags",
  "complete_16_16_16_bags",
  "ammonium_phosphate_16_20_0_bags",
  "biofertilizer_liters",
  "nanobiofertilizer_liters",
  "organic_root_exudate_mix_liters",
  "azolla_microphylla_kg",
  "foliar_liquid_fertilizer_npk_liters",
] as const;

/** kg rows shown under Liquid on JO fertilizer dropdowns */
const FERTILIZER_LIQUID_GROUP_KEYS = new Set<string>(["azolla_microphylla_kg"]);

const FERTILIZER_MAP = new Map(
  FERTILIZER_FIELD_MAPS.map((row) => [row.allocationField, row]),
);

function fertilizerCategory(
  allocationField: string,
  unit: "bags" | "kg" | "liters",
): "Solid" | "Liquid" {
  if (unit === "liters" || FERTILIZER_LIQUID_GROUP_KEYS.has(allocationField)) {
    return "Liquid";
  }
  return "Solid";
}

export const EDIT_REGIONAL_FERTILIZER_FIELDS: RegionalEditFertilizerRow[] =
  EDIT_REGIONAL_FERTILIZER_ORDER.map((key) => {
    const row = FERTILIZER_MAP.get(key);
    if (!row) {
      throw new Error(
        `joRegionalAllocationEditCatalog: missing FERTILIZER_FIELD_MAPS entry for ${key}`,
      );
    }
    return {
      key: row.allocationField,
      label: row.label,
      category: fertilizerCategory(row.allocationField, row.unit),
    };
  });

export const EDIT_REGIONAL_SEED_FIELDS: RegionalEditSeedRow[] = [
  { key: "rice_seeds_nsic_rc160_kg", label: "NSIC Rc 160", category: "Inbred" },
  { key: "rice_seeds_nsic_rc222_kg", label: "NSIC Rc 222", category: "Inbred" },
  { key: "jackpot_kg", label: "Jackpot", category: "Hybrid" },
  { key: "us88_kg", label: "US88", category: "Hybrid" },
  { key: "th82_kg", label: "TH82", category: "Hybrid" },
  { key: "rh9000_kg", label: "RH9000", category: "Hybrid" },
  { key: "lumping143_kg", label: "Lumping143", category: "Inbred" },
  { key: "lp296_kg", label: "LP296", category: "Inbred" },
  { key: "mestiso_1_kg", label: "Mestiso 1 (M1)", category: "Hybrid" },
  { key: "mestiso_20_kg", label: "Mestiso 20 (M20)", category: "Hybrid" },
  { key: "mestiso_29_kg", label: "Mestiso 29", category: "Hybrid" },
  { key: "mestiso_55_kg", label: "Mestiso 55", category: "Hybrid" },
  { key: "mestiso_73_kg", label: "Mestiso 73", category: "Hybrid" },
  { key: "mestiso_99_kg", label: "Mestiso 99", category: "Hybrid" },
  { key: "mestiso_103_kg", label: "Mestiso 103", category: "Hybrid" },
  { key: "nsic_rc402_kg", label: "NSIC Rc 402", category: "Inbred" },
  { key: "nsic_rc480_kg", label: "NSIC Rc 480", category: "Inbred" },
  { key: "nsic_rc216_kg", label: "NSIC Rc 216", category: "Inbred" },
  { key: "nsic_rc218_kg", label: "NSIC Rc 218", category: "Inbred" },
  { key: "nsic_rc506_kg", label: "NSIC Rc 506", category: "Inbred" },
  { key: "nsic_rc508_kg", label: "NSIC Rc 508", category: "Inbred" },
  { key: "nsic_rc512_kg", label: "NSIC Rc 512", category: "Inbred" },
  { key: "nsic_rc534_kg", label: "NSIC Rc 534", category: "Inbred" },
  { key: "tubigan_28_kg", label: "Tubigan 28", category: "Inbred" },
  { key: "tubigan_30_kg", label: "Tubigan 30", category: "Inbred" },
  { key: "tubigan_22_kg", label: "Tubigan 22", category: "Inbred" },
  { key: "sahod_ulan_2_kg", label: "Sahod Ulan 2", category: "Inbred" },
  { key: "sahod_ulan_10_kg", label: "Sahod Ulan 10", category: "Inbred" },
  { key: "salinas_6_kg", label: "Salinas 6", category: "Inbred" },
  { key: "salinas_7_kg", label: "Salinas 7", category: "Inbred" },
  { key: "salinas_8_kg", label: "Salinas 8", category: "Inbred" },
  { key: "malagkit_5_kg", label: "Malagkit 5", category: "Inbred" },
  {
    key: "rice_seeds_nsic_rc440_kg",
    label: "NSIC Rc 440",
    category: "Inbred",
  },
  {
    key: "corn_seeds_hybrid_kg",
    label: "Corn Seeds (Hybrid)",
    category: "Hybrid",
  },
  { key: "corn_seeds_opm_kg", label: "Corn Seeds (OPM)", category: "Inbred" },
  { key: "vegetable_seeds_kg", label: "Vegetable Seeds", category: "Inbred" },
];
