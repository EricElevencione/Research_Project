import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getAllocations, getFarmerRequests } from "../../api";
import {
  UsageGauges,
  BarangayBreakdownTable,
  SeasonComparisonTable,
} from "../../components/Incentives/AllocationVisuals";
import {
  FERTILIZER_FIELD_MAPS,
  SEED_FIELD_MAPS,
} from "../../constants/shortageFieldMaps";
import "../../assets/css/admin css/AdminViewAllocation.css";
import "../../components/layout/sidebarStyle.css";
import LogoImage from "../../assets/images/Logo.png";
import HomeIcon from "../../assets/images/home.png";
import RSBSAIcon from "../../assets/images/rsbsa.png";
import ApproveIcon from "../../assets/images/approve.png";
import LogoutIcon from "../../assets/images/logout.png";
import IncentivesIcon from "../../assets/images/incentives.png";

interface FarmerRequest extends Record<
  string,
  number | string | null | undefined
> {
  id: number;
  status: string;
  barangay: string;
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
}

interface AllocationDetails extends Record<
  string,
  number | string | null | undefined
> {
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

const ViewAllocation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { allocationId } = useParams<{ allocationId: string }>();

  const [allocation, setAllocation] = useState<AllocationDetails | null>(null);
  const [allAllocations, setAllAllocations] = useState<AllocationDetails[]>([]);
  const [requests, setRequests] = useState<FarmerRequest[]>([]);
  const [allRequests, setAllRequests] = useState<FarmerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const formatSeasonName = (season: string) => {
    if (!season) return "Unknown Season";
    const [type, year] = season.split("_");
    if (!type || !year) return season;
    return `${type.charAt(0).toUpperCase() + type.slice(1)} ${year}`;
  };

  const formatCount = (value: number) => value.toLocaleString("en-US");

  const gaugeData = useMemo(() => {
    if (allAllocations.length === 0) return { fertilizers: [], seeds: [] };

    const fertilizers = FERTILIZER_FIELD_MAPS.map((fertilizer) => {
      const allocated = allAllocations.reduce(
        (sum, currentAllocation) =>
          sum + (Number(currentAllocation[fertilizer.allocationField]) || 0),
        0,
      );
      const requested = allRequests.reduce(
        (sum, request) => sum + (Number(request[fertilizer.requestField]) || 0),
        0,
      );

      return {
        name: fertilizer.label,
        allocated,
        requested,
        unit: fertilizer.unit,
      };
    }).filter(
      (fertilizer) => fertilizer.allocated > 0 || fertilizer.requested > 0,
    );

    const seeds = SEED_FIELD_MAPS.map((seed) => {
      const allocated = allAllocations.reduce(
        (sum, currentAllocation) =>
          sum + (Number(currentAllocation[seed.allocationField]) || 0),
        0,
      );
      const requested = allRequests.reduce(
        (sum, request) => sum + (Number(request[seed.requestField]) || 0),
        0,
      );

      return {
        name: seed.label,
        allocated,
        requested,
        unit: seed.unit,
      };
    }).filter((seed) => seed.allocated > 0 || seed.requested > 0);

    return {
      fertilizers,
      seeds,
    };
  }, [allAllocations, allRequests]);

  const overallAllocationTotals = useMemo(() => {
    return {
      fertilizerBags: FERTILIZER_FIELD_MAPS.reduce((sum, fertilizer) => {
        if (fertilizer.unit !== "bags") return sum;
        return (
          sum +
          allAllocations.reduce(
            (innerSum, currentAllocation) =>
              innerSum +
              (Number(currentAllocation[fertilizer.allocationField]) || 0),
            0,
          )
        );
      }, 0),
      seedKg: SEED_FIELD_MAPS.reduce(
        (sum, seed) =>
          sum +
          allAllocations.reduce(
            (innerSum, currentAllocation) =>
              innerSum + (Number(currentAllocation[seed.allocationField]) || 0),
            0,
          ),
        0,
      ),
    };
  }, [allAllocations]);

  const overviewStats = useMemo(() => {
    if (!allocation) {
      return {
        approved: 0,
        rejected: 0,
        pending: 0,
        totalFertilizerAllocated: 0,
        totalSeedsAllocated: 0,
      };
    }

    return {
      approved: requests.filter((request) => request.status === "approved")
        .length,
      rejected: requests.filter((request) => request.status === "rejected")
        .length,
      pending: requests.filter((request) => request.status === "pending")
        .length,
      totalFertilizerAllocated: FERTILIZER_FIELD_MAPS.reduce(
        (sum, fertilizer) => {
          if (fertilizer.unit !== "bags") return sum;
          return sum + (Number(allocation[fertilizer.allocationField]) || 0);
        },
        0,
      ),
      totalSeedsAllocated: SEED_FIELD_MAPS.reduce(
        (sum, seed) => sum + (Number(allocation[seed.allocationField]) || 0),
        0,
      ),
    };
  }, [allocation, requests]);

  useEffect(() => {
    const fetchAllocationData = async () => {
      try {
        setLoading(true);
        setError(null);

        const allocationResponse = await getAllocations();
        if (allocationResponse.error) {
          throw new Error(
            allocationResponse.error || "Failed to fetch allocation",
          );
        }

        const allocations = (allocationResponse.data ||
          []) as AllocationDetails[];
        setAllAllocations(allocations);

        const currentAllocation = allocations.find(
          (item) => item.id === parseInt(allocationId || "0", 10),
        );

        if (!currentAllocation) {
          throw new Error("Allocation not found");
        }

        setAllocation(currentAllocation);

        const requestsResponse = await getFarmerRequests(
          currentAllocation.id,
          true,
        );
        if (requestsResponse.error) {
          throw new Error(requestsResponse.error || "Failed to fetch requests");
        }

        const selectedRequests = (requestsResponse.data ||
          []) as FarmerRequest[];
        setRequests(selectedRequests);

        const allRequestBuckets = await Promise.all(
          allocations.map(async (allocationItem) => {
            const allocationRequestsResponse = await getFarmerRequests(
              allocationItem.id,
              true,
            );
            if (allocationRequestsResponse.error) {
              return [] as FarmerRequest[];
            }
            return (allocationRequestsResponse.data || []) as FarmerRequest[];
          }),
        );

        const mergedAllRequests = allRequestBuckets.flat();
        setAllRequests(
          mergedAllRequests.length > 0 ? mergedAllRequests : selectedRequests,
        );
      } catch (fetchError: any) {
        setError(fetchError?.message || "Failed to load allocation details");
      } finally {
        setLoading(false);
      }
    };

    fetchAllocationData();
  }, [allocationId]);

  if (loading) {
    return (
      <div className="admin-viewalloc-page-container">
        <div className="admin-viewalloc-page">
          <div className="admin-viewalloc-main-content">
            <div className="admin-viewalloc-loading">
              Loading allocation details...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !allocation) {
    return (
      <div className="admin-viewalloc-page-container">
        <div className="admin-viewalloc-page">
          <div className="admin-viewalloc-main-content">
            <div className="admin-viewalloc-error-state">
              <div className="admin-viewalloc-error-icon">⚠️</div>
              <h3>Error Loading Allocation</h3>
              <p>{error || "Allocation not found"}</p>
              <button
                className="app-back-button"
                onClick={() => navigate("/incentives")}
              >
                ← Back to Allocations
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-viewalloc-page-container">
      <div className="admin-viewalloc-page has-mobile-sidebar">
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

        <div className="admin-viewalloc-main-content">
          <div className="tech-incent-mobile-header">
            <button
              className="tech-incent-hamburger"
              onClick={() => setSidebarOpen((previous) => !previous)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <div className="tech-incent-mobile-title">Admin Allocation</div>
          </div>

          <div className="admin-viewalloc-header">
            <h2 className="admin-viewalloc-title">View Allocation</h2>
            <p className="admin-viewalloc-subtitle">
              {formatSeasonName(allocation.season)} · Regional Allocation
              Details
            </p>
          </div>

          <div className="admin-viewalloc-header-actions">
            <button
              className="admin-viewalloc-btn-nav"
              onClick={() => navigate(`/manage-requests/${allocation.id}`)}
            >
              View Requests
            </button>
            <button
              className="app-back-button"
              onClick={() => navigate("/incentives")}
            >
              ← Back to Allocations
            </button>
          </div>

          <div className="admin-viewalloc-kpi-grid">
            <div className="admin-viewalloc-kpi-card">
              <div className="admin-viewalloc-kpi-label">Total Requests</div>
              <div className="admin-viewalloc-kpi-value">
                {formatCount(requests.length)}
              </div>
            </div>
            <div className="admin-viewalloc-kpi-card">
              <div className="admin-viewalloc-kpi-label">Approved</div>
              <div className="admin-viewalloc-kpi-value">
                {formatCount(overviewStats.approved)}
              </div>
            </div>
            <div className="admin-viewalloc-kpi-card">
              <div className="admin-viewalloc-kpi-label">Pending</div>
              <div className="admin-viewalloc-kpi-value">
                {formatCount(overviewStats.pending)}
              </div>
            </div>
            <div className="admin-viewalloc-kpi-card">
              <div className="admin-viewalloc-kpi-label">Rejected</div>
              <div className="admin-viewalloc-kpi-value">
                {formatCount(overviewStats.rejected)}
              </div>
            </div>
          </div>

          <div className="admin-viewalloc-content-card admin-viewalloc-section-stack">
            <section className="admin-viewalloc-section-block">
              <div className="admin-viewalloc-section-head">
                <h3>Overall Resource Usage</h3>
                <span>
                  Combined across {allAllocations.length} allocation
                  {allAllocations.length === 1 ? "" : "s"}
                </span>
              </div>
              <UsageGauges
                fertilizers={gaugeData.fertilizers}
                seeds={gaugeData.seeds}
              />
            </section>

            <section className="admin-viewalloc-section-block">
              <div className="admin-viewalloc-section-head">
                <h3>Barangay Breakdown</h3>
                <span>Demand distribution per barangay</span>
              </div>
              {requests.length > 0 ? (
                <BarangayBreakdownTable requests={requests} />
              ) : (
                <div className="admin-viewalloc-empty-state">
                  No requests found for this allocation yet.
                </div>
              )}
            </section>

            <section className="admin-viewalloc-section-block">
              <div className="admin-viewalloc-section-head">
                <h3>Season Comparison</h3>
                <span>Compare this season against other allocations</span>
              </div>
              <SeasonComparisonTable allocations={allAllocations} />
            </section>

            <div className="admin-viewalloc-notes">
              <h4>Allocation Snapshot</h4>
              <p>
                Overall allocated:{" "}
                {overallAllocationTotals.fertilizerBags.toFixed(1)} fertilizer
                bags and {overallAllocationTotals.seedKg.toFixed(1)} seed kg.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewAllocation;
