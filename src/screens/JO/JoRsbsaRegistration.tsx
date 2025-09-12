import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../assets/css/jo css/joRsbsaStyle.css';
import '../../assets/css/navigation/nav.css';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import ApproveIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';
import LandRecsIcon from '../../assets/images/landrecord.png';

const JoRsbsa: React.FC = () => {
  const navigate = useNavigate();

  const [activeTab] = useState('overview');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({ // Initialize with default values
    // Basic Details
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
    // Farm Profile
    mainLivelihood: '',
    farmingActivity: '',
    otherCrops: '',
    livestock: '',
    poultry: '',
    // Farmland parcels
    farmlandParcels: [
      {
        parcelNo: '1',
        farmLocationBarangay: '',
        farmLocationMunicipality: '',
        totalFarmAreaHa: '',
        withinAncestralDomain: '', // 'Yes' | 'No'
        ownershipDocumentNo: '',
        agrarianReformBeneficiary: '', // 'Yes' | 'No'
        ownershipTypeRegisteredOwner: false,
        ownershipTypeTenant: false,
        ownershipTypeLessee: false,
        ownershipTypeOthers: false,
        tenantLandOwnerName: '',
        lesseeLandOwnerName: '',
        ownershipOthersSpecify: ''
      }
    ] as any[]
  });

  // Extend form data with livelihood-specific fields
  // Farmers
  (formData as any).farmerRice = (formData as any).farmerRice ?? false;
  (formData as any).farmerCorn = (formData as any).farmerCorn ?? false;
  (formData as any).farmerOtherCrops = (formData as any).farmerOtherCrops ?? false;
  (formData as any).farmerOtherCropsText = (formData as any).farmerOtherCropsText ?? '';
  (formData as any).farmerLivestock = (formData as any).farmerLivestock ?? false;
  (formData as any).farmerLivestockText = (formData as any).farmerLivestockText ?? '';
  (formData as any).farmerPoultry = (formData as any).farmerPoultry ?? false;
  (formData as any).farmerPoultryText = (formData as any).farmerPoultryText ?? '';
  // Farmworkers
  (formData as any).fwLandPrep = (formData as any).fwLandPrep ?? false;
  (formData as any).fwPlanting = (formData as any).fwPlanting ?? false;
  (formData as any).fwCultivation = (formData as any).fwCultivation ?? false;
  (formData as any).fwHarvesting = (formData as any).fwHarvesting ?? false;
  (formData as any).fwOthers = (formData as any).fwOthers ?? false;
  (formData as any).fwOthersText = (formData as any).fwOthersText ?? '';
  // Fisherfolk
  (formData as any).ffFishCapture = (formData as any).ffFishCapture ?? false;
  (formData as any).ffAquaculture = (formData as any).ffAquaculture ?? false;
  (formData as any).ffGleaning = (formData as any).ffGleaning ?? false;
  (formData as any).ffFishProcessing = (formData as any).ffFishProcessing ?? false;
  (formData as any).ffFishVending = (formData as any).ffFishVending ?? false;
  (formData as any).ffOthers = (formData as any).ffOthers ?? false;
  (formData as any).ffOthersText = (formData as any).ffOthersText ?? '';
  // Agri youth
  (formData as any).ayPartHousehold = (formData as any).ayPartHousehold ?? false;
  (formData as any).ayFormalCourse = (formData as any).ayFormalCourse ?? false;
  (formData as any).ayNonFormalCourse = (formData as any).ayNonFormalCourse ?? false;
  (formData as any).ayParticipatedProgram = (formData as any).ayParticipatedProgram ?? false;
  (formData as any).ayOthers = (formData as any).ayOthers ?? false;
  (formData as any).ayOthersText = (formData as any).ayOthersText ?? '';

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleParcelChange = (idx: number, field: string, value: any) => {
    setFormData(prev => {
      const parcels = [...(prev.farmlandParcels as any[])];
      parcels[idx] = { ...parcels[idx], [field]: value };
      return { ...prev, farmlandParcels: parcels } as any;
    });
  };

  const toggleParcelBool = (idx: number, field: string) => {
    setFormData(prev => {
      const parcels = [...(prev.farmlandParcels as any[])];
      parcels[idx] = { ...parcels[idx], [field]: !parcels[idx][field] };
      return { ...prev, farmlandParcels: parcels } as any;
    });
  };

  const addParcel = () => {
    setFormData(prev => {
      const nextNo = String(((prev.farmlandParcels as any[]).length || 0) + 1);
      const parcels = [...(prev.farmlandParcels as any[])];
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
        ownershipOthersSpecify: ''
      });
      return { ...prev, farmlandParcels: parcels } as any;
    });
  };

  const removeParcel = (idx: number) => {
    setFormData(prev => {
      const parcels = [...(prev.farmlandParcels as any[])];
      parcels.splice(idx, 1);
      return { ...prev, farmlandParcels: parcels } as any;
    });
  };

  // --> Draft and Update section

  /**
   * Handles the final submission of the RSBSA form.
   * Calls the submitFinalToServer function and handles its response.
   * If the response is OK, it shows a success alert and navigates to the JO dashboard.
   * If the response is not OK, it shows an error alert and logs the error.
   */
  const handleFinalSubmit = async () => {
    try {
      const submitted = await submitFinalToServer(); // Call the submitFinalToServer function
      if (!submitted) return; //  

      alert('RSBSA form submitted successfully!');
      navigate('/jo-dashboard');
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Error submitting form. Please try again.');
    }
  };

  /**
   * Updates an existing RSBSA draft in the backend.
   * Sends a PUT request to the /api/rsbsa-draft/:id endpoint.
   * The request body contains the formData to be updated.
   * If the response is OK, the function returns the parsed server response.
   * If the response is not OK, the function throws an error.
   * returns The parsed server response if the request is successful, or null if the request fails.
   */

  const updateExistingDraft = async () => {
    if (!draftId) return null;
    try {
      // 1) Send the whole formData as the request body
      const response = await fetch(`http://localhost:5000/api/rsbsa-draft/${draftId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: formData }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${response.status}`);
      }

      // 3) Parse the server response
      const result = await response.json();

      return result;
    } catch (error) {
      console.error('Error updating draft:', error);
      alert('Error updating draft. Please try again.');
      return null
    }
  };

  /**
   * Handles saving a draft of the RSBSA form.
   * It first saves the draft to localStorage.
   * If the draft is new, it calls saveNewDraft to save it to the backend.
   * If the draft already exists, it calls updateExistingDraft to update it in the backend.
   * If the request is successful, it shows a success alert.
   */
  const handleSaveDraft = async () => {
    localStorage.setItem('rsbsaDraft', JSON.stringify(formData));
    if (!draftId) {
      const created = await saveNewDraft();
      if (created?.id) setDraftId(String(created.id));
      alert('Draft saved successfully!');
    } else {
      const updated = await updateExistingDraft();
      if (updated) alert('Draft updated successfully!');
    }
  };

  /**
   * Saves a new RSBSA draft to the backend.
   * Sends a POST request to the /api/rsbsa-draft endpoint.
   * The request body contains the formData to be saved.
   * If the response is OK, the function returns the parsed server response.
   * If the response is not OK, the function throws an error.
   * returns The parsed server response if the request is successful, or null if the request fails.
   */
  const saveNewDraft = async () => {
    try {
      // 1) Send the whole formData as the request body
      const response = await fetch('http://localhost:5000/api/rsbsa-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: formData }),
      })

      // 2) If HTTP status is not 2xx, throw to trigger catch block
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${response.status}`);
      }

      // 3) Parse the server response
      const result = await response.json();

      // 4) The server should retrun the new draft id; store it for the future updates
      if (result.id) setDraftId(String(result.id));

      return result;
    } catch (error) {
      console.error('Error saving draft:', error);
      alert('Error saving draft. Please try again.');
      return null
    }
  };

  // End Draft and Update section

  // --> Handles Draft section

  /**
   * Handles the form submission.
   * Performs basic validation by checking if required fields are filled.
   * If there are missing fields, it alerts the user and returns.
   * If all required fields are filled, it proceeds to the next step.
   * If on the last step, it calls handleFinalSubmit to submit the form to the server.
   */
  const handleSubmitForm = () => {
    // Check if at least one farmland parcel has required fields
    const hasValidFarmland = (formData.farmlandParcels as any[]).some(parcel =>
      parcel.farmLocationBarangay
    );

    const requiredFields = ['surname', 'firstName', 'barangay'];
    const missingFields = requiredFields.filter(field => !formData[field as keyof typeof formData]);

    if (missingFields.length > 0) {
      alert(`Please fill in required fields: ${missingFields.join(', ')}`);
      return;
    }

    if (!hasValidFarmland) {
      alert('Please fill in at least one farmland location (barangay)');
      return;
    }

    // Rest of the function...
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    } else {
      handleFinalSubmit();
    }
  };

  /**
   * This function is called when the form is submitted on the last step.
   * It sends the whole formData as the request body to the server.
   * If the response is not OK, it throws an error with the response message.
   * If the response is OK, it returns the response JSON.
   * If there's an error sending the request, it logs the error and alerts the user.
   * returns {Promise<Object | null>} The response JSON or null if there's an error.
   */
  const submitFinalToServer = async () => { // This function is called when 
    try {
      // 1) Send the whole formData as the request body
      const response = await fetch('http://localhost:5000/api/rsbsa_submission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ draftId, data: formData }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${response.status}`);
      }
      const result = await response.json().catch(() => ({}));
      return result;
    } catch (error: any) {
      console.error('Error submitting form:', error);
      alert('Error submitting form. Please try again.');
      return null
    }
  };

  // End of Handle Draft section


  /**
   * Advances the form to the next step if it's not already on the last step.
   * Does nothing if the form is already on the last step.
   * returns {void}
   */

  const handleNextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const isStepActive = (step: number) => currentStep === step;
  const isStepCompleted = (step: number) => currentStep > step;

  function handleLivelihoodToggle(value: string, checked: boolean): void {
    setFormData(prev => ({
      ...prev,
      mainLivelihood: checked ? value : (prev.mainLivelihood === value ? '' : prev.mainLivelihood)
    }));
  }

  function toggleBool(field: string): void {
    setFormData(prev => ({
      ...prev,
      [field]: !(prev as any)[field]
    }));
  }


  return (
    <div className="page-container">

      <div className="page">

        <div className="sidebar">
          <nav className="sidebar-nav">
            <div className='sidebar-logo'>
              <img src={LogoImage} alt="Logo" />
            </div>

            <button
              className={`sidebar-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => navigate('/jo-dashboard')}
            >
              <span className="nav-icon">
                <img src={HomeIcon} alt="Home" />
              </span>
              <span className="nav-text">Home</span>
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'rsbsa' ? 'active' : ''}`}
              onClick={() => navigate('/jo-rsbsa')}
            >
              <span className="nav-icon">
                <img src={RSBSAIcon} alt="RSBSA" />
              </span>
              <span className="nav-text">RSBSA</span>
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'incentives' ? 'active' : ''}`}
              onClick={() => navigate('/jo-incentives')}
            >
              <span className="nav-icon">
                <img src={IncentivesIcon} alt="Incentives" />
              </span>
              <span className="nav-text">Incentives</span>
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'masterlist' ? 'active' : ''}`}
              onClick={() => navigate('/jo-masterlist')}
            >
              <span className="nav-icon">
                <img src={ApproveIcon} alt="Incentives" />
              </span>
              <span className="nav-text">Masterlist</span>
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'landrecords' ? 'active' : ''}`}
              onClick={() => navigate('/jo-landrecords')}
            >
              <span className="nav-icon">
                <img src={LandRecsIcon} alt="Masterlist" />
              </span>
              <span className="nav-text">Land Records</span>
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'logout' ? 'active' : ''}`}
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
          <div className="dashboard-header">
            <h2 className="page-header">RSBSA Enrollment Form</h2>
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
              <div className={`step ${isStepActive(4) ? 'active' : ''}`}>
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
                        <input type="text" value={formData.firstName} onChange={(e) => handleInputChange('firstName', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label>SURNAME</label>
                        <input type="text" value={formData.surname} onChange={(e) => handleInputChange('surname', e.target.value)} />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>MIDDLE NAME</label>
                        <input type="text" value={formData.middleName} onChange={(e) => handleInputChange('middleName', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label>EXTENSION NAME</label>
                        <input type="text" value={formData.extensionName} onChange={(e) => handleInputChange('extensionName', e.target.value)} />
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
                          <input type="text" value={formData.barangay} onChange={(e) => handleInputChange('barangay', e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label>MUNICIAPLITY</label>
                          <input type="text" value={formData.municipality} onChange={(e) => handleInputChange('municipality', e.target.value)} />
                        </div>
                      </div>
                    </div>

                  </div>
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
                      <label><input type="checkbox" checked={formData.mainLivelihood === 'farmworker'} onChange={(e) => handleLivelihoodToggle('farmworker', e.target.checked)} /> FARMWORKER/LABORER</label>
                      <label><input type="checkbox" checked={formData.mainLivelihood === 'fisherfolk'} onChange={(e) => handleLivelihoodToggle('fisherfolk', e.target.checked)} /> FISHERFOLK</label>
                      <label><input type="checkbox" checked={formData.mainLivelihood === 'agri-youth'} onChange={(e) => handleLivelihoodToggle('agri-youth', e.target.checked)} /> AGRI YOUTH</label>
                    </div>
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
                    </div>
                  )}

                  {formData.mainLivelihood === 'farmworker' && (
                    <div className="livelihood-details">
                      <h4>Kind of Work</h4>
                      <div className="checkbox-group">
                        <label><input type="checkbox" checked={(formData as any).fwLandPrep} onChange={() => toggleBool('fwLandPrep')} /> Land Preparation</label>
                        <label><input type="checkbox" checked={(formData as any).fwPlanting} onChange={() => toggleBool('fwPlanting')} /> Planting/Transplanting</label>
                        <label><input type="checkbox" checked={(formData as any).fwCultivation} onChange={() => toggleBool('fwCultivation')} /> Cultivation</label>
                        <label><input type="checkbox" checked={(formData as any).fwHarvesting} onChange={() => toggleBool('fwHarvesting')} /> Harvesting</label>
                        <label><input type="checkbox" checked={(formData as any).fwOthers} onChange={() => toggleBool('fwOthers')} /> Others, please specify</label>
                      </div>
                      {(formData as any).fwOthers && (
                        <input type="text" placeholder="Specify other work" value={(formData as any).fwOthersText} onChange={(e) => handleInputChange('fwOthersText', e.target.value)} />
                      )}
                    </div>
                  )}

                  {formData.mainLivelihood === 'fisherfolk' && (
                    <div className="livelihood-details">
                      <h4>Type of Fishing Activity</h4>
                      <div className="checkbox-group">
                        <label><input type="checkbox" checked={(formData as any).ffFishCapture} onChange={() => toggleBool('ffFishCapture')} /> Fish Capture</label>
                        <label><input type="checkbox" checked={(formData as any).ffAquaculture} onChange={() => toggleBool('ffAquaculture')} /> Aquaculture</label>
                        <label><input type="checkbox" checked={(formData as any).ffGleaning} onChange={() => toggleBool('ffGleaning')} /> Gleaning</label>
                        <label><input type="checkbox" checked={(formData as any).ffFishProcessing} onChange={() => toggleBool('ffFishProcessing')} /> Fish Processing</label>
                        <label><input type="checkbox" checked={(formData as any).ffFishVending} onChange={() => toggleBool('ffFishVending')} /> Fish Vending</label>
                        <label><input type="checkbox" checked={(formData as any).ffOthers} onChange={() => toggleBool('ffOthers')} /> Others, please specify</label>
                      </div>
                      {(formData as any).ffOthers && (
                        <input type="text" placeholder="Specify other fishing activity" value={(formData as any).ffOthersText} onChange={(e) => handleInputChange('ffOthersText', e.target.value)} />
                      )}
                    </div>
                  )}

                  {formData.mainLivelihood === 'agri-youth' && (
                    <div className="livelihood-details">
                      <h4>Type of involvement</h4>
                      <div className="checkbox-group">
                        <label><input type="checkbox" checked={(formData as any).ayPartHousehold} onChange={() => toggleBool('ayPartHousehold')} /> part of a farming household</label>
                        <label><input type="checkbox" checked={(formData as any).ayFormalCourse} onChange={() => toggleBool('ayFormalCourse')} /> attending/attended formal agri-fishery related course</label>
                        <label><input type="checkbox" checked={(formData as any).ayNonFormalCourse} onChange={() => toggleBool('ayNonFormalCourse')} /> attending/attended non-formal agri-fishery related course</label>
                        <label><input type="checkbox" checked={(formData as any).ayParticipatedProgram} onChange={() => toggleBool('ayParticipatedProgram')} /> participated in any agricultural activity/program</label>
                        <label><input type="checkbox" checked={(formData as any).ayOthers} onChange={() => toggleBool('ayOthers')} /> others, specify</label>
                      </div>
                      {(formData as any).ayOthers && (
                        <input type="text" placeholder="Specify other involvement" value={(formData as any).ayOthersText} onChange={(e) => handleInputChange('ayOthersText', e.target.value)} />
                      )}
                    </div>
                  )}

                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="form-section">
                <h3>PART III: FARMLAND</h3>

                {/* Farmland Parcels */}
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
                        <select value={p.farmLocationBarangay} onChange={(e) => handleParcelChange(idx, 'farmLocationBarangay', e.target.value)}>
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
                        <input type="number" value={p.totalFarmAreaHa} onChange={(e) => handleParcelChange(idx, 'totalFarmAreaHa', e.target.value)} />
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

                    <div className="ownership-group">
                      <label>Ownership Type:</label>
                      <div className="ownership-options">
                        <label><input type="checkbox" checked={!!p.ownershipTypeRegisteredOwner} onChange={() => toggleParcelBool(idx, 'ownershipTypeRegisteredOwner')} /> Registered Owner</label>
                        <label><input type="checkbox" checked={!!p.ownershipTypeTenant} onChange={() => toggleParcelBool(idx, 'ownershipTypeTenant')} /> Tenant</label>
                        <label><input type="checkbox" checked={!!p.ownershipTypeLessee} onChange={() => toggleParcelBool(idx, 'ownershipTypeLessee')} /> Lessee</label>
                        <label><input type="checkbox" checked={!!p.ownershipTypeOthers} onChange={() => toggleParcelBool(idx, 'ownershipTypeOthers')} /> Others</label>
                      </div>

                      {p.ownershipTypeTenant && (
                        <div className="form-group">
                          <label>Tenant - Name of Land Owner</label>
                          <input type="text" value={p.tenantLandOwnerName} onChange={(e) => handleParcelChange(idx, 'tenantLandOwnerName', e.target.value)} />
                        </div>
                      )}
                      {p.ownershipTypeLessee && (
                        <div className="form-group">
                          <label>Lessee - Name of Land Owner</label>
                          <input type="text" value={p.lesseeLandOwnerName} onChange={(e) => handleParcelChange(idx, 'lesseeLandOwnerName', e.target.value)} />
                        </div>
                      )}
                      {p.ownershipTypeOthers && (
                        <div className="form-group">
                          <label>Others - Please Specify</label>
                          <input type="text" value={p.ownershipOthersSpecify} onChange={(e) => handleParcelChange(idx, 'ownershipOthersSpecify', e.target.value)} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <div className="parcel-actions-bar">
                  <button className="btn-submit" onClick={addParcel}>+ Add Another Parcel</button>
                </div>
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
                <button className="btn-submit" onClick={handleNextStep}>Next Step</button>
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
