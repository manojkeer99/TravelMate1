import {
  AlertTriangle,
  ArrowUpRight,
  BedDouble,
  Bell,
  Bookmark,
  CalendarDays,
  Camera,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CloudSun,
  Compass,
  Download,
  Droplets,
  Flag,
  Heart,
  Home,
  Hospital,
  Landmark,
  LogOut,
  Map,
  MapPin,
  Menu,
  MessageCircle,
  Moon,
  Navigation,
  PlaneTakeoff,
  Plus,
  Route,
  Search,
  Send,
  Settings2,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  Ticket,
  UserRound,
  Utensils,
  UsersRound,
  WalletCards,
  WifiOff,
  Wind,
  X,
} from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  createItinerary,
  destinations,
  Destination,
  findDestination,
  navItems,
  Place,
  quickActions,
  udaipurHeritageCircuit,
  type HeritageCircuit,
} from "@/lib/travel-data";
import TravelRouteMap, { type RouteLocation } from "@/components/travel-route-map";
import GroupSafetyPanel from "@/components/group-safety-panel";
import ProfileSettingsPanel from "@/components/profile-settings-panel";
import PlaceDetailsModal from "@/components/place-details-modal";
import TravelMateFooter from "@/components/travelmate-footer";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string; select_by?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            context?: "signin" | "signup" | "use";
            itp_support?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              logo_alignment?: "left" | "center";
              width?: number | string;
            }
          ) => void;
          prompt: (momentListener?: (notification: {
            isNotDisplayed: () => boolean;
            isSkippedMoment: () => boolean;
            isDismissedMoment: () => boolean;
            getNotDisplayedReason: () => string;
            getSkippedReason: () => string;
            getDismissedReason: () => string;
          }) => void) => void;
          disableAutoSelect?: () => void;
        };
      };
    };
  }
}

type View = "home" | "explore" | "trips" | "saved" | "profile";
type Panel = "planner" | "assistant" | "auth" | "emergency" | "budget" | "packing" | "map" | "group" | "profile-settings" | "notifications" | null;
type Account = { id: number; name: string; email: string; avatarUrl?: string | null; isAdmin: boolean };
type SearchResult = { id: string; type: string; title: string; subtitle: string; image: string; rating: number; price: string; tags: string[]; description: string };
type SavedPlace = { id: number; placeId: string; title: string; placeType: string; imageUrl?: string | null; collection: string };
type SavedTrip = { id: number; title: string; destination: string; startDate?: string | null; endDate?: string | null; budget: number; style: string; itinerary: unknown[] };
type PlannerForm = { destination: string; startLocation: string; startDate: string; endDate: string; days: number; travellers: number; budget: number; style: string };
type LiveWeather = { temperature_2m: number; relative_humidity_2m: number; apparent_temperature: number; wind_speed_10m: number };
type WeatherState = "loading" | "live" | "error" | "guide";
type FeatureConfig = {
  auth: {
    googleConfigured: boolean;
    googleClientId?: string;
    sessionsConfigured: boolean;
  };
  ai: {
    providerConfigured: boolean;
    activeProvider: string;
    availableProviders: string[];
  };
};
type ChatMessage = { role: "user" | "assistant"; content: string; source?: string };
type SearchState = "idle" | "loading" | "success" | "error";

const typeLabels: Record<string, string> = { all: "All", destination: "Destinations", attraction: "Attractions", hotel: "Hotels", restaurant: "Food", activity: "Activities" };
const categoryIcon: Record<string, ReactNode> = {
  explore: <Compass size={18} />,
  planner: <Route size={18} />,
  hotels: <BedDouble size={18} />,
  restaurants: <Utensils size={18} />,
  activities: <Ticket size={18} />,
  group: <UsersRound size={18} />,
  emergency: <ShieldAlert size={18} />,
};

const starterLocations: RouteLocation[] = [
  { name: "New Delhi, India", latitude: 28.6139, longitude: 77.209, source: "saved" },
  { name: "Mumbai, India", latitude: 19.076, longitude: 72.8777, source: "saved" },
  { name: "Bengaluru, India", latitude: 12.9716, longitude: 77.5946, source: "saved" },
  { name: "Ahmedabad, India", latitude: 23.0225, longitude: 72.5714, source: "saved" },
];

const rajasthanThemes = ["All", "Heritage", "Desert", "Lakes", "Wildlife", "Hill station", "Spiritual", "Culture", "Food", "Shopping", "Photography"] as const;

function GoogleGIcon({ className = "tm-google-icon" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function IconButton({ children, label, onClick, active = false }: { children: ReactNode; label: string; onClick?: () => void; active?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={`tm-icon-button ${active ? "is-active" : ""}`}>
      {children}
    </button>
  );
}

function SectionTitle({ eyebrow, title, action, onAction }: { eyebrow?: string; title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="tm-section-title">
      <div>
        {eyebrow && <p className="tm-eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {action && (
        <button type="button" onClick={onAction} className="tm-text-button">
          {action} <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}

function Rating({ rating, count }: { rating: number; count?: string | number }) {
  return (
    <span className="tm-rating">
      <Star size={14} fill="currentColor" /> {rating.toFixed(1)}
      {count ? <small>({count})</small> : null}
    </span>
  );
}

function DestinationCard({ destination, saved, onSave, onOpen, compact = false }: { destination: Destination; saved: boolean; onSave: () => void; onOpen: () => void; compact?: boolean }) {
  return (
    <article className={`tm-destination-card ${compact ? "tm-destination-card--compact" : ""}`}>
      <button type="button" className="tm-image-button" onClick={onOpen} aria-label={`Open ${destination.name} destination guide`}>
        <img src={destination.image} alt={`${destination.name} travel scene`} loading="lazy" decoding="async" />
        <span className="tm-card-tag">{destination.tagline}</span>
      </button>
      <button type="button" aria-label={`Save ${destination.name}`} onClick={onSave} className={`tm-save-float ${saved ? "is-saved" : ""}`}>
        <Heart size={17} fill={saved ? "currentColor" : "none"} />
      </button>
      <div className="tm-destination-copy">
        <div className="tm-card-heading">
          <div>
            <h3>{destination.name}</h3>
            <p><MapPin size={13} /> {destination.region}, {destination.country}</p>
          </div>
          <Rating rating={destination.rating} />
        </div>
        {!compact && <p className="tm-destination-description">{destination.description}</p>}
        <div className="tm-card-footer">
          <span><CalendarDays size={14} /> {destination.bestTime}</span>
          <button type="button" onClick={onOpen} aria-label={`View ${destination.name} details`}>
            <ArrowUpRight size={18} />
          </button>
        </div>
      </div>
    </article>
  );
}

function PlaceCard({
  place,
  destinationName,
  saved,
  onSave,
  onOpen,
}: {
  place: Place;
  destinationName: string;
  saved: boolean;
  onSave: () => void;
  onOpen: () => void;
}) {
  const hasCrowd = Boolean(place.crowdLevel);

  return (
    <article className="tm-place-card">
      <button type="button" className="tm-image-button" onClick={onOpen} aria-label={`View details for ${place.name}`}>
        <img src={place.image} alt={`${place.name} in ${destinationName}`} loading="lazy" decoding="async" />
      </button>
      <button type="button" onClick={onSave} aria-label={`Save ${place.name}`} className={`tm-save-float ${saved ? "is-saved" : ""}`}>
        <Bookmark size={15} fill={saved ? "currentColor" : "none"} />
      </button>
      <div className="tm-place-copy">
        <div className="tm-place-badges-bar">
          <span className="tm-place-type">{place.kind}</span>
          {place.sustainable && (
            <span className="tm-badge-sustainable" title="Eco-conscious & cultural preservation practices">
              🌱 Sustainable
            </span>
          )}
          {place.craftCategory && (
            <span className="tm-badge-craft" title={`Traditional craft: ${place.craftCategory}`}>
              🎨 {place.craftCategory}
            </span>
          )}
          {hasCrowd && (
            <span
              className={`tm-badge-crowd is-${place.crowdLevel}`}
              title="Curated planning estimate"
            >
              {place.crowdLevel === "low"
                ? "🟢 Low Crowd"
                : place.crowdLevel === "moderate"
                ? "🟡 Moderate Crowd"
                : "🔴 Peak Hours"}
            </span>
          )}
        </div>

        <h3 className="tm-place-title">{place.name}</h3>
        <p className="tm-place-location"><MapPin size={12} /> {place.location}</p>
        <p className="tm-place-desc-line">{place.description}</p>

        <div className="tm-place-footer-action">
          <div className="tm-place-meta-compact">
            <Rating rating={place.rating} count={place.reviews} />
            <span>{place.price}</span>
          </div>
          <button
            type="button"
            className="tm-place-view-details-btn"
            onClick={onOpen}
            aria-label={`View details for ${place.name}`}
          >
            View Details <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}

function ItineraryRows({ items }: { items: { time: string; title: string; meta: string; type: string }[] }) {
  return (
    <div className="tm-itinerary-rows">
      {items.map((item, index) => (
        <div className="tm-itinerary-row" key={`${item.time}-${item.title}`}>
          <div className="tm-time">{item.time}</div>
          <div className={`tm-timeline-dot is-${item.type}`} />
          <div>
            <strong>{item.title}</strong>
            <p>{item.meta}</p>
          </div>
          {index < items.length - 1 && <span className="tm-timeline-line" />}
        </div>
      ))}
    </div>
  );
}

export default function TravelMateDashboard() {
  const [view, setView] = useState<View>("home");
  const [panel, setPanel] = useState<Panel>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [destination, setDestination] = useState<Destination>(destinations[0]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [query, setQuery] = useState("");
  const [remoteResults, setRemoteResults] = useState<SearchResult[]>([]);
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [searchError, setSearchError] = useState("");
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchRequestIdRef = useRef(0);
  const [searchType, setSearchType] = useState("all");
  const [sort, setSort] = useState("recommended");
  const [rajasthanTheme, setRajasthanTheme] = useState<(typeof rajasthanThemes)[number]>("All");
  type HeritageFilter = "All" | "Heritage" | "Artisan & Crafts" | "Sustainable Hospitality" | "Heritage Walk" | "Low-Crowd Gems";
  const [heritageFilter, setHeritageFilter] = useState<HeritageFilter>("All");
  const heritageFilterTabs: HeritageFilter[] = [
    "All",
    "Heritage",
    "Artisan & Crafts",
    "Sustainable Hospitality",
    "Heritage Walk",
    "Low-Crowd Gems",
  ];
  const [savedIds, setSavedIds] = useState<string[]>(["udaipur"]);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [user, setUser] = useState<Account | null>(null);
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [activeTripId, setActiveTripId] = useState<number | null>(null);
  const [toast, setToast] = useState<string>("");
  const [authMode, setAuthMode] = useState<"login" | "signup" | "forgot">("login");
  const [authBusy, setAuthBusy] = useState(false);
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [assistantMessage, setAssistantMessage] = useState("");
  const [assistantMessages, setAssistantMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Ask me anything about your trip routes, budgets, packing, hotels, food, safety, or an itinerary. I'll provide a thoughtful, tailored travel guide." }
  ]);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [planner, setPlanner] = useState<PlannerForm>({
    destination: "Udaipur",
    startLocation: "Delhi",
    startDate: "",
    endDate: "",
    days: 3,
    travellers: 2,
    budget: 15000,
    style: "Standard"
  });
  const [plannerItinerary, setPlannerItinerary] = useState(() => createItinerary("Udaipur", 3, "Standard"));
  const [budgetTotal, setBudgetTotal] = useState(15000);
  const [budgetMode, setBudgetMode] = useState<"Budget" | "Standard" | "Premium">("Standard");
  const [packing, setPacking] = useState<Record<string, boolean>>({
    "Photo ID & tickets": true,
    "Light layers": true,
    "Phone charger & power bank": true,
    "Refillable water bottle": false,
    "Sunscreen & sunglasses": true,
    "Small first-aid kit": false,
    "Comfortable walking shoes": true,
    "Offline map download": false
  });
  const [offline, setOffline] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<RouteLocation>(starterLocations[0]);
  const [liveWeather, setLiveWeather] = useState<LiveWeather | null>(null);
  const [weatherState, setWeatherState] = useState<WeatherState>("loading");
  const [weatherUpdatedAt, setWeatherUpdatedAt] = useState<string | null>(null);
  const [weatherUnit, setWeatherUnit] = useState<"C" | "F">("C");
  const [featureConfig, setFeatureConfig] = useState<FeatureConfig>({
    auth: { googleConfigured: false, sessionsConfigured: true },
    ai: { providerConfigured: true, activeProvider: "gemini", availableProviders: ["gemini"] }
  });
  const [activeCircuit, setActiveCircuit] = useState<HeritageCircuit | null>(null);
  const [circuitRouteCoordinates, setCircuitRouteCoordinates] = useState<number[][]>([]);
  const [circuitDistanceKm, setCircuitDistanceKm] = useState<number | null>(null);
  const [circuitDurationMinutes, setCircuitDurationMinutes] = useState<number | null>(null);
  const [circuitLoading, setCircuitLoading] = useState(false);
  const [mapMode, setMapMode] = useState<"travel" | "circuit">("travel");

  async function openCircuitMap(circuit: HeritageCircuit = udaipurHeritageCircuit) {
    setActiveCircuit(circuit);
    setMapMode("circuit");
    setPanel("map");
    setCircuitLoading(true);
    try {
      const pointsStr = circuit.stops.map((s) => `${s.coordinates[0]},${s.coordinates[1]}`).join(";");
      const response = await fetch(`/api/route?profile=walking&points=${encodeURIComponent(pointsStr)}`);
      if (response.ok) {
        const data = (await response.json()) as { distanceKm?: number; durationMinutes?: number; coordinates?: number[][] };
        setCircuitRouteCoordinates(data.coordinates || []);
        setCircuitDistanceKm(data.distanceKm ?? null);
        setCircuitDurationMinutes(data.durationMinutes ?? null);
      } else {
        setCircuitRouteCoordinates(circuit.stops.map((s) => s.coordinates));
      }
    } catch {
      setCircuitRouteCoordinates(circuit.stops.map((s) => s.coordinates));
    } finally {
      setCircuitLoading(false);
    }
  }

  const weatherTemperature = liveWeather
    ? `${Math.round(weatherUnit === "C" ? liveWeather.temperature_2m : (liveWeather.temperature_2m * 9) / 5 + 32)}°${weatherUnit}`
    : destination.temperature;
  const weatherFeelsLike = liveWeather
    ? `${Math.round(weatherUnit === "C" ? liveWeather.apparent_temperature : (liveWeather.apparent_temperature * 9) / 5 + 32)}°${weatherUnit}`
    : `${Number.parseInt(destination.temperature, 10) + 1}°C`;
  const weatherHumidity = liveWeather ? `${liveWeather.relative_humidity_2m}%` : destination.humidity;
  const weatherWind = liveWeather
    ? `${Math.round(weatherUnit === "C" ? liveWeather.wind_speed_10m : liveWeather.wind_speed_10m * 0.621371)} ${weatherUnit === "C" ? "km/h" : "mph"}`
    : destination.wind;

  const allLocalResults = useMemo<SearchResult[]>(
    () =>
      destinations.flatMap((item) => [
        { id: item.id, type: "destination", title: item.name, subtitle: `${item.region}, ${item.country}`, image: item.image, rating: item.rating, price: item.budget, tags: item.tags, description: item.description },
        ...item.places.map((place) => ({ id: place.id, type: place.kind, title: place.name, subtitle: `${place.location} • ${item.name}`, image: place.image, rating: place.rating, price: place.price, tags: place.tags, description: place.description })),
      ]),
    []
  );

  const shownResults = useMemo(() => {
    let results = query && remoteResults.length ? remoteResults : allLocalResults;
    if (searchType !== "all") results = results.filter((item) => item.type === searchType);
    if (query && !remoteResults.length) results = results.filter((item) => `${item.title} ${item.subtitle} ${item.description} ${item.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase()));
    if (sort === "rating") results = [...results].sort((a, b) => b.rating - a.rating);
    return results;
  }, [allLocalResults, query, remoteResults, searchType, sort]);

  const rajasthanDestinations = useMemo(() => destinations.filter((item) => item.region.includes("Rajasthan")), []);
  const shownRajasthanDestinations = useMemo(
    () => (rajasthanTheme === "All" ? rajasthanDestinations : rajasthanDestinations.filter((item) => item.tags.includes(rajasthanTheme))),
    [rajasthanDestinations, rajasthanTheme]
  );

  const isUdaipur = destination.id === "udaipur" || destination.name.toLowerCase().includes("udaipur");

  const homeSuggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allLocalResults
      .filter((item) => `${item.title} ${item.subtitle} ${item.tags.join(" ")}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [allLocalResults, query]);

  const heritagePlaces = useMemo(() => {
    return destination.places.filter((place) => {
      if (heritageFilter === "All") return true;
      if (heritageFilter === "Heritage") {
        return (
          place.tags.some((t) => /Heritage|Traditional Architecture|Culture|Temple|History|Fort|Palace|Haveli/i.test(t)) ||
          Boolean(place.heritageNotes)
        );
      }
      if (heritageFilter === "Artisan & Crafts") {
        return (
          Boolean(place.craftCategory) ||
          place.tags.some((t) => /Artisan|Crafts|Handicrafts|Miniature|Textiles|Bandhani|Block-print|Mojari|Attar/i.test(t))
        );
      }
      if (heritageFilter === "Sustainable Hospitality") {
        return (
          (place.kind === "hotel" || place.kind === "restaurant") &&
          (Boolean(place.sustainable) || (place.sustainabilityTags && place.sustainabilityTags.length > 0))
        );
      }
      if (heritageFilter === "Heritage Walk") {
        return (
          place.kind === "activity" ||
          place.tags.some((t) => /Walk|Walking tour|Heritage Walk|Circuit/i.test(t)) ||
          place.location.includes("Old") ||
          place.location.includes("Ghat") ||
          place.location.includes("Fort")
        );
      }
      if (heritageFilter === "Low-Crowd Gems") {
        return place.crowdLevel === "low";
      }
      return true;
    });
  }, [destination, heritageFilter]);

  useEffect(() => {
    if (view !== "explore") return;
    const value = query.trim();
    if (!value) {
      searchAbortRef.current?.abort();
      setSearchState("idle");
      setSearchError("");
      setRemoteResults([]);
      return;
    }
    const timer = window.setTimeout(() => { void performSearch(value); }, 300);
    return () => window.clearTimeout(timer);
  }, [query, searchType, sort, view]);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("travelmate-theme");
    setDark(savedTheme === "dark");

    void fetch("/api/config")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: FeatureConfig | null) => { if (data) setFeatureConfig(data); })
      .catch(() => undefined);

    void fetch("/api/auth")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { user: Account | null } | null) => {
        if (data?.user) {
          setUser(data.user);
          void loadPersonal();
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = window.setTimeout(() => setToast(""), 3600);
      return () => window.clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    setWeatherState("loading");
    setLiveWeather(null);
    fetch(`/api/weather?destination=${encodeURIComponent(destination.id)}`)
      .then(async (response) => {
        const data = (await response.json()) as { current?: LiveWeather; updatedAt?: string };
        if (!response.ok || !data.current) throw new Error("Weather unavailable");
        return data;
      })
      .then((data) => {
        if (!cancelled) {
          setLiveWeather(data.current || null);
          setWeatherUpdatedAt(data.updatedAt || new Date().toISOString());
          setWeatherState("live");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLiveWeather(null);
          setWeatherUpdatedAt(null);
          setWeatherState("error");
        }
      });
    return () => { cancelled = true; };
  }, [destination.id]);

  async function loadPersonal() {
    const [savedResponse, tripsResponse] = await Promise.all([fetch("/api/saved"), fetch("/api/trips")]);
    if (savedResponse.ok) {
      const data = (await savedResponse.json()) as { places: SavedPlace[] };
      setSavedPlaces(data.places);
      setSavedIds((current) => Array.from(new Set([...current, ...data.places.map((place) => place.placeId)])));
    }
    if (tripsResponse.ok) {
      const data = (await tripsResponse.json()) as { trips: SavedTrip[] };
      setTrips(data.trips);
    }
  }

  function setTheme() {
    const next = !dark;
    setDark(next);
    window.localStorage.setItem("travelmate-theme", next ? "dark" : "light");
  }

  function updateCurrentLocation(location: RouteLocation) {
    setCurrentLocation(location);
    setPlanner((current) => ({ ...current, startLocation: location.name }));
  }

  function openDestination(next: Destination) {
    setDestination(next);
    setQuery("");
    setRemoteResults([]);
    const prevView = view;
    setView("explore");
    if (prevView !== "explore") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function openResult(result: SearchResult) {
    const next = destinations.find((item) => item.id === result.id || item.places.some((place) => place.id === result.id)) ?? destination;
    setDestination(next);
    setQuery(result.title);
    const place = next.places.find((p) => p.id === result.id);
    if (place) {
      setSelectedPlace(place);
    }
    const prevView = view;
    setView("explore");
    if (prevView !== "explore") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function performSearch(searchText: string) {
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    const requestId = ++searchRequestIdRef.current;
    setSearchState("loading");
    setSearchError("");
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchText)}&type=${searchType}&sort=${sort}`, { signal: controller.signal });
      const data = (await response.json()) as { results?: SearchResult[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Search is temporarily unavailable.");
      if (requestId !== searchRequestIdRef.current) return;
      setRemoteResults(data.results || []);
      setSearchState("success");
    } catch (error) {
      if (controller.signal.aborted) return;
      if (requestId !== searchRequestIdRef.current) return;
      setRemoteResults([]);
      setSearchState("error");
      setSearchError(error instanceof Error ? error.message : "Search is temporarily unavailable.");
    }
  }

  async function runSearch(event?: FormEvent) {
    event?.preventDefault();
    setView("explore");
    const clean = query.trim();
    if (!clean) {
      setRemoteResults([]);
      setSearchState("idle");
      setSearchError("");
      return;
    }
    await performSearch(clean);
  }

  async function toggleSave(item: { id: string; title: string; type: string; image: string }) {
    if (!user) {
      setAuthMode("login");
      setPanel("auth");
      setToast("Sign in to save your travel ideas.");
      return;
    }
    if (savedIds.includes(item.id)) {
      const response = await fetch(`/api/saved?placeId=${encodeURIComponent(item.id)}`, { method: "DELETE" });
      if (response.ok) {
        setSavedIds((ids) => ids.filter((id) => id !== item.id));
        setSavedPlaces((items) => items.filter((saved) => saved.placeId !== item.id));
        setToast("Removed from saved places.");
      }
      return;
    }
    const response = await fetch("/api/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId: item.id, title: item.title, placeType: item.type, imageUrl: item.image, collection: "My Rajasthan Trip" }),
    });
    const data = (await response.json()) as { place?: SavedPlace; error?: string };
    if (response.ok) {
      setSavedIds((ids) => [...ids, item.id]);
      if (data.place) setSavedPlaces((items) => [data.place!, ...items]);
      setToast("Saved to My Rajasthan Trip.");
    } else {
      setToast(data.error || "Could not save that place.");
    }
  }

  function handleQuickAction(id: string) {
    setMenuOpen(false);
    if (id === "planner") { setPlanner((form) => ({ ...form, destination: destination.name })); setPanel("planner"); return; }
    if (id === "emergency") { setPanel("emergency"); return; }
    if (id === "group") { setPanel("group"); return; }
    if (id === "explore") { setView("explore"); return; }
    setView("explore");
    setSearchType(id === "hotels" ? "hotel" : id === "restaurants" ? "restaurant" : id === "activities" ? "activity" : "all");
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    try {
      const action = authMode === "signup" ? "signup" : authMode === "forgot" ? "forgot" : "login";
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...authForm }),
      });
      const data = (await response.json()) as { user?: Account; message?: string; error?: string };
      if (!response.ok) {
        setToast(data.error || "Something went wrong.");
        return;
      }
      if (authMode === "forgot") {
        setToast(data.message || "Check your inbox for reset instructions.");
        setAuthMode("login");
        return;
      }
      if (data.user) {
        setUser(data.user);
        setPanel(null);
        setToast(`Welcome${authMode === "signup" ? " to TravelMate" : " back"}, ${data.user.name.split(" ")[0]}!`);
        void loadPersonal();
      }
    } catch {
      setToast("Connection issue. Please try again.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function submitGoogleAuth(idToken: string): Promise<{ ok: boolean; error?: string }> {
    setAuthBusy(true);
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "google", idToken }),
      });
      const data = (await response.json()) as { user?: Account; error?: string };
      if (!response.ok || !data.user) {
        const errorMsg = data.error || "Google authentication failed. Please try again.";
        setToast(errorMsg);
        return { ok: false, error: errorMsg };
      }
      setUser(data.user);
      setPanel(null);
      setToast(`Welcome to TravelMate, ${data.user.name.split(" ")[0]}!`);
      void loadPersonal();
      return { ok: true };
    } catch {
      const netError = "Unable to reach authentication service. Please check your network connection.";
      setToast(netError);
      return { ok: false, error: netError };
    } finally {
      setAuthBusy(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
    } catch {
      // ignore network errors on logout
    }
    if (typeof window !== "undefined" && window.google?.accounts?.id?.disableAutoSelect) {
      try {
        window.google.accounts.id.disableAutoSelect();
      } catch {
        // ignore
      }
    }
    setUser(null);
    setSavedPlaces([]);
    setTrips([]);
    setPanel(null);
    setView("home");
    setToast("You are signed out. Safe travels!");
  }

  function tripDaysFromDates() {
    if (!planner.startDate || !planner.endDate) return null;
    const start = new Date(`${planner.startDate}T00:00:00Z`);
    const end = new Date(`${planner.endDate}T00:00:00Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;
    return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  }

  function generatePlan() {
    const calculatedDays = tripDaysFromDates();
    if ((planner.startDate || planner.endDate) && !calculatedDays) {
      setToast("Choose an end date that is on or after your start date.");
      return;
    }
    const days = calculatedDays || planner.days;
    setPlanner((current) => ({ ...current, days }));
    setPlannerItinerary(createItinerary(planner.destination, days, planner.style));
    setToast("Your itinerary has been refreshed.");
  }

  async function saveTrip() {
    if (!user) {
      setPanel("auth");
      setAuthMode("signup");
      setToast("Create an account to save your itinerary.");
      return;
    }
    const days = tripDaysFromDates();
    if (!planner.startDate || !planner.endDate) {
      setToast("Choose a start and end date before saving your trip.");
      return;
    }
    if (!days) {
      setToast("Your end date must be on or after your start date.");
      return;
    }
    if (!Number.isFinite(planner.budget) || planner.budget < 1000) {
      setToast("Enter a realistic total budget of at least ₹1,000.");
      return;
    }
    const itinerary = plannerItinerary.length === days ? plannerItinerary : createItinerary(planner.destination, days, planner.style);
    const response = await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...planner, days, itinerary, title: `${planner.destination} trip` }),
    });
    const data = (await response.json()) as { trip?: SavedTrip; error?: string };
    if (response.ok && data.trip) {
      setPlannerItinerary(itinerary);
      setTrips((current) => [data.trip!, ...current]);
      setActiveTripId(data.trip.id);
      setPanel(null);
      setView("trips");
      setToast("Trip saved securely to your workspace.");
    } else {
      setToast(data.error || "Could not save your trip.");
    }
  }

  function openSavedTrip(trip: SavedTrip) {
    setActiveTripId(trip.id);
    const tripDestination = findDestination(trip.destination);
    setDestination(tripDestination);
    setPlanner((current) => ({
      ...current,
      destination: trip.destination,
      startDate: trip.startDate || "",
      endDate: trip.endDate || "",
      budget: trip.budget,
      style: trip.style,
    }));
    if (Array.isArray(trip.itinerary) && trip.itinerary.length) {
      setPlannerItinerary(trip.itinerary as ReturnType<typeof createItinerary>);
    }
    setView("trips");
    setToast(`Opened "${trip.title}".`);
  }

  async function deleteSavedTrip(trip: SavedTrip) {
    try {
      const response = await fetch(`/api/trips/${trip.id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not delete this trip.");
      setTrips((current) => current.filter((item) => item.id !== trip.id));
      setActiveTripId((current) => (current === trip.id ? null : current));
      setToast("Trip deleted.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not delete this trip.");
    }
  }

  async function askAssistant(event: FormEvent) {
    event.preventDefault();
    const question = assistantMessage.trim();
    if (!question || assistantBusy) return;
    const history = assistantMessages.slice(-8).map(({ role, content }) => ({ role, content }));
    setAssistantMessage("");
    setAssistantMessages((current) => [...current, { role: "user", content: question }]);
    setAssistantBusy(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          destination: destination.name,
          days: planner.days,
          budget: planner.budget,
          travellers: planner.travellers,
          style: planner.style,
          history,
        }),
      });
      const data = (await response.json()) as { answer?: string; error?: string; itinerary?: ReturnType<typeof createItinerary>; source?: string };
      const answer = response.ok && data.answer ? data.answer : data.error || "I couldn't prepare that answer just now. Please try again.";
      setAssistantMessages((current) => [...current, { role: "assistant", content: answer, source: data.source }]);
      if (response.ok && data.itinerary) setPlannerItinerary(data.itinerary);
    } catch {
      setAssistantMessages((current) => [
        ...current,
        { role: "assistant", content: "I couldn't reach the assistant just now. Your saved destination guide and Trip Planner are still available." },
      ]);
    } finally {
      setAssistantBusy(false);
    }
  }

  const currentTrip = plannerItinerary[0];
  const savedFor = (id: string) => savedIds.includes(id);
  const destinationSaveItem = (item: Destination) => ({ id: item.id, title: item.name, type: "destination", image: item.image });
  const placeSaveItem = (place: Place) => ({ id: place.id, title: place.name, type: place.kind, image: place.image });

  function renderHomeView() {
    return (
      <>
        <section className="tm-welcome-card">
          <div className="tm-welcome-copy">
            <p className="tm-eyebrow">YOUR PERSONAL TRAVEL DESK</p>
            <h1>Travel well, from the <em>first idea</em>.</h1>
            <p>Discover India's most memorable places, plan your days clearly, and keep every important detail together.</p>
            <div className="tm-hero-search-wrapper">
              <form className="tm-hero-search" onSubmit={runSearch}>
                <Search size={20} />
                <input
                  value={query}
                  onChange={(event) => { setQuery(event.target.value); setRemoteResults([]); }}
                  placeholder="Where do you want to go in Rajasthan?"
                  aria-label="Search destinations, stays, restaurants, and activities"
                  autoComplete="off"
                />
                {query && (
                  <button
                    type="button"
                    style={{ border: 0, background: "transparent", color: "var(--muted)", padding: "0 6px", display: "grid", placeItems: "center" }}
                    onClick={() => { setQuery(""); setRemoteResults([]); }}
                    aria-label="Clear search input"
                  >
                    <X size={16} />
                  </button>
                )}
                <button type="submit">Explore <ArrowUpRight size={16} /></button>
              </form>

              {query.trim().length > 0 && homeSuggestions.length > 0 && (
                <div className="tm-search-suggestions-dropdown" role="listbox" aria-label="Search suggestions">
                  <div className="tm-suggestion-group-title">Matching Rajasthan Destinations & Places</div>
                  {homeSuggestions.map((item) => (
                    <button
                      key={`${item.type}-${item.id}`}
                      type="button"
                      className="tm-suggestion-item"
                      onMouseDown={(e) => {
                        e.preventDefault();
                      }}
                      onClick={() => {
                        if (item.type === "destination") {
                          const dest = destinations.find((d) => d.id === item.id);
                          if (dest) openDestination(dest);
                        } else {
                          openResult(item);
                        }
                      }}
                    >
                      <img src={item.image} alt="" className="tm-suggestion-thumb" />
                      <div className="tm-suggestion-info">
                        <span className="tm-suggestion-title">{item.title}</span>
                        <span className="tm-suggestion-subtitle">{item.subtitle}</span>
                      </div>
                      <span className="tm-suggestion-badge">{item.type}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="tm-location-line">
              <Navigation size={15} fill="currentColor" />
              <span>Planning from</span>
              <button type="button" onClick={() => setPanel("map")}>
                {currentLocation.name} <ChevronRight size={14} />
              </button>
            </div>
          </div>
          <div className="tm-hero-scene">
            <img src={destination.image} alt="" />
            <div className="tm-scene-card">
              <span>NOW IN {destination.name.toUpperCase()}</span>
              <strong>{weatherTemperature}</strong>
              <p><CloudSun size={15} /> {destination.condition}</p>
            </div>
          </div>
        </section>

        <section className="tm-dashboard-strip" aria-label="Travel overview">
          <article>
            <span><MapPin size={18} /></span>
            <div>
              <small>EXPLORING NOW</small>
              <b>{destination.name}, {destination.region}</b>
            </div>
            <button type="button" onClick={() => setView("explore")}>View guide <ArrowUpRight size={15} /></button>
          </article>
          <article>
            <span><CalendarDays size={18} /></span>
            <div>
              <small>YOUR NEXT TRIP</small>
              <b>{trips[0]?.startDate || "Choose travel dates"}</b>
            </div>
            <button type="button" onClick={() => setPanel("planner")}><Plus size={16} /></button>
          </article>
          <article>
            <span><UsersRound size={18} /></span>
            <div>
              <small>TRAVEL TOGETHER</small>
              <b>Private group safety</b>
            </div>
            <button type="button" onClick={() => setPanel("group")}>Open <ArrowUpRight size={15} /></button>
          </article>
        </section>

        <section className="tm-quick-section">
          <SectionTitle eyebrow="TRAVEL TOOLS" title="Everything you need, right here" />
          <div className="tm-quick-grid">
            {quickActions.map((action) => (
              <button type="button" className="tm-quick-action" key={action.id} onClick={() => handleQuickAction(action.id)}>
                <span className={`tm-quick-icon is-${action.id}`}>{categoryIcon[action.id]}</span>
                <span>
                  <strong>{action.label}</strong>
                  <small>{action.caption}</small>
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle
            eyebrow="RAJASTHAN TOURISM"
            title={rajasthanTheme === "All" ? "The best of Rajasthan, curated for you" : `${rajasthanTheme} experiences in Rajasthan`}
            action="Explore all"
            onAction={() => { setRajasthanTheme("All"); setView("explore"); }}
          />
          <div className="tm-theme-chip-row" aria-label="Filter Rajasthan destinations by travel style">
            {rajasthanThemes.map((theme) => (
              <button key={theme} type="button" className={rajasthanTheme === theme ? "is-selected" : ""} onClick={() => setRajasthanTheme(theme)}>
                {theme}
              </button>
            ))}
          </div>
          <div className="tm-card-scroll">
            {shownRajasthanDestinations.map((item) => (
              <DestinationCard key={item.id} destination={item} saved={savedFor(item.id)} onSave={() => void toggleSave(destinationSaveItem(item))} onOpen={() => openDestination(item)} compact />
            ))}
          </div>
        </section>

        <div className="tm-home-columns">
          <section className="tm-upcoming-card">
            <div className="tm-upcoming-head">
              <div>
                <p className="tm-eyebrow">UPCOMING ADVENTURE</p>
                <h2>{trips[0]?.title || "Rajasthan, at your pace"}</h2>
              </div>
              <button type="button" onClick={() => setPanel("planner")}><Settings2 size={17} /></button>
            </div>
            <div className="tm-trip-route">
              <span>DEL</span>
              <div><i /><b /><i /></div>
              <span>{(trips[0]?.destination || destination.name).slice(0, 3).toUpperCase()}</span>
            </div>
            <div className="tm-trip-facts">
              <span><CalendarDays size={17} /> {trips[0]?.startDate || "Choose dates"}</span>
              <span><UserRound size={17} /> {planner.travellers} travellers</span>
              <span><WalletCards size={17} /> ₹{(trips[0]?.budget || planner.budget).toLocaleString("en-IN")}</span>
            </div>
            {currentTrip && currentTrip.items[0] && (
              <div className="tm-next-stop">
                <img src={destination.places[0].image} alt="" />
                <div>
                  <small>NEXT STOP • 09:00</small>
                  <strong>{currentTrip.items[0].title}</strong>
                  <p>{currentTrip.items[0].meta}</p>
                </div>
                <button type="button" onClick={() => setPanel("map")}><Navigation size={17} /></button>
              </div>
            )}
            <button type="button" className="tm-full-outline" onClick={() => setView("trips")}>
              Open trip workspace <ChevronRight size={16} />
            </button>
          </section>

          <section className="tm-weather-card">
            <div className="tm-weather-heading">
              <div>
                <p className="tm-eyebrow">AT YOUR DESTINATION</p>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h2>{destination.name} weather</h2>
                  <button type="button" style={{ border: "1px solid var(--line)", background: "transparent", borderRadius: 6, padding: "2px 6px", fontSize: 11, cursor: "pointer" }} onClick={() => setWeatherUnit((unit) => (unit === "C" ? "F" : "C"))}>
                    °{weatherUnit}
                  </button>
                </div>
              </div>
              <CloudSun size={28} />
            </div>
            <div className="tm-weather-big">
              <strong>{weatherTemperature}</strong>
              <div>
                <p>{destination.condition}</p>
                <span>Feels like {weatherFeelsLike}</span>
              </div>
            </div>
            <div className="tm-weather-stats">
              <span><Droplets size={16} /> {weatherHumidity}<small>Humidity</small></span>
              <span><Wind size={16} /> {weatherWind}<small>Wind</small></span>
              <span><CloudSun size={16} /> {destination.rain}<small>Rain</small></span>
            </div>
            <p className="tm-weather-note">
              <Sparkles size={15} /> Great conditions for an outdoor stroll by the heritage quarter.
            </p>
          </section>
        </div>

        <section>
          <SectionTitle
            eyebrow="A LITTLE CLOSER"
            title="Three distinct Rajasthan stories"
            action="Browse Rajasthan"
            onAction={() => { setRajasthanTheme("All"); setView("explore"); }}
          />
          <div className="tm-trending-grid">
            {rajasthanDestinations
              .filter((item) => ["jaisalmer", "ranthambore", "pushkar"].includes(item.id))
              .map((item, index) => (
                <button type="button" className="tm-trend-card" onClick={() => openDestination(item)} key={item.id}>
                  <img src={item.image} alt="" />
                  <div>
                    <small>0{index + 1}</small>
                    <h3>{item.name}</h3>
                    <p>{item.tags.slice(0, 2).join(" • ")}</p>
                  </div>
                  <ArrowUpRight size={18} />
                </button>
              ))}
          </div>
        </section>
      </>
    );
  }

  function renderExploreView() {
    const places = destination.places;
    return (
      <>
        <section className="tm-explore-hero">
          <img src={destination.image} alt="" />
          <div className="tm-explore-copy">
            <button type="button" className="tm-back-chip" onClick={() => { setView("home"); setQuery(""); }}>
              <ChevronRight size={15} className="tm-flip" /> Back to home
            </button>
            <p>{destination.region.toUpperCase()} • {destination.country.toUpperCase()}</p>
            <h1>
              {destination.name}
              <span>{destination.tagline}</span>
            </h1>
            <div>
              <Rating rating={destination.rating} count={destination.reviews} />
              <span> • Best {destination.bestTime}</span>
            </div>
          </div>
          <button
            type="button"
            className={`tm-save-explore ${savedFor(destination.id) ? "is-saved" : ""}`}
            onClick={() => void toggleSave(destinationSaveItem(destination))}
          >
            <Heart size={18} fill={savedFor(destination.id) ? "currentColor" : "none"} /> {savedFor(destination.id) ? "Saved" : "Save"}
          </button>
        </section>

        <section className="tm-destination-intro">
          <div>
            <p className="tm-eyebrow">DESTINATION GUIDE</p>
            <h2>A beautiful reason to slow down.</h2>
            <p>{destination.description}</p>
            <small className="tm-guide-note">
              Ratings, review counts, availability, entry fees, and hours can change seasonally.
            </small>
          </div>
          <div className="tm-guide-facts">
            <span><CalendarDays size={18} /><b>Best time</b>{destination.bestTime}</span>
            <span><CircleDollarSign size={18} /><b>Expected spend</b>{destination.budget}</span>
            <span><Clock3 size={18} /><b>Ideal stay</b>{destination.duration}</span>
          </div>
        </section>

        <form className="tm-explore-search" onSubmit={runSearch}>
          <Search size={20} />
          <input
            value={query}
            onChange={(event) => { setQuery(event.target.value); setRemoteResults([]); }}
            placeholder={`Search places in ${destination.name}...`}
          />
          <button type="submit">Search</button>
        </form>

        <div className="tm-filter-row" aria-label="Search filters">
          <SlidersHorizontal size={17} />
          {Object.entries(typeLabels).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setSearchType(key)} className={searchType === key ? "is-selected" : ""}>
              {label}
            </button>
          ))}
          <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort results">
            <option value="recommended">Recommended</option>
            <option value="rating">Top rated</option>
            <option value="price">Price</option>
          </select>
        </div>

        {query ? (
          <section>
            <SectionTitle eyebrow="SMART RESULTS" title={`${shownResults.length} matches for "${query}"`} />
            {searchState === "loading" ? (
              <div className="tm-search-loading" aria-live="polite">
                <span /><span /><span />
                <p>Searching destinations, stays, food, and activities...</p>
              </div>
            ) : searchState === "error" ? (
              <div className="tm-search-error" role="alert">
                <div>
                  <Search size={20} />
                  <div>
                    <h3>We couldn't complete that search</h3>
                    <p>{searchError}</p>
                  </div>
                </div>
                <button type="button" onClick={() => void performSearch(query.trim())}>Try again</button>
              </div>
            ) : (
              <div className="tm-search-results">
                {shownResults.map((result) => (
                  <button type="button" className="tm-search-result" key={`${result.type}-${result.id}`} onClick={() => openResult(result)}>
                    <img src={result.image} alt="" />
                    <div>
                      <span>{result.type}</span>
                      <h3>{result.title}</h3>
                      <p>{result.subtitle}</p>
                      <small>{result.tags.join(" • ")}</small>
                    </div>
                    <div>
                      <Rating rating={result.rating} />
                      <strong>{result.price}</strong>
                    </div>
                  </button>
                ))}
                {shownResults.length === 0 && (
                  <div className="tm-empty-state">
                    <Compass size={28} />
                    <h3>No exact match yet</h3>
                    <p>Try a city, hotel, food, or attraction name.</p>
                  </div>
                )}
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="tm-heritage-section" aria-label={`${destination.name} Heritage & Experiences`}>
              <div className="tm-heritage-header">
                <p className="tm-eyebrow">{destination.name.toUpperCase()} • CURATED DESTINATION HIGHLIGHTS</p>
                <h2>{destination.name} Heritage & Experiences</h2>
                <p className="tm-heritage-subtitle">
                  Explore living heritage monuments, traditional craft lineages, and curated crowd planning estimates across {destination.name}.
                </p>
              </div>

              <div className="tm-heritage-filters" role="tablist" aria-label="Smart filters">
                {heritageFilterTabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={heritageFilter === tab}
                    className={`tm-heritage-filter-chip ${heritageFilter === tab ? "is-active" : ""}`}
                    onClick={() => setHeritageFilter(tab)}
                  >
                    {tab === "All" && "✦ All Highlights"}
                    {tab === "Heritage" && "🏛️ Heritage"}
                    {tab === "Artisan & Crafts" && "🎨 Artisan & Crafts"}
                    {tab === "Sustainable Hospitality" && "🌱 Sustainable Hospitality"}
                    {tab === "Heritage Walk" && "🚶 Local Walks"}
                    {tab === "Low-Crowd Gems" && "🟢 Low-Crowd Gems"}
                  </button>
                ))}
              </div>

              <div className="tm-place-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
                {heritagePlaces.map((place) => (
                  <PlaceCard
                    key={`heritage-${place.id}`}
                    place={place}
                    destinationName={destination.name}
                    saved={savedFor(place.id)}
                    onSave={() => void toggleSave(placeSaveItem(place))}
                    onOpen={() => setSelectedPlace(place)}
                  />
                ))}
              </div>

              {heritagePlaces.length === 0 && (
                <div className="tm-empty-state">
                  <Compass size={28} />
                  <h3>No spots match "{heritageFilter}"</h3>
                  <p>Switch back to "All Highlights" to view all curated spots in {destination.name}.</p>
                </div>
              )}
            </section>

            {isUdaipur && (
              <section className="tm-circuit-section" aria-label="Old Udaipur Heritage & Artisan Circuit">
                <div className="tm-circuit-header">
                  <div>
                    <div className="tm-circuit-badge-row">
                      <span className="tm-badge-walking">🚶 Walking Circuit</span>
                      <span className="tm-badge-distance">~1.8 km Pedestrian Route</span>
                      <span className="tm-badge-duration">2.5–3 hours</span>
                    </div>
                    <h2 className="tm-circuit-title">Old Udaipur Heritage & Artisan Circuit</h2>
                    <p className="tm-circuit-desc">
                      A curated 5-stop walking circuit through living Mewar craft and architectural history. Connect royal courtyards, 17th-century stone carving, active miniature painter studios, haveli folk traditions, and panoramic lake ghats on foot.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="tm-circuit-map-btn"
                    onClick={() => void openCircuitMap(udaipurHeritageCircuit)}
                    aria-label="View Old Udaipur Heritage & Artisan Circuit on interactive route map"
                  >
                    <MapPin size={16} />
                    <span>View Circuit on Map</span>
                    <ArrowUpRight size={15} />
                  </button>
                </div>

                {/* Circuit Stops Timeline / Cards */}
                <div className="tm-circuit-stops-grid" role="list" aria-label="5 Curated Circuit Stops">
                  {udaipurHeritageCircuit.stops.map((stop) => {
                    const isCraft = stop.category === "Artisan & Crafts" || Boolean(stop.craftCategory);
                    const isPeak = stop.crowdLevel === "peak";
                    return (
                      <article key={stop.id} className="tm-circuit-stop-card" role="listitem">
                        <div className="tm-circuit-stop-top">
                          <span className="tm-stop-number-pill">Stop {stop.stepNumber}</span>
                          <span className={`tm-stop-category-pill is-${isCraft ? "craft" : stop.category === "Water Heritage" ? "water" : "heritage"}`}>
                            {isCraft ? "🎨 Artisan & Crafts" : stop.category === "Water Heritage" ? "🌊 Water Heritage" : "🏛️ Heritage"}
                          </span>
                          {stop.sustainable && (
                            <span className="tm-stop-sust-badge" title="Sustainable practices">🌱 Eco</span>
                          )}
                        </div>

                        <h3 className="tm-circuit-stop-name">{stop.name}</h3>
                        <p className="tm-circuit-stop-loc"><MapPin size={12} /> {stop.location}</p>
                        <p className="tm-circuit-stop-desc">{stop.description}</p>

                        {stop.craftCategory && (
                          <div className="tm-stop-craft-highlight">
                            <b>🎨 Craft Lineage:</b> {stop.craftCategory}
                            {stop.localSourcing && <p>{stop.localSourcing}</p>}
                          </div>
                        )}

                        {stop.heritageNotes && (
                          <p className="tm-stop-heritage-note">
                            <Landmark size={12} /> {stop.heritageNotes}
                          </p>
                        )}

                        {stop.crowdLevel && (
                          <div className="tm-circuit-stop-crowd">
                            <div className="tm-stop-crowd-row">
                              <span className={`tm-badge-crowd is-${stop.crowdLevel}`}>
                                {stop.crowdLevel === "low"
                                  ? "🟢 Low Crowd"
                                  : stop.crowdLevel === "moderate"
                                  ? "🟡 Moderate Crowd"
                                  : "🔴 Peak Hours"}
                              </span>
                              <small className="tm-curated-label">Curated planning estimate</small>
                            </div>
                            {stop.recommendedVisitTime && (
                              <p className="tm-stop-time-rec"><b>Recommended:</b> {stop.recommendedVisitTime}</p>
                            )}
                            {stop.peakHours && (
                              <p className="tm-stop-time-peak"><b>Peak hours:</b> {stop.peakHours}</p>
                            )}
                            {isPeak && stop.crowdReliefSuggestion && (
                              <div className="tm-peak-relief">
                                <b>💡 Try a quieter time:</b> {stop.crowdReliefSuggestion}
                              </div>
                            )}
                            {!isPeak && stop.crowdReliefSuggestion && (
                              <div className="tm-peak-relief is-neutral">
                                <b>💡 Planning tip:</b> {stop.crowdReliefSuggestion}
                              </div>
                            )}
                          </div>
                        )}

                        {stop.plasticReduction && (
                          <p className="tm-stop-eco-note">
                            ♻️ {stop.plasticReduction}
                          </p>
                        )}

                        <div className="tm-circuit-stop-footer">
                          {stop.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="tm-stop-tag">#{tag}</span>
                          ))}
                        </div>
                      </article>
                    );
                  })}
                </div>

                {/* Responsible Walking Guidance Block */}
                <div className="tm-circuit-responsible-box" aria-label="Responsible walking guidance">
                  <div className="tm-circuit-resp-head">
                    <ShieldAlert size={18} />
                    <h4>Responsible Walking Etiquette on the Circuit</h4>
                  </div>
                  <ul className="tm-circuit-resp-list">
                    {udaipurHeritageCircuit.walkingTips.map((tip, idx) => (
                      <li key={idx}>
                        <Check size={14} className="tm-tip-check" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            <section>
              <SectionTitle eyebrow="DON'T MISS" title={`The heart of ${destination.name}`} action="View on map" onAction={() => setPanel("map")} />
              <div className="tm-place-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
                {places.filter((place) => place.kind === "attraction" || place.kind === "activity").map((place) => (
                  <PlaceCard key={place.id} place={place} destinationName={destination.name} saved={savedFor(place.id)} onSave={() => void toggleSave(placeSaveItem(place))} onOpen={() => setSelectedPlace(place)} />
                ))}
              </div>
            </section>

            {destination.responsibleTravelGuidelines && destination.responsibleTravelGuidelines.length > 0 && (
              <section className="tm-responsible-panel" aria-label="Responsible Tourism & Cultural Etiquette">
                <div className="tm-responsible-header">
                  <div className="tm-responsible-icon">
                    <Sparkles size={22} />
                  </div>
                  <div>
                    <p className="tm-eyebrow">CULTURAL ETIQUETTE & SUSTAINABILITY</p>
                    <h2>Responsible Travel in {destination.name}</h2>
                    <p className="tm-responsible-subtitle">
                      Curated guidelines to protect living heritage monuments, fragile lake waters, and local artisan livelihoods.
                    </p>
                  </div>
                </div>

                <div className="tm-responsible-grid">
                  {destination.responsibleTravelGuidelines.map((item, idx) => {
                    const colonIndex = item.indexOf(":");
                    const title = colonIndex > -1 ? item.slice(0, colonIndex).trim() : `Guideline ${idx + 1}`;
                    const desc = colonIndex > -1 ? item.slice(colonIndex + 1).trim() : item;
                    return (
                      <article key={idx} className="tm-responsible-card">
                        <span className="tm-resp-badge">Etiquette #{idx + 1}</span>
                        <h3>{title}</h3>
                        <p>{desc}</p>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="tm-explore-split">
              <div className="tm-food-panel">
                <p className="tm-eyebrow">A TASTE OF PLACE</p>
                <h2>Must-try local food</h2>
                <div className="tm-food-list">
                  {destination.foods.map((food, index) => (
                    <span key={food}><b>0{index + 1}</b> {food}</span>
                  ))}
                </div>
                <button type="button" onClick={() => { setSearchType("restaurant"); setQuery(""); }}>
                  Find restaurants <ArrowUpRight size={16} />
                </button>
              </div>
              <div className="tm-safety-panel">
                <ShieldAlert size={22} />
                <p className="tm-eyebrow">LOCAL KNOW-HOW</p>
                <h2>Travel smart</h2>
                {destination.tips.slice(0, 3).map((tip) => (
                  <p className="tm-tip" key={tip}><Check size={15} /> {tip}</p>
                ))}
                <button type="button" onClick={() => setPanel("emergency")}>Safety & emergency <ChevronRight size={16} /></button>
              </div>
            </section>

            <section>
              <SectionTitle eyebrow="STAY WELL" title="Places to stay" action="All stays" onAction={() => { setSearchType("hotel"); setQuery("hotel"); }} />
              <div className="tm-place-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
                {places.filter((place) => place.kind === "hotel").map((place) => (
                  <PlaceCard key={place.id} place={place} destinationName={destination.name} saved={savedFor(place.id)} onSave={() => void toggleSave(placeSaveItem(place))} onOpen={() => setSelectedPlace(place)} />
                ))}
              </div>
            </section>

            {places.some((place) => place.kind === "restaurant") && (
              <section>
                <SectionTitle eyebrow="LOCAL FLAVORS" title="Curated Dining & Cafés" action="All dining" onAction={() => { setSearchType("restaurant"); setQuery(""); }} />
                <div className="tm-place-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
                  {places.filter((place) => place.kind === "restaurant").map((place) => (
                    <PlaceCard key={place.id} place={place} destinationName={destination.name} saved={savedFor(place.id)} onSave={() => void toggleSave(placeSaveItem(place))} onOpen={() => setSelectedPlace(place)} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </>
    );
  }

  function renderTripsView() {
    const workspace = trips.find((trip) => trip.id === activeTripId) || trips[0];
    return (
      <section className="tm-trip-workspace">
        <div className="tm-workspace-head">
          <div>
            <p className="tm-eyebrow">YOUR TRIP WORKSPACE</p>
            <h1>{workspace?.title || `${destination.name} in the making`}</h1>
            <p>{workspace ? `${workspace.destination} • ${workspace.style} travel` : "A flexible plan that makes room for unforgettable moments."}</p>
          </div>
          <button type="button" className="tm-primary-button" onClick={() => setPanel("planner")}>
            <Plus size={17} /> Plan a trip
          </button>
        </div>

        {trips.length > 0 && (
          <div className="tm-trip-picker" aria-label="Saved trips">
            {trips.map((trip) => (
              <article className={workspace?.id === trip.id ? "is-active" : ""} key={trip.id}>
                <button type="button" onClick={() => openSavedTrip(trip)}>
                  <small>{trip.destination}</small>
                  <b>{trip.title}</b>
                  <span>{trip.startDate || "Dates not set"} • ₹{trip.budget.toLocaleString("en-IN")}</span>
                </button>
                <button type="button" aria-label={`Delete ${trip.title}`} className="tm-trip-delete" onClick={() => void deleteSavedTrip(trip)}>
                  <X size={15} />
                </button>
              </article>
            ))}
          </div>
        )}

        <div className="tm-trip-layout">
          <div className="tm-itinerary-panel">
            <div className="tm-itinerary-head">
              <div>
                <h2>Your itinerary</h2>
                <p>Drag-free editing, built for actual travel days.</p>
              </div>
              <button type="button" onClick={() => setPanel("assistant")}>
                <Sparkles size={16} /> Improve with AI
              </button>
            </div>
            {plannerItinerary.map((day) => (
              <article className="tm-day-card" key={day.day}>
                <div className="tm-day-number">
                  <span>DAY</span>
                  <strong>{String(day.day).padStart(2, "0")}</strong>
                </div>
                <div className="tm-day-content">
                  <h3>{day.title}</h3>
                  <ItineraryRows items={day.items} />
                  <button type="button" className="tm-edit-link" onClick={() => setPanel("planner")}>
                    Edit in planner <ChevronRight size={15} />
                  </button>
                </div>
              </article>
            ))}
          </div>

          <aside className="tm-trip-side">
            <div className="tm-side-budget">
              <div>
                <p className="tm-eyebrow">AT A GLANCE</p>
                <h3>₹{(workspace?.budget || planner.budget).toLocaleString("en-IN")}</h3>
                <p>Total trip budget • {planner.days} days</p>
              </div>
              <button type="button" onClick={() => setPanel("budget")}><WalletCards size={18} /></button>
              <div className="tm-budget-bar"><span style={{ width: "62%" }} /></div>
              <p><b>Estimate</b> based on your selected budget <span>Adjust anytime</span></p>
            </div>
            <button type="button" className="tm-side-action" onClick={() => setPanel("packing")}>
              <span><Bookmark size={19} /><b>Packing checklist<small>7 essentials ready</small></b></span>
              <ChevronRight size={16} />
            </button>
            <button type="button" className="tm-side-action" onClick={() => setPanel("map")}>
              <span><Map size={19} /><b>Trip map<small>Interactive route stops</small></b></span>
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              className="tm-offline-card"
              onClick={() => {
                setOffline(!offline);
                setToast(offline ? "Offline trip mode turned off." : "Core trip details are saved for offline use.");
              }}
            >
              <WifiOff size={19} />
              <span><b>{offline ? "Available offline" : "Save for offline"}</b><small>Itinerary, stays & emergency info</small></span>
              <Download size={17} />
            </button>
          </aside>
        </div>
      </section>
    );
  }

  function renderSavedView() {
    const sample = destinations.filter((item) => savedFor(item.id));
    return (
      <section className="tm-saved-view">
        <div className="tm-workspace-head">
          <div>
            <p className="tm-eyebrow">YOUR WISHLIST</p>
            <h1>Saved for someday soon.</h1>
            <p>Keep every destination, stay, and local gem in collections you'll love returning to.</p>
          </div>
          <button
            type="button"
            className="tm-primary-button"
            onClick={() => {
              if (!user) { setAuthMode("signup"); setPanel("auth"); }
              else setToast("New collections are ready to organise your saved places.");
            }}
          >
            <Plus size={17} /> New collection
          </button>
        </div>

        <div className="tm-collection-head">
          <div className="tm-collection-avatar"><Heart size={18} fill="currentColor" /></div>
          <div>
            <h2>My Rajasthan Trip</h2>
            <p>{Math.max(savedPlaces.length, sample.length)} places • Private collection</p>
          </div>
          <button type="button" onClick={() => setPanel("assistant")}>
            Get AI route <Sparkles size={15} />
          </button>
        </div>

        {savedPlaces.length || sample.length ? (
          <div className="tm-saved-grid">
            {sample.map((item) => (
              <DestinationCard key={item.id} destination={item} saved onSave={() => void toggleSave(destinationSaveItem(item))} onOpen={() => openDestination(item)} />
            ))}
            {savedPlaces
              .filter((item) => !destinations.some((d) => d.id === item.placeId))
              .map((item) => (
                <article className="tm-saved-place" key={item.id}>
                  <img src={item.imageUrl || destination.image} alt="" />
                  <div>
                    <span>{item.placeType}</span>
                    <h3>{item.title}</h3>
                    <p>{item.collection}</p>
                  </div>
                  <button type="button" onClick={() => void toggleSave({ id: item.placeId, title: item.title, type: item.placeType, image: item.imageUrl || destination.image })}>
                    <X size={16} />
                  </button>
                </article>
              ))}
          </div>
        ) : (
          <div className="tm-empty-state tm-large-empty">
            <Heart size={35} />
            <h2>Keep your next escape close.</h2>
            <p>Save destinations, hotels, restaurants, and attractions to build your personal wishlist.</p>
            <button type="button" className="tm-primary-button" onClick={() => setView("explore")}>Explore places</button>
          </div>
        )}
      </section>
    );
  }

  function renderProfileView() {
    return (
      <section className="tm-profile-view">
        <div className="tm-profile-hero">
          <div className="tm-profile-avatar">
            {user ? user.name.slice(0, 1).toUpperCase() : <UserRound size={29} />}
          </div>
          <div>
            <p className="tm-eyebrow">TRAVELER PROFILE</p>
            <h1>{user?.name || "Make TravelMate yours"}</h1>
            <p>{user ? user.email : "Sign in to save trips, create journals, and sync your travel preferences."}</p>
          </div>
          {user ? (
            <div className="tm-profile-actions">
              <button type="button" className="tm-outline-button" onClick={() => setPanel("profile-settings")}>
                <Settings2 size={16} /> Edit profile
              </button>
              <button type="button" className="tm-profile-signout" onClick={() => void logout()}>
                <LogOut size={16} /> Sign out
              </button>
            </div>
          ) : (
            <button type="button" className="tm-primary-button" onClick={() => { setAuthMode("signup"); setPanel("auth"); }}>
              Create account
            </button>
          )}
        </div>

        <div className="tm-profile-stats">
          <span><b>{trips.length}</b> Trips planned</span>
          <span><b>{Math.max(savedPlaces.length, savedIds.length)}</b> Places saved</span>
          <span><b>1</b> Active journal</span>
        </div>

        <div className="tm-profile-grid">
          <article className="tm-journal-card">
            <div>
              <p className="tm-eyebrow">PRIVATE TRAVEL JOURNAL</p>
              <h2>Memories, kept close.</h2>
              <p>Capture the little things: a viewpoint at dusk, a memorable meal, or a hidden bazaar.</p>
            </div>
            <div className="tm-journal-note">
              <Camera size={18} />
              <div>
                <b>Udaipur Lake Notes</b>
                <p>"The lake turned golden just before dinner by the ghats."</p>
              </div>
            </div>
            <button type="button" onClick={() => user ? setToast("Journal entries are private and synced to your account.") : setPanel("auth")}>
              Write an entry <ChevronRight size={16} />
            </button>
          </article>

          <article className="tm-notification-card">
            <Bell size={22} />
            <p className="tm-eyebrow">TRIP REMINDERS</p>
            <h2>Stay one step ahead.</h2>
            <p>Get weather shifts, upcoming travel dates, and group safety notifications.</p>
            <button
              type="button"
              onClick={() => {
                if ("Notification" in window) {
                  void Notification.requestPermission().then((permission) =>
                    setToast(permission === "granted" ? "Travel notifications are enabled." : "Notifications permission checked.")
                  );
                }
              }}
            >
              Manage notifications <ChevronRight size={16} />
            </button>
          </article>
        </div>
      </section>
    );
  }

  function renderView() {
    if (view === "explore") return renderExploreView();
    if (view === "trips") return renderTripsView();
    if (view === "saved") return renderSavedView();
    if (view === "profile") return renderProfileView();
    return renderHomeView();
  }

  return (
    <div className={`tm-app ${dark ? "tm-dark" : ""}`}>
      <aside className={`tm-sidebar ${menuOpen ? "is-open" : ""}`}>
        <div className="tm-brand">
          <span className="tm-brand-mark"><PlaneTakeoff size={19} /></span>
          <span>travel<em>mate</em></span>
          <button type="button" className="tm-mobile-close" onClick={() => setMenuOpen(false)}>
            <X size={19} />
          </button>
        </div>
        <nav aria-label="Primary navigation">
          {navItems.map((item) => {
            const Icon = item.id === "home" ? Home : item.id === "explore" ? Compass : item.id === "trips" ? Route : item.id === "saved" ? Heart : UserRound;
            return (
              <button
                type="button"
                key={item.id}
                className={view === item.id ? "is-active" : ""}
                onClick={() => { setView(item.id); setMenuOpen(false); }}
              >
                <Icon size={19} />
                <span>{item.label}</span>
                {item.id === "trips" && trips.length > 0 ? <b>{trips.length}</b> : null}
              </button>
            );
          })}
        </nav>
        <div className="tm-sidebar-bottom">
          <button type="button" className="tm-ai-nav" onClick={() => setPanel("assistant")}>
            <span><Sparkles size={18} /></span>
            <div>
              <b>TravelMate AI</b>
              <small>Plan smarter with AI</small>
            </div>
            <ChevronRight size={16} />
          </button>
          <button type="button" className="tm-emergency-nav" onClick={() => setPanel("emergency")}>
            <ShieldAlert size={18} /> Emergency & safety
          </button>
          <div className="tm-sidebar-user">
            <div className="tm-sidebar-avatar">
              {user ? user.name[0].toUpperCase() : <UserRound size={16} />}
            </div>
            <div>
              <b>{user?.name || "Guest traveler"}</b>
              <small>{user ? "Personal workspace" : "Sign in to sync"}</small>
            </div>
            <button type="button" aria-label="Open profile" onClick={() => setView("profile")}>
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </aside>

      {menuOpen && <button type="button" className="tm-scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}

      <main className="tm-main">
        <header className="tm-topbar">
          <button type="button" className="tm-menu-button" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            <Menu size={22} />
          </button>
          <div className="tm-mobile-brand">
            <span className="tm-brand-mark"><PlaneTakeoff size={16} /></span> travel<em>mate</em>
          </div>
          <button type="button" className="tm-topbar-context" onClick={() => setPanel("map")} aria-label="Change travel starting location">
            <MapPin size={16} />
            <span>{currentLocation.name}</span>
            <ChevronRight size={15} />
          </button>
          <div className="tm-topbar-actions">
            <IconButton label="Toggle color theme" onClick={setTheme}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </IconButton>
            <IconButton label="Notifications" onClick={() => setPanel("notifications")}>
              <Bell size={18} />
              <i className="tm-notification-dot" />
            </IconButton>
            {user ? (
              <button type="button" className="tm-header-profile" onClick={() => setView("profile")}>
                <span>{user.name[0].toUpperCase()}</span>
                <b>{user.name.split(" ")[0]}</b>
              </button>
            ) : (
              <button type="button" className="tm-signin-button" onClick={() => { setAuthMode("login"); setPanel("auth"); }}>
                Sign in
              </button>
            )}
          </div>
        </header>
        <div className="tm-page-content">{renderView()}</div>
        <TravelMateFooter
          onNavigateView={(v) => { setView(v); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          onOpenPanel={(p) => setPanel(p)}
        />
      </main>

      {selectedPlace && (
        <PlaceDetailsModal
          place={selectedPlace}
          destination={destination}
          saved={savedFor(selectedPlace.id)}
          onSave={() => void toggleSave(placeSaveItem(selectedPlace))}
          onClose={() => setSelectedPlace(null)}
          onViewOnMap={() => {
            setSelectedPlace(null);
            setPanel("map");
          }}
          onAddToTrip={() => {
            setSelectedPlace(null);
            setPanel("planner");
          }}
        />
      )}

      <nav className="tm-bottom-nav" aria-label="Mobile navigation">
        {navItems.map((item) => {
          const Icon = item.id === "home" ? Home : item.id === "explore" ? Compass : item.id === "trips" ? Route : item.id === "saved" ? Heart : UserRound;
          return (
            <button type="button" key={item.id} className={view === item.id ? "is-active" : ""} onClick={() => setView(item.id)}>
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <button type="button" className="tm-assistant-fab" onClick={() => setPanel("assistant")} aria-label="Open TravelMate AI">
        <Sparkles size={20} />
        <span>Ask AI</span>
      </button>

      {toast && (
        <div className="tm-toast" role="status">
          <Check size={17} /> {toast}
        </div>
      )}

      {panel && (
        <PanelOverlay
          panel={panel}
          close={() => setPanel(null)}
          destination={destination}
          planner={planner}
          setPlanner={setPlanner}
          itinerary={plannerItinerary}
          setItinerary={setPlannerItinerary}
          generatePlan={generatePlan}
          saveTrip={saveTrip}
          budgetTotal={budgetTotal}
          setBudgetTotal={setBudgetTotal}
          budgetMode={budgetMode}
          setBudgetMode={setBudgetMode}
          packing={packing}
          setPacking={setPacking}
          authMode={authMode}
          setAuthMode={setAuthMode}
          authForm={authForm}
          setAuthForm={setAuthForm}
          authBusy={authBusy}
          submitAuth={submitAuth}
          googleConfigured={featureConfig.auth.googleConfigured}
          googleClientId={featureConfig.auth.googleClientId}
          onGoogleAuth={submitGoogleAuth}
          assistantMessage={assistantMessage}
          setAssistantMessage={setAssistantMessage}
          assistantMessages={assistantMessages}
          assistantBusy={assistantBusy}
          askAssistant={askAssistant}
          setToast={setToast}
          aiProviderConfigured={featureConfig.ai.providerConfigured}
          activeAiProvider={featureConfig.ai.activeProvider}
          currentLocation={currentLocation}
          onLocationChange={updateCurrentLocation}
          onDestinationChange={openDestination}
          user={user}
          onProfileUpdated={(p) => setUser((curr) => (curr ? { ...curr, name: p.name, avatarUrl: p.avatarUrl } : curr))}
          onRequireAuth={() => { setAuthMode("signup"); setPanel("auth"); setToast("Sign in to create or join a private travel safety group."); }}
          activeCircuit={activeCircuit}
          mapMode={mapMode}
          onSetMapMode={setMapMode}
          circuitRouteCoordinates={circuitRouteCoordinates}
          circuitDistanceKm={circuitDistanceKm}
          circuitDurationMinutes={circuitDurationMinutes}
          circuitLoading={circuitLoading}
          onOpenCircuit={openCircuitMap}
        />
      )}
    </div>
  );
}

function PanelOverlay({
  panel,
  close,
  destination,
  planner,
  setPlanner,
  itinerary,
  setItinerary,
  generatePlan,
  saveTrip,
  budgetTotal,
  setBudgetTotal,
  budgetMode,
  setBudgetMode,
  packing,
  setPacking,
  authMode,
  setAuthMode,
  authForm,
  setAuthForm,
  authBusy,
  submitAuth,
  googleConfigured,
  googleClientId,
  onGoogleAuth,
  assistantMessage,
  setAssistantMessage,
  assistantMessages,
  assistantBusy,
  askAssistant,
  setToast,
  aiProviderConfigured,
  activeAiProvider,
  currentLocation,
  onLocationChange,
  onDestinationChange,
  user,
  onProfileUpdated,
  onRequireAuth,
  activeCircuit,
  mapMode,
  onSetMapMode,
  circuitRouteCoordinates,
  circuitDistanceKm,
  circuitDurationMinutes,
  circuitLoading,
  onOpenCircuit,
}: {
  panel: Exclude<Panel, null>;
  close: () => void;
  destination: Destination;
  planner: PlannerForm;
  setPlanner: (value: PlannerForm | ((current: PlannerForm) => PlannerForm)) => void;
  itinerary: ReturnType<typeof createItinerary>;
  setItinerary: (value: ReturnType<typeof createItinerary> | ((current: ReturnType<typeof createItinerary>) => ReturnType<typeof createItinerary>)) => void;
  generatePlan: () => void;
  saveTrip: () => void;
  budgetTotal: number;
  setBudgetTotal: (value: number) => void;
  budgetMode: "Budget" | "Standard" | "Premium";
  setBudgetMode: (value: "Budget" | "Standard" | "Premium") => void;
  packing: Record<string, boolean>;
  setPacking: (value: Record<string, boolean> | ((current: Record<string, boolean>) => Record<string, boolean>)) => void;
  authMode: "login" | "signup" | "forgot";
  setAuthMode: (value: "login" | "signup" | "forgot") => void;
  authForm: { name: string; email: string; password: string };
  setAuthForm: (value: { name: string; email: string; password: string }) => void;
  authBusy: boolean;
  submitAuth: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  googleConfigured?: boolean;
  googleClientId?: string;
  onGoogleAuth?: (idToken: string) => Promise<{ ok: boolean; error?: string } | void>;
  assistantMessage: string;
  setAssistantMessage: (value: string) => void;
  assistantMessages: ChatMessage[];
  assistantBusy: boolean;
  askAssistant: (event: FormEvent) => Promise<void>;
  setToast: (value: string) => void;
  aiProviderConfigured: boolean;
  activeAiProvider: string;
  currentLocation: RouteLocation;
  onLocationChange: (location: RouteLocation) => void;
  onDestinationChange: (destination: Destination) => void;
  user: Account | null;
  onProfileUpdated: (profile: { name: string; avatarUrl: string | null }) => void;
  onRequireAuth: () => void;
  activeCircuit?: HeritageCircuit | null;
  mapMode?: "travel" | "circuit";
  onSetMapMode?: (mode: "travel" | "circuit") => void;
  circuitRouteCoordinates?: number[][];
  circuitDistanceKm?: number | null;
  circuitDurationMinutes?: number | null;
  circuitLoading?: boolean;
  onOpenCircuit?: (circuit: HeritageCircuit) => void;
}) {
  const title =
    panel === "planner" ? "Plan your trip" :
    panel === "assistant" ? (destination.id === "udaipur" ? "Udaipur Heritage & Sustainable Companion" : "TravelMate AI") :
    panel === "auth" ? (authMode === "signup" ? "Join TravelMate" : authMode === "forgot" ? "Reset your password" : "Welcome back") :
    panel === "emergency" ? "Emergency & safety" :
    panel === "budget" ? "Travel budget" :
    panel === "packing" ? "Smart packing list" :
    panel === "map" ? (mapMode === "circuit" ? "Old Udaipur Heritage & Artisan Circuit" : `Around ${destination.name}`) :
    panel === "group" ? "Group safety" :
    panel === "profile-settings" ? "Your travel profile" :
    "Notifications";

  return (
    <div className="tm-modal-wrap" role="dialog" aria-modal="true" aria-labelledby="panel-title">
      <button className="tm-modal-scrim" type="button" aria-label="Close panel" onClick={close} />
      <section tabIndex={-1} className={`tm-panel tm-panel--${panel}`}>
        <header>
          <div>
            <p className="tm-eyebrow">
              {panel === "assistant" ? (destination.id === "udaipur" ? "HERITAGE & SUSTAINABLE TOURISM COMPANION" : "YOUR ALWAYS-ON TRIP COMPANION") : panel === "map" ? (mapMode === "circuit" ? "WALKING CIRCUIT MAP" : "INTERACTIVE TRIP MAP") : "TRAVELMATE"}
            </p>
            <h2 id="panel-title">{title}</h2>
          </div>
          <IconButton label="Close panel" onClick={close}><X size={20} /></IconButton>
        </header>

        {panel === "planner" && (
          <PlannerPanel
            planner={planner}
            setPlanner={setPlanner}
            itinerary={itinerary}
            setItinerary={setItinerary}
            generatePlan={generatePlan}
            saveTrip={saveTrip}
          />
        )}
        {panel === "assistant" && (
          <AssistantPanel
            destination={destination}
            message={assistantMessage}
            setMessage={setAssistantMessage}
            messages={assistantMessages}
            busy={assistantBusy}
            ask={askAssistant}
            providerConfigured={aiProviderConfigured}
            activeProvider={activeAiProvider}
          />
        )}
        {panel === "auth" && (
          <AuthPanel
            mode={authMode}
            setMode={setAuthMode}
            form={authForm}
            setForm={setAuthForm}
            busy={authBusy}
            submit={submitAuth}
            googleConfigured={googleConfigured}
            googleClientId={googleClientId}
            onGoogleAuth={onGoogleAuth}
          />
        )}
        {panel === "emergency" && <EmergencyPanel destination={destination} />}
        {panel === "budget" && (
          <BudgetPanel
            total={budgetTotal}
            setTotal={setBudgetTotal}
            mode={budgetMode}
            setMode={setBudgetMode}
          />
        )}
        {panel === "packing" && <PackingPanel packing={packing} setPacking={setPacking} destination={destination} />}
        {panel === "map" && (
          <MapPanel
            destination={destination}
            currentLocation={currentLocation}
            onLocationChange={onLocationChange}
            onDestinationChange={onDestinationChange}
            setToast={setToast}
            activeCircuit={activeCircuit}
            mapMode={mapMode}
            onSetMapMode={onSetMapMode}
            circuitRouteCoordinates={circuitRouteCoordinates}
            circuitDistanceKm={circuitDistanceKm}
            circuitDurationMinutes={circuitDurationMinutes}
            circuitLoading={circuitLoading}
            onOpenCircuit={onOpenCircuit}
          />
        )}
        {panel === "group" && <GroupSafetyPanel user={user} destination={destination} onRequireAuth={onRequireAuth} />}
        {panel === "profile-settings" && <ProfileSettingsPanel onUpdated={onProfileUpdated} />}
        {panel === "notifications" && <NotificationsPanel setToast={setToast} />}
      </section>
    </div>
  );
}

function PlannerPanel({
  planner,
  setPlanner,
  itinerary,
  setItinerary,
  generatePlan,
  saveTrip,
}: {
  planner: PlannerForm;
  setPlanner: (value: PlannerForm | ((current: PlannerForm) => PlannerForm)) => void;
  itinerary: ReturnType<typeof createItinerary>;
  setItinerary: (value: ReturnType<typeof createItinerary> | ((current: ReturnType<typeof createItinerary>) => ReturnType<typeof createItinerary>)) => void;
  generatePlan: () => void;
  saveTrip: () => void;
}) {
  const [editorMessage, setEditorMessage] = useState("");
  const update = (key: keyof PlannerForm, value: string | number) => setPlanner((current) => ({ ...current, [key]: value }));

  const updateItem = (dayIndex: number, itemIndex: number, key: "time" | "title" | "location" | "durationMinutes" | "estimatedCost" | "notes", value: string) =>
    setItinerary((current) =>
      current.map((day, currentDayIndex) =>
        currentDayIndex !== dayIndex
          ? day
          : {
              ...day,
              items: day.items.map((item, currentItemIndex) =>
                currentItemIndex !== itemIndex
                  ? item
                  : {
                      ...item,
                      [key]: key === "durationMinutes" || key === "estimatedCost" ? Math.max(0, Number(value) || 0) : value,
                      meta: key === "location" ? `${value || "Local area"} • planned stop` : item.meta,
                    }
              ),
            }
      )
    );

  const removeItem = (dayIndex: number, itemIndex: number) =>
    setItinerary((current) =>
      current.map((day, currentDayIndex) =>
        currentDayIndex !== dayIndex ? day : { ...day, items: day.items.filter((_, currentItemIndex) => currentItemIndex !== itemIndex) }
      )
    );

  const moveItem = (dayIndex: number, itemIndex: number, direction: -1 | 1) =>
    setItinerary((current) =>
      current.map((day, currentDayIndex) => {
        if (currentDayIndex !== dayIndex) return day;
        const target = itemIndex + direction;
        if (target < 0 || target >= day.items.length) return day;
        const items = [...day.items];
        [items[itemIndex], items[target]] = [items[target], items[itemIndex]];
        return { ...day, items };
      })
    );

  const addItem = (dayIndex: number) =>
    setItinerary((current) =>
      current.map((day, currentDayIndex) =>
        currentDayIndex !== dayIndex
          ? day
          : {
              ...day,
              items: [
                ...day.items,
                { id: `custom-${Date.now()}`, time: "18:30", title: "New activity", meta: "Add a location", location: "", durationMinutes: 60, estimatedCost: 0, notes: "", type: "activity" },
              ],
            }
      )
    );

  const overlaps = itinerary.flatMap((day) =>
    [...day.items]
      .sort((a, b) => a.time.localeCompare(b.time))
      .slice(1)
      .flatMap((item, index, items) => {
        const previous = items[index];
        const previousMinutes = Number(previous.time.slice(0, 2)) * 60 + Number(previous.time.slice(3));
        const currentMinutes = Number(item.time.slice(0, 2)) * 60 + Number(item.time.slice(3));
        return previous.durationMinutes && currentMinutes < previousMinutes + previous.durationMinutes
          ? [`Day ${day.day}: "${previous.title}" overlaps with "${item.title}"`]
          : [];
      })
  );

  const activityCost = itinerary.flatMap((day) => day.items).reduce((total, item) => total + (item.estimatedCost || 0), 0);

  return (
    <div className="tm-panel-body">
      <div className="tm-planner-form">
        <label>
          Destination
          <select value={planner.destination} onChange={(event) => update("destination", event.target.value)}>
            {destinations.map((item) => (
              <option key={item.id} value={item.name}>{item.name}</option>
            ))}
          </select>
        </label>
        <label>
          Starting from
          <input required value={planner.startLocation} onChange={(event) => update("startLocation", event.target.value)} placeholder="Your starting city" />
        </label>
        <div className="tm-form-two">
          <label>
            Start date
            <input required type="date" value={planner.startDate} onChange={(event) => update("startDate", event.target.value)} />
          </label>
          <label>
            End date
            <input required type="date" min={planner.startDate || undefined} value={planner.endDate} onChange={(event) => update("endDate", event.target.value)} />
          </label>
        </div>
        <div className="tm-form-two">
          <label>
            Days
            <input type="number" min="1" max="14" value={planner.days} onChange={(event) => update("days", Number(event.target.value))} />
          </label>
          <label>
            Travellers
            <input required type="number" min="1" max="20" value={planner.travellers} onChange={(event) => update("travellers", Number(event.target.value))} />
          </label>
        </div>
        <label>
          Total trip budget (₹)
          <input required type="number" min="1000" step="500" value={planner.budget} onChange={(event) => update("budget", Number(event.target.value))} />
        </label>
        <label>
          Travel style
          <div className="tm-segmented">
            {["Budget", "Standard", "Premium"].map((style) => (
              <button key={style} type="button" onClick={() => update("style", style)} className={planner.style === style ? "is-selected" : ""}>
                {style}
              </button>
            ))}
          </div>
        </label>
      </div>

      <div className="tm-plan-preview">
        <div>
          <p className="tm-eyebrow">DAY-BY-DAY ITINERARY</p>
          <h3>{planner.destination} — {planner.days} days</h3>
          <small>Estimated activity spend: ₹{activityCost.toLocaleString("en-IN")} • Trip budget: ₹{planner.budget.toLocaleString("en-IN")}</small>
        </div>
        <button type="button" className="tm-outline-button" onClick={generatePlan} style={{ marginTop: 8 }}>
          <Sparkles size={16} /> Regenerate
        </button>

        {overlaps.length > 0 && <p className="tm-itinerary-warning" role="alert">{overlaps[0]}</p>}

        {itinerary.map((day, dayIndex) => (
          <section className="tm-itinerary-editor" key={day.day}>
            <div>
              <b>Day {day.day}</b>
              <span>{day.title}</span>
            </div>
            {day.items.map((item, itemIndex) => (
              <article key={item.id || `${day.day}-${itemIndex}`}>
                <div className="tm-editor-time">
                  <label>
                    Time
                    <input type="time" value={item.time} onChange={(event) => updateItem(dayIndex, itemIndex, "time", event.target.value)} />
                  </label>
                  <label>
                    Duration (mins)
                    <input type="number" min="0" max="720" value={item.durationMinutes || 0} onChange={(event) => updateItem(dayIndex, itemIndex, "durationMinutes", event.target.value)} />
                  </label>
                </div>
                <label>
                  Activity
                  <input value={item.title} onChange={(event) => updateItem(dayIndex, itemIndex, "title", event.target.value)} />
                </label>
                <div className="tm-editor-two">
                  <label>
                    Location
                    <input value={item.location || ""} onChange={(event) => updateItem(dayIndex, itemIndex, "location", event.target.value)} />
                  </label>
                  <label>
                    Est. cost (₹)
                    <input type="number" min="0" value={item.estimatedCost || 0} onChange={(event) => updateItem(dayIndex, itemIndex, "estimatedCost", event.target.value)} />
                  </label>
                </div>
                <div className="tm-editor-controls">
                  <button type="button" disabled={itemIndex === 0} onClick={() => moveItem(dayIndex, itemIndex, -1)}>Move up</button>
                  <button type="button" disabled={itemIndex === day.items.length - 1} onClick={() => moveItem(dayIndex, itemIndex, 1)}>Move down</button>
                  <button type="button" className="is-remove" onClick={() => removeItem(dayIndex, itemIndex)}>Remove</button>
                </div>
              </article>
            ))}
            <button type="button" className="tm-add-activity" onClick={() => addItem(dayIndex)}>+ Add activity</button>
          </section>
        ))}
      </div>

      <div className="tm-panel-actions">
        <button
          type="button"
          className="tm-outline-button"
          onClick={() => {
            generatePlan();
            setEditorMessage("Itinerary refreshed.");
          }}
        >
          {editorMessage || "Refresh plan"}
        </button>
        <button type="button" className="tm-primary-button" onClick={saveTrip} disabled={overlaps.length > 0}>
          Save my trip <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function AssistantPanel({
  destination,
  message,
  setMessage,
  messages,
  busy,
  ask,
  providerConfigured,
  activeProvider,
}: {
  destination: Destination;
  message: string;
  setMessage: (value: string) => void;
  messages: ChatMessage[];
  busy: boolean;
  ask: (event: FormEvent) => Promise<void>;
  providerConfigured: boolean;
  activeProvider: string;
}) {
  const isUdaipur = destination.id === "udaipur";
  const suggestions = isUdaipur
    ? [
        "Old Udaipur Heritage & Artisan Circuit",
        "Which places have low crowds or best visit times?",
        "Where can I find traditional Mewar crafts & artisans?",
        "Tell me about City Palace history & visit tips",
        "Eco-friendly dining & sustainable stays",
        "Responsible tourism & Lake Pichola etiquette",
        `Plan a 3-day trip to ${destination.name}`,
        "Give me a ₹15,000 budget breakdown",
      ]
    : [
        `Plan a 3-day trip to ${destination.name}`,
        `Best places to visit in ${destination.name}`,
        "What local food should I try?",
        "What should I pack?",
        "Give me a ₹15,000 budget breakdown",
        "How do I see the route on the map?",
      ];

  const threadRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  return (
    <div className="tm-panel-body tm-ai-body">
      <div className="tm-ai-welcome">
        <span><Sparkles size={19} /></span>
        <div>
          <b>{isUdaipur ? "Udaipur Heritage & Sustainable Companion" : "Hello, I'm TravelMate AI"}</b>
          <p>
            {providerConfigured
              ? (isUdaipur
                  ? "Connected to Gemini AI — ask about living Mewar heritage, artisan studios, curated crowd planning estimates, walking circuits, and lake preservation."
                  : "Connected to Gemini AI — I can answer any question about places, food, budgets, and customized routes.")
              : (isUdaipur
                  ? "Ask about heritage landmarks, traditional crafts, curated crowd planning estimates, walking routes, and responsible travel."
                  : "Ask travel questions about destinations, budgets, stays, and packing.")}
          </p>
        </div>
        <span className={`tm-ai-status ${providerConfigured ? "is-connected" : ""}`}>
          {providerConfigured ? "AI Online" : "Ready"}
        </span>
      </div>

      <div className="tm-ai-thread" aria-live="polite" ref={threadRef}>
        {messages.map((chat, index) => (
          <div className={`tm-chat-bubble is-${chat.role}`} key={`${chat.role}-${index}-${chat.content.slice(0, 18)}`}>
            <span>{chat.role === "assistant" ? <Sparkles size={13} /> : <UserRound size={13} />}</span>
            <div>
              {chat.content.split("\n").map((line, lineIndex) => (
                <p key={`${line}-${lineIndex}`}>
                  {line ? (
                    line.split("**").map((part, partIndex) =>
                      partIndex % 2 ? <strong key={`${part}-${partIndex}`}>{part}</strong> : part
                    )
                  ) : (
                    <br />
                  )}
                </p>
              ))}
              {chat.role === "assistant" && chat.source && (
                <small>{chat.source === "local" ? "TravelMate Guide" : `${chat.source.toUpperCase()} AI`}</small>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="tm-chat-bubble is-assistant">
            <span><Sparkles size={13} /></span>
            <div className="tm-thinking">Preparing a tailored travel answer...</div>
          </div>
        )}
      </div>

      <div className="tm-suggestion-row">
        {suggestions.map((suggestion) => (
          <button type="button" key={suggestion} onClick={() => setMessage(suggestion)}>
            {suggestion}
          </button>
        ))}
      </div>

      <form className="tm-ai-form" onSubmit={ask}>
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={`Ask about ${destination.name}...`}
          autoComplete="off"
        />
        <button type="submit" aria-label="Send to TravelMate AI" disabled={busy || !message.trim()}>
          <Send size={18} />
        </button>
      </form>
      <p className="tm-ai-disclaimer">
        Answers use curated destination data and server-side Gemini AI. Crowd timing and relief suggestions are curated planning estimates. Always verify current timings and bookings before travel.
      </p>
    </div>
  );
}

function AuthPanel({
  mode,
  setMode,
  form,
  setForm,
  busy,
  submit,
  googleConfigured = false,
  googleClientId,
  onGoogleAuth,
}: {
  mode: "login" | "signup" | "forgot";
  setMode: (value: "login" | "signup" | "forgot") => void;
  form: { name: string; email: string; password: string };
  setForm: (value: { name: string; email: string; password: string }) => void;
  busy: boolean;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  googleConfigured?: boolean;
  googleClientId?: string;
  onGoogleAuth?: (idToken: string) => Promise<{ ok: boolean; error?: string } | void>;
}) {
  const update = (key: "name" | "email" | "password", value: string) => setForm({ ...form, [key]: value });
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);
  const [gisRendered, setGisRendered] = useState(false);
  const [authNotice, setAuthNotice] = useState<{ message: string; type: "error" | "info" } | null>(null);

  useEffect(() => {
    if (mode === "forgot") return;
    setAuthNotice(null);

    let timer: number;
    let attempts = 0;

    function renderGisButton() {
      if (!googleConfigured || !googleClientId) return;
      if (typeof window === "undefined") return;

      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: async (response: { credential?: string }) => {
              if (response.credential && onGoogleAuth) {
                setAuthNotice(null);
                const res = await onGoogleAuth(response.credential);
                if (res && !res.ok && res.error) {
                  setAuthNotice({
                    message: res.error,
                    type: "error",
                  });
                }
              } else {
                setAuthNotice({
                  message: "No credential returned from Google. Please try again.",
                  type: "error",
                });
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
            context: mode === "signup" ? "signup" : "signin",
            itp_support: true,
          });

          if (googleBtnContainerRef.current) {
            googleBtnContainerRef.current.innerHTML = "";
            window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
              type: "standard",
              theme: "outline",
              size: "large",
              text: mode === "signup" ? "signup_with" : "continue_with",
              shape: "rectangular",
              logo_alignment: "left",
              width: 300,
            });
            setGisRendered(true);
          }
        } catch {
          setGisRendered(false);
        }
      } else if (attempts < 20) {
        attempts++;
        timer = window.setTimeout(renderGisButton, 250);
      }
    }

    renderGisButton();

    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [mode, googleConfigured, googleClientId, onGoogleAuth]);

  function handleGoogleCustomClick() {
    setAuthNotice(null);
    if (!googleConfigured || !googleClientId) {
      setAuthNotice({
        message: "Google Sign-In is not configured yet. Please configure the GOOGLE_CLIENT_ID environment variable in your deployment environment.",
        type: "info",
      });
      return;
    }
    if (!window.google?.accounts?.id) {
      setAuthNotice({
        message: "Google Identity Services is currently unavailable. Please verify your internet connection or check if content/popup blockers are active.",
        type: "error",
      });
      return;
    }
    try {
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response: { credential?: string }) => {
          if (response.credential && onGoogleAuth) {
            setAuthNotice(null);
            const res = await onGoogleAuth(response.credential);
            if (res && !res.ok && res.error) {
              setAuthNotice({
                message: res.error,
                type: "error",
              });
            }
          } else {
            setAuthNotice({
              message: "No credential returned from Google. Please try again.",
              type: "error",
            });
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
        context: mode === "signup" ? "signup" : "signin",
        itp_support: true,
      });

      if (googleBtnContainerRef.current) {
        googleBtnContainerRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: mode === "signup" ? "signup_with" : "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: 300,
        });
        setGisRendered(true);
      }

      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed()) {
          const reason = notification.getNotDisplayedReason?.() || "";
          if (reason === "suppressed_by_user") {
            setAuthNotice({
              message: "Google prompt was suppressed by browser settings. Please use the Google button or email login.",
              type: "info",
            });
          }
        } else if (notification.isSkippedMoment()) {
          setAuthNotice({
            message: "Google sign-in was dismissed. You can try again or use email sign-in.",
            type: "info",
          });
        }
      });
    } catch {
      setAuthNotice({
        message: "Could not open Google Sign-In. Please check your browser popup settings and try again.",
        type: "error",
      });
    }
  }

  return (
    <div className="tm-panel-body tm-auth-body">
      <p className="tm-auth-intro">
        {mode === "signup"
          ? "Save ideas, sync your trips across devices, and keep private travel journals."
          : mode === "forgot"
          ? "Enter your email to receive password reset guidance."
          : "Your plans, saved places, and memories are waiting."}
      </p>

      {authNotice && (
        <div className={`tm-auth-notice is-${authNotice.type}`} role="alert">
          <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{authNotice.message}</span>
        </div>
      )}

      {mode !== "forgot" && (
        <div className="tm-google-auth-section">
          <div className="tm-google-btn-wrapper">
            {googleConfigured && googleClientId ? (
              <div
                ref={googleBtnContainerRef}
                className="tm-google-btn-container"
                style={{ display: gisRendered ? "flex" : "none" }}
              />
            ) : null}
            {(!googleConfigured || !gisRendered) && (
              <button
                type="button"
                className="tm-google-custom-button"
                onClick={handleGoogleCustomClick}
                disabled={busy}
              >
                <GoogleGIcon />
                <span>
                  {mode === "signup" ? "Sign up with Google" : "Continue with Google"}
                </span>
              </button>
            )}
          </div>

          <div className="tm-auth-divider">
            <span>or continue with email</span>
          </div>
        </div>
      )}

      <form className="tm-auth-form" onSubmit={(event) => void submit(event)}>
        {mode === "signup" && (
          <label>
            Full name
            <input required value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Aarav Sharma" />
          </label>
        )}
        <label>
          Email address
          <input required type="email" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="you@example.com" />
        </label>
        {mode !== "forgot" && (
          <label>
            Password
            <input required type="password" minLength={8} value={form.password} onChange={(event) => update("password", event.target.value)} placeholder="At least 8 characters" />
          </label>
        )}
        {mode === "login" && (
          <button type="button" className="tm-forgot-button" onClick={() => setMode("forgot")}>
            Forgot password?
          </button>
        )}
        <button type="submit" className="tm-primary-button tm-auth-submit" disabled={busy}>
          {busy ? "Just a moment..." : mode === "signup" ? "Create my account" : mode === "forgot" ? "Send reset guidance" : "Sign in"} <ChevronRight size={16} />
        </button>
      </form>

      <p className="tm-auth-switch">
        {mode === "signup" ? "Already have an account?" : mode === "forgot" ? "Remember your password?" : "New to TravelMate?"}{" "}
        <button type="button" onClick={() => setMode(mode === "signup" ? "login" : mode === "forgot" ? "login" : "signup")}>
          {mode === "signup" || mode === "forgot" ? "Sign in" : "Create one"}
        </button>
      </p>
    </div>
  );
}

function EmergencyPanel({ destination }: { destination: Destination }) {
  const [sosFired, setSosFired] = useState(false);

  return (
    <div className="tm-panel-body tm-emergency-body">
      <div className="tm-sos-card">
        <AlertTriangle size={26} />
        <div>
          <p>FEELING UNSAFE?</p>
          <h3>Help is only a tap away.</h3>
        </div>
        <button
          type="button"
          onClick={() => {
            setSosFired(true);
            window.location.href = "tel:112";
          }}
        >
          SOS
        </button>
      </div>
      {sosFired && (
        <p style={{ color: "#d95057", fontSize: 11, fontWeight: 700, margin: "6px 0 0" }}>
          Dialing emergency 112...
        </p>
      )}

      <p className="tm-emergency-intro">
        For immediate danger, call local emergency services. TravelMate never shares your location without permission.
      </p>

      <div className="tm-emergency-grid">
        <a href="tel:112">
          <span><ShieldAlert size={19} /></span>
          <div><b>National Emergency</b><small>Police, fire & ambulance</small></div>
          <strong>112</strong>
        </a>
        <a href="tel:100">
          <span><Flag size={19} /></span>
          <div><b>Police Control</b><small>Local police assistance</small></div>
          <strong>100</strong>
        </a>
        <a href="tel:108">
          <span><Hospital size={19} /></span>
          <div><b>Medical Ambulance</b><small>Medical emergency</small></div>
          <strong>108</strong>
        </a>
        <a href="tel:1363">
          <span><MessageCircle size={19} /></span>
          <div><b>Tourist Helpline</b><small>24/7 visitor support in India</small></div>
          <strong>1363</strong>
        </a>
      </div>

      <div className="tm-local-emergency">
        <MapPin size={20} />
        <div>
          <b>Near {destination.name}</b>
          <p>Find nearby hospitals, police stations, pharmacies, and ATMs.</p>
        </div>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`hospitals and police near ${destination.name}, India`)}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`Find emergency services near ${destination.name} in Maps`}
        >
          <Map size={17} />
        </a>
      </div>

      <p className="tm-internet-note">
        <WifiOff size={15} /> Emergency numbers remain available offline when you save a trip.
      </p>
    </div>
  );
}

function BudgetPanel({
  total,
  setTotal,
  mode,
  setMode,
}: {
  total: number;
  setTotal: (value: number) => void;
  mode: "Budget" | "Standard" | "Premium";
  setMode: (value: "Budget" | "Standard" | "Premium") => void;
}) {
  const multipliers = { Budget: 0.76, Standard: 1, Premium: 1.72 };
  const effectiveTotal = Math.round(total * multipliers[mode]);
  const categories = [
    { name: "Stay", value: 38, color: "#4f46e5" },
    { name: "Food & Drinks", value: 22, color: "#f97316" },
    { name: "Transport & Cabs", value: 17, color: "#14b8a6" },
    { name: "Activities & Entry", value: 13, color: "#eab308" },
    { name: "Buffer & Emergency", value: 10, color: "#94a3b8" },
  ];

  return (
    <div className="tm-panel-body">
      <div className="tm-budget-total">
        <p>ESTIMATED TOTAL</p>
        <h3>₹{effectiveTotal.toLocaleString("en-IN")}</h3>
        <span>₹{Math.round(effectiveTotal / 3).toLocaleString("en-IN")} / day (for 3 days)</span>
      </div>

      <label className="tm-range-label">
        Set your starting budget <b>₹{total.toLocaleString("en-IN")}</b>
        <input type="range" min="3000" max="60000" step="1000" value={total} onChange={(event) => setTotal(Number(event.target.value))} />
      </label>

      <div className="tm-segmented tm-budget-modes">
        {(["Budget", "Standard", "Premium"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setMode(item)} className={mode === item ? "is-selected" : ""}>
            {item}
          </button>
        ))}
      </div>

      <div className="tm-budget-breakdown">
        {categories.map((category) => (
          <div key={category.name}>
            <div>
              <span><i style={{ background: category.color }} /> {category.name}</span>
              <b>₹{Math.round((effectiveTotal * category.value) / 100).toLocaleString("en-IN")}</b>
            </div>
            <div className="tm-category-bar">
              <i style={{ width: `${category.value}%`, background: category.color }} />
            </div>
          </div>
        ))}
      </div>

      <div className="tm-budget-insight">
        <Sparkles size={18} />
        <p>
          Keep <b>₹{Math.round(effectiveTotal * 0.1).toLocaleString("en-IN")}</b> aside for unexpected changes. You are in a comfortable {mode.toLowerCase()} tier.
        </p>
      </div>
    </div>
  );
}

function PackingPanel({
  packing,
  setPacking,
  destination,
}: {
  packing: Record<string, boolean>;
  setPacking: (value: Record<string, boolean> | ((current: Record<string, boolean>) => Record<string, boolean>)) => void;
  destination: Destination;
}) {
  const complete = Object.values(packing).filter(Boolean).length;

  return (
    <div className="tm-panel-body">
      <div className="tm-packing-top">
        <div>
          <p>FOR {destination.name.toUpperCase()} • 3 DAYS</p>
          <h3>{complete} of {Object.keys(packing).length} packed</h3>
        </div>
        <span>{Math.round((complete / Object.keys(packing).length) * 100)}%</span>
      </div>

      <div className="tm-packing-progress">
        <i style={{ width: `${(complete / Object.keys(packing).length) * 100}%` }} />
      </div>

      <div className="tm-packing-groups">
        <div>
          <p className="tm-eyebrow">ESSENTIALS</p>
          {Object.entries(packing).slice(0, 4).map(([item, checked]) => (
            <label className="tm-pack-item" key={item}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => setPacking((current) => ({ ...current, [item]: !current[item] }))}
              />
              <span>{checked && <Check size={14} />}</span>
              {item}
            </label>
          ))}
        </div>
        <div>
          <p className="tm-eyebrow">WEATHER & COMFORT</p>
          {Object.entries(packing).slice(4).map(([item, checked]) => (
            <label className="tm-pack-item" key={item}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => setPacking((current) => ({ ...current, [item]: !current[item] }))}
              />
              <span>{checked && <Check size={14} />}</span>
              {item}
            </label>
          ))}
        </div>
      </div>

      <div className="tm-packing-tip">
        <CloudSun size={19} />
        <p>
          <b>Weather note:</b> {destination.condition} at {destination.temperature}. Carry breathable layers and keep sun protection handy.
        </p>
      </div>
    </div>
  );
}

function MapPanel({
  destination,
  currentLocation,
  onLocationChange,
  onDestinationChange,
  setToast,
  activeCircuit,
  mapMode = "travel",
  onSetMapMode,
  circuitRouteCoordinates = [],
  circuitDistanceKm,
  circuitDurationMinutes,
  circuitLoading = false,
  onOpenCircuit,
}: {
  destination: Destination;
  currentLocation: RouteLocation;
  onLocationChange: (location: RouteLocation) => void;
  onDestinationChange: (destination: Destination) => void;
  setToast: (value: string) => void;
  activeCircuit?: HeritageCircuit | null;
  mapMode?: "travel" | "circuit";
  onSetMapMode?: (mode: "travel" | "circuit") => void;
  circuitRouteCoordinates?: number[][];
  circuitDistanceKm?: number | null;
  circuitDurationMinutes?: number | null;
  circuitLoading?: boolean;
  onOpenCircuit?: (circuit: HeritageCircuit) => void;
}) {
  const isUdaipur = destination.id === "udaipur" || destination.name.toLowerCase().includes("udaipur");
  const [route, setRoute] = useState<{ distanceKm: number; durationMinutes: number; coordinates: number[][] } | null>(null);
  const [routeLoading, setRouteLoading] = useState(true);
  const [routeError, setRouteError] = useState("");
  const [locating, setLocating] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);

  const originOptions = useMemo<RouteLocation[]>(
    () => [
      ...starterLocations,
      ...destinations.map((item) => ({
        name: `${item.name}, Rajasthan`,
        latitude: item.coordinates[0],
        longitude: item.coordinates[1],
        source: "saved" as const,
      })),
    ],
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    const sameLocation =
      Math.abs(currentLocation.latitude - destination.coordinates[0]) < 0.001 &&
      Math.abs(currentLocation.longitude - destination.coordinates[1]) < 0.001;

    if (sameLocation) {
      setRoute({ distanceKm: 0, durationMinutes: 0, coordinates: [[currentLocation.latitude, currentLocation.longitude], destination.coordinates] });
      setRouteError("");
      setRouteLoading(false);
      return () => controller.abort();
    }

    setRouteLoading(true);
    setRouteError("");
    fetch(`/api/route?startLat=${currentLocation.latitude}&startLng=${currentLocation.longitude}&endLat=${destination.coordinates[0]}&endLng=${destination.coordinates[1]}`, { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as { distanceKm?: number; durationMinutes?: number; coordinates?: number[][]; error?: string };
        if (!response.ok || !data.coordinates || data.distanceKm === undefined || data.durationMinutes === undefined) {
          throw new Error(data.error || "Unable to calculate this route.");
        }
        if (!controller.signal.aborted) {
          setRoute({ distanceKm: data.distanceKm, durationMinutes: data.durationMinutes, coordinates: data.coordinates });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setRoute(null);
          setRouteError(error instanceof Error ? error.message : "Unable to calculate this route.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setRouteLoading(false);
      });

    return () => controller.abort();
  }, [currentLocation, destination]);

  function useDeviceLocation() {
    setLocationNotice(null);
    if (typeof window !== "undefined" && !window.isSecureContext) {
      const msg = "Location access requires an HTTPS secure connection. Please select a starting city below.";
      setLocationNotice(msg);
      setToast(msg);
      return;
    }
    if (!navigator.geolocation) {
      const msg = "Your browser does not support automatic location detection. Choose a city below.";
      setLocationNotice(msg);
      setToast(msg);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationNotice(null);
        onLocationChange({
          name: "My current location",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          source: "device",
        });
        setLocating(false);
        setToast("Current location detected. Calculating driving route...");
      },
      (error) => {
        setLocating(false);
        let msg = "Could not access location. Please allow permission or pick a city below.";
        if (error.code === error.PERMISSION_DENIED) {
          msg = "Location permission was denied. You can allow location access in your browser settings or select a starting city below.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = "Location could not be determined. Please try again or select a city below.";
        } else if (error.code === error.TIMEOUT) {
          msg = "Location request timed out. Please try again or select a city below.";
        }
        setLocationNotice(msg);
        setToast(msg);
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 120_000 }
    );
  }

  const duration = route
    ? route.durationMinutes >= 60
      ? `${Math.floor(route.durationMinutes / 60)}h ${route.durationMinutes % 60}m`
      : `${route.durationMinutes} min`
    : "";

  const externalDirections = `https://www.google.com/maps/dir/?api=1&origin=${currentLocation.latitude},${currentLocation.longitude}&destination=${destination.coordinates[0]},${destination.coordinates[1]}&travelmode=driving`;
  const selectedOrigin = currentLocation.source === "device" ? "__device__" : currentLocation.name;

  return (
    <div className="tm-panel-body tm-map-body">
      {isUdaipur && (
        <div className="tm-map-mode-tabs" role="tablist" aria-label="Map route mode">
          <button
            type="button"
            role="tab"
            aria-selected={mapMode === "circuit"}
            className={`tm-map-mode-tab ${mapMode === "circuit" ? "is-active" : ""}`}
            onClick={() => {
              onSetMapMode?.("circuit");
              if (!circuitRouteCoordinates.length) {
                void onOpenCircuit?.(udaipurHeritageCircuit);
              }
            }}
          >
            🚶 Heritage Walking Circuit (5 Stops)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mapMode === "travel"}
            className={`tm-map-mode-tab ${mapMode === "travel" ? "is-active" : ""}`}
            onClick={() => onSetMapMode?.("travel")}
          >
            🚗 Regional Road Route ({currentLocation.name} → {destination.name})
          </button>
        </div>
      )}

      {mapMode === "circuit" && isUdaipur ? (
        <>
          <div className="tm-route-summary">
            <Route size={19} />
            <div>
              <b>Old Udaipur Heritage & Artisan Circuit</b>
              <span>
                {circuitLoading
                  ? "Calculating walking route..."
                  : `5 Curated Stops • ${circuitDistanceKm ? `${circuitDistanceKm} km` : "~1.8 km"} • ${
                      circuitDurationMinutes ? `~${circuitDurationMinutes} min walking` : "pedestrian circuit"
                    }`}
              </span>
            </div>
          </div>

          <TravelRouteMap
            origin={currentLocation}
            destination={destination}
            routeCoordinates={
              circuitRouteCoordinates.length > 0
                ? circuitRouteCoordinates
                : udaipurHeritageCircuit.stops.map((s) => s.coordinates)
            }
            circuitStops={udaipurHeritageCircuit.stops}
            circuitTitle={udaipurHeritageCircuit.title}
            isWalkingCircuit={true}
            distanceKm={circuitDistanceKm}
            durationMinutes={circuitDurationMinutes}
          />

          <div className="tm-circuit-stops-list-mini" style={{ marginTop: 12 }}>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", margin: "0 0 8px" }}>
              CIRCUIT STOPS IN WALKING SEQUENCE:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {udaipurHeritageCircuit.stops.map((stop) => (
                <div
                  key={stop.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "7px 10px",
                    borderRadius: 8,
                    background: "var(--canvas)",
                    border: "1px solid var(--line)",
                    fontSize: "11px",
                  }}
                >
                  <div>
                    <strong style={{ color: "var(--ink)", marginRight: 6 }}>
                      Stop #{stop.stepNumber}: {stop.name}
                    </strong>
                    <span style={{ fontSize: "10px", color: "var(--muted)" }}>
                      ({stop.category}{stop.craftCategory ? ` • ${stop.craftCategory}` : ""})
                    </span>
                  </div>
                  <span
                    className={`tm-badge-crowd is-${stop.crowdLevel || "low"}`}
                    style={{ fontSize: "9.5px", padding: "2px 6px" }}
                  >
                    {stop.crowdLevel === "low"
                      ? "🟢 Low"
                      : stop.crowdLevel === "moderate"
                      ? "🟡 Moderate"
                      : "🔴 Peak"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          {locationNotice && (
            <div
              style={{
                background: "rgba(207, 60, 68, 0.08)",
                border: "1px solid rgba(207, 60, 68, 0.25)",
                borderRadius: 8,
                padding: "8px 12px",
                marginBottom: 10,
                fontSize: 12,
                color: "var(--ink)",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
              role="alert"
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <ShieldAlert size={16} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 2 }} />
                <span>{locationNotice}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>Quick select origin:</span>
                {starterLocations.map((loc) => (
                  <button
                    key={loc.name}
                    type="button"
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 4,
                      border: "1px solid var(--line)",
                      background: "var(--surface)",
                      color: "var(--ink)",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      onLocationChange(loc);
                      setLocationNotice(null);
                    }}
                  >
                    {loc.name.split(",")[0]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="tm-route-controls">
            <div className="tm-route-origin">
              <label>
                Starting from
                <select
                  value={selectedOrigin}
                  onChange={(event) => {
                    const next = originOptions.find((loc) => loc.name === event.target.value);
                    if (next) {
                      onLocationChange(next);
                      setLocationNotice(null);
                    }
                  }}
                >
                  <option value="__device__" disabled={currentLocation.source !== "device"}>
                    {currentLocation.source === "device" ? "My current location" : "Choose a starting city"}
                  </option>
                  {originOptions.map((loc) => (
                    <option key={loc.name} value={loc.name}>{loc.name}</option>
                  ))}
                </select>
              </label>
              <button type="button" className="tm-geolocate-button" onClick={useDeviceLocation} disabled={locating}>
                <Navigation size={15} fill="currentColor" /> {locating ? "Locating..." : "Use my location"}
              </button>
            </div>
            <label>
              Traveling to
              <select
                value={destination.id}
                onChange={(event) => {
                  const next = destinations.find((item) => item.id === event.target.value);
                  if (next) onDestinationChange(next);
                }}
              >
                {destinations.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}, {item.region}</option>
                ))}
              </select>
            </label>
          </div>

          {routeLoading ? (
            <div className="tm-route-summary">
              <Route size={19} />
              <div>
                <b>Finding your driving route...</b>
                <span>Checking distance and expected road time.</span>
              </div>
            </div>
          ) : route ? (
            <div className="tm-route-summary">
              <Route size={19} />
              <div>
                <b>{currentLocation.name} → {destination.name}</b>
                <span>{route.distanceKm.toLocaleString("en-IN")} km • about {duration} by road</span>
              </div>
              <a href={externalDirections} target="_blank" rel="noreferrer" aria-label="Open external directions in Google Maps">
                <ArrowUpRight size={18} />
              </a>
            </div>
          ) : (
            <div className="tm-route-error">{routeError}</div>
          )}

          <TravelRouteMap origin={currentLocation} destination={destination} routeCoordinates={route?.coordinates || []} />

          <div className="tm-route-map-actions">
            <a href={externalDirections} target="_blank" rel="noreferrer">
              <Navigation size={16} /> Open turn-by-turn maps
            </a>
            <button type="button" onClick={() => setToast("Route saved to your trip workspace.")}>
              <Bookmark size={16} /> Save route to trip
            </button>
          </div>
          <p className="tm-route-helper">
            Your location is used solely in this browser to compute your route and nearby recommendations.
          </p>
        </>
      )}
    </div>
  );
}

function NotificationsPanel({ setToast }: { setToast: (value: string) => void }) {
  return (
    <div className="tm-panel-body">
      <div className="tm-notification-item">
        <span className="tm-notification-icon"><CloudSun size={18} /></span>
        <div>
          <b>Clear skies over Udaipur</b>
          <p>Ideal conditions for an evening boat ride on Lake Pichola.</p>
          <small>Just now</small>
        </div>
      </div>
      <div className="tm-notification-item">
        <span className="tm-notification-icon"><CalendarDays size={18} /></span>
        <div>
          <b>Your trip is taking shape</b>
          <p>Add travel dates to get tailored packing and itinerary guidance.</p>
          <small>Today</small>
        </div>
      </div>
      <div className="tm-notification-item">
        <span className="tm-notification-icon"><ShieldAlert size={18} /></span>
        <div>
          <b>Emergency & safety contacts ready</b>
          <p>Keep key emergency numbers and offline cards handy.</p>
          <small>Yesterday</small>
        </div>
      </div>
      <button
        type="button"
        className="tm-full-outline"
        onClick={() => setToast("Notification preferences are ready to customize.")}
      >
        Manage notification preferences
      </button>
    </div>
  );
}
