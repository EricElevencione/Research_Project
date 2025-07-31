import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { FeatureCollection } from 'geojson'; // Import FeatureCollection and Feature types

// Fix for default marker icons in Leaflet with React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import L from 'leaflet';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface FarmlandMapProps {
    onLandPlotSelect?: (properties: any) => void;
}

const FarmlandMap: React.FC<FarmlandMapProps> = ({ onLandPlotSelect }) => {
    const [farmlandRecords, setFarmlandRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [municipalBoundaryData, setMunicipalBoundaryData] = useState<any>(null);
    const [barangayBoundaries, setBarangayBoundaries] = useState<{ [key: string]: any }>({});
    const [boundaryLoading, setBoundaryLoading] = useState(true);
    const [boundaryError, setBoundaryError] = useState<string | null>(null);
    const [historyMap, setHistoryMap] = useState<{ [parcelId: string]: any[] }>({});

    // Helper to fetch history for a parcel
    const fetchParcelHistory = async (parcelId: string) => {
        if (historyMap[parcelId]) return; // Already fetched
        try {
            const res = await fetch(`/api/land_rights_history?parcel_id=${parcelId}`);
            const data = await res.json();
            setHistoryMap(prev => ({ ...prev, [parcelId]: data }));
        } catch (err) {
            setHistoryMap(prev => ({ ...prev, [parcelId]: [] }));
        }
    };

    // Helper to fetch history by farmer name and location (fallback method)
    const fetchHistoryByFarmer = async (farmerName: string, barangay: string, surname?: string, firstName?: string) => {
        try {
            let url;
            if (surname && firstName && barangay) {
                url = `/api/land_rights_history?surname=${encodeURIComponent(surname)}&firstName=${encodeURIComponent(firstName)}&barangay=${encodeURIComponent(barangay)}`;
            } else {
                url = `/api/land_rights_history?farmer_name=${encodeURIComponent(farmerName)}&barangay=${encodeURIComponent(barangay)}`;
            }
            const res = await fetch(url);
            const data = await res.json();
            return data;
        } catch (err) {
            console.error('Error fetching history by farmer:', err);
            return [];
        }
    };

    useEffect(() => {
        const fetchFarmlandRecords = async () => {
            try {
                setLoading(true);
                const response = await fetch('/api/land-plots');
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                setFarmlandRecords(data);
                setLoading(false);
            } catch (err: any) {
                console.error("Error fetching farmland records:", err);
                setError(err.message);
                setLoading(false);
            }
        };

        fetchFarmlandRecords();

        // Listen for land-plot-saved event to refresh
        const handleRefresh = () => {
            fetchFarmlandRecords();
        };
        window.addEventListener('land-plot-saved', handleRefresh);
        return () => {
            window.removeEventListener('land-plot-saved', handleRefresh);
        };
    }, []);

    useEffect(() => {
        const fetchBoundaryData = async () => {
            try {
                setBoundaryLoading(true);
                setBoundaryError(null);

                const municipalResponse = await fetch('/Dumangas_map.json');
                if (!municipalResponse.ok) {
                    throw new Error(`Failed to fetch municipal boundary data: ${municipalResponse.status} ${municipalResponse.statusText}`);
                }
                const municipalData = await municipalResponse.json();
                if (!municipalData || !municipalData.type || !municipalData.features) {
                    throw new Error('Invalid municipal boundary GeoJSON data format');
                }
                setMunicipalBoundaryData(municipalData);

                // Remove fetching of individual barangay boundaries
                setBarangayBoundaries({});
            } catch (err: any) {
                console.error("Error fetching boundary data:", err);
                setBoundaryError(err.message || 'Failed to load boundary data');
            } finally {
                setBoundaryLoading(false);
            }
        };

        fetchBoundaryData();
    }, []);

    const getMunicipalStyle = () => ({
        color: '#e74c3c',
        weight: 3,
        opacity: 0.8,
        fillOpacity: 0,
    });

    const getBarangayStyle = () => ({
        color: '#3498db',
        weight: 2,
        opacity: 0.6,
        fillOpacity: 0,
    });

    if (loading || boundaryLoading) {
        return <div>Loading map data...</div>;
    }

    if (error || boundaryError) {
        return <div>Error loading map data: {error || boundaryError}</div>;
    }

    console.log('Rendering map with farmlandRecords:', farmlandRecords);
    console.log('Rendering map with municipalBoundaryData:', municipalBoundaryData);
    console.log('Rendering map with barangayBoundaries:', barangayBoundaries);

    return (
        <MapContainer
            center={[10.865263, 122.6983711]}
            zoom={13}
            style={{ height: '100%' }}
            scrollWheelZoom={true}
        >
            <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                opacity={1}
            />
            <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
                opacity={1}
            />

            {municipalBoundaryData && (
                <GeoJSON
                    key="municipal-boundary"
                    data={municipalBoundaryData}
                    style={getMunicipalStyle}
                />
            )}

            {Object.entries(barangayBoundaries).map(([name, data]) => (
                <GeoJSON
                    key={`barangay-boundary-${name}`}
                    data={data}
                    style={getBarangayStyle}
                />
            ))}

            {farmlandRecords && farmlandRecords.length > 0 && (
                <GeoJSON
                    key="farmland-data"
                    data={{
                        type: 'FeatureCollection',
                        features: farmlandRecords.map(record => {
                            if (record.geometry && record.geometry.type) {
                                return {
                                    type: 'Feature',
                                    geometry: record.geometry,
                                    properties: {
                                        ...record
                                    }
                                };
                            }
                            return null;
                        }).filter(Boolean)
                    } as FeatureCollection}
                    style={() => ({
                        color: 'blue',
                        weight: 2,
                        opacity: 0.8,
                        fillOpacity: 0.5
                    })}
                    onEachFeature={(feature, layer) => {
                        if (feature.properties) {
                            // Debug: Log all available properties
                            console.log('Feature properties:', JSON.stringify(feature.properties, null, 2));
                            console.log('Available property keys:', Object.keys(feature.properties));
                            
                            // Create a unique key for this feature based on farmer name and location
                            const farmerName = [feature.properties.surname, feature.properties.firstName, feature.properties.middleName].filter(Boolean).join(' ');
                            const location = feature.properties.barangay || '';
                            const featureKey = `${farmerName}-${location}`;
                            
                            console.log('Map click - featureKey:', featureKey, 'farmerName:', farmerName);
                            
                            // Initial popup content
                            let popupContent = `<div class="land-plot-popup">
                                <table>
                                    <tr><th>Field</th><th>Value</th></tr>
                                    <tr><td><b>Name:</b></td><td>${farmerName || 'N/A'}</td></tr>
                                    <tr><td><b>Municipality:</b></td><td>${feature.properties.municipality || 'N/A'}</td></tr>
                                    <tr><td><b>Barangay:</b></td><td>${location || 'N/A'}</td></tr>
                                    <tr><td><b>History:</b></td><td id="history-cell-${featureKey}">Loading...</td></tr>
                                </table>
                            </div>`;
                            layer.bindPopup(popupContent);

                            layer.on({
                                click: async () => {
                                    if (onLandPlotSelect) {
                                        onLandPlotSelect(feature.properties);
                                    }
                                    
                                    const surname = feature.properties.surname || '';
                                    const firstName = feature.properties.firstName || '';
                                    // Try to fetch history by surname, firstName, and barangay
                                    console.log('Fetching history for:', { surname, firstName, barangay: location });
                                    const history = await fetchHistoryByFarmer(farmerName, location, surname, firstName);
                                    setHistoryMap(prev => ({ ...prev, [featureKey]: history }));
                                    
                                    setTimeout(() => {
                                        const cell = document.getElementById(`history-cell-${featureKey}`);
                                        if (cell) {
                                            if (history.length === 0) {
                                                cell.innerHTML = '<span style="color:#888">No history found for this farmer.</span>';
                                            } else {
                                                let html = `<div style="max-height: 200px; overflow-y: auto; border: 1px solid #dee2e6; border-radius: 4px; background: white;">`;
                                                html += `<table class='history-table' style='width:100%;font-size:0.8em;'>`;
                                                html += `<tr><th style="position: sticky; top: 0; background: #6c757d; color: white; padding: 4px 6px; font-size: 0.75em;">Date of Change</th></tr>`;
                                                history.forEach((entry: any) => {
                                                    html += `<tr><td style="padding: 4px 6px; border-bottom: 1px solid #dee2e6;">${entry.changed_at ? new Date(entry.changed_at).toLocaleDateString() : ''}</td></tr>`;
                                                });
                                                html += `</table></div>`;
                                                cell.innerHTML = html;
                                            }
                                        }
                                    }, 100);
                                }
                            });
                        }
                    }}
                />
            )}
        </MapContainer>
    );
};

export default FarmlandMap;