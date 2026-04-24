import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  getAllocations,
  getFarmerRequests,
  updateFarmerRequest,
  deleteFarmerRequest,
  createDistributionRecord,
} from "../../api";
import {
  suggestAlternatives,
  calculateRemainingStock,
} from "../../services/alternativeEngine";
import "../../assets/css/technician css/TechManageRequestsStyle.css";
import "../../components/layout/sidebarStyle.css";
import LogoImage from "../../assets/images/Logo.png";
import HomeIcon from "../../assets/images/home.png";
import RSBSAIcon from "../../assets/images/rsbsa.png";
import ApproveIcon from "../../assets/images/approve.png";
import LogoutIcon from "../../assets/images/logout.png";
import IncentivesIcon from "../../assets/images/incentives.png";

interface FarmerRequest {
  id: number;
  season: string;
  request_date: string;
  farmer_id: number;
  farmer_name: string;
  barangay: string;
  farm_area_ha: number;
  requested_urea_bags: number;
  requested_complete_14_bags: number;
  requested_ammonium_sulfate_bags: number;
  requested_muriate_potash_bags: number;
  requested_complete_16_bags?: number;
  requested_ammonium_phosphate_bags?: number;
  requested_zinc_sulfate_bags?: number;
  requested_vermicompost_bags?: number;
  requested_chicken_manure_bags?: number;
  requested_rice_straw_kg?: number;
  requested_carbonized_rice_hull_bags?: number;
  requested_biofertilizer_liters?: number;
  requested_nanobiofertilizer_liters?: number;
  requested_organic_root_exudate_mix_liters?: number;
  requested_azolla_microphylla_kg?: number;
  requested_foliar_liquid_fertilizer_npk_liters?: number;
  requested_rice_seeds_nsic_rc160_kg?: number;
  requested_rice_seeds_nsic_rc222_kg?: number;
  requested_jackpot_kg: number;
  requested_us88_kg: number;
  requested_th82_kg: number;
  requested_rh9000_kg: number;
  requested_lumping143_kg: number;
  requested_lp296_kg: number;
  requested_mestiso_1_kg?: number;
  requested_mestiso_20_kg?: number;
  requested_mestiso_29_kg?: number;
  requested_mestiso_55_kg?: number;
  requested_mestiso_73_kg?: number;
  requested_mestiso_99_kg?: number;
  requested_mestiso_103_kg?: number;
  requested_nsic_rc402_kg?: number;
  requested_nsic_rc480_kg?: number;
  requested_nsic_rc216_kg?: number;
  requested_nsic_rc218_kg?: number;
  requested_nsic_rc506_kg?: number;
  requested_nsic_rc508_kg?: number;
  requested_nsic_rc512_kg?: number;
  requested_nsic_rc534_kg?: number;
  requested_tubigan_28_kg?: number;
  requested_tubigan_30_kg?: number;
  requested_tubigan_22_kg?: number;
  requested_sahod_ulan_2_kg?: number;
  requested_sahod_ulan_10_kg?: number;
  requested_salinas_6_kg?: number;
  requested_salinas_7_kg?: number;
  requested_salinas_8_kg?: number;
  requested_malagkit_5_kg?: number;
  status: string;
  notes?: string;
  request_notes: string;
  created_at: string;
}

interface AllocationDetails {
  id: number;
  season: string;
  allocation_date: string;
  urea_46_0_0_bags: number;
  complete_14_14_14_bags: number;
  ammonium_sulfate_21_0_0_bags: number;
  np_16_20_0_bags?: number;
  muriate_potash_0_0_60_bags: number;
  zinc_sulfate_bags?: number;
  vermicompost_bags?: number;
  chicken_manure_bags?: number;
  rice_straw_kg?: number;
  carbonized_rice_hull_bags?: number;
  biofertilizer_liters?: number;
  nanobiofertilizer_liters?: number;
  organic_root_exudate_mix_liters?: number;
  azolla_microphylla_kg?: number;
  foliar_liquid_fertilizer_npk_liters?: number;
  rice_seeds_nsic_rc160_kg?: number;
  rice_seeds_nsic_rc222_kg?: number;
  jackpot_kg: number;
  us88_kg: number;
  th82_kg: number;
  rh9000_kg: number;
  lumping143_kg: number;
  lp296_kg: number;
  mestiso_1_kg?: number;
  mestiso_20_kg?: number;
  mestiso_29_kg?: number;
  mestiso_55_kg?: number;
  mestiso_73_kg?: number;
  mestiso_99_kg?: number;
  mestiso_103_kg?: number;
  nsic_rc402_kg?: number;
  nsic_rc480_kg?: number;
  nsic_rc216_kg?: number;
  nsic_rc218_kg?: number;
  nsic_rc506_kg?: number;
  nsic_rc508_kg?: number;
  nsic_rc512_kg?: number;
  nsic_rc534_kg?: number;
  tubigan_28_kg?: number;
  tubigan_30_kg?: number;
  tubigan_22_kg?: number;
  sahod_ulan_2_kg?: number;
  sahod_ulan_10_kg?: number;
  salinas_6_kg?: number;
  salinas_7_kg?: number;
  salinas_8_kg?: number;
  malagkit_5_kg?: number;
}

type RequestField = Extract<keyof FarmerRequest, `requested_${string}`>;

type AllocationItem = {
  label: string;
  allocationField: keyof AllocationDetails;
  requestField: RequestField;
};

type PrintScope = "filtered" | "all";

const EDIT_FERTILIZER_ITEMS: AllocationItem[] = [
  {
    label: "Urea (46-0-0)",
    allocationField: "urea_46_0_0_bags",
    requestField: "requested_urea_bags",
  },
  {
    label: "Complete (14-14-14)",
    allocationField: "complete_14_14_14_bags",
    requestField: "requested_complete_14_bags",
  },
  {
    label: "16-20-0",
    allocationField: "np_16_20_0_bags",
    requestField: "requested_ammonium_phosphate_bags",
  },
  {
    label: "Ammonium Sulfate (21-0-0)",
    allocationField: "ammonium_sulfate_21_0_0_bags",
    requestField: "requested_ammonium_sulfate_bags",
  },
  {
    label: "Muriate of Potash (0-0-60)",
    allocationField: "muriate_potash_0_0_60_bags",
    requestField: "requested_muriate_potash_bags",
  },
  {
    label: "Zinc Sulfate",
    allocationField: "zinc_sulfate_bags",
    requestField: "requested_zinc_sulfate_bags",
  },
  {
    label: "Vermicompost",
    allocationField: "vermicompost_bags",
    requestField: "requested_vermicompost_bags",
  },
  {
    label: "Chicken Manure",
    allocationField: "chicken_manure_bags",
    requestField: "requested_chicken_manure_bags",
  },
  {
    label: "Rice Straw (incorporated)",
    allocationField: "rice_straw_kg",
    requestField: "requested_rice_straw_kg",
  },
  {
    label: "Carbonized Rice Hull (CRH)",
    allocationField: "carbonized_rice_hull_bags",
    requestField: "requested_carbonized_rice_hull_bags",
  },
  {
    label: "Biofertilizer (Liquid Concentrate)",
    allocationField: "biofertilizer_liters",
    requestField: "requested_biofertilizer_liters",
  },
  {
    label: "Nanobiofertilizer",
    allocationField: "nanobiofertilizer_liters",
    requestField: "requested_nanobiofertilizer_liters",
  },
  {
    label: "Organic Root Exudate Mix",
    allocationField: "organic_root_exudate_mix_liters",
    requestField: "requested_organic_root_exudate_mix_liters",
  },
  {
    label: "Azolla microphylla",
    allocationField: "azolla_microphylla_kg",
    requestField: "requested_azolla_microphylla_kg",
  },
  {
    label: "Foliar Liquid Fertilizer (NPK)",
    allocationField: "foliar_liquid_fertilizer_npk_liters",
    requestField: "requested_foliar_liquid_fertilizer_npk_liters",
  },
];

const EDIT_SEED_ITEMS: AllocationItem[] = [
  {
    label: "NSIC Rc 160",
    allocationField: "rice_seeds_nsic_rc160_kg",
    requestField: "requested_rice_seeds_nsic_rc160_kg",
  },
  {
    label: "NSIC Rc 222",
    allocationField: "rice_seeds_nsic_rc222_kg",
    requestField: "requested_rice_seeds_nsic_rc222_kg",
  },
  {
    label: "Jackpot",
    allocationField: "jackpot_kg",
    requestField: "requested_jackpot_kg",
  },
  {
    label: "US88",
    allocationField: "us88_kg",
    requestField: "requested_us88_kg",
  },
  {
    label: "TH82",
    allocationField: "th82_kg",
    requestField: "requested_th82_kg",
  },
  {
    label: "RH9000",
    allocationField: "rh9000_kg",
    requestField: "requested_rh9000_kg",
  },
  {
    label: "Lumping143",
    allocationField: "lumping143_kg",
    requestField: "requested_lumping143_kg",
  },
  {
    label: "LP296",
    allocationField: "lp296_kg",
    requestField: "requested_lp296_kg",
  },
  {
    label: "Mestiso 1 (M1)",
    allocationField: "mestiso_1_kg",
    requestField: "requested_mestiso_1_kg",
  },
  {
    label: "Mestiso 20 (M20)",
    allocationField: "mestiso_20_kg",
    requestField: "requested_mestiso_20_kg",
  },
  {
    label: "Mestiso 29",
    allocationField: "mestiso_29_kg",
    requestField: "requested_mestiso_29_kg",
  },
  {
    label: "Mestiso 55",
    allocationField: "mestiso_55_kg",
    requestField: "requested_mestiso_55_kg",
  },
  {
    label: "Mestiso 73",
    allocationField: "mestiso_73_kg",
    requestField: "requested_mestiso_73_kg",
  },
  {
    label: "Mestiso 99",
    allocationField: "mestiso_99_kg",
    requestField: "requested_mestiso_99_kg",
  },
  {
    label: "Mestiso 103",
    allocationField: "mestiso_103_kg",
    requestField: "requested_mestiso_103_kg",
  },
  {
    label: "NSIC Rc 402",
    allocationField: "nsic_rc402_kg",
    requestField: "requested_nsic_rc402_kg",
  },
  {
    label: "NSIC Rc 480",
    allocationField: "nsic_rc480_kg",
    requestField: "requested_nsic_rc480_kg",
  },
  {
    label: "NSIC Rc 216",
    allocationField: "nsic_rc216_kg",
    requestField: "requested_nsic_rc216_kg",
  },
  {
    label: "NSIC Rc 218",
    allocationField: "nsic_rc218_kg",
    requestField: "requested_nsic_rc218_kg",
  },
  {
    label: "NSIC Rc 506",
    allocationField: "nsic_rc506_kg",
    requestField: "requested_nsic_rc506_kg",
  },
  {
    label: "NSIC Rc 508",
    allocationField: "nsic_rc508_kg",
    requestField: "requested_nsic_rc508_kg",
  },
  {
    label: "NSIC Rc 512",
    allocationField: "nsic_rc512_kg",
    requestField: "requested_nsic_rc512_kg",
  },
  {
    label: "NSIC Rc 534",
    allocationField: "nsic_rc534_kg",
    requestField: "requested_nsic_rc534_kg",
  },
  {
    label: "Tubigan 28",
    allocationField: "tubigan_28_kg",
    requestField: "requested_tubigan_28_kg",
  },
  {
    label: "Tubigan 30",
    allocationField: "tubigan_30_kg",
    requestField: "requested_tubigan_30_kg",
  },
  {
    label: "Tubigan 22",
    allocationField: "tubigan_22_kg",
    requestField: "requested_tubigan_22_kg",
  },
  {
    label: "Sahod Ulan 2",
    allocationField: "sahod_ulan_2_kg",
    requestField: "requested_sahod_ulan_2_kg",
  },
  {
    label: "Sahod Ulan 10",
    allocationField: "sahod_ulan_10_kg",
    requestField: "requested_sahod_ulan_10_kg",
  },
  {
    label: "Salinas 6",
    allocationField: "salinas_6_kg",
    requestField: "requested_salinas_6_kg",
  },
  {
    label: "Salinas 7",
    allocationField: "salinas_7_kg",
    requestField: "requested_salinas_7_kg",
  },
  {
    label: "Salinas 8",
    allocationField: "salinas_8_kg",
    requestField: "requested_salinas_8_kg",
  },
  {
    label: "Malagkit 5",
    allocationField: "malagkit_5_kg",
    requestField: "requested_malagkit_5_kg",
  },
];

const TechManageRequests: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { allocationId } = useParams<{ allocationId: string }>();
  const [allocation, setAllocation] = useState<AllocationDetails | null>(null);
  const [requests, setRequests] = useState<FarmerRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<FarmerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [barangayFilter, setBarangayFilter] = useState<string>("all");

  // DSS Feature: Alternative suggestions
  const [, setShowAlternatives] = useState<{ [key: number]: boolean }>({});
  const [alternatives, setAlternatives] = useState<{ [key: number]: any }>({});
  const [, setLoadingAlternatives] = useState<{ [key: number]: boolean }>({});

  // DSS Feature: Apply alternatives
  const [selectedAlternative, setSelectedAlternative] = useState<{
    [key: number]: { suggestionIdx: number; alternativeIdx: number };
  }>({});
  const [applyingAlternative, setApplyingAlternative] = useState<{
    [key: number]: boolean;
  }>({});

  // Auto-suggestion notifications
  const [autoSuggestionsCount, setAutoSuggestionsCount] = useState<number>(0);
  const [newSuggestionsCount, setNewSuggestionsCount] = useState<number>(0);

  // Edit Feature
  const [editingRequest, setEditingRequest] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<FarmerRequest>>({});
  const [viewingRequest, setViewingRequest] = useState<FarmerRequest | null>(
    null,
  );
  const [pendingAlternativeConfirmation, setPendingAlternativeConfirmation] =
    useState<{
      requestId: number;
      suggestionIdx: number;
      alternativeIdx: number;
    } | null>(null);
  const [openActionsMenuFor, setOpenActionsMenuFor] = useState<number | null>(
    null,
  );
  const [actionsMenuPosition, setActionsMenuPosition] = useState<{
    top: number;
    left: number;
    openUp: boolean;
  } | null>(null);

  // Delete confirmation modal state
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    requestId: number | null;
    farmerName: string;
  }>({
    open: false,
    requestId: null,
    farmerName: "",
  });
  const [isDeletingRequest, setIsDeletingRequest] = useState(false);

  // Suggestions Modal Feature
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
  const [expandedFarmerInModal, setExpandedFarmerInModal] = useState<
    number | null
  >(null);

  // Toast notification state
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: "success" | "error" | "warning";
  }>({
    show: false,
    message: "",
    type: "success",
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printScope, setPrintScope] = useState<PrintScope>("filtered");
  const [includePrintDetails, setIncludePrintDetails] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [pendingRejectId, setPendingRejectId] = useState<string | null>(null);

  // Show toast notification
  const showToast = (
    message: string,
    type: "success" | "error" | "warning" = "success",
  ) => {
    setToast({ show: true, message, type });
    // Auto-hide after 3 seconds
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 3000);
  };

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    navigate("/login");
  };

  useEffect(() => {
    fetchAllocation();
    fetchRequests();
  }, [allocationId]);

  useEffect(() => {
    filterRequests();
  }, [requests, searchTerm, statusFilter, barangayFilter]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        !target.closest(".tech-manage-requests-action-menu-wrapper") &&
        !target.closest(".tech-manage-requests-actions-popover")
      ) {
        setOpenActionsMenuFor(null);
        setActionsMenuPosition(null);
      }
    };

    document.addEventListener("click", handleDocumentClick);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
    };
  }, []);

  useEffect(() => {
    const closeActionsMenu = () => {
      setOpenActionsMenuFor(null);
      setActionsMenuPosition(null);
    };

    window.addEventListener("resize", closeActionsMenu);
    window.addEventListener("scroll", closeActionsMenu, true);

    return () => {
      window.removeEventListener("resize", closeActionsMenu);
      window.removeEventListener("scroll", closeActionsMenu, true);
    };
  }, []);

  const fetchAllocation = async () => {
    try {
      const response = await getAllocations();
      if (!response.error) {
        const allocations = response.data;
        const found = allocations.find(
          (a: any) => a.id === parseInt(allocationId || "0"),
        );
        setAllocation(found || null);
      }
    } catch (err) {
      console.error("Failed to fetch allocation:", err);
    }
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      // First get the allocation to get the season
      const allocationResponse = await getAllocations();
      if (allocationResponse.error) {
        throw new Error("Failed to fetch allocation");
      }
      const allocations = allocationResponse.data;
      const currentAllocation = allocations.find(
        (a: any) => a.id === parseInt(allocationId || "0"),
      );

      if (!currentAllocation) {
        throw new Error("Allocation not found");
      }

      // Fetch requests by allocation ID
      const response = await getFarmerRequests(allocationId, true);
      if (response.error) {
        throw new Error("Failed to fetch requests");
      }

      const data = response.data;
      setRequests(data);

      // Auto-fetch alternatives for requests with potential shortages
      setTimeout(
        () => autoFetchAlternativesForShortages(data, currentAllocation),
        500,
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch alternatives for all pending requests with shortages
  const autoFetchAlternativesForShortages = async (
    requestsList: FarmerRequest[],
    allocationData: AllocationDetails,
  ) => {
    if (!allocationData) {
      console.log("ΓÜá∩╕Å No allocation data provided, skipping auto-fetch");
      return;
    }

    const pendingRequests = requestsList.filter((r) => r.status === "pending");
    console.log(
      `≡ƒôè Checking ${pendingRequests.length} pending requests for shortages...`,
    );

    let countWithShortages = 0;
    let newSuggestions = 0;

    for (const request of pendingRequests) {
      const hasShortage = checkPotentialShortageForRequest(
        request,
        requestsList,
        allocationData,
      );

      if (hasShortage) {
        countWithShortages++;
        console.log(
          `ΓÜá∩╕Å Shortage detected for request #${request.id} (${request.farmer_name})`,
        );

        // Auto-fetch if not already loaded
        if (!alternatives[request.id]) {
          try {
            setLoadingAlternatives((prev) => ({ ...prev, [request.id]: true }));

            console.log(
              `≡ƒñû Computing alternatives for request #${request.id}...`,
            );

            // Calculate remaining stock for this request
            const remainingStock = calculateRemainingStock(
              allocationData,
              requestsList,
              request.id,
            );

            // Run client-side alternative engine
            const result = suggestAlternatives(
              {
                farmer_name: request.farmer_name,
                crop_type: "rice",
                requested_urea_bags: request.requested_urea_bags || 0,
                requested_complete_14_bags:
                  request.requested_complete_14_bags || 0,
                requested_ammonium_sulfate_bags:
                  request.requested_ammonium_sulfate_bags || 0,
                requested_muriate_potash_bags:
                  request.requested_muriate_potash_bags || 0,
                requested_jackpot_kg: request.requested_jackpot_kg || 0,
                requested_us88_kg: request.requested_us88_kg || 0,
                requested_th82_kg: request.requested_th82_kg || 0,
                requested_rh9000_kg: request.requested_rh9000_kg || 0,
                requested_lumping143_kg: request.requested_lumping143_kg || 0,
                requested_lp296_kg: request.requested_lp296_kg || 0,
              },
              remainingStock,
            );

            const hasSolutionAlternatives = Boolean(
              result?.suggestions?.suggestions?.some(
                (s: any) =>
                  Array.isArray(s?.alternatives) && s.alternatives.length > 0,
              ),
            );

            console.log(
              `Alternatives computed for request #${request.id}:`,
              result,
            );
            setAlternatives((prev) => ({ ...prev, [request.id]: result }));
            setShowAlternatives((prev) => ({ ...prev, [request.id]: true }));
            if (hasSolutionAlternatives) {
              newSuggestions++;
            }
          } catch (error) {
            console.error(
              `Failed to compute alternatives for request ${request.id}:`,
              error,
            );
          } finally {
            setLoadingAlternatives((prev) => ({
              ...prev,
              [request.id]: false,
            }));
          }

          // Small delay between requests
          await new Promise((resolve) => setTimeout(resolve, 100));
        } else {
          console.log(`Alternatives already loaded for request #${request.id}`);
        }
      }
    }

    console.log(
      `Summary: ${countWithShortages} requests with shortages, ${newSuggestions} new alternatives fetched`,
    );
    setAutoSuggestionsCount(countWithShortages);
    setNewSuggestionsCount(newSuggestions);
  };

  const filterRequests = () => {
    let filtered = [...requests];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (req) =>
          (req.farmer_name || "")
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          (req.barangay || "").toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((req) => req.status === statusFilter);
    }

    // Barangay filter
    if (barangayFilter !== "all") {
      filtered = filtered.filter((req) => req.barangay === barangayFilter);
    }

    setFilteredRequests(filtered);
  };

  const openDeleteDialog = (id: number, farmerName: string) => {
    setDeleteDialog({
      open: true,
      requestId: id,
      farmerName,
    });
  };

  const closeDeleteDialog = () => {
    if (isDeletingRequest) return;
    setDeleteDialog({
      open: false,
      requestId: null,
      farmerName: "",
    });
  };

  const confirmDeleteRequest = async () => {
    if (!deleteDialog.requestId) return;

    try {
      setIsDeletingRequest(true);
      const response = await deleteFarmerRequest(deleteDialog.requestId);

      if (!response.error) {
        showToast("Request deleted successfully", "success");
        closeDeleteDialog();
        fetchRequests();
      } else {
        showToast("Failed to delete request", "error");
      }
    } catch (error) {
      console.error("Error deleting request:", error);
      showToast("Error deleting request", "error");
    } finally {
      setIsDeletingRequest(false);
    }
  };

  const handleStatusChange = async (
    id: number,
    newStatus: string,
    reason?: string,
  ) => {
    try {
      const response = await updateFarmerRequest(id, { status: newStatus });

      if (!response.error) {
        // If status is rejected, clear alternatives for this request
        if (newStatus === "rejected") {
          setAlternatives((prev) => {
            const updated = { ...prev };
            delete updated[id];
            return updated;
          });
        }
        // If status is approved, automatically create distribution log
        if (newStatus === "approved") {
          await createDistributionLog(id);
        }
        showToast(
          `Status updated to ${newStatus}`,
          newStatus === "approved"
            ? "success"
            : newStatus === "rejected"
              ? "warning"
              : "success",
        );
        fetchRequests();
      } else {
        showToast("Failed to update status", "error");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      showToast("Error updating status", "error");
    }
  };

  // Automatically create distribution log when request is approved
  const createDistributionLog = async (requestId: number) => {
    try {
      // Find the request details
      const request = requests.find((r) => r.id === requestId);
      if (!request) return;

      // Build fertilizer and seed type strings
      const fertilizerTypes: string[] = [];
      if (request.requested_urea_bags)
        fertilizerTypes.push(`Urea:${request.requested_urea_bags}`);
      if (request.requested_complete_14_bags)
        fertilizerTypes.push(`Complete:${request.requested_complete_14_bags}`);
      if (request.requested_ammonium_sulfate_bags)
        fertilizerTypes.push(
          `Ammonium Sulfate:${request.requested_ammonium_sulfate_bags}`,
        );
      if (request.requested_muriate_potash_bags)
        fertilizerTypes.push(
          `Muriate Potash:${request.requested_muriate_potash_bags}`,
        );

      const seedTypes: string[] = [];
      if (request.requested_jackpot_kg)
        seedTypes.push(`Jackpot:${request.requested_jackpot_kg}`);
      if (request.requested_us88_kg)
        seedTypes.push(`US88:${request.requested_us88_kg}`);
      if (request.requested_th82_kg)
        seedTypes.push(`TH82:${request.requested_th82_kg}`);
      if (request.requested_rh9000_kg)
        seedTypes.push(`RH9000:${request.requested_rh9000_kg}`);
      if (request.requested_lumping143_kg)
        seedTypes.push(`Lumping143:${request.requested_lumping143_kg}`);
      if (request.requested_lp296_kg)
        seedTypes.push(`LP296:${request.requested_lp296_kg}`);

      // Calculate totals
      const totalFertilizer = Math.round(
        (Number(request.requested_urea_bags) || 0) +
          (Number(request.requested_complete_14_bags) || 0) +
          (Number(request.requested_ammonium_sulfate_bags) || 0) +
          (Number(request.requested_muriate_potash_bags) || 0),
      );

      const totalSeeds = Number(
        (
          (Number(request.requested_jackpot_kg) || 0) +
          (Number(request.requested_us88_kg) || 0) +
          (Number(request.requested_th82_kg) || 0) +
          (Number(request.requested_rh9000_kg) || 0) +
          (Number(request.requested_lumping143_kg) || 0) +
          (Number(request.requested_lp296_kg) || 0)
        ).toFixed(2),
      );

      const payload = {
        request_id: requestId,
        fertilizer_type: fertilizerTypes.join(", ") || null,
        fertilizer_bags_given: totalFertilizer,
        seed_type: seedTypes.join(", ") || null,
        seed_kg_given: totalSeeds,
        voucher_code: null,
        farmer_signature: false,
        verified_by: null,
      };

      const distResponse = await createDistributionRecord(payload);

      if (!distResponse.error) {
        console.log("Γ£à Distribution log created automatically");
      } else {
        console.error("Γ¥î Failed to create distribution log");
      }
    } catch (error) {
      console.error("Error creating distribution log:", error);
    }
  };

  const getUniqueBarangays = () => {
    const barangays = [...new Set(requests.map((req) => req.barangay))];
    return barangays.sort();
  };

  // Edit request functionality
  const handleEdit = (request: FarmerRequest) => {
    const allEditFields = [...EDIT_FERTILIZER_ITEMS, ...EDIT_SEED_ITEMS].map(
      (item) => item.requestField,
    );

    const dynamicFormData = allEditFields.reduce((acc, field) => {
      acc[field] = Number(request[field] || 0);
      return acc;
    }, {} as Partial<FarmerRequest>);

    setEditingRequest(request.id);
    setEditFormData({
      ...dynamicFormData,
      request_notes: request.request_notes || "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editingRequest) return;

    try {
      const originalRequest = requests.find((r) => r.id === editingRequest);
      if (!originalRequest) {
        throw new Error("Original request not found");
      }

      // Merge original request with edited form data
      const updatedRequest = {
        ...originalRequest,
        ...editFormData,
      };

      const response = await updateFarmerRequest(
        editingRequest,
        updatedRequest,
      );

      if (response.error) {
        throw new Error("Failed to update request");
      }

      // Update local state immediately so UI reflects changes right away
      setRequests((prev) =>
        prev.map((r) =>
          r.id === editingRequest ? { ...r, ...editFormData } : r,
        ),
      );

      // Clear alternatives for this request - will be re-evaluated after refresh
      setAlternatives((prev) => {
        const updated = { ...prev };
        delete updated[editingRequest];
        return updated;
      });
      setSelectedAlternative((prev) => {
        const updated = { ...prev };
        delete updated[editingRequest];
        return updated;
      });

      // Close edit modal
      setEditingRequest(null);
      setEditFormData({});

      showToast("Request updated successfully!", "success");

      // Refresh from backend to ensure data consistency
      await fetchRequests();
    } catch (err) {
      console.error("Error updating request:", err);
      showToast(
        `Failed to update request: ${err instanceof Error ? err.message : "Unknown error"}`,
        "error",
      );
    }
  };

  const handleCancelEdit = () => {
    setEditingRequest(null);
    setEditFormData({});
  };

  const getTotalRequested = (field: keyof FarmerRequest) => {
    return filteredRequests.reduce(
      (sum, req) => sum + (Number(req[field]) || 0),
      0,
    );
  };

  const formatSeasonName = (season: string) => {
    const [type, year] = season.split("_");
    return `${type.charAt(0).toUpperCase() + type.slice(1)} Season ${year}`;
  };

  const editingRequestData = editingRequest
    ? requests.find((r) => r.id === editingRequest) || null
    : null;

  const editableRequestFields: Array<keyof FarmerRequest> = [
    ...EDIT_FERTILIZER_ITEMS.map((item) => item.requestField),
    ...EDIT_SEED_ITEMS.map((item) => item.requestField),
  ];

  const fertilizerRequestFields: RequestField[] = EDIT_FERTILIZER_ITEMS.map(
    (item) => item.requestField,
  );

  const seedRequestFields: RequestField[] = EDIT_SEED_ITEMS.map(
    (item) => item.requestField,
  );

  const getRequestFieldValue = (
    request: FarmerRequest,
    field: keyof FarmerRequest,
  ): number => {
    const editedValue =
      editingRequest === request.id ? editFormData[field] : undefined;
    const sourceValue = editedValue ?? request[field];
    return Number(sourceValue || 0);
  };

  const getRequestTotal = (
    request: FarmerRequest,
    fields: Array<keyof FarmerRequest>,
  ): number => {
    return fields.reduce(
      (sum, field) => sum + getRequestFieldValue(request, field),
      0,
    );
  };

  const getAllocationForRequestField = (field: keyof FarmerRequest): number => {
    if (!allocation) return 0;

    const item = [...EDIT_FERTILIZER_ITEMS, ...EDIT_SEED_ITEMS].find(
      (entry) => entry.requestField === field,
    );

    if (!item) return 0;
    return Number(allocation[item.allocationField] || 0);
  };

  const getUnitForItem = (item: AllocationItem): string => {
    if (
      String(item.requestField).includes("liters") ||
      String(item.allocationField).includes("liters")
    ) {
      return "liters";
    }
    if (
      String(item.requestField).includes("_kg") ||
      String(item.allocationField).includes("_kg")
    ) {
      return "kg";
    }
    return "bags";
  };

  const getRequestedItemsForView = (
    request: FarmerRequest,
    items: AllocationItem[],
  ) => {
    return items
      .map((item) => ({
        label: item.label,
        value: Number(request[item.requestField] || 0),
        unit: getUnitForItem(item),
      }))
      .filter((item) => item.value > 0);
  };

  const viewingFertilizerItems = viewingRequest
    ? getRequestedItemsForView(viewingRequest, EDIT_FERTILIZER_ITEMS)
    : [];

  const viewingSeedItems = viewingRequest
    ? getRequestedItemsForView(viewingRequest, EDIT_SEED_ITEMS)
    : [];

  const visibleEditFertilizerItems = EDIT_FERTILIZER_ITEMS.filter((item) => {
    const requested = Number(editingRequestData?.[item.requestField] || 0);
    return requested > 0;
  });

  const visibleEditSeedItems = EDIT_SEED_ITEMS.filter((item) => {
    const requested = Number(editingRequestData?.[item.requestField] || 0);
    return requested > 0;
  });

  const getEditFieldRiskData = (field: keyof FarmerRequest) => {
    if (!editingRequestData || !allocation) return null;

    const allocationValue = getAllocationForRequestField(field);
    const currentRequestValue = Number(editingRequestData[field] || 0);
    const editedValue = Number(editFormData[field] ?? currentRequestValue);

    const committedByOthers = requests
      .filter(
        (r) =>
          (r.status === "approved" || r.status === "pending") &&
          r.id !== editingRequestData.id,
      )
      .reduce((sum, r) => sum + Number(r[field] || 0), 0);

    const remainingBeforeEdit = allocationValue - committedByOthers;
    const availableForThisRequest = Math.max(0, remainingBeforeEdit);
    const remainingAfterEdit = remainingBeforeEdit - editedValue;
    const exceedsBy = Math.max(0, -remainingAfterEdit);
    const hasRisk = exceedsBy > 0;

    return {
      allocationValue,
      currentRequestValue,
      editedValue,
      committedByOthers,
      availableForThisRequest,
      remainingAfterEdit,
      exceedsBy,
      hasRisk,
    };
  };

  const renderEditFieldMeta = (field: keyof FarmerRequest, unit: string) => {
    const riskData = getEditFieldRiskData(field);
    if (!riskData) return null;

    const {
      availableForThisRequest,
      remainingAfterEdit,
      currentRequestValue,
      editedValue,
      committedByOthers,
      exceedsBy,
      hasRisk,
    } = riskData;

    const usagePercent =
      availableForThisRequest > 0
        ? Math.min((editedValue / availableForThisRequest) * 100, 100)
        : editedValue > 0
          ? 100
          : 0;

    const remainingSafe = Math.max(0, remainingAfterEdit);

    return (
      <div className="tech-manage-requests-modal-meta-panel">
        <div className="tech-manage-requests-modal-meta-top">
          <span
            className={`tech-manage-requests-modal-meta-status ${
              hasRisk ? "is-danger" : "is-safe"
            }`}
          >
            {hasRisk ? "Exceeded" : "Within limit"}
          </span>
          <span className="tech-manage-requests-modal-meta-caption">
            Allocation check for this item
          </span>
        </div>

        <div className="tech-manage-requests-modal-meta-stats-grid">
          <span className="tech-manage-requests-modal-meta-stat">
            <small>Available now</small>
            <strong>
              {availableForThisRequest.toFixed(2)} {unit}
            </strong>
          </span>
          <span className="tech-manage-requests-modal-meta-stat">
            <small>Reserved by others</small>
            <strong>
              {committedByOthers.toFixed(2)} {unit}
            </strong>
          </span>
          <span className="tech-manage-requests-modal-meta-stat">
            <small>Original request</small>
            <strong>
              {currentRequestValue.toFixed(2)} {unit}
            </strong>
          </span>
          <span className="tech-manage-requests-modal-meta-stat">
            <small>Edited request</small>
            <strong>
              {editedValue.toFixed(2)} {unit}
            </strong>
          </span>
        </div>

        <div className="tech-manage-requests-modal-meta-bar-row">
          <span>Usage</span>
          <strong>{usagePercent.toFixed(0)}%</strong>
        </div>
        <div className="tech-manage-requests-modal-meta-bar-track">
          <div
            className={`tech-manage-requests-modal-meta-bar-fill ${
              hasRisk ? "is-danger" : "is-safe"
            }`}
            style={{ width: `${usagePercent}%` }}
          />
        </div>

        {hasRisk ? (
          <span className="tech-manage-requests-modal-risk tech-manage-requests-modal-risk-danger">
            Exceeded by {exceedsBy.toFixed(2)} {unit}. Reduce the edited value
            to continue safely.
          </span>
        ) : (
          <span className="tech-manage-requests-modal-meta-footnote">
            Remaining after edit: {remainingSafe.toFixed(2)} {unit}
          </span>
        )}
      </div>
    );
  };

  const hasAnyEditRisk =
    !!editingRequestData &&
    editableRequestFields.some((field) => getEditFieldRiskData(field)?.hasRisk);

  const getAlternativeSelectionDetails = (
    requestId: number,
    selectionOverride?: { suggestionIdx: number; alternativeIdx: number },
  ) => {
    const selection = selectionOverride || selectedAlternative[requestId];
    if (!selection) return null;

    const altData = alternatives[requestId];
    if (!altData || !altData.suggestions?.suggestions) return null;

    const suggestion = altData.suggestions.suggestions[selection.suggestionIdx];
    if (!suggestion || !suggestion.alternatives) return null;

    const alternative = suggestion.alternatives[selection.alternativeIdx];
    if (!alternative) return null;

    return {
      selection,
      altData,
      suggestion,
      alternative,
    };
  };

  const openAlternativeConfirmation = (requestId: number) => {
    const currentSelection = selectedAlternative[requestId];
    if (!currentSelection) {
      showToast("Please select an alternative first", "warning");
      return;
    }

    const details = getAlternativeSelectionDetails(requestId, currentSelection);
    if (!details) {
      showToast("Alternative details are unavailable", "error");
      return;
    }

    setPendingAlternativeConfirmation({
      requestId,
      suggestionIdx: details.selection.suggestionIdx,
      alternativeIdx: details.selection.alternativeIdx,
    });
  };

  // Apply selected alternative to farmer request
  const applyAlternative = async (
    requestId: number,
    selectionOverride?: { suggestionIdx: number; alternativeIdx: number },
  ) => {
    const details = getAlternativeSelectionDetails(
      requestId,
      selectionOverride,
    );
    if (!details) {
      showToast("Selected alternative not found", "error");
      return;
    }

    const { suggestion, alternative } = details;

    try {
      setApplyingAlternative((prev) => ({ ...prev, [requestId]: true }));

      const request = requests.find((r) => r.id === requestId);
      if (!request) {
        throw new Error("Request not found");
      }

      // Prepare updated request data
      const updatedRequest: any = { ...request };

      // Map substitution item ids to request fields (fertilizer + seed)
      const requestFieldByItemKey: Record<string, RequestField> = {
        urea_46_0_0: "requested_urea_bags",
        complete_14_14_14: "requested_complete_14_bags",
        complete_16_16_16: "requested_complete_14_bags",
        ammonium_sulfate_21_0_0: "requested_ammonium_sulfate_bags",
        muriate_potash_0_0_60: "requested_muriate_potash_bags",
        jackpot: "requested_jackpot_kg",
        us88: "requested_us88_kg",
        th82: "requested_th82_kg",
        rh9000: "requested_rh9000_kg",
        lumping143: "requested_lumping143_kg",
        lp296: "requested_lp296_kg",
      };

      const originalItemKey =
        suggestion.original_fertilizer || suggestion.original_seed;
      const substituteItemKey = alternative.substitute_id;

      const originalField = originalItemKey
        ? requestFieldByItemKey[originalItemKey]
        : undefined;
      const substituteField = substituteItemKey
        ? requestFieldByItemKey[substituteItemKey]
        : undefined;

      if (!originalField || !substituteField) {
        throw new Error(
          `Invalid substitution field mapping (original: ${String(originalItemKey)}, substitute: ${String(substituteItemKey)})`,
        );
      }

      const isSeedSubstitution = suggestion.category === "seed";
      const amountUnit = isSeedSubstitution ? "kg" : "bags";
      const shortageAmount = Number(
        suggestion.shortage_kg ?? suggestion.shortage_bags ?? 0,
      );
      const neededAmount = Number(
        alternative.needed_kg ?? alternative.needed_bags ?? 0,
      );

      // Update quantities
      const currentOriginalAmount = updatedRequest[originalField] || 0;
      const newOriginalAmount = Math.max(
        0,
        currentOriginalAmount - shortageAmount,
      );
      updatedRequest[originalField] = newOriginalAmount;

      // Add substitute amount
      const currentSubstituteAmount = updatedRequest[substituteField] || 0;
      updatedRequest[substituteField] = currentSubstituteAmount + neededAmount;

      const originalFert =
        suggestion.original_fertilizer_name ||
        suggestion.original_seed_name ||
        suggestion.original_fertilizer ||
        suggestion.original_seed ||
        "original item";
      const substituteFert = alternative.substitute_name;
      const confidence = (
        Number(alternative.confidence_score || 0) * 100
      ).toFixed(0);

      // Add note about substitution
      const timestamp = new Date().toLocaleString();
      const substitutionNote =
        `[${timestamp}] SUBSTITUTION APPLIED: ` +
        `Replaced ${shortageAmount} ${amountUnit} ${originalFert} with ` +
        `${neededAmount} ${amountUnit} ${substituteFert} ` +
        `(${confidence}% confidence). ` +
        `${alternative.can_fulfill ? "Full substitution." : `Partial: ${alternative.remaining_shortage || 0} ${amountUnit} shortage remains.`}`;

      updatedRequest.request_notes = request.request_notes
        ? `${request.request_notes}\n\n${substitutionNote}`
        : substitutionNote;

      // Send update to backend
      const response = await updateFarmerRequest(requestId, updatedRequest);

      if (!response.error) {
        const updatedData = response.data;

        // Update local state immediately with the new data
        setRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, ...updatedData } : r)),
        );

        showToast("Alternative applied successfully", "success");

        // Refresh from backend to ensure consistency
        await fetchRequests();
        // Collapse the farmer in the modal after applying
        setExpandedFarmerInModal(null);
      } else {
        throw new Error("Failed to update request");
      }
    } catch (error) {
      console.error("Error applying alternative:", error);
      showToast(
        `Error applying alternative: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error",
      );
    } finally {
      setApplyingAlternative((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const handleConfirmAlternativeSubstitution = async () => {
    if (!pendingAlternativeConfirmation) return;

    const { requestId, suggestionIdx, alternativeIdx } =
      pendingAlternativeConfirmation;

    setPendingAlternativeConfirmation(null);
    await applyAlternative(requestId, { suggestionIdx, alternativeIdx });
  };

  const pendingAlternativeDetails = pendingAlternativeConfirmation
    ? getAlternativeSelectionDetails(
        pendingAlternativeConfirmation.requestId,
        pendingAlternativeConfirmation,
      )
    : null;

  const pendingSuggestion = pendingAlternativeDetails?.suggestion;
  const pendingAlternative = pendingAlternativeDetails?.alternative;
  const pendingIsSeedSubstitution = pendingSuggestion?.category === "seed";
  const pendingAmountUnit = pendingIsSeedSubstitution ? "kg" : "bags";
  const pendingOriginalName =
    pendingSuggestion?.original_fertilizer_name ||
    pendingSuggestion?.original_seed_name ||
    pendingSuggestion?.original_fertilizer ||
    pendingSuggestion?.original_seed ||
    "Original item";
  const pendingShortageAmount = Number(
    pendingSuggestion?.shortage_kg ?? pendingSuggestion?.shortage_bags ?? 0,
  );
  const pendingNeededAmount = Number(
    pendingAlternative?.needed_kg ?? pendingAlternative?.needed_bags ?? 0,
  );
  const pendingAvailableAmount = Number(
    pendingAlternative?.available_kg ?? pendingAlternative?.available_bags ?? 0,
  );
  const pendingRemainingShortage = Number(
    pendingAlternative?.remaining_shortage ?? 0,
  );

  // Helper function to check if a request might have stock issues
  const checkPotentialShortage = (request: FarmerRequest): boolean => {
    return checkPotentialShortageForRequest(request, requests);
  };

  const checkPotentialShortageForRequest = (
    request: FarmerRequest,
    requestsList: FarmerRequest[],
    allocationData?: AllocationDetails,
  ): boolean => {
    const allocToUse = allocationData || allocation;
    if (!allocToUse) return false;

    // Calculate total approved AND pending requests so far (excluding current request)
    const approvedUrea = requestsList
      .filter(
        (r) =>
          (r.status === "approved" || r.status === "pending") &&
          r.id !== request.id,
      )
      .reduce((sum, r) => sum + Number(r.requested_urea_bags || 0), 0);

    const approvedComplete = requestsList
      .filter(
        (r) =>
          (r.status === "approved" || r.status === "pending") &&
          r.id !== request.id,
      )
      .reduce((sum, r) => sum + Number(r.requested_complete_14_bags || 0), 0);

    const approvedAmSul = requestsList
      .filter(
        (r) =>
          (r.status === "approved" || r.status === "pending") &&
          r.id !== request.id,
      )
      .reduce(
        (sum, r) => sum + Number(r.requested_ammonium_sulfate_bags || 0),
        0,
      );

    const approvedPotash = requestsList
      .filter(
        (r) =>
          (r.status === "approved" || r.status === "pending") &&
          r.id !== request.id,
      )
      .reduce(
        (sum, r) => sum + Number(r.requested_muriate_potash_bags || 0),
        0,
      );

    // Check if current request would exceed remaining stock
    const remainingUrea =
      Number(allocToUse.urea_46_0_0_bags || 0) - approvedUrea;
    const remainingComplete =
      Number(allocToUse.complete_14_14_14_bags || 0) - approvedComplete;
    const remainingAmSul =
      Number(allocToUse.ammonium_sulfate_21_0_0_bags || 0) - approvedAmSul;
    const remainingPotash =
      Number(allocToUse.muriate_potash_0_0_60_bags || 0) - approvedPotash;

    const requestedUrea = Number(request.requested_urea_bags || 0);
    const requestedComplete = Number(request.requested_complete_14_bags || 0);
    const requestedAmSul = Number(request.requested_ammonium_sulfate_bags || 0);
    const requestedPotash = Number(request.requested_muriate_potash_bags || 0);

    const fertilizerShortage =
      requestedUrea > remainingUrea ||
      requestedComplete > remainingComplete ||
      requestedAmSul > remainingAmSul ||
      requestedPotash > remainingPotash;

    // Seed shortages
    const approvedJackpot = requestsList
      .filter(
        (r) =>
          (r.status === "approved" || r.status === "pending") &&
          r.id !== request.id,
      )
      .reduce((sum, r) => sum + Number(r.requested_jackpot_kg || 0), 0);

    const approvedUs88 = requestsList
      .filter(
        (r) =>
          (r.status === "approved" || r.status === "pending") &&
          r.id !== request.id,
      )
      .reduce((sum, r) => sum + Number(r.requested_us88_kg || 0), 0);

    const approvedTh82 = requestsList
      .filter(
        (r) =>
          (r.status === "approved" || r.status === "pending") &&
          r.id !== request.id,
      )
      .reduce((sum, r) => sum + Number(r.requested_th82_kg || 0), 0);

    const approvedRh9000 = requestsList
      .filter(
        (r) =>
          (r.status === "approved" || r.status === "pending") &&
          r.id !== request.id,
      )
      .reduce((sum, r) => sum + Number(r.requested_rh9000_kg || 0), 0);

    const approvedLumping143 = requestsList
      .filter(
        (r) =>
          (r.status === "approved" || r.status === "pending") &&
          r.id !== request.id,
      )
      .reduce((sum, r) => sum + Number(r.requested_lumping143_kg || 0), 0);

    const approvedLp296 = requestsList
      .filter(
        (r) =>
          (r.status === "approved" || r.status === "pending") &&
          r.id !== request.id,
      )
      .reduce((sum, r) => sum + Number(r.requested_lp296_kg || 0), 0);

    const remainingJackpot =
      Number(allocToUse.jackpot_kg || 0) - approvedJackpot;
    const remainingUs88 = Number(allocToUse.us88_kg || 0) - approvedUs88;
    const remainingTh82 = Number(allocToUse.th82_kg || 0) - approvedTh82;
    const remainingRh9000 = Number(allocToUse.rh9000_kg || 0) - approvedRh9000;
    const remainingLumping143 =
      Number(allocToUse.lumping143_kg || 0) - approvedLumping143;
    const remainingLp296 = Number(allocToUse.lp296_kg || 0) - approvedLp296;

    const requestedJackpot = Number(request.requested_jackpot_kg || 0);
    const requestedUs88 = Number(request.requested_us88_kg || 0);
    const requestedTh82 = Number(request.requested_th82_kg || 0);
    const requestedRh9000 = Number(request.requested_rh9000_kg || 0);
    const requestedLumping143 = Number(request.requested_lumping143_kg || 0);
    const requestedLp296 = Number(request.requested_lp296_kg || 0);

    const seedShortage =
      requestedJackpot > remainingJackpot ||
      requestedUs88 > remainingUs88 ||
      requestedTh82 > remainingTh82 ||
      requestedRh9000 > remainingRh9000 ||
      requestedLumping143 > remainingLumping143 ||
      requestedLp296 > remainingLp296;

    return fertilizerShortage || seedShortage;
  };

  const escapeHtml = (value: string): string => {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const formatRequestDateForPrint = (request: FarmerRequest): string => {
    const source = request.request_date || request.created_at;
    const parsed = new Date(source);
    if (Number.isNaN(parsed.getTime())) return "N/A";
    return parsed.toLocaleDateString();
  };

  const getRequestTotalsForPrint = (request: FarmerRequest) => {
    const totalFertilizer = fertilizerRequestFields.reduce(
      (sum, field) => sum + Number(request[field] || 0),
      0,
    );
    const totalSeeds = seedRequestFields.reduce(
      (sum, field) => sum + Number(request[field] || 0),
      0,
    );

    return {
      totalFertilizer,
      totalSeeds,
    };
  };

  const buildPrintDocument = (title: string, body: string): string => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>${escapeHtml(title)}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              color: #1f2937;
            }
            .print-toolbar {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              background: #047857;
              color: white;
              padding: 14px 20px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
              z-index: 1000;
            }
            .print-toolbar h3 {
              margin: 0;
              font-size: 16px;
            }
            .print-toolbar button {
              padding: 8px 16px;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-weight: 600;
              margin-left: 8px;
            }
            .print-btn {
              background: #22c55e;
              color: white;
            }
            .close-btn {
              background: #ef4444;
              color: white;
            }
            .content-wrapper {
              margin-top: 78px;
            }
            .report-header {
              margin-bottom: 16px;
              border-bottom: 2px solid #d1d5db;
              padding-bottom: 10px;
            }
            .report-title {
              margin: 0;
              font-size: 24px;
              color: #065f46;
            }
            .report-meta {
              margin: 6px 0 0;
              color: #4b5563;
              font-size: 13px;
            }
            .section-title {
              margin: 20px 0 10px;
              font-size: 16px;
              color: #065f46;
            }
            .badge {
              display: inline-block;
              padding: 3px 8px;
              border-radius: 999px;
              font-size: 11px;
              font-weight: 700;
            }
            .badge.pending {
              background: #fef3c7;
              color: #92400e;
            }
            .badge.approved {
              background: #d1fae5;
              color: #065f46;
            }
            .badge.rejected {
              background: #fee2e2;
              color: #991b1b;
            }
            .badge.shortage {
              background: #fef3c7;
              color: #b45309;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            th,
            td {
              border: 1px solid #d1d5db;
              padding: 8px;
              text-align: left;
              font-size: 12px;
              vertical-align: top;
            }
            th {
              background: #f3f4f6;
              font-weight: 700;
            }
            .text-right {
              text-align: right;
            }
            .text-center {
              text-align: center;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(5, minmax(120px, 1fr));
              gap: 10px;
              margin-top: 12px;
            }
            .summary-card {
              border: 1px solid #d1d5db;
              border-radius: 8px;
              padding: 10px;
              background: #f9fafb;
            }
            .summary-card small {
              display: block;
              color: #6b7280;
              margin-bottom: 3px;
            }
            .summary-card strong {
              font-size: 14px;
            }
            .request-section {
              margin-top: 16px;
              border: 1px solid #d1d5db;
              border-radius: 8px;
              padding: 12px;
              page-break-inside: avoid;
            }
            .request-head {
              display: flex;
              justify-content: space-between;
              gap: 12px;
              flex-wrap: wrap;
              margin-bottom: 8px;
            }
            .notes-block {
              margin-top: 10px;
              border: 1px dashed #d1d5db;
              padding: 8px;
              border-radius: 6px;
              background: #f9fafb;
              white-space: pre-wrap;
              font-size: 12px;
            }
            .empty-cell {
              text-align: center;
              color: #6b7280;
            }
            @media print {
              body {
                margin: 0;
              }
              .print-toolbar {
                display: none !important;
              }
              .content-wrapper {
                margin-top: 0;
              }
              tr {
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="print-toolbar">
            <h3>Print Preview</h3>
            <div>
              <button class="print-btn" onclick="window.print()">Print Now</button>
              <button class="close-btn" onclick="window.close()">Close</button>
            </div>
          </div>
          <div class="content-wrapper">${body}</div>
        </body>
      </html>
    `;
  };

  const openBrowserPrintPreview = (html: string): boolean => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      return false;
    }

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    return true;
  };

  const printHtmlContent = async (htmlContent: string): Promise<boolean> => {
    const electronApi = (window as any).electron;

    if (electronApi?.printContent) {
      try {
        const result = await electronApi.printContent(htmlContent);
        if (result?.success) {
          return true;
        }
        if (result?.error && result.error !== "cancelled") {
          console.error("Print failed:", result.error);
        }
      } catch (error) {
        console.error("Electron print error:", error);
      }
    }

    return openBrowserPrintPreview(htmlContent);
  };

  const buildItemsTableRows = (
    request: FarmerRequest,
    items: AllocationItem[],
    emptyLabel: string,
  ): string => {
    const requestedItems = getRequestedItemsForView(request, items);

    if (!requestedItems.length) {
      return `<tr><td colspan="3" class="empty-cell">${escapeHtml(emptyLabel)}</td></tr>`;
    }

    return requestedItems
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.label)}</td>
            <td class="text-right">${item.value.toFixed(2)}</td>
            <td>${escapeHtml(item.unit)}</td>
          </tr>
        `,
      )
      .join("");
  };

  const buildSingleRequestPrintHtml = (request: FarmerRequest): string => {
    const { totalFertilizer, totalSeeds } = getRequestTotalsForPrint(request);
    const statusClass = escapeHtml(request.status.toLowerCase());

    return buildPrintDocument(
      `Farmer Request #${request.id}`,
      `
        <div class="report-header">
          <h1 class="report-title">Farmer Request Details</h1>
          <p class="report-meta">Generated on ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
        </div>

        <table>
          <tbody>
            <tr>
              <th>Request ID</th>
              <td>${request.id}</td>
              <th>Status</th>
              <td><span class="badge ${statusClass}">${escapeHtml(request.status)}</span></td>
            </tr>
            <tr>
              <th>Farmer</th>
              <td>${escapeHtml(request.farmer_name || "N/A")}</td>
              <th>Barangay</th>
              <td>${escapeHtml(request.barangay || "N/A")}</td>
            </tr>
            <tr>
              <th>Season</th>
              <td>${escapeHtml(formatSeasonName(request.season || ""))}</td>
              <th>Date</th>
              <td>${escapeHtml(formatRequestDateForPrint(request))}</td>
            </tr>
            <tr>
              <th>Total Fertilizers</th>
              <td>${totalFertilizer.toFixed(2)} bags</td>
              <th>Total Seeds</th>
              <td>${totalSeeds.toFixed(2)} kg</td>
            </tr>
          </tbody>
        </table>

        <h2 class="section-title">Fertilizer Items</h2>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th class="text-right">Quantity</th>
              <th>Unit</th>
            </tr>
          </thead>
          <tbody>
            ${buildItemsTableRows(request, EDIT_FERTILIZER_ITEMS, "No fertilizer items requested.")}
          </tbody>
        </table>

        <h2 class="section-title">Seed Items</h2>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th class="text-right">Quantity</th>
              <th>Unit</th>
            </tr>
          </thead>
          <tbody>
            ${buildItemsTableRows(request, EDIT_SEED_ITEMS, "No seed items requested.")}
          </tbody>
        </table>

        <h2 class="section-title">Notes</h2>
        <div class="notes-block">${escapeHtml(request.request_notes?.trim() || "No notes provided.")}</div>
      `,
    );
  };

  const buildMultipleRequestsPrintHtml = (
    requestsToPrint: FarmerRequest[],
    scopeLabel: string,
    includeDetails: boolean,
  ): string => {
    const pendingCount = requestsToPrint.filter(
      (request) => request.status === "pending",
    ).length;
    const approvedCount = requestsToPrint.filter(
      (request) => request.status === "approved",
    ).length;
    const rejectedCount = requestsToPrint.filter(
      (request) => request.status === "rejected",
    ).length;

    const totalFertilizer = requestsToPrint.reduce((sum, request) => {
      return sum + getRequestTotalsForPrint(request).totalFertilizer;
    }, 0);

    const totalSeeds = requestsToPrint.reduce((sum, request) => {
      return sum + getRequestTotalsForPrint(request).totalSeeds;
    }, 0);

    const rows = requestsToPrint
      .map((request, index) => {
        const { totalFertilizer: fertilizerTotal, totalSeeds: seedTotal } =
          getRequestTotalsForPrint(request);
        const hasShortage = checkPotentialShortageForRequest(request, requests);

        return `
          <tr>
            <td class="text-center">${index + 1}</td>
            <td>${escapeHtml(request.farmer_name || "N/A")}</td>
            <td>${escapeHtml(request.barangay || "N/A")}</td>
            <td class="text-center"><span class="badge ${escapeHtml(request.status.toLowerCase())}">${escapeHtml(request.status)}</span></td>
            <td class="text-center">${escapeHtml(formatRequestDateForPrint(request))}</td>
            <td class="text-right">${fertilizerTotal.toFixed(2)}</td>
            <td class="text-right">${seedTotal.toFixed(2)}</td>
            <td class="text-center">${
              hasShortage
                ? '<span class="badge shortage">Yes</span>'
                : '<span class="badge approved">No</span>'
            }</td>
          </tr>
        `;
      })
      .join("");

    const detailsSection = includeDetails
      ? requestsToPrint
          .map((request, index) => {
            const { totalFertilizer: fertilizerTotal, totalSeeds: seedTotal } =
              getRequestTotalsForPrint(request);
            return `
              <div class="request-section">
                <div class="request-head">
                  <strong>${index + 1}. ${escapeHtml(request.farmer_name || "N/A")}</strong>
                  <span>${escapeHtml(request.barangay || "N/A")}</span>
                  <span>${escapeHtml(formatRequestDateForPrint(request))}</span>
                </div>
                <table>
                  <tbody>
                    <tr>
                      <th style="width: 180px;">Status</th>
                      <td><span class="badge ${escapeHtml(request.status.toLowerCase())}">${escapeHtml(request.status)}</span></td>
                      <th style="width: 180px;">Totals</th>
                      <td>${fertilizerTotal.toFixed(2)} bags / ${seedTotal.toFixed(2)} kg</td>
                    </tr>
                  </tbody>
                </table>

                <h3 class="section-title">Fertilizer Items</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th class="text-right">Quantity</th>
                      <th>Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${buildItemsTableRows(request, EDIT_FERTILIZER_ITEMS, "No fertilizer items requested.")}
                  </tbody>
                </table>

                <h3 class="section-title">Seed Items</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th class="text-right">Quantity</th>
                      <th>Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${buildItemsTableRows(request, EDIT_SEED_ITEMS, "No seed items requested.")}
                  </tbody>
                </table>

                <h3 class="section-title">Notes</h3>
                <div class="notes-block">${escapeHtml(request.request_notes?.trim() || "No notes provided.")}</div>
              </div>
            `;
          })
          .join("")
      : "";

    return buildPrintDocument(
      "Farmer Requests Report",
      `
        <div class="report-header">
          <h1 class="report-title">Farmer Requests Report</h1>
          <p class="report-meta">Season: ${escapeHtml(allocation ? formatSeasonName(allocation.season) : "N/A")}</p>
          <p class="report-meta">Generated on ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} | Scope: ${escapeHtml(scopeLabel)}</p>
        </div>

        <div class="summary-grid">
          <div class="summary-card"><small>Total Requests</small><strong>${requestsToPrint.length}</strong></div>
          <div class="summary-card"><small>Pending</small><strong>${pendingCount}</strong></div>
          <div class="summary-card"><small>Approved</small><strong>${approvedCount}</strong></div>
          <div class="summary-card"><small>Rejected</small><strong>${rejectedCount}</strong></div>
          <div class="summary-card"><small>Total Resources</small><strong>${totalFertilizer.toFixed(2)} bags / ${totalSeeds.toFixed(2)} kg</strong></div>
        </div>

        <h2 class="section-title">Request Summary Table</h2>
        <table>
          <thead>
            <tr>
              <th class="text-center" style="width: 42px;">#</th>
              <th>Farmer</th>
              <th>Barangay</th>
              <th class="text-center">Status</th>
              <th class="text-center">Date</th>
              <th class="text-right">Fertilizers (bags)</th>
              <th class="text-right">Seeds (kg)</th>
              <th class="text-center">Shortage</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        ${includeDetails ? '<h2 class="section-title" style="margin-top:24px;">Per-Farmer Detailed Appendix</h2>' : ""}
        ${detailsSection}
      `,
    );
  };

  const handlePrintSingleRequest = async (request: FarmerRequest) => {
    try {
      setIsPrinting(true);
      const htmlContent = buildSingleRequestPrintHtml(request);
      const started = await printHtmlContent(htmlContent);
      if (!started) {
        showToast("Please allow popups to open print preview", "warning");
      }
    } catch (error) {
      console.error("Single request print failed:", error);
      showToast("Failed to prepare single request print", "error");
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrintMultipleRequests = async () => {
    const requestsToPrint = printScope === "all" ? requests : filteredRequests;

    if (!requestsToPrint.length) {
      showToast("No requests available for printing", "warning");
      return;
    }

    try {
      setIsPrinting(true);
      const scopeLabel =
        printScope === "all" ? "All requests" : "Currently filtered requests";
      const htmlContent = buildMultipleRequestsPrintHtml(
        requestsToPrint,
        scopeLabel,
        includePrintDetails,
      );
      const started = await printHtmlContent(htmlContent);

      if (!started) {
        showToast("Please allow popups to open print preview", "warning");
        return;
      }

      setShowPrintModal(false);
    } catch (error) {
      console.error("Bulk print failed:", error);
      showToast("Failed to prepare requests report", "error");
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page">
        {/* Sidebar */}
        <div className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
          <nav className="sidebar-nav">
            <div className="sidebar-logo">
              <img src={LogoImage} alt="Logo" />
            </div>

            <button
              className={`sidebar-nav-item ${isActive("/technician-dashboard") ? "active" : ""}`}
              onClick={() => navigate("/technician-dashboard")}
            >
              <span className="nav-icon">
                <img src={HomeIcon} alt="Home" />
              </span>
              <span className="nav-text">Home</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/technician-rsbsa") ? "active" : ""}`}
              onClick={() => navigate("/technician-rsbsa")}
            >
              <span className="nav-icon">
                <img src={RSBSAIcon} alt="RSBSA" />
              </span>
              <span className="nav-text">RSBSA</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/technician-incentives") ? "active" : ""}`}
              onClick={() => navigate("/technician-incentives")}
            >
              <span className="nav-icon">
                <img src={IncentivesIcon} alt="Incentives" />
              </span>
              <span className="nav-text">Subsidy</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/technician-masterlist") ? "active" : ""}`}
              onClick={() => navigate("/technician-masterlist")}
            >
              <span className="nav-icon">
                <img src={ApproveIcon} alt="Masterlist" />
              </span>
              <span className="nav-text">Masterlist</span>
            </button>

            <button className="sidebar-nav-item logout" onClick={handleLogout}>
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

        {/* Main Content */}
        <div className="tech-main-content">
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
            <div className="tech-incent-mobile-title">Manage Requests</div>
          </div>
          <div className="tech-manage-dashboard-header-incent">
            <div className="tech-manage-header-sub">
              <h2 className="tech-manage-page-header">
                Manage Farmer Requests
              </h2>
              {allocation && (
                <p className="page-subtitle">
                  {formatSeasonName(allocation.season)}
                </p>
              )}
            </div>
            <div className="tech-manage-requests-back-create-section">
              <div className="tech-manage-requests-action-buttons">
                <button
                  className="tech-manage-requests-print-btn"
                  onClick={() => setShowPrintModal(true)}
                  disabled={isPrinting}
                >
                  {isPrinting ? "Preparing..." : "Print Requests"}
                </button>
                <button
                  className="tech-manage-requests-add-btn"
                  onClick={() =>
                    navigate(`/technician-add-farmer-request/${allocationId}`)
                  }
                >
                  Add Farmer Request
                </button>
              </div>

              <button
                className="app-back-button"
                onClick={() => navigate("/technician-incentives")}
              >
                ← Back
              </button>
            </div>
          </div>

          <div className="content-card-incent">
            {loading ? (
              <div className="loading-message">Loading requests...</div>
            ) : error ? (
              <div className="error-state">
                <div className="error-icon">ΓÜá∩╕Å</div>
                <h3>Error Loading Requests</h3>
                <p>{error}</p>
                <button className="btn-retry" onClick={fetchRequests}>
                  Retry
                </button>
              </div>
            ) : (
              <>
                {/* Filters */}
                <div className="tech-manage-requests-filters">
                  <input
                    type="text"
                    placeholder="Search farmer or barangay..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="tech-manage-requests-search-input"
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="tech-manage-requests-filter-select"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <select
                    value={barangayFilter}
                    onChange={(e) => setBarangayFilter(e.target.value)}
                    className="tech-manage-requests-filter-select"
                  >
                    <option value="all">All Barangays</option>
                    {getUniqueBarangays().map((brgy) => (
                      <option key={brgy} value={brgy}>
                        {brgy}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Allocation vs Requests Comparison */}
                <div className="tech-manage-requests-comparison-grid">
                  {/* Regional Allocation Card */}
                  <div className="tech-manage-requests-comparison-card">
                    <h3 className="tech-manage-requests-comparison-title">
                      Regional Allocation (Total Received)
                    </h3>
                    <div className="tech-manage-requests-comparison-stats">
                      <div className="tech-manage-requests-stat-box tech-manage-requests-stat-fertilizer">
                        <span className="tech-manage-requests-stat-label">
                          Total Fertilizers
                        </span>
                        <span className="tech-manage-requests-stat-value">
                          {allocation
                            ? (
                                Number(allocation.urea_46_0_0_bags || 0) +
                                Number(allocation.complete_14_14_14_bags || 0) +
                                Number(
                                  allocation.ammonium_sulfate_21_0_0_bags || 0,
                                ) +
                                Number(
                                  allocation.muriate_potash_0_0_60_bags || 0,
                                )
                              ).toFixed(2)
                            : "0.00"}{" "}
                          bags
                        </span>
                      </div>
                      <div className="tech-manage-requests-stat-box tech-manage-requests-stat-seed">
                        <span className="tech-manage-requests-stat-label">
                          Total Seeds
                        </span>
                        <span className="tech-manage-requests-stat-value">
                          {allocation
                            ? (
                                Number(allocation.jackpot_kg || 0) +
                                Number(allocation.us88_kg || 0) +
                                Number(allocation.th82_kg || 0) +
                                Number(allocation.rh9000_kg || 0) +
                                Number(allocation.lumping143_kg || 0) +
                                Number(allocation.lp296_kg || 0)
                              ).toFixed(2)
                            : "0.00"}{" "}
                          kg
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Total Farmer Requests Card */}
                  <div className="tech-manage-requests-comparison-card">
                    <h3 className="tech-manage-requests-comparison-title">
                      Total Farmer Requests
                    </h3>
                    <div className="tech-manage-requests-comparison-stats">
                      <div className="tech-manage-requests-stat-box tech-manage-requests-stat-fertilizer">
                        <span className="tech-manage-requests-stat-label">
                          Total Fertilizers Requested
                        </span>
                        <span className="tech-manage-requests-stat-value">
                          {getTotalRequested("requested_urea_bags") +
                            getTotalRequested("requested_complete_14_bags") +
                            getTotalRequested(
                              "requested_ammonium_sulfate_bags",
                            ) +
                            getTotalRequested(
                              "requested_muriate_potash_bags",
                            )}{" "}
                          bags
                        </span>
                      </div>
                      <div className="tech-manage-requests-stat-box tech-manage-requests-stat-seed">
                        <span className="tech-manage-requests-stat-label">
                          Total Seeds Requested
                        </span>
                        <span className="tech-manage-requests-stat-value">
                          {getTotalRequested("requested_jackpot_kg") +
                            getTotalRequested("requested_us88_kg") +
                            getTotalRequested("requested_th82_kg") +
                            getTotalRequested("requested_rh9000_kg") +
                            getTotalRequested("requested_lumping143_kg") +
                            getTotalRequested("requested_lp296_kg")}{" "}
                          kg
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Approved Farmer Requests Card */}
                  <div className="tech-manage-requests-comparison-card tech-manage-requests-comparison-card-approved">
                    <h3 className="tech-manage-requests-comparison-title">
                      Approved Farmer Requests
                    </h3>
                    <div className="tech-manage-requests-comparison-stats">
                      <div className="tech-manage-requests-stat-box tech-manage-requests-stat-fertilizer">
                        <span className="tech-manage-requests-stat-label">
                          Total Fertilizers
                        </span>
                        <span className="tech-manage-requests-stat-value">
                          {(() => {
                            const approvedRequests = requests.filter(
                              (r) => r.status === "approved",
                            );
                            const total = approvedRequests.reduce(
                              (sum, r) =>
                                sum +
                                Number(r.requested_urea_bags || 0) +
                                Number(r.requested_complete_14_bags || 0) +
                                Number(r.requested_ammonium_sulfate_bags || 0) +
                                Number(r.requested_muriate_potash_bags || 0),
                              0,
                            );
                            return Number(total).toFixed(2);
                          })()}{" "}
                          bags
                        </span>
                      </div>
                      <div className="tech-manage-requests-stat-box tech-manage-requests-stat-seed">
                        <span className="tech-manage-requests-stat-label">
                          Total Seeds
                        </span>
                        <span className="tech-manage-requests-stat-value">
                          {(() => {
                            const approvedRequests = requests.filter(
                              (r) => r.status === "approved",
                            );
                            const total = approvedRequests.reduce(
                              (sum, r) =>
                                sum +
                                Number(r.requested_jackpot_kg || 0) +
                                Number(r.requested_us88_kg || 0) +
                                Number(r.requested_th82_kg || 0) +
                                Number(r.requested_rh9000_kg || 0) +
                                Number(r.requested_lumping143_kg || 0) +
                                Number(r.requested_lp296_kg || 0),
                              0,
                            );
                            return Number(total).toFixed(2);
                          })()}{" "}
                          kg
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Rejected Farmer Requests Card */}
                  <div className="tech-manage-requests-comparison-card tech-manage-requests-comparison-card-rejected">
                    <h3 className="tech-manage-requests-comparison-title">
                      Rejected Farmer Requests
                    </h3>
                    <div className="tech-manage-requests-comparison-stats">
                      <div className="tech-manage-requests-stat-box tech-manage-requests-stat-fertilizer">
                        <span className="tech-manage-requests-stat-label">
                          Total Fertilizers
                        </span>
                        <span className="tech-manage-requests-stat-value">
                          {(() => {
                            const rejectedRequests = requests.filter(
                              (r) => r.status === "rejected",
                            );
                            const total = rejectedRequests.reduce(
                              (sum, r) =>
                                sum +
                                Number(r.requested_urea_bags || 0) +
                                Number(r.requested_complete_14_bags || 0) +
                                Number(r.requested_ammonium_sulfate_bags || 0) +
                                Number(r.requested_muriate_potash_bags || 0),
                              0,
                            );
                            return Number(total).toFixed(2);
                          })()}{" "}
                          bags
                        </span>
                      </div>
                      <div className="tech-manage-requests-stat-box tech-manage-requests-stat-seed">
                        <span className="tech-manage-requests-stat-label">
                          Total Seeds
                        </span>
                        <span className="tech-manage-requests-stat-value">
                          {(() => {
                            const rejectedRequests = requests.filter(
                              (r) => r.status === "rejected",
                            );
                            const total = rejectedRequests.reduce(
                              (sum, r) =>
                                sum +
                                Number(r.requested_jackpot_kg || 0) +
                                Number(r.requested_us88_kg || 0) +
                                Number(r.requested_th82_kg || 0) +
                                Number(r.requested_rh9000_kg || 0) +
                                Number(r.requested_lumping143_kg || 0) +
                                Number(r.requested_lp296_kg || 0),
                              0,
                            );
                            return Number(total).toFixed(2);
                          })()}{" "}
                          kg
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Summary Stats */}
                <div className="tech-manage-requests-summary-cards">
                  <div className="tech-manage-requests-summary-card tech-manage-requests-summary-total">
                    <div className="tech-manage-requests-summary-label">
                      Total Requests
                    </div>
                    <div className="tech-manage-requests-summary-value">
                      {filteredRequests.length}
                    </div>
                  </div>
                  <div className="tech-manage-requests-summary-card tech-manage-requests-summary-pending">
                    <div className="tech-manage-requests-summary-label">
                      Pending
                    </div>
                    <div className="tech-manage-requests-summary-value">
                      {
                        filteredRequests.filter((r) => r.status === "pending")
                          .length
                      }
                    </div>
                  </div>
                  <div className="tech-manage-requests-summary-card tech-manage-requests-summary-approved">
                    <div className="tech-manage-requests-summary-label">
                      Approved
                    </div>
                    <div className="tech-manage-requests-summary-value">
                      {
                        filteredRequests.filter((r) => r.status === "approved")
                          .length
                      }
                    </div>
                  </div>
                  <div className="tech-manage-requests-summary-card tech-manage-requests-summary-rejected">
                    <div className="tech-manage-requests-summary-label">
                      Rejected
                    </div>
                    <div className="tech-manage-requests-summary-value">
                      {
                        filteredRequests.filter((r) => r.status === "rejected")
                          .length
                      }
                    </div>
                  </div>
                  {/* Combined Shortage & Suggestions Card */}
                  <div
                    className="tech-manage-requests-summary-card tech-manage-requests-summary-shortage"
                    onClick={() => setShowSuggestionsModal(true)}
                    style={{ cursor: "pointer" }}
                  >
                    {newSuggestionsCount > 0 && (
                      <div className="tech-manage-requests-shortage-pulse-badge">
                        {newSuggestionsCount}
                      </div>
                    )}
                    <div className="tech-manage-requests-summary-label">
                      Shortages & Suggestions
                    </div>
                    <div className="tech-manage-requests-summary-value">
                      {autoSuggestionsCount} /{" "}
                      {
                        Object.keys(alternatives).filter((key) => {
                          const alt = alternatives[parseInt(key, 10)];
                          return alt?.suggestions?.suggestions?.some(
                            (s: any) =>
                              Array.isArray(s?.alternatives) &&
                              s.alternatives.length > 0,
                          );
                        }).length
                      }
                    </div>
                    <div className="tech-manage-requests-summary-hint">
                      {autoSuggestionsCount} shortages,{" "}
                      {
                        Object.keys(alternatives).filter((key) => {
                          const alt = alternatives[parseInt(key, 10)];
                          return alt?.suggestions?.suggestions?.some(
                            (s: any) =>
                              Array.isArray(s?.alternatives) &&
                              s.alternatives.length > 0,
                          );
                        }).length
                      }{" "}
                      with solutions Click to view
                    </div>
                  </div>
                </div>

                {/* Info Box for Visual Indicators */}
                {filteredRequests.filter(
                  (r) => r.status === "pending" && checkPotentialShortage(r),
                ).length > 0 && (
                  <div className="tech-manage-requests-info-box">
                    <span className="tech-manage-requests-info-box-icon">
                      ⚠️
                    </span>
                    <div className="tech-manage-requests-info-box-content">
                      <strong className="tech-manage-requests-info-box-title">
                        Alternatives Auto-Loaded & Displayed
                      </strong>
                      <p className="tech-manage-requests-info-box-text">
                        Rows highlighted in yellow (⚠️) show automatic
                        suggestions. Alternative fertilizer options are
                        displayed automatically based on agronomic equivalency.
                        Click the "⚠️ Suggestions" card above to view and apply
                        alternatives.
                      </p>
                    </div>
                  </div>
                )}

                {/* Requests Table */}
                {filteredRequests.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📋</div>
                    <h3>No Requests Found</h3>
                    <p>No farmer requests match your filters</p>
                  </div>
                ) : (
                  <div className="tech-manage-requests-table-container">
                    <table className="tech-manage-requests-table">
                      <thead className="tech-manage-requests-table-header">
                        <tr>
                          <th>Farmer</th>
                          <th>Barangay</th>
                          <th>Status</th>
                          <th>Fertilizers (bags)</th>
                          <th>Seeds (kg)</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRequests.map((request) => {
                          const totalFertilizer = getRequestTotal(
                            request,
                            fertilizerRequestFields,
                          );

                          const totalSeeds = getRequestTotal(
                            request,
                            seedRequestFields,
                          );

                          const hasShortage = checkPotentialShortage(request);

                          return (
                            <React.Fragment key={request.id}>
                              <tr
                                className={`tech-manage-requests-table-row ${hasShortage ? "shortage-warning" : ""}`}
                              >
                                <td>
                                  {request.farmer_name}
                                  {hasShortage &&
                                    request.status === "pending" && (
                                      <div className="tech-manage-requests-shortage-badge">
                                        Shortage detected
                                      </div>
                                    )}
                                </td>
                                <td>{request.barangay}</td>
                                <td>
                                  <span
                                    className={`tech-manage-requests-status-badge tech-manage-requests-status-${request.status}`}
                                  >
                                    {request.status}
                                  </span>
                                </td>
                                <td>{totalFertilizer.toFixed(2)}</td>
                                <td>{totalSeeds.toFixed(2)}</td>
                                <td>
                                  <div className="tech-manage-requests-action-buttons tech-manage-requests-action-menu-wrapper">
                                    {request.status === "pending" && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenActionsMenuFor(null);
                                            setActionsMenuPosition(null);
                                            handleStatusChange(
                                              request.id,
                                              "approved",
                                            );
                                          }}
                                          className="tech-manage-requests-btn-approve"
                                        >
                                          Approve
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenActionsMenuFor(null);
                                            setActionsMenuPosition(null);
                                            setPendingRejectId(request.id); // ✅ store which request
                                            setRejectModalOpen(true); // ✅ open modal instead
                                          }}
                                          className="tech-manage-requests-btn-reject"
                                        >
                                          Reject
                                        </button>
                                        {rejectModalOpen && (
                                          <div className="modal-overlay">
                                            <div className="modal-box">
                                              <h3>Reason for Rejection</h3>
                                              <p>
                                                Please provide a reason before
                                                rejecting this request.
                                              </p>

                                              <textarea
                                                value={rejectReason}
                                                onChange={(e) =>
                                                  setRejectReason(
                                                    e.target.value,
                                                  )
                                                }
                                                placeholder="Enter reason here..."
                                                rows={4}
                                                className="reject-reason-input"
                                              />

                                              {!rejectReason.trim() && (
                                                <p className="reject-reason-error">
                                                  Reason is required.
                                                </p>
                                              )}

                                              <div className="modal-actions">
                                                <button
                                                  className="tech-manage-requests-btn-reject"
                                                  disabled={
                                                    !rejectReason.trim()
                                                  }
                                                  onClick={() => {
                                                    if (!rejectReason.trim())
                                                      return;
                                                    handleStatusChange(
                                                      pendingRejectId!,
                                                      "rejected",
                                                      rejectReason,
                                                    ); // ✅ pass reason
                                                    setRejectModalOpen(false);
                                                    setRejectReason("");
                                                    setPendingRejectId(null);
                                                  }}
                                                >
                                                  Confirm Reject
                                                </button>

                                                <button
                                                  className="login-button"
                                                  onClick={() => {
                                                    setRejectModalOpen(false);
                                                    setRejectReason("");
                                                    setPendingRejectId(null);
                                                  }}
                                                >
                                                  Cancel
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionsMenuFor(null);
                                        setActionsMenuPosition(null);
                                        openDeleteDialog(
                                          request.id,
                                          request.farmer_name,
                                        );
                                      }}
                                      className="tech-manage-requests-btn-delete"
                                    >
                                      Delete
                                    </button>

                                    <button
                                      type="button"
                                      aria-label="More actions"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const triggerRect =
                                          e.currentTarget.getBoundingClientRect();
                                        const menuWidth = 190;
                                        const estimatedMenuHeight =
                                          request.status === "pending"
                                            ? 150
                                            : 106;
                                        const viewportMargin = 12;
                                        const safeLeft = Math.min(
                                          Math.max(
                                            viewportMargin,
                                            triggerRect.right - menuWidth,
                                          ),
                                          window.innerWidth -
                                            menuWidth -
                                            viewportMargin,
                                        );
                                        const openUpward =
                                          triggerRect.bottom +
                                            estimatedMenuHeight +
                                            viewportMargin >
                                          window.innerHeight;
                                        const menuTop = openUpward
                                          ? triggerRect.top - 8
                                          : triggerRect.bottom + 8;

                                        setOpenActionsMenuFor((prev) => {
                                          if (prev === request.id) {
                                            setActionsMenuPosition(null);
                                            return null;
                                          }
                                          setActionsMenuPosition({
                                            top: menuTop,
                                            left: safeLeft,
                                            openUp: openUpward,
                                          });
                                          return request.id;
                                        });
                                      }}
                                      className="tech-manage-requests-btn-more"
                                    >
                                      ...
                                    </button>

                                    {openActionsMenuFor === request.id &&
                                      actionsMenuPosition && (
                                        <div
                                          className="tech-manage-requests-actions-popover tech-manage-requests-actions-popover-floating"
                                          style={{
                                            top: `${actionsMenuPosition.top}px`,
                                            left: `${actionsMenuPosition.left}px`,
                                            transform:
                                              actionsMenuPosition.openUp
                                                ? "translateY(-100%)"
                                                : "translateY(0)",
                                          }}
                                        >
                                          <button
                                            type="button"
                                            className="tech-manage-requests-actions-popover-item"
                                            onClick={() => {
                                              setOpenActionsMenuFor(null);
                                              setActionsMenuPosition(null);
                                              setViewingRequest(request);
                                            }}
                                          >
                                            View Request
                                          </button>

                                          <button
                                            type="button"
                                            className="tech-manage-requests-actions-popover-item"
                                            onClick={() => {
                                              setOpenActionsMenuFor(null);
                                              setActionsMenuPosition(null);
                                              handlePrintSingleRequest(request);
                                            }}
                                          >
                                            Print Request
                                          </button>

                                          {request.status === "pending" && (
                                            <button
                                              type="button"
                                              className="tech-manage-requests-actions-popover-item"
                                              onClick={() => {
                                                setOpenActionsMenuFor(null);
                                                setActionsMenuPosition(null);
                                                handleEdit(request);
                                              }}
                                            >
                                              Edit Request
                                            </button>
                                          )}
                                        </div>
                                      )}
                                  </div>
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* View Request Modal */}
      {viewingRequest && (
        <div className="tech-manage-requests-modal-overlay">
          <div className="tech-manage-requests-modal-content tech-manage-requests-view-request-modal">
            <h3 className="tech-manage-requests-modal-title">
              Farmer Request Details
            </h3>

            <div className="tech-manage-requests-modal-request-info">
              <span>
                <strong>Farmer:</strong> {viewingRequest.farmer_name}
              </span>
              <span>
                <strong>Barangay:</strong> {viewingRequest.barangay}
              </span>
              <span>
                <strong>Status:</strong>{" "}
                <span
                  className={`tech-manage-requests-status-badge tech-manage-requests-status-${viewingRequest.status}`}
                >
                  {viewingRequest.status}
                </span>
              </span>
              <span>
                <strong>Date:</strong>{" "}
                {new Date(
                  viewingRequest.request_date || viewingRequest.created_at,
                ).toLocaleDateString()}
              </span>
            </div>

            <div className="tech-manage-requests-view-request-sections">
              <div className="tech-manage-requests-view-request-section">
                <h4 className="tech-manage-requests-view-request-title">
                  Fertilizers
                </h4>
                {viewingFertilizerItems.length === 0 ? (
                  <p className="tech-manage-requests-modal-empty">
                    No fertilizer items requested.
                  </p>
                ) : (
                  <ul className="tech-manage-requests-view-request-list">
                    {viewingFertilizerItems.map((item) => (
                      <li key={item.label}>
                        <span>{item.label}</span>
                        <strong>
                          {item.value.toFixed(2)} {item.unit}
                        </strong>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="tech-manage-requests-view-request-section">
                <h4 className="tech-manage-requests-view-request-title">
                  Seeds
                </h4>
                {viewingSeedItems.length === 0 ? (
                  <p className="tech-manage-requests-modal-empty">
                    No seed items requested.
                  </p>
                ) : (
                  <ul className="tech-manage-requests-view-request-list">
                    {viewingSeedItems.map((item) => (
                      <li key={item.label}>
                        <span>{item.label}</span>
                        <strong>
                          {item.value.toFixed(2)} {item.unit}
                        </strong>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="tech-manage-requests-modal-section">
              <label className="tech-manage-requests-modal-label">Notes</label>
              <p className="tech-manage-requests-view-request-notes">
                {viewingRequest.request_notes?.trim() || "No notes provided."}
              </p>
            </div>

            <div className="tech-manage-requests-modal-actions">
              <button
                onClick={() => setViewingRequest(null)}
                className="tech-manage-requests-modal-btn-cancel"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Request Modal */}
      {editingRequest && (
        <div className="tech-manage-requests-modal-overlay">
          <div className="tech-manage-requests-modal-content">
            <h3 className="tech-manage-requests-modal-title">
              Edit Farmer Request
            </h3>

            {editingRequestData && (
              <div className="tech-manage-requests-modal-request-info">
                <span>
                  <strong>Farmer:</strong> {editingRequestData.farmer_name}
                </span>
                <span>
                  <strong>Barangay:</strong> {editingRequestData.barangay}
                </span>
              </div>
            )}

            {hasAnyEditRisk && (
              <div className="tech-manage-requests-modal-risk tech-manage-requests-modal-risk-danger">
                Warning: one or more edited quantities exceed current available
                allocation. Adjust the highlighted fields before saving.
              </div>
            )}

            {/* Fertilizers */}
            <div className="tech-manage-requests-modal-section">
              <h4 className="tech-manage-requests-modal-section-title">
                Fertilizers (bags)
              </h4>
              <div className="tech-manage-requests-modal-grid">
                {visibleEditFertilizerItems.length === 0 && (
                  <p className="tech-manage-requests-modal-empty">
                    No fertilizer items requested by this farmer.
                  </p>
                )}
                {visibleEditFertilizerItems.map((item) => {
                  const unit = getUnitForItem(item);
                  const hasRisk =
                    getEditFieldRiskData(item.requestField)?.hasRisk || false;
                  return (
                    <div
                      key={String(item.requestField)}
                      className={`tech-manage-requests-modal-field ${
                        hasRisk ? "tech-manage-requests-modal-field-danger" : ""
                      }`}
                    >
                      <label className="tech-manage-requests-modal-label">
                        {item.label}
                      </label>
                      {renderEditFieldMeta(item.requestField, unit)}
                      <input
                        type="number"
                        step="0.01"
                        value={Number(editFormData[item.requestField] || 0)}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            [item.requestField]:
                              parseFloat(e.target.value) || 0,
                          })
                        }
                        className="tech-manage-requests-modal-input"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Seeds */}
            <div className="tech-manage-requests-modal-section">
              <h4 className="tech-manage-requests-modal-section-title">
                Seeds (kg)
              </h4>
              <div className="tech-manage-requests-modal-grid">
                {visibleEditSeedItems.length === 0 && (
                  <p className="tech-manage-requests-modal-empty">
                    No seed items requested by this farmer.
                  </p>
                )}
                {visibleEditSeedItems.map((item) => {
                  const unit = getUnitForItem(item);
                  const hasRisk =
                    getEditFieldRiskData(item.requestField)?.hasRisk || false;
                  return (
                    <div
                      key={String(item.requestField)}
                      className={`tech-manage-requests-modal-field ${
                        hasRisk ? "tech-manage-requests-modal-field-danger" : ""
                      }`}
                    >
                      <label className="tech-manage-requests-modal-label">
                        {item.label}
                      </label>
                      {renderEditFieldMeta(item.requestField, unit)}
                      <input
                        type="number"
                        step="0.01"
                        value={Number(editFormData[item.requestField] || 0)}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            [item.requestField]:
                              parseFloat(e.target.value) || 0,
                          })
                        }
                        className="tech-manage-requests-modal-input"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div className="tech-manage-requests-modal-section">
              <label className="tech-manage-requests-modal-label">Notes</label>
              <textarea
                value={editFormData.request_notes || ""}
                onChange={(e) =>
                  setEditFormData({
                    ...editFormData,
                    request_notes: e.target.value,
                  })
                }
                rows={3}
                className="tech-manage-requests-modal-textarea"
              />
            </div>

            {/* Action Buttons */}
            <div className="tech-manage-requests-modal-actions">
              <button
                onClick={handleCancelEdit}
                className="tech-manage-requests-modal-btn-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="tech-manage-requests-modal-btn-save"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Request Confirmation Modal */}
      {deleteDialog.open && (
        <div className="tech-manage-requests-modal-overlay">
          <div className="tech-manage-requests-delete-modal-content">
            <h3 className="tech-manage-requests-modal-title">Delete Request</h3>
            <p className="tech-manage-requests-delete-modal-text">
              Are you sure you want to delete the request from
              <strong> {deleteDialog.farmerName}</strong>?
            </p>
            <p className="tech-manage-requests-delete-modal-subtext">
              This action cannot be undone.
            </p>

            <div className="tech-manage-requests-modal-actions">
              <button
                onClick={closeDeleteDialog}
                className="tech-manage-requests-modal-btn-cancel"
                disabled={isDeletingRequest}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteRequest}
                className="tech-manage-requests-modal-btn-delete-confirm"
                disabled={isDeletingRequest}
              >
                {isDeletingRequest ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Requests Modal */}
      {showPrintModal && (
        <div className="tech-manage-requests-modal-overlay">
          <div className="tech-manage-requests-print-modal-content">
            <h3 className="tech-manage-requests-modal-title">
              Print Farmer Requests
            </h3>

            <div className="tech-manage-requests-print-modal-body">
              <label
                className="tech-manage-requests-print-label"
                htmlFor="print-scope"
              >
                Select report scope
              </label>
              <select
                id="print-scope"
                value={printScope}
                onChange={(e) => setPrintScope(e.target.value as PrintScope)}
                className="tech-manage-requests-print-select"
                disabled={isPrinting}
              >
                <option value="filtered">
                  Print currently filtered requests
                </option>
                <option value="all">Print all requests</option>
              </select>

              <label className="tech-manage-requests-print-checkbox-row">
                <input
                  type="checkbox"
                  checked={includePrintDetails}
                  onChange={(e) => setIncludePrintDetails(e.target.checked)}
                  disabled={isPrinting}
                />
                Include itemized appendix for each farmer
              </label>

              <div className="tech-manage-requests-print-preview-count">
                {(printScope === "all"
                  ? requests.length
                  : filteredRequests.length
                ).toLocaleString()}{" "}
                request(s) will be included.
              </div>
            </div>

            <div className="tech-manage-requests-modal-actions">
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="tech-manage-requests-modal-btn-cancel"
                disabled={isPrinting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePrintMultipleRequests}
                className="tech-manage-requests-print-confirm-btn"
                disabled={isPrinting}
              >
                {isPrinting ? "Preparing..." : "Open Print Preview"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suggestions Modal */}
      {showSuggestionsModal && (
        <div className="tech-manage-requests-modal-overlay">
          <div
            className="tech-manage-requests-modal-content"
            style={{ maxWidth: "700px", maxHeight: "80vh" }}
          >
            <h3 className="tech-manage-requests-modal-title">
              Suggestions Overview
            </h3>

            <div
              style={{
                overflowY: "auto",
                maxHeight: "calc(80vh - 140px),",
                padding: "15px 9px",
              }}
            >
              {Object.keys(alternatives).length === 0 ? (
                <div className="tech-manage-requests-suggestions-empty">
                  <div className="tech-manage-requests-suggestions-empty-icon">
                    Empty
                  </div>
                  <h4>No Suggestions Available</h4>
                  <p>There are no shortage-based suggestions at this time.</p>
                </div>
              ) : (
                <div className="tech-manage-requests-suggestions-list">
                  {Object.keys(alternatives).map((key) => {
                    const requestId = parseInt(key);
                    const altData = alternatives[requestId];
                    const request = requests.find((r) => r.id === requestId);

                    if (
                      !altData?.suggestions?.suggestions?.length ||
                      !request ||
                      request.status !== "pending"
                    ) {
                      return null;
                    }

                    const isExpanded = expandedFarmerInModal === requestId;
                    const blockedSuggestions =
                      altData.suggestions.suggestions.filter(
                        (s: any) => !s.alternatives?.length,
                      );
                    const hasActionableSuggestions =
                      altData.suggestions.suggestions.some(
                        (s: any) => s.alternatives?.length > 0,
                      );

                    const handleEditFromOverview = () => {
                      setShowSuggestionsModal(false);
                      setExpandedFarmerInModal(null);
                      handleEdit(request);
                    };

                    const handleDeleteFromOverview = () => {
                      setShowSuggestionsModal(false);
                      setExpandedFarmerInModal(null);
                      openDeleteDialog(request.id, request.farmer_name);
                    };

                    return (
                      <div
                        key={requestId}
                        className="tech-manage-requests-suggestion-card"
                      >
                        {/* Clickable Header */}
                        <div
                          className="tech-manage-requests-suggestion-card-header"
                          onClick={() =>
                            setExpandedFarmerInModal(
                              isExpanded ? null : requestId,
                            )
                          }
                          style={{ cursor: "pointer" }}
                        >
                          <div className="tech-manage-requests-suggestion-farmer-info">
                            <span className="tech-manage-requests-suggestion-farmer-name">
                              ⚠️ {altData.farmer_name || request.farmer_name}
                            </span>
                            <span className="tech-manage-requests-suggestion-farmer-barangay">
                              {request.barangay}
                            </span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                            }}
                          >
                            <span className="tech-manage-requests-suggestion-status">
                              {altData.suggestions.suggestions.length}{" "}
                              shortage(s)
                            </span>
                            <span
                              style={{ fontSize: "16px", color: "#7c3aed" }}
                            >
                              {isExpanded ? "⚠️" : "⚠️"}
                            </span>
                          </div>
                        </div>

                        {/* Expandable Details */}
                        {isExpanded && (
                          <div className="tech-manage-requests-suggestion-details">
                            {blockedSuggestions.length > 0 && (
                              <div className="tech-manage-requests-unresolved-overview">
                                <div className="tech-manage-requests-unresolved-overview-header">
                                  <h5 className="tech-manage-requests-unresolved-overview-title">
                                    Exceeded allocations with no alternatives
                                  </h5>
                                  <span className="tech-manage-requests-unresolved-overview-count">
                                    {blockedSuggestions.length}
                                  </span>
                                </div>

                                <p className="tech-manage-requests-unresolved-overview-text">
                                  These items are beyond the remaining stock and
                                  currently have no substitution suggestions.
                                </p>

                                <ul className="tech-manage-requests-unresolved-overview-list">
                                  {blockedSuggestions.map(
                                    (blocked: any, blockedIdx: number) => {
                                      const blockedName =
                                        blocked.original_fertilizer_name ||
                                        blocked.original_seed_name ||
                                        blocked.original_fertilizer ||
                                        blocked.original_seed ||
                                        "Requested item";
                                      const blockedShortage =
                                        blocked.category === "seed"
                                          ? `${Number(blocked.shortage_kg || 0)} kg`
                                          : `${Number(blocked.shortage_bags || 0)} bags`;

                                      return (
                                        <li
                                          key={`${blockedName}-${blockedIdx}`}
                                          className="tech-manage-requests-unresolved-overview-item"
                                        >
                                          <span className="tech-manage-requests-unresolved-overview-item-name">
                                            {blockedName}
                                          </span>
                                          <span className="tech-manage-requests-unresolved-overview-item-shortage">
                                            Short by {blockedShortage}
                                          </span>
                                        </li>
                                      );
                                    },
                                  )}
                                </ul>

                                <div className="tech-manage-requests-unresolved-overview-actions">
                                  <button
                                    type="button"
                                    onClick={handleEditFromOverview}
                                    className="tech-manage-requests-btn-unresolved-edit"
                                  >
                                    Edit request manually
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleDeleteFromOverview}
                                    className="tech-manage-requests-btn-unresolved-delete"
                                  >
                                    Delete and submit new
                                  </button>
                                </div>
                              </div>
                            )}

                            {altData.suggestions.suggestions.map(
                              (suggestion: any, idx: number) => {
                                const shortageItemName =
                                  suggestion.original_fertilizer_name ||
                                  suggestion.original_seed_name ||
                                  suggestion.original_fertilizer ||
                                  suggestion.original_seed ||
                                  "Requested item";
                                const shortageAmountLabel =
                                  suggestion.category === "seed"
                                    ? `${Number(suggestion.shortage_kg || 0)} kg`
                                    : `${Number(suggestion.shortage_bags || 0)} bags`;
                                const selectedForShortage =
                                  selectedAlternative[requestId]
                                    ?.suggestionIdx === idx
                                    ? suggestion.alternatives?.[
                                        selectedAlternative[requestId]
                                          .alternativeIdx
                                      ]
                                    : null;

                                return (
                                  <div
                                    key={idx}
                                    className="tech-manage-requests-shortage-item"
                                  >
                                    <div className="tech-manage-requests-shortage-header">
                                      <span className="tech-manage-requests-shortage-label">
                                        ⚠️ Shortage:{" "}
                                        <strong>{shortageItemName}</strong>
                                      </span>
                                      <span className="tech-manage-requests-shortage-amount">
                                        {shortageAmountLabel}
                                      </span>
                                    </div>

                                    {suggestion.alternatives &&
                                    suggestion.alternatives.length > 0 ? (
                                      <div className="tech-manage-requests-alternatives-section">
                                        <label className="tech-manage-requests-alternatives-label">
                                          Available alternatives
                                        </label>

                                        <div className="tech-manage-requests-alternatives-grid">
                                          {suggestion.alternatives.map(
                                            (alt: any, altIdx: number) => {
                                              const isSelected =
                                                selectedAlternative[requestId]
                                                  ?.suggestionIdx === idx &&
                                                selectedAlternative[requestId]
                                                  ?.alternativeIdx === altIdx;
                                              const confidencePercent =
                                                Math.round(
                                                  Number(
                                                    alt.confidence_score || 0,
                                                  ) * 100,
                                                );

                                              return (
                                                <button
                                                  key={altIdx}
                                                  type="button"
                                                  onClick={() =>
                                                    setSelectedAlternative(
                                                      (prev) => ({
                                                        ...prev,
                                                        [requestId]: {
                                                          suggestionIdx: idx,
                                                          alternativeIdx:
                                                            altIdx,
                                                        },
                                                      }),
                                                    )
                                                  }
                                                  className={`tech-manage-requests-alternative-card ${
                                                    isSelected
                                                      ? "is-selected"
                                                      : ""
                                                  }`}
                                                >
                                                  <div className="tech-manage-requests-alternative-card-top">
                                                    <span className="tech-manage-requests-alternative-name">
                                                      {alt.substitute_name}
                                                    </span>
                                                    <span
                                                      className={`tech-manage-requests-alternative-fit-badge ${
                                                        alt.can_fulfill
                                                          ? "is-full"
                                                          : "is-partial"
                                                      }`}
                                                    >
                                                      {alt.can_fulfill
                                                        ? "Full cover"
                                                        : "Partial cover"}
                                                    </span>
                                                  </div>

                                                  <div className="tech-manage-requests-alternative-card-metrics">
                                                    <span>
                                                      {alt.needed_bags} bags
                                                      needed
                                                    </span>
                                                    <span>
                                                      {alt.available_bags} bags
                                                      available
                                                    </span>
                                                  </div>

                                                  <div className="tech-manage-requests-alternative-confidence-row">
                                                    <span>Confidence</span>
                                                    <strong>
                                                      {confidencePercent}%
                                                    </strong>
                                                  </div>
                                                  <div className="tech-manage-requests-alternative-confidence-track">
                                                    <div
                                                      className="tech-manage-requests-alternative-confidence-fill"
                                                      style={{
                                                        width: `${confidencePercent}%`,
                                                      }}
                                                    />
                                                  </div>
                                                </button>
                                              );
                                            },
                                          )}
                                        </div>

                                        {selectedForShortage && (
                                          <div className="tech-manage-requests-selected-alternative-preview">
                                            <div className="tech-manage-requests-selected-alternative-header">
                                              <span className="tech-manage-requests-selected-alternative-kicker">
                                                Selected substitute
                                              </span>
                                              <span
                                                className={`tech-manage-requests-alternative-fit-badge ${
                                                  selectedForShortage.can_fulfill
                                                    ? "is-full"
                                                    : "is-partial"
                                                }`}
                                              >
                                                {selectedForShortage.can_fulfill
                                                  ? "Full cover"
                                                  : "Partial cover"}
                                              </span>
                                            </div>

                                            <div className="tech-manage-requests-selected-alternative-name">
                                              {
                                                selectedForShortage.substitute_name
                                              }
                                            </div>

                                            <div className="tech-manage-requests-selected-alternative-metrics-grid">
                                              <div className="tech-manage-requests-selected-alternative-metric">
                                                <span>Needed</span>
                                                <strong>
                                                  {
                                                    selectedForShortage.needed_bags
                                                  }{" "}
                                                  bags
                                                </strong>
                                              </div>
                                              <div className="tech-manage-requests-selected-alternative-metric">
                                                <span>Available</span>
                                                <strong>
                                                  {
                                                    selectedForShortage.available_bags
                                                  }{" "}
                                                  bags
                                                </strong>
                                              </div>
                                              <div className="tech-manage-requests-selected-alternative-metric">
                                                <span>Confidence</span>
                                                <strong>
                                                  {Math.round(
                                                    Number(
                                                      selectedForShortage.confidence_score ||
                                                        0,
                                                    ) * 100,
                                                  )}
                                                  %
                                                </strong>
                                              </div>
                                            </div>

                                            {!selectedForShortage.can_fulfill && (
                                              <p className="tech-manage-requests-selected-alternative-warning">
                                                Remaining shortage:{" "}
                                                {Number(
                                                  selectedForShortage.remaining_shortage ||
                                                    0,
                                                )}{" "}
                                                bags
                                              </p>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="tech-manage-requests-no-alternatives">
                                        No suitable alternatives available
                                        {suggestion.recommendation
                                          ?.next_steps && (
                                          <div className="tech-manage-requests-recommendation">
                                            <strong>Recommendation:</strong>
                                            <ul>
                                              {suggestion.recommendation.next_steps.map(
                                                (
                                                  step: string,
                                                  stepIdx: number,
                                                ) => (
                                                  <li key={stepIdx}>{step}</li>
                                                ),
                                              )}
                                            </ul>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              },
                            )}

                            {hasActionableSuggestions && (
                              <div className="tech-manage-requests-suggestion-card-actions">
                                <button
                                  onClick={() =>
                                    openAlternativeConfirmation(requestId)
                                  }
                                  disabled={
                                    !selectedAlternative[requestId] ||
                                    applyingAlternative[requestId]
                                  }
                                  className="tech-manage-requests-btn-apply-alternative"
                                >
                                  {applyingAlternative[requestId]
                                    ? "Applying..."
                                    : "Apply Selected Alternative"}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="tech-manage-requests-modal-actions">
              <button
                onClick={() => {
                  setShowSuggestionsModal(false);
                  setExpandedFarmerInModal(null);
                }}
                className="tech-manage-requests-modal-btn-cancel"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Fertilizer Substitution Modal */}
      {pendingAlternativeConfirmation && pendingAlternativeDetails && (
        <div className="tech-manage-requests-modal-overlay">
          <div className="tech-manage-requests-modal-content tech-manage-requests-substitution-modal">
            <h3 className="tech-manage-requests-modal-title">
              Confirm Substitution
            </h3>

            <div className="tech-manage-requests-substitution-header">
              <span>
                <strong>Farmer:</strong>{" "}
                {pendingAlternativeDetails.altData.farmer_name}
              </span>
              <span
                className={`tech-manage-requests-substitution-badge ${
                  pendingAlternative?.can_fulfill ? "is-full" : "is-partial"
                }`}
              >
                {pendingAlternative?.can_fulfill
                  ? "Full substitution"
                  : "Partial substitution"}
              </span>
            </div>

            <div className="tech-manage-requests-substitution-compare">
              <div className="tech-manage-requests-substitution-card is-from">
                <small>Replace</small>
                <strong>{pendingOriginalName}</strong>
                <span>
                  {pendingShortageAmount} {pendingAmountUnit} shortage
                </span>
              </div>
              <div className="tech-manage-requests-substitution-arrow">→</div>
              <div className="tech-manage-requests-substitution-card is-to">
                <small>With</small>
                <strong>{pendingAlternative?.substitute_name}</strong>
                <span>
                  {pendingNeededAmount} {pendingAmountUnit} needed
                </span>
              </div>
            </div>

            <div className="tech-manage-requests-substitution-metrics">
              <div>
                <span>Confidence</span>
                <strong>
                  {Math.round(
                    Number(pendingAlternative?.confidence_score || 0) * 100,
                  )}
                  %
                </strong>
              </div>
              <div>
                <span>Available stock</span>
                <strong>
                  {pendingAvailableAmount} {pendingAmountUnit}
                </strong>
              </div>
              <div>
                <span>Remaining shortage</span>
                <strong>
                  {pendingRemainingShortage} {pendingAmountUnit}
                </strong>
              </div>
            </div>

            {!pendingAlternative?.can_fulfill && (
              <div className="tech-manage-requests-substitution-warning">
                Partial substitution warning: this option cannot fully cover the
                shortage. A remaining shortage of {pendingRemainingShortage}{" "}
                {pendingAmountUnit} will remain.
              </div>
            )}

            <p className="tech-manage-requests-substitution-note">
              This action will update the request quantities and append a
              substitution note. Status remains pending for final review.
            </p>

            <div className="tech-manage-requests-modal-actions">
              <button
                type="button"
                onClick={() => setPendingAlternativeConfirmation(null)}
                className="tech-manage-requests-modal-btn-cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAlternativeSubstitution}
                disabled={
                  applyingAlternative[pendingAlternativeConfirmation.requestId]
                }
                className="tech-manage-requests-modal-btn-confirm-substitution"
              >
                {applyingAlternative[pendingAlternativeConfirmation.requestId]
                  ? "Applying..."
                  : "Apply Substitution"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className={`tech-toast-notification tech-toast-${toast.type}`}>
          <div className="tech-toast-icon">
            {toast.type === "success" && "✓"}
            {toast.type === "error" && "✗"}
            {toast.type === "warning" && "⚠"}
          </div>
          <div className="tech-toast-content">
            <span className="tech-toast-message">{toast.message}</span>
          </div>
          <button
            className="tech-toast-close"
            onClick={() => setToast((prev) => ({ ...prev, show: false }))}
          ></button>
        </div>
      )}
    </div>
  );
};

export default TechManageRequests;
