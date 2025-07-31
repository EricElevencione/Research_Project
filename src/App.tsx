import { Routes, Route } from 'react-router-dom';
import TechLandPlottingPage from './screens/technicians/TechLandPlottingPage';
import '../assets/css/App.css';
import '../assets/css/mobile.css';

function App() {
    return (
        <div className="App">
            <Routes>
                <Route path="/tech-land-plotting/:barangayName" element={<TechLandPlottingPage />} />
            </Routes>
        </div>
    );
}

export default App; 