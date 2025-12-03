import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LogoImage from '../../assets/images/Logo.png';
import DistributionIcon from '../../assets/images/distribution.png'
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import MasterlistIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';
import LandRecsIcon from '../../assets/images/landrecord.png';
import FarmerRequestIcon from '../../assets/images/request.png';
import '../../assets/css/jo css/JoFarmerRequests.css';
import '../../components/layout/sidebarStyle.css';

interface FarmerRequest {
    id?: number;
    farmer_id: number;
    farmer_name: string;
    rsbsa_number: string;
    season: string;
    farm_size_ha: number;
    ownership_type: string;
    barangay: string;
    crop_type: string;
    urea_46_0_0_bags: number;
    complete_14_14_14_bags: number;
    complete_16_16_16_bags: number;
    ammonium_sulfate_21_0_0_bags: number;
    ammonium_phosphate_16_20_0_bags: number;
    muriate_potash_0_0_60_bags: number;
    rice_seeds_nsic_rc160_kg: number;
    rice_seeds_nsic_rc222_kg: number;
    rice_seeds_nsic_rc440_kg: number;
    corn_seeds_hybrid_kg: number;
    corn_seeds_opm_kg: number;
    vegetable_seeds_kg: number;
    priority_score?: number;
    status: string;
    request_date: string;
}

const JoFarmerRequests: React.FC = () => {
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState<'form' | 'list'>('form');
    const [loading, setLoading] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [requests, setRequests] = useState<FarmerRequest[]>([]);
    const [selectedSeason, setSelectedSeason] = useState('dry_2024');

    const isActive = (path: string) => {
        return window.location.pathname === path;
    };

    const [formData, setFormData] = useState<FarmerRequest>({
        farmer_id: 0,
        farmer_name: '',
        rsbsa_number: '',
        season: 'dry_2024',
        farm_size_ha: 0,
        ownership_type: 'owner',
        barangay: '',
        crop_type: 'rice',
        urea_46_0_0_bags: 0,
        complete_14_14_14_bags: 0,
        complete_16_16_16_bags: 0,
        ammonium_sulfate_21_0_0_bags: 0,
        ammonium_phosphate_16_20_0_bags: 0,
        muriate_potash_0_0_60_bags: 0,
        rice_seeds_nsic_rc160_kg: 0,
        rice_seeds_nsic_rc222_kg: 0,
        rice_seeds_nsic_rc440_kg: 0,
        corn_seeds_hybrid_kg: 0,
        corn_seeds_opm_kg: 0,
        vegetable_seeds_kg: 0,
        status: 'pending',
        request_date: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        if (activeView === 'list') {
            fetchRequests();
        }
    }, [activeView, selectedSeason]);

    const fetchRequests = async () => {
        try {
            const response = await fetch(`http://localhost:5000/api/distribution/requests?season=${selectedSeason}`);
            if (response.ok) {
                const data = await response.json();
                setRequests(data);
            }
        } catch (error) {
            console.error('Error fetching requests:', error);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name.includes('bags') || name.includes('kg') || name === 'farm_size_ha' || name === 'farmer_id'
                ? parseFloat(value) || 0
                : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setSaveSuccess(false);

        try {
            const response = await fetch('http://localhost:5000/api/distribution/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    created_by: 1 // TODO: Get from auth context
                })
            });

            if (response.ok) {
                setSaveSuccess(true);
                // Reset form
                setFormData({
                    ...formData,
                    farmer_id: 0,
                    farmer_name: '',
                    rsbsa_number: '',
                    farm_size_ha: 0,
                    barangay: '',
                    urea_46_0_0_bags: 0,
                    complete_14_14_14_bags: 0,
                    complete_16_16_16_bags: 0,
                    ammonium_sulfate_21_0_0_bags: 0,
                    ammonium_phosphate_16_20_0_bags: 0,
                    muriate_potash_0_0_60_bags: 0,
                    rice_seeds_nsic_rc160_kg: 0,
                    rice_seeds_nsic_rc222_kg: 0,
                    rice_seeds_nsic_rc440_kg: 0,
                    corn_seeds_hybrid_kg: 0,
                    corn_seeds_opm_kg: 0,
                    vegetable_seeds_kg: 0
                });
                setTimeout(() => setSaveSuccess(false), 3000);
            } else {
                alert('Failed to save request');
            }
        } catch (error) {
            console.error('Error saving request:', error);
            alert('Error saving request');
        } finally {
            setLoading(false);
        }
    };

    const totalFertilizerBags = formData.urea_46_0_0_bags +
        formData.complete_14_14_14_bags +
        formData.complete_16_16_16_bags +
        formData.ammonium_sulfate_21_0_0_bags +
        formData.ammonium_phosphate_16_20_0_bags +
        formData.muriate_potash_0_0_60_bags;

    const totalSeedsKg = formData.rice_seeds_nsic_rc160_kg +
        formData.rice_seeds_nsic_rc222_kg +
        formData.rice_seeds_nsic_rc440_kg +
        formData.corn_seeds_hybrid_kg +
        formData.corn_seeds_opm_kg +
        formData.vegetable_seeds_kg;

    return (
        <div className="farmer-requests-container">
            {/* Sidebar starts here */}
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
                        className={`sidebar-nav-item ${isActive('/jo-regional-allocation') ? 'active' : ''}`}
                        onClick={() => navigate('/jo-regional-allocation')}
                    >
                        <div className="nav-icon">
                            <img src={DistributionIcon} alt="Distribution" />
                        </div>
                        <span className="nav-text">Regional Allocation</span>
                    </div>

                    <div
                        className={`sidebar-nav-item ${isActive('/jo-farmer-requests') ? 'active' : ''}`}
                        onClick={() => navigate('/jo-farmer-requests')}
                    >
                        <div className="nav-icon">
                            <img src={FarmerRequestIcon} alt="FarmerRequest" />
                        </div>
                        <span className="nav-text">Farmer Request</span>
                    </div>

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
                            <img src={LandRecsIcon} alt="Masterlist" />
                        </span>
                        <span className="nav-text">Land Records</span>
                    </button>

                    <button
                        className={`sidebar-nav-item ${isActive('/') ? 'active' : ''}`}
                        onClick={() => navigate('/')}
                    >
                        <span className="nav-icon">
                            <img src={LogoutIcon} alt="Logout" />
                        </span>
                        <span className="nav-text">Logout</span>
                    </button>
                </nav>
            </div>
            {/* Sidebar ends here */}

            {/* Main Content */}
            <div className="main-content farmer-main-content">
                <div className="content-header farmer-content-header">
                    <h2>Farmer Request Management</h2>
                    <p>Input farmer requests from paper slips and view priority rankings</p>
                </div>

                {/* View Toggle */}
                <div className="view-toggle">
                    <button
                        className={`toggle-btn ${activeView === 'form' ? 'active' : ''}`}
                        onClick={() => setActiveView('form')}
                    >
                        ➕ New Request
                    </button>
                    <button
                        className={`toggle-btn ${activeView === 'list' ? 'active' : ''}`}
                        onClick={() => setActiveView('list')}
                    >
                        📋 View Requests
                    </button>
                </div>

                {saveSuccess && (
                    <div className="farmer-success-message">
                        ✅ Farmer request saved successfully!
                    </div>
                )}

                {/* Form View */}
                {activeView === 'form' && (
                    <form onSubmit={handleSubmit} className="farmer-form">
                        {/* Farmer Information */}
                        <div className="farmer-card">
                            <h3>Farmer Information</h3>
                            <div className="farmer-form-grid">
                                <div className="farmer-form-field">
                                    <label>Farmer Name *</label>
                                    <input
                                        type="text"
                                        name="farmer_name"
                                        value={formData.farmer_name}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div className="farmer-form-field">
                                    <label>RSBSA Number *</label>
                                    <input
                                        type="text"
                                        name="rsbsa_number"
                                        value={formData.rsbsa_number}
                                        onChange={handleInputChange}
                                        required
                                        placeholder="XX-XX-XX-XXX-XXXXXX"
                                    />
                                </div>
                                <div className="farmer-form-field">
                                    <label>Season *</label>
                                    <select
                                        name="season"
                                        value={formData.season}
                                        onChange={handleInputChange}
                                        required
                                    >
                                        <option value="dry_2024">Dry Season 2024</option>
                                        <option value="wet_2024">Wet Season 2024</option>
                                        <option value="dry_2025">Dry Season 2025</option>
                                        <option value="wet_2025">Wet Season 2025</option>
                                    </select>
                                </div>
                                <div className="farmer-form-field">
                                    <label>Request Date *</label>
                                    <input
                                        type="date"
                                        name="request_date"
                                        value={formData.request_date}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div className="farmer-form-field">
                                    <label>Farm Size (hectares) *</label>
                                    <input
                                        type="number"
                                        name="farm_size_ha"
                                        value={formData.farm_size_ha}
                                        onChange={handleInputChange}
                                        required
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                                <div className="farmer-form-field">
                                    <label>Ownership Type *</label>
                                    <select
                                        name="ownership_type"
                                        value={formData.ownership_type}
                                        onChange={handleInputChange}
                                        required
                                    >
                                        <option value="owner">Owner</option>
                                        <option value="tenant">Tenant</option>
                                        <option value="lessee">Lessee</option>
                                    </select>
                                </div>
                                <div className="farmer-form-field">
                                    <label>Barangay *</label>
                                    <input
                                        type="text"
                                        name="barangay"
                                        value={formData.barangay}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div className="farmer-form-field">
                                    <label>Crop Type *</label>
                                    <select
                                        name="crop_type"
                                        value={formData.crop_type}
                                        onChange={handleInputChange}
                                        required
                                    >
                                        <option value="rice">Rice</option>
                                        <option value="corn">Corn</option>
                                        <option value="vegetables">Vegetables</option>
                                        <option value="mixed">Mixed</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Fertilizer Request */}
                        <div className="farmer-card">
                            <h3>Fertilizer Request (50kg bags)</h3>
                            <div className="farmer-form-grid">
                                <div className="farmer-form-field">
                                    <label>Euria</label>
                                    <input
                                        type="number"
                                        name="urea_46_0_0_bags"
                                        value={formData.urea_46_0_0_bags}
                                        onChange={handleInputChange}
                                        min="0"
                                    />
                                </div>
                                <div className="farmer-form-field">
                                    <label>4600</label>
                                    <input
                                        type="number"
                                        name="complete_14_14_14_bags"
                                        value={formData.complete_14_14_14_bags}
                                        onChange={handleInputChange}
                                        min="0"
                                    />
                                </div>
                                <div className="farmer-form-field">
                                    <label>141414</label>
                                    <input
                                        type="number"
                                        name="complete_16_16_16_bags"
                                        value={formData.complete_16_16_16_bags}
                                        onChange={handleInputChange}
                                        min="0"
                                    />
                                </div>
                                <div className="farmer-form-field">
                                    <label>0060</label>
                                    <input
                                        type="number"
                                        name="ammonium_sulfate_21_0_0_bags"
                                        value={formData.ammonium_sulfate_21_0_0_bags}
                                        onChange={handleInputChange}
                                        min="0"
                                    />
                                </div>
                                <div className="farmer-form-field">
                                    <label>Other Fertilizer 1</label>
                                    <input
                                        type="number"
                                        name="ammonium_phosphate_16_20_0_bags"
                                        value={formData.ammonium_phosphate_16_20_0_bags}
                                        onChange={handleInputChange}
                                        min="0"
                                    />
                                </div>
                                <div className="farmer-form-field">
                                    <label>Other Fertilizer 2</label>
                                    <input
                                        type="number"
                                        name="muriate_potash_0_0_60_bags"
                                        value={formData.muriate_potash_0_0_60_bags}
                                        onChange={handleInputChange}
                                        min="0"
                                    />
                                </div>
                            </div>
                            <div className="farmer-total-summary">
                                Total Fertilizer: {totalFertilizerBags} bags ({(totalFertilizerBags * 50).toLocaleString()} kg)
                            </div>
                        </div>

                        {/* Seed Request */}
                        <div className="farmer-card">
                            <h3>Seed Request (kilograms)</h3>
                            <div className="farmer-form-grid">
                                <div className="farmer-form-field">
                                    <label>Jackpot</label>
                                    <input
                                        type="number"
                                        name="rice_seeds_nsic_rc160_kg"
                                        value={formData.rice_seeds_nsic_rc160_kg}
                                        onChange={handleInputChange}
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                                <div className="farmer-form-field">
                                    <label>US88</label>
                                    <input
                                        type="number"
                                        name="rice_seeds_nsic_rc222_kg"
                                        value={formData.rice_seeds_nsic_rc222_kg}
                                        onChange={handleInputChange}
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                                <div className="farmer-form-field">
                                    <label>TH82</label>
                                    <input
                                        type="number"
                                        name="rice_seeds_nsic_rc440_kg"
                                        value={formData.rice_seeds_nsic_rc440_kg}
                                        onChange={handleInputChange}
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                                <div className="farmer-form-field">
                                    <label>RH9000</label>
                                    <input
                                        type="number"
                                        name="corn_seeds_hybrid_kg"
                                        value={formData.corn_seeds_hybrid_kg}
                                        onChange={handleInputChange}
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                                <div className="farmer-form-field">
                                    <label>Lumping143</label>
                                    <input
                                        type="number"
                                        name="corn_seeds_opm_kg"
                                        value={formData.corn_seeds_opm_kg}
                                        onChange={handleInputChange}
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                                <div className="farmer-form-field">
                                    <label>LP296</label>
                                    <input
                                        type="number"
                                        name="vegetable_seeds_kg"
                                        value={formData.vegetable_seeds_kg}
                                        onChange={handleInputChange}
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                            </div>
                            <div className="farmer-total-summary">
                                Total Seeds: {totalSeedsKg.toLocaleString()} kg
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="farmer-button-container">
                            <button
                                type="button"
                                onClick={() => navigate('/jo-dashboard')}
                                className="farmer-btn farmer-btn-cancel"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="farmer-btn farmer-btn-submit"
                            >
                                {loading ? 'Saving...' : 'Save Request'}
                            </button>
                        </div>
                    </form>
                )}

                {/* List View */}
                {activeView === 'list' && (
                    <div className="requests-list">
                        <div className="list-controls">
                            <div className="farmer-form-field">
                                <label>Filter by Season:</label>
                                <select
                                    value={selectedSeason}
                                    onChange={(e) => setSelectedSeason(e.target.value)}
                                >
                                    <option value="dry_2024">Dry Season 2024</option>
                                    <option value="wet_2024">Wet Season 2024</option>
                                    <option value="dry_2025">Dry Season 2025</option>
                                    <option value="wet_2025">Wet Season 2025</option>
                                </select>
                            </div>
                        </div>

                        <div className="requests-table-container">
                            <table className="requests-table">
                                <thead>
                                    <tr>
                                        <th>Farmer Name</th>
                                        <th>RSBSA #</th>
                                        <th>Farm Size</th>
                                        <th>Ownership</th>
                                        <th>Barangay</th>
                                        <th>Total Fertilizer</th>
                                        <th>Total Seeds</th>
                                        <th>Status</th>
                                        <th>Request Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {requests.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
                                                No requests found for {selectedSeason}
                                            </td>
                                        </tr>
                                    ) : (
                                        requests.map((req) => {
                                            const totalFert = (req.urea_46_0_0_bags || 0) +
                                                (req.complete_14_14_14_bags || 0) +
                                                (req.complete_16_16_16_bags || 0) +
                                                (req.ammonium_sulfate_21_0_0_bags || 0) +
                                                (req.ammonium_phosphate_16_20_0_bags || 0) +
                                                (req.muriate_potash_0_0_60_bags || 0);

                                            const totalSeeds = (req.rice_seeds_nsic_rc160_kg || 0) +
                                                (req.rice_seeds_nsic_rc222_kg || 0) +
                                                (req.rice_seeds_nsic_rc440_kg || 0) +
                                                (req.corn_seeds_hybrid_kg || 0) +
                                                (req.corn_seeds_opm_kg || 0) +
                                                (req.vegetable_seeds_kg || 0);

                                            return (
                                                <tr key={req.id}>
                                                    <td>{req.farmer_name}</td>
                                                    <td>{req.rsbsa_number}</td>
                                                    <td>{req.farm_size_ha} ha</td>
                                                    <td>{req.ownership_type}</td>
                                                    <td>{req.barangay}</td>
                                                    <td>{totalFert} bags</td>
                                                    <td>{totalSeeds.toFixed(2)} kg</td>
                                                    <td>
                                                        <span className={`status-badge status-${req.status}`}>
                                                            {req.status}
                                                        </span>
                                                    </td>
                                                    <td>{new Date(req.request_date).toLocaleDateString()}</td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default JoFarmerRequests;
