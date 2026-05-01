import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getLandOwners, createRsbsaSubmission } from "../../api";
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
  isCultivating?: boolean | null;
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

const JoRsbsaRegisLandowner: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [_activeTab] = useState("overview");
  const isActive = (path: string) => location.pathname === path;
  const [draftId, _setDraftId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [landowners, setLandowners] = useState<LandOwner[]>([]);

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

  // Clear existing parcel selection

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
        isCultivating: null,
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
        isCultivating: null, // Land owner decides later
        ownershipTypeRegisteredOwner: true, // Always true
        ownershipTypeTenant: false,
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
      // KEEP only this block, DELETE the isTenantLesseeCategory block:
      const hasValidFarmland = formData.farmlandParcels.some(
        (parcel) =>
          parcel.farmLocationBarangay?.toString().trim() &&
          parcel.totalFarmAreaHa?.toString().trim(),
      );
      if (!hasValidFarmland)
        newErrors.farmland = "Please fill in farm location and area";

      const hasUndesignatedCultivation = formData.farmlandParcels.some(
        (parcel) => {
          const hasCoreParcelData =
            !!parcel.farmLocationBarangay?.toString().trim() &&
            !!parcel.totalFarmAreaHa?.toString().trim();
          return (
            hasCoreParcelData &&
            (parcel.isCultivating === null ||
              parcel.isCultivating === undefined)
          );
        },
      );
      if (hasUndesignatedCultivation) {
        newErrors.farmland =
          "Set 'Are you currently farming this parcel?' for each listed parcel.";
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
      } else if (ageValue <= 18) {
        newErrors.age = "Age must be above 18";
      }
    }
    if (!formData.barangay?.trim()) newErrors.barangay = "Barangay is required";

    // Validate based on ownership category
    const hasValidFarmlandFinal = formData.farmlandParcels.some(
      (parcel) =>
        parcel.farmLocationBarangay?.toString().trim() &&
        parcel.totalFarmAreaHa?.toString().trim(),
    );
    if (!hasValidFarmlandFinal)
      newErrors.farmland = "At least one parcel must include barangay and area";

    const hasUndesignatedCultivationFinal = formData.farmlandParcels.some(
      (parcel) => {
        const hasCoreParcelData =
          !!parcel.farmLocationBarangay?.toString().trim() &&
          !!parcel.totalFarmAreaHa?.toString().trim();
        return (
          hasCoreParcelData &&
          (parcel.isCultivating === null || parcel.isCultivating === undefined)
        );
      },
    );

    if (hasUndesignatedCultivationFinal) {
      newErrors.farmland =
        "Each listed parcel must have a cultivation status (Yes or No).";
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
        // DELETE these three lines:
        // ownershipCategory: ownershipCategory,
        // selectedLandOwner: selectedLandOwner ? { ... } : null,
        // selectedParcelIds: Array.from(selectedParcelIds),
        farmlandParcels: formData.farmlandParcels.map((parcel) => ({
          ...parcel,
          totalFarmAreaHa: parcel.totalFarmAreaHa
            ? parseFloat(parcel.totalFarmAreaHa)
            : 0,
          withinAncestralDomain: parcel.withinAncestralDomain === "Yes",
          agrarianReformBeneficiary: parcel.agrarianReformBeneficiary === "Yes",
          isCultivating: parcel.isCultivating ?? true,
          existingParcelId: parcel.existingParcelId || null,
          existingParcelNumber: parcel.existingParcelNumber || null,
          ownershipType: {
            registeredOwner: true, // Always true for this page
            tenant: false,
            lessee: false,
          },
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
      ownershipCategory: "registeredOwner",
      totalParcels: farmlandParcels.length,
      totalFarmAreaHa: Number(totalFarmAreaHa.toFixed(4)),
      farmLocation: {
        barangay: formData.barangay || null,
        municipality: formData.municipality || null,
        province: formData.province || null,
      },
      selectedLandOwner: null,
      selectedParcelIds: [],
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
              Land Owner Registration
            </div>
          </div>
          <h2>RSBSA Enrollment Form - Land Owner</h2>

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

                {/* Land Owner Search for Tenant/Lessee */}

                {/* Parcel Selection for Tenant/Lessee */}

                {/* Farmland Parcels - Show only for Registered Owner */}

                {/* Existing Parcel Dropdown Section */}

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
                            errors.farmland ? "jo-registration-input-error" : ""
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
                          <option value="Bantud Fabrica">Bantud Fabrica</option>
                          <option value="Baras">Baras</option>
                          <option value="Barasan">Barasan</option>
                          <option value="Basa-Mabini Bonifacio">
                            Basa-Mabini Bonifacio
                          </option>
                          <option value="Bolilao">Bolilao</option>
                          <option value="Buenaflor Embarkadero">
                            Buenaflor Embarkadero
                          </option>
                          <option value="Burgos-Regidor">Burgos-Regidor</option>
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
                            errors.farmland ? "jo-registration-input-error" : ""
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
                    <div className="jo-registration-form-group">
                      <label>Are you currently farming this parcel?</label>
                      <select
                        value={
                          p.isCultivating === true
                            ? "Yes"
                            : p.isCultivating === false
                              ? "No"
                              : ""
                        }
                        onChange={(e) =>
                          handleParcelChange(
                            idx,
                            "isCultivating",
                            e.target.value === ""
                              ? null
                              : e.target.value === "Yes",
                          )
                        }
                      >
                        <option value="">Select</option>
                        <option value="Yes">
                          Yes — I am actively farming this
                        </option>
                        <option value="No">
                          No — someone else is farming this (tenant/lessee)
                        </option>
                      </select>
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

export default JoRsbsaRegisLandowner;
