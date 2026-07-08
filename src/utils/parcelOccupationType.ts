export type ParcelOccupationType =
  | "land-owner"
  | "owner-farmed"
  | "tenant"
  | "lessee"
  | "tenant+lessee";

interface ParcelOccupationInput {
  registeredOwner?: boolean | null;
  tenant?: boolean | null;
  lessee?: boolean | null;
  isCultivating?: boolean | null;
  isFarming?: boolean | null;
  occupants?: Array<{ role?: string | null }>;
}

export const getParcelOccupationType = ({
  registeredOwner,
  tenant,
  lessee,
  isCultivating,
  isFarming,
  occupants = [],
}: ParcelOccupationInput): ParcelOccupationType => {
  const hasTenant =
    tenant === true ||
    occupants.some((o) => o.role === "tenant" || o.role === "tenant+lessee");
  const hasLessee =
    lessee === true ||
    occupants.some((o) => o.role === "lessee" || o.role === "tenant+lessee");

  if (hasTenant && hasLessee) return "tenant+lessee";
  if (hasTenant) return "tenant";
  if (hasLessee) return "lessee";

  if (registeredOwner === true) {
    const isCultivatingParcel = isCultivating === true || isFarming === true;
    return isCultivatingParcel ? "owner-farmed" : "land-owner";
  }

  return "land-owner";
};
