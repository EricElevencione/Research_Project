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

const geometryToRings = (geometry: SupportedGeometry): CoordinatePair[][] => {
  const rings: CoordinatePair[][] = [];

  if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates as number[][][]) {
      if (!Array.isArray(ring)) continue;
      const normalizedRing: CoordinatePair[] = ring
        .map((point) => {
          if (!Array.isArray(point) || point.length < 2) return null;
          const x = Number(point[0]);
          const y = Number(point[1]);
          if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
          return [x, y] as CoordinatePair;
        })
        .filter((point): point is CoordinatePair => point !== null);

      if (normalizedRing.length >= 3) {
        rings.push(normalizedRing);
      }
    }
  } else {
    for (const polygon of geometry.coordinates as number[][][][]) {
      if (!Array.isArray(polygon)) continue;
      for (const ring of polygon) {
        if (!Array.isArray(ring)) continue;
        const normalizedRing: CoordinatePair[] = ring
          .map((point) => {
            if (!Array.isArray(point) || point.length < 2) return null;
            const x = Number(point[0]);
            const y = Number(point[1]);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
            return [x, y] as CoordinatePair;
          })
          .filter((point): point is CoordinatePair => point !== null);

        if (normalizedRing.length >= 3) {
          rings.push(normalizedRing);
        }
      }
    }
  }

  return rings;
};

const findParcelGeometry = (
  parcel: NormalizedParcel,
  referenceNumber: string,
  landPlots: LandPlotCandidate[],
): SupportedGeometry | null => {
  if (landPlots.length === 0) return parcel.geometry || null;

  const parcelToken = normalizeParcelToken(parcel.parcelNumber);
  const barangayToken = normalizeToken(parcel.barangay);
  const referenceToken = normalizeToken(referenceNumber);

  const byReference =
    referenceToken && referenceToken !== "n/a"
      ? landPlots.filter((plot) => {
          const plotReference = normalizeToken(plot.ffrs_id || plot.ffrsId);
          return plotReference && plotReference === referenceToken;
        })
      : [];

  const findInList = (
    source: LandPlotCandidate[],
    requireParcel: boolean,
    requireBarangay: boolean,
  ): SupportedGeometry | null => {
    for (const plot of source) {
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
    findInList(byReference, true, true) ||
    findInList(byReference, true, false) ||
    findInList(byReference, false, true) ||
    findInList(landPlots, true, true) ||
    findInList(landPlots, true, false) ||
    findInList(landPlots, false, true) ||
    parcel.geometry ||
    null
  );
};

const renderGeometrySvg = (geometry: SupportedGeometry): string | null => {
  const rings = geometryToRings(geometry);
  if (rings.length === 0) return null;

  const points = rings.flat();
  const xValues = points.map((point) => point[0]);
  const yValues = points.map((point) => point[1]);

  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);

  const width = 220;
  const height = 140;
  const padding = 10;

  const spanX = Math.max(maxX - minX, Number.EPSILON);
  const spanY = Math.max(maxY - minY, Number.EPSILON);
  const scale = Math.min(
    (width - padding * 2) / spanX,
    (height - padding * 2) / spanY,
  );

  const scaledWidth = spanX * scale;
  const scaledHeight = spanY * scale;
  const offsetX = (width - scaledWidth) / 2;
  const offsetY = (height - scaledHeight) / 2;

  const pathData = rings
    .map((ring) => {
      const pointsPath = ring
        .map(([x, y], index) => {
          const mappedX = offsetX + (x - minX) * scale;
          const mappedY = offsetY + (maxY - y) * scale;
          const command = index === 0 ? "M" : "L";
          return `${command} ${mappedX.toFixed(2)} ${mappedY.toFixed(2)}`;
        })
        .join(" ");

      return `${pointsPath} Z`;
    })
    .join(" ");

  return `
    <svg class="parcel-footprint-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Parcel geometry footprint" preserveAspectRatio="xMidYMid meet">
      <path d="${pathData}" fill="rgba(33, 74, 55, 0.25)" stroke="#214a37" stroke-width="2" fill-rule="evenodd"></path>
    </svg>
  `;
};

const renderParcelGeometryCard = (
  parcel: NormalizedParcel,
  index: number,
): string => {
  const geometrySvg = parcel.geometry
    ? renderGeometrySvg(parcel.geometry)
    : null;
  const parcelLabel = parcel.parcelNumber || String(index + 1);

  return `
    <div class="parcel-geometry-card">
      <div class="parcel-geometry-title">Parcel ${escapeHtml(parcelLabel)}</div>
      <div class="parcel-geometry-box">
        ${geometrySvg || '<div class="parcel-geometry-empty">No geometry</div>'}
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

  const parcelsWithGeometry = normalizedParcels.map((parcel) => ({
    ...parcel,
    geometry: findParcelGeometry(parcel, referenceNumber, landPlots),
  }));

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
  };
};

const parcelOwnershipText = (parcel: NormalizedParcel): string => {
  const labels: string[] = [];
  if (parcel.ownershipTypeRegisteredOwner) labels.push("Registered Owner");
  if (parcel.ownershipTypeTenant) {
    labels.push(
      parcel.tenantLandOwnerName
        ? `Tenant (Owner: ${parcel.tenantLandOwnerName})`
        : "Tenant",
    );
  }
  if (parcel.ownershipTypeLessee) {
    labels.push(
      parcel.lesseeLandOwnerName
        ? `Lessee (Owner: ${parcel.lesseeLandOwnerName})`
        : "Lessee",
    );
  }
  return labels.length > 0 ? labels.join(" | ") : "N/A";
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
    .map((parcel, parcelIndex) => renderParcelGeometryCard(parcel, parcelIndex))
    .join("");

  return `
    <section class="page ${index > 0 ? "page-break" : ""}">
      <header class="head">
        <div>
          <h1>RSBSA Enrollment Form</h1>
          <p>Registry System for Basic Sectors in Agriculture</p>
        </div>
        <div class="ref-block">
          <strong>Reference No.</strong>
          <span>${escapeHtml(form.referenceNumber)}</span>
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
            align-items: flex-start;
            border: 2px solid #202020;
            padding: 8px;
            margin-bottom: 10px;
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
          let hasAutoPrinted = false;
          function triggerPrint() {
            window.focus();
            window.print();
          }

          function closePreview() {
            window.close();
          }

          window.addEventListener("load", () => {
            if (hasAutoPrinted) return;
            hasAutoPrinted = true;
            setTimeout(() => {
              triggerPrint();
            }, 250);
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

  const parcelsResponse = await getFarmParcels(request.farmerId);
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
