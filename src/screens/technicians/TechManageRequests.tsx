import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import '../../assets/css/jo css/JoIncentStyle.css';
import '../../assets/css/navigation/nav.css';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import ApproveIcon from '../../assets/images/approve.png';
import FarmerIcon from '../../assets/images/farmer (1).png';
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
    const [showAlternatives, setShowAlternatives] = useState<{ [key: number]: boolean }>({});
    const [alternatives, setAlternatives] = useState<{ [key: number]: any }>({});
    const [loadingAlternatives, setLoadingAlternatives] = useState<{ [key: number]: boolean }>({});

    // DSS Feature: Apply alternatives
    const [selectedAlternative, setSelectedAlternative] = useState<{ [key: number]: { suggestionIdx: number, alternativeIdx: number } }>({});
    const [applyingAlternative, setApplyingAlternative] = useState<{ [key: number]: boolean }>({});

    // Edit Feature
    const [editingRequest, setEditingRequest] = useState<number | null>(null);
    const [editFormData, setEditFormData] = useState<Partial<FarmerRequest>>({});

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
                        await fetchAlternatives(request.id);
                        newSuggestions++;
                    } catch (error) {
                        console.error(`Failed to fetch alternatives for request ${request.id}:`, error);
                    }
                } else {
                    console.log(`✅ Alternatives already loaded for request #${request.id}`);
                }
            }
        }

        console.log(`📈 Summary: ${countWithShortages} requests with shortages, ${newSuggestions} new alternatives fetched`);
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

            const distResponse = await fetch('http://localhost:5000/api/distribution/records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (distResponse.ok) {
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

            const response = await fetch(`http://localhost:5000/api/distribution/requests/${editingRequest}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedRequest)
            });

            if (!response.ok) {
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
            setShowAlternatives(prev => {
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

            console.log('Fetching alternatives for request:', requestId);

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
            const response = await fetch(`http://localhost:5000/api/distribution/requests/${requestId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedRequest)
            });

            if (response.ok) {
                const updatedData = await response.json();

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
                setShowAlternatives(prev => ({ ...prev, [requestId]: false }));
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
            <style>{`
                .shortage-warning {
                    background: #fef3c7;
                    border: 2px solid #f59e0b;
                    padding: 8px 12px;
                    border-radius: 6px;
                    font-size: 12px;
                    color: #92400e;
                    font-weight: 600;
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
                            className={`sidebar-nav-item ${isActive('/technician-farmerprofpage') ? 'active' : ''}`}
                            onClick={() => navigate('/technician-farmerprofpage')}
                        >
                            <span className="nav-icon">
                                <img src={FarmerIcon} alt="Farmer Profile" />
                            </span>
                            <span className="nav-text">Farmers Profile</span>
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
                            {allocation && (
                                <p className="page-subtitle">{formatSeasonName(allocation.season)}</p>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                className="btn-create-allocation"
                                onClick={() => navigate(`/technician-add-farmer-request/${allocationId}`)}
                                style={{
                                    background: '#10b981',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                ➕ Add Farmer Request
                            </button>
                            <button
                                className="btn-create-allocation"
                                onClick={() => navigate('/technician-incentives')}
                            >
                                ← Back to Allocations
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
                                <div style={{ marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                    <input
                                        type="text"
                                        placeholder="🔍 Search farmer or barangay..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{
                                            flex: '1',
                                            minWidth: '250px',
                                            padding: '12px 16px',
                                            border: '2px solid #e5e7eb',
                                            borderRadius: '8px',
                                            fontSize: '14px'
                                        }}
                                    />
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        style={{
                                            padding: '12px 16px',
                                            border: '2px solid #e5e7eb',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            background: 'white'
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
                                            padding: '12px 16px',
                                            border: '2px solid #e5e7eb',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            background: 'white'
                                        }}
                                    >
                                        <option value="all">All Barangays</option>
                                        {getUniqueBarangays().map(brgy => (
                                            <option key={brgy} value={brgy}>{brgy}</option>
                                        ))}
                                    </select>
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

                                    {/* Total Farmer Requests Card */}
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
                                            📊 Total Farmer Requests
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
                                                <span style={{ fontWeight: '500', color: '#92400e' }}>🌱 Total Fertilizers Requested</span>
                                                <span style={{ fontSize: '20px', fontWeight: '700', color: '#92400e' }}>
                                                    {getTotalRequested('requested_urea_bags') +
                                                        getTotalRequested('requested_complete_14_bags') +
                                                        getTotalRequested('requested_ammonium_sulfate_bags') +
                                                        getTotalRequested('requested_muriate_potash_bags')} bags
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
                                                <span style={{ fontWeight: '500', color: '#1e40af' }}>🌾 Total Seeds Requested</span>
                                                <span style={{ fontSize: '20px', fontWeight: '700', color: '#1e40af' }}>
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
                                </div>

                                {/* Summary Stats */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                                    <div style={{ padding: '16px', background: '#f3f4f6', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Total Requests</div>
                                        <div style={{ fontSize: '24px', fontWeight: '700', color: '#1f2937' }}>{filteredRequests.length}</div>
                                    </div>
                                    <div style={{ padding: '16px', background: '#fef3c7', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '12px', color: '#92400e', marginBottom: '4px' }}>Pending</div>
                                        <div style={{ fontSize: '24px', fontWeight: '700', color: '#92400e' }}>
                                            {filteredRequests.filter(r => r.status === 'pending').length}
                                        </div>
                                    </div>
                                    <div style={{ padding: '16px', background: '#d1fae5', borderRadius: '8px' }}>
                                        <div style={{ fontSize: '12px', color: '#065f46', marginBottom: '4px' }}>Approved</div>
                                        <div style={{ fontSize: '24px', fontWeight: '700', color: '#065f46' }}>
                                            {filteredRequests.filter(r => r.status === 'approved').length}
                                        </div>
                                    </div>
                                </div>

                                {/* Requests Table */}
                                {filteredRequests.length === 0 ? (
                                    <div className="empty-state">
                                        <div className="empty-icon">📋</div>
                                        <h3>No Requests Found</h3>
                                        <p>No farmer requests match your filters</p>
                                    </div>
                                ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>Farmer</th>
                                                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>Barangay</th>
                                                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', fontSize: '14px' }}>Status</th>
                                                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', fontSize: '14px' }}>Fertilizers (bags)</th>
                                                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', fontSize: '14px' }}>Seeds (kg)</th>
                                                    <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', fontSize: '14px' }}>Actions</th>
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
                                                    const hasAlternatives = alternatives[request.id];
                                                    const isLoadingAlt = loadingAlternatives[request.id];

                                                    return (
                                                        <React.Fragment key={request.id}>
                                                            <tr style={{ borderBottom: '1px solid #e5e7eb', background: hasShortage ? '#fef3c7' : 'transparent' }}>
                                                                <td style={{ padding: '12px', fontSize: '14px', fontWeight: '600' }}>
                                                                    {request.farmer_name}
                                                                    {hasShortage && request.status === 'pending' && (
                                                                        <div style={{ fontSize: '11px', color: '#d97706', marginTop: '4px' }}>
                                                                            ⚠️ Shortage detected
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td style={{ padding: '12px', fontSize: '14px' }}>{request.barangay}</td>
                                                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                                                    <span style={{
                                                                        padding: '4px 12px',
                                                                        borderRadius: '12px',
                                                                        fontSize: '12px',
                                                                        fontWeight: '600',
                                                                        background: request.status === 'approved' ? '#d1fae5' : request.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                                                                        color: request.status === 'approved' ? '#065f46' : request.status === 'rejected' ? '#991b1b' : '#92400e'
                                                                    }}>
                                                                        {request.status}
                                                                    </span>
                                                                </td>
                                                                <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px' }}>{totalFertilizer.toFixed(2)}</td>
                                                                <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px' }}>{totalSeeds.toFixed(2)}</td>
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
                                                                                        borderRadius: '6px',
                                                                                        cursor: 'pointer',
                                                                                        fontSize: '12px',
                                                                                        fontWeight: '600'
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
                                                                                        borderRadius: '6px',
                                                                                        cursor: 'pointer',
                                                                                        fontSize: '12px',
                                                                                        fontWeight: '600'
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
                                                                                        borderRadius: '6px',
                                                                                        cursor: 'pointer',
                                                                                        fontSize: '12px',
                                                                                        fontWeight: '600'
                                                                                    }}
                                                                                >
                                                                                    ✕ Reject
                                                                                </button>
                                                                                {hasShortage && hasAlternatives && (
                                                                                    <button
                                                                                        onClick={() => toggleAlternatives(request.id)}
                                                                                        disabled={isLoadingAlt}
                                                                                        style={{
                                                                                            padding: '6px 12px',
                                                                                            background: showAlternatives[request.id] ? '#7c3aed' : '#8b5cf6',
                                                                                            color: 'white',
                                                                                            border: 'none',
                                                                                            borderRadius: '6px',
                                                                                            cursor: isLoadingAlt ? 'wait' : 'pointer',
                                                                                            fontSize: '12px',
                                                                                            fontWeight: '600',
                                                                                            opacity: isLoadingAlt ? 0.6 : 1
                                                                                        }}
                                                                                    >
                                                                                        {isLoadingAlt ? '⏳ Loading...' : showAlternatives[request.id] ? '🔼 Hide' : '🔽 Show'} Alternatives
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
                                                                                borderRadius: '6px',
                                                                                cursor: 'pointer',
                                                                                fontSize: '12px',
                                                                                fontWeight: '600'
                                                                            }}
                                                                        >
                                                                            🗑️ Delete
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                            {/* Alternatives Panel */}
                                                            {showAlternatives[request.id] && hasAlternatives && (
                                                                <tr>
                                                                    <td colSpan={6} style={{ padding: '0', background: '#f9fafb' }}>
                                                                        <div style={{
                                                                            padding: '20px',
                                                                            border: '2px solid #8b5cf6',
                                                                            margin: '8px',
                                                                            borderRadius: '8px',
                                                                            background: 'linear-gradient(to right, #faf5ff, #f3e8ff)'
                                                                        }}>
                                                                            <h4 style={{ margin: '0 0 16px 0', color: '#6b21a8', fontSize: '16px', fontWeight: '700' }}>
                                                                                Alternative Suggestions
                                                                            </h4>

                                                                            {hasAlternatives.suggestions?.suggestions && hasAlternatives.suggestions.suggestions.length > 0 && (
                                                                                hasAlternatives.suggestions.suggestions.map((suggestion: any, idx: number) => (
                                                                                    <div key={idx} style={{
                                                                                        background: 'white',
                                                                                        padding: '16px',
                                                                                        borderRadius: '8px',
                                                                                        marginBottom: '12px',
                                                                                        border: '1px solid #e9d5ff'
                                                                                    }}>
                                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                                                            <div>
                                                                                                <strong style={{ color: '#dc2626' }}>⚠️ Shortage:</strong> {suggestion.original_fertilizer_name}
                                                                                                <span style={{ color: '#dc2626', fontWeight: '700', marginLeft: '8px' }}>
                                                                                                    {suggestion.shortage_bags} bags
                                                                                                </span>
                                                                                            </div>
                                                                                        </div>

                                                                                        {suggestion.alternatives && suggestion.alternatives.length > 0 ? (
                                                                                            <div style={{ marginTop: '12px' }}>
                                                                                                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#6b21a8' }}>
                                                                                                    Select Alternative:
                                                                                                </label>
                                                                                                <select
                                                                                                    onChange={(e) => {
                                                                                                        const altIdx = parseInt(e.target.value);
                                                                                                        if (!isNaN(altIdx)) {
                                                                                                            setSelectedAlternative(prev => ({
                                                                                                                ...prev,
                                                                                                                [request.id]: { suggestionIdx: idx, alternativeIdx: altIdx }
                                                                                                            }));
                                                                                                        }
                                                                                                    }}
                                                                                                    style={{
                                                                                                        width: '100%',
                                                                                                        padding: '10px',
                                                                                                        border: '2px solid #c4b5fd',
                                                                                                        borderRadius: '6px',
                                                                                                        fontSize: '14px'
                                                                                                    }}
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

                                                                                                {selectedAlternative[request.id]?.suggestionIdx === idx && suggestion.alternatives[selectedAlternative[request.id].alternativeIdx] && (
                                                                                                    <div style={{
                                                                                                        marginTop: '12px',
                                                                                                        padding: '12px',
                                                                                                        background: '#f0fdf4',
                                                                                                        border: '1px solid #86efac',
                                                                                                        borderRadius: '6px'
                                                                                                    }}>
                                                                                                        <div style={{ fontSize: '13px', color: '#15803d' }}>
                                                                                                            <strong>Selected Alternative:</strong>
                                                                                                            <div style={{ marginTop: '8px' }}>
                                                                                                                • Substitute: {suggestion.alternatives[selectedAlternative[request.id].alternativeIdx].substitute_name}<br />
                                                                                                                • Amount needed: {suggestion.alternatives[selectedAlternative[request.id].alternativeIdx].needed_bags} bags<br />
                                                                                                                • Available: {suggestion.alternatives[selectedAlternative[request.id].alternativeIdx].available_bags} bags<br />
                                                                                                                • Confidence: {(suggestion.alternatives[selectedAlternative[request.id].alternativeIdx].confidence_score * 100).toFixed(0)}%
                                                                                                            </div>
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
                                                                                                marginTop: '12px'
                                                                                            }}>
                                                                                                ❌ No suitable alternatives available in stock
                                                                                                {suggestion.recommendation?.next_steps && suggestion.recommendation.next_steps.length > 0 ? (
                                                                                                    <div style={{ margin: '8px 0 0 0', fontSize: '12px' }}>
                                                                                                        <strong>Recommendation:</strong>
                                                                                                        <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px' }}>
                                                                                                            {suggestion.recommendation.next_steps.map((step: string, stepIdx: number) => (
                                                                                                                <li key={stepIdx}>{step}</li>
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
                                                                            )}                                                                            {hasAlternatives.suggestions?.suggestions?.some((s: any) => s.alternatives && s.alternatives.length > 0) && (
                                                                                <button
                                                                                    onClick={() => applyAlternative(request.id)}
                                                                                    disabled={!selectedAlternative[request.id] || applyingAlternative[request.id]}
                                                                                    style={{
                                                                                        padding: '12px 24px',
                                                                                        background: selectedAlternative[request.id] && !applyingAlternative[request.id] ? '#7c3aed' : '#cbd5e1',
                                                                                        color: 'white',
                                                                                        border: 'none',
                                                                                        borderRadius: '8px',
                                                                                        cursor: selectedAlternative[request.id] && !applyingAlternative[request.id] ? 'pointer' : 'not-allowed',
                                                                                        fontSize: '14px',
                                                                                        fontWeight: '700',
                                                                                        marginTop: '12px'
                                                                                    }}
                                                                                >
                                                                                    {applyingAlternative[request.id] ? '⏳ Applying...' : '✅ Apply Selected Alternative'}
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
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
                        maxHeight: '80vh',
                        overflowY: 'auto'
                    }}>
                        <h3 style={{ marginBottom: '20px', fontSize: '20px', fontWeight: '700' }}>Edit Farmer Request</h3>

                        {/* Fertilizers */}
                        <div style={{ marginBottom: '20px' }}>
                            <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Fertilizers (bags)</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px' }}>Urea (46-0-0)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editFormData.requested_urea_bags || 0}
                                        onChange={(e) => setEditFormData({ ...editFormData, requested_urea_bags: parseFloat(e.target.value) || 0 })}
                                        style={{ width: '100%', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px' }}>Complete (14-14-14)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editFormData.requested_complete_14_bags || 0}
                                        onChange={(e) => setEditFormData({ ...editFormData, requested_complete_14_bags: parseFloat(e.target.value) || 0 })}
                                        style={{ width: '100%', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px' }}>Ammonium Sulfate</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editFormData.requested_ammonium_sulfate_bags || 0}
                                        onChange={(e) => setEditFormData({ ...editFormData, requested_ammonium_sulfate_bags: parseFloat(e.target.value) || 0 })}
                                        style={{ width: '100%', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px' }}>Muriate of Potash</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editFormData.requested_muriate_potash_bags || 0}
                                        onChange={(e) => setEditFormData({ ...editFormData, requested_muriate_potash_bags: parseFloat(e.target.value) || 0 })}
                                        style={{ width: '100%', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Seeds */}
                        <div style={{ marginBottom: '20px' }}>
                            <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Seeds (kg)</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px' }}>Jackpot</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editFormData.requested_jackpot_kg || 0}
                                        onChange={(e) => setEditFormData({ ...editFormData, requested_jackpot_kg: parseFloat(e.target.value) || 0 })}
                                        style={{ width: '100%', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px' }}>US88</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editFormData.requested_us88_kg || 0}
                                        onChange={(e) => setEditFormData({ ...editFormData, requested_us88_kg: parseFloat(e.target.value) || 0 })}
                                        style={{ width: '100%', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px' }}>TH82</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editFormData.requested_th82_kg || 0}
                                        onChange={(e) => setEditFormData({ ...editFormData, requested_th82_kg: parseFloat(e.target.value) || 0 })}
                                        style={{ width: '100%', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px' }}>RH9000</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editFormData.requested_rh9000_kg || 0}
                                        onChange={(e) => setEditFormData({ ...editFormData, requested_rh9000_kg: parseFloat(e.target.value) || 0 })}
                                        style={{ width: '100%', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px' }}>Lumping143</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editFormData.requested_lumping143_kg || 0}
                                        onChange={(e) => setEditFormData({ ...editFormData, requested_lumping143_kg: parseFloat(e.target.value) || 0 })}
                                        style={{ width: '100%', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px' }}>LP296</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editFormData.requested_lp296_kg || 0}
                                        onChange={(e) => setEditFormData({ ...editFormData, requested_lp296_kg: parseFloat(e.target.value) || 0 })}
                                        style={{ width: '100%', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Notes */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '14px', marginBottom: '4px' }}>Notes</label>
                            <textarea
                                value={editFormData.request_notes || ''}
                                onChange={(e) => setEditFormData({ ...editFormData, request_notes: e.target.value })}
                                rows={3}
                                style={{ width: '100%', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px', resize: 'vertical' }}
                            />
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={handleCancelEdit}
                                style={{
                                    padding: '10px 20px',
                                    background: '#e5e7eb',
                                    color: '#374151',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '600'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                style={{
                                    padding: '10px 20px',
                                    background: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '600'
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

export default TechManageRequests;
