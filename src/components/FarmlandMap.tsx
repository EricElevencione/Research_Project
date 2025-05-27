import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { farmlandData } from '../data/farmlandData';

// Component to handle map centering
const MapController: React.FC<{ data: any }> = ({ data }) => {
    const map = useMap();

    useEffect(() => {
        if (data) {
            // Calculate the center of all features
            const bounds = data.features.reduce((bounds: any, feature: any) => {
                const coordinates = feature.geometry.coordinates[0][0];
                coordinates.forEach((coord: number[]) => {
                    bounds.extend(coord);
                });
                return bounds;
            }, map.getBounds());

            map.fitBounds(bounds);
        }
    }, [data, map]);

    return null;
};

const FarmlandMap: React.FC = () => {
    const [mapData, setMapData] = useState<any>(null);

    useEffect(() => {
        // Load the GeoJSON data
        setMapData(farmlandData);
    }, []);

    const getColor = (area: number) => {
        // Color scale based on area
        if (area <= 1) return '#fee5d9';
        if (area <= 2) return '#fcae91';
        if (area <= 3) return '#fb6a4a';
        if (area <= 4) return '#de2d26';
        return '#a50f15';
    };

    const style = (feature: any) => {
        return {
            fillColor: getColor(feature.properties.area_ha),
            weight: 2,
            opacity: 1,
            color: 'white',
            dashArray: '3',
            fillOpacity: 0.7
        };
    };

    const onEachFeature = (feature: any, layer: any) => {
        layer.bindPopup(
            `Area: ${feature.properties.area_ha} hectares`
        );
    };

    return (
        <div style={{ height: '500px', width: '100%', position: 'relative' }}>
            <MapContainer
                center={[0, 0]}
                zoom={2}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                {mapData && (
                    <>
                        <GeoJSON
                            data={mapData}
                            style={style}
                            onEachFeature={onEachFeature}
                        />
                        <MapController data={mapData} />
                    </>
                )}
            </MapContainer>
        </div>
    );
};

export default FarmlandMap; 