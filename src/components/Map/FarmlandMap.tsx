import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Component to handle map centering
const MapController: React.FC<{ data: any }> = ({ data }) => {
    const map = useMap();

    useEffect(() => {
        if (data) {
            // Calculate the center of all features
            // Ensure the data has features before calculating bounds
            if (data.features && data.features.length > 0) {
                const bounds = new L.LatLngBounds([]); // Initialize an empty bounds object

                data.features.forEach((feature: any) => {
                    if (feature.geometry && feature.geometry.coordinates) {
                        const processCoordinates = (coords: any) => {
                            // Check if coords is an array and not empty
                            if (Array.isArray(coords) && coords.length > 0) {
                                // Check if the first element is an array (for nested structures like Polygon/MultiPolygon)
                                if (Array.isArray(coords[0])) {
                                    // Recurse for nested arrays (Polygons within MultiPolygons, rings within Polygons)
                                    coords.forEach(processCoordinates);
                                } else if (coords.length >= 2) {
                                    // This is a coordinate point [longitude, latitude, ...]
                                    const longitude = coords[0];
                                    const latitude = coords[1];

                                    // Check if latitude and longitude are valid numbers
                                    if (typeof latitude === 'number' && typeof longitude === 'number') {
                                        bounds.extend(new L.LatLng(latitude, longitude));
                                    } else {
                                        console.warn("Invalid coordinate value:", coords);
                                    }
                                } else {
                                    console.warn("Coordinate array does not have enough elements:", coords);
                                }
                            }
                        };

                        // Start processing based on geometry type
                        if (feature.geometry.type === 'Point') {
                            processCoordinates(feature.geometry.coordinates);
                        } else if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiPoint') {
                            feature.geometry.coordinates.forEach(processCoordinates);
                        } else if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiLineString') {
                            feature.geometry.coordinates.forEach((ringCoords: any) => processCoordinates(ringCoords[0])); // Process exterior ring for Polygon
                        } else if (feature.geometry.type === 'MultiPolygon') {
                            feature.geometry.coordinates.forEach((multiPolygonCoords: any) => {
                                multiPolygonCoords.forEach((polygonCoords: any) => {
                                    processCoordinates(polygonCoords[0]); // Process exterior ring for each Polygon in MultiPolygon
                                });
                            });
                        }
                        // Add logic for other geometry types if needed
                    }
                });

                // Only fit bounds if the calculated bounds are valid (not spanning the whole world initially) and has points
                if (bounds.isValid() && bounds.getNorthEast() && bounds.getSouthWest()) {
                    map.fitBounds(bounds);
                } else {
                    console.warn("Calculated bounds are not valid or empty. Bounds object:", bounds);
                    // Optionally, set a default view if bounds are invalid/empty
                    // map.setView([initialLat, initialLng], initialZoom);
                }
            } else {
                console.warn("mapData.features is empty or not an array:", data.features);
            }
        }
    }, [data, map]);

    return null;
};

const FarmlandMap: React.FC = () => {
    const [farmlandData, setFarmlandData] = useState<any>(null);
    const [dumangasBoundaryData, setDumangasBoundaryData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Removed Barangay markers data (same as LandPlottingMap)
    // const barangayMarkers: { name: string; position: [number, number] }[] = [ ... ];

    useEffect(() => {
        const fetchMapData = async () => {
            setLoading(true);
            setError(null);
            try {
                // Remove fetching of Lacturan farmland data
                // const farmlandResponse = await fetch('/Lacturan Map.geojson');
                // if (!farmlandResponse.ok) {
                //     console.warn(`Failed to fetch farmland data: ${farmlandResponse.status} ${farmlandResponse.statusText}`);
                //     // Optionally, set an error or just continue without farmland data
                // }
                // const farmlandData = farmlandResponse.ok ? await farmlandResponse.json() : null;
                // if (farmlandData && (!farmlandData.type || !farmlandData.features || !Array.isArray(farmlandData.features))) {
                //     console.warn('Invalid Farmland GeoJSON data format');
                //     setFarmlandData(null);
                // } else {
                //     setFarmlandData(farmlandData);
                // }
                setFarmlandData(null); // Explicitly set to null

                // Fetch Dumangas boundary data
                const dumangasResponse = await fetch('/Dumangas.geojson');
                if (!dumangasResponse.ok) {
                    console.error(`Failed to fetch Dumangas boundary data: ${dumangasResponse.status} ${dumangasResponse.statusText}`);
                    setError('Failed to load Dumangas boundary data');
                } else {
                    const dumangasData = await dumangasResponse.json();
                    if (!dumangasData || !dumangasData.type || !dumangasData.features || !Array.isArray(dumangasData.features)) {
                        console.error('Invalid Dumangas GeoJSON data format');
                        setError('Invalid Dumangas boundary data format');
                    } else {
                        setDumangasBoundaryData(dumangasData);
                    }
                }

            } catch (err: any) {
                console.error("Error fetching map data:", err);
                setError(err.message || 'Failed to load map data');
            } finally {
                setLoading(false);
            }
        };

        fetchMapData();
    }, []);

    const getFarmlandColor = (feature: any) => {
        // Use feature properties to determine color for farmlands
        return feature.properties && feature.properties.tenancy_status === 'owned' ? '#2ecc71' : '#e74c3c';
    };

    const style = (feature: any) => {
        // Corrected condition to check for the 'name' property from the GeoJSON file
        const isDumangasBoundary = feature.properties && feature.properties.name === 'Dumangas Border';

        if (isDumangasBoundary) {
            return {
                fillColor: undefined, // No fill color for transparent fill
                weight: 1, // Increased weight for boundary border
                opacity: 1,
                color: '#ff0000', // Red border for boundary
                dashArray: undefined,
                fillOpacity: 0 // Fully transparent fill for boundary
            };
        } else { // Styling for farmland polygons
            return {
                fillColor: getFarmlandColor(feature),
                weight: 2,
                opacity: 1,
                color: 'white', // White border for farmlands
                dashArray: '3',
                fillOpacity: 0.7
            };
        }
    };

    const onEachFeature = (feature: any, layer: any) => {
        // Keep the popup on click for farmlands
        if (feature.properties && feature.properties.tenancy_status) {
            const popupContent = `
                <div class="farm-popup">
                    <h3>${feature.properties.farm_name || feature.properties.Name || 'Unnamed Farm'}</h3>
                    <p><strong>Area:</strong> ${feature.properties.area_ha || 'N/A'} hectares</p>
                    <p><strong>Owner:</strong> ${feature.properties.owner_name || 'N/A'}</p>
                    <p><strong>Tenant:</strong> ${feature.properties.tenant_name || 'None'}</p>
                    <p><strong>Status:</strong> ${feature.properties.tenancy_status || 'N/A'}</p>
                    <p><strong>Barangay:</strong> ${feature.properties.barangay || 'N/A'}</p>
                </div>
            `;
            layer.bindPopup(popupContent);
        }

        // Add hover effect for farmlands
        if (feature.properties && feature.properties.tenancy_status) {
            layer.on({
                mouseover: (event: L.LeafletMouseEvent) => {
                    const layer = event.target;
                    layer.setStyle({
                        weight: 5, // Make the border thicker on hover
                        color: '#666', // Change border color
                        dashArray: '',
                        fillOpacity: 0.9 // Slightly increase fill opacity
                    });
                    // Bring the hovered layer to the front
                    if (!L.Browser.ie && L.Browser.opera && L.Browser.edge) {
                        layer.bringToFront();
                    }
                },
                mouseout: (event: L.LeafletMouseEvent) => {
                    const layer = event.target;
                    // Reset the style to the default GeoJSON style
                    layer.setStyle(style(feature)); // Use the original style function
                    // Optionally, send the layer back if you brought it to front
                    // if (!L.Browser.ie && L.Browser.opera && L.Browser.edge) {
                    //     layer.bringToBack();
                    // }
                },
                // Click event is already handled by bindPopup
            });
        }
    };

    if (loading) {
        return <div>Loading map data...</div>;
    }

    if (error) {
        return <div>Error loading map data: {error}</div>;
    }

    // Ensure at least one data source is available
    if (!farmlandData && !dumangasBoundaryData) {
        return (
            <div style={{ height: '500px', width: '100%', position: 'relative' }}>
                <MapContainer
                    center={[10.8, 122.7]} // Default center for Philippines
                    zoom={10} // Default zoom level
                    style={{ height: '100%', width: '100%' }}
                    scrollWheelZoom={true}
                >
                    <TileLayer
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                    />
                    <TileLayer
                        url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    />
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1000, textAlign: 'center', color: '#333', fontSize: '1.2em' }}>
                        No map data available.
                    </div>
                </MapContainer>
            </div>
        );
    }

    // Combine features for MapController to calculate bounds
    const allFeatures = [];
    if (farmlandData && farmlandData.features) {
        allFeatures.push(...farmlandData.features);
    }
    if (dumangasBoundaryData && dumangasBoundaryData.features) {
        allFeatures.push(...dumangasBoundaryData.features);
    }
    const combinedDataForBounds = { type: "FeatureCollection", features: allFeatures };

    return (
        <div style={{ height: '412px', width: '100%', position: 'relative' }}>
            <MapContainer
                center={[0, 0]} // Initial center, will be adjusted by MapController
                zoom={2} // Initial zoom, will be adjusted by MapController
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
            >
                {/* Satellite imagery layer */}
                <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                    zIndex={1} // Ensure satellite imagery is below labels
                />

                {/* Labels layer */}
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    zIndex={2} // Ensure labels are on top
                />

                {/* Render Dumangas Boundary Data */}
                {dumangasBoundaryData && dumangasBoundaryData.features && dumangasBoundaryData.features.length > 0 && (
                    <GeoJSON
                        key="dumangas-boundary"
                        data={dumangasBoundaryData}
                        style={style}
                    // No popups or interactivity for the boundary layer itself
                    />
                )}

                {/* Render Farmland Data */}
                {farmlandData && farmlandData.features && farmlandData.features.length > 0 && (
                    <GeoJSON
                        key="farmland-data"
                        data={farmlandData}
                        style={style}
                        onEachFeature={onEachFeature}
                    />
                )}

                {/* Adjust map view to fit all loaded data */}
                {(farmlandData || dumangasBoundaryData) && <MapController data={combinedDataForBounds} />}

            </MapContainer>
        </div>
    );
};

export default FarmlandMap; 