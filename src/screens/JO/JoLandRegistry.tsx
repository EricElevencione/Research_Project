import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../supabase";
import "../../components/layout/sidebarStyle.css";
import "../../assets/css/jo css/JoLandRegistryStyle.css";
import LogoImage from "../../assets/images/Logo.png";
import HomeIcon from "../../assets/images/home.png";
import RSBSAIcon from "../../assets/images/rsbsa.png";
import MasterlistIcon from "../../assets/images/approve.png";
import LogoutIcon from "../../assets/images/logout.png";
import IncentivesIcon from "../../assets/images/incentives.png";

// Interfaces
interface LandParcel {
  id: number;
  land_parcel_id: number;
  parcel_number: string;
  ffrs_code: string;
  farm_location_barangay: string;
  farm_location_municipality: string;
  total_farm_area_ha: number;
  land_owner_name: string;
  farmer_id: number;
  farmer_name: string;
  is_registered_owner: boolean;
  is_tenant: boolean;
  is_lessee: boolean;
  is_current: boolean;
  period_start_date: string;
}

interface LandHistoryRecord {
  id: number;
  land_parcel_id: number;
  parcel_number: string;
  farm_location_barangay: string;
  total_farm_area_ha: number;
  land_owner_name: string;
  farmer_name: string;
  farmer_ffrs_code: string;
  is_registered_owner: boolean;
  is_tenant: boolean;
  is_lessee: boolean;
  period_start_date: string;
  period_end_date: string | null;
  is_current: boolean;
  change_type: string;
  change_reason: string;
  previous_history_id: number | null;
}

// Interface for farmers (for transfer ownership dropdown)
interface TransferActorOption {
  farmerId: number;
  name: string;
  barangay: string;
  parcelIds: number[];
  parcelCount: number;
}

interface FarmerGroup {
  farmer_id: number;
  farmer_name: string;
  ffrs_code: string;
  parcels: Array<{
    id: number;
    parcel_number: string;
    barangay: string; // renamed for clarity
    municipality: string;
    area_ha: number;
  }>;
  total_farm_area_ha: number;
  last_updated: string; // ISO string or timestamp
}

interface SimpleParcel {
  total_farm_area_ha: number | undefined;
  id: number;
  parcel_number: string;
  barangay: string;
  municipality: string;
  area_ha: number;
  land_parcel_id?: number; // Optional, used for ownership verification
}

type TransferMode = "voluntary" | "inheritance";
type InheritanceAreaMode = "take_all" | "partial";
const TRANSFER_PROOF_BUCKET = "ownership-transfer-proofs";

const JoLandRegistry: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // State
  // const [landParcels, setLandParcels] = useState<LandParcel[]>([]);
  const [aggregatedFarmers, setAggregatedFarmers] = useState<FarmerGroup[]>([]);
  const [selectedFarmer, setSelectedFarmer] = useState<FarmerGroup | null>(
    null,
  );
  const [selectedParcel, setSelectedParcel] = useState<LandParcel | null>(null);
  const [parcelHistory, setParcelHistory] = useState<LandHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBarangay, setFilterBarangay] = useState("");
  const [showModal, setShowModal] = useState(false);

  // Transfer Ownership State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferMode, setTransferMode] = useState<TransferMode | "">("");
  const [sourceRegisteredOwnerId, setSourceRegisteredOwnerId] = useState<
    number | ""
  >("");
  const [beneficairyOwnerId, setBeneficairyOwnerId] = useState<number | "">("");
  const [confirmBenefaciary, setConfirmBenefaciary] = useState(false);
  const [inheritanceAreaMode, setInheritanceAreaMode] =
    useState<InheritanceAreaMode>("take_all");
  const [inheritancePartialAreaHa, setInheritancePartialAreaHa] = useState<
    number | ""
  >("");
  const [voluntaryAreaMode, setVoluntaryAreaMode] =
    useState<InheritanceAreaMode>("take_all");
  const [voluntaryPartialAreaHa, setVoluntaryPartialAreaHa] = useState<
    number | ""
  >("");
  const [supportingDocs, setSupportingDocs] = useState<File[]>([]);
  const [transferReason, setTransferReason] = useState("");
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);
  const [transferSubmitError, setTransferSubmitError] = useState("");
  const [transferSubmitSuccess, setTransferSubmitSuccess] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const parseDateToTime = (dateValue: string | null | undefined): number => {
    if (!dateValue) return 0;
    const time = new Date(dateValue).getTime();
    return Number.isFinite(time) ? time : 0;
  };

  const getParcelDedupeKey = (parcel: LandParcel): string => {
    const farmerId = Number(parcel.farmer_id);
    const parcelNumber = String(parcel.parcel_number || "")
      .trim()
      .toLowerCase();
    const barangay = String(parcel.farm_location_barangay || "")
      .trim()
      .toLowerCase();
    const municipality = String(parcel.farm_location_municipality || "")
      .trim()
      .toLowerCase();
    const areaKey = Number(parcel.total_farm_area_ha || 0).toFixed(4);

    // Primary dedupe: same farmer + same parcel details (handles duplicate rows with different IDs).
    if (parcelNumber || barangay || municipality) {
      return [
        "farmer",
        Number.isFinite(farmerId) ? farmerId : 0,
        parcelNumber,
        barangay,
        municipality,
        areaKey,
      ].join("|");
    }

    const landParcelId = Number(parcel.land_parcel_id);
    if (Number.isFinite(landParcelId) && landParcelId > 0) {
      return `parcel:${landParcelId}`;
    }

    // Fallback for legacy rows where land_parcel_id may be missing/null.
    const legacyFarmParcelId = Number((parcel as any).farm_parcel_id);
    if (Number.isFinite(legacyFarmParcelId) && legacyFarmParcelId > 0) {
      return `parcel:${legacyFarmParcelId}`;
    }

    return ["legacy", Number.isFinite(farmerId) ? farmerId : 0, areaKey].join(
      "|",
    );
  };

  const dedupeLandParcels = (rows: LandParcel[]): LandParcel[] => {
    const byParcelKey = new Map<string, LandParcel>();

    rows.forEach((row) => {
      const key = getParcelDedupeKey(row);
      const existing = byParcelKey.get(key);

      if (!existing) {
        byParcelKey.set(key, row);
        return;
      }

      const rowTime = parseDateToTime(row.period_start_date);
      const existingTime = parseDateToTime(existing.period_start_date);

      if (
        rowTime > existingTime ||
        (rowTime === existingTime && Number(row.id) > Number(existing.id))
      ) {
        byParcelKey.set(key, row);
      }
    });

    return Array.from(byParcelKey.values());
  };

  // Fetch land parcels with current ownership details, with a fallback to history if the main query fails (e.g. due to schema changes or missing data)
  // This function refreshes the list of land parcels by fetching data from the "land_history" table in Supabase.
  // It's used as a fallback if the main data fetch fails. We wrap it in useCallback to prevent unnecessary re-creations.
  const refreshLandParcelsFromHistory = useCallback(async () => {
    // Set loading to true to show a loading indicator while data is being fetched.
    setLoading(true);

    try {
      // Step 1: Fetch the current (active) land history records from Supabase.
      // We select specific fields and filter for records where 'is_current' is true.
      // Results are sorted by parcel_number in ascending order.
      const { data: historyData, error: historyError } = await supabase
        .from("land_history")
        .select(
          `
        id,
        land_parcel_id,
        parcel_number,
        farm_location_barangay,
        farm_location_municipality,
        total_farm_area_ha,
        land_owner_name,
        farmer_id,
        farmer_name,
        is_registered_owner,
        is_tenant,
        is_lessee,
        is_current,
        period_start_date
      `,
        )
        .eq("is_current", true)
        .order("parcel_number", { ascending: true });

      // If there's an error fetching the history, log it and stop here (we don't set any data).
      if (historyError) {
        console.error(
          "Error fetching land parcels from history:",
          historyError,
        );
        return; // Early return to avoid processing bad data.
      }

      // If no data, default to an empty array to avoid crashes.
      const parcels: any[] = historyData || []; // Type as any[] for now; in a real app, use a proper interface.

      // Step 2: Extract unique farmer IDs from the parcels.
      // We use a Set to get unique values, filter out falsy ones (like null or undefined), and convert back to an array.
      const uniqueFarmerIds = [
        ...new Set(parcels.map((parcel) => parcel.farmer_id).filter(Boolean)),
      ];

      // Initialize an empty map to store farmer_id -> FFRS_CODE.
      let ffrsCodeMap: Record<number, string> = {};

      // Step 3: If there are farmer IDs, fetch their FFRS codes from the "rsbsa_submission" table.
      if (uniqueFarmerIds.length > 0) {
        const { data: ffrsData, error: ffrsError } = await supabase
          .from("rsbsa_submission")
          .select('id, "FFRS_CODE"') // Select farmer ID and FFRS_CODE.
          .in("id", uniqueFarmerIds); // Only fetch for the IDs we need.

        // If there's an error fetching FFRS data, log it but continue (we can still use parcels without codes).
        if (ffrsError) {
          console.error("Error fetching FFRS codes:", ffrsError);
        } else if (ffrsData) {
          // Step 4: Create a map of farmer_id -> FFRS_CODE for quick lookup.
          // Use Object.fromEntries to turn the array into a key-value object.
          ffrsCodeMap = Object.fromEntries(
            ffrsData.map((record: any) => [record.id, record.FFRS_CODE || ""]), // Default to empty string if no code.
          );
        }
      }

      // Step 5: Add the FFRS code to each parcel by looking it up in the map.
      const parcelsWithFfrs = parcels.map((parcel) => ({
        ...parcel, // Copy all existing properties.
        ffrs_code: ffrsCodeMap[parcel.farmer_id] || "", // Add FFRS code or empty string if not found.
      }));

      const dedupedParcels = dedupeLandParcels(parcelsWithFfrs);

      // Update the state with the enriched parcels.
      // setAggregatedFarmers(dedupedParcels);

      // Log success for debugging.
      console.log(
        "✅ Loaded",
        dedupedParcels.length,
        "land parcels with FFRS codes (deduped from",
        parcelsWithFfrs.length,
        ")",
      );
    } catch (generalError) {
      // Catch any unexpected errors (like network issues) and log them.
      console.error(
        "Unexpected error in refreshLandParcelsFromHistory:",
        generalError,
      );
    } finally {
      // Always set loading to false, whether successful or not.
      setLoading(false);
    }
  }, []); // Empty dependency array means this callback doesn't change unless the component unmounts/remounts.

  // This function refreshes the list of land parcels by fetching current data from the "rsbsa_farm_parcels" table in Supabase.
  // If there's an error fetching the main data, it falls back to refreshing from history.
  // We wrap it in useCallback to prevent unnecessary re-creations, with refreshLandParcelsFromHistory as a dependency.
  const refreshLandParcels = useCallback(async () => {
    setLoading(true);

    try {
      // Fetch directly from the aggregated view we created in Supabase
      const { data, error } = await supabase
        .from("farmer_aggregated_unified")
        .select("*")
        .order("farmer_name", { ascending: true });

      if (error) {
        console.error("Error fetching aggregated farmers:", error);
        // You can add a user-facing message here later, e.g.:
        // setErrorMessage("Failed to load farmer data. Please try again.");
        return;
      }

      // data is already FarmerGroup[] shape from the view
      setAggregatedFarmers(data || []);

      console.log(`Loaded ${data?.length || 0} aggregated farmers`);
    } catch (err) {
      console.error("Unexpected error in refreshLandParcels:", err);
      // Optional: fallback to old logic or show error UI
      // await refreshLandParcelsFromHistory();  // ← remove or comment if not needed
    } finally {
      setLoading(false);
    }
  }, []); // No dependency on refreshLandParcelsFromHistory anymore

  // =======================================================================================

  const buildTransferActorOptions = (
    farmers: FarmerGroup[],
    excludeFarmerId?: number,
  ): TransferActorOption[] => {
    return farmers
      .filter(
        (group) => !excludeFarmerId || group.farmer_id !== excludeFarmerId,
      )
      .map((group) => ({
        farmerId: group.farmer_id,
        name: group.farmer_name || `Farmer #${group.farmer_id}`,
        barangay: group.parcels[0]?.barangay || "",
        parcelIds: group.parcels.map((p) => p.id),
        parcelCount: group.parcels.length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  // Filtered farmers for the main list
  const filteredFarmers = useMemo(() => {
    return aggregatedFarmers
      .filter((group) => {
        const lowerSearch = searchTerm.toLowerCase().trim();
        if (
          group.farmer_name.toLowerCase().includes(lowerSearch) ||
          (group.ffrs_code || "").toLowerCase().includes(lowerSearch)
        ) {
          return true;
        }
        return group.parcels.some(
          (p) =>
            p.parcel_number.toLowerCase().includes(lowerSearch) ||
            p.barangay.toLowerCase().includes(lowerSearch),
        );
      })
      .filter((group) => {
        if (!filterBarangay) return true;
        return group.parcels.some((p) => p.barangay === filterBarangay);
      });
  }, [aggregatedFarmers, searchTerm, filterBarangay]);

  const uniqueBarangays = useMemo(() => {
    const set = new Set<string>();
    aggregatedFarmers.forEach((group) => {
      group.parcels.forEach((p) => {
        if (p.barangay) set.add(p.barangay);
      });
    });
    return Array.from(set).sort();
  }, [aggregatedFarmers]);

  // ==================== TRANSFER OPTIONS - SINGLE DECLARATIONS ONLY ====================

  const selectedContextFarmerId = selectedFarmer?.farmer_id ?? null;
  const selectedContextFarmerName = selectedFarmer?.farmer_name || "Unknown";

  const registeredOwnerOptions = buildTransferActorOptions(
    aggregatedFarmers,
    selectedContextFarmerId ?? undefined,
  );

  const voluntaryDonorOptions = registeredOwnerOptions;
  const inheritanceDonorOptions = registeredOwnerOptions;

  const selectedRegisteredOwner =
    voluntaryDonorOptions.find((o) => o.farmerId === sourceRegisteredOwnerId) ||
    null;

  const selectedBeneficiaryOwner =
    inheritanceDonorOptions.find((o) => o.farmerId === beneficairyOwnerId) ||
    null;

  const selectedSource = (() => {
    if (transferMode === "inheritance") return selectedBeneficiaryOwner;
    if (transferMode !== "voluntary") return null;
    return selectedRegisteredOwner;
  })();

  const inheritanceTransferParcels = selectedBeneficiaryOwner
    ? aggregatedFarmers.find(
        (g) => g.farmer_id === selectedBeneficiaryOwner.farmerId,
      )?.parcels || []
    : [];

  const voluntaryTransferParcels = selectedRegisteredOwner
    ? aggregatedFarmers.find(
        (g) => g.farmer_id === selectedRegisteredOwner.farmerId,
      )?.parcels || []
    : [];

  const voluntaryDonorTotalAreaHa = voluntaryTransferParcels.reduce(
    (sum, parcel) =>
      sum + (Number.isFinite(parcel.area_ha) ? parcel.area_ha : 0),
    0,
  );

  const inheritanceDonorTotalAreaHa = inheritanceTransferParcels.reduce(
    (sum, parcel) =>
      sum + (Number.isFinite(parcel.area_ha) ? parcel.area_ha : 0),
    0,
  );

  const voluntaryAreaSelectionValid =
    voluntaryAreaMode === "take_all"
      ? voluntaryDonorTotalAreaHa > 0
      : typeof voluntaryPartialAreaHa === "number" &&
        voluntaryPartialAreaHa > 0 &&
        voluntaryPartialAreaHa <= voluntaryDonorTotalAreaHa;

  const inheritanceAreaSelectionValid =
    inheritanceAreaMode === "take_all"
      ? inheritanceDonorTotalAreaHa > 0
      : typeof inheritancePartialAreaHa === "number" &&
        inheritancePartialAreaHa > 0 &&
        inheritancePartialAreaHa <= inheritanceDonorTotalAreaHa;

  // Selected area values for preview in the modal
  const voluntarySelectedAreaHa =
    voluntaryAreaMode === "take_all"
      ? voluntaryDonorTotalAreaHa
      : typeof voluntaryPartialAreaHa === "number"
        ? voluntaryPartialAreaHa
        : 0;

  const inheritanceSelectedAreaHa =
    inheritanceAreaMode === "take_all"
      ? inheritanceDonorTotalAreaHa
      : typeof inheritancePartialAreaHa === "number"
        ? inheritancePartialAreaHa
        : 0;

  // Hectare dropdown options (whole numbers only)
  const voluntaryHectareOptions = Array.from(
    { length: Math.max(0, Math.floor(voluntaryDonorTotalAreaHa)) },
    (_, index) => index + 1,
  );

  const inheritanceHectareOptions = Array.from(
    { length: Math.max(0, Math.floor(inheritanceDonorTotalAreaHa)) },
    (_, index) => index + 1,
  );

  // ✅ ONLY ONE declaration of effectiveTransferParcels (no redeclaration)
  const effectiveTransferParcels = (() => {
    if (transferMode === "inheritance") return inheritanceTransferParcels;
    if (transferMode === "voluntary") return voluntaryTransferParcels;
    return [];
  })();

  // =======================================================================================

  const defaultReason =
    transferMode === "inheritance"
      ? "Inheritance"
      : transferMode === "voluntary"
        ? "Voluntary Transfer"
        : "";
  const finalReasonPreview = transferReason.trim() || defaultReason;
  const transferModeLabel =
    transferMode === "inheritance"
      ? "Inheritance"
      : transferMode === "voluntary"
        ? "Voluntary Transfer"
        : "Not selected";
  const transferBlockingReason = (() => {
    if (!transferMode) return "Select a transfer type.";
    if (selectedContextFarmerId === null) {
      return "Current selected holder is invalid for transfer.";
    }
    if (transferMode === "inheritance" && !selectedBeneficiaryOwner) {
      return "Select the land owner giving the inheritance.";
    }
    if (transferMode === "voluntary" && !selectedRegisteredOwner) {
      return "Select the land owner donating the land.";
    }
    if (effectiveTransferParcels.length === 0) {
      return "No transferable parcels found for the selected donor.";
    }
    if (transferMode === "inheritance" && !inheritanceAreaSelectionValid) {
      return "Choose a valid inheritance area to transfer.";
    }
    if (transferMode === "voluntary" && !voluntaryAreaSelectionValid) {
      return "Choose a valid voluntary transfer area.";
    }
    if (supportingDocs.length === 0) return "Upload at least one proof image.";
    return "";
  })();
  const transferReadyForReview = transferBlockingReason === "";

  const resetTransferWorkflow = () => {
    setTransferMode("");
    setSourceRegisteredOwnerId("");
    setBeneficairyOwnerId("");
    setConfirmBenefaciary(false);
    setInheritanceAreaMode("take_all");
    setInheritancePartialAreaHa("");
    setVoluntaryAreaMode("take_all");
    setVoluntaryPartialAreaHa("");
    setSupportingDocs([]);
    setTransferReason("");
    setTransferSubmitError("");
    setTransferSubmitSuccess("");
    setIsSubmittingTransfer(false);
  };

  const openTransferModal = () => {
    resetTransferWorkflow();
    setShowTransferModal(true);
  };

  const closeTransferModal = () => {
    setShowTransferModal(false);
    resetTransferWorkflow();
  };

  const buildTransferItemsPayload = (
    parcels: LandParcel[],
    requestedAreaHa: number,
    takeAll: boolean,
  ) => {
    let remainingArea = requestedAreaHa;
    const items: Array<{
      land_parcel_id: number;
      land_history_id: number;
      parcel_number: string;
      farm_location_barangay: string;
      donor_area_ha: number;
      transferred_area_ha: number;
      scope: "take_all" | "partial";
    }> = [];

    parcels.forEach((parcel) => {
      const parcelArea = Number(parcel.total_farm_area_ha) || 0;
      const parcelId = Number(parcel.land_parcel_id);
      if (parcelArea <= 0 || !Number.isFinite(parcelId) || parcelId <= 0)
        return;

      const transferredArea = takeAll
        ? parcelArea
        : Math.min(parcelArea, Math.max(0, remainingArea));

      if (transferredArea <= 0) return;

      items.push({
        land_parcel_id: parcelId,
        land_history_id: parcel.id,
        parcel_number: parcel.parcel_number || "",
        farm_location_barangay: parcel.farm_location_barangay || "",
        donor_area_ha: parcelArea,
        transferred_area_ha: transferredArea,
        scope: transferredArea >= parcelArea ? "take_all" : "partial",
      });

      if (!takeAll) {
        remainingArea = Math.max(0, remainingArea - transferredArea);
      }
    });

    return items;
  };

  const verifyDonorParcelOwnership = async (
    donorFarmerId: number,
    parcels: SimpleParcel[],
  ) => {
    const uniqueParcelIds = Array.from(
      new Set(
        parcels
          .map((parcel) => Number(parcel.id))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    );

    if (uniqueParcelIds.length === 0) {
      return {
        verifiedParcels: [] as LandParcel[], // or [] as SimpleParcel[] if you change return type
        invalidParcelIds: [] as number[],
        verifiedAvailableAreaHa: 0,
      };
    }

    const { data, error } = await supabase
      .from("rsbsa_farm_parcels")
      .select("id, submission_id, total_farm_area_ha") // ← this is fine, we map later
      .in("id", uniqueParcelIds);

    if (error) {
      throw new Error(
        `Could not verify donor parcel ownership: ${error.message}`,
      );
    }

    const rows = Array.isArray(data) ? data : [];
    const ownedParcelAreaMap = new Map<number, number>();

    rows.forEach((row: any) => {
      const parcelId = Number(row.id);
      const ownerId = Number(row.submission_id);
      if (!Number.isFinite(parcelId) || !Number.isFinite(ownerId)) return;
      if (ownerId !== donorFarmerId) return;

      // Use total_farm_area_ha from DB, but you could also use parcel.area_ha if you want consistency
      ownedParcelAreaMap.set(parcelId, Number(row.total_farm_area_ha) || 0);
    });

    // Return structure – adjust as needed for your real logic
    return {
      verifiedParcels: [], // ← add your real verified logic here
      invalidParcelIds: [],
      verifiedAvailableAreaHa: 0,
    };
  };

  const uploadTransferProofs = async (files: File[]) => {
    const uploadedProofs: Array<{
      storage_bucket: string;
      storage_path: string;
      file_name: string;
      mime_type: string;
      file_size_bytes: number;
    }> = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `ownership-transfer-proofs/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}-${safeName}`;

      const { error } = await supabase.storage
        .from(TRANSFER_PROOF_BUCKET)
        .upload(storagePath, file, {
          contentType: file.type || "image/jpeg",
          upsert: false,
        });

      if (error) {
        if (uploadedProofs.length > 0) {
          await cleanupUploadedProofs(uploadedProofs);
        }
        if (/row-level security policy/i.test(error.message || "")) {
          throw new Error(
            "Proof upload blocked by Supabase Storage RLS. Run database/supabase_storage_ownership_transfer_policies.sql in Supabase SQL Editor, then try again.",
          );
        }
        throw new Error(`Proof upload failed (${file.name}): ${error.message}`);
      }

      uploadedProofs.push({
        storage_bucket: TRANSFER_PROOF_BUCKET,
        storage_path: storagePath,
        file_name: file.name || `proof-${index + 1}.jpg`,
        mime_type: file.type || "",
        file_size_bytes: Number(file.size) || 0,
      });
    }

    if (uploadedProofs.length === 0) {
      throw new Error("No proof files were uploaded.");
    }

    return uploadedProofs;
  };

  const cleanupUploadedProofs = async (
    proofs: Array<{ storage_bucket: string; storage_path: string }>,
  ) => {
    if (proofs.length === 0) return;

    const byBucket = proofs.reduce<Record<string, string[]>>((acc, proof) => {
      if (!proof.storage_bucket || !proof.storage_path) return acc;
      if (!acc[proof.storage_bucket]) acc[proof.storage_bucket] = [];
      acc[proof.storage_bucket].push(proof.storage_path);
      return acc;
    }, {});

    await Promise.all(
      Object.entries(byBucket).map(async ([bucket, paths]) => {
        if (paths.length === 0) return;
        await supabase.storage.from(bucket).remove(paths);
      }),
    );
  };

  const handleTransferConfirm = async () => {
    if (isSubmittingTransfer) return;

    setTransferSubmitError("");
    setTransferSubmitSuccess("");

    if (!transferReadyForReview) {
      setTransferSubmitError(
        transferBlockingReason ||
          "Please complete all required fields before submitting.",
      );
      return;
    }

    if (!transferMode || selectedContextFarmerId === null) {
      setTransferSubmitError("Missing transfer mode or current recipient.");
      return;
    }

    const isInheritance = transferMode === "inheritance";
    const fromFarmerId = isInheritance
      ? typeof beneficairyOwnerId === "number"
        ? beneficairyOwnerId
        : null
      : typeof sourceRegisteredOwnerId === "number"
        ? sourceRegisteredOwnerId
        : null;

    if (!fromFarmerId || fromFarmerId <= 0) {
      setTransferSubmitError("Please select a valid donor/source farmer.");
      return;
    }

    const toFarmerId = Number(selectedContextFarmerId);
    if (!Number.isFinite(toFarmerId) || toFarmerId <= 0) {
      setTransferSubmitError("Invalid current recipient.");
      return;
    }

    const areaMode = isInheritance ? inheritanceAreaMode : voluntaryAreaMode;
    const selectedAreaHa = isInheritance
      ? inheritanceSelectedAreaHa
      : voluntarySelectedAreaHa;

    setIsSubmittingTransfer(true);

    let uploadedProofs: Array<{
      storage_bucket: string;
      storage_path: string;
      file_name: string;
      mime_type: string;
      file_size_bytes: number;
    }> = [];

    try {
      const { verifiedParcels, invalidParcelIds, verifiedAvailableAreaHa } =
        await verifyDonorParcelOwnership(
          fromFarmerId,
          effectiveTransferParcels, // now matches SimpleParcel[]
        );

      if (invalidParcelIds.length > 0) {
        await refreshLandParcels();
        setTransferSubmitError(
          `Transfer list is outdated. These parcel IDs are no longer owned by the selected donor: ${invalidParcelIds.join(", ")}. Please review and confirm again.`,
        );
        return;
      }

      if (verifiedParcels.length === 0 || verifiedAvailableAreaHa <= 0) {
        await refreshLandParcels();
        setTransferSubmitError(
          "No transferable parcels remain for this donor. Please re-check donor selection.",
        );
        return;
      }

      if (areaMode === "partial" && selectedAreaHa > verifiedAvailableAreaHa) {
        await refreshLandParcels();
        setTransferSubmitError(
          `Selected transfer area (${selectedAreaHa.toFixed(2)} ha) exceeds donor's current available area (${verifiedAvailableAreaHa.toFixed(2)} ha). Please adjust and try again.`,
        );
        return;
      }

      const requestedAreaHa =
        areaMode === "take_all" ? verifiedAvailableAreaHa : selectedAreaHa;
      const itemPayload = buildTransferItemsPayload(
        verifiedParcels,
        requestedAreaHa,
        areaMode === "take_all",
      );

      if (itemPayload.length === 0) {
        setTransferSubmitError(
          "No valid parcel items to submit after ownership verification.",
        );
        return;
      }

      uploadedProofs = await uploadTransferProofs(supportingDocs);

      const { data, error } = await supabase.rpc(
        "create_ownership_transfer_no_review",
        {
          p_transfer_mode: transferMode,
          p_from_farmer_id: fromFarmerId,
          p_to_farmer_id: toFarmerId,
          p_source_role: "registered_owner",
          p_area_mode: areaMode,
          p_area_requested_ha: areaMode === "partial" ? requestedAreaHa : null,
          p_area_available_ha: verifiedAvailableAreaHa,
          p_transfer_reason: finalReasonPreview || null,
          p_transfer_date: new Date().toISOString().slice(0, 10),
          p_is_deceased_confirmed: isInheritance ? confirmBenefaciary : false,
          p_items: itemPayload,
          p_proofs: uploadedProofs,
        },
      );

      if (error) {
        const rpcCode = String((error as any)?.code || "");
        const rpcMessage = String(error?.message || "");
        const rpcDetails = String((error as any)?.details || "");
        if (
          /column\s+\"transfer_type\"\s+of relation\s+\"ownership_transfers\"\s+does not exist/i.test(
            `${rpcMessage} ${rpcDetails}`,
          )
        ) {
          throw new Error(
            "Supabase table ownership_transfers is missing required columns. Run database/create_ownership_transfer_no_review_rpc.sql in Supabase SQL Editor, then retry.",
          );
        }
        if (
          rpcCode === "PGRST202" ||
          /create_ownership_transfer_no_review/i.test(
            `${rpcMessage} ${rpcDetails}`,
          ) ||
          /404/.test(rpcMessage)
        ) {
          throw new Error(
            "Supabase RPC create_ownership_transfer_no_review is missing. Run database/create_ownership_transfer_no_review_rpc.sql in Supabase SQL Editor, then retry.",
          );
        }
        throw new Error(
          error.message || "Failed to create ownership transfer.",
        );
      }

      const transferId = Array.isArray(data) ? data[0] : data;
      setTransferSubmitSuccess(
        `Transfer submitted successfully${transferId ? ` (ID: ${transferId})` : ""}.`,
      );

      await refreshLandParcels();
      closeTransferModal();
    } catch (error: any) {
      if (uploadedProofs.length > 0) {
        await cleanupUploadedProofs(uploadedProofs);
      }
      setTransferSubmitError(
        error?.message || "Failed to submit ownership transfer.",
      );
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  const handleTransferModeChange = (mode: TransferMode) => {
    setTransferMode(mode);
    setSourceRegisteredOwnerId("");
    setBeneficairyOwnerId("");
    setConfirmBenefaciary(mode === "inheritance");
    setInheritanceAreaMode("take_all");
    setInheritancePartialAreaHa("");
    setVoluntaryAreaMode("take_all");
    setVoluntaryPartialAreaHa("");
  };

  const handleBeneficairyOwnerSelect = (value: string) => {
    const parsedId = Number(value);
    if (
      selectedContextFarmerId !== null &&
      parsedId === selectedContextFarmerId
    ) {
      setBeneficairyOwnerId("");
      setConfirmBenefaciary(false);
      setInheritanceAreaMode("take_all");
      setInheritancePartialAreaHa("");
      return;
    }

    setBeneficairyOwnerId(
      Number.isFinite(parsedId) && parsedId > 0 ? parsedId : "",
    );
    setConfirmBenefaciary(
      Number.isFinite(parsedId) &&
        parsedId > 0 &&
        !(
          selectedContextFarmerId !== null &&
          parsedId === selectedContextFarmerId
        ),
    );
    setInheritanceAreaMode("take_all");
    setInheritancePartialAreaHa("");
  };

  const handleInheritanceAreaModeChange = (mode: InheritanceAreaMode) => {
    setInheritanceAreaMode(mode);
    if (mode === "take_all") {
      setInheritancePartialAreaHa("");
      return;
    }

    const firstOption = inheritanceHectareOptions[0];
    setInheritancePartialAreaHa(
      typeof firstOption === "number" ? firstOption : "",
    );
  };

  const handleVoluntaryAreaModeChange = (mode: VoluntaryAreaMode) => {
    setVoluntaryAreaMode(mode);
    if (mode === "take_all") {
      setVoluntaryPartialAreaHa("");
      return;
    }

    const firstOption = voluntaryHectareOptions[0];
    setVoluntaryPartialAreaHa(
      typeof firstOption === "number" ? firstOption : "",
    );
  };

  const handleRegisteredOwnerSelect = (value: string) => {
    const parsedId = Number(value);
    if (
      selectedContextFarmerId !== null &&
      parsedId === selectedContextFarmerId
    ) {
      setSourceRegisteredOwnerId("");
      setVoluntaryAreaMode("take_all");
      setVoluntaryPartialAreaHa("");
      return;
    }
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      setSourceRegisteredOwnerId("");
      setVoluntaryAreaMode("take_all");
      setVoluntaryPartialAreaHa("");
      return;
    }

    setSourceRegisteredOwnerId(parsedId);
    setVoluntaryAreaMode("take_all");
    setVoluntaryPartialAreaHa("");
  };

  const handleDocsSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const incomingFiles = Array.from(event.target.files || []);
    if (incomingFiles.length === 0) return;

    const validFiles = incomingFiles.filter(
      (file) => file.type === "image/png" || file.type === "image/jpeg",
    );

    if (validFiles.length === 0) {
      event.target.value = "";
      return;
    }

    setSupportingDocs((prev) => {
      const merged = [...prev];
      validFiles.forEach((file) => {
        const duplicate = merged.some(
          (existing) =>
            existing.name === file.name &&
            existing.size === file.size &&
            existing.lastModified === file.lastModified,
        );
        if (!duplicate) merged.push(file);
      });
      return merged;
    });

    event.target.value = "";
  };

  const removeDoc = (targetIndex: number) => {
    setSupportingDocs((prev) =>
      prev.filter((_, index) => index !== targetIndex),
    );
  };

  return (
    <div className="jo-land-registry-page-container">
      <div className="jo-land-registry-page has-mobile-sidebar">
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
              <span className="nav-text">Incentives</span>
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

            <button
              className="sidebar-nav-item logout"
              onClick={() => navigate("/")}
            >
              <span className="nav-icon">
                <img src={LogoutIcon} alt="Logout" />
              </span>
              <span className="nav-text">Logout</span>
            </button>
          </nav>
        </div>
        <div className={`tech-incent-sidebar-overlay ${sidebarOpen ? 'active' : ''}`} onClick={() => setSidebarOpen(false)} />

        {/* Main Content */}
        <div className="jo-land-registry-main-content">
          <div className="tech-incent-mobile-header">
            <button className="tech-incent-hamburger" onClick={() => setSidebarOpen((prev) => !prev)}>☰</button>
            <div className="tech-incent-mobile-title">JO Land Registry</div>
          </div>
          {/* Header */}
          <div className="jo-land-registry-dashboard-header">
            <h1 className="jo-land-registry-page-title">🗺️ Land Registry</h1>
            <p className="jo-land-registry-page-subtitle">
              View land parcels and ownership history
            </p>
          </div>

          {/* Stats */}
          <div className="jo-land-registry-stats">
            <div className="jo-land-registry-stat-card">
              <h3>Total Parcels</h3>
              <p className="jo-land-registry-stat-number">
                {landParcels.length}
              </p>
            </div>
            <div className="jo-land-registry-stat-card">
              <h3>Barangays</h3>
              <p className="jo-land-registry-stat-number">
                {uniqueBarangays.length}
              </p>
            </div>
            <div className="jo-land-registry-stat-card">
              <h3>Owners</h3>
              <p className="jo-land-registry-stat-number">
                {landParcels.filter((p) => p.is_registered_owner).length}
              </p>
            </div>
            <div className="jo-land-registry-stat-card">
              <h3>Tenants/Lessees</h3>
              <p className="jo-land-registry-stat-number">
                {landParcels.filter((p) => p.is_tenant || p.is_lessee).length}
              </p>
            </div>
          </div>

          {/* Content Card */}
          <div className="jo-land-registry-content-card">
            {/* Filters */}
            <div className="jo-land-registry-filters-section">
              <div className="jo-land-registry-search-filter">
                <input
                  type="text"
                  className="jo-land-registry-search-input"
                  placeholder="🔍 Search by parcel number, owner name, or farmer name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="jo-land-registry-barangay-filter">
                <select
                  className="jo-land-registry-barangay-select"
                  value={filterBarangay}
                  onChange={(e) => setFilterBarangay(e.target.value)}
                >
                  <option value="">All Barangays</option>
                  {uniqueBarangays.map((brgy) => (
                    <option key={brgy} value={brgy}>
                      {brgy}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="jo-land-registry-table-container">
              <table className="jo-land-registry-table">
                <thead>
                  <tr>
                    <th>FFRS Code</th>
                    <th>Current Holder</th>
                    <th>Ownership Type</th>
                    <th>Barangay</th>
                    <th>Area (ha)</th>
                    <th>Since</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="jo-land-registry-loading-cell">
                        Loading land parcels...
                      </td>
                    </tr>
                  ) : filteredParcels.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="jo-land-registry-empty-cell">
                        {searchTerm || filterBarangay
                          ? "No parcels match your search criteria"
                          : "No land parcels registered yet"}
                      </td>
                    </tr>
                  ) : (
                    filteredParcels.map((parcel) => (
                      <tr
                        key={parcel.id}
                        onClick={() => handleParcelSelect(parcel)}
                        className={
                          selectedParcel?.id === parcel.id ? "selected" : ""
                        }
                      >
                        <td>
                          <strong>{parcel.ffrs_code || "—"}</strong>
                        </td>
                        <td>
                          {parcel.farmer_name || parcel.land_owner_name || "—"}
                        </td>
                        <td>
                          <span
                            className={`jo-land-registry-ownership-pill jo-land-registry-ownership-${getOwnershipClass(parcel)}`}
                          >
                            {getOwnershipType(parcel)}
                          </span>
                        </td>
                        <td>{parcel.farm_location_barangay || "—"}</td>
                        <td>{parcel.total_farm_area_ha?.toFixed(2) || "0"}</td>
                        <td>{formatDate(parcel.period_start_date)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Detail Modal */}
        {showModal && selectedParcel && (
          <div
            className="jo-land-registry-modal-overlay"
            onClick={() => setShowModal(false)}
          >
            <div
              className="jo-land-registry-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="jo-land-registry-modal-header">
                <h3>📋 Land Parcel Details</h3>
                <button
                  className="jo-land-registry-close-button"
                  onClick={() => setShowModal(false)}
                >
                  ×
                </button>
              </div>
              <div className="jo-land-registry-modal-body">
                {/* Current Owner Section */}
                <div className="jo-land-registry-detail-section">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "1rem",
                    }}
                  >
                    <h4 style={{ margin: 0 }}>👤 Current Holder</h4>
                    <div
                      className="jo-land-registry-transfer-section"
                      style={{
                        padding: "0.25rem 0.5rem",
                        backgroundColor: "#e3f2fd",
                        borderRadius: "6px",
                      }}
                    >
                      <button
                        className="jo-land-registry-transfer-button"
                        style={{ cursor: "pointer" }}
                        onClick={openTransferModal}
                      >
                        🔄 Transfer Ownership
                      </button>
                    </div>
                  </div>
                  <div className="jo-land-registry-owner-card">
                    <div className="jo-land-registry-owner-avatar">
                      {getOwnershipIcon(selectedParcel)}
                    </div>
                    <div className="jo-land-registry-owner-details">
                      <h4>
                        {selectedParcel.farmer_name ||
                          selectedParcel.land_owner_name ||
                          "Unknown"}
                      </h4>
                      <span className="jo-land-registry-owner-type">
                        {getOwnershipType(selectedParcel)}
                      </span>
                    </div>
                  </div>
                  <div className="jo-land-registry-info-grid">
                    <div className="jo-land-registry-info-item">
                      <span className="jo-land-registry-info-label">
                        FFRS Code
                      </span>
                      <span className="jo-land-registry-info-value">
                        {selectedParcel.ffrs_code || "—"}
                      </span>
                    </div>
                    <div className="jo-land-registry-info-item">
                      <span className="jo-land-registry-info-label">
                        Parcel Number
                      </span>
                      <span className="jo-land-registry-info-value">
                        {selectedParcel.parcel_number ||
                          `#${selectedParcel.id}`}
                      </span>
                    </div>
                    <div className="jo-land-registry-info-item">
                      <span className="jo-land-registry-info-label">
                        Total Area
                      </span>
                      <span className="jo-land-registry-info-value">
                        {selectedParcel.total_farm_area_ha?.toFixed(2) || "0"}{" "}
                        hectares
                      </span>
                    </div>
                    <div className="jo-land-registry-info-item">
                      <span className="jo-land-registry-info-label">
                        Barangay
                      </span>
                      <span className="jo-land-registry-info-value">
                        {selectedParcel.farm_location_barangay || "—"}
                      </span>
                    </div>
                    <div className="jo-land-registry-info-item">
                      <span className="jo-land-registry-info-label">
                        Municipality
                      </span>
                      <span className="jo-land-registry-info-value">
                        {selectedParcel.farm_location_municipality ||
                          "Dumangas"}
                      </span>
                    </div>
                    <div className="jo-land-registry-info-item">
                      <span className="jo-land-registry-info-label">
                        Effective Since
                      </span>
                      <span className="jo-land-registry-info-value">
                        {formatDate(selectedParcel.period_start_date)}
                      </span>
                    </div>
                    {selectedParcel.land_owner_name &&
                      !selectedParcel.is_registered_owner && (
                        <div className="jo-land-registry-info-item">
                          <span className="jo-land-registry-info-label">
                            Land Owner
                          </span>
                          <span className="jo-land-registry-info-value">
                            {selectedParcel.land_owner_name}
                          </span>
                        </div>
                      )}
                  </div>
                </div>

                {/* History Section */}
                <div className="jo-land-registry-detail-section">
                  <h4>📜 Ownership History</h4>
                  {historyLoading ? (
                    <div className="jo-land-registry-no-history">
                      Loading history...
                    </div>
                  ) : parcelHistory.length === 0 ? (
                    <div className="jo-land-registry-no-history">
                      No history records found
                    </div>
                  ) : (
                    <div className="jo-land-registry-history-list">
                      {parcelHistory.map((record, index) => (
                        <div
                          key={record.id}
                          className={`jo-land-registry-history-item ${record.is_current ? "current" : ""}`}
                        >
                          <div className="jo-land-registry-history-number">
                            {index + 1}
                          </div>
                          <div
                            className={`jo-land-registry-history-badge ${getOwnershipClass(record)}`}
                          >
                            {getOwnershipType(record)}
                          </div>
                          <div className="jo-land-registry-history-details">
                            <span className="jo-land-registry-history-name">
                              {record.farmer_name ||
                                record.land_owner_name ||
                                "Unknown"}
                              {record.is_current && (
                                <span className="jo-land-registry-current-tag">
                                  Current
                                </span>
                              )}
                            </span>
                            <span className="jo-land-registry-history-meta">
                              <span>
                                📅 {formatDate(record.period_start_date)} -{" "}
                                {formatDate(record.period_end_date)}
                              </span>
                              {record.change_reason && (
                                <span>📝 {record.change_reason}</span>
                              )}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Info Note */}
                <div className="jo-land-registry-info-note">
                  <span className="jo-land-registry-note-icon">ℹ️</span>
                  <span className="jo-land-registry-note-text">
                    Ownership changes are recorded through RSBSA registrations.
                    For official land transfers, please contact the Municipal
                    Agriculture Office.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Transfer Ownership Modal */}
        {showTransferModal && selectedParcel && (
          <div
            className="jo-land-registry-modal-overlay"
            onClick={closeTransferModal}
          >
            <div
              className="jo-land-registry-modal jo-land-registry-transfer-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="jo-land-registry-modal-header jo-land-registry-transfer-header">
                <h3>Transfer Ownership</h3>
                <button
                  className="jo-land-registry-close-button"
                  onClick={closeTransferModal}
                >
                  ×
                </button>
              </div>
              <div className="jo-land-registry-modal-body">
                <div className="jo-land-registry-transfer-flow">
                  <div className="jo-land-registry-transfer-note">
                    <strong>Scope:</strong> Transfer applies immediately to
                    parcel ownership and proof image records.
                  </div>
                  {transferSubmitError && (
                    <div
                      className="jo-land-registry-transfer-note"
                      style={{
                        borderColor: "#fecaca",
                        borderLeftColor: "#dc2626",
                        background: "#fef2f2",
                        color: "#991b1b",
                      }}
                    >
                      <strong>Transfer Error:</strong> {transferSubmitError}
                    </div>
                  )}
                  {transferSubmitSuccess && (
                    <div
                      className="jo-land-registry-transfer-note"
                      style={{
                        borderColor: "#bbf7d0",
                        borderLeftColor: "#16a34a",
                        background: "#f0fdf4",
                        color: "#166534",
                      }}
                    >
                      <strong>Success:</strong> {transferSubmitSuccess}
                    </div>
                  )}

                  <div className="jo-land-registry-transfer-section-card">
                    <h4>Current Context</h4>
                    <div className="jo-land-registry-transfer-kv">
                      <span>Opened From Parcel</span>
                      <strong>
                        {selectedParcel.parcel_number ||
                          `#${selectedParcel.id}`}
                      </strong>
                    </div>
                    <div className="jo-land-registry-transfer-kv">
                      <span>Current Holder</span>
                      <strong>
                        {selectedParcel.farmer_name ||
                          selectedParcel.land_owner_name ||
                          "Unknown"}
                      </strong>
                    </div>
                  </div>

                  <div className="jo-land-registry-transfer-section-card">
                    <h4>Step 1: Transfer Type</h4>
                    <div className="jo-land-registry-transfer-choice-grid">
                      <button
                        type="button"
                        className={`jo-land-registry-transfer-choice ${transferMode === "voluntary" ? "active" : ""}`}
                        onClick={() => handleTransferModeChange("voluntary")}
                      >
                        Voluntary Transfer
                      </button>
                      <button
                        type="button"
                        className={`jo-land-registry-transfer-choice ${transferMode === "inheritance" ? "active" : ""}`}
                        onClick={() => handleTransferModeChange("inheritance")}
                      >
                        Inheritance
                      </button>
                    </div>
                  </div>

                  <div className="jo-land-registry-transfer-section-card">
                    <h4>Recipient (Fixed)</h4>
                    <div className="jo-land-registry-transfer-kv">
                      <span>Will Receive Transfer</span>
                      <strong>{selectedContextFarmerName}</strong>
                    </div>
                    <div className="jo-land-registry-transfer-mini-note">
                      Recipient is auto-set from the opened parcel holder.
                    </div>
                  </div>

                  {transferMode === "voluntary" && (
                    <div className="jo-land-registry-transfer-section-card">
                      <h4>Step 2: Select Voluntary Donor</h4>
                      <label className="jo-land-registry-transfer-label">
                        Land Owner (Donor)
                      </label>
                      <select
                        className="jo-land-registry-transfer-select"
                        value={
                          selectedRegisteredOwner ? sourceRegisteredOwnerId : ""
                        }
                        onChange={(e) =>
                          handleRegisteredOwnerSelect(e.target.value)
                        }
                      >
                        <option value="">Choose land owner...</option>
                        {voluntaryDonorOptions.map((owner) => (
                          <option key={owner.farmerId} value={owner.farmerId}>
                            {owner.name} ({owner.parcelCount} parcel
                            {owner.parcelCount > 1 ? "s" : ""})
                          </option>
                        ))}
                      </select>

                      {selectedContextFarmerId !== null && (
                        <div className="jo-land-registry-transfer-mini-note">
                          The selected farmer is excluded from donor options to
                          prevent self-transfer.
                        </div>
                      )}

                      {selectedRegisteredOwner &&
                        voluntaryTransferParcels.length > 0 && (
                          <div className="jo-land-registry-transfer-parcel-box">
                            <div className="jo-land-registry-transfer-subheading">
                              Donor Parcels
                            </div>
                            <ul className="jo-land-registry-transfer-list">
                              {voluntaryTransferParcels.map((parcel) => (
                                <li key={parcel.id}>
                                  {parcel.parcel_number || `#${parcel.id}`} -{" "}
                                  {parcel.farm_location_barangay} (
                                  {parcel.total_farm_area_ha.toFixed(2)} ha)
                                </li>
                              ))}
                            </ul>

                            <label className="jo-land-registry-transfer-label">
                              How Much Land Is Transferred?
                            </label>
                            <div className="jo-land-registry-transfer-choice-grid">
                              <button
                                type="button"
                                className={`jo-land-registry-transfer-choice ${voluntaryAreaMode === "take_all" ? "active" : ""}`}
                                onClick={() =>
                                  handleVoluntaryAreaModeChange("take_all")
                                }
                              >
                                Take All ({voluntaryDonorTotalAreaHa.toFixed(2)}{" "}
                                ha)
                              </button>
                              <button
                                type="button"
                                className={`jo-land-registry-transfer-choice ${voluntaryAreaMode === "partial" ? "active" : ""}`}
                                onClick={() =>
                                  handleVoluntaryAreaModeChange("partial")
                                }
                              >
                                Choose Hectares
                              </button>
                            </div>

                            {voluntaryAreaMode === "partial" && (
                              <>
                                <label className="jo-land-registry-transfer-label">
                                  Transfer Area (ha)
                                </label>
                                <select
                                  className="jo-land-registry-transfer-select"
                                  value={voluntaryPartialAreaHa}
                                  onChange={(e) => {
                                    const parsedValue = Number(e.target.value);
                                    setVoluntaryPartialAreaHa(
                                      Number.isFinite(parsedValue) &&
                                        parsedValue > 0
                                        ? parsedValue
                                        : "",
                                    );
                                  }}
                                >
                                  <option value="">Choose hectares...</option>
                                  {voluntaryHectareOptions.map((value) => (
                                    <option key={value} value={value}>
                                      {value} hectare{value > 1 ? "s" : ""}
                                    </option>
                                  ))}
                                </select>
                                {voluntaryHectareOptions.length === 0 && (
                                  <div className="jo-land-registry-transfer-mini-note">
                                    No whole-hectare options available. Use{" "}
                                    <strong>Take All</strong>.
                                  </div>
                                )}
                              </>
                            )}

                            <div className="jo-land-registry-transfer-mini-note">
                              Transfer amount preview:{" "}
                              <strong>
                                {voluntarySelectedAreaHa.toFixed(2)} ha
                              </strong>{" "}
                              of{" "}
                              <strong>
                                {voluntaryDonorTotalAreaHa.toFixed(2)} ha
                              </strong>
                              .
                            </div>
                          </div>
                        )}
                    </div>
                  )}

                  {transferMode === "inheritance" && (
                    <div className="jo-land-registry-transfer-section-card">
                      <h4>Step 2: Select Beneficiary Land Owner</h4>

                      <label className="jo-land-registry-transfer-label">
                        Land Owner (Donor)
                      </label>
                      <select
                        className="jo-land-registry-transfer-select"
                        value={
                          selectedBeneficiaryOwner ? beneficairyOwnerId : ""
                        }
                        onChange={(e) =>
                          handleBeneficairyOwnerSelect(e.target.value)
                        }
                      >
                        <option value="">Choose land owner...</option>
                        {inheritanceDonorOptions.map((owner) => (
                          <option key={owner.farmerId} value={owner.farmerId}>
                            {owner.name} ({owner.parcelCount} parcel
                            {owner.parcelCount > 1 ? "s" : ""})
                          </option>
                        ))}
                      </select>
                      {selectedContextFarmerId !== null && (
                        <div className="jo-land-registry-transfer-mini-note">
                          The selected farmer is excluded from donor options to
                          prevent self-transfer.
                        </div>
                      )}

                      {/* ONLY SHOW AFTER BENEFICIARY IS SELECTED */}
                      {beneficairyOwnerId &&
                        inheritanceTransferParcels.length > 0 && (
                          <div className="jo-land-registry-transfer-parcel-box">
                            <div className="jo-land-registry-transfer-subheading">
                              Beneficiary Parcels
                            </div>

                            <ul className="jo-land-registry-transfer-list">
                              {inheritanceTransferParcels.map((parcel) => (
                                <li key={parcel.id}>
                                  {parcel.parcel_number || `#${parcel.id}`} -{" "}
                                  {parcel.farm_location_barangay} (
                                  {parcel.total_farm_area_ha.toFixed(2)} ha)
                                </li>
                              ))}
                            </ul>

                            {/* ←←← THIS IS THE FIX: Choice buttons now appear immediately */}
                            <div className="jo-land-registry-option-bar">
                              <div className="jo-land-registry-farmer-parcel-split">
                                <button
                                  type="button"
                                  className={`jo-land-registry-transfer-choice ${inheritanceAreaMode === "partial" ? "active" : ""}`}
                                  onClick={() =>
                                    handleInheritanceAreaModeChange("partial")
                                  }
                                >
                                  Choose Hectares
                                </button>
                              </div>
                              <div className="jo-land-registry-farmer-parcel-take-all">
                                <button
                                  type="button"
                                  className={`jo-land-registry-transfer-choice ${inheritanceAreaMode === "take_all" ? "active" : ""}`}
                                  onClick={() =>
                                    handleInheritanceAreaModeChange("take_all")
                                  }
                                >
                                  Take All (
                                  {inheritanceDonorTotalAreaHa.toFixed(2)} ha)
                                </button>
                              </div>
                            </div>

                            {/* Partial area selector - only when "Choose Hectares" is active */}
                            {inheritanceAreaMode === "partial" && (
                              <>
                                <label className="jo-land-registry-transfer-label">
                                  Inherited Area (ha)
                                </label>
                                <select
                                  className="jo-land-registry-transfer-select"
                                  value={inheritancePartialAreaHa}
                                  onChange={(e) => {
                                    const parsedValue = Number(e.target.value);
                                    setInheritancePartialAreaHa(
                                      Number.isFinite(parsedValue) &&
                                        parsedValue > 0
                                        ? parsedValue
                                        : "",
                                    );
                                  }}
                                >
                                  <option value="">Choose hectares...</option>
                                  {inheritanceHectareOptions.map((value) => (
                                    <option key={value} value={value}>
                                      {value} hectare{value > 1 ? "s" : ""}
                                    </option>
                                  ))}
                                </select>
                              </>
                            )}

                            <div className="jo-land-registry-transfer-mini-note">
                              Inheritance amount preview:{" "}
                              <strong>
                                {inheritanceSelectedAreaHa.toFixed(2)} ha
                              </strong>{" "}
                              of{" "}
                              <strong>
                                {inheritanceDonorTotalAreaHa.toFixed(2)} ha
                              </strong>
                              .
                            </div>
                          </div>
                        )}
                    </div>
                  )}

                  {(transferMode === "voluntary" ||
                    transferMode === "inheritance") && (
                    <div className="jo-land-registry-transfer-section-card">
                      <h4>
                        {transferMode === "voluntary"
                          ? "Step 3: Supporting Documents"
                          : "Step 3: Supporting Documents"}
                      </h4>
                      <label className="jo-land-registry-transfer-label">
                        Upload proof photo(s) - PNG/JPG (multiple)
                      </label>
                      <input
                        type="file"
                        accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                        multiple
                        onChange={handleDocsSelected}
                        className="jo-land-registry-transfer-file-input"
                      />

                      {supportingDocs.length > 0 && (
                        <ul className="jo-land-registry-transfer-doc-list">
                          {supportingDocs.map((doc, index) => (
                            <li
                              key={`${doc.name}-${doc.lastModified}-${index}`}
                            >
                              <span>
                                {doc.name} ({(doc.size / 1024).toFixed(1)} KB)
                              </span>
                              <button
                                type="button"
                                onClick={() => removeDoc(index)}
                              >
                                Remove
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {(transferMode === "voluntary" ||
                    transferMode === "inheritance") && (
                    <div className="jo-land-registry-transfer-section-card">
                      <h4>
                        {transferMode === "voluntary"
                          ? "Step 4: Reason + Review"
                          : "Step 4: Reason + Review"}
                      </h4>
                      <label className="jo-land-registry-transfer-label">
                        Reason (Optional)
                      </label>
                      <textarea
                        className="jo-land-registry-transfer-textarea"
                        placeholder="Add optional note..."
                        value={transferReason}
                        onChange={(e) => setTransferReason(e.target.value)}
                      />

                      <div className="jo-land-registry-transfer-mini-note">
                        Applied reason preview:{" "}
                        <strong>{finalReasonPreview || "No reason yet"}</strong>
                      </div>

                      <div className="jo-land-registry-transfer-review">
                        <div className="jo-land-registry-transfer-kv">
                          <span>Transfer Type</span>
                          <strong>{transferModeLabel}</strong>
                        </div>
                        <div className="jo-land-registry-transfer-kv">
                          <span>From</span>
                          <strong>
                            {selectedSource?.name || "Not selected"}
                          </strong>
                        </div>
                        <div className="jo-land-registry-transfer-kv">
                          <span>To</span>
                          <strong>{selectedContextFarmerName}</strong>
                        </div>
                        <div className="jo-land-registry-transfer-kv">
                          <span>Parcels</span>
                          <strong>{effectiveTransferParcels.length}</strong>
                        </div>
                        <div className="jo-land-registry-transfer-kv">
                          <span>Transfer Area</span>
                          <strong>
                            {transferMode === "inheritance"
                              ? `${inheritanceSelectedAreaHa.toFixed(2)} ha`
                              : `${voluntarySelectedAreaHa.toFixed(2)} ha`}
                          </strong>
                        </div>
                        <div className="jo-land-registry-transfer-kv">
                          <span>Effectivity</span>
                          <strong>Immediate</strong>
                        </div>
                      </div>

                      {effectiveTransferParcels.length > 0 && (
                        <ul className="jo-land-registry-transfer-list">
                          {effectiveTransferParcels.map((parcel) => (
                            <li key={parcel.id}>
                              {parcel.parcel_number || `#${parcel.id}`} -{" "}
                              {parcel.farm_location_barangay} (
                              {parcel.total_farm_area_ha.toFixed(2)} ha)
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {!transferReadyForReview && transferBlockingReason && (
                    <div className="jo-land-registry-transfer-mini-note">
                      <strong>Before confirming:</strong>{" "}
                      {transferBlockingReason}
                    </div>
                  )}

                  <div className="jo-land-registry-transfer-actions">
                    <button
                      type="button"
                      className="jo-land-registry-transfer-cancel"
                      onClick={closeTransferModal}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="jo-land-registry-transfer-confirm"
                      onClick={handleTransferConfirm}
                      disabled={!transferReadyForReview || isSubmittingTransfer}
                      title={
                        transferReadyForReview
                          ? "Ready to submit transfer"
                          : transferBlockingReason
                      }
                    >
                      {isSubmittingTransfer
                        ? "Submitting..."
                        : "Confirm Transfer"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JoLandRegistry;
