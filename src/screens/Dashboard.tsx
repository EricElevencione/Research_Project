import { useNavigate } from "react-router-dom";
import React from 'react';
import FarmlandMap from '../components/Map/FarmlandMap';
import "../assets/css/App.css";

const Dashboard: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="dashboard-container">
            {/* Top Menu */}
            <nav className="top-menu">
                <button onClick={() => navigate("/dashboard")}>Home</button>
                <button onClick={() => navigate("/active-farmers")}>Active Farmers</button>
                <button onClick={() => navigate("/lands")}>Lands</button>
                <button onClick={() => navigate("/upload")}>Submit Files</button>
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
                        <div className="stat-card">
                            <h3>Total Farmlands</h3>
                            <p>11</p>
                        </div>
                        <div className="stat-card">
                            <h3>Total Area</h3>
                            <p>3.75 ha</p>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Dashboard;
