import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  getLandOwners,
  getLandOwnerById,
  getFarmParcels,
  createRsbsaSubmission,
  getRegisteredFarmers,
  replaceCurrentTenantLessee,
} from "../../api";
import { supabase } from "../../supabase";
import { getAuditLogger } from "../../components/Audit/auditLogger";
import "../../assets/css/jo css/JoRsbsaRegistrationStyle.css";
import JOSidebar from "../../components/layout/JOSidebar";
import { getCurrentUserForAudit } from "../../components/Audit/getCurrentUserForAudit";
import BirthDatePicker from "../../components/common/BirthDatePicker";

interface Parcel {
  parcelNo: string;
  farmLocationBarangay: string;
  farmLocationMunicipality: string;
  totalFarmAreaHa: string;
  withinAncestralDomain: string; // 'Yes' | 'No'
  ownershipDocumentNo: string;
  agrarianReformBeneficiary: string; // 'Yes' | 'No'
  ownershipTypeRegisteredOwner: boolean;
  ownershipTypeTenant: boolean; // ✅ accepts isTenant
  isCultivating: boolean;
  ownershipTypeLessee: boolean;
  ownershipTypeOthers: boolean;
  tenantLandOwnerName: string;
  lesseeLandOwnerName: string;
  tenantLandOwnerId?: number | null;
  lesseeLandOwnerId?: number | null;
  ownershipOthersSpecify: string;
  // New field for linking to existing land_parcels
  existingParcelId?: number;
  existingParcelNumber?: string;
}

interface LandOwner {
  id: number;
  name: string;
  barangay?: string;
  municipality?: string;
  parcelCount?: number;
  isRegisteredFarmer?: boolean;
}

// Interface for existing parcels from land_parcels table
interface ExistingParcel {
  id: number;
  parcel_number: string;
  farm_location_barangay: string;
  farm_location_municipality: string;
  total_farm_area_ha: number;
  current_holder?: string;
  ownership_type?: string;
}

interface AdditionalLandOwnerGroup {
  groupId: string;
  landOwner: any | null;
  searchTerm: string;
  showDropdown: boolean;
  parcels: any[];
  selectedParcelIds: Set<string>;
}

interface FormData {
  // Basic Details
  surname: string;
  firstName: string;
  middleName: string;
  extensionName: string;
  houseNumber: string;
  gender: string;
  street: string;
  barangay: string;
  municipality: string;
  province: string;
  dateOfBirth: string;
  age: string;
  // Farm Profile
  mainLivelihood: string;
  isActivelyFarming: boolean;
  farmingActivity: string;
  otherCrops: string;
  livestock: string;
  poultry: string;
  // Farmland Parcels
  farmlandParcels: Parcel[];
  // Dynamic Fields
  farmerRice?: boolean;
  farmerCorn?: boolean;
  farmerOtherCrops?: boolean;
  farmerOtherCropsText?: string;
  farmerLivestock?: boolean;
  farmerLivestockText?: string;
  farmerPoultry?: boolean;
  farmerPoultryText?: string;
  fwLandPrep?: boolean;
  fwPlanting?: boolean;
  fwCultivation?: boolean;
  fwHarvesting?: boolean;
  fwOthers?: boolean;
  fwOthersText?: string;
  ffFishCapture?: boolean;
  ffAquaculture?: boolean;
  ffGleaning?: boolean;
  ffFishProcessing?: boolean;
  ffFishVending?: boolean;
  ffOthers?: boolean;
  ffOthersText?: string;
  ayPartHousehold?: boolean;
  ayFormalCourse?: boolean;
  ayNonFormalCourse?: boolean;
  ayParticipatedProgram?: boolean;
  ayOthers?: boolean;
  ayOthersText?: string;
}

// Utility function to convert text to Title Case with special handling
const toTitleCase = (text: string): string => {
  if (!text) return "";

  // Special words that should remain lowercase (unless at start)
  const lowercase = ["de", "del", "dela", "ng", "sa", "and", "or", "the"];

  // Special words that should be uppercase
  const uppercase = ["ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];

  // Extension name handling
  const extensions: Record<string, string> = {
    jr: "Jr.",
    sr: "Sr.",
    "jr.": "Jr.",
    "sr.": "Sr.",
  };

  return text
    .toLowerCase()
    .split(" ")
    .map((word, index) => {
      // Handle empty strings
      if (!word) return word;

      // Check if it's an extension
      const ext = extensions[word.replace(/\./g, "")];
      if (ext) return ext;

      // Check if it's a roman numeral
      if (uppercase.includes(word)) return word.toUpperCase();

      // Handle hyphenated words (e.g., "Aurora-Del Pilar")
      if (word.includes("-")) {
        return word
          .split("-")
          .map((part) => {
            if (!part) return part;
            // Check if hyphenated part should be lowercase
            if (lowercase.includes(part) && index !== 0) return part;
            return part.charAt(0).toUpperCase() + part.slice(1);
          })
          .join("-");
      }

      // Check if word should remain lowercase (except at start)
      if (lowercase.includes(word) && index !== 0) return word;

      // Default: capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ")
    .trim();
};

const JoRsbsa: React.FC = () => {
  const navigate = useNavigate();

  type OwnershipCategory = "tenant" | "lessee" | "owner";

  const [_activeTab] = useState("overview");

  const [draftId, _setDraftId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [landowners, setLandowners] = useState<LandOwner[]>([]);

  // New state for ownership category selection
  const [ownershipCategory, setOwnershipCategory] =
    useState<OwnershipCategory>("tenant");

  const [selectedLandOwner, setSelectedLandOwner] = useState<any>(null);
  const [landOwnerSearchTerm, setLandOwnerSearchTerm] = useState("");
  const [showLandOwnerDropdown, setShowLandOwnerDropdown] = useState(false);
  const [ownerParcels, setOwnerParcels] = useState<any[]>([]);
  const [selectedParcelIds, setSelectedParcelIds] = useState<Set<string>>(
    new Set(),
  );

  // State for existing parcel selection (for registered owners)
  const [allRegisteredOwners, setAllRegisteredOwners] = useState<
    ExistingParcel[]
  >([]);
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    roleText: string;
    parcelCount: number;
    landOwnerName: string;
  }>({
    show: false,
    roleText: "",
    parcelCount: 0,
    landOwnerName: "",
  });

  const [isManualLandowner, setIsManualLandowner] = useState(false);
  const [manualLandownerName, setManualLandownerName] = useState("");

  // ── Farmer role picker: Land Owner / Tenant / Lessee ────────────────────
  const [farmerRole, setFarmerRole] = useState<
    "owner" | "tenant" | "lessee" | null
  >(null);

  // ── Land Owner path Step 1: search for own LO record ────────────────────
  const [selectedSelfLandOwner, setSelectedSelfLandOwner] = useState<any>(null);
  const [selfSearchTerm, setSelfSearchTerm] = useState("");
  const [showSelfDropdown, setShowSelfDropdown] = useState(false);
  const [isFetchingSelfRecord, setIsFetchingSelfRecord] = useState(false);

  // ── Land Owner path Step 3: owned parcels + which ones to farm ───────────
  const [ownedParcels, setOwnedParcels] = useState<any[]>([]);
  const [selectedOwnedParcelIds, setSelectedOwnedParcelIds] = useState<
    Set<string>
  >(new Set());

  // ── Land Owner path Step 3: "do you also farm others' land?" ────────────
  const [alsoFarmsOthersLand, setAlsoFarmsOthersLand] = useState<
    boolean | null
  >(null);

  // ── Tenant/Lessee: farming activities per selected land owner ────────────
  // keyed by land owner ID, populated as each land owner is selected
  const [landOwnerActivities, setLandOwnerActivities] = useState<
    Record<
      number,
      {
        name: string;
        farmerRice: boolean;
        farmerCorn: boolean;
        farmerOtherCrops: boolean;
        farmerOtherCropsText: string;
        farmerLivestock: boolean;
        farmerLivestockText: string;
        farmerPoultry: boolean;
        farmerPoultryText: string;
      }
    >
  >({});

  // ── Per-parcel farmer search inputs (YES path cards) ────────────────────
  const [parcelFarmerSearchTerm, setParcelFarmerSearchTerm] = useState<
    Record<string, string>
  >({});
  const [showParcelFarmerDropdown, setShowParcelFarmerDropdown] = useState<
    Record<string, boolean>
  >({});

  // ── Registered farmers list for tenant/lessee lookup dropdowns ───────────
  // Populated from landowners list; can be extended to a separate fetch if needed
  const [registeredFarmers, setRegisteredFarmers] = useState<
    Array<{ id: number; name: string; barangay?: string }>
  >([]);

  const [additionalLandOwnerGroups, setAdditionalLandOwnerGroups] = useState<
    AdditionalLandOwnerGroup[]
  >([]);

  // Show toast notification
  const showToast = (
    message: string,
    type: "success" | "error" | "warning" = "success",
  ) => {
    setToast({ show: true, message, type });
    // Auto-hide after 4 seconds for success, longer for errors
    setTimeout(
      () => {
        setToast((prev) => ({ ...prev, show: false }));
      },
      type === "success" ? 4000 : 5000,
    );
  };

  const BARANGAY_OPTIONS = [
    "Aurora-Del Pilar",
    "Bacay",
    "Bacong",
    "Balabag",
    "Balud",
    "Bantud",
    "Bantud Fabrica",
    "Baras",
    "Barasan",
    "Basa-Mabini Bonifacio",
    "Bolilao",
    "Buenaflor Embarkadero",
    "Burgos-Regidor",
    "Calao",
    "Cali",
    "Cansilayan",
    "Capaliz",
    "Cayos",
    "Compayan",
    "Dacutan",
    "Ermita",
    "Ilaya 1st",
    "Ilaya 2nd",
    "Ilaya 3rd",
    "Jardin",
    "Lacturan",
    "Lopez Jaena - Rizal",
    "Managuit",
    "Maquina",
    "Nanding Lopez",
    "Pagdugue",
    "Paloc Bigque",
    "Paloc Sool",
    "Patlad",
    "Pd Monfort North",
    "Pd Monfort South",
    "Pulao",
    "Rosario",
    "Sapao",
    "Sulangan",
    "Tabucan",
    "Talusan",
    "Tambobo",
    "Tamboilan",
    "Victorias",
  ];

  // Load all registered owners with their parcels on mount
  useEffect(() => {
    const fetch = async () => {
      const response = await getLandOwners();
      // A 207 means the owner list is usable but the "already registered"
      // flags could not be verified — show a warning, don't discard the data.
      // Any other error means there's no usable list at all.
      if (response.error && response.status !== 207) return;
      if (response.status === 207 && response.error) {
        showToast(response.error, "warning");
      }
      const owners = (response.data || []) as LandOwner[];
      setLandowners(owners);

      // registeredFarmers needs to cover EVERY submission (not just land
      // owners) so a parcel's cultivator_submission_id -- which can be a
      // Tenant/Lessee who never appears in getLandOwners() -- can still be
      // resolved to a display name for the "already farmed by" badge.
      const allFarmersResp = await getRegisteredFarmers();
      if (!allFarmersResp.error) {
        setRegisteredFarmers(
          (allFarmersResp.data || []) as Array<{
            id: number;
            name: string;
            barangay?: string;
          }>,
        );
      } else {
        // Fall back to the land-owner-only list rather than an empty map
        setRegisteredFarmers(
          owners as Array<{ id: number; name: string; barangay?: string }>,
        );
      }

      // Build allRegisteredOwners from the same fetch
      const ownerIds = owners.map((o) => Number(o.id)).filter(Number.isFinite);
      if (!ownerIds.length) {
        setAllRegisteredOwners([]);
        return;
      }
      const { data: parcels } = await supabase
        .from("rsbsa_farm_parcels")
        .select(
          "id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, submission_id, ownership_type_registered_owner, is_current_owner",
        )
        .in("submission_id", ownerIds)
        .eq("ownership_type_registered_owner", true)
        .or("is_current_owner.is.null,is_current_owner.eq.true");

      const nameMap: Record<number, string> = {};
      owners.forEach((o) => {
        nameMap[Number(o.id)] = o.name;
      });
      setAllRegisteredOwners(
        (parcels || []).map((p: any) => ({
          id: p.id,
          parcel_number: p.parcel_number || `Parcel-${p.submission_id}`,
          farm_location_barangay: p.farm_location_barangay || "",
          farm_location_municipality:
            p.farm_location_municipality || "Dumangas",
          total_farm_area_ha: p.total_farm_area_ha || 0,
          current_holder: nameMap[p.submission_id] || "Unknown",
          ownership_type: "Owner",
        })),
      );
    };
    fetch();
  }, []);

  // ── Merge land owner farming activities into formData on Step 3 entry ────
  // Tenant / Lessee path only: takes the union of every selected land owner's
  // activities so the read-only preview and Step 4 summary are accurate.
  useEffect(() => {
    if (currentStep !== 3) return;
    if (farmerRole !== "tenant" && farmerRole !== "lessee") return;

    const allOwnerIds: number[] = [
      selectedLandOwner ? Number(selectedLandOwner.id) : null,
      ...additionalLandOwnerGroups
        .filter((g) => g.landOwner)
        .map((g) => Number(g.landOwner.id)),
    ].filter((id): id is number => id !== null && Number.isFinite(id));

    let farmerRice = false;
    let farmerCorn = false;
    let farmerOtherCrops = false;
    const farmerOtherCropsTexts: string[] = [];
    let farmerLivestock = false;
    const farmerLivestockTexts: string[] = [];
    let farmerPoultry = false;
    const farmerPoultryTexts: string[] = [];

    allOwnerIds.forEach((id) => {
      const act = landOwnerActivities[id];
      if (!act) return;
      if (act.farmerRice) farmerRice = true;
      if (act.farmerCorn) farmerCorn = true;
      if (act.farmerOtherCrops) {
        farmerOtherCrops = true;
        if (act.farmerOtherCropsText)
          farmerOtherCropsTexts.push(act.farmerOtherCropsText);
      }
      if (act.farmerLivestock) {
        farmerLivestock = true;
        if (act.farmerLivestockText)
          farmerLivestockTexts.push(act.farmerLivestockText);
      }
      if (act.farmerPoultry) {
        farmerPoultry = true;
        if (act.farmerPoultryText)
          farmerPoultryTexts.push(act.farmerPoultryText);
      }
    });

    setFormData((prev) => ({
      ...prev,
      farmerRice,
      farmerCorn,
      farmerOtherCrops,
      farmerOtherCropsText: [...new Set(farmerOtherCropsTexts)].join(", "),
      farmerLivestock,
      farmerLivestockText: [...new Set(farmerLivestockTexts)].join(", "),
      farmerPoultry,
      farmerPoultryText: [...new Set(farmerPoultryTexts)].join(", "),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  const [formData, setFormData] = useState<FormData>({
    surname: "",
    firstName: "",
    middleName: "",
    extensionName: "",
    houseNumber: "",
    gender: "",
    street: "",
    barangay: "",
    municipality: "Dumangas",
    province: "",
    dateOfBirth: "",
    age: "",
    mainLivelihood: "farmer",
    farmingActivity: "",
    isActivelyFarming: true,
    otherCrops: "",
    livestock: "",
    poultry: "",
    farmlandParcels: [
      {
        parcelNo: "1",
        farmLocationBarangay: "",
        farmLocationMunicipality: "",
        totalFarmAreaHa: "",
        withinAncestralDomain: "",
        isCultivating: true,
        ownershipDocumentNo: "",
        agrarianReformBeneficiary: "",
        ownershipTypeRegisteredOwner: false, // Default to registered owner
        ownershipTypeTenant: true,
        ownershipTypeLessee: false,
        ownershipTypeOthers: false,
        tenantLandOwnerName: "",
        lesseeLandOwnerName: "",
        ownershipOthersSpecify: "",
      },
    ],
    farmerRice: false,
    farmerCorn: false,
    farmerOtherCrops: false,
    farmerOtherCropsText: "",
    farmerLivestock: false,
    farmerLivestockText: "",
    farmerPoultry: false,
    farmerPoultryText: "",
    fwLandPrep: false,
    fwPlanting: false,
    fwCultivation: false,
    fwHarvesting: false,
    fwOthers: false,
    fwOthersText: "",
    ffFishCapture: false,
    ffAquaculture: false,
    ffGleaning: false,
    ffFishProcessing: false,
    ffFishVending: false,
    ffOthers: false,
    ffOthersText: "",
    ayPartHousehold: false,
    ayFormalCourse: false,
    ayNonFormalCourse: false,
    ayParticipatedProgram: false,
    ayOthers: false,
    ayOthersText: "",
  });

  // validation errors (field name -> message)
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Handler for text inputs with Title Case formatting
  const handleTextInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  // Handler for onBlur to format text fields
  const handleTextInputBlur = (field: keyof FormData) => {
    const value = formData[field];
    if (typeof value === "string" && value.trim()) {
      const formatted = toTitleCase(value);
      setFormData((prev) => ({ ...prev, [field]: formatted }));
    }
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // clear any existing error for this field
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleParcelChange = (idx: number, field: keyof Parcel, value: any) => {
    setFormData((prev) => {
      const parcels = [...prev.farmlandParcels];
      // Create a new parcel object with the updated field
      parcels[idx] = { ...parcels[idx], [field]: value };
      return { ...prev, farmlandParcels: parcels };
    });
    // Clear any farmland validation errors when the user starts typing
    setErrors((prev) => ({ ...prev, farmland: "" }));
  };

  const toggleBool = (field: keyof FormData) => {
    setFormData((prev) => ({ ...prev, [field]: !prev[field] }));
    // Clear farmingActivity error when any activity checkbox is toggled
    setErrors((prev) => ({ ...prev, farmingActivity: "" }));
  };

  // Handle ownership category change (Registered Owner, Tenant, Lessee)
  const handleOwnershipCategoryChange = (category: OwnershipCategory) => {
    setOwnershipCategory(category);
    setSelectedLandOwner(null);
    setLandOwnerSearchTerm("");
    setShowLandOwnerDropdown(false);
    setOwnerParcels([]);
    setSelectedParcelIds(new Set());
    setIsManualLandowner(false);
    setAdditionalLandOwnerGroups([]);
    setErrors((prev) => ({
      ...prev,
      farmland: "",
      landOwner: "",
      parcelSelection: "",
    }));

    const isTenant = category === "tenant";
    const isLessee = category === "lessee";
    const isOwner = category === "owner";

    if (isOwner) {
      // Reset to a single blank parcel pre-set for registered owner
      setFormData((prev) => ({
        ...prev,
        farmlandParcels: [
          {
            parcelNo: "1",
            farmLocationBarangay: "",
            farmLocationMunicipality: "Dumangas",
            totalFarmAreaHa: "",
            withinAncestralDomain: "",
            isCultivating: true,
            ownershipDocumentNo: "",
            agrarianReformBeneficiary: "",
            ownershipTypeRegisteredOwner: true,
            ownershipTypeTenant: false,
            ownershipTypeLessee: false,
            ownershipTypeOthers: false,
            tenantLandOwnerName: "",
            lesseeLandOwnerName: "",
            ownershipOthersSpecify: "",
          },
        ],
      }));
    } else {
      // Clear or set ownership type checkboxes based on selection
      setFormData((prev) => {
        const parcels = prev.farmlandParcels.map((p) => ({
          ...p,
          ownershipTypeRegisteredOwner: false,
          ownershipTypeTenant: isTenant,
          ownershipTypeLessee: isLessee,
          tenantLandOwnerName: isTenant ? p.tenantLandOwnerName : "",
          lesseeLandOwnerName: isLessee ? p.lesseeLandOwnerName : "",
          isCultivating: true,
        })) as Parcel[];
        return { ...prev, farmlandParcels: parcels };
      });
    }
  };

  // Add / remove parcels for the Land Owner path
  const addOwnerParcel = () => {
    setFormData((prev) => ({
      ...prev,
      farmlandParcels: [
        ...prev.farmlandParcels,
        {
          parcelNo: String(prev.farmlandParcels.length + 1),
          farmLocationBarangay: "",
          farmLocationMunicipality: "Dumangas",
          totalFarmAreaHa: "",
          withinAncestralDomain: "",
          isCultivating: true,
          ownershipDocumentNo: "",
          agrarianReformBeneficiary: "",
          ownershipTypeRegisteredOwner: true,
          ownershipTypeTenant: false,
          ownershipTypeLessee: false,
          ownershipTypeOthers: false,
          tenantLandOwnerName: "",
          lesseeLandOwnerName: "",
          ownershipOthersSpecify: "",
        },
      ],
    }));
  };

  const removeOwnerParcel = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      farmlandParcels: prev.farmlandParcels
        .filter((_, i) => i !== idx)
        .map((p, i) => ({ ...p, parcelNo: String(i + 1) })),
    }));
  };

  // Handle land owner selection for tenant/lessee
  const handleLandOwnerSelect = async (owner: any) => {
    setSelectedLandOwner(owner);
    setLandOwnerSearchTerm(owner.name);
    setShowLandOwnerDropdown(false);
    setSelectedParcelIds(new Set());
    setErrors((prev) => ({ ...prev, landOwner: "", parcelSelection: "" }));

    try {
      // Fetch parcels for selection
      const parcelResp = await getFarmParcels(owner.id, {
        currentOwnerOnly: true,
      });
      if (!parcelResp.error) {
        const parcels = (parcelResp.data || []).filter((parcel: any) => {
          if (!parcel) return false;
          const isOwnerParcel =
            parcel.ownership_type_registered_owner === undefined
              ? true
              : parcel.ownership_type_registered_owner === true;
          const isCurrent = parcel.is_current_owner !== false;
          return isOwnerParcel && isCurrent;
        });
        setOwnerParcels(parcels);
        if (!parcels || parcels.length === 0) {
          console.warn("No parcels found for land owner");
        }
      } else {
        setOwnerParcels([]);
      }

      // For Tenant / Lessee: also pre-fill Step 3 farming activities
      // from the land owner's submission record
      if (farmerRole === "tenant" || farmerRole === "lessee") {
        const recordResp = await getLandOwnerById(Number(owner.id));
        if (!recordResp.error && recordResp.data) {
          const r = recordResp.data;
          const activities = {
            name: owner.name,
            farmerRice: r.farmerRice ?? false,
            farmerCorn: r.farmerCorn ?? false,
            farmerOtherCrops: r.farmerOtherCrops ?? false,
            farmerOtherCropsText: r.farmerOtherCropsText ?? "",
            farmerLivestock: r.farmerLivestock ?? false,
            farmerLivestockText: r.farmerLivestockText ?? "",
            farmerPoultry: r.farmerPoultry ?? false,
            farmerPoultryText: r.farmerPoultryText ?? "",
          };
          // Clear primary owner slot and rebuild — keep additional group entries
          setLandOwnerActivities((prev) => {
            const next = { ...prev, [owner.id]: activities };
            return next;
          });
        }
      }
    } catch (error) {
      console.error("Error in handleLandOwnerSelect:", error);
      setOwnerParcels([]);
    }
  };

  // Handle parcel selection toggle
  const handleParcelSelectionToggle = (parcelId: string | number) => {
    const normalizedParcelId = String(parcelId);
    setSelectedParcelIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(normalizedParcelId)) {
        newSet.delete(normalizedParcelId);
      } else {
        newSet.add(normalizedParcelId);
      }
      return newSet;
    });
    setErrors((prev) => ({ ...prev, parcelSelection: "" }));
  };

  // ── Helpers for multi-owner groups (tenant/lessee path) ──────────────
  const addLandOwnerGroup = () => {
    setAdditionalLandOwnerGroups((prev) => [
      ...prev,
      {
        groupId: String(Date.now()),
        landOwner: null,
        searchTerm: "",
        showDropdown: false,
        parcels: [],
        selectedParcelIds: new Set(),
      },
    ]);
  };

  const removeLandOwnerGroup = (groupId: string) => {
    setAdditionalLandOwnerGroups((prev) =>
      prev.filter((g) => g.groupId !== groupId),
    );
  };

  const updateAdditionalGroup = (
    groupId: string,
    updates: Partial<AdditionalLandOwnerGroup>,
  ) => {
    setAdditionalLandOwnerGroups((prev) =>
      prev.map((g) => (g.groupId === groupId ? { ...g, ...updates } : g)),
    );
  };

  const handleAdditionalLandOwnerSelect = async (
    groupId: string,
    owner: any,
  ) => {
    updateAdditionalGroup(groupId, {
      landOwner: owner,
      searchTerm: owner.name,
      showDropdown: false,
      parcels: [],
      selectedParcelIds: new Set(),
    });
    try {
      // Fetch parcels for this group
      const response = await getFarmParcels(owner.id, {
        currentOwnerOnly: true,
      });
      if (!response.error) {
        const parcels = (response.data || []).filter((parcel: any) => {
          if (!parcel) return false;
          const isOwnerParcel =
            parcel.ownership_type_registered_owner === undefined
              ? true
              : parcel.ownership_type_registered_owner === true;
          return isOwnerParcel && parcel.is_current_owner !== false;
        });
        updateAdditionalGroup(groupId, { parcels });
      } else {
        updateAdditionalGroup(groupId, { parcels: [] });
      }

      // Also fetch and store farming activities for this land owner
      if (farmerRole === "tenant" || farmerRole === "lessee") {
        const recordResp = await getLandOwnerById(Number(owner.id));
        if (!recordResp.error && recordResp.data) {
          const r = recordResp.data;
          setLandOwnerActivities((prev) => ({
            ...prev,
            [owner.id]: {
              name: owner.name,
              farmerRice: r.farmerRice ?? false,
              farmerCorn: r.farmerCorn ?? false,
              farmerOtherCrops: r.farmerOtherCrops ?? false,
              farmerOtherCropsText: r.farmerOtherCropsText ?? "",
              farmerLivestock: r.farmerLivestock ?? false,
              farmerLivestockText: r.farmerLivestockText ?? "",
              farmerPoultry: r.farmerPoultry ?? false,
              farmerPoultryText: r.farmerPoultryText ?? "",
            },
          }));
        }
      }
    } catch (error) {
      console.error("Error fetching parcels for additional group:", error);
      updateAdditionalGroup(groupId, { parcels: [] });
    }
  };

  // Apply selected parcels to form data (called internally after confirmation)
  const applySelectedParcels = () => {
    const isTenant = ownershipCategory === "tenant";
    const isLessee = ownershipCategory === "lessee";

    // Primary land owner parcels
    const primarySelected = ownerParcels.filter((p) =>
      selectedParcelIds.has(String(p.id)),
    );
    console.log("📋 Applying selected parcels:", primarySelected);

    const primaryMapped: Parcel[] = primarySelected.map(
      (ownerParcel: any, index: number) => ({
        parcelNo: String(index + 1),
        farmLocationBarangay: ownerParcel.farm_location_barangay || "",
        farmLocationMunicipality:
          ownerParcel.farm_location_municipality || "Dumangas",
        totalFarmAreaHa: String(ownerParcel.total_farm_area_ha || ""),
        withinAncestralDomain: ownerParcel.within_ancestral_domain || "",
        ownershipDocumentNo: ownerParcel.ownership_document_no || "",
        agrarianReformBeneficiary:
          ownerParcel.agrarian_reform_beneficiary || "",
        isCultivating: true,
        ownershipTypeRegisteredOwner: false,
        ownershipTypeTenant: isTenant,
        ownershipTypeLessee: isLessee,
        ownershipTypeOthers: false,
        tenantLandOwnerName: isTenant ? selectedLandOwner.name : "",
        lesseeLandOwnerName: isLessee ? selectedLandOwner.name : "",
        tenantLandOwnerId: isTenant ? selectedLandOwner.id : null,
        lesseeLandOwnerId: isLessee ? selectedLandOwner.id : null,
        ownershipOthersSpecify: "",
        existingParcelId: ownerParcel.land_parcel_id || ownerParcel.id,
        existingParcelNumber: ownerParcel.parcel_number || "",
      }),
    );

    // Additional land owner groups
    let counter = primaryMapped.length;
    const additionalMapped: Parcel[] = additionalLandOwnerGroups.flatMap(
      (group) => {
        if (!group.landOwner) return [];
        return group.parcels
          .filter((p) => group.selectedParcelIds.has(String(p.id)))
          .map((ownerParcel: any) => {
            counter++;
            return {
              parcelNo: String(counter),
              farmLocationBarangay: ownerParcel.farm_location_barangay || "",
              farmLocationMunicipality:
                ownerParcel.farm_location_municipality || "Dumangas",
              totalFarmAreaHa: String(ownerParcel.total_farm_area_ha || ""),
              withinAncestralDomain: ownerParcel.within_ancestral_domain || "",
              ownershipDocumentNo: ownerParcel.ownership_document_no || "",
              agrarianReformBeneficiary:
                ownerParcel.agrarian_reform_beneficiary || "",
              isCultivating: true,
              ownershipTypeRegisteredOwner: false,
              ownershipTypeTenant: isTenant,
              ownershipTypeLessee: isLessee,
              ownershipTypeOthers: false,
              tenantLandOwnerName: isTenant ? group.landOwner.name : "",
              lesseeLandOwnerName: isLessee ? group.landOwner.name : "",
              ownershipOthersSpecify: "",
              existingParcelId: ownerParcel.land_parcel_id || ownerParcel.id,
              existingParcelNumber: ownerParcel.parcel_number || "",
            };
          });
      },
    );

    console.log("📋 Mapped parcels with existingParcelId:", [
      ...primaryMapped,
      ...additionalMapped,
    ]);
    setFormData((prev) => ({
      ...prev,
      farmlandParcels: [...primaryMapped, ...additionalMapped],
    }));
    setErrors((prev) => ({ ...prev, parcelSelection: "" }));
  };

  // Lookup map: submission id -> display name, built from registeredFarmers
  // (all submissions, not just land owners). Used to resolve a parcel's
  // cultivator_submission_id to a name for the "already farmed by" badge.
  const farmerNameById = useMemo(() => {
    const map = new Map<number, string>();
    registeredFarmers.forEach((f: any) => {
      const id = Number(f?.id);
      if (Number.isFinite(id)) map.set(id, f?.name || `Farmer #${id}`);
    });
    return map;
  }, [registeredFarmers]);

  // Given a parcel from ownerParcels/group.parcels and the owner it belongs
  // to, determine whether it's already being farmed by someone else (a
  // different active tenant/lessee), and if so, who.
  const getParcelReplacementInfo = (parcel: any, ownerId: any) => {
    const cultivatorId = parcel?.cultivator_submission_id
      ? Number(parcel.cultivator_submission_id)
      : null;
    const ownerIdNum = ownerId ? Number(ownerId) : null;
    if (!cultivatorId || !Number.isFinite(cultivatorId)) {
      return {
        isReplacement: false,
        currentHolderId: null,
        currentHolderName: null,
      };
    }
    if (ownerIdNum !== null && cultivatorId === ownerIdNum) {
      // Owner is cultivating it themselves — not a replacement case.
      return {
        isReplacement: false,
        currentHolderId: null,
        currentHolderName: null,
      };
    }
    return {
      isReplacement: true,
      currentHolderId: cultivatorId,
      currentHolderName:
        farmerNameById.get(cultivatorId) || `Farmer #${cultivatorId}`,
    };
  };

  // Filter land owners based on search term
  const filteredLandOwners = useMemo(
    () =>
      landowners.filter((o) =>
        o.name.toLowerCase().includes(landOwnerSearchTerm.toLowerCase()),
      ),
    [landowners, landOwnerSearchTerm],
  );

  // Filter landowners for the self-search in Step 1 (YES path)
  const filteredSelfOwners = useMemo(
    () =>
      landowners.filter((o) =>
        o.name.toLowerCase().includes(selfSearchTerm.toLowerCase()),
      ),
    [landowners, selfSearchTerm],
  );

  // Controls whether the "Search Land Owner" block is shown:
  // always for NO path (tenant/lessee), and for YES path only when also farming others' land
  const showLandOwnerSearch =
    farmerRole === "tenant" ||
    farmerRole === "lessee" ||
    (farmerRole === "owner" && alsoFarmsOthersLand === true);

  const showParcelSelection =
    showLandOwnerSearch &&
    selectedLandOwner !== null &&
    ownershipCategory !== "owner";

  // Whether Step 1 + Step 2 fields are pre-filled from the selected LO record
  const isPreFilled = farmerRole === "owner" && selectedSelfLandOwner !== null;

  const handleSelfLandOwnerSelect = async (owner: any) => {
    setSelectedSelfLandOwner(owner);
    setSelfSearchTerm(owner.name);
    setShowSelfDropdown(false);
    setIsFetchingSelfRecord(true);
    setOwnedParcels([]);
    setSelectedOwnedParcelIds(new Set());
    setErrors((prev) => ({ ...prev, selfLandOwner: "", farmerRole: "" }));

    try {
      const recordResp = await getLandOwnerById(Number(owner.id));
      if (!recordResp.error && recordResp.data) {
        const r = recordResp.data;
        const dateOfBirth = r.birthdate ?? r.dateOfBirth ?? "";
        let age = "";
        if (dateOfBirth) {
          const birth = new Date(dateOfBirth + "T00:00:00");
          const today = new Date();
          let a = today.getFullYear() - birth.getFullYear();
          const m = today.getMonth() - birth.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) a--;
          age = String(a);
        }
        setFormData((prev) => ({
          ...prev,
          firstName: r.firstName,
          surname: r.lastName ?? r.surname ?? "",
          middleName: r.middleName,
          extensionName: r.extName ?? r.extensionName ?? "",
          gender: r.gender ?? "",
          dateOfBirth, // Fix: using corrected value above
          age,
          barangay: r.barangay,
          municipality: r.municipality || "Dumangas",
          // Step 2: farming activities pre-filled from Land Owner record
          farmerRice: r.farmerRice ?? false,
          farmerCorn: r.farmerCorn ?? false,
          farmerOtherCrops: r.farmerOtherCrops ?? false,
          farmerOtherCropsText: r.farmerOtherCropsText ?? "",
          farmerLivestock: r.farmerLivestock ?? false,
          farmerLivestockText: r.farmerLivestockText ?? "",
          farmerPoultry: r.farmerPoultry ?? false,
          farmerPoultryText: r.farmerPoultryText ?? "",
        }));
      }

      const parcelResp = await getFarmParcels(owner.id, {
        currentOwnerOnly: true,
      });
      if (!parcelResp.error) {
        const parcels = (parcelResp.data || []).filter((p: any) => {
          if (!p) return false;
          const isOwner =
            p.ownership_type_registered_owner === undefined
              ? true
              : p.ownership_type_registered_owner === true;
          return isOwner && p.is_current_owner !== false;
        });
        setOwnedParcels(parcels);
      }
    } catch (err) {
      console.error("handleSelfLandOwnerSelect error:", err);
    } finally {
      setIsFetchingSelfRecord(false);
    }
  };

  // Build farmlandParcels for the Land Owner path
  const applyOwnedParcels = () => {
    const selected = ownedParcels.filter((p) =>
      selectedOwnedParcelIds.has(String(p.id)),
    );
    const ownedMapped: Parcel[] = selected.map((parcel, idx) => {
      return {
        parcelNo: String(idx + 1),
        farmLocationBarangay: parcel.farm_location_barangay || "",
        farmLocationMunicipality:
          parcel.farm_location_municipality || "Dumangas",
        totalFarmAreaHa: String(parcel.total_farm_area_ha || ""),
        withinAncestralDomain: parcel.within_ancestral_domain || "",
        ownershipDocumentNo: parcel.ownership_document_no || "",
        agrarianReformBeneficiary: parcel.agrarian_reform_beneficiary || "",
        isCultivating: true,
        ownershipTypeRegisteredOwner: true,
        ownershipTypeTenant: false,
        ownershipTypeLessee: false,
        ownershipTypeOthers: false,
        tenantLandOwnerName: "",
        lesseeLandOwnerName: "",
        ownershipOthersSpecify: "",
        existingParcelId: parcel.id,
        existingParcelNumber: parcel.parcel_number || "",
      };
    });

    // If they also farm others' land, append those selected parcels
    if (
      alsoFarmsOthersLand &&
      selectedLandOwner &&
      selectedParcelIds.size > 0
    ) {
      const isTenant = ownershipCategory === "tenant";
      const isLessee = ownershipCategory === "lessee";
      const extra: Parcel[] = ownerParcels
        .filter((p) => selectedParcelIds.has(String(p.id)))
        .map((p, i) => ({
          parcelNo: String(ownedMapped.length + i + 1),
          farmLocationBarangay: p.farm_location_barangay || "",
          farmLocationMunicipality: p.farm_location_municipality || "Dumangas",
          totalFarmAreaHa: String(p.total_farm_area_ha || ""),
          withinAncestralDomain: p.within_ancestral_domain || "",
          ownershipDocumentNo: "",
          agrarianReformBeneficiary: "",
          isCultivating: true,
          ownershipTypeRegisteredOwner: false,
          ownershipTypeTenant: isTenant,
          ownershipTypeLessee: isLessee,
          ownershipTypeOthers: false,
          tenantLandOwnerName: isTenant ? selectedLandOwner.name : "",
          lesseeLandOwnerName: isLessee ? selectedLandOwner.name : "",
          ownershipOthersSpecify: "",
          existingParcelId: p.land_parcel_id || p.id,
          existingParcelNumber: p.parcel_number || "",
        }));
      setFormData((prev) => ({
        ...prev,
        farmlandParcels: [...ownedMapped, ...extra],
      }));
    } else {
      setFormData((prev) => ({ ...prev, farmlandParcels: ownedMapped }));
    }
  };

  // Next step validation is handled by handleSubmitForm now

  const handlePrevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const isStepActive = (step: number) => currentStep === step;
  const isStepCompleted = (step: number) => currentStep > step;

  const handleSubmitForm = async () => {
    // We'll validate only what is relevant to the current step so users can progress step-by-step
    const newErrors: Record<string, string> = {};

    if (currentStep === 1) {
      // Gate check: must answer the YES/NO land owner question first
      if (farmerRole === null) {
        newErrors.farmerRole = "Please select your registration role";
        setErrors(newErrors);
        return;
      }

      // Land Owner path: must have selected own LO record
      if (farmerRole === "owner" && !selectedSelfLandOwner) {
        newErrors.selfLandOwner =
          "Please search and select your Land Owner record to continue";
        setErrors(newErrors);
        return;
      }

      // Validate personal info fields (pre-filled or manually entered)
      if (!formData.firstName?.trim())
        newErrors.firstName = "First name is required";
      if (!formData.surname?.trim()) newErrors.surname = "Surname is required";
      if (!formData.middleName?.trim())
        newErrors.middleName = "Middle name is required";
      if (!formData.gender?.trim()) newErrors.gender = "Gender is required";
      if (!formData.dateOfBirth?.trim())
        newErrors.dateOfBirth = "Date of birth is required";
      if (!formData.age?.trim()) {
        newErrors.age = "Age is required";
      } else {
        const ageValue = Number(formData.age);
        if (Number.isNaN(ageValue)) {
          newErrors.age = "Age must be a valid number";
        } else if (ageValue < 18) {
          newErrors.age = "Age must be at least 18 or above";
        }
      }
      if (!formData.barangay?.trim())
        newErrors.barangay = "Barangay is required";

      setErrors(newErrors);
      if (Object.keys(newErrors).length > 0) return;

      // Check for duplicate registrant in the database (name & transposed name check)
      // Skip if they are registering through the landowner path (since they are intentionally reusing their pre-filled profile)
      if (farmerRole !== "owner") {
        try {
          const checkFirstName = formData.firstName.trim();
          const checkLastName = formData.surname.trim();
          const checkMiddleName = (formData.middleName || "").trim();
          const checkExtName = (formData.extensionName || "").trim();

          const { data: nameMatches, error: checkError } = await supabase
            .from("rsbsa_submission")
            .select('id, "FIRST NAME", "LAST NAME", "MIDDLE NAME", "EXT NAME"')
            .ilike("FIRST NAME", checkFirstName)
            .is("archived_at", null);

          if (checkError) {
            console.error("Error checking duplicates:", checkError);
          } else if (nameMatches && nameMatches.length > 0) {
            const duplicate = nameMatches.find((m) => {
              const dbFirst = (m["FIRST NAME"] || "").trim().toLowerCase();
              const dbLast = (m["LAST NAME"] || "").trim().toLowerCase();
              const dbMiddle = (m["MIDDLE NAME"] || "").trim().toLowerCase();
              const dbExt = (m["EXT NAME"] || "").trim().toLowerCase();

              const inputFirst = checkFirstName.toLowerCase();
              const inputLast = checkLastName.toLowerCase();
              const inputMiddle = checkMiddleName.toLowerCase();
              const inputExt = checkExtName.toLowerCase();

              const extMatch = dbExt === inputExt;
              const exactLastMatch = dbLast === inputLast;
              const transposedMatch =
                (inputMiddle && dbLast === inputMiddle) ||
                (dbMiddle && dbMiddle === inputLast);

              return extMatch && (exactLastMatch || transposedMatch);
            });

            if (duplicate) {
              setErrors({
                firstName: "A farmer with this name combination is already registered.",
                surname: "A farmer with this name combination is already registered.",
              });
              return;
            }
          }
        } catch (err) {
          console.error("Failed to run duplicate check:", err);
        }
      }

      // clear any step-level errors and go to next step
      setErrors({});
      setCurrentStep(2);
      return;
    }

    if (currentStep === 2) {
      // ── Land Owner path ──────────────────────────────────────────────────
      if (farmerRole === "owner") {
        if (!selectedSelfLandOwner) {
          newErrors.selfLandOwner =
            "Please select your Land Owner record in Step 1";
        } else if (ownedParcels.length === 0) {
          newErrors.selfLandOwner =
            "Your Land Owner record has no registered parcels";
        }

        if (alsoFarmsOthersLand === null) {
          newErrors.alsoFarmsQuestion =
            "Please answer: Do you also farm land you don't own?";
        } else if (alsoFarmsOthersLand === true) {
          if (!selectedLandOwner) {
            newErrors.landOwner =
              "Please select the land owner of the additional parcel(s)";
          } else if (ownerParcels.length === 0) {
            newErrors.parcelSelection =
              "The selected land owner has no registered parcels.";
          } else if (selectedParcelIds.size === 0) {
            newErrors.parcelSelection = "Please select at least one parcel";
          }
        }

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return;

        const totalCount =
          selectedOwnedParcelIds.size +
          (alsoFarmsOthersLand ? selectedParcelIds.size : 0);
        setConfirmModal({
          show: true,
          roleText: "Registered Land Owner (Farmer)",
          parcelCount: totalCount,
          landOwnerName: selectedSelfLandOwner?.name || "",
        });
        return;
      }

      // ── Tenant / Lessee path ─────────────────────────────────────────────
      if (!selectedLandOwner) {
        newErrors.landOwner = "Please search and select the land owner";
      } else if (ownerParcels.length === 0) {
        newErrors.parcelSelection =
          "The selected land owner has no registered parcels.";
      } else if (selectedParcelIds.size === 0) {
        newErrors.parcelSelection = "Please select at least one parcel";
      }
      additionalLandOwnerGroups.forEach((group) => {
        if (!group.landOwner) {
          newErrors[`addGroup_${group.groupId}`] =
            "Please select a land owner for this group or remove it";
        } else if (group.selectedParcelIds.size === 0) {
          newErrors[`addGroup_${group.groupId}`] =
            `Please select at least one parcel from ${group.landOwner.name}`;
        }
      });

      setErrors(newErrors);
      if (Object.keys(newErrors).length > 0) return;

      const roleText = ownershipCategory === "tenant" ? "Tenant" : "Lessee";
      const totalParcelCount =
        selectedParcelIds.size +
        additionalLandOwnerGroups.reduce(
          (sum, g) => sum + g.selectedParcelIds.size,
          0,
        );
      setConfirmModal({
        show: true,
        roleText,
        parcelCount: totalParcelCount,
        landOwnerName: selectedLandOwner?.name || "",
      });
      return;
    }

    if (currentStep === 3) {
      // For Tenant / Lessee: activities are auto-merged from land owner records
      // and shown read-only — no user-editable validation needed here.
      // For Land Owner path: activities were pre-filled from their own LO record
      // and are also read-only, so only validate if they somehow have none.
      if (farmerRole !== "tenant" && farmerRole !== "lessee") {
        const hasFarmingActivity =
          (formData as any).farmerRice ||
          (formData as any).farmerCorn ||
          (formData as any).farmerOtherCrops ||
          (formData as any).farmerLivestock ||
          (formData as any).farmerPoultry;
        if (!hasFarmingActivity) {
          newErrors.farmingActivity =
            "Please select at least one farming activity";
        }
      }

      setErrors(newErrors);
      if (Object.keys(newErrors).length > 0) return;

      setErrors({});
      setCurrentStep(4);
      return;
    }

    // currentStep === 4 -> final submit: perform full validation then submit
    // Full-form basic validation (repeat or extend as necessary)
    if (!formData.firstName?.trim())
      newErrors.firstName = "First name is required";
    if (!formData.surname?.trim()) newErrors.surname = "Surname is required";
    if (!formData.middleName?.trim())
      newErrors.middleName = "Middle name is required";
    if (!formData.gender?.trim()) newErrors.gender = "Gender is required";
    if (!formData.dateOfBirth?.trim())
      newErrors.dateOfBirth = "Date of birth is required";
    if (!formData.age?.trim()) {
      newErrors.age = "Age is required";
    } else {
      const ageValue = Number(formData.age);
      if (Number.isNaN(ageValue)) {
        newErrors.age = "Age must be a valid number";
      } else if (ageValue < 18) {
        newErrors.age = "Age must be at least 18 or above";
      }
    }
    if (!formData.barangay?.trim()) newErrors.barangay = "Barangay is required";

    // Validate based on registration path
    if (
      (farmerRole === "tenant" || farmerRole === "lessee") &&
      !selectedLandOwner
    ) {
      newErrors.landOwner = "Please select the land owner";
    }
    if (farmerRole === "owner" && !selectedSelfLandOwner) {
      newErrors.selfLandOwner = "Please select your Land Owner record";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    handleFinalSubmit();
  };

  const submitFinalToServer = async () => {
    try {
      const transformedData = {
        ...formData,
        dateOfBirth: formData.dateOfBirth
          ? new Date(formData.dateOfBirth)
          : null,
        isActivelyFarming: formData.isActivelyFarming,
        // Include ownership category and land owner info for land_history creation
        ownershipCategory:
          farmerRole === "owner" ? "registeredOwner" : ownershipCategory,
        farmerRole: farmerRole, // ← add this
        selectedSelfLandOwner: selectedSelfLandOwner,
        selectedSelfLandOwnerId: selectedSelfLandOwner?.id || null,
        selectedLandOwner: selectedLandOwner
          ? {
              id: selectedLandOwner.id,
              name: selectedLandOwner.name,
              barangay: selectedLandOwner.barangay,
              municipality: selectedLandOwner.municipality,
            }
          : null,
        selectedParcelIds: Array.from(selectedParcelIds),
        farmlandParcels: formData.farmlandParcels.map((parcel) => ({
          ...parcel,
          totalFarmAreaHa: parcel.totalFarmAreaHa
            ? parseFloat(parcel.totalFarmAreaHa)
            : 0,
          withinAncestralDomain: parcel.withinAncestralDomain === "Yes",
          agrarianReformBeneficiary: parcel.agrarianReformBeneficiary === "Yes",
          isCultivating: parcel.isCultivating ?? true,
          // Include existing parcel info for ownership transfer
          existingParcelId: parcel.existingParcelId || null,
          existingParcelNumber: parcel.existingParcelNumber || null,
          ownershipType: {
            registeredOwner: parcel.ownershipTypeRegisteredOwner || false,
            tenant: parcel.ownershipTypeTenant || false,
            lessee: parcel.ownershipTypeLessee || false,
          },
          // Optional: Remove the old flat fields so only ownershipType remains
          // You can comment out or filter these as needed
          // ownershipTypeRegisteredOwner: undefined,
          // ownershipTypeTenant: undefined,
          // ownershipTypeLessee: undefined,
        })),
      };

      console.log(
        "📤 Submitting transformed data:",
        JSON.stringify(transformedData.farmlandParcels, null, 2),
      );

      const response = await createRsbsaSubmission({
        draftId,
        data: transformedData,
      });

      if (response.error) {
        throw new Error(response.error || `HTTP error`);
      }
      const result = response.data;
      console.log("Submission response:", result);
      return result; // Should include message, submissionId, submittedAt
    } catch (error) {
      let message = "Unknown error";
      if (error instanceof Error) {
        message = error.message;
      } else if (typeof error === "string") {
        message = error;
      }
      console.error("Error submitting form:", error);
      showToast(
        "Error submitting form: " + message + ". Please try again.",
        "error",
      );
      return null;
    }
  };

  const buildFarmerAuditFarmDetails = () => {
    const farmlandParcels = formData.farmlandParcels.map((parcel, index) => {
      const parsedArea = Number(parcel.totalFarmAreaHa);
      const totalFarmAreaHa = Number.isFinite(parsedArea) ? parsedArea : 0;

      return {
        parcelNo: parcel.parcelNo || String(index + 1),
        farmLocationBarangay: parcel.farmLocationBarangay || null,
        farmLocationMunicipality: parcel.farmLocationMunicipality || null,
        totalFarmAreaHa,
        withinAncestralDomain: parcel.withinAncestralDomain || null,
        ownershipDocumentNo: parcel.ownershipDocumentNo || null,
        agrarianReformBeneficiary: parcel.agrarianReformBeneficiary || null,
        isCultivating: parcel.isCultivating ?? null,
        ownershipType: {
          registeredOwner: !!parcel.ownershipTypeRegisteredOwner,
          tenant: !!parcel.ownershipTypeTenant,
          lessee: !!parcel.ownershipTypeLessee,
          others: !!parcel.ownershipTypeOthers,
        },
        tenantLandOwnerName: parcel.tenantLandOwnerName || null,
        lesseeLandOwnerName: parcel.lesseeLandOwnerName || null,
        ownershipOthersSpecify: parcel.ownershipOthersSpecify || null,
        existingParcelId: parcel.existingParcelId ?? null,
        existingParcelNumber: parcel.existingParcelNumber ?? null,
      };
    });

    const totalFarmAreaHa = farmlandParcels.reduce(
      (sum, parcel) => sum + (parcel.totalFarmAreaHa || 0),
      0,
    );

    return {
      ownershipCategory:
        farmerRole === "owner" ? "registeredOwner" : ownershipCategory,
      totalParcels: farmlandParcels.length,
      totalFarmAreaHa: Number(totalFarmAreaHa.toFixed(4)),
      farmLocation: {
        barangay: formData.barangay || null,
        municipality: formData.municipality || null,
        province: formData.province || null,
      },
      selectedLandOwner: selectedLandOwner
        ? {
            id: selectedLandOwner.id,
            name: selectedLandOwner.name,
            barangay: selectedLandOwner.barangay,
            municipality: selectedLandOwner.municipality,
          }
        : null,
      selectedParcelIds: Array.from(selectedParcelIds),
      farmActivities: {
        mainLivelihood: formData.mainLivelihood || null,
        farmerRice: !!formData.farmerRice,
        farmerCorn: !!formData.farmerCorn,
        farmerOtherCrops: !!formData.farmerOtherCrops,
        farmerOtherCropsText: formData.farmerOtherCropsText || null,
        farmerLivestock: !!formData.farmerLivestock,
        farmerLivestockText: formData.farmerLivestockText || null,
        farmerPoultry: !!formData.farmerPoultry,
        farmerPoultryText: formData.farmerPoultryText || null,
      },
      farmlandParcels,
    };
  };

  // After a new Tenant/Lessee submission succeeds, replace any parcels the
  // registrant selected that already had an active tenant/lessee (flagged
  // via getParcelReplacementInfo / the warning badge). Runs as a separate
  // step from createRsbsaSubmission on purpose (see design discussion) —
  // failures here are surfaced but don't roll back the registration, since
  // the person is already validly registered either way.
  const processTenantLesseeReplacements = async (
    newSubmissionId: number,
  ): Promise<{ succeeded: number; failed: number }> => {
    const role = farmerRole === "lessee" ? "lessee" : "tenant";
    let succeeded = 0;
    let failed = 0;

    // Gather every selected parcel (main + additional groups) flagged as
    // a replacement.
    type ReplacementCandidate = {
      ownerFarmParcelId: number;
      oldHolderId: number;
      parcelLabel: string;
    };
    const candidates: ReplacementCandidate[] = [];

    ownerParcels.forEach((parcel: any) => {
      if (!selectedParcelIds.has(String(parcel.id))) return;
      const info = getParcelReplacementInfo(parcel, selectedLandOwner?.id);
      if (info.isReplacement && info.currentHolderId) {
        candidates.push({
          ownerFarmParcelId: Number(parcel.id),
          oldHolderId: info.currentHolderId,
          parcelLabel: parcel.parcel_number || `Parcel ${parcel.id}`,
        });
      }
    });

    additionalLandOwnerGroups.forEach((group) => {
      group.parcels.forEach((parcel: any) => {
        if (!group.selectedParcelIds.has(String(parcel.id))) return;
        const info = getParcelReplacementInfo(parcel, group.landOwner?.id);
        if (info.isReplacement && info.currentHolderId) {
          candidates.push({
            ownerFarmParcelId: Number(parcel.id),
            oldHolderId: info.currentHolderId,
            parcelLabel: parcel.parcel_number || `Parcel ${parcel.id}`,
          });
        }
      });
    });

    if (candidates.length === 0) {
      return { succeeded: 0, failed: 0 };
    }

    for (const candidate of candidates) {
      try {
        // Determine the OLD holder's exact role (tenant or lessee) for
        // this specific parcel — it may differ from this registrant's own
        // farmerRole, and the RPC needs the old holder's real role to find
        // their record correctly.
        let oldHolderRole: "tenant" | "lessee" = role;
        const oldHolderParcelsResp = await getFarmParcels(
          candidate.oldHolderId,
        );
        if (!oldHolderParcelsResp.error) {
          const matching = (oldHolderParcelsResp.data || []).find(
            (p: any) =>
              (p.ownership_type_tenant === true ||
                p.ownership_type_lessee === true) &&
              (p.is_current_owner === null ||
                p.is_current_owner === undefined ||
                p.is_current_owner === true) &&
              (p.tenant_land_owner_id != null ||
                p.lessee_land_owner_id != null),
          );
          if (matching) {
            oldHolderRole = matching.ownership_type_lessee
              ? "lessee"
              : "tenant";
          }
        }

        const replaceResp = await replaceCurrentTenantLessee({
          role: oldHolderRole,
          ownerFarmParcelId: candidate.ownerFarmParcelId,
          oldHolderId: candidate.oldHolderId,
          newHolderId: newSubmissionId,
          reason: "Replaced during new Tenant/Lessee registration",
        });

        if (replaceResp.error) {
          console.error(
            `Replacement failed for ${candidate.parcelLabel}:`,
            replaceResp.error,
          );
          failed += 1;
        } else {
          succeeded += 1;
        }
      } catch (err) {
        console.error(`Replacement threw for ${candidate.parcelLabel}:`, err);
        failed += 1;
      }
    }

    return { succeeded, failed };
  };

  const handleFinalSubmit = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    let shouldUnlockSubmit = true;

    try {
      const submitted = await submitFinalToServer();
      if (submitted && submitted.submissionId) {
        // Log audit trail for farmer registration
        try {
          const farmerName =
            `${formData.surname}, ${formData.firstName} ${formData.middleName || ""}`.trim();
          const farmDetails = buildFarmerAuditFarmDetails();
          const auditLogger = getAuditLogger();
          const user = await getCurrentUserForAudit();
          await auditLogger.logFarmerRegistration(
            { ...user, id: undefined },
            submitted.submissionId,
            farmerName,
            farmDetails,
          );
        } catch (auditErr) {
          console.error("Audit log failed (non-blocking):", auditErr);
        }

        // Replace any previously-farmed parcels the registrant claimed.
        // Non-fatal: registration already succeeded either way.
        if (farmerRole === "tenant" || farmerRole === "lessee") {
          try {
            const { succeeded, failed } = await processTenantLesseeReplacements(
              submitted.submissionId,
            );
            if (failed > 0) {
              showToast(
                `Registered, but ${failed} parcel replacement${failed > 1 ? "s" : ""} failed and may need manual review in the Land Registry.`,
                "warning",
              );
            } else if (succeeded > 0) {
              showToast(
                `${succeeded} parcel${succeeded > 1 ? "s" : ""} reassigned from the previous farmer.`,
                "success",
              );
            }
          } catch (replaceErr) {
            console.error(
              "Tenant/lessee replacement step failed (non-blocking):",
              replaceErr,
            );
            showToast(
              "Registered, but parcel replacement could not be completed automatically. Please check the Land Registry.",
              "warning",
            );
          }
        }

        showToast("RSBSA form submitted successfully!", "success");
        // Navigate back to JO flow after a short delay to show the toast
        shouldUnlockSubmit = false;
        setTimeout(() => {
          navigate("/jo-rsbsapage");
        }, 1500);
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      showToast("Error submitting form. Please try again.", "error");
    } finally {
      if (shouldUnlockSubmit) {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="jo-registration-page-container">
      <div className="jo-registration-page">
        {/* Sidebar */}
        <JOSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        {/* Main content starts here */}
        <div className="jo-registration-main-content">
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
            <div className="tech-incent-mobile-title">
              JO RSBSA Registration - Tenant & Lessee
            </div>
          </div>
          <h2>RSBSA Enrollment Form - Active Farmers</h2>

          <div className="jo-registration-back-button">
            <button
              className="app-back-button"
              onClick={() => navigate("/jo-rsbsapage")}
            >
              <span className="app-back-button-arrow" aria-hidden="true">
                ←
              </span>
              <span>Back</span>
            </button>
          </div>

          <div className="jo-registration-form-container">
            <div className="jo-registration-form-steps">
              <div
                className={`jo-registration-step ${isStepActive(1) ? "jo-registration-active" : ""} ${isStepCompleted(1) ? "jo-registration-completed" : ""}`}
              >
                <span className="jo-registration-dot">
                  {isStepCompleted(1) ? "✓" : "1"}
                </span>
                <span className="jo-registration-label">Basic Details</span>
              </div>
              <div
                className={`jo-registration-step ${isStepActive(2) ? "jo-registration-active" : ""} ${isStepCompleted(2) ? "jo-registration-completed" : ""}`}
              >
                <span className="jo-registration-dot">
                  {isStepCompleted(2) ? "✓" : "2"}
                </span>
                <span className="jo-registration-label">Farmland</span>
              </div>
              <div
                className={`jo-registration-step ${isStepActive(3) ? "jo-registration-active" : ""} ${isStepCompleted(3) ? "jo-registration-completed" : ""}`}
              >
                <span className="jo-registration-dot">
                  {isStepCompleted(3) ? "✓" : "3"}
                </span>
                <span className="jo-registration-label">Farm Profile</span>
              </div>
              <div
                className={`jo-registration-step ${isStepActive(4) ? "jo-registration-active" : ""}${isStepCompleted(4) ? "jo-registration-completed" : ""}`}
              >
                <span className="jo-registration-dot">4</span>
                <span className="jo-registration-label">Verification</span>
              </div>
            </div>

            {currentStep === 1 && (
              <>
                {/* ── Role Picker ─────────────────────────────────────────────── */}
                <div
                  style={{
                    marginBottom: "1.5rem",
                    padding: "1.5rem",
                    backgroundColor: "#f8f9fa",
                    borderRadius: "8px",
                    border: errors.farmerRole
                      ? "2px solid #dc2626"
                      : "2px solid #dee2e6",
                  }}
                >
                  <h4 style={{ marginBottom: "0.5rem", color: "#2c3e50" }}>
                    Register as Farmer
                  </h4>
                  <p
                    style={{
                      fontSize: "0.88rem",
                      color: "#6c757d",
                      marginBottom: "1rem",
                    }}
                  >
                    Select how you will be registering as a Farmer.
                  </p>
                  <div
                    style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}
                  >
                    {(["owner", "tenant", "lessee"] as const).map((role) => {
                      const labels = {
                        owner: "🏡 Land Owner",
                        tenant: "👨‍🌾 Tenant",
                        lessee: "📄 Lessee",
                      };
                      const active = farmerRole === role;
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => {
                            setFarmerRole(role);
                            // Also sync ownershipCategory for parcel logic
                            if (role === "tenant")
                              handleOwnershipCategoryChange("tenant");
                            if (role === "lessee")
                              handleOwnershipCategoryChange("lessee");
                            if (role === "owner") {
                              setOwnershipCategory("tenant"); // default for "also farms" section
                              setSelectedLandOwner(null);
                              setLandOwnerSearchTerm("");
                              setOwnerParcels([]);
                              setSelectedParcelIds(new Set());
                              setAdditionalLandOwnerGroups([]);
                            }
                            setErrors((prev) => ({ ...prev, farmerRole: "" }));
                          }}
                          style={{
                            flex: "1",
                            minWidth: "140px",
                            padding: "0.9rem 1rem",
                            backgroundColor: active ? "#0d6efd" : "white",
                            color: active ? "white" : "#2c3e50",
                            border: "2px solid #0d6efd",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontWeight: "bold",
                            fontSize: "1rem",
                            transition: "all 0.15s",
                          }}
                        >
                          {labels[role]}
                        </button>
                      );
                    })}
                  </div>
                  {errors.farmerRole && (
                    <div
                      className="jo-registration-error"
                      style={{ marginTop: "0.5rem" }}
                    >
                      {errors.farmerRole}
                    </div>
                  )}

                  {/* Land Owner: name search */}
                  {farmerRole === "owner" && (
                    <div style={{ marginTop: "1.25rem" }}>
                      <label
                        style={{
                          fontWeight: "600",
                          display: "block",
                          marginBottom: "0.4rem",
                          fontSize: "0.9rem",
                        }}
                      >
                        Search Your Land Owner Record
                      </label>
                      <div style={{ position: "relative" }}>
                        <input
                          type="text"
                          placeholder="Type your name..."
                          value={selfSearchTerm}
                          onChange={(e) => {
                            setSelfSearchTerm(e.target.value);
                            setShowSelfDropdown(true);
                            if (!e.target.value) {
                              setSelectedSelfLandOwner(null);
                              setOwnedParcels([]);
                            }
                          }}
                          onFocus={() => setShowSelfDropdown(true)}
                          style={{
                            width: "100%",
                            padding: "0.7rem",
                            border: errors.selfLandOwner
                              ? "1px solid #dc2626"
                              : "1px solid #ced4da",
                            borderRadius: "6px",
                            fontSize: "0.95rem",
                          }}
                        />
                        {showSelfDropdown && selfSearchTerm && (
                          <div
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: 0,
                              right: 0,
                              backgroundColor: "white",
                              border: "1px solid #ced4da",
                              borderRadius: "0 0 6px 6px",
                              maxHeight: "200px",
                              overflowY: "auto",
                              zIndex: 200,
                              boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                            }}
                          >
                            {filteredSelfOwners.length > 0 ? (
                              filteredSelfOwners.map((owner) => (
                                <div
                                  key={owner.id}
                                  onClick={() => {
                                    if (owner.isRegisteredFarmer) return;
                                    handleSelfLandOwnerSelect(owner);
                                  }}
                                  aria-disabled={
                                    owner.isRegisteredFarmer || undefined
                                  }
                                  style={{
                                    padding: "0.7rem 1rem",
                                    cursor: owner.isRegisteredFarmer
                                      ? "not-allowed"
                                      : "pointer",
                                    borderBottom: "1px solid #f0f0f0",
                                    fontSize: "0.95rem",
                                    opacity: owner.isRegisteredFarmer ? 0.5 : 1,
                                  }}
                                  onMouseEnter={(e) => {
                                    if (owner.isRegisteredFarmer) return;
                                    e.currentTarget.style.backgroundColor =
                                      "#f8f9fa";
                                  }}
                                  onMouseLeave={(e) => {
                                    if (owner.isRegisteredFarmer) return;
                                    e.currentTarget.style.backgroundColor =
                                      "white";
                                  }}
                                >
                                  <strong>{owner.name}</strong>
                                  {owner.barangay && (
                                    <span
                                      style={{
                                        color: "#6c757d",
                                        marginLeft: "0.5rem",
                                        fontSize: "0.85rem",
                                      }}
                                    >
                                      — {owner.barangay}
                                    </span>
                                  )}
                                  {owner.isRegisteredFarmer && (
                                    <span
                                      style={{
                                        marginLeft: "0.5rem",
                                        fontSize: "0.75rem",
                                        color: "#dc2626",
                                        fontWeight: "bold",
                                      }}
                                    >
                                      Already registered
                                    </span>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div
                                style={{
                                  padding: "0.7rem 1rem",
                                  color: "#6c757d",
                                  fontSize: "0.9rem",
                                }}
                              >
                                No land owners found
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {errors.selfLandOwner && (
                        <div
                          className="jo-registration-error"
                          style={{ marginTop: "0.4rem" }}
                        >
                          {errors.selfLandOwner}
                        </div>
                      )}
                      {selectedSelfLandOwner && (
                        <div
                          style={{
                            marginTop: "0.75rem",
                            padding: "0.6rem 1rem",
                            backgroundColor: "#d4edda",
                            border: "1px solid #c3e6cb",
                            borderRadius: "6px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "0.5rem",
                          }}
                        >
                          <span
                            style={{ color: "#155724", fontWeight: "bold" }}
                          >
                            ✓ {selectedSelfLandOwner.name}
                            {isFetchingSelfRecord && (
                              <span
                                style={{
                                  color: "#6c757d",
                                  fontWeight: "normal",
                                  marginLeft: "0.5rem",
                                  fontSize: "0.85rem",
                                }}
                              >
                                Loading record…
                              </span>
                            )}
                          </span>
                          <button
                            onClick={() => {
                              setSelectedSelfLandOwner(null);
                              setSelfSearchTerm("");
                              setOwnedParcels([]);
                              setFormData((prev) => ({
                                ...prev,
                                firstName: "",
                                surname: "",
                                middleName: "",
                                extensionName: "",
                                gender: "",
                                dateOfBirth: "",
                                age: "",
                                barangay: "",
                                farmerRice: false,
                                farmerCorn: false,
                                farmerOtherCrops: false,
                                farmerOtherCropsText: "",
                                farmerLivestock: false,
                                farmerLivestockText: "",
                                farmerPoultry: false,
                                farmerPoultryText: "",
                              }));
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#721c24",
                              cursor: "pointer",
                              fontWeight: "bold",
                              fontSize: "1rem",
                              flexShrink: 0,
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="jo-registration-form-section">
                  <h3>PART I: PERSONAL INFORMATION</h3>
                  {/* Pre-filled notice banner */}
                  {isPreFilled && (
                    <div
                      style={{
                        marginBottom: "1rem",
                        padding: "0.75rem 1rem",
                        backgroundColor: "#cff4fc",
                        border: "1px solid #b6effb",
                        borderRadius: "6px",
                        fontSize: "0.88rem",
                        color: "#055160",
                      }}
                    >
                      ℹ️ Fields pre-filled from your Land Owner record. Review
                      and correct if needed before proceeding.
                    </div>
                  )}
                  <div className="jo-registration-form-grid">
                    <div className="jo-registration-form-row">
                      <div className="jo-registration-form-group">
                        <label>FIRST NAME</label>
                        <input
                          type="text"
                          value={formData.firstName}
                          onChange={(e) =>
                            handleTextInputChange("firstName", e.target.value)
                          }
                          onBlur={() => handleTextInputBlur("firstName")}
                          required
                          aria-required="true"
                          readOnly={isPreFilled}
                          style={
                            isPreFilled
                              ? {
                                  backgroundColor: "#f3f4f6",
                                  color: "#6b7280",
                                  cursor: "default",
                                }
                              : {}
                          }
                          className={
                            errors.firstName
                              ? "jo-registration-input-error"
                              : ""
                          }
                        />
                        {errors.firstName && (
                          <div className="jo-registration-error">
                            {errors.firstName}
                          </div>
                        )}
                      </div>
                      <div className="jo-registration-form-group">
                        <label>SURNAME</label>
                        <input
                          type="text"
                          value={formData.surname}
                          onChange={(e) =>
                            handleTextInputChange("surname", e.target.value)
                          }
                          onBlur={() => handleTextInputBlur("surname")}
                          required
                          aria-required="true"
                          readOnly={isPreFilled}
                          style={
                            isPreFilled
                              ? {
                                  backgroundColor: "#f3f4f6",
                                  color: "#6b7280",
                                  cursor: "default",
                                }
                              : {}
                          }
                          className={
                            errors.surname ? "jo-registration-input-error" : ""
                          }
                        />
                        {errors.surname && (
                          <div className="jo-registration-error">
                            {errors.surname}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="jo-registration-form-row">
                      <div className="jo-registration-form-group">
                        <label>MIDDLE NAME</label>
                        <input
                          type="text"
                          value={formData.middleName}
                          onChange={(e) =>
                            handleTextInputChange("middleName", e.target.value)
                          }
                          onBlur={() => handleTextInputBlur("middleName")}
                          required
                          aria-required="true"
                          readOnly={isPreFilled}
                          style={
                            isPreFilled
                              ? {
                                  backgroundColor: "#f3f4f6",
                                  color: "#6b7280",
                                  cursor: "default",
                                }
                              : {}
                          }
                          className={
                            errors.middleName
                              ? "jo-registration-input-error"
                              : ""
                          }
                        />
                        {errors.middleName && (
                          <div className="jo-registration-error">
                            {errors.middleName}
                          </div>
                        )}
                      </div>
                      <div className="jo-registration-form-group">
                        <label>EXTENSION NAME</label>
                        <input
                          type="text"
                          value={formData.extensionName}
                          onChange={(e) =>
                            handleTextInputChange(
                              "extensionName",
                              e.target.value,
                            )
                          }
                          onBlur={() => handleTextInputBlur("extensionName")}
                          readOnly={isPreFilled}
                          style={
                            isPreFilled
                              ? {
                                  backgroundColor: "#f3f4f6",
                                  color: "#6b7280",
                                  cursor: "default",
                                }
                              : {}
                          }
                        />
                      </div>
                      <div className="jo-registration-form-group">
                        <label>GENDER</label>
                        <select
                          value={formData.gender}
                          onChange={(e) =>
                            handleInputChange("gender", e.target.value)
                          }
                          disabled={isPreFilled}
                          style={
                            isPreFilled
                              ? {
                                  backgroundColor: "#f3f4f6",
                                  color: "#6b7280",
                                  cursor: "default",
                                }
                              : {}
                          }
                          className={
                            errors.gender ? "jo-registration-input-error" : ""
                          }
                        >
                          <option value="">Select Gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                        {errors.gender && (
                          <div className="jo-registration-error">
                            {errors.gender}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="jo-registration-form-row">
                      <div className="jo-registration-form-group">
                        <label>DATE OF BIRTH</label>
                        {isPreFilled ? (
                          <input
                            type="text"
                            value={formData.dateOfBirth}
                            readOnly
                            style={{
                              backgroundColor: "#f3f4f6",
                              color: "#6b7280",
                              cursor: "default",
                            }}
                          />
                        ) : (
                          <BirthDatePicker
                            value={formData.dateOfBirth}
                            onChange={(val) => {
                              handleInputChange("dateOfBirth", val);
                              if (val) {
                                const birthDate = new Date(val + "T00:00:00");
                                const today = new Date();
                                let age =
                                  today.getFullYear() - birthDate.getFullYear();
                                const monthDiff =
                                  today.getMonth() - birthDate.getMonth();
                                if (
                                  monthDiff <= 0 ||
                                  (monthDiff === 0 &&
                                    today.getDate() < birthDate.getDate())
                                ) {
                                  age--;
                                }
                                setFormData((prev) => ({
                                  ...prev,
                                  age: String(age),
                                }));
                              } else {
                                setFormData((prev) => ({ ...prev, age: "" }));
                              }
                            }}
                            hasError={!!errors.dateOfBirth}
                          />
                        )}
                        {errors.dateOfBirth && (
                          <div className="jo-registration-error">
                            {errors.dateOfBirth}
                          </div>
                        )}
                      </div>
                      <div className="jo-registration-form-group">
                        <label>AGE</label>
                        <input
                          type="number"
                          value={formData.age}
                          readOnly
                          disabled
                          min="0"
                          max="120"
                          placeholder="Auto-calculated from birthdate"
                          style={{
                            backgroundColor: "#f3f4f6",
                            color: "#6b7280",
                            cursor: "not-allowed",
                          }}
                          className={
                            errors.age ? "jo-registration-input-error" : ""
                          }
                        />
                        {errors.age && (
                          <div className="jo-registration-error">
                            {errors.age}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="jo-registration-address-section">
                      <h4>ADDRESS</h4>
                      <div className="jo-registration-address-grid">
                        <div className="jo-registration-form-group">
                          <label>BARANGAY *</label>
                          <select
                            value={formData.barangay}
                            onChange={(e) =>
                              handleInputChange("barangay", e.target.value)
                            }
                            required
                            aria-required="true"
                            disabled={isPreFilled}
                            style={
                              isPreFilled
                                ? {
                                    backgroundColor: "#f3f4f6",
                                    color: "#6b7280",
                                    cursor: "default",
                                  }
                                : {}
                            }
                            className={
                              errors.barangay
                                ? "jo-registration-input-error"
                                : ""
                            }
                          >
                            <option value="">Select Barangay</option>
                            <option value="Aurora-Del Pilar">
                              Aurora-Del Pilar
                            </option>
                            <option value="Bacay">Bacay</option>
                            <option value="Bacong">Bacong</option>
                            <option value="Balabag">Balabag</option>
                            <option value="Balud">Balud</option>
                            <option value="Bantud">Bantud</option>
                            <option value="Bantud Fabrica">
                              Bantud Fabrica
                            </option>
                            <option value="Baras">Baras</option>
                            <option value="Barasan">Barasan</option>
                            <option value="Basa-Mabini Bonifacio">
                              Basa-Mabini Bonifacio
                            </option>
                            <option value="Bolilao">Bolilao</option>
                            <option value="Buenaflor Embarkadero">
                              Buenaflor Embarkadero
                            </option>
                            <option value="Burgos-Regidor">
                              Burgos-Regidor
                            </option>
                            <option value="Calao">Calao</option>
                            <option value="Cali">Cali</option>
                            <option value="Cansilayan">Cansilayan</option>
                            <option value="Capaliz">Capaliz</option>
                            <option value="Cayos">Cayos</option>
                            <option value="Compayan">Compayan</option>
                            <option value="Dacutan">Dacutan</option>
                            <option value="Ermita">Ermita</option>
                            <option value="Ilaya 1st">Ilaya 1st</option>
                            <option value="Ilaya 2nd">Ilaya 2nd</option>
                            <option value="Ilaya 3rd">Ilaya 3rd</option>
                            <option value="Jardin">Jardin</option>
                            <option value="Lacturan">Lacturan</option>
                            <option value="Lopez Jaena - Rizal">
                              Lopez Jaena - Rizal
                            </option>
                            <option value="Managuit">Managuit</option>
                            <option value="Maquina">Maquina</option>
                            <option value="Nanding Lopez">Nanding Lopez</option>
                            <option value="Pagdugue">Pagdugue</option>
                            <option value="Paloc Bigque">Paloc Bigque</option>
                            <option value="Paloc Sool">Paloc Sool</option>
                            <option value="Patlad">Patlad</option>
                            <option value="Pd Monfort North">
                              Pd Monfort North
                            </option>
                            <option value="Pd Monfort South">
                              Pd Monfort South
                            </option>
                            <option value="Pulao">Pulao</option>
                            <option value="Rosario">Rosario</option>
                            <option value="Sapao">Sapao</option>
                            <option value="Sulangan">Sulangan</option>
                            <option value="Tabucan">Tabucan</option>
                            <option value="Talusan">Talusan</option>
                            <option value="Tambobo">Tambobo</option>
                            <option value="Tamboilan">Tamboilan</option>
                            <option value="Victorias">Victorias</option>
                          </select>
                          {errors.barangay && (
                            <div className="jo-registration-error">
                              {errors.barangay}
                            </div>
                          )}
                        </div>
                        <div className="jo-registration-form-group">
                          <label>MUNICIPALITY</label>
                          <input
                            type="text"
                            value="Dumangas"
                            readOnly
                            disabled
                            style={{
                              backgroundColor: "#f3f4f6",
                              color: "#6b7280",
                              cursor: "not-allowed",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {currentStep === 3 && (
              <div className="jo-registration-form-section">
                <h3>PART III: FARM PROFILE</h3>
                <div className="jo-registration-form-grid">
                  <div className="jo-registration-livelihood-details">
                    <h4>Type of Farming Activity</h4>

                    {farmerRole === "owner" ? (
                      /* READ-ONLY PREVIEW for Land Owner path */
                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "10px 14px",
                            backgroundColor: "#eff6ff",
                            border: "1px solid #bfdbfe",
                            borderRadius: "8px",
                            marginBottom: "16px",
                            fontSize: "13px",
                            color: "#1d4ed8",
                          }}
                        >
                          <span style={{ fontSize: "16px" }}>ℹ️</span>
                          <span>
                            These farming activities are pre-filled from your
                            existing land owner record and cannot be edited
                            here.
                          </span>
                        </div>

                        <div
                          style={{
                            padding: "15px",
                            borderRadius: "8px",
                            border: "1px solid #e2e8f0",
                            backgroundColor: "#f8fafc",
                            opacity: 0.85,
                          }}
                        >
                          <div
                            className="jo-registration-checkbox-group"
                            style={{ marginBottom: "10px" }}
                          >
                            <label
                              style={{
                                cursor: "not-allowed",
                                color: "#64748b",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={(formData as any).farmerRice}
                                disabled
                                style={{ cursor: "not-allowed" }}
                              />{" "}
                              Rice
                            </label>
                            <label
                              style={{
                                cursor: "not-allowed",
                                color: "#64748b",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={(formData as any).farmerCorn}
                                disabled
                                style={{ cursor: "not-allowed" }}
                              />{" "}
                              Corn
                            </label>
                            <label
                              style={{
                                cursor: "not-allowed",
                                color: "#64748b",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={(formData as any).farmerOtherCrops}
                                disabled
                                style={{ cursor: "not-allowed" }}
                              />{" "}
                              Other crops, please specify
                            </label>
                          </div>
                          {(formData as any).farmerOtherCrops && (
                            <input
                              type="text"
                              readOnly
                              value={(formData as any).farmerOtherCropsText}
                              style={{
                                marginBottom: "15px",
                                backgroundColor: "#f1f5f9",
                                cursor: "not-allowed",
                                color: "#475569",
                              }}
                            />
                          )}

                          <div
                            className="jo-registration-checkbox-group"
                            style={{ marginBottom: "10px" }}
                          >
                            <label
                              style={{
                                cursor: "not-allowed",
                                color: "#64748b",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={(formData as any).farmerLivestock}
                                disabled
                                style={{ cursor: "not-allowed" }}
                              />{" "}
                              Livestock, please specify
                            </label>
                          </div>
                          {(formData as any).farmerLivestock && (
                            <input
                              type="text"
                              readOnly
                              value={(formData as any).farmerLivestockText}
                              style={{
                                marginBottom: "15px",
                                backgroundColor: "#f1f5f9",
                                cursor: "not-allowed",
                                color: "#475569",
                              }}
                            />
                          )}

                          <div
                            className="jo-registration-checkbox-group"
                            style={{ marginBottom: "0" }}
                          >
                            <label
                              style={{
                                cursor: "not-allowed",
                                color: "#64748b",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={(formData as any).farmerPoultry}
                                disabled
                                style={{ cursor: "not-allowed" }}
                              />{" "}
                              Poultry, please specify
                            </label>
                          </div>
                          {(formData as any).farmerPoultry && (
                            <input
                              type="text"
                              readOnly
                              value={(formData as any).farmerPoultryText}
                              style={{
                                marginBottom: "0",
                                backgroundColor: "#f1f5f9",
                                cursor: "not-allowed",
                                color: "#475569",
                              }}
                            />
                          )}
                        </div>
                      </div>
                    ) : (
                      /* READ-ONLY PREVIEW for Tenant / Lessee path — per land owner */
                      <div>
                        {/* Info banner */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "10px 14px",
                            backgroundColor: "#eff6ff",
                            border: "1px solid #bfdbfe",
                            borderRadius: "8px",
                            marginBottom: "16px",
                            fontSize: "13px",
                            color: "#1d4ed8",
                          }}
                        >
                          <span style={{ fontSize: "16px" }}>ℹ️</span>
                          <span>
                            Farming activities are sourced from each land
                            owner's registered record and cannot be edited here.
                          </span>
                        </div>

                        {/* Per-land-owner activity cards */}
                        {[
                          selectedLandOwner
                            ? {
                                id: selectedLandOwner.id,
                                name: selectedLandOwner.name,
                              }
                            : null,
                          ...additionalLandOwnerGroups
                            .filter((g) => g.landOwner)
                            .map((g) => ({
                              id: g.landOwner.id,
                              name: g.landOwner.name,
                            })),
                        ]
                          .filter(
                            (o): o is { id: number; name: string } =>
                              o !== null,
                          )
                          .map((owner) => {
                            const act = landOwnerActivities[owner.id];
                            return (
                              <div
                                key={owner.id}
                                style={{
                                  marginBottom: "14px",
                                  borderRadius: "8px",
                                  border: "1px solid #e2e8f0",
                                  backgroundColor: "#f8fafc",
                                  opacity: 0.85,
                                  overflow: "hidden",
                                }}
                              >
                                {/* Card header — land owner name */}
                                <div
                                  style={{
                                    padding: "7px 14px",
                                    backgroundColor: "#e2e8f0",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    color: "#374151",
                                    borderBottom: "1px solid #cbd5e1",
                                  }}
                                >
                                  📋 {owner.name}
                                </div>

                                <div style={{ padding: "14px" }}>
                                  {!act ? (
                                    <span
                                      style={{
                                        fontSize: "13px",
                                        color: "#94a3b8",
                                      }}
                                    >
                                      No activity data on record
                                    </span>
                                  ) : (
                                    <>
                                      <div
                                        className="jo-registration-checkbox-group"
                                        style={{ marginBottom: "10px" }}
                                      >
                                        <label
                                          style={{
                                            cursor: "not-allowed",
                                            color: "#64748b",
                                          }}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={act.farmerRice}
                                            disabled
                                            style={{ cursor: "not-allowed" }}
                                          />{" "}
                                          Rice
                                        </label>
                                        <label
                                          style={{
                                            cursor: "not-allowed",
                                            color: "#64748b",
                                          }}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={act.farmerCorn}
                                            disabled
                                            style={{ cursor: "not-allowed" }}
                                          />{" "}
                                          Corn
                                        </label>
                                        <label
                                          style={{
                                            cursor: "not-allowed",
                                            color: "#64748b",
                                          }}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={act.farmerOtherCrops}
                                            disabled
                                            style={{ cursor: "not-allowed" }}
                                          />{" "}
                                          Other crops, please specify
                                        </label>
                                      </div>
                                      {act.farmerOtherCrops && (
                                        <input
                                          type="text"
                                          readOnly
                                          value={act.farmerOtherCropsText}
                                          style={{
                                            marginBottom: "12px",
                                            backgroundColor: "#f1f5f9",
                                            cursor: "not-allowed",
                                            color: "#475569",
                                          }}
                                        />
                                      )}

                                      <div
                                        className="jo-registration-checkbox-group"
                                        style={{ marginBottom: "10px" }}
                                      >
                                        <label
                                          style={{
                                            cursor: "not-allowed",
                                            color: "#64748b",
                                          }}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={act.farmerLivestock}
                                            disabled
                                            style={{ cursor: "not-allowed" }}
                                          />{" "}
                                          Livestock, please specify
                                        </label>
                                      </div>
                                      {act.farmerLivestock && (
                                        <input
                                          type="text"
                                          readOnly
                                          value={act.farmerLivestockText}
                                          style={{
                                            marginBottom: "12px",
                                            backgroundColor: "#f1f5f9",
                                            cursor: "not-allowed",
                                            color: "#475569",
                                          }}
                                        />
                                      )}

                                      <div
                                        className="jo-registration-checkbox-group"
                                        style={{ marginBottom: 0 }}
                                      >
                                        <label
                                          style={{
                                            cursor: "not-allowed",
                                            color: "#64748b",
                                          }}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={act.farmerPoultry}
                                            disabled
                                            style={{ cursor: "not-allowed" }}
                                          />{" "}
                                          Poultry, please specify
                                        </label>
                                      </div>
                                      {act.farmerPoultry && (
                                        <input
                                          type="text"
                                          readOnly
                                          value={act.farmerPoultryText}
                                          style={{
                                            marginBottom: 0,
                                            backgroundColor: "#f1f5f9",
                                            cursor: "not-allowed",
                                            color: "#475569",
                                          }}
                                        />
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="jo-registration-form-section">
                <h3>PART II: FARMLAND</h3>

                {/* ── YES path: per-parcel cultivating cards ─────────────── */}
                {/* ── YES path: select which owned parcels to farm ────────── */}
                {farmerRole === "owner" && (
                  <>
                    <div
                      style={{
                        marginBottom: "1.25rem",
                        padding: "1rem 1.25rem",
                        backgroundColor: "#e8f4f8",
                        borderRadius: "8px",
                        border: "1px solid #bee5eb",
                      }}
                    >
                      <strong style={{ color: "#2c3e50" }}>
                        Your Registered Parcels
                      </strong>
                      <p
                        style={{
                          margin: "0.25rem 0 0",
                          fontSize: "0.88rem",
                          color: "#6c757d",
                        }}
                      >
                        Select the parcels you are farming:{" "}
                        <strong>{selectedSelfLandOwner?.name}</strong>
                      </p>
                    </div>
                    {ownedParcels.length === 0 ? (
                      <div className="jo-registration-parcel-warning">
                        No registered parcels found for your land owner record.
                        Please check your selection in Step 1.
                      </div>
                    ) : (
                      <div className="jo-registration-parcel-list">
                        {ownedParcels.map((parcel) => {
                          const pid = String(parcel.id);
                          const isSelected = selectedOwnedParcelIds.has(pid);
                          return (
                            <div
                              key={pid}
                              className={`jo-registration-parcel-item ${isSelected ? "jo-registration-selected" : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  setSelectedOwnedParcelIds((prev) => {
                                    const next = new Set(prev);
                                    next.has(pid)
                                      ? next.delete(pid)
                                      : next.add(pid);
                                    return next;
                                  });
                                }}
                              />
                              <div className="jo-registration-parcel-details">
                                <div className="jo-registration-parcel-header">
                                  {parcel.parcel_number || `Parcel ${pid}`}
                                </div>
                                <div className="jo-registration-parcel-info">
                                  <span>
                                    Barangay:{" "}
                                    {parcel.farm_location_barangay ||
                                      "Not provided"}
                                  </span>
                                  <span>
                                    Area:{" "}
                                    {parcel.total_farm_area_ha ||
                                      "Not provided"}{" "}
                                    ha
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* ── "Do you also farm land you don't own?" ─────────── */}
                    <div
                      style={{
                        marginTop: "1.5rem",
                        marginBottom: "1rem",
                        padding: "1.25rem 1.5rem",
                        backgroundColor: "#f8f9fa",
                        borderRadius: "8px",
                        border: errors.alsoFarmsQuestion
                          ? "2px solid #dc2626"
                          : "2px solid #dee2e6",
                      }}
                    >
                      <h4 style={{ marginBottom: "0.5rem", color: "#2c3e50" }}>
                        Do you also farm land you don't own?
                      </h4>
                      <p
                        style={{
                          fontSize: "0.88rem",
                          color: "#6c757d",
                          marginBottom: "1rem",
                        }}
                      >
                        Select YES if you are also a tenant or lessee on someone
                        else's parcel(s).
                      </p>
                      <div style={{ display: "flex", gap: "1rem" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setAlsoFarmsOthersLand(true);
                            handleOwnershipCategoryChange("tenant");
                            setErrors((prev) => ({
                              ...prev,
                              alsoFarmsQuestion: "",
                            }));
                          }}
                          style={{
                            padding: "0.65rem 2rem",
                            backgroundColor:
                              alsoFarmsOthersLand === true
                                ? "#0d6efd"
                                : "white",
                            color:
                              alsoFarmsOthersLand === true
                                ? "white"
                                : "#2c3e50",
                            border: "2px solid #0d6efd",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontWeight: "bold",
                            fontSize: "0.95rem",
                          }}
                        >
                          YES
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAlsoFarmsOthersLand(false);
                            setSelectedLandOwner(null);
                            setLandOwnerSearchTerm("");
                            setOwnerParcels([]);
                            setSelectedParcelIds(new Set());
                            setErrors((prev) => ({
                              ...prev,
                              alsoFarmsQuestion: "",
                            }));
                          }}
                          style={{
                            padding: "0.65rem 2rem",
                            backgroundColor:
                              alsoFarmsOthersLand === false
                                ? "#28a745"
                                : "white",
                            color:
                              alsoFarmsOthersLand === false
                                ? "white"
                                : "#2c3e50",
                            border: "2px solid #28a745",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontWeight: "bold",
                            fontSize: "0.95rem",
                          }}
                        >
                          NO
                        </button>
                      </div>
                      {errors.alsoFarmsQuestion && (
                        <div
                          className="jo-registration-error"
                          style={{ marginTop: "0.5rem" }}
                        >
                          {errors.alsoFarmsQuestion}
                        </div>
                      )}
                    </div>

                    {/* Role picker for extra parcels (YES + also farms) */}
                    {alsoFarmsOthersLand === true && (
                      <div
                        style={{
                          marginBottom: "2rem",
                          padding: "1.5rem",
                          backgroundColor: "#f8f9fa",
                          borderRadius: "8px",
                          border: "2px solid #dee2e6",
                        }}
                      >
                        <h4 style={{ marginBottom: "1rem", color: "#2c3e50" }}>
                          Your Role on the Additional Parcel(s)
                        </h4>
                        <div
                          style={{
                            display: "flex",
                            gap: "1rem",
                            flexWrap: "wrap",
                          }}
                        >
                          <label
                            style={{
                              flex: "1",
                              minWidth: "160px",
                              padding: "1rem",
                              backgroundColor:
                                ownershipCategory === "tenant"
                                  ? "#28a745"
                                  : "white",
                              color:
                                ownershipCategory === "tenant"
                                  ? "white"
                                  : "#2c3e50",
                              border: "2px solid #28a745",
                              borderRadius: "6px",
                              cursor: "pointer",
                              textAlign: "center",
                              fontWeight: "bold",
                            }}
                          >
                            <input
                              type="radio"
                              name="extraOwnershipCategory"
                              checked={ownershipCategory === "tenant"}
                              onChange={() =>
                                handleOwnershipCategoryChange("tenant")
                              }
                              style={{ marginRight: "0.5rem" }}
                            />
                            Tenant
                          </label>
                          <label
                            style={{
                              flex: "1",
                              minWidth: "160px",
                              padding: "1rem",
                              backgroundColor:
                                ownershipCategory === "lessee"
                                  ? "#ffc107"
                                  : "white",
                              color: "#2c3e50",
                              border: "2px solid #ffc107",
                              borderRadius: "6px",
                              cursor: "pointer",
                              textAlign: "center",
                              fontWeight: "bold",
                            }}
                          >
                            <input
                              type="radio"
                              name="extraOwnershipCategory"
                              checked={ownershipCategory === "lessee"}
                              onChange={() =>
                                handleOwnershipCategoryChange("lessee")
                              }
                              style={{ marginRight: "0.5rem" }}
                            />
                            Lessee
                          </label>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Prompt if gate not answered yet */}
                {farmerRole === null && (
                  <div
                    style={{
                      padding: "1.5rem",
                      backgroundColor: "#fff3cd",
                      border: "1px solid #ffc107",
                      borderRadius: "8px",
                      color: "#664d03",
                      fontSize: "0.9rem",
                    }}
                  >
                    ⚠️ Please go back to Step 1 and answer the Land Owner
                    question to continue.
                  </div>
                )}

                {/* Step 2: Land Owner Search — shown for NO path and YES path extra parcels */}
                <div
                  style={{
                    marginBottom: "2rem",
                    padding: "1.5rem",
                    backgroundColor: "#f8f9fa",
                    borderRadius: "8px",
                    border: errors.landOwner
                      ? "2px solid #dc2626"
                      : "2px solid #dee2e6",
                    display: showLandOwnerSearch ? undefined : "none",
                  }}
                >
                  <h4 style={{ marginBottom: "1rem", color: "#2c3e50" }}>
                    Search Land Owner
                  </h4>
                  <p
                    style={{
                      fontSize: "0.9rem",
                      color: "#6c757d",
                      marginBottom: "0.75rem",
                    }}
                  >
                    Search for the land owner of the parcel(s) you are farming:
                  </p>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      placeholder="Type land owner name..."
                      value={landOwnerSearchTerm}
                      onChange={(e) => {
                        setLandOwnerSearchTerm(e.target.value);
                        setShowLandOwnerDropdown(true);
                        if (!e.target.value) {
                          setSelectedLandOwner(null);
                          setOwnerParcels([]);
                          setSelectedParcelIds(new Set());
                        }
                      }}
                      onFocus={() => setShowLandOwnerDropdown(true)}
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        border: "1px solid #ced4da",
                        borderRadius: "6px",
                        fontSize: "0.95rem",
                      }}
                    />
                    {showLandOwnerDropdown && landOwnerSearchTerm && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          right: 0,
                          backgroundColor: "white",
                          border: "1px solid #ced4da",
                          borderRadius: "0 0 6px 6px",
                          maxHeight: "200px",
                          overflowY: "auto",
                          zIndex: 100,
                          boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                        }}
                      >
                        {filteredLandOwners.length > 0 ? (
                          filteredLandOwners.map((owner) => (
                            <div
                              key={owner.id}
                              onClick={() => handleLandOwnerSelect(owner)}
                              style={{
                                padding: "0.75rem 1rem",
                                cursor: "pointer",
                                borderBottom: "1px solid #f0f0f0",
                                fontSize: "0.95rem",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  "#f8f9fa";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = "white";
                              }}
                            >
                              <strong>{owner.name}</strong>
                              {owner.barangay && (
                                <span
                                  style={{
                                    color: "#6c757d",
                                    marginLeft: "0.5rem",
                                    fontSize: "0.85rem",
                                  }}
                                >
                                  — {owner.barangay}
                                </span>
                              )}
                            </div>
                          ))
                        ) : (
                          <div
                            style={{
                              padding: "0.75rem 1rem",
                              color: "#6c757d",
                              fontSize: "0.9rem",
                            }}
                          >
                            No land owners found
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Selected land owner confirmation badge */}
                  {selectedLandOwner && (
                    <div
                      style={{
                        marginTop: "0.75rem",
                        padding: "0.6rem 1rem",
                        backgroundColor: "#d4edda",
                        border: "1px solid #c3e6cb",
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ color: "#155724", fontWeight: "bold" }}>
                        ✓ {selectedLandOwner.name}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedLandOwner(null);
                          setLandOwnerSearchTerm("");
                          setOwnerParcels([]);
                          setSelectedParcelIds(new Set());
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#721c24",
                          cursor: "pointer",
                          fontWeight: "bold",
                          fontSize: "1rem",
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {errors.landOwner && (
                    <div
                      className="jo-registration-error"
                      style={{ marginTop: "0.5rem" }}
                    >
                      {errors.landOwner}
                    </div>
                  )}
                </div>

                {showParcelSelection && (
                  <div
                    style={{
                      padding: "1.5rem",
                      backgroundColor: "#f8f9fa",
                      borderRadius: "8px",
                      border: errors.parcelSelection
                        ? "2px solid #dc2626"
                        : "2px solid #dee2e6",
                    }}
                  >
                    <h4 style={{ marginBottom: "1rem", color: "#2c3e50" }}>
                      Select Parcel(s)
                    </h4>

                    {ownerParcels.length === 0 ? (
                      <div className="jo-registration-parcel-warning">
                        The selected land owner has no registered parcels.
                      </div>
                    ) : (
                      <div className="jo-registration-parcel-list">
                        {ownerParcels.map((parcel) => {
                          const parcelId = String(parcel.id);
                          const isSelected = selectedParcelIds.has(parcelId);
                          const { isReplacement, currentHolderName } =
                            getParcelReplacementInfo(
                              parcel,
                              selectedLandOwner?.id,
                            );

                          return (
                            <div
                              key={parcelId}
                              className={`jo-registration-parcel-item ${
                                isSelected ? "jo-registration-selected" : ""
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() =>
                                  handleParcelSelectionToggle(parcel.id)
                                }
                              />
                              <div className="jo-registration-parcel-details">
                                <div className="jo-registration-parcel-header">
                                  {parcel.parcel_number || `Parcel ${parcelId}`}
                                  {isReplacement && (
                                    <span
                                      style={{
                                        marginLeft: "0.5rem",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "0.25rem",
                                        padding: "0.15rem 0.5rem",
                                        borderRadius: "999px",
                                        fontSize: "0.75rem",
                                        fontWeight: 600,
                                        color: "#92400e",
                                        backgroundColor: "#fef3c7",
                                        border: "1px solid #f59e0b",
                                      }}
                                    >
                                      ⚠ Currently farmed by {currentHolderName}
                                    </span>
                                  )}
                                </div>
                                <div className="jo-registration-parcel-info">
                                  <span>
                                    Barangay:{" "}
                                    {parcel.farm_location_barangay ||
                                      "Not provided"}
                                  </span>
                                  <span>
                                    Area:{" "}
                                    {parcel.total_farm_area_ha ||
                                      "Not provided"}{" "}
                                    ha
                                  </span>
                                </div>
                                {isReplacement && isSelected && (
                                  <div
                                    style={{
                                      marginTop: "0.4rem",
                                      fontSize: "0.8rem",
                                      color: "#92400e",
                                    }}
                                  >
                                    Selecting this parcel will replace{" "}
                                    <strong>{currentHolderName}</strong> as the
                                    current farmer once this registration is
                                    submitted.
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {errors.parcelSelection && (
                      <div
                        className="jo-registration-error"
                        style={{ marginTop: "0.5rem" }}
                      >
                        {errors.parcelSelection}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Additional Land Owner Groups (tenant/lessee only) ──── */}
                {(farmerRole === "tenant" || farmerRole === "lessee") &&
                  selectedLandOwner !== null && (
                    <>
                      {additionalLandOwnerGroups.map((group, idx) => {
                        const filteredGroupOwners = landowners.filter((o) =>
                          o.name
                            .toLowerCase()
                            .includes(group.searchTerm.toLowerCase()),
                        );
                        return (
                          <div
                            key={group.groupId}
                            style={{
                              marginTop: "1.5rem",
                              padding: "1.5rem",
                              backgroundColor: "#f8f9fa",
                              borderRadius: "8px",
                              border: errors[`addGroup_${group.groupId}`]
                                ? "2px solid #dc2626"
                                : "2px solid #dee2e6",
                            }}
                          >
                            {/* Group header */}
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: "1rem",
                              }}
                            >
                              <h4 style={{ margin: 0, color: "#2c3e50" }}>
                                Land Owner #{idx + 2}
                              </h4>
                              <button
                                type="button"
                                onClick={() =>
                                  removeLandOwnerGroup(group.groupId)
                                }
                                style={{
                                  background: "none",
                                  border: "1px solid #dc2626",
                                  color: "#dc2626",
                                  borderRadius: "6px",
                                  padding: "0.3rem 0.75rem",
                                  cursor: "pointer",
                                  fontSize: "0.85rem",
                                  fontWeight: "bold",
                                }}
                              >
                                ✕ Remove
                              </button>
                            </div>

                            {/* Land owner search */}
                            <div
                              style={{
                                position: "relative",
                                marginBottom: "0.75rem",
                              }}
                            >
                              <input
                                type="text"
                                placeholder="Type land owner name..."
                                value={group.searchTerm}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateAdditionalGroup(group.groupId, {
                                    searchTerm: val,
                                    showDropdown: true,
                                    ...(val === "" && {
                                      landOwner: null,
                                      parcels: [],
                                      selectedParcelIds: new Set<string>(),
                                    }),
                                  });
                                }}
                                onFocus={() =>
                                  updateAdditionalGroup(group.groupId, {
                                    showDropdown: true,
                                  })
                                }
                                style={{
                                  width: "100%",
                                  padding: "0.75rem",
                                  border: "1px solid #ced4da",
                                  borderRadius: "6px",
                                  fontSize: "0.95rem",
                                }}
                              />
                              {group.showDropdown && group.searchTerm && (
                                <div
                                  style={{
                                    position: "absolute",
                                    top: "100%",
                                    left: 0,
                                    right: 0,
                                    backgroundColor: "white",
                                    border: "1px solid #ced4da",
                                    borderRadius: "0 0 6px 6px",
                                    maxHeight: "200px",
                                    overflowY: "auto",
                                    zIndex: 100,
                                    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                                  }}
                                >
                                  {(() => {
                                    const filteredGroupOwners =
                                      landowners.filter((o) =>
                                        o.name
                                          .toLowerCase()
                                          .includes(
                                            group.searchTerm.toLowerCase(),
                                          ),
                                      );
                                    return filteredGroupOwners.length > 0 ? (
                                      filteredGroupOwners.map((owner) => (
                                        <div
                                          key={owner.id}
                                          onClick={() =>
                                            handleAdditionalLandOwnerSelect(
                                              group.groupId,
                                              owner,
                                            )
                                          }
                                          style={{
                                            padding: "0.75rem 1rem",
                                            cursor: "pointer",
                                            borderBottom: "1px solid #f0f0f0",
                                            fontSize: "0.95rem",
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor =
                                              "#f8f9fa";
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor =
                                              "white";
                                          }}
                                        >
                                          <strong>{owner.name}</strong>
                                          {owner.barangay && (
                                            <span
                                              style={{
                                                color: "#6c757d",
                                                marginLeft: "0.5rem",
                                                fontSize: "0.85rem",
                                              }}
                                            >
                                              — {owner.barangay}
                                            </span>
                                          )}
                                        </div>
                                      ))
                                    ) : (
                                      <div
                                        style={{
                                          padding: "0.75rem 1rem",
                                          color: "#6c757d",
                                          fontSize: "0.9rem",
                                        }}
                                      >
                                        No land owners found
                                      </div>
                                    ); // ← semicolon ends the return statement
                                  })()}
                                </div>
                              )}
                            </div>

                            {/* Selected land owner badge */}
                            {group.landOwner && (
                              <div
                                style={{
                                  marginBottom: "1rem",
                                  padding: "0.6rem 1rem",
                                  backgroundColor: "#d4edda",
                                  border: "1px solid #c3e6cb",
                                  borderRadius: "6px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                }}
                              >
                                <span
                                  style={{
                                    color: "#155724",
                                    fontWeight: "bold",
                                  }}
                                >
                                  ✓ {group.landOwner.name}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateAdditionalGroup(group.groupId, {
                                      landOwner: null,
                                      searchTerm: "",
                                      parcels: [],
                                      selectedParcelIds: new Set(),
                                    })
                                  }
                                  style={{
                                    background: "none",
                                    border: "none",
                                    color: "#721c24",
                                    cursor: "pointer",
                                    fontWeight: "bold",
                                    fontSize: "1rem",
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            )}

                            {/* Parcel list */}
                            {group.landOwner && (
                              <>
                                {group.parcels.length === 0 ? (
                                  <div className="jo-registration-parcel-warning">
                                    The selected land owner has no registered
                                    parcels.
                                  </div>
                                ) : (
                                  <div className="jo-registration-parcel-list">
                                    {group.parcels.map((parcel) => {
                                      const pid = String(parcel.id);
                                      const isSelected =
                                        group.selectedParcelIds.has(pid);
                                      const {
                                        isReplacement,
                                        currentHolderName,
                                      } = getParcelReplacementInfo(
                                        parcel,
                                        group.landOwner?.id,
                                      );
                                      return (
                                        <div
                                          key={pid}
                                          className={`jo-registration-parcel-item ${isSelected ? "jo-registration-selected" : ""}`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => {
                                              const next = new Set(
                                                group.selectedParcelIds,
                                              );
                                              next.has(pid)
                                                ? next.delete(pid)
                                                : next.add(pid);
                                              updateAdditionalGroup(
                                                group.groupId,
                                                { selectedParcelIds: next },
                                              );
                                              setErrors((prev) => ({
                                                ...prev,
                                                [`addGroup_${group.groupId}`]:
                                                  "",
                                              }));
                                            }}
                                          />
                                          <div className="jo-registration-parcel-details">
                                            <div className="jo-registration-parcel-header">
                                              {parcel.parcel_number ||
                                                `Parcel ${pid}`}
                                              {isReplacement && (
                                                <span
                                                  style={{
                                                    marginLeft: "0.5rem",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "0.25rem",
                                                    padding: "0.15rem 0.5rem",
                                                    borderRadius: "999px",
                                                    fontSize: "0.75rem",
                                                    fontWeight: 600,
                                                    color: "#92400e",
                                                    backgroundColor: "#fef3c7",
                                                    border: "1px solid #f59e0b",
                                                  }}
                                                >
                                                  ⚠ Currently farmed by{" "}
                                                  {currentHolderName}
                                                </span>
                                              )}
                                            </div>
                                            <div className="jo-registration-parcel-info">
                                              <span>
                                                Barangay:{" "}
                                                {parcel.farm_location_barangay ||
                                                  "Not provided"}
                                              </span>
                                              <span>
                                                Area:{" "}
                                                {parcel.total_farm_area_ha ||
                                                  "Not provided"}{" "}
                                                ha
                                              </span>
                                            </div>
                                            {isReplacement && isSelected && (
                                              <div
                                                style={{
                                                  marginTop: "0.4rem",
                                                  fontSize: "0.8rem",
                                                  color: "#92400e",
                                                }}
                                              >
                                                Selecting this parcel will
                                                replace{" "}
                                                <strong>
                                                  {currentHolderName}
                                                </strong>{" "}
                                                as the current farmer once this
                                                registration is submitted.
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </>
                            )}

                            {/* Group-level error */}
                            {errors[`addGroup_${group.groupId}`] && (
                              <div
                                className="jo-registration-error"
                                style={{ marginTop: "0.5rem" }}
                              >
                                {errors[`addGroup_${group.groupId}`]}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Add another land owner button */}
                      <button
                        type="button"
                        onClick={addLandOwnerGroup}
                        style={{
                          marginTop: "1.25rem",
                          width: "100%",
                          padding: "0.75rem",
                          backgroundColor: "white",
                          border: "2px dashed #0d6efd",
                          borderRadius: "8px",
                          color: "#0d6efd",
                          fontSize: "0.95rem",
                          fontWeight: "bold",
                          cursor: "pointer",
                        }}
                      >
                        + Add Another Land Owner
                      </button>
                    </>
                  )}
              </div>
            )}

            {currentStep === 4 && (
              <div className="jo-registration-form-section">
                <h3>PART IV: VERIFICATION</h3>

                {/* Compilation of Previous Steps */}
                <div className="jo-registration-compilation">
                  <h4>FORM SUMMARY - PLEASE REVIEW ALL INFORMATION</h4>

                  {/* Step 1: Personal Information Summary */}
                  <div className="jo-registration-summary-section">
                    <h3>PART I: PERSONAL INFORMATION</h3>
                    <div className="jo-registration-summary-grid">
                      <div className="jo-registration-summary-item">
                        <span className="jo-registration-summary-label">
                          Name:
                        </span>
                        <span className="jo-registration-summary-value">
                          {formData.firstName}, {formData.middleName},{" "}
                          {formData.surname}, {formData.extensionName}
                        </span>
                      </div>
                      <div className="jo-registration-summary-item">
                        <span className="jo-registration-summary-label">
                          Gender
                        </span>
                        <span className="jo-registration-summary-value">
                          {formData.gender}
                        </span>
                      </div>
                      <div className="jo-registration-summary-item">
                        <span className="jo-registration-summary-label">
                          Date of Birth:
                        </span>
                        <span className="jo-registration-summary-value">
                          {formData.dateOfBirth
                            ? new Date(
                                formData.dateOfBirth,
                              ).toLocaleDateString()
                            : "Not provided"}
                        </span>
                      </div>
                      <div className="jo-registration-summary-item">
                        <span className="jo-registration-summary-label">
                          Age:
                        </span>
                        <span className="jo-registration-summary-value">
                          {formData.age
                            ? `${formData.age} years old`
                            : "Not provided"}
                        </span>
                      </div>
                      <div className="jo-registration-summary-item">
                        <span className="jo-registration-summary-label">
                          Address:
                        </span>
                        <span className="jo-registration-summary-value">
                          {formData.barangay}, {formData.municipality}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Farm Profile Summary */}
                  <div className="jo-registration-summary-section">
                    <h3>PART II: FARM PROFILE</h3>
                    <div className="jo-registration-summary-grid">
                      <div className="jo-registration-summary-item">
                        <span className="jo-registration-summary-label">
                          Main Livelihood:
                        </span>
                        <span className="jo-registration-summary-value">
                          {formData.mainLivelihood || "Not selected"}
                        </span>
                      </div>

                      {/* Farmer Details */}
                      {formData.mainLivelihood === "farmer" && (
                        <div className="jo-registration-summary-item">
                          <span className="jo-registration-summary-label">
                            Farming Activities:
                          </span>
                          <span className="jo-registration-summary-value">
                            {[
                              (formData as any).farmerRice && "Rice",
                              (formData as any).farmerCorn && "Corn",
                              (formData as any).farmerOtherCrops &&
                                `Other crops: ${(formData as any).farmerOtherCropsText}`,
                              (formData as any).farmerLivestock &&
                                `Livestock: ${(formData as any).farmerLivestockText}`,
                              (formData as any).farmerPoultry &&
                                `Poultry: ${(formData as any).farmerPoultryText}`,
                            ]
                              .filter(Boolean)
                              .join(", ") || "None selected"}
                          </span>
                        </div>
                      )}

                      {/* Farmworker Details */}
                      {formData.mainLivelihood === "farmworker" && (
                        <div className="jo-registration-summary-item">
                          <span className="jo-registration-summary-label">
                            Kind of Work:
                          </span>
                          <span className="jo-registration-summary-value">
                            {[
                              (formData as any).fwLandPrep &&
                                "Land Preparation",
                              (formData as any).fwPlanting &&
                                "Planting/Transplanting",
                              (formData as any).fwCultivation && "Cultivation",
                              (formData as any).fwHarvesting && "Harvesting",
                              (formData as any).fwOthers &&
                                `Others: ${(formData as any).fwOthersText}`,
                            ]
                              .filter(Boolean)
                              .join(", ") || "None selected"}
                          </span>
                        </div>
                      )}

                      {/* Fisherfolk Details */}
                      {formData.mainLivelihood === "fisherfolk" && (
                        <div className="jo-registration-summary-item">
                          <span className="jo-registration-summary-label">
                            Fishing Activities:
                          </span>
                          <span className="jo-registration-summary-value">
                            {[
                              (formData as any).ffFishCapture && "Fish Capture",
                              (formData as any).ffAquaculture && "Aquaculture",
                              (formData as any).ffGleaning && "Gleaning",
                              (formData as any).ffFishProcessing &&
                                "Fish Processing",
                              (formData as any).ffFishVending && "Fish Vending",
                              (formData as any).ffOthers &&
                                `Others: ${(formData as any).ffOthersText}`,
                            ]
                              .filter(Boolean)
                              .join(", ") || "None selected"}
                          </span>
                        </div>
                      )}

                      {/* Agri Youth Details */}
                      {formData.mainLivelihood === "agri-youth" && (
                        <div className="jo-registration-summary-item">
                          <span className="jo-registration-summary-label">
                            Type of Involvement:
                          </span>
                          <span className="jo-registration-summary-value">
                            {[
                              (formData as any).ayPartHousehold &&
                                "Part of farming household",
                              (formData as any).ayFormalCourse &&
                                "Formal agri-fishery course",
                              (formData as any).ayNonFormalCourse &&
                                "Non-formal agri-fishery course",
                              (formData as any).ayParticipatedProgram &&
                                "Agricultural activity/program",
                              (formData as any).ayOthers &&
                                `Others: ${(formData as any).ayOthersText}`,
                            ]
                              .filter(Boolean)
                              .join(", ") || "None selected"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 3: Farmland Summary */}
                  <div className="jo-registration-summary-section">
                    <h3>PART III: FARMLAND</h3>
                    {(formData.farmlandParcels as any[]).map((parcel, idx) => (
                      <div key={idx} className="jo-registration-parcel-summary">
                        <h6>Farm Parcel No. {parcel.parcelNo || idx + 1}</h6>
                        <div className="jo-registration-summary-grid">
                          <div className="jo-registration-summary-item">
                            <span className="jo-registration-summary-label">
                              Location:
                            </span>
                            <span className="jo-registration-summary-value">
                              {parcel.farmLocationBarangay},{" "}
                              {parcel.farmLocationMunicipality}
                            </span>
                          </div>
                          <div className="jo-registration-summary-item">
                            <span className="jo-registration-summary-label">
                              Total Area:
                            </span>
                            <span className="jo-registration-summary-value">
                              {parcel.totalFarmAreaHa
                                ? `${parcel.totalFarmAreaHa} hectares`
                                : "Not specified"}
                            </span>
                          </div>
                          <div className="jo-registration-summary-item">
                            <span className="jo-registration-summary-label">
                              Ownership Type:
                            </span>
                            <span className="jo-registration-summary-value">
                              {[
                                parcel.ownershipTypeRegisteredOwner &&
                                  "Registered Owner",
                                parcel.ownershipTypeTenant &&
                                  (parcel.tenantLandOwnerName
                                    ? `Tenant (${parcel.tenantLandOwnerName})`
                                    : "Tenant"),
                                parcel.ownershipTypeLessee &&
                                  (parcel.lesseeLandOwnerName
                                    ? `Lessee (${parcel.lesseeLandOwnerName})`
                                    : "Lessee"),
                                parcel.ownershipTypeOthers &&
                                  `Others: ${parcel.ownershipOthersSpecify}`,
                              ]
                                .filter(Boolean)
                                .join(", ") || "Not specified"}
                            </span>
                          </div>
                          <div className="jo-registration-summary-item">
                            <span className="jo-registration-summary-label">
                              Currently Cultivating:
                            </span>
                            <span className="jo-registration-summary-value">
                              {parcel.isCultivating === true
                                ? "Yes"
                                : parcel.isCultivating === false
                                  ? "No"
                                  : "Not specified"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="jo-registration-form-actions">
              {currentStep > 1 && (
                <button
                  className="jo-registration-btn-save"
                  onClick={handlePrevStep}
                  disabled={isSubmitting}
                >
                  Previous
                </button>
              )}
              {currentStep < 4 ? (
                <button
                  className="jo-registration-btn-submit"
                  onClick={handleSubmitForm}
                  disabled={isSubmitting}
                >
                  Next Step
                </button>
              ) : (
                <button
                  className="jo-registration-btn-submit"
                  onClick={handleSubmitForm}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Submitting..." : "Submit Form"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal.show && (
        <div
          className="jo-confirm-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="jo-confirm-title"
        >
          <div className="jo-confirm-modal">
            {/* Header */}
            <div className="jo-confirm-modal-header">
              <div className="jo-confirm-modal-header-icon">🏛️</div>
              <div>
                <h2 id="jo-confirm-title" className="jo-confirm-modal-title">
                  Registration Confirmation
                </h2>
                <p className="jo-confirm-modal-header-sub">
                  RSBSA — Registry System for Basic Sectors in Agriculture
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="jo-confirm-modal-divider" />

            {/* Body */}
            <div className="jo-confirm-modal-body">
              <p className="jo-confirm-modal-intro">
                Please review the following details before proceeding:
              </p>

              <div className="jo-confirm-modal-details">
                <div className="jo-confirm-modal-detail-row">
                  <span className="jo-confirm-modal-detail-label">
                    Registration Type
                  </span>
                  <span className="jo-confirm-modal-detail-value jo-confirm-modal-badge">
                    {confirmModal.roleText}
                  </span>
                </div>
                <div className="jo-confirm-modal-detail-row">
                  <span className="jo-confirm-modal-detail-label">
                    Land Owner
                  </span>
                  <span className="jo-confirm-modal-detail-value">
                    {confirmModal.landOwnerName}
                  </span>
                </div>
                <div className="jo-confirm-modal-detail-row">
                  <span className="jo-confirm-modal-detail-label">
                    Selected Parcels
                  </span>
                  <span className="jo-confirm-modal-detail-value">
                    {confirmModal.parcelCount} parcel
                    {confirmModal.parcelCount !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              <p className="jo-confirm-modal-notice">
                ⚠️ By confirming, you acknowledge that the information provided
                is accurate and complete.
              </p>
            </div>

            {/* Footer Actions */}
            <div className="jo-confirm-modal-footer">
              <button
                className="jo-confirm-modal-btn-cancel"
                onClick={() =>
                  setConfirmModal((prev) => ({ ...prev, show: false }))
                }
              >
                Cancel
              </button>
              <button
                className="jo-confirm-modal-btn-confirm"
                onClick={() => {
                  setConfirmModal((prev) => ({ ...prev, show: false }));

                  if (farmerRole === "owner") {
                    applyOwnedParcels();
                  } else {
                    applySelectedParcels();
                  }

                  setErrors({});
                  setCurrentStep(3);
                }}
              >
                ✓ Confirm &amp; Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div
          className={`jo-registration-toast jo-registration-toast-${toast.type}`}
        >
          <div className="jo-registration-toast-icon">
            {toast.type === "success" && "✅"}
            {toast.type === "error" && "❌"}
            {toast.type === "warning" && "⚠️"}
          </div>
          <div className="jo-registration-toast-content">
            <span className="jo-registration-toast-message">
              {toast.message}
            </span>
          </div>
          <button
            className="jo-registration-toast-close"
            onClick={() => setToast((prev) => ({ ...prev, show: false }))}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};

export default JoRsbsa;
