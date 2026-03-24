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
  age: number | null;
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

interface EditFormData {
  farmerName?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  farmerAddress?: string;
  barangay?: string;
  municipality?: string;
  farmLocation?: string;
  landParcel?: string;
  dateSubmitted?: string;
  parcelArea?: string;
  age?: string;
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
  const [editFormData, setEditFormData] = useState<EditFormData>({});
  const [editError, setEditError] = useState<string | null>(null);
  const [editingParcels, setEditingParcels] = useState<Parcel[]>([]);
  const [loadingParcels, setLoadingParcels] = useState(false);
  const [parcelErrors, setParcelErrors] = useState<Record<string, string>>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

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
      if (
        activities.length === 0 &&
        (data.mainLivelihood || data['MAIN LIVELIHOOD'] || data.main_livelihood)
      ) {
        activities.push(data.mainLivelihood || data['MAIN LIVELIHOOD'] || data.main_livelihood);
      }

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

      // Build parcels array from rsbsa_farm_parcels; if empty, fall back to submission-level farm data
      let mappedParcels = parcelsData.map((p: any) => ({
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
      }));

      // Fallback: if no parcels in rsbsa_farm_parcels, build from submission-level data
      if (mappedParcels.length === 0) {
        const submissionFarmLocation = data.farmLocation || data['FARM LOCATION'] || '';
        const submissionParcelArea = parseFloat(data.totalFarmArea || data['TOTAL FARM AREA'] || data.parcelArea || data['PARCEL AREA'] || '0');
        const submissionOwnership = data.ownershipType || {};

        if (submissionFarmLocation || submissionParcelArea > 0) {
          const locationParts = submissionFarmLocation.split(',').map((s: string) => s.trim());
          const fallbackBarangay = locationParts[0] || data.barangay || data['BARANGAY'] || 'N/A';
          const fallbackMunicipality = locationParts[1] || data.municipality || data['MUNICIPALITY'] || 'Dumangas';

          mappedParcels = [{
            id: `submission-${farmerId}`,
            parcelNumber: 'N/A',
            farmLocationBarangay: fallbackBarangay,
            farmLocationMunicipality: fallbackMunicipality,
            totalFarmAreaHa: submissionParcelArea,
            ownershipTypeRegisteredOwner: submissionOwnership.registeredOwner || data['OWNERSHIP_TYPE_REGISTERED_OWNER'] || false,
            ownershipTypeTenant: submissionOwnership.tenant || data['OWNERSHIP_TYPE_TENANT'] || false,
            ownershipTypeLessee: submissionOwnership.lessee || data['OWNERSHIP_TYPE_LESSEE'] || false,
            tenantLandOwnerName: '',
            lesseeLandOwnerName: ''
          }];
        }
      }

      const normalizedDetailAge = normalizeAgeValue(
        farmerData.age ?? data.age ?? data.AGE,
        data.dateOfBirth || data.birthdate || data['DATE OF BIRTH'] || data.BIRTHDATE || null
      );

      const farmerDetail: FarmerDetail = {
        id: farmerId,
        farmerName: reformattedFarmerName,
        farmerAddress: farmerData.farmerAddress || 'N/A',
        age: normalizedDetailAge ?? 'N/A',
        gender: data.gender || 'N/A',
        mainLivelihood: data.mainLivelihood || 'N/A',
        farmingActivities: activities,
        parcels: mappedParcels
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

  const calculateAgeFromBirthdate = (birthdate?: string | null): number | null => {
    if (!birthdate) return null;
    const birthDate = new Date(birthdate);
    if (Number.isNaN(birthDate.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age >= 0 ? age : null;
  };

  const normalizeAgeValue = (ageValue: unknown, birthdate?: string | null): number | null => {
    if (ageValue !== null && ageValue !== undefined && String(ageValue).trim() !== '') {
      const parsedAge = Number(ageValue);
      if (Number.isFinite(parsedAge) && parsedAge >= 0) {
        return Math.floor(parsedAge);
      }
    }

    return calculateAgeFromBirthdate(birthdate);
  };

  const ageToInputValue = (ageValue: unknown): string => {
    if (ageValue === null || ageValue === undefined) return '';
    return String(ageValue);
  };

  const parseAgeInputToNumber = (ageValue?: string): number | null => {
    if (!ageValue || ageValue.trim() === '') return null;
    const parsed = Number(ageValue);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.floor(parsed);
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
        const age = normalizeAgeValue(
          item.age,
          item.birthdate ?? item.dateOfBirth ?? item.BIRTHDATE ?? item['DATE OF BIRTH'] ?? null
        );

        // Reflect database status semantics: Submitted / Not Submitted
        const status = String(item.status ?? 'Not Submitted');

        return {
          id: String(item.id), // Use the actual database ID
          referenceNumber,
          farmerName,
          farmerAddress,
          farmLocation,
          parcelArea,
          age,
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

  const getSubmissionTimestamp = (isoDate: string) => {
    const timestamp = Date.parse(isoDate);
    return Number.isNaN(timestamp) ? -Infinity : timestamp;
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
  }).sort((a, b) => getSubmissionTimestamp(b.dateSubmitted) - getSubmissionTimestamp(a.dateSubmitted));

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
    setEditError(null);
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

  // Parses the address into barangay and municipality based on the assumption that they are separated by a comma
  const parseAddress = (address: string): { barangay: string; municipality: string } => {
    if (!address) return { barangay: '', municipality: '' };
    const parts = address.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length === 0) return { barangay: '', municipality: '' };
    if (parts.length === 1) return { barangay: parts[0] || '', municipality: '' };
    return { barangay: parts[0] || '', municipality: parts[1] || '' };
  };

  const normalizeText = (value: string): string => value.trim().toLowerCase();

  const resolveBarangayForEdit = (addressBarangay: string, farmLocation: string): string => {
    const matchBarangay = (candidate: string): string => {
      if (!candidate) return '';
      const normalizedCandidate = normalizeText(candidate);
      const exact = barangays.find((b) => normalizeText(b) === normalizedCandidate);
      return exact || '';
    };

    // 1) Prefer address barangay if it matches known barangays
    const fromAddress = matchBarangay(addressBarangay);
    if (fromAddress) return fromAddress;

    // 2) Fall back to farm location first token (e.g., "Cali, Dumangas")
    const parsedFarmLocation = parseAddress(farmLocation || '');
    const fromFarmLocation = matchBarangay(parsedFarmLocation.barangay || farmLocation);
    if (fromFarmLocation) return fromFarmLocation;

    return '';
  };

  const handleEdit = async (recordId: string) => {
    const recordToEdit = rsbsaRecords.find(record => record.id === recordId);
    if (recordToEdit) {
      const { lastName, firstName, middleName } = parseName(recordToEdit.farmerName || '');
      const parsedAddress = parseAddress(recordToEdit.farmerAddress || '');
      const parsedFarmLocation = parseAddress(recordToEdit.farmLocation || '');
      const resolvedBarangay = resolveBarangayForEdit(parsedAddress.barangay, recordToEdit.farmLocation || '');
      const resolvedMunicipality = (() => {
        const fromAddress = (parsedAddress.municipality || '').trim();
        if (fromAddress && normalizeText(fromAddress) !== 'iloilo') return fromAddress;
        const fromFarmLocation = (parsedFarmLocation.municipality || '').trim();
        if (fromFarmLocation) return fromFarmLocation;
        return 'Dumangas';
      })();
      setEditingRecord(recordToEdit);
      setEditError(null);
      setEditFormData({
        farmerName: recordToEdit.farmerName,
        firstName,
        middleName,
        lastName,
        age: ageToInputValue(recordToEdit.age),
        farmerAddress: recordToEdit.farmerAddress,
        barangay: resolvedBarangay,
        municipality: resolvedMunicipality,
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

  // Updates the edit form data state for a specific field
  const handleInputChange = (field: keyof EditFormData, value: string) => {
    setEditError(null);
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleIndividualParcelChange = (parcelId: string, field: keyof Parcel, value: any) => {
    setEditError(null);
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
  }; 

  const handleSave = async () => {
    if (editingRecord && editFormData) {
      try {
        setEditError(null);

        // Validate all parcels before saving
        if (editingParcels.length > 0) {
          let hasErrors = false;
          const newErrors: Record<string, string> = {};

          // Validate each parcel's total_farm_area_ha field
          editingParcels.forEach(parcel => {
            if (!parcel.total_farm_area_ha || parcel.total_farm_area_ha <= 0) {
              hasErrors = true;
              newErrors[parcel.id] = 'Parcel area must be a valid positive number';
            }
          });

          // If there are errors, set the parcelErrors state and prevent saving
          if (hasErrors) {
            setParcelErrors(newErrors);
            setEditError('Please fix all parcel area errors before saving');
            return;
          }
        }

        // Validate age input: if provided, it must be a valid number and at least 18
        const rawAgeInput = (editFormData.age ?? '').trim();
        const normalizedAge = parseAgeInputToNumber(rawAgeInput);
        if (rawAgeInput !== '' && (normalizedAge === null || normalizedAge < 18)) {
          setEditError('Age must be a valid number and at least 18 years old');
          return;
        }

        // Start with the existing record data
        const existingData = {
          farmerName: editingRecord.farmerName,
          farmerAddress: editingRecord.farmerAddress,
          farmLocation: editingRecord.farmLocation,
          parcelArea: editingRecord.parcelArea,
          age: editingRecord.age
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
          : (editFormData.parcelArea ?? editingRecord.parcelArea);

        // Format the data for submission
        const formattedData = {
          ...existingData,
          ...editFormData,
          farmerName: composedFarmerName,
          farmerAddress: composedAddress,
          // Use the calculated parcel area string from individual parcels
          parcelArea: newParcelAreaString,
          // Persist age as number in the database/local table record
          age: normalizedAge,
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
        const serverRecord = updatedRecord?.updatedRecord ?? updatedRecord ?? {};
        const updatedRecordData: RSBSARecord = {
          ...editingRecord,
          ...formattedData,
          // Use any additional fields returned from the server
          ...serverRecord,
          age: normalizeAgeValue(
            serverRecord.age ?? formattedData.age,
            serverRecord.birthdate ?? serverRecord.dateOfBirth ?? null
          )
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
        setEditError(null);
        setEditingParcels([]);
        setParcelErrors({});

        // Show success message (optional)
        console.log('Record updated successfully');
      } catch (error) {
        console.error('Error updating record:', error);
        setEditError(error instanceof Error ? error.message : 'Failed to update record. Please try again.');
      }
    }
  };

  return (
    <div className="jo-masterlist-page-container">
      <div className="jo-masterlist-page has-mobile-sidebar">
        {/* Sidebar starts here */}
        <div className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
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
              className={`sidebar-nav-item ${isActive('/jo-land-registry') ? 'active' : ''}`}
              onClick={() => navigate('/jo-land-registry')}
            >
              <div className="nav-icon">🗺️</div>
              <span className="nav-text">Land Registry</span>
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
        <div className={`tech-incent-sidebar-overlay ${sidebarOpen ? 'active' : ''}`} onClick={() => setSidebarOpen(false)} />

        {/* Main content starts here */}
        <div className="jo-masterlist-main-content">
          <div className="tech-incent-mobile-header">
            <button className="tech-incent-hamburger" onClick={() => setSidebarOpen((prev) => !prev)}>☰</button>
            <div className="tech-incent-mobile-title">JO Masterlist</div>
          </div>
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
                {editError && (
                  <div className="jo-masterlist-edit-error-banner" role="alert">
                    {editError}
                  </div>
                )}
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
                <div className="form-group">
                  <label>Age:</label>
                  <input
                    type="text"
                    value={editFormData.age || ''}
                    onChange={(e) => handleInputChange('age', e.target.value)}
                    placeholder="Age"
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
                                <h4>Parcel #{(() => {
                                  const pNum = parcel.parcelNumber;
                                  if (!pNum || pNum === 'N/A') return index + 1;
                                  // If it's a simple number, use it directly
                                  if (/^\d+$/.test(pNum)) return pNum;
                                  // If it's an auto-generated ID like "Parcel-208-1", show just the index
                                  return index + 1;
                                })()}</h4>
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
