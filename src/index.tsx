import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './database/loginConnection';
import Dashboard from './screens/Dashboard';
import LandsPage from './screens/LandsPage';
import ActiveFarmerPage from './screens/ActiveFarmerPage';
import FarmlandPage from './screens/FarmlandPage';
import LandPlottingPage from './screens/LandPlottingPage';
import BarangayDashboardPage from './screens/BarangayDashboardPage';
import './assets/css/index.css';

// Protected Route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    // Check if user is authenticated (you can implement your own auth check)
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';

    if (!isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};

function App() {
    return (
        <Routes>
            <Route path="/" element={<Login role="default" />} />
            <Route path="/dashboard" element={
                <ProtectedRoute>
                    <Dashboard />
                </ProtectedRoute>
            } />
            <Route path="/lands" element={
                <ProtectedRoute>
                    <LandsPage />
                </ProtectedRoute>
            } />
            <Route path="/active-farmers" element={
                <ProtectedRoute>
                    <ActiveFarmerPage />
                </ProtectedRoute>
            } />
            <Route path="/farmland/:farmerId" element={
                <ProtectedRoute>
                    <FarmlandPage />
                </ProtectedRoute>
            } />
            <Route path="/land-plotting" element={
                <ProtectedRoute>
                    <BarangayDashboardPage />
                </ProtectedRoute>
            } />
            <Route path="/land-plotting/:barangayName" element={
                <ProtectedRoute>
                    <LandPlottingPage />
                </ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/" />} />
        </Routes>
    );
}

export default App;