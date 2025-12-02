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
import FarmerIcon from '../../assets/images/farmer (1).png';

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
    notes: string;
}

const TechAddFarmerRequest: React.FC = () => {
    const navigate = useNavigate();
    const { allocationId } = useParams<{ allocationId: string }>();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [allocation, setAllocation] = useState<AllocationDetails | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [existingRequests, setExistingRequests] = useState<number[]>([]);

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

    useEffect(() => {
        if (allocation?.season) {
            fetchExistingRequests();
        }
    }, [allocation]);

    const fetchAllocation = async () => {
        try {
            const response = await fetch(`http://localhost:5000/api/distribution/allocations`);
            if (response.ok) {
                const allocations = await response.json();
                const targetId = parseInt(allocationId || '0');
                const found = allocations.find((a: any) => a.id === targetId);
                setAllocation(found || null);
                if (!found) {
                    setError(`Allocation with ID ${allocationId} not found`);
                }
            } else {
                setError('Failed to fetch allocation data');
            }
        } catch (err) {
            console.error('Failed to fetch allocation:', err);
            setError('Error loading allocation data');
        }
    };

    const fetchExistingRequests = async () => {
        if (!allocation?.season) return;

        try {
            const response = await fetch(`http://localhost:5000/api/distribution/requests/${allocation.season}`);
            if (response.ok) {
                const requests = await response.json();
                const farmerIds = requests.map((req: any) => Number(req.farmer_id));
                setExistingRequests(farmerIds);
            }
        } catch (err) {
            console.error('Failed to fetch existing requests:', err);
        }
    };

    const fetchFarmers = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/rsbsa_submission');
            if (response.ok) {
                const data = await response.json();
                const transformedFarmers = data
                    .filter((item: any) => {
                        const status = String(item.status ?? '').toLowerCase().trim();
                        // Only show active farmers - exclude 'no parcels' and non-active statuses
                        return status !== 'no parcels' && status === 'active farmer';
                    })
                    .map((item: any) => {
                        const nameParts = (item.farmerName || '').split(', ');
                        const lastName = nameParts[0] || '';
                        const firstAndMiddle = nameParts[1] || '';
                        const [firstName, ...middleNameParts] = firstAndMiddle.split(' ');
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
            [name]: name === 'farmer_id' || name.includes('requested_')
                ? (value === '' ? 0 : parseFloat(value))
                : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.farmer_id) {
            setError('Please select a farmer');
            return;
        }

        if (!allocation || !allocation.season) {
            setError('Allocation data not loaded. Please refresh the page.');
            return;
        }

        const selectedFarmer = farmers.find(f => Number(f.id) === Number(formData.farmer_id));
        if (!selectedFarmer) {
            setError('Selected farmer not found');
            return;
        }

        const farmerFullName = `${selectedFarmer.last_name}, ${selectedFarmer.first_name} ${selectedFarmer.middle_name || ''}`.trim();

        setLoading(true);
        setError(null);

        try {
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
                    farm_area_ha: 0,
                    crop_type: 'Rice',
                    ownership_type: 'Owner',
                    num_parcels: 1,
                    fertilizer_requested: totalFertilizerRequested > 0,
                    seeds_requested: totalSeedsRequested > 0,
                    request_notes: formData.notes || null,
                    created_by: null,
                    requested_urea_bags: formData.requested_urea_bags,
                    requested_complete_14_bags: formData.requested_complete_14_bags,
                    requested_ammonium_sulfate_bags: formData.requested_ammonium_sulfate_bags,
                    requested_muriate_potash_bags: formData.requested_muriate_potash_bags,
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
            navigate(`/technician-manage-requests/${allocationId}`);
        } catch (err: any) {
            setError(err.message || 'Failed to save farmer request');
        } finally {
            setLoading(false);
        }
    };

    const filteredFarmers = farmers.filter(farmer => {
        if (existingRequests.includes(Number(farmer.id))) {
            return false;
        }

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
                                <img src={MasterlistIcon} alt="Masterlist" />
                            </span>
                            <span className="nav-text">Masterlist</span>
                        </button>

                        <button
                            className={`sidebar-nav-item ${isActive('/technician-farmerprofpage') ? 'active' : ''}`}
                            onClick={() => navigate('/technician-farmerprofpage')}
                        >
                            <span className="nav-icon">
                                <img src={FarmerIcon} alt="farmerProf" />
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
                        <h2 className="page-header">➕ Add Farmer Request</h2>
                        <p className="page-subtitle">
                            {allocation ? `Season: ${allocation.season.replace('_', ' ').toUpperCase()}` : 'Loading...'}
                        </p>
                        <button
                            className="btn-create-allocation"
                            onClick={() => navigate(`/technician-manage-requests/${allocationId}`)}
                        >
                            ← Back to Manage Requests
                        </button>
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
                                    {existingRequests.length > 0 && (
                                        <div style={{
                                            padding: '8px 12px',
                                            background: '#fef3c7',
                                            border: '1px solid #f59e0b',
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                            color: '#92400e',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}>
                                            <span>ℹ️</span>
                                            <span>
                                                {existingRequests.length} farmer{existingRequests.length !== 1 ? 's' : ''} hidden (already have request{existingRequests.length !== 1 ? 's' : ''} for this season)
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div style={{
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px',
                                    maxHeight: '300px',
                                    overflowY: 'auto',
                                    backgroundColor: '#f9fafb'
                                }}>
                                    {filteredFarmers.length === 0 ? (
                                        <div style={{
                                            padding: '24px',
                                            textAlign: 'center',
                                            color: '#6b7280'
                                        }}>
                                            No farmers found
                                        </div>
                                    ) : (
                                        filteredFarmers.map(farmer => (
                                            <label
                                                key={farmer.id}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    padding: '12px 16px',
                                                    borderBottom: '1px solid #e5e7eb',
                                                    cursor: 'pointer',
                                                    transition: 'background-color 0.2s',
                                                    backgroundColor: Number(formData.farmer_id) === Number(farmer.id) ? '#d1fae5' : 'white'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (Number(formData.farmer_id) !== Number(farmer.id)) {
                                                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (Number(formData.farmer_id) !== Number(farmer.id)) {
                                                        e.currentTarget.style.backgroundColor = 'white';
                                                    }
                                                }}
                                                onClick={() => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        farmer_id: Number(farmer.id)
                                                    }));
                                                }}
                                            >
                                                <input
                                                    type="radio"
                                                    name="farmer_id"
                                                    value={farmer.id}
                                                    checked={Number(formData.farmer_id) === Number(farmer.id)}
                                                    onChange={() => { }}
                                                    style={{
                                                        width: '18px',
                                                        height: '18px',
                                                        marginRight: '12px',
                                                        cursor: 'pointer',
                                                        accentColor: '#10b981'
                                                    }}
                                                />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{
                                                        fontWeight: '500',
                                                        color: '#1f2937',
                                                        marginBottom: '2px'
                                                    }}>
                                                        {farmer.last_name}, {farmer.first_name} {farmer.middle_name ? farmer.middle_name + ' ' : ''}
                                                        {farmer.extension_name ? farmer.extension_name + ' ' : ''}
                                                    </div>
                                                    <div style={{
                                                        fontSize: '13px',
                                                        color: '#6b7280'
                                                    }}>
                                                        📍 {farmer.barangay} • RSBSA: {farmer.rsbsa_no}
                                                    </div>
                                                </div>
                                            </label>
                                        ))
                                    )}
                                </div>
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
                                    {['Jackpot', 'US88', 'TH82', 'RH9000', 'Lumping143', 'LP296'].map((seedType) => (
                                        <div key={seedType}>
                                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>
                                                {seedType}
                                            </label>
                                            <input
                                                type="number"
                                                name={`requested_${seedType.toLowerCase()}_kg`}
                                                value={(formData as any)[`requested_${seedType.toLowerCase()}_kg`]}
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
                                    ))}
                                </div>
                            </div>

                            {/* Notes */}
                            <div style={{ marginBottom: '32px' }}>
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
                                    onClick={() => navigate(`/technician-manage-requests/${allocationId}`)}
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

export default TechAddFarmerRequest;
