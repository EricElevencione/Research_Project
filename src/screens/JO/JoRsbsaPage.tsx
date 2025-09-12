import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import '../../assets/css/jo css/JoRsbsaPageStyle.css';
import '../../assets/css/navigation/nav.css';
import FarmlandMap from '../../components/Map/FarmlandMap';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import ApproveIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';
import LandRecsIcon from '../../assets/images/landrecord.png';

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
  ownershipType: {
    registeredOwner: boolean;
    tenant: boolean;
    lessee: boolean;
  };
}

const JoRsbsaPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState('overview');
  const [rsbsaRecords, setRsbsaRecords] = useState<RSBSARecord[]>([]);
  const [registeredOwners, setRegisteredOwners] = useState<RSBSARecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      setRsbsaRecords(data);
      
      // Automatically filter for registered owners only
      const registeredOwnersData = filterRegisteredOwners(data);
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
    return records.filter(record => {
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
  };

  // Load data on component mount
  useEffect(() => {
    fetchRSBSARecords();
  }, []);

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
    <div className="page-container">

      <div className="page">

        {/* Sidebar starts here */}
        <div className="sidebar">
          <nav className="sidebar-nav">
            <div className='sidebar-logo'>
              <img src={LogoImage} alt="Logo" />
            </div>

            <button
              className={`sidebar-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => navigate('/jo-dashboard')}
            >
              <span className="nav-icon">
                <img src={HomeIcon} alt="Home" />
              </span>
              <span className="nav-text">Home</span>
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'rsbsa-page' ? 'active' : ''}`}
              onClick={() => navigate('/jo-rsbsapage')}
            >
              <span className="nav-icon">
                <img src={RSBSAIcon} alt="RSBSA" />
              </span>
              <span className="nav-text">RSBSA</span>
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'incentives' ? 'active' : ''}`}
              onClick={() => navigate('/jo-incentives')}
            >
              <span className="nav-icon">
                <img src={IncentivesIcon} alt="Incentives" />
              </span>
              <span className="nav-text">Incentives</span>
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'masterlist' ? 'active' : ''}`}
              onClick={() => navigate('/jo-masterlist')}
            >
              <span className="nav-icon">
                <img src={ApproveIcon} alt="Masterlist" />
              </span>
              <span className="nav-text">Masterlist</span>
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'landrecords' ? 'active' : ''}`}
              onClick={() => navigate('/jo-landrecords')}
            >
              <span className="nav-icon">
                <img src={LandRecsIcon} alt="Masterlist" />
              </span>
              <span className="nav-text">Land Records</span>
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'logout' ? 'active' : ''}`}
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
        <div className="main-content">
          <div className="dashboard-header">
            <h2 className="page-header">Registered Land Owners</h2>
          </div>

          <div className="content-card">
            <div className="actions-bar">
              <button onClick={() => navigate('/jo-rsbsa')} className="register-button">
                Register Farmer
              </button>
            </div>
            {loading ? (
              <div className="loading-container">
                <p>Loading registered land owners...</p>
              </div>
            ) : error ? (
              <div className="error-container">
                <p>Error: {error}</p>
                <button onClick={fetchRSBSARecords} className="retry-button">
                  Retry
                </button>
              </div>
            ) : (
              <div className="table-container">
                <table className="owners-table">
                  <thead>
                    <tr>
                      <th>Last Name</th>
                      <th>First Name</th>
                      <th>Middle Name</th>
                      <th>EXT Name</th>
                      <th>Gender</th>
                      <th>Birthdate</th>
                      <th>Farmer Address</th>
                      <th>Farm Location</th>
                      <th>Parcel Area</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registeredOwners.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="no-data">
                          No registered owners found
                        </td>
                      </tr>
                    ) : (
                      registeredOwners.map((record) => {
                        // Parse the farmer name to extract individual components
                        const nameParts = record.farmerName.split(', ');
                        const lastName = nameParts[0] || '';
                        const firstName = nameParts[1] || '';
                        const middleName = nameParts[2] || '';
                        const extName = nameParts[3] || '';

                        // Extract parcel information from landParcel
                        const parcelInfo = record.landParcel || 'N/A';
                        const parcelArea = parcelInfo.includes('(')
                          ? parcelInfo.split('(')[1]?.replace(')', '') || 'N/A'
                          : 'N/A';

                        return (
                          <tr key={record.id}>
                            <td>{lastName}</td>
                            <td>{firstName}</td>
                            <td>{middleName}</td>
                            <td>{extName}</td>
                            <td>{record.gender || 'N/A'}</td>
                            <td>{record.birthdate ? formatDate(record.birthdate) : 'N/A'}</td>
                            <td>{record.farmerAddress || 'N/A'}</td>
                            <td>{record.farmLocation || 'N/A'}</td>
                            <td>{parcelArea}</td>
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