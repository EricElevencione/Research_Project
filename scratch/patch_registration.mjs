import fs from 'fs';

const filePath = 'src/screens/JO/JoRsbsaRegistration.tsx';
let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

// 1. Tenant input onChange helper
const tenantOnChangeTarget = `                                      setParcelFarmerSearchTerm((prev) => ({
                                        ...prev,
                                        [pid]: val,
                                      }));
                                      setOwnedParcelFarmerName((prev) => ({
                                        ...prev,
                                        [pid]: val,
                                      }));
                                      setShowParcelFarmerDropdown((prev) => ({
                                        ...prev,
                                        [pid]: true,
                                      }));`;

const tenantOnChangeReplacement = `                                      setParcelFarmerSearchTerm((prev) => ({
                                        ...prev,
                                        [pid]: val,
                                      }));
                                      setOwnedParcelFarmerName((prev) => ({
                                        ...prev,
                                        [pid]: val,
                                      }));
                                      setOwnedParcelFarmerId((prev) => {
                                        const next = { ...prev };
                                        delete next[pid];
                                        return next;
                                      });
                                      setShowParcelFarmerDropdown((prev) => ({
                                        ...prev,
                                        [pid]: true,
                                      }));`;

if (!content.includes(tenantOnChangeTarget)) {
  console.error("tenantOnChangeTarget not found!");
  process.exit(1);
}
content = content.replace(tenantOnChangeTarget, tenantOnChangeReplacement);

// 2. Tenant click helper
const tenantClickTarget = `                                              onClick={() => {
                                                setOwnedParcelFarmerName(
                                                  (prev) => ({
                                                    ...prev,
                                                    [pid]: f.name,
                                                  }),
                                                );`;

const tenantClickReplacement = `                                              onClick={() => {
                                                setOwnedParcelFarmerName(
                                                  (prev) => ({
                                                    ...prev,
                                                    [pid]: f.name,
                                                  }),
                                                );
                                                setOwnedParcelFarmerId(
                                                  (prev) => ({
                                                    ...prev,
                                                    [pid]: f.id,
                                                  }),
                                                );`;

if (!content.includes(tenantClickTarget)) {
  console.error("tenantClickTarget not found!");
  process.exit(1);
}
content = content.replace(tenantClickTarget, tenantClickReplacement);

// 3. Lessee input onChange helper
const lesseeOnChangeTarget = `                                        setParcelFarmerSearchTerm((prev) => ({
                                          ...prev,
                                          [pid]: val,
                                        }));
                                        setOwnedParcelFarmerName((prev) => ({
                                          ...prev,
                                          [pid]: val,
                                        }));
                                        setShowParcelFarmerDropdown((prev) => ({
                                          ...prev,
                                          [pid]: true,
                                        }));`;

const lesseeOnChangeReplacement = `                                        setParcelFarmerSearchTerm((prev) => ({
                                          ...prev,
                                          [pid]: val,
                                        }));
                                        setOwnedParcelFarmerName((prev) => ({
                                          ...prev,
                                          [pid]: val,
                                        }));
                                        setOwnedParcelFarmerId((prev) => {
                                          const next = { ...prev };
                                          delete next[pid];
                                          return next;
                                        });
                                        setShowParcelFarmerDropdown((prev) => ({
                                          ...prev,
                                          [pid]: true,
                                        }));`;

if (!content.includes(lesseeOnChangeTarget)) {
  console.error("lesseeOnChangeTarget not found!");
  process.exit(1);
}
content = content.replace(lesseeOnChangeTarget, lesseeOnChangeReplacement);

// 4. Lessee click helper
const lesseeClickTarget = `                                                onClick={() => {
                                                  setOwnedParcelFarmerName(
                                                    (prev) => ({
                                                      ...prev,
                                                      [pid]: f.name,
                                                    }),
                                                  );`;

const lesseeClickReplacement = `                                                onClick={() => {
                                                  setOwnedParcelFarmerName(
                                                    (prev) => ({
                                                      ...prev,
                                                      [pid]: f.name,
                                                    }),
                                                  );
                                                  setOwnedParcelFarmerId(
                                                    (prev) => ({
                                                      ...prev,
                                                      [pid]: f.id,
                                                    }),
                                                  );`;

if (!content.includes(lesseeClickTarget)) {
  console.error("lesseeClickTarget not found!");
  process.exit(1);
}
content = content.replace(lesseeClickTarget, lesseeClickReplacement);

// 5. applyOwnedParcels mapper
const applyOwnedParcelsTarget = `        isCultivating: status === "self",
        ownershipTypeRegisteredOwner: true,
        ownershipTypeTenant: false,
        ownershipTypeLessee: false,
        ownershipTypeOthers: false,
        tenantLandOwnerName:
          status === "tenant" ? ownedParcelFarmerName[pid] || "" : "",
        lesseeLandOwnerName:
          status === "lessee" ? ownedParcelFarmerName[pid] || "" : "",
        ownershipOthersSpecify: "",`;

const applyOwnedParcelsReplacement = `        isCultivating: status === "self",
        cultivatorSubmissionId:
          status !== "self" ? ownedParcelFarmerId[pid] || null : null,
        cultivationStatusReason:
          status === "tenant"
            ? "Cultivated by tenant: " + (ownedParcelFarmerName[pid] || "")
            : status === "lessee"
              ? "Cultivated by lessee: " + (ownedParcelFarmerName[pid] || "")
              : "",
        ownershipTypeRegisteredOwner: true,
        ownershipTypeTenant: false,
        ownershipTypeLessee: false,
        ownershipTypeOthers: false,
        tenantLandOwnerName: "",
        lesseeLandOwnerName: "",
        ownershipOthersSpecify: "",`;

if (!content.includes(applyOwnedParcelsTarget)) {
  console.error("applyOwnedParcelsTarget not found!");
  process.exit(1);
}
content = content.replace(applyOwnedParcelsTarget, applyOwnedParcelsReplacement);

// 6. extra mapping in applyOwnedParcels
const extraMappingTarget = `          ownershipTypeRegisteredOwner: false,
          ownershipTypeTenant: isTenant,
          ownershipTypeLessee: isLessee,
          ownershipTypeOthers: false,
          tenantLandOwnerName: isTenant ? selectedLandOwner.name : "",
          lesseeLandOwnerName: isLessee ? selectedLandOwner.name : "",
          ownershipOthersSpecify: "",`;

const extraMappingReplacement = `          ownershipTypeRegisteredOwner: false,
          ownershipTypeTenant: isTenant,
          ownershipTypeLessee: isLessee,
          ownershipTypeOthers: false,
          tenantLandOwnerName: isTenant ? selectedLandOwner.name : "",
          lesseeLandOwnerName: isLessee ? selectedLandOwner.name : "",
          tenantLandOwnerId: isTenant ? Number(selectedLandOwner.id) : null,
          lesseeLandOwnerId: isLessee ? Number(selectedLandOwner.id) : null,
          ownershipOthersSpecify: "",`;

if (!content.includes(extraMappingTarget)) {
  console.error("extraMappingTarget not found!");
  process.exit(1);
}
content = content.replace(extraMappingTarget, extraMappingReplacement);

// 7. applySelectedParcels
const applySelectedParcelsTarget = `          ownershipTypeRegisteredOwner: false,
          ownershipTypeTenant: isTenant,
          ownershipTypeLessee: isLessee,
          ownershipTypeOthers: false,
          tenantLandOwnerName: isTenant ? selectedLandOwner.name : "",
          lesseeLandOwnerName: isLessee ? selectedLandOwner.name : "",
          ownershipOthersSpecify: "",`;

const applySelectedParcelsReplacement = `          ownershipTypeRegisteredOwner: false,
          ownershipTypeTenant: isTenant,
          ownershipTypeLessee: isLessee,
          ownershipTypeOthers: false,
          tenantLandOwnerName: isTenant ? selectedLandOwner.name : "",
          lesseeLandOwnerName: isLessee ? selectedLandOwner.name : "",
          tenantLandOwnerId: isTenant ? Number(selectedLandOwner.id) : null,
          lesseeLandOwnerId: isLessee ? Number(selectedLandOwner.id) : null,
          ownershipOthersSpecify: "",`;

if (!content.includes(applySelectedParcelsTarget)) {
  console.error("applySelectedParcelsTarget not found!");
  process.exit(1);
}
content = content.replace(applySelectedParcelsTarget, applySelectedParcelsReplacement);

fs.writeFileSync(filePath, content, 'utf8');
console.log("JoRsbsaRegistration.tsx successfully updated!");
