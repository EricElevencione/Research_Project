import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase";

// ─── Interfaces ────────────────────────────────────────────

export interface KPIStats {
  totalFarmers: number;
  totalHectares: number;
  fulfillmentRate: number; // % of approved/distributed vs total requests
  claimRate: number; // % of claimed vs distributed
}

export interface SeasonAllocation {
  allocationId: number;
  season: string;
  label: string; // e.g. "Dry 2026"
  allocationDate: string;
  fertilizerAllocated: number;
  fertilizerDistributed: number;
  seedsAllocated: number;
  seedsDistributed: number;
  totalAllocated: number;
  totalDistributed: number;
  totalRequests: number;
  approvedRequests: number;
  distributedRequests: number;
  claimedCount: number;
}

export interface ClaimRateTrend {
  week: string; // e.g. "Jan 6", "Jan 13"
  weekStart: string; // ISO date
  distributed: number;
  claimed: number;
  claimRate: number; // percentage
}

export interface BarangayDensity {
  name: string;
  farmerCount: number;
  hectares: number;
}

export interface SubsidyStock {
  name: string;
  allocated: number;
  distributed: number;
  remaining: number;
}

export interface RequestStats {
  pending: number;
  approved: number;
  distributed: number;
  rejected: number;
  total: number;
}

export interface AdminDashboardData {
  kpi: KPIStats;
  seasonComparison: SeasonAllocation[];
  claimRateTrend: ClaimRateTrend[];
  barangayDensity: BarangayDensity[];
  subsidyBreakdown: SubsidyStock[];
  requestStats: RequestStats;
  currentSeason: string;
  loading: boolean;
  error: string | null;
  lastUpdated: Date;
}

// ─── Format helpers ────────────────────────────────────────

export const formatSeasonLabel = (season: string): string => {
  const [type, year] = season.split("_");
  if (!type || !year) return season;
  return `${type.charAt(0).toUpperCase() + type.slice(1)} ${year}`;
};

const getCurrentSeason = (): string => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  return month >= 5 && month <= 10 ? `wet_${year}` : `dry_${year}`;
};

const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
};

const formatWeekLabel = (date: Date): string => {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// ─── Hook ──────────────────────────────────────────────────

export const useAdminDashboardStats = (
  selectedAllocationId?: number,
): AdminDashboardData => {
  const [data, setData] = useState<AdminDashboardData>({
    kpi: {
      totalFarmers: 0,
      totalHectares: 0,
      fulfillmentRate: 0,
      claimRate: 0,
    },
    seasonComparison: [],
    claimRateTrend: [],
    barangayDensity: [],
    subsidyBreakdown: [],
    requestStats: {
      pending: 0,
      approved: 0,
      distributed: 0,
      rejected: 0,
      total: 0,
    },
    currentSeason: getCurrentSeason(),
    loading: true,
    error: null,
    lastUpdated: new Date(),
  });

  const fetchAll = useCallback(async () => {
    try {
      // ── Parallel fetches ──────────────────────────────────
      const [
        farmersRes,
        parcelsRes,
        requestsRes,
        allocationsRes,
        distributionsRes,
      ] = await Promise.all([
        supabase
          .from("rsbsa_submission")
          .select('id, BARANGAY, "FARM LOCATION", "TOTAL FARM AREA", status'),
        supabase
          .from("rsbsa_farm_parcels")
          .select(
            "submission_id, farm_location_barangay, total_farm_area_ha, is_current_owner",
          ),
        supabase
          .from("farmer_requests")
          .select("id, status, season, allocation_id, created_at"),
        supabase.from("regional_allocations").select("*"),
        supabase
          .from("distribution_records")
          .select(
            "id, request_id, fertilizer_bags_given, seed_kg_given, claimed, claim_date, distribution_date, created_at",
          ),
      ]);

      const farmers = farmersRes.data || [];
      const parcels = parcelsRes.data || [];
      const requests = requestsRes.data || [];
      const allocations = allocationsRes.data || [];
      const distributions = distributionsRes.data || [];

      // ── KPI Stats ─────────────────────────────────────────
      const totalFarmers = farmers.length;

      // Total hectares from farm parcels (current owners only)
      const currentParcels = parcels.filter(
        (p: any) => p.is_current_owner === true,
      );
      const totalHectares = currentParcels.reduce((sum: number, p: any) => {
        const area = parseFloat(p.total_farm_area_ha) || 0;
        return sum + area;
      }, 0);

      // Fallback: if no parcels, sum from submissions
      const totalHectaresFallback =
        totalHectares > 0
          ? totalHectares
          : farmers.reduce(
              (sum: number, f: any) =>
                sum + (parseFloat(f["TOTAL FARM AREA"]) || 0),
              0,
            );

      // Determine which allocation is selected (used for trend chart only)
      const currentSeason = getCurrentSeason();
      let selectedRequests: any[];
      if (selectedAllocationId) {
        selectedRequests = requests.filter(
          (r: any) => r.allocation_id === selectedAllocationId,
        );
      } else {
        // Default: filter by current season
        selectedRequests = requests.filter(
          (r: any) => r.season === currentSeason,
        );
      }

      // Scoped distributions for the trend chart
      const selectedReqIds = new Set(selectedRequests.map((r: any) => r.id));
      const currentSeasonDists = distributions.filter((d: any) =>
        selectedReqIds.has(d.request_id),
      );

      // Fulfillment rate: all-time — approved+distributed / all requests ever
      const fulfilledRequests = requests.filter(
        (r: any) => r.status === "approved" || r.status === "distributed",
      ).length;
      const fulfillmentRate =
        requests.length > 0
          ? Math.round((fulfilledRequests / requests.length) * 100)
          : 0;

      // Claim rate: all-time — claimed / all distribution records ever
      const totalDistributed = distributions.length;
      const totalClaimed = distributions.filter(
        (d: any) => d.claimed === true,
      ).length;
      const claimRate =
        totalDistributed > 0
          ? Math.round((totalClaimed / totalDistributed) * 100)
          : 0;

      const kpi: KPIStats = {
        totalFarmers,
        totalHectares: Math.round(totalHectaresFallback * 100) / 100,
        fulfillmentRate,
        claimRate,
      };

      // ── Season Comparison ─────────────────────────────────
      // Build one entry per allocation row (not per unique season)
      // Sort by allocation_date ascending
      const sortedAllocations = [...allocations].sort((a: any, b: any) => {
        const dateA = a.allocation_date || "";
        const dateB = b.allocation_date || "";
        return dateA.localeCompare(dateB);
      });

      const seasonComparison: SeasonAllocation[] = sortedAllocations.map(
        (allocation: any) => {
          const allocReqs = requests.filter(
            (r: any) => r.allocation_id === allocation.id,
          );
          const allocReqIds = new Set(allocReqs.map((r: any) => r.id));
          const allocDists = distributions.filter((d: any) =>
            allocReqIds.has(d.request_id),
          );

          const fertilizerAllocated =
            (allocation.urea_46_0_0_bags || 0) +
            (allocation.complete_14_14_14_bags || 0) +
            (allocation.ammonium_sulfate_21_0_0_bags || 0) +
            (allocation.muriate_potash_0_0_60_bags || 0);

          const seedsAllocated =
            (allocation.jackpot_kg || 0) +
            (allocation.us88_kg || 0) +
            (allocation.th82_kg || 0) +
            (allocation.rh9000_kg || 0) +
            (allocation.lumping143_kg || 0) +
            (allocation.lp296_kg || 0);

          const fertilizerDistributed = allocDists.reduce(
            (s: number, d: any) => s + (d.fertilizer_bags_given || 0),
            0,
          );
          const seedsDistributed = allocDists.reduce(
            (s: number, d: any) => s + (d.seed_kg_given || 0),
            0,
          );

          const allocDate = allocation.allocation_date
            ? new Date(allocation.allocation_date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "";

          return {
            allocationId: allocation.id,
            season: allocation.season,
            label: `${formatSeasonLabel(allocation.season)}${allocDate ? ` (${allocDate})` : ""}`,
            allocationDate: allocation.allocation_date || "",
            fertilizerAllocated,
            fertilizerDistributed,
            seedsAllocated,
            seedsDistributed,
            totalAllocated: fertilizerAllocated + seedsAllocated,
            totalDistributed: fertilizerDistributed + seedsDistributed,
            totalRequests: allocReqs.length,
            approvedRequests: allocReqs.filter(
              (r: any) => r.status === "approved" || r.status === "distributed",
            ).length,
            distributedRequests: allocReqs.filter(
              (r: any) => r.status === "distributed",
            ).length,
            claimedCount: allocDists.filter((d: any) => d.claimed === true)
              .length,
          };
        },
      );

      // ── Claim Rate Trend (weekly) ─────────────────────────
      // Group distributions by week — scoped to the selected season
      const weekMap = new Map<
        string,
        { distributed: number; claimed: number; weekStart: Date }
      >();

      currentSeasonDists.forEach((d: any) => {
        const date = new Date(d.distribution_date || d.created_at);
        const ws = getWeekStart(date);
        const key = ws.toISOString().split("T")[0];
        if (!weekMap.has(key)) {
          weekMap.set(key, { distributed: 0, claimed: 0, weekStart: ws });
        }
        const entry = weekMap.get(key)!;
        entry.distributed++;
        if (d.claimed) entry.claimed++;
      });

      // Also track claims by claim_date (future use)
      // Claims are already counted in distribution week above

      const claimRateTrend: ClaimRateTrend[] = Array.from(weekMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, val]) => ({
          week: formatWeekLabel(val.weekStart),
          weekStart: key,
          distributed: val.distributed,
          claimed: val.claimed,
          claimRate:
            val.distributed > 0
              ? Math.round((val.claimed / val.distributed) * 100)
              : 0,
        }));

      // ── Barangay Density ──────────────────────────────────
      const barangayMap = new Map<
        string,
        { farmerCount: number; hectares: number }
      >();
      farmers.forEach((f: any) => {
        // Use FARM LOCATION (where they farm) for density
        const brgy = f["FARM LOCATION"] || f["BARANGAY"] || "Unknown";
        if (!brgy || brgy === "Unknown") return;
        if (!barangayMap.has(brgy)) {
          barangayMap.set(brgy, { farmerCount: 0, hectares: 0 });
        }
        const entry = barangayMap.get(brgy)!;
        entry.farmerCount++;
        entry.hectares += parseFloat(f["TOTAL FARM AREA"]) || 0;
      });

      const barangayDensity: BarangayDensity[] = Array.from(
        barangayMap.entries(),
      )
        .map(([name, val]) => ({
          name,
          farmerCount: val.farmerCount,
          hectares: Math.round(val.hectares * 100) / 100,
        }))
        .sort((a, b) => b.farmerCount - a.farmerCount);

      // ── Subsidy & Request Stats ───────────────────────────
      const requestStats: RequestStats = {
        pending: requests.filter((r: any) => r.status === "pending").length,
        approved: requests.filter((r: any) => r.status === "approved").length,
        distributed: requests.filter((r: any) => r.status === "distributed")
          .length,
        rejected: requests.filter((r: any) => r.status === "rejected").length,
        total: requests.length,
      };

      // Calculate totals for allocated vs distributed across all seasons
      const subsidyMap = new Map<string, { allocated: number; distributed: number }>();

      // Allocated amounts (sum across all regional_allocations)
      allocations.forEach((a: any) => {
        const fields = Object.keys(a).filter(k => k.includes('_bags') || k.includes('_kg') || k.includes('_liters'));
        fields.forEach(field => {
          const val = Number(a[field]) || 0;
          if (val > 0) {
            const current = subsidyMap.get(field) || { allocated: 0, distributed: 0 };
            subsidyMap.set(field, { ...current, allocated: current.allocated + val });
          }
        });
      });

      // Distributed amounts (sum across distribution_records)
      distributions.forEach((d: any) => {
          // This is a bit tricky because distribution_records uses fertilizer_bags_given and seed_kg_given
          // instead of specific item fields. We'd need to link back to the request to know WHICH item was given.
          // For now, let's group by general category if itemized data isn't readily available in the record.
          // Better: just use the request to find the items that were distributed.
          const req = requests.find((r: any) => r.id === d.request_id);
          if (req && req.status === 'distributed') {
              // Approximate distribution based on what was requested if specific item isn't in distribution_record
              // In this system, if status is 'distributed', it means the requested items were given.
              const reqFields = Object.keys(req).filter(k => k.startsWith('requested_'));
              reqFields.forEach(rf => {
                  const field = rf.replace('requested_', '').replace('_kg', '').replace('_bags', ''); // sanitize to match allocation field if possible
                  // Mapping requested_ fields back to allocation fields
                  let allocField = rf.replace('requested_', '');
                  if (allocField === 'complete_14_bags') allocField = 'complete_14_14_14_bags';
                  if (allocField === 'ammonium_sulfate_bags') allocField = 'ammonium_sulfate_21_0_0_bags';
                  if (allocField === 'muriate_potash_bags') allocField = 'muriate_potash_0_0_60_bags';
                  if (allocField === 'urea_bags') allocField = 'urea_46_0_0_bags';

                  const val = Number(req[rf]) || 0;
                  if (val > 0) {
                      const current = subsidyMap.get(allocField) || { allocated: 0, distributed: 0 };
                      subsidyMap.set(allocField, { ...current, distributed: current.distributed + val });
                  }
              });
          }
      });

      const subsidyBreakdown: SubsidyStock[] = Array.from(subsidyMap.entries()).map(([field, val]) => ({
        name: field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        allocated: val.allocated,
        distributed: val.distributed,
        remaining: Math.max(0, val.allocated - val.distributed),
      })).sort((a, b) => b.allocated - a.allocated);

      // ── Set state ─────────────────────────────────────────
      setData({
        kpi,
        seasonComparison,
        claimRateTrend,
        barangayDensity,
        subsidyBreakdown,
        requestStats,
        currentSeason,
        loading: false,
        error: null,
        lastUpdated: new Date(),
      });
    } catch (err: any) {
      console.error("Error fetching admin dashboard stats:", err);
      setData((prev) => ({
        ...prev,
        loading: false,
        error: err.message || "Failed to load dashboard data",
      }));
    }
  }, [selectedAllocationId]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 60000); // refresh every 60s
    return () => clearInterval(interval);
  }, [fetchAll]);

  return data;
};
