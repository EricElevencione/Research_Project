import { useState, useEffect, useMemo } from 'react';

// ─── Interfaces ────────────────────────────────────────────

export interface AgeBracket {
    bracket: string;
    count: number;
    percentage: number;
}

export interface CropDistribution {
    crop: string;
    count: number;
    percentage: number;
    color: string;
}

export interface FarmSizeCategory {
    label: string;
    description: string;
    count: number;
    percentage: number;
    icon: string;
    color: string;
    bgGradient: string;
}

export interface OwnershipBreakdown {
    type: string;
    count: number;
    percentage: number;
    color: string;
}

export interface GenderBreakdown {
    gender: string;
    count: number;
    percentage: number;
    color: string;
}

export interface RSBSADemographicsData {
    ageBrackets: AgeBracket[];
    cropDistribution: CropDistribution[];
    farmSizeCategories: FarmSizeCategory[];
    ownershipBreakdown: OwnershipBreakdown[];
    genderBreakdown: GenderBreakdown[];
    totalFarmers: number;
    loading: boolean;
    error: string | null;
}

// ─── Helpers ───────────────────────────────────────────────

const calculateAge = (birthdate: string): number | null => {
    if (!birthdate) return null;
    const birth = new Date(birthdate);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age >= 0 ? age : null;
};

const pct = (count: number, total: number) =>
    total > 0 ? Math.round((count / total) * 100) : 0;

// ─── Hook ──────────────────────────────────────────────────

export const useRSBSADemographics = (records: any[]): RSBSADemographicsData => {
    const [loading, setLoading] = useState(true);
    const [error] = useState<string | null>(null);

    useEffect(() => {
        if (records && records.length >= 0) {
            setLoading(false);
        }
    }, [records]);

    const demographics = useMemo(() => {
        if (!records || records.length === 0) {
            return {
                ageBrackets: [],
                cropDistribution: [],
                farmSizeCategories: [],
                ownershipBreakdown: [],
                genderBreakdown: [],
                totalFarmers: 0,
            };
        }

        const total = records.length;

        // ── Age Distribution ─────────────────────────────
        const ageBuckets: Record<string, number> = {
            '< 20': 0,
            '20-29': 0,
            '30-39': 0,
            '40-49': 0,
            '50-59': 0,
            '60-69': 0,
            '70+': 0,
        };
        const bracketOrder = Object.keys(ageBuckets);

        records.forEach((r) => {
            const age = r.age ?? calculateAge(r.birthdate);
            if (age === null) return;
            if (age < 20) ageBuckets['< 20']++;
            else if (age < 30) ageBuckets['20-29']++;
            else if (age < 40) ageBuckets['30-39']++;
            else if (age < 50) ageBuckets['40-49']++;
            else if (age < 60) ageBuckets['50-59']++;
            else if (age < 70) ageBuckets['60-69']++;
            else ageBuckets['70+']++;
        });

        const ageBrackets: AgeBracket[] = bracketOrder.map((bracket) => ({
            bracket,
            count: ageBuckets[bracket],
            percentage: pct(ageBuckets[bracket], total),
        }));

        // ── Crop Type Distribution ───────────────────────
        const cropFields: { key: string; label: string; color: string }[] = [
            { key: 'farmerRice', label: 'Rice', color: '#16a34a' },
            { key: 'farmerCorn', label: 'Corn', color: '#eab308' },
            { key: 'farmerOtherCrops', label: 'Other Crops', color: '#0ea5e9' },
            { key: 'farmerLivestock', label: 'Livestock', color: '#f97316' },
            { key: 'farmerPoultry', label: 'Poultry', color: '#8b5cf6' },
        ];

        const cropDistribution: CropDistribution[] = cropFields.map(({ key, label, color }) => {
            const count = records.filter((r) => r[key] === true).length;
            return { crop: label, count, percentage: pct(count, total), color };
        });

        // ── Farm Size Distribution ───────────────────────
        let small = 0,
            medium = 0,
            large = 0;

        records.forEach((r) => {
            const area =
                typeof r.totalFarmArea === 'number'
                    ? r.totalFarmArea
                    : parseFloat(String(r.totalFarmArea || 0));
            if (isNaN(area) || area <= 0) return;
            if (area < 2) small++;
            else if (area <= 4) medium++;
            else large++;
        });

        const farmSizeCategories: FarmSizeCategory[] = [
            {
                label: 'Small',
                description: '< 2 hectares',
                count: small,
                percentage: pct(small, total),
                icon: '🌱',
                color: '#16a34a',
                bgGradient: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
            },
            {
                label: 'Medium',
                description: '2 – 4 hectares',
                count: medium,
                percentage: pct(medium, total),
                icon: '🌿',
                color: '#0ea5e9',
                bgGradient: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
            },
            {
                label: 'Large',
                description: '> 4 hectares',
                count: large,
                percentage: pct(large, total),
                icon: '🌳',
                color: '#8b5cf6',
                bgGradient: 'linear-gradient(135deg, #faf5ff 0%, #ede9fe 100%)',
            },
        ];

        // ── Ownership Type Breakdown ─────────────────────
        let registered = 0,
            tenantCount = 0,
            lesseeCount = 0;

        records.forEach((r) => {
            if (r.ownershipType?.registeredOwner) registered++;
            if (r.ownershipType?.tenant) tenantCount++;
            if (r.ownershipType?.lessee) lesseeCount++;
        });

        const ownershipBreakdown: OwnershipBreakdown[] = [
            { type: 'Registered Owner', count: registered, percentage: pct(registered, total), color: '#16a34a' },
            { type: 'Tenant', count: tenantCount, percentage: pct(tenantCount, total), color: '#f59e0b' },
            { type: 'Lessee', count: lesseeCount, percentage: pct(lesseeCount, total), color: '#ef4444' },
        ];

        // ── Gender Breakdown (bonus) ─────────────────────
        let male = 0,
            female = 0,
            otherGender = 0;

        records.forEach((r) => {
            const g = (r.gender || '').toLowerCase();
            if (g === 'male') male++;
            else if (g === 'female') female++;
            else otherGender++;
        });

        const genderBreakdown: GenderBreakdown[] = [
            { gender: 'Male', count: male, percentage: pct(male, total), color: '#3b82f6' },
            { gender: 'Female', count: female, percentage: pct(female, total), color: '#ec4899' },
            ...(otherGender > 0
                ? [{ gender: 'Other', count: otherGender, percentage: pct(otherGender, total), color: '#6b7280' }]
                : []),
        ];

        return {
            ageBrackets,
            cropDistribution,
            farmSizeCategories,
            ownershipBreakdown,
            genderBreakdown,
            totalFarmers: total,
        };
    }, [records]);

    return {
        ...demographics,
        loading,
        error,
    };
};
