import { createItinerary } from "@/lib/travel-data";

export type ItineraryItem = {
  id: string;
  time: string;
  title: string;
  meta: string;
  type: "visit" | "food" | "activity" | "travel";
  location?: string;
  durationMinutes?: number;
  estimatedCost?: number;
  notes?: string;
};

export type ItineraryDay = { day: number; title: string; items: ItineraryItem[] };

export type ValidTripInput = {
  title: string;
  destination: string;
  startLocation: string | null;
  startDate: string;
  endDate: string;
  travellers: number;
  budget: number;
  style: "Budget" | "Standard" | "Premium";
  itinerary: ItineraryDay[];
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";
}

function dateAtMidnight(value: string) {
  if (!datePattern.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function normalizeItinerary(value: unknown, destination: string, days: number, style: "Budget" | "Standard" | "Premium") {
  if (!Array.isArray(value) || !value.length) return createItinerary(destination, days, style) as ItineraryDay[];
  const daysByNumber = value.slice(0, 14).flatMap((rawDay, index) => {
    if (!rawDay || typeof rawDay !== "object") return [];
    const dayRecord = rawDay as { day?: unknown; title?: unknown; items?: unknown };
    const day = Number.isInteger(Number(dayRecord.day)) ? Math.max(1, Math.min(Number(dayRecord.day), 14)) : index + 1;
    const items = Array.isArray(dayRecord.items) ? dayRecord.items.slice(0, 12).flatMap((rawItem, itemIndex) => {
      if (!rawItem || typeof rawItem !== "object") return [];
      const item = rawItem as Record<string, unknown>;
      const time = clean(item.time, 5);
      const title = clean(item.title, 180);
      if (!timePattern.test(time) || !title) return [];
      const type = ["visit", "food", "activity", "travel"].includes(String(item.type)) ? String(item.type) as ItineraryItem["type"] : "visit";
      const duration = Math.max(0, Math.min(Math.round(Number(item.durationMinutes) || 0), 720)) || undefined;
      const cost = Math.max(0, Math.min(Math.round(Number(item.estimatedCost) || 0), 1_000_000)) || undefined;
      return [{
        id: clean(item.id, 80) || `activity-${day}-${itemIndex}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 36)}`,
        time,
        title,
        meta: clean(item.meta, 250) || clean(item.location, 120) || "Planned activity",
        type,
        location: clean(item.location, 120) || undefined,
        durationMinutes: duration,
        estimatedCost: cost,
        notes: clean(item.notes, 1000) || undefined,
      }];
    }) : [];
    const sorted = [...items].sort((a, b) => a.time.localeCompare(b.time));
    for (let itemIndex = 1; itemIndex < sorted.length; itemIndex += 1) {
      const previous = sorted[itemIndex - 1];
      const current = sorted[itemIndex];
      const previousMinutes = Number(previous.time.slice(0, 2)) * 60 + Number(previous.time.slice(3));
      const currentMinutes = Number(current.time.slice(0, 2)) * 60 + Number(current.time.slice(3));
      if ((previous.durationMinutes || 0) > 0 && currentMinutes < previousMinutes + (previous.durationMinutes || 0)) {
        throw new Error(`Activities overlap on day ${day}: "${previous.title}" and "${current.title}".`);
      }
    }
    return [{ day, title: clean(dayRecord.title, 160) || `Day ${day}`, items: sorted }];
  });
  if (!daysByNumber.length) throw new Error("Add at least one valid itinerary activity before saving.");
  return daysByNumber;
}

export function validateTripInput(body: Record<string, unknown>, requireAllFields = true): ValidTripInput {
  const destination = clean(body.destination, 120);
  const title = clean(body.title, 180) || (destination ? `${destination} trip` : "");
  const startLocation = clean(body.startLocation, 120) || null;
  const startDate = clean(body.startDate, 10);
  const endDate = clean(body.endDate, 10);
  const travellers = Math.round(Number(body.travellers));
  const budget = Math.round(Number(body.budget));
  const style = ["Budget", "Standard", "Premium"].includes(String(body.style)) ? String(body.style) as ValidTripInput["style"] : "Standard";
  if (!destination || !title) throw new Error("Choose a destination and give this trip a name.");
  const start = dateAtMidnight(startDate);
  const end = dateAtMidnight(endDate);
  if (requireAllFields && (!start || !end)) throw new Error("Choose both a start and end date.");
  if (start && end && end.getTime() < start.getTime()) throw new Error("Your end date must be the same as or after your start date.");
  if (!Number.isInteger(travellers) || travellers < 1 || travellers > 20) throw new Error("Traveller count must be between 1 and 20.");
  if (!Number.isInteger(budget) || budget < 1000 || budget > 10_000_000) throw new Error("Enter a trip budget between ₹1,000 and ₹1,00,00,000.");
  const days = start && end ? Math.min(14, Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1)) : Math.max(1, Math.min(Number(body.days) || 3, 14));
  const itinerary = normalizeItinerary(body.itinerary, destination, days, style);
  return { title, destination, startLocation, startDate, endDate, travellers, budget, style, itinerary };
}

export function estimatedItineraryCost(itinerary: ItineraryDay[]) {
  return itinerary.flatMap((day) => day.items).reduce((total, item) => total + (item.estimatedCost || 0), 0);
}
