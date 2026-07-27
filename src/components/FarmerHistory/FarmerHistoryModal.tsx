import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getFarmerHistory } from "../../api";
import ParcelGeometryPreview from "../FarmerProfile/ParcelGeometryPreview";
import { printHtmlReport } from "../../utils/printHelper";
import "./farmerHistoryModal.css";
import {
  FaMap,
  FaChevronDown,
  FaChevronUp,
  FaPrint,
  FaMapMarkerAlt,
  FaVenusMars,
  FaCalendarAlt,
  FaIdBadge,
  FaExclamationTriangle,
  FaHome,
  FaSeedling,
} from "react-icons/fa";

// ─────────────────────────────────────────────────────────────────────────────
// FarmerHistoryModal  (v2 – Dual-Perspective Layout)
//
// Shows the land tenure story from the farmer's own angle:
//   • If landowner  → "Lands Owned" section (parcels + who's farming them)
//   • If tenant/lessee → "Lands Being Farmed" section (parcels + owner info)
//   • If both → shows both sections separated by a divider
//
// Each parcel card has an expandable per-parcel timeline.
// ─────────────────────────────────────────────────────────────────────────────

// ── Props ──────────────────────────────────────────────────────────────────

export interface FarmerHistoryModalProps {
  submissionId: number;
  /** Short label shown in the modal header subtitle (e.g. farmer name) */
  farmerLabel?: string;
  onClose: () => void;
}

// ── Internal types ─────────────────────────────────────────────────────────

interface FarmerProfile {
  id: number;
  farmerName: string;
  ffrsCode: string | null;
  barangay: string | null;
  municipality: string | null;
  gender: string | null;
  birthdate: string | null;
  mainLivelihood: string | null;
  status: string | null;
  archivedAt: string | null;
  archiveReason: string | null;
  farmerRice: boolean;
  farmerCorn: boolean;
  farmerOtherCrops: boolean;
  farmerOtherCropsText: string | null;
  farmerLivestock: boolean;
  farmerLivestockText: string | null;
  farmerPoultry: boolean;
  farmerPoultryText: string | null;
  submittedAt: string | null;
  ownershipCategory: string | null;
}

interface HistoryEvent {
  id: number;
  parcel_number: string | null;
  farm_location_barangay: string | null;
  total_farm_area_ha: number | null;
  land_owner_name: string | null;
  land_owner_id: number | null;
  farmer_id: number | null;
  farmer_name: string | null;
  is_registered_owner: boolean;
  is_tenant: boolean;
  is_lessee: boolean;
  is_current: boolean;
  period_start_date: string | null;
  period_end_date: string | null;
  change_type: string | null;
  change_reason: string | null;
  created_at: string | null;
  geometry: any | null;
  _source: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const formatDate = (value: string | null | undefined): string => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })
    : "—";
};

const calculateAge = (birthdate: string | null): string => {
  if (!birthdate) return "—";
  const b = new Date(birthdate);
  if (!Number.isFinite(b.getTime())) return "—";
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age > 0 ? `${age} yrs` : "—";
};

const getInitials = (name: string): string => {
  const parts = name.split(",").map((p) => p.trim());
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
};

const buildActivities = (p: FarmerProfile): string[] => {
  const a: string[] = [];
  if (p.farmerRice) a.push("Rice");
  if (p.farmerCorn) a.push("Corn");
  if (p.farmerOtherCrops) a.push(p.farmerOtherCropsText ? `Crops (${p.farmerOtherCropsText})` : "Other Crops");
  if (p.farmerLivestock) a.push(p.farmerLivestockText ? `Livestock (${p.farmerLivestockText})` : "Livestock");
  if (p.farmerPoultry) a.push(p.farmerPoultryText ? `Poultry (${p.farmerPoultryText})` : "Poultry");
  return a;
};

const isSameNameFn = (n1: string | null, n2: string | null): boolean => {
  if (!n1 || !n2) return false;
  const t1 = n1.toLowerCase().replace(/,/g, " ").split(/\s+/).filter(Boolean).sort().join(" ");
  const t2 = n2.toLowerCase().replace(/,/g, " ").split(/\s+/).filter(Boolean).sort().join(" ");
  return t1 === t2;
};

const getEventInfo = (changeType: string | null) => {
  const ct = String(changeType || "").trim().toLowerCase();
  if (ct === "registered" || ct.includes("registr"))
    return { label: "Registered", dotCls: "fhm-dot-registered", badgeCls: "fhm-event-registered" };
  if (ct.includes("transfer") || ct.includes("ownership"))
    return { label: "Transfer", dotCls: "fhm-dot-transfer", badgeCls: "fhm-event-transfer" };
  if (ct.includes("update") || ct.includes("modif") || ct.includes("edit"))
    return { label: "Update", dotCls: "fhm-dot-update", badgeCls: "fhm-event-update" };
  if (ct.includes("remov") || ct.includes("expir") || ct.includes("delet"))
    return { label: "Removal", dotCls: "fhm-dot-removal", badgeCls: "fhm-event-removal" };
  return { label: changeType || "Event", dotCls: "fhm-dot-default", badgeCls: "fhm-event-default" };
};

const getOccupantRole = (ev: HistoryEvent) => {
  if (ev.is_tenant) return { label: "Tenant", icon: "🤝", cls: "fhm-role-tenant" };
  if (ev.is_lessee) return { label: "Lessee", icon: "📋", cls: "fhm-role-lessee" };
  if (ev.is_registered_owner) return { label: "Owner", icon: "🌾", cls: "fhm-role-owner" };
  return { label: "Unknown", icon: "❓", cls: "fhm-role-unknown" };
};

/** Groups events by parcel number and sorts each group oldest first */
const groupByParcel = (events: HistoryEvent[]): Record<string, HistoryEvent[]> => {
  const groups: Record<string, HistoryEvent[]> = {};
  events.forEach((ev) => {
    const key = String(ev.parcel_number || "UNKNOWN").trim().toUpperCase();
    if (!groups[key]) groups[key] = [];
    groups[key].push(ev);
  });
  Object.keys(groups).forEach((key) => {
    groups[key].sort((a, b) => {
      const da = a.period_start_date || a.created_at || "";
      const db = b.period_start_date || b.created_at || "";
      return da.localeCompare(db);
    });
  });
  return groups;
};

// ── Component ──────────────────────────────────────────────────────────────

const FarmerHistoryModal: React.FC<FarmerHistoryModalProps> = ({
  submissionId,
  farmerLabel,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ profile: FarmerProfile; events: HistoryEvent[] } | null>(null);
  const [expandedTimelines, setExpandedTimelines] = useState<Set<string>>(new Set());
  const [expandedMaps, setExpandedMaps] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"all" | "owner" | "cultivation" | "tenants">("all");

  // Load history when modal opens
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      setData(null);
      setExpandedTimelines(new Set());
      setExpandedMaps(new Set());

      const res = await getFarmerHistory(submissionId);
      if (cancelled) return;
      if (res.error) {
        setError(res.error);
      } else if (res.data) {
        setData(res.data as { profile: FarmerProfile; events: HistoryEvent[] });
      }
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const toggleTimeline = useCallback((key: string) => {
    setExpandedTimelines((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const toggleMap = useCallback((key: string) => {
    setExpandedMaps((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  // ── Role-split parcel groups ─────────────────────────────────────────────
  const { 
    ownerParcels, 
    occupantParcels, 
    activeOwnerParcels, 
    historicalOwnerParcels, 
    activeOccupantParcels, 
    historicalOccupantParcels,
    isOwnerFarmer, 
    isOccupantFarmer 
  } = useMemo(() => {
    if (!data) {
      return {
        ownerParcels: {} as Record<string, HistoryEvent[]>,
        occupantParcels: {} as Record<string, HistoryEvent[]>,
        activeOwnerParcels: {} as Record<string, HistoryEvent[]>,
        historicalOwnerParcels: {} as Record<string, HistoryEvent[]>,
        activeOccupantParcels: {} as Record<string, HistoryEvent[]>,
        historicalOccupantParcels: {} as Record<string, HistoryEvent[]>,
        isOwnerFarmer: false,
        isOccupantFarmer: false,
      };
    }
    const farmerName = data.profile.farmerName;

    // Events where this farmer is the land OWNER
    const ownerEvents = data.events.filter(
      (ev) =>
        ev.is_registered_owner ||
        (ev.land_owner_id !== undefined && ev.land_owner_id !== null
          ? ev.land_owner_id === data.profile.id
          : isSameNameFn(ev.land_owner_name, farmerName))
    );

    // Events where this farmer is an OCCUPANT (tenant or lessee)
    const occupantEvents = data.events.filter(
      (ev) =>
        (ev.is_tenant || ev.is_lessee) &&
        (ev.farmer_id !== undefined && ev.farmer_id !== null
          ? ev.farmer_id === data.profile.id
          : isSameNameFn(ev.farmer_name, farmerName))
    );

    const groupedOwner = groupByParcel(ownerEvents);
    const groupedOccupant = groupByParcel(occupantEvents);

    const activeOwner: Record<string, HistoryEvent[]> = {};
    const historicalOwner: Record<string, HistoryEvent[]> = {};
    const activeOccupant: Record<string, HistoryEvent[]> = {};
    const historicalOccupant: Record<string, HistoryEvent[]> = {};

    Object.keys(groupedOwner).forEach((key) => {
      const events = groupedOwner[key];
      // Check if the farmer currently owns this parcel (is registered owner and is current)
      const hasCurrentOwner = events.some((e) => e.is_registered_owner && e.is_current);
      if (hasCurrentOwner) {
        activeOwner[key] = events;
      } else {
        historicalOwner[key] = events;
      }
    });

    Object.keys(groupedOccupant).forEach((key) => {
      const events = groupedOccupant[key];
      // Check if the farmer currently occupies this parcel (is tenant/lessee and is current)
      const hasCurrentOccupant = events.some((e) => (e.is_tenant || e.is_lessee) && e.is_current);
      if (hasCurrentOccupant) {
        activeOccupant[key] = events;
      } else {
        historicalOccupant[key] = events;
      }
    });

    return {
      ownerParcels: groupedOwner,
      occupantParcels: groupedOccupant,
      activeOwnerParcels: activeOwner,
      historicalOwnerParcels: historicalOwner,
      activeOccupantParcels: activeOccupant,
      historicalOccupantParcels: historicalOccupant,
      isOwnerFarmer: ownerEvents.length > 0,
      isOccupantFarmer: occupantEvents.length > 0,
    };
  }, [data]);

  // ── Summary stats ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!data) {
      return {
        ownedCount: 0,
        currentlyOwnedCount: 0,
        totalOwnedArea: 0,
        farmingCount: 0,
        currentlyFarmingCount: 0,
        totalFarmingArea: 0,
        yearsOnRecord: "—",
      };
    }

    const ownedCurrent = Object.values(ownerParcels).filter((evs) =>
      evs.some((e) => e.is_current)
    );
    const farmingCurrent = Object.values(occupantParcels).filter((evs) =>
      evs.some((e) => e.is_current)
    );

    const ownedArea = ownedCurrent.reduce((sum, evs) => {
      const cur = evs.find((e) => e.is_current);
      return sum + (cur ? Number(cur.total_farm_area_ha) || 0 : 0);
    }, 0);

    const farmingArea = farmingCurrent.reduce((sum, evs) => {
      const cur = evs.find((e) => e.is_current);
      return sum + (cur ? Number(cur.total_farm_area_ha) || 0 : 0);
    }, 0);

    const first = data.events[0]?.period_start_date || data.events[0]?.created_at;
    const yrs = first ? Math.max(0, new Date().getFullYear() - new Date(first).getFullYear()) : 0;

    return {
      ownedCount: Object.keys(ownerParcels).length,
      currentlyOwnedCount: ownedCurrent.length,
      totalOwnedArea: ownedArea,
      farmingCount: Object.keys(occupantParcels).length,
      currentlyFarmingCount: farmingCurrent.length,
      totalFarmingArea: farmingArea,
      yearsOnRecord: yrs > 0 ? `${yrs}` : "<1",
    };
  }, [data, ownerParcels, occupantParcels]);

  // ── My Tenants memo ──────────────────────────────────────────────────────
  const tenantRecords = useMemo(() => {
    if (!data) return [];
    
    const records: HistoryEvent[] = [];
    Object.keys(ownerParcels).forEach((parcelKey) => {
      const events = ownerParcels[parcelKey];
      events.forEach((ev) => {
        if (ev.is_tenant || ev.is_lessee) {
          records.push(ev);
        }
      });
    });

    // Sort: current first, then chronological date descending
    return records.sort((a, b) => {
      if (a.is_current !== b.is_current) {
        return a.is_current ? -1 : 1;
      }
      const da = a.period_start_date || a.created_at || "";
      const db = b.period_start_date || b.created_at || "";
      return db.localeCompare(da);
    });
  }, [data, ownerParcels]);

  // ── Print ────────────────────────────────────────────────────────────────
  const handlePrint = useCallback(() => {
    if (!data) return;
    const { profile, events } = data;
    printHtmlReport({
      title: `Farmer History — ${profile.farmerName}`,
      reportName: "FARMER LAND TENURE HISTORY REPORT",
      filterLabel: [
        profile.barangay ? `Brgy. ${profile.barangay}` : "",
        profile.gender || "",
        profile.birthdate ? `Age ${calculateAge(profile.birthdate)}` : "",
        profile.mainLivelihood || "",
        buildActivities(profile).join(", "),
      ]
        .filter(Boolean)
        .join(" • "),
      totalCount: events.length,
      tableHeaderHtml: `
        <th style="width:12%">Date</th>
        <th style="width:12%">Parcel No.</th>
        <th style="width:12%">Barangay</th>
        <th style="width:8%">Area (ha)</th>
        <th style="width:10%">Role</th>
        <th style="width:15%">Land Owner</th>
        <th style="width:11%">Period Start</th>
        <th style="width:11%">Period End</th>
        <th style="width:9%">Status</th>`,
      tableBodyHtml: events
        .map((ev) => {
          const role = getOccupantRole(ev);
          return `<tr>
          <td>${formatDate(ev.period_start_date || ev.created_at)}</td>
          <td>${ev.parcel_number || "—"}</td>
          <td>${ev.farm_location_barangay || "—"}</td>
          <td>${ev.total_farm_area_ha != null ? Number(ev.total_farm_area_ha).toFixed(2) : "—"}</td>
          <td>${role.label}</td>
          <td>${ev.land_owner_name || "—"}</td>
          <td>${formatDate(ev.period_start_date)}</td>
          <td>${ev.period_end_date ? formatDate(ev.period_end_date) : "Present"}</td>
          <td>${ev.is_current ? "Current" : "Past"}</td>
        </tr>`;
        })
        .join(""),
      printedBy: "JO Portal",
    });
  }, [data]);

  // ── Inline Timeline (shared renderer) ───────────────────────────────────
  const renderInlineTimeline = useCallback(
    (events: HistoryEvent[], mode: "owner" | "occupant") => {
      // Sort newest to oldest (Option A: newest rendered at the top, oldest at the bottom)
      const sortedEvents = [...events].sort((a, b) => {
        const da = a.period_start_date || a.created_at || "";
        const db = b.period_start_date || b.created_at || "";
        return db.localeCompare(da);
      });

      return (
        <div className="fhm-timeline-container-v2">
          <div className="fhm-timeline-header-v2">
            ⏱️ {mode === "owner" ? "Cultivation & Tenancy Flow" : "Tenure History"}
          </div>
          <ul className="fhm-timeline-list-v2">
            {sortedEvents.map((ev, idx) => {
              const role = getOccupantRole(ev);
              const evInfo = getEventInfo(ev.change_type);
              
              // Determine current and end dates
              let isCurrentInTimeline = ev.is_current;
              let endDateToShow = ev.period_end_date;

              if (ev.is_registered_owner) {
                // If there is a subsequent occupant (tenant/lessee) event, then the owner's cultivation is no longer current
                // Note: since sortedEvents is sorted newest first, the subsequent occupant events are at smaller indices (indices < idx)
                const nextOccupant = sortedEvents.slice(0, idx).find(e => e.is_tenant || e.is_lessee);
                if (nextOccupant) {
                  isCurrentInTimeline = false;
                  if (!endDateToShow) {
                    endDateToShow = nextOccupant.period_start_date;
                  }
                }
              }

              const isLast = idx === sortedEvents.length - 1;
              const nameToShow = mode === "owner"
                ? (ev.is_registered_owner ? "Self (Owner)" : ev.farmer_name || "—")
                : (ev.land_owner_name || "—");

              const itemClass = isCurrentInTimeline ? "fhm-tl-item-current-v2" : "fhm-tl-item-past-v2";

              return (
                <li key={`${ev.id}-${idx}`} className={`fhm-tl-item-v2 ${itemClass}`}>
                  <div className="fhm-tl-rail-v2">
                    <div className={`fhm-tl-dot-v2 ${evInfo.dotCls}`}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    {!isLast && (
                      <div className="fhm-tl-line-v2">
                        <span className="fhm-line-arrow-up">▲</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="fhm-tl-content-v2">
                    <div className="fhm-tl-header-v2">
                      <strong className="fhm-tl-title-v2">{ev.change_type || "RECORD"}</strong>
                      {isCurrentInTimeline && <span className="fhm-tl-current-badge-v2">CURRENT</span>}
                    </div>

                    <div className="fhm-tl-date-v2">
                      📅 {formatDate(ev.period_start_date)}
                      <span className="fhm-tl-arrow-symbol"> → </span>
                      {endDateToShow ? formatDate(endDateToShow) : <span className="text-active-present">Present</span>}
                    </div>

                    {ev.change_reason && (
                      <p className="fhm-tl-desc-v2">
                        💬 {ev.change_reason}
                      </p>
                    )}

                    <div className="fhm-tl-meta-v2">
                      <span>
                        {ev.land_owner_name || "—"} ➔ {nameToShow}
                      </span>
                      <span className={`fhm-sub-role-badge ${role.cls}`} style={{ fontSize: "0.68rem", padding: "2px 6px" }}>
                        {role.icon} {role.label}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      );
    },
    []
  );

  // ── Owner Parcel Card ────────────────────────────────────────────────────
  const renderOwnerParcelCard = useCallback(
    (parcelKey: string, events: HistoryEvent[]) => {
      // Resolve the current active occupant: prefer active tenant/lessee over active owner-cultivation
      const currentOccupantEvent = events.find((e) => e.is_current && (e.is_tenant || e.is_lessee));
      const currentOwnerEvent = events.find((e) => e.is_current && e.is_registered_owner);
      const currentEvent = currentOccupantEvent || currentOwnerEvent || events.find((e) => e.is_current);

      const latestEvent = events[events.length - 1];
      const displayEvent = currentEvent || latestEvent;

      type OccupantVariant = "self" | "tenant" | "lessee" | "none";
      let occupant: { label: string; icon: string; variant: OccupantVariant } = {
        label: "No current occupant on record",
        icon: "",
        variant: "none",
      };
      if (currentEvent) {
        if (currentEvent.is_tenant) {
          occupant = {
            label: currentEvent.farmer_name || "Unknown Tenant",
            icon: "🤝",
            variant: "tenant",
          };
        } else if (currentEvent.is_lessee) {
          occupant = {
            label: currentEvent.farmer_name || "Unknown Lessee",
            icon: "📋",
            variant: "lessee",
          };
        } else {
          occupant = { label: "Self-farmed by owner", icon: "🌾", variant: "self" };
        }
      }

      const timelineKey = `owner-${parcelKey}`;
      const mapKey = `owner-map-${parcelKey}`;
      const isTimelineOpen = expandedTimelines.has(timelineKey);
      const isMapOpen = expandedMaps.has(mapKey);
      const firstGeomEvent = events.find((e) => e.geometry);
      const pLabel =
        parcelKey !== "UNKNOWN" ? displayEvent.parcel_number || "N/A" : "N/A";

      return (
        <div
          key={parcelKey}
          className={`fhm-parcel-card ${!currentEvent ? "fhm-card-past" : ""}`}
        >
          {/* Card Header */}
          <div className="fhm-pc-header">
            <div className="fhm-pc-info">
              <div className="fhm-pc-number">Parcel {pLabel}</div>
              <div className="fhm-pc-meta">
                📍 {displayEvent.farm_location_barangay || "—"}&ensp;·&ensp;📐{" "}
                {displayEvent.total_farm_area_ha
                  ? `${Number(displayEvent.total_farm_area_ha).toFixed(2)} ha`
                  : "—"}
              </div>
            </div>
            <span
              className={`fhm-status-badge ${
                currentEvent ? "fhm-badge-active" : "fhm-badge-past"
              }`}
            >
              {currentEvent ? "Active" : "Past"}
            </span>
          </div>

          {/* Current Occupant Box */}
          {currentEvent && (
            <div className={`fhm-occupant-box fhm-occ-${occupant.variant}`}>
              <span className="fhm-occ-eyebrow">Currently farmed by</span>
              <div className="fhm-occ-value">
                {occupant.icon && (
                  <span className="fhm-occ-icon">{occupant.icon}</span>
                )}
                <span className="fhm-occ-name">{occupant.label}</span>
                {occupant.variant === "tenant" && (
                  <span className="fhm-occ-role-tag fhm-role-tenant">Tenant</span>
                )}
                {occupant.variant === "lessee" && (
                  <span className="fhm-occ-role-tag fhm-role-lessee">Lessee</span>
                )}
              </div>
            </div>
          )}

          {/* Visual Timeline Flow - ALWAYS VISIBLE */}
          {renderInlineTimeline(events, "owner")}

          {/* Collapsible Map */}
          {isMapOpen && firstGeomEvent && (
            <div className="fhm-map-container fhm-map-inline">
              <ParcelGeometryPreview
                geometry={firstGeomEvent.geometry}
                parcelLabel={pLabel ?? undefined}
                height={180}
              />
            </div>
          )}

          {/* Footer Actions */}
          <div className="fhm-pc-footer">
            {firstGeomEvent && (
              <button className="fhm-pc-btn" onClick={() => toggleMap(mapKey)}>
                <FaMap /> {isMapOpen ? "Hide Map" : "View Map"}
              </button>
            )}
          </div>
        </div>
      );
    },
    [expandedTimelines, expandedMaps, toggleTimeline, toggleMap, renderInlineTimeline]
  );

  // ── Occupant Timeline Renderer ──────────────────────────────────────────
  const renderOccupantTimeline = useCallback(
    (events: HistoryEvent[]) => {
      // Sort newest to oldest:
      const sortedEvents = [...events].sort((a, b) => {
        const da = a.period_start_date || a.created_at || "";
        const db = b.period_start_date || b.created_at || "";
        return db.localeCompare(da);
      });

      return (
        <div className="fhm-timeline-container-v2">
          <ul className="fhm-timeline-list-v2">
            {sortedEvents.map((ev, idx) => {
              const role = getOccupantRole(ev);
              const evInfo = getEventInfo(ev.change_type);
              const isLast = idx === sortedEvents.length - 1;
              const pLabel = ev.parcel_number || "N/A";
              
              const itemClass = ev.is_current ? "fhm-tl-item-current-v2" : "fhm-tl-item-past-v2";

              return (
                <li key={`${ev.id}-${idx}`} className={`fhm-tl-item-v2 ${itemClass}`}>
                  <div className="fhm-tl-rail-v2">
                    <div className={`fhm-tl-dot-v2 ${evInfo.dotCls}`}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    {!isLast && (
                      <div className="fhm-tl-line-v2">
                        <span className="fhm-line-arrow-up">▲</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="fhm-tl-content-v2">
                    <div className="fhm-tl-header-v2">
                      <strong className="fhm-tl-title-v2">FARMING PARCEL {pLabel}</strong>
                      {ev.is_current && <span className="fhm-tl-current-badge-v2">ACTIVE</span>}
                    </div>

                    <div className="fhm-tl-parcel-subinfo-v2" style={{ fontSize: "0.74rem", color: "#64748b", margin: "2px 0 6px" }}>
                      📍 Brgy. {ev.farm_location_barangay || "—"}&ensp;·&ensp;📐 {ev.total_farm_area_ha ? `${Number(ev.total_farm_area_ha).toFixed(2)} ha` : "—"}
                    </div>

                    <div className="fhm-tl-date-v2">
                      📅 {formatDate(ev.period_start_date)}
                      <span className="fhm-tl-arrow-symbol"> → </span>
                      {ev.period_end_date ? formatDate(ev.period_end_date) : <span className="text-active-present">Present</span>}
                    </div>

                    {ev.change_reason && (
                      <p className="fhm-tl-desc-v2">
                        💬 {ev.change_reason}
                      </p>
                    )}

                    <div className="fhm-tl-meta-v2">
                      <span>
                        Landowner: <strong>{ev.land_owner_name || "—"}</strong>
                      </span>
                      <span className={`fhm-sub-role-badge ${role.cls}`} style={{ fontSize: "0.68rem", padding: "2px 6px" }}>
                        {role.icon} {role.label}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      );
    },
    []
  );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="fhm-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="fhm-modal" role="dialog" aria-modal="true">
        {/* ── Header ── */}
        <div className="fhm-header">
          <div className="fhm-header-text">
            <h2 className="fhm-header-title">🌾 Farmer History</h2>
            <span className="fhm-header-sub">
              {farmerLabel || (data?.profile.farmerName ?? "Loading…")}
            </span>
          </div>
          <div className="fhm-header-actions">
            {data && (
              <button className="fhm-print-btn" onClick={handlePrint}>
                <FaPrint /> Print
              </button>
            )}
            <button className="fhm-close-btn" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="fhm-body">
          {/* Loading */}
          {loading && (
            <div className="fhm-loading">
              <div className="fhm-spinner" />
              Loading history…
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="fhm-error">
              <FaExclamationTriangle /> {error}
            </div>
          )}

          {/* Content */}
          {data && !loading && (
            <>
              {/* ── Profile Card ── */}
              <div className="fhm-profile">
                <div className="fhm-avatar">{getInitials(data.profile.farmerName)}</div>
                <div className="fhm-profile-body">
                  <div className="fhm-name-row">
                    <span className="fhm-name">{data.profile.farmerName}</span>
                    {data.profile.archivedAt && (
                      <span className="fhm-archived-badge">Archived</span>
                    )}
                    {isOwnerFarmer && (
                      <span className="fhm-role-tag fhm-rt-owner">🏡 Landowner</span>
                    )}
                    {isOccupantFarmer && (
                      <span className="fhm-role-tag fhm-rt-occupant">🚜 Occupant</span>
                    )}
                  </div>

                  <div className="fhm-meta">
                    {data.profile.barangay && (
                      <span>
                        <FaMapMarkerAlt className="fhm-meta-icon" />
                        Brgy. {data.profile.barangay}
                        {data.profile.municipality
                          ? `, ${data.profile.municipality}`
                          : ""}
                      </span>
                    )}
                    {data.profile.gender && (
                      <span>
                        <FaVenusMars className="fhm-meta-icon" /> {data.profile.gender}
                      </span>
                    )}
                    {data.profile.birthdate && (
                      <span>
                        <FaCalendarAlt className="fhm-meta-icon" />{" "}
                        {calculateAge(data.profile.birthdate)}
                      </span>
                    )}
                    {data.profile.ffrsCode && (
                      <span>
                        <FaIdBadge className="fhm-meta-icon" /> {data.profile.ffrsCode}
                      </span>
                    )}
                  </div>

                  {data.profile.mainLivelihood && (
                    <div className="fhm-livelihood">
                      🌱 {data.profile.mainLivelihood}
                    </div>
                  )}

                  <div className="fhm-chips">
                    {isOwnerFarmer && (
                      <div className="fhm-chip chip-green">
                        <span className="fhm-chip-value">{stats.ownedCount}</span>
                        <span className="fhm-chip-label">Owned Parcels</span>
                      </div>
                    )}
                    {isOccupantFarmer && (
                      <div className="fhm-chip chip-blue">
                        <span className="fhm-chip-value">{stats.farmingCount}</span>
                        <span className="fhm-chip-label">Farmed Parcels</span>
                      </div>
                    )}
                    {isOwnerFarmer && stats.totalOwnedArea > 0 && (
                      <div className="fhm-chip">
                        <span className="fhm-chip-value">
                          {stats.totalOwnedArea.toFixed(2)} ha
                        </span>
                        <span className="fhm-chip-label">Owned Area</span>
                      </div>
                    )}
                    {isOccupantFarmer && stats.totalFarmingArea > 0 && (
                      <div className="fhm-chip">
                        <span className="fhm-chip-value">
                          {stats.totalFarmingArea.toFixed(2)} ha
                        </span>
                        <span className="fhm-chip-label">Farming Area</span>
                      </div>
                    )}
                    <div className="fhm-chip">
                      <span className="fhm-chip-value">{stats.yearsOnRecord}</span>
                      <span className="fhm-chip-label">Yrs. on Record</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Tab Navigation ── */}
              <div className="fhm-tab-nav">
                <button 
                  className={`fhm-tab-btn ${activeTab === "all" ? "active" : ""}`}
                  onClick={() => setActiveTab("all")}
                >
                  📋 All Overview
                </button>
                <button 
                  className={`fhm-tab-btn ${activeTab === "owner" ? "active" : ""}`}
                  onClick={() => setActiveTab("owner")}
                  disabled={!isOwnerFarmer}
                >
                  🏡 Landowner Assets
                </button>
                <button 
                  className={`fhm-tab-btn ${activeTab === "cultivation" ? "active" : ""}`}
                  onClick={() => setActiveTab("cultivation")}
                  disabled={!isOccupantFarmer}
                >
                  🚜 Tenancies & Leases
                </button>
                {isOwnerFarmer && (
                  <button 
                    className={`fhm-tab-btn ${activeTab === "tenants" ? "active" : ""}`}
                    onClick={() => setActiveTab("tenants")}
                  >
                    👥 My Tenants ({tenantRecords.length})
                  </button>
                )}
              </div>

              {/* ── Active Landowner Assets Section ── */}
              {(activeTab === "all" || activeTab === "owner") && Object.keys(activeOwnerParcels).length > 0 && (
                <div className="fhm-section">
                  <div className="fhm-section-hd">
                    <div className="fhm-section-hd-left">
                      <span className="fhm-section-icon-wrap fhm-icon-owner">
                        <FaHome />
                      </span>
                      <div>
                        <div className="fhm-section-title">Active Landowner Assets</div>
                        <div className="fhm-section-sub">
                          {Object.keys(activeOwnerParcels).length} active parcel(s) currently owned
                        </div>
                      </div>
                    </div>
                    <span className="fhm-section-count-badge fhm-badge-owner-ct">
                      {Object.keys(activeOwnerParcels).length}
                    </span>
                  </div>
                  <div className="fhm-parcel-stack">
                    {Object.keys(activeOwnerParcels).map((key) =>
                      renderOwnerParcelCard(key, activeOwnerParcels[key])
                    )}
                  </div>
                </div>
              )}

              {/* ── Active Tenancies / Leases Section ── */}
              {(activeTab === "all" || activeTab === "cultivation") && Object.keys(activeOccupantParcels).length > 0 && (
                <div className="fhm-section">
                  <div className="fhm-section-hd">
                    <div className="fhm-section-hd-left">
                      <span className="fhm-section-icon-wrap fhm-icon-occupant">
                        <FaSeedling />
                      </span>
                      <div>
                        <div className="fhm-section-title">Active Tenancies / Leases</div>
                        <div className="fhm-section-sub">
                          {Object.keys(activeOccupantParcels).length} active parcel(s) farmed for others
                        </div>
                      </div>
                    </div>
                    <span className="fhm-section-count-badge fhm-badge-occupant-ct">
                      {Object.keys(activeOccupantParcels).length}
                    </span>
                  </div>
                  <div className="fhm-timeline-stack" style={{ marginTop: "16px" }}>
                    {Object.keys(activeOccupantParcels).map((key) => {
                      const events = activeOccupantParcels[key];
                      return renderOccupantTimeline(events);
                    })}
                  </div>
                </div>
              )}

              {/* ── Historical / Transferred Assets Section ── */}
              {(activeTab === "all" || activeTab === "owner" || activeTab === "cultivation") && 
               (Object.keys(historicalOwnerParcels).length > 0 || Object.keys(historicalOccupantParcels).length > 0) && (
                <div className="fhm-section">
                  <div className="fhm-section-hd">
                    <div className="fhm-section-hd-left">
                      <span className="fhm-section-icon-wrap fhm-icon-past" style={{ background: "#f1f5f9", color: "#64748b" }}>
                        🕒
                      </span>
                      <div>
                        <div className="fhm-section-title">Historical / Transferred Assets</div>
                        <div className="fhm-section-sub">
                          Past ownerships and ended tenancy agreements
                        </div>
                      </div>
                    </div>
                    <span className="fhm-section-count-badge" style={{ background: "#f1f5f9", color: "#64748b" }}>
                      {(activeTab !== "cultivation" ? Object.keys(historicalOwnerParcels).length : 0) + 
                       (activeTab !== "owner" ? Object.keys(historicalOccupantParcels).length : 0)}
                    </span>
                  </div>
                  
                  <div className="fhm-parcel-stack">
                    {/* Past Owned Parcels */}
                    {activeTab !== "cultivation" && Object.keys(historicalOwnerParcels).map((key) =>
                      renderOwnerParcelCard(key, historicalOwnerParcels[key])
                    )}

                    {/* Past Tenancies */}
                    {activeTab !== "owner" && Object.keys(historicalOccupantParcels).map((key) => {
                      const events = historicalOccupantParcels[key];
                      return renderOccupantTimeline(events);
                    })}
                  </div>
                </div>
              )}

              {/* ── My Tenants Section ── */}
              {activeTab === "tenants" && (
                <div className="fhm-section">
                  <div className="fhm-section-hd">
                    <div className="fhm-section-hd-left">
                      <span className="fhm-section-icon-wrap" style={{ background: "#fef3c7", color: "#d97706" }}>
                        👥
                      </span>
                      <div>
                        <div className="fhm-section-title">Cultivators & Tenants Registry</div>
                        <div className="fhm-section-sub">
                          List of all active and historical tenants/lessees on your lands
                        </div>
                      </div>
                    </div>
                    <span className="fhm-section-count-badge" style={{ background: "#fef3c7", color: "#d97706" }}>
                      {tenantRecords.length}
                    </span>
                  </div>

                  {tenantRecords.length === 0 ? (
                    <div className="fhm-no-history" style={{ background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: "11px", marginTop: "12px" }}>
                      No tenants or occupants recorded on your owned parcels.
                    </div>
                  ) : (
                    <div className="fhm-tenants-list" style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
                      {tenantRecords.map((ev, idx) => {
                        const role = getOccupantRole(ev);
                        const statusClass = ev.is_current ? "fhm-badge-active" : "fhm-badge-past";
                        
                        return (
                          <div 
                            key={`${ev.id}-${idx}`} 
                            className="fhm-tenant-record-card"
                            style={{
                              background: "#fff",
                              border: "1.5px solid #e2e8f0",
                              borderLeft: ev.is_current ? "4px solid #16a34a" : "4px solid #94a3b8",
                              borderRadius: "11px",
                              padding: "16px",
                              boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              flexWrap: "wrap",
                              gap: "14px"
                            }}
                          >
                            <div style={{ flex: 1, minWidth: "200px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                                <strong style={{ fontSize: "1rem", color: "#1e293b" }}>
                                  {ev.farmer_name || "Unknown Cultivator"}
                                </strong>
                                <span className={`fhm-sub-role-badge ${role.cls}`} style={{ fontSize: "0.68rem", padding: "2px 6px" }}>
                                  {role.icon} {role.label}
                                </span>
                              </div>
                              
                              <div style={{ fontSize: "0.8rem", color: "#64748b", display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "8px" }}>
                                <span>📦 Parcel: <strong>{ev.parcel_number || "—"}</strong></span>
                                <span>📍 Brgy. {ev.farm_location_barangay || "—"}</span>
                                <span>📐 {ev.total_farm_area_ha ? `${Number(ev.total_farm_area_ha).toFixed(2)} ha` : "—"}</span>
                              </div>

                              {ev.change_reason && (
                                <div style={{ fontSize: "0.76rem", color: "#b45309", background: "#fffbeb", padding: "6px 10px", borderRadius: "6px", fontStyle: "italic", marginTop: "6px", display: "inline-block" }}>
                                  💬 {ev.change_reason}
                                </div>
                              )}
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                              <span className={`fhm-status-badge ${statusClass}`} style={{ margin: 0 }}>
                                {ev.is_current ? "Active" : "Past"}
                              </span>
                              <div style={{ fontSize: "0.76rem", color: "#475569", fontWeight: "600", marginTop: "4px" }}>
                                📅 {formatDate(ev.period_start_date)}
                                <span style={{ color: "#94a3b8", margin: "0 4px" }}>→</span>
                                {ev.period_end_date ? formatDate(ev.period_end_date) : <span className="text-active-present">Present</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── No Records ── */}
              {!isOwnerFarmer && !isOccupantFarmer && (
                <div className="fhm-no-history">
                  No land tenure records found for this farmer.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FarmerHistoryModal;
