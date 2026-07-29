import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import type {
  RegionDashboardKPI,
  TopVariety,
  StockAlert,
  RequestStatusCounts,
  BarangayDemand,
  AllocationBurn
} from "../../hooks/useRegionDashboardStats";
import "../../components/Dashboard/AdminDashboardCharts.css";

// ─── KPI Cards ─────────────────────────────────────────────

interface RegionKPICardsProps {
  kpi: RegionDashboardKPI;
}

export const RegionKPICards: React.FC<RegionKPICardsProps> = ({ kpi }) => {
  const cards = [
    {
      label: "Total Farmers Reached",
      value: kpi.totalFarmersReached,
      color: "#16a34a",
      bgGradient: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
      borderColor: "#86efac",
    },
    {
      label: "Hectares Covered",
      value: kpi.totalHectaresCovered,
      color: "#0ea5e9",
      bgGradient: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
      borderColor: "#7dd3fc",
    },
    {
      label: "Active Requests",
      value: kpi.totalActiveRequests,
      color: "#8b5cf6",
      bgGradient: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
      borderColor: "#ddd6fe",
    },
    {
      label: "Fulfillment Rate",
      value: `${kpi.overallFulfillmentRate}%`,
      color: "#f59e0b",
      bgGradient: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
      borderColor: "#fcd34d",
    },
  ];

  return (
    <div className="admin-kpi-grid">
      {cards.map((card, idx) => (
        <div
          key={idx}
          className="admin-kpi-card"
          style={{
            background: card.bgGradient,
            borderColor: card.borderColor,
          }}
        >
          <div className="admin-kpi-content">
            <div className="admin-kpi-value" style={{ color: card.color }}>
              {typeof card.value === "number" ? card.value.toLocaleString() : card.value}
            </div>
            <div className="admin-kpi-label">{card.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Top Varieties Bar Chart ──────────────────────────

interface TopVarietiesChartProps {
  data: TopVariety[];
}

export const TopVarietiesChart: React.FC<TopVarietiesChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="admin-chart-empty">
        <p>No variety demand data available.</p>
      </div>
    );
  }

  return (
    <div className="admin-chart-wrapper">
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis type="number" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={{ stroke: "#d1d5db" }} />
          <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={{ stroke: "#d1d5db" }} />
          <Tooltip cursor={{fill: 'transparent'}} />
          <Bar dataKey="totalRequested" name="Total Requested" radius={[0, 4, 4, 0]} maxBarSize={40}>
            {
              data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.type === 'seed' ? '#0ea5e9' : '#16a34a'} />
              ))
            }
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── Request Status Pie Chart ──────────────────────────

interface RequestStatusChartProps {
  stats: RequestStatusCounts;
}

const COLORS = {
  pending: '#f59e0b',
  approved: '#3b82f6',
  distributed: '#10b981',
  rejected: '#ef4444'
};

export const RequestStatusChart: React.FC<RequestStatusChartProps> = ({ stats }) => {
  const data = [
    { name: 'Pending', value: stats.pending, color: COLORS.pending },
    { name: 'Approved', value: stats.approved, color: COLORS.approved },
    { name: 'Distributed', value: stats.distributed, color: COLORS.distributed },
    { name: 'Rejected', value: stats.rejected, color: COLORS.rejected },
  ].filter(item => item.value > 0);

  if (data.length === 0) {
    return (
      <div className="admin-chart-empty">
        <p>No request status data available.</p>
      </div>
    );
  }

  return (
    <div className="admin-chart-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend verticalAlign="bottom" height={36}/>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── Stock Shortage Alerts ───────────────────────────────

interface StockAlertsProps {
  alerts: StockAlert[];
}

export const StockShortageAlerts: React.FC<StockAlertsProps> = ({ alerts }) => {
  if (!alerts || alerts.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#16a34a', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          No Stock Shortages Detected
        </h3>
        <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem' }}>All requested items are well within allocated limits.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto', paddingRight: '8px' }}>
      {alerts.map((alert, idx) => (
        <div key={idx} style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px',
          background: '#fff1f2',
          border: '1px solid #fecdd3',
          borderRadius: '12px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
        }}>
          <div>
            <div style={{ fontWeight: '600', color: '#be123c', fontSize: '1.1rem' }}>{alert.name}</div>
            <div style={{ fontSize: '0.85rem', color: '#f43f5e', marginTop: '4px' }}>
              Shortage: <strong>{alert.shortageAmount.toLocaleString()}</strong> units
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#64748b' }}>
            Requested: {alert.totalRequested.toLocaleString()} <br/>
            Remaining Stock: {alert.remainingStock.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Allocation Burn Rate ───────────────────────────────

interface AllocationBurnProps {
  burnRates: AllocationBurn[];
}

export const AllocationBurnList: React.FC<AllocationBurnProps> = ({ burnRates }) => {
  if (!burnRates || burnRates.length === 0) {
    return (
      <div className="admin-chart-empty">
        <p>No active allocations to track.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '300px', overflowY: 'auto', paddingRight: '8px' }}>
      {burnRates.map((burn, idx) => (
        <div key={idx} style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontWeight: 600, color: '#334155' }}>{burn.label}</span>
            <span style={{ fontWeight: 700, color: burn.burnRatePercent > 90 ? '#ef4444' : '#10b981' }}>{burn.burnRatePercent}% Used</span>
          </div>
          <div className="inventory-progress-bar" style={{ height: '10px', background: '#cbd5e1' }}>
            <div 
              className="inventory-progress-fill" 
              style={{ 
                width: `${Math.min(100, burn.burnRatePercent)}%`,
                background: burn.burnRatePercent > 90 ? '#ef4444' : burn.burnRatePercent > 70 ? '#f59e0b' : '#10b981'
              }} 
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.8rem', color: '#64748b' }}>
            <span>Distributed: {burn.totalDistributed.toLocaleString()}</span>
            <span>Allocated: {burn.totalAllocated.toLocaleString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Barangay Demand List ───────────────────────────────

interface BarangayDemandProps {
  demands: BarangayDemand[];
}

export const BarangayDemandList: React.FC<BarangayDemandProps> = ({ demands }) => {
  if (!demands || demands.length === 0) {
    return (
      <div className="admin-chart-empty">
        <p>No barangay demand data available.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto', paddingRight: '8px' }}>
      {demands.map((demand, idx) => (
        <div key={idx} style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px'
        }}>
          <div style={{ fontWeight: 600, color: '#334155' }}>
            {idx + 1}. {demand.name}
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#64748b' }}>
            <div style={{ fontWeight: 600, color: '#0ea5e9' }}>{demand.totalRequests.toLocaleString()} requests</div>
            <div>{demand.totalBagsOrKg.toLocaleString()} units</div>
          </div>
        </div>
      ))}
    </div>
  );
};
