import {
  AlertTriangle,
  BellRing,
  Check,
  Copy,
  LocateFixed,
  MapPin,
  Navigation,
  Pause,
  Play,
  Plus,
  Radio,
  ShieldAlert,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { destinations, findDestination, type Destination } from "@/lib/travel-data";
import GroupSafetyMap, { type GroupMapMember } from "@/components/group-safety-map";
import {
  SAFETY_RADIUS_PRESETS,
  formatRadiusDistance,
  safeRangeMeters,
  MIN_GROUP_RANGE_METERS,
  MAX_GROUP_RANGE_METERS,
} from "@/lib/group-safety";

type GroupUser = { id: number; name: string; email: string } | null;
type GroupSummary = {
  id: number;
  name: string;
  destination: string;
  inviteCode: string | null;
  rangeMeters: number;
  isActive: boolean;
  ownerUserId: number;
  sharingEnabled: boolean;
};
type GroupMember = GroupMapMember & { userId: number; avatarUrl: string | null; sharingEnabled: boolean };
type SafetyEvent = {
  id: number;
  kind: "range_breach" | "sos" | string;
  message: string;
  memberId: number | null;
  acknowledged: boolean;
  createdAt: string;
};
type GroupStatus = {
  group: Omit<GroupSummary, "sharingEnabled">;
  selfMemberId: number;
  members: GroupMember[];
  events: SafetyEvent[];
  refreshedAt: string;
};
type PushReadiness = { push?: { configured?: boolean; publicKey?: string | null } };

type LiveCoords = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  timestamp: number;
};

type GpsStatus = "idle" | "locating" | "active" | "permission_denied" | "unavailable" | "timeout";

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

function formatUpdatedAt(value: string | null) {
  if (!value) return "Not sharing";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 15) return "Updated now";
  if (seconds < 60) return `Updated ${seconds}s ago`;
  return `Updated ${Math.floor(seconds / 60)}m ago`;
}

function relativeDistance(a: GroupMember | undefined, b: GroupMember) {
  if (!a?.locationVisible || a.latitude === null || a.longitude === null || !b.locationVisible || b.latitude === null || b.longitude === null)
    return null;
  const radians = (value: number) => (value * Math.PI) / 180;
  const latDelta = radians(b.latitude - a.latitude);
  const lngDelta = radians(b.longitude - a.longitude);
  const root =
    Math.sin(latDelta / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(lngDelta / 2) ** 2;
  return Math.round(2 * 6_371_000 * Math.atan2(Math.sqrt(root), Math.sqrt(1 - root)));
}

function playAlertTone() {
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(830, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(540, context.currentTime + 0.45);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.55);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.58);
    window.setTimeout(() => void context.close(), 800);
  } catch {
    // Audio tone fallback is safe
  }
}

export default function GroupSafetyPanel({
  user,
  destination,
  onRequireAuth,
}: {
  user: GroupUser;
  destination: Destination;
  onRequireAuth: () => void;
}) {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [status, setStatus] = useState<GroupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [sharingLive, setSharingLive] = useState(false);
  const [pushConfigured, setPushConfigured] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [notice, setNotice] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [confirmSos, setConfirmSos] = useState(false);

  // Group creation state
  const [createForm, setCreateForm] = useState({
    name: `${destination.name} travel group`,
    destination: destination.name,
    rangeMeters: 500,
  });

  // Dynamic Safety Radius state
  const [rangeDraft, setRangeDraft] = useState(500);
  const [isCustomRadiusMode, setIsCustomRadiusMode] = useState(false);
  const [customRadiusInput, setCustomRadiusInput] = useState("500");
  const [customRadiusError, setCustomRadiusError] = useState<string | null>(null);

  // Live GPS Tracking state
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("idle");
  const [liveCoords, setLiveCoords] = useState<LiveCoords | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const activeGroupRef = useRef<number | null>(null);
  const sharingRef = useRef(false);
  const lastSentRef = useRef(0);
  const seenEventsRef = useRef(new Set<number>());
  const eventsInitializedRef = useRef(false);

  const currentGroup = status?.group ?? groups.find((group) => group.id === activeGroupId) ?? null;
  const isOwner = Boolean(user && currentGroup?.ownerUserId === user.id);
  const mapDestination = findDestination(currentGroup?.destination || destination.name);
  const visibleMembers = status?.members.filter((member) => member.locationVisible) ?? [];
  const activeAlertCount = status?.events.filter((event) => event.kind === "range_breach" || event.kind === "sos").length ?? 0;

  useEffect(() => {
    activeGroupRef.current = activeGroupId;
  }, [activeGroupId]);

  useEffect(() => {
    sharingRef.current = sharingLive;
  }, [sharingLive]);

  useEffect(() => {
    setCreateForm((current) => ({ ...current, destination: current.destination || destination.name }));
  }, [destination.name]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    void loadGroups();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    void fetch("/api/config", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then(async (data: PushReadiness | null) => {
        const configured = Boolean(data?.push?.configured && data.push.publicKey);
        setPushConfigured(configured);
        if (configured && "serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.getRegistration("/");
          setPushEnabled(Boolean(await registration?.pushManager.getSubscription()));
        }
      })
      .catch(() => undefined);
  }, [user?.id]);

  useEffect(() => {
    if (!activeGroupId || !user) return;
    eventsInitializedRef.current = false;
    seenEventsRef.current = new Set();
    void loadStatus(activeGroupId);
    const timer = window.setInterval(() => void loadStatus(activeGroupId), 5_000);
    return () => window.clearInterval(timer);
  }, [activeGroupId, user?.id]);

  // When group status loads or changes, sync radius from storage or server
  useEffect(() => {
    if (!status) return;
    const groupId = status.group.id;
    // Check if user has a custom radius stored in localStorage for this group
    const savedLocalRadius = localStorage.getItem(`travelmate_safety_radius_${groupId}`);
    if (savedLocalRadius && !Number.isNaN(Number(savedLocalRadius))) {
      const parsed = safeRangeMeters(Number(savedLocalRadius));
      setRangeDraft(parsed);
      setCustomRadiusInput(String(parsed));
      setIsCustomRadiusMode(!SAFETY_RADIUS_PRESETS.some((preset) => preset.value === parsed));
    } else {
      const initial = status.group.rangeMeters || 500;
      setRangeDraft(initial);
      setCustomRadiusInput(String(initial));
      setIsCustomRadiusMode(!SAFETY_RADIUS_PRESETS.some((preset) => preset.value === initial));
    }

    const ids = status.events.map((event) => event.id);
    if (!eventsInitializedRef.current) {
      seenEventsRef.current = new Set(ids);
      eventsInitializedRef.current = true;
      return;
    }
    const fresh = status.events.filter((event) => !seenEventsRef.current.has(event.id));
    fresh.forEach((event) => {
      seenEventsRef.current.add(event.id);
      if (event.kind === "range_breach" || event.kind === "sos") announceSafetyEvent(event);
    });
  }, [status?.group?.id]);

  // Clean up GPS watcher and remove live position on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      const groupId = activeGroupRef.current;
      if (sharingRef.current && groupId) {
        void fetch(`/api/groups/${groupId}/location`, { method: "DELETE", keepalive: true });
      }
    };
  }, []);

  async function loadGroups(selectNewest = false) {
    try {
      setLoading(true);
      const response = await fetch("/api/groups", { cache: "no-store" });
      const data = (await response.json()) as { groups?: GroupSummary[]; error?: string };
      if (!response.ok) {
        setNotice(data.error || "Could not load your travel groups.");
        return;
      }
      const nextGroups = data.groups || [];
      setGroups(nextGroups);
      setActiveGroupId((current) =>
        selectNewest ? nextGroups[0]?.id ?? null : current && nextGroups.some((group) => group.id === current) ? current : nextGroups[0]?.id ?? null
      );
    } catch {
      setNotice("Could not connect to group safety. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function loadStatus(groupId: number) {
    try {
      const response = await fetch(`/api/groups/${groupId}/status`, { cache: "no-store" });
      const data = (await response.json()) as GroupStatus & { error?: string };
      if (!response.ok) {
        setNotice(data.error || "Could not refresh the group map.");
        return;
      }
      setStatus(data);
      setGroups((current) =>
        current.map((group) => (group.id === groupId ? { ...group, rangeMeters: data.group.rangeMeters, isActive: data.group.isActive } : group))
      );
    } catch {
      // Keep last good state on temporary network glitch
    }
  }

  function announceSafetyEvent(event: SafetyEvent) {
    setNotice(event.kind === "sos" ? `SOS received: ${event.message}` : `Range alert: ${event.message}`);
    playAlertTone();
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(event.kind === "sos" ? "TravelMate SOS" : "TravelMate range alert", {
        body: event.message,
        tag: `travelmate-group-${event.id}`,
      });
    }
  }

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      onRequireAuth();
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = (await response.json()) as { group?: GroupSummary; error?: string };
      if (!response.ok || !data.group) {
        setNotice(data.error || "Could not create the group.");
        return;
      }
      setGroups((current) => [{ ...data.group! }, ...current]);
      setStatus(null);
      setActiveGroupId(data.group.id);
      setNotice(`"${data.group.name}" is ready. Share the private invite code with your travel companions.`);
    } catch {
      setNotice("Could not create the group. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function joinGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      onRequireAuth();
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: joinCode }),
      });
      const data = (await response.json()) as { group?: GroupSummary; joined?: boolean; message?: string; error?: string };
      if (!response.ok || !data.group) {
        setNotice(data.error || "Could not join that group.");
        return;
      }
      setGroups((current) => (current.some((group) => group.id === data.group!.id) ? current : [{ ...data.group! }, ...current]));
      setStatus(null);
      setActiveGroupId(data.group.id);
      setJoinCode("");
      setNotice(data.message || `You joined "${data.group.name}". Start sharing only when you are ready.`);
    } catch {
      setNotice("Could not join that group. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // Throttled transmission of position to server (maintains breach detection)
  async function sendPosition(position: GeolocationPosition | { coords: { latitude: number; longitude: number; accuracy: number } }) {
    const groupId = activeGroupRef.current;
    if (!groupId) return;
    const now = Date.now();
    if (now - lastSentRef.current < 5_000) return;
    lastSentRef.current = now;

    try {
      const response = await fetch(`/api/groups/${groupId}/location`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        }),
      });
      const data = (await response.json()) as {
        isOutOfRange?: boolean;
        breaches?: Array<{ name: string; distanceMeters: number }>;
        error?: string;
      };
      if (!response.ok) {
        setNotice(data.error || "Could not update your shared location.");
        return;
      }
      if (data.isOutOfRange) {
        const nearest = data.breaches?.[0];
        const alert = nearest
          ? `You are ${nearest.distanceMeters.toLocaleString("en-IN")} m from ${nearest.name}; your group range is exceeded.`
          : "You are outside your selected group range.";
        setNotice(alert);
        playAlertTone();
        if ("Notification" in window && Notification.permission === "granted")
          new Notification("TravelMate range alert", { body: alert, tag: "travelmate-own-range" });
      }
      void loadStatus(groupId);
    } catch {
      // Temporary network issue: circle remains active locally
    }
  }

  async function enableBackgroundAlerts() {
    if (!user) {
      onRequireAuth();
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setNotice("This browser does not support background notifications. You will still receive in-app safety alerts while TravelMate is open.");
      return;
    }
    try {
      const configResponse = await fetch("/api/config", { cache: "no-store" });
      const config = (await configResponse.json()) as PushReadiness;
      const publicKey = config.push?.publicKey;
      if (!config.push?.configured || !publicKey) {
        setPushConfigured(false);
        setNotice("Background safety alerts are not configured on this server yet. In-app alerts remain active while TravelMate is open.");
        return;
      }
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") {
        setNotice("Notifications were not enabled. You can still see all group alerts inside TravelMate.");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setNotice(data.error || "Could not enable background alerts on this device.");
        return;
      }
      setPushConfigured(true);
      setPushEnabled(true);
      setNotice("Background SOS and range alerts are enabled on this device.");
    } catch {
      setNotice("Could not enable device alerts. Check browser notification settings and try again.");
    }
  }

  // --- START SAFETY / GPS TRACKING CONTROLS ---
  function startSharing() {
    if (!user) {
      onRequireAuth();
      return;
    }
    if (!currentGroup?.isActive) {
      setNotice("The organiser has paused safety sharing for this group.");
      return;
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setGpsStatus("unavailable");
      setNotice("Location sharing requires an HTTPS secure connection. Please access TravelMate over HTTPS.");
      return;
    }
    if (!navigator.geolocation) {
      setGpsStatus("unavailable");
      setNotice("This browser does not support GPS location tracking. Please try on a mobile browser.");
      return;
    }

    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }

    setLocating(true);
    setGpsStatus("locating");
    setNotice("Acquiring initial GPS position...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setSharingLive(true);
        setGpsStatus("active");

        const initialCoords: LiveCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: Math.round(position.coords.accuracy || 10),
          timestamp: Date.now(),
        };
        setLiveCoords(initialCoords);
        void sendPosition(position);

        // Start watching for GPS movement
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }

        watchIdRef.current = navigator.geolocation.watchPosition(
          (nextPosition) => {
            // When user moves, immediately update coordinates to shift circle center
            setLiveCoords({
              latitude: nextPosition.coords.latitude,
              longitude: nextPosition.coords.longitude,
              accuracyMeters: Math.round(nextPosition.coords.accuracy || 10),
              timestamp: Date.now(),
            });
            setGpsStatus("active");
            void sendPosition(nextPosition);
          },
          (err) => {
            if (err.code === err.PERMISSION_DENIED) {
              setGpsStatus("permission_denied");
              setSharingLive(false);
              if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
              }
              setNotice("Location permission was revoked. Safety tracking has stopped.");
            } else if (err.code === err.POSITION_UNAVAILABLE) {
              setGpsStatus("unavailable");
              setNotice("GPS signal became unavailable. Check device location services.");
            } else if (err.code === err.TIMEOUT) {
              setGpsStatus("timeout");
            }
          },
          { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 }
        );

        setNotice(`Safety tracking active. Safety circle is centered on your GPS position (radius: ${formatRadiusDistance(rangeDraft)}).`);
      },
      (err) => {
        setLocating(false);
        setSharingLive(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsStatus("permission_denied");
          setNotice("Location permission was denied. Please allow location access in your browser or device settings.");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGpsStatus("unavailable");
          setNotice("GPS location is unavailable on this device or network. Please check device location settings.");
        } else if (err.code === err.TIMEOUT) {
          setGpsStatus("timeout");
          setNotice("GPS location request timed out. Please try again or check your signal.");
        } else {
          setGpsStatus("idle");
          setNotice("Could not access location. Please check browser permissions.");
        }
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 12_000 }
    );
  }

  async function stopSharing() {
    const groupId = activeGroupRef.current;
    if (watchIdRef.current !== null) {
      navigator.geolocation?.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setSharingLive(false);
    setGpsStatus("idle");
    setLiveCoords(null);

    if (!groupId) return;
    try {
      await fetch(`/api/groups/${groupId}/location`, { method: "DELETE" });
      await loadStatus(groupId);
      setNotice("Safety tracking stopped. Your location is private and your last shared point has been cleared.");
    } catch {
      setNotice("Safety tracking stopped on this device.");
    }
  }

  // Verification helper: simulate walking ~15 metres North (useful for testing movement in browser DevTools or desktop)
  function simulateStepNorth() {
    if (!liveCoords) return;
    // 0.000135 degrees latitude is roughly 15 metres
    const nextCoords: LiveCoords = {
      ...liveCoords,
      latitude: liveCoords.latitude + 0.000135,
      timestamp: Date.now(),
    };
    setLiveCoords(nextCoords);
    void sendPosition({ coords: { latitude: nextCoords.latitude, longitude: nextCoords.longitude, accuracy: nextCoords.accuracyMeters } });
    setNotice("Simulated 15m walk North: circle centre moved to new GPS coordinates; radius remained unchanged.");
  }

  // --- DISTANCE SELECTOR HANDLERS ---
  function handleSelectPreset(presetMeters: number) {
    setIsCustomRadiusMode(false);
    setCustomRadiusError(null);
    setRangeDraft(presetMeters);
    setCustomRadiusInput(String(presetMeters));
    if (activeGroupId) {
      localStorage.setItem(`travelmate_safety_radius_${activeGroupId}`, String(presetMeters));
    }
    setNotice(`Safety radius set to ${formatRadiusDistance(presetMeters)}.`);
  }

  function handleSelectCustom() {
    setIsCustomRadiusMode(true);
    setCustomRadiusError(null);
  }

  function handleCustomDistanceChange(val: string) {
    setCustomRadiusInput(val);
    const parsed = Number(val);
    if (!val || Number.isNaN(parsed)) {
      setCustomRadiusError("Please enter a valid distance in metres.");
      return;
    }
    if (parsed < MIN_GROUP_RANGE_METERS) {
      setCustomRadiusError(`Minimum safety radius is ${MIN_GROUP_RANGE_METERS} metres.`);
      return;
    }
    if (parsed > MAX_GROUP_RANGE_METERS) {
      setCustomRadiusError(`Maximum safety radius is ${MAX_GROUP_RANGE_METERS.toLocaleString("en-IN")} metres (10 km).`);
      return;
    }

    const cleanRadius = Math.round(parsed);
    setCustomRadiusError(null);
    setRangeDraft(cleanRadius);
    if (activeGroupId) {
      localStorage.setItem(`travelmate_safety_radius_${activeGroupId}`, String(cleanRadius));
    }
  }

  async function saveRange() {
    if (!currentGroup || !isOwner) return;
    setBusy(true);
    try {
      const response = await fetch("/api/groups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: currentGroup.id, rangeMeters: rangeDraft }),
      });
      const data = (await response.json()) as { group?: GroupSummary; error?: string };
      if (!response.ok) {
        setNotice(data.error || "Could not update the group range.");
        return;
      }
      await loadStatus(currentGroup.id);
      setNotice(`Group safety radius updated to ${data.group?.rangeMeters ?? rangeDraft} m across the group.`);
    } catch {
      setNotice("Could not save the group range. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyInviteCode() {
    if (!currentGroup?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(currentGroup.inviteCode);
      setNotice("Private invite code copied to clipboard!");
    } catch {
      setNotice(`Invite code: ${currentGroup.inviteCode}`);
    }
  }

  async function executeSos() {
    if (!currentGroup) return;
    setConfirmSos(false);
    setBusy(true);
    try {
      const response = await fetch(`/api/groups/${currentGroup.id}/sos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await response.json()) as { event?: SafetyEvent; error?: string };
      if (!response.ok || !data.event) {
        setNotice(data.error || "Could not send SOS.");
        return;
      }
      announceSafetyEvent(data.event);
      await loadStatus(currentGroup.id);
    } catch {
      setNotice("SOS could not be sent online. For immediate danger, call 112.");
    } finally {
      setBusy(false);
    }
  }

  const memberRows = useMemo(() => {
    const myMember = status?.members.find((member) => member.isSelf);
    return (status?.members || []).map((member) => ({
      ...member,
      distance: member.isSelf ? 0 : relativeDistance(myMember, member),
    }));
  }, [status]);

  if (!user) {
    return (
      <div className="tm-group-body">
        <div className="tm-group-gate">
          <UsersRound size={31} />
          <p className="tm-eyebrow">PRIVATE GROUP SAFETY</p>
          <h3>Travel together. Stay connected.</h3>
          <p>
            Create a private group for your trek, forest visit, mountain trail, or city day out. Each person chooses whether to share
            their own live location.
          </p>
          <button type="button" className="tm-primary-button" onClick={onRequireAuth}>
            Sign in to start a group
          </button>
          <small>Location sharing is always opt-in and can be stopped anytime.</small>
        </div>
      </div>
    );
  }

  const selectedPresetMatch = !isCustomRadiusMode && SAFETY_RADIUS_PRESETS.some((p) => p.value === rangeDraft);

  return (
    <div className="tm-group-body">
      <div className="tm-group-intro">
        <span>
          <UsersRound size={19} />
        </span>
        <div>
          <b>Group safety, with consent</b>
          <p>
            Create a private group for friends or family. Set your safety radius and alerts trigger when a sharing member moves beyond
            the safety circle.
          </p>
        </div>
      </div>

      {notice && (
        <div className="tm-group-notice">
          <Check size={15} /> <span>{notice}</span>
        </div>
      )}

      {loading ? (
        <div className="tm-group-map-loading">
          <Radio size={20} /> Loading your private groups...
        </div>
      ) : null}

      {!loading && (!groups.length || !activeGroupId) ? (
        <div className="tm-group-empty">
          <div>
            <p className="tm-eyebrow">START A PRIVATE GROUP</p>
            <h3>Heading to {destination.name} together?</h3>
            <p>Create a group for your travel squad, then share the invite code only with people you trust.</p>
          </div>
          <form onSubmit={(event) => void createGroup(event)}>
            <label>
              Group name
              <input
                required
                value={createForm.name}
                onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Rajasthan trail crew"
              />
            </label>
            <label>
              Destination
              <select
                value={createForm.destination}
                onChange={(event) => setCreateForm((current) => ({ ...current, destination: event.target.value }))}
              >
                {destinations.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name}, {item.region}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", marginBottom: 6 }}>
                Default safety radius: <b>{formatRadiusDistance(createForm.rangeMeters)}</b>
              </label>
              <div className="tm-range-presets">
                {SAFETY_RADIUS_PRESETS.map((preset) => (
                  <button
                    type="button"
                    key={preset.value}
                    className={createForm.rangeMeters === preset.value ? "is-selected" : ""}
                    onClick={() => setCreateForm((current) => ({ ...current, rangeMeters: preset.value }))}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <button type="submit" className="tm-primary-button" disabled={busy}>
              <Plus size={16} /> {busy ? "Creating..." : "Create private group"}
            </button>
          </form>
          <div className="tm-group-join">
            <p>Already have an invite?</p>
            <form onSubmit={(event) => void joinGroup(event)}>
              <input
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                placeholder="Enter invite code"
                maxLength={32}
              />
              <button type="submit" disabled={busy}>
                Join group
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {!loading && groups.length ? (
        <>
          <div className="tm-group-picker">
            <label>
              Your groups
              <select
                value={activeGroupId ?? ""}
                disabled={sharingLive}
                onChange={(event) => {
                  setActiveGroupId(Number(event.target.value));
                  setStatus(null);
                }}
              >
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} — {group.destination}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => setActiveGroupId(null)} disabled={sharingLive}>
              <Plus size={15} /> New
            </button>
          </div>

          {currentGroup && status ? (
            <>
              <div className="tm-group-overview">
                <div>
                  <p className="tm-eyebrow">PRIVATE GROUP • {currentGroup.destination.toUpperCase()}</p>
                  <h3>{currentGroup.name}</h3>
                  <p>
                    <UsersRound size={14} /> {status.members.length} member{status.members.length === 1 ? "" : "s"} • <Radio size={14} />{" "}
                    {visibleMembers.length} sharing now
                  </p>
                </div>
                {confirmSos ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      style={{ background: "#d95057", color: "#fff", padding: "6px 12px", borderRadius: 8, fontWeight: 800 }}
                      onClick={() => void executeSos()}
                      disabled={busy}
                    >
                      Confirm SOS
                    </button>
                    <button
                      type="button"
                      style={{ background: "rgba(255,255,255,0.2)", color: "#fff", padding: "6px 12px", borderRadius: 8 }}
                      onClick={() => setConfirmSos(false)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button type="button" className="tm-group-sos" onClick={() => setConfirmSos(true)} disabled={busy}>
                    <AlertTriangle size={17} /> SOS
                  </button>
                )}
              </div>

              {isOwner && currentGroup.inviteCode ? (
                <div className="tm-invite-card">
                  <div>
                    <small>PRIVATE INVITE CODE</small>
                    <b>{currentGroup.inviteCode}</b>
                    <p>Share with friends or family to let them join this safety room.</p>
                  </div>
                  <button type="button" onClick={() => void copyInviteCode()}>
                    <Copy size={16} /> Copy
                  </button>
                </div>
              ) : (
                <div className="tm-group-member-privacy">
                  <ShieldAlert size={15} /> This group's invite code is held by the organiser.
                </div>
              )}

              {/* GPS / Permission Error Banners */}
              {gpsStatus === "permission_denied" && (
                <div className="tm-gps-alert-box is-denied">
                  <AlertTriangle size={18} />
                  <div>
                    <b>Location Permission Denied</b>
                    <p>
                      TravelMate cannot display your live safety circle because browser location permissions are blocked. Please click the
                      lock/site settings icon in your browser address bar to allow location access, then tap <b>Start Safety</b>.
                    </p>
                  </div>
                </div>
              )}

              {gpsStatus === "unavailable" && (
                <div className="tm-gps-alert-box is-unavailable">
                  <AlertTriangle size={18} />
                  <div>
                    <b>GPS Signal Unavailable</b>
                    <p>
                      Could not retrieve valid GPS coordinates. Check that your device location service / GPS is enabled, and try again.
                    </p>
                  </div>
                </div>
              )}

              {gpsStatus === "locating" && (
                <div className="tm-gps-alert-box is-locating">
                  <Radio size={18} />
                  <div>
                    <b>Acquiring GPS fix...</b>
                    <p>Requesting high-accuracy coordinates from your device to place your safety circle.</p>
                  </div>
                </div>
              )}

              {/* Start Safety / Stop Safety Controls */}
              <div className="tm-share-card">
                <div>
                  <span className={sharingLive ? "is-sharing" : ""}>{sharingLive ? <Radio size={18} /> : <LocateFixed size={18} />}</span>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                      <b>{sharingLive ? "Live GPS Safety Tracking" : "Safety Tracking Inactive"}</b>
                      <span className={`tm-tracking-status-badge ${sharingLive ? "is-active" : "is-inactive"}`}>
                        {sharingLive ? (
                          <>
                            <span className="tm-pulse-dot" /> Tracking active
                          </>
                        ) : (
                          "Location private"
                        )}
                      </span>
                    </div>
                    <p>
                      {sharingLive
                        ? "The safety circle moves dynamically with your live GPS location. Keep TravelMate open."
                        : "Tap Start Safety to draw your safety circle around your live GPS coordinates."}
                    </p>
                    {sharingLive && liveCoords ? (
                      <div style={{ marginTop: 4, fontSize: "10px", color: "#64748b" }}>
                        GPS: {liveCoords.latitude.toFixed(5)}, {liveCoords.longitude.toFixed(5)} (±{liveCoords.accuracyMeters} m)
                        <br />
                        <button
                          type="button"
                          className="tm-test-move-btn"
                          onClick={simulateStepNorth}
                          title="Simulate walking 15m North to test circle movement"
                        >
                          <Navigation size={12} /> Test move +15m North (simulate step)
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
                {sharingLive ? (
                  <button type="button" className="tm-stop-sharing" onClick={() => void stopSharing()}>
                    <Pause size={16} /> Stop Safety
                  </button>
                ) : (
                  <button
                    type="button"
                    className="tm-primary-button"
                    onClick={startSharing}
                    disabled={locating || !currentGroup.isActive}
                  >
                    <Play size={16} fill="currentColor" /> {locating ? "Starting..." : "Start Safety"}
                  </button>
                )}
              </div>

              {/* Device Background Alerts */}
              <div className={`tm-push-card ${pushEnabled ? "is-enabled" : ""}`}>
                <span>
                  <BellRing size={17} />
                </span>
                <div>
                  <b>{pushEnabled ? "Background alerts enabled" : "Enable device safety alerts"}</b>
                  <p>
                    {pushEnabled
                      ? "This device can receive SOS and range alerts when TravelMate is not open."
                      : pushConfigured
                      ? "Allow notifications for SOS and group range alerts on this device."
                      : "In-app alerts are active while TravelMate is open."}
                  </p>
                </div>
                {!pushEnabled && (
                  <button type="button" onClick={() => void enableBackgroundAlerts()}>
                    {pushConfigured ? "Enable" : "Details"}
                  </button>
                )}
              </div>

              {/* CUSTOMIZABLE SAFETY RADIUS SELECTOR */}
              <div className="tm-group-range">
                <div>
                  <span>
                    <Radio size={17} />
                  </span>
                  <div>
                    <p className="tm-eyebrow">CUSTOMIZABLE SAFETY RADIUS</p>
                    <b>{formatRadiusDistance(rangeDraft)}</b>
                    <small>
                      {isOwner
                        ? "You are the group organiser. You can apply and save this limit to the entire group."
                        : `Your personal safety circle is ${formatRadiusDistance(rangeDraft)} (Group alert limit: ${formatRadiusDistance(currentGroup.rangeMeters)}).`}
                    </small>
                  </div>
                </div>

                {/* Preset Options: 100m, 250m, 500m, 1,000m (1 km), 2,000m (2 km), and Custom */}
                <div className="tm-range-presets" role="group" aria-label="Safety distance presets">
                  {SAFETY_RADIUS_PRESETS.map((preset) => (
                    <button
                      type="button"
                      key={preset.value}
                      className={selectedPresetMatch && rangeDraft === preset.value ? "is-selected" : ""}
                      onClick={() => handleSelectPreset(preset.value)}
                      title={preset.description}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={isCustomRadiusMode ? "is-selected" : ""}
                    onClick={handleSelectCustom}
                    title="Enter custom distance in metres"
                  >
                    Custom
                  </button>

                  {isOwner && (
                    <button
                      type="button"
                      className="tm-save-range"
                      onClick={() => void saveRange()}
                      disabled={busy || Boolean(customRadiusError) || rangeDraft === currentGroup.rangeMeters}
                      title="Save this radius as the group limit on server"
                    >
                      {busy ? "Saving..." : rangeDraft === currentGroup.rangeMeters ? "Saved to group" : "Save as group limit"}
                    </button>
                  )}
                </div>

                {/* Custom numeric input with validation */}
                {isCustomRadiusMode && (
                  <div className="tm-custom-radius-form">
                    <label style={{ fontSize: "11px", fontWeight: 700, display: "block", marginBottom: 6 }}>
                      Enter custom distance in metres (radius):
                    </label>
                    <div className="tm-custom-radius-row">
                      <input
                        type="number"
                        min={MIN_GROUP_RANGE_METERS}
                        max={MAX_GROUP_RANGE_METERS}
                        step={10}
                        value={customRadiusInput}
                        onChange={(e) => handleCustomDistanceChange(e.target.value)}
                        placeholder="e.g. 750"
                        aria-label="Custom safety radius in metres"
                      />
                      <span className="tm-custom-radius-unit">metres</span>
                    </div>
                    {customRadiusError ? (
                      <div className="tm-custom-radius-hint is-invalid">⚠️ {customRadiusError}</div>
                    ) : (
                      <div className="tm-custom-radius-hint is-valid">
                        ✓ Valid radius: {formatRadiusDistance(rangeDraft)} (diameter: {formatRadiusDistance(rangeDraft * 2)})
                      </div>
                    )}
                  </div>
                )}

                {/* Clear Selected Distance & Dynamic Radius Explanation */}
                <div className="tm-radius-summary-box">
                  <p>
                    <b>Selected Radius: {formatRadiusDistance(rangeDraft)}</b>
                    <br />
                    This distance is the radius from your latest GPS coordinates (coverage diameter:{" "}
                    <b>{formatRadiusDistance(rangeDraft * 2)}</b>). When you move, the circle's centre updates with your fresh GPS
                    coordinates while this radius remains unchanged.
                  </p>
                </div>
              </div>

              {/* Dynamic Leaflet Map with Live Center & Radius */}
              <GroupSafetyMap
                members={status.members}
                rangeMeters={rangeDraft}
                fallbackCenter={mapDestination.coordinates}
                currentCoords={liveCoords}
                isTracking={sharingLive}
              />

              {/* Group Members Section */}
              <section className="tm-group-members">
                <div className="tm-group-section-head">
                  <div>
                    <p className="tm-eyebrow">GROUP STATUS</p>
                    <h3>Where everyone is</h3>
                  </div>
                  <span>{activeAlertCount ? `${activeAlertCount} alert${activeAlertCount > 1 ? "s" : ""}` : "All clear"}</span>
                </div>
                {memberRows.map((member) => (
                  <article className={member.isOutOfRange ? "is-out" : ""} key={member.id}>
                    <div className="tm-member-avatar">{member.name.slice(0, 1).toUpperCase()}</div>
                    <div>
                      <b>{member.isSelf ? "You (Safety circle centre)" : member.name}</b>
                      <p>
                        {member.locationVisible
                          ? `${formatUpdatedAt(member.locationUpdatedAt)}${
                              member.distance && !member.isSelf ? ` • ${member.distance.toLocaleString("en-IN")} m from you` : ""
                            }`
                          : member.sharingEnabled
                          ? "Location waiting to refresh"
                          : "Location private"}
                      </p>
                    </div>
                    <span className={member.isOutOfRange ? "is-out" : member.locationVisible ? "is-live" : ""}>
                      {member.isOutOfRange ? "Outside range" : member.locationVisible ? "Live" : "Private"}
                    </span>
                  </article>
                ))}
              </section>

              {/* Safety Alerts Section */}
              <section className="tm-group-alerts">
                <div className="tm-group-section-head">
                  <div>
                    <p className="tm-eyebrow">SAFETY ALERTS</p>
                    <h3>Group activity</h3>
                  </div>
                  <BellRing size={18} />
                </div>
                {status.events.length ? (
                  status.events.slice(0, 6).map((event) => (
                    <article className={event.kind === "sos" ? "is-sos" : ""} key={event.id}>
                      <span>{event.kind === "sos" ? <AlertTriangle size={16} /> : <Radio size={16} />}</span>
                      <div>
                        <b>{event.kind === "sos" ? "SOS alert" : "Range alert"}</b>
                        <p>{event.message}</p>
                        <small>{new Date(event.createdAt).toLocaleTimeString()}</small>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="tm-group-all-clear">
                    <Check size={17} /> No range breaches or SOS alerts yet.
                  </div>
                )}
              </section>

              <p className="tm-group-privacy">
                <ShieldAlert size={15} /> This is a consent-based safety feature, not an emergency service. Every member must choose to
                start their own location sharing.
              </p>
            </>
          ) : !loading && activeGroupId ? (
            <div className="tm-group-map-loading">
              <Radio size={20} /> Refreshing group safety...
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
