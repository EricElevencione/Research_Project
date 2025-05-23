// c:\Users\dblaz\Research-Project\src\screens\Dashboard.tsx
import { useNavigate } from "react-router-dom";
import "../assets/css/Dashboard.css";
import React from 'react';
import InteractiveMap from '../components/InteractiveMap';

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    
    return (
        <div className="dashboard-container">
            <h1>Property Dashboard</h1>
            
            <div className="map-section">
                <InteractiveMap />
            </div>

            <div className="dashboard-content">
                <p>Welcome to the dashboard!</p>
                
                <img src="/vite.svg" alt="Dashboard icon" />
                
                <ul className="dashboard-buttons">
                    <li className="btn">
                        <button>Home</button>
                    </li>
                    <li className="btn">
                        <button>Active Farmers</button>
                    </li>
                    <li className="btn">
                        <button onClick={() => navigate("/lands")}>Lands</button>
                    </li>
                    <li className="btn">
                        <button>Submit Files</button>
                    </li>
                    <li className="btn">
                        <button>Transmit Map</button>
                    </li>
                </ul>
            </div>
        </div>
    );
};

export default Dashboard;