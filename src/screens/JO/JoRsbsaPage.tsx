import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import '../../assets/css/jo css/JoRsbsaPageStyle.css';
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

const JoRsbsaPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [_activeTab] = useState('overview');
  const [_rsbsaRecords, _setRsbsaRecords] = useState<RSBSARecord[]>([]);
  const [registeredOwners, setRegisteredOwners] = useState<RSBSARecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
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

      // Use the data directly from backend - it already has totalFarmArea and parcelCount calculated
      _setRsbsaRecords(data);
      const registeredOwnersData = filterRegisteredOwners(data);
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
              className={`sidebar-nav-item ${isActive('/jo-masterlist') ? 'active' : ''}`}
              onClick={() => navigate('/jo-masterlist')}
            >
              <span className="nav-icon">
                <img src={MasterlistIcon} alt="Masterlist" />
              </span>
              <span className="nav-text">Masterlist</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive('/jo-landrecords') ? 'active' : ''}`}
              onClick={() => navigate('/jo-landrecords')}
            >
              <span className="nav-icon">
                <img src={LandRecsIcon} alt="Masterlist" />
              </span>
              <span className="nav-text">Land Records</span>
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
                        const nameParts = record.farmerName.split(', ');
                        const lastName = nameParts[0] || '';
                        const firstName = nameParts[1] || '';
                        const middleName = nameParts[2] || '';
                        const extName = nameParts[3] || '';

                        // Parcel count is now calculated and stored in record.parcelCount

                        return (
                          <tr key={record.id}>
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


      </div>
    </div>

  );
};

export default JoRsbsaPage;





