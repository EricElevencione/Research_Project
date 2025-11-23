import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import MasterlistIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';
import LandRecsIcon from '../../assets/images/landrecord.png';
import '../../assets/css/jo css/JoDistribution.css';
import '../../assets/css/navigation/nav.css';

interface DistributionRecord {
    id?: number;
    request_id: number;
    farmer_name: string;
    rsbsa_number: string;
    distribution_date: string;
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
    notes?: string;
}

interface FarmerRequest {
    id: number;
    farmer_name: string;
    rsbsa_number: string;
    season: string;
    priority_score?: number;
    status: string;
}

const JoDistribution: React.FC = () => {
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState<'form' | 'list'>('form');
    const [loading, setLoading] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [distributions, setDistributions] = useState<DistributionRecord[]>([]);
    const [selectedSeason, setSelectedSeason] = useState('dry_2024');
    const [pendingRequests, setPendingRequests] = useState<FarmerRequest[]>([]);
    const [selectedRequest, setSelectedRequest] = useState<number | null>(null);

    const [formData, setFormData] = useState<DistributionRecord>({
        request_id: 0,
        farmer_name: '',
        rsbsa_number: '',
        distribution_date: new Date().toISOString().split('T')[0],
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
        notes: ''
    });

    const isActive = (path: string) => {
        return window.location.pathname === path;
    };

    useEffect(() => {
        if (activeView === 'form') {
            fetchPendingRequests();
        } else {
            fetchDistributions();
        }
    }, [activeView, selectedSeason]);

    const fetchPendingRequests = async () => {
        try {
            const response = await fetch(`http://localhost:5000/api/distribution/requests?season=${selectedSeason}&status=approved`);
            if (response.ok) {
                const data = await response.json();
                setPendingRequests(data);
            }
        } catch (error) {
            console.error('Error fetching pending requests:', error);
        }
    };

    const fetchDistributions = async () => {
        try {
            const response = await fetch(`http://localhost:5000/api/distribution/records?season=${selectedSeason}`);
            if (response.ok) {
                const data = await response.json();
                setDistributions(data);
            }
        } catch (error) {
            console.error('Error fetching distributions:', error);
        }
    };

    const handleRequestSelect = async (requestId: number) => {
        setSelectedRequest(requestId);
        try {
            const response = await fetch(`http://localhost:5000/api/distribution/requests/${requestId}`);
            if (response.ok) {
                const request = await response.json();
                setFormData({
                    request_id: request.id,
                    farmer_name: request.farmer_name,
                    rsbsa_number: request.rsbsa_number,
                    distribution_date: new Date().toISOString().split('T')[0],
                    urea_46_0_0_bags: request.urea_46_0_0_bags || 0,
                    complete_14_14_14_bags: request.complete_14_14_14_bags || 0,
                    complete_16_16_16_bags: request.complete_16_16_16_bags || 0,
                    ammonium_sulfate_21_0_0_bags: request.ammonium_sulfate_21_0_0_bags || 0,
                    ammonium_phosphate_16_20_0_bags: request.ammonium_phosphate_16_20_0_bags || 0,
                    muriate_potash_0_0_60_bags: request.muriate_potash_0_0_60_bags || 0,
                    rice_seeds_nsic_rc160_kg: request.rice_seeds_nsic_rc160_kg || 0,
                    rice_seeds_nsic_rc222_kg: request.rice_seeds_nsic_rc222_kg || 0,
                    rice_seeds_nsic_rc440_kg: request.rice_seeds_nsic_rc440_kg || 0,
                    corn_seeds_hybrid_kg: request.corn_seeds_hybrid_kg || 0,
                    corn_seeds_opm_kg: request.corn_seeds_opm_kg || 0,
                    vegetable_seeds_kg: request.vegetable_seeds_kg || 0,
                    notes: ''
                });
            }
        } catch (error) {
            console.error('Error fetching request details:', error);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name.includes('bags') || name.includes('kg')
                ? parseFloat(value) || 0
                : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRequest) {
            alert('Please select a farmer request first');
            return;
        }

        setLoading(true);
        setSaveSuccess(false);

        try {
            const response = await fetch('http://localhost:5000/api/distribution/records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    distributed_by: 1 // TODO: Get from auth context
                })
            });

            if (response.ok) {
                setSaveSuccess(true);
                setSelectedRequest(null);
                setFormData({
                    request_id: 0,
                    farmer_name: '',
                    rsbsa_number: '',
                    distribution_date: new Date().toISOString().split('T')[0],
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
                    notes: ''
                });
                fetchPendingRequests();
                setTimeout(() => setSaveSuccess(false), 3000);
            } else {
                alert('Failed to save distribution record');
            }
        } catch (error) {
            console.error('Error saving distribution:', error);
            alert('Error saving distribution record');
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
        <div className="distribution-container">
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
            <div className="main-content distribution-main-content">
                <div className="content-header distribution-content-header">
                    <h2>Distribution Log</h2>
                    <p>Record actual distribution to farmers for tracking and accountability</p>
                </div>

                {/* View Toggle */}
                <div className="view-toggle">
                    <button
                        className={`toggle-btn ${activeView === 'form' ? 'active' : ''}`}
                        onClick={() => setActiveView('form')}
                    >
                        ➕ Record Distribution
                    </button>
                    <button
                        className={`toggle-btn ${activeView === 'list' ? 'active' : ''}`}
                        onClick={() => setActiveView('list')}
                    >
                        📋 View Records
                    </button>
                </div>

                {saveSuccess && (
                    <div className="distribution-success-message">
                        ✅ Distribution record saved successfully!
                    </div>
                )}

                {/* Form View */}
                {activeView === 'form' && (
                    <form onSubmit={handleSubmit} className="distribution-form">
                        {/* Select Farmer Request */}
                        <div className="distribution-card">
                            <h3>Select Farmer Request</h3>
                            <div className="request-selector">
                                <label>Season: {selectedSeason.replace('_', ' ').toUpperCase()}</label>
                                <select
                                    value={selectedRequest || ''}
                                    onChange={(e) => handleRequestSelect(Number(e.target.value))}
                                    required
                                >
                                    <option value="">-- Select a farmer --</option>
                                    {pendingRequests.map((req) => (
                                        <option key={req.id} value={req.id}>
                                            {req.farmer_name} ({req.rsbsa_number}) - Priority: {req.priority_score?.toFixed(2) || 'N/A'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {selectedRequest && (
                            <>
                                {/* Distribution Details */}
                                <div className="distribution-card">
                                    <h3>Distribution Information</h3>
                                    <div className="distribution-form-grid">
                                        <div className="distribution-form-field">
                                            <label>Farmer Name</label>
                                            <input
                                                type="text"
                                                value={formData.farmer_name}
                                                disabled
                                            />
                                        </div>
                                        <div className="distribution-form-field">
                                            <label>RSBSA Number</label>
                                            <input
                                                type="text"
                                                value={formData.rsbsa_number}
                                                disabled
                                            />
                                        </div>
                                        <div className="distribution-form-field">
                                            <label>Distribution Date *</label>
                                            <input
                                                type="date"
                                                name="distribution_date"
                                                value={formData.distribution_date}
                                                onChange={handleInputChange}
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Fertilizer Distribution */}
                                <div className="distribution-card">
                                    <h3>Fertilizer Distributed (50kg bags)</h3>
                                    <p className="help-text">Adjust quantities if partial distribution</p>
                                    <div className="distribution-form-grid">
                                        <div className="distribution-form-field">
                                            <label>Euria</label>
                                            <input
                                                type="number"
                                                name="urea_46_0_0_bags"
                                                value={formData.urea_46_0_0_bags}
                                                onChange={handleInputChange}
                                                min="0"
                                            />
                                        </div>
                                        <div className="distribution-form-field">
                                            <label>4600</label>
                                            <input
                                                type="number"
                                                name="complete_14_14_14_bags"
                                                value={formData.complete_14_14_14_bags}
                                                onChange={handleInputChange}
                                                min="0"
                                            />
                                        </div>
                                        <div className="distribution-form-field">
                                            <label>141414</label>
                                            <input
                                                type="number"
                                                name="complete_16_16_16_bags"
                                                value={formData.complete_16_16_16_bags}
                                                onChange={handleInputChange}
                                                min="0"
                                            />
                                        </div>
                                        <div className="distribution-form-field">
                                            <label>0060</label>
                                            <input
                                                type="number"
                                                name="ammonium_sulfate_21_0_0_bags"
                                                value={formData.ammonium_sulfate_21_0_0_bags}
                                                onChange={handleInputChange}
                                                min="0"
                                            />
                                        </div>
                                        <div className="distribution-form-field">
                                            <label>Other Fertilizer 1</label>
                                            <input
                                                type="number"
                                                name="ammonium_phosphate_16_20_0_bags"
                                                value={formData.ammonium_phosphate_16_20_0_bags}
                                                onChange={handleInputChange}
                                                min="0"
                                            />
                                        </div>
                                        <div className="distribution-form-field">
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
                                    <div className="distribution-total-summary">
                                        Total Fertilizer: {totalFertilizerBags} bags
                                    </div>
                                </div>

                                {/* Seed Distribution */}
                                <div className="distribution-card">
                                    <h3>Seeds Distributed (kilograms)</h3>
                                    <p className="help-text">Adjust quantities if partial distribution</p>
                                    <div className="distribution-form-grid">
                                        <div className="distribution-form-field">
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
                                        <div className="distribution-form-field">
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
                                        <div className="distribution-form-field">
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
                                        <div className="distribution-form-field">
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
                                        <div className="distribution-form-field">
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
                                        <div className="distribution-form-field">
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
                                    <div className="distribution-total-summary">
                                        Total Seeds: {totalSeedsKg.toFixed(2)} kg
                                    </div>
                                </div>

                                {/* Notes */}
                                <div className="distribution-card">
                                    <h3>Notes</h3>
                                    <div className="distribution-form-field">
                                        <textarea
                                            name="notes"
                                            value={formData.notes}
                                            onChange={handleInputChange}
                                            rows={3}
                                            placeholder="Any additional notes about this distribution..."
                                        />
                                    </div>
                                </div>

                                {/* Submit Button */}
                                <div className="distribution-button-container">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedRequest(null);
                                            setFormData({
                                                request_id: 0,
                                                farmer_name: '',
                                                rsbsa_number: '',
                                                distribution_date: new Date().toISOString().split('T')[0],
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
                                                notes: ''
                                            });
                                        }}
                                        className="distribution-btn distribution-btn-cancel"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="distribution-btn distribution-btn-submit"
                                    >
                                        {loading ? 'Saving...' : 'Save Distribution'}
                                    </button>
                                </div>
                            </>
                        )}
                    </form>
                )}

                {/* List View */}
                {activeView === 'list' && (
                    <div className="distributions-list">
                        <div className="list-controls">
                            <div className="distribution-form-field">
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

                        <div className="distributions-table-container">
                            <table className="distributions-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Farmer Name</th>
                                        <th>RSBSA #</th>
                                        <th>Total Fertilizer</th>
                                        <th>Total Seeds</th>
                                        <th>Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {distributions.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                                                No distribution records found for {selectedSeason}
                                            </td>
                                        </tr>
                                    ) : (
                                        distributions.map((dist) => {
                                            const totalFert = (dist.urea_46_0_0_bags || 0) +
                                                (dist.complete_14_14_14_bags || 0) +
                                                (dist.complete_16_16_16_bags || 0) +
                                                (dist.ammonium_sulfate_21_0_0_bags || 0) +
                                                (dist.ammonium_phosphate_16_20_0_bags || 0) +
                                                (dist.muriate_potash_0_0_60_bags || 0);

                                            const totalSeeds = (dist.rice_seeds_nsic_rc160_kg || 0) +
                                                (dist.rice_seeds_nsic_rc222_kg || 0) +
                                                (dist.rice_seeds_nsic_rc440_kg || 0) +
                                                (dist.corn_seeds_hybrid_kg || 0) +
                                                (dist.corn_seeds_opm_kg || 0) +
                                                (dist.vegetable_seeds_kg || 0);

                                            return (
                                                <tr key={dist.id}>
                                                    <td>{new Date(dist.distribution_date).toLocaleDateString()}</td>
                                                    <td>{dist.farmer_name}</td>
                                                    <td>{dist.rsbsa_number}</td>
                                                    <td>{totalFert} bags</td>
                                                    <td>{totalSeeds.toFixed(2)} kg</td>
                                                    <td>{dist.notes || '-'}</td>
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

export default JoDistribution;
