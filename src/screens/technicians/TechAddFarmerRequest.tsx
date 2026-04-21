import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  getAllocationById,
  getFarmerRequests,
  getRsbsaSubmissions,
  createFarmerRequest,
} from "../../api";
import {
  getAuditLogger,
  AuditModule,
} from "../../components/Audit/auditLogger";
import "../../assets/css/technician css/TechAddFarmerRequestStyle.css";
import "../../assets/css/jo css/JoIncentStyle.css";
import "../../components/layout/sidebarStyle.css";
import LogoImage from "../../assets/images/Logo.png";
import HomeIcon from "../../assets/images/home.png";
import RSBSAIcon from "../../assets/images/rsbsa.png";
import ApproveIcon from "../../assets/images/approve.png";
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
  notes: string;
}

type RequestField = keyof Omit<FarmerRequestForm, "farmer_id" | "notes">;

type AllocationItem = {
  label: string;
  allocationField: keyof AllocationDetails;
  requestField: RequestField;
};

type AllocationSummaryItem = {
  label: string;
  allocated: number;
  requested: number;
  remaining: number;
};

const FERTILIZER_ITEMS: AllocationItem[] = [
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

const SEED_ITEMS: AllocationItem[] = [
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

const TechAddFarmerRequest: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { allocationId } = useParams<{ allocationId: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [allocation, setAllocation] = useState<AllocationDetails | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [existingRequests, setExistingRequests] = useState<number[]>([]);
  const [showExceedConfirmModal, setShowExceedConfirmModal] = useState(false);
  const [liveExceedMessage, setLiveExceedMessage] = useState<string | null>(
    null,
  );

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

  // Show toast notification
  const showToast = (
    message: string,
    type: "success" | "error" | "warning" = "success",
    duration: number = 3000,
  ) => {
    setToast({ show: true, message, type });
    if (duration > 0) {
      setTimeout(() => {
        setToast((prev) => ({ ...prev, show: false }));
      }, duration);
    }
  };

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
    notes: "",
  });
  const [debouncedFormData, setDebouncedFormData] =
    useState<FarmerRequestForm>(formData);

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    navigate("/login");
  };

  useEffect(() => {
    fetchAllocation();
    fetchFarmers();
  }, [allocationId]);

  useEffect(() => {
    if (allocationId) {
      fetchExistingRequests();
    }
  }, [allocationId]);

  const fetchAllocation = async () => {
    try {
      const response = await getAllocationById(allocationId || "0");
      if (!response.error) {
        const found = response.data || null;
        setAllocation(found);
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
      // Fetch requests by allocation_id, not season
      const response = await getFarmerRequests(allocationId, true);
      if (!response.error) {
        const requests = response.data || [];
        const farmerIds = requests
          .map((req: any) => Number(req.farmer_id))
          .filter((id: number) => Number.isFinite(id) && id > 0);
        setExistingRequests(Array.from(new Set(farmerIds)));
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
              barangay: barangay,
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

  const visibleFertilizerItems = FERTILIZER_ITEMS.filter(
    (item) => (Number(allocation?.[item.allocationField]) || 0) > 0,
  );

  const visibleSeedItems = SEED_ITEMS.filter(
    (item) => (Number(allocation?.[item.allocationField]) || 0) > 0,
  );

  const fertilizerLabelSet = useMemo(
    () => new Set(visibleFertilizerItems.map((item) => item.label)),
    [visibleFertilizerItems],
  );

  const getExceededUnitByLabel = (label: string): "bags" | "kg" | "liters" => {
    if (fertilizerLabelSet.has(label)) {
      const fertilizerItem = visibleFertilizerItems.find(
        (item) => item.label === label,
      );
      if (
        fertilizerItem?.requestField.includes("liters") ||
        fertilizerItem?.allocationField.includes("liters")
      ) {
        return "liters";
      }
      if (
        fertilizerItem?.requestField.includes("_kg") ||
        fertilizerItem?.allocationField.includes("_kg")
      ) {
        return "kg";
      }
      return "bags";
    }

    return "kg";
  };

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
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      const sample = exceededSummaryItems
        .slice(0, 3)
        .map(
          (item) =>
            `${item.label} (${formatSummaryValue(Math.abs(item.remaining))} over)`,
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
        season: allocation?.season,
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
      });

      if (response.error) {
        throw new Error(response.error || "Failed to save farmer request");
      }

      // Log audit trail
      try {
        const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
        const auditLogger = getAuditLogger();
        const allocationLabel = allocation?.season
          ? allocation.season.replace("_", " ").toUpperCase()
          : "UNKNOWN SEASON";
        await auditLogger.logCRUD(
          {
            id: currentUser.id,
            name: currentUser.name || currentUser.username || "Unknown",
            role: currentUser.role || "Technician",
          },
          "CREATE",
          AuditModule.REQUESTS,
          "farmer_request",
          response.data?.id || 0,
          `Added farmer request for ${farmerFullName} (${allocationLabel})`,
          undefined,
          {
            farmer_name: farmerFullName,
            allocation_season: allocation?.season || null,
            allocation_date: allocation?.allocation_date || null,
            requested_fertilizer_total_bags: totalFertilizerRequested,
            requested_seed_total_kg: totalSeedsRequested,
            requested_urea_bags: formData.requested_urea_bags,
            requested_complete_14_bags: formData.requested_complete_14_bags,
            requested_complete_16_bags: formData.requested_complete_16_bags,
            requested_ammonium_sulfate_bags:
              formData.requested_ammonium_sulfate_bags,
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

      showToast("Farmer request added successfully!", "success", 2000);
      // Navigate after showing toast
      setTimeout(() => {
        navigate(`/technician-manage-requests/${allocationId}`);
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to save farmer request");
      showToast(err.message || "Failed to save farmer request", "error");
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
    <div className="tech-add-farmer-page-container">
      {showExceedConfirmModal && (
        <div className="tech-add-farmer-modal-backdrop">
          <div
            className="tech-add-farmer-modal-card"
            role="dialog"
            aria-modal="true"
          >
            <h3 className="tech-add-farmer-modal-title">
              ⚠️ Exceeds Allocation
            </h3>
            <p className="tech-add-farmer-modal-message">
              Some requested values exceed the available incentives/allocation.
              You can go back and edit the values, or submit anyway and adjust
              later.
            </p>

            <div className="tech-add-farmer-modal-list">
              {exceededSummaryItems.slice(0, 6).map((item) => (
                <div
                  key={item.label}
                  className="tech-add-farmer-modal-list-item"
                >
                  {item.label}: exceeded by{" "}
                  {formatSummaryValue(Math.abs(item.remaining))}{" "}
                  {getExceededUnitByLabel(item.label)}
                </div>
              ))}
              {exceededSummaryItems.length > 6 && (
                <div className="tech-add-farmer-modal-list-item">
                  ...and {exceededSummaryItems.length - 6} more item(s)
                </div>
              )}
            </div>

            <div className="tech-add-farmer-modal-actions">
              <button
                type="button"
                className="tech-add-farmer-modal-cancel"
                onClick={() => setShowExceedConfirmModal(false)}
                disabled={loading}
              >
                Change Values
              </button>
              <button
                type="button"
                className="tech-add-farmer-modal-submit"
                onClick={handleConfirmSubmitWithExceeded}
                disabled={loading}
              >
                Submit Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="tech-add-farmer-page">
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
        <div className="tech-add-farmer-main-content">
          <div className="tech-incent-mobile-header">
            <button
              className="tech-incent-hamburger"
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <div className="tech-incent-mobile-title">Add Request</div>
          </div>

          <div className="tech-add-farmer-header">
            <h2 className="tech-add-farmer-title">➕ Add Farmer Request</h2>
            <p className="tech-add-farmer-subtitle">
              {allocation
                ? `Season: ${allocation.season.replace("_", " ").toUpperCase()}`
                : "Loading..."}
            </p>
            <button
              className="app-back-button"
              onClick={() =>
                navigate(`/technician-manage-requests/${allocationId}`)
              }
            >
              ← Back to Manage Requests
            </button>
          </div>

          <div className="tech-add-farmer-content-card">
            <form onSubmit={handleSubmit}>
              {liveExceedMessage && (
                <div className="tech-add-farmer-warning-box">
                  {liveExceedMessage}
                </div>
              )}

              {/* Farmer Selection */}
              <div className="tech-add-farmer-section">
                <h3 className="tech-add-farmer-section-title">Select Farmer</h3>
                <div className="tech-add-farmer-search-container">
                  <input
                    type="text"
                    placeholder="🔍 Search by name or RSBSA number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="tech-add-farmer-search-input"
                  />
                  {existingRequests.length > 0 && (
                    <div className="tech-add-farmer-info-box">
                      <span>ℹ️</span>
                      <span>
                        {existingRequests.length} farmer
                        {existingRequests.length !== 1 ? "s" : ""} hidden
                        (already have request
                        {existingRequests.length !== 1 ? "s" : ""} for this
                        allocation)
                      </span>
                    </div>
                  )}
                </div>
                <div className="tech-add-farmer-list-container">
                  {filteredFarmers.length === 0 ? (
                    <div className="tech-add-farmer-empty-state">
                      No farmers found
                    </div>
                  ) : (
                    filteredFarmers.map((farmer) => (
                      <label
                        key={farmer.id}
                        className={`tech-add-farmer-item ${Number(formData.farmer_id) === Number(farmer.id) ? "selected" : ""}`}
                        onMouseEnter={(e) => {
                          if (
                            Number(formData.farmer_id) !== Number(farmer.id)
                          ) {
                            e.currentTarget.style.backgroundColor = "#f3f4f6";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (
                            Number(formData.farmer_id) !== Number(farmer.id)
                          ) {
                            e.currentTarget.style.backgroundColor = "white";
                          }
                        }}
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
                          onChange={() => {}}
                          className="tech-add-farmer-radio"
                        />
                        <div className="tech-add-farmer-item-content">
                          <div className="tech-add-farmer-name">
                            {farmer.last_name}, {farmer.first_name}{" "}
                            {farmer.middle_name ? farmer.middle_name + " " : ""}
                            {farmer.extension_name
                              ? farmer.extension_name + " "
                              : ""}
                          </div>
                          <div className="tech-add-farmer-details">
                            📍 {farmer.barangay} • RSBSA: {farmer.rsbsa_no}
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {hasVisibleAllocationItems && (
                <div className="tech-add-farmer-section tech-add-farmer-allocation-summary">
                  <h3 className="tech-add-farmer-section-title">
                    📊 Allocation Summary
                  </h3>

                  <div className="tech-add-farmer-summary-totals-grid">
                    <div
                      className={`tech-add-farmer-summary-total-card ${fertilizerTotals.remaining < 0 ? "is-warning" : ""}`}
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
                      className={`tech-add-farmer-summary-total-card ${seedTotals.remaining < 0 ? "is-warning" : ""}`}
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
                    <div className="tech-add-farmer-summary-table-wrap">
                      <h4 className="tech-add-farmer-summary-subtitle">
                        Fertilizer Items
                      </h4>
                      <div className="tech-add-farmer-summary-table">
                        <div className="tech-add-farmer-summary-header">
                          <span>Item</span>
                          <span>Allocated</span>
                          <span>Entered</span>
                          <span>Remaining</span>
                        </div>
                        {fertilizerSummaryItems.map((item) => (
                          <div
                            key={item.label}
                            className={`tech-add-farmer-summary-row ${item.remaining < 0 ? "is-warning" : ""}`}
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
                    <div className="tech-add-farmer-summary-table-wrap">
                      <h4 className="tech-add-farmer-summary-subtitle">
                        Seed Items
                      </h4>
                      <div className="tech-add-farmer-summary-table">
                        <div className="tech-add-farmer-summary-header">
                          <span>Item</span>
                          <span>Allocated</span>
                          <span>Entered</span>
                          <span>Remaining</span>
                        </div>
                        {seedSummaryItems.map((item) => (
                          <div
                            key={item.label}
                            className={`tech-add-farmer-summary-row ${item.remaining < 0 ? "is-warning" : ""}`}
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

              <div className="tech-add-farmer-section">
                <h3 className="tech-add-farmer-section-title">
                  🌱 Requested Fertilizers (bags)
                </h3>
                <div className="tech-add-farmer-form-grid">
                  {visibleFertilizerItems.length === 0 ? (
                    <div className="tech-add-farmer-empty-state">
                      No fertilizer items are available in this allocation.
                    </div>
                  ) : (
                    visibleFertilizerItems.map((item) => (
                      <div
                        key={item.requestField}
                        className="tech-add-farmer-form-group"
                      >
                        <label className="tech-add-farmer-label">
                          {item.label}
                        </label>
                        <input
                          type="number"
                          name={item.requestField}
                          value={Number(formData[item.requestField]) || 0}
                          onChange={handleInputChange}
                          min="0"
                          step="1"
                          className="tech-add-farmer-input"
                        />
                        {getInlineExceedAmount(item) > 0 && (
                          <div className="tech-add-farmer-inline-exceed">
                            the allocation exceeds by{" "}
                            {formatSummaryValue(getInlineExceedAmount(item))}{" "}
                            {item.requestField.includes("liters")
                              ? "liters"
                              : item.requestField.includes("_kg")
                                ? "kg"
                                : "bags"}
                            .
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="tech-add-farmer-section">
                <h3 className="tech-add-farmer-section-title">
                  🌾 Requested Seeds (kg)
                </h3>
                <div className="tech-add-farmer-form-grid">
                  {visibleSeedItems.length === 0 ? (
                    <div className="tech-add-farmer-empty-state">
                      No seed items are available in this allocation.
                    </div>
                  ) : (
                    visibleSeedItems.map((item) => (
                      <div
                        key={item.requestField}
                        className="tech-add-farmer-form-group"
                      >
                        <label className="tech-add-farmer-label">
                          {item.label}
                        </label>
                        <input
                          type="number"
                          name={item.requestField}
                          value={Number(formData[item.requestField]) || 0}
                          onChange={handleInputChange}
                          min="0"
                          step="any"
                          inputMode="decimal"
                          className="tech-add-farmer-input"
                        />
                        {getInlineExceedAmount(item) > 0 && (
                          <div className="tech-add-farmer-inline-exceed">
                            the allocation exceeds by{" "}
                            {formatSummaryValue(getInlineExceedAmount(item))}{" "}
                            kg.
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {!hasVisibleAllocationItems && (
                <div className="tech-add-farmer-error-box">
                  This allocation has no items with values greater than zero.
                </div>
              )}

              {/* Notes */}
              <div className="tech-add-farmer-section">
                <label className="tech-add-farmer-label">Notes / Remarks</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Add any additional notes..."
                  className="tech-add-farmer-textarea"
                />
              </div>

              {error && (
                <div className="tech-add-farmer-error-box">{error}</div>
              )}

              {hasOverAllocation && (
                <div className="tech-add-farmer-warning-box">
                  Some entered values exceed allocation. You can still submit,
                  but please review remaining values highlighted in red.
                </div>
              )}

              {/* Action Buttons */}
              <div className="tech-add-farmer-actions">
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/technician-manage-requests/${allocationId}`)
                  }
                  className="tech-add-farmer-cancel-btn"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="tech-add-farmer-submit-btn"
                  disabled={loading || !hasVisibleAllocationItems}
                >
                  {loading ? "💾 Saving..." : "✅ Add Farmer Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast.show && (
        <div className={`tech-toast-notification tech-toast-${toast.type}`}>
          <div className="tech-toast-icon">
            {toast.type === "success" && "✅"}
            {toast.type === "error" && "❌"}
            {toast.type === "warning" && "⚠️"}
          </div>
          <div className="tech-toast-content">
            <span className="tech-toast-message">{toast.message}</span>
          </div>
          <button
            className="tech-toast-close"
            onClick={() => setToast((prev) => ({ ...prev, show: false }))}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};

export default TechAddFarmerRequest;
