import React from 'react';
import type { DataQualityMetrics } from '../../hooks/useTechnicianDashboardStats';
import './TechnicianDataQualityCards.css';

interface DataQualityCardsProps {
    metrics: DataQualityMetrics;
}

export const DataQualityCards: React.FC<DataQualityCardsProps> = ({ metrics }) => {
    const cards = [
        {
            label: 'Registered Farmers',
            value: metrics.totalRegisteredFarmers,
            icon: '👨‍🌾',
            color: '#16a34a',
            bgGradient: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
            borderColor: '#86efac',
            suffix: '',
        },
        {
            label: 'No Plotted Lands',
            value: metrics.unplottedFarmersCount,
            icon: '⚠️',
            color: '#dc2626',
            bgGradient: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
            borderColor: '#fca5a5',
            suffix: '',
        },
        {
            label: 'Plotted Parcels',
            value: metrics.plottedParcelsCount,
            icon: '📍',
            color: '#0ea5e9',
            bgGradient: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
            borderColor: '#7dd3fc',
            suffix: '',
        },
        {
            label: 'Data Quality',
            value: metrics.dataQualityPercentage,
            icon: '✅',
            color: '#8b5cf6',
            bgGradient: 'linear-gradient(135deg, #faf5ff 0%, #ede9fe 100%)',
            borderColor: '#c4b5fd',
            suffix: '%',
        },
    ];

    return (
        <div className="tech-data-quality-grid">
            {cards.map((card, idx) => (
                <div
                    key={idx}
                    className="tech-data-quality-card"
                    style={{
                        background: card.bgGradient,
                        borderColor: card.borderColor,
                    }}
                >
                    <div className="tech-data-quality-icon">{card.icon}</div>
                    <div className="tech-data-quality-content">
                        <div className="tech-data-quality-value" style={{ color: card.color }}>
                            {typeof card.value === 'number'
                                ? card.value.toLocaleString()
                                : card.value}
                            {card.suffix}
                        </div>
                        <div className="tech-data-quality-label">{card.label}</div>
                    </div>
                </div>
            ))}
        </div>
    );
};
