import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './screens/admin/AdminLogin';
import Dashboard from './screens/admin/Dashboard';
import MasterlistPage from './screens/admin/MasterlistPage';
import RSBSAPage from './screens/admin/RSBSAPage';
import FarmlandPage from './screens/admin/FarmlandPage';
import RSBSAForm from './screens/technicians/RSBSAFormPage';
import BarangayDashboardPage from './screens/admin/BarangayDashboardPage';
import LandPlottingPage from './screens/admin/LandPlottingPage';
import AddFarmerPage from './screens/technicians/AddFarmerPage';
import TechnicianDashboard from './screens/technicians/TechnicianDashboard';
import TechnicianAddFarmerPage from './screens/technicians/TechnicianAddFarmerPage';
import TechnicianStakeholdersPage from './screens/technicians/TechnicianStakeholdersPage';
import Register from './screens/technicians/RegisterPage';
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
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="/login" element={<Login />} />
                <Route path="/dashboard" element={
                    <ProtectedRoute>
                        <Dashboard />
                    </ProtectedRoute>
                } />
                <Route path="/masterlist" element={
                    <ProtectedRoute>
                        <MasterlistPage />
                    </ProtectedRoute>
                } />
                <Route path="/rsbsa" element={
                    <ProtectedRoute>
                        <RSBSAPage />
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

export default App;