import React, { useEffect, useState } from 'react';
import "../../assets/css/techLandRecord.css";

const roleColors: Record<string, string> = {
    'Tenant': '#fbc02d',
    'Lessee': '#1976d2',
    'Land Owner': '#388e3c',
    'Owner': '#388e3c',
    'Farmer': '#8d6e63',
};

// TODO: Get parcelId from props, route, or context. For now, hardcode for demo.
const parcelId = 1;

const TechLandRecord: React.FC = () => {
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
                setLandHistory(data);
                // Fetch person names for all unique person_ids
                const uniquePersonIds = Array.from(new Set(data.map((h: any) => h.person_id)));
                const personMap: Record<string, string> = {};
                for (const personId of uniquePersonIds) {
                    // TODO: Replace with your actual API endpoint for person details
                    // For demo, just use personId as name
                    personMap[String(personId)] = `Person ${personId}`;
                }
                setPersonMap(personMap);
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
            <h2 className="land-records-title">Land Use & Management History</h2>
            <table className="land-records-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Role</th>
                        <th>Start Date</th>
                        <th>End Date</th>
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
                            <td>{entry.start_date}</td>
                            <td>{entry.end_date || 'Present'}</td>
                            <td>{entry.reason}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default TechLandRecord;
