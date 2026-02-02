import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './login/PageLogin';
import Dashboard from './screens/admin/Dashboard';
import MasterlistPage from './screens/admin/MasterlistPage';
import RSBSAPage from './screens/admin/RSBSAPage';
import GapAnalysis from './screens/admin/GapAnalysis';
import Incentives from './screens/admin/Incentives';
import ManageRequests from './screens/admin/ManageRequest';
import ViewAllocation from './screens/admin/ViewAllocation';
import TechnicianDashboard from './screens/technicians/TechnicianDashboard';
import TechMasterlist from './screens/technicians/TechMasterlist';
import TechRsbsa from './screens/technicians/TechRsbsa';
import TechPickLandParcel from './screens/technicians/TechPickLandParcel';
import TechLandPlottingPage from './screens/technicians/TechLandPlottingPage';
import TechFarmerProfile from './screens/technicians/TechFarmerProf';
import TechIncentives from './screens/technicians/TechIncentives';
import TechCreateAllocation from './screens/technicians/TechCreateAllocation';
import TechAddFarmerRequest from './screens/technicians/TechAddFarmerRequest';
import TechViewAllocation from './screens/technicians/TechViewAllocation';
import TechManageRequests from './screens/technicians/TechManageRequests';
import JoDashboard from './screens/JO/JoDashboard';
import JoRsbsa from './screens/JO/JoRsbsaRegistration';
import JoMasterlist from './screens/JO/JoMasterlist';
import JoIncentives from './screens/JO/JoIncentives';
import JoCreateAllocation from './screens/JO/JoCreateAllocation';
import JoAddFarmerRequest from './screens/JO/JoAddFarmerRequest';
import JoManageRequests from './screens/JO/JoManageRequests';
import JoViewAllocation from './screens/JO/JoViewAllocation';
import JoRsbsaPage from './screens/JO/JoRsbsaPage';
import JoGapAnalysis from './screens/JO/JoGapAnalysis';
import JoDistribution from './screens/JO/JoDistribution';
import JoLandRegistry from './screens/JO/JoLandRegistry';
import AuditTrail from './screens/admin/AuditTrail';
import "../src/assets/css/admin css/index.css";


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
        <HashRouter>
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
                <Route path="/gap-analysis" element={
                    <ProtectedRoute>
                        <GapAnalysis />
                    </ProtectedRoute>
                } />
                <Route path="/Incentives" element={
                    <ProtectedRoute>
                        <Incentives />
                    </ProtectedRoute>
                } />
                <Route path="/manage-requests/:allocationId" element={
                    <ProtectedRoute>
                        <ManageRequests />
                    </ProtectedRoute>
                } />
                <Route path="/view-allocation/:allocationId" element={
                    <ProtectedRoute>
                        <ViewAllocation />
                    </ProtectedRoute>
                } />
                <Route path="/manage-requests/:allocationId" element={
                    <ProtectedRoute>
                        <ManageRequests />
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
                <Route path="/technician-incentives" element={
                    <ProtectedRoute>
                        <TechIncentives />
                    </ProtectedRoute>
                } />
                <Route path="/technician-create-allocation" element={
                    <ProtectedRoute>
                        <TechCreateAllocation />
                    </ProtectedRoute>
                } />
                <Route path="/technician-add-farmer-request/:allocationId" element={
                    <ProtectedRoute>
                        <TechAddFarmerRequest />
                    </ProtectedRoute>
                } />
                <Route path="/technician-view-allocation/:allocationId" element={
                    <ProtectedRoute>
                        <TechViewAllocation />
                    </ProtectedRoute>
                } />
                <Route path="/technician-manage-requests/:allocationId" element={
                    <ProtectedRoute>
                        <TechManageRequests />
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
                <Route path="/jo-create-allocation" element={
                    <ProtectedRoute>
                        <JoCreateAllocation />
                    </ProtectedRoute>
                } />
                <Route path="/jo-add-farmer-request/:allocationId" element={
                    <ProtectedRoute>
                        <JoAddFarmerRequest />
                    </ProtectedRoute>
                } />
                <Route path="/jo-manage-requests/:allocationId" element={
                    <ProtectedRoute>
                        <JoManageRequests />
                    </ProtectedRoute>
                } />
                <Route path="/jo-view-allocation/:allocationId" element={
                    <ProtectedRoute>
                        <JoViewAllocation />
                    </ProtectedRoute>
                } />
                <Route path="/jo-masterlist" element={
                    <ProtectedRoute>
                        <JoMasterlist />
                    </ProtectedRoute>
                } />
                <Route path="/jo-rsbsapage" element={
                    <ProtectedRoute>
                        <JoRsbsaPage />
                    </ProtectedRoute>
                } />
                <Route path="/jo-gap-analysis" element={
                    <ProtectedRoute>
                        <JoGapAnalysis />
                    </ProtectedRoute>
                } />
                <Route path="/jo-distribution" element={
                    <ProtectedRoute>
                        <JoDistribution />
                    </ProtectedRoute>
                } />
                <Route path="/jo-land-registry" element={
                    <ProtectedRoute>
                        <JoLandRegistry />
                    </ProtectedRoute>
                } />
                <Route path="/audit-trail" element={
                    <ProtectedRoute>
                        <AuditTrail />
                    </ProtectedRoute>
                } />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </HashRouter>
    );
}

export default App;