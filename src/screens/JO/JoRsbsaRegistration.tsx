import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  getLandOwners,
  getFarmParcels,
  createRsbsaSubmission,
} from "../../api";
import { supabase } from "../../supabase";
import {
  getAuditLogger,
  AuditAction,
  AuditModule,
} from "../../components/Audit/auditLogger";
import "../../assets/css/jo css/JoRsbsaRegistrationStyle.css";
import "../../components/layout/sidebarStyle.css";
import LogoImage from "../../assets/images/Logo.png";
import HomeIcon from "../../assets/images/home.png";
import RSBSAIcon from "../../assets/images/rsbsa.png";
import MasterlistIcon from "../../assets/images/approve.png";
import LogoutIcon from "../../assets/images/logout.png";
import IncentivesIcon from "../../assets/images/incentives.png";

interface Parcel {
  parcelNo: string;
  farmLocationBarangay: string;
  farmLocationMunicipality: string;
  totalFarmAreaHa: string;
  withinAncestralDomain: string; // 'Yes' | 'No'
  ownershipDocumentNo: string;
  agrarianReformBeneficiary: string; // 'Yes' | 'No'
  ownershipTypeRegisteredOwner: boolean;
  ownershipTypeTenant: boolean;
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

import { useEffect } from "react";

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
  const location = useLocation();

  type OwnershipCategory =
    | "registeredOwner"
    | "tenantLessee"
    | "tenant"
    | "lessee";

  const [_activeTab] = useState("overview");
  const isActive = (path: string) => location.pathname === path;
  const [draftId, _setDraftId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [landowners, setLandowners] = useState<LandOwner[]>([]);

  // New state for ownership category selection
  const [ownershipCategory, setOwnershipCategory] =
    useState<OwnershipCategory>("registeredOwner");

  const isTenantLesseeCategory = (category: OwnershipCategory) =>
    category === "tenantLessee" ||
    category === "tenant" ||
    category === "lessee";

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
  const [existingParcelFilter, setExistingParcelFilter] = useState("");
  const [useExistingParcel, setUseExistingParcel] = useState<boolean>(false);
  const [selectedExistingParcel, setSelectedExistingParcel] =
    useState<ExistingParcel | null>(null);

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

  // Clear existing parcel selection
  const clearExistingParcelSelection = () => {
    setFormData((prev) => {
      const parcels = [...prev.farmlandParcels];
      parcels[0] = {
        ...parcels[0],
        existingParcelId: undefined,
        existingParcelNumber: undefined,
        farmLocationBarangay: "",
        farmLocationMunicipality: "Dumangas",
        totalFarmAreaHa: "",
      };
      return { ...prev, farmlandParcels: parcels };
    });
    setSelectedExistingParcel(null);
    setExistingParcelFilter("");
    setUseExistingParcel(false);
  };

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
        ownershipDocumentNo: "",
        agrarianReformBeneficiary: "",
        ownershipTypeRegisteredOwner: true, // Default to registered owner
        ownershipTypeTenant: false,
        ownershipTypeLessee: false,
        ownershipTypeOthers: false,
        tenantLandOwnerName: "",
        lesseeLandOwnerName: "",
        ownershipOthersSpecify: "",
      },
    ],
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
      parcels[idx] = { ...parcels[idx], [field]: value };
      return { ...prev, farmlandParcels: parcels };
    });
    // clear parcel-related errors when user edits parcels
    setErrors((prev) => ({ ...prev, farmland: "" }));
  };

  const toggleBool = (field: keyof FormData) => {
    setFormData((prev) => ({ ...prev, [field]: !prev[field] }));
    // Clear farmingActivity error when any activity checkbox is toggled
    setErrors((prev) => ({ ...prev, farmingActivity: "" }));
  };

  const addParcel = () => {
    setFormData((prev) => {
      const nextNo = String(prev.farmlandParcels.length + 1);
      const parcels = [...prev.farmlandParcels];
      parcels.push({
        parcelNo: nextNo,
        farmLocationBarangay: "",
        farmLocationMunicipality: "",
        totalFarmAreaHa: "",
        withinAncestralDomain: "",
        ownershipDocumentNo: "",
        agrarianReformBeneficiary: "",
        ownershipTypeRegisteredOwner: ownershipCategory === "registeredOwner",
        ownershipTypeTenant: isTenantLesseeCategory(ownershipCategory),
        ownershipTypeLessee: false,
        ownershipTypeOthers: false,
        tenantLandOwnerName: "",
        lesseeLandOwnerName: "",
        ownershipOthersSpecify: "",
      });
      return { ...prev, farmlandParcels: parcels };
    });
  };

  const removeParcel = (idx: number) => {
    setFormData((prev) => {
      const parcels = [...prev.farmlandParcels];
      parcels.splice(idx, 1);
      return { ...prev, farmlandParcels: parcels };
    });
  };

  // Handle ownership category change (Registered Owner, Tenant, Lessee)
  const handleOwnershipCategoryChange = (category: OwnershipCategory) => {
    setOwnershipCategory(category);
    setSelectedLandOwner(null);
    setLandOwnerSearchTerm("");
    setShowLandOwnerDropdown(false);
    setOwnerParcels([]);
    setSelectedParcelIds(new Set());
    setErrors((prev) => ({
      ...prev,
      farmland: "",
      landOwner: "",
      parcelSelection: "",
    }));

    const isTenant = category === "tenant" || category === "tenantLessee";
    const isLessee = category === "lessee";

    // Clear or set ownership type checkboxes based on selection
    setFormData((prev) => {
      const parcels = prev.farmlandParcels.map((p) => ({
        ...p,
        ownershipTypeRegisteredOwner: category === "registeredOwner",
        ownershipTypeTenant: isTenant,
        ownershipTypeLessee: isLessee,
        tenantLandOwnerName: isTenant ? p.tenantLandOwnerName : "",
        lesseeLandOwnerName: isLessee ? p.lesseeLandOwnerName : "",
      }));
      return { ...prev, farmlandParcels: parcels };
    });
  };

  // Handle land owner selection for tenant/lessee
  const handleLandOwnerSelect = async (owner: any) => {
    setSelectedLandOwner(owner);
    setLandOwnerSearchTerm(owner.name);
    setShowLandOwnerDropdown(false);
    setSelectedParcelIds(new Set());
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

  // Apply selected parcels to form data (called internally after confirmation)
  const applySelectedParcels = () => {
    const selectedParcels = ownerParcels.filter((p) =>
      selectedParcelIds.has(String(p.id)),
    );
    const isTenant =
      ownershipCategory === "tenant" || ownershipCategory === "tenantLessee";
    const isLessee = ownershipCategory === "lessee";

    console.log("📋 Applying selected parcels:", selectedParcels);

    setFormData((prev) => {
      const parcels = selectedParcels.map(
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
      // Validate basic details only
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
      // For Registered Owner: validate farmland fields
      if (ownershipCategory === "registeredOwner") {
        const hasValidFarmland = formData.farmlandParcels.some(
          (parcel) =>
            parcel.farmLocationBarangay?.toString().trim() &&
            parcel.totalFarmAreaHa?.toString().trim(),
        );
        if (!hasValidFarmland)
          newErrors.farmland = "Please fill in farm location and area";
      }

      // For Tenant/Lessee: validate land owner selection and parcel selection
      if (isTenantLesseeCategory(ownershipCategory)) {
        if (!selectedLandOwner) {
          newErrors.landOwner = "Please search and select the land owner";
        } else if (selectedParcelIds.size === 0) {
          newErrors.parcelSelection = "Please select at least one parcel";
        }
      }

      setErrors(newErrors);
      if (Object.keys(newErrors).length > 0) return;

      // For Tenant/Lessee: Show confirmation dialog before proceeding
      if (isTenantLesseeCategory(ownershipCategory)) {
        const roleText =
          ownershipCategory === "tenant"
            ? "Tenant"
            : ownershipCategory === "lessee"
              ? "Lessee"
              : "Tenant or Lessee";
        setConfirmModal({
          show: true,
          roleText,
          parcelCount: selectedParcelIds.size,
          landOwnerName: selectedLandOwner.name,
        });
        return;
      }

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
      } else if (ageValue <= 18) {
        newErrors.age = "Age must be above 18";
      }
    }
    if (!formData.barangay?.trim()) newErrors.barangay = "Barangay is required";

    // Validate based on ownership category
    if (ownershipCategory === "registeredOwner") {
      const hasValidFarmlandFinal = formData.farmlandParcels.some(
        (parcel) =>
          parcel.farmLocationBarangay?.toString().trim() &&
          parcel.totalFarmAreaHa?.toString().trim(),
      );
      if (!hasValidFarmlandFinal)
        newErrors.farmland =
          "At least one parcel must include barangay and area";
    }

    if (isTenantLesseeCategory(ownershipCategory)) {
      if (!selectedLandOwner) {
        newErrors.landOwner = "Please select the land owner";
      }
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
          withinAncestralDomain: parcel.withinAncestralDomain === "Yes",
          agrarianReformBeneficiary: parcel.agrarianReformBeneficiary === "Yes",
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
          const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
          const farmerName =
            `${formData.surname}, ${formData.firstName} ${formData.middleName || ""}`.trim();
          const farmDetails = buildFarmerAuditFarmDetails();
          const auditLogger = getAuditLogger();
          await auditLogger.logFarmerRegistration(
            {
              id: currentUser.id,
              name: currentUser.name || currentUser.username || "Unknown",
              role: currentUser.role || "JO",
            },
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
        {/* Sidebar starts here */}
        <div className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
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
              onClick={() => {
                localStorage.removeItem("isAuthenticated");
                navigate("/login");
              }}
            >
              <span className="nav-icon">
                <img src={LogoutIcon} alt="Logout" />
              </span>
              <span className="nav-text">Logout</span>
            </button>
          </nav>
        </div>
        {/* Sidebar ends here */}
        <div
          className={`tech-incent-sidebar-overlay ${sidebarOpen ? "active" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Main content starts here */}
        <div className="jo-registration-main-content">
          <div className="tech-incent-mobile-header">
            <button
              className="tech-incent-hamburger"
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              ☰
            </button>
            <div className="tech-incent-mobile-title">
              JO RSBSA Registration
            </div>
          </div>
          <h2>RSBSA Enrollment Form</h2>

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
                <div className="jo-registration-form-section">
                  <h3>PART I: PERSONAL INFORMATION</h3>
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
                        />
                      </div>
                      <div className="jo-registration-form-group">
                        <label>GENDER</label>
                        <select
                          value={formData.gender}
                          onChange={(e) =>
                            handleInputChange("gender", e.target.value)
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
                        <input
                          type="date"
                          value={formData.dateOfBirth}
                          onChange={(e) => {
                            handleInputChange("dateOfBirth", e.target.value);
                            // Auto-calculate age
                            if (e.target.value) {
                              const birthDate = new Date(e.target.value);
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
                          className={
                            errors.dateOfBirth
                              ? "jo-registration-input-error"
                              : ""
                          }
                        />
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
                          onChange={(e) =>
                            handleInputChange("age", e.target.value)
                          }
                          min="0"
                          max="120"
                          placeholder="Auto-calculated from birthdate"
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

                {/* Show validation summary for farmland */}
                {(errors.farmland || errors.landOwner) && (
                  <div className="jo-registration-form-errors">
                    {errors.farmland && (
                      <div className="jo-registration-error">
                        {errors.farmland}
                      </div>
                    )}
                    {errors.landOwner && (
                      <div className="jo-registration-error">
                        {errors.landOwner}
                      </div>
                    )}
                  </div>
                )}

                {/* Ownership Category Selection */}
                <div
                  className="ownership-category-section"
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
                          ownershipCategory === "registeredOwner"
                            ? "#007bff"
                            : "white",
                        color:
                          ownershipCategory === "registeredOwner"
                            ? "white"
                            : "#2c3e50",
                        border: "2px solid #007bff",
                        borderRadius: "6px",
                        cursor: "pointer",
                        textAlign: "center",
                        fontWeight: "bold",
                        transition: "all 0.3s",
                      }}
                    >
                      <input
                        type="radio"
                        name="ownershipCategory"
                        value="registeredOwner"
                        checked={ownershipCategory === "registeredOwner"}
                        onChange={() =>
                          handleOwnershipCategoryChange("registeredOwner")
                        }
                        style={{ marginRight: "0.5rem" }}
                      />
                      Registered Owner
                    </label>
                    <label
                      style={{
                        flex: "1",
                        minWidth: "200px",
                        padding: "1rem",
                        backgroundColor:
                          ownershipCategory === "tenant" ? "#28a745" : "white",
                        color:
                          ownershipCategory === "tenant" ? "white" : "#2c3e50",
                        border: "2px solid #28a745",
                        borderRadius: "6px",
                        cursor: "pointer",
                        textAlign: "center",
                        fontWeight: "bold",
                        transition: "all 0.3s",
                      }}
                    >
                      <input
                        type="radio"
                        name="ownershipCategory"
                        value="tenant"
                        checked={ownershipCategory === "tenant"}
                        onChange={() => handleOwnershipCategoryChange("tenant")}
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
                          ownershipCategory === "lessee" ? "#ffc107" : "white",
                        color:
                          ownershipCategory === "lessee"
                            ? "#2c3e50"
                            : "#2c3e50",
                        border: "2px solid #ffc107",
                        borderRadius: "6px",
                        cursor: "pointer",
                        textAlign: "center",
                        fontWeight: "bold",
                        transition: "all 0.3s",
                      }}
                    >
                      <input
                        type="radio"
                        name="ownershipCategory"
                        value="lessee"
                        checked={ownershipCategory === "lessee"}
                        onChange={() => handleOwnershipCategoryChange("lessee")}
                        style={{ marginRight: "0.5rem" }}
                      />
                      Lessee
                    </label>
                  </div>
                  <p
                    style={{
                      marginTop: "1rem",
                      fontSize: "0.9rem",
                      color: "#6c757d",
                    }}
                  >
                    {ownershipCategory === "registeredOwner" &&
                      "✓ As a Registered Owner, you will provide your farm location and parcel details."}
                    {ownershipCategory === "tenant" &&
                      "✓ As a Tenant, you will select your land owner. Farm details will be populated from the owner's data."}
                    {ownershipCategory === "lessee" &&
                      "✓ As a Lessee, you will select your land owner. Farm details will be populated from the owner's data."}
                    {ownershipCategory === "tenantLessee" &&
                      "✓ As a Tenant or Lessee, you will select your land owner. Farm details will be populated from the owner's data."}
                  </p>
                </div>

                {/* Land Owner Search for Tenant/Lessee */}
                {isTenantLesseeCategory(ownershipCategory) && (
                  <div
                    className="land-owner-search-section"
                    style={{
                      marginBottom: "2rem",
                      padding: "1.5rem",
                      backgroundColor: "#fff8e1",
                      borderRadius: "8px",
                      border: "2px solid #ffc107",
                    }}
                  >
                    <h4 style={{ marginBottom: "1rem", color: "#2c3e50" }}>
                      Search and Select Land Owner
                    </h4>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        placeholder="Type land owner name to search..."
                        value={landOwnerSearchTerm}
                        onChange={(e) => {
                          setLandOwnerSearchTerm(e.target.value);
                          setShowLandOwnerDropdown(true);
                        }}
                        onFocus={() => setShowLandOwnerDropdown(true)}
                        style={{
                          width: "100%",
                          padding: "0.75rem",
                          fontSize: "1rem",
                          border: "2px solid #ffc107",
                          borderRadius: "6px",
                        }}
                        className={
                          errors.landOwner ? "jo-registration-input-error" : ""
                        }
                      />
                      {showLandOwnerDropdown &&
                        filteredLandOwners.length > 0 && (
                          <div
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: 0,
                              right: 0,
                              backgroundColor: "white",
                              border: "2px solid #ffc107",
                              borderTop: "none",
                              borderRadius: "0 0 6px 6px",
                              maxHeight: "200px",
                              overflowY: "auto",
                              zIndex: 1000,
                              boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                            }}
                          >
                            {filteredLandOwners.map((owner) => (
                              <div
                                key={owner.id}
                                onClick={() => handleLandOwnerSelect(owner)}
                                style={{
                                  padding: "0.75rem",
                                  cursor: "pointer",
                                  borderBottom: "1px solid #f0f0f0",
                                  transition: "background-color 0.2s",
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
                                      marginLeft: "1rem",
                                      color: "#6c757d",
                                      fontSize: "0.9rem",
                                    }}
                                  >
                                    • {owner.barangay}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                    {selectedLandOwner && (
                      <div
                        style={{
                          marginTop: "1rem",
                          padding: "1rem",
                          backgroundColor: "#d4edda",
                          border: "1px solid #c3e6cb",
                          borderRadius: "6px",
                        }}
                      >
                        <strong style={{ color: "#155724" }}>
                          ✓ Selected Land Owner:
                        </strong>
                        <div style={{ marginTop: "0.5rem", color: "#155724" }}>
                          <div>
                            <strong>Name:</strong> {selectedLandOwner.name}
                          </div>
                          {selectedLandOwner.barangay && (
                            <div>
                              <strong>Barangay:</strong>{" "}
                              {selectedLandOwner.barangay}
                            </div>
                          )}
                          {selectedLandOwner.municipality && (
                            <div>
                              <strong>Municipality:</strong>{" "}
                              {selectedLandOwner.municipality}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Parcel Selection for Tenant/Lessee */}
                {isTenantLesseeCategory(ownershipCategory) &&
                  selectedLandOwner &&
                  ownerParcels.length > 0 && (
                    <div
                      className="parcel-selection-section"
                      style={{
                        marginBottom: "2rem",
                        padding: "1.5rem",
                        backgroundColor: "#e8f5e9",
                        borderRadius: "8px",
                        border: "2px solid #4caf50",
                      }}
                    >
                      <h4 style={{ marginBottom: "1rem", color: "#2c3e50" }}>
                        Select Parcel(s) You Farm
                      </h4>
                      <p
                        style={{
                          fontSize: "0.9rem",
                          color: "#6c757d",
                          marginBottom: "1rem",
                        }}
                      >
                        {selectedLandOwner.name} has {ownerParcels.length}{" "}
                        parcel{ownerParcels.length > 1 ? "s" : ""}. Select which
                        parcel(s) you are farming on:
                      </p>

                      {errors.parcelSelection && (
                        <div
                          style={{
                            padding: "0.75rem",
                            backgroundColor: "#f8d7da",
                            border: "1px solid #f5c6cb",
                            borderRadius: "4px",
                            marginBottom: "1rem",
                            color: "#721c24",
                          }}
                        >
                          {errors.parcelSelection}
                        </div>
                      )}

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "1rem",
                        }}
                      >
                        {ownerParcels.map((parcel: any, index: number) => (
                          <label
                            key={parcel.id}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              padding: "1rem",
                              backgroundColor: selectedParcelIds.has(
                                String(parcel.id),
                              )
                                ? "#c8e6c9"
                                : "white",
                              border: selectedParcelIds.has(String(parcel.id))
                                ? "2px solid #4caf50"
                                : "2px solid #dee2e6",
                              borderRadius: "6px",
                              cursor: "pointer",
                              transition: "all 0.3s",
                            }}
                            onMouseEnter={(e) => {
                              if (!selectedParcelIds.has(String(parcel.id))) {
                                e.currentTarget.style.backgroundColor =
                                  "#f5f5f5";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!selectedParcelIds.has(String(parcel.id))) {
                                e.currentTarget.style.backgroundColor = "white";
                              }
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedParcelIds.has(String(parcel.id))}
                              onChange={() =>
                                handleParcelSelectionToggle(String(parcel.id))
                              }
                              style={{
                                marginRight: "1rem",
                                marginTop: "0.25rem",
                                width: "18px",
                                height: "18px",
                                cursor: "pointer",
                              }}
                            />
                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  fontWeight: "bold",
                                  color: "#2c3e50",
                                  marginBottom: "0.5rem",
                                }}
                              >
                                Parcel #{parcel.parcel_number || index + 1}
                              </div>
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns:
                                    "repeat(auto-fit, minmax(200px, 1fr))",
                                  gap: "0.5rem",
                                  fontSize: "0.9rem",
                                  color: "#495057",
                                }}
                              >
                                <div>
                                  <strong>Location:</strong>{" "}
                                  {parcel.farm_location_barangay || "N/A"}
                                </div>
                                <div>
                                  <strong>Area:</strong>{" "}
                                  {parcel.total_farm_area_ha
                                    ? `${parcel.total_farm_area_ha} hectares`
                                    : "N/A"}
                                </div>
                                <div>
                                  <strong>Ancestral Domain:</strong>{" "}
                                  {parcel.within_ancestral_domain || "N/A"}
                                </div>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>

                      <div
                        style={{
                          marginTop: "1rem",
                          fontSize: "0.9rem",
                          color: "#6c757d",
                          textAlign: "center",
                          padding: "0.75rem",
                          backgroundColor: "#e8f5e9",
                          borderRadius: "6px",
                        }}
                      >
                        ✓ {selectedParcelIds.size} parcel
                        {selectedParcelIds.size !== 1 ? "s" : ""} selected.
                        Click "Next Step" to continue.
                      </div>
                    </div>
                  )}

                {/* Farmland Parcels - Show only for Registered Owner */}
                {ownershipCategory === "registeredOwner" && (
                  <>
                    {/* Existing Parcel Dropdown Section */}
                    <div className="jo-registration-section-card">
                      {/* Selected owner confirmation */}
                      {useExistingParcel && selectedExistingParcel && (
                        <div
                          style={{
                            padding: "1rem",
                            backgroundColor: "#d4edda",
                            border: "1px solid #c3e6cb",
                            borderRadius: "8px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontWeight: "bold",
                                color: "#155724",
                                marginBottom: "0.25rem",
                              }}
                            >
                              ✓ Selected:{" "}
                              {selectedExistingParcel.current_holder}
                            </div>
                            <div
                              style={{ fontSize: "0.85rem", color: "#155724" }}
                            >
                              📍 {selectedExistingParcel.parcel_number} •{" "}
                              {selectedExistingParcel.farm_location_barangay} •{" "}
                              {selectedExistingParcel.total_farm_area_ha} ha
                            </div>
                          </div>
                          <button
                            onClick={clearExistingParcelSelection}
                            style={{
                              padding: "0.5rem 1rem",
                              backgroundColor: "#dc3545",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontSize: "0.85rem",
                              flexShrink: 0,
                            }}
                          >
                            Clear
                          </button>
                        </div>
                      )}

                      {useExistingParcel && (
                        <div
                          style={{
                            marginTop: "0.75rem",
                            padding: "0.75rem 1rem",
                            backgroundColor: "#fff3cd",
                            borderRadius: "6px",
                            border: "1px solid #ffc107",
                            fontSize: "0.9rem",
                            color: "#856404",
                          }}
                        >
                          ⚠️ <strong>Ownership Transfer</strong> — You are
                          registering as the new owner of this parcel.
                        </div>
                      )}
                    </div>

                    {(formData.farmlandParcels as any[]).map((p, idx) => (
                      <div key={idx} className="jo-registration-parcel-card">
                        <div className="jo-registration-parcel-card-header">
                          <div className="jo-registration-parcel-no">
                            {p.existingParcelNumber
                              ? `📍 ${p.existingParcelNumber} (Existing Parcel)`
                              : `Farm Parcel No. ${p.parcelNo || idx + 1}`}
                          </div>
                          <div className="jo-registration-parcel-card-actions">
                            {(formData.farmlandParcels as any[]).length > 1 && (
                              <button
                                className="jo-registration-btn-small"
                                onClick={() => removeParcel(idx)}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="jo-registration-form-row">
                          <div className="jo-registration-form-group">
                            <label>Farm Location (Barangay)</label>
                            <select
                              value={p.farmLocationBarangay || ""}
                              onChange={(e) =>
                                handleParcelChange(
                                  idx,
                                  "farmLocationBarangay",
                                  e.target.value,
                                )
                              }
                              className={
                                errors.farmland
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
                              <option value="Nanding Lopez">
                                Nanding Lopez
                              </option>
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
                            {errors.farmland && (
                              <div className="jo-registration-error">
                                {errors.farmland}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="jo-registration-form-row">
                          <div className="jo-registration-form-group">
                            <label>Total Farm Area (in hectares)</label>
                            <input
                              type="number"
                              value={p.totalFarmAreaHa || ""}
                              onChange={(e) =>
                                handleParcelChange(
                                  idx,
                                  "totalFarmAreaHa",
                                  e.target.value,
                                )
                              }
                              className={
                                errors.farmland
                                  ? "jo-registration-input-error"
                                  : ""
                              }
                            />
                            {errors.farmland && (
                              <div className="jo-registration-error">
                                {errors.farmland}
                              </div>
                            )}
                          </div>
                          <div className="jo-registration-form-group">
                            <label>Within Ancestral Domain</label>
                            <select
                              value={p.withinAncestralDomain || ""}
                              onChange={(e) =>
                                handleParcelChange(
                                  idx,
                                  "withinAncestralDomain",
                                  e.target.value,
                                )
                              }
                            >
                              <option value="">Select</option>
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                          </div>
                        </div>

                        <div className="jo-registration-form-row">
                          <div className="jo-registration-form-group">
                            <label>Agrarian Reform Beneficiary</label>
                            <select
                              value={p.agrarianReformBeneficiary || ""}
                              onChange={(e) =>
                                handleParcelChange(
                                  idx,
                                  "agrarianReformBeneficiary",
                                  e.target.value,
                                )
                              }
                            >
                              <option value="">Select</option>
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="jo-registration-parcel-actions-bar">
                      <button
                        className="jo-registration-btn-submit"
                        onClick={addParcel}
                      >
                        + Add Another Parcel
                      </button>
                    </div>
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
                  applySelectedParcels();
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
