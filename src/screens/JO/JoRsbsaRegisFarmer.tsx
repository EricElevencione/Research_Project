import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createRsbsaSubmission } from "../../api";
import { getAuditLogger } from "../../components/Audit/auditLogger";
import "../../assets/css/jo css/JoRsbsaRegistrationStyle.css";
import "../../components/layout/sidebarStyle.css";
import LogoImage from "../../assets/images/Logo.png";
import HomeIcon from "../../assets/images/home.png";
import RSBSAIcon from "../../assets/images/rsbsa.png";
import MasterlistIcon from "../../assets/images/approve.png";
import LogoutIcon from "../../assets/images/logout.png";
import IncentivesIcon from "../../assets/images/incentives.png";

// ─────────────────────────────────────────────
// KEY DISTINCTION FROM LAND OWNER FORM:
//   • Farmer = owns the land AND actively cultivates it
//   • isCultivating is ALWAYS true — we never ask this question
//   • ownershipType is ALWAYS Registered Owner — no tenant/lessee fields
//   • Farming activity section is REQUIRED (it defines who a farmer is)
// ─────────────────────────────────────────────

interface Parcel {
  parcelNo: string;
  farmLocationBarangay: string;
  farmLocationMunicipality: string;
  totalFarmAreaHa: string;
  withinAncestralDomain: string;
  ownershipDocumentNo: string;
  agrarianReformBeneficiary: string;
  // isCultivating is omitted — always true for farmer registration
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
  farmlandParcels: Parcel[];
  // Farming activities — REQUIRED for farmer
  farmerRice?: boolean;
  farmerCorn?: boolean;
  farmerOtherCrops?: boolean;
  farmerOtherCropsText?: string;
  farmerLivestock?: boolean;
  farmerLivestockText?: string;
  farmerPoultry?: boolean;
  farmerPoultryText?: string;
}

import { useEffect } from "react";

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

const JoRsbsaRegisFarmer: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;
  const [draftId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: "success" | "error" | "warning";
  }>({ show: false, message: "", type: "success" });

  const showToast = (
    message: string,
    type: "success" | "error" | "warning" = "success",
  ) => {
    setToast({ show: true, message, type });
    setTimeout(
      () => setToast((prev) => ({ ...prev, show: false })),
      type === "success" ? 4000 : 5000,
    );
  };

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
    // Hardcoded as farmer — this is the identity of this registration type
    mainLivelihood: "farmer",
    farmlandParcels: [
      {
        parcelNo: "1",
        farmLocationBarangay: "",
        farmLocationMunicipality: "",
        totalFarmAreaHa: "",
        withinAncestralDomain: "",
        ownershipDocumentNo: "",
        agrarianReformBeneficiary: "",
        // NOTE: No isCultivating field here — always true for farmers
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
  });

  const handleTextInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleTextInputBlur = (field: keyof FormData) => {
    const value = formData[field];
    if (typeof value === "string" && value.trim()) {
      setFormData((prev) => ({ ...prev, [field]: toTitleCase(value) }));
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
      return {
        ...prev,
        farmlandParcels: [
          ...prev.farmlandParcels,
          {
            parcelNo: nextNo,
            farmLocationBarangay: "",
            farmLocationMunicipality: "",
            totalFarmAreaHa: "",
            withinAncestralDomain: "",
            ownershipDocumentNo: "",
            agrarianReformBeneficiary: "",
          },
        ],
      };
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
        if (Number.isNaN(ageValue))
          newErrors.age = "Age must be a valid number";
        else if (ageValue < 18) newErrors.age = "Age must be at least 18";
      }
      if (!formData.barangay?.trim())
        newErrors.barangay = "Barangay is required";

      setErrors(newErrors);
      if (Object.keys(newErrors).length > 0) return;
      setErrors({});
      setCurrentStep(2);
      return;
    }

    if (currentStep === 2) {
      // Farming activity is REQUIRED for farmer — this is the core of their identity
      const hasFarmingActivity =
        formData.farmerRice ||
        formData.farmerCorn ||
        formData.farmerOtherCrops ||
        formData.farmerLivestock ||
        formData.farmerPoultry;

      if (!hasFarmingActivity) {
        newErrors.farmingActivity =
          "Please select at least one farming activity — this is required for farmer registration";
      }

      setErrors(newErrors);
      if (Object.keys(newErrors).length > 0) return;
      setErrors({});
      setCurrentStep(3);
      return;
    }

    if (currentStep === 3) {
      const hasValidFarmland = formData.farmlandParcels.some(
        (p) => p.farmLocationBarangay?.trim() && p.totalFarmAreaHa?.trim(),
      );
      if (!hasValidFarmland) {
        newErrors.farmland =
          "Please fill in farm location and area for at least one parcel";
      }

      setErrors(newErrors);
      if (Object.keys(newErrors).length > 0) return;
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
    if (!formData.barangay?.trim()) newErrors.barangay = "Barangay is required";

    const hasValidFarmlandFinal = formData.farmlandParcels.some(
      (p) => p.farmLocationBarangay?.trim() && p.totalFarmAreaHa?.trim(),
    );
    if (!hasValidFarmlandFinal) {
      newErrors.farmland = "At least one parcel must include barangay and area";
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
        farmlandParcels: formData.farmlandParcels.map((parcel) => ({
          ...parcel,
          totalFarmAreaHa: parcel.totalFarmAreaHa
            ? parseFloat(parcel.totalFarmAreaHa)
            : 0,
          withinAncestralDomain: parcel.withinAncestralDomain === "Yes",
          agrarianReformBeneficiary: parcel.agrarianReformBeneficiary === "Yes",
          // KEY: isCultivating is ALWAYS true for farmer registration
          isCultivating: true,
          ownershipType: {
            // KEY: Always registered owner — farmers own their land
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
      if (response.error) throw new Error(response.error || "HTTP error");
      return response.data;
    } catch (error) {
      let message = "Unknown error";
      if (error instanceof Error) message = error.message;
      else if (typeof error === "string") message = error;
      showToast(
        "Error submitting form: " + message + ". Please try again.",
        "error",
      );
      return null;
    }
  };

  const handleFinalSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    let shouldUnlock = true;

    try {
      const submitted = await submitFinalToServer();
      if (submitted && submitted.submissionId) {
        try {
          const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
          const farmerName =
            `${formData.surname}, ${formData.firstName} ${formData.middleName || ""}`.trim();
          const auditLogger = getAuditLogger();
          await auditLogger.logFarmerRegistration(
            {
              id: currentUser.id,
              name: currentUser.name || currentUser.username || "Unknown",
              role: currentUser.role || "JO",
            },
            submitted.submissionId,
            farmerName,
            {
              ownershipCategory: "registeredOwner",
              totalParcels: formData.farmlandParcels.length,
              totalFarmAreaHa: formData.farmlandParcels.reduce(
                (sum, p) => sum + (parseFloat(p.totalFarmAreaHa) || 0),
                0,
              ),
              farmActivities: {
                mainLivelihood: "farmer",
                farmerRice: !!formData.farmerRice,
                farmerCorn: !!formData.farmerCorn,
                farmerOtherCrops: !!formData.farmerOtherCrops,
                farmerOtherCropsText: formData.farmerOtherCropsText || null,
                farmerLivestock: !!formData.farmerLivestock,
                farmerLivestockText: formData.farmerLivestockText || null,
                farmerPoultry: !!formData.farmerPoultry,
                farmerPoultryText: formData.farmerPoultryText || null,
              },
            },
          );
        } catch (auditErr) {
          console.error("Audit log failed (non-blocking):", auditErr);
        }

        showToast("RSBSA Farmer form submitted successfully!", "success");
        shouldUnlock = false;
        setTimeout(() => navigate("/jo-rsbsapage"), 1500);
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      showToast("Error submitting form. Please try again.", "error");
    } finally {
      if (shouldUnlock) setIsSubmitting(false);
    }
  };

  return (
    <div className="jo-registration-page-container">
      <div className="jo-registration-page">
        {/* Sidebar */}
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

        <div
          className={`tech-incent-sidebar-overlay ${sidebarOpen ? "active" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Main Content */}
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
            <div className="tech-incent-mobile-title">Farmer Registration</div>
          </div>

          <h2>RSBSA Enrollment Form - Farmer</h2>
          {/* Small clarification badge so JO knows who this form is for */}
          <p
            style={{ color: "#6b7280", fontSize: "14px", marginBottom: "8px" }}
          >
            For farmers who <strong>own their land</strong> and{" "}
            <strong>actively cultivate it themselves</strong>.
          </p>

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
            {/* Step Indicators */}
            <div className="jo-registration-form-steps">
              {[
                { num: 1, label: "Basic Details" },
                { num: 2, label: "Farm Information" },
                { num: 3, label: "Land Parcel" },
                { num: 4, label: "Verification" },
              ].map(({ num, label }) => (
                <div
                  key={num}
                  className={`jo-registration-step ${isStepActive(num) ? "jo-registration-active" : ""} ${isStepCompleted(num) ? "jo-registration-completed" : ""}`}
                >
                  <span className="jo-registration-dot">
                    {isStepCompleted(num) ? "✓" : num}
                  </span>
                  <span className="jo-registration-label">{label}</span>
                </div>
              ))}
            </div>

            {/* ── STEP 1: Personal Information ── */}
            {currentStep === 1 && (
              <div className="jo-registration-form-section">
                <h3>PART I: PERSONAL INFORMATION</h3>
                <div className="jo-registration-form-grid">
                  <div className="jo-registration-form-row">
                    <div className="jo-registration-form-group">
                      <label>FIRST NAME *</label>
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) =>
                          handleTextInputChange("firstName", e.target.value)
                        }
                        onBlur={() => handleTextInputBlur("firstName")}
                        className={
                          errors.firstName ? "jo-registration-input-error" : ""
                        }
                      />
                      {errors.firstName && (
                        <div className="jo-registration-error">
                          {errors.firstName}
                        </div>
                      )}
                    </div>
                    <div className="jo-registration-form-group">
                      <label>SURNAME *</label>
                      <input
                        type="text"
                        value={formData.surname}
                        onChange={(e) =>
                          handleTextInputChange("surname", e.target.value)
                        }
                        onBlur={() => handleTextInputBlur("surname")}
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
                      <label>MIDDLE NAME *</label>
                      <input
                        type="text"
                        value={formData.middleName}
                        onChange={(e) =>
                          handleTextInputChange("middleName", e.target.value)
                        }
                        onBlur={() => handleTextInputBlur("middleName")}
                        className={
                          errors.middleName ? "jo-registration-input-error" : ""
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
                          handleTextInputChange("extensionName", e.target.value)
                        }
                        onBlur={() => handleTextInputBlur("extensionName")}
                      />
                    </div>
                    <div className="jo-registration-form-group">
                      <label>GENDER *</label>
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
                      <label>DATE OF BIRTH *</label>
                      <input
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={(e) => {
                          handleInputChange("dateOfBirth", e.target.value);
                          if (e.target.value) {
                            const birthDate = new Date(e.target.value);
                            const today = new Date();
                            let age =
                              today.getFullYear() - birthDate.getFullYear();
                            const monthDiff =
                              today.getMonth() - birthDate.getMonth();
                            if (
                              monthDiff < 0 ||
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
                          className={
                            errors.barangay ? "jo-registration-input-error" : ""
                          }
                        >
                          <option value="">Select Barangay</option>
                          {BARANGAY_OPTIONS.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
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
            )}

            {/* ── STEP 2: Farm Information ── */}
            {currentStep === 2 && (
              <div className="jo-registration-form-section">
                <h3>PART II: FARM INFORMATION</h3>
                <p
                  style={{
                    color: "#6b7280",
                    fontSize: "13px",
                    marginBottom: "16px",
                  }}
                >
                  As a registered farmer, your farming activity is your primary
                  identity in this system. Please select all that apply.
                </p>
                <div className="jo-registration-form-grid">
                  <div className="jo-registration-livelihood-details">
                    <h4>Type of Farming Activity *</h4>

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
                            checked={!!formData.farmerRice}
                            onChange={() => toggleBool("farmerRice")}
                          />{" "}
                          Rice
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={!!formData.farmerCorn}
                            onChange={() => toggleBool("farmerCorn")}
                          />{" "}
                          Corn
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={!!formData.farmerOtherCrops}
                            onChange={() => toggleBool("farmerOtherCrops")}
                          />{" "}
                          Other crops, please specify
                        </label>
                      </div>
                      {formData.farmerOtherCrops && (
                        <input
                          type="text"
                          placeholder="Specify other crops"
                          value={formData.farmerOtherCropsText}
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
                            checked={!!formData.farmerLivestock}
                            onChange={() => toggleBool("farmerLivestock")}
                          />{" "}
                          Livestock, please specify
                        </label>
                      </div>
                      {formData.farmerLivestock && (
                        <input
                          type="text"
                          placeholder="Specify livestock"
                          value={formData.farmerLivestockText}
                          onChange={(e) =>
                            handleInputChange(
                              "farmerLivestockText",
                              e.target.value,
                            )
                          }
                          style={{ marginBottom: "15px" }}
                        />
                      )}

                      <div className="jo-registration-checkbox-group">
                        <label>
                          <input
                            type="checkbox"
                            checked={!!formData.farmerPoultry}
                            onChange={() => toggleBool("farmerPoultry")}
                          />{" "}
                          Poultry, please specify
                        </label>
                      </div>
                      {formData.farmerPoultry && (
                        <input
                          type="text"
                          placeholder="Specify poultry"
                          value={formData.farmerPoultryText}
                          onChange={(e) =>
                            handleInputChange(
                              "farmerPoultryText",
                              e.target.value,
                            )
                          }
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

            {/* ── STEP 3: Land Parcel ── */}
            {currentStep === 3 && (
              <div className="jo-registration-form-section">
                <h3>PART III: LAND PARCEL</h3>
                <p
                  style={{
                    color: "#6b7280",
                    fontSize: "13px",
                    marginBottom: "16px",
                  }}
                >
                  List all parcels you own and actively farm. Ownership is
                  assumed as Registered Owner.
                  {/* KEY NOTE: We do not ask "Are you currently farming this parcel?" 
                      because by definition a farmer IS actively farming their land. */}
                </p>

                {errors.farmland && (
                  <div className="jo-registration-form-errors">
                    <div className="jo-registration-error">
                      {errors.farmland}
                    </div>
                  </div>
                )}

                {formData.farmlandParcels.map((p, idx) => (
                  <div key={idx} className="jo-registration-parcel-card">
                    <div className="jo-registration-parcel-card-header">
                      <div className="jo-registration-parcel-no">
                        Farm Parcel No. {p.parcelNo || idx + 1}
                        {/* Badge showing cultivation is assumed */}
                        <span
                          style={{
                            marginLeft: "10px",
                            fontSize: "11px",
                            backgroundColor: "#d1fae5",
                            color: "#065f46",
                            padding: "2px 8px",
                            borderRadius: "12px",
                            fontWeight: 600,
                          }}
                        >
                          ✓ Actively Farmed
                        </span>
                      </div>
                      <div className="jo-registration-parcel-card-actions">
                        {formData.farmlandParcels.length > 1 && (
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
                        <label>Farm Location (Barangay) *</label>
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
                          {BARANGAY_OPTIONS.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="jo-registration-form-row">
                      <div className="jo-registration-form-group">
                        <label>Total Farm Area (in hectares) *</label>
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
                      <div className="jo-registration-form-group">
                        <label>Ownership Document No.</label>
                        <input
                          type="text"
                          value={p.ownershipDocumentNo || ""}
                          onChange={(e) =>
                            handleParcelChange(
                              idx,
                              "ownershipDocumentNo",
                              e.target.value,
                            )
                          }
                          placeholder="Optional"
                        />
                      </div>
                    </div>

                    {/* NOTE: No "Are you currently farming this parcel?" dropdown here.
                        For farmer registration, this is always YES by definition.
                        Compare to land owner form where this was asked explicitly. */}
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

            {/* ── STEP 4: Verification ── */}
            {currentStep === 4 && (
              <div className="jo-registration-form-section">
                <h3>PART IV: VERIFICATION</h3>
                <div className="jo-registration-compilation">
                  <h4>FORM SUMMARY - PLEASE REVIEW ALL INFORMATION</h4>

                  {/* Registration type badge */}
                  <div
                    style={{
                      display: "inline-block",
                      backgroundColor: "#d1fae5",
                      color: "#065f46",
                      padding: "4px 12px",
                      borderRadius: "12px",
                      fontSize: "13px",
                      fontWeight: 600,
                      marginBottom: "16px",
                    }}
                  >
                    Registration Type: Farmer (Land Owner + Active Cultivator)
                  </div>

                  <div className="jo-registration-summary-section">
                    <h3>PART I: PERSONAL INFORMATION</h3>
                    <div className="jo-registration-summary-grid">
                      <div className="jo-registration-summary-item">
                        <span className="jo-registration-summary-label">
                          Name:
                        </span>
                        <span className="jo-registration-summary-value">
                          {formData.firstName} {formData.middleName}{" "}
                          {formData.surname} {formData.extensionName}
                        </span>
                      </div>
                      <div className="jo-registration-summary-item">
                        <span className="jo-registration-summary-label">
                          Gender:
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

                  <div className="jo-registration-summary-section">
                    <h3>PART II: FARM INFORMATION</h3>
                    <div className="jo-registration-summary-grid">
                      <div className="jo-registration-summary-item">
                        <span className="jo-registration-summary-label">
                          Farming Activities:
                        </span>
                        <span className="jo-registration-summary-value">
                          {[
                            formData.farmerRice && "Rice",
                            formData.farmerCorn && "Corn",
                            formData.farmerOtherCrops &&
                              `Other crops: ${formData.farmerOtherCropsText}`,
                            formData.farmerLivestock &&
                              `Livestock: ${formData.farmerLivestockText}`,
                            formData.farmerPoultry &&
                              `Poultry: ${formData.farmerPoultryText}`,
                          ]
                            .filter(Boolean)
                            .join(", ") || "None selected"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="jo-registration-summary-section">
                    <h3>PART III: LAND PARCELS</h3>
                    {formData.farmlandParcels.map((parcel, idx) => (
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
                              Registered Owner
                            </span>
                          </div>
                          {/* KEY DIFFERENCE from land owner form:
                              We display "Yes" always instead of showing whatever the user picked,
                              because farmer = always cultivating */}
                          <div className="jo-registration-summary-item">
                            <span className="jo-registration-summary-label">
                              Currently Cultivating:
                            </span>
                            <span
                              className="jo-registration-summary-value"
                              style={{ color: "#065f46", fontWeight: 600 }}
                            >
                              Yes (Farmer — actively farms owned land)
                            </span>
                          </div>
                          {parcel.agrarianReformBeneficiary && (
                            <div className="jo-registration-summary-item">
                              <span className="jo-registration-summary-label">
                                ARB:
                              </span>
                              <span className="jo-registration-summary-value">
                                {parcel.agrarianReformBeneficiary}
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

            {/* Navigation Buttons */}
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

export default JoRsbsaRegisFarmer;
