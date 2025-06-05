// ActiveFarmerPage.tsx
import React, { useState, useEffect, useRef } from 'react'; // Added useRef
import { useNavigate } from 'react-router-dom';
import "../assets/css/LandsPage.css";
import "../assets/css/ActiveFarmersPage.css";

// For generating unique IDs (simple counter example, consider UUID for more robustness)
// let nextInternalId = 0; // This would reset on re-renders if not handled correctly. Use useRef.

interface FarmerRecord {
    id: number; // Original ID from API, may not be unique
    _internalId: string; // Client-side unique ID
    "FIRST NAME": string;
    "MIDDLE NAME": string | null;
    "EXT NAME": string | null;
    "GENDER": string;
    "BIRTHDATE": string;
    "FARMER ADDRESS 1": string;
    "FARMER ADDRESS 2": string;
    "FARMER ADDRESS 3": string;
    "PARCEL NO.": string;
    "PARCEL ADDRESS": string;
    "PARCEL AREA": string;
    status?: string;
}

const ActiveFarmerPage: React.FC = () => {
    const navigate = useNavigate();
    const [farmerRecords, setFarmerRecords] = useState<FarmerRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [openActionsRowId, setOpenActionsRowId] = useState<string | null>(null); // Changed to string for _internalId
    const [selectedFarmerForStatus, setSelectedFarmerForStatus] = useState<FarmerRecord | null>(null);
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const internalIdCounter = useRef(0); // Ref to keep counter persistent across re-renders

    const fetchFarmerRecords = async () => {
        try {
            const response = await fetch('/api/lands');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data: Omit<FarmerRecord, '_internalId'>[] = await response.json(); // Data from API won't have _internalId

            setFarmerRecords(prevRecords => {
                const updatedRecords = data.map((newRecord, index) => {
                    // Attempt to find an existing record. This part is complex if API IDs are not unique.
                    // For this example, we assume we're mostly adding new _internalId or preserving them if somehow matched.
                    // A more robust matching would be needed if prevRecords could contain items not in `data` anymore.
                    const existingRecord = prevRecords.find(oldRecord => oldRecord.id === newRecord.id && oldRecord["FIRST NAME"] === newRecord["FIRST NAME"] /* Add more fields for better matching if API ID is not unique */);

                    const internalId = existingRecord?._internalId || `farmer-${internalIdCounter.current++}`;

                    return {
                        ...newRecord,
                        _internalId: internalId, // Assign client-side unique ID
                        status: existingRecord?.status || (index % 3 === 0 ? "Active Farmer" : index % 3 === 1 ? "Tenant" : "Land Owner") // Default status based on index or preserved status
                    };
                });
                return updatedRecords;
            });

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFarmerRecords();
    }, []); // Runs once on mount

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

    const handleDelete = async (apiId: number, internalId: string) => { // Takes apiId for backend, internalId for frontend
        if (window.confirm('Are you sure you want to delete this farmer record?')) {
            try {
                // Backend deletion should use the API's identifier (apiId)
                const response = await fetch(`/api/lands/${apiId}`, { method: 'DELETE' });
                if (response.ok) {
                    setFarmerRecords(farmerRecords.filter(record => record._internalId !== internalId));
                    setOpenActionsRowId(null);
                } else {
                    // If backend fails because apiId is not unique, this will be an issue
                    throw new Error(`Failed to delete record with apiId: ${apiId}`);
                }
            } catch (err: any) {
                setError(err.message);
            }
        }
    };

    const handleUpdateStatus = (newStatus: string) => {
        if (selectedFarmerForStatus) {
            const updatedFarmerInternalId = selectedFarmerForStatus._internalId; // Use internal unique ID
            setFarmerRecords(prev =>
                prev.map(record =>
                    record._internalId === updatedFarmerInternalId ? { ...record, status: newStatus } : record
                )
            );
            setIsStatusModalOpen(false);
            setSelectedFarmerForStatus(null);
            // Note: If you need to persist this change to the backend,
            // you'll need to identify the record using its original API ID (`selectedFarmerForStatus.id`).
            // Example: updateFarmerStatusApi(selectedFarmerForStatus.id, newStatus);
            // This can be problematic if selectedFarmerForStatus.id is not unique on the backend.
        }
    };

    const handleEditFarmer = (apiId: number, internalId: string) => { // Takes apiId for backend, internalId for frontend
        console.log(`Edit Farmer button clicked for API ID: ${apiId}, Internal ID: ${internalId}`);
        // Navigation or modal for editing would likely use internalId for consistency if editing client-side state,
        // but API interactions would need apiId.
        setOpenActionsRowId(null);
    };

    const handleStatusClick = (farmer: FarmerRecord) => {
        setSelectedFarmerForStatus({ ...farmer });
        setIsStatusModalOpen(true);
        setOpenActionsRowId(null);
    };

    const handleActionsButtonClick = (e: React.MouseEvent, recordInternalId: string) => { // Use internalId
        e.stopPropagation();
        setOpenActionsRowId(openActionsRowId === recordInternalId ? null : recordInternalId);
    };

    const closeStatusModal = () => {
        setIsStatusModalOpen(false);
        setSelectedFarmerForStatus(null);
    };

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;

    return (
        <div className='active-farmer-page'>
            <div className="farmers-container">
                <div className="farmers-header">
                    <div className="farmers-header-left">
                        <button className="back-button" onClick={() => navigate('/dashboard')}>←</button>
                        <h1 className="farmers-title">Active Farmers</h1>
                    </div>
                    <div className="farmers-header-right">
                        <input type="text" placeholder="Search farmers..." className="farmers-search-input" />
                    </div>
                </div>

                <div className="farmers-table-container">
                    <table className="farmers-table">
                        <thead>
                            <tr>
                                <th>First Name</th>
                                <th>Middle Name</th>
                                {/* ... other headers ... */}
                                <th>Ext Name</th>
                                <th>Gender</th>
                                <th>Birthdate</th>
                                <th>Address 1</th>
                                <th>Address 2</th>
                                <th>Address 3</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {farmerRecords.map((record) => (
                                <tr key={record._internalId}> {/* Use _internalId for React key */}
                                    <td>{record["FIRST NAME"]}</td>
                                    <td>{record["MIDDLE NAME"]}</td>
                                    <td>{record["EXT NAME"]}</td>
                                    <td>{record["GENDER"]}</td>
                                    <td>{record["BIRTHDATE"]}</td>
                                    <td>{record["FARMER ADDRESS 1"]}</td>
                                    <td>{record["FARMER ADDRESS 2"]}</td>
                                    <td>{record["FARMER ADDRESS 3"]}</td>
                                    <td className="status-cell">
                                        <span
                                            className={`status-pill ${record.status === 'Active Farmer'
                                                ? 'status-active'
                                                : record.status === 'Tenant'
                                                    ? 'status-tenant'
                                                    : record.status === 'Land Owner'
                                                        ? 'status-landowner'
                                                        : 'status-unknown'
                                                }`}
                                            onClick={() => handleStatusClick({ ...record })}
                                        >
                                            {record.status || 'N/A'}
                                        </span>
                                    </td>
                                    <td className="actions-cell">
                                        <div className="actions-container">
                                            <button
                                                className="action-more-button"
                                                onClick={(e) => handleActionsButtonClick(e, record._internalId)} // Use _internalId
                                            >
                                                ...
                                            </button>
                                            {openActionsRowId === record._internalId && ( // Use _internalId
                                                <div className="actions-dropdown">
                                                    {/* Pass both IDs if necessary, or primarily internalId for UI consistency */}
                                                    <div onClick={() => handleEditFarmer(record.id, record._internalId)}>Edit</div>
                                                    <div onClick={() => handleDelete(record.id, record._internalId)}>Delete</div>
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

                {/* Status Modal */}
                {isStatusModalOpen && selectedFarmerForStatus && (
                    <div className="modal-overlay" onClick={closeStatusModal}>
                        <div className="status-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>Update Status for {selectedFarmerForStatus["FIRST NAME"]}</h3>
                                <button className="close-button" onClick={closeStatusModal}>×</button>
                            </div>
                            <div className="modal-content">
                                <div className="farmer-info">
                                    <p><strong>Current Status:</strong>
                                        <span className={`status-pill ${selectedFarmerForStatus.status === 'Active Farmer'
                                            ? 'status-active'
                                            : selectedFarmerForStatus.status === 'Tenant'
                                                ? 'status-tenant'
                                                : selectedFarmerForStatus.status === 'Land Owner'
                                                    ? 'status-landowner'
                                                    : 'status-unknown'
                                            }`}>
                                            {selectedFarmerForStatus.status || 'N/A'}
                                        </span>
                                    </p>
                                    {/* ... other farmer info ... */}
                                    <p><strong>Full Name:</strong> {selectedFarmerForStatus["FIRST NAME"]} {selectedFarmerForStatus["MIDDLE NAME"] || ''} {selectedFarmerForStatus["EXT NAME"] || ''}</p>
                                    <p><strong>Address:</strong> {selectedFarmerForStatus["FARMER ADDRESS 1"]}, {selectedFarmerForStatus["FARMER ADDRESS 2"]}, {selectedFarmerForStatus["FARMER ADDRESS 3"]}</p>
                                    <p><strong>Gender:</strong> {selectedFarmerForStatus["GENDER"]}</p>
                                    <p><strong>Birthdate:</strong> {selectedFarmerForStatus["BIRTHDATE"]}</p>
                                </div>
                                <div className="status-options">
                                    <h4>Select New Status:</h4>
                                    <div className="status-buttons">
                                        <button
                                            className="status-option-btn status-option-active"
                                            onClick={() => handleUpdateStatus('Active Farmer')}
                                        >
                                            <span className="status-dot status-active"></span>
                                            Active Farmer
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
        </div>
    );
};

export default ActiveFarmerPage;