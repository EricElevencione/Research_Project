// unchanged imports
import React, { useState, useEffect, useRef, useMemo } from "react";
import LandPlottingMap, {
  LandPlottingMapRef,
} from "../../components/Map/LandPlottingMap";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid"; // Add at the top for unique id generation
import { area as turfArea } from "@turf/turf";
import "../../assets/css/technician css/TechLandPlottingPageStyle.css";
import {
  getLandPlots,
  createLandPlot,
  updateLandPlot,
  deleteLandPlot,
  getRsbsaSubmissionById,
  getFarmParcels,
} from "../../api";

// interfaces unchanged...
interface LandAttributes {
  name: string;
  ffrs_id: string;
  area: number;
  coordinateAccuracy: "exact" | "approximate";
  barangay: string;
  firstName: string;
  middleName: string;
  surname: string;
  ext_name: string;
  gender: "Male" | "Female";
  municipality: string;
  province: string;
  parcel_address: string;
  status: "Tenant" | "Land Owner" | "Farmer";
  street: string;
  farmType: "Irrigated" | "Rainfed Upland" | "Rainfed Lowland";
  plotSource?: "manual" | "lot_plan"; // NEW FIELD
  parcelNumber?: number; // Added to fix linter error
  _isGenerated?: boolean; // Allow generated shape flag
}

interface Shape {
  id: string;
  layer: any;
  properties: LandAttributes;
  isEditing?: boolean;
}

const LandPlottingPage: React.FC = () => {
  const { barangayName: barangayNameParam } = useParams();
  const [searchParams] = useSearchParams();
  const urlParams = new URLSearchParams(window.location.search);
  const barangayNameQuery = urlParams.get("barangayName");
  // Use URL barangay as fallback only - parcel location will be primary
  const fallbackBarangayName = barangayNameParam || barangayNameQuery || "";
  console.log("DEBUG: Fallback barangayName from URL:", fallbackBarangayName);
  const navigate = useNavigate();
  const mapRef = useRef<LandPlottingMapRef>(null);
  const [selectedShape, setSelectedShape] = useState<Shape | null>(null);
  const [isEditingAttributes, setIsEditingAttributes] = useState(false);

  // New state for parcel context
  const [parcelContext, setParcelContext] = useState<{
    recordId?: string;
    parcelIndex?: number;
    viewOnly?: boolean;
  }>({});
  const [rsbsaRecord, setRsbsaRecord] = useState<any>(null);
  const [currentParcel, setCurrentParcel] = useState<any>(null);
  const [, setFarmerParcels] = useState<any[]>([]);
  // State to track the actual parcel barangay (from RSBSA form)
  const [parcelBarangay, setParcelBarangay] = useState<string>("");

  const [landAttributes, setLandAttributes] = useState<LandAttributes>({
    name: "",
    ffrs_id: "",
    area: 0,
    coordinateAccuracy: "approximate",
    barangay: "",
    firstName: "",
    middleName: "",
    surname: "",
    ext_name: "",
    gender: "Male",
    municipality: "Dumangas",
    province: "Iloilo",
    parcel_address: "",
    status: "Tenant",
    street: "",
    farmType: "Irrigated",
    plotSource: "manual", // Default to manual for new plots
  });

  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Only validate location/parcel fields - personal info is already validated in RSBSA registration
  const requiredFields: (keyof LandAttributes)[] = [
    "barangay",
    "municipality",
    "province",
    "parcel_address",
    "area",
  ];

  const AREA_OVERAGE_ALLOWANCE = 1.05;

  const formatHectaresValue = (value: number) => {
    if (!Number.isFinite(value)) return "0";
    return String(Math.round(value * 10000) / 10000);
  };

  const parseAreaNumber = (value: any): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }
    const normalized = String(value).replace(/,/g, "").trim();
    if (!normalized) return null;
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const normalizeAreaToHectares = (
    rawValue: any,
    sourceField?: string,
  ): number | null => {
    const numericValue = parseAreaNumber(rawValue);
    if (numericValue === null || numericValue <= 0) return null;

    const valueText = String(rawValue || "").toLowerCase();
    const source = String(sourceField || "").toLowerCase();

    if (/m2|sqm|sq\s*m|square\s*meter/.test(valueText)) {
      return numericValue / 10000;
    }
    if (/ha|hectare/.test(valueText) || source.includes("_ha")) {
      return numericValue;
    }

    // Legacy fallback for raw numeric values that are likely in m2.
    if (numericValue > 1000) {
      return numericValue / 10000;
    }

    return numericValue;
  };

  const getShapeAreaM2 = (shape: Shape): number => {
    const geoJson =
      shape?.layer && typeof shape.layer.toGeoJSON === "function"
        ? shape.layer.toGeoJSON()
        : null;

    if (
      geoJson &&
      geoJson.geometry &&
      (geoJson.geometry.type === "Polygon" ||
        geoJson.geometry.type === "MultiPolygon")
    ) {
      const geometryArea = turfArea(geoJson as any);
      if (Number.isFinite(geometryArea) && geometryArea > 0) {
        return geometryArea;
      }
    }

    const layerArea =
      shape?.layer && typeof shape.layer.getArea === "function"
        ? Number(shape.layer.getArea())
        : NaN;

    if (Number.isFinite(layerArea) && layerArea > 0) {
      return layerArea;
    }

    const rawArea = Number((shape?.properties as any)?.area);
    if (!Number.isFinite(rawArea) || rawArea <= 0) {
      return 0;
    }

    // Backward compatibility: historical values can be either m2 or hectares.
    return rawArea > 1000 ? rawArea : rawArea * 10000;
  };

  const targetParcelAreaHa = useMemo(() => {
    const candidates: Array<{ value: any; field: string }> = [
      {
        value: (currentParcel as any)?.total_farm_area_ha,
        field: "total_farm_area_ha",
      },
      {
        value: (currentParcel as any)?.total_farm_area,
        field: "total_farm_area",
      },
      { value: (currentParcel as any)?.farm_size, field: "farm_size" },
      { value: (currentParcel as any)?.size, field: "size" },
      { value: (rsbsaRecord as any)?.totalFarmArea, field: "totalFarmArea" },
    ];

    for (const candidate of candidates) {
      const normalizedHa = normalizeAreaToHectares(
        candidate.value,
        candidate.field,
      );
      if (normalizedHa && normalizedHa > 0) {
        return normalizedHa;
      }
    }

    return null;
  }, [currentParcel, rsbsaRecord]);

  const getShapeAreaLimitMessage = (shape: Shape): string | null => {
    if (!targetParcelAreaHa || targetParcelAreaHa <= 0) return null;

    const shapeAreaM2 = getShapeAreaM2(shape);
    if (shapeAreaM2 <= 0) return null;

    const maxAllowedM2 = targetParcelAreaHa * 10000 * AREA_OVERAGE_ALLOWANCE;
    if (shapeAreaM2 <= maxAllowedM2) return null;

    const shapeAreaHa = shapeAreaM2 / 10000;
    const maxAllowedHa = maxAllowedM2 / 10000;
    return `Plot area exceeds allowed limit. Drawn: ${formatHectaresValue(shapeAreaHa)} ha, allowed: ${formatHectaresValue(maxAllowedHa)} ha (105% of target).`;
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof LandAttributes, string>> = {};
    requiredFields.forEach((field) => {
      if (field === "area") {
        if (
          landAttributes.area === undefined ||
          landAttributes.area === null ||
          isNaN(Number(landAttributes.area))
        ) {
          errors.area = "This field is required";
        }
      } else if (field === "barangay") {
        // Use derived barangay for validation
        const derivedBarangay =
          landAttributes.barangay || parcelBarangay || fallbackBarangayName;
        if (!derivedBarangay || derivedBarangay === "N/A") {
          errors.barangay = "This field is required";
        }
      } else if (!landAttributes[field]) {
        errors[field] = "This field is required";
      }
    });
    if (Object.keys(errors).length > 0) {
      // Show which fields are missing with better formatting
      const missingFields = Object.keys(errors).map((key) => {
        // Convert camelCase to readable text
        return key
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (str) => str.toUpperCase());
      });
      setToast({
        message:
          "Please fill in all required fields: " + missingFields.join(", "),
        type: "error",
      });
      setTimeout(() => setToast(null), 4000);
      return false;
    }
    return true;
  };

  const saveShapeAttributes = async (shapeToSave: Shape) => {
    if (!validateForm()) {
      return false;
    }

    const areaLimitMessage = getShapeAreaLimitMessage(shapeToSave);
    if (areaLimitMessage) {
      setToast({
        message: areaLimitMessage,
        type: "error",
      });
      setTimeout(() => setToast(null), 5000);
      return false;
    }

    try {
      // Ensure barangay is populated using derived value
      const derivedBarangay =
        landAttributes.barangay || parcelBarangay || fallbackBarangayName;

      const shapeAreaM2 = getShapeAreaM2(shapeToSave);
      const fallbackAreaHa = Number((shapeToSave.properties as any)?.area);
      const shapeAreaHa =
        shapeAreaM2 > 0
          ? shapeAreaM2 / 10000
          : Number.isFinite(fallbackAreaHa)
            ? fallbackAreaHa
            : Number(landAttributes.area) || 0;

      const landPlotData = {
        id: shapeToSave.id,
        name: landAttributes.name,
        ffrs_id:
          landAttributes.ffrs_id ||
          rsbsaRecord?.ffrs_id ||
          rsbsaRecord?.FFRS_CODE ||
          "",
        area: shapeAreaHa,
        coordinate_accuracy: landAttributes.coordinateAccuracy || "approximate",
        barangay: derivedBarangay,
        first_name: landAttributes.firstName,
        middle_name: landAttributes.middleName,
        surname: landAttributes.surname,
        ext_name: landAttributes.ext_name,
        gender: landAttributes.gender,
        municipality: landAttributes.municipality,
        province: landAttributes.province,
        parcel_address:
          landAttributes.parcel_address ||
          `${derivedBarangay}, ${landAttributes.municipality || "Dumangas"}`,
        status: landAttributes.status,
        street: landAttributes.street,
        farm_type: landAttributes.farmType || "Irrigated",
        plot_source: landAttributes.plotSource || "manual",
        parcel_number:
          (shapeToSave.properties as any)?.parcelNumber ??
          (shapeToSave.properties as any)?.parcel_number ??
          currentParcel?.parcel_number ??
          currentParcel?.parcelNumber ??
          null,
        geometry: shapeToSave.layer.toGeoJSON().geometry,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Determine if this is a new or existing plot
      // (Assume shapeToSave.id is unique for new, and already exists for update)
      // If the id exists in the backend, use PUT, else POST
      // For simplicity, check if the id exists in shapes state (could be improved with backend check)
      const isExisting = existingPlotIds.has(String(shapeToSave.id));
      const response = isExisting
        ? await updateLandPlot(shapeToSave.id, landPlotData)
        : await createLandPlot(landPlotData);

      if (response.error) {
        console.error("Save failed:", response.error);
        throw new Error("Failed to save land plot data");
      }

      if (shapeToSave.layer.feature) {
        shapeToSave.layer.feature.properties = {
          ...shapeToSave.layer.feature.properties,
          ...landAttributes,
          area: shapeAreaHa,
        };
      } else {
        shapeToSave.layer.feature = {
          type: "Feature",
          properties: {
            ...landAttributes,
            area: shapeAreaHa,
          },
          geometry: shapeToSave.layer.toGeoJSON().geometry,
        };
      }

      setToast({
        message: "Land plot attributes saved successfully!",
        type: "success",
      });
      setTimeout(() => setToast(null), 3000);
      setExistingPlotIds((prev) => {
        const next = new Set(prev);
        next.add(String(shapeToSave.id));
        return next;
      });
      return true;
    } catch (error) {
      console.error("Error saving land plot:", error);
      setToast({
        message: "Failed to save land plot data. Please try again.",
        type: "error",
      });
      setTimeout(() => setToast(null), 4000);
      return false;
    }
  };

  // Add this helper to refresh shapes from backend
  const refreshShapesFromBackend = async () => {
    if (parcelContext.recordId) {
      await fetchRSBSARecord(parcelContext.recordId, parcelContext.parcelIndex);
    }
  };

  const handleSaveAttributes = async () => {
    setIsSaving(true);
    try {
      for (const shape of shapes) {
        const areaLimitMessage = getShapeAreaLimitMessage(shape);
        if (areaLimitMessage) {
          setToast({
            message: areaLimitMessage,
            type: "error",
          });
          setTimeout(() => setToast(null), 5000);
          return;
        }
      }

      // 1. Delete removed shapes from backend
      for (const id of deletedShapeIds) {
        await deleteLandPlot(id);
      }
      setDeletedShapeIds([]); // Clear after deletion

      // 2. Save all remaining shapes
      let failedToSave = false;
      for (const shape of shapes) {
        const isSaved = await saveShapeAttributes(shape);
        if (!isSaved) {
          failedToSave = true;
          break;
        }
      }

      if (failedToSave) {
        return;
      }

      // Refresh shapes from backend after save
      await refreshShapesFromBackend();

      // ...existing logic for updating UI, alerts, etc...
      // Always keep farmer info, only reset geometry fields
      setLandAttributes((prev) => ({
        ...prev,
        area: 0,
        // Add other geometry-only fields to reset if needed
      }));
      setSelectedShape(null);
      if (currentParcel && rsbsaRecord) {
        setLandAttributes((prev) => ({
          ...prev,
          firstName: rsbsaRecord.firstName || "",
          middleName: rsbsaRecord.middleName || "",
          surname: rsbsaRecord.surname || "",
          barangay: currentParcel.farmLocation?.barangay || "",
          municipality:
            currentParcel.farmLocation?.cityMunicipality || "Dumangas",
          // Optionally reset other fields as needed
        }));
      } else {
        setLandAttributes({
          name: "",
          ffrs_id: "",
          area: 0,
          coordinateAccuracy: "approximate",
          barangay: parcelBarangay || fallbackBarangayName,
          firstName: "",
          middleName: "",
          surname: "",
          ext_name: "",
          gender: "Male",
          municipality: "Dumangas",
          province: "Iloilo",
          parcel_address: "",
          status: "Tenant",
          street: "",
          farmType: "Irrigated",
          plotSource: "manual",
        });
      }
      setIsEditingAttributes(false);
      window.dispatchEvent(new Event("land-plot-saved"));
    } catch (error) {
      setToast({
        message: "Failed to save changes. Please try again.",
        type: "error",
      });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleShapeCreated = (shape: Shape) => {
    // Ensure a unique id for every new shape
    if (!shape.id) {
      shape.id = `shape-${Date.now()}-${uuidv4()}`;
    }

    // Pre-populate shape properties with current farmer info and parcel data
    const prefilledProperties = {
      ...landAttributes,
      ffrs_id:
        landAttributes.ffrs_id ||
        rsbsaRecord?.ffrs_id ||
        rsbsaRecord?.FFRS_CODE,
      // Ensure farmer info is included
      surname: landAttributes.surname || rsbsaRecord?.surname || "",
      firstName: landAttributes.firstName || rsbsaRecord?.firstName || "",
      middleName: landAttributes.middleName || rsbsaRecord?.middleName || "",
      gender: landAttributes.gender || rsbsaRecord?.gender || "Male",
      // Ensure location info is included
      barangay:
        parcelBarangay || landAttributes.barangay || fallbackBarangayName || "",
      municipality:
        landAttributes.municipality ||
        currentParcel?.farm_location_city_municipality ||
        "Dumangas",
      province: "Iloilo",
      parcel_address:
        landAttributes.parcel_address ||
        `${parcelBarangay || fallbackBarangayName}, ${landAttributes.municipality || "Dumangas"}`,
    };

    shape.properties = prefilledProperties;

    // Assign parcelNumber from currentParcel if available
    if (currentParcel && currentParcel.parcel_number !== undefined) {
      (shape.properties as any).parcelNumber = currentParcel.parcel_number;
    }

    // If the shape is a polygon, auto-calculate area
    const geo = shape.layer.toGeoJSON();
    if (geo.geometry.type === "Polygon" && shape.layer.getArea) {
      shape.properties.area = shape.layer.getArea();
      prefilledProperties.area = shape.layer.getArea();
    }

    // Update landAttributes with prefilled data
    setLandAttributes(prefilledProperties);

    setSelectedShape(shape);
    setIsEditingAttributes(true);

    // Add the new shape to the shapes array if not already present
    setShapesAndVersion((prevShapes: Shape[]) => {
      // Prevent duplicates by checking id
      if (prevShapes.some((s: Shape) => s.id === shape.id)) return prevShapes;
      return [...prevShapes, shape];
    });
  };

  const handleShapeFinalized = (shape: Shape) => {
    setSelectedShape(shape);
    setLandAttributes((prevAttributes) => ({
      ...prevAttributes,
      ...shape.properties,
      barangay:
        shape.properties.barangay ||
        parcelBarangay ||
        fallbackBarangayName ||
        prevAttributes.barangay,
      municipality: shape.properties.municipality || "Dumangas",
      province: shape.properties.province || "Iloilo",
    }));
    setIsEditingAttributes(true);
  };

  // Edit: Add async persistence to backend for edits and deletions

  // Called when a shape is edited and "Save" is clicked
  const handleShapeEdited = async (shape: Shape) => {
    setSelectedShape(shape);
    setLandAttributes((prevAttributes) => ({
      ...prevAttributes,
      ...shape.properties,
      barangay:
        shape.properties.barangay ||
        parcelBarangay ||
        fallbackBarangayName ||
        prevAttributes.barangay,
      municipality: shape.properties.municipality || "Dumangas",
      province: shape.properties.province || "Iloilo",
    }));
    setIsEditingAttributes(true);

    const areaLimitMessage = getShapeAreaLimitMessage(shape);
    if (areaLimitMessage) {
      setToast({
        message: areaLimitMessage,
        type: "error",
      });
      setTimeout(() => setToast(null), 5000);
      await refreshShapesFromBackend();
      return;
    }

    // Persist the edit to the backend
    try {
      const editedAreaM2 = getShapeAreaM2(shape);
      const editedAreaHa = editedAreaM2 > 0 ? editedAreaM2 / 10000 : 0;
      const response = await updateLandPlot(shape.id, {
        ...shape.properties,
        area: editedAreaHa || (shape.properties as any)?.area || 0,
        geometry: shape.layer.toGeoJSON().geometry,
      });
      if (response.error) throw new Error("Failed to update land plot");
    } catch (error) {
      setToast({
        message: "Failed to save changes to the backend.",
        type: "error",
      });
      setTimeout(() => setToast(null), 4000);
    }
    // Refresh shapes from backend after edit
    await refreshShapesFromBackend();
  };

  // Called when shapes are deleted and "Save" is clicked
  const handleMapShapeDeleted = async (e: any) => {
    // e.shapes is an array of deleted shapes
    const deletedIds = e.shapes.map((s: any) => s.id);
    setDeletedShapeIds((prev) => [...prev, ...deletedIds]);
    setExistingPlotIds((prev) => {
      const next = new Set(prev);
      deletedIds.forEach((id: string) => next.delete(String(id)));
      return next;
    });

    const remainingShapes = shapes.filter((s) => !deletedIds.includes(s.id));
    setShapesAndVersion(remainingShapes);

    // Persist deletions to the backend
    for (const deletedShape of e.shapes) {
      try {
        const response = await deleteLandPlot(deletedShape.id);
        if (response.error) throw new Error("Failed to delete land plot");
      } catch (error) {
        setToast({
          message: "Failed to delete land plot from the backend.",
          type: "error",
        });
        setTimeout(() => setToast(null), 4000);
      }
    }
    // Refresh shapes from backend after delete
    await refreshShapesFromBackend();

    if (remainingShapes.length > 0) {
      setSelectedShape(remainingShapes[0]);
      setLandAttributes((prev) => ({
        ...prev,
        ...remainingShapes[0].properties,
        area: remainingShapes[0].properties.area || 0,
      }));
    } else {
      setSelectedShape(null);
      setIsEditingAttributes(false);
      setLandAttributes((prev) => ({
        ...prev,
        area: 0,
      }));
    }
  };

  const handleBackClick = () => {
    // If we came from parcel selection, go back there
    if (parcelContext.recordId) {
      navigate(`/technician-pick-land-parcel/${parcelContext.recordId}`);
    } else {
      navigate("/technician-rsbsa");
    }
  };

  useEffect(() => {
    console.log("≡ƒöä selectedShape changed:", selectedShape);
    if (selectedShape) {
      console.log(
        "≡ƒô¥ Setting landAttributes from selectedShape.properties:",
        selectedShape.properties,
      );
      setLandAttributes({
        ...selectedShape.properties,
        barangay:
          selectedShape.properties.barangay ||
          parcelBarangay ||
          fallbackBarangayName,
        municipality: selectedShape.properties.municipality || "Dumangas",
        province: selectedShape.properties.province || "Iloilo",
      });
      setIsEditingAttributes(true);
    } else {
      console.log("≡ƒô¥ Resetting landAttributes (no shape selected)");
      setLandAttributes({
        name: "",
        ffrs_id: "",
        area: 0,
        coordinateAccuracy: "approximate",
        barangay: parcelBarangay || fallbackBarangayName,
        firstName: "",
        middleName: "",
        surname: "",
        ext_name: "",
        gender: "Male",

        municipality: "Dumangas",
        province: "Iloilo",
        parcel_address: "",
        status: "Tenant",
        street: "",
        farmType: "Irrigated",
        plotSource: "manual", // Reset plotSource on initial load
      });
      setIsEditingAttributes(false);
    }
  }, [selectedShape, parcelBarangay, fallbackBarangayName]);

  // Parse URL parameters for parcel context
  useEffect(() => {
    console.log("≡ƒöì URL Parsing useEffect triggered");
    console.log("≡ƒöì window.location.search:", window.location.search);
    console.log("≡ƒöì window.location.hash:", window.location.hash);
    console.log("≡ƒöì window.location.href:", window.location.href);
    console.log("≡ƒöì searchParams object:", searchParams);
    console.log("≡ƒöì searchParams.toString():", searchParams.toString());

    // Use React Router's searchParams for hash routing compatibility
    const recordId = searchParams.get("recordId");
    const parcelIndex = searchParams.get("parcelIndex");
    console.log(
      "≡ƒöì Parsed from searchParams - recordId:",
      recordId,
      "parcelIndex:",
      parcelIndex,
    );

    const parsedIndex = parcelIndex ? parseInt(parcelIndex, 10) : undefined;

    if (recordId) {
      console.log(
        "Γ£à recordId found, setting context and fetching RSBSA record...",
      );
      setParcelContext({ recordId, parcelIndex: parsedIndex });
      fetchRSBSARecord(recordId, parsedIndex);
    } else {
      console.log("Γ¥î No recordId found in URL");
    }
  }, [searchParams.toString()]); // Use toString() to detect any param changes

  // Helper function to fetch farm parcel data from the database
  const fetchFarmParcelData = async (recordId: string) => {
    try {
      const response = await getFarmParcels(recordId);
      if (response.error || !response.data || response.data.length === 0) {
        console.log("≡ƒôì No farm parcels found for submission:", recordId);
        return null;
      }
      console.log(
        "≡ƒôì Fetched",
        response.data.length,
        "farm parcel(s) for submission:",
        recordId,
      );
      return response.data; // Return the full array of parcels
    } catch (error) {
      console.error("Error fetching farm parcel data:", error);
      return null;
    }
  };

  // Fetch RSBSA record data
  const fetchRSBSARecord = async (recordId: string, parcelIndex?: number) => {
    console.log("≡ƒÜÇ fetchRSBSARecord called with:", {
      recordId,
      parcelIndex,
    });
    try {
      console.log("≡ƒôí Fetching RSBSA submission:", recordId);
      const response = await getRsbsaSubmissionById(recordId);
      console.log("≡ƒôí Response:", response);
      if (response.error) throw new Error(`HTTP error! ${response.error}`);
      const data = response.data;
      console.log("Γ£à Fetched RSBSA data:", data);
      setRsbsaRecord(data);
      console.log("Fetched RSBSA data:", data);
      console.log("parcelIndex:", parcelIndex);

      // Fetch farm parcel data from the database
      let farmParcels = data.farmParcels;
      if (
        !farmParcels ||
        !Array.isArray(farmParcels) ||
        farmParcels.length === 0
      ) {
        // If no farmParcels in the RSBSA data, fetch from rsbsa_farm_parcels table
        const parcelData = await fetchFarmParcelData(recordId);
        if (parcelData && parcelData.length > 0) {
          farmParcels = parcelData;
        } else {
          // Fallback: create basic parcel structure
          farmParcels = [
            {
              parcelNumber: data.parcelNumber || 1,
              farmLocation: {
                barangay:
                  data.farmLocationBarangay || data.addressBarangay || "",
                cityMunicipality:
                  data.farmLocationCityMunicipality ||
                  data.addressMunicipality ||
                  "",
              },
              totalFarmArea: data.totalFarmArea || data.parcelArea || "",
              cropCommodity: data.cropCommodity || "",
              size: data.farmSize || data.parcelArea || "",
              farmType: data.farmType || "",
              organicPractitioner: data.organicPractitioner || "",
              plotStatus: "not_plotted",
            },
          ];
        }
      }

      // Store all parcels for this farmer for progress calculations
      setFarmerParcels(farmParcels || []);

      if (parcelIndex !== undefined && farmParcels) {
        const parcel = farmParcels[parcelIndex];
        console.log("Selected parcel:", parcel);
        if (parcel) {
          setCurrentParcel(parcel);

          // Use the farm parcel data from the database
          console.log("≡ƒôì Raw parcel data:", parcel);
          const parcelBarangayLocation =
            parcel.farm_location_barangay ||
            parcel.farmLocation?.barangay ||
            parcel.farmLocationBarangay ||
            data.addressBarangay ||
            fallbackBarangayName;
          const parcelMunicipalityLocation =
            parcel.farm_location_city_municipality ||
            parcel.farmLocation?.cityMunicipality ||
            parcel.farmLocationCityMunicipality ||
            data.addressMunicipality ||
            "Dumangas";

          // Ensure we have a valid barangay
          const finalBarangay =
            parcelBarangayLocation || fallbackBarangayName || "";
          setParcelBarangay(finalBarangay);
          console.log("≡ƒôì Setting parcelBarangay to:", finalBarangay);

          setLandAttributes((prev) => ({
            ...prev,
            ffrs_id:
              data.ffrs_id || data.FFRS_CODE || data.ffrsCode || prev.ffrs_id,
            firstName: data.firstName || "",
            middleName: data.middleName || "",
            surname: data.lastName || data.surname || "",
            gender: data.gender || "Male",
            barangay: finalBarangay,
            municipality: parcelMunicipalityLocation,
            area: parseFloat(
              parcel.total_farm_area_ha ||
                parcel.farm_size ||
                parcel.total_farm_area ||
                "0",
            ),
            parcel_address: `${finalBarangay}, ${parcelMunicipalityLocation}`,
            farmType: parcel.farm_type || "Irrigated",
            plotSource: parcel.plot_source || "manual",
            parcelNumber: parcel.parcel_number,
          }));

          // --- NEW: Load all geometry for this parcel and farmer ---
          let shapes: Shape[] = [];
          let L: any = (window as any).L;
          if (!L) {
            L = await import("leaflet");
            L = L.default || L;
          }
          const resolvedParcelNumber =
            parcel.parcel_number ?? parcel.parcelNumber;
          if (parcel.geometry) {
            try {
              const parsedParcelGeometry =
                typeof parcel.geometry === "string"
                  ? JSON.parse(parcel.geometry)
                  : parcel.geometry;
              const layer = L.geoJSON(parsedParcelGeometry).getLayers()[0];
              if (layer) {
                shapes.push({
                  id: `parcel-${resolvedParcelNumber ?? "unknown"}`,
                  layer,
                  properties: {
                    ...parcel,
                    ...data,
                    area:
                      parcel.size ||
                      parcel.totalFarmArea ||
                      parcel.total_farm_area_ha ||
                      parcel.total_farm_area ||
                      0,
                    parcelNumber: resolvedParcelNumber,
                  },
                });
              }
            } catch (parseError) {
              console.error("Failed to parse parcel geometry:", parseError);
            }
          }
          const landPlotsRes = await getLandPlots();
          if (!landPlotsRes.error) {
            const allPlots = landPlotsRes.data;
            // Diagnostic logging
            console.log("≡ƒôª All plots from backend:", allPlots);
            // Robust matching: ignore case, trim, allow missing middle names
            const normalize = (str: string) => (str || "").trim().toLowerCase();
            const parcelAddr = normalize(
              `${parcelBarangayLocation}, ${parcelMunicipalityLocation}`,
            );
            const surname = normalize(data.lastName || data.surname || "");
            const firstName = normalize(data.firstName);
            const ffrsId = normalize(
              data.ffrs_id || data.FFRS_CODE || data.ffrsCode || "",
            );
            const targetParcelNumber = normalize(
              parcel.parcel_number || parcel.parcelNumber || "",
            );
            // Log filter values and all plots for debugging
            console.log("≡ƒöì Filtering for:", {
              parcelAddr,
              surname,
              firstName,
              ffrsId,
              targetParcelNumber,
            });
            allPlots.forEach((plot: any) => {
              console.log("≡ƒôì plot details:", {
                parcel_address: plot.parcel_address,
                surname: plot.surname,
                firstName: plot.firstName,
                first_name: plot.first_name,
                middleName: plot.middleName,
                middle_name: plot.middle_name,
                gender: plot.gender,
                FULL_PLOT: plot, // Log the entire plot object
              });
            });
            // Base filter: only require parcel_address, surname, and firstName to match
            const baseMatches = allPlots.filter((plot: any) => {
              // Check both camelCase and snake_case field names
              const plotFirstName = normalize(
                plot.firstName || plot.first_name || "",
              );
              const plotSurname = normalize(
                plot.surname || plot.last_name || "",
              );
              const plotParcelAddr = normalize(plot.parcel_address || "");

              return (
                plotParcelAddr === parcelAddr &&
                plotSurname === surname &&
                plotFirstName === firstName
              );
            });

            const exactParcelMatches = baseMatches.filter((plot: any) => {
              const plotParcelNumber = normalize(
                plot.parcel_number || plot.parcelNumber || "",
              );
              return targetParcelNumber
                ? plotParcelNumber === targetParcelNumber
                : true;
            });

            // Legacy fallback: if exact parcel match is missing, use base matches
            // that do not have parcel_number yet.
            const legacyNoParcelMatches = baseMatches.filter((plot: any) => {
              const plotParcelNumber = normalize(
                plot.parcel_number || plot.parcelNumber || "",
              );
              if (plotParcelNumber) return false;
              if (!ffrsId) return true;
              const plotFfrs = normalize(plot.ffrs_id || "");
              return !plotFfrs || plotFfrs === ffrsId;
            });

            const matches =
              exactParcelMatches.length > 0
                ? exactParcelMatches
                : legacyNoParcelMatches;

            const dedupedMatches = matches.filter(
              (plot: any, idx: number, arr: any[]) =>
                arr.findIndex((candidate: any) => candidate.id === plot.id) ===
                idx,
            );
            setExistingPlotIds(
              new Set(dedupedMatches.map((match: any) => String(match.id))),
            );
            // Diagnostic logging
            console.log("Γ£à Filtered plots for this parcel:", dedupedMatches);
            dedupedMatches.forEach((match: any) => {
              if (!match.geometry) return;
              const parsedMatchGeometry =
                typeof match.geometry === "string"
                  ? JSON.parse(match.geometry)
                  : match.geometry;
              const layer = L.geoJSON(parsedMatchGeometry).getLayers()[0];
              if (!layer) return;
              layer.options.id = match.id;
              console.log("Γ₧ò Adding shape with properties:", match);
              shapes.push({
                id: match.id,
                layer,
                properties: {
                  ...match,
                  parcelNumber:
                    match.parcel_number ??
                    match.parcelNumber ??
                    resolvedParcelNumber,
                },
              });
            });
          }
          console.log("≡ƒöó Total shapes loaded:", shapes.length);
          console.log("≡ƒôï All shapes:", shapes);
          setShapesAndVersion(shapes);
          const normalizedResolvedParcelNumber =
            resolvedParcelNumber !== undefined && resolvedParcelNumber !== null
              ? String(resolvedParcelNumber)
              : "";
          const selected =
            shapes.find(
              (s) =>
                String((s.properties as any).parcelNumber ?? "") ===
                normalizedResolvedParcelNumber,
            ) || shapes[0];
          console.log("≡ƒÄ» Selected shape:", selected);
          console.log("≡ƒÄ» Selected shape properties:", selected?.properties);
          setSelectedShape(selected || null);
          setIsEditingAttributes(!!selected);
          if (selected) {
            console.log(
              "≡ƒô¥ Setting landAttributes from selected shape:",
              selected.properties,
            );
            setLandAttributes((prev) => ({ ...prev, ...selected.properties }));
          }
          if (!selected) setIsEditingAttributes(false);
        }
      }
    } catch (error) {
      console.error("Error fetching RSBSA record:", error);
    }
  };

  useEffect(() => {
    const handleLandPlotDeleted = (event: any) => {
      const deletedId = event.detail.id;
      if (mapRef.current && typeof mapRef.current.deleteShape === "function") {
        mapRef.current.deleteShape(deletedId);
      }
    };
    window.addEventListener("land-plot-deleted", handleLandPlotDeleted);
    return () => {
      window.removeEventListener("land-plot-deleted", handleLandPlotDeleted);
    };
  }, []);

  console.log("currentParcel:", currentParcel);

  const [shapes, setShapes] = useState<Shape[]>([]);
  const [deletedShapeIds, setDeletedShapeIds] = useState<string[]>([]);
  const [existingPlotIds, setExistingPlotIds] = useState<Set<string>>(
    () => new Set(),
  );

  // Debug: Log when shapes state changes
  useEffect(() => {
    console.log("≡ƒôè SHAPES STATE CHANGED:", shapes);
    console.log("≡ƒôè SHAPES LENGTH:", shapes.length);
  }, [shapes]);

  // Helper function to set shapes
  const setShapesAndVersion = (
    newShapes: Shape[] | ((prevShapes: Shape[]) => Shape[]),
  ) => {
    console.log("≡ƒöº setShapesAndVersion called with:", newShapes);
    setShapes((prev) => {
      const updated =
        typeof newShapes === "function"
          ? (newShapes as (prevShapes: Shape[]) => Shape[])(prev)
          : newShapes;
      console.log("≡ƒöº Previous shapes:", prev);
      console.log("≡ƒöº Updated shapes:", updated);
      return updated;
    });
  };

  // Helper: Check if a polygon exists for the current parcel
  const normalizeParcelNumber = (value: any) => {
    if (value === null || value === undefined || value === "") return "";
    return String(value).trim();
  };

  const activeParcelNumber = normalizeParcelNumber(
    currentParcel?.parcel_number ?? currentParcel?.parcelNumber,
  );

  const polygonExistsForCurrentParcel = shapes.some((shape) => {
    const geo = shape.layer && shape.layer.toGeoJSON && shape.layer.toGeoJSON();
    const shapeParcelNumber = normalizeParcelNumber(
      (shape.properties as any)?.parcelNumber ??
        (shape.properties as any)?.parcel_number,
    );
    // Only check for Polygon type
    return (
      geo &&
      geo.geometry &&
      geo.geometry.type === "Polygon" &&
      (activeParcelNumber
        ? shapeParcelNumber === activeParcelNumber
        : !shapeParcelNumber)
    );
  });

  // Total plotted area across all shapes (hectares)
  const totalPlottedAreaHa = useMemo(() => {
    if (!shapes || shapes.length === 0) return 0;
    const seenIds = new Set<string>();
    let total = 0;

    shapes.forEach((shape) => {
      const shapeId = shape.id || "";
      if (seenIds.has(shapeId)) return;
      seenIds.add(shapeId);

      const rawArea: any = (shape.properties as any)?.area;
      if (rawArea === null || rawArea === undefined) return;
      const numericArea =
        typeof rawArea === "number"
          ? rawArea
          : parseFloat(String(rawArea).replace(/,/g, ""));
      if (!Number.isFinite(numericArea)) return;
      total += numericArea;
    });

    return total;
  }, [shapes]);

  const formattedTotalPlottedArea = useMemo(() => {
    if (!Number.isFinite(totalPlottedAreaHa)) return "0";
    if (totalPlottedAreaHa === 0) return "0";
    return String(Math.round(totalPlottedAreaHa * 10000) / 10000);
  }, [totalPlottedAreaHa]);

  // Comprehensive debugging for barangay resolution
  console.log("=== BARANGAY DEBUG START ===");
  console.log("≡ƒôì landAttributes.barangay:", landAttributes.barangay);
  console.log("≡ƒôì parcelBarangay state:", parcelBarangay);
  console.log("≡ƒôì fallbackBarangayName:", fallbackBarangayName);
  console.log("≡ƒôª currentParcel:", currentParcel);
  console.log(
    "≡ƒôª currentParcel?.farm_location_barangay:",
    currentParcel?.farm_location_barangay,
  );
  console.log("≡ƒæñ rsbsaRecord:", rsbsaRecord);
  console.log("=== BARANGAY DEBUG END ===");

  // Helpers to robustly derive display values from various possible field names
  function getDisplayBarangay() {
    const candidates = [
      currentParcel?.farm_location_barangay,
      currentParcel?.farmLocation?.barangay,
      (currentParcel as any)?.farmLocationBarangay,
      (currentParcel as any)?.barangay,
      landAttributes.barangay,
      (rsbsaRecord as any)?.farmLocationBarangay,
      rsbsaRecord?.addressBarangay,
      (rsbsaRecord as any)?.barangay,
    ];
    const value = candidates.find(
      (v) => typeof v === "string" && v.trim().length > 0,
    );
    console.log("≡ƒöì getDisplayBarangay candidates:", candidates);
    console.log("Γ£à getDisplayBarangay selected value:", value);
    return value || "N/A";
  }

  // Compute barangay for map using useMemo to reactively update when dependencies change
  const barangayForMap = useMemo(() => {
    const candidates = [
      currentParcel?.farm_location_barangay,
      currentParcel?.farmLocation?.barangay,
      (currentParcel as any)?.barangay,
      landAttributes.barangay,
      parcelBarangay,
      fallbackBarangayName,
      (rsbsaRecord as any)?.farmLocationBarangay,
      rsbsaRecord?.addressBarangay,
      (rsbsaRecord as any)?.barangay,
    ];
    console.log(
      "≡ƒù║∩╕Å useMemo barangayForMap - ALL CANDIDATES WITH DETAILS:",
    );
    candidates.forEach((c, i) => {
      console.log(`  [${i}]:`, typeof c, `"${c}"`);
    });
    const value = candidates.find(
      (v) => typeof v === "string" && v.trim().length > 0 && v !== "N/A",
    );
    console.log(
      "Γ£à useMemo barangayForMap - FINAL selected value:",
      `"${value}"`,
    );
    return value || "";
  }, [
    currentParcel,
    landAttributes.barangay,
    parcelBarangay,
    fallbackBarangayName,
    rsbsaRecord,
  ]);

  function getDisplayMunicipality() {
    const candidates = [
      (currentParcel as any)?.farm_location_city_municipality,
      currentParcel?.farmLocation?.cityMunicipality,
      (currentParcel as any)?.farmLocationCityMunicipality,
      landAttributes.municipality,
      rsbsaRecord?.addressMunicipality,
      "Dumangas",
    ];
    const value = candidates.find(
      (v) => typeof v === "string" && v.trim().length > 0,
    );
    return value || "Dumangas";
  }

  function toNumberOrNull(val: any): number | null {
    if (val === 0) return 0;
    if (val === null || val === undefined) return null;
    const num =
      typeof val === "string"
        ? parseFloat(val)
        : typeof val === "number"
          ? val
          : NaN;
    return Number.isFinite(num) ? num : null;
  }

  function getDisplayAreaHectares() {
    const candidateNums = [
      toNumberOrNull((currentParcel as any)?.total_farm_area_ha),
      toNumberOrNull((currentParcel as any)?.total_farm_area),
      toNumberOrNull((currentParcel as any)?.farm_size),
      toNumberOrNull((currentParcel as any)?.size),
      toNumberOrNull(landAttributes.area),
      toNumberOrNull((rsbsaRecord as any)?.totalFarmArea),
    ];
    const value = candidateNums.find((v) => v !== null);
    if (value === null || value === undefined) return "N/A";
    // Keep 0 if actual value is 0; otherwise format to max 4 decimals
    const formatted =
      value === 0 ? "0" : String(Math.round((value as number) * 10000) / 10000);
    return `${formatted} hectares`;
  }

  function getDisplayName() {
    // Debug logging
    console.log("≡ƒöì getDisplayName - selectedShape:", selectedShape);
    console.log(
      "≡ƒöì getDisplayName - selectedShape?.properties:",
      selectedShape?.properties,
    );
    console.log("≡ƒöì getDisplayName - landAttributes:", landAttributes);
    console.log("≡ƒöì getDisplayName - rsbsaRecord:", rsbsaRecord);

    // Check selectedShape first, then landAttributes, then rsbsaRecord
    const sources = [selectedShape?.properties, landAttributes, rsbsaRecord];

    for (const source of sources) {
      if (!source) continue;
      const firstName =
        (source as any).firstName || (source as any).first_name || "";
      const middleName =
        (source as any).middleName || (source as any).middle_name || "";
      const surname =
        (source as any).surname ||
        (source as any).lastName ||
        (source as any).last_name ||
        "";

      console.log("≡ƒöì Checking source:", {
        firstName,
        middleName,
        surname,
        source,
      });

      const fullName = `${firstName} ${middleName} ${surname}`.trim();
      if (fullName.length > 0) {
        console.log("Γ£à Found name:", fullName);
        return fullName;
      }
    }
    console.log("Γ¥î No name found, returning N/A");
    return "N/A";
  }

  function getDisplayGender() {
    const candidates = [
      selectedShape?.properties?.gender,
      (selectedShape?.properties as any)?.gender,
      landAttributes.gender,
      rsbsaRecord?.gender,
    ];
    return (
      candidates.find(
        (v) => v && typeof v === "string" && v.trim().length > 0,
      ) || "N/A"
    );
  }

  return (
    <div className="tech-landplotting-container">
      {/* Toast Notification */}
      {toast && (
        <div className={`toast-notification toast-${toast.type}`}>
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="toast-close">
            X
          </button>
        </div>
      )}
      {/* Back Button at top left */}
      <button
        className="app-back-button tech-landplotting-back-button"
        onClick={handleBackClick}
        aria-label="Back"
      >
        Back
      </button>

      <div className="tech-landplotting-main-wrapper">
        {/* Left: Map */}
        <div className="tech-landplotting-map-section">
          <div className="tech-landplotting-map-header">
            <div>
              <div className="tech-landplotting-map-title">
                Land Plotting Workspace
              </div>
              <div className="tech-landplotting-map-subtitle">
                Draw and edit parcel geometry directly on the map.
              </div>
            </div>
            <div
              className={`tech-landplotting-map-status ${
                polygonExistsForCurrentParcel ? "locked" : "ready"
              }`}
            >
              {polygonExistsForCurrentParcel
                ? "Polygon completed for this parcel"
                : "Ready to draw parcel polygon"}
            </div>
          </div>
          <div className="tech-landplotting-map-container">
            {/* Map component */}
            <div className="tech-landplotting-map-wrapper">
              <LandPlottingMap
                ref={mapRef}
                selectedShape={selectedShape}
                onShapeSelected={setSelectedShape}
                onShapeCreated={handleShapeCreated}
                onShapeEdited={handleShapeEdited}
                onShapeDeleted={handleMapShapeDeleted}
                barangayName={barangayForMap}
                onShapeFinalized={handleShapeFinalized}
                drawingDisabled={polygonExistsForCurrentParcel}
                geometryPreview={currentParcel?.geometry || null}
                shapes={shapes}
                polygonExistsForCurrentParcel={polygonExistsForCurrentParcel}
                currentParcelNumber={
                  currentParcel?.parcel_number ?? currentParcel?.parcelNumber
                }
                targetAreaHa={targetParcelAreaHa ?? undefined}
              />
            </div>
          </div>
          <div className="tech-landplotting-map-instructions">
            <span className="tech-landplotting-instruction-item">
              1. Draw polygon inside barangay boundary
            </span>
            <span className="tech-landplotting-instruction-item">
              2. Adjust shape if needed
            </span>
            <span className="tech-landplotting-instruction-item">
              3. Save to persist changes
            </span>
          </div>
        </div>
        {/* Right: Details Panel */}
        <div className="tech-landplotting-details-panel">
          <div className="tech-landplotting-panel-headline">
            Parcel Information
          </div>
          {/* High-level stats */}
          <div className="tech-landplotting-stats-grid">
            <div className="tech-landplotting-stat-card">
              <div className="tech-landplotting-stat-label">
                Total plotted area
              </div>
              <div className="tech-landplotting-stat-value">
                {formattedTotalPlottedArea}
                <span className="tech-landplotting-stat-unit"> ha</span>
              </div>
              <div className="tech-landplotting-stat-sub">
                Sum of all mapped parcels for this farmer
              </div>
            </div>
          </div>

          <div className="tech-landplotting-parcel-title">
            {currentParcel &&
            currentParcel.parcel_number !== undefined &&
            currentParcel.parcel_number !== null &&
            currentParcel.parcel_number !== ""
              ? `Farm Parcel #${currentParcel.parcel_number}`
              : selectedShape &&
                  (selectedShape.properties as any).parcelNumber !== undefined
                ? `Farm Parcel #${(selectedShape.properties as any).parcelNumber}`
                : "Farm Parcel #1"}
          </div>
          <div className="tech-landplotting-section-label">Details:</div>
          <div className="tech-landplotting-details-container">
            <div className="tech-landplotting-detail-row">
              <span className="tech-landplotting-detail-label">Name:</span>
              {` ${getDisplayName()}`}
            </div>
            <div className="tech-landplotting-detail-row">
              <span className="tech-landplotting-detail-label">
                Municipality:
              </span>
              {` ${getDisplayMunicipality()}`}
            </div>
            <div className="tech-landplotting-detail-row">
              <span className="tech-landplotting-detail-label">Barangay:</span>
              {` ${getDisplayBarangay()}`}
            </div>
            <div className="tech-landplotting-detail-row">
              <span className="tech-landplotting-detail-label">Gender:</span>
              {` ${getDisplayGender()}`}
            </div>
            <div className="tech-landplotting-detail-row">
              <span className="tech-landplotting-detail-label">
                Parcel Area:
              </span>
              {` ${getDisplayAreaHectares()}`}
            </div>
          </div>

          <div className="tech-landplotting-actions-container">
            <button
              onClick={handleSaveAttributes}
              disabled={!isEditingAttributes || isSaving}
              className="tech-landplotting-save-button"
            >
              {isSaving ? "Saving..." : "SAVE"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandPlottingPage;
