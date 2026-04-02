import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  getRsbsaSubmissions,
  getRsbsaSubmissionById,
  getFarmParcels,
} from "../../api";
import { printRsbsaFormById } from "../../utils/rsbsaPrint";
import "../../assets/css/jo css/JoRsbsaPageStyle.css";
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
  gender: string;
  birthdate: string;
  dateSubmitted: string;
  status: string;
  landParcel: string;
  parcelArea: number | string | null;
  totalFarmArea: number;
  parcelCount: number;
  ownershipType: {
    registeredOwner: boolean;
    tenant: boolean;
    lessee: boolean;
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
}

type SortKey = "farmer" | "gender" | "parcelArea" | "dateSubmitted";
type SortDirection = "asc" | "desc";

const JoRsbsaPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [_activeTab] = useState("overview");
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
  const [isModalPrinting, setIsModalPrinting] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: SortDirection;
  }>({ key: "dateSubmitted", direction: "desc" });
  const showArchived = false;
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const isActive = (path: string) => location.pathname === path;

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
      // Exclude farmers with 'No Parcels' status unless showArchived is on
      const recordStatus = String(record.status ?? "")
        .toLowerCase()
        .trim();
      if (recordStatus === "no parcels" && !showArchived) {
        console.log(
          `Hiding ${record.farmerName}: status is No Parcels (archived)`,
        );
        return false;
      }

      // Exclude farmers who have transferred ALL their parcels
      // hasCurrentParcels: true = has current parcels, false = all transferred, undefined = no parcels yet
      if (record.hasCurrentParcels === false && recordStatus !== "no parcels") {
        console.log(`Excluding ${record.farmerName}: all parcels transferred`);
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

  // Re-filter registered owners when showArchived changes
  useEffect(() => {
    if (_rsbsaRecords.length > 0) {
      const refiltered = _rsbsaRecords.filter((record: any) => {
        const recordStatus = String(record.status ?? "")
          .toLowerCase()
          .trim();
        if (recordStatus === "no parcels" && !showArchived) return false;
        if (record.hasCurrentParcels === false && recordStatus !== "no parcels")
          return false;
        if (!record.ownershipType) return false;
        return record.ownershipType.registeredOwner === true;
      });
      setRegisteredOwners(refiltered);
    }
  }, [showArchived, _rsbsaRecords]);

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

      if (sortConfig.key === "gender") {
        const genderRank = (gender: string) => {
          const normalized = String(gender || "")
            .toLowerCase()
            .trim();
          if (normalized === "male") return 0;
          if (normalized === "female") return 1;
          return 2;
        };

        const rankDiff = genderRank(a.gender) - genderRank(b.gender);
        if (rankDiff !== 0) return rankDiff * factor;
        return (
          String(a.gender || "").localeCompare(String(b.gender || "")) * factor
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

      if (key === "farmer" || key === "gender") {
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

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return "—";
    }
  };

  const formatParcelArea = (value: number | string | null | undefined) => {
    const parsed =
      typeof value === "number" ? value : parseFloat(String(value ?? ""));
    if (!Number.isFinite(parsed) || parsed <= 0) return "N/A";
    return `${parsed.toFixed(2)} ha`;
  };

  const getOwnershipLabel = (record: RSBSARecord) => {
    if (record.ownershipType?.registeredOwner) return "Owner";
    if (record.ownershipType?.tenant) return "Tenant";
    if (record.ownershipType?.lessee) return "Lessee";
    return "—";
  };

  const getOwnershipClass = (record: RSBSARecord) => {
    if (record.ownershipType?.registeredOwner)
      return "jo-rsbsa-ownership-owner";
    if (record.ownershipType?.tenant) return "jo-rsbsa-ownership-tenant";
    if (record.ownershipType?.lessee) return "jo-rsbsa-ownership-lessee";
    return "jo-rsbsa-ownership-unknown";
  };

  const handleEditFromRsbsa = (recordId: string) => {
    navigate("/jo-masterlist", { state: { editRecordId: recordId } });
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
        <div className="jo-rsbsa-main-content">
          <div className="tech-incent-mobile-header">
            <button
              className="tech-incent-hamburger"
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              ☰
            </button>
            <div className="tech-incent-mobile-title">JO RSBSA</div>
          </div>
          <h2 className="jo-rsbsa-page-title">Registered Land Owners</h2>
          <p className="jo-rsbsa-page-subtitle">
            View and manage registered land owners from RSBSA submissions
          </p>

          <div className="jo-rsbsa-content-card">
            <div className="jo-rsbsa-actions-bar">
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
              <button
                className="jo-rsbsa-register-button"
                onClick={() => navigate("/jo-rsbsa")}
              >
                Register Farmer
              </button>
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
                            sortConfig.key === "gender" ? "is-active" : ""
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSortChange("gender");
                          }}
                        >
                          Gender <span>{getSortIndicator("gender")}</span>
                        </button>
                      </th>
                      <th>
                        <button
                          className={`jo-rsbsa-sort-btn ${
                            sortConfig.key === "parcelArea" ? "is-active" : ""
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
                        <td colSpan={5} className="jo-rsbsa-no-data">
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
                            <td>{record.gender || "N/A"}</td>
                            <td>
                              <div className="jo-rsbsa-parcel-cell">
                                <span className="jo-rsbsa-parcel-count">
                                  {record.parcelCount || 0} parcel
                                  {record.parcelCount === 1 ? "" : "s"}
                                </span>
                                <span className="jo-rsbsa-parcel-area">
                                  {formatParcelArea(record.totalFarmArea)}
                                </span>
                                <span
                                  className={`jo-rsbsa-ownership-pill ${getOwnershipClass(record)}`}
                                >
                                  {getOwnershipLabel(record)}
                                </span>
                              </div>
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
                                <button
                                  className="jo-rsbsa-action-btn jo-rsbsa-action-btn-edit"
                                  onClick={() => handleEditFromRsbsa(record.id)}
                                >
                                  Edit
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
          </div>
        </div>

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
                                      {parcel.ownershipTypeRegisteredOwner &&
                                        "Registered Owner"}
                                      {parcel.ownershipTypeTenant && (
                                        <>
                                          Tenant
                                          {parcel.tenantLandOwnerName && (
                                            <span className="farmer-modal-owner-name">
                                              {" "}
                                              (Owner:{" "}
                                              {parcel.tenantLandOwnerName})
                                            </span>
                                          )}
                                        </>
                                      )}
                                      {parcel.ownershipTypeLessee && (
                                        <>
                                          Lessee
                                          {parcel.lesseeLandOwnerName && (
                                            <span className="farmer-modal-owner-name">
                                              {" "}
                                              (Owner:{" "}
                                              {parcel.lesseeLandOwnerName})
                                            </span>
                                          )}
                                        </>
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
                                      {typeof parcel.totalFarmAreaHa ===
                                      "number"
                                        ? parcel.totalFarmAreaHa.toFixed(2)
                                        : parseFloat(
                                            String(parcel.totalFarmAreaHa || 0),
                                          ).toFixed(2)}{" "}
                                      hectares
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
