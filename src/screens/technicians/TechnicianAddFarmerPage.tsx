import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../assets/css/ActiveFarmersPage.css';

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

const TechnicianAddFarmerPage: React.FC = () => {
    const navigate = useNavigate();
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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Format data to match /api/farmers expectations (camelCase keys)
            const apiData = {
                firstName: formData.firstName,
                middleName: formData.middleName,
                surname: formData.surname,
                gender: formData.gender,
                barangay: formData.barangay,
                municipality: formData.municipality,
                city: formData.city,
                street: formData.street,
                status: formData.status,
                farmType: formData.farmType,
                area: formData.area,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const response = await fetch('http://localhost:5000/api/farmers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(apiData),
            });

            if (response.ok) {
                navigate('/technician-dashboard');
            } else {
                const errorData = await response.json();
                console.error('Failed to save farmer:', errorData);
                alert('Failed to save farmer. Please check the data and try again.');
            }
        } catch (error: any) {
            if (error.response) {
                error.response.json().then((errData: any) => {
                    console.error('Server error response:', errData);
                    alert('Server error: ' + (errData.message || JSON.stringify(errData)));
                });
            } else {
                console.error('Error saving farmer:', error);
                alert('An error occurred while saving the farmer. Please try again.');
            }
        }
    };

    return (
        <div className="farmers-container">
            <div className="farmers-header">
                <div className="farmers-header-left">
                    <button
                        className="back-button"
                        onClick={() => navigate('/technician-dashboard')}
                    >
                        ←
                    </button>
                    <h1 className="farmers-title">Add New Farmer</h1>
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
                    </div>

                    <div className="form-row">
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
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="city">City</label>
                            <input
                                type="text"
                                id="city"
                                name="city"
                                value={formData.city}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>
                </div>

                <div className="form-section">
                    <h2>Farm Information</h2>
                    <div className="form-row">
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
                    </div>

                    <div className="form-row">
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
                    <button
                        type="button"
                        className="cancel-button"
                        onClick={() => navigate('/technician-dashboard')}
                    >
                        Cancel
                    </button>
                    <button type="submit" className="submit-button">
                        Add Farmer
                    </button>
                </div>
            </form>
        </div>
    );
};

export default TechnicianAddFarmerPage; 