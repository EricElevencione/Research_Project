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

            // Check for duplicates
            const names = response.body.map(lo => lo.name);
            const uniqueNames = new Set(names);

            expect(names.length).toBe(uniqueNames.size);
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

});