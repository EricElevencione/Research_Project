import '../assets/css/RSBSAForm.css';

const RSBSAForm = () => {
    return (
        <div className="rsbsa-form-scrollable">
            <form className="rsbsa-form">
                <h2>ANI AT KITA - RSBSA ENROLLMENT FORM</h2>

                {/* ENROLLMENT TYPE & DATE */}
                <section className="form-section">
                    <div className="enrollment-date-row">
                        <div className="enrollment-type">
                            <label>Enrollment Type:</label>
                            <label><input type="radio" name="enrollmentType" value="new"/> New </label>
                            <label><input type="radio" name="enrollmentType" value="updating"/> Updating </label>
                        </div>

                        <div className="date-administered">
                            <label>Date Administered:</label>
                            <input type="date" />
                        </div>
                    </div>

                    <div className="reference-number-row">
                        <label>Reference Number:</label>
                        <div className="reference-number-fields">
                            <input type="text" placeholder="Region" />
                            <span>-</span>
                            <input type="text" placeholder="Province" />
                            <span>-</span>
                            <input type="text" placeholder="City/Muni" />
                            <span>-</span>
                            <input type="text" placeholder="Barangay" />
                        </div>
                    </div>
                </section>

                {/* PART I: PERSONAL INFORMATION */}
                <fieldset>
                <legend>Part I: Personal Information</legend>

                <div className="form-row name-row">
                    <span className="inline-label">Surname:</span>
                    <input type="text" />
                    <span className="inline-label">First Name:</span>
                    <input type="text" />
                </div>

                <div className="form-row name-row">
                    <span className="inline-label">Middle Name:</span>
                    <input type="text" />
                    <span className="inline-label">Extension Name:</span>
                    <input type="text" />
                </div>

                <hr className="form-separator" />

                <div className="form-row sex-row">
                    <label>Sex:</label>
                    <label><input type="radio" name="sex" /> Male</label>
                    <label><input type="radio" name="sex" /> Female</label>
                </div>

                <hr className="form-separator" />

                <div className="form-row address-row">

                    <div className="form-row">
                        <label className="address-label">Address:</label>
                    </div>

                    <div className="address-row">
                        <input type="text" placeholder="House/Lot/Bldg No./Purok" />
                        <input type="text" placeholder="Street/Sitio/Subdv." />
                        <input type="text" placeholder="Barangay" />
                        <input type="text" placeholder="Municipality/City" />
                        <input type="text" placeholder="Province" />
                        <input type="text" placeholder="Region" />
                    </div>
                </div>

                <hr className="form-separator" />

                <div className="form-row number-row">
                    <span className="inline-label">Mobile Number:</span>
                    <input type="text" />
                    <span className="inline-label">Landline Number:</span>
                    <input type="text" />
                </div>

                <hr className="form-separator" />

                <div className="form-row birth-row">
                    <span className="inline-label">Date of Birth:</span>
                    <input type="date" />
                    <span className="inline-label">Place of Birth:</span>
                    <input type="text" />
                </div>

                <hr className="form-separator" />

                <div className="form-row religion-row">
                    <label>Religion:</label>
                    <label><input type="radio" name="religion" value="Christianity" /> Christianity </label>
                    <label><input type="radio" name="religion" value="Islam" /> Islam </label>
                    <label><input type="radio" name="religion" value="Others" /><span className="inline-label">Others, specify </span></label>
                    <input type="text" />
                </div>

                <div className="form-row civil_status-row">
                    <label>Civil Status:</label>
                    <label><input type="radio" name="civil_status" value="Single" /> Single </label>
                    <label><input type="radio" name="civil_status" value="Married" /> Married </label>
                    <label><input type="radio" name="civil_status" value="Widowed" /> Widowed </label>
                    <label><input type="radio" name="civil_status" value="Separated" /> Separated </label>
                </div>

                <div className="form-row name_of_spouse-row">
                    <span className="inline-label">Name of Spouse if Married:</span>
                    <input type="text" />
                </div>

                <hr className="form-separator" />

                <div className="form-row mother_maiden_name-row">
                    <span className="inline-label">Mother's Maiden Name:</span>
                    <input type="text" />
                </div>

                <hr className="form-separator" />

                <div className="form-row household-row">
                    <label>Household Head:</label>
                    <label><input type="radio" name="household" value="Yes" /> Yes </label>
                    <label><input type="radio" name="household" value="No" /> No </label>
                </div>

                <div className="form-row household_head_relationship-row">
                    <span className="inline-label">If no, name of household head:</span>
                    <input type="text" />
                    <span className="inline-label">Relationship:</span>
                    <input type="text" />
                </div>

                <div className="form-row number_of_male_female_household_member-row">
                    <span className="inline-label">Number of male household members:</span>
                    <input type="number" />
                    <span className="inline-label">Number of female household members:</span>
                    <input type="number" />
                </div>

                <hr className="form-separator" />

                <div className="form-row">
                    <label className="highest_formal_education-label">Highest Formal Education:</label>
                </div>
                
                <div className="form-row highest_formal_education-grid">
                    <label><input type="radio" name="highest_education" value="Pre-School" /><span className="inline-label"> Pre-School </span></label>
                    <label><input type="radio" name="highest_education" value="Elementary" /><span className="inline-label"> Elementary </span></label>
                    <label><input type="radio" name="highest_education" value="High School (non K-12)" /><span className="inline-label"> High School (non K-12) </span></label>
                    <label><input type="radio" name="highest_education" value="Junior High School (non K-12)" /><span className="inline-label"> Junior High School (non K-12) </span></label>
                    <label><input type="radio" name="highest_education" value="Senior High School (non K-12)" /><span className="inline-label"> Senior High School (non K-12) </span></label>
                    <label><input type="radio" name="highest_education" value="College" /><span className="inline-label"> College </span></label>
                    <label><input type="radio" name="highest_education" value="Vocational" /><span className="inline-label"> Vocational </span></label>
                    <label><input type="radio" name="highest_education" value="Post-graduate" /><span className="inline-label"> Post-graduate </span></label>
                    <label><input type="radio" name="highest_education" value="None" /><span className="inline-label"> None </span></label>
                </div>

                <hr className="form-separator" />

                <div className="form-row pwd-row">
                    <label>Person with Disability (PWD):</label>
                    <label><input type="radio" name="pwd" value="Yes"/> Yes </label>
                    <label><input type="radio" name="pwd" value="No"/> No </label>
                </div>

                <hr className="form-separator" />

                <div className="form-row ps_beneficiary-row">
                    <label>4P's Beneficiary?</label>
                    <label><input type="radio" name="pwd" value="Yes"/> Yes </label>
                    <label><input type="radio" name="pwd" value="No"/> No </label>
                </div>

                <div className="form-row indigenous_group-row">
                    <label>Member of an Indigenous Group?</label>
                    <label><input type="radio" name="pwd" value="Yes"/> Yes </label>
                    <label><input type="radio" name="pwd" value="No"/> No </label>
                    <span className="inline-label">If yes, specify </span><input type="text" />
                </div>

                <hr className="form-separator" />

                <div className="form-row government_id-row">
                    <label>With Government ID?</label>
                    <label><input type="radio" name="gov_id" value="Yes"/> Yes </label>
                    <label><input type="radio" name="gov_id" value="No"/> No </label>
                </div>

                <div className="form-row id_type-row">
                    <span className="inline-label">If yes, specify ID Type: </span><input type="text" />
                    <span className="inline-label">ID Number: </span><input type="text" />
                </div>

                <hr className="form-separator" />

                <div className="form-row farmer_association-row">
                    <label>Member of any Farmers Association/Cooperative?</label>
                    <label><input type="radio" name="gov_id" value="Yes"/> Yes </label>
                    <label><input type="radio" name="gov_id" value="No"/> No </label>
                </div>

                <div className="form-row specify-row">
                    <span className="inline-label">If yes, specify: </span><input type="text" />
                </div>

                <hr className="form-separator" />

                <div className="form-row person_to_notify-row">
                    <span className="inline-label">Person to Notify in case of Emergency: </span><input type="text" />
                    <span className="inline-label">Contact Number: </span><input type="text" />
                </div>
                </fieldset>

                {/* PART II: FARM PROFILE */}
                <fieldset>
                <legend>Part II: Farm Profile</legend>

                <div className="form-row main_livelihood-row">
                    <label>Main Livelihood:</label>
                    <label><input type="radio" name="main_livelihood" value="Farmer"/> Farmer </label>
                    <label><input type="radio" name="main_livelihood" value="Farmworker"/> Farmworker </label>
                    <label><input type="radio" name="main_livelihood" value="Fisherfolk"/> Fisherfolk </label>
                    <label><input type="radio" name="main_livelihood" value="Agri Youth"/> Agri Youth </label>
                </div>

                <hr className="form-separator" />

                <div className="form-row">
                    <label>Type of Farming Activity:</label>
                    <input type="checkbox" /> Rice
                    <input type="checkbox" /> Corn
                    <input type="checkbox" /> Other Crops
                    <input type="checkbox" /> Livestock
                    <input type="checkbox" /> Poultry
                </div>

                <div className="form-row">
                    <label>Kind of Work:</label>
                    <input type="checkbox" /> Land Preparation
                    <input type="checkbox" /> Planting/Transplanting
                    <input type="checkbox" /> Cultivation
                    <input type="checkbox" /> Harvesting
                </div>

                <div className="form-row">
                    <label>Type of Fishing Activity:</label>
                    <input type="checkbox" /> Fish Capture
                    <input type="checkbox" /> Aquaculture
                    <input type="checkbox" /> Gleaning
                    <input type="checkbox" /> Fish Processing
                    <input type="checkbox" /> Fish Vending
                </div>

                <div className="form-row">
                    <label>Agri Youth Involvement:</label>
                    <input type="checkbox" /> Part of a farming household
                    <input type="checkbox" /> Attending agri-related course
                    <input type="checkbox" /> Attending non-formal agri training
                </div>

                <hr className="form-separator" />

                <div className="form-row gross_annual_income-row">
                    <label className="inline-label">Gross Annual Income Last Year:</label>
                    <span className="inline-label">Farming: </span><input type="text" />
                    <span className="inline-label">Non-farming: </span><input type="text" />
                </div>
                </fieldset>

                {/* Placeholder for Back Page */}
                <fieldset>
                <legend>Farm Parcel Details & Ownership</legend>
                <p>[Additional fields for parcel location, area, ownership, etc.]</p>
                </fieldset>

                <button type="submit">Submit</button>
            </form>
        </div>
    );
};

export default RSBSAForm;
