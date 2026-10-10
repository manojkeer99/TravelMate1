import { Circle, CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import { useEffect, useMemo } from "react";

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
};

function Viewport({ points, fallback }: { points: [number, number][]; fallback: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(points, { padding: [42, 42], maxZoom: 15 });
    } else {
      map.setView(points[0] || fallback, points.length ? 14 : 10);
    }
  }, [fallback, map, points]);
  return null;
}

export default function GroupSafetyMap({ members, rangeMeters, fallbackCenter }: GroupSafetyMapProps) {
  const visibleMembers = useMemo(
    () => members.filter((member): member is GroupMapMember & { latitude: number; longitude: number } => member.locationVisible && member.latitude !== null && member.longitude !== null),
    [members]
  );
  const self = visibleMembers.find((member) => member.isSelf);
  const points = visibleMembers.map((member) => [member.latitude, member.longitude] as [number, number]);

  return (
    <div className="tm-group-map" aria-label="Private group safety map">
      <MapContainer center={fallbackCenter} zoom={10} scrollWheelZoom className="tm-leaflet-map tm-group-leaflet-map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Viewport points={points} fallback={fallbackCenter} />
        {self && (
          <Circle
            center={[self.latitude, self.longitude]}
            radius={rangeMeters}
            pathOptions={{ color: "#263f7a", weight: 2, fillColor: "#263f7a", fillOpacity: 0.09, dashArray: "5 7" }}
          />
        )}
        {visibleMembers.map((member) => {
          const color = member.isOutOfRange ? "#e15762" : member.isSelf ? "#1f75d9" : "#2d9d87";
          return (
            <CircleMarker
              key={member.id}
              center={[member.latitude, member.longitude]}
              radius={member.isSelf ? 10 : 8}
              pathOptions={{ color: "#fff", weight: 3, fillColor: color, fillOpacity: 1 }}
            >
              <Tooltip direction="top" offset={[0, -9]} opacity={1}>
                {member.isSelf ? "You" : member.name}
                {member.isOutOfRange ? " — outside range" : ""}
              </Tooltip>
              <Popup>
                <b>{member.isSelf ? "You" : member.name}</b>
                <br />
                {member.isOutOfRange ? "⚠️ Outside the selected group range" : "✅ Within group range"}
                {member.accuracyMeters ? <> (±{member.accuracyMeters} m)</> : null}
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
      <div className="tm-group-map-key">
        <span><i className="is-you" /> You</span>
        <span><i className="is-member" /> Member</span>
        <span><i className="is-alert" /> Range alert</span>
      </div>
      {!visibleMembers.length && (
        <div className="tm-group-map-empty">
          Live member locations appear here only after each person taps <b>Start sharing</b>.
        </div>
      )}
    </div>
  );
}
