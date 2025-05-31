import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './database/loginConnection';
import Dashboard from './screens/Dashboard';
import LandsPage from './screens/LandsPage';
import ActiveFarmerPage from './screens/ActiveFarmerPage';
import FarmlandPage from './screens/FarmlandPage';
import UploadPage from './screens/UploadPage';
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
                <Route path="/farmlands" element={
                    <ProtectedRoute>
                        <FarmlandPage />
                    </ProtectedRoute>
                } />
                <Route path="/upload" element={
                    <ProtectedRoute>
                        <UploadPage />
                    </ProtectedRoute>
                } />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;