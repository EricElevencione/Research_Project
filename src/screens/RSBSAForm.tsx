import React, { useState } from 'react';
import '../assets/css/RSBSAForm.css';

const RSBSAForm = () => {
    const [form, setForm] = useState({
        surname: '',
        firstName: '',
        middleName: '',
        extensionName: '',
        sex: '',
        address: '',
        barangay: '',
        municipality: '',
        province: '',
        region: '',
        mobile: '',
        landline: '',
        birthDate: '',
        birthPlace: '',
        religion: '',
        civilStatus: '',
        spouse: '',
        motherName: '',
        isHead: '',
        headName: '',
        relationship: '',
        maleMembers: '',
        femaleMembers: '',
        education: '',
        pwd: '',
        is4ps: '',
        indigenous: '',
        govID: '',
        govIDType: '',
        govIDNumber: '',
        associationMember: '',
        associationName: '',
        emergencyContact: '',
        emergencyNumber: '',
        mainLivelihood: '',
        // Add more fields as needed...
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log(form);
        // send form data to API/backend here
    };

    return (
        <div className="page-container">
            <form className="rsbsa-form" onSubmit={handleSubmit}>
                <h2>RSBSA ENROLLMENT FORM</h2>

                {/* PART I: PERSONAL INFORMATION */}
                <fieldset>
                    <legend>Personal Information</legend>

                    <div className="form-row">
                        <input name="surname" value={form.surname} onChange={handleChange} placeholder="Surname" required />
                        <input name="firstName" value={form.firstName} onChange={handleChange} placeholder="First Name" required />
                        <input name="middleName" value={form.middleName} onChange={handleChange} placeholder="Middle Name" />
                        <input name="extensionName" value={form.extensionName} onChange={handleChange} placeholder="Extension Name" />
                    </div>

                    <div className="form-row">
                        <label>
                            <input type="radio" name="sex" value="Male" onChange={handleChange} /> Male
                        </label>
                        <label>
                            <input type="radio" name="sex" value="Female" onChange={handleChange} /> Female
                        </label>
                    </div>

                    <div className="form-row">
                        <input name="address" value={form.address} onChange={handleChange} placeholder="House No. / Street / Sitio" />
                        <input name="barangay" value={form.barangay} onChange={handleChange} placeholder="Barangay" />
                        <input name="municipality" value={form.municipality} onChange={handleChange} placeholder="Municipality/City" />
                        <input name="province" value={form.province} onChange={handleChange} placeholder="Province" />
                        <input name="region" value={form.region} onChange={handleChange} placeholder="Region" />
                    </div>

                    <div className="form-row">
                        <input type="date" name="birthDate" value={form.birthDate} onChange={handleChange} />
                        <input name="birthPlace" value={form.birthPlace} onChange={handleChange} placeholder="Place of Birth" />
                    </div>

                    {/* Continue the rest of fields similarly... */}
                </fieldset>

                {/* PART II: FARM PROFILE */}
                <fieldset>
                    <legend>Farm Profile</legend>
                    <div className="form-row">
                        <label>
                            <input type="radio" name="mainLivelihood" value="Farmer" onChange={handleChange} /> Farmer
                        </label>
                        <label>
                            <input type="radio" name="mainLivelihood" value="Farmworker" onChange={handleChange} /> Farmworker/Laborer
                        </label>
                        <label>
                            <input type="radio" name="mainLivelihood" value="Fisherfolk" onChange={handleChange} /> Fisherfolk
                        </label>
                        <label>
                            <input type="radio" name="mainLivelihood" value="AgriYouth" onChange={handleChange} /> Agri Youth
                        </label>
                    </div>

                    {/* Add farming activity fields, livestock, poultry, etc. */}
                </fieldset>

                <button type="submit">Submit</button>
            </form>
        </div>
    );
};

export default RSBSAForm;
