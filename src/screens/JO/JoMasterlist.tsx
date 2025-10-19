import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import '../../assets/css/jo css/JoMasterlistStyle.css';
import '../../assets/css/navigation/nav.css';
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


  const [rsbsaRecords, setRsbsaRecords] = useState<RSBSARecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [editingRecord, setEditingRecord] = useState<RSBSARecord | null>(null);
  type EditForm = Partial<RSBSARecord> & { firstName?: string; middleName?: string; lastName?: string; barangay?: string; municipality?: string };
  const [editFormData, setEditFormData] = useState<EditForm>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  const isActive = (path: string) => location.pathname === path;

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/rsbsa_submission/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`Failed to delete record: ${response.statusText}`);
      }

      // Remove the deleted record from the local state
      setRsbsaRecords(prev => prev.filter(record => record.id !== id));
    } catch (err: any) {
      console.error('Error deleting record:', err);
      alert(`Failed to delete record: ${err.message}`);
    } finally {
    }
  };

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

        const referenceNumber = String(item.referenceNumber ?? `RSBSA-${idx + 1}`);
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
          id: String(item.id), // Use the actual database ID
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
    // Normalize status to handle casing/spacing differences and map to active groups
    const normalizedStatus = (record.status || '').toLowerCase().trim();
    const activeStatuses = new Set(['submitted', 'approved', 'active']);
    const notActiveStatuses = new Set(['not submitted', 'not_active', 'not active', 'draft', 'pending', 'not approved']);

    let matchesStatus = true;
    if (selectedStatus === 'active') {
      matchesStatus = activeStatuses.has(normalizedStatus);
    } else if (selectedStatus === 'notActive') {
      matchesStatus = notActiveStatuses.has(normalizedStatus);
    }

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

  const closeMenu = () => {
    setOpenMenuId(null);
    setMenuPosition(null);
  };

  const handleCancel = () => {
    setEditingRecord(null);
    setEditFormData({});
  };

  const parseName = (fullName: string): { lastName: string; firstName: string; middleName: string } => {
    if (!fullName) return { lastName: '', firstName: '', middleName: '' };
    const parts = fullName.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length === 1) {
      return { lastName: parts[0] || '', firstName: '', middleName: '' };
    }
    if (parts.length === 2) {
      const [last, first] = parts;
      return { lastName: last || '', firstName: first || '', middleName: '' };
    }
    const [last, first, middle] = parts;
    return { lastName: last || '', firstName: first || '', middleName: middle || '' };
  };

  const parseAddress = (address: string): { barangay: string; municipality: string } => {
    if (!address) return { barangay: '', municipality: '' };
    const parts = address.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length === 0) return { barangay: '', municipality: '' };
    if (parts.length === 1) return { barangay: parts[0] || '', municipality: '' };
    return { barangay: parts[0] || '', municipality: parts[1] || '' };
  };

  const handleEdit = (recordId: string) => {
    const recordToEdit = rsbsaRecords.find(record => record.id === recordId);
    if (recordToEdit) {
      const { lastName, firstName, middleName } = parseName(recordToEdit.farmerName || '');
      const { barangay, municipality } = parseAddress(recordToEdit.farmerAddress || '');
      setEditingRecord(recordToEdit);
      setEditFormData({
        farmerName: recordToEdit.farmerName,
        firstName,
        middleName,
        lastName,
        farmerAddress: recordToEdit.farmerAddress,
        barangay,
        municipality,
        farmLocation: recordToEdit.farmLocation,
        landParcel: recordToEdit.landParcel,
        dateSubmitted: recordToEdit.dateSubmitted,
        parcelArea: extractParcelAreaNumber(recordToEdit.parcelArea || '')
      });
    }
    closeMenu();
  };

  const extractParcelAreaNumber = (value: string): string => {
    if (!value) return '';
    // If it contains "hectares", extract just the number part
    if (value.includes('hectares')) {
      return value.replace(/\s*hectares\s*$/i, '').trim();
    }
    return value;
  };

  /**
   * Toggles the menu for a given record ID.
   * If the menu is already open for the given ID, it will close the menu.
   * If the menu is not open for the given ID, it will open the menu at the position of the triggering element.
   * @param {string} id - The ID of the record to toggle the menu for.
   * @param {React.MouseEvent<HTMLButtonElement>} event - The event that triggered the toggle menu action.
   */
  const toggleMenu = (id: string, event: React.MouseEvent<HTMLButtonElement>) => {
    if (openMenuId === id) {
      setOpenMenuId(null);
      setMenuPosition(null);
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.right + window.scrollX - 160 // 160px is min-width of menu
      });
      setOpenMenuId(id);
    }
  };

  const handleInputChange = (field: keyof RSBSARecord | 'firstName' | 'middleName' | 'lastName' | 'barangay' | 'municipality', value: string) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleParcelAreaChange = (value: string) => {
    setEditFormData(prev => ({
      ...prev,
      parcelArea: value
    }));
  };

  const formatParcelArea = (value: string): string => {
    if (!value || value.trim() === '') return '';

    // If it's just a number, add "hectares"
    if (/^\d+(\.\d+)?$/.test(value.trim())) {
      return `${value.trim()} hectares`;
    }

    // If it already contains "hectares" or other text, return as is
    return value;
  };

  const handleSave = async () => {
    if (editingRecord && editFormData) {
      try {
        // Start with the existing record data
        const existingData = {
          farmerName: editingRecord.farmerName,
          farmerAddress: editingRecord.farmerAddress,
          farmLocation: editingRecord.farmLocation,
          parcelArea: editingRecord.parcelArea
        };

        // Compose farmerName from discrete name fields (Last, First, Middle)
        const composedFarmerName = (() => {
          const last = (editFormData.lastName ?? '').trim();
          const first = (editFormData.firstName ?? '').trim();
          const middle = (editFormData.middleName ?? '').trim();
          const parts: string[] = [];
          if (last) parts.push(last);
          if (first) parts.push(first);
          if (middle) parts.push(middle);
          return parts.length > 0 ? parts.join(', ') : (editFormData.farmerName ?? editingRecord.farmerName);
        })();

        // Compose address from barangay and municipality if provided
        const composedAddress = (() => {
          const b = (editFormData.barangay ?? '').trim();
          const m = (editFormData.municipality ?? '').trim();
          if (b && m) return `${b}, ${m}`;
          if (b) return b;
          if (m) return m;
          return editFormData.farmerAddress ?? editingRecord.farmerAddress;
        })();

        // Format the data for submission
        const formattedData = {
          ...existingData,
          ...editFormData,
          farmerName: composedFarmerName,
          farmerAddress: composedAddress,
          // Format parcel area to include "hectares" if it's just a number
          parcelArea: editFormData.parcelArea ? formatParcelArea(editFormData.parcelArea) : undefined,
        };

        // Remove any undefined or empty values
        // Also send discrete name fields if present to align with backend columns
        const withNameFields: Record<string, any> = {
          ...formattedData,
          firstName: editFormData.firstName,
          middleName: editFormData.middleName,
          surname: editFormData.lastName,
          addressBarangay: editFormData.barangay,
          addressMunicipality: editFormData.municipality,
        };

        const cleanedData = Object.entries(withNameFields)
          .reduce((acc, [key, value]) => {
            if (value !== undefined && value !== '') {
              acc[key] = value;
            }
            return acc;
          }, {} as Record<string, any>);

        // Update the record in the database
        const response = await fetch(`http://localhost:5000/api/rsbsa_submission/${editingRecord.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(cleanedData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        const updatedRecord = await response.json();

        // Update the local state with the response from the server
        const updatedRecordData = {
          ...editingRecord,
          ...formattedData,
          // Use any additional fields returned from the server
          ...updatedRecord.updatedRecord
        };

        // Update the main rsbsaRecords state
        setRsbsaRecords(prev =>
          prev.map(record =>
            record.id === editingRecord.id
              ? updatedRecordData
              : record
          )
        );

        // Close edit mode
        setEditingRecord(null);
        setEditFormData({});

        // Show success message (optional)
        console.log('Record updated successfully');
      } catch (error) {
        console.error('Error updating record:', error);
        setError('Failed to update record. Please try again.');
      }
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

            <button
              className={`sidebar-nav-item ${isActive('/jo-masterlist') ? 'active' : ''}`}
              onClick={() => navigate('/jo-masterlist')}
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
        <div className="main-content">
          <h2>Masterlist</h2>

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
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="notActive">Not Active</option>
                </select>
              </div>

              <div className="refresh-filter">
                <button
                  onClick={() => {
                    setLoading(true);
                    setError(null);
                    fetchRSBSARecords();
                  }}
                  className="refresh-button"
                  title="Refresh data"
                >
                  Refresh
                </button>
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
                      'Status',
                      'Actions'
                    ].map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={8} className="loading-cell">Loading...</td></tr>
                  )}

                  {error && !loading && (
                    <tr><td colSpan={8} className="error-cell">Error: {error}</td></tr>
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
                              {/* {record.totalFarmArea || 'N/A'}*/}
                            </span>
                          </td>
                          <td>
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <button
                                className="more-button"
                                onClick={(e) => toggleMenu(record.id, e)}
                                aria-haspopup="true"
                                aria-expanded={openMenuId === record.id}
                                title="More actions"
                              >
                                ...
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}

                  {!loading && !error && filteredRecords.length === 0 && (
                    Array.from({ length: 16 }).map((_, i) => (
                      <tr key={`empty-${i}`}>
                        <td colSpan={8}>&nbsp;</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {/* Global dropdown/menu for row actions */}
          {openMenuId && menuPosition && (
            <div
              className="more-menu"
              style={{
                position: 'absolute',
                top: menuPosition.top,
                left: menuPosition.left,
                minWidth: 160,
                background: '#ffffff',
                border: '1px solid #ddd',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                borderRadius: 6,
                zIndex: 1000,
                padding: 8
              }}
              role="menu"
            >
              <button
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  padding: '8px 10px',
                  cursor: 'pointer'
                }}
                onClick={() => handleEdit(openMenuId)}
                role="menuitem"
              >
                Edit
              </button>
              <button
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  padding: '8px 10px',
                  cursor: 'pointer',
                  color: '#d32f2f'
                }}
                onClick={() => { handleDelete(openMenuId); closeMenu(); }}
                role="menuitem"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {/* Edit Modal */}
        {editingRecord && (
          <div className="edit-modal-overlay">
            <div className="edit-modal">
              <div className="edit-modal-header">
                <h3>Edit Land Owner Information</h3>
                <button className="close-button" onClick={handleCancel}>×</button>
              </div>
              <div className="edit-modal-body">
                <div className="form-group">
                  <label>Last Name:</label>
                  <input
                    type="text"
                    value={editFormData.lastName || ''}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    placeholder="Last Name"
                  />
                </div>
                {/*Gender function kung may jan*/}
                {/*Birthdate function kung may jan*/}
                <div className="form-group">
                  <label>First Name:</label>
                  <input
                    type="text"
                    value={editFormData.firstName || ''}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    placeholder="First Name"
                  />
                </div>
                <div className="form-group">
                  <label>Middle Name:</label>
                  <input
                    type="text"
                    value={editFormData.middleName || ''}
                    onChange={(e) => handleInputChange('middleName', e.target.value)}
                    placeholder="Middle Name"
                  />
                </div>
                {/*Barangay function kung may jan*/}
                <div className="form-group">
                  <label>Barangay:</label>
                  <input
                    type="text"
                    value={editFormData.barangay || ''}
                    onChange={(e) => handleInputChange('barangay', e.target.value)}
                    placeholder="Barangay"
                  />
                </div>
                <div className="form-group">
                  <label>Municipality:</label>
                  <input
                    type="text"
                    value={editFormData.municipality || ''}
                    onChange={(e) => handleInputChange('municipality', e.target.value)}
                    placeholder="Municipality"
                  />
                </div>
                <div className="form-group">
                  <label>Parcel Area:</label>
                  <input
                    type="text"
                    value={editFormData.parcelArea || ''}
                    onChange={(e) => handleParcelAreaChange(e.target.value)}
                    placeholder="e.g., 2.5 (will show as '2.5 hectares')"
                  />
                </div>
              </div>
              <div className="edit-modal-footer">
                <button className="cancel-button" onClick={handleCancel}>Cancel</button>
                <button className="save-button" onClick={handleSave}>Save Changes</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JoMasterlist;