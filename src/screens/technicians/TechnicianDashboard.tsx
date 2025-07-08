import { useNavigate } from "react-router-dom";
import React, { useState, useEffect } from 'react';
import FarmlandMap from '../../components/Map/FarmlandMap';
import "../../assets/css/App.css";
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
}

const TechnicianDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [farmerRecords, setFarmerRecords] = useState<FarmerRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchFarmerRecords();
    }, []);

    const fetchFarmerRecords = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/farmers');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            // Ensure all records have the required fields with default values
            const validatedData = data
                .map((record: any) => ({
                    id: record.id || `temp-${Math.random().toString(36).substr(2, 9)}`,
                    firstName: record["FIRST NAME"] || record.firstName || '',
                    middleName: record["MIDDLE NAME"] || record.middleName || '',
                    surname: record["LAST NAME"] || record.surname || '',
                    gender: record["GENDER"] || record.gender || 'Male',
                    area: parseFloat(record["PARCEL AREA"] || record.area) || 0,
                    status: record.status || 'Farmer',
                    barangay: record["FARMER ADDRESS 2"] || record.barangay || '',
                    farmType: record["FARM TYPE"] || record.farmType || 'Irrigated'
                }))
                .filter((record: any) => record.firstName && record.surname); // Only show records with names
            setFarmerRecords(validatedData);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching farmer records:', error);
            setError('Failed to load farmer records');
            setLoading(false);
        }
    };

    const getStatusClass = (status: string | undefined) => {
        if (!status) return 'status-farmer';
        return `status-${status.toLowerCase().replace(' ', '-')}`;
    };

    return (
        <div className="dashboard-container">
            {/* Top Menu - customize for technician */}
            <nav className="top-menu">
                <button onClick={() => navigate("/technician-dashboard")}>Home</button>
                <button onClick={() => navigate("/technician-add-farmer")}>Add Farmer</button>
                <button onClick={() => navigate("/technician-stakeholders")}>Stakeholders</button>
                <button onClick={() => navigate("/")}>Logout</button>
            </nav>

            <div className="dashboard-grid">
                {/* Left Sidebar */}
                <aside className="sidebar">
                    <input
                        type="text"
                        placeholder="Search..."
                        className="search-bar"
                    />
                    <div className="location-label">Lacturan</div>

                    {/* Quick Stats */}
                    <div className="quick-stats">
                        <div className="stat-item">
                            <h4>Total Farmers</h4>
                            <p>{farmerRecords.length}</p>
                        </div>
                        <div className="stat-item">
                            <h4>Active Farmers</h4>
                            <p>{farmerRecords.filter(f => f?.status === 'Farmer').length}</p>
                        </div>
                        <div className="stat-item">
                            <h4>Tenants</h4>
                            <p>{farmerRecords.filter(f => f?.status === 'Tenant').length}</p>
                        </div>
                        <div className="stat-item">
                            <h4>Land Owners</h4>
                            <p>{farmerRecords.filter(f => f?.status === 'Land Owner').length}</p>
                        </div>
                    </div>
                </aside>

                {/* Map and Stats */}
                <main className="map-area">
                    <div className="map-container">
                        <FarmlandMap />
                    </div>
                    <div className="dashboard-stats">
                        <div className="stat-card">
                            <h3>Recent Activities</h3>
                            <div className="activity-list">
                                {loading ? (
                                    <p>Loading activities...</p>
                                ) : error ? (
                                    <p>Error loading activities</p>
                                ) : farmerRecords.length === 0 ? (
                                    <p>No recent activities</p>
                                ) : (
                                    <ul>
                                        {farmerRecords.slice(0, 5).map((record) => (
                                            <li key={record.id || `activity-${Math.random().toString(36).substr(2, 9)}`}>
                                                <span className={`status-pill ${getStatusClass(record.status)}`}>
                                                    {record.status || 'Farmer'}
                                                </span>
                                                {record.firstName} {record.surname} - {record.barangay}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default TechnicianDashboard; 