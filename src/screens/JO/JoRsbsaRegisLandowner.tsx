import React, { useState } from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getLandOwners, createRsbsaSubmission } from "../../api";
import BirthDatePicker from "../../components/common/BirthDatePicker";
import { getAuditLogger } from "../../components/Audit/auditLogger";
import "../../assets/css/jo css/JoRsbsaRegistrationStyle.css";
import JOSidebar from "../../components/layout/JOSidebar";
import { getCurrentUserForAudit } from "../../components/Audit/getCurrentUserForAudit";

interface Parcel {
  parcelNo: string;
  farmLocationBarangay: string;
  farmLocationMunicipality: string;
  totalFarmAreaHa: string;
  withinAncestralDomain: string;
  isCultivating?: boolean | null;
  cultivatingStatus?: "yes" | "no" | "no-other" | "";
  ownershipDocumentNo: string;
  agrarianReformBeneficiary: string;
  ownershipTypeRegisteredOwner: boolean;
  ownershipTypeTenant: boolean;
  ownershipTypeLessee: boolean;
  ownershipTypeOthers: boolean;
  tenantLandOwnerName: string;
  lesseeLandOwnerName: string;
  ownershipOthersSpecify: string;
  existingParcelId?: number;
  existingParcelNumber?: string;
}

interface FormData {
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
  mainLivelihood: string;
  isActivelyFarming: boolean;
  farmingActivity: string;
  otherCrops: string;
  livestock: string;
  poultry: string;
  farmlandParcels: Parcel[];
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

interface LandOwner {
  id: number;
  name: string;
  barangay?: string;
  municipality?: string;
}

const toTitleCase = (text: string): string => {
  if (!text) return "";
  const lowercase = ["de", "del", "dela", "ng", "sa", "and", "or", "the"];
  const uppercase = ["ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];
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
      if (!word) return word;
      const ext = extensions[word.replace(/\./g, "")];
      if (ext) return ext;
      if (uppercase.includes(word)) return word.toUpperCase();
      if (word.includes("-")) {
        return word
          .split("-")
          .map((part) => {
            if (!part) return part;
            if (lowercase.includes(part) && index !== 0) return part;
            return part.charAt(0).toUpperCase() + part.slice(1);
          })
          .join("-");
      }
      if (lowercase.includes(word) && index !== 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ")
    .trim();
};

const JoRsbsaRegisLandowner: React.FC = () => {
  const navigate = useNavigate();

  const [_activeTab] = useState("overview");
  const [landowners, setLandowners] = useState<LandOwner[]>([]);
  const [draftId, _setDraftId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);

  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: "success" | "error" | "warning";
  }>({ show: false, message: "", type: "success" });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showToast = (
    message: string,
    type: "success" | "error" | "warning" = "success",
  ) => {
    setToast({ show: true, message, type });
    setTimeout(
      () => {
        setToast((prev) => ({ ...prev, show: false }));
      },
      type === "success" ? 4000 : 5000,
    );
  };

  useEffect(() => {
    const fetchLandowners = async () => {
      try {
        const response = await getLandOwners();
        if (response.error) throw new Error("Failed to fetch landowners");
        setLandowners(response.data || []);
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
    mainLivelihood: "landowner",
    isActivelyFarming: false,
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
        isCultivating: false,
        cultivatingStatus: "",
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

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleTextInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleTextInputBlur = (field: keyof FormData) => {
    const value = formData[field];
    if (typeof value === "string" && value.trim()) {
      const formatted = toTitleCase(value);
      setFormData((prev) => ({ ...prev, [field]: formatted }));
    }
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleParcelChange = (idx: number, field: keyof Parcel, value: any) => {
    setFormData((prev) => {
      const parcels = [...prev.farmlandParcels];
      parcels[idx] = { ...parcels[idx], [field]: value };
      return { ...prev, farmlandParcels: parcels };
    });
    setErrors((prev) => ({ ...prev, farmland: "" }));
  };

  const toggleBool = (field: keyof FormData) => {
    setFormData((prev) => ({ ...prev, [field]: !prev[field] }));
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
        isCultivating: false,
        cultivatingStatus: "",
        ownershipTypeRegisteredOwner: true,
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

  const handlePrevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const isStepActive = (step: number) => currentStep === step;
  const isStepCompleted = (step: number) => currentStep > step;

  const handleSubmitForm = () => {
    const newErrors: Record<string, string> = {};

    if (currentStep === 1) {
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
      setErrors({});
      setCurrentStep(2);
      return;
    }

    // STEP 2 — Land Parcel (was step 3)
    if (currentStep === 2) {
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
          "Set 'Are you farming this parcel?' for each listed parcel.";
      }

      setErrors(newErrors);
      if (Object.keys(newErrors).length > 0) return;
      setErrors({});
      setCurrentStep(3);
      return;
    }

    // STEP 3 — Farm Information (was step 2)
    if (currentStep === 3) {
      setErrors({});
      setCurrentStep(4);
      return;
    }

    // Step 4 — final submit
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
        isActivelyFarming: formData.isActivelyFarming,
        dateOfBirth: formData.dateOfBirth
          ? new Date(formData.dateOfBirth)
          : null,
        farmlandParcels: formData.farmlandParcels.map((parcel) => ({
          ...parcel,
          totalFarmAreaHa: parcel.totalFarmAreaHa
            ? parseFloat(parcel.totalFarmAreaHa)
            : 0,
          withinAncestralDomain: parcel.withinAncestralDomain === "Yes",
          agrarianReformBeneficiary: parcel.agrarianReformBeneficiary === "Yes",
          isCultivating: parcel.isCultivating ?? false,
          existingParcelId: parcel.existingParcelId || null,
          existingParcelNumber: parcel.existingParcelNumber || null,
          ownershipType: {
            registeredOwner: true,
            tenant: false,
            lessee: false,
          },
        })),
      };

      const response = await createRsbsaSubmission({
        draftId,
        data: transformedData,
      });
      if (response.error) throw new Error(response.error || `HTTP error`);
      const result = response.data;
      return result;
    } catch (error) {
      let message = "Unknown error";
      if (error instanceof Error) message = error.message;
      else if (typeof error === "string") message = error;
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
        isCultivating: parcel.isCultivating ?? false,
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
        try {
          const user = await getCurrentUserForAudit();
          const farmerName =
            `${formData.surname}, ${formData.firstName} ${formData.middleName || ""}`.trim();
          const farmDetails = buildFarmerAuditFarmDetails();
          const auditLogger = getAuditLogger();
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
        shouldUnlockSubmit = false;
        setTimeout(() => {
          navigate("/jo-rsbsapage");
        }, 1500);
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      showToast("Error submitting form. Please try again.", "error");
    } finally {
      if (shouldUnlockSubmit) setIsSubmitting(false);
    }
  };

  return (
    <div className="jo-registration-page-container">
      <div className="jo-registration-page">
        <JOSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

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
            {/* Step indicators */}
            <div className="jo-registration-form-steps">
              <div
                className={`jo-registration-step ${isStepActive(1) ? "jo-registration-active" : ""} ${isStepCompleted(1) ? "jo-registration-completed" : ""}`}
              >
                <span className="jo-registration-dot">
                  {isStepCompleted(1) ? "✓" : "1"}
                </span>
                <span className="jo-registration-label">Basic Details</span>
              </div>
              {/* SWAPPED: Step 2 is now Land Parcel */}
              <div
                className={`jo-registration-step ${isStepActive(2) ? "jo-registration-active" : ""} ${isStepCompleted(2) ? "jo-registration-completed" : ""}`}
              >
                <span className="jo-registration-dot">
                  {isStepCompleted(2) ? "✓" : "2"}
                </span>
                <span className="jo-registration-label">Land Parcel</span>
              </div>
              {/* SWAPPED: Step 3 is now Farm Information */}
              <div
                className={`jo-registration-step ${isStepActive(3) ? "jo-registration-active" : ""} ${isStepCompleted(3) ? "jo-registration-completed" : ""}`}
              >
                <span className="jo-registration-dot">
                  {isStepCompleted(3) ? "✓" : "3"}
                </span>
                <span className="jo-registration-label">Farm Information</span>
              </div>
              <div
                className={`jo-registration-step ${isStepActive(4) ? "jo-registration-active" : ""}${isStepCompleted(4) ? "jo-registration-completed" : ""}`}
              >
                <span className="jo-registration-dot">4</span>
                <span className="jo-registration-label">Verification</span>
              </div>
            </div>

            {/* STEP 1 — Basic Details (unchanged) */}
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
                              )
                                age--;
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

            {/* STEP 2 — Land Parcel (was step 3) */}
            {currentStep === 2 && (
              <div className="jo-registration-form-section">
                <h3>PART II: Land Parcel</h3>

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

            {/* STEP 3 — Farm Information (was step 2) */}
            {currentStep === 3 && (
              <div className="jo-registration-form-section">
                <h3>PART III: Farm Information</h3>
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

            {/* STEP 4 — Verification */}
            {currentStep === 4 && (
              <div className="jo-registration-form-section">
                <h3>PART IV: VERIFICATION</h3>
                <div className="jo-registration-compilation">
                  <h4>FORM SUMMARY - PLEASE REVIEW ALL INFORMATION</h4>

                  {/* Personal Information */}
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

                  {/* SWAPPED: Land Parcel now comes before Farm Information in the summary */}
                  <div className="jo-registration-summary-section">
                    <h3>PART II: Land Parcel</h3>
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
                              Are you farming this parcel?
                            </span>
                            <span className="jo-registration-summary-value">
                              {parcel.cultivatingStatus === "yes"
                                ? "Yes — Actively farming"
                                : parcel.cultivatingStatus === "no"
                                  ? "No"
                                  : parcel.cultivatingStatus === "no-other"
                                    ? `No — Someone else is farming it${parcel.tenantLandOwnerName ? ` (${parcel.tenantLandOwnerName})` : " (no tenant selected)"}`
                                    : "Not specified"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* SWAPPED: Farm Information now comes after Land Parcel in the summary */}
                  <div className="jo-registration-summary-section">
                    <h3>PART III: Farm Information</h3>
                    <div className="jo-registration-summary-grid">
                      <div className="jo-registration-summary-item">
                        <span className="jo-registration-summary-label">
                          Main Livelihood:
                        </span>
                        <span className="jo-registration-summary-value">
                          {formData.mainLivelihood || "Not selected"}
                        </span>
                      </div>
                      {formData.mainLivelihood === "landowner" && (
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
                    </div>
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
