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
    ammonium_sulfate_21_0_0_bags: number;
    muriate_potash_0_0_60_bags: number;
    rice_seeds_nsic_rc160_kg: number;
    rice_seeds_nsic_rc222_kg: number;
    rice_seeds_nsic_rc440_kg: number;
    corn_seeds_hybrid_kg: number;
    corn_seeds_opm_kg: number;
    vegetable_seeds_kg: number;
    // Aggregate fields from backend distribution_records
    fertilizer_bags_given?: number;
    seed_kg_given?: number;
    fertilizer_type?: string;
    seed_type?: string;
    verification_notes?: string;
    notes?: string;
}

interface FarmerRequest {
    id: number;
    farmer_name: string;
    rsbsa_number: string;
    season: string;
    status: string;
}

interface RegionalAllocation {
    id: number;
    season: string;
    allocation_date: string;
    status: string;
}

const JoDistribution: React.FC = () => {
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState<'form' | 'list'>('form');
    const [loading, setLoading] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [distributions, setDistributions] = useState<DistributionRecord[]>([]);
    const [selectedSeason, setSelectedSeason] = useState('');
    const [pendingRequests, setPendingRequests] = useState<FarmerRequest[]>([]);
    const [selectedRequest, setSelectedRequest] = useState<number | null>(null);
    const [allocations, setAllocations] = useState<RegionalAllocation[]>([]);
    const [loadingAllocations, setLoadingAllocations] = useState(true);

    const [formData, setFormData] = useState<DistributionRecord>({
        request_id: 0,
        farmer_name: '',
        rsbsa_number: '',
        distribution_date: new Date().toISOString().split('T')[0],
        urea_46_0_0_bags: 0,
        complete_14_14_14_bags: 0,
        ammonium_sulfate_21_0_0_bags: 0,
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
        fetchAllocations();
    }, []);

    useEffect(() => {
        if (selectedSeason) {
            if (activeView === 'form') {
                fetchPendingRequests();
            } else {
                fetchDistributions();
            }
        }
    }, [activeView, selectedSeason]);

    const fetchAllocations = async () => {
        setLoadingAllocations(true);
        try {
            const response = await fetch('http://localhost:5000/api/distribution/allocations');
            if (response.ok) {
                const data = await response.json();
                setAllocations(data);
                if (data.length > 0) {
                    const mostRecent = data.sort((a: RegionalAllocation, b: RegionalAllocation) =>
                        new Date(b.allocation_date).getTime() - new Date(a.allocation_date).getTime()
                    )[0];
                    setSelectedSeason(mostRecent.season);
                }
            }
        } catch (error) {
            console.error('Error fetching allocations:', error);
        } finally {
            setLoadingAllocations(false);
        }
    };

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
        if (!selectedSeason) return;
        try {
            const response = await fetch(`http://localhost:5000/api/distribution/records/${selectedSeason}`);
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
                    urea_46_0_0_bags: request.requested_urea_bags || 0,
                    complete_14_14_14_bags: request.requested_complete_14_bags || 0,
                    ammonium_sulfate_21_0_0_bags: request.requested_ammonium_sulfate_bags || 0,
                    muriate_potash_0_0_60_bags: request.requested_muriate_potash_bags || 0,
                    rice_seeds_nsic_rc160_kg: request.requested_jackpot_kg || 0,
                    rice_seeds_nsic_rc222_kg: request.requested_us88_kg || 0,
                    rice_seeds_nsic_rc440_kg: request.requested_th82_kg || 0,
                    corn_seeds_hybrid_kg: request.requested_rh9000_kg || 0,
                    corn_seeds_opm_kg: request.requested_lumping143_kg || 0,
                    vegetable_seeds_kg: request.requested_lp296_kg || 0,
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

        // Compute totals and build type summaries to match backend schema
        const totalFertilizer = Math.round((formData.urea_46_0_0_bags || 0) +
            (formData.complete_14_14_14_bags || 0) +
            (formData.ammonium_sulfate_21_0_0_bags || 0) +
            (formData.muriate_potash_0_0_60_bags || 0));

        const totalSeeds = Number(((formData.rice_seeds_nsic_rc160_kg || 0) +
            (formData.rice_seeds_nsic_rc222_kg || 0) +
            (formData.rice_seeds_nsic_rc440_kg || 0) +
            (formData.corn_seeds_hybrid_kg || 0) +
            (formData.corn_seeds_opm_kg || 0) +
            (formData.vegetable_seeds_kg || 0)).toFixed(2));

        const fertilizerTypes: string[] = [];
        if (formData.urea_46_0_0_bags) fertilizerTypes.push(`Urea:${formData.urea_46_0_0_bags}`);
        if (formData.complete_14_14_14_bags) fertilizerTypes.push(`Complete:${formData.complete_14_14_14_bags}`);
        if (formData.ammonium_sulfate_21_0_0_bags) fertilizerTypes.push(`Ammonium Sulfate:${formData.ammonium_sulfate_21_0_0_bags}`);
        if (formData.muriate_potash_0_0_60_bags) fertilizerTypes.push(`Muriate Potash:${formData.muriate_potash_0_0_60_bags}`);

        const seedTypes: string[] = [];
        if (formData.rice_seeds_nsic_rc160_kg) seedTypes.push(`Jackpot:${formData.rice_seeds_nsic_rc160_kg}`);
        if (formData.rice_seeds_nsic_rc222_kg) seedTypes.push(`US88:${formData.rice_seeds_nsic_rc222_kg}`);
        if (formData.rice_seeds_nsic_rc440_kg) seedTypes.push(`TH82:${formData.rice_seeds_nsic_rc440_kg}`);
        if (formData.corn_seeds_hybrid_kg) seedTypes.push(`RH9000:${formData.corn_seeds_hybrid_kg}`);
        if (formData.corn_seeds_opm_kg) seedTypes.push(`Lumping143:${formData.corn_seeds_opm_kg}`);
        if (formData.vegetable_seeds_kg) seedTypes.push(`LP296:${formData.vegetable_seeds_kg}`);

        const payload = {
            request_id: formData.request_id,
            fertilizer_type: fertilizerTypes.join(', ') || null,
            fertilizer_bags_given: totalFertilizer,
            seed_type: seedTypes.join(', ') || null,
            seed_kg_given: totalSeeds,
            voucher_code: null,
            farmer_signature: false,
            verified_by: null
        };

        try {
            const response = await fetch('http://localhost:5000/api/distribution/records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
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
                    ammonium_sulfate_21_0_0_bags: 0,
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
                const errText = await response.text();
                console.error('Failed to save distribution record', errText);
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
        formData.ammonium_sulfate_21_0_0_bags +
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
                                            {req.farmer_name} ({req.rsbsa_number})
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
                                            <label>Urea (46-0-0)</label>
                                            <input
                                                type="number"
                                                name="urea_46_0_0_bags"
                                                value={formData.urea_46_0_0_bags}
                                                onChange={handleInputChange}
                                                min="0"
                                                step="0.01"
                                            />
                                        </div>
                                        <div className="distribution-form-field">
                                            <label>Complete (14-14-14)</label>
                                            <input
                                                type="number"
                                                name="complete_14_14_14_bags"
                                                value={formData.complete_14_14_14_bags}
                                                onChange={handleInputChange}
                                                min="0"
                                                step="0.01"
                                            />
                                        </div>
                                        <div className="distribution-form-field">
                                            <label>Ammonium Sulfate (21-0-0)</label>
                                            <input
                                                type="number"
                                                name="ammonium_sulfate_21_0_0_bags"
                                                value={formData.ammonium_sulfate_21_0_0_bags}
                                                onChange={handleInputChange}
                                                min="0"
                                                step="0.01"
                                            />
                                        </div>
                                        <div className="distribution-form-field">
                                            <label>Muriate of Potash (0-0-60)</label>
                                            <input
                                                type="number"
                                                name="muriate_potash_0_0_60_bags"
                                                value={formData.muriate_potash_0_0_60_bags}
                                                onChange={handleInputChange}
                                                min="0"
                                                step="0.01"
                                            />
                                        </div>
                                    </div>
                                    <div className="distribution-total-summary">
                                        Total Fertilizer: {totalFertilizerBags.toFixed(2)} bags
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
                                                ammonium_sulfate_21_0_0_bags: 0,
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
                                <label>Select Regional Allocation:</label>
                                <select
                                    value={selectedSeason}
                                    onChange={(e) => setSelectedSeason(e.target.value)}
                                    disabled={loadingAllocations}
                                >
                                    {loadingAllocations ? (
                                        <option value="">Loading allocations...</option>
                                    ) : allocations.length === 0 ? (
                                        <option value="">No allocations found</option>
                                    ) : (
                                        <>
                                            <option value="">-- Select an allocation --</option>
                                            {allocations.map((alloc) => (
                                                <option key={alloc.id} value={alloc.season}>
                                                    {alloc.season.replace('_', ' ').toUpperCase()} - {new Date(alloc.allocation_date).toLocaleDateString('en-US', {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric'
                                                    })} ({alloc.status})
                                                </option>
                                            ))}
                                        </>
                                    )}
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
                                            // Database uses simple schema: fertilizer_bags_given and seed_kg_given
                                            const totalFert = dist.fertilizer_bags_given || 0;
                                            const totalSeeds = dist.seed_kg_given || 0;

                                            return (
                                                <tr key={dist.id}>
                                                    <td>{new Date(dist.distribution_date).toLocaleDateString()}</td>
                                                    <td>{dist.farmer_name}</td>
                                                    <td>{dist.rsbsa_number}</td>
                                                    <td>{totalFert} bags</td>
                                                    <td>{totalSeeds.toFixed(2)} kg</td>
                                                    <td>{dist.verification_notes || '-'}</td>
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
