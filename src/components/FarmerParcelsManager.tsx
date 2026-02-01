import React, { useState, useEffect } from 'react';

interface FarmerSummary {
  submission_id: number;
  "LAST NAME": string;
  "FIRST NAME": string;
  "MIDDLE NAME": string;
  "BARANGAY": string;
  "MUNICIPALITY": string;
  total_parcels: number;
  total_farm_area: number;
  submitted_at: string;
}

interface FarmParcel {
  id: number;
  submission_id: number;
  parcel_number: string;
  farm_location_barangay: string;
  farm_location_municipality: string;
  total_farm_area_ha: number;
  within_ancestral_domain: string;
  ownership_type_registered_owner: boolean;
  ownership_type_tenant: boolean;
  ownership_type_lessee: boolean;
  ownership_type_others: boolean;
  "LAST NAME": string;
  "FIRST NAME": string;
  "MIDDLE NAME": string;
}

const FarmerParcelsManager: React.FC = () => {
  const [farmers, setFarmers] = useState<FarmerSummary[]>([]);
  const [selectedFarmer, setSelectedFarmer] = useState<FarmerSummary | null>(null);
  const [farmerParcels, setFarmerParcels] = useState<FarmParcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFarmersSummary();
  }, []);

  const fetchFarmersSummary = async () => {
    try {
      setLoading(true);
      // Return empty data since this endpoint is not available in Supabase
      const data: any[] = [];
      console.log('Note: farmers/summary endpoint is not available in Supabase');
      setFarmers(data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching farmers summary:', err);
      setError('Failed to load farmers data');
    } finally {
      setLoading(false);
    }
  };

  const fetchFarmerParcels = async (farmer: FarmerSummary) => {
    try {
      setLoading(true);
      // Return empty data since this endpoint is not available in Supabase
      const data: any[] = [];
      console.log('Note: farm_parcels/by-farmer endpoint is not available in Supabase');
      setFarmerParcels(data);
      setSelectedFarmer(farmer);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching farmer parcels:', err);
      setError('Failed to load farmer parcels');
    } finally {
      setLoading(false);
    }
  };

  if (loading && farmers.length === 0) return <div>Loading farmers...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="farmer-parcels-manager">
      <h2>Farmer Parcels Management</h2>

      {/* Farmers Summary Table */}
      <div className="farmers-summary">
        <h3>All Farmers Summary</h3>
        <div className="table-container">
          <table className="farmers-table">
            <thead>
              <tr>
                <th>Farmer Name</th>
                <th>Location</th>
                <th>Total Parcels</th>
                <th>Total Farm Area (ha)</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {farmers.map((farmer) => {
                const fullName = `${farmer["FIRST NAME"]} ${farmer["MIDDLE NAME"]} ${farmer["LAST NAME"]}`.trim();
                const location = `${farmer["BARANGAY"]}, ${farmer["MUNICIPALITY"]}`;
                const submittedDate = new Date(farmer.submitted_at).toLocaleDateString();

                return (
                  <tr key={farmer.submission_id}>
                    <td>{fullName}</td>
                    <td>{location}</td>
                    <td>{farmer.total_parcels}</td>
                    <td>{farmer.total_farm_area.toFixed(2)}</td>
                    <td>{submittedDate}</td>
                    <td>
                      <button
                        onClick={() => fetchFarmerParcels(farmer)}
                        className="btn-view-parcels"
                      >
                        View Parcels
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Farmer's Parcels */}
      {selectedFarmer && (
        <div className="farmer-parcels-detail">
          <h3>
            Parcels for {selectedFarmer["FIRST NAME"]} {selectedFarmer["LAST NAME"]}
            ({farmerParcels.length} parcels)
          </h3>

          {loading ? (
            <div>Loading parcels...</div>
          ) : (
            <div className="table-container">
              <table className="parcels-table">
                <thead>
                  <tr>
                    <th>Parcel No.</th>
                    <th>Location</th>
                    <th>Area (ha)</th>
                    <th>Ancestral Domain</th>
                    <th>Ownership Type</th>
                  </tr>
                </thead>
                <tbody>
                  {farmerParcels.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="no-data">
                        No parcels found for this farmer
                      </td>
                    </tr>
                  ) : (
                    farmerParcels.map((parcel) => {
                      const location = `${parcel.farm_location_barangay}, ${parcel.farm_location_municipality}`;

                      const ownershipTypes = [];
                      if (parcel.ownership_type_registered_owner) ownershipTypes.push('Registered Owner');
                      if (parcel.ownership_type_tenant) ownershipTypes.push('Tenant');
                      if (parcel.ownership_type_lessee) ownershipTypes.push('Lessee');
                      if (parcel.ownership_type_others) ownershipTypes.push('Others');

                      return (
                        <tr key={parcel.id}>
                          <td>{parcel.parcel_number}</td>
                          <td>{location}</td>
                          <td>{parcel.total_farm_area_ha ? parcel.total_farm_area_ha.toFixed(2) : 'N/A'}</td>
                          <td>{parcel.within_ancestral_domain || 'N/A'}</td>
                          <td>{ownershipTypes.join(', ') || 'N/A'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FarmerParcelsManager;
