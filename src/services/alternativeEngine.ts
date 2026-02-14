/**
 * Client-side Fertilizer & Seed Alternative Engine
 * Provides intelligent substitution recommendations based on agronomic equivalency.
 * Ported from backend/dss-scripts/engines/alternativeEngine.cjs for Supabase-only mode.
 */

// ==================== KNOWLEDGE BASE (Fertilizer) ====================
const fertilizerKnowledgeBase = {
    fertilizer_types: [
        {
            id: 'urea_46_0_0',
            common_name: 'Urea',
            npk_ratio: '46-0-0',
            substitutes: [
                {
                    substitute_id: 'ammonium_sulfate_21_0_0',
                    substitute_name: 'Ammonium Sulfate (21-0-0)',
                    conversion_factor: 2.19,
                    calculation_explanation: '46% N ÷ 21% N = 2.19',
                    usage_note: 'Need 2.19 kg of Ammonium Sulfate to match 1 kg of Urea for nitrogen content',
                    agronomic_notes: {
                        advantages: [
                            'Provides sulfur (24%) which is beneficial for rice',
                            'Less nitrogen loss through volatilization',
                            'Better performance in alkaline soils'
                        ],
                        disadvantages: [
                            'Requires more bags (2.19x)',
                            'Acidifies soil over time'
                        ],
                        best_for_crops: ['rice', 'corn', 'vegetables'],
                        not_recommended_for: [],
                        application_timing: 'Split application: 50% basal, 50% at tillering'
                    },
                    farmer_instructions: {
                        english: 'Replace {original_amount} bags Urea with {substitute_amount} bags Ammonium Sulfate.',
                        tagalog: 'Palitan ang {original_amount} sakong Urea ng {substitute_amount} sakong Ammonium Sulfate.'
                    },
                    confidence_score: 0.95,
                    source: 'PhilRice Technical Bulletin No. 15, 2020'
                },
                {
                    substitute_id: 'complete_14_14_14',
                    substitute_name: 'Complete Fertilizer (14-14-14)',
                    conversion_factor: 3.29,
                    calculation_explanation: '46% N ÷ 14% N = 3.29',
                    usage_note: 'Need 3.29 bags of Complete 14-14-14 to match Urea nitrogen',
                    agronomic_notes: {
                        advantages: [
                            'Provides balanced NPK nutrition',
                            'Good for nutrient-deficient soils'
                        ],
                        disadvantages: [
                            'Much more expensive per bag',
                            'Requires 3.29x more bags'
                        ],
                        best_for_crops: ['vegetables', 'highland rice'],
                        not_recommended_for: ['cost-sensitive farmers'],
                        application_timing: 'Basal application only'
                    },
                    farmer_instructions: {
                        english: 'Replace {original_amount} bags Urea with {substitute_amount} bags Complete 14-14-14.',
                        tagalog: 'Palitan ang {original_amount} sakong Urea ng {substitute_amount} sakong Complete 14-14-14.'
                    },
                    confidence_score: 0.88,
                    source: 'DA-BAR Fertilizer Recommendation Guide 2021'
                }
            ]
        },
        {
            id: 'complete_14_14_14',
            common_name: 'Complete Fertilizer (14-14-14)',
            npk_ratio: '14-14-14',
            substitutes: [
                {
                    substitute_id: 'complete_16_16_16',
                    substitute_name: 'Complete Fertilizer (16-16-16)',
                    conversion_factor: 0.875,
                    calculation_explanation: '14 ÷ 16 = 0.875',
                    usage_note: 'Need 12.5% less of 16-16-16 due to higher concentration',
                    agronomic_notes: {
                        advantages: ['Nearly identical profile', 'Less bags needed'],
                        disadvantages: ['May be more expensive per bag'],
                        best_for_crops: ['all crops suitable for 14-14-14'],
                        not_recommended_for: [],
                        application_timing: 'Same as 14-14-14 - basal application'
                    },
                    farmer_instructions: {
                        english: 'Replace {original_amount} bags Complete 14-14-14 with {substitute_amount} bags Complete 16-16-16.',
                        tagalog: 'Palitan ang {original_amount} sakong Complete 14-14-14 ng {substitute_amount} sakong Complete 16-16-16.'
                    },
                    confidence_score: 0.99,
                    source: 'Fertilizer and Pesticide Authority (FPA) Guidelines'
                }
            ]
        },
        {
            id: 'ammonium_sulfate_21_0_0',
            common_name: 'Ammonium Sulfate',
            npk_ratio: '21-0-0',
            substitutes: [
                {
                    substitute_id: 'urea_46_0_0',
                    substitute_name: 'Urea (46-0-0)',
                    conversion_factor: 0.46,
                    calculation_explanation: '21% N ÷ 46% N = 0.46',
                    usage_note: 'Need only 0.46 kg of Urea to match 1 kg of Ammonium Sulfate',
                    agronomic_notes: {
                        advantages: ['Much fewer bags needed', 'Lower cost per nitrogen unit'],
                        disadvantages: ['No sulfur', 'Higher volatilization losses'],
                        best_for_crops: ['rice', 'corn', 'sugarcane'],
                        not_recommended_for: [],
                        application_timing: 'Split application with proper incorporation'
                    },
                    farmer_instructions: {
                        english: 'Replace {original_amount} bags Ammonium Sulfate with {substitute_amount} bags Urea.',
                        tagalog: 'Palitan ang {original_amount} sakong Ammonium Sulfate ng {substitute_amount} sakong Urea.'
                    },
                    confidence_score: 0.93,
                    source: 'PhilRice Technical Bulletin No. 15, 2020'
                }
            ]
        },
        {
            id: 'muriate_potash_0_0_60',
            common_name: 'Muriate of Potash',
            npk_ratio: '0-0-60',
            substitutes: []
        }
    ],
    crop_specific_recommendations: {
        rice: {
            acceptable_substitutes: ['urea_46_0_0', 'ammonium_sulfate_21_0_0', 'complete_14_14_14']
        },
        corn: {
            acceptable_substitutes: ['urea_46_0_0', 'ammonium_sulfate_21_0_0', 'complete_16_16_16']
        },
        vegetables: {
            acceptable_substitutes: ['complete_14_14_14', 'urea_46_0_0', 'ammonium_sulfate_21_0_0']
        }
    } as Record<string, { acceptable_substitutes: string[] }>
};

// ==================== KNOWLEDGE BASE (Seeds) ====================
const seedKnowledgeBase: Record<string, { name: string; substitutes: SeedSubstitute[] }> = {
    jackpot: {
        name: 'Jackpot',
        substitutes: [
            { id: 'us88', name: 'US-88', conversionRatio: 1.0, confidenceScore: 0.92, reason: 'Similar yield characteristics and maturity period' },
            { id: 'th82', name: 'TH-82', conversionRatio: 1.0, confidenceScore: 0.88, reason: 'Good alternative with reliable performance' },
            { id: 'rh9000', name: 'RH-9000', conversionRatio: 1.0, confidenceScore: 0.85, reason: 'Compatible variety with good yield potential' },
            { id: 'lumping143', name: 'Lumping-143', conversionRatio: 1.0, confidenceScore: 0.82, reason: 'Traditional variety with consistent results' },
            { id: 'lp296', name: 'LP-296', conversionRatio: 1.0, confidenceScore: 0.80, reason: 'Alternative variety suitable for local conditions' }
        ]
    },
    us88: {
        name: 'US-88',
        substitutes: [
            { id: 'jackpot', name: 'Jackpot', conversionRatio: 1.0, confidenceScore: 0.92, reason: 'Similar yield characteristics' },
            { id: 'th82', name: 'TH-82', conversionRatio: 1.0, confidenceScore: 0.90, reason: 'Excellent alternative with proven track record' },
            { id: 'rh9000', name: 'RH-9000', conversionRatio: 1.0, confidenceScore: 0.87, reason: 'Good substitute with reliable performance' },
            { id: 'lumping143', name: 'Lumping-143', conversionRatio: 1.0, confidenceScore: 0.83, reason: 'Traditional variety with good adaptation' },
            { id: 'lp296', name: 'LP-296', conversionRatio: 1.0, confidenceScore: 0.81, reason: 'Suitable alternative for local conditions' }
        ]
    },
    th82: {
        name: 'TH-82',
        substitutes: [
            { id: 'us88', name: 'US-88', conversionRatio: 1.0, confidenceScore: 0.90, reason: 'Similar performance characteristics' },
            { id: 'jackpot', name: 'Jackpot', conversionRatio: 1.0, confidenceScore: 0.88, reason: 'Comparable yield potential' },
            { id: 'rh9000', name: 'RH-9000', conversionRatio: 1.0, confidenceScore: 0.89, reason: 'Good alternative with consistent results' },
            { id: 'lumping143', name: 'Lumping-143', conversionRatio: 1.0, confidenceScore: 0.84, reason: 'Reliable traditional variety' },
            { id: 'lp296', name: 'LP-296', conversionRatio: 1.0, confidenceScore: 0.82, reason: 'Suitable substitute for local adaptation' }
        ]
    },
    rh9000: {
        name: 'RH-9000',
        substitutes: [
            { id: 'th82', name: 'TH-82', conversionRatio: 1.0, confidenceScore: 0.89, reason: 'Similar maturity and yield' },
            { id: 'us88', name: 'US-88', conversionRatio: 1.0, confidenceScore: 0.87, reason: 'Good alternative with proven performance' },
            { id: 'jackpot', name: 'Jackpot', conversionRatio: 1.0, confidenceScore: 0.85, reason: 'Compatible variety with good yield' },
            { id: 'lumping143', name: 'Lumping-143', conversionRatio: 1.0, confidenceScore: 0.83, reason: 'Traditional alternative' },
            { id: 'lp296', name: 'LP-296', conversionRatio: 1.0, confidenceScore: 0.81, reason: 'Suitable for local conditions' }
        ]
    },
    lumping143: {
        name: 'Lumping-143',
        substitutes: [
            { id: 'th82', name: 'TH-82', conversionRatio: 1.0, confidenceScore: 0.84, reason: 'Modern variety with better yield' },
            { id: 'us88', name: 'US-88', conversionRatio: 1.0, confidenceScore: 0.83, reason: 'Proven variety with good results' },
            { id: 'jackpot', name: 'Jackpot', conversionRatio: 1.0, confidenceScore: 0.82, reason: 'Good alternative variety' },
            { id: 'rh9000', name: 'RH-9000', conversionRatio: 1.0, confidenceScore: 0.83, reason: 'Compatible substitute' },
            { id: 'lp296', name: 'LP-296', conversionRatio: 1.0, confidenceScore: 0.85, reason: 'Similar traditional variety' }
        ]
    },
    lp296: {
        name: 'LP-296',
        substitutes: [
            { id: 'lumping143', name: 'Lumping-143', conversionRatio: 1.0, confidenceScore: 0.85, reason: 'Similar traditional characteristics' },
            { id: 'th82', name: 'TH-82', conversionRatio: 1.0, confidenceScore: 0.82, reason: 'Modern alternative with good yield' },
            { id: 'us88', name: 'US-88', conversionRatio: 1.0, confidenceScore: 0.81, reason: 'Proven variety' },
            { id: 'jackpot', name: 'Jackpot', conversionRatio: 1.0, confidenceScore: 0.80, reason: 'Good substitute' },
            { id: 'rh9000', name: 'RH-9000', conversionRatio: 1.0, confidenceScore: 0.81, reason: 'Compatible variety' }
        ]
    }
};

// ==================== TYPES ====================
interface SeedSubstitute {
    id: string;
    name: string;
    conversionRatio: number;
    confidenceScore: number;
    reason: string;
}

interface FarmerRequestData {
    farmer_id?: number;
    farmer_name: string;
    crop_type?: string;
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

interface RemainingStock {
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
    [key: string]: number;
}

export interface AlternativeSuggestion {
    category: 'fertilizer' | 'seed';
    original_fertilizer?: string;
    original_fertilizer_name?: string;
    original_seed?: string;
    original_seed_name?: string;
    requested_bags?: number;
    requested_kg?: number;
    available_bags?: number;
    available_kg?: number;
    shortage_bags?: number;
    shortage_kg?: number;
    alternatives: any[];
    recommendation?: {
        action: string;
        rationale: string;
        next_steps: string[];
    };
}

export interface SuggestAlternativesResult {
    farmer_name: string;
    suggestions: {
        suggestions: AlternativeSuggestion[];
        has_shortages: boolean;
        overall_recommendation: {
            status: string;
            message: string;
            action: string;
            priority?: string;
        };
    };
}

// ==================== ENGINE ====================

function getFertilizerName(fertilizerType: string): string {
    const fert = fertilizerKnowledgeBase.fertilizer_types.find(f => f.id === fertilizerType);
    return fert ? fert.common_name : fertilizerType;
}

function getSeedName(seedType: string): string {
    const seed = seedKnowledgeBase[seedType];
    return seed ? seed.name : seedType.toUpperCase();
}

function formatInstructions(template: string, originalAmount: number, substituteAmount: number): string {
    return template
        .replace('{original_amount}', String(originalAmount))
        .replace('{substitute_amount}', String(substituteAmount));
}

function generateAlternativesForFertilizer(
    fertilizerType: string,
    shortage: number,
    partialStock: number,
    allStock: RemainingStock,
    cropType: string
): any[] {
    const fertilizerInfo = fertilizerKnowledgeBase.fertilizer_types.find(f => f.id === fertilizerType);
    if (!fertilizerInfo || !fertilizerInfo.substitutes || fertilizerInfo.substitutes.length === 0) return [];

    const validAlternatives: any[] = [];

    for (const substitute of fertilizerInfo.substitutes) {
        const substituteStockField = `${substitute.substitute_id}_bags`;
        const substituteAvailable = allStock[substituteStockField] || 0;
        const requiredAmount = Math.ceil(shortage * substitute.conversion_factor);

        // Check crop suitability
        const cropRec = fertilizerKnowledgeBase.crop_specific_recommendations[cropType];
        const cropSuitable = !cropRec || cropRec.acceptable_substitutes.includes(substitute.substitute_id);

        if (substituteAvailable >= requiredAmount && cropSuitable) {
            validAlternatives.push({
                substitute_id: substitute.substitute_id,
                substitute_name: substitute.substitute_name,
                can_fulfill: true,
                needed_bags: requiredAmount,
                available_bags: substituteAvailable,
                remaining_after_use: substituteAvailable - requiredAmount,
                conversion_factor: substitute.conversion_factor,
                calculation: substitute.calculation_explanation,
                explanation: substitute.usage_note,
                advantages: substitute.agronomic_notes.advantages,
                disadvantages: substitute.agronomic_notes.disadvantages,
                application_instructions: substitute.agronomic_notes.application_timing,
                farmer_instructions: {
                    english: formatInstructions(substitute.farmer_instructions.english, shortage, requiredAmount),
                    tagalog: formatInstructions(substitute.farmer_instructions.tagalog, shortage, requiredAmount)
                },
                confidence_score: substitute.confidence_score,
                source: substitute.source,
                recommendation_type: 'FULL_SUBSTITUTE'
            });
        } else if (substituteAvailable > 0 && cropSuitable) {
            const partialCoverage = Math.floor(substituteAvailable / substitute.conversion_factor);
            const remainingShortage = shortage - partialCoverage;

            validAlternatives.push({
                substitute_id: substitute.substitute_id,
                substitute_name: substitute.substitute_name,
                can_fulfill: false,
                needed_bags: requiredAmount,
                available_bags: substituteAvailable,
                partial_coverage: partialCoverage,
                remaining_shortage: remainingShortage,
                conversion_factor: substitute.conversion_factor,
                explanation: `Can partially substitute ${partialCoverage} bags using available ${substitute.substitute_name}`,
                recommendation: {
                    action: `Use ${partialStock} bags of original + ${substituteAvailable} bags of ${substitute.substitute_name}`,
                    rationale: 'Hybrid approach to maximize coverage with available stock',
                    remaining_gap: `Still need ${remainingShortage} bags`
                },
                confidence_score: substitute.confidence_score * 0.8,
                recommendation_type: 'PARTIAL_SUBSTITUTE'
            });
        }
    }

    validAlternatives.sort((a, b) => b.confidence_score - a.confidence_score);
    return validAlternatives;
}

function generateAlternativesForSeed(
    seedType: string,
    shortage: number,
    _partialStock: number,
    allStock: RemainingStock
): any[] {
    const seedInfo = seedKnowledgeBase[seedType];
    if (!seedInfo || !seedInfo.substitutes) return [];

    const validAlternatives: any[] = [];

    for (const substitute of seedInfo.substitutes) {
        const substituteStockField = `${substitute.id}_kg`;
        const substituteAvailable = allStock[substituteStockField] || 0;
        const requiredAmount = Math.ceil(shortage * substitute.conversionRatio);

        if (substituteAvailable >= requiredAmount) {
            validAlternatives.push({
                substitute_id: substitute.id,
                substitute_name: substitute.name,
                can_fulfill: true,
                needed_kg: requiredAmount,
                needed_bags: requiredAmount, // alias for compatibility
                available_kg: substituteAvailable,
                available_bags: substituteAvailable,
                remaining_after_use: substituteAvailable - requiredAmount,
                conversion_ratio: substitute.conversionRatio,
                explanation: substitute.reason,
                confidence_score: substitute.confidenceScore,
                recommendation_type: 'FULL_SUBSTITUTE'
            });
        } else if (substituteAvailable > 0) {
            const partialCoverage = Math.floor(substituteAvailable / substitute.conversionRatio);
            const remainingShortage = shortage - partialCoverage;

            validAlternatives.push({
                substitute_id: substitute.id,
                substitute_name: substitute.name,
                can_fulfill: false,
                needed_kg: requiredAmount,
                needed_bags: requiredAmount,
                available_kg: substituteAvailable,
                available_bags: substituteAvailable,
                partial_coverage: partialCoverage,
                remaining_shortage: remainingShortage,
                conversion_ratio: substitute.conversionRatio,
                explanation: `Can partially substitute ${partialCoverage} kg using available ${substitute.name}`,
                recommendation: {
                    action: `Use ${_partialStock} kg of original + ${substituteAvailable} kg of ${substitute.name}`,
                    rationale: 'Hybrid approach to maximize coverage with available stock',
                    remaining_gap: `Still need ${remainingShortage} kg`
                },
                confidence_score: substitute.confidenceScore * 0.8,
                recommendation_type: 'PARTIAL_SUBSTITUTE'
            });
        }
    }

    validAlternatives.sort((a, b) => b.confidence_score - a.confidence_score);
    return validAlternatives;
}

function generateOverallRecommendation(suggestions: AlternativeSuggestion[]) {
    if (suggestions.length === 0) {
        return {
            status: 'NO_ISSUES',
            message: 'All requested items are available in sufficient quantities',
            action: 'Proceed with approval'
        };
    }

    const hasFullSolutions = suggestions.some(s =>
        s.alternatives.some((alt: any) => alt.can_fulfill === true)
    );
    const hasPartialSolutions = suggestions.some(s =>
        s.alternatives.some((alt: any) => alt.can_fulfill === false && alt.recommendation_type === 'PARTIAL_SUBSTITUTE')
    );
    const hasNoSolutions = suggestions.some(s => s.alternatives.length === 0);

    if (hasFullSolutions && !hasNoSolutions) {
        return {
            status: 'SUBSTITUTE_AVAILABLE',
            message: 'Full substitutes available for all shortages',
            action: 'Review and apply recommended alternatives',
            priority: 'MEDIUM'
        };
    } else if (hasPartialSolutions) {
        return {
            status: 'PARTIAL_SOLUTION',
            message: 'Some shortages can be partially addressed with substitutes',
            action: 'Apply partial substitutes and ask farmer to reduce remaining quantity',
            priority: 'HIGH'
        };
    } else if (hasNoSolutions) {
        return {
            status: 'CRITICAL_SHORTAGE',
            message: 'No substitutes available - request must be reduced',
            action: 'Ask farmer to reduce quantity to available stock levels',
            priority: 'CRITICAL'
        };
    }

    return {
        status: 'REVIEW_REQUIRED',
        message: 'Mixed situation - manual review recommended',
        action: 'Evaluate each case individually',
        priority: 'HIGH'
    };
}

/**
 * Main export: Suggest alternatives for a farmer request given remaining stock.
 * This runs entirely client-side using the embedded knowledge bases.
 */
export function suggestAlternatives(
    farmerRequest: FarmerRequestData,
    remainingStock: RemainingStock
): SuggestAlternativesResult {
    const suggestions: AlternativeSuggestion[] = [];
    const cropType = farmerRequest.crop_type || 'rice';

    // === FERTILIZER SHORTAGES ===
    const fertilizerTypes = [
        { field: 'requested_urea_bags', type: 'urea_46_0_0', stockField: 'urea_46_0_0_bags' },
        { field: 'requested_complete_14_bags', type: 'complete_14_14_14', stockField: 'complete_14_14_14_bags' },
        { field: 'requested_ammonium_sulfate_bags', type: 'ammonium_sulfate_21_0_0', stockField: 'ammonium_sulfate_21_0_0_bags' },
        { field: 'requested_muriate_potash_bags', type: 'muriate_potash_0_0_60', stockField: 'muriate_potash_0_0_60_bags' }
    ];

    for (const fertType of fertilizerTypes) {
        const requestedAmount = (farmerRequest as any)[fertType.field] || 0;
        if (requestedAmount <= 0) continue;

        const availableStock = remainingStock[fertType.stockField] || 0;
        if (requestedAmount > availableStock) {
            const shortage = requestedAmount - availableStock;

            const alts = generateAlternativesForFertilizer(
                fertType.type, shortage, availableStock, remainingStock, cropType
            );

            if (alts.length > 0) {
                suggestions.push({
                    category: 'fertilizer',
                    original_fertilizer: fertType.type,
                    original_fertilizer_name: getFertilizerName(fertType.type),
                    requested_bags: requestedAmount,
                    available_bags: availableStock,
                    shortage_bags: shortage,
                    alternatives: alts
                });
            } else {
                // No alternatives - provide smart recommendation
                const isOverAllocated = availableStock < 0;
                const canPartiallyFulfill = availableStock > 0;
                let nextSteps: string[];
                let rationale: string;

                if (isOverAllocated) {
                    rationale = `Current allocation exhausted. Already over-allocated by ${Math.abs(availableStock)} bags.`;
                    nextSteps = [
                        `❌ Cannot fulfill - stock over-allocated by ${Math.abs(availableStock)} bags`,
                        `✋ Reject this request - all ${getFertilizerName(fertType.type)} has been allocated`,
                        `📞 Contact Regional Office for emergency allocation`,
                        `⏸️ Put farmer on waitlist for next allocation period`
                    ];
                } else if (canPartiallyFulfill) {
                    rationale = `Only ${availableStock} bags available, farmer requested ${requestedAmount}.`;
                    nextSteps = [
                        `✅ Approve partial amount of ${availableStock} bags`,
                        `✏️ Ask farmer to reduce request to ${availableStock} bags`,
                        `❌ Reject and ask farmer to resubmit`,
                        `📞 Contact Regional Office for additional allocation`
                    ];
                } else {
                    rationale = 'Stock completely depleted.';
                    nextSteps = [
                        `❌ Reject - no ${getFertilizerName(fertType.type)} stock remaining`,
                        `📞 Contact Regional Office for emergency allocation`,
                        `⏸️ Put farmer on waitlist`
                    ];
                }

                suggestions.push({
                    category: 'fertilizer',
                    original_fertilizer: fertType.type,
                    original_fertilizer_name: getFertilizerName(fertType.type),
                    requested_bags: requestedAmount,
                    available_bags: availableStock,
                    shortage_bags: shortage,
                    alternatives: [],
                    recommendation: {
                        action: isOverAllocated ? 'REJECT_OVERALLOCATED' : (canPartiallyFulfill ? 'PARTIAL_FULFILLMENT' : 'REJECT_DEPLETED'),
                        rationale,
                        next_steps: nextSteps
                    }
                });
            }
        }
    }

    // === SEED SHORTAGES ===
    const seedTypes = [
        { field: 'requested_jackpot_kg', type: 'jackpot', stockField: 'jackpot_kg' },
        { field: 'requested_us88_kg', type: 'us88', stockField: 'us88_kg' },
        { field: 'requested_th82_kg', type: 'th82', stockField: 'th82_kg' },
        { field: 'requested_rh9000_kg', type: 'rh9000', stockField: 'rh9000_kg' },
        { field: 'requested_lumping143_kg', type: 'lumping143', stockField: 'lumping143_kg' },
        { field: 'requested_lp296_kg', type: 'lp296', stockField: 'lp296_kg' }
    ];

    for (const seedType of seedTypes) {
        const requestedAmount = (farmerRequest as any)[seedType.field] || 0;
        if (requestedAmount <= 0) continue;

        const availableStock = remainingStock[seedType.stockField] || 0;
        if (requestedAmount > availableStock) {
            const shortage = requestedAmount - availableStock;

            const alts = generateAlternativesForSeed(
                seedType.type, shortage, availableStock, remainingStock
            );

            if (alts.length > 0) {
                suggestions.push({
                    category: 'seed',
                    original_seed: seedType.type,
                    original_seed_name: getSeedName(seedType.type),
                    requested_kg: requestedAmount,
                    available_kg: availableStock,
                    shortage_kg: shortage,
                    alternatives: alts
                });
            } else {
                const isOverAllocated = availableStock < 0;
                const canPartiallyFulfill = availableStock > 0;
                let nextSteps: string[];
                let rationale: string;

                if (isOverAllocated) {
                    rationale = `Seed allocation exhausted. Over-allocated by ${Math.abs(availableStock)} kg.`;
                    nextSteps = [
                        `❌ Cannot fulfill - seed stock over-allocated by ${Math.abs(availableStock)} kg`,
                        `✋ Reject - all ${getSeedName(seedType.type)} seeds allocated`,
                        `📞 Contact Regional Office for emergency seed allocation`,
                        `⏸️ Put farmer on waitlist`
                    ];
                } else if (canPartiallyFulfill) {
                    rationale = `Only ${availableStock} kg available, farmer requested ${requestedAmount} kg.`;
                    nextSteps = [
                        `✅ Approve partial amount of ${availableStock} kg`,
                        `✏️ Ask farmer to reduce request to ${availableStock} kg`,
                        `❌ Reject and ask farmer to resubmit`,
                        `📞 Contact Regional Office for additional seed allocation`
                    ];
                } else {
                    rationale = 'Seed stock completely depleted.';
                    nextSteps = [
                        `❌ Reject - no ${getSeedName(seedType.type)} seed stock remaining`,
                        `📞 Contact Regional Office for emergency seed allocation`,
                        `⏸️ Put farmer on waitlist`
                    ];
                }

                suggestions.push({
                    category: 'seed',
                    original_seed: seedType.type,
                    original_seed_name: getSeedName(seedType.type),
                    requested_kg: requestedAmount,
                    available_kg: availableStock,
                    shortage_kg: shortage,
                    alternatives: [],
                    recommendation: {
                        action: isOverAllocated ? 'REJECT_OVERALLOCATED' : (canPartiallyFulfill ? 'PARTIAL_FULFILLMENT' : 'REJECT_DEPLETED'),
                        rationale,
                        next_steps: nextSteps
                    }
                });
            }
        }
    }

    return {
        farmer_name: farmerRequest.farmer_name,
        suggestions: {
            suggestions,
            has_shortages: suggestions.length > 0,
            overall_recommendation: generateOverallRecommendation(suggestions)
        }
    };
}

/**
 * Calculate remaining stock for a given allocation and list of requests.
 * Excludes the request with `excludeRequestId` from the summation.
 */
export function calculateRemainingStock(
    allocation: any,
    requests: any[],
    excludeRequestId: number
): RemainingStock {
    const approved = requests
        .filter(r => (r.status === 'approved' || r.status === 'pending') && r.id !== excludeRequestId);

    const sum = (field: string) => approved.reduce((s, r) => s + (Number(r[field]) || 0), 0);

    return {
        urea_46_0_0_bags: (allocation.urea_46_0_0_bags || 0) - sum('requested_urea_bags'),
        complete_14_14_14_bags: (allocation.complete_14_14_14_bags || 0) - sum('requested_complete_14_bags'),
        ammonium_sulfate_21_0_0_bags: (allocation.ammonium_sulfate_21_0_0_bags || 0) - sum('requested_ammonium_sulfate_bags'),
        muriate_potash_0_0_60_bags: (allocation.muriate_potash_0_0_60_bags || 0) - sum('requested_muriate_potash_bags'),
        jackpot_kg: (allocation.jackpot_kg || 0) - sum('requested_jackpot_kg'),
        us88_kg: (allocation.us88_kg || 0) - sum('requested_us88_kg'),
        th82_kg: (allocation.th82_kg || 0) - sum('requested_th82_kg'),
        rh9000_kg: (allocation.rh9000_kg || 0) - sum('requested_rh9000_kg'),
        lumping143_kg: (allocation.lumping143_kg || 0) - sum('requested_lumping143_kg'),
        lp296_kg: (allocation.lp296_kg || 0) - sum('requested_lp296_kg')
    };
}
