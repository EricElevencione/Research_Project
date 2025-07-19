// unchanged imports
import React, { useState, useEffect, useRef } from 'react';
import LandPlottingMap, { LandPlottingMapRef } from '../../components/Map/LandPlottingMap';
import '../../assets/css/LandPlottingPage.css';
import { useNavigate, useParams } from 'react-router-dom';
import '../../assets/css/ActiveFarmersPage.css';
import { v4 as uuidv4 } from 'uuid'; // Add at the top for unique id generation
import type { Polygon as GeoJSONPolygon } from 'geojson';

// interfaces unchanged...
interface LandAttributes {
    name: string;
    ffrs_id: string;
    area: number;
    coordinateAccuracy: 'exact' | 'approximate';
    barangay: string;
    firstName: string;
    middleName: string;
    surname: string;
    ext_name: string;
    gender: 'Male' | 'Female';
    birthdate: string;
    municipality: string;
    province: string;
    parcel_address: string;
    status: 'Tenant' | 'Land Owner' | 'Farmer';
    street: string;
    farmType: 'Irrigated' | 'Rainfed Upland' | 'Rainfed Lowland';
    plotSource?: 'manual' | 'lot_plan'; // NEW FIELD
    parcelNumber?: number; // Added to fix linter error
    _isGenerated?: boolean; // Allow generated shape flag
}

interface Shape {
    id: string;
    layer: any;
    properties: LandAttributes;
    isEditing?: boolean;
}

const LandPlottingPage: React.FC = () => {
    const { barangayName = '' } = useParams<{ barangayName: string }>();
    const navigate = useNavigate();
    const mapRef = useRef<LandPlottingMapRef>(null);
    const [selectedShape, setSelectedShape] = useState<Shape | null>(null);
    const [isEditingAttributes, setIsEditingAttributes] = useState(false);
    const [plottingMethod, setPlottingMethod] = useState<'manual' | 'geometry'>('manual');

    // New state for parcel context
    const [parcelContext, setParcelContext] = useState<{
        recordId?: string;
        parcelIndex?: number;
        viewOnly?: boolean;
    }>({});
    const [rsbsaRecord, setRsbsaRecord] = useState<any>(null);
    const [currentParcel, setCurrentParcel] = useState<any>(null);

    const [landAttributes, setLandAttributes] = useState<LandAttributes>({
        name: '',
        ffrs_id: '',
        area: 0,
        coordinateAccuracy: 'approximate',
        barangay: '',
        firstName: '',
        middleName: '',
        surname: '',
        ext_name: '',
        gender: 'Male',
        birthdate: '',
        municipality: 'Dumangas',
        province: 'Iloilo',
        parcel_address: '',
        status: 'Tenant',
        street: '',
        farmType: 'Irrigated',
        plotSource: 'manual', // Default to manual for new plots
    });

    const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof LandAttributes, string>>>({});
    const [isSaving, setIsSaving] = useState(false);

    const requiredFields: (keyof LandAttributes)[] = [
        //'ffrs_id', // No longer required
        'surname', 'firstName', 'gender',
        'barangay', 'municipality', 'province', 'parcel_address', 'area'
    ];

    const handleAttributeChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        let newValue = value;
        // Convert last name, first name, and middle name to uppercase
        if (name === 'surname' || name === 'firstName' || name === 'middleName') {
            newValue = value.toUpperCase();
        }
        setLandAttributes(prev => ({
            ...prev,
            [name]: newValue,
            barangay: barangayName
        }));
    };

    const validateForm = (): boolean => {
        const errors: Partial<Record<keyof LandAttributes, string>> = {};
        requiredFields.forEach(field => {
            if (field === 'area') {
                if (landAttributes.area === undefined || landAttributes.area === null || isNaN(Number(landAttributes.area))) {
                    errors.area = 'This field is required';
                }
            } else if (!landAttributes[field]) {
                errors[field] = 'This field is required';
            }
        });
        setValidationErrors(errors);
        if (Object.keys(errors).length > 0) {
            // Show which fields are missing
            alert('Please fill in all required fields:\n' + Object.keys(errors).join(', '));
            return false;
        }
        return true;
    };

    const saveShapeAttributes = async (shapeToSave: Shape) => {
        if (!validateForm()) {
            return false;
        }

        try {
            const landPlotData = {
                ...landAttributes,
                area: Number(landAttributes.area),
                geometry: shapeToSave.layer.toGeoJSON().geometry,
                id: shapeToSave.id,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                plotSource: landAttributes.plotSource || 'manual', // Ensure plotSource is sent
            };

            // Determine if this is a new or existing plot
            // (Assume shapeToSave.id is unique for new, and already exists for update)
            // If the id exists in the backend, use PUT, else POST
            // For simplicity, check if the id exists in shapes state (could be improved with backend check)
            const isExisting = shapes.some(s => s.id === shapeToSave.id && s !== shapeToSave);
            const method = isExisting ? 'PUT' : 'POST';
            const url = isExisting ? `/api/land-plots/${shapeToSave.id}` : '/api/land-plots';
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(landPlotData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Save failed:', errorText);
                throw new Error('Failed to save land plot data');
            }

            if (shapeToSave.layer.feature) {
                shapeToSave.layer.feature.properties = {
                    ...shapeToSave.layer.feature.properties,
                    ...landAttributes
                };
            } else {
                shapeToSave.layer.feature = {
                    type: 'Feature',
                    properties: landAttributes,
                    geometry: shapeToSave.layer.toGeoJSON().geometry,
                };
            }

            alert('Land plot attributes saved successfully!');
            return true;
        } catch (error) {
            console.error('Error saving land plot:', error);
            alert('Failed to save land plot data. Please try again.');
            return false;
        }
    };

    // Add this helper to refresh shapes from backend
    const refreshShapesFromBackend = async () => {
        if (parcelContext.recordId) {
            await fetchRSBSARecord(parcelContext.recordId, parcelContext.parcelIndex);
        }
    };

    const handleSaveAttributes = async () => {
        setIsSaving(true);
        try {
            // 1. Delete removed shapes from backend
            for (const id of deletedShapeIds) {
                await fetch(`/api/land-plots/${id}`, { method: 'DELETE' });
            }
            setDeletedShapeIds([]); // Clear after deletion

            // 2. Save all remaining shapes
            for (const shape of shapes) {
                await saveShapeAttributes(shape);
            }

            // Refresh shapes from backend after save
            await refreshShapesFromBackend();

            // ...existing logic for updating UI, alerts, etc...
            // Always keep farmer info, only reset geometry fields
            setLandAttributes(prev => ({
                ...prev,
                area: 0,
                // Add other geometry-only fields to reset if needed
            }));
            setSelectedShape(null);
            if (currentParcel && rsbsaRecord) {
                setLandAttributes(prev => ({
                    ...prev,
                    firstName: rsbsaRecord.firstName || '',
                    middleName: rsbsaRecord.middleName || '',
                    surname: rsbsaRecord.surname || '',
                    barangay: currentParcel.farmLocation?.barangay || '',
                    municipality: currentParcel.farmLocation?.cityMunicipality || 'Dumangas',
                    // Optionally reset other fields as needed
                }));
            } else {
                setLandAttributes({
                    name: '',
                    ffrs_id: '',
                    area: 0,
                    coordinateAccuracy: 'approximate',
                    barangay: '',
                    firstName: '',
                    middleName: '',
                    surname: '',
                    ext_name: '',
                    gender: 'Male',
                    birthdate: '',
                    municipality: 'Dumangas',
                    province: 'Iloilo',
                    parcel_address: '',
                    status: 'Tenant',
                    street: '',
                    farmType: 'Irrigated',
                    plotSource: 'manual',
                });
            }
            setIsEditingAttributes(false);
            window.dispatchEvent(new Event('land-plot-saved'));
        } catch (error) {
            alert('Failed to save changes. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleShapeCreated = (shape: Shape) => {
        // Ensure a unique id for every new shape
        if (!shape.id) {
            shape.id = `shape-${Date.now()}-${uuidv4()}`;
        }
        // Assign the current landAttributes to the shape's properties
        shape.properties = { ...landAttributes };
        // Ensure birthdate is set if available
        if (!shape.properties.birthdate && landAttributes.birthdate) {
            shape.properties.birthdate = landAttributes.birthdate;
        }
        // Assign parcelNumber from currentParcel if available
        if (currentParcel && currentParcel.parcelNumber !== undefined) {
            (shape.properties as any).parcelNumber = currentParcel.parcelNumber;
        }
        // If the shape is a polygon, auto-calculate area
        const geo = shape.layer.toGeoJSON();
        if (geo.geometry.type === 'Polygon' && shape.layer.getArea) {
            shape.properties.area = shape.layer.getArea();
            setLandAttributes(prev => ({ ...prev, area: shape.layer.getArea() }));
        }
        setSelectedShape(shape);
        setIsEditingAttributes(true);
        // Add the new shape to the shapes array if not already present
        setShapesAndVersion((prevShapes: Shape[]) => {
            // Prevent duplicates by checking id
            if (prevShapes.some((s: Shape) => s.id === shape.id)) return prevShapes;
            return [...prevShapes, shape];
        });
    };

    const handleShapeFinalized = (shape: Shape) => {
        setSelectedShape(shape);
        setLandAttributes(prevAttributes => ({
            ...prevAttributes,
            ...shape.properties,
            barangay: shape.properties.barangay || barangayName || prevAttributes.barangay,
            municipality: shape.properties.municipality || 'Dumangas',
            province: shape.properties.province || 'Iloilo',
        }));
        setIsEditingAttributes(true);
    };

    // Edit: Add async persistence to backend for edits and deletions

    // Called when a shape is edited and "Save" is clicked
    const handleShapeEdited = async (shape: Shape) => {
        setSelectedShape(shape);
        setLandAttributes(prevAttributes => ({
            ...prevAttributes,
            ...shape.properties,
            barangay: shape.properties.barangay || barangayName || prevAttributes.barangay,
            municipality: shape.properties.municipality || 'Dumangas',
            province: shape.properties.province || 'Iloilo',
        }));
        setIsEditingAttributes(true);

        // Persist the edit to the backend
        try {
            const response = await fetch(`/api/land-plots/${shape.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...shape.properties,
                    geometry: shape.layer.toGeoJSON().geometry,
                }),
            });
            if (!response.ok) throw new Error('Failed to update land plot');
        } catch (error) {
            alert('Failed to save changes to the backend.');
        }
        // Refresh shapes from backend after edit
        await refreshShapesFromBackend();
    };

    // Called when shapes are deleted and "Save" is clicked
    const handleMapShapeDeleted = async (e: any) => {
        // e.shapes is an array of deleted shapes
        const deletedIds = e.shapes.map((s: any) => s.id);
        setDeletedShapeIds(prev => [...prev, ...deletedIds]);

        const remainingShapes = shapes.filter(s => !deletedIds.includes(s.id));
        setShapesAndVersion(remainingShapes);

        // Persist deletions to the backend
        for (const deletedShape of e.shapes) {
            try {
                await fetch(`/api/land-plots/${deletedShape.id}`, { method: 'DELETE' });
            } catch (error) {
                alert('Failed to delete land plot from the backend.');
            }
        }
        // Refresh shapes from backend after delete
        await refreshShapesFromBackend();

        if (remainingShapes.length > 0) {
            setSelectedShape(remainingShapes[0]);
            setLandAttributes(prev => ({
                ...prev,
                ...remainingShapes[0].properties,
                area: remainingShapes[0].properties.area || 0,
            }));
        } else {
            setSelectedShape(null);
            setGeometryPreview(null);
            setIsEditingAttributes(false);
            setLandAttributes(prev => ({
                ...prev,
                area: 0,
            }));
        }
    };

    const handleCancelEdit = () => {
        setIsEditingAttributes(false);
        if (selectedShape) {
            setLandAttributes({
                ...selectedShape.properties,
                municipality: selectedShape.properties.municipality || 'Dumangas',
                province: selectedShape.properties.province || 'Iloilo',
            });
        } else {
            setLandAttributes({
                name: '',
                ffrs_id: '',
                area: 0,
                coordinateAccuracy: 'approximate',
                barangay: '',
                firstName: '',
                middleName: '',
                surname: '',
                ext_name: '',
                gender: 'Male',
                birthdate: '',
                municipality: 'Dumangas',
                province: 'Iloilo',
                parcel_address: '',
                status: 'Tenant',
                street: '',
                farmType: 'Irrigated',
                plotSource: 'manual', // Reset plotSource on cancel
            });
        }
        setSelectedShape(null);
    };

    const handleBackClick = () => {
        // If we came from parcel selection, go back there
        if (parcelContext.recordId) {
            navigate(`/parcel-selection/${parcelContext.recordId}`);
        } else {
            navigate('/technician-rsbsa');
        }
    };

    useEffect(() => {
        if (selectedShape) {
            setLandAttributes({
                ...selectedShape.properties,
                barangay: selectedShape.properties.barangay || barangayName,
                municipality: selectedShape.properties.municipality || 'Dumangas',
                province: selectedShape.properties.province || 'Iloilo'
            });
            setIsEditingAttributes(true);
        } else {
            setLandAttributes({
                name: '',
                ffrs_id: '',
                area: 0,
                coordinateAccuracy: 'approximate',
                barangay: '',
                firstName: '',
                middleName: '',
                surname: '',
                ext_name: '',
                gender: 'Male',
                birthdate: '',
                municipality: 'Dumangas',
                province: 'Iloilo',
                parcel_address: '',
                status: 'Tenant',
                street: '',
                farmType: 'Irrigated',
                plotSource: 'manual', // Reset plotSource on initial load
            });
            setIsEditingAttributes(false);
        }
    }, [selectedShape, barangayName]);

    // Parse URL parameters for parcel context
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const recordId = urlParams.get('recordId');
        const parcelIndex = urlParams.get('parcelIndex');
        const parsedIndex = parcelIndex ? parseInt(parcelIndex, 10) : undefined;

        if (recordId) {
            setParcelContext({ recordId, parcelIndex: parsedIndex });
            fetchRSBSARecord(recordId, parsedIndex);
        }
    }, []);

    // Fetch RSBSA record data
    const fetchRSBSARecord = async (recordId: string, parcelIndex?: number) => {
        try {
            const response = await fetch(`http://localhost:5000/api/RSBSAform/${recordId}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            setRsbsaRecord(data);
            console.log('Fetched data:', data);
            console.log('parcelIndex:', parcelIndex);

            // Fallback: If no farmParcels, create one from root fields
            let farmParcels = data.farmParcels;
            if (!farmParcels || !Array.isArray(farmParcels) || farmParcels.length === 0) {
                farmParcels = [{
                    parcelNumber: data.parcelNumber || 1,
                    farmLocation: {
                        barangay: data.farmLocationBarangay || data.addressBarangay || '',
                        cityMunicipality: data.farmLocationCityMunicipality || data.addressMunicipality || ''
                    },
                    totalFarmArea: data.totalFarmArea || data.parcelArea || '',
                    cropCommodity: data.cropCommodity || '',
                    size: data.farmSize || data.parcelArea || '',
                    farmType: data.farmType || '',
                    organicPractitioner: data.organicPractitioner || '',
                    plotStatus: 'not_plotted'
                }];
            }

            if (parcelIndex !== undefined && farmParcels) {
                const parcel = farmParcels[parcelIndex];
                console.log('Selected parcel:', parcel);
                if (parcel) {
                    setCurrentParcel(parcel);
                    setLandAttributes(prev => ({
                        ...prev,
                        firstName: data.firstName || '',
                        middleName: data.middleName || '',
                        surname: data.surname || '',
                        barangay: parcel.farmLocation?.barangay || barangayName,
                        municipality: parcel.farmLocation?.cityMunicipality || 'Dumangas',
                        area: parseFloat(parcel.size || parcel.totalFarmArea || '0'),
                        parcel_address: `${parcel.farmLocation?.barangay || ''}, ${parcel.farmLocation?.cityMunicipality || ''}`,
                        farmType: parcel.farmType || 'Irrigated',
                        plotSource: parcel.plotSource || 'manual',
                        parcelNumber: parcel.parcelNumber,
                    }));

                    // --- NEW: Load all geometry for this parcel and farmer ---
                    let shapes: Shape[] = [];
                    let L: any = (window as any).L;
                    if (!L) {
                        L = (await import('leaflet'));
                        L = L.default || L;
                    }
                    if (parcel.geometry) {
                        const layer = L.geoJSON(parcel.geometry).getLayers()[0];
                        shapes.push({
                            id: `parcel-${parcel.parcelNumber}`,
                            layer,
                            properties: {
                                ...parcel,
                                ...data,
                                area: parcel.size || parcel.totalFarmArea || 0,
                                parcelNumber: parcel.parcelNumber,
                            },
                        });
                    }
                    const landPlotsRes = await fetch('/api/land-plots');
                    if (landPlotsRes.ok) {
                        const allPlots = await landPlotsRes.json();
                        // Diagnostic logging
                        console.log('All plots from backend:', allPlots);
                        // Robust matching: ignore case, trim, allow missing middle names
                        const normalize = (str: string) => (str || '').trim().toLowerCase();
                        const parcelAddr = normalize(`${parcel.farmLocation?.barangay || ''}, ${parcel.farmLocation?.cityMunicipality || ''}`);
                        const surname = normalize(data.surname);
                        const firstName = normalize(data.firstName);
                        // Log filter values and all plots for debugging
                        console.log('Filtering for:', { parcelAddr, surname, firstName });
                        allPlots.forEach((plot: any) => {
                            console.log('plot:', plot.parcel_address, plot.surname, plot.firstName, plot.middleName);
                        });
                        // Relaxed filter: only require parcel_address, surname, and firstName to match
                        const matches = allPlots.filter((plot: any) => {
                            return (
                                normalize(plot.parcel_address) === parcelAddr &&
                                normalize(plot.surname) === surname &&
                                normalize(plot.firstName) === firstName
                            );
                        });
                        // Diagnostic logging
                        console.log('Filtered plots for this parcel:', matches);
                        matches.forEach((match: any) => {
                            const layer = L.geoJSON(match.geometry).getLayers()[0];
                            layer.options.id = match.id;
                            shapes.push({
                                id: match.id,
                                layer,
                                properties: match,
                            });
                        });
                    }
                    setShapesAndVersion(shapes);
                    const selected = shapes.find(s => s.properties.parcelNumber === parcel.parcelNumber) || shapes[0];
                    setSelectedShape(selected || null);
                    setIsEditingAttributes(!!selected);
                    if (selected) setLandAttributes((prev) => ({ ...prev, ...selected.properties }));
                    if (!selected) setIsEditingAttributes(false);
                }
            }
        } catch (error) {
            console.error('Error fetching RSBSA record:', error);
        }
    };

    useEffect(() => {
        const handleLandPlotDeleted = (event: any) => {
            const deletedId = event.detail.id;
            if (mapRef.current && typeof mapRef.current.deleteShape === 'function') {
                mapRef.current.deleteShape(deletedId);
            }
        };
        window.addEventListener('land-plot-deleted', handleLandPlotDeleted);
        return () => {
            window.removeEventListener('land-plot-deleted', handleLandPlotDeleted);
        };
    }, []);

    console.log('currentParcel:', currentParcel);

    // Geometry input state
    const [geometryStart, setGeometryStart] = useState<{ lat: string; lng: string }>({ lat: '', lng: '' });
    // Support both DMS and decimal degrees, with a toggle
    const [bearingInputMode, setBearingInputMode] = useState<'dms' | 'decimal'>('dms');
    type GeometryPoint = {
        pointNumber: number;
        dir1: 'N' | 'S';
        degrees: string;
        minutes: string; // optional, can be ''
        dir2: 'E' | 'W';
        decimalDegrees: string; // for decimal mode
        distance: string;
    };
    const [geometryPoints, setGeometryPoints] = useState<GeometryPoint[]>([
        { pointNumber: 1, dir1: 'N', degrees: '', minutes: '', dir2: 'E', decimalDegrees: '', distance: '' }
    ]);
    const [geometryPreview, setGeometryPreview] = useState<any>(null); // GeoJSON geometry

    // Helper: Convert DMS + directions to azimuth (degrees from north, clockwise)
    function dmsToAzimuth(dir1: 'N' | 'S', degrees: string, minutes: string, dir2: 'E' | 'W') {
        // Convert DMS to decimal
        const deg = parseFloat(degrees) || 0;
        const min = parseFloat(minutes) || 0;
        const dec = deg + min / 60;
        // Example: S 54° 30' E
        // N/E: azimuth = dec
        // S/E: azimuth = 180 - dec
        // S/W: azimuth = 180 + dec
        // N/W: azimuth = 360 - dec
        if (dir1 === 'N' && dir2 === 'E') return dec;
        if (dir1 === 'S' && dir2 === 'E') return 180 - dec;
        if (dir1 === 'S' && dir2 === 'W') return 180 + dec;
        if (dir1 === 'N' && dir2 === 'W') return 360 - dec;
        return dec; // fallback
    }

    // Helper: Convert bearing in degrees to radians clockwise from north
    function bearingToRadians(bearingDeg: number) {
        return (90 - bearingDeg) * (Math.PI / 180);
    }

    // Helper: Compute next lat/lng given start, bearing (deg), and distance (meters)
    function computeDestinationLatLng(lat: number, lng: number, bearingDeg: number, distance: number) {
        const R = 6378137; // Earth radius in meters
        const bearingRad = bearingToRadians(bearingDeg);
        const latRad = lat * Math.PI / 180;
        const lngRad = lng * Math.PI / 180;
        const dByR = distance / R;
        const newLatRad = Math.asin(Math.sin(latRad) * Math.cos(dByR) + Math.cos(latRad) * Math.sin(dByR) * Math.cos(bearingRad));
        const newLngRad = lngRad + Math.atan2(Math.sin(bearingRad) * Math.sin(dByR) * Math.cos(latRad), Math.cos(dByR) - Math.sin(latRad) * Math.sin(newLatRad));
        return {
            lat: newLatRad * 180 / Math.PI,
            lng: newLngRad * 180 / Math.PI
        };
    }

    // Helper: Get azimuth from point (handles both modes)
    function getAzimuth(pt: GeometryPoint) {
        if (bearingInputMode === 'decimal') {
            // Decimal degrees, assume N/E (or let user pick dir1/dir2)
            const dec = parseFloat(pt.decimalDegrees) || 0;
            // Use dir1/dir2 for quadrant
            return dmsToAzimuth(pt.dir1, pt.decimalDegrees, '0', pt.dir2);
        } else {
            return dmsToAzimuth(pt.dir1, pt.degrees, pt.minutes, pt.dir2);
        }
    }

    // Generate geometry from geometry input
    const handleGenerateGeometry = () => {
        // Use 0,0 if user leaves blank
        const startLat = geometryStart.lat.trim() === '' ? 0 : parseFloat(geometryStart.lat);
        const startLng = geometryStart.lng.trim() === '' ? 0 : parseFloat(geometryStart.lng);
        if (isNaN(startLat) || isNaN(startLng)) {
            alert('Please enter a valid starting latitude and longitude or leave both blank for relative plotting.');
            return;
        }
        let coords = [[startLng, startLat]];
        let curr = { lat: startLat, lng: startLng };
        for (const pt of geometryPoints) {
            const azimuth = getAzimuth(pt);
            const distance = parseFloat(pt.distance);
            if (isNaN(azimuth) || isNaN(distance)) {
                alert('Please enter valid bearing and distance values.');
                return;
            }
            curr = computeDestinationLatLng(curr.lat, curr.lng, azimuth, distance);
            coords.push([curr.lng, curr.lat]);
        }
        // Close the polygon
        coords.push([startLng, startLat]);
        const geojson: GeoJSONPolygon = {
            type: 'Polygon',
            coordinates: [coords]
        };
        setGeometryPreview(geojson);

        // --- Add as a real shape ---
        import('leaflet').then(L => {
            const layer = L.geoJSON(geojson).getLayers()[0];
            const newShape = {
                id: `shape-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                layer,
                properties: { ...landAttributes, area: 0 },
            };
            // Only allow one generated shape at a time (remove previous preview shape if any)
            setShapesAndVersion(prevShapes => {
                // Remove any shape with a special flag (e.g., area 0 and coordinates at 0,0)
                const filtered = prevShapes.filter(s => !(s.properties && s.properties._isGenerated));
                newShape.properties._isGenerated = true; // Mark as generated for easy removal
                return [...filtered, newShape];
            });
            setSelectedShape(newShape);
            setIsEditingAttributes(true);
            setGeometryPreview(null); // Clear preview after adding
        });
    };

    const [shapes, setShapes] = useState<Shape[]>([]);
    const [shapesVersion, setShapesVersion] = useState(0);
    const [deletedShapeIds, setDeletedShapeIds] = useState<string[]>([]);

    // When setting shapes, increment shapesVersion
    const setShapesAndVersion = (newShapes: Shape[] | ((prevShapes: Shape[]) => Shape[])) => {
        setShapes(prev => {
            const updated = typeof newShapes === 'function' ? (newShapes as (prevShapes: Shape[]) => Shape[])(prev) : newShapes;
            setShapesVersion(v => v + 1);
            return updated;
        });
    };

    // Helper: Check if a polygon exists for the current parcel
    const polygonExistsForCurrentParcel = shapes.some(
        (shape) => {
            const geo = shape.layer && shape.layer.toGeoJSON && shape.layer.toGeoJSON();
            // Only check for Polygon type
            return (
                geo && geo.geometry && geo.geometry.type === 'Polygon' &&
                ((currentParcel && shape.properties && shape.properties.parcelNumber === currentParcel.parcelNumber) ||
                    (!currentParcel && shape.properties && shape.properties.parcelNumber === undefined))
            );
        }
    );

    return (
        <div className="landplotting-container" style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '90vh', border: '1px solid #222', borderRadius: '10px', margin: '2rem', background: '#fff' }}>
            {/* Back Button at top left */}
            <button
                className="back-button"
                onClick={handleBackClick}
                style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 10, fontSize: '1.5rem', background: '#black', border: '1px solid #222', width: '2.5rem', height: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                aria-label="Back"
            >
                ←
            </button>
            <div style={{ display: 'flex', flex: 1, height: '100%' }}>
                {/* Left: Map */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid #ccc', padding: '2rem 1rem' }}>
                    <div style={{ width: '90%', height: '80%', background: '#666', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {/* Map component */}
                        <div style={{ width: '100%', height: '100%' }}>
                            <LandPlottingMap
                                ref={mapRef}
                                selectedShape={selectedShape}
                                onShapeSelected={setSelectedShape}
                                onShapeCreated={handleShapeCreated}
                                onShapeEdited={handleShapeEdited}
                                onShapeDeleted={handleMapShapeDeleted}
                                barangayName={landAttributes.barangay}
                                onShapeFinalized={handleShapeFinalized}
                                // Only disable drawing if geometry mode
                                drawingDisabled={plottingMethod === 'geometry'}
                                geometryPreview={plottingMethod === 'geometry' ? geometryPreview : null}
                                shapes={shapes}
                                polygonExistsForCurrentParcel={polygonExistsForCurrentParcel}
                            />
                        </div>
                    </div>
                    {/* Optionally, remove the red warning message since modal will handle feedback */}
                </div>
                {/* Right: Details Panel */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #ccc', padding: '2rem 2rem 2rem 2rem', justifyContent: 'flex-start', overflowY: 'auto', maxHeight: '100%' }}>
                    {/* Plotting Method Selector */}
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ fontWeight: 'bold', marginRight: '1rem' }}>Plotting Method:</label>
                        <label style={{ marginRight: '1rem' }}>
                            <input
                                type="radio"
                                name="plottingMethod"
                                value="manual"
                                checked={plottingMethod === 'manual'}
                                onChange={() => setPlottingMethod('manual')}
                            />
                            Manual Mapping
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="plottingMethod"
                                value="geometry"
                                checked={plottingMethod === 'geometry'}
                                onChange={() => setPlottingMethod('geometry')}
                            />
                            Geometry Input
                        </label>
                    </div>
                    <div style={{ borderBottom: '2px solid #222', marginBottom: '1.5rem', paddingBottom: '0.5rem', fontWeight: 'bold', fontSize: '1.5rem', letterSpacing: '1px' }}>
                        {currentParcel && (currentParcel.parcelNumber !== undefined && currentParcel.parcelNumber !== null && currentParcel.parcelNumber !== '')
                            ? `Farm Parcel #${currentParcel.parcelNumber}`
                            : (selectedShape && (selectedShape.properties as any).parcelNumber !== undefined)
                                ? `Farm Parcel #${(selectedShape.properties as any).parcelNumber}`
                                : 'Farm Parcel #1'}
                    </div>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Details:</div>
                    <div style={{ marginBottom: '1rem' }}>
                        <div>
                            <span style={{ fontWeight: 'bold' }}>Name:</span>
                            {` ${landAttributes.surname} ${landAttributes.firstName} ${landAttributes.middleName}`}
                        </div>
                        <div>
                            <span style={{ fontWeight: 'bold' }}>Municipality:</span>
                            {` ${landAttributes.municipality}`}
                        </div>
                        <div>
                            <span style={{ fontWeight: 'bold' }}>Barangay:</span>
                            {` ${landAttributes.barangay}`}
                        </div>
                        <div>
                            <span style={{ fontWeight: 'bold' }}>History:</span>
                            {/* History will be added here in the future */}
                        </div>
                    </div>
                    {/* Editable plot-specific fields */}
                    {/* Removed Area (sqm) and Plot Source fields as requested */}

                    {/* Geometry Input Form (only show if geometry mode) */}
                    {plottingMethod === 'geometry' && (
                        <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px', background: '#f9f9f9', maxHeight: 350, overflowY: 'auto' }}>
                            {/* UI note for relative plotting */}
                            <div style={{ color: '#b36b00', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                                Note: If you leave the starting latitude and longitude blank, the lot will be plotted as a relative shape (not georeferenced to a real-world location).
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ fontWeight: 'bold', marginRight: '1rem' }}>Starting Point (Lat, Lng):</label>
                                <input
                                    type="text"
                                    placeholder="Latitude"
                                    value={geometryStart.lat}
                                    onChange={e => setGeometryStart(s => ({ ...s, lat: e.target.value }))}
                                    style={{ width: '7rem', marginRight: '0.5rem' }}
                                />
                                <input
                                    type="text"
                                    placeholder="Longitude"
                                    value={geometryStart.lng}
                                    onChange={e => setGeometryStart(s => ({ ...s, lng: e.target.value }))}
                                    style={{ width: '7rem' }}
                                />
                            </div>
                            <div style={{ marginBottom: '0.5rem' }}>
                                <label style={{ fontWeight: 'bold', marginRight: '1rem' }}>Bearing Input Mode:</label>
                                <label style={{ marginRight: '1rem' }}>
                                    <input type="radio" name="bearingMode" value="dms" checked={bearingInputMode === 'dms'} onChange={() => setBearingInputMode('dms')} /> DMS (Deg/Min)
                                </label>
                                <label>
                                    <input type="radio" name="bearingMode" value="decimal" checked={bearingInputMode === 'decimal'} onChange={() => setBearingInputMode('decimal')} /> Decimal Degrees
                                </label>
                            </div>
                            <div>
                                <table style={{ width: '100%', marginBottom: '1rem', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ borderBottom: '1px solid #ccc' }}>Point #</th>
                                            <th style={{ borderBottom: '1px solid #ccc' }}>Dir1</th>
                                            {bearingInputMode === 'dms' ? <>
                                                <th style={{ borderBottom: '1px solid #ccc' }}>Deg</th>
                                                <th style={{ borderBottom: '1px solid #ccc' }}>Min</th>
                                            </> : <>
                                                <th style={{ borderBottom: '1px solid #ccc' }}>Decimal</th>
                                            </>}
                                            <th style={{ borderBottom: '1px solid #ccc' }}>Dir2</th>
                                            <th style={{ borderBottom: '1px solid #ccc' }}>Distance (m)</th>
                                            <th style={{ borderBottom: '1px solid #ccc' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {geometryPoints.map((pt, idx) => (
                                            <tr key={idx}>
                                                <td>{pt.pointNumber}</td>
                                                <td>
                                                    <select value={pt.dir1} onChange={e => setGeometryPoints(points => points.map((p, i) => i === idx ? { ...p, dir1: e.target.value as 'N' | 'S' } : p))}>
                                                        <option value="N">N</option>
                                                        <option value="S">S</option>
                                                    </select>
                                                </td>
                                                {bearingInputMode === 'dms' ? <>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={pt.degrees}
                                                            onChange={e => setGeometryPoints(points => points.map((p, i) => i === idx ? { ...p, degrees: e.target.value } : p))}
                                                            style={{ width: '4rem' }}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={pt.minutes}
                                                            onChange={e => setGeometryPoints(points => points.map((p, i) => i === idx ? { ...p, minutes: e.target.value } : p))}
                                                            style={{ width: '4rem' }}
                                                        />
                                                    </td>
                                                </> : <>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={pt.decimalDegrees}
                                                            onChange={e => setGeometryPoints(points => points.map((p, i) => i === idx ? { ...p, decimalDegrees: e.target.value } : p))}
                                                            style={{ width: '7rem' }}
                                                        />
                                                    </td>
                                                </>}
                                                <td>
                                                    <select value={pt.dir2} onChange={e => setGeometryPoints(points => points.map((p, i) => i === idx ? { ...p, dir2: e.target.value as 'E' | 'W' } : p))}>
                                                        <option value="E">E</option>
                                                        <option value="W">W</option>
                                                    </select>
                                                </td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        value={pt.distance}
                                                        onChange={e => setGeometryPoints(points => points.map((p, i) => i === idx ? { ...p, distance: e.target.value } : p))}
                                                        style={{ width: '6rem' }}
                                                    />
                                                </td>
                                                <td>
                                                    {geometryPoints.length > 1 && (
                                                        <button onClick={() => setGeometryPoints(points => points.filter((_, i) => i !== idx))} style={{ color: 'red' }}>Remove</button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <button onClick={() => setGeometryPoints(points => [...points, { pointNumber: points.length + 1, dir1: 'N', degrees: '', minutes: '', dir2: 'E', decimalDegrees: '', distance: '' }])} style={{ marginRight: '1rem' }}>Add Point</button>
                            </div>
                            <div>
                                <button onClick={handleGenerateGeometry} style={{ marginTop: '1rem', fontWeight: 'bold' }}>Generate Shape</button>
                            </div>
                        </div>
                    )}

                    <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={handleSaveAttributes} disabled={!isEditingAttributes || isSaving} style={{ padding: '0.5rem 2rem', borderRadius: '8px', border: '1px solid #222', background: '#fff', fontWeight: 'bold', cursor: isEditingAttributes && !isSaving ? 'pointer' : 'not-allowed' }}>
                            {isSaving ? 'Saving...' : 'SAVE'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LandPlottingPage; 