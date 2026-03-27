import React, { useState, useEffect, useMemo } from "react";
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
import "../../assets/css/admin css/AdminManageRequest.css";
import "../../components/layout/sidebarStyle.css";
import LogoImage from "../../assets/images/Logo.png";
import HomeIcon from "../../assets/images/home.png";
import RSBSAIcon from "../../assets/images/rsbsa.png";
import MasterlistIcon from "../../assets/images/approve.png";
import LogoutIcon from "../../assets/images/logout.png";
import IncentivesIcon from "../../assets/images/incentives.png";

// ─── Main Component ────────────────────────────────────────

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
  requested_jackpot_kg: number;
  requested_us88_kg: number;
  requested_th82_kg: number;
  requested_rh9000_kg: number;
  requested_lumping143_kg: number;
  requested_lp296_kg: number;
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
  muriate_potash_0_0_60_bags: number;
  jackpot_kg: number;
  us88_kg: number;
  th82_kg: number;
  rh9000_kg: number;
  lumping143_kg: number;
  lp296_kg: number;
}

const ManageRequests: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { allocationId } = useParams<{ allocationId: string }>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  // Suggestions Modal Feature
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
  const [expandedFarmerInModal, setExpandedFarmerInModal] = useState<
    number | null
  >(null);

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
  const [, setAutoSuggestionsCount] = useState<number>(0);
  const [, setNewSuggestionsCount] = useState<number>(0);

  const isActive = (path: string) => location.pathname === path;
  const normalizeStatus = (status: string | null | undefined) =>
    String(status ?? "")
      .trim()
      .toLowerCase();
  const hasStatus = (
    request: Pick<FarmerRequest, "status">,
    ...statuses: string[]
  ) => statuses.includes(normalizeStatus(request.status));
  const getFertilizerTotal = (requestList: FarmerRequest[]) =>
    requestList.reduce(
      (sum, r) =>
        sum +
        Number(r.requested_urea_bags || 0) +
        Number(r.requested_complete_14_bags || 0) +
        Number(r.requested_ammonium_sulfate_bags || 0) +
        Number(r.requested_muriate_potash_bags || 0),
      0,
    );
  const getSeedTotal = (requestList: FarmerRequest[]) =>
    requestList.reduce(
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
  const approvedRequests = useMemo(
    () => requests.filter((r) => hasStatus(r, "approved")),
    [requests],
  );
  const rejectedRequests = useMemo(
    () => requests.filter((r) => hasStatus(r, "rejected")),
    [requests],
  );

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

  const fetchAllocation = async () => {
    try {
      const response = await getAllocations();
      if (!response.error) {
        const allocations = response.data || [];
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
      const allocations = allocationResponse.data || [];
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

    const pendingRequests = requestsList.filter((r) => hasStatus(r, "pending"));
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
      filtered = filtered.filter(
        (req) => normalizeStatus(req.status) === normalizeStatus(statusFilter),
      );
    }

    // Barangay filter
    if (barangayFilter !== "all") {
      filtered = filtered.filter((req) => req.barangay === barangayFilter);
    }

    setFilteredRequests(filtered);
  };

  const handleDelete = async (id: number, farmerName: string) => {
    if (
      !confirm(
        `Are you sure you want to delete the request from ${farmerName}?`,
      )
    ) {
      return;
    }

    try {
      const response = await deleteFarmerRequest(id);

      if (!response.error) {
        alert("✅ Request deleted successfully");
        fetchRequests();
      } else {
        alert("❌ Failed to delete request");
      }
    } catch (error) {
      console.error("Error deleting request:", error);
      alert("❌ Error deleting request");
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      const response = await updateFarmerRequest(id, { status: newStatus });

      if (!response.error) {
        // If status is rejected, hide alternatives panel
        if (newStatus === "rejected") {
          setShowAlternatives((prev) => ({ ...prev, [id]: false }));
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
        alert(`✅ Status updated to ${newStatus}`);
        fetchRequests();
      } else {
        alert("❌ Failed to update status");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert("❌ Error updating status");
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
        console.log("✅ Distribution log created automatically");
      } else {
        console.error("❌ Failed to create distribution log");
      }
    } catch (error) {
      console.error("Error creating distribution log:", error);
    }
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

  // Edit request functionality
  const handleEdit = (request: FarmerRequest) => {
    setEditingRequest(request.id);
    // COMMENT: Using request_notes instead of notes (notes column doesn't exist in DB)
    setEditFormData({
      requested_urea_bags: request.requested_urea_bags,
      requested_complete_14_bags: request.requested_complete_14_bags,
      requested_ammonium_sulfate_bags: request.requested_ammonium_sulfate_bags,
      requested_muriate_potash_bags: request.requested_muriate_potash_bags,
      requested_jackpot_kg: request.requested_jackpot_kg,
      requested_us88_kg: request.requested_us88_kg,
      requested_th82_kg: request.requested_th82_kg,
      requested_rh9000_kg: request.requested_rh9000_kg,
      requested_lumping143_kg: request.requested_lumping143_kg,
      requested_lp296_kg: request.requested_lp296_kg,
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

      alert("✅ Request updated successfully!");
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

    // === FERTILIZER SHORTAGES ===
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

    // === SEED SHORTAGES ===
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

    // Debug logging
    if (hasStatus(request, "pending")) {
      console.log(`🔍 Shortage Check for ${request.farmer_name}:`, {
        fertilizers: {
          urea: {
            requested: requestedUrea,
            remaining: remainingUrea,
            shortage: requestedUrea > remainingUrea,
          },
          complete: {
            requested: requestedComplete,
            remaining: remainingComplete,
            shortage: requestedComplete > remainingComplete,
          },
          amSul: {
            requested: requestedAmSul,
            remaining: remainingAmSul,
            shortage: requestedAmSul > remainingAmSul,
          },
          potash: {
            requested: requestedPotash,
            remaining: remainingPotash,
            shortage: requestedPotash > remainingPotash,
          },
        },
        seeds: {
          jackpot: {
            requested: requestedJackpot,
            remaining: remainingJackpot,
            shortage: requestedJackpot > remainingJackpot,
          },
          us88: {
            requested: requestedUs88,
            remaining: remainingUs88,
            shortage: requestedUs88 > remainingUs88,
          },
          th82: {
            requested: requestedTh82,
            remaining: remainingTh82,
            shortage: requestedTh82 > remainingTh82,
          },
          rh9000: {
            requested: requestedRh9000,
            remaining: remainingRh9000,
            shortage: requestedRh9000 > remainingRh9000,
          },
          lumping143: {
            requested: requestedLumping143,
            remaining: remainingLumping143,
            shortage: requestedLumping143 > remainingLumping143,
          },
          lp296: {
            requested: requestedLp296,
            remaining: remainingLp296,
            shortage: requestedLp296 > remainingLp296,
          },
        },
      });
    }

    // Return true if any fertilizer OR seed shortage exists
    return fertilizerShortage || seedShortage;
  };

  // Keep helper actions available for table actions/edit workflows.
  void handleDelete;
  void handleStatusChange;
  void handleEdit;
  void formatSeasonName;

  return (
    <div className="admin-req-page-container">
      <style>{`
                @keyframes pulse {
                    0%, 100% {
                        transform: scale(1);
                        opacity: 1;
                    }
                    50% {
                        transform: scale(1.1);
                        opacity: 0.8;
                    }
                }
            `}</style>
      <div className="admin-req-page has-mobile-sidebar">
        {/* Sidebar */}
        <div className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
          <nav className="sidebar-nav">
            <div className="sidebar-logo">
              <img src={LogoImage} alt="Logo" />
            </div>

            <button
              className={`sidebar-nav-item ${isActive("/dashboard") ? "active" : ""}`}
              onClick={() => navigate("/dashboard")}
            >
              <span className="nav-icon">
                <img src={HomeIcon} alt="Home" />
              </span>
              <span className="nav-text">Home</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/rsbsa") ? "active" : ""}`}
              onClick={() => navigate("/rsbsa")}
            >
              <span className="nav-icon">
                <img src={RSBSAIcon} alt="RSBSA" />
              </span>
              <span className="nav-text">RSBSA</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/audit-trail") ? "active" : ""}`}
              onClick={() => navigate("/audit-trail")}
            >
              <span className="nav-icon">📋</span>
              <span className="nav-text">Audit Trail</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/incentives") ? "active" : ""}`}
              onClick={() => navigate("/incentives")}
            >
              <span className="nav-icon">
                <img src={IncentivesIcon} alt="Incentives" />
              </span>
              <span className="nav-text">Subsidy</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive("/masterlist") ? "active" : ""}`}
              onClick={() => navigate("/masterlist")}
            >
              <span className="nav-icon">
                <img src={MasterlistIcon} alt="Masterlist" />
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
        <div className="admin-req-main-content">
          <div className="tech-incent-mobile-header">
            <button
              className="tech-incent-hamburger"
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              ☰
            </button>
            <div className="tech-incent-mobile-title">Admin Requests</div>
          </div>

          <div className="admin-req-dashboard-header">
            <div>
              <h2 className="admin-req-page-header">View Farmer Requests</h2>
            </div>
            <button
              className="admin-req-btn-back"
              onClick={() => navigate("/incentives")}
            >
              ← Back to Allocations
            </button>
          </div>

          <div className="admin-req-content-card">
            {/* Filters */}
            <div className="admin-req-filters">
              <input
                type="text"
                placeholder="🔍 Search by farmer name or barangay..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="admin-req-search-input"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="admin-req-filter-select"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <select
                value={barangayFilter}
                onChange={(e) => setBarangayFilter(e.target.value)}
                className="admin-req-filter-select"
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
            <div className="admin-req-comparison-grid">
              {/* Regional Allocation Card */}
              <div className="admin-req-comparison-card admin-req-card-allocation">
                <h3 className="admin-req-card-header allocation">
                  📦 Regional Allocation (Total Received)
                </h3>
                <div className="admin-req-card-content">
                  <div className="admin-req-stat-box fertilizers">
                    <span className="admin-req-stat-label fertilizers">
                      🌱 Total Fertilizers
                    </span>
                    <span className="admin-req-stat-value fertilizers">
                      {allocation
                        ? (
                            Number(allocation.urea_46_0_0_bags || 0) +
                            Number(allocation.complete_14_14_14_bags || 0) +
                            Number(
                              allocation.ammonium_sulfate_21_0_0_bags || 0,
                            ) +
                            Number(allocation.muriate_potash_0_0_60_bags || 0)
                          ).toFixed(2)
                        : "0.00"}{" "}
                      bags
                    </span>
                  </div>
                  <div className="admin-req-stat-box seeds">
                    <span className="admin-req-stat-label seeds">
                      🌾 Total Seeds
                    </span>
                    <span className="admin-req-stat-value seeds">
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
              <div className="admin-req-comparison-card admin-req-card-total-requests">
                <h3 className="admin-req-card-header total-requests">
                  📊 Total Farmer Requests
                </h3>
                <div className="admin-req-card-content">
                  <div className="admin-req-stat-box fertilizers">
                    <span className="admin-req-stat-label fertilizers">
                      🌱 Total Fertilizers Requested
                    </span>
                    <span className="admin-req-stat-value fertilizers">
                      {Number(getFertilizerTotal(filteredRequests)).toFixed(2)}{" "}
                      bags
                    </span>
                  </div>
                  <div className="admin-req-stat-box seeds">
                    <span className="admin-req-stat-label seeds">
                      🌾 Total Seeds Requested
                    </span>
                    <span className="admin-req-stat-value seeds">
                      {Number(getSeedTotal(filteredRequests)).toFixed(2)} kg
                    </span>
                  </div>
                </div>
              </div>

              {/* Farmer Requests Card */}
              <div className="admin-req-comparison-card admin-req-card-approved">
                <h3 className="admin-req-card-header approved">
                  ✅ Approved Farmer Requests
                </h3>
                <div className="admin-req-card-content">
                  <div className="admin-req-stat-box fertilizers">
                    <span className="admin-req-stat-label fertilizers">
                      🌱 Total Fertilizers
                    </span>
                    <span className="admin-req-stat-value fertilizers">
                      {Number(getFertilizerTotal(approvedRequests)).toFixed(2)}{" "}
                      bags
                    </span>
                  </div>
                  <div className="admin-req-stat-box seeds">
                    <span className="admin-req-stat-label seeds">
                      🌾 Total Seeds
                    </span>
                    <span className="admin-req-stat-value seeds">
                      {Number(getSeedTotal(approvedRequests)).toFixed(2)} kg
                    </span>
                  </div>
                </div>
              </div>

              {/* Rejected Farmer Requests Card */}
              <div className="admin-req-comparison-card admin-req-card-rejected">
                <h3 className="admin-req-card-header rejected">
                  ❌ Rejected Farmer Requests
                </h3>
                <div className="admin-req-card-content">
                  <div className="admin-req-stat-box rejected">
                    <span className="admin-req-stat-label rejected">
                      🌱 Total Fertilizers
                    </span>
                    <span className="admin-req-stat-value rejected">
                      {Number(getFertilizerTotal(rejectedRequests)).toFixed(2)}{" "}
                      bags
                    </span>
                  </div>
                  <div className="admin-req-stat-box rejected">
                    <span className="admin-req-stat-label rejected">
                      🌾 Total Seeds
                    </span>
                    <span className="admin-req-stat-value rejected">
                      {Number(getSeedTotal(rejectedRequests)).toFixed(2)} kg
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="admin-req-summary-grid">
              <div className="admin-req-summary-card total">
                <div className="admin-req-summary-label">Total Requests</div>
                <div className="admin-req-summary-value total">
                  {filteredRequests.length}
                </div>
              </div>
              <div className="admin-req-summary-card pending">
                <div className="admin-req-summary-label pending">Pending</div>
                <div className="admin-req-summary-value pending">
                  {
                    filteredRequests.filter((r) => hasStatus(r, "pending"))
                      .length
                  }
                </div>
              </div>
              <div className="admin-req-summary-card approved">
                <div className="admin-req-summary-label approved">Approved</div>
                <div className="admin-req-summary-value approved">
                  {
                    filteredRequests.filter((r) => hasStatus(r, "approved"))
                      .length
                  }
                </div>
              </div>
              <div className="admin-req-summary-card rejected">
                <div className="admin-req-summary-label rejected">Rejected</div>
                <div className="admin-req-summary-value rejected">
                  {
                    filteredRequests.filter((r) => hasStatus(r, "rejected"))
                      .length
                  }
                </div>
              </div>
            </div>

            {loading ? (
              <div className="admin-req-loading-message">
                Loading requests...
              </div>
            ) : error ? (
              <div className="admin-req-error-state">
                <div className="admin-req-error-icon">⚠️</div>
                <h3>Error Loading Requests</h3>
                <p>{error}</p>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="admin-req-empty-state">
                <div className="admin-req-empty-icon">📝</div>
                <h3>No Farmer Requests</h3>
                <p>No requests found matching your filters</p>
              </div>
            ) : (
              <>
                {/* Info Box for Visual Indicators */}
                {filteredRequests.filter(
                  (r) => hasStatus(r, "pending") && checkPotentialShortage(r),
                ).length > 0 && (
                  <div className="admin-req-info-box">
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
                        Alternative fertilizer and seed options have been
                        automatically loaded based on agronomic equivalency.
                      </p>
                    </div>
                  </div>
                )}

                <div style={{ overflowX: "auto" }}>
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
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRequests.map((request) => {
                        const totalFertilizer =
                          Number(request.requested_urea_bags || 0) +
                          Number(request.requested_complete_14_bags || 0) +
                          Number(request.requested_ammonium_sulfate_bags || 0) +
                          Number(request.requested_muriate_potash_bags || 0);

                        const totalSeeds =
                          Number(request.requested_jackpot_kg || 0) +
                          Number(request.requested_us88_kg || 0) +
                          Number(request.requested_th82_kg || 0) +
                          Number(request.requested_rh9000_kg || 0) +
                          Number(request.requested_lumping143_kg || 0) +
                          Number(request.requested_lp296_kg || 0);

                        // Check if this request might have shortages
                        const hasShortage =
                          hasStatus(request, "pending") &&
                          checkPotentialShortage(request);
                        const normalizedStatus = normalizeStatus(
                          request.status,
                        );

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
                                {totalFertilizer.toFixed(2)}
                                {hasShortage && (
                                  <span title="Alternatives auto-displayed below"></span>
                                )}
                              </td>
                              <td
                                style={{ padding: "12px", textAlign: "center" }}
                              >
                                {totalSeeds.toFixed(2)}
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
                                      normalizedStatus === "pending"
                                        ? "#fef3c7"
                                        : normalizedStatus === "approved"
                                          ? "#d1fae5"
                                          : "#fee2e2",
                                    color:
                                      normalizedStatus === "pending"
                                        ? "#92400e"
                                        : normalizedStatus === "approved"
                                          ? "#065f46"
                                          : "#991b1b",
                                  }}
                                >
                                  {request.status.toUpperCase()}
                                </span>
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
                          {(
                            getTotalRequested("requested_urea_bags") +
                            getTotalRequested("requested_complete_14_bags") +
                            getTotalRequested(
                              "requested_ammonium_sulfate_bags",
                            ) +
                            getTotalRequested("requested_muriate_potash_bags")
                          ).toFixed(2)}
                        </td>
                        <td style={{ padding: "12px", textAlign: "center" }}>
                          {(
                            getTotalRequested("requested_jackpot_kg") +
                            getTotalRequested("requested_us88_kg") +
                            getTotalRequested("requested_th82_kg") +
                            getTotalRequested("requested_rh9000_kg") +
                            getTotalRequested("requested_lumping143_kg") +
                            getTotalRequested("requested_lp296_kg")
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
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "600px",
              width: "90%",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <h3
              style={{
                marginBottom: "20px",
                fontSize: "20px",
                fontWeight: "600",
              }}
            >
              Edit Farmer Request
            </h3>

            {/* Fertilizers Section */}
            <div style={{ marginBottom: "24px" }}>
              <h4
                style={{
                  marginBottom: "12px",
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "#374151",
                }}
              >
                Fertilizers (bags)
              </h4>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontSize: "13px",
                      color: "#6b7280",
                    }}
                  >
                    Urea (46-0-0)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.requested_urea_bags || 0}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        requested_urea_bags: Number(e.target.value),
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontSize: "13px",
                      color: "#6b7280",
                    }}
                  >
                    Complete (14-14-14)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.requested_complete_14_bags || 0}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        requested_complete_14_bags: Number(e.target.value),
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontSize: "13px",
                      color: "#6b7280",
                    }}
                  >
                    Ammonium Sulfate (21-0-0)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.requested_ammonium_sulfate_bags || 0}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        requested_ammonium_sulfate_bags: Number(e.target.value),
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontSize: "13px",
                      color: "#6b7280",
                    }}
                  >
                    Muriate of Potash (0-0-60)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.requested_muriate_potash_bags || 0}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        requested_muriate_potash_bags: Number(e.target.value),
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Seeds Section */}
            <div style={{ marginBottom: "24px" }}>
              <h4
                style={{
                  marginBottom: "12px",
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "#374151",
                }}
              >
                Seeds (kg)
              </h4>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontSize: "13px",
                      color: "#6b7280",
                    }}
                  >
                    Jackpot
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.requested_jackpot_kg || 0}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        requested_jackpot_kg: Number(e.target.value),
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontSize: "13px",
                      color: "#6b7280",
                    }}
                  >
                    US-88
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.requested_us88_kg || 0}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        requested_us88_kg: Number(e.target.value),
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontSize: "13px",
                      color: "#6b7280",
                    }}
                  >
                    TH-82
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.requested_th82_kg || 0}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        requested_th82_kg: Number(e.target.value),
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontSize: "13px",
                      color: "#6b7280",
                    }}
                  >
                    RH-9000
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.requested_rh9000_kg || 0}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        requested_rh9000_kg: Number(e.target.value),
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontSize: "13px",
                      color: "#6b7280",
                    }}
                  >
                    Lumping-143
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.requested_lumping143_kg || 0}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        requested_lumping143_kg: Number(e.target.value),
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "4px",
                      fontSize: "13px",
                      color: "#6b7280",
                    }}
                  >
                    LP-296
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.requested_lp296_kg || 0}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        requested_lp296_kg: Number(e.target.value),
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Notes Section */}
            {/* COMMENT: Changed from 'notes' to 'request_notes' to match database column */}
            <div style={{ marginBottom: "24px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "4px",
                  fontSize: "13px",
                  color: "#6b7280",
                }}
              >
                Request Notes (Optional)
              </label>
              <textarea
                value={editFormData.request_notes || ""}
                onChange={(e) =>
                  setEditFormData({
                    ...editFormData,
                    request_notes: e.target.value,
                  })
                }
                rows={3}
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  fontSize: "14px",
                  resize: "vertical",
                }}
                placeholder="Add any notes about this request..."
              />
            </div>

            {/* Action Buttons */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={handleCancelEdit}
                style={{
                  padding: "10px 20px",
                  background: "#6b7280",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                style={{
                  padding: "10px 20px",
                  background: "#10b981",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                💾 Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suggestions Modal */}
      {showSuggestionsModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: "12px",
              maxWidth: "900px",
              maxHeight: "85vh",
              width: "90%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "20px 24px",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "600" }}>
                💡 DSS Suggestions Overview
              </h2>
              <button
                onClick={() => {
                  setShowSuggestionsModal(false);
                  setExpandedFarmerInModal(null);
                }}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "#6b7280",
                  padding: "4px",
                }}
              >
                ×
              </button>
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
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                padding: "16px 24px",
                borderTop: "1px solid #e5e7eb",
              }}
            >
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
    </div>
  );
};

export default ManageRequests;
