import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../assets/css/ActiveFarmersPage.css';
import '../../assets/css/joRsbsaStyle.css';

// Type for the tab keys
type TabKey = 'All Forms' | 'Pending' | 'Approved' | 'Rejected' | 'Draft Forms' | 'Reports';


interface JOFormRecord {
  id: string;
  referenceNumber: string;
  farmerName: string;
  barangay: string;
  dateSubmitted: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Draft';
  landParcel: string;
  updatedAt: string;
}

// Main component
const joRsbsa: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('Pending');
  const [records, setRecords] = useState<JOFormRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchForms = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/RSBSAform');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        const normalized: JOFormRecord[] = (Array.isArray(data) ? data : [])
          .map((item: any, idx: number) => {
            const fullName = [item.surname, item.firstName, item.middleName]
              .filter(Boolean)
              .join(', ');
            const submitted = item.createdAt || item.dateAdministered || '';
            return {
              id: String(item.id ?? `${idx}-${Math.random().toString(36).slice(2)}`),
              referenceNumber: String(item.referenceNumber ?? item.id ?? `RSBSA-${idx + 1}`),
              farmerName: fullName || '—',
              barangay: item.addressBarangay || '—',
              dateSubmitted: submitted ? new Date(submitted).toISOString() : '',
              status: (item.status as JOFormRecord['status']) || 'Pending',
              landParcel: String(item.parcelNumber ?? '—'),
              updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : (submitted ? new Date(submitted).toISOString() : ''),
            };
          });

        setRecords(normalized);
        setLoading(false);
      } catch (err: any) {
        setError(err.message ?? 'Failed to load forms');
        setLoading(false);
      }
    };

    fetchForms();
  }, []);

  const filteredRecords = useMemo(() => {
    if (activeTab === 'All Forms' || activeTab === 'Reports') return records;
    if (activeTab === 'Draft Forms') return records.filter(r => r.status === 'Draft');
    return records.filter(r => r.status === activeTab);
  }, [records, activeTab]);

  const tabs: TabKey[] = ['All Forms', 'Pending', 'Approved', 'Rejected', 'Draft Forms', 'Reports'];

  const formatDate = (iso: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return '—';
    }
  };

  return (
    <div className="jo-rsbsa-page active-farmer-page">
      <div className="jo-rsbsa-header farmers-header">
        <div className="farmers-header-left">
          <button className="back-button" onClick={() => navigate(-1)}>←</button>
        </div>
        <nav className="jo-rsbsa-tabs">
          {tabs.map(tab => (
            <button
              key={tab}
              className={`jo-rsbsa-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>
        <div className="farmers-header-right" />
      </div>

      <div className="scrollable-content">
        <div className="farmers-container">
          <div className="farmers-table-container">
            <table className="farmers-table">
              <thead>
                <tr>
                  <th>Reference Number</th>
                  <th>Farmer Name</th>
                  <th>Barangay</th>
                  <th>Date Submitted</th>
                  <th>Status</th>
                  <th>Land Parcel</th>
                  <th>Last Update</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={7}>Loading...</td></tr>
                )}
                {error && !loading && (
                  <tr><td colSpan={7}>Error: {error}</td></tr>
                )}
                {!loading && !error && filteredRecords.length > 0 && (
                  filteredRecords.map((rec) => (
                    <tr key={rec.id}>
                      <td>{rec.referenceNumber}</td>
                      <td>{rec.farmerName}</td>
                      <td>{rec.barangay}</td>
                      <td>{formatDate(rec.dateSubmitted)}</td>
                      <td>{rec.status}</td>
                      <td>{rec.landParcel}</td>
                      <td>{formatDate(rec.updatedAt)}</td>
                    </tr>
                  ))
                )}
                {!loading && !error && filteredRecords.length === 0 && (
                  Array.from({ length: 16 }).map((_, i) => (
                    <tr key={`ph-${i}`}>
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
  );
};

export default joRsbsa;