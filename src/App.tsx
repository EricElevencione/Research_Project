import { Routes, Route } from 'react-router-dom';
import TechLandPlottingPage from './screens/technicians/TechLandPlottingPage';
import '../assets/css/App.css';
import '../assets/css/mobile.css';
import { supabase } from './supabase';

function App() {
    const testConnection = async () => {
        try {
            const { data, error } = await supabase.from('rsbsa_submission').select('count').single();
            if (error) {
                console.error('Connection failed:', error);
                alert('Connection failed: ' + error.message);
            } else {
                console.log('Connected! Row count:', data.count);
                alert('Connected! Row count: ' + data.count);
            }
        } catch (err) {
            console.error('Error:', err);
            alert('Error: ' + (err instanceof Error ? err.message : String(err)));
        }
    };

    return (
        <div className="App">
            <button onClick={testConnection}>Test Supabase Connection</button>
            <Routes>
                <Route path="/" element={<div><h1>Welcome to Research Project</h1><p>Navigate to /tech-land-plotting/barangay-name to view land plotting</p></div>} />
                <Route path="/tech-land-plotting/:barangayName" element={<TechLandPlottingPage />} />
            </Routes>
        </div>
    );
}

export default App; 