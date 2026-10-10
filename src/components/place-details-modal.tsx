import {
  Bookmark,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  ExternalLink,
  Heart,
  Landmark,
  Leaf,
  MapPin,
  Navigation,
  Palette,
  Route,
  Share2,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect } from "react";
import type { Place, Destination } from "@/lib/travel-data";

type PlaceDetailsModalProps = {
  place: Place;
  destination: Destination;
  saved: boolean;
  onSave: () => void;
  onClose: () => void;
  onViewOnMap?: () => void;
  onAddToTrip?: () => void;
};

export default function PlaceDetailsModal({
  place,
  destination,
  saved,
  onSave,
  onClose,
  onViewOnMap,
  onAddToTrip,
}: PlaceDetailsModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const hasCrowd = Boolean(place.crowdLevel || place.recommendedVisitTime || place.peakHours);
  const isPeak = place.crowdLevel === "peak";
  const hasSustainability = Boolean(
    place.sustainable ||
      place.plasticReduction ||
      place.localSourcing ||
      (place.sustainabilityTags && place.sustainabilityTags.length > 0) ||
      (place.ecoPractices && place.ecoPractices.length > 0)
  );
  const hasArtisan = Boolean(place.craftCategory || place.localSourcing);
  const externalMapsUrl = place.coordinates
    ? `https://www.google.com/maps/search/?api=1&query=${place.coordinates[0]},${place.coordinates[1]}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name}, ${destination.name}`)}`;

  return (
    <div
      className="tm-modal-wrap"
      role="dialog"
      aria-modal="true"
      aria-labelledby="place-modal-title"
    >
      <button
        className="tm-modal-scrim"
        type="button"
        aria-label="Close place details"
        onClick={onClose}
      />
      <div className="tm-place-details-modal">
        {/* Header Hero Image */}
        <div className="tm-place-modal-hero">
          <img
            src={place.image}
            alt={`${place.name} in ${destination.name}`}
            className="tm-place-modal-image"
          />
          <div className="tm-place-modal-hero-overlay" />
          <button
            type="button"
            className="tm-place-modal-close"
            onClick={onClose}
            aria-label="Close place details dialog"
          >
            <X size={18} />
          </button>
          <div className="tm-place-modal-floating-actions">
            <button
              type="button"
              className={`tm-place-modal-save ${saved ? "is-saved" : ""}`}
              onClick={onSave}
              aria-label={saved ? "Remove from saved places" : "Save this place"}
            >
              <Bookmark size={16} fill={saved ? "currentColor" : "none"} />
              <span>{saved ? "Saved" : "Save"}</span>
            </button>
          </div>
          <div className="tm-place-modal-header-copy">
            <div className="tm-place-modal-badges">
              <span className="tm-place-type">{place.kind}</span>
              {place.sustainable && (
                <span className="tm-badge-sustainable">🌱 Sustainable</span>
              )}
              {place.craftCategory && (
                <span className="tm-badge-craft">🎨 {place.craftCategory}</span>
              )}
              {place.crowdLevel && (
                <span className={`tm-badge-crowd is-${place.crowdLevel}`}>
                  {place.crowdLevel === "low"
                    ? "🟢 Low Crowd"
                    : place.crowdLevel === "moderate"
                    ? "🟡 Moderate Crowd"
                    : "🔴 Peak Hours"}
                </span>
              )}
            </div>
            <h2 id="place-modal-title">{place.name}</h2>
            <p>
              <MapPin size={14} /> {place.location}, {destination.name}
            </p>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="tm-place-modal-content">
          {/* Quick Metrics Bar */}
          <div className="tm-place-modal-meta-bar">
            <div>
              <span className="tm-meta-label">RATING</span>
              <div className="tm-meta-val">
                <b>★ {place.rating}</b>
                <small>({place.reviews.toLocaleString("en-IN")} reviews)</small>
              </div>
            </div>
            <div>
              <span className="tm-meta-label">ESTIMATED SPEND</span>
              <div className="tm-meta-val">
                <b>{place.price}</b>
              </div>
            </div>
            <div>
              <span className="tm-meta-label">DESTINATION</span>
              <div className="tm-meta-val">
                <b>{destination.name}</b>
              </div>
            </div>
          </div>

          {/* Overview */}
          <section className="tm-place-modal-section">
            <h3 className="tm-modal-subhead">Overview</h3>
            <p className="tm-place-modal-desc">{place.description}</p>
          </section>

          {/* Heritage / Cultural Context */}
          {place.heritageNotes && (
            <section className="tm-place-modal-section tm-place-heritage-block">
              <div className="tm-modal-section-title">
                <Landmark size={17} />
                <h3 className="tm-modal-subhead">Heritage & Cultural Context</h3>
              </div>
              <p>{place.heritageNotes}</p>
            </section>
          )}

          {/* Crowd Planning box */}
          {hasCrowd && (
            <section className="tm-place-modal-section tm-place-crowd-block">
              <div className="tm-modal-section-title tm-crowd-title">
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Clock3 size={17} />
                  <h3 className="tm-modal-subhead">Visit & Crowd Planning</h3>
                </div>
                <span className="tm-curated-badge-pill">Curated planning estimate</span>
              </div>

              <div className="tm-crowd-grid">
                {place.recommendedVisitTime && (
                  <div className="tm-crowd-cell">
                    <span className="tm-cell-lbl">RECOMMENDED VISIT WINDOW</span>
                    <strong>{place.recommendedVisitTime}</strong>
                  </div>
                )}
                {place.peakHours && (
                  <div className="tm-crowd-cell">
                    <span className="tm-cell-lbl">PEAK HOURS TO AVOID</span>
                    <strong>{place.peakHours}</strong>
                  </div>
                )}
              </div>

              {place.crowdReliefSuggestion && (
                <div className={`tm-relief-callout ${isPeak ? "is-peak" : ""}`}>
                  <b>💡 Timing Tip:</b> {place.crowdReliefSuggestion}
                </div>
              )}
            </section>
          )}

          {/* Artisan / Local Culture */}
          {hasArtisan && (
            <section className="tm-place-modal-section tm-place-craft-block">
              <div className="tm-modal-section-title">
                <Palette size={17} />
                <h3 className="tm-modal-subhead">Artisan & Craft Heritage</h3>
              </div>
              {place.craftCategory && (
                <p>
                  <strong>Traditional craft:</strong> {place.craftCategory}
                </p>
              )}
              {place.localSourcing && (
                <p className="tm-text-secondary">{place.localSourcing}</p>
              )}
            </section>
          )}

          {/* Sustainability & Eco-practices */}
          {hasSustainability && (
            <section className="tm-place-modal-section tm-place-sust-block">
              <div className="tm-modal-section-title">
                <Leaf size={17} />
                <h3 className="tm-modal-subhead">Sustainable Tourism & Ecology</h3>
              </div>
              {place.plasticReduction && (
                <p>
                  <strong>Water & plastic stewardship:</strong> {place.plasticReduction}
                </p>
              )}
              {place.sustainabilityTags && place.sustainabilityTags.length > 0 && (
                <div className="tm-modal-tags-row">
                  {place.sustainabilityTags.map((tag) => (
                    <span key={tag} className="tm-sust-tag">
                      ✓ {tag}
                    </span>
                  ))}
                </div>
              )}
              {place.ecoPractices && place.ecoPractices.length > 0 && (
                <ul className="tm-modal-bullet-list">
                  {place.ecoPractices.map((practice, idx) => (
                    <li key={idx}>
                      <Check size={13} /> {practice}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* Location & Navigation */}
          <section className="tm-place-modal-section">
            <h3 className="tm-modal-subhead">Location & Directions</h3>
            <p className="tm-text-secondary">
              Located in {place.location}, {destination.name}, {destination.region}.
            </p>
          </section>
        </div>

        {/* Modal Action Footer */}
        <footer className="tm-place-modal-footer">
          {onViewOnMap && (
            <button
              type="button"
              className="tm-modal-btn tm-modal-btn-secondary"
              onClick={() => {
                onClose();
                onViewOnMap();
              }}
            >
              <Navigation size={15} /> View on Map
            </button>
          )}
          {onAddToTrip && (
            <button
              type="button"
              className="tm-modal-btn tm-modal-btn-secondary"
              onClick={() => {
                onClose();
                onAddToTrip();
              }}
            >
              <Route size={15} /> Add to Trip
            </button>
          )}
          <a
            href={externalMapsUrl}
            target="_blank"
            rel="noreferrer"
            className="tm-modal-btn tm-modal-btn-primary"
          >
            <span>Google Maps</span>
            <ExternalLink size={14} />
          </a>
        </footer>
      </div>
    </div>
  );
}
