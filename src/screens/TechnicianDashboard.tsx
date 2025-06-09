import { useNavigate } from "react-router-dom";
import React from 'react';
import FarmlandMap from '../components/Map/FarmlandMap';
import "../assets/css/App.css";

const TechnicianDashboard: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="dashboard-container">
            {/* Top Menu - customize for technician */}
            <nav className="top-menu">
                <button onClick={() => navigate("/technician-dashboard")}>Home</button>
                {/* Add technician-specific navigation buttons here */}
                <button onClick={() => navigate("/lands")}>Lands</button>
                {/* Example: <button onClick={() => navigate("/technician-tasks")}>Tasks</button> */}
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
                    <div className="dashboard-stats">
                        {/* Add technician-specific stats or info here */}
                        <div className="stat-card">
                            <h3>Assigned Farmlands</h3>
                            <p>--</p>
                        </div>
                        <div className="stat-card">
                            <h3>Tasks Completed</h3>
                            <p>--</p>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default TechnicianDashboard; 