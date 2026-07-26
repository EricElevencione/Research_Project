/**
 * data-audit-detail.mjs
 * Digs into the orphan parcels and duplicates found in the first audit
 * to show what actually happened (deleted? archived? test data?).
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ufhymmbrynufimayalsc.supabase.co";
const SUPABASE_KEY = "sb_secret_1CBR4FCYK0HnbG-dYUsS9Q_TUsl4pOS";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

const sep = "─".repeat(72);

// ── 1. Check orphan submissions (including archived) ─────────────────────────
// Maybe they were archived — let's look for them with archived_at included

const orphanSubmissionIds = [58, 79, 25, 40, 71, 37, 15, 55, 81, 84];
const orphanParcelDetails = [
  { parcelId: 79,  subId: 58,  parcelNum: "Parcel-54-1" },
  { parcelId: 108, subId: 79,  parcelNum: "Parcel-79-1" },
  { parcelId: 28,  subId: 25,  parcelNum: "Parcel-13-1" },
  { parcelId: 49,  subId: 40,  parcelNum: "Parcel-33-2" },
  { parcelId: 92,  subId: 71,  parcelNum: "Parcel-70-1" },
  { parcelId: 93,  subId: 71,  parcelNum: "Parcel-70-2" },
  { parcelId: 46,  subId: 37,  parcelNum: "Parcel-34-2" },
  { parcelId: 16,  subId: 15,  parcelNum: "Parcel-5-1"  },
  { parcelId: 76,  subId: 55,  parcelNum: "Parcel-54-1" },
  { parcelId: 112, subId: 81,  parcelNum: "Parcel-81-1" },
  { parcelId: 116, subId: 84,  parcelNum: "Parcel-84-1" },
];

console.log("⏳ Looking up orphan submission IDs (including archived)…");
const { data: orphanSubs, error: oErr } = await supabase
  .from("rsbsa_submission")
  .select(`id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", status, archived_at, archive_reason, "BARANGAY"`)
  .in("id", orphanSubmissionIds);

if (oErr) console.error("Error:", oErr.message);

console.log(`\n${sep}`);
console.log("  🚫  ORPHAN PARCELS — What happened to those submissions?");
console.log(sep);

const orphanSubMap = new Map((orphanSubs || []).map((s) => [s.id, s]));

for (const op of orphanParcelDetails) {
  const sub = orphanSubMap.get(op.subId);
  if (sub) {
    const name = [sub["LAST NAME"], sub["FIRST NAME"], sub["MIDDLE NAME"]].filter(Boolean).join(", ");
    const archived = sub.archived_at
      ? `ARCHIVED on ${new Date(sub.archived_at).toLocaleDateString()}  (reason: ${sub.archive_reason || "—"})`
      : "NOT archived";
    console.log(
      `  Parcel ID ${op.parcelId} (${op.parcelNum})  →  Sub ${op.subId}: "${name}"  |  ${archived}  |  Status: ${sub.status}`
    );
  } else {
    console.log(
      `  Parcel ID ${op.parcelId} (${op.parcelNum})  →  Sub ${op.subId}: ⚠️  SUBMISSION DOES NOT EXIST AT ALL (truly deleted)`
    );
  }
}

// ── 2. Duplicate parcel details ──────────────────────────────────────────────

console.log(`\n${sep}`);
console.log("  📦  DUPLICATE PARCEL NUMBERS — Full details");
console.log(sep);

const { data: dupParcels7, error: dup7Err } = await supabase
  .from("rsbsa_farm_parcels")
  .select("id, parcel_number, total_farm_area_ha, farm_location_barangay, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, is_current_owner, created_at")
  .eq("submission_id", 7);

const { data: dupParcels46, error: dup46Err } = await supabase
  .from("rsbsa_farm_parcels")
  .select("id, parcel_number, total_farm_area_ha, farm_location_barangay, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee, is_current_owner, created_at")
  .eq("submission_id", 46);

console.log("\n  Ashley Alexandra Stokes (Sub 7) — all parcels:");
(dupParcels7 || []).forEach((p) => {
  const role = p.ownership_type_registered_owner ? "Owner" : p.ownership_type_tenant ? "Tenant" : p.ownership_type_lessee ? "Lessee" : "?";
  console.log(`    ID: ${p.id}  |  "${p.parcel_number}"  |  ${p.total_farm_area_ha} ha  |  ${p.farm_location_barangay}  |  Role: ${role}  |  is_current_owner: ${p.is_current_owner}  |  Created: ${p.created_at?.slice(0,10)}`);
});

console.log("\n  Guevara Brian Lenorio (Sub 46) — all parcels:");
(dupParcels46 || []).forEach((p) => {
  const role = p.ownership_type_registered_owner ? "Owner" : p.ownership_type_tenant ? "Tenant" : p.ownership_type_lessee ? "Lessee" : "?";
  console.log(`    ID: ${p.id}  |  "${p.parcel_number}"  |  ${p.total_farm_area_ha} ha  |  ${p.farm_location_barangay}  |  Role: ${role}  |  is_current_owner: ${p.is_current_owner}  |  Created: ${p.created_at?.slice(0,10)}`);
});

// ── 3. Check the specific farmer from the user's example ─────────────────────

console.log(`\n${sep}`);
console.log("  🔍  Searching for 'Kenny' / 'Wick' / the example farmer…");
console.log(sep);

const { data: kennySearch } = await supabase
  .from("rsbsa_submission")
  .select(`id, "LAST NAME", "FIRST NAME", "MIDDLE NAME", "FFRS_CODE", status, archived_at, "BARANGAY"`)
  .or('"LAST NAME".ilike.%wick%,"FIRST NAME".ilike.%kenny%,"FFRS_CODE".ilike.%588711%');

(kennySearch || []).forEach((s) => {
  const name = [s["LAST NAME"], s["FIRST NAME"], s["MIDDLE NAME"]].filter(Boolean).join(", ");
  const archived = s.archived_at ? `ARCHIVED ${new Date(s.archived_at).toLocaleDateString()}` : "not archived";
  console.log(`  ID: ${s.id}  |  "${name}"  |  FFRS: ${s["FFRS_CODE"] || "—"}  |  Brgy: ${s["BARANGAY"] || "—"}  |  Status: ${s.status}  |  ${archived}`);
});
if (!kennySearch?.length) console.log("  (no matches found)");

console.log("\n✅ Detail audit complete.\n");
