import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import "../assets/css/ActiveFarmersPage.css";

interface FarmerRecord {
    id: string;
    firstName: string;
    middleName: string;
    surname: string;
    gender: 'Male' | 'Female';
    area: number;
    status: 'Tenant' | 'Land Owner' | 'Farmer';
    barangay: string;
    farmType: 'Irrigated' | 'Rainfed Upland' | 'Rainfed Lowland';
    createdAt: string;
    updatedAt: string;
}

const TechnicianStakeholdersPage: React.FC = () => {
    const navigate = useNavigate();
    const [farmerRecords, setFarmerRecords] = useState<FarmerRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFarmer, setSelectedFarmer] = useState<FarmerRecord | null>(null);
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const [selectedFarmerForStatus, setSelectedFarmerForStatus] = useState<FarmerRecord | null>(null);
    const [openActionsRowId, setOpenActionsRowId] = useState<string | null>(null);

    useEffect(() => {
        fetchFarmerRecords();
    }, []);

    const fetchFarmerRecords = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/farmers');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error("Server did not return JSON");
            }
            const data = await response.json();
            console.log('API data:', data);
            // Ensure all records have the required fields with default values
            const validatedData = data
                .map((record: any) => ({
                    id: record.id || '',
                    firstName: record["FIRST NAME"] || record.firstName || '',
                    middleName: record["MIDDLE NAME"] || record.middleName || '',
                    surname: record["LAST NAME"] || record.surname || '',
                    gender: record["GENDER"] || record.gender || 'Male',
                    area: parseFloat(record["PARCEL AREA"] || record.area) || 0,
                    status: record.status || 'Farmer',
                    barangay: record["FARMER ADDRESS 2"] || record.barangay || '',
                    farmType: record["FARM TYPE"] || record.farmType || 'Irrigated',
                    createdAt: record.createdAt || new Date().toISOString(),
                    updatedAt: record.updatedAt || new Date().toISOString()
                }))
                .filter((record: any) => record.firstName && record.surname && record.id); // Only show records with names and valid id
            setFarmerRecords(validatedData);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching farmer records:', error);
            setError('Failed to load farmer records. Please try again later.');
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (newStatus: 'Tenant' | 'Land Owner' | 'Farmer') => {
        if (selectedFarmerForStatus) {
            if (!selectedFarmerForStatus.id) {
                alert('Cannot update status: This record does not have a valid ID.');
                return;
            }
            try {
                const response = await fetch(`http://localhost:5000/api/farmers/${selectedFarmerForStatus.id}/status`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ status: newStatus }),
                });

                if (!response.ok) {
                    throw new Error('Failed to update status');
                }

                // Update local state
                setFarmerRecords(prev =>
                    prev.map(record =>
                        record.id === selectedFarmerForStatus.id
                            ? { ...record, status: newStatus }
                            : record
                    )
                );
                setIsStatusModalOpen(false);
                setSelectedFarmerForStatus(null);
            } catch (error) {
                console.error('Error updating status:', error);
                alert('Failed to update status. Please try again.');
            }
        }
    };

    const handleStatusClick = (farmer: FarmerRecord) => {
        setSelectedFarmerForStatus(farmer);
        setIsStatusModalOpen(true);
        setOpenActionsRowId(null);
    };

    const filteredFarmers = farmerRecords.filter(farmer => {
        const searchLower = searchQuery.toLowerCase();
        return (
            (farmer.firstName?.toLowerCase() || '').includes(searchLower) ||
            (farmer.surname?.toLowerCase() || '').includes(searchLower) ||
            (farmer.barangay?.toLowerCase() || '').includes(searchLower) ||
            (farmer.status?.toLowerCase() || '').includes(searchLower)
        );
    });

    if (loading) return <div className="loading-message">Loading...</div>;
    if (error) return <div className="error-message">Error: {error}</div>;

    return (
        <div className='active-farmer-page'>
            <div className="farmers-header">
                <div className="farmers-header-left">
                    <button className="back-button" onClick={() => navigate('/technician-dashboard')}>←</button>
                    <h1 className="farmers-title">Stakeholders</h1>
                </div>
                <div className="farmers-header-right">
                    <input
                        type="text"
                        placeholder="Search stakeholders..."
                        className="farmers-search-input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button
                        className="add-farmer-button"
                        onClick={() => navigate('/technician-add-farmer')}
                    >
                        Add New Stakeholder
                    </button>
                </div>
            </div>

            <div className="scrollable-content">
                <div className="farmers-container">
                    <div className="farmers-table-container">
                        <table className="farmers-table">
                            <thead>
                                <tr>
                                    <th>First Name</th>
                                    <th>Middle Name</th>
                                    <th>Surname</th>
                                    <th>Gender</th>
                                    <th>Area (ha)</th>
                                    <th>Status</th>
                                    <th>Barangay</th>
                                    <th>Farm Type</th>
                                    <th>Last Updated</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredFarmers.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="no-records">
                                            No stakeholders found
                                        </td>
                                    </tr>
                                ) : (
                                    filteredFarmers.map((record) => (
                                        <tr key={record.id || `${record.firstName}-${record.surname}-${record.area}`}>
                                            <td>{record.firstName || ''}</td>
                                            <td>{record.middleName || ''}</td>
                                            <td>{record.surname || ''}</td>
                                            <td>{record.gender || ''}</td>
                                            <td>{record.area || 0}</td>
                                            <td className="status-cell">
                                                <span
                                                    className={`status-pill ${record.status === 'Farmer'
                                                        ? 'status-active'
                                                        : record.status === 'Tenant'
                                                            ? 'status-tenant'
                                                            : 'status-landowner'
                                                        }`}
                                                    onClick={() => handleStatusClick(record)}
                                                >
                                                    {record.status}
                                                </span>
                                            </td>
                                            <td>{record.barangay || ''}</td>
                                            <td>{record.farmType || ''}</td>
                                            <td>{new Date(record.updatedAt).toLocaleDateString()}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {isStatusModalOpen && selectedFarmerForStatus && (
                <div className="modal-overlay" onClick={() => setIsStatusModalOpen(false)}>
                    <div className="status-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Update Status for {selectedFarmerForStatus.firstName} {selectedFarmerForStatus.surname}</h3>
                            <button className="close-button" onClick={() => setIsStatusModalOpen(false)}>×</button>
                        </div>
                        <div className="modal-content">
                            <div className="farmer-info">
                                <p><strong>Current Status:</strong>
                                    <span className={`status-pill ${selectedFarmerForStatus.status === 'Farmer'
                                        ? 'status-active'
                                        : selectedFarmerForStatus.status === 'Tenant'
                                            ? 'status-tenant'
                                            : 'status-landowner'
                                        }`}>
                                        {selectedFarmerForStatus.status}
                                    </span>
                                </p>
                                <p><strong>Full Name:</strong> {selectedFarmerForStatus.firstName} {selectedFarmerForStatus.middleName} {selectedFarmerForStatus.surname}</p>
                                <p><strong>Barangay:</strong> {selectedFarmerForStatus.barangay || ''}</p>
                                <p><strong>Gender:</strong> {selectedFarmerForStatus.gender || ''}</p>
                                <p><strong>Area:</strong> {selectedFarmerForStatus.area || 0} ha</p>
                                <p><strong>Last Updated:</strong> {new Date(selectedFarmerForStatus.updatedAt).toLocaleString()}</p>
                            </div>
                            <div className="status-options">
                                <h4>Select New Status:</h4>
                                <div className="status-buttons">
                                    <button
                                        className="status-option-btn status-option-active"
                                        onClick={() => handleUpdateStatus('Farmer')}
                                    >
                                        <span className="status-dot status-active"></span>
                                        Farmer
                                    </button>
                                    <button
                                        className="status-option-btn status-option-tenant"
                                        onClick={() => handleUpdateStatus('Tenant')}
                                    >
                                        <span className="status-dot status-tenant"></span>
                                        Tenant
                                    </button>
                                    <button
                                        className="status-option-btn status-option-landowner"
                                        onClick={() => handleUpdateStatus('Land Owner')}
                                    >
                                        <span className="status-dot status-landowner"></span>
                                        Land Owner
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TechnicianStakeholdersPage; 