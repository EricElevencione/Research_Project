import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAllocation } from '../../api';
import '../../assets/css/jo css/JoIncentStyle.css';
import '../../assets/css/jo css/JoCreateAllocationStyle.css';
import '../../components/layout/sidebarStyle.css';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import MasterlistIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';

interface AllocationFormData {
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
    notes: string;
}

const JoCreateAllocation: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Function to determine season based on date
    const determineSeasonFromDate = (dateString: string): string => {
        const date = new Date(dateString);
        const month = date.getMonth() + 1; // 0-11 -> 1-12
        const year = date.getFullYear();

        // Wet Season: May to October (months 5-10)
        // Dry Season: November to April (months 11-12, 1-4)
        if (month >= 5 && month <= 10) {
            return `wet_${year}`;
        } else {
            // For November-December, use current year; for January-April, use current year
            return `dry_${year}`;
        }
    };

    const todayDate = new Date().toISOString().split('T')[0];
    const [formData, setFormData] = useState<AllocationFormData>({
        season: determineSeasonFromDate(todayDate),
        allocation_date: todayDate,
        urea_46_0_0_bags: 0,
        complete_14_14_14_bags: 0,
        ammonium_sulfate_21_0_0_bags: 0,
        muriate_potash_0_0_60_bags: 0,
        jackpot_kg: 0,
        us88_kg: 0,
        th82_kg: 0,
        rh9000_kg: 0,
        lumping143_kg: 0,
        lp296_kg: 0,
        notes: ''
    });

    const isActive = (path: string) => location.pathname === path;

    const handleLogout = () => {
        localStorage.removeItem('isAuthenticated');
        navigate('/login');
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;

        // If allocation_date changes, automatically update season
        if (name === 'allocation_date') {
            const autoSeason = determineSeasonFromDate(value);
            setFormData(prev => ({
                ...prev,
                allocation_date: value,
                season: autoSeason
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: name.includes('bags') || name.includes('kg') ? parseFloat(value) || 0 : value
            }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        setLoading(true);
        setError(null);

        try {
            const response = await createAllocation(formData);

            if (response.error) {
                throw new Error(response.error || 'Failed to save allocation');
            }

            const result = response.data;
            console.log('✅ Allocation created:', result);
            const allocationId = result?.id;

            if (!allocationId) {
                throw new Error('No allocation ID returned from server');
            }

            // Success - navigate to add farmer request page
            alert('✅ Regional allocation created successfully! Now add farmers to this allocation.');
            console.log('🔗 Navigating to:', `/jo-add-farmer-request/${allocationId}`);
            navigate(`/jo-add-farmer-request/${allocationId}`);
        } catch (err: any) {
            setError(err.message || 'Failed to save allocation');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="jo-allocation-page-container">
            <div className="jo-allocation-page">
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

                        <button
                            className={`sidebar-nav-item ${isActive('/jo-masterlist') ? 'active' : ''}`}
                            onClick={() => navigate('/jo-masterlist')}
                        >
                            <span className="nav-icon">
                                <img src={MasterlistIcon} alt="Masterlist" />
                            </span>
                            <span className="nav-text">Masterlist</span>
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

                        <div
                            className={`sidebar-nav-item ${isActive('/jo-land-registry') ? 'active' : ''}`}
                            onClick={() => navigate('/jo-land-registry')}
                        >
                            <div className="nav-icon">🗺️</div>
                            <span className="nav-text">Land Registry</span>
                        </div>

                        <button
                            className="sidebar-nav-item logout"
                            onClick={() => navigate('/')}
                        >
                            <span className="nav-icon">
                                <img src={LogoutIcon} alt="Logout" />
                            </span>
                            <span className="nav-text">Logout</span>
                        </button>

                    </nav>
                </div>

                {/* Main Content */}
                <div className="jo-allocation-main-content">
                    <div className="jo-allocation-header">
                        <h2 className="jo-allocation-title">Create Regional Allocation</h2>
                        <p className="jo-allocation-subtitle">Input fertilizer and seed allocation from Regional Office</p>
                    </div>

                    <div className="jo-allocation-content-card">
                        <form onSubmit={handleSubmit}>
                            {/* Season Selection */}
                            <div className="jo-allocation-section">
                                <h3 className="jo-allocation-section-title">
                                    Season Information
                                </h3>
                                <div className="jo-allocation-grid-2">
                                    <div className="jo-allocation-field">
                                        <label className="jo-allocation-label">
                                            Allocation Date <span className="jo-allocation-required">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            name="allocation_date"
                                            value={formData.allocation_date}
                                            onChange={handleInputChange}
                                            required
                                            className="jo-allocation-input"
                                        />
                                    </div>
                                    <div className="jo-allocation-field">
                                        <label className="jo-allocation-label">
                                            Auto-Detected Season
                                        </label>
                                        <div className="jo-allocation-season-display">
                                            {formData.season ? (
                                                <span>
                                                    {formData.season.includes('wet') ? '🌧️ Wet Season' : '☀️ Dry Season'} {formData.season.split('_')[1]}
                                                </span>
                                            ) : (
                                                <span className="jo-allocation-season-placeholder">Select a date first</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <p className="jo-allocation-season-info">
                                    💡 <strong>Wet Season:</strong> May - October | <strong>Dry Season:</strong> November - April
                                </p>
                            </div>

                            {/* Fertilizers Section */}
                            <div className="jo-allocation-section">
                                <h3 className="jo-allocation-section-title">
                                    🌱 Fertilizer Allocation (bags)
                                </h3>
                                <div className="jo-allocation-grid-2">
                                    <div className="jo-allocation-field">
                                        <label className="jo-allocation-label">
                                            Urea (46-0-0)
                                        </label>
                                        <input
                                            type="number"
                                            name="urea_46_0_0_bags"
                                            value={formData.urea_46_0_0_bags}
                                            onChange={handleInputChange}
                                            min="0"
                                            step="0.01"
                                            className="jo-allocation-input"
                                        />
                                    </div>
                                    <div className="jo-allocation-field">
                                        <label className="jo-allocation-label">
                                            Complete (14-14-14)
                                        </label>
                                        <input
                                            type="number"
                                            name="complete_14_14_14_bags"
                                            value={formData.complete_14_14_14_bags}
                                            onChange={handleInputChange}
                                            min="0"
                                            step="0.01"
                                            className="jo-allocation-input"
                                        />
                                    </div>
                                    <div className="jo-allocation-field">
                                        <label className="jo-allocation-label">
                                            Ammonium Sulfate (21-0-0)
                                        </label>
                                        <input
                                            type="number"
                                            name="ammonium_sulfate_21_0_0_bags"
                                            value={formData.ammonium_sulfate_21_0_0_bags}
                                            onChange={handleInputChange}
                                            min="0"
                                            step="0.01"
                                            className="jo-allocation-input"
                                        />
                                    </div>
                                    <div className="jo-allocation-field">
                                        <label className="jo-allocation-label">
                                            Muriate of Potash (0-0-60)
                                        </label>
                                        <input
                                            type="number"
                                            name="muriate_potash_0_0_60_bags"
                                            value={formData.muriate_potash_0_0_60_bags}
                                            onChange={handleInputChange}
                                            min="0"
                                            step="0.01"
                                            className="jo-allocation-input"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Seeds Section */}
                            <div className="jo-allocation-section">
                                <h3 className="jo-allocation-section-title">
                                    🌾 Seed Allocation (kg)
                                </h3>
                                <div className="jo-allocation-grid-2">
                                    <div className="jo-allocation-field">
                                        <label className="jo-allocation-label">
                                            Jackpot
                                        </label>
                                        <input
                                            type="number"
                                            name="jackpot_kg"
                                            value={formData.jackpot_kg}
                                            onChange={handleInputChange}
                                            min="0"
                                            step="0.01"
                                            className="jo-allocation-input"
                                        />
                                    </div>
                                    <div className="jo-allocation-field">
                                        <label className="jo-allocation-label">
                                            US88
                                        </label>
                                        <input
                                            type="number"
                                            name="us88_kg"
                                            value={formData.us88_kg}
                                            onChange={handleInputChange}
                                            min="0"
                                            step="0.01"
                                            className="jo-allocation-input"
                                        />
                                    </div>
                                    <div className="jo-allocation-field">
                                        <label className="jo-allocation-label">
                                            TH82
                                        </label>
                                        <input
                                            type="number"
                                            name="th82_kg"
                                            value={formData.th82_kg}
                                            onChange={handleInputChange}
                                            min="0"
                                            step="0.01"
                                            className="jo-allocation-input"
                                        />
                                    </div>
                                    <div className="jo-allocation-field">
                                        <label className="jo-allocation-label">
                                            RH9000
                                        </label>
                                        <input
                                            type="number"
                                            name="rh9000_kg"
                                            value={formData.rh9000_kg}
                                            onChange={handleInputChange}
                                            min="0"
                                            step="0.01"
                                            className="jo-allocation-input"
                                        />
                                    </div>
                                    <div className="jo-allocation-field">
                                        <label className="jo-allocation-label">
                                            Lumping143
                                        </label>
                                        <input
                                            type="number"
                                            name="lumping143_kg"
                                            value={formData.lumping143_kg}
                                            onChange={handleInputChange}
                                            min="0"
                                            step="0.01"
                                            className="jo-allocation-input"
                                        />
                                    </div>
                                    <div className="jo-allocation-field">
                                        <label className="jo-allocation-label">
                                            LP296
                                        </label>
                                        <input
                                            type="number"
                                            name="lp296_kg"
                                            value={formData.lp296_kg}
                                            onChange={handleInputChange}
                                            min="0"
                                            step="0.01"
                                            className="jo-allocation-input"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Notes Section */}
                            <div className="jo-allocation-section">
                                <label className="jo-allocation-label">
                                    Notes / Remarks
                                </label>
                                <textarea
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleInputChange}
                                    rows={4}
                                    placeholder="Add any additional notes or remarks..."
                                    className="jo-allocation-textarea"
                                />
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="jo-allocation-error">
                                    {error}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="jo-allocation-actions">
                                <button
                                    type="button"
                                    onClick={() => navigate('/jo-incentives')}
                                    className="jo-allocation-btn-cancel"
                                    disabled={loading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="jo-allocation-btn-submit"
                                    disabled={loading}
                                >
                                    {loading ? '💾 Saving...' : '✅ Create Allocation'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JoCreateAllocation;
