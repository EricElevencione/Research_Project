import '../../assets/css/RSBSAForm.css';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

type ReferenceNumber = {
    region: string;
    province: string;
    cityMuni: string;
    barangay: string;
};

type Address = {
    houseNo: string;
    street: string;
    barangay: string;
    municipality: string;
    province: string;
    region: string;
};

type EmergencyContact = {
    name: string;
    contactNumber: string;
};

type FarmingActivities = {
    rice: boolean;
    corn: boolean;
    otherCrops: boolean;
    otherCropsSpecify: string;
    livestock: boolean;
    livestockSpecify: string;
    poultry: boolean;
    poultrySpecify: string;
};

type FarmworkerActivities = {
    landPreparation: boolean;
    planting: boolean;
    cultivation: boolean;
    harvesting: boolean;
    others: boolean;
    othersSpecify: string;
};

type FisherfolkActivities = {
    fishCapture: boolean;
    aquaculture: boolean;
    gleaning: boolean;
    fishProcessing: boolean;
    fishVending: boolean;
    others: boolean;
    othersSpecify: string;
};

type AgriYouthActivities = {
    farmingHousehold: boolean;
    formalCourse: boolean;
    nonFormalCourse: boolean;
    participated: boolean;
    others: boolean;
    othersSpecify: string;
};

type GrossAnnualIncome = {
    farming: string;
    nonFarming: string;
};

type FarmersInRotation = {
    p1: string;
    p2: string;
    p3: string;
};

type FarmLocation = {
    barangay: string;
    cityMunicipality: string;
};

type OwnershipType = {
    registeredOwner: boolean;
    tenant: boolean;
    tenantLandOwner: string;
    lessee: boolean;
    lesseeLandOwner: string;
    others: boolean;
    othersSpecify: string;
};

type FarmParcel = {
    parcelNumber: number;
    farmLocation: FarmLocation;
    totalFarmArea: string;
    withinAncestralDomain: string;
    agrarianReformBeneficiary: string;
    ownershipDocumentNo: string;
    ownershipType: OwnershipType;
    cropCommodity: string;
    size: string;
    numberOfHead: string;
    farmType: string;
    organicPractitioner: string;
    remarks: string;
};

type FormData = {
    dateAdministered: string;
    referenceNumber: ReferenceNumber;
    surname: string;
    firstName: string;
    middleName: string;
    extensionName: string;
    sex: string;
    address: Address;
    mobileNumber: string;
    landlineNumber: string;
    dateOfBirth: string;
    placeOfBirth: string;
    religion: string;
    otherReligion: string;
    civilStatus: string;
    nameOfSpouse: string;
    motherMaidenName: string;
    householdHead: string;
    householdHeadName: string;
    householdHeadRelationship: string;
    maleHouseholdMembers: number;
    femaleHouseholdMembers: number;
    highestFormalEducation: string;
    pwd: string;
    psBeneficiary: string;
    indigenousGroup: string;
    indigenousGroupSpecify: string;
    governmentId: string;
    idType: string;
    idNumber: string;
    farmerAssociation: string;
    farmerAssociationSpecify: string;
    emergencyContact: EmergencyContact;
    mainLivelihood: string;
    farmingActivities: FarmingActivities;
    farmworkerActivities: FarmworkerActivities;
    fisherfolkActivities: FisherfolkActivities;
    agriYouthActivities: AgriYouthActivities;
    grossAnnualIncome: GrossAnnualIncome;
    numberOfFarmParcels: string;
    farmersInRotation: FarmersInRotation;
    farmParcels: FarmParcel[];
};

type Errors = {
    [key: string]: string;
};

const RSBSAFormPage = () => {
    const navigate = useNavigate();
    const [barangayNames, setBarangayNames] = useState<string[]>([]);

    // Fetch barangay names from the map data
    useEffect(() => {
        const fetchBarangayNames = async () => {
            try {
                const response = await fetch('/Dumangas_map.json');
                const data = await response.json();
                const names = data.features.map((feature: any) => feature.properties.NAME_3).sort();
                setBarangayNames(names);
            } catch (error) {
                console.error('Error fetching barangay data:', error);
            }
        };

        fetchBarangayNames();
    }, []);

    // Helper function to format names (first letter uppercase, rest lowercase)
    const formatFullName = (name: string) => {
        if (!name) return "";   
        return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    };

    // Form state
    const [formData, setFormData] = useState<FormData>({
        // Enrollment Information
        dateAdministered: '',
        referenceNumber: {
            region: '',
            province: '',
            cityMuni: '',
            barangay: ''
        },

        // Personal Information
        surname: '',
        firstName: '',
        middleName: '',
        extensionName: '',
        sex: '',
        address: {
            houseNo: '',
            street: '',
            barangay: '',
            municipality: 'Dumangas', // Fixed value
            province: 'Iloilo',       // Fixed value
            region: 'VI'              // Fixed value
        },
        mobileNumber: '',
        landlineNumber: '',
        dateOfBirth: '',
        placeOfBirth: '',
        religion: '',
        otherReligion: '',
        civilStatus: '',
        nameOfSpouse: '',
        motherMaidenName: '',
        householdHead: '',
        householdHeadName: '',
        householdHeadRelationship: '',
        maleHouseholdMembers: 0,
        femaleHouseholdMembers: 0,
        highestFormalEducation: '',
        pwd: '',
        psBeneficiary: '',
        indigenousGroup: '',
        indigenousGroupSpecify: '',
        governmentId: '',
        idType: '',
        idNumber: '',
        farmerAssociation: '',
        farmerAssociationSpecify: '',
        emergencyContact: {
            name: '',
            contactNumber: ''
        },

        // Farm Profile
        mainLivelihood: '',
        farmingActivities: {
            rice: false,
            corn: false,
            otherCrops: false,
            otherCropsSpecify: '',
            livestock: false,
            livestockSpecify: '',
            poultry: false,
            poultrySpecify: ''
        },
        farmworkerActivities: {
            landPreparation: false,
            planting: false,
            cultivation: false,
            harvesting: false,
            others: false,
            othersSpecify: ''
        },
        fisherfolkActivities: {
            fishCapture: false,
            aquaculture: false,
            gleaning: false,
            fishProcessing: false,
            fishVending: false,
            others: false,
            othersSpecify: ''
        },
        agriYouthActivities: {
            farmingHousehold: false,
            formalCourse: false,
            nonFormalCourse: false,
            participated: false,
            others: false,
            othersSpecify: ''
        },
        grossAnnualIncome: {
            farming: '',
            nonFarming: ''
        },

        // Farm Parcel Details
        numberOfFarmParcels: '',
        farmersInRotation: {
            p1: '',
            p2: '',
            p3: ''
        },
        farmParcels: [{
            parcelNumber: 1,
            farmLocation: {
                barangay: '',
                cityMunicipality: ''
            },
            totalFarmArea: '',
            withinAncestralDomain: '',
            agrarianReformBeneficiary: '',
            ownershipDocumentNo: '',
            ownershipType: {
                registeredOwner: false,
                tenant: false,
                tenantLandOwner: '',
                lessee: false,
                lesseeLandOwner: '',
                others: false,
                othersSpecify: ''
            },
            cropCommodity: '',
            size: '',
            numberOfHead: '',
            farmType: '',
            organicPractitioner: '',
            remarks: ''
        }]
    });

    const [errors, setErrors] = useState<Errors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Handle input changes
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;

        // Handle deep nested fields like farmParcels[0].farmLocation.barangay
        const arrayFieldMatch = name.match(/^(\w+)\[(\d+)\]\.(\w+)\.(\w+)$/);
        if (arrayFieldMatch) {
            const [, arrayName, index, objectName, property] = arrayFieldMatch;
            setFormData(prev => {
                const newArray = [...(prev as any)[arrayName]];
                newArray[parseInt(index)] = {
                    ...newArray[parseInt(index)],
                    [objectName]: {
                        ...newArray[parseInt(index)][objectName],
                        [property]: type === 'checkbox' ? checked : value
                    }
                };
                return {
                    ...prev,
                    [arrayName]: newArray
                };
            });
            return;
        }

        // Existing logic for array fields (e.g., farmParcels[0].size)
        const match = name.match(/^(\w+)\[(\d+)\]\.(\w+)$/);
        if (match) {
            const [, arrayName, index, property] = match;
            setFormData(prev => {
                const newArray = [...(prev as any)[arrayName]];
                newArray[parseInt(index)] = {
                    ...newArray[parseInt(index)],
                    [property]: type === 'checkbox' ? checked : value
                };
                return {
                    ...prev,
                    [arrayName]: newArray
                };
            });
            return;
        }

        // Existing logic for nested objects (e.g., address.barangay)
        if (name.includes('.')) {
            const [parent, child] = name.split('.');
            setFormData(prev => ({
                ...prev,
                [parent]: {
                    ...(prev as any)[parent],
                    [child]: type === 'checkbox' ? checked : value
                }
            }));
            return;
        }

        // Regular fields
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    // Handle radio button changes
    const handleRadioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Handle checkbox group changes
    const handleCheckboxGroupChange = (e: React.ChangeEvent<HTMLInputElement>, groupName: keyof FormData) => {
        const { name, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [groupName]: {
                ...(prev[groupName] as Record<string, any>),
                [name]: checked
            }
        }));
    };

    // Handle select changes
    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;

        // Handle deep nested fields like farmParcels[0].farmLocation.barangay
        const arrayFieldMatch = name.match(/^(\w+)\[(\d+)\]\.(\w+)\.(\w+)$/);
        if (arrayFieldMatch) {
            const [, arrayName, index, objectName, property] = arrayFieldMatch;
            setFormData(prev => {
                const newArray = [...(prev as any)[arrayName]];
                newArray[parseInt(index)] = {
                    ...newArray[parseInt(index)],
                    [objectName]: {
                        ...newArray[parseInt(index)][objectName],
                        [property]: value
                    }
                };
                return {
                    ...prev,
                    [arrayName]: newArray
                };
            });
            return;
        }

        // Existing logic for nested objects (e.g., address.barangay)
        if (name.includes('.')) {
            const [parent, child] = name.split('.');
            setFormData(prev => ({
                ...prev,
                [parent]: {
                    ...(prev as any)[parent],
                    [child]: value
                }
            }));
            return;
        }

        // Regular fields
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Add a new farm parcel
    const addFarmParcel = () => {
        setFormData(prev => ({
            ...prev,
            farmParcels: [
                ...prev.farmParcels,
                {
                    parcelNumber: prev.farmParcels.length + 1,
                    farmLocation: {
                        barangay: '',
                        cityMunicipality: ''
                    },
                    totalFarmArea: '',
                    withinAncestralDomain: '',
                    agrarianReformBeneficiary: '',
                    ownershipDocumentNo: '',
                    ownershipType: {
                        registeredOwner: false,
                        tenant: false,
                        tenantLandOwner: '',
                        lessee: false,
                        lesseeLandOwner: '',
                        others: false,
                        othersSpecify: ''
                    },
                    cropCommodity: '',
                    size: '',
                    numberOfHead: '',
                    farmType: '',
                    organicPractitioner: '',
                    remarks: ''
                }
            ]
        }));
    };

    // Remove a farm parcel
    const removeFarmParcel = (index: number) => {
        if (formData.farmParcels.length > 1) {
            setFormData(prev => ({
                ...prev,
                farmParcels: prev.farmParcels.filter((_, i) => i !== index)
            }));
        }
    };

    // Validate form
    const validateForm = () => {
        const newErrors: Errors = {};

        // Only require these fields for now
        if (!formData.dateAdministered) newErrors.dateAdministered = 'Required';
        if (!formData.surname) newErrors.surname = 'Required';
        if (!formData.middleName) newErrors.middleName = 'Required';
        if (!formData.firstName) newErrors.firstName = 'Required';
        if (!formData.address.barangay) newErrors['address.barangay'] = 'Required';
        if (!formData.address.municipality) newErrors['address.municipality'] = 'Required';
        if (!formData.mobileNumber) {
            newErrors.mobileNumber = 'Required';
          } else if (!/^09\d{9}$/.test(formData.mobileNumber)) {
            newErrors.mobileNumber = 'Must be 11 digits and start with 09';
          }
        if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Required';

        // Validate at least one farm parcel has required fields
        let hasValidParcel = false;
        let ownershipTypeValid = false;
        formData.farmParcels.forEach((parcel) => {
            // Require farmLocation.barangay, farmLocation.cityMunicipality, totalFarmArea
            const hasFields = parcel.farmLocation.barangay && parcel.farmLocation.cityMunicipality && parcel.totalFarmArea;
            // Require at least one ownership type
            const ownership = parcel.ownershipType;
            const hasOwnership = ownership.registeredOwner || ownership.tenant || ownership.lessee || ownership.others;
            if (hasFields) {
                hasValidParcel = true;
                if (!hasOwnership) {
                    ownershipTypeValid = false;
                    newErrors[`farmParcels.ownershipType.${parcel.parcelNumber}`] = 'Select at least one ownership type';
                } else {
                    ownershipTypeValid = true;
                }
            }
        });
        if (!hasValidParcel) newErrors.farmParcels = 'At least one valid farm parcel required';
        if (!ownershipTypeValid) newErrors.ownershipType = 'Select at least one ownership type for a valid parcel';

        // Debug: Log validation errors
        if (Object.keys(newErrors).length > 0) {
            console.log('Validation errors:', newErrors);
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Submit clicked');

        if (!validateForm()) {
            console.log('Validation failed');
            return;
        }
        console.log('Validation passed');

        setIsSubmitting(true);

        try {
            // Transform data to match backend structure
            const submissionData = {
                // Personal Information - using the exact field names the backend expects
                surname: formatFullName(formData.surname),
                firstName: formatFullName(formData.firstName),
                middleName: formatFullName(formData.middleName),
                extensionName: formatFullName(formData.extensionName),
                sex: formData.sex,
                dateOfBirth: formData.dateOfBirth,
                address: {
                    houseNo: formData.address.houseNo,
                    street: formData.address.street,
                    barangay: formData.address.barangay,
                    municipality: formData.address.municipality,
                    province: formData.address.province,
                    region: formData.address.region
                },

                // Farm Information (using first parcel as primary)
                parcelNumber: formData.farmParcels[0].parcelNumber,
                parcelAddress: `${formData.farmParcels[0].farmLocation.barangay}, ${formData.farmParcels[0].farmLocation.cityMunicipality}`,
                parcelArea: formData.farmParcels[0].size,

                // Additional fields for backend processing
                dateAdministered: formData.dateAdministered,
                referenceNumber: formData.referenceNumber,
                mobileNumber: formData.mobileNumber,
                landlineNumber: formData.landlineNumber,
                placeOfBirth: formData.placeOfBirth,
                religion: formData.religion,
                civilStatus: formData.civilStatus,
                nameOfSpouse: formatFullName(formData.nameOfSpouse),
                motherMaidenName: formatFullName(formData.motherMaidenName),
                householdHead: formData.householdHead,
                householdHeadName: formatFullName(formData.householdHeadName),
                householdHeadRelationship: formData.householdHeadRelationship,
                highestFormalEducation: formData.highestFormalEducation,
                pwd: formData.pwd,
                psBeneficiary: formData.psBeneficiary,
                indigenousGroup: formData.indigenousGroup,
                governmentId: formData.governmentId,
                farmerAssociation: formatFullName(formData.farmerAssociation),
                emergencyContact: {
                    name: formatFullName(formData.emergencyContact.name),
                    contactNumber: formData.emergencyContact.contactNumber
                },
                mainLivelihood: formData.mainLivelihood,
                farmingActivities: formData.farmingActivities,
                farmworkerActivities: formData.farmworkerActivities,
                fisherfolkActivities: formData.fisherfolkActivities,
                agriYouthActivities: formData.agriYouthActivities,
                grossAnnualIncome: formData.grossAnnualIncome,
                numberOfFarmParcels: formData.numberOfFarmParcels,
                farmersInRotation: {
                    p1: formatFullName(formData.farmersInRotation.p1),
                    p2: formatFullName(formData.farmersInRotation.p2),
                    p3: formatFullName(formData.farmersInRotation.p3)
                },
                farmParcels: formData.farmParcels
            };

            // Send data to backend
            const response = await axios.post('http://localhost:5000/api/RSBSAform', submissionData);

            if (response.status === 201) {
                window.alert('RSBSA form saved successfully!');
                navigate('/technician-rsbsa');
                return;
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            const err = error as any;
            let errorMsg = 'Failed to submit form. Please try again.';
            if (err.response && err.response.data && err.response.data.message) {
                errorMsg = err.response.data.message;
            } else if (err.message) {
                errorMsg = err.message;
            }
            setErrors({
                submit: errorMsg
            });
            window.alert(errorMsg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="rsbsa-form-scrollable">
            <button className="back-button" style={{ margin: '16px' }} onClick={() => navigate('/technician-rsbsa')}>← </button>
            <form className="rsbsa-form" onSubmit={handleSubmit}>
                <h2>ANI AT KITA - RSBSA ENROLLMENT FORM</h2>

                {/* ENROLLMENT DATE */}
                <section className="form-section">
                    <div className="left-column">
                        <div className="enrollment-date-row">
                            <div className="date-administered">
                                <label>Date Administered:</label>
                                <input
                                    type="date"
                                    name="dateAdministered"
                                    value={formData.dateAdministered}
                                    onChange={handleChange}
                                />
                                {errors.dateAdministered && <span className="error">{errors.dateAdministered}</span>}
                            </div>
                        </div>

                        <div className="reference-number-row">
                            <label>Reference Number:</label>
                            <div className="reference-number-fields">
                                <input
                                    type="text"
                                    placeholder="Region"
                                    name="referenceNumber.region"
                                    value={formData.referenceNumber.region}
                                    onChange={handleChange}
                                />
                                <span>-</span>
                                <input
                                    type="text"
                                    placeholder="Province"
                                    name="referenceNumber.province"
                                    value={formData.referenceNumber.province}
                                    onChange={handleChange}
                                />
                                <span>-</span>
                                <input
                                    type="text"
                                    placeholder="City/Muni"
                                    name="referenceNumber.cityMuni"
                                    value={formData.referenceNumber.cityMuni}
                                    onChange={handleChange}
                                />
                                <span>-</span>
                                <select
                                    name="referenceNumber.barangay"
                                    value={formData.referenceNumber.barangay}
                                    onChange={handleSelectChange}
                                >
                                    <option value="">Select Barangay</option>
                                    {barangayNames.map((barangay, index) => (
                                        <option key={index} value={barangay}>
                                            {barangay}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                </section>

                {/* PART I: PERSONAL INFORMATION */}
                <fieldset>
                    <legend>Part I: Personal Information</legend>

                    <div className="form-row name-row">
                        <span className="inline-label">Surname:</span>
                        <input
                            type="text"
                            name="surname"
                            value={formData.surname}
                            onChange={handleChange}
                        />
                        {errors.surname && <span className="error">{errors.surname}</span>}
                        <span className="inline-label">First Name:</span>
                        <input
                            type="text"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleChange}
                        />
                        {errors.firstName && <span className="error">{errors.firstName}</span>}
                    </div>

                    <div className="form-row name-row">
                        <span className="inline-label">Middle Name:</span>
                        <input
                            type="text"
                            name="middleName"
                            value={formData.middleName}
                            onChange={handleChange}
                        />
                        <span className="inline-label">Extension Name:</span>
                        <input
                            type="text"
                            name="extensionName"
                            value={formData.extensionName}
                            onChange={handleChange}
                        />
                    </div>

                    <hr className="form-separator" />

                    <div className="form-row sex-row">
                        <label>Sex:</label>
                        <label>
                            <input
                                type="radio"
                                name="sex"
                                value="Male"
                                checked={formData.sex === 'Male'}
                                onChange={handleRadioChange}
                            /> Male
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="sex"
                                value="Female"
                                checked={formData.sex === 'Female'}
                                onChange={handleRadioChange}
                            /> Female
                        </label>
                        {errors.sex && <span className="error">{errors.sex}</span>}
                    </div>

                    <hr className="form-separator" />

                    <div className="form-row address-row">
                        <div className="form-row">
                            <label className="address-label">Address:</label>
                        </div>

                        <div className="address-row">
                            <input
                                type="text"
                                placeholder="House/Lot/Bldg No./Purok"
                                name="address.houseNo"
                                value={formData.address.houseNo}
                                onChange={handleChange}
                            />
                            <input
                                type="text"
                                placeholder="Street/Sitio/Subdv."
                                name="address.street"
                                value={formData.address.street}
                                onChange={handleChange}
                            />
                            <select
                                name="address.barangay"
                                value={formData.address.barangay}
                                onChange={handleSelectChange}
                            >
                                <option value="">Select Barangay</option>
                                {barangayNames.map((barangay, index) => (
                                    <option key={index} value={barangay}>
                                        {barangay}
                                    </option>
                                ))}
                            </select>
                            {errors['address.barangay'] && <span className="error">{errors['address.barangay']}</span>}
                            <input
                                type="text"
                                placeholder="Municipality/City"
                                name="address.municipality"
                                value={formData.address.municipality}
                                readOnly
                            // onChange={handleChange} // Remove onChange for fixed field
                            />
                            {errors['address.municipality'] && <span className="error">{errors['address.municipality']}</span>}
                            <input
                                type="text"
                                placeholder="Province"
                                name="address.province"
                                value={formData.address.province}
                                readOnly
                            // onChange={handleChange} // Remove onChange for fixed field
                            />
                            {errors['address.province'] && <span className="error">{errors['address.province']}</span>}
                            <input
                                type="text"
                                placeholder="Region"
                                name="address.region"
                                value={formData.address.region}
                                readOnly
                            // onChange={handleChange} // Remove onChange for fixed field
                            />
                        </div>
                    </div>

                    <hr className="form-separator" />

                    <div className="form-row number-row">
                        <span className="inline-label">Mobile Number:</span>
                        <input
                            type="text"
                            name="mobileNumber"
                            value={formData.mobileNumber}
                            onChange={handleChange}
                        />
                        <span className="inline-label">Landline Number:</span>
                        <input
                            type="text"
                            name="landlineNumber"
                            value={formData.landlineNumber}
                            onChange={handleChange}
                        />
                    </div>

                    <hr className="form-separator" />

                    <div className="form-row birth-row">
                        <span className="inline-label">Date of Birth:</span>
                        <input
                            type="date"
                            name="dateOfBirth"
                            value={formData.dateOfBirth}
                            onChange={handleChange}
                        />
                        {errors.dateOfBirth && <span className="error">{errors.dateOfBirth}</span>}
                        <span className="inline-label">Place of Birth:</span>
                        <input
                            type="text"
                            name="placeOfBirth"
                            value={formData.placeOfBirth}
                            onChange={handleChange}
                        />
                    </div>

                    <hr className="form-separator" />

                    <div className="form-row religion-row">
                        <label>Religion:</label>
                        <label>
                            <input
                                type="radio"
                                name="religion"
                                value="Roman Catholic"
                                checked={formData.religion === 'Roman Catholic'}
                                onChange={handleRadioChange}
                            /> Roman Catholic
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="religion"
                                value="Islam"
                                checked={formData.religion === 'Islam'}
                                onChange={handleRadioChange}
                            /> Islam
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="religion"
                                value="Others"
                                checked={formData.religion === 'Others'}
                                onChange={handleRadioChange}
                            />
                            <span className="inline-label">Others, specify </span>
                        </label>
                        <input
                            type="text"
                            name="otherReligion"
                            value={formData.otherReligion}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="form-row civil_status-row">
                        <label>Civil Status:</label>
                        <label>
                            <input
                                type="radio"
                                name="civilStatus"
                                value="Single"
                                checked={formData.civilStatus === 'Single'}
                                onChange={handleRadioChange}
                            /> Single
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="civilStatus"
                                value="Married"
                                checked={formData.civilStatus === 'Married'}
                                onChange={handleRadioChange}
                            /> Married
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="civilStatus"
                                value="Widowed"
                                checked={formData.civilStatus === 'Widowed'}
                                onChange={handleRadioChange}
                            /> Widowed
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="civilStatus"
                                value="Separated"
                                checked={formData.civilStatus === 'Separated'}
                                onChange={handleRadioChange}
                            /> Separated
                        </label>
                    </div>

                    {formData.civilStatus === 'Married' && (
                        <div className="form-row name_of_spouse-row">
                            <span className="inline-label">Name of Spouse if Married:</span>
                            <input
                                type="text"
                                name="nameOfSpouse"
                                value={formData.nameOfSpouse}
                                onChange={handleChange}
                            />
                        </div>
                    )}

                    <hr className="form-separator" />

                    <div className="form-row mother_maiden_name-row">
                        <span className="inline-label">Mother's Maiden Name:</span>
                        <input
                            type="text"
                            name="motherMaidenName"
                            value={formData.motherMaidenName}
                            onChange={handleChange}
                        />
                    </div>

                    <hr className="form-separator" />

                    <div className="form-row household-row">
                        <label>Household Head:</label>
                        <label>
                            <input
                                type="radio"
                                name="householdHead"
                                value="Yes"
                                checked={formData.householdHead === 'Yes'}
                                onChange={handleRadioChange}
                            /> Yes
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="householdHead"
                                value="No"
                                checked={formData.householdHead === 'No'}
                                onChange={handleRadioChange}
                            /> No
                        </label>
                    </div>

                    {formData.householdHead === 'No' && (
                        <div className="form-row household_head_relationship-row">
                            <span className="inline-label">If no, name of household head:</span>
                            <input
                                type="text"
                                name="householdHeadName"
                                value={formData.householdHeadName}
                                onChange={handleChange}
                            />
                            <span className="inline-label">Relationship:</span>
                            <input
                                type="text"
                                name="householdHeadRelationship"
                                value={formData.householdHeadRelationship}
                                onChange={handleChange}
                            />
                        </div>
                    )}

                    <div className="form-row number_of_male_female_household_member-row">
                        <span className="inline-label">Number of male household members:</span>
                        <input
                            type="number"
                            name="maleHouseholdMembers"
                            value={formData.maleHouseholdMembers}
                            onChange={handleChange}
                        />
                        <span className="inline-label">Number of female household members:</span>
                        <input
                            type="number"
                            name="femaleHouseholdMembers"
                            value={formData.femaleHouseholdMembers}
                            onChange={handleChange}
                        />
                    </div>

                    <hr className="form-separator" />

                    <div className="form-row">
                        <label className="highest_formal_education-label">Highest Formal Education:</label>
                    </div>

                    <div className="form-row highest_formal_education-grid">
                        <label>
                            <input
                                type="radio"
                                name="highestFormalEducation"
                                value="Pre-School"
                                checked={formData.highestFormalEducation === 'Pre-School'}
                                onChange={handleRadioChange}
                            />
                            <span className="inline-label"> Pre-School </span>
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="highestFormalEducation"
                                value="Elementary"
                                checked={formData.highestFormalEducation === 'Elementary'}
                                onChange={handleRadioChange}
                            />
                            <span className="inline-label"> Elementary </span>
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="highestFormalEducation"
                                value="High School (non K-12)"
                                checked={formData.highestFormalEducation === 'High School (non K-12)'}
                                onChange={handleRadioChange}
                            />
                            <span className="inline-label"> High School (non K-12) </span>
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="highestFormalEducation"
                                value="Junior High School (non K-12)"
                                checked={formData.highestFormalEducation === 'Junior High School (non K-12)'}
                                onChange={handleRadioChange}
                            />
                            <span className="inline-label"> Junior High School (non K-12) </span>
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="highestFormalEducation"
                                value="Senior High School (non K-12)"
                                checked={formData.highestFormalEducation === 'Senior High School (non K-12)'}
                                onChange={handleRadioChange}
                            />
                            <span className="inline-label"> Senior High School (non K-12) </span>
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="highestFormalEducation"
                                value="College"
                                checked={formData.highestFormalEducation === 'College'}
                                onChange={handleRadioChange}
                            />
                            <span className="inline-label"> College </span>
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="highestFormalEducation"
                                value="Vocational"
                                checked={formData.highestFormalEducation === 'Vocational'}
                                onChange={handleRadioChange}
                            />
                            <span className="inline-label"> Vocational </span>
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="highestFormalEducation"
                                value="Post-graduate"
                                checked={formData.highestFormalEducation === 'Post-graduate'}
                                onChange={handleRadioChange}
                            />
                            <span className="inline-label"> Post-graduate </span>
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="highestFormalEducation"
                                value="None"
                                checked={formData.highestFormalEducation === 'None'}
                                onChange={handleRadioChange}
                            />
                            <span className="inline-label"> None </span>
                        </label>
                    </div>

                    <hr className="form-separator" />

                    <div className="form-row pwd-row">
                        <label>Person with Disability (PWD):</label>
                        <label>
                            <input
                                type="radio"
                                name="pwd"
                                value="Yes"
                                checked={formData.pwd === 'Yes'}
                                onChange={handleRadioChange}
                            /> Yes
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="pwd"
                                value="No"
                                checked={formData.pwd === 'No'}
                                onChange={handleRadioChange}
                            /> No
                        </label>
                    </div>

                    <hr className="form-separator" />

                    <div className="form-row ps_beneficiary-row">
                        <label>4P's Beneficiary?</label>
                        <label>
                            <input
                                type="radio"
                                name="psBeneficiary"
                                value="Yes"
                                checked={formData.psBeneficiary === 'Yes'}
                                onChange={handleRadioChange}
                            /> Yes
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="psBeneficiary"
                                value="No"
                                checked={formData.psBeneficiary === 'No'}
                                onChange={handleRadioChange}
                            /> No
                        </label>
                    </div>

                    <div className="form-row indigenous_group-row">
                        <label>Member of an Indigenous Group?</label>
                        <label>
                            <input
                                type="radio"
                                name="indigenousGroup"
                                value="Yes"
                                checked={formData.indigenousGroup === 'Yes'}
                                onChange={handleRadioChange}
                            /> Yes
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="indigenousGroup"
                                value="No"
                                checked={formData.indigenousGroup === 'No'}
                                onChange={handleRadioChange}
                            /> No
                        </label>
                    </div>
                    {formData.indigenousGroup === 'Yes' && (
                        <div className="form-row specify-row">
                            <span className="inline-label">If yes, specify: </span>
                            <input
                                type="text"
                                name="indigenousGroupSpecify"
                                value={formData.indigenousGroupSpecify}
                                onChange={handleChange}
                            />
                        </div>
                    )}

                    <hr className="form-separator" />

                    <div className="form-row government_id-row">
                        <label>With Government ID?</label>
                        <label>
                            <input
                                type="radio"
                                name="governmentId"
                                value="Yes"
                                checked={formData.governmentId === 'Yes'}
                                onChange={handleRadioChange}
                            /> Yes
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="governmentId"
                                value="No"
                                checked={formData.governmentId === 'No'}
                                onChange={handleRadioChange}
                            /> No
                        </label>
                    </div>

                    {formData.governmentId === 'Yes' && (
                        <div className="form-row id_type-row">
                            <span className="inline-label">If yes, specify ID Type: </span>
                            <input
                                type="text"
                                name="idType"
                                value={formData.idType}
                                onChange={handleChange}
                            />
                            <span className="inline-label">ID Number: </span>
                            <input
                                type="text"
                                name="idNumber"
                                value={formData.idNumber}
                                onChange={handleChange}
                            />
                        </div>
                    )}

                    <hr className="form-separator" />

                    <div className="form-row farmer_association-row">
                        <label>Member of any Farmers Association/Cooperative?</label>
                        <label>
                            <input
                                type="radio"
                                name="farmerAssociation"
                                value="Yes"
                                checked={formData.farmerAssociation === 'Yes'}
                                onChange={handleRadioChange}
                            /> Yes
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="farmerAssociation"
                                value="No"
                                checked={formData.farmerAssociation === 'No'}
                                onChange={handleRadioChange}
                            /> No
                        </label>
                    </div>

                    {formData.farmerAssociation === 'Yes' && (
                        <div className="form-row specify-row">
                            <span className="inline-label">If yes, specify: </span>
                            <input
                                type="text"
                                name="farmerAssociationSpecify"
                                value={formData.farmerAssociationSpecify}
                                onChange={handleChange}
                            />
                        </div>
                    )}

                    <hr className="form-separator" />

                    <div className="form-row person_to_notify-row">
                        <span className="inline-label">Person to Notify in case of Emergency: </span>
                        <input
                            type="text"
                            name="emergencyContact.name"
                            value={formData.emergencyContact.name}
                            onChange={handleChange}
                        />
                        <span className="inline-label">Contact Number: </span>
                        <input
                            type="text"
                            name="emergencyContact.contactNumber"
                            value={formData.emergencyContact.contactNumber}
                            onChange={handleChange}
                        />
                    </div>
                </fieldset>

                {/* PART II: FARM PROFILE */}
                <fieldset>
                    <legend>Part II: Farm Profile</legend>

                    <div className="form-row main_livelihood-row">
                        <label>Main Livelihood:</label>
                        <label>
                            <input
                                type="radio"
                                name="mainLivelihood"
                                value="Farmer"
                                checked={formData.mainLivelihood === 'Farmer'}
                                onChange={handleRadioChange}
                            /> Farmer
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="mainLivelihood"
                                value="Farmworker"
                                checked={formData.mainLivelihood === 'Farmworker'}
                                onChange={handleRadioChange}
                            /> Farmworker
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="mainLivelihood"
                                value="Fisherfolk"
                                checked={formData.mainLivelihood === 'Fisherfolk'}
                                onChange={handleRadioChange}
                            /> Fisherfolk
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="mainLivelihood"
                                value="Agri Youth"
                                checked={formData.mainLivelihood === 'Agri Youth'}
                                onChange={handleRadioChange}
                            /> Agri Youth
                        </label>
                        {errors.mainLivelihood && <span className="error">{errors.mainLivelihood}</span>}
                    </div>

                    <hr className="form-separator" />

                    <div className="farm_profile-row">
                        {/* Farmer Activities */}
                        {formData.mainLivelihood === 'Farmer' && (
                            <div className="form-row type_activity-row">
                                <label><strong>For farmers:</strong></label>
                                <label>Type of Farming Activity</label>
                                <label>
                                    <input
                                        type="checkbox"
                                        name="rice"
                                        checked={formData.farmingActivities.rice}
                                        onChange={(e) => handleCheckboxGroupChange(e, 'farmingActivities')}
                                    /> Rice
                                </label>
                                <label>
                                    <input
                                        type="checkbox"
                                        name="corn"
                                        checked={formData.farmingActivities.corn}
                                        onChange={(e) => handleCheckboxGroupChange(e, 'farmingActivities')}
                                    /> Corn
                                </label>
                                <label>
                                    <input
                                        type="checkbox"
                                        name="otherCrops"
                                        checked={formData.farmingActivities.otherCrops}
                                        onChange={(e) => handleCheckboxGroupChange(e, 'farmingActivities')}
                                    /> Other crops, please specify:
                                    <input
                                        type="text"
                                        name="otherCropsSpecify"
                                        value={formData.farmingActivities.otherCropsSpecify}
                                        onChange={(e) => handleChange(e)} // Changed to handleChange for text input
                                        disabled={!formData.farmingActivities.otherCrops}
                                    />
                                </label>
                                <label>
                                    <input
                                        type="checkbox"
                                        name="livestock"
                                        checked={formData.farmingActivities.livestock}
                                        onChange={(e) => handleCheckboxGroupChange(e, 'farmingActivities')}
                                    /> Livestock, please specify:
                                    <input
                                        type="text"
                                        name="livestockSpecify"
                                        value={formData.farmingActivities.livestockSpecify}
                                        onChange={(e) => handleChange(e)} // Changed to handleChange for text input
                                        disabled={!formData.farmingActivities.livestock}
                                    />
                                </label>
                                <label>
                                    <input
                                        type="checkbox"
                                        name="poultry"
                                        checked={formData.farmingActivities.poultry}
                                        onChange={(e) => handleCheckboxGroupChange(e, 'farmingActivities')}
                                    /> Poultry, please specify:
                                    <input
                                        type="text"
                                        name="poultrySpecify"
                                        value={formData.farmingActivities.poultrySpecify}
                                        onChange={(e) => handleChange(e)} // Changed to handleChange for text input
                                        disabled={!formData.farmingActivities.poultry}
                                    />
                                </label>
                            </div>
                        )}

                        {/* Farmworker Activities */}
                        {formData.mainLivelihood === 'Farmworker' && (
                            <div className="form-row type_activity-row">
                                <label><strong>For farmworkers:</strong></label>
                                <label>Kind of Work</label>
                                <label>
                                    <input
                                        type="checkbox"
                                        name="landPreparation"
                                        checked={formData.farmworkerActivities.landPreparation}
                                        onChange={(e) => handleCheckboxGroupChange(e, 'farmworkerActivities')}
                                    /> Land Preparation
                                </label>
                                <label>
                                    <input
                                        type="checkbox"
                                        name="planting"
                                        checked={formData.farmworkerActivities.planting}
                                        onChange={(e) => handleCheckboxGroupChange(e, 'farmworkerActivities')}
                                    /> Planting/Transplanting
                                </label>
                                <label>
                                    <input
                                        type="checkbox"
                                        name="cultivation"
                                        checked={formData.farmworkerActivities.cultivation}
                                        onChange={(e) => handleCheckboxGroupChange(e, 'farmworkerActivities')}
                                    /> Cultivation
                                </label>
                                <label>
                                    <input
                                        type="checkbox"
                                        name="harvesting"
                                        checked={formData.farmworkerActivities.harvesting}
                                        onChange={(e) => handleCheckboxGroupChange(e, 'farmworkerActivities')}
                                    /> Harvesting
                                </label>
                                <label>
                                    <input
                                        type="checkbox"
                                        name="others"
                                        checked={formData.farmworkerActivities.others}
                                        onChange={(e) => handleCheckboxGroupChange(e, 'farmworkerActivities')}
                                    /> Others, please specify:
                                    <input
                                        type="text"
                                        name="othersSpecify"
                                        value={formData.farmworkerActivities.othersSpecify}
                                        onChange={(e) => handleChange(e)} // Changed to handleChange for text input
                                        disabled={!formData.farmworkerActivities.others}
                                    />
                                </label>
                            </div>
                        )}

                        {/* Fisherfolk Activities */}
                        {formData.mainLivelihood === 'Fisherfolk' && (
                            <div className="form-row type_activity-row">
                                <label><strong>For fisherfolk:</strong></label>
                                <p>The Lending Conduit shall coordinate with the Bureau of Fisheries and Aquatic Resources (BFAR) in the issuance of a certification that the fisherfolk-borrower under PUNLA/PLEA is registered under the Municipal Registration (FishR).</p>
                                <label>Type of Fishing Activity</label>
                                <label>
                                    <input
                                        type="checkbox"
                                        name="fishCapture"
                                        checked={formData.fisherfolkActivities.fishCapture}
                                        onChange={(e) => handleCheckboxGroupChange(e, 'fisherfolkActivities')}
                                    /> Fish Capture
                                </label>
                                <label>
                                    <input
                                        type="checkbox"
                                        name="aquaculture"
                                        checked={formData.fisherfolkActivities.aquaculture}
                                        onChange={(e) => handleCheckboxGroupChange(e, 'fisherfolkActivities')}
                                    /> Aquaculture
                                </label>
                                <label>
                                    <input
                                        type="checkbox"
                                        name="gleaning"
                                        checked={formData.fisherfolkActivities.gleaning}
                                        onChange={(e) => handleCheckboxGroupChange(e, 'fisherfolkActivities')}
                                    /> Gleaning
                                </label>
                                <label>
                                    <input
                                        type="checkbox"
                                        name="fishProcessing"
                                        checked={formData.fisherfolkActivities.fishProcessing}
                                        onChange={(e) => handleCheckboxGroupChange(e, 'fisherfolkActivities')}
                                    /> Fish Processing
                                </label>
                                <label>
                                    <input
                                        type="checkbox"
                                        name="fishVending"
                                        checked={formData.fisherfolkActivities.fishVending}
                                        onChange={(e) => handleCheckboxGroupChange(e, 'fisherfolkActivities')}
                                    /> Fish Vending
                                </label>
                                <label>
                                    <input
                                        type="checkbox"
                                        name="others"
                                        checked={formData.fisherfolkActivities.others}
                                        onChange={(e) => handleCheckboxGroupChange(e, 'fisherfolkActivities')}
                                    /> Others, please specify:
                                    <input
                                        type="text"
                                        name="othersSpecify"
                                        value={formData.fisherfolkActivities.othersSpecify}
                                        onChange={(e) => handleChange(e)} // Changed to handleChange for text input
                                        disabled={!formData.fisherfolkActivities.others}
                                    />
                                </label>
                            </div>
                        )}

                        {/* Agri Youth Activities */}
                        {formData.mainLivelihood === 'Agri Youth' && (
                            <div className="form-row type_activity-row">
                                <label><strong>For agri youth:</strong></label>
                                <p>For the purposes of trainings, financial assistance, and other programs catered for the youth with involvement to any agriculture activity.</p>
                                <label>Type of involvement</label>
                                <label>
                                    <input
                                        type="checkbox"
                                        name="farmingHousehold"
                                        checked={formData.agriYouthActivities.farmingHousehold}
                                        onChange={(e) => handleCheckboxGroupChange(e, 'agriYouthActivities')}
                                    /> Part of a farming household
                                </label>
                                <label>
                                    <input
                                        type="checkbox"
                                        name="formalCourse"
                                        checked={formData.agriYouthActivities.formalCourse}
                                        onChange={(e) => handleCheckboxGroupChange(e, 'agriYouthActivities')}
                                    /> Attending/attended formal agri-fishery related course
                                </label>
                                <label>
                                    <input
                                        type="checkbox"
                                        name="nonFormalCourse"
                                        checked={formData.agriYouthActivities.nonFormalCourse}
                                        onChange={(e) => handleCheckboxGroupChange(e, 'agriYouthActivities')}
                                    /> Attending/attended non-formal agri-fishery related course
                                </label>
                                <label>
                                    <input
                                        type="checkbox"
                                        name="participated"
                                        checked={formData.agriYouthActivities.participated}
                                        onChange={(e) => handleCheckboxGroupChange(e, 'agriYouthActivities')}
                                    /> Participated in any agricultural activity/program
                                </label>
                                <label>
                                    <input
                                        type="checkbox"
                                        name="others"
                                        checked={formData.agriYouthActivities.others}
                                        onChange={(e) => handleCheckboxGroupChange(e, 'agriYouthActivities')}
                                    /> Others, specify:
                                    <input
                                        type="text"
                                        name="othersSpecify"
                                        value={formData.agriYouthActivities.othersSpecify}
                                        onChange={(e) => handleChange(e)} // Changed to handleChange for text input
                                        disabled={!formData.agriYouthActivities.others}
                                    />
                                </label>
                            </div>
                        )}
                    </div>

                    <hr className="form-separator" />

                    <div className="form-row gross_annual_income-row">
                        <label className="inline-label">Gross Annual Income Last Year:</label>
                        <span className="inline-label">Farming: </span>
                        <input
                            type="text"
                            name="grossAnnualIncome.farming"
                            value={formData.grossAnnualIncome.farming}
                            onChange={handleChange}
                        />
                        <span className="inline-label">Non-farming: </span>
                        <input
                            type="text"
                            name="grossAnnualIncome.nonFarming"
                            value={formData.grossAnnualIncome.nonFarming}
                            onChange={handleChange}
                        />
                    </div>
                </fieldset>

                <fieldset>
                    <legend>Farm Parcel Details & Ownership</legend>

                    <div className="form-row farm_parcel-row">
                        <span className="inline-label">No. of Farm Parcels: </span>
                        <input
                            type="text"
                            name="numberOfFarmParcels"
                            value={formData.numberOfFarmParcels}
                            onChange={handleChange}
                        />
                        <span className="inline-label">Name of Farmer/s in Rotation(P1): </span>
                        <input
                            type="text"
                            name="farmersInRotation.p1"
                            value={formData.farmersInRotation.p1}
                            onChange={handleChange}
                        />
                        <span className="inline-label">(P2): </span>
                        <input
                            type="text"
                            name="farmersInRotation.p2"
                            value={formData.farmersInRotation.p2}
                            onChange={handleChange}
                        />
                        <span className="inline-label">(P3): </span>
                        <input
                            type="text"
                            name="farmersInRotation.p3"
                            value={formData.farmersInRotation.p3}
                            onChange={handleChange}
                        />
                    </div>

                    <hr className="form-separator" />

                    {formData.farmParcels.map((parcel, index) => (
                        <div key={index} className="farm-parcel-container">
                            {/* Simple Parcel Header */}
                            <div className="parcel-header">
                                <h4>Farm Parcel #{parcel.parcelNumber}</h4>
                                {formData.farmParcels.length > 1 && (
                                    <button
                                        type="button"
                                        className="remove-parcel-btn"
                                        onClick={() => removeFarmParcel(index)}
                                    >
                                        🗑️ Remove
                                    </button>
                                )}
                            </div>
                            <table className="farm-table">
                                <thead>
                                    <tr>
                                        <th>FARM PARCEL NO. {parcel.parcelNumber}</th>
                                        <th colSpan={2}>FARM LAND DESCRIPTION</th>
                                        <th colSpan={3}>CROP/COMMODITY</th>
                                        <th>SIZE (ha)</th>
                                        <th>NO. OF HEAD (For Livestock and Poultry)</th>
                                        <th>FARM TYPE</th>
                                        <th>ORGANIC PRACTITIONER (Y/N)</th>
                                        <th>REMARKS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td rowSpan={6}>{parcel.parcelNumber}</td>
                                        <td colSpan={2}>
                                            <div className="form-group">
                                                <label>Farm Location (Barangay):</label>
                                                <select
                                                    name={`farmParcels[${index}].farmLocation.barangay`}
                                                    value={parcel.farmLocation.barangay}
                                                    onChange={handleSelectChange}
                                                >
                                                    <option value="">Select Barangay</option>
                                                    {barangayNames.map((barangay, idx) => (
                                                        <option key={idx} value={barangay}>
                                                            {barangay}
                                                        </option>
                                                    ))}
                                                </select>
                                                <label>City/Municipality:</label>
                                                <input
                                                    type="text"
                                                    name={`farmParcels[${index}].farmLocation.cityMunicipality`}
                                                    value={parcel.farmLocation.cityMunicipality}
                                                    onChange={handleChange}
                                                />
                                            </div>
                                        </td>
                                        <td rowSpan={6} colSpan={3}>
                                            <input
                                                type="text"
                                                placeholder="e.g. Rice/Corn/etc."
                                                name={`farmParcels[${index}].cropCommodity`}
                                                value={parcel.cropCommodity}
                                                onChange={handleChange}
                                            />
                                        </td>
                                        <td rowSpan={6}>
                                            <input
                                                type="text"
                                                placeholder="e.g. 1.5"
                                                name={`farmParcels[${index}].size`}
                                                value={parcel.size}
                                                onChange={handleChange}
                                            />
                                        </td>
                                        <td rowSpan={6}>
                                            <input
                                                type="text"
                                                placeholder="e.g. 3"
                                                name={`farmParcels[${index}].numberOfHead`}
                                                value={parcel.numberOfHead}
                                                onChange={handleChange}
                                            />
                                        </td>
                                        <td rowSpan={6}>
                                            <input
                                                type="text"
                                                placeholder="Farm Type"
                                                name={`farmParcels[${index}].farmType`}
                                                value={parcel.farmType}
                                                onChange={handleChange}
                                            />
                                        </td>
                                        <td rowSpan={6} className="organic-practitioner-cell">
                                            <label>
                                                <input
                                                    type="radio"
                                                    name={`farmParcels[${index}].organicPractitioner`}
                                                    value="Y"
                                                    checked={parcel.organicPractitioner === 'Y'}
                                                    onChange={handleChange}
                                                /> Y
                                            </label>
                                            <label>
                                                <input
                                                    type="radio"
                                                    name={`farmParcels[${index}].organicPractitioner`}
                                                    value="N"
                                                    checked={parcel.organicPractitioner === 'N'}
                                                    onChange={handleChange}
                                                /> N
                                            </label>
                                        </td>
                                        <td rowSpan={6}>
                                            <input
                                                type="text"
                                                placeholder="Remarks"
                                                name={`farmParcels[${index}].remarks`}
                                                value={parcel.remarks}
                                                onChange={handleChange}
                                            />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td colSpan={2}>
                                            <div className="form-group">
                                                <label>Total Farm Area (ha):</label>
                                                <input
                                                    type="text"
                                                    name={`farmParcels[${index}].totalFarmArea`}
                                                    value={parcel.totalFarmArea}
                                                    onChange={handleChange}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td colSpan={2} className="checkbox-inline-group">
                                            <label>Within Ancestral Domain:</label>
                                            <label>
                                                <input
                                                    type="radio"
                                                    name={`farmParcels[${index}].withinAncestralDomain`}
                                                    value="Yes"
                                                    checked={parcel.withinAncestralDomain === 'Yes'}
                                                    onChange={handleChange}
                                                /> Yes
                                            </label>
                                            <label>
                                                <input
                                                    type="radio"
                                                    name={`farmParcels[${index}].withinAncestralDomain`}
                                                    value="No"
                                                    checked={parcel.withinAncestralDomain === 'No'}
                                                    onChange={handleChange}
                                                /> No
                                            </label>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td colSpan={2} className="checkbox-inline-group">
                                            <label>Agrarian Reform Beneficiary:</label>
                                            <label>
                                                <input
                                                    type="radio"
                                                    name={`farmParcels[${index}].agrarianReformBeneficiary`}
                                                    value="Yes"
                                                    checked={parcel.agrarianReformBeneficiary === 'Yes'}
                                                    onChange={handleChange}
                                                /> Yes
                                            </label>
                                            <label>
                                                <input
                                                    type="radio"
                                                    name={`farmParcels[${index}].agrarianReformBeneficiary`}
                                                    value="No"
                                                    checked={parcel.agrarianReformBeneficiary === 'No'}
                                                    onChange={handleChange}
                                                /> No
                                            </label>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td colSpan={2}>
                                            <div className="form-group">
                                                <label>Ownership Document No.:</label>
                                                <input
                                                    type="text"
                                                    name={`farmParcels[${index}].ownershipDocumentNo`}
                                                    value={parcel.ownershipDocumentNo}
                                                    onChange={handleChange}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td colSpan={2} className="ownership-type-group">
                                            <div className="form-group">
                                                <label>Ownership Type:</label>
                                            </div>
                                            <label>
                                                <input
                                                    type="checkbox"
                                                    name="registeredOwner"
                                                    checked={parcel.ownershipType.registeredOwner}
                                                    onChange={(e) => {
                                                        const newParcels = [...formData.farmParcels];
                                                        newParcels[index].ownershipType.registeredOwner = e.target.checked;
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            farmParcels: newParcels
                                                        }));
                                                    }}
                                                /> Registered Owner
                                            </label>
                                            <label>
                                                <input
                                                    type="checkbox"
                                                    name="tenant"
                                                    checked={parcel.ownershipType.tenant}
                                                    onChange={(e) => {
                                                        const newParcels = [...formData.farmParcels];
                                                        newParcels[index].ownershipType.tenant = e.target.checked;
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            farmParcels: newParcels
                                                        }));
                                                    }}
                                                /> Tenant (Name of the Land Owner):
                                                <input
                                                    type="text"
                                                    name="tenantLandOwner"
                                                    value={parcel.ownershipType.tenantLandOwner}
                                                    onChange={(e) => {
                                                        const newParcels = [...formData.farmParcels];
                                                        newParcels[index].ownershipType.tenantLandOwner = e.target.value;
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            farmParcels: newParcels
                                                        }));
                                                    }}
                                                />
                                            </label>
                                            <label>
                                                <input
                                                    type="checkbox"
                                                    name="lessee"
                                                    checked={parcel.ownershipType.lessee}
                                                    onChange={(e) => {
                                                        const newParcels = [...formData.farmParcels];
                                                        newParcels[index].ownershipType.lessee = e.target.checked;
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            farmParcels: newParcels
                                                        }));
                                                    }}
                                                /> Lessee (Name of the Land Owner):
                                                <input
                                                    type="text"
                                                    name="lesseeLandOwner"
                                                    value={parcel.ownershipType.lesseeLandOwner}
                                                    onChange={(e) => {
                                                        const newParcels = [...formData.farmParcels];
                                                        newParcels[index].ownershipType.lesseeLandOwner = e.target.value;
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            farmParcels: newParcels
                                                        }));
                                                    }}
                                                />
                                            </label>
                                            <label>
                                                <input
                                                    type="checkbox"
                                                    name="others"
                                                    checked={parcel.ownershipType.others}
                                                    onChange={(e) => {
                                                        const newParcels = [...formData.farmParcels];
                                                        newParcels[index].ownershipType.others = e.target.checked;
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            farmParcels: newParcels
                                                        }));
                                                    }}
                                                /> Others:
                                                <input
                                                    type="text"
                                                    name="othersSpecify"
                                                    value={parcel.ownershipType.othersSpecify}
                                                    onChange={(e) => {
                                                        const newParcels = [...formData.farmParcels];
                                                        newParcels[index].ownershipType.othersSpecify = e.target.value;
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            farmParcels: newParcels
                                                        }));
                                                    }}
                                                />
                                            </label>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                            <div className="farm-parcel-actions">
                                {index > 0 && (
                                    <button
                                        type="button"
                                        className="remove-parcel-btn"
                                        onClick={() => removeFarmParcel(index)}
                                    >
                                        Remove Parcel
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}

                    <div className="add-parcel-container">
                        <button
                            type="button"
                            className="add-parcel-btn"
                            onClick={addFarmParcel}
                        >
                            Add Another Farm Parcel
                        </button>
                    </div>
                </fieldset>

                {/* Move document upload to the end of the form */}
                <div className="form-footer">
                    {errors.submit && <div className="error-message">{errors.submit}</div>}
                    {errors.farmParcels && <div className="error-message">{errors.farmParcels}</div>}
                    <button
                        className="rsbsa_submit"
                        type="submit"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default RSBSAFormPage;