import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FarmlandMap from '../../components/Map/FarmlandMap';
import '../../assets/css/Incentives.css';

// Types for the incentives system
interface Farmer {
    id: string;
    firstName: string;
    middleName: string;
    surname: string;
    gender: 'Male' | 'Female';
    area: number;
    status: 'Tenant' | 'Land Owner' | 'Farmer';
    barangay: string;
    farmType: 'Irrigated' | 'Rainfed Upland' | 'Rainfed Lowland';
    cropCommodity?: string;
    totalFarmArea?: string;
    ownershipType?: {
        registeredOwner: boolean;
        tenant: boolean;
        tenantLandOwner: string;
        lessee: boolean;
        lesseeLandOwner: string;
        others: boolean;
        othersSpecify: string;
    };
    createdAt: string;
}

interface IncentiveProgram {
    id: string;
    name: string;
    description: string;
    type: 'Input' | 'Cash' | 'Training' | 'Equipment';
    eligibilityCriteria: {
        minLandSize: number;
        maxLandSize?: number;
        allowedTenancy: ('Tenant' | 'Land Owner' | 'Farmer')[];
        allowedCrops: string[];
        allowedFarmTypes: ('Irrigated' | 'Rainfed Upland' | 'Rainfed Lowland')[];
        maxPreviousParticipation?: number;
    };
    incentiveValue: number;
    unit: string;
    maxBeneficiaries?: number;
    startDate: string;
    endDate: string;
    isActive: boolean;
}

interface IncentiveRecord {
    id: string;
    farmerId: string;
    programId: string;
    farmerName: string;
    barangay: string;
    landArea: number;
    cropType: string;
    tenancyStatus: string;
    incentiveType: 'Input' | 'Cash' | 'Training' | 'Equipment';
    incentiveValue: number;
    unit: string;
    dateProvided: string;
    complianceScore?: number;
    impactNotes?: string;
    geometry?: any; // For map visualization
}

interface EligibilityScore {
    farmerId: string;
    farmerName: string;
    barangay: string;
    landArea: number;
    cropType: string;
    tenancyStatus: string;
    eligibilityScore: number;
    eligiblePrograms: string[];
    reasons: string[];
}

const Incentives: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'eligibility' | 'tracking' | 'map' | 'evaluation'>('eligibility');
    const [farmers, setFarmers] = useState<Farmer[]>([]);
    const [incentivePrograms, setIncentivePrograms] = useState<IncentiveProgram[]>([]);
    const [incentiveRecords, setIncentiveRecords] = useState<IncentiveRecord[]>([]);
    const [eligibilityResults, setEligibilityResults] = useState<EligibilityScore[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
    const [selectedProgram, setSelectedProgram] = useState<IncentiveProgram | null>(null);
    const [showAddProgramModal, setShowAddProgramModal] = useState(false);
    const [showAddIncentiveModal, setShowAddIncentiveModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterBarangay, setFilterBarangay] = useState('');

    // Form states for new program
    const [newProgram, setNewProgram] = useState<Partial<IncentiveProgram>>({
        name: '',
        description: '',
        type: 'Input',
        eligibilityCriteria: {
            minLandSize: 0,
            allowedTenancy: ['Tenant', 'Land Owner', 'Farmer'],
            allowedCrops: [],
            allowedFarmTypes: ['Irrigated', 'Rainfed Upland', 'Rainfed Lowland']
        },
        incentiveValue: 0,
        unit: '',
        startDate: '',
        endDate: '',
        isActive: true
    });

    // Form states for new incentive record
    const [newIncentive, setNewIncentive] = useState<Partial<IncentiveRecord>>({
        farmerId: '',
        programId: '',
        incentiveType: 'Input',
        incentiveValue: 0,
        unit: '',
        dateProvided: new Date().toISOString().split('T')[0],
        complianceScore: 0,
        impactNotes: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);

            // Fetch farmers
            const farmersResponse = await fetch('/api/farmers');
            const farmersData = await farmersResponse.json();
            setFarmers(farmersData);

            // Fetch RSBSA data for additional farmer details
            const rsbsaResponse = await fetch('/api/rsbsa');
            const rsbsaData = await rsbsaResponse.json();

            // Merge RSBSA data with farmers
            const enrichedFarmers = farmersData.map((farmer: Farmer) => {
                const rsbsaRecord = rsbsaData.find((r: any) =>
                    r.firstName === farmer.firstName &&
                    r.surname === farmer.surname
                );
                return {
                    ...farmer,
                    cropCommodity: rsbsaRecord?.cropCommodity || '',
                    totalFarmArea: rsbsaRecord?.totalFarmArea || '',
                    ownershipType: rsbsaRecord?.ownershipType || {
                        registeredOwner: false,
                        tenant: false,
                        tenantLandOwner: '',
                        lessee: false,
                        lesseeLandOwner: '',
                        others: false,
                        othersSpecify: ''
                    }
                };
            });
            setFarmers(enrichedFarmers);

            // Load sample incentive programs (in real app, this would come from API)
            const samplePrograms: IncentiveProgram[] = [
                {
                    id: '1',
                    name: 'Rice Seed Subsidy',
                    description: 'Free high-yielding rice seeds for small farmers',
                    type: 'Input',
                    eligibilityCriteria: {
                        minLandSize: 0.5,
                        maxLandSize: 3.0,
                        allowedTenancy: ['Tenant', 'Land Owner'],
                        allowedCrops: ['Rice'],
                        allowedFarmTypes: ['Irrigated', 'Rainfed Lowland'],
                        maxPreviousParticipation: 2
                    },
                    incentiveValue: 50,
                    unit: 'kg of seeds',
                    maxBeneficiaries: 100,
                    startDate: '2024-01-01',
                    endDate: '2024-12-31',
                    isActive: true
                },
                {
                    id: '2',
                    name: 'Fertilizer Support',
                    description: 'Subsidized fertilizer for corn farmers',
                    type: 'Input',
                    eligibilityCriteria: {
                        minLandSize: 1.0,
                        allowedTenancy: ['Tenant', 'Land Owner', 'Farmer'],
                        allowedCrops: ['Corn'],
                        allowedFarmTypes: ['Rainfed Upland'],
                        maxPreviousParticipation: 1
                    },
                    incentiveValue: 100,
                    unit: 'kg of fertilizer',
                    startDate: '2024-03-01',
                    endDate: '2024-08-31',
                    isActive: true
                },
                {
                    id: '3',
                    name: 'Cash Assistance for Land Preparation',
                    description: 'Financial support for land preparation activities',
                    type: 'Cash',
                    eligibilityCriteria: {
                        minLandSize: 0.5,
                        allowedTenancy: ['Tenant'],
                        allowedCrops: ['Rice', 'Corn', 'Vegetables'],
                        allowedFarmTypes: ['Irrigated', 'Rainfed Upland', 'Rainfed Lowland']
                    },
                    incentiveValue: 5000,
                    unit: 'PHP',
                    startDate: '2024-02-01',
                    endDate: '2024-06-30',
                    isActive: true
                }
            ];
            setIncentivePrograms(samplePrograms);

            // Load sample incentive records (in real app, this would come from API)
            const sampleRecords: IncentiveRecord[] = [
                {
                    id: '1',
                    farmerId: '1',
                    programId: '1',
                    farmerName: 'Juan Dela Cruz',
                    barangay: 'Calao',
                    landArea: 1.5,
                    cropType: 'Rice',
                    tenancyStatus: 'Tenant',
                    incentiveType: 'Input',
                    incentiveValue: 50,
                    unit: 'kg of seeds',
                    dateProvided: '2024-01-15',
                    complianceScore: 85,
                    impactNotes: 'Good crop establishment, timely planting'
                }
            ];
            setIncentiveRecords(sampleRecords);

            setLoading(false);
        } catch (error) {
            console.error('Error fetching data:', error);
            setLoading(false);
        }
    };

    // Eligibility Assessment Logic
    const assessEligibility = () => {
        const results: EligibilityScore[] = farmers.map(farmer => {
            const eligiblePrograms: string[] = [];
            const reasons: string[] = [];
            let totalScore = 0;

            incentivePrograms.forEach(program => {
                if (!program.isActive) return;

                let programScore = 0;
                let isEligible = true;
                const programReasons: string[] = [];

                // Check land size
                if (farmer.area < program.eligibilityCriteria.minLandSize) {
                    isEligible = false;
                    programReasons.push(`Land area (${farmer.area}ha) below minimum (${program.eligibilityCriteria.minLandSize}ha)`);
                } else if (program.eligibilityCriteria.maxLandSize && farmer.area > program.eligibilityCriteria.maxLandSize) {
                    isEligible = false;
                    programReasons.push(`Land area (${farmer.area}ha) above maximum (${program.eligibilityCriteria.maxLandSize}ha)`);
                } else {
                    programScore += 20;
                }

                // Check tenancy status
                if (!program.eligibilityCriteria.allowedTenancy.includes(farmer.status)) {
                    isEligible = false;
                    programReasons.push(`Tenancy status (${farmer.status}) not eligible`);
                } else {
                    programScore += 20;
                }

                // Check crop type
                if (farmer.cropCommodity && program.eligibilityCriteria.allowedCrops.length > 0) {
                    if (!program.eligibilityCriteria.allowedCrops.includes(farmer.cropCommodity)) {
                        isEligible = false;
                        programReasons.push(`Crop type (${farmer.cropCommodity}) not eligible`);
                    } else {
                        programScore += 20;
                    }
                } else {
                    programScore += 20; // No crop restriction or no crop data
                }

                // Check farm type
                if (!program.eligibilityCriteria.allowedFarmTypes.includes(farmer.farmType)) {
                    isEligible = false;
                    programReasons.push(`Farm type (${farmer.farmType}) not eligible`);
                } else {
                    programScore += 20;
                }

                // Check previous participation
                const previousParticipation = incentiveRecords.filter(record =>
                    record.farmerId === farmer.id && record.programId === program.id
                ).length;

                if (program.eligibilityCriteria.maxPreviousParticipation &&
                    previousParticipation >= program.eligibilityCriteria.maxPreviousParticipation) {
                    isEligible = false;
                    programReasons.push(`Maximum participation limit reached (${previousParticipation}/${program.eligibilityCriteria.maxPreviousParticipation})`);
                } else {
                    programScore += 20;
                }

                if (isEligible) {
                    eligiblePrograms.push(program.name);
                    totalScore += programScore;
                } else {
                    reasons.push(...programReasons.map(reason => `${program.name}: ${reason}`));
                }
            });

            return {
                farmerId: farmer.id,
                farmerName: `${farmer.firstName} ${farmer.middleName} ${farmer.surname}`.trim(),
                barangay: farmer.barangay,
                landArea: farmer.area,
                cropType: farmer.cropCommodity || 'Not specified',
                tenancyStatus: farmer.status,
                eligibilityScore: totalScore,
                eligiblePrograms,
                reasons
            };
        });

        setEligibilityResults(results);
    };

    // Add new incentive program
    const handleAddProgram = async () => {
        if (!newProgram.name || !newProgram.description) return;

        const program: IncentiveProgram = {
            ...newProgram as IncentiveProgram,
            id: Date.now().toString()
        };

        setIncentivePrograms(prev => [...prev, program]);
        setShowAddProgramModal(false);
        setNewProgram({
            name: '',
            description: '',
            type: 'Input',
            eligibilityCriteria: {
                minLandSize: 0,
                allowedTenancy: ['Tenant', 'Land Owner', 'Farmer'],
                allowedCrops: [],
                allowedFarmTypes: ['Irrigated', 'Rainfed Upland', 'Rainfed Lowland']
            },
            incentiveValue: 0,
            unit: '',
            startDate: '',
            endDate: '',
            isActive: true
        });
    };

    // Add new incentive record
    const handleAddIncentive = async () => {
        if (!newIncentive.farmerId || !newIncentive.programId) return;

        const farmer = farmers.find(f => f.id === newIncentive.farmerId);
        const program = incentivePrograms.find(p => p.id === newIncentive.programId);

        if (!farmer || !program) return;

        const record: IncentiveRecord = {
            id: Date.now().toString(),
            farmerId: newIncentive.farmerId!,
            programId: newIncentive.programId!,
            farmerName: `${farmer.firstName} ${farmer.middleName} ${farmer.surname}`.trim(),
            barangay: farmer.barangay,
            landArea: farmer.area,
            cropType: farmer.cropCommodity || 'Not specified',
            tenancyStatus: farmer.status,
            incentiveType: newIncentive.incentiveType!,
            incentiveValue: newIncentive.incentiveValue!,
            unit: newIncentive.unit!,
            dateProvided: newIncentive.dateProvided!,
            complianceScore: newIncentive.complianceScore,
            impactNotes: newIncentive.impactNotes
        };

        setIncentiveRecords(prev => [...prev, record]);
        setShowAddIncentiveModal(false);
        setNewIncentive({
            farmerId: '',
            programId: '',
            incentiveType: 'Input',
            incentiveValue: 0,
            unit: '',
            dateProvided: new Date().toISOString().split('T')[0],
            complianceScore: 0,
            impactNotes: ''
        });
    };

    // Filter functions
    const filteredEligibilityResults = eligibilityResults.filter(result => {
        const matchesSearch = result.farmerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            result.barangay.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesBarangay = !filterBarangay || result.barangay === filterBarangay;
        return matchesSearch && matchesBarangay;
    });

    const filteredIncentiveRecords = incentiveRecords.filter(record => {
        const matchesSearch = record.farmerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            record.barangay.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesBarangay = !filterBarangay || record.barangay === filterBarangay;
        return matchesSearch && matchesBarangay;
    });

    const uniqueBarangays = [...new Set(farmers.map(f => f.barangay))].sort();

    if (loading) {
        return <div className="loading">Loading incentives data...</div>;
    }

    return (
        <div className="incentives-container">
            <div className="incentives-header">
                <button
                    className="btn btn-secondary"
                    style={{ marginRight: 16 }}
                    onClick={() => navigate('/dashboard')}
                >
                    ←
                </button>
                <h1>Farmer Incentives Management</h1>
                <div className="header-actions">
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowAddProgramModal(true)}
                    >
                        Add New Program
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => setShowAddIncentiveModal(true)}
                    >
                        Record Incentive
                    </button>
                </div>
            </div>

            <div className="incentives-tabs">
                <button
                    className={`tab ${activeTab === 'eligibility' ? 'active' : ''}`}
                    onClick={() => setActiveTab('eligibility')}
                >
                    Eligibility Assessment
                </button>
                <button
                    className={`tab ${activeTab === 'tracking' ? 'active' : ''}`}
                    onClick={() => setActiveTab('tracking')}
                >
                    Incentive Tracking
                </button>
                <button
                    className={`tab ${activeTab === 'map' ? 'active' : ''}`}
                    onClick={() => setActiveTab('map')}
                >
                    Map Visualization
                </button>
                <button
                    className={`tab ${activeTab === 'evaluation' ? 'active' : ''}`}
                    onClick={() => setActiveTab('evaluation')}
                >
                    Impact Evaluation
                </button>
            </div>

            <div className="filters-section">
                <input
                    type="text"
                    placeholder="Search farmers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                />
                <select
                    value={filterBarangay}
                    onChange={(e) => setFilterBarangay(e.target.value)}
                    className="filter-select"
                >
                    <option value="">All Barangays</option>
                    {uniqueBarangays.map(barangay => (
                        <option key={barangay} value={barangay}>{barangay}</option>
                    ))}
                </select>
            </div>

            {/* Eligibility Assessment Tab */}
            {activeTab === 'eligibility' && (
                <div className="tab-content">
                    <div className="section-header">
                        <h2>Farmer Eligibility Assessment</h2>
                        <button
                            className="btn btn-primary"
                            onClick={assessEligibility}
                        >
                            Assess Eligibility
                        </button>
                    </div>

                    <div className="eligibility-results">
                        {eligibilityResults.length > 0 ? (
                            <div className="results-grid">
                                {filteredEligibilityResults.map(result => (
                                    <div key={result.farmerId} className="eligibility-card">
                                        <div className="card-header">
                                            <h3>{result.farmerName}</h3>
                                            <span className={`score ${result.eligibilityScore > 60 ? 'high' : result.eligibilityScore > 30 ? 'medium' : 'low'}`}>
                                                {result.eligibilityScore}%
                                            </span>
                                        </div>
                                        <div className="card-details">
                                            <p><strong>Barangay:</strong> {result.barangay}</p>
                                            <p><strong>Land Area:</strong> {result.landArea} ha</p>
                                            <p><strong>Crop:</strong> {result.cropType}</p>
                                            <p><strong>Status:</strong> {result.tenancyStatus}</p>
                                        </div>
                                        {result.eligiblePrograms.length > 0 && (
                                            <div className="eligible-programs">
                                                <h4>Eligible Programs:</h4>
                                                <ul>
                                                    {result.eligiblePrograms.map(program => (
                                                        <li key={program}>{program}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {result.reasons.length > 0 && (
                                            <div className="ineligibility-reasons">
                                                <h4>Ineligibility Reasons:</h4>
                                                <ul>
                                                    {result.reasons.map((reason, index) => (
                                                        <li key={index}>{reason}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <p>Click "Assess Eligibility" to evaluate farmers for available programs.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Incentive Tracking Tab */}
            {activeTab === 'tracking' && (
                <div className="tab-content">
                    <div className="section-header">
                        <h2>Incentive Distribution Tracking</h2>
                    </div>

                    <div className="tracking-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Farmer Name</th>
                                    <th>Barangay</th>
                                    <th>Program</th>
                                    <th>Incentive Type</th>
                                    <th>Value</th>
                                    <th>Date Provided</th>
                                    <th>Compliance Score</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredIncentiveRecords.map(record => {
                                    const program = incentivePrograms.find(p => p.id === record.programId);
                                    return (
                                        <tr key={record.id}>
                                            <td>{record.farmerName}</td>
                                            <td>{record.barangay}</td>
                                            <td>{program?.name || 'Unknown Program'}</td>
                                            <td>{record.incentiveType}</td>
                                            <td>{record.incentiveValue} {record.unit}</td>
                                            <td>{new Date(record.dateProvided).toLocaleDateString()}</td>
                                            <td>
                                                <span className={`compliance-score ${record.complianceScore && record.complianceScore > 80 ? 'high' : record.complianceScore && record.complianceScore > 60 ? 'medium' : 'low'}`}>
                                                    {record.complianceScore || 'N/A'}
                                                </span>
                                            </td>
                                            <td>
                                                <button className="btn btn-small">View Details</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Map Visualization Tab */}
            {activeTab === 'map' && (
                <div className="tab-content">
                    <div className="section-header">
                        <h2>Incentive Distribution Map</h2>
                        <div className="map-legend">
                            <div className="legend-item">
                                <span className="legend-color input"></span>
                                <span>Input Incentives</span>
                            </div>
                            <div className="legend-item">
                                <span className="legend-color cash"></span>
                                <span>Cash Incentives</span>
                            </div>
                            <div className="legend-item">
                                <span className="legend-color training"></span>
                                <span>Training Programs</span>
                            </div>
                        </div>
                    </div>

                    <div className="map-container">
                        <FarmlandMap
                            onLandPlotSelect={(properties) => {
                                const farmer = farmers.find(f =>
                                    f.firstName === properties.firstName &&
                                    f.surname === properties.surname
                                );
                                if (farmer) {
                                    setSelectedFarmer(farmer);
                                }
                            }}
                        />
                    </div>

                    {selectedFarmer && (
                        <div className="farmer-details-panel">
                            <h3>{selectedFarmer.firstName} {selectedFarmer.surname}</h3>
                            <p><strong>Barangay:</strong> {selectedFarmer.barangay}</p>
                            <p><strong>Land Area:</strong> {selectedFarmer.area} ha</p>
                            <p><strong>Status:</strong> {selectedFarmer.status}</p>
                            <p><strong>Crop:</strong> {selectedFarmer.cropCommodity || 'Not specified'}</p>

                            <div className="farmer-incentives">
                                <h4>Received Incentives:</h4>
                                {incentiveRecords
                                    .filter(record =>
                                        record.farmerName.includes(selectedFarmer.firstName) &&
                                        record.farmerName.includes(selectedFarmer.surname)
                                    )
                                    .map(record => {
                                        const program = incentivePrograms.find(p => p.id === record.programId);
                                        return (
                                            <div key={record.id} className="incentive-item">
                                                <strong>{program?.name}</strong> - {record.incentiveValue} {record.unit}
                                                <br />
                                                <small>{new Date(record.dateProvided).toLocaleDateString()}</small>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Impact Evaluation Tab */}
            {activeTab === 'evaluation' && (
                <div className="tab-content">
                    <div className="section-header">
                        <h2>Program Impact Evaluation</h2>
                    </div>

                    <div className="evaluation-stats">
                        <div className="stat-card">
                            <h3>Total Beneficiaries</h3>
                            <div className="stat-value">{incentiveRecords.length}</div>
                        </div>
                        <div className="stat-card">
                            <h3>Average Compliance Score</h3>
                            <div className="stat-value">
                                {incentiveRecords.length > 0
                                    ? Math.round(incentiveRecords.reduce((sum, record) => sum + (record.complianceScore || 0), 0) / incentiveRecords.length)
                                    : 0}%
                            </div>
                        </div>
                        <div className="stat-card">
                            <h3>Active Programs</h3>
                            <div className="stat-value">{incentivePrograms.filter(p => p.isActive).length}</div>
                        </div>
                        <div className="stat-card">
                            <h3>Total Incentive Value</h3>
                            <div className="stat-value">
                                ₱{incentiveRecords.reduce((sum, record) => {
                                    if (record.incentiveType === 'Cash') {
                                        return sum + record.incentiveValue;
                                    }
                                    return sum;
                                }, 0).toLocaleString()}
                            </div>
                        </div>
                    </div>

                    <div className="program-performance">
                        <h3>Program Performance by Type</h3>
                        <div className="performance-chart">
                            {['Input', 'Cash', 'Training', 'Equipment'].map(type => {
                                const typeRecords = incentiveRecords.filter(record => record.incentiveType === type);
                                const avgCompliance = typeRecords.length > 0
                                    ? Math.round(typeRecords.reduce((sum, record) => sum + (record.complianceScore || 0), 0) / typeRecords.length)
                                    : 0;

                                return (
                                    <div key={type} className="performance-item">
                                        <div className="performance-header">
                                            <h4>{type} Incentives</h4>
                                            <span className="count">{typeRecords.length} beneficiaries</span>
                                        </div>
                                        <div className="performance-bar">
                                            <div
                                                className="performance-fill"
                                                style={{ width: `${avgCompliance}%` }}
                                            ></div>
                                        </div>
                                        <div className="performance-value">{avgCompliance}% avg compliance</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Add Program Modal */}
            {showAddProgramModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3>Add New Incentive Program</h3>
                            <button onClick={() => setShowAddProgramModal(false)}>&times;</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Program Name</label>
                                <input
                                    type="text"
                                    value={newProgram.name}
                                    onChange={(e) => setNewProgram(prev => ({ ...prev, name: e.target.value }))}
                                />
                            </div>
                            <div className="form-group">
                                <label>Description</label>
                                <textarea
                                    value={newProgram.description}
                                    onChange={(e) => setNewProgram(prev => ({ ...prev, description: e.target.value }))}
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Type</label>
                                    <select
                                        value={newProgram.type}
                                        onChange={(e) => setNewProgram(prev => ({ ...prev, type: e.target.value as any }))}
                                    >
                                        <option value="Input">Input</option>
                                        <option value="Cash">Cash</option>
                                        <option value="Training">Training</option>
                                        <option value="Equipment">Equipment</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Incentive Value</label>
                                    <input
                                        type="number"
                                        value={newProgram.incentiveValue}
                                        onChange={(e) => setNewProgram(prev => ({ ...prev, incentiveValue: parseFloat(e.target.value) || 0 }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Unit</label>
                                    <input
                                        type="text"
                                        value={newProgram.unit}
                                        onChange={(e) => setNewProgram(prev => ({ ...prev, unit: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Start Date</label>
                                    <input
                                        type="date"
                                        value={newProgram.startDate}
                                        onChange={(e) => setNewProgram(prev => ({ ...prev, startDate: e.target.value }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>End Date</label>
                                    <input
                                        type="date"
                                        value={newProgram.endDate}
                                        onChange={(e) => setNewProgram(prev => ({ ...prev, endDate: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Minimum Land Size (ha)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={newProgram.eligibilityCriteria?.minLandSize}
                                    onChange={(e) => setNewProgram(prev => ({
                                        ...prev,
                                        eligibilityCriteria: {
                                            ...prev.eligibilityCriteria!,
                                            minLandSize: parseFloat(e.target.value) || 0
                                        }
                                    }))}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowAddProgramModal(false)}>Cancel</button>
                            <button onClick={handleAddProgram} className="btn-primary">Add Program</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Incentive Modal */}
            {showAddIncentiveModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3>Record New Incentive</h3>
                            <button onClick={() => setShowAddIncentiveModal(false)}>&times;</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Farmer</label>
                                <select
                                    value={newIncentive.farmerId}
                                    onChange={(e) => setNewIncentive(prev => ({ ...prev, farmerId: e.target.value }))}
                                >
                                    <option value="">Select Farmer</option>
                                    {farmers.map(farmer => (
                                        <option key={farmer.id} value={farmer.id}>
                                            {farmer.firstName} {farmer.surname} - {farmer.barangay}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Program</label>
                                <select
                                    value={newIncentive.programId}
                                    onChange={(e) => setNewIncentive(prev => ({ ...prev, programId: e.target.value }))}
                                >
                                    <option value="">Select Program</option>
                                    {incentivePrograms.filter(p => p.isActive).map(program => (
                                        <option key={program.id} value={program.id}>
                                            {program.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Incentive Type</label>
                                    <select
                                        value={newIncentive.incentiveType}
                                        onChange={(e) => setNewIncentive(prev => ({ ...prev, incentiveType: e.target.value as any }))}
                                    >
                                        <option value="Input">Input</option>
                                        <option value="Cash">Cash</option>
                                        <option value="Training">Training</option>
                                        <option value="Equipment">Equipment</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Value</label>
                                    <input
                                        type="number"
                                        value={newIncentive.incentiveValue}
                                        onChange={(e) => setNewIncentive(prev => ({ ...prev, incentiveValue: parseFloat(e.target.value) || 0 }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Unit</label>
                                    <input
                                        type="text"
                                        value={newIncentive.unit}
                                        onChange={(e) => setNewIncentive(prev => ({ ...prev, unit: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Date Provided</label>
                                    <input
                                        type="date"
                                        value={newIncentive.dateProvided}
                                        onChange={(e) => setNewIncentive(prev => ({ ...prev, dateProvided: e.target.value }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Compliance Score (%)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={newIncentive.complianceScore}
                                        onChange={(e) => setNewIncentive(prev => ({ ...prev, complianceScore: parseInt(e.target.value) || 0 }))}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Impact Notes</label>
                                <textarea
                                    value={newIncentive.impactNotes}
                                    onChange={(e) => setNewIncentive(prev => ({ ...prev, impactNotes: e.target.value }))}
                                    placeholder="Observations about program impact..."
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowAddIncentiveModal(false)}>Cancel</button>
                            <button onClick={handleAddIncentive} className="btn-primary">Record Incentive</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Incentives;
