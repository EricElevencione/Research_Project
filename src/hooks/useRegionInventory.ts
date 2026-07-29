import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase";

// ─── Types ──────────────────────────────────────────────────

export interface RegionInventoryItem {
  id: string;         // product_id
  name: string;       // resolved from shortages_seeds / shortages_fertilizers
  productType: "seed" | "fertilizer";
  allocated: number;  // stock_qty (total stock received)
  distributed: number; // used_qty
  requested: number;  // from farmer_requests
  remaining: number;  // stock_qty - used_qty (floored at 0)
}

export interface RegionInventoryData {
  items: RegionInventoryItem[];
  allocationOptions: { allocationId: number; label: string }[];
  loading: boolean;
  error: string | null;
}

// ─── Hook ───────────────────────────────────────────────────

export const useRegionInventory = (
  selectedAllocationId?: number,
): RegionInventoryData => {
  const [data, setData] = useState<RegionInventoryData>({
    items: [],
    allocationOptions: [],
    loading: true,
    error: null,
  });

  const fetchAll = useCallback(async () => {
    try {
      const [
        inventoryRes,
        seedCatalogRes,
        fertCatalogRes,
        allocationsRes,
        requestsRes,
      ] = await Promise.all([
        supabase.from("inventory").select("*"),
        supabase.from("shortages_seeds").select("id, name, category"),
        supabase.from("shortages_fertilizers").select("id, name, category"),
        supabase.from("regional_allocations").select("id, season, allocation_date"),
        supabase.from("farmer_requests").select("*"),
      ]);

      const inventoryRows = inventoryRes.data || [];
      const seeds = seedCatalogRes.data || [];
      const ferts = fertCatalogRes.data || [];
      const allocations = allocationsRes.data || [];
      const requests = requestsRes.data || [];

      // Build name lookup maps
      const seedNameMap = new Map<string, string>();
      seeds.forEach((s: any) => seedNameMap.set(s.id, s.name));
      const fertNameMap = new Map<string, string>();
      ferts.forEach((f: any) => fertNameMap.set(f.id, f.name));

      // Build allocation options for the dropdown
      const allocationOptions = allocations
        .sort((a: any, b: any) => {
          const statusA = (a.status || 'active').toLowerCase();
          const statusB = (b.status || 'active').toLowerCase();
          if (statusA !== statusB) {
            if (statusA === 'active') return -1;
            if (statusB === 'active') return 1;
          }
          return (a.allocation_date || '').localeCompare(b.allocation_date || '');
        })
        .map((a: any) => {
          const [type, year] = (a.season || '').split('_');
          const label = `${type ? type.charAt(0).toUpperCase() + type.slice(1) : ''} ${year || ''}`.trim();
          const dateStr = a.allocation_date
            ? new Date(a.allocation_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : '';
          return {
            allocationId: a.id,
            label: dateStr ? `${label} (${dateStr})` : label,
          };
        });

      // Build requested amounts from farmer_requests
      // Map: product_id → requested total
      const requestedMap = new Map<string, number>();

      const filteredRequests = selectedAllocationId
        ? requests.filter((r: any) => r.allocation_id === selectedAllocationId)
        : requests;

      filteredRequests.forEach((req: any) => {
        Object.keys(req)
          .filter(k => k.startsWith('requested_'))
          .forEach(rf => {
            const val = Number(req[rf]) || 0;
            if (val > 0) {
              // Use the field name as a key — map to product name later
              const current = requestedMap.get(rf) || 0;
              requestedMap.set(rf, current + val);
            }
          });
      });

      // Build the items list from the inventory table
      const items: RegionInventoryItem[] = inventoryRows.map((row: any) => {
        const stockQty = Number(row.stock_qty) || 0;
        const usedQty = Number(row.used_qty) || 0;
        const remaining = Math.max(0, stockQty - usedQty);
        const productType: "seed" | "fertilizer" = row.product_type === 'seed' ? 'seed' : 'fertilizer';

        const name = productType === 'seed'
          ? (seedNameMap.get(row.product_id) || row.product_id)
          : (fertNameMap.get(row.product_id) || row.product_id);

        return {
          id: row.product_id,
          name,
          productType,
          allocated: stockQty,
          distributed: usedQty,
          requested: 0, // we'll enrich below if needed
          remaining,
        };
      });

      // Sort: seeds first, then fertilizers; within each group, alphabetically
      items.sort((a, b) => {
        if (a.productType !== b.productType) {
          return a.productType === 'seed' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      setData({
        items,
        allocationOptions,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      console.error("Error fetching region inventory:", err);
      setData(prev => ({
        ...prev,
        loading: false,
        error: err.message || "Failed to load inventory data",
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
