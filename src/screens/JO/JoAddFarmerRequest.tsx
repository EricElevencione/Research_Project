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

interface Farmer {
    id: number;
    rsbsa_no: string;
    first_name: string;
    middle_name: string;
    last_name: string;
    extension_name: string;
    barangay: string;
}

interface AllocationDetails {
    id: number;
    season: string;
    allocation_date: string;
}

interface FarmerRequestForm {
    farmer_id: number;
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
    priority_score: number;
    notes: string;
}

const JoAddFarmerRequest: React.FC = () => {
    const navigate = useNavigate();
    const { allocationId } = useParams<{ allocationId: string }>();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [allocation, setAllocation] = useState<AllocationDetails | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [formData, setFormData] = useState<FarmerRequestForm>({
        farmer_id: 0,
        requested_urea_bags: 0,
        requested_complete_14_bags: 0,
        requested_ammonium_sulfate_bags: 0,
        requested_muriate_potash_bags: 0,
        requested_jackpot_kg: 0,
        requested_us88_kg: 0,
        requested_th82_kg: 0,
        requested_rh9000_kg: 0,
        requested_lumping143_kg: 0,
        requested_lp296_kg: 0,
        priority_score: 5,
        notes: ''
    });

    const isActive = (path: string) => location.pathname === path;

    const handleLogout = () => {
        localStorage.removeItem('isAuthenticated');
        navigate('/login');
    };

    useEffect(() => {
        fetchAllocation();
        fetchFarmers();
    }, [allocationId]);

    const fetchAllocation = async () => {
        try {
            console.log('🔍 Fetching allocation for ID:', allocationId, 'Type:', typeof allocationId);
            const response = await fetch(`http://localhost:5000/api/distribution/allocations`);
            if (response.ok) {
                const allocations = await response.json();
                console.log('📦 All allocations returned:', allocations.length, 'allocations');
                console.log('📋 Allocation IDs:', allocations.map((a: any) => ({ id: a.id, season: a.season, type: typeof a.id })));

                const targetId = parseInt(allocationId || '0');
                console.log('🎯 Looking for ID:', targetId);

                const found = allocations.find((a: any) => {
                    console.log(`Comparing: ${a.id} (${typeof a.id}) === ${targetId} (${typeof targetId}) = ${a.id === targetId}`);
                    return a.id === targetId;
                });

                console.log('✅ Found allocation:', found);
                setAllocation(found || null);
                if (!found) {
                    setError(`Allocation with ID ${allocationId} not found in database`);
                }
            } else {
                console.error('❌ Response not OK:', response.status, response.statusText);
                setError('Failed to fetch allocation data');
            }
        } catch (err) {
            console.error('❌ Failed to fetch allocation:', err);
            setError('Error loading allocation data');
        }
    };

    const fetchFarmers = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/rsbsa_submission');
            if (response.ok) {
                const data = await response.json();
                console.log('Fetched farmers data:', data.slice(0, 2)); // Debug first 2 records

                // Transform data to match Farmer interface
                const transformedFarmers = data
                    .filter((item: any) => {
                        const status = String(item.status ?? '').toLowerCase().trim();
                        return status !== 'no parcels';
                    })
                    .map((item: any) => {
                        // Backend already provides farmerName as formatted string "Last, First Middle"
                        // We need to parse it back to individual components
                        const nameParts = (item.farmerName || '').split(', ');
                        const lastName = nameParts[0] || '';
                        const firstAndMiddle = nameParts[1] || '';
                        const [firstName, ...middleNameParts] = firstAndMiddle.split(' ');

                        // Extract barangay from farmerAddress (format: "Barangay, Municipality")
                        const addressParts = (item.farmerAddress || '').split(', ');
                        const barangay = addressParts[0] || '';

                        return {
                            id: item.id,
                            rsbsa_no: item.referenceNumber || `RSBSA-${item.id}`,
                            first_name: firstName || '',
                            middle_name: middleNameParts.join(' ') || '',
                            last_name: lastName,
                            extension_name: '',
                            barangay: barangay
                        };
                    });
                console.log('Transformed farmers:', transformedFarmers.slice(0, 2)); // Debug
                setFarmers(transformedFarmers);
            }
        } catch (err) {
            console.error('Failed to fetch farmers:', err);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'farmer_id' || name === 'priority_score' || name.includes('requested_')
                ? parseFloat(value) || 0
                : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.farmer_id) {
            setError('Please select a farmer');
            return;
        }

        // Check if allocation is loaded
        if (!allocation || !allocation.season) {
            console.error('Allocation not loaded:', allocation);
            setError('Allocation data not loaded. Please refresh the page.');
            return;
        }

        // Get selected farmer details - compare as numbers
        const selectedFarmer = farmers.find(f => Number(f.id) === Number(formData.farmer_id));
        if (!selectedFarmer) {
            console.error('Farmer not found. Looking for ID:', formData.farmer_id, 'Type:', typeof formData.farmer_id);
            console.error('Available farmers:', farmers.map(f => ({ id: f.id, type: typeof f.id, name: f.last_name })));
            setError('Selected farmer not found');
            return;
        }

        const farmerFullName = `${selectedFarmer.last_name}, ${selectedFarmer.first_name} ${selectedFarmer.middle_name || ''}`.trim();

        setLoading(true);
        setError(null);

        try {
            // Calculate totals for fertilizer and seeds
            const totalFertilizerRequested = (
                formData.requested_urea_bags +
                formData.requested_complete_14_bags +
                formData.requested_ammonium_sulfate_bags +
                formData.requested_muriate_potash_bags
            );

            const totalSeedsRequested = (
                formData.requested_jackpot_kg +
                formData.requested_us88_kg +
                formData.requested_th82_kg +
                formData.requested_rh9000_kg +
                formData.requested_lumping143_kg +
                formData.requested_lp296_kg
            );

            const response = await fetch('http://localhost:5000/api/distribution/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    season: allocation?.season,
                    farmer_id: formData.farmer_id,
                    farmer_name: farmerFullName,
                    barangay: selectedFarmer.barangay,
                    farm_area_ha: 0, // Default, can be updated later
                    crop_type: 'Rice', // Default
                    ownership_type: 'Owner', // Default
                    num_parcels: 1,
                    fertilizer_requested: totalFertilizerRequested > 0,
                    seeds_requested: totalSeedsRequested > 0,
                    request_notes: formData.notes || null,
                    created_by: null,
                    // Detailed fertilizer amounts
                    requested_urea_bags: formData.requested_urea_bags,
                    requested_complete_14_bags: formData.requested_complete_14_bags,
                    requested_ammonium_sulfate_bags: formData.requested_ammonium_sulfate_bags,
                    requested_muriate_potash_bags: formData.requested_muriate_potash_bags,
                    // Detailed seed amounts
                    requested_jackpot_kg: formData.requested_jackpot_kg,
                    requested_us88_kg: formData.requested_us88_kg,
                    requested_th82_kg: formData.requested_th82_kg,
                    requested_rh9000_kg: formData.requested_rh9000_kg,
                    requested_lumping143_kg: formData.requested_lumping143_kg,
                    requested_lp296_kg: formData.requested_lp296_kg
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to save farmer request');
            }

            alert('✅ Farmer request added successfully!');
            navigate('/jo-incentives');
        } catch (err: any) {
            setError(err.message || 'Failed to save farmer request');
        } finally {
            setLoading(false);
        }
    };

    const filteredFarmers = farmers.filter(farmer => {
        const searchLower = searchTerm.toLowerCase();
        const fullName = `${farmer.first_name} ${farmer.middle_name} ${farmer.last_name}`.toLowerCase();
        const rsbsa = farmer.rsbsa_no?.toLowerCase() || '';
        return fullName.includes(searchLower) || rsbsa.includes(searchLower);
    });

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
                        <h2 className="page-header">➕ Add Farmer Request</h2>
                        <p className="page-subtitle">
                            {allocation ? `Season: ${allocation.season.replace('_', ' ').toUpperCase()}` : 'Loading...'}
                        </p>
                    </div>

                    <div className="content-card-incent">
                        <form onSubmit={handleSubmit}>
                            {/* Farmer Selection */}
                            <div style={{ marginBottom: '32px' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#1f2937' }}>
                                    Select Farmer
                                </h3>
                                <div style={{ marginBottom: '12px' }}>
                                    <input
                                        type="text"
                                        placeholder="🔍 Search by name or RSBSA number..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '6px',
                                            fontSize: '14px',
                                            marginBottom: '8px'
                                        }}
                                    />
                                </div>
                                <style>
                                    {`
                                        select[name="farmer_id"] option:checked,
                                        select[name="farmer_id"] option:hover {
                                            background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
                                            color: white !important;
                                        }
                                        select[name="farmer_id"] option {
                                            padding: 8px;
                                        }
                                    `}
                                </style>
                                <select
                                    name="farmer_id"
                                    value={formData.farmer_id}
                                    onChange={handleInputChange}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '6px',
                                        fontSize: '14px',
                                        maxHeight: '200px'
                                    }}
                                    size={8}
                                >
                                    <option value="">-- Select Farmer --</option>
                                    {filteredFarmers.map(farmer => (
                                        <option key={farmer.id} value={farmer.id}>
                                            {farmer.last_name}, {farmer.first_name} {farmer.middle_name ? farmer.middle_name + ' ' : ''}
                                            {farmer.extension_name ? farmer.extension_name + ' ' : ''}
                                            ({farmer.barangay}) - RSBSA: {farmer.rsbsa_no}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Fertilizer Requests */}
                            <div style={{ marginBottom: '32px' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#1f2937' }}>
                                    🌱 Requested Fertilizers (bags)
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                                            Urea (46-0-0)
                                        </label>
                                        <input
                                            type="number"
                                            name="requested_urea_bags"
                                            value={formData.requested_urea_bags}
                                            onChange={handleInputChange}
                                            min="0"
                                            step="0.01"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '6px',
                                                fontSize: '14px'
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                                            Complete (14-14-14)
                                        </label>
                                        <input
                                            type="number"
                                            name="requested_complete_14_bags"
                                            value={formData.requested_complete_14_bags}
                                            onChange={handleInputChange}
                                            min="0"
                                            step="0.01"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '6px',
                                                fontSize: '14px'
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                                            Ammonium Sulfate (21-0-0)
                                        </label>
                                        <input
                                            type="number"
                                            name="requested_ammonium_sulfate_bags"
                                            value={formData.requested_ammonium_sulfate_bags}
                                            onChange={handleInputChange}
                                            min="0"
                                            step="0.01"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '6px',
                                                fontSize: '14px'
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                                            Muriate of Potash (0-0-60)
                                        </label>
                                        <input
                                            type="number"
                                            name="requested_muriate_potash_bags"
                                            value={formData.requested_muriate_potash_bags}
                                            onChange={handleInputChange}
                                            min="0"
                                            step="0.01"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '6px',
                                                fontSize: '14px'
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Seed Requests */}
                            <div style={{ marginBottom: '32px' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#1f2937' }}>
                                    🌾 Requested Seeds (kg)
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                                            Jackpot
                                        </label>
                                        <input
                                            type="number"
                                            name="requested_jackpot_kg"
                                            value={formData.requested_jackpot_kg}
                                            onChange={handleInputChange}
                                            min="0"
                                            step="0.01"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '6px',
                                                fontSize: '14px'
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                                            US88
                                        </label>
                                        <input
                                            type="number"
                                            name="requested_us88_kg"
                                            value={formData.requested_us88_kg}
                                            onChange={handleInputChange}
                                            min="0"
                                            step="0.01"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '6px',
                                                fontSize: '14px'
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                                            TH82
                                        </label>
                                        <input
                                            type="number"
                                            name="requested_th82_kg"
                                            value={formData.requested_th82_kg}
                                            onChange={handleInputChange}
                                            min="0"
                                            step="0.01"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '6px',
                                                fontSize: '14px'
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                                            RH9000
                                        </label>
                                        <input
                                            type="number"
                                            name="requested_rh9000_kg"
                                            value={formData.requested_rh9000_kg}
                                            onChange={handleInputChange}
                                            min="0"
                                            step="0.01"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '6px',
                                                fontSize: '14px'
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                                            Lumping143
                                        </label>
                                        <input
                                            type="number"
                                            name="requested_lumping143_kg"
                                            value={formData.requested_lumping143_kg}
                                            onChange={handleInputChange}
                                            min="0"
                                            step="0.01"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '6px',
                                                fontSize: '14px'
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                                            LP296
                                        </label>
                                        <input
                                            type="number"
                                            name="requested_lp296_kg"
                                            value={formData.requested_lp296_kg}
                                            onChange={handleInputChange}
                                            min="0"
                                            step="0.01"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '6px',
                                                fontSize: '14px'
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Priority and Notes */}
                            <div style={{ marginBottom: '32px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '16px', marginBottom: '16px' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                                            Priority Score (1-10)
                                        </label>
                                        <input
                                            type="number"
                                            name="priority_score"
                                            value={formData.priority_score}
                                            onChange={handleInputChange}
                                            min="1"
                                            max="10"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                border: '1px solid #d1d5db',
                                                borderRadius: '6px',
                                                fontSize: '14px'
                                            }}
                                        />
                                    </div>
                                </div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                                    Notes / Remarks
                                </label>
                                <textarea
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleInputChange}
                                    rows={3}
                                    placeholder="Add any additional notes..."
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '6px',
                                        fontSize: '14px',
                                        fontFamily: 'inherit'
                                    }}
                                />
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div style={{
                                    padding: '12px',
                                    marginBottom: '16px',
                                    backgroundColor: '#fee2e2',
                                    border: '1px solid #ef4444',
                                    borderRadius: '6px',
                                    color: '#991b1b'
                                }}>
                                    {error}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    onClick={() => navigate('/jo-incentives')}
                                    style={{
                                        padding: '12px 24px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '8px',
                                        fontSize: '15px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        backgroundColor: 'white',
                                        color: '#374151'
                                    }}
                                    disabled={loading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    style={{
                                        background: loading ? '#9ca3af' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        color: 'white',
                                        padding: '12px 24px',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontSize: '15px',
                                        fontWeight: '600',
                                        cursor: loading ? 'not-allowed' : 'pointer',
                                        boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)'
                                    }}
                                    disabled={loading}
                                >
                                    {loading ? '💾 Saving...' : '✅ Add Farmer Request'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JoAddFarmerRequest;
