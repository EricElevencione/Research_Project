import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Dumangas, Iloilo — same fallback center used in FarmlandMap.tsx, shown
// only until a real geometry is available to fit bounds to.
const DEFAULT_CENTER: [number, number] = [10.865263, 122.6983711];
const DEFAULT_ZOOM = 15;

interface ParcelGeometryPreviewProps {
  geometry: any | null;
  parcelLabel?: string;
  height?: number;
}

// Fits the map to the given geometry's bounds once it's available, and
// invalidates size on mount — needed because this renders inside a modal
// parcel card, where Leaflet often measures a 0x0 container on first
// paint if invalidateSize() isn't called after the container settles.
const FitToGeometry: React.FC<{ geometry: any | null }> = ({ geometry }) => {
  const map = useMap();

  useEffect(() => {
    const invalidate = () => map.invalidateSize();
    const timer = setTimeout(invalidate, 0);
    return () => clearTimeout(timer);
  }, [map]);

  useEffect(() => {
    if (!geometry) return;
    try {
      const layer = L.geoJSON(geometry);
      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [16, 16], maxZoom: 18 });
      }
    } catch (err) {
      console.warn("ParcelGeometryPreview: could not fit bounds:", err);
    }
  }, [geometry, map]);

  return null;
};

const ParcelGeometryPreview: React.FC<ParcelGeometryPreviewProps> = ({
  geometry,
  parcelLabel,
  height = 200,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInViewport, setIsInViewport] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" } // Pre-load map when within 200px of scrolling into view
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const isValidGeometry =
    geometry &&
    typeof geometry === "object" &&
    (geometry.type === "Polygon" || geometry.type === "MultiPolygon");

  if (!isValidGeometry) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8f9fa",
          border: "1px dashed #d0d5dd",
          borderRadius: 8,
          color: "#888",
          fontSize: "0.85em",
        }}
      >
        No plotted geometry for this parcel yet
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        height,
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid #d0d5dd",
        background: "#ebebeb",
      }}
    >
      {isInViewport ? (
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={false}
          dragging={false}
          touchZoom={false}
          doubleClickZoom={false}
          boxZoom={false}
          keyboard={false}
          zoomControl={false}
          attributionControl={false}
          trackResize={false}
          zoomAnimation={false}
          fadeAnimation={false}
          markerZoomAnimation={false}
        >
          {/* Same satellite + labels stack as LandPlottingMap.tsx, so this
              read-only preview matches the plotting page's imagery. */}
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
            opacity={1}
          />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            opacity={1}
          />
          <GeoJSON
            key={parcelLabel || "parcel-geometry"}
            data={geometry}
            style={{
              color: "#15803d",
              weight: 2.5,
              opacity: 1,
              fillColor: "#22c55e",
              fillOpacity: 0.35,
            }}
          />
          <FitToGeometry geometry={geometry} />
        </MapContainer>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#64748b", fontSize: "0.85em" }}>
          Loading map preview...
        </div>
      )}
    </div>
  );
};

export default ParcelGeometryPreview;
