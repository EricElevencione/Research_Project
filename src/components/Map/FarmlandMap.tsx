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
    const [cropInfoMap, setCropInfoMap] = useState<{ [featureKey: string]: any }>({});

    // Helper to fetch crop/planting info by farmer name and location
    const fetchCropPlantingInfo = async (surname: string, firstName: string, barangay: string) => {
        try {
            // Skip API call if required fields are missing
            if (!surname || !firstName || !barangay) {
                console.log('Missing required fields for crop/planting info:', { surname, firstName, barangay });
                return { owner: null, tenants: [] };
            }
            const url = `/api/crop-planting-info?surname=${encodeURIComponent(surname)}&firstName=${encodeURIComponent(firstName)}&barangay=${encodeURIComponent(barangay)}`;
            const res = await fetch(url);
            if (!res.ok) {
                console.error('API error:', res.status, res.statusText);
                return { owner: null, tenants: [] };
            }
            const data = await res.json();
            return data;
        } catch (err) {
            console.error('Error fetching crop/planting info:', err);
            return { owner: null, tenants: [] };
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
                : value > 5 ? '#16a34a'
                    : value > 2 ? '#22c55e'
                        : value > 0 ? '#86efac'
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
            style={{ height: '100%', width: '100%' }}
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
                                    const farmerName = [
                                        feature.properties.surname || feature.properties.last_name,
                                        feature.properties.firstName || feature.properties.first_name,
                                        feature.properties.middleName || feature.properties.middle_name
                                    ].filter(Boolean).join(' ');
                                    const location = feature.properties.barangay || '';
                                    const featureKey = `${farmerName}-${location}`;

                                    console.log('Map click - featureKey:', featureKey, 'farmerName:', farmerName);

                                    // Initial popup content with crop/planting info
                                    let popupContent = `<div class="farmland-popup-container" style="min-width: 320px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                        <table class="farmland-popup-info-table" style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
                                            <tr style="background: #f8f9fa;">
                                                <th style="padding: 8px; text-align: left; border-bottom: 2px solid #dee2e6; font-weight: 600; color: #495057; width: 35%;">Field</th>
                                                <th style="padding: 8px; text-align: left; border-bottom: 2px solid #dee2e6; font-weight: 600; color: #495057;">Value</th>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 8px; border-bottom: 1px solid #dee2e6; font-weight: 500;">Name:</td>
                                                <td style="padding: 6px 8px; border-bottom: 1px solid #dee2e6;">${farmerName || 'N/A'}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 8px; border-bottom: 1px solid #dee2e6; font-weight: 500;">Municipality:</td>
                                                <td style="padding: 6px 8px; border-bottom: 1px solid #dee2e6;">${feature.properties.municipality || 'N/A'}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 6px 8px; border-bottom: 1px solid #dee2e6; font-weight: 500;">Barangay:</td>
                                                <td style="padding: 6px 8px; border-bottom: 1px solid #dee2e6;">${location || 'N/A'}</td>
                                            </tr>
                                        </table>
                                        <div class="farmland-popup-crops-section" style="border-top: 2px solid #16a34a; padding-top: 8px;">
                                            <div class="farmland-popup-crops-title" style="font-weight: 600; color: #16a34a; margin-bottom: 6px; font-size: 0.9em;">🌾 Crops & Planting Info</div>
                                            <div id="crops-cell-${featureKey}" class="farmland-popup-crops-content" style="color: #6c757d; font-style: italic;">Loading...</div>
                                        </div>
                                    </div>`;
                                    layer.bindPopup(popupContent, { maxWidth: 600, maxHeight: 500 });

                                    layer.on({
                                        click: async () => {
                                            if (onLandPlotSelect) {
                                                onLandPlotSelect(feature.properties);
                                            }

                                            // Check both camelCase and snake_case field names
                                            const surname = feature.properties.surname || feature.properties.last_name || '';
                                            const firstName = feature.properties.firstName || feature.properties.first_name || '';
                                            // Fetch crop/planting info
                                            console.log('Fetching crop/planting info for:', { surname, firstName, barangay: location });
                                            console.log('Feature properties:', feature.properties);
                                            const cropInfo = await fetchCropPlantingInfo(surname, firstName, location);
                                            setCropInfoMap(prev => ({ ...prev, [featureKey]: cropInfo }));

                                            setTimeout(() => {
                                                const cell = document.getElementById(`crops-cell-${featureKey}`);
                                                if (cell) {
                                                    if (!cropInfo.owner && cropInfo.tenants.length === 0) {
                                                        cell.innerHTML = '<div class="farmland-popup-no-data" style="color: #6c757d; padding: 8px; text-align: center; background: #f8f9fa; border-radius: 4px;">No planting information found.</div>';
                                                    } else {
                                                        let html = `<div class="farmland-popup-crops-list" style="max-height: 300px; overflow-y: auto;">`;

                                                        // Owner section
                                                        if (cropInfo.owner) {
                                                            const ownerStatusColor = cropInfo.owner.ownership_status === 'Owner' ? '#16a34a' :
                                                                cropInfo.owner.ownership_status === 'Tenant' ? '#f59e0b' : '#6366f1';
                                                            html += `<div class="farmland-popup-farmer-card" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid #86efac; border-radius: 8px; padding: 12px; margin-bottom: 10px;">`;
                                                            html += `<div class="farmland-popup-farmer-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">`;
                                                            html += `<span class="farmland-popup-farmer-name" style="font-weight: 600; color: #166534; font-size: 0.9em;">👤 ${cropInfo.owner.farmer_name}</span>`;
                                                            html += `<span class="farmland-popup-farmer-status" style="background: ${ownerStatusColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.75em; font-weight: 600;">${cropInfo.owner.ownership_status}</span>`;
                                                            html += `</div>`;
                                                            html += `<div class="farmland-popup-crops-label" style="font-size: 0.8em; color: #4b5563; margin-bottom: 4px;">Crops planted:</div>`;
                                                            html += `<div class="farmland-popup-crops-tags" style="display: flex; flex-wrap: wrap; gap: 6px;">`;
                                                            cropInfo.owner.crops.forEach((crop: string) => {
                                                                const cropColor = crop.toLowerCase().includes('rice') ? '#22c55e' :
                                                                    crop.toLowerCase().includes('corn') ? '#eab308' :
                                                                        crop.toLowerCase().includes('livestock') ? '#f97316' :
                                                                            crop.toLowerCase().includes('poultry') ? '#ef4444' : '#8b5cf6';
                                                                html += `<span class="farmland-popup-crop-tag" style="background: ${cropColor}; color: white; padding: 3px 10px; border-radius: 12px; font-size: 0.8em; font-weight: 500;">🌱 ${crop}</span>`;
                                                            });
                                                            html += `</div></div>`;
                                                        }

                                                        // Tenants section
                                                        if (cropInfo.tenants && cropInfo.tenants.length > 0) {
                                                            html += `<div class="farmland-popup-tenants-section" style="margin-top: 8px;">`;
                                                            html += `<div class="farmland-popup-tenants-title" style="font-size: 0.85em; color: #f59e0b; font-weight: 600; margin-bottom: 8px; padding-left: 4px;">👥 Tenants on this land:</div>`;
                                                            cropInfo.tenants.forEach((tenant: any) => {
                                                                html += `<div class="farmland-popup-tenant-card" style="background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 1px solid #fcd34d; border-radius: 8px; padding: 10px; margin-bottom: 8px;">`;
                                                                html += `<div class="farmland-popup-tenant-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">`;
                                                                html += `<span class="farmland-popup-tenant-name" style="font-weight: 600; color: #92400e; font-size: 0.85em;">👤 ${tenant.farmer_name}</span>`;
                                                                html += `<span class="farmland-popup-tenant-status" style="background: #f59e0b; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7em; font-weight: 600;">Tenant</span>`;
                                                                html += `</div>`;
                                                                html += `<div class="farmland-popup-tenant-crops-label" style="font-size: 0.75em; color: #6b7280; margin-bottom: 4px;">Crops planted:</div>`;
                                                                html += `<div class="farmland-popup-tenant-crops-tags" style="display: flex; flex-wrap: wrap; gap: 4px;">`;
                                                                tenant.crops.forEach((crop: string) => {
                                                                    const cropColor = crop.toLowerCase().includes('rice') ? '#22c55e' :
                                                                        crop.toLowerCase().includes('corn') ? '#eab308' :
                                                                            crop.toLowerCase().includes('livestock') ? '#f97316' :
                                                                                crop.toLowerCase().includes('poultry') ? '#ef4444' : '#8b5cf6';
                                                                    html += `<span class="farmland-popup-tenant-crop-tag" style="background: ${cropColor}; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.75em; font-weight: 500;">🌱 ${crop}</span>`;
                                                                });
                                                                html += `</div></div>`;
                                                            });
                                                            html += `</div>`;
                                                        }

                                                        html += `</div>`;
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
                            data={{
                                type: 'FeatureCollection', features: [
                                    { type: 'Feature', geometry: highlightGeometry, properties: {} }
                                ]
                            } as any}
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
                            const farmerName = [
                                feature.properties.surname || feature.properties.last_name,
                                feature.properties.firstName || feature.properties.first_name,
                                feature.properties.middleName || feature.properties.middle_name
                            ].filter(Boolean).join(' ');
                            const location = feature.properties.barangay || '';
                            const featureKey = `${farmerName}-${location}-alt`;

                            console.log('Map click - featureKey:', featureKey, 'farmerName:', farmerName);

                            // Initial popup content with crop/planting info
                            let popupContent = `<div class="farmland-popup-container" style="min-width: 320px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                <table class="farmland-popup-info-table" style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
                                    <tr style="background: #f8f9fa;">
                                        <th style="padding: 8px; text-align: left; border-bottom: 2px solid #dee2e6; font-weight: 600; color: #495057; width: 35%;">Field</th>
                                        <th style="padding: 8px; text-align: left; border-bottom: 2px solid #dee2e6; font-weight: 600; color: #495057;">Value</th>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 8px; border-bottom: 1px solid #dee2e6; font-weight: 500;">Name:</td>
                                        <td style="padding: 6px 8px; border-bottom: 1px solid #dee2e6;">${farmerName || 'N/A'}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 8px; border-bottom: 1px solid #dee2e6; font-weight: 500;">Municipality:</td>
                                        <td style="padding: 6px 8px; border-bottom: 1px solid #dee2e6;">${feature.properties.municipality || 'N/A'}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 8px; border-bottom: 1px solid #dee2e6; font-weight: 500;">Barangay:</td>
                                        <td style="padding: 6px 8px; border-bottom: 1px solid #dee2e6;">${location || 'N/A'}</td>
                                    </tr>
                                </table>
                                <div class="farmland-popup-crops-section" style="border-top: 2px solid #16a34a; padding-top: 8px;">
                                    <div class="farmland-popup-crops-title" style="font-weight: 600; color: #16a34a; margin-bottom: 6px; font-size: 0.9em;">🌾 Crops & Planting Info</div>
                                    <div id="crops-cell-${featureKey}" class="farmland-popup-crops-content" style="color: #6c757d; font-style: italic;">Loading...</div>
                                </div>
                            </div>`;
                            layer.bindPopup(popupContent, { maxWidth: 600, maxHeight: 500 });

                            layer.on({
                                click: async () => {
                                    if (onLandPlotSelect) {
                                        onLandPlotSelect(feature.properties);
                                    }

                                    // Check both camelCase and snake_case field names
                                    const surname = feature.properties.surname || feature.properties.last_name || '';
                                    const firstName = feature.properties.firstName || feature.properties.first_name || '';
                                    // Fetch crop/planting info
                                    console.log('Fetching crop/planting info for:', { surname, firstName, barangay: location });
                                    console.log('Feature properties:', feature.properties);
                                    const cropInfo = await fetchCropPlantingInfo(surname, firstName, location);
                                    setCropInfoMap(prev => ({ ...prev, [featureKey]: cropInfo }));

                                    setTimeout(() => {
                                        const cell = document.getElementById(`crops-cell-${featureKey}`);
                                        if (cell) {
                                            if (!cropInfo.owner && cropInfo.tenants.length === 0) {
                                                cell.innerHTML = '<div class="farmland-popup-no-data" style="color: #6c757d; padding: 8px; text-align: center; background: #f8f9fa; border-radius: 4px;">No planting information found.</div>';
                                            } else {
                                                let html = `<div class="farmland-popup-crops-list" style="max-height: 300px; overflow-y: auto;">`;

                                                // Owner section
                                                if (cropInfo.owner) {
                                                    const ownerStatusColor = cropInfo.owner.ownership_status === 'Owner' ? '#16a34a' :
                                                        cropInfo.owner.ownership_status === 'Tenant' ? '#f59e0b' : '#6366f1';
                                                    html += `<div class="farmland-popup-farmer-card" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid #86efac; border-radius: 8px; padding: 12px; margin-bottom: 10px;">`;
                                                    html += `<div class="farmland-popup-farmer-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">`;
                                                    html += `<span class="farmland-popup-farmer-name" style="font-weight: 600; color: #166534; font-size: 0.9em;">👤 ${cropInfo.owner.farmer_name}</span>`;
                                                    html += `<span class="farmland-popup-farmer-status" style="background: ${ownerStatusColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.75em; font-weight: 600;">${cropInfo.owner.ownership_status}</span>`;
                                                    html += `</div>`;
                                                    html += `<div class="farmland-popup-crops-label" style="font-size: 0.8em; color: #4b5563; margin-bottom: 4px;">Crops planted:</div>`;
                                                    html += `<div class="farmland-popup-crops-tags" style="display: flex; flex-wrap: wrap; gap: 6px;">`;
                                                    (cropInfo.owner.crops || ['Not specified']).forEach((crop: string) => {
                                                        const cropColor = crop.toLowerCase().includes('rice') ? '#22c55e' :
                                                            crop.toLowerCase().includes('corn') ? '#eab308' :
                                                                crop.toLowerCase().includes('livestock') ? '#f97316' :
                                                                    crop.toLowerCase().includes('poultry') ? '#ef4444' : '#8b5cf6';
                                                        html += `<span class="farmland-popup-crop-tag" style="background: ${cropColor}; color: white; padding: 3px 10px; border-radius: 12px; font-size: 0.8em; font-weight: 500;">🌱 ${crop}</span>`;
                                                    });
                                                    html += `</div></div>`;
                                                }

                                                // Tenants section
                                                if (cropInfo.tenants && cropInfo.tenants.length > 0) {
                                                    html += `<div class="farmland-popup-tenants-section" style="margin-top: 8px;">`;
                                                    html += `<div class="farmland-popup-tenants-title" style="font-size: 0.85em; color: #f59e0b; font-weight: 600; margin-bottom: 8px; padding-left: 4px;">👥 Tenants on this land:</div>`;
                                                    cropInfo.tenants.forEach((tenant: any) => {
                                                        html += `<div class="farmland-popup-tenant-card" style="background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 1px solid #fcd34d; border-radius: 8px; padding: 10px; margin-bottom: 8px;">`;
                                                        html += `<div class="farmland-popup-tenant-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">`;
                                                        html += `<span class="farmland-popup-tenant-name" style="font-weight: 600; color: #92400e; font-size: 0.85em;">👤 ${tenant.farmer_name}</span>`;
                                                        html += `<span class="farmland-popup-tenant-status" style="background: #f59e0b; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7em; font-weight: 600;">Tenant</span>`;
                                                        html += `</div>`;
                                                        html += `<div class="farmland-popup-tenant-crops-label" style="font-size: 0.75em; color: #6b7280; margin-bottom: 4px;">Crops planted:</div>`;
                                                        html += `<div class="farmland-popup-tenant-crops-tags" style="display: flex; flex-wrap: wrap; gap: 4px;">`;
                                                        (tenant.crops || ['Not specified']).forEach((crop: string) => {
                                                            const cropColor = crop.toLowerCase().includes('rice') ? '#22c55e' :
                                                                crop.toLowerCase().includes('corn') ? '#eab308' :
                                                                    crop.toLowerCase().includes('livestock') ? '#f97316' :
                                                                        crop.toLowerCase().includes('poultry') ? '#ef4444' : '#8b5cf6';
                                                            html += `<span class="farmland-popup-tenant-crop-tag" style="background: ${cropColor}; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.75em; font-weight: 500;">🌱 ${crop}</span>`;
                                                        });
                                                        html += `</div></div>`;
                                                    });
                                                    html += `</div>`;
                                                }

                                                html += `</div>`;
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