import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './screens/admin/AdminLogin';
import Dashboard from './screens/admin/Dashboard';
import MasterlistPage from './screens/admin/MasterlistPage';
import RSBSAPage from './screens/admin/RSBSAPage';
import RSBSAForm from './screens/technicians/RSBSAFormPage';
import LandPlottingPage from './screens/technicians/TechLandPlottingPage';
import AddFarmerPage from './screens/technicians/AddFarmerPage';
import TechnicianDashboard from './screens/technicians/TechnicianDashboard';
import TechnicianAddFarmerPage from './screens/technicians/TechnicianAddFarmerPage';
import TechMasterlist from './screens/technicians/TechMasterlist';
import Register from './screens/technicians/RegisterPage';
import TechRSBSAPage from './screens/technicians/TechRSBSAPage';
import TechLandPlotting from './screens/technicians/TechLandPlottingPage';
import ParcelSelectionPage from './screens/technicians/ParcelSelectionPage';
import Incentives from './screens/admin/Incentives';
import TechLandRecord from './screens/technicians/TechLandRecord';
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
                <Route path="/RSBSAForm" element={
                    <ProtectedRoute>
                        <RSBSAForm />
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
                <Route path="/technician-masterlist" element={
                    <ProtectedRoute>
                        <TechMasterlist />
                    </ProtectedRoute>
                } />
                <Route path="/technician-rsbsa" element={
                    <ProtectedRoute>
                        <TechRSBSAPage />
                    </ProtectedRoute>
                } />
                <Route path="/technician-landplotting" element={
                    <ProtectedRoute>
                        <TechLandPlotting />
                    </ProtectedRoute>
                } />
                <Route path="/technician-land-record" element={
                    <ProtectedRoute>
                        <TechLandRecord />
                    </ProtectedRoute>
                } />
                <Route path="/tech-land-plotting/:farmerId" element={
                    <ProtectedRoute>
                        <TechLandPlotting />
                    </ProtectedRoute>
                } />
                <Route path="/parcel-selection/:recordId" element={
                    <ProtectedRoute>
                        <ParcelSelectionPage />
                    </ProtectedRoute>
                } />
                <Route path="/incentives" element={
                    <ProtectedRoute>
                        <Incentives />
                    </ProtectedRoute>
                } />
                <Route path="/register/:role" element={<Register />} />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;