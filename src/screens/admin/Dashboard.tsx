import { useNavigate } from "react-router-dom";
import React from 'react';
import "../../assets/css/App.css";
import FarmlandMap from "../../components/Map/FarmlandMap";

const Dashboard: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="dashboard-container">
            {/* Top Menu */}
            <nav className="top-menu">
                <button onClick={() => navigate("/dashboard")}>Home</button>
                <button onClick={() => navigate("/rsbsa")}>RSBSA</button>
                <button onClick={() => navigate("/masterlist")}>Masterlist</button>
                <button onClick={() => navigate("/incentives")}>Incetives</button>
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

export default Dashboard;
