import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';

// ─── Interfaces ────────────────────────────────────────────

export interface KPIStats {
    totalFarmers: number;
    totalHectares: number;
    fulfillmentRate: number;   // % of approved/distributed vs total requests
    claimRate: number;         // % of claimed vs distributed
}

export interface SeasonAllocation {
    season: string;
    label: string;             // e.g. "Dry 2026"
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
    week: string;              // e.g. "Jan 6", "Jan 13"
    weekStart: string;         // ISO date
    distributed: number;
    claimed: number;
    claimRate: number;         // percentage
}

export interface BarangayDensity {
    name: string;
    farmerCount: number;
    hectares: number;
}

export interface AdminDashboardData {
    kpi: KPIStats;
    seasonComparison: SeasonAllocation[];
    claimRateTrend: ClaimRateTrend[];
    barangayDensity: BarangayDensity[];
    currentSeason: string;
    loading: boolean;
    error: string | null;
    lastUpdated: Date;
}

// ─── Format helpers ────────────────────────────────────────

export const formatSeasonLabel = (season: string): string => {
    const [type, year] = season.split('_');
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
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ─── Hook ──────────────────────────────────────────────────

export const useAdminDashboardStats = (selectedSeason?: string): AdminDashboardData => {
    const [data, setData] = useState<AdminDashboardData>({
        kpi: { totalFarmers: 0, totalHectares: 0, fulfillmentRate: 0, claimRate: 0 },
        seasonComparison: [],
        claimRateTrend: [],
        barangayDensity: [],
        currentSeason: getCurrentSeason(),
        loading: true,
        error: null,
        lastUpdated: new Date(),
    });

    const fetchAll = useCallback(async () => {
        try {
            const currentSeason = selectedSeason || getCurrentSeason();

            // ── Parallel fetches ──────────────────────────────────
            const [
                farmersRes,
                parcelsRes,
                requestsRes,
                allocationsRes,
                distributionsRes,
            ] = await Promise.all([
                supabase.from('rsbsa_submission').select('id, BARANGAY, "FARM LOCATION", "TOTAL FARM AREA", status'),
                supabase.from('rsbsa_farm_parcels').select('submission_id, farm_location_barangay, total_farm_area_ha, is_current_owner'),
                supabase.from('farmer_requests').select('id, status, season, created_at'),
                supabase.from('regional_allocations').select('*'),
                supabase.from('distribution_records').select('id, request_id, fertilizer_bags_given, seed_kg_given, claimed, claim_date, distribution_date, created_at'),
            ]);

            const farmers = farmersRes.data || [];
            const parcels = parcelsRes.data || [];
            const requests = requestsRes.data || [];
            const allocations = allocationsRes.data || [];
            const distributions = distributionsRes.data || [];

            // ── KPI Stats ─────────────────────────────────────────
            const totalFarmers = farmers.length;

            // Total hectares from farm parcels (current owners only)
            const currentParcels = parcels.filter((p: any) => p.is_current_owner === true);
            const totalHectares = currentParcels.reduce((sum: number, p: any) => {
                const area = parseFloat(p.total_farm_area_ha) || 0;
                return sum + area;
            }, 0);

            // Fallback: if no parcels, sum from submissions
            const totalHectaresFallback = totalHectares > 0 ? totalHectares :
                farmers.reduce((sum: number, f: any) => sum + (parseFloat(f['TOTAL FARM AREA']) || 0), 0);

            // Fulfillment rate: approved+distributed / total requests for current season
            const currentSeasonRequests = requests.filter((r: any) => r.season === currentSeason);
            const fulfilledRequests = currentSeasonRequests.filter((r: any) =>
                r.status === 'approved' || r.status === 'distributed'
            ).length;
            const fulfillmentRate = currentSeasonRequests.length > 0
                ? Math.round((fulfilledRequests / currentSeasonRequests.length) * 100) : 0;

            // Claim rate: claimed / total distributed
            const totalDistributed = distributions.length;
            const totalClaimed = distributions.filter((d: any) => d.claimed === true).length;
            const claimRate = totalDistributed > 0
                ? Math.round((totalClaimed / totalDistributed) * 100) : 0;

            const kpi: KPIStats = {
                totalFarmers,
                totalHectares: Math.round(totalHectaresFallback * 100) / 100,
                fulfillmentRate,
                claimRate,
            };

            // ── Season Comparison ─────────────────────────────────
            // Get all unique seasons from requests + allocations
            const allSeasons = new Set<string>();
            requests.forEach((r: any) => { if (r.season) allSeasons.add(r.season); });
            allocations.forEach((a: any) => { if (a.season) allSeasons.add(a.season); });

            // Sort seasons chronologically
            const seasonOrder = (s: string) => {
                const [type, year] = s.split('_');
                const y = parseInt(year) || 0;
                return y * 2 + (type === 'wet' ? 1 : 0);
            };
            const sortedSeasons = Array.from(allSeasons).sort((a, b) => seasonOrder(a) - seasonOrder(b));

            const seasonComparison: SeasonAllocation[] = sortedSeasons.map(season => {
                const allocation = allocations.find((a: any) => a.season === season);
                const seasonReqs = requests.filter((r: any) => r.season === season);
                const seasonReqIds = new Set(seasonReqs.map((r: any) => r.id));
                const seasonDists = distributions.filter((d: any) => seasonReqIds.has(d.request_id));

                const fertilizerAllocated = allocation ? (
                    (allocation.urea_46_0_0_bags || 0) +
                    (allocation.complete_14_14_14_bags || 0) +
                    (allocation.ammonium_sulfate_21_0_0_bags || 0) +
                    (allocation.muriate_potash_0_0_60_bags || 0)
                ) : 0;

                const seedsAllocated = allocation ? (
                    (allocation.jackpot_kg || 0) +
                    (allocation.us88_kg || 0) +
                    (allocation.th82_kg || 0) +
                    (allocation.rh9000_kg || 0) +
                    (allocation.lumping143_kg || 0) +
                    (allocation.lp296_kg || 0)
                ) : 0;

                const fertilizerDistributed = seasonDists.reduce((s: number, d: any) => s + (d.fertilizer_bags_given || 0), 0);
                const seedsDistributed = seasonDists.reduce((s: number, d: any) => s + (d.seed_kg_given || 0), 0);

                return {
                    season,
                    label: formatSeasonLabel(season),
                    fertilizerAllocated,
                    fertilizerDistributed,
                    seedsAllocated,
                    seedsDistributed,
                    totalAllocated: fertilizerAllocated + seedsAllocated,
                    totalDistributed: fertilizerDistributed + seedsDistributed,
                    totalRequests: seasonReqs.length,
                    approvedRequests: seasonReqs.filter((r: any) => r.status === 'approved' || r.status === 'distributed').length,
                    distributedRequests: seasonReqs.filter((r: any) => r.status === 'distributed').length,
                    claimedCount: seasonDists.filter((d: any) => d.claimed === true).length,
                };
            });

            // ── Claim Rate Trend (weekly) ─────────────────────────
            // Group distributions by week
            const weekMap = new Map<string, { distributed: number; claimed: number; weekStart: Date }>();

            distributions.forEach((d: any) => {
                const date = new Date(d.distribution_date || d.created_at);
                const ws = getWeekStart(date);
                const key = ws.toISOString().split('T')[0];
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
                    claimRate: val.distributed > 0 ? Math.round((val.claimed / val.distributed) * 100) : 0,
                }));

            // ── Barangay Density ──────────────────────────────────
            const barangayMap = new Map<string, { farmerCount: number; hectares: number }>();
            farmers.forEach((f: any) => {
                // Use FARM LOCATION (where they farm) for density
                const brgy = f['FARM LOCATION'] || f['BARANGAY'] || 'Unknown';
                if (!brgy || brgy === 'Unknown') return;
                if (!barangayMap.has(brgy)) {
                    barangayMap.set(brgy, { farmerCount: 0, hectares: 0 });
                }
                const entry = barangayMap.get(brgy)!;
                entry.farmerCount++;
                entry.hectares += parseFloat(f['TOTAL FARM AREA']) || 0;
            });

            const barangayDensity: BarangayDensity[] = Array.from(barangayMap.entries())
                .map(([name, val]) => ({
                    name,
                    farmerCount: val.farmerCount,
                    hectares: Math.round(val.hectares * 100) / 100,
                }))
                .sort((a, b) => b.farmerCount - a.farmerCount);

            // ── Set state ─────────────────────────────────────────
            setData({
                kpi,
                seasonComparison,
                claimRateTrend,
                barangayDensity,
                currentSeason,
                loading: false,
                error: null,
                lastUpdated: new Date(),
            });

        } catch (err: any) {
            console.error('Error fetching admin dashboard stats:', err);
            setData(prev => ({
                ...prev,
                loading: false,
                error: err.message || 'Failed to load dashboard data',
            }));
        }
    }, [selectedSeason]);

    useEffect(() => {
        fetchAll();
        const interval = setInterval(fetchAll, 60000); // refresh every 60s
        return () => clearInterval(interval);
    }, [fetchAll]);

    return data;
};
