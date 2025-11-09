import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import '../../assets/css/technician css/MasterlistPage.css';
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
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printFilter, setPrintFilter] = useState({
    type: 'all', // 'all', 'lastname', 'barangay', 'date'
    value: ''
  });

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

  // 
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
      const response = await fetch(`http://localhost:5000/api/rsbsa_submission/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update status');
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

  const printActiveFarmers = () => {
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
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
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
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };

    // Close the modal and reset filter
    setShowPrintModal(false);
    setPrintFilter({ type: 'all', value: '' });
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
            <div className="print-section">
              <button
                onClick={() => setShowPrintModal(true)}
                className="print-button"
              >
                🖨️ Print Active Farmers
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

        {/* Print Filter Modal */}
        {showPrintModal && (
          <div className="print-modal-overlay">
            <div className="print-modal">
              <div className="print-modal-header">
                <h3>Print Active Farmers</h3>
                <button
                  className="close-button"
                  onClick={() => {
                    setShowPrintModal(false);
                    setPrintFilter({ type: 'all', value: '' });
                  }}
                >
                  ×
                </button>
              </div>
              <div className="print-modal-body">
                <div className="print-filter-group">
                  <label>Filter Type</label>
                  <select
                    value={printFilter.type}
                    onChange={(e) => setPrintFilter({ type: e.target.value, value: '' })}
                    className="print-filter-select"
                  >
                    <option value="all">Print All Active Farmers</option>
                    <option value="lastname">Filter by Family Name</option>
                    <option value="barangay">Filter by Barangay</option>
                    <option value="date">Filter by Date Submitted</option>
                  </select>
                </div>

                {printFilter.type === 'lastname' && (
                  <div className="print-filter-group">
                    <label>Select Family Name</label>
                    <select
                      value={printFilter.value}
                      onChange={(e) => setPrintFilter({ ...printFilter, value: e.target.value })}
                      className="print-value-select"
                    >
                      <option value="">Choose a family name...</option>
                      {getUniqueLastNames().map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {printFilter.type === 'barangay' && (
                  <div className="print-filter-group">
                    <label>Select Barangay</label>
                    <select
                      value={printFilter.value}
                      onChange={(e) => setPrintFilter({ ...printFilter, value: e.target.value })}
                      className="print-value-select"
                    >
                      <option value="">Choose a barangay...</option>
                      {getUniqueBarangays().map((barangay) => (
                        <option key={barangay} value={barangay}>{barangay}</option>
                      ))}
                    </select>
                  </div>
                )}

                {printFilter.type === 'date' && (
                  <div className="print-filter-group">
                    <label>Select Date Submitted</label>
                    <select
                      value={printFilter.value}
                      onChange={(e) => setPrintFilter({ ...printFilter, value: e.target.value })}
                      className="print-value-select"
                    >
                      <option value="">Choose a date...</option>
                      {getUniqueDates().map((date) => (
                        <option key={date} value={date}>{date}</option>
                      ))}
                    </select>
                  </div>
                )}

                {(printFilter.type === 'all' || printFilter.value) && (
                  <div className="print-match-count">
                    📊 {getFilteredPrintRecords().length} active farmer{getFilteredPrintRecords().length !== 1 ? 's' : ''} will be printed
                  </div>
                )}
              </div>
              <div className="print-modal-footer">
                <button
                  className="print-modal-cancel-button"
                  onClick={() => {
                    setShowPrintModal(false);
                    setPrintFilter({ type: 'all', value: '' });
                  }}
                >
                  Cancel
                </button>
                <button
                  className="print-modal-print-button"
                  onClick={printActiveFarmers}
                  disabled={printFilter.type !== 'all' && !printFilter.value}
                >
                  🖨️ Print
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TechMasterlist;