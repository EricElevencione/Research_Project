import "../../assets/css/MasterlistPage.css";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface LandRecord {
    id: string;
    ffrs_id: string;
    firstName: string;
    surname: string;
    gender: 'Male' | 'Female';
    birthdate: string | null;
    barangay: string;
    municipality: string;
    province: string;
    parcel_address: string;
    area: number;
    status: 'Tenant' | 'Land Owner' | 'Farmer';
    createdAt: string;
    updatedAt: string;
}

const Masterlist: React.FC = () => {
    const navigate = useNavigate();
    const [landRecords, setLandRecords] = useState<LandRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

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

    const filteredRecords = landRecords.filter(record =>
        `${record.surname}, ${record.firstName}`.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return <div className="masterlist-container">Loading...</div>;
    }

    if (error) {
        return <div className="masterlist-container">Error: {error}</div>;
    }

    return (
        <div className="masterlist-container">
            <div className="masterlist-header">
                <button className="back-button" onClick={() => navigate('/dashboard')}>
                    &#8592;
                </button>
                <h1 className="masterlist-title">Masterlist</h1>
                <div className="masterlist-header-options">
                    <span className="masterlist-print">print</span>
                    <div className="farmers-header-right">
                        <input
                            type="text"
                            placeholder="Search farmers..."
                            className="farmers-search-input"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="masterlist-table-container">
                <table className="masterlist-table">
                    <thead>
                        <tr>
                            <th>NAME</th>
                            <th>FFRS SYSTEM GENERATED</th>
                            <th>GENDER</th>
                            <th>BIRTHDATE</th>
                            <th>BARANGAY</th>
                            <th>MUNICIPALITY</th>
                            <th>PROVINCE</th>
                            <th>PARCEL ADDRESS</th>
                            <th>PARCEL AREA</th>
                            <th>STATUS</th>
                            <th>OPTIONS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredRecords.map((record) => (
                            <tr key={record.id}>
                                <td>{`${record.surname}, ${record.firstName}`}</td>
                                <td>{record.ffrs_id || 'N/A'}</td>
                                <td>{record.gender}</td>
                                <td>{record.birthdate ? new Date(record.birthdate).toLocaleDateString() : 'N/A'}</td>
                                <td>{record.barangay}</td>
                                <td>{record.municipality}</td>
                                <td>{record.province}</td>
                                <td>{record.parcel_address || 'N/A'}</td>
                                <td>{record.area}</td>
                                <td>{record.status}</td>
                                <td>
                                    <button
                                        className="delete-button"
                                        onClick={() => {
                                            handleDelete(record.id);
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

export default Masterlist;
