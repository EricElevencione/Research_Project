import React from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import '../../assets/css/jo css/JoIncentStyle.css';
import '../../assets/css/navigation/nav.css';
import DistributionIcon from '../../assets/images/distribution.png'
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import MasterlistIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';
import LandRecsIcon from '../../assets/images/landrecord.png';
import FarmerRequestIcon from '../../assets/images/request.png';
import { useState } from 'react';

const JoIncentives: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;

    const [farmers, setFarmers] = useState([
        { id: 1, name: "Juan Dela Cruz", qty_requested: 50 },
        { id: 2, name: "Maria Santos", qty_requested: 30 },
        { id: 3, name: "Pedro Reyes", qty_requested: 40 },
        { id: 4, name: "Ana Garcia", qty_requested: 25 },
    ]);

    const [openMenuId, setOpenMenuId] = useState<number | null>(null);
    const [openFormId, setOpenFormId] = useState<number | null>(null);
    const [formQty, setFormQty] = useState<string>('');
    const [formType, setFormType] = useState<string>('');


    const openRecordForm = (farmerId: number) => {
        setOpenMenuId(null);
        setOpenFormId(farmerId);
        // Clear form inputs when opening
        setFormQty('');
        setFormType('');
    };

    const toggleMenu = (farmerId: number) => {
        if (openMenuId === farmerId) {
            setOpenMenuId(null);
        } else {
            setOpenMenuId(farmerId);
        }
    }

    const saveIncentive = (farmerId: number, qtyReceived: string, incentiveType: string) => {
        // Step 2: Prepare variables
        const id = farmerId;
        const qty = parseFloat(qtyReceived); // Convert text to number
        const type = incentiveType;

        // Step 3: Find the farmer
        const farmer = farmers.find(f => f.id === id);

        if (!farmer) {
            alert('❌ Error: Farmer not found!');
            return;
        }

        // Step 4: Validate quantity
        if (!qtyReceived || qty <= 0) {
            alert('❌ Error: Please enter a valid quantity!');
            return;
        }

        if (qty > farmer.qty_requested) {
            alert(`❌ Error: Received (${qty} kg) cannot exceed requested (${farmer.qty_requested} kg)!`);
            return;
        }

        // Step 4b: Validate type
        if (!type) {
            alert('❌ Error: Please select an incentive type!');
            return;
        }

        // Step 5: Update the farmer (we'll modify the array)
        const updatedFarmers = farmers.map(f => {
            if (f.id === id) {
                return {
                    ...f,
                    qty_received: qty,
                    incentive_type: type
                };
            }
            return f;
        });

        setFarmers(updatedFarmers);

        // Step 6: Update state (this will re-render the table)
        // Note: Since we used const [farmers] = useState(), 
        // we need to change this to const [farmers, setFarmers] = useState()
        // I'll show you how in Part C

        // Step 7: Close the form
        setOpenFormId(null);
        setOpenMenuId(null);

        // Step 8: Clear form inputs
        setFormQty('');
        setFormType('');

        // Step 8: Show success message
        alert(`✅ Success! Saved ${qty} kg of ${type} for ${farmer.name}`);
    };



    const createFarmerRow = (farmer: any) => {

        // Step 2: Prepare the pieces (get farmer's info)
        const farmerName = farmer.name;           // e.g., "Juan Dela Cruz"
        const qtyRequested = farmer.qty_requested; // e.g., 50
        const qtyReceived = farmer.qty_received || '';      // Get from farmer data
        const incentiveType = farmer.incentive_type || '';  // Get from farmer data

        // Step 3: Build the row structure (HTML)
        return (
            <>
                {/* First row: The farmer data */}
                <tr key={farmer.id}>
                    {/* Cell 1: Farmer Name */}
                    <td>{farmerName}</td>

                    {/* Cell 2: Quantity Requested */}
                    <td>{qtyRequested} kg</td>

                    {/* Cell 3: Quantity Received (empty at first) */}
                    <td>{qtyReceived || '—'}</td>

                    {/* Cell 4: Incentive Type (empty at first) */}
                    <td>{incentiveType || '—'}</td>

                    {/* Cell 5: Three-dot button with menu */}
                    <td style={{ position: 'relative' }}>
                        <button
                            className="three-dot-btn"
                            onClick={() => toggleMenu(farmer.id)}
                        >
                            ⋯
                        </button>

                        {openMenuId === farmer.id && (
                            <div className="three-dot-menu">
                                <button className="menu-item"
                                    onClick={() => openRecordForm(farmer.id)}
                                >
                                    📝 Record Later
                                </button>
                            </div>
                        )}
                    </td>
                </tr>

                {/* Second row: The form (only shows when openFormId matches) */}
                {openFormId === farmer.id && (
                    <tr className="form-row">
                        <td colSpan={5}>
                            <div className="record-form">
                                <h4>Record Incentive for {farmerName}</h4>

                                <div className="form-fields">
                                    <div className="form-field">
                                        <label>Quantity Received (kg):</label>
                                        <input
                                            type="number"
                                            placeholder="Enter quantity"
                                            max={qtyRequested}
                                            value={formQty}
                                            onChange={(e) => setFormQty(e.target.value)}
                                        />
                                    </div>

                                    <div className="form-field">
                                        <label>Incentive Type:</label>
                                        <select
                                            value={formType}
                                            onChange={(e) => setFormType(e.target.value)}
                                        >
                                            <option value="">Select type...</option>
                                            <option value="Cash">Cash</option>
                                            <option value="Seeds">Seeds</option>
                                            <option value="Tools">Tools</option>
                                            <option value="Training">Training</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="form-actions">
                                    <button
                                        className="btn-save"
                                        onClick={() => saveIncentive(farmer.id, formQty, formType)}
                                    >
                                        💾 Save
                                    </button>
                                    <button
                                        className="btn-cancel"
                                        onClick={() => setOpenFormId(null)}
                                    >
                                        ❌ Cancel
                                    </button>
                                </div>
                            </div>
                        </td>
                    </tr>
                )}
            </>
        );
    };

    return (
        <div className="page-container">

            <div className="page">

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

                {/* Main content starts here */}
                <div className="main-content">

                    <div className="dashboard-header-incent">
                        <h2 className="page-header">Incentives Distribution</h2>
                    </div>

                    <div className="content-card-incent">
                        <table className="farmers-table">
                            <thead>
                                <tr>
                                    <th>Farmer Name</th>
                                    <th>Quantity Requested</th>
                                    <th>Quantity Received</th>
                                    <th>Incentive Type</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* 🤖 USE ROBOT #1 HERE! */}
                                {farmers.map((farmer: any) => createFarmerRow(farmer))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

    );
};

export default JoIncentives;
