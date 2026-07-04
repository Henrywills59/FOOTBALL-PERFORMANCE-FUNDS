import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type {
  AuthResponse,
  AuthUser,
  FootballFixtureDetail,
  FootballFixtureSummary,
  PredictionResult,
  PublicUserRole,
} from "@fpf/shared";
import { PUBLIC_USER_ROLES } from "@fpf/shared";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const navItems = ["Dashboard", "Match Center", "Smart Bet Slip", "Daily Opportunities", "Profile"] as const;

type AuthMode = "login" | "register" | "forgot";
type NavItem = (typeof navItems)[number];
type PredictionWithFixture = PredictionResult & { fixture?: FootballFixtureDetail };

const roleLabels: Record<PublicUserRole | "ADMIN", string> = {
  SUBSCRIBER: "Subscriber",
  INVESTOR: "Investor",
  ANALYST: "Analyst",
  ADMIN: "Admin",
};

function getStoredSession() {
  const rawSession = localStorage.getItem("fpf_session") ?? sessionStorage.getItem("fpf_session");
  if (!rawSession) return null;
  try {
    return JSON.parse(rawSession) as AuthResponse;
  } catch {
    return null;
  }
}

export default function App() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [session, setSession] = useState<AuthResponse | null>(() => getStoredSession());
  const [activeView, setActiveView] = useState<NavItem>("Dashboard");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fixtures, setFixtures] = useState<FootballFixtureSummary[]>([]);
  const [selectedFixture, setSelectedFixture] = useState<FootballFixtureDetail | null>(null);
  const [predictions, setPredictions] = useState<PredictionWithFixture[]>([]);
  const [selectedPrediction, setSelectedPrediction] = useState<PredictionWithFixture | null>(null);
  const [slip, setSlip] = useState<PredictionWithFixture[]>([]);
  const [filters, setFilters] = useState({ search: "", league: "", date: "" });
  const [loadingLabel, setLoadingLabel] = useState("Loading");

  useEffect(() => {
    if (!session) return;
    void loadSubscriberData(session.token);
  }, [session]);

  const combinedOdds = useMemo(
    () =>
      slip.reduce((total, prediction) => {
        const odds = prediction.impliedProbability ? 1 / prediction.impliedProbability : 1;
        return Number((total * odds).toFixed(2));
      }, 1),
    [slip],
  );

  const overallConfidence = useMemo(() => {
    if (!slip.length) return 0;
    return Math.round(slip.reduce((total, item) => total + item.confidenceScore, 0) / slip.length);
  }, [slip]);

  const slipRisk = useMemo(() => {
    if (!slip.length) return "Low";
    const averageRisk = slip.reduce((total, item) => total + item.riskScore, 0) / slip.length;
    if (slip.length > 3 || averageRisk >= 70) return "High";
    if (slip.length > 2 || averageRisk >= 45) return "Medium";
    return "Low";
  }, [slip]);

  function storeSession(nextSession: AuthResponse, rememberMe: boolean) {
    const serialized = JSON.stringify(nextSession);
    sessionStorage.removeItem("fpf_session");
    localStorage.removeItem("fpf_session");
    if (rememberMe) localStorage.setItem("fpf_session", serialized);
    else sessionStorage.setItem("fpf_session", serialized);
    setSession(nextSession);
  }

  async function postPublic(path: string, body: object) {
    const response = await fetch(`${apiUrl}/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Something went wrong");
    return data;
  }

  async function apiGet<T>(path: string, token: string) {
    const response = await fetch(`${apiUrl}/api${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Request failed");
    return data as T;
  }

  async function apiPost<T>(path: string, token: string, body?: object) {
    const response = await fetch(`${apiUrl}/api${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Request failed");
    return data as T;
  }

  async function loadSubscriberData(token: string) {
    try {
      setLoadingLabel("Loading subscriber platform");
      const [fixtureData, approvedData] = await Promise.all([
        apiGet<{ fixtures: FootballFixtureSummary[] }>("/football/fixtures?limit=30", token),
        apiGet<{ predictions: PredictionResult[] }>("/predictions/approved", token),
      ]);
      setFixtures(fixtureData.fixtures);
      if (fixtureData.fixtures[0]) await loadFixtureDetail(fixtureData.fixtures[0].id, token);

      const enriched = await Promise.all(
        approvedData.predictions.map(async (prediction) => {
          try {
            const detail = await apiGet<{ fixture: FootballFixtureDetail }>(
              `/football/fixtures/${prediction.fixtureId}`,
              token,
            );
            return { ...prediction, fixture: detail.fixture };
          } catch {
            return prediction;
          }
        }),
      );
      setPredictions(enriched);
      setSelectedPrediction(enriched[0] ?? null);
      setLoadingLabel("Ready");
    } catch (caughtError) {
      setLoadingLabel(caughtError instanceof Error ? caughtError.message : "Unable to load data");
    }
  }

  async function loadFixtureDetail(id: string, token = session?.token) {
    if (!token) return;
    const data = await apiGet<{ fixture: FootballFixtureDetail }>(`/football/fixtures/${id}`, token);
    setSelectedFixture(data.fixture);
  }

  async function loadFilteredFixtures(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!session) return;
    const params = new URLSearchParams({ limit: "30" });
    if (filters.search) params.set("search", filters.search);
    if (filters.league) params.set("league", filters.league);
    if (filters.date) params.set("date", filters.date);
    const data = await apiGet<{ fixtures: FootballFixtureSummary[] }>(
      `/football/fixtures?${params.toString()}`,
      session.token,
    );
    setFixtures(data.fixtures);
  }

  function addToSlip(prediction: PredictionWithFixture) {
    if (!prediction.id || slip.some((item) => item.id === prediction.id) || slip.length >= 5) return;
    setSlip((current) => [...current, prediction]);
  }

  function removeFromSlip(id?: string) {
    setSlip((current) => current.filter((item) => item.id !== id));
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const rememberMe = form.get("rememberMe") === "on";
    const data = (await postPublic("/auth/login", {
      email: form.get("email"),
      password: form.get("password"),
      rememberMe,
    })) as AuthResponse;
    storeSession(data, rememberMe);
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const data = (await postPublic("/auth/register", {
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
      role: form.get("role"),
    })) as AuthResponse;
    storeSession(data, false);
  }

  async function handleForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const data = (await postPublic("/auth/forgot-password", {
      email: form.get("email"),
    })) as { message: string; resetToken?: string };
    setMessage(data.resetToken ? `${data.message} Temporary reset token: ${data.resetToken}` : data.message);
  }

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const data = await apiPost<{ message: string }>("/users/me/password", session.token, {
      currentPassword: form.get("currentPassword"),
      newPassword: form.get("newPassword"),
    });
    setMessage(data.message);
    event.currentTarget.reset();
  }

  function safelySubmit(handler: (event: FormEvent<HTMLFormElement>) => Promise<void>) {
    return async (event: FormEvent<HTMLFormElement>) => {
      try {
        await handler(event);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Something went wrong");
      }
    };
  }

  function signOut() {
    localStorage.removeItem("fpf_session");
    sessionStorage.removeItem("fpf_session");
    setSession(null);
    setMessage("");
    setError("");
    setSlip([]);
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <section className="mx-auto grid min-h-screen w-full max-w-6xl gap-10 px-6 py-10 lg:grid-cols-[1fr_420px] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Subscriber access</p>
            <h1 className="mt-4 text-4xl font-bold tracking-normal sm:text-5xl">Football Performance Fund</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
              A fast, focused workspace for approved football opportunities, match context, and smart slip building.
            </p>
          </div>
          <AuthPanel
            error={error}
            message={message}
            mode={mode}
            setMode={setMode}
            onLogin={safelySubmit(handleLogin)}
            onRegister={safelySubmit(handleRegister)}
            onForgot={safelySubmit(handleForgotPassword)}
          />
        </section>
      </main>
    );
  }

  const featured = predictions.slice(0, 3);
  const daily = [...predictions].sort((a, b) => b.confidenceScore - a.confidenceScore);
  const recent = predictions.slice(0, 5);

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col lg:flex-row">
        <aside className="border-b border-zinc-800 bg-zinc-950/95 px-4 py-4 lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:border-b-0 lg:border-r lg:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">FPF Subscriber</p>
            <h1 className="mt-2 text-xl font-bold">Command Center</h1>
          </div>
          <nav className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-1">
            {navItems.map((item) => (
              <button
                className={`rounded-md px-3 py-3 text-left text-sm font-medium transition ${
                  activeView === item ? "bg-emerald-300 text-zinc-950" : "bg-zinc-900 text-zinc-300 hover:text-white"
                }`}
                key={item}
                type="button"
                onClick={() => setActiveView(item)}
              >
                {item}
              </button>
            ))}
          </nav>
          <button
            className="mt-4 w-full rounded-md border border-zinc-800 px-3 py-3 text-sm text-zinc-300 transition hover:border-emerald-300"
            type="button"
            onClick={signOut}
          >
            Sign out
          </button>
        </aside>

        <section className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm text-emerald-300">{loadingLabel}</p>
              <h2 className="mt-1 text-3xl font-bold tracking-normal">Welcome, {session.user.name}</h2>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
              Subscriber Preview · Active
            </div>
          </div>

          {error ? <p className="mt-4 rounded-md bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
          {message ? <p className="mt-4 rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</p> : null}

          {activeView === "Dashboard" ? (
            <DashboardView featured={featured} recent={recent} predictions={predictions} onAdd={addToSlip} />
          ) : null}
          {activeView === "Match Center" ? (
            <MatchCenterView
              filters={filters}
              fixtures={fixtures}
              predictions={predictions}
              selectedFixture={selectedFixture}
              setFilters={setFilters}
              onFilter={loadFilteredFixtures}
              onSelectFixture={(id) => void loadFixtureDetail(id)}
              onSelectPrediction={setSelectedPrediction}
            />
          ) : null}
          {activeView === "Smart Bet Slip" ? (
            <SmartSlipView
              combinedOdds={combinedOdds}
              overallConfidence={overallConfidence}
              riskLevel={slipRisk}
              selections={slip}
              onRemove={removeFromSlip}
            />
          ) : null}
          {activeView === "Daily Opportunities" ? (
            <OpportunityList predictions={daily} onAdd={addToSlip} onSelect={setSelectedPrediction} />
          ) : null}
          {activeView === "Profile" ? (
            <ProfileView session={session} onPasswordChange={safelySubmit(handlePasswordChange)} />
          ) : null}

          {activeView !== "Profile" ? (
            <PredictionDetail prediction={selectedPrediction} onAdd={addToSlip} />
          ) : null}
        </section>
      </div>
    </main>
  );
}

function AuthPanel({
  error,
  message,
  mode,
  onForgot,
  onLogin,
  onRegister,
  setMode,
}: {
  error: string;
  message: string;
  mode: AuthMode;
  onForgot: (event: FormEvent<HTMLFormElement>) => void;
  onLogin: (event: FormEvent<HTMLFormElement>) => void;
  onRegister: (event: FormEvent<HTMLFormElement>) => void;
  setMode: (mode: AuthMode) => void;
}) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 shadow-2xl shadow-black/20">
      <div className="grid grid-cols-3 rounded-md bg-zinc-950 p-1 text-sm">
        <ModeButton active={mode === "login"} onClick={() => setMode("login")}>Login</ModeButton>
        <ModeButton active={mode === "register"} onClick={() => setMode("register")}>Register</ModeButton>
        <ModeButton active={mode === "forgot"} onClick={() => setMode("forgot")}>Reset</ModeButton>
      </div>
      {error ? <p className="mt-4 rounded-md bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
      {message ? <p className="mt-4 rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</p> : null}
      {mode === "login" ? (
        <form className="mt-6 space-y-4" onSubmit={onLogin}>
          <TextField label="Email" name="email" type="email" />
          <TextField label="Password" name="password" type="password" />
          <label className="flex items-center gap-3 text-sm text-zinc-300">
            <input className="h-4 w-4 accent-emerald-400" name="rememberMe" type="checkbox" />
            Remember me
          </label>
          <SubmitButton>Login</SubmitButton>
        </form>
      ) : null}
      {mode === "register" ? (
        <form className="mt-6 space-y-4" onSubmit={onRegister}>
          <TextField label="Name" name="name" type="text" />
          <TextField label="Email" name="email" type="email" />
          <TextField label="Password" name="password" type="password" />
          <label className="block text-sm font-medium text-zinc-200">
            Role
            <select className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none focus:border-emerald-300" name="role" defaultValue="SUBSCRIBER">
              {PUBLIC_USER_ROLES.map((role) => (
                <option key={role} value={role}>{roleLabels[role]}</option>
              ))}
            </select>
          </label>
          <SubmitButton>Create account</SubmitButton>
        </form>
      ) : null}
      {mode === "forgot" ? (
        <form className="mt-6 space-y-4" onSubmit={onForgot}>
          <TextField label="Email" name="email" type="email" />
          <SubmitButton>Send reset link</SubmitButton>
        </form>
      ) : null}
    </section>
  );
}

function DashboardView({
  featured,
  onAdd,
  predictions,
  recent,
}: {
  featured: PredictionWithFixture[];
  onAdd: (prediction: PredictionWithFixture) => void;
  predictions: PredictionWithFixture[];
  recent: PredictionWithFixture[];
}) {
  const averageConfidence = predictions.length
    ? Math.round(predictions.reduce((total, item) => total + item.confidenceScore, 0) / predictions.length)
    : 0;
  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Subscription" value="Active" />
        <Metric label="Approved opportunities" value={String(predictions.length)} />
        <Metric label="Avg confidence" value={`${averageConfidence}%`} />
        <Metric label="Recent predictions" value={String(recent.length)} />
      </div>
      <Panel title="Today's Featured Opportunities">
        <OpportunityCards predictions={featured} onAdd={onAdd} />
      </Panel>
      <Panel title="Recent Predictions">
        <CompactPredictionList predictions={recent} />
      </Panel>
    </div>
  );
}

function MatchCenterView({
  filters,
  fixtures,
  onFilter,
  onSelectFixture,
  onSelectPrediction,
  predictions,
  selectedFixture,
  setFilters,
}: {
  filters: { search: string; league: string; date: string };
  fixtures: FootballFixtureSummary[];
  onFilter: (event: FormEvent<HTMLFormElement>) => void;
  onSelectFixture: (id: string) => void;
  onSelectPrediction: (prediction: PredictionWithFixture) => void;
  predictions: PredictionWithFixture[];
  selectedFixture: FootballFixtureDetail | null;
  setFilters: (filters: { search: string; league: string; date: string }) => void;
}) {
  const fixturePrediction = selectedFixture
    ? predictions.find((prediction) => prediction.fixtureId === selectedFixture.id)
    : null;
  return (
    <div className="mt-6 grid gap-4 xl:grid-cols-[360px_1fr]">
      <Panel title="Match Center">
        <form className="grid gap-3" onSubmit={onFilter}>
          <TextField label="Search fixtures" name="search" type="search" value={filters.search} onChange={(value) => setFilters({ ...filters, search: value })} />
          <TextField label="League" name="league" type="text" value={filters.league} onChange={(value) => setFilters({ ...filters, league: value })} />
          <TextField label="Date" name="date" type="date" value={filters.date} onChange={(value) => setFilters({ ...filters, date: value })} />
          <SubmitButton>Apply filters</SubmitButton>
        </form>
        <div className="mt-4 space-y-2">
          {fixtures.map((fixture) => (
            <button className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-3 text-left hover:border-emerald-300" key={fixture.id} type="button" onClick={() => onSelectFixture(fixture.id)}>
              <span className="text-xs uppercase tracking-[0.12em] text-zinc-500">{fixture.leagueName}</span>
              <span className="mt-1 block font-semibold">{fixture.homeTeamName} vs {fixture.awayTeamName}</span>
              <span className="mt-1 block text-sm text-zinc-400">{fixture.status} · {new Date(fixture.kickoffAt).toLocaleDateString()}</span>
            </button>
          ))}
          {!fixtures.length ? <p className="text-sm text-zinc-400">No fixtures match those filters.</p> : null}
        </div>
      </Panel>
      <Panel title="Match Analysis">
        {selectedFixture ? (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">{selectedFixture.homeTeamName} vs {selectedFixture.awayTeamName}</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="AI confidence" value={fixturePrediction ? `${fixturePrediction.confidenceScore}%` : "Pending"} />
              <Metric label="Risk score" value={fixturePrediction ? String(fixturePrediction.riskScore) : "Pending"} />
              <Metric label="Value rating" value={fixturePrediction?.valueRating ?? "Pending"} />
            </div>
            <p className="text-sm leading-6 text-zinc-300">{fixturePrediction?.explanation ?? "No approved prediction is available for this match yet."}</p>
            {fixturePrediction ? <button className="rounded-md bg-emerald-300 px-4 py-3 font-semibold text-zinc-950" type="button" onClick={() => onSelectPrediction(fixturePrediction)}>View prediction details</button> : null}
          </div>
        ) : (
          <p className="text-sm text-zinc-400">Select a fixture to view analysis.</p>
        )}
      </Panel>
    </div>
  );
}

function SmartSlipView({
  combinedOdds,
  onRemove,
  overallConfidence,
  riskLevel,
  selections,
}: {
  combinedOdds: number;
  onRemove: (id?: string) => void;
  overallConfidence: number;
  riskLevel: string;
  selections: PredictionWithFixture[];
}) {
  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Combined odds" value={selections.length ? combinedOdds.toFixed(2) : "-"} />
        <Metric label="Overall confidence" value={selections.length ? `${overallConfidence}%` : "-"} />
        <Metric label="Risk level" value={riskLevel} />
      </div>
      {riskLevel === "High" ? <p className="rounded-md bg-red-500/10 p-3 text-sm text-red-200">Selections are becoming too risky. Keep the slip focused.</p> : null}
      <Panel title="Smart Bet Slip">
        <div className="space-y-3">
          {selections.map((selection) => (
            <div className="flex items-start justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-950 p-3" key={selection.id}>
              <div>
                <p className="font-semibold">{selection.predictedOutcome}</p>
                <p className="mt-1 text-sm text-zinc-400">{selection.fixture ? `${selection.fixture.homeTeamName} vs ${selection.fixture.awayTeamName}` : selection.recommendedMarket}</p>
              </div>
              <button className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200" type="button" onClick={() => onRemove(selection.id)}>Remove</button>
            </div>
          ))}
          {!selections.length ? <p className="text-sm text-zinc-400">Add approved predictions from Daily Opportunities. Maximum 5 selections.</p> : null}
        </div>
      </Panel>
    </div>
  );
}

function OpportunityList({
  onAdd,
  onSelect,
  predictions,
}: {
  onAdd: (prediction: PredictionWithFixture) => void;
  onSelect: (prediction: PredictionWithFixture) => void;
  predictions: PredictionWithFixture[];
}) {
  return (
    <div className="mt-6">
      <Panel title="Daily Opportunities">
        <OpportunityCards predictions={predictions} onAdd={onAdd} onSelect={onSelect} />
      </Panel>
    </div>
  );
}

function PredictionDetail({
  onAdd,
  prediction,
}: {
  onAdd: (prediction: PredictionWithFixture) => void;
  prediction: PredictionWithFixture | null;
}) {
  if (!prediction) return null;
  const fixture = prediction.fixture;
  return (
    <Panel title="Prediction Details">
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div>
          <h3 className="text-xl font-semibold">{prediction.predictedOutcome}</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-300">{prediction.explanation}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Metric label="Confidence" value={`${prediction.confidenceScore}%`} />
            <Metric label="Risk" value={String(prediction.riskScore)} />
            <Metric label="Value" value={prediction.valueRating} />
          </div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
          <p className="font-semibold text-white">Match context</p>
          <p className="mt-2">Team form: {fixture?.standings.length ? "Available" : "Pending"}</p>
          <p>Head-to-head: {fixture?.headToHeadRecords.length ?? 0} records</p>
          <p>League position: {fixture?.standings[0]?.rank ? "Available" : "Pending"}</p>
          <p>Odds comparison: {prediction.edge ? `${(prediction.edge * 100).toFixed(1)}% edge` : "No edge"}</p>
          <button className="mt-4 w-full rounded-md bg-emerald-300 px-4 py-3 font-semibold text-zinc-950" type="button" onClick={() => onAdd(prediction)}>Add to slip</button>
        </div>
      </div>
    </Panel>
  );
}

function ProfileView({
  onPasswordChange,
  session,
}: {
  onPasswordChange: (event: FormEvent<HTMLFormElement>) => void;
  session: AuthResponse;
}) {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <Panel title="Account Details">
        <dl className="space-y-4 text-sm">
          <ProfileRow label="Name" value={session.user.name} />
          <ProfileRow label="Email" value={session.user.email} />
          <ProfileRow label="Role" value={roleLabels[session.user.role]} />
          <ProfileRow label="Account status" value={session.user.status} />
          <ProfileRow label="Subscription plan" value="Subscriber Preview" />
          <ProfileRow label="Subscription status" value="Active platform access" />
          <ProfileRow label="Expiry date" value="Not set" />
        </dl>
      </Panel>
      <Panel title="Password Change">
        <form className="space-y-4" onSubmit={onPasswordChange}>
          <TextField label="Current password" name="currentPassword" type="password" />
          <TextField label="New password" name="newPassword" type="password" />
          <SubmitButton>Update password</SubmitButton>
        </form>
      </Panel>
    </div>
  );
}

function OpportunityCards({
  onAdd,
  onSelect,
  predictions,
}: {
  onAdd: (prediction: PredictionWithFixture) => void;
  onSelect?: (prediction: PredictionWithFixture) => void;
  predictions: PredictionWithFixture[];
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {predictions.map((prediction) => (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={prediction.id}>
          <p className="text-xs uppercase tracking-[0.12em] text-emerald-300">{prediction.valueRating} value</p>
          <h3 className="mt-2 font-semibold">{prediction.predictedOutcome}</h3>
          <p className="mt-2 text-sm text-zinc-400">{prediction.fixture ? `${prediction.fixture.homeTeamName} vs ${prediction.fixture.awayTeamName}` : prediction.recommendedMarket}</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <MiniStat label="Conf" value={`${prediction.confidenceScore}%`} />
            <MiniStat label="Risk" value={String(prediction.riskScore)} />
            <MiniStat label="Edge" value={prediction.edge ? `${(prediction.edge * 100).toFixed(1)}%` : "-"} />
          </div>
          <div className="mt-4 flex gap-2">
            <button className="flex-1 rounded-md bg-emerald-300 px-3 py-2 text-sm font-semibold text-zinc-950" type="button" onClick={() => onAdd(prediction)}>Add</button>
            {onSelect ? <button className="flex-1 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200" type="button" onClick={() => onSelect(prediction)}>Details</button> : null}
          </div>
        </div>
      ))}
      {!predictions.length ? <p className="text-sm text-zinc-400">No approved predictions are available yet.</p> : null}
    </div>
  );
}

function CompactPredictionList({ predictions }: { predictions: PredictionWithFixture[] }) {
  return (
    <div className="space-y-2">
      {predictions.map((prediction) => (
        <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3" key={prediction.id}>
          <p className="font-semibold">{prediction.predictedOutcome}</p>
          <p className="mt-1 text-sm text-zinc-400">Confidence {prediction.confidenceScore}% · Risk {prediction.riskScore}</p>
        </div>
      ))}
      {!predictions.length ? <p className="text-sm text-zinc-400">Approved predictions will appear here after review.</p> : null}
    </div>
  );
}

function Panel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4 shadow-xl shadow-black/10">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-zinc-900 p-2">
      <p className="text-zinc-500">{label}</p>
      <p className="font-semibold text-white">{value}</p>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="mt-1 font-medium text-white">{value}</dd>
    </div>
  );
}

function ModeButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button className={`rounded px-3 py-2 font-medium transition ${active ? "bg-white text-zinc-950" : "text-zinc-400 hover:text-white"}`} type="button" onClick={onClick}>
      {children}
    </button>
  );
}

function TextField({
  label,
  name,
  onChange,
  type,
  value,
}: {
  label: string;
  name: string;
  onChange?: (value: string) => void;
  type: string;
  value?: string;
}) {
  return (
    <label className="block text-sm font-medium text-zinc-200">
      {label}
      <input
        className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none transition focus:border-emerald-300"
        name={name}
        onChange={(event) => onChange?.(event.target.value)}
        required={!onChange}
        type={type}
        value={value}
      />
    </label>
  );
}

function SubmitButton({ children }: { children: string }) {
  return (
    <button className="w-full rounded-md bg-emerald-300 px-4 py-3 font-semibold text-zinc-950 transition hover:bg-emerald-200" type="submit">
      {children}
    </button>
  );
}
