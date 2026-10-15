import dotenv from "dotenv";
dotenv.config();

import express, { type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import { OAuth2Client } from "google-auth-library";
import { destinations, findDestination, createItinerary, udaipurHeritageCircuit } from "./src/lib/travel-data.ts";
import { buildLocalTravelAnswer, sanitizeHistory, type AssistantInput } from "./src/lib/travel-assistant.ts";
import {
  distanceMeters,
  isValidCoordinate,
  createInviteCode,
  safeRangeMeters,
  cleanGroupText,
  LOCATION_STALE_AFTER_MS,
} from "./src/lib/group-safety.ts";
import { validateTripInput, estimatedItineraryCost } from "./src/lib/trip-utils.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", 1);
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

// --- In-Memory & Local Storage Mock Database ---
type User = {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  avatarUrl: string | null;
  travelPreferences: string[];
  preferredBudget: string | null;
  preferredTripType: string | null;
  isAdmin: boolean;
  createdAt: string;
  googleSub?: string | null;
};

type Session = {
  id: string;
  userId: number;
  tokenHash: string;
  expiresAt: number;
};

type Trip = {
  id: number;
  userId: number;
  title: string;
  destination: string;
  startLocation: string | null;
  startDate: string;
  endDate: string;
  travellers: number;
  budget: number;
  style: string;
  status: string;
  itinerary: unknown[];
  createdAt: string;
};

type SavedPlace = {
  id: number;
  userId: number;
  placeId: string;
  placeType: string;
  title: string;
  imageUrl: string | null;
  collection: string;
  createdAt: string;
};

type Group = {
  id: number;
  ownerUserId: number;
  name: string;
  destination: string;
  inviteCode: string;
  rangeMeters: number;
  isActive: boolean;
  createdAt: string;
};

type GroupMember = {
  id: number;
  groupId: number;
  userId: number;
  sharingEnabled: boolean;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  locationUpdatedAt: string | null;
  isOutOfRange: boolean;
  lastBreachAt: string | null;
  joinedAt: string;
};

type SafetyEvent = {
  id: number;
  groupId: number;
  memberId: number | null;
  kind: string;
  message: string;
  metadata: Record<string, unknown>;
  acknowledged: boolean;
  createdAt: string;
};

const dbStore = {
  users: [] as User[],
  sessions: [] as Session[],
  trips: [] as Trip[],
  savedPlaces: [] as SavedPlace[],
  groups: [] as Group[],
  groupMembers: [] as GroupMember[],
  safetyEvents: [] as SafetyEvent[],
  nextId: { user: 1, trip: 1, saved: 1, group: 1, member: 1, event: 1 },
};

// Seed a default demo user so guest/demo testing is immediate
const demoUser: User = {
  id: dbStore.nextId.user++,
  name: "Aarav Sharma",
  email: "aarav@travelmate.app",
  passwordHash: "salt:hash",
  avatarUrl: null,
  travelPreferences: ["Heritage", "Photography", "Food"],
  preferredBudget: "Standard",
  preferredTripType: "Culture",
  isAdmin: true,
  createdAt: new Date().toISOString(),
};
dbStore.users.push(demoUser);

// Seed a demo trip
dbStore.trips.push({
  id: dbStore.nextId.trip++,
  userId: demoUser.id,
  title: "Udaipur Royal Lakes & Palaces",
  destination: "Udaipur",
  startLocation: "Delhi",
  startDate: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
  endDate: new Date(Date.now() + 86400000 * 6).toISOString().slice(0, 10),
  travellers: 2,
  budget: 25000,
  style: "Standard",
  status: "planned",
  itinerary: createItinerary("Udaipur", 3, "Standard"),
  createdAt: new Date().toISOString(),
});

// Seed a demo group
const demoGroup: Group = {
  id: dbStore.nextId.group++,
  ownerUserId: demoUser.id,
  name: "Rajasthan Trail Squad",
  destination: "Udaipur",
  inviteCode: "TRAIL9",
  rangeMeters: 500,
  isActive: true,
  createdAt: new Date().toISOString(),
};
dbStore.groups.push(demoGroup);
dbStore.groupMembers.push({
  id: dbStore.nextId.member++,
  groupId: demoGroup.id,
  userId: demoUser.id,
  sharingEnabled: false,
  latitude: 24.5854,
  longitude: 73.7125,
  accuracyMeters: 10,
  locationUpdatedAt: null,
  isOutOfRange: false,
  lastBreachAt: null,
  joinedAt: new Date().toISOString(),
});

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getSessionUser(req: Request): User | null {
  const token = req.cookies.travelmate_session;
  if (!token) return null;
  const tokenHash = hashToken(token);
  const session = dbStore.sessions.find((s) => s.tokenHash === tokenHash && s.expiresAt > Date.now());
  if (!session) return null;
  return dbStore.users.find((u) => u.id === session.userId) ?? null;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: "Please sign in." });
  }
  (req as unknown as { user: User }).user = user;
  next();
}

// --- API ROUTES ---

function createSessionAndSetCookie(res: Response, req: Request, userId: number): string {
  const rawToken = crypto.randomBytes(32).toString("hex");
  dbStore.sessions.push({
    id: crypto.randomUUID(),
    userId,
    tokenHash: hashToken(rawToken),
    expiresAt: Date.now() + 14 * 86400000,
  });

  const isSecure = Boolean(
    process.env.NODE_ENV === "production" ||
    process.env.APP_URL?.startsWith("https://") ||
    req.secure ||
    req.headers["x-forwarded-proto"] === "https"
  );

  res.cookie("travelmate_session", rawToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: 14 * 86400000,
    path: "/",
  });

  return rawToken;
}

// --- API ROUTES ---

// Config
app.get("/api/config", (_req: Request, res: Response) => {
  const geminiAvailable = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  const rawClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "";
  const googleClientId = rawClientId.trim().replace(/^["']|["']$/g, "");
  const googleConfigured = Boolean(googleClientId);

  res.json({
    auth: {
      googleConfigured,
      googleClientId: googleConfigured ? googleClientId : undefined,
      sessionsConfigured: true,
    },
    ai: {
      providerConfigured: geminiAvailable,
      activeProvider: geminiAvailable ? "gemini" : "local",
      availableProviders: geminiAvailable ? ["gemini"] : ["local"],
    },
    push: { configured: true, publicKey: "BCw8h-demo-public-key" },
  });
});

// Auth
app.get("/api/auth", (req: Request, res: Response) => {
  const user = getSessionUser(req);
  if (!user) return res.json({ user: null });
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      isAdmin: user.isAdmin,
    },
  });
});

app.post("/api/auth", async (req: Request, res: Response) => {
  const { action, email, password, name, idToken } = req.body || {};
  const cleanEmail = String(email || "").trim().toLowerCase();

  if (action === "logout") {
    const token = req.cookies.travelmate_session;
    if (token) {
      const hash = hashToken(token);
      dbStore.sessions = dbStore.sessions.filter((s) => s.tokenHash !== hash);
    }
    const isSecure = Boolean(
      process.env.NODE_ENV === "production" ||
      process.env.APP_URL?.startsWith("https://") ||
      req.secure ||
      req.headers["x-forwarded-proto"] === "https"
    );
    res.clearCookie("travelmate_session", {
      path: "/",
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
    });
    return res.json({ ok: true });
  }

  if (action === "forgot") {
    return res.json({ message: "Password reset instructions sent if an account exists." });
  }

  if (action === "google") {
    const rawIdToken = String(idToken || "").trim();
    if (!rawIdToken) {
      return res.status(400).json({ error: "Missing Google ID token." });
    }

    const rawClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "";
    const googleClientId = rawClientId.trim().replace(/^["']|["']$/g, "");
    if (!googleClientId) {
      return res.status(503).json({
        error: "Google authentication is not configured on this server (GOOGLE_CLIENT_ID is not set).",
      });
    }

    let payload;
    try {
      const authClient = new OAuth2Client(googleClientId);
      const ticket = await authClient.verifyIdToken({
        idToken: rawIdToken,
        audience: googleClientId,
      });
      payload = ticket.getPayload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Token verification failed";
      return res.status(401).json({ error: `Google verification failed: ${msg}` });
    }

    if (!payload || !payload.sub) {
      return res.status(401).json({ error: "Invalid Google token payload." });
    }

    if (!payload.email || !payload.email_verified) {
      return res.status(400).json({ error: "Google account email is not verified." });
    }

    const verifiedSub = payload.sub;
    const verifiedEmail = payload.email.toLowerCase().trim();
    const verifiedName = payload.name?.trim() || verifiedEmail.split("@")[0];
    const verifiedAvatar = payload.picture || null;

    // 1. Locate account by permanent Google subject identifier
    let user = dbStore.users.find((u) => u.googleSub === verifiedSub);

    // 2. If not matched by sub, check if an account exists for this verified email
    if (!user) {
      const userByEmail = dbStore.users.find((u) => u.email === verifiedEmail);
      if (userByEmail) {
        // Prevent linking if already tied to a distinct Google sub
        if (userByEmail.googleSub && userByEmail.googleSub !== verifiedSub) {
          return res.status(409).json({ error: "This email is already associated with another Google account." });
        }
        // Safely link Google sub to existing account
        userByEmail.googleSub = verifiedSub;
        if (!userByEmail.avatarUrl && verifiedAvatar) {
          userByEmail.avatarUrl = verifiedAvatar;
        }
        if ((!userByEmail.name || userByEmail.name === verifiedEmail.split("@")[0]) && verifiedName) {
          userByEmail.name = verifiedName;
        }
        user = userByEmail;
      }
    }

    // 3. If neither found, create a new verified user account
    if (!user) {
      user = {
        id: dbStore.nextId.user++,
        name: verifiedName,
        email: verifiedEmail,
        passwordHash: `google:${crypto.randomBytes(16).toString("hex")}`,
        avatarUrl: verifiedAvatar,
        travelPreferences: ["Heritage", "Culture", "Food"],
        preferredBudget: "Standard",
        preferredTripType: "Culture",
        isAdmin: dbStore.users.length === 0,
        createdAt: new Date().toISOString(),
        googleSub: verifiedSub,
      };
      dbStore.users.push(user);
    } else {
      if (verifiedAvatar && !user.avatarUrl) {
        user.avatarUrl = verifiedAvatar;
      }
    }

    createSessionAndSetCookie(res, req, user.id);

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        isAdmin: user.isAdmin,
      },
    });
  }

  if (action === "signup") {
    if (!cleanEmail || !password || password.length < 6) {
      return res.status(400).json({ error: "Provide a valid email and password (min 6 characters)." });
    }
    const existing = dbStore.users.find((u) => u.email === cleanEmail);
    if (existing) {
      return res.status(409).json({ error: "An account already exists for this email." });
    }

    const newUser: User = {
      id: dbStore.nextId.user++,
      name: String(name || cleanEmail.split("@")[0]).trim().slice(0, 120),
      email: cleanEmail,
      passwordHash: password, // In memory
      avatarUrl: null,
      travelPreferences: ["Culture", "Nature", "Food"],
      preferredBudget: "Standard",
      preferredTripType: "Mixed",
      isAdmin: dbStore.users.length === 0,
      createdAt: new Date().toISOString(),
      googleSub: null,
    };
    dbStore.users.push(newUser);

    createSessionAndSetCookie(res, req, newUser.id);

    return res.json({
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        avatarUrl: newUser.avatarUrl,
        isAdmin: newUser.isAdmin,
      },
    });
  }

  if (action === "login") {
    const user = dbStore.users.find((u) => u.email === cleanEmail);
    if (!user) {
      // Auto-create for friendly demo experience
      const createdUser: User = {
        id: dbStore.nextId.user++,
        name: cleanEmail.split("@")[0].charAt(0).toUpperCase() + cleanEmail.split("@")[0].slice(1),
        email: cleanEmail,
        passwordHash: password || "demo",
        avatarUrl: null,
        travelPreferences: ["Culture", "Nature"],
        preferredBudget: "Standard",
        preferredTripType: "Mixed",
        isAdmin: false,
        createdAt: new Date().toISOString(),
        googleSub: null,
      };
      dbStore.users.push(createdUser);

      createSessionAndSetCookie(res, req, createdUser.id);

      return res.json({
        user: {
          id: createdUser.id,
          name: createdUser.name,
          email: createdUser.email,
          avatarUrl: createdUser.avatarUrl,
          isAdmin: createdUser.isAdmin,
        },
      });
    }

    createSessionAndSetCookie(res, req, user.id);

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        isAdmin: user.isAdmin,
      },
    });
  }

  return res.status(400).json({ error: "Invalid action" });
});

// Profile
app.get("/api/profile", requireAuth, (req: Request, res: Response) => {
  const user = (req as unknown as { user: User }).user;
  res.json({
    profile: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      travelPreferences: user.travelPreferences,
      preferredBudget: user.preferredBudget,
      preferredTripType: user.preferredTripType,
    },
  });
});

app.patch("/api/profile", requireAuth, (req: Request, res: Response) => {
  const user = (req as unknown as { user: User }).user;
  const { name, avatarUrl, preferredBudget, preferredTripType, travelPreferences } = req.body || {};
  if (typeof name === "string" && name.trim().length >= 2) {
    user.name = name.trim().slice(0, 120);
  }
  if (typeof avatarUrl === "string") {
    user.avatarUrl = avatarUrl.trim() || null;
  }
  if (typeof preferredBudget === "string") {
    user.preferredBudget = preferredBudget;
  }
  if (typeof preferredTripType === "string") {
    user.preferredTripType = preferredTripType;
  }
  if (Array.isArray(travelPreferences)) {
    user.travelPreferences = travelPreferences.filter((x): x is string => typeof x === "string");
  }
  res.json({ profile: user });
});

// Trips
app.get("/api/trips", requireAuth, (req: Request, res: Response) => {
  const user = (req as unknown as { user: User }).user;
  const userTrips = dbStore.trips.filter((t) => t.userId === user.id);
  res.json({ trips: userTrips });
});

app.post("/api/trips", requireAuth, (req: Request, res: Response) => {
  const user = (req as unknown as { user: User }).user;
  try {
    const input = validateTripInput(req.body);
    const newTrip: Trip = {
      id: dbStore.nextId.trip++,
      userId: user.id,
      title: input.title,
      destination: input.destination,
      startLocation: input.startLocation,
      startDate: input.startDate,
      endDate: input.endDate,
      travellers: input.travellers,
      budget: input.budget,
      style: input.style,
      status: "planned",
      itinerary: input.itinerary,
      createdAt: new Date().toISOString(),
    };
    dbStore.trips.unshift(newTrip);
    res.status(201).json({ trip: newTrip, estimatedActivityCost: estimatedItineraryCost(input.itinerary) });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to save trip." });
  }
});

app.delete("/api/trips/:tripId", requireAuth, (req: Request, res: Response) => {
  const user = (req as unknown as { user: User }).user;
  const tripId = Number(req.params.tripId);
  dbStore.trips = dbStore.trips.filter((t) => !(t.id === tripId && t.userId === user.id));
  res.json({ ok: true });
});

// Saved places
app.get("/api/saved", requireAuth, (req: Request, res: Response) => {
  const user = (req as unknown as { user: User }).user;
  const places = dbStore.savedPlaces.filter((p) => p.userId === user.id);
  res.json({ places });
});

app.post("/api/saved", requireAuth, (req: Request, res: Response) => {
  const user = (req as unknown as { user: User }).user;
  const { placeId, placeType, title, imageUrl, collection } = req.body || {};
  if (!placeId || !title) return res.status(400).json({ error: "Missing place information." });

  const existing = dbStore.savedPlaces.find((p) => p.userId === user.id && p.placeId === placeId);
  if (existing) return res.json({ place: existing, saved: true });

  const newPlace: SavedPlace = {
    id: dbStore.nextId.saved++,
    userId: user.id,
    placeId: String(placeId),
    placeType: String(placeType || "attraction"),
    title: String(title),
    imageUrl: imageUrl ? String(imageUrl) : null,
    collection: collection ? String(collection) : "My saved places",
    createdAt: new Date().toISOString(),
  };
  dbStore.savedPlaces.unshift(newPlace);
  res.status(201).json({ place: newPlace, saved: true });
});

app.delete("/api/saved", requireAuth, (req: Request, res: Response) => {
  const user = (req as unknown as { user: User }).user;
  const placeId = req.query.placeId as string;
  if (!placeId) return res.status(400).json({ error: "Place ID required" });
  dbStore.savedPlaces = dbStore.savedPlaces.filter((p) => !(p.userId === user.id && p.placeId === placeId));
  res.json({ ok: true });
});

// Search
app.get("/api/search", (req: Request, res: Response) => {
  const rawQuery = String(req.query.q || "").toLowerCase().trim();
  const type = String(req.query.type || "all");
  const sort = String(req.query.sort || "recommended");

  const allItems = destinations.flatMap((d) => [
    {
      id: d.id,
      type: "destination",
      title: d.name,
      subtitle: `${d.region}, ${d.country}`,
      image: d.image,
      rating: d.rating,
      price: d.budget,
      tags: d.tags,
      description: d.description,
    },
    ...d.places.map((p) => ({
      id: p.id,
      type: p.kind,
      title: p.name,
      subtitle: `${p.location} • ${d.name}`,
      image: p.image,
      rating: p.rating,
      price: p.price,
      tags: p.tags,
      description: p.description,
    })),
  ]);

  let filtered = allItems;
  if (type !== "all") {
    filtered = filtered.filter((item) => item.type === type);
  }
  if (rawQuery) {
    filtered = filtered.filter((item) =>
      `${item.title} ${item.subtitle} ${item.description} ${item.tags.join(" ")}`.toLowerCase().includes(rawQuery)
    );
  }

  if (sort === "rating") {
    filtered.sort((a, b) => b.rating - a.rating);
  }

  res.json({ results: filtered.slice(0, 60), count: filtered.length });
});

// Weather proxy with fallback
app.get("/api/weather", async (req: Request, res: Response) => {
  const destName = String(req.query.destination || "udaipur").toLowerCase();
  const dest = destinations.find((d) => d.id === destName || d.name.toLowerCase() === destName) || destinations[0];

  try {
    const lat = dest.coordinates[0];
    const lng = dest.coordinates[1];
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (resp.ok) {
      const data = (await resp.json()) as { current: unknown; daily: unknown };
      return res.json({ current: data.current, forecast: data.daily, updatedAt: new Date().toISOString() });
    }
  } catch {
    // fallback
  }

  const numTemp = parseInt(dest.temperature, 10) || 24;
  res.json({
    current: {
      temperature_2m: numTemp,
      relative_humidity_2m: parseInt(dest.humidity, 10) || 45,
      apparent_temperature: numTemp + 1,
      wind_speed_10m: parseInt(dest.wind, 10) || 12,
    },
    updatedAt: new Date().toISOString(),
  });
});

// Route OSRM Proxy with walking & driving support and geodesic fallback
app.get("/api/route", async (req: Request, res: Response) => {
  const profileParam = String(req.query.profile || "driving").toLowerCase();
  const isWalking = profileParam === "walking" || profileParam === "foot";
  const osrmProfile = isWalking ? "foot" : "driving";

  // Check if multiple waypoints were supplied: e.g. points=lat,lng;lat,lng;...
  const pointsQuery = req.query.points ? String(req.query.points) : "";
  let routePoints: Array<[number, number]> = [];

  if (pointsQuery) {
    const rawPairs = pointsQuery.split(";").map((p) => p.trim());
    for (const pair of rawPairs) {
      const parts = pair.split(",").map(Number);
      if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
        routePoints.push([parts[0], parts[1]]);
      }
    }
  }

  // Otherwise check start/end query parameters
  if (routePoints.length < 2) {
    const startLat = Number(req.query.startLat);
    const startLng = Number(req.query.startLng);
    const endLat = Number(req.query.endLat);
    const endLng = Number(req.query.endLng);

    if (Number.isFinite(startLat) && Number.isFinite(startLng) && Number.isFinite(endLat) && Number.isFinite(endLng)) {
      routePoints = [
        [startLat, startLng],
        [endLat, endLng],
      ];
    }
  }

  if (routePoints.length < 2) {
    return res.status(400).json({ error: "At least two valid waypoint coordinates required." });
  }

  try {
    // OSRM coordinates format: lng1,lat1;lng2,lat2;...
    const coordString = routePoints.map(([lat, lng]) => `${lng},${lat}`).join(";");
    const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${coordString}?overview=full&geometries=geojson&steps=false`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (resp.ok) {
      const data = (await resp.json()) as { routes?: Array<{ distance?: number; duration?: number; geometry?: { coordinates?: number[][] } }> };
      const route = data.routes?.[0];
      if (route && typeof route.distance === "number" && typeof route.duration === "number" && route.geometry?.coordinates) {
        return res.json({
          distanceKm: Number((route.distance / 1000).toFixed(2)),
          durationMinutes: Math.max(1, Math.round(route.duration / 60)),
          coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
          profile: isWalking ? "walking" : "driving",
        });
      }
    }
  } catch {
    // calculate geodesic fallback
  }

  // Geodesic fallback calculation across all waypoints
  let totalMeters = 0;
  for (let i = 0; i < routePoints.length - 1; i++) {
    const p1 = { latitude: routePoints[i][0], longitude: routePoints[i][1] };
    const p2 = { latitude: routePoints[i + 1][0], longitude: routePoints[i + 1][1] };
    totalMeters += distanceMeters(p1, p2);
  }

  const distanceKm = Number((totalMeters / 1000).toFixed(2));
  const avgSpeedKmh = isWalking ? 4.5 : 55;
  const durationMinutes = Math.max(1, Math.round((distanceKm / avgSpeedKmh) * 60));
  res.json({
    distanceKm,
    durationMinutes,
    coordinates: routePoints,
    profile: isWalking ? "walking" : "driving",
    isFallback: true,
  });
});

// Groups (Group Safety)
app.get("/api/groups", requireAuth, (req: Request, res: Response) => {
  const user = (req as unknown as { user: User }).user;
  const userMemberships = dbStore.groupMembers.filter((m) => m.userId === user.id);
  const groups = userMemberships
    .map((m) => {
      const g = dbStore.groups.find((group) => group.id === m.groupId);
      if (!g) return null;
      return {
        ...g,
        sharingEnabled: m.sharingEnabled,
        inviteCode: g.ownerUserId === user.id ? g.inviteCode : null,
      };
    })
    .filter((g): g is NonNullable<typeof g> => g !== null);
  res.json({ groups });
});

app.post("/api/groups", requireAuth, (req: Request, res: Response) => {
  const user = (req as unknown as { user: User }).user;
  const { name, destination, rangeMeters } = req.body || {};
  const cleanName = cleanGroupText(name, 120);
  const cleanDest = cleanGroupText(destination, 120);
  if (!cleanName || !cleanDest) {
    return res.status(400).json({ error: "Group name and destination are required." });
  }

  const newGroup: Group = {
    id: dbStore.nextId.group++,
    ownerUserId: user.id,
    name: cleanName,
    destination: cleanDest,
    inviteCode: createInviteCode(),
    rangeMeters: safeRangeMeters(rangeMeters),
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  dbStore.groups.unshift(newGroup);

  const newMember: GroupMember = {
    id: dbStore.nextId.member++,
    groupId: newGroup.id,
    userId: user.id,
    sharingEnabled: false,
    latitude: null,
    longitude: null,
    accuracyMeters: null,
    locationUpdatedAt: null,
    isOutOfRange: false,
    lastBreachAt: null,
    joinedAt: new Date().toISOString(),
  };
  dbStore.groupMembers.push(newMember);

  res.status(201).json({ group: { ...newGroup, sharingEnabled: false } });
});

app.patch("/api/groups", requireAuth, (req: Request, res: Response) => {
  const user = (req as unknown as { user: User }).user;
  const { groupId, rangeMeters, isActive } = req.body || {};
  const group = dbStore.groups.find((g) => g.id === Number(groupId) && g.ownerUserId === user.id);
  if (!group) return res.status(403).json({ error: "Only the group organiser can update settings." });

  if (rangeMeters !== undefined) group.rangeMeters = safeRangeMeters(rangeMeters);
  if (isActive !== undefined) group.isActive = Boolean(isActive);

  res.json({ group });
});

app.post("/api/groups/join", requireAuth, (req: Request, res: Response) => {
  const user = (req as unknown as { user: User }).user;
  const inviteCode = String(req.body.inviteCode || "").trim().toUpperCase();
  const group = dbStore.groups.find((g) => g.inviteCode === inviteCode && g.isActive);
  if (!group) return res.status(404).json({ error: "Invalid invite code or group inactive." });

  const existing = dbStore.groupMembers.find((m) => m.groupId === group.id && m.userId === user.id);
  if (existing) {
    return res.json({ group: { ...group, inviteCode: null, sharingEnabled: existing.sharingEnabled }, joined: false, message: "You are already a member." });
  }

  const newMember: GroupMember = {
    id: dbStore.nextId.member++,
    groupId: group.id,
    userId: user.id,
    sharingEnabled: false,
    latitude: null,
    longitude: null,
    accuracyMeters: null,
    locationUpdatedAt: null,
    isOutOfRange: false,
    lastBreachAt: null,
    joinedAt: new Date().toISOString(),
  };
  dbStore.groupMembers.push(newMember);

  res.status(201).json({ group: { ...group, inviteCode: null, sharingEnabled: false }, joined: true });
});

app.get("/api/groups/:groupId/status", requireAuth, (req: Request, res: Response) => {
  const user = (req as unknown as { user: User }).user;
  const groupId = Number(req.params.groupId);
  const group = dbStore.groups.find((g) => g.id === groupId);
  if (!group) return res.status(404).json({ error: "Group not found." });

  const membership = dbStore.groupMembers.find((m) => m.groupId === groupId && m.userId === user.id);
  if (!membership) return res.status(403).json({ error: "Access denied." });

  const cutoff = Date.now() - LOCATION_STALE_AFTER_MS;
  const members = dbStore.groupMembers
    .filter((m) => m.groupId === groupId)
    .map((m) => {
      const u = dbStore.users.find((userItem) => userItem.id === m.userId);
      const isFresh = m.locationUpdatedAt && new Date(m.locationUpdatedAt).getTime() >= cutoff;
      const locationVisible = Boolean(m.sharingEnabled && m.latitude !== null && m.longitude !== null && isFresh);

      return {
        id: m.id,
        userId: m.userId,
        name: u?.name || "Traveler",
        avatarUrl: u?.avatarUrl || null,
        isSelf: m.userId === user.id,
        sharingEnabled: m.sharingEnabled,
        locationVisible,
        latitude: locationVisible ? m.latitude : null,
        longitude: locationVisible ? m.longitude : null,
        accuracyMeters: locationVisible ? m.accuracyMeters : null,
        locationUpdatedAt: locationVisible ? m.locationUpdatedAt : null,
        isOutOfRange: m.isOutOfRange,
      };
    });

  const events = dbStore.safetyEvents.filter((e) => e.groupId === groupId).slice(0, 30);

  res.json({
    group: {
      id: group.id,
      name: group.name,
      destination: group.destination,
      rangeMeters: group.rangeMeters,
      isActive: group.isActive,
      ownerUserId: group.ownerUserId,
      inviteCode: group.ownerUserId === user.id ? group.inviteCode : null,
    },
    selfMemberId: membership.id,
    members,
    events,
    refreshedAt: new Date().toISOString(),
  });
});

app.put("/api/groups/:groupId/location", requireAuth, (req: Request, res: Response) => {
  const user = (req as unknown as { user: User }).user;
  const groupId = Number(req.params.groupId);
  const membership = dbStore.groupMembers.find((m) => m.groupId === groupId && m.userId === user.id);
  const group = dbStore.groups.find((g) => g.id === groupId);
  if (!membership || !group) return res.status(404).json({ error: "Not in this group." });

  const lat = isValidCoordinate(req.body.latitude, -90, 90);
  const lng = isValidCoordinate(req.body.longitude, -180, 180);
  const accuracy = Number(req.body.accuracyMeters) || 10;
  if (lat === null || lng === null) return res.status(400).json({ error: "Valid coordinate required." });

  const now = new Date().toISOString();
  membership.sharingEnabled = true;
  membership.latitude = lat;
  membership.longitude = lng;
  membership.accuracyMeters = accuracy;
  membership.locationUpdatedAt = now;

  // Check breaches against other sharing members
  const otherMembers = dbStore.groupMembers.filter(
    (m) => m.groupId === groupId && m.id !== membership.id && m.sharingEnabled && m.latitude !== null && m.longitude !== null
  );

  const breaches: Array<{ name: string; distanceMeters: number }> = [];
  for (const other of otherMembers) {
    const dist = distanceMeters({ latitude: lat, longitude: lng }, { latitude: other.latitude!, longitude: other.longitude! });
    if (dist > group.rangeMeters) {
      const otherUser = dbStore.users.find((u) => u.id === other.userId);
      breaches.push({ name: otherUser?.name || "Member", distanceMeters: dist });
    }
  }

  const isOutOfRange = breaches.length > 0;
  membership.isOutOfRange = isOutOfRange;

  if (isOutOfRange) {
    const nearest = breaches.sort((a, b) => a.distanceMeters - b.distanceMeters)[0];
    const msg = `${user.name} is ${nearest.distanceMeters.toLocaleString("en-IN")} m from ${nearest.name} (exceeds ${group.rangeMeters} m limit).`;
    dbStore.safetyEvents.unshift({
      id: dbStore.nextId.event++,
      groupId,
      memberId: membership.id,
      kind: "range_breach",
      message: msg,
      metadata: { distanceMeters: nearest.distanceMeters, rangeMeters: group.rangeMeters },
      acknowledged: false,
      createdAt: now,
    });
  }

  res.json({ ok: true, sharingEnabled: true, isOutOfRange, breaches, rangeMeters: group.rangeMeters });
});

app.delete("/api/groups/:groupId/location", requireAuth, (req: Request, res: Response) => {
  const user = (req as unknown as { user: User }).user;
  const groupId = Number(req.params.groupId);
  const membership = dbStore.groupMembers.find((m) => m.groupId === groupId && m.userId === user.id);
  if (membership) {
    membership.sharingEnabled = false;
    membership.latitude = null;
    membership.longitude = null;
    membership.locationUpdatedAt = null;
    membership.isOutOfRange = false;
  }
  res.json({ ok: true, sharingEnabled: false });
});

app.post("/api/groups/:groupId/sos", requireAuth, (req: Request, res: Response) => {
  const user = (req as unknown as { user: User }).user;
  const groupId = Number(req.params.groupId);
  const membership = dbStore.groupMembers.find((m) => m.groupId === groupId && m.userId === user.id);
  if (!membership) return res.status(404).json({ error: "Not a member." });

  const event: SafetyEvent = {
    id: dbStore.nextId.event++,
    groupId,
    memberId: membership.id,
    kind: "sos",
    message: `🚨 SOS broadcast from ${user.name}! Please check in immediately.`,
    metadata: { hasLiveLocation: membership.sharingEnabled },
    acknowledged: false,
    createdAt: new Date().toISOString(),
  };
  dbStore.safetyEvents.unshift(event);
  res.status(201).json({ event });
});

// TravelMate AI Assistant
app.post("/api/assistant", async (req: Request, res: Response) => {
  const input = req.body as AssistantInput;
  const message = input.message?.trim() || "";

  if (!message) {
    return res.status(400).json({ error: "Ask TravelMate about destinations, hotels, food, route, or budget." });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const dest = findDestination(input.destination || "Udaipur");
      const isUdaipur = dest.id === "udaipur";

      let systemInstruction = "";
      if (isUdaipur) {
        systemInstruction = `You are TravelMate AI acting as the "Udaipur Heritage & Sustainable Tourism Companion" (as well as an expert, culturally knowledgeable travel assistant for India).
You understand English, Hindi, and Hinglish. Answer the traveler's question directly, engagingly, and practically with clear markdown formatting and bullet points.

=== VERIFIED PROJECT DATA FOR UDAIPUR ===
Destination: ${dest.name}, ${dest.region}. Best time: ${dest.bestTime}, Budget guide: ${dest.budget}.

Heritage & Curated Places:
${dest.places
  .map((p) => {
    const lines = [`• ${p.name} (${p.kind}, ${p.price}): ${p.description}`];
    if (p.heritageNotes) lines.push(`  Heritage Context: ${p.heritageNotes}`);
    if (p.craftCategory) lines.push(`  Artisan & Craft: ${p.craftCategory}`);
    if (p.crowdLevel) {
      lines.push(
        `  Crowd Level: ${p.crowdLevel}. Peak: ${p.peakHours || "N/A"}. Best Visit: ${p.recommendedVisitTime || "N/A"}.`
      );
      if (p.crowdReliefSuggestion) lines.push(`  Relief Suggestion: ${p.crowdReliefSuggestion}`);
    }
    if (p.sustainable) lines.push(`  Sustainable: Yes (${p.sustainabilityTags?.join(", ") || "Eco-friendly"}). Eco practices: ${p.ecoPractices?.join("; ") || "Preservation"}`);
    if (p.localSourcing) lines.push(`  Local Sourcing: ${p.localSourcing}`);
    if (p.plasticReduction) lines.push(`  Plastic Reduction: ${p.plasticReduction}`);
    return lines.join("\n");
  })
  .join("\n\n")}

Curated Walking Route ("Old Udaipur Heritage & Artisan Circuit"):
Title: ${udaipurHeritageCircuit.title} (${udaipurHeritageCircuit.walkingDistanceEst || "~1.8 km"}, ${udaipurHeritageCircuit.walkingDurationEst || "2.5–3 hours"})
Description: ${udaipurHeritageCircuit.description}
Ordered Stops:
${udaipurHeritageCircuit.stops.map((s) => `${s.stepNumber}. ${s.name} (${s.category}): ${s.description}`).join("\n")}
Walking & Etiquette Tips:
${udaipurHeritageCircuit.walkingTips.map((t) => `• ${t}`).join("\n")}

Responsible Tourism Guidelines:
${(dest.responsibleTravelGuidelines || dest.tips).map((g) => `• ${g}`).join("\n")}

Cuisine & Dining:
${dest.foods.join(", ")}
Sustainable food options: Millets of Mewar (indigenous grains bajra/jowar/ragi, organic, glass water carafes, zero single-use plastic), Syah (refined farm-to-table fine dining), Jaajam (regional recipes).

=== CRITICAL BEHAVIORAL INSTRUCTIONS ===
1. GROUNDING IN DATA: Always prefer information from the verified project data above. If verified details are not available in project data, say so clearly rather than fabricating an answer.
2. CROWD PLANNING: When answering questions about crowds, visit timing, or peak hours, ALWAYS explicitly describe them as "Curated planning estimates". NEVER claim or imply "live crowd data", "real-time crowd data", "live traffic", or "live visitor counts".
3. RESPONSIBLE TOURISM: Naturally encourage protecting Lake Pichola's freshwater sanctity, respecting sacred spaces (removing shoes at Jagdish Temple stone stairs, modest dress), fair-trade direct support for local artisans without middlemen commissions, zero single-use plastics, and pedestrian / electric e-rickshaw travel through narrow Old City pols. Do not sound preachy; provide practical recommendations.
4. ARTISAN DISCOVERY: Highlight authentic Mewar crafts present in the project data (Mewar miniature painting and Pichwai studios in Jagdish Chowk, tie-dye Bandhani textiles in Bada Bazaar, puppetry/folk arts at Bagore Ki Haveli, handicrafts at Shilpgram). Do NOT invent fake artisan names, phone numbers, fake ratings, or fake bookings.
5. HERITAGE STORYTELLING: When asked about heritage places (e.g., City Palace, Jagdish Temple, Bagore Ki Haveli, Monsoon Palace, Saheliyon Ki Bari), explain their cultural significance, historical architecture, practical visiting advice, and curated crowd planning estimates using the provided data.
6. WALKING CIRCUIT GUIDANCE: When asked about walking routes, heritage walks, or exploring Old Udaipur on foot, explain the curated "Old Udaipur Heritage & Artisan Circuit", list its 5 ordered stops, emphasize pedestrian etiquette and respect for residential lanes and water bodies, and mention that users can view it interactively on the Trip Map panel in TravelMate.
7. GENERAL CAPABILITIES: Continue supporting multi-day itineraries, budgets, packing lists, weather, and general travel questions, as well as questions about other Indian destinations.`;
      } else {
        systemInstruction = `You are TravelMate AI, an expert, thoughtful, culturally knowledgeable travel assistant for India.
You understand English, Hindi, and Hinglish. Answer the traveler's question directly, concisely, and practically with bullets and formatting.
Destination: ${dest.name}, ${dest.region}.
Best time: ${dest.bestTime}, Budget guide: ${dest.budget}.
Curated places: ${dest.places.map((p) => p.name).join(", ")}.
Local dishes: ${dest.foods.join(", ")}.
Safety tips: ${dest.tips.join("; ")}.
Help with itineraries, cost breakdowns, packing, transport, and hidden gems.`;
      }

      const history = sanitizeHistory(input.history);
      const contents = [
        ...history.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        { role: "user", parts: [{ text: message }] },
      ];

      // Candidate models prioritized by current availability and speed
      const primaryModel = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
      const candidateModels = Array.from(
        new Set([primaryModel, "gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.8-flash"])
      );

      for (const model of candidateModels) {
        try {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Gemini API request timed out for model ${model}`)), 20000)
          );

          const generatePromise = ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction,
              temperature: 0.7,
            },
          });

          const response = await Promise.race([generatePromise, timeoutPromise]);
          const answer = response.text || "";
          if (answer.trim()) {
            return res.json({
              answer,
              source: "gemini",
              model,
              providerAvailable: true,
            });
          }
        } catch (modelErr) {
          console.warn(`Model ${model} attempt failed:`, modelErr instanceof Error ? modelErr.message : modelErr);
          // Try next candidate model in list
        }
      }
    } catch (error) {
      console.warn("Gemini API call encountered issue, falling back to local assistant:", error);
    }
  }

  // Graceful local structured assistant fallback
  const localResp = buildLocalTravelAnswer(input);
  res.json({
    answer: localResp.answer,
    source: "local",
    itinerary: localResp.itinerary,
    providerAvailable: false,
  });
});

// Push Subscribe endpoint
app.post("/api/push/subscribe", requireAuth, (_req: Request, res: Response) => {
  res.status(201).json({ ok: true, message: "Subscribed to device alerts" });
});

// Health check
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// Mount Vite or static server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0" },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`TravelMate server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
