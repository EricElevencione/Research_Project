import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import { getRsbsaSubmissions, getRsbsaSubmissionById, getFarmParcels, deleteRsbsaSubmission, updateRsbsaSubmission, updateFarmParcel } from '../../api';
import '../../assets/css/jo css/JoMasterlistStyle.css';
import '../../assets/css/jo css/FarmerDetailModal.css';
import '../../components/layout/sidebarStyle.css';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import MasterlistIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';
import LandRecsIcon from '../../assets/images/landrecord.png';

interface RSBSARecord {
  id: string;
  referenceNumber: string;
  farmerName: string;
  farmerAddress: string;
  farmLocation: string;
  parcelArea: string;
  dateSubmitted: string;
  status: string;
  landParcel: string;
  ownershipType?: {
    registeredOwner: boolean;
    tenant: boolean;
    lessee: boolean;
  };
}

interface Parcel {
  id: string;
  parcel_number: string;
  farm_location_barangay: string;
  farm_location_municipality: string;
  total_farm_area_ha: number;
  within_ancestral_domain: string;
  ownership_document_no: string;
  agrarian_reform_beneficiary: string;
  ownership_type_registered_owner: boolean;
  ownership_type_tenant: boolean;
  ownership_type_lessee: boolean;
  tenant_land_owner_name: string;
  lessee_land_owner_name: string;
  ownership_others_specify: string;
}

interface FarmerDetail {
  id: string;
  farmerName: string;
  farmerAddress: string;
  age: number | string;
  gender: string;
  mainLivelihood: string;
  farmingActivities: string[];
  parcels: ParcelDetail[];
}

interface ParcelDetail {
  id: string;
  parcelNumber: string;
  farmLocationBarangay: string;
  farmLocationMunicipality: string;
  totalFarmAreaHa: number;
  ownershipTypeRegisteredOwner: boolean;
  ownershipTypeTenant: boolean;
  ownershipTypeLessee: boolean;
  tenantLandOwnerName: string;
  lesseeLandOwnerName: string;
}

const JoMasterlist: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // List of barangays in Dumangas
  const barangays = [
    "Aurora-Del Pilar",
    "Bacay",
    "Bacong",
    "Balabag",
    "Balud",
    "Bantud",
    "Bantud Fabrica",
    "Baras",
    "Barasan",
    "Basa-Mabini Bonifacio",
    "Bolilao",
    "Buenaflor Embarkadero",
    "Burgos-Regidor",
    "Calao",
    "Cali",
    "Cansilayan",
    "Capaliz",
    "Cayos",
    "Compayan",
    "Dacutan",
    "Ermita",
    "Ilaya 1st",
    "Ilaya 2nd",
    "Ilaya 3rd",
    "Jardin",
    "Lacturan",
    "Lopez Jaena - Rizal",
    "Managuit",
    "Maquina",
    "Nanding Lopez",
    "Pagdugue",
    "Paloc Bigque",
    "Paloc Sool",
    "Patlad",
    "Pd Monfort North",
    "Pd Monfort South",
    "Pulao",
    "Rosario",
    "Sapao",
    "Sulangan",
    "Tabucan",
    "Talusan",
    "Tambobo",
    "Tamboilan",
    "Victorias"
  ].sort();

  const [rsbsaRecords, setRsbsaRecords] = useState<RSBSARecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedFarmer, setSelectedFarmer] = useState<FarmerDetail | null>(null);
  const [loadingFarmerDetail, setLoadingFarmerDetail] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [editingRecord, setEditingRecord] = useState<RSBSARecord | null>(null);
  type EditForm = Partial<RSBSARecord> & { firstName?: string; middleName?: string; lastName?: string; barangay?: string; municipality?: string };
  const [editFormData, setEditFormData] = useState<EditForm>({});
  const [editingParcels, setEditingParcels] = useState<Parcel[]>([]);
  const [loadingParcels, setLoadingParcels] = useState(false);
  const [parcelErrors, setParcelErrors] = useState<Record<string, string>>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  const isActive = (path: string) => location.pathname === path;

  const handleDelete = async (id: string) => {
    try {
      // First, check if this farmer is referenced as a land owner by any tenants/lessees
      // Note: This endpoint is not available in Supabase, returning empty data
      const referencesResponse = { data: { hasReferences: false, tenants: [], lessees: [] }, error: null };

      let confirmMessage = 'Are you sure you want to delete this record? This action cannot be undone.';

      if (!referencesResponse.error) {
        const referencesData = referencesResponse.data;

        if (referencesData.hasReferences) {
          // Build a detailed warning message
          const tenantCount = referencesData.tenants?.length || 0;
          const lesseeCount = referencesData.lessees?.length || 0;

          let affectedList = '';

          if (tenantCount > 0) {
            const tenantNames = referencesData.tenants
              .slice(0, 5) // Show max 5 names
              .map((t: any) => t.tenantName)
              .join(', ');
            affectedList += `\n\n👤 Tenants (${tenantCount}): ${tenantNames}${tenantCount > 5 ? '...' : ''}`;
          }

          if (lesseeCount > 0) {
            const lesseeNames = referencesData.lessees
              .slice(0, 5) // Show max 5 names
              .map((l: any) => l.lesseeName)
              .join(', ');
            affectedList += `\n\n👤 Lessees (${lesseeCount}): ${lesseeNames}${lesseeCount > 5 ? '...' : ''}`;
          }

          confirmMessage = `⚠️ WARNING: This farmer "${referencesData.farmerName}" is listed as the LAND OWNER for ${referencesData.totalReferences} tenant/lessee record(s).${affectedList}\n\nIf you delete this farmer, their land owner references will be cleared (set to empty).\n\nAre you sure you want to proceed?`;
        }
      }

      if (!window.confirm(confirmMessage)) {
        return;
      }

      const response = await deleteRsbsaSubmission(id);

      if (response.error) {
        throw new Error(`Failed to delete record: ${response.error}`);
      }

      const deleteResult = response.data;

      // Show success message with details about affected records
      let successMessage = 'Record deleted successfully.';
      if (deleteResult.landOwnerImpact) {
        const { tenantsAffected, lesseesAffected } = deleteResult.landOwnerImpact;
        successMessage += `\n\nLand owner references cleared:\n- ${tenantsAffected} tenant(s)\n- ${lesseesAffected} lessee(s)`;
      }

      alert(successMessage);

      // Remove the deleted record from the local state
      setRsbsaRecords(prev => prev.filter(record => record.id !== id));
    } catch (err: any) {
      console.error('Error deleting record:', err);
      alert(`Failed to delete record: ${err.message}`);
    }
  };

  // Fetch farmer details when row is clicked
  const fetchFarmerDetails = async (farmerId: string) => {
    try {
      setLoadingFarmerDetail(true);

      // Fetch basic farmer info
      const farmerResponse = await getRsbsaSubmissionById(farmerId);
      if (farmerResponse.error) throw new Error('Failed to fetch farmer details');
      const farmerData = farmerResponse.data;

      // Fetch parcels
      const parcelsResponse = await getFarmParcels(farmerId);
      if (parcelsResponse.error) throw new Error('Failed to fetch parcels');
      const parcelsData = parcelsResponse.data || [];

      // Handle both JSONB (data property) and structured column formats
      const data = farmerData.data || farmerData;

      // Parse farming activities from the data
      const activities: string[] = [];

      // Check for farming activities in various possible field names
      if (data.farmerRice || data.FARMER_RICE || data.farmer_rice) activities.push('Rice');
      if (data.farmerCorn || data.FARMER_CORN || data.farmer_corn) activities.push('Corn');
      if (data.farmerOtherCrops || data.FARMER_OTHER_CROPS || data.farmer_other_crops) {
        activities.push(`Other Crops: ${data.farmerOtherCropsText || data.FARMER_OTHER_CROPS_TEXT || data.farmer_other_crops_text || ''}`);
      }
      if (data.farmerLivestock || data.FARMER_LIVESTOCK || data.farmer_livestock) {
        activities.push(`Livestock: ${data.farmerLivestockText || data.FARMER_LIVESTOCK_TEXT || data.farmer_livestock_text || ''}`);
      }
      if (data.farmerPoultry || data.FARMER_POULTRY || data.farmer_poultry) {
        activities.push(`Poultry: ${data.farmerPoultryText || data.FARMER_POULTRY_TEXT || data.farmer_poultry_text || ''}`);
      }

      // If no activities found, check if mainLivelihood indicates farming type
      if (activities.length === 0) {
        if (data.mainLivelihood || data['MAIN LIVELIHOOD'] || data.main_livelihood) {
          activities.push(data.mainLivelihood || data['MAIN LIVELIHOOD'] || data.main_livelihood);
        }
      } const calculateAge = (birthdate: string): number | string => {
        if (!birthdate || birthdate === 'N/A') return 'N/A';
        const today = new Date();
        const birthDate = new Date(birthdate);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        return age;
      };

      // Reformat the farmer name from "Last, First, Middle, Ext" to "Last, First Middle Ext"
      const backendName = farmerData.farmerName || '';
      const reformattedFarmerName = (() => {
        if (!backendName || backendName === 'N/A') return 'N/A';
        const parts = backendName.split(',').map((p: string) => p.trim()).filter(Boolean);
        if (parts.length === 0) return 'N/A';
        if (parts.length === 1) return parts[0]; // Just last name
        // Join all parts after the first with spaces (First Middle Ext)
        const lastName = parts[0];
        const restOfName = parts.slice(1).join(' ');
        return `${lastName}, ${restOfName}`;
      })();

      const farmerDetail: FarmerDetail = {
        id: farmerId,
        farmerName: reformattedFarmerName,
        farmerAddress: farmerData.farmerAddress || 'N/A',
        age: calculateAge(data.dateOfBirth || data.birthdate || 'N/A'),
        gender: data.gender || 'N/A',
        mainLivelihood: data.mainLivelihood || 'N/A',
        farmingActivities: activities,
        parcels: parcelsData.map((p: any) => ({
          id: p.id,
          parcelNumber: p.parcel_number || 'N/A',
          farmLocationBarangay: p.farm_location_barangay || 'N/A',
          farmLocationMunicipality: p.farm_location_municipality || 'N/A',
          totalFarmAreaHa: parseFloat(p.total_farm_area_ha) || 0,
          ownershipTypeRegisteredOwner: p.ownership_type_registered_owner || false,
          ownershipTypeTenant: p.ownership_type_tenant || false,
          ownershipTypeLessee: p.ownership_type_lessee || false,
          tenantLandOwnerName: p.tenant_land_owner_name || '',
          lesseeLandOwnerName: p.lessee_land_owner_name || ''
        }))
      };

      setSelectedFarmer(farmerDetail);
      setShowModal(true);
    } catch (err: any) {
      console.error('Error fetching farmer details:', err);
      alert('Failed to load farmer details');
    } finally {
      setLoadingFarmerDetail(false);
    }
  };

  useEffect(() => {
    fetchRSBSARecords();
  }, []);

  const fetchRSBSARecords = async () => {
    try {
      const response = await getRsbsaSubmissions();
      if (response.error) throw new Error(response.error);
      const data = response.data || [];

      // Filter out farmers with 'No Parcels' status
      const filteredData = (Array.isArray(data) ? data : []).filter((item: any) => {
        const status = String(item.status ?? '').toLowerCase().trim();
        return status !== 'no parcels';
      });

      const formattedRecords: RSBSARecord[] = filteredData.map((item: any, idx: number) => {
        // Prefer backend-transformed fields; fallback to raw

        const referenceNumber = String(item.referenceNumber ?? `RSBSA-${idx + 1}`);
        // Backend returns farmerName as "Last, First, Middle, Ext"
        // Convert it to "Last, First Middle Ext" (comma after last name only)
        const backendName = item.farmerName || '';
        const reformattedName = (() => {
          if (!backendName || backendName === '—') return '—';
          const parts = backendName.split(',').map((p: string) => p.trim()).filter(Boolean);
          if (parts.length === 0) return '—';
          if (parts.length === 1) return parts[0]; // Just last name
          // Join all parts after the first with spaces (First Middle Ext)
          const lastName = parts[0];
          const restOfName = parts.slice(1).join(' ');
          return `${lastName}, ${restOfName}`;
        })();
        const farmerName = String(reformattedName);
        const farmerAddress = String(item.farmerAddress ?? item.addressBarangay ?? '—');
        const farmLocation = String(item.farmLocation ?? '—');
        const landParcel = String(item.landParcel ?? '—');
        const parcelArea = (() => {
          const direct = item.parcelArea ?? item["PARCEL AREA"];
          if (direct !== undefined && direct !== null && String(direct).trim() !== '') {
            return String(direct);
          }
          // Fallback: parse from landParcel string e.g., "... (1.25 ha)"
          const match = /\(([^)]+)\)/.exec(landParcel);
          return match ? match[1] : '—';
        })();
        const dateSubmitted = item.dateSubmitted
          ? new Date(item.dateSubmitted).toISOString()
          : (item.createdAt ? new Date(item.createdAt).toISOString() : '');

        // Reflect database status semantics: Submitted / Not Submitted
        const status = String(item.status ?? 'Not Submitted');

        return {
          id: String(item.id), // Use the actual database ID
          referenceNumber,
          farmerName,
          farmerAddress,
          farmLocation,
          parcelArea,
          dateSubmitted,
          status,
          landParcel,
          ownershipType: item.ownershipType
        };
      });

      setRsbsaRecords(formattedRecords);
      setLoading(false);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load RSBSA records');
      setLoading(false);
    }
  };

  const filteredRecords = rsbsaRecords.filter(record => {
    // Normalize status to handle casing/spacing differences and map to active groups
    const normalizedStatus = (record.status || '').toLowerCase().trim();

    // Active statuses: Submitted, Active Farmer, Approved
    const activeStatuses = new Set(['submitted', 'approved', 'active', 'active farmer']);

    // Not Active statuses: Not Submitted, Not Active, Draft, Pending
    const notActiveStatuses = new Set(['not submitted', 'not_active', 'not active', 'draft', 'pending', 'not approved', 'inactive']);

    let matchesStatus = true;
    if (selectedStatus === 'active') {
      matchesStatus = activeStatuses.has(normalizedStatus);
    } else if (selectedStatus === 'notActive') {
      matchesStatus = notActiveStatuses.has(normalizedStatus);
    }

    const q = searchQuery.toLowerCase();
    const matchesSearch = record.farmerName.toLowerCase().includes(q) ||
      record.referenceNumber.toLowerCase().includes(q) ||
      record.farmerAddress.toLowerCase().includes(q) ||
      record.farmLocation.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const formatDate = (iso: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return '—';
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Submitted': return 'status-approved';
      case 'Not Submitted': return 'status-not-approved';
      default: return 'status-pending';
    }
  };

  const closeMenu = () => {
    setOpenMenuId(null);
    setMenuPosition(null);
  };

  const handleCancel = () => {
    setEditingRecord(null);
    setEditFormData({});
    setEditingParcels([]);
    setParcelErrors({});
  };

  const parseName = (fullName: string): { lastName: string; firstName: string; middleName: string } => {
    if (!fullName) return { lastName: '', firstName: '', middleName: '' };
    const parts = fullName.split(',').map(p => p.trim()).filter(Boolean);

    if (parts.length === 0) {
      return { lastName: '', firstName: '', middleName: '' };
    }
    if (parts.length === 1) {
      return { lastName: parts[0] || '', firstName: '', middleName: '' };
    }

    // parts.length >= 2: format is "LastName, FirstName MiddleName"
    const [last, firstMiddle] = parts;
    const firstMiddleParts = (firstMiddle || '').split(' ').map(p => p.trim()).filter(Boolean);

    return {
      lastName: last || '',
      firstName: firstMiddleParts[0] || '',
      middleName: firstMiddleParts.slice(1).join(' ') || ''
    };
  };

  const parseAddress = (address: string): { barangay: string; municipality: string } => {
    if (!address) return { barangay: '', municipality: '' };
    const parts = address.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length === 0) return { barangay: '', municipality: '' };
    if (parts.length === 1) return { barangay: parts[0] || '', municipality: '' };
    return { barangay: parts[0] || '', municipality: parts[1] || '' };
  };

  const handleEdit = async (recordId: string) => {
    const recordToEdit = rsbsaRecords.find(record => record.id === recordId);
    if (recordToEdit) {
      const { lastName, firstName, middleName } = parseName(recordToEdit.farmerName || '');
      const { barangay, municipality } = parseAddress(recordToEdit.farmerAddress || '');
      setEditingRecord(recordToEdit);
      setEditFormData({
        farmerName: recordToEdit.farmerName,
        firstName,
        middleName,
        lastName,
        farmerAddress: recordToEdit.farmerAddress,
        barangay,
        municipality,
        farmLocation: recordToEdit.farmLocation,
        landParcel: recordToEdit.landParcel,
        dateSubmitted: recordToEdit.dateSubmitted,
        parcelArea: extractParcelAreaNumber(recordToEdit.parcelArea || '')
      });

      // Fetch individual parcels for this submission
      setLoadingParcels(true);
      setParcelErrors({}); // Clear any previous errors
      try {
        const response = await getFarmParcels(recordId);
        if (!response.error) {
          const parcels = response.data || [];
          setEditingParcels(parcels);
        } else {
          console.error('Failed to fetch parcels');
          setEditingParcels([]);
        }
      } catch (error) {
        console.error('Error fetching parcels:', error);
        setEditingParcels([]);
      } finally {
        setLoadingParcels(false);
      }
    }
    closeMenu();
  };

  const extractParcelAreaNumber = (value: string): string => {
    if (!value) return '';
    // If it contains "hectares", extract just the number part
    if (value.includes('hectares')) {
      return value.replace(/\s*hectares\s*$/i, '').trim();
    }
    return value;
  };

  /**
   * Toggles the menu for a given record ID.
   * If the menu is already open for the given ID, it will close the menu.
   * If the menu is not open for the given ID, it will open the menu at the position of the triggering element.
   * @param {string} id - The ID of the record to toggle the menu for.
   * @param {React.MouseEvent<HTMLButtonElement>} event - The event that triggered the toggle menu action.
   */
  const toggleMenu = (id: string, event: React.MouseEvent<HTMLButtonElement>) => {
    if (openMenuId === id) {
      setOpenMenuId(null);
      setMenuPosition(null);
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.right + window.scrollX - 160 // 160px is min-width of menu
      });
      setOpenMenuId(id);
    }
  };

  const handleInputChange = (field: keyof RSBSARecord | 'firstName' | 'middleName' | 'lastName' | 'barangay' | 'municipality', value: string) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleIndividualParcelChange = (parcelId: string, field: keyof Parcel, value: any) => {
    // Validate if the field is total_farm_area_ha
    if (field === 'total_farm_area_ha') {
      const valueStr = String(value).trim();

      // Check if empty
      if (valueStr === '') {
        setParcelErrors(prev => ({
          ...prev,
          [parcelId]: 'Parcel area is required'
        }));
        setEditingParcels(prev =>
          prev.map(parcel =>
            parcel.id === parcelId
              ? { ...parcel, [field]: 0 }
              : parcel
          )
        );
        return;
      }

      // Check if it's a valid number
      const numValue = parseFloat(valueStr);
      if (isNaN(numValue)) {
        setParcelErrors(prev => ({
          ...prev,
          [parcelId]: 'Parcel area must be a valid number'
        }));
        return;
      }

      // Check if it's positive
      if (numValue <= 0) {
        setParcelErrors(prev => ({
          ...prev,
          [parcelId]: 'Parcel area must be greater than 0'
        }));
        setEditingParcels(prev =>
          prev.map(parcel =>
            parcel.id === parcelId
              ? { ...parcel, [field]: numValue }
              : parcel
          )
        );
        return;
      }

      // Valid input - clear error
      setParcelErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[parcelId];
        return newErrors;
      });

      setEditingParcels(prev =>
        prev.map(parcel =>
          parcel.id === parcelId
            ? { ...parcel, [field]: numValue }
            : parcel
        )
      );
    } else {
      // For other fields, just update without validation
      setEditingParcels(prev =>
        prev.map(parcel =>
          parcel.id === parcelId
            ? { ...parcel, [field]: value }
            : parcel
        )
      );
    }
  }; const handleSave = async () => {
    if (editingRecord && editFormData) {
      try {
        // Validate all parcels before saving
        if (editingParcels.length > 0) {
          let hasErrors = false;
          const newErrors: Record<string, string> = {};

          editingParcels.forEach(parcel => {
            if (!parcel.total_farm_area_ha || parcel.total_farm_area_ha <= 0) {
              hasErrors = true;
              newErrors[parcel.id] = 'Parcel area must be a valid positive number';
            }
          });

          if (hasErrors) {
            setParcelErrors(newErrors);
            setError('Please fix all parcel area errors before saving');
            return;
          }
        }

        // Start with the existing record data
        const existingData = {
          farmerName: editingRecord.farmerName,
          farmerAddress: editingRecord.farmerAddress,
          farmLocation: editingRecord.farmLocation,
          parcelArea: editingRecord.parcelArea
        };

        // Compose farmerName from discrete name fields (Last, First Middle)
        const composedFarmerName = (() => {
          const last = (editFormData.lastName ?? '').trim();
          const first = (editFormData.firstName ?? '').trim();
          const middle = (editFormData.middleName ?? '').trim();

          // Combine first and middle with space
          const firstMiddle = [first, middle].filter(Boolean).join(' ');

          // Combine last name with firstMiddle using comma
          const parts: string[] = [];
          if (last) parts.push(last);
          if (firstMiddle) parts.push(firstMiddle);

          return parts.length > 0 ? parts.join(', ') : (editFormData.farmerName ?? editingRecord.farmerName);
        })();

        // Compose address from barangay and municipality if provided
        const composedAddress = (() => {
          const b = (editFormData.barangay ?? '').trim();
          const m = (editFormData.municipality ?? '').trim();
          if (b && m) return `${b}, ${m}`;
          if (b) return b;
          if (m) return m;
          return editFormData.farmerAddress ?? editingRecord.farmerAddress;
        })();

        // Calculate new parcel area string from individual parcels
        const newParcelAreaString = editingParcels.length > 0
          ? editingParcels.map(p => p.total_farm_area_ha).join(', ')
          : editFormData.parcelArea;

        // Format the data for submission
        const formattedData = {
          ...existingData,
          ...editFormData,
          farmerName: composedFarmerName,
          farmerAddress: composedAddress,
          // Use the calculated parcel area string from individual parcels
          parcelArea: newParcelAreaString,
        };

        // Remove any undefined or empty values
        // Also send discrete name fields if present to align with backend columns
        const withNameFields: Record<string, any> = {
          ...formattedData,
          firstName: editFormData.firstName,
          middleName: editFormData.middleName,
          surname: editFormData.lastName,
          addressBarangay: editFormData.barangay,
          addressMunicipality: editFormData.municipality,
        };

        const cleanedData = Object.entries(withNameFields)
          .reduce((acc, [key, value]) => {
            if (value !== undefined && value !== '') {
              acc[key] = value;
            }
            return acc;
          }, {} as Record<string, any>);

        // Update the record in the database
        const response = await updateRsbsaSubmission(editingRecord.id, cleanedData);

        if (response.error) {
          throw new Error(response.error || `HTTP error!`);
        }

        const updatedRecord = response.data;

        // Update individual parcels if they were edited
        if (editingParcels.length > 0) {
          for (const parcel of editingParcels) {
            try {
              const parcelResponse = await updateFarmParcel(parcel.id, {
                total_farm_area_ha: parcel.total_farm_area_ha,
                farm_location_barangay: parcel.farm_location_barangay,
                farm_location_municipality: parcel.farm_location_municipality,
                within_ancestral_domain: parcel.within_ancestral_domain,
                ownership_document_no: parcel.ownership_document_no,
                agrarian_reform_beneficiary: parcel.agrarian_reform_beneficiary,
                ownership_type_registered_owner: parcel.ownership_type_registered_owner,
                ownership_type_tenant: parcel.ownership_type_tenant,
                ownership_type_lessee: parcel.ownership_type_lessee,
                tenant_land_owner_name: parcel.tenant_land_owner_name,
                lessee_land_owner_name: parcel.lessee_land_owner_name,
                ownership_others_specify: parcel.ownership_others_specify,
              });

              if (parcelResponse.error) {
                console.error(`Failed to update parcel ${parcel.id}`);
              }
            } catch (error) {
              console.error(`Error updating parcel ${parcel.id}:`, error);
            }
          }
        }

        // Update the local state with the response from the server
        const updatedRecordData = {
          ...editingRecord,
          ...formattedData,
          // Use any additional fields returned from the server
          ...updatedRecord.updatedRecord
        };

        // Update the main rsbsaRecords state
        setRsbsaRecords(prev =>
          prev.map(record =>
            record.id === editingRecord.id
              ? updatedRecordData
              : record
          )
        );

        // Close edit mode
        setEditingRecord(null);
        setEditFormData({});
        setEditingParcels([]);
        setParcelErrors({});
        setError(null); // Clear any error messages

        // Show success message (optional)
        console.log('Record updated successfully');
      } catch (error) {
        console.error('Error updating record:', error);
        setError('Failed to update record. Please try again.');
      }
    }
  };

  return (
    <div className="jo-masterlist-page-container">
      <div className="jo-masterlist-page">
        {/* Sidebar starts here */}
        <div className="sidebar">
          <nav className="sidebar-nav">
            <div className='sidebar-logo'>
              <img src={LogoImage} alt="Logo" />
            </div>

            <button
              className={`sidebar-nav-item ${isActive('/jo-dashboard') ? 'active' : ''}`}
              onClick={() => navigate('/jo-dashboard')}
            >
              <span className="nav-icon">
                <img src={HomeIcon} alt="Home" />
              </span>
              <span className="nav-text">Home</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive('/jo-rsbsapage') ? 'active' : ''}`}
              onClick={() => navigate('/jo-rsbsapage')}
            >
              <span className="nav-icon">
                <img src={RSBSAIcon} alt="RSBSA" />
              </span>
              <span className="nav-text">RSBSA</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive('/jo-incentives') ? 'active' : ''}`}
              onClick={() => navigate('/jo-incentives')}
            >
              <span className="nav-icon">
                <img src={IncentivesIcon} alt="Incentives" />
              </span>
              <span className="nav-text">Incentives</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive('/jo-masterlist') ? 'active' : ''}`}
              onClick={() => navigate('/jo-masterlist')}
            >
              <span className="nav-icon">
                <img src={MasterlistIcon} alt="Masterlist" />
              </span>
              <span className="nav-text">Masterlist</span>
            </button>

            <div
              className={`sidebar-nav-item ${isActive('/jo-gap-analysis') ? 'active' : ''}`}
              onClick={() => navigate('/jo-gap-analysis')}
            >
              <div className="nav-icon">📊</div>
              <span className="nav-text">Gap Analysis</span>
            </div>

            <div
              className={`sidebar-nav-item ${isActive('/jo-distribution') ? 'active' : ''}`}
              onClick={() => navigate('/jo-distribution')}
            >
              <div className="nav-icon">🚚</div>
              <span className="nav-text">Distribution Log</span>
            </div>

            <button
              className="sidebar-nav-item logout"
              onClick={() => navigate('/')}
            >
              <span className="nav-icon">
                <img src={LogoutIcon} alt="Logout" />
              </span>
              <span className="nav-text">Logout</span>
            </button>

          </nav>
        </div>
        {/* Sidebar ends here */}

        {/* Main content starts here */}
        <div className="jo-masterlist-main-content">
          <div className="jo-masterlist-dashboard-header">
            <div>
              <h2 className="jo-masterlist-page-title">Masterlist</h2>
              <p className="jo-masterlist-page-subtitle">Browse all RSBSA farmers, filter by status, and manage records</p>
            </div>
          </div>

          <div className="jo-masterlist-content-card">
            {/* Filters and Search */}
            <div className="jo-masterlist-filters-section">
              <div className="jo-masterlist-search-filter">
                <input
                  type="text"
                  placeholder="Search by farmer name, reference number, or barangay..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="jo-masterlist-search-input"
                />
              </div>

              <div className="jo-masterlist-status-filter">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="jo-masterlist-status-select"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="notActive">Not Active</option>
                </select>
              </div>

              {/* <div className="refresh-filter">
                <button
                  onClick={() => {
                    setLoading(true);
                    setError(null);
                    fetchRSBSARecords();
                  }}
                  className="refresh-button"
                  title="Refresh data"
                >
                  Refresh
                </button>
              </div> */}
            </div>

            {/* RSBSA Records Table */}
            <div className="jo-masterlist-table-container">
              <table className="jo-masterlist-farmers-table">
                <thead>
                  <tr>
                    {[
                      'FFRS System Generated',
                      'Farmer Name',
                      'Farmer Address',
                      'Parcel Address',
                      'Parcel Area',
                      'Date Submitted',
                      'Status',
                      'Actions'
                    ].map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={8} className="jo-masterlist-loading-cell">Loading...</td></tr>
                  )}

                  {error && !loading && (
                    <tr><td colSpan={8} className="jo-masterlist-error-cell">Error: {error}</td></tr>
                  )}

                  {!loading && !error && filteredRecords.length > 0 && (
                    filteredRecords.map((record) => {
                      return (
                        <tr
                          key={record.id}
                          className="jo-masterlist-clickable-row"
                          onClick={() => fetchFarmerDetails(record.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>{record.referenceNumber}</td>
                          <td>{record.farmerName}</td>
                          <td>{record.farmerAddress}</td>
                          <td>{record.farmLocation}</td>
                          <td>{record.parcelArea}</td>
                          <td>{formatDate(record.dateSubmitted)}</td>
                          <td>
                            <span className={`jo-masterlist-status-pill jo-masterlist-${getStatusClass(record.status)}`}>
                              {record.status}
                              {/* {record.totalFarmArea || 'N/A'}*/}
                            </span>
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <button
                                className="jo-masterlist-more-button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleMenu(record.id, e);
                                }}
                                aria-haspopup="true"
                                aria-expanded={openMenuId === record.id}
                                title="More actions"
                              >
                                ...
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}

                  {!loading && !error && filteredRecords.length === 0 && (
                    Array.from({ length: 16 }).map((_, i) => (
                      <tr key={`empty-${i}`}>
                        <td colSpan={8}>&nbsp;</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {/* Global dropdown/menu for row actions */}
          {openMenuId && menuPosition && (
            <div
              className="jo-masterlist-more-menu"
              style={{
                position: 'absolute',
                top: menuPosition.top,
                left: menuPosition.left
              }}
              role="menu"
            >
              <button
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  padding: '8px 10px',
                  cursor: 'pointer'
                }}
                onClick={() => handleEdit(openMenuId)}
                role="menuitem"
              >
                Edit
              </button>
              <button
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  padding: '8px 10px',
                  cursor: 'pointer',
                  color: '#d32f2f'
                }}
                onClick={() => { handleDelete(openMenuId); closeMenu(); }}
                role="menuitem"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {/* Edit Modal */}
        {editingRecord && (
          <div className="jo-masterlist-edit-modal-overlay">
            <div className="jo-masterlist-edit-modal">
              <div className="jo-masterlist-edit-modal-header">
                <h3>Edit Land Owner Information</h3>
                <button className="jo-masterlist-close-button" onClick={handleCancel}>×</button>
              </div>
              <div className="jo-masterlist-edit-modal-body">
                <div className="form-group">
                  <label>Last Name:</label>
                  <input
                    type="text"
                    value={editFormData.lastName || ''}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    placeholder="Last Name"
                  />
                </div>
                {/*Gender function kung may jan*/}
                {/*Birthdate function kung may jan*/}
                <div className="form-group">
                  <label>First Name:</label>
                  <input
                    type="text"
                    value={editFormData.firstName || ''}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    placeholder="First Name"
                  />
                </div>
                <div className="form-group">
                  <label>Middle Name:</label>
                  <input
                    type="text"
                    value={editFormData.middleName || ''}
                    onChange={(e) => handleInputChange('middleName', e.target.value)}
                    placeholder="Middle Name"
                  />
                </div>
                {/*Barangay function kung may jan*/}
                <div className="form-group">
                  <label>Barangay:</label>
                  <select
                    value={editFormData.barangay || ''}
                    onChange={(e) => handleInputChange('barangay', e.target.value)}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                  >
                    <option value="">Select Barangay</option>
                    {barangays.map((barangay) => (
                      <option key={barangay} value={barangay}>
                        {barangay}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="jo-masterlist-form-group">
                  <label>Municipality:</label>
                  <input
                    type="text"
                    value={editFormData.municipality || ''}
                    onChange={(e) => handleInputChange('municipality', e.target.value)}
                    placeholder="Municipality"
                  />
                </div>

                {/* Individual Parcel Areas */}
                <div className="jo-masterlist-parcel-section">
                  <h4>Parcel Areas</h4>
                  {loadingParcels ? (
                    <p>Loading parcels...</p>
                  ) : editingParcels.length > 0 ? (
                    editingParcels.map((parcel, index) => (
                      <div
                        key={parcel.id}
                        className={`jo-masterlist-parcel-item ${parcelErrors[parcel.id] ? 'error' : ''}`}
                      >
                        <div className="jo-masterlist-form-group">
                          <label style={{ fontWeight: 'bold', color: '#2c5f2d' }}>
                            Parcel Area {index + 1} (Parcel No. {parcel.parcel_number}):
                          </label>
                          <input
                            type="text"
                            value={parcel.total_farm_area_ha || ''}
                            onChange={(e) => handleIndividualParcelChange(parcel.id, 'total_farm_area_ha', e.target.value)}
                            placeholder="e.g., 2.5"
                            style={{
                              width: '100%',
                              border: parcelErrors[parcel.id] ? '2px solid #d32f2f' : '1px solid #ccc',
                              backgroundColor: parcelErrors[parcel.id] ? '#ffebee' : 'white',
                              outline: parcelErrors[parcel.id] ? 'none' : undefined
                            }}
                          />
                          {parcelErrors[parcel.id] && (
                            <small className="jo-masterlist-parcel-error">
                              {parcelErrors[parcel.id]}
                            </small>
                          )}
                          <small style={{ color: '#666', fontSize: '0.85em', display: 'block', marginTop: '5px' }}>
                            Location: {parcel.farm_location_barangay || 'N/A'}
                          </small>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: '#666', fontStyle: 'italic' }}>No parcels found for this farmer.</p>
                  )}
                </div>
              </div>
              <div className="jo-masterlist-edit-modal-footer">
                <button className="jo-masterlist-cancel-button" onClick={handleCancel}>Cancel</button>
                <button className="jo-masterlist-save-button" onClick={handleSave}>Save Changes</button>
              </div>
            </div>
          </div>
        )}

        {/* Farmer Detail Modal */}
        {showModal && selectedFarmer && (
          <div className="farmer-modal-overlay" onClick={() => setShowModal(false)}>
            <div className="farmer-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="farmer-modal-header">
                <h2>Farmer Details</h2>
                <button className="farmer-modal-close" onClick={() => setShowModal(false)}>×</button>
              </div>

              <div className="farmer-modal-body">
                {loadingFarmerDetail ? (
                  <div className="farmer-modal-loading">Loading farmer details...</div>
                ) : (
                  <>
                    {/* Personal Information */}
                    <div className="farmer-modal-section">
                      <h3 className="farmer-modal-section-title">👤 Personal Information</h3>
                      <div className="farmer-modal-info-grid">
                        <div className="farmer-modal-info-item">
                          <span className="farmer-modal-label">Farmer Name:</span>
                          <span className="farmer-modal-value">{selectedFarmer.farmerName}</span>
                        </div>
                        <div className="farmer-modal-info-item">
                          <span className="farmer-modal-label">Farmer Address:</span>
                          <span className="farmer-modal-value">{selectedFarmer.farmerAddress}</span>
                        </div>
                        <div className="farmer-modal-info-item">
                          <span className="farmer-modal-label">Age:</span>
                          <span className="farmer-modal-value">
                            {typeof selectedFarmer.age === 'number' ? `${selectedFarmer.age} years old` : selectedFarmer.age}
                          </span>
                        </div>
                        <div className="farmer-modal-info-item">
                          <span className="farmer-modal-label">Gender:</span>
                          <span className="farmer-modal-value">{selectedFarmer.gender}</span>
                        </div>
                        <div className="farmer-modal-info-item farmer-modal-full-width">
                          <span className="farmer-modal-label">Main Livelihood:</span>
                          <span className="farmer-modal-value">
                            {selectedFarmer.farmingActivities.length > 0
                              ? selectedFarmer.farmingActivities.join(', ')
                              : 'Not Available'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Farm Information */}
                    <div className="farmer-modal-section">
                      <h3 className="farmer-modal-section-title">🌾 Farm Information</h3>
                      {selectedFarmer.parcels.length === 0 ? (
                        <p className="farmer-modal-no-data">No parcels found</p>
                      ) : (
                        <div className="farmer-modal-parcels-container">
                          {selectedFarmer.parcels.map((parcel, index) => (
                            <div key={parcel.id} className="farmer-modal-parcel-card">
                              <div className="farmer-modal-parcel-header">
                                <h4>Parcel #{parcel.parcelNumber}</h4>
                              </div>
                              <div className="farmer-modal-parcel-details">
                                <div className="farmer-modal-parcel-item">
                                  <span className="farmer-modal-label">Land Ownership:</span>
                                  <span className="farmer-modal-value">
                                    {parcel.ownershipTypeRegisteredOwner && 'Registered Owner'}
                                    {parcel.ownershipTypeTenant && (
                                      <>
                                        Tenant
                                        {parcel.tenantLandOwnerName && (
                                          <span className="farmer-modal-owner-name">
                                            {' '}(Owner: {parcel.tenantLandOwnerName})
                                          </span>
                                        )}
                                      </>
                                    )}
                                    {parcel.ownershipTypeLessee && (
                                      <>
                                        Lessee
                                        {parcel.lesseeLandOwnerName && (
                                          <span className="farmer-modal-owner-name">
                                            {' '}(Owner: {parcel.lesseeLandOwnerName})
                                          </span>
                                        )}
                                      </>
                                    )}
                                  </span>
                                </div>
                                <div className="farmer-modal-parcel-item">
                                  <span className="farmer-modal-label">Parcel Location:</span>
                                  <span className="farmer-modal-value">
                                    {parcel.farmLocationBarangay}, {parcel.farmLocationMunicipality}
                                  </span>
                                </div>
                                <div className="farmer-modal-parcel-item">
                                  <span className="farmer-modal-label">Parcel Size:</span>
                                  <span className="farmer-modal-value">
                                    {typeof parcel.totalFarmAreaHa === 'number' ? parcel.totalFarmAreaHa.toFixed(2) : parseFloat(String(parcel.totalFarmAreaHa || 0)).toFixed(2)} hectares
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JoMasterlist;