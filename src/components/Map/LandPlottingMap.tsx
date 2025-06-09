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
    onShapeFinalized?: (shape: any) => void;
}

export interface LandPlottingMapRef {
    deleteShape: (layerId: string) => void;
}

const LandPlottingMap = forwardRef<LandPlottingMapRef, LandPlottingMapProps>(
    ({ onShapeCreated, onShapeEdited, onShapeDeleted, selectedShape, onShapeSelected, barangayName, onShapeFinalized }, ref) => {
        const [mapData, setMapData] = useState<any>(null);
        const [boundaryData, setBoundaryData] = useState<any>(null);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState<string | null>(null);
        const featureGroupRef = useRef<LeafletFeatureGroup>(null);
        const [drawnShapes, setDrawnShapes] = useState<any[]>([]);
        const editControlRef = useRef<any>(null);

        // Click handler for layers within the FeatureGroup
        const onLayerClick = (e: L.LeafletEvent) => {
            console.log('Layer clicked', e);
            const clickedLayer = e.layer;
            // Find the corresponding shape in drawnShapes by leaflet_id
            // Need to ensure clickedLayer has _leaflet_id and it matches a drawn shape's layer _leaflet_id
            const clickedShape = drawnShapes.find(shape => shape.layer && shape.layer._leaflet_id === clickedLayer._leaflet_id);

            if (clickedShape && onShapeSelected) {
                console.log('Shape found and selected', clickedShape);
                onShapeSelected(clickedShape);
            } else if (onShapeSelected && selectedShape) { // Deselect only if something is currently selected
                console.log('Clicked outside drawn shapes, deselecting');
                onShapeSelected(null);
            }
        };

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
                            // Pass the deleted shape's info
                            const deletedShape = drawnShapes.find(shape => shape.id === shapeId);
                            if (deletedShape) onShapeDeleted({ layers: new L.FeatureGroup().addLayer(layerToDelete), shapes: [deletedShape] });
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

        // Effect to manage layer highlighting and interactions (editing/dragging)
        useEffect(() => {
            console.log('selectedShape changed:', selectedShape);
            if (featureGroupRef.current) {
                console.log('FeatureGroup ref available in highlighting effect', featureGroupRef.current);
                featureGroupRef.current.eachLayer((layer: any) => {
                    console.log('Checking layer for setStyle:', layer, typeof layer.setStyle === 'function', layer.options);
                    // Only apply style and interaction changes to drawn shapes (which have an options.id)
                    // We also check if the layer is an instance that supports editing/dragging/setStyle
                    if (layer.options && layer.options.id && (layer instanceof L.Path || layer instanceof L.Marker)) {
                        // Reset style for all drawn layers
                        if (layer instanceof L.Path) {
                            layer.setStyle({ color: 'white', weight: 1, opacity: 1, fillOpacity: 0 });
                            console.log('Resetting style for drawn layer:', layer);
                        }
                        // Check if the layer has editing handlers before trying to disable
                        if ((layer as any).editing) {
                            try { (layer as any).editing.disable(); } catch (e) { console.error('Error disabling editing:', e); }
                        }
                        // Check if the layer has dragging handlers before trying to disable
                        if ((layer as any).dragging) {
                            try { (layer as any).dragging.disable(); } catch (e) { console.error('Error disabling dragging:', e); }
                        }
                        console.log('Disabling interactions for drawn layer:', layer);
                    }
                });

                if (selectedShape && selectedShape.layer) {
                    console.log('Attempting to highlight shape with ID:', selectedShape.id);
                    const layerToHighlight = featureGroupRef.current.getLayers().find((layer: any) => layer.options && layer.options.id === selectedShape.id);
                    if (layerToHighlight && (layerToHighlight instanceof L.Path || layerToHighlight instanceof L.Marker)) {
                        console.log('Highlighting layer:', layerToHighlight);
                        // Apply highlighting style
                        if (layerToHighlight instanceof L.Path) {
                            layerToHighlight.setStyle({ color: 'blue', weight: 3, opacity: 1, fillOpacity: 0.5 });
                            console.log('Applied highlight style for layer:', layerToHighlight);
                        }
                        // Check if the layer has editing handlers before trying to enable
                        if ((layerToHighlight as any).editing) {
                            try { (layerToHighlight as any).editing.enable(); } catch (e) { console.error('Error enabling editing:', e); }
                        }
                        // Check if the layer has dragging handlers before trying to enable
                        if ((layerToHighlight as any).dragging) {
                            try { (layerToHighlight as any).dragging.enable(); } catch (e) { console.error('Error enabling dragging:', e); }
                        }
                        console.log('Enabled interactions for layer:', layerToHighlight);
                    } else {
                        console.log('Layer to highlight not found or is not a Path/Marker instance with ID:', selectedShape.id);
                    }
                } else {
                    console.log('No shape selected or layer not found');
                }
            } else {
                console.log('featureGroupRef.current is null in highlighting effect');
            }
        }, [selectedShape, featureGroupRef]);

        // Effect to fetch boundary data
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

            if (isBoundary || isCalaoBoundary) {
                return {
                    color: getColor(feature),
                    weight: 2,
                    opacity: 0.6,
                    fillOpacity: 0,
                };
            }
            return {
                color: 'white', // Default color for drawn shapes
                weight: 1,
                opacity: 1,
                fillOpacity: 0,
            };
        };

        const onCreated = (e: any) => {
            console.log('Shape created (onCreated event)', e);
            const { layer } = e;

            const geoJson = layer.toGeoJSON();
            const geometryType = geoJson.geometry.type;

            console.log(`Created shape geometry type: ${geometryType}`);

            let newShape;
            let shapeId = `shape-${Date.now()}-${Math.random().toString(16).slice(2)}`;
            layer.options.id = shapeId; // Assign ID to the layer options

            if (geometryType === 'Polygon') {
                // --- Polygon Specific Logic ---
                // Basic boundary check (simplified)
                if (boundaryData && boundaryData.features && boundaryData.features.length > 0) {
                    const boundary = boundaryData.features[0];
                    const boundaryGeometryType = boundary.geometry.type;
                    console.log(`Boundary geometry type: ${boundaryGeometryType}`);

                    // Only perform boundary check if the boundary is a Polygon or MultiPolygon
                    if (boundaryGeometryType === 'Polygon' || boundaryGeometryType === 'MultiPolygon') {
                        try {
                            console.log('Checking boundary for geoJson:', geoJson);
                            if (!booleanWithin(geoJson, boundary)) {
                                if (featureGroupRef.current) {
                                    featureGroupRef.current.removeLayer(layer);
                                }
                                alert(`Drawn shape is outside the ${barangayName || 'selected barangay'} boundary. Please draw within the designated area.`);
                                return; // Stop processing if outside boundary
                            }
                        } catch (boundaryError) {
                            console.error("Error during boundary check (booleanWithin failed):", boundaryError);
                            // Continue processing the shape even if boundary check fails due to unexpected geometry
                        }
                    } else {
                        console.warn(`Skipping boundary check because boundary geometry is of unexpected type: ${boundaryGeometryType}`);
                    }

                } else {
                    console.warn('Boundary data is not available or empty, skipping boundary check.');
                }

                newShape = {
                    id: shapeId,
                    layer: layer,
                    properties: { // Initialize properties for Polygon
                        name: '',
                        area: layer.getArea ? layer.getArea() : 0, // Calculate area for polygons
                        coordinateAccuracy: 'approximate', // Default
                        barangay: barangayName, // From state/props
                        firstName: '',
                        middleName: '',
                        surname: '',
                        gender: 'Male',
                        municipality: '',
                        city: '',
                        status: 'Single',
                        street: '',
                        farmType: 'Irrigated',
                    },
                };

            } else if (geometryType === 'Point') {
                // --- Marker Specific Logic ---
                // No boundary check needed for markers

                newShape = {
                    id: shapeId,
                    layer: layer,
                    properties: { // Initialize properties for Marker
                        name: '',
                        area: 0, // Markers have no area
                        coordinateAccuracy: 'exact', // Markers usually represent exact points
                        barangay: barangayName, // From state/props
                        firstName: '',
                        middleName: '',
                        surname: '',
                        gender: 'Male',
                        municipality: '',
                        city: '',
                        status: 'Single',
                        street: '',
                        farmType: 'Other', // Default to 'Other' or a marker-specific type
                    },
                };

            } else {
                // --- Handle Other Geometry Types ---
                console.warn(`Ignoring created shape of unexpected type: ${geometryType}`);
                // Optionally remove the layer if it's not the expected type
                if (featureGroupRef.current && featureGroupRef.current.hasLayer(layer)) {
                    featureGroupRef.current.removeLayer(layer);
                }
                return; // Stop processing if not a supported type
            }

            // --- Common Logic for Supported Shapes (Polygon or Point) ---
            // Manually add layer to the FeatureGroup if it wasn't automatically added by EditControl
            // Note: EditControl typically adds the layer automatically, this might be redundant but adding for robustness
            if (featureGroupRef.current && !featureGroupRef.current.hasLayer(layer)) {
                featureGroupRef.current.addLayer(layer);
            }

            // Add the new shape to the state
            setDrawnShapes(prev => [...prev, newShape]);
            console.log('New shape added to drawnShapes:', newShape);

            // Fire callbacks
            if (onShapeCreated) {
                onShapeCreated(newShape);
                console.log('onShapeCreated callback fired');
            }

            console.log('Drawing mode typically disabled here after creation.');

            if (onShapeSelected) {
                onShapeSelected(newShape);
                console.log('onShapeSelected callback fired for new shape');
            }

            if (onShapeFinalized) {
                onShapeFinalized(newShape);
                console.log('onShapeFinalized callback fired');
            }
        };

        const onEdited = (e: any) => {
            console.log('Shape edited (onEdited event)', e);
            const editedLayers = e.layers.getLayers();

            const updatedShapes = drawnShapes.map(shape => {
                const editedLayer = editedLayers.find((layer: any) => layer.options.id === shape.id);
                if (editedLayer) {
                    console.log('Updating edited shape:', shape.id, 'Geometry type:', editedLayer.toGeoJSON().geometry.type);

                    const updatedShape = {
                        ...shape,
                        layer: editedLayer,
                        properties: {
                            ...shape.properties,
                            // Update geometry-related properties if needed
                            // Only calculate area if the layer is a Polygon and supports getArea
                            area: (editedLayer.toGeoJSON().geometry.type === 'Polygon' && editedLayer.getArea) ? editedLayer.getArea() : shape.properties.area
                        }
                    };

                    // Basic boundary check for edited shapes (simplified) - only for Polygons
                    if (editedLayer.toGeoJSON().geometry.type === 'Polygon' && boundaryData && boundaryData.features && boundaryData.features.length > 0) {
                        const boundary = boundaryData.features[0];
                        const boundaryGeometryType = boundary.geometry.type;
                        console.log(`Boundary geometry type during edit check: ${boundaryGeometryType}`);

                        // Only perform boundary check if the boundary is a Polygon or MultiPolygon
                        if (boundaryGeometryType === 'Polygon' || boundaryGeometryType === 'MultiPolygon') {
                            try {
                                const geoJson = editedLayer.toGeoJSON();
                                if (!booleanWithin(geoJson, boundary)) {
                                    alert('Edited shape moved outside the boundary. The edit may be reverted on save.');
                                    // Note: Actual reversion might need more complex state management
                                }
                            } catch (error) {
                                console.error('Error during edited shape boundary check:', error);
                            }
                        } else {
                            console.warn(`Skipping boundary check during edit because boundary geometry is of unexpected type: ${boundaryGeometryType}`);
                        }
                    }

                    return updatedShape;
                }
                return shape;
            });

            setDrawnShapes(updatedShapes);
            console.log('drawnShapes updated after edit');

            // Find the edited shape to pass to onShapeEdited
            const editedShape = updatedShapes.find(shape => editedLayers.some((layer: any) => layer.options.id === shape.id));

            if (onShapeEdited && editedShape) {
                onShapeEdited(editedShape);
                console.log('onShapeEdited callback fired');
            }

            // Keep the edited shape selected after editing
            if (onShapeSelected && editedShape) {
                onShapeSelected(editedShape);
                console.log('onShapeSelected callback fired after edit');
            }
        };

        const onDeleted = (e: any) => {
            console.log('Shape deleted (onDeleted event)', e);
            const deletedLayers = e.layers.getLayers();
            const deletedShapeIds = deletedLayers.map((layer: any) => layer.options.id);

            setDrawnShapes(prev => prev.filter(shape => !deletedShapeIds.includes(shape.id)));
            console.log('drawnShapes updated after delete');

            if (onShapeDeleted) {
                // Pass the deleted shapes' information if needed in the parent
                const deletedShapesInfo = drawnShapes.filter(shape => deletedShapeIds.includes(shape.id));
                onShapeDeleted({ layers: deletedLayers, shapes: deletedShapesInfo });
                console.log('onShapeDeleted callback fired');
            }

            // Deselect if the selected shape was deleted
            if (selectedShape && deletedShapeIds.includes(selectedShape.id) && onShapeSelected) {
                onShapeSelected(null);
                console.log('onShapeSelected callback fired after delete (deselect)');
            }
        };

        // Use this effect to attach the click listener after the featureGroupRef is set
        useEffect(() => {
            const featureGroupInstance = featureGroupRef.current;
            if (featureGroupInstance) {
                console.log('FeatureGroup ref is set, adding click listener');
                featureGroupInstance.on('click', onLayerClick);

                // Cleanup function to remove the listener when the component unmounts or ref changes
                return () => {
                    console.log('Removing click listener');
                    featureGroupInstance.off('click', onLayerClick);
                };
            }
        }, [featureGroupRef.current, onLayerClick]); // Re-run if ref changes or onLayerClick identity changes (though it shouldn't)

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

                    <FeatureGroup ref={featureGroupRef}>
                        <EditControl
                            position="topright"
                            onCreated={onCreated}
                            onEdited={onEdited}
                            onDeleted={onDeleted}
                            draw={{
                                polyline: false,
                                polygon: { showArea: true },
                                rectangle: false,
                                circle: false,
                                marker: true,
                                circlemarker: false,
                            }}
                            edit={{
                                featureGroup: featureGroupRef.current || undefined,
                                remove: true,
                            }}
                        />
                    </FeatureGroup>

                    {/* {boundaryData && <MapController data={boundaryData} />} */}
                </MapContainer>
            </div>
        );
    });

export default LandPlottingMap; 