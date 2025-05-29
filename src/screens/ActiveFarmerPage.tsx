import "../assets/css/LandPage.css";
import { useEffect, useState } from 'react';

interface FarmerRecord {
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

const ActiveFarmerPage = () => {
    const [farmerRecords, setFarmerRecords] = useState<FarmerRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchFarmerRecords = async () => {
            try {
                // Replace with your actual backend API endpoint
                const response = await fetch('http://localhost:5000/api/lands');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data: FarmerRecord[] = await response.json();
                setFarmerRecords(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchFarmerRecords();
    }, []);

    if (loading) {
        return <div className="lands-container">Loading...</div>;
    }

    if (error) {
        return <div className="lands-container">Error: {error}</div>;
    }

    return (
        <div className="lands-container">
            <h2>Active Farmers</h2>
            <div className="lands-table-wrapper">
                <table className="lands-table">
                    <thead>
                        <tr>
                            <th>FIRST NAME</th>
                            <th>MIDDLE NAME</th>
                            <th>EXT NAME</th>
                            <th>GENDER</th>
                            <th>BIRTHDATE</th>
                            <th>FARMER ADDRESS 1</th>
                            <th>FARMER ADDRESS 2</th>
                            <th>FARMER ADDRESS 3</th>
                            <th>PARCEL NO.</th>
                            <th>PARCEL ADDRESS</th>
                            <th>PARCEL AREA</th>
                        </tr>
                    </thead>
                    <tbody>
                        {farmerRecords.map((record, index) => (
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
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ActiveFarmerPage;
