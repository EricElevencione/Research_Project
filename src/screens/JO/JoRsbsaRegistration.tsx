import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../../assets/css/jo css/JoRsbsaPageStyle.css';
import '../../assets/css/navigation/nav.css';
import LogoImage from '../../assets/images/Logo.png';
import DistributionIcon from '../../assets/images/distribution.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import MasterlistIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';
import LandRecsIcon from '../../assets/images/landrecord.png';
import FarmerRequestIcon from '../../assets/images/request.png';

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
}

interface LandOwner {
  id: string;
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

import { useEffect } from 'react';

// Utility function to convert text to Title Case with special handling
const toTitleCase = (text: string): string => {
  if (!text) return '';

  // Special words that should remain lowercase (unless at start)
  const lowercase = ['de', 'del', 'dela', 'ng', 'sa', 'and', 'or', 'the'];

  // Special words that should be uppercase
  const uppercase = ['ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'];

  // Extension name handling
  const extensions: Record<string, string> = {
    'jr': 'Jr.',
    'sr': 'Sr.',
    'jr.': 'Jr.',
    'sr.': 'Sr.',
  };

  return text
    .toLowerCase()
    .split(' ')
    .map((word, index) => {
      // Handle empty strings
      if (!word) return word;

      // Check if it's an extension
      const ext = extensions[word.replace(/\./g, '')];
      if (ext) return ext;

      // Check if it's a roman numeral
      if (uppercase.includes(word)) return word.toUpperCase();

      // Handle hyphenated words (e.g., "Aurora-Del Pilar")
      if (word.includes('-')) {
        return word
          .split('-')
          .map(part => {
            if (!part) return part;
            // Check if hyphenated part should be lowercase
            if (lowercase.includes(part) && index !== 0) return part;
            return part.charAt(0).toUpperCase() + part.slice(1);
          })
          .join('-');
      }

      // Check if word should remain lowercase (except at start)
      if (lowercase.includes(word) && index !== 0) return word;

      // Default: capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ')
    .trim();
};

const JoRsbsa: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [_activeTab] = useState('overview');
  const isActive = (path: string) => location.pathname === path;
  const [draftId, _setDraftId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [landowners, setLandowners] = useState<LandOwner[]>([]);

  // New state for ownership category selection
  const [ownershipCategory, setOwnershipCategory] = useState<'registeredOwner' | 'tenant' | 'lessee'>('registeredOwner');
  const [selectedLandOwner, setSelectedLandOwner] = useState<any>(null);
  const [landOwnerSearchTerm, setLandOwnerSearchTerm] = useState('');
  const [showLandOwnerDropdown, setShowLandOwnerDropdown] = useState(false);
  const [ownerParcels, setOwnerParcels] = useState<any[]>([]);
  const [selectedParcelIds, setSelectedParcelIds] = useState<Set<string>>(new Set());

  // Fetch landowners from the database
  useEffect(() => {
    const fetchLandowners = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/landowners');
        if (!response.ok) {
          throw new Error('Failed to fetch landowners');
        }
        const data = await response.json();
        setLandowners(data);
      } catch (error) {
        console.error('Error fetching landowners:', error);
      }
    };

    fetchLandowners();
  }, []);
  const [formData, setFormData] = useState<FormData>({
    surname: '',
    firstName: '',
    middleName: '',
    extensionName: '',
    houseNumber: '',
    gender: '',
    street: '',
    barangay: '',
    municipality: '',
    province: '',
    dateOfBirth: '',
    mainLivelihood: '',
    farmingActivity: '',
    otherCrops: '',
    livestock: '',
    poultry: '',
    farmlandParcels: [
      {
        parcelNo: '1',
        farmLocationBarangay: '',
        farmLocationMunicipality: '',
        totalFarmAreaHa: '',
        withinAncestralDomain: '',
        ownershipDocumentNo: '',
        agrarianReformBeneficiary: '',
        ownershipTypeRegisteredOwner: false,
        ownershipTypeTenant: false,
        ownershipTypeLessee: false,
        ownershipTypeOthers: false,
        tenantLandOwnerName: '',
        lesseeLandOwnerName: '',
        ownershipOthersSpecify: '',
      },
    ],
  });

  // validation errors (field name -> message)
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Handler for text inputs with Title Case formatting
  const handleTextInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  // Handler for onBlur to format text fields
  const handleTextInputBlur = (field: keyof FormData) => {
    const value = formData[field];
    if (typeof value === 'string' && value.trim()) {
      const formatted = toTitleCase(value);
      setFormData(prev => ({ ...prev, [field]: formatted }));
    }
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // clear any existing error for this field
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleParcelChange = (idx: number, field: keyof Parcel, value: any) => {
    setFormData(prev => {
      const parcels = [...prev.farmlandParcels];
      parcels[idx] = { ...parcels[idx], [field]: value };
      return { ...prev, farmlandParcels: parcels };
    });
    // clear parcel-related errors when user edits parcels
    setErrors(prev => ({ ...prev, farmland: '' }));
  };

  const toggleBool = (field: keyof FormData) => {
    setFormData(prev => ({ ...prev, [field]: !prev[field] }));
    // Clear farmingActivity error when any activity checkbox is toggled
    setErrors(prev => ({ ...prev, farmingActivity: '' }));
  };

  const addParcel = () => {
    setFormData(prev => {
      const nextNo = String(prev.farmlandParcels.length + 1);
      const parcels = [...prev.farmlandParcels];
      parcels.push({
        parcelNo: nextNo,
        farmLocationBarangay: '',
        farmLocationMunicipality: '',
        totalFarmAreaHa: '',
        withinAncestralDomain: '',
        ownershipDocumentNo: '',
        agrarianReformBeneficiary: '',
        ownershipTypeRegisteredOwner: false,
        ownershipTypeTenant: false,
        ownershipTypeLessee: false,
        ownershipTypeOthers: false,
        tenantLandOwnerName: '',
        lesseeLandOwnerName: '',
        ownershipOthersSpecify: '',
      });
      return { ...prev, farmlandParcels: parcels };
    });
  };

  const removeParcel = (idx: number) => {
    setFormData(prev => {
      const parcels = [...prev.farmlandParcels];
      parcels.splice(idx, 1);
      return { ...prev, farmlandParcels: parcels };
    });
  };

  // Handle ownership category change (Registered Owner, Tenant, Lessee)
  const handleOwnershipCategoryChange = (category: 'registeredOwner' | 'tenant' | 'lessee') => {
    setOwnershipCategory(category);
    setSelectedLandOwner(null);
    setLandOwnerSearchTerm('');
    setShowLandOwnerDropdown(false);
    setOwnerParcels([]);
    setSelectedParcelIds(new Set());
    setErrors(prev => ({ ...prev, farmland: '', landOwner: '', parcelSelection: '' }));

    // Clear or set ownership type checkboxes based on selection
    setFormData(prev => {
      const parcels = prev.farmlandParcels.map(p => ({
        ...p,
        ownershipTypeRegisteredOwner: category === 'registeredOwner',
        ownershipTypeTenant: category === 'tenant',
        ownershipTypeLessee: category === 'lessee',
        tenantLandOwnerName: '',
        lesseeLandOwnerName: '',
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
    setErrors(prev => ({ ...prev, landOwner: '', parcelSelection: '' }));

    // Fetch the land owner's parcels to show for selection
    try {
      const response = await fetch(`http://localhost:5000/api/rsbsa_submission/${owner.id}/parcels`);
      if (response.ok) {
        const parcels = await response.json();
        console.log('Fetched land owner parcels:', parcels);
        setOwnerParcels(parcels || []);

        if (!parcels || parcels.length === 0) {
          console.warn('No parcels found for land owner');
        }
      } else {
        console.error('Failed to fetch land owner parcels');
        setOwnerParcels([]);
      }
    } catch (error) {
      console.error('Error fetching land owner parcels:', error);
      setOwnerParcels([]);
    }
  };

  // Handle parcel selection toggle
  const handleParcelSelectionToggle = (parcelId: string) => {
    setSelectedParcelIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(parcelId)) {
        newSet.delete(parcelId);
      } else {
        newSet.add(parcelId);
      }
      return newSet;
    });
    setErrors(prev => ({ ...prev, parcelSelection: '' }));
  };

  // Apply selected parcels to form data
  const applySelectedParcels = () => {
    if (selectedParcelIds.size === 0) {
      setErrors(prev => ({ ...prev, parcelSelection: 'Please select at least one parcel' }));
      return;
    }

    const selectedParcels = ownerParcels.filter(p => selectedParcelIds.has(p.id));

    setFormData(prev => {
      const parcels = selectedParcels.map((ownerParcel: any, index: number) => ({
        parcelNo: String(index + 1),
        farmLocationBarangay: ownerParcel.farm_location_barangay || '',
        farmLocationMunicipality: ownerParcel.farm_location_municipality || 'Dumangas',
        totalFarmAreaHa: String(ownerParcel.total_farm_area_ha || ''),
        withinAncestralDomain: ownerParcel.within_ancestral_domain || '',
        ownershipDocumentNo: ownerParcel.ownership_document_no || '',
        agrarianReformBeneficiary: ownerParcel.agrarian_reform_beneficiary || '',
        ownershipTypeRegisteredOwner: false,
        ownershipTypeTenant: ownershipCategory === 'tenant',
        ownershipTypeLessee: ownershipCategory === 'lessee',
        ownershipTypeOthers: false,
        tenantLandOwnerName: ownershipCategory === 'tenant' ? selectedLandOwner.name : '',
        lesseeLandOwnerName: ownershipCategory === 'lessee' ? selectedLandOwner.name : '',
        ownershipOthersSpecify: '',
      }));
      return { ...prev, farmlandParcels: parcels };
    });

    setErrors(prev => ({ ...prev, parcelSelection: '' }));
  };

  // Filter land owners based on search term
  const filteredLandOwners = landowners.filter(owner =>
    owner.name.toLowerCase().includes(landOwnerSearchTerm.toLowerCase())
  );

  const handleLivelihoodToggle = (value: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      mainLivelihood: checked ? value : prev.mainLivelihood === value ? '' : prev.mainLivelihood,
    }));
    // Clear errors when livelihood is selected
    setErrors(prev => ({ ...prev, mainLivelihood: '', farmingActivity: '' }));
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
      // Validate basic details only
      if (!formData.firstName?.trim()) newErrors.firstName = 'First name is required';
      if (!formData.surname?.trim()) newErrors.surname = 'Surname is required';
      if (!formData.barangay?.trim()) newErrors.barangay = 'Barangay is required';

      setErrors(newErrors);
      if (Object.keys(newErrors).length > 0) return;

      // clear any step-level errors and go to next step
      setErrors({});
      setCurrentStep(2);
      return;
    }

    if (currentStep === 2) {
      // Validate farm profile: require main livelihood selection
      if (!formData.mainLivelihood) {
        newErrors.mainLivelihood = 'Please select a main livelihood';
      } else {
        // Validate specific activities based on selected livelihood
        if (formData.mainLivelihood === 'farmer') {
          const hasFarmingActivity = (formData as any).farmerRice ||
            (formData as any).farmerCorn ||
            (formData as any).farmerOtherCrops ||
            (formData as any).farmerLivestock ||
            (formData as any).farmerPoultry;
          if (!hasFarmingActivity) {
            newErrors.farmingActivity = 'Please select at least one farming activity';
          }
        } else if (formData.mainLivelihood === 'farmworker') {
          const hasWorkType = (formData as any).fwLandPrep ||
            (formData as any).fwPlanting ||
            (formData as any).fwCultivation ||
            (formData as any).fwHarvesting ||
            (formData as any).fwOthers;
          if (!hasWorkType) {
            newErrors.farmingActivity = 'Please select at least one kind of work';
          }
        } else if (formData.mainLivelihood === 'fisherfolk') {
          const hasFishingActivity = (formData as any).ffFishCapture ||
            (formData as any).ffAquaculture ||
            (formData as any).ffGleaning ||
            (formData as any).ffFishProcessing ||
            (formData as any).ffFishVending ||
            (formData as any).ffOthers;
          if (!hasFishingActivity) {
            newErrors.farmingActivity = 'Please select at least one fishing activity';
          }
        } else if (formData.mainLivelihood === 'agri-youth') {
          const hasInvolvement = (formData as any).ayPartHousehold ||
            (formData as any).ayFormalCourse ||
            (formData as any).ayNonFormalCourse ||
            (formData as any).ayParticipatedProgram ||
            (formData as any).ayOthers;
          if (!hasInvolvement) {
            newErrors.farmingActivity = 'Please select at least one type of involvement';
          }
        }
      }

      setErrors(newErrors);
      if (Object.keys(newErrors).length > 0) return;

      setErrors({});
      setCurrentStep(3);
      return;
    }

    if (currentStep === 3) {
      // For Registered Owner: validate farmland fields
      if (ownershipCategory === 'registeredOwner') {
        const hasValidFarmland = formData.farmlandParcels.some(
          parcel => parcel.farmLocationBarangay?.toString().trim() && parcel.totalFarmAreaHa?.toString().trim()
        );
        if (!hasValidFarmland) newErrors.farmland = 'Please fill in farm location and area';
      }

      // For Tenant/Lessee: validate land owner selection and parcel selection
      if (ownershipCategory === 'tenant' || ownershipCategory === 'lessee') {
        if (!selectedLandOwner) {
          newErrors.landOwner = 'Please search and select the land owner';
        } else if (ownerParcels.length > 0) {
          // Check if parcels were confirmed by checking if farmland data is populated with owner's parcel data
          const parcelsConfirmed = formData.farmlandParcels.length > 0 &&
            formData.farmlandParcels[0].farmLocationBarangay &&
            (formData.farmlandParcels[0].tenantLandOwnerName || formData.farmlandParcels[0].lesseeLandOwnerName);

          if (!parcelsConfirmed) {
            newErrors.parcelSelection = 'Please click "Confirm Selected Parcels" button to apply your parcel selection';
          }
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
    if (!formData.firstName?.trim()) newErrors.firstName = 'First name is required';
    if (!formData.surname?.trim()) newErrors.surname = 'Surname is required';
    if (!formData.barangay?.trim()) newErrors.barangay = 'Barangay is required';

    // Validate based on ownership category
    if (ownershipCategory === 'registeredOwner') {
      const hasValidFarmlandFinal = formData.farmlandParcels.some(
        parcel => parcel.farmLocationBarangay?.toString().trim() && parcel.totalFarmAreaHa?.toString().trim()
      );
      if (!hasValidFarmlandFinal) newErrors.farmland = 'At least one parcel must include barangay and area';
    }

    if (ownershipCategory === 'tenant' || ownershipCategory === 'lessee') {
      if (!selectedLandOwner) {
        newErrors.landOwner = 'Please select the land owner';
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
        dateOfBirth: formData.dateOfBirth ? new Date(formData.dateOfBirth) : null,
        farmlandParcels: formData.farmlandParcels.map(parcel => ({
          ...parcel,
          totalFarmAreaHa: parcel.totalFarmAreaHa ? parseFloat(parcel.totalFarmAreaHa) : 0,
          withinAncestralDomain: parcel.withinAncestralDomain === "Yes",
          agrarianReformBeneficiary: parcel.agrarianReformBeneficiary === "Yes",
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

      const response = await fetch("http://localhost:5000/api/rsbsa_submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId, data: transformedData }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.message || `HTTP ${response.status}`);
      }
      const result = await response.json();
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
      alert("Error submitting form: " + message + ". Please try again.");
      return null;
    }
  };


  const handleFinalSubmit = async () => {
    try {
      const submitted = await submitFinalToServer();
      if (submitted && submitted.submissionId) {
        alert('RSBSA form submitted successfully!');
        // Navigate back to JO flow instead of technician route to avoid auth redirects
        navigate('/jo-rsbsapage');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Error submitting form. Please try again.');
    }
  };


  return (
    <div className="page-container">

      <div className="page">

        {/* Sidebar starts here */}
        <div className="sidebar">
          <nav className="sidebar-nav">
            <div className='sidebar-logo'>
              <img src={LogoImage} alt="Logo" />
            </div>

            <button
              className={`sidebar-nav-item ${isActive('/jo-dashboard') ? 'active' : ''}`}
              onClick={() => navigate('/jo-dashboard')}
            >
              <span className="nav-icon">
                <img src={HomeIcon} alt="Home" />
              </span>
              <span className="nav-text">Home</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive('/jo-rsbsapage') ? 'active' : ''}`}
              onClick={() => navigate('/jo-rsbsapage')}
            >
              <span className="nav-icon">
                <img src={RSBSAIcon} alt="RSBSA" />
              </span>
              <span className="nav-text">RSBSA</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive('/jo-incentives') ? 'active' : ''}`}
              onClick={() => navigate('/jo-incentives')}
            >
              <span className="nav-icon">
                <img src={IncentivesIcon} alt="Incentives" />
              </span>
              <span className="nav-text">Incentives</span>
            </button>

            <div
              className={`sidebar-nav-item ${isActive('/jo-regional-allocation') ? 'active' : ''}`}
              onClick={() => navigate('/jo-regional-allocation')}
            >
              <div className="nav-icon">
                <img src={DistributionIcon} alt="Distribution" />
              </div>
              <span className="nav-text">Regional Allocation</span>
            </div>

            <div
              className={`sidebar-nav-item ${isActive('/jo-farmer-requests') ? 'active' : ''}`}
              onClick={() => navigate('/jo-farmer-requests')}
            >
              <div className="nav-icon">
                <img src={FarmerRequestIcon} alt="FarmerRequest" />
              </div>
              <span className="nav-text">Farmer Request</span>
            </div>

            <div
              className={`sidebar-nav-item ${isActive('/jo-gap-analysis') ? 'active' : ''}`}
              onClick={() => navigate('/jo-gap-analysis')}
            >
              <div className="nav-icon">📊</div>
              <span className="nav-text">Gap Analysis</span>
            </div>

            <div
              className={`sidebar-nav-item ${isActive('/jo-distribution') ? 'active' : ''}`}
              onClick={() => navigate('/jo-distribution')}
            >
              <div className="nav-icon">🚚</div>
              <span className="nav-text">Distribution Log</span>
            </div>

            <button
              className={`sidebar-nav-item ${isActive('/jo-masterlist') ? 'active' : ''}`}
              onClick={() => navigate('/jo-masterlist')}
            >
              <span className="nav-icon">
                <img src={MasterlistIcon} alt="Masterlist" />
              </span>
              <span className="nav-text">Masterlist</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive('/jo-landrecords') ? 'active' : ''}`}
              onClick={() => navigate('/jo-landrecords')}
            >
              <span className="nav-icon">
                <img src={LandRecsIcon} alt="Masterlist" />
              </span>
              <span className="nav-text">Land Records</span>
            </button>

            <button
              className={`sidebar-nav-item ${isActive('/') ? 'active' : ''}`}
              onClick={() => navigate('/')}
            >
              <span className="nav-icon">
                <img src={LogoutIcon} alt="Logout" />
              </span>
              <span className="nav-text">Logout</span>
            </button>
          </nav>
        </div>
        {/* Sidebar ends here */}

        {/* Main content starts here */}
        <div className="main-content">
          <h2>RSBSA Enrollment Form</h2>

          <div className="back-button">
            <button className="btn-back" onClick={() => navigate('/jo-rsbsapage')}></button>
          </div>

          <div className="rsbsa-form-container">
            <div className="form-steps">
              <div className={`step ${isStepActive(1) ? 'active' : ''} ${isStepCompleted(1) ? 'completed' : ''}`}>
                <span className="dot">{isStepCompleted(1) ? '✓' : '1'}</span>
                <span className="label">Basic Details</span>
              </div>
              <div className={`step ${isStepActive(2) ? 'active' : ''} ${isStepCompleted(2) ? 'completed' : ''}`}>
                <span className="dot">{isStepCompleted(2) ? '✓' : '2'}</span>
                <span className="label">Farm Profile</span>
              </div>
              <div className={`step ${isStepActive(3) ? 'active' : ''} ${isStepCompleted(3) ? 'completed' : ''}`}>
                <span className="dot">{isStepCompleted(3) ? '✓' : '3'}</span>
                <span className="label">Farmland</span>
              </div>
              <div className={`step ${isStepActive(4) ? 'active' : ''}${isStepCompleted(4) ? 'completed' : ''}`}>
                <span className="dot">4</span>
                <span className="label">Verification</span>
              </div>
            </div>

            {currentStep === 1 && (
              <>

                <div className="form-section">
                  <h3>PART I: PERSONAL INFORMATION</h3>
                  <div className="form-grid">
                    <div className="form-row">
                      <div className="form-group">
                        <label>FIRST NAME</label>
                        <input
                          type="text"
                          value={formData.firstName}
                          onChange={(e) => handleTextInputChange('firstName', e.target.value)}
                          onBlur={() => handleTextInputBlur('firstName')}
                          required
                          aria-required="true"
                          className={errors.firstName ? 'input-error' : ''}
                        />
                        {errors.firstName && <div className="error">{errors.firstName}</div>}
                      </div>
                      <div className="form-group">
                        <label>SURNAME</label>
                        <input
                          type="text"
                          value={formData.surname}
                          onChange={(e) => handleTextInputChange('surname', e.target.value)}
                          onBlur={() => handleTextInputBlur('surname')}
                          required
                          aria-required="true"
                          className={errors.surname ? 'input-error' : ''}
                        />
                        {errors.surname && <div className="error">{errors.surname}</div>}
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>MIDDLE NAME</label>
                        <input
                          type="text"
                          value={formData.middleName}
                          onChange={(e) => handleTextInputChange('middleName', e.target.value)}
                          onBlur={() => handleTextInputBlur('middleName')}
                        />
                      </div>
                      <div className="form-group">
                        <label>EXTENSION NAME</label>
                        <input
                          type="text"
                          value={formData.extensionName}
                          onChange={(e) => handleTextInputChange('extensionName', e.target.value)}
                          onBlur={() => handleTextInputBlur('extensionName')}
                        />
                      </div>
                      <div className="form-group">
                        <label>GENDER</label>
                        <select value={formData.gender} onChange={(e) => handleInputChange('gender', e.target.value)}>
                          <option value="">Select Gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                      </div>
                    </div>

                    <div className="address-section">
                      <h4>ADDRESS</h4>
                      <div className="address-grid">
                        <div className="form-group">
                          <label>BARANGAY *</label>
                          <input
                            type="text"
                            value={formData.barangay}
                            onChange={(e) => handleTextInputChange('barangay', e.target.value)}
                            onBlur={() => handleTextInputBlur('barangay')}
                            required
                            aria-required="true"
                            className={errors.barangay ? 'input-error' : ''}
                          />
                          {errors.barangay && <div className="error">{errors.barangay}</div>}
                        </div>
                        <div className="form-group">
                          <label>MUNICIPALITY</label>
                          <input
                            type="text"
                            value={formData.municipality}
                            onChange={(e) => handleTextInputChange('municipality', e.target.value)}
                            onBlur={() => handleTextInputBlur('municipality')}
                          />
                        </div>
                      </div>
                    </div>                  </div>
                </div>
              </>
            )}

            {currentStep === 2 && (
              <div className="form-section">
                <h3>PART II: FARM PROFILE</h3>
                <div className="form-grid">
                  <div className="livelihood-section">
                    <h4>MAIN LIVELIHOOD</h4>
                    <div className="checkbox-group">
                      <label><input type="checkbox" checked={formData.mainLivelihood === 'farmer'} onChange={(e) => handleLivelihoodToggle('farmer', e.target.checked)} /> FARMER</label>
                    </div>
                    {errors.mainLivelihood && <div className="error">{errors.mainLivelihood}</div>}
                  </div>

                  {formData.mainLivelihood === 'farmer' && (
                    <div className="livelihood-details">
                      <h4>Type of Farming Activity</h4>
                      <div className="checkbox-group">
                        <label><input type="checkbox" checked={(formData as any).farmerRice} onChange={() => toggleBool('farmerRice')} /> Rice</label>
                        <label><input type="checkbox" checked={(formData as any).farmerCorn} onChange={() => toggleBool('farmerCorn')} /> Corn</label>
                        <label><input type="checkbox" checked={(formData as any).farmerOtherCrops} onChange={() => toggleBool('farmerOtherCrops')} /> Other crops, please specify</label>
                      </div>
                      {(formData as any).farmerOtherCrops && (
                        <input type="text" placeholder="Specify other crops" value={(formData as any).farmerOtherCropsText} onChange={(e) => handleInputChange('farmerOtherCropsText', e.target.value)} />
                      )}
                      <div className="checkbox-group">
                        <label><input type="checkbox" checked={(formData as any).farmerLivestock} onChange={() => toggleBool('farmerLivestock')} /> Livestock, please specify</label>
                      </div>
                      {(formData as any).farmerLivestock && (
                        <input type="text" placeholder="Specify livestock" value={(formData as any).farmerLivestockText} onChange={(e) => handleInputChange('farmerLivestockText', e.target.value)} />
                      )}
                      <div className="checkbox-group">
                        <label><input type="checkbox" checked={(formData as any).farmerPoultry} onChange={() => toggleBool('farmerPoultry')} /> Poultry, please specify</label>
                      </div>
                      {(formData as any).farmerPoultry && (
                        <input type="text" placeholder="Specify poultry" value={(formData as any).farmerPoultryText} onChange={(e) => handleInputChange('farmerPoultryText', e.target.value)} />
                      )}
                      {errors.farmingActivity && <div className="error">{errors.farmingActivity}</div>}
                    </div>
                  )}

                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="form-section">
                <h3>PART III: FARMLAND</h3>

                {/* Show validation summary for farmland */}
                {(errors.farmland || errors.landOwner) && (
                  <div className="form-errors">
                    {errors.farmland && <div className="error">{errors.farmland}</div>}
                    {errors.landOwner && <div className="error">{errors.landOwner}</div>}
                  </div>
                )}

                {/* Ownership Category Selection */}
                <div className="ownership-category-section" style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '2px solid #dee2e6' }}>
                  <h4 style={{ marginBottom: '1rem', color: '#2c3e50' }}>Select Your Role</h4>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <label style={{ flex: '1', minWidth: '200px', padding: '1rem', backgroundColor: ownershipCategory === 'registeredOwner' ? '#007bff' : 'white', color: ownershipCategory === 'registeredOwner' ? 'white' : '#2c3e50', border: '2px solid #007bff', borderRadius: '6px', cursor: 'pointer', textAlign: 'center', fontWeight: 'bold', transition: 'all 0.3s' }}>
                      <input
                        type="radio"
                        name="ownershipCategory"
                        value="registeredOwner"
                        checked={ownershipCategory === 'registeredOwner'}
                        onChange={() => handleOwnershipCategoryChange('registeredOwner')}
                        style={{ marginRight: '0.5rem' }}
                      />
                      Registered Owner
                    </label>
                    <label style={{ flex: '1', minWidth: '200px', padding: '1rem', backgroundColor: ownershipCategory === 'tenant' ? '#28a745' : 'white', color: ownershipCategory === 'tenant' ? 'white' : '#2c3e50', border: '2px solid #28a745', borderRadius: '6px', cursor: 'pointer', textAlign: 'center', fontWeight: 'bold', transition: 'all 0.3s' }}>
                      <input
                        type="radio"
                        name="ownershipCategory"
                        value="tenant"
                        checked={ownershipCategory === 'tenant'}
                        onChange={() => handleOwnershipCategoryChange('tenant')}
                        style={{ marginRight: '0.5rem' }}
                      />
                      Tenant
                    </label>
                    <label style={{ flex: '1', minWidth: '200px', padding: '1rem', backgroundColor: ownershipCategory === 'lessee' ? '#ffc107' : 'white', color: ownershipCategory === 'lessee' ? '#2c3e50' : '#2c3e50', border: '2px solid #ffc107', borderRadius: '6px', cursor: 'pointer', textAlign: 'center', fontWeight: 'bold', transition: 'all 0.3s' }}>
                      <input
                        type="radio"
                        name="ownershipCategory"
                        value="lessee"
                        checked={ownershipCategory === 'lessee'}
                        onChange={() => handleOwnershipCategoryChange('lessee')}
                        style={{ marginRight: '0.5rem' }}
                      />
                      Lessee
                    </label>
                  </div>
                  <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#6c757d' }}>
                    {ownershipCategory === 'registeredOwner' && '✓ As a Registered Owner, you will provide your farm location and parcel details.'}
                    {ownershipCategory === 'tenant' && '✓ As a Tenant, you will select your land owner. Farm details will be populated from the owner\'s data.'}
                    {ownershipCategory === 'lessee' && '✓ As a Lessee, you will select your land owner. Farm details will be populated from the owner\'s data.'}
                  </p>
                </div>

                {/* Land Owner Search for Tenant/Lessee */}
                {(ownershipCategory === 'tenant' || ownershipCategory === 'lessee') && (
                  <div className="land-owner-search-section" style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#fff8e1', borderRadius: '8px', border: '2px solid #ffc107' }}>
                    <h4 style={{ marginBottom: '1rem', color: '#2c3e50' }}>Search and Select Land Owner</h4>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        placeholder="Type land owner name to search..."
                        value={landOwnerSearchTerm}
                        onChange={(e) => {
                          setLandOwnerSearchTerm(e.target.value);
                          setShowLandOwnerDropdown(true);
                        }}
                        onFocus={() => setShowLandOwnerDropdown(true)}
                        style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '2px solid #ffc107', borderRadius: '6px' }}
                        className={errors.landOwner ? 'input-error' : ''}
                      />
                      {showLandOwnerDropdown && filteredLandOwners.length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '2px solid #ffc107', borderTop: 'none', borderRadius: '0 0 6px 6px', maxHeight: '200px', overflowY: 'auto', zIndex: 1000, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                          {filteredLandOwners.map(owner => (
                            <div
                              key={owner.id}
                              onClick={() => handleLandOwnerSelect(owner)}
                              style={{ padding: '0.75rem', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', transition: 'background-color 0.2s' }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                            >
                              <strong>{owner.name}</strong>
                              {owner.barangay && <span style={{ marginLeft: '1rem', color: '#6c757d', fontSize: '0.9rem' }}>• {owner.barangay}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {selectedLandOwner && (
                      <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '6px' }}>
                        <strong style={{ color: '#155724' }}>✓ Selected Land Owner:</strong>
                        <div style={{ marginTop: '0.5rem', color: '#155724' }}>
                          <div><strong>Name:</strong> {selectedLandOwner.name}</div>
                          {selectedLandOwner.barangay && <div><strong>Barangay:</strong> {selectedLandOwner.barangay}</div>}
                          {selectedLandOwner.municipality && <div><strong>Municipality:</strong> {selectedLandOwner.municipality}</div>}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Parcel Selection for Tenant/Lessee */}
                {(ownershipCategory === 'tenant' || ownershipCategory === 'lessee') && selectedLandOwner && ownerParcels.length > 0 && (
                  <div className="parcel-selection-section" style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#e8f5e9', borderRadius: '8px', border: '2px solid #4caf50' }}>
                    <h4 style={{ marginBottom: '1rem', color: '#2c3e50' }}>Select Parcel(s) You Farm</h4>
                    <p style={{ fontSize: '0.9rem', color: '#6c757d', marginBottom: '1rem' }}>
                      {selectedLandOwner.name} has {ownerParcels.length} parcel{ownerParcels.length > 1 ? 's' : ''}. Select which parcel(s) you are farming on:
                    </p>

                    {errors.parcelSelection && (
                      <div style={{ padding: '0.75rem', backgroundColor: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: '4px', marginBottom: '1rem', color: '#721c24' }}>
                        {errors.parcelSelection}
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {ownerParcels.map((parcel: any, index: number) => (
                        <label
                          key={parcel.id}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            padding: '1rem',
                            backgroundColor: selectedParcelIds.has(parcel.id) ? '#c8e6c9' : 'white',
                            border: selectedParcelIds.has(parcel.id) ? '2px solid #4caf50' : '2px solid #dee2e6',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.3s'
                          }}
                          onMouseEnter={(e) => {
                            if (!selectedParcelIds.has(parcel.id)) {
                              e.currentTarget.style.backgroundColor = '#f5f5f5';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!selectedParcelIds.has(parcel.id)) {
                              e.currentTarget.style.backgroundColor = 'white';
                            }
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedParcelIds.has(parcel.id)}
                            onChange={() => handleParcelSelectionToggle(parcel.id)}
                            style={{ marginRight: '1rem', marginTop: '0.25rem', width: '18px', height: '18px', cursor: 'pointer' }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', color: '#2c3e50', marginBottom: '0.5rem' }}>
                              Parcel #{parcel.parcel_number || index + 1}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.9rem', color: '#495057' }}>
                              <div>
                                <strong>Location:</strong> {parcel.farm_location_barangay || 'N/A'}
                              </div>
                              <div>
                                <strong>Area:</strong> {parcel.total_farm_area_ha ? `${parcel.total_farm_area_ha} hectares` : 'N/A'}
                              </div>
                              <div>
                                <strong>Ancestral Domain:</strong> {parcel.within_ancestral_domain || 'N/A'}
                              </div>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>

                    <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.9rem', color: '#6c757d' }}>
                        {selectedParcelIds.size} parcel{selectedParcelIds.size !== 1 ? 's' : ''} selected
                      </div>
                      <button
                        onClick={applySelectedParcels}
                        style={{
                          padding: '0.75rem 1.5rem',
                          backgroundColor: selectedParcelIds.size > 0 ? '#4caf50' : '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontWeight: 'bold',
                          cursor: selectedParcelIds.size > 0 ? 'pointer' : 'not-allowed',
                          transition: 'all 0.3s'
                        }}
                        disabled={selectedParcelIds.size === 0}
                      >
                        ✓ Confirm Selected Parcels
                      </button>
                    </div>

                    {/* Warning if parcels selected but not confirmed */}
                    {selectedParcelIds.size > 0 && (!formData.farmlandParcels[0]?.farmLocationBarangay ||
                      (!formData.farmlandParcels[0]?.tenantLandOwnerName && !formData.farmlandParcels[0]?.lesseeLandOwnerName)) && (
                        <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '6px', color: '#856404', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                          <span style={{ fontWeight: 'bold' }}>Remember to click "Confirm Selected Parcels" button above to apply your selection!</span>
                        </div>
                      )}
                  </div>
                )}

                {/* Show confirmation message after parcels are applied */}
                {(ownershipCategory === 'tenant' || ownershipCategory === 'lessee') && selectedLandOwner && formData.farmlandParcels.length > 0 && formData.farmlandParcels[0].farmLocationBarangay && (
                  <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#d1ecf1', border: '1px solid #bee5eb', borderRadius: '6px', color: '#0c5460' }}>
                    <strong>✓ Parcels Confirmed:</strong> You will be registered as {ownershipCategory === 'tenant' ? 'a tenant' : 'a lessee'} on {formData.farmlandParcels.length} parcel{formData.farmlandParcels.length > 1 ? 's' : ''} from {selectedLandOwner.name}.
                  </div>
                )}

                {/* Farmland Parcels - Show only for Registered Owner */}
                {ownershipCategory === 'registeredOwner' && (
                  <>
                    {(formData.farmlandParcels as any[]).map((p, idx) => (
                      <div key={idx} className="parcel-card">
                        <div className="parcel-header">
                          <div className="parcel-no">Farm Parcel No. {p.parcelNo || idx + 1}</div>
                          <div className="parcel-actions">
                            {(formData.farmlandParcels as any[]).length > 1 && (
                              <button className="btn-small" onClick={() => removeParcel(idx)}>Remove</button>
                            )}
                          </div>
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label>Farm Location (Barangay)</label>
                            <select value={p.farmLocationBarangay} onChange={(e) => handleParcelChange(idx, 'farmLocationBarangay', e.target.value)} className={errors.farmland ? 'input-error' : ''}>
                              <option value="">Select Barangay</option>
                              <option value="Aurora-Del Pilar">Aurora-Del Pilar</option>
                              <option value="Bacay">Bacay</option>
                              <option value="Bacong">Bacong</option>
                              <option value="Balabag">Balabag</option>
                              <option value="Balud">Balud</option>
                              <option value="Bantud">Bantud</option>
                              <option value="Bantud Fabrica">Bantud Fabrica</option>
                              <option value="Baras">Baras</option>
                              <option value="Barasan">Barasan</option>
                              <option value="Basa-Mabini Bonifacio">Basa-Mabini Bonifacio</option>
                              <option value="Bolilao">Bolilao</option>
                              <option value="Buenaflor Embarkadero">Buenaflor Embarkadero</option>
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
                              <option value="Lopez Jaena - Rizal">Lopez Jaena - Rizal</option>
                              <option value="Managuit">Managuit</option>
                              <option value="Maquina">Maquina</option>
                              <option value="Nanding Lopez">Nanding Lopez</option>
                              <option value="Pagdugue">Pagdugue</option>
                              <option value="Paloc Bigque">Paloc Bigque</option>
                              <option value="Paloc Sool">Paloc Sool</option>
                              <option value="Patlad">Patlad</option>
                              <option value="Pd Monfort North">Pd Monfort North</option>
                              <option value="Pd Monfort South">Pd Monfort South</option>
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
                          </div>
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label>Total Farm Area (in hectares)</label>
                            <input type="number" value={p.totalFarmAreaHa} onChange={(e) => handleParcelChange(idx, 'totalFarmAreaHa', e.target.value)} className={errors.farmland ? 'input-error' : ''} />
                          </div>
                          <div className="form-group">
                            <label>Within Ancestral Domain</label>
                            <select value={p.withinAncestralDomain} onChange={(e) => handleParcelChange(idx, 'withinAncestralDomain', e.target.value)}>
                              <option value="">Select</option>
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                          </div>
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label>Agrarian Reform Beneficiary</label>
                            <select value={p.agrarianReformBeneficiary} onChange={(e) => handleParcelChange(idx, 'agrarianReformBeneficiary', e.target.value)}>
                              <option value="">Select</option>
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="parcel-actions-bar">
                      <button className="btn-submit" onClick={addParcel}>+ Add Another Parcel</button>
                    </div>
                  </>
                )}
              </div>
            )}

            {currentStep === 4 && (
              <div className="form-section">
                <h3>PART IV: VERIFICATION</h3>

                {/* Compilation of Previous Steps */}
                <div className="compilation-section">
                  <h4>FORM SUMMARY - PLEASE REVIEW ALL INFORMATION</h4>

                  {/* Step 1: Personal Information Summary */}
                  <div className="summary-section">
                    <h3>PART I: PERSONAL INFORMATION</h3>
                    <div className="summary-grid">
                      <div className="summary-item">
                        <span className="summary-label">Name:</span>
                        <span className="summary-value">
                          {formData.firstName}, {formData.middleName}, {formData.surname}, {formData.extensionName}
                        </span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">Gender</span>
                        <span className="summary-value">
                          {formData.gender}
                        </span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">Address:</span>
                        <span className="summary-value">
                          {formData.barangay}, {formData.municipality}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Farm Profile Summary */}
                  <div className="summary-section">
                    <h3>PART II: FARM PROFILE</h3>
                    <div className="summary-grid">
                      <div className="summary-item">
                        <span className="summary-label">Main Livelihood:</span>
                        <span className="summary-value">{formData.mainLivelihood || 'Not selected'}</span>
                      </div>

                      {/* Farmer Details */}
                      {formData.mainLivelihood === 'farmer' && (
                        <div className="summary-item">
                          <span className="summary-label">Farming Activities:</span>
                          <span className="summary-value">
                            {[
                              (formData as any).farmerRice && 'Rice',
                              (formData as any).farmerCorn && 'Corn',
                              (formData as any).farmerOtherCrops && `Other crops: ${(formData as any).farmerOtherCropsText}`,
                              (formData as any).farmerLivestock && `Livestock: ${(formData as any).farmerLivestockText}`,
                              (formData as any).farmerPoultry && `Poultry: ${(formData as any).farmerPoultryText}`
                            ].filter(Boolean).join(', ') || 'None selected'}
                          </span>
                        </div>
                      )}

                      {/* Farmworker Details */}
                      {formData.mainLivelihood === 'farmworker' && (
                        <div className="summary-item">
                          <span className="summary-label">Kind of Work:</span>
                          <span className="summary-value">
                            {[
                              (formData as any).fwLandPrep && 'Land Preparation',
                              (formData as any).fwPlanting && 'Planting/Transplanting',
                              (formData as any).fwCultivation && 'Cultivation',
                              (formData as any).fwHarvesting && 'Harvesting',
                              (formData as any).fwOthers && `Others: ${(formData as any).fwOthersText}`
                            ].filter(Boolean).join(', ') || 'None selected'}
                          </span>
                        </div>
                      )}

                      {/* Fisherfolk Details */}
                      {formData.mainLivelihood === 'fisherfolk' && (
                        <div className="summary-item">
                          <span className="summary-label">Fishing Activities:</span>
                          <span className="summary-value">
                            {[
                              (formData as any).ffFishCapture && 'Fish Capture',
                              (formData as any).ffAquaculture && 'Aquaculture',
                              (formData as any).ffGleaning && 'Gleaning',
                              (formData as any).ffFishProcessing && 'Fish Processing',
                              (formData as any).ffFishVending && 'Fish Vending',
                              (formData as any).ffOthers && `Others: ${(formData as any).ffOthersText}`
                            ].filter(Boolean).join(', ') || 'None selected'}
                          </span>
                        </div>
                      )}

                      {/* Agri Youth Details */}
                      {formData.mainLivelihood === 'agri-youth' && (
                        <div className="summary-item">
                          <span className="summary-label">Type of Involvement:</span>
                          <span className="summary-value">
                            {[
                              (formData as any).ayPartHousehold && 'Part of farming household',
                              (formData as any).ayFormalCourse && 'Formal agri-fishery course',
                              (formData as any).ayNonFormalCourse && 'Non-formal agri-fishery course',
                              (formData as any).ayParticipatedProgram && 'Agricultural activity/program',
                              (formData as any).ayOthers && `Others: ${(formData as any).ayOthersText}`
                            ].filter(Boolean).join(', ') || 'None selected'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 3: Farmland Summary */}
                  <div className="summary-section">
                    <h3>PART III: FARMLAND</h3>
                    {(formData.farmlandParcels as any[]).map((parcel, idx) => (
                      <div key={idx} className="parcel-summary">
                        <h6>Farm Parcel No. {parcel.parcelNo || idx + 1}</h6>
                        <div className="summary-grid">
                          <div className="summary-item">
                            <span className="summary-label">Location:</span>
                            <span className="summary-value">
                              {parcel.farmLocationBarangay}, {parcel.farmLocationMunicipality}
                            </span>
                          </div>
                          <div className="summary-item">
                            <span className="summary-label">Total Area:</span>
                            <span className="summary-value">
                              {parcel.totalFarmAreaHa ? `${parcel.totalFarmAreaHa} hectares` : 'Not specified'}
                            </span>
                          </div>
                          <div className="summary-item">
                            <span className="summary-label">Within Ancestral Domain:</span>
                            <span className="summary-value">{parcel.withinAncestralDomain || 'Not specified'}</span>
                          </div>
                          <div className="summary-item">
                            <span className="summary-label">Ownership Document:</span>
                            <span className="summary-value">{parcel.ownershipDocumentNo || 'Not provided'}</span>
                          </div>
                          <div className="summary-item">
                            <span className="summary-label">Agrarian Reform Beneficiary:</span>
                            <span className="summary-value">{parcel.agrarianReformBeneficiary || 'Not specified'}</span>
                          </div>
                          <div className="summary-item">
                            <span className="summary-label">Ownership Type:</span>
                            <span className="summary-value">
                              {[
                                parcel.ownershipTypeRegisteredOwner && 'Registered Owner',
                                parcel.ownershipTypeTenant && `Tenant (${parcel.tenantLandOwnerName})`,
                                parcel.ownershipTypeLessee && `Lessee (${parcel.lesseeLandOwnerName})`,
                                parcel.ownershipTypeOthers && `Others: ${parcel.ownershipOthersSpecify}`
                              ].filter(Boolean).join(', ') || 'Not specified'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="form-actions">
              {currentStep > 1 && (
                <button className="btn-save" onClick={handlePrevStep}>Previous</button>
              )}
              {currentStep < 4 ? (
                <button className="btn-submit" onClick={handleSubmitForm}>Next Step</button>
              ) : (
                <button className="btn-submit" onClick={handleSubmitForm}>Submit Form</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoRsbsa;
