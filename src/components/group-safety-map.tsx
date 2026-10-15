import { Circle, CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed, Maximize2 } from "lucide-react";

export type GroupMapMember = {
  id: number;
  name: string;
  isSelf: boolean;
  locationVisible: boolean;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  locationUpdatedAt: string | null;
  isOutOfRange: boolean;
};

type GroupSafetyMapProps = {
  members: GroupMapMember[];
  rangeMeters: number;
  fallbackCenter: [number, number];
  currentCoords?: { latitude: number; longitude: number; accuracyMeters?: number | null } | null;
  isTracking?: boolean;
};

function MapController({
  focusCenter,
  recenterTrigger,
}: {
  focusCenter: [number, number] | null;
  recenterTrigger: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (recenterTrigger > 0 && focusCenter) {
      map.flyTo(focusCenter, 14, { duration: 0.8 });
    }
  }, [focusCenter, map, recenterTrigger]);

  return null;
}

function ViewportSync({
  points,
  fallback,
}: {
  points: [number, number][];
  fallback: [number, number];
}) {
  const map = useMap();
  const hasCenteredRealPointsRef = useRef(false);
  const lastFallbackRef = useRef<[number, number]>(fallback);

  // If destination or fallback changes, reset centering state
  useEffect(() => {
    if (lastFallbackRef.current[0] !== fallback[0] || lastFallbackRef.current[1] !== fallback[1]) {
      lastFallbackRef.current = fallback;
      hasCenteredRealPointsRef.current = false;
      map.setView(fallback, 11);
    }
  }, [fallback, map]);

  useEffect(() => {
    // When real coordinates become available (GPS fix or member location), center on them once
    if (points.length > 0 && !hasCenteredRealPointsRef.current) {
      if (points.length > 1) {
        map.fitBounds(points, { padding: [48, 48], maxZoom: 15 });
      } else {
        map.setView(points[0], 14);
      }
      hasCenteredRealPointsRef.current = true;
    }
  }, [map, points]);

  return null;
}

export default function GroupSafetyMap({
  members,
  rangeMeters,
  fallbackCenter,
  currentCoords,
  isTracking = false,
}: GroupSafetyMapProps) {
  const [recenterCount, setRecenterCount] = useState(0);

  // Identify visible members from the server
  const otherVisibleMembers = useMemo(
    () =>
      members.filter(
        (member): member is GroupMapMember & { latitude: number; longitude: number } =>
          !member.isSelf && member.locationVisible && member.latitude !== null && member.longitude !== null
      ),
    [members]
  );

  const serverSelf = useMemo(() => members.find((member) => member.isSelf), [members]);

  // Determine current user's active GPS coordinates:
  // Prefer live GPS coordinates from the device watcher, fallback to serverSelf if available
  const userLat = currentCoords?.latitude ?? (serverSelf?.locationVisible ? serverSelf.latitude : null);
  const userLng = currentCoords?.longitude ?? (serverSelf?.locationVisible ? serverSelf.longitude : null);
  const userAccuracy = currentCoords?.accuracyMeters ?? serverSelf?.accuracyMeters ?? null;

  const hasUserLocation = typeof userLat === "number" && typeof userLng === "number" && Number.isFinite(userLat) && Number.isFinite(userLng);
  const userCenter: [number, number] | null = hasUserLocation ? [userLat, userLng] : null;

  // All active points for initial bounding box
  const allPoints = useMemo(() => {
    const list: [number, number][] = [];
    if (userCenter) list.push(userCenter);
    otherVisibleMembers.forEach((m) => list.push([m.latitude, m.longitude]));
    return list;
  }, [userCenter, otherVisibleMembers]);

  const handleRecenter = () => {
    setRecenterCount((prev) => prev + 1);
  };

  const formattedRadius = rangeMeters >= 1000 ? `${(rangeMeters / 1000).toFixed(rangeMeters % 1000 === 0 ? 0 : 2)} km (${rangeMeters.toLocaleString("en-IN")} m)` : `${rangeMeters.toLocaleString("en-IN")} m`;
  const formattedDiameter = rangeMeters * 2 >= 1000 ? `${((rangeMeters * 2) / 1000).toFixed((rangeMeters * 2) % 1000 === 0 ? 0 : 2)} km (${(rangeMeters * 2).toLocaleString("en-IN")} m)` : `${(rangeMeters * 2).toLocaleString("en-IN")} m`;

  return (
    <div className="tm-group-map" aria-label="Private group safety map">
      <MapContainer center={userCenter || fallbackCenter} zoom={11} scrollWheelZoom className="tm-leaflet-map tm-group-leaflet-map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <ViewportSync
          points={allPoints}
          fallback={fallbackCenter}
        />

        <MapController focusCenter={userCenter || fallbackCenter} recenterTrigger={recenterCount} />

        {/* Dynamic Safety Circle around the current user's latest valid GPS coordinates */}
        {userCenter && (
          <>
            {/* The primary safety boundary circle */}
            <Circle
              key={`circle-${rangeMeters}`}
              center={userCenter}
              radius={rangeMeters}
              pathOptions={{
                color: "#1f75d9",
                weight: 2.5,
                fillColor: "#1f75d9",
                fillOpacity: 0.08,
                dashArray: "6 8",
              }}
            >
              <Tooltip direction="top" opacity={0.95} permanent={false}>
                🛡️ Your Safety Radius: {formattedRadius} (Diameter: {formattedDiameter})
              </Tooltip>
            </Circle>

            {/* GPS accuracy indicator circle if available */}
            {userAccuracy && userAccuracy > 0 && userAccuracy < rangeMeters && (
              <Circle
                center={userCenter}
                radius={userAccuracy}
                pathOptions={{
                  color: "#38bdf8",
                  weight: 1,
                  fillColor: "#38bdf8",
                  fillOpacity: 0.12,
                }}
              />
            )}

            {/* Current user marker */}
            <CircleMarker
              center={userCenter}
              radius={10}
              pathOptions={{
                color: "#ffffff",
                weight: 3.5,
                fillColor: "#1f75d9",
                fillOpacity: 1,
              }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                <b>You</b> (Safety circle centre)
                {isTracking ? " • Live GPS active" : ""}
              </Tooltip>
              <Popup>
                <div style={{ fontSize: "12px", lineHeight: "1.4" }}>
                  <b style={{ color: "#1f75d9" }}>You (Safety Circle Centre)</b>
                  <br />
                  <span>Radius: <b>{formattedRadius}</b></span>
                  <br />
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    Lat: {userCenter[0].toFixed(5)}, Lng: {userCenter[1].toFixed(5)}
                  </span>
                  {userAccuracy ? (
                    <>
                      <br />
                      <span style={{ fontSize: "11px", color: "#64748b" }}>GPS Accuracy: ±{Math.round(userAccuracy)} m</span>
                    </>
                  ) : null}
                  <br />
                  <span style={{ fontSize: "10px", color: "#16a34a", fontWeight: 700 }}>
                    ● Centre follows your live device movements
                  </span>
                </div>
              </Popup>
            </CircleMarker>
          </>
        )}

        {/* Other group members */}
        {otherVisibleMembers.map((member) => {
          const color = member.isOutOfRange ? "#e15762" : "#2d9d87";
          return (
            <CircleMarker
              key={member.id}
              center={[member.latitude, member.longitude]}
              radius={8}
              pathOptions={{ color: "#ffffff", weight: 3, fillColor: color, fillOpacity: 1 }}
            >
              <Tooltip direction="top" offset={[0, -9]} opacity={1}>
                {member.name}
                {member.isOutOfRange ? " — ⚠️ OUTSIDE RANGE" : " — in range"}
              </Tooltip>
              <Popup>
                <div style={{ fontSize: "12px", lineHeight: "1.4" }}>
                  <b>{member.name}</b>
                  <br />
                  {member.isOutOfRange ? (
                    <span style={{ color: "#e15762", fontWeight: 700 }}>
                      ⚠️ Outside the safety range
                    </span>
                  ) : (
                    <span style={{ color: "#2d9d87", fontWeight: 700 }}>
                      ✅ Within safety range
                    </span>
                  )}
                  {member.accuracyMeters ? <><br /><small style={{ color: "#64748b" }}>Accuracy: ±{Math.round(member.accuracyMeters)} m</small></> : null}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Quick Recenter action */}
      {userCenter && (
        <button
          type="button"
          onClick={handleRecenter}
          className="tm-map-recenter-btn"
          title="Recenter map on your location"
          aria-label="Recenter map on your location"
        >
          <LocateFixed size={16} /> Recenter
        </button>
      )}

      {/* Map Legend */}
      <div className="tm-group-map-key">
        <span><i className="is-you" /> You (centre)</span>
        <span><i className="is-circle" /> Safety radius ({formattedRadius})</span>
        <span><i className="is-member" /> Member</span>
        <span><i className="is-alert" /> Range alert</span>
      </div>

      {!userCenter && !otherVisibleMembers.length && (
        <div className="tm-group-map-empty">
          Live member locations and your safety circle appear here once you tap <b>Start Safety</b>.
        </div>
      )}
    </div>
  );
}
