import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getLandOwners,
  getLandOwnerById,
  getRegisteredFarmers,
  getFarmParcels,
  createRsbsaSubmission,
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
  contractEndDate: string;
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
  const [contractEndDates, setContractEndDates] = useState<
    Record<string, string>
  >({});
  const [isManualLandowner, setIsManualLandowner] = useState(false);
  const [manualLandownerName, setManualLandownerName] = useState("");

  // ── YES/NO gate: "Are you already a registered Land Owner?" ──────────────
  const [isRegisteredLandOwner, setIsRegisteredLandOwner] = useState<
    boolean | null
  >(null);

  // ── YES path Step 1: search for own LO record ────────────────────────────
  const [selectedSelfLandOwner, setSelectedSelfLandOwner] = useState<any>(null);
  const [selfSearchTerm, setSelfSearchTerm] = useState("");
  const [showSelfDropdown, setShowSelfDropdown] = useState(false);
  const [isFetchingSelfRecord, setIsFetchingSelfRecord] = useState(false);

  // ── YES path Step 3: owned parcels from the LO record ───────────────────
  const [ownedParcels, setOwnedParcels] = useState<any[]>([]);

  // ── YES path Step 3: per-parcel cultivating answers ─────────────────────
  const [ownedParcelStatus, setOwnedParcelStatus] = useState<
    Record<string, "self" | "tenant" | "lessee">
  >({});
  const [ownedParcelFarmerName, setOwnedParcelFarmerName] = useState<
    Record<string, string>
  >({});
  const [ownedParcelContractDate, setOwnedParcelContractDate] = useState<
    Record<string, string>
  >({});

  // ── YES path Step 3: live farmer search per parcel ───────────────────────
  const [parcelFarmerSearchTerm, setParcelFarmerSearchTerm] = useState<
    Record<string, string>
  >({});
  const [showParcelFarmerDropdown, setShowParcelFarmerDropdown] = useState<
    Record<string, boolean>
  >({});
  const [registeredFarmers, setRegisteredFarmers] = useState<any[]>([]);

  // ── YES path Step 3: "do you also farm others' land?" ───────────────────
  const [alsoFarmsOthersLand, setAlsoFarmsOthersLand] = useState<
    boolean | null
  >(null);

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
    const fetchRegisteredOwners = async () => {
      try {
        const ownersResponse = await getLandOwners();
        if (ownersResponse.error) {
          console.error(
            "Error fetching registered owners:",
            ownersResponse.error,
          );
          setAllRegisteredOwners([]);
          return;
        }

        const owners = (ownersResponse.data || []) as LandOwner[];
        if (!owners.length) {
          setAllRegisteredOwners([]);
          return;
        }

        const ownerIds = owners
          .map((owner) => Number(owner.id))
          .filter((id) => Number.isFinite(id));

        if (!ownerIds.length) {
          setAllRegisteredOwners([]);
          return;
        }

        const { data: parcels, error: parcelError } = await supabase
          .from("rsbsa_farm_parcels")
          .select(
            "id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, submission_id, ownership_type_registered_owner, is_current_owner",
          )
          .in("submission_id", ownerIds)
          .eq("ownership_type_registered_owner", true)
          .or("is_current_owner.is.null,is_current_owner.eq.true");

        if (parcelError) {
          console.error("Error fetching parcels:", parcelError);
          return;
        }

        // Build name lookup
        const nameMap: Record<number, string> = {};
        owners.forEach((owner) => {
          const ownerId = Number(owner.id);
          if (!Number.isFinite(ownerId)) return;
          nameMap[ownerId] = owner.name;
        });

        // Map parcels to ExistingParcel format
        const ownerParcels: ExistingParcel[] = (parcels || []).map(
          (p: any) => ({
            id: p.id,
            parcel_number: p.parcel_number || `Parcel-${p.submission_id}`,
            farm_location_barangay: p.farm_location_barangay || "",
            farm_location_municipality:
              p.farm_location_municipality || "Dumangas",
            total_farm_area_ha: p.total_farm_area_ha || 0,
            current_holder: nameMap[p.submission_id] || "Unknown",
            ownership_type: "Owner",
          }),
        );

        setAllRegisteredOwners(ownerParcels);
      } catch (err) {
        console.error("Error loading registered owners:", err);
      }
    };

    fetchRegisteredOwners();
  }, []);

  // Fetch landowners from the database
  useEffect(() => {
    const fetchLandowners = async () => {
      try {
        const response = await getLandOwners();
        if (response.error) {
          throw new Error("Failed to fetch landowners");
        }
        const data = response.data || [];
        setLandowners(data);
      } catch (error) {
        console.error("Error fetching landowners:", error);
      }
    };

    fetchLandowners();
  }, []);

  // Load registered farmers for per-parcel tenant/lessee live search
  useEffect(() => {
    const fetchFarmers = async () => {
      try {
        const response = await getRegisteredFarmers();
        if (!response.error) {
          setRegisteredFarmers(response.data || []);
        }
      } catch (err) {
        console.error("Error fetching registered farmers:", err);
      }
    };
    fetchFarmers();
  }, []);

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
        contractEndDate: "",
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
            contractEndDate: "",
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
    setContractEndDates({});
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
          contractEndDate: "",
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
    setContractEndDates({});
    setErrors((prev) => ({ ...prev, landOwner: "", parcelSelection: "" }));

    // Fetch the land owner's parcels to show for selection
    try {
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
          const isCurrent = parcel.is_current_owner !== false;
          return isOwnerParcel && isCurrent;
        });
        console.log("Fetched land owner parcels:", parcels);
        setOwnerParcels(parcels);

        if (!parcels || parcels.length === 0) {
          console.warn("No parcels found for land owner");
        }
      } else {
        console.error("Failed to fetch land owner parcels");
        setOwnerParcels([]);
      }
    } catch (error) {
      console.error("Error fetching land owner parcels:", error);
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

  const handleContractEndDateChange = (
    parcelId: string | number,
    value: string,
  ) => {
    const normalizedParcelId = String(parcelId);
    setContractEndDates((prev) => ({
      ...prev,
      [normalizedParcelId]: value,
    }));
    setErrors((prev) => ({ ...prev, contractEndDate: "" }));
  };

  // Apply selected parcels to form data (called internally after confirmation)
  const applySelectedParcels = () => {
    const selectedParcels = ownerParcels.filter((p) =>
      selectedParcelIds.has(String(p.id)),
    );
    const isTenant = ownershipCategory === "tenant";
    const isLessee = ownershipCategory === "lessee";

    console.log("📋 Applying selected parcels:", selectedParcels);

    setFormData((prev) => {
      const parcels: Parcel[] = selectedParcels.map(
        (ownerParcel: any, index: number) => ({
          parcelNo: String(index + 1),
          farmLocationBarangay: ownerParcel.farm_location_barangay || "",
          farmLocationMunicipality:
            ownerParcel.farm_location_municipality || "Dumangas",
          totalFarmAreaHa: String(ownerParcel.total_farm_area_ha || ""),
          contractEndDate: contractEndDates[String(ownerParcel.id)] || "",
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
          ownershipOthersSpecify: "",
          // IMPORTANT: Include existing parcel info for ownership transfer tracking
          existingParcelId: ownerParcel.land_parcel_id || ownerParcel.id,
          existingParcelNumber: ownerParcel.parcel_number || "",
        }),
      );
      console.log("📋 Mapped parcels with existingParcelId:", parcels);
      return { ...prev, farmlandParcels: parcels };
    });

    setErrors((prev) => ({ ...prev, parcelSelection: "" }));
  };

  // Filter land owners based on search term
  const filteredLandOwners = landowners.filter((owner) =>
    owner.name.toLowerCase().includes(landOwnerSearchTerm.toLowerCase()),
  );

  // Filter landowners for the self-search in Step 1 (YES path)
  const filteredSelfOwners = landowners.filter((owner) =>
    owner.name.toLowerCase().includes(selfSearchTerm.toLowerCase()),
  );

  // Controls whether the "Search Land Owner" block and parcel selection block
  // are shown — true for the NO path, and for the YES path's extra-parcels section
  const showLandOwnerSearch =
    isRegisteredLandOwner === false ||
    (isRegisteredLandOwner === true && alsoFarmsOthersLand === true);

  const showParcelSelection =
    showLandOwnerSearch &&
    selectedLandOwner !== null &&
    ownershipCategory !== "owner";

  // Whether Step 1 fields are pre-filled from the selected LO record
  const isPreFilled =
    isRegisteredLandOwner === true && selectedSelfLandOwner !== null;

  // Select the farmer's own LO record (YES path, Step 1)
  const handleSelfLandOwnerSelect = async (owner: any) => {
    setSelectedSelfLandOwner(owner);
    setSelfSearchTerm(owner.name);
    setShowSelfDropdown(false);
    setIsFetchingSelfRecord(true);
    // Reset per-parcel state in case they re-select
    setOwnedParcels([]);
    setOwnedParcelStatus({});
    setOwnedParcelFarmerName({});
    setOwnedParcelContractDate({});
    setParcelFarmerSearchTerm({});
    setShowParcelFarmerDropdown({});
    setErrors((prev) => ({
      ...prev,
      selfLandOwner: "",
      landOwnerQuestion: "",
    }));

    try {
      // 1. Fetch full submission record to pre-fill personal info
      const recordResp = await getLandOwnerById(Number(owner.id));
      if (!recordResp.error && recordResp.data) {
        const r = recordResp.data;
        // Calculate age from DOB
        let age = "";
        if (r.dateOfBirth) {
          const birth = new Date(r.dateOfBirth + "T00:00:00");
          const today = new Date();
          let a = today.getFullYear() - birth.getFullYear();
          const m = today.getMonth() - birth.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) a--;
          age = String(a);
        }
        setFormData((prev) => ({
          ...prev,
          firstName: r.firstName,
          surname: r.surname,
          middleName: r.middleName,
          extensionName: r.extensionName,
          gender: r.gender,
          dateOfBirth: r.dateOfBirth,
          age,
          barangay: r.barangay,
          municipality: r.municipality || "Dumangas",
        }));
      }

      // 2. Fetch their owned parcels for Step 3 cultivating cards
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

  // Build farmlandParcels for the YES path and proceed to Step 4
  const applyOwnedParcels = () => {
    const ownedMapped: Parcel[] = ownedParcels.map((parcel, idx) => {
      const pid = String(parcel.id);
      const status = ownedParcelStatus[pid] || "self";
      return {
        parcelNo: String(idx + 1),
        farmLocationBarangay: parcel.farm_location_barangay || "",
        farmLocationMunicipality:
          parcel.farm_location_municipality || "Dumangas",
        totalFarmAreaHa: String(parcel.total_farm_area_ha || ""),
        contractEndDate:
          status === "lessee" ? ownedParcelContractDate[pid] || "" : "",
        withinAncestralDomain: parcel.within_ancestral_domain || "",
        ownershipDocumentNo: parcel.ownership_document_no || "",
        agrarianReformBeneficiary: parcel.agrarian_reform_beneficiary || "",
        isCultivating: status === "self",
        ownershipTypeRegisteredOwner: true,
        ownershipTypeTenant: false,
        ownershipTypeLessee: false,
        ownershipTypeOthers: false,
        tenantLandOwnerName:
          status === "tenant" ? ownedParcelFarmerName[pid] || "" : "",
        lesseeLandOwnerName:
          status === "lessee" ? ownedParcelFarmerName[pid] || "" : "",
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
          contractEndDate: contractEndDates[String(p.id)] || "",
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

  const handleSubmitForm = () => {
    // We'll validate only what is relevant to the current step so users can progress step-by-step
    const newErrors: Record<string, string> = {};

    if (currentStep === 1) {
      // Gate check: must answer YES or NO first
      if (isRegisteredLandOwner === null) {
        newErrors.landOwnerQuestion =
          "Please answer: Are you already a registered Land Owner?";
        setErrors(newErrors);
        return;
      }

      // YES path: must have selected own LO record before we can pre-fill and continue
      if (isRegisteredLandOwner === true && !selectedSelfLandOwner) {
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

      // clear any step-level errors and go to next step
      setErrors({});
      setCurrentStep(2);
      return;
    }

    if (currentStep === 2) {
      // Validate farm profile: require at least one farming activity
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

      setErrors(newErrors);
      if (Object.keys(newErrors).length > 0) return;

      setErrors({});
      setCurrentStep(3);
      return;
    }

    if (currentStep === 3) {
      // ── YES path ────────────────────────────────────────────────────────
      if (isRegisteredLandOwner === true) {
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
          // Validate the additional tenant/lessee parcels
          if (!selectedLandOwner) {
            newErrors.landOwner =
              "Please select the land owner of the additional parcel(s)";
          } else if (ownerParcels.length === 0) {
            newErrors.parcelSelection =
              "The selected land owner has no registered parcels.";
          } else if (selectedParcelIds.size === 0) {
            newErrors.parcelSelection = "Please select at least one parcel";
          } else if (ownershipCategory === "lessee") {
            const missingDates = Array.from(selectedParcelIds).filter(
              (id) => !contractEndDates[String(id)],
            );
            if (missingDates.length > 0) {
              newErrors.contractEndDate =
                "Please set contract end date for all selected parcels";
            }
          }
        }

        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return;

        const totalCount =
          ownedParcels.length +
          (alsoFarmsOthersLand ? selectedParcelIds.size : 0);
        setConfirmModal({
          show: true,
          roleText: "Registered Land Owner (Farmer)",
          parcelCount: totalCount,
          landOwnerName: selectedSelfLandOwner?.name || "",
        });
        return;
      }

      // ── NO path (pure tenant / lessee) ──────────────────────────────────
      if (!selectedLandOwner) {
        newErrors.landOwner = "Please search and select the land owner";
      } else if (ownerParcels.length === 0) {
        newErrors.parcelSelection =
          "The selected land owner has no registered parcels.";
      } else if (selectedParcelIds.size === 0) {
        newErrors.parcelSelection = "Please select at least one parcel";
      } else if (ownershipCategory === "lessee") {
        const missingContractDates = Array.from(selectedParcelIds).filter(
          (parcelId) => !contractEndDates[String(parcelId)],
        );
        if (missingContractDates.length > 0) {
          newErrors.contractEndDate =
            "Please set contract end date for all selected parcels";
        }
      }

      setErrors(newErrors);
      if (Object.keys(newErrors).length > 0) return;

      const roleText = ownershipCategory === "tenant" ? "Tenant" : "Lessee";
      setConfirmModal({
        show: true,
        roleText,
        parcelCount: selectedParcelIds.size,
        landOwnerName: selectedLandOwner?.name || "",
      });
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
      } else if (ageValue <= 18) {
        newErrors.age = "Age must be above 18";
      }
    }
    if (!formData.barangay?.trim()) newErrors.barangay = "Barangay is required";

    // Validate based on registration path
    if (isRegisteredLandOwner === false && !selectedLandOwner) {
      newErrors.landOwner = "Please select the land owner";
    }
    if (isRegisteredLandOwner === true && !selectedSelfLandOwner) {
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
        ownershipCategory: ownershipCategory,
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
          contractEndDate: parcel.contractEndDate || null,
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
        contractEndDate: parcel.contractEndDate || null,
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
      ownershipCategory,
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
                <span className="jo-registration-label">Farm Profile</span>
              </div>
              <div
                className={`jo-registration-step ${isStepActive(3) ? "jo-registration-active" : ""} ${isStepCompleted(3) ? "jo-registration-completed" : ""}`}
              >
                <span className="jo-registration-dot">
                  {isStepCompleted(3) ? "✓" : "3"}
                </span>
                <span className="jo-registration-label">Farmland</span>
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
                {/* ── Gate: Are you already a registered Land Owner? ───── */}
                <div
                  style={{
                    marginBottom: "1.5rem",
                    padding: "1.5rem",
                    backgroundColor: "#f8f9fa",
                    borderRadius: "8px",
                    border: errors.landOwnerQuestion
                      ? "2px solid #dc2626"
                      : "2px solid #dee2e6",
                  }}
                >
                  <h4 style={{ marginBottom: "0.5rem", color: "#2c3e50" }}>
                    Are you already registered as a Land Owner?
                  </h4>
                  <p
                    style={{
                      fontSize: "0.88rem",
                      color: "#6c757d",
                      marginBottom: "1rem",
                    }}
                  >
                    If you completed Land Owner registration previously, select
                    YES to look up your existing record and pre-fill your
                    details.
                  </p>
                  <div style={{ display: "flex", gap: "1rem" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsRegisteredLandOwner(true);
                        // Reset NO-path carry-over state
                        setOwnershipCategory("tenant");
                        setSelectedLandOwner(null);
                        setLandOwnerSearchTerm("");
                        setOwnerParcels([]);
                        setSelectedParcelIds(new Set());
                        setAlsoFarmsOthersLand(null);
                        setErrors((prev) => ({
                          ...prev,
                          landOwnerQuestion: "",
                        }));
                      }}
                      style={{
                        padding: "0.65rem 2rem",
                        backgroundColor:
                          isRegisteredLandOwner === true ? "#0d6efd" : "white",
                        color:
                          isRegisteredLandOwner === true ? "white" : "#2c3e50",
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
                        setIsRegisteredLandOwner(false);
                        // Reset YES-path carry-over state
                        setSelectedSelfLandOwner(null);
                        setSelfSearchTerm("");
                        setOwnedParcels([]);
                        setOwnedParcelStatus({});
                        setOwnedParcelFarmerName({});
                        setOwnedParcelContractDate({});
                        setAlsoFarmsOthersLand(null);
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
                        }));
                        setErrors((prev) => ({
                          ...prev,
                          landOwnerQuestion: "",
                          selfLandOwner: "",
                        }));
                      }}
                      style={{
                        padding: "0.65rem 2rem",
                        backgroundColor:
                          isRegisteredLandOwner === false ? "#28a745" : "white",
                        color:
                          isRegisteredLandOwner === false ? "white" : "#2c3e50",
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
                  {errors.landOwnerQuestion && (
                    <div
                      className="jo-registration-error"
                      style={{ marginTop: "0.5rem" }}
                    >
                      {errors.landOwnerQuestion}
                    </div>
                  )}

                  {/* YES path: search for own LO record */}
                  {isRegisteredLandOwner === true && (
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
                                  onClick={() =>
                                    handleSelfLandOwnerSelect(owner)
                                  }
                                  style={{
                                    padding: "0.7rem 1rem",
                                    cursor: "pointer",
                                    borderBottom: "1px solid #f0f0f0",
                                    fontSize: "0.95rem",
                                  }}
                                  onMouseEnter={(e) =>
                                    (e.currentTarget.style.backgroundColor =
                                      "#f8f9fa")
                                  }
                                  onMouseLeave={(e) =>
                                    (e.currentTarget.style.backgroundColor =
                                      "white")
                                  }
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
                                  padding: "0.7rem 1rem",
                                  color: "#6c757d",
                                  fontSize: "0.9rem",
                                }}
                              >
                                No land owners found
                              </div>
                            )}
                            {/* Soft fallback to NO path */}
                            <div
                              onClick={() => {
                                setIsRegisteredLandOwner(false);
                                setSelectedSelfLandOwner(null);
                                setSelfSearchTerm("");
                                setShowSelfDropdown(false);
                              }}
                              style={{
                                padding: "0.7rem 1rem",
                                cursor: "pointer",
                                borderTop: "2px solid #e5e7eb",
                                backgroundColor: "#f3f4f6",
                                color: "#6c757d",
                                fontSize: "0.88rem",
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  "#e9ecef")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  "#f3f4f6")
                              }
                            >
                              Not in the list? Switch to NO →
                            </div>
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

                      {/* Confirmation badge after selection */}
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
                              setOwnedParcelStatus({});
                              setOwnedParcelFarmerName({});
                              setOwnedParcelContractDate({});
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

            {currentStep === 2 && (
              <div className="jo-registration-form-section">
                <h3>PART II: FARM PROFILE</h3>
                <div className="jo-registration-form-grid">
                  <div className="jo-registration-livelihood-details">
                    <h4>Type of Farming Activity</h4>
                    <p
                      style={{
                        color: "#666",
                        fontSize: "14px",
                        marginBottom: "15px",
                      }}
                    >
                      Select all farming activities that apply:
                    </p>

                    {/* Wrapper for all farming activities - single error border */}
                    <div
                      style={{
                        padding: errors.farmingActivity ? "15px" : "0",
                        borderRadius: "6px",
                        border: errors.farmingActivity
                          ? "2px solid #dc2626"
                          : "2px solid transparent",
                        backgroundColor: errors.farmingActivity
                          ? "#fef2f2"
                          : "transparent",
                        marginBottom: "10px",
                      }}
                    >
                      {/* Crops Section */}
                      <div
                        className="jo-registration-checkbox-group"
                        style={{ marginBottom: "10px" }}
                      >
                        <label>
                          <input
                            type="checkbox"
                            checked={(formData as any).farmerRice}
                            onChange={() => toggleBool("farmerRice")}
                          />{" "}
                          Rice
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={(formData as any).farmerCorn}
                            onChange={() => toggleBool("farmerCorn")}
                          />{" "}
                          Corn
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={(formData as any).farmerOtherCrops}
                            onChange={() => toggleBool("farmerOtherCrops")}
                          />{" "}
                          Other crops, please specify
                        </label>
                      </div>
                      {(formData as any).farmerOtherCrops && (
                        <input
                          type="text"
                          placeholder="Specify other crops"
                          value={(formData as any).farmerOtherCropsText}
                          onChange={(e) =>
                            handleInputChange(
                              "farmerOtherCropsText",
                              e.target.value,
                            )
                          }
                          style={{ marginBottom: "15px" }}
                        />
                      )}

                      {/* Livestock Section */}
                      <div
                        className="jo-registration-checkbox-group"
                        style={{ marginBottom: "10px" }}
                      >
                        <label>
                          <input
                            type="checkbox"
                            checked={(formData as any).farmerLivestock}
                            onChange={() => toggleBool("farmerLivestock")}
                          />{" "}
                          Livestock, please specify
                        </label>
                      </div>
                      {(formData as any).farmerLivestock && (
                        <input
                          type="text"
                          placeholder="Specify livestock"
                          value={(formData as any).farmerLivestockText}
                          onChange={(e) =>
                            handleInputChange(
                              "farmerLivestockText",
                              e.target.value,
                            )
                          }
                          style={{ marginBottom: "15px" }}
                        />
                      )}

                      {/* Poultry Section */}
                      <div
                        className="jo-registration-checkbox-group"
                        style={{
                          marginBottom: errors.farmingActivity ? "0" : "10px",
                        }}
                      >
                        <label>
                          <input
                            type="checkbox"
                            checked={(formData as any).farmerPoultry}
                            onChange={() => toggleBool("farmerPoultry")}
                          />{" "}
                          Poultry, please specify
                        </label>
                      </div>
                      {(formData as any).farmerPoultry && (
                        <input
                          type="text"
                          placeholder="Specify poultry"
                          value={(formData as any).farmerPoultryText}
                          onChange={(e) =>
                            handleInputChange(
                              "farmerPoultryText",
                              e.target.value,
                            )
                          }
                          style={{ marginBottom: "0" }}
                        />
                      )}
                    </div>

                    {/* Error Message - shown once for all farming activities */}
                    {errors.farmingActivity && (
                      <div
                        className="jo-registration-error"
                        style={{
                          marginTop: "10px",
                          fontSize: "12px",
                          color: "#dc3545",
                        }}
                      >
                        {errors.farmingActivity}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="jo-registration-form-section">
                <h3>PART III: FARMLAND</h3>

                {/* ── YES path: per-parcel cultivating cards ─────────────── */}
                {isRegisteredLandOwner === true && (
                  <>
                    {/* Owned parcels header */}
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
                        From land owner record:{" "}
                        <strong>{selectedSelfLandOwner?.name}</strong>
                      </p>
                    </div>

                    {ownedParcels.length === 0 ? (
                      <div className="jo-registration-parcel-warning">
                        No registered parcels found for your land owner record.
                        Please check your selection in Step 1.
                      </div>
                    ) : (
                      ownedParcels.map((parcel) => {
                        const pid = String(parcel.id);
                        const status = ownedParcelStatus[pid] || "self";
                        const filteredFarmers = registeredFarmers.filter(
                          (f) =>
                            (parcelFarmerSearchTerm[pid] || "").length > 0 &&
                            f.name
                              .toLowerCase()
                              .includes(
                                (
                                  parcelFarmerSearchTerm[pid] || ""
                                ).toLowerCase(),
                              ),
                        );

                        return (
                          <div
                            key={pid}
                            style={{
                              backgroundColor: "#fff",
                              border: "1px solid #ced4da",
                              borderRadius: "8px",
                              padding: "1.25rem",
                              marginBottom: "1rem",
                            }}
                          >
                            {/* Parcel header */}
                            <div style={{ marginBottom: "0.75rem" }}>
                              <strong style={{ color: "#2c3e50" }}>
                                {parcel.parcel_number || `Parcel ${pid}`}
                              </strong>
                              <span
                                style={{
                                  color: "#6c757d",
                                  marginLeft: "0.75rem",
                                  fontSize: "0.88rem",
                                }}
                              >
                                {parcel.farm_location_barangay}
                                {parcel.total_farm_area_ha
                                  ? ` · ${parcel.total_farm_area_ha} ha`
                                  : ""}
                              </span>
                            </div>

                            <label
                              style={{
                                fontWeight: "600",
                                display: "block",
                                marginBottom: "0.6rem",
                                color: "#495057",
                                fontSize: "0.9rem",
                              }}
                            >
                              Who is currently cultivating this parcel?
                            </label>

                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.5rem",
                              }}
                            >
                              {/* Self */}
                              <label
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.5rem",
                                  cursor: "pointer",
                                  fontSize: "0.9rem",
                                }}
                              >
                                <input
                                  type="radio"
                                  name={`parcel-status-${pid}`}
                                  checked={status === "self"}
                                  onChange={() =>
                                    setOwnedParcelStatus((prev) => ({
                                      ...prev,
                                      [pid]: "self",
                                    }))
                                  }
                                />
                                I am farming this myself
                              </label>

                              {/* Tenant */}
                              <label
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.5rem",
                                  cursor: "pointer",
                                  fontSize: "0.9rem",
                                }}
                              >
                                <input
                                  type="radio"
                                  name={`parcel-status-${pid}`}
                                  checked={status === "tenant"}
                                  onChange={() =>
                                    setOwnedParcelStatus((prev) => ({
                                      ...prev,
                                      [pid]: "tenant",
                                    }))
                                  }
                                />
                                A tenant is farming this
                              </label>
                              {status === "tenant" && (
                                <div
                                  style={{
                                    marginLeft: "1.5rem",
                                    position: "relative",
                                  }}
                                >
                                  <input
                                    type="text"
                                    placeholder="Search or enter tenant name…"
                                    value={parcelFarmerSearchTerm[pid] || ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setParcelFarmerSearchTerm((prev) => ({
                                        ...prev,
                                        [pid]: val,
                                      }));
                                      setOwnedParcelFarmerName((prev) => ({
                                        ...prev,
                                        [pid]: val,
                                      }));
                                      setShowParcelFarmerDropdown((prev) => ({
                                        ...prev,
                                        [pid]: true,
                                      }));
                                    }}
                                    onFocus={() =>
                                      setShowParcelFarmerDropdown((prev) => ({
                                        ...prev,
                                        [pid]: true,
                                      }))
                                    }
                                    style={{
                                      width: "100%",
                                      padding: "0.6rem",
                                      border: "1px solid #ced4da",
                                      borderRadius: "6px",
                                      fontSize: "0.9rem",
                                    }}
                                  />
                                  {showParcelFarmerDropdown[pid] &&
                                    (parcelFarmerSearchTerm[pid] || "").length >
                                      0 && (
                                      <div
                                        style={{
                                          position: "absolute",
                                          top: "100%",
                                          left: 0,
                                          right: 0,
                                          backgroundColor: "white",
                                          border: "1px solid #ced4da",
                                          borderRadius: "0 0 6px 6px",
                                          maxHeight: "160px",
                                          overflowY: "auto",
                                          zIndex: 100,
                                          boxShadow:
                                            "0 4px 6px rgba(0,0,0,0.1)",
                                        }}
                                      >
                                        {filteredFarmers.length > 0 ? (
                                          filteredFarmers.map((f) => (
                                            <div
                                              key={f.id}
                                              onClick={() => {
                                                setOwnedParcelFarmerName(
                                                  (prev) => ({
                                                    ...prev,
                                                    [pid]: f.name,
                                                  }),
                                                );
                                                setParcelFarmerSearchTerm(
                                                  (prev) => ({
                                                    ...prev,
                                                    [pid]: f.name,
                                                  }),
                                                );
                                                setShowParcelFarmerDropdown(
                                                  (prev) => ({
                                                    ...prev,
                                                    [pid]: false,
                                                  }),
                                                );
                                              }}
                                              style={{
                                                padding: "0.6rem 1rem",
                                                cursor: "pointer",
                                                fontSize: "0.9rem",
                                                borderBottom:
                                                  "1px solid #f0f0f0",
                                              }}
                                              onMouseEnter={(e) =>
                                                (e.currentTarget.style.backgroundColor =
                                                  "#f8f9fa")
                                              }
                                              onMouseLeave={(e) =>
                                                (e.currentTarget.style.backgroundColor =
                                                  "white")
                                              }
                                            >
                                              <strong>{f.name}</strong>
                                              {f.barangay && (
                                                <span
                                                  style={{
                                                    color: "#6c757d",
                                                    marginLeft: "0.5rem",
                                                    fontSize: "0.82rem",
                                                  }}
                                                >
                                                  — {f.barangay}
                                                </span>
                                              )}
                                            </div>
                                          ))
                                        ) : (
                                          <div
                                            style={{
                                              padding: "0.6rem 1rem",
                                              color: "#6c757d",
                                              fontSize: "0.85rem",
                                            }}
                                          >
                                            No matches — name will be saved as
                                            entered
                                          </div>
                                        )}
                                      </div>
                                    )}
                                </div>
                              )}

                              {/* Lessee */}
                              <label
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.5rem",
                                  cursor: "pointer",
                                  fontSize: "0.9rem",
                                }}
                              >
                                <input
                                  type="radio"
                                  name={`parcel-status-${pid}`}
                                  checked={status === "lessee"}
                                  onChange={() =>
                                    setOwnedParcelStatus((prev) => ({
                                      ...prev,
                                      [pid]: "lessee",
                                    }))
                                  }
                                />
                                A lessee holds a contract
                              </label>
                              {status === "lessee" && (
                                <div
                                  style={{
                                    marginLeft: "1.5rem",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.4rem",
                                  }}
                                >
                                  {/* Lessee name search (same dropdown) */}
                                  <div style={{ position: "relative" }}>
                                    <input
                                      type="text"
                                      placeholder="Search or enter lessee name…"
                                      value={parcelFarmerSearchTerm[pid] || ""}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setParcelFarmerSearchTerm((prev) => ({
                                          ...prev,
                                          [pid]: val,
                                        }));
                                        setOwnedParcelFarmerName((prev) => ({
                                          ...prev,
                                          [pid]: val,
                                        }));
                                        setShowParcelFarmerDropdown((prev) => ({
                                          ...prev,
                                          [pid]: true,
                                        }));
                                      }}
                                      onFocus={() =>
                                        setShowParcelFarmerDropdown((prev) => ({
                                          ...prev,
                                          [pid]: true,
                                        }))
                                      }
                                      style={{
                                        width: "100%",
                                        padding: "0.6rem",
                                        border: "1px solid #ced4da",
                                        borderRadius: "6px",
                                        fontSize: "0.9rem",
                                      }}
                                    />
                                    {showParcelFarmerDropdown[pid] &&
                                      (parcelFarmerSearchTerm[pid] || "")
                                        .length > 0 && (
                                        <div
                                          style={{
                                            position: "absolute",
                                            top: "100%",
                                            left: 0,
                                            right: 0,
                                            backgroundColor: "white",
                                            border: "1px solid #ced4da",
                                            borderRadius: "0 0 6px 6px",
                                            maxHeight: "160px",
                                            overflowY: "auto",
                                            zIndex: 100,
                                            boxShadow:
                                              "0 4px 6px rgba(0,0,0,0.1)",
                                          }}
                                        >
                                          {filteredFarmers.length > 0 ? (
                                            filteredFarmers.map((f) => (
                                              <div
                                                key={f.id}
                                                onClick={() => {
                                                  setOwnedParcelFarmerName(
                                                    (prev) => ({
                                                      ...prev,
                                                      [pid]: f.name,
                                                    }),
                                                  );
                                                  setParcelFarmerSearchTerm(
                                                    (prev) => ({
                                                      ...prev,
                                                      [pid]: f.name,
                                                    }),
                                                  );
                                                  setShowParcelFarmerDropdown(
                                                    (prev) => ({
                                                      ...prev,
                                                      [pid]: false,
                                                    }),
                                                  );
                                                }}
                                                style={{
                                                  padding: "0.6rem 1rem",
                                                  cursor: "pointer",
                                                  fontSize: "0.9rem",
                                                  borderBottom:
                                                    "1px solid #f0f0f0",
                                                }}
                                                onMouseEnter={(e) =>
                                                  (e.currentTarget.style.backgroundColor =
                                                    "#f8f9fa")
                                                }
                                                onMouseLeave={(e) =>
                                                  (e.currentTarget.style.backgroundColor =
                                                    "white")
                                                }
                                              >
                                                <strong>{f.name}</strong>
                                                {f.barangay && (
                                                  <span
                                                    style={{
                                                      color: "#6c757d",
                                                      marginLeft: "0.5rem",
                                                      fontSize: "0.82rem",
                                                    }}
                                                  >
                                                    — {f.barangay}
                                                  </span>
                                                )}
                                              </div>
                                            ))
                                          ) : (
                                            <div
                                              style={{
                                                padding: "0.6rem 1rem",
                                                color: "#6c757d",
                                                fontSize: "0.85rem",
                                              }}
                                            >
                                              No matches — name will be saved as
                                              entered
                                            </div>
                                          )}
                                        </div>
                                      )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
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

                {/* ── NO path: role picker (Tenant / Lessee only) ────────── */}
                {isRegisteredLandOwner === false && (
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
                      Select Your Role
                    </h4>
                    <div
                      style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}
                    >
                      <label
                        style={{
                          flex: "1",
                          minWidth: "200px",
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
                          name="ownershipCategory"
                          value="tenant"
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
                          minWidth: "200px",
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
                          name="ownershipCategory"
                          value="lessee"
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

                {/* Prompt if gate not answered yet */}
                {isRegisteredLandOwner === null && (
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
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  "#f8f9fa")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  "white")
                              }
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

                {/* Step 3: Parcel Selection — shown after land owner is selected (tenant/lessee only) */}
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
                                {isSelected &&
                                  ownershipCategory === "lessee" && (
                                    <div
                                      className="jo-registration-form-group"
                                      style={{ marginTop: "0.75rem" }}
                                    ></div>
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
                          {ownershipCategory !== "owner" && (
                            <div className="jo-registration-summary-item">
                              <span className="jo-registration-summary-label">
                                Contract End Date:
                              </span>
                              <span className="jo-registration-summary-value">
                                {parcel.contractEndDate
                                  ? new Date(
                                      parcel.contractEndDate,
                                    ).toLocaleDateString()
                                  : "Not specified"}
                              </span>
                            </div>
                          )}
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

                  if (isRegisteredLandOwner === true) {
                    // YES path: build parcels from owned + optional extra
                    applyOwnedParcels();
                  } else {
                    // NO path: apply checkbox-selected parcels
                    applySelectedParcels();
                  }

                  setErrors({});
                  setCurrentStep(4);
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
