import React, { useState, useEffect } from 'react';

interface FarmParcel {
  id: number;
  submission_id: number;
  parcel_number: string;
  farm_location_barangay: string;
  farm_location_municipality: string;
  total_farm_area_ha: number;
  within_ancestral_domain: string;
  ownership_document_no: string;
  agrarian_reform_beneficiary: string;
  ownership_type_registered_owner: boolean;
  ownership_type_tenant: boolean;
  ownership_type_lessee: boolean;
  ownership_type_others: boolean;
  tenant_land_owner_name: string;
  lessee_land_owner_name: string;
  ownership_others_specify: string;
  created_at: string;
  updated_at: string;
  "LAST NAME": string;
  "FIRST NAME": string;
  "MIDDLE NAME": string;
}

const FarmParcelsList: React.FC = () => {
  const [parcels, setParcels] = useState<FarmParcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFarmParcels();
  }, []);

  const fetchFarmParcels = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/farm_parcels');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setParcels(data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching farm parcels:', err);
      setError('Failed to load farm parcels data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading farm parcels...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>Farm Parcels</h2>
      <div className="table-container">
        <table className="parcels-table">
          <thead>
            <tr>
              <th>Farmer Name</th>
              <th>Parcel No.</th>
              <th>Location</th>
              <th>Area (ha)</th>
              <th>Ownership Type</th>
              <th>Ancestral Domain</th>
              <th>ARB</th>
            </tr>
          </thead>
          <tbody>
            {parcels.length === 0 ? (
              <tr>
                <td colSpan={7} className="no-data">
                  No farm parcels found
                </td>
              </tr>
            ) : (
              parcels.map((parcel) => {
                const farmerName = `${parcel["FIRST NAME"]} ${parcel["MIDDLE NAME"]} ${parcel["LAST NAME"]}`.trim();
                const location = `${parcel.farm_location_barangay}, ${parcel.farm_location_municipality}`;
                
                const ownershipTypes = [];
                if (parcel.ownership_type_registered_owner) ownershipTypes.push('Registered Owner');
                if (parcel.ownership_type_tenant) ownershipTypes.push('Tenant');
                if (parcel.ownership_type_lessee) ownershipTypes.push('Lessee');
                if (parcel.ownership_type_others) ownershipTypes.push('Others');

                return (
                  <tr key={parcel.id}>
                    <td>{farmerName}</td>
                    <td>{parcel.parcel_number}</td>
                    <td>{location}</td>
                    <td>{parcel.total_farm_area_ha ? parcel.total_farm_area_ha.toFixed(2) : 'N/A'}</td>
                    <td>{ownershipTypes.join(', ') || 'N/A'}</td>
                    <td>{parcel.within_ancestral_domain || 'N/A'}</td>
                    <td>{parcel.agrarian_reform_beneficiary || 'N/A'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FarmParcelsList;



