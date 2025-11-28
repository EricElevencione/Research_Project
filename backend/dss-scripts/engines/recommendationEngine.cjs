/**
 * Recommendation Engine for Gap Analysis
 * Generates actionable recommendations based on allocation vs demand analysis
 */
class RecommendationEngine {
    constructor() {
        this.priorityLevels = {
            CRITICAL: { score: 4, color: '#dc2626', icon: '🔴' },
            HIGH: { score: 3, color: '#f59e0b', icon: '🟠' },
            MEDIUM: { score: 2, color: '#3b82f6', icon: '🔵' },
            LOW: { score: 1, color: '#10b981', icon: '🟢' }
        };
    }

    /**
     * Main function to generate recommendations based on gap analysis
     */
    generateRecommendations(gapAnalysisData, farmerRequests) {
        const recommendations = [];

        // 1. Analyze fertilizer shortages
        const fertilizerRecs = this.analyzeFertilizerGaps(gapAnalysisData.fertilizers, farmerRequests);
        recommendations.push(...fertilizerRecs);

        // 2. Analyze seed shortages
        const seedRecs = this.analyzeSeedGaps(gapAnalysisData.seeds, farmerRequests);
        recommendations.push(...seedRecs);

        // 3. Analyze surplus opportunities
        const surplusRecs = this.analyzeSurplus(gapAnalysisData);
        recommendations.push(...surplusRecs);

        // 4. Check equity distribution
        const equityRecs = this.checkEquityIssues(farmerRequests);
        recommendations.push(...equityRecs);

        // 5. Sort by priority
        recommendations.sort((a, b) =>
            this.priorityLevels[b.priority].score - this.priorityLevels[a.priority].score
        );

        return {
            summary: this.generateSummary(recommendations),
            recommendations: recommendations,
            generated_at: new Date().toISOString()
        };
    }

    /**
     * Analyze fertilizer gaps and generate recommendations
     */
    analyzeFertilizerGaps(fertilizers, farmerRequests) {
        const recommendations = [];

        for (const [fertType, data] of Object.entries(fertilizers)) {
            if (data.gap < 0) {
                // Shortage detected
                const shortagePercent = Math.abs((data.gap / data.requested) * 100);
                const priority = shortagePercent > 30 ? 'CRITICAL' : shortagePercent > 15 ? 'HIGH' : 'MEDIUM';

                const rec = {
                    id: `FERT_SHORTAGE_${fertType}`,
                    type: 'SHORTAGE',
                    category: 'fertilizer',
                    priority: priority,
                    item: this.formatFertilizerName(fertType),
                    item_code: fertType,
                    shortage_amount: Math.abs(data.gap),
                    shortage_percent: shortagePercent.toFixed(1),
                    affected_farmers: this.calculateAffectedFarmers(fertType, farmerRequests),
                    title: `${this.formatFertilizerName(fertType)} Shortage`,
                    description: `Current stock is ${Math.abs(data.gap)} bags short (${shortagePercent.toFixed(1)}% shortage)`,
                    actions: this.generateShortageActions(fertType, data, farmerRequests)
                };

                recommendations.push(rec);
            }
        }

        return recommendations;
    }

    /**
     * Analyze seed gaps
     */
    analyzeSeedGaps(seeds, farmerRequests) {
        const recommendations = [];

        for (const [seedType, data] of Object.entries(seeds)) {
            if (data.gap < 0) {
                const shortagePercent = Math.abs((data.gap / data.requested) * 100);
                const priority = shortagePercent > 25 ? 'CRITICAL' : shortagePercent > 10 ? 'HIGH' : 'MEDIUM';

                const rec = {
                    id: `SEED_SHORTAGE_${seedType}`,
                    type: 'SHORTAGE',
                    category: 'seed',
                    priority: priority,
                    item: this.formatSeedName(seedType),
                    item_code: seedType,
                    shortage_amount: Math.abs(data.gap),
                    shortage_percent: shortagePercent.toFixed(1),
                    title: `${this.formatSeedName(seedType)} Seed Shortage`,
                    description: `Current stock is ${Math.abs(data.gap)} kg short (${shortagePercent.toFixed(1)}% shortage)`,
                    actions: this.generateSeedShortageActions(seedType, data)
                };

                recommendations.push(rec);
            }
        }

        return recommendations;
    }

    /**
     * Analyze surplus items for opportunities
     */
    analyzeSurplus(gapData) {
        const recommendations = [];

        // Check fertilizers
        for (const [fertType, data] of Object.entries(gapData.fertilizers)) {
            if (data.gap > 0 && data.requested > 0) {
                const surplusPercent = (data.gap / data.allocated) * 100;

                if (surplusPercent > 20) {
                    const rec = {
                        id: `SURPLUS_${fertType}`,
                        type: 'OPPORTUNITY',
                        category: 'fertilizer',
                        priority: 'LOW',
                        item: this.formatFertilizerName(fertType),
                        item_code: fertType,
                        surplus_amount: data.gap,
                        surplus_percent: surplusPercent.toFixed(1),
                        title: `${this.formatFertilizerName(fertType)} Surplus Available`,
                        description: `${data.gap} bags remain unused (${surplusPercent.toFixed(1)}% surplus)`,
                        actions: [
                            {
                                action: 'Promote to farmers who may benefit',
                                rationale: 'Increase adoption by offering to farmers who didn\'t initially request',
                                steps: [
                                    'Identify farmers growing compatible crops',
                                    'Send notification about availability',
                                    'Offer at subsidized rate if needed'
                                ]
                            },
                            {
                                action: 'Coordinate with neighboring municipalities',
                                rationale: 'Surplus can be traded or sold to other LGUs',
                                estimated_value: this.estimateSurplusValue(fertType, data.gap)
                            },
                            {
                                action: 'Reserve for next season',
                                rationale: 'Store properly for future use',
                                storage_requirements: 'Cool, dry place; shelf life: 12 months'
                            }
                        ]
                    };

                    recommendations.push(rec);
                }
            }
        }

        return recommendations;
    }

    /**
     * Check for equity distribution issues
     */
    checkEquityIssues(farmerRequests) {
        const recommendations = [];

        // Group by barangay
        const barangayGroups = {};
        farmerRequests.forEach(req => {
            if (!barangayGroups[req.barangay]) {
                barangayGroups[req.barangay] = {
                    total: 0,
                    approved: 0,
                    waitlisted: 0,
                    rejected: 0
                };
            }
            barangayGroups[req.barangay].total++;
            if (req.status === 'approved') barangayGroups[req.barangay].approved++;
            else if (req.status === 'waitlisted') barangayGroups[req.barangay].waitlisted++;
            else if (req.status === 'rejected') barangayGroups[req.barangay].rejected++;
        });

        // Calculate approval rates
        const approvalRates = [];
        for (const [barangay, stats] of Object.entries(barangayGroups)) {
            const approvalRate = (stats.approved / stats.total) * 100;
            approvalRates.push({ barangay, rate: approvalRate, stats });
        }

        // Find significantly disadvantaged barangays
        const avgApprovalRate = approvalRates.reduce((sum, b) => sum + b.rate, 0) / approvalRates.length;

        approvalRates.forEach(({ barangay, rate, stats }) => {
            if (rate < avgApprovalRate - 20) {
                const rec = {
                    id: `EQUITY_${barangay.replace(/\s+/g, '_')}`,
                    type: 'EQUITY_ALERT',
                    category: 'equity',
                    priority: 'HIGH',
                    item: barangay,
                    title: `Low Approval Rate in ${barangay}`,
                    description: `Only ${rate.toFixed(1)}% approved (avg: ${avgApprovalRate.toFixed(1)}%). This may indicate inequitable distribution.`,
                    stats: stats,
                    actions: [
                        {
                            action: 'Review priority scoring for this barangay',
                            rationale: 'Ensure criteria are being applied fairly'
                        },
                        {
                            action: 'Prioritize pending requests from this area',
                            rationale: 'Balance distribution across all barangays',
                            affected_count: stats.total - stats.approved
                        },
                        {
                            action: 'Request additional allocation specifically for underserved areas',
                            rationale: 'Address geographic equity concerns'
                        }
                    ]
                };

                recommendations.push(rec);
            }
        });

        return recommendations;
    }

    /**
     * Generate specific actions for fertilizer shortages
     */
    generateShortageActions(fertType, data, farmerRequests) {
        const actions = [];

        // Action 1: Use alternatives
        actions.push({
            action: 'Use alternative fertilizers',
            rationale: 'Agronomically equivalent substitutes can fulfill remaining demand',
            implementation: `Go to Manage Requests → Click "💡 Suggest" on affected farmers`,
            expected_outcome: 'Satisfy majority of affected farmers with suitable alternatives',
            confidence: 'high'
        });

        // Action 2: Prioritize by farm size
        const affectedCount = this.calculateAffectedFarmers(fertType, farmerRequests);
        actions.push({
            action: 'Prioritize small farmers',
            rationale: 'Ensure equity by serving smallest farms first',
            implementation: 'Sort pending requests by farm_area_ha (ascending)',
            affected_farmers: affectedCount,
            expected_coverage: `${Math.min(100, (data.allocated / data.requested * 100)).toFixed(0)}%`
        });

        // Action 3: Request emergency allocation
        actions.push({
            action: 'Request emergency allocation from Regional Office',
            rationale: 'Critical shortage requires additional supply',
            needed_amount: Math.abs(data.gap),
            estimated_delivery: '2-3 weeks',
            contact: 'Regional Agricultural Office',
            urgency: data.gap < -100 ? 'URGENT' : 'STANDARD'
        });

        // Action 4: Waitlist remaining farmers
        actions.push({
            action: 'Place excess farmers on waitlist',
            rationale: 'Transparent process for farmers who cannot be served immediately',
            implementation: 'Update status to "waitlisted" with expected fulfillment date',
            communication_required: true,
            message_template: 'Your request is waitlisted. Expected fulfillment: [date]'
        });

        return actions;
    }

    /**
     * Generate actions for seed shortages
     */
    generateSeedShortageActions(seedType, data) {
        return [
            {
                action: 'Coordinate with PhilRice/seed growers',
                rationale: 'Emergency seed procurement from certified sources',
                needed_amount: Math.abs(data.gap) + ' kg',
                estimated_timeline: '3-4 weeks'
            },
            {
                action: 'Allow farmer-saved seeds as temporary measure',
                rationale: 'Bridge the gap until certified seeds arrive',
                quality_check: 'Verify seed quality and germination rate',
                limitation: 'Only for immediate planting needs'
            },
            {
                action: 'Reduce allocation per farmer proportionally',
                rationale: 'Ensure all farmers get some seeds rather than some getting none',
                implementation: `Reduce each allocation by ${((Math.abs(data.gap) / data.requested) * 100).toFixed(1)}%`
            }
        ];
    }

    /**
     * Helper: Format fertilizer names
     */
    formatFertilizerName(code) {
        const names = {
            'urea_46_0_0': 'Urea (46-0-0)',
            'complete_14_14_14': 'Complete (14-14-14)',
            'ammonium_sulfate_21_0_0': 'Ammonium Sulfate (21-0-0)',
            'muriate_potash_0_0_60': 'Muriate of Potash (0-0-60)'
        };
        return names[code] || code;
    }

    /**
     * Helper: Format seed names
     */
    formatSeedName(code) {
        const names = {
            'rice_nsic_rc160': 'NSIC Rc160 (Rice)',
            'rice_nsic_rc222': 'NSIC Rc222 (Rice)',
            'rice_nsic_rc440': 'NSIC Rc440 (Rice)',
            'corn_hybrid': 'Hybrid Corn',
            'corn_opm': 'OPM Corn',
            'vegetable': 'Vegetable Seeds'
        };
        return names[code] || code;
    }

    /**
     * Calculate how many farmers are affected by shortage
     */
    calculateAffectedFarmers(fertType, farmerRequests) {
        const fieldMap = {
            'urea_46_0_0': 'requested_urea_bags',
            'complete_14_14_14': 'requested_complete_14_bags',
            'ammonium_sulfate_21_0_0': 'requested_ammonium_sulfate_bags'
        };

        const field = fieldMap[fertType];
        if (!field) return 0;

        return farmerRequests.filter(req =>
            req.status === 'pending' && req[field] > 0
        ).length;
    }

    /**
     * Estimate monetary value of surplus
     */
    estimateSurplusValue(fertType, surplusAmount) {
        const prices = {
            'urea_46_0_0': 1200,
            'complete_14_14_14': 1800,
            'ammonium_sulfate_21_0_0': 900,
            'muriate_potash_0_0_60': 2000
        };

        const pricePerBag = prices[fertType] || 1000;
        const totalValue = surplusAmount * pricePerBag;

        return `₱${totalValue.toLocaleString()}`;
    }

    /**
     * Generate executive summary
     */
    generateSummary(recommendations) {
        const critical = recommendations.filter(r => r.priority === 'CRITICAL').length;
        const high = recommendations.filter(r => r.priority === 'HIGH').length;
        const shortages = recommendations.filter(r => r.type === 'SHORTAGE').length;
        const opportunities = recommendations.filter(r => r.type === 'OPPORTUNITY').length;
        const equityIssues = recommendations.filter(r => r.type === 'EQUITY_ALERT').length;

        return {
            total_recommendations: recommendations.length,
            critical_issues: critical,
            high_priority_issues: high,
            shortages: shortages,
            opportunities: opportunities,
            equity_issues: equityIssues,
            overall_status: critical > 0 ? 'CRITICAL' : high > 0 ? 'ATTENTION_NEEDED' : 'STABLE'
        };
    }
}

module.exports = RecommendationEngine;
