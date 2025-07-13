// TechRSBSAPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import "../../assets/css/ActiveFarmersPage.css";
import type { FarmParcel } from '../../types/geojson';

interface RSBSARecord {
    id: string;
    enrollmentType: string;
    dateAdministered: string;
    surname: string;
    firstName: string;
    middleName: string;
    extensionName: string;
    sex: string;
    addressBarangay: string;
    addressMunicipality: string;
    addressProvince: string;
    mobileNumber: string;
    dateOfBirth: string;
    civilStatus: string;
    highestFormalEducation: string;
    mainLivelihood: string;
    numberOfFarmParcels: string;
    createdAt: string;
    // Farm land description fields from database
    farmLandDescription?: string;
    farmLocationBarangay?: string;
    farmLocationCityMunicipality?: string;
    totalFarmArea?: string;
    withinAncestralDomain?: string;
    agrarianReformBeneficiary?: string;
    ownershipDocumentNo?: string;
    // Ownership type fields from database
    ownershipTypeRegisteredOwner?: boolean;
    ownershipTypeTenant?: boolean;
    ownershipTypeTenantLandOwner?: string;
    ownershipTypeLessee?: boolean;
    ownershipTypeLesseeLandOwner?: string;
    ownershipTypeOthers?: boolean;
    ownershipTypeOthersSpecify?: string;
    // Crop and farm details from database
    cropCommodity?: string;
    farmSize?: string;
    numberOfHead?: string;
    farmType?: string;
    organicPractitioner?: string;
    farmRemarks?: string;
    // Legacy fields for backward compatibility
    parcelNumber?: string;
    parcelAddress?: string;
    parcelArea?: string;
    ownershipType?: {
        registeredOwner: boolean;
        tenant: boolean;
        tenantLandOwner: string;
        lessee: boolean;
        lesseeLandOwner: string;
        others: boolean;
        othersSpecify: string;
    };
}

const TechRSBSAPage: React.FC = () => {
    const navigate = useNavigate();
    const [rsbsaRecords, setRsbsaRecords] = useState<RSBSARecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [openActionsRowId, setOpenActionsRowId] = useState<string | null>(null);
    const [selectedRecordForStatus, setSelectedRecordForStatus] = useState<RSBSARecord | null>(null);
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
    const [editFormData, setEditFormData] = useState<Partial<RSBSARecord>>({});
    const internalIdCounter = useRef(0);

    // Add state for ownership update
    const [selectedOwnershipType, setSelectedOwnershipType] = useState<string>('');
    const [landOwnerName, setLandOwnerName] = useState<string>('');
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    // Add state for document modal
    const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
    const [docsForRecord, setDocsForRecord] = useState<any[]>([]); // Changed to any[] to match new structure
    const [selectedRecordForDocs, setSelectedRecordForDocs] = useState<RSBSARecord | null>(null);
    // Add state for selected document index in the modal
    const [selectedDocIndex, setSelectedDocIndex] = useState(0);

    // Add state for success message
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const [selectedParcel, setSelectedParcel] = useState<FarmParcel | null>(null);
    const [isParcelModalOpen, setIsParcelModalOpen] = useState(false);

    // Add state for registered owners and selected owner ID
    const [registeredOwners, setRegisteredOwners] = useState<any[]>([]);
    const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');

    // Add state for search query
    const [searchQuery, setSearchQuery] = useState('');

    // Add state for area input during editing
    const [editFormDataArea, setEditFormDataArea] = useState('');

    // Add state for upload loading and error
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    // Helper function to determine ownership status
    const getOwnershipStatus = (record: RSBSARecord): string => {
        // First try to use the new database fields
        if (record.ownershipTypeRegisteredOwner) return 'REGISTERED OWNER';
        if (record.ownershipTypeTenant) return 'TENANT';
        if (record.ownershipTypeLessee) return 'LESSEE';
        if (record.ownershipTypeOthers) return 'OTHERS';

        // Fallback to legacy ownershipType object if available
        if (record.ownershipType) {
            if (record.ownershipType.registeredOwner) return 'REGISTERED OWNER';
            if (record.ownershipType.tenant) return 'TENANT';
            if (record.ownershipType.lessee) return 'LESSEE';
            if (record.ownershipType.others) return 'OTHERS';
        }
        return 'UNKNOWN';
    };

    // Helper function to get status pill class
    const getStatusPillClass = (status: string): string => {
        switch (status) {
            case 'REGISTERED OWNER':
                return 'status-active';
            case 'TENANT':
                return 'status-tenant';
            case 'LESSEE':
                return 'status-landowner';
            default:
                return 'status-active';
        }
    };

    // Helper to get editable area value
    const getAreaValue = (record: RSBSARecord) => record.farmSize || record.totalFarmArea || record.parcelArea || record.numberOfFarmParcels || '';

    const fetchRSBSARecords = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/RSBSAform');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            console.log('Raw RSBSA API response data:', data);

            const formattedData: RSBSARecord[] = data
                .map((record: any) => {
                    console.log('Processing RSBSA record:', record);

                    // Create ownership type object from database fields for backward compatibility
                    const ownershipType = {
                        registeredOwner: record.ownershipTypeRegisteredOwner || false,
                        tenant: record.ownershipTypeTenant || false,
                        tenantLandOwner: record.ownershipTypeTenantLandOwner || '',
                        lessee: record.ownershipTypeLessee || false,
                        lesseeLandOwner: record.ownershipTypeLesseeLandOwner || '',
                        others: record.ownershipTypeOthers || false,
                        othersSpecify: record.ownershipTypeOthersSpecify || ''
                    };

                    const formatted = {
                        id: record.id || `${record.firstName}-${record.surname}-${Math.random()}`,
                        enrollmentType: record.enrollmentType || '',
                        dateAdministered: record.dateAdministered || '',
                        surname: record.surname || '',
                        firstName: record.firstName || '',
                        middleName: record.middleName || '',
                        extensionName: record.extensionName || '',
                        sex: record.sex || '',
                        addressBarangay: record.addressBarangay || '',
                        addressMunicipality: record.addressMunicipality || '',
                        addressProvince: record.addressProvince || '',
                        mobileNumber: record.mobileNumber || '',
                        dateOfBirth: record.dateOfBirth || '',
                        civilStatus: record.civilStatus || '',
                        highestFormalEducation: record.highestFormalEducation || '',
                        mainLivelihood: record.mainLivelihood || '',
                        numberOfFarmParcels: record.numberOfFarmParcels || '',
                        createdAt: record.createdAt || '',
                        // Farm land description fields from database
                        farmLandDescription: record.farmLandDescription || '',
                        farmLocationBarangay: record.farmLocationBarangay || '',
                        farmLocationCityMunicipality: record.farmLocationCityMunicipality || '',
                        totalFarmArea: record.totalFarmArea || '',
                        withinAncestralDomain: record.withinAncestralDomain || '',
                        agrarianReformBeneficiary: record.agrarianReformBeneficiary || '',
                        ownershipDocumentNo: record.ownershipDocumentNo || '',
                        // Ownership type fields from database
                        ownershipTypeRegisteredOwner: record.ownershipTypeRegisteredOwner || false,
                        ownershipTypeTenant: record.ownershipTypeTenant || false,
                        ownershipTypeTenantLandOwner: record.ownershipTypeTenantLandOwner || '',
                        ownershipTypeLessee: record.ownershipTypeLessee || false,
                        ownershipTypeLesseeLandOwner: record.ownershipTypeLesseeLandOwner || '',
                        ownershipTypeOthers: record.ownershipTypeOthers || false,
                        ownershipTypeOthersSpecify: record.ownershipTypeOthersSpecify || '',
                        // Crop and farm details from database
                        cropCommodity: record.cropCommodity || '',
                        farmSize: record.farmSize || '',
                        numberOfHead: record.numberOfHead || '',
                        farmType: record.farmType || '',
                        organicPractitioner: record.organicPractitioner || '',
                        farmRemarks: record.farmRemarks || '',
                        // Legacy fields for backward compatibility
                        parcelNumber: record.parcelNumber || '1',
                        parcelAddress: record.parcelAddress || '',
                        parcelArea: record.parcelArea || '',
                        ownershipType: ownershipType
                    };
                    console.log('Formatted RSBSA record:', formatted);
                    return formatted;
                })
                // Filter out records with missing required fields
                .filter((record: RSBSARecord) => {
                    const isValid = record.firstName && record.surname;
                    if (!isValid) {
                        console.log('Filtering out invalid RSBSA record:', record);
                    }
                    return isValid;
                });

            console.log('Final formatted RSBSA data:', formattedData);
            setRsbsaRecords(formattedData);
            setLoading(false);
        } catch (err: any) {
            console.error('Error fetching RSBSA records:', err);
            setError(err.message);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRSBSARecords();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            const isClickOnActionsButton = !!target.closest('.action-more-button');
            const isClickInsideActionsDropdown = !!target.closest('.actions-dropdown');
            if (!isClickOnActionsButton && !isClickInsideActionsDropdown) {
                setOpenActionsRowId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this RSBSA record?')) {
            try {
                // Find the RSBSA record using the generated ID
                const recordToDelete = rsbsaRecords.find(record => record.id === id);

                if (!recordToDelete) {
                    console.error("RSBSA record not found for deletion in frontend state.");
                    return;
                }

                console.log('Found RSBSA record to delete:', recordToDelete);

                // For now, just remove from frontend state since we don't have a delete endpoint for RSBSA
                setRsbsaRecords(rsbsaRecords.filter(record => record.id !== id));
                setOpenActionsRowId(null);
                console.log(`RSBSA record ${recordToDelete.firstName} ${recordToDelete.surname} deleted successfully from frontend.`);
            } catch (err: any) {
                console.error('Error deleting RSBSA record:', err);
                setError(err.message);
            }
        }
    };

    const handleUpdateStatus = async () => {
        if (!selectedRecordForStatus || !selectedOwnershipType) return;
        if ((selectedOwnershipType === 'TENANT' || selectedOwnershipType === 'LESSEE') && !selectedOwnerId) return;
        setIsUpdatingStatus(true);
        try {
            // Call the backend API to update ownership type
            const response = await fetch(`http://localhost:5000/api/RSBSAform/${selectedRecordForStatus.id}/ownership`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ownershipType: selectedOwnershipType,
                    landOwnerId: selectedOwnerId // send ownerId instead of name
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Update the record in frontend state
            const updatedRecord = { ...selectedRecordForStatus };

            // Reset all ownership type flags
            updatedRecord.ownershipTypeRegisteredOwner = false;
            updatedRecord.ownershipTypeTenant = false;
            updatedRecord.ownershipTypeLessee = false;
            updatedRecord.ownershipTypeOthers = false;

            // Set the appropriate flag based on new status
            switch (selectedOwnershipType) {
                case 'REGISTERED OWNER':
                    updatedRecord.ownershipTypeRegisteredOwner = true;
                    break;
                case 'TENANT':
                    updatedRecord.ownershipTypeTenant = true;
                    updatedRecord.ownershipTypeTenantLandOwner = selectedOwnerId;
                    break;
                case 'LESSEE':
                    updatedRecord.ownershipTypeLessee = true;
                    updatedRecord.ownershipTypeLesseeLandOwner = selectedOwnerId;
                    break;
                case 'OTHERS':
                    updatedRecord.ownershipTypeOthers = true;
                    updatedRecord.ownershipTypeOthersSpecify = '';
                    break;
            }

            // Also update the legacy ownershipType object for backward compatibility
            updatedRecord.ownershipType = {
                registeredOwner: updatedRecord.ownershipTypeRegisteredOwner || false,
                tenant: updatedRecord.ownershipTypeTenant || false,
                tenantLandOwner: updatedRecord.ownershipTypeTenantLandOwner || '',
                lessee: updatedRecord.ownershipTypeLessee || false,
                lesseeLandOwner: updatedRecord.ownershipTypeLesseeLandOwner || '',
                others: updatedRecord.ownershipTypeOthers || false,
                othersSpecify: updatedRecord.ownershipTypeOthersSpecify || ''
            };

            // Update the record in frontend state
            setRsbsaRecords(rsbsaRecords.map(record =>
                record.id === selectedRecordForStatus.id ? updatedRecord : record
            ));

            // Reset form and close modal
            setSelectedOwnershipType('');
            setSelectedOwnerId('');
            closeStatusModal();

            // Show success message
            setSuccessMessage(`Successfully updated ownership type for ${updatedRecord.firstName} ${updatedRecord.surname} to ${selectedOwnershipType}`);
            setTimeout(() => setSuccessMessage(null), 3000); // Clear after 3 seconds

            console.log(`Updated ownership type for ${updatedRecord.firstName} ${updatedRecord.surname} to ${selectedOwnershipType}`);

            // Re-fetch registered owners if the status was changed to Registered Owner
            if (selectedOwnershipType === 'REGISTERED OWNER') {
                fetchRegisteredOwners();
            }

        } catch (err: any) {
            console.error('Error updating ownership type:', err);
            setError(err.message);
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleEditClick = (id: string) => {
        const recordToEdit = rsbsaRecords.find(record => record.id === id);

        if (!recordToEdit) {
            console.error("RSBSA record not found for editing in frontend state.");
            return;
        }

        setEditingRecordId(id);
        setEditFormData({
            firstName: recordToEdit.firstName,
            middleName: recordToEdit.middleName,
            surname: recordToEdit.surname,
            sex: recordToEdit.sex,
            addressBarangay: recordToEdit.addressBarangay,
            addressMunicipality: recordToEdit.addressMunicipality,
            addressProvince: recordToEdit.addressProvince,
            farmType: recordToEdit.farmType || '',
        });
        setEditFormDataArea(getAreaValue(recordToEdit));
    };

    const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'area') {
            setEditFormDataArea(value);
        } else {
            setEditFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleEditSave = async (id: string) => {
        const recordToUpdate = rsbsaRecords.find(record => record.id === id);

        if (!recordToUpdate) {
            console.error("RSBSA record not found for saving in frontend state.");
            return;
        }

        try {
            // Update the area in all possible fields for consistency
            const updatedRecord = {
                ...recordToUpdate,
                ...editFormData,
                farmSize: editFormDataArea,
                totalFarmArea: editFormDataArea,
                parcelArea: editFormDataArea,
                numberOfFarmParcels: editFormDataArea,
            };
            setRsbsaRecords(rsbsaRecords.map(record => record.id === id ? updatedRecord : record));
            setEditingRecordId(null);
            setEditFormData({});
            setEditFormDataArea('');
            console.log(`RSBSA record ${updatedRecord.firstName} ${updatedRecord.surname} updated successfully.`);
        } catch (err: any) {
            console.error('Error saving RSBSA record:', err);
            setError(err.message);
        }
    };

    const handleEditCancel = () => {
        setEditingRecordId(null);
        setEditFormData({}); // Clear form data
        setEditFormDataArea('');
    };

    // Handler to fetch and show documents for a record
    const handleViewDocuments = async (record: RSBSARecord) => {
        try {
            const response = await fetch(`http://localhost:5000/api/RSBSAform/${record.id}/photos`);
            const docs = await response.json();
            setDocsForRecord(docs);
            setSelectedRecordForDocs(record);
            setSelectedDocIndex(0);
            setIsDocsModalOpen(true);
        } catch (err) {
            setDocsForRecord([]);
            setSelectedRecordForDocs(record);
            setSelectedDocIndex(0);
            setIsDocsModalOpen(true);
        }
    };

    const handleActionsButtonClick = (e: React.MouseEvent, recordId: string) => {
        e.stopPropagation();
        setOpenActionsRowId(openActionsRowId === recordId ? null : recordId);
    };

    const closeStatusModal = () => {
        setIsStatusModalOpen(false);
        setSelectedRecordForStatus(null);
        setSelectedOwnershipType('');
        setLandOwnerName('');
        setIsUpdatingStatus(false);
    };

    const closeDocsModal = () => {
        setIsDocsModalOpen(false);
        setDocsForRecord([]);
        setSelectedRecordForDocs(null);
        setSelectedDocIndex(0); // Reset selected document index
    };

    // Helper to fetch registered owners
    const fetchRegisteredOwners = () => {
        fetch('http://localhost:5000/api/registered-owners')
            .then(res => res.json())
            .then(data => setRegisteredOwners(data))
            .catch(err => console.error('Error fetching registered owners:', err));
    };

    // Fetch registered owners when modal opens and Tenant/Lessee is selected
    useEffect(() => {
        if ((isStatusModalOpen && (selectedOwnershipType === 'TENANT' || selectedOwnershipType === 'LESSEE')) && registeredOwners.length === 0) {
            fetchRegisteredOwners();
        }
        // Reset selected owner when switching type
        if (!isStatusModalOpen || (selectedOwnershipType !== 'TENANT' && selectedOwnershipType !== 'LESSEE')) {
            setSelectedOwnerId('');
        }
    }, [isStatusModalOpen, selectedOwnershipType]);

    // Compute filtered records
    const filteredRecords = rsbsaRecords.filter(record => {
        const query = searchQuery.toLowerCase();
        const fullName = [record.surname, record.firstName, record.middleName].filter(Boolean).join(' ').toLowerCase();
        return (
            fullName.includes(query) ||
            (record.addressBarangay && record.addressBarangay.toLowerCase().includes(query)) ||
            (record.addressMunicipality && record.addressMunicipality.toLowerCase().includes(query)) ||
            (record.addressProvince && record.addressProvince.toLowerCase().includes(query))
        );
    });

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;

    // Upload handler for the photo
    const handlePhotoUpload = async () => {
        if (!selectedRecordForDocs) return;
        setUploadError(null);
        // Create a hidden file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e: any) => {
            const file = e.target.files[0];
            if (!file) return;
            setIsUploading(true);
            try {
                const formData = new FormData();
                formData.append('photo', file);
                const response = await fetch(`http://localhost:5000/api/RSBSAform/${selectedRecordForDocs.id}/photo`, {
                    method: 'POST',
                    body: formData,
                });
                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'Upload failed');
                }
                const data = await response.json();
                setSuccessMessage('Photo uploaded successfully!');
                setTimeout(() => setSuccessMessage(null), 2000);
                // Optionally update docsForRecord to show the new photo (mock for now)
                // You may want to fetch the updated record from backend here
            } catch (err: any) {
                setUploadError(err.message);
            } finally {
                setIsUploading(false);
            }
        };
        input.click();
    };

    const handlePlotLand = (farmerId: string) => {
        navigate(`/parcel-selection/${farmerId}`);
    };

    return (
        <div className='active-farmer-page'>
            {/* Success Message */}
            {successMessage && (
                <div className="success-message" style={{
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    padding: '12px 20px',
                    borderRadius: '6px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    zIndex: 1000,
                    animation: 'slideInRight 0.3s ease-out'
                }}>
                    {successMessage}
                </div>
            )}
            <div className="farmers-header">
                <div className="farmers-header-left">
                    <button className="back-button" onClick={() => navigate('/technician-dashboard')}>←</button>
                    <h1 className="farmers-title">RSBSA Records</h1>
                </div>
                <div className="farmers-header-right">
                    <input type="text" placeholder="Search RSBSA records..." className="farmers-search-input" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                <div className="farmers-header-right">
                    <input type="button" value="+ Add RSBSA" className="farmers-search-input" onClick={() => navigate('/RSBSAForm')} />
                </div>
            </div>

            <div className="scrollable-content">
                <div className="farmers-container">
                    <div className="farmers-table-container">
                        <table className="farmers-table">
                            <thead>
                                <tr>
                                    <th>FULL NAME</th>
                                    <th>GENDER</th>
                                    <th>BARANGAY</th>
                                    <th>MUNICIPALITY</th>
                                    <th>PROVINCE</th>
                                    <th>AREA</th>
                                    <th>FARM PARCEL NO.</th>
                                    <th>STATUS</th>
                                    <th>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRecords.map((record) => {
                                    const ownershipStatus = getOwnershipStatus(record);
                                    const isEditing = editingRecordId === record.id;
                                    return (
                                        <tr key={record.id}>
                                            {/* FULL NAME: Surname, First Name, Middle Name */}
                                            <td>
                                                {isEditing ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 180 }}>
                                                        <label style={{ fontSize: '0.8em', color: '#555' }}>
                                                            Surname
                                                            <input
                                                                type="text"
                                                                name="surname"
                                                                value={editFormData.surname || ''}
                                                                onChange={handleEditChange}
                                                                placeholder="Surname"
                                                                style={{ width: '100%' }}
                                                            />
                                                        </label>
                                                        <label style={{ fontSize: '0.8em', color: '#555' }}>
                                                            First Name
                                                            <input
                                                                type="text"
                                                                name="firstName"
                                                                value={editFormData.firstName || ''}
                                                                onChange={handleEditChange}
                                                                placeholder="First Name"
                                                                style={{ width: '100%' }}
                                                            />
                                                        </label>
                                                        <label style={{ fontSize: '0.8em', color: '#555' }}>
                                                            Middle Name
                                                            <input
                                                                type="text"
                                                                name="middleName"
                                                                value={editFormData.middleName || ''}
                                                                onChange={handleEditChange}
                                                                placeholder="Middle Name"
                                                                style={{ width: '100%' }}
                                                            />
                                                        </label>
                                                    </div>
                                                ) : (
                                                    [record.surname, record.firstName, record.middleName].filter(Boolean).join(', ')
                                                )}
                                            </td>
                                            {/* GENDER */}
                                            <td>
                                                {isEditing ? (
                                                    <select name="sex" value={editFormData.sex || ''} onChange={handleEditChange}>
                                                        <option value="">Select</option>
                                                        <option value="Male">Male</option>
                                                        <option value="Female">Female</option>
                                                        <option value="Other">Other</option>
                                                    </select>
                                                ) : (
                                                    record.sex
                                                )}
                                            </td>
                                            {/* BARANGAY */}
                                            <td>
                                                {isEditing ? (
                                                    <input type="text" name="addressBarangay" value={editFormData.addressBarangay || ''} onChange={handleEditChange} />
                                                ) : (
                                                    record.addressBarangay
                                                )}
                                            </td>
                                            {/* MUNICIPALITY */}
                                            <td>
                                                {isEditing ? (
                                                    <input type="text" name="addressMunicipality" value={editFormData.addressMunicipality || ''} onChange={handleEditChange} />
                                                ) : (
                                                    record.addressMunicipality
                                                )}
                                            </td>
                                            {/* PROVINCE */}
                                            <td>
                                                {isEditing ? (
                                                    <input type="text" name="addressProvince" value={editFormData.addressProvince || ''} onChange={handleEditChange} />
                                                ) : (
                                                    record.addressProvince
                                                )}
                                            </td>
                                            {/* AREA */}
                                            <td>
                                                {isEditing ? (
                                                    <input type="text" name="area" value={editFormDataArea} onChange={handleEditChange} />
                                                ) : (
                                                    getAreaValue(record)
                                                )}
                                            </td>
                                            {/* FARM PARCEL NO. */}
                                            <td>{record.parcelNumber || '1'}</td>
                                            {/* STATUS - Ownership Type */}
                                            <td className="status-cell">
                                                <span
                                                    className={`status-pill ${getStatusPillClass(ownershipStatus)}`}
                                                    onClick={() => {
                                                        setSelectedRecordForStatus(record);
                                                        setIsStatusModalOpen(true);
                                                        setOpenActionsRowId(null);
                                                    }}
                                                    style={{ cursor: 'pointer' }}
                                                    title="Click to change ownership status"
                                                >
                                                    {ownershipStatus}
                                                </span>
                                            </td>
                                            {/* ACTIONS */}
                                            <td>
                                                <div className="actions-container">
                                                    {isEditing ? (
                                                        <>
                                                            <button className="update-status-btn" onClick={() => handleEditSave(record.id)}>Save</button>
                                                            <button className="cancel-btn" onClick={handleEditCancel}>Cancel</button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                className="action-more-button"
                                                                onClick={(e) => handleActionsButtonClick(e, record.id)}
                                                            >
                                                                ...
                                                            </button>
                                                            {openActionsRowId === record.id && (
                                                                <div className="actions-dropdown">
                                                                    <div key="edit" onClick={() => handleEditClick(record.id)}>Edit</div>
                                                                    <div key="plot-land" onClick={() => handlePlotLand(record.id)}>Plot Land</div>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {isStatusModalOpen && selectedRecordForStatus && (
                    <div className="modal-overlay" onClick={closeStatusModal}>
                        <div className="status-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>Update Ownership Status for {selectedRecordForStatus.firstName} {selectedRecordForStatus.surname}</h3>
                                <button className="close-button" onClick={closeStatusModal}>×</button>
                            </div>
                            <div className="modal-content">
                                <div className="farmer-info">
                                    <p><strong>Current Status:</strong>
                                        <span className={`status-pill ${getStatusPillClass(getOwnershipStatus(selectedRecordForStatus))}`}>
                                            {getOwnershipStatus(selectedRecordForStatus)}
                                        </span>
                                    </p>
                                    <p><strong>Full Name:</strong> {selectedRecordForStatus.firstName} {selectedRecordForStatus.middleName} {selectedRecordForStatus.surname}</p>
                                    <p><strong>Address:</strong> {selectedRecordForStatus.addressBarangay}, {selectedRecordForStatus.addressMunicipality}, {selectedRecordForStatus.addressProvince}</p>
                                    <p><strong>Gender:</strong> {selectedRecordForStatus.sex}</p>
                                    <p><strong>Farm Area:</strong> {selectedRecordForStatus.parcelArea || selectedRecordForStatus.numberOfFarmParcels}</p>
                                </div>
                                <div className="status-options">
                                    <h4>Select New Ownership Status:</h4>
                                    <div className="status-buttons">
                                        <button
                                            key="registered-owner"
                                            className={`status-option-btn ${selectedOwnershipType === 'REGISTERED OWNER' ? 'status-option-active' : ''}`}
                                            onClick={() => setSelectedOwnershipType('REGISTERED OWNER')}
                                        >
                                            <span className="status-dot status-active"></span>
                                            Registered Owner
                                        </button>
                                        <button
                                            key="tenant"
                                            className={`status-option-btn ${selectedOwnershipType === 'TENANT' ? 'status-option-tenant' : ''}`}
                                            onClick={() => setSelectedOwnershipType('TENANT')}
                                        >
                                            <span className="status-dot status-tenant"></span>
                                            Tenant
                                        </button>
                                        <button
                                            key="lessee"
                                            className={`status-option-btn ${selectedOwnershipType === 'LESSEE' ? 'status-option-landowner' : ''}`}
                                            onClick={() => setSelectedOwnershipType('LESSEE')}
                                        >
                                            <span className="status-dot status-landowner"></span>
                                            Lessee
                                        </button>
                                    </div>

                                    {/* Land Owner Name Input */}
                                    {(selectedOwnershipType === 'TENANT' || selectedOwnershipType === 'LESSEE') && (
                                        <div className="land-owner-input">
                                            <label htmlFor="landOwnerId">
                                                {selectedOwnershipType === 'TENANT' ? 'Select Registered Owner (for Tenant):' : 'Select Registered Owner (for Lessee):'}
                                            </label>
                                            <select
                                                id="landOwnerId"
                                                value={selectedOwnerId}
                                                onChange={e => setSelectedOwnerId(e.target.value)}
                                                required
                                            >
                                                <option value="">-- Select Registered Owner --</option>
                                                {registeredOwners.map(owner => (
                                                    <option key={owner.id} value={owner.id}>
                                                        {owner.surname}, {owner.first_name} {owner.middle_name ? owner.middle_name : ''} ({owner.address_barangay}, {owner.address_municipality}, {owner.address_province})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Update Button */}
                                    <div className="modal-actions">
                                        <button
                                            className="update-status-btn"
                                            onClick={handleUpdateStatus}
                                            disabled={!selectedOwnershipType || isUpdatingStatus ||
                                                ((selectedOwnershipType === 'TENANT' || selectedOwnershipType === 'LESSEE') && !selectedOwnerId)}
                                        >
                                            {isUpdatingStatus ? 'Updating...' : 'Update Status'}
                                        </button>
                                        <button
                                            className="cancel-btn"
                                            onClick={closeStatusModal}
                                            disabled={isUpdatingStatus}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {isDocsModalOpen && selectedRecordForDocs && (
                    <div className="modal-overlay" onClick={closeDocsModal}>
                        <div
                            className="status-modal"
                            style={{
                                maxWidth: 900,
                                minWidth: 700,
                                display: 'flex',
                                flexDirection: 'column',
                                border: '2px solid #222',
                                borderRadius: 12,
                                boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
                                background: '#fff',
                                padding: 0,
                                overflow: 'hidden',
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="modal-header" style={{ borderBottom: '1px solid #eee', padding: '18px 28px 10px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <h3 style={{ fontWeight: 500, fontSize: 20, margin: 0 }}>File Details</h3>
                                <button className="close-button" style={{ fontSize: 28, background: 'none', border: 'none', cursor: 'pointer', color: '#222' }} onClick={closeDocsModal}>×</button>
                            </div>
                            <div className="modal-content" style={{ display: 'flex', flexDirection: 'row', gap: 0, minHeight: 340, background: '#fff', padding: '0 0 0 0' }}>
                                {/* Sidebar: Document list */}
                                <div style={{ minWidth: 110, borderRight: '1px solid #eee', padding: '24px 8px 24px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: '#fff' }}>
                                    {docsForRecord.length === 0 ? (
                                        <div style={{ color: '#888', marginTop: 40 }}>No documents</div>
                                    ) : (
                                        docsForRecord.map((doc, idx) => (
                                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', marginBottom: 8 }} onClick={() => setSelectedDocIndex(idx)}>
                                                <div style={{
                                                    width: 44, height: 54, border: selectedDocIndex === idx ? '2px solid #111' : '1px solid #bbb', borderRadius: 8, background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 2
                                                }}>
                                                    <span style={{ fontSize: 30, color: selectedDocIndex === idx ? '#111' : '#888' }}>📄</span>
                                                </div>
                                                <span style={{ fontSize: 13, color: selectedDocIndex === idx ? '#111' : '#888', marginBottom: 2 }}>Page {idx + 1}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                                {/* Center: Document preview with scroll */}
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320, maxHeight: 420, overflowY: 'auto', background: '#fff', padding: '24px 0' }}>
                                    {docsForRecord[selectedDocIndex] ? (
                                        (() => {
                                            const doc = docsForRecord[selectedDocIndex];
                                            const isImage = doc.file_name && doc.file_name.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i);
                                            const imageUrl = doc.file_path ? `http://localhost:5000${doc.file_path}` : '';
                                            return isImage ? (
                                                <img src={imageUrl} alt={doc.file_name} style={{ maxWidth: 260, maxHeight: 340, borderRadius: 18, border: '2px solid #bbb', background: '#fff' }} />
                                            ) : (
                                                <span style={{ fontSize: 110, color: '#222' }}>📄</span>
                                            );
                                        })()
                                    ) : (
                                        <span style={{ fontSize: 64, color: '#bbb' }}>No Image</span>
                                    )}
                                </div>
                                {/* Right: File details and actions */}
                                <div style={{ minWidth: 240, display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center', background: '#fff', borderLeft: '1px solid #eee', padding: '24px 28px' }}>
                                    <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 10 }}>Details</div>
                                    {docsForRecord[selectedDocIndex] ? (
                                        <>
                                            <div style={{ fontSize: 15, marginBottom: 4 }}><b>File name</b> : {docsForRecord[selectedDocIndex].file_name}</div>
                                            <div style={{ fontSize: 15, marginBottom: 4 }}><b>File size</b> : {docsForRecord[selectedDocIndex].file_size ? `${Math.round(docsForRecord[selectedDocIndex].file_size / 1024)} KB` : '—'}</div>
                                            <div style={{ fontSize: 15, marginBottom: 4 }}><b>Date upload</b> : {docsForRecord[selectedDocIndex].upload_time ? new Date(docsForRecord[selectedDocIndex].upload_time).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</div>
                                            <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                                                <button className="cancel-btn" style={{ minWidth: 90, border: '1.5px solid #111', background: '#fff', color: '#111', borderRadius: 8, fontWeight: 500, fontSize: 15, padding: '7px 0', cursor: 'pointer' }} onClick={() => alert('Delete not implemented')}>DELETE</button>
                                                <button className="update-status-btn" style={{ minWidth: 90, background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 500, fontSize: 15, padding: '7px 0', cursor: 'pointer' }} onClick={handlePhotoUpload} disabled={isUploading}>
                                                    {isUploading ? 'Uploading...' : 'UPLOAD'}
                                                </button>
                                            </div>
                                            {uploadError && <div style={{ color: 'red', fontSize: 13, marginTop: 4 }}>{uploadError}</div>}
                                        </>
                                    ) : (
                                        <>
                                            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>No images yet</div>
                                            <button className="update-status-btn" style={{ minWidth: 90, background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 500, fontSize: 15, padding: '7px 0', cursor: 'pointer' }} onClick={handlePhotoUpload} disabled={isUploading}>
                                                {isUploading ? 'Uploading...' : 'UPLOAD'}
                                            </button>
                                            {uploadError && <div style={{ color: 'red', fontSize: 13, marginTop: 4 }}>{uploadError}</div>}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TechRSBSAPage;
