import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import '../assets/css/ActiveFarmersPage.css';

interface FarmerFormData {
    firstName: string;
    middleName: string;
    surname: string;
    gender: 'Male' | 'Female';
    barangay: string;
    municipality: string;
    city: string;
    street: string;
    status: 'Tenant' | 'Land Owner' | 'Farmer';
    farmType: 'Irrigated' | 'Rainfed Upland' | 'Rainfed Lowland';
    area: number;
}

const AddFarmerPage: React.FC = () => {
    const navigate = useNavigate();
    const params = useParams();

    const isEditMode = !!params.firstName;

    const [formData, setFormData] = useState<FarmerFormData>({
        firstName: '',
        middleName: '',
        surname: '',
        gender: 'Male',
        barangay: '',
        municipality: 'Dumangas',
        city: 'Iloilo',
        street: '',
        status: 'Farmer',
        farmType: 'Irrigated',
        area: 0
    });
    const [loadingFarmerData, setLoadingFarmerData] = useState(isEditMode);
    const [errorFetchingFarmer, setErrorFetchingFarmer] = useState<string | null>(null);

    useEffect(() => {
        if (isEditMode) {
            const fetchFarmer = async () => {
                try {
                    const { firstName, middleName, surname, area } = params;
                    const encodedMiddleName = middleName ? encodeURIComponent(middleName) : '';
                    const response = await fetch(
                        `http://localhost:5000/api/farmers/${encodeURIComponent(firstName || '')}/${encodedMiddleName}/${encodeURIComponent(surname || '')}/${encodeURIComponent(area || '0')}`
                    );

                    if (!response.ok) throw new Error(`Failed to fetch farmer data: ${response.statusText}`);

                    const data = await response.json();
                    setFormData({
                        firstName: data["FIRST NAME"] || '',
                        middleName: data["MIDDLE NAME"] || '',
                        surname: data["LAST NAME"] || '',
                        gender: data["GENDER"] || 'Male',
                        barangay: data["FARMER ADDRESS 2"] || '',
                        municipality: data["FARMER ADDRESS 3"] ? String(data["FARMER ADDRESS 3"]).split(',')[0]?.trim() || '' : '',
                        city: data["FARMER ADDRESS 3"] ? String(data["FARMER ADDRESS 3"]).split(',')[1]?.trim() || '' : '',
                        street: data["FARMER ADDRESS 1"] || '',
                        status: 'Farmer',
                        farmType: 'Irrigated',
                        area: parseFloat(data["PARCEL AREA"]) || 0
                    });
                } catch (error: any) {
                    console.error('Error fetching farmer for edit:', error);
                    setErrorFetchingFarmer(error.message);
                } finally {
                    setLoadingFarmerData(false);
                }
            };
            fetchFarmer();
        }
    }, [isEditMode, params]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const originalFirstName = params.firstName;
        const originalMiddleName = params.middleName;
        const originalSurname = params.surname;
        const originalArea = params.area;

        try {
            let response;
            if (isEditMode) {
                const encodedOriginalFirstName = encodeURIComponent(originalFirstName || '');
                const encodedOriginalMiddleName = encodeURIComponent(originalMiddleName || '');
                const encodedOriginalSurname = encodeURIComponent(originalSurname || '');
                const encodedOriginalArea = encodeURIComponent(originalArea || '0');

                response = await fetch(
                    `http://localhost:5000/api/farmers/${encodedOriginalFirstName}/${encodedOriginalMiddleName}/${encodedOriginalSurname}/${encodedOriginalArea}`,
                    {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(formData),
                    }
                );
            } else {
                response = await fetch('http://localhost:5000/api/farmers', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData),
                });
            }

            if (response.ok) {
                navigate('/active-farmers');
            } else {
                console.error('Failed to save farmer');
            }
        } catch (error) {
            console.error('Error saving farmer:', error);
        }
    };

    if (loadingFarmerData) return <div>Loading farmer data...</div>;
    if (errorFetchingFarmer) return <div>Error: {errorFetchingFarmer}</div>;

    return (
        <div className="farmers-container">
            <div className="farmers-header">
                <div className="farmers-header-left">
                    <button className="back-button" onClick={() => navigate('/active-farmers')}>←</button>
                    <h1 className="farmers-title">{isEditMode ? 'Edit Farmer' : 'Add New Farmer'}</h1>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="farmer-form">
                <div className="form-section">
                    <h2>Personal Information</h2>
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="firstName">First Name</label>
                            <input
                                type="text"
                                id="firstName"
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="middleName">Middle Name</label>
                            <input
                                type="text"
                                id="middleName"
                                name="middleName"
                                value={formData.middleName}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="surname">Surname</label>
                            <input
                                type="text"
                                id="surname"
                                name="surname"
                                value={formData.surname}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="gender">Gender</label>
                            <select
                                id="gender"
                                name="gender"
                                value={formData.gender}
                                onChange={handleChange}
                                required
                            >
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="status">Status</label>
                            <select
                                id="status"
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                required
                            >
                                <option value="Farmer">Farmer</option>
                                <option value="Tenant">Tenant</option>
                                <option value="Land Owner">Land Owner</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="form-section">
                    <h2>Address Information</h2>
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="street">Street</label>
                            <input
                                type="text"
                                id="street"
                                name="street"
                                value={formData.street}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="barangay">Barangay</label>
                            <input
                                type="text"
                                id="barangay"
                                name="barangay"
                                value={formData.barangay}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="municipality">Municipality</label>
                            <input
                                type="text"
                                id="municipality"
                                name="municipality"
                                value={formData.municipality}
                                readOnly
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="city">City</label>
                            <input
                                type="text"
                                id="city"
                                name="city"
                                value={formData.city}
                                readOnly
                            />
                        </div>
                    </div>
                </div>

                <div className="form-section">
                    <h2>Farm Information</h2>
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="farmType">Farm Type</label>
                            <select
                                id="farmType"
                                name="farmType"
                                value={formData.farmType}
                                onChange={handleChange}
                                required
                            >
                                <option value="Irrigated">Irrigated</option>
                                <option value="Rainfed Upland">Rainfed Upland</option>
                                <option value="Rainfed Lowland">Rainfed Lowland</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="area">Area (hectares)</label>
                            <input
                                type="number"
                                id="area"
                                name="area"
                                value={formData.area}
                                onChange={handleChange}
                                min="0"
                                step="0.01"
                                required
                            />
                        </div>
                    </div>
                </div>

                <div className="form-actions">
                    <button type="button" className="cancel-button" onClick={() => navigate('/active-farmers')}>
                        Cancel
                    </button>
                    <button type="submit" className="submit-button">
                        {isEditMode ? 'Save Changes' : 'Add Farmer'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AddFarmerPage; 