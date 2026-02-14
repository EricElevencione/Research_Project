import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getAllocations, getFarmerRequests, updateFarmerRequest, deleteFarmerRequest, createDistributionRecord } from '../../api';
import { suggestAlternatives, calculateRemainingStock } from '../../services/alternativeEngine';
import '../../assets/css/technician css/TechManageRequestsStyle.css';
import '../../components/layout/sidebarStyle.css';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import ApproveIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';

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

const TechManageRequests: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
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

    // Auto-suggestion notifications
    const [autoSuggestionsCount, setAutoSuggestionsCount] = useState<number>(0);
    const [newSuggestionsCount, setNewSuggestionsCount] = useState<number>(0);

    // Edit Feature
    const [editingRequest, setEditingRequest] = useState<number | null>(null);
    const [editFormData, setEditFormData] = useState<Partial<FarmerRequest>>({});

    // Suggestions Modal Feature
    const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
    const [expandedFarmerInModal, setExpandedFarmerInModal] = useState<number | null>(null);

    // Toast notification state
    const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'warning' }>({
        show: false,
        message: '',
        type: 'success'
    });

    // Show toast notification
    const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
        setToast({ show: true, message, type });
        // Auto-hide after 3 seconds
        setTimeout(() => {
            setToast(prev => ({ ...prev, show: false }));
        }, 3000);
    };

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
                const allocations = response.data;
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
            const allocations = allocationResponse.data;
            const currentAllocation = allocations.find((a: any) => a.id === parseInt(allocationId || '0'));

            if (!currentAllocation) {
                throw new Error('Allocation not found');
            }

            // Fetch requests by season
            const response = await getFarmerRequests(currentAllocation.season);
            if (response.error) {
                throw new Error('Failed to fetch requests');
            }

            const data = response.data;
            setRequests(data);

            // Auto-fetch alternatives for requests with potential shortages
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

                        console.log(`🤖 Computing alternatives for request #${request.id}...`);

                        // Calculate remaining stock for this request
                        const remainingStock = calculateRemainingStock(allocationData, requestsList, request.id);

                        // Run client-side alternative engine
                        const result = suggestAlternatives({
                            farmer_name: request.farmer_name,
                            crop_type: 'rice',
                            requested_urea_bags: request.requested_urea_bags || 0,
                            requested_complete_14_bags: request.requested_complete_14_bags || 0,
                            requested_ammonium_sulfate_bags: request.requested_ammonium_sulfate_bags || 0,
                            requested_muriate_potash_bags: request.requested_muriate_potash_bags || 0,
                            requested_jackpot_kg: request.requested_jackpot_kg || 0,
                            requested_us88_kg: request.requested_us88_kg || 0,
                            requested_th82_kg: request.requested_th82_kg || 0,
                            requested_rh9000_kg: request.requested_rh9000_kg || 0,
                            requested_lumping143_kg: request.requested_lumping143_kg || 0,
                            requested_lp296_kg: request.requested_lp296_kg || 0
                        }, remainingStock);

                        console.log(`✅ Alternatives computed for request #${request.id}:`, result);
                        setAlternatives(prev => ({ ...prev, [request.id]: result }));
                        setShowAlternatives(prev => ({ ...prev, [request.id]: true }));
                        newSuggestions++;
                    } catch (error) {
                        console.error(`❌ Failed to compute alternatives for request ${request.id}:`, error);
                    } finally {
                        setLoadingAlternatives(prev => ({ ...prev, [request.id]: false }));
                    }

                    // Small delay between requests
                    await new Promise(resolve => setTimeout(resolve, 100));
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
                (req.farmer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (req.barangay || '').toLowerCase().includes(searchTerm.toLowerCase())
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
                // If status is rejected, clear alternatives for this request
                if (newStatus === 'rejected') {
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
                showToast(`Status updated to ${newStatus}`, newStatus === 'approved' ? 'success' : newStatus === 'rejected' ? 'warning' : 'success');
                fetchRequests();
            } else {
                showToast('Failed to update status', 'error');
            }
        } catch (error) {
            console.error('Error updating status:', error);
            showToast('Error updating status', 'error');
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

    const getUniqueBarangays = () => {
        const barangays = [...new Set(requests.map(req => req.barangay))];
        return barangays.sort();
    };

    // Edit request functionality
    const handleEdit = (request: FarmerRequest) => {
        setEditingRequest(request.id);
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
            const originalRequest = requests.find(r => r.id === editingRequest);
            if (!originalRequest) {
                throw new Error('Original request not found');
            }

            // Merge original request with edited form data
            const updatedRequest = {
                ...originalRequest,
                ...editFormData
            };

            const response = await updateFarmerRequest(editingRequest, updatedRequest);

            if (response.error) {
                throw new Error('Failed to update request');
            }

            // Update local state immediately so UI reflects changes right away
            setRequests(prev => prev.map(r =>
                r.id === editingRequest ? { ...r, ...editFormData } : r
            ));

            // Clear alternatives for this request - will be re-evaluated after refresh
            setAlternatives(prev => {
                const updated = { ...prev };
                delete updated[editingRequest];
                return updated;
            });
            setSelectedAlternative(prev => {
                const updated = { ...prev };
                delete updated[editingRequest];
                return updated;
            });

            // Close edit modal
            setEditingRequest(null);
            setEditFormData({});

            alert('✅ Request updated successfully!');

            // Refresh from backend to ensure data consistency
            await fetchRequests();
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

    // DSS Feature: Fetch smart alternatives for a farmer request
    const fetchAlternatives = async (requestId: number) => {
        try {
            setLoadingAlternatives(prev => ({ ...prev, [requestId]: true }));

            console.log('🤖 Computing alternatives for request:', requestId);

            const request = requests.find(r => r.id === requestId);
            if (!request || !allocation) {
                alert('❌ Request or allocation data not found');
                return;
            }

            // Calculate remaining stock and run client-side engine
            const remainingStock = calculateRemainingStock(allocation, requests, requestId);
            const result = suggestAlternatives({
                farmer_name: request.farmer_name,
                crop_type: 'rice',
                requested_urea_bags: request.requested_urea_bags || 0,
                requested_complete_14_bags: request.requested_complete_14_bags || 0,
                requested_ammonium_sulfate_bags: request.requested_ammonium_sulfate_bags || 0,
                requested_muriate_potash_bags: request.requested_muriate_potash_bags || 0,
                requested_jackpot_kg: request.requested_jackpot_kg || 0,
                requested_us88_kg: request.requested_us88_kg || 0,
                requested_th82_kg: request.requested_th82_kg || 0,
                requested_rh9000_kg: request.requested_rh9000_kg || 0,
                requested_lumping143_kg: request.requested_lumping143_kg || 0,
                requested_lp296_kg: request.requested_lp296_kg || 0
            }, remainingStock);

            console.log('✅ Alternatives computed:', result);
            setAlternatives(prev => ({ ...prev, [requestId]: result }));
            setShowAlternatives(prev => ({ ...prev, [requestId]: true }));
        } catch (error) {
            console.error('❌ Error computing alternatives:', error);
            alert(`❌ Error computing alternatives: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setLoadingAlternatives(prev => ({ ...prev, [requestId]: false }));
        }
    };

    // Apply selected alternative to farmer request
    const applyAlternative = async (requestId: number) => {
        console.log('🔍 applyAlternative called for request:', requestId);
        console.log('Selected alternative:', selectedAlternative[requestId]);
        console.log('Alternatives data:', alternatives[requestId]);

        const selection = selectedAlternative[requestId];
        if (!selection) {
            alert('❌ Please select an alternative from the dropdown first');
            return;
        }

        const altData = alternatives[requestId];
        console.log('Full altData:', altData);

        if (!altData || !altData.suggestions?.suggestions) {
            console.error('❌ Alternative data structure invalid:', altData);
            alert('❌ Alternative data not found or has invalid structure');
            return;
        }

        const suggestion = altData.suggestions.suggestions[selection.suggestionIdx];
        console.log('Suggestion:', suggestion);

        const alternative = suggestion.alternatives[selection.alternativeIdx];
        console.log('Selected alternative detail:', alternative);

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
                'complete_16_16_16': 'requested_complete_14_bags',
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
                const updatedData = response.data;

                // Update local state immediately with the new data
                setRequests(prev => prev.map(r =>
                    r.id === requestId ? { ...r, ...updatedData } : r
                ));

                alert(
                    `✅ Alternative Applied Successfully!\n\n` +
                    `Request for ${altData.farmer_name} updated:\n` +
                    `- ${originalFert}: reduced by ${suggestion.shortage_bags} bags\n` +
                    `- ${substituteFert}: increased by ${alternative.needed_bags} bags`
                );

                // Refresh from backend to ensure consistency
                await fetchRequests();
                // Collapse the farmer in the modal after applying
                setExpandedFarmerInModal(null);
            } else {
                throw new Error('Failed to update request');
            }
        } catch (error) {
            console.error('Error applying alternative:', error);
            alert(`❌ Error applying alternative: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setApplyingAlternative(prev => ({ ...prev, [requestId]: false }));
        }
    };

    // Helper function to check if a request might have stock issues
    const checkPotentialShortage = (request: FarmerRequest): boolean => {
        return checkPotentialShortageForRequest(request, requests);
    };

    const checkPotentialShortageForRequest = (request: FarmerRequest, requestsList: FarmerRequest[], allocationData?: AllocationDetails): boolean => {
        const allocToUse = allocationData || allocation;
        if (!allocToUse) return false;

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

        // Seed shortages
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
                            className={`sidebar-nav-item ${isActive('/technician-dashboard') ? 'active' : ''}`}
                            onClick={() => navigate('/technician-dashboard')}
                        >
                            <span className="nav-icon">
                                <img src={HomeIcon} alt="Home" />
                            </span>
                            <span className="nav-text">Home</span>
                        </button>

                        <button
                            className={`sidebar-nav-item ${isActive('/technician-rsbsa') ? 'active' : ''}`}
                            onClick={() => navigate('/technician-rsbsa')}
                        >
                            <span className="nav-icon">
                                <img src={RSBSAIcon} alt="RSBSA" />
                            </span>
                            <span className="nav-text">RSBSA</span>
                        </button>

                        <button
                            className={`sidebar-nav-item ${isActive('/technician-incentives') ? 'active' : ''}`}
                            onClick={() => navigate('/technician-incentives')}
                        >
                            <span className="nav-icon">
                                <img src={IncentivesIcon} alt="Incentives" />
                            </span>
                            <span className="nav-text">Incentives</span>
                        </button>

                        <button
                            className={`sidebar-nav-item ${isActive('/technician-masterlist') ? 'active' : ''}`}
                            onClick={() => navigate('/technician-masterlist')}
                        >
                            <span className="nav-icon">
                                <img src={ApproveIcon} alt="Masterlist" />
                            </span>
                            <span className="nav-text">Masterlist</span>
                        </button>

                        <button
                            className="sidebar-nav-item logout"
                            onClick={handleLogout}
                        >
                            <span className="nav-icon">
                                <img src={LogoutIcon} alt="Logout" />
                            </span>
                            <span className="nav-text">Logout</span>
                        </button>
                    </nav>
                </div>

                {/* Main Content */}
                <div className="tech-main-content">
                    <div className="tech-manage-dashboard-header-incent">
                        <div className="tech-manage-header-sub">
                            <h2 className="tech-manage-page-header">Manage Farmer Requests</h2>
                            {allocation && (
                                <p className="page-subtitle">{formatSeasonName(allocation.season)}</p>
                            )}
                        </div>
                        <div className="tech-manage-requests-back-create-section">
                            <button
                                className="tech-manage-requests-add-btn"
                                onClick={() => navigate(`/technician-add-farmer-request/${allocationId}`)}
                            >
                                ➕ Add Farmer Request
                            </button>
                            <button
                                className="tech-manage-requests-back-btn"
                                onClick={() => navigate('/technician-incentives')}
                            >
                                ←
                            </button>
                        </div>
                    </div>

                    <div className="content-card-incent">
                        {loading ? (
                            <div className="loading-message">Loading requests...</div>
                        ) : error ? (
                            <div className="error-state">
                                <div className="error-icon">⚠️</div>
                                <h3>Error Loading Requests</h3>
                                <p>{error}</p>
                                <button className="btn-retry" onClick={fetchRequests}>
                                    🔄 Retry
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Filters */}
                                <div className="tech-manage-requests-filters">
                                    <input
                                        type="text"
                                        placeholder="🔍 Search farmer or barangay..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="tech-manage-requests-search-input"
                                    />
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        className="tech-manage-requests-filter-select"
                                    >
                                        <option value="all">All Status</option>
                                        <option value="pending">Pending</option>
                                        <option value="approved">Approved</option>
                                        <option value="rejected">Rejected</option>
                                    </select>
                                    <select
                                        value={barangayFilter}
                                        onChange={(e) => setBarangayFilter(e.target.value)}
                                        className="tech-manage-requests-filter-select"
                                    >
                                        <option value="all">All Barangays</option>
                                        {getUniqueBarangays().map(brgy => (
                                            <option key={brgy} value={brgy}>{brgy}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Allocation vs Requests Comparison */}
                                <div className="tech-manage-requests-comparison-grid">
                                    {/* Regional Allocation Card */}
                                    <div className="tech-manage-requests-comparison-card">
                                        <h3 className="tech-manage-requests-comparison-title">
                                            📦 Regional Allocation (Total Received)
                                        </h3>
                                        <div className="tech-manage-requests-comparison-stats">
                                            <div className="tech-manage-requests-stat-box tech-manage-requests-stat-fertilizer">
                                                <span className="tech-manage-requests-stat-label">🌱 Total Fertilizers</span>
                                                <span className="tech-manage-requests-stat-value">
                                                    {allocation ? (
                                                        (Number(allocation.urea_46_0_0_bags || 0) +
                                                            Number(allocation.complete_14_14_14_bags || 0) +
                                                            Number(allocation.ammonium_sulfate_21_0_0_bags || 0) +
                                                            Number(allocation.muriate_potash_0_0_60_bags || 0)).toFixed(2)
                                                    ) : '0.00'} bags
                                                </span>
                                            </div>
                                            <div className="tech-manage-requests-stat-box tech-manage-requests-stat-seed">
                                                <span className="tech-manage-requests-stat-label">🌾 Total Seeds</span>
                                                <span className="tech-manage-requests-stat-value">
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
                                    <div className="tech-manage-requests-comparison-card">
                                        <h3 className="tech-manage-requests-comparison-title">
                                            📊 Total Farmer Requests
                                        </h3>
                                        <div className="tech-manage-requests-comparison-stats">
                                            <div className="tech-manage-requests-stat-box tech-manage-requests-stat-fertilizer">
                                                <span className="tech-manage-requests-stat-label">🌱 Total Fertilizers Requested</span>
                                                <span className="tech-manage-requests-stat-value">
                                                    {getTotalRequested('requested_urea_bags') +
                                                        getTotalRequested('requested_complete_14_bags') +
                                                        getTotalRequested('requested_ammonium_sulfate_bags') +
                                                        getTotalRequested('requested_muriate_potash_bags')} bags
                                                </span>
                                            </div>
                                            <div className="tech-manage-requests-stat-box tech-manage-requests-stat-seed">
                                                <span className="tech-manage-requests-stat-label">🌾 Total Seeds Requested</span>
                                                <span className="tech-manage-requests-stat-value">
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
                                    <div className="tech-manage-requests-comparison-card tech-manage-requests-comparison-card-approved">
                                        <h3 className="tech-manage-requests-comparison-title">
                                            ✅ Approved Farmer Requests
                                        </h3>
                                        <div className="tech-manage-requests-comparison-stats">
                                            <div className="tech-manage-requests-stat-box tech-manage-requests-stat-fertilizer">
                                                <span className="tech-manage-requests-stat-label">🌱 Total Fertilizers</span>
                                                <span className="tech-manage-requests-stat-value">
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
                                            <div className="tech-manage-requests-stat-box tech-manage-requests-stat-seed">
                                                <span className="tech-manage-requests-stat-label">🌾 Total Seeds</span>
                                                <span className="tech-manage-requests-stat-value">
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
                                    <div className="tech-manage-requests-comparison-card tech-manage-requests-comparison-card-rejected">
                                        <h3 className="tech-manage-requests-comparison-title">
                                            ❌ Rejected Farmer Requests
                                        </h3>
                                        <div className="tech-manage-requests-comparison-stats">
                                            <div className="tech-manage-requests-stat-box tech-manage-requests-stat-fertilizer">
                                                <span className="tech-manage-requests-stat-label">🌱 Total Fertilizers</span>
                                                <span className="tech-manage-requests-stat-value">
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
                                            <div className="tech-manage-requests-stat-box tech-manage-requests-stat-seed">
                                                <span className="tech-manage-requests-stat-label">🌾 Total Seeds</span>
                                                <span className="tech-manage-requests-stat-value">
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

                                {/* Summary Stats */}
                                <div className="tech-manage-requests-summary-cards">
                                    <div className="tech-manage-requests-summary-card tech-manage-requests-summary-total">
                                        <div className="tech-manage-requests-summary-label">Total Requests</div>
                                        <div className="tech-manage-requests-summary-value">{filteredRequests.length}</div>
                                    </div>
                                    <div className="tech-manage-requests-summary-card tech-manage-requests-summary-pending">
                                        <div className="tech-manage-requests-summary-label">Pending</div>
                                        <div className="tech-manage-requests-summary-value">
                                            {filteredRequests.filter(r => r.status === 'pending').length}
                                        </div>
                                    </div>
                                    <div className="tech-manage-requests-summary-card tech-manage-requests-summary-approved">
                                        <div className="tech-manage-requests-summary-label">Approved</div>
                                        <div className="tech-manage-requests-summary-value">
                                            {filteredRequests.filter(r => r.status === 'approved').length}
                                        </div>
                                    </div>
                                    <div className="tech-manage-requests-summary-card tech-manage-requests-summary-rejected">
                                        <div className="tech-manage-requests-summary-label">Rejected</div>
                                        <div className="tech-manage-requests-summary-value">
                                            {filteredRequests.filter(r => r.status === 'rejected').length}
                                        </div>
                                    </div>
                                    {/* Combined Shortage & Suggestions Card */}
                                    <div
                                        className="tech-manage-requests-summary-card tech-manage-requests-summary-shortage"
                                        onClick={() => setShowSuggestionsModal(true)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {newSuggestionsCount > 0 && (
                                            <div className="tech-manage-requests-shortage-pulse-badge">
                                                {newSuggestionsCount}
                                            </div>
                                        )}
                                        <div className="tech-manage-requests-summary-label">⚠️ Shortages & Suggestions</div>
                                        <div className="tech-manage-requests-summary-value">
                                            {autoSuggestionsCount} / {Object.keys(alternatives).filter(key => {
                                                const alt = alternatives[parseInt(key)];
                                                return alt?.suggestions?.suggestions?.length > 0;
                                            }).length}
                                        </div>
                                        <div className="tech-manage-requests-summary-hint">
                                            {autoSuggestionsCount} shortages, {Object.keys(alternatives).filter(key => {
                                                const alt = alternatives[parseInt(key)];
                                                return alt?.suggestions?.suggestions?.length > 0;
                                            }).length} with solutions • Click to view
                                        </div>
                                    </div>
                                </div>

                                {/* Info Box for Visual Indicators */}
                                {filteredRequests.filter(r => r.status === 'pending' && checkPotentialShortage(r)).length > 0 && (
                                    <div className="tech-manage-requests-info-box">
                                        <span className="tech-manage-requests-info-box-icon">💡</span>
                                        <div className="tech-manage-requests-info-box-content">
                                            <strong className="tech-manage-requests-info-box-title">
                                                Alternatives Auto-Loaded & Displayed
                                            </strong>
                                            <p className="tech-manage-requests-info-box-text">
                                                Rows highlighted in yellow (⚠️) show automatic suggestions.
                                                Alternative fertilizer options are displayed automatically based on agronomic equivalency.
                                                Click the "💡 Suggestions" card above to view and apply alternatives.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Requests Table */}
                                {filteredRequests.length === 0 ? (
                                    <div className="empty-state">
                                        <div className="empty-icon">📋</div>
                                        <h3>No Requests Found</h3>
                                        <p>No farmer requests match your filters</p>
                                    </div>
                                ) : (
                                    <div className="tech-manage-requests-table-container">
                                        <table className="tech-manage-requests-table">
                                            <thead className="tech-manage-requests-table-header">
                                                <tr>
                                                    <th>Farmer</th>
                                                    <th>Barangay</th>
                                                    <th>Status</th>
                                                    <th>Fertilizers (bags)</th>
                                                    <th>Seeds (kg)</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredRequests.map((request) => {
                                                    const totalFertilizer = (Number(request.requested_urea_bags) || 0) +
                                                        (Number(request.requested_complete_14_bags) || 0) +
                                                        (Number(request.requested_ammonium_sulfate_bags) || 0) +
                                                        (Number(request.requested_muriate_potash_bags) || 0);

                                                    const totalSeeds = (Number(request.requested_jackpot_kg) || 0) +
                                                        (Number(request.requested_us88_kg) || 0) +
                                                        (Number(request.requested_th82_kg) || 0) +
                                                        (Number(request.requested_rh9000_kg) || 0) +
                                                        (Number(request.requested_lumping143_kg) || 0) +
                                                        (Number(request.requested_lp296_kg) || 0);

                                                    const hasShortage = checkPotentialShortage(request);

                                                    return (
                                                        <React.Fragment key={request.id}>
                                                            <tr className={`tech-manage-requests-table-row ${hasShortage ? 'shortage-warning' : ''}`}>
                                                                <td>
                                                                    {request.farmer_name}
                                                                    {hasShortage && request.status === 'pending' && (
                                                                        <div className="tech-manage-requests-shortage-badge">
                                                                            ⚠️ Shortage detected
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td>{request.barangay}</td>
                                                                <td>
                                                                    <span className={`tech-manage-requests-status-badge tech-manage-requests-status-${request.status}`}>
                                                                        {request.status}
                                                                    </span>
                                                                </td>
                                                                <td>{totalFertilizer.toFixed(2)}</td>
                                                                <td>{totalSeeds.toFixed(2)}</td>
                                                                <td>
                                                                    <div className="tech-manage-requests-action-buttons">
                                                                        {request.status === 'pending' && (
                                                                            <>
                                                                                <button
                                                                                    onClick={() => handleStatusChange(request.id, 'approved')}
                                                                                    className="tech-manage-requests-btn-approve"
                                                                                >
                                                                                    ✓ Approve
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => handleEdit(request)}
                                                                                    className="tech-manage-requests-btn-edit"
                                                                                >
                                                                                    ✏️ Edit
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => handleStatusChange(request.id, 'rejected')}
                                                                                    className="tech-manage-requests-btn-reject"
                                                                                >
                                                                                    ✕ Reject
                                                                                </button>
                                                                            </>
                                                                        )}
                                                                        <button
                                                                            onClick={() => handleDelete(request.id, request.farmer_name)}
                                                                            className="tech-manage-requests-btn-delete"
                                                                        >
                                                                            🗑️ Delete
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Edit Request Modal */}
            {editingRequest && (
                <div className="tech-manage-requests-modal-overlay">
                    <div className="tech-manage-requests-modal-content">
                        <h3 className="tech-manage-requests-modal-title">Edit Farmer Request</h3>

                        {/* Fertilizers */}
                        <div className="tech-manage-requests-modal-section">
                            <h4 className="tech-manage-requests-modal-section-title">Fertilizers (bags)</h4>
                            <div className="tech-manage-requests-modal-grid">
                                <div>
                                    <label className="tech-manage-requests-modal-label">Urea (46-0-0)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editFormData.requested_urea_bags || 0}
                                        onChange={(e) => setEditFormData({ ...editFormData, requested_urea_bags: parseFloat(e.target.value) || 0 })}
                                        className="tech-manage-requests-modal-input"
                                    />
                                </div>
                                <div>
                                    <label className="tech-manage-requests-modal-label">Complete (14-14-14)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editFormData.requested_complete_14_bags || 0}
                                        onChange={(e) => setEditFormData({ ...editFormData, requested_complete_14_bags: parseFloat(e.target.value) || 0 })}
                                        className="tech-manage-requests-modal-input"
                                    />
                                </div>
                                <div>
                                    <label className="tech-manage-requests-modal-label">Ammonium Sulfate</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editFormData.requested_ammonium_sulfate_bags || 0}
                                        onChange={(e) => setEditFormData({ ...editFormData, requested_ammonium_sulfate_bags: parseFloat(e.target.value) || 0 })}
                                        className="tech-manage-requests-modal-input"
                                    />
                                </div>
                                <div>
                                    <label className="tech-manage-requests-modal-label">Muriate of Potash</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editFormData.requested_muriate_potash_bags || 0}
                                        onChange={(e) => setEditFormData({ ...editFormData, requested_muriate_potash_bags: parseFloat(e.target.value) || 0 })}
                                        className="tech-manage-requests-modal-input"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Seeds */}
                        <div className="tech-manage-requests-modal-section">
                            <h4 className="tech-manage-requests-modal-section-title">Seeds (kg)</h4>
                            <div className="tech-manage-requests-modal-grid">
                                <div>
                                    <label className="tech-manage-requests-modal-label">Jackpot</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editFormData.requested_jackpot_kg || 0}
                                        onChange={(e) => setEditFormData({ ...editFormData, requested_jackpot_kg: parseFloat(e.target.value) || 0 })}
                                        className="tech-manage-requests-modal-input"
                                    />
                                </div>
                                <div>
                                    <label className="tech-manage-requests-modal-label">US88</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editFormData.requested_us88_kg || 0}
                                        onChange={(e) => setEditFormData({ ...editFormData, requested_us88_kg: parseFloat(e.target.value) || 0 })}
                                        className="tech-manage-requests-modal-input"
                                    />
                                </div>
                                <div>
                                    <label className="tech-manage-requests-modal-label">TH82</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editFormData.requested_th82_kg || 0}
                                        onChange={(e) => setEditFormData({ ...editFormData, requested_th82_kg: parseFloat(e.target.value) || 0 })}
                                        className="tech-manage-requests-modal-input"
                                    />
                                </div>
                                <div>
                                    <label className="tech-manage-requests-modal-label">RH9000</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editFormData.requested_rh9000_kg || 0}
                                        onChange={(e) => setEditFormData({ ...editFormData, requested_rh9000_kg: parseFloat(e.target.value) || 0 })}
                                        className="tech-manage-requests-modal-input"
                                    />
                                </div>
                                <div>
                                    <label className="tech-manage-requests-modal-label">Lumping143</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editFormData.requested_lumping143_kg || 0}
                                        onChange={(e) => setEditFormData({ ...editFormData, requested_lumping143_kg: parseFloat(e.target.value) || 0 })}
                                        className="tech-manage-requests-modal-input"
                                    />
                                </div>
                                <div>
                                    <label className="tech-manage-requests-modal-label">LP296</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editFormData.requested_lp296_kg || 0}
                                        onChange={(e) => setEditFormData({ ...editFormData, requested_lp296_kg: parseFloat(e.target.value) || 0 })}
                                        className="tech-manage-requests-modal-input"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="tech-manage-requests-modal-section">
                            <label className="tech-manage-requests-modal-label">Notes</label>
                            <textarea
                                value={editFormData.request_notes || ''}
                                onChange={(e) => setEditFormData({ ...editFormData, request_notes: e.target.value })}
                                rows={3}
                                className="tech-manage-requests-modal-textarea"
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="tech-manage-requests-modal-actions">
                            <button
                                onClick={handleCancelEdit}
                                className="tech-manage-requests-modal-btn-cancel"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                className="tech-manage-requests-modal-btn-save"
                            >
                                💾 Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Suggestions Modal */}
            {showSuggestionsModal && (
                <div className="tech-manage-requests-modal-overlay">
                    <div className="tech-manage-requests-modal-content" style={{ maxWidth: '700px', maxHeight: '80vh' }}>
                        <h3 className="tech-manage-requests-modal-title">💡 DSS Suggestions Overview</h3>

                        <div style={{ overflowY: 'auto', maxHeight: 'calc(80vh - 140px),', padding: '15px 9px' }}>
                            {Object.keys(alternatives).length === 0 ? (
                                <div className="tech-manage-requests-suggestions-empty">
                                    <div className="tech-manage-requests-suggestions-empty-icon">📋</div>
                                    <h4>No Suggestions Available</h4>
                                    <p>There are no shortage-based suggestions at this time.</p>
                                </div>
                            ) : (
                                <div className="tech-manage-requests-suggestions-list">
                                    {Object.keys(alternatives).map(key => {
                                        const requestId = parseInt(key);
                                        const altData = alternatives[requestId];
                                        const request = requests.find(r => r.id === requestId);

                                        if (!altData?.suggestions?.suggestions?.length || !request || request.status !== 'pending') {
                                            return null;
                                        }

                                        const isExpanded = expandedFarmerInModal === requestId;

                                        return (
                                            <div key={requestId} className="tech-manage-requests-suggestion-card">
                                                {/* Clickable Header */}
                                                <div
                                                    className="tech-manage-requests-suggestion-card-header"
                                                    onClick={() => setExpandedFarmerInModal(isExpanded ? null : requestId)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <div className="tech-manage-requests-suggestion-farmer-info">
                                                        <span className="tech-manage-requests-suggestion-farmer-name">
                                                            👤 {altData.farmer_name || request.farmer_name}
                                                        </span>
                                                        <span className="tech-manage-requests-suggestion-farmer-barangay">
                                                            📍 {request.barangay}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <span className="tech-manage-requests-suggestion-status">
                                                            ⚠️ {altData.suggestions.suggestions.length} shortage(s)
                                                        </span>
                                                        <span style={{ fontSize: '16px', color: '#7c3aed' }}>
                                                            {isExpanded ? '▲' : '▼'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Expandable Details */}
                                                {isExpanded && (
                                                    <div className="tech-manage-requests-suggestion-details">
                                                        {altData.suggestions.suggestions.map((suggestion: any, idx: number) => (
                                                            <div key={idx} className="tech-manage-requests-shortage-item">
                                                                <div className="tech-manage-requests-shortage-header">
                                                                    <span className="tech-manage-requests-shortage-label">
                                                                        ❌ Shortage: <strong>{suggestion.original_fertilizer_name}</strong>
                                                                    </span>
                                                                    <span className="tech-manage-requests-shortage-amount">
                                                                        {suggestion.shortage_bags} bags
                                                                    </span>
                                                                </div>

                                                                {suggestion.alternatives && suggestion.alternatives.length > 0 ? (
                                                                    <div className="tech-manage-requests-alternatives-section">
                                                                        <label className="tech-manage-requests-alternatives-label">
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
                                                                            className="tech-manage-requests-alternatives-select"
                                                                        >
                                                                            <option value="">-- Choose a substitute --</option>
                                                                            {suggestion.alternatives.map((alt: any, altIdx: number) => (
                                                                                <option key={altIdx} value={altIdx}>
                                                                                    {alt.substitute_name} - {alt.needed_bags} bags
                                                                                    ({(alt.confidence_score * 100).toFixed(0)}% confidence)
                                                                                    {alt.can_fulfill ? ' ✅ Full' : ` ⚠️ Partial (${alt.remaining_shortage} short)`}
                                                                                </option>
                                                                            ))}
                                                                        </select>

                                                                        {selectedAlternative[requestId]?.suggestionIdx === idx && suggestion.alternatives[selectedAlternative[requestId].alternativeIdx] && (
                                                                            <div className="tech-manage-requests-selected-alternative-preview">
                                                                                <strong>Selected:</strong>
                                                                                <div className="tech-manage-requests-selected-alternative-details">
                                                                                    <span>• {suggestion.alternatives[selectedAlternative[requestId].alternativeIdx].substitute_name}</span>
                                                                                    <span>• {suggestion.alternatives[selectedAlternative[requestId].alternativeIdx].needed_bags} bags needed</span>
                                                                                    <span>• {suggestion.alternatives[selectedAlternative[requestId].alternativeIdx].available_bags} bags available</span>
                                                                                    <span>• {(suggestion.alternatives[selectedAlternative[requestId].alternativeIdx].confidence_score * 100).toFixed(0)}% confidence</span>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <div className="tech-manage-requests-no-alternatives">
                                                                        ❌ No suitable alternatives available
                                                                        {suggestion.recommendation?.next_steps && (
                                                                            <div className="tech-manage-requests-recommendation">
                                                                                <strong>Recommendation:</strong>
                                                                                <ul>
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
                                                            <div className="tech-manage-requests-suggestion-card-actions">
                                                                <button
                                                                    onClick={() => applyAlternative(requestId)}
                                                                    disabled={!selectedAlternative[requestId] || applyingAlternative[requestId]}
                                                                    className="tech-manage-requests-btn-apply-alternative"
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

                        {/* Action Buttons */}
                        <div className="tech-manage-requests-modal-actions">
                            <button
                                onClick={() => {
                                    setShowSuggestionsModal(false);
                                    setExpandedFarmerInModal(null);
                                }}
                                className="tech-manage-requests-modal-btn-cancel"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            {toast.show && (
                <div className={`tech-toast-notification tech-toast-${toast.type}`}>
                    <div className="tech-toast-icon">
                        {toast.type === 'success' && '✅'}
                        {toast.type === 'error' && '❌'}
                        {toast.type === 'warning' && '⚠️'}
                    </div>
                    <div className="tech-toast-content">
                        <span className="tech-toast-message">{toast.message}</span>
                    </div>
                    <button
                        className="tech-toast-close"
                        onClick={() => setToast(prev => ({ ...prev, show: false }))}
                    >
                        ×
                    </button>
                </div>
            )}
        </div>
    );
};

export default TechManageRequests;
