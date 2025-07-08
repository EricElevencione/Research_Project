import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../assets/css/BarangayDashboardPage.css'; // We will create this CSS file next

const BarangayDashboardPage: React.FC = () => {
    const navigate = useNavigate();

    useEffect(() => {
        // Check if user is authenticated
        const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
        if (!isAuthenticated) {
            navigate('/');
            return;
        }
    }, [navigate]);

    // Placeholder data for barangays
    const barangays = [
        { name: 'Lacturan', route: '/land-plotting/Lacturan' },
        { name: 'Calao', route: '/land-plotting/Calao' },
        // Add other barangays here as needed
    ];

    const handleBackClick = () => {
        navigate('/dashboard'); // Navigate to the main dashboard
    };

    return (
        <div className="barangay-dashboard-container">
            <div className="barangay-header">
                <button className="back-button" onClick={handleBackClick}>←</button>
                <h1>Select a Barangay to Plot</h1>
            </div>
            <div className="barangay-list">
                {barangays.map((barangay) => (
                    <div key={barangay.name} className="barangay-card">
                        <h2>{`Barangay ${barangay.name}`}</h2>
                        {/* Placeholder for mini-map if we decide to add them later */}
                        <div className="barangay-minimap">Mini-map placeholder</div>
                        <button onClick={() => navigate(barangay.route)}>Plot Land</button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BarangayDashboardPage; 