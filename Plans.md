C:\Users\dblaz\Research-Project\backend
node server.cjs



mockup - https://www.canva.com/design/DAGVToQ2vZM/nf2_0HUUNSt4B7X563gDGQ/edit



<div className="enrollment-type">
                  <div className="type-checkboxes">
                    <label><input type="checkbox" checked={formData.enrollmentType === 'new'} onChange={(e) => handleInputChange('enrollmentType', e.target.checked ? 'new' : '')} /> New</label>
                    <label><input type="checkbox" checked={formData.enrollmentType === 'updating'} onChange={(e) => handleInputChange('enrollmentType', e.target.checked ? 'updating' : '')} /> Updating</label>
                  </div>
          
                  <div className="reference-number">
                    <span>Reference Number:</span>
                    <div className="ref-fields">
                      <input type="text" placeholder="REGION" value={formData.referenceRegion} onChange={(e) => handleInputChange('referenceRegion', e.target.value)} />
                      <input type="text" placeholder="PROVINCE" value={formData.referenceProvince} onChange={(e) => handleInputChange('referenceProvince', e.target.value)} />
                      <input type="text" placeholder="CITY/MUNI" value={formData.referenceMunicipality} onChange={(e) => handleInputChange('referenceMunicipality', e.target.value)} />
                      <input type="text" placeholder="BARANGAY" value={formData.referenceBarangay} onChange={(e) => handleInputChange('referenceBarangay', e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h3>PART I: PERSONAL INFORMATION</h3>
                  <div className="form-grid">
                    <div className="form-row">
                      <div className="form-group">
                        <label>SURNAME *</label>
                        <input type="text" value={formData.surname} onChange={(e) => handleInputChange('surname', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label>FIRST NAME *</label>
                        <input type="text" value={formData.firstName} onChange={(e) => handleInputChange('firstName', e.target.value)} />
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
                    </div>

                    <div className="address-section">
                      <h4>ADDRESS</h4>
                      <div className="address-grid">
                        <div className="form-group">
                          <label>HOUSE/LOT/BLDG. NO./PUROK</label>
                          <input type="text" value={formData.houseNumber} onChange={(e) => handleInputChange('houseNumber', e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label>STREET/SITIO/SUBDV.</label>
                          <input type="text" value={formData.street} onChange={(e) => handleInputChange('street', e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label>BARANGAY *</label>
                          <input type="text" value={formData.barangay} onChange={(e) => handleInputChange('barangay', e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label>MUNICIPALITY/CITY *</label>
                          <input type="text" value={formData.municipality} onChange={(e) => handleInputChange('municipality', e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label>PROVINCE *</label>
                          <input type="text" value={formData.province} onChange={(e) => handleInputChange('province', e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label>REGION</label>
                          <input type="text" value={formData.region} onChange={(e) => handleInputChange('region', e.target.value)} />
                        </div>
                      </div>
                    </div>

                    <div className="contact-section">
                      <div className="form-row">
                        <div className="form-group">
                          <label>MOBILE NUMBER</label>
                          <input type="tel" value={formData.mobileNumber} onChange={(e) => handleInputChange('mobileNumber', e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label>LANDLINE NUMBER</label>
                          <input type="tel" value={formData.landlineNumber} onChange={(e) => handleInputChange('landlineNumber', e.target.value)} />
                        </div>
                      </div>
                    </div>

                    <div className="demographics-section">
                      <div className="form-row">
                        <div className="form-group">
                          <label>DATE OF BIRTH</label>
                          <input type="date" value={formData.dateOfBirth} onChange={(e) => handleInputChange('dateOfBirth', e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label>PLACE OF BIRTH</label>
                          <div className="birth-place">
                            <input type="text" placeholder="MUNICIPALITY" value={formData.birthMunicipality} onChange={(e) => handleInputChange('birthMunicipality', e.target.value)} />
                            <input type="text" placeholder="PROVINCE/STATE" value={formData.birthProvince} onChange={(e) => handleInputChange('birthProvince', e.target.value)} />
                            <input type="text" placeholder="COUNTRY" value={formData.birthCountry} onChange={(e) => handleInputChange('birthCountry', e.target.value)} />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="education-section">
                      <label>HIGHEST FORMAL EDUCATION</label>
                      <div className="checkbox-group">
                        <label><input type="checkbox" checked={formData.education === 'pre-school'} onChange={(e) => handleInputChange('education', e.target.checked ? 'pre-school' : '')} /> Pre-school</label>
                        <label><input type="checkbox" checked={formData.education === 'elementary'} onChange={(e) => handleInputChange('education', e.target.checked ? 'elementary' : '')} /> Elementary</label>
                        <label><input type="checkbox" checked={formData.education === 'high-school'} onChange={(e) => handleInputChange('education', e.target.checked ? 'high-school' : '')} /> High School (non K-12)</label>
                        <label><input type="checkbox" checked={formData.education === 'junior-high'} onChange={(e) => handleInputChange('education', e.target.checked ? 'junior-high' : '')} /> Junior High School (K-12)</label>
                        <label><input type="checkbox" checked={formData.education === 'senior-high'} onChange={(e) => handleInputChange('education', e.target.checked ? 'senior-high' : '')} /> Senior High School (K-12)</label>
                        <label><input type="checkbox" checked={formData.education === 'college'} onChange={(e) => handleInputChange('education', e.target.checked ? 'college' : '')} /> College</label>
                        <label><input type="checkbox" checked={formData.education === 'vocational'} onChange={(e) => handleInputChange('education', e.target.checked ? 'vocational' : '')} /> Vocational</label>
                        <label><input type="checkbox" checked={formData.education === 'post-graduate'} onChange={(e) => handleInputChange('education', e.target.checked ? 'post-graduate' : '')} /> Post-graduate</label>
                        <label><input type="checkbox" checked={formData.education === 'none'} onChange={(e) => handleInputChange('education', e.target.checked ? 'none' : '')} /> None</label>
                      </div>
                    </div>

                    <div className="other-info-section">
                      <div className="form-row">
                        <div className="form-group">
                          <label>PERSON WITH DISABILITY (PWD)?</label>
                          <div className="radio-group">
                            <label><input type="radio" name="pwd" value="yes" checked={formData.pwd === 'yes'} onChange={(e) => handleInputChange('pwd', e.target.value)} /> Yes</label>
                            <label><input type="radio" name="pwd" value="no" checked={formData.pwd === 'no'} onChange={(e) => handleInputChange('pwd', e.target.value)} /> No</label>
                          </div>
                        </div>
                        <div className="form-group">
                          <label>RELIGION</label>
                          <div className="checkbox-group">
                            <label><input type="checkbox" checked={formData.religion === 'christianity'} onChange={(e) => handleInputChange('religion', e.target.checked ? 'christianity' : '')} /> Christianity</label>
                            <label><input type="checkbox" checked={formData.religion === 'islam'} onChange={(e) => handleInputChange('religion', e.target.checked ? 'islam' : '')} /> Islam</label>
                            <label><input type="checkbox" checked={formData.religion === 'others'} onChange={(e) => handleInputChange('religion', e.target.checked ? 'others' : '')} /> Others, specify</label>
                            <input type="text" placeholder="Specify religion" value={formData.religionOther} onChange={(e) => handleInputChange('religionOther', e.target.value)} />
                          </div>
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label>4P's Beneficiary?</label>
                          <div className="radio-group">
                            <label><input type="radio" name="4ps" value="yes" checked={formData.fourPs === 'yes'} onChange={(e) => handleInputChange('fourPs', e.target.value)} /> Yes</label>
                            <label><input type="radio" name="4ps" value="no" checked={formData.fourPs === 'no'} onChange={(e) => handleInputChange('fourPs', e.target.value)} /> No</label>
                          </div>
                        </div>
                        <div className="form-group">
                          <label>CIVIL STATUS</label>
                          <div className="checkbox-group">
                            <label><input type="checkbox" checked={formData.civilStatus === 'single'} onChange={(e) => handleInputChange('civilStatus', e.target.checked ? 'single' : '')} /> Single</label>
                            <label><input type="checkbox" checked={formData.civilStatus === 'married'} onChange={(e) => handleInputChange('civilStatus', e.target.checked ? 'married' : '')} /> Married</label>
                            <label><input type="checkbox" checked={formData.civilStatus === 'widowed'} onChange={(e) => handleInputChange('civilStatus', e.target.checked ? 'widowed' : '')} /> Widowed</label>
                            <label><input type="checkbox" checked={formData.civilStatus === 'separated'} onChange={(e) => handleInputChange('civilStatus', e.target.checked ? 'separated' : '')} /> Separated</label>
                          </div>
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label>Member of an Indigenous Group?</label>
                          <div className="radio-group">
                            <label><input type="radio" name="indigenous" value="yes" checked={formData.indigenous === 'yes'} onChange={(e) => handleInputChange('indigenous', e.target.value)} /> Yes</label>
                            <label><input type="radio" name="indigenous" value="no" checked={formData.indigenous === 'no'} onChange={(e) => handleInputChange('indigenous', e.target.value)} /> No</label>
                          </div>
                          <input type="text" placeholder="If yes, specify" value={formData.indigenousSpecify} onChange={(e) => handleInputChange('indigenousSpecify', e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label>NAME OF SPOUSE IF MARRIED</label>
                          <input type="text" value={formData.spouseName} onChange={(e) => handleInputChange('spouseName', e.target.value)} />
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label>MOTHER'S MAIDEN NAME</label>
                          <input type="text" value={formData.motherMaidenName} onChange={(e) => handleInputChange('motherMaidenName', e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label>With Government ID?</label>
                          <div className="radio-group">
                            <label><input type="radio" name="govId" value="yes" checked={formData.governmentId === 'yes'} onChange={(e) => handleInputChange('governmentId', e.target.value)} /> Yes</label>
                            <label><input type="radio" name="govId" value="no" checked={formData.governmentId === 'no'} onChange={(e) => handleInputChange('governmentId', e.target.value)} /> No</label>
                          </div>
                          <div className="id-details">
                            <input type="text" placeholder="ID Type" value={formData.idType} onChange={(e) => handleInputChange('idType', e.target.value)} />
                            <input type="text" placeholder="ID Number" value={formData.idNumber} onChange={(e) => handleInputChange('idNumber', e.target.value)} />
                          </div>
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label>HOUSEHOLD HEAD?</label>
                          <div className="radio-group">
                            <label><input type="radio" name="householdHead" value="yes" checked={formData.householdHead === 'yes'} onChange={(e) => handleInputChange('householdHead', e.target.value)} /> Yes</label>
                            <label><input type="radio" name="householdHead" value="no" checked={formData.householdHead === 'no'} onChange={(e) => handleInputChange('householdHead', e.target.value)} /> No</label>
                          </div>
                          <div className="household-details">
                            <input type="text" placeholder="If no, name of household head" value={formData.householdHeadName} onChange={(e) => handleInputChange('householdHeadName', e.target.value)} />
                            <input type="text" placeholder="Relationship" value={formData.householdHeadRelationship} onChange={(e) => handleInputChange('householdHeadRelationship', e.target.value)} />
                          </div>
                        </div>
                        <div className="form-group">
                          <label>Member of any Farmers Association/Cooperative?</label>
                          <div className="radio-group">
                            <label><input type="radio" name="association" value="yes" checked={formData.association === 'yes'} onChange={(e) => handleInputChange('association', e.target.value)} /> Yes</label>
                            <label><input type="radio" name="association" value="no" checked={formData.association === 'no'} onChange={(e) => handleInputChange('association', e.target.value)} /> No</label>
                          </div>
                          <input type="text" placeholder="If yes, specify" value={formData.associationSpecify} onChange={(e) => handleInputChange('associationSpecify', e.target.value)} />
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label>No. of living household members</label>
                          <input type="number" value={formData.householdMembers} onChange={(e) => handleInputChange('householdMembers', e.target.value)} />
                          <div className="gender-breakdown">
                            <input type="number" placeholder="No. of male" value={formData.householdMale} onChange={(e) => handleInputChange('householdMale', e.target.value)} />
                            <input type="number" placeholder="No. of female" value={formData.householdFemale} onChange={(e) => handleInputChange('householdFemale', e.target.value)} />
                          </div>
                        </div>
                        <div className="form-group">
                          <label>PERSON TO NOTIFY IN CASE OF EMERGENCY</label>
                          <input type="text" value={formData.emergencyContact} onChange={(e) => handleInputChange('emergencyContact', e.target.value)} />
                          <input type="tel" placeholder="CONTACT NUMBER" value={formData.emergencyNumber} onChange={(e) => handleInputChange('emergencyNumber', e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}