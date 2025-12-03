import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import '../../assets/css/technician css/MasterlistPage.css';
import '../../components/layout/sidebarStyle.css';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import ApproveIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import FarmerIcon from '../../assets/images/farmer (1).png';
import IncentivesIcon from '../../assets/images/incentives.png';

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
  parcelArea?: string; // Add parcelArea as optional field
  parcelCount?: number; // Number of parcels owned by the farmer
  ownershipType: {
    registeredOwner: boolean;
    tenant: boolean;
    lessee: boolean;
  };
}

const TechRsbsa: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [, setRsbsaRecords] = useState<RSBSARecord[]>([]);
  const [registeredOwners, setRegisteredOwners] = useState<RSBSARecord[]>([]);
  const [filteredOwners, setFilteredOwners] = useState<RSBSARecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isActive = (path: string) => location.pathname === path;
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [editingRecord, setEditingRecord] = useState<RSBSARecord | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<RSBSARecord>>({});

  // List of barangays in Dumangas
  const barangays = [
    "Aurora-Del Pilar",
    "Bacay",
    "Bacong",
    "Balabag",
    "Balud",
    "Bantud",
    "Bantud Fabrica",
    "Baras",
    "Barasan",
    "Basa-Mabini Bonifacio",
    "Bolilao",
    "Buenaflor Embarkadero",
    "Burgos-Regidor",
    "Calao",
    "Cali",
    "Cansilayan",
    "Capaliz",
    "Cayos",
    "Compayan",
    "Dacutan",
    "Ermita",
    "Ilaya 1st",
    "Ilaya 2nd",
    "Ilaya 3rd",
    "Jardin",
    "Lacturan",
    "Lopez Jaena - Rizal",
    "Managuit",
    "Maquina",
    "Nanding Lopez",
    "Pagdugue",
    "Paloc Bigque",
    "Paloc Sool",
    "Patlad",
    "Pd Monfort North",
    "Pd Monfort South",
    "Pulao",
    "Rosario",
    "Sapao",
    "Sulangan",
    "Tabucan",
    "Talusan",
    "Tambobo",
    "Tamboilan",
    "Victorias"
  ].sort(); // Sort alphabetically for better user experience

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

  const closeMenu = () => {
    setOpenMenuId(null);
    setMenuPosition(null);
  };

  // Handle edit button click
  const handleEdit = (recordId: string) => {
    const recordToEdit = registeredOwners.find(record => record.id === recordId);
    if (recordToEdit) {
      setEditingRecord(recordToEdit);
      setEditFormData({
        farmerName: recordToEdit.farmerName,
        farmerAddress: recordToEdit.farmerAddress,
        farmLocation: recordToEdit.farmLocation,
        gender: recordToEdit.gender,
        birthdate: recordToEdit.birthdate,
        landParcel: recordToEdit.landParcel,
        parcelArea: extractParcelAreaNumber(recordToEdit.parcelArea || '')
      });
    }
    closeMenu();
  };

  // Handle form input changes
  const handleInputChange = (field: keyof RSBSARecord, value: string) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Format parcel area to include "hectares" if it's just a number
  const formatParcelArea = (value: string): string => {
    if (!value || value.trim() === '') return '';

    // If it's just a number, add "hectares"
    if (/^\d+(\.\d+)?$/.test(value.trim())) {
      return `${value.trim()} hectares`;
    }

    // If it already contains "hectares" or other text, return as is
    return value;
  };

  // Handle parcel area input specifically
  const handleParcelAreaChange = (value: string) => {
    setEditFormData(prev => ({
      ...prev,
      parcelArea: value
    }));
  };

  // Extract just the number from parcel area for editing
  const extractParcelAreaNumber = (value: string): string => {
    if (!value) return '';
    // If it contains "hectares", extract just the number part
    if (value.includes('hectares')) {
      return value.replace(/\s*hectares\s*$/i, '').trim();
    }
    return value;
  };

  // Handle save changes
  const handleSave = async () => {
    if (editingRecord && editFormData) {
      try {
        // Start with the existing record data
        const existingData = {
          farmerName: editingRecord.farmerName,
          gender: editingRecord.gender,
          birthdate: editingRecord.birthdate,
          farmerAddress: editingRecord.farmerAddress,
          farmLocation: editingRecord.farmLocation,
          parcelArea: editingRecord.parcelArea
        };

        // Format the data for submission
        const formattedData = {
          ...existingData,
          ...editFormData,
          // Format parcel area to include "hectares" if it's just a number
          parcelArea: editFormData.parcelArea ? formatParcelArea(editFormData.parcelArea) : undefined,
        };

        // Remove any undefined or empty values
        const cleanedData = Object.entries(formattedData)
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

        // Update the registeredOwners state
        setRegisteredOwners(prev =>
          prev.map(record =>
            record.id === editingRecord.id
              ? updatedRecordData
              : record
          )
        );

        // Also update the main rsbsaRecords state
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

  // Handle cancel edit
  const handleCancel = () => {
    setEditingRecord(null);
    setEditFormData({});
  };

  // Fetch RSBSA records from API
  const fetchRSBSARecords = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/rsbsa_submission');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Received RSBSA data from API:', data.length, 'records');
      console.log('Sample record:', data[0]);

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
    console.log('Filtering records:', records.length);

    const filtered = records.filter(record => {
      // Exclude farmers who have transferred ownership or have no parcels
      if (record.status === 'Transferred Ownership' || record.status === 'No Parcels') {
        return false;
      }

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

    console.log('Filtered results:', filtered.length, 'out of', records.length);
    return filtered;
  };

  // Filter records based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredOwners(registeredOwners);
      return;
    }

    const searchLower = searchTerm.toLowerCase();
    const filtered = registeredOwners.filter(record => {
      // Search in FFRS ID (both with and without dashes)
      const ffrsMatch = record.referenceNumber?.toLowerCase().includes(searchLower) ||
        record.referenceNumber?.replace(/-/g, '').toLowerCase().includes(searchLower);

      // Search in farmer name
      const nameMatch = record.farmerName?.toLowerCase().includes(searchLower);

      // Search in farmer address
      const addressMatch = record.farmerAddress?.toLowerCase().includes(searchLower);

      // Search in farm location
      const locationMatch = record.farmLocation?.toLowerCase().includes(searchLower);

      // Search in gender
      const genderMatch = record.gender?.toLowerCase().includes(searchLower);

      return ffrsMatch || nameMatch || addressMatch || locationMatch || genderMatch;
    });

    setFilteredOwners(filtered);
  }, [searchTerm, registeredOwners]);

  // Load data on component mount
  useEffect(() => {
    fetchRSBSARecords();
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId && !(event.target as Element).closest('.more-button') && !(event.target as Element).closest('.actions-menu')) {
        closeMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenuId]);

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
              className={`sidebar-nav-item ${isActive('/technician-farmerprofpage') ? 'active' : ''}`}
              onClick={() => navigate('/technician-farmerprofpage')}
            >
              <span className="nav-icon">
                <img src={FarmerIcon} alt="farmerProf" />
              </span>
              <span className="nav-text">Farmers Profile</span>
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
              <>
                {/* Search Input */}
                <div className="search-container">
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search by FFRS ID, Name, Address, Location, or Gender..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button
                      className="clear-search-button"
                      onClick={() => setSearchTerm('')}
                      title="Clear search"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="table-container">
                  <table className="owners-table">
                    <thead>
                      <tr>
                        <th>FFRS ID</th>
                        <th>Last Name</th>
                        <th>First Name</th>
                        <th>Middle Name</th>
                        <th>EXT Name</th>
                        <th>Gender</th>
                        <th>Birthdate</th>
                        <th>Farmer Address</th>
                        <th>Farm Location</th>
                        <th>Parcel Area</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOwners.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="no-data">
                            {searchTerm ? 'No matching records found' : 'No registered owners found'}
                          </td>
                        </tr>
                      ) : (
                        filteredOwners.map((record) => {
                          // Parse the farmer name to extract individual components
                          const nameParts = record.farmerName.split(', ');
                          const lastName = nameParts[0] || '';
                          const firstName = nameParts[1] || '';
                          const middleName = nameParts[2] || '';
                          const extName = nameParts[3] || '';

                          // Get parcel area from the record and format it
                          const parcelArea = record.parcelArea ?
                            (record.parcelArea.includes('hectares') ? record.parcelArea : `${record.parcelArea} hectares`)
                            : 'N/A';

                          return (
                            <tr key={record.id}>
                              <td className="ffrs-id">{record.referenceNumber || 'N/A'}</td>
                              <td>{lastName}</td>
                              <td>{firstName}</td>
                              <td>{middleName}</td>
                              <td>{extName}</td>
                              <td>{record.gender || 'N/A'}</td>
                              <td>{record.birthdate ? formatDate(record.birthdate) : 'N/A'}</td>
                              <td>{record.farmerAddress || 'N/A'}</td>
                              <td>{record.farmLocation || 'N/A'}</td>
                              <td>{parcelArea}</td>
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
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
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
                  <label>Farmer Name:</label>
                  <input
                    type="text"
                    value={editFormData.farmerName || ''}
                    onChange={(e) => handleInputChange('farmerName', e.target.value)}
                    placeholder="Last Name, First Name, Middle Name, Ext Name"
                  />
                </div>
                <div className="form-group">
                  <label>Gender:</label>
                  <select
                    value={editFormData.gender || ''}
                    onChange={(e) => handleInputChange('gender', e.target.value)}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Birthdate:</label>
                  <input
                    type="date"
                    value={editFormData.birthdate || ''}
                    onChange={(e) => handleInputChange('birthdate', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Farmer Address:</label>
                  <input
                    type="text"
                    value={editFormData.farmerAddress || ''}
                    onChange={(e) => handleInputChange('farmerAddress', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Farm Location (Barangay):</label>
                  <select
                    value={editFormData.farmLocation || ''}
                    onChange={(e) => handleInputChange('farmLocation', e.target.value)}
                  >
                    <option value="">Select Barangay</option>
                    {barangays.map((barangay) => (
                      <option key={barangay} value={barangay}>
                        {barangay}
                      </option>
                    ))}
                  </select>
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

        {/* Action Menu - rendered outside table */}
        {openMenuId && menuPosition && (
          <div
            className="actions-menu"
            style={{
              position: 'fixed',
              top: menuPosition.top,
              left: menuPosition.left,
            }}
          >
            <button onClick={() => { handleEdit(openMenuId); }}>Edit</button>
            <button onClick={() => { navigate(`/technician-pick-land-parcel/${openMenuId}`); closeMenu(); }}>Land Parcel</button>
          </div>
        )}
      </div>
    </div>

  );
};

export default TechRsbsa;