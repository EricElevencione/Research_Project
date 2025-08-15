import "../../assets/css/MasterlistPage.css";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface LandRecord {
    id: string;
    ffrs_id: string;
    firstName: string;
    middleName: string;
    surname: string;
    extensionName: string;
    gender: 'Male' | 'Female';
    birthdate: string | null;
    barangay: string;
    municipality: string;
    province: string;
    parcel_address: string;
    area: number;
    status: 'Active Farmer' | 'Inactive Farmer';
    createdAt: string;
    updatedAt: string;
}

const TechMasterlist: React.FC = () => {
    const navigate = useNavigate();
    const [landRecords, setLandRecords] = useState<LandRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchLandRecords = async () => {
        try {
            // Fetch data from masterlist API
            const response = await fetch('http://localhost:5000/api/masterlist');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            console.log('Raw data from /api/masterlist:', data);

            // Transform masterlist data to match LandRecord interface
            const transformedData: LandRecord[] = data
                .filter((record: any) => record['FIRST NAME'] && record['LAST NAME']) // Filter out invalid records
                .map((record: any) => {
                    return {
                        id: record.id?.toString() || `${record['FIRST NAME']}-${record['LAST NAME']}-${record['PARCEL AREA']}`,
                        ffrs_id: record['FFRS SYSTEM GENERATED'] || 'N/A',
                        firstName: record['FIRST NAME'] || '',
                        middleName: record['MIDDLE NAME'] || '',
                        surname: record['LAST NAME'] || '',
                        extensionName: record['EXT NAME'] || '',
                        gender: record['GENDER'] || 'Male',
                        birthdate: record['BIRTHDATE'] || null,
                        barangay: record['FARMER ADDRESS 1'] || '', // Assuming this is barangay
                        municipality: record['FARMER ADDRESS 2'] || '', // Assuming this is municipality
                        province: record['FARMER ADDRESS 3'] || '', // Assuming this is province
                        parcel_address: record['PARCEL ADDRESS'] || 'N/A',
                        area: parseFloat(record['PARCEL AREA'] || '0') || 0,
                        status: record.status || 'Active Farmer', // Use status from database
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                });

            console.log('Transformed data:', transformedData);
            setLandRecords(transformedData);
        } catch (err: any) {
            console.error('Error fetching land records:', err);
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
                // Since we're now using RSBSA data, we'll just remove from frontend state
                // as there's no delete endpoint for RSBSA records yet
                setLandRecords(landRecords.filter(record => record.id !== id));
                console.log(`Record ${id} deleted from frontend state`);
            } catch (err: any) {
                setError(err.message);
            }
        }
    };

    // Add a function to toggle status
    const handleToggleStatus = async (id: string) => {
        try {
            const currentRecord = landRecords.find(record => record.id === id);
            if (!currentRecord) {
                console.error('Record not found for status update:', id);
                return;
            }
            
            const newStatus = currentRecord.status === 'Active Farmer' ? 'Inactive Farmer' : 'Active Farmer';
            
            console.log('Updating status for record:', {
                id,
                currentStatus: currentRecord.status,
                newStatus,
                record: currentRecord
            });
            
            // Update in database using the correct endpoint
            const response = await fetch(`http://localhost:5000/api/masterlist/${id}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: newStatus }),
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message || 'Unknown error'}`);
            }
            
            // Update local state
            setLandRecords(prevRecords =>
                prevRecords.map(record =>
                    record.id === id
                        ? { ...record, status: newStatus }
                        : record
                )
            );
            
            console.log(`Status updated for record ${id} to ${newStatus}`);
        } catch (error) {
            console.error('Error updating status:', error);
            alert(`Failed to update status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };



    const handlePrint = () => {
        // Filter to show only active farmers
        const activeFarmersOnly = filteredRecords.filter(record => record.status === 'Active Farmer');

        // Create a new window for printing
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Please allow pop-ups to print the masterlist');
            return;
        }

        // Create the print content
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Active Farmers Masterlist</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        margin: 20px;
                        font-size: 12px;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 20px;
                        border-bottom: 2px solid #333;
                        padding-bottom: 10px;
                    }
                    .header h1 {
                        margin: 0;
                        font-size: 18px;
                        font-weight: bold;
                    }
                    .header p {
                        margin: 5px 0;
                        font-size: 12px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                    }
                    th, td {
                        border: 1px solid #ddd;
                        padding: 8px;
                        text-align: left;
                        font-size: 11px;
                    }
                    th {
                        background-color: #f2f2f2;
                        font-weight: bold;
                    }
                    tr:nth-child(even) {
                        background-color: #f9f9f9;
                    }
                    .footer {
                        margin-top: 20px;
                        text-align: center;
                        font-size: 10px;
                        color: #666;
                    }
                    @media print {
                        body { margin: 0; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>ACTIVE FARMERS MASTERLIST</h1>
                    <p>Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
                    <p>Total Active Farmers: ${activeFarmersOnly.length}</p>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th>FFRS SYSTEM GENERATED</th>
                            <th>LAST NAME</th>
                            <th>FIRST NAME</th>
                            <th>MIDDLE NAME</th>
                            <th>EXT NAME</th>
                            <th>GENDER</th>
                            <th>BIRTHDATE</th>
                            <th>BARANGAY</th>
                            <th>MUNICIPALITY</th>
                            <th>PROVINCE</th>
                            <th>PARCEL ADDRESS</th>
                            <th>PARCEL AREA</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${activeFarmersOnly.map((record, index) => `
                            <tr>
                                <td>${record.ffrs_id}</td>
                                <td>${record.surname}</td>
                                <td>${record.firstName}</td>
                                <td>${record.middleName || 'N/A'}</td>
                                <td>${record.extensionName || 'N/A'}</td>
                                <td>${record.gender}</td>
                                <td>${record.birthdate ? new Date(record.birthdate).toLocaleDateString() : 'N/A'}</td>
                                <td>${record.barangay}</td>
                                <td>${record.municipality}</td>
                                <td>${record.province}</td>
                                <td>${record.parcel_address}</td>
                                <td>${record.area}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <div class="footer">
                    <p>This document contains ${activeFarmersOnly.length} active farmer records</p>
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(printContent);
        printWindow.document.close();

        // Wait for content to load then print
        printWindow.onload = () => {
            printWindow.print();
            printWindow.close();
        };
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
                <button className="back-button" onClick={() => navigate('/technician-dashboard')}>
                    &#8592;
                </button>
                <h1 className="masterlist-title">Masterlist</h1>
                <div className="masterlist-header-options">
                    <span className="masterlist-print" onClick={handlePrint} style={{ cursor: 'pointer' }}>print</span>
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
                            <th>FFRS SYSTEM GENERATED</th>
                            <th>LAST NAME</th>
                            <th>FIRST NAME</th>
                            <th>MIDDLE NAME</th>
                            <th>EXT NAME</th>
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
                                <td>{record.ffrs_id || 'N/A'}</td>
                                <td>{record.surname}</td>
                                <td>{record.firstName}</td>
                                <td>{record.middleName || 'N/A'}</td>
                                <td>{record.extensionName || 'N/A'}</td>
                                <td>{record.gender}</td>
                                <td>{record.birthdate ? new Date(record.birthdate).toLocaleDateString() : 'N/A'}</td>
                                <td>{record.barangay}</td>
                                <td>{record.municipality}</td>
                                <td>{record.province}</td>
                                <td>{record.parcel_address || 'N/A'}</td>
                                <td>{record.area}</td>
                                <td>
                                    <button
                                        className={record.status === 'Active Farmer' ? 'status-active' : 'status-inactive'}
                                        onClick={() => handleToggleStatus(record.id)}
                                        style={{
                                            backgroundColor: record.status === 'Active Farmer' ? '#4CAF50' : '#f44336',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            padding: '4px 8px',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {record.status}
                                    </button>
                                </td>
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

export default TechMasterlist;
