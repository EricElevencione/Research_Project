import "../assets/css/LandsPage.css";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface LandRecord {
    id: string;
    ffrs_id: string;
    firstName: string;
    middleName: string | null;
    surname: string;
    ext_name: string | null;
    gender: 'Male' | 'Female';
    birthdate: string | null;
    barangay: string;
    municipality: string;
    province: string;
    parcel_address: string;
    street: string;
    area: number;
    status: 'Tenant' | 'Land Owner' | 'Farmer';
    farmType: 'Irrigated' | 'Rainfed Upland' | 'Rainfed Lowland';
    coordinateAccuracy: 'exact' | 'approximate';
    createdAt: string;
    updatedAt: string;
}

const LandsPage: React.FC = () => {
    const navigate = useNavigate();
    const [landRecords, setLandRecords] = useState<LandRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchLandRecords = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/land-plots');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setLandRecords(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLandRecords();
    }, []);

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this record?')) {
            try {
                const response = await fetch(`http://localhost:5000/api/land-plots/${id}`, {
                    method: 'DELETE',
                });

                if (response.ok) {
                    setLandRecords(landRecords.filter(record => record.id !== id));
                } else {
                    throw new Error('Failed to delete record');
                }
            } catch (err: any) {
                setError(err.message);
            }
        }
    };

    if (loading) {
        return <div className="lands-container">Loading...</div>;
    }

    if (error) {
        return <div className="lands-container">Error: {error}</div>;
    }

    return (
        <div className="lands-container">
            <div className="lands-header">
                <button className="back-button" onClick={() => navigate('/dashboard')}>
                    ←
                </button>
                <h1>Land Records</h1>
            </div>

            <div className="lands-table-container">
                <table className="lands-table">
                    <thead>
                        <tr>
                            <th>FFRS System genrated</th>
                            <th>Last Name</th>
                            <th>First Name</th>
                            <th>Middle Name</th>
                            <th>Ext Name</th>
                            <th>Gender</th>
                            <th>Birthdate</th>
                            <th>Barangay</th>
                            <th>Municipality</th>
                            <th>Province</th>
                            <th>Parcel Address</th>
                            <th>Parcel Area</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {landRecords.map((record) => (
                            <tr key={record.id}>
                                <td>{record.ffrs_id || 'N/A'}</td>
                                <td>{record.surname}</td>
                                <td>{record.firstName}</td>
                                <td>{record.middleName || 'N/A'}</td>
                                <td>{record.ext_name || 'N/A'}</td>
                                <td>{record.gender}</td>
                                <td>{record.birthdate ? new Date(record.birthdate).toLocaleDateString() : 'N/A'}</td>
                                <td>{record.barangay}</td>
                                <td>{record.municipality}</td>
                                <td>{record.province}</td>
                                <td>{record.parcel_address || 'N/A'}</td>
                                <td>{record.area}</td>
                                <td>
                                    <button
                                        className="delete-button"
                                        onClick={() => {
                                            handleDelete(record.id);
                                            // Emit a custom event for dashboard map update
                                            window.dispatchEvent(new CustomEvent('land-plot-deleted', { detail: { id: record.id } }));
                                        }}
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default LandsPage;
