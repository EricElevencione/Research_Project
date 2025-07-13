import React from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface MiniMapProps {
    barangayName: string;
    height?: string;
    width?: string;
}

// Hardcoded center coordinates for demonstration
const barangayCenters: Record<string, [number, number]> = {
    Calao: [10.825, 122.715], // Replace with actual coordinates
    Lacturan: [10.830, 122.720], // Replace with actual coordinates
};

const MiniMap: React.FC<MiniMapProps> = ({ barangayName, height = '120px', width = '100%' }) => {
    const center = barangayCenters[barangayName] || [10.825, 122.715];

    return (
        <div style={{ height, width, borderRadius: '8px', overflow: 'hidden', border: '1px solid #ccc' }}>
            <MapContainer
                center={center}
                zoom={15}
                style={{ height: '100%', width: '100%' }}
                dragging={false}
                touchZoom={false}
                scrollWheelZoom={false}
                doubleClickZoom={false}
                boxZoom={false}
                keyboard={false}
                zoomControl={false}
                attributionControl={false}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="&copy; OpenStreetMap contributors"
                />
            </MapContainer>
        </div>
    );
};

export default MiniMap; 