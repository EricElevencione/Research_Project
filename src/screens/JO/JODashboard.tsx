import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import '../../components/layout/sidebarStyle.css';
import '../../assets/css/jo css/JoDashboardStyle.css';
import FarmlandMap from '../../components/Map/FarmlandMap';
import { BarChart } from '@mui/x-charts/BarChart';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Typography, Box, Chip, Divider } from '@mui/material';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import MasterlistIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';

interface FarmerData {
	id: number;
	farmerName: string;
	farmerAddress: string;
	status: string;
	ownershipType: {
		registeredOwner: boolean;
		tenant: boolean;
		lessee: boolean;
	};
}

interface BarangayData {
	barangay: string;
	count: number;
}

interface OwnershipData {
	totalCount: number;
	barangayBreakdown: BarangayData[];
	farmers: { id: number; name: string; barangay: string }[];
}

const JoDashboard: React.FC = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const [barangayData, setBarangayData] = useState<BarangayData[]>([]);
	const [registeredOwners, setRegisteredOwners] = useState<OwnershipData>({ totalCount: 0, barangayBreakdown: [], farmers: [] });
	const [tenants, setTenants] = useState<OwnershipData>({ totalCount: 0, barangayBreakdown: [], farmers: [] });
	const [lessees, setLessees] = useState<OwnershipData>({ totalCount: 0, barangayBreakdown: [], farmers: [] });
	const [loading, setLoading] = useState(true);

	const isActive = (path: string) => location.pathname === path;

	// DataGrid columns
	const columns: GridColDef[] = [
		{ field: 'name', headerName: 'Farmer Name', flex: 1, minWidth: 200 },
		{ field: 'barangay', headerName: 'Barangay', flex: 1, minWidth: 150 },
	];

	// Fetch farmers data and categorize by ownership type
	useEffect(() => {
		const fetchFarmersData = async () => {
			try {
				const response = await fetch('http://localhost:5000/api/rsbsa_submission');
				const data: FarmerData[] = await response.json();

				// Process active farmers for main chart
				const activeFarmers = data.filter((farmer: any) => farmer.status === 'Active Farmer');
				const barangayCounts: { [key: string]: number } = {};
				activeFarmers.forEach((farmer: any) => {
					const barangay = farmer.farmerAddress?.split(',')[0]?.trim() || 'Unknown';
					barangayCounts[barangay] = (barangayCounts[barangay] || 0) + 1;
				});
				const chartData = Object.entries(barangayCounts)
					.map(([barangay, count]) => ({ barangay, count }))
					.sort((a, b) => b.count - a.count);
				setBarangayData(chartData);

				// Process all farmers by ownership type (regardless of status)
				const processOwnershipData = (filterFn: (farmer: any) => boolean): OwnershipData => {
					const filtered = data.filter(filterFn);
					const barangayMap: { [key: string]: number } = {};

					const farmersList = filtered.map((farmer: any) => {
						const barangay = farmer.farmerAddress?.split(',')[0]?.trim() || 'Unknown';
						barangayMap[barangay] = (barangayMap[barangay] || 0) + 1;
						return {
							id: farmer.id,
							name: farmer.farmerName,
							barangay: barangay
						};
					});

					const breakdown = Object.entries(barangayMap)
						.map(([barangay, count]) => ({ barangay, count }))
						.sort((a, b) => b.count - a.count);

					return {
						totalCount: filtered.length,
						barangayBreakdown: breakdown,
						farmers: farmersList
					};
				};

				setRegisteredOwners(processOwnershipData((f: any) => f.ownershipType?.registeredOwner === true));
				setTenants(processOwnershipData((f: any) => f.ownershipType?.tenant === true));
				setLessees(processOwnershipData((f: any) => f.ownershipType?.lessee === true));

				setLoading(false);
			} catch (error) {
				console.error('Error fetching farmer data:', error);
				setLoading(false);
			}
		};

		fetchFarmersData();
	}, []);

	return (
		<div className="jo-dashboard-page-container">

			<div className="jo-dashboard-page">

				{/* Sidebar starts here */}
				<div className="sidebar">
					<nav className="sidebar-nav">
						<div className='sidebar-logo'>
							<img src={LogoImage} alt="Logo" />
						</div>

						<button
							className={`sidebar-nav-item ${isActive('/jo-dashboard') ? 'active' : ''}`}
							onClick={() => navigate('/jo-dashboard')}
						>
							<span className="nav-icon">
								<img src={HomeIcon} alt="Home" />
							</span>
							<span className="nav-text">Home</span>
						</button>

						<button
							className={`sidebar-nav-item ${isActive('/jo-rsbsapage') ? 'active' : ''}`}
							onClick={() => navigate('/jo-rsbsapage')}
						>
							<span className="nav-icon">
								<img src={RSBSAIcon} alt="RSBSA" />
							</span>
							<span className="nav-text">RSBSA</span>
						</button>

						<button
							className={`sidebar-nav-item ${isActive('/jo-incentives') ? 'active' : ''}`}
							onClick={() => navigate('/jo-incentives')}
						>
							<span className="nav-icon">
								<img src={IncentivesIcon} alt="Incentives" />
							</span>
							<span className="nav-text">Incentives</span>
						</button>

						<button
							className={`sidebar-nav-item ${isActive('/jo-masterlist') ? 'active' : ''}`}
							onClick={() => navigate('/jo-masterlist')}
						>
							<span className="nav-icon">
								<img src={MasterlistIcon} alt="Masterlist" />
							</span>
							<span className="nav-text">Masterlist</span>
						</button>

						<div
							className={`sidebar-nav-item ${isActive('/jo-gap-analysis') ? 'active' : ''}`}
							onClick={() => navigate('/jo-gap-analysis')}
						>
							<div className="nav-icon">📊</div>
							<span className="nav-text">Gap Analysis</span>
						</div>

						<div
							className={`sidebar-nav-item ${isActive('/jo-distribution') ? 'active' : ''}`}
							onClick={() => navigate('/jo-distribution')}
						>
							<div className="nav-icon">🚚</div>
							<span className="nav-text">Distribution Log</span>
						</div>

						<button
							className={`sidebar-nav-item ${isActive('/') ? 'active' : ''}`}
							onClick={() => navigate('/')}
						>
							<span className="nav-icon">
								<img src={LogoutIcon} alt="Logout" />
							</span>
							<span className="nav-text">Logout</span>
						</button>

					</nav>
				</div>
				{/* Sidebar ends here */}

				{/* Main content starts here */}
				<div className="jo-dashboard-main-content">
					<div className="jo-dashboard-map-section">
						<h2 className="jo-dashboard-page-title">Dashboard</h2>

						<div className="jo-dashboard-map-area">
							<FarmlandMap />
						</div>

						<div className="jo-dashboard-stats">
							<div className="jo-dashboard-active-farmers">
								<h3>Active Farmers by Barangay</h3>
								{loading ? (
									<div className="jo-dashboard-chart-loading">
										Loading...
									</div>
								) : barangayData.length > 0 ? (
									<div className="jo-dashboard-bar-chart-container">
										<BarChart
											yAxis={[{
												scaleType: 'band',
												data: barangayData.map(d => d.barangay),
												tickLabelStyle: {
													fontSize: 11,
													fill: 'white'
												}
											}]}
											xAxis={[{
												tickLabelStyle: {
													fill: 'white'
												}
											}]}
											series={[{
												data: barangayData.map(d => d.count),
												label: 'Active Farmers',
												color: '#ffffff'
											}]}
											layout="horizontal"
											height={Math.max(300, barangayData.length * 15)}
											margin={{ left: 100, right: 20, top: 50, bottom: 40 }}
											sx={{
												'& .MuiChartsAxis-line': {
													stroke: 'white'
												},
												'& .MuiChartsAxis-tick': {
													stroke: 'white'
												},
												'& .MuiChartsAxis-tickLabel': {
													fill: 'white'
												},
												'& .MuiChartsLegend-series text': {
													fill: 'white !important'
												}
											}}
										/>
									</div>
								) : (
									<div className="jo-dashboard-chart-empty">
										No active farmers found
									</div>
								)}
							</div>
							<div className="jo-dashboard-barangay-distribution"></div>
						</div>
					</div>

					<div className="jo-dashboard-reports">
						{/* Pure CSS Accordion - Radio buttons control which section is open */}
						<input type="radio" name="accordion" id="section-1" className="accordion-radio" defaultChecked />
						<input type="radio" name="accordion" id="section-2" className="accordion-radio" />
						<input type="radio" name="accordion" id="section-3" className="accordion-radio" />

						<div className='jo-dashboard-reports-section'>
							<label htmlFor="section-1" className="accordion-header">
								<span className="accordion-title">Registered Owners</span>
								<span className="accordion-icon">+</span>
							</label>
							<div className="accordion-content">
								<div className="accordion-content-inner">
									<Box sx={{ p: 2 }}>
										<Typography variant="body1" sx={{ color: 'white', mb: 1, display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.95rem', fontWeight: 500 }}>
											Total Registered Owners:
											<Chip label={registeredOwners.totalCount} color="primary" size="small" sx={{ p: 0 }} />
										</Typography>

										<Box sx={{ height: 400, width: '100%', bgcolor: 'white', borderRadius: 1, p: 0, overflow: 'hidden' }}>
											<DataGrid
												rows={registeredOwners.farmers}
												columns={columns}
												hideFooterPagination
												hideFooter
												disableRowSelectionOnClick
												sx={{
													'& .MuiDataGrid-columnHeaders': {
														fontSize: '0.75rem',
														fontWeight: 600
													},
													'& .MuiDataGrid-cell': {
														fontSize: '0.75rem',
														padding: '2px 5px'
													},
													'& .MuiDataGrid-main': {
														overflow: 'hidden'
													},
													'& .MuiDataGrid-root': {
														overflow: 'hidden'
													},
													'& .MuiDataGrid-virtualScroller': {
														overflow: 'auto !important'
													},
													'& .MuiDataGrid-scrollbar': {
														display: 'none'
													}
												}}
											/>
										</Box>
									</Box>
								</div>
							</div>
						</div>

						<div className='jo-dashboard-reports-section'>
							<label htmlFor="section-2" className="accordion-header">
								<span className="accordion-title">Tenants</span>
								<span className="accordion-icon">+</span>
							</label>
							<div className="accordion-content">
								<div className="accordion-content-inner">
									<Box sx={{ p: 2 }}>
										<Typography variant="body1" sx={{ color: 'white', mb: 3, display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.95rem', fontWeight: 500 }}>
											Total Tenants:
											<Chip label={tenants.totalCount} color="secondary" size="small" />
										</Typography>

										<Box sx={{ height: 400, width: '100%', bgcolor: 'white', borderRadius: 1, }}>
											<DataGrid
												rows={tenants.farmers}
												columns={columns}
												hideFooterPagination
												hideFooter
												disableRowSelectionOnClick
												sx={{
													'& .MuiDataGrid-columnHeaders': {
														fontSize: '0.85rem',
														fontWeight: 600
													},
													'& .MuiDataGrid-cell': {
														fontSize: '0.875rem',
														overflow: 'hidden'
													}
												}}
											/>
										</Box>
									</Box>
								</div>
							</div>
						</div>

						<div className='jo-dashboard-reports-section'>
							<label htmlFor="section-3" className="accordion-header">
								<span className="accordion-title">Lessees</span>
								<span className="accordion-icon">+</span>
							</label>
							<div className="accordion-content">
								<div className="accordion-content-inner">
									<Box sx={{ p: 2 }}>
										<Typography variant="body1" sx={{ color: 'white', mb: 3, display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.95rem', fontWeight: 500 }}>
											Total Lessees:
											<Chip label={lessees.totalCount} color="success" size="small" />
										</Typography>

										<Box sx={{ height: 400, width: '100%', bgcolor: 'white', borderRadius: 1, overflow: 'hidden' }}>
											<DataGrid
												rows={lessees.farmers}
												columns={columns}
												hideFooterPagination
												hideFooter
												disableRowSelectionOnClick
												sx={{
													'& .MuiDataGrid-columnHeaders': {
														fontSize: '0.85rem',
														fontWeight: 600
													},
													'& .MuiDataGrid-cell': {
														fontSize: '0.875rem'
													},
													'& .MuiDataGrid-main': {
														overflow: 'hidden'
													},
													'& .MuiDataGrid-root': {
														overflow: 'hidden'
													},
													'& .MuiDataGrid-virtualScroller': {
														overflow: 'auto !important'
													},
													'& .MuiDataGrid-scrollbar': {
														display: 'none'
													}
												}}
											/>
										</Box>
									</Box>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div >

	);
};

export default JoDashboard;