interface BarangayCode {
    [key: string]: string;
}

// Mapping of barangay names to their respective codes
const barangayCodes: BarangayCode = {
    "Aurora-Del Pilar": "001",
    "Bacay": "002",
    "Bacong": "003",
    "Balabag": "004",
    "Balud": "005",
    "Bantud": "006",
    "Bantud Fabrica": "007",
    "Binaobawan": "008",
    "Bolilao": "009",
    "Cabilao Grande": "010",
    "Cabilao Pequeño": "011",
    "Calao": "012",
    "Dumangas": "013",
    "Ilaya": "014",
    "Jalaud": "015",
    "Lacturan": "016",
    "Lawa-an": "017",
    "Paco": "018",
    "Paloc Bigque": "019",
    "Pulao": "020",
    "Sapao": "021",
    "Tabucan": "022",
    "Taminla": "023",
    "Tiring": "024",
    "Victoria": "025",
    "Zaldivar": "026"
};

/**
 * Generates an FFRS System Code following the format: 06-30-18-XXX-YYYYYY
 * @param barangayName - The name of the barangay
 * @returns The generated FFRS System Code
 */
export const generateFFRSCode = (barangayName: string): string => {
    // Fixed establishment code
    const establishmentCode = "06-30-18";

    // Get barangay code from the mapping
    const barangayCode = barangayCodes[barangayName] || "000";

    // Generate a random 6-digit person code
    const personCode = String(Math.floor(Math.random() * 999999)).padStart(6, "0");

    // Combine all parts to form the FFRS code
    return `${establishmentCode}-${barangayCode}-${personCode}`;
};

/**
 * Validates if the given FFRS code follows the correct format
 * @param code - The FFRS code to validate
 * @returns boolean indicating if the code is valid
 */
export const isValidFFRSCode = (code: string): boolean => {
    const pattern = /^06-30-18-\d{3}-\d{6}$/;
    return pattern.test(code);
};

/**
 * Gets the barangay name from an FFRS code
 * @param code - The FFRS code
 * @returns The barangay name or null if not found
 */
export const getBarangayFromFFRSCode = (code: string): string | null => {
    if (!isValidFFRSCode(code)) return null;

    const barangayCode = code.split("-")[3];
    const entries = Object.entries(barangayCodes);
    const barangayEntry = entries.find(([_, code]) => code === barangayCode);

    return barangayEntry ? barangayEntry[0] : null;
};