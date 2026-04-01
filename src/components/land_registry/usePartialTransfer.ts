// usePartialTransfer.ts
// Drop-in hook that manages all state/logic for the per-parcel partial-split UI.
// Import and spread into JoLandRegistry to keep the main file clean.

import { useState, useCallback } from "react";
import { supabase } from "../../supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PartialSplitRpcResult {
  new_parcel_id: number;
  new_parcel_number: string;
  donor_remaining_ha: number;
  recipient_area_ha: number;
  transfer_id: number;
}

export interface ParcelSplitInput {
  farm_parcel_id: number; // rsbsa_farm_parcels.id
  parcel_number: string;
  farm_location_barangay: string;
  total_farm_area_ha: number; // current area (donor side)
  transfer_area_ha: number | ""; // user input: portion being transferred
}

export interface TransferProofUpload {
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
}

export type ParcelTransferScope = "full" | "partial";

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePartialTransfer() {
  // "full" = full parcel transfer (existing flow)
  // "partial" = new split flow, per-parcel area inputs
  const [parcelScope, setParcelScope] = useState<ParcelTransferScope>("full");

  // Map of farm_parcel_id → the ha the user wants to transfer
  const [parcelSplitInputs, setParcelSplitInputs] = useState<
    Record<number, number | "">
  >({});

  const [partialSubmitting, setPartialSubmitting] = useState(false);
  const [partialError, setPartialError] = useState("");
  const [partialSuccess, setPartialSuccess] = useState("");

  // ── Helpers ───────────────────────────────────────────────

  /** Update one parcel's transfer-area input */
  const setParcelTransferArea = useCallback(
    (farmParcelId: number, value: number | "") => {
      setParcelSplitInputs((prev) => ({ ...prev, [farmParcelId]: value }));
    },
    [],
  );

  /** Seed the split inputs from an array of parcels (called when donor changes) */
  const initSplitInputs = useCallback((parcels: ParcelSplitInput[]) => {
    const init: Record<number, number | ""> = {};
    parcels.forEach((p) => {
      init[p.farm_parcel_id] = ""; // blank = user must fill in
    });
    setParcelSplitInputs(init);
  }, []);

  const resetPartialState = useCallback(() => {
    setParcelScope("full");
    setParcelSplitInputs({});
    setPartialError("");
    setPartialSuccess("");
    setPartialSubmitting(false);
  }, []);

  // ── Validation ────────────────────────────────────────────

  /**
   * Returns a human-readable error string if any split input is invalid,
   * or "" if everything is OK.
   */
  const validateSplitInputs = useCallback(
    (parcels: ParcelSplitInput[]): string => {
      if (parcelScope !== "partial") return "";

      const activeParcels = parcels.filter((p) => {
        const input = parcelSplitInputs[p.farm_parcel_id];
        return input !== "" && input !== undefined;
      });

      if (activeParcels.length === 0) {
        return "Enter the transfer area (ha) for at least one parcel.";
      }

      for (const p of activeParcels) {
        const input = parcelSplitInputs[p.farm_parcel_id];
        if (input === "" || input === undefined) continue;
        const ha = Number(input);

        if (!Number.isFinite(ha) || ha <= 0) {
          return `Parcel ${p.parcel_number}: transfer area must be greater than 0.`;
        }
        if (ha >= p.total_farm_area_ha) {
          return (
            `Parcel ${p.parcel_number}: transfer area (${ha} ha) must be ` +
            `less than the full parcel area (${p.total_farm_area_ha} ha). ` +
            `Use "Full Parcel" mode to transfer the entire parcel.`
          );
        }
        // Round-trip precision guard
        const rounded = Math.round(ha * 10000) / 10000;
        if (rounded !== ha) {
          return `Parcel ${p.parcel_number}: max 4 decimal places allowed.`;
        }
      }

      return "";
    },
    [parcelScope, parcelSplitInputs],
  );

  // ── RPC call ──────────────────────────────────────────────

  /**
   * Executes partial transfers for all parcels that have a non-empty input.
   * Calls the Postgres RPC once per parcel (atomic per parcel).
   */
  const executePartialTransfers = useCallback(
    async (params: {
      parcels: ParcelSplitInput[];
      donorFarmerId: number;
      recipientFarmerId: number;
      transferMode: "voluntary" | "inheritance";
      transferReason: string;
      transferDate: string; // YYYY-MM-DD
      uploadedProofs: TransferProofUpload[];
    }): Promise<PartialSplitRpcResult[]> => {
      const {
        parcels,
        donorFarmerId,
        recipientFarmerId,
        transferMode,
        transferReason,
        transferDate,
        uploadedProofs,
      } = params;

      setPartialSubmitting(true);
      setPartialError("");
      setPartialSuccess("");

      const results: PartialSplitRpcResult[] = [];

      try {
        const activeParcels = parcels.filter((p) => {
          const input = parcelSplitInputs[p.farm_parcel_id];
          return input !== "" && input !== undefined;
        });

        if (activeParcels.length === 0) {
          throw new Error(
            "Enter the transfer area (ha) for at least one parcel.",
          );
        }

        for (const parcel of activeParcels) {
          const rawInput = parcelSplitInputs[parcel.farm_parcel_id];
          const transferAreaHa = Number(rawInput);

          if (!Number.isFinite(transferAreaHa) || transferAreaHa <= 0) {
            throw new Error(
              `Parcel ${parcel.parcel_number}: transfer area must be greater than 0.`,
            );
          }

          const { data, error } = await supabase.rpc(
            "execute_partial_parcel_transfer",
            {
              p_farm_parcel_id: parcel.farm_parcel_id,
              p_donor_farmer_id: donorFarmerId,
              p_recipient_farmer_id: recipientFarmerId,
              p_transfer_area_ha: transferAreaHa,
              p_transfer_mode: transferMode,
              p_transfer_reason: transferReason || null,
              p_transfer_date: transferDate,
              p_proofs: uploadedProofs,
            },
          );

          if (error) {
            // Map PG error codes to friendly messages
            const msg = error.message || "";
            if (/P0001/.test(msg) || /positive number/.test(msg)) {
              throw new Error(
                `Parcel ${parcel.parcel_number}: transfer area must be greater than 0.`,
              );
            }
            if (/P0002/.test(msg) || /not found/.test(msg)) {
              throw new Error(
                `Parcel ${parcel.parcel_number} (ID ${parcel.farm_parcel_id}) was not found in the database. Refresh and try again.`,
              );
            }
            if (/P0003/.test(msg) || /does not belong/.test(msg)) {
              throw new Error(
                `Parcel ${parcel.parcel_number} ownership has changed. Refresh and try again.`,
              );
            }
            if (/P0004/.test(msg) || /must be less than/.test(msg)) {
              throw new Error(
                `Parcel ${parcel.parcel_number}: partial area must be strictly less than the full parcel area. Switch to "Full Parcel" mode if you want to transfer everything.`,
              );
            }
            throw new Error(
              `Parcel ${parcel.parcel_number}: ${msg || "Unknown error from server."}`,
            );
          }

          // data is an array of one row from RETURNS TABLE
          const row = Array.isArray(data) ? data[0] : data;
          if (row) results.push(row as PartialSplitRpcResult);
        }

        setPartialSuccess(
          `Partial transfer complete. ${results.length} parcel(s) split successfully.`,
        );
        return results;
      } finally {
        setPartialSubmitting(false);
      }
    },
    [parcelSplitInputs],
  );

  return {
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
    partialSuccess,
  };
}
