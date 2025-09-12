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

const JoMasterlist: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState('overview');
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

      const formattedRecords: RSBSARecord[] = (Array.isArray(data) ? data : []).map((item: any, idx: number) => {
        // Prefer backend-transformed fields; fallback to raw
        const referenceNumber = String(item.referenceNumber ?? item.id ?? `RSBSA-${idx + 1}`);
        const composedName = [item.surname, item.firstName, item.middleName].filter(Boolean).join(', ');
        const preferredName = (item.farmerName ?? composedName);
        const farmerName = String(preferredName || '—');
        const farmerAddress = String(item.farmerAddress ?? item.addressBarangay ?? '—');
        const farmLocation = String(item.farmLocation ?? '—');
        const landParcel = String(item.landParcel ?? '—');
        const parcelArea = (() => {
          const direct = item.parcelArea ?? item["PARCEL AREA"];
          if (direct !== undefined && direct !== null && String(direct).trim() !== '') {
            return String(direct);
          }
          // Fallback: parse from landParcel string e.g., "... (1.25 ha)"
          const match = /\(([^)]+)\)/.exec(landParcel);
          return match ? match[1] : '—';
        })();
        const dateSubmitted = item.dateSubmitted
          ? new Date(item.dateSubmitted).toISOString()
          : (item.createdAt ? new Date(item.createdAt).toISOString() : '');

        // Reflect database status semantics: Submitted / Not Submitted
        const status = String(item.status ?? 'Not Submitted');

        return {
          id: String(item.id ?? `${idx}-${Math.random().toString(36).slice(2)}`),
          referenceNumber,
          farmerName,
          farmerAddress,
          farmLocation,
          parcelArea,
          dateSubmitted,
          status,
          landParcel,
          ownershipType: item.ownershipType
        };
      });

      setRsbsaRecords(formattedRecords);
      setLoading(false);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load RSBSA records');
      setLoading(false);
    }
  };

  const handleStatusChange = async (recordId: string, newStatus: 'Approved' | 'Not Approved') => {
    try {
      // Update the record status
      const updatedRecords = rsbsaRecords.map(record =>
        record.id === recordId ? { ...record, status: newStatus } : record
      );
      setRsbsaRecords(updatedRecords);

      // Here you would typically make an API call to update the backend
      // await fetch(`http://localhost:5000/api/RSBSAform/${recordId}/status`, {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ status: newStatus })
      // });

      console.log(`Status updated for record ${recordId} to ${newStatus}`);
    } catch (err: any) {
      console.error('Error updating status:', err);
      // Revert the change if the API call fails
      fetchRSBSARecords();
    }
  };

  const handleSaveDraft = async (recordId: string) => {
    try {
      const updatedRecords = rsbsaRecords.map(record =>
        record.id === recordId ? { ...record, isDraft: true, status: 'Draft' as const } : record
      );
      setRsbsaRecords(updatedRecords);

      // Here you would typically make an API call to save as draft
      // await fetch(`http://localhost:5000/api/RSBSAform/${recordId}/draft`, {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ isDraft: true, status: 'Draft' })
      // });

      console.log(`Record ${recordId} saved as draft`);
    } catch (err: any) {
      console.error('Error saving draft:', err);
      fetchRSBSARecords();
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
      case 'Submitted': return 'status-approved';
      case 'Not Submitted': return 'status-not-approved';
      default: return 'status-pending';
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
            <h2 className="page-header">Masterlist</h2>
          </div>

          <div className="content-card">
            {/* Filters and Search */}
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
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Not Approved">Not Approved</option>
                  <option value="Draft">Draft</option>
                </select>
              </div>
            </div>

            {/* RSBSA Records Table */}
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
                    filteredRecords.map((record) => {
                      return (
                        <tr key={record.id}>
                          <td>{record.referenceNumber}</td>
                          <td>{record.farmerName}</td>
                          <td>{record.farmerAddress}</td>
                          <td>{record.farmLocation}</td>
                          <td>{record.parcelArea}</td>
                          <td>{formatDate(record.dateSubmitted)}</td>
                          <td>
                            <span className={`status-pill ${getStatusClass(record.status)}`}>
                              {record.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
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

export default JoMasterlist;