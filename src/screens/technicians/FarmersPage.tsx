import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import "../../assets/css/ActiveFarmersPage.css";

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

const FarmersPage: React.FC = () => {
    const navigate = useNavigate();
    const [farmerRecords, setFarmerRecords] = useState<FarmerRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFarmer, setSelectedFarmer] = useState<FarmerRecord | null>(null);
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

    useEffect(() => {
        fetchFarmerRecords();
    }, []);

    const fetchFarmerRecords = async () => {
        try {
            const response = await fetch('/api/lands');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            setFarmerRecords(data);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching farmer records:', error);
            setError('Failed to load farmer records');
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (newStatus: 'Tenant' | 'Land Owner' | 'Farmer') => {
        if (selectedFarmer) {
            try {
                const response = await fetch(`/api/lands/${selectedFarmer.id}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ status: newStatus }),
                });

                if (!response.ok) throw new Error('Failed to update status');

                setFarmerRecords(prev =>
                    prev.map(record =>
                        record.id === selectedFarmer.id
                            ? { ...record, status: newStatus }
                            : record
                    )
                );
                setIsStatusModalOpen(false);
                setSelectedFarmer(null);
            } catch (error) {
                console.error('Error updating status:', error);
                alert('Failed to update status. Please try again.');
            }
        }
    };

    const handleStatusClick = (farmer: FarmerRecord) => {
        setSelectedFarmer(farmer);
        setIsStatusModalOpen(true);
    };

    const filteredFarmers = farmerRecords.filter(farmer => {
        const searchLower = searchQuery.toLowerCase();
        return (
            farmer.firstName.toLowerCase().includes(searchLower) ||
            farmer.surname.toLowerCase().includes(searchLower) ||
            farmer.barangay.toLowerCase().includes(searchLower) ||
            farmer.status.toLowerCase().includes(searchLower)
        );
    });

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;

    return (
        <div className='active-farmer-page'>
            <div className="farmers-header">
                <div className="farmers-header-left">
                    <button className="back-button" onClick={() => navigate('/technician-dashboard')}>←</button>
                    <h1 className="farmers-title">Farmers</h1>
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
                        onClick={() => navigate('/add-farmer')}
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
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredFarmers.map((record) => (
                                    <tr key={record.id}>
                                        <td>{record.firstName}</td>
                                        <td>{record.middleName}</td>
                                        <td>{record.surname}</td>
                                        <td>{record.gender}</td>
                                        <td>{record.area}</td>
                                        <td className="status-cell">
                                            <span
                                                className={`status-pill ${record.status.toLowerCase().replace(' ', '-')}`}
                                                onClick={() => handleStatusClick(record)}
                                            >
                                                {record.status}
                                            </span>
                                        </td>
                                        <td>{record.barangay}</td>
                                        <td>{record.farmType}</td>
                                        <td className="actions-cell">
                                            <button
                                                className="action-button"
                                                onClick={() => navigate(`/edit-farmer/${record.id}`)}
                                            >
                                                Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {isStatusModalOpen && selectedFarmer && (
                <div className="modal-overlay" onClick={() => setIsStatusModalOpen(false)}>
                    <div className="status-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Update Status for {selectedFarmer.firstName} {selectedFarmer.surname}</h3>
                            <button className="close-button" onClick={() => setIsStatusModalOpen(false)}>×</button>
                        </div>
                        <div className="modal-content">
                            <div className="farmer-info">
                                <p><strong>Current Status:</strong>
                                    <span className={`status-pill ${selectedFarmer.status.toLowerCase().replace(' ', '-')}`}>
                                        {selectedFarmer.status}
                                    </span>
                                </p>
                                <p><strong>Full Name:</strong> {selectedFarmer.firstName} {selectedFarmer.middleName} {selectedFarmer.surname}</p>
                                <p><strong>Barangay:</strong> {selectedFarmer.barangay}</p>
                                <p><strong>Gender:</strong> {selectedFarmer.gender}</p>
                                <p><strong>Area:</strong> {selectedFarmer.area} ha</p>
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

export default FarmersPage; 