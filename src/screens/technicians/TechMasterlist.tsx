import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  getRsbsaSubmissions,
  getRsbsaSubmissionById,
  getFarmParcels,
  updateRsbsaSubmission,
  updateFarmParcel, // ✅ add this
} from "../../api";
import { printRsbsaFormById } from "../../utils/rsbsaPrint";
import "../../assets/css/technician css/TechMasterlistStyle.css";
import "../../assets/css/jo css/FarmerDetailModal.css";
import "../../components/layout/sidebarStyle.css";
import LogoImage from "../../assets/images/Logo.png";
import HomeIcon from "../../assets/images/home.png";
import RSBSAIcon from "../../assets/images/rsbsa.png";
import ApproveIcon from "../../assets/images/approve.png";
import LogoutIcon from "../../assets/images/logout.png";
import IncentivesIcon from "../../assets/images/incentives.png";
import { supabase } from "../../supabase";

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
  const [selectedOwnershipType, setSelectedOwnershipType] =
    useState<string>("all");
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
      const data = farmerData.data || farmerData;

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
      const backendName = farmerData.farmerName || "";
      const reformattedFarmerName = (() => {
        if (!backendName || backendName === "N/A") return "N/A";
        const parts = backendName
          .split(",")
          .map((p: string) => p.trim())
          .filter(Boolean);
        if (parts.length === 0) return "N/A";
        if (parts.length === 1) return parts[0];
        const lastName = parts[0];
        const restOfName = parts.slice(1).join(" ");
        return `${lastName}, ${restOfName}`;
      })();

      const selectedRecord =
        summaryRecord ||
        rsbsaRecords.find((record) => String(record.id) === String(farmerId));

      const submittedDateLabel = selectedRecord?.dateSubmitted
        ? formatDate(selectedRecord.dateSubmitted)
        : "N/A";

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
        isCultivating:
          typeof p.is_cultivating === "boolean" ? p.is_cultivating : null,
        cultivationStatusReason: p.cultivation_status_reason || null,
        cultivationStatusUpdatedAt: p.cultivation_status_updated_at || null,
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
      newStatus: record.status === "Active Farmer" ? "Not Active" : "Active Farmer",
      farmerName: record.farmerName,
    });
    setStatusChangeReason("");
    setStatusModalLoading(true);
    setShowStatusModal(true);

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
          typeof p.is_cultivating === "boolean" ? p.is_cultivating : null,
        cultivationStatusReason: p.cultivation_status_reason || null,
        cultivationStatusUpdatedAt: p.cultivation_status_updated_at || null,
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
    const matchesStatus =
      selectedStatus === "all" || record.status === selectedStatus;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      record.farmerName.toLowerCase().includes(q) ||
      record.referenceNumber.toLowerCase().includes(q) ||
      record.farmerAddress.toLowerCase().includes(q) ||
      record.farmLocation.toLowerCase().includes(q);

    // Ownership type filter
    let matchesOwnership = true;
    if (selectedOwnershipType !== "all" && record.ownershipType) {
      const hasTenantOwnership =
        record.ownershipType.tenant === true ||
        (record.ownershipType.tenantLessee === true &&
          record.ownershipType.lessee !== true);
      const hasLesseeOwnership =
        record.ownershipType.lessee === true ||
        (record.ownershipType.tenantLessee === true &&
          record.ownershipType.tenant !== true);

      switch (selectedOwnershipType) {
        case "registeredOwner":
          matchesOwnership = record.ownershipType.registeredOwner === true;
          break;
        case "tenant":
          matchesOwnership = hasTenantOwnership;
          break;
        case "lessee":
          matchesOwnership = hasLesseeOwnership;
          break;
        default:
          matchesOwnership = true;
      }
    }

    return matchesStatus && matchesSearch && matchesOwnership;
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
      return "status-approved";
    }

    if (
      normalizedStatus === "not active" ||
      normalizedStatus === "inactive farmer" ||
      normalizedStatus === "inactive"
    ) {
      return "status-not-approved";
    }

    return "status-pending";
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
    if (!statusChangeReason.trim()) {
      showUpdateNotification("Please provide a reason.", "error");
      return;
    }

    try {
      const isNowActive = statusChangeTarget.newStatus === "Active Farmer";

      // Update each parcel's cultivation status in DB based on the new farmer status
      for (const parcel of statusModalParcels) {
        await updateFarmParcel(parcel.id, {
          is_cultivating: isNowActive,
          cultivation_status_reason: isNowActive ? null : statusChangeReason.trim(),
          cultivation_status_updated_at: new Date().toISOString(),
        });
      }

      const newFarmerStatus = statusChangeTarget.newStatus;
      const newCultivationStatus = isNowActive ? "Actively farming" : "Not farming";

      await updateRsbsaSubmission(statusChangeTarget.id, {
        status: newFarmerStatus,
        statusChangeReason: statusChangeReason.trim(),
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

      showUpdateNotification(
        `Farmer marked as ${newFarmerStatus}.`,
        "success",
      );
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

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    navigate("/login");
  };

  return (
    <div className="tech-masterlist-page-container">
      <div className="tech-masterlist-page">
        {/* Sidebar starts here */}
        <div className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
          <nav className="sidebar-nav">
            <div className="sidebar-logo">
              <img src={LogoImage} alt="Logo" />
            </div>

            <button
              className={`sidebar-nav-item ${isActive("/technician-dashboard") ? "active" : ""}`}
              onClick={() => navigate("/technician-dashboard")}
            >
              <span className="nav-icon">
                <img src={HomeIcon} alt="Home" />
              </span>
              <span className="nav-text">Home</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/technician-rsbsa") ? "active" : ""}`}
              onClick={() => navigate("/technician-rsbsa")}
            >
              <span className="nav-icon">
                <img src={RSBSAIcon} alt="RSBSA" />
              </span>
              <span className="nav-text">RSBSA</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/technician-incentives") ? "active" : ""}`}
              onClick={() => navigate("/technician-incentives")}
            >
              <span className="nav-icon">
                <img src={IncentivesIcon} alt="Incentives" />
              </span>
              <span className="nav-text">Subsidy</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/technician-masterlist") ? "active" : ""}`}
              onClick={() => navigate("/technician-masterlist")}
            >
              <span className="nav-icon">
                <img src={ApproveIcon} alt="Masterlist" />
              </span>
              <span className="nav-text">Masterlist</span>
            </button>

            <button className="sidebar-nav-item logout" onClick={handleLogout}>
              <span className="nav-icon">
                <img src={LogoutIcon} alt="Logout" />
              </span>
              <span className="nav-text">Logout</span>
            </button>

          </nav>
          {currentUser && (
            <div className="sidebar-current-user">
              <div className="sidebar-current-user-avatar">
                {currentUser.firstName.charAt(0).toUpperCase()}
                {currentUser.lastName.charAt(0).toUpperCase()}
              </div>
              <div className="sidebar-current-user-info">
                <span className="sidebar-current-user-name">
                  {currentUser.firstName} {currentUser.lastName}
                </span>
                <span className="sidebar-current-user-label">Logged in</span>
              </div>
            </div>
          )}
        </div>
        {/* Sidebar ends here */}

        <div
          className={`tech-incent-sidebar-overlay ${sidebarOpen ? "active" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />

        <div className="tech-masterlist-main-content">
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
            <div className="tech-incent-mobile-title">Masterlist</div>
          </div>
          <div className="tech-masterlist-dashboard-header">
            <div>
              <h2 className="tech-masterlist-page-title">Masterlist</h2>
              <p className="tech-masterlist-page-subtitle">
                Browse all RSBSA farmers, filter by status, and generate reports
              </p>
            </div>
          </div>
          <div className="tech-masterlist-print-section">
            <button
              onClick={() => setShowPrintModal(true)}
              className="tech-masterlist-print-button"
            >
              🖨️ Print Active Farmers
            </button>
          </div>
          <div className="tech-masterlist-content-card">
            <div className="tech-masterlist-filters-section">
              <div className="tech-masterlist-search-filter">
                <input
                  type="text"
                  placeholder="Search by farmer name, reference number, or barangay..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="tech-masterlist-search-input"
                />
              </div>
              <div className="tech-masterlist-status-filter">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="tech-masterlist-status-select"
                >
                  <option value="all">All Status</option>
                  <option value="Active Farmer">Active Farmer</option>
                  <option value="Not Active">Not Active</option>
                </select>
              </div>
              <div className="tech-masterlist-ownership-filter">
                <select
                  value={selectedOwnershipType}
                  onChange={(e) => setSelectedOwnershipType(e.target.value)}
                  className="tech-masterlist-status-select"
                >
                  <option value="all">All Ownership Types</option>
                  <option value="registeredOwner">Registered Owner</option>
                  <option value="tenant">Tenant</option>
                  <option value="lessee">Lessee</option>
                </select>
              </div>
            </div>
            <div className="tech-masterlist-table-container">
              <table className="tech-masterlist-farmers-table">
                <thead>
                  <tr>
                    {[
                      "FFRS ID",
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
                      <td colSpan={8} className="tech-masterlist-loading-cell">
                        Loading...
                      </td>
                    </tr>
                  )}
                  {error && !loading && (
                    <tr>
                      <td colSpan={8} className="tech-masterlist-error-cell">
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
                        onClick={() => fetchFarmerDetails(record.id, record)}
                        style={{ cursor: "pointer" }}
                      >
                        <td
                          className="tech-masterlist-ffrs-id"
                          title={record.referenceNumber || "N/A"}
                        >
                          <span className="tech-masterlist-ffrs-id-value">
                            {record.referenceNumber || "N/A"}
                          </span>
                        </td>
                        <td>
                          <div className="tech-masterlist-farmer-cell">
                            <span className="tech-masterlist-farmer-name">
                              {record.farmerName}
                            </span>
                          </div>
                        </td>

                        <td>{record.farmerAddress}</td>
                        <td>{record.farmLocation}</td>
                        <td>{record.parcelArea}</td>
                        <td>{getOwnershipLabel(record)}</td>
                        <td>{formatDate(record.dateSubmitted)}</td>
                        <td>
                          <button
                            className={`tech-masterlist-status-button tech-masterlist-${getStatusClass(record.status)}`}
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
                    sortedFilteredRecords.length === 0 &&
                    Array.from({ length: 16 }).map((_, i) => (
                      <tr key={`empty-${i}`}>
                        <td colSpan={8}>&nbsp;</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {updateNotification.show && (
          <div
            className={`tech-masterlist-update-toast ${updateNotification.type}`}
            role="status"
            aria-live="polite"
          >
            <span className="tech-masterlist-update-toast-message">
              {updateNotification.message}
            </span>
            <button
              className="tech-masterlist-update-toast-close"
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
              style={{ maxWidth: "520px" }}
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

              <div className="tech-masterlist-print-modal-body">
                <p style={{ marginBottom: "16px" }}>
                  Farmer:{" "}
                  <strong>
                    {rsbsaRecords.find((r) => r.id === statusChangeTarget.id)
                      ?.farmerName ?? "—"}
                  </strong>
                </p>

                {statusModalLoading ? (
                  <p>Loading...</p>
                ) : (
                  <>
                    <div className="tech-masterlist-print-filter-group" style={{ marginBottom: "16px" }}>
                      <label>Update Status</label>
                      <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                          <input 
                            type="radio" 
                            name="farmerStatus"
                            value="Active Farmer"
                            checked={statusChangeTarget.newStatus === "Active Farmer"}
                            onChange={(e) => setStatusChangeTarget(prev => prev ? { ...prev, newStatus: e.target.value } : null)}
                          />
                          Active Farmer
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                          <input 
                            type="radio" 
                            name="farmerStatus"
                            value="Not Active"
                            checked={statusChangeTarget.newStatus === "Not Active"}
                            onChange={(e) => setStatusChangeTarget(prev => prev ? { ...prev, newStatus: e.target.value } : null)}
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
                )}
              </div>

              <div className="tech-masterlist-print-modal-footer">
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
                  disabled={
                    !statusChangeReason.trim() ||
                    statusModalLoading
                  }
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
