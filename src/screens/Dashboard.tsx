// c:\Users\dblaz\Research-Project\src\screens\Dashboard.tsx
import { useNavigate } from "react-router-dom";
import React from 'react';
import FarmlandMap from '../components/Map/FarmlandMap';

const Dashboard: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="dashboard-container">
            <h1>Property Dashboard</h1>

            <div className="dashboard-grid">
                <div className="map-section">
                    <h2>Farmland Distribution</h2>
                    <div className="map-container">
                        <FarmlandMap />
                    </div>
                </div>

                <div className="dashboard-content">
                    <div className="dashboard-stats">
                        <div className="stat-card">
                            <h3>Total Farmlands</h3>
                            <p>3</p>
                        </div>
                        <div className="stat-card">
                            <h3>Total Area</h3>
                            <p>3.75 ha</p>
                        </div>
                    </div>

                    <ul className="dashboard-buttons">
                        <li className="btn">
                            <button onClick={() => navigate("/farmlands")}>Home</button>
                        </li>
                        <li className="btn">
                            <button onClick={() => navigate("/active-farmers")}>Active Farmers</button>
                        </li>
                        <li className="btn">
                            <button onClick={() => navigate("/lands")}>Lands</button>
                        </li>
                        <li className="btn">
                            <button onClick={() => navigate("/upload")}>Upload Excel</button>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;