import { useEffect, useState, forwardRef, useRef, useImperativeHandle } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import { FeatureGroup } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import L, { FeatureGroup as LeafletFeatureGroup } from 'leaflet';
import { booleanWithin, centroid as turfCentroid, booleanOverlap } from '@turf/turf';

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

interface LandPlottingMapProps {
    onShapeCreated?: (shape: any) => void;
    onShapeEdited?: (shape: any) => void;
    onShapeDeleted?: (e: any) => void;
    selectedShape: any;
    onShapeSelected?: (shape: any | null) => void;
    barangayName?: string;
    onShapeFinalized?: (shape: any) => void;
    drawingDisabled?: boolean;
    geometryPreview?: any;
    shapes?: any[]; // <-- add this line
    polygonExistsForCurrentParcel?: boolean; // <-- add this line
}

export interface LandPlottingMapRef {
    deleteShape: (layerId: string) => void;
}

const LandPlottingMap = forwardRef<LandPlottingMapRef, LandPlottingMapProps>(
    ({ onShapeCreated, onShapeEdited, onShapeDeleted, selectedShape, onShapeSelected, barangayName, onShapeFinalized, drawingDisabled, geometryPreview, shapes, polygonExistsForCurrentParcel }, ref) => {
        console.log('📍 LandPlottingMap received barangayName:', barangayName);
        const [boundaryData, setBoundaryData] = useState<any>(null);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState<string | null>(null);
        const featureGroupRef = useRef<LeafletFeatureGroup>(null);
        const [drawnShapes, setDrawnShapes] = useState<any[]>([]);
        const [showPolygonLimitModal, setShowPolygonLimitModal] = useState(false);
        const [pendingLayerToRemove, setPendingLayerToRemove] = useState<any>(null);

        // Helper to normalize barangay names for matching
        function normalizeName(name: string) {
            return name.replace(/[^a-z0-9]/gi, '').toLowerCase();
        }

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
                try {
                    setLoading(true);
                    setError(null);

                    // Load boundary with BASE_URL-aware path and fallbacks
                    const base = ((import.meta as any)?.env?.BASE_URL || '/').replace(/\/$/, '');
                    const candidates = [
                        `${base}/Dumangas_map.json`,
                        '/Dumangas_map.json',
                        'Dumangas_map.json'
                    ];
                    let boundaryData: any | null = null;
                    let lastErr: any = null;
                    for (const url of candidates) {
                        try {
                            console.log('Attempting to fetch boundary:', url);
                            const resp = await fetch(url);
                            if (resp.ok) {
                                boundaryData = await resp.json();
                                break;
                            } else {
                                lastErr = new Error(`Failed to fetch Dumangas boundary data: ${resp.status} ${resp.statusText}`);
                            }
                        } catch (e) {
                            lastErr = e;
                        }
                    }
                    if (!boundaryData) throw lastErr || new Error('Failed to fetch boundary file');
                    if (!boundaryData || !boundaryData.type || !boundaryData.features || !Array.isArray(boundaryData.features)) {
                        throw new Error(`Invalid Dumangas GeoJSON data format`);
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

        // Add shapes from props to the map when shapes prop changes
        useEffect(() => {
            console.log('🗺️ LandPlottingMap - shapes prop changed:', shapes);
            console.log('🗺️ LandPlottingMap - shapes length:', shapes?.length);
            console.log('🗺️ LandPlottingMap - featureGroupRef.current:', featureGroupRef.current);

            if (featureGroupRef.current && Array.isArray(shapes)) {
                console.log('✅ Processing shapes, removing non-boundary layers...');
                featureGroupRef.current.eachLayer((layer: any) => {
                    if (!layer.options?.isBoundary) {
                        featureGroupRef.current?.removeLayer(layer);
                        console.log('🗑️ Removed layer:', layer);
                    }
                });

                console.log(`➕ Adding ${shapes.length} shapes to map...`);
                shapes.forEach((shape: any, index: number) => {
                    console.log(`   Shape ${index}:`, {
                        id: shape.id,
                        hasLayer: !!shape.layer,
                        properties: shape.properties
                    });

                    if (shape.layer && !featureGroupRef.current?.hasLayer(shape.layer)) {
                        featureGroupRef.current?.addLayer(shape.layer);
                        console.log(`   ✅ Added shape ${shape.id} to map`);
                        if (shape.properties) {
                            shape.layer.bindPopup(getPopupContent(shape.properties));
                        }
                    } else if (shape.layer) {
                        console.log(`   ⚠️ Shape ${shape.id} already on map`);
                    } else {
                        console.log(`   ❌ Shape ${shape.id} has no layer!`);
                    }
                });
                setDrawnShapes(shapes);
                console.log('✅ Finished processing shapes, drawnShapes updated');
            } else {
                console.log('❌ Cannot process shapes:', {
                    hasFeatureGroup: !!featureGroupRef.current,
                    isArray: Array.isArray(shapes),
                    shapesValue: shapes
                });
            }
        }, [shapes ?? [], (shapes ?? []).length]);


        // Mapping of barangay names to center coordinates and zoom
        const barangayCenters: Record<string, { center: [number, number], zoom: number, id?: string }> = {
            Lacturan: { center: [10.830, 122.720], zoom: 16, id: 'LACTURAN_BOUNDARY' },
            Calao: { center: [10.825, 122.715], zoom: 16, id: 'CALAO_BOUNDARY' },
            // Add more barangays as needed
        };

        // Helper to get map center/zoom
        const getMapView = () => {
            if (barangayName && boundaryData && boundaryData.features) {
                // Find the feature for the selected barangay
                const feature = boundaryData.features.find((f: any) => f.properties?.NAME_3?.toLowerCase() === barangayName.toLowerCase());
                if (feature) {
                    // Compute centroid using turf
                    const center = turfCentroid(feature).geometry.coordinates;
                    // GeoJSON is [lng, lat], Leaflet expects [lat, lng]
                    return { center: [center[1], center[0]] as [number, number], zoom: 16 };
                }
            }
            // Fallback to hardcoded mapping or default
            if (barangayName && barangayCenters[barangayName]) {
                return barangayCenters[barangayName];
            }
            return { center: [10.865263, 122.6983711], zoom: 13 };
        };

        const getColor = (_feature: any) => {
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

        // Helper to generate popup content for a shape
        const getPopupContent = (properties: any) => {
            return `<div style='min-width:180px'>
                <b>Parcel</b><br/>
                <b>Name:</b> ${properties.surname || ''} ${properties.firstName || ''} ${properties.middleName || ''}<br/>
                <b>Barangay:</b> ${properties.barangay || ''}<br/>
                <b>Municipality:</b> ${properties.municipality || ''}<br/>
            </div>`;
        };

        // Helper: Check if a polygon exists for the current parcel (local check)
        function polygonExistsForParcel(newLayer: any) {
            // Only check for Polygon type
            const newParcelNumber = newLayer.options && newLayer.options.properties && newLayer.options.properties.parcelNumber;
            return drawnShapes.some(shape => {
                const geo = shape.layer && shape.layer.toGeoJSON && shape.layer.toGeoJSON();
                return geo && geo.geometry && geo.geometry.type === 'Polygon' &&
                    ((newParcelNumber !== undefined && shape.properties && shape.properties.parcelNumber === newParcelNumber) ||
                        (newParcelNumber === undefined && shape.properties && shape.properties.parcelNumber === undefined));
            });
        }

        const onCreated = (e: any) => {
            console.log('Shape created (onCreated event)', e);
            const { layer } = e;
            const geoJson = layer.toGeoJSON();
            const geometryType = geoJson.geometry.type;
            console.log(`Created shape geometry type: ${geometryType}`);
            let newShape;
            let shapeId = `shape-${Date.now()}-${Math.random().toString(16).slice(2)}`;
            layer.options.id = shapeId; // Assign ID to the layer options

            // --- Polygon Specific Logic ---
            if (geometryType === 'Polygon') {
                // Use local check for existing polygon for this parcel
                if (polygonExistsForParcel(layer)) {
                    // Show modal and store the layer to remove after confirmation
                    setShowPolygonLimitModal(true);
                    setPendingLayerToRemove(layer);
                    // Do NOT remove the layer yet; wait for user to click OK
                    return;
                }
                // Find the correct barangay boundary feature
                let boundaryFeature = null;
                if (!barangayName) {
                    // If no barangay is selected, allow plotting without boundary validation
                    console.warn('No barangayName provided; skipping boundary validation.');
                }
                if (boundaryData && boundaryData.features && boundaryData.features.length > 0) {
                    boundaryFeature = boundaryData.features.find(
                        (f: any) => normalizeName(f.properties?.NAME_3 || '') === normalizeName(barangayName || '')
                    );
                    // Fallback: use first feature
                    if (!boundaryFeature) {
                        console.error('No matching boundary found for:', barangayName, 'Normalized:', normalizeName(barangayName || ''));
                    }
                    if (!boundaryFeature) boundaryFeature = boundaryData.features[0];
                }
                if (barangayName && boundaryFeature) {
                    try {
                        // Debug: Log the drawn shape and boundary feature
                        console.log('Drawn shape GeoJSON:', JSON.stringify(geoJson, null, 2));
                        console.log('Boundary feature GeoJSON:', JSON.stringify(boundaryFeature, null, 2));
                        const within = booleanWithin(geoJson, boundaryFeature);
                        const overlap = booleanOverlap(geoJson, boundaryFeature);
                        console.log('booleanWithin result:', within);
                        console.log('booleanOverlap result:', overlap);
                        if (!within && !overlap) {
                            if (featureGroupRef.current) {
                                featureGroupRef.current.removeLayer(layer);
                            }
                            alert(`Drawn shape is outside the ${barangayName || 'selected barangay'} boundary. Please draw within the designated area.`);
                            return; // Stop processing if outside boundary
                        }
                    } catch (boundaryError) {
                        console.error("Error during boundary check (booleanWithin/booleanOverlap failed):", boundaryError);
                    }
                }
                newShape = {
                    id: shapeId,
                    layer: layer,
                    properties: {
                        name: '',
                        area: layer.getArea ? layer.getArea() : 0,
                        coordinateAccuracy: 'approximate',
                        barangay: barangayName || '',
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
                newShape = {
                    id: shapeId,
                    layer: layer,
                    properties: {
                        name: '',
                        area: 0,
                        coordinateAccuracy: 'exact',
                        barangay: barangayName,
                        firstName: '',
                        middleName: '',
                        surname: '',
                        gender: 'Male',
                        municipality: '',
                        city: '',
                        status: 'Single',
                        street: '',
                        farmType: 'Other',
                    },
                };
            } else {
                if (featureGroupRef.current && featureGroupRef.current.hasLayer(layer)) {
                    featureGroupRef.current.removeLayer(layer);
                }
                return;
            }
            if (featureGroupRef.current && !featureGroupRef.current.hasLayer(layer)) {
                featureGroupRef.current.addLayer(layer);
            }
            // Bind popup with parcel details
            if (layer && newShape && newShape.properties) {
                layer.bindPopup(getPopupContent(newShape.properties));
                layer.on('click', () => { layer.openPopup(); });
            }
            setDrawnShapes(prev => [...prev, newShape]);
            if (onShapeCreated) onShapeCreated(newShape);
            if (onShapeSelected) onShapeSelected(newShape);
            if (onShapeFinalized) onShapeFinalized(newShape);
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

        // Attach popup to shape on selection
        useEffect(() => {
            if (selectedShape && selectedShape.layer && selectedShape.properties) {
                selectedShape.layer.bindPopup(getPopupContent(selectedShape.properties));
                selectedShape.layer.openPopup();
            }
        }, [selectedShape]);

        // Modal for polygon limit
        const PolygonLimitModal = () => showPolygonLimitModal ? (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: 'rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999
            }}>
                <div style={{ background: '#fff', padding: '2rem', borderRadius: '10px', boxShadow: '0 2px 16px rgba(0,0,0,0.2)', minWidth: 300, textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '1rem' }}>Only one polygon is allowed.</div>
                    <button onClick={() => {
                        setShowPolygonLimitModal(false);
                        if (pendingLayerToRemove && featureGroupRef.current && featureGroupRef.current.hasLayer(pendingLayerToRemove)) {
                            featureGroupRef.current.removeLayer(pendingLayerToRemove);
                        }
                        setPendingLayerToRemove(null);
                    }} style={{ padding: '0.5rem 2rem', borderRadius: '8px', border: '1px solid #222', background: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>OK</button>
                </div>
            </div>
        ) : null;

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
                <PolygonLimitModal />
                <MapContainer
                    key={barangayName} // <- Add this line
                    center={getMapView().center as [number, number]}
                    zoom={getMapView().zoom}
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
                        (() => {
                            const features = Array.isArray(boundaryData.features) ? boundaryData.features : [];
                            console.log('🗺️ Map boundary filtering:', {
                                barangayName,
                                totalFeatures: features.length,
                                featureNames: features.map((f: any) => f.properties?.NAME_3),
                                normalizedBarangayName: normalizeName(barangayName || '')
                            });
                            if (barangayName && barangayName !== 'N/A') {
                                const filtered = features.filter((f: any) => normalizeName(f.properties?.NAME_3 || '') === normalizeName(barangayName || ''));
                                console.log('🎯 Filtered features:', filtered.length, 'matches found');
                                if (filtered.length > 0) {
                                    console.log('✅ Showing boundary for:', filtered[0].properties?.NAME_3);
                                    return (
                                        <GeoJSON
                                            key={barangayName}
                                            data={{ type: 'FeatureCollection', features: filtered } as any}
                                            style={style}
                                        />
                                    );
                                } else {
                                    console.warn('⚠️ No boundary features matched barangay:', barangayName);
                                }
                                return null;
                            }
                            console.log('❌ No barangayName provided or barangayName is N/A, not showing boundary');
                            return null;
                        })()
                    )}

                    <FeatureGroup ref={featureGroupRef}>
                        {!drawingDisabled && (
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
                        )}
                        {/* Geometry preview overlay */}
                        {geometryPreview && (
                            <GeoJSON
                                data={geometryPreview}
                                style={{ color: 'blue', weight: 3, opacity: 0.8, fillOpacity: 0.2 }}
                            />
                        )}
                    </FeatureGroup>

                    {/* {boundaryData && <MapController data={boundaryData} />} */}
                </MapContainer>
            </div>
        );
    });

export default LandPlottingMap; 