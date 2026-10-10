import {
  Compass,
  Heart,
  Landmark,
  Leaf,
  Navigation,
  Palette,
  Route,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

type FooterProps = {
  onNavigateView?: (view: "home" | "explore" | "trips" | "saved" | "profile") => void;
  onOpenPanel?: (panel: "planner" | "assistant" | "map" | "group" | "emergency") => void;
  onSelectTheme?: (theme: string) => void;
};

export default function TravelMateFooter({
  onNavigateView,
  onOpenPanel,
}: FooterProps) {
  return (
    <footer className="tm-site-footer" role="contentinfo" aria-label="TravelMate site footer">
      <div className="tm-footer-inner">
        <div className="tm-footer-brand-col">
          <div className="tm-footer-brand">
            <span className="tm-brand-mark">
              <Compass size={17} />
            </span>
            <span>
              travel<em>mate</em>
            </span>
          </div>
          <p className="tm-footer-desc">
            Your mindful travel companion for Rajasthan and India. Curating authentic heritage,
            supporting indigenous artisans, and inspiring lower-crowd sustainable journeys.
          </p>
          <div className="tm-footer-curated-badge">
            <Sparkles size={13} />
            <span>Honest & Curated Tourism</span>
          </div>
        </div>

        <div className="tm-footer-links-grid">
          <div className="tm-footer-col">
            <h4 className="tm-footer-col-title">Explore Udaipur</h4>
            <ul>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateView?.("explore")}
                  className="tm-footer-link"
                >
                  <Landmark size={13} /> Living Heritage
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateView?.("explore")}
                  className="tm-footer-link"
                >
                  <Palette size={13} /> Artisan & Mewar Crafts
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateView?.("explore")}
                  className="tm-footer-link"
                >
                  <Leaf size={13} /> Sustainable Hospitality
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenPanel?.("map")}
                  className="tm-footer-link"
                >
                  <Route size={13} /> Heritage Walking Circuit
                </button>
              </li>
            </ul>
          </div>

          <div className="tm-footer-col">
            <h4 className="tm-footer-col-title">Travel Planning</h4>
            <ul>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenPanel?.("planner")}
                  className="tm-footer-link"
                >
                  Trip Itinerary Planner
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateView?.("saved")}
                  className="tm-footer-link"
                >
                  Saved Wishlist & Places
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenPanel?.("assistant")}
                  className="tm-footer-link"
                >
                  Heritage & Eco Companion AI
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenPanel?.("map")}
                  className="tm-footer-link"
                >
                  Regional Road Routes
                </button>
              </li>
            </ul>
          </div>

          <div className="tm-footer-col">
            <h4 className="tm-footer-col-title">Safety & Care</h4>
            <ul>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenPanel?.("group")}
                  className="tm-footer-link"
                >
                  Private Group Safety
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenPanel?.("emergency")}
                  className="tm-footer-link"
                >
                  Emergency & Local Support
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateView?.("explore")}
                  className="tm-footer-link"
                >
                  Responsible Lake Guidelines
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenPanel?.("group")}
                  className="tm-footer-link"
                >
                  Consent-Based Live Sharing
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="tm-footer-bottom">
        <div className="tm-footer-bottom-inner">
          <p>© {new Date().getFullYear()} TravelMate. Plan travel beautifully and respectfully.</p>
          <div className="tm-footer-disclaimer">
            <span>Curated planning estimates • Zero live crowd sensors • Respect local heritage</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
