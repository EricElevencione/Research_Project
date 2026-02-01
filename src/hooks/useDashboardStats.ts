import { useState, useEffect } from 'react';
import { getRsbsaSubmissions } from '../api';

interface BarangayStats {
    name: string;
    farmers: number;
    landowners: number;
}

interface DashboardStats {
    totalFarmers: number;
    totalLandowners: number;
    barangayStats: BarangayStats[];
    loading: boolean;
    error: string | null;
}

export const useDashboardStats = (): DashboardStats => {
    const [stats, setStats] = useState<DashboardStats>({
        totalFarmers: 0,
        totalLandowners: 0,
        barangayStats: [],
        loading: true,
        error: null,
    });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await getRsbsaSubmissions();
                if (response.error) throw new Error('Failed to fetch data');

                const data = response.data || [];

                // Count active farmers and landowners by barangay
                const barangayMap = new Map<string, { farmers: number; landowners: number }>();

                data.forEach((record: any) => {
                    const barangay = record.farmLocation || 'Unknown';
                    const isActiveFarmer = record.status === 'Active Farmer';

                    // Check if they are a landowner (registered owner)
                    const isLandowner = record.ownershipType?.registeredOwner === true &&
                        record.ownershipType?.tenant === false &&
                        record.ownershipType?.lessee === false;

                    if (!barangayMap.has(barangay)) {
                        barangayMap.set(barangay, { farmers: 0, landowners: 0 });
                    }

                    const current = barangayMap.get(barangay)!;

                    if (isActiveFarmer) {
                        current.farmers++;
                    }

                    if (isLandowner) {
                        current.landowners++;
                    }
                });

                // Convert map to array and calculate totals
                const barangayStats: BarangayStats[] = Array.from(barangayMap.entries())
                    .map(([name, counts]) => ({
                        name,
                        farmers: counts.farmers,
                        landowners: counts.landowners,
                    }))
                    .filter(stat => stat.name !== 'Unknown' && (stat.farmers > 0 || stat.landowners > 0))
                    .sort((a, b) => a.name.localeCompare(b.name));

                const totalFarmers = barangayStats.reduce((sum, stat) => sum + stat.farmers, 0);
                const totalLandowners = barangayStats.reduce((sum, stat) => sum + stat.landowners, 0);

                setStats({
                    totalFarmers,
                    totalLandowners,
                    barangayStats,
                    loading: false,
                    error: null,
                });
            } catch (error: any) {
                setStats(prev => ({
                    ...prev,
                    loading: false,
                    error: error.message || 'Failed to load statistics',
                }));
            }
        };

        fetchStats();

        // Refresh every 30 seconds
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, []);

    return stats;
};
