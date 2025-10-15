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
  parcelArea: number | string | null;
  totalFarmArea: number;
  parcelCount: number;
  ownershipType: {
    registeredOwner: boolean;
    tenant: boolean;
    lessee: boolean;
  };
}

const JoRsbsa: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab] = useState('overview');
  const [rsbsaRecords, setRsbsaRecords] = useState<RSBSARecord[]>([]);
  const [registeredOwners, setRegisteredOwners] = useState<RSBSARecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isActive = (path: string) => location.pathname === path;

  // Fetch RSBSA records from API and shii
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

      const dataWithTotalArea = data.map((record: RSBSARecord) => {
        const calculatedTotal = calculateTotalFarmArea(data, record.farmerName);
        const parcelCount = countFarmParcels(data, record.farmerName);
        console.log(`Farmer: ${record.farmerName}, API totalFarmArea: ${record.totalFarmArea}, Calculated: ${calculatedTotal}, Parcels: ${parcelCount}`);
        return {
          ...record,
          totalFarmArea: calculatedTotal,
          parcelCount: parcelCount
        };
      });

      setRsbsaRecords(dataWithTotalArea);
      const registeredOwnersData = filterRegisteredOwners(dataWithTotalArea);
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

  // Function to calculate total farm area for a farmer
  const calculateTotalFarmArea = (records: RSBSARecord[], farmerName: string) => {
    // Find all records for the same farmer (by name)
    const farmerRecords = records.filter(record => record.farmerName === farmerName);

    // Sum up all parcel areas for this farmer
    const totalArea = farmerRecords.reduce((sum, record) => {
      const area = parseFloat(String(record.parcelArea || 0)) || 0;
      return sum + area;
    }, 0);

    return totalArea;
  };

  // Function to count the number of parcels for a farmer based on existing data
  const countFarmParcels = (records: RSBSARecord[], farmerName: string) => {
    // Count how many records exist for this farmer
    // Each record in rsbsa_submission represents one parcel
    const farmerRecords = records.filter(record => record.farmerName === farmerName);
    return farmerRecords.length;
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
              onClick={() => navigate('/dashboard')}
            >
              <span className="nav-icon">
                <img src={HomeIcon} alt="Home" />
              </span>
              <span className="nav-text">Home</span>
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'rsbsa' ? 'active' : ''}`}
              onClick={() => navigate('/rsbsa')}
            >
              <span className="nav-icon">
                <img src={RSBSAIcon} alt="RSBSA" />
              </span>
              <span className="nav-text">RSBSA</span>
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'incentives' ? 'active' : ''}`}
              onClick={() => navigate('/incentives')}
            >
              <span className="nav-icon">
                <img src={IncentivesIcon} alt="Incentives" />
              </span>
              <span className="nav-text">Incentives</span>
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'masterlist' ? 'active' : ''}`}
              onClick={() => navigate('/masterlist')}
            >
              <span className="nav-icon">
                <img src={ApproveIcon} alt="Masterlist" />
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
          <h2>Registered Land Owners</h2>

          <div className="content-card">
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
                      <th>Number of Parcels</th>
                      <th>Total Farm Area</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registeredOwners.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="no-data">
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

                        // Parcel count is now calculated and stored in record.parcelCount

                        return (
                          <tr key={record.id}>
                            <td>{lastName}</td>
                            <td>{firstName}</td>
                            <td>{middleName}</td>
                            <td>{extName}</td>
                            <td>{record.gender || 'N/A'}</td>
                            <td>{record.birthdate ? formatDate(record.birthdate) : 'N/A'}</td>
                            <td>{record.farmerAddress || 'N/A'}</td>
                            <td>{record.parcelCount || 0}</td>
                            <td>{(() => {
                              const area = typeof record.totalFarmArea === 'number' ? record.totalFarmArea : parseFloat(String(record.totalFarmArea || 0));
                              return !isNaN(area) && area > 0 ? `${area.toFixed(2)} ha` : 'N/A';
                            })()}</td>
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

export default JoRsbsa;
