import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  getRsbsaSubmissions,
  getRsbsaSubmissionById,
  getFarmParcelsWithOccupants,
  getTechDashboardData,
} from "../../api";
import { printGeometryStatusReport } from "../../utils/rsbsaPrint";
import "../../assets/css/technician css/TechRsbsaStyle.css";
import "../../assets/css/jo css/FarmerDetailModal.css";
import "../../components/layout/sidebarStyle.css";
import { supabase } from "../../supabase";
import TechSidebar from "../../components/layout/TechSidebar";
import {
  FarmerProfileDisplay,
  FarmerProfileData,
  UnifiedParcel,
} from "../../components/FarmerProfile/FarmerProfileDisplay";

interface RSBSARecord {
  id: string;
  referenceNumber: string;
  farmerName: string;
  firstName: string;
  middleName: string;
  lastName: string;
  extName: string;
  farmerAddress: string;
  farmLocation: string;
  gender: string;
  birthdate?: string;
  age?: number | string | null;
  dateSubmitted: string;
  status: string;
  landParcel: string;
  parcelArea?: string;
  parcelCount?: number;
  /** true = has current parcels, false = all transferred/no land, undefined = no parcels registered */
  hasCurrentParcels?: boolean;
  ownershipType: {
    registeredOwner: boolean;
    tenant: boolean;
    lessee: boolean;
  };
}

interface UnplottedFarmerItem {
  id: string;
  farmerName: string;
  referenceNumber: string;
  barangay: string;
  totalParcels: number;
  plottedParcels: number;
  unplottedParcels: number;
}

const TechRsbsa: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [registeredOwners, setRegisteredOwners] = useState<RSBSARecord[]>([]);
  const [filteredOwners, setFilteredOwners] = useState<RSBSARecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState<string>("all");
  const [landStatusFilter, setLandStatusFilter] = useState<
    "all" | "active" | "no_land"
  >("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isActive = (path: string) => location.pathname === path;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [selectedFarmer, setSelectedFarmer] =
    useState<FarmerProfileData | null>(null);
  const [loadingFarmerDetail, setLoadingFarmerDetail] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [unplottedFarmers, setUnplottedFarmers] = useState<
    UnplottedFarmerItem[]
  >([]);
  const [showUnplottedOnly, setShowUnplottedOnly] = useState<boolean>(() => {
    const params = new URLSearchParams(location.search);
    return params.get("unplotted") === "1";
  });
  const [currentUser, setCurrentUser] = useState<{
    firstName: string;
    lastName: string;
  } | null>(null);
  const [isPrintingGeometry, setIsPrintingGeometry] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [showPrintGeometryModal, setShowPrintGeometryModal] = useState(false);

  const unplottedFarmerIdSet = React.useMemo(
    () => new Set(unplottedFarmers.map((farmer) => String(farmer.id))),
    [unplottedFarmers],
  );

  const unplottedProgressMap = React.useMemo(() => {
    const map = new Map<string, UnplottedFarmerItem>();
    unplottedFarmers.forEach((farmer) => {
      map.set(String(farmer.id), farmer);
    });
    return map;
  }, [unplottedFarmers]);

  const toggleMenu = (
    id: string,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    if (openMenuId === id) {
      setOpenMenuId(null);
      setMenuPosition(null);
    } else {
      const rect = event.currentTarget.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.right + window.scrollX - 160, // 160px is min-width of menu
      });
      setOpenMenuId(id);
    }
  };

  const closeMenu = () => {
    setOpenMenuId(null);
    setMenuPosition(null);
  };

  // Fetch farmer details when row is clicked
  const fetchFarmerDetails = async (
    farmerId: string,
    summaryRecord?: RSBSARecord,
  ) => {
    try {
      setLoadingFarmerDetail(true);

      // Fetch basic farmer info
      const farmerResponse = await getRsbsaSubmissionById(farmerId);
      if (farmerResponse.error)
        throw new Error("Failed to fetch farmer details");
      const farmerData = farmerResponse.data;

      // Fetch parcels with occupants
      const parcelsResponse = await getFarmParcelsWithOccupants(farmerId, {
        activeOnly: true,
      });
      if (parcelsResponse.error) throw new Error("Failed to fetch parcels");
      const parcelsData = parcelsResponse.data || [];

      // Handle both JSONB (data property) and structured column formats
      const data = farmerData.data || farmerData;

      // Parse farming activities from the data
      const activities: string[] = [];

      // Check for farming activities in various possible field names
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

      // If no activities found, check if main Livelihood indicates farming type
      if (activities.length === 0 && data.mainLivelihood) {
        activities.push(data.mainLivelihood);
      }

      const calculateAge = (birthdate: string): number | string => {
        if (!birthdate || birthdate === "N/A") return "N/A";
        const today = new Date();
        const birthDate = new Date(birthdate);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (
          monthDiff < 0 ||
          (monthDiff === 0 && today.getDate() < birthDate.getDate())
        ) {
          age--;
        }
        return age;
      };

      // Reformat the farmer name from "Last, First, Middle, Ext" to "Last, First Middle Ext"
      const backendName = farmerData.farmerName || "";
      const reformattedFarmerName = (() => {
        if (!backendName || backendName === "N/A") return "N/A";
        const parts = backendName
          .split(",")
          .map((p: string) => p.trim())
          .filter(Boolean);
        if (parts.length === 0) return "N/A";
        if (parts.length === 1) return parts[0];
        const lastName = parts[0];
        const restOfName = parts.slice(1).join(" ");
        return `${lastName}, ${restOfName}`;
      })();

      const getValue = (...values: any[]): string => {
        for (const value of values) {
          if (value === null || value === undefined) continue;
          const text = String(value).trim();
          if (text) return text;
        }
        return "N/A";
      };

      const selectedRecord =
        summaryRecord ||
        registeredOwners.find((rec) => String(rec.id) === String(farmerId));

      let mappedParcels: UnifiedParcel[] = parcelsData.map((p: any) => ({
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
        tenantLandOwnerId: p.tenant_land_owner_id
          ? String(p.tenant_land_owner_id)
          : null,
        lesseeLandOwnerId: p.lessee_land_owner_id
          ? String(p.lessee_land_owner_id)
          : null,
        withinAncestralDomain: p.within_ancestral_domain || "",
        ownershipDocumentNo: p.ownership_document_no || "",
        agrarianReformBeneficiary: p.agrarian_reform_beneficiary || "",
        ownershipOthersSpecify: p.ownership_others_specify || "",
        contractEndDate: p.contract_end_date || p.contractEndDate || null,
        isFarming: typeof p.is_farming === "boolean" ? p.is_farming : null,
        farmingStatusReason: p.farming_status_reason || null,
        farmingStatusUpdatedAt: p.farming_status_updated_at || null,
        role: p.role || "",
        occupants: p.occupants || [],
      }));

      if (mappedParcels.length === 0) {
        const submissionFarmLocation =
          data.farmLocation || data["FARM LOCATION"] || "";
        const submissionParcelArea = parseFloat(
          data.totalFarmArea || data["TOTAL FARM AREA"] || "0",
        );
        const submissionOwnership = data.ownershipType || {};
        if (submissionFarmLocation || submissionParcelArea > 0) {
          const parts = submissionFarmLocation
            .split(",")
            .map((s: string) => s.trim());
          mappedParcels = [
            {
              id: `submission-${farmerId}`,
              parcelNumber: "N/A",
              farmLocationBarangay: parts[0] || data.barangay || "N/A",
              farmLocationMunicipality: parts[1] || "Dumangas",
              totalFarmAreaHa: submissionParcelArea,
              role: submissionOwnership.registeredOwner
                ? "land-owner"
                : "owner-farmed",
              occupants: [],
              withinAncestralDomain: "",
              ownershipDocumentNo: "",
              agrarianReformBeneficiary: "",
              isFarming: null,
            },
          ];
        }
      }

      // Fetch matching land_plots geometries for map preview & area mismatch warning
      try {
        const parcelNumbers = mappedParcels
          .map((p) => p.parcelNumber)
          .filter((n) => n && n !== "N/A");

        let plotsQuery = supabase
          .from("land_plots")
          .select("id, parcel_number, area, geometry, farmer_id");

        if (parcelNumbers.length > 0) {
          plotsQuery = plotsQuery.or(
            `farmer_id.eq.${Number(farmerId)},parcel_number.in.(${parcelNumbers.map((n) => `"${n}"`).join(",")})`,
          );
        } else {
          plotsQuery = plotsQuery.eq("farmer_id", Number(farmerId));
        }

        const { data: plots } = await plotsQuery;

        if (plots && plots.length > 0) {
          console.log(
            `[TechRsbsa] Found ${plots.length} land_plots for farmer ${farmerId} (parcels: ${parcelNumbers.join(", ")}):`,
            plots.map((pl: any) => ({
              id: pl.id,
              parcel_number: pl.parcel_number,
              hasGeometry: !!pl.geometry,
            })),
          );
          mappedParcels = mappedParcels.map((p) => {
            // Match by parcel_number (case insensitive, trimmed)
            const plot = plots.find(
              (plotItem: any) =>
                plotItem.parcel_number &&
                p.parcelNumber &&
                plotItem.parcel_number.trim().toLowerCase() ===
                  p.parcelNumber.trim().toLowerCase(),
            );
            // If only one plot and one parcel, auto-match fallback
            const resolvedPlot =
              plot ||
              (plots.length === 1 && mappedParcels.length === 1
                ? plots[0]
                : null);
            if (resolvedPlot && resolvedPlot.geometry) {
              return {
                ...p,
                geometry: resolvedPlot.geometry,
              };
            }
            return p;
          });
        } else {
          console.log(
            `[TechRsbsa] No land_plots found for farmer ${farmerId} and parcels ${parcelNumbers.join(", ")}`,
          );
        }
      } catch (geomErr) {
        console.warn(
          "Could not fetch parcel geometries for TechRsbsa:",
          geomErr,
        );
      }

      const parsedSubmissionDate = selectedRecord
        ? getSubmissionDate(selectedRecord)
        : null;

      const submittedDateLabel = parsedSubmissionDate
        ? parsedSubmissionDate.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : getValue(
            farmerData.dateSubmitted,
            (farmerData as any).date_submitted,
            (farmerData as any).submitted_at,
            (farmerData as any).created_at,
          );

      const farmerDetail: FarmerProfileData = {
        id: farmerId,
        referenceNumber: getValue(
          selectedRecord?.referenceNumber,
          farmerData.referenceNumber,
          data.referenceNumber,
          data.ffrsId,
          data.ffrs_id,
        ),
        dateSubmitted: submittedDateLabel,
        recordStatus: getValue(
          selectedRecord?.status,
          farmerData.status,
          data.status,
        ),
        name: reformattedFarmerName,
        address: getValue(
          farmerData.farmerAddress,
          selectedRecord?.farmerAddress,
        ),
        age: calculateAge(data.dateOfBirth || data.birthdate || "N/A"),
        gender: getValue(data.gender, farmerData.gender),
        mainLivelihood: getValue(
          data.mainLivelihood,
          farmerData.mainLivelihood,
        ),
        farmingActivities: activities,
        parcels: mappedParcels,
        birthdate: data.dateOfBirth || data.birthdate || null,
        archivedAt: farmerData.archived_at || null,
        archiveReason: farmerData.archive_reason || null,
        statusChangeReason: farmerData.status_change_reason || null,
      };

      setSelectedFarmer(farmerDetail);
      setShowModal(true);
    } catch (err: any) {
      console.error("Error fetching farmer details:", err);
      alert("Failed to load farmer details");
    } finally {
      setLoadingFarmerDetail(false);
    }
  };

  // Fetch RSBSA records from Supabase
  const fetchRSBSARecords = async () => {
    try {
      setLoading(true);
      const [response, techDashboardResponse] = await Promise.all([
        getRsbsaSubmissions(),
        getTechDashboardData(),
      ]);

      if (response.error) {
        console.error("Error fetching RSBSA records:", response.error);
        setError("Failed to load registered land owners data");
        return;
      }

      const data = response.data || [];

      console.log(
        "Received RSBSA data from Supabase:",
        data?.length || 0,
        "records",
      );
      console.log("Sample record:", data?.[0]);

      // Automatically filter for registered owners only
      const registeredOwnersData = filterRegisteredOwners(data || []);
      setRegisteredOwners(registeredOwnersData);

      const ownerIds = new Set(
        registeredOwnersData.map((owner) => String(owner.id)),
      );

      if (!techDashboardResponse.error) {
        const queue = Array.isArray(
          techDashboardResponse.data?.unplottedFarmers,
        )
          ? techDashboardResponse.data.unplottedFarmers
          : [];
        // Filter the unplotted queue to keep only registered landowners
        const ownerQueue = queue.filter((item: any) =>
          ownerIds.has(String(item.id)),
        );
        setUnplottedFarmers(
          ownerQueue.map((item: any) => ({
            id: String(item.id),
            farmerName: String(item.farmerName || "N/A"),
            referenceNumber: String(item.referenceNumber || "N/A"),
            barangay: String(item.barangay || "N/A"),
            totalParcels: Number(item.totalParcels || 0),
            plottedParcels: Number(item.plottedParcels || 0),
            unplottedParcels: Number(item.unplottedParcels || 0),
          })),
        );
      } else {
        setUnplottedFarmers([]);
      }

      setError(null);
    } catch (err: any) {
      console.error("Error fetching RSBSA records:", err);
      setError("Failed to load registered land owners data");
      setUnplottedFarmers([]);
    } finally {
      setLoading(false);
    }
  };

  // Function to filter registered owners only (includes no-land owners so they can be shown with a warning)
  const filterRegisteredOwners = (records: RSBSARecord[]) => {
    console.log("Filtering records:", records.length);

    const filtered = records.filter((record: any) => {
      // Check if the record represents a registered owner
      if (record.ownershipType) {
        return record.ownershipType.registeredOwner === true;
      }

      return false;
    });

    console.log("Filtered results:", filtered.length, "out of", records.length);
    return filtered;
  };

  // Get unique barangays from registered owners
  const uniqueBarangays = React.useMemo(() => {
    const barangays = new Set<string>();
    registeredOwners.forEach((record) => {
      if (record.farmerAddress) {
        // Extract barangay (first part before comma)
        const barangay = record.farmerAddress.split(",")[0]?.trim();
        if (barangay) barangays.add(barangay);
      }
    });
    return Array.from(barangays).sort();
  }, [registeredOwners]);

  const getSubmissionDate = (record: RSBSARecord): Date | null => {
    const candidates = [
      record.dateSubmitted,
      (record as any).date_submitted,
      (record as any).submitted_at,
      (record as any).created_at,
      (record as any).createdAt,
    ];

    for (const rawValue of candidates) {
      if (!rawValue) continue;
      const parsedDate = new Date(rawValue);
      if (!Number.isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    }

    return null;
  };

  const sortedFilteredOwners = React.useMemo(() => {
    return [...filteredOwners].sort((a, b) => {
      const dateA = getSubmissionDate(a);
      const dateB = getSubmissionDate(b);

      // Keep records with missing dates at the bottom.
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;

      // Newest first.
      return dateB.getTime() - dateA.getTime();
    });
  }, [filteredOwners]);

  // Filter records based on search term, barangay, and land status
  useEffect(() => {
    const filtered = registeredOwners.filter((record) => {
      const isUnplotted = unplottedFarmerIdSet.has(String(record.id));

      if (showUnplottedOnly && !isUnplotted) {
        return false;
      }

      // Land status filter
      if (landStatusFilter === "active" && record.hasCurrentParcels !== true) {
        return false;
      }
      if (
        landStatusFilter === "no_land" &&
        record.hasCurrentParcels !== false
      ) {
        return false;
      }

      // Barangay filter
      if (selectedBarangay !== "all") {
        const barangay = record.farmerAddress?.split(",")[0]?.trim();
        if (barangay !== selectedBarangay) return false;
      }

      // Search term filter
      if (searchTerm.trim()) {
        const searchLower = searchTerm.toLowerCase();
        // Search in FFRS ID (both with and without dashes)
        const ffrsMatch =
          record.referenceNumber?.toLowerCase().includes(searchLower) ||
          record.referenceNumber
            ?.replace(/-/g, "")
            .toLowerCase()
            .includes(searchLower);

        // Search in farmer name
        const nameMatch = record.farmerName
          ?.toLowerCase()
          .includes(searchLower);

        // Search in farmer address
        const addressMatch = record.farmerAddress
          ?.toLowerCase()
          .includes(searchLower);

        // Search in farm location
        const locationMatch = record.farmLocation
          ?.toLowerCase()
          .includes(searchLower);

        // Search in gender
        const genderMatch = record.gender?.toLowerCase().includes(searchLower);

        if (
          !(
            ffrsMatch ||
            nameMatch ||
            addressMatch ||
            locationMatch ||
            genderMatch
          )
        ) {
          return false;
        }
      }

      return true;
    });

    setFilteredOwners(filtered);
  }, [
    searchTerm,
    selectedBarangay,
    registeredOwners,
    showUnplottedOnly,
    unplottedFarmerIdSet,
    landStatusFilter,
  ]);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const firstName = user.user_metadata?.first_name || "";
        const lastName = user.user_metadata?.last_name || "";
        setCurrentUser({ firstName, lastName });
      }
    };
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setShowUnplottedOnly(params.get("unplotted") === "1");
  }, [location.search]);

  // Load data on component mount
  useEffect(() => {
    fetchRSBSARecords();
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        openMenuId &&
        !(event.target as Element).closest(".tech-rsbsa-more-button") &&
        !(event.target as Element).closest(".tech-rsbsa-actions-menu")
      ) {
        closeMenu();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openMenuId]);

  const calculateAgeFromBirthdate = (birthdate?: string): number | null => {
    if (!birthdate) return null;
    const birthDate = new Date(birthdate);
    if (Number.isNaN(birthDate.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age >= 0 ? age : null;
  };

  const getDisplayAge = (record: RSBSARecord): string => {
    if (
      record.age !== undefined &&
      record.age !== null &&
      String(record.age).trim() !== ""
    ) {
      return String(record.age);
    }

    const computedAge = calculateAgeFromBirthdate(record.birthdate);
    return computedAge !== null ? String(computedAge) : "N/A";
  };

  const getPlottingRatio = (record: RSBSARecord): string => {
    const progress = unplottedProgressMap.get(String(record.id));
    if (progress) {
      const total = Math.max(0, Number(progress.totalParcels || 0));
      const plotted = Math.min(
        total,
        Math.max(0, Number(progress.plottedParcels || 0)),
      );
      return total > 0 ? `${plotted}/${total}` : "0/0";
    }

    const parsedParcelCount = Number(record.parcelCount || 0);
    const totalFromRecord = Number.isFinite(parsedParcelCount)
      ? Math.max(0, parsedParcelCount)
      : 0;

    if (totalFromRecord > 0) {
      return `${totalFromRecord}/${totalFromRecord}`;
    }

    return "1/1";
  };

  const totalRegisteredCount = registeredOwners.length;
  const activeLandownersCount = registeredOwners.filter(
    (r) => r.hasCurrentParcels !== false,
  ).length;
  const noActiveLandCount = registeredOwners.filter(
    (r) => r.hasCurrentParcels === false,
  ).length;

  const allFilteredSelected =
    sortedFilteredOwners.length > 0 &&
    sortedFilteredOwners.every((r) => selectedRecordIds.has(r.id));

  const toggleSelectAllFiltered = () => {
    setSelectedRecordIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        sortedFilteredOwners.forEach((r) => next.delete(r.id));
      } else {
        sortedFilteredOwners.forEach((r) => next.add(r.id));
      }
      return next;
    });
  };

  const toggleSelectRecord = (id: string) => {
    setSelectedRecordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handlePrintGeometryStatus = async (scope: "all" | "selected") => {
    const filterParts: string[] = [];
    if (selectedBarangay !== "all")
      filterParts.push(`Barangay: ${selectedBarangay}`);
    if (landStatusFilter === "active")
      filterParts.push("Land Status: Active (Has Land)");
    else if (landStatusFilter === "no_land")
      filterParts.push("Land Status: No Land");
    if (searchTerm.trim()) filterParts.push(`Search: "${searchTerm.trim()}"`);

    const recordsToPrint = scope === "selected"
      ? sortedFilteredOwners.filter(r => selectedRecordIds.has(r.id))
      : sortedFilteredOwners;

    // Geometry status is only meaningful for owners with active land — a
    // "No Land" owner has nothing to plot, so they're excluded here rather
    // than showing up as a confusing 0/0.
    const rows = recordsToPrint
      .filter((record) => record.hasCurrentParcels !== false)
      .map((record) => {
        const progress = unplottedProgressMap.get(String(record.id));
        const total = progress
          ? Math.max(0, Number(progress.totalParcels || 0))
          : Math.max(0, Number(record.parcelCount || 0)) || 1;
         const plotted = progress
           ? Math.min(total, Math.max(0, Number(progress.plottedParcels || 0)))
           : total;

        return {
          id: record.id,
          farmerName: record.farmerName || "N/A",
          referenceNumber: record.referenceNumber || "N/A",
          barangay: record.farmerAddress?.split(",")[0]?.trim() || "N/A",
          totalParcels: total,
          plottedParcels: plotted,
        };
      });

    setIsPrintingGeometry(true);
    const printedBy = currentUser
      ? `${currentUser.firstName} ${currentUser.lastName}`.trim()
      : "Technician";
    const result = await printGeometryStatusReport({
      rows,
      filterLabel:
        filterParts.length > 0
          ? filterParts.join(" · ")
          : scope === "selected"
            ? `Selected Owners (${recordsToPrint.length})`
            : "All Registered Owners",
      printedBy,
    });
    setIsPrintingGeometry(false);

    if (!result.success && !result.cancelled) {
      alert(result.error || "Failed to print geometry status report.");
    }
  };

  return (
    <div className="tech-rsbsa-page-container">
      <div className="tech-rsbsa-page">
        <TechSidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        {/* Main content starts here */}
        <div className="tech-rsbsa-main-content">
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
            <div className="tech-incent-mobile-title">RSBSA</div>
          </div>
          <div className="tech-rsbsa-dashboard-header">
            <div>
              <h2 className="tech-rsbsa-page-title">RSBSA</h2>
              <p className="tech-rsbsa-page-subtitle">
                View and manage farmers from RSBSA submissions
              </p>
            </div>
          </div>

          <div className="tech-rsbsa-kpi-grid">
            <div className="tech-rsbsa-kpi-card">
              <span className="tech-rsbsa-kpi-label">👥 Total Registered</span>
              <span className="tech-rsbsa-kpi-value">
                {totalRegisteredCount}
              </span>
            </div>
            <div className="tech-rsbsa-kpi-card">
              <span className="tech-rsbsa-kpi-label">✅ Active Landowners</span>
              <span className="tech-rsbsa-kpi-value">
                {activeLandownersCount}
              </span>
            </div>
            <div className="tech-rsbsa-kpi-card">
              <span className="tech-rsbsa-kpi-label">⚠️ No Active Land</span>
              <span className="tech-rsbsa-kpi-value">{noActiveLandCount}</span>
            </div>
          </div>

          <div className="tech-rsbsa-content-card">
            {loading ? (
              <div className="tech-rsbsa-loading-container">
                <p>Loading registered land owners...</p>
              </div>
            ) : error ? (
              <div className="tech-rsbsa-error-container">
                <p>Error: {error}</p>
                <button
                  onClick={fetchRSBSARecords}
                  className="tech-rsbsa-retry-button"
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                <div
                  className={`tech-rsbsa-unplotted-banner ${unplottedFarmers.length > 0 ? "has-items" : "all-clear"}`}
                >
                  <div className="tech-rsbsa-unplotted-banner-head">
                    {unplottedFarmers.length > 0 ? (
                      <>
                        <strong>{unplottedFarmers.length}</strong> parcel
                        {unplottedFarmers.length !== 1 ? "s" : ""} still need
                        plotting.
                      </>
                    ) : (
                      <>All farmers in queue are plotted.</>
                    )}
                  </div>
                </div>

                {/* Search and Filter Container */}
                <div className="jo-masterlist-filters-section">
                  <div className="jo-masterlist-filters-row-1">
                    <div className="jo-masterlist-search-filter">
                      <input
                        type="text"
                        className="jo-masterlist-search-input"
                        placeholder="Search by FFRS ID, Name, Address, Location, or Gender..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="jo-masterlist-filters-row-2">
                    <div className="jo-masterlist-status-filter">
                      <select
                        value={selectedBarangay}
                        onChange={(e) => setSelectedBarangay(e.target.value)}
                        className="jo-masterlist-status-select"
                      >
                        <option value="all">All Barangays</option>
                        {uniqueBarangays.map((barangay) => (
                          <option key={barangay} value={barangay}>
                            {barangay}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="jo-masterlist-status-filter">
                      <select
                        id="land-status-filter"
                        value={landStatusFilter}
                        onChange={(e) =>
                          setLandStatusFilter(
                            e.target.value as "all" | "active" | "no_land",
                          )
                        }
                        className="jo-masterlist-status-select"
                      >
                        <option value="all">All Land Status</option>
                        <option value="active">✅ Active (Has Land)</option>
                        <option value="no_land">⚠️ No Land</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* ── Bulk toolbar ─────────────────────────────────────────── */}
                {!loading && !error && (
                  <div className="jo-masterlist-bulk-toolbar" style={{ margin: "10px 0" }}>
                    {selectedRecordIds.size > 0 && (
                      <span className="jo-masterlist-bulk-count">
                        {selectedRecordIds.size} record
                        {selectedRecordIds.size === 1 ? "" : "s"} selected
                      </span>
                    )}
                    <div className="jo-masterlist-bulk-actions">
                      <div
                        className="jo-masterlist-bulk-export-wrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          className="jo-masterlist-bulk-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowPrintGeometryModal((p) => !p);
                          }}
                        >
                          🖨 Print Geometry Status
                        </button>
                        {showPrintGeometryModal && (
                          <div className="jo-masterlist-bulk-menu">
                            <div
                              style={{
                                padding: "6px 12px 4px",
                                fontSize: "11px",
                                color: "#888",
                                fontWeight: 600,
                                letterSpacing: "0.04em",
                                textTransform: "uppercase",
                                borderBottom: "0.5px solid #e0e0e0",
                                marginBottom: 2,
                              }}
                            >
                              Print scope
                            </div>
                            <button
                              className="jo-masterlist-quick-item"
                              onClick={() => {
                                setShowPrintGeometryModal(false);
                                handlePrintGeometryStatus("all");
                              }}
                            >
                              🗂 Print All ({sortedFilteredOwners.length})
                            </button>
                            <button
                              className="jo-masterlist-quick-item"
                              disabled={selectedRecordIds.size === 0}
                              style={{
                                opacity: selectedRecordIds.size === 0 ? 0.45 : 1,
                                cursor:
                                  selectedRecordIds.size === 0
                                    ? "not-allowed"
                                    : "pointer",
                              }}
                              onClick={() => {
                                if (selectedRecordIds.size === 0) return;
                                setShowPrintGeometryModal(false);
                                handlePrintGeometryStatus("selected");
                              }}
                            >
                              ✅ Print Selected Only
                              {selectedRecordIds.size > 0
                                ? ` (${selectedRecordIds.size})`
                                : " — pick rows first"}
                            </button>
                          </div>
                        )}
                      </div>

                      {selectedRecordIds.size > 0 && (
                        <button
                          className="jo-masterlist-bulk-btn jo-masterlist-bulk-btn-clear"
                          onClick={() => setSelectedRecordIds(new Set())}
                        >
                          Clear Selection
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="jo-masterlist-table-container">
                  <table className="jo-masterlist-farmers-table">
                    <colgroup>
                      <col style={{ width: "40px" }} /> {/* checkbox */}
                      <col style={{ width: "110px" }} /> {/* Last Name */}
                      <col style={{ width: "120px" }} /> {/* First Name */}
                      <col style={{ width: "100px" }} /> {/* Middle Name */}
                      <col style={{ width: "60px" }} /> {/* EXT Name */}
                      <col style={{ width: "70px" }} /> {/* Gender */}
                      <col style={{ width: "50px" }} /> {/* Age */}
                      <col style={{ width: "200px" }} /> {/* Farmer Address */}
                      <col style={{ width: "180px" }} /> {/* Farm Location */}
                      <col style={{ width: "100px" }} /> {/* Parcel Area */}
                      <col style={{ width: "85px" }} /> {/* Plotted */}
                      <col style={{ width: "110px" }} /> {/* Land Status */}
                      <col style={{ width: "80px" }} /> {/* Action */}
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="jo-masterlist-checkbox-col">
                          <input
                            type="checkbox"
                            className="jo-masterlist-header-checkbox"
                            checked={allFilteredSelected}
                            onChange={toggleSelectAllFiltered}
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Select all"
                          />
                        </th>
                        <th>Last Name</th>
                        <th>First Name</th>
                        <th>Middle Name</th>
                        <th>EXT Name</th>
                        <th>Gender</th>
                        <th>Age</th>
                        <th>Farmer Address</th>
                        <th>Farm Location</th>
                        <th>Parcel Area</th>
                        <th>Plotted</th>
                        <th>Land Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFilteredOwners.length === 0 ? (
                        <tr>
                          <td colSpan={13} className="tech-rsbsa-no-data">
                            {searchTerm
                              ? "No matching records found"
                              : "No registered owners found"}
                          </td>
                        </tr>
                      ) : (
                        sortedFilteredOwners.map((record) => {
                          const parcelArea = record.parcelArea
                            ? record.parcelArea.includes("hectares")
                              ? record.parcelArea
                              : `${record.parcelArea} hectares`
                            : "N/A";

                          const hasNoLand = record.hasCurrentParcels === false;

                          return (
                            <tr
                              key={record.id}
                              onClick={() =>
                                fetchFarmerDetails(record.id, record)
                              }
                              style={{ cursor: "pointer" }}
                              className={`jo-masterlist-table-row ${hasNoLand ? "tech-rsbsa-row-no-land" : ""}`}
                            >
                              <td className="jo-masterlist-checkbox-col">
                                <input
                                  type="checkbox"
                                  className="jo-masterlist-row-checkbox"
                                  checked={selectedRecordIds.has(record.id)}
                                  onChange={() => toggleSelectRecord(record.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label={`Select ${record.farmerName}`}
                                />
                              </td>
                              <td data-label="Last Name">{record.lastName || ""}</td>
                              <td data-label="First Name">{record.firstName || ""}</td>
                              <td data-label="Middle Name">{record.middleName || ""}</td>
                              <td data-label="EXT Name">{record.extName || ""}</td>
                              <td data-label="Gender">{record.gender || "N/A"}</td>
                              <td data-label="Age">{getDisplayAge(record)}</td>
                              <td data-label="Farmer Address">{record.farmerAddress || "N/A"}</td>
                              <td data-label="Farm Location">{record.farmLocation || "N/A"}</td>
                              <td data-label="Parcel Area">{parcelArea}</td>
                              <td data-label="Plotted">
                                <span className="tech-rsbsa-plot-status-pill">
                                  {getPlottingRatio(record)}
                                </span>
                              </td>
                              <td data-label="Land Status">
                                {hasNoLand ? (
                                  <span className="tech-rsbsa-no-land-badge">
                                    ⚠️ No Land
                                  </span>
                                ) : (
                                  <span className="tech-rsbsa-active-badge">
                                    ✅ Active
                                  </span>
                                )}
                              </td>
                              <td onClick={(e) => e.stopPropagation()}>
                                <div
                                  style={{
                                    position: "relative",
                                    display: "inline-block",
                                  }}
                                >
                                  <button
                                    className="tech-rsbsa-more-button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleMenu(record.id, e);
                                    }}
                                    aria-haspopup="true"
                                    aria-expanded={openMenuId === record.id}
                                    title="More actions"
                                  >
                                    ...
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
        {/* Action Menu - rendered outside table */}
        {openMenuId && menuPosition && (
          <div
            className="tech-rsbsa-actions-menu"
            style={{
              position: "fixed",
              top: menuPosition.top,
              left: menuPosition.left,
            }}
          >
            <button
              onClick={() => {
                navigate(`/technician-pick-land-parcel/${openMenuId}`);
                closeMenu();
              }}
            >
              Land Parcel
            </button>
          </div>
        )}

        {/* Farmer Detail Modal */}
        {showModal && selectedFarmer && (
          <div
            className="farmer-modal-overlay"
            onClick={() => setShowModal(false)}
          >
            <div
              className="farmer-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              {loadingFarmerDetail ? (
                <div className="farmer-modal-loading">
                  Loading farmer details...
                </div>
              ) : (
                <FarmerProfileDisplay
                  farmer={selectedFarmer}
                  showAreaMismatchWarning={true}
                  onClose={() => setShowModal(false)}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TechRsbsa;
