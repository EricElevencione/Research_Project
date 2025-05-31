import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import "../assets/css/LandsPage.css";
import "../assets/css/ActiveFarmersPage.css";

interface FarmerRecord {
    id: number;
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
    const [openActionsRowId, setOpenActionsRowId] = useState<number | null>(null);
    const [openStatusRowId, setOpenStatusRowId] = useState<number | null>(null);
    const statusDropdownRef = useRef<HTMLDivElement>(null);
    const actionsDropdownRef = useRef<HTMLDivElement>(null);

    const fetchFarmerRecords = async () => {
        try {
            const response = await fetch('/api/lands');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            const recordsWithStatus = data.map((record: FarmerRecord) => ({
                ...record,
                status: (record.id % 3 === 0) ? "Active Farmer" : (record.id % 3 === 1) ? "Tenant" : "Land Owner"
            }));
            setFarmerRecords(recordsWithStatus);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFarmerRecords();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Check if the click is outside the status dropdown and its trigger
            if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
                // Additionally, check if the click was on the status pill itself (the trigger)
                // You might need a ref for the status pill or check its class name if stopPropagation isn't enough
                // For now, let's rely on stopPropagation on the status-cell td
                setOpenStatusRowId(null);
            }

            // Check if the click is outside the actions dropdown and its trigger
            if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(event.target as Node)) {
                // Additionally, check if the click was on the '...' button itself (the trigger)
                // You might need a ref for the button or check its class name if stopPropagation isn't enough
                // For now, let's rely on stopPropagation on the action-more-button
                setOpenActionsRowId(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [openActionsRowId, openStatusRowId]); // Add dependencies

    const handleDelete = async (id: number) => {
        if (window.confirm('Are you sure you want to delete this farmer record?')) {
            try {
                const response = await fetch(`/api/lands/${id}`, {
                    method: 'DELETE',
                });

                if (response.ok) {
                    setFarmerRecords(farmerRecords.filter(record => record.id !== id));
                    setOpenActionsRowId(null);
                } else {
                    throw new Error('Failed to delete record');
                }
            } catch (err: any) {
                setError(err.message);
            }
        }
    };

    const handleUpdateStatus = (id: number, newStatus: string) => {
        console.log(`Attempting to update status for ID ${id} to ${newStatus}`);
        console.log('Farmer records before update:', farmerRecords);

        setFarmerRecords(farmerRecords.map(record =>
            record.id === id ? { ...record, status: newStatus } : record
        ));

        // Note: State updates are asynchronous. The console.log below might not show the *immediately* updated state
        // in some React versions/environments. Use the React DevTools for a definitive check.
        console.log('Farmer records after attempting update (check React DevTools for confirmation):', farmerRecords);

        setOpenStatusRowId(null);
    };

    const handleEditFarmer = (id: number) => {
        console.log(`Edit Farmer button clicked for ID: ${id}`);
        setOpenActionsRowId(null);
    };

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;

    return (
        <div className='active-farmer-page'>
            <div className="farmers-container">
                <div className="farmers-header">
                    <div className="farmers-header-left">
                        <button className="back-button" onClick={() => navigate('/dashboard')}>
                            ←
                        </button>
                        <h1 className="farmers-title">Active Farmers</h1>
                    </div>
                    <div className="farmers-header-right">
                        <input
                            type="text"
                            placeholder="Search farmers..."
                            className="farmers-search-input"
                        />
                    </div>
                </div>

                <div className="farmers-table-container">
                    <table className="farmers-table">
                        <thead>
                            <tr>
                                <th>First Name</th>
                                <th>Middle Name</th>
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
                                <tr key={record.id}>
                                    <td>{record["FIRST NAME"]}</td>
                                    <td>{record["MIDDLE NAME"]}</td>
                                    <td>{record["EXT NAME"]}</td>
                                    <td>{record["GENDER"]}</td>
                                    <td>{record["BIRTHDATE"]}</td>
                                    <td>{record["FARMER ADDRESS 1"]}</td>
                                    <td>{record["FARMER ADDRESS 2"]}</td>
                                    <td>{record["FARMER ADDRESS 3"]}</td>
                                    <td className="status-cell" onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenStatusRowId(openStatusRowId === record.id ? null : record.id);
                                        setOpenActionsRowId(null);
                                    }}>
                                        <span className={`status-pill status-${record.status?.toLowerCase().replace(/\s/g, '') || 'unknown'}`}>
                                            {record.status || 'N/A'}
                                        </span>
                                        {openStatusRowId === record.id && (
                                            <div ref={statusDropdownRef} className="status-dropdown">
                                                <div className="status-option status-set-status">
                                                    Set a status
                                                </div>
                                                <div className="status-option status-option-active" onClick={() => handleUpdateStatus(record.id, 'Active Farmer')}>
                                                    <span className="status-dot status-active"></span>
                                                    Active Farmer
                                                </div>
                                                <div className="status-option status-option-tenant" onClick={() => handleUpdateStatus(record.id, 'Tenant')}>
                                                    <span className="status-dot status-tenant"></span>
                                                    Tenant
                                                </div>
                                                <div className="status-option status-option-landowner" onClick={() => handleUpdateStatus(record.id, 'Land Owner')}>
                                                    <span className="status-dot status-landowner"></span>
                                                    Land Owner
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="actions-cell">
                                        <button
                                            className="action-more-button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenActionsRowId(openActionsRowId === record.id ? null : record.id);
                                                setOpenStatusRowId(null);
                                            }}
                                        >
                                            ...
                                        </button>
                                        {openActionsRowId === record.id && (
                                            <div ref={actionsDropdownRef} className="actions-dropdown">
                                                <div onClick={() => handleEditFarmer(record.id)}>Edit</div>
                                                <div onClick={() => handleDelete(record.id)}>Delete</div>
                                            </div>
                                        )}
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
            </div>
        </div>
    );
};

export default ActiveFarmerPage;