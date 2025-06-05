import React, { useState, useEffect, useRef } from 'react';
import LandPlottingMap, { LandPlottingMapRef } from '../components/Map/LandPlottingMap';
import '../assets/css/LandPlottingPage.css';
import { useNavigate, useParams } from 'react-router-dom';
import '../assets/css/ActiveFarmersPage.css';

interface LandAttributes {
    name: string;
    area: number;
    coordinateAccuracy: 'exact' | 'approximate';
    owner?: string;
    status?: 'owned' | 'leased' | 'tenanted';
    barangay?: string;
}

interface Shape {
    id: string;
    layer: any;
    properties: LandAttributes;
}

const LandPlottingPage: React.FC = () => {
    const navigate = useNavigate();
    const { barangayName } = useParams<{ barangayName: string }>();
    const mapRef = useRef<LandPlottingMapRef>(null);
    const [selectedShape, setSelectedShape] = useState<Shape | null>(null);
    const [landAttributes, setLandAttributes] = useState<LandAttributes>({
        name: '',
        area: 0,
        coordinateAccuracy: 'approximate',
        barangay: barangayName,
    });
    const [isEditingAttributes, setIsEditingAttributes] = useState(false);

    useEffect(() => {
        setLandAttributes(prev => ({
            ...prev,
            barangay: barangayName,
        }));
    }, [barangayName]);

    const handleShapeCreated = (shape: Shape) => {
        setSelectedShape(shape);
        shape.properties.barangay = barangayName;
    };

    const handleShapeEdited = (e: any) => {
        console.log('Shape edited:', e);
    };

    const handleShapeDeleted = (e: any) => {
        setLandAttributes({
            name: '',
            area: 0,
            coordinateAccuracy: 'approximate',
        });
        setSelectedShape(null);
        setIsEditingAttributes(false);
    };

    const handleAttributeChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setLandAttributes(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSaveAttributes = () => {
        if (selectedShape) {
            if (selectedShape.layer.feature) {
                selectedShape.layer.feature.properties = {
                    ...selectedShape.layer.feature.properties,
                    ...landAttributes
                };
            } else {
                selectedShape.layer.feature = {
                    type: 'Feature',
                    properties: landAttributes,
                    geometry: selectedShape.layer.toGeoJSON().geometry,
                };
            }

            console.log('Saved Attributes:', landAttributes);
            alert('Land plot attributes saved!');
            setIsEditingAttributes(false);
            setSelectedShape(null);
        }
    };

    const handleCancelEdit = () => {
        setIsEditingAttributes(false);
        if (selectedShape) {
            setLandAttributes(selectedShape.properties);
        } else {
            setLandAttributes({
                name: '',
                area: 0,
                coordinateAccuracy: 'approximate',
            });
        }
    };

    const handleDeleteSelectedShape = () => {
        if (selectedShape && mapRef.current) {
            mapRef.current.deleteShape(selectedShape.layer);
        }
    };

    const handleBackClick = () => {
        navigate('/land-plotting');
    };

    useEffect(() => {
        if (selectedShape) {
            setLandAttributes(selectedShape.properties);
        } else {
            setLandAttributes({
                name: '',
                area: 0,
                coordinateAccuracy: 'approximate',
            });
        }
        setIsEditingAttributes(false);
    }, [selectedShape]);

    return (
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
                        />
                    </div>
                </div>

                <div className="landplotting-control-panel">
                    <h2>Plotting Controls</h2>
                    <div>
                        <h3>Edit Attributes</h3>
                        <div>
                            <label htmlFor="name">Name:</label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                value={landAttributes.name || ''}
                                onChange={handleAttributeChange}
                                disabled={!selectedShape || !isEditingAttributes}
                            />
                        </div>
                        <div>
                            <label htmlFor="area">Area:</label>
                            <input
                                type="number"
                                id="area"
                                name="area"
                                value={landAttributes.area || 0}
                                onChange={handleAttributeChange}
                                disabled={!selectedShape || !isEditingAttributes}
                            />
                        </div>
                        <div>
                            <label htmlFor="coordinateAccuracy">Coordinate Accuracy:</label>
                            <select
                                id="coordinateAccuracy"
                                name="coordinateAccuracy"
                                value={landAttributes.coordinateAccuracy || 'approximate'}
                                onChange={handleAttributeChange}
                                disabled={!selectedShape || !isEditingAttributes}
                            >
                                <option value="approximate">Approximate</option>
                                <option value="precise">Precise</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="barangay">Barangay:</label>
                            <input
                                type="text"
                                id="barangay"
                                name="barangay"
                                value={landAttributes.barangay || ''}
                                disabled={true}
                            />
                        </div>
                        {!isEditingAttributes ? (
                            <button onClick={() => setIsEditingAttributes(true)} disabled={!selectedShape}>Edit</button>
                        ) : (
                            <>
                                <button onClick={handleSaveAttributes}>Save</button>
                                <button onClick={handleCancelEdit}>Cancel</button>
                            </>
                        )}
                        <button
                            onClick={handleDeleteSelectedShape}
                            disabled={!selectedShape}
                            style={{ backgroundColor: '#d9534f', color: 'white', marginTop: '10px' }}
                        >
                            Delete Selected Polygon
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LandPlottingPage; 