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
    fertilizer_bags_given?: number;
    seed_kg_given?: number;
    fertilizer_type?: string;
    seed_type?: string;
    verification_notes?: string;
}

interface RegionalAllocation {
    id: number;
    season: string;
    allocation_date: string;
    status: string;
}

const JoDistribution: React.FC = () => {
    const navigate = useNavigate();
    const [distributions, setDistributions] = useState<DistributionRecord[]>([]);
    const [selectedSeason, setSelectedSeason] = useState('');
    const [allocations, setAllocations] = useState<RegionalAllocation[]>([]);
    const [loadingAllocations, setLoadingAllocations] = useState(true);
    const [viewDetailsModal, setViewDetailsModal] = useState<DistributionRecord | null>(null);

    const isActive = (path: string) => {
        return window.location.pathname === path;
    };

    useEffect(() => {
        fetchAllocations();
    }, []);

    useEffect(() => {
        if (selectedSeason) {
            fetchDistributions();
        }
    }, [selectedSeason]);

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

    const fetchDistributions = async () => { // Fetch distribution records based on selected season
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

    // Parse fertilizer_type and seed_type strings for display
    const parseFertilizerTypes = (fertilizerType: string | undefined) => {
        if (!fertilizerType) return [];
        return fertilizerType.split(', ').map(item => {
            const [type, amount] = item.split(':');
            return { type, amount: parseFloat(amount) };
        });
    };

    const parseSeedTypes = (seedType: string | undefined) => {
        if (!seedType) return [];
        return seedType.split(', ').map(item => {
            const [type, amount] = item.split(':');
            return { type, amount: parseFloat(amount) };
        });
    };

    const formatBreakdown = (items: Array<{ type: string; amount: number }>, limit?: number) => {
        if (items.length === 0) return 'None';
        const displayItems = limit ? items.slice(0, limit) : items;
        const formatted = displayItems.map(item => `${item.type}: ${item.amount}`).join(', ');
        if (limit && items.length > limit) {
            return formatted + ', ...';
        }
        return formatted;
    };

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
                    <h2>Distribution Logs</h2>
                    <p>View all approved farmer distributions organized by regional allocation</p>
                </div>

                {/* Distribution List */}
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
                                    <th>Farmer Name</th>
                                    <th>Fertilizers</th>
                                    <th>Seeds</th>
                                    <th>Date</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {distributions.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>
                                            No distribution records found for {selectedSeason}
                                        </td>
                                    </tr>
                                ) : (
                                    distributions.map((dist) => {
                                        const fertilizers = parseFertilizerTypes(dist.fertilizer_type);
                                        const seeds = parseSeedTypes(dist.seed_type);

                                        return (
                                            <tr key={dist.id}>
                                                <td>
                                                    <div><strong>{dist.farmer_name}</strong></div>
                                                    <div style={{ fontSize: '0.85em', color: '#666' }}>{dist.rsbsa_number}</div>
                                                </td>
                                                <td>{formatBreakdown(fertilizers, 2)}</td>
                                                <td>{formatBreakdown(seeds, 2)}</td>
                                                <td>{new Date(dist.distribution_date).toLocaleDateString()}</td>
                                                <td>
                                                    <button
                                                        className="distribution-btn-view-details"
                                                        onClick={() => setViewDetailsModal(dist)}
                                                    >
                                                        📋 View Details
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* View Details Modal */}
                    {viewDetailsModal && (
                        <div className="distribution-modal-overlay" onClick={() => setViewDetailsModal(null)}>
                            <div className="distribution-modal-content" onClick={(e) => e.stopPropagation()}>
                                <div className="distribution-modal-header">
                                    <h3>Distribution Details</h3>
                                    <button
                                        className="distribution-modal-close"
                                        onClick={() => setViewDetailsModal(null)}
                                    >
                                        ✕
                                    </button>
                                </div>

                                <div className="distribution-modal-body">
                                    <div className="distribution-detail-section">
                                        <h4>Farmer Information</h4>
                                        <div className="distribution-detail-grid">
                                            <div className="distribution-detail-item">
                                                <span className="detail-label">Name:</span>
                                                <span className="detail-value">{viewDetailsModal.farmer_name}</span>
                                            </div>
                                            <div className="distribution-detail-item">
                                                <span className="detail-label">RSBSA Number:</span>
                                                <span className="detail-value">{viewDetailsModal.rsbsa_number}</span>
                                            </div>
                                            <div className="distribution-detail-item">
                                                <span className="detail-label">Distribution Date:</span>
                                                <span className="detail-value">
                                                    {new Date(viewDetailsModal.distribution_date).toLocaleDateString('en-US', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric'
                                                    })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="distribution-detail-section">
                                        <h4>Fertilizers Distributed</h4>
                                        <div className="distribution-breakdown-list">
                                            {parseFertilizerTypes(viewDetailsModal.fertilizer_type).length > 0 ? (
                                                parseFertilizerTypes(viewDetailsModal.fertilizer_type).map((item, idx) => (
                                                    <div key={idx} className="distribution-breakdown-item">
                                                        <span className="breakdown-type">{item.type}</span>
                                                        <span className="breakdown-amount">{item.amount} bags</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="no-data">No fertilizers distributed</p>
                                            )}
                                            {parseFertilizerTypes(viewDetailsModal.fertilizer_type).length > 0 && (
                                                <div className="distribution-breakdown-total">
                                                    <span className="breakdown-type"><strong>Total Fertilizer</strong></span>
                                                    <span className="breakdown-amount">
                                                        <strong>{viewDetailsModal.fertilizer_bags_given || 0} bags</strong>
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="distribution-detail-section">
                                        <h4>Seeds Distributed</h4>
                                        <div className="distribution-breakdown-list">
                                            {parseSeedTypes(viewDetailsModal.seed_type).length > 0 ? (
                                                parseSeedTypes(viewDetailsModal.seed_type).map((item, idx) => (
                                                    <div key={idx} className="distribution-breakdown-item">
                                                        <span className="breakdown-type">{item.type}</span>
                                                        <span className="breakdown-amount">{item.amount} kg</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="no-data">No seeds distributed</p>
                                            )}
                                            {parseSeedTypes(viewDetailsModal.seed_type).length > 0 && (
                                                <div className="distribution-breakdown-total">
                                                    <span className="breakdown-type"><strong>Total Seeds</strong></span>
                                                    <span className="breakdown-amount">
                                                        <strong>{Number(viewDetailsModal.seed_kg_given || 0).toFixed(2)} kg</strong>
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {viewDetailsModal.verification_notes && (
                                        <div className="distribution-detail-section">
                                            <h4>Notes</h4>
                                            <p className="distribution-notes-text">{viewDetailsModal.verification_notes}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default JoDistribution;
