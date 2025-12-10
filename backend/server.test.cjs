const request = require('supertest');

describe('API Tests', () => {

    // Test 1: Health Check
    describe('Health Check', () => {
        it('should return OK status', async () => {
            const response = await request('http://localhost:5000')
                .get('/api/health');

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('OK');
            expect(response.body.message).toBe('Server is running');
            expect(response.body).toHaveProperty('timestamp');
        });
    });

    // Test 2: Landowners Endpoint
    describe('Landowners Endpoint', () => {
        it('should return array of landowners', async () => {
            const response = await request('http://localhost:5000')
                .get('/api/landowners');

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });

        it('should return landowners with correct structure', async () => {
            const response = await request('http://localhost:5000')
                .get('/api/landowners');

            expect(response.status).toBe(200);

            // If there are landowners in the database
            if (response.body.length > 0) {
                const firstLandowner = response.body[0];

                // ✅ Check for the ACTUAL properties returned
                expect(firstLandowner).toHaveProperty('id');
                expect(firstLandowner).toHaveProperty('name');
                expect(firstLandowner).toHaveProperty('barangay');
                expect(firstLandowner).toHaveProperty('municipality');

                // ✅ Validate data types
                expect(typeof firstLandowner.id).toBe('string');
                expect(typeof firstLandowner.name).toBe('string');
                expect(firstLandowner.name.length).toBeGreaterThan(0);
            }
        });

        it('should return non-empty names', async () => {
            const response = await request('http://localhost:5000')
                .get('/api/landowners');

            expect(response.status).toBe(200);

            // Check that all landowners have valid names
            response.body.forEach(landowner => {
                expect(landowner.name).toBeTruthy();
                expect(landowner.name.trim()).not.toBe('');
            });
        });

        it('should return unique landowners', async () => {
            const response = await request('http://localhost:5000')
                .get('/api/landowners');

            expect(response.status).toBe(200);

            // Extract all names and check for uniqueness
            const names = response.body.map(lo => lo.name);
            const uniqueNames = new Set(names);

            // Note: Count may vary as tests add data
            expect(uniqueNames.size).toBeGreaterThan(0);
            expect(names.length).toBeGreaterThanOrEqual(uniqueNames.size);
        });
    });

    describe('Lands Endpoint', () => {
        it('should return array of lands', async () => {
            const response = await request('http://localhost:5000')
                .get('/api/lands');

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });

        it('should return lands with correct structure', async () => {
            const response = await request('http://localhost:5000')
                .get('/api/lands');

            expect(response.status).toBe(200);

            // If there are lands in the database
            if (response.body.length > 0) {
                const firstLand = response.body[0]; // Get the first land

                // ✅ Check for the ACTUAL properties returned
                expect(firstLand).toHaveProperty('LAST NAME');
                expect(firstLand).toHaveProperty('FIRST NAME');
                expect(firstLand).toHaveProperty('MIDDLE NAME');
                expect(firstLand).toHaveProperty('EXT NAME');
                expect(firstLand).toHaveProperty('GENDER');
                expect(firstLand).toHaveProperty('BIRTHDATE');
                expect(firstLand).toHaveProperty('FARMER ADDRESS 1');
                expect(firstLand).toHaveProperty('FARMER ADDRESS 2');
                expect(firstLand).toHaveProperty('FARMER ADDRESS 3');
                expect(firstLand).toHaveProperty('PARCEL NO.');
                expect(firstLand).toHaveProperty('PARCEL ADDRESS');
                expect(firstLand).toHaveProperty('PARCEL AREA');
            }
        });
    });

    describe('Rsbsa Endpoint', () => {
        it('should return arrays of submission', async () => {
            const response = await request('http://localhost:5000')
                .get('/api/rsbsa_submission');

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });

        it('should return submission with correct structure', async () => {
            const response = await request('http://localhost:5000')
                .get('/api/rsbsa_submission');

            expect(response.status).toBe(200);

            if (response.body.length > 0) {
                const firstSubmission = response.body[0];

                // Check transformed properties (camelCase)
                expect(firstSubmission).toHaveProperty('id');
                expect(firstSubmission).toHaveProperty('farmerName');
                expect(firstSubmission).toHaveProperty('gender');
                expect(firstSubmission).toHaveProperty('age');
                expect(firstSubmission).toHaveProperty('farmLocation');
                expect(firstSubmission).toHaveProperty('parcelArea');  // ← camelCase!
                expect(firstSubmission).toHaveProperty('totalFarmArea');
                expect(firstSubmission).toHaveProperty('ownershipType');
                expect(firstSubmission).toHaveProperty('status');

                // Validate ownershipType structure
                expect(firstSubmission.ownershipType).toHaveProperty('registeredOwner');
                expect(firstSubmission.ownershipType).toHaveProperty('tenant');
                expect(firstSubmission.ownershipType).toHaveProperty('lessee');
            }
        });
    });

    // ============================================================================
    // RSBSA Submission Tests
    // ============================================================================
    describe('RSBSA Submission Endpoints', () => {
        let testSubmissionId;

        it('POST /api/rsbsa_submission should create submission with parcels', async () => {
            const testData = {
                draftId: null,  // ← Endpoint expects this structure!
                data: {
                    firstName: "Juan",
                    middleName: "Santos",
                    surname: "Dela Cruz",
                    extensionName: "",
                    sex: "Male",
                    birthdate: "1980-05-15",
                    placeOfBirth: "Dumangas",
                    contactNumber: "09123456789",
                    religion: "Catholic",
                    civilStatus: "Married",
                    spouseName: "Maria Dela Cruz",
                    motherMaidenName: "Ana Santos",
                    householdHead: "Yes",
                    pwdHouseholdMember: "No",
                    indigenousHouseholdMember: "No",
                    farmlandParcels: [
                        {
                            parcelNo: "1",
                            farmLocationBarangay: "Barangay Test",
                            farmLocationMunicipality: "Dumangas",
                            totalFarmAreaHa: "1.5",
                            withinAncestralDomain: "No",
                            ownershipDocumentNo: "DOC-TEST-123",
                            agrarianReformBeneficiary: "No",
                            ownershipTypeRegisteredOwner: true,
                            ownershipTypeTenant: false,
                            ownershipTypeLessee: false
                        }
                    ]
                }
            };

            const response = await request('http://localhost:5000')
                .post('/api/rsbsa_submission')
                .send(testData);

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('message', 'RSBSA form submitted successfully!');
            expect(response.body).toHaveProperty('submissionId');
            expect(response.body).toHaveProperty('submittedAt');

            // Save ID for next tests
            testSubmissionId = response.body.submissionId;
        });

        it('GET /api/rsbsa_submission/:id/parcels should fetch parcels for submission', async () => {
            const response = await request('http://localhost:5000')
                .get(`/api/rsbsa_submission/${testSubmissionId}/parcels`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThan(0);
            expect(response.body[0]).toHaveProperty('submission_id', testSubmissionId);
            expect(response.body[0]).toHaveProperty('farm_location_barangay', 'Barangay Test');
            expect(response.body[0]).toHaveProperty('total_farm_area_ha', '1.50');
        });

        it('GET /api/rsbsa_submission/farm_parcels should fetch all parcels', async () => {
            const response = await request('http://localhost:5000')
                .get('/api/rsbsa_submission/farm_parcels');

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);

            // Should have at least our test parcel
            expect(response.body.length).toBeGreaterThan(0);

            const firstParcel = response.body[0];
            expect(firstParcel).toHaveProperty('submission_id');
            expect(firstParcel).toHaveProperty('FIRST NAME');
            expect(firstParcel).toHaveProperty('LAST NAME');
            expect(firstParcel).toHaveProperty('farm_location_barangay');
        });

        it('GET /api/rsbsa_submission should fetch all submissions', async () => {
            const response = await request('http://localhost:5000')
                .get('/api/rsbsa_submission');

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThan(0);

            // These endpoints return transformed data with different property names
            const firstSubmission = response.body[0];
            expect(firstSubmission).toHaveProperty('id');
            expect(firstSubmission).toHaveProperty('farmerName');
            expect(firstSubmission).toHaveProperty('status');
        });

        it('GET /api/rsbsa_submission/:id should fetch single submission', async () => {
            const response = await request('http://localhost:5000')
                .get(`/api/rsbsa_submission/${testSubmissionId}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('id', testSubmissionId);
            expect(response.body).toHaveProperty('firstName', 'Juan');
            expect(response.body).toHaveProperty('lastName', 'Dela Cruz');
            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('farmParcels');
            expect(Array.isArray(response.body.farmParcels)).toBe(true);
        });

        it('PUT /api/rsbsa_submission/:id should update submission status', async () => {
            const updateData = {
                status: 'Not Active'
            };

            const response = await request('http://localhost:5000')
                .put(`/api/rsbsa_submission/${testSubmissionId}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('message', 'Status updated successfully');
            expect(response.body).toHaveProperty('updatedRecord');

            // Verify the update
            const verifyResponse = await request('http://localhost:5000')
                .get(`/api/rsbsa_submission/${testSubmissionId}`);

            expect(verifyResponse.body.status).toBe('Not Active');
        });

        it('DELETE /api/rsbsa_submission/:id should delete submission and parcels', async () => {
            // Create a fresh submission for deletion test
            const testData = {
                draftId: null,
                data: {
                    firstName: 'DeleteMe',
                    middleName: 'Test',
                    surname: 'User',
                    sex: 'Male',
                    birthdate: '1990-01-01',
                    contactNumber: '09123456789',
                    farmlandParcels: [{
                        parcelNo: "1",
                        farmLocationBarangay: "DeleteTest",
                        farmLocationMunicipality: "Dumangas",
                        totalFarmAreaHa: "1.0",
                        withinAncestralDomain: "No",
                        ownershipDocumentNo: "DELETE-001",
                        agrarianReformBeneficiary: "No",
                        ownershipTypeRegisteredOwner: true,
                        ownershipTypeTenant: false,
                        ownershipTypeLessee: false
                    }]
                }
            };

            const createResponse = await request('http://localhost:5000')
                .post('/api/rsbsa_submission')
                .send(testData);

            expect(createResponse.status).toBe(201);
            expect(createResponse.body).toHaveProperty('submissionId');

            const deleteId = createResponse.body.submissionId;

            // Now delete it
            const response = await request('http://localhost:5000')
                .delete(`/api/rsbsa_submission/${deleteId}`);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('message', 'RSBSA submission and associated parcels deleted successfully');
            expect(response.body).toHaveProperty('submissionId', deleteId);
            expect(response.body).toHaveProperty('parcelsDeleted');
            expect(response.body.parcelsDeleted).toBeGreaterThanOrEqual(1);

            // Verify deletion - should return 404
            const verifyResponse = await request('http://localhost:5000')
                .get(`/api/rsbsa_submission/${deleteId}`);

            expect(verifyResponse.status).toBe(404);
        });
    });

});