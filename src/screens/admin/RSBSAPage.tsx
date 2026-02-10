import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import { getRsbsaSubmissions } from '../../api';
import '../../assets/css/admin css/RSBSAStyle.css';
import '../../components/layout/sidebarStyle.css';
import FarmlandMap from '../../components/Map/FarmlandMap';
import { useRSBSADemographics } from '../../hooks/useRSBSADemographics';
import {
  AgeDistributionChart,
  CropDistributionChart,
  FarmSizeCards,
  OwnershipBreakdownChart,
} from '../../components/RSBSA/RSBSADemographics';
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

  // Demographics analysis hook
  const demographics = useRSBSADemographics(rsbsaRecords);

  // Fetch RSBSA records from API and shii
  const fetchRSBSARecords = async () => {
    try {
      setLoading(true); // Set loading to true to show loading state
      const response = await getRsbsaSubmissions(); // Get data from API
      if (response.error) { // Check for errors
        throw new Error(response.error); // Throw an error if response has error
      }
      const data = response.data || []; // Get data from response

      // Debug fetched data
      console.log('Received data from API:', JSON.stringify(data, null, 2));

      // Debug ownership types
      console.log('Sample record ownership type:', data[0]?.ownershipType);
      console.log('Records with ownership types:', data.filter((r: { ownershipType: any; }) => r.ownershipType).length);

      const dataWithTotalArea = data.map((record: RSBSARecord) => { // Calculate total farm area
        const calculatedTotal = calculateTotalFarmArea(data, record.farmerName); // Calculate total area for this farmer
        const parcelCount = countFarmParcels(data, record.farmerName); // Count parcels for this farmer
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
  const calculateTotalFarmArea = (records: RSBSARecord[], farmerName: string) => { // Get all records for the farmer and sum parcel areas
    // Find all records for the same farmer (by name)
    const farmerRecords = records.filter(record => record.farmerName === farmerName);

    // Sum up all parcel areas for this farmer
    const totalArea = farmerRecords.reduce((sum, record) => { // Ensure parcelArea is a number
      const area = parseFloat(String(record.parcelArea || 0)) || 0; // Default to 0 if null or invalid
      return sum + area; // Sum the areas
    }, 0); // Initial sum is 0

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
    console.log('Total records to filter:', records.length); // Log total records before filtering
    const filtered = records.filter(record => { //  Filter logic
      if (!record.ownershipType) { // if ownershipType is missing 
        console.warn(`Missing ownershipType for ${record.farmerName}`, record); // Log a warning
        return false; // Exclude this record
      }
      const isRegisteredOwner = record.ownershipType.registeredOwner === true; // If registeredOwner is true
      // Debug each record's ownership type
      console.log(`${record.farmerName}: registeredOwner=${record.ownershipType.registeredOwner}, tenant=${record.ownershipType.tenant}, lessee=${record.ownershipType.lessee}, isRegisteredOwner=${isRegisteredOwner}`);
      return isRegisteredOwner; // Include only registered owners
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
    <div className="rsbsa-admin-page-container">

      <div className="rsbsa-admin-page">

        {/* Sidebar starts here */}
        <div className="sidebar">
          <nav className="sidebar-nav">
            <div className='sidebar-logo'>
              <img src={LogoImage} alt="Logo" />
            </div>

            <button
              className={`sidebar-nav-item ${isActive('/dashboard') ? 'active' : ''}`}
              onClick={() => navigate('/dashboard')}
            >
              <span className="nav-icon">
                <img src={HomeIcon} alt="Home" />
              </span>
              <span className="nav-text">Home</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive('/rsbsa') ? 'active' : ''}`}
              onClick={() => navigate('/rsbsa')}
            >
              <span className="nav-icon">
                <img src={RSBSAIcon} alt="RSBSA" />
              </span>
              <span className="nav-text">RSBSA</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive('/gap-analysis') ? 'active' : ''}`}
              onClick={() => navigate('/gap-analysis')}
            >
              <span className="nav-icon">
                <img src={IncentivesIcon} alt="Gap-analysis" />
              </span>
              <span className="nav-text">Gap Analysis</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive('/incentives') ? 'active' : ''}`}
              onClick={() => navigate('/incentives')}
            >
              <span className="nav-icon">
                <img src={IncentivesIcon} alt="Incentives" />
              </span>
              <span className="nav-text">Incentives</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive('/masterlist') ? 'active' : ''}`}
              onClick={() => navigate('/masterlist')}
            >
              <span className="nav-icon">
                <img src={ApproveIcon} alt="Masterlist" />
              </span>
              <span className="nav-text">Masterlist</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive('/logout') ? 'active' : ''}`}
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
        <div className="rsbsa-admin-main-content">
          <h2 className="rsbsa-admin-page-title">Registered Land Owners</h2>
          <div className="rsbsa-admin-page-subtitle">View and manage registered land owners from RSBSA submissions</div>

          {/* Demographics Analysis Section */}
          {!loading && !error && rsbsaRecords.length > 0 && (
            <div className="rsbsa-demographics-section">
              <div className="rsbsa-demographics-header">
                <h2>Demographics Analysis</h2>
                <span className="rsbsa-demographics-badge">ANALYTICS</span>
              </div>

              {/* Farm Size Cards - full width */}
              <FarmSizeCards data={demographics.farmSizeCategories} total={demographics.totalFarmers} />

              {/* Charts Grid: 2x2 */}
              <div className="rsbsa-demographics-grid" style={{ marginTop: 20 }}>
                <AgeDistributionChart data={demographics.ageBrackets} />
                <CropDistributionChart data={demographics.cropDistribution} />
                <OwnershipBreakdownChart data={demographics.ownershipBreakdown} total={demographics.totalFarmers} />
              </div>
            </div>
          )}

          <div className="rsbsa-admin-content-card">
            {loading ? (
              <div className="rsbsa-admin-loading-container">
                <p>Loading registered land owners...</p>
              </div>
            ) : error ? (
              <div className="rsbsa-admin-error-container">
                <p>Error: {error}</p>
                <button onClick={fetchRSBSARecords} className="rsbsa-admin-retry-button">
                  Retry
                </button>
              </div>
            ) : (
              <div className="rsbsa-admin-table-container">
                <table className="rsbsa-admin-owners-table">
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
                        <td colSpan={10} className="rsbsa-admin-no-data">
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
