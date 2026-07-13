import { supabase } from "../../supabase";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  getRsbsaSubmissions,
  getRsbsaSubmissionById,
  getFarmParcels,
  getFarmParcelsWithOccupants,
  updateRsbsaSubmission,
  updateFarmParcel,
  getLandHistoryAssociationRows,
} from "../../api";
import {
  printRsbsaFormById,
  printRsbsaFormsByIds,
} from "../../utils/rsbsaPrint";
import "../../assets/css/jo css/JoMasterlistStyle.css";
import JOSidebar from "../../components/layout/JOSidebar";
import "../../assets/css/jo css/FarmerDetailModal.css";
import {
  getAuditLogger,
  AuditModule,
} from "../../components/Audit/auditLogger";
import { getCurrentUserForAudit } from "../../components/Audit/getCurrentUserForAudit";
import { FarmerProfileDisplay } from "../../components/FarmerProfile/FarmerProfileDisplay";
import type {
  UnifiedParcel,
  OccupantInfo,
} from "../../components/FarmerProfile/FarmerProfileDisplay";
import { getParcelOccupationType } from "../../utils/parcelOccupationType";

// ─────────────────────────────────────────────
// MASTERLIST — Universal "Find Anyone" page
//   • Search any registered person regardless of role
//   • Land-level summary dashboard (total area, idle parcels, etc.)
//   • Jump to Farmer Registry, Landowner Registry, Land Registry
//   • Print in DA paper format matching physical masterlist
//   • Archived records are excluded from the list
// ─────────────────────────────────────────────

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface RSBSARecord {
  id: string;
  referenceNumber: string;
  farmerName: string;
  farmerAddress: string;
  farmLocation: string;
  farmBarangay: string;
  parcelArea: string;
  parcelCount: number;
  age: number | null;
  birthdate: string;
  gender: string;
  dateSubmitted: string;
  status: string;
  landParcel: string;
  farmingStatus?: string;
  landownerName: string;
  archivedAt?: string | null;
  archiveReason?: string | null;
  hasNoActiveLand?: boolean;
  // True when the record is a tenant/lessee but has no landowner name
  // linked to any of their parcels.
  hasNoLandOwner?: boolean;
  farmerRice: boolean;
  farmerCorn: boolean;
  farmerOtherCrops: boolean;
  farmerLivestock: boolean;
  farmerPoultry: boolean;
  ownershipType?: {
    registeredOwner: boolean;
    tenant: boolean;
    lessee: boolean;
    tenantLessee?: boolean;
    category?: "registeredOwner" | "tenantLessee" | "unknown";
  };
  mainLivelihood?: string;
  isActivelyFarming?: boolean;
}

interface SummaryStats {
  totalParcels: number;
  totalAreaHa: number;
  idleParcels: number;
  barangaysCovered: number;
}

interface LandHistoryEntry {
  id: string;
  parcelNumber: string;
  farmLocationBarangay: string;
  landOwnerName: string;
  farmerName: string;
  isRegisteredOwner: boolean;
  isTenant: boolean;
  isLessee: boolean;
  isCurrent: boolean;
  periodStartDate: string | null;
  periodEndDate: string | null;
  changeType: string;
  changeReason: string | null;
}

interface Parcel {
  id: string;
  parcel_number: string;
  farm_location_barangay: string;
  farm_location_municipality: string;
  total_farm_area_ha: number;
  within_ancestral_domain: string;
  ownership_document_no: string;
  agrarian_reform_beneficiary: string;
  ownership_type_registered_owner: boolean;
  ownership_type_tenant: boolean;
  ownership_type_lessee: boolean;
  tenant_land_owner_name: string;
  lessee_land_owner_name: string;
  ownership_others_specify: string;
  contract_end_date?: string | null;
  is_farming?: boolean | null;
  farming_status_reason?: string | null;
  farming_status_updated_at?: string | null;
}

interface FarmerDetail {
  id: string;
  referenceNumber: string;
  dateSubmitted: string;
  recordStatus: string;
  birthdate: string | null;
  archivedAt: string | null;
  archiveReason: string | null;
  farmerName: string;
  farmerAddress: string;
  age: number | string;
  gender: string;
  mainLivelihood: string;
  farmingActivities: string[];
  ownershipRole: string;
  parcels: ParcelDetail[];
}

interface ParcelDetail {
  id: string;
  parcelNumber: string;
  farmLocationBarangay: string;
  farmLocationMunicipality: string;
  totalFarmAreaHa: number;
  ownershipTypeRegisteredOwner: boolean;
  ownershipTypeTenant: boolean;
  ownershipTypeLessee: boolean;
  tenantLandOwnerName: string;
  lesseeLandOwnerName: string;
  tenantLandOwnerId: string | null;
  lesseeLandOwnerId: string | null;
  withinAncestralDomain: string;
  ownershipDocumentNo: string;
  agrarianReformBeneficiary: string;
  ownershipOthersSpecify: string;
  contractEndDate?: string | null;
  isFarming?: boolean | null;
  farmingStatusReason?: string | null;
  farmingStatusUpdatedAt?: string | null;
  role?: string;
  occupants?: any[];
}

interface EditFormData {
  farmerName?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  farmerAddress?: string;
  barangay?: string;
  municipality?: string;
  farmLocation?: string;
  landParcel?: string;
  dateSubmitted?: string;
  parcelArea?: string;
  age?: string;
}

type SortKey = "farmerName" | "dateSubmitted" | "status" | "parcelArea";
type SortDirection = "asc" | "desc";

const DEFAULT_SORT_CONFIG: { key: SortKey; direction: SortDirection } = {
  key: "dateSubmitted",
  direction: "desc",
};
const MAX_SORT_LEVELS = 2;

const getDefaultSortDirection = (key: SortKey): SortDirection => {
  if (key === "farmerName" || key === "parcelArea") return "asc";
  return "desc";
};

// ─── Component ────────────────────────────────────────────────────────────────

const JoMasterlist: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

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

  // ─── State ─────────────────────────────────────────────────────────────────

  const [rsbsaRecords, setRsbsaRecords] = useState<RSBSARecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [summaryStats, setSummaryStats] = useState<SummaryStats>({
    totalParcels: 0,
    totalAreaHa: 0,
    idleParcels: 0,
    barangaysCovered: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [idleParcelOwnerIds, setIdleParcelOwnerIds] = useState<Set<string>>(
    new Set(),
  );

  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedBarangay, setSelectedBarangay] = useState<string>("all");
  const [selectedFarmBarangay, setSelectedFarmBarangay] =
    useState<string>("all");
  const [selectedFarmingStatus, setSelectedFarmingStatus] =
    useState<string>("all");
  const [selectedCrop, setSelectedCrop] = useState<string>("all");
  const [hideNonFarmingLandowners, setHideNonFarmingLandowners] =
    useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFarmer, setSelectedFarmer] = useState<FarmerDetail | null>(
    null,
  );
  const [loadingFarmerDetail, setLoadingFarmerDetail] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<
    "landowner" | "tenantLessee" | null
  >(null);
  const [modalLandHistory, setModalLandHistory] = useState<LandHistoryEntry[]>(
    [],
  );
  const [loadingLandHistory, setLoadingLandHistory] = useState(false);

  const [editingRecord, setEditingRecord] = useState<RSBSARecord | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>({});
  const [editError, setEditError] = useState<string | null>(null);
  const [editingParcels, setEditingParcels] = useState<Parcel[]>([]);
  const [loadingParcels, setLoadingParcels] = useState(false);
  const [parcelErrors, setParcelErrors] = useState<Record<string, string>>({});

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
  const [expandedOwnerIds, setExpandedOwnerIds] = useState<Set<string>>(
    new Set(),
  );
  const [showBulkExportMenu, setShowBulkExportMenu] = useState(false);
  const [showPrintMasterlistModal, setShowPrintMasterlistModal] =
    useState(false);
  const [isModalPrinting, setIsModalPrinting] = useState(false);
  const [isBulkPrinting, setIsBulkPrinting] = useState(false);
  const [printingRecordIds, setPrintingRecordIds] = useState<Set<string>>(
    new Set(),
  );
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

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return "—";
    }
  };

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
  };

  const formatParcelArea = (parcelArea: string) => {
    const tokens = String(parcelArea || "").match(/-?\d+(?:\.\d+)?/g);
    if (tokens && tokens.length > 0) {
      const total = tokens.reduce((s, t) => {
        const n = Number(t);
        return s + (Number.isFinite(n) ? n : 0);
      }, 0);
      if (Number.isFinite(total) && total > 0)
        return `${total.toLocaleString(undefined, { minimumFractionDigits: total % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })} ha`;
    }
    return parcelArea && parcelArea !== "—" ? parcelArea : "—";
  };

  const formatFarmingStatus = (status?: string | null) => {
    if (!status) return "Not specified";
    const n = status.toLowerCase().trim();
    if (n === "farming" || n === "actively farming") return "Farming";
    if (n === "not farming") return "Not farming";
    if (n === "mixed") return "Mixed";
    return status;
  };

  const formatRecordStatus = (status?: string | null) => {
    const n = String(status || "")
      .toLowerCase()
      .trim();
    if (!n || n === "not submitted") return "Not Submitted";
    if (n === "no parcels") return "No Parcels";
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
    if (active.has(n)) return "Active Farmer";
    if (inactive.has(n)) return "Inactive Farmer";
    return status || "Not Submitted";
  };

  const getFarmerInitials = (fullName: string) => {
    const parts = (fullName || "")
      .replace(/,/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "NA";
  };

  const calculateAgeFromBirthdate = (
    birthdate?: string | null,
  ): number | null => {
    if (!birthdate) return null;
    const bd = new Date(birthdate);
    if (Number.isNaN(bd.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - bd.getFullYear();
    const md = today.getMonth() - bd.getMonth();
    if (md < 0 || (md === 0 && today.getDate() < bd.getDate())) age--;
    return age >= 0 ? age : null;
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
    return calculateAgeFromBirthdate(birthdate);
  };

  const ageToInputValue = (ageValue: unknown): string => String(ageValue ?? "");

  const parseAgeInputToNumber = (ageValue?: string): number | null => {
    if (!ageValue || ageValue.trim() === "") return null;
    const parsed = Number(ageValue);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.floor(parsed);
  };

  const getRecordBarangay = (record: RSBSARecord) => {
    const fromAddress = String(record.farmerAddress || "")
      .split(",")[0]
      ?.trim();
    const fromFarm = String(record.farmLocation || "")
      .split(",")[0]
      ?.trim();
    const candidate =
      fromAddress && fromAddress !== "—" ? fromAddress : fromFarm;
    if (!candidate) return "";
    const n = candidate.toLowerCase();
    if (["—", "n/a", "na", "unknown"].includes(n)) return "";
    return candidate;
  };

  const getOwnershipFlags = (record: RSBSARecord) => {
    const owner = record.ownershipType?.registeredOwner === true;
    const tenant = record.ownershipType?.tenant === true;
    const lessee = record.ownershipType?.lessee === true;
    const tenantLessee =
      record.ownershipType?.tenantLessee === true || tenant || lessee;
    const category =
      record.ownershipType?.category ||
      (owner ? "registeredOwner" : tenantLessee ? "tenantLessee" : "unknown");
    return { owner, tenant, lessee, tenantLessee, category };
  };

  const getOwnershipLabel = (record: RSBSARecord) => {
    const f = getOwnershipFlags(record);
    if (f.category === "registeredOwner" || f.owner) return "Registered Owner";
    if (f.tenant && f.lessee) return "Tenant + Lessee";
    if (f.tenant) return "Tenant";
    if (f.lessee) return "Lessee";
    if (f.tenantLessee) return "Tenant or Lessee";
    return "—";
  };

  const getOwnershipClass = (record: RSBSARecord) => {
    const f = getOwnershipFlags(record);
    if (f.category === "registeredOwner" || f.owner)
      return "jo-masterlist-ownership-owner";
    if (f.tenant && f.lessee) return "jo-masterlist-ownership-mixed";
    if (f.tenant) return "jo-masterlist-ownership-tenant";
    if (f.lessee) return "jo-masterlist-ownership-lessee";
    if (f.tenantLessee) return "jo-masterlist-ownership-tenant";
    return "jo-masterlist-ownership-unknown";
  };

  const isTenantOrLesseeRecord = (record: RSBSARecord) => {
    const f = getOwnershipFlags(record);
    return f.tenant || f.lessee || f.category === "tenantLessee";
  };

  const hasNoParcelsOnRecord = (record: RSBSARecord) => {
    if (isTenantOrLesseeRecord(record)) return false;
    const status = (record.status || "").toLowerCase().trim();
    return status === "no parcels" || record.hasNoActiveLand === true;
  };

  const getMissingRecordWarning = (record: RSBSARecord) => {
    if (record.hasNoLandOwner === true) return "🚫 No land owner on record";
    if (hasNoParcelsOnRecord(record)) return "⚠️ No parcels on record";
    return null;
  };

  // ─── Fetch: Summary Stats ───────────────────────────────────────────────────

  const fetchSummaryStats = async () => {
    try {
      setLoadingStats(true);
      const { data, error: err } = await supabase
        .from("rsbsa_farm_parcels")
        .select(
          "submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, is_farming, is_cultivating, contract_end_date, ownership_type_tenant, ownership_type_lessee, is_current_owner",
        );
      if (err) throw err;
      const parcels = (data || []).filter((p: any) => p.is_current_owner !== false);
      const idleOwnerIds = new Set<string>();
      const normalizeKey = (value: unknown) =>
        String(value ?? "")
          .trim()
          .toLowerCase();
      const parcelGroups = new Map<
        string,
        { cultivated: boolean; ownerIds: Set<string> }
      >();
      const parseContractDate = (value: unknown): Date | null => {
        if (!value) return null;
        const raw = String(value).trim();
        if (!raw) return null;
        const parts = raw.split("-");
        if (parts.length >= 3) {
          const y = Number(parts[0]);
          const m = Number(parts[1]);
          const d = Number(parts[2]);
          if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d))
            return new Date(y, m - 1, d);
        }
        const parsed = new Date(raw);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      };
      const isContractEndedForOccupant = (p: any) => {
        const isOccupant =
          p.ownership_type_tenant === true || p.ownership_type_lessee === true;
        if (!isOccupant) return false;
        const end = parseContractDate(p.contract_end_date);
        if (!end) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        return end <= today;
      };

      parcels.forEach((p: any) => {
        const parcelKey = [
          normalizeKey(p.parcel_number),
          normalizeKey(p.farm_location_barangay),
          normalizeKey(p.farm_location_municipality),
        ].join("|");
        if (!parcelGroups.has(parcelKey))
          parcelGroups.set(parcelKey, {
            cultivated: false,
            ownerIds: new Set<string>(),
          });
        const group = parcelGroups.get(parcelKey)!;
        const hasActiveContract = !isContractEndedForOccupant(p);
        if (
          hasActiveContract &&
          (p.is_cultivating === true || p.is_farming === true)
        )
          group.cultivated = true;
        if (p.submission_id) group.ownerIds.add(String(p.submission_id));
      });

      const idleParcelKeys = Array.from(parcelGroups.entries())
        .filter(([, v]) => !v.cultivated)
        .map(([k]) => k);
      idleParcelKeys.forEach((key) => {
        const owners = parcelGroups.get(key)?.ownerIds;
        if (!owners) return;
        owners.forEach((id) => idleOwnerIds.add(id));
      });
      setSummaryStats({
        totalParcels: parcels.length,
        totalAreaHa: parcels.reduce(
          (s, p) => s + (parseFloat(p.total_farm_area_ha) || 0),
          0,
        ),
        idleParcels: idleParcelKeys.length,
        barangaysCovered: new Set(
          parcels.map((p) => p.farm_location_barangay).filter(Boolean),
        ).size,
      });
      setIdleParcelOwnerIds(idleOwnerIds);
    } catch (e) {
      console.error("Summary stats error:", e);
      setIdleParcelOwnerIds(new Set());
    } finally {
      setLoadingStats(false);
    }
  };

  // ─── Fetch: Records ─────────────────────────────────────────────────────────

  const fetchRSBSARecords = async () => {
    try {
      setLoading(true);
      const response = await getRsbsaSubmissions();
      if (response.error) throw new Error(response.error);
      const allData = Array.isArray(response.data) ? response.data : [];

      // Batch queries — avoids N+1
      const [tlResult, parcelOwnerResult, lhTenantResult] = await Promise.all([
        supabase
          .from("rsbsa_farm_parcels")
          .select(
            "submission_id, tenant_land_owner_name, lessee_land_owner_name, is_current_owner",
          )
          .or("ownership_type_tenant.eq.true,ownership_type_lessee.eq.true"),
        supabase
          .from("rsbsa_farm_parcels")
          .select("submission_id, is_current_owner"),
        // Fallback: land_history rows for tenants/lessees whose rsbsa_farm_parcels
        // insert may have failed. The land_owner_name column holds the owner name.
        // NOTE: farmer_id is the column written by the RPC (same field getFarmParcels uses).
        supabase
          .from("land_history")
          .select("farmer_id, land_owner_name")
          .or("is_tenant.eq.true,is_lessee.eq.true")
          .eq("is_current", true),
      ]);

      const landownerMap = new Map<string, string>();
      // Track which tenant/lessee submissions have at least one parcel with
      // a landowner name filled in. Those missing from this set are flagged
      // hasNoLandOwner.
      const submissionsWithOwnerName = new Set<string>();
      const tenantLesseeSubmissionIds = new Set<string>();
      (tlResult.data || []).forEach((p: any) => {
        if (!p.submission_id) return;
        if (p.is_current_owner === false) return; // Skip inactive/transferred parcels
        const id = String(p.submission_id);
        tenantLesseeSubmissionIds.add(id);
        const name = p.tenant_land_owner_name || p.lessee_land_owner_name || "";
        if (name) {
          landownerMap.set(id, name);
          submissionsWithOwnerName.add(id);
        }
      });

      // Apply land_history fallback for submissions not covered by rsbsa_farm_parcels
      (lhTenantResult.data || []).forEach((h: any) => {
        if (!h.farmer_id) return;
        const id = String(h.farmer_id);
        const name = (h.land_owner_name || "").trim();
        if (name) {
          // Only set if not already resolved from rsbsa_farm_parcels
          if (!landownerMap.has(id)) landownerMap.set(id, name);
          submissionsWithOwnerName.add(id);
        }
      });

      // Submissions that have at least one parcel where is_current_owner is not false
      // (null = not set, which applies to tenants/lessees — they pass through correctly)
      const submissionsWithActiveParcels = new Set<string>();
      (parcelOwnerResult.data || []).forEach((p: any) => {
        if (p.is_current_owner !== false) {
          submissionsWithActiveParcels.add(String(p.submission_id));
        }
      });

      const formatted: RSBSARecord[] = allData.map((item: any, idx: number) => {
        const backendName = item.farmerName || "";
        const reformattedName = (() => {
          if (!backendName || backendName === "—") return "—";
          const parts = backendName
            .split(",")
            .map((p: string) => p.trim())
            .filter(Boolean);
          if (parts.length === 0) return "—";
          if (parts.length === 1) return parts[0];
          return `${parts[0]}, ${parts.slice(1).join(" ")}`;
        })();

        const landParcel = String(item.landParcel ?? "—");
        const parcelArea = (() => {
          const parseNum = (v: unknown): number | null => {
            if (v === undefined || v === null) return null;
            const tokens = String(v).match(/-?\d+(?:\.\d+)?/g);
            if (!tokens) return null;
            const t = tokens.reduce((s, tok) => {
              const n = Number(tok);
              return s + (Number.isFinite(n) ? n : 0);
            }, 0);
            return Number.isFinite(t) && t > 0 ? t : null;
          };
          const fromTotal = parseNum(
            item.totalFarmArea ?? item["TOTAL FARM AREA"],
          );
          if (fromTotal !== null) return String(fromTotal);
          const direct = item.parcelArea ?? item["PARCEL AREA"];
          const fromDirect = parseNum(direct);
          if (fromDirect !== null) return String(fromDirect);
          if (
            direct !== undefined &&
            direct !== null &&
            String(direct).trim() !== ""
          )
            return String(direct);
          const m = /\(([^)]+)\)/.exec(landParcel);
          return m ? m[1] : "—";
        })();

        const farmLocation = String(item.farmLocation ?? "—");
        const farmBarangay = farmLocation.split(",")[0]?.trim() || "—";

        return {
          id: String(item.id),
          referenceNumber: String(item.referenceNumber ?? `RSBSA-${idx + 1}`),
          farmerName: String(reformattedName),
          farmerAddress: String(
            item.farmerAddress ?? item.addressBarangay ?? "—",
          ),
          farmLocation,
          farmBarangay,
          parcelArea,
          parcelCount:
            typeof item.parcelCount === "number" ? item.parcelCount : 0,
          age: normalizeAgeValue(
            item.age,
            item.birthdate ?? item.dateOfBirth ?? null,
          ),
          birthdate:
            item.birthdate ||
            item.dateOfBirth ||
            item["DATE OF BIRTH"] ||
            item.BIRTHDATE ||
            "",
          gender: item.gender || item.GENDER || "",
          dateSubmitted: item.dateSubmitted
            ? new Date(item.dateSubmitted).toISOString()
            : item.createdAt
              ? new Date(item.createdAt).toISOString()
              : "",
          status: String(item.status ?? "Not Submitted"),
          landParcel,
          farmingStatus: String(
            item.farmingStatus || item.cultivationStatus || "Not specified",
          ),
          landownerName: landownerMap.get(String(item.id)) || "",
          mainLivelihood: item.mainLivelihood || "",
          isActivelyFarming: item.isActivelyFarming === true,
          archivedAt:
            item.archivedAt ??
            item.archived_at ??
            item._raw?.archived_at ??
            null,
          archiveReason:
            item.archiveReason ??
            item.archive_reason ??
            item._raw?.archive_reason ??
            null,
          farmerRice: item.farmerRice || item["FARMER_RICE"] || false,
          farmerCorn: item.farmerCorn || item["FARMER_CORN"] || false,
          farmerOtherCrops:
            item.farmerOtherCrops || item["FARMER_OTHER_CROPS"] || false,
          farmerLivestock:
            item.farmerLivestock || item["FARMER_LIVESTOCK"] || false,
          farmerPoultry: item.farmerPoultry || item["FARMER_POULTRY"] || false,
          ownershipType: item.ownershipType,
          hasNoActiveLand:
            (item.status || "").toLowerCase().trim() === "no parcels" ||
            item.hasCurrentParcels === false ||
            typeof item.parcelCount !== "number" ||
            item.parcelCount === 0 ||
            !submissionsWithActiveParcels.has(String(item.id)),
          // Tenant or lessee whose parcels have no landowner name filled in.
          // Also covers T/L records with no parcel rows at all in rsbsa_farm_parcels
          // (tenantLesseeSubmissionIds won't contain them, but they're still unfilled).
          hasNoLandOwner: (() => {
            const ot = item.ownershipType;
            const isTenantOrLessee =
              ot?.tenant === true ||
              ot?.lessee === true ||
              ot?.tenantLessee === true;
            if (!isTenantOrLessee) return false;
            if (fallbackParcelCount === 0) return false; // Flag as No Parcels first
            const id = String(item.id);
            return !submissionsWithOwnerName.has(id);
          })(),
        };
      });

      const cleaned = formatted.filter((record) => {
        if (record.archivedAt) return false;
        return true;
      });
      setRsbsaRecords(cleaned);
      setLoading(false);
    } catch (err: any) {
      setError(err.message ?? "Failed to load records");
      setLoading(false);
    }
  };

  // ─── Fetch: Farmer Detail ───────────────────────────────────────────────────

  const fetchFarmerDetails = async (
    farmerId: string,
    summaryRecord?: RSBSARecord,
  ) => {
    try {
      setLoadingFarmerDetail(true);
      setModalLandHistory([]);

      const farmerResponse = await getRsbsaSubmissionById(farmerId);
      if (farmerResponse.error)
        throw new Error("Failed to fetch farmer details");
      const farmerData = farmerResponse.data;

      const parcelsResponse = await getFarmParcelsWithOccupants(farmerId, {
        activeOnly: true,
      });
      if (parcelsResponse.error) throw new Error("Failed to fetch parcels");
      const parcelsData = parcelsResponse.data || [];

      const data = farmerData.data || farmerData;
      const selectedRecord =
        summaryRecord || rsbsaRecords.find((r) => r.id === farmerId);

      const formattedDate = (() => {
        if (!selectedRecord?.dateSubmitted) return "N/A";
        const d = new Date(selectedRecord.dateSubmitted);
        return Number.isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString();
      })();

      const activities: string[] = [];
      if (data.farmerRice || data.FARMER_RICE) activities.push("Rice");
      if (data.farmerCorn || data.FARMER_CORN) activities.push("Corn");
      if (data.farmerOtherCrops || data.FARMER_OTHER_CROPS)
        activities.push(
          `Other Crops: ${data.farmerOtherCropsText || data.FARMER_OTHER_CROPS_TEXT || ""}`,
        );
      if (data.farmerLivestock || data.FARMER_LIVESTOCK)
        activities.push(
          `Livestock: ${data.farmerLivestockText || data.FARMER_LIVESTOCK_TEXT || ""}`,
        );
      if (data.farmerPoultry || data.FARMER_POULTRY)
        activities.push(
          `Poultry: ${data.farmerPoultryText || data.FARMER_POULTRY_TEXT || ""}`,
        );
      if (
        activities.length === 0 &&
        (data.mainLivelihood || data["MAIN LIVELIHOOD"])
      )
        activities.push(data.mainLivelihood || data["MAIN LIVELIHOOD"]);

      const backendName = farmerData.farmerName || "";
      const reformattedName = (() => {
        if (!backendName || backendName === "N/A") return "N/A";
        const parts = backendName
          .split(",")
          .map((p: string) => p.trim())
          .filter(Boolean);
        if (parts.length === 0) return "N/A";
        if (parts.length === 1) return parts[0];
        return `${parts[0]}, ${parts.slice(1).join(" ")}`;
      })();

      let mappedParcels = parcelsData.map((p: any) => ({
        id: p.id,
        parcelNumber: p.parcel_number || "N/A",
        farmLocationBarangay: p.farm_location_barangay || "N/A",
        farmLocationMunicipality: p.farm_location_municipality || "N/A",
        totalFarmAreaHa: parseFloat(p.total_farm_area_ha) || 0,
        ownershipTypeRegisteredOwner:
          p.ownership_type_registered_owner || false,
        ownershipTypeTenant: p.ownership_type_tenant || false,
        ownershipTypeLessee: p.ownership_type_lessee || false,
        tenantLandOwnerName: p.tenant_land_owner_name || "",
        lesseeLandOwnerName: p.lessee_land_owner_name || "",
        tenantLandOwnerId: p.tenant_land_owner_id
          ? String(p.tenant_land_owner_id)
          : null,
        lesseeLandOwnerId: p.lessee_land_owner_id
          ? String(p.lessee_land_owner_id)
          : null,
        withinAncestralDomain: p.within_ancestral_domain || "",
        ownershipDocumentNo: p.ownership_document_no || "",
        agrarianReformBeneficiary: p.agrarian_reform_beneficiary || "",
        ownershipOthersSpecify: p.ownership_others_specify || "",
        contractEndDate: p.contract_end_date || p.contractEndDate || null,
        isFarming: typeof p.is_farming === "boolean" ? p.is_farming : null,
        farmingStatusReason: p.farming_status_reason || null,
        farmingStatusUpdatedAt: p.farming_status_updated_at || null,
        role: p.role || "",
        occupants: p.occupants || [],
      }));

      if (mappedParcels.length === 0) {
        const submissionFarmLocation =
          data.farmLocation || data["FARM LOCATION"] || "";
        const submissionParcelArea = parseFloat(
          data.totalFarmArea || data["TOTAL FARM AREA"] || "0",
        );
        const submissionOwnership = data.ownershipType || {};
        if (submissionFarmLocation || submissionParcelArea > 0) {
          const parts = submissionFarmLocation
            .split(",")
            .map((s: string) => s.trim());
          mappedParcels = [
            {
              id: `submission-${farmerId}`,
              parcelNumber: "N/A",
              farmLocationBarangay: parts[0] || data.barangay || "N/A",
              farmLocationMunicipality: parts[1] || "Dumangas",
              totalFarmAreaHa: submissionParcelArea,
              ownershipTypeRegisteredOwner:
                submissionOwnership.registeredOwner || false,
              ownershipTypeTenant: submissionOwnership.tenant || false,
              ownershipTypeLessee: submissionOwnership.lessee || false,
              tenantLandOwnerName: "",
              lesseeLandOwnerName: "",
              tenantLandOwnerId: null,
              lesseeLandOwnerId: null,
              withinAncestralDomain: "",
              ownershipDocumentNo: "",
              agrarianReformBeneficiary: "",
              ownershipOthersSpecify: "",
              contractEndDate: null,
            },
          ];
        }
      }

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

      const ownershipRole = (() => {
        const ot = data.ownershipType || selectedRecord?.ownershipType;
        if (!ot) return "—";
        if (ot.registeredOwner) return "Registered Owner";
        if (ot.tenant && ot.lessee) return "Tenant + Lessee";
        if (ot.tenant) return "Tenant";
        if (ot.lessee) return "Lessee";
        return "—";
      })();

      setSelectedFarmer({
        id: farmerId,
        referenceNumber: selectedRecord?.referenceNumber || "N/A",
        dateSubmitted: formattedDate,
        recordStatus: selectedRecord?.status || "N/A",
        birthdate: resolvedBirthdate,
        archivedAt: selectedRecord?.archivedAt ?? null,
        archiveReason: selectedRecord?.archiveReason ?? null,
        farmerName: reformattedName,
        farmerAddress: farmerData.farmerAddress || "N/A",
        age:
          normalizeAgeValue(
            farmerData.age ?? data.age ?? data.AGE,
            data.dateOfBirth || data.birthdate || null,
          ) ?? "N/A",
        gender: data.gender || data.GENDER || "N/A",
        mainLivelihood: data.mainLivelihood || data["MAIN LIVELIHOOD"] || "N/A",
        farmingActivities: activities,
        ownershipRole,
        parcels: mappedParcels,
      });

      // Determine which profile modal to show based on ownership role
      const isLandowner = ownershipRole === "Registered Owner";
      setModalType(isLandowner ? "landowner" : "tenantLessee");
      setShowModal(true);

      // Fetch land history in background after modal opens
      fetchLandHistoryForModal(reformattedName);
    } catch (err: any) {
      console.error("Error fetching farmer details:", err);
      alert("Failed to load farmer details");
    } finally {
      setLoadingFarmerDetail(false);
    }
  };

  // ─── Fetch: Land History ────────────────────────────────────────────────────

  const fetchLandHistoryForModal = async (farmerName: string) => {
    try {
      setLoadingLandHistory(true);
      const response = await getLandHistoryAssociationRows({
        farmerName,
        limit: 50,
      });
      setModalLandHistory(
        (response.data || []).map((h: any) => ({
          id: String(h.id),
          parcelNumber: h.parcel_number || "N/A",
          farmLocationBarangay: h.farm_location_barangay || "N/A",
          landOwnerName: h.land_owner_name || "—",
          farmerName: h.farmer_name || "—",
          isRegisteredOwner: h.is_registered_owner || false,
          isTenant: h.is_tenant || false,
          isLessee: h.is_lessee || false,
          isCurrent: h.is_current || false,
          periodStartDate: h.period_start_date || null,
          periodEndDate: h.period_end_date || null,
          changeType: h.change_type || "N/A",
          changeReason: h.change_reason || null,
        })),
      );
    } catch (e) {
      console.error("Land history error:", e);
      setModalLandHistory([]);
    } finally {
      setLoadingLandHistory(false);
    }
  };

  // ─── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchRSBSARecords();
    fetchSummaryStats();
  }, []);

  // Fire-and-forget: write-once status update for owner records with no
  // current parcels. Tenant/lessee missing-owner cases stay separately flagged.
  useEffect(() => {
    if (rsbsaRecords.length === 0) return;
    const toFlag = rsbsaRecords.filter((r) => {
      if (!r.hasNoActiveLand) return false;
      const flags = getOwnershipFlags(r);
      if (flags.tenant || flags.lessee || flags.category === "tenantLessee") {
        return false;
      }
      const s = (r.status || "").toLowerCase().trim();
      return s !== "archived" && s !== "no parcels";
    });
    if (toFlag.length === 0) return;
    const ids = toFlag.map((r) => r.id);
    supabase
      .from("rsbsa_submission")
      .update({ status: "No Parcels" })
      .in("id", ids)
      .then(({ error }) => {
        if (error) console.error("No-land flag status update error:", error);
      });
  }, [rsbsaRecords]);

  useEffect(() => {
    const h = () => {
      setOpenMenuId(null);
      setShowBulkExportMenu(false);
    };
    window.addEventListener("click", h);
    return () => window.removeEventListener("click", h);
  }, []);

  useEffect(() => {
    setSelectedRecordIds((prev) => {
      const validIds = new Set(rsbsaRecords.map((r) => r.id));
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [rsbsaRecords]);

  // ─── Status counts ─────────────────────────────────────────────────────────

  const statusCounts = useMemo(() => {
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
    const isNoParcelsRecord = (record: RSBSARecord) => {
      const status = (record.status || "").toLowerCase().trim();
      if (status === "no parcels") return true;
      if (record.hasNoActiveLand !== true) return false;
      const flags = getOwnershipFlags(record);
      return !(
        flags.tenant ||
        flags.lessee ||
        flags.category === "tenantLessee"
      );
    };

    return {
      total: rsbsaRecords.length,
      active: rsbsaRecords.filter((r) =>
        active.has((r.status || "").toLowerCase().trim()),
      ).length,
      inactive: rsbsaRecords.filter(
        (r) =>
          inactive.has((r.status || "").toLowerCase().trim()) &&
          !isNoParcelsRecord(r),
      ).length,
      noParcels: rsbsaRecords.filter(isNoParcelsRecord).length,
      noLandOwner: rsbsaRecords.filter((r) => r.hasNoLandOwner === true).length,
    };
  }, [rsbsaRecords]);

  // ─── Filtered records ───────────────────────────────────────────────────────

  const filteredRecords = useMemo(() => {
    return rsbsaRecords
      .filter((record) => {
        const ns = (record.status || "").toLowerCase().trim();
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
        if (record.archivedAt) return false;

        // Exclude strict landowners who are not farming if toggle is ON
        if (hideNonFarmingLandowners) {
          const isLandOwner =
            String(record.mainLivelihood || "")
              .toLowerCase()
              .trim() === "landowner";
          const isActivelyFarming = record.isActivelyFarming === true;

          if (isLandOwner && !isActivelyFarming) {
            return false;
          }
        }

        const f = getOwnershipFlags(record);
        if (
          selectedRole === "owner" &&
          !(f.category === "registeredOwner" || f.owner)
        )
          return false;
        if (selectedRole === "tenant" && !f.tenant) return false;
        if (selectedRole === "lessee" && !f.lessee) return false;

        let matchesStatus = true;
        if (selectedStatus === "active") matchesStatus = active.has(ns);
        else if (selectedStatus === "notActive")
          matchesStatus = inactive.has(ns);
        else if (selectedStatus === "flaggedNoLand")
          matchesStatus = record.hasNoActiveLand === true;
        else if (selectedStatus === "noLandOwner")
          matchesStatus = record.hasNoLandOwner === true;
        if (!matchesStatus) return false;

        if (selectedBarangay !== "all") {
          const rb = getRecordBarangay(record);
          if (
            rb.localeCompare(selectedBarangay, undefined, {
              sensitivity: "base",
            }) !== 0
          )
            return false;
        }

        if (selectedFarmBarangay !== "all") {
          if (
            record.farmBarangay.localeCompare(selectedFarmBarangay, undefined, {
              sensitivity: "base",
            }) !== 0
          )
            return false;
        }

        if (selectedFarmingStatus !== "all") {
          const fs = (record.farmingStatus || "").toLowerCase().trim();
          if (
            selectedFarmingStatus === "farming" &&
            fs !== "farming" &&
            fs !== "actively farming"
          )
            return false;
          if (selectedFarmingStatus === "notFarming" && fs !== "not farming")
            return false;
          if (selectedFarmingStatus === "mixed" && fs !== "mixed") return false;
          if (
            selectedFarmingStatus === "notSpecified" &&
            fs !== "not specified" &&
            fs !== ""
          )
            return false;
        }

        if (selectedCrop !== "all") {
          if (selectedCrop === "rice" && !record.farmerRice) return false;
          if (selectedCrop === "corn" && !record.farmerCorn) return false;
          if (selectedCrop === "otherCrops" && !record.farmerOtherCrops)
            return false;
          if (selectedCrop === "livestock" && !record.farmerLivestock)
            return false;
          if (selectedCrop === "poultry" && !record.farmerPoultry) return false;
        }

        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matches =
            record.farmerName.toLowerCase().includes(q) ||
            record.referenceNumber.toLowerCase().includes(q) ||
            record.farmerAddress.toLowerCase().includes(q) ||
            record.farmLocation.toLowerCase().includes(q) ||
            record.farmBarangay.toLowerCase().includes(q) ||
            record.landownerName.toLowerCase().includes(q) ||
            record.parcelArea.toLowerCase().includes(q);
          if (!matches) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Flagged rows always sink to the bottom regardless of other sort keys
        const aFlag = a.hasNoActiveLand || a.hasNoLandOwner ? 1 : 0;
        const bFlag = b.hasNoActiveLand || b.hasNoLandOwner ? 1 : 0;
        if (aFlag !== bFlag) return aFlag - bFlag;

        const parseArea = (v: string) => {
          const tokens = String(v || "").match(/-?\d+(?:\.\d+)?/g);
          if (!tokens) return 0;
          return tokens.reduce((s, t) => {
            const n = Number(t);
            return s + (Number.isFinite(n) ? n : 0);
          }, 0);
        };
        for (const config of sortConfigs) {
          const factor = config.direction === "asc" ? 1 : -1;
          if (config.key === "dateSubmitted") {
            const aT = Date.parse(a.dateSubmitted),
              bT = Date.parse(b.dateSubmitted);
            const r =
              ((Number.isNaN(aT) ? -Infinity : aT) -
                (Number.isNaN(bT) ? -Infinity : bT)) *
              factor;
            if (r !== 0) return r;
          } else if (config.key === "status") {
            const r = a.status.localeCompare(b.status) * factor;
            if (r !== 0) return r;
          } else if (config.key === "farmerName") {
            const r =
              a.farmerName.localeCompare(b.farmerName, undefined, {
                sensitivity: "base",
              }) * factor;
            if (r !== 0) return r;
          } else {
            const r =
              (parseArea(a.parcelArea) - parseArea(b.parcelArea)) * factor;
            if (r !== 0) return r;
          }
        }
        return 0;
      });
  }, [
    rsbsaRecords,
    selectedStatus,
    selectedRole,
    selectedBarangay,
    selectedFarmBarangay,
    selectedFarmingStatus,
    selectedCrop,
    hideNonFarmingLandowners,
    searchQuery,
    sortConfigs,
  ]);

  const selectedRecords = useMemo(
    () => rsbsaRecords.filter((r) => selectedRecordIds.has(r.id)),
    [rsbsaRecords, selectedRecordIds],
  );

  // ─── Tenant map: normalised owner name → tenant records ────────────────────
  // Uses only the already-loaded rsbsaRecords so no extra queries are needed.
  // Name normalisation: split into tokens → sort alphabetically → join.
  // This makes "Eric Solano Elevencione" and "Elevencione, Eric Solano"
  // produce the same key regardless of word order or comma placement.
  const tenantsByOwnerName = useMemo(() => {
    const normTokenSort = (s: string) =>
      s
        .toLowerCase()
        .replace(/,/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .sort()
        .join(" ");

    const map = new Map<string, RSBSARecord[]>();
    rsbsaRecords.forEach((r) => {
      const f = getOwnershipFlags(r);
      const isTenantOrLessee = f.tenant || f.lessee || f.tenantLessee;
      if (!isTenantOrLessee || !r.landownerName) return;
      const key = normTokenSort(r.landownerName);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return map;
  }, [rsbsaRecords]);

  const toggleOwnerExpanded = (id: string) => {
    setExpandedOwnerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const normName = (s: string) =>
    s
      .toLowerCase()
      .replace(/,/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .sort()
      .join(" ");

  const VISIBLE_COLUMN_COUNT = 10;

  const allFilteredSelected =
    filteredRecords.length > 0 &&
    filteredRecords.every((r) => selectedRecordIds.has(r.id));

  const toggleSelectAllFiltered = () => {
    setSelectedRecordIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected)
        filteredRecords.forEach((r) => next.delete(r.id));
      else filteredRecords.forEach((r) => next.add(r.id));
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

  // ─── Sort ───────────────────────────────────────────────────────────────────

  const handleSortChange = (key: SortKey) => {
    setSortConfigs((prev) => {
      const defaultDir = getDefaultSortDirection(key);
      const hasOnlyDefault =
        prev.length === 1 &&
        prev[0].key === DEFAULT_SORT_CONFIG.key &&
        prev[0].direction === DEFAULT_SORT_CONFIG.direction;
      if (hasOnlyDefault && key !== "dateSubmitted")
        return [{ key, direction: defaultDir }];
      const existingIndex = prev.findIndex((c) => c.key === key);
      if (existingIndex >= 0)
        return prev.map((c) =>
          c.key === key
            ? { ...c, direction: c.direction === "asc" ? "desc" : "asc" }
            : c,
        );
      const next = [...prev, { key, direction: defaultDir }];
      if (next.length <= MAX_SORT_LEVELS) return next;
      return next.slice(next.length - MAX_SORT_LEVELS);
    });
  };

  const resetSortConfig = () => setSortConfigs([{ ...DEFAULT_SORT_CONFIG }]);
  const isDefaultSortConfig =
    sortConfigs.length === 1 &&
    sortConfigs[0].key === DEFAULT_SORT_CONFIG.key &&
    sortConfigs[0].direction === DEFAULT_SORT_CONFIG.direction;
  const getSortIndicator = (key: SortKey) => {
    const i = sortConfigs.findIndex((c) => c.key === key);
    if (i === -1) return "↕";
    return `${sortConfigs[i].direction === "asc" ? "▲" : "▼"}${i + 1}`;
  };
  const isSortActive = (key: SortKey) => sortConfigs.some((c) => c.key === key);

  // ─── Print: DA Masterlist Format ───────────────────────────────────────────

  const handlePrintMasterlist = (scope: "all" | "selected") => {
    const records =
      scope === "selected"
        ? filteredRecords.filter((r) => selectedRecordIds.has(r.id))
        : filteredRecords;
    const filterLabel = (() => {
      const parts: string[] = [];
      if (selectedBarangay !== "all")
        parts.push(`Home Brgy: ${selectedBarangay}`);
      if (selectedFarmBarangay !== "all")
        parts.push(`Farm Brgy: ${selectedFarmBarangay}`);
      if (selectedRole === "owner") parts.push("Role: Registered Owner");
      else if (selectedRole === "tenant") parts.push("Role: Tenant");
      else if (selectedRole === "lessee") parts.push("Role: Lessee");
      else parts.push("Role: All");
      if (selectedStatus === "active") parts.push("Status: Active");
      else if (selectedStatus === "notActive") parts.push("Status: Not Active");
      if (selectedFarmingStatus !== "all")
        parts.push(`Farming: ${selectedFarmingStatus}`);
      if (selectedCrop !== "all") parts.push(`Crop: ${selectedCrop}`);
      return parts.length > 0 ? parts.join(" · ") : "All Records";
    })();

    const rows = records
      .map((r) => {
        const nameParts = r.farmerName.split(",").map((p) => p.trim());
        const lastName = nameParts[0] || "";
        const firstMiddle = (nameParts[1] || "").split(" ").filter(Boolean);
        const firstName = firstMiddle[0] || "";
        const middleName = firstMiddle.slice(1).join(" ") || "";
        const homeBarangay = getRecordBarangay(r) || "—";
        const birthdate = r.birthdate
          ? (() => {
              try {
                return new Date(r.birthdate).toLocaleDateString();
              } catch {
                return r.birthdate;
              }
            })()
          : "—";
        const gender = r.gender || "—";
        const municipality = (
          r.farmerAddress.split(",")[1] || "Dumangas"
        ).trim();
        const farmBarangay = r.farmBarangay !== "—" ? r.farmBarangay : "—";
        const area = formatParcelArea(r.parcelArea);
        return `<tr><td>${r.referenceNumber}</td><td>${lastName}</td><td>${firstName}</td><td>${middleName}</td><td>${homeBarangay}</td><td>${gender}</td><td>${birthdate}</td><td>${municipality}</td><td>Iloilo</td><td>${farmBarangay}</td><td>${area}</td></tr>`;
      })
      .join("");

    const w = window.open("", "_blank");
    if (!w) return;
    w.document
      .write(`<!DOCTYPE html><html><head><title>RSBSA Masterlist — Dumangas, Iloilo</title><style>
      *{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:9px;padding:10mm}
      .hdr{text-align:center;margin-bottom:8px}.hdr h1{font-size:12px;font-weight:bold}.hdr p{font-size:9px}
      .meta{display:flex;justify-content:space-between;margin-bottom:6px;font-size:8px;color:#555}
      table{width:100%;border-collapse:collapse;font-size:8px}
      th{background:#1a5276;color:#fff;padding:3px 5px;text-align:left;font-weight:600;border:.5px solid #ccc}
      td{padding:2px 5px;border:.5px solid #ccc;vertical-align:top}
      tr:nth-child(even) td{background:#f9f9f9}
      .ftr{margin-top:10px;font-size:8px;color:#555;text-align:center}
    </style></head><body>
    <div class="hdr"><h1>Republic of the Philippines — Department of Agriculture</h1>
    <p>Registry System for Basic Sectors in Agriculture (RSBSA)</p>
    <p><strong>Municipality of Dumangas, Iloilo</strong></p></div>
    <div class="meta"><span>Filter: ${filterLabel}</span><span>Total: ${records.length} records</span><span>Printed: ${new Date().toLocaleString()}</span></div>
    <table><thead><tr>
      <th>FFRS Code</th><th>Last Name</th><th>First Name</th><th>Middle Name</th>
      <th>Barangay</th><th>Gender</th><th>Birthdate</th><th>Municipality</th>
      <th>Province</th><th>Farm Barangay</th><th>Area (ha)</th>
    </tr></thead><tbody>${rows}</tbody></table>
    <div class="ftr">RSBSA Masterlist — Dumangas, Iloilo · Printed by JO Staff · ${new Date().toLocaleDateString()}</div>
    <script>window.onload=function(){window.print()}<\/script></body></html>`);
    w.document.close();
  };

  // ─── Print: Single / Bulk RSBSA Form ───────────────────────────────────────

  const handlePrintSingleRecord = async (record: RSBSARecord) => {
    setPrintingRecordIds((p) => {
      const n = new Set(p);
      n.add(record.id);
      return n;
    });
    const result = await printRsbsaFormById({
      farmerId: record.id,
      fallbackReferenceNumber: record.referenceNumber,
      fallbackFarmerName: record.farmerName,
    });
    if (!result.success && !result.cancelled)
      showUpdateNotification(result.error || "Failed to print.", "error");
    if (result.success) {
      try {
        const u = await getCurrentUserForAudit();
        await getAuditLogger().logExport(
          { ...u, id: undefined },
          AuditModule.FARMERS,
          "RSBSA Form Print",
          1,
        );
      } catch {}
    }
    setPrintingRecordIds((p) => {
      const n = new Set(p);
      n.delete(record.id);
      return n;
    });
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
        fallbackFarmerName: r.farmerName,
      })),
    );
    setIsBulkPrinting(false);
    setShowBulkExportMenu(false);
    if (!result.success && !result.cancelled) {
      showUpdateNotification(result.error || "Failed to print.", "error");
      return;
    }
    if (result.success && (result.failedCount || 0) > 0) {
      showUpdateNotification(
        `Printed ${result.printedCount || 0}, ${result.failedCount} failed.`,
        "error",
      );
      return;
    }
    showUpdateNotification("Selected RSBSA forms sent to print.", "success");
    try {
      const u = await getCurrentUserForAudit();
      await getAuditLogger().logExport(
        { ...u, id: undefined },
        AuditModule.FARMERS,
        "Bulk RSBSA Form Print",
        selectedRecords.length,
      );
    } catch {}
  };

  const handleModalPrint = async () => {
    if (!selectedFarmer) return;
    setIsModalPrinting(true);
    const result = await printRsbsaFormById({
      farmerId: selectedFarmer.id,
      fallbackReferenceNumber: selectedFarmer.referenceNumber,
      fallbackFarmerName: selectedFarmer.farmerName,
    });
    setIsModalPrinting(false);
    if (!result.success && !result.cancelled)
      showUpdateNotification(result.error || "Failed to print.", "error");
  };

  // ─── Edit ───────────────────────────────────────────────────────────────────

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
    const fmp = (parts[1] || "")
      .split(" ")
      .map((p) => p.trim())
      .filter(Boolean);
    return {
      lastName: parts[0],
      firstName: fmp[0] || "",
      middleName: fmp.slice(1).join(" ") || "",
    };
  };

  const parseAddress = (address: string) => {
    if (!address) return { barangay: "", municipality: "" };
    const parts = address
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return { barangay: "", municipality: "" };
    if (parts.length === 1) return { barangay: parts[0], municipality: "" };
    return { barangay: parts[0], municipality: parts[1] };
  };

  const nt = (v: string) => v.trim().toLowerCase();

  const resolveBarangayForEdit = (
    addressBarangay: string,
    farmLocation: string,
  ): string => {
    const match = (c: string) => barangays.find((b) => nt(b) === nt(c)) || "";
    return (
      match(addressBarangay) ||
      match(parseAddress(farmLocation || "").barangay || farmLocation) ||
      ""
    );
  };

  const handleEdit = async (recordId: string) => {
    const record = rsbsaRecords.find((r) => r.id === recordId);
    if (!record) return;
    const { lastName, firstName, middleName } = parseName(
      record.farmerName || "",
    );
    const pa = parseAddress(record.farmerAddress || "");
    const pf = parseAddress(record.farmLocation || "");
    const resolvedBarangay = resolveBarangayForEdit(
      pa.barangay,
      record.farmLocation || "",
    );
    const resolvedMunicipality = (() => {
      const fa = (pa.municipality || "").trim();
      if (fa && nt(fa) !== "iloilo") return fa;
      return (pf.municipality || "").trim() || "Dumangas";
    })();
    setEditingRecord(record);
    setEditError(null);
    setEditFormData({
      farmerName: record.farmerName,
      firstName,
      middleName,
      lastName,
      age: ageToInputValue(record.age),
      farmerAddress: record.farmerAddress,
      barangay: resolvedBarangay,
      municipality: resolvedMunicipality,
      farmLocation: record.farmLocation,
      landParcel: record.landParcel,
      dateSubmitted: record.dateSubmitted,
      parcelArea: record.parcelArea?.replace(/\s*hectares\s*$/i, "").trim(),
    });
    setLoadingParcels(true);
    setParcelErrors({});
    try {
      const res = await getFarmParcels(recordId);
      if (!res.error) {
        setEditingParcels(
          (res.data || []).map((p: Parcel) => ({
            ...p,
            is_farming: typeof p.is_farming === "boolean" ? p.is_farming : null,
            farming_status_reason: p.farming_status_reason || null,
          })),
        );
      } else {
        setEditingParcels([]);
      }
    } catch {
      setEditingParcels([]);
    } finally {
      setLoadingParcels(false);
    }
    setOpenMenuId(null);
  };

  useEffect(() => {
    const navState = location.state as { editRecordId?: string } | null;
    const editRecordId = String(navState?.editRecordId || "").trim();
    if (!editRecordId || rsbsaRecords.length === 0) return;
    if (rsbsaRecords.some((r) => r.id === editRecordId))
      void handleEdit(editRecordId);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, rsbsaRecords, navigate]);

  const handleCancel = () => {
    setEditingRecord(null);
    setEditFormData({});
    setEditError(null);
    setEditingParcels([]);
    setParcelErrors({});
  };

  const handleInputChange = (field: keyof EditFormData, value: string) => {
    setEditError(null);
    setEditFormData((p) => ({ ...p, [field]: value }));
  };

  const deriveFarmingStatusFromParcels = (parcels: Parcel[]): string => {
    if (!parcels || parcels.length === 0) return "Not specified";
    let active = 0,
      inactive = 0;
    parcels.forEach((p) => {
      if (p.is_farming === true) active++;
      if (p.is_farming === false) inactive++;
    });
    if (active > 0 && inactive > 0) return "Mixed";
    if (active > 0) return "Farming";
    if (inactive > 0) return "Not farming";
    return "Not specified";
  };

  const handleIndividualParcelChange = (
    parcelId: string,
    field: keyof Parcel,
    value: any,
  ) => {
    setEditError(null);
    if (field === "total_farm_area_ha") {
      const vs = String(value).trim();
      if (vs === "") {
        setParcelErrors((p) => ({
          ...p,
          [parcelId]: "Parcel area is required",
        }));
        setEditingParcels((p) =>
          p.map((par) => (par.id === parcelId ? { ...par, [field]: 0 } : par)),
        );
        return;
      }
      const nv = parseFloat(vs);
      if (isNaN(nv)) {
        setParcelErrors((p) => ({
          ...p,
          [parcelId]: "Must be a valid number",
        }));
        return;
      }
      if (nv <= 0) {
        setParcelErrors((p) => ({
          ...p,
          [parcelId]: "Must be greater than 0",
        }));
        setEditingParcels((p) =>
          p.map((par) => (par.id === parcelId ? { ...par, [field]: nv } : par)),
        );
        return;
      }
      setEditingParcels((p) =>
        p.map((par) => (par.id === parcelId ? { ...par, [field]: nv } : par)),
      );
    } else {
      setEditingParcels((p) =>
        p.map((par) =>
          par.id === parcelId ? { ...par, [field]: value } : par,
        ),
      );
    }
  };

  const handleSave = async () => {
    if (!editingRecord || !editFormData) return;
    try {
      setEditError(null);
      if (editingParcels.length > 0) {
        const newErrors: Record<string, string> = {};
        editingParcels.forEach((p) => {
          if (!p.total_farm_area_ha || p.total_farm_area_ha <= 0)
            newErrors[p.id] = "Parcel area must be a valid positive number";
        });
        if (Object.keys(newErrors).length > 0) {
          setParcelErrors(newErrors);
          setEditError("Fix parcel area errors first");
          showUpdateNotification(
            "Fix parcel area errors before saving.",
            "error",
          );
          return;
        }
      }
      const rawAge = (editFormData.age ?? "").trim();
      const normalizedAge = parseAgeInputToNumber(rawAge);
      if (rawAge !== "" && (normalizedAge === null || normalizedAge < 18)) {
        setEditError("Age must be ≥ 18");
        showUpdateNotification("Age must be at least 18.", "error");
        return;
      }
      const last = (editFormData.lastName ?? "").trim(),
        first = (editFormData.firstName ?? "").trim(),
        middle = (editFormData.middleName ?? "").trim();
      const composedFarmerName = [
        last,
        [first, middle].filter(Boolean).join(" "),
      ]
        .filter(Boolean)
        .join(", ");
      const b = (editFormData.barangay ?? "").trim(),
        m = (editFormData.municipality ?? "").trim();
      const composedAddress = [b, m].filter(Boolean).join(", ");
      const newParcelAreaString =
        editingParcels.length > 0
          ? editingParcels.map((p) => p.total_farm_area_ha).join(", ")
          : (editFormData.parcelArea ?? editingRecord.parcelArea);
      const formattedData = {
        farmerName: composedFarmerName,
        farmerAddress: composedAddress,
        parcelArea: newParcelAreaString,
        age: normalizedAge,
      };
      const cleanedData = Object.entries({
        ...editFormData,
        ...formattedData,
        firstName: first,
        middleName: middle,
        surname: last,
        addressBarangay: b,
        addressMunicipality: m,
      }).reduce(
        (acc, [k, v]) => {
          if (v !== undefined && v !== "") acc[k] = v;
          return acc;
        },
        {} as Record<string, any>,
      );
      const response = await updateRsbsaSubmission(
        editingRecord.id,
        cleanedData,
      );
      if (response.error) throw new Error(response.error);
      for (const parcel of editingParcels) {
        try {
          await updateFarmParcel(parcel.id, {
            total_farm_area_ha: parcel.total_farm_area_ha,
            farm_location_barangay: parcel.farm_location_barangay,
            farm_location_municipality: parcel.farm_location_municipality,
            within_ancestral_domain: parcel.within_ancestral_domain,
            ownership_document_no: parcel.ownership_document_no,
            agrarian_reform_beneficiary: parcel.agrarian_reform_beneficiary,
            ownership_type_registered_owner:
              parcel.ownership_type_registered_owner,
            ownership_type_tenant: parcel.ownership_type_tenant,
            ownership_type_lessee: parcel.ownership_type_lessee,
            tenant_land_owner_name: parcel.tenant_land_owner_name,
            lessee_land_owner_name: parcel.lessee_land_owner_name,
            ownership_others_specify: parcel.ownership_others_specify,
            is_farming: parcel.is_farming ?? null,
            farming_status_reason:
              parcel.is_farming === false
                ? (parcel.farming_status_reason ?? null)
                : null,
            farming_status_updated_at: new Date().toISOString(),
          });
        } catch (e) {
          console.error(`Parcel ${parcel.id} update error:`, e);
        }
      }
      const serverRecord = response.data?.updatedRecord ?? response.data ?? {};
      setRsbsaRecords((p) =>
        p.map((r) =>
          r.id === editingRecord.id
            ? {
                ...editingRecord,
                ...formattedData,
                ...serverRecord,
                age: normalizeAgeValue(
                  serverRecord.age ?? formattedData.age,
                  null,
                ),
                farmingStatus:
                  editingParcels.length > 0
                    ? deriveFarmingStatusFromParcels(editingParcels)
                    : editingRecord.farmingStatus,
              }
            : r,
        ),
      );
      setEditingRecord(null);
      setEditFormData({});
      setEditError(null);
      setEditingParcels([]);
      setParcelErrors({});
      showUpdateNotification(
        "Farmer information updated successfully.",
        "success",
      );
      try {
        const u = await getCurrentUserForAudit();
        await getAuditLogger().logCRUD(
          { ...u, id: undefined },
          "UPDATE",
          AuditModule.FARMERS,
          "farmer_record",
          editingRecord.id,
          `Updated: ${editingRecord.farmerName}`,
          { farmerName: editingRecord.farmerName },
          { updatedName: composedFarmerName },
        );
      } catch {}
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Failed to update record.";
      setEditError(msg);
      showUpdateNotification(msg, "error");
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="jo-masterlist-page-container">
      <div className="jo-masterlist-page has-mobile-sidebar">
        <JOSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <div className="jo-masterlist-main-content">
          {/* Mobile header */}
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
            <div className="tech-incent-mobile-title">Masterlist</div>
          </div>

          {/* Page header */}
          <div className="jo-masterlist-dashboard-header">
            <div>
              <h1 className="jo-masterlist-page-title">Masterlist</h1>
              <p className="jo-masterlist-page-subtitle">
                Masterlist Registry in Municipality of Dumangas, Iloilo
              </p>
            </div>
          </div>

          {/* ── Summary Cards ─────────────────────────────────────────────── */}
          {!loading && !error && (
            <div className="jo-masterlist-status-cards">
              <div className="jo-masterlist-status-card jo-masterlist-card-total">
                <div className="jo-masterlist-card-icon">👥</div>
                <div className="jo-masterlist-card-info">
                  <span className="jo-masterlist-card-count">
                    {statusCounts.total}
                  </span>
                  <span className="jo-masterlist-card-label">
                    Total Registered
                  </span>
                </div>
              </div>
              <div className="jo-masterlist-status-card jo-masterlist-card-active">
                <div className="jo-masterlist-card-icon">✅</div>
                <div className="jo-masterlist-card-info">
                  <span className="jo-masterlist-card-count">
                    {statusCounts.active}
                  </span>
                  <span className="jo-masterlist-card-label">
                    Active Farmers
                  </span>
                </div>
              </div>
              <div className="jo-masterlist-status-card jo-masterlist-card-inactive">
                <div className="jo-masterlist-card-icon">❌</div>
                <div className="jo-masterlist-card-info">
                  <span className="jo-masterlist-card-count">
                    {statusCounts.inactive}
                  </span>
                  <span className="jo-masterlist-card-label">Inactive</span>
                </div>
              </div>
              {statusCounts.noParcels > 0 && (
                <div
                  className="jo-masterlist-status-card jo-masterlist-card-inactive"
                  style={{ borderLeft: "3px solid #d97706", cursor: "pointer" }}
                  onClick={() => setSelectedStatus("flaggedNoLand")}
                  title="Click to filter No Parcels records"
                >
                  <div className="jo-masterlist-card-icon">⚠️</div>
                  <div className="jo-masterlist-card-info">
                    <span className="jo-masterlist-card-count">
                      {statusCounts.noParcels}
                    </span>
                    <span className="jo-masterlist-card-label">No Parcels</span>
                  </div>
                </div>
              )}
              {statusCounts.noLandOwner > 0 && (
                <div
                  className="jo-masterlist-status-card jo-masterlist-card-inactive"
                  style={{ borderLeft: "3px solid #dc2626", cursor: "pointer" }}
                  onClick={() => setSelectedStatus("noLandOwner")}
                  title="Click to filter tenants/lessees with no landowner on record"
                >
                  <div className="jo-masterlist-card-icon">🚫</div>
                  <div className="jo-masterlist-card-info">
                    <span className="jo-masterlist-card-count">
                      {statusCounts.noLandOwner}
                    </span>
                    <span className="jo-masterlist-card-label">
                      No Land Owner
                    </span>
                  </div>
                </div>
              )}
              <div className="jo-masterlist-status-card jo-masterlist-card-total">
                <div className="jo-masterlist-card-icon">🌾</div>
                <div className="jo-masterlist-card-info">
                  <span className="jo-masterlist-card-count">
                    {loadingStats ? "..." : summaryStats.totalParcels}
                  </span>
                  <span className="jo-masterlist-card-label">
                    Total Parcels
                  </span>
                </div>
              </div>
              <div className="jo-masterlist-status-card jo-masterlist-card-total">
                <div className="jo-masterlist-card-icon">📐</div>
                <div className="jo-masterlist-card-info">
                  <span className="jo-masterlist-card-count">
                    {loadingStats
                      ? "..."
                      : `${summaryStats.totalAreaHa.toFixed(1)} ha`}
                  </span>
                  <span className="jo-masterlist-card-label">
                    Total Land Area
                  </span>
                </div>
              </div>
              <div className="jo-masterlist-status-card jo-masterlist-card-inactive">
                <div className="jo-masterlist-card-icon">🔴</div>
                <div className="jo-masterlist-card-info">
                  <span className="jo-masterlist-card-count">
                    {loadingStats ? "..." : summaryStats.idleParcels}
                  </span>
                  <span className="jo-masterlist-card-label">Idle Parcels</span>
                </div>
              </div>
              <div className="jo-masterlist-status-card jo-masterlist-card-total">
                <div className="jo-masterlist-card-icon">🏘️</div>
                <div className="jo-masterlist-card-info">
                  <span className="jo-masterlist-card-count">
                    {loadingStats ? "..." : summaryStats.barangaysCovered}
                  </span>
                  <span className="jo-masterlist-card-label">
                    Barangays Covered
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="jo-masterlist-content-card">
            {/* ── Filters ──────────────────────────────────────────────── */}
            <div className="jo-masterlist-filters-section">
              {/* Row 1 — Search */}
              <div className="jo-masterlist-filters-row-1">
                <div className="jo-masterlist-search-filter">
                  <input
                    type="text"
                    placeholder="Search name, FFRS code, farm barangay, landowner, parcel no..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="jo-masterlist-search-input"
                  />
                </div>
              </div>
              {/* Row 2 — Dropdowns */}
              <div className="jo-masterlist-filters-row-2">
                <div className="jo-masterlist-status-filter">
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="jo-masterlist-status-select"
                  >
                    <option value="all">All Roles</option>
                    <option value="owner">Registered Owner</option>
                    <option value="tenant">Tenant</option>
                    <option value="lessee">Lessee</option>
                  </select>
                </div>
                <div className="jo-masterlist-status-filter">
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="jo-masterlist-status-select"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="notActive">Not Active</option>
                    <option value="flaggedNoLand">Flagged (No Land)</option>
                    <option value="noLandOwner">No Land Owner</option>
                  </select>
                </div>
                <div className="jo-masterlist-status-filter">
                  <select
                    value={selectedBarangay}
                    onChange={(e) => setSelectedBarangay(e.target.value)}
                    className="jo-masterlist-status-select"
                  >
                    <option value="all">All Barangays</option>
                    {barangays.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="jo-masterlist-status-filter">
                  <select
                    value={selectedCrop}
                    onChange={(e) => setSelectedCrop(e.target.value)}
                    className="jo-masterlist-status-select"
                  >
                    <option value="all">All Crop Types</option>
                    <option value="rice">Rice</option>
                    <option value="corn">Corn</option>
                    <option value="otherCrops">Other Crops</option>
                    <option value="livestock">Livestock</option>
                    <option value="poultry">Poultry</option>
                  </select>
                </div>

                <div
                  className="jo-masterlist-status-filter"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    paddingLeft: "8px",
                    minWidth: "220px",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "13px",
                      color: "var(--color-text-secondary, #555)",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={hideNonFarmingLandowners}
                      onChange={(e) =>
                        setHideNonFarmingLandowners(e.target.checked)
                      }
                      style={{
                        width: "16px",
                        height: "16px",
                        cursor: "pointer",
                      }}
                    />
                    Hide non-farming land owners
                  </label>
                </div>
              </div>
            </div>

            {!loading && !error && (
              <div className="jo-masterlist-table-meta">
                {!isDefaultSortConfig && (
                  <button
                    type="button"
                    className="jo-masterlist-sort-btn"
                    onClick={resetSortConfig}
                  >
                    Reset Sort
                  </button>
                )}
              </div>
            )}

            {/* ── Bulk toolbar ─────────────────────────────────────────── */}
            {!loading && !error && (
              <div className="jo-masterlist-bulk-toolbar">
                {selectedRecordIds.size > 0 && (
                  <span className="jo-masterlist-bulk-count">
                    {selectedRecordIds.size} record
                    {selectedRecordIds.size === 1 ? "" : "s"} selected
                  </span>
                )}
                <div className="jo-masterlist-bulk-actions">
                  {/* ── Always-visible Print Masterlist ── */}
                  <div
                    className="jo-masterlist-bulk-export-wrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="jo-masterlist-bulk-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPrintMasterlistModal((p) => !p);
                      }}
                    >
                      🖨 Print Masterlist
                    </button>
                    {showPrintMasterlistModal && (
                      <div className="jo-masterlist-bulk-menu">
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
                          className="jo-masterlist-quick-item"
                          onClick={() => {
                            setShowPrintMasterlistModal(false);
                            handlePrintMasterlist("all");
                          }}
                        >
                          🗂 Print All ({filteredRecords.length})
                        </button>
                        <button
                          className="jo-masterlist-quick-item"
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
                            setShowPrintMasterlistModal(false);
                            handlePrintMasterlist("selected");
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

                  {/* ── Multi-Print (RSBSA forms) — only when rows selected ── */}
                  {selectedRecordIds.size > 0 && (
                    <div
                      className="jo-masterlist-bulk-export-wrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="jo-masterlist-bulk-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowBulkExportMenu((p) => !p);
                        }}
                      >
                        Multi-Print ▾
                      </button>
                      {showBulkExportMenu && (
                        <div className="jo-masterlist-bulk-menu">
                          <button
                            className="jo-masterlist-quick-item"
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
                  )}

                  {selectedRecordIds.size > 0 && (
                    <button
                      className="jo-masterlist-bulk-btn jo-masterlist-bulk-btn-clear"
                      onClick={() => setSelectedRecordIds(new Set())}
                    >
                      Clear Selection
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── Table ────────────────────────────────────────────────── */}
            <div className="jo-masterlist-table-container">
              <table className="jo-masterlist-farmers-table">
                <thead>
                  <tr>
                    <th className="jo-masterlist-checkbox-col">
                      <input
                        type="checkbox"
                        className="jo-masterlist-header-checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleSelectAllFiltered}
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Select all"
                      />
                    </th>
                    <th>
                      <button
                        className={`jo-masterlist-sort-btn ${isSortActive("farmerName") ? "is-active" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSortChange("farmerName");
                        }}
                      >
                        Farmer <span>{getSortIndicator("farmerName")}</span>
                      </button>
                    </th>
                    <th>Farm Barangay</th>
                    <th>
                      <button
                        className={`jo-masterlist-sort-btn ${isSortActive("parcelArea") ? "is-active" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSortChange("parcelArea");
                        }}
                      >
                        Parcels <span>{getSortIndicator("parcelArea")}</span>
                      </button>
                    </th>

                    <th>
                      <button
                        className={`jo-masterlist-sort-btn ${isSortActive("status") ? "is-active" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSortChange("status");
                        }}
                      >
                        Status <span>{getSortIndicator("status")}</span>
                      </button>
                    </th>
                    <th>
                      <button
                        className={`jo-masterlist-sort-btn ${isSortActive("dateSubmitted") ? "is-active" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSortChange("dateSubmitted");
                        }}
                      >
                        Date Submitted{" "}
                        <span>{getSortIndicator("dateSubmitted")}</span>
                      </button>
                    </th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td
                        colSpan={VISIBLE_COLUMN_COUNT}
                        className="jo-masterlist-loading-cell"
                      >
                        Loading...
                      </td>
                    </tr>
                  )}
                  {error && !loading && (
                    <tr>
                      <td
                        colSpan={VISIBLE_COLUMN_COUNT}
                        className="jo-masterlist-error-cell"
                      >
                        Error: {error}
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    !error &&
                    filteredRecords.length > 0 &&
                    filteredRecords.map((record) => {
                      const flags = getOwnershipFlags(record);
                      const isOwner =
                        flags.category === "registeredOwner" || flags.owner;
                      const hasIdleParcel =
                        isOwner && idleParcelOwnerIds.has(record.id);
                      const isTenantOrLessee =
                        flags.tenant || flags.lessee || flags.tenantLessee;
                      const missingRecordWarning =
                        getMissingRecordWarning(record);

                      // Look up tenants/lessees farming under this owner
                      const tenants =
                        tenantsByOwnerName.get(normName(record.farmerName)) ??
                        [];
                      const hasTenants = tenants.length > 0;
                      const isExpanded = expandedOwnerIds.has(record.id);

                      const getTenantRoleLabel = (t: RSBSARecord) => {
                        const f = getOwnershipFlags(t);
                        if (f.tenant && f.lessee) return "Tenant + Lessee";
                        if (f.tenant) return "Tenant";
                        if (f.lessee) return "Lessee";
                        return "Tenant/Lessee";
                      };

                      return (
                        <React.Fragment key={record.id}>
                          {/* ── Main owner row ── */}
                          <tr
                            className={`jo-masterlist-table-row${missingRecordWarning ? " jo-row--flagged" : ""}`}
                            onClick={() =>
                              fetchFarmerDetails(record.id, record)
                            }
                          >
                            <td className="jo-masterlist-checkbox-col">
                              <input
                                type="checkbox"
                                className="jo-masterlist-row-checkbox"
                                checked={selectedRecordIds.has(record.id)}
                                onChange={() => toggleSelectRecord(record.id)}
                                onClick={(e) => e.stopPropagation()}
                                aria-label={`Select ${record.farmerName}`}
                              />
                            </td>
                            <td>
                              <div className="jo-masterlist-farmer-cell">
                                <div className="jo-masterlist-farmer-avatar">
                                  {getFarmerInitials(record.farmerName)}
                                </div>
                                <div className="jo-masterlist-farmer-meta">
                                  <span className="jo-masterlist-farmer-name">
                                    {record.farmerName}
                                    {hasIdleParcel && (
                                      <span
                                        className="jo-masterlist-idle-pill"
                                        title="Has idle parcel"
                                        aria-label="Has idle parcel"
                                      >
                                        Idle
                                      </span>
                                    )}
                                  </span>
                                  <span className="jo-masterlist-farmer-ref">
                                    {record.referenceNumber}
                                  </span>
                                  {hasNoParcelsOnRecord(record) && (
                                    <span
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 4,
                                        fontSize: 11,
                                        color: "#b45309",
                                        marginTop: 2,
                                        fontWeight: 500,
                                      }}
                                    >
                                      ⚠️ No parcels on record
                                    </span>
                                  )}
                                  {record.hasNoLandOwner && (
                                    <span
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 4,
                                        fontSize: 11,
                                        color: "#dc2626",
                                        marginTop: 2,
                                        fontWeight: 500,
                                      }}
                                    >
                                      🚫 No land owner on record
                                    </span>
                                  )}
                                  {/* Tenant badge — only shown when tenants exist */}
                                  {hasTenants && (
                                    <button
                                      className="jo-masterlist-tenant-badge"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleOwnerExpanded(record.id);
                                      }}
                                      aria-expanded={isExpanded}
                                      aria-label={`${isExpanded ? "Collapse" : "Expand"} tenants for ${record.farmerName}`}
                                    >
                                      {isExpanded ? "▲" : "▼"} {tenants.length}{" "}
                                      tenant
                                      {tenants.length === 1 ? "" : "s"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="jo-masterlist-cultivation-text">
                                {record.farmBarangay || "—"}
                              </span>
                            </td>
                            <td>
                              <div className="jo-masterlist-parcel-cell">
                                <span className="jo-masterlist-parcel-count">
                                  {record.parcelCount} parcel
                                  {record.parcelCount === 1 ? "" : "s"}
                                </span>
                                <span className="jo-masterlist-parcel-area">
                                  {formatParcelArea(record.parcelArea)}
                                </span>
                              </div>
                            </td>

                            <td>
                              <span
                                className="jo-masterlist-record-status"
                                style={
                                  record.hasNoActiveLand ||
                                  record.hasNoLandOwner
                                    ? {
                                        background: "#fee2e2",
                                        color: "#991b1b",
                                        border: "1px solid #fca5a5",
                                        borderRadius: 4,
                                        padding: "2px 8px",
                                        fontSize: 12,
                                        fontWeight: 500,
                                        whiteSpace: "nowrap",
                                      }
                                    : undefined
                                }
                              >
                                {record.hasNoLandOwner
                                  ? "No Land Owner"
                                  : record.hasNoActiveLand
                                    ? (() => {
                                        const f = getOwnershipFlags(record);
                                        return f.tenant ||
                                          f.lessee ||
                                          f.category === "tenantLessee"
                                          ? "No Land Owner"
                                          : "No Parcels";
                                      })()
                                    : formatRecordStatus(record.status)}
                              </span>
                            </td>
                            <td>
                              <span className="jo-masterlist-date">
                                {formatDate(record.dateSubmitted)}
                              </span>
                            </td>
                            <td className="jo-masterlist-actions-cell">
                              <div
                                className="jo-masterlist-quick-actions"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  className="jo-masterlist-view-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuId((p) =>
                                      p === record.id ? null : record.id,
                                    );
                                  }}
                                >
                                  Quick Actions ▾
                                </button>
                                {openMenuId === record.id && (
                                  <div className="jo-masterlist-quick-menu">
                                    <button
                                      className="jo-masterlist-quick-item"
                                      onClick={() => {
                                        fetchFarmerDetails(record.id, record);
                                        setOpenMenuId(null);
                                      }}
                                    >
                                      View
                                    </button>
                                    <button
                                      className="jo-masterlist-quick-item"
                                      onClick={() => {
                                        handleEdit(record.id);
                                        setOpenMenuId(null);
                                      }}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      className="jo-masterlist-quick-item"
                                      onClick={async () => {
                                        setOpenMenuId(null);
                                        await handlePrintSingleRecord(record);
                                      }}
                                      disabled={printingRecordIds.has(
                                        record.id,
                                      )}
                                    >
                                      {printingRecordIds.has(record.id)
                                        ? "Preparing..."
                                        : "Print RSBSA Form"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* ── Expandable tenant sub-row ── */}
                          {hasTenants && isExpanded && (
                            <tr className="jo-masterlist-tenant-subrow">
                              <td />
                              <td colSpan={VISIBLE_COLUMN_COUNT - 1}>
                                <div className="jo-masterlist-tenant-panel">
                                  <div className="jo-masterlist-tenant-panel-header">
                                    <span className="jo-masterlist-tenant-panel-title">
                                      🌾 Farmers under{" "}
                                      <strong>{record.farmerName}</strong>
                                    </span>
                                    <span className="jo-masterlist-tenant-panel-note">
                                      Showing RSBSA-registered tenants/lessees
                                      only
                                    </span>
                                  </div>
                                  <table className="jo-masterlist-tenant-table">
                                    <thead>
                                      <tr>
                                        <th>Farmer</th>
                                        <th>FFRS Code</th>
                                        <th>Farm Barangay</th>
                                        <th>Parcel / Area</th>
                                        <th>Role</th>
                                        <th>Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {tenants.map((t) => (
                                        <tr
                                          key={t.id}
                                          className="jo-masterlist-tenant-row"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            fetchFarmerDetails(t.id, t);
                                          }}
                                          title="Click to view farmer details"
                                        >
                                          <td>
                                            <div className="jo-masterlist-tenant-farmer-cell">
                                              <div className="jo-masterlist-tenant-avatar">
                                                {getFarmerInitials(
                                                  t.farmerName,
                                                )}
                                              </div>
                                              <div
                                                style={{
                                                  display: "flex",
                                                  flexDirection: "column",
                                                }}
                                              >
                                                <span className="jo-masterlist-tenant-name">
                                                  {t.farmerName}
                                                </span>
                                                {t.hasNoLandOwner && (
                                                  <span
                                                    style={{
                                                      fontSize: 10,
                                                      color: "#dc2626",
                                                      fontWeight: 500,
                                                      marginTop: 1,
                                                    }}
                                                  >
                                                    🚫 No land owner on record
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          </td>
                                          <td className="jo-masterlist-tenant-ref">
                                            {t.referenceNumber || "—"}
                                          </td>
                                          <td className="jo-masterlist-tenant-barangay">
                                            {t.farmBarangay || "—"}
                                          </td>
                                          <td>
                                            <div className="jo-masterlist-parcel-cell">
                                              <span className="jo-masterlist-parcel-count">
                                                {t.parcelCount} parcel
                                                {t.parcelCount === 1 ? "" : "s"}
                                              </span>
                                              <span className="jo-masterlist-parcel-area">
                                                {formatParcelArea(t.parcelArea)}
                                              </span>
                                            </div>
                                          </td>
                                          <td>
                                            <span
                                              className={`jo-masterlist-ownership-pill ${getOwnershipClass(t)}`}
                                            >
                                              {getTenantRoleLabel(t)}
                                            </span>
                                          </td>
                                          <td>
                                            <span className="jo-masterlist-record-status">
                                              {formatRecordStatus(t.status)}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}

                  {!loading && !error && filteredRecords.length === 0 && (
                    <tr>
                      <td
                        colSpan={VISIBLE_COLUMN_COUNT}
                        className="jo-masterlist-empty-cell"
                      >
                        No records found for the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Toast ─────────────────────────────────────────────────────── */}
        {updateNotification.show && (
          <div
            className={`jo-masterlist-update-toast ${updateNotification.type}`}
            role="status"
            aria-live="polite"
          >
            <span className="jo-masterlist-update-toast-message">
              {updateNotification.message}
            </span>
            <button
              className="jo-masterlist-update-toast-close"
              onClick={() =>
                setUpdateNotification((p) => ({ ...p, show: false }))
              }
              aria-label="Close"
            >
              ×
            </button>
          </div>
        )}

        {/* ── Edit Modal ─────────────────────────────────────────────────── */}
        {editingRecord && (
          <div className="jo-masterlist-edit-modal-overlay">
            <div className="jo-masterlist-edit-modal">
              <div className="jo-masterlist-edit-modal-header">
                <div className="jo-masterlist-edit-modal-title">
                  <h2>Edit Farmer Information</h2>
                  <p>Update farmer details and parcel farming status.</p>
                </div>
                <button
                  className="jo-masterlist-close-button"
                  onClick={handleCancel}
                >
                  ×
                </button>
              </div>
              <div className="jo-masterlist-edit-modal-body">
                {editError && (
                  <div className="jo-masterlist-edit-error-banner" role="alert">
                    {editError}
                  </div>
                )}
                <div className="jo-masterlist-form-grid">
                  <div className="jo-masterlist-form-group">
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
                  <div className="jo-masterlist-form-group">
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
                  <div className="jo-masterlist-form-group">
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
                  <div className="jo-masterlist-form-group">
                    <label>Age:</label>
                    <input
                      type="text"
                      value={editFormData.age || ""}
                      onChange={(e) => handleInputChange("age", e.target.value)}
                      placeholder="Age"
                    />
                  </div>
                  <div className="jo-masterlist-form-group">
                    <label>Barangay:</label>
                    <select
                      value={editFormData.barangay || ""}
                      onChange={(e) =>
                        handleInputChange("barangay", e.target.value)
                      }
                      className="jo-masterlist-form-select"
                    >
                      <option value="">Select Barangay</option>
                      {barangays.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="jo-masterlist-form-group">
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
                <div className="jo-masterlist-parcel-section">
                  <h4>Parcels</h4>
                  {loadingParcels ? (
                    <p>Loading parcels...</p>
                  ) : editingParcels.length > 0 ? (
                    editingParcels.map((parcel, index) => (
                      <div
                        key={parcel.id}
                        className={`jo-masterlist-parcel-item ${parcelErrors[parcel.id] ? "error" : ""}`}
                      >
                        <div className="jo-masterlist-form-group">
                          <label className="jo-masterlist-parcel-label">
                            Parcel {index + 1} —{" "}
                            {parcel.parcel_number !== "N/A"
                              ? `No. ${parcel.parcel_number}`
                              : "No parcel number"}
                          </label>
                          <input
                            type="text"
                            value={parcel.total_farm_area_ha || ""}
                            onChange={(e) =>
                              handleIndividualParcelChange(
                                parcel.id,
                                "total_farm_area_ha",
                                e.target.value,
                              )
                            }
                            placeholder="e.g., 2.5 (ha)"
                            className="jo-masterlist-parcel-input"
                            data-error={
                              parcelErrors[parcel.id] ? "true" : "false"
                            }
                          />
                          {parcelErrors[parcel.id] && (
                            <small className="jo-masterlist-parcel-error">
                              {parcelErrors[parcel.id]}
                            </small>
                          )}
                          <small className="jo-masterlist-parcel-location">
                            Location: {parcel.farm_location_barangay || "N/A"},{" "}
                            {parcel.farm_location_municipality || "N/A"}
                          </small>
                        </div>
                        <div className="jo-masterlist-form-group">
                          <label>Currently farming this parcel?</label>
                          <select
                            value={
                              parcel.is_farming === true
                                ? "true"
                                : parcel.is_farming === false
                                  ? "false"
                                  : ""
                            }
                            onChange={(e) => {
                              const n =
                                e.target.value === "true"
                                  ? true
                                  : e.target.value === "false"
                                    ? false
                                    : null;
                              handleIndividualParcelChange(
                                parcel.id,
                                "is_farming",
                                n,
                              );
                              if (n !== false)
                                handleIndividualParcelChange(
                                  parcel.id,
                                  "farming_status_reason",
                                  null,
                                );
                            }}
                            className="jo-masterlist-form-select"
                          >
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                          </select>
                        </div>
                        {parcel.is_farming === false && (
                          <div className="jo-masterlist-form-group">
                            <label>Reason not farming:</label>
                            <input
                              type="text"
                              value={parcel.farming_status_reason || ""}
                              onChange={(e) =>
                                handleIndividualParcelChange(
                                  parcel.id,
                                  "farming_status_reason",
                                  e.target.value || null,
                                )
                              }
                              placeholder="Enter reason"
                            />
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="jo-masterlist-parcel-empty">
                      No parcels found for this farmer.
                    </p>
                  )}
                </div>
              </div>
              <div className="jo-masterlist-edit-modal-footer">
                <button
                  className="jo-masterlist-cancel-button"
                  onClick={handleCancel}
                >
                  Cancel
                </button>
                <button
                  className="jo-masterlist-save-button"
                  onClick={handleSave}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Farmer Detail Modal ────────────────────────────────────────── */}
        {showModal && selectedFarmer && (
          <div
            className="farmer-modal-overlay"
            onClick={() => {
              setShowModal(false);
              setModalType(null);
            }}
          >
            <div
              className="farmer-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              {loadingFarmerDetail ? (
                <div className="farmer-modal-loading">
                  Loading farmer details...
                </div>
              ) : modalType === "landowner" ? (
                <FarmerProfileDisplay
                  farmer={{
                    id: selectedFarmer.id,
                    referenceNumber: selectedFarmer.referenceNumber,
                    dateSubmitted: selectedFarmer.dateSubmitted,
                    recordStatus: selectedFarmer.recordStatus,
                    birthdate: selectedFarmer.birthdate,
                    archivedAt: selectedFarmer.archivedAt,
                    archiveReason: selectedFarmer.archiveReason,
                    name: selectedFarmer.farmerName,
                    address: selectedFarmer.farmerAddress,
                    age: selectedFarmer.age,
                    gender: selectedFarmer.gender,
                    parcels: (selectedFarmer.parcels || []).map(
                      (p): UnifiedParcel => ({
                        id: p.id,
                        parcelNumber: p.parcelNumber,
                        farmLocationBarangay: p.farmLocationBarangay,
                        farmLocationMunicipality: p.farmLocationMunicipality,
                        totalFarmAreaHa: p.totalFarmAreaHa,
                        role: p.role as UnifiedParcel["role"],
                        occupants: p.occupants || [],
                        geometry: null,
                        agrarianReformBeneficiary: p.agrarianReformBeneficiary,
                        withinAncestralDomain: p.withinAncestralDomain,
                        ownershipDocumentNo: p.ownershipDocumentNo,
                        isFarming: p.isFarming,
                        farmingStatusReason: p.farmingStatusReason,
                      }),
                    ),
                  }}
                  onClose={() => {
                    setShowModal(false);
                    setModalType(null);
                  }}
                />
              ) : modalType === "tenantLessee" ? (
                <FarmerProfileDisplay
                  farmer={{
                    id: selectedFarmer.id,
                    referenceNumber: selectedFarmer.referenceNumber,
                    dateSubmitted: selectedFarmer.dateSubmitted,
                    recordStatus: selectedFarmer.recordStatus,
                    birthdate: selectedFarmer.birthdate,
                    archivedAt: selectedFarmer.archivedAt,
                    archiveReason: selectedFarmer.archiveReason,
                    name: selectedFarmer.farmerName,
                    address: selectedFarmer.farmerAddress,
                    age: selectedFarmer.age,
                    gender: selectedFarmer.gender,
                    mainLivelihood: selectedFarmer.mainLivelihood,
                    farmingActivities: selectedFarmer.farmingActivities,
                    parcels: (selectedFarmer.parcels || []).map(
                      (p): UnifiedParcel => {
                        return {
                          id: p.id,
                          parcelNumber: p.parcelNumber,
                          farmLocationBarangay: p.farmLocationBarangay,
                          farmLocationMunicipality: p.farmLocationMunicipality,
                          totalFarmAreaHa: p.totalFarmAreaHa,
                          role: p.role as UnifiedParcel["role"],
                          occupants: p.occupants || [],
                          geometry: null,
                          withinAncestralDomain: p.withinAncestralDomain,
                          ownershipDocumentNo: p.ownershipDocumentNo,
                          agrarianReformBeneficiary:
                            p.agrarianReformBeneficiary,
                          isFarming: p.isFarming,
                          farmingStatusReason: p.farmingStatusReason,
                        };
                      },
                    ),
                  }}
                  onClose={() => {
                    setShowModal(false);
                    setModalType(null);
                  }}
                />
              ) : (
                <>
                  {/* ── Record Overview ──────────────────────────────── */}
                  <div className="farmer-modal-section">
                    <h3 className="farmer-modal-section-title">
                      Record Overview
                    </h3>
                    <div className="farmer-modal-info-grid">
                      <div className="farmer-modal-info-item">
                        <span className="farmer-modal-label">FFRS ID:</span>
                        <span className="farmer-modal-value">
                          {selectedFarmer.referenceNumber}
                        </span>
                      </div>
                      <div className="farmer-modal-info-item">
                        <span className="farmer-modal-label">
                          Date Submitted:
                        </span>
                        <span className="farmer-modal-value">
                          {selectedFarmer.dateSubmitted}
                        </span>
                      </div>
                      <div className="farmer-modal-info-item">
                        <span className="farmer-modal-label">Role:</span>
                        <span className="farmer-modal-value">
                          {selectedFarmer.ownershipRole}
                        </span>
                      </div>
                      <div className="farmer-modal-info-item">
                        <span className="farmer-modal-label">Status:</span>
                        <span className="farmer-modal-value">
                          {selectedFarmer.recordStatus}
                        </span>
                      </div>
                      {selectedFarmer.archivedAt && (
                        <>
                          <div className="farmer-modal-info-item">
                            <span className="farmer-modal-label">
                              Archived On:
                            </span>
                            <span
                              className="farmer-modal-value"
                              style={{
                                color: "var(--color-text-danger,#c0392b)",
                              }}
                            >
                              {formatDateTime(selectedFarmer.archivedAt)}
                            </span>
                          </div>
                          <div className="farmer-modal-info-item">
                            <span className="farmer-modal-label">
                              Archive Reason:
                            </span>
                            <span className="farmer-modal-value">
                              {selectedFarmer.archiveReason || "Not specified"}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* ── Personal Information ─────────────────────────── */}
                  <div className="farmer-modal-section">
                    <h3 className="farmer-modal-section-title">
                      👤 Personal Information
                    </h3>
                    <div className="farmer-modal-info-grid">
                      <div className="farmer-modal-info-item">
                        <span className="farmer-modal-label">Full Name:</span>
                        <span className="farmer-modal-value">
                          {selectedFarmer.farmerName}
                        </span>
                      </div>
                      <div className="farmer-modal-info-item">
                        <span className="farmer-modal-label">Address:</span>
                        <span className="farmer-modal-value">
                          {selectedFarmer.farmerAddress}
                        </span>
                      </div>
                      <div className="farmer-modal-info-item">
                        <span className="farmer-modal-label">Age:</span>
                        <span className="farmer-modal-value">
                          {typeof selectedFarmer.age === "number"
                            ? `${selectedFarmer.age} years old`
                            : selectedFarmer.age}
                          {selectedFarmer.birthdate && (
                            <span
                              style={{
                                marginLeft: 8,
                                fontSize: "0.85em",
                                color: "var(--color-text-secondary,#666)",
                              }}
                            >
                              (Born: {selectedFarmer.birthdate})
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="farmer-modal-info-item">
                        <span className="farmer-modal-label">Gender:</span>
                        <span className="farmer-modal-value">
                          {selectedFarmer.gender}
                        </span>
                      </div>
                      <div className="farmer-modal-info-item farmer-modal-full-width">
                        <span className="farmer-modal-label">
                          Farming Activities:
                        </span>
                        <span className="farmer-modal-value">
                          {selectedFarmer.farmingActivities.length > 0
                            ? selectedFarmer.farmingActivities.join(", ")
                            : "Not available"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ── Farm Information ─────────────────────────────── */}
                  <div className="farmer-modal-section">
                    <h3 className="farmer-modal-section-title">
                      🌾 Farm Information
                    </h3>
                    {selectedFarmer.parcels.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 20,
                          padding: "8px 12px",
                          marginBottom: 12,
                          background:
                            "var(--color-background-secondary,#f5f5f5)",
                          borderRadius: 6,
                          fontSize: "0.9em",
                          color: "var(--color-text-secondary,#555)",
                        }}
                      >
                        <span>
                          <strong
                            style={{
                              color: "var(--color-text-primary,#222)",
                            }}
                          >
                            {selectedFarmer.parcels.length}
                          </strong>{" "}
                          parcel
                          {selectedFarmer.parcels.length === 1 ? "" : "s"}
                        </span>
                        <span>
                          <strong
                            style={{
                              color: "var(--color-text-primary,#222)",
                            }}
                          >
                            {selectedFarmer.parcels
                              .reduce(
                                (s, p) =>
                                  s +
                                  (typeof p.totalFarmAreaHa === "number"
                                    ? p.totalFarmAreaHa
                                    : parseFloat(
                                        String(p.totalFarmAreaHa || 0),
                                      )),
                                0,
                              )
                              .toFixed(2)}
                          </strong>{" "}
                          ha total
                        </span>
                        <span>
                          <strong
                            style={{
                              color: "var(--color-text-primary,#222)",
                            }}
                          >
                            {
                              selectedFarmer.parcels.filter(
                                (p) => p.isFarming === true,
                              ).length
                            }
                          </strong>{" "}
                          actively farmed
                        </span>
                        {selectedFarmer.parcels.filter(
                          (p) => p.isFarming === false,
                        ).length > 0 && (
                          <span style={{ color: "#c0392b" }}>
                            ⚠️{" "}
                            <strong>
                              {
                                selectedFarmer.parcels.filter(
                                  (p) => p.isFarming === false,
                                ).length
                              }
                            </strong>{" "}
                            idle
                          </span>
                        )}
                      </div>
                    )}
                    {selectedFarmer.parcels.length === 0 ? (
                      <p className="farmer-modal-no-data">No parcels found</p>
                    ) : (
                      <div className="farmer-modal-parcels-container">
                        {selectedFarmer.parcels.map((parcel, index) => {
                          const isTL =
                            parcel.ownershipTypeTenant ||
                            parcel.ownershipTypeLessee;
                          const hasOwnerName =
                            parcel.tenantLandOwnerName ||
                            parcel.lesseeLandOwnerName;
                          const hasOwnerLink =
                            parcel.tenantLandOwnerId ||
                            parcel.lesseeLandOwnerId;
                          const isUnlinked =
                            isTL && hasOwnerName && !hasOwnerLink;
                          const parsedContractEnd = parcel.contractEndDate
                            ? new Date(parcel.contractEndDate)
                            : null;
                          const contractDateLabel =
                            parsedContractEnd &&
                            !Number.isNaN(parsedContractEnd.getTime())
                              ? parsedContractEnd.toLocaleDateString()
                              : "Not specified";
                          const contractStatus = (() => {
                            if (
                              !parsedContractEnd ||
                              Number.isNaN(parsedContractEnd.getTime())
                            )
                              return null;
                            const endDate = new Date(parsedContractEnd);
                            const today = new Date();
                            endDate.setHours(0, 0, 0, 0);
                            today.setHours(0, 0, 0, 0);
                            return endDate < today ? "Ended" : "Active";
                          })();
                          return (
                            <div
                              key={parcel.id}
                              className="farmer-modal-parcel-card"
                            >
                              <div className="farmer-modal-parcel-header">
                                <h4>
                                  {parcel.parcelNumber &&
                                  parcel.parcelNumber !== "N/A"
                                    ? `Parcel No. ${parcel.parcelNumber}`
                                    : `Parcel #${index + 1}`}
                                </h4>
                              </div>
                              <div className="farmer-modal-parcel-details">
                                <div className="farmer-modal-parcel-item">
                                  <span className="farmer-modal-label">
                                    Role on this parcel:
                                  </span>
                                  <span className="farmer-modal-value">
                                    {parcel.ownershipTypeRegisteredOwner
                                      ? "Registered Owner"
                                      : parcel.ownershipTypeTenant &&
                                          parcel.ownershipTypeLessee
                                        ? "Tenant + Lessee"
                                        : parcel.ownershipTypeTenant
                                          ? "Tenant"
                                          : parcel.ownershipTypeLessee
                                            ? "Lessee"
                                            : "—"}
                                  </span>
                                </div>
                                {isTL && hasOwnerName && (
                                  <div className="farmer-modal-parcel-item">
                                    <span className="farmer-modal-label">
                                      Landowner:
                                    </span>
                                    <span className="farmer-modal-value">
                                      {parcel.tenantLandOwnerName ||
                                        parcel.lesseeLandOwnerName}
                                      {isUnlinked && (
                                        <span
                                          style={{
                                            marginLeft: 8,
                                            fontSize: "11px",
                                            padding: "2px 8px",
                                            borderRadius: 99,
                                            background: "#FAEEDA",
                                            color: "#633806",
                                          }}
                                          title="Text-only name — no FFRS record linked"
                                        >
                                          ⚠️ Unlinked
                                        </span>
                                      )}
                                      {parcel.ownershipDocumentNo && (
                                        <span className="farmer-modal-owner-name">
                                          {" "}
                                          · Doc No: {parcel.ownershipDocumentNo}
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                )}
                                <div className="farmer-modal-parcel-item">
                                  <span className="farmer-modal-label">
                                    Location:
                                  </span>
                                  <span className="farmer-modal-value">
                                    {parcel.farmLocationBarangay},{" "}
                                    {parcel.farmLocationMunicipality}
                                  </span>
                                </div>
                                <div className="farmer-modal-parcel-item">
                                  <span className="farmer-modal-label">
                                    Area:
                                  </span>
                                  <span className="farmer-modal-value">
                                    {(typeof parcel.totalFarmAreaHa === "number"
                                      ? parcel.totalFarmAreaHa
                                      : parseFloat(
                                          String(parcel.totalFarmAreaHa || 0),
                                        )
                                    ).toFixed(2)}{" "}
                                    ha
                                  </span>
                                </div>
                                <div className="farmer-modal-parcel-item">
                                  <span className="farmer-modal-label">
                                    Agrarian Reform Beneficiary:
                                  </span>
                                  <span className="farmer-modal-value">
                                    {parcel.agrarianReformBeneficiary || (
                                      <span style={{ color: "#888" }}>
                                        Not specified
                                      </span>
                                    )}
                                  </span>
                                </div>
                                <div className="farmer-modal-parcel-item">
                                  <span className="farmer-modal-label">
                                    Within Ancestral Domain:
                                  </span>
                                  <span className="farmer-modal-value">
                                    {parcel.withinAncestralDomain || (
                                      <span style={{ color: "#888" }}>
                                        Not specified
                                      </span>
                                    )}
                                  </span>
                                </div>
                                <div className="farmer-modal-parcel-item">
                                  <span className="farmer-modal-label">
                                    Farming Status:
                                  </span>
                                  <span className="farmer-modal-value">
                                    {parcel.isFarming === true ? (
                                      <span
                                        style={{
                                          color: "green",
                                          fontWeight: 500,
                                        }}
                                      >
                                        ✅ Farming
                                      </span>
                                    ) : parcel.isFarming === false ? (
                                      <span
                                        style={{
                                          color: "red",
                                          fontWeight: 500,
                                        }}
                                      >
                                        ❌ Not farming
                                      </span>
                                    ) : (
                                      <span style={{ color: "#888" }}>
                                        Not specified
                                      </span>
                                    )}
                                    {parcel.isFarming === false &&
                                      parcel.farmingStatusReason && (
                                        <span className="farmer-modal-owner-name">
                                          {" "}
                                          — {parcel.farmingStatusReason}
                                        </span>
                                      )}
                                  </span>
                                </div>
                                {parcel.farmingStatusUpdatedAt && (
                                  <div className="farmer-modal-parcel-item">
                                    <span className="farmer-modal-label">
                                      Status Last Updated:
                                    </span>
                                    <span
                                      className="farmer-modal-value"
                                      style={{
                                        fontSize: "0.85em",
                                        color: "#666",
                                      }}
                                    >
                                      {formatDateTime(
                                        parcel.farmingStatusUpdatedAt,
                                      )}
                                    </span>
                                  </div>
                                )}
                                <div className="farmer-modal-parcel-item">
                                  <span className="farmer-modal-label">
                                    Contract End Date:
                                  </span>
                                  <span className="farmer-modal-value">
                                    {contractDateLabel}
                                    {contractStatus && (
                                      <span className="farmer-modal-owner-name">
                                        {` · ${contractStatus}`}
                                      </span>
                                    )}
                                  </span>
                                </div>
                                {parcel.ownershipOthersSpecify && (
                                  <div className="farmer-modal-parcel-item">
                                    <span className="farmer-modal-label">
                                      Other notes:
                                    </span>
                                    <span className="farmer-modal-value">
                                      {parcel.ownershipOthersSpecify}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* ── Land History ─────────────────────────────────── */}
                  <div className="farmer-modal-section">
                    <h3 className="farmer-modal-section-title">
                      📋 Land History
                    </h3>
                    {loadingLandHistory ? (
                      <p style={{ fontSize: "0.85em", color: "#888" }}>
                        Loading land history...
                      </p>
                    ) : modalLandHistory.length === 0 ? (
                      <p className="farmer-modal-no-data">
                        No land history records found.
                      </p>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            fontSize: "12px",
                          }}
                        >
                          <thead>
                            <tr
                              style={{
                                background:
                                  "var(--color-background-secondary,#f5f5f5)",
                              }}
                            >
                              {[
                                "Parcel No.",
                                "Barangay",
                                "Role",
                                "Landowner",
                                "Period",
                                "Change",
                              ].map((h) => (
                                <th
                                  key={h}
                                  style={{
                                    padding: "6px 10px",
                                    textAlign: "left",
                                    fontWeight: 500,
                                    borderBottom:
                                      "0.5px solid var(--color-border-tertiary)",
                                    color: "var(--color-text-secondary)",
                                  }}
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {modalLandHistory.map((h, i) => {
                              const role = h.isRegisteredOwner
                                ? "Owner"
                                : h.isTenant && h.isLessee
                                  ? "Tenant+Lessee"
                                  : h.isTenant
                                    ? "Tenant"
                                    : h.isLessee
                                      ? "Lessee"
                                      : "—";
                              const start = h.periodStartDate
                                ? new Date(
                                    h.periodStartDate,
                                  ).toLocaleDateString()
                                : "?";
                              const end = h.isCurrent
                                ? "Present"
                                : h.periodEndDate
                                  ? new Date(
                                      h.periodEndDate,
                                    ).toLocaleDateString()
                                  : "?";
                              return (
                                <tr
                                  key={h.id}
                                  style={{
                                    background:
                                      i % 2 === 0
                                        ? "transparent"
                                        : "var(--color-background-secondary,#f9f9f9)",
                                  }}
                                >
                                  <td
                                    style={{
                                      padding: "5px 10px",
                                      borderBottom:
                                        "0.5px solid var(--color-border-tertiary)",
                                      fontWeight: h.isCurrent ? 600 : 400,
                                    }}
                                  >
                                    {h.parcelNumber}
                                  </td>
                                  <td
                                    style={{
                                      padding: "5px 10px",
                                      borderBottom:
                                        "0.5px solid var(--color-border-tertiary)",
                                    }}
                                  >
                                    {h.farmLocationBarangay}
                                  </td>
                                  <td
                                    style={{
                                      padding: "5px 10px",
                                      borderBottom:
                                        "0.5px solid var(--color-border-tertiary)",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: "11px",
                                        padding: "2px 7px",
                                        borderRadius: 99,
                                        background: h.isRegisteredOwner
                                          ? "#EAF3DE"
                                          : "#E6F1FB",
                                        color: h.isRegisteredOwner
                                          ? "#27500A"
                                          : "#0C447C",
                                      }}
                                    >
                                      {role}
                                    </span>
                                    {h.isCurrent && (
                                      <span
                                        style={{
                                          marginLeft: 4,
                                          fontSize: "11px",
                                          color: "green",
                                        }}
                                      >
                                        ● Current
                                      </span>
                                    )}
                                  </td>
                                  <td
                                    style={{
                                      padding: "5px 10px",
                                      borderBottom:
                                        "0.5px solid var(--color-border-tertiary)",
                                    }}
                                  >
                                    {h.landOwnerName}
                                  </td>
                                  <td
                                    style={{
                                      padding: "5px 10px",
                                      borderBottom:
                                        "0.5px solid var(--color-border-tertiary)",
                                      fontSize: "11px",
                                      color: "var(--color-text-secondary)",
                                    }}
                                  >
                                    {start} → {end}
                                  </td>
                                  <td
                                    style={{
                                      padding: "5px 10px",
                                      borderBottom:
                                        "0.5px solid var(--color-border-tertiary)",
                                      fontSize: "11px",
                                    }}
                                  >
                                    {h.changeType}
                                    {h.changeReason
                                      ? ` — ${h.changeReason}`
                                      : ""}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JoMasterlist;
