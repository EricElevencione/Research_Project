import React, { useEffect, useState, forwardRef, useRef, useImperativeHandle, MutableRefObject } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import { FeatureGroup } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import L, { Layer, FeatureGroup as LeafletFeatureGroup } from 'leaflet';
import { booleanWithin } from '@turf/turf';

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

// Component to handle map centering
const MapController: React.FC<{ data: any }> = ({ data }) => {
    const map = useMap();

    useEffect(() => {
        if (data) {
            if (data.features && data.features.length > 0) {
                const bounds = new L.LatLngBounds([]);

                data.features.forEach((feature: any) => {
                    if (feature.geometry && feature.geometry.coordinates) {
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
                }
            }
        }
    }, [data, map]);

    return null;
};

interface LandPlottingMapProps {
    onShapeCreated?: (shape: any) => void;
    onShapeEdited?: (shape: any) => void;
    onShapeDeleted?: (e: any) => void;
    selectedShape: any;
    onShapeSelected?: (shape: any | null) => void;
    barangayName?: string;
}

export interface LandPlottingMapRef {
    deleteShape: (layerId: string) => void;
}

const LandPlottingMap = forwardRef<LandPlottingMapRef, LandPlottingMapProps>(
    ({ onShapeCreated, onShapeEdited, onShapeDeleted, selectedShape, onShapeSelected, barangayName }, ref) => {
        const [mapData, setMapData] = useState<any>(null);
        const [boundaryData, setBoundaryData] = useState<any>(null);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState<string | null>(null);
        const featureGroupRef = useRef<LeafletFeatureGroup>(null);
        const [drawnShapes, setDrawnShapes] = useState<any[]>([]);

        useImperativeHandle(ref, () => ({
            deleteShape: (shapeId: string) => {
                console.log('deleteShape called with shapeId:', shapeId);
                if (featureGroupRef.current) {
                    console.log('FeatureGroup ref available in deleteShape', featureGroupRef.current);
                    const layerToDelete = featureGroupRef.current.getLayers().find((layer: any) => layer.options && layer.options.id === shapeId);

                    if (layerToDelete) {
                        console.log('Layer found for deletion:', layerToDelete);
                        featureGroupRef.current.removeLayer(layerToDelete);
                        console.log('Layer removed from FeatureGroup');

                        setDrawnShapes(prev => prev.filter(shape => shape.id !== shapeId));
                        console.log('drawnShapes updated, calling onShapeDeleted');

                        if (onShapeDeleted) {
                            const layersToDelete = new L.FeatureGroup();
                            layersToDelete.addLayer(layerToDelete);
                            onShapeDeleted({ layers: layersToDelete });
                        }

                        if (selectedShape && selectedShape.id === shapeId && onShapeSelected) {
                            console.log('Deselecting shape in parent');
                            onShapeSelected(null);
                        }
                    } else {
                        console.warn('Layer to delete not found with ID:', shapeId);
                    }
                } else {
                    console.error('featureGroupRef.current is null in deleteShape');
                }
            }
        }));

        useEffect(() => {
            console.log('selectedShape changed:', selectedShape);
            if (featureGroupRef.current) {
                console.log('FeatureGroup ref available in highlighting effect', featureGroupRef.current);
                featureGroupRef.current.eachLayer((layer: any) => {
                    console.log('Checking layer for setStyle:', layer, typeof layer.setStyle === 'function', layer.options);
                    if (typeof layer.setStyle === 'function' && layer.options) {
                        (layer as any).setStyle({ color: 'white', weight: 1, opacity: 1, fillOpacity: 0 });
                        console.log('Resetting style for layer:', layer);
                    }
                });

                if (selectedShape && selectedShape.layer) {
                    console.log('Attempting to highlight shape with ID:', selectedShape.id);
                    const layerToHighlight = featureGroupRef.current.getLayers().find((layer: any) => layer.options && layer.options.id === selectedShape.id);
                    if (layerToHighlight) {
                        console.log('Highlighting layer:', layerToHighlight);
                        (layerToHighlight as L.Path).setStyle({ color: 'blue', weight: 3, opacity: 1, fillOpacity: 0.5 });
                    } else {
                        console.log('Layer to highlight not found with ID:', selectedShape.id);
                    }
                }
            } else {
                console.log('featureGroupRef.current is null in highlighting effect');
            }
        }, [selectedShape, drawnShapes, featureGroupRef]);

        useEffect(() => {
            const fetchMapData = async () => {
                if (!barangayName) return;

                try {
                    setLoading(true);
                    setError(null);

                    // Convert barangay name to proper case (first letter uppercase, rest lowercase)
                    const formattedName = barangayName.charAt(0).toUpperCase() + barangayName.slice(1).toLowerCase();
                    console.log(`Fetching border for: ${formattedName}`);
                    const filename = `/${formattedName} Border.geojson`;

                    console.log('Attempting to fetch:', filename);
                    const boundaryResponse = await fetch(filename);
                    if (!boundaryResponse.ok) {
                        throw new Error(`Failed to fetch ${formattedName} Border boundary data: ${boundaryResponse.status} ${boundaryResponse.statusText}`);
                    }
                    const boundaryData = await boundaryResponse.json();
                    if (!boundaryData || !boundaryData.type || !boundaryData.features || !Array.isArray(boundaryData.features)) {
                        throw new Error(`Invalid ${formattedName} Border GeoJSON data format`);
                    }
                    setBoundaryData(boundaryData);

                } catch (err: any) {
                    console.error("Error fetching map data:", err);
                    setError(err.message || 'Failed to load map data');
                } finally {
                    setLoading(false);
                }
            };

            fetchMapData();
        }, [barangayName]);

        const getColor = (feature: any) => {
            return '#e74c3c';
        };

        const style = (feature: any) => {
            const isBoundary = feature.properties?.id === 'DUMANGAS_BOUNDARY';
            const isCalaoBoundary = feature.properties?.id === 'CALAO_BOUNDARY';

            return {
                fillColor: '#e74c3c',
                weight: isBoundary ? 3 : isCalaoBoundary ? 2 : 1,
                opacity: 1,
                color: isBoundary ? '#ff0000' : 'white',
                dashArray: isBoundary ? undefined : (isCalaoBoundary ? '3' : undefined),
                fillOpacity: 0
            };
        };

        const onCreated = (e: any) => {
            const layer = e.layer;

            const drawnGeometry = layer.toGeoJSON();

            if (boundaryData && boundaryData.features && boundaryData.features.length > 0) {
                const boundary = boundaryData.features[0];

                if (!booleanWithin(drawnGeometry, boundary)) {
                    if (featureGroupRef.current) {
                        featureGroupRef.current.removeLayer(layer);
                    }
                    alert(`Drawn shape is outside the ${barangayName || 'selected barangay'} boundary. Please draw within the designated area.`);
                    return;
                }
            }

            if (featureGroupRef.current) {
                featureGroupRef.current.addLayer(layer);
            }

            const shapeId = `shape_${Date.now()}`;
            layer.options.id = shapeId;
            console.log('Shape created with ID:', shapeId, 'and layer:', layer);

            const newShape = {
                id: shapeId,
                layer: layer,
                properties: {
                    name: '',
                    area: 0,
                    coordinateAccuracy: 'approximate',
                    owner: '',
                    status: 'owned',
                    barangay: barangayName
                }
            };

            setDrawnShapes(prev => [...prev, newShape]);
            console.log('drawnShapes after creation:', drawnShapes);

            if (onShapeCreated) {
                onShapeCreated(newShape);
            }
        };

        const onEdited = (e: any) => {
            console.log('onEdited triggered', e);
            const layers = e.layers;
            let reverted = false;

            layers.eachLayer((layer: any) => {
                const shapeId = layer.options.id;

                const editedGeometry = layer.toGeoJSON();

                if (boundaryData && boundaryData.features && boundaryData.features.length > 0) {
                    const boundary = boundaryData.features[0];

                    if (!booleanWithin(editedGeometry, boundary)) {
                        alert('Edited shape moved outside the boundary. The edit will be reverted.');
                        reverted = true;
                        return;
                    }
                }

                const shapeIndex = drawnShapes.findIndex(shape => shape.id === shapeId);

                if (shapeIndex !== -1) {
                    const updatedShapes = [...drawnShapes];
                    updatedShapes[shapeIndex] = {
                        ...updatedShapes[shapeIndex],
                        layer: layer
                    };
                    setDrawnShapes(updatedShapes);
                    console.log('drawnShapes after edit:', updatedShapes);
                }
            });

            if (onShapeEdited) {
                onShapeEdited(e);
            }
        };

        const onDeleted = (e: any) => {
            console.log('onDeleted triggered by map tool', e);
            const layers = e.layers;
            layers.eachLayer((layer: any) => {
                console.log('Deleting shape with ID:', layer.options.id);
                setDrawnShapes(prev => prev.filter(shape => shape.id !== layer.options.id));
            });
            console.log('drawnShapes after map tool deletion:', drawnShapes);

            if (onShapeDeleted) {
                onShapeDeleted(e);
            }
        };
        const onFeatureGroupReady = (featureGroupInstance: L.FeatureGroup) => {
            if (featureGroupRef && typeof featureGroupRef === 'object') {
                (featureGroupRef as MutableRefObject<L.FeatureGroup>).current = featureGroupInstance;
            }
            console.log('FeatureGroup is ready and assigned to ref:', featureGroupRef.current);

            featureGroupInstance.on('click', (event: L.LeafletEvent) => {
                const clickedLayer = event.layer;
                console.log('Map clicked. Clicked layer:', clickedLayer);
                const clickedShape = drawnShapes.find(shape => shape.layer.options && (clickedLayer as any).options && shape.layer.options.id === (clickedLayer as any).options.id);

                if (clickedShape) {
                    console.log('Shape clicked for selection:', clickedShape);
                    if (onShapeSelected) {
                        onShapeSelected(clickedShape);
                    }
                } else {
                    console.log('Clicked outside a drawn shape, deselecting.');
                    if (selectedShape && onShapeSelected) {
                        onShapeSelected(null);
                    }
                }
            });

            return () => {
                featureGroupInstance.off('click');
            };
        };

        if (loading) {
            return <div>Loading map data...</div>;
        }

        if (error) {
            return <div>Error loading map data: {error}</div>;
        }

        return (
            <div style={{
                height: '100%',
                width: '100%',
                position: 'relative',
                border: '2px solid red'
            }}>
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

                    {boundaryData && (
                        <GeoJSON
                            key={barangayName}
                            data={boundaryData}
                            style={style}
                        />
                    )}

                    <FeatureGroup ref={featureGroupRef} eventHandlers={{ add: (e) => onFeatureGroupReady(e.target) }}>
                        <EditControl
                            position="topright"
                            onCreated={onCreated}
                            onEdited={onEdited}
                            onDeleted={onDeleted}
                            draw={{
                                rectangle: false,
                                circle: false,
                                circlemarker: false,
                                marker: false,
                                polyline: false
                            }}
                        />
                    </FeatureGroup>

                    {boundaryData && <MapController data={boundaryData} />}
                </MapContainer>
            </div>
        );
    });

export default LandPlottingMap; 