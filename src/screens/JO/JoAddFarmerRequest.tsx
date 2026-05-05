import { supabase } from "../../supabase";
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getAllocations,
  getFarmerRequests,
  getRsbsaSubmissions,
  createFarmerRequest,
  resolveFertilizerShortageSuggestion,
  resolveSeedShortageSuggestion,
} from "../../api";
import {
  FERTILIZER_FIELD_MAPS,
  SEED_FIELD_MAPS,
  type ShortageFieldMap,
} from "../../constants/shortageFieldMaps";
import { detectActiveSeedId } from "../../utils/detectActiveSeedId";
import {
  getAuditLogger,
  AuditModule,
} from "../../components/Audit/auditLogger";
import "../../assets/css/jo css/JoAddFarmerRequestStyle.css";
import "../../components/layout/sidebarStyle.css";
import LogoImage from "../../assets/images/Logo.png";
import HomeIcon from "../../assets/images/home.png";
import RSBSAIcon from "../../assets/images/rsbsa.png";
import MasterlistIcon from "../../assets/images/approve.png";
import LogoutIcon from "../../assets/images/logout.png";
import IncentivesIcon from "../../assets/images/incentives.png";

interface Farmer {
  id: number;
  rsbsa_no: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  extension_name: string;
  barangay: string;
}

interface AllocationDetails {
  id: number;
  season: string;
  allocation_date: string;
  urea_46_0_0_bags?: number;
  complete_14_14_14_bags?: number;
  ammonium_sulfate_21_0_0_bags?: number;
  np_16_20_0_bags?: number;
  muriate_potash_0_0_60_bags?: number;
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
  jackpot_kg?: number;
  us88_kg?: number;
  th82_kg?: number;
  rh9000_kg?: number;
  lumping143_kg?: number;
  lp296_kg?: number;
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
  complete_16_16_16_bags?: number;
  rice_seeds_nsic_rc440_kg?: number;
  corn_seeds_hybrid_kg?: number;
  corn_seeds_opm_kg?: number;
  vegetable_seeds_kg?: number;
}

interface FarmerRequestForm {
  farmer_id: number;
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
  requested_np_16_20_0_bags: number;
  requested_rice_seeds_nsic_rc440_kg: number;
  requested_corn_seeds_hybrid_kg: number;
  requested_corn_seeds_opm_kg: number;
  requested_vegetable_seeds_kg: number;
  notes: string;
}

type RequestField = keyof Omit<FarmerRequestForm, "farmer_id" | "notes">;

type AllocationItem = Omit<
  ShortageFieldMap,
  "requestField" | "allocationField"
> & {
  allocationField: keyof AllocationDetails;
  requestField: RequestField;
};

type AllocationSummaryItem = {
  label: string;
  allocated: number;
  requested: number;
  remaining: number;
};

type InlineSuggestion = {
  title: string;
  message: string;
  status: "resolved" | "tier2_fallback" | "unresolvable" | "error";
};

const FERTILIZER_ITEMS: AllocationItem[] = FERTILIZER_FIELD_MAPS.map(
  (item) => ({
    ...item,
    allocationField: item.allocationField as keyof AllocationDetails,
    requestField: item.requestField as RequestField,
  }),
);

const SEED_ITEMS: AllocationItem[] = SEED_FIELD_MAPS.map((item) => ({
  ...item,
  allocationField: item.allocationField as keyof AllocationDetails,
  requestField: item.requestField as RequestField,
}));

const JoAddFarmerRequest: React.FC = () => {
  const navigate = useNavigate();
  const { allocationId } = useParams<{ allocationId: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [allocation, setAllocation] = useState<AllocationDetails | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [existingRequests, setExistingRequests] = useState<number[]>([]);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationType, setNotificationType] = useState<"success" | "error">(
    "success",
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const [showExceedConfirmModal, setShowExceedConfirmModal] = useState(false);
  const [liveExceedMessage, setLiveExceedMessage] = useState<string | null>(
    null,
  );

  const [formData, setFormData] = useState<FarmerRequestForm>({
    farmer_id: 0,
    requested_urea_bags: 0,
    requested_complete_14_bags: 0,
    requested_complete_16_bags: 0,
    requested_ammonium_sulfate_bags: 0,
    requested_ammonium_phosphate_bags: 0,
    requested_muriate_potash_bags: 0,
    requested_zinc_sulfate_bags: 0,
    requested_vermicompost_bags: 0,
    requested_chicken_manure_bags: 0,
    requested_rice_straw_kg: 0,
    requested_carbonized_rice_hull_bags: 0,
    requested_biofertilizer_liters: 0,
    requested_nanobiofertilizer_liters: 0,
    requested_organic_root_exudate_mix_liters: 0,
    requested_azolla_microphylla_kg: 0,
    requested_foliar_liquid_fertilizer_npk_liters: 0,
    requested_rice_seeds_nsic_rc160_kg: 0,
    requested_rice_seeds_nsic_rc222_kg: 0,
    requested_jackpot_kg: 0,
    requested_us88_kg: 0,
    requested_th82_kg: 0,
    requested_rh9000_kg: 0,
    requested_lumping143_kg: 0,
    requested_lp296_kg: 0,
    requested_mestiso_1_kg: 0,
    requested_mestiso_20_kg: 0,
    requested_mestiso_29_kg: 0,
    requested_mestiso_55_kg: 0,
    requested_mestiso_73_kg: 0,
    requested_mestiso_99_kg: 0,
    requested_mestiso_103_kg: 0,
    requested_nsic_rc402_kg: 0,
    requested_nsic_rc480_kg: 0,
    requested_nsic_rc216_kg: 0,
    requested_nsic_rc218_kg: 0,
    requested_nsic_rc506_kg: 0,
    requested_nsic_rc508_kg: 0,
    requested_nsic_rc512_kg: 0,
    requested_nsic_rc534_kg: 0,
    requested_tubigan_28_kg: 0,
    requested_tubigan_30_kg: 0,
    requested_tubigan_22_kg: 0,
    requested_sahod_ulan_2_kg: 0,
    requested_sahod_ulan_10_kg: 0,
    requested_salinas_6_kg: 0,
    requested_salinas_7_kg: 0,
    requested_salinas_8_kg: 0,
    requested_malagkit_5_kg: 0,
    requested_np_16_20_0_bags: 0,
    requested_rice_seeds_nsic_rc440_kg: 0,
    requested_corn_seeds_hybrid_kg: 0,
    requested_corn_seeds_opm_kg: 0,
    requested_vegetable_seeds_kg: 0,
    notes: "",
  });
  const [debouncedFormData, setDebouncedFormData] =
    useState<FarmerRequestForm>(formData);
  const [inlineSuggestions, setInlineSuggestions] = useState<
    Record<string, InlineSuggestion>
  >({});

  const [selectedFertilizerKeys, setSelectedFertilizerKeys] = useState<RequestField[]>([]);
  const [selectedSeedKeys, setSelectedSeedKeys] = useState<RequestField[]>([]);

  const fertilizerCategories = {
    Solid: [
      "Urea (46-0-0)", "Complete (14-14-14)", "Complete (16-16-16)",
      "Ammonium Sulfate (21-0-0)", "Muriate of Potash (0-0-60)", "16-20-0",
      "Ammonium Phosphate", "Zinc Sulfate", "Vermicompost", "Chicken Manure",
      "Rice Straw (incorporated)", "Carbonized Rice Hull (CRH)"
    ],
    Liquid: [
      "Biofertilizer (Liquid Concentrate)", "Nanobiofertilizer",
      "Organic Root Exudate Mix", "Azolla microphylla", "Foliar Liquid Fertilizer (NPK)"
    ]
  };

  const seedCategories = {
    Hybrid: [
      "Mestiso 1 (M1)", "Mestiso 20 (M20)", "Mestiso 29", "Mestiso 55",
      "Mestiso 73", "Mestiso 99", "Mestiso 103", "Jackpot", "US88", "TH82",
      "RH9000", "Corn Seeds (Hybrid)"
    ],
    Inbred: [
      "NSIC Rc 222", "NSIC Rc 402", "NSIC Rc 480", "NSIC Rc 216", "NSIC Rc 160",
      "NSIC Rc 218", "NSIC Rc 506", "NSIC Rc 508", "NSIC Rc 512", "NSIC Rc 534",
      "Tubigan 28", "Tubigan 30", "Tubigan 22", "Sahod Ulan 2", "Sahod Ulan 10",
      "Salinas 6", "Salinas 7", "Salinas 8", "Malagkit 5", "Lumping143", "LP296",
      "NSIC Rc 440", "Corn Seeds (OPM)", "Vegetable Seeds"
    ]
  };

  const addItem = (type: "fertilizer" | "seed", field: RequestField) => {
    if (type === "fertilizer") {
      if (!selectedFertilizerKeys.includes(field)) {
        setSelectedFertilizerKeys([...selectedFertilizerKeys, field]);
      }
    } else {
      if (!selectedSeedKeys.includes(field)) {
        setSelectedSeedKeys([...selectedSeedKeys, field]);
      }
    }
  };

  const removeItem = (type: "fertilizer" | "seed", field: RequestField) => {
    if (type === "fertilizer") {
      setSelectedFertilizerKeys(selectedFertilizerKeys.filter(k => k !== field));
    } else {
      setSelectedSeedKeys(selectedSeedKeys.filter(k => k !== field));
    }
    // Also reset the value in formData
    setFormData(prev => ({ ...prev, [field]: 0 }));
  };

  const isActive = (path: string) => location.pathname === path;

  const [currentUser, setCurrentUser] = useState<{
    firstName: string;
    lastName: string;
  } | null>(null);

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
    fetchAllocation();
    fetchFarmers();
  }, [allocationId]);

  useEffect(() => {
    if (allocation?.season) {
      fetchExistingRequests();
    }
  }, [allocation]);

  const fetchAllocation = async () => {
    try {
      const response = await getAllocations();
      if (!response.error) {
        const allocations = response.data || [];
        const targetId = parseInt(allocationId || "0", 10);
        const found = allocations.find((a: any) => a.id === targetId);
        setAllocation(found || null);
        if (!found) {
          setError(`Allocation with ID ${allocationId} not found`);
        }
      } else {
        setError("Failed to fetch allocation data");
      }
    } catch (err) {
      console.error("Failed to fetch allocation:", err);
      setError("Error loading allocation data");
    }
  };

  const fetchExistingRequests = async () => {
    if (!allocationId) return;

    try {
      const response = await getFarmerRequests(allocationId, true);
      if (!response.error) {
        const requests = response.data || [];
        const farmerIds = requests.map((req: any) => Number(req.farmer_id));
        setExistingRequests(farmerIds);
      }
    } catch (err) {
      console.error("Failed to fetch existing requests:", err);
    }
  };

  const fetchFarmers = async () => {
    try {
      const response = await getRsbsaSubmissions();
      if (!response.error) {
        const data = response.data || [];
        const transformedFarmers = data
          .filter((item: any) => {
            const status = String(item.status ?? "")
              .toLowerCase()
              .trim();
            const allowedStatuses = [
              "active farmer",
              "submitted",
              "approved",
              "active",
            ];
            return status !== "no parcels" && allowedStatuses.includes(status);
          })
          .map((item: any) => {
            const nameParts = (item.farmerName || "").split(", ");
            const lastName = nameParts[0] || "";
            const firstAndMiddle = nameParts[1] || "";
            const [firstName, ...middleNameParts] = firstAndMiddle.split(" ");
            const addressParts = (item.farmerAddress || "").split(", ");
            const barangay = addressParts[0] || "";

            return {
              id: item.id,
              rsbsa_no: item.referenceNumber || `RSBSA-${item.id}`,
              first_name: firstName || "",
              middle_name: middleNameParts.join(" ") || "",
              last_name: lastName,
              extension_name: "",
              barangay,
            };
          });
        setFarmers(transformedFarmers);
      }
    } catch (err) {
      console.error("Failed to fetch farmers:", err);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "farmer_id" || name.includes("requested_")
          ? value === ""
            ? 0
            : parseFloat(value)
          : value,
    }));
  };

  const visibleFertilizerItems = useMemo(() => FERTILIZER_ITEMS, []);
  const visibleSeedItems = useMemo(() => SEED_ITEMS, []);

  const fertilizerLabelSet = useMemo(
    () => new Set(visibleFertilizerItems.map((item) => item.label)),
    [visibleFertilizerItems],
  );

  const getExceededUnitByLabel = (label: string): "bags" | "kg" =>
    fertilizerLabelSet.has(label) ? "bags" : "kg";

  const hasVisibleAllocationItems =
    visibleFertilizerItems.length > 0 || visibleSeedItems.length > 0;

  const toSafeNumber = (value: unknown): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatSummaryValue = (value: number): string => {
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  };

  const buildSummaryItems = (
    items: AllocationItem[],
  ): AllocationSummaryItem[] => {
    return items.map((item) => {
      const allocated = toSafeNumber(allocation?.[item.allocationField]);
      const requested = Math.max(0, toSafeNumber(formData[item.requestField]));
      return {
        label: item.label,
        allocated,
        requested,
        remaining: allocated - requested,
      };
    });
  };

  const fertilizerSummaryItems = buildSummaryItems(visibleFertilizerItems);
  const seedSummaryItems = buildSummaryItems(visibleSeedItems);

  const fertilizerTotals = fertilizerSummaryItems.reduce(
    (totals, item) => ({
      allocated: totals.allocated + item.allocated,
      requested: totals.requested + item.requested,
      remaining: totals.remaining + item.remaining,
    }),
    { allocated: 0, requested: 0, remaining: 0 },
  );

  const seedTotals = seedSummaryItems.reduce(
    (totals, item) => ({
      allocated: totals.allocated + item.allocated,
      requested: totals.requested + item.requested,
      remaining: totals.remaining + item.remaining,
    }),
    { allocated: 0, requested: 0, remaining: 0 },
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedFormData(formData);
    }, 500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [formData]);

  const getInlineExceedAmount = (item: AllocationItem): number => {
    const allocated = toSafeNumber(allocation?.[item.allocationField]);
    const requested = Math.max(
      0,
      toSafeNumber(debouncedFormData[item.requestField]),
    );
    return Math.max(0, requested - allocated);
  };

  const getInlineExceedAmountFromData = (
    item: AllocationItem,
    data: FarmerRequestForm,
  ): number => {
    const allocated = toSafeNumber(allocation?.[item.allocationField]);
    const requested = Math.max(0, toSafeNumber(data[item.requestField]));
    return Math.max(0, requested - allocated);
  };

  const hasOverAllocation = [
    ...fertilizerSummaryItems,
    ...seedSummaryItems,
  ].some((item) => item.remaining < 0);

  const exceededSummaryItems = useMemo(
    () =>
      [...fertilizerSummaryItems, ...seedSummaryItems].filter(
        (item) => item.remaining < 0,
      ),
    [fertilizerSummaryItems, seedSummaryItems],
  );

  useEffect(() => {
    if (exceededSummaryItems.length === 0) {
      setLiveExceedMessage(null);
      return;
    }

    const timer = window.setTimeout(() => {
      const formatValue = (value: number): string =>
        Number.isInteger(value) ? value.toString() : value.toFixed(2);

      const sample = exceededSummaryItems
        .slice(0, 3)
        .map(
          (item) =>
            `${item.label} (${formatValue(Math.abs(item.remaining))} over)`,
        )
        .join(", ");

      const more =
        exceededSummaryItems.length > 3
          ? ` and ${exceededSummaryItems.length - 3} more item(s)`
          : "";

      setLiveExceedMessage(
        `Warning: request exceeds available allocation for ${sample}${more}.`,
      );
    }, 500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [exceededSummaryItems]);

  useEffect(() => {
    let isCancelled = false;

    const resolveInlineSuggestions = async () => {
      if (!allocation) {
        setInlineSuggestions({});
        return;
      }

      const exceededItems = [...visibleFertilizerItems, ...visibleSeedItems]
        .filter(
          (item) => getInlineExceedAmountFromData(item, debouncedFormData) > 0,
        )
        .sort((a, b) => a.label.localeCompare(b.label));

      if (exceededItems.length === 0) {
        setInlineSuggestions({});
        return;
      }

      const nextSuggestions: Record<string, InlineSuggestion> = {};
      const activeSeedId = detectActiveSeedId(
        debouncedFormData as unknown as Record<string, unknown>,
      );
      const noSubstituteMessageFor = (itemLabel: string): string =>
        `No substitute found for ${itemLabel}. Consider contacting your supplier for restock.`;

      await Promise.all(
        exceededItems.map(async (item) => {
          if (item.category === "fertilizer") {
            const response = await resolveFertilizerShortageSuggestion({
              seedId: activeSeedId,
              shortageFertId: item.shortageId,
            });

            const payload: any = response.data;
            if (response.error || !payload) {
              nextSuggestions[item.requestField] = {
                title: "Suggestion unavailable",
                message:
                  response.error || "Unable to load fertilizer suggestion.",
                status: "error",
              };
              return;
            }

            if (
              payload.status === "resolved" ||
              payload.status === "tier2_fallback"
            ) {
              const tierLabel =
                payload.status === "tier2_fallback"
                  ? "Tier 2 fallback"
                  : "Tier 1";
              nextSuggestions[item.requestField] = {
                title: `Suggested: ${payload.suggestion?.name || "N/A"}`,
                message:
                  payload.suggestion?.reason ||
                  `${tierLabel} substitute selected for ${payload.shortage?.name || item.label}.`,
                status: payload.status,
              };
              return;
            }

            nextSuggestions[item.requestField] = {
              title: "No fertilizer substitute found",
              message: noSubstituteMessageFor(item.label),
              status: "unresolvable",
            };
            return;
          }

          const response = await resolveSeedShortageSuggestion({
            seedId: item.shortageId,
          });

          const payload: any = response.data;
          if (response.error || !payload) {
            nextSuggestions[item.requestField] = {
              title: "Suggestion unavailable",
              message:
                response.error || "Unable to load seed substitute suggestion.",
              status: "error",
            };
            return;
          }

          const topSubstitute = Array.isArray(payload.substitutes)
            ? payload.substitutes[0]
            : null;

          if (payload.status === "resolved" && topSubstitute) {
            const maturityText =
              topSubstitute.maturity_diff_days == null
                ? "maturity diff unavailable"
                : `${topSubstitute.maturity_diff_days >= 0 ? "+" : ""}${topSubstitute.maturity_diff_days} days`;

            nextSuggestions[item.requestField] = {
              title: `Suggested: ${topSubstitute.name}`,
              message: `Best substitute for ${payload.original?.name || item.label}; maturity delta ${maturityText}.`,
              status: "resolved",
            };
            return;
          }

          nextSuggestions[item.requestField] = {
            title: "No seed substitute found",
            message: noSubstituteMessageFor(item.label),
            status: "unresolvable",
          };
        }),
      );

      if (!isCancelled) {
        setInlineSuggestions(nextSuggestions);
      }
    };

    resolveInlineSuggestions();

    return () => {
      isCancelled = true;
    };
  }, [allocation, debouncedFormData, visibleFertilizerItems, visibleSeedItems]);

  const runSubmitRequest = async () => {
    if (!formData.farmer_id) {
      setError("Please select a farmer");
      return;
    }

    if (!allocation || !allocation.season) {
      setError("Allocation data not loaded. Please refresh the page.");
      return;
    }

    if (!hasVisibleAllocationItems) {
      setError(
        "This allocation has no available fertilizer or seed items to request.",
      );
      return;
    }

    const hasAtLeastOneItem =
      selectedFertilizerKeys.some((field) => Number(formData[field]) > 0) ||
      selectedSeedKeys.some((field) => Number(formData[field]) > 0);

    if (!hasAtLeastOneItem) {
      setError(
        "Please add at least one fertilizer or seed.",
      );
      return;
    }

    const selectedFarmer = farmers.find(
      (f) => Number(f.id) === Number(formData.farmer_id),
    );
    if (!selectedFarmer) {
      setError("Selected farmer not found");
      return;
    }

    const farmerFullName =
      `${selectedFarmer.last_name}, ${selectedFarmer.first_name} ${selectedFarmer.middle_name || ""}`.trim();

    setLoading(true);
    setError(null);

    try {
      const totalFertilizerRequested = visibleFertilizerItems.reduce(
        (sum, item) => sum + (Number(formData[item.requestField]) || 0),
        0,
      );

      const totalSeedsRequested = visibleSeedItems.reduce(
        (sum, item) => sum + (Number(formData[item.requestField]) || 0),
        0,
      );

      const response = await createFarmerRequest({
        allocation_id: Number(allocationId),
        season: allocation.season,
        farmer_id: formData.farmer_id,
        farmer_name: farmerFullName,
        barangay: selectedFarmer.barangay,
        farm_area_ha: 0,
        crop_type: "Rice",
        ownership_type: "Owner",
        num_parcels: 1,
        fertilizer_requested: totalFertilizerRequested > 0,
        seeds_requested: totalSeedsRequested > 0,
        request_notes: formData.notes || null,
        created_by: null,
        requested_urea_bags: formData.requested_urea_bags,
        requested_complete_14_bags: formData.requested_complete_14_bags,
        requested_complete_16_bags: formData.requested_complete_16_bags,
        requested_ammonium_sulfate_bags:
          formData.requested_ammonium_sulfate_bags,
        requested_ammonium_phosphate_bags:
          formData.requested_ammonium_phosphate_bags,
        requested_muriate_potash_bags: formData.requested_muriate_potash_bags,
        requested_zinc_sulfate_bags: formData.requested_zinc_sulfate_bags,
        requested_vermicompost_bags: formData.requested_vermicompost_bags,
        requested_chicken_manure_bags: formData.requested_chicken_manure_bags,
        requested_rice_straw_kg: formData.requested_rice_straw_kg,
        requested_carbonized_rice_hull_bags:
          formData.requested_carbonized_rice_hull_bags,
        requested_biofertilizer_liters: formData.requested_biofertilizer_liters,
        requested_nanobiofertilizer_liters:
          formData.requested_nanobiofertilizer_liters,
        requested_organic_root_exudate_mix_liters:
          formData.requested_organic_root_exudate_mix_liters,
        requested_azolla_microphylla_kg:
          formData.requested_azolla_microphylla_kg,
        requested_foliar_liquid_fertilizer_npk_liters:
          formData.requested_foliar_liquid_fertilizer_npk_liters,
        requested_rice_seeds_nsic_rc160_kg:
          formData.requested_rice_seeds_nsic_rc160_kg,
        requested_rice_seeds_nsic_rc222_kg:
          formData.requested_rice_seeds_nsic_rc222_kg,
        requested_jackpot_kg: formData.requested_jackpot_kg,
        requested_us88_kg: formData.requested_us88_kg,
        requested_th82_kg: formData.requested_th82_kg,
        requested_rh9000_kg: formData.requested_rh9000_kg,
        requested_lumping143_kg: formData.requested_lumping143_kg,
        requested_lp296_kg: formData.requested_lp296_kg,
        requested_mestiso_1_kg: formData.requested_mestiso_1_kg,
        requested_mestiso_20_kg: formData.requested_mestiso_20_kg,
        requested_mestiso_29_kg: formData.requested_mestiso_29_kg,
        requested_mestiso_55_kg: formData.requested_mestiso_55_kg,
        requested_mestiso_73_kg: formData.requested_mestiso_73_kg,
        requested_mestiso_99_kg: formData.requested_mestiso_99_kg,
        requested_mestiso_103_kg: formData.requested_mestiso_103_kg,
        requested_nsic_rc402_kg: formData.requested_nsic_rc402_kg,
        requested_nsic_rc480_kg: formData.requested_nsic_rc480_kg,
        requested_nsic_rc216_kg: formData.requested_nsic_rc216_kg,
        requested_nsic_rc218_kg: formData.requested_nsic_rc218_kg,
        requested_nsic_rc506_kg: formData.requested_nsic_rc506_kg,
        requested_nsic_rc508_kg: formData.requested_nsic_rc508_kg,
        requested_nsic_rc512_kg: formData.requested_nsic_rc512_kg,
        requested_nsic_rc534_kg: formData.requested_nsic_rc534_kg,
        requested_tubigan_28_kg: formData.requested_tubigan_28_kg,
        requested_tubigan_30_kg: formData.requested_tubigan_30_kg,
        requested_tubigan_22_kg: formData.requested_tubigan_22_kg,
        requested_sahod_ulan_2_kg: formData.requested_sahod_ulan_2_kg,
        requested_sahod_ulan_10_kg: formData.requested_sahod_ulan_10_kg,
        requested_salinas_6_kg: formData.requested_salinas_6_kg,
        requested_salinas_7_kg: formData.requested_salinas_7_kg,
        requested_salinas_8_kg: formData.requested_salinas_8_kg,
        requested_malagkit_5_kg: formData.requested_malagkit_5_kg,
        requested_np_16_20_0_bags: formData.requested_np_16_20_0_bags,
        requested_rice_seeds_nsic_rc440_kg: formData.requested_rice_seeds_nsic_rc440_kg,
        requested_corn_seeds_hybrid_kg: formData.requested_corn_seeds_hybrid_kg,
        requested_corn_seeds_opm_kg: formData.requested_corn_seeds_opm_kg,
        requested_vegetable_seeds_kg: formData.requested_vegetable_seeds_kg,
      });

      if (response.error) {
        throw new Error(response.error || "Failed to save farmer request");
      }

      try {
        const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
        const auditLogger = getAuditLogger();
        const allocationLabel = allocation.season
          ? allocation.season.replace("_", " ").toUpperCase()
          : "UNKNOWN SEASON";

        await auditLogger.logCRUD(
          {
            id: currentUser.id,
            name: currentUser.name || currentUser.username || "Unknown",
            role: currentUser.role || "JO",
          },
          "CREATE",
          AuditModule.REQUESTS,
          "farmer_request",
          response.data?.id || 0,
          `Added farmer request for ${farmerFullName} (Program: ${allocationLabel})`,
          undefined,
          {
            farmer_name: farmerFullName,
            allocation_program: allocation.season || null,
            allocation_date: allocation.allocation_date || null,
            requested_fertilizer_total_bags: totalFertilizerRequested,
            requested_seed_total_kg: totalSeedsRequested,
            requested_urea_bags: formData.requested_urea_bags,
            requested_complete_14_bags: formData.requested_complete_14_bags,
            requested_complete_16_bags: formData.requested_complete_16_bags,
            requested_ammonium_sulfate_bags:
              formData.requested_ammonium_sulfate_bags,
            requested_np_16_20_0_bags: formData.requested_np_16_20_0_bags,
            requested_rice_seeds_nsic_rc440_kg: formData.requested_rice_seeds_nsic_rc440_kg,
            requested_corn_seeds_hybrid_kg: formData.requested_corn_seeds_hybrid_kg,
            requested_corn_seeds_opm_kg: formData.requested_corn_seeds_opm_kg,
            requested_vegetable_seeds_kg: formData.requested_vegetable_seeds_kg,
            requested_jackpot_kg: formData.requested_jackpot_kg,
            requested_us88_kg: formData.requested_us88_kg,
            requested_th82_kg: formData.requested_th82_kg,
            requested_rh9000_kg: formData.requested_rh9000_kg,
            requested_lumping143_kg: formData.requested_lumping143_kg,
            requested_lp296_kg: formData.requested_lp296_kg,
            requested_ammonium_phosphate_bags:
              formData.requested_ammonium_phosphate_bags,
            requested_muriate_potash_bags:
              formData.requested_muriate_potash_bags,
            requested_zinc_sulfate_bags: formData.requested_zinc_sulfate_bags,
            requested_vermicompost_bags: formData.requested_vermicompost_bags,
            requested_chicken_manure_bags:
              formData.requested_chicken_manure_bags,
            requested_rice_straw_kg: formData.requested_rice_straw_kg,
            requested_carbonized_rice_hull_bags:
              formData.requested_carbonized_rice_hull_bags,
            requested_biofertilizer_liters:
              formData.requested_biofertilizer_liters,
            requested_nanobiofertilizer_liters:
              formData.requested_nanobiofertilizer_liters,
            requested_organic_root_exudate_mix_liters:
              formData.requested_organic_root_exudate_mix_liters,
            requested_azolla_microphylla_kg:
              formData.requested_azolla_microphylla_kg,
            requested_foliar_liquid_fertilizer_npk_liters:
              formData.requested_foliar_liquid_fertilizer_npk_liters,
            requested_rice_seeds_nsic_rc160_kg:
              formData.requested_rice_seeds_nsic_rc160_kg,
            requested_rice_seeds_nsic_rc222_kg:
              formData.requested_rice_seeds_nsic_rc222_kg,
            requested_mestiso_1_kg: formData.requested_mestiso_1_kg,
            requested_mestiso_20_kg: formData.requested_mestiso_20_kg,
            requested_mestiso_29_kg: formData.requested_mestiso_29_kg,
            requested_mestiso_55_kg: formData.requested_mestiso_55_kg,
            requested_mestiso_73_kg: formData.requested_mestiso_73_kg,
            requested_mestiso_99_kg: formData.requested_mestiso_99_kg,
            requested_mestiso_103_kg: formData.requested_mestiso_103_kg,
            requested_nsic_rc402_kg: formData.requested_nsic_rc402_kg,
            requested_nsic_rc480_kg: formData.requested_nsic_rc480_kg,
            requested_nsic_rc216_kg: formData.requested_nsic_rc216_kg,
            requested_nsic_rc218_kg: formData.requested_nsic_rc218_kg,
            requested_nsic_rc506_kg: formData.requested_nsic_rc506_kg,
            requested_nsic_rc508_kg: formData.requested_nsic_rc508_kg,
            requested_nsic_rc512_kg: formData.requested_nsic_rc512_kg,
            requested_nsic_rc534_kg: formData.requested_nsic_rc534_kg,
            requested_tubigan_28_kg: formData.requested_tubigan_28_kg,
            requested_tubigan_30_kg: formData.requested_tubigan_30_kg,
            requested_tubigan_22_kg: formData.requested_tubigan_22_kg,
            requested_sahod_ulan_2_kg: formData.requested_sahod_ulan_2_kg,
            requested_sahod_ulan_10_kg: formData.requested_sahod_ulan_10_kg,
            requested_salinas_6_kg: formData.requested_salinas_6_kg,
            requested_salinas_7_kg: formData.requested_salinas_7_kg,
            requested_salinas_8_kg: formData.requested_salinas_8_kg,
            requested_malagkit_5_kg: formData.requested_malagkit_5_kg,
            request_notes: formData.notes || null,
          },
          {
            includeRouteContext: false,
            metadata: null,
          },
        );
      } catch (auditErr) {
        console.error("Audit log failed (non-blocking):", auditErr);
      }

      setNotificationType("success");
      setNotificationMessage("Farmer request added successfully!");
      setShowNotification(true);

      setTimeout(() => {
        setShowNotification(false);
        setTimeout(() => {
          navigate(`/jo-manage-requests/${allocationId}`);
        }, 300);
      }, 2000);
    } catch (err: any) {
      setNotificationType("error");
      setNotificationMessage(err.message || "Failed to save farmer request");
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 4000);
      setError(err.message || "Failed to save farmer request");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (hasOverAllocation) {
      setShowExceedConfirmModal(true);
      return;
    }

    await runSubmitRequest();
  };

  const handleConfirmSubmitWithExceeded = async () => {
    setShowExceedConfirmModal(false);
    await runSubmitRequest();
  };

  const filteredFarmers = farmers.filter((farmer) => {
    if (existingRequests.includes(Number(farmer.id))) {
      return false;
    }

    const searchLower = searchTerm.toLowerCase();
    const fullName =
      `${farmer.first_name} ${farmer.middle_name} ${farmer.last_name}`.toLowerCase();
    const rsbsa = farmer.rsbsa_no?.toLowerCase() || "";
    return fullName.includes(searchLower) || rsbsa.includes(searchLower);
  });

  return (
    <div className="jo-add-farmer-page-container">
      {showExceedConfirmModal && (
        <div className="jo-add-farmer-modal-backdrop">
          <div
            className="jo-add-farmer-modal-card"
            role="dialog"
            aria-modal="true"
          >
            <h3 className="jo-add-farmer-modal-title">⚠️ Exceeds Allocation</h3>
            <p className="jo-add-farmer-modal-message">
              Some requested values exceed the available incentives/allocation.
              Please go back and edit the values to match the available stock.
            </p>

            <div className="jo-add-farmer-modal-list">
              {exceededSummaryItems.slice(0, 6).map((item) => (
                <div key={item.label} className="jo-add-farmer-modal-list-item">
                  {item.label}: exceeded by{" "}
                  {formatSummaryValue(Math.abs(item.remaining))}{" "}
                  {getExceededUnitByLabel(item.label)}
                </div>
              ))}
              {exceededSummaryItems.length > 6 && (
                <div className="jo-add-farmer-modal-list-item">
                  ...and {exceededSummaryItems.length - 6} more item(s)
                </div>
              )}
            </div>

            <div className="jo-add-farmer-modal-actions">
              <button
                type="button"
                className="jo-add-farmer-modal-cancel"
                onClick={() => setShowExceedConfirmModal(false)}
                disabled={loading}
              >
                Change Values
              </button>
            </div>
          </div>
        </div>
      )}

      {showNotification && (
        <div className={`notification-toast notification-${notificationType}`}>
          <div className="notification-content">
            <span className="notification-icon">
              {notificationType === "success" ? "✅" : "❌"}
            </span>
            <span className="notification-message">{notificationMessage}</span>
          </div>
          <button
            className="notification-close"
            onClick={() => setShowNotification(false)}
          >
            ×
          </button>
        </div>
      )}

      <div className="jo-add-farmer-page">
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

            {currentUser && (
              <div className="sidebar-current-user">
                <div className="sidebar-current-user-avatar">
                  {currentUser.firstName.charAt(0).toUpperCase()}
                  {currentUser.lastName.charAt(0).toUpperCase()}
                </div>
                <div className="sidebar-current-user-info">
                  <span className="sidebar-current-user-name">
                    {currentUser.firstName} {currentUser.lastName}
                  </span>
                  <span className="sidebar-current-user-label">Logged in</span>
                </div>
              </div>
            )}
          </nav>
        </div>

        <div className="jo-add-farmer-main-content">
          <div className="jo-add-farmer-header">
            <h2 className="jo-add-farmer-title">➕ Add Farmer Request</h2>
            <p className="jo-add-farmer-subtitle">
              {allocation
                ? `Program: ${allocation.season}`
                : "Loading..."}
            </p>
            <button
              className="app-back-button"
              onClick={() => navigate(`/jo-manage-requests/${allocationId}`)}
            >
              ← Back to Manage Requests
            </button>
          </div>

          <div className="jo-add-farmer-content-card">
            <form onSubmit={handleSubmit}>
              {liveExceedMessage && (
                <div className="jo-add-farmer-warning-box">
                  {liveExceedMessage}
                </div>
              )}

              <div className="jo-add-farmer-section">
                <h3 className="jo-add-farmer-section-title">Select Farmer</h3>
                <div className="jo-add-farmer-search-container">
                  <input
                    type="text"
                    placeholder="🔍 Search by name or RSBSA number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="jo-add-farmer-search-input"
                  />
                  {existingRequests.length > 0 && (
                    <div className="jo-add-farmer-info-box">
                      <span>ℹ️</span>
                      <span>
                        {existingRequests.length} farmer
                        {existingRequests.length !== 1 ? "s" : ""} hidden
                        (already have request
                        {existingRequests.length !== 1 ? "s" : ""} for this
                        season)
                      </span>
                    </div>
                  )}
                </div>
                <div className="jo-add-farmer-list-container">
                  {filteredFarmers.length === 0 ? (
                    <div className="jo-add-farmer-empty-state">
                      No farmers found
                    </div>
                  ) : (
                    filteredFarmers.map((farmer) => (
                      <label
                        key={farmer.id}
                        className={`jo-add-farmer-item ${Number(formData.farmer_id) === Number(farmer.id) ? "selected" : ""}`}
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            farmer_id: Number(farmer.id),
                          }));
                        }}
                      >
                        <input
                          type="radio"
                          name="farmer_id"
                          value={farmer.id}
                          checked={
                            Number(formData.farmer_id) === Number(farmer.id)
                          }
                          onChange={() => { }}
                          className="jo-add-farmer-radio"
                        />
                        <div className="jo-add-farmer-item-content">
                          <label className="jo-add-farmer-label">
                            Program Name
                          </label>
                          <div className="jo-add-farmer-name">
                            {farmer.last_name}, {farmer.first_name}{" "}
                            {farmer.middle_name ? farmer.middle_name + " " : ""}
                            {farmer.extension_name
                              ? farmer.extension_name + " "
                              : ""}
                          </div>
                          <div className="jo-add-farmer-details">
                            📍 {farmer.barangay} • RSBSA: {farmer.rsbsa_no}
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {hasVisibleAllocationItems && (
                <div className="jo-add-farmer-section jo-add-farmer-allocation-summary">
                  <h3 className="jo-add-farmer-section-title">
                    📊 Allocation Summary
                  </h3>

                  <div className="jo-add-farmer-summary-totals-grid">
                    <div
                      className={`jo-add-farmer-summary-total-card ${fertilizerTotals.remaining < 0 ? "is-warning" : ""}`}
                    >
                      <h4>Fertilizers</h4>
                      <p>
                        Allocated:{" "}
                        {formatSummaryValue(fertilizerTotals.allocated)}
                      </p>
                      <p>
                        Entered:{" "}
                        {formatSummaryValue(fertilizerTotals.requested)}
                      </p>
                      <p>
                        Remaining:{" "}
                        {formatSummaryValue(fertilizerTotals.remaining)}
                      </p>
                    </div>

                    <div
                      className={`jo-add-farmer-summary-total-card ${seedTotals.remaining < 0 ? "is-warning" : ""}`}
                    >
                      <h4>Seeds</h4>
                      <p>
                        Allocated: {formatSummaryValue(seedTotals.allocated)}
                      </p>
                      <p>Entered: {formatSummaryValue(seedTotals.requested)}</p>
                      <p>
                        Remaining: {formatSummaryValue(seedTotals.remaining)}
                      </p>
                    </div>
                  </div>

                  {fertilizerSummaryItems.length > 0 && (
                    <div className="jo-add-farmer-summary-table-wrap">
                      <h4 className="jo-add-farmer-summary-subtitle">
                        Fertilizer Items (Bags)
                      </h4>
                      <div className="jo-add-farmer-summary-table">
                        <div className="jo-add-farmer-summary-header">
                          <span>Item</span>
                          <span>Allocated</span>
                          <span>Entered</span>
                          <span>Remaining</span>
                        </div>
                        {fertilizerSummaryItems.map((item) => (
                          <div
                            key={item.label}
                            className={`jo-add-farmer-summary-row ${item.remaining < 0 ? "is-warning" : ""}`}
                          >
                            <span>{item.label}</span>
                            <span>{formatSummaryValue(item.allocated)}</span>
                            <span>{formatSummaryValue(item.requested)}</span>
                            <span>{formatSummaryValue(item.remaining)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {seedSummaryItems.length > 0 && (
                    <div className="jo-add-farmer-summary-table-wrap">
                      <h4 className="jo-add-farmer-summary-subtitle">
                        Seed Items (Kg)
                      </h4>
                      <div className="jo-add-farmer-summary-table">
                        <div className="jo-add-farmer-summary-header">
                          <span>Item</span>
                          <span>Allocated</span>
                          <span>Entered</span>
                          <span>Remaining</span>
                        </div>
                        {seedSummaryItems.map((item) => (
                          <div
                            key={item.label}
                            className={`jo-add-farmer-summary-row ${item.remaining < 0 ? "is-warning" : ""}`}
                          >
                            <span>{item.label}</span>
                            <span>{formatSummaryValue(item.allocated)}</span>
                            <span>{formatSummaryValue(item.requested)}</span>
                            <span>{formatSummaryValue(item.remaining)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="jo-add-farmer-section">
                <h3 className="jo-add-farmer-section-title">
                  🌱 Requested Fertilizers
                </h3>
                <div className="jo-add-farmer-dropdown-control">
                  <select
                    className="jo-add-farmer-input"
                    onChange={(e) => {
                      addItem("fertilizer", e.target.value as RequestField);
                      e.target.value = "";
                    }}
                    value=""
                  >
                    <option value="" disabled>Select Fertilizer to Add...</option>
                    {Object.entries(fertilizerCategories).map(([cat, labels]) => (
                      <optgroup key={cat} label={`${cat} Fertilizers`}>
                        {visibleFertilizerItems
                          .filter(item => {
                            const stock = Number(allocation?.[item.allocationField]) || 0;
                            return labels.includes(item.label) && !selectedFertilizerKeys.includes(item.requestField) && stock > 0;
                          })
                          .map(item => {
                            const stock = Number(allocation?.[item.allocationField]) || 0;
                            return (
                              <option key={item.requestField} value={item.requestField}>
                                {item.label} (Stock: {stock})
                              </option>
                            );
                          })}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div className="jo-add-farmer-dynamic-list">
                  {selectedFertilizerKeys.map((field) => {
                    const item = visibleFertilizerItems.find(i => i.requestField === field);
                    if (!item) return null;
                    return (
                      <div key={field} className="jo-add-farmer-dynamic-row">
                        <div className="jo-add-farmer-row-info">
                          <label className="jo-add-farmer-label">{item.label} (Bags)</label>
                        </div>
                        <div className="jo-add-farmer-row-input-group">
                          <input
                            type="number"
                            name={item.requestField}
                            value={Number(formData[item.requestField]) || 0}
                            onChange={handleInputChange}
                            min="0"
                            step="1"
                            className="jo-add-farmer-input"
                          />
                          <button
                            type="button"
                            className="jo-add-farmer-row-remove"
                            onClick={() => removeItem("fertilizer", field)}
                          >
                            ✕
                          </button>
                        </div>
                        {getInlineExceedAmount(item) > 0 && (
                          <div className="jo-add-farmer-row-warning">
                            Exceeds allocation by {formatSummaryValue(getInlineExceedAmount(item))} bags.
                          </div>
                        )}
                        {getInlineExceedAmount(item) > 0 && inlineSuggestions[field] && (
                          <div className={`jo-add-farmer-inline-suggestion-card jo-add-farmer-inline-suggestion-${inlineSuggestions[field].status}`}>
                            <div className="jo-add-farmer-inline-suggestion-title">{inlineSuggestions[field].title}</div>
                            <div className="jo-add-farmer-inline-suggestion-message">{inlineSuggestions[field].message}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {selectedFertilizerKeys.length === 0 && (
                    <p className="jo-add-farmer-empty-hint">No fertilizers selected.</p>
                  )}
                </div>
              </div>

              <div className="jo-add-farmer-section">
                <h3 className="jo-add-farmer-section-title">
                  🌾 Requested Seeds
                </h3>
                <div className="jo-add-farmer-dropdown-control">
                  <select
                    className="jo-add-farmer-input"
                    onChange={(e) => {
                      addItem("seed", e.target.value as RequestField);
                      e.target.value = "";
                    }}
                    value=""
                  >
                    <option value="" disabled>Select Seed to Add...</option>
                    {Object.entries(seedCategories).map(([cat, labels]) => (
                      <optgroup key={cat} label={`${cat} Seeds`}>
                        {visibleSeedItems
                          .filter(item => {
                            const stock = Number(allocation?.[item.allocationField]) || 0;
                            return labels.includes(item.label) && !selectedSeedKeys.includes(item.requestField) && stock > 0;
                          })
                          .map(item => {
                            const stock = Number(allocation?.[item.allocationField]) || 0;
                            return (
                              <option key={item.requestField} value={item.requestField}>
                                {item.label} (Stock: {stock})
                              </option>
                            );
                          })}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div className="jo-add-farmer-dynamic-list">
                  {selectedSeedKeys.map((field) => {
                    const item = visibleSeedItems.find(i => i.requestField === field);
                    if (!item) return null;
                    return (
                      <div key={field} className="jo-add-farmer-dynamic-row">
                        <div className="jo-add-farmer-row-info">
                          <label className="jo-add-farmer-label">{item.label} (Kg)</label>
                        </div>
                        <div className="jo-add-farmer-row-input-group">
                          <input
                            type="number"
                            name={item.requestField}
                            value={Number(formData[item.requestField]) || 0}
                            onChange={handleInputChange}
                            min="0"
                            step="any"
                            className="jo-add-farmer-input"
                          />
                          <button
                            type="button"
                            className="jo-add-farmer-row-remove"
                            onClick={() => removeItem("seed", field)}
                          >
                            ✕
                          </button>
                        </div>
                        {getInlineExceedAmount(item) > 0 && (
                          <div className="jo-add-farmer-row-warning">
                            Exceeds allocation by {formatSummaryValue(getInlineExceedAmount(item))} kg.
                          </div>
                        )}
                        {getInlineExceedAmount(item) > 0 && inlineSuggestions[field] && (
                          <div className={`jo-add-farmer-inline-suggestion-card jo-add-farmer-inline-suggestion-${inlineSuggestions[field].status}`}>
                            <div className="jo-add-farmer-inline-suggestion-title">{inlineSuggestions[field].title}</div>
                            <div className="jo-add-farmer-inline-suggestion-message">{inlineSuggestions[field].message}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {selectedSeedKeys.length === 0 && (
                    <p className="jo-add-farmer-empty-hint">No seeds selected.</p>
                  )}
                </div>
              </div>

              {!hasVisibleAllocationItems && (
                <div className="jo-add-farmer-error-box">
                  This allocation has no items with values greater than zero.
                </div>
              )}

              <div className="jo-add-farmer-section">
                <label className="jo-add-farmer-label">Notes / Remarks</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Add any additional notes..."
                  className="jo-add-farmer-textarea"
                />
              </div>

              {error && <div className="jo-add-farmer-error-box">{error}</div>}

              {hasOverAllocation && (
                <div className="jo-add-farmer-warning-box">
                  Some entered values are above exceeds the allocation. You can
                  still submit, but please review remaining values highlighted
                  in red.
                </div>
              )}

              <div className="jo-add-farmer-actions">
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/jo-manage-requests/${allocationId}`)
                  }
                  className="jo-add-farmer-cancel-btn"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="jo-add-farmer-submit-btn"
                  disabled={loading || !hasVisibleAllocationItems}
                >
                  {loading ? "💾 Saving..." : "✅ Add Farmer Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoAddFarmerRequest;
