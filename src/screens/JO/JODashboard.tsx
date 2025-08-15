import { useNavigate } from "react-router-dom";
import React, { useState, useEffect } from 'react';
import FarmlandMap from '../../components/Map/FarmlandMap';
import "../../assets/css/App.css";
import "../../assets/css/JOdashStyle.css";

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

const JODashboard: React.FC = () => {
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
            {/* Top Menu - customize for JO */}
            <nav className="top-menu">
                <button onClick={() => navigate("/jo-farmers")}>Farmers</button>
                <button onClick={() => navigate("/jo-rsbsa")}>RSBSA</button>
                <button onClick={() => navigate("/jo-land-records")}>Land Records</button>
                <button onClick={() => navigate("/jo-reports")}>Reports</button>
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
                </aside>

                {/* Map and Stats */}
                <main className="map-area">
                    <div className="map-container">
                        <FarmlandMap />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default JODashboard; 