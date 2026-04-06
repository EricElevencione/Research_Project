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
import "../../assets/css/jo css/FarmerDetailModal.css";
import "../../components/layout/sidebarStyle.css";
import LogoImage from "../../assets/images/Logo.png";
import HomeIcon from "../../assets/images/home.png";
import RSBSAIcon from "../../assets/images/rsbsa.png";
import MasterlistIcon from "../../assets/images/approve.png";
import LogoutIcon from "../../assets/images/logout.png";
import IncentivesIcon from "../../assets/images/incentives.png";

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
}

interface FarmerDetail {
  id: string;
  referenceNumber: string;
  dateSubmitted: string;
  recordStatus: string;
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

const JoMasterlist: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // List of barangays in Dumangas
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
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
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
  }>({
    show: false,
    type: "success",
    message: "",
  });
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
  const [showArchived, setShowArchived] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  const isActive = (path: string) => location.pathname === path;

  const showUpdateNotification = (
    message: string,
    type: "success" | "error",
  ) => {
    setUpdateNotification({ show: true, type, message });
    setTimeout(() => {
      setUpdateNotification((prev) => ({ ...prev, show: false }));
    }, 3200);
  };

  // Fetch farmer details when row is clicked
  const fetchFarmerDetails = async (
    farmerId: string,
    summaryRecord?: RSBSARecord,
  ) => {
    try {
      setLoadingFarmerDetail(true);

      // Fetch basic farmer info
      const farmerResponse = await getRsbsaSubmissionById(farmerId);
      if (farmerResponse.error)
        throw new Error("Failed to fetch farmer details");
      const farmerData = farmerResponse.data;

      // Fetch parcels
      const parcelsResponse = await getFarmParcels(farmerId);
      if (parcelsResponse.error) throw new Error("Failed to fetch parcels");
      const parcelsData = parcelsResponse.data || [];

      // Handle both JSONB (data property) and structured column formats
      const data = farmerData.data || farmerData;
      const selectedRecord =
        summaryRecord || rsbsaRecords.find((record) => record.id === farmerId);

      const formattedSubmittedDate = (() => {
        if (!selectedRecord?.dateSubmitted) return "N/A";
        const parsedDate = new Date(selectedRecord.dateSubmitted);
        return Number.isNaN(parsedDate.getTime())
          ? "N/A"
          : parsedDate.toLocaleDateString();
      })();

      // Parse farming activities from the data
      const activities: string[] = [];

      // Check for farming activities in various possible field names
      if (data.farmerRice || data.FARMER_RICE || data.farmer_rice)
        activities.push("Rice");
      if (data.farmerCorn || data.FARMER_CORN || data.farmer_corn)
        activities.push("Corn");
      if (
        data.farmerOtherCrops ||
        data.FARMER_OTHER_CROPS ||
        data.farmer_other_crops
      ) {
        activities.push(
          `Other Crops: ${data.farmerOtherCropsText || data.FARMER_OTHER_CROPS_TEXT || data.farmer_other_crops_text || ""}`,
        );
      }
      if (
        data.farmerLivestock ||
        data.FARMER_LIVESTOCK ||
        data.farmer_livestock
      ) {
        activities.push(
          `Livestock: ${data.farmerLivestockText || data.FARMER_LIVESTOCK_TEXT || data.farmer_livestock_text || ""}`,
        );
      }
      if (data.farmerPoultry || data.FARMER_POULTRY || data.farmer_poultry) {
        activities.push(
          `Poultry: ${data.farmerPoultryText || data.FARMER_POULTRY_TEXT || data.farmer_poultry_text || ""}`,
        );
      }

      // If no activities found, check if mainLivelihood indicates farming type
      if (
        activities.length === 0 &&
        (data.mainLivelihood || data["MAIN LIVELIHOOD"] || data.main_livelihood)
      ) {
        activities.push(
          data.mainLivelihood ||
            data["MAIN LIVELIHOOD"] ||
            data.main_livelihood,
        );
      }

      // Reformat the farmer name from "Last, First, Middle, Ext" to "Last, First Middle Ext"
      const backendName = farmerData.farmerName || "";
      const reformattedFarmerName = (() => {
        if (!backendName || backendName === "N/A") return "N/A";
        const parts = backendName
          .split(",")
          .map((p: string) => p.trim())
          .filter(Boolean);
        if (parts.length === 0) return "N/A";
        if (parts.length === 1) return parts[0]; // Just last name
        // Join all parts after the first with spaces (First Middle Ext)
        const lastName = parts[0];
        const restOfName = parts.slice(1).join(" ");
        return `${lastName}, ${restOfName}`;
      })();

      // Build parcels array from rsbsa_farm_parcels; if empty, fall back to submission-level farm data
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
      }));

      // Fallback: if no parcels in rsbsa_farm_parcels, build from submission-level data
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
          const fallbackBarangay =
            locationParts[0] || data.barangay || data["BARANGAY"] || "N/A";
          const fallbackMunicipality =
            locationParts[1] ||
            data.municipality ||
            data["MUNICIPALITY"] ||
            "Dumangas";

          mappedParcels = [
            {
              id: `submission-${farmerId}`,
              parcelNumber: "N/A",
              farmLocationBarangay: fallbackBarangay,
              farmLocationMunicipality: fallbackMunicipality,
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

      const farmerDetail: FarmerDetail = {
        id: farmerId,
        referenceNumber: selectedRecord?.referenceNumber || "N/A",
        dateSubmitted: formattedSubmittedDate,
        recordStatus: selectedRecord?.status || "N/A",
        farmerName: reformattedFarmerName,
        farmerAddress: farmerData.farmerAddress || "N/A",
        age: normalizedDetailAge ?? "N/A",
        gender: data.gender || "N/A",
        mainLivelihood: data.mainLivelihood || "N/A",
        farmingActivities: activities,
        parcels: mappedParcels,
      };

      setSelectedFarmer(farmerDetail);
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
    ) {
      age--;
    }

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
      const parsedAge = Number(ageValue);
      if (Number.isFinite(parsedAge) && parsedAge >= 0) {
        return Math.floor(parsedAge);
      }
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

      // Keep all records (including 'No Parcels') — filtering is done in filteredRecords
      const allData = Array.isArray(data) ? data : [];

      const formattedRecords: RSBSARecord[] = allData.map(
        (item: any, idx: number) => {
          // Prefer backend-transformed fields; fallback to raw

          const referenceNumber = String(
            item.referenceNumber ?? `RSBSA-${idx + 1}`,
          );
          // Backend returns farmerName as "Last, First, Middle, Ext"
          // Convert it to "Last, First Middle Ext" (comma after last name only)
          const backendName = item.farmerName || "";
          const reformattedName = (() => {
            if (!backendName || backendName === "—") return "—";
            const parts = backendName
              .split(",")
              .map((p: string) => p.trim())
              .filter(Boolean);
            if (parts.length === 0) return "—";
            if (parts.length === 1) return parts[0]; // Just last name
            // Join all parts after the first with spaces (First Middle Ext)
            const lastName = parts[0];
            const restOfName = parts.slice(1).join(" ");
            return `${lastName}, ${restOfName}`;
          })();
          const farmerName = String(reformattedName);
          const farmerAddress = String(
            item.farmerAddress ?? item.addressBarangay ?? "—",
          );
          const farmLocation = String(item.farmLocation ?? "—");
          const landParcel = String(item.landParcel ?? "—");
          const parcelArea = (() => {
            const direct = item.parcelArea ?? item["PARCEL AREA"];
            if (
              direct !== undefined &&
              direct !== null &&
              String(direct).trim() !== ""
            ) {
              return String(direct);
            }
            // Fallback: parse from landParcel string e.g., "... (1.25 ha)"
            const match = /\(([^)]+)\)/.exec(landParcel);
            return match ? match[1] : "—";
          })();
          const dateSubmitted = item.dateSubmitted
            ? new Date(item.dateSubmitted).toISOString()
            : item.createdAt
              ? new Date(item.createdAt).toISOString()
              : "";
          const age = normalizeAgeValue(
            item.age,
            item.birthdate ??
              item.dateOfBirth ??
              item.BIRTHDATE ??
              item["DATE OF BIRTH"] ??
              null,
          );
          const archivedAt =
            item.archivedAt ??
            item.archived_at ??
            item._raw?.archived_at ??
            null;
          const archiveReason =
            item.archiveReason ??
            item.archive_reason ??
            item._raw?.archive_reason ??
            null;

          // Reflect database status semantics: Submitted / Not Submitted
          const status = String(item.status ?? "Not Submitted");

          return {
            id: String(item.id), // Use the actual database ID
            referenceNumber,
            farmerName,
            farmerAddress,
            farmLocation,
            parcelArea,
            parcelCount:
              typeof item.parcelCount === "number" ? item.parcelCount : 0,
            age,
            dateSubmitted,
            status,
            landParcel,
            archivedAt,
            archiveReason,
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
      const validIds = new Set(rsbsaRecords.map((record) => record.id));
      const next = new Set<string>();
      previous.forEach((id) => {
        if (validIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [rsbsaRecords]);

  const getRecordBarangay = (record: RSBSARecord) => {
    const fromAddress = String(record.farmerAddress || "")
      .split(",")[0]
      ?.trim();
    const fromFarmLocation = String(record.farmLocation || "")
      .split(",")[0]
      ?.trim();
    const candidate =
      fromAddress && fromAddress !== "—" ? fromAddress : fromFarmLocation;

    if (!candidate) return "";

    const normalized = candidate.toLowerCase();
    if (
      normalized === "—" ||
      normalized === "n/a" ||
      normalized === "na" ||
      normalized === "unknown"
    ) {
      return "";
    }

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

    return {
      owner,
      tenant,
      lessee,
      tenantLessee,
      category,
    };
  };

  const filteredRecords = rsbsaRecords
    .filter((record) => {
      // Normalize status to handle casing/spacing differences and map to active groups
      const normalizedStatus = (record.status || "").toLowerCase().trim();

      // Active statuses: Submitted, Active Farmer, Approved
      const activeStatuses = new Set([
        "submitted",
        "approved",
        "active",
        "active farmer",
      ]);

      // Not Active statuses: Not Submitted, Not Active, Draft, Pending
      const notActiveStatuses = new Set([
        "not submitted",
        "not_active",
        "not active",
        "draft",
        "pending",
        "not approved",
        "inactive",
      ]);

      let matchesStatus = true;
      const ownershipFlags = getOwnershipFlags(record);

      if (selectedStatus === "owner") {
        matchesStatus =
          ownershipFlags.category === "registeredOwner" || ownershipFlags.owner;
      } else if (selectedStatus === "tenant") {
        matchesStatus =
          ownershipFlags.tenant ||
          (ownershipFlags.category === "tenantLessee" &&
            ownershipFlags.tenantLessee &&
            !ownershipFlags.lessee);
      } else if (selectedStatus === "lessee") {
        matchesStatus =
          ownershipFlags.lessee ||
          (ownershipFlags.category === "tenantLessee" &&
            ownershipFlags.tenantLessee &&
            !ownershipFlags.tenant);
      } else if (selectedStatus === "active") {
        matchesStatus = activeStatuses.has(normalizedStatus);
      } else if (selectedStatus === "notActive") {
        matchesStatus = notActiveStatuses.has(normalizedStatus);
      } else if (selectedStatus === "noParcels") {
        matchesStatus = normalizedStatus === "no parcels";
      } else if (selectedStatus === "all") {
        // In 'all' mode, hide 'No Parcels' farmers unless showArchived is on
        if (!showArchived && normalizedStatus === "no parcels") return false;
      }

      if (selectedBarangay !== "all") {
        const recordBarangay = getRecordBarangay(record);
        if (
          recordBarangay.localeCompare(selectedBarangay, undefined, {
            sensitivity: "base",
          }) !== 0
        ) {
          return false;
        }
      }

      const q = searchQuery.toLowerCase();
      const matchesSearch =
        record.farmerName.toLowerCase().includes(q) ||
        record.referenceNumber.toLowerCase().includes(q) ||
        record.farmerAddress.toLowerCase().includes(q) ||
        record.farmLocation.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
      const parseAreaValue = (value: string) => {
        const numericTokens = String(value || "").match(/-?\d+(?:\.\d+)?/g);
        if (!numericTokens || numericTokens.length === 0) return 0;

        const total = numericTokens.reduce((sum, token) => {
          const parsed = Number(token);
          return sum + (Number.isFinite(parsed) ? parsed : 0);
        }, 0);

        return Number.isFinite(total) ? total : 0;
      };

      for (const config of sortConfigs) {
        const factor = config.direction === "asc" ? 1 : -1;

        if (config.key === "dateSubmitted") {
          const aTime = Date.parse(a.dateSubmitted);
          const bTime = Date.parse(b.dateSubmitted);
          const safeA = Number.isNaN(aTime) ? -Infinity : aTime;
          const safeB = Number.isNaN(bTime) ? -Infinity : bTime;
          const result = (safeA - safeB) * factor;
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
    () => rsbsaRecords.filter((record) => selectedRecordIds.has(record.id)),
    [rsbsaRecords, selectedRecordIds],
  );

  const selectedNoParcelsRecords = useMemo(
    () =>
      selectedRecords.filter(
        (record) =>
          String(record.status || "")
            .toLowerCase()
            .trim() === "no parcels",
      ),
    [selectedRecords],
  );

  const isNoParcelsQueueView = selectedStatus === "noParcels";
  const visibleColumnCount = isNoParcelsQueueView ? 8 : 7;

  const allFilteredSelected =
    filteredRecords.length > 0 &&
    filteredRecords.every((record) => selectedRecordIds.has(record.id));

  const toggleSelectAllFiltered = () => {
    setSelectedRecordIds((previous) => {
      const next = new Set(previous);
      if (allFilteredSelected) {
        filteredRecords.forEach((record) => next.delete(record.id));
      } else {
        filteredRecords.forEach((record) => next.add(record.id));
      }
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
      const hasOnlyDefaultSort =
        previous.length === 1 &&
        previous[0].key === DEFAULT_SORT_CONFIG.key &&
        previous[0].direction === DEFAULT_SORT_CONFIG.direction;

      if (hasOnlyDefaultSort && key !== "dateSubmitted") {
        return [{ key, direction: defaultDirection }];
      }

      const existingIndex = previous.findIndex((config) => config.key === key);

      if (existingIndex >= 0) {
        return previous.map((config) =>
          config.key === key
            ? {
                ...config,
                direction: config.direction === "asc" ? "desc" : "asc",
              }
            : config,
        );
      }

      const next = [...previous, { key, direction: defaultDirection }];
      if (next.length <= MAX_SORT_LEVELS) return next;

      // Keep only the last N criteria so sort priority is always clear and bounded.
      return next.slice(next.length - MAX_SORT_LEVELS);
    });
  };

  const resetSortConfig = () => {
    setSortConfigs([{ ...DEFAULT_SORT_CONFIG }]);
  };

  const isDefaultSortConfig =
    sortConfigs.length === 1 &&
    sortConfigs[0].key === DEFAULT_SORT_CONFIG.key &&
    sortConfigs[0].direction === DEFAULT_SORT_CONFIG.direction;

  const getSortIndicator = (key: SortKey) => {
    const index = sortConfigs.findIndex((config) => config.key === key);
    if (index === -1) return "↕";

    const direction = sortConfigs[index].direction;
    const arrow = direction === "asc" ? "▲" : "▼";
    return `${arrow}${index + 1}`;
  };

  const isSortActive = (key: SortKey) =>
    sortConfigs.some((config) => config.key === key);

  const statusCounts = useMemo(() => {
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
      "no parcels",
    ]);

    const active = rsbsaRecords.filter((r) =>
      activeStatuses.has((r.status || "").toLowerCase().trim()),
    ).length;
    const inactive = rsbsaRecords.filter((r) =>
      notActiveStatuses.has((r.status || "").toLowerCase().trim()),
    ).length;
    const noParcels = rsbsaRecords.filter(
      (r) => (r.status || "").toLowerCase().trim() === "no parcels",
    ).length;

    return {
      active,
      inactive,
      noParcels,
      total: rsbsaRecords.length,
    };
  }, [rsbsaRecords]);

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
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleString();
  };

  const formatParcelArea = (parcelArea: string) => {
    const parsed = parseFloat(parcelArea);
    if (Number.isFinite(parsed)) {
      return `${parsed.toLocaleString(undefined, {
        minimumFractionDigits: parsed % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      })} ha`;
    }
    return parcelArea && parcelArea !== "—" ? parcelArea : "—";
  };

  const handlePrintSingleRecord = async (record: RSBSARecord) => {
    setPrintingRecordIds((previous) => {
      const next = new Set(previous);
      next.add(record.id);
      return next;
    });

    const result = await printRsbsaFormById({
      farmerId: record.id,
      fallbackReferenceNumber: record.referenceNumber,
      fallbackFarmerName: record.farmerName,
    });

    if (!result.success && !result.cancelled) {
      showUpdateNotification(
        result.error || "Failed to print RSBSA form.",
        "error",
      );
    }

    setPrintingRecordIds((previous) => {
      const next = new Set(previous);
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
      selectedRecords.map((record) => ({
        farmerId: record.id,
        fallbackReferenceNumber: record.referenceNumber,
        fallbackFarmerName: record.farmerName,
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
        `Printed ${result.printedCount || 0} form(s), ${result.failedCount} record(s) failed.`,
        "error",
      );
      return;
    }

    showUpdateNotification("Selected RSBSA forms sent to print.", "success");
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

    if (!result.success && !result.cancelled) {
      showUpdateNotification(
        result.error || "Failed to print RSBSA form.",
        "error",
      );
    }
  };

  const handleRestoreNoParcelsRecord = async (record: RSBSARecord) => {
    const normalizedStatus = String(record.status || "")
      .toLowerCase()
      .trim();
    if (normalizedStatus !== "no parcels") return;

    const confirmed = window.confirm(
      `Restore ${record.farmerName} as Active Farmer?`,
    );
    if (!confirmed) return;

    setRestoringRecordIds((previous) => {
      const next = new Set(previous);
      next.add(record.id);
      return next;
    });

    try {
      const response = await updateRsbsaSubmission(record.id, {
        status: "Active Farmer",
        archived_at: null,
        archive_reason: null,
      });

      if (response.error) {
        throw new Error(response.error);
      }

      setRsbsaRecords((previous) =>
        previous.map((current) =>
          current.id === record.id
            ? {
                ...current,
                status: "Active Farmer",
                archivedAt: null,
                archiveReason: null,
              }
            : current,
        ),
      );

      showUpdateNotification(
        `${record.farmerName} was restored to Active Farmer.`,
        "success",
      );
      setOpenMenuId(null);
    } catch (err: any) {
      showUpdateNotification(
        err?.message || "Failed to restore farmer status.",
        "error",
      );
    } finally {
      setRestoringRecordIds((previous) => {
        const next = new Set(previous);
        next.delete(record.id);
        return next;
      });
    }
  };

  const handleBulkRestoreNoParcels = async () => {
    if (selectedNoParcelsRecords.length === 0) {
      showUpdateNotification("No No-Parcels farmers selected.", "error");
      return;
    }

    const confirmed = window.confirm(
      `Restore ${selectedNoParcelsRecords.length} farmer${selectedNoParcelsRecords.length === 1 ? "" : "s"} as Active Farmer?`,
    );
    if (!confirmed) return;

    const idsToRestore = selectedNoParcelsRecords.map((record) => record.id);

    setRestoringRecordIds((previous) => {
      const next = new Set(previous);
      idsToRestore.forEach((id) => next.add(id));
      return next;
    });

    try {
      const settled = await Promise.allSettled(
        selectedNoParcelsRecords.map(async (record) => {
          const response = await updateRsbsaSubmission(record.id, {
            status: "Active Farmer",
            archived_at: null,
            archive_reason: null,
          });

          if (response.error) {
            throw new Error(response.error);
          }

          return record.id;
        }),
      );

      const restoredIds = new Set<string>();
      let failedCount = 0;

      settled.forEach((result) => {
        if (result.status === "fulfilled") {
          restoredIds.add(result.value);
        } else {
          failedCount += 1;
        }
      });

      if (restoredIds.size > 0) {
        setRsbsaRecords((previous) =>
          previous.map((record) =>
            restoredIds.has(record.id)
              ? {
                  ...record,
                  status: "Active Farmer",
                  archivedAt: null,
                  archiveReason: null,
                }
              : record,
          ),
        );

        setSelectedRecordIds((previous) => {
          const next = new Set(previous);
          restoredIds.forEach((id) => next.delete(id));
          return next;
        });
      }

      if (failedCount > 0) {
        showUpdateNotification(
          `Restored ${restoredIds.size} farmer${restoredIds.size === 1 ? "" : "s"}; ${failedCount} failed.`,
          "error",
        );
      } else {
        showUpdateNotification(
          `Restored ${restoredIds.size} farmer${restoredIds.size === 1 ? "" : "s"} to Active Farmer.`,
          "success",
        );
      }
    } catch (err: any) {
      showUpdateNotification(
        err?.message || "Failed to restore selected farmers.",
        "error",
      );
    } finally {
      setRestoringRecordIds((previous) => {
        const next = new Set(previous);
        idsToRestore.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case "Submitted":
      case "Active Farmer":
        return "jo-masterlist-status-approved";
      case "Not Submitted":
        return "jo-masterlist-status-not-approved";
      case "No Parcels":
        return "jo-masterlist-status-no-parcels";
      default:
        return "jo-masterlist-status-pending";
    }
  };

  const getOwnershipLabel = (record: RSBSARecord) => {
    const flags = getOwnershipFlags(record);

    if (flags.category === "registeredOwner" || flags.owner) {
      return "Registered Owner";
    }

    if (flags.tenant && flags.lessee) {
      return "Tenant + Lessee";
    }

    if (flags.tenant) {
      return "Tenant";
    }

    if (flags.lessee) {
      return "Lessee";
    }

    if (flags.category === "tenantLessee" || flags.tenantLessee) {
      return "Tenant or Lessee";
    }

    return "—";
  };

  const getOwnershipClass = (record: RSBSARecord) => {
    const flags = getOwnershipFlags(record);

    if (flags.category === "registeredOwner" || flags.owner) {
      return "jo-masterlist-ownership-owner";
    }

    if (flags.tenant && flags.lessee) {
      return "jo-masterlist-ownership-mixed";
    }

    if (flags.tenant) {
      return "jo-masterlist-ownership-tenant";
    }

    if (flags.lessee) {
      return "jo-masterlist-ownership-lessee";
    }

    if (flags.category === "tenantLessee" || flags.tenantLessee) {
      return "jo-masterlist-ownership-tenant";
    }

    return "jo-masterlist-ownership-unknown";
  };

  const getFarmerInitials = (fullName: string) => {
    const cleaned = (fullName || "")
      .replace(/,/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "");
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

    if (parts.length === 0) {
      return { lastName: "", firstName: "", middleName: "" };
    }
    if (parts.length === 1) {
      return { lastName: parts[0] || "", firstName: "", middleName: "" };
    }

    // parts.length >= 2: format is "LastName, FirstName MiddleName"
    const [last, firstMiddle] = parts;
    const firstMiddleParts = (firstMiddle || "")
      .split(" ")
      .map((p) => p.trim())
      .filter(Boolean);

    return {
      lastName: last || "",
      firstName: firstMiddleParts[0] || "",
      middleName: firstMiddleParts.slice(1).join(" ") || "",
    };
  };

  // Parses the address into barangay and municipality based on the assumption that they are separated by a comma
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
      const normalizedCandidate = normalizeText(candidate);
      const exact = barangays.find(
        (b) => normalizeText(b) === normalizedCandidate,
      );
      return exact || "";
    };

    // 1) Prefer address barangay if it matches known barangays
    const fromAddress = matchBarangay(addressBarangay);
    if (fromAddress) return fromAddress;

    // 2) Fall back to farm location first token (e.g., "Cali, Dumangas")
    const parsedFarmLocation = parseAddress(farmLocation || "");
    const fromFarmLocation = matchBarangay(
      parsedFarmLocation.barangay || farmLocation,
    );
    if (fromFarmLocation) return fromFarmLocation;

    return "";
  };

  const handleEdit = async (recordId: string) => {
    const recordToEdit = rsbsaRecords.find((record) => record.id === recordId);
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
        const fromFarmLocation = (parsedFarmLocation.municipality || "").trim();
        if (fromFarmLocation) return fromFarmLocation;
        return "Dumangas";
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

      // Fetch individual parcels for this submission
      setLoadingParcels(true);
      setParcelErrors({}); // Clear any previous errors
      try {
        const response = await getFarmParcels(recordId);
        if (!response.error) {
          const parcels = response.data || [];
          setEditingParcels(parcels);
        } else {
          console.error("Failed to fetch parcels");
          setEditingParcels([]);
        }
      } catch (error) {
        console.error("Error fetching parcels:", error);
        setEditingParcels([]);
      } finally {
        setLoadingParcels(false);
      }
    }
    setOpenMenuId(null);
  };

  const extractParcelAreaNumber = (value: string): string => {
    if (!value) return "";
    // If it contains "hectares", extract just the number part
    if (value.includes("hectares")) {
      return value.replace(/\s*hectares\s*$/i, "").trim();
    }
    return value;
  };

  // Updates the edit form data state for a specific field
  const handleInputChange = (field: keyof EditFormData, value: string) => {
    setEditError(null);
    setEditFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleIndividualParcelChange = (
    parcelId: string,
    field: keyof Parcel,
    value: any,
  ) => {
    setEditError(null);
    // Validate if the field is total_farm_area_ha
    if (field === "total_farm_area_ha") {
      const valueStr = String(value).trim();

      // Check if empty
      if (valueStr === "") {
        setParcelErrors((prev) => ({
          ...prev,
          [parcelId]: "Parcel area is required",
        }));
        setEditingParcels((prev) =>
          prev.map((parcel) =>
            parcel.id === parcelId ? { ...parcel, [field]: 0 } : parcel,
          ),
        );
        return;
      }

      // Check if it's a valid number
      const numValue = parseFloat(valueStr);
      if (isNaN(numValue)) {
        setParcelErrors((prev) => ({
          ...prev,
          [parcelId]: "Parcel area must be a valid number",
        }));
        return;
      }

      // Check if it's positive
      if (numValue <= 0) {
        setParcelErrors((prev) => ({
          ...prev,
          [parcelId]: "Parcel area must be greater than 0",
        }));
        setEditingParcels((prev) =>
          prev.map((parcel) =>
            parcel.id === parcelId ? { ...parcel, [field]: numValue } : parcel,
          ),
        );
        return;
      }

      setEditingParcels((prev) =>
        prev.map((parcel) =>
          parcel.id === parcelId ? { ...parcel, [field]: numValue } : parcel,
        ),
      );
    } else {
      // For other fields, just update without validation
      setEditingParcels((prev) =>
        prev.map((parcel) =>
          parcel.id === parcelId ? { ...parcel, [field]: value } : parcel,
        ),
      );
    }
  };

  const handleSave = async () => {
    if (editingRecord && editFormData) {
      try {
        setEditError(null);

        // Validate all parcels before saving
        if (editingParcels.length > 0) {
          let hasErrors = false;
          const newErrors: Record<string, string> = {};

          // Validate each parcel's total_farm_area_ha field
          editingParcels.forEach((parcel) => {
            if (!parcel.total_farm_area_ha || parcel.total_farm_area_ha <= 0) {
              hasErrors = true;
              newErrors[parcel.id] =
                "Parcel area must be a valid positive number";
            }
          });

          // If there are errors, set the parcelErrors state and prevent saving
          if (hasErrors) {
            setParcelErrors(newErrors);
            setEditError("Please fix all parcel area errors before saving");
            showUpdateNotification(
              "Please fix all parcel area errors before saving.",
              "error",
            );
            return;
          }
        }

        // Validate age input: if provided, it must be a valid number and at least 18
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

        // Start with the existing record data
        const existingData = {
          farmerName: editingRecord.farmerName,
          farmerAddress: editingRecord.farmerAddress,
          farmLocation: editingRecord.farmLocation,
          parcelArea: editingRecord.parcelArea,
          age: editingRecord.age,
        };

        // Compose farmerName from discrete name fields (Last, First Middle)
        const composedFarmerName = (() => {
          const last = (editFormData.lastName ?? "").trim();
          const first = (editFormData.firstName ?? "").trim();
          const middle = (editFormData.middleName ?? "").trim();

          // Combine first and middle with space
          const firstMiddle = [first, middle].filter(Boolean).join(" ");

          // Combine last name with firstMiddle using comma
          const parts: string[] = [];
          if (last) parts.push(last);
          if (firstMiddle) parts.push(firstMiddle);

          return parts.length > 0
            ? parts.join(", ")
            : (editFormData.farmerName ?? editingRecord.farmerName);
        })();

        // Compose address from barangay and municipality if provided
        const composedAddress = (() => {
          const b = (editFormData.barangay ?? "").trim();
          const m = (editFormData.municipality ?? "").trim();
          if (b && m) return `${b}, ${m}`;
          if (b) return b;
          if (m) return m;
          return editFormData.farmerAddress ?? editingRecord.farmerAddress;
        })();

        // Calculate new parcel area string from individual parcels
        const newParcelAreaString =
          editingParcels.length > 0
            ? editingParcels.map((p) => p.total_farm_area_ha).join(", ")
            : (editFormData.parcelArea ?? editingRecord.parcelArea);

        // Format the data for submission
        const formattedData = {
          ...existingData,
          ...editFormData,
          farmerName: composedFarmerName,
          farmerAddress: composedAddress,
          // Use the calculated parcel area string from individual parcels
          parcelArea: newParcelAreaString,
          // Persist age as number in the database/local table record
          age: normalizedAge,
        };

        // Remove any undefined or empty values
        // Also send discrete name fields if present to align with backend columns
        const withNameFields: Record<string, any> = {
          ...formattedData,
          firstName: editFormData.firstName,
          middleName: editFormData.middleName,
          surname: editFormData.lastName,

          addressBarangay: editFormData.barangay,
          addressMunicipality: editFormData.municipality,
        };

        const cleanedData = Object.entries(withNameFields).reduce(
          (acc, [key, value]) => {
            if (value !== undefined && value !== "") {
              acc[key] = value;
            }
            return acc;
          },
          {} as Record<string, any>,
        );

        // Update the record in the database
        const response = await updateRsbsaSubmission(
          editingRecord.id,
          cleanedData,
        );

        if (response.error) {
          throw new Error(response.error || `HTTP error!`);
        }

        const updatedRecord = response.data;

        // Update individual parcels if they were edited
        if (editingParcels.length > 0) {
          for (const parcel of editingParcels) {
            try {
              const parcelResponse = await updateFarmParcel(parcel.id, {
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
              });

              if (parcelResponse.error) {
                console.error(`Failed to update parcel ${parcel.id}`);
              }
            } catch (error) {
              console.error(`Error updating parcel ${parcel.id}:`, error);
            }
          }
        }

        // Update the local state with the response from the server
        const serverRecord =
          updatedRecord?.updatedRecord ?? updatedRecord ?? {};
        const updatedRecordData: RSBSARecord = {
          ...editingRecord,
          ...formattedData,
          // Use any additional fields returned from the server
          ...serverRecord,
          age: normalizeAgeValue(
            serverRecord.age ?? formattedData.age,
            serverRecord.birthdate ?? serverRecord.dateOfBirth ?? null,
          ),
        };

        // Update the main rsbsaRecords state
        setRsbsaRecords((prev) =>
          prev.map((record) =>
            record.id === editingRecord.id ? updatedRecordData : record,
          ),
        );

        // Close edit mode
        setEditingRecord(null);
        setEditFormData({});
        setEditError(null);
        setEditingParcels([]);
        setParcelErrors({});

        showUpdateNotification(
          "Land owner information updated successfully.",
          "success",
        );
      } catch (error) {
        console.error("Error updating record:", error);
        const message =
          error instanceof Error
            ? error.message
            : "Failed to update record. Please try again.";
        setEditError(message);
        showUpdateNotification(message, "error");
      }
    }
  };

  return (
    <div className="jo-masterlist-page-container">
      <div className="jo-masterlist-page has-mobile-sidebar">
        {/* Sidebar starts here */}
        <div className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
          <nav className="sidebar-nav">
            <div className="sidebar-logo">
              <img src={LogoImage} alt="Logo" />
            </div>

            <button
              className={`sidebar-nav-item ${isActive("/jo-dashboard") ? "active" : ""}`}
              onClick={() => navigate("/jo-dashboard")}
            >
              <span className="nav-icon">
                <img src={HomeIcon} alt="Home" />
              </span>
              <span className="nav-text">Home</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/jo-rsbsapage") ? "active" : ""}`}
              onClick={() => navigate("/jo-rsbsapage")}
            >
              <span className="nav-icon">
                <img src={RSBSAIcon} alt="RSBSA" />
              </span>
              <span className="nav-text">RSBSA</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/jo-incentives") ? "active" : ""}`}
              onClick={() => navigate("/jo-incentives")}
            >
              <span className="nav-icon">
                <img src={IncentivesIcon} alt="Incentives" />
              </span>
              <span className="nav-text">Subsidy</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/jo-masterlist") ? "active" : ""}`}
              onClick={() => navigate("/jo-masterlist")}
            >
              <span className="nav-icon">
                <img src={MasterlistIcon} alt="Masterlist" />
              </span>
              <span className="nav-text">Masterlist</span>
            </button>

            <div
              className={`sidebar-nav-item ${isActive("/jo-land-registry") ? "active" : ""}`}
              onClick={() => navigate("/jo-land-registry")}
            >
              <div className="nav-icon">🗺️</div>
              <span className="nav-text">Land Registry</span>
            </div>

            <div
              className={`sidebar-nav-item ${isActive("/jo-land-history-report") ? "active" : ""}`}
              onClick={() => navigate("/jo-land-history-report")}
            >
              <div className="nav-icon">📜</div>
              <span className="nav-text">Land History Report</span>
            </div>

            <button
              className="sidebar-nav-item logout"
              onClick={() => navigate("/")}
            >
              <span className="nav-icon">
                <img src={LogoutIcon} alt="Logout" />
              </span>
              <span className="nav-text">Logout</span>
            </button>
          </nav>
        </div>
        {/* Sidebar ends here */}
        <div
          className={`tech-incent-sidebar-overlay ${sidebarOpen ? "active" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Main content starts here */}
        <div className="jo-masterlist-main-content">
          <div className="tech-incent-mobile-header">
            <button
              className="tech-incent-hamburger"
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              ☰
            </button>
            <div className="tech-incent-mobile-title">JO Masterlist</div>
          </div>
          <div className="jo-masterlist-dashboard-header">
            <div>
              <h2 className="jo-masterlist-page-title">Masterlist</h2>
              <p className="jo-masterlist-page-subtitle">
                Browse all RSBSA farmers, filter by status, and manage records
              </p>
            </div>
          </div>

          {!loading && !error && (
            <div className="jo-masterlist-status-cards">
              <div className="jo-masterlist-status-card jo-masterlist-card-total">
                <div className="jo-masterlist-card-icon">👥</div>
                <div className="jo-masterlist-card-info">
                  <span className="jo-masterlist-card-count">
                    {statusCounts.total}
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
                    {statusCounts.active}
                  </span>
                  <span className="jo-masterlist-card-label">Active</span>
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
            </div>
          )}

          <div className="jo-masterlist-content-card">
            <div className="jo-masterlist-filters-section">
              <div className="jo-masterlist-search-filter">
                <input
                  type="text"
                  placeholder="Search by farmer name, reference number, or barangay..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="jo-masterlist-search-input"
                />
              </div>

              <div className="jo-masterlist-status-filter">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="jo-masterlist-status-select"
                >
                  <option value="all">All</option>
                  <option value="owner">Registered Owner</option>
                  <option value="tenant">Tenant</option>
                  <option value="lessee">Lessee</option>
                  <option value="active">Active</option>
                  <option value="notActive">Not Active</option>
                  <option value="noParcels">No Parcels</option>
                </select>
              </div>

              <div className="jo-masterlist-status-filter">
                <select
                  value={selectedBarangay}
                  onChange={(e) => setSelectedBarangay(e.target.value)}
                  className="jo-masterlist-status-select"
                >
                  <option value="all">All Barangays</option>
                  {barangays.map((barangay) => (
                    <option key={barangay} value={barangay}>
                      {barangay}
                    </option>
                  ))}
                </select>
              </div>

              <label className="jo-masterlist-archived-toggle">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                />
                Include Archived ({statusCounts.noParcels})
              </label>
            </div>

            {!loading && !error && (
              <div className="jo-masterlist-table-meta">
                <span>
                  Showing {filteredRecords.length} of {rsbsaRecords.length}{" "}
                  farmers
                </span>
                <span>
                  Tip: Sort up to 2 levels (e.g. Farmer then Parcel Area).
                </span>
                {!showArchived && statusCounts.noParcels > 0 && (
                  <span>
                    {statusCounts.noParcels} farmer
                    {statusCounts.noParcels === 1 ? "" : "s"} with No Parcels
                    are hidden.
                  </span>
                )}
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
                        setShowBulkExportMenu((previous) => !previous);
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

                  {selectedNoParcelsRecords.length > 0 && (
                    <button
                      className="jo-masterlist-bulk-btn jo-masterlist-bulk-btn-restore"
                      onClick={handleBulkRestoreNoParcels}
                      disabled={selectedNoParcelsRecords.every((record) =>
                        restoringRecordIds.has(record.id),
                      )}
                    >
                      {selectedNoParcelsRecords.every((record) =>
                        restoringRecordIds.has(record.id),
                      )
                        ? "Restoring..."
                        : `Restore No Parcels (${selectedNoParcelsRecords.length})`}
                    </button>
                  )}

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
                    <th>
                      <button
                        className={`jo-masterlist-sort-btn ${
                          isSortActive("farmerName") ? "is-active" : ""
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSortChange("farmerName");
                        }}
                      >
                        Farmer <span>{getSortIndicator("farmerName")}</span>
                      </button>
                    </th>
                    <th>Address</th>
                    <th>
                      <button
                        className={`jo-masterlist-sort-btn ${
                          isSortActive("parcelArea") ? "is-active" : ""
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSortChange("parcelArea");
                        }}
                      >
                        Parcel Area{" "}
                        <span>{getSortIndicator("parcelArea")}</span>
                      </button>
                    </th>
                    <th>
                      <button
                        className={`jo-masterlist-sort-btn ${
                          isSortActive("dateSubmitted") ? "is-active" : ""
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSortChange("dateSubmitted");
                        }}
                      >
                        Date Submitted{" "}
                        <span>{getSortIndicator("dateSubmitted")}</span>
                      </button>
                    </th>
                    <th>
                      <button
                        className={`jo-masterlist-sort-btn ${
                          isSortActive("status") ? "is-active" : ""
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSortChange("status");
                        }}
                      >
                        Status <span>{getSortIndicator("status")}</span>
                      </button>
                    </th>
                    {isNoParcelsQueueView && <th>Archive Details</th>}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td
                        colSpan={visibleColumnCount}
                        className="jo-masterlist-loading-cell"
                      >
                        Loading...
                      </td>
                    </tr>
                  )}

                  {error && !loading && (
                    <tr>
                      <td
                        colSpan={visibleColumnCount}
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
                      const statusText = record.status || "Not Submitted";
                      const normalizedStatus = statusText.toLowerCase().trim();
                      const isNoParcelsStatus =
                        normalizedStatus === "no parcels";
                      const archiveMeta = [
                        record.archiveReason || "",
                        record.archivedAt
                          ? `Archived: ${formatDateTime(record.archivedAt)}`
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" • ");

                      return (
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
                                  Ref: {record.referenceNumber}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="jo-masterlist-address-cell">
                              <span className="jo-masterlist-address-primary">
                                {record.farmerAddress}
                              </span>
                            </div>
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
                              <span
                                className={`jo-masterlist-ownership-pill ${getOwnershipClass(record)}`}
                              >
                                {getOwnershipLabel(record)}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className="jo-masterlist-date">
                              {formatDate(record.dateSubmitted)}
                            </span>
                          </td>
                          <td>
                            <div className="jo-masterlist-status-cell">
                              <span
                                className={`jo-masterlist-status-pill ${getStatusClass(statusText)}`}
                              >
                                {statusText}
                              </span>
                              {isNoParcelsStatus && archiveMeta && (
                                <span className="jo-masterlist-archive-meta">
                                  {archiveMeta}
                                </span>
                              )}
                            </div>
                          </td>
                          {isNoParcelsQueueView && (
                            <td>
                              <div className="jo-masterlist-queue-archive-cell">
                                <strong>
                                  {record.archiveReason ||
                                    "All parcels transferred"}
                                </strong>
                                <span>
                                  {record.archivedAt
                                    ? `Archived ${formatDateTime(record.archivedAt)}`
                                    : "Archive date not set"}
                                </span>
                              </div>
                            </td>
                          )}
                          <td className="jo-masterlist-actions-cell">
                            <div
                              className="jo-masterlist-quick-actions"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                className="jo-masterlist-view-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId((previous) =>
                                    previous === record.id ? null : record.id,
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
                                  {isNoParcelsStatus && (
                                    <button
                                      className="jo-masterlist-quick-item jo-masterlist-quick-item-restore"
                                      onClick={async () => {
                                        await handleRestoreNoParcelsRecord(
                                          record,
                                        );
                                      }}
                                      disabled={restoringRecordIds.has(
                                        record.id,
                                      )}
                                    >
                                      {restoringRecordIds.has(record.id)
                                        ? "Restoring..."
                                        : "Restore as Active Farmer"}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                  {!loading && !error && filteredRecords.length === 0 && (
                    <tr>
                      <td
                        colSpan={visibleColumnCount}
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

        {/* Edit Modal */}
        {editingRecord && (
          <div className="jo-masterlist-edit-modal-overlay">
            <div className="jo-masterlist-edit-modal">
              <div className="jo-masterlist-edit-modal-header">
                <h2>Edit Land Owner Information</h2>
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
                <div className="form-group">
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
                {/*Gender function kung may jan*/}
                {/*Birthdate function kung may jan*/}
                <div className="form-group">
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
                <div className="form-group">
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
                <div className="form-group">
                  <label>Age:</label>
                  <input
                    type="text"
                    value={editFormData.age || ""}
                    onChange={(e) => handleInputChange("age", e.target.value)}
                    placeholder="Age"
                  />
                </div>
                {/*Barangay function kung may jan*/}
                <div className="form-group">
                  <label>Barangay:</label>
                  <select
                    value={editFormData.barangay || ""}
                    onChange={(e) =>
                      handleInputChange("barangay", e.target.value)
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                    }}
                  >
                    <option value="">Select Barangay</option>
                    {barangays.map((barangay) => (
                      <option key={barangay} value={barangay}>
                        {barangay}
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

                {/* Individual Parcel Areas */}
                <div className="jo-masterlist-parcel-section">
                  <h4>Parcel Areas</h4>
                  {loadingParcels ? (
                    <p>Loading parcels...</p>
                  ) : editingParcels.length > 0 ? (
                    editingParcels.map((parcel, index) => (
                      <div
                        key={parcel.id}
                        className={`jo-masterlist-parcel-item ${parcelErrors[parcel.id] ? "error" : ""}`}
                      >
                        <div className="jo-masterlist-form-group">
                          <label
                            style={{ fontWeight: "bold", color: "#2c5f2d" }}
                          >
                            Parcel Area {index + 1} (Parcel No.{" "}
                            {parcel.parcel_number}):
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
                            placeholder="e.g., 2.5"
                            style={{
                              width: "100%",
                              border: parcelErrors[parcel.id]
                                ? "2px solid #d32f2f"
                                : "1px solid #ccc",
                              backgroundColor: parcelErrors[parcel.id]
                                ? "#ffebee"
                                : "white",
                              outline: parcelErrors[parcel.id]
                                ? "none"
                                : undefined,
                            }}
                          />
                          {parcelErrors[parcel.id] && (
                            <small className="jo-masterlist-parcel-error">
                              {parcelErrors[parcel.id]}
                            </small>
                          )}
                          <small
                            style={{
                              color: "#666",
                              fontSize: "0.85em",
                              display: "block",
                              marginTop: "5px",
                            }}
                          >
                            Location: {parcel.farm_location_barangay || "N/A"}
                          </small>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: "#666", fontStyle: "italic" }}>
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
                      </div>
                    </div>

                    {/* Personal Information */}
                    <div className="farmer-modal-section">
                      <h3 className="farmer-modal-section-title">
                        👤 Personal Information
                      </h3>
                      <div className="farmer-modal-info-grid">
                        <div className="farmer-modal-info-item">
                          <span className="farmer-modal-label">
                            Farmer Name:
                          </span>
                          <span className="farmer-modal-value">
                            {selectedFarmer.farmerName}
                          </span>
                        </div>
                        <div className="farmer-modal-info-item">
                          <span className="farmer-modal-label">
                            Farmer Address:
                          </span>
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
                            Main Livelihood:
                          </span>
                          <span className="farmer-modal-value">
                            {selectedFarmer.farmingActivities.length > 0
                              ? selectedFarmer.farmingActivities.join(", ")
                              : "Not Available"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Farm Information */}
                    <div className="farmer-modal-section">
                      <h3 className="farmer-modal-section-title">
                        🌾 Farm Information
                      </h3>
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
                                  Parcel #
                                  {(() => {
                                    const pNum = parcel.parcelNumber;
                                    if (!pNum || pNum === "N/A")
                                      return index + 1;
                                    // If it's a simple number, use it directly
                                    if (/^\d+$/.test(pNum)) return pNum;
                                    // If it's an auto-generated ID like "Parcel-208-1", show just the index
                                    return index + 1;
                                  })()}
                                </h4>
                              </div>
                              <div className="farmer-modal-parcel-details">
                                <div className="farmer-modal-parcel-item">
                                  <span className="farmer-modal-label">
                                    Land Ownership:
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
                                    {(parcel.ownershipTypeTenant ||
                                      parcel.ownershipTypeLessee) &&
                                      (parcel.tenantLandOwnerName ||
                                        parcel.lesseeLandOwnerName) && (
                                        <span className="farmer-modal-owner-name">
                                          {" "}
                                          (Owner:{" "}
                                          {parcel.tenantLandOwnerName ||
                                            parcel.lesseeLandOwnerName}
                                          )
                                        </span>
                                      )}
                                  </span>
                                </div>
                                <div className="farmer-modal-parcel-item">
                                  <span className="farmer-modal-label">
                                    Parcel Location:
                                  </span>
                                  <span className="farmer-modal-value">
                                    {parcel.farmLocationBarangay},{" "}
                                    {parcel.farmLocationMunicipality}
                                  </span>
                                </div>
                                <div className="farmer-modal-parcel-item">
                                  <span className="farmer-modal-label">
                                    Parcel Size:
                                  </span>
                                  <span className="farmer-modal-value">
                                    {typeof parcel.totalFarmAreaHa === "number"
                                      ? parcel.totalFarmAreaHa.toFixed(2)
                                      : parseFloat(
                                          String(parcel.totalFarmAreaHa || 0),
                                        ).toFixed(2)}{" "}
                                    hectares
                                  </span>
                                </div>
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

export default JoMasterlist;
