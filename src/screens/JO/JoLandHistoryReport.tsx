import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  getLandHistoryBarangays,
  getLandHistoryAssociationRows,
  getLandHistoryReportRows,
} from "../../api";
import "../../components/layout/sidebarStyle.css";
import "../../assets/css/jo css/JoLandHistoryReport.css";
import LogoImage from "../../assets/images/Logo.png";
import HomeIcon from "../../assets/images/home.png";
import RSBSAIcon from "../../assets/images/rsbsa.png";
import MasterlistIcon from "../../assets/images/approve.png";
import LogoutIcon from "../../assets/images/logout.png";
import IncentivesIcon from "../../assets/images/incentives.png";

interface LandHistoryReportRow {
  id: number;
  parcel_number: string | null;
  farm_location_barangay: string | null;
  total_farm_area_ha: number | null;
  land_owner_name: string | null;
  farmer_name: string | null;
  ownership_category?: string | null;
  is_registered_owner: boolean;
  is_tenant: boolean;
  is_lessee: boolean;
  is_current: boolean;
  period_start_date: string | null;
  period_end_date: string | null;
  change_type: string | null;
  change_reason: string | null;
  created_at: string | null;
}

type RelationshipFilter =
  | "all"
  | "owner"
  | "tenant"
  | "lessee"
  | "tenantLessee";
type OwnershipCategory = "registeredOwner" | "tenantLessee" | "unknown";

interface FarmerDefaultRow {
  farmerName: string;
  farmerLookupName: string | null;
  currentRole: string;
  underOwner: string;
  barangay: string;
  currentAreaHa: number;
  lastChangeDate: string | null;
  isCurrent: boolean;
  hasCurrentTenantLessee: boolean;
  hasCurrentTenant: boolean;
  hasCurrentLessee: boolean;
}

interface FarmerTimelineEvent {
  id: string;
  eventDate: string | null;
  fromName: string;
  toName: string;
  parcelNumber: string;
  barangay: string;
  relationship: string;
  status: "Current" | "Past";
  changeType: string;
  changeReason: string;
}

const JoLandHistoryReport: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [rows, setRows] = useState<LandHistoryReportRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [barangayFilter, setBarangayFilter] = useState("all");
  const [relationshipFilter, setRelationshipFilter] =
    useState<RelationshipFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [barangayOptions, setBarangayOptions] = useState<string[]>([]);
  const [farmerModalOpen, setFarmerModalOpen] = useState(false);
  const [farmerModalFarmerName, setFarmerModalFarmerName] = useState("");
  const [farmerModalRows, setFarmerModalRows] = useState<
    LandHistoryReportRow[]
  >([]);
  const [farmerModalAssociationRows, setFarmerModalAssociationRows] = useState<
    LandHistoryReportRow[]
  >([]);
  const [farmerModalLoading, setFarmerModalLoading] = useState(false);
  const [farmerModalError, setFarmerModalError] = useState<string | null>(null);
  const [showOwnerLinkDetails, setShowOwnerLinkDetails] = useState(true);
  const [showCounterpartLinkDetails, setShowCounterpartLinkDetails] =
    useState(true);
  const [showAdvancedRelationshipSummary, setShowAdvancedRelationshipSummary] =
    useState(false);

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const isActive = (path: string) => location.pathname === path;

  const normalizeOwnershipCategory = (value: unknown): OwnershipCategory => {
    const normalized = String(value ?? "")
      .trim()
      .toLowerCase();

    if (!normalized) return "unknown";

    if (
      normalized === "registeredowner" ||
      normalized === "registered_owner" ||
      normalized === "registered owner" ||
      normalized === "owner"
    ) {
      return "registeredOwner";
    }

    if (
      normalized === "tenantlessee" ||
      normalized === "tenant_lessee" ||
      normalized === "tenant/lessee" ||
      normalized === "tenant-lessee" ||
      normalized === "tenant" ||
      normalized === "lessee"
    ) {
      return "tenantLessee";
    }

    return "unknown";
  };

  const getOwnershipCategory = (
    row: LandHistoryReportRow,
  ): OwnershipCategory => {
    const explicitCategory = normalizeOwnershipCategory(row.ownership_category);
    if (explicitCategory !== "unknown") return explicitCategory;

    if (row.is_registered_owner) return "registeredOwner";
    if (row.is_tenant || row.is_lessee) return "tenantLessee";
    return "unknown";
  };

  const getTenantLesseeRoleLabel = (row: LandHistoryReportRow) => {
    if (row.is_tenant && row.is_lessee) return "Tenant + Lessee";
    if (row.is_tenant) return "Tenant";
    if (row.is_lessee) return "Lessee";
    return "Tenant or Lessee";
  };

  const getRelationship = (row: LandHistoryReportRow) => {
    const category = getOwnershipCategory(row);
    if (category === "registeredOwner") return "Registered Owner";
    if (category === "tenantLessee") return getTenantLesseeRoleLabel(row);
    return "Unknown";
  };

  const formatDate = (value: string | null | undefined) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) return "-";
    return parsed.toLocaleDateString();
  };

  const toTitleCase = (value: string) =>
    value
      .toLowerCase()
      .split(" ")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

  const formatChangeTypeLabel = (
    changeType?: string | null,
    changeReason?: string | null,
    options?: { selfFlow?: boolean },
  ) => {
    const normalizedType = String(changeType || "")
      .trim()
      .toUpperCase();
    const reason = String(changeReason || "")
      .trim()
      .toLowerCase();
    const isSelfFlow = Boolean(options?.selfFlow);

    if (!normalizedType) return "Status Update";

    if (normalizedType === "NEW") {
      return "Newly Registered";
    }

    if (normalizedType === "TRANSFER_PARTIAL") {
      if (reason.startsWith("inheritance")) {
        return isSelfFlow
          ? "Inheritance (Retained Share)"
          : "Inheritance (Partial Transfer)";
      }

      return isSelfFlow
        ? "Partial Transfer (Retained Share)"
        : "Partial Transfer";
    }

    if (normalizedType === "TRANSFER") {
      return reason.startsWith("inheritance")
        ? "Inheritance Transfer"
        : "Ownership Transfer";
    }

    if (normalizedType.includes("_")) {
      return toTitleCase(normalizedType.replace(/_/g, " "));
    }

    return toTitleCase(normalizedType);
  };

  const pluralize = (count: number, singular: string, plural?: string) =>
    count === 1 ? singular : plural || `${singular}s`;

  const getInitials = (value?: string | null) => {
    const parts = String(value || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (parts.length === 0) return "NA";
    if (parts.length === 1) {
      return String(parts[0] || "")
        .slice(0, 2)
        .toUpperCase();
    }

    return `${parts[0]?.charAt(0) || ""}${parts[1]?.charAt(0) || ""}`.toUpperCase();
  };

  const getLinkedOwnerRoleLabel = (owner: {
    asTenant: number;
    asLessee: number;
  }) => {
    if (owner.asTenant > 0 && owner.asLessee > 0) return "Tenant + Lessee";
    if (owner.asTenant > 0) return "Tenant";
    if (owner.asLessee > 0) return "Lessee";
    return "Linked Role";
  };

  const getLinkedCounterpartRoleLabel = (counterpart: {
    tenantRows: number;
    lesseeRows: number;
  }) => {
    if (counterpart.tenantRows > 0 && counterpart.lesseeRows > 0) {
      return "Tenant + Lessee";
    }
    if (counterpart.tenantRows > 0) return "Tenant";
    if (counterpart.lesseeRows > 0) return "Lessee";
    return "Linked Role";
  };

  const getAssociationLinkStatusLabel = (currentRows: number) =>
    currentRows > 0 ? "Current Link" : "Past Link";

  const buildLinkRoleMixText = (tenantRows: number, lesseeRows: number) => {
    const safeTenantRows = Math.max(0, tenantRows);
    const safeLesseeRows = Math.max(0, lesseeRows);
    const parts: string[] = [];

    if (safeTenantRows > 0) {
      parts.push(
        `${safeTenantRows} tenant ${pluralize(safeTenantRows, "record")}`,
      );
    }

    if (safeLesseeRows > 0) {
      parts.push(
        `${safeLesseeRows} lessee ${pluralize(safeLesseeRows, "record")}`,
      );
    }

    if (parts.length === 0) return "no tenant or lessee records";
    return parts.join(", ");
  };

  const buildAssociationSnapshotText = ({
    currentRows,
    relationshipRows,
    parcelCount,
    tenantRows,
    lesseeRows,
  }: {
    currentRows: number;
    relationshipRows: number;
    parcelCount: number;
    tenantRows: number;
    lesseeRows: number;
  }) => {
    const safeCurrentRows = Math.max(0, currentRows);
    const safeRelationshipRows = Math.max(0, relationshipRows);
    const safeParcelCount = Math.max(0, parcelCount);
    const parcelText = `${safeParcelCount} ${pluralize(safeParcelCount, "parcel")}`;
    const roleMixText = buildLinkRoleMixText(tenantRows, lesseeRows);

    if (safeCurrentRows > 0) {
      return `Active now on ${parcelText}. Role mix: ${roleMixText}.`;
    }

    if (safeRelationshipRows > 0) {
      return `No active link now. Historical records found on ${parcelText}. Role mix: ${roleMixText}.`;
    }

    return "No relationship records found.";
  };

  const buildAssociationLinkActivityText = (
    currentRows: number,
    relationshipRows: number,
  ) => {
    const safeRelationshipRows = Math.max(0, relationshipRows);
    const safeCurrentRows = Math.max(0, currentRows);
    const pastRows = Math.max(0, safeRelationshipRows - safeCurrentRows);

    if (safeCurrentRows > 0 && pastRows > 0) {
      return `Status: Current (${safeCurrentRows} active, ${pastRows} past).`;
    }

    if (safeCurrentRows > 0) {
      return `Status: Current (${safeCurrentRows} active).`;
    }

    if (pastRows > 0) {
      return `Status: Past (${pastRows} ${pluralize(pastRows, "record")}).`;
    }

    return "Status: No record.";
  };

  const buildOwnerLinkExplanation = (
    owner: {
      ownerName: string;
      asTenant: number;
      asLessee: number;
      relationshipRows: number;
      currentRows: number;
      parcels: Set<string>;
    },
    scopedFarmerName?: string,
  ) => {
    const farmerName = String(scopedFarmerName || "This farmer").trim();
    const activityText = buildAssociationLinkActivityText(
      owner.currentRows,
      owner.relationshipRows,
    );

    if (owner.asTenant > 0 && owner.asLessee > 0) {
      return `${farmerName} uses land from ${owner.ownerName} as Tenant and Lessee. ${activityText}`;
    }

    if (owner.asTenant > 0) {
      return `${farmerName} uses land from ${owner.ownerName} as Tenant. ${activityText}`;
    }

    if (owner.asLessee > 0) {
      return `${farmerName} uses land from ${owner.ownerName} as Lessee. ${activityText}`;
    }

    return `${farmerName} has a land-use link with ${owner.ownerName}. ${activityText}`;
  };

  const buildCounterpartLinkExplanation = (
    counterpart: {
      farmerName: string;
      tenantRows: number;
      lesseeRows: number;
      relationshipRows: number;
      currentRows: number;
      parcels: Set<string>;
    },
    scopedFarmerName?: string,
  ) => {
    const ownerName = String(scopedFarmerName || "this farmer").trim();
    const counterpartName = String(
      counterpart.farmerName || "This farmer",
    ).trim();
    const activityText = buildAssociationLinkActivityText(
      counterpart.currentRows,
      counterpart.relationshipRows,
    );

    if (counterpart.tenantRows > 0 && counterpart.lesseeRows > 0) {
      return `${counterpartName} uses land from ${ownerName} as Tenant and Lessee. ${activityText}`;
    }

    if (counterpart.tenantRows > 0) {
      return `${counterpartName} uses land from ${ownerName} as Tenant. ${activityText}`;
    }

    if (counterpart.lesseeRows > 0) {
      return `${counterpartName} uses land from ${ownerName} as Lessee. ${activityText}`;
    }

    return `${counterpartName} has a land-use link with ${ownerName}. ${activityText}`;
  };

  const getTimelineTypeBadgeLabel = (changeType?: string | null) => {
    const value = String(changeType || "").trim();
    const normalized = value.toLowerCase();

    if (!value) return "Status";
    if (normalized.includes("inheritance")) return "Inheritance";
    if (normalized.includes("partial")) return "Partial Transfer";
    if (normalized.includes("transfer")) return "Transfer";
    return value;
  };

  const parseOwnershipTransferParties = (reason?: string | null) => {
    const text = String(reason || "").trim();
    if (!text) return null;

    const match = text.match(
      /^ownership transfer from\s+(.+?)\s+to\s+(.+?)(?:[.;]|$)/i,
    );
    if (!match) return null;

    const fromName = String(match[1] || "").trim();
    const toName = String(match[2] || "").trim();
    if (!fromName || !toName) return null;

    return { fromName, toName };
  };

  const isAssociationRoleRow = (row: LandHistoryReportRow) =>
    getOwnershipCategory(row) === "tenantLessee";

  const formatAssociationReasonText = (
    role: string,
    ownerName?: string | null,
    rawReason?: string | null,
  ) => {
    const cleanedReason = String(rawReason || "").trim();
    const normalizedRole = String(role || "").toLowerCase();
    const owner = String(ownerName || "").trim() || "land owner";
    const hasOwnershipTransferWording =
      parseOwnershipTransferParties(cleanedReason) !== null;

    if (!cleanedReason || hasOwnershipTransferWording) {
      return `Current land use: ${normalizedRole || "association"} under ${owner}.`;
    }

    return cleanedReason;
  };

  const isAssociationTimelineRow = (row: LandHistoryReportRow) => {
    if (isAssociationRoleRow(row)) return true;
    if (!row.is_tenant && !row.is_lessee) return false;

    const changeType = String(row.change_type || "").toLowerCase();
    const hasOwnershipReason =
      parseOwnershipTransferParties(row.change_reason) !== null;

    // Keep this rule aligned with association timeline semantics.
    if (changeType.includes("transfer") || hasOwnershipReason) return false;

    return true;
  };

  const parseReportPayload = (payload: any) => {
    const nextRows = Array.isArray(payload?.rows)
      ? (payload.rows as LandHistoryReportRow[])
      : Array.isArray(payload)
        ? (payload as LandHistoryReportRow[])
        : [];
    const nextTotal = Number(payload?.totalCount ?? nextRows.length ?? 0);

    return {
      rows: nextRows,
      totalCount: nextTotal,
    };
  };

  const fetchReportRows = async (pageOverride?: number) => {
    try {
      setLoading(true);
      setError(null);

      const targetPage = pageOverride || page;
      const response = await getLandHistoryReportRows({
        searchTerm,
        farmerName: "all",
        barangay: barangayFilter,
        relationship: relationshipFilter,
        dateFrom,
        dateTo,
        page: targetPage,
        pageSize,
      });
      if (response.error) {
        throw new Error(response.error);
      }

      const parsedPayload = parseReportPayload(response.data);
      const nextRows = parsedPayload.rows;
      const nextTotal = parsedPayload.totalCount;

      setRows(nextRows);
      setTotalCount(nextTotal);

      if (targetPage > 1 && nextRows.length === 0 && nextTotal > 0) {
        setPage(1);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load land history report data.");
    } finally {
      setLoading(false);
    }
  };

  const fetchBarangayOptions = async () => {
    const response = await getLandHistoryBarangays();
    if (response.error) return;
    setBarangayOptions((response.data as string[]) || []);
  };

  useEffect(() => {
    fetchBarangayOptions();
  }, []);

  useEffect(() => {
    fetchReportRows();
  }, [
    page,
    pageSize,
    searchTerm,
    barangayFilter,
    relationshipFilter,
    dateFrom,
    dateTo,
  ]);

  const uniqueBarangays = useMemo(
    () => [...barangayOptions].sort((a, b) => a.localeCompare(b)),
    [barangayOptions],
  );

  const normalizeName = (value?: string | null) =>
    String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[,.-]/g, " ")
      .trim();

  const namesLikelyMatch = (left?: string | null, right?: string | null) => {
    const a = normalizeName(left);
    const b = normalizeName(right);
    if (!a || !b) return false;
    return a === b;
  };

  const toSortableTimestamp = (value?: string | null) => {
    if (!value) return 0;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const getAssociationCurrentGroupingKey = (row: LandHistoryReportRow) => {
    const parcel = String(row.parcel_number || "")
      .trim()
      .toLowerCase();
    const barangay = String(row.farm_location_barangay || "")
      .trim()
      .toLowerCase();

    if (!parcel) return `row:${row.id}`;
    return `parcel:${parcel}|barangay:${barangay}`;
  };

  const buildLatestAssociationCurrentRowIdSet = (
    associationRows: LandHistoryReportRow[],
  ) => {
    const latestByKey = new Map<
      string,
      {
        id: number;
        eventTimestamp: number;
        createdTimestamp: number;
      }
    >();

    associationRows.forEach((row) => {
      if (!row.is_tenant && !row.is_lessee) return;

      const groupingKey = getAssociationCurrentGroupingKey(row);
      const eventTimestamp = toSortableTimestamp(
        row.period_start_date || row.created_at || row.period_end_date || null,
      );
      const createdTimestamp = toSortableTimestamp(row.created_at);

      const existing = latestByKey.get(groupingKey);
      if (!existing) {
        latestByKey.set(groupingKey, {
          id: row.id,
          eventTimestamp,
          createdTimestamp,
        });
        return;
      }

      const isNewerRow =
        eventTimestamp > existing.eventTimestamp ||
        (eventTimestamp === existing.eventTimestamp &&
          createdTimestamp > existing.createdTimestamp) ||
        (eventTimestamp === existing.eventTimestamp &&
          createdTimestamp === existing.createdTimestamp &&
          row.id > existing.id);

      if (isNewerRow) {
        latestByKey.set(groupingKey, {
          id: row.id,
          eventTimestamp,
          createdTimestamp,
        });
      }
    });

    return new Set<number>(
      Array.from(latestByKey.values()).map((entry) => entry.id),
    );
  };

  const buildFarmerAssociations = (
    scopedFarmerName: string,
    scopedRows: LandHistoryReportRow[],
    scopedAssociationRows: LandHistoryReportRow[],
  ) => {
    if (!scopedFarmerName) {
      return {
        linkedOwners: [],
        linkedTenantsLessees: [],
      };
    }

    const ownerMap = new Map<
      string,
      {
        ownerName: string;
        asTenant: number;
        asLessee: number;
        relationshipRows: number;
        currentRows: number;
        parcels: Set<string>;
      }
    >();

    const ownerRows = scopedRows.filter((row) => {
      const farmerName = String(row.farmer_name || "").trim();
      const ownerName = String(row.land_owner_name || "").trim();
      if (!farmerName || !namesLikelyMatch(farmerName, scopedFarmerName)) {
        return false;
      }
      if (!ownerName || namesLikelyMatch(ownerName, scopedFarmerName)) {
        return false;
      }
      return row.is_tenant || row.is_lessee;
    });

    const ownerCurrentRowIds = buildLatestAssociationCurrentRowIdSet(ownerRows);

    ownerRows.forEach((row) => {
      const ownerName = String(row.land_owner_name || "").trim();
      const key = normalizeName(ownerName);
      if (!ownerMap.has(key)) {
        ownerMap.set(key, {
          ownerName,
          asTenant: 0,
          asLessee: 0,
          relationshipRows: 0,
          currentRows: 0,
          parcels: new Set<string>(),
        });
      }

      const existing = ownerMap.get(key)!;
      if (row.is_tenant) existing.asTenant += 1;
      if (row.is_lessee) existing.asLessee += 1;
      existing.relationshipRows += 1;
      if (ownerCurrentRowIds.has(row.id)) existing.currentRows += 1;
      if (row.parcel_number) existing.parcels.add(String(row.parcel_number));
    });

    const counterpartMap = new Map<
      string,
      {
        farmerName: string;
        tenantRows: number;
        lesseeRows: number;
        relationshipRows: number;
        currentRows: number;
        parcels: Set<string>;
      }
    >();

    const counterpartRows = scopedAssociationRows.filter((row) => {
      const ownerName = String(row.land_owner_name || "").trim();
      const farmerName = String(row.farmer_name || "").trim();
      if (!ownerName || !farmerName) return false;
      if (!namesLikelyMatch(ownerName, scopedFarmerName)) return false;
      if (namesLikelyMatch(farmerName, scopedFarmerName)) return false;
      return row.is_tenant || row.is_lessee;
    });

    const counterpartCurrentRowIds =
      buildLatestAssociationCurrentRowIdSet(counterpartRows);

    counterpartRows.forEach((row) => {
      const farmerName = String(row.farmer_name || "").trim();
      const key = normalizeName(farmerName);
      if (!counterpartMap.has(key)) {
        counterpartMap.set(key, {
          farmerName,
          tenantRows: 0,
          lesseeRows: 0,
          relationshipRows: 0,
          currentRows: 0,
          parcels: new Set<string>(),
        });
      }

      const existing = counterpartMap.get(key)!;
      if (row.is_tenant) existing.tenantRows += 1;
      if (row.is_lessee) existing.lesseeRows += 1;
      existing.relationshipRows += 1;
      if (counterpartCurrentRowIds.has(row.id)) existing.currentRows += 1;
      if (row.parcel_number) existing.parcels.add(String(row.parcel_number));
    });

    return {
      linkedOwners: Array.from(ownerMap.values()).sort((a, b) =>
        a.ownerName.localeCompare(b.ownerName),
      ),
      linkedTenantsLessees: Array.from(counterpartMap.values()).sort((a, b) =>
        a.farmerName.localeCompare(b.farmerName),
      ),
    };
  };

  const buildOwnershipTransferTimeline = (
    scopedFarmerName: string,
    scopedAssociationRows: LandHistoryReportRow[],
  ): FarmerTimelineEvent[] => {
    if (!scopedFarmerName) return [];

    const toTimestamp = (value?: string | null) => {
      if (!value) return 0;
      const parsed = new Date(value).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const timelineRows = scopedAssociationRows.filter((row) => {
      const changeType = String(row.change_type || "").toLowerCase();
      const hasOwnershipReason =
        parseOwnershipTransferParties(row.change_reason) !== null;

      // Tenant/lessee relationship rows stay in association timeline,
      // even if old data was saved with transfer wording.
      if (isAssociationRoleRow(row)) {
        return false;
      }

      return changeType.includes("transfer") || hasOwnershipReason;
    });

    const events: FarmerTimelineEvent[] = timelineRows.map((row, index) => {
      const ownerName = String(row.land_owner_name || "").trim();
      const farmerName = String(row.farmer_name || "").trim();
      const parsedParties = parseOwnershipTransferParties(row.change_reason);

      let fromName = parsedParties?.fromName || ownerName || "Unknown";
      let toName = parsedParties?.toName || farmerName || scopedFarmerName;

      if (
        !parsedParties &&
        ownerName &&
        farmerName &&
        namesLikelyMatch(ownerName, scopedFarmerName) &&
        !namesLikelyMatch(farmerName, scopedFarmerName)
      ) {
        fromName = scopedFarmerName;
        toName = farmerName;
      } else if (
        !parsedParties &&
        ownerName &&
        farmerName &&
        namesLikelyMatch(farmerName, scopedFarmerName) &&
        !namesLikelyMatch(ownerName, scopedFarmerName)
      ) {
        fromName = ownerName;
        toName = scopedFarmerName;
      }

      const isSelfFlow = namesLikelyMatch(fromName, toName);
      const isSelfRetainedPartial =
        isSelfFlow &&
        row.is_registered_owner &&
        String(row.change_type || "")
          .trim()
          .toUpperCase() === "TRANSFER_PARTIAL";

      if (isSelfRetainedPartial) {
        fromName = scopedFarmerName;
        toName = "Retained Portion";
      }

      const relationship = getRelationship(row);

      const eventDate =
        row.period_start_date || row.created_at || row.period_end_date || null;

      return {
        id: `${row.id}-${eventDate || "none"}-${index}`,
        eventDate,
        fromName,
        toName,
        parcelNumber: String(row.parcel_number || "").trim(),
        barangay: String(row.farm_location_barangay || "").trim(),
        relationship,
        status: row.is_current ? "Current" : "Past",
        changeType: formatChangeTypeLabel(row.change_type, row.change_reason, {
          selfFlow: isSelfFlow,
        }),
        changeReason: String(row.change_reason || "").trim(),
      };
    });

    events.sort((a, b) => toTimestamp(b.eventDate) - toTimestamp(a.eventDate));
    return events;
  };

  const buildAssociationTimeline = (
    scopedFarmerName: string,
    scopedAssociationRows: LandHistoryReportRow[],
  ): FarmerTimelineEvent[] => {
    if (!scopedFarmerName) return [];

    const toTimestamp = (value?: string | null) => {
      if (!value) return 0;
      const parsed = new Date(value).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const relationRows = scopedAssociationRows.filter((row) =>
      isAssociationTimelineRow(row),
    );

    const effectiveCurrentRowIds =
      buildLatestAssociationCurrentRowIdSet(relationRows);

    const events: FarmerTimelineEvent[] = relationRows.map((row, index) => {
      const ownerName = String(row.land_owner_name || "").trim();
      const farmerName = String(row.farmer_name || "").trim();

      const relationship = getRelationship(row);
      const isTenantOrLesseeRelationship =
        relationship.includes("Tenant") || relationship.includes("Lessee");

      let fromName = ownerName || "Unknown Owner";
      let toName = farmerName || scopedFarmerName || "Unknown Farmer";

      if (namesLikelyMatch(fromName, toName)) {
        toName = isTenantOrLesseeRelationship
          ? `${relationship} Role`
          : "Association Role";
      }

      const eventDate =
        row.period_start_date || row.created_at || row.period_end_date || null;

      const normalizedReason = formatAssociationReasonText(
        relationship,
        ownerName,
        row.change_reason,
      );

      return {
        id: `assoc-${row.id}-${eventDate || "none"}-${index}`,
        eventDate,
        fromName,
        toName,
        parcelNumber: String(row.parcel_number || "").trim(),
        barangay: String(row.farm_location_barangay || "").trim(),
        relationship,
        status: effectiveCurrentRowIds.has(row.id) ? "Current" : "Past",
        changeType: isTenantOrLesseeRelationship
          ? `${relationship} Association`
          : "Association Update",
        changeReason: normalizedReason,
      };
    });

    events.sort((a, b) => toTimestamp(b.eventDate) - toTimestamp(a.eventDate));
    return events;
  };

  const closeFarmerHistoryModal = () => {
    setFarmerModalOpen(false);
  };

  const openFarmerHistoryModal = async (rawFarmerName?: string | null) => {
    const scopedFarmerName = String(rawFarmerName || "").trim();
    if (!scopedFarmerName) return;

    setFarmerModalOpen(true);
    setFarmerModalFarmerName(scopedFarmerName);
    setFarmerModalRows([]);
    setFarmerModalAssociationRows([]);
    setFarmerModalError(null);
    setFarmerModalLoading(true);
    setShowOwnerLinkDetails(true);
    setShowCounterpartLinkDetails(true);
    setShowAdvancedRelationshipSummary(false);

    const [reportResponse, associationResponse] = await Promise.all([
      getLandHistoryReportRows({
        searchTerm: "",
        farmerName: scopedFarmerName,
        barangay: "all",
        relationship: "all",
        dateFrom: "",
        dateTo: "",
        page: 1,
        pageSize: 5000,
      }),
      getLandHistoryAssociationRows({
        farmerName: scopedFarmerName,
        barangay: "all",
        dateFrom: "",
        dateTo: "",
        limit: 5000,
      }),
    ]);

    if (reportResponse.error || associationResponse.error) {
      setFarmerModalRows([]);
      setFarmerModalAssociationRows([]);
      setFarmerModalError(
        reportResponse.error ||
          associationResponse.error ||
          "Failed to load farmer history.",
      );
      setFarmerModalLoading(false);
      return;
    }

    const parsedPayload = parseReportPayload(reportResponse.data);
    setFarmerModalRows(parsedPayload.rows);
    setFarmerModalAssociationRows(
      (associationResponse.data as LandHistoryReportRow[]) || [],
    );
    setFarmerModalError(null);
    setFarmerModalLoading(false);
  };

  const handleReportRowKeyDown = (
    event: React.KeyboardEvent<HTMLTableRowElement>,
    farmerName?: string | null,
  ) => {
    const scopedFarmerName = String(farmerName || "").trim();
    if (!scopedFarmerName) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openFarmerHistoryModal(scopedFarmerName);
    }
  };

  useEffect(() => {
    if (!farmerModalOpen) return;

    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeFarmerHistoryModal();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = priorOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [farmerModalOpen]);

  const farmerModalSummary = useMemo(() => {
    const currentRecords = farmerModalRows.filter((row) => row.is_current);
    const hasCurrentOwner = currentRecords.some(
      (row) => getOwnershipCategory(row) === "registeredOwner",
    );
    const hasCurrentTenant = currentRecords.some((row) => row.is_tenant);
    const hasCurrentLessee = currentRecords.some((row) => row.is_lessee);
    const hasCurrentTenantLessee = currentRecords.some(
      (row) => getOwnershipCategory(row) === "tenantLessee",
    );

    const roleLabels = [
      hasCurrentOwner ? "Registered Owner" : null,
      hasCurrentTenant ? "Tenant" : null,
      hasCurrentLessee ? "Lessee" : null,
      !hasCurrentTenant && !hasCurrentLessee && hasCurrentTenantLessee
        ? "Tenant or Lessee"
        : null,
    ].filter(Boolean) as string[];

    const transferRows = farmerModalRows.filter((row) => {
      const type = String(row.change_type || "").toLowerCase();
      return type.includes("transfer") || type.includes("change");
    }).length;

    const totalAreaHa = farmerModalRows.reduce(
      (sum, row) => sum + (Number(row.total_farm_area_ha) || 0),
      0,
    );

    return {
      totalRecords: farmerModalRows.length,
      currentRecords: currentRecords.length,
      transferRows,
      totalAreaHa,
      roleLabels,
    };
  }, [farmerModalRows]);

  const farmerModalAssociations = useMemo(
    () =>
      buildFarmerAssociations(
        farmerModalFarmerName,
        farmerModalRows,
        farmerModalAssociationRows,
      ),
    [farmerModalAssociationRows, farmerModalFarmerName, farmerModalRows],
  );

  const farmerModalTransferTimeline = useMemo(
    () =>
      buildOwnershipTransferTimeline(
        farmerModalFarmerName,
        farmerModalAssociationRows,
      ),
    [farmerModalAssociationRows, farmerModalFarmerName],
  );

  const farmerModalAssociationTimeline = useMemo(
    () =>
      buildAssociationTimeline(
        farmerModalFarmerName,
        farmerModalAssociationRows,
      ),
    [farmerModalAssociationRows, farmerModalFarmerName],
  );

  const farmerModalDetailedRows = useMemo(() => {
    const mergedById = new Map<number, LandHistoryReportRow>();

    farmerModalRows.forEach((row) => {
      mergedById.set(row.id, row);
    });

    farmerModalAssociationRows.forEach((row) => {
      if (!mergedById.has(row.id)) {
        mergedById.set(row.id, row);
      }
    });

    const mergedRows = Array.from(mergedById.values());

    mergedRows.sort((a, b) => {
      const aTimestamp = toSortableTimestamp(
        a.period_start_date || a.created_at || a.period_end_date || null,
      );
      const bTimestamp = toSortableTimestamp(
        b.period_start_date || b.created_at || b.period_end_date || null,
      );

      if (bTimestamp !== aTimestamp) return bTimestamp - aTimestamp;
      return b.id - a.id;
    });

    return mergedRows;
  }, [farmerModalAssociationRows, farmerModalRows]);

  const farmerModalTableAssociationCurrentRowIds = useMemo(() => {
    const relationRows = farmerModalDetailedRows.filter((row) =>
      isAssociationTimelineRow(row),
    );
    return buildLatestAssociationCurrentRowIdSet(relationRows);
  }, [farmerModalDetailedRows]);

  const farmerDefaultRows = useMemo<FarmerDefaultRow[]>(() => {
    const toTimestamp = (value?: string | null) => {
      if (!value) return 0;
      const parsed = new Date(value).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const getRowTimestamp = (row?: LandHistoryReportRow) =>
      toTimestamp(
        row?.period_start_date || row?.created_at || row?.period_end_date,
      );

    const groupedByFarmer = new Map<
      string,
      {
        farmerNameDisplay: string;
        farmerLookupName: string | null;
        rows: LandHistoryReportRow[];
      }
    >();

    rows.forEach((row) => {
      const farmerName = String(row.farmer_name || "").trim();
      const key = farmerName ? normalizeName(farmerName) : `unknown-${row.id}`;

      if (!groupedByFarmer.has(key)) {
        groupedByFarmer.set(key, {
          farmerNameDisplay: farmerName || "-",
          farmerLookupName: farmerName || null,
          rows: [],
        });
      }

      groupedByFarmer.get(key)!.rows.push(row);
    });

    const groupedRows = Array.from(groupedByFarmer.values()).map((group) => {
      const sortedRows = [...group.rows].sort(
        (a, b) => getRowTimestamp(b) - getRowTimestamp(a),
      );

      const latestRow = sortedRows[0];
      const currentRows = group.rows.filter((row) => row.is_current);

      const hasCurrentOwner = currentRows.some(
        (row) => getOwnershipCategory(row) === "registeredOwner",
      );
      const hasCurrentTenant = currentRows.some((row) => row.is_tenant);
      const hasCurrentLessee = currentRows.some((row) => row.is_lessee);
      const hasCurrentTenantLessee = currentRows.some(
        (row) => getOwnershipCategory(row) === "tenantLessee",
      );

      let currentRole = "No Active Role";
      if (hasCurrentOwner) {
        currentRole = "Registered Owner";
      } else if (hasCurrentTenant && hasCurrentLessee) {
        currentRole = "Tenant + Lessee";
      } else if (hasCurrentTenant) {
        currentRole = "Tenant";
      } else if (hasCurrentLessee) {
        currentRole = "Lessee";
      } else if (hasCurrentTenantLessee) {
        currentRole = "Tenant or Lessee";
      } else if (currentRows.length > 0) {
        currentRole = "Current";
      }

      const ownerSet = new Set<string>();
      currentRows.forEach((row) => {
        if (!row.is_tenant && !row.is_lessee) return;
        const ownerName = String(row.land_owner_name || "").trim();
        if (!ownerName) return;

        if (
          group.farmerLookupName &&
          namesLikelyMatch(ownerName, group.farmerLookupName)
        ) {
          return;
        }

        ownerSet.add(ownerName);
      });

      const areaRows =
        currentRows.length > 0 ? currentRows : latestRow ? [latestRow] : [];
      const currentAreaHa = areaRows.reduce(
        (sum, row) => sum + (Number(row.total_farm_area_ha) || 0),
        0,
      );

      return {
        farmerName: group.farmerNameDisplay,
        farmerLookupName: group.farmerLookupName,
        currentRole,
        underOwner: hasCurrentTenantLessee
          ? ownerSet.size > 0
            ? Array.from(ownerSet)
                .sort((a, b) => a.localeCompare(b))
                .join(" | ")
            : "Not specified"
          : "-",
        barangay:
          String(latestRow?.farm_location_barangay || "-").trim() || "-",
        currentAreaHa,
        lastChangeDate:
          latestRow?.period_start_date ||
          latestRow?.created_at ||
          latestRow?.period_end_date ||
          null,
        isCurrent: currentRows.length > 0,
        hasCurrentTenantLessee,
        hasCurrentTenant,
        hasCurrentLessee,
        lastChangeTimestamp: getRowTimestamp(latestRow),
      };
    });

    return groupedRows
      .sort(
        (a, b) =>
          b.lastChangeTimestamp - a.lastChangeTimestamp ||
          a.farmerName.localeCompare(b.farmerName),
      )
      .map(({ lastChangeTimestamp, ...rest }) => rest);
  }, [rows, namesLikelyMatch, normalizeName]);

  const summary = useMemo(() => {
    const currentFarmers = farmerDefaultRows.filter((row) => row.isCurrent);

    const currentTenantFarmers = farmerDefaultRows.filter(
      (row) => row.hasCurrentTenant,
    ).length;

    const currentLesseeFarmers = farmerDefaultRows.filter(
      (row) => row.hasCurrentLessee,
    ).length;

    const totalCurrentAreaHa = farmerDefaultRows.reduce(
      (sum, row) => sum + (Number(row.currentAreaHa) || 0),
      0,
    );

    return {
      totalHistoryRows: totalCount,
      farmersOnPage: farmerDefaultRows.length,
      currentFarmers: currentFarmers.length,
      currentTenantFarmers,
      currentLesseeFarmers,
      totalCurrentAreaHa,
    };
  }, [farmerDefaultRows, totalCount]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(totalCount, page * pageSize);
  const farmerModalTimelineLimit = 30;

  const escapeCsvValue = (value: unknown) => {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  };

  const downloadCsvFile = (fileName: string, lines: string[]) => {
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    if (rows.length === 0) return;

    const headers = [
      "Record ID",
      "Parcel Number",
      "Barangay",
      "Land Owner",
      "Farmer",
      "Relationship",
      "Area (ha)",
      "Current",
      "Period Start",
      "Period End",
      "Change Type",
      "Change Reason",
    ];

    const lines = [headers.map(escapeCsvValue).join(",")];

    rows.forEach((row) => {
      lines.push(
        [
          row.id,
          row.parcel_number || "-",
          row.farm_location_barangay || "-",
          row.land_owner_name || "-",
          row.farmer_name || "-",
          getRelationship(row),
          Number(row.total_farm_area_ha || 0).toFixed(2),
          row.is_current ? "Yes" : "No",
          formatDate(row.period_start_date),
          formatDate(row.period_end_date),
          row.change_type || "-",
          row.change_reason || "-",
        ]
          .map(escapeCsvValue)
          .join(","),
      );
    });

    const datePart = new Date().toISOString().slice(0, 10);
    downloadCsvFile(`land-history-report-${datePart}.csv`, lines);
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setBarangayFilter("all");
    setRelationshipFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const noRowsMessage = "No farmers found with the current filters.";

  return (
    <div className="jo-land-history-report-page-container">
      <div className="jo-land-history-report-page has-mobile-sidebar">
        <div className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
          <nav className="sidebar-nav">
            <div className="sidebar-logo">
              <img src={LogoImage} alt="DARDA Logo" />
            </div>

            <button
              className={`sidebar-nav-item ${isActive("/jo-dashboard") ? "active" : ""}`}
              onClick={() => navigate("/jo-dashboard")}
            >
              <span className="nav-icon">
                <img src={HomeIcon} alt="Home" />
              </span>
              <span className="nav-text">Home</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/jo-rsbsapage") ? "active" : ""}`}
              onClick={() => navigate("/jo-rsbsapage")}
            >
              <span className="nav-icon">
                <img src={RSBSAIcon} alt="RSBSA" />
              </span>
              <span className="nav-text">RSBSA</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/jo-incentives") ? "active" : ""}`}
              onClick={() => navigate("/jo-incentives")}
            >
              <span className="nav-icon">
                <img src={IncentivesIcon} alt="Incentives" />
              </span>
              <span className="nav-text">Subsidy</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/jo-masterlist") ? "active" : ""}`}
              onClick={() => navigate("/jo-masterlist")}
            >
              <span className="nav-icon">
                <img src={MasterlistIcon} alt="Masterlist" />
              </span>
              <span className="nav-text">Masterlist</span>
            </button>

            <div
              className={`sidebar-nav-item ${isActive("/jo-land-registry") ? "active" : ""}`}
              onClick={() => navigate("/jo-land-registry")}
            >
              <div className="nav-icon">🗺️</div>
              <span className="nav-text">Land Registry</span>
            </div>

            <div
              className={`sidebar-nav-item ${isActive("/jo-land-history-report") ? "active" : ""}`}
              onClick={() => navigate("/jo-land-history-report")}
            >
              <div className="nav-icon">📜</div>
              <span className="nav-text">Land History Report</span>
            </div>

            <button
              className="sidebar-nav-item logout"
              onClick={() => navigate("/")}
            >
              <span className="nav-icon">
                <img src={LogoutIcon} alt="Logout" />
              </span>
              <span className="nav-text">Logout</span>
            </button>
          </nav>
        </div>

        <div
          className={`tech-incent-sidebar-overlay ${sidebarOpen ? "active" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />

        <div className="jo-land-history-report-main-content">
          <div className="tech-incent-mobile-header">
            <button
              className="tech-incent-hamburger"
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <div className="tech-incent-mobile-title">Land History Report</div>
          </div>

          <div className="jo-land-history-report-header">
            <h1>Land History Report</h1>
            <p>
              Farmer-first default view: one row per farmer with role context.
              Ownership categories are normalized to Registered Owner or Tenant
              and Lessee. Click a row to open complete history details.
            </p>
          </div>

          <div className="jo-land-history-report-content-card">
            <div className="jo-land-history-report-filters">
              <input
                className="jo-land-history-report-search"
                type="text"
                placeholder="Search parcel, owner, farmer, change type..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />

              <select
                className="jo-land-history-report-select"
                value={barangayFilter}
                onChange={(e) => {
                  setBarangayFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All Barangays</option>
                {uniqueBarangays.map((barangay) => (
                  <option key={barangay} value={barangay}>
                    {barangay}
                  </option>
                ))}
              </select>

              <select
                className="jo-land-history-report-select"
                value={relationshipFilter}
                onChange={(e) => {
                  setRelationshipFilter(e.target.value as RelationshipFilter);
                  setPage(1);
                }}
              >
                <option value="all">All Relationships</option>
                <option value="owner">Registered Owner</option>
                <option value="tenant">Tenant</option>
                <option value="lessee">Lessee</option>
              </select>

              <button
                className="jo-land-history-report-btn"
                onClick={handleResetFilters}
              >
                Reset Filters
              </button>

              <button
                className="jo-land-history-report-btn primary"
                onClick={handleExportCsv}
                disabled={rows.length === 0}
              >
                Export Current View
              </button>
            </div>

            <div className="jo-land-history-report-kpis">
              <div className="jo-land-history-report-kpi-card">
                <span className="label">Current Farmers</span>
                <strong>{summary.currentFarmers}</strong>
              </div>
              <div className="jo-land-history-report-kpi-card">
                <span className="label">Current Tenant</span>
                <strong>{summary.currentTenantFarmers}</strong>
              </div>
              <div className="jo-land-history-report-kpi-card">
                <span className="label">Current Lessee</span>
                <strong>{summary.currentLesseeFarmers}</strong>
              </div>
              <div className="jo-land-history-report-kpi-card wide">
                <span className="label">Total Current Area (ha, Page)</span>
                <strong>{summary.totalCurrentAreaHa.toFixed(2)}</strong>
              </div>
            </div>

            <div className="jo-land-history-report-page-meta">
              <span>
                Showing {farmerDefaultRows.length} farmers on this page (
                {pageStart}-{pageEnd} of {totalCount} history rows)
              </span>
              <label>
                Rows per page:
                <select
                  className="jo-land-history-report-page-size"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </label>
            </div>

            {loading ? (
              <div className="jo-land-history-report-state">
                Loading report data...
              </div>
            ) : error ? (
              <div className="jo-land-history-report-state error">{error}</div>
            ) : farmerDefaultRows.length === 0 ? (
              <div className="jo-land-history-report-state">
                {noRowsMessage}
              </div>
            ) : (
              <div className="jo-land-history-report-table-wrap">
                <table className="jo-land-history-report-table">
                  <thead>
                    <tr>
                      <th>Farmer</th>
                      <th>Current Role</th>
                      <th>Under Owner</th>
                      <th>Barangay</th>
                      <th>Current Area (ha)</th>
                      <th>Last Change</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {farmerDefaultRows.map((row, index) => (
                      <tr
                        key={`${row.farmerLookupName || "unknown"}-${index}`}
                        className={`jo-land-history-report-row ${row.farmerLookupName ? "is-clickable" : ""}`}
                        role={row.farmerLookupName ? "button" : undefined}
                        tabIndex={row.farmerLookupName ? 0 : undefined}
                        aria-label={
                          row.farmerLookupName
                            ? `View history for farmer ${row.farmerName}`
                            : undefined
                        }
                        onClick={() =>
                          row.farmerLookupName
                            ? openFarmerHistoryModal(row.farmerLookupName)
                            : undefined
                        }
                        onKeyDown={(event) =>
                          handleReportRowKeyDown(event, row.farmerLookupName)
                        }
                      >
                        <td>{row.farmerName}</td>
                        <td>{row.currentRole}</td>
                        <td>{row.underOwner}</td>
                        <td>{row.barangay}</td>
                        <td>{row.currentAreaHa.toFixed(2)}</td>
                        <td>{formatDate(row.lastChangeDate)}</td>
                        <td>{row.isCurrent ? "Active" : "Inactive"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="jo-land-history-report-pagination">
              <button
                className="jo-land-history-report-btn"
                disabled={page <= 1 || loading}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </button>
              <span className="jo-land-history-report-page-indicator">
                Page {page} of {totalPages}
              </span>
              <button
                className="jo-land-history-report-btn"
                disabled={page >= totalPages || loading}
                onClick={() =>
                  setPage((prev) => Math.min(totalPages, prev + 1))
                }
              >
                Next
              </button>
            </div>
          </div>

          {farmerModalOpen && (
            <div
              className="jo-land-history-modal-overlay"
              onClick={closeFarmerHistoryModal}
            >
              <div
                className="jo-land-history-modal"
                role="dialog"
                aria-modal="true"
                aria-label={`Land history for ${farmerModalFarmerName}`}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="jo-land-history-modal-header">
                  <div>
                    <h2>{farmerModalFarmerName || "Farmer History"}</h2>
                    <p>Complete history view for the selected farmer.</p>
                  </div>
                  <button
                    type="button"
                    className="jo-land-history-report-btn"
                    aria-label="Close modal"
                    title="Close"
                    onClick={closeFarmerHistoryModal}
                  >
                    ×
                  </button>
                </div>

                {farmerModalLoading ? (
                  <div className="jo-land-history-report-state">
                    Loading selected farmer history...
                  </div>
                ) : farmerModalError ? (
                  <div className="jo-land-history-report-state error">
                    {farmerModalError}
                  </div>
                ) : (
                  <>
                    <div className="jo-land-history-report-kpis jo-land-history-modal-kpis">
                      <div className="jo-land-history-report-kpi-card">
                        <span className="label">Records</span>
                        <strong>{farmerModalSummary.totalRecords}</strong>
                      </div>
                      <div className="jo-land-history-report-kpi-card">
                        <span className="label">Current Rows</span>
                        <strong>{farmerModalSummary.currentRecords}</strong>
                      </div>
                      <div className="jo-land-history-report-kpi-card">
                        <span className="label">Transfer Rows</span>
                        <strong>{farmerModalSummary.transferRows}</strong>
                      </div>
                      <div className="jo-land-history-report-kpi-card wide">
                        <span className="label">Total Area (ha)</span>
                        <strong>
                          {farmerModalSummary.totalAreaHa.toFixed(2)}
                        </strong>
                      </div>
                    </div>

                    <div className="jo-land-history-report-farmer-roles">
                      Roles now:{" "}
                      {farmerModalSummary.roleLabels.length > 0
                        ? farmerModalSummary.roleLabels.join(", ")
                        : "No current role tagged."}
                    </div>

                    <section className="jo-land-history-timeline-card jo-land-history-modal-block jo-land-history-transfer-timeline-card">
                      <header className="jo-land-history-transfer-timeline-header">
                        <h3>Transfer Timeline</h3>
                        <div className="jo-land-history-transfer-timeline-summary">
                          <span className="jo-land-history-transfer-events-chip">
                            {farmerModalTransferTimeline.length} events
                          </span>
                          <span className="jo-land-history-transfer-sort-label">
                            Sorted by most recent
                          </span>
                        </div>
                      </header>

                      <p className="jo-land-history-transfer-timeline-subtitle">
                        Shows ownership transfer events only.
                      </p>

                      {farmerModalTransferTimeline.length === 0 ? (
                        <p className="jo-land-history-association-empty">
                          No ownership transfer events found for this farmer.
                        </p>
                      ) : (
                        <ol className="jo-land-history-transfer-timeline-list">
                          {farmerModalTransferTimeline
                            .slice(0, farmerModalTimelineLimit)
                            .map((event) => (
                              <li
                                key={event.id}
                                className={`jo-land-history-transfer-timeline-item ${
                                  event.status === "Current"
                                    ? "is-current"
                                    : "is-past"
                                }`}
                              >
                                <div
                                  className="jo-land-history-transfer-rail-dot"
                                  aria-hidden="true"
                                />

                                <article className="jo-land-history-transfer-event-card">
                                  <div className="jo-land-history-transfer-event-head">
                                    <div className="jo-land-history-transfer-event-date-row">
                                      <span className="jo-land-history-transfer-event-date">
                                        {formatDate(event.eventDate)}
                                      </span>
                                      <span
                                        className={`jo-land-history-transfer-event-status ${
                                          event.status === "Current"
                                            ? "is-current"
                                            : "is-past"
                                        }`}
                                      >
                                        {event.status}
                                      </span>
                                    </div>
                                    <span className="jo-land-history-transfer-event-type">
                                      {getTimelineTypeBadgeLabel(
                                        event.changeType,
                                      )}
                                    </span>
                                  </div>

                                  <div className="jo-land-history-transfer-event-flow">
                                    <span className="jo-land-history-transfer-event-avatar">
                                      {getInitials(event.fromName || "Unknown")}
                                    </span>
                                    <strong>
                                      {event.fromName || "Unknown"}
                                    </strong>
                                    <span className="jo-land-history-transfer-event-arrow">
                                      →
                                    </span>
                                    <em>{event.toName || "Unknown"}</em>
                                  </div>

                                  <div className="jo-land-history-transfer-event-grid">
                                    <div className="jo-land-history-transfer-event-metric">
                                      <span>Role</span>
                                      <strong>
                                        {event.relationship || "-"}
                                      </strong>
                                    </div>
                                    <div className="jo-land-history-transfer-event-metric">
                                      <span>Parcel</span>
                                      <strong>
                                        {event.parcelNumber || "-"}
                                      </strong>
                                    </div>
                                    <div className="jo-land-history-transfer-event-metric">
                                      <span>Barangay</span>
                                      <strong>{event.barangay || "-"}</strong>
                                    </div>
                                  </div>

                                  {event.changeReason && (
                                    <p className="jo-land-history-transfer-event-reason">
                                      Reason: {event.changeReason}
                                    </p>
                                  )}
                                </article>
                              </li>
                            ))}
                        </ol>
                      )}

                      {farmerModalTransferTimeline.length >
                        farmerModalTimelineLimit && (
                        <p className="jo-land-history-timeline-note">
                          Showing latest {farmerModalTimelineLimit} of{" "}
                          {farmerModalTransferTimeline.length} transfer events.
                        </p>
                      )}
                    </section>

                    <section className="jo-land-history-timeline-card jo-land-history-modal-block jo-land-history-transfer-timeline-card">
                      <header className="jo-land-history-transfer-timeline-header">
                        <h3>Tenant / Lessee Association Timeline</h3>
                        <div className="jo-land-history-transfer-timeline-summary">
                          <span className="jo-land-history-transfer-events-chip">
                            {farmerModalAssociationTimeline.length} events
                          </span>
                          <span className="jo-land-history-transfer-sort-label">
                            Sorted by most recent
                          </span>
                        </div>
                      </header>

                      <p className="jo-land-history-transfer-timeline-subtitle">
                        Shows tenant and lessee relationship events only.
                      </p>

                      {farmerModalAssociationTimeline.length === 0 ? (
                        <p className="jo-land-history-association-empty">
                          No tenant or lessee association events found.
                        </p>
                      ) : (
                        <ol className="jo-land-history-transfer-timeline-list">
                          {farmerModalAssociationTimeline
                            .slice(0, farmerModalTimelineLimit)
                            .map((event) => (
                              <li
                                key={event.id}
                                className={`jo-land-history-transfer-timeline-item ${
                                  event.status === "Current"
                                    ? "is-current"
                                    : "is-past"
                                }`}
                              >
                                <div
                                  className="jo-land-history-transfer-rail-dot"
                                  aria-hidden="true"
                                />

                                <article className="jo-land-history-transfer-event-card">
                                  <div className="jo-land-history-transfer-event-head">
                                    <div className="jo-land-history-transfer-event-date-row">
                                      <span className="jo-land-history-transfer-event-date">
                                        {formatDate(event.eventDate)}
                                      </span>
                                      <span
                                        className={`jo-land-history-transfer-event-status ${
                                          event.status === "Current"
                                            ? "is-current"
                                            : "is-past"
                                        }`}
                                      >
                                        {event.status}
                                      </span>
                                    </div>
                                    <span className="jo-land-history-transfer-event-type">
                                      {getTimelineTypeBadgeLabel(
                                        event.changeType,
                                      )}
                                    </span>
                                  </div>

                                  <div className="jo-land-history-transfer-event-flow">
                                    <span className="jo-land-history-transfer-event-avatar">
                                      {getInitials(event.fromName || "Unknown")}
                                    </span>
                                    <strong>
                                      {event.fromName || "Unknown"}
                                    </strong>
                                    <span className="jo-land-history-transfer-event-arrow">
                                      →
                                    </span>
                                    <em>{event.toName || "Unknown"}</em>
                                  </div>

                                  <div className="jo-land-history-transfer-event-grid">
                                    <div className="jo-land-history-transfer-event-metric">
                                      <span>Role</span>
                                      <strong>
                                        {event.relationship || "-"}
                                      </strong>
                                    </div>
                                    <div className="jo-land-history-transfer-event-metric">
                                      <span>Parcel</span>
                                      <strong>
                                        {event.parcelNumber || "-"}
                                      </strong>
                                    </div>
                                    <div className="jo-land-history-transfer-event-metric">
                                      <span>Barangay</span>
                                      <strong>{event.barangay || "-"}</strong>
                                    </div>
                                  </div>

                                  {event.changeReason && (
                                    <p className="jo-land-history-transfer-event-reason">
                                      Reason: {event.changeReason}
                                    </p>
                                  )}
                                </article>
                              </li>
                            ))}
                        </ol>
                      )}

                      {farmerModalAssociationTimeline.length >
                        farmerModalTimelineLimit && (
                        <p className="jo-land-history-timeline-note">
                          Showing latest {farmerModalTimelineLimit} of{" "}
                          {farmerModalAssociationTimeline.length} association
                          events.
                        </p>
                      )}
                    </section>

                    <div className="jo-land-history-report-table-wrap jo-land-history-modal-block">
                      <header className="jo-land-history-transfer-timeline-header">
                        <h3>Detailed History Rows</h3>
                        <div className="jo-land-history-transfer-timeline-summary">
                          <span className="jo-land-history-transfer-events-chip">
                            {farmerModalDetailedRows.length} rows
                          </span>
                        </div>
                      </header>

                      <p className="jo-land-history-transfer-timeline-subtitle">
                        Full row-by-row history where this person appears as
                        farmer or land owner. Association rows follow the same
                        latest-link Current/Past logic used in the Tenant /
                        Lessee Association Timeline.
                      </p>

                      <table className="jo-land-history-report-table">
                        <thead>
                          <tr>
                            <th>Parcel</th>
                            <th>Barangay</th>
                            <th>Owner</th>
                            <th>Farmer</th>
                            <th>Relationship</th>
                            <th>Area (ha)</th>
                            <th>Start</th>
                            <th>Status</th>
                            <th>Change Type</th>
                            <th>Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {farmerModalDetailedRows.length === 0 ? (
                            <tr>
                              <td colSpan={10}>
                                No history rows found for this farmer.
                              </td>
                            </tr>
                          ) : (
                            farmerModalDetailedRows.map((row) => (
                              <tr
                                key={`modal-${row.id}-${row.period_start_date || ""}`}
                              >
                                <td>{row.parcel_number || "-"}</td>
                                <td>{row.farm_location_barangay || "-"}</td>
                                <td>{row.land_owner_name || "-"}</td>
                                <td>{row.farmer_name || "-"}</td>
                                <td>{getRelationship(row)}</td>
                                <td>
                                  {Number(row.total_farm_area_ha || 0).toFixed(
                                    2,
                                  )}
                                </td>
                                <td>{formatDate(row.period_start_date)}</td>
                                <td>
                                  {isAssociationTimelineRow(row)
                                    ? farmerModalTableAssociationCurrentRowIds.has(
                                        row.id,
                                      )
                                      ? "Current"
                                      : "Past"
                                    : row.is_current
                                      ? "Current"
                                      : "Past"}
                                </td>
                                <td>
                                  {formatChangeTypeLabel(
                                    row.change_type,
                                    row.change_reason,
                                    {
                                      selfFlow: namesLikelyMatch(
                                        row.land_owner_name,
                                        row.farmer_name,
                                      ),
                                    },
                                  )}
                                </td>
                                <td>
                                  {isAssociationRoleRow(row)
                                    ? formatAssociationReasonText(
                                        getRelationship(row),
                                        row.land_owner_name,
                                        row.change_reason,
                                      )
                                    : row.change_reason || "-"}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    <section className="jo-land-history-modal-block jo-land-history-advanced-summary">
                      <header className="jo-land-history-advanced-summary-header">
                        <div className="jo-land-history-advanced-summary-copy">
                          <h3>Advanced Relationship Summary</h3>
                          <p>
                            Optional deep relationship context for linked
                            owners, tenants, and lessees.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="jo-land-history-association-toggle jo-land-history-advanced-toggle"
                          aria-label={`${
                            showAdvancedRelationshipSummary ? "Hide" : "Show"
                          } advanced relationship summary`}
                          onClick={() =>
                            setShowAdvancedRelationshipSummary((prev) => !prev)
                          }
                        >
                          {showAdvancedRelationshipSummary ? "Hide" : "Show"}
                        </button>
                      </header>

                      {showAdvancedRelationshipSummary && (
                        <div className="jo-land-history-association-grid">
                          <section className="jo-land-history-association-card">
                            <header className="jo-land-history-association-headline">
                              <span className="jo-land-history-association-chip">
                                {farmerModalAssociations.linkedOwners.length}{" "}
                                {pluralize(
                                  farmerModalAssociations.linkedOwners.length,
                                  "linked owner",
                                  "linked owners",
                                )}
                              </span>
                              <span className="jo-land-history-association-why">
                                Why are they linked?
                              </span>
                              <button
                                type="button"
                                className="jo-land-history-association-toggle"
                                onClick={() =>
                                  setShowOwnerLinkDetails((prev) => !prev)
                                }
                              >
                                {showOwnerLinkDetails ? "Hide" : "Show"}
                              </button>
                            </header>

                            <p className="jo-land-history-association-help">
                              Each card explains if the link is active now, how
                              many parcels are involved, and the tenant/lessee
                              record mix.
                            </p>

                            {farmerModalAssociations.linkedOwners.length ===
                            0 ? (
                              <p className="jo-land-history-association-empty">
                                No owner links found for this farmer.
                              </p>
                            ) : !showOwnerLinkDetails ? (
                              <p className="jo-land-history-association-empty">
                                Click Show to view linked owner details.
                              </p>
                            ) : (
                              <ul className="jo-land-history-association-list">
                                {farmerModalAssociations.linkedOwners.map(
                                  (owner) => (
                                    <li
                                      key={owner.ownerName}
                                      className="jo-land-history-linked-owner-item"
                                    >
                                      <div className="jo-land-history-linked-owner-top">
                                        <div className="jo-land-history-linked-owner-avatar">
                                          {getInitials(owner.ownerName)}
                                        </div>
                                        <div className="jo-land-history-linked-owner-identity">
                                          <strong>{owner.ownerName}</strong>
                                          <small>
                                            {getLinkedOwnerRoleLabel(owner)} •{" "}
                                            {getAssociationLinkStatusLabel(
                                              owner.currentRows,
                                            )}
                                          </small>
                                        </div>
                                      </div>

                                      <div className="jo-land-history-linked-owner-summary">
                                        <span
                                          className={`jo-land-history-linked-owner-status-chip ${
                                            owner.currentRows > 0
                                              ? "is-current"
                                              : "is-past"
                                          }`}
                                        >
                                          {owner.currentRows > 0
                                            ? "Active right now"
                                            : "History only"}
                                        </span>
                                        <p className="jo-land-history-linked-owner-summary-text">
                                          {buildAssociationSnapshotText({
                                            currentRows: owner.currentRows,
                                            relationshipRows:
                                              owner.relationshipRows,
                                            parcelCount: owner.parcels.size,
                                            tenantRows: owner.asTenant,
                                            lesseeRows: owner.asLessee,
                                          })}
                                        </p>
                                      </div>

                                      <div className="jo-land-history-linked-owner-stats">
                                        <div className="jo-land-history-linked-owner-stat">
                                          <strong>{owner.parcels.size}</strong>
                                          <span>
                                            {pluralize(
                                              owner.parcels.size,
                                              "Parcel involved",
                                              "Parcels involved",
                                            )}
                                          </span>
                                        </div>
                                        <div className="jo-land-history-linked-owner-stat">
                                          <strong>{owner.currentRows}</strong>
                                          <span>
                                            {pluralize(
                                              owner.currentRows,
                                              "Active link now",
                                              "Active links now",
                                            )}
                                          </span>
                                        </div>
                                        <div className="jo-land-history-linked-owner-stat">
                                          <strong>{owner.asLessee}</strong>
                                          <span>Lessee records</span>
                                        </div>
                                        <div className="jo-land-history-linked-owner-stat">
                                          <strong>{owner.asTenant}</strong>
                                          <span>Tenant records</span>
                                        </div>
                                      </div>

                                      <p className="jo-land-history-linked-owner-reason">
                                        {buildOwnerLinkExplanation(
                                          owner,
                                          farmerModalFarmerName,
                                        )}
                                      </p>
                                    </li>
                                  ),
                                )}
                              </ul>
                            )}
                          </section>

                          <section className="jo-land-history-association-card">
                            <header className="jo-land-history-association-headline">
                              <span className="jo-land-history-association-chip">
                                {
                                  farmerModalAssociations.linkedTenantsLessees
                                    .length
                                }{" "}
                                {pluralize(
                                  farmerModalAssociations.linkedTenantsLessees
                                    .length,
                                  "linked tenant/lessee",
                                  "linked tenants/lessees",
                                )}
                              </span>
                              <span className="jo-land-history-association-why">
                                Why are they linked?
                              </span>
                              <button
                                type="button"
                                className="jo-land-history-association-toggle"
                                onClick={() =>
                                  setShowCounterpartLinkDetails((prev) => !prev)
                                }
                              >
                                {showCounterpartLinkDetails ? "Hide" : "Show"}
                              </button>
                            </header>

                            <p className="jo-land-history-association-help">
                              Each card explains if the assignment is active
                              now, how many parcels are involved, and whether
                              records are tenant or lessee.
                            </p>

                            {farmerModalAssociations.linkedTenantsLessees
                              .length === 0 ? (
                              <p className="jo-land-history-association-empty">
                                No tenant or lessee links where this farmer
                                appears as owner.
                              </p>
                            ) : !showCounterpartLinkDetails ? (
                              <p className="jo-land-history-association-empty">
                                Click Show to view linked tenant and lessee
                                details.
                              </p>
                            ) : (
                              <ul className="jo-land-history-association-list">
                                {farmerModalAssociations.linkedTenantsLessees.map(
                                  (counterpart) => (
                                    <li
                                      key={counterpart.farmerName}
                                      className="jo-land-history-linked-owner-item"
                                    >
                                      <div className="jo-land-history-linked-owner-top">
                                        <div className="jo-land-history-linked-owner-avatar">
                                          {getInitials(counterpart.farmerName)}
                                        </div>
                                        <div className="jo-land-history-linked-owner-identity">
                                          <strong>
                                            {counterpart.farmerName}
                                          </strong>
                                          <small>
                                            {getLinkedCounterpartRoleLabel(
                                              counterpart,
                                            )}{" "}
                                            •{" "}
                                            {getAssociationLinkStatusLabel(
                                              counterpart.currentRows,
                                            )}
                                          </small>
                                        </div>
                                      </div>

                                      <div className="jo-land-history-linked-owner-summary">
                                        <span
                                          className={`jo-land-history-linked-owner-status-chip ${
                                            counterpart.currentRows > 0
                                              ? "is-current"
                                              : "is-past"
                                          }`}
                                        >
                                          {counterpart.currentRows > 0
                                            ? "Active right now"
                                            : "History only"}
                                        </span>
                                        <p className="jo-land-history-linked-owner-summary-text">
                                          {buildAssociationSnapshotText({
                                            currentRows:
                                              counterpart.currentRows,
                                            relationshipRows:
                                              counterpart.relationshipRows,
                                            parcelCount:
                                              counterpart.parcels.size,
                                            tenantRows: counterpart.tenantRows,
                                            lesseeRows: counterpart.lesseeRows,
                                          })}
                                        </p>
                                      </div>

                                      <div className="jo-land-history-linked-owner-stats">
                                        <div className="jo-land-history-linked-owner-stat">
                                          <strong>
                                            {counterpart.parcels.size}
                                          </strong>
                                          <span>
                                            {pluralize(
                                              counterpart.parcels.size,
                                              "Parcel involved",
                                              "Parcels involved",
                                            )}
                                          </span>
                                        </div>
                                        <div className="jo-land-history-linked-owner-stat">
                                          <strong>
                                            {counterpart.currentRows}
                                          </strong>
                                          <span>
                                            {pluralize(
                                              counterpart.currentRows,
                                              "Active link now",
                                              "Active links now",
                                            )}
                                          </span>
                                        </div>
                                        <div className="jo-land-history-linked-owner-stat">
                                          <strong>
                                            {counterpart.lesseeRows}
                                          </strong>
                                          <span>Lessee records</span>
                                        </div>
                                        <div className="jo-land-history-linked-owner-stat">
                                          <strong>
                                            {counterpart.tenantRows}
                                          </strong>
                                          <span>Tenant records</span>
                                        </div>
                                      </div>

                                      <p className="jo-land-history-linked-owner-reason">
                                        {buildCounterpartLinkExplanation(
                                          counterpart,
                                          farmerModalFarmerName,
                                        )}
                                      </p>
                                    </li>
                                  ),
                                )}
                              </ul>
                            )}
                          </section>
                        </div>
                      )}
                    </section>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JoLandHistoryReport;
