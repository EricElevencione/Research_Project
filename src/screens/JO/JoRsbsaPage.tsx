import { supabase } from "../../supabase";
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  getRsbsaSubmissions,
  getRsbsaSubmissionById,
  getFarmParcels,
  updateRsbsaSubmission,
  updateFarmParcel,
} from "../../api";
import { printRsbsaFormById } from "../../utils/rsbsaPrint";
import "../../assets/css/jo css/JoRsbsaPageStyle.css";
import JOSidebar from "../../components/Layout/JOSidebar";
import "../../assets/css/jo css/FarmerDetailModal.css";
import {
  getAuditLogger,
  AuditModule,
} from "../../components/Audit/auditLogger";
import { getCurrentUserForAudit } from "../../components/Audit/getCurrentUserForAudit";

interface RSBSARecord {
  id: string;
  referenceNumber: string;
  farmerName: string;
  farmerAddress: string;
  farmLocation: string;
  gender: string;
  birthdate: string;
  age?: number | string | null;
  dateSubmitted: string;
  status: string;
  landParcel: string;
  parcelArea: number | string | null;
  totalFarmArea: number | string;
  parcelCount: number;
  cultivationStatus?: string;
  mainLivelihood?: string;
  farmerRice?: boolean;
  farmerCorn?: boolean;
  farmerOtherCrops?: boolean;
  farmerOtherCropsText?: string;
  farmerLivestock?: boolean;
  farmerLivestockText?: string;
  farmerPoultry?: boolean;
  farmerPoultryText?: string;
  ownershipType: {
    registeredOwner: boolean;
    tenant: boolean;
    lessee: boolean;
    tenantLessee?: boolean;
    category?: "registeredOwner" | "tenantLessee" | "unknown";
  };
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
  isCultivating?: boolean | null;
  cultivationStatusReason?: string | null;
  cultivationStatusUpdatedAt?: string | null;
  cultivatorSubmissionId?: number | null;
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
  is_cultivating?: boolean | null;
  cultivation_status_reason?: string | null;
  cultivation_status_updated_at?: string | null;
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

type SortKey = "farmer" | "parcelArea" | "dateSubmitted";
type SortDirection = "asc" | "desc";

const JoRsbsaPage: React.FC = () => {
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

  const cultivationReasonOptions = [
    "Tenant/Lessee farming",
    "Contract expired",
    "Idle",
    "Unknown",
  ];

  const [activeTab, setActiveTab] = useState<"registry" | "analytics">(
    "registry",
  );
  const [_rsbsaRecords, _setRsbsaRecords] = useState<RSBSARecord[]>([]);
  const [registeredOwners, setRegisteredOwners] = useState<RSBSARecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState<string>("all");
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
  const [isModalPrinting, setIsModalPrinting] = useState(false);
  const [updateNotification, setUpdateNotification] = useState<{
    show: boolean;
    type: "success" | "error";
    message: string;
  }>({
    show: false,
    type: "success",
    message: "",
  });
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: SortDirection;
  }>({ key: "dateSubmitted", direction: "desc" });
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [originalParcels, setOriginalParcels] = useState<Parcel[]>([]);

  const showUpdateNotification = (
    message: string,
    type: "success" | "error",
  ) => {
    setUpdateNotification({ show: true, type, message });
    setTimeout(() => {
      setUpdateNotification((prev) => ({ ...prev, show: false }));
    }, 3200);
  };

  // Fetch RSBSA records from API
  const fetchRSBSARecords = async () => {
    try {
      setLoading(true);
      const response = await getRsbsaSubmissions();
      if (response.error) {
        throw new Error(response.error);
      }
      const data = response.data || [];
      console.log("Received data from API:", JSON.stringify(data, null, 2));

      // Debug ownership types
      console.log("Sample record ownership type:", data[0]?.ownershipType);
      console.log(
        "Records with ownership types:",
        data.filter((r: { ownershipType: any }) => r.ownershipType).length,
      );

      // Reformat farmer names from "Last, First, Middle, Ext" to "Last, First Middle Ext"
      const formattedData = data.map((record: RSBSARecord) => {
        const backendName = record.farmerName || "";
        const reformattedName = (() => {
          if (!backendName || backendName === "—" || backendName === "N/A")
            return backendName;
          const parts = backendName
            .split(",")
            .map((p: string) => p.trim())
            .filter(Boolean);
          if (parts.length === 0) return backendName;
          if (parts.length === 1) return parts[0]; // Just last name
          // Join all parts after the first with spaces (First Middle Ext)
          const lastName = parts[0];
          const restOfName = parts.slice(1).join(" ");
          return `${lastName}, ${restOfName}`;
        })();
        return {
          ...record,
          farmerName: reformattedName,
        };
      });

      // Use the data directly from backend - it already has totalFarmArea and parcelCount calculated
      _setRsbsaRecords(formattedData);
      const registeredOwnersData = filterRegisteredOwners(formattedData);
      console.log(
        "Filtered registered owners:",
        JSON.stringify(registeredOwnersData, null, 2),
      );
      setRegisteredOwners(registeredOwnersData);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching RSBSA records:", err);
      setError("Failed to load registered land owners data");
    } finally {
      setLoading(false);
    }
  };

  // Function to filter registered owners only
  const filterRegisteredOwners = (records: RSBSARecord[]) => {
    console.log("Total records to filter:", records.length);
    const filtered = records.filter((record: any) => {
      // Keep only farmers with current parcels.
      // hasCurrentParcels: true = has current parcels, false = all transferred, undefined = no parcels yet.
      if (record.hasCurrentParcels !== true) {
        console.log(`Excluding ${record.farmerName}: no current parcels`);
        return false;
      }

      if (!record.ownershipType) {
        console.warn(`Missing ownershipType for ${record.farmerName}`, record);
        return false;
      }
      return record.ownershipType.registeredOwner === true;
    });
    console.log("Filtered registered owners count:", filtered.length);
    return filtered;
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
        summaryRecord ||
        registeredOwners.find((record) => record.id === farmerId);

      const formattedSubmittedDate = (() => {
        if (!selectedRecord?.dateSubmitted) return "N/A";
        const parsedDate = new Date(selectedRecord.dateSubmitted);
        return Number.isNaN(parsedDate.getTime())
          ? "N/A"
          : parsedDate.toLocaleDateString();
      })();

      console.log("Farmer data received:", farmerData);
      console.log("Data object for activities:", data);

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
      if (activities.length === 0 && data.mainLivelihood) {
        activities.push(data.mainLivelihood);
      }

      console.log("Parsed activities:", activities);
      const calculateAge = (birthdate: string): number | string => {
        if (!birthdate || birthdate === "N/A") return "N/A";
        const today = new Date();
        const birthDate = new Date(birthdate);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (
          monthDiff < 0 ||
          (monthDiff === 0 && today.getDate() < birthDate.getDate())
        ) {
          age--;
        }
        return age;
      };

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
        isCultivating:
          typeof p.is_cultivating === "boolean"
            ? p.is_cultivating
            : typeof p.isCultivating === "boolean"
              ? p.isCultivating
              : null,
        cultivationStatusReason:
          p.cultivation_status_reason || p.cultivationStatusReason || null,
        cultivationStatusUpdatedAt:
          p.cultivation_status_updated_at ||
          p.cultivationStatusUpdatedAt ||
          null,
        cultivatorSubmissionId:
          typeof p.cultivator_submission_id === "number"
            ? p.cultivator_submission_id
            : p.cultivatorSubmissionId || null,
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
              isCultivating: null,
              cultivationStatusReason: null,
              cultivationStatusUpdatedAt: null,
              cultivatorSubmissionId: null,
            },
          ];
        }
      }

      const farmerDetail: FarmerDetail = {
        id: farmerId,
        referenceNumber: selectedRecord?.referenceNumber || "N/A",
        dateSubmitted: formattedSubmittedDate,
        recordStatus: selectedRecord?.status || "Active Farmer",
        farmerName: reformattedFarmerName,
        farmerAddress: farmerData.farmerAddress || "N/A",
        age: calculateAge(data.dateOfBirth || data.birthdate || "N/A"),
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

  // Load data on component mount
  useEffect(() => {
    fetchRSBSARecords();
  }, []);

  // Re-filter registered owners when source records change.
  useEffect(() => {
    if (_rsbsaRecords.length > 0) {
      setRegisteredOwners(filterRegisteredOwners(_rsbsaRecords));
    } else {
      setRegisteredOwners([]);
    }
  }, [_rsbsaRecords]);

  // Get unique barangays from registered owners
  const uniqueBarangays = React.useMemo(() => {
    const barangays = new Set<string>();
    registeredOwners.forEach((record) => {
      if (record.farmerAddress) {
        // Extract barangay (first part before comma)
        const barangay = record.farmerAddress.split(",")[0]?.trim();
        if (barangay) barangays.add(barangay);
      }
    });
    return Array.from(barangays).sort();
  }, [registeredOwners]);

  const isActiveFarmerStatus = (statusValue: string) => {
    const activeStatuses = new Set([
      "submitted",
      "approved",
      "active",
      "active farmer",
    ]);
    return activeStatuses.has(
      String(statusValue || "")
        .toLowerCase()
        .trim(),
    );
  };

  const statusCounts = React.useMemo(() => {
    const active = registeredOwners.filter((record) =>
      isActiveFarmerStatus(record.status || ""),
    ).length;
    const total = registeredOwners.length;
    const inactive = Math.max(0, total - active);

    return {
      total,
      active,
      inactive,
    };
  }, [registeredOwners]);

  const registrationStats = React.useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    const startOfWeek = new Date(startOfToday);
    const day = startOfWeek.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    startOfWeek.setDate(startOfWeek.getDate() + diffToMonday);

    const startOfNextWeek = new Date(startOfWeek);
    startOfNextWeek.setDate(startOfNextWeek.getDate() + 7);

    let today = 0;
    let week = 0;

    registeredOwners.forEach((record) => {
      const parsed = Date.parse(record.dateSubmitted || "");
      if (Number.isNaN(parsed)) return;
      if (
        parsed >= startOfToday.getTime() &&
        parsed < startOfTomorrow.getTime()
      )
        today += 1;
      if (parsed >= startOfWeek.getTime() && parsed < startOfNextWeek.getTime())
        week += 1;
    });

    return { today, week };
  }, [registeredOwners]);

  const latestRegistrants = React.useMemo(() => {
    const sorted = [...registeredOwners].sort((a, b) => {
      const dateA = Date.parse(a.dateSubmitted || "");
      const dateB = Date.parse(b.dateSubmitted || "");
      const safeA = Number.isNaN(dateA) ? -Infinity : dateA;
      const safeB = Number.isNaN(dateB) ? -Infinity : dateB;
      if (safeA !== safeB) return safeB - safeA;
      return String(b.id || "").localeCompare(String(a.id || ""));
    });

    return sorted.slice(0, 5);
  }, [registeredOwners]);

  const topBarangays = React.useMemo(() => {
    const counts = new Map<string, number>();
    registeredOwners.forEach((record) => {
      const barangay = getBarangayFromAddress(record.farmerAddress);
      if (!barangay || barangay === "N/A") return;
      counts.set(barangay, (counts.get(barangay) ?? 0) + 1);
    });

    const total = registeredOwners.length;
    const entries = Array.from(counts.entries()).map(([barangay, count]) => ({
      barangay,
      count,
      share: total > 0 ? (count / total) * 100 : 0,
    }));

    entries.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.barangay.localeCompare(b.barangay);
    });

    return entries.slice(0, 5);
  }, [registeredOwners]);

  const landParcelSummary = React.useMemo(() => {
    const cropCounts = new Map<string, number>();
    const tenureCounts = new Map<string, number>();
    let totalArea = 0;
    let totalParcels = 0;

    registeredOwners.forEach((record) => {
      const parsedArea =
        typeof record.totalFarmArea === "number"
          ? record.totalFarmArea
          : parseFloat(
              String(record.totalFarmArea ?? "").replace(/[^0-9.-]/g, ""),
            );
      if (Number.isFinite(parsedArea)) totalArea += parsedArea;

      const parsedParcels =
        typeof record.parcelCount === "number"
          ? record.parcelCount
          : parseInt(String(record.parcelCount ?? "0"), 10);
      if (Number.isFinite(parsedParcels)) totalParcels += parsedParcels;

      if (record.ownershipType?.registeredOwner) {
        tenureCounts.set(
          "Registered Owner",
          (tenureCounts.get("Registered Owner") ?? 0) + 1,
        );
      }
      if (record.ownershipType?.tenant) {
        tenureCounts.set("Tenant", (tenureCounts.get("Tenant") ?? 0) + 1);
      }
      if (record.ownershipType?.lessee) {
        tenureCounts.set("Lessee", (tenureCounts.get("Lessee") ?? 0) + 1);
      }

      const crops = new Set<string>();
      if (record.farmerRice) crops.add("Rice");
      if (record.farmerCorn) crops.add("Corn");
      if (record.farmerOtherCrops) crops.add("Other Crops");
      if (record.farmerLivestock) crops.add("Livestock");
      if (record.farmerPoultry) crops.add("Poultry");

      if (crops.size === 0 && record.mainLivelihood) {
        const normalized = String(record.mainLivelihood).trim();
        if (normalized && normalized.toLowerCase() !== "n/a") {
          crops.add(normalized);
        }
      }

      crops.forEach((crop) => {
        cropCounts.set(crop, (cropCounts.get(crop) ?? 0) + 1);
      });
    });

    const cropBreakdown = Array.from(cropCounts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.label.localeCompare(b.label);
      })
      .slice(0, 6);

    const tenureBreakdown = Array.from(tenureCounts.entries())
      .map(([label, count]) => ({
        label,
        count,
        share:
          registeredOwners.length > 0
            ? (count / registeredOwners.length) * 100
            : 0,
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.label.localeCompare(b.label);
      });

    return {
      totalArea,
      totalParcels,
      cropBreakdown,
      tenureBreakdown,
    };
  }, [registeredOwners]);

  // Filter registered owners based on search query and filters
  const filteredOwners = registeredOwners
    .filter((record) => {
      // Parse name parts once
      const nameParts = record.farmerName.split(", ");
      const lastName = nameParts[0] || "";
      const restOfName = (nameParts[1] || "")
        .split(" ")
        .map((p) => p.trim())
        .filter(Boolean);
      const firstName = restOfName[0] || "";
      const middleName = restOfName[1] || "";
      const extName = restOfName[2] || "";

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          lastName.toLowerCase().includes(query) ||
          firstName.toLowerCase().includes(query) ||
          middleName.toLowerCase().includes(query) ||
          extName.toLowerCase().includes(query) ||
          record.farmerAddress?.toLowerCase().includes(query) ||
          record.gender?.toLowerCase().includes(query) ||
          record.referenceNumber?.toLowerCase().includes(query) ||
          record.referenceNumber
            ?.replace(/-/g, "")
            .toLowerCase()
            .includes(query.replace(/-/g, ""));

        if (!matchesSearch) return false;
      }

      // Barangay filter
      if (selectedBarangay !== "all") {
        const barangay = record.farmerAddress?.split(",")[0]?.trim();
        if (barangay !== selectedBarangay) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const factor = sortConfig.direction === "asc" ? 1 : -1;

      if (sortConfig.key === "farmer") {
        const normalizeFarmer = (fullName: string) => {
          const parts = String(fullName || "")
            .split(",")
            .map((part) => part.trim());
          const last = (parts[0] || "").toLowerCase();
          const rest = parts.slice(1).join(" ").toLowerCase();
          return `${last} ${rest}`.trim();
        };

        return (
          normalizeFarmer(a.farmerName).localeCompare(
            normalizeFarmer(b.farmerName),
          ) * factor
        );
      }

      if (sortConfig.key === "parcelArea") {
        const parseArea = (value: number | string | null | undefined) => {
          const parsed =
            typeof value === "number"
              ? value
              : parseFloat(String(value ?? "0").replace(/[^0-9.-]/g, ""));
          return Number.isFinite(parsed) ? parsed : 0;
        };

        return (
          (parseArea(a.totalFarmArea) - parseArea(b.totalFarmArea)) * factor
        );
      }

      const dateA = Date.parse(a.dateSubmitted || "");
      const dateB = Date.parse(b.dateSubmitted || "");
      const safeA = Number.isNaN(dateA) ? -Infinity : dateA;
      const safeB = Number.isNaN(dateB) ? -Infinity : dateB;
      if (safeA !== safeB) return (safeA - safeB) * factor;

      return (Number(a.id) - Number(b.id)) * factor;
    });

  const handleSortChange = (key: SortKey) => {
    setSortConfig((previous) => {
      if (previous.key === key) {
        return {
          key,
          direction: previous.direction === "asc" ? "desc" : "asc",
        };
      }

      if (key === "farmer") {
        return { key, direction: "asc" };
      }

      return { key, direction: "desc" };
    });
  };

  const getSortIndicator = (key: SortKey) => {
    if (sortConfig.key !== key) return "↕";
    return sortConfig.direction === "asc" ? "▲" : "▼";
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

  const parseName = (
    fullName: string,
  ): { lastName: string; firstName: string; middleName: string } => {
    if (!fullName) return { lastName: "", firstName: "", middleName: "" };
    const parts = fullName
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length === 0) {
      return { lastName: "", firstName: "", middleName: "" };
    }
    if (parts.length === 1) {
      return { lastName: parts[0] || "", firstName: "", middleName: "" };
    }

    const [last, firstMiddle] = parts;
    const firstMiddleParts = (firstMiddle || "")
      .split(" ")
      .map((part) => part.trim())
      .filter(Boolean);

    return {
      lastName: last || "",
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
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length === 0) return { barangay: "", municipality: "" };
    if (parts.length === 1)
      return { barangay: parts[0] || "", municipality: "" };

    return { barangay: parts[0] || "", municipality: parts[1] || "" };
  };

  const normalizeText = (value: string) => value.trim().toLowerCase();

  const resolveBarangayForEdit = (
    addressBarangay: string,
    farmLocation: string,
  ): string => {
    const matchBarangay = (candidate: string): string => {
      if (!candidate) return "";
      const normalizedCandidate = normalizeText(candidate);
      const exact = barangays.find(
        (barangay) => normalizeText(barangay) === normalizedCandidate,
      );
      return exact || "";
    };

    const fromAddress = matchBarangay(addressBarangay);
    if (fromAddress) return fromAddress;

    const parsedFarmLocation = parseAddress(farmLocation || "");
    const fromFarmLocation = matchBarangay(
      parsedFarmLocation.barangay || farmLocation,
    );
    if (fromFarmLocation) return fromFarmLocation;

    return "";
  };

  const extractParcelAreaNumber = (
    value: number | string | null | undefined,
  ): string => {
    if (value === null || value === undefined) return "";

    const textValue = String(value).trim();
    if (!textValue) return "";

    const numericTokens = textValue.match(/-?\d+(?:\.\d+)?/g);
    if (!numericTokens || numericTokens.length === 0) return "";

    const total = numericTokens.reduce((sum, token) => {
      const parsed = Number(token);
      return sum + (Number.isFinite(parsed) ? parsed : 0);
    }, 0);

    if (!Number.isFinite(total) || total <= 0) return "";
    return String(total);
  };

  const handleCancelEdit = () => {
    setEditingRecord(null);
    setEditFormData({});
    setEditError(null);
    setEditingParcels([]);
    setOriginalParcels([]);
    setParcelErrors({});
  };

  const handleInputChange = (field: keyof EditFormData, value: string) => {
    setEditError(null);
    setEditFormData((previous) => ({
      ...previous,
      [field]: value,
    }));
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
        setParcelErrors((previous) => ({
          ...previous,
          [parcelId]: "Parcel area is required",
        }));
        setEditingParcels((previous) =>
          previous.map((parcel) =>
            parcel.id === parcelId ? { ...parcel, [field]: 0 } : parcel,
          ),
        );
        return;
      }

      const numValue = parseFloat(valueStr);
      if (Number.isNaN(numValue)) {
        setParcelErrors((previous) => ({
          ...previous,
          [parcelId]: "Parcel area must be a valid number",
        }));
        return;
      }

      if (numValue <= 0) {
        setParcelErrors((previous) => ({
          ...previous,
          [parcelId]: "Parcel area must be greater than 0",
        }));
        setEditingParcels((previous) =>
          previous.map((parcel) =>
            parcel.id === parcelId ? { ...parcel, [field]: numValue } : parcel,
          ),
        );
        return;
      }

      setParcelErrors((previous) => {
        if (!previous[parcelId]) return previous;
        const { [parcelId]: _removed, ...rest } = previous;
        return rest;
      });
      setEditingParcels((previous) =>
        previous.map((parcel) =>
          parcel.id === parcelId ? { ...parcel, [field]: numValue } : parcel,
        ),
      );
      return;
    }

    setEditingParcels((previous) =>
      previous.map((parcel) =>
        parcel.id === parcelId ? { ...parcel, [field]: value } : parcel,
      ),
    );
  };

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return "—";
    return parsed.toLocaleDateString();
  };

  const formatDateTime = (iso?: string) => {
    if (!iso) return "—";
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return "—";
    return parsed.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatParcelArea = (value: number | string | null | undefined) => {
    const parsed =
      typeof value === "number" ? value : parseFloat(String(value ?? ""));
    if (!Number.isFinite(parsed) || parsed <= 0) return "N/A";
    return `${parsed.toFixed(2)} ha`;
  };

  const formatAreaSummary = (value: number) => {
    if (!Number.isFinite(value) || value < 0) return "0.00 ha";
    return `${value.toFixed(2)} ha`;
  };

  const formatRecordStatus = (status?: string | null) => {
    const normalized = String(status || "")
      .toLowerCase()
      .trim();
    if (!normalized) return "Not Submitted";
    if (normalized === "no parcels") return "No Parcels";

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

    if (activeStatuses.has(normalized)) return "Active Farmer";
    if (inactiveStatuses.has(normalized)) return "Inactive Farmer";
    return status || "Not Submitted";
  };

  const getStatusPillClass = (status?: string | null) => {
    const normalized = String(status || "")
      .toLowerCase()
      .trim();
    if (!normalized) return "jo-rsbsa-status-inactive";
    if (normalized === "no parcels") return "jo-rsbsa-status-no-parcels";
    if (isActiveFarmerStatus(normalized)) return "jo-rsbsa-status-active";
    return "jo-rsbsa-status-inactive";
  };

  function getBarangayFromAddress(address?: string | null) {
    const barangay = String(address || "")
      .split(",")[0]
      ?.trim();
    return barangay || "N/A";
  }

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
      return "jo-rsbsa-ownership-owner";
    }

    if (flags.lessee && !flags.tenant) {
      return "jo-rsbsa-ownership-lessee";
    }

    if (flags.category === "tenantLessee" || flags.tenantLessee) {
      return "jo-rsbsa-ownership-tenant";
    }

    return "jo-rsbsa-ownership-unknown";
  };

  const getParcelOwnershipLabel = (parcel: ParcelDetail) => {
    if (parcel.ownershipTypeRegisteredOwner) return "Registered Owner";

    if (parcel.ownershipTypeTenant || parcel.ownershipTypeLessee) {
      const ownerName =
        String(parcel.tenantLandOwnerName || "").trim() ||
        String(parcel.lesseeLandOwnerName || "").trim();
      const roleLabel =
        parcel.ownershipTypeTenant && parcel.ownershipTypeLessee
          ? "Tenant + Lessee"
          : parcel.ownershipTypeTenant
            ? "Tenant"
            : "Lessee";

      return ownerName ? `${roleLabel} (Owner: ${ownerName})` : roleLabel;
    }

    return "—";
  };

  const handleEditFromRsbsa = async (recordId: string) => {
    const recordToEdit = registeredOwners.find(
      (record) => record.id === recordId,
    );
    if (!recordToEdit) {
      alert("Unable to find the selected land owner.");
      return;
    }

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
      if (fromAddress && normalizeText(fromAddress) !== "iloilo") {
        return fromAddress;
      }
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
      parcelArea: extractParcelAreaNumber(recordToEdit.totalFarmArea),
    });

    setLoadingParcels(true);
    setParcelErrors({});
    try {
      const response = await getFarmParcels(recordId);
      if (response.error) {
        setEditingParcels([]);
        setEditError("Failed to load parcel rows for editing.");
      } else {
        setEditingParcels(response.data || []);
        setOriginalParcels(response.data || []);
      }
    } catch (error) {
      console.error("Error fetching parcels for edit:", error);
      setEditingParcels([]);
      setEditError("Failed to load parcel rows for editing.");
    } finally {
      setLoadingParcels(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;

    try {
      setEditError(null);

      if (editingParcels.length > 0) {
        let hasErrors = false;
        const newErrors: Record<string, string> = {};

        editingParcels.forEach((parcel) => {
          if (!parcel.total_farm_area_ha || parcel.total_farm_area_ha <= 0) {
            hasErrors = true;
            newErrors[parcel.id] =
              "Parcel area must be a valid positive number";
          }
        });

        if (hasErrors) {
          setParcelErrors(newErrors);
          setEditError("Please fix all parcel area errors before saving.");
          return;
        }
      }

      const rawAgeInput = (editFormData.age ?? "").trim();
      const normalizedAge = parseAgeInputToNumber(rawAgeInput);
      if (
        rawAgeInput !== "" &&
        (normalizedAge === null || normalizedAge < 18)
      ) {
        setEditError("Age must be a valid number and at least 18 years old.");
        return;
      }

      const composedFarmerName = (() => {
        const last = (editFormData.lastName ?? "").trim();
        const first = (editFormData.firstName ?? "").trim();
        const middle = (editFormData.middleName ?? "").trim();
        const firstMiddle = [first, middle].filter(Boolean).join(" ");

        const parts: string[] = [];
        if (last) parts.push(last);
        if (firstMiddle) parts.push(firstMiddle);

        return parts.length > 0
          ? parts.join(", ")
          : (editFormData.farmerName ?? editingRecord.farmerName);
      })();

      const composedAddress = (() => {
        const barangay = (editFormData.barangay ?? "").trim();
        const municipality = (editFormData.municipality ?? "").trim();
        if (barangay && municipality) return `${barangay}, ${municipality}`;
        if (barangay) return barangay;
        if (municipality) return municipality;
        return editFormData.farmerAddress ?? editingRecord.farmerAddress;
      })();

      const newParcelAreaString =
        editingParcels.length > 0
          ? editingParcels.map((parcel) => parcel.total_farm_area_ha).join(", ")
          : (editFormData.parcelArea ??
            String(editingRecord.totalFarmArea || ""));

      const updatePayload: Record<string, any> = {
        farmerName: composedFarmerName,
        farmerAddress: composedAddress,
        parcelArea: newParcelAreaString,
        firstName: editFormData.firstName,
        middleName: editFormData.middleName,
        surname: editFormData.lastName,
        addressBarangay: editFormData.barangay,
        addressMunicipality: editFormData.municipality,
      };

      if (rawAgeInput !== "" || editingRecord.age !== undefined) {
        updatePayload.age = normalizedAge;
      }

      const cleanedData = Object.entries(updatePayload).reduce(
        (acc, [key, value]) => {
          if (value !== undefined && value !== "") {
            acc[key] = value;
          }
          return acc;
        },
        {} as Record<string, any>,
      );

      if (Object.keys(cleanedData).length > 0) {
        const response = await updateRsbsaSubmission(
          editingRecord.id,
          cleanedData,
        );
        if (response.error) {
          throw new Error(response.error);
        }
      }

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
              is_cultivating: parcel.is_cultivating ?? null,
              cultivation_status_reason:
                parcel.is_cultivating === false
                  ? (parcel.cultivation_status_reason ?? null)
                  : null,
              cultivation_status_updated_at: new Date().toISOString(),
            });

            if (parcelResponse.error) {
              console.error(`Failed to update parcel ${parcel.id}`);
            }
          } catch (error) {
            console.error(`Error updating parcel ${parcel.id}:`, error);
          }
        }
      }

      await fetchRSBSARecords();
      handleCancelEdit();
      try {
        const user = await getCurrentUserForAudit();
        await getAuditLogger().logCRUD(
          { ...user, id: undefined },
          "UPDATE",
          AuditModule.RSBSA,
          "rsbsa_submission",
          editingRecord.id,
          `Updated land owner information for ${composedFarmerName}`,
          {
            farmerName: editingRecord.farmerName,
            farmerAddress: editingRecord.farmerAddress,
            age: editingRecord.age,
            parcels: originalParcels.map((p) => ({
              id: p.id,
              parcelNumber: p.parcel_number,
              totalFarmAreaHa: p.total_farm_area_ha,
              farmLocationBarangay: p.farm_location_barangay,
              isCultivating: p.is_cultivating ?? null,
              cultivationStatusReason: p.cultivation_status_reason ?? null,
            })),
          },
          {
            farmerName: composedFarmerName,
            farmerAddress: composedAddress,
            age: normalizedAge,
            parcels: editingParcels.map((p) => ({
              id: p.id,
              parcelNumber: p.parcel_number,
              totalFarmAreaHa: p.total_farm_area_ha,
              farmLocationBarangay: p.farm_location_barangay,
              isCultivating: p.is_cultivating ?? null,
              cultivationStatusReason: p.cultivation_status_reason ?? null,
            })),
          },
        );
      } catch (auditErr) {
        console.error("Audit log failed (non-blocking):", auditErr);
      }
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
      alert(result.error || "Failed to print the RSBSA form.");
    }
  };

  return (
    <div className="jo-rsbsa-page-container">
      <div className="jo-rsbsa-page">
        {/* Sidebar */}
        <JOSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        {/* Main content starts here */}
        <div className="jo-rsbsa-main-content">
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
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <div className="tech-incent-mobile-title">JO RSBSA</div>
          </div>
          <h2 className="jo-rsbsa-page-title">RSBSA</h2>
          <p className="jo-rsbsa-page-subtitle">
            View and manage farmers from RSBSA submissions
          </p>

          {!loading && !error && (
            <div className="jo-rsbsa-status-cards">
              <div className="jo-rsbsa-status-card jo-rsbsa-card-total">
                <div className="jo-rsbsa-card-icon">
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
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                </div>
                <div className="jo-rsbsa-card-info">
                  <span className="jo-rsbsa-card-count">
                    {statusCounts.total}
                  </span>
                  <span className="jo-rsbsa-card-label">TOTAL FARMERS</span>
                </div>
              </div>
              <div className="jo-rsbsa-status-card jo-rsbsa-card-today">
                <div className="jo-rsbsa-card-icon">
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
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <div className="jo-rsbsa-card-info">
                  <span className="jo-rsbsa-card-count">
                    {registrationStats.today}
                  </span>
                  <span className="jo-rsbsa-card-label">TODAY</span>
                </div>
              </div>
              <div className="jo-rsbsa-status-card jo-rsbsa-card-week">
                <div className="jo-rsbsa-card-icon">
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
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                    <path d="M7 14h10" />
                    <path d="M7 18h6" />
                  </svg>
                </div>
                <div className="jo-rsbsa-card-info">
                  <span className="jo-rsbsa-card-count">
                    {registrationStats.week}
                  </span>
                  <span className="jo-rsbsa-card-label">THIS WEEK</span>
                </div>
              </div>
              <div className="jo-rsbsa-status-card jo-rsbsa-card-active">
                <div className="jo-rsbsa-card-icon">
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
                    <polyline points="9 11 12 14 22 4"></polyline>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                  </svg>
                </div>
                <div className="jo-rsbsa-card-info">
                  <span className="jo-rsbsa-card-count">
                    {statusCounts.active}
                  </span>
                  <span className="jo-rsbsa-card-label">ACTIVE FARMERS</span>
                </div>
              </div>
              <div className="jo-rsbsa-status-card jo-rsbsa-card-inactive">
                <div className="jo-rsbsa-card-icon">
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
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </div>
                <div className="jo-rsbsa-card-info">
                  <span className="jo-rsbsa-card-count">
                    {statusCounts.inactive}
                  </span>
                  <span className="jo-rsbsa-card-label">INACTIVE FARMERS</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Tab Navigation ── */}
          <div className="jo-rsbsa-tab-nav">
            <button
              className={`jo-rsbsa-tab-btn${activeTab === "registry" ? " jo-rsbsa-tab-btn-active" : ""}`}
              onClick={() => setActiveTab("registry")}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              Registry
            </button>
            <button
              className={`jo-rsbsa-tab-btn${activeTab === "analytics" ? " jo-rsbsa-tab-btn-active" : ""}`}
              onClick={() => setActiveTab("analytics")}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              Analytics
            </button>
          </div>

          <div className="jo-rsbsa-content-card">
            {/* ══ ANALYTICS TAB ══ */}
            {activeTab === "analytics" && (
              <>
                <div className="jo-rsbsa-latest-section">
                  <div className="jo-rsbsa-latest-header">
                    <div>
                      <h3 className="jo-rsbsa-latest-title">
                        Latest Registrants
                      </h3>
                      <p className="jo-rsbsa-latest-subtitle">
                        Most recent RSBSA submissions
                      </p>
                    </div>
                    <span className="jo-rsbsa-latest-meta">
                      {!loading && !error
                        ? `Showing ${latestRegistrants.length} of ${registeredOwners.length}`
                        : "Latest submissions"}
                    </span>
                  </div>
                  {loading ? (
                    <div className="jo-rsbsa-no-data">
                      Loading latest registrants...
                    </div>
                  ) : error ? (
                    <div className="jo-rsbsa-no-data">
                      Unable to load latest registrants.
                    </div>
                  ) : (
                    <div className="jo-rsbsa-table-container jo-rsbsa-latest-table-container">
                      <table className="jo-rsbsa-owners-table jo-rsbsa-latest-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Barangay</th>
                            <th>Date/Time</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {latestRegistrants.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="jo-rsbsa-no-data">
                                No recent registrants found
                              </td>
                            </tr>
                          ) : (
                            latestRegistrants.map((record) => (
                              <tr
                                key={record.id}
                                className="jo-rsbsa-clickable-row jo-rsbsa-table-row"
                                onClick={() =>
                                  fetchFarmerDetails(record.id, record)
                                }
                              >
                                <td>
                                  <div className="jo-rsbsa-farmer-cell">
                                    <div className="jo-rsbsa-farmer-avatar">
                                      {getFarmerInitials(record.farmerName)}
                                    </div>
                                    <div className="jo-rsbsa-farmer-meta">
                                      <span className="jo-rsbsa-farmer-name">
                                        {record.farmerName || "N/A"}
                                      </span>
                                      <span className="jo-rsbsa-farmer-ref">
                                        Ref: {record.referenceNumber || "N/A"}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  {getBarangayFromAddress(record.farmerAddress)}
                                </td>
                                <td>
                                  <span className="jo-rsbsa-date">
                                    {formatDateTime(record.dateSubmitted)}
                                  </span>
                                </td>
                                <td>
                                  <span
                                    className={`jo-rsbsa-status-pill ${getStatusPillClass(record.status)}`}
                                  >
                                    {formatRecordStatus(record.status)}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="jo-rsbsa-leaderboard-section">
                  <div className="jo-rsbsa-latest-header">
                    <div>
                      <h3 className="jo-rsbsa-latest-title">Top Barangays</h3>
                      <p className="jo-rsbsa-latest-subtitle">
                        Highest number of registrations
                      </p>
                    </div>
                    <span className="jo-rsbsa-latest-meta">
                      {!loading && !error
                        ? `Top ${topBarangays.length} barangays`
                        : "Barangay rankings"}
                    </span>
                  </div>
                  {loading ? (
                    <div className="jo-rsbsa-no-data">
                      Loading barangay stats...
                    </div>
                  ) : error ? (
                    <div className="jo-rsbsa-no-data">
                      Unable to load barangay stats.
                    </div>
                  ) : (
                    <div className="jo-rsbsa-table-container jo-rsbsa-leaderboard-table-container">
                      <table className="jo-rsbsa-owners-table jo-rsbsa-leaderboard-table">
                        <thead>
                          <tr>
                            <th>Rank</th>
                            <th>Barangay</th>
                            <th>Registrations</th>
                            <th>Share</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topBarangays.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="jo-rsbsa-no-data">
                                No barangay data available
                              </td>
                            </tr>
                          ) : (
                            topBarangays.map((item, index) => (
                              <tr
                                key={item.barangay}
                                className="jo-rsbsa-table-row"
                              >
                                <td>
                                  <span className="jo-rsbsa-leaderboard-rank">
                                    #{index + 1}
                                  </span>
                                </td>
                                <td>{item.barangay}</td>
                                <td>
                                  <span className="jo-rsbsa-leaderboard-count">
                                    {item.count}
                                  </span>
                                </td>
                                <td>
                                  <span className="jo-rsbsa-leaderboard-share">
                                    {item.share.toFixed(1)}%
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="jo-rsbsa-summary-section">
                  <div className="jo-rsbsa-latest-header">
                    <div>
                      <h3 className="jo-rsbsa-latest-title">
                        Land Parcel Summary
                      </h3>
                      <p className="jo-rsbsa-latest-subtitle">
                        Total area, crop types, and tenure overview
                      </p>
                    </div>
                    <span className="jo-rsbsa-latest-meta">
                      {!loading && !error
                        ? `Based on ${registeredOwners.length} registered owners`
                        : "Land parcel overview"}
                    </span>
                  </div>
                  {loading ? (
                    <div className="jo-rsbsa-no-data">
                      Loading land parcel summary...
                    </div>
                  ) : error ? (
                    <div className="jo-rsbsa-no-data">
                      Unable to load land parcel summary.
                    </div>
                  ) : (
                    <div className="jo-rsbsa-summary-body">
                      <div className="jo-rsbsa-summary-grid">
                        <div className="jo-rsbsa-summary-card">
                          <span className="jo-rsbsa-summary-label">
                            Total Area
                          </span>
                          <span className="jo-rsbsa-summary-value">
                            {formatAreaSummary(landParcelSummary.totalArea)}
                          </span>
                        </div>
                        <div className="jo-rsbsa-summary-card">
                          <span className="jo-rsbsa-summary-label">
                            Total Parcels
                          </span>
                          <span className="jo-rsbsa-summary-value">
                            {landParcelSummary.totalParcels}
                          </span>
                        </div>
                      </div>
                      <div className="jo-rsbsa-summary-details">
                        <div className="jo-rsbsa-summary-block">
                          <h4>Crop Types</h4>
                          {landParcelSummary.cropBreakdown.length === 0 ? (
                            <span className="jo-rsbsa-summary-empty">
                              No crop data available
                            </span>
                          ) : (
                            <div className="jo-rsbsa-summary-chips">
                              {landParcelSummary.cropBreakdown.map((item) => (
                                <span
                                  key={item.label}
                                  className="jo-rsbsa-summary-chip"
                                >
                                  <span className="jo-rsbsa-summary-chip-label">
                                    {item.label}
                                  </span>
                                  <span className="jo-rsbsa-summary-chip-count">
                                    {item.count}
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="jo-rsbsa-summary-block">
                          <h4>Tenure</h4>
                          {landParcelSummary.tenureBreakdown.length === 0 ? (
                            <span className="jo-rsbsa-summary-empty">
                              No tenure data available
                            </span>
                          ) : (
                            <div className="jo-rsbsa-summary-chips">
                              {landParcelSummary.tenureBreakdown.map((item) => (
                                <span
                                  key={item.label}
                                  className="jo-rsbsa-summary-chip"
                                >
                                  <span className="jo-rsbsa-summary-chip-label">
                                    {item.label}
                                  </span>
                                  <span className="jo-rsbsa-summary-chip-count">
                                    {item.count}
                                    <span className="jo-rsbsa-summary-chip-share">
                                      {item.share.toFixed(1)}%
                                    </span>
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ══ REGISTRY TAB ══ */}
            {activeTab === "registry" && (
              <>
                <div className="jo-rsbsa-actions-bar">
                  <div className="jo-rsbsa-actions-left">
                    <div className="jo-rsbsa-search-container">
                      <input
                        type="text"
                        placeholder="Search by FFRS ID, name, address, gender..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="jo-rsbsa-search-input"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          className="jo-rsbsa-clear-search-button"
                          title="Clear search"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <div className="jo-rsbsa-filter-container">
                      <select
                        value={selectedBarangay}
                        onChange={(e) => setSelectedBarangay(e.target.value)}
                        className="jo-rsbsa-filter-select"
                      >
                        <option value="all">All Barangays</option>
                        {uniqueBarangays.map((barangay) => (
                          <option key={barangay} value={barangay}>
                            {barangay}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="jo-rsbsa-actions-right">
                    {/* <button
                  className="jo-rsbsa-register-button"
                  onClick={() => navigate("/jo-rsbsa-farmer")}
                >
                  Register Farmer
                </button> */}
                    <button
                      className="jo-rsbsa-register-button"
                      onClick={() => navigate("/jo-rsbsa-landowner")}
                    >
                      Register Land Owner
                    </button>
                    <button
                      className="jo-rsbsa-register-button"
                      onClick={() => navigate("/jo-rsbsa")}
                    >
                      Register Farmer
                    </button>
                  </div>
                </div>
                {loading ? (
                  <div className="jo-rsbsa-loading-container">
                    <p>Loading registered land owners...</p>
                  </div>
                ) : error ? (
                  <div className="jo-rsbsa-error-container">
                    <p>Error: {error}</p>
                    <button
                      onClick={fetchRSBSARecords}
                      className="jo-rsbsa-retry-button"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <div className="jo-rsbsa-table-container">
                    {searchQuery && (
                      <div className="jo-rsbsa-search-results-info">
                        <p>
                          Found <strong>{filteredOwners.length}</strong> result
                          {filteredOwners.length !== 1 ? "s" : ""}
                          {filteredOwners.length < registeredOwners.length &&
                            ` out of ${registeredOwners.length} total registered owners`}
                        </p>
                      </div>
                    )}
                    <table className="jo-rsbsa-owners-table">
                      <thead>
                        <tr>
                          <th>
                            <button
                              className={`jo-rsbsa-sort-btn ${
                                sortConfig.key === "farmer" ? "is-active" : ""
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSortChange("farmer");
                              }}
                            >
                              Farmer <span>{getSortIndicator("farmer")}</span>
                            </button>
                          </th>
                          <th>
                            <button
                              className={`jo-rsbsa-sort-btn ${
                                sortConfig.key === "parcelArea"
                                  ? "is-active"
                                  : ""
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSortChange("parcelArea");
                              }}
                            >
                              Parcels{" "}
                              <span>{getSortIndicator("parcelArea")}</span>
                            </button>
                          </th>

                          <th>Ownership Status</th>
                          <th>Status</th>
                          <th>
                            <button
                              className={`jo-rsbsa-sort-btn ${
                                sortConfig.key === "dateSubmitted"
                                  ? "is-active"
                                  : ""
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
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOwners.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="jo-rsbsa-no-data">
                              {searchQuery
                                ? "No results found for your search"
                                : "No registered owners found"}
                            </td>
                          </tr>
                        ) : (
                          filteredOwners.map((record) => {
                            return (
                              <tr
                                key={record.id}
                                className="jo-rsbsa-clickable-row jo-rsbsa-table-row"
                                onClick={() =>
                                  fetchFarmerDetails(record.id, record)
                                }
                              >
                                <td>
                                  <div className="jo-rsbsa-farmer-cell">
                                    <div className="jo-rsbsa-farmer-avatar">
                                      {getFarmerInitials(record.farmerName)}
                                    </div>
                                    <div className="jo-rsbsa-farmer-meta">
                                      <span className="jo-rsbsa-farmer-name">
                                        {record.farmerName || "N/A"}
                                      </span>
                                      <span className="jo-rsbsa-farmer-ref">
                                        Ref: {record.referenceNumber || "N/A"}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <div className="jo-rsbsa-parcel-cell">
                                    <span className="jo-rsbsa-parcel-count">
                                      {record.parcelCount || 0} parcel
                                      {record.parcelCount === 1 ? "" : "s"}
                                    </span>
                                    <span className="jo-rsbsa-parcel-area">
                                      {formatParcelArea(record.totalFarmArea)}
                                    </span>
                                  </div>
                                </td>

                                <td>
                                  <span
                                    className={`jo-rsbsa-ownership-pill ${getOwnershipClass(record)}`}
                                  >
                                    {getOwnershipLabel(record)}
                                  </span>
                                </td>
                                <td>
                                  <span className="jo-rsbsa-record-status">
                                    {formatRecordStatus(record.status)}
                                  </span>
                                </td>
                                <td>
                                  <span className="jo-rsbsa-date">
                                    {formatDate(record.dateSubmitted)}
                                  </span>
                                </td>
                                <td
                                  className="jo-rsbsa-actions-cell"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="jo-rsbsa-actions-wrap">
                                    <button
                                      className="jo-rsbsa-action-btn"
                                      onClick={() =>
                                        fetchFarmerDetails(record.id, record)
                                      }
                                    >
                                      View
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {updateNotification.show && (
          <div
            className={`jo-rsbsa-update-toast ${updateNotification.type}`}
            role="status"
            aria-live="polite"
          >
            <span className="jo-rsbsa-update-toast-message">
              {updateNotification.message}
            </span>
            <button
              className="jo-rsbsa-update-toast-close"
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
          <div
            className="jo-rsbsa-edit-modal-overlay"
            onClick={handleCancelEdit}
          >
            <div
              className="jo-rsbsa-edit-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="jo-rsbsa-edit-modal-header">
                <div className="jo-rsbsa-edit-modal-title">
                  <h2>Edit Land Owner Information</h2>
                  <p>Update farmer details.</p>
                </div>
                <button
                  className="jo-rsbsa-close-button"
                  onClick={handleCancelEdit}
                >
                  ×
                </button>
              </div>

              <div className="jo-rsbsa-edit-modal-body">
                {editError && (
                  <div className="jo-rsbsa-edit-error-banner" role="alert">
                    {editError}
                  </div>
                )}
                <div className="jo-rsbsa-form-grid">
                  <div className="jo-rsbsa-form-group">
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

                  <div className="jo-rsbsa-form-group">
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

                  <div className="jo-rsbsa-form-group">
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

                  <div className="jo-rsbsa-form-group">
                    <label>Age:</label>
                    <input
                      type="text"
                      value={editFormData.age || ""}
                      onChange={(e) => handleInputChange("age", e.target.value)}
                      placeholder="Age"
                    />
                  </div>

                  <div className="jo-rsbsa-form-group">
                    <label>Barangay:</label>
                    <select
                      value={editFormData.barangay || ""}
                      onChange={(e) =>
                        handleInputChange("barangay", e.target.value)
                      }
                      className="jo-rsbsa-form-select"
                    >
                      <option value="">Select Barangay</option>
                      {barangays.map((barangay) => (
                        <option key={barangay} value={barangay}>
                          {barangay}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="jo-rsbsa-form-group">
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

                <div className="jo-rsbsa-parcel-section">
                  <h4>Parcel Areas</h4>
                  {loadingParcels ? (
                    <p>Loading parcels...</p>
                  ) : editingParcels.length > 0 ? (
                    editingParcels.map((parcel, index) => (
                      <div
                        key={parcel.id}
                        className={`jo-rsbsa-parcel-item ${parcelErrors[parcel.id] ? "error" : ""}`}
                      >
                        <div className="jo-rsbsa-form-group">
                          <label className="jo-rsbsa-parcel-label">
                            Parcel Area {index + 1} (Parcel No.{" "}
                            {parcel.parcel_number})
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
                            className="jo-rsbsa-parcel-input"
                            data-error={
                              parcelErrors[parcel.id] ? "true" : "false"
                            }
                          />
                          {parcelErrors[parcel.id] && (
                            <small className="jo-rsbsa-parcel-error">
                              {parcelErrors[parcel.id]}
                            </small>
                          )}
                          <small className="jo-rsbsa-parcel-location">
                            Location: {parcel.farm_location_barangay || "N/A"}
                          </small>
                        </div>
                        <div className="jo-rsbsa-form-group">
                          <label>Currently farming?</label>
                          <select
                            value={
                              parcel.is_cultivating === true
                                ? "true"
                                : parcel.is_cultivating === false
                                  ? "false"
                                  : ""
                            }
                            onChange={(e) => {
                              const nextValue = e.target.value;
                              const normalizedValue =
                                nextValue === "true"
                                  ? true
                                  : nextValue === "false"
                                    ? false
                                    : null;
                              handleIndividualParcelChange(
                                parcel.id,
                                "is_cultivating",
                                normalizedValue,
                              );
                              if (normalizedValue !== false) {
                                handleIndividualParcelChange(
                                  parcel.id,
                                  "cultivation_status_reason",
                                  null,
                                );
                              }
                            }}
                          >
                            <option value="">Not specified</option>
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                          </select>
                        </div>
                        {parcel.is_cultivating === false && (
                          <div className="jo-rsbsa-form-group">
                            <label>Reason</label>
                            <input
                              type="text"
                              value={parcel.cultivation_status_reason || ""}
                              onChange={(e) =>
                                handleIndividualParcelChange(
                                  parcel.id,
                                  "cultivation_status_reason",
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
                    <p className="jo-rsbsa-parcel-empty-text">
                      No parcels found for this farmer.
                    </p>
                  )}
                </div>
              </div>

              <div className="jo-rsbsa-edit-modal-footer">
                <button
                  className="jo-rsbsa-cancel-button"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </button>
                <button
                  className="jo-rsbsa-save-button"
                  onClick={handleSaveEdit}
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
                    {/* No Parcels warning banner */}
                    {(() => {
                      const matchedRecord = registeredOwners.find(
                        (r) => r.id === selectedFarmer.id,
                      );
                      const farmerStatus = (
                        (matchedRecord as any)?.status || ""
                      )
                        .toLowerCase()
                        .trim();
                      if (farmerStatus === "no parcels") {
                        return (
                          <div className="jo-rsbsa-no-parcels-warning">
                            ⚠️ This farmer has transferred all land. New parcel
                            entries require admin review.
                          </div>
                        );
                      }
                      return null;
                    })()}

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
                          {selectedFarmer.parcels.map((parcel, index) => {
                            // Check if parcelNumber is a valid simple number (not FFRS code or N/A)
                            const isValidParcelNumber =
                              parcel.parcelNumber &&
                              parcel.parcelNumber !== "N/A" &&
                              !parcel.parcelNumber.includes("-") && // Exclude FFRS codes
                              /^\d+$/.test(parcel.parcelNumber); // Only accept pure numbers

                            const displayParcelNumber = isValidParcelNumber
                              ? parcel.parcelNumber
                              : index + 1;

                            return (
                              <div
                                key={parcel.id}
                                className="farmer-modal-parcel-card"
                              >
                                <div className="farmer-modal-parcel-header">
                                  <h4>Parcel #{displayParcelNumber}</h4>
                                </div>
                                <div className="farmer-modal-parcel-details">
                                  <div className="farmer-modal-parcel-item">
                                    <span className="farmer-modal-label">
                                      Land Ownership:
                                    </span>
                                    <span className="farmer-modal-value">
                                      {getParcelOwnershipLabel(parcel)}
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
                                      {typeof parcel.totalFarmAreaHa ===
                                      "number"
                                        ? parcel.totalFarmAreaHa.toFixed(2)
                                        : parseFloat(
                                            String(parcel.totalFarmAreaHa || 0),
                                          ).toFixed(2)}{" "}
                                      hectares
                                    </span>
                                  </div>
                                  <div className="farmer-modal-parcel-item">
                                    <span className="farmer-modal-label">
                                      Cultivation Status:
                                    </span>
                                    <span className="farmer-modal-value">
                                      {parcel.isCultivating === true
                                        ? "Farming"
                                        : parcel.isCultivating === false
                                          ? "Not farming"
                                          : "Not specified"}
                                      {parcel.isCultivating === false &&
                                        parcel.cultivationStatusReason && (
                                          <span className="farmer-modal-owner-name">
                                            {" "}
                                            ({parcel.cultivationStatusReason})
                                          </span>
                                        )}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
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

export default JoRsbsaPage;
