import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, LayersControl, LayerGroup, useMap } from 'react-leaflet';
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
    highlightGeometry?: any | null; // optional geometry to highlight
    highlightMatcher?: ((properties: any) => boolean) | null; // optional predicate to highlight existing parcels
}

const FarmlandMap: React.FC<FarmlandMapProps> = ({ onLandPlotSelect, highlightGeometry, highlightMatcher }) => {
    const [farmlandRecords, setFarmlandRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    // Removed unused error state
    const [municipalBoundaryData, setMunicipalBoundaryData] = useState<any>(null);
    const [barangayBoundaries, setBarangayBoundaries] = useState<{ [key: string]: any }>({});
    const [parcelCountsByBarangay, setParcelCountsByBarangay] = useState<Record<string, number>>({});
    const [boundaryLoading, setBoundaryLoading] = useState(true);
    const [boundaryError, setBoundaryError] = useState<string | null>(null);
    const [historyMap, setHistoryMap] = useState<{ [parcelId: string]: any[] }>({});

    // Removed unused fetchParcelHistory helper

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
                const contentType = response.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                    const data = await response.json();
                    setFarmlandRecords(Array.isArray(data) ? data : []);
                } else {
                    console.warn('Non-JSON response for /api/land-plots; proceeding with empty records');
                    setFarmlandRecords([]);
                }
            } catch (err: any) {
                console.warn("Error fetching farmland records (non-blocking):", err);
                setFarmlandRecords([]);
            } finally {
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

                const base = ((import.meta as any)?.env?.BASE_URL || '/').replace(/\/$/, '');
                const candidates = [
                    `${base}/Dumangas_map.json`,
                    '/Dumangas_map.json',
                    'Dumangas_map.json'
                ];
                let municipalData: any | null = null;
                let lastErr: any = null;
                for (const url of candidates) {
                    try {
                        console.log('Fetching municipal boundary:', url);
                        const resp = await fetch(url);
                        if (resp.ok) {
                            municipalData = await resp.json();
                            break;
                        } else {
                            lastErr = new Error(`Failed to fetch municipal boundary data: ${resp.status} ${resp.statusText}`);
                        }
                    } catch (e) {
                        lastErr = e;
                    }
                }
                if (!municipalData) throw lastErr || new Error('Failed to fetch municipal boundary');
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

    // Choropleth helpers
    useEffect(() => {
        const counts: Record<string, number> = {};
        farmlandRecords.forEach((rec: any) => {
            const name: string = (rec.barangay || rec.farmLocationBarangay || '').toString();
            if (!name) return;
            counts[name] = (counts[name] || 0) + 1;
        });
        setParcelCountsByBarangay(counts);
    }, [farmlandRecords]);

    const getChoroplethColor = (value: number) => {
        return value > 20 ? '#14532d'
             : value > 10 ? '#166534'
             : value > 5  ? '#16a34a'
             : value > 2  ? '#22c55e'
             : value > 0  ? '#86efac'
                          : '#d1fae5';
    };

    const choroplethStyle = (feature: any) => {
        const props = feature?.properties || {};
        const barangayName: string = (props.NAME_3 || props.barangay || '').toString();
        const value = parcelCountsByBarangay[barangayName] || 0;
        return {
            color: '#134e4a',
            weight: 1,
            opacity: 1,
            fillColor: getChoroplethColor(value),
            fillOpacity: 0.9,
        } as L.PathOptions;
    };

    // Fallback styles for non-choropleth layers (in case they are still rendered)
    const getMunicipalStyle = () => ({
        color: '#134e4a',
        weight: 1,
        opacity: 1,
        fillOpacity: 0,
    });

    const getBarangayStyle = () => ({
        color: '#3498db',
        weight: 1,
        opacity: 0.6,
        fillOpacity: 0,
    });

    if (loading || boundaryLoading) {
        return <div>Loading map data...</div>;
    }

    if (boundaryError) {
        return <div>Error loading boundary data: {boundaryError}</div>;
    }

    console.log('Rendering map choropleth; parcel counts:', parcelCountsByBarangay);

    const MapSizeInvalidator: React.FC = () => {
        const map = useMap();
        useEffect(() => {
            const invalidate = () => map.invalidateSize();
            setTimeout(invalidate, 0);
            window.addEventListener('resize', invalidate);
            return () => {
                window.removeEventListener('resize', invalidate);
            };
        }, [map]);
        return null;
    };

    return (
        <MapContainer
            center={[10.865263, 122.6983711]}
            zoom={13}
            style={{ height: '60vh', minHeight: 300 }}
            scrollWheelZoom={true}
            doubleClickZoom={true}
            dragging={true}
            touchZoom={true}
            boxZoom={true}
            keyboard={true}
            zoomControl={true}
            attributionControl={true}
        >
            <MapSizeInvalidator />
            <LayersControl position="topright">
                <LayersControl.BaseLayer name="Hybrid (Imagery + Roads/Labels)">
                    <LayerGroup>
                        <TileLayer
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                            attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
                            opacity={1}
                        />
                        <TileLayer
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
                            attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
                            opacity={0.9}
                        />
                        <TileLayer
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                            attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
                            opacity={0.9}
                        />
                    </LayerGroup>
                </LayersControl.BaseLayer>

                <LayersControl.BaseLayer checked name="Carto Voyager (Roads/Buildings/Landuse)">
                    <TileLayer
                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap contributors'
                        opacity={1}
                    />
                </LayersControl.BaseLayer>

                <LayersControl.Overlay checked name="Municipal Boundary">
                    {municipalBoundaryData && (
                        <GeoJSON
                            key="municipal-boundary"
                            data={municipalBoundaryData}
                            style={getMunicipalStyle}
                        />
                    )}
                </LayersControl.Overlay>

                {Object.entries(barangayBoundaries).map(([name, data]) => (
                    <LayersControl.Overlay key={`overlay-${name}`} checked name={`Barangay: ${name}`}>
                        <GeoJSON
                            key={`barangay-boundary-${name}`}
                            data={data}
                            style={getBarangayStyle}
                        />
                    </LayersControl.Overlay>
                ))}

                {farmlandRecords && farmlandRecords.length > 0 && (
                    <LayersControl.Overlay checked name="Farmland Parcels">
                        <GeoJSON
                            key="farmland-data"
                            data={{
                                type: 'FeatureCollection',
                                features: farmlandRecords.map(record => {
                                    if (
                                        record.geometry &&
                                        (record.geometry.type === 'Polygon' || record.geometry.type === 'MultiPolygon')
                                    ) {
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
                            style={(feature: any) => {
                                const props = feature?.properties || {};
                                const isHighlighted = typeof highlightMatcher === 'function' ? !!highlightMatcher(props) : false;
                                return isHighlighted
                                    ? { color: '#e74c3c', weight: 3, opacity: 1, fillOpacity: 0.2 }
                                    : { color: 'blue', weight: 2, opacity: 0.8, fillOpacity: 0.5 };
                            }}
                            filter={(feature) => !!feature.geometry &&
                                (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon')}
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
                    </LayersControl.Overlay>
                )}

                {highlightGeometry && (
                    <LayersControl.Overlay checked name="Hovered Parcel">
                        <GeoJSON
                            key="highlight-geometry"
                            data={{ type: 'FeatureCollection', features: [
                                { type: 'Feature', geometry: highlightGeometry, properties: {} }
                            ] } as any}
                            style={() => ({ color: '#e74c3c', weight: 3, opacity: 1, fillOpacity: 0.2 })}
                        />
                    </LayersControl.Overlay>
                )}
            </LayersControl>

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