// unchanged imports
import React, { useState, useEffect, useRef } from 'react';
import LandPlottingMap, { LandPlottingMapRef } from '../../components/Map/LandPlottingMap';
import '../../assets/css/LandPlottingPage.css';
import { useNavigate, useParams } from 'react-router-dom';
import '../../assets/css/ActiveFarmersPage.css';

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
        farmType: 'Irrigated'
    });

    const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof LandAttributes, string>>>({});

    const requiredFields: (keyof LandAttributes)[] = [
        'ffrs_id', 'surname', 'firstName', 'gender', 'birthdate',
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
            if (!landAttributes[field]) {
                errors[field] = 'This field is required';
            }
        });

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const saveShapeAttributes = async (shapeToSave: Shape) => {
        if (!validateForm()) {
            alert('Please fill in all required fields');
            return false;
        }

        try {
            const landPlotData = {
                ...landAttributes,
                area: Number(landAttributes.area),
                geometry: shapeToSave.layer.toGeoJSON().geometry,
                id: shapeToSave.id,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const response = await fetch('/api/land-plots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(landPlotData)
            });

            if (!response.ok) throw new Error('Failed to save land plot data');

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

    const handleSaveAttributes = async () => {
        if (selectedShape) {
            try {
                const saveSuccessful = await saveShapeAttributes(selectedShape);
                if (saveSuccessful) {
                    setSelectedShape(null);
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
                        farmType: 'Irrigated'
                    });
                    setIsEditingAttributes(false);
                }
            } catch (error) {
                console.error('Error in handleSaveAttributes:', error);
                alert('Failed to save land plot data. Please try again.');
            }
        }
    };

    const handleShapeCreated = (shape: Shape) => {
        setSelectedShape(shape);
        shape.properties.barangay = barangayName;
        setIsEditingAttributes(true);
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

    const handleShapeEdited = (shape: Shape) => {
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

    const handleShapeDeleted = () => {
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
            farmType: 'Irrigated'
        });
        setSelectedShape(null);
        setIsEditingAttributes(false);
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
                farmType: 'Irrigated'
            });
        }
        setSelectedShape(null);
    };

    const handleBackClick = () => {
        navigate('/land-plotting');
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
                farmType: 'Irrigated'
            });
            setIsEditingAttributes(false);
        }
    }, [selectedShape, barangayName]);

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

    return (
        console.log('Rendering LandPlottingPage, municipality value:', landAttributes.municipality),
        <div className="landplotting-container">
            <div className="landplotting-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button className="back-button" onClick={handleBackClick}>←</button>
                    <h2>Land Plotting Dashboard{barangayName && `: ${barangayName}`}</h2>
                </div>
            </div>

            <div className="landplotting-grid">
                <div className="map-section">
                    <div className="map-header">
                    </div>
                    <div className="map-container">
                        <LandPlottingMap
                            ref={mapRef}
                            selectedShape={selectedShape}
                            onShapeSelected={setSelectedShape}
                            onShapeCreated={handleShapeCreated}
                            onShapeEdited={handleShapeEdited}
                            onShapeDeleted={handleShapeDeleted}
                            barangayName={barangayName}
                            onShapeFinalized={handleShapeFinalized}
                        />
                    </div>
                </div>

                <div className="landplotting-control-panel">
                    <div>
                        {selectedShape && (
                            <>
                                <div className="land-attributes-form">
                                    {isEditingAttributes && (
                                        <>
                                            <h3>Land Attributes</h3>
                                            <div className="form-grid">
                                                <div>
                                                    <label htmlFor="ffrs_id">FFRS ID: *</label>
                                                    <input
                                                        type="text"
                                                        id="ffrs_id"
                                                        name="ffrs_id"
                                                        value={landAttributes.ffrs_id || ''}
                                                        onChange={handleAttributeChange}
                                                        disabled={!isEditingAttributes}
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label htmlFor="surname">Last Name: *</label>
                                                    <input
                                                        type="text"
                                                        id="surname"
                                                        name="surname"
                                                        value={landAttributes.surname || ''}
                                                        onChange={handleAttributeChange}
                                                        disabled={!isEditingAttributes}
                                                        className={validationErrors.surname ? 'error' : ''}
                                                    />
                                                    {validationErrors.surname && <span className="error-message">{validationErrors.surname}</span>}
                                                </div>
                                                <div>
                                                    <label htmlFor="firstName">First Name: *</label>
                                                    <input
                                                        type="text"
                                                        id="firstName"
                                                        name="firstName"
                                                        value={landAttributes.firstName || ''}
                                                        onChange={handleAttributeChange}
                                                        disabled={!isEditingAttributes}
                                                        className={validationErrors.firstName ? 'error' : ''}
                                                    />
                                                    {validationErrors.firstName && <span className="error-message">{validationErrors.firstName}</span>}
                                                </div>
                                                <div>
                                                    <label htmlFor="middleName">Middle Name:</label>
                                                    <input
                                                        type="text"
                                                        id="middleName"
                                                        name="middleName"
                                                        value={landAttributes.middleName || ''}
                                                        onChange={handleAttributeChange}
                                                        disabled={!isEditingAttributes}
                                                    />
                                                </div>
                                                <div>
                                                    <label htmlFor="ext_name">Name Extension:</label>
                                                    <input
                                                        type="text"
                                                        id="ext_name"
                                                        name="ext_name"
                                                        value={landAttributes.ext_name || ''}
                                                        onChange={handleAttributeChange}
                                                        disabled={!isEditingAttributes}
                                                        placeholder="e.g., Jr., Sr., III"
                                                    />
                                                </div>
                                                <div>
                                                    <label htmlFor="gender">Gender: *</label>
                                                    <select
                                                        id="gender"
                                                        name="gender"
                                                        value={landAttributes.gender || ''}
                                                        onChange={handleAttributeChange}
                                                        disabled={!isEditingAttributes}
                                                        required
                                                    >
                                                        <option value="Male">Male</option>
                                                        <option value="Female">Female</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label htmlFor="birthdate">Birthdate: *</label>
                                                    <input
                                                        type="date"
                                                        id="birthdate"
                                                        name="birthdate"
                                                        value={landAttributes.birthdate || ''}
                                                        onChange={handleAttributeChange}
                                                        disabled={!isEditingAttributes}
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label htmlFor="barangay">Barangay: *</label>
                                                    <input
                                                        type="text"
                                                        id="barangay"
                                                        name="barangay"
                                                        value={landAttributes.barangay || ''}
                                                        onChange={handleAttributeChange}
                                                        disabled={!isEditingAttributes}
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label htmlFor="municipality">Municipality: *</label>
                                                    <input
                                                        id="municipality"
                                                        name="municipality"
                                                        type="text"
                                                        value={landAttributes.municipality || ''}
                                                        readOnly
                                                        disabled={!isEditingAttributes}
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label htmlFor="province">Province: *</label>
                                                    <input
                                                        id="province"
                                                        name="province"
                                                        type="text"
                                                        value={landAttributes.province || ''}
                                                        readOnly
                                                        disabled={!isEditingAttributes}
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label htmlFor="parcel_address">Parcel Address: *</label>
                                                    <input
                                                        type="text"
                                                        id="parcel_address"
                                                        name="parcel_address"
                                                        value={landAttributes.parcel_address || ''}
                                                        onChange={handleAttributeChange}
                                                        disabled={!isEditingAttributes}
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label htmlFor="area">Parcel Area: *</label>
                                                    <input
                                                        type="number"
                                                        id="area"
                                                        name="area"
                                                        value={landAttributes.area === 0 ? '' : landAttributes.area}
                                                        onChange={handleAttributeChange}
                                                        disabled={!isEditingAttributes}
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label htmlFor="status">Status: *</label>
                                                    <select
                                                        id="status"
                                                        name="status"
                                                        value={landAttributes.status}
                                                        onChange={handleAttributeChange}
                                                        disabled={!isEditingAttributes}
                                                        required
                                                    >
                                                        <option value="Tenant">Tenant</option>
                                                        <option value="Land Owner">Land Owner</option>
                                                        <option value="Farmer">Farmer</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label htmlFor="farmType">Farm Type: *</label>
                                                    <select
                                                        id="farmType"
                                                        name="farmType"
                                                        value={landAttributes.farmType}
                                                        onChange={handleAttributeChange}
                                                        disabled={!isEditingAttributes}
                                                        required
                                                    >
                                                        <option value="Irrigated">Irrigated</option>
                                                        <option value="Rainfed Upland">Rainfed Upland</option>
                                                        <option value="Rainfed Lowland">Rainfed Lowland</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="form-actions">
                                                <button onClick={handleSaveAttributes} disabled={!isEditingAttributes}>Save</button>
                                                <button onClick={handleCancelEdit} disabled={!isEditingAttributes}>Cancel</button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LandPlottingPage; 