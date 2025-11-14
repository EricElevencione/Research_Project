import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './login/PageLogin';
import Dashboard from './screens/admin/Dashboard';
import MasterlistPage from './screens/admin/MasterlistPage';
import RSBSAPage from './screens/admin/RSBSAPage';
import TechnicianDashboard from './screens/technicians/TechnicianDashboard';
import TechMasterlist from './screens/technicians/TechMasterlist';
import TechRsbsa from './screens/technicians/TechRsbsa';
import TechPickLandParcel from './screens/technicians/TechPickLandParcel';
import TechLandPlottingPage from './screens/technicians/TechLandPlottingPage';
import TechFarmerProfile from './screens/technicians/TechFarmerProf';
import TechFarmerProfPage from './screens/technicians/TechFarmerProfPage';
import Incentives from './screens/admin/Incentives';
import JoDashboard from './screens/JO/JoDashboard';
import JoRsbsa from './screens/JO/JoRsbsaRegistration';
import JoMasterlist from './screens/JO/JoMasterlist';
import JoIncentives from './screens/JO/JoIncentives';
import JoLandrecords from './screens/JO/JoLandrecords';
import JoRsbsaPage from './screens/JO/JoRsbsaPage';
import './index.css'; // Tailwind CSS
import "../src/assets/css/admin css/index.css";
import './assets/css/mobile.css';


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
                <Route path="/incentives" element={
                    <ProtectedRoute>
                        <Incentives />
                    </ProtectedRoute>
                } />
                <Route path="/technician-dashboard" element={
                    <ProtectedRoute>
                        <TechnicianDashboard />
                    </ProtectedRoute>
                } />
                <Route path="/technician-masterlist" element={
                    <ProtectedRoute>
                        <TechMasterlist />
                    </ProtectedRoute>
                } />
                <Route path="/technician-farmerprofile/:id" element={
                    <ProtectedRoute>
                        <TechFarmerProfile />
                    </ProtectedRoute>
                } />
                <Route path="/technician-farmerprofpage" element={
                    <ProtectedRoute>
                        <TechFarmerProfPage />
                    </ProtectedRoute>
                } />
                <Route path="/technician-rsbsa" element={
                    <ProtectedRoute>
                        <TechRsbsa />
                    </ProtectedRoute>
                } />
                <Route path="/technician-pick-land-parcel/:ownerId" element={
                    <ProtectedRoute>
                        <TechPickLandParcel />
                    </ProtectedRoute>
                } />
                <Route path="/technician-landplotting" element={
                    <ProtectedRoute>
                        <TechLandPlottingPage />
                    </ProtectedRoute>
                } />
                <Route path="/jo-dashboard" element={
                    <ProtectedRoute>
                        <JoDashboard />
                    </ProtectedRoute>
                } />
                <Route path="/jo-rsbsa" element={
                    <ProtectedRoute>
                        <JoRsbsa />
                    </ProtectedRoute>
                } />
                <Route path="/jo-incentives" element={
                    <ProtectedRoute>
                        <JoIncentives />
                    </ProtectedRoute>
                } />
                <Route path="/jo-masterlist" element={
                    <ProtectedRoute>
                        <JoMasterlist />
                    </ProtectedRoute>
                } />
                <Route path="/jo-landrecords" element={
                    <ProtectedRoute>
                        <JoLandrecords />
                    </ProtectedRoute>
                } />
                <Route path="/jo-rsbsapage" element={
                    <ProtectedRoute>
                        <JoRsbsaPage />
                    </ProtectedRoute>
                } />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;