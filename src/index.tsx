import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import RoleSelection from './screens/RoleSelection';
import Login from './screens/AdminLogin';
import Dashboard from './screens/Dashboard';
import LandsPage from './screens/LandsPage';
import ActiveFarmerPage from './screens/ActiveFarmerPage';
import FarmlandPage from './screens/FarmlandPage';
import RSBSAForm from './screens/RSBSAForm';
import BarangayDashboardPage from './screens/BarangayDashboardPage';
import LandPlottingPage from './screens/LandPlottingPage';
import AddFarmerPage from './screens/AddFarmerPage';
import TechnicianDashboard from './screens/TechnicianDashboard';
import TechnicianAddFarmerPage from './screens/TechnicianAddFarmerPage';
import TechnicianStakeholdersPage from './screens/TechnicianStakeholdersPage';
import Register from './screens/Register';
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
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<RoleSelection />} />
                <Route path="/login/:role" element={<LoginWrapper />} />
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
                <Route path="/add-farmer" element={<AddFarmerPage />} />
                <Route path="/add-farmer/:firstName/:middleName/:surname/:area" element={<AddFarmerPage />} />
                <Route path="/farmlands" element={
                    <ProtectedRoute>
                        <FarmlandPage />
                    </ProtectedRoute>
                } />
                <Route path="/RSBSAForm" element={
                    <ProtectedRoute>
                        <RSBSAForm />
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
                <Route path="/technician-dashboard" element={
                    <ProtectedRoute>
                        <TechnicianDashboard />
                    </ProtectedRoute>
                } />
                <Route path="/technician-add-farmer" element={
                    <ProtectedRoute>
                        <TechnicianAddFarmerPage />
                    </ProtectedRoute>
                } />
                <Route path="/technician-stakeholders" element={
                    <ProtectedRoute>
                        <TechnicianStakeholdersPage />
                    </ProtectedRoute>
                } />
                <Route path="/register/:role" element={<Register />} />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </BrowserRouter>
    );
}

const LoginWrapper = () => {
    const { role } = useParams();
    return <Login role={role || 'default'} />;
};

export default App;