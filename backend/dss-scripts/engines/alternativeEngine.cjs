const fs = require('fs');
const path = require('path');

/**
 * Fertilizer & Seed Alternative Engine
 * Provides intelligent fertilizer and seed substitution recommendations based on agronomic equivalency
 */
class FertilizerAlternativeEngine {
    constructor() {
        // Load fertilizer knowledge base
        const fertKbPath = path.join(__dirname, '../knowledge/fertilizerEquivalency.json');
        try {
            const fertKbData = fs.readFileSync(fertKbPath, 'utf8');
            this.knowledgeBase = JSON.parse(fertKbData);
            console.log('✅ Fertilizer Knowledge Base loaded successfully');
        } catch (error) {
            console.error('❌ Failed to load fertilizer knowledge base:', error.message);
            this.knowledgeBase = null;
        }

        // Load seed knowledge base
        const seedKbPath = path.join(__dirname, '../knowledge/seedEquivalency.json');
        try {
            const seedKbData = fs.readFileSync(seedKbPath, 'utf8');
            this.seedKnowledgeBase = JSON.parse(seedKbData);
            console.log('✅ Seed Knowledge Base loaded successfully');
        } catch (error) {
            console.error('❌ Failed to load seed knowledge base:', error.message);
            this.seedKnowledgeBase = null;
        }
    }

    /**
     * Main function to suggest alternatives for a farmer request
     * @param {Object} farmerRequest - The farmer's request details
     * @param {Object} currentStock - Current available stock levels
     * @returns {Object} Alternatives and recommendations
     */
    async suggestAlternatives(farmerRequest, currentStock) {
        if (!this.knowledgeBase && !this.seedKnowledgeBase) {
            return { error: 'Knowledge bases not loaded' };
        }

        const suggestions = [];

        // === FERTILIZER SHORTAGES ===
        const fertilizerTypes = [
            { field: 'requested_urea_bags', type: 'urea_46_0_0', stockField: 'urea_46_0_0_bags' },
            { field: 'requested_complete_14_bags', type: 'complete_14_14_14', stockField: 'complete_14_14_14_bags' },
            { field: 'requested_ammonium_sulfate_bags', type: 'ammonium_sulfate_21_0_0', stockField: 'ammonium_sulfate_21_0_0_bags' },
            { field: 'requested_muriate_potash_bags', type: 'muriate_potash_0_0_60', stockField: 'muriate_potash_0_0_60_bags' }
        ];

        // Check each requested fertilizer type
        for (const fertType of fertilizerTypes) {
            const requestedAmount = farmerRequest[fertType.field] || 0;
            if (requestedAmount <= 0) continue;

            const availableStock = currentStock[fertType.stockField] || 0;

            // Check if there's a shortage
            if (requestedAmount > availableStock) {
                const shortage = requestedAmount - availableStock;

                // Generate alternatives for this shortage
                const alternatives = this.generateAlternativesForFertilizer(
                    fertType.type,
                    shortage,
                    availableStock,
                    currentStock,
                    farmerRequest.crop_type || 'rice'
                );

                if (alternatives.length > 0) {
                    suggestions.push({
                        category: 'fertilizer',
                        original_fertilizer: fertType.type,
                        original_fertilizer_name: this.getFertilizerName(fertType.type),
                        requested_bags: requestedAmount,
                        available_bags: availableStock,
                        shortage_bags: shortage,
                        alternatives: alternatives
                    });
                } else {
                    // No alternatives available
                    suggestions.push({
                        category: 'fertilizer',
                        original_fertilizer: fertType.type,
                        original_fertilizer_name: this.getFertilizerName(fertType.type),
                        requested_bags: requestedAmount,
                        available_bags: availableStock,
                        shortage_bags: shortage,
                        alternatives: [],
                        recommendation: {
                            action: 'REDUCE_QUANTITY',
                            rationale: 'No suitable alternatives available in current stock',
                            next_steps: [
                                `Request farmer to reduce quantity to ${availableStock} bags (available stock)`,
                                'Reject request and ask farmer to submit new request with lower amount',
                                'Contact Regional Office for additional allocation if critically needed'
                            ]
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

        // Check each requested seed type
        for (const seedType of seedTypes) {
            const requestedAmount = farmerRequest[seedType.field] || 0;
            if (requestedAmount <= 0) continue;

            const availableStock = currentStock[seedType.stockField] || 0;

            // Check if there's a shortage
            if (requestedAmount > availableStock) {
                const shortage = requestedAmount - availableStock;

                // Generate alternatives for this seed shortage
                const alternatives = this.generateAlternativesForSeed(
                    seedType.type,
                    shortage,
                    availableStock,
                    currentStock
                );

                if (alternatives.length > 0) {
                    suggestions.push({
                        category: 'seed',
                        original_seed: seedType.type,
                        original_seed_name: this.getSeedName(seedType.type),
                        requested_kg: requestedAmount,
                        available_kg: availableStock,
                        shortage_kg: shortage,
                        alternatives: alternatives
                    });
                } else {
                    // No alternatives available
                    suggestions.push({
                        category: 'seed',
                        original_seed: seedType.type,
                        original_seed_name: this.getSeedName(seedType.type),
                        requested_kg: requestedAmount,
                        available_kg: availableStock,
                        shortage_kg: shortage,
                        alternatives: [],
                        recommendation: {
                            action: 'REDUCE_QUANTITY',
                            rationale: 'No suitable seed alternatives available in current stock',
                            next_steps: [
                                `Request farmer to reduce quantity to ${availableStock} kg (available stock)`,
                                'Reject request and ask farmer to submit new request with lower amount',
                                'Contact Regional Office for additional allocation if critically needed'
                            ]
                        }
                    });
                }
            }
        }

        return {
            farmer_id: farmerRequest.farmer_id,
            farmer_name: farmerRequest.farmer_name,
            crop_type: farmerRequest.crop_type || 'rice',
            has_shortages: suggestions.length > 0,
            suggestions: suggestions,
            overall_recommendation: this.generateOverallRecommendation(suggestions)
        };
    }

    /**
     * Generate alternative options for a specific seed shortage
     */
    generateAlternativesForSeed(seedType, shortage, partialStock, allStock) {
        if (!this.seedKnowledgeBase) {
            return [];
        }

        // Find seed in knowledge base
        const seedInfo = this.seedKnowledgeBase.seedEquivalencies[seedType];

        if (!seedInfo || !seedInfo.substitutes) {
            return [];
        }

        const validAlternatives = [];

        // Check each possible substitute
        for (const substitute of seedInfo.substitutes) {
            const substituteStockField = `${substitute.id}_kg`;
            const substituteAvailable = allStock[substituteStockField] || 0;

            // Calculate how much substitute is needed (1:1 ratio for seeds)
            const requiredAmount = Math.ceil(shortage * substitute.conversionRatio);

            if (substituteAvailable >= requiredAmount) {
                // Full substitution possible
                validAlternatives.push({
                    substitute_id: substitute.id,
                    substitute_name: substitute.name,
                    can_fulfill: true,
                    needed_kg: requiredAmount,
                    available_kg: substituteAvailable,
                    remaining_after_use: substituteAvailable - requiredAmount,
                    conversion_ratio: substitute.conversionRatio,
                    explanation: substitute.reason,
                    farmer_instructions: substitute.instructions,
                    confidence_score: substitute.confidenceScore,
                    recommendation_type: 'FULL_SUBSTITUTE'
                });
            } else if (substituteAvailable > 0) {
                // Partial substitution possible
                const partialCoverage = Math.floor(substituteAvailable / substitute.conversionRatio);
                const remainingShortage = shortage - partialCoverage;

                validAlternatives.push({
                    substitute_id: substitute.id,
                    substitute_name: substitute.name,
                    can_fulfill: false,
                    needed_kg: requiredAmount,
                    available_kg: substituteAvailable,
                    partial_coverage: partialCoverage,
                    remaining_shortage: remainingShortage,
                    conversion_ratio: substitute.conversionRatio,
                    explanation: `Can partially substitute ${partialCoverage} kg using available ${substitute.name}`,
                    recommendation: {
                        action: `Use ${partialStock} kg of original + ${substituteAvailable} kg of ${substitute.name}`,
                        rationale: 'Hybrid approach to maximize coverage with available stock',
                        remaining_gap: `Still need ${remainingShortage} kg - recommend waitlist for remaining farmers`
                    },
                    confidence_score: substitute.confidenceScore * 0.8,
                    recommendation_type: 'PARTIAL_SUBSTITUTE'
                });
            }
        }

        // Sort by confidence score (highest first)
        validAlternatives.sort((a, b) => b.confidence_score - a.confidence_score);

        return validAlternatives;
    }

    /**
     * Generate alternative options for a specific fertilizer shortage
     */
    generateAlternativesForFertilizer(fertilizerType, shortage, partialStock, allStock, cropType) {
        // Find fertilizer in knowledge base
        const fertilizerInfo = this.knowledgeBase.fertilizer_types.find(f => f.id === fertilizerType);

        if (!fertilizerInfo || !fertilizerInfo.substitutes) {
            return [];
        }

        const validAlternatives = [];

        // Check each possible substitute
        for (const substitute of fertilizerInfo.substitutes) {
            const substituteStockField = `${substitute.substitute_id}_bags`;
            const substituteAvailable = allStock[substituteStockField] || 0;

            // Calculate how much substitute is needed
            const requiredAmount = Math.ceil(shortage * substitute.conversion_factor);

            // Check crop suitability
            const cropSuitable = this.checkCropSuitability(substitute, fertilizerInfo, cropType);

            if (substituteAvailable >= requiredAmount && cropSuitable) {
                // Full substitution possible
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
                        english: this.formatInstructions(
                            substitute.farmer_instructions.english,
                            shortage,
                            requiredAmount
                        ),
                        tagalog: this.formatInstructions(
                            substitute.farmer_instructions.tagalog,
                            shortage,
                            requiredAmount
                        )
                    },
                    confidence_score: substitute.confidence_score,
                    source: substitute.source,
                    cost_note: substitute.cost_consideration?.cost_impact_note || null,
                    recommendation_type: 'FULL_SUBSTITUTE'
                });
            } else if (substituteAvailable > 0 && cropSuitable) {
                // Partial substitution possible
                const partialShortageCanCover = Math.floor(substituteAvailable / substitute.conversion_factor);
                const remainingShortage = shortage - partialShortageCanCover;

                validAlternatives.push({
                    substitute_id: substitute.substitute_id,
                    substitute_name: substitute.substitute_name,
                    can_fulfill: false,
                    needed_bags: requiredAmount,
                    available_bags: substituteAvailable,
                    partial_coverage: partialShortageCanCover,
                    remaining_shortage: remainingShortage,
                    conversion_factor: substitute.conversion_factor,
                    explanation: `Can partially substitute ${partialShortageCanCover} bags using available ${substitute.substitute_name}`,
                    recommendation: {
                        action: `Use ${partialStock} bags of original + ${substituteAvailable} bags of ${substitute.substitute_name}`,
                        rationale: 'Hybrid approach to maximize coverage with available stock',
                        remaining_gap: `Still need ${remainingShortage} bags - recommend waitlist for remaining farmers`
                    },
                    confidence_score: substitute.confidence_score * 0.8,
                    recommendation_type: 'PARTIAL_SUBSTITUTE'
                });
            }
        }

        // Sort by confidence score (highest first)
        validAlternatives.sort((a, b) => b.confidence_score - a.confidence_score);

        return validAlternatives;
    }

    /**
     * Check if substitute is suitable for farmer's crop
     */
    checkCropSuitability(substitute, originalFertilizer, cropType) {
        const cropRec = this.knowledgeBase.crop_specific_recommendations[cropType];

        if (!cropRec) {
            // Default to acceptable if crop not in database
            return true;
        }

        // Check if substitute is in acceptable list for this crop
        const isAcceptable = cropRec.acceptable_substitutes.includes(substitute.substitute_id);

        // Check if substitute is explicitly not recommended
        const notRecommended = substitute.agronomic_notes.not_recommended_for?.includes(cropType) || false;

        return isAcceptable && !notRecommended;
    }

    /**
     * Get human-readable fertilizer name
     */
    getFertilizerName(fertilizerType) {
        const fert = this.knowledgeBase.fertilizer_types.find(f => f.id === fertilizerType);
        return fert ? fert.common_name : fertilizerType;
    }

    /**
     * Get human-readable seed name
     */
    getSeedName(seedType) {
        if (!this.seedKnowledgeBase) {
            return seedType.toUpperCase();
        }
        const seed = this.seedKnowledgeBase.seedEquivalencies[seedType];
        return seed ? seed.name : seedType.toUpperCase();
    }

    /**
     * Format instruction templates with actual amounts
     */
    formatInstructions(template, originalAmount, substituteAmount) {
        return template
            .replace('{original_amount}', originalAmount)
            .replace('{substitute_amount}', substituteAmount);
    }

    /**
     * Generate overall recommendation summary
     */
    generateOverallRecommendation(suggestions) {
        if (suggestions.length === 0) {
            return {
                status: 'NO_ISSUES',
                message: 'All requested fertilizers are available in sufficient quantities',
                action: 'Proceed with approval'
            };
        }

        const hasFullSolutions = suggestions.some(s =>
            s.alternatives.some(alt => alt.can_fulfill === true)
        );

        const hasPartialSolutions = suggestions.some(s =>
            s.alternatives.some(alt => alt.can_fulfill === false && alt.recommendation_type === 'PARTIAL_SUBSTITUTE')
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
     * Get decision rules from knowledge base
     */
    getDecisionRules() {
        return this.knowledgeBase?.decision_rules || [];
    }

    /**
     * Get crop-specific recommendations
     */
    getCropRecommendations(cropType) {
        return this.knowledgeBase?.crop_specific_recommendations[cropType] || null;
    }

    /**
     * Validate knowledge base integrity
     */
    validateKnowledgeBase() {
        if (!this.knowledgeBase) {
            return { valid: false, error: 'Knowledge base not loaded' };
        }

        const errors = [];
        const warnings = [];

        // Check if essential fields exist
        if (!this.knowledgeBase.fertilizer_types || !Array.isArray(this.knowledgeBase.fertilizer_types)) {
            errors.push('Missing or invalid fertilizer_types array');
        }

        if (!this.knowledgeBase.decision_rules || !Array.isArray(this.knowledgeBase.decision_rules)) {
            warnings.push('Missing decision_rules array');
        }

        // Validate each fertilizer type
        this.knowledgeBase.fertilizer_types?.forEach((fert, index) => {
            if (!fert.id) {
                errors.push(`Fertilizer at index ${index} missing ID`);
            }
            if (!fert.nutrient_content) {
                errors.push(`Fertilizer ${fert.id || index} missing nutrient_content`);
            }
            if (!fert.substitutes || !Array.isArray(fert.substitutes)) {
                warnings.push(`Fertilizer ${fert.id || index} has no substitutes defined`);
            }
        });

        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings,
            fertilizer_count: this.knowledgeBase.fertilizer_types?.length || 0,
            rule_count: this.knowledgeBase.decision_rules?.length || 0
        };
    }
}

module.exports = FertilizerAlternativeEngine;
