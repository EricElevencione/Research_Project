import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getAllocations,
  getFarmerRequests,
  updateFarmerRequest,
  deleteFarmerRequest,
  createDistributionRecord,
} from "../../api";
import {
  FERTILIZER_FIELD_MAPS,
  SEED_FIELD_MAPS,
} from "../../constants/shortageFieldMaps";
import "../../assets/css/admin css/AdminManageRequest.css";
import "../../components/layout/sidebarStyle.css";
import AdminSidebar from "../../components/layout/AdminSidebar";

// ─── Main Component ────────────────────────────────────────

interface FarmerRequest {
  id: number;
  season: string;
  request_date: string;
  farmer_id: number;
  farmer_name: string;
  barangay: string;
  farm_area_ha: number;
  requested_urea_bags: number;
  requested_complete_14_bags: number;
  requested_ammonium_sulfate_bags: number;
  requested_muriate_potash_bags: number;
  requested_jackpot_kg: number;
  requested_us88_kg: number;
  requested_th82_kg: number;
  requested_rh9000_kg: number;
  requested_lumping143_kg: number;
  requested_lp296_kg: number;
  status: string;
  notes?: string;
  request_notes: string;
  created_at: string;
}

interface AllocationDetails {
  id: number;
  season: string;
  allocation_date: string;
  urea_46_0_0_bags: number;
  complete_14_14_14_bags: number;
  ammonium_sulfate_21_0_0_bags: number;
  muriate_potash_0_0_60_bags: number;
  jackpot_kg: number;
  us88_kg: number;
  th82_kg: number;
  rh9000_kg: number;
  lumping143_kg: number;
  lp296_kg: number;
}

const ManageRequests: React.FC = () => {
  const navigate = useNavigate();
  const { allocationId } = useParams<{ allocationId: string }>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [allocation, setAllocation] = useState<AllocationDetails | null>(null);
  const [requests, setRequests] = useState<FarmerRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<FarmerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [barangayFilter, setBarangayFilter] = useState<string>("all");

  // Edit Feature
  const [editingRequest, setEditingRequest] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<FarmerRequest>>({});



  const normalizeStatus = (status: string | null | undefined) =>
    String(status ?? "")
      .trim()
      .toLowerCase();
  const hasStatus = (
    request: Pick<FarmerRequest, "status">,
    ...statuses: string[]
  ) => statuses.includes(normalizeStatus(request.status));
  const getFertilizerTotal = (requestList: FarmerRequest[]) =>
    requestList.reduce((sum, r) => {
      return (
        sum +
        FERTILIZER_FIELD_MAPS.reduce((innerSum, map) => {
          return innerSum + (Number((r as any)[map.requestField]) || 0);
        }, 0)
      );
    }, 0);

  const getSeedTotal = (requestList: FarmerRequest[]) =>
    requestList.reduce((sum, r) => {
      return (
        sum +
        SEED_FIELD_MAPS.reduce((innerSum, map) => {
          return innerSum + (Number((r as any)[map.requestField]) || 0);
        }, 0)
      );
    }, 0);
  const approvedRequests = useMemo(
    () => requests.filter((r) => hasStatus(r, "approved")),
    [requests],
  );


  useEffect(() => {
    fetchAllocation();
    fetchRequests();
  }, [allocationId]);

  useEffect(() => {
    filterRequests();
  }, [requests, searchTerm, statusFilter, barangayFilter]);

  const fetchAllocation = async () => {
    try {
      const response = await getAllocations();
      if (!response.error) {
        const allocations = response.data || [];
        const found = allocations.find(
          (a: any) => a.id === parseInt(allocationId || "0"),
        );
        setAllocation(found || null);
      }
    } catch (err) {
      console.error("Failed to fetch allocation:", err);
    }
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      // First get the allocation to get the season
      const allocationResponse = await getAllocations();
      if (allocationResponse.error) {
        throw new Error("Failed to fetch allocation");
      }
      const allocations = allocationResponse.data || [];
      const currentAllocation = allocations.find(
        (a: any) => a.id === parseInt(allocationId || "0"),
      );

      if (!currentAllocation) {
        throw new Error("Allocation not found");
      }

      // Fetch requests by allocation ID
      const response = await getFarmerRequests(allocationId, true);
      if (response.error) {
        throw new Error("Failed to fetch requests");
      }

      const data = response.data || [];
      setRequests(data);


    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };



  const filterRequests = () => {
    let filtered = [...requests];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (req) =>
          req.farmer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          req.barangay.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (req) => normalizeStatus(req.status) === normalizeStatus(statusFilter),
      );
    }

    // Barangay filter
    if (barangayFilter !== "all") {
      filtered = filtered.filter((req) => req.barangay === barangayFilter);
    }

    setFilteredRequests(filtered);
  };

  const handleDelete = async (id: number, farmerName: string) => {
    if (
      !confirm(
        `Are you sure you want to delete the request from ${farmerName}?`,
      )
    ) {
      return;
    }

    try {
      const response = await deleteFarmerRequest(id);

      if (!response.error) {
        alert("✅ Request deleted successfully");
        fetchRequests();
      } else {
        alert("❌ Failed to delete request");
      }
    } catch (error) {
      console.error("Error deleting request:", error);
      alert("❌ Error deleting request");
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      const response = await updateFarmerRequest(id, { status: newStatus });

      if (!response.error) {
        // If status is approved, automatically create distribution log
        if (newStatus === "approved") {
          await createDistributionLog(id);
        }
        alert(`✅ Status updated to ${newStatus}`);
        fetchRequests();
      } else {
        alert("❌ Failed to update status");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert("❌ Error updating status");
    }
  };

  // Automatically create distribution log when request is approved
  const createDistributionLog = async (requestId: number) => {
    try {
      // Find the request details
      const request = requests.find((r) => r.id === requestId);
      if (!request) return;

      // Build fertilizer and seed type strings
      const fertilizerTypes: string[] = [];
      if (request.requested_urea_bags)
        fertilizerTypes.push(`Urea:${request.requested_urea_bags}`);
      if (request.requested_complete_14_bags)
        fertilizerTypes.push(`Complete:${request.requested_complete_14_bags}`);
      if (request.requested_ammonium_sulfate_bags)
        fertilizerTypes.push(
          `Ammonium Sulfate:${request.requested_ammonium_sulfate_bags}`,
        );
      if (request.requested_muriate_potash_bags)
        fertilizerTypes.push(
          `Muriate Potash:${request.requested_muriate_potash_bags}`,
        );

      const seedTypes: string[] = [];
      if (request.requested_jackpot_kg)
        seedTypes.push(`Jackpot:${request.requested_jackpot_kg}`);
      if (request.requested_us88_kg)
        seedTypes.push(`US88:${request.requested_us88_kg}`);
      if (request.requested_th82_kg)
        seedTypes.push(`TH82:${request.requested_th82_kg}`);
      if (request.requested_rh9000_kg)
        seedTypes.push(`RH9000:${request.requested_rh9000_kg}`);
      if (request.requested_lumping143_kg)
        seedTypes.push(`Lumping143:${request.requested_lumping143_kg}`);
      if (request.requested_lp296_kg)
        seedTypes.push(`LP296:${request.requested_lp296_kg}`);

      // Calculate totals
      const totalFertilizer = Math.round(
        (Number(request.requested_urea_bags) || 0) +
          (Number(request.requested_complete_14_bags) || 0) +
          (Number(request.requested_ammonium_sulfate_bags) || 0) +
          (Number(request.requested_muriate_potash_bags) || 0),
      );

      const totalSeeds = Number(
        (
          (Number(request.requested_jackpot_kg) || 0) +
          (Number(request.requested_us88_kg) || 0) +
          (Number(request.requested_th82_kg) || 0) +
          (Number(request.requested_rh9000_kg) || 0) +
          (Number(request.requested_lumping143_kg) || 0) +
          (Number(request.requested_lp296_kg) || 0)
        ).toFixed(2),
      );

      const payload = {
        request_id: requestId,
        fertilizer_type: fertilizerTypes.join(", ") || null,
        fertilizer_bags_given: totalFertilizer,
        seed_type: seedTypes.join(", ") || null,
        seed_kg_given: totalSeeds,
        voucher_code: null,
        farmer_signature: false,
        verified_by: null,
      };

      const distResponse = await createDistributionRecord(payload);

      if (!distResponse.error) {
        console.log("✅ Distribution log created automatically");
      } else {
        console.error("❌ Failed to create distribution log");
      }
    } catch (error) {
      console.error("Error creating distribution log:", error);
    }
  };



  const getUniqueBarangays = () => {
    const barangays = [...new Set(requests.map((req) => req.barangay))];
    return barangays.sort();
  };

  // Edit request functionality
  const handleEdit = (request: FarmerRequest) => {
    setEditingRequest(request.id);
    // COMMENT: Using request_notes instead of notes (notes column doesn't exist in DB)
    setEditFormData({
      requested_urea_bags: request.requested_urea_bags,
      requested_complete_14_bags: request.requested_complete_14_bags,
      requested_ammonium_sulfate_bags: request.requested_ammonium_sulfate_bags,
      requested_muriate_potash_bags: request.requested_muriate_potash_bags,
      requested_jackpot_kg: request.requested_jackpot_kg,
      requested_us88_kg: request.requested_us88_kg,
      requested_th82_kg: request.requested_th82_kg,
      requested_rh9000_kg: request.requested_rh9000_kg,
      requested_lumping143_kg: request.requested_lumping143_kg,
      requested_lp296_kg: request.requested_lp296_kg,
      request_notes: request.request_notes || "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editingRequest) return;

    try {
      // FIX: Get the full original request and merge with edited data
      // This ensures all required fields are sent to the backend
      const originalRequest = requests.find((r) => r.id === editingRequest);
      if (!originalRequest) {
        throw new Error("Original request not found");
      }

      // Merge original request with edited form data
      const updatedRequest = {
        ...originalRequest, // Keep all original fields (farmer_id, season, etc.)
        ...editFormData, // Override with edited values
      };

      // FIX: Changed endpoint from /farmer-requests/ to /requests/ to match backend API
      const response = await updateFarmerRequest(
        editingRequest,
        updatedRequest,
      );

      if (response.error) {
        throw new Error("Failed to update request");
      }

      // Refresh requests list to show updated data
      await fetchRequests();

      // Close edit modal
      setEditingRequest(null);
      setEditFormData({});

      alert("✅ Request updated successfully!");
    } catch (err) {
      console.error("Error updating request:", err);
      alert(
        `❌ Failed to update request: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }
  };

  const handleCancelEdit = () => {
    setEditingRequest(null);
    setEditFormData({});
  };

  const getTotalRequested = (field: keyof FarmerRequest) => {
    return filteredRequests.reduce(
      (sum, req) => sum + (Number(req[field]) || 0),
      0,
    );
  };

  const formatSeasonName = (season: string) => {
    return season;
  };

  // Helper function to check if a request might have stock issues
  const checkPotentialShortage = (request: FarmerRequest): boolean => {
    return checkPotentialShortageForRequest(request, requests);
  };

  const checkPotentialShortageForRequest = (
    request: FarmerRequest,
    requestsList: FarmerRequest[],
    allocationData?: AllocationDetails,
  ): boolean => {
    const allocToUse = allocationData || allocation;
    if (!allocToUse) return false;

    // === FERTILIZER SHORTAGES ===
    // Calculate total approved AND pending requests so far (excluding current request)
    const approvedUrea = requestsList
      .filter(
        (r) =>
          (r.status === "approved" || r.status === "pending") &&
          r.id !== request.id,
      )
      .reduce((sum, r) => sum + Number(r.requested_urea_bags || 0), 0);

    const approvedComplete = requestsList
      .filter(
        (r) =>
          (r.status === "approved" || r.status === "pending") &&
          r.id !== request.id,
      )
      .reduce((sum, r) => sum + Number(r.requested_complete_14_bags || 0), 0);

    const approvedAmSul = requestsList
      .filter(
        (r) =>
          (r.status === "approved" || r.status === "pending") &&
          r.id !== request.id,
      )
      .reduce(
        (sum, r) => sum + Number(r.requested_ammonium_sulfate_bags || 0),
        0,
      );

    const approvedPotash = requestsList
      .filter(
        (r) =>
          (r.status === "approved" || r.status === "pending") &&
          r.id !== request.id,
      )
      .reduce(
        (sum, r) => sum + Number(r.requested_muriate_potash_bags || 0),
        0,
      );

    // Check if current request would exceed remaining stock
    const remainingUrea =
      Number(allocToUse.urea_46_0_0_bags || 0) - approvedUrea;
    const remainingComplete =
      Number(allocToUse.complete_14_14_14_bags || 0) - approvedComplete;
    const remainingAmSul =
      Number(allocToUse.ammonium_sulfate_21_0_0_bags || 0) - approvedAmSul;
    const remainingPotash =
      Number(allocToUse.muriate_potash_0_0_60_bags || 0) - approvedPotash;

    const requestedUrea = Number(request.requested_urea_bags || 0);
    const requestedComplete = Number(request.requested_complete_14_bags || 0);
    const requestedAmSul = Number(request.requested_ammonium_sulfate_bags || 0);
    const requestedPotash = Number(request.requested_muriate_potash_bags || 0);

    const fertilizerShortage =
      requestedUrea > remainingUrea ||
      requestedComplete > remainingComplete ||
      requestedAmSul > remainingAmSul ||
      requestedPotash > remainingPotash;

    // === SEED SHORTAGES ===
    const approvedJackpot = requestsList
      .filter(
        (r) =>
          (r.status === "approved" || r.status === "pending") &&
          r.id !== request.id,
      )
      .reduce((sum, r) => sum + Number(r.requested_jackpot_kg || 0), 0);

    const approvedUs88 = requestsList
      .filter(
        (r) =>
          (r.status === "approved" || r.status === "pending") &&
          r.id !== request.id,
      )
      .reduce((sum, r) => sum + Number(r.requested_us88_kg || 0), 0);

    const approvedTh82 = requestsList
      .filter(
        (r) =>
          (r.status === "approved" || r.status === "pending") &&
          r.id !== request.id,
      )
      .reduce((sum, r) => sum + Number(r.requested_th82_kg || 0), 0);

    const approvedRh9000 = requestsList
      .filter(
        (r) =>
          (r.status === "approved" || r.status === "pending") &&
          r.id !== request.id,
      )
      .reduce((sum, r) => sum + Number(r.requested_rh9000_kg || 0), 0);

    const approvedLumping143 = requestsList
      .filter(
        (r) =>
          (r.status === "approved" || r.status === "pending") &&
          r.id !== request.id,
      )
      .reduce((sum, r) => sum + Number(r.requested_lumping143_kg || 0), 0);

    const approvedLp296 = requestsList
      .filter(
        (r) =>
          (r.status === "approved" || r.status === "pending") &&
          r.id !== request.id,
      )
      .reduce((sum, r) => sum + Number(r.requested_lp296_kg || 0), 0);

    const remainingJackpot =
      Number(allocToUse.jackpot_kg || 0) - approvedJackpot;
    const remainingUs88 = Number(allocToUse.us88_kg || 0) - approvedUs88;
    const remainingTh82 = Number(allocToUse.th82_kg || 0) - approvedTh82;
    const remainingRh9000 = Number(allocToUse.rh9000_kg || 0) - approvedRh9000;
    const remainingLumping143 =
      Number(allocToUse.lumping143_kg || 0) - approvedLumping143;
    const remainingLp296 = Number(allocToUse.lp296_kg || 0) - approvedLp296;

    const requestedJackpot = Number(request.requested_jackpot_kg || 0);
    const requestedUs88 = Number(request.requested_us88_kg || 0);
    const requestedTh82 = Number(request.requested_th82_kg || 0);
    const requestedRh9000 = Number(request.requested_rh9000_kg || 0);
    const requestedLumping143 = Number(request.requested_lumping143_kg || 0);
    const requestedLp296 = Number(request.requested_lp296_kg || 0);

    const seedShortage =
      requestedJackpot > remainingJackpot ||
      requestedUs88 > remainingUs88 ||
      requestedTh82 > remainingTh82 ||
      requestedRh9000 > remainingRh9000 ||
      requestedLumping143 > remainingLumping143 ||
      requestedLp296 > remainingLp296;

    // Debug logging
    if (hasStatus(request, "pending")) {
      console.log(`🔍 Shortage Check for ${request.farmer_name}:`, {
        fertilizers: {
          urea: {
            requested: requestedUrea,
            remaining: remainingUrea,
            shortage: requestedUrea > remainingUrea,
          },
          complete: {
            requested: requestedComplete,
            remaining: remainingComplete,
            shortage: requestedComplete > remainingComplete,
          },
          amSul: {
            requested: requestedAmSul,
            remaining: remainingAmSul,
            shortage: requestedAmSul > remainingAmSul,
          },
          potash: {
            requested: requestedPotash,
            remaining: remainingPotash,
            shortage: requestedPotash > remainingPotash,
          },
        },
        seeds: {
          jackpot: {
            requested: requestedJackpot,
            remaining: remainingJackpot,
            shortage: requestedJackpot > remainingJackpot,
          },
          us88: {
            requested: requestedUs88,
            remaining: remainingUs88,
            shortage: requestedUs88 > remainingUs88,
          },
          th82: {
            requested: requestedTh82,
            remaining: remainingTh82,
            shortage: requestedTh82 > remainingTh82,
          },
          rh9000: {
            requested: requestedRh9000,
            remaining: remainingRh9000,
            shortage: requestedRh9000 > remainingRh9000,
          },
          lumping143: {
            requested: requestedLumping143,
            remaining: remainingLumping143,
            shortage: requestedLumping143 > remainingLumping143,
          },
          lp296: {
            requested: requestedLp296,
            remaining: remainingLp296,
            shortage: requestedLp296 > remainingLp296,
          },
        },
      });
    }

    // Return true if any fertilizer OR seed shortage exists
    return fertilizerShortage || seedShortage;
  };

  // Keep helper actions available for table actions/edit workflows.
  void handleDelete;
  void handleStatusChange;
  void handleEdit;
  void formatSeasonName;

  return (
    <div className="admin-req-page-container">
      <style>{`
                @keyframes pulse {
                    0%, 100% {
                        transform: scale(1);
                        opacity: 1;
                    }
                    50% {
                        transform: scale(1.1);
                        opacity: 0.8;
                    }
                }
            `}</style>
      <div className="admin-req-page has-mobile-sidebar">
        <AdminSidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        {/* Main Content */}
        <div className="admin-req-main-content">
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
            <div className="tech-incent-mobile-title">Manage Requests</div>
          </div>

          <div className="admin-req-dashboard-header">
            <div>
              <h2 className="admin-manage-title">Manage Requests</h2>
              <p className="admin-manage-subtitle">
                {formatSeasonName(allocation?.season || "")} · Regional Program
              </p>
            </div>
            <button
              className="app-back-button"
              onClick={() => navigate("/incentives")}
            >
              ← Back to Allocations
            </button>
          </div>

          <div className="admin-req-content-card">
            {/* Filters */}
            <div className="admin-req-filters">
              <input
                type="text"
                placeholder="🔍 Search by farmer name or barangay..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="admin-req-search-input"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="admin-req-filter-select"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <select
                value={barangayFilter}
                onChange={(e) => setBarangayFilter(e.target.value)}
                className="admin-req-filter-select"
              >
                <option value="all">All Barangays</option>
                {getUniqueBarangays().map((barangay) => (
                  <option key={barangay} value={barangay}>
                    {barangay}
                  </option>
                ))}
              </select>
            </div>

            {/* Allocation vs Requests Comparison */}
            <div className="admin-req-comparison-grid">
              {/* Regional Allocation Card */}
              <div className="admin-req-comparison-card admin-req-card-allocation">
                <h3 className="admin-req-card-header allocation">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                    <path d="m3.3 7 8.7 5 8.7-5" />
                    <path d="M12 22V12" />
                  </svg>
                  Regional Allocation
                </h3>
                <div className="admin-req-card-content">
                  <div className="admin-req-stat-box fertilizers">
                    <span className="admin-req-stat-label fertilizers">
                      Total Fertilizers
                    </span>
                    <span className="admin-req-stat-value fertilizers">
                      {allocation
                        ? FERTILIZER_FIELD_MAPS.reduce((sum, map) => {
                            return (
                              sum +
                              (Number(
                                (allocation as any)[map.allocationField],
                              ) || 0)
                            );
                          }, 0).toFixed(2)
                        : "0.00"}{" "}
                      bags
                    </span>
                  </div>
                  <div className="admin-req-stat-box seeds">
                    <span className="admin-req-stat-label seeds">
                      Total Seeds
                    </span>
                    <span className="admin-req-stat-value seeds">
                      {allocation
                        ? SEED_FIELD_MAPS.reduce((sum, map) => {
                            return (
                              sum +
                              (Number(
                                (allocation as any)[map.allocationField],
                              ) || 0)
                            );
                          }, 0).toFixed(2)
                        : "0.00"}{" "}
                      kg
                    </span>
                  </div>
                </div>
              </div>

              {/* Total Farmer Requests Card */}
              <div className="admin-req-comparison-card admin-req-card-total-requests">
                <h3 className="admin-req-card-header total-requests">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                  Total Requests
                </h3>
                <div className="admin-req-card-content">
                  <div className="admin-req-stat-box fertilizers">
                    <span className="admin-req-stat-label fertilizers">
                      Fertilizers Requested
                    </span>
                    <span className="admin-req-stat-value fertilizers">
                      {Number(getFertilizerTotal(filteredRequests)).toFixed(2)}{" "}
                      bags
                    </span>
                  </div>
                  <div className="admin-req-stat-box seeds">
                    <span className="admin-req-stat-label seeds">
                      Seeds Requested
                    </span>
                    <span className="admin-req-stat-value seeds">
                      {Number(getSeedTotal(filteredRequests)).toFixed(2)} kg
                    </span>
                  </div>
                </div>
              </div>

              {/* Farmer Requests Card */}
              <div className="admin-req-comparison-card admin-req-card-approved">
                <h3 className="admin-req-card-header approved">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Claimed Requests
                </h3>
                <div className="admin-req-card-content">
                  <div className="admin-req-stat-box fertilizers">
                    <span className="admin-req-stat-label fertilizers">
                      Total Fertilizers
                    </span>
                    <span className="admin-req-stat-value fertilizers">
                      {Number(getFertilizerTotal(approvedRequests)).toFixed(2)}{" "}
                      bags
                    </span>
                  </div>
                  <div className="admin-req-stat-box seeds">
                    <span className="admin-req-stat-label seeds">
                      Total Seeds
                    </span>
                    <span className="admin-req-stat-value seeds">
                      {Number(getSeedTotal(approvedRequests)).toFixed(2)} kg
                    </span>
                  </div>
                </div>
              </div>

              {/* Rejected Farmer Requests Card */}
            </div>

            {/* Summary Cards */}
            <div className="admin-req-summary-grid">
              {/* Total Requests */}
              <div className="admin-req-summary-card admin-req-card-total">
                <div className="admin-req-card-icon">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div className="admin-req-card-info">
                  <div className="admin-req-card-count">
                    {filteredRequests.length}
                  </div>
                  <div className="admin-req-card-label">Total Requests</div>
                </div>
              </div>

              {/* Pending Requests */}
              <div className="admin-req-summary-card admin-req-card-pending">
                <div className="admin-req-card-icon">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div className="admin-req-card-info">
                  <div className="admin-req-card-count">
                    {
                      filteredRequests.filter((r) => hasStatus(r, "pending"))
                        .length
                    }
                  </div>
                  <div className="admin-req-card-label">Pending Requests</div>
                </div>
              </div>

              {/* Approved Requests */}
              <div className="admin-req-summary-card admin-req-card-approved">
                <div className="admin-req-card-icon">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 11 12 14 22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                </div>
                <div className="admin-req-card-info">
                  <div className="admin-req-card-count">
                    {
                      filteredRequests.filter((r) => hasStatus(r, "approved"))
                        .length
                    }
                  </div>
                  <div className="admin-req-card-label">Claimed Requests</div>
                </div>
              </div>

              {/* Rejected Requests */}
              <div className="admin-req-summary-card admin-req-card-rejected">
                <div className="admin-req-card-icon">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
                <div className="admin-req-card-info">
                  <div className="admin-req-card-count">
                    {
                      filteredRequests.filter((r) => hasStatus(r, "rejected"))
                        .length
                    }
                  </div>
                  <div className="admin-req-card-label">Rejected Requests</div>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="admin-req-loading-message">
                Loading requests...
              </div>
            ) : error ? (
              <div className="admin-req-error-state">
                <div className="admin-req-error-icon">⚠️</div>
                <h3>Error Loading Requests</h3>
                <p>{error}</p>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="admin-req-empty-state">
                <div className="admin-req-empty-icon">📝</div>
                <h3>No Farmer Requests</h3>
                <p>No requests found matching your filters</p>
              </div>
            ) : (
              <>
                {/* Info Box for Visual Indicators */}
                {filteredRequests.filter(
                  (r) => hasStatus(r, "pending") && checkPotentialShortage(r),
                ).length > 0 && (
                  <div className="admin-req-info-box">
                    <span style={{ fontSize: "24px" }}>💡</span>
                    <div style={{ flex: 1 }}>
                      <strong style={{ color: "#92400e", fontSize: "14px" }}>
                        Alternatives Auto-Loaded & Available
                      </strong>
                      <p
                        style={{
                          margin: "4px 0 0 0",
                          fontSize: "13px",
                          color: "#78350f",
                        }}
                      >
                        Rows highlighted in yellow (⚠️) have detected shortages.
                        Alternative fertilizer and seed options have been
                        automatically loaded based on agronomic equivalency.
                      </p>
                    </div>
                  </div>
                )}

                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "14px",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          background: "#f9fafb",
                          borderBottom: "2px solid #e5e7eb",
                        }}
                      >
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontWeight: "600",
                          }}
                        >
                          Farmer Name
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontWeight: "600",
                          }}
                        >
                          Barangay
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "center",
                            fontWeight: "600",
                          }}
                        >
                          Fertilizers (bags)
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "center",
                            fontWeight: "600",
                          }}
                        >
                          Seeds (kg)
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "center",
                            fontWeight: "600",
                          }}
                        >
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRequests.map((request) => {
                        const totalFertilizer =
                          Number(request.requested_urea_bags || 0) +
                          Number(request.requested_complete_14_bags || 0) +
                          Number(request.requested_ammonium_sulfate_bags || 0) +
                          Number(request.requested_muriate_potash_bags || 0);

                        const totalSeeds =
                          Number(request.requested_jackpot_kg || 0) +
                          Number(request.requested_us88_kg || 0) +
                          Number(request.requested_th82_kg || 0) +
                          Number(request.requested_rh9000_kg || 0) +
                          Number(request.requested_lumping143_kg || 0) +
                          Number(request.requested_lp296_kg || 0);

                        // Check if this request might have shortages
                        const hasShortage =
                          hasStatus(request, "pending") &&
                          checkPotentialShortage(request);
                        const normalizedStatus = normalizeStatus(
                          request.status,
                        );

                        return (
                          <React.Fragment key={request.id}>
                            <tr
                              style={{
                                borderBottom: "1px solid #e5e7eb",
                                background: hasShortage
                                  ? "#fef3c7"
                                  : "transparent",
                              }}
                            >
                              <td style={{ padding: "12px" }}>
                                {hasShortage && (
                                  <span
                                    title="Potential shortage - exceeds remaining stock"
                                    style={{
                                      marginRight: "8px",
                                      fontSize: "16px",
                                    }}
                                  >⚠️</span>
                                )}
                                {request.farmer_name}
                              </td>
                              <td style={{ padding: "12px" }}>
                                {request.barangay}
                              </td>
                              <td
                                style={{ padding: "12px", textAlign: "center" }}
                              >
                                {totalFertilizer.toFixed(2)}

                              </td>
                              <td
                                style={{ padding: "12px", textAlign: "center" }}
                              >
                                {totalSeeds.toFixed(2)}
                              </td>
                              <td
                                style={{ padding: "12px", textAlign: "center" }}
                              >
                                <span
                                  style={{
                                    padding: "4px 12px",
                                    borderRadius: "12px",
                                    fontSize: "12px",
                                    fontWeight: "600",
                                    background:
                                      normalizedStatus === "pending"
                                        ? "#fef3c7"
                                        : normalizedStatus === "approved"
                                          ? "#d1fae5"
                                          : "#fee2e2",
                                    color:
                                      normalizedStatus === "pending"
                                        ? "#92400e"
                                        : normalizedStatus === "approved"
                                          ? "#065f46"
                                          : "#991b1b",
                                  }}
                                >
                                  {request.status.toUpperCase()}
                                </span>
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr
                        style={{
                          background: "#f9fafb",
                          borderTop: "2px solid #e5e7eb",
                          fontWeight: "600",
                        }}
                      >
                        <td colSpan={2} style={{ padding: "12px" }}>
                          TOTALS
                        </td>
                        <td style={{ padding: "12px", textAlign: "center" }}>
                          {(
                            getTotalRequested("requested_urea_bags") +
                            getTotalRequested("requested_complete_14_bags") +
                            getTotalRequested(
                              "requested_ammonium_sulfate_bags",
                            ) +
                            getTotalRequested("requested_muriate_potash_bags")
                          ).toFixed(2)}
                        </td>
                        <td style={{ padding: "12px", textAlign: "center" }}>
                          {(
                            getTotalRequested("requested_jackpot_kg") +
                            getTotalRequested("requested_us88_kg") +
                            getTotalRequested("requested_th82_kg") +
                            getTotalRequested("requested_rh9000_kg") +
                            getTotalRequested("requested_lumping143_kg") +
                            getTotalRequested("requested_lp296_kg")
                          ).toFixed(2)}
                        </td>
                        <td colSpan={3}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Edit Request Modal */}
      {editingRequest && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "600px",
              width: "90%",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <h3
              style={{
                marginBottom: "20px",
                fontSize: "20px",
                fontWeight: "600",
              }}
            >
              Edit Farmer Request
            </h3>

            {/* Fertilizers Section */}
            <div style={{ marginBottom: "24px" }}>
              <h4
                style={{
                  marginBottom: "12px",
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "#374151",
                }}
              >
                Fertilizers (bags)
              </h4>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontSize: "13px",
                      color: "#6b7280",
                    }}
                  >
                    Urea (46-0-0)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.requested_urea_bags || 0}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        requested_urea_bags: Number(e.target.value),
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontSize: "13px",
                      color: "#6b7280",
                    }}
                  >
                    Complete (14-14-14)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.requested_complete_14_bags || 0}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        requested_complete_14_bags: Number(e.target.value),
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontSize: "13px",
                      color: "#6b7280",
                    }}
                  >
                    Ammonium Sulfate (21-0-0)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.requested_ammonium_sulfate_bags || 0}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        requested_ammonium_sulfate_bags: Number(e.target.value),
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontSize: "13px",
                      color: "#6b7280",
                    }}
                  >
                    Muriate of Potash (0-0-60)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.requested_muriate_potash_bags || 0}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        requested_muriate_potash_bags: Number(e.target.value),
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Seeds Section */}
            <div style={{ marginBottom: "24px" }}>
              <h4
                style={{
                  marginBottom: "12px",
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "#374151",
                }}
              >
                Seeds (kg)
              </h4>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontSize: "13px",
                      color: "#6b7280",
                    }}
                  >
                    Jackpot
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.requested_jackpot_kg || 0}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        requested_jackpot_kg: Number(e.target.value),
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontSize: "13px",
                      color: "#6b7280",
                    }}
                  >
                    US-88
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.requested_us88_kg || 0}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        requested_us88_kg: Number(e.target.value),
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontSize: "13px",
                      color: "#6b7280",
                    }}
                  >
                    TH-82
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.requested_th82_kg || 0}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        requested_th82_kg: Number(e.target.value),
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontSize: "13px",
                      color: "#6b7280",
                    }}
                  >
                    RH-9000
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.requested_rh9000_kg || 0}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        requested_rh9000_kg: Number(e.target.value),
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontSize: "13px",
                      color: "#6b7280",
                    }}
                  >
                    Lumping-143
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.requested_lumping143_kg || 0}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        requested_lumping143_kg: Number(e.target.value),
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontSize: "13px",
                      color: "#6b7280",
                    }}
                  >
                    LP-296
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.requested_lp296_kg || 0}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        requested_lp296_kg: Number(e.target.value),
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Notes Section */}
            {/* COMMENT: Changed from 'notes' to 'request_notes' to match database column */}
            <div style={{ marginBottom: "24px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "4px",
                  fontSize: "13px",
                  color: "#6b7280",
                }}
              >
                Request Notes (Optional)
              </label>
              <textarea
                value={editFormData.request_notes || ""}
                onChange={(e) =>
                  setEditFormData({
                    ...editFormData,
                    request_notes: e.target.value,
                  })
                }
                rows={3}
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  fontSize: "14px",
                  resize: "vertical",
                }}
                placeholder="Add any notes about this request..."
              />
            </div>

            {/* Action Buttons */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={handleCancelEdit}
                style={{
                  padding: "10px 20px",
                  background: "#6b7280",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                style={{
                  padding: "10px 20px",
                  background: "#10b981",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                💾 Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageRequests;
