import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  getRsbsaSubmissions,
  getRsbsaSubmissionById,
  getFarmParcels,
} from "../../api";
import {
  printRsbsaFormById,
  printRsbsaFormsByIds,
} from "../../utils/rsbsaPrint";
import "../../assets/css/admin css/MasterlistStyle.css";
import "../../assets/css/jo css/FarmerDetailModal.css";
import "../../components/layout/sidebarStyle.css";
import AdminSidebar from "../../components/layout/AdminSidebar";

interface FarmerDetailModal {
  id: string;
  farmerName: string;
  farmerAddress: string;
  age: number | string;
  gender: string;
  mainLivelihood: string;
  farmingActivities: string[];
  parcels: ParcelDetail[];
}

interface ParcelDetail {
  id: string;
  parcelNumber: string;
  farmLocationBarangay: string;
  farmLocationMunicipality: string;
  totalFarmAreaHa: number;
  ownershipTypeRegisteredOwner: boolean;
  ownershipTypeTenant: boolean;
  ownershipTypeLessee: boolean;
  tenantLandOwnerName: string;
  lesseeLandOwnerName: string;
}

interface RSBSARecord {
  id: string;
  referenceNumber: string;
  farmerName: string;
  farmerAddress: string;
  farmLocation: string;
  parcelArea: string;
  parcelCount: number;
  dateSubmitted: string;
  status: string;
  landParcel: string;
  ownershipType?: {
    registeredOwner: boolean;
    tenant: boolean;
    lessee: boolean;
    tenantLessee?: boolean;
    category?: "registeredOwner" | "tenantLessee" | "unknown";
  };
}

type SortKey = "farmerName" | "dateSubmitted" | "status" | "parcelArea";
type SortDirection = "asc" | "desc";

const DEFAULT_SORT_CONFIG: { key: SortKey; direction: SortDirection } = {
  key: "dateSubmitted",
  direction: "desc",
};
const MAX_SORT_LEVELS = 2;

const getDefaultSortDirection = (key: SortKey): SortDirection => {
  if (key === "farmerName" || key === "parcelArea") return "asc";
  return "desc";
};

const Masterlist: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rsbsaRecords, setRsbsaRecords] = useState<RSBSARecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [barangayFilter, setBarangayFilter] = useState<string>("all");
  const [selectedFarmer, setSelectedFarmer] =
    useState<FarmerDetailModal | null>(null);
  const [loadingFarmerDetail, setLoadingFarmerDetail] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [sortConfigs, setSortConfigs] = useState<
    Array<{ key: SortKey; direction: SortDirection }>
  >([{ ...DEFAULT_SORT_CONFIG }]);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(
    new Set(),
  );
  const [openQuickActionsId, setOpenQuickActionsId] = useState<string | null>(
    null,
  );
  const [showBulkExportMenu, setShowBulkExportMenu] = useState(false);
  const [isModalPrinting, setIsModalPrinting] = useState(false);
  const [isBulkPrinting, setIsBulkPrinting] = useState(false);
  const [printingRecordIds, setPrintingRecordIds] = useState<Set<string>>(
    new Set(),
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage] = useState(15);

  const isActive = (path: string) => location.pathname === path;

  const fetchFarmerDetails = async (farmerId: string) => {
    try {
      setLoadingFarmerDetail(true);

      const farmerResponse = await getRsbsaSubmissionById(farmerId);
      if (farmerResponse.error)
        throw new Error("Failed to fetch farmer details");
      const farmerData = farmerResponse.data;

      const parcelsResponse = await getFarmParcels(farmerId);
      if (parcelsResponse.error) throw new Error("Failed to fetch parcels");
      const parcelsData = parcelsResponse.data || [];

      const data = farmerData.data || farmerData;

      const activities: string[] = [];
      if (data.farmerRice || data.FARMER_RICE || data.farmer_rice)
        activities.push("Rice");
      if (data.farmerCorn || data.FARMER_CORN || data.farmer_corn)
        activities.push("Corn");
      if (
        data.farmerOtherCrops ||
        data.FARMER_OTHER_CROPS ||
        data.farmer_other_crops
      ) {
        activities.push(
          `Other Crops: ${data.farmerOtherCropsText || data.FARMER_OTHER_CROPS_TEXT || data.farmer_other_crops_text || ""}`,
        );
      }
      if (
        data.farmerLivestock ||
        data.FARMER_LIVESTOCK ||
        data.farmer_livestock
      ) {
        activities.push(
          `Livestock: ${data.farmerLivestockText || data.FARMER_LIVESTOCK_TEXT || data.farmer_livestock_text || ""}`,
        );
      }
      if (data.farmerPoultry || data.FARMER_POULTRY || data.farmer_poultry) {
        activities.push(
          `Poultry: ${data.farmerPoultryText || data.FARMER_POULTRY_TEXT || data.farmer_poultry_text || ""}`,
        );
      }
      if (activities.length === 0 && data.mainLivelihood)
        activities.push(data.mainLivelihood);

      const calculateAge = (birthdate: string): number | string => {
        if (!birthdate || birthdate === "N/A") return "N/A";
        const today = new Date();
        const birthDate = new Date(birthdate);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (
          monthDiff < 0 ||
          (monthDiff === 0 && today.getDate() < birthDate.getDate())
        )
          age--;
        return age;
      };

      const backendName = farmerData.farmerName || "";
      const reformattedFarmerName = (() => {
        if (!backendName || backendName === "N/A") return "N/A";
        const parts = backendName
          .split(",")
          .map((p: string) => p.trim())
          .filter(Boolean);
        if (parts.length === 0) return "N/A";
        if (parts.length === 1) return parts[0];
        return `${parts[0]}, ${parts.slice(1).join(" ")}`;
      })();

      let mappedParcels = parcelsData.map((p: any) => ({
        id: p.id,
        parcelNumber: p.parcel_number || "N/A",
        farmLocationBarangay: p.farm_location_barangay || "N/A",
        farmLocationMunicipality: p.farm_location_municipality || "N/A",
        totalFarmAreaHa: parseFloat(p.total_farm_area_ha) || 0,
        ownershipTypeRegisteredOwner:
          p.ownership_type_registered_owner || false,
        ownershipTypeTenant: p.ownership_type_tenant || false,
        ownershipTypeLessee: p.ownership_type_lessee || false,
        tenantLandOwnerName: p.tenant_land_owner_name || "",
        lesseeLandOwnerName: p.lessee_land_owner_name || "",
      }));

      if (mappedParcels.length === 0) {
        const submissionFarmLocation =
          data.farmLocation || data["FARM LOCATION"] || "";
        const submissionParcelArea = parseFloat(
          data.totalFarmArea ||
            data["TOTAL FARM AREA"] ||
            data.parcelArea ||
            data["PARCEL AREA"] ||
            "0",
        );
        const submissionOwnership = data.ownershipType || {};
        if (submissionFarmLocation || submissionParcelArea > 0) {
          const locationParts = submissionFarmLocation
            .split(",")
            .map((s: string) => s.trim());
          mappedParcels = [
            {
              id: `submission-${farmerId}`,
              parcelNumber: "N/A",
              farmLocationBarangay: locationParts[0] || data.barangay || "N/A",
              farmLocationMunicipality:
                locationParts[1] || data.municipality || "Dumangas",
              totalFarmAreaHa: submissionParcelArea,
              ownershipTypeRegisteredOwner:
                submissionOwnership.registeredOwner || false,
              ownershipTypeTenant: submissionOwnership.tenant || false,
              ownershipTypeLessee: submissionOwnership.lessee || false,
              tenantLandOwnerName: "",
              lesseeLandOwnerName: "",
            },
          ];
        }
      }

      setSelectedFarmer({
        id: farmerId,
        farmerName: reformattedFarmerName,
        farmerAddress: farmerData.farmerAddress || "N/A",
        age: calculateAge(data.dateOfBirth || data.birthdate || "N/A"),
        gender: data.gender || "N/A",
        mainLivelihood: data.mainLivelihood || "N/A",
        farmingActivities: activities,
        parcels: mappedParcels,
      });
      setShowModal(true);
    } catch (err: any) {
      console.error("Error fetching farmer details:", err);
      alert("Failed to load farmer details");
    } finally {
      setLoadingFarmerDetail(false);
    }
  };

  useEffect(() => {
    fetchRSBSARecords();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, barangayFilter]);

  useEffect(() => {
    const handleWindowClick = () => {
      setOpenQuickActionsId(null);
      setShowBulkExportMenu(false);
    };

    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, []);

  useEffect(() => {
    setSelectedRecordIds((previous) => {
      const validIds = new Set(rsbsaRecords.map((record) => record.id));
      const next = new Set<string>();
      previous.forEach((id) => {
        if (validIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [rsbsaRecords]);

  const fetchRSBSARecords = async () => {
    try {
      const response = await getRsbsaSubmissions();
      if (response.error) throw new Error(response.error);
      const data = response.data || [];

      const formattedRecords: RSBSARecord[] = (
        Array.isArray(data) ? data : []
      ).map((item: any, idx: number) => {
        // Prefer backend-transformed fields; fallback to raw
        const referenceNumber = String(
          item.referenceNumber ?? item.id ?? `RSBSA-${idx + 1}`,
        );
        const composedName = [item.surname, item.firstName, item.middleName]
          .filter(Boolean)
          .join(", ");
        const preferredName = item.farmerName ?? composedName;
        const farmerName = String(preferredName || "—");
        const farmerAddress = String(
          item.farmerAddress ?? item.addressBarangay ?? "—",
        );
        const farmLocation = String(item.farmLocation ?? "—");
        const landParcel = String(item.landParcel ?? "—");
        const parcelArea = (() => {
          const direct = item.parcelArea ?? item["PARCEL AREA"];
          if (
            direct !== undefined &&
            direct !== null &&
            String(direct).trim() !== ""
          ) {
            return String(direct);
          }
          // Fallback: parse from landParcel string e.g., "... (1.25 ha)"
          const match = /\(([^)]+)\)/.exec(landParcel);
          return match ? match[1] : "—";
        })();
        const dateSubmitted = item.dateSubmitted
          ? new Date(item.dateSubmitted).toISOString()
          : item.createdAt
            ? new Date(item.createdAt).toISOString()
            : "";

        // Reflect database status semantics: Submitted / Not Submitted
        const status = String(item.status ?? "Not Submitted");

        return {
          id: String(
            item.id ?? `${idx}-${Math.random().toString(36).slice(2)}`,
          ),
          referenceNumber,
          farmerName,
          farmerAddress,
          farmLocation,
          parcelArea,
          parcelCount:
            typeof item.parcelCount === "number" ? item.parcelCount : 0,
          dateSubmitted,
          status,
          landParcel,
          ownershipType: item.ownershipType,
        };
      });

      setRsbsaRecords(formattedRecords);
      setLoading(false);
    } catch (err: any) {
      setError(err.message ?? "Failed to load RSBSA records");
      setLoading(false);
    }
  };

  const getRecordBarangay = (record: RSBSARecord) => {
    const farmerAddress = String(record.farmerAddress || "").trim();
    if (!farmerAddress || farmerAddress === "—") return "";

    const segment = farmerAddress.split(",")[0]?.trim() || "";
    const normalized = segment;
    if (
      !normalized ||
      normalized === "—" ||
      normalized === "n/a" ||
      normalized === "na" ||
      normalized === "unknown"
    ) {
      return "";
    }

    return normalized;
  };

  const barangayOptions = useMemo(() => {
    return Array.from(
      new Set(rsbsaRecords.map((record) => getRecordBarangay(record))),
    )
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [rsbsaRecords]);

  const filteredRecords = rsbsaRecords
    .filter((record) => {
      const q = searchQuery.toLowerCase();

      if (barangayFilter !== "all") {
        const recordBarangay = getRecordBarangay(record);
        if (
          recordBarangay.localeCompare(barangayFilter, undefined, {
            sensitivity: "base",
          }) !== 0
        ) {
          return false;
        }
      }

      const matchesSearch =
        record.farmerName.toLowerCase().includes(q) ||
        record.referenceNumber.toLowerCase().includes(q) ||
        record.farmerAddress.toLowerCase().includes(q);

      return matchesSearch;
    })
    .sort((a, b) => {
      const parseAreaValue = (value: string) => {
        const numericTokens = String(value || "").match(/-?\d+(?:\.\d+)?/g);
        if (!numericTokens || numericTokens.length === 0) return 0;

        const total = numericTokens.reduce((sum, token) => {
          const parsed = Number(token);
          return sum + (Number.isFinite(parsed) ? parsed : 0);
        }, 0);

        return Number.isFinite(total) ? total : 0;
      };

      for (const config of sortConfigs) {
        const factor = config.direction === "asc" ? 1 : -1;

        if (config.key === "farmerName") {
          const result =
            a.farmerName.localeCompare(b.farmerName, undefined, {
              sensitivity: "base",
            }) * factor;
          if (result !== 0) return result;
          continue;
        }

        if (config.key === "dateSubmitted") {
          const result =
            (new Date(a.dateSubmitted).getTime() -
              new Date(b.dateSubmitted).getTime()) *
            factor;
          if (result !== 0) return result;
          continue;
        }

        if (config.key === "status") {
          const result = a.status.localeCompare(b.status) * factor;
          if (result !== 0) return result;
          continue;
        }

        const result =
          (parseAreaValue(a.parcelArea) - parseAreaValue(b.parcelArea)) *
          factor;
        if (result !== 0) return result;
      }

      return 0;
    });

  const selectedRecords = useMemo(
    () => rsbsaRecords.filter((record) => selectedRecordIds.has(record.id)),
    [rsbsaRecords, selectedRecordIds],
  );

  const allFilteredSelected =
    filteredRecords.length > 0 &&
    filteredRecords.every((record) => selectedRecordIds.has(record.id));

  const toggleSelectAllFiltered = () => {
    setSelectedRecordIds((previous) => {
      const next = new Set(previous);
      if (allFilteredSelected) {
        filteredRecords.forEach((record) => next.delete(record.id));
      } else {
        filteredRecords.forEach((record) => next.add(record.id));
      }
      return next;
    });
  };

  const toggleSelectRecord = (id: string) => {
    setSelectedRecordIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSortChange = (key: SortKey) => {
    setSortConfigs((previous) => {
      const defaultDirection = getDefaultSortDirection(key);
      const hasOnlyDefaultSort =
        previous.length === 1 &&
        previous[0].key === DEFAULT_SORT_CONFIG.key &&
        previous[0].direction === DEFAULT_SORT_CONFIG.direction;

      if (hasOnlyDefaultSort && key !== "dateSubmitted") {
        return [{ key, direction: defaultDirection }];
      }

      const existingIndex = previous.findIndex((config) => config.key === key);
      if (existingIndex >= 0) {
        return previous.map((config) =>
          config.key === key
            ? {
                ...config,
                direction: config.direction === "asc" ? "desc" : "asc",
              }
            : config,
        );
      }

      const next = [...previous, { key, direction: defaultDirection }];
      if (next.length <= MAX_SORT_LEVELS) return next;

      return next.slice(next.length - MAX_SORT_LEVELS);
    });
  };

  const resetSortConfig = () => {
    setSortConfigs([{ ...DEFAULT_SORT_CONFIG }]);
  };

  const isDefaultSortConfig =
    sortConfigs.length === 1 &&
    sortConfigs[0].key === DEFAULT_SORT_CONFIG.key &&
    sortConfigs[0].direction === DEFAULT_SORT_CONFIG.direction;

  const getSortIndicator = (key: SortKey) => {
    const index = sortConfigs.findIndex((config) => config.key === key);
    if (index === -1) return "↕";

    const direction = sortConfigs[index].direction;
    const arrow = direction === "asc" ? "▲" : "▼";
    return `${arrow}${index + 1}`;
  };

  const isSortActive = (key: SortKey) =>
    sortConfigs.some((config) => config.key === key);

  // ── Status Counts ──

  const statusCounts = useMemo(() => {
    const active = rsbsaRecords.filter(
      (r) => r.status === "Active Farmer",
    ).length;
    const inactive = rsbsaRecords.filter(
      (r) => r.status === "Not Active",
    ).length;
    const submitted = rsbsaRecords.filter(
      (r) => r.status === "Submitted",
    ).length;
    const notSubmitted = rsbsaRecords.filter(
      (r) => !["Active Farmer", "Not Active", "Submitted"].includes(r.status),
    ).length;
    return {
      active,
      inactive,
      submitted,
      notSubmitted,
      total: rsbsaRecords.length,
    };
  }, [rsbsaRecords]);

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return "—";
    }
  };

  const formatParcelArea = (parcelArea: string) => {
    const parsed = parseFloat(parcelArea);
    if (Number.isFinite(parsed)) {
      return `${parsed.toLocaleString(undefined, {
        minimumFractionDigits: parsed % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      })} ha`;
    }
    return parcelArea && parcelArea !== "—" ? parcelArea : "—";
  };

  const getParcelOwnershipLabel = (parcel: ParcelDetail) => {
    if (parcel.ownershipTypeRegisteredOwner) return "Registered Owner";

    if (parcel.ownershipTypeTenant || parcel.ownershipTypeLessee) {
      const ownerName =
        String(parcel.tenantLandOwnerName || "").trim() ||
        String(parcel.lesseeLandOwnerName || "").trim();
      const roleLabel =
        parcel.ownershipTypeTenant && parcel.ownershipTypeLessee
          ? "Tenant + Lessee"
          : parcel.ownershipTypeTenant
            ? "Tenant"
            : "Lessee";

      return ownerName ? `${roleLabel} (Owner: ${ownerName})` : roleLabel;
    }

    return "—";
  };

  const handlePrintSingleRecord = async (record: RSBSARecord) => {
    setPrintingRecordIds((previous) => {
      const next = new Set(previous);
      next.add(record.id);
      return next;
    });

    const result = await printRsbsaFormById({
      farmerId: record.id,
      fallbackReferenceNumber: record.referenceNumber,
      fallbackFarmerName: record.farmerName,
    });

    if (!result.success && !result.cancelled) {
      alert(result.error || "Failed to print the RSBSA form.");
    }

    setPrintingRecordIds((previous) => {
      const next = new Set(previous);
      next.delete(record.id);
      return next;
    });
  };

  const handleBulkPrint = async () => {
    if (selectedRecords.length === 0) {
      alert("No records selected for printing.");
      return;
    }

    setIsBulkPrinting(true);
    const result = await printRsbsaFormsByIds(
      selectedRecords.map((record) => ({
        farmerId: record.id,
        fallbackReferenceNumber: record.referenceNumber,
        fallbackFarmerName: record.farmerName,
      })),
    );

    setIsBulkPrinting(false);
    setShowBulkExportMenu(false);

    if (!result.success && !result.cancelled) {
      alert(result.error || "Failed to print selected RSBSA forms.");
      return;
    }

    if (result.success && (result.failedCount || 0) > 0) {
      alert(
        `Printed ${result.printedCount || 0} form(s). ${result.failedCount} record(s) could not be prepared.`,
      );
    }
  };

  const handleModalPrint = async () => {
    if (!selectedFarmer) return;

    setIsModalPrinting(true);

    const selectedRecord = rsbsaRecords.find(
      (record) => record.id === selectedFarmer.id,
    );
    const result = await printRsbsaFormById({
      farmerId: selectedFarmer.id,
      fallbackReferenceNumber: selectedRecord?.referenceNumber,
      fallbackFarmerName: selectedFarmer.farmerName,
    });

    setIsModalPrinting(false);

    if (!result.success && !result.cancelled) {
      alert(result.error || "Failed to print the RSBSA form.");
    }
  };

  const getStatusClassName = (status: string) => {
    if (status === "Active Farmer") return "masterlist-admin-status-approved";
    if (status === "Submitted") return "masterlist-admin-status-submitted";
    return "masterlist-admin-status-not-approved";
  };

  const getFarmerInitials = (fullName: string) => {
    const cleaned = (fullName || "")
.replace(/,/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "");
    return cleaned.join("") || "NA";
  };

  return (
    <>
      <div className="masterlist-admin-page-container">
        <div className="masterlist-admin-page">
          <AdminSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

          <div className="masterlist-admin-main-content">
            <div className="tech-incent-mobile-header">
              <button
                className="tech-incent-hamburger"
                onClick={() => setSidebarOpen((prev) => !prev)}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </button>
              <div className="tech-incent-mobile-title">Masterlist</div>
            </div>

            <div className="masterlist-admin-dashboard-header">
              <div className="masterlist-admin-page-left">
                <h2 className="masterlist-admin-page-header">Masterlist</h2>
                <p className="masterlist-admin-page-subtitle">
                  View and manage all registered farmers in the system.
                </p>
              </div>

              {!loading && !error && filteredRecords.length > recordsPerPage && (
                <div className="masterlist-admin-pagination">
                  <button
                    className="masterlist-admin-pagination-btn"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>
                  <span className="masterlist-admin-pagination-info">
                    Page {currentPage} of {Math.ceil(filteredRecords.length / recordsPerPage)}
                  </span>
                  <button
                    className="masterlist-admin-pagination-btn"
                    onClick={() => setCurrentPage((p) => Math.min(Math.ceil(filteredRecords.length / recordsPerPage), p + 1))}
                    disabled={currentPage >= Math.ceil(filteredRecords.length / recordsPerPage)}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            {!loading && !error && (
              <div className="masterlist-status-cards">
                <div className="masterlist-status-card masterlist-card-total">
                  <div className="masterlist-card-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                  </div>
                  <div className="masterlist-card-info">
                    <span className="masterlist-card-count">
                      {rsbsaRecords.length}
                    </span>
                    <span className="masterlist-card-label">TOTAL LAND OWNERS</span>
                  </div>
                </div>
                <div className="masterlist-status-card masterlist-card-active">
                  <div className="masterlist-card-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 11 12 14 22 4"></polyline>
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                    </svg>
                  </div>
                  <div className="masterlist-card-info">
                    <span className="masterlist-card-count">
                      {rsbsaRecords.filter((r) => r.status === "Active" || r.status === "Active Farmer").length}
                    </span>
                    <span className="masterlist-card-label">ACTIVE LAND OWNERS</span>
                  </div>
                </div>
                <div className="masterlist-status-card masterlist-card-inactive">
                  <div className="masterlist-card-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </div>
                  <div className="masterlist-card-info">
                    <span className="masterlist-card-count">
                      {rsbsaRecords.filter((r) => r.status !== "Active" && r.status !== "Active Farmer").length}
                    </span>
                    <span className="masterlist-card-label">INACTIVE LAND OWNERS</span>
                  </div>
                </div>
              </div>
            )}

            <div className="masterlist-admin-content-card">
              <div className="masterlist-admin-filters-section">
                <div className="masterlist-admin-search-filter">
                  <input
                    type="text"
                    placeholder="Search by farmer name, reference number, or barangay..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="masterlist-admin-search-input"
                  />
                </div>
                <div className="masterlist-admin-status-filter">
                  <select
                    className="masterlist-admin-status-select"
                    value={barangayFilter}
                    onChange={(e) => setBarangayFilter(e.target.value)}
                  >
                    <option value="all">All Barangays</option>
                    {barangayOptions.map((barangay) => (
                      <option key={barangay} value={barangay}>
                        {barangay}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!loading && !error && (
                <div className="masterlist-admin-table-meta">
                  <span>
                    Showing {filteredRecords.length} of {rsbsaRecords.length} farmers
                  </span>
                  <span>
                    Tip: Sort up to 2 levels (e.g. Farmer then Parcel Area).
                  </span>
                  {!isDefaultSortConfig && (
                    <button
                      type="button"
                      className="masterlist-admin-sort-btn"
                      onClick={resetSortConfig}
                    >
                      Reset Sort
                    </button>
                  )}
                </div>
              )}

              {!loading && !error && selectedRecordIds.size > 0 && (
                <div className="masterlist-admin-bulk-toolbar">
                  <span className="masterlist-admin-bulk-count">
                    {selectedRecordIds.size} farmer
                    {selectedRecordIds.size === 1 ? "" : "s"} selected
                  </span>
                  <div className="masterlist-admin-bulk-actions">
                    <div
                      className="masterlist-admin-bulk-export-wrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="masterlist-admin-bulk-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowBulkExportMenu((previous) => !previous);
                        }}
                      >
                        Multi-Print ▾
                      </button>
                      {showBulkExportMenu && (
                        <div className="masterlist-admin-bulk-menu">
                          <button
                            className="masterlist-admin-quick-item"
                            onClick={handleBulkPrint}
                            disabled={isBulkPrinting}
                          >
                            {isBulkPrinting
                              ? "Preparing forms..."
                              : "Print Selected RSBSA Forms"}
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      className="masterlist-admin-bulk-btn masterlist-admin-bulk-btn-clear"
                      onClick={() => setSelectedRecordIds(new Set())}
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>
              )}

              <div className="masterlist-admin-table-container">
                <table className="masterlist-admin-farmers-table">
                  <thead>
                    <tr>
                      <th className="masterlist-admin-checkbox-col">
                        <input
                          type="checkbox"
                          className="masterlist-admin-header-checkbox"
                          checked={allFilteredSelected}
                          onChange={toggleSelectAllFiltered}
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Select all visible farmers"
                        />
                      </th>
                      <th>
                        <button
                          className={`masterlist-admin-sort-btn ${
                            isSortActive("farmerName") ? "is-active" : ""
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSortChange("farmerName");
                          }}
                        >
                          Farmer Name {getSortIndicator("farmerName")}
                        </button>
                      </th>
                      <th>Barangay</th>
                      <th>
                        <button
                          className={`masterlist-admin-sort-btn ${
                            isSortActive("parcelArea") ? "is-active" : ""
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSortChange("parcelArea");
                          }}
                        >
                          Parcel Area {getSortIndicator("parcelArea")}
                        </button>
                      </th>
                      <th>
                        <button
                          className={`masterlist-admin-sort-btn ${
                            isSortActive("dateSubmitted") ? "is-active" : ""
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSortChange("dateSubmitted");
                          }}
                        >
                          Submitted {getSortIndicator("dateSubmitted")}
                        </button>
                      </th>
                      <th>
                        <button
                          className={`masterlist-admin-sort-btn ${
                            isSortActive("status") ? "is-active" : ""
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSortChange("status");
                          }}
                        >
                          Status {getSortIndicator("status")}
                        </button>
                      </th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td colSpan={7} className="masterlist-admin-loading-cell">
                          Loading...
                        </td>
                      </tr>
                    )}
                    {error && !loading && (
                      <tr>
                        <td colSpan={7} className="masterlist-admin-error-cell">
                          Error: {error}
                        </td>
                      </tr>
                    )}
                    {!loading && !error && filteredRecords.length > 0 &&
                      filteredRecords.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage).map((record) => {
                        const statusText = record.status || "Not Active";
                        return (
                          <tr
                            key={record.id}
                            className="masterlist-admin-table-row"
                            onClick={() => fetchFarmerDetails(record.id)}
                          >
                            <td className="masterlist-admin-checkbox-col">
                              <input
                                type="checkbox"
                                className="masterlist-admin-row-checkbox"
                                checked={selectedRecordIds.has(record.id)}
                                onChange={() => toggleSelectRecord(record.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>
                            <td>
                              <div className="masterlist-admin-farmer-cell">
                                <div className="masterlist-admin-farmer-avatar">
                                  {getFarmerInitials(record.farmerName)}
                                </div>
                                <div className="masterlist-admin-farmer-meta">
                                  <span className="masterlist-admin-farmer-name">{record.farmerName}</span>
                                  <span className="masterlist-admin-farmer-ref">Ref: {record.referenceNumber}</span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="masterlist-admin-address-cell">
                                <span className="masterlist-admin-address-primary">{record.farmerAddress}</span>
                              </div>
                            </td>
                            <td>
                              <div className="masterlist-admin-parcel-cell">
                                <span className="masterlist-admin-parcel-count">
                                  {record.parcelCount} parcel{record.parcelCount === 1 ? "" : "s"}
                                </span>
                                <span className="masterlist-admin-parcel-area">{formatParcelArea(record.parcelArea)}</span>
                              </div>
                            </td>
                            <td>
                              <span className="masterlist-admin-date">{formatDate(record.dateSubmitted)}</span>
                            </td>
                            <td>
                              <span className={`masterlist-admin-status-pill ${getStatusClassName(statusText)}`}>
                                {statusText}
                              </span>
                            </td>
                            <td className="masterlist-admin-actions-cell">
                              <div className="masterlist-admin-quick-actions" onClick={(e) => e.stopPropagation()}>
                                <button
                                  className="masterlist-admin-quick-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenQuickActionsId((previous) => previous === record.id ? null : record.id);
                                  }}
                                >
                                  Quick Actions ▾
                                </button>
                                {openQuickActionsId === record.id && (
                                  <div className="masterlist-admin-quick-menu">
                                    <button
                                      className="masterlist-admin-quick-item"
                                      onClick={async () => {
                                        setOpenQuickActionsId(null);
                                        await handlePrintSingleRecord(record);
                                      }}
                                      disabled={printingRecordIds.has(record.id)}
                                    >
                                      {printingRecordIds.has(record.id) ? "Preparing form..." : "Print RSBSA Form"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    }
                    {!loading && !error && filteredRecords.length === 0 && (
                      <tr>
                        <td colSpan={7} className="masterlist-admin-empty-cell">No farmers found for the selected filters.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {!loading && !error && filteredRecords.length > recordsPerPage && (
                <div className="masterlist-admin-pagination">
                  <button
                    className="masterlist-admin-pagination-btn"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </button>
                  <span className="masterlist-admin-pagination-info">
                    Page {currentPage} of {Math.ceil(filteredRecords.length / recordsPerPage)}
                  </span>
                  <button
                    className="masterlist-admin-pagination-btn"
                    onClick={() => setCurrentPage((p) => Math.min(Math.ceil(filteredRecords.length / recordsPerPage), p + 1))}
                    disabled={currentPage >= Math.ceil(filteredRecords.length / recordsPerPage)}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showModal && selectedFarmer && (
        <div className="farmer-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="farmer-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="farmer-modal-header">
              <div className="farmer-modal-header-left">
                <h2>Farmer Details</h2>
              </div>
              <div className="farmer-modal-header-actions">
                <button className="farmer-modal-print-btn" onClick={handleModalPrint} disabled={isModalPrinting}>
                  {isModalPrinting ? "Preparing..." : "Print RSBSA Form"}
                </button>
                <button className="farmer-modal-close-btn" onClick={() => setShowModal(false)}>×</button>
              </div>
            </div>
            <div className="farmer-modal-body">
              {loadingFarmerDetail ? (
                <div className="farmer-modal-loading">Loading farmer details...</div>
              ) : (
                <>
                  <div className="farmer-modal-section">
                    <h3 className="farmer-modal-section-title">👤 Personal Information</h3>
                    <div className="farmer-modal-info-grid">
                      <div className="farmer-modal-info-item">
                        <span className="farmer-modal-label">Farmer Name:</span>
                        <span className="farmer-modal-value">{selectedFarmer.farmerName}</span>
                      </div>
                      <div className="farmer-modal-info-item">
                        <span className="farmer-modal-label">Farmer Address:</span>
                        <span className="farmer-modal-value">{selectedFarmer.farmerAddress}</span>
                      </div>
                      <div className="farmer-modal-info-item">
                        <span className="farmer-modal-label">Age:</span>
                        <span className="farmer-modal-value">{selectedFarmer.age}</span>
                      </div>
                      <div className="farmer-modal-info-item">
                        <span className="farmer-modal-label">Gender:</span>
                        <span className="farmer-modal-value">{selectedFarmer.gender}</span>
                      </div>
                      <div className="farmer-modal-info-item farmer-modal-full-width">
                        <span className="farmer-modal-label">Main Livelihood:</span>
                        <span className="farmer-modal-value">
                          {selectedFarmer.farmingActivities.length > 0 ? selectedFarmer.farmingActivities.join(", ") : "Not Available"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="farmer-modal-section">
                    <h3 className="farmer-modal-section-title">🚜 Farm Information</h3>
                    {selectedFarmer.parcels.length === 0 ? (
                      <p className="farmer-modal-no-data">No parcels found</p>
                    ) : (
                      <div className="farmer-modal-parcels-container">
                        {selectedFarmer.parcels.map((parcel, index) => (
                          <div key={parcel.id} className="farmer-modal-parcel-card">
                            <div className="farmer-modal-parcel-header">
                              <h4>
                                Parcel #
                                {(() => {
                                  const pNum = parcel.parcelNumber;
                                  if (!pNum || pNum === "N/A") return index + 1;
                                  if (/^\d+$/.test(pNum)) return pNum;
                                  return index + 1;
                                })()}
                              </h4>
                            </div>
                            <div className="farmer-modal-parcel-details">
                              <div className="farmer-modal-parcel-item">
                                <span className="farmer-modal-label">Land Ownership:</span>
                                <span className="farmer-modal-value">{getParcelOwnershipLabel(parcel)}</span>
                              </div>
                              <div className="farmer-modal-parcel-item">
                                <span className="farmer-modal-label">Parcel Location:</span>
                                <span className="farmer-modal-value">{parcel.farmLocationBarangay}, {parcel.farmLocationMunicipality}</span>
                              </div>
                              <div className="farmer-modal-parcel-item">
                                <span className="farmer-modal-label">Parcel Size:</span>
                                <span className="farmer-modal-value">
                                  {typeof parcel.totalFarmAreaHa === "number" ? parcel.totalFarmAreaHa.toFixed(2) : parseFloat(String(parcel.totalFarmAreaHa || 0)).toFixed(2)} hectares
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Masterlist;
