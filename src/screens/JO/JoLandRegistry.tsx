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
  land_owner_id: number | null;
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

interface CultivationParcel {
  id: number;
  submission_id: number;
  parcel_number: string;
  farm_location_barangay: string;
  farm_location_municipality: string;
  total_farm_area_ha: number;
  is_cultivating: boolean | null;
  cultivation_status_reason: string | null;
  cultivation_status_updated_at: string | null;
  cultivator_submission_id: number | null;
  cultivator_name?: string | null;
}

interface ProofItem {
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  mime_type?: string;
  file_size_bytes?: number;
}

interface TransferActorOption {
  farmerId: number;
  name: string;
  barangay: string;
  parcelIds: number[];
  parcelCount: number;
}

interface ReplacementSourceOption {
  farmerId: number;
  farmerName: string;
  ownerId: number | null;
  ownerName: string;
  parcelCount: number;
}

interface ReplacementAssignedParcel {
  historyId: number;
  farmParcelId: number;
  landParcelId?: number | null;
  parcelNumber: string;
  barangay: string;
  municipality: string;
  areaHa: number;
  ownerId: number | null;
  ownerName: string;
}

interface OwnerAffiliationStep3Parcel extends ReplacementAssignedParcel {
  inCurrentContract: boolean;
  sourceType: "current_holder_link" | "new_owner_available";
}

interface OwnerAffiliationOwnerOption {
  ownerId: number;
  ownerName: string;
  barangay: string;
  parcelCount: number;
}

interface FarmerGroup {
  farmer_id: number;
  farmer_name: string;
  ffrs_code: string;
  parcels: Array<{
    id: number;
    land_parcel_id?: number | null;
    parcel_number: string;
    farm_location_barangay: string;
    farm_location_municipality: string;
    total_farm_area_ha: number;
    is_registered_owner?: boolean;
    is_tenant?: boolean;
    is_lessee?: boolean;
    is_current_owner?: boolean | null;
    parent_parcel_id?: number | null;
    split_origin_area_ha?: number | null;
  }>;
  total_farm_area_ha: number;
  last_updated: string;
  has_registered_owner: boolean;
  has_tenant: boolean;
  has_lessee: boolean;
}

type TransferMode = "voluntary" | "inheritance";
type InheritanceAreaMode = "take_all" | "partial";
type ReplacementRole = "tenant" | "lessee";
type ReplacementTakeoverMode = "full_parcel" | "specific_slot";
type RegistryRowOwnership = "owner" | "tenant" | "lessee";

interface ReplacementSpecificLotInput {
  customAreaHa: number | "";
}

interface ReplacementTakeoverItem {
  farm_parcel_id: number;
  takeover_mode: "full" | "specific";
  transfer_area_ha: number;
}

interface ReplacementTakeoverPlan {
  items: ReplacementTakeoverItem[];
  selectedParcelCount: number;
  totalAreaHa: number;
  error: string;
}

interface RegistryActionCapabilities {
  canTransferOwnership: boolean;
  canUpdateTenantLandowner: boolean;
  canUpdateLesseeLandowner: boolean;
}

interface RegistryDisplayRow {
  rowId: string;
  farmer: FarmerGroup;
  primaryOwnership: RegistryRowOwnership;
  ownershipSecondaryLabels: string[];
  capabilities: RegistryActionCapabilities;
  parcels: FarmerGroup["parcels"];
  totalAreaHa: number;
  primaryBarangay: string;
}

const TRANSFER_PROOF_BUCKET = "ownership-transfer-proofs";

const normalizeCurrentOwnershipGroups = (
  groups: FarmerGroup[],
): FarmerGroup[] => {
  const toPositiveArea = (value: unknown): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };

  return (groups || [])
    .map((group) => {
      const sourceParcels = Array.isArray(group.parcels) ? group.parcels : [];
      const hasExplicitCurrentOwnerFlag = sourceParcels.some(
        (parcel) =>
          parcel?.is_current_owner === true ||
          parcel?.is_current_owner === false,
      );

      const currentOwnerParcels = sourceParcels.filter(
        (parcel) => parcel?.is_current_owner !== false,
      );

      const parcelsToUse = hasExplicitCurrentOwnerFlag
        ? currentOwnerParcels.length > 0
          ? currentOwnerParcels
          : sourceParcels
        : sourceParcels;

      const hasExplicitOwnerRoleFlag = parcelsToUse.some(
        (parcel) => typeof parcel?.is_registered_owner === "boolean",
      );
      const hasExplicitTenantRoleFlag = parcelsToUse.some(
        (parcel) => typeof parcel?.is_tenant === "boolean",
      );
      const hasExplicitLesseeRoleFlag = parcelsToUse.some(
        (parcel) => typeof parcel?.is_lessee === "boolean",
      );

      const computedTotalArea = parcelsToUse.reduce(
        (sum, parcel) => sum + toPositiveArea(parcel?.total_farm_area_ha),
        0,
      );

      return {
        ...group,
        parcels: parcelsToUse,
        total_farm_area_ha:
          computedTotalArea > 0 ? computedTotalArea : group.total_farm_area_ha,
        has_registered_owner:
          (hasExplicitOwnerRoleFlag
            ? parcelsToUse.some(
                (parcel) => parcel?.is_registered_owner === true,
              )
            : false) || group.has_registered_owner,
        has_tenant:
          (hasExplicitTenantRoleFlag
            ? parcelsToUse.some((parcel) => parcel?.is_tenant === true)
            : false) || group.has_tenant,
        has_lessee:
          (hasExplicitLesseeRoleFlag
            ? parcelsToUse.some((parcel) => parcel?.is_lessee === true)
            : false) || group.has_lessee,
      };
    })
    .filter((group) => group.parcels.length > 0);
};

const buildReplacementTakeoverPlan = (
  parcels: ReplacementAssignedParcel[],
  selectedParcelIds: number[],
  takeoverMode: ReplacementTakeoverMode,
  specificLotInputs: Record<number, ReplacementSpecificLotInput>,
): ReplacementTakeoverPlan => {
  const roundToTwo = (value: number) =>
    Math.round((Number(value) + Number.EPSILON) * 100) / 100;

  if (!Array.isArray(parcels) || parcels.length === 0) {
    return {
      items: [],
      selectedParcelCount: 0,
      totalAreaHa: 0,
      error: "",
    };
  }

  const selectedSet = new Set<number>(selectedParcelIds || []);
  if (selectedSet.size === 0) {
    return {
      items: [],
      selectedParcelCount: 0,
      totalAreaHa: 0,
      error: "Select at least one parcel under the tenant/lessee agreement.",
    };
  }

  const items: ReplacementTakeoverItem[] = [];

  for (const parcel of parcels) {
    if (!selectedSet.has(parcel.farmParcelId)) continue;

    const parcelArea = roundToTwo(Number(parcel.areaHa) || 0);
    if (!Number.isFinite(parcelArea) || parcelArea <= 0) continue;

    if (takeoverMode === "full_parcel") {
      items.push({
        farm_parcel_id: parcel.farmParcelId,
        takeover_mode: "full",
        transfer_area_ha: parcelArea,
      });
      continue;
    }

    const config = specificLotInputs[parcel.farmParcelId] || {
      customAreaHa: "" as number | "",
    };

    const customArea = roundToTwo(Number(config.customAreaHa));
    if (!Number.isFinite(customArea) || customArea <= 0) {
      return {
        items: [],
        selectedParcelCount: 0,
        totalAreaHa: 0,
        error: `Enter a valid custom area for parcel #${parcel.farmParcelId}.`,
      };
    }

    if (customArea > parcelArea + 0.0001) {
      return {
        items: [],
        selectedParcelCount: 0,
        totalAreaHa: 0,
        error: `Custom area for parcel #${parcel.farmParcelId} cannot exceed ${parcelArea.toFixed(2)} ha.`,
      };
    }

    items.push({
      farm_parcel_id: parcel.farmParcelId,
      takeover_mode: "specific",
      transfer_area_ha: customArea,
    });
  }

  if (takeoverMode === "specific_slot" && items.length === 0) {
    return {
      items: [],
      selectedParcelCount: 0,
      totalAreaHa: 0,
      error: "Enter custom area for selected parcel(s).",
    };
  }

  const totalAreaHa = items.reduce(
    (sum, item) => sum + (Number(item.transfer_area_ha) || 0),
    0,
  );

  return {
    items,
    selectedParcelCount: items.length,
    totalAreaHa: roundToTwo(totalAreaHa),
    error: "",
  };
};

const JoLandRegistry: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // State
  const [aggregatedFarmers, setAggregatedFarmers] = useState<FarmerGroup[]>([]);
  const [selectedFarmer, setSelectedFarmer] = useState<FarmerGroup | null>(
    null,
  );
  const [landParcels] = useState<LandParcel[]>([]);
  const [parcelHistory, setParcelHistory] = useState<LandHistoryRecord[]>([]);
  const [cultivationParcels, setCultivationParcels] = useState<
    CultivationParcel[]
  >([]);
  const [cultivationLoading, setCultivationLoading] = useState(false);
  const [farmerNameMap, setFarmerNameMap] = useState<Map<number, string>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBarangay, setFilterBarangay] = useState("");
  const [filterCultivation, setFilterCultivation] = useState<
    "all" | "active" | "inactive"
  >("all");
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
  const [openActionMenuRowId, setOpenActionMenuRowId] = useState<string | null>(
    null,
  );
  const [selectedRegistryRowId, setSelectedRegistryRowId] = useState<
    string | null
  >(null);
  const [selectedFarmerViewRole, setSelectedFarmerViewRole] =
    useState<RegistryRowOwnership>("owner");
  const [showOwnerAffiliationModal, setShowOwnerAffiliationModal] =
    useState(false);
  const [ownerAffiliationRole, setOwnerAffiliationRole] =
    useState<ReplacementRole>("tenant");
  const [
    ownerAffiliationQuickRoleSelection,
    setOwnerAffiliationQuickRoleSelection,
  ] = useState<ReplacementRole | "">("");
  const [ownerAffiliationSourceOptions, setOwnerAffiliationSourceOptions] =
    useState<ReplacementSourceOption[]>([]);
  const [ownerAffiliationSourceOwnerId, setOwnerAffiliationSourceOwnerId] =
    useState<number | "">("");
  const [ownerAffiliationParcelsByOwner, setOwnerAffiliationParcelsByOwner] =
    useState<Map<number, ReplacementAssignedParcel[]>>(new Map());
  const [ownerAffiliationNewOwnerId, setOwnerAffiliationNewOwnerId] = useState<
    number | ""
  >("");
  const [
    ownerAffiliationSelectedParcelIds,
    setOwnerAffiliationSelectedParcelIds,
  ] = useState<number[]>([]);
  const [ownerAffiliationTakeoverMode, setOwnerAffiliationTakeoverMode] =
    useState<ReplacementTakeoverMode>("full_parcel");
  const [
    ownerAffiliationSpecificLotInputs,
    setOwnerAffiliationSpecificLotInputs,
  ] = useState<Record<number, ReplacementSpecificLotInput>>({});
  const [ownerAffiliationSupportingDocs, setOwnerAffiliationSupportingDocs] =
    useState<File[]>([]);
  const [ownerAffiliationReason, setOwnerAffiliationReason] = useState("");
  const [ownerAffiliationLoading, setOwnerAffiliationLoading] = useState(false);
  const [isSubmittingOwnerAffiliation, setIsSubmittingOwnerAffiliation] =
    useState(false);
  const [ownerAffiliationSubmitError, setOwnerAffiliationSubmitError] =
    useState("");
  const [ownerAffiliationSubmitSuccess, setOwnerAffiliationSubmitSuccess] =
    useState("");

  const {
    parcelScope,
    setParcelScope,
    parcelSplitInputs,
    setParcelTransferArea,
    initSplitInputs,
    validateSplitInputs,
    executePartialTransfers,
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
      const normalizedData = normalizeCurrentOwnershipGroups(data || []);
      setAggregatedFarmers(normalizedData);
      console.log(
        "[STATE SET] Set aggregatedFarmers to length:",
        normalizedData.length || 0,
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

  const fetchCultivationParcelsForFarmer = async (
    farmerId: number,
    parcels: FarmerGroup["parcels"], // no longer used for filtering
  ) => {
    setCultivationLoading(true);
    try {
      // Query ALL parcels for this farmer directly from the table
      // Don't rely on group.parcels since normalizeCurrentOwnershipGroups
      // may have already dropped parcels with is_current_owner === false
      const { data, error } = await supabase
        .from("rsbsa_farm_parcels")
        .select(
          "id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, is_cultivating, cultivation_status_reason, cultivation_status_updated_at, cultivator_submission_id",
        )
        .eq("submission_id", farmerId);

      const rows: CultivationParcel[] = Array.isArray(data) ? data : [];
      const cultivatorIds = Array.from(
        new Set(
          rows
            .map((row) => Number(row.cultivator_submission_id))
            .filter((id) => Number.isFinite(id) && id > 0),
        ),
      );

      const cultivatorNameMap = new Map<number, string>();
      if (cultivatorIds.length > 0) {
        const { data: cultivators, error: cultivatorError } = await supabase
          .from("rsbsa_submission")
          .select(`id, "FIRST NAME", "MIDDLE NAME", "LAST NAME", "EXT NAME"`)
          .in("id", cultivatorIds);

        if (!cultivatorError && Array.isArray(cultivators)) {
          cultivators.forEach((row: any) => {
            const fullName = [
              row["FIRST NAME"],
              row["MIDDLE NAME"],
              row["LAST NAME"],
              row["EXT NAME"],
            ]
              .filter(Boolean)
              .join(" ")
              .trim();
            if (fullName) {
              cultivatorNameMap.set(Number(row.id), fullName);
            }
          });
        }
      }

      const formatted = rows.map((row) => ({
        ...row,
        cultivator_name: row.cultivator_submission_id
          ? cultivatorNameMap.get(Number(row.cultivator_submission_id)) || null
          : null,
      }));

      setCultivationParcels(formatted);
    } catch (err) {
      console.error("Cultivation status fetch error:", err);
      setCultivationParcels([]);
    } finally {
      setCultivationLoading(false);
    }
  };

  // Handle parcel selection
  const handleFarmerSelect = (
    group: FarmerGroup,
    rowOwnership: RegistryRowOwnership = "owner",
    selectedParcelIds?: number[],
    rowId?: string,
  ) => {
    console.log(
      "handleFarmerSelect called for:",
      group.farmer_name,
      group.farmer_id,
    );

    setSelectedFarmer(group);
    setSelectedFarmerViewRole(rowOwnership);
    if (rowId) setSelectedRegistryRowId(rowId);
    console.log("setSelectedFarmer called");

    const parcelIds =
      selectedParcelIds && selectedParcelIds.length > 0
        ? selectedParcelIds
        : group.parcels.map((p) => p.id);

    console.log("Fetching history for parcel IDs:", parcelIds);

    if (parcelIds.length > 0) {
      fetchParcelHistoryForIds(parcelIds);
      console.log("fetchParcelHistoryForIds called");
    } else {
      setParcelHistory([]);
      console.log("No parcel IDs found for selected row.");
    }

    void fetchCultivationParcelsForFarmer(group.farmer_id, group.parcels);

    setOpenActionMenuRowId(null);
    setShowModal(true);
    console.log("setShowModal(true) called");
  };

  const handleRowActionView = (row: RegistryDisplayRow) => {
    setOpenActionMenuRowId(null);
    handleFarmerSelect(
      row.farmer,
      row.primaryOwnership,
      row.parcels.map((parcel) => parcel.id),
      row.rowId,
    );
  };

  const handleRowActionTransfer = (row: RegistryDisplayRow) => {
    if (!row.capabilities.canTransferOwnership) {
      setOpenActionMenuRowId(null);
      return;
    }

    setOpenActionMenuRowId(null);
    setSelectedFarmer(row.farmer);
    setSelectedFarmerViewRole("owner");
    setSelectedRegistryRowId(row.rowId);
    setShowModal(false);
    openTransferModal("owner");
  };

  const handleRowActionOwnerAffiliation = (
    row: RegistryDisplayRow,
    role: ReplacementRole,
  ) => {
    const roleAllowed =
      role === "tenant"
        ? row.capabilities.canUpdateTenantLandowner
        : row.capabilities.canUpdateLesseeLandowner;

    if (!roleAllowed) {
      setOpenActionMenuRowId(null);
      return;
    }

    setOpenActionMenuRowId(null);
    setSelectedFarmer(row.farmer);
    setSelectedFarmerViewRole(role);
    setSelectedRegistryRowId(row.rowId);
    openOwnerAffiliationModal(row.farmer, role);
  };

  const resetOwnerAffiliationWorkflow = () => {
    setOwnerAffiliationSourceOptions([]);
    setOwnerAffiliationSourceOwnerId("");
    setOwnerAffiliationParcelsByOwner(new Map());
    setOwnerAffiliationNewOwnerId("");
    setOwnerAffiliationSelectedParcelIds([]);
    setOwnerAffiliationTakeoverMode("full_parcel");
    setOwnerAffiliationSpecificLotInputs({});
    setOwnerAffiliationSupportingDocs([]);
    setOwnerAffiliationReason("");
    setOwnerAffiliationLoading(false);
    setIsSubmittingOwnerAffiliation(false);
    setOwnerAffiliationSubmitError("");
    setOwnerAffiliationSubmitSuccess("");
  };

  const loadOwnerAffiliationSourceOptions = async (
    group: FarmerGroup,
    role: ReplacementRole,
  ) => {
    setOwnerAffiliationLoading(true);
    setOwnerAffiliationSubmitError("");
    setOwnerAffiliationSubmitSuccess("");

    const roleColumn = role === "tenant" ? "is_tenant" : "is_lessee";
    const roleParcelFlagColumn =
      role === "tenant" ? "ownership_type_tenant" : "ownership_type_lessee";
    const selectColumns =
      "id, land_parcel_id, farmer_id, farmer_name, land_owner_id, land_owner_name, farm_parcel_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, is_registered_owner";
    const parcelSelectColumns =
      "id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, ownership_type_tenant, ownership_type_lessee, tenant_land_owner_id, lessee_land_owner_id, tenant_land_owner_name, lessee_land_owner_name";

    try {
      const [historyResult, parcelResult] = await Promise.all([
        supabase
          .from("land_history")
          .select(selectColumns)
          .eq("is_current", true)
          .eq(roleColumn, true)
          .eq("farmer_id", group.farmer_id),
        supabase
          .from("rsbsa_farm_parcels")
          .select(parcelSelectColumns)
          .eq("submission_id", group.farmer_id)
          .eq(roleParcelFlagColumn, true),
      ]);

      if (historyResult.error) throw historyResult.error;
      if (parcelResult.error) throw parcelResult.error;

      const sourceRows = (historyResult.data || []) as Array<{
        id: number;
        land_parcel_id: number | null;
        farmer_id: number | null;
        farmer_name: string | null;
        land_owner_id: number | null;
        land_owner_name: string | null;
        farm_parcel_id: number | null;
        parcel_number: string | null;
        farm_location_barangay: string | null;
        farm_location_municipality: string | null;
        total_farm_area_ha: number | null;
        is_registered_owner: boolean | null;
      }>;

      const holderParcelRows = (parcelResult.data || []) as Array<{
        id: number | null;
        submission_id: number | null;
        parcel_number: string | null;
        farm_location_barangay: string | null;
        farm_location_municipality: string | null;
        total_farm_area_ha: number | null;
        ownership_type_tenant: boolean | null;
        ownership_type_lessee: boolean | null;
        tenant_land_owner_id: number | null;
        lessee_land_owner_id: number | null;
        tenant_land_owner_name: string | null;
        lessee_land_owner_name: string | null;
      }>;

      const ownerBuckets = new Map<
        number,
        {
          option: ReplacementSourceOption;
          parcels: Map<number, ReplacementAssignedParcel>;
        }
      >();

      let excludedRows = 0;

      const normalizeOwnerName = (value: string) =>
        value.trim().toLowerCase().replace(/\s+/g, " ");

      const ownerIdByName = new Map<string, number>();

      const getOrCreateBucket = (
        farmerId: number,
        ownerId: number,
        ownerNameRaw: string,
      ) => {
        const ownerName = ownerNameRaw.trim() || `Owner #${ownerId}`;

        if (!ownerBuckets.has(ownerId)) {
          ownerBuckets.set(ownerId, {
            option: {
              farmerId,
              farmerName: group.farmer_name || `Farmer #${group.farmer_id}`,
              ownerId,
              ownerName,
              parcelCount: 0,
            },
            parcels: new Map<number, ReplacementAssignedParcel>(),
          });
        }

        const bucket = ownerBuckets.get(ownerId);
        if (!bucket) return null;

        if (
          (!bucket.option.ownerName ||
            /^Owner\s+#\d+$/i.test(bucket.option.ownerName)) &&
          ownerName &&
          !/^Owner\s+#\d+$/i.test(ownerName)
        ) {
          bucket.option.ownerName = ownerName;
        }

        return bucket;
      };

      sourceRows.forEach((row) => {
        const farmerId = Number(row.farmer_id);
        if (!Number.isFinite(farmerId) || farmerId <= 0) return;
        if (farmerId !== group.farmer_id) return;

        const ownerIdRaw = Number(row.land_owner_id);
        const ownerId =
          Number.isFinite(ownerIdRaw) && ownerIdRaw > 0 ? ownerIdRaw : null;

        if (!ownerId) {
          excludedRows += 1;
          return;
        }

        const isDirectOwnedManaged = ownerId === farmerId;
        if (isDirectOwnedManaged) {
          excludedRows += 1;
          return;
        }

        const farmParcelId = Number(row.farm_parcel_id);
        if (!Number.isFinite(farmParcelId) || farmParcelId <= 0) return;

        const ownerName = (row.land_owner_name || "").trim();
        const areaHa = Number(row.total_farm_area_ha);

        if (ownerName) {
          const normalizedOwnerName = normalizeOwnerName(ownerName);
          if (normalizedOwnerName && !ownerIdByName.has(normalizedOwnerName)) {
            ownerIdByName.set(normalizedOwnerName, ownerId);
          }
        }

        const bucket = getOrCreateBucket(farmerId, ownerId, ownerName);
        if (!bucket) return;

        if (!bucket.parcels.has(farmParcelId)) {
          const landParcelIdRaw = Number(row.land_parcel_id);
          const landParcelId =
            Number.isFinite(landParcelIdRaw) && landParcelIdRaw > 0
              ? landParcelIdRaw
              : null;

          bucket.parcels.set(farmParcelId, {
            historyId: Number(row.id) || farmParcelId,
            farmParcelId,
            landParcelId,
            parcelNumber: (row.parcel_number || "").trim(),
            barangay: (row.farm_location_barangay || "").trim(),
            municipality: (row.farm_location_municipality || "").trim(),
            areaHa: Number.isFinite(areaHa) && areaHa > 0 ? areaHa : 0,
            ownerId,
            ownerName,
          });
        }
      });

      aggregatedFarmers.forEach((farmer) => {
        const ownerName = (farmer.farmer_name || "").trim();
        const ownerId = Number(farmer.farmer_id);
        if (!ownerName || !Number.isFinite(ownerId) || ownerId <= 0) return;
        const normalizedOwnerName = normalizeOwnerName(ownerName);
        if (!normalizedOwnerName || ownerIdByName.has(normalizedOwnerName))
          return;
        ownerIdByName.set(normalizedOwnerName, ownerId);
      });

      holderParcelRows.forEach((row) => {
        const farmerId = Number(row.submission_id);
        if (!Number.isFinite(farmerId) || farmerId <= 0) return;
        if (farmerId !== group.farmer_id) return;

        const ownerIdRaw = Number(
          role === "tenant"
            ? row.tenant_land_owner_id
            : row.lessee_land_owner_id,
        );
        let ownerId =
          Number.isFinite(ownerIdRaw) && ownerIdRaw > 0 ? ownerIdRaw : null;

        const ownerName = (
          role === "tenant"
            ? row.tenant_land_owner_name
            : row.lessee_land_owner_name
        )
          ? String(
              role === "tenant"
                ? row.tenant_land_owner_name
                : row.lessee_land_owner_name,
            )
          : "";

        if (!ownerId && ownerName.trim()) {
          const normalizedOwnerName = normalizeOwnerName(ownerName);
          const inferredOwnerId = ownerIdByName.get(normalizedOwnerName);
          if (
            typeof inferredOwnerId === "number" &&
            Number.isFinite(inferredOwnerId) &&
            inferredOwnerId > 0
          ) {
            ownerId = inferredOwnerId;
          }
        }

        if (!ownerId) {
          excludedRows += 1;
          return;
        }

        const isDirectOwnedManaged = ownerId === farmerId;
        if (isDirectOwnedManaged) {
          excludedRows += 1;
          return;
        }

        const farmParcelId = Number(row.id);
        if (!Number.isFinite(farmParcelId) || farmParcelId <= 0) return;

        const areaHa = Number(row.total_farm_area_ha);

        const bucket = getOrCreateBucket(farmerId, ownerId, ownerName);
        if (!bucket) return;

        if (!bucket.parcels.has(farmParcelId)) {
          bucket.parcels.set(farmParcelId, {
            historyId: farmParcelId,
            farmParcelId,
            landParcelId: null,
            parcelNumber: (row.parcel_number || "").trim(),
            barangay: (row.farm_location_barangay || "").trim(),
            municipality: (row.farm_location_municipality || "").trim(),
            areaHa: Number.isFinite(areaHa) && areaHa > 0 ? areaHa : 0,
            ownerId,
            ownerName: ownerName.trim() || `Owner #${ownerId}`,
          });
        }
      });

      const nextSourceOptions = Array.from(ownerBuckets.values())
        .map((bucket) => ({
          ...bucket.option,
          parcelCount: bucket.parcels.size,
        }))
        .sort((a, b) => {
          const byName = a.ownerName.localeCompare(b.ownerName);
          if (byName !== 0) return byName;
          return (a.ownerId || 0) - (b.ownerId || 0);
        });

      const parcelsByOwner = new Map<number, ReplacementAssignedParcel[]>();
      ownerBuckets.forEach((bucket, ownerId) => {
        const sortedParcels = Array.from(bucket.parcels.values()).sort(
          (a, b) => {
            const parcelDiff = (a.parcelNumber || "").localeCompare(
              b.parcelNumber || "",
            );
            if (parcelDiff !== 0) return parcelDiff;
            return a.farmParcelId - b.farmParcelId;
          },
        );
        parcelsByOwner.set(ownerId, sortedParcels);
      });

      setOwnerAffiliationParcelsByOwner(parcelsByOwner);
      setOwnerAffiliationSourceOptions(nextSourceOptions);

      const validOwnerIdSet = new Set(
        nextSourceOptions
          .map((o) => o.ownerId)
          .filter((id): id is number => typeof id === "number" && id > 0),
      );

      const allParcelIds: number[] = [];
      parcelsByOwner.forEach((parcels, ownerId) => {
        if (!validOwnerIdSet.has(ownerId)) return;
        parcels.forEach((p) => allParcelIds.push(p.farmParcelId));
      });

      setOwnerAffiliationSelectedParcelIds(allParcelIds);
      setOwnerAffiliationTakeoverMode("full_parcel");
      setOwnerAffiliationSpecificLotInputs({});
      setOwnerAffiliationSourceOwnerId(
        nextSourceOptions.length === 1
          ? (nextSourceOptions[0].ownerId ?? "")
          : "",
      );

      if (nextSourceOptions.length === 0) {
        const extraNote =
          excludedRows > 0
            ? ` ${excludedRows} row${excludedRows === 1 ? " was" : "s were"} excluded.`
            : "";
        setOwnerAffiliationSubmitError(
          `No active linked landowner found for this ${role}.` + extraNote,
        );
      }
    } catch (error: any) {
      setOwnerAffiliationSourceOptions([]);
      setOwnerAffiliationParcelsByOwner(new Map());
      setOwnerAffiliationSourceOwnerId("");
      setOwnerAffiliationSelectedParcelIds([]);
      setOwnerAffiliationSubmitError(
        error?.message ||
          `Failed to load linked landowner context for ${role}.`,
      );
    } finally {
      setOwnerAffiliationLoading(false);
    }
  };

  const openOwnerAffiliationModal = (
    group: FarmerGroup,
    role: ReplacementRole,
  ) => {
    setOpenActionMenuRowId(null);
    setSelectedFarmer(group);
    setSelectedFarmerViewRole(role);
    setShowModal(false);
    setOwnerAffiliationRole(role);
    resetOwnerAffiliationWorkflow();
    setShowOwnerAffiliationModal(true);
    void loadOwnerAffiliationSourceOptions(group, role);
  };

  const closeOwnerAffiliationModal = () => {
    setShowOwnerAffiliationModal(false);
    resetOwnerAffiliationWorkflow();
  };

  const handleOwnerAffiliationSourceOwnerChange = (value: string) => {
    const parsedId = value ? Number(value) : "";
    setOwnerAffiliationSourceOwnerId(parsedId);

    if (typeof parsedId === "number" && parsedId > 0) {
      setOwnerAffiliationSelectedParcelIds(
        (ownerAffiliationParcelsByOwner.get(parsedId) || []).map(
          (parcel) => parcel.farmParcelId,
        ),
      );
      setOwnerAffiliationTakeoverMode("full_parcel");
      setOwnerAffiliationSpecificLotInputs({});
      setOwnerAffiliationNewOwnerId((prev) =>
        typeof prev === "number" && prev === parsedId ? "" : prev,
      );
    } else {
      setOwnerAffiliationSelectedParcelIds([]);
      setOwnerAffiliationTakeoverMode("full_parcel");
      setOwnerAffiliationSpecificLotInputs({});
      setOwnerAffiliationNewOwnerId("");
    }

    setOwnerAffiliationSubmitError("");
    setOwnerAffiliationSubmitSuccess("");
  };

  const handleOwnerAffiliationNewOwnerChange = (value: string) => {
    const parsedId = value ? Number(value) : "";
    setOwnerAffiliationNewOwnerId(parsedId);
    setOwnerAffiliationTakeoverMode("full_parcel");
    setOwnerAffiliationSpecificLotInputs({});
    setOwnerAffiliationSubmitError("");
    setOwnerAffiliationSubmitSuccess("");
  };

  const handleOwnerAffiliationParcelToggle = (
    farmParcelId: number,
    selected: boolean,
  ) => {
    setOwnerAffiliationSelectedParcelIds((prev) => {
      if (selected) {
        if (prev.includes(farmParcelId)) return prev;
        return [...prev, farmParcelId];
      }
      return prev.filter((id) => id !== farmParcelId);
    });

    if (!selected) {
      setOwnerAffiliationSpecificLotInputs((prev) => {
        if (!prev[farmParcelId]) return prev;
        const next = { ...prev };
        delete next[farmParcelId];
        return next;
      });
    }

    setOwnerAffiliationSubmitError("");
    setOwnerAffiliationSubmitSuccess("");
  };

  const handleOwnerAffiliationTakeoverModeChange = (
    mode: ReplacementTakeoverMode,
  ) => {
    setOwnerAffiliationTakeoverMode(mode);
    setOwnerAffiliationSubmitError("");
    setOwnerAffiliationSubmitSuccess("");
  };

  const handleOwnerAffiliationSpecificAreaChange = (
    farmParcelId: number,
    rawValue: string,
  ) => {
    const trimmed = rawValue.trim();
    setOwnerAffiliationSpecificLotInputs((prev) => ({
      ...prev,
      [farmParcelId]: {
        customAreaHa: trimmed === "" ? "" : Number(trimmed),
      },
    }));
    setOwnerAffiliationSubmitError("");
    setOwnerAffiliationSubmitSuccess("");
  };

  const handleOwnerAffiliationDocsSelected = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!ownerAffiliationReadyForProofUpload) {
      setOwnerAffiliationSubmitError(
        "Select linked owner, target owner, and parcel(s) before uploading proof documents.",
      );
      event.target.value = "";
      return;
    }

    const incomingFiles = Array.from(event.target.files || []);
    if (incomingFiles.length === 0) return;

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    const allowedMimeTypes = new Set([
      "image/png",
      "image/jpeg",
      "image/jpg",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]);

    const validFiles = incomingFiles.filter((file) => {
      if (allowedMimeTypes.has(file.type)) return true;
      const lowerName = (file.name || "").toLowerCase();
      return (
        lowerName.endsWith(".png") ||
        lowerName.endsWith(".jpg") ||
        lowerName.endsWith(".jpeg") ||
        lowerName.endsWith(".pdf") ||
        lowerName.endsWith(".doc") ||
        lowerName.endsWith(".docx")
      );
    });

    if (validFiles.length === 0) {
      setOwnerAffiliationSubmitError(
        "Only PNG, JPG, JPEG, PDF, DOC, or DOCX files are allowed.",
      );
      event.target.value = "";
      return;
    }

    const oversized = validFiles.filter((f) => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      setOwnerAffiliationSubmitError(
        `File(s) too large (max 10 MB): ${oversized.map((f) => f.name).join(", ")}`,
      );
      event.target.value = "";
      return;
    }

    setOwnerAffiliationSupportingDocs((prev) => {
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

    setOwnerAffiliationSubmitError("");
    setOwnerAffiliationSubmitSuccess("");
    event.target.value = "";
  };

  const removeOwnerAffiliationDoc = (targetIndex: number) => {
    setOwnerAffiliationSupportingDocs((prev) =>
      prev.filter((_, index) => index !== targetIndex),
    );
    setOwnerAffiliationSubmitError("");
    setOwnerAffiliationSubmitSuccess("");
  };

  const handleOwnerAffiliationConfirm = async () => {
    if (ownerAffiliationLoading || isSubmittingOwnerAffiliation) return;

    setOwnerAffiliationSubmitError("");
    setOwnerAffiliationSubmitSuccess("");

    if (!selectedFarmer) {
      setOwnerAffiliationSubmitError("Missing selected farmer context.");
      return;
    }

    const holderFarmerId = Number(selectedFarmer.farmer_id);

    const newOwnerId = Number(ownerAffiliationNewOwnerId);

    if (!Number.isFinite(holderFarmerId) || holderFarmerId <= 0) {
      setOwnerAffiliationSubmitError("Invalid holder farmer context.");
      return;
    }

    if (!Number.isFinite(newOwnerId) || newOwnerId <= 0) {
      setOwnerAffiliationSubmitError("Select the new linked landowner first.");
      return;
    }

    const selectedStep3ParcelById = new Map(
      ownerAffiliationStep3Parcels.map((parcel) => [
        parcel.farmParcelId,
        parcel,
      ]),
    );

    const selectedParcelIds = Array.from(
      new Set(
        ownerAffiliationTakeoverPlan.items
          .map((item) => Number(item.farm_parcel_id))
          .filter((parcelId) => Number.isFinite(parcelId) && parcelId > 0),
      ),
    );

    const selectedCurrentLinkedItems =
      ownerAffiliationTakeoverPlan.items.filter(
        (item) =>
          selectedStep3ParcelById.get(item.farm_parcel_id)?.sourceType ===
          "current_holder_link",
      );

    const selectedNewOwnerAvailableItems =
      ownerAffiliationTakeoverPlan.items.filter(
        (item) =>
          selectedStep3ParcelById.get(item.farm_parcel_id)?.sourceType ===
          "new_owner_available",
      );

    if (ownerAffiliationTakeoverPlan.error) {
      setOwnerAffiliationSubmitError(ownerAffiliationTakeoverPlan.error);
      return;
    }

    if (selectedParcelIds.length === 0) {
      setOwnerAffiliationSubmitError(
        `Select at least one parcel for ${ownerAffiliationRoleLabel.toLowerCase()} landowner update.`,
      );
      return;
    }

    if (
      ownerAffiliationTakeoverMode === "specific_slot" &&
      selectedNewOwnerAvailableItems.length > 0
    ) {
      setOwnerAffiliationSubmitError(
        "Specific slot is only allowed for current holder-linked parcels. Use Full parcel(s) when selecting new owner available parcels.",
      );
      return;
    }

    if (ownerAffiliationSupportingDocs.length === 0) {
      setOwnerAffiliationSubmitError(
        "Upload at least one proof/supporting document before proceeding.",
      );
      return;
    }

    const sourceParcelIdSet = new Set(
      ownerAffiliationStep3Parcels.map((parcel) => parcel.farmParcelId),
    );
    const hasOutOfContextParcel = selectedParcelIds.some(
      (parcelId) => !sourceParcelIdSet.has(parcelId),
    );
    if (hasOutOfContextParcel) {
      setOwnerAffiliationSubmitError(
        "Selected parcel list is outdated. Refresh source owner context and try again.",
      );
      return;
    }

    setIsSubmittingOwnerAffiliation(true);

    let uploadedProofs: Array<{
      storage_bucket: string;
      storage_path: string;
      file_name: string;
      mime_type: string;
      file_size_bytes: number;
    }> = [];
    let hasPersistedChanges = false;

    try {
      uploadedProofs = await uploadTransferProofs(
        ownerAffiliationSupportingDocs,
      );

      let updatedLinkedParcels = 0;
      let assignedOwnerParcels = 0;

      if (selectedCurrentLinkedItems.length > 0) {
        // Group items by their individual old owner so each gets its own RPC call
        const itemsByOldOwner = new Map<
          number,
          typeof selectedCurrentLinkedItems
        >();
        for (const item of selectedCurrentLinkedItems) {
          const parcel = selectedStep3ParcelById.get(item.farm_parcel_id);
          if (!parcel || parcel.ownerId === null) continue;
          const oldOwnerId = Number(parcel.ownerId);
          if (!Number.isFinite(oldOwnerId) || oldOwnerId <= 0) continue;
          if (oldOwnerId === newOwnerId) continue; // already belongs to the new owner
          const existing = itemsByOldOwner.get(oldOwnerId) ?? [];
          itemsByOldOwner.set(oldOwnerId, [...existing, item]);
        }

        if (itemsByOldOwner.size === 0) {
          throw new Error(
            "All selected parcels already belong to the new linked landowner.",
          );
        }

        for (const [oldOwnerId, items] of itemsByOldOwner.entries()) {
          const currentLinkedParcelIds = items
            .map((item) => Number(item.farm_parcel_id))
            .filter((id) => Number.isFinite(id) && id > 0);

          const { data, error } = await supabase.rpc(
            "update_tenant_lessee_landowner_affiliation_no_review",
            {
              p_role: ownerAffiliationRole,
              p_holder_farmer_id: holderFarmerId,
              p_old_owner_id: oldOwnerId,
              p_new_owner_id: newOwnerId,
              p_farm_parcel_ids: currentLinkedParcelIds,
              p_items: items,
              p_reason: ownerAffiliationReason.trim() || null,
              p_effective_date: new Date().toISOString().slice(0, 10),
              p_proofs: uploadedProofs,
            },
          );

          if (error) {
            const rpcMessage = String(error?.message || "");
            const rpcDetails = String((error as any)?.details || "");
            if (
              /update_tenant_lessee_landowner_affiliation_no_review/i.test(
                `${rpcMessage} ${rpcDetails}`,
              )
            ) {
              throw new Error(
                "Supabase RPC update_tenant_lessee_landowner_affiliation_no_review is missing. Run the SQL script and retry.",
              );
            }
            throw new Error(
              error.message ||
                `Failed to update ${ownerAffiliationRoleLabel.toLowerCase()} linked landowner.`,
            );
          }

          updatedLinkedParcels += Number(
            (data as any)?.selectedParcels ??
              (data as any)?.selected_parcels ??
              items.length,
          );
          hasPersistedChanges = true;
        }
      }

      if (selectedNewOwnerAvailableItems.length > 0) {
        if (holderFarmerId === newOwnerId) {
          throw new Error(
            "Selected holder and new owner are the same record. Cannot assign owner parcels to the same owner record.",
          );
        }

        const ownerAvailableItems = selectedNewOwnerAvailableItems.map(
          (item) => ({
            farm_parcel_id: item.farm_parcel_id,
            takeover_mode: "full",
            transfer_area_ha: item.transfer_area_ha,
          }),
        );

        const { data: assignmentData, error: assignmentError } =
          await supabase.rpc(
            "replace_tenant_lessee_holder_with_portions_no_review",
            {
              p_role: ownerAffiliationRole,
              p_current_holder_id: newOwnerId,
              p_replacement_holder_id: holderFarmerId,
              p_owner_context_id: newOwnerId,
              p_reason: ownerAffiliationReason.trim() || null,
              p_effective_date: new Date().toISOString().slice(0, 10),
              p_items: ownerAvailableItems,
              p_proofs: uploadedProofs,
            },
          );

        if (assignmentError) {
          const rpcMessage = String(assignmentError?.message || "");
          const rpcDetails = String((assignmentError as any)?.details || "");

          if (
            /replace_tenant_lessee_holder_with_portions_no_review/i.test(
              `${rpcMessage} ${rpcDetails}`,
            )
          ) {
            throw new Error(
              "Supabase RPC replace_tenant_lessee_holder_with_portions_no_review is missing. Run database/create_replace_tenant_lessee_holder_with_portions_rpc.sql in Supabase SQL Editor, then retry.",
            );
          }

          throw new Error(
            assignmentError.message ||
              `Failed to assign selected ${ownerAffiliationRoleLabel.toLowerCase()} parcel(s) from new owner context.`,
          );
        }

        assignedOwnerParcels = Number(
          (assignmentData as any)?.selectedParcels ??
            (assignmentData as any)?.selected_parcels ??
            selectedNewOwnerAvailableItems.length,
        );
        hasPersistedChanges = true;
      }

      const successParts: string[] = [];
      if (updatedLinkedParcels > 0) {
        successParts.push(
          `${updatedLinkedParcels} linked parcel${updatedLinkedParcels === 1 ? "" : "s"} re-linked`,
        );
      }
      if (assignedOwnerParcels > 0) {
        successParts.push(
          `${assignedOwnerParcels} new owner parcel${assignedOwnerParcels === 1 ? "" : "s"} assigned`,
        );
      }

      if (successParts.length === 0) {
        throw new Error("No valid parcel selection to process.");
      }

      setOwnerAffiliationSubmitSuccess(
        `${ownerAffiliationRoleLabel} update complete: ${successParts.join(" and ")}.`,
      );

      await refreshLandParcels();
      if (selectedFarmer.parcels.length > 0) {
        await fetchParcelHistoryForIds(selectedFarmer.parcels.map((p) => p.id));
      }
    } catch (error: any) {
      if (uploadedProofs.length > 0 && !hasPersistedChanges) {
        await cleanupUploadedProofs(uploadedProofs);
      }
      setOwnerAffiliationSubmitError(
        hasPersistedChanges
          ? `Partial update completed before an error occurred: ${error?.message || "Unknown error"}. Refresh data and verify parcel state.`
          : error?.message ||
              `Failed to update ${ownerAffiliationRoleLabel.toLowerCase()} linked landowner.`,
      );

      if (hasPersistedChanges) {
        await refreshLandParcels();
        if (selectedFarmer.parcels.length > 0) {
          await fetchParcelHistoryForIds(
            selectedFarmer.parcels.map((p) => p.id),
          );
        }
      }
    } finally {
      setIsSubmittingOwnerAffiliation(false);
    }
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
        .order("period_start_date", { ascending: true });

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

  const getParcelsForRegistryOwnership = (
    group: FarmerGroup,
    ownership: RegistryRowOwnership,
  ): FarmerGroup["parcels"] => {
    const sourceParcels = Array.isArray(group.parcels) ? group.parcels : [];
    if (sourceParcels.length === 0) return [];

    if (ownership === "owner") {
      const ownerParcels = sourceParcels.filter(
        (parcel) =>
          parcel?.is_registered_owner === true ||
          (parcel?.is_tenant !== true && parcel?.is_lessee !== true),
      );
      return ownerParcels.length > 0 ? ownerParcels : sourceParcels;
    }

    const roleParcels = sourceParcels.filter((parcel) =>
      ownership === "tenant"
        ? parcel?.is_tenant === true
        : parcel?.is_lessee === true,
    );

    return roleParcels.length > 0 ? roleParcels : sourceParcels;
  };

  const deriveRegistryActionCapabilities = (
    group: FarmerGroup,
  ): RegistryActionCapabilities => {
    const sourceParcels = Array.isArray(group.parcels) ? group.parcels : [];
    const ownerParcels = getParcelsForRegistryOwnership(group, "owner");
    const canTransferOwnership =
      group.has_registered_owner ||
      ownerParcels.some((parcel) => {
        const area = Number(parcel?.total_farm_area_ha) || 0;
        return (
          area > 0 && parcel?.is_tenant !== true && parcel?.is_lessee !== true
        );
      });

    const canUpdateTenantLandowner =
      group.has_tenant || sourceParcels.some((parcel) => parcel?.is_tenant);
    const canUpdateLesseeLandowner =
      group.has_lessee || sourceParcels.some((parcel) => parcel?.is_lessee);

    return {
      canTransferOwnership,
      canUpdateTenantLandowner,
      canUpdateLesseeLandowner,
    };
  };

  const registryRows = useMemo<RegistryDisplayRow[]>(() => {
    const toPositiveArea = (value: unknown) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    };

    const buildRow = (group: FarmerGroup): RegistryDisplayRow => {
      const capabilities = deriveRegistryActionCapabilities(group);
      const primaryOwnership: RegistryRowOwnership =
        capabilities.canTransferOwnership
          ? "owner"
          : capabilities.canUpdateTenantLandowner
            ? "tenant"
            : "lessee";

      const ownershipLabelByRole: Record<RegistryRowOwnership, string> = {
        owner: "Registered Owner",
        tenant: "Tenant",
        lessee: "Lessee",
      };

      const roleAvailability: Record<RegistryRowOwnership, boolean> = {
        owner: capabilities.canTransferOwnership,
        tenant: capabilities.canUpdateTenantLandowner,
        lessee: capabilities.canUpdateLesseeLandowner,
      };

      const ownershipSecondaryLabels = (
        Object.keys(roleAvailability) as RegistryRowOwnership[]
      )
        .filter((role) => role !== primaryOwnership && roleAvailability[role])
        .map((role) => ownershipLabelByRole[role]);

      const parcels = Array.isArray(group.parcels) ? group.parcels : [];
      const areaFromParcels = parcels.reduce(
        (sum, parcel) => sum + toPositiveArea(parcel?.total_farm_area_ha),
        0,
      );
      const totalAreaHa =
        areaFromParcels > 0
          ? areaFromParcels
          : toPositiveArea(group.total_farm_area_ha);
      const barangays = Array.from(
        new Set(
          parcels
            .map((parcel) => (parcel.farm_location_barangay || "").trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b));

      return {
        rowId: String(group.farmer_id),
        farmer: group,
        primaryOwnership,
        ownershipSecondaryLabels,
        capabilities,
        parcels,
        totalAreaHa,
        primaryBarangay:
          barangays.length === 0
            ? "Multiple"
            : barangays.length === 1
              ? barangays[0]
              : "Multiple",
      };
    };

    const rows: RegistryDisplayRow[] = [];

    aggregatedFarmers.forEach((group) => {
      if (!group || !Array.isArray(group.parcels) || group.parcels.length === 0)
        return;

      rows.push(buildRow(group));
    });

    return rows;
  }, [aggregatedFarmers]);

  // Get unique barangays for filter
  const uniqueBarangays = useMemo(() => {
    const barangays = registryRows.flatMap((row) =>
      row.parcels
        .map((parcel) => (parcel.farm_location_barangay || "").trim())
        .filter(Boolean),
    );
    return [...new Set(barangays)].sort((a, b) => a.localeCompare(b));
  }, [registryRows]);

  const getEligibleTransferDonorParcels = (group: FarmerGroup) => {
    const ownerParcels = getParcelsForRegistryOwnership(group, "owner");
    return ownerParcels.filter(
      (parcel) => parcel?.is_tenant !== true && parcel?.is_lessee !== true,
    );
  };

  // Build transfer actor options (for dropdowns) from aggregated farmers
  const buildTransferActorOptions = (
    farmers: FarmerGroup[],
    excludeFarmerId?: number, // ← second parameter (optional)
  ): TransferActorOption[] => {
    const toPositiveArea = (value: unknown) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    };

    return farmers
      .map((group) => {
        const ownerParcels = getEligibleTransferDonorParcels(group);
        const ownerAreaHa = ownerParcels.reduce(
          (sum, parcel) => sum + toPositiveArea(parcel?.total_farm_area_ha),
          0,
        );

        return {
          group,
          ownerParcels,
          ownerAreaHa,
        };
      })
      .filter((group) => {
        // Exclude the current clicked farmer to prevent self-transfer
        if (excludeFarmerId && group.group.farmer_id === excludeFarmerId) {
          return false;
        }
        if (group.ownerParcels.length === 0 || group.ownerAreaHa <= 0) {
          return false;
        }
        return (
          group.group.has_registered_owner || group.ownerParcels.length > 0
        );
      })
      .map(({ group, ownerParcels }) => ({
        farmerId: group.farmer_id,
        name: group.farmer_name || `Farmer #${group.farmer_id}`,
        barangay: ownerParcels[0]?.farm_location_barangay || "",
        parcelIds: ownerParcels.map((p) => p.id),
        parcelCount: ownerParcels.length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const filteredRegistryRows = useMemo(() => {
    const toDisplayDayTime = (value: string | null | undefined) => {
      if (!value) return Number.POSITIVE_INFINITY;
      const parsed = new Date(value);
      if (!Number.isFinite(parsed.getTime())) return Number.POSITIVE_INFINITY;
      return new Date(
        parsed.getFullYear(),
        parsed.getMonth(),
        parsed.getDate(),
      ).getTime();
    };

    const ownershipOrder: Record<RegistryRowOwnership, number> = {
      owner: 0,
      tenant: 1,
      lessee: 2,
    };

    return registryRows
      .filter((row) => {
        if (row.parcels.length === 0) return false;
        if (row.totalAreaHa <= 0) return false;

        if (filterCultivation !== "all") {
          const cultivationFlags = row.parcels
            .map((parcel) => {
              const raw =
                (parcel as any)?.is_cultivating ??
                (parcel as any)?.isCultivating;
              if (raw === true || raw === false) return raw;
              if (typeof raw === "string") {
                const normalized = raw.trim().toLowerCase();
                if (normalized === "true" || normalized === "yes") return true;
                if (normalized === "false" || normalized === "no") return false;
              }
              return null;
            })
            .filter((value): value is boolean => value !== null);

          if (filterCultivation === "active") {
            if (!cultivationFlags.some((value) => value === true)) return false;
          }

          if (filterCultivation === "inactive") {
            const hasInactive = cultivationFlags.some(
              (value) => value === false,
            );
            if (!hasInactive) return false;
          }
        }

        if (filterBarangay) {
          const hasBarangayMatch = row.parcels.some(
            (p) =>
              (p.farm_location_barangay || "").trim().toLowerCase() ===
              filterBarangay.trim().toLowerCase(),
          );
          if (!hasBarangayMatch) return false;
        }

        const lowerSearch = searchTerm.toLowerCase();
        if (!lowerSearch) return true;

        if (row.farmer.farmer_name.toLowerCase().includes(lowerSearch))
          return true;
        if ((row.farmer.ffrs_code || "").toLowerCase().includes(lowerSearch))
          return true;
        return row.parcels.some((p) =>
          p.parcel_number.toLowerCase().includes(lowerSearch),
        );
      })
      .sort((a, b) => {
        // Newest to oldest based on the same day shown in the Since column.
        const dateDiff =
          toDisplayDayTime(b.farmer.last_updated) -
          toDisplayDayTime(a.farmer.last_updated);
        if (dateDiff !== 0) return dateDiff;
        const nameDiff = a.farmer.farmer_name.localeCompare(
          b.farmer.farmer_name,
        );
        if (nameDiff !== 0) return nameDiff;
        return (
          ownershipOrder[a.primaryOwnership] -
          ownershipOrder[b.primaryOwnership]
        );
      });
  }, [registryRows, searchTerm, filterBarangay, filterCultivation]);

  const registeredOwnerParcels = landParcels.filter(
    (p) => p.is_registered_owner,
  );

  const selectedContextFarmerId = selectedFarmer?.farmer_id ?? null;
  const selectedContextFarmerName = selectedFarmer?.farmer_name || "Unknown";
  const selectedFarmerCapabilities = selectedFarmer
    ? deriveRegistryActionCapabilities(selectedFarmer)
    : null;
  const selectedContextRoleLabel = useMemo(() => {
    if (!selectedFarmer) return "Registered Owner";
    if (selectedFarmerViewRole === "tenant") return "Tenant";
    if (selectedFarmerViewRole === "lessee") return "Lessee";
    return "Registered Owner";
  }, [selectedFarmer, selectedFarmerViewRole]);

  const selectedOwnerAffiliationQuickRoleOptions = useMemo<
    ReplacementRole[]
  >(() => {
    if (!selectedFarmerCapabilities) return [];

    const options: ReplacementRole[] = [];
    if (selectedFarmerCapabilities.canUpdateTenantLandowner) {
      options.push("tenant");
    }
    if (selectedFarmerCapabilities.canUpdateLesseeLandowner) {
      options.push("lessee");
    }
    return options;
  }, [selectedFarmerCapabilities]);

  const selectedOwnerAffiliationQuickRole: ReplacementRole | null =
    useMemo(() => {
      if (selectedOwnerAffiliationQuickRoleOptions.length === 0) return null;

      if (
        ownerAffiliationQuickRoleSelection &&
        selectedOwnerAffiliationQuickRoleOptions.includes(
          ownerAffiliationQuickRoleSelection,
        )
      ) {
        return ownerAffiliationQuickRoleSelection;
      }

      if (
        selectedFarmerViewRole === "tenant" &&
        selectedOwnerAffiliationQuickRoleOptions.includes("tenant")
      ) {
        return "tenant";
      }

      if (
        selectedFarmerViewRole === "lessee" &&
        selectedOwnerAffiliationQuickRoleOptions.includes("lessee")
      ) {
        return "lessee";
      }

      return selectedOwnerAffiliationQuickRoleOptions[0];
    }, [
      ownerAffiliationQuickRoleSelection,
      selectedFarmerViewRole,
      selectedOwnerAffiliationQuickRoleOptions,
    ]);

  useEffect(() => {
    setOwnerAffiliationQuickRoleSelection("");
  }, [selectedFarmer?.farmer_id, selectedFarmerViewRole]);

  const ownerAffiliationRoleLabel =
    ownerAffiliationRole === "tenant" ? "Tenant" : "Lessee";

  const activeOwnerAffiliationSourceOwnerId = (() => {
    const candidate =
      ownerAffiliationSourceOwnerId === ""
        ? null
        : Number(ownerAffiliationSourceOwnerId);
    return Number.isFinite(candidate) && (candidate || 0) > 0
      ? Number(candidate)
      : null;
  })();

  const selectedOwnerAffiliationSourceParcels =
    activeOwnerAffiliationSourceOwnerId === null
      ? []
      : (ownerAffiliationParcelsByOwner.get(
          activeOwnerAffiliationSourceOwnerId,
        ) ?? []);

  const selectedOwnerAffiliationSource =
    ownerAffiliationSourceOptions.find(
      (option) => option.ownerId === activeOwnerAffiliationSourceOwnerId,
    ) ||
    (selectedFarmer && activeOwnerAffiliationSourceOwnerId !== null
      ? {
          farmerId: selectedFarmer.farmer_id,
          farmerName:
            selectedFarmer.farmer_name || `Farmer #${selectedFarmer.farmer_id}`,
          ownerId: activeOwnerAffiliationSourceOwnerId,
          ownerName:
            selectedOwnerAffiliationSourceParcels[0]?.ownerName ||
            `Owner #${activeOwnerAffiliationSourceOwnerId}`,
          parcelCount: selectedOwnerAffiliationSourceParcels.length,
        }
      : null);

  const selectedOwnerAffiliationAreaHa =
    selectedOwnerAffiliationSourceParcels.reduce((sum, parcel) => {
      const area = Number(parcel.areaHa);
      return sum + (Number.isFinite(area) ? area : 0);
    }, 0);

  const ownerAffiliationHasSingleSourceContext =
    ownerAffiliationSourceOptions.length === 1;

  const activeOwnerAffiliationNewOwnerId = (() => {
    const candidate =
      ownerAffiliationNewOwnerId === ""
        ? null
        : Number(ownerAffiliationNewOwnerId);
    return Number.isFinite(candidate) && (candidate || 0) > 0
      ? Number(candidate)
      : null;
  })();

  const getParcelKey = (
    parcel: ReplacementAssignedParcel | OwnerAffiliationStep3Parcel,
  ): number => {
    const landId = Number(parcel.landParcelId);
    if (Number.isFinite(landId) && landId > 0) return landId;
    return Number(parcel.farmParcelId);
  };

  const selectedOwnerAffiliationNewOwnerAvailableParcels = useMemo<
    ReplacementAssignedParcel[]
  >(() => {
    if (activeOwnerAffiliationNewOwnerId === null) return [];

    const ownerGroup = aggregatedFarmers.find(
      (g) => g.farmer_id === activeOwnerAffiliationNewOwnerId,
    );
    if (!ownerGroup) return [];

    // Derive the new owner's registered-owner parcels (same filter used elsewhere)
    const ownerParcels = getParcelsForRegistryOwnership(
      ownerGroup,
      "owner",
    ).filter(
      (parcel) => parcel?.is_tenant !== true && parcel?.is_lessee !== true,
    );

    return ownerParcels.map((parcel) => ({
      historyId: parcel.id,
      farmParcelId: parcel.id,
      landParcelId: (parcel as any).land_parcel_id ?? null,
      parcelNumber: parcel.parcel_number || "",
      barangay: parcel.farm_location_barangay || "",
      municipality: parcel.farm_location_municipality || "",
      areaHa: Number(parcel.total_farm_area_ha) || 0,
      ownerId: activeOwnerAffiliationNewOwnerId,
      ownerName:
        ownerGroup.farmer_name || `Owner #${activeOwnerAffiliationNewOwnerId}`,
    }));
  }, [activeOwnerAffiliationNewOwnerId, aggregatedFarmers]);

  const ownerAffiliationStep3Parcels = useMemo<
    OwnerAffiliationStep3Parcel[]
  >(() => {
    const parcelMap = new Map<number, OwnerAffiliationStep3Parcel>();

    // When the new owner has available parcels, show ONLY those.
    // The user's intent is to assign the holder to the new owner's parcels —
    // mixing in the old contract parcel (current_holder_link) causes confusion
    // and makes the list count wrong (e.g. Harold has 2 parcels but 3 appear).
    if (selectedOwnerAffiliationNewOwnerAvailableParcels.length > 0) {
      selectedOwnerAffiliationNewOwnerAvailableParcels.forEach((parcel) => {
        const key = getParcelKey(parcel);
        if (parcelMap.has(key)) return;
        parcelMap.set(key, {
          ...parcel,
          inCurrentContract: false,
          sourceType: "new_owner_available",
        });
      });

      return Array.from(parcelMap.values()).sort((a, b) => {
        const parcelDiff = (a.parcelNumber || "").localeCompare(
          b.parcelNumber || "",
        );
        if (parcelDiff !== 0) return parcelDiff;
        return a.farmParcelId - b.farmParcelId;
      });
    }

    // Fallback (no new owner selected yet): show the holder's current contract
    // parcels from land_history, filtered to the selected source owner only.
    const validOwnerIds = new Set(
      ownerAffiliationSourceOptions
        .map((o) => o.ownerId)
        .filter((id): id is number => typeof id === "number" && id > 0),
    );

    ownerAffiliationParcelsByOwner.forEach((parcels, ownerId) => {
      if (!validOwnerIds.has(ownerId)) return;
      if (
        activeOwnerAffiliationSourceOwnerId !== null &&
        ownerId !== activeOwnerAffiliationSourceOwnerId
      )
        return;
      parcels.forEach((parcel) => {
        const key = getParcelKey(parcel);
        if (parcelMap.has(key)) return;
        parcelMap.set(key, {
          ...parcel,
          inCurrentContract: true,
          sourceType: "current_holder_link",
        });
      });
    });

    return Array.from(parcelMap.values()).sort((a, b) => {
      const parcelDiff = (a.parcelNumber || "").localeCompare(
        b.parcelNumber || "",
      );
      if (parcelDiff !== 0) return parcelDiff;
      return a.farmParcelId - b.farmParcelId;
    });
  }, [
    ownerAffiliationParcelsByOwner,
    ownerAffiliationSourceOptions,
    activeOwnerAffiliationSourceOwnerId,
    selectedOwnerAffiliationNewOwnerAvailableParcels,
  ]);

  const handleOwnerAffiliationSelectAllParcels = useCallback(() => {
    setOwnerAffiliationSelectedParcelIds(
      ownerAffiliationStep3Parcels.map((parcel) => parcel.farmParcelId),
    );
    setOwnerAffiliationSubmitError("");
    setOwnerAffiliationSubmitSuccess("");
  }, [ownerAffiliationStep3Parcels]);

  const handleOwnerAffiliationClearSelectedParcels = useCallback(() => {
    setOwnerAffiliationSelectedParcelIds([]);
    setOwnerAffiliationSpecificLotInputs({});
    setOwnerAffiliationSubmitError("");
    setOwnerAffiliationSubmitSuccess("");
  }, []);

  const ownerAffiliationSelectableAreaHa = ownerAffiliationStep3Parcels.reduce(
    (sum, parcel) => {
      const area = Number(parcel.areaHa);
      return sum + (Number.isFinite(area) ? area : 0);
    },
    0,
  );

  const ownerAffiliationTakeoverPlan = useMemo(() => {
    return buildReplacementTakeoverPlan(
      ownerAffiliationStep3Parcels,
      ownerAffiliationSelectedParcelIds,
      ownerAffiliationTakeoverMode,
      ownerAffiliationSpecificLotInputs,
    );
  }, [
    ownerAffiliationStep3Parcels,
    ownerAffiliationSelectedParcelIds,
    ownerAffiliationTakeoverMode,
    ownerAffiliationSpecificLotInputs,
  ]);

  const ownerAffiliationTakeoverModeLabel =
    ownerAffiliationTakeoverMode === "full_parcel"
      ? "Full parcel(s)"
      : "Specific slot per parcel";

  const ownerAffiliationOwnerOptions = useMemo<OwnerAffiliationOwnerOption[]>(
    () =>
      aggregatedFarmers
        .map((group) => {
          const ownerParcels = getEligibleTransferDonorParcels(group);
          return {
            group,
            ownerParcels,
          };
        })
        .filter(({ group, ownerParcels }) => {
          if (ownerParcels.length === 0) return false;
          if (
            activeOwnerAffiliationSourceOwnerId !== null &&
            group.farmer_id === activeOwnerAffiliationSourceOwnerId
          )
            return false;
          if (
            selectedContextFarmerId !== null &&
            group.farmer_id === selectedContextFarmerId
          )
            return false;

          // ✅ ADD THIS: exclude any farmer who is already a source-linked owner
          const isSourceOwner = ownerAffiliationSourceOptions.some(
            (opt) => opt.ownerId === group.farmer_id,
          );
          if (isSourceOwner) return false;

          return true;
        })
        .map(({ group, ownerParcels }) => ({
          ownerId: group.farmer_id,
          ownerName: group.farmer_name || `Farmer #${group.farmer_id}`,
          barangay:
            ownerParcels[0]?.farm_location_barangay ||
            group.parcels[0]?.farm_location_barangay ||
            "No barangay",
          parcelCount: ownerParcels.length,
        }))
        .sort((a, b) => a.ownerName.localeCompare(b.ownerName)),
    [
      aggregatedFarmers,
      activeOwnerAffiliationSourceOwnerId,
      selectedContextFarmerId,
      getEligibleTransferDonorParcels,
      ownerAffiliationSourceOptions,
    ],
  );

  const selectedOwnerAffiliationNewOwner =
    ownerAffiliationOwnerOptions.find(
      (option) => option.ownerId === ownerAffiliationNewOwnerId,
    ) || null;

  const ownerAffiliationPreviewParcels = useMemo(() => {
    const parcelById = new Map<number, ReplacementAssignedParcel>();
    ownerAffiliationStep3Parcels.forEach((parcel) => {
      parcelById.set(parcel.farmParcelId, parcel);
    });

    return ownerAffiliationTakeoverPlan.items
      .map((item) => {
        const parcel = parcelById.get(item.farm_parcel_id);
        if (!parcel) return null;
        return {
          ...parcel,
          selectedAreaHa: Number(item.transfer_area_ha) || 0,
          scopeMode: item.takeover_mode,
        };
      })
      .filter(
        (
          parcel,
        ): parcel is ReplacementAssignedParcel & {
          selectedAreaHa: number;
          scopeMode: "full" | "specific";
        } => parcel !== null,
      );
  }, [ownerAffiliationStep3Parcels, ownerAffiliationTakeoverPlan.items]);

  const ownerAffiliationReadyForProofUpload =
    ownerAffiliationNewOwnerId !== "" &&
    ownerAffiliationTakeoverPlan.items.length > 0 &&
    ownerAffiliationTakeoverPlan.error === "";

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
  const voluntarySelectedAreaHa =
    voluntaryAreaMode === "take_all"
      ? voluntaryDonorTotalAreaHa
      : typeof voluntaryPartialAreaHa === "number"
        ? voluntaryPartialAreaHa
        : 0;
  const inheritanceDonorTotalAreaHa = inheritanceTransferParcels.reduce(
    (sum, parcel) =>
      sum +
      (Number.isFinite(parcel.total_farm_area_ha)
        ? parcel.total_farm_area_ha
        : 0),
    0,
  );

  const inheritanceSelectedAreaHa =
    inheritanceAreaMode === "take_all"
      ? inheritanceDonorTotalAreaHa
      : typeof inheritancePartialAreaHa === "number"
        ? inheritancePartialAreaHa
        : 0;

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

  const donorParcelsForTransfer = donorFarmerGroup
    ? getEligibleTransferDonorParcels(donorFarmerGroup)
    : [];

  const donorSplitParcels: ParcelSplitInput[] = donorParcelsForTransfer.map(
    (p) => ({
      farm_parcel_id: p.id,
      parcel_number: p.parcel_number,
      farm_location_barangay: p.farm_location_barangay,
      total_farm_area_ha: Number(p.total_farm_area_ha) || 0,
      transfer_area_ha: parcelSplitInputs[p.id] ?? "",
    }),
  );

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
  const transferBlockingReason = (() => {
    if (!transferMode) return "Select a transfer type.";
    if (selectedContextFarmerId === null) {
      return "Current selected holder is invalid for transfer.";
    }
    if (transferMode === "inheritance" && !selectedBeneficiaryOwner) {
      return "Select the registered owner giving the inheritance.";
    }
    if (transferMode === "voluntary" && !selectedRegisteredOwner) {
      return "Select the registered owner donating the land.";
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

  const openTransferModal = (contextOwnership?: RegistryRowOwnership) => {
    const ownership = contextOwnership ?? selectedFarmerViewRole;
    if (ownership !== "owner") {
      return;
    }

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
        invalidRoleParcelIds: [] as number[],
        verifiedAvailableAreaHa: 0,
      };
    }

    const { data, error } = await supabase
      .from("rsbsa_farm_parcels")
      .select(
        "id, submission_id, total_farm_area_ha, ownership_type_registered_owner, ownership_type_tenant, ownership_type_lessee",
      )
      .in("id", uniqueParcelIds);

    if (error) {
      throw new Error(
        `Could not verify donor parcel ownership: ${error.message}`,
      );
    }

    const rows = Array.isArray(data) ? data : [];
    const ownedParcelMetaMap = new Map<
      number,
      {
        areaHa: number;
        isRegisteredOwner: boolean | null;
        isTenant: boolean;
        isLessee: boolean;
      }
    >();

    rows.forEach((row: any) => {
      const parcelId = Number(row.id);
      const ownerId = Number(row.submission_id);
      if (!Number.isFinite(parcelId) || !Number.isFinite(ownerId)) return;
      if (ownerId !== donorFarmerId) return;

      ownedParcelMetaMap.set(parcelId, {
        areaHa: Number(row.total_farm_area_ha) || 0,
        isRegisteredOwner:
          typeof row.ownership_type_registered_owner === "boolean"
            ? row.ownership_type_registered_owner
            : null,
        isTenant: row.ownership_type_tenant === true,
        isLessee: row.ownership_type_lessee === true,
      });
    });

    const invalidRoleParcelIds = Array.from(ownedParcelMetaMap.entries())
      .filter(([, meta]) => {
        if (meta.isTenant || meta.isLessee) return true;
        if (meta.isRegisteredOwner === false) return true;
        return false;
      })
      .map(([parcelId]) => parcelId);

    const invalidRoleIdSet = new Set(invalidRoleParcelIds);

    const verifiedParcels = parcels
      .filter((parcel) => {
        const parcelId = Number(parcel.land_parcel_id);
        return (
          ownedParcelMetaMap.has(parcelId) && !invalidRoleIdSet.has(parcelId)
        );
      })
      .map((parcel) => ({
        ...parcel,
        total_farm_area_ha:
          ownedParcelMetaMap.get(Number(parcel.land_parcel_id))?.areaHa ??
          parcel.total_farm_area_ha,
      }));

    const invalidParcelIds = uniqueParcelIds.filter(
      (parcelId) => !ownedParcelMetaMap.has(parcelId),
    );

    const verifiedAvailableAreaHa = verifiedParcels.reduce((sum, parcel) => {
      const area = Number(parcel.total_farm_area_ha);
      return sum + (Number.isFinite(area) ? area : 0);
    }, 0);

    return {
      verifiedParcels,
      invalidParcelIds,
      invalidRoleParcelIds,
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
          contentType: file.type || "application/octet-stream",
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
        file_name: file.name || `proof-${index + 1}.bin`,
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
      const {
        verifiedParcels,
        invalidParcelIds,
        invalidRoleParcelIds,
        verifiedAvailableAreaHa,
      } = await verifyDonorParcelOwnership(
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

      if (invalidRoleParcelIds.length > 0) {
        await refreshLandParcels();
        setTransferSubmitError(
          `Only registered-owner parcels can be transferred. Remove these ineligible parcel IDs and retry: ${invalidRoleParcelIds.join(", ")}.`,
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
          uploadedProofs,
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

          if (
            rpcCode === "P0005" ||
            /only registered owners can transfer legal ownership/i.test(
              `${rpcMessage} ${rpcDetails}`,
            )
          ) {
            throw new Error(
              "Transfer blocked by policy: only registered owners can transfer legal ownership.",
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

      const transferredParcelIds = donorSplitParcels
        .map((p) => p.farm_parcel_id)
        .filter((id) => Number.isFinite(id) && id > 0);

      if (transferredParcelIds.length > 0) {
        if (transferMode === "inheritance") {
          // Inheritance: always auto-relink, no prompt needed
          const { error: relinkError } = await supabase.rpc(
            "auto_relink_tenant_lessee_on_transfer",
            {
              p_old_owner_id: fromFarmerId,
              p_new_owner_id: toFarmerId,
              p_farm_parcel_ids: transferredParcelIds,
            },
          );
          if (relinkError) {
            console.warn(
              "Transfer succeeded but auto tenant/lessee re-link failed:",
              relinkError.message,
            );
          }
        } else if (transferMode === "voluntary") {
          // Voluntary: only relink if the donor is being archived (transferred ALL parcels)
          // i.e. they have no remaining parcels after this transfer
          const remainingParcels =
            donorFarmerGroup?.parcels.filter(
              (p) => !transferredParcelIds.includes(p.id),
            ) ?? [];

          if (remainingParcels.length === 0) {
            // Donor is going to be archived — must relink or tenant/lessee is orphaned
            const { error: relinkError } = await supabase.rpc(
              "auto_relink_tenant_lessee_on_transfer",
              {
                p_old_owner_id: fromFarmerId,
                p_new_owner_id: toFarmerId,
                p_farm_parcel_ids: transferredParcelIds,
              },
            );
            if (relinkError) {
              console.warn(
                "Transfer succeeded but tenant/lessee re-link failed:",
                relinkError.message,
              );
            }
          }
          // If donor still has remaining parcels after voluntary transfer,
          // tenant/lessee links are still valid — no re-linking needed
        }
      }

      // Then existing cleanup RPCs continue as normal...
      await supabase.rpc("check_and_update_farmer_parcel_status", {
        p_farmer_id: fromFarmerId,
      });

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

      if (toFarmerId !== fromFarmerId) {
        await supabase.rpc("sync_farmer_no_parcels_status", {
          p_farmer_id: toFarmerId,
        });
      }

      await refreshLandParcels();

      const updatedDonor = aggregatedFarmers.find(
        (g) => g.farmer_id === fromFarmerId,
      );
      if (!updatedDonor || updatedDonor.parcels.length === 0) {
        setSelectedFarmer(null);
        setSelectedRegistryRowId(null);
        setSelectedFarmerViewRole("owner");
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

  const toggleRowActionMenu = (rowId: string) => {
    setOpenActionMenuRowId((prev) => (prev === rowId ? null : rowId));
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
              <span className="nav-text">Subsidy</span>
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

            <div
              className={`sidebar-nav-item ${isActive("/jo-land-history-report") ? "active" : ""}`}
              onClick={() => navigate("/jo-land-history-report")}
            >
              <div className="nav-icon">📜</div>
              <span className="nav-text">Land History Report</span>
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
        <div
          className={`tech-incent-sidebar-overlay ${sidebarOpen ? "active" : ""}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Main Content */}
        <div className="jo-land-registry-main-content">
          <div className="tech-incent-mobile-header">
            <button
              className="tech-incent-hamburger"
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              ☰
            </button>
            <div className="tech-incent-mobile-title">JO Land Registry</div>
          </div>
          {/* Header */}
          <div className="jo-land-registry-dashboard-header">
            <h1 className="jo-land-registry-page-title">🗺️ Land Registry</h1>
            <p className="jo-land-registry-page-subtitle">
              View land parcels and ownership history
            </p>
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
              <div className="jo-land-registry-barangay-filter">
                <select
                  className="jo-land-registry-barangay-select"
                  value={filterCultivation}
                  onChange={(e) =>
                    setFilterCultivation(
                      e.target.value as "all" | "active" | "inactive",
                    )
                  }
                >
                  <option value="all">All Cultivation Status</option>
                  <option value="active">Actively Farming</option>
                  <option value="inactive">Not Farming</option>
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
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="jo-land-registry-loading-cell">
                        Loading land parcels...
                      </td>
                    </tr>
                  ) : filteredRegistryRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="jo-land-registry-empty-cell">
                        {searchTerm || filterBarangay
                          ? "No parcels match your search criteria"
                          : "No land parcels registered yet"}
                      </td>
                    </tr>
                  ) : (
                    filteredRegistryRows.map((row) => (
                      <tr
                        key={row.rowId}
                        onClick={() =>
                          handleFarmerSelect(
                            row.farmer,
                            row.primaryOwnership,
                            row.parcels.map((parcel) => parcel.id),
                            row.rowId,
                          )
                        }
                        className={
                          selectedRegistryRowId === row.rowId ? "selected" : ""
                        }
                      >
                        <td
                          className="jo-land-registry-ffrs-code"
                          title={row.farmer.ffrs_code || "—"}
                        >
                          <strong className="jo-land-registry-ffrs-value">
                            {row.farmer.ffrs_code || "—"}
                          </strong>
                        </td>
                        <td>{row.farmer.farmer_name || "—"}</td>
                        <td className="jo-land-registry-ownership-cell">
                          <div className="jo-land-registry-ownership-stack">
                            <span
                              className={`jo-land-registry-ownership-pill jo-land-registry-ownership-${row.primaryOwnership}`}
                            >
                              {row.primaryOwnership === "owner"
                                ? "Registered Owner"
                                : row.primaryOwnership === "tenant"
                                  ? "Tenant"
                                  : "Lessee"}
                            </span>
                            {row.ownershipSecondaryLabels.map((label) => (
                              <span
                                key={label}
                                className="jo-land-registry-ownership-pill jo-land-registry-ownership-secondary"
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>{row.primaryBarangay || "Multiple"}</td>
                        <td>{row.totalAreaHa.toFixed(2) || "0"}</td>
                        <td>{formatDate(row.farmer.last_updated)}</td>
                        <td
                          className="jo-land-registry-row-action-cell"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div
                            className="jo-land-registry-row-action-menu-wrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="jo-land-registry-row-action-trigger"
                              aria-label="Open row actions"
                              aria-haspopup="menu"
                              aria-expanded={openActionMenuRowId === row.rowId}
                              onClick={() => toggleRowActionMenu(row.rowId)}
                              title="Actions"
                            >
                              ...
                            </button>

                            {openActionMenuRowId === row.rowId && (
                              <div
                                className="jo-land-registry-row-action-menu"
                                role="menu"
                              >
                                <button
                                  type="button"
                                  className="jo-land-registry-row-action-menu-item"
                                  role="menuitem"
                                  onClick={() => handleRowActionView(row)}
                                >
                                  View
                                </button>
                                {row.capabilities.canTransferOwnership && (
                                  <button
                                    type="button"
                                    className="jo-land-registry-row-action-menu-item jo-land-registry-row-action-menu-item-owner"
                                    role="menuitem"
                                    title="Transfer legal ownership"
                                    onClick={() => handleRowActionTransfer(row)}
                                  >
                                    Transfer Ownership
                                  </button>
                                )}
                                {/* Update Tenant/Lessee Landowner actions hidden */}
                              </div>
                            )}
                          </div>
                        </td>
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
                      {selectedFarmerCapabilities?.canTransferOwnership && (
                        <button
                          className="jo-land-registry-transfer-button"
                          style={{ cursor: "pointer" }}
                          onClick={() => openTransferModal("owner")}
                        >
                          🔄 Transfer Ownership
                        </button>
                      )}
                      {selectedOwnerAffiliationQuickRoleOptions.length > 1 && (
                        <div className="jo-land-registry-replacement-action-row">
                          <select
                            className="jo-land-registry-transfer-select"
                            style={{ maxWidth: "260px" }}
                            value={
                              ownerAffiliationQuickRoleSelection ||
                              selectedOwnerAffiliationQuickRole ||
                              ""
                            }
                            onChange={(e) =>
                              setOwnerAffiliationQuickRoleSelection(
                                (e.target.value as ReplacementRole) || "",
                              )
                            }
                          >
                            <option value="tenant">Tenant Context</option>
                            <option value="lessee">Lessee Context</option>
                          </select>
                        </div>
                      )}
                      {/* Update Tenant/Lessee Landowner button hidden */}
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
                        {selectedContextRoleLabel}
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

                {/* Cultivation Status Section */}
                <div className="jo-land-registry-detail-section">
                  <h4>🌾 Parcel Cultivation Status</h4>
                  {cultivationLoading ? (
                    <p>Loading cultivation status...</p>
                  ) : cultivationParcels.length === 0 ? (
                    <p>No cultivation status recorded yet.</p>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                      }}
                    >
                      {cultivationParcels.map((parcel) => {
                        const statusLabel =
                          parcel.is_cultivating === true
                            ? "Actively farming"
                            : parcel.is_cultivating === false
                              ? "Not farming"
                              : "Not specified";
                        const detailLine =
                          parcel.is_cultivating === false
                            ? parcel.cultivator_name
                              ? `Cultivator: ${parcel.cultivator_name}`
                              : parcel.cultivation_status_reason || ""
                            : "";

                        return (
                          <div
                            key={parcel.id}
                            style={{
                              border: "1px solid #e5e7eb",
                              borderRadius: "8px",
                              padding: "10px 12px",
                              backgroundColor: "#fff",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: "12px",
                                flexWrap: "wrap",
                              }}
                            >
                              <strong>
                                {parcel.parcel_number
                                  ? `Parcel ${parcel.parcel_number}`
                                  : "Parcel"}
                              </strong>
                              <span style={{ color: "#374151" }}>
                                {statusLabel}
                              </span>
                            </div>
                            <div
                              style={{
                                marginTop: "6px",
                                fontSize: "12px",
                                color: "#6b7280",
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "10px",
                              }}
                            >
                              <span>
                                📍 {parcel.farm_location_barangay || "—"}
                              </span>
                              <span>
                                📐{" "}
                                {Number(parcel.total_farm_area_ha || 0).toFixed(
                                  2,
                                )}{" "}
                                ha
                              </span>
                              {parcel.cultivation_status_updated_at && (
                                <span>
                                  Updated:{" "}
                                  {formatDate(
                                    parcel.cultivation_status_updated_at,
                                  )}
                                </span>
                              )}
                            </div>
                            {detailLine && (
                              <div
                                style={{
                                  marginTop: "6px",
                                  fontSize: "12px",
                                  color: "#4b5563",
                                }}
                              >
                                {detailLine}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
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
                      // Sort by the same day users see in the UI (local date), then by ID.
                      // This avoids confusion from parcel-group ordering and keeps a single timeline flow.
                      const toDisplayDayTime = (
                        dateValue: string | null | undefined,
                      ) => {
                        if (!dateValue) return Number.POSITIVE_INFINITY;
                        const parsed = new Date(dateValue);
                        if (!Number.isFinite(parsed.getTime())) {
                          return Number.POSITIVE_INFINITY;
                        }
                        return new Date(
                          parsed.getFullYear(),
                          parsed.getMonth(),
                          parsed.getDate(),
                        ).getTime();
                      };

                      const sortedHistory = [...parcelHistory].sort((a, b) => {
                        const dateDiff =
                          toDisplayDayTime(b.period_start_date) -
                          toDisplayDayTime(a.period_start_date);
                        if (dateDiff !== 0) return dateDiff;
                        return b.id - a.id;
                      });

                      return (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "10px",
                          }}
                        >
                          {sortedHistory.map((record) => {
                            const normalizedChangeType = String(
                              record.change_type || "",
                            ).toUpperCase();
                            const isOwnerAffiliationChange =
                              normalizedChangeType ===
                              "OWNER_AFFILIATION_CHANGE";
                            const isPartial =
                              normalizedChangeType === "TRANSFER_PARTIAL";
                            const isTransfer = /TRANSFER/i.test(
                              normalizedChangeType,
                            );
                            const isProofLinkedChange =
                              isTransfer || isOwnerAffiliationChange;
                            const isRoleAssociation =
                              normalizedChangeType === "TENANT_CHANGE" ||
                              normalizedChangeType === "LESSEE_CHANGE" ||
                              normalizedChangeType === "ASSOCIATION_CHANGE";
                            const fromMatch =
                              isProofLinkedChange && record.notes
                                ? record.notes.match(/from farmer (\d+)/i)
                                : null;
                            const toMatch =
                              isProofLinkedChange && record.notes
                                ? record.notes.match(/to farmer (\d+)/i)
                                : null;
                            const fromFarmerIdFromNotes = fromMatch
                              ? Number(fromMatch[1])
                              : null;
                            const toFarmerIdFromNotes = toMatch
                              ? Number(toMatch[1])
                              : null;

                            const recipientName = (() => {
                              if (
                                toFarmerIdFromNotes &&
                                (!record.farmer_id ||
                                  toFarmerIdFromNotes !== record.farmer_id)
                              ) {
                                return (
                                  farmerNameMap.get(toFarmerIdFromNotes) ||
                                  record.farmer_name ||
                                  record.land_owner_name ||
                                  "Unknown"
                                );
                              }
                              return (
                                record.farmer_name ||
                                record.land_owner_name ||
                                "Unknown"
                              );
                            })();

                            // Resolve donor name from notes ("from farmer <id>")
                            let donorName: string | null = null;
                            if (fromFarmerIdFromNotes) {
                              donorName =
                                farmerNameMap.get(fromFarmerIdFromNotes) ??
                                null;
                            }
                            // Older donor-side rows often store "to farmer <id>" only.
                            // In that case, current row farmer_id is the donor.
                            if (
                              !donorName &&
                              toFarmerIdFromNotes &&
                              record.farmer_id &&
                              toFarmerIdFromNotes !== record.farmer_id
                            ) {
                              donorName =
                                farmerNameMap.get(record.farmer_id) ||
                                record.farmer_name ||
                                null;
                            }
                            // Fallback: extract donor from change_reason sentence
                            if (!donorName && record.change_reason) {
                              const crMatch = record.change_reason.match(
                                /^Ownership transfer from (.+?) to .+$/i,
                              );
                              if (crMatch) donorName = crMatch[1].trim();
                            }

                            // Clean transfer type label for the header
                            const cleanTitle = (() => {
                              if (isRoleAssociation) {
                                if (normalizedChangeType === "TENANT_CHANGE") {
                                  return "👤 Tenant Registration";
                                }
                                if (normalizedChangeType === "LESSEE_CHANGE") {
                                  return "👤 Lessee Registration";
                                }
                                return "👤 Tenant and Lessee Registration";
                              }
                              if (isOwnerAffiliationChange) {
                                if (record.is_tenant) {
                                  return "🔗 Tenant Landowner Update";
                                }
                                if (record.is_lessee) {
                                  return "🔗 Lessee Landowner Update";
                                }
                                return "🔗 Linked Landowner Update";
                              }
                              if (isPartial) return "✂️ Partial Transfer";
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
                            const recipientRole = record.is_registered_owner
                              ? "Registered Owner"
                              : record.is_tenant && record.is_lessee
                                ? "Tenant + Lessee"
                                : record.is_tenant
                                  ? "Tenant"
                                  : record.is_lessee
                                    ? "Lessee"
                                    : null;
                            const roleBadgeBg = record.is_registered_owner
                              ? "#dcfce7"
                              : record.is_tenant && record.is_lessee
                                ? "#e0e7ff"
                                : record.is_tenant
                                  ? "#dbeafe"
                                  : record.is_lessee
                                    ? "#ede9fe"
                                    : "#f3f4f6";
                            const roleBadgeColor = record.is_registered_owner
                              ? "#166534"
                              : record.is_tenant && record.is_lessee
                                ? "#4338ca"
                                : record.is_tenant
                                  ? "#1e40af"
                                  : record.is_lessee
                                    ? "#7c3aed"
                                    : "#6b7280";

                            // Resolve donor ID from notes for proof lookup
                            let donorIdForProof: number | null = null;
                            if (fromFarmerIdFromNotes) {
                              donorIdForProof = fromFarmerIdFromNotes;
                            } else if (
                              toFarmerIdFromNotes &&
                              record.farmer_id &&
                              toFarmerIdFromNotes !== record.farmer_id
                            ) {
                              donorIdForProof = record.farmer_id;
                            }
                            const recipientIdForProof =
                              toFarmerIdFromNotes &&
                              (!record.farmer_id ||
                                toFarmerIdFromNotes !== record.farmer_id)
                                ? toFarmerIdFromNotes
                                : (record.farmer_id ?? null);
                            // Lookup proofs: primary by pair, fallback by recipient only
                            const cardProofs: ProofItem[] | null = (() => {
                              if (donorIdForProof && recipientIdForProof) {
                                const byPair = transferProofMap.get(
                                  `${donorIdForProof}-${recipientIdForProof}`,
                                );
                                if (byPair && byPair.length > 0) return byPair;
                              }
                              if (recipientIdForProof) {
                                const byRecipient =
                                  transferProofByRecipient.get(
                                    String(recipientIdForProof),
                                  );
                                if (byRecipient && byRecipient.length > 0)
                                  return byRecipient;
                              }
                              return null;
                            })();

                            // Transfer method label
                            const methodLabel = isTransfer
                              ? isPartial
                                ? "Partial transfer — split of original parcel"
                                : "Full transfer"
                              : isOwnerAffiliationChange
                                ? "Owner affiliation update only (holder unchanged)"
                                : null;

                            return (
                              <div
                                key={record.id}
                                style={{
                                  background: record.is_current
                                    ? "#f0fdf4"
                                    : "#fafafa",
                                  border: `1px solid ${record.is_current ? "#bbf7d0" : "#e5e7eb"}`,
                                  borderRadius: "8px",
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
                                      📅 {formatDate(record.period_start_date)}
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
                                  {methodLabel && <div>{methodLabel}</div>}

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
                                      <span>📋 {record.parcel_number}</span>
                                    )}
                                    {record.farm_location_barangay && (
                                      <span>
                                        📍 {record.farm_location_barangay}
                                      </span>
                                    )}
                                    {record.transferred_area_ha != null && (
                                      <span>
                                        📐{" "}
                                        {record.transferred_area_ha.toFixed(2)}{" "}
                                        ha transferred
                                      </span>
                                    )}
                                  </div>

                                  {/* Who: donor → recipient */}
                                  {isRoleAssociation ? (
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
                                      <span
                                        style={{
                                          color: "#6b7280",
                                          fontSize: "12px",
                                          fontWeight: 500,
                                        }}
                                      >
                                        Newly registered; not transferred yet
                                      </span>
                                    </div>
                                  ) : (
                                    (donorName || recipientName) && (
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
                                        <span style={{ color: "#9ca3af" }}>
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
                                    )
                                  )}

                                  {/* Proof button */}
                                  {isProofLinkedChange &&
                                    cardProofs &&
                                    cardProofs.length > 0 && (
                                      <div style={{ marginTop: "6px" }}>
                                        <button
                                          onClick={() =>
                                            handleViewProof(cardProofs)
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
                                            border: "1px solid #bfdbfe",
                                            borderRadius: "6px",
                                            cursor: "pointer",
                                          }}
                                        >
                                          📷 View Proof ({cardProofs.length})
                                        </button>
                                      </div>
                                    )}
                                </div>
                              </div>
                            );
                          })}
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
                        <span>Selected Recipient</span>
                        <strong>{selectedFarmer.farmer_name}</strong>{" "}
                        {/* ← CHANGED */}
                      </div>
                      <div className="jo-land-registry-transfer-kv">
                        <span>Total Area</span>
                        <strong>
                          {selectedFarmer.total_farm_area_ha.toFixed(2)} ha
                        </strong>
                      </div>
                      {selectedFarmerViewRole !== "owner" && (
                        <div className="jo-land-registry-transfer-mini-note">
                          Selected {selectedContextRoleLabel.toLowerCase()} is
                          the recipient only. Donor must be a registered owner
                          with transferable parcels.
                        </div>
                      )}
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
                          Registered Owner Donor
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
                          <option value="">
                            Choose registered-owner donor...
                          </option>
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

                        {selectedRegisteredOwner &&
                          donorSplitParcels.length === 0 && (
                            <div className="jo-land-registry-transfer-mini-note">
                              No transferable registered-owner parcels were
                              found for this donor.
                            </div>
                          )}
                      </div>
                    )}

                    {transferMode === "inheritance" && (
                      <div className="jo-land-registry-transfer-section-card">
                        <h4>Step 2: Select Beneficiary Registered Owner</h4>

                        <label className="jo-land-registry-transfer-label">
                          Registered Owner Donor
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
                          <option value="">
                            Choose registered-owner donor...
                          </option>
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
                        <h4>Step 3: Proof</h4>
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
                        <h4>Step 4: Review</h4>
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
                            <span>Type</span>
                            <strong>
                              {transferMode === "inheritance"
                                ? "Inheritance"
                                : "Voluntary Transfer"}
                            </strong>
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

        {/* Update Tenant/Lessee Landowner Modal */}
        {showOwnerAffiliationModal && selectedFarmer && (
          <div
            className="jo-land-registry-modal-overlay"
            onClick={closeOwnerAffiliationModal}
          >
            <div
              className="jo-land-registry-modal jo-land-registry-replacement-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="jo-land-registry-modal-header jo-land-registry-replacement-header">
                <h3>Update {ownerAffiliationRoleLabel} Landowner</h3>
                <button
                  className="jo-land-registry-close-button"
                  onClick={closeOwnerAffiliationModal}
                >
                  ×
                </button>
              </div>

              <div className="jo-land-registry-modal-body">
                <div className="jo-land-registry-replacement-flow">
                  <div className="jo-land-registry-replacement-note">
                    <strong>Affiliation Update Only:</strong> This keeps the
                    same {ownerAffiliationRoleLabel.toLowerCase()} holder and
                    updates only the linked landowner on selected parcel(s).
                    Legal ownership is not transferred.
                  </div>

                  {ownerAffiliationSubmitError && (
                    <div
                      className="jo-land-registry-replacement-note"
                      style={{
                        borderColor: "#fecaca",
                        borderLeftColor: "#dc2626",
                        background: "#fef2f2",
                        color: "#991b1b",
                      }}
                    >
                      <strong>Update Error:</strong>{" "}
                      {ownerAffiliationSubmitError}
                    </div>
                  )}

                  {ownerAffiliationSubmitSuccess && (
                    <div className="jo-land-registry-replacement-preview-success">
                      <strong>Success:</strong> {ownerAffiliationSubmitSuccess}
                    </div>
                  )}

                  <div className="jo-land-registry-transfer-section-card">
                    <h4>Step 1: Current Context</h4>
                    <div className="jo-land-registry-transfer-kv">
                      <span>Holder</span>
                      <strong>{selectedFarmer.farmer_name || "—"}</strong>
                    </div>
                    <div className="jo-land-registry-transfer-kv">
                      <span>Role</span>
                      <strong>{ownerAffiliationRoleLabel}</strong>
                    </div>
                    <div className="jo-land-registry-transfer-kv">
                      <span>FFRS Code</span>
                      <strong>{selectedFarmer.ffrs_code || "—"}</strong>
                    </div>

                    {!ownerAffiliationLoading &&
                    ownerAffiliationHasSingleSourceContext ? (
                      <div className="jo-land-registry-transfer-kv">
                        <span>Current Linked Landowner</span>
                        <strong>
                          {selectedOwnerAffiliationSource?.ownerName || "—"}
                        </strong>
                      </div>
                    ) : (
                      <>
                        <label className="jo-land-registry-transfer-label">
                          Current Linked Landowner
                        </label>
                        <select
                          className="jo-land-registry-transfer-select"
                          value={ownerAffiliationSourceOwnerId}
                          disabled={
                            ownerAffiliationLoading ||
                            isSubmittingOwnerAffiliation
                          }
                          onChange={(e) =>
                            handleOwnerAffiliationSourceOwnerChange(
                              e.target.value,
                            )
                          }
                        >
                          <option value="">Choose linked landowner...</option>
                          {ownerAffiliationSourceOptions.map((option) => {
                            const optionOwnerId =
                              typeof option.ownerId === "number" &&
                              option.ownerId > 0
                                ? option.ownerId
                                : null;
                            if (!optionOwnerId) return null;
                            return (
                              <option key={optionOwnerId} value={optionOwnerId}>
                                {option.ownerName} ({option.parcelCount} parcel
                                {option.parcelCount === 1 ? "" : "s"})
                              </option>
                            );
                          })}
                        </select>
                      </>
                    )}

                    {ownerAffiliationLoading && (
                      <div className="jo-land-registry-transfer-mini-note">
                        Loading active {ownerAffiliationRoleLabel.toLowerCase()}{" "}
                        parcel links...
                      </div>
                    )}

                    {!ownerAffiliationLoading &&
                      ownerAffiliationHasSingleSourceContext && (
                        <div className="jo-land-registry-transfer-mini-note">
                          Auto-selected current linked landowner based on the
                          active {ownerAffiliationRoleLabel.toLowerCase()}{" "}
                          parcel context.
                        </div>
                      )}

                    {!ownerAffiliationLoading &&
                      selectedOwnerAffiliationSource && (
                        <>
                          <div className="jo-land-registry-transfer-mini-note">
                            Linked owner:{" "}
                            {selectedOwnerAffiliationSource.ownerName}
                          </div>
                          <div className="jo-land-registry-transfer-mini-note">
                            Current holder links:{" "}
                            {selectedOwnerAffiliationSource.parcelCount} parcel
                            {selectedOwnerAffiliationSource.parcelCount === 1
                              ? ""
                              : "s"}{" "}
                            • Total area{" "}
                            {selectedOwnerAffiliationAreaHa.toFixed(2)} ha
                          </div>
                          <div className="jo-land-registry-transfer-mini-note">
                            Selectable in Step 2:{" "}
                            {ownerAffiliationStep3Parcels.length} parcel
                            {ownerAffiliationStep3Parcels.length === 1
                              ? ""
                              : "s"}{" "}
                            • Total area{" "}
                            {ownerAffiliationSelectableAreaHa.toFixed(2)} ha
                          </div>
                        </>
                      )}
                  </div>

                  <div className="jo-land-registry-transfer-section-card">
                    <h4>Step 2: Select New Linked Landowner</h4>
                    <label className="jo-land-registry-transfer-label">
                      New Linked Landowner
                    </label>
                    <select
                      className="jo-land-registry-transfer-select"
                      value={ownerAffiliationNewOwnerId}
                      disabled={
                        ownerAffiliationLoading || isSubmittingOwnerAffiliation
                      }
                      onChange={(e) =>
                        handleOwnerAffiliationNewOwnerChange(e.target.value)
                      }
                    >
                      <option value="">Choose new linked landowner...</option>
                      {ownerAffiliationOwnerOptions.map((owner) => (
                        <option key={owner.ownerId} value={owner.ownerId}>
                          {owner.ownerName} ({owner.parcelCount} owner parcel
                          {owner.parcelCount === 1 ? "" : "s"})
                        </option>
                      ))}
                    </select>
                    <div className="jo-land-registry-transfer-mini-note">
                      The parcels listed below are the <strong>holder's</strong>{" "}
                      parcels currently linked to the selected landowner above
                      (Step 1). After selecting a new owner, Step 2 can also
                      include that owner's available owner parcels so they can
                      be assigned to this holder under the same role.
                    </div>

                    {ownerAffiliationNewOwnerId === "" ? (
                      <div className="jo-land-registry-transfer-mini-note">
                        Choose the new linked landowner first to continue parcel
                        selection.
                      </div>
                    ) : ownerAffiliationStep3Parcels.length > 0 ? (
                      <>
                        <div className="jo-land-registry-transfer-subheading">
                          Parcel(s) To Update
                        </div>

                        <div className="jo-land-registry-transfer-mini-note">
                          Select one or more parcels. Current holder-linked
                          parcels are eligible for re-link; new owner available
                          parcels are eligible for full assignment.
                        </div>
                        <div className="jo-land-registry-replacement-action-row">
                          <button
                            type="button"
                            className="jo-land-registry-replacement-button"
                            disabled={ownerAffiliationStep3Parcels.length === 0}
                            onClick={handleOwnerAffiliationSelectAllParcels}
                          >
                            Select All Parcels
                          </button>
                          <button
                            type="button"
                            className="jo-land-registry-replacement-button"
                            disabled={
                              ownerAffiliationSelectedParcelIds.length === 0
                            }
                            onClick={handleOwnerAffiliationClearSelectedParcels}
                          >
                            Clear Selection
                          </button>
                        </div>
                        <div className="jo-land-registry-transfer-mini-note">
                          Multi-select enabled: choose one or more parcels and
                          submit them together under the same new linked
                          landowner.
                        </div>
                        <div className="jo-land-registry-donor-parcel-cards">
                          {ownerAffiliationStep3Parcels.map((parcel) => {
                            const isChecked =
                              ownerAffiliationSelectedParcelIds.includes(
                                parcel.farmParcelId,
                              );
                            return (
                              <div
                                key={`owner-affiliation-parcel-${parcel.farmParcelId}`}
                                className="jo-land-registry-donor-parcel-card"
                              >
                                <div className="jo-land-registry-donor-parcel-card-header">
                                  <label
                                    className="jo-land-registry-transfer-checkbox-row"
                                    style={{
                                      marginBottom: 0,
                                      alignItems: "center",
                                      flex: 1,
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) =>
                                        handleOwnerAffiliationParcelToggle(
                                          parcel.farmParcelId,
                                          e.target.checked,
                                        )
                                      }
                                    />
                                    <span className="jo-land-registry-donor-parcel-number">
                                      {parcel.parcelNumber ||
                                        `Parcel ID #${parcel.farmParcelId}`}
                                    </span>
                                  </label>
                                  <span className="jo-land-registry-donor-parcel-area-badge">
                                    {parcel.areaHa.toFixed(2)} ha
                                  </span>
                                </div>

                                <div className="jo-land-registry-donor-parcel-card-body">
                                  <div className="jo-land-registry-transfer-mini-note">
                                    {parcel.inCurrentContract
                                      ? "Current holder linked parcel"
                                      : "New owner available parcel"}
                                  </div>
                                  <div className="jo-land-registry-donor-parcel-detail">
                                    <span className="jo-land-registry-donor-parcel-detail-label">
                                      Location
                                    </span>
                                    <span className="jo-land-registry-donor-parcel-detail-value">
                                      {parcel.barangay || "No barangay"}
                                      {parcel.municipality
                                        ? `, ${parcel.municipality}`
                                        : ""}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="jo-land-registry-transfer-mini-note">
                          Selected parcel count:{" "}
                          {ownerAffiliationSelectedParcelIds.length}
                        </div>

                        <div className="jo-land-registry-transfer-subheading">
                          Scope (Full or Partial)
                        </div>

                        {ownerAffiliationSelectedParcelIds.length === 0 ? (
                          <div className="jo-land-registry-transfer-mini-note">
                            Select at least one parcel first.
                          </div>
                        ) : (
                          <>
                            <div className="jo-land-registry-transfer-scope-radios">
                              <label className="jo-land-registry-transfer-radio-label">
                                <input
                                  type="radio"
                                  name="ownerAffiliationTakeoverMode"
                                  checked={
                                    ownerAffiliationTakeoverMode ===
                                    "full_parcel"
                                  }
                                  onChange={() =>
                                    handleOwnerAffiliationTakeoverModeChange(
                                      "full_parcel",
                                    )
                                  }
                                />
                                <span>
                                  <strong>Full parcel(s)</strong>
                                  <br />
                                  Update linked landowner for full selected
                                  parcel area.
                                </span>
                              </label>

                              <label className="jo-land-registry-transfer-radio-label">
                                <input
                                  type="radio"
                                  name="ownerAffiliationTakeoverMode"
                                  checked={
                                    ownerAffiliationTakeoverMode ===
                                    "specific_slot"
                                  }
                                  onChange={() =>
                                    handleOwnerAffiliationTakeoverModeChange(
                                      "specific_slot",
                                    )
                                  }
                                />
                                <span>
                                  <strong>Specific slot per parcel</strong>
                                  <br />
                                  Enter a specific area for each selected
                                  parcel.
                                </span>
                              </label>
                            </div>

                            {ownerAffiliationTakeoverMode ===
                              "specific_slot" && (
                              <div className="jo-land-registry-transfer-parcel-box">
                                <div className="jo-land-registry-transfer-subheading">
                                  Specific Slot Area Input
                                </div>
                                <div className="jo-land-registry-transfer-mini-note">
                                  Enter the area share (ha) for each selected
                                  parcel.
                                </div>
                                <div className="jo-land-registry-transfer-mini-note">
                                  Note: new owner available parcels can only use
                                  Full parcel(s).
                                </div>

                                <div className="jo-land-registry-donor-parcel-cards">
                                  {ownerAffiliationStep3Parcels
                                    .filter((parcel) =>
                                      ownerAffiliationSelectedParcelIds.includes(
                                        parcel.farmParcelId,
                                      ),
                                    )
                                    .map((parcel) => {
                                      const specificInput =
                                        ownerAffiliationSpecificLotInputs[
                                          parcel.farmParcelId
                                        ] || {
                                          customAreaHa: "",
                                        };

                                      return (
                                        <div
                                          key={`owner-affiliation-specific-${parcel.farmParcelId}`}
                                          className="jo-land-registry-donor-parcel-card"
                                        >
                                          <div className="jo-land-registry-donor-parcel-card-header">
                                            <span className="jo-land-registry-donor-parcel-number">
                                              {parcel.parcelNumber ||
                                                `Parcel ID #${parcel.farmParcelId}`}
                                            </span>
                                            <span className="jo-land-registry-donor-parcel-area-badge">
                                              {parcel.areaHa.toFixed(2)} ha
                                            </span>
                                          </div>

                                          <div className="jo-land-registry-donor-parcel-card-body">
                                            <div
                                              style={{
                                                marginTop: "10px",
                                                display: "grid",
                                                gap: "8px",
                                              }}
                                            >
                                              <label className="jo-land-registry-transfer-label">
                                                Specific Area (ha)
                                              </label>
                                              <input
                                                type="number"
                                                min="0.01"
                                                step="0.01"
                                                max={parcel.areaHa.toFixed(2)}
                                                className="jo-land-registry-transfer-input"
                                                placeholder={`Max ${parcel.areaHa.toFixed(2)} ha`}
                                                value={
                                                  specificInput.customAreaHa
                                                }
                                                onChange={(e) =>
                                                  handleOwnerAffiliationSpecificAreaChange(
                                                    parcel.farmParcelId,
                                                    e.target.value,
                                                  )
                                                }
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                </div>
                              </div>
                            )}

                            {ownerAffiliationTakeoverPlan.error && (
                              <div className="jo-land-registry-transfer-mini-note">
                                {ownerAffiliationTakeoverPlan.error}
                              </div>
                            )}

                            <div className="jo-land-registry-transfer-mini-note">
                              Ready scoped parcel count:{" "}
                              {ownerAffiliationTakeoverPlan.selectedParcelCount}{" "}
                              • Total scoped area:{" "}
                              {ownerAffiliationTakeoverPlan.totalAreaHa.toFixed(
                                2,
                              )}{" "}
                              ha
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="jo-land-registry-transfer-mini-note">
                        No eligible parcels found for this context. Select a
                        different source/new owner or verify parcel role-link
                        data.
                      </div>
                    )}
                  </div>

                  <div className="jo-land-registry-transfer-section-card">
                    <h4>Step 3: Proof</h4>
                    <label className="jo-land-registry-transfer-label">
                      Upload proof file(s) - PNG/JPG/PDF/DOC/DOCX (multiple)
                    </label>
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.pdf,.doc,.docx,image/png,image/jpeg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      multiple
                      onChange={handleOwnerAffiliationDocsSelected}
                      className="jo-land-registry-transfer-file-input"
                      disabled={
                        isSubmittingOwnerAffiliation ||
                        !ownerAffiliationReadyForProofUpload
                      }
                    />

                    {!ownerAffiliationReadyForProofUpload && (
                      <div className="jo-land-registry-transfer-mini-note">
                        Select current linked owner, new linked owner, and at
                        least one scoped parcel before uploading proof
                        documents.
                      </div>
                    )}

                    {ownerAffiliationSupportingDocs.length > 0 && (
                      <ul className="jo-land-registry-transfer-doc-list">
                        {ownerAffiliationSupportingDocs.map((doc, index) => (
                          <li key={`${doc.name}-${doc.lastModified}-${index}`}>
                            <span>
                              {doc.name} ({(doc.size / 1024).toFixed(1)} KB)
                            </span>
                            <button
                              type="button"
                              onClick={() => removeOwnerAffiliationDoc(index)}
                              disabled={isSubmittingOwnerAffiliation}
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="jo-land-registry-transfer-section-card">
                    <h4>Step 4: Review</h4>

                    <label className="jo-land-registry-transfer-label">
                      Internal Note (Optional)
                    </label>
                    <textarea
                      className="jo-land-registry-transfer-textarea"
                      placeholder="Add optional context for staff records..."
                      value={ownerAffiliationReason}
                      disabled={isSubmittingOwnerAffiliation}
                      onChange={(e) => {
                        setOwnerAffiliationReason(e.target.value);
                        setOwnerAffiliationSubmitError("");
                        setOwnerAffiliationSubmitSuccess("");
                      }}
                    />

                    <div className="jo-land-registry-transfer-review-block">
                      <div className="jo-land-registry-transfer-review-block-title">
                        Preview
                      </div>
                      <div className="jo-land-registry-transfer-flow-row">
                        <div className="jo-land-registry-transfer-party">
                          <span className="jo-land-registry-transfer-party-label">
                            CURRENT OWNER
                          </span>
                          <strong className="jo-land-registry-transfer-party-name">
                            {selectedOwnerAffiliationSource?.ownerName ||
                              "Not selected"}
                          </strong>
                        </div>
                        <div className="jo-land-registry-transfer-arrow">→</div>
                        <div className="jo-land-registry-transfer-party">
                          <span className="jo-land-registry-transfer-party-label">
                            NEW OWNER
                          </span>
                          <strong className="jo-land-registry-transfer-party-name">
                            {selectedOwnerAffiliationNewOwner?.ownerName ||
                              "Not selected"}
                          </strong>
                        </div>
                      </div>

                      <div className="jo-land-registry-transfer-kv">
                        <span>Holder (unchanged)</span>
                        <strong>{selectedFarmer.farmer_name || "—"}</strong>
                      </div>
                      <div className="jo-land-registry-transfer-kv">
                        <span>Role</span>
                        <strong>{ownerAffiliationRoleLabel}</strong>
                      </div>
                      <div className="jo-land-registry-transfer-kv">
                        <span>Scope</span>
                        <strong>{ownerAffiliationTakeoverModeLabel}</strong>
                      </div>

                      <ul className="jo-land-registry-transfer-list">
                        {ownerAffiliationPreviewParcels.map((parcel) => (
                          <li
                            key={`owner-affiliation-preview-${parcel.farmParcelId}`}
                          >
                            <span className="jo-land-registry-transfer-list-parcel">
                              {parcel.parcelNumber ||
                                `Parcel ID #${parcel.farmParcelId}`}
                            </span>
                            <span className="jo-land-registry-transfer-list-brgy">
                              {parcel.barangay || "No barangay"}
                              {parcel.municipality
                                ? `, ${parcel.municipality}`
                                : ""}
                            </span>
                            <span className="jo-land-registry-transfer-list-area">
                              {parcel.selectedAreaHa.toFixed(2)} ha
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="jo-land-registry-transfer-actions">
                    <button
                      type="button"
                      className="jo-land-registry-transfer-cancel"
                      onClick={closeOwnerAffiliationModal}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="jo-land-registry-transfer-confirm"
                      onClick={handleOwnerAffiliationConfirm}
                      disabled={
                        ownerAffiliationLoading ||
                        isSubmittingOwnerAffiliation ||
                        ownerAffiliationNewOwnerId === "" ||
                        ownerAffiliationTakeoverPlan.items.length === 0 ||
                        ownerAffiliationTakeoverPlan.error !== "" ||
                        ownerAffiliationSupportingDocs.length === 0
                      }
                    >
                      {isSubmittingOwnerAffiliation
                        ? "Submitting..."
                        : `Confirm ${ownerAffiliationRoleLabel} Landowner Update`}
                    </button>
                  </div>

                  <div className="jo-land-registry-transfer-mini-note">
                    This action updates owner affiliation only. The current{" "}
                    {ownerAffiliationRoleLabel.toLowerCase()} holder remains
                    unchanged.
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
