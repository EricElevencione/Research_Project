import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';

// ─── Interfaces ────────────────────────────────────────────

export interface DataQualityMetrics {
    totalRegisteredFarmers: number;
    unplottedFarmersCount: number;
    plottedParcelsCount: number;
    dataQualityPercentage: number;
}

export interface BarangayCompletionStat {
    barangayName: string;
    farmerCount: number;
    plottedParcelsCount: number;
    isComplete: boolean; // true if all farmers have at least one plotted parcel
    completionPercentage: number; // % of farmers with plotted parcels
}

export interface UnplottedFarmer {
    id: string;
    farmerName: string;
    barangay: string;
    farmLocation: string;
    latitude: number;
    longitude: number;
    hasInvalidAddress?: boolean; // true if farm location is outside Dumangas or doesn't match
}

export interface TechnicianDashboardData {
    dataQuality: DataQualityMetrics;
    barangayStats: BarangayCompletionStat[];
    unplottedFarmers: UnplottedFarmer[];
    loading: boolean;
    error: string | null;
    lastUpdated: Date;
}

// ─── Hook ──────────────────────────────────────────────────

export const useTechnicianDashboardStats = (): TechnicianDashboardData => {
    const [data, setData] = useState<TechnicianDashboardData>({
        dataQuality: {
            totalRegisteredFarmers: 0,
            unplottedFarmersCount: 0,
            plottedParcelsCount: 0,
            dataQualityPercentage: 0,
        },
        barangayStats: [],
        unplottedFarmers: [],
        loading: true,
        error: null,
        lastUpdated: new Date(),
    });

    const fetchStats = useCallback(async () => {
        try {
            // ── Parallel fetches ──────────────────────────────────
            const [
                submissionsRes,
                landPlotsRes,
            ] = await Promise.all([
                supabase.from('rsbsa_submission').select('*'),
                supabase.from('land_plots').select('*'),
            ]);

            const submissions = submissionsRes.data || [];
            const landPlots = landPlotsRes.data || [];

            // ── Valid Dumangas barangays ───────────────────────────
            const validBarangays = [
                'Aurora-Del Pilar', 'Bacay', 'Bacong', 'Balabag', 'Balud',
                'Bantud', 'Bantud Fabrica', 'Baras', 'Barasan', 'Basa-Mabini Bonifacio',
                'Bolilao', 'Buenaflor Embarkadero', 'Burgos-Regidor', 'Calao', 'Cali',
                'Cansilayan', 'Capaliz', 'Cayos', 'Compayan', 'Dacutan',
                'Ermita', 'Ilaya 1st', 'Ilaya 2nd', 'Ilaya 3rd', 'Jardin',
                'Lacturan', 'Lopez Jaena - Rizal', 'Managuit', 'Maquina', 'Nanding Lopez',
                'Pagdugue', 'Paloc Bigque', 'Paloc Sool', 'Patlad', 'Pd Monfort North',
                'Pd Monfort South', 'Pulao', 'Rosario', 'Sapao', 'Sulangan',
                'Tabucan', 'Talusan', 'Tambobo', 'Tamboilan', 'Victorias',
            ];

            console.log('=== Technician Dashboard Debug ===');
            console.log('Submissions fetched:', submissions.length);
            if (submissions.length > 0) {
                console.log('Sample submission:', submissions[0]);
                console.log('Submission keys:', Object.keys(submissions[0]));
            }
            console.log('Land plots fetched:', landPlots.length);
            if (landPlots.length > 0) {
                console.log('Sample land plot:', landPlots[0]);
                console.log('Land plot keys:', Object.keys(landPlots[0]));
            }

            // Try to figure out the farmer name field from submissions
            let farmerNameField = 'farmer_name';
            if (submissions.length > 0) {
                const keys = Object.keys(submissions[0]);
                if (keys.includes('FIRST NAME')) farmerNameField = 'multi-field'; // Will handle separately
                if (keys.includes('farmer_name')) farmerNameField = 'farmer_name';
            }

            console.log('Using farmer name field:', farmerNameField);

            // Build a set of farmer names that have plotted parcels
            const plottedFarmerNames = new Set<string>();
            landPlots.forEach(p => {
                // Try different name field combinations
                let name = p.farmer_name || 
                    [p.first_name, p.middle_name, p.surname].filter((n: any) => n).join(' ') ||
                    `${p.FIRST_NAME || ''} ${p.MIDDLE_NAME || ''} ${p.LAST_NAME || ''}`.trim();
                
                // Also store alternative formats - last name | first+middle
                if (name && name.trim()) {
                    const normalized = name.toLowerCase().trim();
                    plottedFarmerNames.add(normalized);
                    console.log(`Added plotted farmer: "${name}" -> "${normalized}"`);
                }
            });

            console.log('Total plotted farmers found:', plottedFarmerNames.size);
            console.log('Plotted farmer names:', Array.from(plottedFarmerNames));

            // ── Calculate unplotted farmers ────────────────────────
            const unplotted = submissions.filter(s => {
                let submissionName = s.farmer_name || 
                    [s['FIRST NAME'], s['MIDDLE NAME'], s['LAST NAME']].filter(n => n).join(' ') ||
                    `${s.FIRST_NAME || ''} ${s.MIDDLE_NAME || ''} ${s.LAST_NAME || ''}`.trim();
                submissionName = submissionName.toLowerCase().trim();
                const isUnplotted = !plottedFarmerNames.has(submissionName);
                console.log(`Checking farmer "${submissionName}": ${isUnplotted ? 'UNPLOTTED' : 'plotted'}`);
                return isUnplotted;
            });
            
            const unplottedFarmers: UnplottedFarmer[] = unplotted.map((s, idx) => {
                const name = s.farmer_name || 
                    [s['FIRST NAME'], s['MIDDLE NAME'], s['LAST NAME']].filter((n: any) => n).join(' ') ||
                    `${s.FIRST_NAME || ''} ${s.MIDDLE_NAME || ''} ${s.LAST_NAME || ''}`.trim() ||
                    'N/A';
                const barangay = s.BARANGAY || s.barangay || 'Unknown';
                const farmLocation = s['FARM LOCATION'] || s.farm_location || 'N/A';
                
                // Check if farm location is valid (in Dumangas barangays)
                const hasInvalidAddress = farmLocation !== 'N/A' && !validBarangays.includes(farmLocation.trim());
                
                if (hasInvalidAddress) {
                    console.log(`⚠️ Invalid farm location for farmer "${name}": "${farmLocation}" is not in Dumangas`);
                }
                
                return {
                    id: s.id,
                    farmerName: name,
                    barangay: barangay,
                    farmLocation: farmLocation,
                    hasInvalidAddress,
                    // Use barangay centroid or default to Dumangas center
                    // For simplicity, scatter around the municipality center with slight offsets
                    latitude: 10.865263 + (Math.random() - 0.5) * 0.05,
                    longitude: 122.6983711 + (Math.random() - 0.5) * 0.05,
                };
            });

            // ── Build barangay stats ───────────────────────────────
            const barangayStatsMap = new Map<string, BarangayCompletionStat>();

            // Initialize all barangays from Dumangas map
            const allBarangays = [
                'Aurora-Del Pilar', 'Bacay', 'Bacong', 'Balabag', 'Balud',
                'Bantud', 'Bantud Fabrica', 'Baras', 'Barasan', 'Basa-Mabini Bonifacio',
                'Bolilao', 'Buenaflor Embarkadero', 'Burgos-Regidor', 'Calao', 'Cali',
                'Cansilayan', 'Capaliz', 'Cayos', 'Compayan', 'Dacutan',
                'Ermita', 'Ilaya 1st', 'Ilaya 2nd', 'Ilaya 3rd', 'Jardin',
                'Lacturan', 'Lopez Jaena - Rizal', 'Managuit', 'Maquina', 'Nanding Lopez',
                'Pagdugue', 'Paloc Bigque', 'Paloc Sool', 'Patlad', 'Pd Monfort North',
                'Pd Monfort South', 'Pulao', 'Rosario', 'Sapao', 'Sulangan',
                'Tabucan', 'Talusan', 'Tambobo', 'Tamboilan', 'Victorias',
            ];

            allBarangays.forEach(barangay => {
                // Count farmers by FARM LOCATION (not home address)
                const farmersInBarangay = submissions.filter(s => {
                    const farmLocation = s['FARM LOCATION'] || s.farm_location;
                    return farmLocation === barangay;
                });
                
                // Count plotted parcels by barangay
                const plottedInBarangay = landPlots.filter(p => {
                    const barangayVal = p.barangay || p.BARANGAY;
                    return barangayVal === barangay;
                });

                const farmerCount = farmersInBarangay.length;
                const plottedParcelsCount = plottedInBarangay.length;
                
                // Log barangays with farmers for debugging
                if (farmerCount > 0) {
                    console.log(`Barangay "${barangay}": ${farmerCount} farmers farming here, ${plottedParcelsCount} plotted parcels`);
                }
                
                const completionPercentage = farmerCount > 0 ? Math.round((plottedParcelsCount / farmerCount) * 100) : 0;
                const isComplete = farmerCount > 0 && plottedParcelsCount >= farmerCount;

                barangayStatsMap.set(barangay, {
                    barangayName: barangay,
                    farmerCount,
                    plottedParcelsCount,
                    isComplete,
                    completionPercentage,
                });
            });

            const barangayStats = Array.from(barangayStatsMap.values()).sort((a, b) =>
                a.barangayName.localeCompare(b.barangayName)
            );

            // ── Calculate data quality metrics ─────────────────────
            const totalRegisteredFarmers = submissions.length;
            // Count all unplotted farmers (those without any plotted land parcels)
            const unplottedFarmersCount = unplotted.length;
            const plottedParcelsCount = landPlots.length;
            const dataQualityPercentage = totalRegisteredFarmers > 0
                ? Math.round(((totalRegisteredFarmers - unplottedFarmersCount) / totalRegisteredFarmers) * 100)
                : 0;

            setData({
                dataQuality: {
                    totalRegisteredFarmers,
                    unplottedFarmersCount,
                    plottedParcelsCount,
                    dataQualityPercentage,
                },
                barangayStats,
                unplottedFarmers: unplottedFarmers.sort((a, b) => a.barangay.localeCompare(b.barangay)),
                loading: false,
                error: null,
                lastUpdated: new Date(),
            });
        } catch (err: any) {
            console.error('Error fetching technician dashboard stats:', err);
            setData(prev => ({
                ...prev,
                loading: false,
                error: 'Failed to load data quality metrics',
            }));
        }
    }, []);

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 60000); // Refresh every minute
        return () => clearInterval(interval);
    }, [fetchStats]);

    return data;
};
