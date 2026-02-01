import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { useNavigate, useLocation } from "react-router-dom";
import { getRsbsaSubmissionById, getFarmParcels, updateRsbsaSubmission } from '../../api';
import '../../assets/css/technician css/TechRsbsaStyle.css';
import '../../assets/css/jo css/FarmerDetailModal.css';
import '../../components/layout/sidebarStyle.css';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import ApproveIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import FarmerIcon from '../../assets/images/farmer (1).png';
import IncentivesIcon from '../../assets/images/incentives.png';

interface RSBSARecord {
  id: string;
  referenceNumber: string;
  farmerName: string;
  farmerAddress: string;
  farmLocation: string;
  gender: string;
  birthdate: string;
  dateSubmitted: string;
  status: string;
  landParcel: string;
  parcelArea?: string; // Add parcelArea as optional field
  parcelCount?: number; // Number of parcels owned by the farmer
  ownershipType: {
    registeredOwner: boolean;
    tenant: boolean;
    lessee: boolean;
  };
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

const TechRsbsa: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [, setRsbsaRecords] = useState<RSBSARecord[]>([]);
  const [registeredOwners, setRegisteredOwners] = useState<RSBSARecord[]>([]);
  const [filteredOwners, setFilteredOwners] = useState<RSBSARecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isActive = (path: string) => location.pathname === path;
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [editingRecord, setEditingRecord] = useState<RSBSARecord | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<RSBSARecord>>({});
  const [selectedFarmer, setSelectedFarmer] = useState<FarmerDetail | null>(null);
  const [loadingFarmerDetail, setLoadingFarmerDetail] = useState(false);
  const [showModal, setShowModal] = useState(false);

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
  ].sort(); // Sort alphabetically for better user experience

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

  const closeMenu = () => {
    setOpenMenuId(null);
    setMenuPosition(null);
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
      const parcelsData = parcelsResponse.data;

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
      if (activities.length === 0 && data.mainLivelihood) {
        activities.push(data.mainLivelihood);
      }

      const calculateAge = (birthdate: string): number | string => {
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
        const parts = backendName.split(',').map(p => p.trim()).filter(Boolean);
        if (parts.length === 0) return 'N/A';
        if (parts.length === 1) return parts[0];
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

  // Handle edit button click
  const handleEdit = (recordId: string) => {
    const recordToEdit = registeredOwners.find(record => record.id === recordId);
    if (recordToEdit) {
      setEditingRecord(recordToEdit);
      setEditFormData({
        farmerName: recordToEdit.farmerName,
        farmerAddress: recordToEdit.farmerAddress,
        farmLocation: recordToEdit.farmLocation,
        gender: recordToEdit.gender,
        birthdate: recordToEdit.birthdate,
        landParcel: recordToEdit.landParcel,
        parcelArea: extractParcelAreaNumber(recordToEdit.parcelArea || '')
      });
    }
    closeMenu();
  };

  // Handle form input changes
  const handleInputChange = (field: keyof RSBSARecord, value: string) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Format parcel area to include "hectares" if it's just a number
  const formatParcelArea = (value: string): string => {
    if (!value || value.trim() === '') return '';

    // If it's just a number, add "hectares"
    if (/^\d+(\.\d+)?$/.test(value.trim())) {
      return `${value.trim()} hectares`;
    }

    // If it already contains "hectares" or other text, return as is
    return value;
  };

  // Handle parcel area input specifically
  const handleParcelAreaChange = (value: string) => {
    setEditFormData(prev => ({
      ...prev,
      parcelArea: value
    }));
  };

  // Extract just the number from parcel area for editing
  const extractParcelAreaNumber = (value: string): string => {
    if (!value) return '';
    // If it contains "hectares", extract just the number part
    if (value.includes('hectares')) {
      return value.replace(/\s*hectares\s*$/i, '').trim();
    }
    return value;
  };

  // Handle save changes
  const handleSave = async () => {
    if (editingRecord && editFormData) {
      try {
        // Start with the existing record data
        const existingData = {
          farmerName: editingRecord.farmerName,
          gender: editingRecord.gender,
          birthdate: editingRecord.birthdate,
          farmerAddress: editingRecord.farmerAddress,
          farmLocation: editingRecord.farmLocation,
          parcelArea: editingRecord.parcelArea
        };

        // Format the data for submission
        const formattedData = {
          ...existingData,
          ...editFormData,
          // Format parcel area to include "hectares" if it's just a number
          parcelArea: editFormData.parcelArea ? formatParcelArea(editFormData.parcelArea) : undefined,
        };

        // Remove any undefined or empty values
        const cleanedData = Object.entries(formattedData)
          .reduce((acc, [key, value]) => {
            if (value !== undefined && value !== '') {
              acc[key] = value;
            }
            return acc;
          }, {} as Record<string, any>);

        // Update the record in the database
        const response = await updateRsbsaSubmission(editingRecord.id, cleanedData);

        if (response.error) {
          throw new Error(response.error || `HTTP error! status: ${response.status}`);
        }

        const updatedRecord = response.data;

        // Update the local state with the response from the server
        const updatedRecordData = {
          ...editingRecord,
          ...formattedData,
          // Use any additional fields returned from the server
          ...updatedRecord.updatedRecord
        };

        // Update the registeredOwners state
        setRegisteredOwners(prev =>
          prev.map(record =>
            record.id === editingRecord.id
              ? updatedRecordData
              : record
          )
        );

        // Also update the main rsbsaRecords state
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

        // Show success message (optional)
        console.log('Record updated successfully');
      } catch (error) {
        console.error('Error updating record:', error);
        setError('Failed to update record. Please try again.');
      }
    }
  };

  // Handle cancel edit
  const handleCancel = () => {
    setEditingRecord(null);
    setEditFormData({});
  };

  // Fetch RSBSA records from Supabase
  const fetchRSBSARecords = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('rsbsa_submission')
        .select('*');

      if (error) {
        console.error('Error fetching RSBSA records:', error);
        setError('Failed to load registered land owners data');
        return;
      }

      console.log('Received RSBSA data from Supabase:', data?.length || 0, 'records');
      console.log('Sample record:', data?.[0]);

      setRsbsaRecords(data || []);

      // Automatically filter for registered owners only
      const registeredOwnersData = filterRegisteredOwners(data || []);
      setRegisteredOwners(registeredOwnersData);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching RSBSA records:', err);
      setError('Failed to load registered land owners data');
    } finally {
      setLoading(false);
    }
  };

  // Function to filter registered owners only
  const filterRegisteredOwners = (records: RSBSARecord[]) => {
    console.log('Filtering records:', records.length);

    const filtered = records.filter(record => {
      // Exclude farmers who have transferred ownership or have no parcels
      if (record.status === 'Transferred Ownership' || record.status === 'No Parcels') {
        return false;
      }

      // Check if the record represents a registered owner
      // A registered owner is someone where OWNERSHIP_TYPE_REGISTERED_OWNER is true
      // and they are NOT a tenant or lessee
      if (record.ownershipType) {
        return record.ownershipType.registeredOwner === true &&
          record.ownershipType.tenant === false &&
          record.ownershipType.lessee === false;
      }

      // Fallback: if ownershipType is not available, check for land parcel data
      // This is a safety net for records that might not have ownership type data
      const hasLandParcel = record.landParcel && record.landParcel !== 'N/A' && record.landParcel.trim() !== '';
      const hasFarmLocation = record.farmLocation && record.farmLocation !== 'N/A' && record.farmLocation.trim() !== '';

      return hasLandParcel && hasFarmLocation;
    });

    console.log('Filtered results:', filtered.length, 'out of', records.length);
    return filtered;
  };

  // Get unique barangays from registered owners
  const uniqueBarangays = React.useMemo(() => {
    const barangays = new Set<string>();
    registeredOwners.forEach(record => {
      if (record.farmerAddress) {
        // Extract barangay (first part before comma)
        const barangay = record.farmerAddress.split(',')[0]?.trim();
        if (barangay) barangays.add(barangay);
      }
    });
    return Array.from(barangays).sort();
  }, [registeredOwners]);

  // Filter records based on search term and barangay
  useEffect(() => {
    const filtered = registeredOwners.filter(record => {
      // Barangay filter
      if (selectedBarangay !== 'all') {
        const barangay = record.farmerAddress?.split(',')[0]?.trim();
        if (barangay !== selectedBarangay) return false;
      }

      // Search term filter
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase();
        // Search in FFRS ID (both with and without dashes)
        const ffrsMatch = record.referenceNumber?.toLowerCase().includes(searchLower) ||
          record.referenceNumber?.replace(/-/g, '').toLowerCase().includes(searchLower);

        // Search in farmer name
        const nameMatch = record.farmerName?.toLowerCase().includes(searchLower);

        // Search in farmer address
        const addressMatch = record.farmerAddress?.toLowerCase().includes(searchLower);

        // Search in farm location
        const locationMatch = record.farmLocation?.toLowerCase().includes(searchLower);

        // Search in gender
        const genderMatch = record.gender?.toLowerCase().includes(searchLower);

        if (!(ffrsMatch || nameMatch || addressMatch || locationMatch || genderMatch)) {
          return false;
        }
      }

      return true;
    });

    setFilteredOwners(filtered);
  }, [searchTerm, selectedBarangay, registeredOwners]);

  // Load data on component mount
  useEffect(() => {
    fetchRSBSARecords();
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId && !(event.target as Element).closest('.tech-rsbsa-more-button') && !(event.target as Element).closest('.tech-rsbsa-actions-menu')) {
        closeMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenuId]);

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="tech-rsbsa-page-container">

      <div className="tech-rsbsa-page">

        {/* Sidebar starts here */}
        <div className="sidebar">
          <nav className="sidebar-nav">
            <div className='sidebar-logo'>
              <img src={LogoImage} alt="Logo" />
            </div>

            <button
              className={`sidebar-nav-item ${isActive('/technician-dashboard') ? 'active' : ''}`}
              onClick={() => navigate('/technician-dashboard')}
            >
              <span className="nav-icon">
                <img src={HomeIcon} alt="Home" />
              </span>
              <span className="nav-text">Home</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive('/technician-rsbsa') ? 'active' : ''}`}
              onClick={() => navigate('/technician-rsbsa')}
            >
              <span className="nav-icon">
                <img src={RSBSAIcon} alt="RSBSA" />
              </span>
              <span className="nav-text">RSBSA</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive('/technician-incentives') ? 'active' : ''}`}
              onClick={() => navigate('/technician-incentives')}
            >
              <span className="nav-icon">
                <img src={IncentivesIcon} alt="Incentives" />
              </span>
              <span className="nav-text">Incentives</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive('/technician-masterlist') ? 'active' : ''}`}
              onClick={() => navigate('/technician-masterlist')}
            >
              <span className="nav-icon">
                <img src={ApproveIcon} alt="Masterlist" />
              </span>
              <span className="nav-text">Masterlist</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive('/') ? 'active' : ''}`}
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
        <div className="tech-rsbsa-main-content">
          <div className="tech-rsbsa-dashboard-header">
            <div>
              <h2 className="tech-rsbsa-page-title">Registered Land Owners</h2>
              <p className="tech-rsbsa-page-subtitle">View and manage registered land owners from RSBSA submissions</p>
            </div>
          </div>

          <div className="tech-rsbsa-content-card">
            {loading ? (
              <div className="tech-rsbsa-loading-container">
                <p>Loading registered land owners...</p>
              </div>
            ) : error ? (
              <div className="tech-rsbsa-error-container">
                <p>Error: {error}</p>
                <button onClick={fetchRSBSARecords} className="tech-rsbsa-retry-button">
                  Retry
                </button>
              </div>
            ) : (
              <>
                {/* Search and Filter Container */}
                <div className="tech-rsbsa-search-filter-container">
                  <div className="tech-rsbsa-search-container">
                    <input
                      type="text"
                      className="tech-rsbsa-search-input"
                      placeholder="Search by FFRS ID, Name, Address, Location, or Gender..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                      <button
                        className="tech-rsbsa-clear-search-button"
                        onClick={() => setSearchTerm('')}
                        title="Clear search"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div className="tech-rsbsa-filter-container">
                    <select
                      value={selectedBarangay}
                      onChange={(e) => setSelectedBarangay(e.target.value)}
                      className="tech-rsbsa-filter-select"
                    >
                      <option value="all">All Barangays</option>
                      {uniqueBarangays.map(barangay => (
                        <option key={barangay} value={barangay}>{barangay}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="tech-rsbsa-table-container">
                  <table className="tech-rsbsa-owners-table">
                    <thead>
                      <tr>
                        <th>FFRS ID</th>
                        <th>Last Name</th>
                        <th>First Name</th>
                        <th>Middle Name</th>
                        <th>EXT Name</th>
                        <th>Gender</th>
                        <th>Birthdate</th>
                        <th>Farmer Address</th>
                        <th>Farm Location</th>
                        <th>Parcel Area</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOwners.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="tech-rsbsa-no-data">
                            {searchTerm ? 'No matching records found' : 'No registered owners found'}
                          </td>
                        </tr>
                      ) : (
                        filteredOwners.map((record) => {
                          // Parse the farmer name to extract individual components
                          const nameParts = record.farmerName.split(', ');
                          const lastName = nameParts[0] || '';
                          const firstName = nameParts[1] || '';
                          const middleName = nameParts[2] || '';
                          const extName = nameParts[3] || '';

                          // Get parcel area from the record and format it
                          const parcelArea = record.parcelArea ?
                            (record.parcelArea.includes('hectares') ? record.parcelArea : `${record.parcelArea} hectares`)
                            : 'N/A';

                          return (
                            <tr
                              key={record.id}
                              onClick={() => fetchFarmerDetails(record.id)}
                              style={{ cursor: 'pointer' }}
                            >
                              <td className="tech-rsbsa-ffrs-id">{record.referenceNumber || 'N/A'}</td>
                              <td>{lastName}</td>
                              <td>{firstName}</td>
                              <td>{middleName}</td>
                              <td>{extName}</td>
                              <td>{record.gender || 'N/A'}</td>
                              <td>{record.birthdate ? formatDate(record.birthdate) : 'N/A'}</td>
                              <td>{record.farmerAddress || 'N/A'}</td>
                              <td>{record.farmLocation || 'N/A'}</td>
                              <td>{parcelArea}</td>
                              <td onClick={(e) => e.stopPropagation()}>
                                <div style={{ position: 'relative', display: 'inline-block' }}>
                                  <button
                                    className="tech-rsbsa-more-button"
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
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Edit Modal */}
        {editingRecord && (
          <div className="tech-rsbsa-edit-modal-overlay">
            <div className="tech-rsbsa-edit-modal">
              <div className="tech-rsbsa-edit-modal-header">
                <h3>Edit Land Owner Information</h3>
                <button className="tech-rsbsa-close-button" onClick={handleCancel}>×</button>
              </div>
              <div className="tech-rsbsa-edit-modal-body">
                <div className="tech-rsbsa-form-group">
                  <label>Farmer Name:</label>
                  <input
                    type="text"
                    value={editFormData.farmerName || ''}
                    onChange={(e) => handleInputChange('farmerName', e.target.value)}
                    placeholder="Last Name, First Name, Middle Name, Ext Name"
                  />
                </div>
                <div className="tech-rsbsa-form-group">
                  <label>Gender:</label>
                  <select
                    value={editFormData.gender || ''}
                    onChange={(e) => handleInputChange('gender', e.target.value)}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div className="tech-rsbsa-form-group">
                  <label>Birthdate:</label>
                  <input
                    type="date"
                    value={editFormData.birthdate || ''}
                    onChange={(e) => handleInputChange('birthdate', e.target.value)}
                  />
                </div>
                <div className="tech-rsbsa-form-group">
                  <label>Farmer Address:</label>
                  <input
                    type="text"
                    value={editFormData.farmerAddress || ''}
                    onChange={(e) => handleInputChange('farmerAddress', e.target.value)}
                  />
                </div>
                <div className="tech-rsbsa-form-group">
                  <label>Farm Location (Barangay):</label>
                  <select
                    value={editFormData.farmLocation || ''}
                    onChange={(e) => handleInputChange('farmLocation', e.target.value)}
                  >
                    <option value="">Select Barangay</option>
                    {barangays.map((barangay) => (
                      <option key={barangay} value={barangay}>
                        {barangay}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="tech-rsbsa-form-group">
                  <label>Parcel Area:</label>
                  <input
                    type="text"
                    value={editFormData.parcelArea || ''}
                    onChange={(e) => handleParcelAreaChange(e.target.value)}
                    placeholder="e.g., 2.5 (will show as '2.5 hectares')"
                  />
                </div>
              </div>
              <div className="tech-rsbsa-edit-modal-footer">
                <button className="tech-rsbsa-cancel-button" onClick={handleCancel}>Cancel</button>
                <button className="tech-rsbsa-save-button" onClick={handleSave}>Save Changes</button>
              </div>
            </div>
          </div>
        )}

        {/* Action Menu - rendered outside table */}
        {openMenuId && menuPosition && (
          <div
            className="tech-rsbsa-actions-menu"
            style={{
              position: 'fixed',
              top: menuPosition.top,
              left: menuPosition.left,
            }}
          >
            <button onClick={() => { handleEdit(openMenuId); }}>Edit</button>
            <button onClick={() => { navigate(`/technician-pick-land-parcel/${openMenuId}`); closeMenu(); }}>Land Parcel</button>
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
                                    {typeof parcel.totalFarmAreaHa === 'number'
                                      ? parcel.totalFarmAreaHa.toFixed(2)
                                      : parseFloat(String(parcel.totalFarmAreaHa || 0)).toFixed(2)} hectares
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

export default TechRsbsa;