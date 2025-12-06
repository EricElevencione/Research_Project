import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import '../../assets/css/jo css/JoAddFarmerRequestStyle.css';
import '../../components/layout/sidebarStyle.css';
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

const JoAddFarmerRequest: React.FC = () => {
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
            navigate(`/jo-manage-requests/${allocationId}`);
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
        <div className="jo-add-farmer-page-container">
            <div className="jo-add-farmer-page">
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
                            className={`sidebar-nav-item ${isActive('/jo-rsbsa') ? 'active' : ''}`}
                            onClick={() => navigate('/jo-rsbsa')}
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
                <div className="jo-add-farmer-main-content">
                    <div className="jo-add-farmer-header">
                        <h2 className="jo-add-farmer-title">➕ Add Farmer Request</h2>
                        <p className="jo-add-farmer-subtitle">
                            {allocation ? `Season: ${allocation.season.replace('_', ' ').toUpperCase()}` : 'Loading...'}
                        </p>
                        <button
                            className="jo-add-farmer-back-btn"
                            onClick={() => navigate(`/jo-manage-requests/${allocationId}`)}
                        >
                            ← Back to Manage Requests
                        </button>
                    </div>

                    <div className="jo-add-farmer-content-card">
                        <form onSubmit={handleSubmit}>
                            {/* Farmer Selection */}
                            <div className="jo-add-farmer-section">
                                <h3 className="jo-add-farmer-section-title">
                                    Select Farmer
                                </h3>
                                <div className="jo-add-farmer-search-container">
                                    <input
                                        type="text"
                                        placeholder="🔍 Search by name or RSBSA number..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="jo-add-farmer-search-input"
                                    />
                                    {existingRequests.length > 0 && (
                                        <div className="jo-add-farmer-info-box">
                                            <span>ℹ️</span>
                                            <span>
                                                {existingRequests.length} farmer{existingRequests.length !== 1 ? 's' : ''} hidden (already have request{existingRequests.length !== 1 ? 's' : ''} for this season)
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="jo-add-farmer-list-container">
                                    {filteredFarmers.length === 0 ? (
                                        <div className="jo-add-farmer-empty-state">
                                            No farmers found
                                        </div>
                                    ) : (
                                        filteredFarmers.map(farmer => (
                                            <label
                                                key={farmer.id}
                                                className={`jo-add-farmer-item ${Number(formData.farmer_id) === Number(farmer.id) ? 'selected' : ''}`}
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
                                                    className="jo-add-farmer-radio"
                                                />
                                                <div className="jo-add-farmer-item-content">
                                                    <div className="jo-add-farmer-name">
                                                        {farmer.last_name}, {farmer.first_name} {farmer.middle_name ? farmer.middle_name + ' ' : ''}
                                                        {farmer.extension_name ? farmer.extension_name + ' ' : ''}
                                                    </div>
                                                    <div className="jo-add-farmer-details">
                                                        📍 {farmer.barangay} • RSBSA: {farmer.rsbsa_no}
                                                    </div>
                                                </div>
                                            </label>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Fertilizer Requests */}
                            <div className="jo-add-farmer-section">
                                <h3 className="jo-add-farmer-section-title">
                                    🌱 Requested Fertilizers (bags)
                                </h3>
                                <div className="jo-add-farmer-form-grid">
                                    <div className="jo-add-farmer-form-group">
                                        <label className="jo-add-farmer-label">
                                            Urea (46-0-0)
                                        </label>
                                        <input
                                            type="number"
                                            name="requested_urea_bags"
                                            value={formData.requested_urea_bags}
                                            onChange={handleInputChange}
                                            min="0"
                                            step="0.01"
                                            className="jo-add-farmer-input"
                                        />
                                    </div>
                                    <div className="jo-add-farmer-form-group">
                                        <label className="jo-add-farmer-label">
                                            Complete (14-14-14)
                                        </label>
                                        <input
                                            type="number"
                                            name="requested_complete_14_bags"
                                            value={formData.requested_complete_14_bags}
                                            onChange={handleInputChange}
                                            min="0"
                                            step="0.01"
                                            className="jo-add-farmer-input"
                                        />
                                    </div>
                                    <div className="jo-add-farmer-form-group">
                                        <label className="jo-add-farmer-label">
                                            Ammonium Sulfate (21-0-0)
                                        </label>
                                        <input
                                            type="number"
                                            name="requested_ammonium_sulfate_bags"
                                            value={formData.requested_ammonium_sulfate_bags}
                                            onChange={handleInputChange}
                                            min="0"
                                            step="0.01"
                                            className="jo-add-farmer-input"
                                        />
                                    </div>
                                    <div className="jo-add-farmer-form-group">
                                        <label className="jo-add-farmer-label">
                                            Muriate of Potash (0-0-60)
                                        </label>
                                        <input
                                            type="number"
                                            name="requested_muriate_potash_bags"
                                            value={formData.requested_muriate_potash_bags}
                                            onChange={handleInputChange}
                                            min="0"
                                            step="0.01"
                                            className="jo-add-farmer-input"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Seed Requests */}
                            <div className="jo-add-farmer-section">
                                <h3 className="jo-add-farmer-section-title">
                                    🌾 Requested Seeds (kg)
                                </h3>
                                <div className="jo-add-farmer-form-grid">
                                    {['Jackpot', 'US88', 'TH82', 'RH9000', 'Lumping143', 'LP296'].map((seedType) => (
                                        <div key={seedType} className="jo-add-farmer-form-group">
                                            <label className="jo-add-farmer-label">
                                                {seedType}
                                            </label>
                                            <input
                                                type="number"
                                                name={`requested_${seedType.toLowerCase()}_kg`}
                                                value={(formData as any)[`requested_${seedType.toLowerCase()}_kg`]}
                                                onChange={handleInputChange}
                                                min="0"
                                                step="0.01"
                                                className="jo-add-farmer-input"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Notes */}
                            <div className="jo-add-farmer-section">
                                <label className="jo-add-farmer-label">
                                    Notes / Remarks
                                </label>
                                <textarea
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleInputChange}
                                    rows={3}
                                    placeholder="Add any additional notes..."
                                    className="jo-add-farmer-textarea"
                                />
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="jo-add-farmer-error-box">
                                    {error}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="jo-add-farmer-actions">
                                <button
                                    type="button"
                                    onClick={() => navigate(`/jo-manage-requests/${allocationId}`)}
                                    className="jo-add-farmer-cancel-btn"
                                    disabled={loading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="jo-add-farmer-submit-btn"
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
