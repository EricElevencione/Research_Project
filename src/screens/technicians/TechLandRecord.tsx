import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import "../../assets/css/techLandRecord.css";

const roleColors: Record<string, string> = {
    'Tenant': '#fbc02d',
    'Lessee': '#1976d2',
    'Land Owner': '#388e3c',
    'Owner': '#388e3c',
    'Farmer': '#8d6e63',
    'LANDOWNER': '#28a745',
    'TENANT': '#17a2b8',
    'LESSEE': '#6f42c1',
};

// TODO: Get parcelId from props, route, or context. For now, hardcode for demo.
const parcelId = 1;

// Helper function to format date
const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (error) {
        return dateString; // Return original string if parsing fails
    }
};

const TechLandRecord: React.FC = () => {
    const navigate = useNavigate();
    const [landHistory, setLandHistory] = useState<any[]>([]);
    const [personMap, setPersonMap] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await fetch(`http://localhost:5000/api/land/${parcelId}/history`);
                const contentType = res.headers.get('content-type');
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                if (!contentType || !contentType.includes('application/json')) {
                    const text = await res.text();
                    throw new Error('Expected JSON, got: ' + text.slice(0, 100));
                }
                const data = await res.json();
                
                // Sort data from latest to oldest by start_date
                const sortedData = data.sort((a: any, b: any) => {
                    const dateA = new Date(a.start_date || 0);
                    const dateB = new Date(b.start_date || 0);
                    return dateB.getTime() - dateA.getTime(); // Latest first
                });
                
                setLandHistory(sortedData);
                
                // Fetch RSBSA records to get real names
                const rsbsaRes = await fetch('http://localhost:5000/api/RSBSAform');
                if (rsbsaRes.ok) {
                    const rsbsaData = await rsbsaRes.json();
                    const personMap: Record<string, string> = {};
                    
                    // Create a map of person IDs to full names
                    rsbsaData.forEach((person: any) => {
                        const fullName = [person.surname, person.firstName, person.middleName]
                            .filter(Boolean)
                            .join(', ');
                        personMap[String(person.id)] = fullName || `Person ${person.id}`;
                    });
                    
                    setPersonMap(personMap);
                } else {
                    // Fallback to Person X if RSBSA fetch fails
                    const uniquePersonIds = Array.from(new Set(data.map((h: any) => h.person_id)));
                    const fallbackPersonMap: Record<string, string> = {};
                    for (const personId of uniquePersonIds) {
                        fallbackPersonMap[String(personId)] = `Person ${personId}`;
                    }
                    setPersonMap(fallbackPersonMap);
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, []);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;

    return (
        <div className="land-records-container">
            <div className="land-records-header">
                <button 
                    className="back-button"
                    onClick={() => navigate(-1)}
                >
                    ←
                </button>
                <h2 className="land-records-title">Land Use & Management History</h2>
            </div>
            <table className="land-records-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Role</th>
                        <th>Start Date</th>
                        <th>Reason</th>
                    </tr>
                </thead>
                <tbody>
                    {landHistory.map((entry, idx) => (
                        <tr key={idx}>
                            <td>{personMap[entry.person_id] || entry.person_id}</td>
                            <td>
                                <span
                                    className="land-records-role-badge"
                                    style={{ background: roleColors[entry.role] || '#555', color: '#fff' }}
                                >
                                    {entry.role}
                                </span>
                            </td>
                            <td>{formatDate(entry.start_date)}</td>
                            <td>{entry.reason}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default TechLandRecord;
