import "../assets/css/LandsPage.css";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface LandRecord {
    id: number;
    "FIRST NAME": string;
    "MIDDLE NAME": string | null;
    "EXT NAME": string | null;
    "GENDER": string;
    "BIRTHDATE": string;
    "FARMER ADDRESS 1": string;
    "FARMER ADDRESS 2": string;
    "FARMER ADDRESS 3": string;
    "PARCEL NO.": string;
    "PARCEL ADDRESS": string;
    "PARCEL AREA": string;
}

const LandsPage: React.FC = () => {
    const navigate = useNavigate();
    const [landRecords, setLandRecords] = useState<LandRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchLandRecords = async () => {
        try {
            const response = await fetch('/api/lands');
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

    const handleDelete = async (id: number) => {
        if (window.confirm('Are you sure you want to delete this record?')) {
            try {
                const response = await fetch(`/api/lands/${id}`, {
                    method: 'DELETE',
                });

                if (response.ok) {
                    // Remove the deleted record from the state
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
                            <th>First Name</th>
                            <th>Middle Name</th>
                            <th>Ext Name</th>
                            <th>Gender</th>
                            <th>Birthdate</th>
                            <th>Address 1</th>
                            <th>Address 2</th>
                            <th>Address 3</th>
                            <th>Parcel No.</th>
                            <th>Parcel Address</th>
                            <th>Parcel Area</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {landRecords.map((record, index) => (
                            <tr key={index}>
                                <td>{record["FIRST NAME"]}</td>
                                <td>{record["MIDDLE NAME"]}</td>
                                <td>{record["EXT NAME"]}</td>
                                <td>{record["GENDER"]}</td>
                                <td>{record["BIRTHDATE"]}</td>
                                <td>{record["FARMER ADDRESS 1"]}</td>
                                <td>{record["FARMER ADDRESS 2"]}</td>
                                <td>{record["FARMER ADDRESS 3"]}</td>
                                <td>{record["PARCEL NO."]}</td>
                                <td>{record["PARCEL ADDRESS"]}</td>
                                <td>{record["PARCEL AREA"]}</td>
                                <td>
                                    <button
                                        className="delete-button"
                                        onClick={() => handleDelete(record.id)}
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
