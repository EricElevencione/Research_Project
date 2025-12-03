import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../../assets/css/jo css/JoMasterlistStyle.css';
import '../../components/layout/sidebarStyle.css';
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

const Masterlist: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState('overview');
  const [rsbsaRecords, setRsbsaRecords] = useState<RSBSARecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [farmerStatus, setFarmerStatus] = useState<'all' | 'active' | 'inactive'>('all');
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

  const filteredRecords = rsbsaRecords.filter(record => {
    // Match based on the status field from database
    const matchesFarmerStatus =
      farmerStatus === 'all' ||
      (farmerStatus === 'active' && record.status === 'Active Farmer') ||
      (farmerStatus === 'inactive' && record.status === 'Not Active');

    const q = searchQuery.toLowerCase();
    const matchesSearch = record.farmerName.toLowerCase().includes(q) ||
      record.referenceNumber.toLowerCase().includes(q) ||
      record.farmerAddress.toLowerCase().includes(q) ||
      record.farmLocation.toLowerCase().includes(q);

    return matchesFarmerStatus && matchesSearch;
  }); const formatDate = (iso: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return '—';
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
              className={`sidebar-nav-item ${isActive('/land-records') ? 'active' : ''}`}
              onClick={() => navigate('/land-records')}
            >
              <span className="nav-icon">
                <img src={IncentivesIcon} alt="Land Records" />
              </span>
              <span className="nav-text">Land Records</span>
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
        <div className="main-content">
          <div className="admin-dashboard-header">
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
                  value={farmerStatus}
                  onChange={(e) => setFarmerStatus(e.target.value as 'all' | 'active' | 'inactive')}
                  className="status-select"
                >
                  <option value="all">All Farmers</option>
                  <option value="active">Active Farmers</option>
                  <option value="inactive">Inactive Farmers</option>
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
                      'Farmer Status'
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
                            <span className={`status-pill ${record.status === 'Active Farmer' ? 'status-approved' : 'status-not-approved'}`}>
                              {record.status || 'Not Active'}
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

export default Masterlist;
