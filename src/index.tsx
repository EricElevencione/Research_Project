import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './connection/loginConnection';
import Dashboard from './screens/Dashboard';  // Added default import for Dashboard
import LandsPage from './screens/LandsPage';
import './assets/css/index.css';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Login role="default" />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/lands" element={<LandsPage />} />
                <Route path="*" element={<Navigate to="/" />} />
                <Route path="/*" element={<Dashboard />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
