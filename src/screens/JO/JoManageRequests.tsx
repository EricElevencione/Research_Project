import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import '../../assets/css/jo css/JoIncentStyle.css';
import '../../assets/css/navigation/nav.css';
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
    const [showAlternatives, setShowAlternatives] = useState<{ [key: number]: boolean }>({});
    const [alternatives, setAlternatives] = useState<{ [key: number]: any }>({});
    const [loadingAlternatives, setLoadingAlternatives] = useState<{ [key: number]: boolean }>({});

    // DSS Feature: Apply alternatives
    const [selectedAlternative, setSelectedAlternative] = useState<{ [key: number]: { suggestionIdx: number, alternativeIdx: number } }>({});
    const [applyingAlternative, setApplyingAlternative] = useState<{ [key: number]: boolean }>({});

    // Edit Feature
    const [editingRequest, setEditingRequest] = useState<number | null>(null);
    const [editFormData, setEditFormData] = useState<Partial<FarmerRequest>>({});

    // Auto-suggestion notifications
    const [autoSuggestionsCount, setAutoSuggestionsCount] = useState<number>(0);
    const [newSuggestionsCount, setNewSuggestionsCount] = useState<number>(0);

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
            const response = await fetch(`http://localhost:5000/api/distribution/allocations`);
            if (response.ok) {
                const allocations = await response.json();
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
            const allocationResponse = await fetch(`http://localhost:5000/api/distribution/allocations`);
            if (!allocationResponse.ok) {
                throw new Error('Failed to fetch allocation');
            }
            const allocations = await allocationResponse.json();
            const currentAllocation = allocations.find((a: any) => a.id === parseInt(allocationId || '0'));

            if (!currentAllocation) {
                throw new Error('Allocation not found');
            }

            // Fetch requests by season
            const response = await fetch(`http://localhost:5000/api/distribution/requests/${currentAllocation.season}`);
            if (!response.ok) {
                throw new Error('Failed to fetch requests');
            }

            const data = await response.json();
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

                        console.log(`🤖 Fetching alternatives for request #${request.id}...`);
                        const response = await fetch('http://localhost:5000/api/distribution/suggest-alternatives', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ request_id: request.id })
                        });

                        console.log(`📡 API Response status: ${response.status}`);

                        if (response.ok) {
                            const data = await response.json();
                            console.log(`✅ Alternatives received for request #${request.id}:`, data);
                            setAlternatives(prev => ({ ...prev, [request.id]: data }));
                            setShowAlternatives(prev => ({ ...prev, [request.id]: true }));
                            newSuggestions++;
                        } else {
                            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                            console.error(`❌ API Error for request #${request.id}:`, response.status, errorData);
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
            const response = await fetch(`http://localhost:5000/api/distribution/requests/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
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
            const response = await fetch(`http://localhost:5000/api/distribution/requests/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });

            if (response.ok) {
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

    // DSS Feature: Fetch smart alternatives for a farmer request
    const fetchAlternatives = async (requestId: number) => {
        try {
            setLoadingAlternatives(prev => ({ ...prev, [requestId]: true }));

            console.log('🤖 Fetching alternatives for request:', requestId);

            const response = await fetch('http://localhost:5000/api/distribution/suggest-alternatives', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ request_id: requestId })
            });

            console.log('Response status:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Alternatives data:', data);
                setAlternatives(prev => ({ ...prev, [requestId]: data }));
                setShowAlternatives(prev => ({ ...prev, [requestId]: true }));
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error('❌ Server error:', errorData);
                alert(`❌ Failed to fetch alternatives: ${errorData.error || errorData.message || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('❌ Error fetching alternatives:', error);
            alert(`❌ Error fetching alternatives: ${error instanceof Error ? error.message : 'Network error'}`);
        } finally {
            setLoadingAlternatives(prev => ({ ...prev, [requestId]: false }));
        }
    };

    // Toggle alternatives panel visibility
    const toggleAlternatives = (requestId: number) => {
        if (showAlternatives[requestId]) {
            // Hide if already showing
            setShowAlternatives(prev => ({ ...prev, [requestId]: false }));
        } else {
            // Fetch and show alternatives
            fetchAlternatives(requestId);
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
            const response = await fetch(`http://localhost:5000/api/distribution/requests/${requestId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedRequest)
            });

            if (response.ok) {
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
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to update request');
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
            const response = await fetch(`http://localhost:5000/api/distribution/requests/${editingRequest}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedRequest)  // Send complete merged object
            });

            if (!response.ok) {
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
            <style>{`
                @keyframes pulse {
                    0%, 100% {
                        transform: scale(1);
                        opacity: 1;
                    }
                    50% {
                        transform: scale(1.1);
                        opacity: 0.8;
                    }
                }
            `}</style>
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
                            className={`sidebar-nav-item ${isActive('/jo-masterlist') ? 'active' : ''}`}
                            onClick={() => navigate('/jo-masterlist')}
                        >
                            <span className="nav-icon">
                                <img src={MasterlistIcon} alt="Masterlist" />
                            </span>
                            <span className="nav-text">Masterlist</span>
                        </button>

                        <button
                            className={`sidebar-nav-item ${isActive('/jo-landrecords') ? 'active' : ''}`}
                            onClick={() => navigate('/jo-landrecords')}
                        >
                            <span className="nav-icon">
                                <img src={LandRecsIcon} alt="Land Records" />
                            </span>
                            <span className="nav-text">Land Records</span>
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
                <div className="main-content">
                    <div className="dashboard-header-incent">
                        <div>
                            <h2 className="page-header">Manage Farmer Requests</h2>
                        </div>
                        <button
                            className="btn-create-allocation"
                            onClick={() => navigate('/jo-incentives')}
                        >
                            ← Back to Allocations
                        </button>
                    </div>

                    <div className="content-card-incent">
                        {/* Filters */}
                        <div style={{ marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                            <input
                                type="text"
                                placeholder="🔍 Search by farmer name or barangay..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    flex: '1',
                                    minWidth: '250px',
                                    padding: '10px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px',
                                    fontSize: '14px'
                                }}
                            />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                style={{
                                    padding: '10px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px',
                                    fontSize: '14px'
                                }}
                            >
                                <option value="all">All Status</option>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                            </select>
                            <select
                                value={barangayFilter}
                                onChange={(e) => setBarangayFilter(e.target.value)}
                                style={{
                                    padding: '10px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px',
                                    fontSize: '14px'
                                }}
                            >
                                <option value="all">All Barangays</option>
                                {getUniqueBarangays().map(barangay => (
                                    <option key={barangay} value={barangay}>{barangay}</option>
                                ))}
                            </select>
                            <button
                                onClick={() => navigate(`/jo-add-farmer-request/${allocationId}`)}
                                style={{
                                    padding: '10px 20px',
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                ➕ Add Farmer
                            </button>
                        </div>

                        {/* Allocation vs Requests Comparison */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '16px',
                            marginBottom: '24px',
                            padding: '20px',
                            background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                            borderRadius: '12px',
                            border: '2px solid #0ea5e9'
                        }}>
                            {/* Regional Allocation Card */}
                            <div style={{
                                background: 'white',
                                borderRadius: '10px',
                                padding: '20px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                            }}>
                                <h3 style={{
                                    margin: '0 0 16px 0',
                                    fontSize: '16px',
                                    fontWeight: '600',
                                    color: '#1e40af',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    📦 Regional Allocation (Total Received)
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '12px',
                                        background: '#fef3c7',
                                        borderRadius: '8px'
                                    }}>
                                        <span style={{ fontWeight: '500', color: '#92400e' }}>🌱 Total Fertilizers</span>
                                        <span style={{ fontSize: '20px', fontWeight: '700', color: '#92400e' }}>
                                            {allocation ? (
                                                (Number(allocation.urea_46_0_0_bags || 0) +
                                                    Number(allocation.complete_14_14_14_bags || 0) +
                                                    Number(allocation.ammonium_sulfate_21_0_0_bags || 0) +
                                                    Number(allocation.muriate_potash_0_0_60_bags || 0)).toFixed(2)
                                            ) : '0.00'} bags
                                        </span>
                                    </div>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '12px',
                                        background: '#dbeafe',
                                        borderRadius: '8px'
                                    }}>
                                        <span style={{ fontWeight: '500', color: '#1e40af' }}>🌾 Total Seeds</span>
                                        <span style={{ fontSize: '20px', fontWeight: '700', color: '#1e40af' }}>
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

                            {/* Farmer Requests Card */}
                            <div style={{
                                background: 'white',
                                borderRadius: '10px',
                                padding: '20px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                            }}>
                                <h3 style={{
                                    margin: '0 0 16px 0',
                                    fontSize: '16px',
                                    fontWeight: '600',
                                    color: '#059669',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    ✅ Approved Farmer Requests
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '12px',
                                        background: '#fef3c7',
                                        borderRadius: '8px'
                                    }}>
                                        <span style={{ fontWeight: '500', color: '#92400e' }}>🌱 Total Fertilizers</span>
                                        <span style={{ fontSize: '20px', fontWeight: '700', color: '#92400e' }}>
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
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '12px',
                                        background: '#dbeafe',
                                        borderRadius: '8px'
                                    }}>
                                        <span style={{ fontWeight: '500', color: '#1e40af' }}>🌾 Total Seeds</span>
                                        <span style={{ fontSize: '20px', fontWeight: '700', color: '#1e40af' }}>
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
                        </div>

                        {/* Summary Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                            <div style={{ padding: '16px', background: '#f3f4f6', borderRadius: '8px' }}>
                                <div style={{ fontSize: '14px', color: '#6b7280' }}>Total Requests</div>
                                <div style={{ fontSize: '24px', fontWeight: '600', color: '#1f2937' }}>{filteredRequests.length}</div>
                            </div>
                            <div style={{ padding: '16px', background: '#fef3c7', borderRadius: '8px' }}>
                                <div style={{ fontSize: '14px', color: '#92400e' }}>Pending</div>
                                <div style={{ fontSize: '24px', fontWeight: '600', color: '#92400e' }}>
                                    {filteredRequests.filter(r => r.status === 'pending').length}
                                </div>
                            </div>
                            <div style={{ padding: '16px', background: '#d1fae5', borderRadius: '8px' }}>
                                <div style={{ fontSize: '14px', color: '#065f46' }}>Approved</div>
                                <div style={{ fontSize: '24px', fontWeight: '600', color: '#065f46' }}>
                                    {filteredRequests.filter(r => r.status === 'approved').length}
                                </div>
                            </div>
                            <div style={{ padding: '16px', background: '#fee2e2', borderRadius: '8px' }}>
                                <div style={{ fontSize: '14px', color: '#991b1b' }}>Rejected</div>
                                <div style={{ fontSize: '24px', fontWeight: '600', color: '#991b1b' }}>
                                    {filteredRequests.filter(r => r.status === 'rejected').length}
                                </div>
                            </div>
                            {/* NEW: Shortage Warning Card */}
                            <div style={{
                                padding: '16px',
                                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                                borderRadius: '8px',
                                border: '2px solid #f59e0b',
                                position: 'relative'
                            }}>
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
                                    ⚠️ Needs Alternatives
                                </div>
                                <div style={{ fontSize: '24px', fontWeight: '600', color: '#92400e' }}>
                                    {autoSuggestionsCount}
                                </div>
                                <div style={{ fontSize: '11px', color: '#78350f', marginTop: '4px' }}>
                                    {newSuggestionsCount > 0 ? '🔴 New suggestions loaded!' : 'Auto-loaded alternatives'}
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
                                    <div style={{
                                        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                                        border: '2px solid #f59e0b',
                                        borderRadius: '8px',
                                        padding: '16px',
                                        marginBottom: '16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px'
                                    }}>
                                        <span style={{ fontSize: '24px' }}>💡</span>
                                        <div style={{ flex: 1 }}>
                                            <strong style={{ color: '#92400e', fontSize: '14px' }}>
                                                🤖 Smart Alternatives Auto-Loaded & Displayed
                                            </strong>
                                            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#78350f' }}>
                                                Rows highlighted in yellow (⚠️) show automatic suggestions below.
                                                Alternative fertilizer options are displayed automatically based on agronomic equivalency.
                                                Use the dropdown in the blue panel to select and apply alternatives one-by-one.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div style={{ overflowX: 'auto' }}>
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
                                                                            {/* Show/Hide Alternatives button - only for requests with alternatives */}
                                                                            {hasShortage && alternatives[request.id] && (
                                                                                <button
                                                                                    onClick={() => setShowAlternatives(prev => ({ ...prev, [request.id]: !prev[request.id] }))}
                                                                                    style={{
                                                                                        padding: '6px 12px',
                                                                                        background: showAlternatives[request.id] ? '#6b7280' : '#3b82f6',
                                                                                        color: 'white',
                                                                                        border: 'none',
                                                                                        borderRadius: '4px',
                                                                                        cursor: 'pointer',
                                                                                        fontSize: '12px'
                                                                                    }}
                                                                                >
                                                                                    {showAlternatives[request.id] ? '🔼 Hide' : '🔽 Show'} Alternatives
                                                                                </button>
                                                                            )}
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

                                                        {/* Alternatives Panel - Appears below the row when button is clicked */}
                                                        {showAlternatives[request.id] && alternatives[request.id] && (
                                                            <tr>
                                                                <td colSpan={7} style={{ padding: '20px', background: '#f0f9ff', borderLeft: '4px solid #3b82f6' }}>
                                                                    <div style={{ maxWidth: '100%' }}>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                                                            <h3 style={{ margin: '0', color: '#1e40af', fontSize: '16px' }}>
                                                                                🤖 Smart Alternatives for {request.farmer_name}
                                                                            </h3>
                                                                            <button
                                                                                onClick={() => setShowAlternatives(prev => ({ ...prev, [request.id]: false }))}
                                                                                style={{
                                                                                    padding: '4px 12px',
                                                                                    background: '#6b7280',
                                                                                    color: 'white',
                                                                                    border: 'none',
                                                                                    borderRadius: '4px',
                                                                                    cursor: 'pointer',
                                                                                    fontSize: '12px'
                                                                                }}
                                                                            >
                                                                                ✕ Close
                                                                            </button>
                                                                            {alternatives[request.id].suggestions?.suggestions?.length > 0 &&
                                                                                alternatives[request.id].suggestions.suggestions.some((s: any) => s.alternatives?.length > 0) && (
                                                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                                        <select
                                                                                            value={selectedAlternative[request.id] ? `${selectedAlternative[request.id].suggestionIdx}-${selectedAlternative[request.id].alternativeIdx}` : ''}
                                                                                            onChange={(e) => {
                                                                                                if (e.target.value) {
                                                                                                    const [suggestionIdx, alternativeIdx] = e.target.value.split('-').map(Number);
                                                                                                    setSelectedAlternative(prev => ({
                                                                                                        ...prev,
                                                                                                        [request.id]: { suggestionIdx, alternativeIdx }
                                                                                                    }));
                                                                                                }
                                                                                            }}
                                                                                            style={{
                                                                                                padding: '8px 12px',
                                                                                                border: '1px solid #d1d5db',
                                                                                                borderRadius: '6px',
                                                                                                fontSize: '13px',
                                                                                                minWidth: '300px'
                                                                                            }}
                                                                                        >
                                                                                            <option value="">-- Select an alternative to apply --</option>
                                                                                            {alternatives[request.id].suggestions.suggestions.map((sug: any, sugIdx: number) =>
                                                                                                sug.alternatives?.map((alt: any, altIdx: number) => (
                                                                                                    <option key={`${sugIdx}-${altIdx}`} value={`${sugIdx}-${altIdx}`}>
                                                                                                        {sug.category === 'seed' ? sug.original_seed_name : sug.original_fertilizer_name} → {alt.substitute_name} ({(alt.confidence_score * 100).toFixed(0)}% confidence)
                                                                                                    </option>
                                                                                                ))
                                                                                            )}
                                                                                        </select>
                                                                                        <button
                                                                                            onClick={() => applyAlternative(request.id)}
                                                                                            disabled={!selectedAlternative[request.id] || applyingAlternative[request.id]}
                                                                                            style={{
                                                                                                padding: '8px 16px',
                                                                                                background: selectedAlternative[request.id] && !applyingAlternative[request.id] ?
                                                                                                    'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#9ca3af',
                                                                                                color: 'white',
                                                                                                border: 'none',
                                                                                                borderRadius: '6px',
                                                                                                cursor: selectedAlternative[request.id] && !applyingAlternative[request.id] ? 'pointer' : 'not-allowed',
                                                                                                fontSize: '13px',
                                                                                                fontWeight: '600',
                                                                                                whiteSpace: 'nowrap'
                                                                                            }}
                                                                                        >
                                                                                            {applyingAlternative[request.id] ? '⏳ Applying...' : '💾 Apply Selected'}
                                                                                        </button>
                                                                                    </div>
                                                                                )}
                                                                        </div>

                                                                        {alternatives[request.id].suggestions?.suggestions?.length > 0 ? (
                                                                            alternatives[request.id].suggestions.suggestions.map((sug: any, idx: number) => (
                                                                                <div key={idx} style={{
                                                                                    background: 'white',
                                                                                    padding: '16px',
                                                                                    marginBottom: '12px',
                                                                                    borderRadius: '8px',
                                                                                    border: '1px solid #e5e7eb'
                                                                                }}>
                                                                                    <div style={{
                                                                                        display: 'flex',
                                                                                        justifyContent: 'space-between',
                                                                                        alignItems: 'center',
                                                                                        marginBottom: '12px'
                                                                                    }}>
                                                                                        <span style={{
                                                                                            background: '#fee2e2',
                                                                                            color: '#991b1b',
                                                                                            padding: '4px 12px',
                                                                                            borderRadius: '4px',
                                                                                            fontSize: '12px',
                                                                                            fontWeight: '600'
                                                                                        }}>
                                                                                            ⚠️ Shortage: {sug.category === 'seed' ? `${sug.shortage_kg} kg ${sug.original_seed_name}` : `${sug.shortage_bags} bags ${sug.original_fertilizer_name}`}
                                                                                        </span>
                                                                                    </div>

                                                                                    {sug.alternatives?.length > 0 ? (
                                                                                        sug.alternatives.map((alt: any, altIdx: number) => (
                                                                                            <div key={altIdx} style={{
                                                                                                border: '1px solid #d1d5db',
                                                                                                borderRadius: '6px',
                                                                                                padding: '12px',
                                                                                                marginBottom: altIdx < sug.alternatives.length - 1 ? '12px' : '0'
                                                                                            }}>
                                                                                                <div style={{ marginBottom: '8px' }}>
                                                                                                    <strong style={{ color: '#059669', fontSize: '14px' }}>
                                                                                                        Option {altIdx + 1}: {alt.substitute_name}
                                                                                                    </strong>
                                                                                                    <span style={{
                                                                                                        marginLeft: '8px',
                                                                                                        background: alt.confidence_score >= 0.9 ? '#d1fae5' : '#fef3c7',
                                                                                                        color: alt.confidence_score >= 0.9 ? '#065f46' : '#92400e',
                                                                                                        padding: '2px 8px',
                                                                                                        borderRadius: '12px',
                                                                                                        fontSize: '11px',
                                                                                                        fontWeight: '600'
                                                                                                    }}>
                                                                                                        {(alt.confidence_score * 100).toFixed(0)}% Confidence
                                                                                                    </span>
                                                                                                </div>

                                                                                                <p style={{ margin: '8px 0', fontSize: '13px', color: '#374151' }}>
                                                                                                    <strong>Replace:</strong> {sug.category === 'seed' ?
                                                                                                        `${sug.shortage_kg} kg → ${alt.needed_kg} kg ${alt.substitute_name}` :
                                                                                                        `${sug.shortage_bags} bags → ${alt.needed_bags} bags ${alt.substitute_name}`
                                                                                                    }
                                                                                                </p>

                                                                                                <p style={{ margin: '8px 0', fontSize: '13px', color: '#374151' }}>
                                                                                                    <strong>Available:</strong> {sug.category === 'seed' ?
                                                                                                        `${alt.available_kg} kg` :
                                                                                                        `${alt.available_bags} bags`
                                                                                                    }
                                                                                                    {alt.can_fulfill && <span style={{ color: '#059669' }}> ✅ (Sufficient!)</span>}
                                                                                                </p>

                                                                                                {alt.farmer_instructions?.tagalog && (
                                                                                                    <div style={{
                                                                                                        background: '#fef9c3',
                                                                                                        padding: '8px',
                                                                                                        borderRadius: '4px',
                                                                                                        marginTop: '8px',
                                                                                                        fontSize: '12px'
                                                                                                    }}>
                                                                                                        <strong>📋 Instructions:</strong><br />
                                                                                                        {alt.farmer_instructions.tagalog}
                                                                                                    </div>
                                                                                                )}

                                                                                                {alt.cost_note && (
                                                                                                    <p style={{
                                                                                                        margin: '8px 0 0 0',
                                                                                                        fontSize: '12px',
                                                                                                        color: '#dc2626',
                                                                                                        fontStyle: 'italic'
                                                                                                    }}>
                                                                                                        💰 {alt.cost_note}
                                                                                                    </p>
                                                                                                )}
                                                                                            </div>
                                                                                        ))
                                                                                    ) : (
                                                                                        <div style={{
                                                                                            padding: '12px',
                                                                                            background: '#fef2f2',
                                                                                            borderRadius: '6px',
                                                                                            color: '#991b1b'
                                                                                        }}>
                                                                                            ❌ No suitable alternatives available in stock
                                                                                            {sug.recommendation?.next_steps && sug.recommendation.next_steps.length > 0 ? (
                                                                                                <div style={{ margin: '8px 0 0 0', fontSize: '12px' }}>
                                                                                                    <strong>Recommendation:</strong>
                                                                                                    <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px' }}>
                                                                                                        {sug.recommendation.next_steps.map((step: string, idx: number) => (
                                                                                                            <li key={idx}>{step}</li>
                                                                                                        ))}
                                                                                                    </ul>
                                                                                                </div>
                                                                                            ) : (
                                                                                                <p style={{ margin: '8px 0 0 0', fontSize: '12px' }}>
                                                                                                    Recommendation: Request farmer to reduce quantity or reject request
                                                                                                </p>
                                                                                            )}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            ))
                                                                        ) : (
                                                                            <div style={{
                                                                                padding: '16px',
                                                                                background: '#d1fae5',
                                                                                borderRadius: '6px',
                                                                                color: '#065f46'
                                                                            }}>
                                                                                ✅ All requested fertilizers are available in sufficient quantities!
                                                                            </div>
                                                                        )}

                                                                        <button
                                                                            onClick={() => setShowAlternatives(prev => ({ ...prev, [request.id]: false }))}
                                                                            style={{
                                                                                marginTop: '12px',
                                                                                padding: '8px 16px',
                                                                                background: '#6b7280',
                                                                                color: 'white',
                                                                                border: 'none',
                                                                                borderRadius: '4px',
                                                                                cursor: 'pointer',
                                                                                fontSize: '12px'
                                                                            }}
                                                                        >
                                                                            Close
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
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
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '12px',
                        padding: '24px',
                        maxWidth: '600px',
                        width: '90%',
                        maxHeight: '90vh',
                        overflowY: 'auto'
                    }}>
                        <h3 style={{ marginBottom: '20px', fontSize: '20px', fontWeight: '600' }}>Edit Farmer Request</h3>

                        {/* Fertilizers Section */}
                        <div style={{ marginBottom: '24px' }}>
                            <h4 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: '600', color: '#374151' }}>Fertilizers (bags)</h4>
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
                                <div>
                                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#6b7280' }}>Ammonium Sulfate (21-0-0)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editFormData.requested_ammonium_sulfate_bags || 0}
                                        onChange={(e) => setEditFormData({ ...editFormData, requested_ammonium_sulfate_bags: Number(e.target.value) })}
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
                                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#6b7280' }}>Muriate of Potash (0-0-60)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editFormData.requested_muriate_potash_bags || 0}
                                        onChange={(e) => setEditFormData({ ...editFormData, requested_muriate_potash_bags: Number(e.target.value) })}
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

                        {/* Seeds Section */}
                        <div style={{ marginBottom: '24px' }}>
                            <h4 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: '600', color: '#374151' }}>Seeds (kg)</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#6b7280' }}>Request Notes (Optional)</label>
                            <textarea
                                value={editFormData.request_notes || ''}
                                onChange={(e) => setEditFormData({ ...editFormData, request_notes: e.target.value })}
                                rows={3}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '4px',
                                    fontSize: '14px',
                                    resize: 'vertical'
                                }}
                                placeholder="Add any notes about this request..."
                            />
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={handleCancelEdit}
                                style={{
                                    padding: '10px 20px',
                                    background: '#6b7280',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '500'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                style={{
                                    padding: '10px 20px',
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '500'
                                }}
                            >
                                💾 Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default JoManageRequests;
