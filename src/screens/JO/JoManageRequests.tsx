import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getAllocations, getFarmerRequests, deleteFarmerRequest, updateFarmerRequest, createDistributionRecord } from '../../api';
import '../../assets/css/jo css/JoManageRequests.css';
import '../../components/layout/sidebarStyle.css';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import MasterlistIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';
import LandRecsIcon from '../../assets/images/landrecord.png';

interface FarmerRequest {
    id: number;
    season: string;
    request_date: string;
    farmer_id: number;
    farmer_name: string;
    barangay: string;
    farm_area_ha: number;
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
    status: string;
    notes?: string;
    request_notes: string;
    created_at: string;
}

interface AllocationDetails {
    id: number;
    season: string;
    allocation_date: string;
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
}

const JoManageRequests: React.FC = () => {
    const navigate = useNavigate();
    const { allocationId } = useParams<{ allocationId: string }>();
    const [allocation, setAllocation] = useState<AllocationDetails | null>(null);
    const [requests, setRequests] = useState<FarmerRequest[]>([]);
    const [filteredRequests, setFilteredRequests] = useState<FarmerRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [barangayFilter, setBarangayFilter] = useState<string>('all');

    // DSS Feature: Alternative suggestions
    const [, setShowAlternatives] = useState<{ [key: number]: boolean }>({});
    const [alternatives, setAlternatives] = useState<{ [key: number]: any }>({});
    const [, setLoadingAlternatives] = useState<{ [key: number]: boolean }>({});

    // DSS Feature: Apply alternatives
    const [selectedAlternative, setSelectedAlternative] = useState<{ [key: number]: { suggestionIdx: number, alternativeIdx: number } }>({});
    const [applyingAlternative, setApplyingAlternative] = useState<{ [key: number]: boolean }>({});

    // Edit Feature
    const [editingRequest, setEditingRequest] = useState<number | null>(null);
    const [editFormData, setEditFormData] = useState<Partial<FarmerRequest>>({});

    // Auto-suggestion notifications
    const [autoSuggestionsCount, setAutoSuggestionsCount] = useState<number>(0);
    const [newSuggestionsCount, setNewSuggestionsCount] = useState<number>(0);

    // Suggestions Modal Feature
    const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
    const [expandedFarmerInModal, setExpandedFarmerInModal] = useState<number | null>(null);

    const isActive = (path: string) => location.pathname === path;

    const handleLogout = () => {
        localStorage.removeItem('isAuthenticated');
        navigate('/login');
    };

    useEffect(() => {
        fetchAllocation();
        fetchRequests();
    }, [allocationId]);

    useEffect(() => {
        filterRequests();
    }, [requests, searchTerm, statusFilter, barangayFilter]);

    const fetchAllocation = async () => {
        try {
            const response = await getAllocations();
            if (!response.error) {
                const allocations = response.data || [];
                const found = allocations.find((a: any) => a.id === parseInt(allocationId || '0'));
                setAllocation(found || null);
            }
        } catch (err) {
            console.error('Failed to fetch allocation:', err);
        }
    };

    const fetchRequests = async () => {
        try {
            setLoading(true);
            setError(null);

            // First get the allocation to get the season
            const allocationResponse = await getAllocations();
            if (allocationResponse.error) {
                throw new Error('Failed to fetch allocation');
            }
            const allocations = allocationResponse.data || [];
            const currentAllocation = allocations.find((a: any) => a.id === parseInt(allocationId || '0'));

            if (!currentAllocation) {
                throw new Error('Allocation not found');
            }

            // Fetch requests by season
            const response = await getFarmerRequests(currentAllocation.season);
            if (response.error) {
                throw new Error('Failed to fetch requests');
            }

            const data = response.data || [];
            setRequests(data);

            // Auto-fetch alternatives for requests with potential shortages
            // Pass currentAllocation directly to avoid state timing issues
            setTimeout(() => autoFetchAlternativesForShortages(data, currentAllocation), 500);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Auto-fetch alternatives for all pending requests with shortages
    const autoFetchAlternativesForShortages = async (requestsList: FarmerRequest[], allocationData: AllocationDetails) => {
        if (!allocationData) {
            console.log('⚠️ No allocation data provided, skipping auto-fetch');
            return;
        }

        const pendingRequests = requestsList.filter(r => r.status === 'pending');
        console.log(`📊 Checking ${pendingRequests.length} pending requests for shortages...`);

        let countWithShortages = 0;
        let newSuggestions = 0;

        for (const request of pendingRequests) {
            const hasShortage = checkPotentialShortageForRequest(request, requestsList, allocationData);

            if (hasShortage) {
                countWithShortages++;
                console.log(`⚠️ Shortage detected for request #${request.id} (${request.farmer_name})`);

                // Auto-fetch if not already loaded
                if (!alternatives[request.id]) {
                    try {
                        setLoadingAlternatives(prev => ({ ...prev, [request.id]: true }));

                        console.log(`Fetching alternatives for request #${request.id}...`);
                        // Note: suggest-alternatives endpoint is not available in Supabase, returning empty alternatives
                        const response = { data: { suggestions: { suggestions: [] } }, error: null };

                        console.log(`📡 API Response: using empty alternatives (endpoint not in Supabase)`);

                        if (!response.error) {
                            const data = response.data;
                            console.log(`✅ Alternatives received for request #${request.id}:`, data);
                            setAlternatives(prev => ({ ...prev, [request.id]: data }));
                            setShowAlternatives(prev => ({ ...prev, [request.id]: true }));
                            newSuggestions++;
                        } else {
                            console.error(`❌ API Error for request #${request.id}:`, response.error);
                        }
                    } catch (error) {
                        console.error(`❌ Failed to auto-fetch alternatives for request ${request.id}:`, error);
                    } finally {
                        setLoadingAlternatives(prev => ({ ...prev, [request.id]: false }));
                    }

                    // Small delay between requests to avoid overloading
                    await new Promise(resolve => setTimeout(resolve, 200));
                } else {
                    console.log(`ℹ️ Alternatives already loaded for request #${request.id}`);
                }
            }
        }

        console.log(`📈 Summary: ${countWithShortages} requests with shortages, ${newSuggestions} new alternatives fetched`);
        setAutoSuggestionsCount(countWithShortages);
        setNewSuggestionsCount(newSuggestions);
    };

    const filterRequests = () => {
        let filtered = [...requests];

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(req =>
                req.farmer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                req.barangay.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(req => req.status === statusFilter);
        }

        // Barangay filter
        if (barangayFilter !== 'all') {
            filtered = filtered.filter(req => req.barangay === barangayFilter);
        }

        setFilteredRequests(filtered);
    };

    const handleDelete = async (id: number, farmerName: string) => {
        if (!confirm(`Are you sure you want to delete the request from ${farmerName}?`)) {
            return;
        }

        try {
            const response = await deleteFarmerRequest(id);

            if (!response.error) {
                alert('✅ Request deleted successfully');
                fetchRequests();
            } else {
                alert('❌ Failed to delete request');
            }
        } catch (error) {
            console.error('Error deleting request:', error);
            alert('❌ Error deleting request');
        }
    };

    const handleStatusChange = async (id: number, newStatus: string) => {
        try {
            const response = await updateFarmerRequest(id, { status: newStatus });

            if (!response.error) {
                // If status is rejected, hide alternatives panel
                if (newStatus === 'rejected') {
                    setShowAlternatives(prev => ({ ...prev, [id]: false }));
                    setAlternatives(prev => {
                        const updated = { ...prev };
                        delete updated[id];
                        return updated;
                    });
                }
                // If status is approved, automatically create distribution log
                if (newStatus === 'approved') {
                    await createDistributionLog(id);
                }
                alert(`✅ Status updated to ${newStatus}`);
                fetchRequests();
            } else {
                alert('❌ Failed to update status');
            }
        } catch (error) {
            console.error('Error updating status:', error);
            alert('❌ Error updating status');
        }
    };

    // Automatically create distribution log when request is approved
    const createDistributionLog = async (requestId: number) => {
        try {
            // Find the request details
            const request = requests.find(r => r.id === requestId);
            if (!request) return;

            // Build fertilizer and seed type strings
            const fertilizerTypes: string[] = [];
            if (request.requested_urea_bags) fertilizerTypes.push(`Urea:${request.requested_urea_bags}`);
            if (request.requested_complete_14_bags) fertilizerTypes.push(`Complete:${request.requested_complete_14_bags}`);
            if (request.requested_ammonium_sulfate_bags) fertilizerTypes.push(`Ammonium Sulfate:${request.requested_ammonium_sulfate_bags}`);
            if (request.requested_muriate_potash_bags) fertilizerTypes.push(`Muriate Potash:${request.requested_muriate_potash_bags}`);

            const seedTypes: string[] = [];
            if (request.requested_jackpot_kg) seedTypes.push(`Jackpot:${request.requested_jackpot_kg}`);
            if (request.requested_us88_kg) seedTypes.push(`US88:${request.requested_us88_kg}`);
            if (request.requested_th82_kg) seedTypes.push(`TH82:${request.requested_th82_kg}`);
            if (request.requested_rh9000_kg) seedTypes.push(`RH9000:${request.requested_rh9000_kg}`);
            if (request.requested_lumping143_kg) seedTypes.push(`Lumping143:${request.requested_lumping143_kg}`);
            if (request.requested_lp296_kg) seedTypes.push(`LP296:${request.requested_lp296_kg}`);

            // Calculate totals
            const totalFertilizer = Math.round(
                (Number(request.requested_urea_bags) || 0) +
                (Number(request.requested_complete_14_bags) || 0) +
                (Number(request.requested_ammonium_sulfate_bags) || 0) +
                (Number(request.requested_muriate_potash_bags) || 0)
            );

            const totalSeeds = Number(
                ((Number(request.requested_jackpot_kg) || 0) +
                    (Number(request.requested_us88_kg) || 0) +
                    (Number(request.requested_th82_kg) || 0) +
                    (Number(request.requested_rh9000_kg) || 0) +
                    (Number(request.requested_lumping143_kg) || 0) +
                    (Number(request.requested_lp296_kg) || 0)).toFixed(2)
            );

            const payload = {
                request_id: requestId,
                fertilizer_type: fertilizerTypes.join(', ') || null,
                fertilizer_bags_given: totalFertilizer,
                seed_type: seedTypes.join(', ') || null,
                seed_kg_given: totalSeeds,
                voucher_code: null,
                farmer_signature: false,
                verified_by: null
            };

            const distResponse = await createDistributionRecord(payload);

            if (!distResponse.error) {
                console.log('✅ Distribution log created automatically');
            } else {
                console.error('❌ Failed to create distribution log');
            }
        } catch (error) {
            console.error('Error creating distribution log:', error);
        }
    };

    // DSS Feature: Fetch smart alternatives for a farmer request
    const fetchAlternatives = async (requestId: number) => {
        try {
            setLoadingAlternatives(prev => ({ ...prev, [requestId]: true }));

            console.log('Fetching alternatives for request:', requestId);

            // Note: suggest-alternatives endpoint is not available in Supabase, returning empty alternatives
            const response = { data: { suggestions: { suggestions: [] } }, error: null };

            console.log('Response: using empty alternatives (endpoint not in Supabase)');

            if (!response.error) {
                const data = response.data;
                console.log('✅ Alternatives data:', data);
                setAlternatives(prev => ({ ...prev, [requestId]: data }));
                setShowAlternatives(prev => ({ ...prev, [requestId]: true }));
            } else {
                console.error('❌ Server error:', response.error);
                alert(`❌ Failed to fetch alternatives: suggest-alternatives endpoint not available in Supabase`);
            }
        } catch (error) {
            console.error('❌ Error fetching alternatives:', error);
            alert(`❌ Error fetching alternatives: ${error instanceof Error ? error.message : 'Network error'}`);
        } finally {
            setLoadingAlternatives(prev => ({ ...prev, [requestId]: false }));
        }
    };

    // Apply selected alternative to farmer request
    const applyAlternative = async (requestId: number) => {
        const selection = selectedAlternative[requestId];
        if (!selection) {
            alert('❌ Please select an alternative from the dropdown first');
            return;
        }

        const altData = alternatives[requestId];
        if (!altData || !altData.suggestions?.suggestions) {
            alert('❌ Alternative data not found');
            return;
        }

        const suggestion = altData.suggestions.suggestions[selection.suggestionIdx];
        const alternative = suggestion.alternatives[selection.alternativeIdx];

        if (!alternative) {
            alert('❌ Selected alternative not found');
            return;
        }

        // Show warning for partial substitutions
        if (!alternative.can_fulfill) {
            const confirmed = confirm(
                `⚠️ WARNING: Partial Substitution\n\n` +
                `This alternative can only partially cover the shortage:\n` +
                `- Original shortage: ${suggestion.shortage_bags} bags\n` +
                `- Can cover: ${alternative.partial_coverage || 0} bags\n` +
                `- Remaining shortage: ${alternative.remaining_shortage || 0} bags\n\n` +
                `Do you want to continue with this partial substitution?`
            );
            if (!confirmed) return;
        }

        // Build confirmation message
        const originalFert = suggestion.original_fertilizer_name;
        const substituteFert = alternative.substitute_name;
        const confidence = (alternative.confidence_score * 100).toFixed(0);

        const confirmMessage =
            `📝 Confirm Fertilizer Substitution\n\n` +
            `Farmer: ${altData.farmer_name}\n\n` +
            `REPLACE:\n` +
            `❌ ${suggestion.original_fertilizer}: ${suggestion.shortage_bags} bags (shortage)\n\n` +
            `WITH:\n` +
            `✅ ${substituteFert}: ${alternative.needed_bags} bags\n\n` +
            `Confidence: ${confidence}%\n` +
            `Available Stock: ${alternative.available_bags} bags\n\n` +
            `${alternative.can_fulfill ? '✅ Full substitution possible' : '⚠️ Partial substitution'}\n\n` +
            `This will update the farmer's request and add a note.\n` +
            `Status will remain PENDING for your final review.\n\n` +
            `Apply this alternative?`;

        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            setApplyingAlternative(prev => ({ ...prev, [requestId]: true }));

            const request = requests.find(r => r.id === requestId);
            if (!request) {
                throw new Error('Request not found');
            }

            // Prepare updated request data
            const updatedRequest: any = { ...request };

            // Map original fertilizer type to field name
            const fieldMapping: { [key: string]: string } = {
                'urea_46_0_0': 'requested_urea_bags',
                'complete_14_14_14': 'requested_complete_14_bags',
                'ammonium_sulfate_21_0_0': 'requested_ammonium_sulfate_bags',
                'muriate_potash_0_0_60': 'requested_muriate_potash_bags'
            };

            const substituteMapping: { [key: string]: string } = {
                'urea_46_0_0': 'requested_urea_bags',
                'complete_14_14_14': 'requested_complete_14_bags',
                'complete_16_16_16': 'requested_complete_14_bags', // Map to closest field
                'ammonium_sulfate_21_0_0': 'requested_ammonium_sulfate_bags',
                'muriate_potash_0_0_60': 'requested_muriate_potash_bags'
            };

            const originalField = fieldMapping[suggestion.original_fertilizer];
            const substituteField = substituteMapping[alternative.substitute_id];

            if (!originalField || !substituteField) {
                throw new Error('Invalid fertilizer field mapping');
            }

            // Update quantities
            const currentOriginalAmount = updatedRequest[originalField] || 0;
            const newOriginalAmount = Math.max(0, currentOriginalAmount - suggestion.shortage_bags);
            updatedRequest[originalField] = newOriginalAmount;

            // Add substitute amount
            const currentSubstituteAmount = updatedRequest[substituteField] || 0;
            updatedRequest[substituteField] = currentSubstituteAmount + alternative.needed_bags;

            // Add note about substitution
            const timestamp = new Date().toLocaleString();
            const substitutionNote =
                `[${timestamp}] SUBSTITUTION APPLIED: ` +
                `Replaced ${suggestion.shortage_bags} bags ${originalFert} with ` +
                `${alternative.needed_bags} bags ${substituteFert} ` +
                `(${confidence}% confidence). ` +
                `${alternative.can_fulfill ? 'Full substitution.' : `Partial: ${alternative.remaining_shortage} bags shortage remains.`}`;

            updatedRequest.request_notes = request.request_notes
                ? `${request.request_notes}\n\n${substitutionNote}`
                : substitutionNote;

            // Send update to backend
            const response = await updateFarmerRequest(requestId, updatedRequest);

            if (!response.error) {
                alert('✅ Alternative applied successfully!\n\nRequest updated. Status remains PENDING for your review.');
                // Refresh requests and close alternatives panel
                await fetchRequests();
                setShowAlternatives(prev => ({ ...prev, [requestId]: false }));
                setSelectedAlternative(prev => {
                    const newState = { ...prev };
                    delete newState[requestId];
                    return newState;
                });
            } else {
                throw new Error(response.error || 'Failed to update request');
            }
        } catch (error) {
            console.error('Error applying alternative:', error);
            alert(`❌ Error applying alternative: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setApplyingAlternative(prev => ({ ...prev, [requestId]: false }));
        }
    };

    const getUniqueBarangays = () => {
        const barangays = [...new Set(requests.map(req => req.barangay))];
        return barangays.sort();
    };

    // Edit request functionality
    const handleEdit = (request: FarmerRequest) => {
        setEditingRequest(request.id);
        // COMMENT: Using request_notes instead of notes (notes column doesn't exist in DB)
        setEditFormData({
            requested_urea_bags: request.requested_urea_bags,
            requested_complete_14_bags: request.requested_complete_14_bags,
            requested_ammonium_sulfate_bags: request.requested_ammonium_sulfate_bags,
            requested_muriate_potash_bags: request.requested_muriate_potash_bags,
            requested_jackpot_kg: request.requested_jackpot_kg,
            requested_us88_kg: request.requested_us88_kg,
            requested_th82_kg: request.requested_th82_kg,
            requested_rh9000_kg: request.requested_rh9000_kg,
            requested_lumping143_kg: request.requested_lumping143_kg,
            requested_lp296_kg: request.requested_lp296_kg,
            request_notes: request.request_notes || ''
        });
    };

    const handleSaveEdit = async () => {
        if (!editingRequest) return;

        try {
            // FIX: Get the full original request and merge with edited data
            // This ensures all required fields are sent to the backend
            const originalRequest = requests.find(r => r.id === editingRequest);
            if (!originalRequest) {
                throw new Error('Original request not found');
            }

            // Merge original request with edited form data
            const updatedRequest = {
                ...originalRequest,  // Keep all original fields (farmer_id, season, etc.)
                ...editFormData      // Override with edited values
            };

            // FIX: Changed endpoint from /farmer-requests/ to /requests/ to match backend API
            const response = await updateFarmerRequest(editingRequest, updatedRequest);

            if (response.error) {
                throw new Error('Failed to update request');
            }

            // Refresh requests list to show updated data
            await fetchRequests();

            // Close edit modal
            setEditingRequest(null);
            setEditFormData({});

            alert('✅ Request updated successfully!');
        } catch (err) {
            console.error('Error updating request:', err);
            alert(`❌ Failed to update request: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    };

    const handleCancelEdit = () => {
        setEditingRequest(null);
        setEditFormData({});
    };

    const getTotalRequested = (field: keyof FarmerRequest) => {
        return filteredRequests.reduce((sum, req) => sum + (Number(req[field]) || 0), 0);
    };

    const formatSeasonName = (season: string) => {
        const [type, year] = season.split('_');
        return `${type.charAt(0).toUpperCase() + type.slice(1)} Season ${year}`;
    };

    // Helper function to check if a request might have stock issues
    const checkPotentialShortage = (request: FarmerRequest): boolean => {
        return checkPotentialShortageForRequest(request, requests);
    };

    const checkPotentialShortageForRequest = (request: FarmerRequest, requestsList: FarmerRequest[], allocationData?: AllocationDetails): boolean => {
        const allocToUse = allocationData || allocation;
        if (!allocToUse) return false;

        // === FERTILIZER SHORTAGES ===
        // Calculate total approved AND pending requests so far (excluding current request)
        const approvedUrea = requestsList
            .filter(r => (r.status === 'approved' || r.status === 'pending') && r.id !== request.id)
            .reduce((sum, r) => sum + Number(r.requested_urea_bags || 0), 0);

        const approvedComplete = requestsList
            .filter(r => (r.status === 'approved' || r.status === 'pending') && r.id !== request.id)
            .reduce((sum, r) => sum + Number(r.requested_complete_14_bags || 0), 0);

        const approvedAmSul = requestsList
            .filter(r => (r.status === 'approved' || r.status === 'pending') && r.id !== request.id)
            .reduce((sum, r) => sum + Number(r.requested_ammonium_sulfate_bags || 0), 0);

        const approvedPotash = requestsList
            .filter(r => (r.status === 'approved' || r.status === 'pending') && r.id !== request.id)
            .reduce((sum, r) => sum + Number(r.requested_muriate_potash_bags || 0), 0);

        // Check if current request would exceed remaining stock
        const remainingUrea = Number(allocToUse.urea_46_0_0_bags || 0) - approvedUrea;
        const remainingComplete = Number(allocToUse.complete_14_14_14_bags || 0) - approvedComplete;
        const remainingAmSul = Number(allocToUse.ammonium_sulfate_21_0_0_bags || 0) - approvedAmSul;
        const remainingPotash = Number(allocToUse.muriate_potash_0_0_60_bags || 0) - approvedPotash;

        const requestedUrea = Number(request.requested_urea_bags || 0);
        const requestedComplete = Number(request.requested_complete_14_bags || 0);
        const requestedAmSul = Number(request.requested_ammonium_sulfate_bags || 0);
        const requestedPotash = Number(request.requested_muriate_potash_bags || 0);

        const fertilizerShortage = (requestedUrea > remainingUrea) ||
            (requestedComplete > remainingComplete) ||
            (requestedAmSul > remainingAmSul) ||
            (requestedPotash > remainingPotash);

        // === SEED SHORTAGES ===
        const approvedJackpot = requestsList
            .filter(r => (r.status === 'approved' || r.status === 'pending') && r.id !== request.id)
            .reduce((sum, r) => sum + Number(r.requested_jackpot_kg || 0), 0);

        const approvedUs88 = requestsList
            .filter(r => (r.status === 'approved' || r.status === 'pending') && r.id !== request.id)
            .reduce((sum, r) => sum + Number(r.requested_us88_kg || 0), 0);

        const approvedTh82 = requestsList
            .filter(r => (r.status === 'approved' || r.status === 'pending') && r.id !== request.id)
            .reduce((sum, r) => sum + Number(r.requested_th82_kg || 0), 0);

        const approvedRh9000 = requestsList
            .filter(r => (r.status === 'approved' || r.status === 'pending') && r.id !== request.id)
            .reduce((sum, r) => sum + Number(r.requested_rh9000_kg || 0), 0);

        const approvedLumping143 = requestsList
            .filter(r => (r.status === 'approved' || r.status === 'pending') && r.id !== request.id)
            .reduce((sum, r) => sum + Number(r.requested_lumping143_kg || 0), 0);

        const approvedLp296 = requestsList
            .filter(r => (r.status === 'approved' || r.status === 'pending') && r.id !== request.id)
            .reduce((sum, r) => sum + Number(r.requested_lp296_kg || 0), 0);

        const remainingJackpot = Number(allocToUse.jackpot_kg || 0) - approvedJackpot;
        const remainingUs88 = Number(allocToUse.us88_kg || 0) - approvedUs88;
        const remainingTh82 = Number(allocToUse.th82_kg || 0) - approvedTh82;
        const remainingRh9000 = Number(allocToUse.rh9000_kg || 0) - approvedRh9000;
        const remainingLumping143 = Number(allocToUse.lumping143_kg || 0) - approvedLumping143;
        const remainingLp296 = Number(allocToUse.lp296_kg || 0) - approvedLp296;

        const requestedJackpot = Number(request.requested_jackpot_kg || 0);
        const requestedUs88 = Number(request.requested_us88_kg || 0);
        const requestedTh82 = Number(request.requested_th82_kg || 0);
        const requestedRh9000 = Number(request.requested_rh9000_kg || 0);
        const requestedLumping143 = Number(request.requested_lumping143_kg || 0);
        const requestedLp296 = Number(request.requested_lp296_kg || 0);

        const seedShortage = (requestedJackpot > remainingJackpot) ||
            (requestedUs88 > remainingUs88) ||
            (requestedTh82 > remainingTh82) ||
            (requestedRh9000 > remainingRh9000) ||
            (requestedLumping143 > remainingLumping143) ||
            (requestedLp296 > remainingLp296);

        // Debug logging
        if (request.status === 'pending') {
            console.log(`🔍 Shortage Check for ${request.farmer_name}:`, {
                fertilizers: {
                    urea: { requested: requestedUrea, remaining: remainingUrea, shortage: requestedUrea > remainingUrea },
                    complete: { requested: requestedComplete, remaining: remainingComplete, shortage: requestedComplete > remainingComplete },
                    amSul: { requested: requestedAmSul, remaining: remainingAmSul, shortage: requestedAmSul > remainingAmSul },
                    potash: { requested: requestedPotash, remaining: remainingPotash, shortage: requestedPotash > remainingPotash }
                },
                seeds: {
                    jackpot: { requested: requestedJackpot, remaining: remainingJackpot, shortage: requestedJackpot > remainingJackpot },
                    us88: { requested: requestedUs88, remaining: remainingUs88, shortage: requestedUs88 > remainingUs88 },
                    th82: { requested: requestedTh82, remaining: remainingTh82, shortage: requestedTh82 > remainingTh82 },
                    rh9000: { requested: requestedRh9000, remaining: remainingRh9000, shortage: requestedRh9000 > remainingRh9000 },
                    lumping143: { requested: requestedLumping143, remaining: remainingLumping143, shortage: requestedLumping143 > remainingLumping143 },
                    lp296: { requested: requestedLp296, remaining: remainingLp296, shortage: requestedLp296 > remainingLp296 }
                }
            });
        }

        // Return true if any fertilizer OR seed shortage exists
        return fertilizerShortage || seedShortage;
    };

    return (
        <div className="page-container">
            <div className="page">
                {/* Sidebar */}
                <div className="sidebar">
                    <nav className="sidebar-nav">
                        <div className='sidebar-logo'>
                            <img src={LogoImage} alt="Logo" />
                        </div>

                        <button
                            className={`sidebar-nav-item ${isActive('/jo-dashboard') ? 'active' : ''}`}
                            onClick={() => navigate('/jo-dashboard')}
                        >
                            <span className="nav-icon">
                                <img src={HomeIcon} alt="Home" />
                            </span>
                            <span className="nav-text">Home</span>
                        </button>

                        <button
                            className={`sidebar-nav-item ${isActive('/jo-rsbsapage') ? 'active' : ''}`}
                            onClick={() => navigate('/jo-rsbsapage')}
                        >
                            <span className="nav-icon">
                                <img src={RSBSAIcon} alt="RSBSA" />
                            </span>
                            <span className="nav-text">RSBSA</span>
                        </button>

                        <button
                            className={`sidebar-nav-item ${isActive('/jo-incentives') ? 'active' : ''}`}
                            onClick={() => navigate('/jo-incentives')}
                        >
                            <span className="nav-icon">
                                <img src={IncentivesIcon} alt="Incentives" />
                            </span>
                            <span className="nav-text">Incentives</span>
                        </button>

                        <button
                            className={`sidebar-nav-item ${isActive('/jo-masterlist') ? 'active' : ''}`}
                            onClick={() => navigate('/jo-masterlist')}
                        >
                            <span className="nav-icon">
                                <img src={MasterlistIcon} alt="Masterlist" />
                            </span>
                            <span className="nav-text">Masterlist</span>
                        </button>

                        <div
                            className={`sidebar-nav-item ${isActive('/jo-gap-analysis') ? 'active' : ''}`}
                            onClick={() => navigate('/jo-gap-analysis')}
                        >
                            <div className="nav-icon">📊</div>
                            <span className="nav-text">Gap Analysis</span>
                        </div>

                        <div
                            className={`sidebar-nav-item ${isActive('/jo-distribution') ? 'active' : ''}`}
                            onClick={() => navigate('/jo-distribution')}
                        >
                            <div className="nav-icon">🚚</div>
                            <span className="nav-text">Distribution Log</span>
                        </div>

                        <button
                            className="sidebar-nav-item logout"
                            onClick={() => navigate('/')}
                        >
                            <span className="nav-icon">
                                <img src={LogoutIcon} alt="Logout" />
                            </span>
                            <span className="nav-text">Logout</span>
                        </button>

                    </nav>
                </div>

                {/* Main Content */}
                <div className="main-content">
                    <div className="jo-manage-dashboard-header-incent">
                        <div>
                            <h2 className="jo-manage-page-header">Manage Farmer Requests</h2>
                        </div>
                        <div className="jo-manage-requests-back-create-section">
                            <button
                                className="jo-manage-requests-back-btn"
                                onClick={() => navigate('/jo-incentives')}
                            >
                                ←
                            </button>
                            <button
                                className="jo-manage-requests-add-btn"
                                onClick={() => navigate(`/jo-add-farmer-request/${allocationId}`)}
                            >
                                ➕ Add Farmer Request
                            </button>
                        </div>
                    </div>

                    <div className="jo-manage-content-card-incent">
                        {/* Filters */}
                        <div className="jo-manage-requests-filters">
                            <input
                                type="text"
                                placeholder="🔍 Search by farmer name or barangay..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="jo-manage-requests-search-input"
                            />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="jo-manage-requests-filter-select"
                            >
                                <option value="all">All Status</option>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                            </select>
                            <select
                                value={barangayFilter}
                                onChange={(e) => setBarangayFilter(e.target.value)}
                                className="jo-manage-requests-filter-select"
                            >
                                <option value="all">All Barangays</option>
                                {getUniqueBarangays().map(barangay => (
                                    <option key={barangay} value={barangay}>{barangay}</option>
                                ))}
                            </select>
                        </div>

                        {/* Allocation vs Requests Comparison */}
                        <div className="jo-manage-requests-comparison-grid">
                            {/* Regional Allocation Card */}
                            <div className="jo-manage-requests-allocation-card">
                                <h3 className="jo-manage-requests-card-header allocation">
                                    📦 Regional Allocation (Total Received)
                                </h3>
                                <div className="jo-manage-requests-card-content">
                                    <div className="jo-manage-requests-stat-box fertilizers">
                                        <span className="jo-manage-requests-stat-label fertilizers">🌱 Total Fertilizers</span>
                                        <span className="jo-manage-requests-stat-value fertilizers">
                                            {allocation ? (
                                                (Number(allocation.urea_46_0_0_bags || 0) +
                                                    Number(allocation.complete_14_14_14_bags || 0) +
                                                    Number(allocation.ammonium_sulfate_21_0_0_bags || 0) +
                                                    Number(allocation.muriate_potash_0_0_60_bags || 0)).toFixed(2)
                                            ) : '0.00'} bags
                                        </span>
                                    </div>
                                    <div className="jo-manage-requests-stat-box seeds">
                                        <span className="jo-manage-requests-stat-label seeds">🌾 Total Seeds</span>
                                        <span className="jo-manage-requests-stat-value seeds">
                                            {allocation ? (
                                                (Number(allocation.jackpot_kg || 0) +
                                                    Number(allocation.us88_kg || 0) +
                                                    Number(allocation.th82_kg || 0) +
                                                    Number(allocation.rh9000_kg || 0) +
                                                    Number(allocation.lumping143_kg || 0) +
                                                    Number(allocation.lp296_kg || 0)).toFixed(2)
                                            ) : '0.00'} kg
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Total Farmer Requests Card */}
                            <div className="jo-manage-requests-farmer-requests-card">
                                <h3 className="jo-manage-requests-card-header total-requests">
                                    📊 Total Farmer Requests
                                </h3>
                                <div className="jo-manage-requests-card-content">
                                    <div className="jo-manage-requests-stat-box fertilizers">
                                        <span className="jo-manage-requests-stat-label fertilizers">🌱 Total Fertilizers Requested</span>
                                        <span className="jo-manage-requests-stat-value fertilizers">
                                            {getTotalRequested('requested_urea_bags') +
                                                getTotalRequested('requested_complete_14_bags') +
                                                getTotalRequested('requested_ammonium_sulfate_bags') +
                                                getTotalRequested('requested_muriate_potash_bags')} bags
                                        </span>
                                    </div>
                                    <div className="jo-manage-requests-stat-box seeds">
                                        <span className="jo-manage-requests-stat-label seeds">🌾 Total Seeds Requested</span>
                                        <span className="jo-manage-requests-stat-value seeds">
                                            {getTotalRequested('requested_jackpot_kg') +
                                                getTotalRequested('requested_us88_kg') +
                                                getTotalRequested('requested_th82_kg') +
                                                getTotalRequested('requested_rh9000_kg') +
                                                getTotalRequested('requested_lumping143_kg') +
                                                getTotalRequested('requested_lp296_kg')} kg
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Approved Farmer Requests Card */}
                            <div className="jo-manage-requests-farmer-requests-card approved">
                                <h3 className="jo-manage-requests-card-header farmer-requests">
                                    ✅ Approved Farmer Requests
                                </h3>
                                <div className="jo-manage-requests-card-content">
                                    <div className="jo-manage-requests-stat-box fertilizers">
                                        <span className="jo-manage-requests-stat-label fertilizers">🌱 Total Fertilizers</span>
                                        <span className="jo-manage-requests-stat-value fertilizers">
                                            {(() => {
                                                const approvedRequests = requests.filter(r => r.status === 'approved');
                                                const total = approvedRequests.reduce((sum, r) =>
                                                    sum + Number(r.requested_urea_bags || 0) +
                                                    Number(r.requested_complete_14_bags || 0) +
                                                    Number(r.requested_ammonium_sulfate_bags || 0) +
                                                    Number(r.requested_muriate_potash_bags || 0), 0
                                                );
                                                return Number(total).toFixed(2);
                                            })()} bags
                                        </span>
                                    </div>
                                    <div className="jo-manage-requests-stat-box seeds">
                                        <span className="jo-manage-requests-stat-label seeds">🌾 Total Seeds</span>
                                        <span className="jo-manage-requests-stat-value seeds">
                                            {(() => {
                                                const approvedRequests = requests.filter(r => r.status === 'approved');
                                                const total = approvedRequests.reduce((sum, r) =>
                                                    sum + Number(r.requested_jackpot_kg || 0) +
                                                    Number(r.requested_us88_kg || 0) +
                                                    Number(r.requested_th82_kg || 0) +
                                                    Number(r.requested_rh9000_kg || 0) +
                                                    Number(r.requested_lumping143_kg || 0) +
                                                    Number(r.requested_lp296_kg || 0), 0
                                                );
                                                return Number(total).toFixed(2);
                                            })()} kg
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Rejected Farmer Requests Card */}
                            <div className="jo-manage-requests-farmer-requests-card rejected">
                                <h3 className="jo-manage-requests-card-header farmer-requests-rejected">
                                    ❌ Rejected Farmer Requests
                                </h3>
                                <div className="jo-manage-requests-card-content">
                                    <div className="jo-manage-requests-stat-box fertilizers">
                                        <span className="jo-manage-requests-stat-label fertilizers">🌱 Total Fertilizers</span>
                                        <span className="jo-manage-requests-stat-value fertilizers">
                                            {(() => {
                                                const rejectedRequests = requests.filter(r => r.status === 'rejected');
                                                const total = rejectedRequests.reduce((sum, r) =>
                                                    sum + Number(r.requested_urea_bags || 0) +
                                                    Number(r.requested_complete_14_bags || 0) +
                                                    Number(r.requested_ammonium_sulfate_bags || 0) +
                                                    Number(r.requested_muriate_potash_bags || 0), 0
                                                );
                                                return Number(total).toFixed(2);
                                            })()} bags
                                        </span>
                                    </div>
                                    <div className="jo-manage-requests-stat-box seeds">
                                        <span className="jo-manage-requests-stat-label seeds">🌾 Total Seeds</span>
                                        <span className="jo-manage-requests-stat-value seeds">
                                            {(() => {
                                                const rejectedRequests = requests.filter(r => r.status === 'rejected');
                                                const total = rejectedRequests.reduce((sum, r) =>
                                                    sum + Number(r.requested_jackpot_kg || 0) +
                                                    Number(r.requested_us88_kg || 0) +
                                                    Number(r.requested_th82_kg || 0) +
                                                    Number(r.requested_rh9000_kg || 0) +
                                                    Number(r.requested_lumping143_kg || 0) +
                                                    Number(r.requested_lp296_kg || 0), 0
                                                );
                                                return Number(total).toFixed(2);
                                            })()} kg
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Summary Cards */}
                        <div className="jo-manage-requests-summary-grid">
                            <div className="jo-manage-requests-summary-card total">
                                <div className="jo-manage-requests-summary-label">Total Requests</div>
                                <div className="jo-manage-requests-summary-value">{filteredRequests.length}</div>
                            </div>
                            <div className="jo-manage-requests-summary-card pending">
                                <div className="jo-manage-requests-summary-label pending">Pending</div>
                                <div className="jo-manage-requests-summary-value pending">
                                    {filteredRequests.filter(r => r.status === 'pending').length}
                                </div>
                            </div>
                            <div className="jo-manage-requests-summary-card approved">
                                <div className="jo-manage-requests-summary-label approved">Approved</div>
                                <div className="jo-manage-requests-summary-value approved">
                                    {filteredRequests.filter(r => r.status === 'approved').length}
                                </div>
                            </div>
                            <div className="jo-manage-requests-summary-card rejected">
                                <div className="jo-manage-requests-summary-label rejected">Rejected</div>
                                <div className="jo-manage-requests-summary-value rejected">
                                    {filteredRequests.filter(r => r.status === 'rejected').length}
                                </div>
                            </div>
                            {/* Combined Shortage & Suggestions Card */}
                            <div
                                className="jo-manage-requests-summary-card shortage"
                                onClick={() => setShowSuggestionsModal(true)}
                                style={{ cursor: 'pointer' }}
                            >
                                {newSuggestionsCount > 0 && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '-8px',
                                        right: '-8px',
                                        background: '#ef4444',
                                        color: 'white',
                                        borderRadius: '50%',
                                        width: '24px',
                                        height: '24px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        border: '2px solid white',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                        animation: 'pulse 2s infinite'
                                    }}>
                                        {newSuggestionsCount}
                                    </div>
                                )}
                                <div style={{ fontSize: '14px', color: '#92400e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    ⚠️ Shortages & Suggestions
                                </div>
                                <div style={{ fontSize: '24px', fontWeight: '600', color: '#92400e' }}>
                                    {autoSuggestionsCount} / {Object.keys(alternatives).filter(key => {
                                        const alt = alternatives[parseInt(key)];
                                        return alt?.suggestions?.suggestions?.length > 0;
                                    }).length}
                                </div>
                                <div style={{ fontSize: '11px', color: '#78350f', marginTop: '4px' }}>
                                    {autoSuggestionsCount} shortages, {Object.keys(alternatives).filter(key => {
                                        const alt = alternatives[parseInt(key)];
                                        return alt?.suggestions?.suggestions?.length > 0;
                                    }).length} with solutions • Click to view
                                </div>
                            </div>
                        </div>

                        {loading ? (
                            <div className="loading-message">Loading requests...</div>
                        ) : error ? (
                            <div className="error-state">
                                <div className="error-icon">⚠️</div>
                                <h3>Error Loading Requests</h3>
                                <p>{error}</p>
                            </div>
                        ) : filteredRequests.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">📝</div>
                                <h3>No Farmer Requests</h3>
                                <p>No requests found matching your filters</p>
                            </div>
                        ) : (
                            <>
                                {/* Info Box for Visual Indicators */}
                                {filteredRequests.filter(r => r.status === 'pending' && checkPotentialShortage(r)).length > 0 && (
                                    <div className="jo-manage-requests-info-box">
                                        <span style={{ fontSize: '24px' }}>💡</span>
                                        <div style={{ flex: 1 }}>
                                            <strong style={{ color: '#92400e', fontSize: '14px' }}>
                                                Alternatives Auto-Loaded & Available
                                            </strong>
                                            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#78350f' }}>
                                                Rows highlighted in yellow (⚠️) have detected shortages.
                                                Alternative fertilizer options have been automatically loaded based on agronomic equivalency.
                                                Click the "💡 Suggestions" card above to view and apply alternatives.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="jo-manage-requests-table-container">
                                    <table style={{
                                        width: '100%',
                                        borderCollapse: 'collapse',
                                        fontSize: '14px'
                                    }}>
                                        <thead>
                                            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                                                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Farmer Name</th>
                                                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Barangay</th>
                                                <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Fertilizers (bags)</th>
                                                <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Seeds (kg)</th>
                                                <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Status</th>
                                                <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredRequests.map(request => {
                                                const totalFertilizer = Number(request.requested_urea_bags || 0) +
                                                    Number(request.requested_complete_14_bags || 0) +
                                                    Number(request.requested_ammonium_sulfate_bags || 0) +
                                                    Number(request.requested_muriate_potash_bags || 0);

                                                const totalSeeds = Number(request.requested_jackpot_kg || 0) +
                                                    Number(request.requested_us88_kg || 0) +
                                                    Number(request.requested_th82_kg || 0) +
                                                    Number(request.requested_rh9000_kg || 0) +
                                                    Number(request.requested_lumping143_kg || 0) +
                                                    Number(request.requested_lp296_kg || 0);

                                                // Check if this request might have shortages
                                                const hasShortage = request.status === 'pending' && checkPotentialShortage(request);

                                                return (
                                                    <React.Fragment key={request.id}>
                                                        <tr style={{
                                                            borderBottom: '1px solid #e5e7eb',
                                                            background: hasShortage ? '#fef3c7' : 'transparent'
                                                        }}>
                                                            <td style={{ padding: '12px' }}>
                                                                {hasShortage && (
                                                                    <span
                                                                        title="Potential shortage - alternatives auto-loaded"
                                                                        style={{
                                                                            marginRight: '8px',
                                                                            fontSize: '16px'
                                                                        }}
                                                                    >

                                                                    </span>
                                                                )}
                                                                {hasShortage && alternatives[request.id] && (
                                                                    <span
                                                                        title="Alternatives ready - click to view"
                                                                    >

                                                                    </span>
                                                                )}
                                                                {request.farmer_name}
                                                            </td>
                                                            <td style={{ padding: '12px' }}>{request.barangay}</td>
                                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                                {totalFertilizer.toFixed(2)}
                                                                {hasShortage && (
                                                                    <span
                                                                        title="Alternatives auto-displayed below"
                                                                    >

                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td style={{ padding: '12px', textAlign: 'center' }}>{totalSeeds.toFixed(2)}</td>
                                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                                <span style={{
                                                                    padding: '4px 12px',
                                                                    borderRadius: '12px',
                                                                    fontSize: '12px',
                                                                    fontWeight: '600',
                                                                    background: request.status === 'pending' ? '#fef3c7' :
                                                                        request.status === 'approved' ? '#d1fae5' : '#fee2e2',
                                                                    color: request.status === 'pending' ? '#92400e' :
                                                                        request.status === 'approved' ? '#065f46' : '#991b1b'
                                                                }}>
                                                                    {request.status.toUpperCase()}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                                                    {request.status === 'pending' && (
                                                                        <>
                                                                            <button
                                                                                onClick={() => handleStatusChange(request.id, 'approved')}
                                                                                style={{
                                                                                    padding: '6px 12px',
                                                                                    background: '#10b981',
                                                                                    color: 'white',
                                                                                    border: 'none',
                                                                                    borderRadius: '4px',
                                                                                    cursor: 'pointer',
                                                                                    fontSize: '12px'
                                                                                }}
                                                                            >
                                                                                ✓ Approve
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleEdit(request)}
                                                                                style={{
                                                                                    padding: '6px 12px',
                                                                                    background: '#f59e0b',
                                                                                    color: 'white',
                                                                                    border: 'none',
                                                                                    borderRadius: '4px',
                                                                                    cursor: 'pointer',
                                                                                    fontSize: '12px'
                                                                                }}
                                                                            >
                                                                                ✏️ Edit
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleStatusChange(request.id, 'rejected')}
                                                                                style={{
                                                                                    padding: '6px 12px',
                                                                                    background: '#ef4444',
                                                                                    color: 'white',
                                                                                    border: 'none',
                                                                                    borderRadius: '4px',
                                                                                    cursor: 'pointer',
                                                                                    fontSize: '12px'
                                                                                }}
                                                                            >
                                                                                ✕ Reject
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                    <button
                                                                        onClick={() => handleDelete(request.id, request.farmer_name)}
                                                                        style={{
                                                                            padding: '6px 12px',
                                                                            background: '#6b7280',
                                                                            color: 'white',
                                                                            border: 'none',
                                                                            borderRadius: '4px',
                                                                            cursor: 'pointer',
                                                                            fontSize: '12px'
                                                                        }}
                                                                    >
                                                                        🗑️
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot>
                                            <tr style={{ background: '#f9fafb', borderTop: '2px solid #e5e7eb', fontWeight: '600' }}>
                                                <td colSpan={2} style={{ padding: '12px' }}>TOTALS</td>
                                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                                    {(getTotalRequested('requested_urea_bags') +
                                                        getTotalRequested('requested_complete_14_bags') +
                                                        getTotalRequested('requested_ammonium_sulfate_bags') +
                                                        getTotalRequested('requested_muriate_potash_bags')).toFixed(2)}
                                                </td>
                                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                                    {(getTotalRequested('requested_jackpot_kg') +
                                                        getTotalRequested('requested_us88_kg') +
                                                        getTotalRequested('requested_th82_kg') +
                                                        getTotalRequested('requested_rh9000_kg') +
                                                        getTotalRequested('requested_lumping143_kg') +
                                                        getTotalRequested('requested_lp296_kg')).toFixed(2)}
                                                </td>
                                                <td colSpan={3}></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Edit Request Modal */}
            {editingRequest && (
                <div className="jo-manage-requests-modal-overlay">
                    <div className="jo-manage-requests-modal-content">
                        {/* Modal Header */}
                        <div className="jo-manage-requests-modal-header">
                            <h2>Edit Farmer Request</h2>
                            <button
                                onClick={handleCancelEdit}
                                className="jo-manage-requests-modal-close"
                            >
                                ×
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="jo-manage-requests-modal-body">
                            {/* Fertilizers Section */}
                            <div className="jo-manage-requests-modal-section">
                                <h4 className="jo-manage-requests-modal-section-title">🌱 Fertilizers (bags)</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#6b7280' }}>Urea (46-0-0)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editFormData.requested_urea_bags || 0}
                                            onChange={(e) => setEditFormData({ ...editFormData, requested_urea_bags: Number(e.target.value) })}
                                            style={{
                                                width: '100%',
                                                padding: '8px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '4px',
                                                fontSize: '14px'
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#6b7280' }}>Complete (14-14-14)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editFormData.requested_complete_14_bags || 0}
                                            onChange={(e) => setEditFormData({ ...editFormData, requested_complete_14_bags: Number(e.target.value) })}
                                            style={{
                                                width: '100%',
                                                padding: '8px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '4px',
                                                fontSize: '14px'
                                            }}
                                        />
                                    </div>
                                    <div className="jo-manage-requests-modal-field">
                                        <label>Ammonium Sulfate (21-0-0)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editFormData.requested_ammonium_sulfate_bags || 0}
                                            onChange={(e) => setEditFormData({ ...editFormData, requested_ammonium_sulfate_bags: Number(e.target.value) })}
                                            className="jo-manage-requests-modal-input"
                                        />
                                    </div>
                                    <div className="jo-manage-requests-modal-field">
                                        <label>Muriate of Potash (0-0-60)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editFormData.requested_muriate_potash_bags || 0}
                                            onChange={(e) => setEditFormData({ ...editFormData, requested_muriate_potash_bags: Number(e.target.value) })}
                                            className="jo-manage-requests-modal-input"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Seeds Section */}
                            <div className="jo-manage-requests-modal-section">
                                <h4 className="jo-manage-requests-modal-section-title">🌾 Seeds (kg)</h4>
                                <div className="jo-manage-requests-modal-grid">
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#6b7280' }}>Jackpot</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editFormData.requested_jackpot_kg || 0}
                                            onChange={(e) => setEditFormData({ ...editFormData, requested_jackpot_kg: Number(e.target.value) })}
                                            style={{
                                                width: '100%',
                                                padding: '8px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '4px',
                                                fontSize: '14px'
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#6b7280' }}>US-88</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editFormData.requested_us88_kg || 0}
                                            onChange={(e) => setEditFormData({ ...editFormData, requested_us88_kg: Number(e.target.value) })}
                                            style={{
                                                width: '100%',
                                                padding: '8px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '4px',
                                                fontSize: '14px'
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#6b7280' }}>TH-82</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editFormData.requested_th82_kg || 0}
                                            onChange={(e) => setEditFormData({ ...editFormData, requested_th82_kg: Number(e.target.value) })}
                                            style={{
                                                width: '100%',
                                                padding: '8px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '4px',
                                                fontSize: '14px'
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#6b7280' }}>RH-9000</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editFormData.requested_rh9000_kg || 0}
                                            onChange={(e) => setEditFormData({ ...editFormData, requested_rh9000_kg: Number(e.target.value) })}
                                            style={{
                                                width: '100%',
                                                padding: '8px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '4px',
                                                fontSize: '14px'
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#6b7280' }}>Lumping-143</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editFormData.requested_lumping143_kg || 0}
                                            onChange={(e) => setEditFormData({ ...editFormData, requested_lumping143_kg: Number(e.target.value) })}
                                            style={{
                                                width: '100%',
                                                padding: '8px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '4px',
                                                fontSize: '14px'
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#6b7280' }}>LP-296</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editFormData.requested_lp296_kg || 0}
                                            onChange={(e) => setEditFormData({ ...editFormData, requested_lp296_kg: Number(e.target.value) })}
                                            style={{
                                                width: '100%',
                                                padding: '8px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '4px',
                                                fontSize: '14px'
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Notes Section */}
                            {/* COMMENT: Changed from 'notes' to 'request_notes' to match database column */}
                            <div className="jo-manage-requests-modal-section">
                                <h4 className="jo-manage-requests-modal-section-title">📝 Request Notes (Optional)</h4>
                                <textarea
                                    value={editFormData.request_notes || ''}
                                    onChange={(e) => setEditFormData({ ...editFormData, request_notes: e.target.value })}
                                    rows={3}
                                    className="jo-manage-requests-modal-textarea"
                                    placeholder="Add any notes about this request..."
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="jo-manage-requests-modal-actions">
                                <button
                                    onClick={handleSaveEdit}
                                    className="jo-manage-requests-modal-btn save"
                                >
                                    💾 Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Suggestions Modal */}
            {showSuggestionsModal && (
                <div className="jo-manage-requests-modal-overlay">
                    <div className="jo-manage-requests-modal-content" style={{ maxWidth: '700px', maxHeight: '80vh' }}>
                        <div className="jo-manage-requests-modal-header">
                            <h2>💡 DSS Suggestions Overview</h2>
                        </div>

                        <div style={{ overflowY: 'auto', maxHeight: 'calc(80vh - 140px)', padding: '15px 9px' }}>
                            {Object.keys(alternatives).length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
                                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
                                    <h4 style={{ margin: '0 0 8px 0', color: '#374151', fontSize: '18px' }}>No Suggestions Available</h4>
                                    <p style={{ margin: 0, color: '#9ca3af' }}>There are no shortage-based suggestions at this time.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {Object.keys(alternatives).map(key => {
                                        const requestId = parseInt(key);
                                        const altData = alternatives[requestId];
                                        const request = requests.find(r => r.id === requestId);

                                        if (!altData?.suggestions?.suggestions?.length || !request || request.status !== 'pending') {
                                            return null;
                                        }

                                        const isExpanded = expandedFarmerInModal === requestId;

                                        return (
                                            <div key={requestId} style={{
                                                background: '#faf5ff',
                                                border: '1px solid #e9d5ff',
                                                borderRadius: '8px',
                                                overflow: 'hidden',
                                                transition: 'all 0.2s ease'
                                            }}>
                                                {/* Clickable Header */}
                                                <div
                                                    onClick={() => setExpandedFarmerInModal(isExpanded ? null : requestId)}
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        padding: '16px',
                                                        background: 'linear-gradient(to right, #f3e8ff, #ede9fe)',
                                                        cursor: 'pointer',
                                                        transition: 'background 0.2s ease'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        <span style={{ fontSize: '15px', fontWeight: 600, color: '#6b21a8' }}>
                                                            👤 {altData.farmer_name || request.farmer_name}
                                                        </span>
                                                        <span style={{ fontSize: '13px', color: '#7c3aed' }}>
                                                            📍 {request.barangay}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <span style={{
                                                            background: '#fef3c7',
                                                            color: '#b45309',
                                                            padding: '4px 10px',
                                                            borderRadius: '12px',
                                                            fontSize: '12px',
                                                            fontWeight: 600
                                                        }}>
                                                            ⚠️ {altData.suggestions.suggestions.length} shortage(s)
                                                        </span>
                                                        <span style={{ fontSize: '16px', color: '#7c3aed' }}>
                                                            {isExpanded ? '▲' : '▼'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Expandable Details */}
                                                {isExpanded && (
                                                    <div style={{
                                                        padding: '16px',
                                                        background: 'white',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '12px',
                                                        borderTop: '1px solid #e9d5ff'
                                                    }}>
                                                        {altData.suggestions.suggestions.map((suggestion: any, idx: number) => (
                                                            <div key={idx} style={{
                                                                background: '#f9fafb',
                                                                borderRadius: '8px',
                                                                padding: '14px',
                                                                border: '1px solid #e5e7eb'
                                                            }}>
                                                                <div style={{
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    alignItems: 'center',
                                                                    marginBottom: '12px'
                                                                }}>
                                                                    <span style={{ color: '#dc2626', fontSize: '14px' }}>
                                                                        ❌ Shortage: <strong>{suggestion.original_fertilizer_name || suggestion.original_seed_name}</strong>
                                                                    </span>
                                                                    <span style={{
                                                                        background: '#fee2e2',
                                                                        color: '#dc2626',
                                                                        padding: '4px 10px',
                                                                        borderRadius: '6px',
                                                                        fontSize: '13px',
                                                                        fontWeight: 700
                                                                    }}>
                                                                        {suggestion.shortage_bags || suggestion.shortage_kg} {suggestion.category === 'seed' ? 'kg' : 'bags'}
                                                                    </span>
                                                                </div>

                                                                {suggestion.alternatives && suggestion.alternatives.length > 0 ? (
                                                                    <div style={{ marginTop: '8px' }}>
                                                                        <label style={{
                                                                            display: 'block',
                                                                            fontSize: '13px',
                                                                            fontWeight: 600,
                                                                            color: '#059669',
                                                                            marginBottom: '8px'
                                                                        }}>
                                                                            ✅ Available Alternatives:
                                                                        </label>
                                                                        <select
                                                                            value={
                                                                                selectedAlternative[requestId]?.suggestionIdx === idx
                                                                                    ? selectedAlternative[requestId].alternativeIdx
                                                                                    : ''
                                                                            }
                                                                            onChange={(e) => {
                                                                                const altIdx = parseInt(e.target.value);
                                                                                if (!isNaN(altIdx)) {
                                                                                    setSelectedAlternative(prev => ({
                                                                                        ...prev,
                                                                                        [requestId]: { suggestionIdx: idx, alternativeIdx: altIdx }
                                                                                    }));
                                                                                }
                                                                            }}
                                                                            style={{
                                                                                width: '100%',
                                                                                padding: '10px 12px',
                                                                                border: '1px solid #d1d5db',
                                                                                borderRadius: '6px',
                                                                                fontSize: '14px',
                                                                                background: 'white',
                                                                                cursor: 'pointer'
                                                                            }}
                                                                        >
                                                                            <option value="">-- Choose a substitute --</option>
                                                                            {suggestion.alternatives.map((alt: any, altIdx: number) => (
                                                                                <option key={altIdx} value={altIdx}>
                                                                                    {alt.substitute_name} - {alt.needed_bags || alt.needed_kg} {suggestion.category === 'seed' ? 'kg' : 'bags'}
                                                                                    ({(alt.confidence_score * 100).toFixed(0)}% confidence)
                                                                                    {alt.can_fulfill ? ' ✅ Full' : ` ⚠️ Partial (${alt.remaining_shortage} short)`}
                                                                                </option>
                                                                            ))}
                                                                        </select>

                                                                        {selectedAlternative[requestId]?.suggestionIdx === idx && suggestion.alternatives[selectedAlternative[requestId].alternativeIdx] && (
                                                                            <div style={{
                                                                                marginTop: '12px',
                                                                                padding: '12px',
                                                                                background: '#f0fdf4',
                                                                                border: '1px solid #86efac',
                                                                                borderRadius: '6px'
                                                                            }}>
                                                                                <strong style={{ color: '#15803d', display: 'block', marginBottom: '8px' }}>Selected:</strong>
                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: '#166534' }}>
                                                                                    <span>• {suggestion.alternatives[selectedAlternative[requestId].alternativeIdx].substitute_name}</span>
                                                                                    <span>• {suggestion.alternatives[selectedAlternative[requestId].alternativeIdx].needed_bags || suggestion.alternatives[selectedAlternative[requestId].alternativeIdx].needed_kg} {suggestion.category === 'seed' ? 'kg' : 'bags'} needed</span>
                                                                                    <span>• {suggestion.alternatives[selectedAlternative[requestId].alternativeIdx].available_bags || suggestion.alternatives[selectedAlternative[requestId].alternativeIdx].available_kg} {suggestion.category === 'seed' ? 'kg' : 'bags'} available</span>
                                                                                    <span>• {(suggestion.alternatives[selectedAlternative[requestId].alternativeIdx].confidence_score * 100).toFixed(0)}% confidence</span>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <div style={{
                                                                        padding: '12px',
                                                                        background: '#fef2f2',
                                                                        borderRadius: '6px',
                                                                        color: '#991b1b',
                                                                        fontSize: '14px'
                                                                    }}>
                                                                        ❌ No suitable alternatives available
                                                                        {suggestion.recommendation?.next_steps && (
                                                                            <div style={{ marginTop: '8px', fontSize: '12px' }}>
                                                                                <strong>Recommendation:</strong>
                                                                                <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px' }}>
                                                                                    {suggestion.recommendation.next_steps.map((step: string, stepIdx: number) => (
                                                                                        <li key={stepIdx}>{step}</li>
                                                                                    ))}
                                                                                </ul>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}

                                                        {altData.suggestions.suggestions.some((s: any) => s.alternatives?.length > 0) && (
                                                            <div style={{
                                                                marginTop: '12px',
                                                                paddingTop: '12px',
                                                                borderTop: '1px solid #e5e7eb',
                                                                display: 'flex',
                                                                justifyContent: 'flex-end'
                                                            }}>
                                                                <button
                                                                    onClick={() => applyAlternative(requestId)}
                                                                    disabled={!selectedAlternative[requestId] || applyingAlternative[requestId]}
                                                                    style={{
                                                                        padding: '10px 20px',
                                                                        background: selectedAlternative[requestId] && !applyingAlternative[requestId]
                                                                            ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
                                                                            : '#cbd5e1',
                                                                        color: 'white',
                                                                        border: 'none',
                                                                        borderRadius: '6px',
                                                                        cursor: selectedAlternative[requestId] && !applyingAlternative[requestId] ? 'pointer' : 'not-allowed',
                                                                        fontSize: '14px',
                                                                        fontWeight: 600,
                                                                        transition: 'all 0.2s ease'
                                                                    }}
                                                                >
                                                                    {applyingAlternative[requestId] ? '⏳ Applying...' : '✅ Apply Selected Alternative'}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="jo-manage-requests-modal-actions">
                            <button
                                onClick={() => {
                                    setShowSuggestionsModal(false);
                                    setExpandedFarmerInModal(null);
                                }}
                                style={{
                                    padding: '10px 24px',
                                    background: '#6b7280',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 500
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default JoManageRequests;
