// ActiveFarmerPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import "../assets/css/LandsPage.css";
import "../assets/css/ActiveFarmersPage.css";

interface FarmerRecord {
    id: string;
    name: string;
    area: number;
    coordinateAccuracy: 'exact' | 'approximate';
    barangay: string;
    firstName: string;
    middleName: string;
    surname: string;
    gender: 'Male' | 'Female';
    municipality: string;
    city: string;
    status: 'Tenant' | 'Land Owner' | 'Farmer';
    street: string;
    farmType: 'Irrigated' | 'Rainfed Upland' | 'Rainfed Lowland';
    createdAt: string;
    updatedAt: string;
}

const ActiveFarmerPage: React.FC = () => {
    const navigate = useNavigate();
    const [farmerRecords, setFarmerRecords] = useState<FarmerRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [openActionsRowId, setOpenActionsRowId] = useState<string | null>(null);
    const [selectedFarmerForStatus, setSelectedFarmerForStatus] = useState<FarmerRecord | null>(null);
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const internalIdCounter = useRef(0);

    const fetchFarmerRecords = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/farmers');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            console.log('Raw API response data:', data);

            const formattedData: FarmerRecord[] = data
                .map((record: any) => {
                    console.log('Processing record:', record);
                    // The API returns camelCase field names
                    const firstName = record.firstName || '';
                    const middleName = record.middleName || '';
                    const surname = record.surname || '';
                    const area = parseFloat(record.area) || 0;
                    const barangay = record.barangay || '';
                    const street = record.street || '';
                    const municipality = record.municipality || '';
                    const city = record.city || '';

                    const formatted = {
                        id: `${firstName}-${surname}-${Math.random()}`,
                        name: `${firstName} ${middleName || ''} ${surname || ''}`,
                        area: area,
                        coordinateAccuracy: 'approximate',
                        barangay: barangay,
                        firstName: firstName,
                        middleName: middleName,
                        surname: surname,
                        gender: record.gender || 'Male',
                        municipality: municipality,
                        city: city,
                        status: record.status || 'Farmer',
                        street: street,
                        farmType: record.farmType || 'Irrigated',
                        createdAt: record.createdAt || '',
                        updatedAt: record.updatedAt || '',
                    };
                    console.log('Formatted record:', formatted);
                    return formatted;
                })
                // Filter out records with missing required fields
                .filter((record: FarmerRecord) => {
                    const isValid = record.firstName && record.surname;
                    if (!isValid) {
                        console.log('Filtering out invalid record:', record);
                    }
                    return isValid;
                });

            console.log('Final formatted data:', formattedData);
            setFarmerRecords(formattedData);
            setLoading(false);
        } catch (err: any) {
            console.error('Error fetching farmer records:', err);
            setError(err.message);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFarmerRecords();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            const isClickOnActionsButton = !!target.closest('.action-more-button');
            const isClickInsideActionsDropdown = !!target.closest('.actions-dropdown');
            if (!isClickOnActionsButton && !isClickInsideActionsDropdown) {
                setOpenActionsRowId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this farmer record?')) {
            try {
                // Find the farmer record using the generated ID
                const farmerToDelete = farmerRecords.find(record => record.id === id);

                if (!farmerToDelete) {
                    console.error("Farmer not found for deletion in frontend state.");
                    return;
                }

                console.log('Found farmer to delete:', farmerToDelete);

                // Ensure we have valid values for all required fields
                if (!farmerToDelete.firstName || !farmerToDelete.surname) {
                    console.error("Invalid farmer data: missing required fields", {
                        firstName: farmerToDelete.firstName,
                        surname: farmerToDelete.surname,
                        fullRecord: farmerToDelete
                    });
                    return;
                }

                // Encode URI components for URL parameters
                const encodedFirstName = encodeURIComponent(farmerToDelete.firstName.trim());
                const encodedMiddleName = encodeURIComponent((farmerToDelete.middleName || '').trim());
                const encodedSurname = encodeURIComponent(farmerToDelete.surname.trim());
                const encodedArea = encodeURIComponent(farmerToDelete.area.toString());

                // Log the URL and parameters for debugging
                console.log('Farmer to delete:', farmerToDelete);
                console.log('Encoded parameters:', {
                    firstName: encodedFirstName,
                    middleName: encodedMiddleName,
                    surname: encodedSurname,
                    area: encodedArea
                });

                // Construct the URL with the backend server address
                const deleteUrl = `http://localhost:5000/api/farmers/${encodedFirstName}/${encodedMiddleName}/${encodedSurname}/${encodedArea}`;
                console.log('DELETE URL:', deleteUrl);

                const response = await fetch(deleteUrl, {
                    method: 'DELETE',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                });

                // Log the response status and headers
                console.log('Response status:', response.status);
                console.log('Response headers:', Object.fromEntries(response.headers.entries()));

                if (response.ok) {
                    console.log(`Farmer ${farmerToDelete.firstName} ${farmerToDelete.surname} deleted successfully from database.`);
                    // Remove from frontend state only after successful backend deletion
                    setFarmerRecords(farmerRecords.filter(record => record.id !== id));
                    setOpenActionsRowId(null);
                } else {
                    // Log the response text for debugging
                    const responseText = await response.text();
                    console.error('Error response:', responseText);
                    throw new Error(`Failed to delete record: ${response.status} ${response.statusText}`);
                }
            } catch (err: any) {
                console.error('Error deleting farmer record:', err);
                setError(err.message);
            }
        }
    };

    const handleUpdateStatus = (newStatus: 'Tenant' | 'Land Owner' | 'Farmer') => {
        // Remove status update functionality for admin
        console.log('Status updates are not allowed for admin users');
    };

    const handleEditFarmer = (id: string) => {
        const farmerToEdit = farmerRecords.find(record => record.id === id);

        if (!farmerToEdit) {
            console.error("Farmer not found for editing in frontend state.");
            return;
        }

        const encodedFirstName = encodeURIComponent(farmerToEdit.firstName);
        const encodedMiddleName = encodeURIComponent(farmerToEdit.middleName || '');
        const encodedSurname = encodeURIComponent(farmerToEdit.surname);
        const encodedArea = encodeURIComponent(farmerToEdit.area.toString());

        navigate(
            `/add-farmer/${encodedFirstName}/${encodedMiddleName}/${encodedSurname}/${encodedArea}`
        );
        setOpenActionsRowId(null);
    };

    const handleStatusClick = (farmer: FarmerRecord) => {
        // Remove status click handler for admin
        console.log('Status updates are not allowed for admin users');
    };

    const handleActionsButtonClick = (e: React.MouseEvent, recordId: string) => {
        e.stopPropagation();
        setOpenActionsRowId(openActionsRowId === recordId ? null : recordId);
    };

    const closeStatusModal = () => {
        setIsStatusModalOpen(false);
        setSelectedFarmerForStatus(null);
    };

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;

    return (
        <div className='active-farmer-page'>
            <div className="farmers-header">
                <div className="farmers-header-left">
                    <button className="back-button" onClick={() => navigate('/dashboard')}>←</button>
                    <h1 className="farmers-title">Stakeholders</h1>
                </div>
                <div className="farmers-header-right">
                    <input type="text" placeholder="Search farmers..." className="farmers-search-input" />
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
                                {farmerRecords.map((record) => (
                                    <tr key={record.id}>
                                        <td>{record.firstName}</td>
                                        <td>{record.middleName}</td>
                                        <td>{record.surname}</td>
                                        <td>{record.gender}</td>
                                        <td>{record.area}</td>
                                        <td className="status-cell">
                                            <span
                                                className={`status-pill ${record.status === 'Farmer'
                                                    ? 'status-active'
                                                    : record.status === 'Tenant'
                                                        ? 'status-tenant'
                                                        : 'status-landowner'
                                                    }`}
                                            >
                                                {record.status}
                                            </span>
                                        </td>
                                        <td>{record.barangay}</td>
                                        <td>{record.farmType}</td>
                                        <td>
                                            <div className="actions-container">
                                                <button
                                                    className="action-more-button"
                                                    onClick={(e) => handleActionsButtonClick(e, record.id)}
                                                >
                                                    ...
                                                </button>
                                                {openActionsRowId === record.id && (
                                                    <div className="actions-dropdown">
                                                        <div key="edit" onClick={() => handleEditFarmer(record.id)}>Edit</div>
                                                        <div key="delete" onClick={() => handleDelete(record.id)}>Delete</div>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="add-farmer-container">
                            <button className="add-farmer-button" onClick={() => navigate('/add-farmer')}>
                                + Add Farmer
                            </button>
                        </div>
                    </div>

                    {isStatusModalOpen && selectedFarmerForStatus && (
                        <div className="modal-overlay" onClick={closeStatusModal}>
                            <div className="status-modal" onClick={(e) => e.stopPropagation()}>
                                <div className="modal-header">
                                    <h3>Update Status for {selectedFarmerForStatus.name}</h3>
                                    <button className="close-button" onClick={closeStatusModal}>×</button>
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
                                        <p><strong>Address:</strong> {selectedFarmerForStatus.street}, {selectedFarmerForStatus.barangay}, {selectedFarmerForStatus.city}</p>
                                        <p><strong>Gender:</strong> {selectedFarmerForStatus.gender}</p>
                                        <p><strong>Area:</strong> {selectedFarmerForStatus.area} ha</p>
                                    </div>
                                    <div className="status-options">
                                        <h4>Select New Status:</h4>
                                        <div className="status-buttons">
                                            <button
                                                key="farmer"
                                                className="status-option-btn status-option-active"
                                                onClick={() => handleUpdateStatus('Farmer')}
                                            >
                                                <span className="status-dot status-active"></span>
                                                Farmer
                                            </button>
                                            <button
                                                key="tenant"
                                                className="status-option-btn status-option-tenant"
                                                onClick={() => handleUpdateStatus('Tenant')}
                                            >
                                                <span className="status-dot status-tenant"></span>
                                                Tenant
                                            </button>
                                            <button
                                                key="landowner"
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
            </div>
        </div>
    );
};

export default ActiveFarmerPage;
