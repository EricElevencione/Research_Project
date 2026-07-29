import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase";
import { formatSeasonLabel } from "./useAdminDashboardStats";

export interface TopVariety {
  id: string;
  name: string;
  type: "seed" | "fertilizer";
  totalRequested: number;
}

export interface StockAlert {
  id: string;
  name: string;
  type: "seed" | "fertilizer";
  shortageAmount: number;
  remainingStock: number;
  totalRequested: number;
}

export interface RequestStatusCounts {
  pending: number;
  approved: number;
  distributed: number;
  rejected: number;
  total: number;
}

export interface BarangayDemand {
  name: string;
  totalRequests: number;
  totalBagsOrKg: number;
}

export interface RegionDashboardKPI {
  totalFarmersReached: number;
  totalHectaresCovered: number;
  totalActiveRequests: number;
  overallFulfillmentRate: number;
}

export interface AllocationBurn {
  allocationId: number;
  label: string;
  totalAllocated: number;
  totalDistributed: number;
  burnRatePercent: number;
}

export interface RegionDashboardData {
  kpi: RegionDashboardKPI;
  topRequestedVarieties: TopVariety[];
  stockShortageAlerts: StockAlert[];
  requestStatusCounts: RequestStatusCounts;
  barangayDemand: BarangayDemand[];
  allocationBurnRate: AllocationBurn[];
  currentSeason: string;
  loading: boolean;
  error: string | null;
  lastUpdated: Date;
}

const getCurrentSeason = (): string => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  return month >= 5 && month <= 10 ? `wet_${year}` : `dry_${year}`;
};

export const useRegionDashboardStats = (selectedAllocationId?: number): RegionDashboardData => {
  const [data, setData] = useState<RegionDashboardData>({
    kpi: {
      totalFarmersReached: 0,
      totalHectaresCovered: 0,
      totalActiveRequests: 0,
      overallFulfillmentRate: 0,
    },
    topRequestedVarieties: [],
    stockShortageAlerts: [],
    requestStatusCounts: { pending: 0, approved: 0, distributed: 0, rejected: 0, total: 0 },
    barangayDemand: [],
    allocationBurnRate: [],
    currentSeason: getCurrentSeason(),
    loading: true,
    error: null,
    lastUpdated: new Date(),
  });

  const fetchAll = useCallback(async () => {
    try {
      const [
        requestsRes,
        allocationsRes,
        distributionsRes,
        inventoryRes,
        seedCatalogRes,
        fertCatalogRes,
        farmersRes,
      ] = await Promise.all([
        supabase.from("farmer_requests").select("*"),
        supabase.from("regional_allocations").select("*"),
        supabase.from("distribution_records").select("id, request_id, fertilizer_bags_given, seed_kg_given, claimed"),
        supabase.from("inventory").select("*"),
        supabase.from("shortages_seeds").select("id, name, category"),
        supabase.from("shortages_fertilizers").select("id, name, category"),
        supabase.from("rsbsa_submission").select('id, BARANGAY, "TOTAL FARM AREA"'),
      ]);

      const requests = requestsRes.data || []; console.log('FETCHED REQUESTS:', requests);
      const allocations = allocationsRes.data || [];
      const distributions = distributionsRes.data || [];
      const inventory = inventoryRes.data || [];
      const seedCatalog = seedCatalogRes.data || [];
      const fertCatalog = fertCatalogRes.data || [];
      // const farmers = farmersRes.data || []; // not strictly needed since we pull from requests

      // Maps for names
      const seedNameMap = new Map<string, string>();
      seedCatalog.forEach((s: any) => seedNameMap.set(s.id, s.name));
      const fertNameMap = new Map<string, string>();
      fertCatalog.forEach((f: any) => fertNameMap.set(f.id, f.name));

      // Active Allocations (used for filtering and burn rate)
      const activeAllocations = allocations.filter((a: any) => (a.status || "active") !== "closed");
      const activeAllocIds = new Set(activeAllocations.map((a: any) => a.id));

      // Filter requests by program if selected, otherwise include all requests
      let activeRequests = selectedAllocationId
        ? requests.filter((r: any) => r.allocation_id === selectedAllocationId)
        : requests;

      // --- Request Status Counts ---
      const requestStatusCounts: RequestStatusCounts = {
        pending: activeRequests.filter((r: any) => (r.status || "").toLowerCase() === "pending" || (r.status || "").toLowerCase() === "not_claimed").length,
        approved: activeRequests.filter((r: any) => (r.status || "").toLowerCase() === "approved" || (r.status || "").toLowerCase() === "claimed").length,
        distributed: activeRequests.filter((r: any) => (r.status || "").toLowerCase() === "distributed").length,
        rejected: activeRequests.filter((r: any) => (r.status || "").toLowerCase() === "rejected").length,
        total: activeRequests.length,
      };

      // --- KPI ---
      const fulfilledRequestsCount = requestStatusCounts.approved + requestStatusCounts.distributed;
      const overallFulfillmentRate = activeRequests.length > 0
        ? Math.round((fulfilledRequestsCount / activeRequests.length) * 100)
        : 0;

      const fulfilledRequests = activeRequests.filter((r: any) => 
        (r.status || "").toLowerCase() === "approved" || 
        (r.status || "").toLowerCase() === "distributed" || 
        (r.status || "").toLowerCase() === "claimed"
      );
      
      const uniqueFarmers = new Set(fulfilledRequests.map((r: any) => r.farmer_id));
      let totalHectaresCovered = 0;
      fulfilledRequests.forEach((req: any) => {
        totalHectaresCovered += (parseFloat(req.farm_area_ha) || 0);
      });

      const kpi: RegionDashboardKPI = {
        totalFarmersReached: uniqueFarmers.size,
        totalHectaresCovered: Math.round(totalHectaresCovered * 100) / 100,
        totalActiveRequests: activeRequests.length,
        overallFulfillmentRate,
      };

      // --- Variety Demand & Alerts ---
      const varietyDemandMap = new Map<string, { totalRequested: number; type: "seed" | "fertilizer"; displayName: string }>();
      const barangayDemandMap = new Map<string, { totalRequests: number; totalVolume: number }>();

      activeRequests.forEach((req: any) => {
        // Barangay processing
        const brgy = req.barangay || "Unknown";
        if (!barangayDemandMap.has(brgy)) {
          barangayDemandMap.set(brgy, { totalRequests: 0, totalVolume: 0 });
        }
        const bEntry = barangayDemandMap.get(brgy)!;
        bEntry.totalRequests += 1;

        // Field processing
        const reqFields = Object.keys(req).filter((k) => k.startsWith('requested_'));
        reqFields.forEach((rf) => {
          const val = Number(req[rf]) || 0;
          if (val > 0) {
            bEntry.totalVolume += val;

            let fieldName = rf.replace('requested_', '').replace(/_bags|_kg|_liters/g, '');
            let allocField = rf.replace('requested_', '');
            
            // Map to allocation field names for comparison later
            if (allocField === 'complete_14_bags') allocField = 'complete_14_14_14_bags';
            if (allocField === 'ammonium_sulfate_bags') allocField = 'ammonium_sulfate_21_0_0_bags';
            if (allocField === 'muriate_potash_bags') allocField = 'muriate_potash_0_0_60_bags';
            if (allocField === 'urea_bags') allocField = 'urea_46_0_0_bags';
            if (allocField === 'ammonium_phosphate_bags') allocField = 'np_16_20_0_bags';
            if (allocField === 'complete_16_bags') allocField = 'complete_16_16_16_bags';

            const isSeed = rf.includes('_kg') || fieldName.includes('seed');
            const type: "seed" | "fertilizer" = isSeed ? "seed" : "fertilizer";
            
            let displayName = fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            // Try to use catalog name if exact match
            if (isSeed && seedNameMap.has(fieldName)) displayName = seedNameMap.get(fieldName)!;
            if (!isSeed && fertNameMap.has(fieldName)) displayName = fertNameMap.get(fieldName)!;

            const existing = varietyDemandMap.get(allocField) || { totalRequested: 0, type, displayName };
            
            // Only sum up requests that are pending or approved for alerts/demand
            if ((req.status || "").toLowerCase() === "pending" || (req.status || "").toLowerCase() === "approved") {
               existing.totalRequested += val;
            }

            varietyDemandMap.set(allocField, existing);
          }
        });
      });

      const topRequestedVarieties: TopVariety[] = Array.from(varietyDemandMap.entries())
        .map(([field, data]) => ({
          id: field,
          name: data.displayName,
          type: data.type,
          totalRequested: data.totalRequested,
        }))
        .filter(v => v.totalRequested > 0)
        .sort((a, b) => b.totalRequested - a.totalRequested)
        .slice(0, 5); // Top 5

      const barangayDemand: BarangayDemand[] = Array.from(barangayDemandMap.entries())
        .map(([name, data]) => ({
          name,
          totalRequests: data.totalRequests,
          totalBagsOrKg: Math.round(data.totalVolume),
        }))
        .sort((a, b) => b.totalRequests - a.totalRequests)
        .slice(0, 10); // Top 10

      // --- Stock Alerts ---
      // Get remaining stock either from selected allocation or master inventory
      const stockShortageAlerts: StockAlert[] = [];
      
      if (selectedAllocationId) {
        const alloc = allocations.find((a: any) => a.id === selectedAllocationId);
        if (alloc) {
          varietyDemandMap.forEach((data, field) => {
            const allocated = Number(alloc[field]) || 0;
            // Get distributed for this specific program and field
            // To simplify, we'll check if requested > allocated as a primary alert
            // Since we can't easily break down distributions per specific field for this allocation easily without re-parsing,
            // we will use the generic assumption that totalRequested > allocated is a shortage.
            
            if (data.totalRequested > allocated) {
              stockShortageAlerts.push({
                id: field,
                name: data.displayName,
                type: data.type,
                shortageAmount: data.totalRequested - allocated,
                remainingStock: allocated,
                totalRequested: data.totalRequested,
              });
            }
          });
        }
      } else {
        // Master view - use inventory table
        varietyDemandMap.forEach((data, field) => {
          // Attempt to match field with inventory product_id
          // This mapping might not be 1:1, a robust mapping is needed or we match via string similarity
          let matchedInv = inventory.find((i: any) => 
             i.product_id === field || 
             field.includes(i.product_id) || 
             i.product_id.includes(field.replace('_bags','').replace('_kg',''))
          );

          if (matchedInv) {
            const stockQty = Number(matchedInv.stock_qty) || 0;
            const usedQty = Number(matchedInv.used_qty) || 0;
            const remaining = Math.max(0, stockQty - usedQty);

            if (data.totalRequested > remaining) {
              stockShortageAlerts.push({
                id: field,
                name: data.displayName,
                type: data.type,
                shortageAmount: data.totalRequested - remaining,
                remainingStock: remaining,
                totalRequested: data.totalRequested,
              });
            }
          }
        });
      }

      stockShortageAlerts.sort((a, b) => b.shortageAmount - a.shortageAmount);

      // --- Allocation Burn Rate ---
      const allocationBurnRate: AllocationBurn[] = activeAllocations.map((alloc: any) => {
        const allocReqs = requests.filter((r: any) => r.allocation_id === alloc.id);
        const allocReqIds = new Set(allocReqs.map((r: any) => r.id));
        const allocDists = distributions.filter((d: any) => allocReqIds.has(d.request_id));

        const fertilizerAllocated =
          (Number(alloc.urea_46_0_0_bags) || 0) +
          (Number(alloc.complete_14_14_14_bags) || 0) +
          (Number(alloc.ammonium_sulfate_21_0_0_bags) || 0) +
          (Number(alloc.muriate_potash_0_0_60_bags) || 0);

        const seedsAllocated =
          (Number(alloc.jackpot_kg) || 0) +
          (Number(alloc.us88_kg) || 0) +
          (Number(alloc.th82_kg) || 0) +
          (Number(alloc.rh9000_kg) || 0) +
          (Number(alloc.lumping143_kg) || 0) +
          (Number(alloc.lp296_kg) || 0);

        const totalAllocated = fertilizerAllocated + seedsAllocated;
        const totalDistributed = allocDists.reduce((s: number, d: any) => s + (Number(d.fertilizer_bags_given) || 0) + (Number(d.seed_kg_given) || 0), 0);

        return {
          allocationId: alloc.id,
          label: formatSeasonLabel(alloc.season),
          totalAllocated,
          totalDistributed,
          burnRatePercent: totalAllocated > 0 ? Math.round((totalDistributed / totalAllocated) * 100) : 0,
        };
      });

      setData({
        kpi,
        topRequestedVarieties,
        stockShortageAlerts,
        requestStatusCounts,
        barangayDemand,
        allocationBurnRate,
        currentSeason: getCurrentSeason(),
        loading: false,
        error: null,
        lastUpdated: new Date(),
      });
    } catch (err: any) {
      console.error("Error fetching region dashboard stats:", err);
      setData((prev) => ({
        ...prev,
        loading: false,
        error: err.message || "Failed to load dashboard data",
      }));
    }
  }, [selectedAllocationId]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 60000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  return data;
};
