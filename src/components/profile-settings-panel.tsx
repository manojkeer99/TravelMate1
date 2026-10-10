import { Check, Save, UserRound } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

export type Profile = {
  id: number;
  name: string;
  email: string;
  avatarUrl: string | null;
  travelPreferences: string[];
  preferredBudget: string | null;
  preferredTripType: string | null;
};

const interests = ["Culture", "Nature", "Food", "Adventure", "Family", "Romantic", "Wellness", "Photography"];
const budgets = ["Budget", "Standard", "Premium"];
const tripTypes = ["Culture", "Nature", "Food", "Adventure", "Family", "Romantic", "Wellness", "Mixed"];

export default function ProfileSettingsPanel({ onUpdated }: { onUpdated: (profile: Profile) => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({
    name: "",
    avatarUrl: "",
    preferredBudget: "Standard",
    preferredTripType: "Mixed",
    travelPreferences: [] as string[],
  });
  const [state, setState] = useState<"loading" | "ready" | "saving" | "error" | "success">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/profile", { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as { profile?: Profile; error?: string };
        if (!response.ok || !data.profile) throw new Error(data.error || "Could not load your profile.");
        setProfile(data.profile);
        setForm({
          name: data.profile.name,
          avatarUrl: data.profile.avatarUrl || "",
          preferredBudget: data.profile.preferredBudget || "Standard",
          preferredTripType: data.profile.preferredTripType || "Mixed",
          travelPreferences: data.profile.travelPreferences || [],
        });
        setState("ready");
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setMessage(error instanceof Error ? error.message : "Could not load your profile.");
          setState("error");
        }
      });
    return () => controller.abort();
  }, []);

  function toggleInterest(interest: string) {
    setForm((current) => ({
      ...current,
      travelPreferences: current.travelPreferences.includes(interest)
        ? current.travelPreferences.filter((item) => item !== interest)
        : [...current.travelPreferences, interest],
    }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setState("saving");
    setMessage("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as { profile?: Profile; error?: string };
      if (!response.ok || !data.profile) throw new Error(data.error || "Could not save your profile.");
      setProfile(data.profile);
      onUpdated(data.profile);
      setState("success");
      setMessage("Your travel profile has been saved.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not save your profile.");
    }
  }

  if (state === "loading") {
    return (
      <div className="tm-panel-body">
        <div className="tm-search-loading">
          <span />
          <span />
          <p>Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!profile && state === "error") {
    return (
      <div className="tm-panel-body">
        <div className="tm-search-error" role="alert">
          <div>
            <UserRound size={20} />
            <div>
              <h3>Profile unavailable</h3>
              <p>{message}</p>
            </div>
          </div>
          <button type="button" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="tm-panel-body tm-profile-form" onSubmit={(event) => void save(event)}>
      <div className="tm-profile-edit-avatar">
        {form.avatarUrl ? (
          <img src={form.avatarUrl} alt="Profile preview" />
        ) : (
          <div className="tm-profile-avatar" style={{ width: 44, height: 44, fontSize: 18 }}>
            {form.name ? form.name[0].toUpperCase() : <UserRound size={20} />}
          </div>
        )}
        <div>
          <b>{profile?.email}</b>
          <span>Your travel account profile</span>
        </div>
      </div>
      <label>
        Display name
        <input
          required
          minLength={2}
          maxLength={120}
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
        />
      </label>
      <label>
        Profile image URL (HTTPS)
        <input
          type="url"
          inputMode="url"
          value={form.avatarUrl}
          onChange={(event) => setForm((current) => ({ ...current, avatarUrl: event.target.value }))}
          placeholder="https://images.pexels.com/..."
        />
        <small>Optional. Use a public HTTPS image URL.</small>
      </label>
      <div className="tm-form-two">
        <label>
          Preferred budget
          <select
            value={form.preferredBudget}
            onChange={(event) => setForm((current) => ({ ...current, preferredBudget: event.target.value }))}
          >
            {budgets.map((budget) => (
              <option key={budget}>{budget}</option>
            ))}
          </select>
        </label>
        <label>
          Preferred trip type
          <select
            value={form.preferredTripType}
            onChange={(event) => setForm((current) => ({ ...current, preferredTripType: event.target.value }))}
          >
            {tripTypes.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
      </div>
      <fieldset>
        <legend>Travel interests</legend>
        <div className="tm-interest-grid">
          {interests.map((interest) => (
            <label key={interest}>
              <input
                type="checkbox"
                checked={form.travelPreferences.includes(interest)}
                onChange={() => toggleInterest(interest)}
              />
              <span>{form.travelPreferences.includes(interest) && <Check size={12} />}</span>
              {interest}
            </label>
          ))}
        </div>
      </fieldset>
      {message && (
        <p className={state === "success" ? "tm-form-success" : "tm-form-error"} role={state === "error" ? "alert" : "status"}>
          {message}
        </p>
      )}
      <button type="submit" className="tm-primary-button" disabled={state === "saving"}>
        <Save size={16} /> {state === "saving" ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}
