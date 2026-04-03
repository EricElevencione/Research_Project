import React, { useMemo } from "react";
import { useRSBSADemographics } from "../../hooks/useRSBSADemographics";
import {
  AgeDistributionChart,
  CropDistributionChart,
  FarmSizeCards,
  OwnershipBreakdownChart,
} from "../../components/RSBSA/RSBSADemographics";
import "../../assets/css/admin css/RSBSAStyle.css";

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
  parcelArea: number | string | null;
  totalFarmArea: number;
  parcelCount: number;
  ownershipType: {
    registeredOwner: boolean;
    tenant: boolean;
    lessee: boolean;
  };
}

interface AnalyticsProps {
  rsbsaRecords: RSBSARecord[];
  loading: boolean;
  error: string | null;
}

const Analytics: React.FC<AnalyticsProps> = ({
  rsbsaRecords,
  loading,
  error,
}) => {
  const demographics = useRSBSADemographics(rsbsaRecords);

  const topBarangays = useMemo(() => {
    const barangayCounts = new Map<string, number>();

    rsbsaRecords.forEach((record) => {
      const rawLocation = String(record.farmLocation || "").trim();
      const [firstSegment] = rawLocation.split(",");
      const barangay = firstSegment?.trim() || "N/A";
      barangayCounts.set(barangay, (barangayCounts.get(barangay) || 0) + 1);
    });

    const total = rsbsaRecords.length || 1;

    return Array.from(barangayCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([barangay, count]) => ({
        barangay,
        count,
        pct: (count / total) * 100,
      }));
  }, [rsbsaRecords]);

  if (loading) {
    return (
      <div className="rsbsa-admin-loading-container">
        <p>Loading demographics analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rsbsa-admin-error-container">
        <p>Error: {error}</p>
      </div>
    );
  }

  if (rsbsaRecords.length === 0) {
    return (
      <div className="rsbsa-admin-no-data">
        <p>No data available for demographics analysis</p>
      </div>
    );
  }

  return (
    <div className="rsbsa-demographics-section">
      <div className="rsbsa-demographics-header">
        <h2>Demographics Overview</h2>
        <span className="rsbsa-demographics-badge">ANALYTICS</span>
      </div>

      {/* Farm Size Cards - full width */}
      <FarmSizeCards
        data={demographics.farmSizeCategories}
        total={demographics.totalFarmers}
      />

      {/* Charts Grid: 2x2 */}
      <div className="rsbsa-demographics-grid" style={{ marginTop: 20 }}>
        <AgeDistributionChart data={demographics.ageBrackets} />
        <CropDistributionChart data={demographics.cropDistribution} />
        <OwnershipBreakdownChart
          data={demographics.ownershipBreakdown}
          total={demographics.totalFarmers}
        />
      </div>

      <div className="rsbsa-analytics-top-barangays">
        <div className="rsbsa-analytics-top-barangays-head">
          <h3>Top Barangays</h3>
          <span>Highest share of submitted records</span>
        </div>

        {topBarangays.length === 0 ? (
          <div className="rsbsa-analytics-top-barangays-empty">
            No barangay data available
          </div>
        ) : (
          <div className="rsbsa-analytics-top-barangays-list">
            {topBarangays.map((row) => (
              <div
                key={row.barangay}
                className="rsbsa-analytics-top-barangay-row"
              >
                <div className="rsbsa-analytics-top-barangay-labels">
                  <span>{row.barangay}</span>
                  <span>
                    {row.count} ({row.pct.toFixed(1)}%)
                  </span>
                </div>
                <div className="rsbsa-analytics-top-barangay-track">
                  <div
                    className="rsbsa-analytics-top-barangay-fill"
                    style={{ width: `${Math.min(row.pct, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;
