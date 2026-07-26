/**
 * data-audit.mjs
 * Connects directly to Supabase and audits rsbsa_submission + rsbsa_farm_parcels
 * for records with genuinely broken data.
 *
 * Run: node scripts/data-audit.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ufhymmbrynufimayalsc.supabase.co";
// Use the service-role key so RLS doesn't hide anything
const SUPABASE_KEY =
  "sb_secret_1CBR4FCYK0HnbG-dYUsS9Q_TUsl4pOS";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ── helpers ──────────────────────────────────────────────────────────────────

const hasDigits = (s) => /\d/.test(s || "");
const looks_like_code_stuck_in_name = (name) => {
  if (!name) return false;
  // Detect patterns like "WickXX-XX-XX-XXX-XXXXXX" (code glued to last name token)
  return /[a-zA-Z]\d{2}-\d{2}-\d{2}-\d{3}-\d{6}/.test(name) ||
         /[a-zA-Z]\d{5,}/.test(name) ||  // letter immediately followed by 5+ digits
         /\d{2}-\d{2}-\d{2}-\d{3}/.test(name); // bare RSBSA code fragment in name
};

// ── fetch all submissions (non-archived) ─────────────────────────────────────

console.log("⏳ Fetching all submissions…");
const { data: submissions, error: subErr } = await supabase
  .from("rsbsa_submission")
  .select(
    `id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "GENDER", "BARANGAY",
     "MUNICIPALITY", status, archived_at, "FFRS_CODE", ownership_category,
     submitted_at, "TOTAL FARM AREA"`,
  )
  .is("archived_at", null);

if (subErr) {
  console.error("❌ Submissions fetch error:", subErr.message);
  process.exit(1);
}

console.log(`✅ Got ${submissions.length} non-archived submissions.\n`);

// ── fetch all parcels ─────────────────────────────────────────────────────────

console.log("⏳ Fetching all farm parcels…");
const { data: parcels, error: parcelErr } = await supabase
  .from("rsbsa_farm_parcels")
  .select(
    `id, submission_id, parcel_number, farm_location_barangay,
     total_farm_area_ha, ownership_type_registered_owner,
     ownership_type_tenant, ownership_type_lessee,
     tenant_land_owner_name, lessee_land_owner_name,
     is_farming, is_current_owner, contract_end_date`,
  );

if (parcelErr) {
  console.error("❌ Parcels fetch error:", parcelErr.message);
  process.exit(1);
}

console.log(`✅ Got ${parcels.length} parcels.\n`);

// ── index parcels by submission_id ────────────────────────────────────────────

const parcelsBySubmission = new Map();
for (const p of parcels) {
  const sid = String(p.submission_id);
  if (!parcelsBySubmission.has(sid)) parcelsBySubmission.set(sid, []);
  parcelsBySubmission.get(sid).push(p);
}

// ── audit each submission ─────────────────────────────────────────────────────

const issues = {
  malformedName:   [],   // RSBSA code / digits stuck inside name field
  negativeArea:    [],   // total_farm_area reported ≤ 0 (suspicious)
  parcelAreaZero:  [],   // parcel has total_farm_area_ha = 0 or null
  parcelNoNumber:  [],   // parcel with no parcel_number
  parcelNoBarangay:[],   // parcel with no farm_location_barangay
  duplicateParcel: [],   // same parcel_number appears > once in same submission
  ownerNoParcels:  [],   // registered owner with zero parcel rows at all (truly unexplained)
  tenantNoOwner:   [],   // tenant/lessee with parcel rows but NO landowner name in any of them
  orphanParcels:   [],   // parcel whose submission_id doesn't exist in submissions
};

// Check orphan parcels (submission deleted but parcels remain)
const submissionIds = new Set(submissions.map((s) => String(s.id)));
for (const p of parcels) {
  if (!submissionIds.has(String(p.submission_id))) {
    issues.orphanParcels.push({
      parcelId: p.id,
      submissionId: p.submission_id,
      parcelNumber: p.parcel_number,
    });
  }
}

for (const sub of submissions) {
  const id = String(sub.id);
  const firstName = String(sub["FIRST NAME"] || "").trim();
  const lastName  = String(sub["LAST NAME"]  || "").trim();
  const midName   = String(sub["MIDDLE NAME"] || "").trim();
  const fullName  = [lastName, firstName, midName].filter(Boolean).join(" ");

  // ── 1. Malformed name (RSBSA code / raw digits baked into name) ────────────
  if (
    looks_like_code_stuck_in_name(lastName) ||
    looks_like_code_stuck_in_name(firstName) ||
    looks_like_code_stuck_in_name(midName)
  ) {
    issues.malformedName.push({
      id,
      name: fullName,
      lastName,
      firstName,
      midName,
      ffrsCode: sub["FFRS_CODE"],
      status: sub.status,
      barangay: sub["BARANGAY"],
    });
  }

  const myParcels = parcelsBySubmission.get(id) || [];
  const activeParcels = myParcels.filter((p) => p.is_current_owner !== false);

  const ownerCat = String(sub.ownership_category || "").toLowerCase().trim();
  const isOwner = ownerCat === "registeredowner" || ownerCat === "registered owner";
  const isTenantOrLessee =
    ownerCat === "tenantlessee" ||
    ownerCat === "tenant" ||
    ownerCat === "lessee";

  // ── 2. Registered owner with ZERO parcel records (completely missing) ───────
  //    (Landlord who transferred land via registry = natural → we skip those.
  //     Here we only flag owners who have NEVER had any parcel row at all.)
  if (isOwner && myParcels.length === 0) {
    issues.ownerNoParcels.push({
      id,
      name: fullName,
      status: sub.status,
      barangay: sub["BARANGAY"],
      totalFarmArea: sub["TOTAL FARM AREA"],
    });
  }

  // ── 3. Tenant/lessee with parcel rows but no landowner name anywhere ────────
  if (isTenantOrLessee && activeParcels.length > 0) {
    const hasAnyOwnerName = activeParcels.some(
      (p) => (p.tenant_land_owner_name || p.lessee_land_owner_name || "").trim() !== "",
    );
    if (!hasAnyOwnerName) {
      issues.tenantNoOwner.push({
        id,
        name: fullName,
        status: sub.status,
        barangay: sub["BARANGAY"],
        parcelCount: activeParcels.length,
      });
    }
  }

  // ── Per-parcel checks ───────────────────────────────────────────────────────
  const seenParcelNumbers = new Set();
  for (const p of myParcels) {
    // 4. Parcel with no parcel_number
    if (!p.parcel_number || String(p.parcel_number).trim() === "") {
      issues.parcelNoNumber.push({ submissionId: id, farmerName: fullName, parcelId: p.id });
    }

    // 5. Parcel with no barangay
    if (!p.farm_location_barangay || String(p.farm_location_barangay).trim() === "") {
      issues.parcelNoBarangay.push({
        submissionId: id,
        farmerName: fullName,
        parcelId: p.id,
        parcelNumber: p.parcel_number,
      });
    }

    // 6. Parcel area = 0 or null (suspicious — a real parcel has some area)
    const area = parseFloat(p.total_farm_area_ha);
    if (!p.total_farm_area_ha || isNaN(area) || area <= 0) {
      issues.parcelAreaZero.push({
        submissionId: id,
        farmerName: fullName,
        parcelId: p.id,
        parcelNumber: p.parcel_number,
        area: p.total_farm_area_ha,
      });
    }

    // 7. Duplicate parcel number within same submission
    const pNum = String(p.parcel_number || "").trim().toUpperCase();
    if (pNum && seenParcelNumbers.has(pNum)) {
      issues.duplicateParcel.push({
        submissionId: id,
        farmerName: fullName,
        parcelNumber: pNum,
      });
    } else {
      seenParcelNumbers.add(pNum);
    }
  }
}

// ── Print report ──────────────────────────────────────────────────────────────

const sep = "─".repeat(70);

const printSection = (title, items, formatter) => {
  console.log(`\n${sep}`);
  console.log(`  ${title}  (${items.length} found)`);
  console.log(sep);
  if (items.length === 0) {
    console.log("  ✅ None — clean!");
    return;
  }
  items.slice(0, 50).forEach((item, i) => console.log(`  ${i + 1}. ${formatter(item)}`));
  if (items.length > 50) console.log(`  … and ${items.length - 50} more`);
};

console.log("\n\n══════════════════════════════════════════════════════════════════════");
console.log("  DATA AUDIT REPORT — RSBSA Submissions");
console.log("══════════════════════════════════════════════════════════════════════");
console.log(`  Total submissions scanned : ${submissions.length}`);
console.log(`  Total parcels scanned     : ${parcels.length}`);

printSection(
  "🔤  MALFORMED NAMES (digits / RSBSA code stuck in name field)",
  issues.malformedName,
  (r) => `[ID: ${r.id}]  "${r.name}"  FFRS: ${r.ffrsCode || "—"}  |  Brgy: ${r.barangay || "—"}  |  Status: ${r.status}`
);

printSection(
  "🚫  ORPHAN PARCELS (parcel references deleted/missing submission)",
  issues.orphanParcels,
  (r) => `Parcel ID: ${r.parcelId}  |  Missing submission ID: ${r.submissionId}  |  Parcel No: ${r.parcelNumber || "—"}`
);

printSection(
  "📦  DUPLICATE PARCEL NUMBERS (same parcel number in one submission)",
  issues.duplicateParcel,
  (r) => `[Sub: ${r.submissionId}]  ${r.farmerName}  →  Parcel No: "${r.parcelNumber}"`
);

printSection(
  "📐  PARCELS WITH ZERO / MISSING AREA",
  issues.parcelAreaZero,
  (r) => `[Sub: ${r.submissionId}]  ${r.farmerName}  →  Parcel ${r.parcelNumber || "?"}  |  Area: ${r.area}`
);

printSection(
  "🔢  PARCELS WITH NO PARCEL NUMBER",
  issues.parcelNoNumber,
  (r) => `[Sub: ${r.submissionId}]  ${r.farmerName}  |  Parcel ID: ${r.parcelId}`
);

printSection(
  "📍  PARCELS WITH NO BARANGAY",
  issues.parcelNoBarangay,
  (r) => `[Sub: ${r.submissionId}]  ${r.farmerName}  →  Parcel ${r.parcelNumber || "?"}  |  Parcel ID: ${r.parcelId}`
);

console.log("\n══════════════════════════════════════════════════════════════════════");
console.log("  SUMMARY");
console.log("══════════════════════════════════════════════════════════════════════");
console.log(`  Malformed names         : ${issues.malformedName.length}`);
console.log(`  Orphan parcels          : ${issues.orphanParcels.length}`);
console.log(`  Duplicate parcel nos    : ${issues.duplicateParcel.length}`);
console.log(`  Parcels zero/null area  : ${issues.parcelAreaZero.length}`);
console.log(`  Parcels no parcel no    : ${issues.parcelNoNumber.length}`);
console.log(`  Parcels no barangay     : ${issues.parcelNoBarangay.length}`);
console.log("");
