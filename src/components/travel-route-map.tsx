import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import { useEffect, useMemo } from "react";
import type { Destination, CircuitStop } from "@/lib/travel-data";

export type RouteLocation = {
  name: string;
  latitude: number;
  longitude: number;
  source: "device" | "saved";
};

type TravelRouteMapProps = {
  origin: RouteLocation;
  destination: Destination;
  routeCoordinates: number[][];
  circuitStops?: CircuitStop[];
  circuitTitle?: string;
  isWalkingCircuit?: boolean;
  distanceKm?: number | null;
  durationMinutes?: number | null;
};

function MapViewport({ points, isCircuit }: { points: number[][]; isCircuit?: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(
        points.map(([latitude, longitude]) => [latitude, longitude]),
        { padding: isCircuit ? [40, 40] : [34, 34], maxZoom: isCircuit ? 16 : 12 }
      );
    } else if (points[0]) {
      map.setView([points[0][0], points[0][1]], isCircuit ? 15 : 11);
    }
  }, [map, points, isCircuit]);
  return null;
}

export default function TravelRouteMap({
  origin,
  destination,
  routeCoordinates,
  circuitStops,
  circuitTitle,
  isWalkingCircuit,
  distanceKm,
  durationMinutes,
}: TravelRouteMapProps) {
  const nearbyPlaces = useMemo(() => {
    if (circuitStops && circuitStops.length > 0) return [];
    const featured = [
      ...destination.places.filter((place) => place.kind === "attraction" || place.kind === "activity").slice(0, 8),
      ...destination.places.filter((place) => place.kind === "hotel").slice(0, 3),
      ...destination.places.filter((place) => place.kind === "restaurant").slice(0, 3),
    ];
    return featured.map((place, index) => {
      const fallbackOffsets: [number, number][] = [
        [0.008, 0.006], [-0.007, 0.009], [0.005, -0.008], [-0.004, -0.01], [0.01, -0.004], [-0.009, 0.002]
      ];
      const fallback = fallbackOffsets[index % fallbackOffsets.length];
      return {
        ...place,
        latitude: place.coordinates?.[0] ?? destination.coordinates[0] + fallback[0],
        longitude: place.coordinates?.[1] ?? destination.coordinates[1] + fallback[1],
      };
    });
  }, [destination, circuitStops]);

  const hasCircuit = Boolean(circuitStops && circuitStops.length > 0);
  const viewportPoints = hasCircuit
    ? routeCoordinates.length > 1
      ? routeCoordinates
      : circuitStops!.map((s) => s.coordinates)
    : routeCoordinates.length > 1
    ? routeCoordinates
    : [[origin.latitude, origin.longitude], destination.coordinates];

  return (
    <div
      className="tm-live-map"
      aria-label={hasCircuit ? `${circuitTitle || "Heritage Walking Circuit"} map` : `Route map from ${origin.name} to ${destination.name}`}
    >
      {hasCircuit && (
        <div className="tm-map-circuit-banner" role="status" aria-label="Walking route summary">
          <div className="tm-map-circuit-badge">🚶 Walking Route</div>
          <span className="tm-map-circuit-title">{circuitTitle || "Old Udaipur Heritage & Artisan Circuit"}</span>
          <span className="tm-map-circuit-stats">
            5 Curated Stops • {distanceKm ? `${distanceKm} km` : "Pedestrian route"}
            {durationMinutes ? ` • ~${durationMinutes} min walking` : ""}
          </span>
        </div>
      )}

      <MapContainer
        center={hasCircuit ? circuitStops![0].coordinates : destination.coordinates}
        zoom={hasCircuit ? 15 : 10}
        scrollWheelZoom
        className="tm-leaflet-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewport points={viewportPoints} isCircuit={hasCircuit} />

        {/* Route Polyline */}
        {routeCoordinates.length > 1 && (
          <Polyline
            positions={routeCoordinates.map(([latitude, longitude]) => [latitude, longitude] as [number, number])}
            pathOptions={{
              color: isWalkingCircuit ? "#166534" : "#263f7a",
              weight: isWalkingCircuit ? 6 : 5,
              opacity: 0.9,
              dashArray: isWalkingCircuit ? "2, 8" : undefined,
            }}
          />
        )}

        {/* Normal Travel Mode Markers */}
        {!hasCircuit && (
          <>
            <CircleMarker center={[origin.latitude, origin.longitude]} radius={9} pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#1f75d9", fillOpacity: 1 }}>
              <Tooltip direction="top" offset={[0, -8]} opacity={1}>Start — {origin.name}</Tooltip>
              <Popup><b>{origin.name}</b><br />Your selected starting location</Popup>
            </CircleMarker>
            <CircleMarker center={destination.coordinates} radius={10} pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#da7954", fillOpacity: 1 }}>
              <Tooltip direction="top" offset={[0, -8]} opacity={1}>Destination — {destination.name}</Tooltip>
              <Popup><b>{destination.name}</b><br />{destination.tagline}</Popup>
            </CircleMarker>
            {nearbyPlaces.map((place) => (
              <CircleMarker
                key={place.id}
                center={[place.latitude, place.longitude]}
                radius={6}
                pathOptions={{
                  color: "#ffffff",
                  weight: 2,
                  fillColor: place.kind === "hotel" ? "#2d9d87" : place.kind === "restaurant" ? "#e89b28" : "#655fd7",
                  fillOpacity: 1
                }}
              >
                <Tooltip direction="top" offset={[0, -7]} opacity={0.95}>{place.name}</Tooltip>
                <Popup><b>{place.name}</b><br />{place.kind} • {place.location}</Popup>
              </CircleMarker>
            ))}
          </>
        )}

        {/* Circuit Mode Numbered Markers */}
        {hasCircuit &&
          circuitStops!.map((stop) => {
            const isCraft = stop.category === "Artisan & Crafts" || Boolean(stop.craftCategory);
            const isWater = stop.category === "Water Heritage";
            const markerColor = isCraft ? "#7b2cbf" : isWater ? "#0284c7" : "#263f7a";

            return (
              <CircleMarker
                key={stop.id}
                center={[stop.coordinates[0], stop.coordinates[1]]}
                radius={13}
                pathOptions={{
                  color: "#ffffff",
                  weight: 3,
                  fillColor: markerColor,
                  fillOpacity: 1,
                }}
              >
                <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                  <b>Stop {stop.stepNumber}:</b> {stop.name}
                </Tooltip>
                <Popup>
                  <div className="tm-circuit-map-popup">
                    <div className="tm-circuit-popup-tag">
                      <span>Stop #{stop.stepNumber}</span>
                      <small>{stop.category}</small>
                    </div>
                    <h4>{stop.name}</h4>
                    <p className="tm-circuit-popup-loc">{stop.location}</p>
                    <p className="tm-circuit-popup-desc">{stop.description}</p>

                    {stop.heritageNotes && (
                      <p className="tm-circuit-popup-heritage">
                        🏛️ <b>Heritage:</b> {stop.heritageNotes}
                      </p>
                    )}

                    {stop.craftCategory && (
                      <div className="tm-circuit-popup-craft">
                        🎨 <b>Artisan Lineage:</b> {stop.craftCategory}
                        {stop.localSourcing && <p>{stop.localSourcing}</p>}
                      </div>
                    )}

                    {stop.crowdLevel && (
                      <div className="tm-circuit-popup-crowd">
                        <span className={`tm-badge-crowd is-${stop.crowdLevel}`}>
                          {stop.crowdLevel === "low"
                            ? "🟢 Low Crowd"
                            : stop.crowdLevel === "moderate"
                            ? "🟡 Moderate Crowd"
                            : "🔴 Peak Hours"}
                        </span>
                        <small className="tm-curated-label">Curated planning estimate</small>
                        {stop.recommendedVisitTime && (
                          <p><b>Recommended:</b> {stop.recommendedVisitTime}</p>
                        )}
                        {stop.crowdReliefSuggestion && (
                          <p><b>Relief:</b> {stop.crowdReliefSuggestion}</p>
                        )}
                      </div>
                    )}

                    {stop.plasticReduction && (
                      <p className="tm-circuit-popup-eco">
                        ♻️ {stop.plasticReduction}
                      </p>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
      </MapContainer>

      {/* Map Legend */}
      <div className="tm-map-marker-key" aria-label="Map marker legend">
        {hasCircuit ? (
          <>
            <span><i style={{ background: "#263f7a" }} /> Heritage Stop</span>
            <span><i style={{ background: "#7b2cbf" }} /> Artisan & Crafts</span>
            <span><i style={{ background: "#0284c7" }} /> Water Heritage</span>
            <span><i style={{ background: "#166534" }} /> Walking Route</span>
          </>
        ) : (
          <>
            <span><i className="is-origin" /> Start</span>
            <span><i className="is-destination" /> Destination</span>
            <span><i className="is-place" /> Places</span>
          </>
        )}
      </div>
    </div>
  );
}
