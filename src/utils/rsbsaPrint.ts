import { getFarmParcels, getLandPlots, getRsbsaSubmissionById } from "../api";

export interface PrintRsbsaRequest {
  farmerId: string;
  fallbackReferenceNumber?: string;
  fallbackFarmerName?: string;
}

export interface PrintRsbsaResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
  printedCount?: number;
  failedCount?: number;
}

interface ElectronPrintApi {
  printContent?: (
    htmlContent: string,
    options?: Record<string, unknown>,
  ) => Promise<{ success: boolean; error?: string }>;
}

interface NormalizedParcel {
  parcelNumber: string;
  barangay: string;
  municipality: string;
  totalFarmAreaHa: string;
  ownershipDocumentNo: string;
  withinAncestralDomain: string;
  agrarianReformBeneficiary: string;
  ownershipTypeRegisteredOwner: boolean;
  ownershipTypeTenant: boolean;
  ownershipTypeLessee: boolean;
  tenantLandOwnerName: string;
  lesseeLandOwnerName: string;
  geometry: SupportedGeometry | null;
}

interface NormalizedFarmerForm {
  referenceNumber: string;
  farmerName: string;
  farmerAddress: string;
  gender: string;
  dateOfBirth: string;
  age: string;
  mainLivelihood: string;
  farmingActivities: string[];
  dateSubmitted: string;
  parcels: NormalizedParcel[];
  profilePicture?: string | null;
}

type CoordinatePair = [number, number];

interface SupportedGeometry {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
}

interface LandPlotCandidate {
  ffrs_id?: string;
  ffrsId?: string;
  parcel_number?: string;
  parcelNumber?: string;
  barangay?: string;
  farm_location_barangay?: string;
  farmLocationBarangay?: string;
  first_name?: string;
  firstName?: string;
  surname?: string;
  last_name?: string;
  lastName?: string;
  geometry?: unknown;
}

const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const toSafeText = (value: unknown, fallback = "N/A") => {
  const text = String(value ?? "").trim();
  return text ? text : fallback;
};

const toNumericArea = (value: unknown): string => {
  const parsed = parseFloat(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
};

const formatDateValue = (value: unknown): string => {
  if (!value) return "N/A";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString();
};

const computeAge = (value: unknown): string => {
  if (!value) return "N/A";
  const birthDate = new Date(String(value));
  if (Number.isNaN(birthDate.getTime())) return "N/A";

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age >= 0 ? String(age) : "N/A";
};

const toYesNo = (value: unknown): string => {
  if (value === true || value === "Yes" || value === "yes") return "Yes";
  return "No";
};

const normalizeToken = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const normalizeParcelToken = (value: unknown): string => {
  const token = normalizeToken(value);
  if (!token || token === "n/a") return "";
  return token.replace(/\s+/g, "");
};

const parseSupportedGeometry = (raw: unknown): SupportedGeometry | null => {
  if (!raw) return null;

  let parsed: unknown = raw;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const candidate = parsed as Record<string, unknown>;
  if (candidate.type !== "Polygon" && candidate.type !== "MultiPolygon") {
    return null;
  }

  if (!Array.isArray(candidate.coordinates)) {
    return null;
  }

  return {
    type: candidate.type,
    coordinates: candidate.coordinates as number[][][] | number[][][][],
  };
};

// Scopes land_plots candidates down to ones verified to belong to this
// specific owner — by ffrs_id (skipping the "RSBSA-{id}" fallback pattern,
// which was never a real FFRS code to begin with), or by first+last name
// as a fallback. Deliberately does NOT fall back to the whole municipality's
// land_plots table: a parcel_number/barangay match against an unrelated
// owner's plot is not a match, it's a coincidence, and printing it would
// mean printing someone else's land. Better to show "No geometry" than a
// wrong shape — especially once a parcel has been transferred and its
// original plot may still carry the previous owner's identity.
const findOwnerVerifiedPlots = (
  landPlots: LandPlotCandidate[],
  referenceNumber: string,
  firstName: string,
  surname: string,
): LandPlotCandidate[] => {
  const referenceToken = normalizeToken(referenceNumber);
  const isFallbackReference = referenceToken.startsWith("rsbsa-");

  if (referenceToken && !isFallbackReference) {
    const ffrsMatches = landPlots.filter((plot) => {
      const plotReference = normalizeToken(plot.ffrs_id || plot.ffrsId);
      return plotReference && plotReference === referenceToken;
    });
    if (ffrsMatches.length > 0) return ffrsMatches;
  }

  const firstNameToken = normalizeToken(firstName);
  const surnameToken = normalizeToken(surname);
  if (!firstNameToken || !surnameToken) return [];

  return landPlots.filter((plot) => {
    const plotFirstName = normalizeToken(plot.first_name || plot.firstName);
    const plotSurname = normalizeToken(
      plot.surname || plot.last_name || plot.lastName,
    );
    return plotFirstName === firstNameToken && plotSurname === surnameToken;
  });
};

const findParcelGeometry = (
  parcel: NormalizedParcel,
  ownerVerifiedPlots: LandPlotCandidate[],
): SupportedGeometry | null => {
  const parcelToken = normalizeParcelToken(parcel.parcelNumber);
  const barangayToken = normalizeToken(parcel.barangay);

  const findInList = (
    requireParcel: boolean,
    requireBarangay: boolean,
  ): SupportedGeometry | null => {
    for (const plot of ownerVerifiedPlots) {
      const plotParcelToken = normalizeParcelToken(
        plot.parcel_number || plot.parcelNumber,
      );
      const plotBarangayToken = normalizeToken(
        plot.barangay ||
          plot.farm_location_barangay ||
          plot.farmLocationBarangay,
      );

      if (requireParcel && (!parcelToken || plotParcelToken !== parcelToken)) {
        continue;
      }
      if (
        requireBarangay &&
        (!barangayToken || plotBarangayToken !== barangayToken)
      ) {
        continue;
      }

      const parsedGeometry = parseSupportedGeometry(plot.geometry);
      if (parsedGeometry) return parsedGeometry;
    }

    return null;
  };

  return (
    findInList(true, true) ||
    findInList(true, false) ||
    findInList(false, true) ||
    parcel.geometry ||
    null
  );
};

const renderParcelGeometryCard = (
  parcel: NormalizedParcel,
  index: number,
  formIndex: number,
): string => {
  const parcelLabel = parcel.parcelNumber || String(index + 1);
  const mapId = `print-map-${formIndex}-${index}`;

  const geometryHtml = parcel.geometry
    ? `
      <div id="${mapId}" class="parcel-print-map" style="width: 100%; height: 150px; z-index: 1; background: #ddd;"></div>
      <script>
        window.printMaps = window.printMaps || [];
        window.printMaps.push({
          id: "${mapId}",
          geometry: ${JSON.stringify(parcel.geometry)}
        });
      </script>
    `
    : null;

  return `
    <div class="parcel-geometry-card">
      <div class="parcel-geometry-title">Parcel ${escapeHtml(parcelLabel)}</div>
      <div class="parcel-geometry-box" style="padding: 0; overflow: hidden; position: relative;">
        ${geometryHtml || '<div class="parcel-geometry-empty">No geometry</div>'}
      </div>
    </div>
  `;
};

const deriveFarmerName = (
  submission: Record<string, any>,
  data: Record<string, any>,
  fallbackName?: string,
) => {
  if (submission.farmerName) return toSafeText(submission.farmerName);
  if (data.farmerName) return toSafeText(data.farmerName);

  const surname = data.surname || data.lastName || data["LAST NAME"] || "";
  const firstName = data.firstName || data["FIRST NAME"] || "";
  const middleName = data.middleName || data["MIDDLE NAME"] || "";
  const extName = data.extName || data.extensionName || data["EXT NAME"] || "";
  const assembled = [surname, firstName, middleName, extName]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ");

  if (assembled) return assembled;
  return toSafeText(fallbackName);
};

const deriveActivities = (data: Record<string, any>): string[] => {
  const activities: string[] = [];

  if (data.farmerRice || data.FARMER_RICE || data.farmer_rice) {
    activities.push("Rice");
  }
  if (data.farmerCorn || data.FARMER_CORN || data.farmer_corn) {
    activities.push("Corn");
  }
  if (
    data.farmerOtherCrops ||
    data.FARMER_OTHER_CROPS ||
    data.farmer_other_crops
  ) {
    const text =
      data.farmerOtherCropsText ||
      data.FARMER_OTHER_CROPS_TEXT ||
      data.farmer_other_crops_text ||
      "";
    activities.push(text ? `Other Crops: ${text}` : "Other Crops");
  }
  if (data.farmerLivestock || data.FARMER_LIVESTOCK || data.farmer_livestock) {
    const text =
      data.farmerLivestockText ||
      data.FARMER_LIVESTOCK_TEXT ||
      data.farmer_livestock_text ||
      "";
    activities.push(text ? `Livestock: ${text}` : "Livestock");
  }
  if (data.farmerPoultry || data.FARMER_POULTRY || data.farmer_poultry) {
    const text =
      data.farmerPoultryText ||
      data.FARMER_POULTRY_TEXT ||
      data.farmer_poultry_text ||
      "";
    activities.push(text ? `Poultry: ${text}` : "Poultry");
  }

  return activities;
};

const mapParcel = (
  parcel: Record<string, any>,
  fallbackNumber: string,
): NormalizedParcel => ({
  parcelNumber: toSafeText(
    parcel.parcel_number || parcel.parcelNumber,
    fallbackNumber,
  ),
  barangay: toSafeText(
    parcel.farm_location_barangay || parcel.farmLocationBarangay,
  ),
  municipality: toSafeText(
    parcel.farm_location_municipality || parcel.farmLocationMunicipality,
    "Dumangas",
  ),
  totalFarmAreaHa: toNumericArea(
    parcel.total_farm_area_ha || parcel.totalFarmAreaHa,
  ),
  ownershipDocumentNo: toSafeText(
    parcel.ownership_document_no || parcel.ownershipDocumentNo,
    "N/A",
  ),
  withinAncestralDomain: toYesNo(
    parcel.within_ancestral_domain || parcel.withinAncestralDomain,
  ),
  agrarianReformBeneficiary: toYesNo(
    parcel.agrarian_reform_beneficiary || parcel.agrarianReformBeneficiary,
  ),
  ownershipTypeRegisteredOwner: Boolean(
    parcel.ownership_type_registered_owner ||
    parcel.ownershipTypeRegisteredOwner,
  ),
  ownershipTypeTenant: Boolean(
    parcel.ownership_type_tenant || parcel.ownershipTypeTenant,
  ),
  ownershipTypeLessee: Boolean(
    parcel.ownership_type_lessee || parcel.ownershipTypeLessee,
  ),
  tenantLandOwnerName: toSafeText(
    parcel.tenant_land_owner_name || parcel.tenantLandOwnerName,
    "",
  ),
  lesseeLandOwnerName: toSafeText(
    parcel.lessee_land_owner_name || parcel.lesseeLandOwnerName,
    "",
  ),
  geometry: parseSupportedGeometry(parcel.geometry),
});

const normalizeFormData = (
  submissionRecord: Record<string, any>,
  parcels: Record<string, any>[],
  request: PrintRsbsaRequest,
  landPlots: LandPlotCandidate[],
): NormalizedFarmerForm => {
  const data = submissionRecord.data || submissionRecord;

  const mainLivelihood =
    data.mainLivelihood ||
    data["MAIN LIVELIHOOD"] ||
    data.main_livelihood ||
    "N/A";
  const activities = deriveActivities(data);

  let normalizedParcels = parcels.map((parcel, index) =>
    mapParcel(parcel, String(index + 1)),
  );

  if (normalizedParcels.length === 0) {
    const farmLocation = String(
      data.farmLocation || data["FARM LOCATION"] || "",
    );
    const parts = farmLocation.split(",").map((part) => part.trim());

    normalizedParcels = [
      {
        parcelNumber: "1",
        barangay: toSafeText(parts[0] || data.barangay || data["BARANGAY"]),
        municipality: toSafeText(
          parts[1] || data.municipality || data["MUNICIPALITY"],
          "Dumangas",
        ),
        totalFarmAreaHa: toNumericArea(
          data.totalFarmArea ||
            data["TOTAL FARM AREA"] ||
            data.parcelArea ||
            data["PARCEL AREA"],
        ),
        ownershipDocumentNo: toSafeText(data.ownershipDocumentNo, "N/A"),
        withinAncestralDomain: toYesNo(data.withinAncestralDomain),
        agrarianReformBeneficiary: toYesNo(data.agrarianReformBeneficiary),
        ownershipTypeRegisteredOwner: Boolean(
          data.ownershipType?.registeredOwner ||
          data["OWNERSHIP_TYPE_REGISTERED_OWNER"],
        ),
        ownershipTypeTenant: Boolean(
          data.ownershipType?.tenant || data["OWNERSHIP_TYPE_TENANT"],
        ),
        ownershipTypeLessee: Boolean(
          data.ownershipType?.lessee || data["OWNERSHIP_TYPE_LESSEE"],
        ),
        tenantLandOwnerName: "",
        lesseeLandOwnerName: "",
        geometry: null,
      },
    ];
  }

  const genderValue =
    data.gender ||
    data.sex ||
    data["GENDER"] ||
    submissionRecord.gender ||
    "N/A";

  const referenceNumber = toSafeText(
    submissionRecord.referenceNumber ||
      data.referenceNumber ||
      data.ffrsId ||
      data.ffrs_id ||
      request.fallbackReferenceNumber,
    "N/A",
  );

  const ownerVerifiedPlots = findOwnerVerifiedPlots(
    landPlots,
    referenceNumber,
    data.firstName || data["FIRST NAME"] || "",
    data.surname || data.lastName || data["LAST NAME"] || "",
  );

  const parcelsWithGeometry = normalizedParcels.map((parcel) => ({
    ...parcel,
    geometry: findParcelGeometry(parcel, ownerVerifiedPlots),
  }));

  const profilePicture =
    submissionRecord.profilePicture ||
    submissionRecord.profile_picture ||
    data.profilePicture ||
    data.profile_picture ||
    data.profile_pic ||
    data.profilePic ||
    null;

  return {
    referenceNumber,
    farmerName: deriveFarmerName(
      submissionRecord,
      data,
      request.fallbackFarmerName,
    ),
    farmerAddress: toSafeText(
      submissionRecord.farmerAddress ||
        data.farmerAddress ||
        [
          data.barangay || data["BARANGAY"],
          data.municipality || data["MUNICIPALITY"],
        ]
          .filter(Boolean)
          .join(", "),
      "N/A",
    ),
    gender: toSafeText(genderValue),
    dateOfBirth: formatDateValue(
      data.dateOfBirth || data.birthdate || data["BIRTHDATE"],
    ),
    age: computeAge(data.dateOfBirth || data.birthdate || data["BIRTHDATE"]),
    mainLivelihood: toSafeText(mainLivelihood),
    farmingActivities: activities,
    dateSubmitted: formatDateValue(
      submissionRecord.dateSubmitted ||
        submissionRecord.submitted_at ||
        submissionRecord.created_at,
    ),
    parcels: parcelsWithGeometry,
    profilePicture,
  };
};

const parcelOwnershipText = (parcel: NormalizedParcel): string => {
  if (parcel.ownershipTypeRegisteredOwner) return "Registered Owner";

  if (parcel.ownershipTypeTenant || parcel.ownershipTypeLessee) {
    const ownerName =
      String(parcel.tenantLandOwnerName || "").trim() ||
      String(parcel.lesseeLandOwnerName || "").trim();
    const roleLabel =
      parcel.ownershipTypeTenant && parcel.ownershipTypeLessee
        ? "Tenant + Lessee"
        : parcel.ownershipTypeTenant
          ? "Tenant"
          : "Lessee";

    return ownerName ? `${roleLabel} (Owner: ${ownerName})` : roleLabel;
  }

  return "N/A";
};

const renderFarmerFormSection = (
  form: NormalizedFarmerForm,
  index: number,
): string => {
  const activityText =
    form.farmingActivities.length > 0
      ? form.farmingActivities.join(", ")
      : form.mainLivelihood;

  const parcelsHtml = form.parcels
    .map(
      (parcel) => `
        <tr>
          <td>${escapeHtml(parcel.parcelNumber)}</td>
          <td>${escapeHtml(parcel.barangay)}</td>
          <td>${escapeHtml(parcel.municipality)}</td>
          <td>${escapeHtml(parcel.totalFarmAreaHa)} ha</td>
          <td>${escapeHtml(parcel.ownershipDocumentNo)}</td>
          <td>${escapeHtml(parcel.withinAncestralDomain)}</td>
          <td>${escapeHtml(parcel.agrarianReformBeneficiary)}</td>
          <td>${escapeHtml(parcelOwnershipText(parcel))}</td>
        </tr>
      `,
    )
    .join("");

  const parcelGeometryHtml = form.parcels
    .map((parcel, parcelIndex) =>
      renderParcelGeometryCard(parcel, parcelIndex, index),
    )
    .join("");

  const photoHtml = form.profilePicture
    ? `<div class="farmer-photo-frame">
         <img src="${escapeHtml(form.profilePicture)}" alt="Farmer Profile Picture" class="farmer-photo-img" />
       </div>`
    : `<div class="farmer-photo-frame farmer-photo-placeholder">
         <span class="photo-box-label">2" x 2"</span>
         <span class="photo-box-sub">ID PHOTO</span>
       </div>`;

  return `
    <section class="page ${index > 0 ? "page-break" : ""}">
      <header class="head">
        <div class="head-left">
          <h1>RSBSA Enrollment Form</h1>
          <p>Registry System for Basic Sectors in Agriculture</p>
        </div>
        <div class="head-right">
          ${photoHtml}
          <div class="ref-block">
            <strong>Reference No.</strong>
            <span>${escapeHtml(form.referenceNumber)}</span>
          </div>
        </div>
      </header>

      <h2>Personal Information</h2>
      <div class="grid two">
        <div><strong>Farmer Name:</strong> ${escapeHtml(form.farmerName)}</div>
        <div><strong>Gender:</strong> ${escapeHtml(form.gender)}</div>
        <div><strong>Date of Birth:</strong> ${escapeHtml(form.dateOfBirth)}</div>
        <div><strong>Age:</strong> ${escapeHtml(form.age)}</div>
        <div class="full"><strong>Address:</strong> ${escapeHtml(form.farmerAddress)}</div>
      </div>

      <h2>Livelihood</h2>
      <div class="grid one">
        <div><strong>Main Livelihood:</strong> ${escapeHtml(form.mainLivelihood)}</div>
        <div><strong>Activities:</strong> ${escapeHtml(activityText)}</div>
      </div>

      <h2>Farm Parcels</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Barangay</th>
            <th>Municipality</th>
            <th>Area</th>
            <th>Ownership Doc No.</th>
            <th>Ancestral Domain</th>
            <th>ARB</th>
            <th>Ownership Type</th>
          </tr>
        </thead>
        <tbody>
          ${parcelsHtml}
        </tbody>
      </table>

      <h2>Parcel Geometry</h2>
      <div class="parcel-geometry-grid">
        ${parcelGeometryHtml}
      </div>

      <div class="declaration">
        I hereby declare that all information above are true and correct and may be used by the Department of Agriculture for RSBSA registration and related lawful purposes.
      </div>

      <div class="signature-grid">
        <div><span>Date</span></div>
        <div><span>Printed Name of Applicant</span></div>
        <div><span>Signature of Applicant</span></div>
      </div>

      <footer>
        <div>Submitted: ${escapeHtml(form.dateSubmitted)}</div>
        <div>THIS FORM IS NOT FOR SALE</div>
      </footer>
    </section>
  `;
};

const buildFormsDocument = (forms: NormalizedFarmerForm[]): string => {
  const sections = forms
    .map((form, index) => renderFarmerFormSection(form, index))
    .join("\n");

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>RSBSA Simplified Forms</title>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: "Source Sans 3", Arial, sans-serif;
            background: #d7d9dc;
            padding: 18px;
            color: #1a1a1a;
          }
          .print-toolbar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 9999;
            background: #214a37;
            color: #fff;
            padding: 10px 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
          }
          .print-toolbar-title {
            font-size: 13px;
            font-weight: 700;
          }
          .print-toolbar-actions {
            display: flex;
            gap: 8px;
          }
          .print-toolbar button {
            border: none;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 700;
            padding: 8px 12px;
            cursor: pointer;
          }
          .print-toolbar .print-btn {
            background: #ffffff;
            color: #214a37;
          }
          .print-toolbar .close-btn {
            background: #9e1f1f;
            color: #fff;
          }
          .print-content {
            margin-top: 58px;
          }
          .page {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto 20px;
            padding: 8mm;
            background: #fff;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.14);
          }
          .head {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border: 2px solid #202020;
            padding: 8px 12px;
            margin-bottom: 10px;
          }
          .head-left {
            flex: 1;
          }
          .head-right {
            display: flex;
            align-items: center;
            gap: 14px;
          }
          .farmer-photo-frame {
            width: 22mm;
            height: 22mm;
            border: 1.5px solid #202020;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #fafafa;
            overflow: hidden;
            flex-shrink: 0;
          }
          .farmer-photo-placeholder {
            border: 1.5px dashed #444;
            background: #f4f5f6;
            color: #555;
            text-align: center;
            padding: 2px;
          }
          .photo-box-label {
            font-size: 9px;
            font-weight: 700;
            color: #214a37;
            line-height: 1.1;
          }
          .photo-box-sub {
            font-size: 7.5px;
            font-weight: 600;
            letter-spacing: 0.3px;
            color: #666;
            margin-top: 2px;
          }
          .farmer-photo-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
          }
          .head h1 {
            margin: 0;
            font-size: 21px;
          }
          .head p {
            margin: 2px 0 0;
            font-size: 11px;
            color: #464646;
          }
          .ref-block {
            text-align: right;
            font-size: 12px;
          }
          .ref-block span {
            display: block;
            margin-top: 3px;
            font-weight: 700;
            font-size: 13px;
          }
          h2 {
            margin: 9px 0 0;
            font-size: 12px;
            color: #fff;
            background: #214a37;
            padding: 4px 8px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
          }
          .grid {
            border: 1px solid #222;
            border-top: none;
            padding: 8px;
            display: grid;
            gap: 6px;
            font-size: 12px;
          }
          .grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .grid.one { grid-template-columns: minmax(0, 1fr); }
          .grid .full { grid-column: 1 / -1; }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            border: 1px solid #222;
            border-top: none;
          }
          th, td {
            border: 1px solid #222;
            padding: 5px;
            vertical-align: top;
          }
          th {
            background: #f1f3f4;
            font-weight: 700;
            text-align: left;
          }
          .parcel-geometry-grid {
            border: 1px solid #222;
            border-top: none;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
            padding: 8px;
          }
          .parcel-geometry-card {
            border: 1px solid #a3adb3;
            border-radius: 4px;
            padding: 6px;
            break-inside: avoid;
            background: #fbfcfd;
          }
          .parcel-geometry-title {
            font-size: 11px;
            font-weight: 700;
            color: #214a37;
            margin-bottom: 6px;
          }
          .parcel-geometry-box {
            border: 1px solid #22313a;
            min-height: 146px;
            background: repeating-linear-gradient(
              45deg,
              #f7f8fa,
              #f7f8fa 6px,
              #edf0f2 6px,
              #edf0f2 12px
            );
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 4px;
          }
          .parcel-footprint-svg {
            width: 100%;
            height: 100%;
          }
          .leaflet-control-container { display: none !important; }
          .parcel-geometry-empty {
            color: #4f5660;
            font-size: 11px;
            font-style: italic;
            font-weight: 600;
            text-align: center;
          }
          .declaration {
            border: 1px solid #222;
            border-top: none;
            padding: 8px;
            font-size: 11px;
            font-style: italic;
            line-height: 1.45;
          }
          .signature-grid {
            border: 1px solid #222;
            border-top: none;
            display: grid;
            grid-template-columns: 1fr 1.5fr 1.5fr;
            min-height: 58px;
            gap: 0;
          }
          .signature-grid > div {
            border-right: 1px solid #222;
            display: flex;
            align-items: end;
            justify-content: center;
            padding: 5px;
            font-size: 10px;
            font-weight: 700;
          }
          .signature-grid > div:last-child { border-right: none; }
          .signature-grid span {
            border-top: 1px solid #222;
            width: 100%;
            text-align: center;
            padding-top: 3px;
          }
          footer {
            border: 1px solid #222;
            border-top: none;
            padding: 6px 8px;
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            font-weight: 700;
          }
          .page-break { page-break-before: always; }
          @media print {
            body { background: #fff; padding: 0; }
            .print-toolbar { display: none !important; }
            .print-content { margin-top: 0; }
            .page {
              width: 100%;
              min-height: auto;
              margin: 0;
              box-shadow: none;
              page-break-after: always;
            }
            .parcel-geometry-card {
              break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-toolbar">
          <div class="print-toolbar-title">RSBSA Print Preview</div>
          <div class="print-toolbar-actions">
            <button class="print-btn" onclick="triggerPrint()">Print</button>
            <button class="close-btn" onclick="closePreview()">Close</button>
          </div>
        </div>
        <div class="print-content">
          ${sections}
        </div>
        <script>
          function initMaps() {
            if (!window.printMaps || !window.printMaps.length) return;
            
            window.printMaps.forEach(function(item) {
              var map = L.map(item.id, {
                zoomControl: false,
                attributionControl: false,
                dragging: false,
                scrollWheelZoom: false,
                doubleClickZoom: false,
                boxZoom: false,
                keyboard: false
              });
              
              // Add Satellite Hybrid Layers
              L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                maxZoom: 19
              }).addTo(map);
              
              L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
                maxZoom: 19
              }).addTo(map);
              
              L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
                maxZoom: 19
              }).addTo(map);
              
              var geojsonFeature = {
                type: "Feature",
                geometry: item.geometry
              };
              
              var geojsonLayer = L.geoJSON(geojsonFeature, {
                style: function() {
                  return {
                    color: '#3b82f6', // blue polygonal lines
                    weight: 3,
                    opacity: 1,
                    fillColor: '#60a5fa', // lighter blue fill
                    fillOpacity: 0.3
                  };
                },
                pointToLayer: function(geoJsonPoint, latlng) {
                  return L.circleMarker(latlng, {
                    radius: 4,
                    fillColor: '#3b82f6',
                    color: '#fff',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                  });
                },
                onEachFeature: function(feature, layer) {
                  if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
                    // Add dots on vertices
                    var coords = feature.geometry.type === 'Polygon' 
                      ? feature.geometry.coordinates[0] 
                      : feature.geometry.coordinates[0][0];
                      
                    coords.forEach(function(coord) {
                      L.circleMarker([coord[1], coord[0]], {
                        radius: 4,
                        fillColor: '#1d4ed8', // dark blue dot
                        color: '#fff',
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 1
                      }).addTo(map);
                    });
                  }
                }
              }).addTo(map);
              
              map.fitBounds(geojsonLayer.getBounds(), { padding: [10, 10] });
            });
          }

          let hasAutoPrinted = false;
          function triggerPrint() {
            window.focus();
            window.print();
          }

          function closePreview() {
            window.close();
          }

          window.addEventListener("load", () => {
            initMaps();
            if (hasAutoPrinted) return;
            hasAutoPrinted = true;
            // Wait longer for tiles to load completely before printing
            setTimeout(() => {
              triggerPrint();
            }, 1500);
          });
        </script>
      </body>
    </html>
  `;
};

const canUseElectronPrint = (): boolean => {
  const electronApi = (window as Window & { electron?: ElectronPrintApi })
    .electron;
  return Boolean(electronApi?.printContent);
};

const reserveBrowserPrintPreview = (): Window | null => {
  try {
    const reservedWindow = window.open("", "_blank");
    if (!reservedWindow) return null;

    reservedWindow.document.write(`
      <html>
        <head><title>Preparing RSBSA print preview...</title></head>
        <body style="font-family: Arial, sans-serif; padding: 24px;">
          <h3>Preparing RSBSA print preview...</h3>
          <p>Please wait while your forms are being prepared.</p>
        </body>
      </html>
    `);
    reservedWindow.document.close();
    return reservedWindow;
  } catch {
    return null;
  }
};

const closeReservedWindow = (reservedWindow: Window | null | undefined) => {
  if (!reservedWindow || reservedWindow.closed) return;
  try {
    reservedWindow.close();
  } catch {
    // Ignore close errors from browser policies/extensions.
  }
};

const openBrowserPrintPreview = (
  html: string,
  reservedWindow?: Window | null,
): boolean => {
  const printWindow =
    reservedWindow && !reservedWindow.closed
      ? reservedWindow
      : window.open("", "_blank");
  if (!printWindow) {
    return false;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  return true;
};

const printHtmlDocument = async (
  html: string,
  reservedWindow?: Window | null,
): Promise<PrintRsbsaResult> => {
  const electronApi = (window as Window & { electron?: ElectronPrintApi })
    .electron;

  if (electronApi?.printContent) {
    try {
      const result = await electronApi.printContent(html);
      if (result.success) {
        return { success: true };
      }

      if (result.error === "cancelled") {
        return { success: false, cancelled: true };
      }
    } catch (error) {
      console.error(
        "Electron printContent failed, falling back to browser print:",
        error,
      );
    }
  }

  const opened = openBrowserPrintPreview(html, reservedWindow);
  if (!opened) {
    closeReservedWindow(reservedWindow);
    return {
      success: false,
      error: "Please allow popups to print the RSBSA form preview.",
    };
  }

  return { success: true };
};

const fetchLandPlotCandidates = async (): Promise<LandPlotCandidate[]> => {
  try {
    const landPlotsResponse = await getLandPlots();
    if (landPlotsResponse.error || !Array.isArray(landPlotsResponse.data)) {
      return [];
    }

    return landPlotsResponse.data as LandPlotCandidate[];
  } catch {
    return [];
  }
};

const fetchNormalizedForm = async (
  request: PrintRsbsaRequest,
  landPlots: LandPlotCandidate[],
): Promise<NormalizedFarmerForm> => {
  const submissionResponse = await getRsbsaSubmissionById(request.farmerId);
  if (submissionResponse.error) {
    throw new Error(
      submissionResponse.error || "Failed to fetch farmer details.",
    );
  }

  const submissionRecord = submissionResponse.data || {};

  const parcelsResponse = await getFarmParcels(request.farmerId, {
    currentOwnerOnly: true,
  });
  const parcels = parcelsResponse.error ? [] : parcelsResponse.data || [];

  return normalizeFormData(submissionRecord, parcels, request, landPlots);
};

export const printRsbsaFormById = async (
  request: PrintRsbsaRequest,
): Promise<PrintRsbsaResult> => {
  const reservedWindow = canUseElectronPrint()
    ? null
    : reserveBrowserPrintPreview();

  try {
    const landPlots = await fetchLandPlotCandidates();
    const form = await fetchNormalizedForm(request, landPlots);
    const html = buildFormsDocument([form]);
    const printResult = await printHtmlDocument(html, reservedWindow);
    return {
      ...printResult,
      printedCount: printResult.success ? 1 : 0,
      failedCount: printResult.success ? 0 : 1,
    };
  } catch (error) {
    closeReservedWindow(reservedWindow);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to prepare RSBSA print form.",
      printedCount: 0,
      failedCount: 1,
    };
  }
};

export interface GeometryStatusRow {
  id: string;
  farmerName: string;
  referenceNumber: string;
  barangay: string;
  totalParcels: number;
  plottedParcels: number;
}

export interface PrintGeometryStatusReportOptions {
  rows: GeometryStatusRow[];
  filterLabel?: string;
  printedBy?: string;
}

const buildGeometryStatusDocument = (
  options: PrintGeometryStatusReportOptions,
): string => {
  const { rows, filterLabel, printedBy } = options;

  const finished = rows.filter(
    (row) => row.totalParcels > 0 && row.plottedParcels >= row.totalParcels,
  );
  const inProgress = rows.filter(
    (row) => row.totalParcels <= 0 || row.plottedParcels < row.totalParcels,
  );

  const groupByBarangay = (list: GeometryStatusRow[]) => {
    const groups = new Map<string, GeometryStatusRow[]>();
    list.forEach((row) => {
      const key = toSafeText(row.barangay, "No Barangay");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    });
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([barangay, groupRows]) => ({
        barangay,
        rows: [...groupRows].sort((a, b) =>
          a.farmerName.localeCompare(b.farmerName),
        ),
      }));
  };

  const renderSection = (
    heading: string,
    statusLabel: string,
    list: GeometryStatusRow[],
    showRatio: boolean,
    headerColor: string,
  ): string => {
    if (list.length === 0) {
      return `
        <div class="section">
          <div class="section-heading" style="background:${headerColor};">${escapeHtml(heading)} <span class="section-count">(0)</span></div>
          <p class="section-empty">None.</p>
        </div>
      `;
    }

    const groups = groupByBarangay(list);

    const groupsHtml = groups
      .map((group) => {
        const rowsHtml = group.rows
          .map(
            (row, i) => `
            <tr class="${i % 2 === 0 ? "row-even" : "row-odd"}">
              <td>${escapeHtml(toSafeText(row.farmerName))}</td>
              <td>${escapeHtml(toSafeText(row.referenceNumber))}</td>
              ${showRatio ? `<td class="center">${escapeHtml(String(Math.max(0, row.plottedParcels)))}/${escapeHtml(String(Math.max(0, row.totalParcels)))}</td>` : ""}
              <td class="center status-${showRatio ? "progress" : "done"}">${escapeHtml(statusLabel)}</td>
            </tr>
          `,
          )
          .join("");

        return `
          <div class="barangay-group">
            <div class="barangay-label">${escapeHtml(group.barangay)} <span class="barangay-count">(${group.rows.length})</span></div>
            <table>
              <colgroup>
                <col style="width:38%">
                <col style="width:28%">
                ${showRatio ? '<col style="width:14%">' : ""}
                <col style="width:${showRatio ? "20%" : "34%"}">
              </colgroup>
              <thead>
                <tr>
                  <th>Farmer Name</th>
                  <th>Reference No.</th>
                  ${showRatio ? '<th class="center">Parcels Plotted</th>' : ""}
                  <th class="center">Status</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        `;
      })
      .join("");

    return `
      <div class="section">
        <div class="section-heading" style="background:${headerColor};">${escapeHtml(heading)} <span class="section-count">(${list.length})</span></div>
        ${groupsHtml}
      </div>
    `;
  };

  const generatedOn = new Date().toLocaleString();

  return `
    <html>
      <head>
        <title>Parcel Geometry Status Report</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          @page {
            size: portrait;
            margin: 0mm;
          }
          body {
            font-family: Arial, sans-serif;
            font-size: 9px;
            color: #1e293b;
            line-height: 1.4;
            padding: 12mm;
            background: #fff;
          }

          /* Official Header */
          .hdr {
            text-align: center;
            border-bottom: 2px solid #059669;
            padding-bottom: 8px;
            margin-bottom: 12px;
          }
          .hdr .republic { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; }
          .hdr .dept     { font-size: 12px; font-weight: 700; color: #1e3a8a; margin: 2px 0; }
          .hdr .agency   { font-size: 9px; font-weight: 600; color: #475569; }
          .hdr .report-title { font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
          .hdr .location { font-size: 10px; font-weight: 600; color: #64748b; }

          /* Meta / Filter Bar */
          .meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            font-size: 8px;
            color: #64748b;
            font-weight: 500;
          }
          .meta span {
            background: #f1f5f9;
            padding: 2px 6px;
            border-radius: 4px;
          }

          /* Summary Pills */
          .summary-pills {
            display: flex;
            gap: 10px;
            justify-content: center;
            margin-bottom: 14px;
          }
          .pill {
            display: flex;
            flex-direction: column;
            align-items: center;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 4px 14px;
            min-width: 70px;
          }
          .pill .pill-num { font-size: 14px; font-weight: 800; color: #0f172a; }
          .pill .pill-lbl { font-size: 7.5px; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; }
          .pill.done   { border-color: #059669; }
          .pill.done .pill-num { color: #059669; }
          .pill.prog   { border-color: #d97706; }
          .pill.prog .pill-num { color: #d97706; }

          /* Sections */
          .section { margin-bottom: 16px; page-break-inside: avoid; }
          .section-heading {
            font-size: 10px;
            font-weight: 700;
            color: #fff;
            padding: 4px 8px;
            border-radius: 3px 3px 0 0;
            margin-bottom: 0;
          }
          .section-count { font-weight: 500; opacity: 0.85; }
          .section-empty {
            font-size: 9px;
            color: #6b7280;
            font-style: italic;
            padding: 6px 8px;
            border: 1px solid #e2e8f0;
            border-top: none;
          }

          /* Barangay Groups */
          .barangay-group { margin-bottom: 10px; page-break-inside: avoid; }
          .barangay-label {
            font-size: 9px;
            font-weight: 700;
            background: #f1f5f9;
            border: 1px solid #e2e8f0;
            padding: 3px 8px;
            border-bottom: none;
            color: #334155;
          }
          .barangay-count { font-weight: 500; color: #64748b; }

          /* Tables */
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8px;
            table-layout: fixed;
          }
          th {
            background: #059669;
            color: #fff;
            padding: 3px 6px;
            text-align: left;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            border: 0.5px solid #d1fae5;
          }
          td {
            padding: 3px 6px;
            border: 0.5px solid #e2e8f0;
            vertical-align: top;
            color: #334155;
            word-break: break-word;
          }
          .row-even td { background: #fff; }
          .row-odd td  { background: #f8fafc; }
          .center { text-align: center; }

          /* Status labels */
          .status-done     { color: #059669; font-weight: 700; }
          .status-progress { color: #d97706; font-weight: 700; }

          /* Footer */
          .ftr {
            margin-top: 16px;
            font-size: 8px;
            color: #94a3b8;
            text-align: center;
            border-top: 1px solid #e2e8f0;
            padding-top: 6px;
          }
        </style>
      </head>
      <body>
        <div class="hdr">
          <div class="republic">Republic of the Philippines</div>
          <div class="dept">Department of Agriculture</div>
          <div class="agency">Registry System for Basic Sectors in Agriculture (RSBSA)</div>
          <div class="report-title">Parcel Geometry Status Report</div>
          <div class="location">Municipality of Dumangas, Iloilo</div>
        </div>

        <div class="meta">
          <span>Filter: ${escapeHtml(filterLabel || "All Registered Owners")}</span>
          <span>Total: ${rows.length} records</span>
          <span>Generated: ${escapeHtml(generatedOn)}</span>
        </div>

        <div class="summary-pills">
          <div class="pill">
            <span class="pill-num">${rows.length}</span>
            <span class="pill-lbl">Total</span>
          </div>
          <div class="pill done">
            <span class="pill-num">${finished.length}</span>
            <span class="pill-lbl">Finished</span>
          </div>
          <div class="pill prog">
            <span class="pill-num">${inProgress.length}</span>
            <span class="pill-lbl">In Progress</span>
          </div>
        </div>

        ${renderSection("✅ Finished with Geometry", "Done", finished, true, "#059669")}
        ${renderSection("⏳ Still in Progress", "In Progress", inProgress, true, "#d97706")}

        <div class="ftr">
          Parcel Geometry Status Report &mdash; Dumangas, Iloilo &bull; Printed by ${escapeHtml(printedBy || "Technician")} &bull; ${escapeHtml(generatedOn)}
        </div>
        <script>
          window.addEventListener("load", () => {
            setTimeout(() => { window.focus(); window.print(); }, 300);
          });
        </script>
      </body>
    </html>
  `;
};

export const printGeometryStatusReport = async (
  options: PrintGeometryStatusReportOptions,
): Promise<PrintRsbsaResult> => {
  if (!options.rows || options.rows.length === 0) {
    return {
      success: false,
      error: "No records to print for the current view.",
      printedCount: 0,
      failedCount: 0,
    };
  }

  const reservedWindow = canUseElectronPrint()
    ? null
    : reserveBrowserPrintPreview();

  try {
    const html = buildGeometryStatusDocument(options);
    const printResult = await printHtmlDocument(html, reservedWindow);
    return {
      ...printResult,
      printedCount: printResult.success ? options.rows.length : 0,
      failedCount: printResult.success ? 0 : options.rows.length,
    };
  } catch (error) {
    closeReservedWindow(reservedWindow);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to prepare geometry status report.",
      printedCount: 0,
      failedCount: options.rows.length,
    };
  }
};

export const printRsbsaFormsByIds = async (
  requests: PrintRsbsaRequest[],
): Promise<PrintRsbsaResult> => {
  const reservedWindow = canUseElectronPrint()
    ? null
    : reserveBrowserPrintPreview();

  if (requests.length === 0) {
    closeReservedWindow(reservedWindow);
    return {
      success: false,
      error: "No records selected for printing.",
      printedCount: 0,
      failedCount: 0,
    };
  }

  const forms: NormalizedFarmerForm[] = [];
  let failedCount = 0;
  let firstError: string | undefined;
  const landPlots = await fetchLandPlotCandidates();

  const results = await Promise.all(
    requests.map(async (request) => {
      try {
        const form = await fetchNormalizedForm(request, landPlots);
        return { form };
      } catch (error) {
        return { error, farmerId: request.farmerId };
      }
    }),
  );

  for (const result of results) {
    if (result.form) {
      forms.push(result.form);
      continue;
    }

    failedCount += 1;
    if (!firstError) {
      firstError =
        result.error instanceof Error
          ? result.error.message
          : `Failed to fetch record ${result.farmerId}.`;
    }
  }

  if (forms.length === 0) {
    closeReservedWindow(reservedWindow);
    return {
      success: false,
      error: firstError || "No printable records were found.",
      printedCount: 0,
      failedCount,
    };
  }

  const html = buildFormsDocument(forms);
  const printResult = await printHtmlDocument(html, reservedWindow);

  if (!printResult.success) {
    return {
      ...printResult,
      printedCount: 0,
      failedCount: failedCount + forms.length,
      error: printResult.error || firstError,
    };
  }

  return {
    success: true,
    printedCount: forms.length,
    failedCount,
    error: firstError,
  };
};
