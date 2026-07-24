import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  getRsbsaSubmissions,
  getRsbsaSubmissionById,
  getFarmParcels,
  updateRsbsaSubmission,
  updateFarmParcel, // ✅ add this
} from "../../api";
import { printRsbsaFormById, printRsbsaFormsByIds } from "../../utils/rsbsaPrint";
import "../../assets/css/jo css/JoMasterlistStyle.css";
import "../../assets/css/technician css/TechMasterlistStyle.css";
import "../../assets/css/jo css/FarmerDetailModal.css";
import "../../components/layout/sidebarStyle.css";
import { supabase } from "../../supabase";
import TechSidebar from "../../components/layout/TechSidebar";
import { addPendingAction } from "../../services/offlineDb";
import { useOfflineStatus } from "../../hooks/useOfflineStatus";
import OfflineStatusBanner from "../../components/common/OfflineStatusBanner";

interface RSBSARecord {
  id: string;
  referenceNumber: string;
  farmerName: string;
  farmerAddress: string;
  farmLocation: string;
  parcelArea: string;
  dateSubmitted: string;
  status: string;
  landParcel: string;
  cultivationStatus?: string;
  statusChangeReason?: string | null;
  // Simple per-record data quality based on key fields present in masterlist
  completeness: number;
  ownershipType?: {
    registeredOwner: boolean;
    tenant: boolean;
    lessee: boolean;
    tenantLessee?: boolean;
    category?: "registeredOwner" | "tenantLessee" | "unknown";
  };
}

interface FarmerDetail {
  id: string;
  farmerName: string;
  referenceNumber: string;
  dateSubmitted: string;
  recordStatus: string;
  farmerAddress: string;
  age: number | string;
  gender: string;
  mainLivelihood: string;
  farmingActivities: string[];
  parcels: ParcelDetail[];
  statusChangeReason?: string | null;
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

// Type declaration for Electron API exposed via preload
declare global {
  interface Window {
    electron?: {
      platform: string;
      print: (options?: any) => Promise<{ success: boolean; error?: string }>;
      printToPDF: (
        options?: any,
      ) => Promise<{ success: boolean; data?: string; error?: string }>;
      printContent: (
        htmlContent: string,
        options?: any,
      ) => Promise<{ success: boolean; error?: string }>;
    };
  }
}

const TechMasterlist: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rsbsaRecords, setRsbsaRecords] = useState<RSBSARecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [landSizeFilter, setLandSizeFilter] = useState<string>("");

  const getLandAreaRange = (
    filterStr: string,
  ): { min: number | null; max: number | null } => {
    const s = filterStr.trim();
    if (!s) return { min: null, max: null };

    if (s.includes("-") || s.toLowerCase().includes("to")) {
      const parts = s.split(/[-]|to/i).map((p) => p.trim());
      const minVal = parseFloat(parts[0]);
      const maxVal = parseFloat(parts[1]);
      return {
        min: !isNaN(minVal) ? minVal : null,
        max: !isNaN(maxVal) ? maxVal : null,
      };
    }

    if (s.startsWith("<")) {
      const num = parseFloat(s.replace(/^<=?/, "").trim());
      return { min: 0, max: !isNaN(num) ? num : null };
    }

    if (s.startsWith(">")) {
      const num = parseFloat(s.replace(/^>=?/, "").trim());
      return { min: !isNaN(num) ? num : null, max: null };
    }

    const n = parseFloat(s);
    if (!isNaN(n)) {
      if (n <= 1) {
        return { min: 0, max: n };
      }
      return { min: n - 1, max: n };
    }

    return { min: null, max: null };
  };

  const parseArea = (v: string): number => {
    const tokens = String(v || "").match(/-?\d+(?:\.\d+)?/g);
    if (!tokens) return 0;
    return tokens.reduce((s, t) => {
      const n = Number(t);
      return s + (Number.isFinite(n) && n > 0 ? n : 0);
    }, 0);
  };
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printFilter, setPrintFilter] = useState({
    type: "all", // 'all', 'lastname', 'barangay', 'date'
    value: "",
  });
  const [selectedFarmer, setSelectedFarmer] = useState<FarmerDetail | null>(
    null,
  );
  const [loadingFarmerDetail, setLoadingFarmerDetail] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isModalPrinting, setIsModalPrinting] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [showBulkExportMenu, setShowBulkExportMenu] = useState(false);
  const [showPrintMasterlistModal, setShowPrintMasterlistModal] = useState(false);
  const [isBulkPrinting, setIsBulkPrinting] = useState(false);

  const [updateNotification, setUpdateNotification] = useState<{
    show: boolean;
    type: "success" | "error";
    message: string;
  }>({
    show: false,
    type: "success",
    message: "",
  });
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusChangeTarget, setStatusChangeTarget] = useState<{
    id: string;
    newStatus: string;
    farmerName?: string; // ✅ add this
  } | null>(null);
  const [statusModalParcels, setStatusModalParcels] = useState<ParcelDetail[]>(
    [],
  );
  const [statusModalLoading, setStatusModalLoading] = useState(false);

  const [statusChangeReason, setStatusChangeReason] = useState("");
  const [currentUser, setCurrentUser] = useState<{
    firstName: string;
    lastName: string;
  } | null>(null);

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

  useEffect(() => {
    fetchRSBSARecords();
  }, []);
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const firstName = user.user_metadata?.first_name || "";
        const lastName = user.user_metadata?.last_name || "";
        setCurrentUser({ firstName, lastName });
      }
    };
    fetchCurrentUser();
  }, []);

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
      const parcelsData = parcelsResponse.data;

      // Handle both JSONB (data property) and structured column formats
      const data = farmerData?.data || farmerData || {};

      const selectedRecord =
        summaryRecord ||
        rsbsaRecords.find((record) => String(record.id) === String(farmerId));

      const submittedDateLabel = selectedRecord?.dateSubmitted
        ? formatDate(selectedRecord.dateSubmitted)
        : "N/A";

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

      // Reformat the farmer name
      const backendFarmerName = farmerData?.farmerName || "";
      const reformattedFarmerName = (() => {
        if (!backendFarmerName || backendFarmerName === "N/A") return "N/A";
        const parts = backendFarmerName
          .split(",")
          .map((p: string) => p.trim())
          .filter(Boolean);
        if (parts.length === 0) return "N/A";
        if (parts.length === 1) return parts[0];
        return `${parts[0]}, ${parts.slice(1).join(" ")}`;
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
        // ✅ Make sure these are read correctly from DB
        isCultivating: typeof p.is_farming === "boolean" ? p.is_farming : null,
        cultivationStatusReason: p.farming_status_reason || null,
        cultivationStatusUpdatedAt: p.farming_status_updated_at || null,
        cultivatorSubmissionId: p.cultivator_submission_id || null,
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
          // Extract barangay and municipality from farmLocation (format: "Barangay, Municipality")
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
        farmerName: reformattedFarmerName,
        referenceNumber: selectedRecord?.referenceNumber || "N/A",
        dateSubmitted: submittedDateLabel,
        recordStatus: selectedRecord?.status || farmerData.status || "N/A",
        farmerAddress: farmerData.farmerAddress || "N/A",
        age: calculateAge(data.dateOfBirth || data.birthdate || "N/A"),
        gender: data.gender || "N/A",
        mainLivelihood: data.mainLivelihood || "N/A",
        farmingActivities: activities,
        parcels: mappedParcels,
        statusChangeReason:
          selectedRecord?.statusChangeReason ||
          data.statusChangeReason ||
          data.archive_reason ||
          null,
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

  const openStatusModal = async (record: RSBSARecord) => {
    setStatusChangeTarget({
      id: record.id,
      newStatus:
        record.status === "Active Farmer" ? "Not Active" : "Active Farmer",
      farmerName: record.farmerName,
    });
    setStatusChangeReason("");
    setStatusModalLoading(true);
    setShowStatusModal(true);

    // If offline, skip the parcels fetch — modal can still work for simple toggle
    if (!navigator.onLine) {
      setStatusModalParcels([]);
      setStatusModalLoading(false);
      return;
    }

    try {
      const parcelsResponse = await getFarmParcels(record.id);
      const parcelsData = parcelsResponse.data || [];

      const mapped: ParcelDetail[] = parcelsData.map((p: any) => ({
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
          typeof p.is_farming === "boolean" ? p.is_farming : null,
        cultivationStatusReason: p.farming_status_reason || null,
        cultivationStatusUpdatedAt: p.farming_status_updated_at || null,
        cultivatorSubmissionId: p.cultivator_submission_id || null,
      }));

      setStatusModalParcels(mapped);
    } catch (err) {
      showUpdateNotification("Failed to load parcels.", "error");
      setShowStatusModal(false);
    } finally {
      setStatusModalLoading(false);
    }
  };

  const fetchRSBSARecords = async () => {
    try {
      const response = await getRsbsaSubmissions();
      if (response.error) throw new Error(response.error);
      const data = response.data;

      const calculateRecordCompleteness = (record: {
        referenceNumber: string;
        farmerName: string;
        farmerAddress: string;
        farmLocation: string;
        parcelArea: string;
        dateSubmitted: string;
        status: string;
      }): number => {
        const fields = [
          record.referenceNumber,
          record.farmerName,
          record.farmerAddress,
          record.farmLocation,
          record.parcelArea,
          record.dateSubmitted,
          record.status,
        ];

        const total = fields.length;
        if (total === 0) return 0;

        const completed = fields.filter((value) => {
          const v = String(value ?? "").trim();
          return v !== "" && v !== "—";
        }).length;

        return Math.round((completed / total) * 100);
      };

      // Filter out farmers with 'No Parcels' status
      const filteredData = (Array.isArray(data) ? data : []).filter(
        (item: any) => {
          const status = String(item.status ?? "")
            .toLowerCase()
            .trim();
          return status !== "no parcels";
        },
      );

      const formattedRecords: RSBSARecord[] = filteredData.map((item: any) => {
        const farmLocation = String(item.farmLocation ?? "—");
        // Use the FFRS code from database, fallback to RSBSA-{id} if not present
        const referenceNumber = item.referenceNumber || `RSBSA-${item.id}`;
        const farmerName = String(item.farmerName || "—");
        const farmerAddress = String(item.farmerAddress ?? "—");
        const landParcel = String(item.landParcel ?? item.farmLocation ?? "—");
        const parcelArea = String(item.parcelArea ?? "—");
        const dateSubmitted = item.dateSubmitted
          ? new Date(item.dateSubmitted).toISOString()
          : "";
        const status = String(item.status ?? "Not Active");

        const baseRecord = {
          id: String(item.id),
          referenceNumber,
          farmerName,
          farmerAddress,
          farmLocation,
          parcelArea,
          dateSubmitted,
          status,
          landParcel,
          cultivationStatus: String(item.cultivationStatus || "Not specified"),
          statusChangeReason:
            item.statusChangeReason ||
            item.status_change_reason ||
            item.archive_reason ||
            null,
        };

        const completeness = calculateRecordCompleteness(baseRecord);

        return {
          ...baseRecord,
          completeness,
          ownershipType: item.ownershipType || {
            registeredOwner: false,
            tenant: false,
            lessee: false,
          },
        };
      });

      setRsbsaRecords(formattedRecords);

      setLoading(false);
    } catch (err: any) {
      setError(err.message ?? "Failed to load RSBSA records");
      setLoading(false);
    }
  };

  // Filter records by status, search, and ownership type
  const filteredRecords = rsbsaRecords.filter((record) => {
    // EXCLUDE TENANTS FROM MASTERLIST - They have their own Tenant Registry page
    const hasTenantOwnership =
      record.ownershipType?.tenant === true ||
      (record.ownershipType?.tenantLessee === true &&
        record.ownershipType?.lessee !== true);

    if (hasTenantOwnership) {
      return false; // Exclude pure tenants from masterlist
    }

    const matchesStatus =
      selectedStatus === "all" || record.status === selectedStatus;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      record.farmerName.toLowerCase().includes(q) ||
      record.referenceNumber.toLowerCase().includes(q) ||
      record.farmerAddress.toLowerCase().includes(q) ||
      record.farmLocation.toLowerCase().includes(q);

    let matchesLandSize = true;
    if (landSizeFilter.trim() !== "") {
      const { min, max } = getLandAreaRange(landSizeFilter);
      const area = parseArea(record.parcelArea);
      if (min !== null && area < min) matchesLandSize = false;
      if (max !== null && area > max) matchesLandSize = false;
    }

    return matchesStatus && matchesSearch && matchesLandSize;
  });

  const sortedFilteredRecords = [...filteredRecords].sort((a, b) => {
    const timeA = a.dateSubmitted ? new Date(a.dateSubmitted).getTime() : 0;
    const timeB = b.dateSubmitted ? new Date(b.dateSubmitted).getTime() : 0;
    return timeB - timeA; // newest first
  });

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return "—";
    }
  };

  const getStatusClass = (status: string) => {
    const normalizedStatus = String(status ?? "")
      .toLowerCase()
      .trim();

    if (normalizedStatus === "active farmer" || normalizedStatus === "active") {
      return "jo-masterlist-status-approved";
    }

    if (
      normalizedStatus === "not active" ||
      normalizedStatus === "inactive farmer" ||
      normalizedStatus === "inactive"
    ) {
      return "jo-masterlist-status-not-approved";
    }

    return "jo-masterlist-status-pending";
  };

  const getOwnershipLabel = (record: RSBSARecord) => {
    const ownership = record.ownershipType;
    if (!ownership) return "Unknown";
    if (ownership.registeredOwner) return "Owner";
    if (ownership.tenant && ownership.lessee) return "Tenant + Lessee";
    if (ownership.tenant) return "Tenant";
    if (ownership.lessee) return "Lessee";
    if (ownership.tenantLessee) return "Tenant/Lessee";
    return "Unknown";
  };

  const confirmStatusChange = async () => {
    if (!statusChangeTarget) return;

    // Validation
    if (statusModalParcels.length === 0) {
      if (!statusChangeReason.trim()) {
        showUpdateNotification("Please provide a reason.", "error");
        return;
      }
    } else {
      const missingReason = statusModalParcels.some(
        (p) =>
          p.isCultivating === false &&
          !(p.cultivationStatusReason || "").trim(),
      );
      if (missingReason) {
        showUpdateNotification(
          "Please provide a reason for all inactive parcels.",
          "error",
        );
        return;
      }
      // Also ensure that every parcel has explicitly been set to true or false (not null)
      const unselectedParcel = statusModalParcels.some(
        (p) => p.isCultivating === null || p.isCultivating === undefined,
      );
      if (unselectedParcel) {
        showUpdateNotification(
          "Please select a status for all parcels.",
          "error",
        );
        return;
      }
    }

    // ─── Offline path: queue the change locally ───────────────────────
    if (!navigator.onLine) {
      try {
        const isNowActive = statusChangeTarget.newStatus === "Active Farmer";
        const newFarmerStatus = statusChangeTarget.newStatus;
        const timestamp = new Date().toISOString();
        let newCultivationStatus = "";
        let finalReason = "";

        if (statusModalParcels.length === 0) {
          newCultivationStatus = isNowActive ? "Actively farming" : "Not farming";
          finalReason = statusChangeReason.trim();
        } else {
          const anyActive = statusModalParcels.some((p) => p.isCultivating === true);
          newCultivationStatus = anyActive ? "Actively farming" : "Not farming";
          finalReason = statusModalParcels
            .filter((p) => p.isCultivating === false && (p.cultivationStatusReason || "").trim())
            .map((p) => `Parcel ${p.parcelNumber !== "N/A" ? p.parcelNumber : p.id}: ${(p.cultivationStatusReason || "").trim()}`)
            .join("; ");
        }

        await addPendingAction("CULTIVATION_UPDATE", {
          farmerId: statusChangeTarget.id,
          parcels: statusModalParcels.map((p: any) => ({
            id: p.id,
            updates: {
              is_farming: p.isCultivating === true,
              farming_status_reason:
                p.isCultivating === true
                  ? null
                  : (p.cultivationStatusReason || "").trim(),
              farming_status_updated_at: timestamp,
            },
          })),
          submission: {
            id: statusChangeTarget.id,
            updates: {
              status: isNowActive ? "Active Farmer" : "Not Active",
              statusChangeReason: finalReason,
            },
          },
        });

        // ✅ Optimistic local update
        setRsbsaRecords((prev) =>
          prev.map((r) =>
            r.id === statusChangeTarget.id
              ? {
                  ...r,
                  status: newFarmerStatus,
                  cultivationStatus: newCultivationStatus,
                }
              : r,
          ),
        );

        showUpdateNotification(
          `Saved offline — "${newFarmerStatus}" will sync when connection returns.`,
          "success",
        );
      } catch (offlineErr: any) {
        showUpdateNotification(
          `Failed to save offline: ${offlineErr.message}`,
          "error",
        );
      } finally {
        setShowStatusModal(false);
        setStatusChangeTarget(null);
        setStatusModalParcels([]);
        setStatusChangeReason("");
      }
      return;
    }

    // ─── Online path: original Supabase calls ─────────────────────────
    try {
      let newFarmerStatus = "";
      let newCultivationStatus = "";
      let finalReason = "";

      if (statusModalParcels.length === 0) {
        const isNowActive = statusChangeTarget.newStatus === "Active Farmer";
        newFarmerStatus = statusChangeTarget.newStatus;
        newCultivationStatus = isNowActive ? "Actively farming" : "Not farming";
        finalReason = statusChangeReason.trim();
      } else {
        let isNowActive = false;

        // Update each parcel's cultivation status in DB
        for (const parcel of statusModalParcels) {
          if (parcel.isCultivating === true) {
            isNowActive = true;
          }
          await updateFarmParcel(parcel.id, {
            is_farming: parcel.isCultivating === true,
            farming_status_reason:
              parcel.isCultivating === true
                ? null
                : (parcel.cultivationStatusReason || "").trim(),
            farming_status_updated_at: new Date().toISOString(),
          });
        }

        newFarmerStatus = isNowActive ? "Active Farmer" : "Not Active";
        newCultivationStatus = isNowActive ? "Actively farming" : "Not farming";

        finalReason = statusModalParcels
          .filter(
            (p) =>
              p.isCultivating === false &&
              (p.cultivationStatusReason || "").trim(),
          )
          .map(
            (p) =>
              `Parcel ${p.parcelNumber !== "N/A" ? p.parcelNumber : p.id}: ${(p.cultivationStatusReason || "").trim()}`,
          )
          .join("; ");
      }

      await updateRsbsaSubmission(statusChangeTarget.id, {
        status: newFarmerStatus,
        statusChangeReason: finalReason,
      });

      // ✅ Update local rsbsaRecords with new status AND cultivationStatus
      setRsbsaRecords((prev) =>
        prev.map((r) =>
          r.id === statusChangeTarget.id
            ? {
                ...r,
                status: newFarmerStatus,
                cultivationStatus: newCultivationStatus,
              }
            : r,
        ),
      );

      // ✅ If the farmer detail modal is currently open for this farmer, refresh it
      if (selectedFarmer?.id === statusChangeTarget.id) {
        const updatedRecord = rsbsaRecords.find(
          (r) => r.id === statusChangeTarget.id,
        );
        if (updatedRecord) {
          await fetchFarmerDetails(statusChangeTarget.id, {
            ...updatedRecord,
            status: newFarmerStatus,
            cultivationStatus: newCultivationStatus,
          });
        }
      }

      showUpdateNotification(`Farmer marked as ${newFarmerStatus}.`, "success");
    } catch (err: any) {
      showUpdateNotification(`Failed to update: ${err.message}`, "error");
    } finally {
      setShowStatusModal(false);
      setStatusChangeTarget(null);
      setStatusModalParcels([]);
      setStatusChangeReason("");
    }
  };

  const getFilteredPrintRecords = () => {
    const shouldIncludeAllFarmers = printFilter.type === "all_farmers";
    let filtered = shouldIncludeAllFarmers
      ? [...rsbsaRecords]
      : rsbsaRecords.filter((record) => record.status === "Active Farmer");

    if (printFilter.type === "lastname" && printFilter.value) {
      filtered = filtered.filter((record) => {
        const lastName =
          record.farmerName.split(" ").pop()?.toLowerCase() || "";
        return lastName === printFilter.value.toLowerCase();
      });
    } else if (printFilter.type === "barangay" && printFilter.value) {
      filtered = filtered.filter((record) =>
        record.farmLocation
          .toLowerCase()
          .includes(printFilter.value.toLowerCase()),
      );
    } else if (printFilter.type === "date" && printFilter.value) {
      filtered = filtered.filter((record) => {
        const recordDate = formatDate(record.dateSubmitted);
        const filterDate = formatDate(printFilter.value);
        return recordDate === filterDate;
      });
    }

    return filtered;
  };

  const openBrowserPrintPreview = (html: string): boolean => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print the farmers list.");
      return false;
    }

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    return true;
  };

  const getUniqueLastNames = () => {
    const lastNames = new Set<string>();
    rsbsaRecords
      .filter((record) => record.status === "Active Farmer")
      .forEach((record) => {
        const lastName = record.farmerName.split(" ").pop();
        if (lastName) lastNames.add(lastName);
      });
    return Array.from(lastNames).sort();
  };

  const getUniqueBarangays = () => {
    const barangays = new Set<string>();
    rsbsaRecords
      .filter((record) => record.status === "Active Farmer")
      .forEach((record) => {
        if (record.farmLocation) barangays.add(record.farmLocation);
      });
    return Array.from(barangays).sort();
  };

  const getUniqueDates = () => {
    const dates = new Set<string>();
    rsbsaRecords
      .filter((record) => record.status === "Active Farmer")
      .forEach((record) => {
        const date = formatDate(record.dateSubmitted);
        if (date !== "—") dates.add(date);
      });
    return Array.from(dates).sort();
  };

  const printActiveFarmers = async () => {
    const activeFarmers = getFilteredPrintRecords();

    if (activeFarmers.length === 0) {
      alert("No active farmers found with the selected filter.");
      return;
    }

    const printingAllFarmers = printFilter.type === "all_farmers";

    let filterDescription = printingAllFarmers
      ? "All Farmers"
      : "All Active Farmers";
    if (printFilter.type === "lastname" && printFilter.value) {
      filterDescription = `Family Name: ${printFilter.value}`;
    } else if (printFilter.type === "barangay" && printFilter.value) {
      filterDescription = `Barangay: ${printFilter.value}`;
    } else if (printFilter.type === "date" && printFilter.value) {
      filterDescription = `Date Submitted: ${formatDate(printFilter.value)}`;
    }

    const reportTitle = printingAllFarmers
      ? "ALL FARMERS LIST"
      : "ACTIVE FARMERS LIST";

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Active Farmers List</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              color: #333;
            }
            .print-toolbar {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              background: #2563eb;
              color: white;
              padding: 15px 20px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              box-shadow: 0 2px 10px rgba(0,0,0,0.2);
              z-index: 1000;
            }
            .print-toolbar h3 {
              margin: 0;
              font-size: 16px;
            }
            .print-toolbar button {
              padding: 10px 25px;
              font-size: 14px;
              font-weight: bold;
              border: none;
              border-radius: 5px;
              cursor: pointer;
              margin-left: 10px;
            }
            .print-btn {
              background: #22c55e;
              color: white;
            }
            .print-btn:hover {
              background: #16a34a;
            }
            .close-btn {
              background: #ef4444;
              color: white;
            }
            .close-btn:hover {
              background: #dc2626;
            }
            .content-wrapper {
              margin-top: 80px;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #333;
              padding-bottom: 10px;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
            }
            .header p {
              margin: 5px 0;
              font-size: 14px;
            }
            .filter-info {
              text-align: center;
              margin-bottom: 20px;
              padding: 10px;
              background-color: #f0f0f0;
              border: 1px solid #ccc;
              border-radius: 5px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              border: 1px solid #333;
              padding: 8px;
              text-align: left;
              font-size: 12px;
            }
            th {
              background-color: #f5f5f5;
              font-weight: bold;
            }
            .summary {
              margin-top: 20px;
              font-weight: bold;
              font-size: 14px;
            }
            @media print {
              .print-toolbar { display: none !important; }
              .content-wrapper { margin-top: 0; }
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="print-toolbar">
            <h3>📄 Print Preview - Review your document below</h3>
            <div>
              <button class="print-btn" onclick="window.print()">🖨️ Print Now</button>
              <button class="close-btn" onclick="window.close()">✕ Close</button>
            </div>
          </div>
          
          <div class="content-wrapper">
            <div class="header">
              <h1>${reportTitle}</h1>
              <p>Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
            </div>
            
            <div class="filter-info">
              <strong>Filter Applied:</strong> ${filterDescription}
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Reference Number</th>
                  <th>Farmer Name</th>
                  <th>Farmer Address</th>
                  <th>Parcel Address</th>
                  <th>Parcel Area</th>
                  <th>Date Submitted</th>
                </tr>
              </thead>
              <tbody>
                ${activeFarmers
                  .map(
                    (farmer, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${farmer.referenceNumber}</td>
                    <td>${farmer.farmerName}</td>
                    <td>${farmer.farmerAddress}</td>
                    <td>${farmer.farmLocation}</td>
                    <td>${farmer.parcelArea}</td>
                    <td>${formatDate(farmer.dateSubmitted)}</td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>
            
            <div class="summary">
              <p>Total Active Farmers (Filtered): ${activeFarmers.length}</p>
              <p>Report generated by FFRS System</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Check if running in Electron with print API available
    let printStarted = false;
    if (window.electron?.printContent) {
      try {
        const result = await window.electron.printContent(printContent);
        if (result.success) {
          printStarted = true;
        } else if (result.error) {
          console.error("Print failed:", result.error);
          // User cancelled the print dialog - this is normal.
          if (result.error !== "cancelled") {
            printStarted = openBrowserPrintPreview(printContent);
          }
        }
      } catch (err: any) {
        console.error("Print error:", err);
        printStarted = openBrowserPrintPreview(printContent);
      }
    } else {
      // Browser fallback: open preview window with explicit Print button.
      printStarted = openBrowserPrintPreview(printContent);
    }

    if (!printStarted && !window.electron?.printContent) {
      return;
    }

    // Close the modal and reset filter
    setShowPrintModal(false);
    setPrintFilter({ type: "all", value: "" });
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

  const allFilteredSelected =
    sortedFilteredRecords.length > 0 &&
    sortedFilteredRecords.every((r) => selectedRecordIds.has(r.id));

  const toggleSelectAllFiltered = () => {
    setSelectedRecordIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        sortedFilteredRecords.forEach((r) => next.delete(r.id));
      } else {
        sortedFilteredRecords.forEach((r) => next.add(r.id));
      }
      return next;
    });
  };

  const toggleSelectRecord = (id: string) => {
    setSelectedRecordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handlePrintMasterlist = async (scope: "all" | "selected") => {
    const recordsToPrint = scope === "selected"
      ? sortedFilteredRecords.filter(r => selectedRecordIds.has(r.id))
      : sortedFilteredRecords;

    if (recordsToPrint.length === 0) {
      alert("No farmers found for the selected scope.");
      return;
    }

    const filterDescription = scope === "selected"
      ? `Selected Farmers (${recordsToPrint.length})`
      : `All Filtered Farmers (${recordsToPrint.length})`;

    const reportTitle = "FARMERS MASTERLIST REPORT";

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Farmers Masterlist</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              color: #333;
            }
            .print-toolbar {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              background: #2563eb;
              color: white;
              padding: 15px 20px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              box-shadow: 0 2px 10px rgba(0,0,0,0.2);
              z-index: 1000;
            }
            .print-toolbar h3 {
              margin: 0;
              font-size: 16px;
            }
            .print-toolbar button {
              padding: 10px 25px;
              font-size: 14px;
              font-weight: bold;
              border: none;
              border-radius: 5px;
              cursor: pointer;
              margin-left: 10px;
            }
            .print-btn {
              background: #22c55e;
              color: white;
            }
            .print-btn:hover {
              background: #16a34a;
            }
            .close-btn {
              background: #ef4444;
              color: white;
            }
            .close-btn:hover {
              background: #dc2626;
            }
            .content-wrapper {
              margin-top: 80px;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #333;
              padding-bottom: 10px;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
            }
            .header p {
              margin: 5px 0;
              font-size: 14px;
            }
            .filter-info {
              text-align: center;
              margin-bottom: 20px;
              padding: 10px;
              background-color: #f0f0f0;
              border: 1px solid #ccc;
              border-radius: 5px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              border: 1px solid #333;
              padding: 8px;
              text-align: left;
              font-size: 12px;
            }
            th {
              background-color: #f5f5f5;
              font-weight: bold;
            }
            .summary {
              margin-top: 20px;
              font-weight: bold;
              font-size: 14px;
            }
            @media print {
              .print-toolbar { display: none !important; }
              .content-wrapper { margin-top: 0; }
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="print-toolbar">
            <h3>📄 Print Preview - Review your document below</h3>
            <div>
              <button class="print-btn" onclick="window.print()">🖨️ Print Now</button>
              <button class="close-btn" onclick="window.close()">✕ Close</button>
            </div>
          </div>
          
          <div class="content-wrapper">
            <div class="header">
              <h1>${reportTitle}</h1>
              <p>Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
            </div>
            
            <div class="filter-info">
              <strong>Scope:</strong> ${filterDescription}
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Reference Number</th>
                  <th>Farmer Name</th>
                  <th>Farmer Address</th>
                  <th>Parcel Address</th>
                  <th>Parcel Area</th>
                  <th>Date Submitted</th>
                </tr>
              </thead>
              <tbody>
                ${recordsToPrint
                  .map(
                    (farmer, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${farmer.referenceNumber}</td>
                    <td>${farmer.farmerName}</td>
                    <td>${farmer.farmerAddress}</td>
                    <td>${farmer.farmLocation}</td>
                    <td>${farmer.parcelArea}</td>
                    <td>${formatDate(farmer.dateSubmitted)}</td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>
            
            <div class="summary">
              <p>Total Farmers (Printed): ${recordsToPrint.length}</p>
              <p>Report generated by FFRS System</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Check if running in Electron with print API available
    let printStarted = false;
    if (window.electron?.printContent) {
      try {
        const result = await window.electron.printContent(printContent);
        if (result.success) {
          printStarted = true;
        } else if (result.error) {
          console.error("Print failed:", result.error);
          if (result.error !== "cancelled") {
            printStarted = openBrowserPrintPreview(printContent);
          }
        }
      } catch (err: any) {
        console.error("Print error:", err);
        printStarted = openBrowserPrintPreview(printContent);
      }
    } else {
      printStarted = openBrowserPrintPreview(printContent);
    }
  };

  const handleBulkPrint = async () => {
    const selectedRecords = sortedFilteredRecords.filter(r => selectedRecordIds.has(r.id));
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
  };

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    navigate("/login");
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const getFarmerInitials = (name: string) => {
    const parts = name
      .split(/[, ]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const statusCounts = React.useMemo(() => {
    const total = rsbsaRecords.length;
    const active = rsbsaRecords.filter((r) => r.status === "Active Farmer").length;
    const notActive = rsbsaRecords.filter((r) => r.status === "Not Active").length;
    return { total, active, notActive };
  }, [rsbsaRecords]);

  return (
    <div className="jo-masterlist-page-container">
      <div className="jo-masterlist-page has-mobile-sidebar">
        <TechSidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        <div className="jo-masterlist-main-content">
          {/* Mobile header */}
          <div className="tech-incent-mobile-header">
            <button
              className="tech-incent-hamburger"
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="tech-incent-mobile-title">Masterlist</div>
          </div>

          {/* Page header */}
          <OfflineStatusBanner />

          <div className="jo-masterlist-dashboard-header">
            <div>
              <h1 className="jo-masterlist-page-title">Masterlist</h1>
              <p className="jo-masterlist-page-subtitle">
                Browse all RSBSA farmers, filter by status, and generate reports
              </p>
            </div>
          </div>

          {/* Summary cards */}
          {!loading && !error && (
            <div className="jo-masterlist-status-cards">
              <div className="jo-masterlist-status-card jo-masterlist-card-total">
                <div className="jo-masterlist-card-icon">👥</div>
                <div className="jo-masterlist-card-info">
                  <span className="jo-masterlist-card-count">{statusCounts.total}</span>
                  <span className="jo-masterlist-card-label">Total Registered</span>
                </div>
              </div>
              <div className="jo-masterlist-status-card jo-masterlist-card-active">
                <div className="jo-masterlist-card-icon">✅</div>
                <div className="jo-masterlist-card-info">
                  <span className="jo-masterlist-card-count">{statusCounts.active}</span>
                  <span className="jo-masterlist-card-label">Active Farmers</span>
                </div>
              </div>
              <div className="jo-masterlist-status-card jo-masterlist-card-inactive">
                <div className="jo-masterlist-card-icon">⛔</div>
                <div className="jo-masterlist-card-info">
                  <span className="jo-masterlist-card-count">{statusCounts.notActive}</span>
                  <span className="jo-masterlist-card-label">Not Active</span>
                </div>
              </div>
            </div>
          )}

          <div className="jo-masterlist-content-card">
            {/* Filters */}
            <div className="jo-masterlist-filters-section">
              <div className="jo-masterlist-filters-row-1">
                <div className="jo-masterlist-search-filter">
                  <input
                    type="text"
                    placeholder="Search by farmer name, reference number, or barangay..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="jo-masterlist-search-input"
                  />
                </div>
              </div>
              <div className="jo-masterlist-filters-row-2">
                <div className="jo-masterlist-status-filter">
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="jo-masterlist-status-select"
                  >
                    <option value="all">All Status</option>
                    <option value="Active Farmer">Active Farmer</option>
                    <option value="Not Active">Not Active</option>
                  </select>
                </div>

                {/* ── Single Land Area Filter ── */}
                <div
                  className="jo-masterlist-land-filter-group"
                  title="Type a land size in hectares (e.g., '2' filters 1 to 2 ha, '1-3' filters 1 to 3 ha)"
                >
                  <span className="jo-masterlist-land-icon">📐</span>
                  <input
                    type="text"
                    placeholder="Land ha (e.g. 2)"
                    value={landSizeFilter}
                    onChange={(e) => setLandSizeFilter(e.target.value)}
                    className="jo-masterlist-land-single-input"
                    aria-label="Filter by land area in hectares"
                  />
                  {landSizeFilter.trim() !== "" && (
                    <>
                      <span className="jo-masterlist-land-range-badge">
                        {(() => {
                          const { min, max } = getLandAreaRange(landSizeFilter);
                          if (min !== null && max !== null)
                            return `${min}–${max} ha`;
                          if (min !== null) return `≥${min} ha`;
                          if (max !== null) return `≤${max} ha`;
                          return "";
                        })()}
                      </span>
                      <button
                        type="button"
                        className="jo-masterlist-land-clear-btn"
                        onClick={() => setLandSizeFilter("")}
                        title="Clear land area filter"
                        aria-label="Clear land area filter"
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

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
                            color: "#888",
                            fontWeight: 600,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            borderBottom: "0.5px solid #e0e0e0",
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
                          🗂 Print All ({sortedFilteredRecords.length})
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
                    {[
                      "Farmer Name",
                      "Farmer Address",
                      "Parcel Address",
                      "Parcel Area",
                      "Ownership Type",
                      "Date Submitted",
                      "Status",
                    ].map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={8} className="jo-masterlist-loading-cell">
                        Loading...
                      </td>
                    </tr>
                  )}
                  {error && !loading && (
                    <tr>
                      <td colSpan={8} className="jo-masterlist-error-cell">
                        Error: {error}
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    !error &&
                    sortedFilteredRecords.length > 0 &&
                    sortedFilteredRecords.map((record) => (
                      <tr
                        key={record.id}
                        className="jo-masterlist-table-row"
                        onClick={() => fetchFarmerDetails(record.id, record)}
                        style={{ cursor: "pointer" }}
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
                        <td data-label="Select">
                          <div className="jo-masterlist-farmer-cell">
                            <div className="jo-masterlist-farmer-avatar">
                              {getFarmerInitials(record.farmerName)}
                            </div>
                            <div className="jo-masterlist-farmer-meta">
                              <span className="jo-masterlist-farmer-name">
                                {record.farmerName}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td data-label="Farmer Address">{record.farmerAddress}</td>
                        <td data-label="Parcel Address">{record.farmLocation}</td>
                        <td data-label="Parcel Area">
                          <span style={{ fontWeight: 600 }}>{record.parcelArea}</span>
                        </td>
                        <td data-label="Ownership Type">{getOwnershipLabel(record)}</td>
                        <td data-label="Date Submitted">{formatDate(record.dateSubmitted)}</td>
                        <td data-label="Status">
                          <button
                            className={`jo-masterlist-status-pill ${getStatusClass(record.status)}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              openStatusModal(record);
                            }}
                          >
                            {record.status}
                          </button>
                        </td>
                      </tr>
                    ))}
                  {!loading &&
                    !error &&
                    sortedFilteredRecords.length === 0 && (
                      <tr>
                        <td colSpan={8} className="jo-masterlist-empty-cell" style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                          No records found.
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

        {/* Print Filter Modal */}
        {showPrintModal && (
          <div className="tech-masterlist-print-modal-overlay">
            <div className="tech-masterlist-print-modal">
              <div className="tech-masterlist-print-modal-header">
                <h3>Print Active Farmers</h3>
                <button
                  className="tech-masterlist-close-button"
                  onClick={() => {
                    setShowPrintModal(false);
                    setPrintFilter({ type: "all", value: "" });
                  }}
                >
                  ×
                </button>
              </div>
              <div className="tech-masterlist-print-modal-body">
                <div className="tech-masterlist-print-filter-group">
                  <label>Filter Type</label>
                  <select
                    value={printFilter.type}
                    onChange={(e) =>
                      setPrintFilter({ type: e.target.value, value: "" })
                    }
                    className="tech-masterlist-print-filter-select"
                  >
                    <option value="all_farmers">Print All Farmers</option>
                    <option value="all">Print All Active Farmers</option>
                    <option value="lastname">Filter by Family Name</option>
                    <option value="barangay">Filter by Barangay</option>
                    <option value="date">Filter by Date Submitted</option>
                  </select>
                </div>

                {printFilter.type === "lastname" && (
                  <div className="tech-masterlist-print-filter-group">
                    <label>Select Family Name</label>
                    <select
                      value={printFilter.value}
                      onChange={(e) =>
                        setPrintFilter({
                          ...printFilter,
                          value: e.target.value,
                        })
                      }
                      className="tech-masterlist-print-value-select"
                    >
                      <option value="">Choose a family name...</option>
                      {getUniqueLastNames().map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {printFilter.type === "barangay" && (
                  <div className="tech-masterlist-print-filter-group">
                    <label>Select Barangay</label>
                    <select
                      value={printFilter.value}
                      onChange={(e) =>
                        setPrintFilter({
                          ...printFilter,
                          value: e.target.value,
                        })
                      }
                      className="tech-masterlist-print-value-select"
                    >
                      <option value="">Choose a barangay...</option>
                      {getUniqueBarangays().map((barangay) => (
                        <option key={barangay} value={barangay}>
                          {barangay}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {printFilter.type === "date" && (
                  <div className="tech-masterlist-print-filter-group">
                    <label>Select Date Submitted</label>
                    <select
                      value={printFilter.value}
                      onChange={(e) =>
                        setPrintFilter({
                          ...printFilter,
                          value: e.target.value,
                        })
                      }
                      className="tech-masterlist-print-value-select"
                    >
                      <option value="">Choose a date...</option>
                      {getUniqueDates().map((date) => (
                        <option key={date} value={date}>
                          {date}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {(printFilter.type === "all" ||
                  printFilter.type === "all_farmers" ||
                  printFilter.value) && (
                  <div className="tech-masterlist-print-match-count">
                    📊 {getFilteredPrintRecords().length} farmer
                    {getFilteredPrintRecords().length !== 1 ? "s" : ""} will be
                    printed
                  </div>
                )}
              </div>
              <div className="tech-masterlist-print-modal-footer">
                <button
                  className="tech-masterlist-print-modal-cancel-button"
                  onClick={() => {
                    setShowPrintModal(false);
                    setPrintFilter({ type: "all", value: "" });
                  }}
                >
                  Cancel
                </button>
                <button
                  className="tech-masterlist-print-modal-print-button"
                  onClick={printActiveFarmers}
                  disabled={
                    printFilter.type !== "all" &&
                    printFilter.type !== "all_farmers" &&
                    !printFilter.value
                  }
                >
                  🖨️ Print
                </button>
              </div>
            </div>
          </div>
        )}

        {showStatusModal && statusChangeTarget && (
          <div className="tech-masterlist-print-modal-overlay">
            <div
              className="tech-masterlist-print-modal"
              style={{
                maxWidth: "600px",
                maxHeight: "90vh",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div className="tech-masterlist-print-modal-header">
                <h3>Update Cultivation Status</h3>
                <button
                  className="tech-masterlist-close-button"
                  onClick={() => {
                    setShowStatusModal(false);
                    setStatusChangeTarget(null);
                    setStatusModalParcels([]);
                    setStatusChangeReason("");
                  }}
                >
                  ×
                </button>
              </div>

              <div
                className="tech-masterlist-print-modal-body"
                style={{ overflowY: "auto", padding: "20px" }}
              >
                <p style={{ marginBottom: "16px" }}>
                  Farmer:{" "}
                  <strong>
                    {rsbsaRecords.find((r) => r.id === statusChangeTarget.id)
                      ?.farmerName ?? "—"}
                  </strong>
                </p>

                {statusModalLoading ? (
                  <p>Loading parcels...</p>
                ) : statusModalParcels.length === 0 ? (
                  <>
                    <div
                      className="tech-masterlist-print-filter-group"
                      style={{ marginBottom: "16px" }}
                    >
                      <label>Update Status (No Parcels Found)</label>
                      <div
                        style={{
                          display: "flex",
                          gap: "16px",
                          marginTop: "8px",
                        }}
                      >
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="radio"
                            name="farmerStatus"
                            value="Active Farmer"
                            checked={
                              statusChangeTarget.newStatus === "Active Farmer"
                            }
                            onChange={(e) =>
                              setStatusChangeTarget((prev) =>
                                prev
                                  ? { ...prev, newStatus: e.target.value }
                                  : null,
                              )
                            }
                          />
                          Active Farmer
                        </label>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="radio"
                            name="farmerStatus"
                            value="Not Active"
                            checked={
                              statusChangeTarget.newStatus === "Not Active"
                            }
                            onChange={(e) =>
                              setStatusChangeTarget((prev) =>
                                prev
                                  ? { ...prev, newStatus: e.target.value }
                                  : null,
                              )
                            }
                          />
                          Not Active Farmer
                        </label>
                      </div>
                    </div>

                    <div className="tech-masterlist-print-filter-group">
                      <label>
                        Reason <span style={{ color: "red" }}>*</span>
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Enter reason for cultivation status change..."
                        value={statusChangeReason}
                        onChange={(e) => setStatusChangeReason(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px",
                          borderRadius: "6px",
                          border: "1px solid #ccc",
                          resize: "vertical",
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "20px",
                    }}
                  >
                    <p style={{ fontSize: "14px", color: "#666" }}>
                      Please update the cultivation status for each parcel. The
                      farmer will be marked as "Active" if at least one parcel
                      is actively being farmed.
                    </p>
                    {statusModalParcels.map((parcel, index) => (
                      <div
                        key={parcel.id}
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                          padding: "16px",
                          background: "#f8fafc",
                        }}
                      >
                        <div
                          style={{
                            marginBottom: "12px",
                            borderBottom: "1px solid #cbd5e1",
                            paddingBottom: "8px",
                          }}
                        >
                          <strong>
                            Parcel #
                            {parcel.parcelNumber !== "N/A"
                              ? parcel.parcelNumber
                              : index + 1}
                          </strong>
                          <span
                            style={{
                              fontSize: "13px",
                              color: "#64748b",
                              marginLeft: "8px",
                            }}
                          >
                            ({parcel.totalFarmAreaHa} ha -{" "}
                            {parcel.farmLocationBarangay})
                          </span>
                        </div>
                        <div style={{ marginBottom: "12px", padding: "6px 10px", background: "#fffbeb", borderLeft: "3px solid #d97706", borderRadius: "4px", fontSize: "11px", color: "#92400e" }}>
                          ⚠️ <strong>Parcel Area Note:</strong> If physical boundaries or hectare sizes change, please update the GIS map shape accordingly.
                        </div>

                        <div
                          style={{
                            display: "flex",
                            gap: "16px",
                            marginBottom: "12px",
                          }}
                        >
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="radio"
                              name={`parcelStatus-${parcel.id}`}
                              checked={parcel.isCultivating === true}
                              onChange={() =>
                                setStatusModalParcels((prev) =>
                                  prev.map((p) =>
                                    p.id === parcel.id
                                      ? {
                                          ...p,
                                          isCultivating: true,
                                          cultivationStatusReason: "",
                                        }
                                      : p,
                                  ),
                                )
                              }
                            />
                            Actively farming
                          </label>
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="radio"
                              name={`parcelStatus-${parcel.id}`}
                              checked={parcel.isCultivating === false}
                              onChange={() =>
                                setStatusModalParcels((prev) =>
                                  prev.map((p) =>
                                    p.id === parcel.id
                                      ? { ...p, isCultivating: false }
                                      : p,
                                  ),
                                )
                              }
                            />
                            Not farming
                          </label>
                        </div>

                        {parcel.isCultivating === false && (
                          <div
                            className="tech-masterlist-print-filter-group"
                            style={{ marginTop: "12px" }}
                          >
                            <label style={{ fontSize: "13px" }}>
                              Reason for inactivity{" "}
                              <span style={{ color: "red" }}>*</span>
                            </label>
                            <textarea
                              rows={2}
                              placeholder="Enter reason why this parcel is not being farmed..."
                              value={parcel.cultivationStatusReason || ""}
                              onChange={(e) =>
                                setStatusModalParcels((prev) =>
                                  prev.map((p) =>
                                    p.id === parcel.id
                                      ? {
                                          ...p,
                                          cultivationStatusReason:
                                            e.target.value,
                                        }
                                      : p,
                                  ),
                                )
                              }
                              style={{
                                width: "100%",
                                padding: "8px",
                                borderRadius: "6px",
                                border: "1px solid #cbd5e1",
                                resize: "vertical",
                                marginTop: "6px",
                                fontSize: "13px",
                              }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div
                className="tech-masterlist-print-modal-footer"
                style={{
                  marginTop: "auto",
                  borderTop: "1px solid #e2e8f0",
                  padding: "16px 20px",
                }}
              >
                <button
                  className="tech-masterlist-print-modal-cancel-button"
                  onClick={() => {
                    setShowStatusModal(false);
                    setStatusChangeTarget(null);
                    setStatusModalParcels([]);
                    setStatusChangeReason("");
                  }}
                >
                  Cancel
                </button>
                <button
                  className="tech-masterlist-print-modal-print-button"
                  onClick={confirmStatusChange}
                  disabled={statusModalLoading}
                >
                  Confirm
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
                        📌 Record Overview
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
                          <span className="farmer-modal-label">Status:</span>
                          <span className="farmer-modal-value">
                            {selectedFarmer.recordStatus}
                          </span>
                        </div>
                        {selectedFarmer.recordStatus === "Not Active" &&
                          selectedFarmer.statusChangeReason && (
                            <div
                              className="farmer-modal-info-item farmer-modal-full-width"
                              style={{ marginTop: "8px" }}
                            >
                              <span
                                className="farmer-modal-label"
                                style={{ color: "#d32f2f" }}
                              >
                                Reason for Inactivity:
                              </span>
                              <span className="farmer-modal-value">
                                {selectedFarmer.statusChangeReason}
                              </span>
                            </div>
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
                                  {parcel.parcelNumber !== "N/A"
                                    ? parcel.parcelNumber
                                    : index + 1}
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
                                {(parcel.ownershipTypeTenant || parcel.ownershipTypeLessee) && !parcel.ownershipTypeRegisteredOwner ? (
                                   <div style={{ margin: "8px 0", padding: "8px 12px", background: "#fef3c7", borderLeft: "3px solid #d97706", borderRadius: "4px", fontSize: "12px", color: "#92400e", lineHeight: 1.4 }}>
                                     ⚠️ <strong>Tenant / Lessee Notice:</strong> This parcel is cultivated under a Tenant/Lessee agreement ({typeof parcel.totalFarmAreaHa === "number" ? parcel.totalFarmAreaHa.toFixed(2) : parcel.totalFarmAreaHa} ha). Changing this value does <strong>not</strong> alter official land parcel size — only the registered Landowner can modify official land boundary sizes.
                                   </div>
                                 ) : (
                                   <div style={{ margin: "8px 0", padding: "8px 12px", background: "#fffbeb", borderLeft: "3px solid #d97706", borderRadius: "4px", fontSize: "12px", color: "#92400e" }}>
                                     ⚠️ <strong>GIS Shape Warning:</strong> Registered area is {typeof parcel.totalFarmAreaHa === "number" ? parcel.totalFarmAreaHa.toFixed(2) : parcel.totalFarmAreaHa} ha. If physical boundaries changed, please verify/redraw the plot shape on the GIS map.
                                   </div>
                                 )}
                                <div className="farmer-modal-parcel-item">
                                  <span className="farmer-modal-label">
                                    Cultivation Status:
                                  </span>
                                  <span className="farmer-modal-value">
                                    {parcel.isCultivating === true
                                      ? "Actively farming"
                                      : parcel.isCultivating === false
                                        ? "Not farming" // ✅ This must show when isCultivating is false
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

export default TechMasterlist;
