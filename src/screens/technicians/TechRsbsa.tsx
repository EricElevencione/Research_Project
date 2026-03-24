import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { useNavigate, useLocation } from "react-router-dom";
import { getRsbsaSubmissions, getRsbsaSubmissionById, getFarmParcels } from '../../api';
import '../../assets/css/technician css/TechRsbsaStyle.css';
import '../../assets/css/jo css/FarmerDetailModal.css';
import '../../components/layout/sidebarStyle.css';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import ApproveIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';

interface RSBSARecord {
  id: string;
  referenceNumber: string;
  farmerName: string;
  firstName: string;
  middleName: string;
  lastName: string;
  extName: string;
  farmerAddress: string;
  farmLocation: string;
  gender: string;
  birthdate?: string;
  age?: number | string | null;
  dateSubmitted: string;
  status: string;
  landParcel: string;
  parcelArea?: string;
  parcelCount?: number;
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

  const [registeredOwners, setRegisteredOwners] = useState<RSBSARecord[]>([]);
  const [filteredOwners, setFilteredOwners] = useState<RSBSARecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isActive = (path: string) => location.pathname === path;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedFarmer, setSelectedFarmer] = useState<FarmerDetail | null>(null);
  const [loadingFarmerDetail, setLoadingFarmerDetail] = useState(false);
  const [showModal, setShowModal] = useState(false);

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
        const parts = backendName.split(',').map((p: string) => p.trim()).filter(Boolean);
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

  // Fetch RSBSA records from Supabase
  const fetchRSBSARecords = async () => {
    try {
      setLoading(true);
      const response = await getRsbsaSubmissions();

      if (response.error) {
        console.error('Error fetching RSBSA records:', response.error);
        setError('Failed to load registered land owners data');
        return;
      }

      const data = response.data || [];

      console.log('Received RSBSA data from Supabase:', data?.length || 0, 'records');
      console.log('Sample record:', data?.[0]);

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

    const filtered = records.filter((record: any) => {
      // Exclude farmers who have transferred ALL their parcels (no current ownership)
      // hasCurrentParcels: true = has current parcels, false = all transferred, undefined = no parcels yet
      if (record.hasCurrentParcels === false) {
        return false;
      }

      // Check if the record represents a registered owner
      if (record.ownershipType) {
        return record.ownershipType.registeredOwner === true;
      }

      return false;
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

  // Registration trend: count farmers per month-year
  const registrationTrend = React.useMemo(() => {
    const map = new Map<string, number>();
    registeredOwners.forEach((rec) => {
      const date = rec.dateSubmitted ? new Date(rec.dateSubmitted) : null;
      if (!date || Number.isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    // sort keys
    const entries = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    return entries.map(([month, count]) => ({ month, count }));
  }, [registeredOwners]);

  // Duplicate detection (same last name + first name + barangay)
  const duplicateMap = React.useMemo(() => {
    const m = new Map<string, number>();
    registeredOwners.forEach((rec) => {
      const nameParts = (rec.farmerName || '').split(',').map(s => s.trim());
      const last = (nameParts[0] || '').toLowerCase();
      const first = (nameParts[1] || '').toLowerCase();
      const barangay = (rec.farmerAddress || '').split(',')[0]?.trim().toLowerCase() || '';
      const key = `${last}|${first}|${barangay}`;
      m.set(key, (m.get(key) || 0) + 1);
    });
    return m;
  }, [registeredOwners]);

  // Helper to compute missing fields for a record
  const getMissingFields = (rec: RSBSARecord) => {
    const missing: string[] = [];
    if (!rec.gender) missing.push('Gender');
    if (!rec.birthdate) missing.push('Birthdate');
    if (!rec.farmerAddress) missing.push('Address');
    if (!rec.farmLocation) missing.push('Farm Location');
    if (!rec.parcelArea) missing.push('Parcel Area');
    return missing;
  };

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

  const calculateAgeFromBirthdate = (birthdate?: string): number | null => {
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

  const getDisplayAge = (record: RSBSARecord): string => {
    if (record.age !== undefined && record.age !== null && String(record.age).trim() !== '') {
      return String(record.age);
    }

    const computedAge = calculateAgeFromBirthdate(record.birthdate);
    return computedAge !== null ? String(computedAge) : 'N/A';
  };

  return (
    <div className="tech-rsbsa-page-container">

      <div className="tech-rsbsa-page">

        {/* Sidebar starts here */}
        <div className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
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
        <div className={`tech-incent-sidebar-overlay ${sidebarOpen ? 'active' : ''}`} onClick={() => setSidebarOpen(false)} />

        {/* Sidebar ends here */}

        {/* Main content starts here */}
        <div className="tech-rsbsa-main-content">
          <div className="tech-incent-mobile-header">
            <button className="tech-incent-hamburger" onClick={() => setSidebarOpen(prev => !prev)}>☰</button>
            <div className="tech-incent-mobile-title">RSBSA</div>
          </div>
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

                {/* Registration trend chart */}
                <div style={{ width: '100%', height: 160, margin: '12px 0' }}>
                  <ResponsiveContainer>
                    <LineChart data={registrationTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#1976d2" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="tech-rsbsa-table-container">
                  <table className="tech-rsbsa-owners-table">
                    <thead>
                      <tr>
                        <th>FFRS ID</th>
                        <th>Quality</th>
                        <th>Last Name</th>
                        <th>First Name</th>
                        <th>Middle Name</th>
                        <th>EXT Name</th>
                        <th>Gender</th>
                        <th>Age</th>
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
                          const parcelArea = record.parcelArea ?
                            (record.parcelArea.includes('hectares') ? record.parcelArea : `${record.parcelArea} hectares`)
                            : 'N/A';

                          // Determine duplicate and missing fields for this record
                          const namePartsForKey = (record.farmerName || '').split(',').map(s => s.trim());
                          const dkLast = (namePartsForKey[0] || '').toLowerCase();
                          const dkFirst = (namePartsForKey[1] || '').toLowerCase();
                          const dkBarangay = (record.farmerAddress || '').split(',')[0]?.trim().toLowerCase() || '';
                          const duplicateKey = `${dkLast}|${dkFirst}|${dkBarangay}`;
                          const isDuplicate = duplicateMap.get(duplicateKey) > 1;
                          const missing = getMissingFields(record);

                          return (
                            <tr
                              key={record.id}
                              onClick={() => fetchFarmerDetails(record.id)}
                              style={{ cursor: 'pointer' }}
                            >
                              <td className="tech-rsbsa-ffrs-id">{record.referenceNumber || 'N/A'}</td>
                              <td>{record.lastName || ''}</td>
                              <td>{record.firstName || ''}</td>
                              <td>{record.middleName || ''}</td>
                              <td>{record.extName || ''}</td>
                              <td>{record.gender || 'N/A'}</td>
                              <td>{getDisplayAge(record)}</td>
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
                    {/* link to full profile */}
                    <div className="farmer-modal-section">
                      <button
                        className="btn-action"
                        onClick={() => {
                          navigate(`/technician-farmerprofile/${selectedFarmer.id}`);
                          setShowModal(false);
                        }}
                      >
                        View Full Profile
                      </button>
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

