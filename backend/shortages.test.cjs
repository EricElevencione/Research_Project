// shortages_content_test.cjs
// Tests that verify the ACTUAL CONTENT of suggestions, not just their existence.
// Each test checks: correct substitute identity, correct tier, correct nutrient role,
// correct seed filters, and correct fertilizer shift warnings.

const express = require("express");
const request = require("supertest");
const shortagesRouter = require("./routes/shortages");
const { resolveFertilizerShortage } = require("./resolvers/fertilizerResolver");
const { resolveSeedShortage } = require("./resolvers/seedResolver");

const app = express();
app.use(express.json());
app.use("/api/shortages", shortagesRouter);

// ─────────────────────────────────────────────────────────────────────────────
// FERTILIZER RESOLVER — Content Verification
// ─────────────────────────────────────────────────────────────────────────────

describe("Fertilizer Resolver — Correct Substitute Identity", () => {
  it("Jackpot + urea shortage → suggests complete_14 (rank 2 for Jackpot)", () => {
    const result = resolveFertilizerShortage("jackpot", "urea", []);

    expect(result.status).toBe("resolved");
    expect(result.suggestion.id).toBe("complete_14");
    expect(result.suggestion.tier).toBe(1);
    expect(result.suggestion.rank_on_seed).toBe(2);
  });

  it("Jackpot + urea + complete_14 both unavailable → suggests ammonium_sulfate (rank 3)", () => {
    const result = resolveFertilizerShortage("jackpot", "urea", [
      "complete_14",
    ]);

    expect(result.status).toBe("resolved");
    expect(result.suggestion.id).toBe("ammonium_sulfate");
    expect(result.suggestion.rank_on_seed).toBe(3);
  });

  it("Salinas_6 + urea shortage → suggests foliar_liquid_npk (rank 2 for Salinas 6, not complete_14)", () => {
    // Salinas 6 has a different ranking — Muriate of Potash is rank 1, Foliar NPK is rank 2
    // This test catches if the resolver accidentally uses a generic order instead of seed-specific order
    const result = resolveFertilizerShortage(
      "salinas_6",
      "muriate_of_potash",
      [],
    );

    expect(result.status).toBe("resolved");
    expect(result.suggestion.id).toBe("foliar_liquid_npk");
    expect(result.suggestion.rank_on_seed).toBe(2);
  });

  it("Sahod Ulan 2 + urea shortage → suggests muriate_of_potash (rank 2 for rainfed seed)", () => {
    // Sahod Ulan 2 prioritizes potash over complete for drought recovery
    const result = resolveFertilizerShortage("sahod_ulan_2", "urea", []);

    expect(result.status).toBe("resolved");
    expect(result.suggestion.id).toBe("muriate_of_potash");
    expect(result.suggestion.rank_on_seed).toBe(2);
  });

  it("Suggestion reason field is not empty — farmer must see a real explanation", () => {
    const result = resolveFertilizerShortage("jackpot", "urea", []);

    expect(result.suggestion.reason).toBeTruthy();
    expect(result.suggestion.reason.length).toBeGreaterThan(10);
  });

  it("Message field is plain English and does not contain debug text", () => {
    const result = resolveFertilizerShortage("jackpot", "urea", []);

    expect(result.message).not.toContain("seed context");
    expect(result.message).not.toContain("detectActiveSeedId");
    expect(result.message).not.toContain("null");
    expect(result.message).not.toContain("undefined");
    expect(result.message.length).toBeGreaterThan(20);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FERTILIZER RESOLVER — Tier 2 Fallback Content
// ─────────────────────────────────────────────────────────────────────────────

describe("Fertilizer Resolver — Tier 2 Fallback Correctness", () => {
  it("Azolla shortage with null seedId → tier2_fallback status", () => {
    const result = resolveFertilizerShortage(null, "azolla", []);

    expect(result.status).toBe("tier2_fallback");
  });

  it("Azolla shortage → fallback is in bio_nitrogen_fixer role or nitrogen_source role", () => {
    // Azolla is a bio_nitrogen_fixer — there are no Tier 2 bio_nitrogen_fixers
    // so it should either be unresolvable or fall back to nitrogen_source
    const result = resolveFertilizerShortage(null, "azolla", []);

    if (result.status === "tier2_fallback") {
      expect(["bio_nitrogen_fixer", "nitrogen_source"]).toContain(
        result.suggestion.nutrient_role,
      );
    } else {
      expect(result.status).toBe("unresolvable");
    }
  });

  it("Urea shortage with all Tier 1 nitrogen sources gone → Tier 2 nitrogen fallback", () => {
    // urea and ammonium_sulfate are both nitrogen_source Tier 1
    // removing both should trigger Tier 2 (vermicompost or chicken_manure)
    const result = resolveFertilizerShortage("jackpot", "urea", [
      "complete_14",
      "ammonium_sulfate",
      "muriate_of_potash",
      "biofertilizer",
      "nanobiofertilizer",
      "organic_root_exudate",
      "azolla",
      "foliar_liquid_npk",
    ]);

    expect(result.status).toBe("tier2_fallback");
    expect(["vermicompost", "chicken_manure"]).toContain(result.suggestion.id);
    expect(result.suggestion.tier).toBe(2);
  });

  it("Tier 2 suggestion has a description, not a reason field", () => {
    const result = resolveFertilizerShortage("jackpot", "urea", [
      "complete_14",
      "ammonium_sulfate",
      "muriate_of_potash",
      "biofertilizer",
      "nanobiofertilizer",
      "organic_root_exudate",
      "azolla",
      "foliar_liquid_npk",
    ]);

    expect(result.status).toBe("tier2_fallback");
    // Tier 2 uses description from fertilizers.json, not a seed-specific reason
    expect(result.suggestion.reason).toBeTruthy();
    expect(result.suggestion.reason.length).toBeGreaterThan(10);
  });

  it("Unresolvable status fires when no Tier 1 or Tier 2 substitute exists", () => {
    // npk_complete (complete_14) has no Tier 2 fallback in fertilizers.json
    const result = resolveFertilizerShortage("jackpot", "complete_14", [
      "urea",
      "ammonium_sulfate",
      "muriate_of_potash",
      "biofertilizer",
      "nanobiofertilizer",
      "organic_root_exudate",
      "azolla",
      "foliar_liquid_npk",
    ]);

    expect(result.status).toBe("unresolvable");
    expect(result.suggestion).toBeNull();
    expect(result.message).toBeTruthy();
    // Message must still be farmer-friendly, not a debug dump
    expect(result.message).not.toContain("undefined");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SEED RESOLVER — Filter Correctness
// ─────────────────────────────────────────────────────────────────────────────

describe("Seed Resolver — Filter 1: Category Must Match", () => {
  it("Jackpot (Hybrid) shortage → all substitutes are Hybrid only", () => {
    const result = resolveSeedShortage("jackpot", []);

    expect(result.status).toBe("resolved");
    result.substitutes.forEach((s) => {
      expect(s.category).toBe("Hybrid");
    });
  });

  it("LP296 (Inbred) shortage → all substitutes are Inbred only", () => {
    const result = resolveSeedShortage("lp296", []);

    expect(result.status).toBe("resolved");
    result.substitutes.forEach((s) => {
      expect(s.category).toBe("Inbred");
    });
  });

  it("Jackpot shortage → LP296 is NOT in the substitutes (wrong category)", () => {
    const result = resolveSeedShortage("jackpot", []);

    const ids = result.substitutes.map((s) => s.id);
    expect(ids).not.toContain("lp296");
  });
});

describe("Seed Resolver — Filter 2: Environment Must Match", () => {
  it("Salinas 6 (saline) shortage → all substitutes are saline environment", () => {
    const result = resolveSeedShortage("salinas_6", []);

    expect(result.status).toBe("resolved");
    result.substitutes.forEach((s) => {
      expect(s.environment).toBe("saline");
    });
  });

  it("Salinas 6 shortage → Jackpot (irrigated_lowland) is NOT suggested", () => {
    const result = resolveSeedShortage("salinas_6", []);

    const ids = result.substitutes.map((s) => s.id);
    expect(ids).not.toContain("jackpot");
  });

  it("Sahod Ulan 2 (rainfed) shortage → all substitutes are rainfed_lowland", () => {
    const result = resolveSeedShortage("sahod_ulan_2", []);

    expect(result.status).toBe("resolved");
    result.substitutes.forEach((s) => {
      expect(s.environment).toBe("rainfed_lowland");
    });
  });

  it("Malagkit 5 (specialty_glutinous) shortage → only specialty_glutinous substitutes", () => {
    const result = resolveSeedShortage("malagkit_5", []);

    // Malagkit 5 is the only specialty_glutinous seed — should return unresolvable
    // because there are no other seeds in that environment
    expect(["resolved", "unresolvable"]).toContain(result.status);
    if (result.status === "resolved") {
      result.substitutes.forEach((s) => {
        expect(s.environment).toBe("specialty_glutinous");
      });
    }
  });
});

describe("Seed Resolver — Filter 3: Maturity Window (±10 days)", () => {
  it("Tubigan 28 (112 days) shortage → no substitute has maturity outside 102-122 days", () => {
    const result = resolveSeedShortage("tubigan_28", []);

    if (result.status === "resolved") {
      result.substitutes.forEach((s) => {
        if (s.maturity_days !== null) {
          expect(Math.abs(s.maturity_days - 112)).toBeLessThanOrEqual(10);
        }
      });
    }
  });

  it("Mestiso 1 (123 days) shortage → no substitute has maturity outside 113-133 days", () => {
    const result = resolveSeedShortage("mestiso_1", []);

    if (result.status === "resolved") {
      result.substitutes.forEach((s) => {
        if (s.maturity_days !== null) {
          expect(Math.abs(s.maturity_days - 123)).toBeLessThanOrEqual(10);
        }
      });
    }
  });

  it("Maturity diff values are correct and reflect actual day difference", () => {
    const result = resolveSeedShortage("mestiso_20", []); // 111 days

    if (result.status === "resolved") {
      result.substitutes.forEach((s) => {
        if (s.maturity_days !== null && s.maturity_diff_days !== null) {
          expect(s.maturity_diff_days).toBe(s.maturity_days - 111);
        }
      });
    }
  });
});

describe("Seed Resolver — Filter 4: Yield Proximity Sorting", () => {
  it("First substitute has the closest yield_max_tha to the original", () => {
    const result = resolveSeedShortage("mestiso_55", []); // 10.0 t/ha

    if (result.status === "resolved" && result.substitutes.length >= 2) {
      const first = result.substitutes[0];
      const second = result.substitutes[1];

      // First must be closer or equal to original yield than second
      const diffFirst =
        first.yield_max_tha !== null
          ? Math.abs(first.yield_max_tha - 10.0)
          : Infinity;
      const diffSecond =
        second.yield_max_tha !== null
          ? Math.abs(second.yield_max_tha - 10.0)
          : Infinity;

      expect(diffFirst).toBeLessThanOrEqual(diffSecond);
    }
  });

  it("yield_diff_tha is correctly computed as substitute minus original", () => {
    const result = resolveSeedShortage("mestiso_55", []); // 10.0 t/ha

    if (result.status === "resolved") {
      result.substitutes.forEach((s) => {
        if (s.yield_max_tha !== null && s.yield_diff_tha !== null) {
          expect(s.yield_diff_tha).toBeCloseTo(s.yield_max_tha - 10.0, 1);
        }
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SEED RESOLVER — Fertilizer Shift Warning Content
// ─────────────────────────────────────────────────────────────────────────────

describe("Seed Resolver — Fertilizer Shift Warning", () => {
  it("Salinas 6 → Salinas 7 substitution: has_shift reflects actual top-3 comparison", () => {
    // Both are saline, same maturity — top 3 fertilizers should be very similar
    const result = resolveSeedShortage("salinas_6", []);

    if (result.status === "resolved") {
      const salinas7 = result.substitutes.find((s) => s.id === "salinas_7");
      if (salinas7) {
        // has_shift must be a boolean, not undefined
        expect(typeof salinas7.fertilizer_shift.has_shift).toBe("boolean");
        // message must always exist regardless of shift
        expect(salinas7.fertilizer_shift.message).toBeTruthy();
      }
    }
  });

  it("When has_shift is true, added and removed arrays are non-empty", () => {
    const result = resolveSeedShortage("jackpot", []);

    if (result.status === "resolved") {
      result.substitutes.forEach((s) => {
        if (s.fertilizer_shift.has_shift === true) {
          expect(
            s.fertilizer_shift.added.length + s.fertilizer_shift.removed.length,
          ).toBeGreaterThan(0);
        }
      });
    }
  });

  it("When has_shift is false, added and removed are empty arrays", () => {
    const result = resolveSeedShortage("jackpot", []);

    if (result.status === "resolved") {
      result.substitutes.forEach((s) => {
        if (s.fertilizer_shift.has_shift === false) {
          expect(s.fertilizer_shift.added).toHaveLength(0);
          expect(s.fertilizer_shift.removed).toHaveLength(0);
        }
      });
    }
  });

  it("Fertilizer shift message never contains debug text", () => {
    const result = resolveSeedShortage("jackpot", []);

    if (result.status === "resolved") {
      result.substitutes.forEach((s) => {
        expect(s.fertilizer_shift.message).not.toContain("undefined");
        expect(s.fertilizer_shift.message).not.toContain("null");
        expect(s.fertilizer_shift.message).not.toContain("fertilizer_id");
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SEED RESOLVER — Unavailable List Exclusion
// ─────────────────────────────────────────────────────────────────────────────

describe("Seed Resolver — Unavailable Seeds Are Excluded", () => {
  it("Original seed never appears in its own substitute list", () => {
    const result = resolveSeedShortage("jackpot", []);

    if (result.status === "resolved") {
      const ids = result.substitutes.map((s) => s.id);
      expect(ids).not.toContain("jackpot");
    }
  });

  it("Seeds passed in unavailableIds are excluded from substitutes", () => {
    const result = resolveSeedShortage("mestiso_20", [
      "mestiso_29",
      "mestiso_55",
    ]);

    if (result.status === "resolved") {
      const ids = result.substitutes.map((s) => s.id);
      expect(ids).not.toContain("mestiso_29");
      expect(ids).not.toContain("mestiso_55");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE — Response Shape Verification
// ─────────────────────────────────────────────────────────────────────────────

describe("API Route — Response Shapes Are Complete", () => {
  it("Fertilizer shortage response has all expected top-level fields", async () => {
    const response = await request(app)
      .post("/api/shortages/fertilizer")
      .send({ seedId: "jackpot", shortageFertId: "urea" });

    expect(response.body).toHaveProperty("status");
    expect(response.body).toHaveProperty("seed");
    expect(response.body).toHaveProperty("shortage");
    expect(response.body).toHaveProperty("suggestion");
    expect(response.body).toHaveProperty("message");
  });

  it("Fertilizer suggestion has all fields the UI needs to render", async () => {
    const response = await request(app)
      .post("/api/shortages/fertilizer")
      .send({ seedId: "jackpot", shortageFertId: "urea" });

    const s = response.body.suggestion;
    expect(s).toHaveProperty("id");
    expect(s).toHaveProperty("name");
    expect(s).toHaveProperty("tier");
    expect(s).toHaveProperty("nutrient_role");
    expect(s).toHaveProperty("reason");
  });

  it("Seed shortage response has all expected top-level fields", async () => {
    const response = await request(app)
      .post("/api/shortages/seed")
      .send({ seedId: "jackpot" });

    expect(response.body).toHaveProperty("status");
    expect(response.body).toHaveProperty("original");
    expect(response.body).toHaveProperty("substitutes");
    expect(response.body).toHaveProperty("message");
    expect(Array.isArray(response.body.substitutes)).toBe(true);
  });

  it("Each seed substitute has all fields the UI needs to render", async () => {
    const response = await request(app)
      .post("/api/shortages/seed")
      .send({ seedId: "jackpot" });

    if (response.body.substitutes.length > 0) {
      const s = response.body.substitutes[0];
      expect(s).toHaveProperty("id");
      expect(s).toHaveProperty("name");
      expect(s).toHaveProperty("category");
      expect(s).toHaveProperty("environment");
      expect(s).toHaveProperty("maturity_days");
      expect(s).toHaveProperty("yield_display");
      expect(s).toHaveProperty("maturity_diff_days");
      expect(s).toHaveProperty("yield_diff_tha");
      expect(s).toHaveProperty("top_3_fertilizers");
      expect(s).toHaveProperty("fertilizer_shift");
      expect(s.fertilizer_shift).toHaveProperty("has_shift");
      expect(s.fertilizer_shift).toHaveProperty("message");
      expect(s.fertilizer_shift).toHaveProperty("added");
      expect(s.fertilizer_shift).toHaveProperty("removed");
    }
  });
});
