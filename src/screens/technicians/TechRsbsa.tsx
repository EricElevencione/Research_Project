import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  getRsbsaSubmissions,
  getRsbsaSubmissionById,
  getFarmParcels,
  getTechDashboardData,
} from "../../api";
import "../../assets/css/technician css/TechRsbsaStyle.css";
import "../../assets/css/jo css/FarmerDetailModal.css";
import "../../components/layout/sidebarStyle.css";
import LogoImage from "../../assets/images/Logo.png";
import HomeIcon from "../../assets/images/home.png";
import RSBSAIcon from "../../assets/images/rsbsa.png";
import ApproveIcon from "../../assets/images/approve.png";
import LogoutIcon from "../../assets/images/logout.png";
import IncentivesIcon from "../../assets/images/incentives.png";

interface RSBSARecord {
  id: string;
  referenceNumber: string;
  farmerName: string;
  firstName: string;
  middleName: string;
  lastName: string;
  extName: string;
  farmerAddress: string;
  farmLocation: string;
  gender: string;
  birthdate?: string;
  age?: number | string | null;
  dateSubmitted: string;
  status: string;
  landParcel: string;
  parcelArea?: string;
  parcelCount?: number;
  ownershipType: {
    registeredOwner: boolean;
    tenant: boolean;
    lessee: boolean;
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
}

interface UnplottedFarmerItem {
  id: string;
  farmerName: string;
  referenceNumber: string;
  barangay: string;
  totalParcels: number;
  plottedParcels: number;
  unplottedParcels: number;
}

const TechRsbsa: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [registeredOwners, setRegisteredOwners] = useState<RSBSARecord[]>([]);
  const [filteredOwners, setFilteredOwners] = useState<RSBSARecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isActive = (path: string) => location.pathname === path;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [selectedFarmer, setSelectedFarmer] = useState<FarmerDetail | null>(
    null,
  );
  const [loadingFarmerDetail, setLoadingFarmerDetail] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [unplottedFarmers, setUnplottedFarmers] = useState<
    UnplottedFarmerItem[]
  >([]);
  const [showUnplottedOnly, setShowUnplottedOnly] = useState<boolean>(() => {
    const params = new URLSearchParams(location.search);
    return params.get("unplotted") === "1";
  });

  const unplottedFarmerIdSet = React.useMemo(
    () => new Set(unplottedFarmers.map((farmer) => String(farmer.id))),
    [unplottedFarmers],
  );

  const unplottedProgressMap = React.useMemo(() => {
    const map = new Map<string, UnplottedFarmerItem>();
    unplottedFarmers.forEach((farmer) => {
      map.set(String(farmer.id), farmer);
    });
    return map;
  }, [unplottedFarmers]);

  const toggleMenu = (
    id: string,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    if (openMenuId === id) {
      setOpenMenuId(null);
      setMenuPosition(null);
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.right + window.scrollX - 160, // 160px is min-width of menu
      });
      setOpenMenuId(id);
    }
  };

  const closeMenu = () => {
    setOpenMenuId(null);
    setMenuPosition(null);
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

      // Reformat the farmer name from "Last, First, Middle, Ext" to "Last, First Middle Ext"
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

      const getValue = (...values: any[]): string => {
        for (const value of values) {
          if (value === null || value === undefined) continue;
          const text = String(value).trim();
          if (text) return text;
        }
        return "N/A";
      };

      const selectedRecord =
        summaryRecord ||
        registeredOwners.find((rec) => String(rec.id) === String(farmerId));

      const mappedParcels: ParcelDetail[] = parcelsData.map((p: any) => ({
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

      const parsedSubmissionDate = selectedRecord
        ? getSubmissionDate(selectedRecord)
        : null;

      const submittedDateLabel = parsedSubmissionDate
        ? parsedSubmissionDate.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : getValue(
            farmerData.dateSubmitted,
            (farmerData as any).date_submitted,
            (farmerData as any).submitted_at,
            (farmerData as any).created_at,
          );

      const farmerDetail: FarmerDetail = {
        id: farmerId,
        farmerName: reformattedFarmerName,
        referenceNumber: getValue(
          selectedRecord?.referenceNumber,
          farmerData.referenceNumber,
          data.referenceNumber,
          data.ffrsId,
          data.ffrs_id,
        ),
        dateSubmitted: submittedDateLabel,
        recordStatus: getValue(
          selectedRecord?.status,
          farmerData.status,
          data.status,
        ),
        farmerAddress: getValue(
          farmerData.farmerAddress,
          selectedRecord?.farmerAddress,
        ),
        age: calculateAge(data.dateOfBirth || data.birthdate || "N/A"),
        gender: getValue(data.gender, farmerData.gender),
        mainLivelihood: getValue(
          data.mainLivelihood,
          farmerData.mainLivelihood,
        ),
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

  // Fetch RSBSA records from Supabase
  const fetchRSBSARecords = async () => {
    try {
      setLoading(true);
      const [response, techDashboardResponse] = await Promise.all([
        getRsbsaSubmissions(),
        getTechDashboardData(),
      ]);

      if (response.error) {
        console.error("Error fetching RSBSA records:", response.error);
        setError("Failed to load registered land owners data");
        return;
      }

      const data = response.data || [];

      console.log(
        "Received RSBSA data from Supabase:",
        data?.length || 0,
        "records",
      );
      console.log("Sample record:", data?.[0]);

      // Automatically filter for registered owners only
      const registeredOwnersData = filterRegisteredOwners(data || []);
      setRegisteredOwners(registeredOwnersData);

      if (!techDashboardResponse.error) {
        const queue = Array.isArray(
          techDashboardResponse.data?.unplottedFarmers,
        )
          ? techDashboardResponse.data.unplottedFarmers
          : [];
        setUnplottedFarmers(
          queue.map((item: any) => ({
            id: String(item.id),
            farmerName: String(item.farmerName || "N/A"),
            referenceNumber: String(item.referenceNumber || "N/A"),
            barangay: String(item.barangay || "N/A"),
            totalParcels: Number(item.totalParcels || 0),
            plottedParcels: Number(item.plottedParcels || 0),
            unplottedParcels: Number(item.unplottedParcels || 0),
          })),
        );
      } else {
        setUnplottedFarmers([]);
      }

      setError(null);
    } catch (err: any) {
      console.error("Error fetching RSBSA records:", err);
      setError("Failed to load registered land owners data");
      setUnplottedFarmers([]);
    } finally {
      setLoading(false);
    }
  };

  // Function to filter registered owners only
  const filterRegisteredOwners = (records: RSBSARecord[]) => {
    console.log("Filtering records:", records.length);

    const filtered = records.filter((record: any) => {
      // Exclude farmers who have transferred ALL their parcels (no current ownership)
      // hasCurrentParcels: true = has current parcels, false = all transferred, undefined = no parcels yet
      if (record.hasCurrentParcels === false) {
        return false;
      }

      // Check if the record represents a registered owner
      if (record.ownershipType) {
        return record.ownershipType.registeredOwner === true;
      }

      return false;
    });

    console.log("Filtered results:", filtered.length, "out of", records.length);
    return filtered;
  };

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

  const getSubmissionDate = (record: RSBSARecord): Date | null => {
    const candidates = [
      record.dateSubmitted,
      (record as any).date_submitted,
      (record as any).submitted_at,
      (record as any).created_at,
      (record as any).createdAt,
    ];

    for (const rawValue of candidates) {
      if (!rawValue) continue;
      const parsedDate = new Date(rawValue);
      if (!Number.isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    }

    return null;
  };

  const sortedFilteredOwners = React.useMemo(() => {
    return [...filteredOwners].sort((a, b) => {
      const dateA = getSubmissionDate(a);
      const dateB = getSubmissionDate(b);

      // Keep records with missing dates at the bottom.
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;

      // Newest first.
      return dateB.getTime() - dateA.getTime();
    });
  }, [filteredOwners]);

  // Filter records based on search term and barangay
  useEffect(() => {
    const filtered = registeredOwners.filter((record) => {
      const isUnplotted = unplottedFarmerIdSet.has(String(record.id));

      if (showUnplottedOnly && !isUnplotted) {
        return false;
      }

      // Barangay filter
      if (selectedBarangay !== "all") {
        const barangay = record.farmerAddress?.split(",")[0]?.trim();
        if (barangay !== selectedBarangay) return false;
      }

      // Search term filter
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase();
        // Search in FFRS ID (both with and without dashes)
        const ffrsMatch =
          record.referenceNumber?.toLowerCase().includes(searchLower) ||
          record.referenceNumber
            ?.replace(/-/g, "")
            .toLowerCase()
            .includes(searchLower);

        // Search in farmer name
        const nameMatch = record.farmerName
          ?.toLowerCase()
          .includes(searchLower);

        // Search in farmer address
        const addressMatch = record.farmerAddress
          ?.toLowerCase()
          .includes(searchLower);

        // Search in farm location
        const locationMatch = record.farmLocation
          ?.toLowerCase()
          .includes(searchLower);

        // Search in gender
        const genderMatch = record.gender?.toLowerCase().includes(searchLower);

        if (
          !(
            ffrsMatch ||
            nameMatch ||
            addressMatch ||
            locationMatch ||
            genderMatch
          )
        ) {
          return false;
        }
      }

      return true;
    });

    setFilteredOwners(filtered);
  }, [
    searchTerm,
    selectedBarangay,
    registeredOwners,
    showUnplottedOnly,
    unplottedFarmerIdSet,
  ]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setShowUnplottedOnly(params.get("unplotted") === "1");
  }, [location.search]);

  // Load data on component mount
  useEffect(() => {
    fetchRSBSARecords();
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        openMenuId &&
        !(event.target as Element).closest(".tech-rsbsa-more-button") &&
        !(event.target as Element).closest(".tech-rsbsa-actions-menu")
      ) {
        closeMenu();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openMenuId]);

  const calculateAgeFromBirthdate = (birthdate?: string): number | null => {
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

  const getDisplayAge = (record: RSBSARecord): string => {
    if (
      record.age !== undefined &&
      record.age !== null &&
      String(record.age).trim() !== ""
    ) {
      return String(record.age);
    }

    const computedAge = calculateAgeFromBirthdate(record.birthdate);
    return computedAge !== null ? String(computedAge) : "N/A";
  };

  const getPlottingRatio = (record: RSBSARecord): string => {
    const progress = unplottedProgressMap.get(String(record.id));
    if (progress) {
      const total = Math.max(0, Number(progress.totalParcels || 0));
      const plotted = Math.min(
        total,
        Math.max(0, Number(progress.plottedParcels || 0)),
      );
      return total > 0 ? `${plotted}/${total}` : "0/0";
    }

    const parsedParcelCount = Number(record.parcelCount || 0);
    const totalFromRecord = Number.isFinite(parsedParcelCount)
      ? Math.max(0, parsedParcelCount)
      : 0;

    if (totalFromRecord > 0) {
      return `${totalFromRecord}/${totalFromRecord}`;
    }

    return "1/1";
  };

  return (
    <div className="tech-rsbsa-page-container">
      <div className="tech-rsbsa-page">
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

            <button
              className={`sidebar-nav-item ${isActive("/") ? "active" : ""}`}
              onClick={() => navigate("/")}
            >
              <span className="nav-icon">
                <img src={LogoutIcon} alt="Logout" />
              </span>
              <span className="nav-text">Logout</span>
            </button>
          </nav>
        </div>
        <div
          className={`tech-incent-sidebar-overlay ${sidebarOpen ? "active" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Sidebar ends here */}

        {/* Main content starts here */}
        <div className="tech-rsbsa-main-content">
          <div className="tech-incent-mobile-header">
            <button
              className="tech-incent-hamburger"
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <div className="tech-incent-mobile-title">RSBSA</div>
          </div>
          <div className="tech-rsbsa-dashboard-header">
            <div>
              <h2 className="tech-rsbsa-page-title">Registered Land Owners</h2>
              <p className="tech-rsbsa-page-subtitle">
                View and manage registered land owners from RSBSA submissions
              </p>
            </div>
          </div>

          <div className="tech-rsbsa-content-card">
            {loading ? (
              <div className="tech-rsbsa-loading-container">
                <p>Loading registered land owners...</p>
              </div>
            ) : error ? (
              <div className="tech-rsbsa-error-container">
                <p>Error: {error}</p>
                <button
                  onClick={fetchRSBSARecords}
                  className="tech-rsbsa-retry-button"
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                <div
                  className={`tech-rsbsa-unplotted-banner ${unplottedFarmers.length > 0 ? "has-items" : "all-clear"}`}
                >
                  <div className="tech-rsbsa-unplotted-banner-head">
                    {unplottedFarmers.length > 0 ? (
                      <>
                        <strong>{unplottedFarmers.length}</strong> parcel
                        {unplottedFarmers.length !== 1 ? "s" : ""} still need
                        plotting.
                      </>
                    ) : (
                      <>All farmers in queue are plotted.</>
                    )}
                  </div>
                </div>

                {/* Search and Filter Container */}
                <div className="tech-rsbsa-search-filter-container">
                  <div className="tech-rsbsa-search-container">
                    <input
                      type="text"
                      className="tech-rsbsa-search-input"
                      placeholder="Search by FFRS ID, Name, Address, Location, or Gender..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                      <button
                        className="tech-rsbsa-clear-search-button"
                        onClick={() => setSearchTerm("")}
                        title="Clear search"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div className="tech-rsbsa-filter-container">
                    <select
                      value={selectedBarangay}
                      onChange={(e) => setSelectedBarangay(e.target.value)}
                      className="tech-rsbsa-filter-select"
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

                <div className="tech-rsbsa-table-container">
                  <table className="tech-rsbsa-owners-table">
                    <thead>
                      <tr>
                        <th>FFRS ID</th>
                        <th>Last Name</th>
                        <th>First Name</th>
                        <th>Middle Name</th>
                        <th>EXT Name</th>
                        <th>Gender</th>
                        <th>Age</th>
                        <th>Farmer Address</th>
                        <th>Farm Location</th>
                        <th>Parcel Area</th>
                        <th>Plotted</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFilteredOwners.length === 0 ? (
                        <tr>
                          <td colSpan={12} className="tech-rsbsa-no-data">
                            {searchTerm
                              ? "No matching records found"
                              : "No registered owners found"}
                          </td>
                        </tr>
                      ) : (
                        sortedFilteredOwners.map((record) => {
                          const parcelArea = record.parcelArea
                            ? record.parcelArea.includes("hectares")
                              ? record.parcelArea
                              : `${record.parcelArea} hectares`
                            : "N/A";

                          return (
                            <tr
                              key={record.id}
                              onClick={() =>
                                fetchFarmerDetails(record.id, record)
                              }
                              style={{ cursor: "pointer" }}
                            >
                              <td
                                className="tech-rsbsa-ffrs-id"
                                title={record.referenceNumber || "N/A"}
                              >
                                <span className="tech-rsbsa-ffrs-id-value">
                                  {record.referenceNumber || "N/A"}
                                </span>
                              </td>
                              <td>{record.lastName || ""}</td>
                              <td>{record.firstName || ""}</td>
                              <td>{record.middleName || ""}</td>
                              <td>{record.extName || ""}</td>
                              <td>{record.gender || "N/A"}</td>
                              <td>{getDisplayAge(record)}</td>
                              <td>{record.farmerAddress || "N/A"}</td>
                              <td>{record.farmLocation || "N/A"}</td>
                              <td>{parcelArea}</td>
                              <td>
                                <span className="tech-rsbsa-plot-status-pill">
                                  {getPlottingRatio(record)}
                                </span>
                              </td>
                              <td onClick={(e) => e.stopPropagation()}>
                                <div
                                  style={{
                                    position: "relative",
                                    display: "inline-block",
                                  }}
                                >
                                  <button
                                    className="tech-rsbsa-more-button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleMenu(record.id, e);
                                    }}
                                    aria-haspopup="true"
                                    aria-expanded={openMenuId === record.id}
                                    title="More actions"
                                  >
                                    ...
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
              </>
            )}
          </div>
        </div>
        {/* Action Menu - rendered outside table */}
        {openMenuId && menuPosition && (
          <div
            className="tech-rsbsa-actions-menu"
            style={{
              position: "fixed",
              top: menuPosition.top,
              left: menuPosition.left,
            }}
          >
            <button
              onClick={() => {
                navigate(`/technician-pick-land-parcel/${openMenuId}`);
                closeMenu();
              }}
            >
              Land Parcel
            </button>
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
                <button
                  className="farmer-modal-close"
                  onClick={() => setShowModal(false)}
                >
                  ×
                </button>
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
                          {selectedFarmer.parcels.map((parcel) => (
                            <div
                              key={parcel.id}
                              className="farmer-modal-parcel-card"
                            >
                              <div className="farmer-modal-parcel-header">
                                <h4>Parcel #{parcel.parcelNumber}</h4>
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

export default TechRsbsa;
