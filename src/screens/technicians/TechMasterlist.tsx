import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import { getRsbsaSubmissions, getRsbsaSubmissionById, getFarmParcels, updateRsbsaSubmission } from '../../api';
import '../../assets/css/technician css/TechMasterlistStyle.css';
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

// Type declaration for Electron API exposed via preload
declare global {
  interface Window {
    electron?: {
      platform: string;
      print: (options?: any) => Promise<{ success: boolean; error?: string }>;
      printToPDF: (options?: any) => Promise<{ success: boolean; data?: string; error?: string }>;
      printContent: (htmlContent: string, options?: any) => Promise<{ success: boolean; error?: string }>;
    };
  }
}

const TechMasterlist: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab] = useState('overview');
  const [rsbsaRecords, setRsbsaRecords] = useState<RSBSARecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printFilter, setPrintFilter] = useState({
    type: 'all', // 'all', 'lastname', 'barangay', 'date'
    value: ''
  });
  const [selectedFarmer, setSelectedFarmer] = useState<FarmerDetail | null>(null);
  const [loadingFarmerDetail, setLoadingFarmerDetail] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedOwnershipType, setSelectedOwnershipType] = useState<string>('all');

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    fetchRSBSARecords();
  }, []);

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

      // Reformat the farmer name
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
          // Extract barangay and municipality from farmLocation (format: "Barangay, Municipality")
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

      const farmerDetail: FarmerDetail = {
        id: farmerId,
        farmerName: reformattedFarmerName,
        farmerAddress: farmerData.farmerAddress || 'N/A',
        age: calculateAge(data.dateOfBirth || data.birthdate || 'N/A'),
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

  const fetchRSBSARecords = async () => {
    try {
      const response = await getRsbsaSubmissions();
      if (response.error) throw new Error(response.error);
      const data = response.data;

      // Filter out farmers with 'No Parcels' status
      const filteredData = (Array.isArray(data) ? data : []).filter((item: any) => {
        const status = String(item.status ?? '').toLowerCase().trim();
        return status !== 'no parcels';
      });

      const formattedRecords: RSBSARecord[] = filteredData.map((item: any) => {
        const farmLocation = String(item.farmLocation ?? '—');
        // Use the FFRS code from database, fallback to RSBSA-{id} if not present
        const referenceNumber = item.referenceNumber || `RSBSA-${item.id}`;
        const farmerName = String(item.farmerName || '—');
        const farmerAddress = String(item.farmerAddress ?? '—');
        const landParcel = String(item.landParcel ?? item.farmLocation ?? '—');
        const parcelArea = String(item.parcelArea ?? '—');
        const dateSubmitted = item.dateSubmitted
          ? new Date(item.dateSubmitted).toISOString()
          : '';
        const status = String(item.status ?? 'Not Active');

        return {
          id: String(item.id),
          referenceNumber,
          farmerName,
          farmerAddress,
          farmLocation,
          parcelArea,
          dateSubmitted,
          status,
          landParcel,
          ownershipType: item.ownershipType || {
            registeredOwner: false,
            tenant: false,
            lessee: false
          }
        };
      });

      setRsbsaRecords(formattedRecords);
      setLoading(false);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load RSBSA records');
      setLoading(false);
    }
  };

  // Filter records by status, search, and ownership type
  const filteredRecords = rsbsaRecords.filter(record => {
    const matchesStatus = selectedStatus === 'all' || record.status === selectedStatus;
    const q = searchQuery.toLowerCase();
    const matchesSearch = record.farmerName.toLowerCase().includes(q) ||
      record.referenceNumber.toLowerCase().includes(q) ||
      record.farmerAddress.toLowerCase().includes(q) ||
      record.farmLocation.toLowerCase().includes(q);

    // Ownership type filter
    let matchesOwnership = true;
    if (selectedOwnershipType !== 'all' && record.ownershipType) {
      switch (selectedOwnershipType) {
        case 'registeredOwner':
          matchesOwnership = record.ownershipType.registeredOwner === true;
          break;
        case 'tenant':
          matchesOwnership = record.ownershipType.tenant === true;
          break;
        case 'lessee':
          matchesOwnership = record.ownershipType.lessee === true;
          break;
        default:
          matchesOwnership = true;
      }
    }

    return matchesStatus && matchesSearch && matchesOwnership;
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
      case 'Active Farmer': return 'status-approved';
      case 'Not Active': return 'status-not-approved';
      default: return 'status-pending';
    }
  };

  const toggleStatus = async (id: string) => {
    try {
      // Find the current record
      const record = rsbsaRecords.find((r) => r.id === id);
      if (!record) {
        throw new Error('Record not found');
      }

      // Determine the new status
      const newStatus = record.status === 'Active Farmer' ? 'Not Active' : 'Active Farmer';

      // Prepare the update data
      const updateData = {
        status: newStatus
      };

      // Make the API call
      const response = await updateRsbsaSubmission(id, updateData);

      if (response.error) {
        throw new Error(response.error || 'Failed to update status');
      }

      // Success! Update the local state
      setRsbsaRecords(prevRecords =>
        prevRecords.map(record =>
          record.id === id
            ? { ...record, status: newStatus }
            : record
        )
      );

      // Clear any existing errors
      setError(null);

    } catch (err: any) {
      setError(`Failed to update farmer status: ${err.message}`);
    }
  };

  const getFilteredPrintRecords = () => {
    let filtered = rsbsaRecords.filter(record => record.status === 'Active Farmer');

    if (printFilter.type === 'lastname' && printFilter.value) {
      filtered = filtered.filter(record => {
        const lastName = record.farmerName.split(' ').pop()?.toLowerCase() || '';
        return lastName === printFilter.value.toLowerCase();
      });
    } else if (printFilter.type === 'barangay' && printFilter.value) {
      filtered = filtered.filter(record =>
        record.farmLocation.toLowerCase().includes(printFilter.value.toLowerCase())
      );
    } else if (printFilter.type === 'date' && printFilter.value) {
      filtered = filtered.filter(record => {
        const recordDate = formatDate(record.dateSubmitted);
        const filterDate = formatDate(printFilter.value);
        return recordDate === filterDate;
      });
    }

    return filtered;
  };

  const getUniqueLastNames = () => {
    const lastNames = new Set<string>();
    rsbsaRecords
      .filter(record => record.status === 'Active Farmer')
      .forEach(record => {
        const lastName = record.farmerName.split(' ').pop();
        if (lastName) lastNames.add(lastName);
      });
    return Array.from(lastNames).sort();
  };

  const getUniqueBarangays = () => {
    const barangays = new Set<string>();
    rsbsaRecords
      .filter(record => record.status === 'Active Farmer')
      .forEach(record => {
        if (record.farmLocation) barangays.add(record.farmLocation);
      });
    return Array.from(barangays).sort();
  };

  const getUniqueDates = () => {
    const dates = new Set<string>();
    rsbsaRecords
      .filter(record => record.status === 'Active Farmer')
      .forEach(record => {
        const date = formatDate(record.dateSubmitted);
        if (date !== '—') dates.add(date);
      });
    return Array.from(dates).sort();
  };

  const printActiveFarmers = async () => {
    const activeFarmers = getFilteredPrintRecords();

    if (activeFarmers.length === 0) {
      alert('No active farmers found with the selected filter.');
      return;
    }

    let filterDescription = 'All Active Farmers';
    if (printFilter.type === 'lastname' && printFilter.value) {
      filterDescription = `Family Name: ${printFilter.value}`;
    } else if (printFilter.type === 'barangay' && printFilter.value) {
      filterDescription = `Barangay: ${printFilter.value}`;
    } else if (printFilter.type === 'date' && printFilter.value) {
      filterDescription = `Date Submitted: ${formatDate(printFilter.value)}`;
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Active Farmers List</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              color: #333;
            }
            .print-toolbar {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              background: #2563eb;
              color: white;
              padding: 15px 20px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              box-shadow: 0 2px 10px rgba(0,0,0,0.2);
              z-index: 1000;
            }
            .print-toolbar h3 {
              margin: 0;
              font-size: 16px;
            }
            .print-toolbar button {
              padding: 10px 25px;
              font-size: 14px;
              font-weight: bold;
              border: none;
              border-radius: 5px;
              cursor: pointer;
              margin-left: 10px;
            }
            .print-btn {
              background: #22c55e;
              color: white;
            }
            .print-btn:hover {
              background: #16a34a;
            }
            .close-btn {
              background: #ef4444;
              color: white;
            }
            .close-btn:hover {
              background: #dc2626;
            }
            .content-wrapper {
              margin-top: 80px;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #333;
              padding-bottom: 10px;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
            }
            .header p {
              margin: 5px 0;
              font-size: 14px;
            }
            .filter-info {
              text-align: center;
              margin-bottom: 20px;
              padding: 10px;
              background-color: #f0f0f0;
              border: 1px solid #ccc;
              border-radius: 5px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              border: 1px solid #333;
              padding: 8px;
              text-align: left;
              font-size: 12px;
            }
            th {
              background-color: #f5f5f5;
              font-weight: bold;
            }
            .summary {
              margin-top: 20px;
              font-weight: bold;
              font-size: 14px;
            }
            @media print {
              .print-toolbar { display: none !important; }
              .content-wrapper { margin-top: 0; }
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="print-toolbar">
            <h3>📄 Print Preview - Review your document below</h3>
            <div>
              <button class="print-btn" onclick="window.print()">🖨️ Print Now</button>
              <button class="close-btn" onclick="window.close()">✕ Close</button>
            </div>
          </div>
          
          <div class="content-wrapper">
            <div class="header">
              <h1>ACTIVE FARMERS LIST</h1>
              <p>Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
            </div>
            
            <div class="filter-info">
              <strong>Filter Applied:</strong> ${filterDescription}
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Reference Number</th>
                  <th>Farmer Name</th>
                  <th>Farmer Address</th>
                  <th>Parcel Address</th>
                  <th>Parcel Area</th>
                  <th>Date Submitted</th>
                </tr>
              </thead>
              <tbody>
                ${activeFarmers.map((farmer, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${farmer.referenceNumber}</td>
                    <td>${farmer.farmerName}</td>
                    <td>${farmer.farmerAddress}</td>
                    <td>${farmer.farmLocation}</td>
                    <td>${farmer.parcelArea}</td>
                    <td>${formatDate(farmer.dateSubmitted)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div class="summary">
              <p>Total Active Farmers (Filtered): ${activeFarmers.length}</p>
              <p>Report generated by FFRS System</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Check if running in Electron with print API available
    if (window.electron?.printContent) {
      try {
        const result = await window.electron.printContent(printContent);
        if (!result.success && result.error) {
          console.error('Print failed:', result.error);
          // User cancelled the print dialog - this is normal, don't show error
          if (result.error !== 'cancelled') {
            alert('Print failed: ' + result.error);
          }
        }
      } catch (err: any) {
        console.error('Print error:', err);
        alert('Failed to print: ' + err.message);
      }
    } else {
      // Fallback for browser environment
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Please allow popups to print the active farmers list.');
        return;
      }

      printWindow.document.write(printContent);
      printWindow.document.close();

      printWindow.onload = () => {
        printWindow.print();
        printWindow.close();
      };
    }

    // Close the modal and reset filter
    setShowPrintModal(false);
    setPrintFilter({ type: 'all', value: '' });
  };

  return (
    <div className="tech-masterlist-page-container">
      <div className="tech-masterlist-page">

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
              className={`sidebar-nav-item ${isActive('/technician-rsbsapage') ? 'active' : ''}`}
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

        <div className="tech-masterlist-main-content">
          <div className="tech-masterlist-dashboard-header">
            <div>
              <h2 className="tech-masterlist-page-title">Masterlist</h2>
              <p className="tech-masterlist-page-subtitle">Browse all RSBSA farmers, filter by status, and generate reports</p>
            </div>
          </div>
          <div className="tech-masterlist-print-section">
            <button
              onClick={() => setShowPrintModal(true)}
              className="tech-masterlist-print-button"
            >
              🖨️ Print Active Farmers
            </button>
          </div>
          <div className="tech-masterlist-content-card">
            <div className="tech-masterlist-filters-section">
              <div className="tech-masterlist-search-filter">
                <input
                  type="text"
                  placeholder="Search by farmer name, reference number, or barangay..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="tech-masterlist-search-input"
                />
              </div>
              <div className="tech-masterlist-status-filter">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="tech-masterlist-status-select"
                >
                  <option value="all">All Status</option>
                  <option value="Active Farmer">Active Farmer</option>
                  <option value="Not Active">Not Active</option>
                </select>
              </div>
              <div className="tech-masterlist-ownership-filter">
                <select
                  value={selectedOwnershipType}
                  onChange={(e) => setSelectedOwnershipType(e.target.value)}
                  className="tech-masterlist-status-select"
                >
                  <option value="all">All Ownership Types</option>
                  <option value="registeredOwner">Registered Owner</option>
                  <option value="tenant">Tenant</option>
                  <option value="lessee">Lessee</option>
                </select>
              </div>
            </div>
            <div className="tech-masterlist-table-container">
              <table className="tech-masterlist-farmers-table">
                <thead>
                  <tr>
                    {[
                      'FFRS System Generated',
                      'Farmer Name',
                      'Farmer Address',
                      'Parcel Address',
                      'Parcel Area',
                      'Date Submitted',
                      'Status'
                    ].map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={7} className="tech-masterlist-loading-cell">Loading...</td></tr>
                  )}
                  {error && !loading && (
                    <tr><td colSpan={7} className="tech-masterlist-error-cell">Error: {error}</td></tr>
                  )}
                  {!loading && !error && filteredRecords.length > 0 && (
                    filteredRecords.map((record) => (
                      <tr
                        key={record.id}
                        onClick={() => fetchFarmerDetails(record.id)}
                        style={{ cursor: 'pointer', }}
                      >
                        <td>{record.referenceNumber}</td>
                        <td>{record.farmerName}</td>
                        <td>{record.farmerAddress}</td>
                        <td>{record.farmLocation}</td>
                        <td>{record.parcelArea}</td>
                        <td>{formatDate(record.dateSubmitted)}</td>
                        <td>
                          <button
                            className={`tech-masterlist-status-button tech-masterlist-${getStatusClass(record.status)}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStatus(record.id);
                            }}
                          >
                            {record.status}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                  {!loading && !error && filteredRecords.length === 0 && (
                    Array.from({ length: 16 }).map((_, i) => (
                      <tr key={`empty-${i}`}>
                        <td colSpan={7}>&nbsp;</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Print Filter Modal */}
        {showPrintModal && (
          <div className="tech-masterlist-print-modal-overlay">
            <div className="tech-masterlist-print-modal">
              <div className="tech-masterlist-print-modal-header">
                <h3>Print Active Farmers</h3>
                <button
                  className="tech-masterlist-close-button"
                  onClick={() => {
                    setShowPrintModal(false);
                    setPrintFilter({ type: 'all', value: '' });
                  }}
                >
                  ×
                </button>
              </div>
              <div className="tech-masterlist-print-modal-body">
                <div className="tech-masterlist-print-filter-group">
                  <label>Filter Type</label>
                  <select
                    value={printFilter.type}
                    onChange={(e) => setPrintFilter({ type: e.target.value, value: '' })}
                    className="tech-masterlist-print-filter-select"
                  >
                    <option value="all">Print All Active Farmers</option>
                    <option value="lastname">Filter by Family Name</option>
                    <option value="barangay">Filter by Barangay</option>
                    <option value="date">Filter by Date Submitted</option>
                  </select>
                </div>

                {printFilter.type === 'lastname' && (
                  <div className="tech-masterlist-print-filter-group">
                    <label>Select Family Name</label>
                    <select
                      value={printFilter.value}
                      onChange={(e) => setPrintFilter({ ...printFilter, value: e.target.value })}
                      className="tech-masterlist-print-value-select"
                    >
                      <option value="">Choose a family name...</option>
                      {getUniqueLastNames().map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {printFilter.type === 'barangay' && (
                  <div className="tech-masterlist-print-filter-group">
                    <label>Select Barangay</label>
                    <select
                      value={printFilter.value}
                      onChange={(e) => setPrintFilter({ ...printFilter, value: e.target.value })}
                      className="tech-masterlist-print-value-select"
                    >
                      <option value="">Choose a barangay...</option>
                      {getUniqueBarangays().map((barangay) => (
                        <option key={barangay} value={barangay}>{barangay}</option>
                      ))}
                    </select>
                  </div>
                )}

                {printFilter.type === 'date' && (
                  <div className="tech-masterlist-print-filter-group">
                    <label>Select Date Submitted</label>
                    <select
                      value={printFilter.value}
                      onChange={(e) => setPrintFilter({ ...printFilter, value: e.target.value })}
                      className="tech-masterlist-print-value-select"
                    >
                      <option value="">Choose a date...</option>
                      {getUniqueDates().map((date) => (
                        <option key={date} value={date}>{date}</option>
                      ))}
                    </select>
                  </div>
                )}

                {(printFilter.type === 'all' || printFilter.value) && (
                  <div className="tech-masterlist-print-match-count">
                    📊 {getFilteredPrintRecords().length} active farmer{getFilteredPrintRecords().length !== 1 ? 's' : ''} will be printed
                  </div>
                )}
              </div>
              <div className="tech-masterlist-print-modal-footer">
                <button
                  className="tech-masterlist-print-modal-cancel-button"
                  onClick={() => {
                    setShowPrintModal(false);
                    setPrintFilter({ type: 'all', value: '' });
                  }}
                >
                  Cancel
                </button>
                <button
                  className="tech-masterlist-print-modal-print-button"
                  onClick={printActiveFarmers}
                  disabled={printFilter.type !== 'all' && !printFilter.value}
                >
                  🖨️ Print
                </button>
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
                                <h4>Parcel #{parcel.parcelNumber !== 'N/A' ? parcel.parcelNumber : index + 1}</h4>
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

export default TechMasterlist;