import React, { useMemo } from "react";
import "./AllocationVisuals.css";
import {
  FERTILIZER_FIELD_MAPS,
  SEED_FIELD_MAPS,
} from "../../constants/shortageFieldMaps";

// ─── Types ─────────────────────────────────────────────────

interface GaugeItem {
  name: string;
  allocated: number;
  requested: number;
  unit: string;
}

interface BarangayRow {
  barangay: string;
  totalFertBags: number;
  totalSeedKg: number;
  farmerCount: number;
}

// ─── Usage Gauges Section (Now Tables) ─────────────────────

interface UsageGaugesProps {
  fertilizers: GaugeItem[];
  seeds: GaugeItem[];
}

export const UsageGauges: React.FC<UsageGaugesProps> = ({
  fertilizers,
  seeds,
}) => {
  return (
    <div className="alloc-gauges-section">
      {/* Fertilizers */}
      {fertilizers.length > 0 && (
        <div className="alloc-gauges-group" style={{ padding: '0', overflow: 'hidden' }}>
          <div className="alloc-gauges-group-header" style={{ padding: '20px 20px 16px 20px', margin: 0, borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1f2937' }}>Fertilizer Depletion</h3>
          </div>
          <div className="alloc-brgy-table-wrap">
            <table className="alloc-brgy-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th style={{ textAlign: 'right' }}>Allocated</th>
                  <th style={{ textAlign: 'right' }}>Requested</th>
                  <th style={{ textAlign: 'right' }}>Remaining</th>
                  <th style={{ textAlign: 'center' }}>Depleted</th>
                </tr>
              </thead>
              <tbody>
                {fertilizers.map((f) => {
                  const pct = f.allocated > 0 ? (f.requested / f.allocated) * 100 : 0;
                  const remaining = f.allocated - f.requested;
                  const isOver = remaining < 0;
                  return (
                    <tr key={f.name}>
                      <td style={{ fontWeight: 600, color: '#1f2937' }}>{f.name}</td>
                      <td style={{ textAlign: 'right' }}>{f.allocated.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span style={{ color: '#9ca3af', fontSize: '11px' }}>{f.unit}</span></td>
                      <td style={{ textAlign: 'right' }}>{f.requested.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span style={{ color: '#9ca3af', fontSize: '11px' }}>{f.unit}</span></td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: isOver ? '#ef4444' : '#16a34a' }}>
                        {Math.abs(remaining).toLocaleString(undefined, { maximumFractionDigits: 1 })} <span style={{ color: '#9ca3af', fontSize: '11px', fontWeight: 400 }}>{isOver ? 'over' : 'left'}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                         <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                           <div style={{ height: '6px', width: '60px', background: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                             <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: pct > 100 ? '#ef4444' : pct > 80 ? '#f59e0b' : '#16a34a' }}></div>
                           </div>
                           <span style={{ fontSize: '12px', fontWeight: 600, color: pct > 100 ? '#ef4444' : pct > 80 ? '#f59e0b' : '#374151', width: '36px', textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                         </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Seeds */}
      {seeds.length > 0 && (
        <div className="alloc-gauges-group" style={{ padding: '0', overflow: 'hidden' }}>
          <div className="alloc-gauges-group-header" style={{ padding: '20px 20px 16px 20px', margin: 0, borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1f2937' }}>Seed Depletion</h3>
          </div>
          <div className="alloc-brgy-table-wrap">
            <table className="alloc-brgy-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th style={{ textAlign: 'right' }}>Allocated</th>
                  <th style={{ textAlign: 'right' }}>Requested</th>
                  <th style={{ textAlign: 'right' }}>Remaining</th>
                  <th style={{ textAlign: 'center' }}>Depleted</th>
                </tr>
              </thead>
              <tbody>
                {seeds.map((s) => {
                  const pct = s.allocated > 0 ? (s.requested / s.allocated) * 100 : 0;
                  const remaining = s.allocated - s.requested;
                  const isOver = remaining < 0;
                  return (
                    <tr key={s.name}>
                      <td style={{ fontWeight: 600, color: '#1f2937' }}>{s.name}</td>
                      <td style={{ textAlign: 'right' }}>{s.allocated.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span style={{ color: '#9ca3af', fontSize: '11px' }}>{s.unit}</span></td>
                      <td style={{ textAlign: 'right' }}>{s.requested.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span style={{ color: '#9ca3af', fontSize: '11px' }}>{s.unit}</span></td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: isOver ? '#ef4444' : '#0ea5e9' }}>
                        {Math.abs(remaining).toLocaleString(undefined, { maximumFractionDigits: 1 })} <span style={{ color: '#9ca3af', fontSize: '11px', fontWeight: 400 }}>{isOver ? 'over' : 'left'}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                         <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                           <div style={{ height: '6px', width: '60px', background: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                             <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: pct > 100 ? '#ef4444' : pct > 80 ? '#f59e0b' : '#0ea5e9' }}></div>
                           </div>
                           <span style={{ fontSize: '12px', fontWeight: 600, color: pct > 100 ? '#ef4444' : pct > 80 ? '#f59e0b' : '#374151', width: '36px', textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                         </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State when both are 0 */}
      {fertilizers.length === 0 && seeds.length === 0 && (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '12px', width: '100%' }}>
          No resources have been allocated or requested for this program yet.
        </div>
      )}
    </div>
  );
};

// ─── Barangay Allocation Breakdown Table ───────────────────

interface BarangayBreakdownProps {
  requests: any[];
}

export const BarangayBreakdownTable: React.FC<BarangayBreakdownProps> = ({
  requests,
}) => {
  const rows = useMemo(() => {
    const map = new Map<
      string,
      { totalFert: number; totalSeed: number; count: number }
    >();

    requests.forEach((r) => {
      const brgy = r.barangay || "Unknown";
      const existing = map.get(brgy) || {
        totalFert: 0,
        totalSeed: 0,
        count: 0,
      };

      const fert = FERTILIZER_FIELD_MAPS.reduce((sum, fertilizerField) => {
        if (fertilizerField.unit !== "bags") return sum;
        return sum + (Number((r as any)[fertilizerField.requestField]) || 0);
      }, 0);

      const seed = SEED_FIELD_MAPS.reduce(
        (sum, seedField) =>
          sum + (Number((r as any)[seedField.requestField]) || 0),
        0,
      );

      map.set(brgy, {
        totalFert: existing.totalFert + fert,
        totalSeed: existing.totalSeed + seed,
        count: existing.count + 1,
      });
    });

    const result: BarangayRow[] = [];
    map.forEach((v, k) => {
      result.push({
        barangay: k,
        totalFertBags: v.totalFert,
        totalSeedKg: v.totalSeed,
        farmerCount: v.count,
      });
    });

    // Sort by total fertilizer descending
    result.sort((a, b) => b.totalFertBags - a.totalFertBags);
    return result;
  }, [requests]);

  const maxFert = Math.max(...rows.map((r) => r.totalFertBags), 1);
  const maxSeed = Math.max(...rows.map((r) => r.totalSeedKg), 1);

  return (
    <div className="alloc-brgy-section">
      <div className="alloc-brgy-header">
        <h3>Barangay-Level Allocation Breakdown</h3>
        <span className="alloc-brgy-subtitle">
          Which barangays received the most / least
        </span>
      </div>
      <div className="alloc-brgy-table-wrap">
        <table className="alloc-brgy-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Barangay</th>
              <th>Farmers</th>
              <th>Fertilizer (bags)</th>
              <th>Seeds (kg)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="alloc-brgy-empty">
                  No requests yet for this season
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={row.barangay}>
                  <td className="alloc-brgy-rank">{idx + 1}</td>
                  <td className="alloc-brgy-name">{row.barangay}</td>
                  <td className="alloc-brgy-count">{row.farmerCount}</td>
                  <td>
                    <div className="alloc-brgy-bar-wrap">
                      <div
                        className="alloc-brgy-bar fert"
                        style={{
                          width: `${(row.totalFertBags / maxFert) * 100}%`,
                        }}
                      />
                      <span className="alloc-brgy-bar-value">
                        {row.totalFertBags.toFixed(1)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="alloc-brgy-bar-wrap">
                      <div
                        className="alloc-brgy-bar seed"
                        style={{
                          width: `${(row.totalSeedKg / maxSeed) * 100}%`,
                        }}
                      />
                      <span className="alloc-brgy-bar-value">
                        {row.totalSeedKg.toFixed(1)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Season Comparison Table ───────────────────────────────

interface SeasonComparisonTableProps {
  allocations: any[];
}

const FERT_FIELDS = [
  ...FERTILIZER_FIELD_MAPS.map((fertilizer) => ({
    key: fertilizer.allocationField,
    label: fertilizer.label,
    unit: fertilizer.unit,
  })),
];

const SEED_FIELDS = [
  ...SEED_FIELD_MAPS.map((seed) => ({
    key: seed.allocationField,
    label: seed.label,
    unit: seed.unit,
  })),
];

const formatSeason = (season: string) => {
  const [type, year] = season.split("_");
  return `${type.charAt(0).toUpperCase() + type.slice(1)} ${year}`;
};

export const SeasonComparisonTable: React.FC<SeasonComparisonTableProps> = ({
  allocations,
}) => {
  const seasons = useMemo(() => {
    return allocations
      .sort((a, b) => a.season.localeCompare(b.season))
      .map((a) => {
        const row = a as { season: string; id?: number };
        const uniqueKey =
          row.id != null && Number.isFinite(Number(row.id))
            ? `alloc-${row.id}`
            : `season-${row.season}`;
        return {
          uniqueKey,
          season: row.season,
          label: formatSeason(row.season),
          values: a as Record<string, number>,
        };
      });
  }, [allocations]);

  if (seasons.length === 0) return null;

  const renderRow = (field: { key: string; label: string; unit: string }) => {
    const vals = seasons.map((s) => Number(s.values[field.key]) || 0);
    const max = Math.max(...vals, 1);

    return (
      <tr key={field.key}>
        <td className="alloc-season-item-name">
          {field.label}
          <span className="alloc-season-unit">{field.unit}</span>
        </td>
        {seasons.map((s, i) => {
          const val = vals[i];
          return (
            <td key={s.uniqueKey} className="alloc-season-val-cell">
              <div className="alloc-season-val-bar-wrap">
                <div
                  className="alloc-season-val-bar"
                  style={{
                    width: `${(val / max) * 100}%`,
                    backgroundColor: i === 0 ? "#16a34a" : "#0ea5e9",
                  }}
                />
              </div>
              <span className="alloc-season-val">
                {val.toLocaleString(undefined, { maximumFractionDigits: 1 })}
              </span>
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <div className="alloc-season-section">
      <div className="alloc-season-header">
        <h3>Season-by-Season Comparison</h3>
        <span className="alloc-season-subtitle">
          Side-by-side allocation amounts
        </span>
      </div>
      <div className="alloc-season-table-wrap">
        <table className="alloc-season-table">
          <thead>
            <tr>
              <th>Item</th>
              {seasons.map((s) => (
                <th key={s.uniqueKey}>{s.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Fertilizers group */}
            <tr className="alloc-season-group-row">
              <td colSpan={seasons.length + 1}>🌱 Fertilizers</td>
            </tr>
            {FERT_FIELDS.map(renderRow)}

            {/* Seeds group */}
            <tr className="alloc-season-group-row">
              <td colSpan={seasons.length + 1}>🌾 Seeds</td>
            </tr>
            {SEED_FIELDS.map(renderRow)}
          </tbody>
        </table>
      </div>
    </div>
  );
};
