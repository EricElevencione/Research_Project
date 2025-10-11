import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import '../../assets/css/jo css/JoMasterlistStyle.css';
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

const TechMasterlist: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab] = useState('overview');
  const [rsbsaRecords, setRsbsaRecords] = useState<RSBSARecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    fetchRSBSARecords();
  }, []);

  const fetchRSBSARecords = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/rsbsa_submission');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();

      const formattedRecords: RSBSARecord[] = (Array.isArray(data) ? data : []).map((item: any) => {
        const referenceNumber = String(item.referenceNumber ?? item.id);
        const farmerName = String(item.farmerName || '—');
        const farmerAddress = String(item.farmerAddress ?? '—');
        const farmLocation = String(item.farmLocation ?? '—');
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

  const filteredRecords = rsbsaRecords.filter(record => {
    const matchesStatus = selectedStatus === 'all' || record.status === selectedStatus;
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
      case 'Active Farmer': return 'status-approved';
      case 'Not Active': return 'status-not-approved';
      default: return 'status-pending';
    }
  };

  const toggleStatus = async (id: string) => {
    console.log('Toggle status clicked for ID:', id);
    
    try {
      const record = rsbsaRecords.find((r) => r.id === id);
      if (!record) {
        console.error('Record not found for ID:', id);
        setError('Record not found');
        return;
      }

      console.log('Found record:', record);
      const newStatus = record.status === 'Active Farmer' ? 'Not Active' : 'Active Farmer';
      console.log('Updating status from', record.status, 'to', newStatus);

      const requestBody = {
        status: newStatus
      };
      console.log('Request body:', requestBody);

      const response = await fetch(`http://localhost:5000/api/rsbsa_submission/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        console.error('Error details:', errorData.details);
        throw new Error(`Failed to update status: ${errorData.message || response.status}. Details: ${errorData.details || 'No additional details'}`);
      }

      const responseData = await response.json();
      console.log('Success response:', responseData);

      console.log('Status updated successfully, refetching records...');
      // Refetch records to ensure UI is in sync with backend
      await fetchRSBSARecords();
    } catch (error: any) {
      console.error('Error updating farmer status:', error);
      setError(`Failed to update farmer status: ${error.message}`);
    }
  };

  const printActiveFarmers = () => {
    const activeFarmers = rsbsaRecords.filter(record => record.status === 'Active Farmer');

    if (activeFarmers.length === 0) {
      alert('No active farmers found to print.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the active farmers list.');
      return;
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
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>ACTIVE FARMERS LIST</h1>
            <p>Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
            <p>Total Active Farmers: ${activeFarmers.length}</p>
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
            <p>Total Active Farmers: ${activeFarmers.length}</p>
            <p>Report generated by FFRS System</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  };

  return (
    <div className="page-container">
      <div className="page">
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
        <div className="main-content">
          <h2>Masterlist</h2>
          <div className="content-card">
            <div className="print-section" style={{ marginBottom: '20px', textAlign: 'right' }}>
              <button
                onClick={printActiveFarmers}
                className="print-button"
                style={{
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                Print Active Farmers List
              </button>
            </div>
            <div className="filters-section">
              <div className="search-filter">
                <input
                  type="text"
                  placeholder="Search by farmer name, reference number, or barangay..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>
              <div className="status-filter">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="status-select"
                >
                  <option value="all">All Status</option>
                  <option value="Active Farmer">Active Farmer</option>
                  <option value="Not Active">Not Active</option>
                </select>
              </div>
            </div>
            <div className="table-container">
              <table className="farmers-table">
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
                    <tr><td colSpan={7} className="loading-cell">Loading...</td></tr>
                  )}
                  {error && !loading && (
                    <tr><td colSpan={7} className="error-cell">Error: {error}</td></tr>
                  )}
                  {!loading && !error && filteredRecords.length > 0 && (
                    filteredRecords.map((record) => (
                      <tr key={record.id}>
                        <td>{record.referenceNumber}</td>
                        <td>{record.farmerName}</td>
                        <td>{record.farmerAddress}</td>
                        <td>{record.farmLocation}</td>
                        <td>{record.parcelArea}</td>
                        <td>{formatDate(record.dateSubmitted)}</td>
                        <td>
                          <button
                            className={`status-button ${getStatusClass(record.status)}`}
                            onClick={() => toggleStatus(record.id)}
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
      </div>
    </div>
  );
};

export default TechMasterlist;