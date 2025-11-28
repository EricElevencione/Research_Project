# DSS (Decision Support System) Scripts

This folder contains all DSS-related computation scripts, engines, and knowledge bases for the agricultural distribution system.

## 📁 Folder Structure

```
dss-scripts/
├── checks/              # Database verification scripts
│   ├── check_allocations.js
│   ├── check_approved_requests.js
│   └── check_distribution.js
│
├── tests/               # DSS testing and validation scripts
│   ├── test_dss.js
│   ├── test_dss_real.js
│   ├── test-alternatives.js
│   └── review_gap_calculation.js
│
├── engines/             # Core DSS computation engines
│   ├── alternativeEngine.cjs        # Suggests fertilizer alternatives
│   └── recommendationEngine.cjs     # Generates smart recommendations
│
└── knowledge/           # Knowledge bases and data
    └── fertilizerEquivalency.json   # Fertilizer conversion formulas
```

## 🔧 Scripts Description

### Checks (checks/)
- **check_allocations.js** - Verifies regional allocations table structure and data
- **check_approved_requests.js** - Reviews approved farmer requests
- **check_distribution.js** - Validates distribution records

### Tests (tests/)
- **test_dss.js** - Basic DSS functionality tests
- **test_dss_real.js** - Tests with real database data
- **test-alternatives.js** - Tests alternative suggestion engine
- **review_gap_calculation.js** - Validates gap analysis calculations

### Engines (engines/)
- **alternativeEngine.cjs** - Suggests fertilizer substitutions when stock is insufficient
  - Uses agronomic equivalency formulas
  - Provides confidence scores and Tagalog instructions
  - Integrated into farmer request workflow

- **recommendationEngine.cjs** - Analyzes gap data to generate recommendations
  - Detects shortages, surpluses, equity issues
  - Prioritizes actions (CRITICAL/HIGH/MEDIUM/LOW)
  - Provides actionable implementation steps

### Knowledge (knowledge/)
- **fertilizerEquivalency.json** - Comprehensive fertilizer knowledge base
  - NPK conversion factors
  - Crop-specific recommendations
  - Application guidelines in Tagalog

## 🚀 Usage

### Running Check Scripts
```bash
node backend/dss-scripts/checks/check_allocations.js
node backend/dss-scripts/checks/check_distribution.js
```

### Running Test Scripts
```bash
node backend/dss-scripts/tests/test_dss_real.js
node backend/dss-scripts/tests/review_gap_calculation.js
```

### Using Engines in Server
The engines are imported in `backend/server.cjs`:
```javascript
const FertilizerAlternativeEngine = require('./dss-scripts/engines/alternativeEngine.cjs');
const RecommendationEngine = require('./dss-scripts/engines/recommendationEngine.cjs');
```

## 📊 API Endpoints Using DSS

- `POST /api/distribution/suggest-alternatives` - Uses alternativeEngine
- `GET /api/distribution/recommendations/:season` - Uses recommendationEngine
- `GET /api/distribution/gap-analysis/:season` - Feeds data to recommendation engine

## 🔄 Dependencies

All scripts use the PostgreSQL database connection:
```javascript
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'Masterlist',
    password: 'postgresadmin',
    port: 5432
});
```

## 📝 Notes

- All engines use Node.js CommonJS format (.cjs)
- Knowledge base is in JSON format for easy updates
- Scripts are standalone - can be run independently for debugging
- Engines are integrated into main server for production use

---

**Last Updated**: November 28, 2025
**DSS Version**: 1.0 (Week 1 Implementation Complete)
