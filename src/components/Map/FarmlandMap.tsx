// src/components/Map/FarmlandMap.tsx
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L, { LatLngBounds } from 'leaflet'; // Import LatLngBounds

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
    barangayName?: string;
}

// Move MapController inside FarmlandMap component to ensure proper context
const FarmlandMap: React.FC<FarmlandMapProps> = ({ barangayName }) => {
    const [farmlandRecords, setFarmlandRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [boundaryData, setBoundaryData] = useState<any>(null);
    const [boundaryLoading, setBoundaryLoading] = useState(true);
    const [boundaryError, setBoundaryError] = useState<string | null>(null);

    // MapController component moved inside FarmlandMap to ensure proper context
    const MapController: React.FC<{ data: any }> = ({ data }) => {
        const map = useMap(); // Now useMap is called within MapContainer context

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
            if (!barangayName) {
                setBoundaryData(null);
                setBoundaryLoading(false);
                return;
            }

            try {
                setBoundaryLoading(true);
                setBoundaryError(null);

                const formattedName = barangayName.charAt(0).toUpperCase() + barangayName.slice(1).toLowerCase();
                console.log(`Fetching border for: ${formattedName}`);
                const filename = `/${formattedName} Border.geojson`;

                console.log('Attempting to fetch boundary:', filename);
                const boundaryResponse = await fetch(filename);
                if (!boundaryResponse.ok) {
                    if (boundaryResponse.status === 404) {
                        console.warn(`Boundary file not found for ${formattedName}. Attempting to fetch Dumangas Border.`);
                        const defaultFilename = '/Dumangas Border.geojson';
                        const defaultBoundaryResponse = await fetch(defaultFilename);
                        if (!defaultBoundaryResponse.ok) {
                            throw new Error(`Failed to fetch default boundary data: ${defaultBoundaryResponse.status} ${defaultBoundaryResponse.statusText}`);
                        }
                        const defaultBoundaryData = await defaultBoundaryResponse.json();
                        if (!defaultBoundaryData || !defaultBoundaryData.type || !defaultBoundaryData.features) {
                            throw new Error(`Invalid default boundary GeoJSON data format`);
                        }
                        console.log('Fetched default boundary data.', defaultBoundaryData);
                        setBoundaryData(defaultBoundaryData);
                    } else {
                        throw new Error(`Failed to fetch ${formattedName} Border boundary data: ${boundaryResponse.status} ${boundaryResponse.statusText}`);
                    }
                } else {
                    const boundaryData = await boundaryResponse.json();
                    console.log('Fetched specific boundary data.', boundaryData);
                    if (!boundaryData || !boundaryData.type || !boundaryData.features) {
                        throw new Error(`Invalid ${formattedName} Border GeoJSON data format`);
                    }
                    console.log('Fetched specific boundary data.', boundaryData);
                    setBoundaryData(boundaryData);
                }
            } catch (err: any) {
                console.error("Error fetching boundary data:", err);
                setBoundaryError(err.message || 'Failed to load boundary data');
            } finally {
                setBoundaryLoading(false);
            }
        };

        fetchBoundaryData();
    }, [barangayName]);

    const style = (feature: any) => ({
        color: 'red',
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
    console.log('Rendering map with boundaryData:', boundaryData);

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

            {/* Render Boundary GeoJSON if available */}
            {/* {boundaryData && (
                <GeoJSON
                    key={barangayName || 'default-boundary'}
                    data={boundaryData}
                    style={style}
                />
            )} */}

            {/* Render Farmland GeoJSON (fetched from backend) */}
            {/* {farmlandRecords && farmlandRecords.map((record, index) => {
                if (record.geometry && record.geometry.type) {
                    return (
                    <GeoJSON
                            key={record.id || `farmland-${index}`}
                            data={record}
                            style={() => ({
                                color: 'blue',
                                weight: 2,
                                opacity: 0.8,
                                fillOpacity: 0.5
                            })}
                    />
                    );
                }
                console.warn('Skipping rendering for record with missing or invalid geometry:', record);
                return null;
            })} */}

            {/* <MapController data={{ 
                type: 'FeatureCollection', 
                features: [...(farmlandRecords || []), ...(boundaryData?.features || [])] 
            }} /> */}
        </MapContainer>
    );
};

export default FarmlandMap; 