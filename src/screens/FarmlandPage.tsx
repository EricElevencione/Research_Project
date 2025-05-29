import { useEffect, useState } from 'react';
import FarmlandMap from '../components/Map/FarmlandMap';
import '../assets/css/FarmlandPage.css';

interface FarmlandRecord {
    id: string;
    name: string;
    area_ha: number;
    owner_name: string;
    tenant_name: string | null;
    tenancy_status: string;
    barangay: string;
}

const FarmlandPage = () => {
    const [farmlandRecords, setFarmlandRecords] = useState<FarmlandRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchFarmlandRecords = async () => {
            try {
                // Replace with your actual backend API endpoint
                const response = await fetch('http://localhost:5000/api/farmlands');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data: FarmlandRecord[] = await response.json();
                setFarmlandRecords(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchFarmlandRecords();
    }, []);

    if (loading) {
        return <div className="farmland-container">Loading...</div>;
    }

    if (error) {
        return <div className="farmland-container">Error: {error}</div>;
    }

    return (
        <div className="farmland-container">
            <h2>Farmland Information</h2>

            <div className="farmland-grid">
                <div className="map-section">
                    <h3>Farmland Distribution</h3>
                    <div className="map-container">
                        <FarmlandMap />
                    </div>
                </div>

                <div className="farmland-details">
                    <h3>Farmland Details</h3>
                    <div className="farmland-table-wrapper">
                        <table className="farmland-table">
                            <thead>
                                <tr>
                                    <th>Farm Name</th>
                                    <th>Area (ha)</th>
                                    <th>Owner</th>
                                    <th>Tenant</th>
                                    <th>Status</th>
                                    <th>Barangay</th>
                                </tr>
                            </thead>
                            <tbody>
                                {farmlandRecords.map((record) => (
                                    <tr key={record.id}>
                                        <td>{record.name}</td>
                                        <td>{record.area_ha}</td>
                                        <td>{record.owner_name}</td>
                                        <td>{record.tenant_name || 'None'}</td>
                                        <td>{record.tenancy_status}</td>
                                        <td>{record.barangay}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FarmlandPage; 