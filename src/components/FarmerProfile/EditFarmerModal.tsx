import React, { useState, useEffect } from "react";
import {
  getFarmParcels,
  updateRsbsaSubmission,
  updateFarmParcel,
  syncLandPlotArea,
  getLandownerOwnedArea,
} from "../../api";
import "./EditFarmerModal.css";

const DUMANGAS_BARANGAYS = [
  "Agboy",
  "Bacay",
  "Bacong",
  "Balud",
  "Bantud",
  "Banjao",
  "Baras",
  "Buena Vista",
  "Cabalagnan",
  "Calao",
  "Cali",
  "Cansilayan",
  "Capinala",
  "Cayos",
  "Compas",
  "Ermita",
  "Garingan",
  "Jardin",
  "Lacturan",
  "Lula",
  "Mapanao",
  "Nalu-an",
  "Pulao",
  "Rosario",
  "Sapao",
  "Tabucan",
  "Tambobo",
  "Tominague",
];

const nt = (s: unknown) => String(s ?? "").trim().toLowerCase();

const parseName = (fullName: string) => {
  if (!fullName || fullName === "—" || fullName === "N/A") {
    return { lastName: "", firstName: "", middleName: "" };
  }
  const parts = fullName.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { lastName: "", firstName: "", middleName: "" };
  if (parts.length === 1) return { lastName: parts[0], firstName: "", middleName: "" };

  const lastName = parts[0];
  const firstMiddle = (parts[1] || "").split(" ").map((p) => p.trim()).filter(Boolean);
  const firstName = firstMiddle[0] || "";
  const middleName = firstMiddle.slice(1).join(" ") || "";

  return { lastName, firstName, middleName };
};

const parseAddress = (addressStr: string) => {
  if (!addressStr || addressStr === "—" || addressStr === "N/A") {
    return { barangay: "", municipality: "Dumangas" };
  }
  const parts = addressStr.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { barangay: parts[0], municipality: parts[1] };
  }
  if (parts.length === 1) {
    const isBrgy = DUMANGAS_BARANGAYS.some((b) => nt(b) === nt(parts[0]));
    return {
      barangay: isBrgy ? parts[0] : "",
      municipality: isBrgy ? "Dumangas" : parts[0],
    };
  }
  return { barangay: "", municipality: "Dumangas" };
};

const parseAgeInputToNumber = (val: string): number | null => {
  if (!val || !val.trim()) return null;
  const num = parseInt(val.trim(), 10);
  return isNaN(num) ? null : num;
};

export interface EditFarmerModalProps {
  isOpen: boolean;
  recordId: string | null;
  initialRecord: any | null;
  onClose: () => void;
  onSaved?: (updatedRecord: any, updatedParcels: any[]) => void;
  showNotification?: (message: string, type: "success" | "error") => void;
}

export const EditFarmerModal: React.FC<EditFarmerModalProps> = ({
  isOpen,
  recordId,
  initialRecord,
  onClose,
  onSaved,
  showNotification,
}) => {
  const [editFormData, setEditFormData] = useState<{
    farmerName?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    age?: string;
    farmerAddress?: string;
    barangay?: string;
    municipality?: string;
    farmLocation?: string;
    landParcel?: string;
    dateSubmitted?: string;
    parcelArea?: string;
  }>({});

  const [editingParcels, setEditingParcels] = useState<any[]>([]);
  const [loadingParcels, setLoadingParcels] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [parcelErrors, setParcelErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !recordId || !initialRecord) return;

    const rawName = initialRecord.farmerName || "";
    const { lastName, firstName, middleName } = parseName(rawName);
    const pa = parseAddress(initialRecord.farmerAddress || "");
    const pf = parseAddress(initialRecord.farmLocation || "");

    const matchBrgy = (c: string) =>
      DUMANGAS_BARANGAYS.find((b) => nt(b) === nt(c)) || "";
    const resolvedBarangay =
      matchBrgy(pa.barangay) || matchBrgy(pf.barangay) || "";
    const resolvedMunicipality =
      pa.municipality && nt(pa.municipality) !== "iloilo"
        ? pa.municipality
        : pf.municipality || "Dumangas";

    setEditError(null);
    setParcelErrors({});
    setEditFormData({
      farmerName: rawName,
      firstName,
      middleName,
      lastName,
      age:
        initialRecord.age !== undefined && initialRecord.age !== null
          ? String(initialRecord.age)
          : "",
      farmerAddress: initialRecord.farmerAddress || "",
      barangay: resolvedBarangay,
      municipality: resolvedMunicipality,
      farmLocation: initialRecord.farmLocation || "",
      landParcel: initialRecord.landParcel || "",
      dateSubmitted: initialRecord.dateSubmitted || "",
      parcelArea: initialRecord.parcelArea
        ? String(initialRecord.parcelArea).replace(/\s*hectares\s*$/i, "").trim()
        : "",
    });

    setLoadingParcels(true);
    getFarmParcels(recordId)
      .then((res) => {
        if (!res.error && Array.isArray(res.data)) {
          setEditingParcels(
            res.data.map((p: any) => ({
              ...p,
              is_farming: typeof p.is_farming === "boolean" ? p.is_farming : null,
              farming_status_reason: p.farming_status_reason || null,
            })),
          );
        } else {
          setEditingParcels([]);
        }
      })
      .catch(() => setEditingParcels([]))
      .finally(() => setLoadingParcels(false));
  }, [isOpen, recordId, initialRecord]);

  if (!isOpen || !recordId || !initialRecord) return null;

  const handleInputChange = (field: string, value: string) => {
    setEditError(null);
    setEditFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleIndividualParcelChange = (
    parcelId: string,
    field: string,
    value: any,
  ) => {
    setParcelErrors((prev) => ({ ...prev, [parcelId]: "" }));
    setEditingParcels((prev) =>
      prev.map((p) => {
        if (p.id === parcelId) {
          if (field === "total_farm_area_ha") {
            const num = parseFloat(value);
            return {
              ...p,
              total_farm_area_ha: isNaN(num) ? value : num,
            };
          }
          return { ...p, [field]: value };
        }
        return p;
      }),
    );
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setEditError(null);

    try {
      // 1. Validate parcel fields
      if (editingParcels.length > 0) {
        const newErrors: Record<string, string> = {};
        for (const p of editingParcels) {
          const areaNum = parseFloat(p.total_farm_area_ha);
          if (isNaN(areaNum) || areaNum <= 0) {
            newErrors[p.id] = "Parcel area must be a valid positive number";
          } else if (
            (p.ownership_type_tenant || p.ownership_type_lessee) &&
            !p.ownership_type_registered_owner
          ) {
            const ownerId = p.tenant_land_owner_id || p.lessee_land_owner_id;
            const ownerName = p.tenant_land_owner_name || p.lessee_land_owner_name;
            if (ownerId || ownerName) {
              const { totalAreaHa, landownerName } = await getLandownerOwnedArea(
                ownerId,
                ownerName,
              );
              if (totalAreaHa > 0 && areaNum > totalAreaHa) {
                newErrors[p.id] = `Area (${areaNum} ha) exceeds total land area owned by ${landownerName} (${totalAreaHa.toFixed(2)} ha)`;
              }
            }
          }
        }

        if (Object.keys(newErrors).length > 0) {
          setParcelErrors(newErrors);
          setEditError("Fix parcel area errors before saving.");
          if (showNotification) {
            showNotification("Fix parcel area errors before saving.", "error");
          }
          setIsSaving(false);
          return;
        }
      }

      // 2. Validate age
      const rawAge = (editFormData.age ?? "").trim();
      const normalizedAge = parseAgeInputToNumber(rawAge);
      if (rawAge !== "" && (normalizedAge === null || normalizedAge < 18)) {
        setEditError("Age must be ≥ 18");
        if (showNotification) {
          showNotification("Age must be at least 18.", "error");
        }
        setIsSaving(false);
        return;
      }

      // 3. Compose farmer name & address
      const last = (editFormData.lastName ?? "").trim();
      const first = (editFormData.firstName ?? "").trim();
      const middle = (editFormData.middleName ?? "").trim();
      const composedFarmerName = [last, [first, middle].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", ");

      const b = (editFormData.barangay ?? "").trim();
      const m = (editFormData.municipality ?? "").trim();
      const composedAddress = [b, m].filter(Boolean).join(", ");

      const newParcelAreaString =
        editingParcels.length > 0
          ? editingParcels.map((p) => p.total_farm_area_ha).join(", ")
          : (editFormData.parcelArea ?? initialRecord.parcelArea);

      const formattedData = {
        farmerName: composedFarmerName,
        farmerAddress: composedAddress,
        parcelArea: newParcelAreaString,
        age: normalizedAge,
      };

      const cleanedData = Object.entries({
        ...editFormData,
        ...formattedData,
        firstName: first,
        middleName: middle,
        surname: last,
        addressBarangay: b,
        addressMunicipality: m,
      }).reduce((acc, [k, v]) => {
        if (v !== undefined && v !== "") acc[k] = v;
        return acc;
      }, {} as Record<string, any>);

      // 4. Update RSBSA submission
      const response = await updateRsbsaSubmission(recordId, cleanedData);
      if (response.error) throw new Error(response.error);

      // 5. Update each parcel & sync GIS land plot area
      for (const parcel of editingParcels) {
        try {
          await updateFarmParcel(parcel.id, {
            total_farm_area_ha: parcel.total_farm_area_ha,
            farm_location_barangay: parcel.farm_location_barangay,
            farm_location_municipality: parcel.farm_location_municipality,
            within_ancestral_domain: parcel.within_ancestral_domain,
            ownership_document_no: parcel.ownership_document_no,
            agrarian_reform_beneficiary: parcel.agrarian_reform_beneficiary,
            ownership_type_registered_owner: parcel.ownership_type_registered_owner,
            ownership_type_tenant: parcel.ownership_type_tenant,
            ownership_type_lessee: parcel.ownership_type_lessee,
            tenant_land_owner_name: parcel.tenant_land_owner_name,
            lessee_land_owner_name: parcel.lessee_land_owner_name,
            is_farming: parcel.is_farming,
            farming_status_reason: parcel.farming_status_reason,
            farming_status_updated_at: new Date().toISOString(),
          });
        } catch (e) {
          console.error(`Parcel ${parcel.id} update error:`, e);
        }

        if (parcel.parcel_number && parcel.parcel_number !== "N/A") {
          try {
            await syncLandPlotArea(
              recordId,
              parcel.parcel_number,
              parcel.total_farm_area_ha,
            );
          } catch (e) {
            console.error(`syncLandPlotArea for parcel ${parcel.id} error:`, e);
          }
        }
      }

      // 6. Notify map components of plot update
      window.dispatchEvent(new CustomEvent("land-plot-saved"));

      const serverRecord = response.data?.updatedRecord ?? response.data ?? {};
      const finalUpdatedRecord = {
        ...initialRecord,
        ...cleanedData,
        ...serverRecord,
        id: recordId,
        farmerName: composedFarmerName || initialRecord.farmerName,
        farmerAddress: composedAddress || initialRecord.farmerAddress,
        parcelArea: newParcelAreaString,
        age: normalizedAge,
      };

      if (showNotification) {
        showNotification("Farmer information updated successfully!", "success");
      }

      if (onSaved) {
        onSaved(finalUpdatedRecord, editingParcels);
      }

      onClose();
    } catch (err: any) {
      console.error("Error saving farmer edits:", err);
      setEditError(err.message || "Failed to update farmer information");
      if (showNotification) {
        showNotification(err.message || "Failed to update farmer information.", "error");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="edit-farmer-modal-overlay">
      <div className="edit-farmer-modal">
        <div className="edit-farmer-modal-header">
          <div>
            <h2>Edit Farmer Information</h2>
            <p>Update personal details, address, and parcel farm areas.</p>
          </div>
          <button
            className="edit-farmer-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <div className="edit-farmer-modal-body">
          {editError && (
            <div className="edit-farmer-error-banner" role="alert">
              {editError}
            </div>
          )}

          <div className="edit-farmer-form-grid">
            <div className="edit-farmer-form-group">
              <label>Last Name:</label>
              <input
                type="text"
                value={editFormData.lastName || ""}
                onChange={(e) => handleInputChange("lastName", e.target.value)}
                placeholder="Last Name"
              />
            </div>
            <div className="edit-farmer-form-group">
              <label>First Name:</label>
              <input
                type="text"
                value={editFormData.firstName || ""}
                onChange={(e) => handleInputChange("firstName", e.target.value)}
                placeholder="First Name"
              />
            </div>
            <div className="edit-farmer-form-group">
              <label>Middle Name:</label>
              <input
                type="text"
                value={editFormData.middleName || ""}
                onChange={(e) => handleInputChange("middleName", e.target.value)}
                placeholder="Middle Name"
              />
            </div>
            <div className="edit-farmer-form-group">
              <label>Age:</label>
              <input
                type="text"
                value={editFormData.age || ""}
                onChange={(e) => handleInputChange("age", e.target.value)}
                placeholder="Age"
              />
            </div>
            <div className="edit-farmer-form-group">
              <label>Barangay:</label>
              <select
                value={editFormData.barangay || ""}
                onChange={(e) => handleInputChange("barangay", e.target.value)}
                className="edit-farmer-select"
              >
                <option value="">Select Barangay</option>
                {DUMANGAS_BARANGAYS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div className="edit-farmer-form-group">
              <label>Municipality:</label>
              <input
                type="text"
                value={editFormData.municipality || ""}
                onChange={(e) =>
                  handleInputChange("municipality", e.target.value)
                }
                placeholder="Municipality"
              />
            </div>
          </div>

          <div className="edit-farmer-parcel-section">
            <h4>Parcels</h4>
            {loadingParcels ? (
              <p className="edit-farmer-loading-text">Loading parcels...</p>
            ) : editingParcels.length > 0 ? (
              editingParcels.map((parcel, index) => (
                <div
                  key={parcel.id}
                  className={`edit-farmer-parcel-card ${
                    parcelErrors[parcel.id] ? "error" : ""
                  }`}
                >
                  <div className="edit-farmer-form-group">
                    <label className="edit-farmer-parcel-title">
                      Parcel {index + 1} —{" "}
                      {parcel.parcel_number && parcel.parcel_number !== "N/A"
                        ? `No. ${parcel.parcel_number}`
                        : "No parcel number"}
                    </label>
                    <input
                      type="text"
                      value={parcel.total_farm_area_ha || ""}
                      onChange={(e) =>
                        handleIndividualParcelChange(
                          parcel.id,
                          "total_farm_area_ha",
                          e.target.value,
                        )
                      }
                      placeholder="e.g., 2.5 (ha)"
                      className="edit-farmer-parcel-input"
                    />

                    {(parcel.ownership_type_tenant || parcel.ownership_type_lessee) &&
                    !parcel.ownership_type_registered_owner ? (
                      <div className="edit-farmer-tenant-notice">
                        ⚠️ <strong>Tenant / Lessee Notice:</strong> You are editing a parcel as a Tenant/Lessee of this land. Changing this value does <strong>not</strong> alter the official physical land size — only the registered Landowner can modify official land parcel sizes.
                      </div>
                    ) : (
                      <div className="edit-farmer-gis-notice">
                        <span>⚠️</span> Note: Changing the numerical area (ha) does not alter the GIS map polygon. Please update the GIS shape if physical boundaries changed.
                      </div>
                    )}

                    {parcelErrors[parcel.id] && (
                      <small className="edit-farmer-parcel-error">
                        {parcelErrors[parcel.id]}
                      </small>
                    )}
                    <small className="edit-farmer-parcel-location">
                      Location: {parcel.farm_location_barangay || "N/A"},{" "}
                      {parcel.farm_location_municipality || "N/A"}
                    </small>
                  </div>

                  <div className="edit-farmer-form-group">
                    <label>Currently farming this parcel?</label>
                    <select
                      value={
                        parcel.is_farming === true
                          ? "true"
                          : parcel.is_farming === false
                            ? "false"
                            : ""
                      }
                      onChange={(e) => {
                        const n =
                          e.target.value === "true"
                            ? true
                            : e.target.value === "false"
                              ? false
                              : null;
                        handleIndividualParcelChange(parcel.id, "is_farming", n);
                        if (n !== false) {
                          handleIndividualParcelChange(
                            parcel.id,
                            "farming_status_reason",
                            null,
                          );
                        }
                      }}
                      className="edit-farmer-select"
                    >
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>

                  {parcel.is_farming === false && (
                    <div className="edit-farmer-form-group">
                      <label>Reason for not farming this parcel:</label>
                      <input
                        type="text"
                        value={parcel.farming_status_reason || ""}
                        onChange={(e) =>
                          handleIndividualParcelChange(
                            parcel.id,
                            "farming_status_reason",
                            e.target.value,
                          )
                        }
                        placeholder="e.g. Land left idle, financial constraints..."
                        className="edit-farmer-reason-input"
                      />
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="edit-farmer-no-parcels">
                No individual parcel records found for this farmer.
              </p>
            )}
          </div>
        </div>

        <div className="edit-farmer-modal-footer">
          <button
            type="button"
            className="edit-farmer-btn-cancel"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="edit-farmer-btn-save"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};
