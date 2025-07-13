import { Routes, Route } from 'react-router-dom';
import LandPlottingPage from './screens/technicians/TechLandPlottingPage';
import '../assets/css/App.css';

function App() {
    return (
        <div className="App">
            <Routes>
                <Route path="/land-plotting/:barangayName" element={<LandPlottingPage />} />
            </Routes>
        </div>
    );
}

export default App; 