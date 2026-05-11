import { supabase } from "../../supabase";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  getRsbsaSubmissions,
  getRsbsaSubmissionById,
  getFarmParcels,
  updateRsbsaSubmission,
  updateFarmParcel,
} from "../../api";
import {
  printRsbsaFormById,
  printRsbsaFormsByIds,
} from "../../utils/rsbsaPrint";
import "../../assets/css/jo css/JoMasterlistStyle.css";
import JOSidebar from "../../components/Layout/JOSidebar";
import "../../assets/css/jo css/FarmerDetailModal.css";
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
// Purpose:
//   • Find and filter farmers by role, barangay, and farming status
//   • See who is Farming vs not
//   • Understand the farmer–landowner relationship per parcel
//   • Export and print RSBSA forms
// ─────────────────────────────────────────────

interface RSBSARecord {
  id: string;
  referenceNumber: string;
  farmerName: string;
  farmerAddress: string;
  farmLocation: string;
  parcelArea: string;
  parcelCount: number;
  age: number | null;
  dateSubmitted: string;
  status: string;
  landParcel: string;
  farmingStatus?: string;
  archivedAt?: string | null;
  archiveReason?: string | null;
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
  isFarming?: boolean | null;
  farmingStatusReason?: string | null;
  farmingStatusUpdatedAt?: string | null;
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

  // CHANGE 1: Role filter replaces the old status filter.
  // Options: all, tenant, lessee, owner-farmer, active, notActive
  // "noParcels" removed — those records are handled in the Masterlist.
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
  const [printingRecordIds, setPrintingRecordIds] = useState<Set<string>>(
    new Set(),
  );
  const [restoringRecordIds, setRestoringRecordIds] = useState<Set<string>>(
    new Set(),
  );
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // CHANGE 2: showArchived and noParcels toggle removed — not relevant here.

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

      const parcelsResponse = await getFarmParcels(farmerId);
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
        isFarming: typeof p.is_farming === "boolean" ? p.is_farming : null,
        farmingStatusReason: p.farming_status_reason || null,
        farmingStatusUpdatedAt: p.farming_status_updated_at || null,
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

  const fetchRSBSARecords = async () => {
    try {
      const response = await getRsbsaSubmissions();
      if (response.error) throw new Error(response.error);
      const data = response.data || [];
      const allData = Array.isArray(data) ? data : [];

      const formattedRecords: RSBSARecord[] = allData.map(
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

          return {
            id: String(item.id),
            referenceNumber,
            farmerName: String(reformattedName),
            farmerAddress: String(
              item.farmerAddress ?? item.addressBarangay ?? "—",
            ),
            farmLocation: String(item.farmLocation ?? "—"),
            parcelArea,
            parcelCount:
              typeof item.parcelCount === "number" ? item.parcelCount : 0,
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
            farmingStatus: String(item.farmingStatus || "Not specified"),
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
            ownershipType: item.ownershipType,
          };
        },
      );

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
      setShowBulkExportMenu(false);
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

  // CHANGE 3: Helper to extract the barangay for display in its own column.
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

  // CHANGE 4: filteredRecords — always excludes "no parcels" records.
  // People who lost all parcels don't belong in the Farmer Registry.
  const filteredRecords = rsbsaRecords
    .filter((record) => {
      const normalizedStatus = (record.status || "").toLowerCase().trim();

      // Always exclude No Parcels — they belong in the Masterlist queue
      if (normalizedStatus === "no parcels") return false;

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
        // Owner-farmers: registered owners who also actively farm
        matchesRole = flags.category === "registeredOwner" || flags.owner;
      } else if (selectedRole === "active") {
        matchesRole = activeStatuses.has(normalizedStatus);
      } else if (selectedRole === "notActive") {
        matchesRole = notActiveStatuses.has(normalizedStatus);
      }
      // "all" — no role filter, just exclude no parcels (already done above)

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

  const selectedRecords = useMemo(
    () => rsbsaRecords.filter((r) => selectedRecordIds.has(r.id)),
    [rsbsaRecords, selectedRecordIds],
  );

  // CHANGE 5: Summary cards — farmer-registry-specific counts.
  const farmerCounts = useMemo(() => {
    // Base: exclude no parcels from all counts
    const base = rsbsaRecords.filter(
      (r) => (r.status || "").toLowerCase().trim() !== "no parcels",
    );
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
    return { total, active, tenants, lessees, owners };
  }, [rsbsaRecords]);

  // CHANGE 6: Column count updated — now 10 columns (added Barangay, split Parcels/Area).
  const VISIBLE_COLUMN_COUNT = 10;

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

  // CHANGE 7: Cultivation status formatter — cleaner labels for the dedicated column.
  const formatFarmingStatus = (status?: string | null) => {
    if (!status) return "Not specified";
    const normalized = status.toLowerCase().trim();
    if (normalized === "farming" || normalized === "Farming") return "Farming";
    if (normalized === "not farming" || normalized === "not_farming")
      return "Not farming";
    if (normalized === "mixed") return "Mixed";
    return status;
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

  // CHANGE 8: getOwnershipLabel — cleaner role labels for the Farmer Registry.
  const getOwnershipLabel = (record: RSBSARecord) => {
    const flags = getOwnershipFlags(record);
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
    if (flags.category === "registeredOwner" || flags.owner)
      return "jo-masterlist-ownership-owner";
    if (flags.tenant && flags.lessee) return "jo-masterlist-ownership-mixed";
    if (flags.tenant) return "jo-masterlist-ownership-tenant";
    if (flags.lessee) return "jo-masterlist-ownership-lessee";
    if (flags.tenantLessee) return "jo-masterlist-ownership-tenant";
    return "jo-masterlist-ownership-unknown";
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

  const handlePrintSingleRecord = async (record: RSBSARecord) => {
    setPrintingRecordIds((prev) => {
      const next = new Set(prev);
      next.add(record.id);
      return next;
    });
    const result = await printRsbsaFormById({
      farmerId: record.id,
      fallbackReferenceNumber: record.referenceNumber,
      fallbackFarmerName: record.farmerName,
    });
    if (!result.success && !result.cancelled)
      showUpdateNotification(
        result.error || "Failed to print RSBSA form.",
        "error",
      );
    if (result.success) {
      try {
        const user = await getCurrentUserForAudit();
        await getAuditLogger().logExport(
          { ...user, id: undefined },
          AuditModule.FARMERS,
          "RSBSA Form Print",
          1,
        );
      } catch (e) {
        console.error("Audit log failed:", e);
      }
    }
    setPrintingRecordIds((prev) => {
      const next = new Set(prev);
      next.delete(record.id);
      return next;
    });
  };

  const handleBulkPrint = async () => {
    if (selectedRecords.length === 0) {
      showUpdateNotification("No records selected for printing.", "error");
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
      showUpdateNotification(
        result.error || "Failed to print selected RSBSA forms.",
        "error",
      );
      return;
    }
    if (result.success && (result.failedCount || 0) > 0) {
      showUpdateNotification(
        `Printed ${result.printedCount || 0} form(s), ${result.failedCount} failed.`,
        "error",
      );
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
    if (!selectedFarmer) return;
    setIsModalPrinting(true);
    const result = await printRsbsaFormById({
      farmerId: selectedFarmer.id,
      fallbackReferenceNumber: selectedFarmer.referenceNumber,
      fallbackFarmerName: selectedFarmer.farmerName,
    });
    setIsModalPrinting(false);
    if (!result.success && !result.cancelled)
      showUpdateNotification(
        result.error || "Failed to print RSBSA form.",
        "error",
      );
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
    <div className="jo-masterlist-page-container">
      <div className="jo-masterlist-page has-mobile-sidebar">
        <JOSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <div className="jo-masterlist-main-content">
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
            {/* CHANGE 9: Mobile header title updated */}
            <div className="tech-incent-mobile-title">Farmer Registry</div>
          </div>

          <div className="jo-masterlist-dashboard-header">
            <div>
              {/* CHANGE 9: Page title and subtitle updated */}
              <h2 className="jo-masterlist-page-title">Farmer Registry</h2>
              <p className="jo-masterlist-page-subtitle">
                Tenants, lessees, and owner-farmers registered under RSBSA in
                Dumangas, Iloilo
              </p>
            </div>
          </div>

          {/* CHANGE 5: Summary cards — farmer-registry-specific */}
          {!loading && !error && (
            <div className="jo-masterlist-status-cards">
              <div className="jo-masterlist-status-card jo-masterlist-card-total">
                <div className="jo-masterlist-card-icon">👥</div>
                <div className="jo-masterlist-card-info">
                  <span className="jo-masterlist-card-count">
                    {farmerCounts.total}
                  </span>
                  <span className="jo-masterlist-card-label">
                    Total Farmers
                  </span>
                </div>
              </div>
              <div className="jo-masterlist-status-card jo-masterlist-card-active">
                <div className="jo-masterlist-card-icon">✅</div>
                <div className="jo-masterlist-card-info">
                  <span className="jo-masterlist-card-count">
                    {farmerCounts.active}
                  </span>
                  <span className="jo-masterlist-card-label">Active</span>
                </div>
              </div>
              <div className="jo-masterlist-status-card jo-masterlist-card-inactive">
                <div className="jo-masterlist-card-icon">🌾</div>
                <div className="jo-masterlist-card-info">
                  <span className="jo-masterlist-card-count">
                    {farmerCounts.tenants}
                  </span>
                  <span className="jo-masterlist-card-label">Tenants</span>
                </div>
              </div>
              <div className="jo-masterlist-status-card jo-masterlist-card-inactive">
                <div className="jo-masterlist-card-icon">📋</div>
                <div className="jo-masterlist-card-info">
                  <span className="jo-masterlist-card-count">
                    {farmerCounts.lessees}
                  </span>
                  <span className="jo-masterlist-card-label">Lessees</span>
                </div>
              </div>
              <div className="jo-masterlist-status-card jo-masterlist-card-total">
                <div className="jo-masterlist-card-icon">🏡</div>
                <div className="jo-masterlist-card-info">
                  <span className="jo-masterlist-card-count">
                    {farmerCounts.owners}
                  </span>
                  <span className="jo-masterlist-card-label">
                    Owner-farmers
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="jo-masterlist-content-card">
            <div className="jo-masterlist-filters-section">
              <div className="jo-masterlist-search-filter">
                <input
                  type="text"
                  placeholder="Search by name, FFRS code, or barangay..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="jo-masterlist-search-input"
                />
              </div>

              {/* CHANGE 1: Role filter — focused on farmer roles, no "noParcels" option */}
              <div className="jo-masterlist-status-filter">
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="jo-masterlist-status-select"
                >
                  <option value="all">All Roles</option>
                  <option value="tenant">Tenant</option>
                  <option value="lessee">Lessee</option>
                  <option value="owner">Owner-farmer</option>
                  <option value="active">Active</option>
                  <option value="notActive">Not Active</option>
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
            </div>

            {!loading && !error && (
              <div className="jo-masterlist-table-meta">
                <span>
                  Showing {filteredRecords.length} of {farmerCounts.total}{" "}
                  farmers
                </span>
                <span>Tip: Sort up to 2 levels (e.g. Name then Area).</span>
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

            {!loading && !error && selectedRecordIds.size > 0 && (
              <div className="jo-masterlist-bulk-toolbar">
                <span className="jo-masterlist-bulk-count">
                  {selectedRecordIds.size} farmer
                  {selectedRecordIds.size === 1 ? "" : "s"} selected
                </span>
                <div className="jo-masterlist-bulk-actions">
                  <div
                    className="jo-masterlist-bulk-export-wrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="jo-masterlist-bulk-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowBulkExportMenu((prev) => !prev);
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
                  <button
                    className="jo-masterlist-bulk-btn jo-masterlist-bulk-btn-clear"
                    onClick={() => setSelectedRecordIds(new Set())}
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            )}

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
                        aria-label="Select all visible farmers"
                      />
                    </th>

                    {/* CHANGE 6: Table headers — Farmer, Barangay, No. of Parcels, Total Area, Cultivation, Role, Status, Date, Actions */}
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
                    <th>Barangay</th>
                    <th>No. of Parcels</th>
                    <th>
                      <button
                        className={`jo-masterlist-sort-btn ${isSortActive("parcelArea") ? "is-active" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSortChange("parcelArea");
                        }}
                      >
                        Total Area <span>{getSortIndicator("parcelArea")}</span>
                      </button>
                    </th>
                    <th>Cultivation</th>
                    <th>Role</th>
                    <th>Status</th>
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
                    filteredRecords.map((record) => (
                      <tr
                        key={record.id}
                        className="jo-masterlist-table-row"
                        onClick={() => fetchFarmerDetails(record.id, record)}
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

                        {/* Farmer name + FFRS */}
                        <td>
                          <div className="jo-masterlist-farmer-cell">
                            <div className="jo-masterlist-farmer-avatar">
                              {getFarmerInitials(record.farmerName)}
                            </div>
                            <div className="jo-masterlist-farmer-meta">
                              <span className="jo-masterlist-farmer-name">
                                {record.farmerName}
                              </span>
                              <span className="jo-masterlist-farmer-ref">
                                {record.referenceNumber}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* CHANGE 6a: Dedicated Barangay column */}
                        <td>
                          <span className="jo-masterlist-cultivation-text">
                            {getRecordBarangay(record)}
                          </span>
                        </td>

                        {/* CHANGE 6b: No. of Parcels — count only, no area */}
                        <td>
                          <span className="jo-masterlist-parcel-count">
                            {record.parcelCount} parcel
                            {record.parcelCount === 1 ? "" : "s"}
                          </span>
                        </td>

                        {/* CHANGE 6c: Total Area — area only, no count */}
                        <td>
                          <span className="jo-masterlist-parcel-area">
                            {formatParcelArea(record.parcelArea)}
                          </span>
                        </td>

                        {/* Cultivation status */}
                        <td>
                          <span className="jo-masterlist-cultivation-text">
                            {formatFarmingStatus(
                              record.farmingStatus || "Not specified",
                            )}
                          </span>
                        </td>

                        {/* CHANGE 8: Role — uses new farmer-focused labels */}
                        <td>
                          <div className="jo-masterlist-status-cell">
                            <span
                              className={`jo-masterlist-ownership-pill ${getOwnershipClass(record)}`}
                            >
                              {getOwnershipLabel(record)}
                            </span>
                          </div>
                        </td>

                        {/* Record status */}
                        <td>
                          <span className="jo-masterlist-record-status">
                            {formatRecordStatus(record.status)}
                          </span>
                        </td>

                        {/* Date submitted */}
                        <td>
                          <span className="jo-masterlist-date">
                            {formatDate(record.dateSubmitted)}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="jo-masterlist-actions-cell">
                          <div
                            className="jo-masterlist-quick-actions"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              className="jo-masterlist-view-btn"
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
                                  disabled={printingRecordIds.has(record.id)}
                                >
                                  {printingRecordIds.has(record.id)
                                    ? "Preparing form..."
                                    : "Print RSBSA Form"}
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
                        className="jo-masterlist-empty-cell"
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
                setUpdateNotification((prev) => ({ ...prev, show: false }))
              }
              aria-label="Close notification"
            >
              ×
            </button>
          </div>
        )}

        {/* CHANGE 3 (edit modal): Title changed to "Edit Farmer Information" */}
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

        {/* Farmer Detail Modal */}
        {showModal && selectedFarmer && (
          <div
            className="farmer-modal-overlay"
            onClick={() => setShowModal(false)}
          >
            <div
              className="farmer-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="farmer-modal-header">
                <h2>Farmer Details</h2>
                <div className="farmer-modal-header-actions">
                  <button
                    className="farmer-modal-print-btn"
                    onClick={handleModalPrint}
                    disabled={isModalPrinting}
                  >
                    {isModalPrinting ? "Preparing form..." : "Print RSBSA Form"}
                  </button>
                  <button
                    className="farmer-modal-close"
                    onClick={() => setShowModal(false)}
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="farmer-modal-body">
                {loadingFarmerDetail ? (
                  <div className="farmer-modal-loading">
                    Loading farmer details...
                  </div>
                ) : (
                  <>
                    {/* Record Overview */}
                    <div className="farmer-modal-section">
                      <h3 className="farmer-modal-section-title">
                        Record Overview
                      </h3>
                      <div className="farmer-modal-info-grid">
                        <div className="farmer-modal-info-item">
                          <span className="farmer-modal-label">FFRS ID:</span>
                          <span className="farmer-modal-value">
                            {selectedFarmer.referenceNumber || "N/A"}
                          </span>
                        </div>
                        <div className="farmer-modal-info-item">
                          <span className="farmer-modal-label">
                            Date Submitted:
                          </span>
                          <span className="farmer-modal-value">
                            {selectedFarmer.dateSubmitted || "N/A"}
                          </span>
                        </div>
                        <div className="farmer-modal-info-item farmer-modal-full-width">
                          <span className="farmer-modal-label">Status:</span>
                          <span className="farmer-modal-value">
                            {selectedFarmer.recordStatus || "N/A"}
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
                                  color: "var(--color-text-danger, #c0392b)",
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
                                {selectedFarmer.archiveReason ||
                                  "Not specified"}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Personal Information */}
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
                                  color: "var(--color-text-secondary, #666)",
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
                            Main Livelihood / Farming Activities:
                          </span>
                          <span className="farmer-modal-value">
                            {selectedFarmer.farmingActivities.length > 0
                              ? selectedFarmer.farmingActivities.join(", ")
                              : "Not available"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Farm Information */}
                    <div className="farmer-modal-section">
                      <h3 className="farmer-modal-section-title">
                        🌾 Farm Information
                      </h3>

                      {selectedFarmer.parcels.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            gap: 20,
                            padding: "8px 12px",
                            marginBottom: 12,
                            background:
                              "var(--color-background-secondary, #f5f5f5)",
                            borderRadius: 6,
                            fontSize: "0.9em",
                            color: "var(--color-text-secondary, #555)",
                          }}
                        >
                          <span>
                            <strong
                              style={{
                                color: "var(--color-text-primary, #222)",
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
                                color: "var(--color-text-primary, #222)",
                              }}
                            >
                              {selectedFarmer.parcels
                                .reduce(
                                  (sum, p) =>
                                    sum +
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
                                color: "var(--color-text-primary, #222)",
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
                        </div>
                      )}

                      {selectedFarmer.parcels.length === 0 ? (
                        <p className="farmer-modal-no-data">No parcels found</p>
                      ) : (
                        <div className="farmer-modal-parcels-container">
                          {selectedFarmer.parcels.map((parcel, index) => (
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
                                      ? "Owner-farmer"
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

                                {/* Landowner — only relevant for tenants/lessees */}
                                {(parcel.ownershipTypeTenant ||
                                  parcel.ownershipTypeLessee) &&
                                  (parcel.tenantLandOwnerName ||
                                    parcel.lesseeLandOwnerName) && (
                                    <div className="farmer-modal-parcel-item">
                                      <span className="farmer-modal-label">
                                        Landowner:
                                      </span>
                                      <span className="farmer-modal-value">
                                        {parcel.tenantLandOwnerName ||
                                          parcel.lesseeLandOwnerName}
                                        {parcel.ownershipDocumentNo && (
                                          <span className="farmer-modal-owner-name">
                                            {" "}
                                            · Doc No:{" "}
                                            {parcel.ownershipDocumentNo}
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
                                    {typeof parcel.totalFarmAreaHa === "number"
                                      ? parcel.totalFarmAreaHa.toFixed(2)
                                      : parseFloat(
                                          String(parcel.totalFarmAreaHa || 0),
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
                                      <span
                                        style={{
                                          color:
                                            "var(--color-text-secondary, #888)",
                                        }}
                                      >
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
                                      <span
                                        style={{
                                          color:
                                            "var(--color-text-secondary, #888)",
                                        }}
                                      >
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
                                        color:
                                          "var(--color-text-secondary, #666)",
                                      }}
                                    >
                                      {formatDateTime(
                                        parcel.farmingStatusUpdatedAt,
                                      )}
                                    </span>
                                  </div>
                                )}

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
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JoFarmerRegistry;
