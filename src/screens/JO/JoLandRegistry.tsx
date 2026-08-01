import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "../../supabase";
import { ParcelSplitInput } from "../../components/LandRegistry/usePartialTransfer";
import { PartialParcelTransferSection } from "../../components/LandRegistry/PartialParcelTransferSection";
import "../../assets/css/jo css/JoLandRegistryStyle.css";
import JOSidebar from "../../components/layout/JOSidebar";
import {
  getAuditLogger,
  AuditModule,
} from "../../components/Audit/auditLogger";
import { getCurrentUserForAudit } from "../../components/Audit/getCurrentUserForAudit";

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
  is_cultivating?: boolean | null;
  cultivation_status_reason?: string | null;
  cultivation_status_updated_at?: string | null;
  is_farming?: boolean | null;
  farming_status_reason?: string | null;
  farming_status_updated_at?: string | null;
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
    land_owner_name?: string | null;
    tenant_land_owner_name?: string | null;
    lessee_land_owner_name?: string | null;
  }>;
  total_farm_area_ha: number;
  last_updated: string;
  has_registered_owner: boolean;
  has_tenant: boolean;
  has_lessee: boolean;
  archived_at?: string | null;
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
  canFarmAnotherLand: boolean;
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
  landOwnerName: string;
}

const TRANSFER_PROOF_BUCKET = "ownership-transfer-proofs";

interface SearchableSelectOption {
  value: string | number;
  label: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string | number;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder,
  disabled,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => String(o.value) === String(value));

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
    }
  }, [isOpen]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const filteredOptions = options.filter((o) =>
    o.label.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%" }}
    >
      <div style={{ position: "relative" }}>
        <input
          type="text"
          className="jo-land-registry-transfer-select"
          style={{
            cursor: disabled ? "not-allowed" : "pointer",
            background: disabled ? "#f1f5f9" : "#fff",
            paddingRight: "30px",
          }}
          placeholder={placeholder}
          value={isOpen ? searchTerm : selectedOption ? selectedOption.label : ""}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (!disabled) {
              setIsOpen(true);
              setSearchTerm("");
            }
          }}
          disabled={disabled}
        />
        <span
          style={{
            position: "absolute",
            right: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
            color: "#64748b",
            fontSize: "12px",
          }}
        >
          ▼
        </span>
      </div>

      {isOpen && !disabled && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "4px",
            background: "#fff",
            border: "1px solid #cbd5e1",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
            maxHeight: "220px",
            overflowY: "auto",
            zIndex: 9999,
          }}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => {
              const isSelected = String(option.value) === String(value);
              return (
                <div
                  key={option.value}
                  onClick={() => {
                    onChange(String(option.value));
                    setIsOpen(false);
                  }}
                  style={{
                    padding: "10px 12px",
                    cursor: "pointer",
                    background: isSelected ? "#e2e8f0" : "#fff",
                    color: "#0f172a",
                    fontSize: "14px",
                    borderBottom: "1px solid #f1f5f9",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "#f8fafc";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "#fff";
                    }
                  }}
                >
                  {option.label}
                </div>
              );
            })
          ) : (
            <div
              style={{
                padding: "10px 12px",
                color: "#64748b",
                fontSize: "14px",
                textAlign: "center",
              }}
            >
              No matching farmers found
            </div>
          )}
        </div>
      )}
    </div>
  );
};
const normalizeParcelNumber = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const stripPrefix = (input: string) =>
    input.replace(/^parcel\s*(no\.?|#|-)?\s*/i, "");
  const once = stripPrefix(trimmed).trim();
  const twice = stripPrefix(once).trim();
  return twice;
};
const normalizeParcelNumberKey = (value: string): string =>
  normalizeParcelNumber(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const normalizeCurrentOwnershipGroups = (
  groups: FarmerGroup[],
): FarmerGroup[] => {
  const toPositiveArea = (value: unknown): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };

  return (groups || []).map((group) => {
    const sourceParcels = Array.isArray(group.parcels) ? group.parcels : [];
    const hasExplicitCurrentOwnerFlag = sourceParcels.some(
      (parcel) =>
        parcel?.is_current_owner === true || parcel?.is_current_owner === false,
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

    const hasActiveParcels = currentOwnerParcels.length > 0;

    const has_registered_owner = hasActiveParcels
      ? parcelsToUse.some((parcel) => parcel?.is_registered_owner === true)
      : (hasExplicitOwnerRoleFlag
          ? parcelsToUse.some((parcel) => parcel?.is_registered_owner === true)
          : false) || group.has_registered_owner;

    const has_tenant = hasActiveParcels
      ? parcelsToUse.some((parcel) => parcel?.is_tenant === true)
      : (hasExplicitTenantRoleFlag
          ? parcelsToUse.some((parcel) => parcel?.is_tenant === true)
          : false) || group.has_tenant;

    const has_lessee = hasActiveParcels
      ? parcelsToUse.some((parcel) => parcel?.is_lessee === true)
      : (hasExplicitLesseeRoleFlag
          ? parcelsToUse.some((parcel) => parcel?.is_lessee === true)
          : false) || group.has_lessee;

    return {
      ...group,
      parcels: parcelsToUse,
      total_farm_area_ha:
        computedTotalArea > 0 ? computedTotalArea : group.total_farm_area_ha,
      has_registered_owner,
      has_tenant,
      has_lessee,
    };
  });
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
  const [landStatusFilter, setLandStatusFilter] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);

  // Tab toggle and Unused parcels state
  const [activeViewTab, setActiveViewTab] = useState<"farmers" | "unused">("farmers");
  const [unusedParcels, setUnusedParcels] = useState<any[]>([]);
  const [loadingUnused, setLoadingUnused] = useState(false);
  const [openUnusedActionMenuId, setOpenUnusedActionMenuId] = useState<number | null>(null);

  // Retire/Stop Farming modal states
  const [showDeleteParcelModal, setShowDeleteParcelModal] = useState(false);
  const [selectedDeleteParcel, setSelectedDeleteParcel] = useState<CultivationParcel | null>(null);
  const [deleteParcelReason, setDeleteParcelReason] = useState("");
  const [isDeletingParcel, setIsDeletingParcel] = useState(false);
  const [deleteParcelError, setDeleteParcelError] = useState("");

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
  const [transferToast, setTransferToast] = useState<{ message: string; transferId?: string | number } | null>(null);
  const [stopFarmingToast, setStopFarmingToast] = useState<{ message: string; parcelNumber?: string } | null>(null);
  const [ownerAffiliationToast, setOwnerAffiliationToast] = useState<{ message: string; isFarmAnother?: boolean } | null>(null);
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
  const [isFarmAnotherMode, setIsFarmAnotherMode] = useState(false);
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
  const [ownerAffiliationContextNote, setOwnerAffiliationContextNote] =
    useState("");
  const [ownerAffiliationParcelCultivators, setOwnerAffiliationParcelCultivators] = useState<
    Record<number, string | null>
  >({});

  const ownerAffiliationHasSingleSourceContext =
    ownerAffiliationSourceOptions.length === 1;
  const ownerAffiliationHasExistingLink =
    !isFarmAnotherMode && ownerAffiliationSourceOptions.length > 0;

  const activeOwnerAffiliationNewOwnerId = (() => {
    const candidate =
      ownerAffiliationNewOwnerId === ""
        ? null
        : Number(ownerAffiliationNewOwnerId);
    return Number.isFinite(candidate) && (candidate || 0) > 0
      ? Number(candidate)
      : null;
  })();

  const [selectedTransferParcelIds, setSelectedTransferParcelIds] = useState<
    number[]
  >([]);

  const handleToggleTransferParcel = useCallback((farmParcelId: number) => {
    setSelectedTransferParcelIds((prev) =>
      prev.includes(farmParcelId)
        ? prev.filter((id) => id !== farmParcelId)
        : [...prev, farmParcelId],
    );
  }, []);

  // Parcel scope is always "full" now — the Full/Partial parcel choice
  // has been removed. Users simply pick which whole parcel(s) to transfer.

  useEffect(() => {
    setSelectedTransferParcelIds([]);
  }, [selectedFarmer?.farmer_id, transferMode]);

  useEffect(() => {
    if (!transferToast) return;
    const timer = setTimeout(() => setTransferToast(null), 5000);
    return () => clearTimeout(timer);
  }, [transferToast]);

  useEffect(() => {
    if (!stopFarmingToast) return;
    const timer = setTimeout(() => setStopFarmingToast(null), 5000);
    return () => clearTimeout(timer);
  }, [stopFarmingToast]);

  useEffect(() => {
    if (!ownerAffiliationToast) return;
    const timer = setTimeout(() => setOwnerAffiliationToast(null), 5000);
    return () => clearTimeout(timer);
  }, [ownerAffiliationToast]);

  useEffect(() => {
    const fetchCultivators = async () => {
      const ownerId = Number(activeOwnerAffiliationNewOwnerId);
      if (!Number.isFinite(ownerId) || ownerId <= 0) {
        setOwnerAffiliationParcelCultivators({});
        return;
      }

      try {
        // Step 1: Fetch the owner's registered parcel rows
        const { data: parcelsData, error: parcelsError } = await supabase
          .from("rsbsa_farm_parcels")
          .select("id, parcel_number, cultivator_submission_id")
          .eq("submission_id", ownerId)
          .eq("ownership_type_registered_owner", true)
          .or("is_current_owner.is.null,is_current_owner.eq.true");

        if (parcelsError || !parcelsData || parcelsData.length === 0) {
          setOwnerAffiliationParcelCultivators({});
          return;
        }

        // Step 2: Also find tenant/lessee rows that are farming THIS owner's land
        // (They have a separate row with tenant_land_owner_id = ownerId)
        const parcelNumbers = parcelsData
          .map((p: any) => p.parcel_number)
          .filter(Boolean);

        const tenantRowsByParcelNumber: Record<string, number> = {};
        if (parcelNumbers.length > 0) {
          const { data: tenantRows } = await supabase
            .from("rsbsa_farm_parcels")
            .select("submission_id, parcel_number, ownership_type_tenant, ownership_type_lessee")
            .or(`tenant_land_owner_id.eq.${ownerId},lessee_land_owner_id.eq.${ownerId}`)
            .eq("is_current_owner", true)
            .neq("is_farming", false)
            .in("parcel_number", parcelNumbers);

          if (tenantRows) {
            tenantRows.forEach((row: any) => {
              const pNum = (row.parcel_number || "").trim().toUpperCase();
              if (pNum && row.submission_id) {
                tenantRowsByParcelNumber[pNum] = row.submission_id;
              }
            });
          }
        }

        // Step 3: Collect all farmer IDs to resolve names for
        const allFarmerIds = Array.from(
          new Set([
            ...parcelsData
              .map((p: any) => p.cultivator_submission_id)
              .filter((id: any): id is number => typeof id === "number" && id > 0),
            ...Object.values(tenantRowsByParcelNumber),
          ]),
        );

        const nameMap: Record<number, string> = {};
        if (allFarmerIds.length > 0) {
          const { data: subsData } = await supabase
            .from("rsbsa_submission")
            .select(`id, "FIRST NAME", "MIDDLE NAME", "LAST NAME", "EXT NAME"`)
            .in("id", allFarmerIds);

          if (subsData) {
            subsData.forEach((row: any) => {
              const fullName = [
                row["FIRST NAME"],
                row["MIDDLE NAME"],
                row["LAST NAME"],
                row["EXT NAME"],
              ]
                .filter(Boolean)
                .join(" ")
                .trim();
              if (fullName) nameMap[row.id] = fullName;
            });
          }
        }

        // Step 4: Build the final map: parcel ID → cultivator name (or null = owner farmed)
        const map: Record<number, string | null> = {};
        parcelsData.forEach((p: any) => {
          const pNum = (p.parcel_number || "").trim().toUpperCase();

          // Priority 1: explicit cultivator_submission_id on owner's parcel
          if (p.cultivator_submission_id) {
            map[p.id] =
              nameMap[p.cultivator_submission_id] ||
              `Farmer #${p.cultivator_submission_id}`;
            return;
          }

          // Priority 2: matched tenant/lessee row by parcel_number
          const tenantId = tenantRowsByParcelNumber[pNum];
          if (tenantId) {
            map[p.id] = nameMap[tenantId] || `Farmer #${tenantId}`;
            return;
          }

          // No cultivator — land is owner-farmed or unassigned
          map[p.id] = null;
        });

        setOwnerAffiliationParcelCultivators(map);
      } catch (err) {
        console.error("Error fetching owner parcel cultivators:", err);
        setOwnerAffiliationParcelCultivators({});
      }
    };

    fetchCultivators();
  }, [activeOwnerAffiliationNewOwnerId]);


  const refreshLandParcels = useCallback(async () => {
    setLoading(true);
    console.log("[FETCH START] Starting refresh...");

    try {
      const [unifiedResult, submissionResult] = await Promise.all([
        supabase
          .from("farmer_aggregated_unified")
          .select("*")
          .order("farmer_name", { ascending: true }),
        supabase.from("rsbsa_submission").select(`
            id,
            "FIRST NAME",
            "MIDDLE NAME",
            "LAST NAME",
            "EXT NAME",
            "FFRS_CODE",
            "OWNERSHIP_TYPE_REGISTERED_OWNER",
            "OWNERSHIP_TYPE_TENANT",
            "OWNERSHIP_TYPE_LESSEE",
            status,
            archived_at,
            updated_at
          `),
      ]);

      if (unifiedResult.error) {
        console.error("[FETCH ERROR]", unifiedResult.error);
        return;
      }

      const unifiedData = unifiedResult.data || [];
      const submissions = submissionResult.data || [];

      // Filter submissions to only those that represent active landowners, tenants, lessees, or farmers who have transferred all their land
      const registeredSubmissions = submissions.filter(
        (sub: any) =>
          sub.status !== "inactive",
      );

      // Create a set of farmer IDs that already have active parcels in unifiedData
      const unifiedFarmerIds = new Set(
        unifiedData.map((group: any) => group.farmer_id),
      );

      // Build group objects for those who don't have land anymore
      const noLandGroups: FarmerGroup[] = registeredSubmissions
        .filter((sub: any) => !unifiedFarmerIds.has(Number(sub.id)))
        .map((sub: any) => {
          const first = sub["FIRST NAME"] || "";
          const middle = sub["MIDDLE NAME"] || "";
          const last = sub["LAST NAME"] || "";
          const ext = sub["EXT NAME"] || "";
          const fullName =
            [first, middle, last, ext].filter(Boolean).join(" ").trim() ||
            `Farmer #${sub.id}`;

          return {
            farmer_id: Number(sub.id),
            farmer_name: fullName,
            ffrs_code: sub.FFRS_CODE || "",
            parcels: [],
            total_farm_area_ha: 0,
            last_updated: sub.updated_at || new Date().toISOString(),
            has_registered_owner: sub.OWNERSHIP_TYPE_REGISTERED_OWNER || false,
            has_tenant: sub.OWNERSHIP_TYPE_TENANT || false,
            has_lessee: sub.OWNERSHIP_TYPE_LESSEE || false,
            archived_at: sub.archived_at || null,
          };
        });

      // Filter combined list to non-inactive farmers
      const activeFarmerIds = new Set(
        submissions
          .filter((sub: any) => sub.status !== "inactive")
          .map((sub: any) => Number(sub.id)),
      );

      const combinedData = [...unifiedData, ...noLandGroups].filter((group) =>
        activeFarmerIds.has(Number(group.farmer_id)),
      );

      // Sort combined data by farmer_name
      combinedData.sort((a, b) => a.farmer_name.localeCompare(b.farmer_name));

      console.log("[FETCH SUCCESS] Combined data received:", combinedData);
      const normalizedData = normalizeCurrentOwnershipGroups(combinedData);
      setAggregatedFarmers(normalizedData);
      console.log(
        "[STATE SET] Set aggregatedFarmers to length:",
        normalizedData.length || 0,
      );
    } finally {
      setLoading(false);
      console.log("[FETCH END] Loading set to false");
    }
  }, []);

  const fetchUnusedParcels = useCallback(async () => {
    setLoadingUnused(true);
    try {
      const { data: parcelsData, error: parcelsError } = await supabase
        .from("rsbsa_farm_parcels")
        .select("id, submission_id, parcel_number, farm_location_barangay, total_farm_area_ha, is_farming, farming_status_reason, farming_status_updated_at")
        .eq("is_farming", false)
        .or("is_current_owner.is.null,is_current_owner.eq.true");

      if (parcelsError) throw parcelsError;

      const farmerIds = Array.from(
        new Set((parcelsData || []).map((p: any) => p.submission_id).filter(Boolean))
      );

      const nameMap: Record<number, string> = {};
      if (farmerIds.length > 0) {
        const { data: subs } = await supabase
          .from("rsbsa_submission")
          .select(`id, "FIRST NAME", "MIDDLE NAME", "LAST NAME", "EXT NAME"`)
          .in("id", farmerIds);

        if (subs) {
          subs.forEach((row: any) => {
            const fullName = [
              row["FIRST NAME"],
              row["MIDDLE NAME"],
              row["LAST NAME"],
              row["EXT NAME"],
            ]
              .filter(Boolean)
              .join(" ")
              .trim();
            nameMap[row.id] = fullName;
          });
        }
      }

      const enriched = (parcelsData || []).map((p: any) => ({
        ...p,
        landowner_name: nameMap[p.submission_id] || `Farmer #${p.submission_id}`,
      }));

      setUnusedParcels(enriched);
    } catch (err) {
      console.error("Error fetching unused parcels:", err);
    } finally {
      setLoadingUnused(false);
    }
  }, []);

  const handleDeleteParcelSubmit = async () => {
    if (!selectedDeleteParcel) return;
    setIsDeletingParcel(true);
    setDeleteParcelError("");

    try {
      const parcelId = selectedDeleteParcel.id;
      const farmerId = selectedFarmer?.farmer_id || selectedDeleteParcel.submission_id;

      const { error: parcelErr } = await supabase
        .from("rsbsa_farm_parcels")
        .update({
          is_farming: false,
          is_current_owner: false,
          farming_status_reason: deleteParcelReason || "Retired from farming by Journal Officer request",
          farming_status_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", parcelId);

      if (parcelErr) throw parcelErr;

      const { error: historyErr } = await supabase
        .from("land_history")
        .update({
          is_current: false,
          period_end_date: new Date().toISOString().slice(0, 10),
          change_type: "STOPPED_FARMING",
          change_reason: deleteParcelReason || "Retired from farming",
          updated_at: new Date().toISOString(),
        })
        .eq("farm_parcel_id", parcelId)
        .eq("is_current", true);

      if (historyErr) {
        console.warn("History update warning (non-fatal):", historyErr.message);
      }

      if (farmerId) {
        await supabase.rpc("sync_farmer_no_parcels_status", {
          p_farmer_id: farmerId,
        });
      }

      try {
        const user = await getCurrentUserForAudit();
        await getAuditLogger().logCRUD(
          { ...user, id: undefined },
          "UPDATE",
          AuditModule.LAND_HISTORY,
          "retire_farm_parcel",
          `${parcelId}`,
          `Retired parcel #${selectedDeleteParcel.parcel_number || parcelId} from farmer ${selectedFarmer?.farmer_name || farmerId}`,
          { is_farming: true },
          { is_farming: false, reason: deleteParcelReason }
        );
      } catch (auditErr) {
        console.error("Audit log failed (non-blocking):", auditErr);
      }

      await refreshLandParcels();
      await fetchUnusedParcels();
      setShowDeleteParcelModal(false);
      setStopFarmingToast({
        message: `Successfully stopped farming parcel ${selectedDeleteParcel.parcel_number || `#${parcelId}`}. The parcel has been marked as inactive.`,
        parcelNumber: selectedDeleteParcel.parcel_number || `#${parcelId}`,
      });

      const stillHasParcels = selectedFarmer
        ? selectedFarmer.parcels.some(p => p.id !== parcelId)
        : false;
      if (!selectedFarmer || !stillHasParcels) {
        setShowModal(false);
        setSelectedFarmer(null);
        setSelectedRegistryRowId(null);
      } else {
        const pNumbers = selectedFarmer.parcels
          .filter(p => p.id !== parcelId)
          .map(p => p.parcel_number)
          .filter((pn): pn is string => Boolean(pn));
        const pIds = selectedFarmer.parcels
          .filter(p => p.id !== parcelId)
          .map(p => p.id);
        void fetchCultivationParcelsForFarmer(farmerId, pIds, pNumbers);
      }
    } catch (err: any) {
      console.error("Retire parcel failed:", err);
      setDeleteParcelError(err?.message || "Failed to retire parcel.");
    } finally {
      setIsDeletingParcel(false);
    }
  };

  const handleReactivateParcel = async (parcel: any) => {
    const confirmed = window.confirm(
      `Are you sure you want to reactivate parcel No. ${parcel.parcel_number || parcel.id} for farming?`
    );
    if (!confirmed) return;

    try {
      const parcelId = parcel.id;
      const farmerId = parcel.submission_id;

      const { error: parcelErr } = await supabase
        .from("rsbsa_farm_parcels")
        .update({
          is_farming: true,
          farming_status_reason: null,
          farming_status_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", parcelId);

      if (parcelErr) throw parcelErr;

      const { error: historyErr } = await supabase
        .from("land_history")
        .update({
          is_current: true,
          period_start_date: new Date().toISOString().slice(0, 10),
          period_end_date: null,
          change_type: "REACTIVATE",
          change_reason: "Reactivated for farming",
          updated_at: new Date().toISOString(),
        })
        .eq("farm_parcel_id", parcelId);

      if (historyErr) {
        console.warn("History update warning (non-fatal):", historyErr.message);
      }

      if (farmerId) {
        await supabase.rpc("sync_farmer_no_parcels_status", {
          p_farmer_id: farmerId,
        });
      }

      try {
        const user = await getCurrentUserForAudit();
        await getAuditLogger().logCRUD(
          { ...user, id: undefined },
          "UPDATE",
          AuditModule.LAND_HISTORY,
          "reactivate_farm_parcel",
          `${parcelId}`,
          `Reactivated parcel #${parcel.parcel_number || parcelId} for cultivation`,
          { is_farming: false },
          { is_farming: true }
        );
      } catch (auditErr) {
        console.error("Audit log failed (non-blocking):", auditErr);
      }

      await refreshLandParcels();
      await fetchUnusedParcels();
    } catch (err: any) {
      console.error("Reactivation failed:", err);
      alert(err?.message || "Failed to reactivate parcel.");
    }
  };

  const handleDeleteUnusedParcel = async (parcel: any) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete parcel No. ${parcel.parcel_number || parcel.id} from the system? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const parcelId = parcel.id;
      const farmerId = parcel.submission_id;

      const { error: deleteErr } = await supabase
        .from("rsbsa_farm_parcels")
        .delete()
        .eq("id", parcelId);

      if (deleteErr) throw deleteErr;

      const { error: historyErr } = await supabase
        .from("land_history")
        .update({
          is_current: false,
          period_end_date: new Date().toISOString().slice(0, 10),
          change_type: "HARD_DELETE",
          change_reason: "Permanently deleted parcel record",
          updated_at: new Date().toISOString(),
        })
        .eq("farm_parcel_id", parcelId);

      if (historyErr) {
        console.warn("History update warning (non-fatal):", historyErr.message);
      }

      if (farmerId) {
        await supabase.rpc("sync_farmer_no_parcels_status", {
          p_farmer_id: farmerId,
        });
      }

      try {
        const user = await getCurrentUserForAudit();
        await getAuditLogger().logCRUD(
          { ...user, id: undefined },
          "DELETE",
          AuditModule.LAND_HISTORY,
          "delete_farm_parcel",
          `${parcelId}`,
          `Permanently deleted parcel #${parcel.parcel_number || parcelId}`,
          { parcel },
          null
        );
      } catch (auditErr) {
        console.error("Audit log failed (non-blocking):", auditErr);
      }

      await refreshLandParcels();
      await fetchUnusedParcels();
    } catch (err: any) {
      console.error("Hard deletion failed:", err);
      alert(err?.message || "Failed to delete parcel permanently.");
    }
  };

  // Fetch all land parcels and unused parcels
  useEffect(() => {
    console.log("Fetching aggregated farmers and unused parcels...");
    refreshLandParcels();
    fetchUnusedParcels();
  }, [refreshLandParcels, fetchUnusedParcels]);

  // Close all row action menus on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest(".jo-land-registry-row-action-menu-wrap")) {
        return;
      }
      setOpenActionMenuRowId(null);
      setOpenUnusedActionMenuId(null);
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  const fetchCultivationParcelsForFarmer = async (
    farmerId: number,
    parcelIds?: number[],
    parcelNumbers?: string[],
  ) => {
    setCultivationLoading(true);
    try {
      const normalizeBoolean = (value: unknown): boolean | null => {
        if (typeof value === "boolean") return value;
        if (typeof value === "number") {
          if (value === 1) return true;
          if (value === 0) return false;
        }
        if (typeof value === "string") {
          const normalized = value.trim().toLowerCase();
          if (["true", "t", "yes", "y", "1"].includes(normalized)) return true;
          if (["false", "f", "no", "n", "0"].includes(normalized)) return false;
        }
        return null;
      };
      // Query ALL parcels for this farmer directly from the table
      // Don't rely on group.parcels since normalizeCurrentOwnershipGroups
      // may have already dropped parcels with is_current_owner === false
      const selectColumns =
        "id, submission_id, parcel_number, farm_location_barangay, farm_location_municipality, total_farm_area_ha, is_farming, farming_status_reason, farming_status_updated_at, cultivator_submission_id, is_cultivating, cultivation_status_reason, cultivation_status_updated_at";
      const normalizeParcelId = (value: unknown): number | null => {
        const parsed =
          typeof value === "number" ? value : Number(String(value));
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      };
      const buildParcelNumberCandidates = (numbers: string[]) => {
        const candidates = new Set<string>();
        numbers.forEach((num) => {
          const raw = num.trim();
          if (raw) candidates.add(raw);
          const cleaned = normalizeParcelNumber(raw);
          if (cleaned) {
            candidates.add(cleaned);
            candidates.add(`Parcel-${cleaned}`);
            candidates.add(`Parcel ${cleaned}`);
            candidates.add(`Parcel No. ${cleaned}`);
            candidates.add(`Parcel No.${cleaned}`);
            candidates.add(`Parcel #${cleaned}`);
          }
        });
        return Array.from(candidates);
      };
      const buildParcelNumberPatterns = (numbers: string[]) => {
        const patterns = new Set<string>();
        numbers.forEach((num) => {
          const cleaned = normalizeParcelNumber(num);
          if (!cleaned) return;
          const tokens = cleaned.split(/[^a-z0-9]+/i).filter(Boolean);
          if (tokens.length === 0) return;
          patterns.add(`%${tokens.join("%")}%`);
        });
        return Array.from(patterns);
      };

      const normalizedParcelIds = Array.isArray(parcelIds)
        ? Array.from(
          new Set(
            parcelIds
              .map((id) => normalizeParcelId(id))
              .filter((id): id is number => id !== null),
          ),
        )
        : [];

      let data: CultivationParcel[] = [];
      if (normalizedParcelIds.length > 0) {
        const historyOrFilter = normalizedParcelIds
          .map(
            (id) =>
              `id.eq.${id},farm_parcel_id.eq.${id},land_parcel_id.eq.${id}`,
          )
          .join(",");
        const { data: historyRows } = await supabase
          .from("land_history")
          .select("farm_parcel_id, land_parcel_id")
          .or(historyOrFilter);
        const historyParcelIds = Array.isArray(historyRows)
          ? historyRows.flatMap((row) => {
            const farmId = normalizeParcelId(row.farm_parcel_id);
            const landId = normalizeParcelId(row.land_parcel_id);
            return [farmId, landId].filter((id): id is number => id !== null);
          })
          : [];
        const combinedIds = Array.from(
          new Set([...normalizedParcelIds, ...historyParcelIds]),
        );

        const { data: parcelData } = await supabase
          .from("rsbsa_farm_parcels")
          .select(selectColumns)
          .in("id", combinedIds.length > 0 ? combinedIds : normalizedParcelIds);

        if (Array.isArray(parcelData)) {
          data = [...parcelData];
        }
      }

      if (farmerId) {
        const { data: fallbackData } = await supabase
          .from("rsbsa_farm_parcels")
          .select(selectColumns)
          .eq("submission_id", farmerId);

        if (Array.isArray(fallbackData)) {
          const existingIds = new Set(data.map((d) => d.id));
          fallbackData.forEach((d) => {
            if (!existingIds.has(d.id)) {
              data.push(d);
            }
          });
        }
      }

      if (parcelNumbers && parcelNumbers.length > 0) {
        const parcelNumberCandidates =
          buildParcelNumberCandidates(parcelNumbers);
        const { data: pNumData } = await supabase
          .from("rsbsa_farm_parcels")
          .select(selectColumns)
          .in(
            "parcel_number",
            parcelNumberCandidates.length > 0
              ? parcelNumberCandidates
              : parcelNumbers,
          );

        if (Array.isArray(pNumData)) {
          const existingIds = new Set(data.map((d) => d.id));
          pNumData.forEach((d) => {
            if (!existingIds.has(d.id)) {
              data.push(d);
            }
          });
        }

        const fuzzyPatterns = buildParcelNumberPatterns(parcelNumbers);
        if (
          fuzzyPatterns.length > 0 &&
          (!Array.isArray(pNumData) || pNumData.length === 0)
        ) {
          const fuzzyFilter = fuzzyPatterns
            .map((pattern) => `parcel_number.ilike.${pattern}`)
            .join(",");
          const { data: fuzzyData } = await supabase
            .from("rsbsa_farm_parcels")
            .select(selectColumns)
            .or(fuzzyFilter);
          if (Array.isArray(fuzzyData)) {
            const existingIds = new Set(data.map((d) => d.id));
            fuzzyData.forEach((d) => {
              if (!existingIds.has(d.id)) {
                data.push(d);
              }
            });
          }
        }
      }

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
        is_farming: normalizeBoolean(row.is_farming),
        is_cultivating: normalizeBoolean(row.is_cultivating),
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

    if (parcelIds.length === 0) {
      setParcelHistory([]);
      console.log("No parcel IDs found for selected row.");
    }

    const pNumbers = group.parcels
      .map((p) => p.parcel_number)
      .filter((pn): pn is string => Boolean(pn));

    void fetchCultivationParcelsForFarmer(group.farmer_id, parcelIds, pNumbers);

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

  const handleRowActionChangeLandowner = (row: RegistryDisplayRow) => {
    const { canUpdateTenantLandowner, canUpdateLesseeLandowner } =
      row.capabilities;

    if (!canUpdateTenantLandowner && !canUpdateLesseeLandowner) {
      setOpenActionMenuRowId(null);
      return;
    }

    // Auto-pick: derive role from the row's primary ownership context first,
    // then fall back to whichever capability is available (tenant preferred).
    const role: ReplacementRole =
      row.primaryOwnership === "tenant" && canUpdateTenantLandowner
        ? "tenant"
        : row.primaryOwnership === "lessee" && canUpdateLesseeLandowner
          ? "lessee"
          : canUpdateTenantLandowner
            ? "tenant"
            : "lessee";

    setOpenActionMenuRowId(null);
    setSelectedRegistryRowId(row.rowId);
    setSelectedFarmerViewRole(role);
    setShowModal(false);
    openOwnerAffiliationModal(row.farmer, role);
  };

  const handleRowActionFarmAnother = (row: RegistryDisplayRow) => {
    setOpenActionMenuRowId(null);
    setSelectedRegistryRowId(row.rowId);
    setSelectedFarmerViewRole("tenant");
    setShowModal(false);
    openFarmAnotherModal(row.farmer, "tenant");
  };

  const resetOwnerAffiliationWorkflow = () => {
    setIsFarmAnotherMode(false);
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
    setOwnerAffiliationContextNote("");
  };

  const loadOwnerAffiliationSourceOptions = async (
    group: FarmerGroup,
    role: ReplacementRole,
  ) => {
    setOwnerAffiliationLoading(true);
    setOwnerAffiliationSubmitError("");
    setOwnerAffiliationSubmitSuccess("");
    setOwnerAffiliationContextNote("");

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
        setOwnerAffiliationContextNote(
          `No active linked landowner found for this ${role}. You can create the first link below.` +
          extraNote,
        );
      } else {
        setOwnerAffiliationContextNote("");
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
      setOwnerAffiliationContextNote("");
    } finally {
      setOwnerAffiliationLoading(false);
    }
  };

  const closeOwnerAffiliationModal = () => {
    setShowOwnerAffiliationModal(false);
    resetOwnerAffiliationWorkflow();
  };

  const openOwnerAffiliationModal = (
    group: FarmerGroup,
    role: ReplacementRole,
  ) => {
    resetOwnerAffiliationWorkflow();
    setIsFarmAnotherMode(false);
    setSelectedFarmer(group);
    setOwnerAffiliationRole(role);
    setOwnerAffiliationQuickRoleSelection(role);
    setShowOwnerAffiliationModal(true);
    void loadOwnerAffiliationSourceOptions(group, role);
  };

  const openFarmAnotherModal = (
    group: FarmerGroup,
    role: ReplacementRole,
  ) => {
    resetOwnerAffiliationWorkflow();
    setIsFarmAnotherMode(true);
    setSelectedFarmer(group);
    setOwnerAffiliationRole(role);
    setOwnerAffiliationQuickRoleSelection(role);
    setShowOwnerAffiliationModal(true);
    setOwnerAffiliationSourceOptions([]);
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

        // ── Cleanup: release old parcels under the previous owner ──────────
        // After assigning new owner parcels, delete the tenant's old parcels
        // that are still linked to the previous (source) owner. Without this,
        // the old parcels remain attached and the tenant ends up with duplicates.
        const oldOwnerIds = Array.from(
          new Set(
            ownerAffiliationSourceOptions
              .map((o) => o.ownerId)
              .filter(
                (id): id is number =>
                  typeof id === "number" && id > 0 && id !== newOwnerId,
              ),
          ),
        );

        if (oldOwnerIds.length > 0) {
          try {
            // 1. Find old parcel IDs to clean up
            const ownerIdColumn =
              ownerAffiliationRole === "tenant"
                ? "tenant_land_owner_id"
                : "lessee_land_owner_id";

            const { data: oldParcels } = await supabase
              .from("rsbsa_farm_parcels")
              .select("id")
              .eq("submission_id", holderFarmerId)
              .in(ownerIdColumn, oldOwnerIds);

            const oldParcelIds = (oldParcels || []).map((p: any) =>
              Number(p.id),
            ).filter((id: number) => Number.isFinite(id) && id > 0);

            if (oldParcelIds.length > 0) {
              // 2. Mark land_history as not current
              await supabase
                .from("land_history")
                .update({
                  is_current: false,
                  period_end_date: new Date().toISOString().slice(0, 10),
                  updated_at: new Date().toISOString(),
                })
                .eq("farmer_id", holderFarmerId)
                .eq("is_current", true)
                .in("farm_parcel_id", oldParcelIds);

              // 3. Delete old tenant parcel copies
              await supabase
                .from("rsbsa_farm_parcels")
                .delete()
                .in("id", oldParcelIds)
                .eq("submission_id", holderFarmerId);

              console.log(
                `[OwnerAffiliation] Cleaned up ${oldParcelIds.length} old parcel(s) from previous owner(s).`,
              );
            }
          } catch (cleanupErr: any) {
            // Cleanup failure is non-fatal — the main assignment succeeded.
            console.warn(
              "[OwnerAffiliation] Old parcel cleanup failed (non-fatal):",
              cleanupErr?.message || cleanupErr,
            );
          }
        }
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

      const successMsg = isFarmAnotherMode
        ? `Farm Another Land assignment complete: ${successParts.join(" and ")}.`
        : `${ownerAffiliationRoleLabel} update complete: ${successParts.join(" and ")}.`;

      setOwnerAffiliationSubmitSuccess(successMsg);

      setOwnerAffiliationToast({
        message: successMsg,
        isFarmAnother: isFarmAnotherMode,
      });

      try {
        const user = await getCurrentUserForAudit();
        await getAuditLogger().logCRUD(
          { ...user, id: undefined },
          "UPDATE",
          AuditModule.LAND_HISTORY,
          isFarmAnotherMode ? "farm_another_land_assignment" : "owner_affiliation_update",
          `${holderFarmerId}`,
          isFarmAnotherMode
            ? `Assigned ${ownerAffiliationRoleLabel.toLowerCase()} link on landowner ${selectedOwnerAffiliationNewOwner?.ownerName || "Unknown"} parcel(s) to farmer ${selectedFarmer?.farmer_name || "Unknown"}`
            : `Updated ${ownerAffiliationRoleLabel} landowner for ${selectedFarmer?.farmer_name || "Unknown"} — from ${selectedOwnerAffiliationSource?.ownerName || "Unknown"} to ${selectedOwnerAffiliationNewOwner?.ownerName || "Unknown"}`,
          { previousOwnerId: activeOwnerAffiliationSourceOwnerId },
          {
            newOwnerId,
            role: ownerAffiliationRole,
            parcelCount: ownerAffiliationTakeoverPlan.selectedParcelCount,
          },
        );
      } catch (auditErr) {
        console.error("Audit log failed (non-blocking):", auditErr);
      }

      await refreshLandParcels();
      closeOwnerAffiliationModal();
      setSelectedFarmer(null);
      setSelectedRegistryRowId(null);
      setShowModal(false);
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
      }
    } finally {
      setIsSubmittingOwnerAffiliation(false);
    }
  };

  const fetchParcelHistoryForIds = async (parcelIds: number[], parcelNumbers: string[] = []) => {
    if (parcelIds.length === 0 && parcelNumbers.length === 0) {
      setParcelHistory([]);
      return;
    }
    setHistoryLoading(true);
    try {
      const idFilters = parcelIds
        .map((id) => `land_parcel_id.eq.${id},farm_parcel_id.eq.${id}`)
        .join(",");
      const numberFilters = parcelNumbers
        .filter(Boolean)
        .map((num) => `parcel_number.eq.${num.trim()}`)
        .join(",");
      const orFilter = [idFilters, numberFilters].filter(Boolean).join(",");

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

  useEffect(() => {
    const fetchMergedHistory = async () => {
      const ids: number[] = [];
      const pNumbers: string[] = [];

      if (selectedFarmer) {
        selectedFarmer.parcels.forEach((p) => {
          ids.push(p.id);
          if (p.parcel_number) pNumbers.push(p.parcel_number);
        });
      }

      if (sourceRegisteredOwnerId && typeof sourceRegisteredOwnerId === "number") {
        const donorGroup = aggregatedFarmers.find((g) => g.farmer_id === sourceRegisteredOwnerId);
        if (donorGroup) {
          donorGroup.parcels.forEach((p) => {
            ids.push(p.id);
            if (p.parcel_number) pNumbers.push(p.parcel_number);
          });
        }
      }

      const uniqueIds = Array.from(new Set(ids));
      const uniquePNumbers = Array.from(new Set(pNumbers));

      await fetchParcelHistoryForIds(uniqueIds, uniquePNumbers);
    };

    void fetchMergedHistory();
  }, [selectedFarmer, sourceRegisteredOwnerId, aggregatedFarmers]);

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

  // Helper to parse date strings as UTC if no timezone is specified
  const parseUtcDate = (dateString: string | null): Date | null => {
    if (!dateString) return null;
    // Check if it already has Z or offset suffix (+/-XX:XX)
    if (/Z|[+-]\d{2}:?\d{2}$/i.test(dateString)) {
      return new Date(dateString);
    }
    // Treat as UTC by replacing space with T and appending Z
    const isoString = dateString.includes("T") ? dateString : dateString.replace(" ", "T");
    return new Date(`${isoString}Z`);
  };

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Present";
    const date = parseUtcDate(dateString);
    if (!date || isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Format date and time
  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "—";
    const date = parseUtcDate(dateString);
    if (!date || isNaN(date.getTime())) return "—";
    const datePart = date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const timePart = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${datePart} ${timePart}`;
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
      canFarmAnotherLand: true,
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
        owner: "Land Owner",
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

      // Derive the linked land owner name for tenants/lessees
      let landOwnerName = "";
      if (primaryOwnership === "tenant" || primaryOwnership === "lessee") {
        for (const parcel of parcels) {
          const p = parcel as any;
          const name =
            (primaryOwnership === "tenant"
              ? p.tenant_land_owner_name
              : p.lessee_land_owner_name) ||
            p.land_owner_name ||
            "";
          if (name && typeof name === "string" && name.trim()) {
            landOwnerName = name.trim();
            break;
          }
        }
      }

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
            ? "—"
            : barangays.length === 1
              ? barangays[0]
              : "Multiple",
        landOwnerName,
      };
    };

    const rows: RegistryDisplayRow[] = [];

    aggregatedFarmers.forEach((group) => {
      if (!group || !Array.isArray(group.parcels)) return;
      if (group.archived_at) return;

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
        const hasNoLand = row.parcels.length === 0 || row.totalAreaHa <= 0;

        // Land status / Role filter
        if (landStatusFilter === "active" && hasNoLand) {
          return false;
        }
        if (landStatusFilter === "no_land" && !hasNoLand) {
          return false;
        }
        if (landStatusFilter === "owner" && !(row.primaryOwnership === "owner" || row.farmer.has_registered_owner === true)) {
          return false;
        }
        if (landStatusFilter === "tenant" && !(row.primaryOwnership === "tenant" || row.farmer.has_tenant === true)) {
          return false;
        }
        if (landStatusFilter === "lessee" && !(row.primaryOwnership === "lessee" || row.farmer.has_lessee === true)) {
          return false;
        }

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
  }, [registryRows, searchTerm, filterBarangay, filterCultivation, landStatusFilter]);

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

  const parcelDetailRows = useMemo<CultivationParcel[]>(() => {
    if (!selectedFarmer) return [];
    // Safety net: `farmer_aggregated_unified.parcels[]` can still contain
    // duplicate entries for the same underlying parcel (e.g. if the DB view
    // ever regresses, or during the rollout window before the view fix is
    // deployed everywhere). Dedupe by parcel id before rendering so the same
    // parcel never shows up twice in the modal.
    const seenParcelIds = new Set<string>();
    const dedupedParcels = selectedFarmer.parcels.filter((parcel) => {
      const key = String(parcel.id);
      if (seenParcelIds.has(key)) return false;
      seenParcelIds.add(key);
      return true;
    });
    return dedupedParcels.map((parcel) => {
      const normalizePN = (pn: string) => normalizeParcelNumberKey(pn);
      const matches = cultivationParcels.filter(
        (cp) =>
          String(cp.id) === String(parcel.id) ||
          (parcel.land_parcel_id &&
            String(cp.id) === String(parcel.land_parcel_id)) ||
          (cp.parcel_number &&
            parcel.parcel_number &&
            normalizePN(cp.parcel_number) ===
            normalizePN(parcel.parcel_number)),
      );

      matches.sort((a, b) => {
        const aHasData =
          a.is_farming !== null || a.is_cultivating !== null ? 1 : 0;
        const bHasData =
          b.is_farming !== null || b.is_cultivating !== null ? 1 : 0;
        return bHasData - aHasData;
      });

      const fetched = matches[0];

      // Resolve the active cultivator from parcelHistory (following the timeline)
      // We look for an active (is_current === true) record in parcelHistory for this parcel
      const activeHistoryRecord = parcelHistory.find(
        (h) =>
          h.is_current &&
          (h.is_tenant || h.is_lessee) &&
          (h.farm_parcel_id === parcel.id ||
            h.land_parcel_id === parcel.land_parcel_id ||
            (h.parcel_number &&
              parcel.parcel_number &&
              normalizePN(h.parcel_number) === normalizePN(parcel.parcel_number)))
      );

      // If the active history record is a tenant or lessee, then they are the active cultivator!
      // Otherwise, there is no active tenant/lessee cultivator.
      const activeCultivatorName = activeHistoryRecord && (activeHistoryRecord.is_tenant || activeHistoryRecord.is_lessee)
        ? activeHistoryRecord.farmer_name
        : null;

      return {
        id: parcel.id,
        submission_id: selectedFarmer.farmer_id,
        parcel_number: parcel.parcel_number || "",
        farm_location_barangay: parcel.farm_location_barangay || "",
        farm_location_municipality: parcel.farm_location_municipality || "",
        total_farm_area_ha: Number(parcel.total_farm_area_ha || 0),
        is_cultivating: fetched?.is_cultivating ?? null,
        cultivation_status_reason: fetched?.cultivation_status_reason ?? null,
        cultivation_status_updated_at:
          fetched?.cultivation_status_updated_at ?? null,
        is_farming: fetched?.is_farming ?? null,
        farming_status_reason: fetched?.farming_status_reason ?? null,
        farming_status_updated_at: fetched?.farming_status_updated_at ?? null,
        cultivator_submission_id: activeHistoryRecord && (activeHistoryRecord.is_tenant || activeHistoryRecord.is_lessee)
          ? activeHistoryRecord.farmer_id
          : null,
        cultivator_name: activeCultivatorName,
      };
    });
  }, [cultivationParcels, selectedFarmer, parcelHistory]);

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

    if (!ownerAffiliationHasExistingLink) {
      return [];
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
    ownerAffiliationHasExistingLink,
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

  // Scope is always "full_parcel" — the Full/Partial choice has been removed.
  const ownerAffiliationTakeoverModeLabel = "Full parcel(s)";

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
          if (group.archived_at) return false;
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

  const ownerAffiliationSelectableOptions = useMemo<SearchableSelectOption[]>(() => {
    return ownerAffiliationOwnerOptions.map((owner) => ({
      value: owner.ownerId,
      label: `${owner.ownerName} (${owner.parcelCount} owner parcel${owner.parcelCount !== 1 ? "s" : ""})`,
    }));
  }, [ownerAffiliationOwnerOptions]);

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

  // Build recipient options: all farmers excluding the current donor (Farmer A)
  const recipientOptions = useMemo<TransferActorOption[]>(() => {
    return aggregatedFarmers
      .filter((g) => g.farmer_id !== selectedContextFarmerId && !g.archived_at)
      .map((g) => ({
        farmerId: g.farmer_id,
        name: g.farmer_name || `Farmer #${g.farmer_id}`,
        barangay: g.parcels[0]?.farm_location_barangay || "",
        parcelIds: g.parcels.map((p) => p.id),
        parcelCount: g.parcels.length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [aggregatedFarmers, selectedContextFarmerId]);

  // Use the same recipient list for both voluntary and inheritance modes
  const voluntaryDonorOptions = recipientOptions;
  const inheritanceDonorOptions = recipientOptions;

  const voluntaryOptions = useMemo<SearchableSelectOption[]>(() => {
    return voluntaryDonorOptions.map((owner) => {
      const parcelSuffix = owner.parcelCount === 0
        ? "No Active Parcels"
        : `${owner.parcelCount} parcel${owner.parcelCount !== 1 ? "s" : ""}`;
      return {
        value: owner.farmerId,
        label: `${owner.name} (${parcelSuffix})`,
      };
    });
  }, [voluntaryDonorOptions]);

  const inheritanceOptions = useMemo<SearchableSelectOption[]>(() => {
    return inheritanceDonorOptions.map((owner) => {
      const parcelSuffix = owner.parcelCount === 0
        ? "No Active Parcels"
        : `${owner.parcelCount} parcel${owner.parcelCount !== 1 ? "s" : ""}`;
      return {
        value: owner.farmerId,
        label: `${owner.name} (${parcelSuffix})`,
      };
    });
  }, [inheritanceDonorOptions]);

  const selectedRegisteredOwner =
    voluntaryDonorOptions.find((o) => o.farmerId === sourceRegisteredOwnerId) ||
    null;
  const selectedBeneficiaryOwner =
    inheritanceDonorOptions.find((o) => o.farmerId === beneficairyOwnerId) ||
    null;

  const selectedSource: TransferActorOption | null = selectedFarmer
    ? {
      farmerId: selectedFarmer.farmer_id,
      name:
        selectedFarmer.farmer_name || `Farmer #${selectedFarmer.farmer_id}`,
      barangay: selectedFarmer.parcels[0]?.farm_location_barangay || "",
      parcelIds: selectedFarmer.parcels.map((p) => p.id),
      parcelCount: selectedFarmer.parcels.length,
    }
    : null;

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

  // Farmer A (the row that was clicked) is always the donor.
  const donorFarmerId = selectedContextFarmerId;

  const donorFarmerGroup =
    aggregatedFarmers.find((g) => g.farmer_id === donorFarmerId) ?? null;

  const donorParcelsForTransfer = donorFarmerGroup
    ? getEligibleTransferDonorParcels(donorFarmerGroup)
    : [];

  const donorSplitParcels: ParcelSplitInput[] = donorParcelsForTransfer.map(
    (p) => {
      const normalizePN = (pn: string) => normalizeParcelNumberKey(pn);
      const activeHistoryRecord = parcelHistory.find(
        (h) =>
          h.is_current &&
          (h.is_tenant || h.is_lessee) &&
          (h.farm_parcel_id === p.id ||
            (h.parcel_number &&
              p.parcel_number &&
              normalizePN(h.parcel_number) === normalizePN(p.parcel_number)))
      );
      const cultivatorName = activeHistoryRecord && (activeHistoryRecord.is_tenant || activeHistoryRecord.is_lessee)
        ? activeHistoryRecord.farmer_name
        : null;

      return {
        farm_parcel_id: p.id,
        parcel_number: p.parcel_number,
        farm_location_barangay: p.farm_location_barangay,
        total_farm_area_ha: Number(p.total_farm_area_ha) || 0,
        transfer_area_ha: "",
        cultivator_name: cultivatorName,
      };
    },
  );

  const partialTotalTransferAreaHa: number = donorSplitParcels.reduce(
    (sum, p) => {
      const isSelected = selectedTransferParcelIds.includes(p.farm_parcel_id);
      return sum + (isSelected ? Number(p.total_farm_area_ha) || 0 : 0);
    },
    0,
  );

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
      return "Current selected owner is invalid for transfer.";
    }
    if (transferMode === "inheritance" && !selectedBeneficiaryOwner) {
      return "Select the heir receiving the inheritance.";
    }
    if (transferMode === "voluntary" && !selectedRegisteredOwner) {
      return "Select the farmer receiving the land.";
    }
    if (donorSplitParcels.length === 0) {
      return "No transferable registered-owner parcels found for the current owner.";
    }
    if (
      donorSplitParcels.length > 0 &&
      selectedTransferParcelIds.length === 0
    ) {
      return "Please select at least one parcel to transfer.";
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
    setSelectedTransferParcelIds([]);
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
      setTransferSubmitError("Missing transfer mode or current owner (donor).");
      return;
    }

    const isInheritance = transferMode === "inheritance";
    // Farmer A (the row that was clicked) is always the donor.
    const fromFarmerId = selectedContextFarmerId;
    if (!fromFarmerId || fromFarmerId <= 0) {
      setTransferSubmitError("Invalid current owner (donor).");
      return;
    }

    // The recipient is whoever was selected from the dropdown.
    const toFarmerId = isInheritance
      ? typeof beneficairyOwnerId === "number"
        ? beneficairyOwnerId
        : null
      : typeof sourceRegisteredOwnerId === "number"
        ? sourceRegisteredOwnerId
        : null;

    if (!toFarmerId || toFarmerId <= 0) {
      setTransferSubmitError("Please select a valid recipient.");
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
      const parcelsToVerify = donorSplitParcels.filter((p) =>
        selectedTransferParcelIds.includes(p.farm_parcel_id),
      );

      const {
        verifiedParcels,
        invalidParcelIds,
        invalidRoleParcelIds,
        verifiedAvailableAreaHa,
      } = await verifyDonorParcelOwnership(
        fromFarmerId,
        parcelsToVerify.map((p) => ({
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

      // Calls the existing create_ownership_transfer_no_review RPC.
      // Parcel scope is always "full" now, so requestedAreaHa is simply
      // the donor's verified available area for the selected parcel(s)
      // unless a specific partial-hectare take is set (areaMode).
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

      try {
        const user = await getCurrentUserForAudit();
        const recipientName = isInheritance
          ? selectedBeneficiaryOwner?.name || `Farmer #${toFarmerId}`
          : selectedRegisteredOwner?.name || `Farmer #${toFarmerId}`;
        await getAuditLogger().logCRUD(
          { ...user, id: undefined },
          "UPDATE",
          AuditModule.LAND_PLOTS,
          "ownership_transfer",
          `${donorFarmerId}-to-${toFarmerId}`,
          `Transferred ownership from ${selectedSource?.name || "Unknown"} to ${recipientName} (${transferMode})`,
          { fromFarmerId: donorFarmerId, transferMode },
          {
            toFarmerId,
            totalAreaHa: partialTotalTransferAreaHa,
            parcelCount: donorSplitParcels.length,
          },
        );
      } catch (auditErr) {
        console.error("Audit log failed (non-blocking):", auditErr);
      }

      const transferredParcelIds = donorSplitParcels
        .map((p) => p.farm_parcel_id)
        .filter((id) => Number.isFinite(id) && id > 0);

      if (transferredParcelIds.length > 0) {
        // Always relink tenant/lessee records tied to the specific
        // parcel(s) that just moved -- regardless of transfer mode, and
        // regardless of whether the donor still owns other, unrelated
        // parcels. The RPC only touches records scoped to these exact
        // parcel IDs, so this is safe to call unconditionally: if
        // nothing is tenanted on the transferred parcel(s), it's a
        // no-op. Previously this only ran for inheritance, or for
        // voluntary transfers where the donor gave away everything they
        // had -- meaning a tenant sitting on one specific parcel would
        // NOT get relinked if the donor happened to still own other
        // parcels elsewhere, even though that tenant's actual landlord
        // for THIS parcel had changed.
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

      setTransferToast({
        message: "Ownership transfer completed successfully!",
        transferId: transferId ?? undefined,
      });
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
      setInheritanceAreaMode("take_all");
      setInheritancePartialAreaHa("");
      return;
    }

    setBeneficairyOwnerId(
      Number.isFinite(parsedId) && parsedId > 0 ? parsedId : "",
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
      {/* ── Transfer Success Toast ─────────────────────────────────── */}
      {transferToast && (
        <div className="jo-lr-toast jo-lr-toast--success" role="alert">
          <div className="jo-lr-toast__icon">✅</div>
          <div className="jo-lr-toast__body">
            <div className="jo-lr-toast__title">Transfer Successful</div>
            <div className="jo-lr-toast__message">
              {transferToast.message}
              {transferToast.transferId !== undefined && (
                <span className="jo-lr-toast__id">
                  {" "}(Transfer ID: {String(transferToast.transferId)})
                </span>
              )}
            </div>
          </div>
          <button
            className="jo-lr-toast__close"
            onClick={() => setTransferToast(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
          <div className="jo-lr-toast__progress" />
        </div>
      )}

      {/* ── Stop Farming Success Toast ───────────────────────────────── */}
      {stopFarmingToast && (
        <div className="jo-lr-toast jo-lr-toast--stop-farming" role="alert">
          <div className="jo-lr-toast__icon">🍂</div>
          <div className="jo-lr-toast__body">
            <div className="jo-lr-toast__title">Stop Farming Recorded</div>
            <div className="jo-lr-toast__message">
              {stopFarmingToast.message}
              {stopFarmingToast.parcelNumber && (
                <span className="jo-lr-toast__id">
                  {" "}(Parcel: {stopFarmingToast.parcelNumber})
                </span>
              )}
            </div>
          </div>
          <button
            className="jo-lr-toast__close"
            onClick={() => setStopFarmingToast(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
          <div className="jo-lr-toast__progress jo-lr-toast__progress--amber" />
        </div>
      )}

      {/* ── Owner Affiliation / Farm Another Success Toast ───────────────── */}
      {ownerAffiliationToast && (
        <div className="jo-lr-toast jo-lr-toast--success" role="alert">
          <div className="jo-lr-toast__icon">🚜</div>
          <div className="jo-lr-toast__body">
            <div className="jo-lr-toast__title">
              {ownerAffiliationToast.isFarmAnother ? "Farm Another Land Assigned" : "Landowner Linked Successfully"}
            </div>
            <div className="jo-lr-toast__message">
              {ownerAffiliationToast.message}
            </div>
          </div>
          <button
            className="jo-lr-toast__close"
            onClick={() => setOwnerAffiliationToast(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
          <div className="jo-lr-toast__progress" />
        </div>
      )}

      <div className="jo-land-registry-page has-mobile-sidebar">
        {/* Sidebar */}
        <JOSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

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
            {/* Toggle Tabs */}
            {false && (
              <div className="jo-land-registry-tabs">
                <button
                  className={`jo-land-registry-tab-btn ${activeViewTab === "farmers" ? "active" : ""}`}
                  onClick={() => {
                    setActiveViewTab("farmers");
                    setSearchTerm("");
                    setFilterBarangay("");
                  }}
                >
                  🧑‍🌾 Cultivators & Active Farms
                </button>
                <button
                  className={`jo-land-registry-tab-btn ${activeViewTab === "unused" ? "active" : ""}`}
                  onClick={() => {
                    setActiveViewTab("unused");
                    setSearchTerm("");
                    setFilterBarangay("");
                    void fetchUnusedParcels();
                  }}
                >
                  🍂 Idle & Unused Farms
                </button>
              </div>
            )}

            {activeViewTab === "farmers" && (
              <>
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
                  id="land-status-filter"
                  className="jo-land-registry-barangay-select"
                  value={landStatusFilter}
                  onChange={(e) => setLandStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses / Roles</option>
                  <option value="active">✅ Active (Has Land)</option>
                  <option value="no_land">⚠️ No Active Land</option>
                  <option value="owner">👤 Registered Owner</option>
                  <option value="tenant">🌾 Tenant</option>
                  <option value="lessee">📜 Lessee</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="jo-land-registry-table-container">
              <table className="jo-land-registry-table">
                <thead>
                  <tr>
                    <th>Farmer</th>
                    <th>FFRS Code</th>
                    <th>Tenure Status</th>
                    <th>Associated Landowner</th>
                    <th>Barangay</th>
                    <th>Parcels</th>
                    <th>Area (ha)</th>
                    <th>Status &amp; Last Activity</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="jo-land-registry-loading-cell">
                        Loading land parcels...
                      </td>
                    </tr>
                  ) : filteredRegistryRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="jo-land-registry-empty-cell">
                        {searchTerm || filterBarangay
                          ? "No parcels match your search criteria"
                          : "No land parcels registered yet"}
                      </td>
                    </tr>
                  ) : (
                    filteredRegistryRows.map((row) => {
                      const hasNoLand =
                        row.parcels.length === 0 || row.totalAreaHa <= 0;
                      return (
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
                          className={`${selectedRegistryRowId === row.rowId ? "selected" : ""} ${hasNoLand ? "jo-land-registry-row-no-land" : ""}`}
                        >
                          <td className="jo-land-registry-farmer-name">
                            {row.farmer.farmer_name || "—"}
                          </td>
                          <td className="jo-land-registry-ffrs-code-cell">
                            {row.farmer.ffrs_code || "—"}
                          </td>
                          <td className="jo-land-registry-ownership-cell">
                            <div className="jo-land-registry-ownership-stack">
                              <span
                                className={`jo-land-registry-ownership-pill ${row.ownershipSecondaryLabels.length > 0
                                    ? "jo-land-registry-ownership-multiple"
                                    : `jo-land-registry-ownership-${row.primaryOwnership}`
                                  }`}
                              >
                                {row.ownershipSecondaryLabels.length > 0
                                  ? "Multiple"
                                  : row.primaryOwnership === "owner"
                                    ? "Land Owner"
                                    : row.primaryOwnership === "tenant"
                                      ? "Tenant"
                                      : "Lessee"}
                              </span>
                            </div>
                          </td>
                          <td>
                            {row.landOwnerName ? (
                              <span title={row.landOwnerName}>
                                {row.landOwnerName}
                              </span>
                            ) : row.primaryOwnership === "owner" ? (
                              <span style={{ color: "#9ca3af" }}>—</span>
                            ) : (
                              <span
                                style={{
                                  color: "#f59e0b",
                                  fontSize: "11px",
                                  fontStyle: "italic",
                                }}
                              >
                                Not linked
                              </span>
                            )}
                          </td>
                          <td>{row.primaryBarangay || "Multiple"}</td>
                          <td className="jo-land-registry-parcels-count-cell">
                            {row.parcels.length}
                          </td>
                          <td>{row.totalAreaHa.toFixed(2) || "0"}</td>
                          <td className="jo-land-registry-status-activity-cell">
                            <div className="jo-land-registry-status-activity-stack">
                              {hasNoLand && (
                                <span
                                  className="jo-land-registry-no-land-warning"
                                  title="No Land / Transferred All Parcels"
                                >
                                  ⚠️ No Land
                                </span>
                              )}
                              <span className="jo-land-registry-last-activity-date">
                                {formatDateTime(row.farmer.last_updated)}
                              </span>
                            </div>
                          </td>
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
                                aria-expanded={
                                  openActionMenuRowId === row.rowId
                                }
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
                                      onClick={() =>
                                        handleRowActionTransfer(row)
                                      }
                                    >
                                      Transfer Ownership
                                    </button>
                                  )}
                                  {(row.capabilities.canUpdateTenantLandowner ||
                                    row.capabilities
                                      .canUpdateLesseeLandowner) && (
                                      <button
                                        type="button"
                                        className="jo-land-registry-row-action-menu-item jo-land-registry-row-action-menu-item-tenant"
                                        role="menuitem"
                                        title="Change the landowner this tenant/lessee is farming under"
                                        onClick={() =>
                                          handleRowActionChangeLandowner(row)
                                        }
                                      >
                                        Change Landowner
                                      </button>
                                    )}
                                  {row.capabilities.canFarmAnotherLand && (
                                    <button
                                      type="button"
                                      className="jo-land-registry-row-action-menu-item jo-land-registry-row-action-menu-item-tenant"
                                      role="menuitem"
                                      title="Farm another landowner's parcel as tenant/lessee"
                                      onClick={() =>
                                        handleRowActionFarmAnother(row)
                                      }
                                    >
                                      Farm Another Land
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {false && activeViewTab === "unused" && (
          <>
            {/* Filters */}
            <div className="jo-land-registry-filters-section">
              <div className="jo-land-registry-search-filter">
                <input
                  type="text"
                  className="jo-land-registry-search-input"
                  placeholder="🔍 Search by parcel number, landowner, or reason..."
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
                    <th>Parcel Number</th>
                    <th>Location</th>
                    <th>Area (ha)</th>
                    <th>Landowner</th>
                    <th>Retired Date</th>
                    <th>Reason for Retirement</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingUnused ? (
                    <tr>
                      <td colSpan={7} className="jo-land-registry-loading-cell">
                        Loading unused land parcels...
                      </td>
                    </tr>
                  ) : unusedParcels.filter(p => {
                    const term = searchTerm.toLowerCase();
                    const matchSearch =
                      !searchTerm ||
                      (p.parcel_number || "").toLowerCase().includes(term) ||
                      (p.landowner_name || "").toLowerCase().includes(term) ||
                      (p.farming_status_reason || "").toLowerCase().includes(term);

                    const matchBarangay =
                      !filterBarangay ||
                      (p.farm_location_barangay || "").toLowerCase() === filterBarangay.toLowerCase();

                    return matchSearch && matchBarangay;
                  }).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="jo-land-registry-empty-cell">
                        No unused land parcels found
                      </td>
                    </tr>
                  ) : (
                    unusedParcels
                      .filter(p => {
                        const term = searchTerm.toLowerCase();
                        const matchSearch =
                          !searchTerm ||
                          (p.parcel_number || "").toLowerCase().includes(term) ||
                          (p.landowner_name || "").toLowerCase().includes(term) ||
                          (p.farming_status_reason || "").toLowerCase().includes(term);

                        const matchBarangay =
                          !filterBarangay ||
                          (p.farm_location_barangay || "").toLowerCase() === filterBarangay.toLowerCase();

                        return matchSearch && matchBarangay;
                      })
                      .map((parcel) => {
                        return (
                          <tr key={parcel.id}>
                            <td>{parcel.parcel_number || "N/A"}</td>
                            <td>{parcel.farm_location_barangay || "—"}</td>
                            <td>{Number(parcel.total_farm_area_ha || 0).toFixed(2)}</td>
                            <td>{parcel.landowner_name}</td>
                            <td>{parcel.farming_status_updated_at ? formatDate(parcel.farming_status_updated_at) : "—"}</td>
                            <td>{parcel.farming_status_reason || "Not specified"}</td>
                            <td
                              className="jo-land-registry-row-action-cell"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.nativeEvent.stopImmediatePropagation();
                              }}
                            >
                              <div
                                className="jo-land-registry-row-action-menu-wrap"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.nativeEvent.stopImmediatePropagation();
                                }}
                              >
                                <button
                                  type="button"
                                  className="jo-land-registry-row-action-trigger"
                                  aria-label="Open row actions"
                                  aria-haspopup="menu"
                                  aria-expanded={
                                    openUnusedActionMenuId === parcel.id
                                  }
                                  onClick={() =>
                                    setOpenUnusedActionMenuId((prev) =>
                                      prev === parcel.id ? null : parcel.id
                                    )
                                  }
                                  title="Actions"
                                >
                                  ...
                                </button>

                                {openUnusedActionMenuId === parcel.id && (
                                  <div
                                    className="jo-land-registry-row-action-menu"
                                    role="menu"
                                    style={{ right: 0 }}
                                  >
                                    <button
                                      type="button"
                                      className="jo-land-registry-row-action-menu-item"
                                      role="menuitem"
                                      onClick={() => {
                                        setOpenUnusedActionMenuId(null);
                                        handleReactivateParcel(parcel);
                                      }}
                                    >
                                      Re-activate
                                    </button>
                                    <button
                                      type="button"
                                      className="jo-land-registry-row-action-menu-item"
                                      role="menuitem"
                                      onClick={() => {
                                        setOpenUnusedActionMenuId(null);
                                        const ownerGroup = aggregatedFarmers.find(
                                          (g) => g.farmer_id === parcel.submission_id
                                        );
                                        if (ownerGroup) {
                                          openFarmAnotherModal(ownerGroup, "tenant");
                                        } else {
                                          const fallbackGroup: FarmerGroup = {
                                            farmer_id: parcel.submission_id,
                                            farmer_name: parcel.landowner_name,
                                            ffrs_code: "",
                                            parcels: [
                                              {
                                                id: parcel.id,
                                                parcel_number: parcel.parcel_number,
                                                farm_location_barangay: parcel.farm_location_barangay,
                                                farm_location_municipality: "Dumangas",
                                                total_farm_area_ha: parcel.total_farm_area_ha,
                                              }
                                            ],
                                            total_farm_area_ha: parcel.total_farm_area_ha,
                                            last_updated: new Date().toISOString(),
                                            has_registered_owner: true,
                                            has_tenant: false,
                                            has_lessee: false,
                                          };
                                          openFarmAnotherModal(fallbackGroup, "tenant");
                                        }
                                      }}
                                    >
                                      Assign Tenant
                                    </button>
                                    <button
                                      type="button"
                                      className="jo-land-registry-row-action-menu-item jo-land-registry-row-action-menu-item-owner"
                                      role="menuitem"
                                      style={{ color: "#ef4444" }}
                                      onClick={() => {
                                        setOpenUnusedActionMenuId(null);
                                        handleDeleteUnusedParcel(parcel);
                                      }}
                                    >
                                      Delete Parcel
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
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
                      {(selectedFarmerCapabilities?.canUpdateTenantLandowner ||
                        selectedFarmerCapabilities?.canUpdateLesseeLandowner) && (
                          <button
                            className="jo-land-registry-transfer-button"
                            style={{ cursor: "pointer" }}
                            onClick={() => {
                              if (!selectedFarmer) return;
                              const role: ReplacementRole =
                                selectedOwnerAffiliationQuickRole ?? "tenant";
                              setShowModal(false);
                              openOwnerAffiliationModal(selectedFarmer, role);
                            }}
                          >
                            🏡 Change Landowner
                          </button>
                        )}
                      {selectedFarmerCapabilities?.canFarmAnotherLand && (
                        <button
                          className="jo-land-registry-transfer-button"
                          style={{ cursor: "pointer" }}
                          onClick={() => {
                            if (!selectedFarmer) return;
                            setShowModal(false);
                            openFarmAnotherModal(selectedFarmer, "tenant");
                          }}
                        >
                          🚜 Farm Another Land
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
                    {(selectedFarmerViewRole === "tenant" ||
                      selectedFarmerViewRole === "lessee") &&
                      (() => {
                        const currentRecord = parcelHistory.find(
                          (r) =>
                            r.is_current &&
                            (selectedFarmerViewRole === "tenant"
                              ? r.is_tenant
                              : r.is_lessee),
                        );
                        const ownerName =
                          currentRecord?.land_owner_name || null;
                        return ownerName ? (
                          <div className="jo-land-registry-info-item">
                            <span className="jo-land-registry-info-label">
                              Land Owner
                            </span>
                            <span
                              className="jo-land-registry-info-value"
                              style={{ fontWeight: 600, color: "#166534" }}
                            >
                              🏡 {ownerName}
                            </span>
                          </div>
                        ) : null;
                      })()}
                  </div>
                </div>

                {/* Parcel Details Section */}
                <div className="jo-land-registry-detail-section">
                  <h4>🌾 Land Parcels</h4>
                  {cultivationLoading ? (
                    <p>Loading parcel details...</p>
                  ) : parcelDetailRows.length === 0 ? (
                    <p>No parcel details recorded yet.</p>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                      }}
                    >
                      {parcelDetailRows.map((parcel) => {
                        const rawParcelNumber = (
                          parcel.parcel_number || ""
                        ).trim();
                        const parcelLabel = rawParcelNumber
                          ? /^parcel/i.test(rawParcelNumber)
                            ? rawParcelNumber
                            : `Parcel-${rawParcelNumber}`
                          : "Parcel";
                        const matchedParcel = selectedFarmer?.parcels.find(
                          (p) =>
                            p.id === parcel.id ||
                            (p.parcel_number &&
                              p.parcel_number === parcel.parcel_number),
                        );
                        const hasTenant = matchedParcel?.is_tenant === true;
                        const hasLessee = matchedParcel?.is_lessee === true;
                        const tenantLesseeLabel =
                          hasTenant && hasLessee
                            ? "Tenant + Lessee"
                            : hasTenant
                              ? "Tenant"
                              : hasLessee
                                ? "Lessee"
                                : null;
                        const fallbackRoleLabel =
                          tenantLesseeLabel ||
                          (selectedFarmerViewRole === "tenant"
                            ? "Tenant"
                            : selectedFarmerViewRole === "lessee"
                              ? "Lessee"
                              : null);
                        const isTenantOrLessee = Boolean(fallbackRoleLabel);
                        const isFarming =
                          !isTenantOrLessee
                            ? (typeof parcel.is_cultivating === "boolean" ? parcel.is_cultivating : parcel.is_farming)
                            : (typeof parcel.is_farming === "boolean" ? parcel.is_farming : parcel.is_cultivating);
                        const statusLabel =
                          isFarming === true
                            ? "Farming"
                            : isFarming === false
                              ? "Not farming"
                              : "Not specified";
                        const occupantLabel = isTenantOrLessee
                          ? `${selectedFarmer?.farmer_name || "Unknown"} (${fallbackRoleLabel
                          })`
                          : statusLabel;
                        const inactiveReason =
                          parcel.farming_status_reason ||
                          parcel.cultivation_status_reason ||
                          "";
                        const updatedAt =
                          parcel.farming_status_updated_at ||
                          parcel.cultivation_status_updated_at;
                        const detailLine =
                          !isTenantOrLessee && isFarming === false
                            ? parcel.cultivator_name
                              ? `Cultivator: ${parcel.cultivator_name}`
                              : inactiveReason
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
                                alignItems: "center",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "4px",
                                }}
                              >
                                <strong>
                                  {parcelLabel} - {occupantLabel}
                                </strong>
                              </div>
                              {parcel.is_farming !== false && isTenantOrLessee && (
                                <button
                                  className="jo-land-registry-action-btn-delete"
                                  onClick={() => {
                                    setSelectedDeleteParcel(parcel);
                                    setDeleteParcelReason("");
                                    setDeleteParcelError("");
                                    setShowDeleteParcelModal(true);
                                  }}
                                  title="Stop farming this parcel"
                                >
                                  🗑️ Stop Farming
                                </button>
                              )}
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
                              {updatedAt && (
                                <span>Updated: {formatDate(updatedAt)}</span>
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
                              "OWNER_AFFILIATION_CHANGE" ||
                              normalizedChangeType === "OWNERSHIP_CHANGE";
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
                              // For OWNERSHIP_CHANGE the "new owner" is land_owner_name,
                              // not the farmer/lessee who stays as holder
                              if (normalizedChangeType === "OWNERSHIP_CHANGE") {
                                return (
                                  record.land_owner_name ||
                                  record.farmer_name ||
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
                            // Fallback: extract donor from change_reason sentence
                            if (!donorName && record.change_reason) {
                              const crMatch = record.change_reason.match(
                                /^Ownership transfer from (.+?) to .+$/i,
                              );
                              if (crMatch) donorName = crMatch[1].trim();
                            }
                            // For OWNERSHIP_CHANGE, trace the previous owner via
                            // previous_history_id — parcelHistory already has that row
                            if (
                              !donorName &&
                              normalizedChangeType === "OWNERSHIP_CHANGE" &&
                              record.previous_history_id
                            ) {
                              const previousRecord = parcelHistory.find(
                                (r) => r.id === record.previous_history_id,
                              );
                              if (previousRecord) {
                                donorName =
                                  previousRecord.land_owner_name ||
                                  previousRecord.farmer_name ||
                                  null;
                              }
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

        {/* Stop Farming / Retire Modal */}
        {showDeleteParcelModal && selectedDeleteParcel && (
          <div
            className="jo-land-registry-modal-overlay"
            onClick={() => setShowDeleteParcelModal(false)}
          >
            <div
              className="jo-land-registry-modal jo-land-registry-delete-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="jo-land-registry-modal-header jo-land-registry-delete-header">
                <h3>🍂 Stop Farming / Retire Land</h3>
                <button
                  className="jo-land-registry-close-button"
                  onClick={() => setShowDeleteParcelModal(false)}
                >
                  ×
                </button>
              </div>

              <div className="jo-land-registry-modal-body">
                <div className="jo-land-registry-replacement-flow">
                  <div className="jo-land-registry-replacement-note" style={{ borderColor: "#fca5a5", borderLeftColor: "#ef4444", background: "#fef2f2", color: "#991b1b" }}>
                    <strong>Warning:</strong> You are about to mark this land parcel as <strong>inactive/not farming</strong>. It will be excluded from the farmer's active profile, active maps, and the active dashboard stats.
                  </div>

                  {deleteParcelError && (
                    <div
                      className="jo-land-registry-replacement-note"
                      style={{
                        borderColor: "#fecaca",
                        borderLeftColor: "#dc2626",
                        background: "#fef2f2",
                        color: "#991b1b",
                      }}
                    >
                      <strong>Error:</strong> {deleteParcelError}
                    </div>
                  )}

                  <div className="jo-land-registry-transfer-section-card">
                    <h4>Land Parcel Information</h4>
                    <div className="jo-land-registry-info-grid" style={{ marginTop: "10px" }}>
                      <div className="jo-land-registry-info-item">
                        <span className="jo-land-registry-info-label">Parcel Number</span>
                        <span className="jo-land-registry-info-value">{selectedDeleteParcel.parcel_number || "N/A"}</span>
                      </div>
                      <div className="jo-land-registry-info-item">
                        <span className="jo-land-registry-info-label">Location (Barangay)</span>
                        <span className="jo-land-registry-info-value">{selectedDeleteParcel.farm_location_barangay || "—"}</span>
                      </div>
                      <div className="jo-land-registry-info-item">
                        <span className="jo-land-registry-info-label">Area</span>
                        <span className="jo-land-registry-info-value">{Number(selectedDeleteParcel.total_farm_area_ha || 0).toFixed(2)} ha</span>
                      </div>
                    </div>
                  </div>

                  <div className="jo-land-registry-transfer-section-card" style={{ marginTop: "20px" }}>
                    <h4>Reason for Stopping Farming</h4>
                    <div style={{ marginTop: "10px" }}>
                      <textarea
                        className="jo-land-registry-reason-textarea"
                        style={{
                          width: "100%",
                          minHeight: "80px",
                          borderRadius: "8px",
                          border: "1px solid #d1d5db",
                          padding: "10px",
                          fontSize: "13px",
                          fontFamily: "inherit",
                          resize: "vertical",
                        }}
                        placeholder="e.g. Farmer decided to retire, contract expired, or land was sold..."
                        value={deleteParcelReason}
                        onChange={(e) => setDeleteParcelReason(e.target.value)}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: "12px",
                      marginTop: "24px",
                      borderTop: "1px solid #e5e7eb",
                      paddingTop: "16px",
                    }}
                  >
                    <button
                      type="button"
                      style={{
                        background: "#f3f4f6",
                        color: "#374151",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        padding: "10px 20px",
                        fontSize: "14px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                      onClick={() => setShowDeleteParcelModal(false)}
                      disabled={isDeletingParcel}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="jo-land-registry-delete-btn"
                      onClick={handleDeleteParcelSubmit}
                      disabled={isDeletingParcel}
                    >
                      {isDeletingParcel ? "Retiring..." : "Confirm & Stop Farming"}
                    </button>
                  </div>
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
                        <span>Transferring Owner (Donor)</span>
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
                          Only registered-owner parcels can be transferred. The
                          current holder's owner parcels are listed below.
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

                    {(transferMode === "voluntary" ||
                      transferMode === "inheritance") && (
                      <>
                        {/* ── Step 2: Select Land Parcel(s) to Transfer ── */}
                        <div className="jo-land-registry-transfer-section-card">
                          <h4>Step 2: Select Land Parcel(s) to Transfer</h4>
                          {donorSplitParcels.length > 0 ? (
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
                                totalTransferAreaHa={partialTotalTransferAreaHa}
                                donorTotalAreaHa={donorSplitParcels.reduce(
                                  (s, p) =>
                                    s + (Number(p.total_farm_area_ha) || 0),
                                  0,
                                )}
                                selectedFullParcelIds={selectedTransferParcelIds}
                                onToggleFullParcel={handleToggleTransferParcel}
                              />
                            </div>
                          ) : (
                            <div className="jo-land-registry-transfer-mini-note">
                              No transferable registered-owner parcels were found
                              for the current owner.
                            </div>
                          )}
                        </div>

                        {/* ── Step 3: Select Recipient / Heir Farmer ── */}
                        {transferMode === "voluntary" && (
                          <div className="jo-land-registry-transfer-section-card">
                            <h4>Step 3: Select Recipient</h4>
                            <label className="jo-land-registry-transfer-label">
                              Recipient Farmer
                            </label>
                            <SearchableSelect
                              options={voluntaryOptions}
                              value={
                                selectedRegisteredOwner
                                  ? sourceRegisteredOwnerId
                                  : ""
                              }
                              onChange={(val) =>
                                handleRegisteredOwnerSelect(val)
                              }
                              placeholder="Choose recipient farmer..."
                            />

                            {selectedContextFarmerId !== null && (
                              <div className="jo-land-registry-transfer-mini-note">
                                The current owner is excluded to prevent
                                self-transfer.
                              </div>
                            )}
                          </div>
                        )}

                        {transferMode === "inheritance" && (
                          <div className="jo-land-registry-transfer-section-card">
                            <h4>Step 3: Select Heir / Recipient</h4>

                            <label className="jo-land-registry-transfer-label">
                              Heir / Recipient Farmer
                            </label>
                            <SearchableSelect
                              options={inheritanceOptions}
                              value={
                                selectedBeneficiaryOwner ? beneficairyOwnerId : ""
                              }
                              onChange={(val) =>
                                handleBeneficairyOwnerSelect(val)
                              }
                              placeholder="Choose heir (recipient)..."
                            />
                            {selectedContextFarmerId !== null && (
                              <div className="jo-land-registry-transfer-mini-note">
                                The current owner is excluded to prevent
                                self-transfer.
                              </div>
                            )}
                          </div>
                        )}

                        {/* ── Step 4: Proof ── */}
                        <div className="jo-land-registry-transfer-section-card">
                          <h4>Step 4: Proof</h4>
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

                        {/* ── Step 5: Review & Confirmation ── */}
                        <div className="jo-land-registry-transfer-section-card">
                          <h4>Step 5: Review & Confirmation</h4>
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
                                  {(transferMode === "inheritance"
                                    ? selectedBeneficiaryOwner?.name
                                    : selectedRegisteredOwner?.name) || (
                                      <em style={{ color: "#9ca3af" }}>
                                        Not selected
                                      </em>
                                    )}
                                </strong>
                                <span className="jo-land-registry-transfer-party-sub">
                                  Recipient
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* ── Review: Section 3 – Area, Parcels & Effectivity ── */}
                          {(() => {
                            // Live parcel rows: whichever parcels are checked
                            const reviewParcels = donorSplitParcels
                              .filter((p) =>
                                selectedTransferParcelIds.includes(
                                  p.farm_parcel_id,
                                ),
                              )
                              .map((p) => ({
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
                                  <span>Parcels Involved</span>
                                  <strong>
                                    {reviewParcels.length}
                                    {donorSplitParcels.length >
                                      reviewParcels.length && (
                                        <span
                                          style={{
                                            color: "#94a3b8",
                                            fontWeight: 400,
                                            fontSize: 11,
                                            marginLeft: 4,
                                          }}
                                        >
                                          of {donorSplitParcels.length} selected
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
                                ) : (
                                  <p
                                    style={{
                                      fontSize: 12,
                                      color: "#ef4444",
                                      margin: "4px 0 0",
                                      fontWeight: 500,
                                    }}
                                  >
                                    Please select at least one parcel to transfer.
                                  </p>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </>
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
                <h3>
                  {isFarmAnotherMode
                    ? `Farm Another Land (${ownerAffiliationRoleLabel})`
                    : `Update ${ownerAffiliationRoleLabel} Landowner`}
                </h3>
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
                    {isFarmAnotherMode
                      ? `Allows the farmer to farm on someone else's land as a ${ownerAffiliationRoleLabel.toLowerCase()}.`
                      : ownerAffiliationHasExistingLink
                        ? `Updates the linked landowner for this ${ownerAffiliationRoleLabel.toLowerCase()}. Legal ownership is not transferred.`
                        : `No linked landowner yet — select one below to create the first link.`}
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

                    <div className="jo-land-registry-step1-holder-row">
                      <div className="jo-land-registry-transfer-kv">
                        <span>Holder</span>
                        <strong>{selectedFarmer.farmer_name || "—"}</strong>
                      </div>
                      <span
                        className={`jo-land-registry-ownership-pill jo-land-registry-ownership-${ownerAffiliationRole}`}
                      >
                        {ownerAffiliationRoleLabel}
                      </span>
                    </div>

                    {!ownerAffiliationLoading &&
                      ownerAffiliationHasSingleSourceContext ? (
                      <div className="jo-land-registry-transfer-kv">
                        <span>Current Landowner</span>
                        <strong>
                          {selectedOwnerAffiliationSource?.ownerName || "—"}
                        </strong>
                      </div>
                    ) : isFarmAnotherMode ? (
                      <div className="jo-land-registry-transfer-kv" style={{ marginTop: "1rem" }}>
                        <span style={{ marginRight: "0.5rem" }}>Farming Role</span>
                        <select
                          className="jo-land-registry-transfer-select"
                          style={{ maxWidth: "160px", padding: "0.25rem", fontSize: "0.9rem", display: "inline-block" }}
                          value={ownerAffiliationRole}
                          onChange={(e) => {
                            const newRole = e.target.value as ReplacementRole;
                            setOwnerAffiliationRole(newRole);
                          }}
                          disabled={ownerAffiliationLoading || isSubmittingOwnerAffiliation}
                        >
                          <option value="tenant">Tenant</option>
                          <option value="lessee">Lessee</option>
                        </select>
                      </div>
                    ) : !ownerAffiliationHasExistingLink ? (
                      <div className="jo-land-registry-transfer-kv">
                        <span>Current Landowner</span>
                        <strong>None (no active link)</strong>
                      </div>
                    ) : (
                      <>
                        <label className="jo-land-registry-transfer-label">
                          Current Landowner
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
                        Loading parcel links...
                      </div>
                    )}

                    {!ownerAffiliationLoading &&
                      ownerAffiliationContextNote && (
                        <div className="jo-land-registry-transfer-mini-note">
                          {ownerAffiliationContextNote}
                        </div>
                      )}

                    {!ownerAffiliationLoading &&
                      selectedOwnerAffiliationSource && (
                        <div className="jo-land-registry-transfer-mini-note">
                          {selectedOwnerAffiliationSource.parcelCount} parcel
                          {selectedOwnerAffiliationSource.parcelCount === 1
                            ? ""
                            : "s"}{" "}
                          · {selectedOwnerAffiliationAreaHa.toFixed(2)} ha under
                          this agreement
                        </div>
                      )}
                  </div>

                  <div className="jo-land-registry-transfer-section-card">
                    <h4>Step 2: Select New Linked Landowner</h4>
                    <label className="jo-land-registry-transfer-label">
                      New Linked Landowner
                    </label>
                    <SearchableSelect
                      options={ownerAffiliationSelectableOptions}
                      value={ownerAffiliationNewOwnerId}
                      onChange={(val) =>
                        handleOwnerAffiliationNewOwnerChange(val)
                      }
                      placeholder="Choose new linked landowner..."
                      disabled={
                        ownerAffiliationLoading || isSubmittingOwnerAffiliation
                      }
                    />
                    {ownerAffiliationNewOwnerId === "" ? (
                      <div className="jo-land-registry-transfer-mini-note">
                        Select a new landowner above to continue.
                      </div>
                    ) : ownerAffiliationStep3Parcels.length > 0 ? (
                      <>
                        <div className="jo-land-registry-transfer-subheading">
                          Parcel(s) To Update
                        </div>
                        <div className="jo-land-registry-replacement-action-row">
                          <button
                            type="button"
                            className="jo-land-registry-replacement-button"
                            disabled={ownerAffiliationStep3Parcels.length === 0}
                            onClick={handleOwnerAffiliationSelectAllParcels}
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            className="jo-land-registry-replacement-button"
                            disabled={
                              ownerAffiliationSelectedParcelIds.length === 0
                            }
                            onClick={handleOwnerAffiliationClearSelectedParcels}
                          >
                            Clear
                          </button>
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
                                  {(() => {
                                    const cultivatorName = ownerAffiliationParcelCultivators[parcel.farmParcelId];
                                    // If still loading (key not present yet), show nothing
                                    if (!(parcel.farmParcelId in ownerAffiliationParcelCultivators)) return null;
                                    if (cultivatorName) {
                                      return (
                                        <div
                                          className="jo-land-registry-transfer-mini-note"
                                          style={{
                                            color: "#b45309",
                                            backgroundColor: "#fef3c7",
                                            padding: "0.25rem 0.5rem",
                                            borderRadius: "4px",
                                            marginTop: "0.25rem",
                                            marginBottom: "0.25rem",
                                            fontWeight: "600",
                                            display: "inline-block",
                                            border: "1px solid #fde68a"
                                          }}
                                        >
                                          ⚠️ Farmed by: {cultivatorName}
                                        </div>
                                      );
                                    }
                                    return (
                                      <div
                                        className="jo-land-registry-transfer-mini-note"
                                        style={{
                                          color: "#15803d",
                                          backgroundColor: "#f0fdf4",
                                          padding: "0.25rem 0.5rem",
                                          borderRadius: "4px",
                                          marginTop: "0.25rem",
                                          marginBottom: "0.25rem",
                                          fontWeight: "600",
                                          display: "inline-block",
                                          border: "1px solid #bbf7d0"
                                        }}
                                      >
                                        ✅ Owner-farmed (no current tenant)
                                      </div>
                                    );
                                  })()}
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

                        {ownerAffiliationSelectedParcelIds.length === 0 ? (
                          <div className="jo-land-registry-transfer-mini-note">
                            Select at least one parcel.
                          </div>
                        ) : (
                          <>
                            {ownerAffiliationTakeoverPlan.error && (
                              <div className="jo-land-registry-transfer-mini-note">
                                {ownerAffiliationTakeoverPlan.error}
                              </div>
                            )}

                            <div className="jo-land-registry-transfer-mini-note">
                              {ownerAffiliationTakeoverPlan.selectedParcelCount} parcel{ownerAffiliationTakeoverPlan.selectedParcelCount === 1 ? "" : "s"} · {ownerAffiliationTakeoverPlan.totalAreaHa.toFixed(2)} ha
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="jo-land-registry-transfer-mini-note">
                        No eligible parcels found. Try a different landowner.
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
                        Complete Steps 1–2 before uploading proof.
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
                      {isFarmAnotherMode ? (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "stretch",
                            padding: "1rem",
                            backgroundColor: "#f8fafc",
                            borderRadius: "8px",
                            border: "1px solid #e2e8f0",
                            marginBottom: "1rem",
                            gap: "1rem",
                          }}
                        >
                          {/* Farmer Card */}
                          <div
                            style={{
                              flex: 1,
                              background: "#fff",
                              border: "1px solid #cbd5e1",
                              borderRadius: "6px",
                              padding: "0.75rem 1rem",
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "center",
                            }}
                          >
                            <span
                              style={{
                                color: "#64748b",
                                fontSize: "0.7rem",
                                fontWeight: "700",
                                letterSpacing: "0.05em",
                                marginBottom: "0.25rem",
                              }}
                            >
                              FARMER
                            </span>
                            <strong
                              style={{
                                color: "#0f172a",
                                fontSize: "0.95rem",
                                fontWeight: "600",
                                marginBottom: "0.5rem",
                              }}
                            >
                              {selectedFarmer.farmer_name || "—"}
                            </strong>
                            <div>
                              <span
                                className={`jo-land-registry-ownership-pill jo-land-registry-ownership-${ownerAffiliationRole}`}
                                style={{ fontSize: "0.75rem", padding: "0.15rem 0.4rem" }}
                              >
                                {ownerAffiliationRoleLabel}
                              </span>
                            </div>
                          </div>

                          {/* Connection Arrow */}
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "center",
                              alignItems: "center",
                              minWidth: "70px",
                            }}
                          >
                            <span style={{ fontSize: "0.68rem", color: "#64748b", fontWeight: "700", marginBottom: "0.25rem" }}>
                              farming on
                            </span>
                            <span style={{ fontSize: "1.8rem", color: "#22c55e", lineHeight: "1" }}>
                              →
                            </span>
                          </div>

                          {/* Landowner Card */}
                          <div
                            style={{
                              flex: 1,
                              background: "#fff",
                              border: "1px solid #cbd5e1",
                              borderRadius: "6px",
                              padding: "0.75rem 1rem",
                              display: "flex",
                              flexDirection: "column",
                            }}
                          >
                            <span
                              style={{
                                color: "#64748b",
                                fontSize: "0.7rem",
                                fontWeight: "700",
                                letterSpacing: "0.05em",
                                marginBottom: "0.25rem",
                              }}
                            >
                              LANDOWNER
                            </span>
                            <strong
                              style={{
                                color: "#0f172a",
                                fontSize: "0.95rem",
                                fontWeight: "600",
                                marginBottom: "0.5rem",
                              }}
                            >
                              {selectedOwnerAffiliationNewOwner?.ownerName || "Not selected"}
                            </strong>
                            <div style={{ marginTop: "0.25rem" }}>
                              {ownerAffiliationPreviewParcels.length > 0 ? (
                                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                                  {ownerAffiliationPreviewParcels.map((parcel) => (
                                    <li
                                      key={`preview-card-parcel-${parcel.farmParcelId}`}
                                      style={{
                                        fontSize: "0.8rem",
                                        color: "#334155",
                                        marginBottom: "0.25rem",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        background: "#f1f5f9",
                                        padding: "0.2rem 0.4rem",
                                        borderRadius: "4px",
                                      }}
                                    >
                                      <span style={{ fontWeight: "600" }}>
                                        {parcel.parcelNumber || `Parcel #${parcel.farmParcelId}`}
                                      </span>
                                      <span style={{ color: "#64748b" }}>
                                        {parcel.selectedAreaHa.toFixed(2)} ha
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span style={{ fontSize: "0.8rem", color: "#94a3b8", fontStyle: "italic" }}>
                                  No parcels selected yet
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="jo-land-registry-transfer-flow-row">
                            <div className="jo-land-registry-transfer-party">
                              <span className="jo-land-registry-transfer-party-label">
                                CURRENT OWNER
                              </span>
                              <strong className="jo-land-registry-transfer-party-name">
                                {selectedOwnerAffiliationSource?.ownerName ||
                                  (ownerAffiliationHasExistingLink
                                    ? "Not selected"
                                    : "None (new link)")}
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
                        </>
                      )}

                      {!isFarmAnotherMode && (
                        <>
                          <div className="jo-land-registry-transfer-kv">
                            <span>Role</span>
                            <strong>{ownerAffiliationRoleLabel}</strong>
                          </div>
                          {ownerAffiliationTakeoverModeLabel && (
                            <div className="jo-land-registry-transfer-kv">
                              <span>Scope</span>
                              <strong>{ownerAffiliationTakeoverModeLabel}</strong>
                            </div>
                          )}

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
                        </>
                      )}
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
                    The {ownerAffiliationRoleLabel.toLowerCase()} holder stays the same — only the linked landowner changes.
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
