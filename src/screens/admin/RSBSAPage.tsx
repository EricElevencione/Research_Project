import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  getFarmParcels,
  getRsbsaSubmissionById,
  getRsbsaSubmissions,
} from "../../api";
import { printRsbsaFormById } from "../../utils/rsbsaPrint";
import "../../assets/css/admin css/RSBSAStyle.css";
import "../../assets/css/jo css/FarmerDetailModal.css";
import "../../components/layout/sidebarStyle.css";
import Analytics from "./Analytics";
import LogoImage from "../../assets/images/Logo.png";
import HomeIcon from "../../assets/images/home.png";
import RSBSAIcon from "../../assets/images/rsbsa.png";
import ApproveIcon from "../../assets/images/approve.png";
import LogoutIcon from "../../assets/images/logout.png";
import IncentivesIcon from "../../assets/images/incentives.png";

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

interface FarmerDetail {
  id: string;
  farmerName: string;
  farmerAddress: string;
  age: number | string;
  gender: string;
  mainLivelihood: string;
  farmingActivities: string[];
  parcels: ParcelDetail[];
}

interface RSBSARecord {
  id: string;
  referenceNumber: string;
  farmerName: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  extName?: string;
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

const RsbsaAdminPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [activePage, setActivePage] = useState<"farmers" | "analytics">(
    "farmers",
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rsbsaRecords, setRsbsaRecords] = useState<RSBSARecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFarmer, setSelectedFarmer] = useState<FarmerDetail | null>(
    null,
  );
  const [loadingFarmerDetail, setLoadingFarmerDetail] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isModalPrinting, setIsModalPrinting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [barangayFilter, setBarangayFilter] = useState<string>("all");
  const [printingRecordId, setPrintingRecordId] = useState<string | null>(null);

  const isActive = (path: string) => location.pathname === path;

  const filterRegisteredOwners = (records: RSBSARecord[]) => {
    return records.filter(
      (record) => record.ownershipType?.registeredOwner === true,
    );
  };

  const getRecordBarangay = (record: RSBSARecord) => {
    const rawLocation = String(record.farmLocation || "").trim();
    if (!rawLocation) return "N/A";
    const [firstSegment] = rawLocation.split(",");
    return firstSegment?.trim() || "N/A";
  };

  const getNumericFarmArea = (record: RSBSARecord) => {
    const totalArea =
      typeof record.totalFarmArea === "number"
        ? record.totalFarmArea
        : parseFloat(String(record.totalFarmArea || 0));

    if (!isNaN(totalArea) && totalArea > 0) return totalArea;

    const parcelArea = parseFloat(String(record.parcelArea || 0));
    return !isNaN(parcelArea) && parcelArea > 0 ? parcelArea : 0;
  };

  const ownershipFilteredRecords = useMemo(
    () => filterRegisteredOwners(rsbsaRecords),
    [rsbsaRecords],
  );

  const barangayOptions = useMemo(() => {
    return Array.from(
      new Set(
        ownershipFilteredRecords.map((record) => getRecordBarangay(record)),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [ownershipFilteredRecords]);

  const visibleRecords = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = ownershipFilteredRecords.filter((record) => {
      if (barangayFilter !== "all") {
        const recordBarangay = getRecordBarangay(record);
        if (recordBarangay !== barangayFilter) return false;
      }

      if (!query) return true;

      const haystack = [
        record.farmerName,
        record.referenceNumber,
        record.farmerAddress,
        record.farmLocation,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });

    return filtered.sort((a, b) => {
      const dateA = new Date(a.dateSubmitted || 0).getTime();
      const dateB = new Date(b.dateSubmitted || 0).getTime();
      return dateB - dateA;
    });
  }, [barangayFilter, ownershipFilteredRecords, searchQuery]);

  const summaryStats = useMemo(() => {
    const totalParcels = visibleRecords.reduce((sum, record) => {
      return sum + (Number(record.parcelCount) || 0);
    }, 0);

    const totalFarmArea = visibleRecords.reduce(
      (sum, record) => sum + getNumericFarmArea(record),
      0,
    );

    const latestSubmissionDate = visibleRecords.reduce<number>(
      (latest, record) => {
        const submitted = new Date(record.dateSubmitted || 0).getTime();
        return submitted > latest ? submitted : latest;
      },
      0,
    );

    return {
      totalFarmers: visibleRecords.length,
      totalParcels,
      totalFarmArea,
      latestSubmissionDate,
    };
  }, [visibleRecords]);

  const fetchRSBSARecords = async () => {
    try {
      setLoading(true);
      const response = await getRsbsaSubmissions();
      if (response.error) throw new Error(response.error);

      const data = (response.data || []) as RSBSARecord[];
      setRsbsaRecords(data);

      setError(null);
    } catch (err: any) {
      console.error("Error fetching RSBSA records:", err);
      setError("Failed to load RSBSA farmer submissions");
    } finally {
      setLoading(false);
    }
  };

  const fetchFarmerDetails = async (farmerId: string) => {
    try {
      setLoadingFarmerDetail(true);

      const farmerResponse = await getRsbsaSubmissionById(farmerId);
      if (farmerResponse.error)
        throw new Error("Failed to fetch farmer details");
      const farmerData = farmerResponse.data;

      const parcelsResponse = await getFarmParcels(farmerId);
      if (parcelsResponse.error) throw new Error("Failed to fetch parcels");
      const parcelsData = parcelsResponse.data || [];

      const data = (farmerData as any).data || farmerData;

      const activities: string[] = [];
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
      if (activities.length === 0 && data.mainLivelihood)
        activities.push(data.mainLivelihood);

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

      const backendName = (farmerData as any).farmerName || "";
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
              farmLocationBarangay: locationParts[0] || data.barangay || "N/A",
              farmLocationMunicipality:
                locationParts[1] || data.municipality || "Dumangas",
              totalFarmAreaHa: submissionParcelArea,
              ownershipTypeRegisteredOwner:
                submissionOwnership.registeredOwner || false,
              ownershipTypeTenant: submissionOwnership.tenant || false,
              ownershipTypeLessee: submissionOwnership.lessee || false,
              tenantLandOwnerName: "",
              lesseeLandOwnerName: "",
            },
          ];
        }
      }

      setSelectedFarmer({
        id: farmerId,
        farmerName: reformattedFarmerName,
        farmerAddress: (farmerData as any).farmerAddress || "N/A",
        age: calculateAge(data.dateOfBirth || data.birthdate || "N/A"),
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

  useEffect(() => {
    fetchRSBSARecords();
  }, []);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const getNameParts = (record: RSBSARecord) => {
    const explicitLastName = (record.lastName || "").trim();
    const explicitFirstName = (record.firstName || "").trim();
    const explicitMiddleName = (record.middleName || "").trim();
    const explicitExtName = (record.extName || "").trim();

    if (
      explicitLastName ||
      explicitFirstName ||
      explicitMiddleName ||
      explicitExtName
    ) {
      return {
        lastName: explicitLastName,
        firstName: explicitFirstName,
        middleName: explicitMiddleName,
        extName: explicitExtName,
      };
    }

    const fullName = (record.farmerName || "").trim();
    if (!fullName) {
      return {
        lastName: "",
        firstName: "",
        middleName: "",
        extName: "",
      };
    }

    const [rawLastName, ...remainingParts] = fullName.split(",");
    const lastName = (rawLastName || "").trim();
    const remainingName = remainingParts.join(" ").trim();
    const tokens = remainingName
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);

    if (tokens.length === 0) {
      return {
        lastName,
        firstName: "",
        middleName: "",
        extName: "",
      };
    }

    const extPattern = /^(Jr\.?|Sr\.?|I|II|III|IV|V)$/i;
    const hasExt = extPattern.test(tokens[tokens.length - 1]);

    return {
      lastName,
      firstName: tokens[0] || "",
      middleName: tokens.slice(1, hasExt ? -1 : undefined).join(" "),
      extName: hasExt ? tokens[tokens.length - 1] : "",
    };
  };

  const handleModalPrint = async () => {
    if (!selectedFarmer) return;

    setIsModalPrinting(true);
    const selectedRecord = rsbsaRecords.find(
      (record) => String(record.id) === String(selectedFarmer.id),
    );

    const result = await printRsbsaFormById({
      farmerId: selectedFarmer.id,
      fallbackReferenceNumber: selectedRecord?.referenceNumber,
      fallbackFarmerName: selectedFarmer.farmerName,
    });

    setIsModalPrinting(false);

    if (!result.success && !result.cancelled) {
      alert(result.error || "Failed to print the RSBSA form.");
    }
  };

  const handleRowPrint = async (record: RSBSARecord) => {
    setPrintingRecordId(record.id);

    const result = await printRsbsaFormById({
      farmerId: record.id,
      fallbackReferenceNumber: record.referenceNumber,
      fallbackFarmerName: record.farmerName,
    });

    setPrintingRecordId(null);

    if (!result.success && !result.cancelled) {
      alert(result.error || "Failed to print the RSBSA form.");
    }
  };

  return (
    <div className="rsbsa-admin-page-container">
      <div className="rsbsa-admin-page">
        <div className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
          <nav className="sidebar-nav">
            <div className="sidebar-logo">
              <img src={LogoImage} alt="Logo" />
            </div>

            <button
              className={`sidebar-nav-item ${isActive("/dashboard") ? "active" : ""}`}
              onClick={() => navigate("/dashboard")}
            >
              <span className="nav-icon">
                <img src={HomeIcon} alt="Home" />
              </span>
              <span className="nav-text">Home</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/rsbsa") ? "active" : ""}`}
              onClick={() => navigate("/rsbsa")}
            >
              <span className="nav-icon">
                <img src={RSBSAIcon} alt="RSBSA" />
              </span>
              <span className="nav-text">RSBSA</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/audit-trail") ? "active" : ""}`}
              onClick={() => navigate("/audit-trail")}
            >
              <span className="nav-icon">📋</span>
              <span className="nav-text">Audit Trail</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/incentives") ? "active" : ""}`}
              onClick={() => navigate("/incentives")}
            >
              <span className="nav-icon">
                <img src={IncentivesIcon} alt="Incentives" />
              </span>
              <span className="nav-text">Subsidy</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/masterlist") ? "active" : ""}`}
              onClick={() => navigate("/masterlist")}
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

        <div className="rsbsa-admin-main-content">
          <div className="tech-incent-mobile-header">
            <button
              className="tech-incent-hamburger"
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              ☰
            </button>
            <div className="tech-incent-mobile-title">RSBSA Admin</div>
          </div>

          <h2 className="rsbsa-admin-page-title">RSBSA Admin</h2>
          <div className="rsbsa-admin-page-subtitle">
            Monitor and manage farmer RSBSA submissions
          </div>

          <div className="rsbsa-tab-toggle">
            <button
              className={`rsbsa-tab-btn ${activePage === "farmers" ? "active" : ""}`}
              onClick={() => setActivePage("farmers")}
            >
              Farmers
            </button>
            <button
              className={`rsbsa-tab-btn ${activePage === "analytics" ? "active" : ""}`}
              onClick={() => setActivePage("analytics")}
            >
              Analytics
            </button>
          </div>

          {activePage === "farmers" && (
            <div className="rsbsa-admin-content-card">
              {!loading && !error && (
                <>
                  <div className="rsbsa-admin-kpi-grid">
                    <div className="rsbsa-admin-kpi-card">
                      <span className="rsbsa-admin-kpi-label">Farmers</span>
                      <span className="rsbsa-admin-kpi-value">
                        {summaryStats.totalFarmers}
                      </span>
                    </div>
                    <div className="rsbsa-admin-kpi-card">
                      <span className="rsbsa-admin-kpi-label">Parcels</span>
                      <span className="rsbsa-admin-kpi-value">
                        {summaryStats.totalParcels}
                      </span>
                    </div>
                    <div className="rsbsa-admin-kpi-card">
                      <span className="rsbsa-admin-kpi-label">Farm Area</span>
                      <span className="rsbsa-admin-kpi-value">
                        {summaryStats.totalFarmArea.toFixed(2)} ha
                      </span>
                    </div>
                    <div className="rsbsa-admin-kpi-card">
                      <span className="rsbsa-admin-kpi-label">Last Submit</span>
                      <span className="rsbsa-admin-kpi-value rsbsa-admin-kpi-date">
                        {summaryStats.latestSubmissionDate
                          ? new Date(
                              summaryStats.latestSubmissionDate,
                            ).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "N/A"}
                      </span>
                    </div>
                  </div>

                  <div className="rsbsa-admin-filters-row">
                    <input
                      type="text"
                      placeholder="Search name, reference, address, or location..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="rsbsa-admin-filter-input"
                    />
                    <select
                      value={barangayFilter}
                      onChange={(e) => setBarangayFilter(e.target.value)}
                      className="rsbsa-admin-filter-input"
                    >
                      <option value="all">All Barangays</option>
                      {barangayOptions.map((barangay) => (
                        <option key={barangay} value={barangay}>
                          {barangay}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rsbsa-admin-table-meta">
                    Showing {visibleRecords.length} of{" "}
                    {ownershipFilteredRecords.length} records
                  </div>
                </>
              )}

              {loading ? (
                <div className="rsbsa-admin-loading-container">
                  <p>Loading farmer submissions...</p>
                </div>
              ) : error ? (
                <div className="rsbsa-admin-error-container">
                  <p>Error: {error}</p>
                  <button
                    onClick={fetchRSBSARecords}
                    className="rsbsa-admin-retry-button"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div className="rsbsa-admin-table-container">
                  <table className="rsbsa-admin-owners-table">
                    <thead>
                      <tr>
                        <th>Last Name</th>
                        <th>First Name</th>
                        <th>Middle Name</th>
                        <th>EXT Name</th>
                        <th>Gender</th>
                        <th>Birthdate</th>
                        <th>Farmer Address</th>
                        <th>Number of Parcels</th>
                        <th>Total Farm Area</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRecords.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="rsbsa-admin-no-data">
                            No farmer submissions found for the selected filters
                          </td>
                        </tr>
                      ) : (
                        visibleRecords.map((record) => {
                          const { lastName, firstName, middleName, extName } =
                            getNameParts(record);
                          const area = getNumericFarmArea(record);

                          return (
                            <tr
                              key={record.id}
                              onClick={() => fetchFarmerDetails(record.id)}
                            >
                              <td>{lastName}</td>
                              <td>{firstName}</td>
                              <td>{middleName || "N/A"}</td>
                              <td>{extName}</td>
                              <td>{record.gender || "N/A"}</td>
                              <td>
                                {record.birthdate
                                  ? formatDate(record.birthdate)
                                  : "N/A"}
                              </td>
                              <td>{record.farmerAddress || "N/A"}</td>
                              <td>{record.parcelCount || 0}</td>
                              <td>
                                {!isNaN(area) && area > 0
                                  ? `${area.toFixed(2)} ha`
                                  : "N/A"}
                              </td>
                              <td>
                                <div className="rsbsa-admin-row-actions">
                                  <button
                                    className="rsbsa-admin-row-action-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      fetchFarmerDetails(record.id);
                                    }}
                                  >
                                    View
                                  </button>
                                  <button
                                    className="rsbsa-admin-row-action-btn print"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRowPrint(record);
                                    }}
                                    disabled={printingRecordId === record.id}
                                  >
                                    {printingRecordId === record.id
                                      ? "Printing..."
                                      : "Print"}
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
          )}

          {activePage === "analytics" && (
            <Analytics
              rsbsaRecords={rsbsaRecords}
              loading={loading}
              error={error}
            />
          )}
        </div>
      </div>

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
                      Personal Information
                    </h3>
                    <div className="farmer-modal-info-grid">
                      <div className="farmer-modal-info-item">
                        <span className="farmer-modal-label">Farmer Name:</span>
                        <span className="farmer-modal-value">
                          {selectedFarmer?.farmerName}
                        </span>
                      </div>
                      <div className="farmer-modal-info-item">
                        <span className="farmer-modal-label">
                          Farmer Address:
                        </span>
                        <span className="farmer-modal-value">
                          {selectedFarmer?.farmerAddress}
                        </span>
                      </div>
                      <div className="farmer-modal-info-item">
                        <span className="farmer-modal-label">Age:</span>
                        <span className="farmer-modal-value">
                          {typeof selectedFarmer?.age === "number"
                            ? `${selectedFarmer.age} years old`
                            : selectedFarmer?.age}
                        </span>
                      </div>
                      <div className="farmer-modal-info-item">
                        <span className="farmer-modal-label">Gender:</span>
                        <span className="farmer-modal-value">
                          {selectedFarmer?.gender}
                        </span>
                      </div>
                      <div className="farmer-modal-info-item farmer-modal-full-width">
                        <span className="farmer-modal-label">
                          Main Livelihood:
                        </span>
                        <span className="farmer-modal-value">
                          {(selectedFarmer?.farmingActivities?.length || 0) > 0
                            ? selectedFarmer?.farmingActivities.join(", ")
                            : "Not Available"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="farmer-modal-section">
                    <h3 className="farmer-modal-section-title">
                      Farm Information
                    </h3>
                    {(selectedFarmer?.parcels?.length || 0) === 0 ? (
                      <p className="farmer-modal-no-data">No parcels found</p>
                    ) : (
                      <div className="farmer-modal-parcels-container">
                        {(selectedFarmer?.parcels || []).map(
                          (parcel, index) => {
                            const pNum = parcel.parcelNumber;
                            const displayNum =
                              !pNum || pNum === "N/A" || !/^\d+$/.test(pNum)
                                ? index + 1
                                : pNum;
                            return (
                              <div
                                key={parcel.id}
                                className="farmer-modal-parcel-card"
                              >
                                <div className="farmer-modal-parcel-header">
                                  <h4>Parcel #{displayNum}</h4>
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
                          },
                        )}
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
  );
};

export default RsbsaAdminPage;
