import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import '../../assets/css/ParcelSelectionPage.css';

interface FarmParcel {
    id?: string;
    parcelNumber: number;
    farmLocation: {
        barangay: string;
        cityMunicipality: string;
    };
    // Database field names for actual farm location
    farm_location_barangay?: string;
    farm_location_city_municipality?: string;
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
            console.log('Server response data:', data);
            console.log('Farm parcels from server:', data.farmParcels);

            // Transform the data to match our interface
            const transformedRecord: RSBSARecord = {
                id: data.id,
                surname: data.surname,
                firstName: data.firstName,
                middleName: data.middleName,
                addressBarangay: data.addressBarangay,
                addressMunicipality: data.addressMunicipality,
                addressProvince: data.addressProvince,
                farmParcels: (data.farmParcels || []).map((parcel: any, index: number) => {
                    // Use actual farm location from database, fallback to farmer's address
                    const actualBarangay = parcel.farm_location_barangay || parcel.farmLocationBarangay || parcel.addressBarangay || data.addressBarangay;
                    const actualMunicipality = parcel.farm_location_city_municipality || parcel.farmLocationCityMunicipality || parcel.addressMunicipality || data.addressMunicipality;
                    
                    console.log(`📍 Parcel ${index + 1} Location Priority:`, {
                        parcelId: parcel.id,
                        farm_location_barangay: parcel.farm_location_barangay,
                        farmLocationBarangay: parcel.farmLocationBarangay,
                        addressBarangay: parcel.addressBarangay,
                        farmerBarangay: data.addressBarangay,
                        finalBarangay: actualBarangay,
                        finalMunicipality: actualMunicipality
                    });
                    
                    return {
                        id: parcel.id, // ✅ Include DB ID
                        parcelNumber: parcel.parcel_number || parcel.parcelNumber || index + 1,
                        farmLocation: {
                            barangay: actualBarangay,
                            cityMunicipality: actualMunicipality
                        },
                        // Store database field names for reference
                        farm_location_barangay: parcel.farm_location_barangay,
                        farm_location_city_municipality: parcel.farm_location_city_municipality,
                        totalFarmArea: parcel.total_farm_area || parcel.totalFarmArea || parcel.parcelArea || '',
                        cropCommodity: parcel.crop_commodity || parcel.cropCommodity || '',
                        size: parcel.farm_size || parcel.farmSize || parcel.parcelArea || '',
                        farmType: parcel.farm_type || parcel.farmType || '',
                        organicPractitioner: parcel.organic_practitioner || parcel.organicPractitioner || '',
                        plotStatus: parcel.plot_status || parcel.plotStatus || 'not_plotted',
                        lastPlottedAt: parcel.last_plotted_at || parcel.lastPlottedAt,
                        geometry: parcel.geometry
                    };
                })
            };

            setRsbsaRecord(transformedRecord);
            setLoading(false);
        } catch (err: any) {
            console.error('Error fetching RSBSA record:', err);
            console.log('rsbsaRecord:', rsbsaRecord);
            if (rsbsaRecord?.farmParcels) {
                console.log('farmParcels:', rsbsaRecord.farmParcels);
            }
            setError(err.message);
            setLoading(false);
        }
    };

    const handlePlotParcel = (parcel: FarmParcel, parcelIndex: number) => {
        // Use actual farm location for navigation, fallback to farmer's address
        const locationBarangay = parcel.farm_location_barangay || parcel.farmLocation.barangay;
        console.log('📍 Navigating to plot with location:', locationBarangay);
        navigate(`/tech-land-plotting/${locationBarangay}?recordId=${recordId}&parcelIndex=${parcelIndex}`);
    };

    const handleViewPlot = (parcel: FarmParcel, parcelIndex: number) => {
        // Use actual farm location for navigation, fallback to farmer's address
        const locationBarangay = parcel.farm_location_barangay || parcel.farmLocation.barangay;
        console.log('📍 Navigating to view plot with location:', locationBarangay);
        navigate(`/tech-land-plotting/${locationBarangay}?recordId=${recordId}&parcelIndex=${parcelIndex}&viewOnly=true`);
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