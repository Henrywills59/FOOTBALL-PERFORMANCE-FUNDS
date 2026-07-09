import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type {
  AdminOverview,
  AdminReports,
  AdminSettings,
  AdminUser,
  AnalystAssignment,
  AnalystAssistance,
  AnalystDashboard,
  AnalystIntelligenceSubmission,
  AuditLogEntry,
  AuthResponse,
  AuthUser,
  DecisionEngineOutput,
  FootballFixtureDetail,
  FootballFixtureSummary,
  InvestmentPlan,
  InvestorDashboard,
  InvestorInvestment,
  InvestorReport,
  InvestorWallet,
  PredictionResult,
  PublishedIntelligence,
  PlatformHealth,
  PublicUserRole,
  SubscriberCommandCenter,
  SubscriberIntelligenceFeedItem,
  SubscriberNotification,
  SubscriberOpportunity,
  SubscriberReport,
  WithdrawalRequest,
} from "./types";
import { PUBLIC_USER_ROLES } from "./types";

function normalizeApiBaseUrl(value?: string) {
  const trimmed = value?.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return trimmed.replace(/\/api$/i, "");
}

const apiUrl = normalizeApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    "https://football-performance-funds-backend.vercel.app",
);

function apiEndpoint(path: string) {
  return `${apiUrl}/api${path.startsWith("/") ? path : `/${path}`}`;
}

function backendEndpoint(path: string) {
  return `${apiUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function sameOriginApiEndpoint(path: string) {
  return `/api${path.startsWith("/") ? path : `/${path}`}`;
}

async function fetchJson<T>(url: string, init?: RequestInit, fallbackUrl?: string) {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    if (fallbackUrl) return fetchJson<T>(fallbackUrl, init);
    throw new Error(
      `Unable to reach Football Performance Fund API at ${url}. ${
        error instanceof Error ? error.message : "Network request failed"
      }`,
    );
  }

  const data = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new Error(data.error ?? `Request failed with HTTP ${response.status}`);
  return data as T;
}
const navItems = [
  "Subscriber Home",
  "Opportunity Center",
  "Live Intelligence Feed",
  "Performance Center",
  "Live Match Center",
  "Intelligence Reports",
  "Profile",
  "Notifications",
  "Referral Program",
] as const;
const adminNavItems = ["Admin Dashboard", "Prediction Review", "Intelligence Review", "Reports", "Monitoring", "Fixture Management", "User Management", "Audit Logs", "Settings"] as const;
const investorNavItemsWithWallet = ["Investor Dashboard", "Wallet", "Investment Plans", "Portfolio", "Investor Reports", "Withdrawals"] as const;
const analystNavItems = ["Analyst Dashboard", "Submit Intelligence"] as const;

type AuthMode = "login" | "register" | "forgot";
type NavItem = (typeof navItems)[number];
type AdminNavItem = (typeof adminNavItems)[number];
type InvestorNavItem = (typeof investorNavItemsWithWallet)[number];
type AnalystNavItem = (typeof analystNavItems)[number];
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
  const [activeView, setActiveView] = useState<NavItem>("Subscriber Home");
  const [activeAdminView, setActiveAdminView] = useState<AdminNavItem>("Admin Dashboard");
  const [activeInvestorView, setActiveInvestorView] = useState<InvestorNavItem>("Investor Dashboard");
  const [activeAnalystView, setActiveAnalystView] = useState<AnalystNavItem>("Analyst Dashboard");
  const [adminMode, setAdminMode] = useState(() => getStoredSession()?.user.role === "ADMIN");
  const [message, setMessage] = useState("");
  const [apiCheck, setApiCheck] = useState(`Backend API: ${apiUrl}`);
  const [error, setError] = useState("");
  const [fixtures, setFixtures] = useState<FootballFixtureSummary[]>([]);
  const [liveFixtures, setLiveFixtures] = useState<FootballFixtureSummary[]>([]);
  const [selectedFixture, setSelectedFixture] = useState<FootballFixtureDetail | null>(null);
  const [predictions, setPredictions] = useState<PredictionWithFixture[]>([]);
  const [selectedPrediction, setSelectedPrediction] = useState<PredictionWithFixture | null>(null);
  const [slip, setSlip] = useState<PredictionWithFixture[]>([]);
  const [filters, setFilters] = useState({ search: "", league: "", country: "", date: "" });
  const [loadingLabel, setLoadingLabel] = useState("Loading");
  const [adminOverview, setAdminOverview] = useState<AdminOverview | null>(null);
  const [adminPredictions, setAdminPredictions] = useState<PredictionResult[]>([]);
  const [adminDecisionOutputs, setAdminDecisionOutputs] = useState<DecisionEngineOutput[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [syncLogs, setSyncLogs] = useState<AuditLogEntry[]>([]);
  const [adminSettings, setAdminSettings] = useState<AdminSettings | null>(null);
  const [adminReports, setAdminReports] = useState<AdminReports | null>(null);
  const [platformHealth, setPlatformHealth] = useState<PlatformHealth | null>(null);
  const [investorDashboard, setInvestorDashboard] = useState<InvestorDashboard | null>(null);
  const [investmentPlans, setInvestmentPlans] = useState<InvestmentPlan[]>([]);
  const [portfolio, setPortfolio] = useState<{ active: InvestorInvestment[]; completed: InvestorInvestment[] }>({ active: [], completed: [] });
  const [investorReports, setInvestorReports] = useState<InvestorReport[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [wallet, setWallet] = useState<InvestorWallet | null>(null);
  const [publishedIntelligence, setPublishedIntelligence] = useState<PublishedIntelligence[]>([]);
  const [analystDashboard, setAnalystDashboard] = useState<AnalystDashboard | null>(null);
  const [analystAssignments, setAnalystAssignments] = useState<AnalystAssignment[]>([]);
  const [analystSubmissions, setAnalystSubmissions] = useState<AnalystIntelligenceSubmission[]>([]);
  const [analystAssistance, setAnalystAssistance] = useState<AnalystAssistance | null>(null);
  const [adminIntelligence, setAdminIntelligence] = useState<AnalystIntelligenceSubmission[]>([]);
  const [subscriberCommandCenter, setSubscriberCommandCenter] = useState<SubscriberCommandCenter | null>(null);
  const [decisionOutputs, setDecisionOutputs] = useState<DecisionEngineOutput[]>([]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    const loadSessionData = async () => {
      if (session.user.role === "ADMIN") {
        await loadAdminData(session.token);
        if (!cancelled) await loadSubscriberData(session.token);
        return;
      }

      if (session.user.role === "SUBSCRIBER") await loadSubscriberData(session.token);
      if (session.user.role === "INVESTOR") await loadInvestorData(session.token);
      if (session.user.role === "ANALYST") await loadAnalystData(session.token);
    };

    void loadSessionData();

    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!session || !["SUBSCRIBER", "ADMIN"].includes(session.user.role)) return;
    const refreshLive = () => void loadLiveFixtures(session.token);
    refreshLive();
    const timer = window.setInterval(refreshLive, 30000);
    return () => window.clearInterval(timer);
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

  const upcomingFixtures = useMemo(
    () =>
      fixtures
        .filter((fixture) => fixture.status === "SCHEDULED" && new Date(fixture.kickoffAt).getTime() >= Date.now())
        .slice(0, 6),
    [fixtures],
  );

  const notifications = useMemo(() => {
    const soon = fixtures.filter((fixture) => {
      const minutes = (new Date(fixture.kickoffAt).getTime() - Date.now()) / 60000;
      return fixture.status === "SCHEDULED" && minutes >= 0 && minutes <= 60;
    });
    return [
      ...publishedIntelligence.slice(0, 3).map((item) => `New FPF Intelligence published for ${item.match}.`),
      ...soon.slice(0, 3).map((fixture) => `${fixture.homeTeamName} vs ${fixture.awayTeamName} starts soon.`),
      ...liveFixtures.slice(0, 2).map((fixture) => `Live opportunity alert: ${fixture.homeTeamName} vs ${fixture.awayTeamName}.`),
      "Subscription reminder: subscriber access is active.",
    ];
  }, [fixtures, liveFixtures, publishedIntelligence]);

  const investorNotifications = useMemo(() => {
    const walletItems = wallet?.transactions.slice(0, 3).map((transaction) => `Wallet ${transaction.type.toLowerCase()} is ${transaction.status.toLowerCase()}.`) ?? [];
    return [...walletItems, "Subscription expiry reminder: review account access before renewal."];
  }, [wallet]);

  function storeSession(nextSession: AuthResponse, rememberMe: boolean) {
    const serialized = JSON.stringify(nextSession);
    sessionStorage.removeItem("fpf_session");
    localStorage.removeItem("fpf_session");
    if (rememberMe) localStorage.setItem("fpf_session", serialized);
    else sessionStorage.setItem("fpf_session", serialized);
    setAdminMode(nextSession.user.role === "ADMIN");
    setActiveAdminView("Admin Dashboard");
    setActiveInvestorView("Investor Dashboard");
    setActiveAnalystView("Analyst Dashboard");
    setActiveView("Subscriber Home");
    setSession(nextSession);
  }

  async function postPublic(path: string, body: object) {
    return fetchJson(
      apiEndpoint(path),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      sameOriginApiEndpoint(path),
    );
  }

  async function testApiConnection() {
    setApiCheck(`Checking ${apiEndpoint("/health")} ...`);
    try {
      const data = await fetchJson<{ status: string }>(
        apiEndpoint("/health"),
        undefined,
        sameOriginApiEndpoint("/health"),
      );
      setApiCheck(`Backend API OK: ${apiEndpoint("/health")} returned ${data.status}`);
    } catch (caughtError) {
      setApiCheck(
        `Backend API failed: ${apiEndpoint("/health")} - ${
          caughtError instanceof Error ? caughtError.message : "Unable to connect"
        }`,
      );
    }
  }

  async function apiGet<T>(path: string, token: string) {
    return fetchJson<T>(
      apiEndpoint(path),
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
  }

  async function apiPost<T>(path: string, token: string, body?: object) {
    return fetchJson<T>(
      apiEndpoint(path),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
  }

  async function loadSubscriberData(token: string) {
    try {
      setLoadingLabel("Loading subscriber platform");
      const commandCenter = await apiGet<SubscriberCommandCenter>("/intelligence/dashboard", token);
      const fixtureData = await apiGet<{ fixtures: FootballFixtureSummary[] }>("/intelligence/fixtures?limit=30", token);
      const liveData = await apiGet<{ fixtures: FootballFixtureSummary[] }>("/intelligence/live?limit=20", token);
      const decisionData = await apiGet<{ decisions: DecisionEngineOutput[] }>("/intelligence/decision/opportunities?limit=12", token);
      const approvedData = await apiGet<{ predictions: PredictionResult[] }>("/predictions/approved", token);
      const intelligenceData = await apiGet<{ intelligence: PublishedIntelligence[] }>("/intelligence/published", token);
      setSubscriberCommandCenter(commandCenter);
      setFixtures(fixtureData.fixtures);
      setLiveFixtures(liveData.fixtures);
      setDecisionOutputs(decisionData.decisions);
      setPublishedIntelligence(intelligenceData.intelligence);
      if (fixtureData.fixtures[0]) await loadFixtureDetail(fixtureData.fixtures[0].id, token);

      const enriched = await Promise.all(
        approvedData.predictions.map(async (prediction) => {
          try {
            const detail = await apiGet<{ intelligence: { fixture: FootballFixtureDetail | null } }>(
              `/intelligence/match/${prediction.fixtureId}`,
              token,
            );
            return detail.intelligence.fixture ? { ...prediction, fixture: detail.intelligence.fixture } : prediction;
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

  async function loadAdminData(token: string) {
    try {
      const overview = await apiGet<AdminOverview>("/admin/overview", token);
      const predictionsData = await apiGet<{ predictions: PredictionResult[] }>("/admin/predictions", token);
      const usersData = await apiGet<{ users: AdminUser[] }>("/admin/users", token);
      const logsData = await apiGet<{ logs: AuditLogEntry[] }>("/admin/audit-logs", token);
      const settingsData = await apiGet<AdminSettings>("/admin/settings", token);
      const syncData = await apiGet<{ logs: AuditLogEntry[] }>("/admin/fixtures/sync-logs", token);
      const intelligenceData = await apiGet<{ submissions: AnalystIntelligenceSubmission[] }>("/admin/intelligence", token);
      const reportsData = await apiGet<AdminReports>("/admin/reports", token);
      const monitoringData = await apiGet<PlatformHealth>("/admin/monitoring", token);
      const decisionData = await apiGet<{ decisions: DecisionEngineOutput[] }>("/intelligence/decision/opportunities?limit=12", token);
      setAdminOverview(overview);
      setAdminPredictions(predictionsData.predictions);
      setAdminDecisionOutputs(decisionData.decisions);
      setAdminUsers(usersData.users);
      setAuditLogs(logsData.logs);
      setAdminSettings(settingsData);
      setSyncLogs(syncData.logs);
      setAdminIntelligence(intelligenceData.submissions);
      setAdminReports(reportsData);
      setPlatformHealth(monitoringData);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load admin portal");
    }
  }

  async function loadInvestorData(token: string) {
    try {
      const [dashboard, plans, portfolioData, reports, withdrawalData, walletData] = await Promise.all([
        apiGet<InvestorDashboard>("/investor/dashboard", token),
        apiGet<{ plans: InvestmentPlan[] }>("/investor/plans", token),
        apiGet<{ active: InvestorInvestment[]; completed: InvestorInvestment[] }>("/investor/portfolio", token),
        apiGet<{ reports: InvestorReport[] }>("/investor/reports", token),
        apiGet<{ withdrawals: WithdrawalRequest[] }>("/investor/withdrawals", token),
        apiGet<InvestorWallet>("/wallet", token),
      ]);
      setInvestorDashboard(dashboard);
      setInvestmentPlans(plans.plans);
      setPortfolio(portfolioData);
      setInvestorReports(reports.reports);
      setWithdrawals(withdrawalData.withdrawals);
      setWallet(walletData);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load investor portal");
    }
  }

  async function loadLiveFixtures(token: string) {
    try {
      const data = await apiGet<{ fixtures: FootballFixtureSummary[] }>("/intelligence/live?limit=20", token);
      setLiveFixtures(data.fixtures);
    } catch {
      setLiveFixtures((current) => current);
    }
  }

  async function loadAnalystData(token: string) {
    try {
      const [dashboard, assignmentsData, submissionsData, fixtureData] = await Promise.all([
        apiGet<AnalystDashboard>("/analyst/dashboard", token),
        apiGet<{ assignments: AnalystAssignment[] }>("/analyst/assignments", token),
        apiGet<{ submissions: AnalystIntelligenceSubmission[] }>("/analyst/intelligence", token),
        apiGet<{ fixtures: FootballFixtureSummary[] }>("/intelligence/fixtures?limit=30", token),
      ]);
      setAnalystDashboard(dashboard);
      setAnalystAssignments(assignmentsData.assignments);
      setAnalystSubmissions(submissionsData.submissions);
      setFixtures(fixtureData.fixtures);
      setLoadingLabel("Analyst workspace ready");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load analyst workspace");
    }
  }

  async function investorAction(path: string, body: object) {
    if (!session) return;
    await apiPost(path, session.token, body);
    await loadInvestorData(session.token);
  }

  async function adminAction(path: string, body?: object) {
    if (!session) return;
    const method = path.includes("/settings") || path.includes("/notes") ? "PATCH" : "POST";
    await fetchJson(
      apiEndpoint(path),
      {
        method,
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    await loadAdminData(session.token);
    if (session.user.role === "ADMIN") await loadSubscriberData(session.token);
  }

  async function analystAction(path: string, body?: object) {
    if (!session) return;
    await fetchJson(
      apiEndpoint(path),
      {
        method: path.includes("/intelligence/") && !path.endsWith("/submit") ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    await loadAnalystData(session.token);
  }

  async function loadAnalystAssistance(fixtureId: string) {
    if (!session) return;
    const assistance = await apiGet<AnalystAssistance>(`/analyst/fixtures/${fixtureId}/assistance`, session.token);
    setAnalystAssistance(assistance);
  }

  async function loadFixtureDetail(id: string, token = session?.token) {
    if (!token) return;
    const data = await apiGet<{ intelligence: { fixture: FootballFixtureDetail | null } }>(`/intelligence/match/${id}`, token);
    setSelectedFixture(data.intelligence.fixture);
  }

  async function loadFilteredFixtures(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!session) return;
    const params = new URLSearchParams({ limit: "30" });
    if (filters.search) params.set("search", filters.search);
    if (filters.league) params.set("league", filters.league);
    if (filters.date) params.set("date", filters.date);
    const data = await apiGet<{ fixtures: FootballFixtureSummary[] }>(`/intelligence/fixtures?${params.toString()}`, session.token);
    setFixtures(
      filters.country
        ? data.fixtures.filter((fixture) =>
            (fixture.leagueCountry ?? "").toLowerCase().includes(filters.country.toLowerCase()),
          )
        : data.fixtures,
    );
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
            apiCheck={apiCheck}
            apiUrl={apiUrl}
            error={error}
            message={message}
            mode={mode}
            onApiTest={testApiConnection}
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
  const navigationItems = adminMode
    ? adminNavItems
    : session.user.role === "INVESTOR"
      ? investorNavItemsWithWallet
      : session.user.role === "ANALYST"
        ? analystNavItems
      : navItems;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col lg:flex-row">
        <aside className="border-b border-zinc-800 bg-zinc-950/95 px-4 py-4 lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:border-b-0 lg:border-r lg:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">FPF Subscriber</p>
            <h1 className="mt-2 text-xl font-bold">Command Center</h1>
          </div>
          <nav className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-1">
            {navigationItems.map((item) => (
              <button
                className={`rounded-md px-3 py-3 text-left text-sm font-medium transition ${
                  (adminMode
                    ? activeAdminView === item
                    : session.user.role === "INVESTOR"
                      ? activeInvestorView === item
                      : session.user.role === "ANALYST"
                        ? activeAnalystView === item
                      : activeView === item)
                    ? "bg-emerald-300 text-zinc-950"
                    : "bg-zinc-900 text-zinc-300 hover:text-white"
                }`}
                key={item}
                type="button"
                onClick={() =>
                  adminMode
                    ? setActiveAdminView(item as AdminNavItem)
                    : session.user.role === "INVESTOR"
                      ? setActiveInvestorView(item as InvestorNavItem)
                      : session.user.role === "ANALYST"
                        ? setActiveAnalystView(item as AnalystNavItem)
                      : setActiveView(item as NavItem)
                }
              >
                {item}
              </button>
            ))}
          </nav>
          {session.user.role === "ADMIN" ? (
            <button
              className="mt-4 w-full rounded-md border border-emerald-800 px-3 py-3 text-sm text-emerald-200 transition hover:border-emerald-300"
              type="button"
              onClick={() => setAdminMode((current) => !current)}
            >
              {adminMode ? "Subscriber View" : "Admin Portal"}
            </button>
          ) : null}
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

          {adminMode ? (
            <AdminPortal
              activeView={activeAdminView}
              auditLogs={auditLogs}
              fixtures={fixtures}
              decisions={adminDecisionOutputs}
              overview={adminOverview}
              predictions={adminPredictions}
              intelligence={adminIntelligence}
              reports={adminReports}
              settings={adminSettings}
              health={platformHealth}
              syncLogs={syncLogs}
              users={adminUsers}
              onAction={adminAction}
            />
          ) : null}

          {!adminMode && session.user.role === "ANALYST" ? (
            <AnalystPortal
              activeView={activeAnalystView}
              assignments={analystAssignments}
              assistance={analystAssistance}
              dashboard={analystDashboard}
              fixtures={fixtures}
              submissions={analystSubmissions}
              onAction={analystAction}
              onAssistance={loadAnalystAssistance}
            />
          ) : null}

          {!adminMode && session.user.role === "INVESTOR" ? (
            <InvestorPortal
              activeView={activeInvestorView}
              dashboard={investorDashboard}
              plans={investmentPlans}
              portfolio={portfolio}
              reports={investorReports}
              wallet={wallet}
              withdrawals={withdrawals}
              notifications={investorNotifications}
              onAction={investorAction}
            />
          ) : null}

          {!adminMode && session.user.role !== "INVESTOR" && session.user.role !== "ANALYST" && activeView === "Subscriber Home" ? (
            <DashboardView
              commandCenter={subscriberCommandCenter}
              decisions={decisionOutputs}
              featured={featured}
              intelligence={publishedIntelligence}
              liveFixtures={liveFixtures}
              notifications={notifications}
              predictions={predictions}
              recent={recent}
              upcomingFixtures={upcomingFixtures}
              onAdd={addToSlip}
            />
          ) : null}
          {!adminMode && session.user.role !== "INVESTOR" && session.user.role !== "ANALYST" && activeView === "Opportunity Center" ? (
            <OpportunityCenterView
              commandCenter={subscriberCommandCenter}
              decisions={decisionOutputs}
              filters={filters}
              fixtures={fixtures}
              intelligence={publishedIntelligence}
              predictions={daily}
              selectedFixture={selectedFixture}
              setFilters={setFilters}
              onAdd={addToSlip}
              onFilter={loadFilteredFixtures}
              onSelectFixture={(id) => void loadFixtureDetail(id)}
              onSelectPrediction={setSelectedPrediction}
            />
          ) : null}
          {!adminMode && session.user.role !== "INVESTOR" && session.user.role !== "ANALYST" && activeView === "Live Intelligence Feed" ? (
            <LiveIntelligenceFeedView feed={subscriberCommandCenter?.liveIntelligenceFeed ?? []} />
          ) : null}
          {!adminMode && session.user.role !== "INVESTOR" && session.user.role !== "ANALYST" && activeView === "Performance Center" ? (
            <PerformanceView commandCenter={subscriberCommandCenter} predictions={predictions} intelligence={publishedIntelligence} fixtures={fixtures} />
          ) : null}
          {!adminMode && session.user.role !== "INVESTOR" && session.user.role !== "ANALYST" && activeView === "Live Match Center" ? (
            <LiveMatchCenter
              fixtures={liveFixtures}
              predictions={predictions}
              selectedFixture={selectedFixture}
              onSelectFixture={(id) => void loadFixtureDetail(id)}
            />
          ) : null}
          {!adminMode && session.user.role !== "INVESTOR" && session.user.role !== "ANALYST" && activeView === "Intelligence Reports" ? (
            <ReportsView reports={subscriberCommandCenter?.reports ?? []} />
          ) : null}
          {!adminMode && session.user.role !== "INVESTOR" && session.user.role !== "ANALYST" && activeView === "Profile" ? (
            <ProfileView session={session} onPasswordChange={safelySubmit(handlePasswordChange)} />
          ) : null}
          {!adminMode && session.user.role !== "INVESTOR" && session.user.role !== "ANALYST" && activeView === "Notifications" ? (
            <NotificationCenterView notifications={subscriberCommandCenter?.notifications ?? []} />
          ) : null}
          {!adminMode && session.user.role !== "INVESTOR" && session.user.role !== "ANALYST" && activeView === "Referral Program" ? (
            <ReferralView referral={subscriberCommandCenter?.referral ?? null} />
          ) : null}

          {!adminMode && session.user.role !== "INVESTOR" && session.user.role !== "ANALYST" && ["Opportunity Center", "Live Match Center"].includes(activeView) ? (
            <PredictionDetail prediction={selectedPrediction} onAdd={addToSlip} />
          ) : null}
        </section>
      </div>
    </main>
  );
}

function AdminPortal({
  activeView,
  auditLogs,
  decisions,
  fixtures,
  health,
  intelligence,
  onAction,
  overview,
  predictions,
  reports,
  settings,
  syncLogs,
  users,
}: {
  activeView: AdminNavItem;
  auditLogs: AuditLogEntry[];
  decisions: DecisionEngineOutput[];
  fixtures: FootballFixtureSummary[];
  health: PlatformHealth | null;
  intelligence: AnalystIntelligenceSubmission[];
  onAction: (path: string, body?: object) => Promise<void>;
  overview: AdminOverview | null;
  predictions: PredictionResult[];
  reports: AdminReports | null;
  settings: AdminSettings | null;
  syncLogs: AuditLogEntry[];
  users: AdminUser[];
}) {
  const pending = predictions.filter((prediction) => prediction.approvalStatus === "PENDING");

  if (activeView === "Admin Dashboard") {
    return (
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total users" value={String(overview?.totalUsers ?? 0)} />
        <Metric label="Active subscribers" value={String(overview?.activeSubscribers ?? 0)} />
        <Metric label="Active investors" value={String(overview?.activeInvestors ?? 0)} />
        <Metric label="Today's fixtures" value={String(overview?.todaysFixtures ?? 0)} />
        <Metric label="Pending predictions" value={String(overview?.pendingPredictions ?? pending.length)} />
        <Metric label="Approved predictions" value={String(overview?.approvedPredictions ?? 0)} />
        <Metric label="System health" value={overview?.systemHealth ?? "OK"} />
      </div>
    );
  }

  if (activeView === "Prediction Review") {
    return (
      <Panel title="Prediction Review">
        <div className="space-y-3">
          <DecisionOutputCards decisions={decisions} compact />
          {predictions.map((prediction) => (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={prediction.id}>
              <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-emerald-300">{prediction.approvalStatus}</p>
                  <h3 className="mt-2 text-lg font-semibold">{prediction.predictedOutcome}</h3>
                  <p className="mt-2 text-sm text-zinc-400">{prediction.explanation}</p>
                  <p className="mt-2 text-sm text-zinc-500">{prediction.adminNotes ?? "No admin notes yet."}</p>
                </div>
                <div className="grid gap-2 text-sm">
                  <MiniStat label="Confidence" value={`${prediction.confidenceScore}%`} />
                  <MiniStat label="Risk" value={String(prediction.riskScore)} />
                  <MiniStat label="Value" value={prediction.valueRating} />
                </div>
              </div>
              <form
                className="mt-3 flex flex-col gap-2 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void onAction(`/admin/predictions/${prediction.id}/notes`, {
                    adminNotes: form.get("adminNotes"),
                  });
                }}
              >
                <input className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white" name="adminNotes" placeholder="Edit prediction notes" />
                <button className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200" type="submit">Save notes</button>
              </form>
              <div className="mt-3 flex gap-2">
                <button className="rounded-md bg-emerald-300 px-3 py-2 text-sm font-semibold text-zinc-950" type="button" onClick={() => void onAction(`/admin/predictions/${prediction.id}/approve`)}>Approve</button>
                <button className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200" type="button" onClick={() => void onAction(`/admin/predictions/${prediction.id}/reject`)}>Reject</button>
              </div>
            </div>
          ))}
          {!predictions.length ? <p className="text-sm text-zinc-400">No generated predictions yet.</p> : null}
        </div>
      </Panel>
    );
  }

  if (activeView === "Reports") {
    return <AdminReportsView reports={reports} />;
  }

  if (activeView === "Monitoring") {
    return (
      <div className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="API health" value={health?.api ?? "OK"} />
          <Metric label="Database" value={health?.database ?? "OK"} />
          <Metric label="Football jobs" value={health?.footballJobs ?? "STOPPED"} />
          <Metric label="Last sync" value={health?.lastSyncAt ? new Date(health.lastSyncAt).toLocaleString() : "Pending"} />
        </div>
        <Panel title="Scheduled Job Monitoring">
          <CompactAuditList logs={syncLogs} emptyLabel="No scheduled job logs yet." />
        </Panel>
      </div>
    );
  }

  if (activeView === "Intelligence Review") {
    return (
      <Panel title="FPF Intelligence Review">
        <form
          className="mb-4 grid gap-3 lg:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void onAction("/admin/intelligence/assign", {
              analystId: form.get("analystId"),
              fixtureId: form.get("fixtureId"),
              leagueName: form.get("leagueName"),
              adminNotes: form.get("adminNotes"),
            });
          }}
        >
          <TextField label="Analyst user ID" name="analystId" type="text" />
          <TextField label="Fixture ID" name="fixtureId" type="text" />
          <TextField label="League" name="leagueName" type="text" />
          <TextField label="Admin notes" name="adminNotes" type="text" />
          <div className="lg:col-span-4">
            <SubmitButton>Assign match</SubmitButton>
          </div>
        </form>
        <div className="space-y-3">
          {intelligence.map((submission) => (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={submission.id}>
              <p className="text-xs uppercase tracking-[0.12em] text-emerald-300">{submission.status}</p>
              <h3 className="mt-2 text-lg font-semibold">{submission.match}</h3>
              <p className="mt-1 text-sm text-zinc-400">{submission.market} · {submission.prediction}</p>
              <p className="mt-2 text-sm text-zinc-300">{submission.detailedReasoning}</p>
              <p className="mt-2 text-sm text-zinc-500">Sources: {submission.sourceNotes}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <MiniStat label="Confidence" value={`${submission.confidence}%`} />
                <MiniStat label="Risk" value={submission.riskLevel} />
                <MiniStat label="Stake" value={submission.recommendedStake} />
              </div>
              <form
                className="mt-3 flex flex-col gap-2 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void onAction(`/admin/intelligence/${submission.id}/notes`, {
                    adminNotes: form.get("adminNotes"),
                  });
                }}
              >
                <input className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white" name="adminNotes" placeholder="Internal admin notes" />
                <button className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200" type="submit">Save notes</button>
              </form>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="rounded-md bg-emerald-300 px-3 py-2 text-sm font-semibold text-zinc-950" type="button" onClick={() => void onAction(`/admin/intelligence/${submission.id}/approve`)}>Approve</button>
                <button className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200" type="button" onClick={() => void onAction(`/admin/intelligence/${submission.id}/reject`)}>Reject</button>
                <button className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200" type="button" onClick={() => void onAction(`/admin/intelligence/${submission.id}/request-revision`, { adminNotes: "Revision requested by admin." })}>Request revision</button>
                <button className="rounded-md border border-emerald-700 px-3 py-2 text-sm text-emerald-200" type="button" onClick={() => void onAction(`/admin/intelligence/${submission.id}/publish`)}>Publish</button>
                <button className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200" type="button" onClick={() => void onAction(`/admin/intelligence/${submission.id}/withdraw`)}>Withdraw</button>
              </div>
            </div>
          ))}
          {!intelligence.length ? <p className="text-sm text-zinc-400">No analyst intelligence submissions yet.</p> : null}
        </div>
      </Panel>
    );
  }

  if (activeView === "Fixture Management") {
    return (
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Synchronized Fixtures">
          <button className="mb-4 rounded-md bg-emerald-300 px-3 py-2 text-sm font-semibold text-zinc-950" type="button" onClick={() => void onAction("/admin/fixtures/sync")}>Force manual sync</button>
          <CompactFixtureList fixtures={fixtures} />
        </Panel>
        <Panel title="Sync Logs & API Status">
          <CompactAuditList logs={syncLogs} emptyLabel="No sync logs yet." />
        </Panel>
      </div>
    );
  }

  if (activeView === "User Management") {
    return (
      <Panel title="User Management">
        <div className="space-y-3">
          {users.map((user) => (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={user.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{user.name}</p>
                  <p className="text-sm text-zinc-400">{user.email} · {user.role} · {user.status}</p>
                  <p className="text-sm text-zinc-500">Subscription: {user.subscriptionPlan}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200" type="button" onClick={() => void onAction(`/admin/users/${user.id}/suspend`)}>Suspend</button>
                  <button className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200" type="button" onClick={() => void onAction(`/admin/users/${user.id}/activate`)}>Activate</button>
                  <button className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200" type="button" onClick={() => void onAction(`/admin/users/${user.id}/reset-password`)}>Reset password</button>
                  <button className="rounded-md bg-emerald-300 px-3 py-2 text-sm font-semibold text-zinc-950" type="button" onClick={() => void onAction(`/admin/users/${user.id}/role`, { role: "SUBSCRIBER" })}>Subscriber</button>
                </div>
              </div>
            </div>
          ))}
          {!users.length ? <p className="text-sm text-zinc-400">No users found.</p> : null}
        </div>
      </Panel>
    );
  }

  if (activeView === "Audit Logs") {
    return (
      <Panel title="Audit Logs">
        <CompactAuditList logs={auditLogs} emptyLabel="No audit logs yet." />
      </Panel>
    );
  }

  return (
    <Panel title="Settings">
      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void onAction("/admin/settings", {
            predictionConfidenceThreshold: Number(form.get("predictionConfidenceThreshold")),
            riskThreshold: Number(form.get("riskThreshold")),
            maximumSelections: Number(form.get("maximumSelections")),
            scheduledSyncEnabled: form.get("scheduledSyncEnabled") === "on",
            maintenanceMode: form.get("maintenanceMode") === "on",
          });
        }}
      >
        <TextField label="Prediction confidence threshold" name="predictionConfidenceThreshold" type="number" value={String(settings?.predictionConfidenceThreshold ?? 60)} />
        <TextField label="Risk threshold" name="riskThreshold" type="number" value={String(settings?.riskThreshold ?? 70)} />
        <TextField label="Maximum selections" name="maximumSelections" type="number" value={String(settings?.maximumSelections ?? 5)} />
        <label className="flex items-center gap-3 text-sm text-zinc-300"><input name="scheduledSyncEnabled" defaultChecked={settings?.scheduledSyncEnabled} type="checkbox" /> Enable scheduled sync</label>
        <label className="flex items-center gap-3 text-sm text-zinc-300"><input name="maintenanceMode" defaultChecked={settings?.maintenanceMode} type="checkbox" /> Enable maintenance mode</label>
        <div className="md:col-span-2"><SubmitButton>Save settings</SubmitButton></div>
      </form>
    </Panel>
  );
}

function AnalystPortal({
  activeView,
  assignments,
  assistance,
  dashboard,
  fixtures,
  onAction,
  onAssistance,
  submissions,
}: {
  activeView: AnalystNavItem;
  assignments: AnalystAssignment[];
  assistance: AnalystAssistance | null;
  dashboard: AnalystDashboard | null;
  fixtures: FootballFixtureSummary[];
  onAction: (path: string, body?: object) => Promise<void>;
  onAssistance: (fixtureId: string) => Promise<void>;
  submissions: AnalystIntelligenceSubmission[];
}) {
  if (activeView === "Analyst Dashboard") {
    return (
      <div className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <Metric label="Assigned matches" value={String(dashboard?.assignedMatches.length ?? 0)} />
          <Metric label="Assigned leagues" value={String(dashboard?.assignedLeagues.length ?? 0)} />
          <Metric label="Pending tasks" value={String(dashboard?.pendingTasks ?? 0)} />
          <Metric label="Submitted" value={String(dashboard?.submittedIntelligence ?? 0)} />
          <Metric label="Approved" value={String(dashboard?.approvedIntelligence ?? 0)} />
          <Metric label="Rejected" value={String(dashboard?.rejectedIntelligence ?? 0)} />
        </div>
        <Panel title="Assigned Matches">
          <div className="space-y-2">
            {assignments.map((assignment) => (
              <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3" key={assignment.id}>
                <p className="font-semibold">{assignment.match}</p>
                <p className="mt-1 text-sm text-zinc-400">{assignment.leagueName} · {assignment.status}</p>
                {assignment.adminNotes ? <p className="mt-1 text-sm text-zinc-500">{assignment.adminNotes}</p> : null}
              </div>
            ))}
            {!assignments.length ? <p className="text-sm text-zinc-400">No matches have been assigned yet.</p> : null}
          </div>
        </Panel>
        <Panel title="Submitted Intelligence">
          <InternalSubmissionList submissions={submissions} />
        </Panel>
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_360px]">
      <Panel title="Submit Intelligence">
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void onAction("/analyst/intelligence", {
              fixtureId: form.get("fixtureId"),
              leagueName: form.get("leagueName"),
              market: form.get("market"),
              prediction: form.get("prediction"),
              confidence: Number(form.get("confidence")),
              riskLevel: form.get("riskLevel"),
              detailedReasoning: form.get("detailedReasoning"),
              supportingStatistics: form.get("supportingStatistics"),
              sourceNotes: form.get("sourceNotes"),
              briefExplanation: form.get("briefExplanation"),
              recommendedStake: form.get("recommendedStake"),
              status: form.get("status"),
            });
          }}
        >
          <label className="block text-sm font-medium text-zinc-200">
            Match
            <select className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none focus:border-emerald-300" name="fixtureId">
              {assignments.map((assignment) => (
                <option key={assignment.fixtureId} value={assignment.fixtureId}>{assignment.match}</option>
              ))}
            </select>
          </label>
          <TextField label="League" name="leagueName" type="text" value={assignments[0]?.leagueName ?? fixtures[0]?.leagueName ?? ""} />
          <TextField label="Market" name="market" type="text" />
          <TextField label="Prediction" name="prediction" type="text" />
          <TextField label="Confidence" name="confidence" type="number" />
          <TextField label="Risk level" name="riskLevel" type="text" />
          <TextField label="Detailed reasoning" name="detailedReasoning" type="text" />
          <TextField label="Supporting statistics" name="supportingStatistics" type="text" />
          <TextField label="Source notes" name="sourceNotes" type="text" />
          <TextField label="Brief explanation" name="briefExplanation" type="text" />
          <TextField label="Recommended stake" name="recommendedStake" type="text" />
          <label className="block text-sm font-medium text-zinc-200">
            Status
            <select className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none focus:border-emerald-300" name="status" defaultValue="DRAFT">
              <option value="DRAFT">Draft</option>
              <option value="PENDING_REVIEW">Pending Review</option>
            </select>
          </label>
          <SubmitButton>Save intelligence</SubmitButton>
        </form>
      </Panel>
      <Panel title="AI Assistance">
        <div className="space-y-3">
          <button className="w-full rounded-md bg-emerald-300 px-4 py-3 font-semibold text-zinc-950" type="button" onClick={() => assignments[0] ? void onAssistance(assignments[0].fixtureId) : undefined}>
            Load match assistance
          </button>
          {assistance ? (
            <div className="space-y-3 text-sm text-zinc-300">
              <p><span className="font-semibold text-white">Team form:</span> {assistance.teamFormSummary}</p>
              <p><span className="font-semibold text-white">Head-to-head:</span> {assistance.headToHeadSummary}</p>
              <p><span className="font-semibold text-white">Injuries:</span> {assistance.injurySummary}</p>
              <p><span className="font-semibold text-white">Odds:</span> {assistance.oddsMovement}</p>
              <p><span className="font-semibold text-white">Value notes:</span> {assistance.valueOpportunityNotes}</p>
              {assistance.riskWarnings.map((warning) => <p className="rounded-md bg-amber-500/10 p-2 text-amber-100" key={warning}>{warning}</p>)}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">Assistance appears after an assigned match is selected.</p>
          )}
        </div>
      </Panel>
    </div>
  );
}

function AdminReportsView({ reports }: { reports: AdminReports | null }) {
  if (!reports) return <LoadingSkeleton label="Preparing admin reports" />;
  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Subscribers" value={`${reports.subscribers.active}/${reports.subscribers.total}`} />
        <Metric label="Investors" value={`${reports.investors.active}/${reports.investors.total}`} />
        <Metric label="Tracked deposits" value={money(reports.revenue.trackedWalletDepositsCents)} />
        <Metric label="Pending withdrawals" value={`${reports.withdrawals.pendingCount} · ${money(reports.withdrawals.pendingAmountCents)}`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Analyst Performance">
          <div className="grid gap-3 sm:grid-cols-4">
            <MiniStat label="Submitted" value={String(reports.analystPerformance.submitted)} />
            <MiniStat label="Approved" value={String(reports.analystPerformance.approved)} />
            <MiniStat label="Published" value={String(reports.analystPerformance.published)} />
            <MiniStat label="Rejected" value={String(reports.analystPerformance.rejected)} />
          </div>
        </Panel>
        <Panel title="Prediction Accuracy">
          <p className="text-sm text-zinc-300">Approved predictions: {reports.predictionAccuracy.approvedPredictions}</p>
          <p className="mt-2 text-sm text-zinc-300">Published intelligence: {reports.predictionAccuracy.publishedIntelligence}</p>
          <p className="mt-2 text-sm text-zinc-500">{reports.predictionAccuracy.accuracyNote}</p>
        </Panel>
      </div>
      <Panel title="Daily Platform Activity">
        <div className="space-y-2">
          {reports.dailyPlatformActivity.map((day) => (
            <div className="flex justify-between rounded-md border border-zinc-800 bg-zinc-950 p-3 text-sm" key={day.date}>
              <span>{day.date}</span>
              <span className="text-zinc-400">{day.auditEvents} audit events · {day.logins} logins</span>
            </div>
          ))}
          {!reports.dailyPlatformActivity.length ? <EmptyState message="Daily activity appears after production usage begins." /> : null}
        </div>
      </Panel>
    </div>
  );
}

function InvestorPortal({
  activeView,
  dashboard,
  notifications,
  onAction,
  plans,
  portfolio,
  reports,
  wallet,
  withdrawals,
}: {
  activeView: InvestorNavItem;
  dashboard: InvestorDashboard | null;
  notifications: string[];
  onAction: (path: string, body: object) => Promise<void>;
  plans: InvestmentPlan[];
  portfolio: { active: InvestorInvestment[]; completed: InvestorInvestment[] };
  reports: InvestorReport[];
  wallet: InvestorWallet | null;
  withdrawals: WithdrawalRequest[];
}) {
  if (activeView === "Investor Dashboard") {
    return (
      <div className="mt-6 space-y-4">
        <RiskDisclaimer />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Total investment" value={money(dashboard?.totalInvestmentCents ?? 0)} />
          <Metric label="Portfolio value" value={money(dashboard?.currentPortfolioValueCents ?? 0)} />
          <Metric label="Weekly ROI" value={`${(dashboard?.weeklyRoiPercent ?? 0).toFixed(2)}%`} />
          <Metric label="Lifetime ROI" value={`${(dashboard?.lifetimeRoiPercent ?? 0).toFixed(2)}%`} />
          <Metric label="Status" value={dashboard?.currentStatus ?? "Pending"} />
        </div>
        <Panel title="Investment History">
          <InvestmentList investments={dashboard?.investmentHistory ?? []} />
        </Panel>
      </div>
    );
  }

  if (activeView === "Wallet") {
    return (
      <div className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Available balance" value={money(wallet?.availableBalanceCents ?? 0)} />
          <Metric label="Pending balance" value={money(wallet?.pendingBalanceCents ?? 0)} />
          <Metric label="Investment balance" value={money(wallet?.investmentBalanceCents ?? 0)} />
          <Metric label="Withdrawal balance" value={money(wallet?.withdrawalBalanceCents ?? 0)} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Crypto Deposit Invoice">
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void onAction("/wallet/deposits", {
                  amountCents: Math.round(Number(form.get("amount")) * 100),
                });
              }}
            >
              <p className="text-sm text-zinc-400">Invoices are created securely on the server. API keys are never exposed in the browser.</p>
              <TextField label="Deposit amount" name="amount" type="number" />
              <SubmitButton>Create invoice</SubmitButton>
            </form>
          </Panel>
          <Panel title="Wallet Withdrawal">
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void onAction("/wallet/withdrawals", {
                  amountCents: Math.round(Number(form.get("amount")) * 100),
                });
              }}
            >
              <p className="text-sm text-zinc-400">Withdrawal requests require admin approval before payout processing.</p>
              <TextField label="Withdrawal amount" name="amount" type="number" />
              <SubmitButton>Request withdrawal</SubmitButton>
            </form>
          </Panel>
        </div>
        <Panel title="Transaction History">
          <div className="space-y-2">
            {(wallet?.transactions ?? []).map((transaction) => (
              <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3" key={transaction.id}>
                <p className="font-semibold">{transaction.type} · {transaction.status} · {money(transaction.amountCents)}</p>
                <p className="mt-1 text-sm text-zinc-400">{new Date(transaction.createdAt).toLocaleString()}</p>
                {transaction.invoiceUrl ? <a className="text-sm text-emerald-300" href={transaction.invoiceUrl}>Open invoice</a> : null}
              </div>
            ))}
            {!(wallet?.transactions.length) ? <p className="text-sm text-zinc-400">No wallet transactions yet.</p> : null}
          </div>
        </Panel>
        <Panel title="Wallet Alerts">
          <NotificationList notifications={notifications} />
        </Panel>
      </div>
    );
  }

  if (activeView === "Investment Plans") {
    return (
      <Panel title="Investment Plans">
        <RiskDisclaimer />
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {plans.map((plan) => (
            <form
              className="rounded-lg border border-zinc-800 bg-zinc-950 p-4"
              key={plan.id}
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void onAction("/investor/investments", {
                  planId: plan.id,
                  amountCents: Math.round(Number(form.get("amount")) * 100),
                  riskAccepted: form.get("riskAccepted") === "on",
                });
              }}
            >
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="mt-2 text-sm text-zinc-400">{plan.description}</p>
              <p className="mt-3 text-sm text-zinc-300">Range: {money(plan.minimumInvestmentCents)} to {money(plan.maximumInvestmentCents)}</p>
              <p className="mt-2 text-sm text-zinc-400">{plan.historicalPerformanceNote}</p>
              <p className="mt-2 rounded-md bg-amber-500/10 p-3 text-sm text-amber-100">{plan.riskDisclosure}</p>
              <TextField label="Investment amount" name="amount" type="number" />
              <label className="mt-3 flex items-center gap-3 text-sm text-zinc-300">
                <input name="riskAccepted" type="checkbox" />
                I understand historical results are not guaranteed.
              </label>
              <div className="mt-3"><SubmitButton>Record investment interest</SubmitButton></div>
            </form>
          ))}
        </div>
      </Panel>
    );
  }

  if (activeView === "Portfolio") {
    return (
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Active Investments"><InvestmentList investments={portfolio.active} /></Panel>
        <Panel title="Completed Investments"><InvestmentList investments={portfolio.completed} /></Panel>
      </div>
    );
  }

  if (activeView === "Investor Reports") {
    return (
      <Panel title="Investor Reports">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {reports.map((report) => (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={report.id}>
              <p className="text-xs uppercase tracking-[0.12em] text-emerald-300">{report.periodType}</p>
              <p className="mt-2 font-semibold">{report.summary}</p>
              <p className="mt-2 text-sm text-zinc-400">ROI: {report.roiPercent.toFixed(2)}%</p>
              <p className="text-sm text-zinc-400">Portfolio: {money(report.portfolioValueCents)}</p>
            </div>
          ))}
          {!reports.length ? <p className="text-sm text-zinc-400">Weekly and monthly reports will appear here.</p> : null}
        </div>
      </Panel>
    );
  }

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[360px_1fr]">
      <Panel title="Create Withdrawal Request">
        <RiskDisclaimer />
        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void onAction("/investor/withdrawals", {
              amountCents: Math.round(Number(form.get("amount")) * 100),
            });
            event.currentTarget.reset();
          }}
        >
          <TextField label="Withdrawal amount" name="amount" type="number" />
          <SubmitButton>Request withdrawal</SubmitButton>
        </form>
      </Panel>
      <Panel title="Withdrawal History">
        <div className="space-y-2">
          {withdrawals.map((request) => (
            <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3" key={request.id}>
              <p className="font-semibold">{money(request.amountCents)} · {request.status}</p>
              <p className="mt-1 text-sm text-zinc-400">Requested {new Date(request.requestedAt).toLocaleString()}</p>
            </div>
          ))}
          {!withdrawals.length ? <p className="text-sm text-zinc-400">No withdrawal requests yet.</p> : null}
        </div>
      </Panel>
    </div>
  );
}

function AuthPanel({
  apiCheck,
  apiUrl,
  error,
  message,
  mode,
  onApiTest,
  onForgot,
  onLogin,
  onRegister,
  setMode,
}: {
  apiCheck: string;
  apiUrl: string;
  error: string;
  message: string;
  mode: AuthMode;
  onApiTest: () => void;
  onForgot: (event: FormEvent<HTMLFormElement>) => void;
  onLogin: (event: FormEvent<HTMLFormElement>) => void;
  onRegister: (event: FormEvent<HTMLFormElement>) => void;
  setMode: (mode: AuthMode) => void;
}) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 shadow-2xl shadow-black/20">
      <div className="mb-4 rounded-md border border-zinc-800 bg-zinc-950 p-3">
        <p className="break-words text-xs text-zinc-400">API URL: {apiUrl}</p>
        <p className="mt-2 break-words text-xs text-zinc-500">{apiCheck}</p>
        <button
          className="mt-3 w-full rounded-md border border-emerald-700 px-3 py-2 text-sm font-medium text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100"
          type="button"
          onClick={onApiTest}
        >
          Test API connection
        </button>
      </div>
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
  commandCenter,
  decisions,
  featured,
  intelligence,
  liveFixtures,
  notifications,
  onAdd,
  predictions,
  recent,
  upcomingFixtures,
}: {
  commandCenter: SubscriberCommandCenter | null;
  decisions: DecisionEngineOutput[];
  featured: PredictionWithFixture[];
  intelligence: PublishedIntelligence[];
  liveFixtures: FootballFixtureSummary[];
  notifications: string[];
  onAdd: (prediction: PredictionWithFixture) => void;
  predictions: PredictionWithFixture[];
  recent: PredictionWithFixture[];
  upcomingFixtures: FootballFixtureSummary[];
}) {
  const averageConfidence = predictions.length
    ? Math.round(predictions.reduce((total, item) => total + item.confidenceScore, 0) / predictions.length)
    : commandCenter?.executiveOverview.aiIntelligenceScore ?? 0;
  const opportunities = commandCenter?.opportunities ?? [];
  const overview = commandCenter?.executiveOverview;
  return (
    <div className="mt-6 space-y-6">
      <section className="overflow-hidden rounded-lg border border-emerald-400/20 bg-gradient-to-br from-slate-950 via-blue-950 to-zinc-950 p-5 shadow-2xl shadow-emerald-950/20">
        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Executive Overview</p>
            <h3 className="mt-3 text-2xl font-semibold sm:text-3xl">{overview?.welcomeMessage ?? "Welcome back. FPF intelligence is monitoring approved football markets for you."}</h3>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">
              Institutional football intelligence, approved opportunities, market alerts, and performance context in one subscriber command center.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="Membership" value={overview?.membershipTier ?? "Subscriber"} />
            <MiniStat label="Status" value={overview?.subscriptionStatus ?? "Active"} />
            <MiniStat label="AI Score" value={`${overview?.aiIntelligenceScore ?? averageConfidence}%`} />
            <MiniStat label="Wallet" value={money(overview?.walletBalanceCents ?? 0)} />
          </div>
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Today's Opportunities" value={String(opportunities.length || intelligence.length + featured.length)} />
        <Metric label="Live Matches" value={String(liveFixtures.length)} />
        <Metric label="AI Intelligence" value={`${overview?.aiIntelligenceScore ?? averageConfidence}%`} />
        <Metric label="Performance" value={overview?.performanceSummary ?? "Monitoring"} />
        <Metric label="Subscription" value={overview?.subscriptionStatus ?? "Active"} />
      </div>
      <Panel title="Today's Opportunities">
        <DecisionOutputCards decisions={decisions} />
        <SubscriberOpportunityCards opportunities={opportunities} />
        {!opportunities.length ? <OpportunityCards predictions={featured} onAdd={onAdd} /> : null}
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Live Intelligence Feed">
          <FeedList feed={commandCenter?.liveIntelligenceFeed ?? []} />
        </Panel>
        <Panel title="Live Match Center">
          <div className="grid gap-4 sm:grid-cols-2">
            <CompactFixtureList fixtures={liveFixtures} />
            <CompactFixtureList fixtures={upcomingFixtures} />
          </div>
        </Panel>
      </div>
      <Panel title="FPF Intelligence">
        <div className="grid gap-3 md:grid-cols-2">
          {intelligence.map((item) => (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={item.id}>
              <p className="text-xs uppercase tracking-[0.12em] text-emerald-300">FPF Intelligence</p>
              <h3 className="mt-2 font-semibold">{item.match}</h3>
              <p className="mt-1 text-sm text-zinc-400">{item.market} · {item.prediction}</p>
              <p className="mt-3 text-sm leading-6 text-zinc-300">{item.briefExplanation}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <MiniStat label="Conf" value={`${item.confidence}%`} />
                <MiniStat label="Risk" value={item.riskRating} />
                <MiniStat label="Stake" value={item.recommendedStake} />
              </div>
            </div>
          ))}
          {!intelligence.length ? <p className="text-sm text-zinc-400">Published FPF Intelligence will appear here after admin review.</p> : null}
        </div>
      </Panel>
      <Panel title="Recent Predictions">
        <CompactPredictionList predictions={recent} />
      </Panel>
      <Panel title="Notifications">
        {commandCenter ? <NotificationCenterView notifications={commandCenter.notifications} compact /> : <NotificationList notifications={notifications} />}
      </Panel>
    </div>
  );
}

function SubscriberOpportunityCards({ opportunities }: { opportunities: SubscriberOpportunity[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {opportunities.map((opportunity) => (
        <div className="rounded-lg border border-emerald-400/20 bg-slate-950/80 p-4 shadow-xl shadow-black/10" key={opportunity.id}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">{opportunity.source}</p>
              <h3 className="mt-2 font-semibold">{opportunity.match}</h3>
              <p className="mt-1 text-sm text-slate-400">{opportunity.league}</p>
            </div>
            <span className="rounded-md border border-emerald-400/30 px-2 py-1 text-xs text-emerald-200">{opportunity.status}</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <MiniStat label="AI Confidence" value={`${opportunity.aiConfidence}%`} />
            <MiniStat label="Risk Grade" value={opportunity.riskGrade} />
            <MiniStat label="EV" value={opportunity.expectedValue} />
          </div>
          <p className="mt-4 text-sm font-medium text-white">{opportunity.market}: {opportunity.prediction}</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{opportunity.explanation}</p>
          <p className="mt-3 text-xs text-slate-500">
            Kickoff: {opportunity.kickoffTime ? new Date(opportunity.kickoffTime).toLocaleString() : "Pending fixture sync"}
          </p>
        </div>
      ))}
      {!opportunities.length ? <EmptyState message="Approved subscriber opportunities will appear here after FPF review." /> : null}
    </div>
  );
}

function DecisionOutputCards({ compact = false, decisions }: { compact?: boolean; decisions: DecisionEngineOutput[] }) {
  if (!decisions.length) {
    return <EmptyState message="AI Decision Engine candidates will appear when synchronized fixtures are available." />;
  }

  return (
    <div className={`grid gap-3 ${compact ? "mb-4" : "mb-4 md:grid-cols-2 xl:grid-cols-3"}`}>
      {decisions.map((decision) => (
        <div className="rounded-lg border border-blue-400/20 bg-slate-950/80 p-4" key={decision.id}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-blue-200">AI Decision Engine</p>
              <h3 className="mt-2 font-semibold">{decision.match}</h3>
              <p className="mt-1 text-sm text-slate-400">{decision.league}</p>
            </div>
            <span className="rounded-md border border-blue-400/30 px-2 py-1 text-xs text-blue-100">{decision.status.replace("_", " ")}</span>
          </div>
          <p className="mt-4 text-sm font-medium text-white">{decision.recommendedMarket}: {decision.predictedOutcome}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <MiniStat label="Conf" value={`${decision.scores.confidenceScore}%`} />
            <MiniStat label="Risk" value={`${decision.scores.riskScore}`} />
            <MiniStat label="Value" value={`${decision.scores.valueScore}`} />
            <MiniStat label="Opp" value={`${decision.scores.opportunityScore}`} />
          </div>
          <ul className="mt-4 space-y-1 text-sm leading-6 text-slate-300">
            {decision.reasoning.slice(0, compact ? 2 : 3).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          {decision.warnings.length ? <p className="mt-3 text-xs text-amber-200">{decision.warnings[0]}</p> : null}
        </div>
      ))}
    </div>
  );
}

function OpportunityCenterView({
  commandCenter,
  decisions,
  filters,
  fixtures,
  intelligence,
  onAdd,
  onFilter,
  onSelectFixture,
  onSelectPrediction,
  predictions,
  selectedFixture,
  setFilters,
}: {
  commandCenter: SubscriberCommandCenter | null;
  decisions: DecisionEngineOutput[];
  filters: { search: string; league: string; country: string; date: string };
  fixtures: FootballFixtureSummary[];
  intelligence: PublishedIntelligence[];
  onAdd: (prediction: PredictionWithFixture) => void;
  onFilter: (event: FormEvent<HTMLFormElement>) => void;
  onSelectFixture: (id: string) => void;
  onSelectPrediction: (prediction: PredictionWithFixture) => void;
  predictions: PredictionWithFixture[];
  selectedFixture: FootballFixtureDetail | null;
  setFilters: (filters: { search: string; league: string; country: string; date: string }) => void;
}) {
  const opportunities = commandCenter?.opportunities ?? [];
  const lowRisk = opportunities.filter((item) => item.riskGrade === "Low");
  const mediumRisk = opportunities.filter((item) => item.riskGrade === "Medium");
  const highValue = opportunities.filter((item) => item.expectedValue === "High" || item.expectedValue.startsWith("+"));
  const live = opportunities.filter((item) => item.status === "Live");
  const upcoming = opportunities.filter((item) => item.status === "Upcoming");
  return (
    <div className="mt-6 space-y-4">
      <Panel title="Opportunity Filters">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Metric label="Low Risk" value={String(lowRisk.length)} />
          <Metric label="Medium Risk" value={String(mediumRisk.length)} />
          <Metric label="High Value" value={String(highValue.length)} />
          <Metric label="Live" value={String(live.length)} />
          <Metric label="Upcoming" value={String(upcoming.length)} />
          <Metric label="Confidence" value={`${commandCenter?.executiveOverview.aiIntelligenceScore ?? 0}%`} />
        </div>
      </Panel>
      <Panel title="Institutional Opportunity Center">
        <DecisionOutputCards decisions={decisions} />
        <SubscriberOpportunityCards opportunities={opportunities} />
      </Panel>
      <OpportunityList intelligence={intelligence} predictions={predictions} onAdd={onAdd} onSelect={onSelectPrediction} />
      <MatchCenterView
        filters={filters}
        fixtures={fixtures}
        intelligence={intelligence}
        predictions={predictions}
        selectedFixture={selectedFixture}
        setFilters={setFilters}
        onFilter={onFilter}
        onSelectFixture={onSelectFixture}
        onSelectPrediction={onSelectPrediction}
      />
    </div>
  );
}

function FeedList({ feed }: { feed: SubscriberIntelligenceFeedItem[] }) {
  return (
    <div className="space-y-3">
      {feed.map((item) => (
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-4" key={item.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">{item.type}</p>
            <span className={`rounded-md px-2 py-1 text-xs ${item.severity === "Important" ? "bg-emerald-300 text-zinc-950" : item.severity === "Watch" ? "bg-blue-500/20 text-blue-100" : "bg-zinc-800 text-zinc-300"}`}>
              {item.severity}
            </span>
          </div>
          <h3 className="mt-2 font-semibold">{item.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">{item.description}</p>
          <p className="mt-3 text-xs text-slate-500">{new Date(item.timestamp).toLocaleString()}</p>
        </div>
      ))}
      {!feed.length ? <EmptyState message="Live intelligence alerts will appear as markets, odds, injuries, line-ups, and value signals change." /> : null}
    </div>
  );
}

function LiveIntelligenceFeedView({ feed }: { feed: SubscriberIntelligenceFeedItem[] }) {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
      <Panel title="Live Intelligence Feed">
        <FeedList feed={feed} />
      </Panel>
      <Panel title="What Changed?">
        <div className="space-y-3 text-sm leading-6 text-slate-300">
          <p>FPF tracks market movement, odds movement, injury alerts, line-up confirmation, weather impact, and value windows.</p>
          <p>Every alert is framed as intelligence context, not a guaranteed outcome.</p>
        </div>
      </Panel>
    </div>
  );
}

function ReportsView({ reports }: { reports: SubscriberReport[] }) {
  return (
    <Panel title="Intelligence Reports">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => (
          <article className="rounded-lg border border-slate-800 bg-slate-950 p-4" key={report.id}>
            <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">{report.category}</p>
            <h3 className="mt-2 text-lg font-semibold">{report.title}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">{report.summary}</p>
            <p className="mt-4 text-xs text-slate-500">{new Date(report.publishedAt).toLocaleString()}</p>
          </article>
        ))}
        {!reports.length ? <EmptyState message="Daily briefings, weekly reports, market trends, and league analysis will appear here." /> : null}
      </div>
    </Panel>
  );
}

function NotificationCenterView({ compact = false, notifications }: { compact?: boolean; notifications: SubscriberNotification[] }) {
  const content = (
    <div className="space-y-3">
      {notifications.map((notification) => (
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-4" key={notification.id}>
          <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">{notification.type}</p>
          <h3 className="mt-2 font-semibold">{notification.title}</h3>
          <p className="mt-2 text-sm text-slate-300">{notification.message}</p>
          <p className="mt-3 text-xs text-slate-500">{new Date(notification.createdAt).toLocaleString()}</p>
        </div>
      ))}
      {!notifications.length ? <EmptyState message="No subscriber notifications right now." /> : null}
    </div>
  );

  return compact ? content : <Panel title="Subscriber Notification Center">{content}</Panel>;
}

function ReferralView({ referral }: { referral: SubscriberCommandCenter["referral"] | null }) {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[360px_1fr]">
      <Panel title="Referral Program">
        <Metric label="Referral Code" value={referral?.referralCode ?? "FPF-PENDING"} />
        <div className="mt-3 rounded-md border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300">
          {referral?.referralLink ?? "Referral link will appear when account referral tracking is active."}
        </div>
      </Panel>
      <Panel title="Referral Performance">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Earnings" value={money(referral?.earningsCents ?? 0)} />
          <Metric label="Invited Subscribers" value={String(referral?.invitedSubscribers ?? 0)} />
          <Metric label="Rewards" value={String(referral?.rewards.length ?? 0)} />
        </div>
        <div className="mt-4 space-y-2">
          {(referral?.rewards ?? []).map((reward) => (
            <div className="rounded-md border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300" key={reward}>{reward}</div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function InternalSubmissionList({ submissions }: { submissions: AnalystIntelligenceSubmission[] }) {
  return (
    <div className="space-y-2">
      {submissions.map((submission) => (
        <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3" key={submission.id}>
          <p className="text-xs uppercase tracking-[0.12em] text-emerald-300">{submission.status}</p>
          <p className="mt-1 font-semibold">{submission.match}</p>
          <p className="mt-1 text-sm text-zinc-400">{submission.market} · {submission.prediction}</p>
          <p className="mt-1 text-sm text-zinc-500">Confidence {submission.confidence}% · Risk {submission.riskLevel}</p>
          {submission.adminNotes ? <p className="mt-1 text-sm text-zinc-500">{submission.adminNotes}</p> : null}
        </div>
      ))}
      {!submissions.length ? <p className="text-sm text-zinc-400">No intelligence submitted yet.</p> : null}
    </div>
  );
}

function NotificationList({ notifications }: { notifications: string[] }) {
  return (
    <div className="space-y-2">
      {notifications.map((notification) => (
        <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300" key={notification}>
          {notification}
        </div>
      ))}
      {!notifications.length ? <p className="text-sm text-zinc-400">No notifications right now.</p> : null}
    </div>
  );
}

function MatchCenterView({
  filters,
  fixtures,
  intelligence,
  onFilter,
  onSelectFixture,
  onSelectPrediction,
  predictions,
  selectedFixture,
  setFilters,
}: {
  filters: { search: string; league: string; country: string; date: string };
  fixtures: FootballFixtureSummary[];
  intelligence: PublishedIntelligence[];
  onFilter: (event: FormEvent<HTMLFormElement>) => void;
  onSelectFixture: (id: string) => void;
  onSelectPrediction: (prediction: PredictionWithFixture) => void;
  predictions: PredictionWithFixture[];
  selectedFixture: FootballFixtureDetail | null;
  setFilters: (filters: { search: string; league: string; country: string; date: string }) => void;
}) {
  const fixturePrediction = selectedFixture
    ? predictions.find((prediction) => prediction.fixtureId === selectedFixture.id)
    : null;
  const fixtureIntelligence = selectedFixture
    ? intelligence.find((item) => item.fixtureId === selectedFixture.id)
    : null;
  return (
    <div className="mt-6 grid gap-4 xl:grid-cols-[360px_1fr]">
      <Panel title="Global Fixture Center">
        <form className="grid gap-3" onSubmit={onFilter}>
          <TextField label="Search by team" name="search" type="search" value={filters.search} onChange={(value) => setFilters({ ...filters, search: value })} />
          <TextField label="Search by league" name="league" type="text" value={filters.league} onChange={(value) => setFilters({ ...filters, league: value })} />
          <TextField label="Filter by country" name="country" type="text" value={filters.country} onChange={(value) => setFilters({ ...filters, country: value })} />
          <TextField label="Date" name="date" type="date" value={filters.date} onChange={(value) => setFilters({ ...filters, date: value })} />
          <SubmitButton>Apply filters</SubmitButton>
        </form>
        <div className="mt-4 space-y-2">
          {fixtures.map((fixture) => (
            <button className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-3 text-left hover:border-emerald-300" key={fixture.id} type="button" onClick={() => onSelectFixture(fixture.id)}>
              <span className="text-xs uppercase tracking-[0.12em] text-zinc-500">{fixture.leagueName}{fixture.leagueCountry ? ` · ${fixture.leagueCountry}` : ""}</span>
              <span className="mt-1 block font-semibold">{fixture.homeTeamName} vs {fixture.awayTeamName}</span>
              <span className="mt-1 block text-sm text-zinc-400">{fixture.status} · {new Date(fixture.kickoffAt).toLocaleDateString()}</span>
            </button>
          ))}
          {!fixtures.length ? <p className="text-sm text-zinc-400">No fixtures match those filters.</p> : null}
        </div>
      </Panel>
      <Panel title="Match Details">
        {selectedFixture ? (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">{selectedFixture.homeTeamName} vs {selectedFixture.awayTeamName}</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="AI confidence" value={fixturePrediction ? `${fixturePrediction.confidenceScore}%` : "Pending"} />
              <Metric label="Risk score" value={fixturePrediction ? String(fixturePrediction.riskScore) : "Pending"} />
              <Metric label="Value rating" value={fixturePrediction?.valueRating ?? "Pending"} />
            </div>
            <p className="text-sm leading-6 text-zinc-300">{fixturePrediction?.explanation ?? "No approved prediction is available for this match yet."}</p>
            {fixtureIntelligence ? (
              <div className="rounded-lg border border-emerald-800 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                <p className="font-semibold">FPF Intelligence</p>
                <p className="mt-2">{fixtureIntelligence.briefExplanation}</p>
                <p className="mt-2">Recommended stake: {fixtureIntelligence.recommendedStake}</p>
              </div>
            ) : null}
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
  intelligence,
  onAdd,
  onSelect,
  predictions,
}: {
  intelligence: PublishedIntelligence[];
  onAdd: (prediction: PredictionWithFixture) => void;
  onSelect: (prediction: PredictionWithFixture) => void;
  predictions: PredictionWithFixture[];
}) {
  return (
    <div className="mt-6 space-y-4">
      <Panel title="Opportunity Center">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {intelligence.map((item) => (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={item.id}>
              <p className="text-xs uppercase tracking-[0.12em] text-emerald-300">{item.leagueName}</p>
              <h3 className="mt-2 font-semibold">{item.match}</h3>
              <p className="mt-1 text-sm text-zinc-400">{item.market} · {item.prediction}</p>
              <p className="mt-1 text-sm text-zinc-500">Published {item.publishedAt ? new Date(item.publishedAt).toLocaleString() : "after review"}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <MiniStat label="Conf" value={`${item.confidence}%`} />
                <MiniStat label="Risk" value={item.riskRating} />
                <MiniStat label="Stake" value={item.recommendedStake} />
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-300">{item.briefExplanation}</p>
              <button className="mt-4 w-full rounded-md border border-emerald-700 px-3 py-2 text-sm text-emerald-200" type="button">
                View Full Analysis
              </button>
            </div>
          ))}
          {!intelligence.length ? <p className="text-sm text-zinc-400">Approved FPF Intelligence will appear here after publishing.</p> : null}
        </div>
      </Panel>
      <Panel title="Approved AI Opportunities">
        <OpportunityCards predictions={predictions} onAdd={onAdd} onSelect={onSelect} />
      </Panel>
    </div>
  );
}

function LiveMatchCenter({
  fixtures,
  onSelectFixture,
  predictions,
  selectedFixture,
}: {
  fixtures: FootballFixtureSummary[];
  onSelectFixture: (id: string) => void;
  predictions: PredictionWithFixture[];
  selectedFixture: FootballFixtureDetail | null;
}) {
  const livePrediction = selectedFixture
    ? predictions.find((prediction) => prediction.fixtureId === selectedFixture.id)
    : null;
  return (
    <div className="mt-6 grid gap-4 xl:grid-cols-[360px_1fr]">
      <Panel title="Live Match Center">
        <CompactFixtureList fixtures={fixtures} onSelect={onSelectFixture} />
        <p className="mt-4 text-xs text-zinc-500">Live matches refresh automatically every 30 seconds.</p>
      </Panel>
      <Panel title="Live Match Details">
        {selectedFixture ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-xl font-semibold">{selectedFixture.homeTeamName} vs {selectedFixture.awayTeamName}</h3>
              <span className="rounded-md bg-emerald-300 px-3 py-2 text-sm font-semibold text-zinc-950">{selectedFixture.status}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <Metric label="Live score" value={`${selectedFixture.homeScore ?? 0} - ${selectedFixture.awayScore ?? 0}`} />
              <Metric label="Match clock" value={selectedFixture.status === "LIVE" ? "Live" : new Date(selectedFixture.kickoffAt).toLocaleTimeString()} />
              <Metric label="AI confidence" value={livePrediction ? `${livePrediction.confidenceScore}%` : "Pending"} />
              <Metric label="Risk score" value={livePrediction ? String(livePrediction.riskScore) : "Pending"} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Match Events">
                <p className="text-sm text-zinc-400">Detailed event feed will appear as synchronized live events become available.</p>
              </Panel>
              <Panel title="Team Statistics">
                <div className="space-y-2 text-sm text-zinc-300">
                  {selectedFixture.standings.slice(0, 4).map((standing) => (
                    <p key={standing.teamName}>{standing.teamName}: {standing.points} pts, {standing.won}-{standing.drawn}-{standing.lost}</p>
                  ))}
                  {!selectedFixture.standings.length ? <p className="text-zinc-400">Team statistics are pending sync.</p> : null}
                </div>
              </Panel>
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-400">Select a live match to view score, clock, statistics, and confidence updates.</p>
        )}
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
          <p className="mt-2">Team form: {fixture?.standings.length ? fixture.standings.slice(0, 2).map((standing) => `${standing.teamName} ${standing.points} pts`).join(" · ") : "Pending"}</p>
          <p>Head-to-head: {fixture?.headToHeadRecords.length ?? 0} records</p>
          <p>League position: {fixture?.standings[0]?.rank ? "Available" : "Pending"}</p>
          <p>Injuries: {fixture?.injuries.length ?? 0} listed</p>
          <p>Suspensions: Included when synchronized as injury/unavailability notes</p>
          <p>Suggested market: {prediction.recommendedMarket}</p>
          <p>Odds comparison: {prediction.edge ? `${(prediction.edge * 100).toFixed(1)}% edge` : "No edge"}</p>
          <button className="mt-4 w-full rounded-md bg-emerald-300 px-4 py-3 font-semibold text-zinc-950" type="button" onClick={() => onAdd(prediction)}>Add to slip</button>
        </div>
      </div>
    </Panel>
  );
}

function PerformanceView({
  commandCenter,
  fixtures,
  intelligence,
  predictions,
}: {
  commandCenter: SubscriberCommandCenter | null;
  fixtures: FootballFixtureSummary[];
  intelligence: PublishedIntelligence[];
  predictions: PredictionWithFixture[];
}) {
  const winRate = commandCenter?.performance.strikeRate ?? (predictions.length ? Math.round(predictions.filter((prediction) => prediction.confidenceScore >= 60).length / predictions.length * 100) : 0);
  const roi = commandCenter?.performance.roi ?? (predictions.length ? Math.round(predictions.reduce((total, prediction) => total + (prediction.edge ?? 0), 0) / predictions.length * 1000) / 10 : 0);
  const favoriteLeagues = Array.from(new Set(fixtures.map((fixture) => fixture.leagueName))).slice(0, 4);
  const monthly = commandCenter?.performance.chart.map((item) => item.value) ?? [42, 58, 51, 64, 61, Math.max(30, winRate)];
  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Wins" value={String(commandCenter?.performance.wins ?? 0)} />
        <Metric label="Losses" value={String(commandCenter?.performance.losses ?? 0)} />
        <Metric label="Strike Rate" value={`${winRate}%`} />
        <Metric label="ROI" value={`${roi.toFixed(1)}%`} />
        <Metric label="Weekly Profit" value={money(commandCenter?.performance.weeklyProfit ?? 0)} />
        <Metric label="Monthly Profit" value={money(commandCenter?.performance.monthlyProfit ?? 0)} />
      </div>
      <Panel title="Favorite Leagues">
        <div className="flex flex-wrap gap-2">
          {favoriteLeagues.map((league) => <span className="rounded-md bg-zinc-950 px-3 py-2 text-sm text-zinc-300" key={league}>{league}</span>)}
          {!favoriteLeagues.length ? <p className="text-sm text-zinc-400">Favorite leagues will appear as fixture history builds.</p> : null}
        </div>
      </Panel>
      <Panel title="Monthly Performance Chart">
        <div className="flex h-40 items-end gap-3">
          {monthly.map((value, index) => (
            <div className="flex flex-1 flex-col items-center gap-2" key={`${value}-${index}`}>
              <div className="w-full rounded-t bg-emerald-300" style={{ height: `${value}%` }} />
              <span className="text-xs text-zinc-500">{commandCenter?.performance.chart[index]?.label ?? `M${index + 1}`}</span>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Historical Context">
        <p className="text-sm leading-6 text-slate-300">
          Performance statistics are based on approved FPF opportunities. They are analytical records, not promises or fixed returns.
          Current tracked AI predictions: {predictions.length}. Published intelligence items: {intelligence.length}.
        </p>
      </Panel>
    </div>
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
      {!predictions.length ? <EmptyState message="Approved predictions will appear here after review." /> : null}
    </div>
  );
}

function CompactFixtureList({ fixtures, onSelect }: { fixtures: FootballFixtureSummary[]; onSelect?: (id: string) => void }) {
  return (
    <div className="space-y-2">
      {fixtures.map((fixture) => (
        <button
          className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-3 text-left hover:border-emerald-300"
          disabled={!onSelect}
          key={fixture.id}
          type="button"
          onClick={() => onSelect?.(fixture.id)}
        >
          <p className="font-semibold">{fixture.homeTeamName} vs {fixture.awayTeamName}</p>
          <p className="mt-1 text-sm text-zinc-400">{fixture.leagueName} · {fixture.status} · {new Date(fixture.kickoffAt).toLocaleString()}</p>
        </button>
      ))}
      {!fixtures.length ? <EmptyState message="No synchronized fixtures available." /> : null}
    </div>
  );
}

function CompactAuditList({ emptyLabel, logs }: { emptyLabel: string; logs: AuditLogEntry[] }) {
  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3" key={log.id}>
          <p className="font-semibold">{log.action}</p>
          <p className="mt-1 text-sm text-zinc-400">{log.entityType} · {log.entityId ?? "System"} · {new Date(log.createdAt).toLocaleString()}</p>
        </div>
      ))}
      {!logs.length ? <p className="text-sm text-zinc-400">{emptyLabel}</p> : null}
    </div>
  );
}

function InvestmentList({ investments }: { investments: InvestorInvestment[] }) {
  return (
    <div className="space-y-2">
      {investments.map((investment) => (
        <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3" key={investment.id}>
          <p className="font-semibold">{investment.planName}</p>
          <p className="mt-1 text-sm text-zinc-400">
            {money(investment.amountCents)} invested · {money(investment.currentValueCents)} current
          </p>
          <p className="text-sm text-zinc-500">
            Weekly ROI {investment.weeklyRoiPercent.toFixed(2)}% · Lifetime ROI {investment.lifetimeRoiPercent.toFixed(2)}%
          </p>
        </div>
      ))}
      {!investments.length ? <p className="text-sm text-zinc-400">No investments in this category.</p> : null}
    </div>
  );
}

function RiskDisclaimer() {
  return (
    <p className="rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">
      Investment performance is based on historical results only. Returns are never guaranteed, and all investments carry risk.
    </p>
  );
}

function LoadingSkeleton({ label }: { label: string }) {
  return (
    <div className="mt-6 space-y-3">
      <p className="text-sm text-zinc-400">{label}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div className="h-24 animate-pulse rounded-lg border border-zinc-800 bg-zinc-900" key={item} />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-lg border border-zinc-800 bg-zinc-900" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
      {message}
    </div>
  );
}

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
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
        value={onChange ? value : undefined}
        defaultValue={!onChange ? value : undefined}
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
