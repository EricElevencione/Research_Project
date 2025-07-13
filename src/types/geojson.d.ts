export type FarmParcel = {
    parcelNumber: number;
    farmLocation: {
        barangay: string;
        cityMunicipality: string;
    };
    totalFarmArea: string;
    withinAncestralDomain: string;
    agrarianReformBeneficiary: string;
    ownershipDocumentNo: string;
    ownershipType: {
        registeredOwner: boolean;
        tenant: boolean;
        tenantLandOwner: string;
        lessee: boolean;
        lesseeLandOwner: string;
        others: boolean;
        othersSpecify: string;
    };
    cropCommodity: string;
    size: string;
    numberOfHead: string;
    farmType: string;
    organicPractitioner: string;
    remarks: string;
};

declare module '*.geojson' {
    const value: any;
    export default value;
}