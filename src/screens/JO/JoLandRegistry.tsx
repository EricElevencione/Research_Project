import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../supabase";
import {
  usePartialTransfer,
  ParcelSplitInput,
} from "../../components/land_registry/usePartialTransfer";
import { PartialParcelTransferSection } from "../../components/land_registry/PartialParcelTransferSection";
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
  farm_parcel_id: number | null;
  farmer_id: number | null;
  parcel_number: string;
  farm_location_barangay: string;
  total_farm_area_ha: number;
  transferred_area_ha: number | null;
  remaining_area_ha: number | null;
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
  notes: string | null;
  previous_history_id: number | null;
}

interface ProofItem {
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  mime_type?: string;
  file_size_bytes?: number;
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
    farm_location_barangay: string; // ← match real name
    farm_location_municipality: string; // ← match real name
    total_farm_area_ha: number; // ← match real name
    is_registered_owner?: boolean; // optional if not always present
    is_tenant?: boolean;
    is_lessee?: boolean;
    parent_parcel_id?: number | null; // references donor parcel for splits
    split_origin_area_ha?: number | null; // original area before split
  }>;
  total_farm_area_ha: number;
  last_updated: string;
  has_registered_owner: boolean;
  has_tenant: boolean;
  has_lessee: boolean;
}

type TransferMode = "voluntary" | "inheritance";
type VoluntaryRole = "registered_owner" | "tenant" | "lessee";
type InheritanceAreaMode = "take_all" | "partial";
const TRANSFER_PROOF_BUCKET = "ownership-transfer-proofs";

const JoLandRegistry: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // State
  const [aggregatedFarmers, setAggregatedFarmers] = useState<FarmerGroup[]>([]);
  const [selectedFarmer, setSelectedFarmer] = useState<FarmerGroup | null>(
    null,
  );
  const [landParcels, setLandParcels] = useState<LandParcel[]>([]);
  const [selectedParcel, setSelectedParcel] = useState<LandParcel | null>(null);
  const [parcelHistory, setParcelHistory] = useState<LandHistoryRecord[]>([]);
  const [farmerNameMap, setFarmerNameMap] = useState<Map<number, string>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBarangay, setFilterBarangay] = useState("");
  const [showModal, setShowModal] = useState(false);

  // Proof viewer state
  const [transferProofMap, setTransferProofMap] = useState<
    Map<string, ProofItem[]>
  >(new Map());
  const [transferProofByRecipient, setTransferProofByRecipient] = useState<
    Map<string, ProofItem[]>
  >(new Map());
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<
    { url: string; name: string }[]
  >([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxLoading, setLightboxLoading] = useState(false);

  // Transfer Ownership State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferMode, setTransferMode] = useState<TransferMode | "">("");
  const [sourceRegisteredOwnerId, setSourceRegisteredOwnerId] = useState<
    number | ""
  >("");
  const [sourceLinkedLandOwnerName, setSourceLinkedLandOwnerName] =
    useState("");
  const [sourceTenantId, setSourceTenantId] = useState<number | "">("");
  const [sourceLesseeId, setSourceLesseeId] = useState<number | "">("");
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
  const [selectedTransferParcelIds, setSelectedTransferParcelIds] = useState<
    number[]
  >([]);
  const [supportingDocs, setSupportingDocs] = useState<File[]>([]);
  const [transferReason, setTransferReason] = useState("");
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);
  const [transferSubmitError, setTransferSubmitError] = useState("");
  const [transferSubmitSuccess, setTransferSubmitSuccess] = useState("");

  const {
    parcelScope,
    setParcelScope,
    parcelSplitInputs,
    setParcelTransferArea,
    initSplitInputs,
    resetPartialState,
    validateSplitInputs,
    executePartialTransfers,
    partialSubmitting,
    partialError,
    setPartialError,
  } = usePartialTransfer();

  const isActive = (path: string) => location.pathname === path;

  const refreshLandParcels = useCallback(async () => {
    setLoading(true);
    console.log("[FETCH START] Starting refresh...");

    try {
      const { data, error } = await supabase
        .from("farmer_aggregated_unified")
        .select("*")
        .order("farmer_name", { ascending: true });

      if (error) {
        console.error("[FETCH ERROR]", error);
        return;
      }

      console.log("[FETCH SUCCESS] Raw data received:", data);
      setAggregatedFarmers(data || []);
      console.log(
        "[STATE SET] Set aggregatedFarmers to length:",
        data?.length || 0,
      );
    } catch (err) {
      console.error("[FETCH CRASH]", err);
    } finally {
      setLoading(false);
      console.log("[FETCH END] Loading set to false");
    }
  }, []);

  // Fetch all land parcels with current owners
  useEffect(() => {
    console.log("Fetching aggregated farmers...");
    refreshLandParcels();
  }, [refreshLandParcels]);

  // Fetch history when a parcel is selected (using land_parcel_id for reliable linking)
  const fetchParcelHistory = async (
    landParcelId: number,
    parcelNumber: string,
  ) => {
    setHistoryLoading(true);
    try {
      // Use land_parcel_id if available, fallback to parcel_number
      let query = supabase.from("land_history").select("*");

      if (landParcelId) {
        // Support both historical schemas: land_parcel_id and farm_parcel_id.
        query = query.or(
          `land_parcel_id.eq.${landParcelId},farm_parcel_id.eq.${landParcelId}`,
        );
      } else {
        query = query.eq("parcel_number", parcelNumber);
      }

      const { data, error } = await query.order("period_start_date", {
        ascending: false,
      });

      if (error) {
        console.error("Error fetching parcel history:", error);
      } else {
        setParcelHistory(data || []);
        console.log(
          "✅ Loaded",
          data?.length,
          "history records for parcel ID:",
          landParcelId,
        );
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Handle parcel selection
  const handleFarmerSelect = (group: FarmerGroup) => {
    console.log(
      "handleFarmerSelect called for:",
      group.farmer_name,
      group.farmer_id,
    );

    setSelectedFarmer(group);
    console.log("setSelectedFarmer called");

    const parcelIds = group.parcels.map((p) => p.id);
    console.log("Fetching history for parcel IDs:", parcelIds);

    fetchParcelHistoryForIds(parcelIds);
    console.log("fetchParcelHistoryForIds called");

    setShowModal(true);
    console.log("setShowModal(true) called");
  };

  const fetchParcelHistoryForIds = async (parcelIds: number[]) => {
    setHistoryLoading(true);
    try {
      // Query both land_parcel_id and farm_parcel_id since transfer RPCs use farm_parcel_id
      const orFilter = parcelIds
        .map((id) => `land_parcel_id.eq.${id},farm_parcel_id.eq.${id}`)
        .join(",");

      const { data, error } = await supabase
        .from("land_history")
        .select("*")
        .or(orFilter)
        .order("period_start_date", { ascending: false });

      if (error) throw error;
      const raw: LandHistoryRecord[] = data || [];

      // Only show actual ownership change events — hide initial registration rows.
      const records = raw.filter(
        (rec) => (rec.change_type || "").toUpperCase() !== "NEW",
      );
      setParcelHistory(records);

      // Extract all farmer IDs referenced in notes (e.g. "from farmer 3", "to farmer 7")
      const referencedIds = new Set<number>();
      records.forEach((r) => {
        if (r.farmer_id) referencedIds.add(r.farmer_id);
        if (r.notes) {
          const matches = r.notes.matchAll(/(from|to) farmer (\d+)/gi);
          for (const m of matches) referencedIds.add(Number(m[2]));
        }
      });

      const idArray = Array.from(referencedIds);

      if (idArray.length > 0) {
        // Fetch farmer names and ownership_transfers proofs in parallel
        const [farmerRowsResult, transfersResult] = await Promise.all([
          supabase
            .from("rsbsa_submission")
            .select(`id, "FIRST NAME", "MIDDLE NAME", "LAST NAME", "EXT NAME"`)
            .in("id", idArray),
          supabase
            .from("ownership_transfers")
            .select("from_farmer_id, to_farmer_id, transfer_date, documents")
            .or(
              idArray
                .map((id) => `from_farmer_id.eq.${id},to_farmer_id.eq.${id}`)
                .join(","),
            ),
        ]);

        const nameMap = new Map<number, string>();
        (farmerRowsResult.data || []).forEach((row: any) => {
          const full = [
            row["FIRST NAME"],
            row["MIDDLE NAME"],
            row["LAST NAME"],
            row["EXT NAME"],
          ]
            .filter(Boolean)
            .join(" ");
          nameMap.set(Number(row.id), full);
        });
        setFarmerNameMap(nameMap);

        // Build proof lookup map keyed by "fromId-toId" (no date — period_start_date
        // is the original registration date, not the transfer date, so dates diverge).
        // Also build a recipient-only fallback map keyed by "toId".
        const proofMap = new Map<string, ProofItem[]>();
        const proofMapByRecipient = new Map<string, ProofItem[]>();
        (transfersResult.data || []).forEach((row: any) => {
          const fromId = Number(row.from_farmer_id);
          const toId = Number(row.to_farmer_id);
          if (!fromId || !toId) return;
          const proofs: ProofItem[] = Array.isArray(row.documents)
            ? row.documents
            : [];
          if (proofs.length === 0) return;
          proofMap.set(`${fromId}-${toId}`, proofs);
          // Recipient fallback: store all proofs received by toId
          const existing = proofMapByRecipient.get(String(toId)) ?? [];
          proofMapByRecipient.set(String(toId), [...existing, ...proofs]);
        });
        setTransferProofMap(proofMap);
        setTransferProofByRecipient(proofMapByRecipient);
      }
    } catch (err) {
      console.error("History fetch error:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Fetch signed URLs for proofs and open lightbox
  const handleViewProof = async (proofs: ProofItem[]) => {
    setLightboxLoading(true);
    setLightboxImages([]);
    setLightboxIndex(0);
    setLightboxOpen(true);
    try {
      const signedUrls = await Promise.all(
        proofs.map(async (proof) => {
          const { data, error } = await supabase.storage
            .from(proof.storage_bucket || TRANSFER_PROOF_BUCKET)
            .createSignedUrl(proof.storage_path, 3600);
          return {
            url: error || !data?.signedUrl ? "" : data.signedUrl,
            name:
              proof.file_name || proof.storage_path.split("/").pop() || "proof",
          };
        }),
      );
      setLightboxImages(signedUrls.filter((img) => img.url));
    } catch (err) {
      console.error("Proof URL fetch error:", err);
    } finally {
      setLightboxLoading(false);
    }
  };
  // Get ownership type label
  const getOwnershipType = (record: LandParcel | LandHistoryRecord) => {
    if (record.is_registered_owner) return "Owner";
    if (record.is_tenant) return "Tenant";
    if (record.is_lessee) return "Lessee";
    return "Unknown";
  };

  // Get ownership class
  const getOwnershipClass = (record: LandParcel | LandHistoryRecord) => {
    if (record.is_registered_owner) return "owner";
    if (record.is_tenant) return "tenant";
    if (record.is_lessee) return "lessee";
    return "";
  };

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Present";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Get unique barangays for filter
  const uniqueBarangays = [
    ...new Set(
      landParcels.map((p) => p.farm_location_barangay).filter(Boolean),
    ),
  ].sort();

  // Filter parcels

  // Build transfer actor options (for dropdowns) from aggregated farmers
  const buildTransferActorOptions = (
    farmers: FarmerGroup[],
    excludeFarmerId?: number, // ← second parameter (optional)
  ): TransferActorOption[] => {
    return farmers
      .filter((group) => {
        // Exclude the current clicked farmer to prevent self-transfer
        if (excludeFarmerId && group.farmer_id === excludeFarmerId) {
          return false;
        }
        return true;
      })
      .map((group) => ({
        farmerId: group.farmer_id,
        name: group.farmer_name || `Farmer #${group.farmer_id}`,
        barangay: group.parcels[0]?.farm_location_barangay || "",
        parcelIds: group.parcels.map((p) => p.id),
        parcelCount: group.parcels.length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const filteredFarmers = useMemo(() => {
    return aggregatedFarmers.filter((group) => {
      // Your filter logic here (from previous messages)

      if (group.parcels.length === 0) return false;
      if (group.total_farm_area_ha <= 0) return false;

      const lowerSearch = searchTerm.toLowerCase();
      if (group.farmer_name.toLowerCase().includes(lowerSearch)) return true;
      return group.parcels.some((p) =>
        p.parcel_number.toLowerCase().includes(lowerSearch),
      );
    });
  }, [aggregatedFarmers, searchTerm]); // Dependencies

  const registeredOwnerParcels = landParcels.filter(
    (p) => p.is_registered_owner,
  );

  const selectedContextFarmerId = selectedFarmer?.farmer_id ?? null;
  const selectedContextFarmerName = selectedFarmer?.farmer_name || "Unknown";

  // Build donor options and exclude the current farmer
  const registeredOwnerOptions = useMemo(() => {
    return buildTransferActorOptions(
      aggregatedFarmers,
      selectedContextFarmerId ?? undefined, // ← This fixes the type error
    );
  }, [aggregatedFarmers, selectedContextFarmerId]);

  // Use the same options for both modes
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
    ? registeredOwnerParcels.filter(
        (p) => p.farmer_id === selectedBeneficiaryOwner.farmerId,
      )
    : [];
  const voluntaryTransferParcels = selectedRegisteredOwner
    ? registeredOwnerParcels.filter(
        (p) => p.farmer_id === selectedRegisteredOwner.farmerId,
      )
    : [];
  const voluntaryDonorTotalAreaHa = voluntaryTransferParcels.reduce(
    (sum, parcel) =>
      sum +
      (Number.isFinite(parcel.total_farm_area_ha)
        ? parcel.total_farm_area_ha
        : 0),
    0,
  );
  const voluntaryHectareOptions = Array.from(
    { length: Math.max(0, Math.floor(voluntaryDonorTotalAreaHa)) },
    (_, index) => index + 1,
  );
  const voluntarySelectedAreaHa =
    voluntaryAreaMode === "take_all"
      ? voluntaryDonorTotalAreaHa
      : typeof voluntaryPartialAreaHa === "number"
        ? voluntaryPartialAreaHa
        : 0;
  const voluntaryAreaSelectionValid =
    voluntaryAreaMode === "take_all"
      ? voluntaryDonorTotalAreaHa > 0
      : typeof voluntaryPartialAreaHa === "number" &&
        voluntaryPartialAreaHa > 0 &&
        voluntaryPartialAreaHa <= voluntaryDonorTotalAreaHa;
  const inheritanceDonorTotalAreaHa = inheritanceTransferParcels.reduce(
    (sum, parcel) =>
      sum +
      (Number.isFinite(parcel.total_farm_area_ha)
        ? parcel.total_farm_area_ha
        : 0),
    0,
  );
  const inheritanceHectareOptions = Array.from(
    { length: Math.max(0, Math.floor(inheritanceDonorTotalAreaHa)) },
    (_, index) => index + 1,
  );

  const inheritanceSelectedAreaHa =
    inheritanceAreaMode === "take_all"
      ? inheritanceDonorTotalAreaHa
      : typeof inheritancePartialAreaHa === "number"
        ? inheritancePartialAreaHa
        : 0;

  const inheritanceAreaSelectionValid =
    inheritanceAreaMode === "take_all"
      ? inheritanceDonorTotalAreaHa > 0
      : typeof inheritancePartialAreaHa === "number" &&
        inheritancePartialAreaHa > 0 &&
        inheritancePartialAreaHa <= inheritanceDonorTotalAreaHa;

  const effectiveTransferParcels = (() => {
    if (transferMode === "inheritance") return inheritanceTransferParcels;
    if (transferMode === "voluntary") return voluntaryTransferParcels;
    return [];
  })();

  const donorFarmerId =
    transferMode === "voluntary"
      ? typeof sourceRegisteredOwnerId === "number"
        ? sourceRegisteredOwnerId
        : null
      : transferMode === "inheritance"
        ? typeof beneficairyOwnerId === "number"
          ? beneficairyOwnerId
          : null
        : null;

  const donorFarmerGroup =
    aggregatedFarmers.find((g) => g.farmer_id === donorFarmerId) ?? null;

  const donorSplitParcels: ParcelSplitInput[] =
    donorFarmerGroup?.parcels.map((p) => ({
      farm_parcel_id: p.id,
      parcel_number: p.parcel_number,
      farm_location_barangay: p.farm_location_barangay,
      total_farm_area_ha: Number(p.total_farm_area_ha) || 0,
      transfer_area_ha: parcelSplitInputs[p.id] ?? "",
    })) ?? [];

  const partialTotalTransferAreaHa: number = donorSplitParcels.reduce(
    (sum, p) => {
      if (parcelScope === "full")
        return sum + (Number(p.total_farm_area_ha) || 0);
      const val = parcelSplitInputs[p.farm_parcel_id];
      return sum + (typeof val === "number" && val > 0 ? val : 0);
    },
    0,
  );

  const parcelScopeValidationError: string =
    parcelScope === "partial" ? validateSplitInputs(donorSplitParcels) : "";

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
    if (donorSplitParcels.length === 0) {
      return "No transferable parcels found for the selected donor.";
    }
    if (
      donorSplitParcels.length > 0 &&
      parcelScope === "partial" &&
      parcelScopeValidationError
    ) {
      return parcelScopeValidationError;
    }
    if (donorSplitParcels.length > 0 && parcelScope === "full") {
      // full parcel is always valid if donor has parcels — no extra check needed
    }
    if (supportingDocs.length === 0) return "Upload at least one proof image.";
    if (parcelScope === "partial" && parcelScopeValidationError)
      return parcelScopeValidationError;
    return "";
  })();
  const transferReadyForReview = transferBlockingReason === "";

  const resetTransferWorkflow = () => {
    setTransferMode("");
    setSourceRegisteredOwnerId("");
    setSourceLinkedLandOwnerName("");
    setSourceTenantId("");
    setSourceLesseeId("");
    setBeneficairyOwnerId("");
    setConfirmBenefaciary(false);
    setInheritanceAreaMode("take_all");
    setInheritancePartialAreaHa("");
    setVoluntaryAreaMode("take_all");
    setVoluntaryPartialAreaHa("");
    setSelectedTransferParcelIds([]);
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
    parcels: LandParcel[],
  ) => {
    const uniqueParcelIds = Array.from(
      new Set(
        parcels
          .map((parcel) => Number(parcel.land_parcel_id))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    );

    if (uniqueParcelIds.length === 0) {
      return {
        verifiedParcels: [] as LandParcel[],
        invalidParcelIds: [] as number[],
        verifiedAvailableAreaHa: 0,
      };
    }

    const { data, error } = await supabase
      .from("rsbsa_farm_parcels")
      .select("id, submission_id, total_farm_area_ha")
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
      ownedParcelAreaMap.set(parcelId, Number(row.total_farm_area_ha) || 0);
    });

    const verifiedParcels = parcels
      .filter((parcel) => ownedParcelAreaMap.has(Number(parcel.land_parcel_id)))
      .map((parcel) => ({
        ...parcel,
        total_farm_area_ha:
          ownedParcelAreaMap.get(Number(parcel.land_parcel_id)) ??
          parcel.total_farm_area_ha,
      }));

    const invalidParcelIds = uniqueParcelIds.filter(
      (parcelId) => !ownedParcelAreaMap.has(parcelId),
    );

    const verifiedAvailableAreaHa = verifiedParcels.reduce((sum, parcel) => {
      const area = Number(parcel.total_farm_area_ha);
      return sum + (Number.isFinite(area) ? area : 0);
    }, 0);

    return {
      verifiedParcels,
      invalidParcelIds,
      verifiedAvailableAreaHa,
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
      const storagePath = `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}-${safeName}`;

      const { error } = await supabase.storage
        .from(TRANSFER_PROOF_BUCKET)
        .upload(storagePath, file, {
          contentType: file.type || "image/jpeg",
          upsert: false,
        });

      if (error) {
        console.error("Upload error details:", JSON.stringify(error, null, 2));
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
      // ── Step 1: Verify donor still owns the parcels ──────────────
      const { verifiedParcels, invalidParcelIds, verifiedAvailableAreaHa } =
        await verifyDonorParcelOwnership(
          fromFarmerId,
          donorSplitParcels.map((p) => ({
            ...p,
            id: p.farm_parcel_id,
            land_parcel_id: p.farm_parcel_id,
          })) as any,
        );

      if (invalidParcelIds.length > 0) {
        await refreshLandParcels();
        setTransferSubmitError(
          `Transfer list is outdated. Parcel IDs no longer owned by donor: ${invalidParcelIds.join(", ")}. Please review and try again.`,
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

      // ── Step 2: Upload proof documents ───────────────────────────
      uploadedProofs = await uploadTransferProofs(supportingDocs);

      if (areaMode === "partial" && selectedAreaHa > verifiedAvailableAreaHa) {
        await refreshLandParcels();
        setTransferSubmitError(
          `Selected transfer area (${selectedAreaHa.toFixed(2)} ha) exceeds donor's current available area (${verifiedAvailableAreaHa.toFixed(2)} ha). Please adjust and try again.`,
        );
        return;
      }

      if (parcelScope === "partial") {
        // ── PARTIAL: calls execute_partial_parcel_transfer RPC ─────
        const splitResults = await executePartialTransfers({
          parcels: donorSplitParcels,
          donorFarmerId: fromFarmerId,
          recipientFarmerId: toFarmerId,
          transferMode: transferMode as "voluntary" | "inheritance",
          transferReason: finalReasonPreview || "",
          transferDate: new Date().toISOString().slice(0, 10),
        });

        setTransferSubmitSuccess(
          `Partial transfer complete — ${splitResults.length} parcel(s) split successfully.`,
        );
      } else {
        // ── FULL: calls existing create_ownership_transfer_no_review RPC
        const areaMode = isInheritance
          ? inheritanceAreaMode
          : voluntaryAreaMode;
        const selectedAreaHa = isInheritance
          ? inheritanceSelectedAreaHa
          : voluntarySelectedAreaHa;
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

        const { data, error } = await supabase.rpc(
          "create_ownership_transfer_no_review",
          {
            p_transfer_mode: transferMode,
            p_from_farmer_id: fromFarmerId,
            p_to_farmer_id: toFarmerId,
            p_source_role: "registered_owner",
            p_area_mode: areaMode,
            p_area_requested_ha:
              areaMode === "partial" ? requestedAreaHa : null,
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
      }

      // ── Step 4: Post-transfer cleanup (runs for BOTH paths) ──────
      await supabase.rpc("check_and_update_farmer_parcel_status", {
        p_farmer_id: fromFarmerId,
      });

      // ── Step 5: Sync farmer visibility across all modules ────────
      // Sets rsbsa_submission.status = 'No Parcels' + archived_at if
      // donor has 0 parcels left, or restores to 'Active Farmer' otherwise.
      await supabase.rpc("sync_farmer_no_parcels_status", {
        p_farmer_id: fromFarmerId,
      });

      await refreshLandParcels();

      const updatedDonor = aggregatedFarmers.find(
        (g) => g.farmer_id === fromFarmerId,
      );
      if (!updatedDonor || updatedDonor.parcels.length === 0) {
        setSelectedFarmer(null);
        setShowModal(false);
      }

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

  const applyVoluntarySourceFromSelectedParcel = () => {
    if (!selectedParcel) return;

    const parsedFarmerId = Number(selectedParcel.farmer_id);
    const selectedFarmerId: number | "" =
      Number.isFinite(parsedFarmerId) && parsedFarmerId > 0
        ? parsedFarmerId
        : "";

    if (selectedParcel.is_tenant) {
      setSourceRegisteredOwnerId("");
      setSourceLinkedLandOwnerName(
        (selectedParcel.land_owner_name || "").trim(),
      );
      setSourceTenantId(selectedFarmerId);
      setSourceLesseeId("");
      setSelectedTransferParcelIds([]);
      return;
    }

    if (selectedParcel.is_lessee) {
      setSourceRegisteredOwnerId("");
      setSourceLinkedLandOwnerName(
        (selectedParcel.land_owner_name || "").trim(),
      );
      setSourceTenantId("");
      setSourceLesseeId(selectedFarmerId);
      setSelectedTransferParcelIds([]);
      return;
    }

    setSourceLinkedLandOwnerName("");
    setSourceTenantId("");
    setSourceLesseeId("");

    if (selectedFarmerId === "") {
      setSourceRegisteredOwnerId("");
      setSelectedTransferParcelIds([]);
      return;
    }

    setSourceRegisteredOwnerId(selectedFarmerId);
    const owner = registeredOwnerOptions.find(
      (option) => option.farmerId === selectedFarmerId,
    );
    setSelectedTransferParcelIds(owner ? [...owner.parcelIds] : []);
  };

  const handleTransferModeChange = (mode: TransferMode) => {
    setTransferMode(mode);
    setSourceRegisteredOwnerId("");
    setSourceLinkedLandOwnerName("");
    setSourceTenantId("");
    setSourceLesseeId("");
    setBeneficairyOwnerId("");
    setConfirmBenefaciary(mode === "inheritance");
    setInheritanceAreaMode("take_all");
    setInheritancePartialAreaHa("");
    setVoluntaryAreaMode("take_all");
    setVoluntaryPartialAreaHa("");
    setSelectedTransferParcelIds([]);
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

  const handleVoluntaryAreaModeChange = (mode: InheritanceAreaMode) => {
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
      setSelectedTransferParcelIds([]);
      setVoluntaryAreaMode("take_all");
      setVoluntaryPartialAreaHa("");
      return;
    }
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      setSourceRegisteredOwnerId("");
      setSelectedTransferParcelIds([]);
      setVoluntaryAreaMode("take_all");
      setVoluntaryPartialAreaHa("");
      return;
    }

    setSourceRegisteredOwnerId(parsedId);
    const owner = voluntaryDonorOptions.find(
      (option) => option.farmerId === parsedId,
    );
    setSelectedTransferParcelIds(owner ? [...owner.parcelIds] : []);
    setVoluntaryAreaMode("take_all");
    setVoluntaryPartialAreaHa("");
  };

  const handleDocsSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const incomingFiles = Array.from(event.target.files || []);
    if (incomingFiles.length === 0) return;

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

    const validFiles = incomingFiles.filter(
      (file) => file.type === "image/png" || file.type === "image/jpeg",
    );

    if (validFiles.length === 0) {
      event.target.value = "";
      return;
    }

    const oversized = validFiles.filter((f) => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      setTransferSubmitError(
        `File(s) too large (max 10 MB): ${oversized.map((f) => f.name).join(", ")}`,
      );
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
      <div className="jo-land-registry-page">
        {/* Sidebar */}
        <div className="sidebar">
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

        {/* Main Content */}
        <div className="jo-land-registry-main-content">
          {/* Header */}
          <div className="jo-land-registry-dashboard-header">
            <h1 className="jo-land-registry-page-title">🗺️ Land Registry</h1>
            <p className="jo-land-registry-page-subtitle">
              View land parcels and ownership history
            </p>
          </div>

          {/* Stats */}
          {/* Stats – fully using aggregatedFarmers */}
          <div className="jo-land-registry-stats">
            <div className="jo-land-registry-stat-card">
              <h3>Land Owners</h3>
              <p className="jo-land-registry-stat-number">
                {filteredFarmers.length}
              </p>
            </div>

            <div className="jo-land-registry-stat-card">
              <h3>Tenant</h3>
              <p className="jo-land-registry-stat-number">
                {aggregatedFarmers.reduce((sum, group) => {
                  return sum + (group.parcels.some((p) => p.is_tenant) ? 1 : 0);
                }, 0)}
              </p>
            </div>

            <div className="jo-land-registry-stat-card">
              <h3>Lessee</h3>
              <p className="jo-land-registry-stat-number">
                {aggregatedFarmers.reduce((sum, group) => {
                  return sum + (group.parcels.some((p) => p.is_lessee) ? 1 : 0);
                }, 0)}
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
                  ) : filteredFarmers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="jo-land-registry-empty-cell">
                        {searchTerm || filterBarangay
                          ? "No parcels match your search criteria"
                          : "No land parcels registered yet"}
                      </td>
                    </tr>
                  ) : (
                    filteredFarmers.map((group) => (
                      <tr
                        key={group.farmer_id}
                        onClick={() => handleFarmerSelect(group)}
                        className={
                          selectedFarmer?.farmer_id === group.farmer_id
                            ? "selected"
                            : ""
                        }
                      >
                        <td>
                          <strong>{group.ffrs_code || "—"}</strong>
                        </td>
                        <td>{group.farmer_name || "—"}</td>
                        <td>
                          {group.has_tenant ? (
                            <span className="jo-land-registry-ownership-pill jo-land-registry-ownership-tenant">
                              Tenant
                            </span>
                          ) : group.has_lessee ? (
                            <span className="jo-land-registry-ownership-pill jo-land-registry-ownership-lessee">
                              Lessee
                            </span>
                          ) : (
                            <span className="jo-land-registry-ownership-pill jo-land-registry-ownership-owner">
                              Owner
                            </span>
                          )}
                        </td>
                        <td>
                          {group.parcels[0]?.farm_location_barangay ||
                            "Multiple"}
                        </td>
                        <td>{group.total_farm_area_ha.toFixed(2) || "0"}</td>
                        <td>{formatDate(group.last_updated)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Detail Modal */}
        {showModal && selectedFarmer && (
          <div
            className="jo-land-registry-modal-overlay"
            onClick={() => setShowModal(false)}
          >
            <div
              className="jo-land-registry-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="jo-land-registry-modal-header">
                <h3>Land Parcel Details</h3>
                <button
                  className="jo-land-registry-close-button"
                  onClick={() => setShowModal(false)}
                >
                  ×
                </button>
              </div>

              <div className="jo-land-registry-modal-body">
                {/* Current Holder Section – updated to use selectedFarmer */}
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
                      {/* Update if you have icon logic for group */}
                      👤
                    </div>
                    <div className="jo-land-registry-owner-details">
                      <h4>{selectedFarmer.farmer_name || "Unknown"}</h4>
                      <span className="jo-land-registry-owner-type">
                        Owner {/* Temporary – update with real flags later */}
                      </span>
                    </div>
                  </div>

                  {/* Info grid – update to use group data */}
                  <div className="jo-land-registry-info-grid">
                    <div className="jo-land-registry-info-item">
                      <span className="jo-land-registry-info-label">
                        FFRS Code
                      </span>
                      <span className="jo-land-registry-info-value">
                        {selectedFarmer.ffrs_code || "—"}
                      </span>
                    </div>
                    {/* Add more info items as needed – total area, etc. */}
                    <div className="jo-land-registry-info-item">
                      <span className="jo-land-registry-info-label">
                        Total Area
                      </span>
                      <span className="jo-land-registry-info-value">
                        {selectedFarmer.total_farm_area_ha.toFixed(2)} hectares
                      </span>
                    </div>
                  </div>
                </div>

                {/* History Section – grouped by parcel */}
                <div className="jo-land-registry-detail-section">
                  <h4>📜 Land Ownership History</h4>
                  {historyLoading ? (
                    <p>Loading history...</p>
                  ) : parcelHistory.length === 0 ? (
                    <p>No ownership changes recorded yet.</p>
                  ) : (
                    (() => {
                      // Group records by farm_parcel_id (fallback: land_parcel_id)
                      const parcelGroups = new Map<
                        string,
                        typeof parcelHistory
                      >();
                      [...parcelHistory]
                        .sort((a, b) => {
                          const dateDiff =
                            new Date(b.period_start_date).getTime() -
                            new Date(a.period_start_date).getTime();
                          if (dateDiff !== 0) return dateDiff;
                          return b.id - a.id;
                        })
                        .forEach((record) => {
                          const key = String(
                            record.farm_parcel_id ??
                              record.land_parcel_id ??
                              "unknown",
                          );
                          if (!parcelGroups.has(key)) parcelGroups.set(key, []);
                          parcelGroups.get(key)!.push(record);
                        });

                      const groupEntries = Array.from(parcelGroups.entries());

                      return (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "16px",
                          }}
                        >
                          {groupEntries.map(
                            ([parcelKey, records], groupIdx) => {
                              const representative = records[0];
                              const parcelLabel = representative.parcel_number
                                ? `Parcel #${(representative.parcel_number.match(/\d+/) || [representative.parcel_number])[0]}`
                                : `Parcel ${groupIdx + 1}`;
                              const currentRecord = records.find(
                                (r) => r.is_current,
                              );
                              const areaHa =
                                currentRecord?.total_farm_area_ha ??
                                representative.total_farm_area_ha;
                              const barangay =
                                representative.farm_location_barangay;

                              return (
                                <div
                                  key={parcelKey}
                                  style={{
                                    border: "1px solid #d1fae5",
                                    borderRadius: "10px",
                                    overflow: "hidden",
                                  }}
                                >
                                  {/* Parcel header strip */}
                                  <span
                                    style={{
                                      fontWeight: 700,
                                      fontSize: "14px",
                                    }}
                                  ></span>

                                  {/* Timeline entries for this parcel */}
                                  <div
                                    className="jo-land-registry-history-list"
                                    style={{ padding: "10px" }}
                                  >
                                    {records.map((record) => {
                                      const isPartial =
                                        record.change_type ===
                                        "TRANSFER_PARTIAL";
                                      const isTransfer = /TRANSFER/i.test(
                                        record.change_type || "",
                                      );
                                      const recipientName =
                                        record.farmer_name ||
                                        record.land_owner_name ||
                                        "Unknown";

                                      // Resolve donor name from notes ("from farmer <id>")
                                      let donorName: string | null = null;
                                      if (isTransfer && record.notes) {
                                        const fromMatch =
                                          record.notes.match(
                                            /from farmer (\d+)/i,
                                          );
                                        if (fromMatch) {
                                          const donorId = Number(fromMatch[1]);
                                          donorName =
                                            farmerNameMap.get(donorId) ?? null;
                                        }
                                      }
                                      // Fallback: extract donor from change_reason sentence
                                      if (!donorName && record.change_reason) {
                                        const crMatch =
                                          record.change_reason.match(
                                            /^Ownership transfer from (.+?) to .+$/i,
                                          );
                                        if (crMatch)
                                          donorName = crMatch[1].trim();
                                      }

                                      // Clean transfer type label for the header
                                      const cleanTitle = (() => {
                                        if (isPartial)
                                          return "✂️ Partial Transfer";
                                        const r = (record.change_reason || "")
                                          .trim()
                                          .toLowerCase();
                                        if (r.startsWith("voluntary"))
                                          return "🔄 Voluntary Transfer";
                                        if (r.startsWith("inheritance"))
                                          return "🔄 Inheritance Transfer";
                                        if (r.startsWith("ownership transfer"))
                                          return "🔄 Ownership Transfer";
                                        if (record.change_reason)
                                          return `🔄 ${record.change_reason}`;
                                        return "🔄 Transfer";
                                      })();

                                      // Role badge for the recipient
                                      const recipientRole =
                                        record.is_registered_owner
                                          ? "Owner"
                                          : record.is_tenant
                                            ? "Tenant"
                                            : record.is_lessee
                                              ? "Lessee"
                                              : null;
                                      const roleBadgeBg =
                                        record.is_registered_owner
                                          ? "#dcfce7"
                                          : record.is_tenant
                                            ? "#dbeafe"
                                            : record.is_lessee
                                              ? "#ede9fe"
                                              : "#f3f4f6";
                                      const roleBadgeColor =
                                        record.is_registered_owner
                                          ? "#166534"
                                          : record.is_tenant
                                            ? "#1e40af"
                                            : record.is_lessee
                                              ? "#7c3aed"
                                              : "#6b7280";

                                      // Resolve donor ID from notes for proof lookup
                                      let donorIdForProof: number | null = null;
                                      if (isTransfer && record.notes) {
                                        const dnMatch =
                                          record.notes.match(
                                            /from farmer (\d+)/i,
                                          );
                                        if (dnMatch)
                                          donorIdForProof = Number(dnMatch[1]);
                                      }
                                      const recipientIdForProof =
                                        record.farmer_id ?? null;
                                      // Lookup proofs: primary by pair, fallback by recipient only
                                      const cardProofs: ProofItem[] | null =
                                        (() => {
                                          if (
                                            donorIdForProof &&
                                            recipientIdForProof
                                          ) {
                                            const byPair = transferProofMap.get(
                                              `${donorIdForProof}-${recipientIdForProof}`,
                                            );
                                            if (byPair && byPair.length > 0)
                                              return byPair;
                                          }
                                          if (recipientIdForProof) {
                                            const byRecipient =
                                              transferProofByRecipient.get(
                                                String(recipientIdForProof),
                                              );
                                            if (
                                              byRecipient &&
                                              byRecipient.length > 0
                                            )
                                              return byRecipient;
                                          }
                                          return null;
                                        })();

                                      // Transfer method label
                                      const methodLabel = isPartial
                                        ? "Partial transfer — split of original parcel"
                                        : "Full transfer";

                                      return (
                                        <div
                                          key={record.id}
                                          style={{
                                            background: record.is_current
                                              ? "#f0fdf4"
                                              : "#fafafa",
                                            border: `1px solid ${record.is_current ? "#bbf7d0" : "#e5e7eb"}`,
                                            borderRadius: "8px",
                                            marginBottom: "10px",
                                            overflow: "hidden",
                                          }}
                                        >
                                          {/* Card header: type + date + current badge */}
                                          <div
                                            style={{
                                              display: "flex",
                                              justifyContent: "space-between",
                                              alignItems: "center",
                                              padding: "8px 12px",
                                              borderBottom: `1px solid ${record.is_current ? "#bbf7d0" : "#e5e7eb"}`,
                                              background: record.is_current
                                                ? "#dcfce7"
                                                : "#f3f4f6",
                                            }}
                                          >
                                            <span
                                              style={{
                                                fontWeight: 700,
                                                fontSize: "13px",
                                                color: "#166534",
                                              }}
                                            >
                                              {cleanTitle}
                                            </span>
                                            <div
                                              style={{
                                                display: "flex",
                                                gap: "8px",
                                                alignItems: "center",
                                              }}
                                            >
                                              <span
                                                style={{
                                                  fontSize: "12px",
                                                  color: "#6b7280",
                                                }}
                                              >
                                                📅{" "}
                                                {formatDate(
                                                  record.period_start_date,
                                                )}
                                              </span>
                                            </div>
                                          </div>

                                          {/* Card body */}
                                          <div
                                            style={{
                                              padding: "10px 12px",
                                              display: "flex",
                                              flexDirection: "column",
                                              gap: "6px",
                                              fontSize: "13px",
                                              color: "#374151",
                                            }}
                                          >
                                            {/* Method */}
                                            <div>{methodLabel}</div>

                                            {/* Parcel / area details */}
                                            <div
                                              style={{
                                                color: "#6b7280",
                                                fontSize: "12px",
                                                display: "flex",
                                                flexWrap: "wrap",
                                                gap: "10px",
                                              }}
                                            >
                                              {record.parcel_number && (
                                                <span>
                                                  📋 {record.parcel_number}
                                                </span>
                                              )}
                                              {record.farm_location_barangay && (
                                                <span>
                                                  📍{" "}
                                                  {
                                                    record.farm_location_barangay
                                                  }
                                                </span>
                                              )}
                                              {record.transferred_area_ha !=
                                                null && (
                                                <span>
                                                  📐{" "}
                                                  {record.transferred_area_ha.toFixed(
                                                    2,
                                                  )}{" "}
                                                  ha transferred
                                                </span>
                                              )}
                                              {record.remaining_area_ha !=
                                                null && (
                                                <span>
                                                  🔲{" "}
                                                  {record.remaining_area_ha.toFixed(
                                                    2,
                                                  )}{" "}
                                                  ha remaining with donor
                                                </span>
                                              )}
                                            </div>

                                            {/* Who: donor → recipient */}
                                            {(donorName || recipientName) && (
                                              <div
                                                style={{
                                                  display: "flex",
                                                  alignItems: "center",
                                                  gap: "8px",
                                                  flexWrap: "wrap",
                                                  fontWeight: 500,
                                                  marginTop: "2px",
                                                }}
                                              >
                                                {donorName ? (
                                                  <span>{donorName}</span>
                                                ) : (
                                                  <span
                                                    style={{
                                                      color: "#9ca3af",
                                                      fontStyle: "italic",
                                                    }}
                                                  >
                                                    Unknown donor
                                                  </span>
                                                )}
                                                <span
                                                  style={{ color: "#9ca3af" }}
                                                >
                                                  →
                                                </span>
                                                <span>{recipientName}</span>
                                                {recipientRole && (
                                                  <span
                                                    style={{
                                                      fontSize: "11px",
                                                      fontWeight: 600,
                                                      padding: "1px 7px",
                                                      borderRadius: "999px",
                                                      background: roleBadgeBg,
                                                      color: roleBadgeColor,
                                                      border: `1px solid ${roleBadgeColor}40`,
                                                    }}
                                                  >
                                                    {recipientRole}
                                                  </span>
                                                )}
                                              </div>
                                            )}

                                            {/* Proof button */}
                                            {cardProofs &&
                                              cardProofs.length > 0 && (
                                                <div
                                                  style={{ marginTop: "6px" }}
                                                >
                                                  <button
                                                    onClick={() =>
                                                      handleViewProof(
                                                        cardProofs,
                                                      )
                                                    }
                                                    style={{
                                                      display: "inline-flex",
                                                      alignItems: "center",
                                                      gap: "5px",
                                                      padding: "4px 12px",
                                                      fontSize: "12px",
                                                      fontWeight: 600,
                                                      color: "#1e40af",
                                                      background: "#eff6ff",
                                                      border:
                                                        "1px solid #bfdbfe",
                                                      borderRadius: "6px",
                                                      cursor: "pointer",
                                                    }}
                                                  >
                                                    📷 View Proof (
                                                    {cardProofs.length})
                                                  </button>
                                                </div>
                                              )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            },
                          )}
                        </div>
                      );
                    })()
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

        {/* Proof Lightbox */}
        {lightboxOpen && (
          <div
            onClick={() => setLightboxOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              background: "rgba(0,0,0,0.85)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setLightboxOpen(false)}
              style={{
                position: "absolute",
                top: "16px",
                right: "20px",
                background: "none",
                border: "none",
                color: "#fff",
                fontSize: "28px",
                cursor: "pointer",
                lineHeight: 1,
              }}
            >
              ×
            </button>

            {/* Image area */}
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "10px",
                maxWidth: "90vw",
                maxHeight: "80vh",
              }}
            >
              {lightboxLoading ? (
                <p style={{ color: "#fff", fontSize: "16px" }}>
                  Loading proof...
                </p>
              ) : lightboxImages.length === 0 ? (
                <p style={{ color: "#fca5a5", fontSize: "16px" }}>
                  Could not load proof images.
                </p>
              ) : (
                <>
                  <img
                    src={lightboxImages[lightboxIndex].url}
                    alt={lightboxImages[lightboxIndex].name}
                    style={{
                      maxWidth: "85vw",
                      maxHeight: "68vh",
                      objectFit: "contain",
                      borderRadius: "8px",
                      boxShadow: "0 4px 32px rgba(0,0,0,0.6)",
                    }}
                  />
                  <p
                    style={{
                      color: "#d1d5db",
                      fontSize: "12px",
                      margin: 0,
                      textAlign: "center",
                    }}
                  >
                    {lightboxImages[lightboxIndex].name}
                  </p>
                </>
              )}
            </div>

            {/* Controls */}
            {!lightboxLoading && lightboxImages.length > 0 && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                }}
              >
                <button
                  onClick={() => setLightboxIndex((i) => Math.max(0, i - 1))}
                  disabled={lightboxIndex === 0}
                  style={{
                    padding: "6px 16px",
                    borderRadius: "6px",
                    border: "1px solid #4b5563",
                    background: lightboxIndex === 0 ? "#374151" : "#6b7280",
                    color: "#fff",
                    cursor: lightboxIndex === 0 ? "not-allowed" : "pointer",
                    opacity: lightboxIndex === 0 ? 0.4 : 1,
                  }}
                >
                  ‹ Prev
                </button>
                <span style={{ color: "#9ca3af", fontSize: "13px" }}>
                  {lightboxIndex + 1} / {lightboxImages.length}
                </span>
                <button
                  onClick={() =>
                    setLightboxIndex((i) =>
                      Math.min(lightboxImages.length - 1, i + 1),
                    )
                  }
                  disabled={lightboxIndex === lightboxImages.length - 1}
                  style={{
                    padding: "6px 16px",
                    borderRadius: "6px",
                    border: "1px solid #4b5563",
                    background:
                      lightboxIndex === lightboxImages.length - 1
                        ? "#374151"
                        : "#6b7280",
                    color: "#fff",
                    cursor:
                      lightboxIndex === lightboxImages.length - 1
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      lightboxIndex === lightboxImages.length - 1 ? 0.4 : 1,
                  }}
                >
                  Next ›
                </button>
              </div>
            )}
          </div>
        )}

        {/* Transfer Ownership Modal */}
        {showTransferModal &&
          selectedFarmer && ( // ← CHANGED: use selectedFarmer instead of selectedParcel
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
                        <span>Current Holder</span>
                        <strong>{selectedFarmer.farmer_name}</strong>{" "}
                        {/* ← CHANGED */}
                      </div>
                      <div className="jo-land-registry-transfer-kv">
                        <span>Total Area</span>
                        <strong>
                          {selectedFarmer.total_farm_area_ha.toFixed(2)} ha
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
                          onClick={() =>
                            handleTransferModeChange("inheritance")
                          }
                        >
                          Inheritance
                        </button>
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
                            selectedRegisteredOwner
                              ? sourceRegisteredOwnerId
                              : ""
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
                            The selected farmer is excluded from donor options
                            to prevent self-transfer.
                          </div>
                        )}

                        {selectedRegisteredOwner &&
                          donorSplitParcels.length > 0 && (
                            <div className="jo-land-registry-transfer-parcel-box">
                              <div className="jo-land-registry-transfer-subheading">
                                Donor Parcels ({donorSplitParcels.length})
                              </div>
                              <div className="jo-land-registry-donor-parcel-cards">
                                {donorSplitParcels.map((parcel) => (
                                  <div
                                    key={parcel.farm_parcel_id}
                                    className="jo-land-registry-donor-parcel-card"
                                  >
                                    <div className="jo-land-registry-donor-parcel-card-header">
                                      <span className="jo-land-registry-donor-parcel-number">
                                        {parcel.parcel_number ||
                                          `#${parcel.farm_parcel_id}`}
                                      </span>
                                      <span className="jo-land-registry-donor-parcel-area-badge">
                                        {parcel.total_farm_area_ha.toFixed(2)}{" "}
                                        ha
                                      </span>
                                    </div>
                                    <div className="jo-land-registry-donor-parcel-card-body">
                                      <div className="jo-land-registry-donor-parcel-detail">
                                        <span className="jo-land-registry-donor-parcel-detail-label">
                                          Barangay
                                        </span>
                                        <span className="jo-land-registry-donor-parcel-detail-value">
                                          {parcel.farm_location_barangay || "—"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <PartialParcelTransferSection
                                donorParcels={donorSplitParcels}
                                parcelScope={parcelScope}
                                onParcelScopeChange={(scope) => {
                                  setParcelScope(scope);
                                  if (scope === "partial")
                                    initSplitInputs(donorSplitParcels);
                                }}
                                parcelSplitInputs={parcelSplitInputs}
                                onSetParcelTransferArea={setParcelTransferArea}
                                validationError={parcelScopeValidationError}
                                totalTransferAreaHa={partialTotalTransferAreaHa}
                                donorTotalAreaHa={donorSplitParcels.reduce(
                                  (s, p) =>
                                    s + (Number(p.total_farm_area_ha) || 0),
                                  0,
                                )}
                              />
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
                            The selected farmer is excluded from donor options
                            to prevent self-transfer.
                          </div>
                        )}

                        {/* ONLY SHOW AFTER BENEFICIARY IS SELECTED */}
                        {beneficairyOwnerId && donorSplitParcels.length > 0 && (
                          <div className="jo-land-registry-transfer-parcel-box">
                            <div className="jo-land-registry-transfer-subheading">
                              Donor Parcels ({donorSplitParcels.length})
                            </div>
                            <div className="jo-land-registry-donor-parcel-cards">
                              {donorSplitParcels.map((parcel) => (
                                <div
                                  key={parcel.farm_parcel_id}
                                  className="jo-land-registry-donor-parcel-card"
                                >
                                  <div className="jo-land-registry-donor-parcel-card-header">
                                    <span className="jo-land-registry-donor-parcel-number">
                                      {parcel.parcel_number ||
                                        `#${parcel.farm_parcel_id}`}
                                    </span>
                                    <span className="jo-land-registry-donor-parcel-area-badge">
                                      {parcel.total_farm_area_ha.toFixed(2)} ha
                                    </span>
                                  </div>
                                  <div className="jo-land-registry-donor-parcel-card-body">
                                    <div className="jo-land-registry-donor-parcel-detail">
                                      <span className="jo-land-registry-donor-parcel-detail-label">
                                        Barangay
                                      </span>
                                      <span className="jo-land-registry-donor-parcel-detail-value">
                                        {parcel.farm_location_barangay || "—"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            <PartialParcelTransferSection
                              donorParcels={donorSplitParcels}
                              parcelScope={parcelScope}
                              onParcelScopeChange={(scope) => {
                                setParcelScope(scope);
                                if (scope === "partial")
                                  initSplitInputs(donorSplitParcels);
                              }}
                              parcelSplitInputs={parcelSplitInputs}
                              onSetParcelTransferArea={setParcelTransferArea}
                              validationError={parcelScopeValidationError}
                              totalTransferAreaHa={partialTotalTransferAreaHa}
                              donorTotalAreaHa={donorSplitParcels.reduce(
                                (s, p) =>
                                  s + (Number(p.total_farm_area_ha) || 0),
                                0,
                              )}
                            />
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
                          <strong>
                            {finalReasonPreview || "No reason yet"}
                          </strong>
                        </div>

                        {/* ── Review: Section 1 – Transfer Type ── */}
                        <div className="jo-land-registry-transfer-review-block">
                          <div className="jo-land-registry-transfer-review-block-title">
                            Transfer Type
                          </div>
                          <div className="jo-land-registry-transfer-kv">
                            <span>Reason</span>
                            <strong>{finalReasonPreview || "—"}</strong>
                          </div>
                        </div>

                        {/* ── Review: Section 2 – From / To ── */}
                        <div className="jo-land-registry-transfer-review-block">
                          <div className="jo-land-registry-transfer-review-block-title">
                            Transfer Parties
                          </div>
                          <div className="jo-land-registry-transfer-flow-row">
                            <div className="jo-land-registry-transfer-party">
                              <span className="jo-land-registry-transfer-party-label">
                                FROM
                              </span>
                              <strong className="jo-land-registry-transfer-party-name">
                                {selectedSource?.name || (
                                  <em style={{ color: "#9ca3af" }}>
                                    Not selected
                                  </em>
                                )}
                              </strong>
                              {selectedSource && (
                                <span className="jo-land-registry-transfer-party-sub">
                                  {selectedSource.parcelCount} parcel
                                  {selectedSource.parcelCount !== 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                            <div className="jo-land-registry-transfer-arrow">
                              →
                            </div>
                            <div className="jo-land-registry-transfer-party">
                              <span className="jo-land-registry-transfer-party-label">
                                TO
                              </span>
                              <strong className="jo-land-registry-transfer-party-name">
                                {selectedContextFarmerName}
                              </strong>
                              <span className="jo-land-registry-transfer-party-sub">
                                Recipient
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* ── Review: Section 3 – Area, Parcels & Effectivity ── */}
                        {(() => {
                          // Build the live parcel rows depending on scope
                          const reviewParcels =
                            parcelScope === "partial"
                              ? donorSplitParcels
                                  .map((p) => {
                                    const entered =
                                      parcelSplitInputs[p.farm_parcel_id];
                                    const area =
                                      typeof entered === "number" && entered > 0
                                        ? entered
                                        : null;
                                    return { ...p, reviewArea: area };
                                  })
                                  .filter((p) => p.reviewArea !== null)
                              : donorSplitParcels.map((p) => ({
                                  ...p,
                                  reviewArea: p.total_farm_area_ha,
                                }));

                          const reviewTotalHa = reviewParcels.reduce(
                            (sum, p) => sum + (p.reviewArea ?? 0),
                            0,
                          );

                          return (
                            <div className="jo-land-registry-transfer-review-block">
                              <div className="jo-land-registry-transfer-review-block-title">
                                Transfer Details
                              </div>
                              <div className="jo-land-registry-transfer-kv">
                                <span>Scope</span>
                                <strong>
                                  {parcelScope === "partial"
                                    ? "Partial"
                                    : "Full Transfer"}
                                </strong>
                              </div>
                              <div className="jo-land-registry-transfer-kv">
                                <span>Parcels Involved</span>
                                <strong>
                                  {reviewParcels.length}
                                  {parcelScope === "partial" &&
                                    donorSplitParcels.length >
                                      reviewParcels.length && (
                                      <span
                                        style={{
                                          color: "#94a3b8",
                                          fontWeight: 400,
                                          fontSize: 11,
                                          marginLeft: 4,
                                        }}
                                      >
                                        of {donorSplitParcels.length} entered
                                      </span>
                                    )}
                                </strong>
                              </div>
                              <div className="jo-land-registry-transfer-kv">
                                <span>Total Transfer Area</span>
                                <strong
                                  style={{
                                    color:
                                      reviewTotalHa > 0 ? "#0f172a" : "#94a3b8",
                                  }}
                                >
                                  {reviewTotalHa > 0
                                    ? `${reviewTotalHa.toFixed(2)} ha`
                                    : parcelScope === "partial"
                                      ? "Enter values above"
                                      : "—"}
                                </strong>
                              </div>
                              <div className="jo-land-registry-transfer-kv">
                                <span>Effectivity</span>
                                <strong>Immediate</strong>
                              </div>
                              {reviewParcels.length > 0 ? (
                                <ul className="jo-land-registry-transfer-list">
                                  {reviewParcels.map((parcel) => (
                                    <li key={parcel.farm_parcel_id}>
                                      <span className="jo-land-registry-transfer-list-parcel">
                                        {parcel.parcel_number ||
                                          `#${parcel.farm_parcel_id}`}
                                      </span>
                                      <span className="jo-land-registry-transfer-list-brgy">
                                        {parcel.farm_location_barangay}
                                      </span>
                                      <span className="jo-land-registry-transfer-list-area">
                                        {(parcel.reviewArea ?? 0).toFixed(2)} ha
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              ) : parcelScope === "partial" ? (
                                <p
                                  style={{
                                    fontSize: 12,
                                    color: "#94a3b8",
                                    margin: "4px 0 0",
                                  }}
                                >
                                  No transfer areas entered yet.
                                </p>
                              ) : null}
                            </div>
                          );
                        })()}
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
                        disabled={
                          !transferReadyForReview || isSubmittingTransfer
                        }
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
