import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import '../../assets/css/jo css/JoRsbsaPageStyle.css';
import '../../assets/css/jo css/FarmerDetailModal.css';
import '../../components/layout/sidebarStyle.css';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import MasterlistIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';
import LandRecsIcon from '../../assets/images/landrecord.png';
import DistributionIcon from '../../assets/images/distribution.png'
import FarmerRequestIcon from '../../assets/images/request.png';

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
  parcelArea: number | string | null;
  totalFarmArea: number;
  parcelCount: number;
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

const JoRsbsaPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [_activeTab] = useState('overview');
  const [_rsbsaRecords, _setRsbsaRecords] = useState<RSBSARecord[]>([]);
  const [registeredOwners, setRegisteredOwners] = useState<RSBSARecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFarmer, setSelectedFarmer] = useState<FarmerDetail | null>(null);
  const [loadingFarmerDetail, setLoadingFarmerDetail] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const isActive = (path: string) => location.pathname === path;

  // Fetch RSBSA records from API
  const fetchRSBSARecords = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/rsbsa_submission');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Received data from API:', JSON.stringify(data, null, 2));

      // Debug ownership types
      console.log('Sample record ownership type:', data[0]?.ownershipType);
      console.log('Records with ownership types:', data.filter((r: { ownershipType: any; }) => r.ownershipType).length);

      // Reformat farmer names from "Last, First, Middle, Ext" to "Last, First Middle Ext"
      const formattedData = data.map((record: RSBSARecord) => {
        const backendName = record.farmerName || '';
        const reformattedName = (() => {
          if (!backendName || backendName === '—' || backendName === 'N/A') return backendName;
          const parts = backendName.split(',').map(p => p.trim()).filter(Boolean);
          if (parts.length === 0) return backendName;
          if (parts.length === 1) return parts[0]; // Just last name
          // Join all parts after the first with spaces (First Middle Ext)
          const lastName = parts[0];
          const restOfName = parts.slice(1).join(' ');
          return `${lastName}, ${restOfName}`;
        })();
        return {
          ...record,
          farmerName: reformattedName
        };
      });

      // Use the data directly from backend - it already has totalFarmArea and parcelCount calculated
      _setRsbsaRecords(formattedData);
      const registeredOwnersData = filterRegisteredOwners(formattedData);
      console.log('Filtered registered owners:', JSON.stringify(registeredOwnersData, null, 2));
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
    console.log('Total records to filter:', records.length);
    const filtered = records.filter(record => {
      if (!record.ownershipType) {
        console.warn(`Missing ownershipType for ${record.farmerName}`, record);
        return false;
      }
      const isRegisteredOwner = record.ownershipType.registeredOwner === true;
      console.log(`${record.farmerName}: registeredOwner=${record.ownershipType.registeredOwner}, tenant=${record.ownershipType.tenant}, lessee=${record.ownershipType.lessee}, isRegisteredOwner=${isRegisteredOwner}`);
      return isRegisteredOwner;
    });
    console.log('Filtered registered owners count:', filtered.length);
    console.log('Filtered registered owners:', JSON.stringify(filtered, null, 2));
    return filtered;
  };

  // Fetch farmer details when row is clicked
  const fetchFarmerDetails = async (farmerId: string) => {
    try {
      setLoadingFarmerDetail(true);

      // Fetch basic farmer info
      const farmerResponse = await fetch(`http://localhost:5000/api/rsbsa_submission/${farmerId}`);
      if (!farmerResponse.ok) throw new Error('Failed to fetch farmer details');
      const farmerData = await farmerResponse.json();

      // Fetch parcels
      const parcelsResponse = await fetch(`http://localhost:5000/api/rsbsa_submission/${farmerId}/parcels`);
      if (!parcelsResponse.ok) throw new Error('Failed to fetch parcels');
      const parcelsData = await parcelsResponse.json();

      // Handle both JSONB (data property) and structured column formats
      const data = farmerData.data || farmerData;

      console.log('Farmer data received:', farmerData);
      console.log('Data object for activities:', data);

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

      console.log('Parsed activities:', activities); const calculateAge = (birthdate: string): number | string => {
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

  // Load data on component mount
  useEffect(() => {
    fetchRSBSARecords();
  }, []);

  // Filter registered owners based on search query
  const filteredOwners = registeredOwners.filter(record => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const nameParts = record.farmerName.split(', ');
    const lastName = nameParts[0] || '';
    const firstName = nameParts[1] || '';
    const middleName = nameParts[2] || '';
    const extName = nameParts[3] || '';

    return (
      lastName.toLowerCase().includes(query) ||
      firstName.toLowerCase().includes(query) ||
      middleName.toLowerCase().includes(query) ||
      extName.toLowerCase().includes(query) ||
      record.farmerAddress?.toLowerCase().includes(query) ||
      record.gender?.toLowerCase().includes(query) ||
      record.referenceNumber?.toLowerCase().includes(query) ||
      record.referenceNumber?.replace(/-/g, '').toLowerCase().includes(query.replace(/-/g, ''))
    );
  });

  return (
    <div className="jo-rsbsa-page-container">

      <div className="jo-rsbsa-page">

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
        <div className="jo-rsbsa-main-content">
          <h2 className="jo-rsbsa-page-title">Registered Land Owners</h2>

          <div className="jo-rsbsa-content-card">
            <div className="jo-rsbsa-actions-bar">
              <div className="jo-rsbsa-search-container">
                <input
                  type="text"
                  placeholder="Search by FFRS ID, name, address, gender..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="jo-rsbsa-search-input"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="jo-rsbsa-clear-search-button"
                    title="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="jo-rsbsa-register-button">
                <button onClick={() => navigate('/jo-rsbsa')}>
                  Register Farmer
                </button>
              </div>
            </div>
            {loading ? (
              <div className="jo-rsbsa-loading-container">
                <p>Loading registered land owners...</p>
              </div>
            ) : error ? (
              <div className="jo-rsbsa-error-container">
                <p>Error: {error}</p>
                <button onClick={fetchRSBSARecords} className="jo-rsbsa-retry-button">
                  Retry
                </button>
              </div>
            ) : (
              <div className="jo-rsbsa-table-container">
                {searchQuery && (
                  <div className="jo-rsbsa-search-results-info">
                    <p>
                      Found <strong>{filteredOwners.length}</strong> result{filteredOwners.length !== 1 ? 's' : ''}
                      {filteredOwners.length < registeredOwners.length &&
                        ` out of ${registeredOwners.length} total registered owners`
                      }
                    </p>
                  </div>
                )}
                <table className="jo-rsbsa-owners-table">
                  <thead>
                    <tr>
                      <th>FFRS ID</th>
                      <th>Last Name</th>
                      <th>First Name</th>
                      <th>Middle Name</th>
                      <th>EXT Name</th>
                      <th>Gender</th>
                      <th>Farmer Address</th>
                      <th>Number of Parcels</th>
                      <th>Total Farm Area</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOwners.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="jo-rsbsa-no-data">
                          {searchQuery ? 'No results found for your search' : 'No registered owners found'}
                        </td>
                      </tr>
                    ) : (
                      filteredOwners.map((record) => {
                        // Parse the farmer name to extract individual components
                        // Backend returns "Last, First, Middle, Ext" but we display as "Last, First Middle Ext"
                        const nameParts = record.farmerName.split(', ');
                        const lastName = nameParts[0] || '';
                        // The rest after the comma is "First Middle Ext" - split by spaces
                        const restOfName = (nameParts[1] || '').split(' ').map(p => p.trim()).filter(Boolean);
                        const firstName = restOfName[0] || '';
                        const middleName = restOfName[1] || '';
                        const extName = restOfName[2] || '';

                        // Parcel count is now calculated and stored in record.parcelCount

                        return (
                          <tr
                            key={record.id}
                            className="jo-rsbsa-clickable-row"
                            onClick={() => fetchFarmerDetails(record.id)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td className="jo-rsbsa-ffrs-id">{record.referenceNumber || 'N/A'}</td>
                            <td>{lastName}</td>
                            <td>{firstName}</td>
                            <td>{middleName}</td>
                            <td>{extName}</td>
                            <td>{record.gender || 'N/A'}</td>
                            <td>{record.farmerAddress || 'N/A'}</td>
                            <td>{record.parcelCount || 0}</td>
                            <td>{(() => {
                              const area = typeof record.totalFarmArea === 'number' ? record.totalFarmArea : parseFloat(String(record.totalFarmArea || 0));
                              return !isNaN(area) && area > 0 ? `${area.toFixed(2)} ha` : 'N/A';
                            })()}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

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

export default JoRsbsaPage;





