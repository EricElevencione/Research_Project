import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getRsbsaSubmissions } from '../../api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import '../../assets/css/admin css/MasterlistStyle.css';
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
      const response = await getRsbsaSubmissions();
      if (response.error) throw new Error(response.error);
      const data = response.data || [];

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
  });

  // ── Status Counts ──
  const statusCounts = useMemo(() => {
    const active = rsbsaRecords.filter(r => r.status === 'Active Farmer').length;
    const inactive = rsbsaRecords.filter(r => r.status === 'Not Active').length;
    const submitted = rsbsaRecords.filter(r => r.status === 'Submitted').length;
    const notSubmitted = rsbsaRecords.filter(r => !['Active Farmer', 'Not Active', 'Submitted'].includes(r.status)).length;
    return { active, inactive, submitted, notSubmitted, total: rsbsaRecords.length };
  }, [rsbsaRecords]);

  // ── Export helpers ──
  const exportColumns = [
    'FFRS System Generated',
    'Farmer Name',
    'Farmer Address',
    'Parcel Address',
    'Parcel Area',
    'Date Submitted',
    'Farmer Status',
  ];

  const recordToRow = (r: RSBSARecord) => [
    r.referenceNumber,
    r.farmerName,
    r.farmerAddress,
    r.farmLocation,
    r.parcelArea,
    formatDate(r.dateSubmitted),
    r.status || 'Not Active',
  ];

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const now = new Date().toLocaleDateString();

    doc.setFontSize(16);
    doc.text('Farmer Masterlist', 14, 18);
    doc.setFontSize(10);

    const filterInfo: string[] = [];
    if (farmerStatus !== 'all') filterInfo.push(`Status: ${farmerStatus === 'active' ? 'Active' : 'Inactive'}`);
    if (searchQuery) filterInfo.push(`Search: "${searchQuery}"`);
    if (filterInfo.length > 0) {
      doc.text(`Filters: ${filterInfo.join(' | ')}`, 14, 25);
    }
    doc.text(`Generated: ${now}  •  ${filteredRecords.length} record(s)`, 14, filterInfo.length > 0 ? 31 : 25);

    autoTable(doc, {
      head: [exportColumns],
      body: filteredRecords.map(recordToRow),
      startY: filterInfo.length > 0 ? 36 : 30,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [160, 200, 120], textColor: [51, 51, 51], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    doc.save(`Masterlist_${now.replace(/\//g, '-')}.pdf`);
  };

  const handleExportExcel = () => {
    const now = new Date().toLocaleDateString();
    const wsData = [exportColumns, ...filteredRecords.map(recordToRow)];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Auto-fit column widths
    ws['!cols'] = exportColumns.map((_, ci) => ({
      wch: Math.max(
        exportColumns[ci].length,
        ...filteredRecords.map(r => String(recordToRow(r)[ci]).length)
      ) + 2,
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Masterlist');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), `Masterlist_${now.replace(/\//g, '-')}.xlsx`);
  };

  const formatDate = (iso: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return '—';
    }
  };

  return (
    <div className="masterlist-admin-page-container">
      <div className="masterlist-admin-page">
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
              className={`sidebar-nav-item ${isActive('/audit-trail') ? 'active' : ''}`}
              onClick={() => navigate('/audit-trail')}
            >
              <span className="nav-icon">📋</span>
              <span className="nav-text">Audit Trail</span>
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
        <div className="masterlist-admin-main-content">
          <div className="masterlist-admin-dashboard-header">
            <h2 className="masterlist-admin-page-header">Masterlist</h2>
          </div>

          {/* Status Count Cards */}
          {!loading && !error && (
            <div className="masterlist-status-cards">
              <div className="masterlist-status-card masterlist-card-total">
                <div className="masterlist-card-icon">👥</div>
                <div className="masterlist-card-info">
                  <span className="masterlist-card-count">{statusCounts.total}</span>
                  <span className="masterlist-card-label">Total Farmers</span>
                </div>
              </div>
              <div className="masterlist-status-card masterlist-card-active">
                <div className="masterlist-card-icon">✅</div>
                <div className="masterlist-card-info">
                  <span className="masterlist-card-count">{statusCounts.active}</span>
                  <span className="masterlist-card-label">Active</span>
                </div>
                <div className="masterlist-card-bar">
                  <div className="masterlist-card-bar-fill masterlist-bar-active" style={{ width: `${statusCounts.total ? (statusCounts.active / statusCounts.total * 100) : 0}%` }} />
                </div>
              </div>
              <div className="masterlist-status-card masterlist-card-inactive">
                <div className="masterlist-card-icon">❌</div>
                <div className="masterlist-card-info">
                  <span className="masterlist-card-count">{statusCounts.inactive}</span>
                  <span className="masterlist-card-label">Inactive</span>
                </div>
                <div className="masterlist-card-bar">
                  <div className="masterlist-card-bar-fill masterlist-bar-inactive" style={{ width: `${statusCounts.total ? (statusCounts.inactive / statusCounts.total * 100) : 0}%` }} />
                </div>
              </div>
              <div className="masterlist-status-card masterlist-card-submitted">
                <div className="masterlist-card-icon">📋</div>
                <div className="masterlist-card-info">
                  <span className="masterlist-card-count">{statusCounts.submitted}</span>
                  <span className="masterlist-card-label">Submitted</span>
                </div>
                <div className="masterlist-card-bar">
                  <div className="masterlist-card-bar-fill masterlist-bar-submitted" style={{ width: `${statusCounts.total ? (statusCounts.submitted / statusCounts.total * 100) : 0}%` }} />
                </div>
              </div>
            </div>
          )}

          <div className="masterlist-admin-content-card">
            {/* Filters and Search */}
            <div className="masterlist-admin-filters-section">
              <div className="masterlist-admin-search-filter">
                <input
                  type="text"
                  placeholder="Search by farmer name, reference number, or barangay..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="masterlist-admin-search-input"
                />
              </div>

              <div className="masterlist-admin-status-filter">
                <select
                  value={farmerStatus}
                  onChange={(e) => setFarmerStatus(e.target.value as 'all' | 'active' | 'inactive')}
                  className="masterlist-admin-status-select"
                >
                  <option value="all">All Farmers</option>
                  <option value="active">Active Farmers</option>
                  <option value="inactive">Inactive Farmers</option>
                </select>
              </div>

              {/* Export Buttons */}
              <div className="masterlist-export-buttons">
                <button className="masterlist-export-btn masterlist-export-pdf" onClick={handleExportPDF} disabled={filteredRecords.length === 0}>
                  📄 Export PDF
                </button>
                <button className="masterlist-export-btn masterlist-export-excel" onClick={handleExportExcel} disabled={filteredRecords.length === 0}>
                  📊 Export Excel
                </button>
              </div>
            </div>

            {/* RSBSA Records Table */}
            <div className="masterlist-admin-table-container">
              <table className="masterlist-admin-farmers-table">
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
                    <tr><td colSpan={7} className="masterlist-admin-loading-cell">Loading...</td></tr>
                  )}

                  {error && !loading && (
                    <tr><td colSpan={7} className="masterlist-admin-error-cell">Error: {error}</td></tr>
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
                            <span className={`masterlist-admin-status-pill ${record.status === 'Active Farmer' ? 'masterlist-admin-status-approved' : 'masterlist-admin-status-not-approved'}`}>
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
