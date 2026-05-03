import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../../components/layout/sidebarStyle.css";
import "../../assets/css/admin css/AdminAuditTrail.css";
import AdminSidebar from "../../components/layout/AdminSidebar";
import { AuditAPI } from "../../components/Audit/auditAPI";
import { supabase } from "../../supabase";

// Recharts for statistics
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";

interface AuditLog {
  id: number;
  timestamp: string;
  formatted_timestamp: string;
  user_id: number | null;
  user_name: string | null;
  user_role: string | null;
  action: string;
  module: string;
  record_id: string | null;
  record_type: string | null;
  description: string;
  old_values: any;
  new_values: any;
  ip_address: string | null;
  session_id: string | null;
  metadata: any;
}

interface AuditStats {
  period: string;
  total: number;
  byAction: { action: string; count: number }[];
  byModule: { module: string; count: number }[];
  byUser: { user_name: string; user_role: string; count: number }[];
  timeline: { date: string; count: number }[];
  criticalActions: AuditLog[];
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

interface AllocationFieldDefinition {
  key: string;
  label: string;
  unit?: string;
}

interface AuditPageContext {
  label: string;
  path: string | null;
}

interface TimeRangeOption {
  value: string;
  label: string;
}

interface FarmerRegistrationPayload {
  farmerName: string | null;
  farmDetails: Record<string, any>;
}

interface AllocationReferencePayload {
  allocationId: string | number | null;
  allocationSeason: string | null;
  allocationDate: string | null;
  farmerName: string | null;
  extraFields: Array<{ label: string; value: string }>;
}

interface RouteMetadataPayload {
  routeUrl: string | null;
  routePath: string | null;
  routeFullPath: string | null;
}

interface AllocationLookupRow {
  id: number;
  season: string | null;
  allocation_date: string | null;
  urea_46_0_0_bags: number | null;
  complete_14_14_14_bags: number | null;
  np_16_20_0_bags: number | null;
  ammonium_sulfate_21_0_0_bags: number | null;
  muriate_potash_0_0_60_bags: number | null;
  zinc_sulfate_bags: number | null;
  vermicompost_bags: number | null;
  chicken_manure_bags: number | null;
  rice_straw_kg: number | null;
  carbonized_rice_hull_bags: number | null;
  biofertilizer_liters: number | null;
  nanobiofertilizer_liters: number | null;
  organic_root_exudate_mix_liters: number | null;
  azolla_microphylla_kg: number | null;
  foliar_liquid_fertilizer_npk_liters: number | null;
  rice_seeds_nsic_rc160_kg: number | null;
  rice_seeds_nsic_rc222_kg: number | null;
  jackpot_kg: number | null;
  us88_kg: number | null;
  th82_kg: number | null;
  rh9000_kg: number | null;
  lumping143_kg: number | null;
  lp296_kg: number | null;
  mestiso_1_kg: number | null;
  mestiso_20_kg: number | null;
  mestiso_29_kg: number | null;
  mestiso_55_kg: number | null;
  mestiso_73_kg: number | null;
  mestiso_99_kg: number | null;
  mestiso_103_kg: number | null;
  nsic_rc402_kg: number | null;
  nsic_rc480_kg: number | null;
  nsic_rc216_kg: number | null;
  nsic_rc218_kg: number | null;
  nsic_rc506_kg: number | null;
  nsic_rc508_kg: number | null;
  nsic_rc512_kg: number | null;
  nsic_rc534_kg: number | null;
  tubigan_28_kg: number | null;
  tubigan_30_kg: number | null;
  tubigan_22_kg: number | null;
  sahod_ulan_2_kg: number | null;
  sahod_ulan_10_kg: number | null;
  salinas_6_kg: number | null;
  salinas_7_kg: number | null;
  salinas_8_kg: number | null;
  malagkit_5_kg: number | null;
}

const ALLOCATION_FERTILIZER_FIELDS: AllocationFieldDefinition[] = [
  { key: "urea_46_0_0_bags", label: "Urea (46-0-0)", unit: "bags" },
  { key: "complete_14_14_14_bags", label: "Complete (14-14-14)", unit: "bags" },
  { key: "np_16_20_0_bags", label: "16-20-0", unit: "bags" },
  {
    key: "ammonium_sulfate_21_0_0_bags",
    label: "Ammonium Sulfate (21-0-0)",
    unit: "bags",
  },
  {
    key: "muriate_potash_0_0_60_bags",
    label: "Muriate Potash (0-0-60)",
    unit: "bags",
  },
  { key: "zinc_sulfate_bags", label: "Zinc Sulfate", unit: "bags" },
  { key: "vermicompost_bags", label: "Vermicompost", unit: "bags" },
  { key: "chicken_manure_bags", label: "Chicken Manure", unit: "bags" },
  { key: "rice_straw_kg", label: "Rice Straw", unit: "kg" },
  {
    key: "carbonized_rice_hull_bags",
    label: "Carbonized Rice Hull (CRH)",
    unit: "bags",
  },
  {
    key: "biofertilizer_liters",
    label: "Biofertilizer (Liquid Concentrate)",
    unit: "liters",
  },
  {
    key: "nanobiofertilizer_liters",
    label: "Nanobiofertilizer",
    unit: "liters",
  },
  {
    key: "organic_root_exudate_mix_liters",
    label: "Organic Root Exudate Mix",
    unit: "liters",
  },
  {
    key: "azolla_microphylla_kg",
    label: "Azolla microphylla",
    unit: "kg",
  },
  {
    key: "foliar_liquid_fertilizer_npk_liters",
    label: "Foliar Liquid Fertilizer (NPK)",
    unit: "liters",
  },
];

const ALLOCATION_SEED_FIELDS: AllocationFieldDefinition[] = [
  { key: "rice_seeds_nsic_rc160_kg", label: "NSIC Rc 160", unit: "kg" },
  { key: "rice_seeds_nsic_rc222_kg", label: "NSIC Rc 222", unit: "kg" },
  { key: "jackpot_kg", label: "Jackpot", unit: "kg" },
  { key: "us88_kg", label: "US88", unit: "kg" },
  { key: "th82_kg", label: "TH82", unit: "kg" },
  { key: "rh9000_kg", label: "RH9000", unit: "kg" },
  { key: "lumping143_kg", label: "Lumping 143", unit: "kg" },
  { key: "lp296_kg", label: "LP296", unit: "kg" },
  { key: "mestiso_1_kg", label: "Mestiso 1", unit: "kg" },
  { key: "mestiso_20_kg", label: "Mestiso 20", unit: "kg" },
  { key: "mestiso_29_kg", label: "Mestiso 29", unit: "kg" },
  { key: "mestiso_55_kg", label: "Mestiso 55", unit: "kg" },
  { key: "mestiso_73_kg", label: "Mestiso 73", unit: "kg" },
  { key: "mestiso_99_kg", label: "Mestiso 99", unit: "kg" },
  { key: "mestiso_103_kg", label: "Mestiso 103", unit: "kg" },
  { key: "nsic_rc402_kg", label: "NSIC Rc 402", unit: "kg" },
  { key: "nsic_rc480_kg", label: "NSIC Rc 480", unit: "kg" },
  { key: "nsic_rc216_kg", label: "NSIC Rc 216", unit: "kg" },
  { key: "nsic_rc218_kg", label: "NSIC Rc 218", unit: "kg" },
  { key: "nsic_rc506_kg", label: "NSIC Rc 506", unit: "kg" },
  { key: "nsic_rc508_kg", label: "NSIC Rc 508", unit: "kg" },
  { key: "nsic_rc512_kg", label: "NSIC Rc 512", unit: "kg" },
  { key: "nsic_rc534_kg", label: "NSIC Rc 534", unit: "kg" },
  { key: "tubigan_28_kg", label: "Tubigan 28", unit: "kg" },
  { key: "tubigan_30_kg", label: "Tubigan 30", unit: "kg" },
  { key: "tubigan_22_kg", label: "Tubigan 22", unit: "kg" },
  { key: "sahod_ulan_2_kg", label: "Sahod Ulan 2", unit: "kg" },
  { key: "sahod_ulan_10_kg", label: "Sahod Ulan 10", unit: "kg" },
  { key: "salinas_6_kg", label: "Salinas 6", unit: "kg" },
  { key: "salinas_7_kg", label: "Salinas 7", unit: "kg" },
  { key: "salinas_8_kg", label: "Salinas 8", unit: "kg" },
  { key: "malagkit_5_kg", label: "Malagkit 5", unit: "kg" },
];

const ALLOCATION_DETECTION_FIELDS = [
  "season",
  "allocation_date",
  ...ALLOCATION_FERTILIZER_FIELDS.map((f) => f.key),
  ...ALLOCATION_SEED_FIELDS.map((f) => f.key),
];

const MODULE_PAGE_FALLBACKS: Record<string, AuditPageContext> = {
  AUTH: { label: "Authentication", path: "/login" },
  RSBSA: { label: "RSBSA", path: "/rsbsa" },
  FARMERS: { label: "Masterlist", path: "/masterlist" },
  INCENTIVES: { label: "Incentives", path: "/incentives" },
  ALLOCATIONS: { label: "Allocation Management", path: "/incentives" },
  REQUESTS: { label: "Request Management", path: "/manage-requests" },
  DISTRIBUTION: { label: "Distribution", path: "/manage-requests" },
  LAND_PLOTS: { label: "Land Registry", path: "/jo-land-registry" },
  LAND_HISTORY: { label: "Land Registry", path: "/jo-land-registry" },
  REPORTS: { label: "Reports", path: "/dashboard" },
  USERS: { label: "User Management", path: "/dashboard" },
  SYSTEM: { label: "System", path: null },
};

const TIME_RANGE_OPTIONS: TimeRangeOption[] = [
  { value: "1", label: "Last 1 Month" },
  { value: "2", label: "Last 2 Months" },
  { value: "3", label: "Last 3 Months" },
  { value: "6", label: "Last 6 Months" },
  { value: "12", label: "Last 12 Months" },
  { value: "all", label: "All Time" },
];

const FARM_ACTIVITY_LABELS: Record<string, string> = {
  mainLivelihood: "Main Livelihood",
  farmerRice: "Rice",
  farmerCorn: "Corn",
  farmerOtherCrops: "Other Crops",
  farmerOtherCropsText: "Other Crops",
  farmerLivestock: "Livestock",
  farmerLivestockText: "Livestock",
  farmerPoultry: "Poultry",
  farmerPoultryText: "Poultry",
};

// Use the shared Supabase client
const auditAPI = new AuditAPI(supabase);

const AuditTrail: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // State
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [allocationLookup, setAllocationLookup] = useState<
    Record<string, AllocationLookupRow>
  >({});
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 25,
    totalCount: 0,
    totalPages: 0,
  });

  // Filters
  const [timeRangeMonths, setTimeRangeMonths] = useState<string>("1");
  const [userNameFilter] = useState<string>("");
  const [userRoleFilter] = useState<string>("all");
  const [actionFilter] = useState<string>("all");
  const [moduleFilter] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState<string>("");

  // Notifications
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationType, setNotificationType] = useState<
    "success" | "error" | "warning"
  >("success");

  // View state
  const [viewMode, setViewMode] = useState<"list" | "stats">("list");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  // Colors for charts
  const ACTION_COLORS: { [key: string]: string } = {
    CREATE: "#22c55e",
    UPDATE: "#3b82f6",
    DELETE: "#ef4444",
    LOGIN: "#8b5cf6",
    LOGOUT: "#6366f1",
    LOGIN_FAILED: "#dc2626",
    APPROVE: "#10b981",
    REJECT: "#f59e0b",
    EXPORT: "#06b6d4",
    DISTRIBUTE: "#14b8a6",
  };

  const MODULE_COLORS = [
    "#3b82f6",
    "#22c55e",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#06b6d4",
    "#ec4899",
    "#14b8a6",
  ];

  const showToast = (
    message: string,
    type: "success" | "error" | "warning",
    timeout = 3200,
  ) => {
    setNotificationType(type);
    setNotificationMessage(message);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), timeout);
  };

  const buildDateRangeFilters = useCallback(() => {
    if (timeRangeMonths === "all") {
      return {};
    }

    const months = Number(timeRangeMonths);
    if (!Number.isFinite(months) || months <= 0) {
      return {};
    }

    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setMonth(startDate.getMonth() - months);

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  }, [timeRangeMonths]);

  const buildAuditFilters = useCallback(() => {
    const userName = userNameFilter.trim();
    const search = searchFilter.trim();

    return {
      ...buildDateRangeFilters(),
      userName: userName || undefined,
      userRole: userRoleFilter !== "all" ? userRoleFilter : undefined,
      action: actionFilter !== "all" ? actionFilter : undefined,
      module: moduleFilter !== "all" ? moduleFilter : undefined,
      search: search || undefined,
    };
  }, [
    actionFilter,
    buildDateRangeFilters,
    moduleFilter,
    searchFilter,
    userNameFilter,
    userRoleFilter,
  ]);

  // Replace fetchLogs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await auditAPI.getLogs({
        ...buildAuditFilters(),
        page: pagination.page,
        limit: pagination.limit,
      });

      setLogs(result.data || []);
      setPagination((prev) => ({
        ...prev,
        totalCount: result.pagination.totalCount,
        totalPages: result.pagination.totalPages,
      }));
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      showToast("Failed to fetch audit logs", "error");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, buildAuditFilters]);

  // Fetch stats
  // Replace fetchStats
  const fetchStats = async () => {
    try {
      const data = await auditAPI.getStats({ period: "30d" });
      setStats(data as AuditStats);
    } catch (error) {
      console.error("Error fetching audit stats:", error);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (viewMode === "stats") {
      fetchStats();
    }
  }, [viewMode]);

  useEffect(() => {
    let isMounted = true;

    const fetchAllocationLookup = async () => {
      const { data, error } = await supabase.from("regional_allocations")
        .select(`
                    id,
                    season,
                    allocation_date,
                    urea_46_0_0_bags,
                    complete_14_14_14_bags,
                    np_16_20_0_bags,
                    ammonium_sulfate_21_0_0_bags,
                    muriate_potash_0_0_60_bags,
                    zinc_sulfate_bags,
                    vermicompost_bags,
                    chicken_manure_bags,
                    rice_straw_kg,
                    carbonized_rice_hull_bags,
                    biofertilizer_liters,
                    nanobiofertilizer_liters,
                    organic_root_exudate_mix_liters,
                    azolla_microphylla_kg,
                    foliar_liquid_fertilizer_npk_liters,
                    rice_seeds_nsic_rc160_kg,
                    rice_seeds_nsic_rc222_kg,
                    jackpot_kg,
                    us88_kg,
                    th82_kg,
                    rh9000_kg,
                    lumping143_kg,
                    lp296_kg,
                    mestiso_1_kg,
                    mestiso_20_kg,
                    mestiso_29_kg,
                    mestiso_55_kg,
                    mestiso_73_kg,
                    mestiso_99_kg,
                    mestiso_103_kg,
                    nsic_rc402_kg,
                    nsic_rc480_kg,
                    nsic_rc216_kg,
                    nsic_rc218_kg,
                    nsic_rc506_kg,
                    nsic_rc508_kg,
                    nsic_rc512_kg,
                    nsic_rc534_kg,
                    tubigan_28_kg,
                    tubigan_30_kg,
                    tubigan_22_kg,
                    sahod_ulan_2_kg,
                    sahod_ulan_10_kg,
                    salinas_6_kg,
                    salinas_7_kg,
                    salinas_8_kg,
                    malagkit_5_kg
                `);

      if (error) {
        console.error(
          "Failed to load allocation lookup for audit trail:",
          error,
        );
        return;
      }

      if (!isMounted) {
        return;
      }

      const lookup = (data || []).reduce<Record<string, AllocationLookupRow>>(
        (acc, row: any) => {
          acc[String(row.id)] = row as AllocationLookupRow;
          return acc;
        },
        {},
      );

      setAllocationLookup(lookup);
    };

    fetchAllocationLookup();
    return () => {
      isMounted = false;
    };
  }, []);

  // Handle range filter change
  const handleTimeRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTimeRangeMonths(e.target.value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Export logs
  // Replace handleExport
  const handleExport = async (format: "json" | "csv") => {
    try {
      const content = await auditAPI.exportLogs(buildAuditFilters(), format);

      // Create download link
      const blob = new Blob([content], {
        type: format === "json" ? "application/json" : "text/csv",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `audit-logs-${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting logs:", error);
      showToast("Failed to export logs", "error");
    }
  };

  // View log details
  const viewLogDetails = (log: AuditLog) => {
    setSelectedLog(log);
    setShowDetailsModal(true);
  };

  // Get action badge class
  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case "CREATE":
        return "admin-audit-badge-create";
      case "UPDATE":
        return "admin-audit-badge-update";
      case "DELETE":
        return "admin-audit-badge-delete";
      case "LOGIN":
        return "admin-audit-badge-login";
      case "LOGOUT":
        return "admin-audit-badge-logout";
      case "LOGIN_FAILED":
        return "admin-audit-badge-failed";
      case "APPROVE":
        return "admin-audit-badge-approve";
      case "REJECT":
        return "admin-audit-badge-reject";
      case "EXPORT":
        return "admin-audit-badge-export";
      case "DISTRIBUTE":
        return "admin-audit-badge-distribute";
      default:
        return "admin-audit-badge-default";
    }
  };

  // Get action icon
  const getActionIcon = (action: string) => {
    switch (action) {
      case "CREATE":
        return "➕";
      case "UPDATE":
        return "✏️";
      case "DELETE":
        return "🗑️";
      case "LOGIN":
        return "🔓";
      case "LOGOUT":
        return "🔒";
      case "LOGIN_FAILED":
        return "❌";
      case "APPROVE":
        return "✅";
      case "REJECT":
        return "❌";
      case "EXPORT":
        return "📤";
      case "DISTRIBUTE":
        return "🚚";
      default:
        return "📋";
    }
  };

  // Format time ago
  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hrs ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return then.toLocaleDateString();
  };

  const parseJsonLikeValue = (value: any): any => {
    if (value === null || value === undefined) return null;
    if (typeof value === "object") return value;
    if (typeof value !== "string") return value;

    const trimmed = value.trim();
    if (!trimmed) return value;

    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return value;
      }
    }

    return value;
  };

  const getHashRoutePath = (input: string): string | null => {
    const hashIndex = input.indexOf("#");
    if (hashIndex < 0) return null;

    const hashFragment = input.slice(hashIndex + 1).trim();
    if (!hashFragment) return null;

    if (hashFragment.startsWith("/")) return hashFragment;
    if (hashFragment.startsWith("!/")) return hashFragment.slice(1);

    return null;
  };

  const sanitizeRoutePath = (value: any): string | null => {
    if (!value || typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    let pathValue = trimmed;
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      try {
        const parsedUrl = new URL(trimmed);
        const hashPath = getHashRoutePath(parsedUrl.hash || "");
        pathValue = hashPath || parsedUrl.pathname || "";
      } catch {
        return null;
      }
    } else {
      const hashPath = getHashRoutePath(trimmed);
      if (hashPath) {
        pathValue = hashPath;
      }
    }

    const withoutQuery = pathValue.split("?")[0].trim();
    if (!withoutQuery) return null;

    const normalizedPath = withoutQuery.startsWith("/")
      ? withoutQuery
      : `/${withoutQuery}`;
    return normalizedPath.replace(/\/+$/, "") || "/";
  };

  const formatRouteLabel = (path: string): string => {
    const cleanPath = sanitizeRoutePath(path);
    if (!cleanPath) return "Unknown Page";

    const routeAliases: { prefix: string; label: string }[] = [
      { prefix: "/jo-create-allocation", label: "JO Create Allocation" },
      {
        prefix: "/technician-create-allocation",
        label: "Technician Create Allocation",
      },
      { prefix: "/jo-add-farmer-request", label: "JO Add Farmer Request" },
      {
        prefix: "/technician-add-farmer-request",
        label: "Technician Add Farmer Request",
      },
      { prefix: "/jo-manage-requests", label: "JO Manage Requests" },
      {
        prefix: "/technician-manage-requests",
        label: "Technician Manage Requests",
      },
      { prefix: "/manage-requests", label: "Admin Manage Requests" },
      { prefix: "/jo-view-allocation", label: "JO View Allocation" },
      {
        prefix: "/technician-view-allocation",
        label: "Technician View Allocation",
      },
      { prefix: "/view-allocation", label: "Admin View Allocation" },
      { prefix: "/jo-dashboard", label: "JO Dashboard" },
      { prefix: "/technician-dashboard", label: "Technician Dashboard" },
      { prefix: "/dashboard", label: "Admin Dashboard" },
      { prefix: "/audit-trail", label: "Audit Trail" },
      { prefix: "/incentives", label: "Incentives" },
      { prefix: "/rsbsa", label: "RSBSA" },
      { prefix: "/jo-rsbsa", label: "JO RSBSA Registration" },
      { prefix: "/jo-rsbsapage", label: "JO RSBSA" },
      { prefix: "/technician-rsbsa", label: "Technician RSBSA" },
      { prefix: "/masterlist", label: "Masterlist" },
    ];

    const matchedAlias = routeAliases.find((item) =>
      cleanPath.startsWith(item.prefix),
    );
    if (matchedAlias) return matchedAlias.label;

    const segments = cleanPath
      .split("/")
      .filter(Boolean)
      .filter((segment) => !/^\d+$/.test(segment))
      .slice(0, 3);

    if (segments.length === 0) return "Unknown Page";

    const words = segments
      .join(" ")
      .replace(/[-_]/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((part) => {
        const lower = part.toLowerCase();
        if (lower === "jo") return "JO";
        if (lower === "rsbsa") return "RSBSA";
        return `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`;
      });

    return words.join(" ");
  };

  const getPagePathFromMetadata = (metadata: any): string | null => {
    const parsed = parseJsonLikeValue(metadata);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return null;

    const pathCandidates = [
      parsed.route_url,
      parsed.route_full_path,
      parsed.url,
      parsed.path,
      parsed.pathname,
      parsed.route,
      parsed.page,
      parsed.route_path,
    ];

    for (const candidate of pathCandidates) {
      const path = sanitizeRoutePath(candidate);
      if (!path || path === "/") continue;
      return path;
    }

    return null;
  };

  const getPageContextFromModule = (log: AuditLog): AuditPageContext => {
    const fallback = MODULE_PAGE_FALLBACKS[log.module];
    if (fallback) return fallback;

    if (log.record_type === "regional_allocation") {
      return { label: "Allocation Management", path: "/incentives" };
    }
    if (log.record_type === "farmer_request") {
      return { label: "Request Management", path: "/manage-requests" };
    }

    return { label: log.module || "Unknown Page", path: null };
  };

  const getPageContext = (log: AuditLog): AuditPageContext => {
    const metadataPath = getPagePathFromMetadata(log.metadata);
    if (metadataPath) {
      return {
        label: formatRouteLabel(metadataPath),
        path: metadataPath,
      };
    }

    return getPageContextFromModule(log);
  };

  const getRoleBasedTablePageLabel = (userRole: string | null): string => {
    const role = (userRole || "").trim().toLowerCase();
    if (role === "jo" || role.includes("job order")) return "JO";
    if (role === "technician" || role.includes("tech")) return "Technician";
    if (role === "admin") return "Admin";
    return "Unknown";
  };

  const isAllocationPayload = (value: any): boolean => {
    const parsed = parseJsonLikeValue(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return false;

    return ALLOCATION_DETECTION_FIELDS.some((key) =>
      Object.prototype.hasOwnProperty.call(parsed, key),
    );
  };

  const formatAllocationSeason = (seasonValue: any) => {
    const season =
      typeof seasonValue === "string" ? seasonValue : String(seasonValue ?? "");
    if (!season) return "N/A";
    const [seasonType, seasonYear] = season.split("_");
    if (!seasonType || !seasonYear) return season;
    return `${seasonType.charAt(0).toUpperCase()}${seasonType.slice(1)} Season ${seasonYear}`;
  };

  const formatAllocationDate = (value: any) => {
    if (!value) return "N/A";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatAllocationAmount = (value: any, unit?: string) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return value ?? "0";

    const formatted = num.toLocaleString("en-US", {
      minimumFractionDigits: num % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    });

    return unit ? `${formatted} ${unit}` : formatted;
  };

  const getAllocationTotal = (
    payload: Record<string, any>,
    fields: AllocationFieldDefinition[],
  ) => {
    return fields.reduce(
      (sum, field) => sum + (Number(payload[field.key]) || 0),
      0,
    );
  };

  const renderAllocationFieldRows = (
    payload: Record<string, any>,
    fields: AllocationFieldDefinition[],
  ) => {
    const enteredFields = fields.filter((field) => {
      const num = Number(payload[field.key]);
      return Number.isFinite(num) && num !== 0;
    });

    if (enteredFields.length === 0) {
      return (
        <div className="admin-audit-allocation-row">
          <span className="admin-audit-allocation-label">
            No inputs recorded
          </span>
          <span className="admin-audit-allocation-value">-</span>
        </div>
      );
    }

    return enteredFields.map((field) => (
      <div className="admin-audit-allocation-row" key={field.key}>
        <span className="admin-audit-allocation-label">{field.label}</span>
        <span className="admin-audit-allocation-value">
          {formatAllocationAmount(payload[field.key], field.unit)}
        </span>
      </div>
    ));
  };

  const renderAllocationPayload = (
    value: any,
    section: "old" | "new" | "metadata" = "new",
  ) => {
    const payload = parseJsonLikeValue(value);
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
      return null;
    const notesValue =
      typeof payload.notes === "string" ? payload.notes.trim() : "";
    const notesText =
      notesValue ||
      (payload.notes !== null && payload.notes !== undefined
        ? String(payload.notes)
        : "No notes provided");

    const totalFertilizer = getAllocationTotal(
      payload,
      ALLOCATION_FERTILIZER_FIELDS,
    );
    const totalSeeds = getAllocationTotal(payload, ALLOCATION_SEED_FIELDS);
    const sectionLabel =
      section === "metadata"
        ? "Allocation Metadata"
        : section === "old"
          ? "Previous Allocation Values"
          : "New Allocation Values";

    return (
      <div
        className={`admin-audit-allocation-payload admin-audit-allocation-payload--${section}`}
      >
        <div className="admin-audit-allocation-header">
          <span className="admin-audit-allocation-title">{sectionLabel}</span>
          <span className="admin-audit-allocation-tag">
            {section === "metadata"
              ? "Metadata"
              : section === "old"
                ? "Previous"
                : "New"}
          </span>
        </div>

        <div className="admin-audit-allocation-summary">
          <div className="admin-audit-allocation-summary-item">
            <span className="admin-audit-allocation-summary-label">Season</span>
            <span className="admin-audit-allocation-summary-value">
              {formatAllocationSeason(payload.season)}
            </span>
          </div>
          <div className="admin-audit-allocation-summary-item">
            <span className="admin-audit-allocation-summary-label">
              Allocation Date
            </span>
            <span className="admin-audit-allocation-summary-value">
              {formatAllocationDate(payload.allocation_date)}
            </span>
          </div>
        </div>

        <div className="admin-audit-allocation-totals-strip">
          <span className="admin-audit-allocation-pill">
            Fertilizer Total: {formatAllocationAmount(totalFertilizer, "bags")}
          </span>
          <span className="admin-audit-allocation-pill">
            Seed Total: {formatAllocationAmount(totalSeeds, "kg")}
          </span>
        </div>

        <div className="admin-audit-allocation-grid">
          <div className="admin-audit-allocation-group">
            <h5>Fertilizer Allocation</h5>
            {renderAllocationFieldRows(payload, ALLOCATION_FERTILIZER_FIELDS)}
          </div>

          <div className="admin-audit-allocation-group">
            <h5>Seed Allocation</h5>
            {renderAllocationFieldRows(payload, ALLOCATION_SEED_FIELDS)}
          </div>
        </div>

        <div className="admin-audit-allocation-notes">
          <span className="admin-audit-allocation-summary-label">Notes</span>
          <span className="admin-audit-allocation-notes-value">
            {notesText}
          </span>
        </div>
      </div>
    );
  };

  const renderAllocationChangeSummary = (oldValue: any, newValue: any) => {
    const oldPayload = parseJsonLikeValue(oldValue);
    const newPayload = parseJsonLikeValue(newValue);

    if (
      !oldPayload ||
      typeof oldPayload !== "object" ||
      Array.isArray(oldPayload) ||
      !newPayload ||
      typeof newPayload !== "object" ||
      Array.isArray(newPayload) ||
      !isAllocationPayload(oldPayload) ||
      !isAllocationPayload(newPayload)
    ) {
      return null;
    }

    const changedFields = [
      ...ALLOCATION_FERTILIZER_FIELDS,
      ...ALLOCATION_SEED_FIELDS,
    ]
      .map((field) => {
        const oldNum = Number(oldPayload[field.key] ?? 0);
        const newNum = Number(newPayload[field.key] ?? 0);
        const safeOld = Number.isFinite(oldNum) ? oldNum : 0;
        const safeNew = Number.isFinite(newNum) ? newNum : 0;
        const delta = safeNew - safeOld;
        return {
          ...field,
          oldValue: safeOld,
          newValue: safeNew,
          delta,
        };
      })
      .filter((field) => field.delta !== 0);

    if (changedFields.length === 0) {
      return null;
    }

    return (
      <div className="admin-audit-detail-section">
        <h4>Seed/Fertilizer Change Tracking</h4>
        <div className="admin-audit-simple-grid">
          {changedFields.map((field) => (
            <div key={field.key} className="admin-audit-simple-item">
              <span className="admin-audit-simple-label">{field.label}</span>
              <span className="admin-audit-simple-value">
                {formatAllocationAmount(field.oldValue, field.unit)} {" -> "}
                {formatAllocationAmount(field.newValue, field.unit)} (
                {field.delta > 0 ? "+" : ""}
                {formatAllocationAmount(field.delta, field.unit)})
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const formatTitleText = (value: any, fallback = "N/A") => {
    if (value === null || value === undefined) return fallback;
    const text = String(value).trim();
    if (!text) return fallback;
    return text
      .replace(/[_-]+/g, " ")
      .split(" ")
      .filter(Boolean)
      .map(
        (part) =>
          `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`,
      )
      .join(" ");
  };

  const formatAreaHectares = (value: any) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return "N/A";
    return `${num.toLocaleString("en-US", {
      minimumFractionDigits: num % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })} ha`;
  };

  const extractFarmerRegistrationPayload = (
    value: any,
  ): FarmerRegistrationPayload | null => {
    const parsed = parseJsonLikeValue(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return null;

    const explicitFarmDetails = parseJsonLikeValue(
      (parsed as Record<string, any>).farmDetails,
    );
    if (
      explicitFarmDetails &&
      typeof explicitFarmDetails === "object" &&
      !Array.isArray(explicitFarmDetails)
    ) {
      const farmerName =
        typeof parsed.farmerName === "string" ? parsed.farmerName : null;
      return {
        farmerName,
        farmDetails: explicitFarmDetails as Record<string, any>,
      };
    }

    const looksLikeFarmDetails =
      Array.isArray((parsed as Record<string, any>).farmlandParcels) ||
      Object.prototype.hasOwnProperty.call(parsed, "ownershipCategory") ||
      Object.prototype.hasOwnProperty.call(parsed, "totalParcels") ||
      Object.prototype.hasOwnProperty.call(parsed, "totalFarmAreaHa") ||
      Object.prototype.hasOwnProperty.call(parsed, "farmActivities") ||
      Object.prototype.hasOwnProperty.call(parsed, "farmLocation") ||
      Object.prototype.hasOwnProperty.call(parsed, "selectedLandOwner");

    if (!looksLikeFarmDetails) return null;

    return {
      farmerName:
        typeof parsed.farmerName === "string" ? parsed.farmerName : null,
      farmDetails: parsed as Record<string, any>,
    };
  };

  const renderFarmerRegistrationPayload = (value: any) => {
    const payload = extractFarmerRegistrationPayload(value);
    if (!payload) return null;

    const details = payload.farmDetails;
    const farmLocation =
      details.farmLocation &&
        typeof details.farmLocation === "object" &&
        !Array.isArray(details.farmLocation)
        ? details.farmLocation
        : {};
    const selectedLandOwner =
      details.selectedLandOwner &&
        typeof details.selectedLandOwner === "object" &&
        !Array.isArray(details.selectedLandOwner)
        ? details.selectedLandOwner
        : null;
    const parcels = Array.isArray(details.farmlandParcels)
      ? details.farmlandParcels
      : [];
    const totalParcels = Number(details.totalParcels) || parcels.length || 0;
    const parsedArea = Number(details.totalFarmAreaHa);
    const totalFarmArea = Number.isFinite(parsedArea)
      ? parsedArea
      : parcels.reduce(
        (sum, parcel) => sum + (Number(parcel?.totalFarmAreaHa) || 0),
        0,
      );
    const selectedParcelIds = Array.isArray(details.selectedParcelIds)
      ? details.selectedParcelIds
      : [];
    const farmActivities =
      details.farmActivities &&
        typeof details.farmActivities === "object" &&
        !Array.isArray(details.farmActivities)
        ? details.farmActivities
        : {};

    const activityTags = Object.entries(farmActivities)
      .filter(([key, value]) => {
        if (key.toLowerCase().endsWith("text")) return false;
        if (typeof value === "boolean") return value;
        return typeof value === "string" && value.trim().length > 0;
      })
      .map(([key, value]) => {
        const label = FARM_ACTIVITY_LABELS[key] || formatTitleText(key, key);
        if (key === "mainLivelihood") {
          return `${label}: ${formatTitleText(value, "N/A")}`;
        }
        return label;
      });

    const activityNotes = Object.entries(farmActivities)
      .filter(
        ([key, value]) =>
          key.toLowerCase().endsWith("text") &&
          typeof value === "string" &&
          value.trim().length > 0,
      )
      .map(([key, value]) => ({
        key,
        label:
          FARM_ACTIVITY_LABELS[key] ||
          formatTitleText(key.replace(/Text$/i, ""), key),
        value: String(value).trim(),
      }));

    return (
      <div className="admin-audit-farmer-payload">
        <div className="admin-audit-farmer-header">
          <span className="admin-audit-farmer-title">
            Farmer Registration Details
          </span>
          {payload.farmerName && (
            <span className="admin-audit-farmer-name">
              {payload.farmerName}
            </span>
          )}
        </div>

        <div className="admin-audit-farmer-summary">
          <div className="admin-audit-farmer-summary-item">
            <span className="admin-audit-farmer-summary-label">
              Ownership Category
            </span>
            <span className="admin-audit-farmer-summary-value">
              {formatTitleText(details.ownershipCategory)}
            </span>
          </div>
          <div className="admin-audit-farmer-summary-item">
            <span className="admin-audit-farmer-summary-label">
              Total Parcels
            </span>
            <span className="admin-audit-farmer-summary-value">
              {totalParcels.toLocaleString("en-US")}
            </span>
          </div>
          <div className="admin-audit-farmer-summary-item">
            <span className="admin-audit-farmer-summary-label">
              Total Farm Area
            </span>
            <span className="admin-audit-farmer-summary-value">
              {formatAreaHectares(totalFarmArea)}
            </span>
          </div>
          <div className="admin-audit-farmer-summary-item">
            <span className="admin-audit-farmer-summary-label">
              Selected Parcel IDs
            </span>
            <span className="admin-audit-farmer-summary-value">
              {selectedParcelIds.length || "N/A"}
            </span>
          </div>
        </div>

        <div className="admin-audit-farmer-grid">
          <div className="admin-audit-farmer-group">
            <h5>Farm Location</h5>
            <div className="admin-audit-farmer-row">
              <span className="admin-audit-farmer-label">Barangay</span>
              <span className="admin-audit-farmer-value">
                {formatTitleText(farmLocation.barangay)}
              </span>
            </div>
            <div className="admin-audit-farmer-row">
              <span className="admin-audit-farmer-label">Municipality</span>
              <span className="admin-audit-farmer-value">
                {formatTitleText(farmLocation.municipality)}
              </span>
            </div>
            <div className="admin-audit-farmer-row">
              <span className="admin-audit-farmer-label">Province</span>
              <span className="admin-audit-farmer-value">
                {formatTitleText(farmLocation.province)}
              </span>
            </div>
          </div>

          <div className="admin-audit-farmer-group">
            <h5>Selected Land Owner</h5>
            {selectedLandOwner ? (
              <>
                <div className="admin-audit-farmer-row">
                  <span className="admin-audit-farmer-label">Name</span>
                  <span className="admin-audit-farmer-value">
                    {formatTitleText(selectedLandOwner.name)}
                  </span>
                </div>
                <div className="admin-audit-farmer-row">
                  <span className="admin-audit-farmer-label">Barangay</span>
                  <span className="admin-audit-farmer-value">
                    {formatTitleText(selectedLandOwner.barangay)}
                  </span>
                </div>
                <div className="admin-audit-farmer-row">
                  <span className="admin-audit-farmer-label">Municipality</span>
                  <span className="admin-audit-farmer-value">
                    {formatTitleText(selectedLandOwner.municipality)}
                  </span>
                </div>
              </>
            ) : (
              <div className="admin-audit-farmer-empty">
                No linked land owner
              </div>
            )}
          </div>
        </div>

        {activityTags.length > 0 && (
          <div className="admin-audit-farmer-group">
            <h5>Farm Activities</h5>
            <div className="admin-audit-farmer-tags">
              {activityTags.map((activity, idx) => (
                <span
                  key={`${activity}-${idx}`}
                  className="admin-audit-farmer-tag"
                >
                  {activity}
                </span>
              ))}
            </div>
          </div>
        )}

        {activityNotes.length > 0 && (
          <div className="admin-audit-farmer-group">
            <h5>Activity Notes</h5>
            {activityNotes.map((note) => (
              <div className="admin-audit-farmer-row" key={note.key}>
                <span className="admin-audit-farmer-label">{note.label}</span>
                <span className="admin-audit-farmer-value">{note.value}</span>
              </div>
            ))}
          </div>
        )}

        {parcels.length > 0 && (
          <div className="admin-audit-farmer-group">
            <h5>Farmland Parcels</h5>
            <div className="admin-audit-farmer-parcels">
              {parcels.map((parcel: any, idx: number) => (
                <div
                  className="admin-audit-farmer-parcel-card"
                  key={`${parcel?.parcelNo || idx}-${idx}`}
                >
                  <div className="admin-audit-farmer-parcel-title">
                    Parcel {parcel?.parcelNo || idx + 1}
                  </div>
                  <div className="admin-audit-farmer-row">
                    <span className="admin-audit-farmer-label">Location</span>
                    <span className="admin-audit-farmer-value">
                      {formatTitleText(parcel?.farmLocationBarangay)}
                      {parcel?.farmLocationMunicipality
                        ? `, ${formatTitleText(parcel.farmLocationMunicipality)}`
                        : ""}
                    </span>
                  </div>
                  <div className="admin-audit-farmer-row">
                    <span className="admin-audit-farmer-label">Area</span>
                    <span className="admin-audit-farmer-value">
                      {formatAreaHectares(parcel?.totalFarmAreaHa)}
                    </span>
                  </div>
                  <div className="admin-audit-farmer-row">
                    <span className="admin-audit-farmer-label">Ownership</span>
                    <span className="admin-audit-farmer-value">
                      {parcel?.ownershipType?.registeredOwner
                        ? "Registered Owner"
                        : parcel?.ownershipType?.tenant &&
                          parcel?.ownershipType?.lessee
                          ? "Tenant + Lessee"
                          : parcel?.ownershipType?.tenant
                            ? "Tenant"
                            : parcel?.ownershipType?.lessee
                              ? "Lessee"
                              : parcel?.ownershipType?.tenantLessee
                                ? "Tenant or Lessee"
                                : parcel?.ownershipType?.others
                                  ? "Others"
                                  : "N/A"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const toKeyLabel = (key: string) => {
    return key
      .replace(/[_-]+/g, " ")
      .split(" ")
      .filter(Boolean)
      .map(
        (part) =>
          `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`,
      )
      .join(" ");
  };

  const isAddedFarmerRequestLog = (log?: AuditLog | null): boolean => {
    if (!log) return false;

    const recordTypeRaw = (log.record_type || "").toLowerCase().trim();
    const recordType = recordTypeRaw.replace(/\s+/g, "_");
    const moduleName = (log.module || "").toUpperCase().trim();
    const action = (log.action || "").toUpperCase().trim();
    const description = (log.description || "").toLowerCase();
    const isFarmerRequestRecord =
      recordType.includes("farmer_request") ||
      recordType.includes("farmer_requests") ||
      description.includes("farmer request") ||
      description.includes("farmer_requests");

    if (isFarmerRequestRecord && description.includes("added farmer request")) {
      return true;
    }

    return (
      isFarmerRequestRecord &&
      action === "CREATE" &&
      (moduleName === "REQUESTS" || description.includes("created"))
    );
  };

  const formatAllocationReferenceFieldValue = (
    key: string,
    value: any,
  ): string => {
    if (value === null || value === undefined || value === "") return "N/A";

    if (typeof value === "number") {
      if (key.endsWith("_bags")) return formatAllocationAmount(value, "bags");
      if (key.endsWith("_kg")) return formatAllocationAmount(value, "kg");
      return formatAllocationAmount(value);
    }

    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }

    if (typeof value === "string") {
      if (key.includes("season")) return formatAllocationSeason(value);
      if (key.includes("date")) return formatAllocationDate(value);
      return value;
    }

    return JSON.stringify(value);
  };

  const extractAllocationReferencePayload = (
    value: any,
  ): AllocationReferencePayload | null => {
    const parsed = parseJsonLikeValue(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return null;

    const record = parsed as Record<string, any>;
    const rawAllocationId = record.allocation_id ?? record.allocationId ?? null;
    const payloadAllocationSeason =
      typeof (record.allocation_season ?? record.season) === "string"
        ? String(record.allocation_season ?? record.season)
        : null;
    const payloadAllocationDate =
      typeof record.allocation_date === "string"
        ? record.allocation_date
        : null;
    const allocationFromLookup =
      rawAllocationId !== null &&
        rawAllocationId !== undefined &&
        rawAllocationId !== ""
        ? allocationLookup[String(rawAllocationId)] || null
        : null;
    const allocationSeason =
      payloadAllocationSeason ||
      (typeof allocationFromLookup?.season === "string"
        ? allocationFromLookup.season
        : null);
    const allocationDate =
      payloadAllocationDate ||
      (typeof allocationFromLookup?.allocation_date === "string"
        ? allocationFromLookup.allocation_date
        : null);

    const hasRequestedFields = Object.keys(record).some((key) =>
      key.startsWith("requested_"),
    );
    const hasAllocationReference =
      rawAllocationId !== null &&
      rawAllocationId !== undefined &&
      rawAllocationId !== "";
    if (
      !hasAllocationReference &&
      !allocationSeason &&
      !allocationDate &&
      !hasRequestedFields
    )
      return null;

    const farmerName =
      typeof (record.farmer_name ?? record.farmerName) === "string"
        ? String(record.farmer_name ?? record.farmerName)
        : null;

    const ignoredKeys = new Set([
      "allocation_id",
      "allocationId",
      "allocation_season",
      "season",
      "allocation_date",
      "farmer_name",
      "farmerName",
    ]);
    const payloadExtraFields = Object.entries(record)
      .filter(
        ([key, fieldValue]) =>
          !ignoredKeys.has(key) &&
          fieldValue !== null &&
          fieldValue !== undefined &&
          String(fieldValue).trim() !== "",
      )
      .map(([key, fieldValue]) => ({
        label: toKeyLabel(key),
        value: formatAllocationReferenceFieldValue(key, fieldValue),
      }));

    const lookupExtraFields: Array<{ label: string; value: string }> = [];
    if (allocationFromLookup) {
      const fertilizerTotal = getAllocationTotal(
        allocationFromLookup as Record<string, any>,
        ALLOCATION_FERTILIZER_FIELDS,
      );
      const seedTotal = getAllocationTotal(
        allocationFromLookup as Record<string, any>,
        ALLOCATION_SEED_FIELDS,
      );
      lookupExtraFields.push(
        {
          label: "Allocation Fertilizer Total",
          value: formatAllocationAmount(fertilizerTotal, "bags"),
        },
        {
          label: "Allocation Seed Total",
          value: formatAllocationAmount(seedTotal, "kg"),
        },
      );
    }

    const extraFields = [...lookupExtraFields, ...payloadExtraFields];

    return {
      allocationId: rawAllocationId,
      allocationSeason,
      allocationDate,
      farmerName,
      extraFields,
    };
  };

  const renderAllocationReferencePayload = (
    value: any,
    section: "old" | "new" | "metadata" = "new",
    logContext?: AuditLog | null,
  ) => {
    const payload = extractAllocationReferencePayload(value);
    if (!payload) return null;
    const isAddedFarmerRequest = isAddedFarmerRequestLog(logContext);
    const allocationSummaryParts: string[] = [];
    if (payload.allocationSeason) {
      allocationSummaryParts.push(
        formatAllocationSeason(payload.allocationSeason),
      );
    }
    if (payload.allocationDate) {
      allocationSummaryParts.push(formatAllocationDate(payload.allocationDate));
    }
    if (
      payload.allocationId !== null &&
      payload.allocationId !== undefined &&
      payload.allocationId !== ""
    ) {
      allocationSummaryParts.push(`Ref #${payload.allocationId}`);
    }
    const allocationSummary =
      allocationSummaryParts.length > 0
        ? allocationSummaryParts.join(" • ")
        : "N/A";

    return (
      <div
        className={`admin-audit-allocation-ref admin-audit-allocation-ref--${section}`}
      >
        <div className="admin-audit-allocation-ref-header">
          <span className="admin-audit-allocation-ref-title">
            {isAddedFarmerRequest
              ? "Farmer Request Allocation"
              : "Allocation Reference"}
          </span>
          <span className="admin-audit-allocation-ref-badge">
            {section === "metadata"
              ? "Metadata"
              : section === "old"
                ? "Previous"
                : "New"}
          </span>
        </div>

        <div className="admin-audit-allocation-ref-grid">
          <div className="admin-audit-allocation-ref-item">
            <span className="admin-audit-allocation-ref-label">Farmer</span>
            <span className="admin-audit-allocation-ref-value">
              {payload.farmerName || "N/A"}
            </span>
          </div>
          <div className="admin-audit-allocation-ref-item">
            <span className="admin-audit-allocation-ref-label">Allocation</span>
            <span className="admin-audit-allocation-ref-value">
              {allocationSummary}
            </span>
          </div>
        </div>

        {payload.extraFields.length > 0 && (
          <div className="admin-audit-allocation-ref-extra">
            {payload.extraFields.map((field, index) => (
              <div
                className="admin-audit-allocation-ref-row"
                key={`${field.label}-${index}`}
              >
                <span className="admin-audit-allocation-ref-label">
                  {field.label}
                </span>
                <span className="admin-audit-allocation-ref-value">
                  {field.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const extractRouteMetadataPayload = (
    value: any,
  ): RouteMetadataPayload | null => {
    const parsed = parseJsonLikeValue(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return null;

    const record = parsed as Record<string, any>;
    const routeUrl =
      typeof record.route_url === "string" ? record.route_url : null;
    const routePath =
      typeof record.route_path === "string" ? record.route_path : null;
    const routeFullPath =
      typeof record.route_full_path === "string"
        ? record.route_full_path
        : null;

    if (!routeUrl && !routePath && !routeFullPath) return null;

    return { routeUrl, routePath, routeFullPath };
  };

  const renderRouteMetadataPayload = (value: any) => {
    const payload = extractRouteMetadataPayload(value);
    if (!payload) return null;

    const derivedPath =
      sanitizeRoutePath(payload.routeUrl) ||
      sanitizeRoutePath(payload.routeFullPath) ||
      sanitizeRoutePath(payload.routePath);
    const pageLabel = derivedPath
      ? formatRouteLabel(derivedPath)
      : "Unknown Page";

    return (
      <div className="admin-audit-route-metadata">
        <div className="admin-audit-route-metadata-header">
          <span className="admin-audit-route-metadata-title">
            Route Metadata
          </span>
          <span className="admin-audit-route-metadata-page">{pageLabel}</span>
        </div>
        <div className="admin-audit-route-metadata-rows">
          <div className="admin-audit-route-row">
            <span className="admin-audit-route-label">Route URL</span>
            <span className="admin-audit-route-value">
              {payload.routeUrl || "N/A"}
            </span>
          </div>
          <div className="admin-audit-route-row">
            <span className="admin-audit-route-label">Route Full Path</span>
            <span className="admin-audit-route-value">
              {payload.routeFullPath || "N/A"}
            </span>
          </div>
          <div className="admin-audit-route-row">
            <span className="admin-audit-route-label">Route Path</span>
            <span className="admin-audit-route-value">
              {payload.routePath || "N/A"}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const formatNumberDisplay = (value: number) => {
    return new Intl.NumberFormat("en-PH", {
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatSimpleFieldValue = (key: string, value: any): string => {
    if (value === null || value === undefined || value === "") return "N/A";

    if (typeof value === "boolean") return value ? "Yes" : "No";

    if (typeof value === "number") {
      if (key === "area") return `${formatNumberDisplay(value)} ha`;
      return formatNumberDisplay(value);
    }

    if (typeof value === "string") {
      if (key === "geometry_type") return value;
      if (key === "coordinate_accuracy") {
        return value
          .replace(/[_-]+/g, " ")
          .split(" ")
          .filter(Boolean)
          .map(
            (part) =>
              `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`,
          )
          .join(" ");
      }
      return value;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  const extractLandPlotSummaryPayload = (
    value: any,
    logContext?: AuditLog | null,
  ): Record<string, any> | null => {
    const parsed = parseJsonLikeValue(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const moduleName = (logContext?.module || "").toUpperCase().trim();
    const recordType = (logContext?.record_type || "").toLowerCase().trim();
    const record = parsed as Record<string, any>;
    const hasLandPlotShapeFields = [
      "geometry_type",
      "area",
      "barangay",
      "coordinate_accuracy",
    ].some((key) => key in record);

    if (
      moduleName === "LAND_PLOTS" ||
      recordType.includes("land_plot") ||
      hasLandPlotShapeFields
    ) {
      return record;
    }

    return null;
  };

  const renderLandPlotSummaryPayload = (
    value: any,
    section: "old" | "new" | "metadata" = "new",
    logContext?: AuditLog | null,
  ) => {
    const payload = extractLandPlotSummaryPayload(value, logContext);
    if (!payload) return null;

    const rows = [
      {
        label: "Geometry Type",
        value: formatSimpleFieldValue("geometry_type", payload.geometry_type),
      },
      {
        label: "Area",
        value: formatSimpleFieldValue("area", payload.area),
      },
      {
        label: "Barangay",
        value: formatSimpleFieldValue("barangay", payload.barangay),
      },
      {
        label: "Coordinate Accuracy",
        value: formatSimpleFieldValue(
          "coordinate_accuracy",
          payload.coordinate_accuracy,
        ),
      },
    ].filter((item) => item.value !== "N/A");

    if (rows.length === 0) return null;

    return (
      <div
        className={`admin-audit-land-plot-payload admin-audit-land-plot-payload--${section}`}
      >
        <div className="admin-audit-land-plot-header">
          <span className="admin-audit-land-plot-title">Land Plot Summary</span>
          <span className="admin-audit-land-plot-tag">
            {section === "metadata"
              ? "Metadata"
              : section === "old"
                ? "Previous"
                : "New"}
          </span>
        </div>

        <div className="admin-audit-land-plot-grid">
          {rows.map((row) => (
            <div key={row.label} className="admin-audit-land-plot-item">
              <span className="admin-audit-land-plot-label">{row.label}</span>
              <span className="admin-audit-land-plot-value">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSimpleObjectPayload = (
    value: any,
    section: "old" | "new" | "metadata" = "new",
  ) => {
    const parsed = parseJsonLikeValue(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const entries = Object.entries(parsed).filter(
      ([, fieldValue]) =>
        fieldValue !== null && fieldValue !== undefined && fieldValue !== "",
    );

    if (entries.length === 0 || entries.length > 8) {
      return null;
    }

    const hasNestedValues = entries.some(([, fieldValue]) => {
      return (
        typeof fieldValue === "object" &&
        fieldValue !== null &&
        !Array.isArray(fieldValue)
      );
    });

    if (hasNestedValues) {
      return null;
    }

    return (
      <div
        className={`admin-audit-simple-payload admin-audit-simple-payload--${section}`}
      >
        <div className="admin-audit-simple-grid">
          {entries.map(([key, fieldValue]) => (
            <div key={key} className="admin-audit-simple-item">
              <span className="admin-audit-simple-label">
                {toKeyLabel(key)}
              </span>
              <span className="admin-audit-simple-value">
                {formatSimpleFieldValue(key, fieldValue)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderValueBlock = (
    value: any,
    section: "old" | "new" | "metadata" = "new",
    logContext?: AuditLog | null,
  ) => {
    if (isAllocationPayload(value)) {
      return renderAllocationPayload(value, section);
    }

    const farmerRegistrationPayload = renderFarmerRegistrationPayload(value);
    if (farmerRegistrationPayload) {
      return farmerRegistrationPayload;
    }

    const allocationReferencePayload = renderAllocationReferencePayload(
      value,
      section,
      logContext,
    );
    if (allocationReferencePayload) {
      return allocationReferencePayload;
    }

    const routeMetadataPayload = renderRouteMetadataPayload(value);
    if (routeMetadataPayload) {
      return routeMetadataPayload;
    }

    const landPlotSummaryPayload = renderLandPlotSummaryPayload(
      value,
      section,
      logContext,
    );
    if (landPlotSummaryPayload) {
      return landPlotSummaryPayload;
    }

    const simpleObjectPayload = renderSimpleObjectPayload(value, section);
    if (simpleObjectPayload) {
      return simpleObjectPayload;
    }

    return (
      <pre className="admin-audit-json-block">
        {JSON.stringify(parseJsonLikeValue(value), null, 2)}
      </pre>
    );
  };

  const selectedLogPageContext = selectedLog
    ? getPageContext(selectedLog)
    : null;

  return (
    <div className="admin-audit-page-container">
      {showNotification && (
        <div
          className={`admin-audit-toast admin-audit-toast-${notificationType}`}
          role="status"
          aria-live="polite"
        >
          <div className="admin-audit-toast-content">
            <span className="admin-audit-toast-icon">
              {notificationType === "success"
                ? "✅"
                : notificationType === "warning"
                  ? "⚠️"
                  : "❌"}
            </span>
            <span className="admin-audit-toast-message">
              {notificationMessage}
            </span>
          </div>
          <button
            className="admin-audit-toast-close"
            onClick={() => setShowNotification(false)}
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      )}

      <div className="admin-audit-main-page">
        <AdminSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        {/* Main Content */}
        <div className="admin-audit-main-content">
          <div className="tech-incent-mobile-header">
            <button
              className="tech-incent-hamburger"
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <div className="tech-incent-mobile-title">Audit Trail</div>
          </div>
          {/* Header */}
          <div className="admin-audit-header">
            <div className="admin-audit-header-left">
              <h2>📋 System Audit Trail</h2>
              <p>Track all system activities, changes, and user actions</p>
            </div>
          </div>
          <div className="audit-header-right">
            <div className="admin-audit-view-toggle">
              <button
                className={`admin-audit-toggle-btn ${viewMode === "list" ? "active" : ""}`}
                onClick={() => setViewMode("list")}
              >
                📃 Log List
              </button>
              <button
                className={`admin-audit-toggle-btn ${viewMode === "stats" ? "active" : ""}`}
                onClick={() => setViewMode("stats")}
              >
                📊 Statistics
              </button>
            </div>
          </div>

          {viewMode === "list" ? (
            <>
              {/* Filters */}
              <div className="admin-audit-filters">
                <div className="admin-audit-time-filter-row">
                  <div className="admin-audit-filter-group admin-audit-filter-group-range">
                    <label>Time Range</label>
                    <select
                      value={timeRangeMonths}
                      onChange={handleTimeRangeChange}
                    >
                      {TIME_RANGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <span className="admin-audit-filter-note">
                      Filters logs by the selected period.
                    </span>
                  </div>
                  <div className="admin-audit-filters-actions">
                    <div className="admin-audit-export-dropdown">
                      <button className="admin-audit-btn admin-audit-btn-export">
                        Export
                      </button>
                      <div className="admin-audit-export-menu">
                        <button onClick={() => handleExport("json")}>
                          Export JSON
                        </button>
                        <button onClick={() => handleExport("csv")}>
                          Export CSV
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="admin-audit-filters-row">
                  <div className="admin-audit-filter-group">
                    <label>Search</label>
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={(e) => {
                        setSearchFilter(e.target.value);
                        setPagination((prev) => ({ ...prev, page: 1 }));
                      }}
                      placeholder="Description, record type, module"
                    />
                  </div>
                </div>
              </div>

              {/* Stats Summary */}
              <div className="admin-audit-stats-summary">
                <div className="admin-audit-stat-card">
                  <span className="admin-audit-stat-value">
                    {pagination.totalCount}
                  </span>
                  <span className="admin-audit-stat-label">Total Records</span>
                </div>
                <div className="admin-audit-stat-card">
                  <span className="admin-audit-stat-value">
                    {pagination.page}/{pagination.totalPages || 1}
                  </span>
                  <span className="admin-audit-stat-label">Current Page</span>
                </div>
              </div>

              {/* Logs Table */}
              <div className="admin-audit-table-container">
                {loading ? (
                  <div className="admin-audit-loading">
                    Loading audit logs...
                  </div>
                ) : logs.length === 0 ? (
                  <div className="admin-audit-empty">
                    <p>📭 No audit logs found</p>
                    <p>Adjust your filters or check back later</p>
                  </div>
                ) : (
                  <table className="admin-audit-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Page</th>
                        <th>Action</th>
                        <th>Module</th>
                        <th>Description</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => {
                        const tablePageLabel = getRoleBasedTablePageLabel(
                          log.user_role,
                        );
                        return (
                          <tr key={log.id}>
                            <td className="admin-audit-td-timestamp">
                              <div className="admin-audit-timestamp">
                                <span className="admin-audit-time-ago">
                                  {formatTimeAgo(log.timestamp)}
                                </span>
                                <span className="admin-audit-time-full">
                                  {log.formatted_timestamp}
                                </span>
                              </div>
                            </td>
                            <td className="admin-audit-td-page">
                              <div className="admin-audit-page">
                                <span className="admin-audit-page-name">
                                  {tablePageLabel}
                                </span>
                              </div>
                            </td>
                            <td>
                              <span
                                className={`admin-audit-action-badge ${getActionBadgeClass(log.action)}`}
                              >
                                {getActionIcon(log.action)} {log.action}
                              </span>
                            </td>
                            <td>
                              <span className="admin-audit-module-badge">
                                {log.module}
                              </span>
                            </td>
                            <td className="admin-audit-td-description">
                              <span className="admin-audit-description">
                                {log.description}
                              </span>
                              {log.record_id && (
                                <span className="admin-audit-record-id">
                                  ID: {log.record_id}
                                </span>
                              )}
                            </td>
                            <td>
                              <button
                                className="admin-audit-btn-details"
                                onClick={() => viewLogDetails(log)}
                              >
                                👁️ View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="admin-audit-pagination">
                  <button
                    disabled={pagination.page === 1}
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        page: prev.page - 1,
                      }))
                    }
                  >
                    ← Previous
                  </button>
                  <span className="admin-audit-page-info">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    disabled={pagination.page === pagination.totalPages}
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        page: prev.page + 1,
                      }))
                    }
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Statistics View */
            <div className="admin-audit-stats-view">
              {stats ? (
                <>
                  {/* Stats Cards */}
                  <div className="admin-audit-stats-cards">
                    <div className="admin-audit-stats-card admin-audit-stats-total">
                      <h3>Total Activity</h3>
                      <p className="admin-audit-stats-number">{stats.total}</p>
                      <span>Last {stats.period}</span>
                    </div>
                  </div>

                  {/* Charts Row */}
                  <div className="admin-audit-charts-row">
                    {/* Activity Timeline */}
                    <div className="admin-audit-chart-card admin-audit-chart-wide">
                      <h4>📈 Activity Timeline</h4>
                      <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={stats.timeline}>
                          <defs>
                            <linearGradient
                              id="colorActivity"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="#3b82f6"
                                stopOpacity={0.8}
                              />
                              <stop
                                offset="95%"
                                stopColor="#3b82f6"
                                stopOpacity={0.1}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(d) =>
                              new Date(d).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })
                            }
                          />
                          <YAxis />
                          <Tooltip />
                          <Area
                            type="monotone"
                            dataKey="count"
                            stroke="#3b82f6"
                            fill="url(#colorActivity)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="admin-audit-charts-row">
                    {/* Actions Distribution */}
                    <div className="admin-audit-chart-card">
                      <h4>🎯 Actions Distribution</h4>
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={stats.byAction}
                            dataKey="count"
                            nameKey="action"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={(props: Record<string, unknown>) =>
                              `${props.action} ${((props.percent as number) * 100).toFixed(0)}%`
                            }
                          >
                            {stats.byAction.map((entry, index) => (
                              <Cell
                                key={index}
                                fill={ACTION_COLORS[entry.action] || "#64748b"}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Module Distribution */}
                    <div className="admin-audit-chart-card">
                      <h4>📦 By Module</h4>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={stats.byModule} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="module" type="category" width={100} />
                          <Tooltip />
                          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                            {stats.byModule.map((_, index) => (
                              <Cell
                                key={index}
                                fill={
                                  MODULE_COLORS[index % MODULE_COLORS.length]
                                }
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Top Users */}
                  <div className="admin-audit-chart-card">
                    <h4>👥 Most Active Users</h4>
                    <div className="admin-audit-top-users">
                      {stats.byUser.map((user, idx) => {
                        const displayName =
                          user.user_name &&
                            user.user_name.toLowerCase() !== "unknown"
                            ? user.user_name
                            : "Anonymous";
                        const displayRole = user.user_role || "anonymous";
                        const roleClass = displayRole.toLowerCase();
                        return (
                          <div key={idx} className="admin-audit-user-row">
                            <span className="admin-audit-user-rank">
                              {idx + 1}
                            </span>
                            <span className="admin-audit-user-name">
                              {displayName}
                            </span>
                            <span
                              className={`admin-audit-role-badge admin-audit-role-${roleClass}`}
                            >
                              {displayRole}
                            </span>
                            <span className="admin-audit-user-count">
                              {user.count} actions
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="admin-audit-loading">Loading statistics...</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedLog && (
        <div
          className="admin-audit-modal-overlay"
          onClick={() => setShowDetailsModal(false)}
        >
          <div
            className="admin-audit-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-audit-modal-header">
              <h3>📋 Audit Log Details</h3>
              <button
                className="admin-audit-modal-close"
                onClick={() => setShowDetailsModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="admin-audit-modal-body">
              <div className="admin-audit-detail-section">
                <h4>General Information</h4>
                <div className="admin-audit-detail-grid">
                  <div className="admin-audit-detail-item">
                    <span className="admin-audit-detail-label">ID</span>
                    <span className="admin-audit-detail-value">
                      {selectedLog.id}
                    </span>
                  </div>
                  <div className="admin-audit-detail-item">
                    <span className="admin-audit-detail-label">Timestamp</span>
                    <span className="admin-audit-detail-value">
                      {selectedLog.formatted_timestamp}
                    </span>
                  </div>
                  <div className="admin-audit-detail-item">
                    <span className="admin-audit-detail-label">Page</span>
                    <span className="admin-audit-detail-value">
                      {selectedLogPageContext?.label || "Unknown Page"}
                    </span>
                  </div>
                  <div className="admin-audit-detail-item">
                    <span className="admin-audit-detail-label">IP Address</span>
                    <span className="admin-audit-detail-value">
                      {selectedLog.ip_address || "N/A"}
                    </span>
                  </div>
                  <div className="admin-audit-detail-item">
                    <span className="admin-audit-detail-label">Route</span>
                    <span className="admin-audit-detail-value">
                      {selectedLogPageContext?.path
                        ? formatRouteLabel(selectedLogPageContext.path)
                        : "Not captured"}
                    </span>
                  </div>
                  <div className="admin-audit-detail-item">
                    <span className="admin-audit-detail-label">Actor Role</span>
                    <span className="admin-audit-detail-value">
                      {selectedLog.user_role || "anonymous"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="admin-audit-detail-section">
                <h4>Action Details</h4>
                <div className="admin-audit-detail-grid">
                  <div className="admin-audit-detail-item">
                    <span className="admin-audit-detail-label">Action</span>
                    <span
                      className={`admin-audit-action-badge ${getActionBadgeClass(selectedLog.action)}`}
                    >
                      {getActionIcon(selectedLog.action)} {selectedLog.action}
                    </span>
                  </div>
                  <div className="admin-audit-detail-item">
                    <span className="admin-audit-detail-label">Module</span>
                    <span className="admin-audit-module-badge">
                      {selectedLog.module}
                    </span>
                  </div>
                  <div className="admin-audit-detail-item">
                    <span className="admin-audit-detail-label">
                      Record Type
                    </span>
                    <span className="admin-audit-detail-value">
                      {selectedLog.record_type || "N/A"}
                    </span>
                  </div>
                  <div className="admin-audit-detail-item">
                    <span className="admin-audit-detail-label">Record ID</span>
                    <span className="admin-audit-detail-value">
                      {selectedLog.record_id || "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="admin-audit-detail-section">
                <h4>Description</h4>
                <p className="admin-audit-detail-description">
                  {selectedLog.description}
                </p>
              </div>

              {selectedLog.old_values && (
                <div className="admin-audit-detail-section">
                  <h4>Previous Values</h4>
                  {renderValueBlock(selectedLog.old_values, "old", selectedLog)}
                </div>
              )}

              {selectedLog.new_values && (
                <div className="admin-audit-detail-section">
                  <h4>New Values</h4>
                  {renderValueBlock(selectedLog.new_values, "new", selectedLog)}
                </div>
              )}

              {selectedLog.old_values &&
                selectedLog.new_values &&
                renderAllocationChangeSummary(
                  selectedLog.old_values,
                  selectedLog.new_values,
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditTrail;
