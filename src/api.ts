import { supabase } from './supabase';

/**
 * API Wrapper - Routes all API calls to Supabase
 * This replaces localhost:5000 backend calls with Supabase queries
 * Version: 2.1 - Force redeploy - All screens now use API wrapper
 * Build: 20260201
 */

// Types
interface ApiResponse<T = any> {
    data: T | null;
    error: string | null;
    status: number;
}

// Helper to simulate fetch response
const createResponse = <T>(data: T | null, error: string | null, status: number): ApiResponse<T> => ({
    data,
    error,
    status
});

// Helper to transform Supabase rsbsa_submission record to frontend format
const transformRsbsaRecord = (item: any) => {
    // Get name parts from columns with spaces (Supabase format)
    const lastName = item['LAST NAME'] || '';
    const firstName = item['FIRST NAME'] || '';
    const middleName = item['MIDDLE NAME'] || '';
    const extName = item['EXT NAME'] || '';

    // Build farmer name in "LastName, FirstName MiddleName ExtName" format
    let farmerName = lastName;
    if (firstName) farmerName += `, ${firstName}`;
    if (middleName) farmerName += ` ${middleName}`;
    if (extName) farmerName += ` ${extName}`;

    // Get address/location fields
    const barangay = item['BARANGAY'] || '';
    const municipality = item['MUNICIPALITY'] || 'Dumangas';
    const farmLocation = item['FARM LOCATION'] || barangay || '';

    // Build farmer address
    const farmerAddress = [barangay, municipality, 'Iloilo'].filter(Boolean).join(', ');

    // Get other fields
    const parcelArea = item['PARCEL AREA'] || item['TOTAL FARM AREA'] || '';
    const status = item.status || 'Submitted';
    const referenceNumber = item['FFRS_CODE'] || `RSBSA-${item.id}`;
    const dateSubmitted = item.submitted_at || item.created_at || '';

    // Get ownership type
    const ownershipType = {
        registeredOwner: item['OWNERSHIP_TYPE_REGISTERED_OWNER'] || false,
        tenant: item['OWNERSHIP_TYPE_TENANT'] || false,
        lessee: item['OWNERSHIP_TYPE_LESSEE'] || false
    };

    return {
        id: item.id,
        referenceNumber,
        farmerName: farmerName || 'N/A',
        firstName,
        middleName,
        lastName,
        extName,
        farmerAddress,
        farmLocation,
        parcelArea: String(parcelArea),
        dateSubmitted,
        status,
        landParcel: farmLocation,
        ownershipType,
        gender: item['GENDER'] || '',
        birthdate: item['BIRTHDATE'] || '',
        age: item.age || null,
        mainLivelihood: item['MAIN LIVELIHOOD'] || '',
        totalFarmArea: item['TOTAL FARM AREA'] || 0,
        // Farming activities
        farmerRice: item['FARMER_RICE'] || false,
        farmerCorn: item['FARMER_CORN'] || false,
        farmerOtherCrops: item['FARMER_OTHER_CROPS'] || false,
        farmerOtherCropsText: item['FARMER_OTHER_CROPS_TEXT'] || '',
        farmerLivestock: item['FARMER_LIVESTOCK'] || false,
        farmerLivestockText: item['FARMER_LIVESTOCK_TEXT'] || '',
        farmerPoultry: item['FARMER_POULTRY'] || false,
        farmerPoultryText: item['FARMER_POULTRY_TEXT'] || '',
        // Keep raw data for debugging
        _raw: item
    };
};

// ==================== DASHBOARD STATS ====================

// Get comprehensive dashboard statistics using Supabase
export const getDashboardStats = async (season?: string): Promise<ApiResponse> => {
    try {
        // Calculate current season if not provided
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const defaultSeason = month >= 5 && month <= 10 ? `wet_${year}` : `dry_${year}`;
        const currentSeason = season || defaultSeason;

        // Get total farmers count from rsbsa_submission
        const { data: farmersData, error: farmersError } = await supabase
            .from('rsbsa_submission')
            .select('id, status, OWNERSHIP_TYPE_TENANT, OWNERSHIP_TYPE_LESSEE', { count: 'exact' });

        if (farmersError) {
            console.error('Error fetching farmers:', farmersError);
        }

        const totalFarmers = farmersData?.length || 0;
        const activeFarmers = farmersData?.filter(f =>
            f.status?.toLowerCase() === 'active farmer' ||
            f.status?.toLowerCase() === 'active'
        ).length || 0;

        // Count lessee and tenant farmers
        const lesseeTenantCount = farmersData?.filter(f =>
            f.OWNERSHIP_TYPE_LESSEE === true || f.OWNERSHIP_TYPE_TENANT === true
        ).length || 0;

        // Get farmer requests for current season
        const { data: requestsData, error: requestsError } = await supabase
            .from('farmer_requests')
            .select('id, status, season');

        if (requestsError) {
            console.error('Error fetching requests:', requestsError);
        }

        const seasonRequests = requestsData?.filter(r => r.season === currentSeason) || [];
        const allRequests = requestsData || [];

        const currentSeasonStats = {
            total: seasonRequests.length,
            pending: seasonRequests.filter(r => r.status === 'pending').length,
            approved: seasonRequests.filter(r => r.status === 'approved').length,
            rejected: seasonRequests.filter(r => r.status === 'rejected').length,
            distributed: seasonRequests.filter(r => r.status === 'distributed').length
        };

        const allTimeStats = {
            total: allRequests.length,
            pending: allRequests.filter(r => r.status === 'pending').length,
            approved: allRequests.filter(r => r.status === 'approved').length,
            distributed: allRequests.filter(r => r.status === 'distributed').length
        };

        // Calculate percentages for status breakdown
        const totalRequests = currentSeasonStats.total || 1; // Avoid division by zero
        const statusBreakdown = {
            approved: Math.round((currentSeasonStats.approved / totalRequests) * 100),
            pending: Math.round((currentSeasonStats.pending / totalRequests) * 100),
            rejected: Math.round((currentSeasonStats.rejected / totalRequests) * 100),
            distributed: Math.round((currentSeasonStats.distributed / totalRequests) * 100)
        };

        // Get regional allocations for current season
        const { data: allocationData } = await supabase
            .from('regional_allocations')
            .select('*')
            .eq('season', currentSeason)
            .single();

        const fertilizerAllocated = allocationData ?
            (allocationData.urea_46_0_0_bags || 0) +
            (allocationData.complete_14_14_14_bags || 0) +
            (allocationData.ammonium_sulfate_21_0_0_bags || 0) +
            (allocationData.muriate_potash_0_0_60_bags || 0) : 0;

        const seedsAllocated = allocationData ?
            (allocationData.jackpot_kg || 0) +
            (allocationData.us88_kg || 0) +
            (allocationData.th82_kg || 0) +
            (allocationData.rh9000_kg || 0) +
            (allocationData.lumping143_kg || 0) +
            (allocationData.lp296_kg || 0) : 0;

        // Get distribution records filtered by season through farmer_requests
        // First get the request IDs for the current season
        const seasonRequestIds = seasonRequests.map(r => r.id);

        // Then get distribution records only for those requests
        let totalFertilizerDistributed = 0;
        let totalSeedsDistributed = 0;

        if (seasonRequestIds.length > 0) {
            const { data: distributionData } = await supabase
                .from('distribution_records')
                .select('fertilizer_bags_given, seed_kg_given, request_id')
                .in('request_id', seasonRequestIds);

            totalFertilizerDistributed = distributionData?.reduce((sum, d) => sum + (d.fertilizer_bags_given || 0), 0) || 0;
            totalSeedsDistributed = distributionData?.reduce((sum, d) => sum + (d.seed_kg_given || 0), 0) || 0;
        }

        // Calculate progress
        const fertilizerProgress = fertilizerAllocated > 0 ? Math.round((totalFertilizerDistributed / fertilizerAllocated) * 100) : 0;
        const seedsProgress = seedsAllocated > 0 ? Math.round((totalSeedsDistributed / seedsAllocated) * 100) : 0;
        const totalAllocated = fertilizerAllocated + seedsAllocated;
        const totalDistributed = totalFertilizerDistributed + totalSeedsDistributed;
        const overallProgress = totalAllocated > 0 ? Math.round((totalDistributed / totalAllocated) * 100) : 0;

        // Get unique barangays
        const { data: barangayData } = await supabase
            .from('rsbsa_submission')
            .select('BARANGAY');

        const uniqueBarangays = new Set(barangayData?.map(b => b.BARANGAY).filter(Boolean));

        const dashboardStats = {
            currentSeason,
            seasonEndDate: month >= 5 && month <= 10 ? `October 31, ${year}` : `April 30, ${year + (month <= 4 ? 0 : 1)}`,
            farmers: {
                total: totalFarmers,
                active: activeFarmers,
                lessee: lesseeTenantCount
            },
            requests: {
                currentSeason: currentSeasonStats,
                allTime: allTimeStats,
                statusBreakdown
            },
            distribution: {
                fertilizer: {
                    allocated: fertilizerAllocated,
                    distributed: totalFertilizerDistributed,
                    remaining: Math.max(0, fertilizerAllocated - totalFertilizerDistributed),
                    progress: fertilizerProgress
                },
                seeds: {
                    allocated: seedsAllocated,
                    distributed: totalSeedsDistributed,
                    remaining: Math.max(0, seedsAllocated - totalSeedsDistributed),
                    progress: seedsProgress
                },
                overall: {
                    progress: overallProgress,
                    totalAllocated,
                    totalDistributed
                }
            },
            coverage: {
                totalBarangays: uniqueBarangays.size,
                barangaysWithRequests: uniqueBarangays.size
            },
            processingTime: {
                averageDays: 'N/A'
            }
        };

        console.log('📊 Dashboard stats from Supabase:', dashboardStats);
        return createResponse(dashboardStats, null, 200);
    } catch (error: any) {
        console.error('Error fetching dashboard stats:', error);
        return createResponse(null, error.message, 500);
    }
};

// Get monthly distribution trends using Supabase
export const getMonthlyTrends = async (_season?: string): Promise<ApiResponse> => {
    try {
        const { data: distributionData, error } = await supabase
            .from('distribution_records')
            .select('distribution_date, fertilizer_bags_given, seed_kg_given')
            .order('distribution_date', { ascending: true });

        if (error) {
            console.error('Error fetching distribution records:', error);
            return createResponse([], null, 200);
        }

        // Group by month
        const monthlyData: { [key: string]: { fertilizer: number; seeds: number; count: number } } = {};
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        (distributionData || []).forEach(record => {
            if (record.distribution_date) {
                const date = new Date(record.distribution_date);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

                if (!monthlyData[monthKey]) {
                    monthlyData[monthKey] = { fertilizer: 0, seeds: 0, count: 0 };
                }

                monthlyData[monthKey].fertilizer += record.fertilizer_bags_given || 0;
                monthlyData[monthKey].seeds += record.seed_kg_given || 0;
                monthlyData[monthKey].count += 1;
            }
        });

        // Convert to array and format
        const trends = Object.entries(monthlyData)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-12) // Last 12 months
            .map(([month, data]) => {
                const [_year, monthNum] = month.split('-');
                return {
                    month,
                    monthName: monthNames[parseInt(monthNum) - 1],
                    fertilizer: data.fertilizer,
                    seeds: data.seeds,
                    count: data.count
                };
            });

        return createResponse(trends, null, 200);
    } catch (error: any) {
        console.error('Error fetching monthly trends:', error);
        return createResponse([], null, 200);
    }
};

// Get recent activity using Supabase
export const getRecentActivity = async (limit: number = 5): Promise<ApiResponse> => {
    try {
        const { data, error } = await supabase
            .from('distribution_records')
            .select(`
                id,
                fertilizer_type,
                fertilizer_bags_given,
                seed_type,
                seed_kg_given,
                distribution_date,
                verified_by,
                created_at,
                farmer_requests (
                    farmer_name,
                    barangay
                )
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching recent activity:', error);
            return createResponse([], null, 200);
        }

        // Flatten the data to include farmer_name and barangay at the top level
        // farmer_requests is returned as an object (single record) since request_id is a foreign key
        const flattenedData = (data || []).map((record: any) => {
            const farmerRequest = record.farmer_requests;
            return {
                id: record.id,
                farmer_name: farmerRequest?.farmer_name || 'Unknown',
                barangay: farmerRequest?.barangay || 'Unknown',
                fertilizer_type: record.fertilizer_type,
                fertilizer_bags_given: record.fertilizer_bags_given,
                seed_type: record.seed_type,
                seed_kg_given: record.seed_kg_given,
                distribution_date: record.distribution_date,
                verified_by: record.verified_by,
                created_at: record.created_at
            };
        });

        return createResponse(flattenedData, null, 200);
    } catch (error: any) {
        console.error('Error fetching recent activity:', error);
        return createResponse([], null, 200);
    }
};

// Get available seasons using Supabase
export const getAvailableSeasons = async (): Promise<ApiResponse> => {
    try {
        const { data, error } = await supabase
            .from('regional_allocations')
            .select('season, season_start_date, season_end_date, status')
            .order('season_start_date', { ascending: false });

        if (error) {
            console.error('Error fetching seasons:', error);
            // Return default season on error
            const now = new Date();
            const month = now.getMonth() + 1;
            const year = now.getFullYear();
            const defaultSeason = month >= 5 && month <= 10 ? `wet_${year}` : `dry_${year}`;
            return createResponse([{
                season: defaultSeason,
                season_start_date: '',
                season_end_date: '',
                status: 'active'
            }], null, 200);
        }

        // If no allocations exist, return current season
        if (!data || data.length === 0) {
            const now = new Date();
            const month = now.getMonth() + 1;
            const year = now.getFullYear();
            const defaultSeason = month >= 5 && month <= 10 ? `wet_${year}` : `dry_${year}`;
            return createResponse([{
                season: defaultSeason,
                season_start_date: '',
                season_end_date: '',
                status: 'active'
            }], null, 200);
        }

        return createResponse(data, null, 200);
    } catch (error: any) {
        console.error('Error fetching available seasons:', error);
        return createResponse(null, error.message, 500);
    }
};

// ==================== RSBSA SUBMISSION ====================

export const getRsbsaSubmissions = async (): Promise<ApiResponse> => {
    const { data, error } = await supabase
        .from('rsbsa_submission')
        .select('*');

    if (error) return createResponse(null, error.message, 500);

    // Transform all records
    const transformedData = (data || []).map(transformRsbsaRecord);

    console.log('📊 Transformed RSBSA data:', transformedData.length, 'records');
    if (transformedData.length > 0) {
        console.log('📝 Sample transformed record:', transformedData[0]);
    }

    return createResponse(transformedData, null, 200);
};

export const getRsbsaSubmissionById = async (id: string | number): Promise<ApiResponse> => {
    const { data, error } = await supabase
        .from('rsbsa_submission')
        .select('*')
        .eq('id', id)
        .single();

    if (error) return createResponse(null, error.message, 404);

    // Transform the single record
    const transformedData = transformRsbsaRecord(data);

    return createResponse(transformedData, null, 200);
};

export const createRsbsaSubmission = async (submissionData: any): Promise<ApiResponse> => {
    // Transform camelCase form data to Supabase column names (UPPERCASE with spaces)
    const formData = submissionData.data || submissionData;

    // Determine ownership type from category or parcels
    const ownershipCategory = formData.ownershipCategory || 'registeredOwner';
    const isRegisteredOwner = ownershipCategory === 'registeredOwner';
    const isTenant = ownershipCategory === 'tenant';
    const isLessee = ownershipCategory === 'lessee';

    // Calculate total farm area from parcels
    const parcels = formData.farmlandParcels || [];
    const totalFarmArea = parcels.reduce((sum: number, p: any) => {
        const area = parseFloat(p.totalFarmAreaHa) || 0;
        return sum + area;
    }, 0);

    // Get first parcel location as default farm location
    const firstParcel = parcels[0] || {};

    const transformedData: Record<string, any> = {
        "LAST NAME": formData.lastName || formData.surname || '',
        "FIRST NAME": formData.firstName || '',
        "MIDDLE NAME": formData.middleName || '',
        "EXT NAME": formData.extName || formData.extensionName || '',
        "BARANGAY": formData.barangay || formData.address?.barangay || '',
        "MUNICIPALITY": formData.municipality || formData.address?.municipality || 'Dumangas',
        "GENDER": formData.gender || formData.sex || '',
        "BIRTHDATE": formData.dateOfBirth || formData.birthdate || null,
        "MAIN LIVELIHOOD": formData.mainLivelihood || '',
        "TOTAL FARM AREA": totalFarmArea,
        "FARM LOCATION": firstParcel.farmLocationBarangay || formData.barangay || '',
        "PARCEL AREA": firstParcel.totalFarmAreaHa || totalFarmArea || 0,
        "OWNERSHIP_TYPE_REGISTERED_OWNER": isRegisteredOwner,
        "OWNERSHIP_TYPE_TENANT": isTenant,
        "OWNERSHIP_TYPE_LESSEE": isLessee,
        "FARMER_RICE": formData.farmerRice || false,
        "FARMER_CORN": formData.farmerCorn || false,
        "FARMER_OTHER_CROPS": formData.farmerOtherCrops || false,
        "FARMER_OTHER_CROPS_TEXT": formData.farmerOtherCropsText || '',
        "FARMER_LIVESTOCK": formData.farmerLivestock || false,
        "FARMER_LIVESTOCK_TEXT": formData.farmerLivestockText || '',
        "FARMER_POULTRY": formData.farmerPoultry || false,
        "FARMER_POULTRY_TEXT": formData.farmerPoultryText || '',
        "status": 'Submitted'
    };

    // Remove null/undefined values
    Object.keys(transformedData).forEach(key => {
        if (transformedData[key] === undefined || transformedData[key] === null) {
            delete transformedData[key];
        }
    });

    console.log('Creating RSBSA submission with data:', transformedData);

    const { data, error } = await supabase
        .from('rsbsa_submission')
        .insert(transformedData)
        .select()
        .single();

    if (error) {
        console.error('Supabase insert error:', error);
        return createResponse(null, error.message, 500);
    }

    // Create land_history records for each parcel (NEW SCHEMA)
    const submissionId = data.id;
    const farmerFullName = `${formData.firstName || ''} ${formData.middleName || ''} ${formData.surname || ''}`.trim();
    const selectedLandOwner = formData.selectedLandOwner;

    try {
        for (const parcel of parcels) {
            const barangay = parcel.farmLocationBarangay || '';
            const municipality = parcel.farmLocationMunicipality || 'Dumangas';
            const areaHa = parseFloat(parcel.totalFarmAreaHa) || 0;

            // Step 1: Check if parcel already exists or create new one
            let landParcelId: number | null = null;
            let parcelNumber = parcel.parcelNo || '';
            let previousHistoryId: number | null = null;

            // Check if an existing parcel was selected from the UI
            if (parcel.existingParcelId) {
                // Use the pre-selected existing parcel
                landParcelId = parcel.existingParcelId;
                parcelNumber = parcel.existingParcelNumber || parcelNumber;
                console.log('📍 Using pre-selected existing parcel:', parcelNumber, 'ID:', landParcelId);

                // Find current holder to close their record
                const { data: currentHolder } = await supabase
                    .from('land_history')
                    .select('id')
                    .eq('land_parcel_id', landParcelId)
                    .eq('is_current', true)
                    .single();

                if (currentHolder) {
                    previousHistoryId = currentHolder.id;
                    // Close the previous holder's record
                    await supabase
                        .from('land_history')
                        .update({
                            is_current: false,
                            period_end_date: new Date().toISOString().split('T')[0]
                        })
                        .eq('id', currentHolder.id);
                    console.log('📝 Closed previous holder record:', currentHolder.id);
                }
            } else if (parcelNumber) {
                // Try to find existing parcel by parcel_number
                const { data: existingParcel } = await supabase
                    .from('land_parcels')
                    .select('id, parcel_number')
                    .eq('parcel_number', parcelNumber)
                    .single();

                if (existingParcel) {
                    landParcelId = existingParcel.id;
                    console.log('📍 Found existing parcel by number:', parcelNumber);

                    // Find current holder to close their record
                    const { data: currentHolder } = await supabase
                        .from('land_history')
                        .select('id')
                        .eq('land_parcel_id', landParcelId)
                        .eq('is_current', true)
                        .single();

                    if (currentHolder) {
                        previousHistoryId = currentHolder.id;
                        // Close the previous holder's record
                        await supabase
                            .from('land_history')
                            .update({
                                is_current: false,
                                period_end_date: new Date().toISOString().split('T')[0]
                            })
                            .eq('id', currentHolder.id);
                        console.log('📝 Closed previous holder record:', currentHolder.id);
                    }
                }
            }

            // If no existing parcel found, create a new one
            if (!landParcelId) {
                // Generate parcel number if not provided
                if (!parcelNumber) {
                    // Use the generate_parcel_number function or create manually
                    const brgyCode = barangay.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '') || 'UNK';
                    const year = new Date().getFullYear();
                    const timestamp = Date.now().toString().slice(-4);
                    parcelNumber = `${brgyCode}-${year}-${timestamp}`;
                }

                const { data: newParcel, error: parcelError } = await supabase
                    .from('land_parcels')
                    .insert({
                        parcel_number: parcelNumber,
                        farm_location_barangay: barangay,
                        farm_location_municipality: municipality,
                        total_farm_area_ha: areaHa,
                        within_ancestral_domain: parcel.withinAncestralDomain === 'Yes' || parcel.withinAncestralDomain === true,
                        agrarian_reform_beneficiary: parcel.agrarianReformBeneficiary === 'Yes' || parcel.agrarianReformBeneficiary === true,
                        ownership_document_no: parcel.ownershipDocumentNo || '',
                        ownership_document_type: parcel.ownershipDocumentType || null,
                        is_active: true
                    })
                    .select('id, parcel_number')
                    .single();

                if (parcelError) {
                    console.warn('Land parcel insert warning:', parcelError.message);
                    // Try to continue without parcel linking
                } else if (newParcel) {
                    landParcelId = newParcel.id;
                    parcelNumber = newParcel.parcel_number;
                    console.log('✅ Created new land parcel:', parcelNumber);
                }
            }

            // Step 2: Create land_history record
            const changeType = previousHistoryId ? 'TRANSFER' : 'NEW';
            const changeReason = previousHistoryId
                ? (isRegisteredOwner ? 'Ownership transfer via RSBSA' : isTenant ? 'New tenant registered via RSBSA' : 'New lessee registered via RSBSA')
                : (isRegisteredOwner ? 'Initial RSBSA registration as owner' : isTenant ? 'Registered as tenant through RSBSA' : 'Registered as lessee through RSBSA');

            const landHistoryRecord: Record<string, any> = {
                land_parcel_id: landParcelId,
                parcel_number: parcelNumber,
                farm_location_barangay: barangay,
                farm_location_municipality: municipality,
                total_farm_area_ha: areaHa,
                farmer_id: submissionId,
                farmer_name: farmerFullName,
                is_registered_owner: isRegisteredOwner,
                is_tenant: isTenant,
                is_lessee: isLessee,
                is_current: true,
                period_start_date: new Date().toISOString().split('T')[0],
                change_type: changeType,
                change_reason: changeReason,
                previous_history_id: previousHistoryId,
                rsbsa_submission_id: submissionId,
                within_ancestral_domain: parcel.withinAncestralDomain === 'Yes' || parcel.withinAncestralDomain === true,
                agrarian_reform_beneficiary: parcel.agrarianReformBeneficiary === 'Yes' || parcel.agrarianReformBeneficiary === true,
                ownership_document_no: parcel.ownershipDocumentNo || '',
            };

            // For tenant/lessee: add land owner info
            if ((isTenant || isLessee) && selectedLandOwner) {
                landHistoryRecord.land_owner_id = selectedLandOwner.id;
                landHistoryRecord.land_owner_name = selectedLandOwner.name;
            } else if (isRegisteredOwner) {
                // Owner is also the land owner
                landHistoryRecord.land_owner_id = submissionId;
                landHistoryRecord.land_owner_name = farmerFullName;
            }

            // Insert land_history record
            const { error: historyError } = await supabase
                .from('land_history')
                .insert(landHistoryRecord);

            if (historyError) {
                console.warn('Land history insert warning (non-blocking):', historyError.message);
            } else {
                console.log('✅ Created land_history record for parcel:', parcelNumber, 'Type:', changeType);
            }
        }
    } catch (historyErr) {
        console.warn('Error creating land history (non-blocking):', historyErr);
    }

    // Return in the format the frontend expects
    return createResponse({
        message: 'Submission successful',
        submissionId: data.id,
        submittedAt: data.created_at || new Date().toISOString(),
        ...data
    }, null, 201);
};

export const updateRsbsaSubmission = async (id: string | number, updateData: any): Promise<ApiResponse> => {
    const { data, error } = await supabase
        .from('rsbsa_submission')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

    if (error) return createResponse(null, error.message, 500);
    return createResponse(data, null, 200);
};

export const deleteRsbsaSubmission = async (id: string | number): Promise<ApiResponse> => {
    const { error } = await supabase
        .from('rsbsa_submission')
        .delete()
        .eq('id', id);

    if (error) return createResponse(null, error.message, 500);
    return createResponse({ success: true }, null, 200);
};

// ==================== FARM PARCELS ====================

export const getFarmParcels = async (submissionId: string | number): Promise<ApiResponse> => {
    // Try different possible column names for the submission ID
    // First try snake_case, then try with quotes for spaces
    let { data, error } = await supabase
        .from('rsbsa_farm_parcels')
        .select('*')
        .eq('submission_id', submissionId);

    // If that fails, the table might not exist or have different structure
    // Return empty array instead of error for now (prototype)
    if (error) {
        console.log('Farm parcels query error (non-blocking):', error.message);
        return createResponse([], null, 200);
    }
    return createResponse(data || [], null, 200);
};

export const createFarmParcel = async (parcelData: any): Promise<ApiResponse> => {
    const { data, error } = await supabase
        .from('rsbsa_farm_parcels')
        .insert(parcelData)
        .select()
        .single();

    if (error) return createResponse(null, error.message, 500);
    return createResponse(data, null, 201);
};

export const updateFarmParcel = async (id: string | number, updateData: any): Promise<ApiResponse> => {
    const { data, error } = await supabase
        .from('rsbsa_farm_parcels')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

    if (error) return createResponse(null, error.message, 500);
    return createResponse(data, null, 200);
};

// ==================== LAND PLOTS ====================

export const getLandPlots = async (): Promise<ApiResponse> => {
    const { data, error } = await supabase
        .from('land_plots')
        .select('*');

    if (error) return createResponse(null, error.message, 500);
    return createResponse(data, null, 200);
};

export const getLandPlotById = async (id: string | number): Promise<ApiResponse> => {
    const { data, error } = await supabase
        .from('land_plots')
        .select('*')
        .eq('id', id)
        .single();

    if (error) return createResponse(null, error.message, 404);
    return createResponse(data, null, 200);
};

export const createLandPlot = async (plotData: any): Promise<ApiResponse> => {
    const { data, error } = await supabase
        .from('land_plots')
        .insert(plotData)
        .select()
        .single();

    if (error) return createResponse(null, error.message, 500);
    return createResponse(data, null, 201);
};

export const updateLandPlot = async (id: string | number, updateData: any): Promise<ApiResponse> => {
    const { data, error } = await supabase
        .from('land_plots')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

    if (error) return createResponse(null, error.message, 500);
    return createResponse(data, null, 200);
};

export const deleteLandPlot = async (id: string | number): Promise<ApiResponse> => {
    const { error } = await supabase
        .from('land_plots')
        .delete()
        .eq('id', id);

    if (error) return createResponse(null, error.message, 500);
    return createResponse({ success: true }, null, 200);
};

// ==================== DISTRIBUTION ALLOCATIONS ====================

export const getAllocations = async (): Promise<ApiResponse> => {
    const { data, error } = await supabase
        .from('regional_allocations')
        .select('*');

    if (error) return createResponse(null, error.message, 500);
    return createResponse(data, null, 200);
};

export const getAllocationById = async (id: string | number): Promise<ApiResponse> => {
    const { data, error } = await supabase
        .from('regional_allocations')
        .select('*')
        .eq('id', id)
        .single();

    if (error) return createResponse(null, error.message, 404);
    return createResponse(data, null, 200);
};

export const getAllocationBySeason = async (season: string): Promise<ApiResponse> => {
    const { data, error } = await supabase
        .from('regional_allocations')
        .select('*')
        .eq('season', season)
        .single();

    if (error) return createResponse(null, error.message, 404);
    return createResponse(data, null, 200);
};

export const createAllocation = async (allocationData: any): Promise<ApiResponse> => {
    const { data, error } = await supabase
        .from('regional_allocations')
        .insert(allocationData)
        .select()
        .single();

    if (error) return createResponse(null, error.message, 500);
    return createResponse(data, null, 201);
};

export const updateAllocation = async (id: string | number, updateData: any): Promise<ApiResponse> => {
    const { data, error } = await supabase
        .from('regional_allocations')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

    if (error) return createResponse(null, error.message, 500);
    return createResponse(data, null, 200);
};

export const deleteAllocation = async (id: string | number): Promise<ApiResponse> => {
    const { error } = await supabase
        .from('regional_allocations')
        .delete()
        .eq('id', id);

    if (error) return createResponse(null, error.message, 500);
    return createResponse({ success: true }, null, 200);
};

// ==================== FARMER REQUESTS ====================

export const getFarmerRequests = async (season?: string): Promise<ApiResponse> => {
    let query = supabase.from('farmer_requests').select('*');

    if (season) {
        query = query.eq('season', season);
    }

    const { data, error } = await query;

    if (error) return createResponse(null, error.message, 500);
    return createResponse(data, null, 200);
};

export const getFarmerRequestById = async (id: string | number): Promise<ApiResponse> => {
    const { data, error } = await supabase
        .from('farmer_requests')
        .select('*')
        .eq('id', id)
        .single();

    if (error) return createResponse(null, error.message, 404);
    return createResponse(data, null, 200);
};

export const createFarmerRequest = async (requestData: any): Promise<ApiResponse> => {
    const { data, error } = await supabase
        .from('farmer_requests')
        .insert(requestData)
        .select()
        .single();

    if (error) return createResponse(null, error.message, 500);
    return createResponse(data, null, 201);
};

export const updateFarmerRequest = async (id: string | number, updateData: any): Promise<ApiResponse> => {
    const { data, error } = await supabase
        .from('farmer_requests')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

    if (error) return createResponse(null, error.message, 500);
    return createResponse(data, null, 200);
};

export const deleteFarmerRequest = async (id: string | number): Promise<ApiResponse> => {
    const { error } = await supabase
        .from('farmer_requests')
        .delete()
        .eq('id', id);

    if (error) return createResponse(null, error.message, 500);
    return createResponse({ success: true }, null, 200);
};

// ==================== DISTRIBUTION RECORDS ====================

export const getDistributionRecords = async (): Promise<ApiResponse> => {
    const { data, error } = await supabase
        .from('distribution_records')
        .select('*');

    if (error) return createResponse(null, error.message, 500);
    return createResponse(data, null, 200);
};

export const createDistributionRecord = async (recordData: any): Promise<ApiResponse> => {
    const { data, error } = await supabase
        .from('distribution_records')
        .insert(recordData)
        .select()
        .single();

    if (error) return createResponse(null, error.message, 500);
    return createResponse(data, null, 201);
};

// ==================== LAND OWNERS ====================

export const getLandOwners = async (): Promise<ApiResponse> => {
    // Get registered owners from rsbsa_submission
    // The column name in rsbsa_submission is OWNERSHIP_TYPE_REGISTERED_OWNER
    const { data, error } = await supabase
        .from('rsbsa_submission')
        .select('id, "FIRST NAME", "LAST NAME", "MIDDLE NAME", "BARANGAY", "MUNICIPALITY"')
        .eq('OWNERSHIP_TYPE_REGISTERED_OWNER', true);

    if (error) {
        console.error('getLandOwners error:', error);
        return createResponse(null, error.message, 500);
    }

    // Transform to expected format with full name
    const landOwners = (data || []).map((row: any) => ({
        id: row.id,
        name: `${row['FIRST NAME'] || ''} ${row['MIDDLE NAME'] || ''} ${row['LAST NAME'] || ''}`.replace(/\s+/g, ' ').trim(),
        barangay: row['BARANGAY'] || '',
        municipality: row['MUNICIPALITY'] || 'Dumangas'
    }));

    return createResponse(landOwners, null, 200);
};

// ==================== LAND HISTORY ====================

export const getLandHistory = async (landPlotId?: string | number): Promise<ApiResponse> => {
    let query = supabase.from('land_history').select('*');

    if (landPlotId) {
        query = query.eq('land_plot_id', landPlotId);
    }

    const { data, error } = await query;

    if (error) return createResponse(null, error.message, 500);
    return createResponse(data, null, 200);
};

// ==================== USERS ====================

export const getUsers = async (): Promise<ApiResponse> => {
    const { data, error } = await supabase
        .from('users')
        .select('*');

    if (error) return createResponse(null, error.message, 500);
    return createResponse(data, null, 200);
};

export const getUserById = async (id: string | number): Promise<ApiResponse> => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

    if (error) return createResponse(null, error.message, 404);
    return createResponse(data, null, 200);
};

// ==================== UNIVERSAL API FETCH ====================

/**
 * Universal fetch replacement - automatically routes to Supabase
 * Use this as a drop-in replacement for fetch('http://localhost:5000/api/...')
 */
export const apiFetch = async (url: string, options?: RequestInit): Promise<any> => {
    const method = options?.method || 'GET';
    const body = options?.body ? JSON.parse(options.body as string) : null;

    // Parse the URL to extract endpoint and params
    const urlPath = url.replace('http://localhost:5000', '').replace(/^\/api\//, '');
    const parts = urlPath.split('/');

    console.log('🔄 API Fetch intercepted:', { url, method, parts });

    // Route to appropriate Supabase function
    try {
        // RSBSA Submission routes
        if (parts[0] === 'rsbsa_submission') {
            if (parts.length === 1) {
                if (method === 'GET') return getRsbsaSubmissions();
                if (method === 'POST') return createRsbsaSubmission(body);
            }
            if (parts.length === 2) {
                const id = parts[1];
                if (method === 'GET') return getRsbsaSubmissionById(id);
                if (method === 'PUT') return updateRsbsaSubmission(id, body);
                if (method === 'DELETE') return deleteRsbsaSubmission(id);
            }
            if (parts.length === 3 && parts[2] === 'parcels') {
                return getFarmParcels(parts[1]);
            }
        }

        // Land plots routes
        if (parts[0] === 'land-plots') {
            if (parts.length === 1) {
                if (method === 'GET') return getLandPlots();
                if (method === 'POST') return createLandPlot(body);
            }
            if (parts.length === 2) {
                const id = parts[1];
                if (method === 'GET') return getLandPlotById(id);
                if (method === 'PUT') return updateLandPlot(id, body);
                if (method === 'DELETE') return deleteLandPlot(id);
            }
        }

        // Distribution routes
        if (parts[0] === 'distribution') {
            if (parts[1] === 'allocations') {
                if (parts.length === 2) {
                    if (method === 'GET') return getAllocations();
                    if (method === 'POST') return createAllocation(body);
                }
                if (parts.length === 3) {
                    const id = parts[2];
                    if (method === 'GET') return getAllocationById(id);
                    if (method === 'PUT') return updateAllocation(id, body);
                }
            }
            if (parts[1] === 'requests') {
                if (parts.length === 2) {
                    if (method === 'GET') return getFarmerRequests();
                    if (method === 'POST') return createFarmerRequest(body);
                }
                if (parts.length === 3) {
                    const idOrSeason = parts[2];
                    if (method === 'GET') {
                        // Check if it's a season or ID
                        if (isNaN(Number(idOrSeason))) {
                            return getFarmerRequests(idOrSeason);
                        }
                        return getFarmerRequestById(idOrSeason);
                    }
                    if (method === 'PUT') return updateFarmerRequest(idOrSeason, body);
                    if (method === 'DELETE') return deleteFarmerRequest(idOrSeason);
                }
            }
            if (parts[1] === 'records') {
                if (method === 'GET') return getDistributionRecords();
                if (method === 'POST') return createDistributionRecord(body);
            }
        }

        // Landowners route
        if (parts[0] === 'landowners') {
            return getLandOwners();
        }

        // Land history route
        if (parts[0] === 'land-history') {
            if (parts.length === 2) {
                return getLandHistory(parts[1]);
            }
            return getLandHistory();
        }

        // Users route
        if (parts[0] === 'users') {
            if (parts.length === 1) return getUsers();
            if (parts.length === 2) return getUserById(parts[1]);
        }

        console.warn('⚠️ Unhandled API route:', url);
        return createResponse(null, `Unhandled route: ${url}`, 404);

    } catch (error: any) {
        console.error('❌ API Fetch error:', error);
        return createResponse(null, error.message, 500);
    }
};

// Export default for easy importing
export default {
    // RSBSA
    getRsbsaSubmissions,
    getRsbsaSubmissionById,
    createRsbsaSubmission,
    updateRsbsaSubmission,
    deleteRsbsaSubmission,

    // Farm Parcels
    getFarmParcels,
    createFarmParcel,
    updateFarmParcel,

    // Land Plots
    getLandPlots,
    getLandPlotById,
    createLandPlot,
    updateLandPlot,
    deleteLandPlot,

    // Allocations
    getAllocations,
    getAllocationById,
    getAllocationBySeason,
    createAllocation,
    updateAllocation,
    deleteAllocation,

    // Farmer Requests
    getFarmerRequests,
    getFarmerRequestById,
    createFarmerRequest,
    updateFarmerRequest,
    deleteFarmerRequest,

    // Distribution Records
    getDistributionRecords,
    createDistributionRecord,

    // Land Owners
    getLandOwners,

    // Land History
    getLandHistory,

    // Users
    getUsers,
    getUserById,

    // Dashboard
    getDashboardStats,
    getMonthlyTrends,
    getRecentActivity,
    getAvailableSeasons,

    // Universal fetch
    apiFetch
};
