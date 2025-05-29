import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './database/loginConnection';
import Dashboard from './screens/Dashboard';  // Added default import for Dashboard
import LandsPage from './screens/LandsPage';
import ActiveFarmerPage from './screens/ActiveFarmerPage';
import FarmlandPage from './screens/FarmlandPage';
import './assets/css/index.css';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Login role="default" />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/lands" element={<LandsPage />} />
                <Route path="/active-farmers" element={<ActiveFarmerPage />} />
                <Route path="/farmlands" element={<FarmlandPage />} />
                <Route path="*" element={<Navigate to="/" />} />
                <Route path="/*" element={<Dashboard />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
