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
import "../../assets/css/technician css/TechMasterlistStyle.css";
import "../../assets/css/technician css/TechTenantRegistry.css";
import "../../assets/css/jo css/FarmerDetailModal.css";
import { supabase } from "../../supabase";
import TechSidebar from "../../components/layout/TechSidebar";

interface TenantRecord {
  id: string;
  referenceNumber: string;
  tenantName: string;
  tenantAddress: string;
  farmLocation: string;
  parcelArea: string;
  dateSubmitted: string;
  status: string;
  landParcel: string;
  completeness: number;
  landOwnerId?: string;
  landOwnerName?: string;
  tenantLandOwnerName?: string;
}

interface TenantGroup {
  landOwnerId: string;
  landOwnerName: string;
  landOwnerRefNumber?: string;
  landOwnerLocation?: string;
  landOwnerDate?: string;
  tenants: TenantRecord[];
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

const TechTenantRegistry: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tenantGroups, setTenantGroups] = useState<TenantGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(),
  );
  const [selectedFarmer, setSelectedFarmer] = useState<FarmerDetail | null>(
    null,
  );
  const [loadingFarmerDetail, setLoadingFarmerDetail] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isModalPrinting, setIsModalPrinting] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    firstName: string;
    lastName: string;
  } | null>(null);

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusChangeTarget, setStatusChangeTarget] = useState<{
    id: string;
    newStatus: string;
    farmerName?: string;
  } | null>(null);
  const [statusModalParcels, setStatusModalParcels] = useState<any[]>([]);
  const [statusModalLoading, setStatusModalLoading] = useState(false);
  const [statusChangeReason, setStatusChangeReason] = useState("");

  const [updateNotification, setUpdateNotification] = useState<{
    show: boolean;
    type: "success" | "error";
    message: string;
  }>({
    show: false,
    type: "success",
    message: "",
  });

  const showUpdateNotification = (
    message: string,
    type: "success" | "error",
  ) => {
    setUpdateNotification({ show: true, type, message });
    setTimeout(() => {
      setUpdateNotification((prev) => ({ ...prev, show: false }));
    }, 3200);
  };

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    fetchTenantRecords();
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

  const fetchTenantRecords = async () => {
    try {
      setLoading(true);
      const response = await getRsbsaSubmissions();
      if (response.error) throw new Error("Failed to fetch records");

      const allRecords: any[] = response.data || [];

      // Fetch parcels in parallel for all records at once
      const parcelPromises = allRecords.map((record) =>
        getFarmParcels(record.id).catch((err) => {
          console.error(`Error fetching parcels for ${record.id}:`, err);
          return { error: err, data: [] };
        })
      );

      const allParcelsResponses = await Promise.all(parcelPromises);

      // Filter for tenant records only and organize by landowner
      const tenantsByOwner: { [key: string]: TenantGroup } = {};

      // Process records with their parcels
      for (let i = 0; i < allRecords.length; i++) {
        const record = allRecords[i];
        const parcelsResponse = allParcelsResponses[i];

        if (parcelsResponse.error) {
          console.warn(`No parcels found for record ${record.id}`);
          continue;
        }

        const parcels: any[] = parcelsResponse.data || [];

        // Check if this farmer has any tenant parcels
        const hasTenantParcel = parcels.some((p) => p.ownership_type_tenant);

        if (hasTenantParcel) {
          // Get landowner info from parcels
          const tenantParcel = parcels.find((p) => p.ownership_type_tenant);
          const landOwnerName = tenantParcel?.tenant_land_owner_name || "";
          const landOwnerId = tenantParcel?.tenant_land_owner_id || landOwnerName;

          if (!tenantsByOwner[landOwnerId]) {
            // Try to find the landowner's own record to get their reference number
            const ownerRecord = allRecords.find(r => r.id === landOwnerId || (r.FFRS_CODE && r.FFRS_CODE === landOwnerId));

            tenantsByOwner[landOwnerId] = {
              landOwnerId,
              landOwnerName,
              landOwnerRefNumber: ownerRecord?.FFRS_CODE || ownerRecord?.["FFRS_CODE"] || "",
              landOwnerLocation: ownerRecord?.farmLocation || ownerRecord?.farmerAddress || "—",
              landOwnerDate: ownerRecord?.dateSubmitted || "",
              tenants: [],
            };
          }

          tenantsByOwner[landOwnerId].tenants.push({
            id: record.id,
            referenceNumber: record.referenceNumber || "",
            tenantName: record.farmerName || "",
            tenantAddress: record.farmerAddress || "",
            farmLocation: tenantParcel?.farm_location_barangay || "",
            parcelArea: (tenantParcel?.total_farm_area_ha || 0).toString(),
            dateSubmitted: record.dateSubmitted || new Date().toISOString(),
            status: record.status || "pending",
            landParcel: tenantParcel?.parcel_number || "",
            completeness: calculateCompleteness(record),
            landOwnerId,
            landOwnerName,
            tenantLandOwnerName: landOwnerName,
          });
        }
      }

      const groupsArray = Object.values(tenantsByOwner);
      setTenantGroups(groupsArray);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching tenant records:", err);
      setError(err.message || "Failed to load tenant records");
    } finally {
      setLoading(false);
    }
  };

  const calculateCompleteness = (record: any): number => {
    let filled = 0;
    const fields = [
      "farmerName",
      "farmerAddress",
      "dateSubmitted",
      "status",
      "gender",
      "birthdate",
      "mainLivelihood",
    ];

    fields.forEach((field) => {
      if (record[field] && record[field] !== "N/A" && record[field] !== "—") {
        filled++;
      }
    });

    return Math.round((filled / fields.length) * 100);
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
      const parcelsData = parcelsResponse.data;

      const data = farmerData.data || farmerData;

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

      setSelectedFarmer({
        id: farmerId,
        farmerName: data.farmerName || "N/A",
        referenceNumber: data.referenceNumber || "N/A",
        dateSubmitted: data.dateSubmitted || "N/A",
        recordStatus: data.recordStatus || data.status || "pending",
        farmerAddress: data.farmerAddress || "N/A",
        age: calculateAge(data.birthdate),
        gender: data.gender || "N/A",
        mainLivelihood: data.mainLivelihood || "N/A",
        farmingActivities: activities,
        parcels: mappedParcels,
      });
      setShowModal(true);
      setLoadingFarmerDetail(false);
    } catch (err) {
      console.error("Error fetching farmer details:", err);
      setLoadingFarmerDetail(false);
    }
  };

  const filteredGroups = tenantGroups
    .map((group) => ({
      ...group,
      tenants: group.tenants.filter((tenant) => {
        const q = searchQuery.toLowerCase();
        return (
          tenant.tenantName.toLowerCase().includes(q) ||
          tenant.referenceNumber.toLowerCase().includes(q) ||
          (tenant.landOwnerName?.toLowerCase() || "").includes(q) ||
          tenant.farmLocation.toLowerCase().includes(q)
        );
      }),
    }))
    .filter((group) => group.tenants.length > 0);

  const toggleGroup = (landOwnerId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(landOwnerId)) {
      newExpanded.delete(landOwnerId);
    } else {
      newExpanded.add(landOwnerId);
    }
    setExpandedGroups(newExpanded);
  };

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

  const openStatusModal = async (tenant: TenantRecord) => {
    setStatusChangeTarget({
      id: tenant.id,
      newStatus: tenant.status === "Active Farmer" ? "Not Active" : "Active Farmer",
      farmerName: tenant.tenantName,
    });
    setStatusChangeReason("");
    setStatusModalLoading(true);
    setShowStatusModal(true);

    try {
      const parcelsResponse = await getFarmParcels(tenant.id);
      const parcelsData = parcelsResponse.data || [];
      setStatusModalParcels(parcelsData);
    } catch (err) {
      showUpdateNotification("Failed to load parcels.", "error");
      setShowStatusModal(false);
    } finally {
      setStatusModalLoading(false);
    }
  };

  const confirmStatusChange = async () => {
    if (!statusChangeTarget) return;
    if (!statusChangeReason.trim()) {
      showUpdateNotification("Please provide a reason.", "error");
      return;
    }

    try {
      const isNowActive = statusChangeTarget.newStatus === "Active Farmer";

      for (const parcel of statusModalParcels) {
        await updateFarmParcel(parcel.id, {
          is_cultivating: isNowActive,
          cultivation_status_reason: isNowActive ? null : statusChangeReason.trim(),
          cultivation_status_updated_at: new Date().toISOString(),
        });
      }

      const newFarmerStatus = statusChangeTarget.newStatus;

      await updateRsbsaSubmission(statusChangeTarget.id, {
        status: newFarmerStatus,
        statusChangeReason: statusChangeReason.trim(),
      });

      showUpdateNotification(`Tenant marked as ${newFarmerStatus}.`, "success");

      // Refresh the table to reflect new status
      fetchTenantRecords();
    } catch (err: any) {
      showUpdateNotification(`Failed to update: ${err.message}`, "error");
    } finally {
      setShowStatusModal(false);
      setStatusChangeTarget(null);
      setStatusModalParcels([]);
      setStatusChangeReason("");
    }
  };

  const handlePrintModal = async () => {
    if (!selectedFarmer) return;

    try {
      setIsModalPrinting(true);
      const result = await printRsbsaFormById({
        farmerId: selectedFarmer.id,
        fallbackReferenceNumber: selectedFarmer.referenceNumber,
        fallbackFarmerName: selectedFarmer.farmerName
      });

      if (!result.success) {
        alert("Error printing: " + (result.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Error printing:", err);
      alert("Error printing: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsModalPrinting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("isAuthenticated");
    navigate("/login");
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <div className="loader">Loading farmer registry...</div>
      </div>
    );
  }

  return (
    <div className="tech-masterlist-page-container">
      <div className="tech-masterlist-page">
        {/* Sidebar */}
        <TechSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />



        {/* Main content */}
        <div className="tech-masterlist-main-content" style={{ height: '100vh', overflowY: 'auto' }}>
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
            <div className="tech-incent-mobile-title">Farmer Registry</div>
          </div>

          <div className="tech-masterlist-dashboard-header">
            <div>
              <h2 className="tech-masterlist-page-title">Farmer Registry</h2>
              <p className="tech-masterlist-page-subtitle">
                Manage hierarchical relationship between landowners and their tenants
              </p>
            </div>
          </div>

          <div className="tech-masterlist-filters-section">
            <div className="tech-masterlist-search-filter">
              <input
                type="text"
                className="tech-masterlist-search-input"
                placeholder="Search tenant or landowner..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="error-message">
              Error: {error}
            </div>
          )}

          <div className="tech-masterlist-content-card">
            {filteredGroups.length === 0 ? (
              <div className="no-records-message">
                <p>No tenant records found.</p>
              </div>
            ) : (
              <div className="tenant-table-container">
                <table className="hierarchical-table">
                  <thead>
                    <tr>
                      <th>Landowner / Tenant Name</th>
                      <th>Reference No.</th>
                      <th>Parcel / Area</th>
                      <th>Location</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGroups.map((group) => (
                      <React.Fragment key={group.landOwnerId}>
                        {/* Parent Row */}
                        <tr
                          className={`parent-row ${expandedGroups.has(group.landOwnerId) ? "expanded" : ""}`}
                          onClick={() => toggleGroup(group.landOwnerId)}
                        >
                          <td>
                            <div className="landowner-info">
                              <span className="expand-icon">▶</span>
                              <span className="landowner-name">{group.landOwnerName}</span>
                              <span className="tenant-count-badge">
                                {group.tenants.length} {group.tenants.length === 1 ? "Tenant" : "Tenants"}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className="tenant-ref">{group.landOwnerRefNumber || "—"}</span>
                          </td>
                          <td>—</td>
                          <td>
                            <span className="location-text">{group.landOwnerLocation || "—"}</span>
                          </td>
                          <td>
                            <span className="date-text">{formatDate(group.landOwnerDate || "")}</span>
                          </td>
                          <td>—</td>
                          <td>—</td>
                        </tr>

                        {/* Child Rows (Tenants) */}
                        {expandedGroups.has(group.landOwnerId) &&
                          group.tenants.map((tenant, idx) => (
                            <tr key={`${group.landOwnerId}-tenant-${idx}`} className="child-row">
                              <td>
                                <span className="tenant-name">{tenant.tenantName}</span>
                                <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px" }}>
                                  {tenant.tenantAddress}
                                </div>
                              </td>
                              <td>
                                <span className="tenant-ref">{tenant.referenceNumber}</span>
                              </td>
                              <td>
                                <span className="area-val">{parseFloat(tenant.parcelArea).toFixed(2)} Ha</span>
                                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                                  Parcel: {tenant.landParcel}
                                </div>
                              </td>
                              <td>
                                <span className="location-text">{tenant.farmLocation}</span>
                              </td>
                              <td>
                                <span className="date-text">{formatDate(tenant.dateSubmitted)}</span>
                              </td>
                              <td>
                                <button
                                  className={`tech-masterlist-status-button tech-masterlist-${getStatusClass(tenant.status)}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openStatusModal(tenant);
                                  }}
                                >
                                  {tenant.status}
                                </button>
                              </td>
                              <td>
                                <button
                                  className="view-action-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    fetchFarmerDetails(tenant.id);
                                  }}
                                  disabled={loadingFarmerDetail}
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
                Tenant:{" "}
                <strong>
                  {statusChangeTarget.farmerName ?? "—"}
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
                disabled={statusModalLoading}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Farmer Detail Modal */}
      {showModal && selectedFarmer && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Tenant Details</h2>
              <button
                className="modal-close"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-section">
                <h3>Personal Information</h3>
                <div className="detail-row">
                  <span className="detail-label">Name:</span>
                  <span className="detail-value">{selectedFarmer.farmerName}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Reference Number:</span>
                  <span className="detail-value">
                    {selectedFarmer.referenceNumber}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Age:</span>
                  <span className="detail-value">{selectedFarmer.age}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Gender:</span>
                  <span className="detail-value">{selectedFarmer.gender}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Address:</span>
                  <span className="detail-value">
                    {selectedFarmer.farmerAddress}
                  </span>
                </div>
              </div>

              <div className="detail-section">
                <h3>Farm Information</h3>
                {selectedFarmer.parcels && selectedFarmer.parcels.length > 0 ? (
                  selectedFarmer.parcels.map((parcel, idx) => (
                    <div key={idx} className="parcel-info">
                      <div className="detail-row">
                        <span className="detail-label">Parcel Number:</span>
                        <span className="detail-value">
                          {parcel.parcelNumber}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">
                          Farm Location (Barangay):
                        </span>
                        <span className="detail-value">
                          {parcel.farmLocationBarangay}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">
                          Farm Location (Municipality):
                        </span>
                        <span className="detail-value">
                          {parcel.farmLocationMunicipality}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Total Farm Area:</span>
                        <span className="detail-value">
                          {parcel.totalFarmAreaHa} Ha
                        </span>
                      </div>
                      {parcel.tenantLandOwnerName && (
                        <div className="detail-row">
                          <span className="detail-label">Landowner:</span>
                          <span className="detail-value">
                            {parcel.tenantLandOwnerName}
                          </span>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p>No farm parcels found</p>
                )}
              </div>

              <div className="detail-section">
                <h3>Record Information</h3>
                <div className="detail-row">
                  <span className="detail-label">Status:</span>
                  <span className="detail-value">{selectedFarmer.recordStatus}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Date Submitted:</span>
                  <span className="detail-value">
                    {formatDate(selectedFarmer.dateSubmitted)}
                  </span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="modal-btn print-btn"
                onClick={handlePrintModal}
                disabled={isModalPrinting}
              >
                {isModalPrinting ? "Printing..." : "Print"}
              </button>
              <button
                className="modal-btn close-btn"
                onClick={() => setShowModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TechTenantRegistry;
