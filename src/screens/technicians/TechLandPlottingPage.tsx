// unchanged imports
import React, { useState, useEffect, useRef } from 'react';
import LandPlottingMap, { LandPlottingMapRef } from '../../components/Map/LandPlottingMap';
import { useNavigate, useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid'; // Add at the top for unique id generation

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
    const { barangayName: barangayNameParam, recordId } = useParams();
    const urlParams = new URLSearchParams(window.location.search);
    const barangayNameQuery = urlParams.get('barangayName');
    // Use URL barangay as fallback only - parcel location will be primary
    const fallbackBarangayName = barangayNameParam || barangayNameQuery || '';
    console.log('DEBUG: Fallback barangayName from URL:', fallbackBarangayName);
    const navigate = useNavigate();
    const mapRef = useRef<LandPlottingMapRef>(null);
    const [selectedShape, setSelectedShape] = useState<Shape | null>(null);
    const [isEditingAttributes, setIsEditingAttributes] = useState(false);

    // New state for parcel context
    const [parcelContext, setParcelContext] = useState<{
        recordId?: string;
        parcelIndex?: number;
        viewOnly?: boolean;
    }>({});
    const [rsbsaRecord, setRsbsaRecord] = useState<any>(null);
    const [currentParcel, setCurrentParcel] = useState<any>(null);
    // State to track the actual parcel barangay (from RSBSA form)
    const [parcelBarangay, setParcelBarangay] = useState<string>('');

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
        municipality: 'Dumangas',
        province: 'Iloilo',
        parcel_address: '',
        status: 'Tenant',
        street: '',
        farmType: 'Irrigated',
        plotSource: 'manual', // Default to manual for new plots
    });

    const [isSaving, setIsSaving] = useState(false);

    const requiredFields: (keyof LandAttributes)[] = [
        //'ffrs_id', // No longer required
        'surname', 'firstName', 'gender',
        'barangay', 'municipality', 'province', 'parcel_address', 'area'
    ];

    const validateForm = (): boolean => {
        const errors: Partial<Record<keyof LandAttributes, string>> = {};
        requiredFields.forEach(field => {
            if (field === 'area') {
                if (landAttributes.area === undefined || landAttributes.area === null || isNaN(Number(landAttributes.area))) {
                    errors.area = 'This field is required';
                }
            } else if (field === 'barangay') {
                // Use derived barangay for validation
                const derivedBarangay = landAttributes.barangay || parcelBarangay || fallbackBarangayName;
                if (!derivedBarangay || derivedBarangay === 'N/A') {
                    errors.barangay = 'This field is required';
                }
            } else if (!landAttributes[field]) {
                errors[field] = 'This field is required';
            }
        });
        if (Object.keys(errors).length > 0) {
            // Show which fields are missing with better formatting
            const missingFields = Object.keys(errors).map(key => {
                // Convert camelCase to readable text
                return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            });
            alert('Please fill in all required fields:\n\n' + missingFields.join('\n'));
            return false;
        }
        return true;
    };

    const saveShapeAttributes = async (shapeToSave: Shape) => {
        if (!validateForm()) {
            return false;
        }

        try {
            // Ensure barangay is populated using derived value
            const derivedBarangay = landAttributes.barangay || parcelBarangay || fallbackBarangayName;

            const landPlotData = {
                ...landAttributes,
                area: Number(landAttributes.area),
                geometry: shapeToSave.layer.toGeoJSON().geometry,
                id: shapeToSave.id,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                plotSource: landAttributes.plotSource || 'manual',
                // Ensure barangay is always populated
                barangay: derivedBarangay,
                // Ensure parcel_address is populated
                parcel_address: landAttributes.parcel_address || `${derivedBarangay}, ${landAttributes.municipality || 'Dumangas'}`,
            };

            // Determine if this is a new or existing plot
            // (Assume shapeToSave.id is unique for new, and already exists for update)
            // If the id exists in the backend, use PUT, else POST
            // For simplicity, check if the id exists in shapes state (could be improved with backend check)
            const isExisting = shapes.some(s => s.id === shapeToSave.id && s !== shapeToSave);
            const method = isExisting ? 'PUT' : 'POST';
            const url = isExisting ? `http://localhost:5000/api/land-plots/${shapeToSave.id}` : 'http://localhost:5000/api/land-plots';
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
                await fetch(`http://localhost:5000/api/land-plots/${id}`, { method: 'DELETE' });
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
                    barangay: parcelBarangay || fallbackBarangayName,
                    firstName: '',
                    middleName: '',
                    surname: '',
                    ext_name: '',
                    gender: 'Male',
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

        // Pre-populate shape properties with current farmer info and parcel data
        const prefilledProperties = {
            ...landAttributes,
            // Ensure farmer info is included
            surname: landAttributes.surname || rsbsaRecord?.surname || '',
            firstName: landAttributes.firstName || rsbsaRecord?.firstName || '',
            middleName: landAttributes.middleName || rsbsaRecord?.middleName || '',
            gender: landAttributes.gender || rsbsaRecord?.gender || 'Male',
            // Ensure location info is included
            barangay: parcelBarangay || landAttributes.barangay || fallbackBarangayName || '',
            municipality: landAttributes.municipality || currentParcel?.farm_location_city_municipality || 'Dumangas',
            province: 'Iloilo',
            parcel_address: landAttributes.parcel_address || `${parcelBarangay || fallbackBarangayName}, ${landAttributes.municipality || 'Dumangas'}`,
        };

        shape.properties = prefilledProperties;

        // Assign parcelNumber from currentParcel if available
        if (currentParcel && currentParcel.parcel_number !== undefined) {
            (shape.properties as any).parcelNumber = currentParcel.parcel_number;
        }

        // If the shape is a polygon, auto-calculate area
        const geo = shape.layer.toGeoJSON();
        if (geo.geometry.type === 'Polygon' && shape.layer.getArea) {
            shape.properties.area = shape.layer.getArea();
            prefilledProperties.area = shape.layer.getArea();
        }

        // Update landAttributes with prefilled data
        setLandAttributes(prefilledProperties);

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
            barangay: shape.properties.barangay || parcelBarangay || fallbackBarangayName || prevAttributes.barangay,
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
            barangay: shape.properties.barangay || parcelBarangay || fallbackBarangayName || prevAttributes.barangay,
            municipality: shape.properties.municipality || 'Dumangas',
            province: shape.properties.province || 'Iloilo',
        }));
        setIsEditingAttributes(true);

        // Persist the edit to the backend
        try {
            const response = await fetch(`http://localhost:5000/api/land-plots/${shape.id}`, {
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
                await fetch(`http://localhost:5000/api/land-plots/${deletedShape.id}`, { method: 'DELETE' });
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
            setIsEditingAttributes(false);
            setLandAttributes(prev => ({
                ...prev,
                area: 0,
            }));
        }
    };

    const handleBackClick = () => {
        // If we came from parcel selection, go back there
        if (parcelContext.recordId) {
            navigate(`/technician-pick-land-parcel/${parcelContext.recordId}`);
        } else {
            navigate('/technician-rsbsa');
        }
    };

    useEffect(() => {
        if (selectedShape) {
            setLandAttributes({
                ...selectedShape.properties,
                barangay: selectedShape.properties.barangay || parcelBarangay || fallbackBarangayName,
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
                barangay: parcelBarangay || fallbackBarangayName,
                firstName: '',
                middleName: '',
                surname: '',
                ext_name: '',
                gender: 'Male',

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
    }, [selectedShape, parcelBarangay, fallbackBarangayName]);

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

    // Helper function to fetch farm parcel data from the database
    const fetchFarmParcelData = async (recordId: string, parcelIndex: number) => {
        try {
            // Fetch the specific farm parcel data
            const response = await fetch(`http://localhost:5000/api/farm-parcels?recordId=${recordId}&parcelIndex=${parcelIndex}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const parcelData = await response.json();
            console.log('📍 Fetched farm parcel data:', parcelData);
            return parcelData;
        } catch (error) {
            console.error('Error fetching farm parcel data:', error);
            return null;
        }
    };

    // Fetch RSBSA record data
    const fetchRSBSARecord = async (recordId: string, parcelIndex?: number) => {
        try {
            const response = await fetch(`http://localhost:5000/api/rsbsa_submission/${recordId}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            setRsbsaRecord(data);
            console.log('Fetched RSBSA data:', data);
            console.log('parcelIndex:', parcelIndex);

            // Fetch farm parcel data from the database
            let farmParcels = data.farmParcels;
            if (!farmParcels || !Array.isArray(farmParcels) || farmParcels.length === 0) {
                // If no farmParcels in the RSBSA data, fetch from farm_parcels table
                const parcelData = await fetchFarmParcelData(recordId, parcelIndex || 0);
                if (parcelData) {
                    farmParcels = [parcelData];
                } else {
                    // Fallback: create basic parcel structure
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
            }

            if (parcelIndex !== undefined && farmParcels) {
                const parcel = farmParcels[parcelIndex];
                console.log('Selected parcel:', parcel);
                if (parcel) {
                    setCurrentParcel(parcel);

                    // Use the farm parcel data from the database
                    console.log('📍 Raw parcel data:', parcel);
                    const parcelBarangayLocation = parcel.farm_location_barangay || parcel.farmLocation?.barangay || parcel.farmLocationBarangay || data.addressBarangay || fallbackBarangayName;
                    const parcelMunicipalityLocation = parcel.farm_location_city_municipality || parcel.farmLocation?.cityMunicipality || parcel.farmLocationCityMunicipality || data.addressMunicipality || 'Dumangas';

                    // Ensure we have a valid barangay
                    const finalBarangay = parcelBarangayLocation || fallbackBarangayName || '';
                    setParcelBarangay(finalBarangay);
                    console.log('📍 Setting parcelBarangay to:', finalBarangay);

                    setLandAttributes(prev => ({
                        ...prev,
                        firstName: data.firstName || '',
                        middleName: data.middleName || '',
                        surname: data.lastName || data.surname || '',
                        gender: data.gender || 'Male',
                        barangay: finalBarangay,
                        municipality: parcelMunicipalityLocation,
                        area: parseFloat(parcel.total_farm_area_ha || parcel.farm_size || parcel.total_farm_area || '0'),
                        parcel_address: `${finalBarangay}, ${parcelMunicipalityLocation}`,
                        farmType: parcel.farm_type || 'Irrigated',
                        plotSource: parcel.plot_source || 'manual',
                        parcelNumber: parcel.parcel_number,
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
                    const landPlotsRes = await fetch('http://localhost:5000/api/land-plots');
                    if (landPlotsRes.ok) {
                        const allPlots = await landPlotsRes.json();
                        // Diagnostic logging
                        console.log('All plots from backend:', allPlots);
                        // Robust matching: ignore case, trim, allow missing middle names
                        const normalize = (str: string) => (str || '').trim().toLowerCase();
                        const parcelAddr = normalize(`${parcelBarangayLocation}, ${parcelMunicipalityLocation}`);
                        const surname = normalize(data.lastName || data.surname || '');
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
                                properties: {
                                    ...match,
                                    parcelNumber: parcel.parcel_number,
                                },
                            });
                        });
                    }
                    setShapesAndVersion(shapes);
                    const selected = shapes.find(s => s.properties.parcelNumber === parcel.parcel_number) || shapes[0];
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

    const [shapes, setShapes] = useState<Shape[]>([]);
    const [deletedShapeIds, setDeletedShapeIds] = useState<string[]>([]);

    // Helper function to set shapes
    const setShapesAndVersion = (newShapes: Shape[] | ((prevShapes: Shape[]) => Shape[])) => {
        setShapes(prev => {
            const updated = typeof newShapes === 'function' ? (newShapes as (prevShapes: Shape[]) => Shape[])(prev) : newShapes;
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

    // Add at the top with other useState imports
    const [parcelHistory, setParcelHistory] = useState<any[]>([]);

    // Fetch land history for current farmer
    useEffect(() => {
        console.log('Effect: Fetching land history for farmer');
        if (rsbsaRecord && rsbsaRecord.id) {
            console.log('Fetching land history for farmer ID:', rsbsaRecord.id);
            // Fetch from land_history table filtered by farmer
            fetch(`http://localhost:5000/api/land-history/farmer/${rsbsaRecord.id}`)
                .then(res => res.json())
                .then(data => {
                    console.log('Fetched land history:', data);
                    setParcelHistory(Array.isArray(data) ? data : []);
                })
                .catch(error => {
                    console.error('Error fetching land history:', error);
                    setParcelHistory([]);
                });
        } else {
            console.log('No rsbsaRecord, not fetching history');
            setParcelHistory([]);
        }
    }, [rsbsaRecord]);

    // Use all history records without filtering
    const currentFarmerHistory = parcelHistory;

    console.log("📍 Barangay going to map:", landAttributes.barangay);
    console.log("📦 Current Parcel:", currentParcel);
    console.log("👤 Current Farmer:", `${landAttributes.surname} ${landAttributes.firstName} ${landAttributes.middleName}`);
    console.log("📋 Filtered History Count:", currentFarmerHistory.length, "of", parcelHistory.length, "total records");

    // Helpers to robustly derive display values from various possible field names
    function getDisplayBarangay() {
        const candidates = [
            currentParcel?.farm_location_barangay,
            currentParcel?.farmLocation?.barangay,
            (currentParcel as any)?.farmLocationBarangay,
            (currentParcel as any)?.barangay,
            landAttributes.barangay,
            (rsbsaRecord as any)?.farmLocationBarangay,
            rsbsaRecord?.addressBarangay,
            (rsbsaRecord as any)?.barangay,
        ];
        const value = candidates.find(v => typeof v === 'string' && v.trim().length > 0);
        return value || 'N/A';
    }

    function getDisplayMunicipality() {
        const candidates = [
            (currentParcel as any)?.farm_location_city_municipality,
            currentParcel?.farmLocation?.cityMunicipality,
            (currentParcel as any)?.farmLocationCityMunicipality,
            landAttributes.municipality,
            rsbsaRecord?.addressMunicipality,
            'Dumangas'
        ];
        const value = candidates.find(v => typeof v === 'string' && v.trim().length > 0);
        return value || 'Dumangas';
    }

    function toNumberOrNull(val: any): number | null {
        if (val === 0) return 0;
        if (val === null || val === undefined) return null;
        const num = typeof val === 'string' ? parseFloat(val) : (typeof val === 'number' ? val : NaN);
        return Number.isFinite(num) ? num : null;
    }

    function getDisplayAreaHectares() {
        const candidateNums = [
            toNumberOrNull((currentParcel as any)?.total_farm_area_ha),
            toNumberOrNull((currentParcel as any)?.total_farm_area),
            toNumberOrNull((currentParcel as any)?.farm_size),
            toNumberOrNull((currentParcel as any)?.size),
            toNumberOrNull(landAttributes.area),
            toNumberOrNull((rsbsaRecord as any)?.totalFarmArea),
        ];
        const value = candidateNums.find(v => v !== null);
        if (value === null || value === undefined) return 'N/A';
        // Keep 0 if actual value is 0; otherwise format to max 4 decimals
        const formatted = value === 0 ? '0' : String(Math.round((value as number) * 10000) / 10000);
        return `${formatted} hectares`;
    }

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
                                barangayName={getDisplayBarangay()}
                                onShapeFinalized={handleShapeFinalized}
                                drawingDisabled={false}
                                geometryPreview={null}
                                shapes={shapes}
                                polygonExistsForCurrentParcel={polygonExistsForCurrentParcel}
                            />
                        </div>
                    </div>
                    {/* Optionally, remove the red warning message since modal will handle feedback */}
                </div>
                {/* Right: Details Panel */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #ccc', padding: '2rem 2rem 2rem 2rem', justifyContent: 'flex-start', overflowY: 'auto', maxHeight: '100%' }}>
                    <div style={{ borderBottom: '2px solid #222', marginBottom: '1.5rem', paddingBottom: '0.5rem', fontWeight: 'bold', fontSize: '1.5rem', letterSpacing: '1px' }}>
                        {currentParcel && (currentParcel.parcel_number !== undefined && currentParcel.parcel_number !== null && currentParcel.parcel_number !== '')
                            ? `Farm Parcel #${currentParcel.parcel_number}`
                            : (selectedShape && (selectedShape.properties as any).parcelNumber !== undefined)
                                ? `Farm Parcel #${(selectedShape.properties as any).parcelNumber}`
                                : 'Farm Parcel #1'}
                    </div>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Details:</div>
                    <div style={{ marginBottom: '1rem' }}>
                        <div>
                            <span style={{ fontWeight: 'bold' }}>Name:</span>
                            {` ${rsbsaRecord?.firstName || landAttributes.firstName || ''} ${rsbsaRecord?.middleName || landAttributes.middleName || ''} ${rsbsaRecord?.surname || landAttributes.surname || ''}`.trim() || 'N/A'}
                        </div>
                        <div>
                            <span style={{ fontWeight: 'bold' }}>Municipality:</span>
                            {` ${getDisplayMunicipality()}`}
                        </div>
                        <div>
                            <span style={{ fontWeight: 'bold' }}>Barangay:</span>
                            {` ${getDisplayBarangay()}`}
                        </div>
                        <div>
                            <span style={{ fontWeight: 'bold' }}>Gender:</span>
                            {` ${rsbsaRecord?.gender || landAttributes.gender || 'N/A'}`}
                        </div>
                        <div>
                            <span style={{ fontWeight: 'bold' }}>Parcel Area:</span>
                            {` ${getDisplayAreaHectares()}`}
                        </div>
                    </div>
                    {/* Editable plot-specific fields */}
                    {/* Removed Area (sqm) and Plot Source fields as requested */}



                    <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={handleSaveAttributes} disabled={!isEditingAttributes || isSaving} style={{ padding: '0.5rem 2rem', borderRadius: '8px', border: '1px solid #222', background: '#fff', fontWeight: 'bold', cursor: isEditingAttributes && !isSaving ? 'pointer' : 'not-allowed' }}>
                            {isSaving ? 'Saving...' : 'SAVE'}
                        </button>
                    </div>



                    {/* Tenancy/Ownership History Section */}
                    <div className="history-section" style={{ marginTop: '2rem' }}>
                        <h3 style={{ marginBottom: '1rem', fontWeight: 'bold', fontSize: '1.2rem' }}>Ownership & Tenancy History</h3>
                        <table className="history-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #222' }}>
                                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Date Started</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Land Owner</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Parcel Location</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Status</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Date Ended</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentFarmerHistory.length === 0 ? (
                                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No ownership or tenancy history available.</td></tr>
                                ) : currentFarmerHistory.map((entry: any, idx: number) => (
                                    <tr key={entry.id || idx} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '0.5rem' }}>
                                            {entry.period_start_date ? new Date(entry.period_start_date).toLocaleDateString() : 'N/A'}
                                        </td>
                                        <td style={{ padding: '0.5rem' }}>
                                            {entry.land_owner_name || 'N/A'}
                                        </td>
                                        <td style={{ padding: '0.5rem' }}>
                                            {entry.farm_location_barangay ? `${entry.farm_location_barangay}, ${entry.farm_location_municipality || 'Dumangas'}` : 'N/A'}
                                        </td>
                                        <td style={{ padding: '0.5rem' }}>
                                            <span style={{
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '4px',
                                                fontSize: '0.85rem',
                                                backgroundColor: entry.is_registered_owner ? '#4caf50' : entry.is_tenant ? '#ff9800' : entry.is_lessee ? '#2196f3' : '#999',
                                                color: 'white'
                                            }}>
                                                {entry.is_registered_owner ? 'Owner' : entry.is_tenant ? 'Tenant' : entry.is_lessee ? 'Lessee' : 'Other'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.5rem' }}>
                                            {entry.period_end_date ? new Date(entry.period_end_date).toLocaleDateString() : entry.is_current ? 'Current' : 'N/A'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LandPlottingPage; 