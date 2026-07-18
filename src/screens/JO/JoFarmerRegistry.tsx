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
} from "../../api";
import "../../assets/css/jo css/JoFarmerStyle.css";
import JOSidebar from "../../components/layout/JOSidebar";
import { printHtmlReport } from "../../utils/printHelper";
import "../../assets/css/jo css/FarmerDetailModal.css";
import { FarmerProfileDisplay } from "../../components/FarmerProfile/FarmerProfileDisplay";
import type {
  UnifiedParcel,
  OccupantInfo,
} from "../../components/FarmerProfile/FarmerProfileDisplay";
import {
  getAuditLogger,
  AuditModule,
} from "../../components/Audit/auditLogger";
import { getCurrentUserForAudit } from "../../components/Audit/getCurrentUserForAudit";

// ─────────────────────────────────────────────
// FARMER REGISTRY
// Shows only people who actively work land:
//   • Tenants
//   • Lessees
//   • Owner-farmers (registered owners who farm their own land)
// Excludes "No Parcels" records — those belong in the Masterlist queue.
// CHANGE: No Parcels records are now shown with a ⚠️ flag instead of being hidden.
// Purpose:
//   • Find and filter farmers by role, barangay, and farming status
//   • See who is Farming vs not (X/Y parcels farming format)
//   • Understand the farmer–landowner relationship per parcel
//   • Review and manage farmer records
// ─────────────────────────────────────────────

interface RSBSARecord {
  id: string;
  referenceNumber: string;
  farmerName: string;
  farmerAddress: string;
  farmLocation: string;
  parcelArea: string;
  parcelCount: number;
  currentParcelCount?: number;
  totalParcelCount?: number;
  tenureParcelCount?: number;
  hasCurrentParcels?: boolean;
  // CHANGE: farmingParcelCount tracks how many parcels are actively farmed.
  // Used to render the "X/Y farming" cultivation column.
  // null means the API didn't return a count — we fall back to farmingStatus string.
  farmingParcelCount?: number | null;
  age: number | null;
  dateSubmitted: string;
  status: string;
  landParcel: string;
  farmingStatus?: string;
  archivedAt?: string | null;
  archiveReason?: string | null;
  needsPendingReview?: boolean;
  hasNoParcels?: boolean;
  hasNoLandOwner?: boolean;
  mainLivelihood?: string;
  ownershipType?: {
    registeredOwner: boolean;
    tenant: boolean;
    lessee: boolean;
    tenantLessee?: boolean;
    category?: "registeredOwner" | "tenantLessee" | "unknown";
  };
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
  is_cultivating?: boolean | null;
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
  withinAncestralDomain: string;
  ownershipDocumentNo: string;
  agrarianReformBeneficiary: string;
  ownershipOthersSpecify: string;
  contractEndDate?: string | null;
  isFarming?: boolean | null;
  isCultivating?: boolean | null;
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

// CHANGE: dateSubmitted removed from SortKey — column is no longer visible.
// It is still used as the DEFAULT_SORT_CONFIG so records load newest-first,
// but staff no longer see a sortable date column in the table header.
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

const JoFarmerRegistry: React.FC = () => {
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

  const [rsbsaRecords, setRsbsaRecords] = useState<RSBSARecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [selectedBarangay, setSelectedBarangay] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFarmer, setSelectedFarmer] = useState<FarmerDetail | null>(
    null,
  );
  const [loadingFarmerDetail, setLoadingFarmerDetail] = useState(false);
  const [showModal, setShowModal] = useState(false);
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
  const [showPrintFarmerModal, setShowPrintFarmerModal] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [sortConfigs, setSortConfigs] = useState<
    Array<{ key: SortKey; direction: SortDirection }>
  >([{ ...DEFAULT_SORT_CONFIG }]);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(
    new Set(),
  );
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  const showUpdateNotification = (
    message: string,
    type: "success" | "error",
  ) => {
    setUpdateNotification({ show: true, type, message });
    setTimeout(
      () => setUpdateNotification((prev) => ({ ...prev, show: false })),
      3200,
    );
  };

  const fetchFarmerDetails = async (
    farmerId: string,
    summaryRecord?: RSBSARecord,
  ) => {
    try {
      setLoadingFarmerDetail(true);

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

      const formattedSubmittedDate = (() => {
        if (!selectedRecord?.dateSubmitted) return "N/A";
        const parsed = new Date(selectedRecord.dateSubmitted);
        return Number.isNaN(parsed.getTime())
          ? "N/A"
          : parsed.toLocaleDateString();
      })();

      const activities: string[] = [];
      if (data.farmerRice || data.FARMER_RICE || data.farmer_rice)
        activities.push("Rice");
      if (data.farmerCorn || data.FARMER_CORN || data.farmer_corn)
        activities.push("Corn");
      if (
        data.farmerOtherCrops ||
        data.FARMER_OTHER_CROPS ||
        data.farmer_other_crops
      )
        activities.push(
          `Other Crops: ${data.farmerOtherCropsText || data.FARMER_OTHER_CROPS_TEXT || data.farmer_other_crops_text || ""}`,
        );
      if (
        data.farmerLivestock ||
        data.FARMER_LIVESTOCK ||
        data.farmer_livestock
      )
        activities.push(
          `Livestock: ${data.farmerLivestockText || data.FARMER_LIVESTOCK_TEXT || data.farmer_livestock_text || ""}`,
        );
      if (data.farmerPoultry || data.FARMER_POULTRY || data.farmer_poultry)
        activities.push(
          `Poultry: ${data.farmerPoultryText || data.FARMER_POULTRY_TEXT || data.farmer_poultry_text || ""}`,
        );
      if (
        activities.length === 0 &&
        (data.mainLivelihood || data["MAIN LIVELIHOOD"] || data.main_livelihood)
      )
        activities.push(
          data.mainLivelihood ||
            data["MAIN LIVELIHOOD"] ||
            data.main_livelihood,
        );

      const backendName = farmerData.farmerName || "";
      const reformattedFarmerName = (() => {
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
        withinAncestralDomain: p.within_ancestral_domain || "",
        ownershipDocumentNo: p.ownership_document_no || "",
        agrarianReformBeneficiary: p.agrarian_reform_beneficiary || "",
        ownershipOthersSpecify: p.ownership_others_specify || "",
        contractEndDate: p.contract_end_date || p.contractEndDate || null,
        isFarming:
          typeof p.is_farming === "boolean"
            ? p.is_farming
            : typeof p.is_cultivating === "boolean"
              ? p.is_cultivating
              : null,
        isCultivating:
          typeof p.is_cultivating === "boolean" ? p.is_cultivating : null,
        farmingStatusReason: p.farming_status_reason || null,
        farmingStatusUpdatedAt: p.farming_status_updated_at || null,
        role: p.role || "",
        occupants: p.occupants || [],
      }));

      if (mappedParcels.length === 0) {
        const submissionFarmLocation =
          data.farmLocation || data["FARM LOCATION"] || "";
        const submissionParcelArea = parseFloat(
          data.totalFarmArea ||
            data["TOTAL FARM AREA"] ||
            data.parcelArea ||
            data["PARCEL AREA"] ||
            "0",
        );
        const submissionOwnership = data.ownershipType || {};
        if (submissionFarmLocation || submissionParcelArea > 0) {
          const locationParts = submissionFarmLocation
            .split(",")
            .map((s: string) => s.trim());
          mappedParcels = [
            {
              id: `submission-${farmerId}`,
              parcelNumber: "N/A",
              farmLocationBarangay:
                locationParts[0] || data.barangay || data["BARANGAY"] || "N/A",
              farmLocationMunicipality:
                locationParts[1] ||
                data.municipality ||
                data["MUNICIPALITY"] ||
                "Dumangas",
              totalFarmAreaHa: submissionParcelArea,
              ownershipTypeRegisteredOwner:
                submissionOwnership.registeredOwner ||
                data["OWNERSHIP_TYPE_REGISTERED_OWNER"] ||
                false,
              ownershipTypeTenant:
                submissionOwnership.tenant ||
                data["OWNERSHIP_TYPE_TENANT"] ||
                false,
              ownershipTypeLessee:
                submissionOwnership.lessee ||
                data["OWNERSHIP_TYPE_LESSEE"] ||
                false,
              tenantLandOwnerName: "",
              lesseeLandOwnerName: "",
              withinAncestralDomain: "",
              ownershipDocumentNo: "",
              agrarianReformBeneficiary: "",
              ownershipOthersSpecify: "",
              contractEndDate: null,
            },
          ];
        }
      }

      const normalizedDetailAge = normalizeAgeValue(
        farmerData.age ?? data.age ?? data.AGE,
        data.dateOfBirth ||
          data.birthdate ||
          data["DATE OF BIRTH"] ||
          data.BIRTHDATE ||
          null,
      );

      const resolvedBirthdate = (() => {
        const raw =
          data.dateOfBirth ||
          data.birthdate ||
          data["DATE OF BIRTH"] ||
          data.BIRTHDATE ||
          null;
        if (!raw) return null;
        const parsed = new Date(raw);
        return Number.isNaN(parsed.getTime())
          ? null
          : parsed.toLocaleDateString();
      })();

      setSelectedFarmer({
        id: farmerId,
        referenceNumber: selectedRecord?.referenceNumber || "N/A",
        dateSubmitted: formattedSubmittedDate,
        recordStatus: selectedRecord?.status || "N/A",
        birthdate: resolvedBirthdate,
        archivedAt: selectedRecord?.archivedAt ?? null,
        archiveReason: selectedRecord?.archiveReason ?? null,
        farmerName: reformattedFarmerName,
        farmerAddress: farmerData.farmerAddress || "N/A",
        age: normalizedDetailAge ?? "N/A",
        gender: data.gender || "N/A",
        mainLivelihood: data.mainLivelihood || "N/A",
        farmingActivities: activities,
        parcels: mappedParcels,
        profilePicture: farmerData.profilePicture || null,
      });
      setShowModal(true);
    } catch (err: any) {
      console.error("Error fetching farmer details:", err);
      alert("Failed to load farmer details");
    } finally {
      setLoadingFarmerDetail(false);
    }
  };

  const calculateAgeFromBirthdate = (
    birthdate?: string | null,
  ): number | null => {
    if (!birthdate) return null;
    const birthDate = new Date(birthdate);
    if (Number.isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    )
      age--;
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
      const parsed = Number(ageValue);
      if (Number.isFinite(parsed) && parsed >= 0) return Math.floor(parsed);
    }
    return calculateAgeFromBirthdate(birthdate);
  };

  const ageToInputValue = (ageValue: unknown): string => {
    if (ageValue === null || ageValue === undefined) return "";
    return String(ageValue);
  };

  const parseAgeInputToNumber = (ageValue?: string): number | null => {
    if (!ageValue || ageValue.trim() === "") return null;
    const parsed = Number(ageValue);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.floor(parsed);
  };

  useEffect(() => {
    fetchRSBSARecords();
  }, []);

  // Fire-and-forget: write-once status update for pending-review farmers.
  // Only runs if status is not already pending/inactive/archived.
  useEffect(() => {
    if (rsbsaRecords.length === 0) return;
    const toFlag = rsbsaRecords.filter((r) => {
      if (!r.needsPendingReview) return false;
      const s = (r.status || "").toLowerCase().trim();
      return s !== "pending" && s !== "inactive" && s !== "archived";
    });
    if (toFlag.length === 0) return;
    const ids = toFlag.map((r) => r.id);
    supabase
      .from("rsbsa_submission")
      .update({ status: "inactive" })
      .in("id", ids)
      .then(({ error }) => {
        if (error) console.error("No-land flag status update error:", error);
      });
  }, [rsbsaRecords]);

  const fetchRSBSARecords = async () => {
    try {
      const response = await getRsbsaSubmissions();
      if (response.error) throw new Error(response.error);
      const data = response.data || [];
      const allData = Array.isArray(data) ? data : [];
      const parseNumberValue = (value: unknown): number | null => {
        if (value === null || value === undefined || value === "") return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      };

      let formattedRecords: RSBSARecord[] = allData.map(
        (item: any, idx: number) => {
          const referenceNumber = String(
            item.referenceNumber ?? `RSBSA-${idx + 1}`,
          );
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
            const parseAreaTotal = (value: unknown): number | null => {
              if (value === undefined || value === null) return null;
              const tokens = String(value).match(/-?\d+(?:\.\d+)?/g);
              if (!tokens || tokens.length === 0) return null;
              const total = tokens.reduce((sum, t) => {
                const n = Number(t);
                return sum + (Number.isFinite(n) ? n : 0);
              }, 0);
              return Number.isFinite(total) && total > 0 ? total : null;
            };
            const fromTotal = parseAreaTotal(
              item.totalFarmArea ?? item["TOTAL FARM AREA"],
            );
            if (fromTotal !== null) return String(fromTotal);
            const direct = item.parcelArea ?? item["PARCEL AREA"];
            const fromDirect = parseAreaTotal(direct);
            if (fromDirect !== null) return String(fromDirect);
            if (
              direct !== undefined &&
              direct !== null &&
              String(direct).trim() !== ""
            )
              return String(direct);
            const match = /\(([^)]+)\)/.exec(landParcel);
            return match ? match[1] : "—";
          })();

          const cultivationSummary =
            item.cultivationSummary ||
            item.cultivation_summary ||
            item.cultivationCounts ||
            item.cultivation_counts ||
            null;
          const cultivationTotal = parseNumberValue(cultivationSummary?.total);
          const cultivationActive = parseNumberValue(
            cultivationSummary?.active,
          );

          const hasCurrentParcels =
            item.hasCurrentParcels === true
              ? true
              : item.hasCurrentParcels === false
                ? false
                : undefined;

          const currentParcelCountValue = parseNumberValue(
            item.currentParcelCount ?? item.current_parcel_count,
          );
          const reportedParcelCountValue = parseNumberValue(
            item.parcelCount ??
              item.parcel_count ??
              item["PARCEL COUNT"] ??
              cultivationTotal,
          );
          const parcelCount =
            currentParcelCountValue !== null
              ? Math.max(0, Math.floor(currentParcelCountValue))
              : hasCurrentParcels === false
                ? 0
                : reportedParcelCountValue !== null
                  ? Math.max(0, Math.floor(reportedParcelCountValue))
                  : 0;
          const totalParcelCountValue = parseNumberValue(
            item.totalParcelCount ?? item.total_parcel_count,
          );
          const totalParcelCount =
            totalParcelCountValue !== null
              ? Math.max(0, Math.floor(totalParcelCountValue))
              : reportedParcelCountValue !== null
                ? Math.max(0, Math.floor(reportedParcelCountValue))
                : parcelCount;
          const archivedAt =
            item.archivedAt ??
            item.archived_at ??
            item._raw?.archived_at ??
            null;
          const normalizedStatus = String(item.status || "")
            .toLowerCase()
            .trim();
          const ownership = item.ownershipType || {};
          const isTenantOrLessee =
            ownership.tenant === true ||
            ownership.lessee === true ||
            ownership.tenantLessee === true ||
            ownership.category === "tenantLessee";
          const isOwnerRole =
            !isTenantOrLessee &&
            (ownership.registeredOwner === true ||
              ownership.category === "registeredOwner");
          const hasNoParcels =
            isOwnerRole &&
            (hasCurrentParcels === false ||
              parcelCount === 0 ||
              normalizedStatus === "no parcels");

          const farmingParcelCountValue = parseNumberValue(
            item.farmingParcelCount ??
              item.farming_parcel_count ??
              item["FARMING_PARCEL_COUNT"] ??
              cultivationActive,
          );
          const farmingParcelCount =
            farmingParcelCountValue !== null
              ? Math.max(0, Math.floor(farmingParcelCountValue))
              : null;

          return {
            id: String(item.id),
            referenceNumber,
            farmerName: String(reformattedName),
            farmerAddress: String(
              item.farmerAddress ?? item.addressBarangay ?? "—",
            ),
            farmLocation: String(item.farmLocation ?? "—"),
            parcelArea,
            parcelCount,
            currentParcelCount: parcelCount,
            totalParcelCount,
            tenureParcelCount: isTenantOrLessee ? totalParcelCount : 0,
            hasCurrentParcels,
            // CHANGE: Extract farmingParcelCount from API if available.
            // Falls back to null, which triggers the farmingStatus string fallback
            // in formatCultivation().
            farmingParcelCount,
            age: normalizeAgeValue(
              item.age,
              item.birthdate ??
                item.dateOfBirth ??
                item.BIRTHDATE ??
                item["DATE OF BIRTH"] ??
                null,
            ),
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
            archivedAt,
            archiveReason:
              item.archiveReason ??
              item.archive_reason ??
              item._raw?.archive_reason ??
              null,
            ownershipType: item.ownershipType,
            mainLivelihood:
              item.mainLivelihood || item._raw?.["MAIN LIVELIHOOD"] || "",
            hasNoParcels,
          };
        },
      );

      // Batch query land_history_association for tenant/lessee transfer detection.
      // A record is flagged needsPendingReview if it has a history entry where
      // is_current = false and change_type contains 'transfer', meaning their
      // parcel's ownership has changed hands.
      // NOTE: column is 'farmer_id' per schema — update if it differs.
      const tenantLesseeIds = formattedRecords
        .filter((r) => {
          const ot = r.ownershipType;
          return (
            ot?.tenant === true ||
            ot?.lessee === true ||
            ot?.tenantLessee === true
          );
        })
        .map((r) => r.id);

      // Batch query parcel owner names to detect tenants/lessees with no
      // landowner filled in. Runs alongside the transfer-history query.
      const submissionsWithOwnerLink = new Set<string>();
      const tenantLesseeParcelCountById = new Map<string, number>();
      const tenantLesseeFarmingCountById = new Map<string, number>();

      // Batch query for owner-farmer parcels — counts is_cultivating OR
      // is_farming so parcels set during land owner registration are included.
      const ownerFarmerIds = formattedRecords
        .filter((r) => {
          const ot = r.ownershipType;
          return (
            ot?.registeredOwner === true || ot?.category === "registeredOwner"
          );
        })
        .map((r) => r.id);

      const ownerFarmerFarmingCountById = new Map<string, number>();

      if (ownerFarmerIds.length > 0) {
        const { data: ownerParcelRows } = await supabase
          .from("rsbsa_farm_parcels")
          .select("submission_id, is_farming, is_cultivating, is_current_owner")
          .in("submission_id", ownerFarmerIds)
          .eq("ownership_type_registered_owner", true);

        (ownerParcelRows || []).forEach((p: any) => {
          if (!p.submission_id) return;
          if (p.is_current_owner === false) return; // Skip transferred/inactive parcels
          const id = String(p.submission_id);
          // Count parcel as farmed if either field is true.
          // null is NOT counted here — owner-farmers must explicitly confirm
          // cultivation via registration or JO edit (unlike tenant/lessee
          // records where null defaults to farming assumed).
          if (p.is_cultivating === true || p.is_farming === true) {
            ownerFarmerFarmingCountById.set(
              id,
              (ownerFarmerFarmingCountById.get(id) || 0) + 1,
            );
          }
        });

        // Overwrite farmingParcelCount for owner-farmer records with the
        // direct parcel count — more accurate than cultivationSummary?.active.
        formattedRecords = formattedRecords.map((r) => {
          const isOwner =
            r.ownershipType?.registeredOwner === true ||
            r.ownershipType?.category === "registeredOwner";
          if (!isOwner) return r;
          const directCount = ownerFarmerFarmingCountById.get(r.id) ?? null;
          return {
            ...r,
            farmingParcelCount:
              directCount !== null ? directCount : r.farmingParcelCount,
          };
        });
      }

      if (tenantLesseeIds.length > 0) {
        const [transferResult, ownerNameResult] = await Promise.all([
          supabase
            .from("land_history_association")
            .select("farmer_id")
            .in("farmer_id", tenantLesseeIds)
            .eq("is_current", false)
            .ilike("change_type", "%transfer%"),
          supabase
            .from("rsbsa_farm_parcels")
            .select(
              "submission_id, tenant_land_owner_id, lessee_land_owner_id, tenant_land_owner_name, lessee_land_owner_name, is_farming, is_cultivating, is_current_owner",
            )
            .in("submission_id", tenantLesseeIds)
            .or("ownership_type_tenant.eq.true,ownership_type_lessee.eq.true"),
        ]);

        const transferredIds = new Set(
          (transferResult.data || []).map((h: any) => String(h.farmer_id)),
        );

        (ownerNameResult.data || []).forEach((p: any) => {
          if (!p.submission_id) return;
          if (p.is_current_owner === false) return; // Skip deactivated tenant parcels
          const id = String(p.submission_id);
          tenantLesseeParcelCountById.set(
            id,
            (tenantLesseeParcelCountById.get(id) || 0) + 1,
          );
          if (p.is_farming === true || p.is_farming === null) {
            tenantLesseeFarmingCountById.set(
              id,
              (tenantLesseeFarmingCountById.get(id) || 0) + 1,
            );
          }
          const name =
            p.tenant_land_owner_name || p.lessee_land_owner_name || "";
          const ownerId = p.tenant_land_owner_id || p.lessee_land_owner_id;
          if (name || ownerId) submissionsWithOwnerLink.add(id);
        });

        formattedRecords = formattedRecords.map((r) => {
          const isTenantLesseeRecord = tenantLesseeIds.includes(r.id);
          const tenureParcelCount = tenantLesseeParcelCountById.get(r.id) || 0;
          const farmingParcelCount =
            tenantLesseeFarmingCountById.get(r.id) ?? null;

          return {
            ...r,
            needsPendingReview: transferredIds.has(r.id),
            parcelCount: isTenantLesseeRecord
              ? tenureParcelCount
              : r.parcelCount,
            tenureParcelCount: isTenantLesseeRecord
              ? tenureParcelCount
              : r.tenureParcelCount,
            farmingParcelCount: isTenantLesseeRecord
              ? farmingParcelCount
              : r.farmingParcelCount,
            hasNoParcels: isTenantLesseeRecord
              ? tenureParcelCount === 0
              : r.hasNoParcels,
            hasNoLandOwner:
              isTenantLesseeRecord &&
              tenureParcelCount > 0 &&
              !submissionsWithOwnerLink.has(r.id),
          };
        });
      }

      // Exclude landowner-only registrations from the Farmer Registry.
      // These are people registered via JoRsbsaRegisLandowner who haven't
      // been registered as farmers yet through JoRsbsaRegistration.
      formattedRecords = formattedRecords.filter((record) => {
        if (record.archivedAt) return false;
        const livelihood = String(record.mainLivelihood || "")
          .toLowerCase()
          .trim();
        return livelihood !== "landowner";
      });

      setRsbsaRecords(formattedRecords);
      setLoading(false);
    } catch (err: any) {
      setError(err.message ?? "Failed to load RSBSA records");
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleWindowClick = () => {
      setOpenMenuId(null);
      setShowPrintFarmerModal(false);
    };
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, []);

  useEffect(() => {
    setSelectedRecordIds((previous) => {
      const validIds = new Set(rsbsaRecords.map((r) => r.id));
      const next = new Set<string>();
      previous.forEach((id) => {
        if (validIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [rsbsaRecords]);

  const getRecordBarangay = (record: RSBSARecord): string => {
    const fromAddress = String(record.farmerAddress || "")
      .split(",")[0]
      ?.trim();
    const fromFarmLocation = String(record.farmLocation || "")
      .split(",")[0]
      ?.trim();
    const candidate =
      fromAddress && fromAddress !== "—" ? fromAddress : fromFarmLocation;
    if (!candidate) return "—";
    const normalized = candidate.toLowerCase();
    if (["—", "n/a", "na", "unknown"].includes(normalized)) return "—";
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

  const filteredRecords = rsbsaRecords
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
      const flags = getOwnershipFlags(record);

      let matchesRole = true;
      if (selectedRole === "tenant") {
        matchesRole =
          flags.tenant ||
          (flags.category === "tenantLessee" &&
            flags.tenantLessee &&
            !flags.lessee);
      } else if (selectedRole === "lessee") {
        matchesRole =
          flags.lessee ||
          (flags.category === "tenantLessee" &&
            flags.tenantLessee &&
            !flags.tenant);
      } else if (selectedRole === "owner") {
        matchesRole = flags.category === "registeredOwner" || flags.owner;
      } else if (selectedRole === "active") {
        matchesRole = activeStatuses.has(normalizedStatus);
      } else if (selectedRole === "notActive") {
        matchesRole = notActiveStatuses.has(normalizedStatus);
      } else if (selectedRole === "pendingReview") {
        matchesRole = record.needsPendingReview === true;
      } else if (selectedRole === "noParcels") {
        matchesRole = record.hasNoParcels === true;
      } else if (selectedRole === "noLandOwner") {
        matchesRole = record.hasNoLandOwner === true;
      }

      if (!matchesRole) return false;

      if (selectedBarangay !== "all") {
        const recordBarangay = getRecordBarangay(record);
        if (
          recordBarangay.localeCompare(selectedBarangay, undefined, {
            sensitivity: "base",
          }) !== 0
        )
          return false;
      }

      const q = searchQuery.toLowerCase();
      return (
        record.farmerName.toLowerCase().includes(q) ||
        record.referenceNumber.toLowerCase().includes(q) ||
        record.farmerAddress.toLowerCase().includes(q) ||
        record.farmLocation.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      // Flagged rows always sink to the bottom regardless of other sort keys
      const aFlag =
        a.needsPendingReview || a.hasNoParcels || a.hasNoLandOwner ? 1 : 0;
      const bFlag =
        b.needsPendingReview || b.hasNoParcels || b.hasNoLandOwner ? 1 : 0;
      if (aFlag !== bFlag) return aFlag - bFlag;

      const parseAreaValue = (value: string) => {
        const tokens = String(value || "").match(/-?\d+(?:\.\d+)?/g);
        if (!tokens || tokens.length === 0) return 0;
        const total = tokens.reduce((sum, t) => {
          const n = Number(t);
          return sum + (Number.isFinite(n) ? n : 0);
        }, 0);
        return Number.isFinite(total) ? total : 0;
      };

      for (const config of sortConfigs) {
        const factor = config.direction === "asc" ? 1 : -1;
        if (config.key === "dateSubmitted") {
          const aTime = Date.parse(a.dateSubmitted);
          const bTime = Date.parse(b.dateSubmitted);
          const result =
            ((Number.isNaN(aTime) ? -Infinity : aTime) -
              (Number.isNaN(bTime) ? -Infinity : bTime)) *
            factor;
          if (result !== 0) return result;
          continue;
        }
        if (config.key === "status") {
          const result = a.status.localeCompare(b.status) * factor;
          if (result !== 0) return result;
          continue;
        }
        if (config.key === "farmerName") {
          const result =
            a.farmerName.localeCompare(b.farmerName, undefined, {
              sensitivity: "base",
            }) * factor;
          if (result !== 0) return result;
          continue;
        }
        const result =
          (parseAreaValue(a.parcelArea) - parseAreaValue(b.parcelArea)) *
          factor;
        if (result !== 0) return result;
      }
      return 0;
    });

  const farmerCounts = useMemo(() => {
    const base = rsbsaRecords;
    const activeStatuses = new Set([
      "submitted",
      "approved",
      "active",
      "active farmer",
    ]);
    const total = base.length;
    const active = base.filter((r) =>
      activeStatuses.has((r.status || "").toLowerCase().trim()),
    ).length;
    const tenants = base.filter((r) => getOwnershipFlags(r).tenant).length;
    const lessees = base.filter((r) => getOwnershipFlags(r).lessee).length;
    const owners = base.filter((r) => {
      const f = getOwnershipFlags(r);
      return f.category === "registeredOwner" || f.owner;
    }).length;
    const noParcels = base.filter((r) => r.hasNoParcels === true).length;
    return {
      total,
      active,
      tenants,
      lessees,
      owners,
      noParcels,
      noLandOwner: base.filter((r) => r.hasNoLandOwner === true).length,
    };
  }, [rsbsaRecords]);

  // CHANGE: Column count updated to 9 — checkbox + Farmer, Barangay, Role,
  // Parcels, Total Area, Cultivation, Status, Actions.
  const VISIBLE_COLUMN_COUNT = 9;

  const allFilteredSelected =
    filteredRecords.length > 0 &&
    filteredRecords.every((r) => selectedRecordIds.has(r.id));

  const toggleSelectAllFiltered = () => {
    setSelectedRecordIds((previous) => {
      const next = new Set(previous);
      if (allFilteredSelected)
        filteredRecords.forEach((r) => next.delete(r.id));
      else filteredRecords.forEach((r) => next.add(r.id));
      return next;
    });
  };

  const toggleSelectRecord = (id: string) => {
    setSelectedRecordIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSortChange = (key: SortKey) => {
    setSortConfigs((previous) => {
      const defaultDirection = getDefaultSortDirection(key);
      const hasOnlyDefault =
        previous.length === 1 &&
        previous[0].key === DEFAULT_SORT_CONFIG.key &&
        previous[0].direction === DEFAULT_SORT_CONFIG.direction;
      if (hasOnlyDefault && key !== "dateSubmitted")
        return [{ key, direction: defaultDirection }];
      const existingIndex = previous.findIndex((c) => c.key === key);
      if (existingIndex >= 0) {
        return previous.map((c) =>
          c.key === key
            ? { ...c, direction: c.direction === "asc" ? "desc" : "asc" }
            : c,
        );
      }
      const next = [...previous, { key, direction: defaultDirection }];
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
    const index = sortConfigs.findIndex((c) => c.key === key);
    if (index === -1) return "↕";
    return `${sortConfigs[index].direction === "asc" ? "▲" : "▼"}${index + 1}`;
  };

  const isSortActive = (key: SortKey) => sortConfigs.some((c) => c.key === key);

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return "";
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleString();
  };

  const formatParcelArea = (parcelArea: string) => {
    const tokens = String(parcelArea || "").match(/-?\d+(?:\.\d+)?/g);
    if (tokens && tokens.length > 0) {
      const total = tokens.reduce((sum, t) => {
        const n = Number(t);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0);
      if (Number.isFinite(total) && total > 0) {
        return `${total.toLocaleString(undefined, { minimumFractionDigits: total % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })} ha`;
      }
    }
    return parcelArea && parcelArea !== "—" ? parcelArea : "—";
  };

  // CHANGE: formatCultivation replaces formatFarmingStatus for the table column.
  // Returns "X/Y farming" using farmingParcelCount when available from the API.
  // Falls back to inferring from the farmingStatus string when the API doesn't
  // return a count (e.g. "Farming" → all parcels active, "Not farming" → none).
  const formatCultivation = (record: RSBSARecord): string => {
    const total = record.parcelCount;

    // Preferred path: API returned an explicit count
    if (
      record.farmingParcelCount !== null &&
      record.farmingParcelCount !== undefined
    ) {
      return `${record.farmingParcelCount}/${total} farming`;
    }

    // Fallback: infer from farmingStatus string
    const status = (record.farmingStatus || "").toLowerCase().trim();
    if (status === "farming" || status === "actively farming")
      return `${total}/${total} farming`;
    if (status === "not farming" || status === "not_farming")
      return `0/${total} farming`;
    // "Mixed" without an exact count is intentionally left blank in the table.
    if (status === "mixed") return "-";

    return "-";
  };

  const formatRecordStatus = (status?: string | null) => {
    const normalized = String(status || "")
      .toLowerCase()
      .trim();
    if (!normalized || normalized === "not submitted") return "Not Submitted";
    const activeStatuses = new Set([
      "submitted",
      "approved",
      "active",
      "active farmer",
    ]);
    const inactiveStatuses = new Set([
      "not submitted",
      "not_active",
      "not active",
      "draft",
      "pending",
      "not approved",
      "inactive",
    ]);
    if (activeStatuses.has(normalized)) return "Active";
    if (inactiveStatuses.has(normalized)) return "Inactive";
    return status || "Not Submitted";
  };

  const buildPrintFilterLabel = () => {
    const parts: string[] = [];
    if (selectedBarangay !== "all") parts.push(`Barangay: ${selectedBarangay}`);
    if (selectedRole !== "all") {
      const roleLabelMap: Record<string, string> = {
        tenant: "Tenant",
        lessee: "Lessee",
        owner: "Owner-farmer",
        active: "Active",
        notActive: "Not Active",
      };
      parts.push(`Role: ${roleLabelMap[selectedRole] || selectedRole}`);
    }
    if (searchQuery.trim()) parts.push(`Search: ${searchQuery.trim()}`);
    return parts.length > 0 ? parts.join(" · ") : "All Records";
  };

  const resolveLandownerNames = async (record: RSBSARecord) => {
    const response = await getFarmParcels(record.id);
    if (response.error) return "—";
    const parcels = (response.data || []) as Parcel[];
    const names = new Set<string>();

    parcels.forEach((parcel) => {
      if (parcel.ownership_type_registered_owner) {
        if (record.farmerName) names.add(record.farmerName);
      }

      if (parcel.ownership_type_tenant && parcel.tenant_land_owner_name) {
        names.add(parcel.tenant_land_owner_name);
      }

      if (parcel.ownership_type_lessee && parcel.lessee_land_owner_name) {
        names.add(parcel.lessee_land_owner_name);
      }

      if (
        !parcel.ownership_type_registered_owner &&
        !parcel.ownership_type_tenant &&
        !parcel.ownership_type_lessee
      ) {
        if (parcel.tenant_land_owner_name)
          names.add(parcel.tenant_land_owner_name);
        if (parcel.lessee_land_owner_name)
          names.add(parcel.lessee_land_owner_name);
      }
    });

    if (names.size === 0) return "—";
    return Array.from(names)
      .map((name) => String(name).trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .join(" | ");
  };

  const handlePrintFarmer = async (
    scope: "all" | "selected",
    singleRecord?: RSBSARecord,
  ) => {
    const records = singleRecord
      ? [singleRecord]
      : scope === "selected"
        ? filteredRecords.filter((r) => selectedRecordIds.has(r.id))
        : filteredRecords;

    if (records.length === 0) {
      showUpdateNotification("No records to print.", "error");
      return;
    }

    const filterLabel = singleRecord
      ? `Farmer: ${singleRecord.farmerName}`
      : buildPrintFilterLabel();

    const landownerNames = await Promise.all(
      records.map(async (record) => resolveLandownerNames(record)),
    );

    const rows = records
      .map((r, index) => {
        const barangay = getRecordBarangay(r) || "—";
        const role = getOwnershipLabel(r) || "—";
        const landownerName = landownerNames[index] || "—";
        const parcels = `${r.parcelCount} ${r.parcelCount === 1 ? "parcel" : "parcels"}`;
        const area = formatParcelArea(r.parcelArea || "—");
        const farmingStatus = formatCultivation(r) || "—";
        return `<tr>
          <td>${index + 1}</td>
          <td>${r.farmerName}</td>
          <td>${barangay}</td>
          <td>${role}</td>
          <td>${landownerName}</td>
          <td>${parcels}</td>
          <td>${area}</td>
          <td>${farmingStatus}</td>
        </tr>`;
      })
      .join("");

    printHtmlReport({
      title: "Farmer Registry — Dumangas, Iloilo",
      reportName: "Farmer Registry",
      filterLabel,
      totalCount: records.length,
      tableHeaderHtml: "<th>#</th><th>Farmer Name</th><th>Barangay</th><th>Role</th><th>Landowner Name</th><th>Parcels</th><th>Total Area</th><th>Farming Land Status</th>",
      tableBodyHtml: rows,
      printedBy: "JO Staff",
    });
  };

  const getOwnershipLabel = (record: RSBSARecord) => {
    const flags = getOwnershipFlags(record);
    if (flags.owner && flags.tenant && flags.lessee)
      return "Owner + Tenant + Lessee";
    if (flags.owner && flags.tenant) return "Owner + Tenant";
    if (flags.owner && flags.lessee) return "Owner + Lessee";
    if (flags.tenant && flags.lessee) return "Tenant + Lessee";
    if (flags.tenant) return "Tenant";
    if (flags.lessee) return "Lessee";
    if (flags.category === "registeredOwner" || flags.owner)
      return "Owner-farmer";
    if (flags.tenantLessee) return "Tenant / Lessee";
    return "—";
  };

  const getOwnershipClass = (record: RSBSARecord) => {
    const flags = getOwnershipFlags(record);
    if (flags.owner && (flags.tenant || flags.lessee))
      return "jo-farmer-ownership-mixed";
    if (flags.category === "registeredOwner" || flags.owner)
      return "jo-farmer-ownership-owner";
    if (flags.tenant && flags.lessee) return "jo-farmer-ownership-mixed";
    if (flags.tenant) return "jo-farmer-ownership-tenant";
    if (flags.lessee) return "jo-farmer-ownership-lessee";
    if (flags.tenantLessee) return "jo-farmer-ownership-tenant";
    return "jo-farmer-ownership-unknown";
  };

  const getFarmerInitials = (fullName: string) => {
    const cleaned = (fullName || "")
      .replace(/,/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || "");
    return cleaned.join("") || "NA";
  };

  const handleCancel = () => {
    setEditingRecord(null);
    setEditFormData({});
    setEditError(null);
    setEditingParcels([]);
    setParcelErrors({});
  };

  const parseName = (
    fullName: string,
  ): { lastName: string; firstName: string; middleName: string } => {
    if (!fullName) return { lastName: "", firstName: "", middleName: "" };
    const parts = fullName
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0)
      return { lastName: "", firstName: "", middleName: "" };
    if (parts.length === 1)
      return { lastName: parts[0] || "", firstName: "", middleName: "" };
    const firstMiddleParts = (parts[1] || "")
      .split(" ")
      .map((p) => p.trim())
      .filter(Boolean);
    return {
      lastName: parts[0] || "",
      firstName: firstMiddleParts[0] || "",
      middleName: firstMiddleParts.slice(1).join(" ") || "",
    };
  };

  const parseAddress = (
    address: string,
  ): { barangay: string; municipality: string } => {
    if (!address) return { barangay: "", municipality: "" };
    const parts = address
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return { barangay: "", municipality: "" };
    if (parts.length === 1)
      return { barangay: parts[0] || "", municipality: "" };
    return { barangay: parts[0] || "", municipality: parts[1] || "" };
  };

  const normalizeText = (value: string): string => value.trim().toLowerCase();

  const resolveBarangayForEdit = (
    addressBarangay: string,
    farmLocation: string,
  ): string => {
    const matchBarangay = (candidate: string): string => {
      if (!candidate) return "";
      const exact = barangays.find(
        (b) => normalizeText(b) === normalizeText(candidate),
      );
      return exact || "";
    };
    return (
      matchBarangay(addressBarangay) ||
      matchBarangay(
        parseAddress(farmLocation || "").barangay || farmLocation,
      ) ||
      ""
    );
  };

  const handleEdit = async (recordId: string) => {
    const recordToEdit = rsbsaRecords.find((r) => r.id === recordId);
    if (recordToEdit) {
      const { lastName, firstName, middleName } = parseName(
        recordToEdit.farmerName || "",
      );
      const parsedAddress = parseAddress(recordToEdit.farmerAddress || "");
      const parsedFarmLocation = parseAddress(recordToEdit.farmLocation || "");
      const resolvedBarangay = resolveBarangayForEdit(
        parsedAddress.barangay,
        recordToEdit.farmLocation || "",
      );
      const resolvedMunicipality = (() => {
        const fromAddress = (parsedAddress.municipality || "").trim();
        if (fromAddress && normalizeText(fromAddress) !== "iloilo")
          return fromAddress;
        return (parsedFarmLocation.municipality || "").trim() || "Dumangas";
      })();

      setEditingRecord(recordToEdit);
      setEditError(null);
      setEditFormData({
        farmerName: recordToEdit.farmerName,
        firstName,
        middleName,
        lastName,
        age: ageToInputValue(recordToEdit.age),
        farmerAddress: recordToEdit.farmerAddress,
        barangay: resolvedBarangay,
        municipality: resolvedMunicipality,
        farmLocation: recordToEdit.farmLocation,
        landParcel: recordToEdit.landParcel,
        dateSubmitted: recordToEdit.dateSubmitted,
        parcelArea: extractParcelAreaNumber(recordToEdit.parcelArea || ""),
      });

      setLoadingParcels(true);
      setParcelErrors({});
      try {
        const response = await getFarmParcels(recordId);
        if (!response.error) {
          setEditingParcels(
            (response.data || []).map((p: Parcel) => ({
              ...p,
              is_farming:
                typeof p.is_farming === "boolean" ? p.is_farming : null,
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
    }
    setOpenMenuId(null);
  };

  useEffect(() => {
    const navigationState = location.state as { editRecordId?: string } | null;
    const editRecordId = String(navigationState?.editRecordId || "").trim();
    if (!editRecordId || rsbsaRecords.length === 0) return;
    if (rsbsaRecords.some((r) => r.id === editRecordId))
      void handleEdit(editRecordId);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, rsbsaRecords, navigate]);

  const extractParcelAreaNumber = (value: string): string => {
    if (!value) return "";
    return value.includes("hectares")
      ? value.replace(/\s*hectares\s*$/i, "").trim()
      : value;
  };

  const handleInputChange = (field: keyof EditFormData, value: string) => {
    setEditError(null);
    setEditFormData((prev) => ({ ...prev, [field]: value }));
  };

  const deriveFarmingStatusFromParcels = (parcels: Parcel[]): string => {
    if (!parcels || parcels.length === 0) return "Not specified";
    let active = 0,
      inactive = 0;
    parcels.forEach((p) => {
      // A parcel counts as actively farmed if either is_farming OR
      // is_cultivating is true — mirrors the Landowner Registry's logic.
      const isActive = p.is_farming === true || p.is_cultivating === true;
      // A parcel counts as not farmed only when is_farming is explicitly
      // false AND is_cultivating is not true.
      const isInactive = p.is_farming === false && p.is_cultivating !== true;
      if (isActive) active++;
      if (isInactive) inactive++;
    });
    if (active > 0 && inactive > 0) return "Mixed";
    if (active > 0) return "Farming";
    if (inactive > 0) return "Not farming";
    return "Not specified";
  };

  // CHANGE: After saving, also recalculate farmingParcelCount from the edited
  // parcels so the "X/Y farming" column stays accurate without a full refetch.
  // Counts a parcel as farmed if is_farming OR is_cultivating is true —
  // mirrors the Landowner Registry's union of both fields.
  const deriveFarmingParcelCountFromParcels = (parcels: Parcel[]): number => {
    return parcels.filter(
      (p) => p.is_farming === true || p.is_cultivating === true,
    ).length;
  };

  const handleIndividualParcelChange = (
    parcelId: string,
    field: keyof Parcel,
    value: any,
  ) => {
    setEditError(null);
    if (field === "total_farm_area_ha") {
      const valueStr = String(value).trim();
      if (valueStr === "") {
        setParcelErrors((prev) => ({
          ...prev,
          [parcelId]: "Parcel area is required",
        }));
        setEditingParcels((prev) =>
          prev.map((p) => (p.id === parcelId ? { ...p, [field]: 0 } : p)),
        );
        return;
      }
      const numValue = parseFloat(valueStr);
      if (isNaN(numValue)) {
        setParcelErrors((prev) => ({
          ...prev,
          [parcelId]: "Parcel area must be a valid number",
        }));
        return;
      }
      if (numValue <= 0) {
        setParcelErrors((prev) => ({
          ...prev,
          [parcelId]: "Parcel area must be greater than 0",
        }));
        setEditingParcels((prev) =>
          prev.map((p) =>
            p.id === parcelId ? { ...p, [field]: numValue } : p,
          ),
        );
        return;
      }
      setEditingParcels((prev) =>
        prev.map((p) => (p.id === parcelId ? { ...p, [field]: numValue } : p)),
      );
    } else {
      setEditingParcels((prev) =>
        prev.map((p) => (p.id === parcelId ? { ...p, [field]: value } : p)),
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
          setEditError("Please fix all parcel area errors before saving");
          showUpdateNotification(
            "Please fix all parcel area errors before saving.",
            "error",
          );
          return;
        }
      }
      const rawAgeInput = (editFormData.age ?? "").trim();
      const normalizedAge = parseAgeInputToNumber(rawAgeInput);
      if (
        rawAgeInput !== "" &&
        (normalizedAge === null || normalizedAge < 18)
      ) {
        setEditError("Age must be a valid number and at least 18 years old");
        showUpdateNotification(
          "Age must be a valid number and at least 18 years old.",
          "error",
        );
        return;
      }

      const composedFarmerName = (() => {
        const last = (editFormData.lastName ?? "").trim();
        const first = (editFormData.firstName ?? "").trim();
        const middle = (editFormData.middleName ?? "").trim();
        const firstMiddle = [first, middle].filter(Boolean).join(" ");
        const parts = [last, firstMiddle].filter(Boolean);
        return parts.length > 0
          ? parts.join(", ")
          : (editFormData.farmerName ?? editingRecord.farmerName);
      })();

      const composedAddress = (() => {
        const b = (editFormData.barangay ?? "").trim();
        const m = (editFormData.municipality ?? "").trim();
        if (b && m) return `${b}, ${m}`;
        return (
          b || m || editFormData.farmerAddress || editingRecord.farmerAddress
        );
      })();

      const formattedData = {
        ...editFormData,
        farmerName: composedFarmerName,
        farmerAddress: composedAddress,
        parcelArea:
          editingParcels.length > 0
            ? editingParcels.map((p) => p.total_farm_area_ha).join(", ")
            : (editFormData.parcelArea ?? editingRecord.parcelArea),
        age: normalizedAge,
      };

      const cleanedData = Object.entries({
        ...formattedData,
        firstName: editFormData.firstName,
        middleName: editFormData.middleName,
        surname: editFormData.lastName,
        addressBarangay: editFormData.barangay,
        addressMunicipality: editFormData.municipality,
      }).reduce(
        (acc, [key, value]) => {
          if (value !== undefined && value !== "") acc[key] = value;
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
          console.error(`Error updating parcel ${parcel.id}:`, e);
        }
      }

      const serverRecord = response.data?.updatedRecord ?? response.data ?? {};
      setRsbsaRecords((prev) =>
        prev.map((r) =>
          r.id === editingRecord.id
            ? {
                ...editingRecord,
                ...formattedData,
                ...serverRecord,
                age: normalizeAgeValue(
                  serverRecord.age ?? formattedData.age,
                  serverRecord.birthdate ?? null,
                ),
                farmingStatus:
                  editingParcels.length > 0
                    ? deriveFarmingStatusFromParcels(editingParcels)
                    : editingRecord.farmingStatus,
                // CHANGE: Keep farmingParcelCount in sync after a save so the
                // "X/Y farming" cell reflects the staff's edit immediately.
                farmingParcelCount:
                  editingParcels.length > 0
                    ? deriveFarmingParcelCountFromParcels(editingParcels)
                    : editingRecord.farmingParcelCount,
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
        const user = await getCurrentUserForAudit();
        await getAuditLogger().logCRUD(
          { ...user, id: undefined },
          "UPDATE",
          AuditModule.FARMERS,
          "farmer_record",
          editingRecord.id,
          `Updated farmer record: ${editingRecord.farmerName}`,
          { farmerName: editingRecord.farmerName },
          {
            updatedName: composedFarmerName,
            parcelCount: editingParcels.length,
          },
        );
      } catch (e) {
        console.error("Audit log failed:", e);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update record. Please try again.";
      setEditError(message);
      showUpdateNotification(message, "error");
    }
  };

  return (
    <div className="jo-farmer-page-container">
      <div className="jo-farmer-page has-mobile-sidebar">
        <JOSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <div className="jo-farmer-main-content">
          <div className="tech-incent-mobile-header">
            <button
              className="tech-incent-hamburger"
              onClick={() => setSidebarOpen((prev) => !prev)}
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
            <div className="tech-incent-mobile-title">Farmer Registry</div>
          </div>

          <div className="jo-farmer-dashboard-header">
            <div>
              <h2 className="jo-farmer-page-title">Farmer Registry</h2>
              <p className="jo-farmer-page-subtitle">
                Tenants, lessees, and owner-farmers registered under RSBSA in
                Dumangas, Iloilo
              </p>
            </div>
          </div>

          {!loading && !error && (
            <div className="jo-farmer-status-cards">
              <div className="jo-farmer-status-card jo-farmer-card-total">
                <div className="jo-farmer-card-icon">👥</div>
                <div className="jo-farmer-card-info">
                  <span className="jo-farmer-card-count">
                    {farmerCounts.total}
                  </span>
                  <span className="jo-farmer-card-label">Total Farmers</span>
                </div>
              </div>
              <div className="jo-farmer-status-card jo-farmer-card-active">
                <div className="jo-farmer-card-icon">✅</div>
                <div className="jo-farmer-card-info">
                  <span className="jo-farmer-card-count">
                    {farmerCounts.active}
                  </span>
                  <span className="jo-farmer-card-label">Active</span>
                </div>
              </div>
              <div className="jo-farmer-status-card jo-farmer-card-inactive">
                <div className="jo-farmer-card-icon">🌾</div>
                <div className="jo-farmer-card-info">
                  <span className="jo-farmer-card-count">
                    {farmerCounts.tenants}
                  </span>
                  <span className="jo-farmer-card-label">Tenants</span>
                </div>
              </div>
              <div className="jo-farmer-status-card jo-farmer-card-inactive">
                <div className="jo-farmer-card-icon">📋</div>
                <div className="jo-farmer-card-info">
                  <span className="jo-farmer-card-count">
                    {farmerCounts.lessees}
                  </span>
                  <span className="jo-farmer-card-label">Lessees</span>
                </div>
              </div>
              <div className="jo-farmer-status-card jo-farmer-card-total">
                <div className="jo-farmer-card-icon">🏡</div>
                <div className="jo-farmer-card-info">
                  <span className="jo-farmer-card-count">
                    {farmerCounts.owners}
                  </span>
                  <span className="jo-farmer-card-label">Owner-farmers</span>
                </div>
              </div>
              {farmerCounts.noParcels > 0 && (
                <div
                  className="jo-farmer-status-card jo-farmer-card-inactive"
                  style={{ borderLeft: "3px solid #d97706", cursor: "pointer" }}
                  onClick={() => setSelectedRole("noParcels")}
                  title="Click to filter No Parcels records"
                >
                  <div className="jo-farmer-card-icon">⚠️</div>
                  <div className="jo-farmer-card-info">
                    <span className="jo-farmer-card-count">
                      {farmerCounts.noParcels}
                    </span>
                    <span className="jo-farmer-card-label">No Parcels</span>
                  </div>
                </div>
              )}
              {farmerCounts.noLandOwner > 0 && (
                <div
                  className="jo-farmer-status-card jo-farmer-card-inactive"
                  style={{ borderLeft: "3px solid #dc2626", cursor: "pointer" }}
                  onClick={() => setSelectedRole("noLandOwner")}
                  title="Click to filter tenants/lessees with no landowner on record"
                >
                  <div className="jo-farmer-card-icon">🚫</div>
                  <div className="jo-farmer-card-info">
                    <span className="jo-farmer-card-count">
                      {farmerCounts.noLandOwner}
                    </span>
                    <span className="jo-farmer-card-label">No Land Owner</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="jo-farmer-content-card">
            <div className="jo-farmer-filters-section">
              <div className="jo-farmer-search-filter">
                <input
                  type="text"
                  placeholder="Search by name, FFRS code, or barangay..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="jo-farmer-search-input"
                />
              </div>

              <div className="jo-farmer-status-filter">
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="jo-farmer-status-select"
                >
                  <option value="all">All Roles</option>
                  <option value="tenant">Tenant</option>
                  <option value="lessee">Lessee</option>
                  <option value="owner">Owner-farmer</option>
                  <option value="active">Active</option>
                  <option value="notActive">Not Active</option>
                  <option value="noParcels">No Parcels</option>
                  <option value="noLandOwner">No Land Owner</option>
                </select>
              </div>

              <div className="jo-farmer-status-filter">
                <select
                  value={selectedBarangay}
                  onChange={(e) => setSelectedBarangay(e.target.value)}
                  className="jo-farmer-status-select"
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
              <div className="jo-farmer-table-meta">
                <span>
                  Showing {filteredRecords.length} of {farmerCounts.total}{" "}
                  farmers
                </span>
                <span>Tip: Sort up to 2 levels (e.g. Name then Area).</span>
                {!isDefaultSortConfig && (
                  <button
                    type="button"
                    className="jo-farmer-sort-btn"
                    onClick={resetSortConfig}
                  >
                    Reset Sort
                  </button>
                )}
              </div>
            )}

            {!loading && !error && (
              <div className="jo-farmer-bulk-toolbar">
                {selectedRecordIds.size > 0 && (
                  <span className="jo-farmer-bulk-count">
                    {selectedRecordIds.size} farmer
                    {selectedRecordIds.size === 1 ? "" : "s"} selected
                  </span>
                )}
                <div className="jo-farmer-bulk-actions">
                  <div
                    className="jo-farmer-bulk-export-wrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="jo-farmer-bulk-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPrintFarmerModal((prev) => !prev);
                      }}
                    >
                      🌾 Print Farmer
                    </button>
                    {showPrintFarmerModal && (
                      <div className="jo-farmer-bulk-menu">
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
                          className="jo-farmer-quick-item"
                          onClick={() => {
                            setShowPrintFarmerModal(false);
                            void handlePrintFarmer("all");
                          }}
                        >
                          📋 Print All ({filteredRecords.length})
                        </button>
                        <button
                          className="jo-farmer-quick-item"
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
                            setShowPrintFarmerModal(false);
                            void handlePrintFarmer("selected");
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
                  {selectedRecordIds.size > 0 && (
                    <button
                      className="jo-farmer-bulk-btn jo-farmer-bulk-btn-clear"
                      onClick={() => setSelectedRecordIds(new Set())}
                    >
                      Clear Selection
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="jo-farmer-table-container">
              <table className="jo-farmer-farmers-table">
                <thead>
                  {/*
                    CHANGE: New column order — checkbox | Farmer | Barangay |
                    Role | Parcels | Total Area | Cultivation | Status | Actions
                  */}
                  <tr>
                    <th className="jo-farmer-checkbox-col">
                      <input
                        type="checkbox"
                        className="jo-farmer-header-checkbox"
                        checked={allFilteredSelected}
                        disabled={filteredRecords.length === 0}
                        onChange={toggleSelectAllFiltered}
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Select all filtered farmers"
                      />
                    </th>
                    <th>
                      <button
                        className={`jo-farmer-sort-btn ${isSortActive("farmerName") ? "is-active" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSortChange("farmerName");
                        }}
                      >
                        Farmer <span>{getSortIndicator("farmerName")}</span>
                      </button>
                    </th>
                    <th>Barangay</th>

                    <th>Parcels</th>
                    <th>
                      <button
                        className={`jo-farmer-sort-btn ${isSortActive("parcelArea") ? "is-active" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSortChange("parcelArea");
                        }}
                      >
                        Total Area <span>{getSortIndicator("parcelArea")}</span>
                      </button>
                    </th>
                    <th>Farming</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td
                        colSpan={VISIBLE_COLUMN_COUNT}
                        className="jo-farmer-loading-cell"
                      >
                        Loading...
                      </td>
                    </tr>
                  )}
                  {error && !loading && (
                    <tr>
                      <td
                        colSpan={VISIBLE_COLUMN_COUNT}
                        className="jo-farmer-error-cell"
                      >
                        Error: {error}
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    !error &&
                    filteredRecords.length > 0 &&
                    filteredRecords.map((record) => (
                      <tr
                        key={record.id}
                        className={`jo-farmer-table-row${
                          record.needsPendingReview ||
                          record.hasNoParcels ||
                          record.hasNoLandOwner
                            ? " jo-row--flagged"
                            : ""
                        }`}
                        onClick={() => fetchFarmerDetails(record.id, record)}
                      >
                        <td
                          className="jo-farmer-checkbox-col"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="jo-farmer-row-checkbox"
                            checked={selectedRecordIds.has(record.id)}
                            onChange={() => toggleSelectRecord(record.id)}
                            aria-label={`Select ${record.farmerName}`}
                          />
                        </td>

                        {/* Farmer name + FFRS ref */}
                        <td>
                          <div className="jo-farmer-farmer-cell">
                            <div className="jo-farmer-farmer-avatar">
                              {getFarmerInitials(record.farmerName)}
                            </div>
                            <div className="jo-farmer-farmer-meta">
                              <span className="jo-farmer-farmer-name">
                                {record.farmerName}
                              </span>
                              <span className="jo-farmer-farmer-ref">
                                {record.referenceNumber}
                              </span>
                              {record.needsPendingReview && (
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
                                  ⚠️ Land transferred — Pending JO Review
                                </span>
                              )}
                              {record.hasNoParcels &&
                                !record.needsPendingReview && (
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
                            </div>
                          </div>
                        </td>

                        {/* Barangay */}
                        <td>
                          <span className="jo-farmer-cultivation-text">
                            {getRecordBarangay(record)}
                          </span>
                        </td>

                        {/* Parcel count */}
                        <td>
                          <span className="jo-farmer-parcel-count">
                            {record.parcelCount}{" "}
                            {record.parcelCount === 1 ? "parcel" : "parcels"}
                          </span>
                        </td>

                        {/* Total area */}
                        <td>
                          <span className="jo-farmer-parcel-area">
                            {formatParcelArea(record.parcelArea)}
                          </span>
                        </td>

                        {/* Cultivation */}
                        <td>
                          <span className="jo-farmer-cultivation-text">
                            {formatCultivation(record)}
                          </span>
                        </td>

                        {/* Record status */}
                        <td>
                          <span
                            className="jo-farmer-record-status"
                            style={
                              record.hasNoParcels || record.hasNoLandOwner
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
                                : record.needsPendingReview
                                  ? {
                                      background: "#fef3c7",
                                      color: "#92400e",
                                      border: "1px solid #fcd34d",
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
                              ? "No Land Owner" // tenant/lessee with no landowner filled
                              : record.hasNoParcels
                                ? "No Parcels" // owner with no parcel on record
                                : record.needsPendingReview
                                  ? "Pending Review"
                                  : formatRecordStatus(record.status)}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="jo-farmer-actions-cell">
                          <div
                            className="jo-farmer-quick-actions"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              className="jo-farmer-view-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId((prev) =>
                                  prev === record.id ? null : record.id,
                                );
                              }}
                            >
                              Quick Actions ▾
                            </button>
                            {openMenuId === record.id && (
                              <div className="jo-farmer-quick-menu">
                                <button
                                  className="jo-farmer-quick-item"
                                  onClick={() => {
                                    fetchFarmerDetails(record.id, record);
                                    setOpenMenuId(null);
                                  }}
                                >
                                  View
                                </button>
                                <button
                                  className="jo-farmer-quick-item"
                                  onClick={() => {
                                    handleEdit(record.id);
                                    setOpenMenuId(null);
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  className="jo-farmer-quick-item"
                                  onClick={() => {
                                    void handlePrintFarmer("all", record);
                                    setOpenMenuId(null);
                                  }}
                                >
                                  Print Farmer Info
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}

                  {!loading && !error && filteredRecords.length === 0 && (
                    <tr>
                      <td
                        colSpan={VISIBLE_COLUMN_COUNT}
                        className="jo-farmer-empty-cell"
                      >
                        No farmers found for the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {updateNotification.show && (
          <div
            className={`jo-farmer-update-toast ${updateNotification.type}`}
            role="status"
            aria-live="polite"
          >
            <span className="jo-farmer-update-toast-message">
              {updateNotification.message}
            </span>
            <button
              className="jo-farmer-update-toast-close"
              onClick={() =>
                setUpdateNotification((prev) => ({ ...prev, show: false }))
              }
              aria-label="Close notification"
            >
              ×
            </button>
          </div>
        )}

        {editingRecord && (
          <div className="jo-farmer-edit-modal-overlay">
            <div className="jo-farmer-edit-modal">
              <div className="jo-farmer-edit-modal-header">
                <div className="jo-farmer-edit-modal-title">
                  <h2>Edit Farmer Information</h2>
                  <p>Update farmer details and parcel farming status.</p>
                </div>
                <button
                  className="jo-farmer-close-button"
                  onClick={handleCancel}
                >
                  ×
                </button>
              </div>
              <div className="jo-farmer-edit-modal-body">
                {editError && (
                  <div className="jo-farmer-edit-error-banner" role="alert">
                    {editError}
                  </div>
                )}
                <div className="jo-farmer-form-grid">
                  <div className="jo-farmer-form-group">
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
                  <div className="jo-farmer-form-group">
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
                  <div className="jo-farmer-form-group">
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
                  <div className="jo-farmer-form-group">
                    <label>Age:</label>
                    <input
                      type="text"
                      value={editFormData.age || ""}
                      onChange={(e) => handleInputChange("age", e.target.value)}
                      placeholder="Age"
                    />
                  </div>
                  <div className="jo-farmer-form-group">
                    <label>Barangay:</label>
                    <select
                      value={editFormData.barangay || ""}
                      onChange={(e) =>
                        handleInputChange("barangay", e.target.value)
                      }
                      className="jo-farmer-form-select"
                    >
                      <option value="">Select Barangay</option>
                      {barangays.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="jo-farmer-form-group">
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

                <div className="jo-farmer-parcel-section">
                  <h4>Parcels</h4>
                  {loadingParcels ? (
                    <p>Loading parcels...</p>
                  ) : editingParcels.length > 0 ? (
                    editingParcels.map((parcel, index) => (
                      <div
                        key={parcel.id}
                        className={`jo-farmer-parcel-item ${parcelErrors[parcel.id] ? "error" : ""}`}
                      >
                        <div className="jo-farmer-form-group">
                          <label className="jo-farmer-parcel-label">
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
                            className="jo-farmer-parcel-input"
                            data-error={
                              parcelErrors[parcel.id] ? "true" : "false"
                            }
                          />
                          {parcelErrors[parcel.id] && (
                            <small className="jo-farmer-parcel-error">
                              {parcelErrors[parcel.id]}
                            </small>
                          )}
                          <small className="jo-farmer-parcel-location">
                            Location: {parcel.farm_location_barangay || "N/A"},{" "}
                            {parcel.farm_location_municipality || "N/A"}
                          </small>
                        </div>
                        <div className="jo-farmer-form-group">
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
                              const normalized =
                                e.target.value === "true"
                                  ? true
                                  : e.target.value === "false"
                                    ? false
                                    : null;
                              handleIndividualParcelChange(
                                parcel.id,
                                "is_farming",
                                normalized,
                              );
                              if (normalized !== false)
                                handleIndividualParcelChange(
                                  parcel.id,
                                  "farming_status_reason",
                                  null,
                                );
                            }}
                            className="jo-farmer-form-select"
                          >
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                          </select>
                        </div>
                        {parcel.is_farming === false && (
                          <div className="jo-farmer-form-group">
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
                    <p className="jo-farmer-parcel-empty">
                      No parcels found for this farmer.
                    </p>
                  )}
                </div>
              </div>
              <div className="jo-farmer-edit-modal-footer">
                <button
                  className="jo-farmer-cancel-button"
                  onClick={handleCancel}
                >
                  Cancel
                </button>
                <button className="jo-farmer-save-button" onClick={handleSave}>
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Farmer Detail Modal — unchanged */}
        {showModal && selectedFarmer && (
          <div className="farmer-modal-overlay">
            <div className="farmer-modal-content">
              {" "}
              {/* ← add this */}
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
                  profilePicture: selectedFarmer.profilePicture || null,
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
                        agrarianReformBeneficiary: p.agrarianReformBeneficiary,
                        isFarming: p.isFarming,
                        isCultivating: p.isCultivating,
                        farmingStatusReason: p.farmingStatusReason,
                      };
                    },
                  ),
                }}
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

export default JoFarmerRegistry;
