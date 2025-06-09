import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L, { LatLngBounds } from 'leaflet'; // Import LatLngBounds
import { FeatureCollection, Feature } from 'geojson'; // Import FeatureCollection and Feature types

// Fix for default marker icons in Leaflet with React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

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

    const MapController: React.FC<{ data: any }> = ({ data }) => {
        const map = useMap();

        useEffect(() => {
            if (data && data.features && data.features.length > 0) {
                const bounds = new LatLngBounds([]);
                const processCoordinates = (coords: any) => {
                    if (Array.isArray(coords) && coords.length > 0) {
                        if (Array.isArray(coords[0])) {
                            coords.forEach(processCoordinates);
                        } else if (coords.length >= 2) {
                            const longitude = coords[0];
                            const latitude = coords[1];
                            if (typeof latitude === 'number' && typeof longitude === 'number') {
                                bounds.extend(new L.LatLng(latitude, longitude));
                            }
                        }
                    }
                };

                data.features.forEach((feature: any) => {
                    if (feature.geometry) {
                        if (feature.geometry.type === 'Point') {
                            processCoordinates(feature.geometry.coordinates);
                        } else if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiPoint') {
                            feature.geometry.coordinates.forEach(processCoordinates);
                        } else if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiLineString') {
                            feature.geometry.coordinates.forEach((ringCoords: any) => processCoordinates(ringCoords[0]));
                        } else if (feature.geometry.type === 'MultiPolygon') {
                            feature.geometry.coordinates.forEach((multiPolygonCoords: any) => {
                                multiPolygonCoords.forEach((polygonCoords: any) => {
                                    processCoordinates(polygonCoords[0]);
                                });
                            });
                        }
                    }
                });

                if (bounds.isValid() && bounds.getNorthEast() && bounds.getSouthWest()) {
                    map.fitBounds(bounds);
                } else {
                    console.warn("Calculated bounds are not valid or empty. Bounds object:", bounds);
                }
            } else {
                console.warn("MapController received empty or invalid data for bounds calculation:", data);
            }
        }, [data, map]);

        return null;
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
    }, []);

    useEffect(() => {
        const fetchBoundaryData = async () => {
            try {
                setBoundaryLoading(true);
                setBoundaryError(null);

                const municipalResponse = await fetch('/Dumangas.geojson');
                if (!municipalResponse.ok) {
                    throw new Error(`Failed to fetch municipal boundary data: ${municipalResponse.status} ${municipalResponse.statusText}`);
                }
                const municipalData = await municipalResponse.json();
                if (!municipalData || !municipalData.type || !municipalData.features) {
                    throw new Error('Invalid municipal boundary GeoJSON data format');
                }
                setMunicipalBoundaryData(municipalData);

                const barangays = ['Lacturan', 'Calao'];
                const boundaries: { [key: string]: any } = {};

                for (const barangay of barangays) {
                    try {
                        const response = await fetch(`/${barangay} Border.geojson`);
                        if (response.ok) {
                            const data = await response.json();
                            if (data && data.type && data.features) {
                                boundaries[barangay] = data;
                            }
                        }
                    } catch (err) {
                        console.warn(`Failed to fetch boundary for ${barangay}:`, err);
                    }
                }

                setBarangayBoundaries(boundaries);
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
                attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                opacity={1}
            />
            <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
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
                                        id: record.id,
                                        firstName: record.firstName,
                                        middleName: record.middleName,
                                        surname: record.surname,
                                        gender: record.gender,
                                        barangay: record.barangayName,
                                        municipality: record.municipalityName,
                                        province: record.provinceName,
                                        status: record.status,
                                        street: record.street,
                                        farmType: record.farmType,
                                        area: record.area,
                                        coordinateAccuracy: record.coordinateAccuracy,
                                        createdAt: record.createdAt,
                                        updatedAt: record.updatedAt
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
                            let popupContent = `<div class="land-plot-popup">
                                <table>
                                    <tr><th>Attribute</th><th>Value</th></tr>
                                    <tr><td><b>First Name:</b></td><td>${feature.properties.firstName || 'N/A'}</td></tr>
                                    <tr><td><b>Middle Name:</b></td><td>${feature.properties.middleName || 'N/A'}</td></tr>
                                    <tr><td><b>Surname:</b></td><td>${feature.properties.surname || 'N/A'}</td></tr>
                                    <tr><td><b>Gender:</b></td><td>${feature.properties.gender || 'N/A'}</td></tr>
                                    <tr><td><b>Barangay:</b></td><td>${feature.properties.barangay || 'N/A'}</td></tr>
                                    <tr><td><b>Municipality:</b></td><td>${feature.properties.municipality || 'N/A'}</td></tr>
                                    <tr><td><b>Province:</b></td><td>${feature.properties.province || 'N/A'}</td></tr>
                                    <tr><td><b>Status:</b></td><td>${feature.properties.status || 'N/A'}</td></tr>
                                    <tr><td><b>Street:</b></td><td>${feature.properties.street || 'N/A'}</td></tr>
                                    <tr><td><b>Farm Type:</b></td><td>${feature.properties.farmType || 'N/A'}</td></tr>
                                    <tr><td><b>Area (ha):</b></td><td>${feature.properties.area || 'N/A'}</td></tr>
                                    <tr><td><b>Coordinate Accuracy:</b></td><td>${feature.properties.coordinateAccuracy || 'N/A'}</td></Ti>
                                    <tr><td><b>Created At:</b></td><td>${feature.properties.createdAt ? new Date(feature.properties.createdAt).toLocaleString() : 'N/A'}</td></tr>
                                    <tr><td><b>Updated At:</b></td><td>${feature.properties.updatedAt ? new Date(feature.properties.updatedAt).toLocaleString() : 'N/A'}</td></tr>
                                </table>
                            </div>`;
                            layer.bindPopup(popupContent);

                            layer.on({
                                click: () => {
                                    if (onLandPlotSelect) {
                                        onLandPlotSelect(feature.properties);
                                    }
                                }
                            });
                        }
                    }}
                />
            )}

            <MapController data={(() => {
                const features: Feature[] = [
                    ...(municipalBoundaryData?.features || []),
                    ...Object.values(barangayBoundaries).flatMap(data => data.features || []),
                    ...(farmlandRecords || []).map(record => ({
                        type: 'Feature',
                        geometry: record.geometry,
                        properties: record
                    }))
                ].filter((feature): feature is Feature => feature !== null);

                return {
                    type: 'FeatureCollection',
                    features
                } as FeatureCollection;
            })()} />
        </MapContainer>
    );
};

export default FarmlandMap;