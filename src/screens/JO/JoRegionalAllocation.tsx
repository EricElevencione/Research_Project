import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../../assets/css/jo css/JoRegionAll.css';
import '../../components/layout/sidebarStyle.css';
import LogoImage from '../../assets/images/Logo.png';
import DistributionIcon from '../../assets/images/distribution.png'
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import MasterlistIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';
import LandRecsIcon from '../../assets/images/landrecord.png';
import FarmerRequestIcon from '../../assets/images/request.png';

interface RegionalAllocation {
    season: string;
    allocation_date: string;
    season_start_date: string;
    season_end_date: string;
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
    notes: string;
}

const JoRegionalAllocation: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [loading, setLoading] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const [formData, setFormData] = useState<RegionalAllocation>({
        season: 'dry_2025',
        allocation_date: new Date().toISOString().split('T')[0],
        season_start_date: '2024-09-16',
        season_end_date: '2025-03-15',
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

    const isActive = (path: string) => location.pathname === path;

    useEffect(() => {
        // Load existing allocation if available
        fetchAllocation();
    }, [formData.season]);

    const fetchAllocation = async () => {
        try {
            const response = await fetch(`http://localhost:5000/api/distribution/allocations/${formData.season}`);
            if (response.ok) {
                const data = await response.json();
                setFormData(data);
            }
        } catch (error) {
            console.log('No existing allocation found, starting fresh');
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name.includes('bags') || name.includes('kg') ? parseFloat(value) || 0 : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setSaveSuccess(false);

        try {
            const response = await fetch('http://localhost:5000/api/distribution/allocations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    created_by: 1 // TODO: Get from auth context
                })
            });

            if (response.ok) {
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 3000);
            } else {
                alert('Failed to save allocation');
            }
        } catch (error) {
            console.error('Error saving allocation:', error);
            alert('Error saving allocation');
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
        <div className="regional-allocation-container">

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
            <div className="main-content regional-main-content">

                <div className="content-header regional-content-header">
                    <h2>Regional Allocation Input</h2>
                    <p>Enter the fertilizer and seed allocation received from Regional Office</p>
                </div>

                {saveSuccess && (
                    <div className="regional-success-message">
                        ✅ Regional allocation saved successfully!
                    </div>
                )}

                <form onSubmit={handleSubmit} className="regional-form">
                    {/* Season Information */}
                    <div className="regional-card">
                        <h3>Season Information</h3>
                        <div className="regional-form-grid">
                            <div className="regional-form-field">
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
                                    <option value="dry_2026">Dry Season 2026</option>
                                    <option value="wet_2026">Wet Season 2026</option>
                                </select>
                            </div>
                            <div className="regional-form-field">
                                <label>Allocation Date *</label>
                                <input
                                    type="date"
                                    name="allocation_date"
                                    value={formData.allocation_date}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                            <div className="regional-form-field">
                                <label>Season Start Date</label>
                                <input
                                    type="date"
                                    name="season_start_date"
                                    value={formData.season_start_date}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div className="regional-form-field">
                                <label>Season End Date</label>
                                <input
                                    type="date"
                                    name="season_end_date"
                                    value={formData.season_end_date}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Fertilizer Allocations */}
                    <div className="regional-card">
                        <h3>Fertilizer Allocations (50kg bags)</h3>
                        <div className="regional-form-grid">
                            <div className="regional-form-field">
                                <label>Euria</label>
                                <input
                                    type="number"
                                    name="urea_46_0_0_bags"
                                    value={formData.urea_46_0_0_bags}
                                    onChange={handleInputChange}
                                    min="0"
                                />
                            </div>
                            <div className="regional-form-field">
                                <label>4600</label>
                                <input
                                    type="number"
                                    name="complete_14_14_14_bags"
                                    value={formData.complete_14_14_14_bags}
                                    onChange={handleInputChange}
                                    min="0"
                                />
                            </div>
                            <div className="regional-form-field">
                                <label>141414</label>
                                <input
                                    type="number"
                                    name="complete_16_16_16_bags"
                                    value={formData.complete_16_16_16_bags}
                                    onChange={handleInputChange}
                                    min="0"
                                />
                            </div>
                            <div className="regional-form-field">
                                <label>0060</label>
                                <input
                                    type="number"
                                    name="ammonium_sulfate_21_0_0_bags"
                                    value={formData.ammonium_sulfate_21_0_0_bags}
                                    onChange={handleInputChange}
                                    min="0"
                                />
                            </div>
                        </div>
                        <div className="regional-total-summary">
                            Total Fertilizer Bags: {totalFertilizerBags.toLocaleString()} bags ({(totalFertilizerBags * 50).toLocaleString()} kg)
                        </div>
                    </div>

                    {/* Seed Allocations */}
                    <div className="regional-card">
                        <h3>Seed Allocations (kilograms)</h3>
                        <div className="regional-form-grid">
                            <div className="regional-form-field">
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
                            <div className="regional-form-field">
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
                            <div className="regional-form-field">
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
                            <div className="regional-form-field">
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
                            <div className="regional-form-field">
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
                            <div className="regional-form-field">
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
                        <div className="regional-total-summary">
                            Total Seeds: {totalSeedsKg.toLocaleString()} kg
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="regional-card">
                        <h3>Notes</h3>
                        <div className="regional-form-field">
                            <textarea
                                name="notes"
                                value={formData.notes}
                                onChange={handleInputChange}
                                rows={4}
                                placeholder="Additional notes or comments about this allocation..."
                            />
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="regional-button-container">
                        <button
                            type="button"
                            onClick={() => navigate('/jo-dashboard')}
                            className="regional-btn regional-btn-cancel"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="regional-btn regional-btn-submit"
                        >
                            {loading ? 'Saving...' : 'Save Allocation'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default JoRegionalAllocation;
