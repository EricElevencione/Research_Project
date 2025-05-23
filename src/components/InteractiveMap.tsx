// c:\Users\dblaz\Research-Project\src\components\InteractiveMap.tsx
import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './MapStyles.css';

interface PropertyData {
  id: number;
  name: string;
  landlord: string;
  position: [number, number];
}

const properties: PropertyData[] = [
  {
    id: 1,
    name: "Downtown Office",
    landlord: "John Smith",
    position: [40.7128, -74.0060] // Example coordinates
  },
  {
    id: 2,
    name: "Uptown Apartment",
    landlord: "Jane Doe",
    position: [40.7306, -73.9352] // Example coordinates
  }
];

const InteractiveMap: React.FC = () => {
  return (
    <MapContainer 
      center={[40.7128, -74.0060]} 
      zoom={13} 
      className="map-container"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      
      {properties.map(property => (
        <Marker 
          key={property.id} 
          position={property.position}
        >
          <Popup>
            <div className="popup-content">
              <h3>{property.name}</h3>
              <p><strong>Landlord:</strong> {property.landlord}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default InteractiveMap;