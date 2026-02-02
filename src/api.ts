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
        "TOTAL FARM AREA": formData.totalFarmArea || 0,
        "FARM LOCATION": formData.farmLocation || formData.barangay || '',
        "PARCEL AREA": formData.parcelArea || formData.totalFarmArea || 0,
        "OWNERSHIP_TYPE_REGISTERED_OWNER": formData.ownershipTypeRegisteredOwner || false,
        "OWNERSHIP_TYPE_TENANT": formData.ownershipTypeTenant || false,
        "OWNERSHIP_TYPE_LESSEE": formData.ownershipTypeLessee || false,
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
    const { data, error } = await supabase
        .from('rsbsa_submission')
        .select('*')
        .eq('is_registered_owner', true);

    if (error) return createResponse(null, error.message, 500);
    return createResponse(data, null, 200);
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

    // Universal fetch
    apiFetch
};
