import React, { useState } from 'react';
import type { BarangayCompletionStat } from '../../hooks/useTechnicianDashboardStats';
import './TechnicianBarangayChecklist.css';

interface BarangayCompletionChecklistProps {
    barangayStats: BarangayCompletionStat[];
}

export const BarangayCompletionChecklist: React.FC<BarangayCompletionChecklistProps> = ({ barangayStats }) => {
    const [expandedBarangay, setExpandedBarangay] = useState<string | null>(null);

    const totalBarangays = barangayStats.length;
    const completedBarangays = barangayStats.filter(b => b.isComplete).length;
    const completionPercentage = totalBarangays > 0 ? Math.round((completedBarangays / totalBarangays) * 100) : 0;

    return (
        <div className="tech-barangay-checklist-container">
            <div className="tech-barangay-checklist-header">
                <div>
                    <h3>📋 Barangay Completion Checklist</h3>
                    <p className="tech-barangay-checklist-subtitle">
                        {completedBarangays} of {totalBarangays} barangays fully plotted
                    </p>
                </div>
                <div className="tech-barangay-overall-progress">
                    <div className="tech-barangay-progress-bar">
                        <div
                            className="tech-barangay-progress-fill"
                            style={{ width: `${completionPercentage}%` }}
                        />
                    </div>
                    <span className="tech-barangay-progress-text">{completionPercentage}%</span>
                </div>
            </div>

            <div className="tech-barangay-checklist-table">
                <table>
                    <thead>
                        <tr>
                            <th>Barangay</th>
                            <th className="tech-align-center">Farmers</th>
                            <th className="tech-align-center">Plotted Parcels</th>
                            <th className="tech-align-center">Coverage %</th>
                            <th className="tech-align-center">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {barangayStats.map((barangay) => (
                            <tr
                                key={barangay.barangayName}
                                className={barangay.isComplete ? 'tech-row-complete' : 'tech-row-incomplete'}
                                onClick={() =>
                                    setExpandedBarangay(
                                        expandedBarangay === barangay.barangayName ? null : barangay.barangayName
                                    )
                                }
                            >
                                <td className="tech-barangay-name">{barangay.barangayName}</td>
                                <td className="tech-align-center">{barangay.farmerCount}</td>
                                <td className="tech-align-center">{barangay.plottedParcelsCount}</td>
                                <td className="tech-align-center">
                                    <div className="tech-coverage-bar">
                                        <div
                                            className="tech-coverage-fill"
                                            style={{
                                                width: `${barangay.completionPercentage}%`,
                                                backgroundColor: barangay.completionPercentage === 100 ? '#22c55e' : '#f59e0b',
                                            }}
                                        />
                                    </div>
                                    <span className="tech-coverage-text">{barangay.completionPercentage}%</span>
                                </td>
                                <td className="tech-align-center">
                                    {barangay.isComplete ? (
                                        <span className="tech-status-complete">✅ Complete</span>
                                    ) : (
                                        <span className="tech-status-incomplete">
                                            ⏳ {barangay.farmerCount - barangay.plottedParcelsCount} pending
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="tech-barangay-checklist-footer">
                <div className="tech-checklist-stats">
                    <div className="tech-stat">
                        <span className="tech-stat-label">Total Barangays:</span>
                        <span className="tech-stat-value">{totalBarangays}</span>
                    </div>
                    <div className="tech-stat">
                        <span className="tech-stat-label">Complete:</span>
                        <span className="tech-stat-value" style={{ color: '#22c55e' }}>
                            {completedBarangays}
                        </span>
                    </div>
                    <div className="tech-stat">
                        <span className="tech-stat-label">Pending:</span>
                        <span className="tech-stat-value" style={{ color: '#f59e0b' }}>
                            {totalBarangays - completedBarangays}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
