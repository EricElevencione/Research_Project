import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getAllocationById,
  getFarmerRequests,
  deleteFarmerRequest,
  updateFarmerRequest,
} from "../../api";
import {
  suggestAlternatives,
  calculateRemainingStock,
} from "../../services/alternativeEngine";
import "../../assets/css/jo css/JoManageRequests.css";
import "../../components/layout/sidebarStyle.css";
import LogoImage from "../../assets/images/Logo.png";
import HomeIcon from "../../assets/images/home.png";
import RSBSAIcon from "../../assets/images/rsbsa.png";
import MasterlistIcon from "../../assets/images/approve.png";
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
  requested_complete_16_bags: number;
  requested_ammonium_sulfate_bags: number;
  requested_ammonium_phosphate_bags: number;
  requested_muriate_potash_bags: number;
  requested_zinc_sulfate_bags: number;
  requested_vermicompost_bags: number;
  requested_chicken_manure_bags: number;
  requested_rice_straw_kg: number;
  requested_carbonized_rice_hull_bags: number;
  requested_biofertilizer_liters: number;
  requested_nanobiofertilizer_liters: number;
  requested_organic_root_exudate_mix_liters: number;
  requested_azolla_microphylla_kg: number;
  requested_foliar_liquid_fertilizer_npk_liters: number;
  requested_rice_seeds_nsic_rc160_kg: number;
  requested_rice_seeds_nsic_rc222_kg: number;
  requested_jackpot_kg: number;
  requested_us88_kg: number;
  requested_th82_kg: number;
  requested_rh9000_kg: number;
  requested_lumping143_kg: number;
  requested_lp296_kg: number;
  requested_mestiso_1_kg: number;
  requested_mestiso_20_kg: number;
  requested_mestiso_29_kg: number;
  requested_mestiso_55_kg: number;
  requested_mestiso_73_kg: number;
  requested_mestiso_99_kg: number;
  requested_mestiso_103_kg: number;
  requested_nsic_rc402_kg: number;
  requested_nsic_rc480_kg: number;
  requested_nsic_rc216_kg: number;
  requested_nsic_rc218_kg: number;
  requested_nsic_rc506_kg: number;
  requested_nsic_rc508_kg: number;
  requested_nsic_rc512_kg: number;
  requested_nsic_rc534_kg: number;
  requested_tubigan_28_kg: number;
  requested_tubigan_30_kg: number;
  requested_tubigan_22_kg: number;
  requested_sahod_ulan_2_kg: number;
  requested_sahod_ulan_10_kg: number;
  requested_salinas_6_kg: number;
  requested_salinas_7_kg: number;
  requested_salinas_8_kg: number;
  requested_malagkit_5_kg: number;
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
  np_16_20_0_bags: number;
  ammonium_sulfate_21_0_0_bags: number;
  muriate_potash_0_0_60_bags: number;
  zinc_sulfate_bags: number;
  vermicompost_bags: number;
  chicken_manure_bags: number;
  rice_straw_kg: number;
  carbonized_rice_hull_bags: number;
  biofertilizer_liters: number;
  nanobiofertilizer_liters: number;
  organic_root_exudate_mix_liters: number;
  azolla_microphylla_kg: number;
  foliar_liquid_fertilizer_npk_liters: number;
  rice_seeds_nsic_rc160_kg: number;
  rice_seeds_nsic_rc222_kg: number;
  jackpot_kg: number;
  us88_kg: number;
  th82_kg: number;
  rh9000_kg: number;
  lumping143_kg: number;
  lp296_kg: number;
  mestiso_1_kg: number;
  mestiso_20_kg: number;
  mestiso_29_kg: number;
  mestiso_55_kg: number;
  mestiso_73_kg: number;
  mestiso_99_kg: number;
  mestiso_103_kg: number;
  nsic_rc402_kg: number;
  nsic_rc480_kg: number;
  nsic_rc216_kg: number;
  nsic_rc218_kg: number;
  nsic_rc506_kg: number;
  nsic_rc508_kg: number;
  nsic_rc512_kg: number;
  nsic_rc534_kg: number;
  tubigan_28_kg: number;
  tubigan_30_kg: number;
  tubigan_22_kg: number;
  sahod_ulan_2_kg: number;
  sahod_ulan_10_kg: number;
  salinas_6_kg: number;
  salinas_7_kg: number;
  salinas_8_kg: number;
  malagkit_5_kg: number;
}

type RequestField = Exclude<
  keyof FarmerRequest,
  | "id"
  | "season"
  | "request_date"
  | "farmer_id"
  | "farmer_name"
  | "barangay"
  | "farm_area_ha"
  | "status"
  | "notes"
  | "request_notes"
  | "created_at"
>;

type AllocationField = Exclude<
  keyof AllocationDetails,
  "id" | "season" | "allocation_date"
>;

type AllocationRequestItem = {
  label: string;
  allocationField: AllocationField;
  requestField: RequestField;
};

const FERTILIZER_ITEMS: AllocationRequestItem[] = [
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

const SEED_ITEMS: AllocationRequestItem[] = [
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

const EXTRA_FERTILIZER_FIELDS: Array<{
  label: string;
  requestField: RequestField;
}> = [
  { label: "Complete (16-16-16)", requestField: "requested_complete_16_bags" },
];

const ALL_ITEM_MAPPINGS: AllocationRequestItem[] = [
  ...FERTILIZER_ITEMS,
  ...SEED_ITEMS,
];
const FERTILIZER_REQUEST_FIELDS: RequestField[] = [
  ...FERTILIZER_ITEMS.map((item) => item.requestField),
  ...EXTRA_FERTILIZER_FIELDS.map((item) => item.requestField),
];
const SEED_REQUEST_FIELDS: RequestField[] = SEED_ITEMS.map(
  (item) => item.requestField,
);

const sumRequestFields = (
  request: Partial<FarmerRequest>,
  fields: RequestField[],
): number => {
  return fields.reduce((sum, field) => sum + (Number(request[field]) || 0), 0);
};

const sumRequestFieldsForList = (
  requests: FarmerRequest[],
  fields: RequestField[],
): number => {
  return requests.reduce(
    (sum, request) => sum + sumRequestFields(request, fields),
    0,
  );
};

const sumAllocationFields = (
  allocation: AllocationDetails | null,
  items: AllocationRequestItem[],
): number => {
  if (!allocation) return 0;
  return items.reduce(
    (sum, item) => sum + (Number(allocation[item.allocationField]) || 0),
    0,
  );
};

const JoManageRequests: React.FC = () => {
  const navigate = useNavigate();
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

  // Edit Feature
  const [editingRequest, setEditingRequest] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<FarmerRequest>>({});

  // Auto-suggestion notifications
  const [autoSuggestionsCount, setAutoSuggestionsCount] = useState<number>(0);
  const [newSuggestionsCount, setNewSuggestionsCount] = useState<number>(0);

  // Suggestions Modal Feature
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
  const [expandedFarmerInModal, setExpandedFarmerInModal] = useState<
    number | null
  >(null);

  // Notification State
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationType, setNotificationType] = useState<
    "success" | "error" | "warning"
  >("success");

  // Delete Confirmation Modal State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    fetchAllocation();
    fetchRequests();
  }, [allocationId]);

  useEffect(() => {
    filterRequests();
  }, [requests, searchTerm, statusFilter, barangayFilter]);

  const fetchAllocation = async () => {
    try {
      const response = await getAllocationById(allocationId || "0");
      if (!response.error) {
        setAllocation(response.data || null);
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
      const allocationResponse = await getAllocationById(allocationId || "0");
      if (allocationResponse.error) {
        throw new Error("Failed to fetch allocation");
      }
      const currentAllocation = allocationResponse.data || null;

      if (!currentAllocation) {
        throw new Error("Allocation not found");
      }

      // Fetch requests by allocation ID
      const response = await getFarmerRequests(allocationId, true);
      if (response.error) {
        throw new Error("Failed to fetch requests");
      }

      const data = response.data || [];
      setRequests(data);

      // Auto-fetch alternatives for requests with potential shortages
      // Pass currentAllocation directly to avoid state timing issues
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
      console.log("⚠️ No allocation data provided, skipping auto-fetch");
      return;
    }

    const pendingRequests = requestsList.filter((r) => r.status === "pending");
    console.log(
      `📊 Checking ${pendingRequests.length} pending requests for shortages...`,
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
          `⚠️ Shortage detected for request #${request.id} (${request.farmer_name})`,
        );

        // Auto-fetch if not already loaded
        if (!alternatives[request.id]) {
          try {
            setLoadingAlternatives((prev) => ({ ...prev, [request.id]: true }));

            console.log(
              `🤖 Computing alternatives for request #${request.id}...`,
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

            console.log(
              `✅ Alternatives computed for request #${request.id}:`,
              result,
            );
            setAlternatives((prev) => ({ ...prev, [request.id]: result }));
            setShowAlternatives((prev) => ({ ...prev, [request.id]: true }));
            newSuggestions++;
          } catch (error) {
            console.error(
              `❌ Failed to compute alternatives for request ${request.id}:`,
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
          console.log(
            `ℹ️ Alternatives already loaded for request #${request.id}`,
          );
        }
      }
    }

    console.log(
      `📈 Summary: ${countWithShortages} requests with shortages, ${newSuggestions} new alternatives fetched`,
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
          req.farmer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          req.barangay.toLowerCase().includes(searchTerm.toLowerCase()),
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

  const handleDelete = (id: number, farmerName: string) => {
    setDeleteTarget({ id, name: farmerName });
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setShowDeleteConfirm(false);

    try {
      const response = await deleteFarmerRequest(deleteTarget.id);

      if (!response.error) {
        setNotificationType("success");
        setNotificationMessage(
          `Request from ${deleteTarget.name} deleted successfully!`,
        );
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 3000);
        fetchRequests();
      } else {
        setNotificationType("error");
        setNotificationMessage("Failed to delete request. Please try again.");
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 4000);
      }
    } catch (error) {
      console.error("Error deleting request:", error);
      setNotificationType("error");
      setNotificationMessage("Error deleting request. Please try again.");
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 4000);
    } finally {
      setDeleteTarget(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeleteTarget(null);
  };

  // Apply selected alternative to farmer request
  const applyAlternative = async (requestId: number) => {
    const selection = selectedAlternative[requestId];
    if (!selection) {
      alert("❌ Please select an alternative from the dropdown first");
      return;
    }

    const altData = alternatives[requestId];
    if (!altData || !altData.suggestions?.suggestions) {
      alert("❌ Alternative data not found");
      return;
    }

    const suggestion = altData.suggestions.suggestions[selection.suggestionIdx];
    const alternative = suggestion.alternatives[selection.alternativeIdx];

    if (!alternative) {
      alert("❌ Selected alternative not found");
      return;
    }

    // Show warning for partial substitutions
    if (!alternative.can_fulfill) {
      const confirmed = confirm(
        `⚠️ WARNING: Partial Substitution\n\n` +
          `This alternative can only partially cover the shortage:\n` +
          `- Original shortage: ${suggestion.shortage_bags} bags\n` +
          `- Can cover: ${alternative.partial_coverage || 0} bags\n` +
          `- Remaining shortage: ${alternative.remaining_shortage || 0} bags\n\n` +
          `Do you want to continue with this partial substitution?`,
      );
      if (!confirmed) return;
    }

    // Build confirmation message
    const originalFert = suggestion.original_fertilizer_name;
    const substituteFert = alternative.substitute_name;
    const confidence = (alternative.confidence_score * 100).toFixed(0);

    const confirmMessage =
      `📝 Confirm Fertilizer Substitution\n\n` +
      `Farmer: ${altData.farmer_name}\n\n` +
      `REPLACE:\n` +
      `❌ ${suggestion.original_fertilizer}: ${suggestion.shortage_bags} bags (shortage)\n\n` +
      `WITH:\n` +
      `✅ ${substituteFert}: ${alternative.needed_bags} bags\n\n` +
      `Confidence: ${confidence}%\n` +
      `Available Stock: ${alternative.available_bags} bags\n\n` +
      `${alternative.can_fulfill ? "✅ Full substitution possible" : "⚠️ Partial substitution"}\n\n` +
      `This will update the farmer's request and add a note.\n` +
      `Status will remain PENDING for your final review.\n\n` +
      `Apply this alternative?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setApplyingAlternative((prev) => ({ ...prev, [requestId]: true }));

      const request = requests.find((r) => r.id === requestId);
      if (!request) {
        throw new Error("Request not found");
      }

      // Prepare updated request data
      const updatedRequest: any = { ...request };

      // Map original fertilizer type to field name
      const fieldMapping: { [key: string]: string } = {
        urea_46_0_0: "requested_urea_bags",
        complete_14_14_14: "requested_complete_14_bags",
        ammonium_sulfate_21_0_0: "requested_ammonium_sulfate_bags",
        muriate_potash_0_0_60: "requested_muriate_potash_bags",
      };

      const substituteMapping: { [key: string]: string } = {
        urea_46_0_0: "requested_urea_bags",
        complete_14_14_14: "requested_complete_14_bags",
        complete_16_16_16: "requested_complete_14_bags", // Map to closest field
        ammonium_sulfate_21_0_0: "requested_ammonium_sulfate_bags",
        muriate_potash_0_0_60: "requested_muriate_potash_bags",
      };

      const originalField = fieldMapping[suggestion.original_fertilizer];
      const substituteField = substituteMapping[alternative.substitute_id];

      if (!originalField || !substituteField) {
        throw new Error("Invalid fertilizer field mapping");
      }

      // Update quantities
      const currentOriginalAmount = updatedRequest[originalField] || 0;
      const newOriginalAmount = Math.max(
        0,
        currentOriginalAmount - suggestion.shortage_bags,
      );
      updatedRequest[originalField] = newOriginalAmount;

      // Add substitute amount
      const currentSubstituteAmount = updatedRequest[substituteField] || 0;
      updatedRequest[substituteField] =
        currentSubstituteAmount + alternative.needed_bags;

      // Add note about substitution
      const timestamp = new Date().toLocaleString();
      const substitutionNote =
        `[${timestamp}] SUBSTITUTION APPLIED: ` +
        `Replaced ${suggestion.shortage_bags} bags ${originalFert} with ` +
        `${alternative.needed_bags} bags ${substituteFert} ` +
        `(${confidence}% confidence). ` +
        `${alternative.can_fulfill ? "Full substitution." : `Partial: ${alternative.remaining_shortage} bags shortage remains.`}`;

      updatedRequest.request_notes = request.request_notes
        ? `${request.request_notes}\n\n${substitutionNote}`
        : substitutionNote;

      // Send update to backend
      const response = await updateFarmerRequest(requestId, updatedRequest);

      if (!response.error) {
        alert(
          "✅ Alternative applied successfully!\n\nRequest updated. Status remains PENDING for your review.",
        );
        // Refresh requests and close alternatives panel
        await fetchRequests();
        setShowAlternatives((prev) => ({ ...prev, [requestId]: false }));
        setSelectedAlternative((prev) => {
          const newState = { ...prev };
          delete newState[requestId];
          return newState;
        });
      } else {
        throw new Error(response.error || "Failed to update request");
      }
    } catch (error) {
      console.error("Error applying alternative:", error);
      alert(
        `❌ Error applying alternative: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setApplyingAlternative((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const getUniqueBarangays = () => {
    const barangays = [...new Set(requests.map((req) => req.barangay))];
    return barangays.sort();
  };

  const updateEditQuantity = (
    field: RequestField,
    value: string,
    allowDecimal: boolean,
  ) => {
    const parsedValue =
      value === ""
        ? 0
        : allowDecimal
          ? Number.parseFloat(value)
          : Number.parseInt(value, 10);

    setEditFormData((prev) => ({
      ...prev,
      [field]: Number.isNaN(parsedValue) ? 0 : parsedValue,
    }));
  };

  const getRequestTotals = (request: FarmerRequest) => ({
    fertilizer: sumRequestFields(request, FERTILIZER_REQUEST_FIELDS),
    seeds: sumRequestFields(request, SEED_REQUEST_FIELDS),
  });

  const getStatusTotals = (status: "approved" | "rejected") => {
    const statusRequests = requests.filter((r) => r.status === status);
    return {
      fertilizer: sumRequestFieldsForList(
        statusRequests,
        FERTILIZER_REQUEST_FIELDS,
      ),
      seeds: sumRequestFieldsForList(statusRequests, SEED_REQUEST_FIELDS),
    };
  };

  const formatSeasonName = (season: string) => {
    const [type, year] = season.split("_");
    return `${type.charAt(0).toUpperCase() + type.slice(1)} Season ${year}`;
  };

  // Edit request functionality
  const handleEdit = (request: FarmerRequest) => {
    setEditingRequest(request.id);
    const allFieldValues = ALL_ITEM_MAPPINGS.reduce((acc, item) => {
      acc[item.requestField] = Number(request[item.requestField]) || 0;
      return acc;
    }, {} as Partial<FarmerRequest>);

    EXTRA_FERTILIZER_FIELDS.forEach((item) => {
      allFieldValues[item.requestField] =
        Number(request[item.requestField]) || 0;
    });

    setEditFormData({
      ...allFieldValues,
      request_notes: request.request_notes || "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editingRequest) return;

    try {
      // FIX: Get the full original request and merge with edited data
      // This ensures all required fields are sent to the backend
      const originalRequest = requests.find((r) => r.id === editingRequest);
      if (!originalRequest) {
        throw new Error("Original request not found");
      }

      // Merge original request with edited form data
      const updatedRequest = {
        ...originalRequest, // Keep all original fields (farmer_id, season, etc.)
        ...editFormData, // Override with edited values
      };

      // FIX: Changed endpoint from /farmer-requests/ to /requests/ to match backend API
      const response = await updateFarmerRequest(
        editingRequest,
        updatedRequest,
      );

      if (response.error) {
        throw new Error("Failed to update request");
      }

      // Refresh requests list to show updated data
      await fetchRequests();

      // Close edit modal
      setEditingRequest(null);
      setEditFormData({});

      setNotificationType("success");
      setNotificationMessage("Request updated successfully!");
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
    } catch (err) {
      console.error("Error updating request:", err);
      alert(
        `❌ Failed to update request: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }
  };

  const handleCancelEdit = () => {
    setEditingRequest(null);
    setEditFormData({});
  };

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

    const shortageItems = ALL_ITEM_MAPPINGS.filter((item) => {
      const alreadyRequested = requestsList
        .filter(
          (r) =>
            (r.status === "approved" || r.status === "pending") &&
            r.id !== request.id,
        )
        .reduce((sum, r) => sum + (Number(r[item.requestField]) || 0), 0);

      const remainingStock =
        (Number(allocToUse[item.allocationField]) || 0) - alreadyRequested;
      const requestedAmount = Number(request[item.requestField]) || 0;
      return requestedAmount > remainingStock;
    });

    if (request.status === "pending" && shortageItems.length > 0) {
      console.log(`🔍 Shortage Check for ${request.farmer_name}:`, {
        shortageCount: shortageItems.length,
        shortageItems: shortageItems.map((item) => item.label),
      });
    }

    return shortageItems.length > 0;
  };

  const editingRequestData = editingRequest
    ? requests.find((request) => request.id === editingRequest) || null
    : null;

  const visibleExtraFertilizerFields = EXTRA_FERTILIZER_FIELDS.filter(
    (item) => Number(editingRequestData?.[item.requestField]) > 0,
  );

  const visibleFertilizerFields = FERTILIZER_ITEMS.filter(
    (item) => Number(editingRequestData?.[item.requestField]) > 0,
  );

  const visibleSeedFields = SEED_ITEMS.filter(
    (item) => Number(editingRequestData?.[item.requestField]) > 0,
  );

  return (
    <div className="page-container">
      {/* Notification Toast */}
      {showNotification && (
        <div
          className={`jo-manage-notification-toast jo-manage-notification-${notificationType}`}
        >
          <div className="jo-manage-notification-content">
            <span className="jo-manage-notification-icon">
              {notificationType === "success"
                ? "✅"
                : notificationType === "warning"
                  ? "⚠️"
                  : "❌"}
            </span>
            <span className="jo-manage-notification-message">
              {notificationMessage}
            </span>
          </div>
          <button
            className="jo-manage-notification-close"
            onClick={() => setShowNotification(false)}
          >
            ×
          </button>
        </div>
      )}

      <div className="page">
        {/* Sidebar */}
        <div className="sidebar">
          <nav className="sidebar-nav">
            <div className="sidebar-logo">
              <img src={LogoImage} alt="Logo" />
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

        {/* Main Content */}
        <div className="main-content">
          <div className="jo-manage-dashboard-header-incent">
            <div className="jo-manage-header-sub">
              <h2 className="jo-manage-page-header">Manage Farmer Requests</h2>
              {allocation && (
                <p className="jo-manage-page-subtitle">
                  {formatSeasonName(allocation.season)}
                </p>
              )}
            </div>
            <div className="jo-manage-requests-back-create-section">
              <button
                className="app-back-button"
                onClick={() => navigate("/jo-incentives")}
              >
                ← Back
              </button>
              <button
                className="jo-manage-requests-add-btn"
                onClick={() =>
                  navigate(`/jo-add-farmer-request/${allocationId}`)
                }
              >
                ➕ Add Farmer Request
              </button>
            </div>
          </div>

          <div className="jo-manage-content-card-incent">
            {/* Filters */}
            <div className="jo-manage-requests-filters">
              <input
                type="text"
                placeholder="🔍 Search by farmer name or barangay..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="jo-manage-requests-search-input"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="jo-manage-requests-filter-select"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <select
                value={barangayFilter}
                onChange={(e) => setBarangayFilter(e.target.value)}
                className="jo-manage-requests-filter-select"
              >
                <option value="all">All Barangays</option>
                {getUniqueBarangays().map((barangay) => (
                  <option key={barangay} value={barangay}>
                    {barangay}
                  </option>
                ))}
              </select>
            </div>

            {/* Allocation vs Requests Comparison */}
            <div className="jo-manage-requests-comparison-grid">
              {/* Regional Allocation Card */}
              <div className="jo-manage-requests-allocation-card">
                <h3 className="jo-manage-requests-card-header allocation">
                  📦 Regional Allocation (Total Received)
                </h3>
                <div className="jo-manage-requests-card-content">
                  <div className="jo-manage-requests-stat-box fertilizers">
                    <span className="jo-manage-requests-stat-label fertilizers">
                      🌱 Total Fertilizers
                    </span>
                    <span className="jo-manage-requests-stat-value fertilizers">
                      {sumAllocationFields(
                        allocation,
                        FERTILIZER_ITEMS,
                      ).toFixed(2)}{" "}
                      bags
                    </span>
                  </div>
                  <div className="jo-manage-requests-stat-box seeds">
                    <span className="jo-manage-requests-stat-label seeds">
                      🌾 Total Seeds
                    </span>
                    <span className="jo-manage-requests-stat-value seeds">
                      {sumAllocationFields(allocation, SEED_ITEMS).toFixed(2)}{" "}
                      kg
                    </span>
                  </div>
                </div>
              </div>

              {/* Total Farmer Requests Card */}
              <div className="jo-manage-requests-farmer-requests-card">
                <h3 className="jo-manage-requests-card-header total-requests">
                  📊 Total Farmer Requests
                </h3>
                <div className="jo-manage-requests-card-content">
                  <div className="jo-manage-requests-stat-box fertilizers">
                    <span className="jo-manage-requests-stat-label fertilizers">
                      🌱 Total Fertilizers Requested
                    </span>
                    <span className="jo-manage-requests-stat-value fertilizers">
                      {sumRequestFieldsForList(
                        filteredRequests,
                        FERTILIZER_REQUEST_FIELDS,
                      ).toFixed(2)}{" "}
                      bags
                    </span>
                  </div>
                  <div className="jo-manage-requests-stat-box seeds">
                    <span className="jo-manage-requests-stat-label seeds">
                      🌾 Total Seeds Requested
                    </span>
                    <span className="jo-manage-requests-stat-value seeds">
                      {sumRequestFieldsForList(
                        filteredRequests,
                        SEED_REQUEST_FIELDS,
                      ).toFixed(2)}{" "}
                      kg
                    </span>
                  </div>
                </div>
              </div>

              {/* Approved Farmer Requests Card */}
              <div className="jo-manage-requests-farmer-requests-card approved">
                <h3 className="jo-manage-requests-card-header farmer-requests">
                  ✅ Approved Farmer Requests
                </h3>
                <div className="jo-manage-requests-card-content">
                  <div className="jo-manage-requests-stat-box fertilizers">
                    <span className="jo-manage-requests-stat-label fertilizers">
                      🌱 Total Fertilizers
                    </span>
                    <span className="jo-manage-requests-stat-value fertilizers">
                      {getStatusTotals("approved").fertilizer.toFixed(2)} bags
                    </span>
                  </div>
                  <div className="jo-manage-requests-stat-box seeds">
                    <span className="jo-manage-requests-stat-label seeds">
                      🌾 Total Seeds
                    </span>
                    <span className="jo-manage-requests-stat-value seeds">
                      {getStatusTotals("approved").seeds.toFixed(2)} kg
                    </span>
                  </div>
                </div>
              </div>

              {/* Rejected Farmer Requests Card */}
              <div className="jo-manage-requests-farmer-requests-card rejected">
                <h3 className="jo-manage-requests-card-header farmer-requests-rejected">
                  ❌ Rejected Farmer Requests
                </h3>
                <div className="jo-manage-requests-card-content">
                  <div className="jo-manage-requests-stat-box fertilizers">
                    <span className="jo-manage-requests-stat-label fertilizers">
                      🌱 Total Fertilizers
                    </span>
                    <span className="jo-manage-requests-stat-value fertilizers">
                      {getStatusTotals("rejected").fertilizer.toFixed(2)} bags
                    </span>
                  </div>
                  <div className="jo-manage-requests-stat-box seeds">
                    <span className="jo-manage-requests-stat-label seeds">
                      🌾 Total Seeds
                    </span>
                    <span className="jo-manage-requests-stat-value seeds">
                      {getStatusTotals("rejected").seeds.toFixed(2)} kg
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="jo-manage-requests-summary-grid">
              <div className="jo-manage-requests-summary-card total">
                <div className="jo-manage-requests-summary-label">
                  Total Requests
                </div>
                <div className="jo-manage-requests-summary-value">
                  {filteredRequests.length}
                </div>
              </div>
              <div className="jo-manage-requests-summary-card pending">
                <div className="jo-manage-requests-summary-label pending">
                  Pending
                </div>
                <div className="jo-manage-requests-summary-value pending">
                  {
                    filteredRequests.filter((r) => r.status === "pending")
                      .length
                  }
                </div>
              </div>
              <div className="jo-manage-requests-summary-card approved">
                <div className="jo-manage-requests-summary-label approved">
                  Approved
                </div>
                <div className="jo-manage-requests-summary-value approved">
                  {
                    filteredRequests.filter((r) => r.status === "approved")
                      .length
                  }
                </div>
              </div>
              <div className="jo-manage-requests-summary-card rejected">
                <div className="jo-manage-requests-summary-label rejected">
                  Rejected
                </div>
                <div className="jo-manage-requests-summary-value rejected">
                  {
                    filteredRequests.filter((r) => r.status === "rejected")
                      .length
                  }
                </div>
              </div>
              {/* Combined Shortage & Suggestions Card */}
              <div
                className="jo-manage-requests-summary-card shortage"
                onClick={() => setShowSuggestionsModal(true)}
                style={{ cursor: "pointer" }}
              >
                {newSuggestionsCount > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "-8px",
                      right: "-8px",
                      background: "#ef4444",
                      color: "white",
                      borderRadius: "50%",
                      width: "24px",
                      height: "24px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      fontWeight: "700",
                      border: "2px solid white",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                      animation: "pulse 2s infinite",
                    }}
                  >
                    {newSuggestionsCount}
                  </div>
                )}
                <div
                  style={{
                    fontSize: "14px",
                    color: "#92400e",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  ⚠️ Shortages & Suggestions
                </div>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: "600",
                    color: "#92400e",
                  }}
                >
                  {autoSuggestionsCount} /{" "}
                  {
                    Object.keys(alternatives).filter((key) => {
                      const alt = alternatives[parseInt(key)];
                      return alt?.suggestions?.suggestions?.length > 0;
                    }).length
                  }
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#78350f",
                    marginTop: "4px",
                  }}
                >
                  {autoSuggestionsCount} shortages,{" "}
                  {
                    Object.keys(alternatives).filter((key) => {
                      const alt = alternatives[parseInt(key)];
                      return alt?.suggestions?.suggestions?.length > 0;
                    }).length
                  }{" "}
                  with solutions • Click to view
                </div>
              </div>
            </div>

            {loading ? (
              <div className="loading-message">Loading requests...</div>
            ) : error ? (
              <div className="error-state">
                <div className="error-icon">⚠️</div>
                <h3>Error Loading Requests</h3>
                <p>{error}</p>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📝</div>
                <h3>No Farmer Requests</h3>
                <p>No requests found matching your filters</p>
              </div>
            ) : (
              <>
                {/* Info Box for Visual Indicators */}
                {filteredRequests.filter(
                  (r) => r.status === "pending" && checkPotentialShortage(r),
                ).length > 0 && (
                  <div className="jo-manage-requests-info-box">
                    <span style={{ fontSize: "24px" }}>💡</span>
                    <div style={{ flex: 1 }}>
                      <strong style={{ color: "#92400e", fontSize: "14px" }}>
                        Alternatives Auto-Loaded & Available
                      </strong>
                      <p
                        style={{
                          margin: "4px 0 0 0",
                          fontSize: "13px",
                          color: "#78350f",
                        }}
                      >
                        Rows highlighted in yellow (⚠️) have detected shortages.
                        Alternative fertilizer options have been automatically
                        loaded based on agronomic equivalency. Click the "💡
                        Suggestions" card above to view and apply alternatives.
                      </p>
                    </div>
                  </div>
                )}

                <div className="jo-manage-requests-table-container">
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "14px",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          background: "#f9fafb",
                          borderBottom: "2px solid #e5e7eb",
                        }}
                      >
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontWeight: "600",
                          }}
                        >
                          Farmer Name
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontWeight: "600",
                          }}
                        >
                          Barangay
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "center",
                            fontWeight: "600",
                          }}
                        >
                          Fertilizers (bags)
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "center",
                            fontWeight: "600",
                          }}
                        >
                          Seeds (kg)
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "center",
                            fontWeight: "600",
                          }}
                        >
                          Status
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "center",
                            fontWeight: "600",
                          }}
                        >
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRequests.map((request) => {
                        const totals = getRequestTotals(request);

                        // Check if this request might have shortages
                        const hasShortage =
                          request.status === "pending" &&
                          checkPotentialShortage(request);

                        return (
                          <React.Fragment key={request.id}>
                            <tr
                              style={{
                                borderBottom: "1px solid #e5e7eb",
                                background: hasShortage
                                  ? "#fef3c7"
                                  : "transparent",
                              }}
                            >
                              <td style={{ padding: "12px" }}>
                                {hasShortage && (
                                  <span
                                    title="Potential shortage - alternatives auto-loaded"
                                    style={{
                                      marginRight: "8px",
                                      fontSize: "16px",
                                    }}
                                  ></span>
                                )}
                                {hasShortage && alternatives[request.id] && (
                                  <span title="Alternatives ready - click to view"></span>
                                )}
                                {request.farmer_name}
                              </td>
                              <td style={{ padding: "12px" }}>
                                {request.barangay}
                              </td>
                              <td
                                style={{ padding: "12px", textAlign: "center" }}
                              >
                                {totals.fertilizer.toFixed(2)}
                                {hasShortage && (
                                  <span title="Alternatives auto-displayed below"></span>
                                )}
                              </td>
                              <td
                                style={{ padding: "12px", textAlign: "center" }}
                              >
                                {totals.seeds.toFixed(2)}
                              </td>
                              <td
                                style={{ padding: "12px", textAlign: "center" }}
                              >
                                <span
                                  style={{
                                    padding: "4px 12px",
                                    borderRadius: "12px",
                                    fontSize: "12px",
                                    fontWeight: "600",
                                    background:
                                      request.status === "pending"
                                        ? "#fef3c7"
                                        : request.status === "approved"
                                          ? "#d1fae5"
                                          : "#fee2e2",
                                    color:
                                      request.status === "pending"
                                        ? "#92400e"
                                        : request.status === "approved"
                                          ? "#065f46"
                                          : "#991b1b",
                                  }}
                                >
                                  {request.status.toUpperCase()}
                                </span>
                              </td>
                              <td
                                style={{ padding: "12px", textAlign: "center" }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    gap: "8px",
                                    justifyContent: "center",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  {request.status === "pending" && (
                                    <>
                                      <button
                                        onClick={() => handleEdit(request)}
                                        style={{
                                          padding: "6px 12px",
                                          background: "#f59e0b",
                                          color: "white",
                                          border: "none",
                                          borderRadius: "4px",
                                          cursor: "pointer",
                                          fontSize: "12px",
                                        }}
                                      >
                                        ✏️ Edit
                                      </button>
                                    </>
                                  )}
                                  <button
                                    onClick={() =>
                                      handleDelete(
                                        request.id,
                                        request.farmer_name,
                                      )
                                    }
                                    style={{
                                      padding: "6px 12px",
                                      background: "#6b7280",
                                      color: "white",
                                      border: "none",
                                      borderRadius: "4px",
                                      cursor: "pointer",
                                      fontSize: "12px",
                                    }}
                                  >
                                    🗑️ Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr
                        style={{
                          background: "#f9fafb",
                          borderTop: "2px solid #e5e7eb",
                          fontWeight: "600",
                        }}
                      >
                        <td colSpan={2} style={{ padding: "12px" }}>
                          TOTALS
                        </td>
                        <td style={{ padding: "12px", textAlign: "center" }}>
                          {sumRequestFieldsForList(
                            filteredRequests,
                            FERTILIZER_REQUEST_FIELDS,
                          ).toFixed(2)}
                        </td>
                        <td style={{ padding: "12px", textAlign: "center" }}>
                          {sumRequestFieldsForList(
                            filteredRequests,
                            SEED_REQUEST_FIELDS,
                          ).toFixed(2)}
                        </td>
                        <td colSpan={3}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Edit Request Modal */}
      {editingRequest && (
        <div className="jo-manage-requests-modal-overlay">
          <div className="jo-manage-requests-modal-content">
            {/* Modal Header */}
            <div className="jo-manage-requests-modal-header">
              <h2>Edit Farmer Request</h2>
              <button
                style={{ cursor: "pointer" }}
                onClick={handleCancelEdit}
                className="jo-manage-requests-modal-close"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="jo-manage-requests-modal-body">
              {/* Fertilizers Section */}
              <div className="jo-manage-requests-modal-section">
                <h4 className="jo-manage-requests-modal-section-title">
                  🌱 Fertilizers (bags)
                </h4>
                <div className="jo-manage-requests-modal-grid">
                  {visibleExtraFertilizerFields.map((item) => (
                    <div
                      key={item.requestField}
                      className="jo-manage-requests-modal-field"
                    >
                      <label>{item.label}</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={Number(editFormData[item.requestField]) || 0}
                        onChange={(e) =>
                          updateEditQuantity(
                            item.requestField,
                            e.target.value,
                            false,
                          )
                        }
                        className="jo-manage-requests-modal-input"
                      />
                    </div>
                  ))}
                  {visibleFertilizerFields.map((item) => (
                    <div
                      key={item.requestField}
                      className="jo-manage-requests-modal-field"
                    >
                      <label>{item.label}</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={Number(editFormData[item.requestField]) || 0}
                        onChange={(e) =>
                          updateEditQuantity(
                            item.requestField,
                            e.target.value,
                            false,
                          )
                        }
                        className="jo-manage-requests-modal-input"
                      />
                    </div>
                  ))}
                  {visibleExtraFertilizerFields.length === 0 &&
                    visibleFertilizerFields.length === 0 && (
                      <p className="jo-manage-requests-modal-empty-message">
                        No fertilizer request values were submitted.
                      </p>
                    )}
                </div>
              </div>

              {/* Seeds Section */}
              <div className="jo-manage-requests-modal-section">
                <h4 className="jo-manage-requests-modal-section-title">
                  🌾 Seeds (kg)
                </h4>
                <div className="jo-manage-requests-modal-grid">
                  {visibleSeedFields.map((item) => (
                    <div
                      key={item.requestField}
                      className="jo-manage-requests-modal-field"
                    >
                      <label>{item.label}</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        value={Number(editFormData[item.requestField]) || 0}
                        onChange={(e) =>
                          updateEditQuantity(
                            item.requestField,
                            e.target.value,
                            true,
                          )
                        }
                        className="jo-manage-requests-modal-input"
                      />
                    </div>
                  ))}
                  {visibleSeedFields.length === 0 && (
                    <p className="jo-manage-requests-modal-empty-message">
                      No seed request values were submitted.
                    </p>
                  )}
                </div>
              </div>

              {/* Notes Section */}
              {/* COMMENT: Changed from 'notes' to 'request_notes' to match database column */}
              <div className="jo-manage-requests-modal-section">
                <h4 className="jo-manage-requests-modal-section-title">
                  📝 Request Notes (Optional)
                </h4>
                <textarea
                  value={editFormData.request_notes || ""}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      request_notes: e.target.value,
                    })
                  }
                  rows={3}
                  className="jo-manage-requests-modal-textarea"
                  placeholder="Add any notes about this request..."
                />
              </div>

              {/* Action Buttons */}
              <div className="jo-manage-requests-modal-actions">
                <button
                  onClick={handleSaveEdit}
                  className="jo-manage-requests-modal-btn save"
                >
                  💾 Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suggestions Modal */}
      {showSuggestionsModal && (
        <div className="jo-manage-requests-modal-overlay">
          <div
            className="jo-manage-requests-modal-content"
            style={{ maxWidth: "900px", maxHeight: "85vh", width: "90%" }}
          >
            <div className="jo-manage-requests-modal-header">
              <h2>💡 Suggestions Overview</h2>
            </div>

            <div
              style={{
                overflowY: "auto",
                maxHeight: "calc(80vh - 140px)",
                padding: "20px",
              }}
            >
              {Object.keys(alternatives).length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "60px 20px",
                    color: "#6b7280",
                  }}
                >
                  <div style={{ fontSize: "64px", marginBottom: "20px" }}>
                    📋
                  </div>
                  <h4
                    style={{
                      margin: "0 0 12px 0",
                      color: "#374151",
                      fontSize: "20px",
                      fontWeight: 600,
                    }}
                  >
                    No Suggestions Available
                  </h4>
                  <p style={{ margin: 0, color: "#9ca3af", fontSize: "15px" }}>
                    There are no shortage-based suggestions at this time.
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "20px",
                  }}
                >
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

                    return (
                      <div
                        key={requestId}
                        style={{
                          background: "white",
                          border: "2px solid #e5e7eb",
                          borderRadius: "12px",
                          overflow: "hidden",
                          transition: "all 0.3s ease",
                          boxShadow: isExpanded
                            ? "0 10px 30px rgba(0,0,0,0.15)"
                            : "0 2px 8px rgba(0,0,0,0.08)",
                        }}
                      >
                        {/* Farmer Header */}
                        <div
                          onClick={() =>
                            setExpandedFarmerInModal(
                              isExpanded ? null : requestId,
                            )
                          }
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "16px",
                            padding: "20px",
                            background:
                              "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                        >
                          {/* Farmer Info */}
                          <div
                            style={{
                              flex: 1,
                              display: "flex",
                              flexDirection: "column",
                              gap: "6px",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "18px",
                                fontWeight: 700,
                                color: "white",
                                letterSpacing: "0.3px",
                              }}
                            >
                              Farmer:{" "}
                              {altData.farmer_name || request.farmer_name}
                            </span>
                            <span
                              style={{
                                fontSize: "14px",
                                color: "rgba(255,255,255,0.9)",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              📍 Farm: Barangay {request.barangay}
                            </span>
                          </div>

                          {/* Toggle Icon */}
                          <div
                            style={{
                              fontSize: "24px",
                              color: "white",
                              transition: "transform 0.3s ease",
                              transform: isExpanded
                                ? "rotate(180deg)"
                                : "rotate(0deg)",
                            }}
                          >
                            ▼
                          </div>
                        </div>

                        {/* Expandable Details */}
                        {isExpanded && (
                          <div style={{ padding: "24px" }}>
                            {altData.suggestions.suggestions.map(
                              (suggestion: any, idx: number) => {
                                const selectedAlt =
                                  selectedAlternative[requestId]
                                    ?.suggestionIdx === idx
                                    ? suggestion.alternatives[
                                        selectedAlternative[requestId]
                                          .alternativeIdx
                                      ]
                                    : null;

                                return (
                                  <div
                                    key={idx}
                                    style={{
                                      marginBottom:
                                        idx <
                                        altData.suggestions.suggestions.length -
                                          1
                                          ? "24px"
                                          : "0",
                                    }}
                                  >
                                    {/* Farm Input Summary */}
                                    <div style={{ marginBottom: "20px" }}>
                                      <h4
                                        style={{
                                          margin: "0 0 16px 0",
                                          fontSize: "15px",
                                          fontWeight: 600,
                                          color: "#374151",
                                          textTransform: "uppercase",
                                          letterSpacing: "0.5px",
                                        }}
                                      >
                                        Farm Input Summary:
                                      </h4>
                                      <div
                                        style={{
                                          display: "grid",
                                          gridTemplateColumns: "1fr 1fr",
                                          gap: "16px",
                                        }}
                                      >
                                        {/* Shortage Box */}
                                        <div
                                          style={{
                                            background:
                                              "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)",
                                            border: "2px solid #fca5a5",
                                            borderRadius: "10px",
                                            padding: "18px",
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "8px",
                                          }}
                                        >
                                          <div
                                            style={{
                                              fontSize: "13px",
                                              fontWeight: 600,
                                              color: "#991b1b",
                                              textTransform: "uppercase",
                                              letterSpacing: "0.5px",
                                            }}
                                          >
                                            ❌ Shortage:
                                          </div>
                                          <div
                                            style={{
                                              fontSize: "18px",
                                              fontWeight: 700,
                                              color: "#dc2626",
                                            }}
                                          >
                                            {suggestion.original_fertilizer_name ||
                                              suggestion.original_seed_name}
                                          </div>
                                          <div
                                            style={{
                                              fontSize: "14px",
                                              color: "#7f1d1d",
                                              marginTop: "4px",
                                            }}
                                          >
                                            Missing:{" "}
                                            <strong>
                                              {suggestion.shortage_bags ||
                                                suggestion.shortage_kg}{" "}
                                              {suggestion.category === "seed"
                                                ? "kg"
                                                : "bags"}
                                            </strong>
                                          </div>
                                        </div>

                                        {/* Requested Box */}
                                        <div
                                          style={{
                                            background:
                                              "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)",
                                            border: "2px solid #93c5fd",
                                            borderRadius: "10px",
                                            padding: "18px",
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "8px",
                                          }}
                                        >
                                          <div
                                            style={{
                                              fontSize: "13px",
                                              fontWeight: 600,
                                              color: "#1e3a8a",
                                              textTransform: "uppercase",
                                              letterSpacing: "0.5px",
                                            }}
                                          >
                                            📝 Requested:
                                          </div>
                                          <div
                                            style={{
                                              fontSize: "18px",
                                              fontWeight: 700,
                                              color: "#2563eb",
                                            }}
                                          >
                                            {suggestion.original_fertilizer_name ||
                                              suggestion.original_seed_name}
                                          </div>
                                          <div
                                            style={{
                                              fontSize: "14px",
                                              color: "#1e40af",
                                              marginTop: "4px",
                                            }}
                                          >
                                            Total:{" "}
                                            <strong>
                                              {suggestion.requested_bags ||
                                                suggestion.requested_kg}{" "}
                                              {suggestion.category === "seed"
                                                ? "kg"
                                                : "bags"}
                                            </strong>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Suggested Substitutes */}
                                    {suggestion.alternatives &&
                                    suggestion.alternatives.length > 0 ? (
                                      <div>
                                        <h4
                                          style={{
                                            margin: "0 0 12px 0",
                                            fontSize: "15px",
                                            fontWeight: 600,
                                            color: "#374151",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.5px",
                                          }}
                                        >
                                          Suggested Substitutes:
                                        </h4>

                                        <div
                                          style={{
                                            display: "flex",
                                            gap: "10px",
                                            alignItems: "flex-start",
                                          }}
                                        >
                                          {/* Dropdown */}
                                          <select
                                            value={
                                              selectedAlternative[requestId]
                                                ?.suggestionIdx === idx
                                                ? selectedAlternative[requestId]
                                                    .alternativeIdx
                                                : ""
                                            }
                                            onChange={(e) => {
                                              const altIdx = parseInt(
                                                e.target.value,
                                              );
                                              if (!isNaN(altIdx)) {
                                                setSelectedAlternative(
                                                  (prev) => ({
                                                    ...prev,
                                                    [requestId]: {
                                                      suggestionIdx: idx,
                                                      alternativeIdx: altIdx,
                                                    },
                                                  }),
                                                );
                                              }
                                            }}
                                            style={{
                                              flex: 1,
                                              padding: "10px 12px",
                                              border: "2px solid #d1d5db",
                                              borderRadius: "6px",
                                              fontSize: "13px",
                                              background: "white",
                                              cursor: "pointer",
                                              color: "#374151",
                                              fontWeight: 500,
                                              transition: "all 0.2s ease",
                                              outline: "none",
                                            }}
                                          >
                                            <option
                                              value=""
                                              style={{ color: "#9ca3af" }}
                                            >
                                              ▼ Select a substitute...
                                            </option>
                                            {suggestion.alternatives.map(
                                              (alt: any, altIdx: number) => (
                                                <option
                                                  key={altIdx}
                                                  value={altIdx}
                                                  style={{ padding: "8px 0" }}
                                                >
                                                  {alt.substitute_name} -{" "}
                                                  {alt.needed_bags ||
                                                    alt.needed_kg}{" "}
                                                  {suggestion.category ===
                                                  "seed"
                                                    ? "kg"
                                                    : "bags"}
                                                  (Avail:{" "}
                                                  {alt.available_bags ||
                                                    alt.available_kg}
                                                  ,
                                                  {(
                                                    alt.confidence_score * 100
                                                  ).toFixed(0)}
                                                  %)
                                                  {alt.can_fulfill
                                                    ? " ✅"
                                                    : " ⚠️"}
                                                </option>
                                              ),
                                            )}
                                          </select>

                                          {/* Submit Button */}
                                          <button
                                            onClick={() =>
                                              applyAlternative(requestId)
                                            }
                                            disabled={
                                              !selectedAlternative[requestId] ||
                                              selectedAlternative[requestId]
                                                ?.suggestionIdx !== idx ||
                                              applyingAlternative[requestId]
                                            }
                                            style={{
                                              padding: "10px 16px",
                                              background:
                                                selectedAlternative[requestId]
                                                  ?.suggestionIdx === idx &&
                                                !applyingAlternative[requestId]
                                                  ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                                                  : "#d1d5db",
                                              color: "white",
                                              border: "none",
                                              borderRadius: "6px",
                                              cursor:
                                                selectedAlternative[requestId]
                                                  ?.suggestionIdx === idx &&
                                                !applyingAlternative[requestId]
                                                  ? "pointer"
                                                  : "not-allowed",
                                              fontSize: "13px",
                                              fontWeight: 600,
                                              transition: "all 0.2s ease",
                                              whiteSpace: "nowrap",
                                              boxShadow:
                                                selectedAlternative[requestId]
                                                  ?.suggestionIdx === idx
                                                  ? "0 4px 12px rgba(16, 185, 129, 0.3)"
                                                  : "none",
                                            }}
                                          >
                                            {applyingAlternative[requestId]
                                              ? "⏳ Applying..."
                                              : "✅ Submit"}
                                          </button>
                                        </div>

                                        {/* Selected Alternative Details */}
                                        {selectedAlt && (
                                          <div
                                            style={{
                                              marginTop: "16px",
                                              padding: "16px",
                                              background:
                                                "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
                                              border: "2px solid #86efac",
                                              borderRadius: "8px",
                                            }}
                                          >
                                            <div
                                              style={{
                                                fontSize: "13px",
                                                fontWeight: 600,
                                                color: "#166534",
                                                marginBottom: "12px",
                                                textTransform: "uppercase",
                                                letterSpacing: "0.5px",
                                              }}
                                            >
                                              ✨ Selected Substitute Details:
                                            </div>
                                            <div
                                              style={{
                                                display: "grid",
                                                gridTemplateColumns: "1fr 1fr",
                                                gap: "12px",
                                                fontSize: "14px",
                                                color: "#15803d",
                                              }}
                                            >
                                              <div>
                                                <strong>Name:</strong>{" "}
                                                {selectedAlt.substitute_name}
                                              </div>
                                              <div>
                                                <strong>Needed:</strong>{" "}
                                                {selectedAlt.needed_bags ||
                                                  selectedAlt.needed_kg}{" "}
                                                {suggestion.category === "seed"
                                                  ? "kg"
                                                  : "bags"}
                                              </div>
                                              <div>
                                                <strong>Available:</strong>{" "}
                                                {selectedAlt.available_bags ||
                                                  selectedAlt.available_kg}{" "}
                                                {suggestion.category === "seed"
                                                  ? "kg"
                                                  : "bags"}
                                              </div>
                                              <div>
                                                <strong>Confidence:</strong>{" "}
                                                {(
                                                  selectedAlt.confidence_score *
                                                  100
                                                ).toFixed(0)}
                                                %
                                              </div>
                                            </div>
                                            {selectedAlt.explanation && (
                                              <div
                                                style={{
                                                  marginTop: "12px",
                                                  padding: "12px",
                                                  background: "white",
                                                  borderRadius: "6px",
                                                  fontSize: "13px",
                                                  color: "#166534",
                                                  fontStyle: "italic",
                                                  lineHeight: "1.6",
                                                }}
                                              >
                                                💡{" "}
                                                <strong>
                                                  Why this suggestion?
                                                </strong>{" "}
                                                {selectedAlt.explanation}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div
                                        style={{
                                          padding: "20px",
                                          background:
                                            "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)",
                                          border: "2px solid #fca5a5",
                                          borderRadius: "10px",
                                          color: "#991b1b",
                                        }}
                                      >
                                        <div
                                          style={{
                                            fontSize: "15px",
                                            fontWeight: 700,
                                            marginBottom: "12px",
                                          }}
                                        >
                                          ❌ No Suitable Alternatives Available
                                        </div>
                                        {suggestion.recommendation
                                          ?.next_steps && (
                                          <div style={{ fontSize: "14px" }}>
                                            <strong>
                                              Recommended Actions:
                                            </strong>
                                            <ul
                                              style={{
                                                margin: "8px 0 0 0",
                                                paddingLeft: "24px",
                                                lineHeight: "1.8",
                                              }}
                                            >
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
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="jo-manage-requests-modal-actions">
              <button
                onClick={() => {
                  setShowSuggestionsModal(false);
                  setExpandedFarmerInModal(null);
                }}
                style={{
                  padding: "10px 24px",
                  background: "#6b7280",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 500,
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deleteTarget && (
        <div className="jo-manage-delete-modal-overlay">
          <div className="jo-manage-delete-modal">
            <div className="jo-manage-delete-modal-icon">⚠️</div>
            <h3 className="jo-manage-delete-modal-title">Confirm Delete</h3>
            <p className="jo-manage-delete-modal-message">
              Are you sure you want to delete the request from{" "}
              <strong>{deleteTarget.name}</strong>?
            </p>
            <p className="jo-manage-delete-modal-warning">
              This action cannot be undone.
            </p>
            <div className="jo-manage-delete-modal-actions">
              <button
                className="jo-manage-delete-modal-btn cancel"
                onClick={cancelDelete}
              >
                Cancel
              </button>
              <button
                className="jo-manage-delete-modal-btn delete"
                onClick={confirmDelete}
              >
                Delete Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JoManageRequests;
