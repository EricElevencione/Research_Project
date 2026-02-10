import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import { getDashboardStats, getMonthlyTrends, getRecentActivity, getAvailableSeasons } from '../../api';
import '../../components/layout/sidebarStyle.css';
import '../../assets/css/jo css/JoDashboardStyle.css';
import LogoImage from '../../assets/images/Logo.png';
import HomeIcon from '../../assets/images/home.png';
import RSBSAIcon from '../../assets/images/rsbsa.png';
import MasterlistIcon from '../../assets/images/approve.png';
import LogoutIcon from '../../assets/images/logout.png';
import IncentivesIcon from '../../assets/images/incentives.png';
import FarmlandMap from '../../components/Map/FarmlandMap';

// Recharts imports (already installed in project)
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
	PieChart,
	Pie,
	Cell
} from 'recharts';

interface DashboardStats {
	currentSeason: string;
	seasonEndDate: string;
	farmers: {
		total: number;
		active: number;
		lessee: number;
	};
	requests: {
		currentSeason: {
			total: number;
			pending: number;
			approved: number;
			rejected: number;
			distributed: number;
		};
		allTime: {
			total: number;
			pending: number;
			approved: number;
			distributed: number;
		};
		statusBreakdown: {
			approved: number;
			pending: number;
			rejected: number;
			distributed: number;
		};
	};
	distribution: {
		fertilizer: {
			allocated: number;
			distributed: number;
			remaining: number;
			progress: number;
		};
		seeds: {
			allocated: number;
			distributed: number;
			remaining: number;
			progress: number;
		};
		overall: {
			progress: number;
			totalAllocated: number;
			totalDistributed: number;
		};
	};
	coverage: {
		totalBarangays: number;
		barangaysWithRequests: number;
	};
	processingTime: {
		averageDays: string;
	};
}

interface MonthlyTrend {
	month: string;
	monthName: string;
	fertilizer: number;
	seeds: number;
	count: number;
}

interface RecentActivity {
	id: number;
	farmer_name: string;
	barangay: string;
	fertilizer_type: string;
	fertilizer_bags_given: number;
	seed_type: string;
	seed_kg_given: number;
	distribution_date: string;
	verified_by: string;
	created_at: string;
}

interface AvailableSeason {
	season: string;
	season_start_date: string;
	season_end_date: string;
	status: string;
}

const JoDashboard: React.FC = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
	const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);
	const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
	const [loading, setLoading] = useState(true);
	const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

	// Season selector state
	const [availableSeasons, setAvailableSeasons] = useState<AvailableSeason[]>([]);
	const [selectedSeason, setSelectedSeason] = useState<string>('');
	const [currentSeason, setCurrentSeason] = useState<string>('');

	const isActive = (path: string) => location.pathname === path;

	// Fetch available seasons on mount
	useEffect(() => {
		const fetchSeasons = async () => {
			try {
				const response = await getAvailableSeasons();

				if (!response.error && response.data) {
					setAvailableSeasons(response.data);

					// Find current season (the one with current date in range)
					const current = response.data.find((s: AvailableSeason) => s.status === 'active');
					if (current) {
						setCurrentSeason(current.season);
						if (!selectedSeason) {
							setSelectedSeason(current.season);
						}
					} else if (response.data.length > 0) {
						// Fallback to first season if no active season
						const fallbackSeason = response.data[0].season;
						setCurrentSeason(fallbackSeason);
						if (!selectedSeason) {
							setSelectedSeason(fallbackSeason);
						}
					}
				} else {
					// Fallback to calculated season
					console.log('Using calculated default season');
					const currentDate = new Date();
					const month = currentDate.getMonth();
					const year = currentDate.getFullYear();
					const defaultSeason = month >= 4 && month <= 9 ? `wet_${year}` : `dry_${year}`;
					setAvailableSeasons([{ season: defaultSeason, season_start_date: '', season_end_date: '', status: 'active' }]);
					setCurrentSeason(defaultSeason);
					if (!selectedSeason) {
						setSelectedSeason(defaultSeason);
					}
				}
			} catch (error) {
				console.error('Error fetching seasons:', error);
				// Fallback to calculated season on error
				const currentDate = new Date();
				const month = currentDate.getMonth();
				const year = currentDate.getFullYear();
				const defaultSeason = month >= 4 && month <= 9 ? `wet_${year}` : `dry_${year}`;
				setAvailableSeasons([{ season: defaultSeason, season_start_date: '', season_end_date: '', status: 'active' }]);
				setCurrentSeason(defaultSeason);
				if (!selectedSeason) {
					setSelectedSeason(defaultSeason);
				}
			}
		};
		fetchSeasons();
	}, []);

	// Fetch dashboard data when season changes
	useEffect(() => {
		if (!selectedSeason) return;

		const fetchDashboardData = async () => {
			setLoading(true);
			try {
				console.log('Fetching dashboard data for season:', selectedSeason);

				// Fetch all dashboard data in parallel
				const [statsResponse, trendsResponse, activityResponse] = await Promise.all([
					getDashboardStats(selectedSeason),
					getMonthlyTrends(selectedSeason),
					getRecentActivity(5)
				]);

				// Handle dashboard stats
				if (!statsResponse.error && statsResponse.data) {
					setDashboardStats(statsResponse.data);
					console.log('✅ Dashboard stats loaded:', statsResponse.data);
				} else {
					console.error('Error fetching dashboard stats:', statsResponse.error);
					// Set default empty stats on error
					setDashboardStats({
						currentSeason: selectedSeason || '',
						seasonEndDate: '',
						farmers: { total: 0, active: 0, lessee: 0 },
						requests: {
							currentSeason: { total: 0, pending: 0, approved: 0, rejected: 0, distributed: 0 },
							allTime: { total: 0, pending: 0, approved: 0, distributed: 0 },
							statusBreakdown: { approved: 0, pending: 0, rejected: 0, distributed: 0 }
						},
						distribution: {
							fertilizer: { allocated: 0, distributed: 0, remaining: 0, progress: 0 },
							seeds: { allocated: 0, distributed: 0, remaining: 0, progress: 0 },
							overall: { progress: 0, totalAllocated: 0, totalDistributed: 0 }
						},
						coverage: { totalBarangays: 0, barangaysWithRequests: 0 },
						processingTime: { averageDays: '0' }
					});
				}

				// Handle monthly trends
				if (!trendsResponse.error && trendsResponse.data) {
					setMonthlyTrends(trendsResponse.data);
					console.log('✅ Monthly trends loaded:', trendsResponse.data.length, 'months');
				} else {
					console.error('Error fetching monthly trends:', trendsResponse.error);
					setMonthlyTrends([]);
				}

				// Handle recent activity
				if (!activityResponse.error && activityResponse.data) {
					setRecentActivity(activityResponse.data);
					console.log('✅ Recent activity loaded:', activityResponse.data.length, 'records');
				} else {
					console.error('Error fetching recent activity:', activityResponse.error);
					setRecentActivity([]);
				}

				setLastUpdated(new Date());
			} catch (error) {
				console.error('Error fetching dashboard data:', error);
			} finally {
				setLoading(false);
			}
		};

		fetchDashboardData();

		// Auto-refresh every 5 minutes
		const interval = setInterval(fetchDashboardData, 300000);
		return () => clearInterval(interval);
	}, [selectedSeason]);

	// Format season display
	const formatSeason = (season: string) => {
		if (!season) return 'Current Season';
		const [type, year] = season.split('_');
		if (!type || !year) return season;
		return `${type.charAt(0).toUpperCase() + type.slice(1)} Season ${year}`;
	};

	// Handle season change
	const handleSeasonChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		setSelectedSeason(e.target.value);
	};

	// Pie chart data for Request Status Breakdown
	// Uses percentages from API, with actual counts for tooltips
	const pieChartData = [
		{
			name: 'Approved',
			value: dashboardStats?.requests.statusBreakdown?.approved || 0,
			count: dashboardStats?.requests.currentSeason?.approved || 0,
			color: '#22c55e'
		},
		{
			name: 'Pending',
			value: dashboardStats?.requests.statusBreakdown?.pending || 0,
			count: dashboardStats?.requests.currentSeason?.pending || 0,
			color: '#f59e0b'
		},
		{
			name: 'Rejected',
			value: dashboardStats?.requests.statusBreakdown?.rejected || 0,
			count: dashboardStats?.requests.currentSeason?.rejected || 0,
			color: '#ef4444'
		},
		{
			name: 'Distributed',
			value: dashboardStats?.requests.statusBreakdown?.distributed || 0,
			count: dashboardStats?.requests.currentSeason?.distributed || 0,
			color: '#3b82f6'
		}
	];

	// Check if we have any data to display
	const hasChartData = pieChartData.some(item => item.value > 0);

	// Bar chart colors
	const COLORS = {
		fertilizer: '#6366f1',
		seeds: '#22c55e'
	};

	if (loading) {
		return (
			<div className="jo-dashboard-page-container">
				<div className="jo-dashboard-loading">
					<div className="loading-spinner"></div>
					<p>Loading Executive Dashboard...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="jo-dashboard-page-container">
			
			<div className="jo-dashboard-page">

				{/* Sidebar */}
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
							className={`sidebar-nav-item ${isActive('/jo-distribution') ? 'active' : ''}`}
							onClick={() => navigate('/jo-distribution')}
						>
							<div className="nav-icon">🚚</div>
							<span className="nav-text">Distribution Log</span>
						</div>

						<div
							className={`sidebar-nav-item ${isActive('/jo-land-registry') ? 'active' : ''}`}
							onClick={() => navigate('/jo-land-registry')}
						>
							<div className="nav-icon">🗺️</div>
							<span className="nav-text">Land Registry</span>
						</div>

						<button
							className="sidebar-nav-item logout"
							onClick={() => navigate('/')}
						>
							<span className="nav-icon">
								<img src={LogoutIcon} alt="Logout" />
							</span>
							<span className="nav-text">Logout</span>
						</button>
					</nav>
				</div>

				{/* Main Content - Executive Dashboard */}
				<div className="jo-executive-dashboard">
					{/* Header */}
					<div className="executive-header">
						<div className="header-left">
							<h1 className="executive-title">JO Executive Dashboard</h1>
							<p className="executive-subtitle">
								{formatSeason(selectedSeason)} •
								Last updated: {lastUpdated.toLocaleTimeString()}
							</p>
						</div>
					</div>

					{/* Map Section */}
					<div className="dashboard-card map-card">
						<div className="card-header">
							<h3>🗺️ Farmland Coverage Map</h3>
							<span className="card-subtitle">Municipal Agricultural Land Plots</span>
						</div>
						<div className="card-content map-content">
							<div className="dashboard-map-container">
								<FarmlandMap />
							</div>
						</div>
					</div>

					{/* KPI Cards Section */}
					<div className="kpi-cards-section">
						{/* Top Row - Farmer Stats */}
						<div className="kpi-cards-row kpi-top-row">
							{/* Total Farmers */}
							<div className="kpi-card kpi-farmers">
								<div className="kpi-icon-wrapper">
									<span className="kpi-icon">👨‍🌾</span>
								</div>
								<div className="kpi-details">
									<span className="kpi-value">{(dashboardStats?.farmers.total || 0).toLocaleString()}</span>
									<span className="kpi-label">Total Farmers</span>
								</div>
							</div>

							{/* Total Lessee/Tenant */}
							<div className="kpi-card kpi-lessee">
								<div className="kpi-icon-wrapper">
									<span className="kpi-icon">📋</span>
								</div>
								<div className="kpi-details">
									<span className="kpi-value">{(dashboardStats?.farmers.lessee || 0).toLocaleString()}</span>
									<span className="kpi-label">Total Lessee/Tenant</span>
								</div>
							</div>

							{/* Total Active Farmers */}
							<div className="kpi-card kpi-active">
								<div className="kpi-icon-wrapper">
									<span className="kpi-icon">✅ </span>
								</div>
								<div className="kpi-details">
									<span className="kpi-value">{(dashboardStats?.farmers.active || 0).toLocaleString()}</span>
									<span className="kpi-label">Total Active Farmer</span>
								</div>
							</div>
						</div>

						{/* Seasonal Content Section with unified background */}
						<div className="seasonal-content-wrapper">
							{/* Season Selector Row */}
							<div className="kpi-season-row">
								<div className="season-selector">
									<label htmlFor="season-select">📅 View Season:</label>
									<select
										id="season-select"
										value={selectedSeason}
										onChange={handleSeasonChange}
										className="season-dropdown"
									>
										{/* Current season option (always available) */}
										<option value={currentSeason}>
											{formatSeason(currentSeason)} (Current)
										</option>
										{/* Available seasons from allocations */}
										{availableSeasons
											.filter(s => s.season !== currentSeason)
											.map((season) => (
												<option key={season.season} value={season.season}>
													{formatSeason(season.season)}
													{season.status === 'completed' ? ' ✓' : ''}
												</option>
											))}
									</select>
								</div>
							</div>

							{/* Bottom Row - Distribution Stats */}
							<div className="kpi-cards-row kpi-bottom-row">
								{/* Seeds Distributed */}
								<div className="kpi-card kpi-seeds">
									<div className="kpi-icon-wrapper">
										<span className="kpi-icon">🌾</span>
									</div>
									<div className="kpi-details">
										<span className="kpi-value">{(dashboardStats?.distribution.seeds.distributed || 0).toLocaleString()} kg</span>
										<span className="kpi-label">Seeds Distributed</span>
										<span className="kpi-trend positive">
											{dashboardStats?.distribution.seeds.progress || 0}% of goal
										</span>
									</div>
								</div>

								{/* Fertilizer Distributed */}
								<div className="kpi-card kpi-fertilizer">
									<div className="kpi-icon-wrapper">
										<span className="kpi-icon">🧪</span>
									</div>
									<div className="kpi-details">
										<span className="kpi-value">{(dashboardStats?.distribution.fertilizer.distributed || 0).toLocaleString()} bags</span>
										<span className="kpi-label">Fert. Distributed</span>
										<span className="kpi-trend positive">
											{dashboardStats?.distribution.fertilizer.progress || 0}% of goal
										</span>
									</div>
								</div>

								{/* Active Requests */}
								<div className="kpi-card kpi-requests">
									<div className="kpi-icon-wrapper">
										<span className="kpi-icon">📝</span>
									</div>
									<div className="kpi-details">
										<span className="kpi-value">{dashboardStats?.requests.currentSeason.total || 0}</span>
										<span className="kpi-label">Active Requests</span>
										<span className="kpi-trend warning">
											{dashboardStats?.requests.currentSeason.pending || 0} pending
										</span>
									</div>
								</div>
							</div>

							{/* Middle Section: Progress + Status */}
							<div className="dashboard-middle-row">
								{/* Distribution Progress Card */}
								<div className="dashboard-card progress-card">
									<div className="card-header">
										<h3>Distribution Progress</h3>
										<span className="card-badge">{formatSeason(dashboardStats?.currentSeason || '')}</span>
									</div>
									<div className="card-content">
										<div className="overall-progress">
											<div className="progress-circle-container">
												<div className="progress-circle">
													<svg viewBox="0 0 100 100">
														<circle className="progress-bg" cx="50" cy="50" r="45" />
														<circle
															className="progress-fill-circle"
															cx="50"
															cy="50"
															r="45"
															style={{
																strokeDasharray: `${(dashboardStats?.distribution.overall?.progress || 0) * 2.83} 283`
															}}
														/>
													</svg>
													<div className="progress-text">
														<span className="progress-value">{dashboardStats?.distribution.overall?.progress || 0}%</span>
														<span className="progress-label">Complete</span>
													</div>
												</div>
											</div>
										</div>

										<div className="progress-details">
											<div className="progress-item">
												<div className="progress-item-header">
													<span className="item-label">🧪 Fertilizer</span>
													<span className="item-value">{dashboardStats?.distribution.fertilizer.progress || 0}%</span>
												</div>
												<div className="progress-bar-container">
													<div
														className="progress-bar fertilizer"
														style={{ width: `${dashboardStats?.distribution.fertilizer.progress || 0}%` }}
													></div>
												</div>
												<span className="item-detail">
													{dashboardStats?.distribution.fertilizer.remaining?.toLocaleString() || 0} bags remaining
												</span>
											</div>

											<div className="progress-item">
												<div className="progress-item-header">
													<span className="item-label">🌾 Seeds</span>
													<span className="item-value">{dashboardStats?.distribution.seeds.progress || 0}%</span>
												</div>
												<div className="progress-bar-container">
													<div
														className="progress-bar seeds"
														style={{ width: `${dashboardStats?.distribution.seeds.progress || 0}%` }}
													></div>
												</div>
												<span className="item-detail">
													{dashboardStats?.distribution.seeds.remaining?.toLocaleString() || 0} kg remaining
												</span>
											</div>
										</div>

										<div className="progress-footer">
											<span className="target-date">
												📅 Target: {dashboardStats?.seasonEndDate || 'End of Season'}
											</span>
										</div>
									</div>
								</div>

								{/* Request Status Breakdown Card */}
								<div className="dashboard-card status-card">
									<div className="card-header">
										<h3>Request Status Breakdown</h3>
										<span className="card-subtitle">
											{dashboardStats?.requests.currentSeason?.total || 0} total requests
										</span>
									</div>
									<div className="card-content">
										{hasChartData ? (
											<>
												{/* Pie Chart Circle - Matching Distribution Progress Style */}
												<div className="status-circle-section">
													<div className="status-circle-container">
														<ResponsiveContainer width={120} height={120}>
															<PieChart>
																<Pie
																	data={pieChartData}
																	cx="50%"
																	cy="50%"
																	innerRadius={35}
																	outerRadius={55}
																	paddingAngle={2}
																	dataKey="value"
																>
																	{pieChartData.map((entry, index) => (
																		<Cell key={`cell-${index}`} fill={entry.color} />
																	))}
																</Pie>
																<Tooltip
																	formatter={(value: number, name: string, props: { payload?: { count?: number } }) => [
																		`${value}% (${props.payload?.count || 0})`,
																		name
																	]}
																/>
															</PieChart>
														</ResponsiveContainer>
														<div className="status-circle-label">
															<span className="status-total-value">{dashboardStats?.requests.currentSeason?.total || 0}</span>
															<span className="status-total-label">Total</span>
														</div>
													</div>
												</div>

												{/* Status Progress Bars - Like Distribution Progress */}
												<div className="status-details">
													<div className="status-progress-item">
														<div className="status-progress-header">
															<span className="status-item-label">✅ Approved</span>
															<span className="status-item-value">{dashboardStats?.requests.statusBreakdown?.approved || 0}%</span>
														</div>
														<div className="status-progress-bar-container">
															<div
																className="status-progress-bar approved"
																style={{ width: `${dashboardStats?.requests.statusBreakdown?.approved || 0}%` }}
															></div>
														</div>
														<span className="status-item-detail">
															{dashboardStats?.requests.currentSeason?.approved || 0} requests
														</span>
													</div>

													<div className="status-progress-item">
														<div className="status-progress-header">
															<span className="status-item-label">⏳ Pending</span>
															<span className="status-item-value">{dashboardStats?.requests.statusBreakdown?.pending || 0}%</span>
														</div>
														<div className="status-progress-bar-container">
															<div
																className="status-progress-bar pending"
																style={{ width: `${dashboardStats?.requests.statusBreakdown?.pending || 0}%` }}
															></div>
														</div>
														<span className="status-item-detail">
															{dashboardStats?.requests.currentSeason?.pending || 0} requests
														</span>
													</div>

													<div className="status-progress-item">
														<div className="status-progress-header">
															<span className="status-item-label">❌ Rejected</span>
															<span className="status-item-value">{dashboardStats?.requests.statusBreakdown?.rejected || 0}%</span>
														</div>
														<div className="status-progress-bar-container">
															<div
																className="status-progress-bar rejected"
																style={{ width: `${dashboardStats?.requests.statusBreakdown?.rejected || 0}%` }}
															></div>
														</div>
														<span className="status-item-detail">
															{dashboardStats?.requests.currentSeason?.rejected || 0} requests
														</span>
													</div>

													<div className="status-progress-item">
														<div className="status-progress-header">
															<span className="status-item-label">🚚 Distributed</span>
															<span className="status-item-value">{dashboardStats?.requests.statusBreakdown?.distributed || 0}%</span>
														</div>
														<div className="status-progress-bar-container">
															<div
																className="status-progress-bar distributed"
																style={{ width: `${dashboardStats?.requests.statusBreakdown?.distributed || 0}%` }}
															></div>
														</div>
														<span className="status-item-detail">
															{dashboardStats?.requests.currentSeason?.distributed || 0} requests
														</span>
													</div>
												</div>
											</>
										) : (
											<div className="no-chart-data">
												<span className="no-data-icon">📊</span>
												<p>No request data available</p>
												<span className="no-data-hint">
													Add farmer requests through<br />
													Incentives → Create Allocation → Add Farmer Request
												</span>
											</div>
										)}
									</div>
								</div>
							</div>
						</div>

						{/* Monthly Trends Chart */}
						<div className="dashboard-card trends-card">
							<div className="card-header">
								<h3>Monthly Distribution Trend</h3>
								<span className="card-subtitle">Last 12 Months</span>
							</div>
							<div className="card-content">
								{monthlyTrends.some(m => m.fertilizer > 0 || m.seeds > 0) ? (
									<div className="trends-chart-container">
										<ResponsiveContainer width="100%" height={300}>
											<BarChart data={monthlyTrends} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
												<CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
												<XAxis
													dataKey="monthName"
													tick={{ fontSize: 12, fill: '#6b7280' }}
													axisLine={{ stroke: '#e5e7eb' }}
												/>
												<YAxis
													tick={{ fontSize: 12, fill: '#6b7280' }}
													axisLine={{ stroke: '#e5e7eb' }}
												/>
												<Tooltip
													contentStyle={{
														backgroundColor: '#fff',
														border: '1px solid #e5e7eb',
														borderRadius: '8px',
														boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
													}}
												/>
												<Legend
													wrapperStyle={{ paddingTop: '10px' }}
													iconType="rect"
												/>
												<Bar
													dataKey="fertilizer"
													name="Fertilizer (bags)"
													fill={COLORS.fertilizer}
													radius={[4, 4, 0, 0]}
												/>
												<Bar
													dataKey="seeds"
													name="Seeds (kg)"
													fill={COLORS.seeds}
													radius={[4, 4, 0, 0]}
												/>
											</BarChart>
										</ResponsiveContainer>
									</div>
								) : (
									<div className="no-trends-data">
										<div className="no-trends-visual">
											<div className="empty-bar-chart">
												{['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((m, i) => (
													<div key={m} className="empty-bar-group">
														<div className="empty-bar fertilizer" style={{ height: `${20 + i * 5}%`, opacity: 0.3 }}></div>
														<div className="empty-bar seeds" style={{ height: `${15 + i * 3}%`, opacity: 0.3 }}></div>
														<span className="empty-bar-label">{m}</span>
													</div>
												))}
											</div>
										</div>
										<div className="no-trends-message">
											<span className="no-trends-icon">📊</span>
											<p>No distribution data yet</p>
											<span className="no-trends-hint">
												Distribution records will appear here once farmers receive their allocations.<br />
												Complete the distribution process to see monthly trends.
											</span>
										</div>
									</div>
								)}
							</div>
						</div>
						{/* End of Seasonal Content Wrapper */}
					</div>

					{/* Footer */}
					<div className="dashboard-footer">
						<p>© 2026 Agricultural Distribution Management System • Municipal Agriculture Office</p>
					</div>
				</div>
			</div>
		</div>
	);
};

export default JoDashboard;