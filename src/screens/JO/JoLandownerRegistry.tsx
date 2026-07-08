import { supabase } from "../../supabase";
import React, { useEffect, useMemo, useState } from "react";
import {
  getRsbsaSubmissions,
  getRsbsaSubmissionById,
  getFarmParcels,
  updateRsbsaSubmission,
} from "../../api";
import { LandownerProfileDisplay } from "../../components/FarmerProfile/LandownerProfileDisplay";
import {
  printRsbsaFormById,
  printRsbsaFormsByIds,
} from "../../utils/rsbsaPrint";
import { getParcelOccupationType } from "../../utils/parcelOccupationType";
import "../../assets/css/jo css/JoLandownerStyle.css";
import JOSidebar from "../../components/layout/JOSidebar";
import "../../assets/css/jo css/FarmerDetailModal.css";
import {
  getAuditLogger,
  AuditModule,
} from "../../components/Audit/auditLogger";
import { getCurrentUserForAudit } from "../../components/Audit/getCurrentUserForAudit";

// ─────────────────────────────────────────────
// LANDOWNER REGISTRY
// Shows only registered landowners. Purpose:
//   • See who owns land in Dumangas
//   • See who is working each parcel (tenant / lessee / owner-farmed)
//   • Know the full land picture per landowner in one modal
//   • Flag unlinked occupant names (text-only, no FFRS link)
//   • Export and print RSBSA forms
// Only Definition A landowners: OWNERSHIP_TYPE_REGISTERED_OWNER = true
// ─────────────────────────────────────────────

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface LandownerRecord {
  id: string;
  referenceNumber: string;
  landownerName: string;
  landownerAddress: string;
  farmLocation: string;
  barangay: string;
  parcelArea: string;
  parcelCount: number;
  age: number | null;
  dateSubmitted: string;
  status: string;
  // Relationship counts — fetched separately via supabase
  tenantCount: number;
  lesseeCount: number;
  currentTenantNames: string[];
  currentLesseeNames: string[];
  archivedAt?: string | null;
  archiveReason?: string | null;
  hasNoLand?: boolean; // Flagged: no current land ownership
}

interface LandownerSummaryRow {
  id: string;
  referenceNumber: string;
  landownerName: string;
  barangay: string;
  barangayCount: number;
  totalAreaHa: number;
  parcelCount: number;
  tenantCount: number;
  lesseeCount: number;
  currentTenantNames: string[];
  currentLesseeNames: string[];
  dateSubmitted: string;
  status: string;
  hasNoLand?: boolean; // Flagged: no current land ownership
}

// One parcel in the modal — combined view of ownership + occupation
interface OccupiedParcel {
  id: string;
  parcelNumber: string;
  farmLocationBarangay: string;
  farmLocationMunicipality: string;
  totalFarmAreaHa: number;
  // Occupation
  occupationType:
    | "land-owner"
    | "owner-farmed"
    | "tenant"
    | "lessee"
    | "tenant+lessee";
  occupants: OccupantInfo[];
  // Parcel attributes
  agrarianReformBeneficiary: string;
  withinAncestralDomain: string;
  ownershipDocumentNo: string;
  // GIS shape from land_plots, matched by ffrs_id/name + barangay + parcel
  // number (no hard FK between rsbsa_farm_parcels and land_plots — see
  // matching logic in fetchLandownerDetails). Null if no plot matched yet.
  geometry: any | null;
}

interface OccupantInfo {
  submissionId: string;
  name: string;
  ffrsCode: string;
  role: "tenant" | "lessee" | "tenant+lessee";
  isLinked: boolean; // false = text-only name with no FFRS
}

interface LandownerDetail {
  id: string;
  referenceNumber: string;
  dateSubmitted: string;
  recordStatus: string;
  birthdate: string | null;
  archivedAt: string | null;
  archiveReason: string | null;
  landownerName: string;
  landownerAddress: string;
  age: number | string;
  gender: string;
  mainLivelihood?: string;
  farmingActivities?: string[];
  statusChangeReason?: string | null;
  parcels: OccupiedParcel[];
}

interface EditFormData {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  age?: string;
  barangay?: string;
  municipality?: string;
}

interface LandownerParcelRow {
  id: string;
  landownerId: string;
  landownerName: string;
  referenceNumber: string;
  status: string;
  parcelNumber: string;
  barangay: string;
  parcelArea: number | string;
}

type SortKey =
  | "landownerName"
  | "barangay"
  | "totalAreaHa"
  | "parcelCount"
  | "occupantCount"
  | "dateSubmitted";

type SortDirection = "asc" | "desc";

const DEFAULT_SORT_CONFIG: { key: SortKey; direction: SortDirection } = {
  key: "dateSubmitted",
  direction: "desc",
};
const getDefaultSortDirection = (key: SortKey): SortDirection => {
  if (key === "landownerName" || key === "barangay") return "asc";
  if (key === "dateSubmitted") return "desc";
  return "desc";
};

// ─── Component ────────────────────────────────────────────────────────────────

const JoLandownerRegistry: React.FC = () => {
  const barangays = [
    "Aurora-Del Pilar",
    "Bacay",
    "Bacong",
    "Balabag",
    "Balud",
    "Bantud",
    "Bantud Fabrica",
    "Baras",
    "Barasan",
    "Basa-Mabini Bonifacio",
    "Bolilao",
    "Buenaflor Embarkadero",
    "Burgos-Regidor",
    "Calao",
    "Cali",
    "Cansilayan",
    "Capaliz",
    "Cayos",
    "Compayan",
    "Dacutan",
    "Ermita",
    "Ilaya 1st",
    "Ilaya 2nd",
    "Ilaya 3rd",
    "Jardin",
    "Lacturan",
    "Lopez Jaena - Rizal",
    "Managuit",
    "Maquina",
    "Nanding Lopez",
    "Pagdugue",
    "Paloc Bigque",
    "Paloc Sool",
    "Patlad",
    "Pd Monfort North",
    "Pd Monfort South",
    "Pulao",
    "Rosario",
    "Sapao",
    "Sulangan",
    "Tabucan",
    "Talusan",
    "Tambobo",
    "Tamboilan",
    "Victorias",
  ].sort();

  const [landownerRecords, setLandownerRecords] = useState<LandownerRecord[]>(
    [],
  );
  const [parcelRows, setParcelRows] = useState<LandownerParcelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [selectedBarangay, setSelectedBarangay] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedLandowner, setSelectedLandowner] =
    useState<LandownerDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [editingRecord, setEditingRecord] = useState<LandownerRecord | null>(
    null,
  );
  const [editFormData, setEditFormData] = useState<EditFormData>({});
  const [editError, setEditError] = useState<string | null>(null);

  const [updateNotification, setUpdateNotification] = useState<{
    show: boolean;
    type: "success" | "error";
    message: string;
  }>({ show: false, type: "success", message: "" });

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [sortConfigs, setSortConfigs] = useState<
    Array<{ key: SortKey; direction: SortDirection }>
  >([{ ...DEFAULT_SORT_CONFIG }]);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(
    new Set(),
  );
  const [showBulkExportMenu, setShowBulkExportMenu] = useState(false);
  const [isModalPrinting, setIsModalPrinting] = useState(false);
  const [isBulkPrinting, setIsBulkPrinting] = useState(false);
  const [showPrintLandownerModal, setShowPrintLandownerModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const showUpdateNotification = (
    message: string,
    type: "success" | "error",
  ) => {
    setUpdateNotification({ show: true, type, message });
    setTimeout(
      () => setUpdateNotification((p) => ({ ...p, show: false })),
      3200,
    );
  };

  const formatRecordStatus = (status?: string | null) => {
    const n = String(status || "")
      .toLowerCase()
      .trim();
    const active = new Set([
      "submitted",
      "approved",
      "active",
      "active farmer",
    ]);
    const inactive = new Set([
      "not submitted",
      "not_active",
      "not active",
      "draft",
      "pending",
      "not approved",
      "inactive",
    ]);
    if (active.has(n)) return "Active";
    if (inactive.has(n)) return "Inactive";
    return status || "Unknown";
  };

  // Plain "2 Tenants, 1 Lessee" style count — no inferred label, just what's
  // on record. Shared between the table cell and the print export so both
  // stay in sync.
  const getTenantLesseeSummary = (record: {
    tenantCount: number;
    lesseeCount: number;
    currentTenantNames: string[];
    currentLesseeNames: string[];
  }) => {
    const parts: string[] = [];
    if (record.tenantCount > 0) {
      parts.push(
        `${record.tenantCount} Tenant${record.tenantCount === 1 ? "" : "s"}`,
      );
    }
    if (record.lesseeCount > 0) {
      parts.push(
        `${record.lesseeCount} Lessee${record.lesseeCount === 1 ? "" : "s"}`,
      );
    }
    const countText =
      parts.length > 0 ? parts.join(", ") : "No tenant/lessee on record";
    const names = [...record.currentTenantNames, ...record.currentLesseeNames];
    return { countText, names };
  };

  const getInitials = (name: string) => {
    const parts = (name || "")
      .replace(/,/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "LO";
  };

  const normalizeAgeValue = (
    ageValue: unknown,
    birthdate?: string | null,
  ): number | null => {
    if (
      ageValue !== null &&
      ageValue !== undefined &&
      String(ageValue).trim() !== ""
    ) {
      const p = Number(ageValue);
      if (Number.isFinite(p) && p >= 0) return Math.floor(p);
    }
    if (!birthdate) return null;
    const bd = new Date(birthdate);
    if (Number.isNaN(bd.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - bd.getFullYear();
    const md = today.getMonth() - bd.getMonth();
    if (md < 0 || (md === 0 && today.getDate() < bd.getDate())) age--;
    return age >= 0 ? age : null;
  };

  const parseName = (fullName: string) => {
    if (!fullName) return { lastName: "", firstName: "", middleName: "" };
    const parts = fullName
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0)
      return { lastName: "", firstName: "", middleName: "" };
    if (parts.length === 1)
      return { lastName: parts[0], firstName: "", middleName: "" };
    const firstMiddle = (parts[1] || "")
      .split(" ")
      .map((p) => p.trim())
      .filter(Boolean);
    return {
      lastName: parts[0],
      firstName: firstMiddle[0] || "",
      middleName: firstMiddle.slice(1).join(" ") || "",
    };
  };

  // ─── Fetch main list ────────────────────────────────────────────────────────

  const fetchLandownerRecords = async () => {
    try {
      setLoading(true);

      // Step 1: Get all submissions, filter to registered owners
      const response = await getRsbsaSubmissions();
      if (response.error) throw new Error(response.error);

      const allRecords = (response.data || []) as any[];
      const ownerRecords = allRecords.filter((item: any) => {
        const flags = item.ownershipType;
        return (
          flags?.registeredOwner === true ||
          flags?.category === "registeredOwner"
        );
      });

      // Name lookup covering EVERY submission (owners, tenants, lessees
      // alike) — used to resolve tenant/lessee names below without an
      // extra fetch.
      const nameById = new Map<number, string>();
      allRecords.forEach((item: any) => {
        const id = Number(item.id);
        if (Number.isFinite(id)) nameById.set(id, item.farmerName || "—");
      });

      // Step 2: Fetch ALL tenant/lessee parcel links in one query
      // This avoids N+1 calls — we get every parcel that references an owner.
      // is_current_owner is included and filtered below so a tenant/lessee
      // who has since been replaced doesn't keep counting as "current."
      const { data: tlParcels, error: tlError } = await supabase
        .from("rsbsa_farm_parcels")
        .select(
          "submission_id, parcel_number, tenant_land_owner_id, lessee_land_owner_id, ownership_type_tenant, ownership_type_lessee, is_current_owner",
        )
        .or(
          "tenant_land_owner_id.not.is.null,lessee_land_owner_id.not.is.null",
        );

      if (tlError)
        console.warn(
          "Tenant/lessee count fetch error (non-blocking):",
          tlError.message,
        );

      // Step 3: Build count maps — ownerId → unique CURRENT tenant submission IDs
      const tenantsByOwner = new Map<number, Set<number>>();
      const lesseesByOwner = new Map<number, Set<number>>();
      const tenantNamesByOwner = new Map<number, Set<string>>();
      const lesseeNamesByOwner = new Map<number, Set<string>>();

      (tlParcels || []).forEach((p: any) => {
        // Skip replaced/deactivated tenant-lessee links — only the
        // current holder should count.
        if (p.is_current_owner === false) return;

        const tenantOwnerId = Number(p.tenant_land_owner_id);
        const lesseeOwnerId = Number(p.lessee_land_owner_id);
        const farmerId = Number(p.submission_id);

        if (
          p.ownership_type_tenant &&
          Number.isFinite(tenantOwnerId) &&
          Number.isFinite(farmerId)
        ) {
          if (!tenantsByOwner.has(tenantOwnerId))
            tenantsByOwner.set(tenantOwnerId, new Set());
          tenantsByOwner.get(tenantOwnerId)!.add(farmerId);
          if (!tenantNamesByOwner.has(tenantOwnerId))
            tenantNamesByOwner.set(tenantOwnerId, new Set());
          tenantNamesByOwner
            .get(tenantOwnerId)!
            .add(nameById.get(farmerId) || `Farmer #${farmerId}`);
        }
        if (
          p.ownership_type_lessee &&
          Number.isFinite(lesseeOwnerId) &&
          Number.isFinite(farmerId)
        ) {
          if (!lesseesByOwner.has(lesseeOwnerId))
            lesseesByOwner.set(lesseeOwnerId, new Set());
          lesseesByOwner.get(lesseeOwnerId)!.add(farmerId);
          if (!lesseeNamesByOwner.has(lesseeOwnerId))
            lesseeNamesByOwner.set(lesseeOwnerId, new Set());
          lesseeNamesByOwner
            .get(lesseeOwnerId)!
            .add(nameById.get(farmerId) || `Farmer #${farmerId}`);
        }
      });

      // Step 4: Build the display records
      const formatted: LandownerRecord[] = ownerRecords.map((item: any) => {
        const ownerId = Number(item.id);
        const landParcel = String(item.landParcel ?? "—");

        const parcelArea = (() => {
          const tokens = String(
            item.totalFarmArea ?? item.parcelArea ?? "",
          ).match(/-?\d+(?:\.\d+)?/g);
          if (tokens && tokens.length > 0) {
            const total = tokens.reduce((s: number, t: string) => {
              const n = Number(t);
              return s + (Number.isFinite(n) ? n : 0);
            }, 0);
            if (total > 0) return String(total);
          }
          const match = /\(([^)]+)\)/.exec(landParcel);
          return match ? match[1] : "—";
        })();

        const barangay = (() => {
          const fromAddress = String(item.farmerAddress || "")
            .split(",")[0]
            ?.trim();
          if (fromAddress && fromAddress !== "—") return fromAddress;
          const fromFarm = String(item.farmLocation || "")
            .split(",")[0]
            ?.trim();
          return fromFarm || "—";
        })();

        return {
          id: String(item.id),
          referenceNumber: item.referenceNumber || `RSBSA-${item.id}`,
          landownerName: item.farmerName || "—",
          landownerAddress: item.farmerAddress || "—",
          farmLocation: item.farmLocation || "—",
          barangay,
          parcelArea,
          parcelCount: item.parcelCount || 0,
          age: normalizeAgeValue(item.age, item.birthdate ?? null),
          dateSubmitted: item.dateSubmitted
            ? new Date(item.dateSubmitted).toISOString()
            : item.createdAt
              ? new Date(item.createdAt).toISOString()
              : "",
          status: String(item.status ?? "Not Submitted"),
          tenantCount: Number.isFinite(ownerId)
            ? (tenantsByOwner.get(ownerId)?.size ?? 0)
            : 0,
          lesseeCount: Number.isFinite(ownerId)
            ? (lesseesByOwner.get(ownerId)?.size ?? 0)
            : 0,
          currentTenantNames: Number.isFinite(ownerId)
            ? [...(tenantNamesByOwner.get(ownerId) ?? [])]
            : [],
          currentLesseeNames: Number.isFinite(ownerId)
            ? [...(lesseeNamesByOwner.get(ownerId) ?? [])]
            : [],
          archivedAt: item.archivedAt ?? item.archived_at ?? null,
          archiveReason: item.archiveReason ?? item.archive_reason ?? null,
        };
      });

      const ownerById = new Map<string, LandownerRecord>(
        formatted.map((owner) => [owner.id, owner]),
      );
      const ownerIds = formatted
        .map((owner) => Number(owner.id))
        .filter(Number.isFinite);

      let parcelRows: LandownerParcelRow[] = [];

      if (ownerIds.length > 0) {
        const { data: ownerParcels, error: ownerParcelsError } = await supabase
          .from("rsbsa_farm_parcels")
          .select(
            "id, submission_id, parcel_number, farm_location_barangay, total_farm_area_ha, is_current_owner",
          )
          .in("submission_id", ownerIds);

        if (ownerParcelsError)
          console.warn(
            "Owner parcel fetch error (non-blocking):",
            ownerParcelsError.message,
          );

        // Build set of ownerIds that have at least one is_current_owner parcel
        const ownersWithActiveLand = new Set<string>();
        (ownerParcels || []).forEach((p: any) => {
          if (p.is_current_owner === true) {
            ownersWithActiveLand.add(String(p.submission_id));
          }
        });

        // Mark records with no active land as flagged
        formatted.forEach((owner) => {
          owner.hasNoLand = !ownersWithActiveLand.has(owner.id);
        });

        parcelRows = (ownerParcels || [])
          .filter((p: any) => p.is_current_owner !== false)
          .map((p: any) => {
            const owner = ownerById.get(String(p.submission_id));
            if (!owner) return null;
            const parcelNumber = String(p.parcel_number || "N/A").trim();

            return {
              id: String(p.id),
              landownerId: owner.id,
              landownerName: owner.landownerName,
              referenceNumber: owner.referenceNumber,
              status: owner.status,
              parcelNumber,
              barangay: p.farm_location_barangay || owner.barangay || "—",
              parcelArea:
                typeof p.total_farm_area_ha === "number"
                  ? p.total_farm_area_ha
                  : parseFloat(String(p.total_farm_area_ha || 0)),
            } as LandownerParcelRow;
          })
          .filter((row): row is LandownerParcelRow => row !== null);
      }

      // Fire-and-forget: batch update Supabase status for flagged records
      // Only write if not already inactive or archived
      const flaggedToUpdate = formatted.filter(
        (r) =>
          r.hasNoLand && r.status !== "inactive" && r.status !== "archived",
      );
      if (flaggedToUpdate.length > 0) {
        (async () => {
          try {
            await Promise.all(
              flaggedToUpdate.map((r) =>
                supabase
                  .from("rsbsa_submission")
                  .update({ status: "inactive" })
                  .eq("id", r.id),
              ),
            );
          } catch (e) {
            console.warn(
              "Failed to update flagged landowner records status:",
              e,
            );
          }
        })();
      }

      setLandownerRecords(formatted);
      setParcelRows(parcelRows);
      setLoading(false);
    } catch (err: any) {
      setError(err.message ?? "Failed to load landowner records");
      setParcelRows([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLandownerRecords();
  }, []);

  // ─── Fetch detail for modal ─────────────────────────────────────────────────

  const fetchLandownerDetails = async (
    ownerId: string,
    summaryRecord?: LandownerRecord,
  ) => {
    try {
      setLoadingDetail(true);

      const ownerNumId = Number(ownerId);

      // Personal info
      const farmerResponse = await getRsbsaSubmissionById(ownerId);
      if (farmerResponse.error)
        throw new Error("Failed to fetch landowner details");
      const farmerData = farmerResponse.data;
      const data = farmerData.data || farmerData;

      const selectedRecord =
        summaryRecord || landownerRecords.find((r) => r.id === ownerId);

      const formattedDate = (() => {
        if (!selectedRecord?.dateSubmitted) return "N/A";
        const d = new Date(selectedRecord.dateSubmitted);
        return Number.isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString();
      })();

      const resolvedBirthdate = (() => {
        const raw =
          data.dateOfBirth ||
          data.birthdate ||
          data["DATE OF BIRTH"] ||
          data.BIRTHDATE ||
          null;
        if (!raw) return null;
        const d = new Date(raw);
        return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString();
      })();

      const age = normalizeAgeValue(
        farmerData.age ?? data.age ?? data.AGE,
        data.dateOfBirth ||
          data.birthdate ||
          data["DATE OF BIRTH"] ||
          data.BIRTHDATE ||
          null,
      );

      // Step A: Own parcels (the land they legally own)
      const ownedResponse = await getFarmParcels(ownerId, {
        currentOwnerOnly: true,
      });
      const ownedParcels: any[] = ownedResponse.data || [];

      // Step B: Parcels where this person is listed as landlord
      // These come from OTHER farmers' parcel rows pointing back to this owner
      const { data: occupiedByParcelsRaw, error: occupiedError } =
        await supabase
          .from("rsbsa_farm_parcels")
          .select(
            `
          id, submission_id, parcel_number,
          farm_location_barangay, farm_location_municipality,
          total_farm_area_ha, ownership_type_tenant, ownership_type_lessee,
          tenant_land_owner_id, lessee_land_owner_id,
          tenant_land_owner_name, lessee_land_owner_name,
          is_current_owner,
          agrarian_reform_beneficiary, within_ancestral_domain, ownership_document_no
        `,
          )
          .or(
            `tenant_land_owner_id.eq.${ownerNumId},lessee_land_owner_id.eq.${ownerNumId}`,
          );

      if (occupiedError)
        console.warn("Occupied parcels fetch error:", occupiedError.message);

      // Only the current tenant/lessee on a parcel should show up here —
      // a replaced tenant/lessee whose link is still in the table but is
      // no longer active shouldn't keep appearing on the landowner's parcel.
      const occupiedByParcels = (occupiedByParcelsRaw || []).filter(
        (p: any) => p.is_current_owner !== false,
      );

      // Step C: Fetch farmer names for occupant submission IDs
      const occupantIds = [
        ...new Set((occupiedByParcels || []).map((p: any) => p.submission_id)),
      ].filter(Boolean);
      const occupantInfoMap = new Map<
        number,
        { name: string; ffrsCode: string }
      >();

      if (occupantIds.length > 0) {
        const { data: occupantSubmissions } = await supabase
          .from("rsbsa_submission")
          .select(
            'id, "FIRST NAME", "LAST NAME", "MIDDLE NAME", "EXT NAME", "FFRS_CODE"',
          )
          .in("id", occupantIds);

        (occupantSubmissions || []).forEach((row: any) => {
          const last = row["LAST NAME"] || "";
          const first = row["FIRST NAME"] || "";
          const middle = row["MIDDLE NAME"] || "";
          const ext = row["EXT NAME"] || "";
          const parts = [
            last,
            [first, middle, ext].filter(Boolean).join(" "),
          ].filter(Boolean);
          occupantInfoMap.set(Number(row.id), {
            name: parts.join(", ") || "Unknown",
            ffrsCode: row["FFRS_CODE"] || "",
          });
        });
      }

      // Step D: Build occupation map keyed by parcel_number
      // For each owned parcel, find who works it
      const occupationByParcelNumber = new Map<string, OccupantInfo[]>();

      (occupiedByParcels || []).forEach((p: any) => {
        const parcelNum = String(p.parcel_number || "")
          .trim()
          .toUpperCase();
        if (!parcelNum) return;

        const occupantId = Number(p.submission_id);
        const occupantData = occupantInfoMap.get(occupantId);
        const isTenant = p.ownership_type_tenant === true;
        const isLessee = p.ownership_type_lessee === true;

        const occupant: OccupantInfo = {
          submissionId: String(p.submission_id),
          name:
            occupantData?.name ||
            p.tenant_land_owner_name ||
            p.lessee_land_owner_name ||
            "Unknown",
          ffrsCode: occupantData?.ffrsCode || "",
          role:
            isTenant && isLessee
              ? "tenant+lessee"
              : isTenant
                ? "tenant"
                : "lessee",
          isLinked: !!occupantData,
        };

        if (!occupationByParcelNumber.has(parcelNum))
          occupationByParcelNumber.set(parcelNum, []);
        occupationByParcelNumber.get(parcelNum)!.push(occupant);
      });

      // Step D.5: Fetch this owner's GIS shapes from land_plots.
      // No hard foreign key to rsbsa_farm_parcels — matched by ffrs_id
      // (when this owner has a real one, not the "RSBSA-{id}" fallback),
      // or by first/last name as a fallback, then narrowed per-parcel by
      // barangay + parcel_number. If a match is ambiguous or missing,
      // geometry is simply null — the UI shows "not plotted yet" rather
      // than guessing.
      const ownerFfrsId = (() => {
        const ref = String(
          selectedRecord?.referenceNumber || farmerData.referenceNumber || "",
        ).trim();
        return ref && !ref.toUpperCase().startsWith("RSBSA-")
          ? ref.toUpperCase()
          : "";
      })();
      const { firstName: ownerFirstName, lastName: ownerLastName } = (() => {
        const parsed = parseName(farmerData.farmerName || "");
        return {
          firstName: parsed.firstName.trim().toLowerCase(),
          lastName: parsed.lastName.trim().toLowerCase(),
        };
      })();

      let ownerPlots: any[] = [];
      if (ownerFfrsId) {
        const { data: plotsByFfrs, error: plotsByFfrsError } = await supabase
          .from("land_plots")
          .select("*")
          .ilike("ffrs_id", ownerFfrsId);
        if (plotsByFfrsError) {
          console.warn(
            "Land plot fetch by ffrs_id error (non-blocking):",
            plotsByFfrsError.message,
          );
        } else {
          ownerPlots = plotsByFfrs || [];
        }
      }
      if (ownerPlots.length === 0 && ownerFirstName && ownerLastName) {
        const { data: plotsByName, error: plotsByNameError } = await supabase
          .from("land_plots")
          .select("*")
          .ilike("first_name", ownerFirstName)
          .ilike("surname", ownerLastName);
        if (plotsByNameError) {
          console.warn(
            "Land plot fetch by name error (non-blocking):",
            plotsByNameError.message,
          );
        } else {
          ownerPlots = plotsByName || [];
        }
      }

      // Keyed by barangay + parcel_number so multiple parcels for the
      // same owner resolve to the right shape, not just "a" shape.
      const geometryByParcelKey = new Map<string, any>();
      ownerPlots.forEach((plot: any) => {
        if (!plot.geometry) return;
        const key = `${String(plot.barangay || "")
          .trim()
          .toUpperCase()}|${String(plot.parcel_number || "")
          .trim()
          .toUpperCase()}`;
        // First match wins — don't silently overwrite if duplicates exist,
        // that's a data-quality question for the GIS side, not something
        // to guess through here.
        if (!geometryByParcelKey.has(key)) {
          geometryByParcelKey.set(key, plot.geometry);
        }
      });

      const getGeometryFor = (
        barangay: string | null | undefined,
        parcelNumber: string | null | undefined,
      ) => {
        const key = `${String(barangay || "")
          .trim()
          .toUpperCase()}|${String(parcelNumber || "")
          .trim()
          .toUpperCase()}`;
        return geometryByParcelKey.get(key) || null;
      };

      // Step E: Build the combined parcel list
      // Start with owned parcels as the authoritative list
      const combinedParcels: OccupiedParcel[] = ownedParcels.map((p: any) => {
        const parcelNum = String(p.parcel_number || "")
          .trim()
          .toUpperCase();
        const occupants = occupationByParcelNumber.get(parcelNum) || [];

        const occupationType = getParcelOccupationType({
          registeredOwner: true,
          isCultivating: p.is_cultivating === true || p.is_farming === true,
          occupants,
        }) as OccupiedParcel["occupationType"];

        return {
          id: String(p.id),
          parcelNumber: p.parcel_number || "N/A",
          farmLocationBarangay: p.farm_location_barangay || "N/A",
          farmLocationMunicipality: p.farm_location_municipality || "N/A",
          totalFarmAreaHa: parseFloat(p.total_farm_area_ha) || 0,
          occupationType,
          occupants,
          agrarianReformBeneficiary: p.agrarian_reform_beneficiary || "",
          withinAncestralDomain: p.within_ancestral_domain || "",
          ownershipDocumentNo: p.ownership_document_no || "",
          geometry: getGeometryFor(p.farm_location_barangay, p.parcel_number),
        };
      });

      // Step F: Also append any occupied parcels that didn't match an owned parcel
      // (edge case — tenant references an owner who hasn't registered the parcel yet)
      const ownedParcelNumbers = new Set(
        ownedParcels.map((p: any) =>
          String(p.parcel_number || "")
            .trim()
            .toUpperCase(),
        ),
      );

      (occupiedByParcels || []).forEach((p: any) => {
        const parcelNum = String(p.parcel_number || "")
          .trim()
          .toUpperCase();
        if (ownedParcelNumbers.has(parcelNum)) return; // already handled above

        const occupantId = Number(p.submission_id);
        const occupantData = occupantInfoMap.get(occupantId);
        const isTenant = p.ownership_type_tenant === true;
        const isLessee = p.ownership_type_lessee === true;

        const occupant: OccupantInfo = {
          submissionId: String(p.submission_id),
          name: occupantData?.name || "Unknown",
          ffrsCode: occupantData?.ffrsCode || "",
          role:
            isTenant && isLessee
              ? "tenant+lessee"
              : isTenant
                ? "tenant"
                : "lessee",
          isLinked: !!occupantData,
        };

        const occupationType = getParcelOccupationType({
          registeredOwner: false,
          tenant: isTenant,
          lessee: isLessee,
        }) as OccupiedParcel["occupationType"];

        combinedParcels.push({
          id: String(p.id),
          parcelNumber: p.parcel_number || "N/A",
          farmLocationBarangay: p.farm_location_barangay || "N/A",
          farmLocationMunicipality: p.farm_location_municipality || "N/A",
          totalFarmAreaHa: parseFloat(p.total_farm_area_ha) || 0,
          occupationType,
          occupants: [occupant],
          agrarianReformBeneficiary: p.agrarian_reform_beneficiary || "",
          withinAncestralDomain: p.within_ancestral_domain || "",
          ownershipDocumentNo: p.ownership_document_no || "",
          geometry: getGeometryFor(p.farm_location_barangay, p.parcel_number),
        });

        ownedParcelNumbers.add(parcelNum);
      });

      const reformattedName = (() => {
        const n = farmerData.farmerName || "";
        if (!n || n === "N/A") return "N/A";
        const parts = n
          .split(",")
          .map((p: string) => p.trim())
          .filter(Boolean);
        if (parts.length <= 1) return parts[0] || "N/A";
        return `${parts[0]}, ${parts.slice(1).join(" ")}`;
      })();

      // Does this landowner ALSO have a separate Tenant/Lessee farmer
      // registration under their name? There is no person-level ID linking
      // separate submissions together — name is the only signal we have.
      // That's inherently unreliable if two different people share a name,
      // so this deliberately narrows further by middle name where either
      // side has one, and refuses to attach anything if the match still
      // resolves to more than one distinct person — showing nothing is
      // safer than attaching a stranger's farming activities to this record.
      let hasFarmerRegistration = false;
      let linkedFarmerData: Record<string, any> | null = null;

      try {
        const { data: tenantLesseeRows, error: tenantLesseeError } =
          await supabase
            .from("rsbsa_farm_parcels")
            .select("submission_id")
            .neq("submission_id", ownerNumId)
            .or("ownership_type_tenant.eq.true,ownership_type_lessee.eq.true");

        if (tenantLesseeError) {
          console.warn(
            "Linked farmer lookup (tenant/lessee parcels) error:",
            tenantLesseeError.message,
          );
        }

        const candidateSubmissionIds = [
          ...new Set(
            (tenantLesseeRows || [])
              .map((row: any) => Number(row.submission_id))
              .filter(Number.isFinite),
          ),
        ];

        if (candidateSubmissionIds.length > 0) {
          const { lastName: ownerLastName, firstName: ownerFirstName } =
            parseName(farmerData.farmerName || "");
          const normalizedOwnerLast = ownerLastName.trim().toLowerCase();
          const normalizedOwnerFirst = ownerFirstName.trim().toLowerCase();
          const normalizedOwnerMiddle = String(
            data.middleName || data["MIDDLE NAME"] || "",
          )
            .trim()
            .toLowerCase();

          if (normalizedOwnerLast && normalizedOwnerFirst) {
            const { data: candidateSubmissions, error: candidateError } =
              await supabase
                .from("rsbsa_submission")
                .select(
                  'id, "FIRST NAME", "LAST NAME", "MIDDLE NAME", "MAIN LIVELIHOOD", "FARMER_RICE", "FARMER_CORN", "FARMER_OTHER_CROPS", "FARMER_OTHER_CROPS_TEXT", "FARMER_LIVESTOCK", "FARMER_LIVESTOCK_TEXT", "FARMER_POULTRY", "FARMER_POULTRY_TEXT"',
                )
                .in("id", candidateSubmissionIds);

            if (candidateError) {
              console.warn(
                "Linked farmer lookup (submission match) error:",
                candidateError.message,
              );
            }

            const nameMatches = (candidateSubmissions || []).filter(
              (row: any) => {
                const rowLast = String(row["LAST NAME"] || "")
                  .trim()
                  .toLowerCase();
                const rowFirst = String(row["FIRST NAME"] || "")
                  .trim()
                  .toLowerCase();
                return (
                  rowLast === normalizedOwnerLast &&
                  rowFirst === normalizedOwnerFirst
                );
              },
            );

            if (nameMatches.length > 0) {
              // Narrow by middle name when we have one to compare — this
              // doesn't confirm identity, but it does separate two
              // different people who happen to share a first+last name
              // more often than first+last alone would.
              const middleNarrowed = normalizedOwnerMiddle
                ? nameMatches.filter((row: any) => {
                    const rowMiddle = String(row["MIDDLE NAME"] || "")
                      .trim()
                      .toLowerCase();
                    return !rowMiddle || rowMiddle === normalizedOwnerMiddle;
                  })
                : nameMatches;

              const finalMatches =
                middleNarrowed.length > 0 ? middleNarrowed : nameMatches;

              // If distinct middle names remain among the finalists, these
              // are genuinely different people sharing a name — bail out
              // rather than guess which one this owner actually is.
              const distinctMiddleNames = new Set(
                finalMatches.map((row: any) =>
                  String(row["MIDDLE NAME"] || "")
                    .trim()
                    .toLowerCase(),
                ),
              );
              const isAmbiguous =
                distinctMiddleNames.size > 1 &&
                [...distinctMiddleNames].every((m) => m !== "");

              if (!isAmbiguous) {
                hasFarmerRegistration = true;
                linkedFarmerData = finalMatches[0];
              }
            }
          }
        }
      } catch (linkedFarmerErr) {
        console.warn(
          "Linked farmer registration check failed (non-blocking):",
          linkedFarmerErr,
        );
      }

      const farmingActivities: string[] = [];
      if (hasFarmerRegistration && linkedFarmerData) {
        if (linkedFarmerData["FARMER_RICE"]) farmingActivities.push("Rice");
        if (linkedFarmerData["FARMER_CORN"]) farmingActivities.push("Corn");
        if (linkedFarmerData["FARMER_OTHER_CROPS"]) {
          const text = linkedFarmerData["FARMER_OTHER_CROPS_TEXT"] || "";
          farmingActivities.push(text ? `Other Crops: ${text}` : "Other Crops");
        }
        if (linkedFarmerData["FARMER_LIVESTOCK"]) {
          const text = linkedFarmerData["FARMER_LIVESTOCK_TEXT"] || "";
          farmingActivities.push(text ? `Livestock: ${text}` : "Livestock");
        }
        if (linkedFarmerData["FARMER_POULTRY"]) {
          const text = linkedFarmerData["FARMER_POULTRY_TEXT"] || "";
          farmingActivities.push(text ? `Poultry: ${text}` : "Poultry");
        }
      }
      const mainLivelihood =
        hasFarmerRegistration && linkedFarmerData
          ? String(linkedFarmerData["MAIN LIVELIHOOD"] || "").trim()
          : "";

      setSelectedLandowner({
        id: ownerId,
        referenceNumber: selectedRecord?.referenceNumber || "N/A",
        dateSubmitted: formattedDate,
        recordStatus: selectedRecord?.status || "N/A",
        birthdate: resolvedBirthdate,
        archivedAt: selectedRecord?.archivedAt ?? null,
        archiveReason: selectedRecord?.archiveReason ?? null,
        landownerName: reformattedName,
        landownerAddress: farmerData.farmerAddress || "N/A",
        age: age ?? "N/A",
        gender: data.gender || data.GENDER || "N/A",
        mainLivelihood,
        farmingActivities,
        parcels: combinedParcels,
      });
      setShowModal(true);
    } catch (err: any) {
      console.error("Error fetching landowner details:", err);
      alert("Failed to load landowner details");
    } finally {
      setLoadingDetail(false);
    }
  };

  // ─── Window click handler ───────────────────────────────────────────────────

  useEffect(() => {
    const handleWindowClick = () => {
      setOpenMenuId(null);
      setShowBulkExportMenu(false);
    };
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, []);

  useEffect(() => {
    setSelectedRecordIds((prev) => {
      const validIds = new Set(landownerRecords.map((r) => r.id));
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [landownerRecords]);

  // ─── Filtered + sorted records ─────────────────────────────────────────────

  const landownerSummary = useMemo((): LandownerSummaryRow[] => {
    const parcelsByOwner = new Map<string, LandownerParcelRow[]>();
    parcelRows.forEach((row) => {
      if (!parcelsByOwner.has(row.landownerId))
        parcelsByOwner.set(row.landownerId, []);
      parcelsByOwner.get(row.landownerId)!.push(row);
    });

    return landownerRecords.map((owner) => {
      const parcels = parcelsByOwner.get(owner.id) || [];

      // Sum all parcel areas
      const totalAreaHa = parcels.reduce((sum, p) => {
        const area =
          typeof p.parcelArea === "number"
            ? p.parcelArea
            : parseFloat(String(p.parcelArea || 0));
        return sum + (Number.isFinite(area) ? area : 0);
      }, 0);

      // Barangay — 1 name if single, "X barangays" if multiple
      const uniqueBarangays = [
        ...new Set(
          parcels.map((p) => p.barangay).filter((b) => b && b !== "—"),
        ),
      ];
      const barangay =
        uniqueBarangays.length === 1
          ? uniqueBarangays[0]
          : uniqueBarangays.length > 1
            ? `${uniqueBarangays.length} barangays`
            : owner.barangay || "—";

      return {
        id: owner.id,
        referenceNumber: owner.referenceNumber,
        landownerName: owner.landownerName,
        barangay,
        barangayCount: uniqueBarangays.length,
        totalAreaHa,
        parcelCount: parcels.length || owner.parcelCount,
        tenantCount: owner.tenantCount,
        lesseeCount: owner.lesseeCount,
        currentTenantNames: owner.currentTenantNames,
        currentLesseeNames: owner.currentLesseeNames,
        dateSubmitted: owner.dateSubmitted,
        status: owner.status,
        hasNoLand: parcels.length === 0,
      };
    });
  }, [landownerRecords, parcelRows]);

  const filteredSummary = useMemo(() => {
    return landownerSummary
      .filter((record) => {
        const normalizedStatus = (record.status || "").toLowerCase().trim();
        const activeStatuses = new Set([
          "submitted",
          "approved",
          "active",
          "active farmer",
        ]);
        const notActiveStatuses = new Set([
          "not submitted",
          "not_active",
          "not active",
          "draft",
          "pending",
          "not approved",
          "inactive",
        ]);

        let matchesRole = true;
        if (selectedRole === "hasTenants") matchesRole = record.tenantCount > 0;
        else if (selectedRole === "hasLessees")
          matchesRole = record.lesseeCount > 0;
        else if (selectedRole === "ownerCultivated")
          matchesRole = record.tenantCount === 0 && record.lesseeCount === 0;
        else if (selectedRole === "active")
          matchesRole = activeStatuses.has(normalizedStatus);
        else if (selectedRole === "notActive")
          matchesRole = notActiveStatuses.has(normalizedStatus);
        else if (selectedRole === "flagged")
          matchesRole = record.hasNoLand === true;

        if (!matchesRole) return false;

        if (selectedBarangay !== "all") {
          // match against actual barangay values even if display says "X barangays"
          if (
            record.barangayCount !== 1
              ? false
              : record.barangay.localeCompare(selectedBarangay, undefined, {
                  sensitivity: "base",
                }) !== 0
          )
            return false;
        }

        const q = searchQuery.toLowerCase();
        return (
          record.landownerName.toLowerCase().includes(q) ||
          record.referenceNumber.toLowerCase().includes(q) ||
          record.barangay.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // Primary: push flagged records to the bottom
        const aFlagged = a.hasNoLand === true ? 1 : 0;
        const bFlagged = b.hasNoLand === true ? 1 : 0;
        if (aFlagged !== bFlagged) return aFlagged - bFlagged;

        // Secondary: apply user's sort configs
        for (const config of sortConfigs) {
          const factor = config.direction === "asc" ? 1 : -1;
          if (config.key === "landownerName") {
            const r =
              a.landownerName.localeCompare(b.landownerName, undefined, {
                sensitivity: "base",
              }) * factor;
            if (r !== 0) return r;
          } else if (config.key === "barangay") {
            const r =
              a.barangay.localeCompare(b.barangay, undefined, {
                sensitivity: "base",
              }) * factor;
            if (r !== 0) return r;
          } else if (config.key === "totalAreaHa") {
            const r = (a.totalAreaHa - b.totalAreaHa) * factor;
            if (r !== 0) return r;
          } else if (config.key === "parcelCount") {
            const r = (a.parcelCount - b.parcelCount) * factor;
            if (r !== 0) return r;
          } else if (config.key === "occupantCount") {
            const r =
              (a.tenantCount +
                a.lesseeCount -
                (b.tenantCount + b.lesseeCount)) *
              factor;
            if (r !== 0) return r;
          } else if (config.key === "dateSubmitted") {
            const aDate = a.dateSubmitted
              ? new Date(a.dateSubmitted).getTime()
              : 0;
            const bDate = b.dateSubmitted
              ? new Date(b.dateSubmitted).getTime()
              : 0;
            const r = (aDate - bDate) * factor;
            if (r !== 0) return r;
          }
        }
        return 0;
      });
  }, [
    landownerSummary,
    selectedRole,
    selectedBarangay,
    searchQuery,
    sortConfigs,
  ]);

  // ─── Summary cards ──────────────────────────────────────────────────────────

  const landownerCounts = useMemo(() => {
    const base = landownerRecords;
    const activeStatuses = new Set([
      "submitted",
      "approved",
      "active",
      "active farmer",
    ]);
    return {
      total: base.length,
      active: base.filter((r) =>
        activeStatuses.has((r.status || "").toLowerCase().trim()),
      ).length,
      withTenants: base.filter((r) => r.tenantCount > 0).length,
      withLessees: base.filter((r) => r.lesseeCount > 0).length,
      ownerCultivated: base.filter(
        (r) => r.tenantCount === 0 && r.lesseeCount === 0,
      ).length,
    };
  }, [landownerRecords]);

  // ─── Sort helpers ───────────────────────────────────────────────────────────

  const handleSortChange = (key: SortKey) => {
    setSortConfigs((prev) => {
      const existing = prev[0];
      if (existing?.key === key) {
        return [
          {
            key,
            direction: existing.direction === "asc" ? "desc" : "asc",
          },
        ];
      }

      return [{ key, direction: getDefaultSortDirection(key) }];
    });
  };

  const resetSortConfig = () => setSortConfigs([{ ...DEFAULT_SORT_CONFIG }]);

  const isDefaultSortConfig =
    sortConfigs.length === 1 &&
    sortConfigs[0].key === DEFAULT_SORT_CONFIG.key &&
    sortConfigs[0].direction === DEFAULT_SORT_CONFIG.direction;

  const getSortIndicator = (key: SortKey) => {
    const active = sortConfigs[0];
    if (!active || active.key !== key) return "↕";
    return active.direction === "asc" ? "▲" : "▼";
  };

  const isSortActive = (key: SortKey) => sortConfigs[0]?.key === key;

  // ─── Selection helpers ──────────────────────────────────────────────────────

  const selectedRecords = useMemo(
    () => landownerRecords.filter((r) => selectedRecordIds.has(r.id)),
    [landownerRecords, selectedRecordIds],
  );

  const allFilteredSelected =
    filteredSummary.length > 0 &&
    filteredSummary.every((r) => selectedRecordIds.has(r.id));

  const toggleSelectAllFiltered = () => {
    setSelectedRecordIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected)
        filteredSummary.forEach((r) => next.delete(r.id));
      else filteredSummary.forEach((r) => next.add(r.id));
      return next;
    });
  };

  const toggleSelectRecord = (id: string) => {
    setSelectedRecordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  // ─── Print handlers ─────────────────────────────────────────────────────────

  const handlePrintLandownerRegistry = (scope: "all" | "selected") => {
    const records =
      scope === "selected"
        ? filteredSummary.filter((r) => selectedRecordIds.has(r.id))
        : filteredSummary;

    const filterLabel = (() => {
      const parts: string[] = [];
      if (selectedBarangay !== "all")
        parts.push(`Barangay: ${selectedBarangay}`);
      if (selectedRole === "hasTenants") parts.push("Role: Has Tenants");
      else if (selectedRole === "hasLessees") parts.push("Role: Has Lessees");
      else if (selectedRole === "ownerCultivated")
        parts.push("Filter: No Tenant/Lessee on Record");
      else if (selectedRole === "active") parts.push("Status: Active");
      else if (selectedRole === "notActive") parts.push("Status: Not Active");
      else if (selectedRole === "flagged")
        parts.push("Status: Flagged (No Land)");
      if (searchQuery) parts.push(`Search: "${searchQuery}"`);
      return parts.length > 0 ? parts.join(" · ") : "All Landowners";
    })();

    const rows = records
      .map((r, i) => {
        const { countText, names } = getTenantLesseeSummary(r);
        const tenantLesseeLabel = names.length
          ? `${countText} (${names.join(", ")})`
          : countText;

        return `<tr>
        <td>${i + 1}</td>
        <td>${r.landownerName}</td>
        <td>${r.referenceNumber}</td>
        <td>${r.barangay}</td>
        <td>${r.totalAreaHa > 0 ? r.totalAreaHa.toFixed(2) + " ha" : "—"}</td>
        <td>${r.parcelCount > 0 ? r.parcelCount : "—"}</td>
        <td>${tenantLesseeLabel}</td>
        <td>${formatRecordStatus(r.status)}</td>
      </tr>`;
      })
      .join("");

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head>
    <title>Landowner Registry — Dumangas, Iloilo</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;font-size:9px;padding:10mm}
      .hdr{text-align:center;margin-bottom:8px}
      .hdr h1{font-size:12px;font-weight:bold}
      .hdr p{font-size:9px}
      .meta{display:flex;justify-content:space-between;margin-bottom:6px;font-size:8px;color:#555}
      table{width:100%;border-collapse:collapse;font-size:8px}
      th{background:#1a5276;color:#fff;padding:3px 5px;text-align:left;font-weight:600;border:.5px solid #ccc}
      td{padding:2px 5px;border:.5px solid #ccc;vertical-align:top}
      tr:nth-child(even) td{background:#f9f9f9}
      .ftr{margin-top:10px;font-size:8px;color:#555;text-align:center}
    </style>
  </head><body>
    <div class="hdr">
      <h1>Republic of the Philippines — Department of Agriculture</h1>
      <p>Registry System for Basic Sectors in Agriculture (RSBSA)</p>
      <p><strong>Landowner Registry — Municipality of Dumangas, Iloilo</strong></p>
    </div>
    <div class="meta">
      <span>Filter: ${filterLabel}</span>
      <span>Total: ${records.length} landowner${records.length === 1 ? "" : "s"}</span>
      <span>Printed: ${new Date().toLocaleString()}</span>
    </div>
    <table>
      <thead><tr>
        <th>#</th>
        <th>Landowner Name</th>
        <th>Reference No.</th>
        <th>Barangay</th>
        <th>Total Area</th>
        <th>Parcels</th>
        <th>Tenants / Lessees</th>
        <th>Record Status</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="ftr">
      Landowner Registry — Dumangas, Iloilo · Printed by JO Staff · ${new Date().toLocaleDateString()}
    </div>
    <script>window.onload=function(){window.print()}<\/script>
  </body></html>`);
    w.document.close();
  };

  const handleBulkPrint = async () => {
    if (selectedRecords.length === 0) {
      showUpdateNotification("No records selected.", "error");
      return;
    }
    setIsBulkPrinting(true);
    const result = await printRsbsaFormsByIds(
      selectedRecords.map((r) => ({
        farmerId: r.id,
        fallbackReferenceNumber: r.referenceNumber,
        fallbackFarmerName: r.landownerName,
      })),
    );
    setIsBulkPrinting(false);
    setShowBulkExportMenu(false);
    if (!result.success && !result.cancelled) {
      showUpdateNotification(result.error || "Failed to print.", "error");
      return;
    }
    showUpdateNotification("Selected RSBSA forms sent to print.", "success");
    try {
      const user = await getCurrentUserForAudit();
      await getAuditLogger().logExport(
        { ...user, id: undefined },
        AuditModule.FARMERS,
        "Bulk RSBSA Form Print",
        selectedRecords.length,
      );
    } catch (e) {
      console.error("Audit log failed:", e);
    }
  };

  const handleModalPrint = async () => {
    if (!selectedLandowner) return;
    setIsModalPrinting(true);
    const result = await printRsbsaFormById({
      farmerId: selectedLandowner.id,
      fallbackReferenceNumber: selectedLandowner.referenceNumber,
      fallbackFarmerName: selectedLandowner.landownerName,
    });
    setIsModalPrinting(false);
    if (!result.success && !result.cancelled)
      showUpdateNotification(
        result.error || "Failed to print RSBSA form.",
        "error",
      );
  };

  // ─── Edit handlers ───────────────────────────────────────────────────────────

  const handleEdit = (recordId: string) => {
    const record = landownerRecords.find((r) => r.id === recordId);
    if (!record) return;
    const { lastName, firstName, middleName } = parseName(
      record.landownerName || "",
    );
    const parts = record.landownerAddress.split(",").map((p) => p.trim());
    setEditingRecord(record);
    setEditError(null);
    setEditFormData({
      firstName,
      middleName,
      lastName,
      age: record.age !== null ? String(record.age) : "",
      barangay: parts[0] || "",
      municipality: parts[1] || "Dumangas",
    });
    setOpenMenuId(null);
  };

  const handleCancel = () => {
    setEditingRecord(null);
    setEditFormData({});
    setEditError(null);
  };

  const handleInputChange = (field: keyof EditFormData, value: string) => {
    setEditError(null);
    setEditFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!editingRecord) return;
    try {
      setEditError(null);

      const rawAge = (editFormData.age ?? "").trim();
      const parsedAge = rawAge !== "" ? Number(rawAge) : null;
      if (
        rawAge !== "" &&
        (!Number.isFinite(parsedAge) || (parsedAge ?? 0) < 18)
      ) {
        setEditError("Age must be a valid number and at least 18 years old");
        showUpdateNotification(
          "Age must be a valid number and at least 18 years old.",
          "error",
        );
        return;
      }

      const last = (editFormData.lastName ?? "").trim();
      const first = (editFormData.firstName ?? "").trim();
      const middle = (editFormData.middleName ?? "").trim();
      const composedName = [last, [first, middle].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", ");
      const b = (editFormData.barangay ?? "").trim();
      const m = (editFormData.municipality ?? "").trim();
      const composedAddress = [b, m].filter(Boolean).join(", ");

      const response = await updateRsbsaSubmission(editingRecord.id, {
        surname: last,
        firstName: first,
        middleName: middle,
        addressBarangay: b,
        addressMunicipality: m,
        age: parsedAge,
      });

      if (response.error) throw new Error(response.error);

      setLandownerRecords((prev) =>
        prev.map((r) =>
          r.id === editingRecord.id
            ? {
                ...r,
                landownerName: composedName || r.landownerName,
                landownerAddress: composedAddress || r.landownerAddress,
                barangay: b || r.barangay,
                age: parsedAge,
              }
            : r,
        ),
      );

      setEditingRecord(null);
      setEditFormData({});
      setEditError(null);
      showUpdateNotification(
        "Landowner information updated successfully.",
        "success",
      );

      try {
        const user = await getCurrentUserForAudit();
        await getAuditLogger().logCRUD(
          { ...user, id: undefined },
          "UPDATE",
          AuditModule.FARMERS,
          "farmer_record",
          editingRecord.id,
          `Updated landowner: ${editingRecord.landownerName}`,
          { landownerName: editingRecord.landownerName },
          { updatedName: composedName },
        );
      } catch (e) {
        console.error("Audit log failed:", e);
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to update record.";
      setEditError(msg);
      showUpdateNotification(msg, "error");
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="jo-landowner-page-container">
      <div className="jo-landowner-page has-mobile-sidebar">
        <JOSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <div className="jo-landowner-main-content">
          <div className="tech-incent-mobile-header">
            <button
              className="tech-incent-hamburger"
              onClick={() => setSidebarOpen((p) => !p)}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="tech-incent-mobile-title">Landowner Registry</div>
          </div>

          <div className="jo-landowner-dashboard-header">
            <div>
              <h2 className="jo-landowner-page-title">Landowner Registry</h2>
              <p className="jo-landowner-page-subtitle">
                Registered landowners in Dumangas, Iloilo — with their parcels
                and occupants
              </p>
            </div>
          </div>

          {/* Summary cards */}
          {!loading && !error && (
            <div className="jo-landowner-status-cards">
              <div className="jo-landowner-status-card jo-landowner-card-total">
                <div className="jo-landowner-card-icon">🏡</div>
                <div className="jo-landowner-card-info">
                  <span className="jo-landowner-card-count">
                    {landownerCounts.total}
                  </span>
                  <span className="jo-landowner-card-label">
                    Total Landowners
                  </span>
                </div>
              </div>
              <div className="jo-landowner-status-card jo-landowner-card-active">
                <div className="jo-landowner-card-icon">✅</div>
                <div className="jo-landowner-card-info">
                  <span className="jo-landowner-card-count">
                    {landownerCounts.active}
                  </span>
                  <span className="jo-landowner-card-label">Active</span>
                </div>
              </div>
              <div className="jo-landowner-status-card jo-landowner-card-inactive">
                <div className="jo-landowner-card-icon">🌾</div>
                <div className="jo-landowner-card-info">
                  <span className="jo-landowner-card-count">
                    {landownerCounts.withTenants}
                  </span>
                  <span className="jo-landowner-card-label">With Tenants</span>
                </div>
              </div>
              <div className="jo-landowner-status-card jo-landowner-card-inactive">
                <div className="jo-landowner-card-icon">📋</div>
                <div className="jo-landowner-card-info">
                  <span className="jo-landowner-card-count">
                    {landownerCounts.withLessees}
                  </span>
                  <span className="jo-landowner-card-label">With Lessees</span>
                </div>
              </div>
              <div className="jo-landowner-status-card jo-landowner-card-total">
                <div className="jo-landowner-card-icon">📋</div>
                <div className="jo-landowner-card-info">
                  <span className="jo-landowner-card-count">
                    {landownerCounts.ownerCultivated}
                  </span>
                  <span className="jo-landowner-card-label">
                    No Tenant/Lessee
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="jo-landowner-content-card">
            {/* Filters */}
            <div className="jo-landowner-filters-section">
              <div className="jo-landowner-search-filter">
                <input
                  type="text"
                  placeholder="Search by name, FFRS code, or barangay..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="jo-landowner-search-input"
                />
              </div>
              <div className="jo-landowner-status-filter">
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="jo-landowner-status-select"
                >
                  <option value="all">All Landowners</option>
                  <option value="hasTenants">Has Tenants</option>
                  <option value="hasLessees">Has Lessees</option>
                  <option value="ownerCultivated">
                    No Tenant/Lessee on Record
                  </option>
                  <option value="active">Active</option>
                  <option value="notActive">Not Active</option>
                  <option value="flagged">Flagged (No Land)</option>
                </select>
              </div>
              <div className="jo-landowner-status-filter">
                <select
                  value={selectedBarangay}
                  onChange={(e) => setSelectedBarangay(e.target.value)}
                  className="jo-landowner-status-select"
                >
                  <option value="all">All Barangays</option>
                  {barangays.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {!loading && !error && (
              <div className="jo-landowner-table-meta">
                <span>
                  Showing {filteredSummary.length} of {landownerRecords.length}{" "}
                  landowners
                </span>
                <span>Tip: Sort up to 2 levels.</span>
                {!isDefaultSortConfig && (
                  <button
                    type="button"
                    className="jo-landowner-sort-btn"
                    onClick={resetSortConfig}
                  >
                    Reset Sort
                  </button>
                )}
              </div>
            )}

            {/* Bulk toolbar */}
            {!loading && !error && (
              <div className="jo-landowner-bulk-toolbar">
                <span className="jo-landowner-bulk-count">
                  {selectedRecordIds.size} landowner
                  {selectedRecordIds.size === 1 ? "" : "s"} selected
                </span>
                <div className="jo-landowner-bulk-actions">
                  {/* ── Always-visible Print Landowner Registry ── */}
                  <div
                    className="jo-landowner-bulk-export-wrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="jo-landowner-bulk-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPrintLandownerModal((p) => !p);
                      }}
                    >
                      🖨 Print Registry
                    </button>
                    {showPrintLandownerModal && (
                      <div className="jo-landowner-bulk-menu">
                        <div
                          style={{
                            padding: "6px 12px 4px",
                            fontSize: "11px",
                            color: "var(--color-text-secondary, #888)",
                            fontWeight: 600,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            borderBottom:
                              "0.5px solid var(--color-border-tertiary, #e0e0e0)",
                            marginBottom: 2,
                          }}
                        >
                          Print scope
                        </div>
                        <button
                          className="jo-landowner-quick-item"
                          onClick={() => {
                            setShowPrintLandownerModal(false);
                            handlePrintLandownerRegistry("all");
                          }}
                        >
                          🗂 Print All ({filteredSummary.length})
                        </button>
                        <button
                          className="jo-landowner-quick-item"
                          disabled={selectedRecordIds.size === 0}
                          style={{
                            opacity: selectedRecordIds.size === 0 ? 0.45 : 1,
                            cursor:
                              selectedRecordIds.size === 0
                                ? "not-allowed"
                                : "pointer",
                          }}
                          onClick={() => {
                            if (selectedRecordIds.size === 0) return;
                            setShowPrintLandownerModal(false);
                            handlePrintLandownerRegistry("selected");
                          }}
                        >
                          ✅ Print Selected Only
                          {selectedRecordIds.size > 0
                            ? ` (${selectedRecordIds.size})`
                            : " — pick rows first"}
                        </button>
                      </div>
                    )}
                  </div>
                  <div
                    className="jo-landowner-bulk-export-wrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="jo-landowner-bulk-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowBulkExportMenu((p) => !p);
                      }}
                    >
                      Multi-Print ▾
                    </button>
                    {showBulkExportMenu && (
                      <div className="jo-landowner-bulk-menu">
                        <button
                          className="jo-landowner-quick-item"
                          onClick={handleBulkPrint}
                          disabled={isBulkPrinting}
                        >
                          {isBulkPrinting
                            ? "Preparing forms..."
                            : "Print Selected RSBSA Forms"}
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    className="jo-landowner-bulk-btn jo-landowner-bulk-btn-clear"
                    onClick={() => setSelectedRecordIds(new Set())}
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="jo-landowner-table-container">
              <table className="jo-landowner-farmers-table">
                <thead>
                  <tr>
                    <th className="jo-landowner-checkbox-col">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleSelectAllFiltered}
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Select all"
                      />
                    </th>
                    <th>
                      <button
                        className={`jo-landowner-sort-btn ${isSortActive("landownerName") ? "is-active" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSortChange("landownerName");
                        }}
                      >
                        Landowner{" "}
                        <span>{getSortIndicator("landownerName")}</span>
                      </button>
                    </th>
                    <th>
                      <button
                        className={`jo-landowner-sort-btn ${isSortActive("barangay") ? "is-active" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSortChange("barangay");
                        }}
                      >
                        Barangay <span>{getSortIndicator("barangay")}</span>
                      </button>
                    </th>
                    <th>
                      <button
                        className={`jo-landowner-sort-btn ${isSortActive("totalAreaHa") ? "is-active" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSortChange("totalAreaHa");
                        }}
                      >
                        Total Area{" "}
                        <span>{getSortIndicator("totalAreaHa")}</span>
                      </button>
                    </th>
                    <th>
                      <button
                        className={`jo-landowner-sort-btn ${isSortActive("parcelCount") ? "is-active" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSortChange("parcelCount");
                        }}
                      >
                        Parcels <span>{getSortIndicator("parcelCount")}</span>
                      </button>
                    </th>
                    <th>
                      <button
                        className={`jo-landowner-sort-btn ${isSortActive("occupantCount") ? "is-active" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSortChange("occupantCount");
                        }}
                      >
                        Tenants / Lessees{" "}
                        <span>{getSortIndicator("occupantCount")}</span>
                      </button>
                    </th>
                    <th>Record Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={7} className="jo-landowner-loading-cell">
                        Loading...
                      </td>
                    </tr>
                  )}
                  {error && !loading && (
                    <tr>
                      <td colSpan={7} className="jo-landowner-error-cell">
                        Error: {error}
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    !error &&
                    filteredSummary.length > 0 &&
                    filteredSummary.map((record) => {
                      const ownerRecord = landownerRecords.find(
                        (r) => r.id === record.id,
                      );
                      return (
                        <tr
                          key={record.id}
                          className="jo-landowner-table-row"
                          onClick={() =>
                            fetchLandownerDetails(record.id, ownerRecord)
                          }
                        >
                          <td onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedRecordIds.has(record.id)}
                              onChange={() => toggleSelectRecord(record.id)}
                              aria-label={`Select ${record.landownerName}`}
                            />
                          </td>
                          {/* Landowner */}
                          <td>
                            <div className="jo-landowner-farmer-cell">
                              <div className="jo-landowner-farmer-avatar">
                                {getInitials(record.landownerName)}
                              </div>
                              <div className="jo-landowner-farmer-meta">
                                <span className="jo-landowner-farmer-name">
                                  {record.landownerName}
                                </span>
                                <span
                                  style={{
                                    fontSize: "0.8em",
                                    color: "var(--color-text-secondary, #888)",
                                  }}
                                >
                                  {record.referenceNumber}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Barangay */}
                          <td>
                            <span className="jo-landowner-cultivation-text">
                              {record.barangay}
                            </span>
                          </td>

                          {/* Total Area */}
                          <td>
                            <span className="jo-landowner-parcel-area">
                              {record.totalAreaHa > 0
                                ? `${record.totalAreaHa.toFixed(2)} ha`
                                : "—"}
                            </span>
                          </td>

                          {/* Parcels */}
                          <td>
                            <span className="jo-landowner-cultivation-text">
                              {record.parcelCount > 0
                                ? `${record.parcelCount} parcel${record.parcelCount === 1 ? "" : "s"}`
                                : "—"}
                            </span>
                          </td>

                          {/* Tenants / Lessees — plain count, no inferred label */}
                          <td>
                            {(() => {
                              const total =
                                record.tenantCount + record.lesseeCount;
                              const { countText, names } =
                                getTenantLesseeSummary(record);
                              return (
                                <div className="jo-landowner-farmer-meta">
                                  <span
                                    className={`jo-landowner-ownership-pill ${
                                      total > 0
                                        ? "jo-landowner-ownership-tenant"
                                        : "jo-landowner-ownership-unknown"
                                    }`}
                                  >
                                    {countText}
                                  </span>
                                  {names.length > 0 && (
                                    <span
                                      style={{
                                        fontSize: "0.8em",
                                        color:
                                          "var(--color-text-secondary, #888)",
                                      }}
                                    >
                                      {names.join(", ")}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>

                          {/* Record Status */}
                          <td>
                            <span
                              className={`jo-landowner-ownership-pill ${
                                [
                                  "submitted",
                                  "approved",
                                  "active",
                                  "active farmer",
                                ].includes(
                                  (record.status || "").toLowerCase().trim(),
                                )
                                  ? "jo-landowner-ownership-tenant"
                                  : "jo-landowner-ownership-unknown"
                              }`}
                            >
                              {formatRecordStatus(record.status)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                  {!loading && !error && filteredSummary.length === 0 && (
                    <tr>
                      <td colSpan={7} className="jo-landowner-empty-cell">
                        No landowners found for the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Toast */}
        {updateNotification.show && (
          <div
            className={`jo-landowner-update-toast ${updateNotification.type}`}
            role="status"
            aria-live="polite"
          >
            <span className="jo-landowner-update-toast-message">
              {updateNotification.message}
            </span>
            <button
              className="jo-landowner-update-toast-close"
              onClick={() =>
                setUpdateNotification((p) => ({ ...p, show: false }))
              }
              aria-label="Close"
            >
              ×
            </button>
          </div>
        )}

        {/* Edit Modal — personal info only */}
        {editingRecord && (
          <div className="jo-landowner-edit-modal-overlay">
            <div className="jo-landowner-edit-modal">
              <div className="jo-landowner-edit-modal-header">
                <div className="jo-landowner-edit-modal-title">
                  <h2>Edit Landowner Information</h2>
                  <p>
                    Update personal details only. Parcels are managed via the
                    Land Registry.
                  </p>
                </div>
                <button
                  className="jo-landowner-close-button"
                  onClick={handleCancel}
                >
                  ×
                </button>
              </div>
              <div className="jo-landowner-edit-modal-body">
                {editError && (
                  <div className="jo-landowner-edit-error-banner" role="alert">
                    {editError}
                  </div>
                )}
                <div className="jo-landowner-form-grid">
                  <div className="jo-landowner-form-group">
                    <label>Last Name:</label>
                    <input
                      type="text"
                      value={editFormData.lastName || ""}
                      onChange={(e) =>
                        handleInputChange("lastName", e.target.value)
                      }
                      placeholder="Last Name"
                    />
                  </div>
                  <div className="jo-landowner-form-group">
                    <label>First Name:</label>
                    <input
                      type="text"
                      value={editFormData.firstName || ""}
                      onChange={(e) =>
                        handleInputChange("firstName", e.target.value)
                      }
                      placeholder="First Name"
                    />
                  </div>
                  <div className="jo-landowner-form-group">
                    <label>Middle Name:</label>
                    <input
                      type="text"
                      value={editFormData.middleName || ""}
                      onChange={(e) =>
                        handleInputChange("middleName", e.target.value)
                      }
                      placeholder="Middle Name"
                    />
                  </div>
                  <div className="jo-landowner-form-group">
                    <label>Age:</label>
                    <input
                      type="text"
                      value={editFormData.age || ""}
                      onChange={(e) => handleInputChange("age", e.target.value)}
                      placeholder="Age"
                    />
                  </div>
                  <div className="jo-landowner-form-group">
                    <label>Barangay:</label>
                    <select
                      value={editFormData.barangay || ""}
                      onChange={(e) =>
                        handleInputChange("barangay", e.target.value)
                      }
                      className="jo-landowner-form-select"
                    >
                      <option value="">Select Barangay</option>
                      {barangays.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="jo-landowner-form-group">
                    <label>Municipality:</label>
                    <input
                      type="text"
                      value={editFormData.municipality || ""}
                      onChange={(e) =>
                        handleInputChange("municipality", e.target.value)
                      }
                      placeholder="Municipality"
                    />
                  </div>
                </div>
              </div>
              <div className="jo-landowner-edit-modal-footer">
                <button
                  className="jo-landowner-cancel-button"
                  onClick={handleCancel}
                >
                  Cancel
                </button>
                <button
                  className="jo-landowner-save-button"
                  onClick={handleSave}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Landowner Detail Modal */}
        {showModal && selectedLandowner && (
          <div className="farmer-modal-overlay">
            <div className="farmer-modal-content">
              {" "}
              {/* ← add this */}
              <LandownerProfileDisplay
                landowner={selectedLandowner}
                onClose={() => setShowModal(false)}
              />{" "}
              {/* ← and close it */}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JoLandownerRegistry;
