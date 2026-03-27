import React, { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  LayersControl,
  LayerGroup,
  useMap,
  Marker,
  Popup,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { FeatureCollection } from "geojson"; // Import FeatureCollection and Feature types
import { getLandPlots, getCropPlantingInfo } from "../../api";

// Fix for default marker icons in Leaflet with React
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import L from "leaflet";

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface FarmlandMapProps {
  onLandPlotSelect?: (properties: any) => void;
  highlightGeometry?: any | null;
  highlightMatcher?: ((properties: any) => boolean) | null;
  farmerDensity?: Record<string, number>;
  dashboardMode?: boolean;
  unplottedByBarangay?: Record<string, number>;
  hideLegend?: boolean;
}

const FarmlandMap: React.FC<FarmlandMapProps> = ({
  onLandPlotSelect,
  highlightGeometry,
  highlightMatcher,
  farmerDensity: _farmerDensity,
  dashboardMode,
  unplottedByBarangay,
  hideLegend,
}) => {
  const [farmlandRecords, setFarmlandRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Removed unused error state
  const [municipalBoundaryData, setMunicipalBoundaryData] = useState<any>(null);
  const [barangayBoundaries, setBarangayBoundaries] = useState<{
    [key: string]: any;
  }>({});
  const [parcelCountsByBarangay, setParcelCountsByBarangay] = useState<
    Record<string, number>
  >({});
  const [boundaryLoading, setBoundaryLoading] = useState(true);
  const [boundaryError, setBoundaryError] = useState<string | null>(null);

  const formatDisplayDate = (value: string | null | undefined) => {
    if (!value) return "N/A";
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) return "N/A";
    return parsed.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const escapeHtml = (value: unknown) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");

  // Helper to fetch crop/planting info by farmer name and location (uses Supabase directly)
  const fetchCropPlantingInfo = async (
    surname: string,
    firstName: string,
    middleName: string,
    barangay: string,
    ffrsId?: string,
    farmerId?: string | number,
  ) => {
    try {
      if (
        (!surname && !firstName && !ffrsId && !farmerId) ||
        (!barangay && !ffrsId && !farmerId)
      ) {
        console.log("Missing required fields for crop/planting info:", {
          surname,
          firstName,
          middleName,
          barangay,
          ffrsId,
          farmerId,
        });
        return { owner: null, tenants: [], landHistory: [] };
      }
      console.log("Fetching crop info via Supabase for:", {
        surname,
        firstName,
        middleName,
        barangay,
        ffrsId,
        farmerId,
      });
      const identityHint = ffrsId
        ? String(ffrsId)
        : farmerId !== undefined && farmerId !== null && String(farmerId).trim()
          ? `farmer_id:${String(farmerId).trim()}`
          : undefined;
      const result = await getCropPlantingInfo(
        surname,
        firstName,
        middleName,
        barangay,
        identityHint,
      );
      console.log("Crop info result:", result);
      return result;
    } catch (err) {
      console.error("Error fetching crop/planting info:", err);
      return { owner: null, tenants: [], landHistory: [] };
    }
  };

  useEffect(() => {
    const fetchFarmlandRecords = async () => {
      try {
        setLoading(true);
        const response = await getLandPlots();
        if (!response.error) {
          const data = response.data || [];
          setFarmlandRecords(Array.isArray(data) ? data : []);
        } else {
          console.warn("Error fetching land plots:", response.error);
          setFarmlandRecords([]);
        }
      } catch (err: any) {
        console.warn("Error fetching farmland records (non-blocking):", err);
        setFarmlandRecords([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFarmlandRecords();

    // Listen for land-plot-saved event to refresh
    const handleRefresh = () => {
      fetchFarmlandRecords();
    };
    window.addEventListener("land-plot-saved", handleRefresh);
    return () => {
      window.removeEventListener("land-plot-saved", handleRefresh);
    };
  }, []);

  useEffect(() => {
    const fetchBoundaryData = async () => {
      try {
        setBoundaryLoading(true);
        setBoundaryError(null);

        const base = ((import.meta as any)?.env?.BASE_URL || "/").replace(
          /\/$/,
          "",
        );
        const candidates = [
          `${base}/Dumangas_map.json`,
          "/Dumangas_map.json",
          "Dumangas_map.json",
        ];
        let municipalData: any | null = null;
        let lastErr: any = null;
        for (const url of candidates) {
          try {
            console.log("Fetching municipal boundary:", url);
            const resp = await fetch(url);
            if (resp.ok) {
              municipalData = await resp.json();
              break;
            } else {
              lastErr = new Error(
                `Failed to fetch municipal boundary data: ${resp.status} ${resp.statusText}`,
              );
            }
          } catch (e) {
            lastErr = e;
          }
        }
        if (!municipalData)
          throw lastErr || new Error("Failed to fetch municipal boundary");
        if (!municipalData || !municipalData.type || !municipalData.features) {
          throw new Error("Invalid municipal boundary GeoJSON data format");
        }
        setMunicipalBoundaryData(municipalData);

        // Remove fetching of individual barangay boundaries
        setBarangayBoundaries({});
      } catch (err: any) {
        console.error("Error fetching boundary data:", err);
        setBoundaryError(err.message || "Failed to load boundary data");
      } finally {
        setBoundaryLoading(false);
      }
    };

    fetchBoundaryData();
  }, []);

  // Choropleth helpers
  useEffect(() => {
    const counts: Record<string, number> = {};
    farmlandRecords.forEach((rec: any) => {
      const name: string = (
        rec.barangay ||
        rec.farmLocationBarangay ||
        ""
      ).toString();
      if (!name) return;
      counts[name] = (counts[name] || 0) + 1;
    });
    setParcelCountsByBarangay(counts);
  }, [farmlandRecords]);

  // Fallback styles for non-choropleth layers (in case they are still rendered)
  const getMunicipalStyle = () => ({
    color: "#134e4a",
    weight: 1,
    opacity: 1,
    fillOpacity: 0,
  });

  const getBarangayStyle = () => ({
    color: "#3498db",
    weight: 1,
    opacity: 0.6,
    fillOpacity: 0,
  });

  // Dashboard mode: compute barangay centroids for red markers
  const [barangayCentroids, setBarangayCentroids] = useState<
    Record<string, [number, number]>
  >({});
  const [barangayMunicipalities, setBarangayMunicipalities] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    if (!municipalBoundaryData || !dashboardMode) return;

    const centroids: Record<string, [number, number]> = {};
    const municipalities: Record<string, string> = {};
    const computeCentroid = (geometry: any): [number, number] | null => {
      if (!geometry?.coordinates) return null;
      let sumLat = 0,
        sumLng = 0,
        count = 0;
      const walk = (coords: any) => {
        if (
          Array.isArray(coords) &&
          coords.length >= 2 &&
          typeof coords[0] === "number"
        ) {
          sumLng += coords[0];
          sumLat += coords[1];
          count++;
        } else if (Array.isArray(coords)) {
          coords.forEach(walk);
        }
      };
      walk(geometry.coordinates);
      return count > 0 ? [sumLat / count, sumLng / count] : null;
    };

    (municipalBoundaryData.features || []).forEach((feature: any) => {
      const name =
        feature.properties?.NAME_3 || feature.properties?.barangay || "";
      const municipality =
        feature.properties?.NAME_2 || feature.properties?.municipality || "";
      if (name && feature.geometry) {
        const c = computeCentroid(feature.geometry);
        if (c) centroids[name] = c;
        if (municipality) municipalities[name] = municipality;
      }
    });
    setBarangayCentroids(centroids);
    setBarangayMunicipalities(municipalities);
  }, [municipalBoundaryData, dashboardMode]);

  const findCentroid = (brgyName: string): [number, number] | null => {
    if (barangayCentroids[brgyName]) return barangayCentroids[brgyName];
    const lower = brgyName.toLowerCase().trim();
    for (const [key, val] of Object.entries(barangayCentroids)) {
      if (key.toLowerCase().trim() === lower) return val;
    }
    return null;
  };

  const findMunicipality = (brgyName: string): string => {
    if (barangayMunicipalities[brgyName])
      return barangayMunicipalities[brgyName];
    const lower = brgyName.toLowerCase().trim();
    for (const [key, val] of Object.entries(barangayMunicipalities)) {
      if (key.toLowerCase().trim() === lower) return val;
    }
    return "Dumangas";
  };

  const DashboardLegend: React.FC = () => {
    const map = useMap();
    useEffect(() => {
      const legend = new L.Control({ position: "bottomright" });
      legend.onAdd = () => {
        const div = L.DomUtil.create("div", "tech-map-legend");
        div.innerHTML = `
                    <div style="background:white;padding:10px 14px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.25);font-size:12px;font-family:inherit;">
                        <div style="font-weight:700;margin-bottom:6px;color:#1f2937;">Map Legend</div>
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
                            <span style="display:inline-block;width:16px;height:16px;background:#22c55e;border:2px solid #15803d;border-radius:3px;"></span>
                            <span>Plotted Parcels</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;">
                            <span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;background:#ef4444;border-radius:50%;color:white;font-size:9px;font-weight:700;">!</span>
                            <span>Unplotted Farmers</span>
                        </div>
                    </div>`;
        return div;
      };
      legend.addTo(map);
      return () => {
        legend.remove();
      };
    }, [map]);
    return null;
  };

  if (loading || boundaryLoading) {
    return <div>Loading map data...</div>;
  }

  if (boundaryError) {
    return <div>Error loading boundary data: {boundaryError}</div>;
  }

  console.log(
    "Rendering map choropleth; parcel counts:",
    parcelCountsByBarangay,
  );

  const MapSizeInvalidator: React.FC = () => {
    const map = useMap();
    useEffect(() => {
      const invalidate = () => map.invalidateSize();
      setTimeout(invalidate, 0);
      window.addEventListener("resize", invalidate);
      return () => {
        window.removeEventListener("resize", invalidate);
      };
    }, [map]);
    return null;
  };

  return (
    <MapContainer
      center={[10.865263, 122.6983711]}
      zoom={13}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={true}
      doubleClickZoom={true}
      dragging={true}
      touchZoom={true}
      boxZoom={true}
      keyboard={true}
      zoomControl={true}
      attributionControl={true}
    >
      <MapSizeInvalidator />
      <LayersControl position="topright">
        <LayersControl.BaseLayer name="Hybrid (Imagery + Roads/Labels)">
          <LayerGroup>
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
              opacity={1}
            />
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
              opacity={0.9}
            />
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
              opacity={0.9}
            />
          </LayerGroup>
        </LayersControl.BaseLayer>

        <LayersControl.BaseLayer
          checked
          name="Carto Voyager (Roads/Buildings/Landuse)"
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap contributors'
            opacity={1}
          />
        </LayersControl.BaseLayer>

        <LayersControl.Overlay checked name="Municipal Boundary">
          {municipalBoundaryData && (
            <GeoJSON
              key="municipal-boundary"
              data={municipalBoundaryData}
              style={getMunicipalStyle}
            />
          )}
        </LayersControl.Overlay>

        {dashboardMode && (
          <LayersControl.Overlay checked name="Barangay Labels">
            <LayerGroup>
              {Object.entries(barangayCentroids).map(([brgyName, position]) => {
                const municipality = findMunicipality(brgyName);
                return (
                  <Marker
                    key={`label-${brgyName}`}
                    position={position}
                    interactive={false}
                    zIndexOffset={-800}
                    icon={L.divIcon({
                      className: "",
                      html: `<div style="
                        background: rgba(255,255,255,0.86);
                        border: 1px solid rgba(30, 64, 175, 0.2);
                        border-radius: 6px;
                        padding: 2px 6px;
                        line-height: 1.15;
                        text-align: center;
                        box-shadow: 0 1px 4px rgba(0,0,0,0.16);
                        min-width: 72px;
                        white-space: nowrap;
                        pointer-events: none;
                      ">
                        <div style="font-size: 10px; font-weight: 700; color: #1f2937;">${brgyName}</div>
                        <div style="font-size: 9px; color: #334155;">${municipality}</div>
                      </div>`,
                      iconSize: [120, 30],
                      iconAnchor: [60, 15],
                    })}
                  />
                );
              })}
            </LayerGroup>
          </LayersControl.Overlay>
        )}

        {Object.entries(barangayBoundaries).map(([name, data]) => (
          <LayersControl.Overlay
            key={`overlay-${name}`}
            checked
            name={`Barangay: ${name}`}
          >
            <GeoJSON
              key={`barangay-boundary-${name}`}
              data={data}
              style={getBarangayStyle}
            />
          </LayersControl.Overlay>
        ))}

        {farmlandRecords && farmlandRecords.length > 0 && (
          <LayersControl.Overlay checked name="Farmland Parcels">
            <GeoJSON
              key="farmland-data"
              data={
                {
                  type: "FeatureCollection",
                  features: farmlandRecords
                    .map((record) => {
                      if (
                        record.geometry &&
                        (record.geometry.type === "Polygon" ||
                          record.geometry.type === "MultiPolygon")
                      ) {
                        return {
                          type: "Feature",
                          geometry: record.geometry,
                          properties: {
                            ...record,
                          },
                        };
                      }
                      return null;
                    })
                    .filter(Boolean),
                } as FeatureCollection
              }
              style={(feature: any) => {
                if (dashboardMode) {
                  return {
                    color: "#15803d",
                    weight: 2,
                    opacity: 0.9,
                    fillColor: "#22c55e",
                    fillOpacity: 0.5,
                  };
                }
                const props = feature?.properties || {};
                const isHighlighted =
                  typeof highlightMatcher === "function"
                    ? !!highlightMatcher(props)
                    : false;
                return isHighlighted
                  ? {
                      color: "#e74c3c",
                      weight: 3,
                      opacity: 1,
                      fillOpacity: 0.2,
                    }
                  : {
                      color: "blue",
                      weight: 2,
                      opacity: 0.8,
                      fillOpacity: 0.5,
                    };
              }}
              filter={(feature) =>
                !!feature.geometry &&
                (feature.geometry.type === "Polygon" ||
                  feature.geometry.type === "MultiPolygon")
              }
              onEachFeature={(feature, layer) => {
                if (feature.properties) {
                  // Debug: Log all available properties
                  console.log(
                    "Feature properties:",
                    JSON.stringify(feature.properties, null, 2),
                  );
                  console.log(
                    "Available property keys:",
                    Object.keys(feature.properties),
                  );

                  // Get name parts from land_plot properties
                  const surname =
                    feature.properties.surname ||
                    feature.properties.last_name ||
                    "";
                  const firstName =
                    feature.properties.firstName ||
                    feature.properties.first_name ||
                    "";
                  const ffrsId =
                    feature.properties.ffrs_id ||
                    feature.properties.ffrsId ||
                    "";
                  const farmerId =
                    feature.properties.farmer_id ||
                    feature.properties.farmerId ||
                    "";
                  const location = feature.properties.barangay || "";
                  // Use a unique ID based on feature properties (sanitized for DOM)
                  const featureId =
                    feature.properties.id ||
                    feature.properties.gid ||
                    `${firstName}-${surname}-${location}`;
                  const featureKey = String(featureId).replace(
                    /[^a-zA-Z0-9-_]/g,
                    "_",
                  );

                  console.log(
                    "Map click - featureKey:",
                    featureKey,
                    "firstName:",
                    firstName,
                    "surname:",
                    surname,
                    "ffrsId:",
                    ffrsId,
                    "farmerId:",
                    farmerId,
                  );

                  // Initial popup content with crop/planting info
                  let popupContent = `<div class="farmland-popup-container" style="min-width: 320px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                        <div class="farmland-popup-crops-section" style="padding-top: 8px;">
                                            <div class="farmland-popup-crops-title" style="font-weight: 600; color: #16a34a; margin-bottom: 6px; font-size: 0.9em;">🌾 Crops & Planting Info</div>
                                            <div id="crops-cell-${featureKey}" class="farmland-popup-crops-content" style="color: #6c757d; font-style: italic;">Loading...</div>
                                        </div>
                                    </div>`;
                  layer.bindPopup(popupContent, {
                    maxWidth: 600,
                    maxHeight: 500,
                  });

                  layer.on({
                    click: async () => {
                      if (onLandPlotSelect) {
                        onLandPlotSelect(feature.properties);
                      }

                      // Check both camelCase and snake_case field names
                      const surname =
                        feature.properties.surname ||
                        feature.properties.last_name ||
                        "";
                      const firstName =
                        feature.properties.firstName ||
                        feature.properties.first_name ||
                        "";
                      const middleName =
                        feature.properties.middleName ||
                        feature.properties.middle_name ||
                        "";
                      const ffrsId =
                        feature.properties.ffrs_id ||
                        feature.properties.ffrsId ||
                        "";
                      const farmerId =
                        feature.properties.farmer_id ||
                        feature.properties.farmerId ||
                        "";
                      // Fetch crop/planting info
                      console.log("Fetching crop/planting info for:", {
                        surname,
                        firstName,
                        middleName,
                        barangay: location,
                        ffrsId,
                        farmerId,
                      });
                      console.log("Feature properties:", feature.properties);
                      const cropInfo = await fetchCropPlantingInfo(
                        surname,
                        firstName,
                        middleName,
                        location,
                        ffrsId,
                        farmerId,
                      );
                      setTimeout(() => {
                        const cell = document.getElementById(
                          `crops-cell-${featureKey}`,
                        );
                        const landHistory = Array.isArray(cropInfo?.landHistory)
                          ? cropInfo.landHistory
                          : [];

                        if (cell) {
                          if (
                            !cropInfo.owner &&
                            cropInfo.tenants.length === 0 &&
                            landHistory.length === 0
                          ) {
                            cell.innerHTML =
                              '<div class="farmland-popup-no-data" style="color: #6c757d; padding: 8px; text-align: center; background: #f8f9fa; border-radius: 4px;">No owner or history information found for this parcel.</div>';
                          } else {
                            let html = `<div class="farmland-popup-crops-list" style="max-height: 300px; overflow-y: auto;">`;

                            // Owner section
                            if (cropInfo.owner) {
                              const ownerStatusColor =
                                cropInfo.owner.ownership_status === "Owner"
                                  ? "#16a34a"
                                  : cropInfo.owner.ownership_status === "Tenant"
                                    ? "#f59e0b"
                                    : "#6366f1";
                              const ownerRegDate = cropInfo.owner
                                .registration_date
                                ? new Date(
                                    cropInfo.owner.registration_date,
                                  ).toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  })
                                : "N/A";
                              html += `<div class="farmland-popup-owner-section">`;
                              html += `<div class="farmland-popup-section-title" style="font-size: 0.85em; color: #16a34a; font-weight: 600; margin-bottom: 8px; padding-left: 4px;">🏠 Land Owner</div>`;
                              html += `<div class="farmland-popup-farmer-card" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid #86efac; border-radius: 8px; padding: 12px; margin-bottom: 10px;">`;
                              html += `<div class="farmland-popup-farmer-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">`;
                              html += `<span class="farmland-popup-farmer-name" style="font-weight: 600; color: #166534; font-size: 0.9em;">👤 ${cropInfo.owner.farmer_name}</span>`;
                              html += `<span class="farmland-popup-farmer-status" style="background: ${ownerStatusColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.75em; font-weight: 600;">${cropInfo.owner.ownership_status}</span>`;
                              html += `</div>`;
                              html += `<div class="farmland-popup-farmer-barangay" style="font-size: 0.75em; color: #166534; margin-bottom: 4px;">📍 Barangay: <strong>${location || cropInfo.owner.barangay || "N/A"}</strong></div>`;
                              html += `<div class="farmland-popup-farmer-date" style="font-size: 0.75em; color: #6b7280; margin-bottom: 8px;">📅 Registered: ${ownerRegDate}</div>`;
                              html += `<div class="farmland-popup-crops-label" style="font-size: 0.8em; color: #4b5563; margin-bottom: 4px;">Crops planted:</div>`;
                              html += `<div class="farmland-popup-crops-tags" style="display: flex; flex-wrap: wrap; gap: 6px;">`;
                              cropInfo.owner.crops.forEach((crop: string) => {
                                const cropColor = crop
                                  .toLowerCase()
                                  .includes("rice")
                                  ? "#22c55e"
                                  : crop.toLowerCase().includes("corn")
                                    ? "#eab308"
                                    : crop.toLowerCase().includes("livestock")
                                      ? "#f97316"
                                      : crop.toLowerCase().includes("poultry")
                                        ? "#ef4444"
                                        : "#8b5cf6";
                                html += `<span class="farmland-popup-crop-tag" style="background: ${cropColor}; color: white; padding: 3px 10px; border-radius: 12px; font-size: 0.8em; font-weight: 500;">🌱 ${crop}</span>`;
                              });
                              html += `</div></div></div>`;
                            }

                            // Tenants section with separator
                            if (
                              cropInfo.tenants &&
                              cropInfo.tenants.length > 0
                            ) {
                              // Add separator line between owner and tenants
                              if (cropInfo.owner) {
                                html += `<hr style="border: none; border-top: 2px dashed #d1d5db; margin: 12px 0;">`;
                              }
                              html += `<div class="farmland-popup-tenants-section">`;
                              html += `<div class="farmland-popup-tenants-title" style="font-size: 0.85em; color: #f59e0b; font-weight: 600; margin-bottom: 8px; padding-left: 4px;">👥 Tenants/Lessees on this land:</div>`;
                              cropInfo.tenants.forEach((tenant: any) => {
                                const tenantRegDate = tenant.registration_date
                                  ? new Date(
                                      tenant.registration_date,
                                    ).toLocaleDateString("en-US", {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                    })
                                  : "N/A";
                                html += `<div class="farmland-popup-tenant-card" style="background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 1px solid #fcd34d; border-radius: 8px; padding: 10px; margin-bottom: 8px;">`;
                                html += `<div class="farmland-popup-tenant-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">`;
                                html += `<span class="farmland-popup-tenant-name" style="font-weight: 600; color: #92400e; font-size: 0.85em;">👤 ${tenant.farmer_name}</span>`;
                                html += `<span class="farmland-popup-tenant-status" style="background: #f59e0b; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7em; font-weight: 600;">Tenant</span>`;
                                html += `</div>`;
                                html += `<div class="farmland-popup-tenant-date" style="font-size: 0.7em; color: #6b7280; margin-bottom: 6px;">📅 Registered: ${tenantRegDate}</div>`;
                                html += `<div class="farmland-popup-tenant-crops-label" style="font-size: 0.75em; color: #6b7280; margin-bottom: 4px;">Crops planted:</div>`;
                                html += `<div class="farmland-popup-tenant-crops-tags" style="display: flex; flex-wrap: wrap; gap: 4px;">`;
                                tenant.crops.forEach((crop: string) => {
                                  const cropColor = crop
                                    .toLowerCase()
                                    .includes("rice")
                                    ? "#22c55e"
                                    : crop.toLowerCase().includes("corn")
                                      ? "#eab308"
                                      : crop.toLowerCase().includes("livestock")
                                        ? "#f97316"
                                        : crop.toLowerCase().includes("poultry")
                                          ? "#ef4444"
                                          : "#8b5cf6";
                                  html += `<span class="farmland-popup-tenant-crop-tag" style="background: ${cropColor}; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.75em; font-weight: 500;">🌱 ${crop}</span>`;
                                });
                                html += `</div></div>`;
                              });
                              html += `</div>`;
                            }

                            // Land history section
                            if (landHistory.length > 0) {
                              if (
                                cropInfo.owner ||
                                cropInfo.tenants.length > 0
                              ) {
                                html += `<hr style="border: none; border-top: 2px dashed #d1d5db; margin: 12px 0;">`;
                              }

                              const sortedHistory = [...landHistory].sort(
                                (a: any, b: any) => {
                                  const aTime = new Date(
                                    a?.period_start_date || a?.created_at || 0,
                                  ).getTime();
                                  const bTime = new Date(
                                    b?.period_start_date || b?.created_at || 0,
                                  ).getTime();
                                  return bTime - aTime;
                                },
                              );

                              html += `<div class="farmland-popup-history-section">`;
                              html += `<div class="farmland-popup-section-title" style="font-size: 0.85em; color: #1d4ed8; font-weight: 600; margin-bottom: 8px; padding-left: 4px;">🕒 Land History</div>`;

                              sortedHistory.forEach((record: any) => {
                                const changeType =
                                  record?.change_type || "Update";
                                const periodStart = formatDisplayDate(
                                  record?.period_start_date ||
                                    record?.created_at,
                                );
                                const periodEnd = formatDisplayDate(
                                  record?.period_end_date,
                                );
                                const actorName =
                                  record?.farmer_name ||
                                  record?.land_owner_name ||
                                  "Unknown";
                                const parcelNo =
                                  record?.parcel_number ||
                                  feature.properties?.parcel_number ||
                                  "N/A";

                                const transferredArea = Number(
                                  record?.transferred_area_ha,
                                );
                                const totalArea = Number(
                                  record?.total_farm_area_ha,
                                );
                                const areaLabel = Number.isFinite(
                                  transferredArea,
                                )
                                  ? `${transferredArea.toFixed(4)} ha transferred`
                                  : Number.isFinite(totalArea)
                                    ? `${totalArea.toFixed(4)} ha`
                                    : "Area N/A";

                                html += `<div class="farmland-popup-history-card" style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px; margin-bottom: 8px;">`;
                                html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;gap:8px;">`;
                                html += `<span style="font-weight:600;color:#1e3a8a;font-size:0.82em;">${escapeHtml(changeType)}</span>`;
                                html += `<span style="font-size:0.72em;color:#334155;">Parcel ${escapeHtml(parcelNo)}</span>`;
                                html += `</div>`;
                                html += `<div style="font-size:0.76em;color:#334155;margin-bottom:4px;">👤 ${escapeHtml(actorName)}</div>`;
                                html += `<div style="font-size:0.74em;color:#475569;margin-bottom:4px;">📅 ${periodStart}${periodEnd !== "N/A" ? ` → ${periodEnd}` : ""}</div>`;
                                html += `<div style="font-size:0.74em;color:#0f172a;margin-bottom:4px;">📐 ${escapeHtml(areaLabel)}</div>`;
                                if (record?.notes) {
                                  html += `<div style="font-size:0.72em;color:#475569;background:#dbeafe;padding:6px;border-radius:6px;">📝 ${escapeHtml(record.notes)}</div>`;
                                }
                                html += `</div>`;
                              });

                              html += `</div>`;
                            }

                            html += `</div>`;
                            cell.innerHTML = html;
                          }
                        }
                      }, 100);
                    },
                  });
                }
              }}
            />
          </LayersControl.Overlay>
        )}

        {highlightGeometry && (
          <LayersControl.Overlay checked name="Hovered Parcel">
            <GeoJSON
              key="highlight-geometry"
              data={
                {
                  type: "FeatureCollection",
                  features: [
                    {
                      type: "Feature",
                      geometry: highlightGeometry,
                      properties: {},
                    },
                  ],
                } as any
              }
              style={() => ({
                color: "#e74c3c",
                weight: 3,
                opacity: 1,
                fillOpacity: 0.2,
              })}
            />
          </LayersControl.Overlay>
        )}
      </LayersControl>
      {dashboardMode && !hideLegend && <DashboardLegend />}

      {dashboardMode &&
        unplottedByBarangay &&
        Object.entries(unplottedByBarangay).map(([brgyName, count]) => {
          const centroid = findCentroid(brgyName);
          const municipality = findMunicipality(brgyName);
          if (!centroid || count === 0) return null;
          return (
            <Marker
              key={`unplotted-${brgyName}`}
              position={centroid}
              icon={L.divIcon({
                className: "",
                html: `<div style="
                                background:#ef4444;
                                color:white;
                                border-radius:50%;
                                width:${Math.min(20 + count * 2, 44)}px;
                                height:${Math.min(20 + count * 2, 44)}px;
                                display:flex;
                                align-items:center;
                                justify-content:center;
                                font-size:${count > 99 ? 10 : 12}px;
                                font-weight:700;
                                border:2px solid #b91c1c;
                                box-shadow:0 2px 6px rgba(0,0,0,.35);
                            ">${count}</div>`,
                iconSize: [
                  Math.min(20 + count * 2, 44),
                  Math.min(20 + count * 2, 44),
                ],
                iconAnchor: [
                  Math.min(20 + count * 2, 44) / 2,
                  Math.min(20 + count * 2, 44) / 2,
                ],
              })}
            >
              <Popup>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  {brgyName}
                </div>
                <div style={{ color: "#475569", marginBottom: 4 }}>
                  {municipality}
                </div>
                <div>
                  {count} unplotted farmer{count !== 1 ? "s" : ""}
                </div>
              </Popup>
            </Marker>
          );
        })}
    </MapContainer>
  );
};

export default FarmlandMap;
