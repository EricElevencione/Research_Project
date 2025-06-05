import { Routes, Route } from 'react-router-dom';
import BarangayDashboardPage from './screens/BarangayDashboardPage';
import LandPlottingPage from './screens/LandPlottingPage';
import '../assets/css/App.css';

function App() {
    return (
        <div className="App">
            <Routes>
                <Route path="/" element={<BarangayDashboardPage />} />
                <Route path="/land-plotting/:barangayName" element={<LandPlottingPage />} />
            </Routes>
        </div>
    );
}

export default App; 