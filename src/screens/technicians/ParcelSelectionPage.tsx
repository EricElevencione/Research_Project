import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import '../../assets/css/ParcelSelectionPage.css';

interface FarmParcel {
    parcelNumber: number;
    farmLocation: {
        barangay: string;
        cityMunicipality: string;
    };
    totalFarmArea: string;
    cropCommodity: string;
    size: string;
    farmType: string;
    organicPractitioner: string;
    plotStatus?: 'not_plotted' | 'plotted' | 'pending';
    lastPlottedAt?: string;
    geometry?: any;
}

interface RSBSARecord {
    id: string;
    surname: string;
    firstName: string;
    middleName: string;
    addressBarangay: string;
    addressMunicipality: string;
    addressProvince: string;
    farmParcels: FarmParcel[];
}

const ParcelSelectionPage: React.FC = () => {
    const navigate = useNavigate();
    const { recordId } = useParams<{ recordId: string }>();
    const [rsbsaRecord, setRsbsaRecord] = useState<RSBSARecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchRSBSARecord();
    }, [recordId]);

    const fetchRSBSARecord = async () => {
        try {
            const response = await fetch(`http://localhost:5000/api/RSBSAform/${recordId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            // Transform the data to match our interface
            const transformedRecord: RSBSARecord = {
                id: data.id,
                surname: data.surname,
                firstName: data.firstName,
                middleName: data.middleName,
                addressBarangay: data.addressBarangay,
                addressMunicipality: data.addressMunicipality,
                addressProvince: data.addressProvince,
                farmParcels: data.farmParcels || [{
                    parcelNumber: 1,
                    farmLocation: {
                        barangay: data.farmLocationBarangay || data.addressBarangay,
                        cityMunicipality: data.farmLocationCityMunicipality || data.addressMunicipality
                    },
                    totalFarmArea: data.totalFarmArea || data.parcelArea || '',
                    cropCommodity: data.cropCommodity || '',
                    size: data.farmSize || data.parcelArea || '',
                    farmType: data.farmType || '',
                    organicPractitioner: data.organicPractitioner || '',
                    plotStatus: 'not_plotted'
                }]
            };

            setRsbsaRecord(transformedRecord);
            setLoading(false);
        } catch (err: any) {
            console.error('Error fetching RSBSA record:', err);
            setError(err.message);
            setLoading(false);
        }
    };

    const handlePlotParcel = (parcel: FarmParcel, parcelIndex: number) => {
        // Navigate to land plotting with parcel context
        navigate(`/tech-land-plotting/${parcel.farmLocation.barangay}?recordId=${recordId}&parcelIndex=${parcelIndex}`);
    };

    const handleViewPlot = (parcel: FarmParcel, parcelIndex: number) => {
        // Navigate to view existing plot
        navigate(`/tech-land-plotting/${parcel.farmLocation.barangay}?recordId=${recordId}&parcelIndex=${parcelIndex}&viewOnly=true`);
    };

    const handleBackToRSBSA = () => {
        navigate('/technician-rsbsa');
    };

    if (loading) return <div className="loading">Loading parcel information...</div>;
    if (error) return <div className="error">Error: {error}</div>;
    if (!rsbsaRecord) return <div className="error">Record not found</div>;

    return (
        <div className="parcel-selection-page">
            <div className="parcel-selection-header">
                <button className="back-button" onClick={handleBackToRSBSA}>←</button>
                <h1>Farm Parcel Selection</h1>
            </div>

            <div className="farmer-info-card">
                <h2>Farmer Information</h2>
                <div className="farmer-details">
                    <p><strong>Name:</strong> {rsbsaRecord.surname}, {rsbsaRecord.firstName} {rsbsaRecord.middleName}</p>
                    <p><strong>Address:</strong> {rsbsaRecord.addressBarangay}, {rsbsaRecord.addressMunicipality}, {rsbsaRecord.addressProvince}</p>
                    <p><strong>Total Parcels:</strong> {rsbsaRecord.farmParcels.length}</p>
                </div>
            </div>

            <div className="parcels-container">
                <h3>Select a Parcel to Plot</h3>
                <div className="parcels-grid">
                    {rsbsaRecord.farmParcels.map((parcel, index) => (
                        <div key={index} className="parcel-card">
                            <div className="parcel-header">
                                <h4>Farm Parcel #{parcel.parcelNumber}</h4>
                                <div className="parcel-status">
                                    <span className={`status-badge ${parcel.plotStatus || 'not_plotted'}`}>
                                        {parcel.plotStatus === 'plotted' && '✅ Plotted'}
                                        {parcel.plotStatus === 'pending' && '⏳ Pending'}
                                        {(!parcel.plotStatus || parcel.plotStatus === 'not_plotted') && '📍 Not Plotted'}
                                    </span>
                                    {parcel.lastPlottedAt && (
                                        <span className="plot-date">
                                            Last plotted: {new Date(parcel.lastPlottedAt).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="parcel-details">
                                <div className="detail-row">
                                    <span className="label">Location:</span>
                                    <span className="value">{parcel.farmLocation.barangay}, {parcel.farmLocation.cityMunicipality}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="label">Area:</span>
                                    <span className="value">{parcel.size || parcel.totalFarmArea} hectares</span>
                                </div>
                            </div>

                            <div className="parcel-actions">
                                {parcel.plotStatus === 'plotted' ? (
                                    <button
                                        className="view-plot-btn"
                                        onClick={() => handleViewPlot(parcel, index)}
                                    >
                                        🗺️ View Plot
                                    </button>
                                ) : (
                                    <button
                                        className="plot-parcel-btn"
                                        onClick={() => handlePlotParcel(parcel, index)}
                                    >
                                        📍 Plot Land
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {rsbsaRecord.farmParcels.length === 0 && (
                <div className="no-parcels">
                    <p>No farm parcels found for this record.</p>
                    <button className="back-btn" onClick={handleBackToRSBSA}>
                        Back to RSBSA Records
                    </button>
                </div>
            )}
        </div>
    );
};

export default ParcelSelectionPage; 