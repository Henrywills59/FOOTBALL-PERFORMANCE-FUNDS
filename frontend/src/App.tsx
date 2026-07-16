import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type {
  AdminOverview,
  AdminAnnouncement,
  AdminReports,
  AdminInvestorManagement,
  AdminSettings,
  AdminUser,
  AdminAnalystControlCenter,
  AnalystApplication,
  AnalystAssignment,
  AnalystAssistance,
  AnalystDashboard,
  AnalystPrivateAnalytics,
  AnalystPerformanceDashboard,
  AnalystIntelligenceSubmission,
  AuditLogEntry,
  AuthResponse,
  AuthUser,
  CommercialStructure,
  CommercialControlCenter,
  DecisionEngineOutput,
  ExecutiveSituationRoom,
  ExecutiveAnalyticsDashboard,
  FootballFixtureDetail,
  FootballFixtureSummary,
  GlobalizationBootstrap,
  InfrastructureControlCenter,
  InvestmentPlan,
  InvestorDashboard,
  InvestorDistribution,
  InvestorInvestment,
  InvestorProfile,
  InvestorPortalReport,
  InvestorSimulatorInput,
  InvestorSimulatorResult,
  InvestorWallet,
  MonitoringOverview,
  NotificationPreferences,
  OperationalNotification,
  OperationalReport,
  PaymentCenter,
  PaymentOrder,
  PredictionResult,
  PredictionQueueItem,
  PredictionWorkflowQueue,
  PublishedIntelligence,
  PlatformHealth,
  PublicUserRole,
  SubscriberCommandCenter,
  SubscriberIntelligenceFeedItem,
  SubscriberNotification,
  SubscriberOpportunity,
  SubscriberReport,
  SystemIncident,
  TreasuryDashboard,
  AnalystTreasuryView,
  UserGlobalPreferences,
  WarRoomDashboard,
  WithdrawalRequest,
  LanguageSetting,
  MediaDashboard,
  MediaPlatform,
  CurrencySetting,
  TimezoneSetting,
  PublicExperience,
  ThemePreference,
} from "./types";
import { PUBLIC_USER_ROLES } from "./types";
import { Mission21PublicExperience, ThemeSwitcher } from "./PublicExperience";

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
const enableExecutiveGlobalCommandWall = import.meta.env.VITE_ENABLE_EXECUTIVE_GLOBAL_COMMAND_WALL === "true";

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
  "Settings",
  "Notifications",
  "Referral Program",
] as const;
const adminNavBaseItems = ["Admin Dashboard", "Executive BI", "Infrastructure Center", "Payment Center", "Prediction Review", "Intelligence Review", "Analyst Command", "War Room", "Treasury Center", "Executive Situation", "Investor Management", "Business Control", "Media Command", "Reports", "Monitoring", "Announcements", "Fixture Management", "User Management", "Audit Logs", "Settings"] as const;
const futureAdminNavItems = ["Global Command Wall"] as const;
const adminNavItems = [...adminNavBaseItems, ...(enableExecutiveGlobalCommandWall ? futureAdminNavItems : [])] as const;
const investorNavItemsWithWallet = ["Investor Dashboard", "Simulator", "Earnings", "Reports", "Capital", "Profile", "Settings", "Documents", "Support", "Wallet", "Payments", "Investment Plans", "Portfolio", "Withdrawals"] as const;
const analystNavItems = ["Analyst Dashboard", "War Room", "Academy", "Prediction Workspace", "Performance", "My Analytics", "Treasury", "Rewards", "Profile", "Settings"] as const;

type AuthMode = "login" | "register" | "forgot";
type NavItem = (typeof navItems)[number];
type AdminNavItem = (typeof adminNavItems)[number];
type InvestorNavItem = (typeof investorNavItemsWithWallet)[number];
type AnalystNavItem = (typeof analystNavItems)[number];
type PredictionWithFixture = PredictionResult & { fixture?: FootballFixtureDetail };
type SearchResult = { category: string; title: string; description: string; target?: string };
type PlatformNavTarget = NavItem | AdminNavItem | InvestorNavItem | AnalystNavItem;
type PublicPageDefinition = {
  label: string;
  path: string;
  id: string;
  description: string;
};

const publicPageDefinitions: PublicPageDefinition[] = [
  { label: "Home", path: "/", id: "home", description: "Cinematic FPF homepage and launch gateway." },
  { label: "About", path: "/about", id: "about", description: "The Football Performance Fund mission and operating model." },
  { label: "Platform", path: "/platform", id: "platform", description: "Unified website, subscriber, investor, analyst, and admin platform." },
  { label: "How FPF Works", path: "/how-fpf-works", id: "how-fpf-works", description: "How data, AI, analysts, and admin approval become FPF intelligence." },
  { label: "Subscribers", path: "/subscribers", id: "subscribers", description: "Subscriber intelligence experience and opportunity center." },
  { label: "Performance Partners", path: "/investors", id: "investors", description: "Performance Partner transparency, simulator, reports, and risk-first controls." },
  { label: "Analyst Applications", path: "/analyst-applications", id: "analyst-applications", description: "Professional internal analyst application journey." },
  { label: "Technology", path: "/technology", id: "technology", description: "FPF architecture, AI decision engine, and infrastructure." },
  { label: "AI Intelligence", path: "/ai-intelligence", id: "ai-intelligence", description: "Explainable football intelligence, confidence, risk, and value scores." },
  { label: "Performance", path: "/performance", id: "performance", description: "Tracked performance without guaranteed outcomes." },
  { label: "Pricing", path: "/pricing", id: "pricing", description: "Subscriber pricing and commercial structure." },
  { label: "Participation Plans", path: "/investor-packages", id: "investor-packages", description: "Placeholder Performance Partner participation plans and season education." },
  { label: "Security", path: "/security", id: "security", description: "Authentication, authorization, privacy, and risk controls." },
  { label: "Blog", path: "/blog", id: "blog", description: "FPF updates, market education, and launch-stage insights." },
  { label: "Media", path: "/media", id: "media", description: "Media center, announcements, and press resources." },
  { label: "Careers", path: "/careers", id: "careers", description: "Careers, internal analyst pathway, and partner programmes." },
  { label: "Contact", path: "/contact", id: "contact", description: "Contact and support entry points." },
  { label: "FAQ", path: "/faq", id: "faq", description: "Frequently asked questions." },
  { label: "Privacy Policy", path: "/privacy-policy", id: "privacy-policy", description: "Privacy and data preference information." },
  { label: "Terms and Conditions", path: "/terms-and-conditions", id: "terms-and-conditions", description: "Football Performance Fund terms and conditions." },
  { label: "Risk Disclosure", path: "/risk-disclosure", id: "risk-disclosure", description: "Financial and football intelligence risk disclosures." },
  { label: "Responsible Participation", path: "/responsible-participation", id: "responsible-participation", description: "Responsible participation guidance." },
  { label: "Cookie Policy", path: "/cookie-policy", id: "cookie-policy", description: "Cookie and tracking policy." },
];

const publicPathAliases: Record<string, string> = {
  "/for-subscribers": "/subscribers",
  "/for-investors": "/investors",
  "/for-analysts": "/analyst-applications",
  "/legal": "/terms-and-conditions",
  "/privacy": "/privacy-policy",
  "/terms": "/terms-and-conditions",
};

const legacyPrivatePaths = ["/app", "/dashboard", "/dashboard/admin", "/dashboard/subscriber", "/dashboard/investor", "/dashboard/analyst"];

function normalizedPathname(pathname = window.location.pathname) {
  const clean = pathname.replace(/\/+$/, "");
  return clean || "/";
}

function getCanonicalPublicPage(pathname = window.location.pathname) {
  const normalized = normalizedPathname(pathname);
  const canonicalPath = publicPathAliases[normalized] ?? normalized;
  return publicPageDefinitions.find((page) => page.path === canonicalPath) ?? null;
}

function isLegacyPrivatePath(pathname = window.location.pathname) {
  const normalized = normalizedPathname(pathname);
  return legacyPrivatePaths.some((path) => normalized === path || normalized.startsWith(`${path}/`));
}

function scrollPublicSection(id: string) {
  window.requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function setMetaTag(name: string, content: string, attribute: "name" | "property" = "name") {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, name);
    document.head.appendChild(element);
  }
  element.content = content;
}

const roleLabels: Record<PublicUserRole | "ADMIN", string> = {
  SUBSCRIBER: "Subscriber",
  INVESTOR: "Performance Partner",
  ANALYST: "Analyst",
  ADMIN: "Admin",
};

function displayNavigationLabel(label: string) {
  return label
    .replace(/\bInvestor Dashboard\b/g, "Partner Dashboard")
    .replace(/\bInvestor Management\b/g, "Partner Management")
    .replace(/\bInvestor\b/g, "Performance Partner")
    .replace(/\binvestor\b/g, "performance partner");
}

function getStoredSession() {
  const rawSession = localStorage.getItem("fpf_session") ?? sessionStorage.getItem("fpf_session");
  if (!rawSession) return null;
  try {
    return JSON.parse(rawSession) as AuthResponse;
  } catch {
    return null;
  }
}

const defaultGlobalPreferences: UserGlobalPreferences = {
  language: "en",
  currency: "USD",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  country: "US",
  region: "North America",
  measurementSystem: "metric",
  dateFormat: "MM/DD/YYYY",
  numberFormat: "en-US",
};

const defaultCommercialStructure: CommercialStructure = {
  subscriberPlans: [],
  investorLevels: [],
  investorPackages: [],
  participationPlans: [],
  lockPeriods: [],
  pricingRules: [],
  minimumInvestmentCents: 10000,
  simulatorDefaults: { weeklyReturnPercent: 1.25, platformFeePercent: 10 },
  notices: {
    paymentPlaceholder: "Secure checkout is being activated.",
    investmentRisk: "Capital is at risk. Returns are not guaranteed.",
    simulationOnly: "Simulation only.",
    performancePartnerCompatibility: "Performance Partner is the user-facing model while legacy investor internals are migrated safely.",
    contractualPayout: "The contractual payout represents the complete financial obligation under the participation agreement.",
  },
};

function getStoredPreferences() {
  const raw = localStorage.getItem("fpf_global_preferences");
  if (!raw) return defaultGlobalPreferences;
  try {
    return { ...defaultGlobalPreferences, ...JSON.parse(raw) } as UserGlobalPreferences;
  } catch {
    return defaultGlobalPreferences;
  }
}

function getStoredThemePreference(): ThemePreference {
  const stored = localStorage.getItem("fpf_theme_preference");
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

function resolveThemePreference(theme: ThemePreference) {
  if (theme === "system") {
    return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return theme;
}

export default function App() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [currentPath, setCurrentPath] = useState(() => normalizedPathname());
  const [session, setSession] = useState<AuthResponse | null>(() => getStoredSession());
  const [activeView, setActiveView] = useState<NavItem>("Subscriber Home");
  const [activeAdminView, setActiveAdminView] = useState<AdminNavItem>("Admin Dashboard");
  const [activeInvestorView, setActiveInvestorView] = useState<InvestorNavItem>("Investor Dashboard");
  const [activeAnalystView, setActiveAnalystView] = useState<AnalystNavItem>("Analyst Dashboard");
  const [adminMode, setAdminMode] = useState(() => getStoredSession()?.user.role === "ADMIN");
  const [message, setMessage] = useState("");
  const [apiCheck, setApiCheck] = useState(`Backend API: ${apiUrl}`);
  const [error, setError] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [showLaunchCenter, setShowLaunchCenter] = useState(() => localStorage.getItem("fpf_launch_center_seen") !== "true");
  const [favoriteModules, setFavoriteModules] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("fpf_favorite_modules") ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const [recentPages, setRecentPages] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("fpf_recent_pages") ?? "[]") as string[];
    } catch {
      return [];
    }
  });
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
  const [predictionWorkflowQueue, setPredictionWorkflowQueue] = useState<PredictionWorkflowQueue | null>(null);
  const [publishedWorkflowPredictions, setPublishedWorkflowPredictions] = useState<PredictionQueueItem[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [syncLogs, setSyncLogs] = useState<AuditLogEntry[]>([]);
  const [adminSettings, setAdminSettings] = useState<AdminSettings | null>(null);
  const [adminReports, setAdminReports] = useState<AdminReports | null>(null);
  const [platformHealth, setPlatformHealth] = useState<PlatformHealth | null>(null);
  const [adminInvestorManagement, setAdminInvestorManagement] = useState<AdminInvestorManagement | null>(null);
  const [investorDashboard, setInvestorDashboard] = useState<InvestorDashboard | null>(null);
  const [investorProfile, setInvestorProfile] = useState<InvestorProfile | null>(null);
  const [investmentPlans, setInvestmentPlans] = useState<InvestmentPlan[]>([]);
  const [portfolio, setPortfolio] = useState<{ active: InvestorInvestment[]; completed: InvestorInvestment[] }>({ active: [], completed: [] });
  const [investorReports, setInvestorReports] = useState<InvestorPortalReport[]>([]);
  const [investorDistributions, setInvestorDistributions] = useState<InvestorDistribution[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [wallet, setWallet] = useState<InvestorWallet | null>(null);
  const [publishedIntelligence, setPublishedIntelligence] = useState<PublishedIntelligence[]>([]);
  const [analystDashboard, setAnalystDashboard] = useState<AnalystDashboard | null>(null);
  const [analystPerformance, setAnalystPerformance] = useState<AnalystPerformanceDashboard | null>(null);
  const [analystAssignments, setAnalystAssignments] = useState<AnalystAssignment[]>([]);
  const [analystSubmissions, setAnalystSubmissions] = useState<AnalystIntelligenceSubmission[]>([]);
  const [analystAssistance, setAnalystAssistance] = useState<AnalystAssistance | null>(null);
  const [adminIntelligence, setAdminIntelligence] = useState<AnalystIntelligenceSubmission[]>([]);
  const [adminAnalystControl, setAdminAnalystControl] = useState<AdminAnalystControlCenter | null>(null);
  const [warRoom, setWarRoom] = useState<WarRoomDashboard | null>(null);
  const [treasuryDashboard, setTreasuryDashboard] = useState<TreasuryDashboard | null>(null);
  const [executiveSituation, setExecutiveSituation] = useState<ExecutiveSituationRoom | null>(null);
  const [analystTreasury, setAnalystTreasury] = useState<AnalystTreasuryView | null>(null);
  const [executiveAnalytics, setExecutiveAnalytics] = useState<ExecutiveAnalyticsDashboard | null>(null);
  const [analystAnalytics, setAnalystAnalytics] = useState<AnalystPrivateAnalytics | null>(null);
  const [subscriberCommandCenter, setSubscriberCommandCenter] = useState<SubscriberCommandCenter | null>(null);
  const [decisionOutputs, setDecisionOutputs] = useState<DecisionEngineOutput[]>([]);
  const [commercialStructure, setCommercialStructure] = useState<CommercialStructure>(defaultCommercialStructure);
  const [languages, setLanguages] = useState<LanguageSetting[]>([]);
  const [currencies, setCurrencies] = useState<CurrencySetting[]>([]);
  const [timezones, setTimezones] = useState<TimezoneSetting[]>([]);
  const [globalPreferences, setGlobalPreferences] = useState<UserGlobalPreferences>(() => getStoredPreferences());
  const [operationalReports, setOperationalReports] = useState<OperationalReport[]>([]);
  const [monitoringOverview, setMonitoringOverview] = useState<MonitoringOverview | null>(null);
  const [systemIncidents, setSystemIncidents] = useState<SystemIncident[]>([]);
  const [operationalNotifications, setOperationalNotifications] = useState<OperationalNotification[]>([]);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences | null>(null);
  const [adminAnnouncements, setAdminAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [mediaDashboard, setMediaDashboard] = useState<MediaDashboard | null>(null);
  const [commercialControl, setCommercialControl] = useState<CommercialControlCenter | null>(null);
  const [infrastructureControl, setInfrastructureControl] = useState<InfrastructureControlCenter | null>(null);
  const [paymentCenter, setPaymentCenter] = useState<PaymentCenter | null>(null);
  const [adminPaymentCenter, setAdminPaymentCenter] = useState<PaymentCenter | null>(null);
  const [publicExperience, setPublicExperience] = useState<PublicExperience | null>(null);
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => getStoredThemePreference());

  useEffect(() => {
    const applyTheme = () => {
      const resolved = resolveThemePreference(themePreference);
      document.documentElement.dataset.theme = resolved;
      document.documentElement.dataset.themePreference = themePreference;
      document.documentElement.style.colorScheme = resolved;
    };
    applyTheme();
    localStorage.setItem("fpf_theme_preference", themePreference);
    const media = window.matchMedia?.("(prefers-color-scheme: light)");
    media?.addEventListener("change", applyTheme);
    return () => media?.removeEventListener("change", applyTheme);
  }, [themePreference]);

  useEffect(() => {
    if (session) return;
    void fetchJson<PublicExperience>(apiEndpoint("/public/experience"), undefined, sameOriginApiEndpoint("/public/experience"))
      .then(setPublicExperience)
      .catch(() => setPublicExperience(null));
  }, [session]);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(normalizedPathname());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!session && isLegacyPrivatePath(currentPath)) setMode("login");
    if (!session && ["/login", "/signin", "/sign-in"].includes(currentPath)) setMode("login");
    if (!session && ["/register", "/get-started", "/subscribe", "/become-an-investor", "/apply-as-analyst"].includes(currentPath)) setMode("register");
    if (!session && ["/forgot-password", "/reset-password"].includes(currentPath)) setMode("forgot");
  }, [currentPath, session]);

  useEffect(() => {
    if (session && !isLegacyPrivatePath(currentPath)) {
      window.history.replaceState(null, "", "/app");
      setCurrentPath("/app");
    }
  }, [currentPath, session]);

  useEffect(() => {
    const publicPage = getCanonicalPublicPage(currentPath);
    const isPrivate = Boolean(session) || isLegacyPrivatePath(currentPath);
    document.title = isPrivate
      ? "FPF Operating System"
      : publicPage
        ? `${publicPage.label} | Football Performance Fund`
        : "Page Not Found | Football Performance Fund";
    setMetaTag("description", publicPage?.description ?? "Football Performance Fund is a unified global football AI intelligence, subscriber, investor, analyst, treasury, and executive operating system.");
    setMetaTag("robots", isPrivate ? "noindex,nofollow" : "index,follow");
    setMetaTag("og:title", publicPage ? `${publicPage.label} | Football Performance Fund` : "Football Performance Fund", "property");
    setMetaTag("og:description", publicPage?.description ?? "We Don't Chase Luck. We Build Performance.", "property");
  }, [currentPath, session]);

  useEffect(() => {
    const loadPublicGlobalization = async () => {
      try {
        const [languageData, currencyData, timezoneData] = await Promise.all([
          fetchJson<{ languages: LanguageSetting[] }>(apiEndpoint("/settings/languages"), undefined, sameOriginApiEndpoint("/settings/languages")),
          fetchJson<{ currencies: CurrencySetting[] }>(apiEndpoint("/settings/currencies"), undefined, sameOriginApiEndpoint("/settings/currencies")),
          fetchJson<{ timezones: TimezoneSetting[] }>(apiEndpoint("/settings/timezones"), undefined, sameOriginApiEndpoint("/settings/timezones")),
        ]);
        setLanguages(languageData.languages);
        setCurrencies(currencyData.currencies);
        setTimezones(timezoneData.timezones);
        const commercial = await fetchJson<CommercialStructure>(
          apiEndpoint("/commercial/structure"),
          undefined,
          sameOriginApiEndpoint("/commercial/structure"),
        );
        setCommercialStructure(commercial);
      } catch {
        setLanguages([]);
        setCurrencies([]);
        setTimezones([]);
      }
    };
    void loadPublicGlobalization();
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    const loadSessionData = async () => {
      await loadGlobalPreferences(session.token);
      await loadOperationsData(session.token);
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

  const searchResults = useMemo<SearchResult[]>(() => {
    const query = globalSearch.trim().toLowerCase();
    if (!query) return [];
    const pool: SearchResult[] = [
      ...publicPageDefinitions.map((page) => ({
        category: "Public Pages",
        title: page.label,
        description: page.description,
        target: undefined,
      })),
      ...predictions.map((prediction) => ({
        category: "Predictions",
        title: prediction.predictedOutcome,
        description: `${prediction.recommendedMarket} | confidence ${prediction.confidenceScore}%`,
        target: "Opportunity Center",
      })),
      ...publishedIntelligence.map((item) => ({
        category: "Intelligence",
        title: item.match,
        description: `${item.market} | ${item.prediction}`,
        target: "Opportunity Center",
      })),
      ...fixtures.map((fixture) => ({
        category: "Matches",
        title: `${fixture.homeTeamName} vs ${fixture.awayTeamName}`,
        description: `${fixture.leagueName} | ${fixture.status}`,
        target: "Live Match Center",
      })),
      ...adminUsers.map((user) => ({
        category: user.role === "INVESTOR" ? "Investors" : user.role === "ANALYST" ? "Analysts" : user.role === "SUBSCRIBER" ? "Subscribers" : "Users",
        title: user.name,
        description: `${user.email} | ${user.role}`,
        target: "User Management",
      })),
      ...operationalReports.map((report) => ({
        category: "Reports",
        title: report.title,
        description: `${report.type} | ${report.status}`,
        target: "Reports",
      })),
      ...(adminInvestorManagement?.investors ?? []).map((investor) => ({
        category: "Investors",
        title: investor.name,
        description: `${investor.email} | ${money(investor.totalCapitalCents)}`,
        target: "Investor Management",
      })),
      ...operationalNotifications.map((notification) => ({
        category: "Notifications",
        title: notification.title,
        description: `${notification.category} | ${notification.message}`,
        target: session?.user.role === "SUBSCRIBER" ? "Notifications" : "Monitoring",
      })),
      ...adminAnnouncements.map((announcement) => ({
        category: "Articles",
        title: announcement.title,
        description: announcement.message,
        target: "Announcements",
      })),
      ...(mediaDashboard?.posts ?? []).map((post) => ({
        category: "Media",
        title: post.title,
        description: `${post.platforms.join(", ")} | ${post.status}`,
        target: "Media Command",
      })),
      ...[
        { category: "Settings", title: "Global settings", description: "Language, currency, timezone, theme, privacy, security, accessibility, and display.", target: "Settings" },
        { category: "Settings", title: "Profile center", description: "Profile, devices, sessions, 2FA placeholder, activity, subscription, investment, and performance.", target: "Profile" },
        { category: "Commands", title: "Executive BI", description: "Company KPIs, forecasts, analytics, and export center.", target: "Executive BI" },
        { category: "Commands", title: "Treasury Center", description: "Treasury, settlement, reconciliation, and weekly closure.", target: "Treasury Center" },
        { category: "Commands", title: "Opportunity Center", description: "Approved FPF football intelligence opportunities.", target: "Opportunity Center" },
      ],
      ...fixtures.flatMap((fixture) => [
        { category: "Teams", title: fixture.homeTeamName, description: fixture.leagueName, target: "Live Match Center" },
        { category: "Teams", title: fixture.awayTeamName, description: fixture.leagueName, target: "Live Match Center" },
      ]),
      { category: "Players", title: "Player intelligence", description: "Player profile search is provider-ready pending live data.", target: "Live Match Center" },
    ];
    return pool
      .filter((item) => `${item.category} ${item.title} ${item.description}`.toLowerCase().includes(query))
      .slice(0, 8);
  }, [adminAnnouncements, adminInvestorManagement, adminUsers, fixtures, globalSearch, mediaDashboard?.posts, operationalNotifications, operationalReports, predictions, publishedIntelligence, session?.user.role]);

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
    window.history.pushState(null, "", "/app");
    setCurrentPath("/app");
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

  async function apiPut<T>(path: string, token: string, body?: object) {
    return fetchJson<T>(
      apiEndpoint(path),
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
  }

  async function apiPatch<T>(path: string, token: string, body?: object) {
    return fetchJson<T>(
      apiEndpoint(path),
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
  }

  async function loadOperationsData(token: string) {
    try {
      const [reportsData, notificationsData, preferencesData] = await Promise.all([
        apiGet<{ reports: OperationalReport[] }>("/reports", token),
        apiGet<{ notifications: OperationalNotification[] }>("/notifications", token),
        apiGet<NotificationPreferences>("/notifications/preferences", token),
      ]);
      setOperationalReports(reportsData.reports);
      setOperationalNotifications(notificationsData.notifications);
      setNotificationPreferences(preferencesData);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load operations center");
    }
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
      const workflowPublicationData = await apiGet<{ predictions: PredictionQueueItem[] }>("/predictions/published-workflow", token);
      setSubscriberCommandCenter(commandCenter);
      setFixtures(fixtureData.fixtures);
      setLiveFixtures(liveData.fixtures);
      setDecisionOutputs(decisionData.decisions);
      setPublishedIntelligence(intelligenceData.intelligence);
      setPublishedWorkflowPredictions(workflowPublicationData.predictions);
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
      const operationsMonitoringData = await apiGet<MonitoringOverview>("/admin/monitoring/overview", token);
      const incidentsData = await apiGet<{ incidents: SystemIncident[] }>("/admin/monitoring/incidents", token);
      const announcementsData = await apiGet<{ announcements: AdminAnnouncement[] }>("/admin/announcements", token);
      const mediaData = await apiGet<MediaDashboard>("/admin/media/dashboard", token);
      const commercialControlData = await apiGet<CommercialControlCenter>("/admin/commercial/control", token);
      const infrastructureControlData = await apiGet<InfrastructureControlCenter>("/admin/infrastructure", token);
      const adminPaymentsData = await apiGet<PaymentCenter>("/admin/payments", token);
      const decisionData = await apiGet<{ decisions: DecisionEngineOutput[] }>("/intelligence/decision/opportunities?limit=12", token);
      const workflowData = await apiGet<PredictionWorkflowQueue>("/prediction-workflow/queue?sort=priority", token);
      const investorManagementData = await apiGet<AdminInvestorManagement>("/admin/investors", token);
      const analystControlData = await apiGet<AdminAnalystControlCenter>("/analysts", token);
      const warRoomData = await apiGet<WarRoomDashboard>("/war-room", token);
      const treasuryData = await apiGet<TreasuryDashboard>("/treasury", token);
      const executiveSituationData = await apiGet<ExecutiveSituationRoom>("/treasury/executive-situation-room", token);
      const executiveAnalyticsData = await apiGet<ExecutiveAnalyticsDashboard>("/analytics/executive", token);
      setAdminOverview(overview);
      setAdminPredictions(predictionsData.predictions);
      setAdminDecisionOutputs(decisionData.decisions);
      setPredictionWorkflowQueue(workflowData);
      setAdminUsers(usersData.users);
      setAuditLogs(logsData.logs);
      setAdminSettings(settingsData);
      setSyncLogs(syncData.logs);
      setAdminIntelligence(intelligenceData.submissions);
      setAdminReports(reportsData);
      setPlatformHealth(monitoringData);
      setMonitoringOverview(operationsMonitoringData);
      setSystemIncidents(incidentsData.incidents);
      setAdminAnnouncements(announcementsData.announcements);
      setMediaDashboard(mediaData);
      setCommercialControl(commercialControlData);
      setInfrastructureControl(infrastructureControlData);
      setAdminPaymentCenter(adminPaymentsData);
      setAdminInvestorManagement(investorManagementData);
      setAdminAnalystControl(analystControlData);
      setWarRoom(warRoomData);
      setTreasuryDashboard(treasuryData);
      setExecutiveSituation(executiveSituationData);
      setExecutiveAnalytics(executiveAnalyticsData);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load admin portal");
    }
  }

  async function loadInvestorData(token: string) {
    try {
      const [dashboard, profile, plans, portfolioData, reports, distributions, withdrawalData, walletData, paymentsData] = await Promise.all([
        apiGet<InvestorDashboard>("/investor/dashboard", token),
        apiGet<InvestorProfile>("/investor/profile", token),
        apiGet<{ plans: InvestmentPlan[] }>("/investor/plans", token),
        apiGet<{ active: InvestorInvestment[]; completed: InvestorInvestment[] }>("/investor/portfolio", token),
        apiGet<{ reports: InvestorPortalReport[] }>("/investor/reports", token),
        apiGet<{ distributions: InvestorDistribution[] }>("/investor/distributions", token),
        apiGet<{ withdrawals: WithdrawalRequest[] }>("/investor/withdrawals", token),
        apiGet<InvestorWallet>("/wallet", token),
        apiGet<PaymentCenter>("/payments/center", token),
      ]);
      setInvestorDashboard(dashboard);
      setInvestorProfile(profile);
      setInvestmentPlans(plans.plans);
      setPortfolio(portfolioData);
      setInvestorReports(reports.reports);
      setInvestorDistributions(distributions.distributions);
      setWithdrawals(withdrawalData.withdrawals);
      setWallet(walletData);
      setPaymentCenter(paymentsData);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load investor portal");
    }
  }

  async function loadGlobalPreferences(token: string) {
    try {
      const data = await apiGet<GlobalizationBootstrap>("/settings/preferences", token);
      setLanguages(data.languages);
      setCurrencies(data.currencies);
      setTimezones(data.timezones);
      setGlobalPreferences(data.preferences);
      localStorage.setItem("fpf_global_preferences", JSON.stringify(data.preferences));
    } catch {
      const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || defaultGlobalPreferences.timezone;
      setGlobalPreferences((current) => ({ ...current, timezone: current.timezone || browserTimezone }));
    }
  }

  async function saveGlobalPreferences(nextPreferences: Partial<UserGlobalPreferences>) {
    if (!session) return;
    const data = await apiPut<{ preferences: UserGlobalPreferences }>(
      "/settings/preferences",
      session.token,
      { ...globalPreferences, ...nextPreferences },
    );
    setGlobalPreferences(data.preferences);
    localStorage.setItem("fpf_global_preferences", JSON.stringify(data.preferences));
    setMessage("Global preferences updated.");
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
      const [dashboard, performanceData, assignmentsData, submissionsData, fixtureData, workflowData, warRoomData, treasuryData, analyticsData] = await Promise.all([
        apiGet<AnalystDashboard>("/analyst/dashboard", token),
        apiGet<AnalystPerformanceDashboard>("/analyst/performance", token),
        apiGet<{ assignments: AnalystAssignment[] }>("/analyst/assignments", token),
        apiGet<{ submissions: AnalystIntelligenceSubmission[] }>("/analyst/intelligence", token),
        apiGet<{ fixtures: FootballFixtureSummary[] }>("/intelligence/fixtures?limit=30", token),
        apiGet<PredictionWorkflowQueue>("/prediction-workflow/queue?sort=priority", token),
        apiGet<WarRoomDashboard>("/war-room", token),
        apiGet<AnalystTreasuryView>("/treasury/analyst/me", token),
        apiGet<AnalystPrivateAnalytics>("/analytics/analyst/me", token),
      ]);
      setAnalystDashboard(dashboard);
      setAnalystPerformance(performanceData);
      setAnalystAssignments(assignmentsData.assignments);
      setAnalystSubmissions(submissionsData.submissions);
      setFixtures(fixtureData.fixtures);
      setPredictionWorkflowQueue(workflowData);
      setWarRoom(warRoomData);
      setAnalystTreasury(treasuryData);
      setAnalystAnalytics(analyticsData);
      setLoadingLabel("Analyst workspace ready");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load analyst workspace");
    }
  }

  async function investorAction(path: string, body: object) {
    if (!session) return;
    await apiPost(path, session.token, body);
    await loadInvestorData(session.token);
    await loadOperationsData(session.token);
  }

  async function investorSimulate(body: InvestorSimulatorInput) {
    if (!session) throw new Error("Login required");
    return apiPost<{ simulation: InvestorSimulatorResult }>("/investor/simulator", session.token, body);
  }

  async function createInvestorFundingCheckout(body: {
    packageId: string;
    lockPeriodCode: "SIX_MONTHS" | "TWELVE_MONTHS";
    amountCents: number;
  }) {
    if (!session) return;
    const data = await apiPost<{ order: PaymentOrder }>("/payments/investor-funding/checkout", session.token, {
      ...body,
      acknowledgementsAccepted: true,
      termsAccepted: true,
    });
    setMessage("NOWPayments checkout created. Complete payment only on the official provider page.");
    await loadInvestorData(session.token);
    return data.order;
  }

  async function createSubscriptionCheckout(planCode: string, billingCycle: "MONTHLY" | "ANNUAL") {
    if (!session) return;
    const data = await apiPost<{ order: PaymentOrder }>("/payments/subscription/checkout", session.token, {
      planCode,
      billingCycle,
      purpose: "SUBSCRIPTION",
    });
    setMessage("Subscription checkout created. Access activates only after confirmed payment.");
    if (session.user.role === "ADMIN") await loadAdminData(session.token);
    else await loadOperationsData(session.token);
    return data.order;
  }

  async function adminAction(path: string, body?: object) {
    if (!session) return;
    const method = path.includes("/settings") ||
      path.includes("/notes") ||
      path.includes("/admin/monitoring/incidents/") ||
      path.includes("/admin/announcements/") ||
      path.includes("/admin/media/posts/") ||
      path.includes("/admin/commercial/investor-packages/") ||
      path.includes("/admin/infrastructure/alerts/") ||
      path.includes("/admin/infrastructure/renewals/") ||
      path.includes("/admin/infrastructure/procurement/") ||
      path.includes("/admin/analyst-applications/")
      ? "PATCH"
      : "POST";
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
    await loadOperationsData(session.token);
    await loadAdminData(session.token);
    if (session.user.role === "ADMIN") await loadSubscriberData(session.token);
  }

  async function adminSimulate(body: InvestorSimulatorInput) {
    if (!session) throw new Error("Login required");
    return apiPost<{ simulation: InvestorSimulatorResult }>("/admin/investor-simulator", session.token, body);
  }

  async function markNotificationRead(id: string) {
    if (!session) return;
    await apiPatch<{ notification: OperationalNotification }>(`/notifications/${id}/read`, session.token);
    await loadOperationsData(session.token);
  }

  async function saveNotificationPreferences(nextPreferences: Partial<NotificationPreferences>) {
    if (!session || !notificationPreferences) return;
    const preferences = await apiPut<NotificationPreferences>("/notifications/preferences", session.token, {
      ...notificationPreferences,
      ...nextPreferences,
      securityEnabled: true,
    });
    setNotificationPreferences(preferences);
    setMessage("Notification preferences updated.");
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

  function clearPrivateClientState() {
    setAdminMode(false);
    setActiveView("Subscriber Home");
    setActiveAdminView("Admin Dashboard");
    setActiveInvestorView("Investor Dashboard");
    setActiveAnalystView("Analyst Dashboard");
    setGlobalSearch("");
    setFavoriteModules([]);
    setRecentPages([]);
    setFixtures([]);
    setLiveFixtures([]);
    setSelectedFixture(null);
    setPredictions([]);
    setSelectedPrediction(null);
    setSlip([]);
    setFilters({ search: "", league: "", country: "", date: "" });
    setAdminOverview(null);
    setAdminPredictions([]);
    setAdminDecisionOutputs([]);
    setPredictionWorkflowQueue(null);
    setPublishedWorkflowPredictions([]);
    setAdminUsers([]);
    setAuditLogs([]);
    setSyncLogs([]);
    setAdminSettings(null);
    setAdminReports(null);
    setPlatformHealth(null);
    setAdminInvestorManagement(null);
    setInvestorDashboard(null);
    setInvestorProfile(null);
    setInvestmentPlans([]);
    setPortfolio({ active: [], completed: [] });
    setInvestorReports([]);
    setInvestorDistributions([]);
    setWithdrawals([]);
    setWallet(null);
    setPublishedIntelligence([]);
    setAnalystDashboard(null);
    setAnalystPerformance(null);
    setAnalystAssignments([]);
    setAnalystSubmissions([]);
    setAnalystAssistance(null);
    setAdminIntelligence([]);
    setAdminAnalystControl(null);
    setWarRoom(null);
    setTreasuryDashboard(null);
    setExecutiveSituation(null);
    setAnalystTreasury(null);
    setExecutiveAnalytics(null);
    setAnalystAnalytics(null);
    setSubscriberCommandCenter(null);
    setDecisionOutputs([]);
    setOperationalReports([]);
    setMonitoringOverview(null);
    setSystemIncidents([]);
    setOperationalNotifications([]);
    setNotificationPreferences(null);
    setAdminAnnouncements([]);
    setMediaDashboard(null);
    setCommercialControl(null);
    setInfrastructureControl(null);
    setPaymentCenter(null);
    setAdminPaymentCenter(null);
    localStorage.removeItem("fpf_favorite_modules");
    localStorage.removeItem("fpf_recent_pages");
  }

  function signOut() {
    localStorage.removeItem("fpf_session");
    sessionStorage.removeItem("fpf_session");
    clearPrivateClientState();
    setSession(null);
    setMessage("You have been signed out securely.");
    setError("");
    setMode("login");
    window.history.replaceState(null, "", "/");
    setCurrentPath("/");
  }

  function navigatePublic(path: string, id?: string) {
    const page = getCanonicalPublicPage(path);
    const nextPath = page?.path ?? path;
    window.history.pushState(null, "", nextPath);
    setCurrentPath(nextPath);
    if (id ?? page?.id) scrollPublicSection(id ?? page!.id);
  }

  function currentModuleLabel() {
    if (adminMode) return activeAdminView;
    if (session?.user.role === "INVESTOR") return activeInvestorView;
    if (session?.user.role === "ANALYST") return activeAnalystView;
    return activeView;
  }

  function rememberPage(label: string) {
    setRecentPages((current) => {
      const next = [label, ...current.filter((item) => item !== label)].slice(0, 6);
      localStorage.setItem("fpf_recent_pages", JSON.stringify(next));
      return next;
    });
  }

  function toggleFavorite(label: string) {
    setFavoriteModules((current) => {
      const next = current.includes(label)
        ? current.filter((item) => item !== label)
        : [label, ...current].slice(0, 8);
      localStorage.setItem("fpf_favorite_modules", JSON.stringify(next));
      return next;
    });
  }

  function activateTarget(target: string) {
    const label = target as PlatformNavTarget;
    if (adminMode && (adminNavItems as readonly string[]).includes(label)) {
      setActiveAdminView(label as AdminNavItem);
    } else if (session?.user.role === "INVESTOR" && (investorNavItemsWithWallet as readonly string[]).includes(label)) {
      setActiveInvestorView(label as InvestorNavItem);
    } else if (session?.user.role === "ANALYST" && (analystNavItems as readonly string[]).includes(label)) {
      setActiveAnalystView(label as AnalystNavItem);
    } else if ((navItems as readonly string[]).includes(label)) {
      setActiveView(label as NavItem);
    } else if ((adminNavItems as readonly string[]).includes(label) && session?.user.role === "ADMIN") {
      setAdminMode(true);
      setActiveAdminView(label as AdminNavItem);
    }
    rememberPage(label);
  }

  if (!session) {
    return (
      <PublicLaunchExperience
        apiCheck={apiCheck}
        apiUrl={apiUrl}
        commercialStructure={commercialStructure}
        currencies={currencies}
        error={error}
        experience={publicExperience}
        languages={languages}
        message={message}
        mode={mode}
        currentPath={currentPath}
        onApiTest={testApiConnection}
        onForgot={safelySubmit(handleForgotPassword)}
        onNavigate={navigatePublic}
        onLocalPreferenceChange={(next) => {
          const updated = { ...globalPreferences, ...next };
          setGlobalPreferences(updated);
          localStorage.setItem("fpf_global_preferences", JSON.stringify(updated));
        }}
        onLogin={safelySubmit(handleLogin)}
        onRegister={safelySubmit(handleRegister)}
        onThemeChange={setThemePreference}
        preferences={globalPreferences}
        setMode={setMode}
        theme={themePreference}
      />
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
    <main className="min-h-dvh bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col lg:h-dvh lg:flex-row lg:overflow-hidden">
        <aside className="flex max-h-dvh flex-col overflow-hidden border-b border-zinc-800 bg-zinc-950/95 px-4 py-4 lg:sticky lg:top-0 lg:h-dvh lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r lg:p-6">
          <div className="shrink-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Football Performance Fund</p>
            <h1 className="mt-2 text-xl font-bold">{adminMode ? "Admin Command" : session.user.role === "INVESTOR" ? "Performance Partner Platform" : session.user.role === "ANALYST" ? "Analyst Operations" : "Subscriber Platform"}</h1>
          </div>
          <div className="mt-4 shrink-0">
            <ThemeSwitcher theme={themePreference} onChange={setThemePreference} />
          </div>
          <nav className="mt-4 grid min-h-0 max-h-[48vh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-5 lg:max-h-none lg:flex-1 lg:grid-cols-1 lg:pr-2" aria-label="Unified FPF navigation">
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
                onClick={() => activateTarget(item)}
              >
                {displayNavigationLabel(item)}
              </button>
            ))}
          </nav>
          <div className="mt-4 shrink-0 border-t border-zinc-800 pt-4">
            <div className="rounded-md border border-zinc-800 bg-zinc-900/70 p-3 text-sm">
              <p className="font-semibold text-white">{session.user.name}</p>
              <p className="mt-1 truncate text-xs text-zinc-400">{session.user.email}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.12em] text-emerald-300">{roleLabels[session.user.role]}</p>
            </div>
            {session.user.role === "ADMIN" ? (
              <button
                className="mt-3 w-full rounded-md border border-emerald-800 px-3 py-3 text-sm text-emerald-200 transition hover:border-emerald-300"
                type="button"
                onClick={() => setAdminMode((current) => !current)}
              >
                {adminMode ? "Subscriber View" : "Admin Command"}
              </button>
            ) : null}
            <button
              aria-label="Sign out securely"
              className="mt-3 w-full rounded-md border border-zinc-800 px-3 py-3 text-sm font-semibold text-zinc-300 transition hover:border-emerald-300 hover:text-white"
              type="button"
              onClick={signOut}
            >
              Sign out
            </button>
          </div>
        </aside>

        <section className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:h-dvh lg:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm text-emerald-300">{loadingLabel} | {roleLabels[session.user.role]} workspace</p>
              <h2 className="mt-1 text-3xl font-bold tracking-normal">Welcome, {session.user.name}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
                Unified FPF Platform | Ready
              </div>
              <button
                aria-label="Sign out securely from the user menu"
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-semibold text-zinc-300 transition hover:border-emerald-300 hover:text-white"
                type="button"
                onClick={signOut}
              >
                Sign out
              </button>
            </div>
            <GlobalPreferenceBar
              currencies={currencies}
              languages={languages}
              preferences={globalPreferences}
              timezones={timezones}
              onSave={(next) => void saveGlobalPreferences(next)}
            />
          </div>

          <UnifiedCommandBar
            favorites={favoriteModules}
            notifications={operationalNotifications}
            query={globalSearch}
            recentPages={recentPages}
            results={searchResults}
            role={session.user.role}
            activeModule={currentModuleLabel()}
            onFavorite={() => toggleFavorite(currentModuleLabel())}
            onNotifications={() => {
              if (session.user.role === "SUBSCRIBER") setActiveView("Notifications");
              else if (session.user.role === "INVESTOR") setActiveInvestorView("Support");
              else if (session.user.role === "ANALYST") setActiveAnalystView("Analyst Dashboard");
              else setActiveAdminView("Monitoring");
            }}
            onQuery={setGlobalSearch}
            onResult={(result) => {
              if (!result.target) return;
              activateTarget(result.target);
            }}
            onSettings={() => {
              if (adminMode) setActiveAdminView("Settings");
              else if (session.user.role === "SUBSCRIBER") setActiveView("Settings");
              else if (session.user.role === "INVESTOR") setActiveInvestorView("Settings");
              else if (session.user.role === "ANALYST") setActiveAnalystView("Settings");
            }}
          />
          <UnifiedOperatingSystemStrip
            activeModule={currentModuleLabel()}
            favorites={favoriteModules}
            recentPages={recentPages}
            role={session.user.role}
            onOpen={activateTarget}
            onToggleFavorite={() => toggleFavorite(currentModuleLabel())}
          />

          {error ? <p className="mt-4 rounded-md bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
          {message ? <p className="mt-4 rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</p> : null}

          {showLaunchCenter ? (
            <LaunchExperienceCenter
              role={session.user.role}
              onDismiss={() => {
                localStorage.setItem("fpf_launch_center_seen", "true");
                setShowLaunchCenter(false);
              }}
            />
          ) : null}

          {adminMode ? (
            <AdminPortal
              activeView={activeAdminView}
              auditLogs={auditLogs}
              fixtures={fixtures}
              decisions={adminDecisionOutputs}
              workflowQueue={predictionWorkflowQueue}
              warRoom={warRoom}
              overview={adminOverview}
              predictions={adminPredictions}
              intelligence={adminIntelligence}
              investorManagement={adminInvestorManagement}
              reports={adminReports}
              settings={adminSettings}
              health={platformHealth}
              syncLogs={syncLogs}
              users={adminUsers}
              onAction={adminAction}
              onSimulate={adminSimulate}
              globalization={{ languages, currencies, timezones, preferences: globalPreferences }}
              onGlobalPreferences={saveGlobalPreferences}
              commercialStructure={commercialStructure}
              monitoringOverview={monitoringOverview}
              operationalReports={operationalReports}
              systemIncidents={systemIncidents}
              adminAnnouncements={adminAnnouncements}
              analystControl={adminAnalystControl}
              mediaDashboard={mediaDashboard}
              commercialControl={commercialControl}
              infrastructureControl={infrastructureControl}
              paymentCenter={adminPaymentCenter}
              treasuryDashboard={treasuryDashboard}
              executiveSituation={executiveSituation}
              executiveAnalytics={executiveAnalytics}
            />
          ) : null}

          {!adminMode && session.user.role === "ANALYST" && activeAnalystView === "Profile" ? (
            <ProfileView
              currencies={currencies}
              languages={languages}
              onSignOut={signOut}
              onPasswordChange={safelySubmit(handlePasswordChange)}
              onPreferences={saveGlobalPreferences}
              preferences={globalPreferences}
              session={session}
              timezones={timezones}
            />
          ) : null}

          {!adminMode && session.user.role === "ANALYST" && activeAnalystView === "Settings" ? (
            <SettingsCenterView
              currencies={currencies}
              languages={languages}
              notificationPreferences={notificationPreferences}
              notifications={operationalNotifications}
              onSignOut={signOut}
              onPasswordChange={safelySubmit(handlePasswordChange)}
              onPreferences={saveGlobalPreferences}
              onSaveNotificationPreferences={saveNotificationPreferences}
              preferences={globalPreferences}
              session={session}
              timezones={timezones}
            />
          ) : null}

          {!adminMode && session.user.role === "ANALYST" && activeAnalystView !== "Profile" && activeAnalystView !== "Settings" ? (
            <AnalystPortal
              activeView={activeAnalystView}
              assignments={analystAssignments}
              assistance={analystAssistance}
              dashboard={analystDashboard}
              performance={analystPerformance}
              fixtures={fixtures}
              workflowQueue={predictionWorkflowQueue}
              warRoom={warRoom}
              treasury={analystTreasury}
              analytics={analystAnalytics}
              submissions={analystSubmissions}
              onAction={analystAction}
              onAssistance={loadAnalystAssistance}
            />
          ) : null}

          {!adminMode && session.user.role === "INVESTOR" && activeInvestorView === "Settings" ? (
            <SettingsCenterView
              currencies={currencies}
              languages={languages}
              notificationPreferences={notificationPreferences}
              notifications={operationalNotifications}
              onSignOut={signOut}
              onPasswordChange={safelySubmit(handlePasswordChange)}
              onPreferences={saveGlobalPreferences}
              onSaveNotificationPreferences={saveNotificationPreferences}
              preferences={globalPreferences}
              session={session}
              timezones={timezones}
            />
          ) : null}

          {!adminMode && session.user.role === "INVESTOR" && activeInvestorView !== "Settings" ? (
            <InvestorPortal
              activeView={activeInvestorView}
              dashboard={investorDashboard}
              distributions={investorDistributions}
              profile={investorProfile}
              plans={investmentPlans}
              portfolio={portfolio}
              reports={investorReports}
              wallet={wallet}
              paymentCenter={paymentCenter}
              withdrawals={withdrawals}
              notifications={investorNotifications}
              onAction={investorAction}
              onInvestorFundingCheckout={createInvestorFundingCheckout}
              onSubscriptionCheckout={createSubscriptionCheckout}
              onSimulate={investorSimulate}
              commercialStructure={commercialStructure}
            />
          ) : null}

          {!adminMode && session.user.role !== "INVESTOR" && session.user.role !== "ANALYST" && activeView === "Subscriber Home" ? (
            <DashboardView
              commandCenter={subscriberCommandCenter}
              decisions={decisionOutputs}
              workflowPredictions={publishedWorkflowPredictions}
              featured={featured}
              intelligence={publishedIntelligence}
              liveFixtures={liveFixtures}
              notifications={notifications}
              predictions={predictions}
              recent={recent}
              upcomingFixtures={upcomingFixtures}
              onAdd={addToSlip}
              onRefreshFixtures={() => void loadSubscriberData(session.token)}
            />
          ) : null}
          {!adminMode && session.user.role !== "INVESTOR" && session.user.role !== "ANALYST" && activeView === "Opportunity Center" ? (
            <OpportunityCenterView
              commandCenter={subscriberCommandCenter}
              decisions={decisionOutputs}
              workflowPredictions={publishedWorkflowPredictions}
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
              onRefresh={() => void loadLiveFixtures(session.token)}
            />
          ) : null}
          {!adminMode && session.user.role !== "INVESTOR" && session.user.role !== "ANALYST" && activeView === "Intelligence Reports" ? (
            <ReportsView operationalReports={operationalReports} reports={subscriberCommandCenter?.reports ?? []} />
          ) : null}
          {!adminMode && session.user.role !== "INVESTOR" && session.user.role !== "ANALYST" && activeView === "Profile" ? (
            <ProfileView
              currencies={currencies}
              languages={languages}
              onSignOut={signOut}
              onPasswordChange={safelySubmit(handlePasswordChange)}
              onPreferences={saveGlobalPreferences}
              preferences={globalPreferences}
              session={session}
              timezones={timezones}
            />
          ) : null}
          {!adminMode && session.user.role !== "INVESTOR" && session.user.role !== "ANALYST" && activeView === "Settings" ? (
            <SettingsCenterView
              currencies={currencies}
              languages={languages}
              notificationPreferences={notificationPreferences}
              notifications={operationalNotifications}
              onSignOut={signOut}
              onPasswordChange={safelySubmit(handlePasswordChange)}
              onPreferences={saveGlobalPreferences}
              onSaveNotificationPreferences={saveNotificationPreferences}
              preferences={globalPreferences}
              session={session}
              timezones={timezones}
            />
          ) : null}
          {!adminMode && session.user.role !== "INVESTOR" && session.user.role !== "ANALYST" && activeView === "Notifications" ? (
            <NotificationCenterView
              legacyNotifications={subscriberCommandCenter?.notifications ?? []}
              notifications={operationalNotifications}
              preferences={notificationPreferences}
              onMarkRead={markNotificationRead}
              onSavePreferences={saveNotificationPreferences}
            />
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
  analystControl,
  auditLogs,
  decisions,
  fixtures,
  health,
  intelligence,
  investorManagement,
  warRoom,
  globalization,
  commercialStructure,
  monitoringOverview,
  operationalReports,
  systemIncidents,
  adminAnnouncements,
  mediaDashboard,
  commercialControl,
  infrastructureControl,
  paymentCenter,
  treasuryDashboard,
  executiveSituation,
  executiveAnalytics,
  onGlobalPreferences,
  onAction,
  onSimulate,
  overview,
  predictions,
  reports,
  settings,
  syncLogs,
  users,
  workflowQueue,
}: {
  activeView: AdminNavItem;
  analystControl: AdminAnalystControlCenter | null;
  auditLogs: AuditLogEntry[];
  decisions: DecisionEngineOutput[];
  fixtures: FootballFixtureSummary[];
  health: PlatformHealth | null;
  intelligence: AnalystIntelligenceSubmission[];
  investorManagement: AdminInvestorManagement | null;
  warRoom: WarRoomDashboard | null;
  globalization: {
    languages: LanguageSetting[];
    currencies: CurrencySetting[];
    timezones: TimezoneSetting[];
    preferences: UserGlobalPreferences;
  };
  commercialStructure: CommercialStructure;
  monitoringOverview: MonitoringOverview | null;
  operationalReports: OperationalReport[];
  systemIncidents: SystemIncident[];
  adminAnnouncements: AdminAnnouncement[];
  mediaDashboard: MediaDashboard | null;
  commercialControl: CommercialControlCenter | null;
  infrastructureControl: InfrastructureControlCenter | null;
  paymentCenter: PaymentCenter | null;
  treasuryDashboard: TreasuryDashboard | null;
  executiveSituation: ExecutiveSituationRoom | null;
  executiveAnalytics: ExecutiveAnalyticsDashboard | null;
  onGlobalPreferences: (preferences: Partial<UserGlobalPreferences>) => Promise<void>;
  onAction: (path: string, body?: object) => Promise<void>;
  onSimulate: (body: InvestorSimulatorInput) => Promise<{ simulation: InvestorSimulatorResult }>;
  overview: AdminOverview | null;
  predictions: PredictionResult[];
  reports: AdminReports | null;
  settings: AdminSettings | null;
  syncLogs: AuditLogEntry[];
  users: AdminUser[];
  workflowQueue: PredictionWorkflowQueue | null;
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

  if (activeView === "Executive BI") {
    return <ExecutiveBiView dashboard={executiveAnalytics} />;
  }

  if (activeView === "Infrastructure Center") {
    return <InfrastructureControlCenterView control={infrastructureControl} onAction={onAction} />;
  }

  if (activeView === "Payment Center") {
    return <AdminPaymentCenterView center={paymentCenter} onAction={onAction} />;
  }

  if (activeView === "Prediction Review") {
    return (
      <Panel title="Prediction Review">
        <div className="space-y-3">
          <PredictionWorkflowPanel queue={workflowQueue} onAction={onAction} />
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
    return <AdminReportsView operationalReports={operationalReports} reports={reports} onAction={onAction} />;
  }

  if (activeView === "Investor Management") {
    return <AdminInvestorManagementView commercialStructure={commercialStructure} management={investorManagement} onAction={onAction} onSimulate={onSimulate} />;
  }

  if (activeView === "Business Control") {
    return <BusinessControlCenterView control={commercialControl} onAction={onAction} />;
  }

  if (activeView === "Media Command") {
    return <MediaCommandCenterView dashboard={mediaDashboard} onAction={onAction} />;
  }

  if (activeView === "Monitoring") {
    return <MonitoringDashboardView health={health} incidents={systemIncidents} monitoring={monitoringOverview} syncLogs={syncLogs} onAction={onAction} />;
  }

  if (activeView === "Announcements") {
    return <AdminAnnouncementsView announcements={adminAnnouncements} onAction={onAction} />;
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
              <p className="mt-1 text-sm text-zinc-400">{submission.market} Â· {submission.prediction}</p>
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

  if (activeView === "Analyst Command") {
    return <AdminAnalystCommandCenter control={analystControl} onAction={onAction} />;
  }

  if (activeView === "War Room") {
    return <WarRoomView dashboard={warRoom} isAdmin={true} onAction={onAction} />;
  }

  if (activeView === "Treasury Center") {
    return <TreasuryCenterView dashboard={treasuryDashboard} onAction={onAction} />;
  }

  if (activeView === "Executive Situation") {
    return <ExecutiveSituationRoomView situation={executiveSituation} />;
  }

  if (activeView === "Global Command Wall") {
    return <ExecutiveGlobalCommandWallPlaceholder />;
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
                  <p className="text-sm text-zinc-400">{user.email} Â· {user.role} Â· {user.status}</p>
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
      <div className="mt-6">
        <AdminGlobalizationControls
          currencies={globalization.currencies}
          languages={globalization.languages}
          onAction={onAction}
          settings={settings}
        />
        <AdminCommercialControls
          commercialStructure={commercialStructure}
          onAction={onAction}
          settings={settings}
        />
        <GlobalPreferencesForm
          currencies={globalization.currencies}
          languages={globalization.languages}
          preferences={globalization.preferences}
          timezones={globalization.timezones}
          title="Global Defaults Preview"
          onSave={onGlobalPreferences}
        />
      </div>
    </Panel>
  );
}

function AnalystPortal({
  activeView,
  assignments,
  assistance,
  dashboard,
  performance,
  fixtures,
  onAction,
  onAssistance,
  submissions,
  workflowQueue,
  warRoom,
  treasury,
  analytics,
}: {
  activeView: AnalystNavItem;
  assignments: AnalystAssignment[];
  assistance: AnalystAssistance | null;
  dashboard: AnalystDashboard | null;
  performance: AnalystPerformanceDashboard | null;
  fixtures: FootballFixtureSummary[];
  onAction: (path: string, body?: object) => Promise<void>;
  onAssistance: (fixtureId: string) => Promise<void>;
  submissions: AnalystIntelligenceSubmission[];
  workflowQueue: PredictionWorkflowQueue | null;
  warRoom: WarRoomDashboard | null;
  treasury: AnalystTreasuryView | null;
  analytics: AnalystPrivateAnalytics | null;
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
          <Metric label="ARI" value={String(performance?.reliability.analystReliabilityIndex ?? 50)} />
        </div>
        <Panel title="Professional Analyst Status">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiniStat label="Internal rank" value={performance?.profile.rank ?? "ACADEMY"} />
            <MiniStat label="Reliability index" value={`${performance?.reliability.analystReliabilityIndex ?? 50}/100`} />
            <MiniStat label="Capital allocation" value={money(performance?.profile.capitalAllocationCents ?? 0)} />
            <MiniStat label="Graduation AI" value={performance?.graduationRecommendation.replace("_", " ") ?? "PENDING"} />
          </div>
          <p className="mt-4 text-sm text-zinc-400">Internal analyst data is never exposed to subscribers. Published outputs appear only as FPF Intelligence.</p>
        </Panel>
        <Panel title="Assigned Matches">
          <div className="space-y-2">
            {assignments.map((assignment) => (
              <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3" key={assignment.id}>
                <p className="font-semibold">{assignment.match}</p>
                <p className="mt-1 text-sm text-zinc-400">{assignment.leagueName} Â· {assignment.status}</p>
                {assignment.adminNotes ? <p className="mt-1 text-sm text-zinc-500">{assignment.adminNotes}</p> : null}
              </div>
            ))}
            {!assignments.length ? <p className="text-sm text-zinc-400">No matches have been assigned yet.</p> : null}
          </div>
        </Panel>
        <PredictionWorkflowPanel queue={workflowQueue} onAction={onAction} />
        <Panel title="Submitted Intelligence">
          <InternalSubmissionList submissions={submissions} />
        </Panel>
      </div>
    );
  }

  if (activeView === "Academy") {
    return <AnalystAcademyView performance={performance} onAction={onAction} />;
  }

  if (activeView === "War Room") {
    return <WarRoomView dashboard={warRoom} isAdmin={false} onAction={onAction} />;
  }

  if (activeView === "Treasury") {
    return <AnalystTreasuryViewPanel treasury={treasury} />;
  }

  if (activeView === "Performance") {
    return <AnalystPerformanceView performance={performance} />;
  }

  if (activeView === "My Analytics") {
    return <AnalystPrivateAnalyticsView analytics={analytics} />;
  }

  if (activeView === "Rewards") {
    return <AnalystRewardView performance={performance} />;
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

function AnalystAcademyView({
  performance,
  onAction,
}: {
  performance: AnalystPerformanceDashboard | null;
  onAction: (path: string, body?: object) => Promise<void>;
}) {
  return (
    <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_380px]">
      <Panel title="FPF Analyst Academy">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MiniStat label="Status" value={performance?.academy?.status ?? "Pending academy activation"} />
          <MiniStat label="Duration" value={`${performance?.academy?.durationDays ?? 14} days`} />
          <MiniStat label="Virtual wallet" value={money(performance?.academy?.virtualWalletCents ?? 0)} />
          <MiniStat label="Virtual capital" value={money(performance?.academy?.virtualCapitalCents ?? 0)} />
        </div>
        <p className="mt-4 text-sm leading-6 text-zinc-400">
          Academy activity uses demo fixtures, virtual capital, and internal evaluation only. No subscriber visibility and no real company capital.
        </p>
        <div className="mt-4 space-y-2">
          {(performance?.demoPredictions ?? []).map((prediction) => (
            <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3" key={prediction.id}>
              <p className="font-semibold">{prediction.matchName}</p>
              <p className="mt-1 text-sm text-zinc-400">{prediction.market} | {prediction.prediction} | {prediction.result}</p>
            </div>
          ))}
          {!performance?.demoPredictions.length ? <p className="text-sm text-zinc-400">No demo predictions submitted yet.</p> : null}
        </div>
      </Panel>
      <Panel title="Demo Prediction Engine">
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void onAction("/analyst/predictions", {
              matchName: form.get("matchName"),
              leagueName: form.get("leagueName"),
              market: form.get("market"),
              prediction: form.get("prediction"),
              confidence: Number(form.get("confidence")),
              riskLevel: form.get("riskLevel"),
              explanation: form.get("explanation"),
              supportingNotes: form.get("supportingNotes"),
              stakeCents: Math.round(Number(form.get("stake")) * 100),
              odds: Number(form.get("odds")),
            });
          }}
        >
          <TextField label="Match" name="matchName" type="text" />
          <TextField label="League" name="leagueName" type="text" />
          <SelectField label="Market" name="market" value="MATCH_WINNER" options={["MATCH_WINNER", "DOUBLE_CHANCE", "BTTS", "OVER_UNDER", "CORRECT_SCORE", "CORNERS", "CARDS", "ANYTIME_SCORER", "FIRST_GOAL_SCORER"].map((item) => ({ value: item, label: item.replaceAll("_", " ") }))} />
          <TextField label="Prediction" name="prediction" type="text" />
          <TextField label="Confidence" name="confidence" type="number" value="60" />
          <SelectField label="Risk" name="riskLevel" value="MEDIUM" options={["LOW", "MEDIUM", "HIGH"].map((item) => ({ value: item, label: item }))} />
          <TextField label="Stake" name="stake" type="number" value="10" />
          <TextField label="Odds" name="odds" type="number" value="1.9" />
          <TextField label="Explanation" name="explanation" type="text" />
          <TextField label="Supporting notes" name="supportingNotes" type="text" />
          <SubmitButton>Submit demo prediction</SubmitButton>
        </form>
      </Panel>
    </div>
  );
}

function AnalystPerformanceView({ performance }: { performance: AnalystPerformanceDashboard | null }) {
  const reliability = performance?.reliability;
  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="ARI" value={`${reliability?.analystReliabilityIndex ?? 50}/100`} />
        <Metric label="Win rate" value={`${(reliability?.winRate ?? 0).toFixed(1)}%`} />
        <Metric label="ROI" value={`${(reliability?.roi ?? 0).toFixed(1)}%`} />
        <Metric label="Drawdown" value={`${(reliability?.drawdown ?? 0).toFixed(1)}%`} />
        <Metric label="Discipline" value={`${reliability?.discipline ?? 50}/100`} />
      </div>
      <Panel title="AI Performance Evaluation">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MiniStat label="Accuracy" value={`${reliability?.predictionAccuracy ?? 0}%`} />
          <MiniStat label="Risk management" value={`${reliability?.riskManagement ?? 50}/100`} />
          <MiniStat label="Calibration" value={`${reliability?.confidenceCalibration ?? 50}/100`} />
          <MiniStat label="Consistency" value={`${reliability?.consistency ?? 50}/100`} />
          <MiniStat label="Prediction quality" value={`${reliability?.predictionQuality ?? 50}/100`} />
          <MiniStat label="Market specialization" value={`${reliability?.marketSpecialization ?? 50}/100`} />
          <MiniStat label="Current form" value={`${performance?.profile.currentForm ?? 50}/100`} />
          <MiniStat label="Rank" value={performance?.profile.rank ?? "ACADEMY"} />
        </div>
        <div className="mt-4 space-y-2">
          {(performance?.aiFeedback ?? []).map((item) => <p className="rounded-md border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300" key={item}>{item}</p>)}
        </div>
      </Panel>
    </div>
  );
}

function AnalystRewardView({ performance }: { performance: AnalystPerformanceDashboard | null }) {
  return (
    <div className="mt-6 grid gap-4 xl:grid-cols-2">
      <Panel title="Capital Allocation">
        <div className="space-y-3">
          {(performance?.capitalAllocations ?? []).map((allocation) => (
            <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3" key={allocation.id}>
              <p className="font-semibold">{money(allocation.weeklyAllocationCents)} weekly allocation</p>
              <p className="mt-1 text-sm text-zinc-400">{allocation.reason}</p>
            </div>
          ))}
          {!performance?.capitalAllocations.length ? <p className="text-sm text-zinc-400">No company capital allocated yet.</p> : null}
        </div>
      </Panel>
      <Panel title="Reward Dashboard">
        <p className="text-sm text-zinc-400">Default placeholder reward pool: 20% of company net profits. Final calculations remain admin-audited.</p>
        <div className="mt-4 space-y-3">
          {(performance?.rewards ?? []).map((reward) => (
            <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3" key={reward.id}>
              <p className="font-semibold">{money(reward.rewardCents)} | {reward.status}</p>
              <p className="mt-1 text-sm text-zinc-400">Risk-adjusted score {reward.riskAdjustedScore}/100</p>
            </div>
          ))}
          {!performance?.rewards.length ? <p className="text-sm text-zinc-400">No rewards calculated yet.</p> : null}
        </div>
      </Panel>
    </div>
  );
}

function AdminAnalystCommandCenter({
  control,
  onAction,
}: {
  control: AdminAnalystControlCenter | null;
  onAction: (path: string, body?: object) => Promise<void>;
}) {
  if (!control) return <LoadingSkeleton label="Preparing Analyst Command Center" />;
  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Applications" value={String(control.applications.length)} />
        <Metric label="Analysts" value={String(control.analysts.length)} />
        <Metric label="Academy" value={String(control.academy.length)} />
        <Metric label="Demo predictions" value={String(control.predictions.length)} />
        <Metric label="Fraud signals" value={String(control.fraudSignals.length)} />
        <Metric label="Reward pool" value={`${control.rewardPoolPercent}%`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Analyst Applications">
          <div className="space-y-3">
            {control.applications.map((application) => (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={application.id}>
                <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">{application.status}</p>
                <h3 className="mt-2 font-semibold">{application.fullName}</h3>
                <p className="mt-1 text-sm text-zinc-400">{application.email} | {application.country} | {application.yearsOfExperience} years</p>
                <p className="mt-2 text-sm text-zinc-300">{application.predictionStyle}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="rounded-md bg-emerald-300 px-3 py-2 text-xs font-semibold text-zinc-950" type="button" onClick={() => void onAction(`/admin/analyst-applications/${application.id}/status`, { status: "APPROVED_FOR_ACADEMY", adminNotes: "Approved for FPF Academy." })}>Approve Academy</button>
                  <button className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-200" type="button" onClick={() => void onAction(`/admin/analyst-applications/${application.id}/status`, { status: "WAITING_LIST", adminNotes: "Placed on waiting list." })}>Waitlist</button>
                  <button className="rounded-md border border-red-800 px-3 py-2 text-xs text-red-100" type="button" onClick={() => void onAction(`/admin/analyst-applications/${application.id}/status`, { status: "REJECTED", adminNotes: "Rejected by admin review." })}>Reject</button>
                </div>
              </div>
            ))}
            {!control.applications.length ? <p className="text-sm text-zinc-400">No analyst applications submitted yet.</p> : null}
          </div>
        </Panel>
        <Panel title="Active Analyst Control">
          <form
            className="mb-4 grid gap-3 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void onAction("/admin/analyst/promote", {
                analystId: form.get("analystId"),
                adminNotes: form.get("adminNotes"),
              });
            }}
          >
            <TextField label="Analyst user ID" name="analystId" type="text" />
            <TextField label="Admin notes" name="adminNotes" type="text" />
            <div className="md:col-span-2"><SubmitButton>Promote analyst</SubmitButton></div>
          </form>
          <button className="mb-4 rounded-md border border-emerald-700 px-3 py-2 text-sm text-emerald-100" type="button" onClick={() => void onAction("/admin/analyst/reward-calculate")}>Calculate reward pool</button>
          <div className="space-y-3">
            {control.analysts.map((analyst) => (
              <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3" key={analyst.id}>
                <p className="font-semibold">{analyst.name} | {analyst.rank}</p>
                <p className="mt-1 text-sm text-zinc-400">ARI {analyst.reliabilityIndex}/100 | Allocation {money(analyst.capitalAllocationCents)}</p>
                <button className="mt-2 rounded-md border border-amber-700 px-3 py-2 text-xs text-amber-100" type="button" onClick={() => void onAction("/admin/analyst/suspend", { analystId: analyst.userId, adminNotes: "Suspended by admin control." })}>Suspend</button>
              </div>
            ))}
            {!control.analysts.length ? <p className="text-sm text-zinc-400">No active analyst profiles yet.</p> : null}
          </div>
        </Panel>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Capital Allocation">
          <div className="space-y-2">
            {control.capitalAllocations.map((allocation) => <p className="rounded-md bg-zinc-950 p-3 text-sm text-zinc-300" key={allocation.id}>{allocation.analystId}: {money(allocation.weeklyAllocationCents)} weekly</p>)}
            {!control.capitalAllocations.length ? <p className="text-sm text-zinc-400">No allocations calculated.</p> : null}
          </div>
        </Panel>
        <Panel title="Rewards">
          <div className="space-y-2">
            {control.rewards.map((reward) => <p className="rounded-md bg-zinc-950 p-3 text-sm text-zinc-300" key={reward.id}>{reward.analystId}: {money(reward.rewardCents)} | {reward.status}</p>)}
            {!control.rewards.length ? <p className="text-sm text-zinc-400">No reward calculations yet.</p> : null}
          </div>
        </Panel>
        <Panel title="Fraud Detection">
          <div className="space-y-2">
            {control.fraudSignals.map((signal) => <p className="rounded-md bg-zinc-950 p-3 text-sm text-zinc-300" key={signal.id}>{signal.severity}: {signal.description}</p>)}
            {!control.fraudSignals.length ? <p className="text-sm text-zinc-400">No open fraud signals.</p> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function WarRoomView({
  dashboard,
  isAdmin,
  onAction,
}: {
  dashboard: WarRoomDashboard | null;
  isAdmin: boolean;
  onAction: (path: string, body?: object) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  if (!dashboard) return <LoadingSkeleton label="Preparing FPF Intelligence War Room" />;
  const searchable = dashboard.searchIndex.filter((item) =>
    `${item.category} ${item.title} ${item.description}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="mt-6 space-y-4">
      <Panel title="FPF Intelligence War Room">
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div>
            <p className="text-sm leading-6 text-zinc-300">
              Private operational workspace for Admin, executives, and approved analysts. Subscribers, investors, and the public never see War Room activity.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <MiniStat label="Today" value={String(dashboard.todayFixtures.length)} />
              <MiniStat label="Tomorrow" value={String(dashboard.tomorrowFixtures.length)} />
              <MiniStat label="Assignments" value={String(dashboard.assignments.length)} />
              <MiniStat label="Discussions" value={String(dashboard.discussions.length)} />
              <MiniStat label="Alerts" value={String(dashboard.alerts.length)} />
            </div>
          </div>
          <div>
            <TextField label="Search War Room" name="warRoomSearch" type="text" value={search} onChange={setSearch} />
            {search ? (
              <div className="mt-2 max-h-48 overflow-auto rounded-md border border-zinc-800 bg-zinc-950">
                {searchable.slice(0, 8).map((item) => (
                  <div className="border-b border-zinc-900 p-3 text-sm" key={`${item.category}:${item.title}`}>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-zinc-400">{item.category} | {item.description}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Live Match Center">
          <WarRoomFixtureList title="Today's Fixtures" fixtures={dashboard.todayFixtures} />
          <div className="mt-5">
            <WarRoomFixtureList title="Tomorrow's Fixtures" fixtures={dashboard.tomorrowFixtures} />
          </div>
        </Panel>
        <Panel title="Match Assignments">
          {isAdmin ? (
            <form
              className="mb-4 grid gap-3 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void onAction("/war-room/assignments", {
                  analystId: form.get("analystId"),
                  fixtureId: form.get("fixtureId"),
                  leagueName: form.get("leagueName"),
                  adminNotes: form.get("adminNotes"),
                });
              }}
            >
              <TextField label="Analyst user ID" name="analystId" type="text" />
              <TextField label="Fixture ID" name="fixtureId" type="text" value={dashboard.todayFixtures[0]?.id ?? dashboard.tomorrowFixtures[0]?.id ?? ""} />
              <TextField label="League / competition" name="leagueName" type="text" value={dashboard.todayFixtures[0]?.leagueName ?? dashboard.tomorrowFixtures[0]?.leagueName ?? ""} />
              <TextField label="Admin notes" name="adminNotes" type="text" />
              <div className="md:col-span-2"><SubmitButton>Assign match</SubmitButton></div>
            </form>
          ) : null}
          <div className="space-y-2">
            {dashboard.assignments.map((assignment) => (
              <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3" key={assignment.id}>
                <p className="font-semibold">{assignment.scopeValue}</p>
                <p className="mt-1 text-sm text-zinc-400">{assignment.scopeType} | {assignment.status} | Deadline {new Date(assignment.deadline).toLocaleString()}</p>
                {isAdmin ? <p className="mt-1 text-xs text-zinc-500">{assignment.analystName}</p> : null}
              </div>
            ))}
            {!dashboard.assignments.length ? <p className="text-sm text-zinc-400">No War Room assignments yet.</p> : null}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Panel title="Intelligence Discussions">
          <div className="grid gap-3 lg:grid-cols-2">
            {dashboard.discussions.map((discussion) => (
              <article className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={discussion.id}>
                <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">{discussion.category.replaceAll("_", " ")}</p>
                <h3 className="mt-2 font-semibold">{discussion.title}</h3>
                <p className="mt-2 text-sm text-zinc-300">{discussion.messages[0]?.body}</p>
                <div className="mt-3 space-y-1">
                  {discussion.pinnedNotes.map((note) => <p className="rounded-md bg-emerald-500/10 p-2 text-xs text-emerald-100" key={note}>{note}</p>)}
                </div>
                <p className="mt-3 text-xs text-zinc-500">{discussion.attachmentsPlaceholder}</p>
              </article>
            ))}
            {!dashboard.discussions.length ? <p className="text-sm text-zinc-400">Discussion rooms appear when fixtures and assignments are available.</p> : null}
          </div>
        </Panel>
        <Panel title="AI Assistant Panel">
          <div className="space-y-3 text-sm text-zinc-300">
            <p><span className="font-semibold text-white">Historical:</span> {dashboard.aiAssistantPanel.historicalMatchSummary}</p>
            <p><span className="font-semibold text-white">Team form:</span> {dashboard.aiAssistantPanel.teamForm}</p>
            <p><span className="font-semibold text-white">Head-to-head:</span> {dashboard.aiAssistantPanel.headToHeadSummary}</p>
            <WarRoomTagList title="Confidence indicators" items={dashboard.aiAssistantPanel.confidenceIndicators} />
            <WarRoomTagList title="Risk indicators" items={dashboard.aiAssistantPanel.riskIndicators} />
            <WarRoomTagList title="Research topics" items={dashboard.aiAssistantPanel.recommendedResearchTopics} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Match Intelligence Board">
          <div className="space-y-3">
            {dashboard.matchIntelligenceBoard.map((item) => (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={item.fixtureId}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-semibold">{item.match}</h3>
                    <p className="mt-1 text-sm text-zinc-400">{item.leagueName} | {item.aiReviewStatus.replaceAll("_", " ")}</p>
                  </div>
                  <span className="rounded-md border border-emerald-400/30 px-2 py-1 text-xs text-emerald-200">{item.riskLevel}</span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  <MiniStat label="Submitted" value={String(item.predictionsSubmitted)} />
                  <MiniStat label="Pending" value={String(item.predictionsPending)} />
                  <MiniStat label="Avg confidence" value={`${item.averageConfidence}%`} />
                  <MiniStat label="Deadline" value={new Date(item.submissionDeadline).toLocaleTimeString()} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Decision Room">
          <div className="space-y-3">
            {dashboard.decisionRoom.map((item) => (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={item.fixtureId}>
                <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">{item.recommendationStatus.replaceAll("_", " ")}</p>
                <h3 className="mt-2 font-semibold">{item.match}</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <MiniStat label="AI score" value={`${item.aiCombinedScore}%`} />
                  <MiniStat label="Agreement" value={item.analystAgreementLevel} />
                  <MiniStat label="Admin approval" value={item.adminApprovalRequired ? "Required" : "Optional"} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Alert Center">
          <div className="space-y-2">
            {dashboard.alerts.map((alert) => (
              <div className={`rounded-md border p-3 text-sm ${alert.severity === "URGENT" ? "border-red-700 bg-red-950/30 text-red-100" : "border-zinc-800 bg-zinc-950 text-zinc-300"}`} key={alert.id}>
                <p className="font-semibold">{alert.title}</p>
                <p className="mt-1">{alert.message}</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Analyst Leaderboard">
          <div className="space-y-2">
            {dashboard.leaderboard.map((analyst) => (
              <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3 text-sm" key={analyst.id}>
                <p className="font-semibold">{isAdmin ? analyst.name : "Internal analyst"} | {analyst.rank}</p>
                <p className="mt-1 text-zinc-400">ARI {analyst.reliabilityIndex}/100 | Discipline {analyst.currentForm}/100 | Allocation {money(analyst.capitalAllocationCents)}</p>
              </div>
            ))}
            {!dashboard.leaderboard.length ? <p className="text-sm text-zinc-400">Leaderboard appears after analyst profiles are promoted.</p> : null}
          </div>
        </Panel>
        <Panel title="Rulebook Quick View">
          <p className="text-sm text-zinc-300">{dashboard.rulebook.currentOddsPolicy}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <MiniStat label="Minimum odds" value={String(dashboard.rulebook.minimumOdds.toFixed(2))} />
            <MiniStat label="Maximum odds" value={String(dashboard.rulebook.maximumOdds.toFixed(2))} />
          </div>
          <WarRoomTagList title="Prediction rules" items={dashboard.rulebook.predictionRules} />
          <WarRoomTagList title="Submission rules" items={dashboard.rulebook.submissionRules} />
          <WarRoomTagList title="Discipline rules" items={dashboard.rulebook.disciplineRules} />
          <p className="mt-3 rounded-md bg-amber-500/10 p-3 text-sm text-amber-100">{dashboard.rulebook.confidentialityReminder}</p>
        </Panel>
      </div>
    </div>
  );
}

function TreasuryCenterView({ dashboard, onAction }: { dashboard: TreasuryDashboard | null; onAction: (path: string, body?: object) => Promise<void> }) {
  if (!dashboard) return <LoadingSkeleton label="Preparing FPF Treasury Center" />;
  const firstAllocation = dashboard.capitalAllocations[0];
  const firstExecution = dashboard.executions[0];
  const firstSettlement = dashboard.settlements[0];
  return (
    <div className="mt-6 space-y-4">
      <Panel title="Treasury Accounts">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MiniStat label="Company treasury" value={money(dashboard.accounts.companyTreasuryBalanceCents)} />
          <MiniStat label="Investor principal" value={money(dashboard.accounts.investorCapitalBalanceCents)} />
          <MiniStat label="Available staking" value={money(dashboard.accounts.capitalAvailableForStakingCents)} />
          <MiniStat label="Open exposure" value={money(dashboard.accounts.capitalCurrentlyExposedCents)} />
          <MiniStat label="Outstanding recon" value={money(dashboard.accounts.outstandingReconciliationCents)} />
        </div>
        <p className="mt-4 text-sm text-zinc-400">Investor principal, company profit, analyst rewards, and investor distributions are tracked separately. No payment or bookmaker API is connected.</p>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Capital Allocation Extension">
          <div className="space-y-3">
            {dashboard.capitalAllocations.map((allocation) => (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={allocation.id}>
                <p className="text-xs uppercase tracking-[0.12em] text-emerald-300">{allocation.approvalStatus} Â· {allocation.riskGrade}</p>
                <h3 className="mt-2 font-semibold">{allocation.fixture}</h3>
                <p className="mt-1 text-sm text-zinc-400">{allocation.market} Â· {allocation.selection}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  <MiniStat label="Recommended stake" value={money(allocation.recommendedStakeCents)} />
                  <MiniStat label="Max stake" value={money(allocation.maximumAllowedStakeCents)} />
                  <MiniStat label="Expected return" value={money(allocation.expectedReturnCents)} />
                  <MiniStat label="Reliability" value={`${allocation.controls.reliabilityIndex}/100`} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Manual Execution Desk">
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void onAction("/treasury/executions", {
                allocationId: form.get("allocationId"),
                actualStakeCents: Number(form.get("actualStakeCents") ?? 0),
                recommendedOdds: Number(form.get("recommendedOdds") ?? 0),
                actualOdds: Number(form.get("actualOdds") ?? 0),
                bookmaker: form.get("bookmaker"),
                betReference: form.get("betReference"),
                varianceReason: form.get("varianceReason"),
                executionNotes: form.get("executionNotes"),
              });
              event.currentTarget.reset();
            }}
          >
            <TextField label="Allocation ID" name="allocationId" type="text" value={firstAllocation?.id ?? ""} />
            <TextField label="Actual stake cents" name="actualStakeCents" type="number" value={String(firstAllocation?.recommendedStakeCents ?? 0)} />
            <TextField label="Recommended odds" name="recommendedOdds" type="number" value="1.8" />
            <TextField label="Actual odds" name="actualOdds" type="number" value="1.8" />
            <TextField label="Bookmaker" name="bookmaker" type="text" />
            <TextField label="Bet reference" name="betReference" type="text" />
            <TextField label="Variance reason" name="varianceReason" type="text" />
            <TextField label="Execution notes" name="executionNotes" type="text" />
            <SubmitButton>Confirm manual execution placeholder</SubmitButton>
          </form>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Settlement Engine">
          {firstExecution ? (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void onAction(`/treasury/executions/${firstExecution.id}/settle`, {
                  outcome: form.get("outcome"),
                  verificationStatus: form.get("verificationStatus"),
                });
              }}
            >
              <SelectField label="Outcome" name="outcome" value="WIN" options={["WIN", "LOSS", "VOID", "HALF_WIN", "HALF_LOSS", "CANCELLED", "PENDING_VERIFICATION"].map((value) => ({ value, label: value }))} />
              <SelectField label="Verification" name="verificationStatus" value="PENDING" options={["PENDING", "VERIFIED"].map((value) => ({ value, label: value }))} />
              <SubmitButton>Settle execution</SubmitButton>
            </form>
          ) : <p className="text-sm text-zinc-400">Create an execution before settlement.</p>}
          <CompactTreasuryList items={dashboard.settlements.map((item) => `${item.outcome}: ${money(item.grossReturnCents)} returned`)} />
        </Panel>

        <Panel title="Match Reconciliation">
          {firstSettlement ? (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void onAction(`/treasury/settlements/${firstSettlement.id}/reconcile`, {
                  amountDepositedBackCents: Number(form.get("amountDepositedBackCents") ?? 0),
                  notes: form.get("notes"),
                });
              }}
            >
              <TextField label="Amount deposited back cents" name="amountDepositedBackCents" type="number" value={String(firstSettlement.grossReturnCents)} />
              <TextField label="Notes" name="notes" type="text" />
              <SubmitButton>Record reconciliation</SubmitButton>
            </form>
          ) : <p className="text-sm text-zinc-400">Settle a match before reconciliation.</p>}
          <CompactTreasuryList items={dashboard.reconciliations.map((item) => `${item.status}: outstanding ${money(item.outstandingDifferenceCents)}`)} />
        </Panel>

        <Panel title="Financial Exceptions">
          <CompactTreasuryList items={dashboard.exceptions.map((item) => `${item.severity}: ${item.message}`)} />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Daily Treasury Reconciliation">
          <div className="grid gap-2 sm:grid-cols-3">
            <MiniStat label="Staked" value={money(dashboard.daily.capitalActuallyStakedCents)} />
            <MiniStat label="Expected back" value={money(dashboard.daily.amountExpectedBackCents)} />
            <MiniStat label="Net P/L" value={money(dashboard.daily.netDailyProfitCents)} />
          </div>
          <button className="mt-4 rounded-md border border-emerald-700 px-3 py-2 text-sm text-emerald-200" type="button" onClick={() => void onAction("/treasury/daily/close", { overrideReason: null })}>Close trading day</button>
        </Panel>

        <Panel title="Weekly Financial Closure">
          <div className="grid gap-2 sm:grid-cols-3">
            <MiniStat label="Net profit" value={money(dashboard.weekly.confirmedWeeklyNetProfitCents)} />
            <MiniStat label="Company" value={`${dashboard.policy.companySharePercent}%`} />
            <MiniStat label="Analysts / Investors" value={`${dashboard.policy.analystRewardPercent}% / ${dashboard.policy.investorDistributionPercent}%`} />
          </div>
          <button className="mt-4 rounded-md border border-emerald-700 px-3 py-2 text-sm text-emerald-200" type="button" onClick={() => void onAction("/treasury/weekly/close", { executiveApproval: true, approvalNotes: "Executive placeholder approval" })}>Close weekly period</button>
        </Panel>
      </div>

      <Panel title="Treasury Ledger">
        <CompactTreasuryList items={dashboard.ledger.map((entry) => `${entry.direction} ${money(entry.amountCents)} Â· ${entry.account} Â· ${entry.classification}`)} />
      </Panel>
    </div>
  );
}

function ExecutiveBiView({ dashboard }: { dashboard: ExecutiveAnalyticsDashboard | null }) {
  if (!dashboard) return <LoadingSkeleton label="Preparing Executive Business Intelligence" />;
  return (
    <div className="mt-6 space-y-4">
      <Panel title="Executive Business Intelligence">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
          {dashboard.executiveKpis.slice(0, 28).map((metric) => (
            <MiniStat key={metric.label} label={metric.label} value={typeof metric.value === "number" && metric.label.toLowerCase().includes("capital") || metric.label.toLowerCase().includes("revenue") || metric.label.toLowerCase().includes("profit") || metric.label.toLowerCase().includes("share") || metric.label.toLowerCase().includes("reward") ? money(Number(metric.value)) : String(metric.value)} />
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="AI Executive Recommendations">
          <div className="space-y-3">
            {dashboard.aiInsights.map((insight) => (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={insight.id}>
                <p className="text-xs uppercase tracking-[0.12em] text-emerald-300">{insight.category} Â· {insight.severity} Â· {insight.confidence}%</p>
                <h3 className="mt-2 font-semibold">{insight.title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{insight.recommendation}</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Predictive Analytics">
          <div className="space-y-3">
            {dashboard.forecasts.map((forecast) => (
              <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3" key={forecast.metric}>
                <p className="font-semibold">{forecast.metric}: {money(forecast.expectedValueCents)}</p>
                <p className="mt-1 text-sm text-zinc-400">{forecast.trend} Â· {forecast.confidence}% confidence Â· {forecast.explanation}</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Export Center">
          <CompactTreasuryList items={dashboard.exportCenter.map((item) => `${item.reportType} Â· ${item.title} Â· ${item.cadence} Â· ${item.providerStatus}`)} />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Analyst Leaderboard">
          <div className="space-y-3">
            {dashboard.analystLeaderboard.map((analyst) => (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={analyst.analystId}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{analyst.currentRank} {analyst.analystName}</p>
                    <p className="text-sm text-zinc-400">{analyst.totalPicks} picks Â· {analyst.winRate}% win rate Â· {analyst.roi}% ROI</p>
                  </div>
                  <span className="rounded-full border border-emerald-700 px-3 py-1 text-xs text-emerald-200">ARI {analyst.reliabilityIndex}</span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  <MiniStat label="Profit" value={money(analyst.profitGeneratedCents)} />
                  <MiniStat label="Capital used" value={money(analyst.capitalUsedCents)} />
                  <MiniStat label="Efficiency" value={`${analyst.capitalEfficiency}%`} />
                  <MiniStat label="Discipline" value={`${analyst.disciplineScore}/100`} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="League Intelligence">
          <AnalyticsTable rows={dashboard.leagueIntelligence.map((league) => [`#${league.rank} ${league.league}`, `${league.matchesPlayed}`, money(league.profitCents), `${league.roi}%`, `${league.accuracy}%`, `${league.risk}/100`])} />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Market Intelligence">
          <AnalyticsTable rows={dashboard.marketIntelligence.map((market) => [`#${market.rank} ${market.market}`, money(market.profitGeneratedCents), `${market.roi}%`, `${market.accuracy}%`, `${market.averageRisk}/100`, money(market.capitalAllocationCents)])} />
        </Panel>
        <Panel title="Subscriber & Investor Analytics">
          <div className="grid gap-2 sm:grid-cols-3">
            <MiniStat label="Active subscribers" value={String(dashboard.subscriberAnalytics.activeSubscribers)} />
            <MiniStat label="Conversion" value={`${dashboard.subscriberAnalytics.conversionRate}%`} />
            <MiniStat label="Retention" value={`${dashboard.subscriberAnalytics.retention}%`} />
            <MiniStat label="Active investors" value={String(dashboard.investorAnalytics.activeInvestors)} />
            <MiniStat label="Locked capital" value={money(dashboard.investorAnalytics.lockedCapitalCents)} />
            <MiniStat label="Reinvestment" value={`${dashboard.investorAnalytics.reinvestmentRate}%`} />
          </div>
        </Panel>
      </div>

      <Panel title="Visual Dashboard Data">
        <div className="grid gap-4 xl:grid-cols-4">
          <TrendCard title="Revenue Timeline" points={dashboard.visualizations.revenueTimeline} />
          <TrendCard title="Profit Timeline" points={dashboard.visualizations.profitTimeline} />
          <TrendCard title="Capital Allocation" points={dashboard.visualizations.capitalAllocation} />
          <TrendCard title="Risk Heat Map" points={dashboard.visualizations.riskHeatMap.map((item) => ({ label: item.label, value: item.risk }))} />
        </div>
      </Panel>
    </div>
  );
}

function AnalystPrivateAnalyticsView({ analytics }: { analytics: AnalystPrivateAnalytics | null }) {
  if (!analytics) return <LoadingSkeleton label="Preparing analyst analytics" />;
  const analyst = analytics.analyst;
  return (
    <div className="mt-6 space-y-4">
      <Panel title="My Analyst Intelligence">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <MiniStat label="Total picks" value={String(analyst.totalPicks)} />
          <MiniStat label="Win rate" value={`${analyst.winRate}%`} />
          <MiniStat label="ROI" value={`${analyst.roi}%`} />
          <MiniStat label="Profit" value={money(analyst.profitGeneratedCents)} />
          <MiniStat label="ARI" value={`${analyst.reliabilityIndex}/100`} />
          <MiniStat label="Discipline" value={`${analyst.disciplineScore}/100`} />
        </div>
      </Panel>
      <Panel title="Private AI Recommendations">
        <CompactTreasuryList items={analytics.aiRecommendations.map((item) => `${item.severity}: ${item.recommendation}`)} />
      </Panel>
      <Panel title="Private Export Placeholders">
        <CompactTreasuryList items={analytics.exportCenter.map((item) => `${item.reportType} Â· ${item.title} Â· ${item.providerStatus}`)} />
      </Panel>
    </div>
  );
}

function AnalyticsTable({ rows }: { rows: string[][] }) {
  return (
    <div className="overflow-auto rounded-lg border border-zinc-800">
      <table className="w-full min-w-[560px] text-left text-sm">
        <tbody>
          {rows.map((row) => (
            <tr className="border-b border-zinc-900 last:border-0" key={row.join(":")}>
              {row.map((cell, index) => (
                <td className={index === 0 ? "px-3 py-3 font-semibold text-zinc-100" : "px-3 py-3 text-zinc-400"} key={cell}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrendCard({ title, points }: { title: string; points: Array<{ label: string; value: number }> }) {
  const peak = Math.max(1, ...points.map((point) => point.value));
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <p className="font-semibold">{title}</p>
      <div className="mt-4 flex h-28 items-end gap-2">
        {points.map((point) => (
          <div className="flex flex-1 flex-col items-center gap-2" key={point.label}>
            <div className="w-full rounded-t bg-emerald-300/70" style={{ height: `${Math.max(8, (point.value / peak) * 100)}%` }} />
            <span className="text-[10px] text-zinc-500">{point.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExecutiveSituationRoomView({ situation }: { situation: ExecutiveSituationRoom | null }) {
  if (!situation) return <LoadingSkeleton label="Preparing Executive Situation Room" />;
  return (
    <div className="mt-6 space-y-4">
      <Panel title="Executive Situation Room">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MiniStat label="Approved selections" value={String(situation.approvedSelectionsToday)} />
          <MiniStat label="Capital recommended" value={money(situation.capitalRecommendedCents)} />
          <MiniStat label="Capital placed" value={money(situation.capitalActuallyPlacedCents)} />
          <MiniStat label="Open exposure" value={money(situation.openExposureCents)} />
          <MiniStat label="System health" value={situation.systemHealth} />
        </div>
      </Panel>
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Profit Split Projection">
          <MiniStat label="Weekly net profit" value={money(situation.weeklyConfirmedNetProfitCents)} />
          <MiniStat label="Company share" value={money(situation.companyShareProjectionCents)} />
          <MiniStat label="Analyst pool" value={money(situation.analystRewardPoolProjectionCents)} />
          <MiniStat label="Investor pool" value={money(situation.investorDistributionPoolProjectionCents)} />
        </Panel>
        <Panel title="Pending Controls">
          <CompactTreasuryList items={[
            `Pending settlements: ${situation.pendingSettlements.length}`,
            `Pending reconciliations: ${situation.pendingReconciliations.length}`,
            `Pending approvals: ${situation.pendingApprovals.length}`,
          ]} />
        </Panel>
        <Panel title="Critical Alerts">
          <CompactTreasuryList items={situation.criticalFinancialAlerts.map((alert) => `${alert.severity}: ${alert.message}`)} />
        </Panel>
      </div>
    </div>
  );
}

function ExecutiveGlobalCommandWallPlaceholder() {
  return (
    <CommandCenterLayout
      eyebrow="Module 7 reserved"
      title="Executive Global Command Wall"
      summary="The navigation slot, route handler, and shared layout are ready. The module remains disabled unless VITE_ENABLE_EXECUTIVE_GLOBAL_COMMAND_WALL is explicitly enabled."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <StatusCard title="Access" value="Admin / Executive only" detail="Protected by the existing admin shell and role guard." />
        <StatusCard title="Data source" value="Pending final module" detail="Will connect to production APIs without replacing current dashboards." />
        <StatusCard title="Release state" value="Feature-flagged" detail="Safe to add later without rebuilding the app shell." />
      </div>
    </CommandCenterLayout>
  );
}

function CommandCenterLayout({
  children,
  eyebrow,
  summary,
  title,
}: {
  children: ReactNode;
  eyebrow: string;
  summary: string;
  title: string;
}) {
  return (
    <div className="mt-6 space-y-4">
      <section className="rounded-lg border border-emerald-900/60 bg-gradient-to-br from-zinc-950 via-slate-950 to-emerald-950/30 p-5 shadow-xl shadow-black/20">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">{eyebrow}</p>
        <h3 className="mt-2 text-2xl font-bold">{title}</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-300">{summary}</p>
      </section>
      {children}
    </div>
  );
}

function StatusCard({ detail, title, value }: { detail: string; title: string; value: string }) {
  return (
    <article className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{title}</p>
      <strong className="mt-2 block text-lg text-white">{value}</strong>
      <span className="mt-2 block text-sm leading-6 text-zinc-400">{detail}</span>
    </article>
  );
}

function AnalystTreasuryViewPanel({ treasury }: { treasury: AnalystTreasuryView | null }) {
  if (!treasury) return <LoadingSkeleton label="Preparing analyst treasury controls" />;
  return (
    <div className="mt-6 space-y-4">
      <Panel title="Analyst Treasury Visibility">
        <p className="text-sm text-zinc-400">{treasury.notice}</p>
      </Panel>
      <Panel title="My Approved Allocations">
        <CompactTreasuryList items={treasury.allocations.map((allocation) => `${allocation.fixture} Â· ${allocation.market} Â· ${money(allocation.recommendedStakeCents)} Â· ${allocation.riskGrade}`)} />
      </Panel>
      <Panel title="My Reward Calculations">
        <CompactTreasuryList items={treasury.rewards.map((reward) => `${reward.analystName}: ${money(reward.rewardCents)} Â· ${reward.status}`)} />
      </Panel>
    </div>
  );
}

function CompactTreasuryList({ items }: { items: string[] }) {
  return (
    <div className="mt-3 space-y-2">
      {items.map((item) => (
        <p className="rounded-md border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300" key={item}>{item}</p>
      ))}
      {!items.length ? <p className="text-sm text-zinc-400">No records yet.</p> : null}
    </div>
  );
}

function WarRoomFixtureList({ fixtures, title }: { fixtures: WarRoomDashboard["todayFixtures"]; title: string }) {
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-3 space-y-2">
        {fixtures.map((fixture) => (
          <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3" key={fixture.id}>
            <p className="font-semibold">{fixture.homeTeamName} vs {fixture.awayTeamName}</p>
            <p className="mt-1 text-sm text-zinc-400">{fixture.leagueName} | {fixture.leagueCountry ?? "Global"} | Kickoff {new Date(fixture.kickoffAt).toLocaleString()}</p>
            <p className="mt-1 text-xs text-emerald-300">Deadline {new Date(fixture.predictionDeadline).toLocaleString()} | {fixture.assignmentStatus.replaceAll("_", " ")}</p>
          </div>
        ))}
        {!fixtures.length ? <p className="text-sm text-zinc-400">No fixtures available for this window.</p> : null}
      </div>
    </div>
  );
}

function WarRoomTagList({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="mt-3">
      <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => <span className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300" key={item}>{item}</span>)}
      </div>
    </div>
  );
}

function InfrastructureControlCenterView({
  control,
  onAction,
}: {
  control: InfrastructureControlCenter | null;
  onAction: (path: string, body?: object) => Promise<void>;
}) {
  if (!control) return <LoadingSkeleton label="Preparing Infrastructure Center" />;
  const overview = control.overview;
  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Providers" value={String(overview.totalProviders)} />
        <Metric label="Connected APIs" value={String(overview.connectedApis)} />
        <Metric label="Renewals in 7 days" value={String(overview.renewalsDueIn7Days)} />
        <Metric label="Monthly cost" value={money(overview.monthlyOperatingCostCents)} />
        <Metric label="Annual cost" value={money(overview.annualOperatingCostCents)} />
        <Metric label="Credentials due" value={String(overview.credentialsRequiringRotation)} />
        <Metric label="Over budget" value={String(overview.providersOverBudget)} />
        <Metric label="Procurement approvals" value={String(overview.procurementRequestsAwaitingApproval)} />
      </div>

      <Panel title="Executive Infrastructure Dashboard">
        <p className="text-sm text-zinc-300">{overview.executiveSummary}</p>
        <p className="mt-3 rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">{control.securityNotice}</p>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Panel title="Provider Registry">
          <form
            className="mb-4 grid gap-3 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const providerWebsite = String(form.get("providerWebsite") ?? "https://example.com");
              void onAction("/admin/infrastructure/providers", {
                name: form.get("name"),
                category: form.get("category"),
                servicePurpose: form.get("servicePurpose"),
                providerWebsite,
                dashboardUrl: providerWebsite,
                billingUrl: providerWebsite,
                renewalUrl: providerWebsite,
                documentationUrl: providerWebsite,
                monthlyCostCents: Number(form.get("monthlyCostCents") ?? 0),
              });
              event.currentTarget.reset();
            }}
          >
            <TextField label="Provider name" name="name" type="text" />
            <SelectField label="Category" name="category" value="Other" options={["Football Data", "Odds Data", "Artificial Intelligence", "Hosting", "Database", "Crypto Payments", "Security", "Analytics", "Other"].map((item) => ({ value: item, label: item }))} />
            <TextField label="Purpose" name="servicePurpose" type="text" />
            <TextField label="Official HTTPS URL" name="providerWebsite" type="url" value="https://example.com" />
            <TextField label="Monthly cost cents" name="monthlyCostCents" type="number" value="0" />
            <div className="self-end"><SubmitButton>Add provider metadata</SubmitButton></div>
          </form>
          <div className="space-y-3">
            {control.providers.map((provider) => (
              <article className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={provider.id}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">{provider.category} Â· {provider.healthStatus}</p>
                    <h3 className="mt-2 font-semibold">{provider.name}</h3>
                    <p className="mt-1 text-sm text-zinc-400">{provider.servicePurpose}</p>
                    <p className="mt-2 text-xs text-zinc-500">Owner: {provider.internalOwner} Â· Plan: {provider.currentPlan}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:border-emerald-300" href={provider.dashboardUrl} rel="noreferrer" target="_blank">Dashboard</a>
                    <a className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:border-emerald-300" href={provider.billingUrl} rel="noreferrer" target="_blank">Billing</a>
                    <a className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:border-emerald-300" href={provider.documentationUrl} rel="noreferrer" target="_blank">Docs</a>
                    <button className="rounded-md bg-emerald-300 px-3 py-2 text-xs font-semibold text-zinc-950" type="button" onClick={() => void onAction(`/admin/infrastructure/providers/${provider.id}/test`)}>Test</button>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  <MiniStat label="Monthly" value={money(provider.monthlyCostCents)} />
                  <MiniStat label="Usage" value={`${provider.currentUsage}/${provider.usageLimit}`} />
                  <MiniStat label="Quota left" value={String(provider.remainingQuota)} />
                  <MiniStat label="Renewal" value={provider.nextRenewalDate ? new Date(provider.nextRenewalDate).toLocaleDateString() : "Manual"} />
                </div>
              </article>
            ))}
          </div>
        </Panel>

        <Panel title="Credential Metadata">
          <div className="space-y-3">
            {control.credentialMetadata.map((credential) => (
              <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3 text-sm" key={credential.id}>
                <p className="font-semibold">{credential.credentialName}</p>
                <p className="text-zinc-400">{credential.maskedIdentifier} Â· {credential.rotationStatus}</p>
                <p className="mt-1 text-xs text-zinc-500">{credential.notes}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Renewal Calendar">
          <CompactTreasuryList items={control.renewals.map((item) => `${item.providerName}: ${money(item.amountDueCents)} due in ${item.daysRemaining} day(s)`)} />
        </Panel>
        <Panel title="Usage & Quotas">
          <CompactTreasuryList items={control.usage.map((item) => `${item.providerName}: ${item.usagePercent}% used (${item.status})`)} />
        </Panel>
        <Panel title="Provider Alerts">
          <div className="space-y-2">
            {control.alerts.map((alert) => (
              <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3 text-sm" key={alert.id}>
                <p className="font-semibold">{alert.severity} Â· {alert.providerName}</p>
                <p className="mt-1 text-zinc-400">{alert.message}</p>
                <button className="mt-2 rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-200" type="button" onClick={() => void onAction(`/admin/infrastructure/alerts/${alert.id}`, {})}>Acknowledge</button>
              </div>
            ))}
            {!control.alerts.length ? <p className="text-sm text-zinc-400">No infrastructure alerts.</p> : null}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Cost & FinOps">
          <div className="grid gap-3 sm:grid-cols-2">
            <MiniStat label="Recurring monthly" value={money(control.costs.monthlyRecurringCostCents)} />
            <MiniStat label="Usage costs" value={money(control.costs.usageBasedCostsCents)} />
            <MiniStat label="Forecast monthly" value={money(control.costs.forecastedMonthlyCostCents)} />
            <MiniStat label="First-year estimate" value={money(control.costs.forecastedAnnualCostCents)} />
          </div>
          <CompactTreasuryList items={control.costs.costByProvider.map((item) => `${item.providerName}: ${money(item.monthlyCostCents)}/month`)} />
        </Panel>

        <Panel title="Provider Comparison">
          <div className="space-y-3">
            {control.comparisons.map((item) => (
              <article className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={item.id}>
                <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">{item.category} Â· {item.status}</p>
                <h3 className="mt-2 font-semibold">{item.providerName}</h3>
                <p className="mt-1 text-sm text-zinc-400">{item.features.join(", ")} Â· Complexity {item.integrationComplexity}</p>
                <p className="mt-2 text-sm text-zinc-500">{item.coverage} Â· {item.contractCommitment}</p>
              </article>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Procurement Workflow">
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void onAction("/admin/infrastructure/procurement", {
                businessNeed: form.get("businessNeed"),
                requestedProvider: form.get("requestedProvider"),
                recommendedPlan: form.get("recommendedPlan"),
                estimatedMonthlyCostCents: Number(form.get("estimatedMonthlyCostCents") ?? 0),
                notes: form.get("notes"),
              });
              event.currentTarget.reset();
            }}
          >
            <TextField label="Business need" name="businessNeed" type="text" />
            <TextField label="Provider" name="requestedProvider" type="text" />
            <TextField label="Recommended plan" name="recommendedPlan" type="text" />
            <TextField label="Monthly cost cents" name="estimatedMonthlyCostCents" type="number" value="0" />
            <div className="md:col-span-2"><TextField label="Notes" name="notes" type="text" /></div>
            <div className="md:col-span-2"><SubmitButton>Create procurement request</SubmitButton></div>
          </form>
          <CompactTreasuryList items={control.procurement.map((item) => `${item.requestedProvider}: ${item.status} Â· ${money(item.estimatedMonthlyCostCents)}/month`)} />
        </Panel>

        <Panel title="Procurement Report">
          <div className="grid gap-3 sm:grid-cols-2">
            <MiniStat label="Essential launch" value={money(control.procurementReport.totals.essentialLaunchTotalCents)} />
            <MiniStat label="Recommended growth" value={money(control.procurementReport.totals.recommendedGrowthTotalCents)} />
            <MiniStat label="Monthly total" value={money(control.procurementReport.totals.monthlyTotalCents)} />
            <MiniStat label="First year" value={money(control.procurementReport.totals.estimatedFirstYearTotalCents)} />
          </div>
          <CompactTreasuryList items={control.procurementReport.providers.map((item) => `${item.provider}: ${item.required ? "Required" : "Optional"} Â· ${item.purchaseStatus}`)} />
        </Panel>
      </div>

      <Panel title="Infrastructure Tasks">
        <CompactTreasuryList items={control.tasks.map((task) => `${task.priority}: ${task.title} Â· due ${new Date(task.dueDate).toLocaleDateString()}`)} />
      </Panel>
    </div>
  );
}

const mediaPlatforms: MediaPlatform[] = ["FACEBOOK", "INSTAGRAM", "TIKTOK", "X", "LINKEDIN", "TELEGRAM", "WHATSAPP_CHANNELS", "YOUTUBE_COMMUNITY", "DISCORD"];

function BusinessControlCenterView({
  control,
  onAction,
}: {
  control: CommercialControlCenter | null;
  onAction: (path: string, body?: object) => Promise<void>;
}) {
  if (!control) return <LoadingSkeleton label="Preparing Business Control Center" />;
  const dashboard = control.businessDashboard;
  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Monthly revenue" value={money(dashboard.monthlyRevenueCents)} />
        <Metric label="Annual revenue" value={money(dashboard.annualRevenueCents)} />
        <Metric label="MRR" value={money(dashboard.mrrCents)} />
        <Metric label="ARR" value={money(dashboard.arrCents)} />
        <Metric label="Subscribers" value={String(dashboard.subscriberCount)} />
        <Metric label="Investors" value={String(dashboard.investorCount)} />
        <Metric label="Investment capital" value={money(dashboard.investmentCapitalCents)} />
        <Metric label="System health" value={dashboard.systemHealth} />
      </div>

      <Panel title="Executive Dashboard">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MiniStat label="Weekly distributions" value={money(dashboard.weeklyDistributionsCents)} />
          <MiniStat label="Pending distributions" value={money(dashboard.pendingDistributionsCents)} />
          <MiniStat label="Pending renewals" value={String(dashboard.pendingRenewals)} />
          <MiniStat label="Platform growth" value={`${dashboard.platformGrowthPercent}%`} />
          <MiniStat label="Prediction accuracy" value={`${dashboard.predictionAccuracyPercent}%`} />
          <MiniStat label="Infrastructure cost" value={money(dashboard.infrastructureCostCents)} />
          <MiniStat label="API cost" value={money(dashboard.apiCostCents)} />
          <MiniStat label="Marketing" value={dashboard.marketingPerformance} />
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Subscription Manager">
          <div className="grid gap-3 md:grid-cols-2">
            {control.structure.subscriberPlans.map((plan) => (
              <article className={`rounded-lg border p-4 ${plan.highlighted ? "border-emerald-300 bg-emerald-950/20" : "border-zinc-800 bg-zinc-950"}`} key={plan.code}>
                <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">{plan.code}</p>
                <h3 className="mt-2 font-semibold">{plan.name}</h3>
                <p className="mt-2 text-sm text-zinc-300">{money(plan.monthlyPriceCents)}/month | {money(plan.yearlyPriceCents)}/year</p>
                <p className="mt-2 text-xs text-zinc-500">Trial: {plan.trialDays ?? 0} days | Grace: {plan.gracePeriodDays ?? 0} days</p>
                <p className="mt-3 text-sm text-zinc-400">{plan.features.join(", ")}</p>
              </article>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
            Current placeholder subscription: {control.subscription.planCode} - {control.subscription.status}. Renewal: {control.subscription.renewalDate ? new Date(control.subscription.renewalDate).toLocaleDateString() : "None"}.
          </div>
        </Panel>

        <Panel title="Investment Package Manager">
          <div className="space-y-3">
            {control.structure.investorPackages.map((item) => (
              <article className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={item.id}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">{item.status} - {item.lockPeriodCode}</p>
                    <h3 className="mt-2 font-semibold">{item.name}</h3>
                    <p className="mt-1 text-sm text-zinc-400">Minimum {money(item.minimumAmountCents)} | Maximum {item.maximumAmountCents ? money(item.maximumAmountCents) : "Open"}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-200" type="button" onClick={() => void onAction(`/admin/commercial/investor-packages/${item.id}`, { visible: !item.visible })}>{item.visible ? "Hide" : "Show"}</button>
                    <button className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-200" type="button" onClick={() => void onAction(`/admin/commercial/investor-packages/${item.id}`, { status: item.status === "ACTIVE" ? "PAUSED" : "ACTIVE" })}>{item.status === "ACTIVE" ? "Pause" : "Activate"}</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Pricing Engine">
          <form
            className="mb-4 grid gap-3 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void onAction("/admin/commercial/pricing-rules", {
                name: form.get("name"),
                countryCode: form.get("countryCode") || null,
                currency: form.get("currency") || "USD",
                discountPercent: Number(form.get("discountPercent") ?? 0),
                couponCode: form.get("couponCode") || null,
                promotionType: form.get("promotionType"),
                active: true,
              });
              event.currentTarget.reset();
            }}
          >
            <TextField label="Rule name" name="name" type="text" />
            <TextField label="Country code" name="countryCode" type="text" />
            <TextField label="Currency" name="currency" type="text" value="USD" />
            <TextField label="Discount %" name="discountPercent" type="number" value="0" />
            <TextField label="Coupon code" name="couponCode" type="text" />
            <SelectField label="Promotion type" name="promotionType" value="DISCOUNT" options={["DISCOUNT", "REFERRAL", "LAUNCH", "SEASONAL", "ADMIN_OVERRIDE"].map((item) => ({ value: item, label: item }))} />
            <div className="md:col-span-2"><SubmitButton>Create pricing rule</SubmitButton></div>
          </form>
          <div className="space-y-2">
            {control.structure.pricingRules.map((rule) => (
              <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3 text-sm" key={rule.id}>
                <p className="font-semibold">{rule.name} - {rule.discountPercent}%</p>
                <p className="text-zinc-400">{rule.currency} | {rule.countryCode ?? "Global"} | {rule.promotionType}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Infrastructure & API Control Center">
          <form
            className="mb-4 grid gap-3 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void onAction("/admin/infrastructure/providers", {
                providerName: form.get("providerName"),
                purpose: form.get("purpose"),
                category: form.get("category"),
                monthlyCostCents: Math.round(Number(form.get("monthlyCost")) * 100),
                annualCostCents: Math.round(Number(form.get("annualCost")) * 100),
              });
              event.currentTarget.reset();
            }}
          >
            <TextField label="Provider" name="providerName" type="text" />
            <TextField label="Purpose" name="purpose" type="text" />
            <SelectField label="Category" name="category" value="Infrastructure" options={["Football APIs", "AI APIs", "Payments", "Messaging", "Infrastructure", "Hosting", "Domains", "Analytics", "Security", "Marketing"].map((item) => ({ value: item, label: item }))} />
            <TextField label="Monthly cost" name="monthlyCost" type="number" value="0" />
            <TextField label="Annual cost" name="annualCost" type="number" value="0" />
            <div className="md:col-span-2"><SubmitButton>Add provider placeholder</SubmitButton></div>
          </form>
          <div className="space-y-2">
            {control.infrastructureProviders.map((provider) => (
              <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3 text-sm" key={provider.id}>
                <p className="font-semibold">{provider.providerName} - {provider.health}</p>
                <p className="text-zinc-400">{provider.category} | {provider.apiKeyStatus} | {money(provider.monthlyCostCents)}/month</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Smart Renewal Center">
          <div className="space-y-3">
            {control.renewals.map((renewal) => (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={renewal.id}>
                <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">{renewal.status}</p>
                <h3 className="mt-2 font-semibold">{renewal.title}</h3>
                <p className="mt-2 text-sm text-zinc-400">Due {new Date(renewal.dueAt).toLocaleDateString()} | Alerts: {renewal.reminderWindows.join(", ")}</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Procurement Center">
          <form
            className="mb-4 grid gap-3 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void onAction("/admin/procurement", {
                vendor: form.get("vendor"),
                plan: form.get("plan"),
                status: form.get("status"),
                costCents: Math.round(Number(form.get("cost")) * 100),
              });
              event.currentTarget.reset();
            }}
          >
            <TextField label="Vendor" name="vendor" type="text" />
            <TextField label="Plan" name="plan" type="text" />
            <SelectField label="Status" name="status" value="PENDING_PURCHASE" options={["PURCHASED", "PENDING_PURCHASE", "CANCELLED", "TRIAL", "EXPIRED", "RENEWAL_PENDING"].map((item) => ({ value: item, label: item.replaceAll("_", " ") }))} />
            <TextField label="Cost" name="cost" type="number" value="0" />
            <div className="md:col-span-2"><SubmitButton>Add procurement item</SubmitButton></div>
          </form>
          <div className="space-y-2">
            {control.procurement.map((item) => (
              <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3 text-sm" key={item.id}>
                <p className="font-semibold">{item.vendor} - {item.status}</p>
                <p className="text-zinc-400">{item.plan} | {money(item.costCents)}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function MediaCommandCenterView({
  dashboard,
  onAction,
}: {
  dashboard: MediaDashboard | null;
  onAction: (path: string, body?: object) => Promise<void>;
}) {
  const posts = dashboard?.posts ?? [];
  const campaigns = dashboard?.campaigns ?? [];
  const assets = dashboard?.assets ?? [];
  const queue = posts.filter((post) => ["DRAFT", "REVIEW", "APPROVED", "SCHEDULED"].includes(post.status));
  const scheduled = posts.filter((post) => ["SCHEDULED", "PUBLISHED"].includes(post.status));

  if (!dashboard) return <LoadingSkeleton label="Preparing Media Command Center" />;

  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Campaigns" value={String(dashboard.campaignOverview.total)} />
        <Metric label="Scheduled posts" value={String(dashboard.scheduledPosts)} />
        <Metric label="Published posts" value={String(dashboard.publishedPosts)} />
        <Metric label="Approval queue" value={String(dashboard.approvalQueue)} />
        <Metric label="AI placeholders" value={String(dashboard.aiGeneratedContent)} />
        <Metric label="Audience growth" value={`${dashboard.audienceGrowth}%`} />
        <Metric label="Click tracking" value={String(dashboard.clickTracking)} />
        <Metric label="Conversions" value={String(dashboard.conversionTracking)} />
      </div>

      <Panel title="Media Command Center">
        <p className="text-sm text-zinc-400">{dashboard.engagementSummary}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {dashboard.platformHealth.map((provider) => (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={provider.name}>
              <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">{provider.mode}</p>
              <h3 className="mt-2 font-semibold">{provider.name}</h3>
              <p className="mt-2 text-sm text-zinc-400">{provider.configured ? "Configured" : "Connection preparing. External publishing remains under Admin control."}</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Campaign Manager">
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void onAction("/admin/media/campaigns", {
                name: form.get("name"),
                type: form.get("type"),
                status: form.get("status"),
                objective: form.get("objective"),
                startDate: form.get("startDate") || null,
                endDate: form.get("endDate") || null,
                budgetCents: Number(form.get("budgetCents") ?? 0),
              });
              event.currentTarget.reset();
            }}
          >
            <TextField label="Campaign name" name="name" type="text" />
            <SelectField label="Campaign type" name="type" value="BRAND_AWARENESS" options={["LAUNCH", "EDUCATION", "PREDICTIONS", "INVESTOR", "REFERRAL", "SUBSCRIPTION", "HOLIDAY", "BRAND_AWARENESS"].map((item) => ({ value: item, label: item.replaceAll("_", " ") }))} />
            <SelectField label="Status" name="status" value="DRAFT" options={["DRAFT", "SCHEDULED", "RUNNING", "PAUSED", "COMPLETED", "ARCHIVED"].map((item) => ({ value: item, label: item }))} />
            <TextField label="Budget cents" name="budgetCents" type="number" value="0" />
            <TextField label="Start date" name="startDate" type="date" />
            <TextField label="End date" name="endDate" type="date" />
            <div className="md:col-span-2">
              <TextField label="Objective" name="objective" type="text" />
            </div>
            <div className="md:col-span-2"><SubmitButton>Create campaign</SubmitButton></div>
          </form>
          <div className="mt-4 space-y-3">
            {campaigns.map((campaign) => (
              <article className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={campaign.id}>
                <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">{campaign.type} - {campaign.status}</p>
                <h3 className="mt-2 font-semibold">{campaign.name}</h3>
                <p className="mt-2 text-sm text-zinc-400">{campaign.objective}</p>
                <p className="mt-3 text-xs text-zinc-500">Budget placeholder: {money(campaign.budgetCents)}</p>
              </article>
            ))}
            {!campaigns.length ? <EmptyState message="Campaigns will appear here. External publishing remains placeholder-only." /> : null}
          </div>
        </Panel>

        <Panel title="Content Studio">
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void onAction("/media/posts", {
                campaignId: form.get("campaignId") || null,
                title: form.get("title"),
                contentType: form.get("contentType"),
                status: form.get("status"),
                body: form.get("body"),
                language: form.get("language") || "en",
                country: form.get("country") || null,
                audience: form.get("audience") || "General",
                platforms: String(form.get("platforms") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
                scheduledAt: form.get("scheduledAt") || null,
                timezone: form.get("timezone") || "UTC",
                aiGenerated: form.get("aiGenerated") === "on",
              });
              event.currentTarget.reset();
            }}
          >
            <TextField label="Campaign ID" name="campaignId" type="text" />
            <TextField label="Content title" name="title" type="text" />
            <SelectField label="Content type" name="contentType" value="EDUCATIONAL_POST" options={["ARTICLE", "MATCH_PREVIEW", "MATCH_REVIEW", "PREDICTION_EXPLANATION", "INVESTOR_UPDATE", "COMPANY_ANNOUNCEMENT", "EDUCATIONAL_POST", "PROMOTIONAL_CAMPAIGN", "SUBSCRIBER_NEWSLETTER"].map((item) => ({ value: item, label: item.replaceAll("_", " ") }))} />
            <SelectField label="Status" name="status" value="DRAFT" options={["DRAFT", "REVIEW", "APPROVED", "SCHEDULED"].map((item) => ({ value: item, label: item }))} />
            <TextField label="Audience" name="audience" type="text" value="Subscribers" />
            <TextField label="Language" name="language" type="text" value="en" />
            <TextField label="Country" name="country" type="text" />
            <TextField label="Platforms" name="platforms" type="text" value={mediaPlatforms.slice(0, 2).join(",")} />
            <TextField label="Schedule date/time" name="scheduledAt" type="datetime-local" />
            <TextField label="Timezone" name="timezone" type="text" value="UTC" />
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input className="h-4 w-4 accent-emerald-300" name="aiGenerated" type="checkbox" />
              AI placeholder assisted
            </label>
            <TextField label="Content body" name="body" type="text" />
            <SubmitButton>Create draft</SubmitButton>
          </form>
        </Panel>
      </div>

      <Panel title="Approval & Publishing Queue">
        <div className="space-y-3">
          {queue.map((post) => (
            <article className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={post.id}>
              <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">{post.contentType} - {post.status}</p>
                  <h3 className="mt-2 font-semibold">{post.title}</h3>
                  <p className="mt-2 text-sm text-zinc-400">{post.body}</p>
                  <p className="mt-3 text-xs text-zinc-500">Platforms: {post.platforms.join(", ") || "None selected"} | Language: {post.language}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200" type="button" onClick={() => void onAction(`/admin/media/posts/${post.id}`, { action: "APPROVE" })}>Approve</button>
                  <button className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200" type="button" onClick={() => void onAction(`/admin/media/posts/${post.id}`, { action: "SCHEDULE", scheduledAt: post.scheduledAt ?? new Date().toISOString() })}>Schedule</button>
                  <button className="rounded-md bg-emerald-300 px-3 py-2 text-sm font-semibold text-zinc-950" type="button" onClick={() => void onAction(`/admin/media/posts/${post.id}`, { action: "PUBLISH" })}>Publish placeholder</button>
                  <button className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200" type="button" onClick={() => void onAction(`/admin/media/posts/${post.id}`, { action: "ARCHIVE" })}>Archive</button>
                </div>
              </div>
            </article>
          ))}
          {!queue.length ? <EmptyState message="Drafts, reviews, approved, and scheduled media posts will appear here." /> : null}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Content Calendar">
          <div className="space-y-3">
            {scheduled.map((post) => (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={post.id}>
                <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">{post.status}</p>
                <h3 className="mt-2 font-semibold">{post.title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{post.scheduledAt ? new Date(post.scheduledAt).toLocaleString() : "Immediate placeholder publish"}</p>
              </div>
            ))}
            {!scheduled.length ? <EmptyState message="Scheduled and published posts will appear on the calendar." /> : null}
          </div>
        </Panel>
        <Panel title="Brand Assets & Media Library">
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void onAction("/admin/media/assets", {
                name: form.get("name"),
                assetType: form.get("assetType"),
                url: form.get("url") || null,
                metadata: { notes: form.get("notes") || "Placeholder media asset" },
              });
              event.currentTarget.reset();
            }}
          >
            <TextField label="Asset name" name="name" type="text" />
            <SelectField label="Asset type" name="assetType" value="TEMPLATE" options={["LOGO", "IMAGE", "VIDEO", "DOCUMENT", "TEMPLATE"].map((item) => ({ value: item, label: item }))} />
            <TextField label="URL placeholder" name="url" type="url" />
            <TextField label="Notes" name="notes" type="text" />
            <div className="md:col-span-2"><SubmitButton>Add asset</SubmitButton></div>
          </form>
          <div className="mt-4 space-y-3">
            {assets.map((asset) => (
              <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={asset.id}>
                <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">{asset.assetType}</p>
                <h3 className="mt-2 font-semibold">{asset.name}</h3>
                <p className="mt-2 text-sm text-zinc-400">{asset.url ?? "Stored as internal placeholder asset"}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Analytics & Attribution">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MiniStat label="Views" value={String(dashboard.performance.views)} />
          <MiniStat label="Clicks" value={String(dashboard.performance.clicks)} />
          <MiniStat label="CTR" value={`${dashboard.performance.ctr}%`} />
          <MiniStat label="Subscriptions" value={String(dashboard.performance.subscriptions)} />
          <MiniStat label="Investor signups" value={String(dashboard.performance.investorSignups)} />
          <MiniStat label="Revenue attribution" value={money(dashboard.performance.revenueAttributionCents)} />
          <MiniStat label="Campaign ROI" value={`${dashboard.performance.campaignRoi}%`} />
          <MiniStat label="Growth trends" value={String(dashboard.performance.growthTrends.length)} />
        </div>
      </Panel>
    </div>
  );
}

function AdminReportsView({
  onAction,
  operationalReports,
  reports,
}: {
  onAction: (path: string, body?: object) => Promise<void>;
  operationalReports: OperationalReport[];
  reports: AdminReports | null;
}) {
  if (!reports) return <LoadingSkeleton label="Preparing admin reports" />;
  return (
    <div className="mt-6 space-y-4">
      <Panel title="Reports Center">
        <form
          className="grid gap-3 md:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void onAction("/reports/generate", {
              type: form.get("type"),
              filters: {
                dateFrom: form.get("dateFrom"),
                dateTo: form.get("dateTo"),
                userRole: form.get("userRole"),
                league: form.get("league"),
                predictionMarket: form.get("predictionMarket"),
                subscriptionPlan: form.get("subscriptionPlan"),
                status: form.get("status"),
                currency: form.get("currency"),
                country: form.get("country"),
              },
            });
          }}
        >
          <SelectField label="Report type" name="type" value="PLATFORM_ACTIVITY" options={[
            "SUBSCRIBER",
            "INVESTOR",
            "PREDICTION_PERFORMANCE",
            "ANALYST_PERFORMANCE",
            "CAMPAIGN",
            "PLATFORM_ACTIVITY",
            "FINANCIAL_SUMMARY",
            "DISTRIBUTION",
            "USER_GROWTH",
            "SYSTEM_HEALTH",
          ].map((item) => ({ value: item, label: item.replaceAll("_", " ") }))} />
          <TextField label="Date from" name="dateFrom" type="date" />
          <TextField label="Date to" name="dateTo" type="date" />
          <TextField label="League" name="league" type="text" />
          <TextField label="Prediction market" name="predictionMarket" type="text" />
          <TextField label="Subscription plan" name="subscriptionPlan" type="text" />
          <TextField label="Status" name="status" type="text" />
          <TextField label="Currency" name="currency" type="text" value="USD" />
          <TextField label="Country" name="country" type="text" />
          <div className="md:col-span-3">
            <SubmitButton>Generate placeholder report</SubmitButton>
          </div>
        </form>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {operationalReports.map((report) => (
            <article className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={report.id}>
              <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">{report.type} - {report.status}</p>
              <h3 className="mt-2 font-semibold">{report.title}</h3>
              <p className="mt-2 text-sm text-zinc-400">{report.summary}</p>
              <p className="mt-3 text-xs text-zinc-500">Generated: {report.generatedAt ? new Date(report.generatedAt).toLocaleString() : "Pending"}</p>
            </article>
          ))}
          {!operationalReports.length ? <EmptyState message="Generated reports will appear here. Safe placeholder reports are available immediately." /> : null}
        </div>
      </Panel>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Subscribers" value={`${reports.subscribers.active}/${reports.subscribers.total}`} />
        <Metric label="Investors" value={`${reports.investors.active}/${reports.investors.total}`} />
        <Metric label="Tracked deposits" value={money(reports.revenue.trackedWalletDepositsCents)} />
        <Metric label="Pending withdrawals" value={`${reports.withdrawals.pendingCount} Â· ${money(reports.withdrawals.pendingAmountCents)}`} />
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
              <span className="text-zinc-400">{day.auditEvents} audit events Â· {day.logins} logins</span>
            </div>
          ))}
          {!reports.dailyPlatformActivity.length ? <EmptyState message="Daily activity appears after production usage begins." /> : null}
        </div>
      </Panel>
    </div>
  );
}

function statusColor(status: "GREEN" | "AMBER" | "RED") {
  if (status === "GREEN") return "bg-emerald-500/20 text-emerald-100 border-emerald-500/30";
  if (status === "AMBER") return "bg-amber-500/20 text-amber-100 border-amber-500/30";
  return "bg-red-500/20 text-red-100 border-red-500/30";
}

function MonitoringDashboardView({
  health,
  incidents,
  monitoring,
  onAction,
  syncLogs,
}: {
  health: PlatformHealth | null;
  incidents: SystemIncident[];
  monitoring: MonitoringOverview | null;
  onAction: (path: string, body?: object) => Promise<void>;
  syncLogs: AuditLogEntry[];
}) {
  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="API health" value={health?.api ?? "OK"} />
        <Metric label="Database" value={health?.database ?? "OK"} />
        <Metric label="Active incidents" value={String(monitoring?.activeIncidents ?? incidents.length)} />
        <Metric label="Last health check" value={monitoring?.lastHealthCheck ? new Date(monitoring.lastHealthCheck).toLocaleString() : "Pending"} />
      </div>
      <Panel title="Monitoring Dashboard">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(monitoring?.components ?? []).map((component) => (
            <div className={`rounded-lg border p-4 ${statusColor(component.status)}`} key={component.name}>
              <p className="text-xs uppercase tracking-[0.14em]">{component.status}</p>
              <h3 className="mt-2 font-semibold">{component.name}</h3>
              <p className="mt-2 text-sm">{component.message}</p>
            </div>
          ))}
          {!monitoring ? <EmptyState message="Monitoring overview is loading." /> : null}
        </div>
      </Panel>
      <Panel title="Incident Management">
        <form
          className="mb-4 grid gap-3 md:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void onAction("/admin/monitoring/incidents", {
              title: form.get("title"),
              severity: form.get("severity"),
              affectedModules: String(form.get("affectedModules") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
            });
            event.currentTarget.reset();
          }}
        >
          <TextField label="Incident title" name="title" type="text" />
          <SelectField label="Severity" name="severity" value="LOW" options={["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((item) => ({ value: item, label: item }))} />
          <TextField label="Affected modules" name="affectedModules" type="text" />
          <div className="md:col-span-3"><SubmitButton>Create incident</SubmitButton></div>
        </form>
        <div className="space-y-3">
          {incidents.map((incident) => (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={incident.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">{incident.severity} - {incident.status}</p>
                  <h3 className="mt-2 font-semibold">{incident.title}</h3>
                  <p className="mt-1 text-sm text-zinc-400">{incident.affectedModules.join(", ") || "No modules linked"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED", "CLOSED"].map((status) => (
                    <button className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-200" key={status} type="button" onClick={() => void onAction(`/admin/monitoring/incidents/${incident.id}`, { status, note: `Status moved to ${status}.` })}>{status}</button>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {!incidents.length ? <EmptyState message="No active incidents. Create one here if production operations require tracking." /> : null}
        </div>
      </Panel>
      <Panel title="Scheduled Job Monitoring">
        <CompactAuditList logs={syncLogs} emptyLabel="No scheduled job logs yet." />
      </Panel>
    </div>
  );
}

function AdminAnnouncementsView({ announcements, onAction }: { announcements: AdminAnnouncement[]; onAction: (path: string, body?: object) => Promise<void> }) {
  return (
    <Panel title="Admin Announcements">
      <form
        className="grid gap-3 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void onAction("/admin/announcements", {
            title: form.get("title"),
            message: form.get("message"),
            status: form.get("status"),
            targetRoles: String(form.get("targetRoles") ?? "ALL").split(",").map((item) => item.trim()).filter(Boolean),
            targetCountries: String(form.get("targetCountries") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
            targetLanguages: String(form.get("targetLanguages") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
            targetSubscriptionPlans: String(form.get("targetSubscriptionPlans") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
          });
          event.currentTarget.reset();
        }}
      >
        <TextField label="Title" name="title" type="text" />
        <SelectField label="Status" name="status" value="DRAFT" options={["DRAFT", "SCHEDULED", "PUBLISHED", "EXPIRED", "ARCHIVED"].map((item) => ({ value: item, label: item }))} />
        <TextField label="Message" name="message" type="text" />
        <TextField label="Target roles" name="targetRoles" type="text" value="ALL" />
        <TextField label="Countries" name="targetCountries" type="text" />
        <TextField label="Languages" name="targetLanguages" type="text" />
        <TextField label="Subscription plans" name="targetSubscriptionPlans" type="text" />
        <div className="md:col-span-2"><SubmitButton>Create announcement</SubmitButton></div>
      </form>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {announcements.map((announcement) => (
          <article className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={announcement.id}>
            <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">{announcement.status}</p>
            <h3 className="mt-2 font-semibold">{announcement.title}</h3>
            <p className="mt-2 text-sm text-zinc-300">{announcement.message}</p>
            <p className="mt-3 text-xs text-zinc-500">Targets: {announcement.targetRoles.join(", ")}</p>
          </article>
        ))}
        {!announcements.length ? <EmptyState message="Announcements will appear here after admin creation. Scheduling is placeholder-only." /> : null}
      </div>
    </Panel>
  );
}

function AdminInvestorManagementView({
  commercialStructure,
  management,
  onAction,
  onSimulate,
}: {
  commercialStructure: CommercialStructure;
  management: AdminInvestorManagement | null;
  onAction: (path: string, body?: object) => Promise<void>;
  onSimulate: (body: InvestorSimulatorInput) => Promise<{ simulation: InvestorSimulatorResult }>;
}) {
  const investors = management?.investors ?? [];
  const queue = management?.distributionQueue ?? [];
  const latestBatch = management?.latestBatch ?? null;

  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Investors" value={String(investors.length)} />
        <Metric label="Distribution queue" value={String(queue.length)} />
        <Metric label="Batch status" value={latestBatch?.status ?? "PENDING_CALCULATION"} />
        <Metric label="Queued payout" value={money(latestBatch?.totalNetDistributionCents ?? 0)} />
      </div>
      <Panel title="Weekly Distribution Queue">
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            className="rounded-md bg-emerald-300 px-3 py-2 text-sm font-semibold text-zinc-950"
            type="button"
            onClick={() => void onAction("/admin/investor-distributions/calculate")}
          >
            Calculate weekly distributions
          </button>
          <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            Placeholder returns only. Admin approval required before payout.
          </span>
        </div>
        <div className="space-y-3">
          {queue.map((distribution) => (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={distribution.id}>
              <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-emerald-300">{distribution.status}</p>
                  <h3 className="mt-2 text-lg font-semibold">{distribution.investorName}</h3>
                  <p className="mt-1 text-sm text-zinc-400">{distribution.investorEmail}</p>
                  <p className="mt-2 text-sm text-zinc-300">
                    {new Date(distribution.periodStart).toLocaleDateString()} to {new Date(distribution.periodEnd).toLocaleDateString()}
                  </p>
                  <p className="mt-2 text-sm text-zinc-500">{distribution.adminNotes ?? "No admin notes yet."}</p>
                </div>
                <div className="grid gap-2 text-sm">
                  <MiniStat label="Capital base" value={money(distribution.capitalBaseCents)} />
                  <MiniStat label="Return rate" value={`${distribution.returnRatePercent.toFixed(2)}%`} />
                  <MiniStat label="Net distribution" value={money(distribution.netDistributionCents)} />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="rounded-md bg-emerald-300 px-3 py-2 text-sm font-semibold text-zinc-950" type="button" onClick={() => void onAction(`/admin/investor-distributions/${distribution.id}/approve`, { adminNotes: "Approved by admin." })}>Approve</button>
                <button className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200" type="button" onClick={() => void onAction(`/admin/investor-distributions/${distribution.id}/reject`, { adminNotes: "Rejected by admin." })}>Reject</button>
                <button className="rounded-md border border-emerald-700 px-3 py-2 text-sm text-emerald-200" type="button" onClick={() => void onAction(`/admin/investor-distributions/${distribution.id}/mark-paid`, { adminNotes: "Marked paid placeholder." })}>Mark paid</button>
              </div>
            </div>
          ))}
          {!queue.length ? <p className="text-sm text-zinc-400">No distribution records yet. Run the placeholder weekly calculation when ready.</p> : null}
        </div>
      </Panel>
      <InvestorSimulatorCalculator
        title="Admin Distribution Scenario Simulator"
        description="Model placeholder distribution scenarios across investor capital before creating an approval queue."
        defaultAmountCents={investors.reduce((total, investor) => total + investor.activeInvestmentBalanceCents, 0)}
        defaultPlatformFeePercent={commercialStructure.simulatorDefaults.platformFeePercent}
        defaultWeeklyReturnPercent={commercialStructure.simulatorDefaults.weeklyReturnPercent}
        lockPeriods={commercialStructure.lockPeriods}
        onSimulate={onSimulate}
      />
      <Panel title="Investor Records">
        <div className="space-y-3">
          {investors.map((investor) => (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={investor.id}>
              <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
                <div>
                  <h3 className="text-lg font-semibold">{investor.name}</h3>
                  <p className="mt-1 text-sm text-zinc-400">{investor.email}</p>
                  <p className="mt-2 text-sm text-zinc-300">{investor.tier} - {investor.accountStatus}</p>
                  <p className="mt-1 text-sm text-zinc-500">KYC: {investor.kycStatus} - Agreement: {investor.agreementStatus}</p>
                </div>
                <div className="grid gap-2">
                  <MiniStat label="Capital" value={money(investor.totalCapitalCents)} />
                  <MiniStat label="Active balance" value={money(investor.activeInvestmentBalanceCents)} />
                  <MiniStat label="Pending payout" value={money(investor.pendingDistributionCents)} />
                </div>
              </div>
              <form
                className="mt-3 flex flex-col gap-2 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void onAction(`/admin/investors/${investor.id}/notes`, { note: form.get("note") });
                  event.currentTarget.reset();
                }}
              >
                <input className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white" name="note" placeholder="Add investor note" />
                <button className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200" type="submit">Add note</button>
              </form>
            </div>
          ))}
          {!investors.length ? <p className="text-sm text-zinc-400">No investor accounts yet.</p> : null}
        </div>
      </Panel>
      <Panel title="Investor Audit Trail">
        <CompactAuditList
          logs={(management?.auditTrail ?? []).map((log) => ({
            id: log.id,
            actorUserId: log.actorUserId,
            action: log.action,
            entityType: log.entityType,
            entityId: log.entityId,
            createdAt: log.createdAt,
          }))}
          emptyLabel="No investor audit logs yet."
        />
      </Panel>
    </div>
  );
}

function InvestorPortal({
  activeView,
  commercialStructure,
  dashboard,
  distributions,
  notifications,
  onAction,
  onInvestorFundingCheckout,
  onSimulate,
  onSubscriptionCheckout,
  paymentCenter,
  plans,
  portfolio,
  profile,
  reports,
  wallet,
  withdrawals,
}: {
  activeView: InvestorNavItem;
  commercialStructure: CommercialStructure;
  dashboard: InvestorDashboard | null;
  distributions: InvestorDistribution[];
  notifications: string[];
  onAction: (path: string, body: object) => Promise<void>;
  onInvestorFundingCheckout: (body: { packageId: string; lockPeriodCode: "SIX_MONTHS" | "TWELVE_MONTHS"; amountCents: number }) => Promise<PaymentOrder | undefined>;
  onSimulate: (body: InvestorSimulatorInput) => Promise<{ simulation: InvestorSimulatorResult }>;
  onSubscriptionCheckout: (planCode: string, billingCycle: "MONTHLY" | "ANNUAL") => Promise<PaymentOrder | undefined>;
  paymentCenter: PaymentCenter | null;
  plans: InvestmentPlan[];
  profile: InvestorProfile | null;
  portfolio: { active: InvestorInvestment[]; completed: InvestorInvestment[] };
  reports: InvestorPortalReport[];
  wallet: InvestorWallet | null;
  withdrawals: WithdrawalRequest[];
}) {
  if (activeView === "Investor Dashboard") {
    return (
      <div className="mt-6 space-y-4">
        <RiskDisclaimer />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Total capital" value={money(dashboard?.balance.totalCapitalCents ?? 0)} />
          <Metric label="Active balance" value={money(dashboard?.balance.activeInvestmentBalanceCents ?? 0)} />
          <Metric label="Weekly earnings" value={money(dashboard?.weeklyEarningsCents ?? 0)} />
          <Metric label="Total earnings" value={money(dashboard?.totalEarningsCents ?? 0)} />
          <Metric label="Next distribution" value={dashboard?.nextDistributionDate ? new Date(dashboard.nextDistributionDate).toLocaleDateString() : "Pending"} />
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Panel title="Executive Overview">
            <div className="grid gap-3 sm:grid-cols-2">
              <MiniStat label="Investor tier" value={dashboard?.investorTier ?? "Founding Investor"} />
              <MiniStat label="Recognition level" value={investorLevelName(commercialStructure, dashboard?.balance.totalCapitalCents ?? 0)} />
              <MiniStat label="Account status" value={dashboard?.accountStatus ?? "ACTIVE"} />
              <MiniStat label="Distribution status" value={dashboard?.distributionStatus ?? "PENDING_CALCULATION"} />
              <MiniStat label="Performance placeholder" value={`${(dashboard?.weeklyRoiPercent ?? 0).toFixed(2)}% weekly`} />
            </div>
            <p className="mt-4 rounded-md bg-amber-500/10 p-3 text-sm text-amber-100">{dashboard?.riskNotice ?? "Capital is at risk. Historical performance is not a guarantee of future results."}</p>
            <p className="mt-3 text-sm text-zinc-400">{dashboard?.transparencyNote ?? "Distribution values are placeholders pending real settlement integrations."}</p>
          </Panel>
          <Panel title="Performance Chart">
            <div className="space-y-3">
              {(dashboard?.performanceChart ?? []).map((point) => (
                <div key={point.label}>
                  <div className="mb-1 flex justify-between text-sm text-zinc-300"><span>{point.label}</span><span>{money(point.valueCents)}</span></div>
                  <div className="h-2 rounded-full bg-zinc-800"><div className="h-2 rounded-full bg-emerald-300" style={{ width: `${Math.min(100, Math.max(8, point.valueCents / 10000))}%` }} /></div>
                </div>
              ))}
              {!(dashboard?.performanceChart.length) ? <p className="text-sm text-zinc-400">Performance chart will populate as capital and distributions are recorded.</p> : null}
            </div>
          </Panel>
        </div>
        <Panel title="Recent Distributions">
          <DistributionList distributions={dashboard?.recentDistributions ?? []} />
        </Panel>
      </div>
    );
  }

  if (activeView === "Earnings") {
    return (
      <div className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Weekly earnings" value={money(dashboard?.weeklyEarningsCents ?? 0)} />
          <Metric label="Total earnings" value={money(dashboard?.totalEarningsCents ?? 0)} />
          <Metric label="Pending distributions" value={money(dashboard?.balance.pendingDistributionCents ?? 0)} />
          <Metric label="Paid distributions" value={money(dashboard?.balance.paidDistributionCents ?? 0)} />
        </div>
        <Panel title="Distribution History">
          <DistributionList distributions={distributions} />
        </Panel>
      </div>
    );
  }

  if (activeView === "Simulator") {
    return (
      <div className="mt-6 space-y-4">
        <RiskDisclaimer />
        <InvestorSimulatorCalculator
          title="Investor Simulator Calculator"
          description="Simulate possible earnings before or after investing using safe placeholder assumptions."
          defaultAmountCents={dashboard?.balance.totalCapitalCents || 100000}
          defaultPlatformFeePercent={commercialStructure.simulatorDefaults.platformFeePercent}
          defaultWeeklyReturnPercent={commercialStructure.simulatorDefaults.weeklyReturnPercent}
          lockPeriods={commercialStructure.lockPeriods}
          onSimulate={onSimulate}
        />
      </div>
    );
  }

  if (activeView === "Reports") {
    return (
      <Panel title="Investor Reports">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {reports.map((report) => (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={report.id}>
              <p className="text-xs uppercase tracking-[0.12em] text-emerald-300">{report.periodType}</p>
              <h3 className="mt-2 font-semibold">{report.title}</h3>
              <p className="mt-2 text-sm text-zinc-400">{report.summary}</p>
              <p className="mt-2 text-sm text-zinc-300">Earnings: {money(report.earningsCents)}</p>
              <p className="text-sm text-zinc-300">ROI: {report.roiPercent.toFixed(2)}%</p>
              <button className="mt-3 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200" type="button">Download placeholder</button>
            </div>
          ))}
          {!reports.length ? <p className="text-sm text-zinc-400">Weekly and monthly reports will appear here.</p> : null}
        </div>
      </Panel>
    );
  }

  if (activeView === "Capital") {
    return (
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Capital Summary">
          <div className="grid gap-3 sm:grid-cols-2">
            <MiniStat label="Investment amount" value={money(profile?.account.investmentAmountCents ?? 0)} />
            <MiniStat label="Investor level" value={investorLevelName(commercialStructure, profile?.balance.totalCapitalCents ?? 0)} />
            <MiniStat label="Active investment balance" value={money(profile?.balance.activeInvestmentBalanceCents ?? 0)} />
            <MiniStat label="Start date" value={profile?.account.startDate ? new Date(profile.account.startDate).toLocaleDateString() : "Pending"} />
            <MiniStat label="Agreement" value={profile?.account.agreementStatus ?? "PENDING_SIGNATURE"} />
          </div>
        </Panel>
        <Panel title="Investment History"><InvestmentList investments={dashboard?.investmentHistory ?? []} /></Panel>
      </div>
    );
  }

  if (activeView === "Profile") {
    return (
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Investor Profile">
          <div className="space-y-2 text-sm text-zinc-300">
            <p>Name: {profile?.account.name ?? "Investor"}</p>
            <p>Email: {profile?.account.email ?? "Pending"}</p>
            <p>Tier: {profile?.account.tier ?? "Founding Investor"}</p>
            <p>Recognition level: {investorLevelName(commercialStructure, profile?.balance.totalCapitalCents ?? 0)}</p>
            <p>KYC: {profile?.account.kycStatus ?? "PENDING_REVIEW"}</p>
            <p>Account status: {profile?.account.accountStatus ?? "ACTIVE"}</p>
          </div>
        </Panel>
        <Panel title="Methods">
          <div className="space-y-2 text-sm text-zinc-300">
            <p>Payment method: {profile?.account.paymentMethod ?? "Placeholder - not connected"}</p>
            <p>Withdrawal method: {profile?.account.withdrawalMethod ?? "Placeholder - admin review required"}</p>
            <p>Security: protected by authenticated investor-only API routes.</p>
          </div>
        </Panel>
      </div>
    );
  }

  if (activeView === "Documents") {
    return (
      <Panel title="Documents">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {["Investor Agreement", "Risk Disclosure", "Weekly Statement", "Monthly Statement"].map((item) => (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={item}>
              <h3 className="font-semibold">{item}</h3>
              <p className="mt-2 text-sm text-zinc-400">Document generation placeholder. Secure downloads will be enabled later.</p>
              <button className="mt-3 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200" type="button">Download placeholder</button>
            </div>
          ))}
        </div>
      </Panel>
    );
  }

  if (activeView === "Support") {
    return (
      <Panel title="Investor Support">
        <div className="space-y-3 text-sm text-zinc-300">
          <p>For capital, distribution, and account questions, contact FPF operations through the official support channel.</p>
          <p className="rounded-md bg-emerald-500/10 p-3 text-emerald-100">Support ticketing placeholder. No external helpdesk integration is connected yet.</p>
          <NotificationList notifications={notifications} />
        </div>
      </Panel>
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
                <p className="font-semibold">{transaction.type} Â· {transaction.status} Â· {money(transaction.amountCents)}</p>
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

  if (activeView === "Payments") {
    return (
      <InvestorPaymentCenterView
        center={paymentCenter}
        commercialStructure={commercialStructure}
        onInvestorFundingCheckout={onInvestorFundingCheckout}
        onSubscriptionCheckout={onSubscriptionCheckout}
      />
    );
  }

  if (activeView === "Investment Plans") {
    return (
      <Panel title="Investment Plans">
        <RiskDisclaimer />
        <p className="mt-3 rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">
          Minimum investment is {money(commercialStructure.minimumInvestmentCents)}. Use Payments for secure NOWPayments checkout. This section remains available for placeholder investment interest records.
        </p>
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
              <label className="mt-3 block text-sm font-medium text-zinc-200">
                Lock period
                <select className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none focus:border-emerald-300" name="lockPeriod" defaultValue={commercialStructure.lockPeriods[0]?.code ?? "SIX_MONTHS"}>
                  {commercialStructure.lockPeriods.filter((period) => period.enabled).map((period) => (
                    <option key={period.code} value={period.code}>{period.label}</option>
                  ))}
                </select>
              </label>
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
              <p className="font-semibold">{money(request.amountCents)} Â· {request.status}</p>
              <p className="mt-1 text-sm text-zinc-400">Requested {new Date(request.requestedAt).toLocaleString()}</p>
            </div>
          ))}
          {!withdrawals.length ? <p className="text-sm text-zinc-400">No withdrawal requests yet.</p> : null}
        </div>
      </Panel>
    </div>
  );
}

function ProviderStatusPanel({ center }: { center: PaymentCenter | null }) {
  const provider = center?.provider;
  return (
    <Panel title="NOWPayments Provider Status">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="Connection" value={provider?.status ?? "MISSING_CONFIGURATION"} />
        <MiniStat label="Price currency" value={provider?.priceCurrency ?? "USD"} />
        <MiniStat label="Payment asset" value={provider?.payCurrency ?? "USDTTRC20"} />
        <MiniStat label="Webhook" value={provider?.webhookUrl ? "Ready" : "Pending"} />
      </div>
      {provider?.configured ? (
        <p className="mt-3 rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-100">Provider credentials are configured server-side. Secret values are never shown.</p>
      ) : (
        <p className="mt-3 rounded-md bg-amber-500/10 p-3 text-sm text-amber-100">Provider not configured: {(provider?.missingVariables ?? []).join(", ") || "environment variables missing"}.</p>
      )}
      <p className="mt-3 break-all text-xs text-zinc-500">Production webhook URL: {provider?.webhookUrl ?? "https://football-performance-funds-backend.vercel.app/api/payments/nowpayments/webhook"}</p>
    </Panel>
  );
}

function PaymentOrderList({ orders, admin, onAction }: { orders: PaymentOrder[]; admin?: boolean; onAction?: (path: string, body?: object) => Promise<void> }) {
  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={order.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-emerald-300">{order.purpose}</p>
              <h3 className="mt-1 font-semibold">{order.providerPaymentId ?? order.id}</h3>
              <p className="mt-1 text-sm text-zinc-400">Expected {money(order.expectedAmountCents)} Ã‚Â· Received {money(order.receivedAmountCents)} Ã‚Â· {order.priceCurrency}/{order.payCurrency}</p>
              <p className="mt-1 text-sm text-zinc-400">Reconciliation: {order.reconciliationStatus}</p>
            </div>
            <StatusPill status={order.status} />
          </div>
          {order.paymentAddress ? (
            <p className="mt-3 break-all rounded-md bg-zinc-900 p-3 text-xs text-zinc-300">Payment address: {order.paymentAddress}</p>
          ) : null}
          {order.checkoutUrl ? (
            <a className="mt-3 inline-flex rounded-md bg-emerald-300 px-3 py-2 text-sm font-semibold text-zinc-950" href={order.checkoutUrl} rel="noreferrer" target="_blank">Open secure checkout</a>
          ) : null}
          {admin && onAction ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-200" type="button" onClick={() => void onAction(`/admin/payments/${order.id}/refresh`)}>Refresh status</button>
              <button className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-200" type="button" onClick={() => void onAction(`/admin/payments/${order.id}/notes`, { note: "Reviewed from Admin Payment Center." })}>Add review note</button>
            </div>
          ) : null}
        </div>
      ))}
      {!orders.length ? <p className="text-sm text-zinc-400">No payment orders yet.</p> : null}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone = ["FINISHED", "CONFIRMED"].includes(status)
    ? "bg-emerald-500/10 text-emerald-200"
    : ["FAILED", "EXPIRED", "REFUNDED", "DISPUTED"].includes(status)
      ? "bg-red-500/10 text-red-200"
      : ["PARTIALLY_PAID", "MANUAL_REVIEW"].includes(status)
        ? "bg-amber-500/10 text-amber-100"
        : "bg-blue-500/10 text-blue-100";
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{status}</span>;
}

function InvestorPaymentCenterView({
  center,
  commercialStructure,
  onInvestorFundingCheckout,
  onSubscriptionCheckout,
}: {
  center: PaymentCenter | null;
  commercialStructure: CommercialStructure;
  onInvestorFundingCheckout: (body: { packageId: string; lockPeriodCode: "SIX_MONTHS" | "TWELVE_MONTHS"; amountCents: number }) => Promise<PaymentOrder | undefined>;
  onSubscriptionCheckout: (planCode: string, billingCycle: "MONTHLY" | "ANNUAL") => Promise<PaymentOrder | undefined>;
}) {
  return (
    <div className="mt-6 space-y-4">
      <ProviderStatusPanel center={center} />
      <Panel title="Secure Checkout">
        <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-100">
          Send only the displayed asset using the displayed network. Sending another asset or network may result in loss or delay.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <form
            className="rounded-lg border border-zinc-800 bg-zinc-950 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void onSubscriptionCheckout(String(form.get("planCode")), String(form.get("billingCycle")) as "MONTHLY" | "ANNUAL");
            }}
          >
            <h3 className="font-semibold">Subscription checkout</h3>
            <label className="mt-3 block text-sm text-zinc-300">Plan
              <select className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-white" name="planCode" defaultValue="PROFESSIONAL">
                {commercialStructure.subscriberPlans.filter((plan) => plan.monthlyPriceCents > 0).map((plan) => (
                  <option key={plan.code} value={plan.code}>{plan.name} - {money(plan.monthlyPriceCents)}/mo</option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-sm text-zinc-300">Billing
              <select className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-white" name="billingCycle" defaultValue="MONTHLY">
                <option value="MONTHLY">Monthly</option>
                <option value="ANNUAL">Annual</option>
              </select>
            </label>
            <div className="mt-4"><SubmitButton>Create subscription checkout</SubmitButton></div>
          </form>
          <form
            className="rounded-lg border border-zinc-800 bg-zinc-950 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void onInvestorFundingCheckout({
                packageId: String(form.get("packageId")),
                lockPeriodCode: String(form.get("lockPeriodCode")) as "SIX_MONTHS" | "TWELVE_MONTHS",
                amountCents: Math.round(Number(form.get("amount")) * 100),
              });
            }}
          >
            <h3 className="font-semibold">Investor funding checkout</h3>
            <label className="mt-3 block text-sm text-zinc-300">Package
              <select className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-white" name="packageId" defaultValue={commercialStructure.investorPackages[0]?.id}>
                {commercialStructure.investorPackages.filter((item) => item.status === "ACTIVE" && item.visible).map((item) => (
                  <option key={item.id} value={item.id}>{item.name} - minimum {money(item.minimumAmountCents)}</option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-sm text-zinc-300">Lock period
              <select className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-white" name="lockPeriodCode" defaultValue="SIX_MONTHS">
                {commercialStructure.lockPeriods.filter((item) => item.enabled).map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
              </select>
            </label>
            <TextField label="Funding amount" name="amount" type="number" />
            <p className="mt-3 text-xs text-zinc-500">Simulation only. Returns are not guaranteed. Principal is recorded separately from company profit after confirmed payment.</p>
            <div className="mt-4"><SubmitButton>Create investor checkout</SubmitButton></div>
          </form>
        </div>
      </Panel>
      <Panel title="Transaction History">
        <PaymentOrderList orders={center?.orders ?? []} />
      </Panel>
    </div>
  );
}

function AdminPaymentCenterView({ center, onAction }: { center: PaymentCenter | null; onAction: (path: string, body?: object) => Promise<void> }) {
  const orders = center?.orders ?? [];
  const manualReview = orders.filter((order) => ["MANUAL_REVIEW", "PARTIALLY_PAID"].includes(order.status));
  return (
    <div className="mt-6 space-y-4">
      <ProviderStatusPanel center={center} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Payment orders" value={String(orders.length)} />
        <Metric label="Confirmed" value={String(orders.filter((order) => ["CONFIRMED", "FINISHED"].includes(order.status)).length)} />
        <Metric label="Manual review" value={String(manualReview.length)} />
        <Metric label="Expected value" value={money(orders.reduce((total, order) => total + order.expectedAmountCents, 0))} />
      </div>
      <Panel title="Manual Review Queue">
        <PaymentOrderList orders={manualReview} admin onAction={onAction} />
      </Panel>
      <Panel title="All Payment Orders">
        <PaymentOrderList orders={orders} admin onAction={onAction} />
      </Panel>
    </div>
  );
}

function PublicLaunchExperience({
  apiCheck,
  apiUrl,
  commercialStructure,
  currencies,
  currentPath,
  error,
  experience,
  languages,
  message,
  mode,
  onApiTest,
  onForgot,
  onLocalPreferenceChange,
  onLogin,
  onNavigate,
  onRegister,
  onThemeChange,
  preferences,
  setMode,
  theme,
}: {
  apiCheck: string;
  apiUrl: string;
  commercialStructure: CommercialStructure;
  currencies: CurrencySetting[];
  currentPath: string;
  error: string;
  experience: PublicExperience | null;
  languages: LanguageSetting[];
  message: string;
  mode: AuthMode;
  onApiTest: () => void;
  onForgot: (event: FormEvent<HTMLFormElement>) => void;
  onLocalPreferenceChange: (preferences: Partial<UserGlobalPreferences>) => void;
  onLogin: (event: FormEvent<HTMLFormElement>) => void;
  onNavigate: (path: string, id?: string) => void;
  onRegister: (event: FormEvent<HTMLFormElement>) => void;
  onThemeChange: (theme: ThemePreference) => void;
  preferences: UserGlobalPreferences;
  setMode: (mode: AuthMode) => void;
  theme: ThemePreference;
}) {
  const currentPage = getCanonicalPublicPage(currentPath);
  const isUnknownPublicRoute = !currentPage && !isLegacyPrivatePath(currentPath) && !["/login", "/signin", "/sign-in", "/register", "/get-started", "/subscribe", "/become-an-investor", "/apply-as-analyst", "/forgot-password", "/reset-password"].includes(currentPath);
  if (isUnknownPublicRoute) {
    return <PublicNotFoundPage onNavigate={onNavigate} />;
  }
  return (
    <Mission21PublicExperience
      authPanel={
        <AuthPanel
          apiCheck={apiCheck}
          apiUrl={apiUrl}
          currencies={currencies}
          error={error}
          languages={languages}
          message={message}
          mode={mode}
          onApiTest={onApiTest}
          onForgot={onForgot}
          onLocalPreferenceChange={onLocalPreferenceChange}
          onLogin={onLogin}
          onRegister={onRegister}
          preferences={preferences}
          setMode={setMode}
        />
      }
      commercialStructure={commercialStructure}
      currentPath={currentPath}
      experience={experience}
      onNavigate={onNavigate}
      onThemeChange={onThemeChange}
      publicPageDefinitions={publicPageDefinitions}
      theme={theme}
    />
  );
}

function LaunchCard({ body, title }: { body: string; title: string }) {
  return (
    <article className="rounded-lg border border-emerald-400/20 bg-zinc-900/80 p-5 shadow-xl shadow-emerald-950/10">
      <p className="text-xs uppercase tracking-[0.16em] text-emerald-300">{title}</p>
      <p className="mt-3 text-sm leading-6 text-zinc-300">{body}</p>
    </article>
  );
}

function LaunchPanel({ id, items, title }: { id: string; items: string[]; title: string }) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-5" id={id}>
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-4 grid gap-2">
        {items.map((item) => <div className="rounded-md bg-zinc-950 p-3 text-sm text-zinc-300" key={item}>{item}</div>)}
      </div>
    </section>
  );
}

function AnalystApplicationPortal() {
  const [status, setStatus] = useState("");
  return (
    <section className="rounded-lg border border-emerald-400/20 bg-zinc-900 p-5" id="analyst-applications">
      <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-emerald-300">Professional Analyst Portal</p>
          <h2 className="mt-2 text-2xl font-semibold">Apply to work inside the FPF intelligence desk.</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-300">
            Analysts are internal professionals. FPF does not publish analyst profiles, rankings, names, followers, likes, or individual public tips.
            Approved candidates enter a 14-day academy with virtual capital and demo fixtures before any admin promotion decision.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <MiniStat label="Academy" value="14 days" />
            <MiniStat label="Capital" value="Virtual only" />
            <MiniStat label="Visibility" value="Internal" />
          </div>
        </div>
        <form
          className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setStatus("Submitting application...");
            try {
              await fetchJson<{ application: AnalystApplication }>(apiEndpoint("/analyst-applications"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  fullName: form.get("fullName"),
                  email: form.get("email"),
                  country: form.get("country"),
                  footballExperience: form.get("footballExperience"),
                  preferredLeagues: String(form.get("preferredLeagues") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
                  yearsOfExperience: Number(form.get("yearsOfExperience")),
                  countriesCovered: String(form.get("countriesCovered") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
                  predictionStyle: form.get("predictionStyle"),
                  motivationStatement: form.get("motivationStatement"),
                }),
              });
              setStatus("Application submitted. FPF will review it internally.");
              event.currentTarget.reset();
            } catch (caughtError) {
              setStatus(caughtError instanceof Error ? caughtError.message : "Unable to submit application.");
            }
          }}
        >
          <TextField label="Full name" name="fullName" type="text" />
          <TextField label="Email" name="email" type="email" />
          <TextField label="Country" name="country" type="text" />
          <TextField label="Years of experience" name="yearsOfExperience" type="number" value="3" />
          <TextField label="Preferred leagues" name="preferredLeagues" type="text" value="Premier League, La Liga" />
          <TextField label="Countries covered" name="countriesCovered" type="text" value="England, Spain" />
          <TextField label="Prediction style" name="predictionStyle" type="text" value="Risk-managed market analysis" />
          <TextField label="Football experience" name="footballExperience" type="text" />
          <TextField label="Motivation statement" name="motivationStatement" type="text" />
          <SubmitButton>Submit analyst application</SubmitButton>
          {status ? <p className="text-sm text-emerald-200">{status}</p> : null}
        </form>
      </div>
    </section>
  );
}

function PublicNotFoundPage({ onNavigate }: { onNavigate: (path: string, id?: string) => void }) {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[80vh] max-w-3xl flex-col justify-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">404</p>
        <h1 className="mt-4 text-4xl font-black tracking-normal sm:text-6xl">This FPF page moved.</h1>
        <p className="mt-5 text-lg leading-8 text-zinc-300">
          The public website and operating system now run as one platform. Use the unified navigation to continue.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button className="rounded-md bg-emerald-300 px-5 py-3 text-sm font-semibold text-zinc-950" type="button" onClick={() => onNavigate("/", "home")}>Go Home</button>
          <button className="rounded-md border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-100" type="button" onClick={() => onNavigate("/platform", "platform")}>View Platform</button>
          <button className="rounded-md border border-emerald-700 px-5 py-3 text-sm font-semibold text-emerald-100" type="button" onClick={() => onNavigate("/pricing", "pricing")}>View Pricing</button>
        </div>
      </div>
    </main>
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
  currencies,
  languages,
  onLocalPreferenceChange,
  preferences,
}: {
  apiCheck: string;
  apiUrl: string;
  currencies: CurrencySetting[];
  error: string;
  languages: LanguageSetting[];
  message: string;
  mode: AuthMode;
  onApiTest: () => void;
  onForgot: (event: FormEvent<HTMLFormElement>) => void;
  onLocalPreferenceChange: (preferences: Partial<UserGlobalPreferences>) => void;
  onLogin: (event: FormEvent<HTMLFormElement>) => void;
  onRegister: (event: FormEvent<HTMLFormElement>) => void;
  preferences: UserGlobalPreferences;
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
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-zinc-200">
          Language
          <select className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-white" value={preferences.language} onChange={(event) => onLocalPreferenceChange({ language: event.target.value as UserGlobalPreferences["language"] })}>
            {(languages.length ? languages : [{ code: "en", name: "English", nativeName: "English", direction: "ltr", enabled: true } as LanguageSetting]).filter((item) => item.enabled).map((language) => (
              <option key={language.code} value={language.code}>{language.nativeName}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-zinc-200">
          Currency
          <select className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-white" value={preferences.currency} onChange={(event) => onLocalPreferenceChange({ currency: event.target.value as UserGlobalPreferences["currency"] })}>
            {(currencies.length ? currencies : [{ code: "USD", name: "US Dollar", symbol: "$", placeholderRateFromUsd: 1, enabled: true } as CurrencySetting]).filter((item) => item.enabled).map((currency) => (
              <option key={currency.code} value={currency.code}>{currency.code}</option>
            ))}
          </select>
        </label>
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
  onRefreshFixtures,
  predictions,
  recent,
  upcomingFixtures,
  workflowPredictions,
}: {
  commandCenter: SubscriberCommandCenter | null;
  decisions: DecisionEngineOutput[];
  featured: PredictionWithFixture[];
  intelligence: PublishedIntelligence[];
  liveFixtures: FootballFixtureSummary[];
  notifications: string[];
  onAdd: (prediction: PredictionWithFixture) => void;
  onRefreshFixtures: () => void;
  predictions: PredictionWithFixture[];
  recent: PredictionWithFixture[];
  upcomingFixtures: FootballFixtureSummary[];
  workflowPredictions: PredictionQueueItem[];
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
        <WorkflowPublicationCards predictions={workflowPredictions} />
        <SubscriberOpportunityCards opportunities={opportunities} />
        {!opportunities.length ? <OpportunityCards predictions={featured} onAdd={onAdd} /> : null}
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Live Intelligence Feed">
          <FeedList feed={commandCenter?.liveIntelligenceFeed ?? []} />
        </Panel>
        <Panel title="Live Match Center">
          <div className="grid gap-4 sm:grid-cols-2">
            <CompactFixtureList fixtures={liveFixtures} emptyMessage="No live matches are available right now. Upcoming fixtures continue to sync in the background." onRetry={onRefreshFixtures} />
            <CompactFixtureList fixtures={upcomingFixtures} emptyMessage="Upcoming fixtures are syncing. Run Admin Fixture Management refresh if this remains empty." onRetry={onRefreshFixtures} />
          </div>
        </Panel>
      </div>
      <Panel title="FPF Intelligence">
        <div className="grid gap-3 md:grid-cols-2">
          {intelligence.map((item) => (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={item.id}>
              <p className="text-xs uppercase tracking-[0.12em] text-emerald-300">FPF Intelligence</p>
              <h3 className="mt-2 font-semibold">{item.match}</h3>
              <p className="mt-1 text-sm text-zinc-400">{item.market} Â· {item.prediction}</p>
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
        {commandCenter ? <NotificationCenterView legacyNotifications={commandCenter.notifications} notifications={[]} compact /> : <NotificationList notifications={notifications} />}
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

function PredictionWorkflowPanel({
  onAction,
  queue,
}: {
  onAction: (path: string, body?: object) => Promise<void>;
  queue: PredictionWorkflowQueue | null;
}) {
  const summary = queue?.summary;
  const items = queue?.items ?? [];

  return (
    <Panel title="Prediction Intelligence Workflow">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        <Metric label="Pending" value={String(summary?.pending ?? 0)} />
        <Metric label="Approved" value={String(summary?.approved ?? 0)} />
        <Metric label="Rejected" value={String(summary?.rejected ?? 0)} />
        <Metric label="Published" value={String(summary?.published ?? 0)} />
        <Metric label="Draft" value={String(summary?.draft ?? 0)} />
        <Metric label="Expired" value={String(summary?.expired ?? 0)} />
        <Metric label="Archived" value={String(summary?.archived ?? 0)} />
      </div>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4" key={item.id}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-emerald-300">{item.status} Â· Priority {item.priority}</p>
                <h3 className="mt-2 font-semibold">{item.match}</h3>
                <p className="mt-1 text-sm text-zinc-400">{item.league} Â· {item.recommendedMarket} Â· {item.predictedOutcome}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-300">{item.explanation || item.reasoning[0] || "Pending analyst review."}</p>
                {item.warnings[0] ? <p className="mt-2 text-xs text-amber-200">{item.warnings[0]}</p> : null}
              </div>
              <div className="grid min-w-64 grid-cols-3 gap-2 text-xs">
                <MiniStat label="Conf" value={`${item.confidenceScore}%`} />
                <MiniStat label="Risk" value={String(item.riskScore)} />
                <MiniStat label="Opp" value={String(item.opportunityScore)} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="rounded-md bg-emerald-300 px-3 py-2 text-sm font-semibold text-zinc-950" type="button" onClick={() => void onAction(`/prediction-workflow/queue/${item.id}/actions`, { action: "APPROVE", reason: "Analyst approved candidate." })}>Approve</button>
              <button className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200" type="button" onClick={() => void onAction(`/prediction-workflow/queue/${item.id}/actions`, { action: "REJECT", reason: "Analyst rejected candidate." })}>Reject</button>
              <button className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200" type="button" onClick={() => void onAction(`/prediction-workflow/queue/${item.id}/actions`, { action: "REQUEST_REVIEW", reason: "Further review requested." })}>Request review</button>
              <button className="rounded-md border border-amber-700 px-3 py-2 text-sm text-amber-100" type="button" onClick={() => void onAction(`/prediction-workflow/queue/${item.id}/actions`, { action: "FLAG_HIGH_RISK", notes: "High risk flag added." })}>Flag risk</button>
              <button className="rounded-md border border-emerald-700 px-3 py-2 text-sm text-emerald-100" type="button" onClick={() => void onAction(`/prediction-workflow/queue/${item.id}/actions`, { action: "MARK_FEATURED", notes: "Featured candidate." })}>Feature</button>
              <button className="rounded-md border border-emerald-700 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-100" type="button" onClick={() => void onAction(`/prediction-workflow/queue/${item.id}/actions`, { action: "PUBLISH", reason: "Final intelligence approval for subscriber publication." })}>Publish</button>
              <button className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200" type="button" onClick={() => void onAction(`/prediction-workflow/queue/${item.id}/actions`, { action: "ARCHIVE", reason: "Archived by workflow reviewer." })}>Archive</button>
            </div>
          </div>
        ))}
        {!items.length ? <EmptyState message="Prediction candidates will appear here after Decision Engine evaluation or fixture synchronization." /> : null}
      </div>
    </Panel>
  );
}

function WorkflowPublicationCards({ predictions }: { predictions: PredictionQueueItem[] }) {
  if (!predictions.length) return null;

  return (
    <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {predictions.map((prediction) => (
        <div className="rounded-lg border border-emerald-400/20 bg-slate-950/80 p-4" key={prediction.id}>
          <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">Published Prediction Intelligence</p>
          <h3 className="mt-2 font-semibold">{prediction.match}</h3>
          <p className="mt-1 text-sm text-slate-400">{prediction.league}</p>
          <p className="mt-4 text-sm font-medium text-white">{prediction.recommendedMarket}: {prediction.predictedOutcome}</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <MiniStat label="Conf" value={`${prediction.confidenceScore}%`} />
            <MiniStat label="Risk" value={String(prediction.riskScore)} />
            <MiniStat label="Opp" value={String(prediction.opportunityScore)} />
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">{prediction.explanation || prediction.reasoning[0]}</p>
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
  workflowPredictions,
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
  workflowPredictions: PredictionQueueItem[];
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
        <WorkflowPublicationCards predictions={workflowPredictions} />
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

function ReportsView({ operationalReports, reports }: { operationalReports: OperationalReport[]; reports: SubscriberReport[] }) {
  return (
    <Panel title="Intelligence Reports">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {operationalReports.map((report) => (
          <article className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-4" key={report.id}>
            <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">{report.type} - {report.status}</p>
            <h3 className="mt-2 text-lg font-semibold">{report.title}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">{report.summary}</p>
            <p className="mt-4 text-xs text-slate-500">{report.generatedAt ? new Date(report.generatedAt).toLocaleString() : "Pending generation"}</p>
          </article>
        ))}
        {reports.map((report) => (
          <article className="rounded-lg border border-slate-800 bg-slate-950 p-4" key={report.id}>
            <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">{report.category}</p>
            <h3 className="mt-2 text-lg font-semibold">{report.title}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">{report.summary}</p>
            <p className="mt-4 text-xs text-slate-500">{new Date(report.publishedAt).toLocaleString()}</p>
          </article>
        ))}
        {!reports.length && !operationalReports.length ? <EmptyState message="Daily briefings, weekly reports, market trends, and league analysis will appear here." /> : null}
      </div>
    </Panel>
  );
}

function NotificationCenterView({
  compact = false,
  legacyNotifications,
  notifications,
  onMarkRead,
  onSavePreferences,
  preferences,
}: {
  compact?: boolean;
  legacyNotifications: SubscriberNotification[];
  notifications: OperationalNotification[];
  onMarkRead?: (id: string) => Promise<void>;
  onSavePreferences?: (preferences: Partial<NotificationPreferences>) => Promise<void>;
  preferences?: NotificationPreferences | null;
}) {
  const content = (
    <div className="space-y-3">
      {notifications.map((notification) => (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-4" key={notification.id}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">{notification.category} - {notification.status}</p>
              <h3 className="mt-2 font-semibold">{notification.title}</h3>
            </div>
            {notification.status === "UNREAD" && onMarkRead ? (
              <button className="rounded-md border border-emerald-700 px-3 py-2 text-xs text-emerald-100" type="button" onClick={() => void onMarkRead(notification.id)}>Mark read</button>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-slate-300">{notification.message}</p>
          <p className="mt-3 text-xs text-slate-500">{new Date(notification.createdAt).toLocaleString()}</p>
        </div>
      ))}
      {legacyNotifications.map((notification) => (
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-4" key={notification.id}>
          <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">{notification.type}</p>
          <h3 className="mt-2 font-semibold">{notification.title}</h3>
          <p className="mt-2 text-sm text-slate-300">{notification.message}</p>
          <p className="mt-3 text-xs text-slate-500">{new Date(notification.createdAt).toLocaleString()}</p>
        </div>
      ))}
      {!notifications.length && !legacyNotifications.length ? <EmptyState message="No subscriber notifications right now." /> : null}
      {!compact && preferences && onSavePreferences ? (
        <Panel title="Notification Preferences">
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void onSavePreferences({
                inAppEnabled: form.get("inAppEnabled") === "on",
                emailPlaceholderEnabled: form.get("emailPlaceholderEnabled") === "on",
                smsPlaceholderEnabled: form.get("smsPlaceholderEnabled") === "on",
                whatsappPlaceholderEnabled: form.get("whatsappPlaceholderEnabled") === "on",
                pushPlaceholderEnabled: form.get("pushPlaceholderEnabled") === "on",
                marketingEnabled: form.get("marketingEnabled") === "on",
                financialEnabled: form.get("financialEnabled") === "on",
                predictionEnabled: form.get("predictionEnabled") === "on",
              });
            }}
          >
            {[
              ["inAppEnabled", "In-app notifications"],
              ["emailPlaceholderEnabled", "Email placeholder"],
              ["smsPlaceholderEnabled", "SMS placeholder"],
              ["whatsappPlaceholderEnabled", "WhatsApp placeholder"],
              ["pushPlaceholderEnabled", "Push placeholder"],
              ["marketingEnabled", "Marketing notifications"],
              ["financialEnabled", "Financial notifications"],
              ["predictionEnabled", "Prediction notifications"],
            ].map(([name, label]) => (
              <label className="flex items-center gap-2 text-sm text-slate-300" key={name}>
                <input defaultChecked={Boolean(preferences[name as keyof NotificationPreferences])} name={name} type="checkbox" />
                {label}
              </label>
            ))}
            <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-100 sm:col-span-2">Security alerts remain mandatory and cannot be fully disabled.</p>
            <div className="sm:col-span-2"><SubmitButton>Save notification preferences</SubmitButton></div>
          </form>
        </Panel>
      ) : null}
    </div>
  );

  return compact ? content : <Panel title="Subscriber Notification Center">{content}</Panel>;
}

function UnifiedCommandBar({
  activeModule,
  favorites,
  notifications,
  onFavorite,
  onNotifications,
  onQuery,
  onResult,
  onSettings,
  query,
  recentPages,
  results,
  role,
}: {
  activeModule: string;
  favorites: string[];
  notifications: OperationalNotification[];
  onFavorite: () => void;
  onNotifications: () => void;
  onQuery: (value: string) => void;
  onResult: (result: SearchResult) => void;
  onSettings: () => void;
  query: string;
  recentPages: string[];
  results: SearchResult[];
  role: AuthUser["role"];
}) {
  const unread = notifications.filter((item) => item.status === "UNREAD").length;
  return (
    <section className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/80 p-3">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto] lg:items-start">
        <div className="relative">
          <input
            aria-label="Global FPF search"
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-white outline-none transition focus:border-emerald-300"
            placeholder="Search fixtures, predictions, reports, users, articles, media, settings, commands"
            type="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
          />
          {query ? (
            <div className="absolute left-0 right-0 top-12 z-20 max-h-80 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-2 shadow-2xl">
              {results.map((result) => (
                <button className="w-full rounded-md p-3 text-left text-sm transition hover:bg-zinc-900" key={`${result.category}-${result.title}`} type="button" onClick={() => onResult(result)}>
                  <p className="text-xs uppercase tracking-[0.12em] text-emerald-300">{result.category}</p>
                  <p className="mt-1 font-semibold">{result.title}</p>
                  <p className="mt-1 text-zinc-400">{result.description}</p>
                </button>
              ))}
              {!results.length ? <EmptyState message="No matching platform records yet." /> : null}
            </div>
          ) : null}
        </div>
        <button className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-zinc-300 transition hover:border-emerald-300" type="button" onClick={onNotifications}>
          {unread} unread alerts | {roleLabels[role]}
        </button>
        <button className="rounded-md border border-zinc-800 px-4 py-3 text-sm text-zinc-200 transition hover:border-emerald-300" type="button" onClick={onFavorite}>
          {favorites.includes(activeModule) ? "Unpin" : "Pin"}
        </button>
        <button className="rounded-md border border-emerald-700 px-4 py-3 text-sm text-emerald-100 transition hover:border-emerald-300" type="button" onClick={onSettings}>
          Settings
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
        <span className="rounded-full border border-zinc-800 px-3 py-1">Active: {activeModule}</span>
        <span className="rounded-full border border-zinc-800 px-3 py-1">Pinned: {favorites.slice(0, 3).join(", ") || "None"}</span>
        <span className="rounded-full border border-zinc-800 px-3 py-1">Recent: {recentPages.slice(0, 3).join(", ") || "None"}</span>
      </div>
    </section>
  );
}

function UnifiedOperatingSystemStrip({
  activeModule,
  favorites,
  onOpen,
  onToggleFavorite,
  recentPages,
  role,
}: {
  activeModule: string;
  favorites: string[];
  onOpen: (target: string) => void;
  onToggleFavorite: () => void;
  recentPages: string[];
  role: AuthUser["role"];
}) {
  const quickActions = role === "ADMIN"
    ? ["Executive BI", "Treasury Center", "War Room", "Monitoring", "User Management"]
    : role === "INVESTOR"
      ? ["Investor Dashboard", "Simulator", "Reports", "Capital", "Settings"]
      : role === "ANALYST"
        ? ["Analyst Dashboard", "War Room", "My Analytics", "Prediction Workspace", "Settings"]
        : ["Subscriber Home", "Opportunity Center", "Live Match Center", "Profile", "Settings"];
  return (
    <section className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-emerald-300">FPF Operating System</p>
          <p className="mt-1 text-sm text-zinc-400">Home / {roleLabels[role]} / {activeModule}</p>
        </div>
        <button className="rounded-md border border-emerald-700 px-3 py-2 text-sm text-emerald-100" type="button" onClick={onToggleFavorite}>
          {favorites.includes(activeModule) ? "Remove from pinned" : "Pin current module"}
        </button>
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Quick actions</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {quickActions.map((item) => (
              <button className="rounded-md bg-zinc-900 px-3 py-2 text-xs text-zinc-200 hover:bg-emerald-300 hover:text-zinc-950" key={item} type="button" onClick={() => onOpen(item)}>{item}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Pinned modules</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(favorites.length ? favorites : ["No pinned modules yet"]).map((item) => (
              <button className="rounded-md bg-zinc-900 px-3 py-2 text-xs text-zinc-200" disabled={!favorites.length} key={item} type="button" onClick={() => onOpen(item)}>{item}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Recent pages</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(recentPages.length ? recentPages : ["No recent pages yet"]).map((item) => (
              <button className="rounded-md bg-zinc-900 px-3 py-2 text-xs text-zinc-200" disabled={!recentPages.length} key={item} type="button" onClick={() => onOpen(item)}>{item}</button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function LaunchExperienceCenter({ onDismiss, role }: { onDismiss: () => void; role: AuthUser["role"] }) {
  return (
    <section className="mt-4 rounded-lg border border-emerald-400/20 bg-gradient-to-br from-zinc-900 to-emerald-950/20 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-emerald-300">Welcome Wizard</p>
          <h2 className="mt-2 text-xl font-semibold">Your unified FPF workspace is ready.</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-300">
            First login tour: use global search, review notifications, configure settings, then open your {role.toLowerCase()} command area. Empty states, coming-soon pages, maintenance messaging, success screens, and a custom 404 pattern are prepared in the launch system.
          </p>
        </div>
        <button className="rounded-md bg-emerald-300 px-4 py-2 text-sm font-semibold text-zinc-950" type="button" onClick={onDismiss}>Start</button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {[
          ["Loading", "Skeleton loaders keep navigation calm while data arrives."],
          ["Success", "Actions return clear confirmation messages."],
          ["Empty", "No-data areas explain what will appear next."],
          ["Fallback", "Maintenance, coming soon, and 404 states use the same FPF system language."],
        ].map(([title, body]) => <MiniStat key={title} label={title} value={body} />)}
      </div>
    </section>
  );
}

function SettingsCenterView({
  currencies,
  languages,
  notificationPreferences,
  notifications,
  onSignOut,
  onPasswordChange,
  onPreferences,
  onSaveNotificationPreferences,
  preferences,
  session,
  timezones,
}: {
  currencies: CurrencySetting[];
  languages: LanguageSetting[];
  notificationPreferences: NotificationPreferences | null;
  notifications: OperationalNotification[];
  onSignOut: () => void;
  onPasswordChange: (event: FormEvent<HTMLFormElement>) => void;
  onPreferences: (preferences: Partial<UserGlobalPreferences>) => Promise<void>;
  onSaveNotificationPreferences: (preferences: Partial<NotificationPreferences>) => Promise<void>;
  preferences: UserGlobalPreferences;
  session: AuthResponse;
  timezones: TimezoneSetting[];
}) {
  return (
    <div className="mt-6 space-y-4">
      <Panel title="Professional Settings Center">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MiniStat label="Theme" value="Dark premium" />
          <MiniStat label="Security" value="JWT session active" />
          <MiniStat label="Devices" value="Current device trusted" />
          <MiniStat label="2FA" value="Placeholder ready" />
        </div>
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <GlobalPreferencesForm currencies={currencies} languages={languages} onSave={onPreferences} preferences={preferences} timezones={timezones} title="Language, Currency & Timezone" />
        <Panel title="Security & Sessions">
          <dl className="space-y-3 text-sm">
            <ProfileRow label="Account" value={session.user.email} />
            <ProfileRow label="Role" value={roleLabels[session.user.role]} />
            <ProfileRow label="Session" value="Bearer token secured in browser storage" />
            <ProfileRow label="2FA Placeholder" value="Provider-ready, not connected" />
          </dl>
          <form className="mt-4 space-y-3" onSubmit={onPasswordChange}>
            <TextField label="Current password" name="currentPassword" type="password" />
            <TextField label="New password" name="newPassword" type="password" />
            <SubmitButton>Update security</SubmitButton>
          </form>
          <button
            className="mt-3 w-full rounded-md border border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-emerald-300 hover:text-white"
            type="button"
            onClick={onSignOut}
          >
            Sign out securely
          </button>
        </Panel>
      </div>
      <NotificationCenterView
        legacyNotifications={[]}
        notifications={notifications}
        onSavePreferences={onSaveNotificationPreferences}
        preferences={notificationPreferences}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <LaunchCard title="Maintenance Page" body="Platform-wide maintenance messaging is ready for operations events." />
        <LaunchCard title="Coming Soon Page" body="Future modules can be introduced without leaving blank screens." />
        <LaunchCard title="Custom 404 Page" body="Unknown routes use a clear FPF recovery pattern in the unified app shell." />
      </div>
    </div>
  );
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
          <p className="mt-1 text-sm text-zinc-400">{submission.market} Â· {submission.prediction}</p>
          <p className="mt-1 text-sm text-zinc-500">Confidence {submission.confidence}% Â· Risk {submission.riskLevel}</p>
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
              <span className="text-xs uppercase tracking-[0.12em] text-zinc-500">{fixture.leagueName}{fixture.leagueCountry ? ` Â· ${fixture.leagueCountry}` : ""}</span>
              <span className="mt-1 block font-semibold">{fixture.homeTeamName} vs {fixture.awayTeamName}</span>
              <span className="mt-1 block text-sm text-zinc-400">{fixture.status} Â· {new Date(fixture.kickoffAt).toLocaleDateString()}</span>
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
              <p className="mt-1 text-sm text-zinc-400">{item.market} Â· {item.prediction}</p>
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
  onRefresh,
  onSelectFixture,
  predictions,
  selectedFixture,
}: {
  fixtures: FootballFixtureSummary[];
  onRefresh: () => void;
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
        <CompactFixtureList fixtures={fixtures} onSelect={onSelectFixture} emptyMessage="No live matches are available right now. Live monitoring will populate when synchronized matches are in progress." onRetry={onRefresh} />
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
          <p className="mt-2">Team form: {fixture?.standings.length ? fixture.standings.slice(0, 2).map((standing) => `${standing.teamName} ${standing.points} pts`).join(" Â· ") : "Pending"}</p>
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
  currencies,
  languages,
  onSignOut,
  onPasswordChange,
  onPreferences,
  preferences,
  session,
  timezones,
}: {
  currencies: CurrencySetting[];
  languages: LanguageSetting[];
  onSignOut: () => void;
  onPasswordChange: (event: FormEvent<HTMLFormElement>) => void;
  onPreferences: (preferences: Partial<UserGlobalPreferences>) => Promise<void>;
  preferences: UserGlobalPreferences;
  session: AuthResponse;
  timezones: TimezoneSetting[];
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
        <button
          className="mt-3 w-full rounded-md border border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-emerald-300 hover:text-white"
          type="button"
          onClick={onSignOut}
        >
          Sign out securely
        </button>
      </Panel>
      <div className="lg:col-span-2">
        <GlobalPreferencesForm
          currencies={currencies}
          languages={languages}
          onSave={onPreferences}
          preferences={preferences}
          timezones={timezones}
          title="Global Preferences"
        />
      </div>
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
          <p className="mt-1 text-sm text-zinc-400">Confidence {prediction.confidenceScore}% Â· Risk {prediction.riskScore}</p>
        </div>
      ))}
      {!predictions.length ? <EmptyState message="Approved predictions will appear here after review." /> : null}
    </div>
  );
}

function CompactFixtureList({
  emptyMessage = "Football data is syncing. If this stays empty, run a fixture refresh from Admin Fixture Management.",
  fixtures,
  onSelect,
  onRetry,
}: {
  emptyMessage?: string;
  fixtures: FootballFixtureSummary[];
  onSelect?: (id: string) => void;
  onRetry?: () => void;
}) {
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
          <p className="mt-1 text-sm text-zinc-400">{fixture.leagueName} Â· {fixture.status} Â· {new Date(fixture.kickoffAt).toLocaleString()}</p>
        </button>
      ))}
      {!fixtures.length ? <EmptyState message={emptyMessage} actionLabel={onRetry ? "Retry" : undefined} onAction={onRetry} /> : null}
    </div>
  );
}

function CompactAuditList({ emptyLabel, logs }: { emptyLabel: string; logs: AuditLogEntry[] }) {
  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3" key={log.id}>
          <p className="font-semibold">{log.action}</p>
          <p className="mt-1 text-sm text-zinc-400">{log.entityType} Â· {log.entityId ?? "System"} Â· {new Date(log.createdAt).toLocaleString()}</p>
        </div>
      ))}
      {!logs.length ? <p className="text-sm text-zinc-400">{emptyLabel}</p> : null}
    </div>
  );
}

function placeholderMaturityDate(createdAt: string) {
  const date = new Date(createdAt);
  date.setMonth(date.getMonth() + 6);
  return date;
}

function InvestmentList({ investments }: { investments: InvestorInvestment[] }) {
  return (
    <div className="space-y-2">
      {investments.map((investment) => (
        <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3" key={investment.id}>
          <p className="font-semibold">{investment.planName}</p>
          <p className="mt-1 text-sm text-zinc-400">
            {money(investment.amountCents)} invested Â· {money(investment.currentValueCents)} current
          </p>
          <p className="text-sm text-zinc-500">
            Weekly ROI {investment.weeklyRoiPercent.toFixed(2)}% Â· Lifetime ROI {investment.lifetimeRoiPercent.toFixed(2)}%
          </p>
          <div className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2 lg:grid-cols-4">
            <p>Lock period: 6 Months placeholder</p>
            <p>Investment date: {new Date(investment.createdAt).toLocaleDateString()}</p>
            <p>Maturity date: {placeholderMaturityDate(investment.createdAt).toLocaleDateString()}</p>
            <p>
              Status: {investment.status} - Projected performance {
                (investment.amountCents > 0
                  ? ((investment.currentValueCents - investment.amountCents) / investment.amountCents) * 100
                  : 0).toFixed(2)
              }% simulation only
            </p>
          </div>
        </div>
      ))}
      {!investments.length ? <p className="text-sm text-zinc-400">No investments in this category.</p> : null}
    </div>
  );
}

function GlobalPreferenceBar({
  currencies,
  languages,
  onSave,
  preferences,
  timezones,
}: {
  currencies: CurrencySetting[];
  languages: LanguageSetting[];
  onSave: (preferences: Partial<UserGlobalPreferences>) => void;
  preferences: UserGlobalPreferences;
  timezones: TimezoneSetting[];
}) {
  return (
    <div className="grid gap-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-300 sm:grid-cols-3">
      <select className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2" value={preferences.language} onChange={(event) => onSave({ language: event.target.value as UserGlobalPreferences["language"] })}>
        {(languages.length ? languages : [{ code: "en", name: "English", nativeName: "English", direction: "ltr", enabled: true } as LanguageSetting]).filter((item) => item.enabled).map((language) => (
          <option key={language.code} value={language.code}>{language.nativeName}</option>
        ))}
      </select>
      <select className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2" value={preferences.currency} onChange={(event) => onSave({ currency: event.target.value as UserGlobalPreferences["currency"] })}>
        {(currencies.length ? currencies : [{ code: "USD", name: "US Dollar", symbol: "$", placeholderRateFromUsd: 1, enabled: true } as CurrencySetting]).filter((item) => item.enabled).map((currency) => (
          <option key={currency.code} value={currency.code}>{currency.code}</option>
        ))}
      </select>
      <select className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2" value={preferences.timezone} onChange={(event) => onSave({ timezone: event.target.value })}>
        {(timezones.length ? timezones : [{ id: "UTC", label: "UTC", offset: "+00:00", enabled: true } as TimezoneSetting]).filter((item) => item.enabled).map((timezone) => (
          <option key={timezone.id} value={timezone.id}>{timezone.label}</option>
        ))}
      </select>
    </div>
  );
}

function GlobalPreferencesForm({
  currencies,
  languages,
  onSave,
  preferences,
  timezones,
  title,
}: {
  currencies: CurrencySetting[];
  languages: LanguageSetting[];
  onSave: (preferences: Partial<UserGlobalPreferences>) => Promise<void>;
  preferences: UserGlobalPreferences;
  timezones: TimezoneSetting[];
  title: string;
}) {
  return (
    <Panel title={title}>
      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void onSave({
            language: String(form.get("language")) as UserGlobalPreferences["language"],
            currency: String(form.get("currency")) as UserGlobalPreferences["currency"],
            timezone: String(form.get("timezone")),
            country: String(form.get("country")),
            region: String(form.get("region")),
            measurementSystem: String(form.get("measurementSystem")) as UserGlobalPreferences["measurementSystem"],
            dateFormat: String(form.get("dateFormat")),
            numberFormat: String(form.get("numberFormat")),
          });
        }}
      >
        <SelectField label="Language" name="language" value={preferences.language} options={(languages.length ? languages : []).filter((item) => item.enabled).map((item) => ({ value: item.code, label: item.nativeName }))} />
        <SelectField label="Currency" name="currency" value={preferences.currency} options={(currencies.length ? currencies : []).filter((item) => item.enabled).map((item) => ({ value: item.code, label: `${item.code} - ${item.name}` }))} />
        <SelectField label="Timezone" name="timezone" value={preferences.timezone} options={(timezones.length ? timezones : []).filter((item) => item.enabled).map((item) => ({ value: item.id, label: `${item.label} (${item.offset})` }))} />
        <SelectField label="Measurement" name="measurementSystem" value={preferences.measurementSystem} options={[{ value: "metric", label: "Metric" }, { value: "imperial", label: "Imperial" }]} />
        <TextField label="Country code" name="country" type="text" value={preferences.country} />
        <TextField label="Region" name="region" type="text" value={preferences.region} />
        <TextField label="Date format" name="dateFormat" type="text" value={preferences.dateFormat} />
        <TextField label="Number format" name="numberFormat" type="text" value={preferences.numberFormat} />
        <div className="md:col-span-2">
          <p className="mb-3 rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">
            All platform accounting remains in USD internally. Display values use placeholder conversion rates until an approved live exchange-rate provider is connected.
          </p>
          <SubmitButton>Save global preferences</SubmitButton>
        </div>
      </form>
    </Panel>
  );
}

function PricingCards({ plans }: { plans: CommercialStructure["subscriberPlans"] }) {
  if (!plans.length) return null;
  return (
    <div className="mt-8 grid gap-4 md:grid-cols-3" id="pricing">
      {plans.map((plan) => (
        <div className={`rounded-lg border p-4 ${plan.highlighted ? "border-emerald-300 bg-emerald-950/20" : "border-zinc-800 bg-zinc-900/70"}`} key={plan.code}>
          <p className="text-xs uppercase tracking-[0.14em] text-emerald-300">{plan.code}</p>
          <h3 className="mt-2 text-xl font-semibold">{plan.name}</h3>
          <p className="mt-2 text-2xl font-bold">{money(plan.monthlyPriceCents)}<span className="text-sm font-normal text-zinc-400">/month</span></p>
          <p className="text-sm text-zinc-400">Yearly billing placeholder: {money(plan.yearlyPriceCents)}/year</p>
          <ul className="mt-4 space-y-2 text-sm text-zinc-300">
            {plan.features.map((feature) => <li key={feature}>- {feature}</li>)}
          </ul>
          <p className="mt-4 rounded-md bg-amber-500/10 p-2 text-xs text-amber-100">Payment APIs are not connected yet.</p>
        </div>
      ))}
    </div>
  );
}

function investorLevelName(commercialStructure: CommercialStructure, capitalCents: number) {
  const level = [...commercialStructure.investorLevels]
    .sort((a, b) => b.minimumInvestmentCents - a.minimumInvestmentCents)
    .find((item) => capitalCents >= item.minimumInvestmentCents);
  return level?.name ?? "Pending";
}

function AdminCommercialControls({
  commercialStructure,
  onAction,
  settings,
}: {
  commercialStructure: CommercialStructure;
  onAction: (path: string, body?: object) => Promise<void>;
  settings: AdminSettings | null;
}) {
  return (
    <Panel title="Commercial Structure">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-zinc-200">Subscriber plans</p>
          <div className="mt-3 space-y-2">
            {commercialStructure.subscriberPlans.map((plan) => (
              <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3 text-sm" key={plan.code}>
                <p className="font-semibold">{plan.name} - {money(plan.monthlyPriceCents)}/month</p>
                <p className="text-zinc-400">{plan.features.join(", ")}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-200">Investor levels</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {commercialStructure.investorLevels.map((level) => (
              <MiniStat key={level.name} label={level.name} value={`${money(level.minimumInvestmentCents)}+`} />
            ))}
          </div>
        </div>
      </div>
      <form
        className="mt-4 grid gap-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void onAction("/admin/commercial/settings", {
            minimumInvestmentCents: Math.round(Number(form.get("minimumInvestment")) * 100),
            enabledLockPeriods: form.getAll("enabledLockPeriods"),
            defaultSimulationWeeklyReturnPercent: Number(form.get("defaultSimulationWeeklyReturnPercent")),
            defaultPlatformFeePercent: Number(form.get("defaultPlatformFeePercent")),
          });
        }}
      >
        <TextField label="Minimum investment" name="minimumInvestment" type="number" value={String((settings?.minimumInvestmentCents ?? commercialStructure.minimumInvestmentCents) / 100)} />
        <TextField label="Placeholder weekly return %" name="defaultSimulationWeeklyReturnPercent" type="number" value={String(settings?.defaultSimulationWeeklyReturnPercent ?? commercialStructure.simulatorDefaults.weeklyReturnPercent)} />
        <TextField label="Platform fee placeholder %" name="defaultPlatformFeePercent" type="number" value={String(settings?.defaultPlatformFeePercent ?? commercialStructure.simulatorDefaults.platformFeePercent)} />
        <div>
          <p className="text-sm font-medium text-zinc-200">Lock periods</p>
          <div className="mt-2 space-y-2">
            {commercialStructure.lockPeriods.map((period) => (
              <label className="flex items-center gap-2 text-sm text-zinc-300" key={period.code}>
                <input defaultChecked={(settings?.enabledLockPeriods ?? commercialStructure.lockPeriods.filter((item) => item.enabled).map((item) => item.code)).includes(period.code)} name="enabledLockPeriods" type="checkbox" value={period.code} />
                {period.label}
              </label>
            ))}
          </div>
        </div>
        <div className="md:col-span-2">
          <p className="mb-3 rounded-md bg-amber-500/10 p-3 text-sm text-amber-100">Placeholder commercial settings only. No real payments or payouts are processed.</p>
          <SubmitButton>Save commercial settings</SubmitButton>
        </div>
      </form>
    </Panel>
  );
}

function AdminGlobalizationControls({
  currencies,
  languages,
  onAction,
  settings,
}: {
  currencies: CurrencySetting[];
  languages: LanguageSetting[];
  onAction: (path: string, body?: object) => Promise<void>;
  settings: AdminSettings | null;
}) {
  const enabledLanguages = new Set(settings?.enabledLanguages ?? languages.filter((item) => item.enabled).map((item) => item.code));
  const enabledCurrencies = new Set(settings?.enabledCurrencies ?? currencies.filter((item) => item.enabled).map((item) => item.code));
  return (
    <Panel title="Admin Globalization Controls">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void onAction("/admin/globalization", {
            enabledLanguages: form.getAll("enabledLanguages"),
            enabledCurrencies: form.getAll("enabledCurrencies"),
            defaultLanguage: form.get("defaultLanguage"),
            defaultCurrency: form.get("defaultCurrency"),
          });
        }}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-zinc-200">Enabled languages</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {languages.map((language) => (
                <label className="flex items-center gap-2 text-sm text-zinc-300" key={language.code}>
                  <input defaultChecked={enabledLanguages.has(language.code)} name="enabledLanguages" type="checkbox" value={language.code} />
                  {language.nativeName}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-200">Enabled currencies</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {currencies.map((currency) => (
                <label className="flex items-center gap-2 text-sm text-zinc-300" key={currency.code}>
                  <input defaultChecked={enabledCurrencies.has(currency.code)} name="enabledCurrencies" type="checkbox" value={currency.code} />
                  {currency.code}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField label="Default language" name="defaultLanguage" value={settings?.defaultLanguage ?? "en"} options={languages.map((item) => ({ value: item.code, label: item.nativeName }))} />
          <SelectField label="Default currency" name="defaultCurrency" value={settings?.defaultCurrency ?? "USD"} options={currencies.map((item) => ({ value: item.code, label: `${item.code} - ${item.name}` }))} />
        </div>
        <SubmitButton>Save globalization controls</SubmitButton>
      </form>
    </Panel>
  );
}

function InvestorSimulatorCalculator({
  defaultAmountCents,
  defaultPlatformFeePercent,
  defaultWeeklyReturnPercent,
  description,
  lockPeriods,
  onSimulate,
  title,
}: {
  defaultAmountCents: number;
  defaultPlatformFeePercent: number;
  defaultWeeklyReturnPercent: number;
  description: string;
  lockPeriods: CommercialStructure["lockPeriods"];
  onSimulate: (body: InvestorSimulatorInput) => Promise<{ simulation: InvestorSimulatorResult }>;
  title: string;
}) {
  const [result, setResult] = useState<InvestorSimulatorResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <Panel title={title}>
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            const form = new FormData(event.currentTarget);
            const payload: InvestorSimulatorInput = {
              investmentAmountCents: Math.round(Number(form.get("investmentAmount")) * 100),
              expectedWeeklyReturnPercent: Number(form.get("expectedWeeklyReturnPercent")),
              numberOfWeeks: Number(form.get("numberOfWeeks")),
              reinvest: form.get("reinvest") === "on",
              withdrawalFrequency: String(form.get("withdrawalFrequency")) as InvestorSimulatorInput["withdrawalFrequency"],
              platformFeePercent: Number(form.get("platformFeePercent")),
            };
            void onSimulate(payload)
              .then((data) => setResult(data.simulation))
              .catch((caughtError) => setError(caughtError instanceof Error ? caughtError.message : "Unable to run simulation"))
              .finally(() => setBusy(false));
          }}
        >
          <p className="text-sm text-zinc-400">{description}</p>
          <p className="rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">
            This is a simulation only. Returns are not guaranteed. Actual results depend on real platform performance.
          </p>
          <label className="block text-sm font-medium text-zinc-200">
            Investment amount
            <input className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none focus:border-emerald-300" defaultValue={(defaultAmountCents / 100).toFixed(2)} min="0" name="investmentAmount" step="100" type="number" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-zinc-200">
              Lock period
              <select className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none focus:border-emerald-300" defaultValue={lockPeriods[0]?.code ?? "SIX_MONTHS"} name="lockPeriod">
                {(lockPeriods.length ? lockPeriods : [{ code: "SIX_MONTHS", label: "6 Months", months: 6, enabled: true }]).filter((period) => period.enabled).map((period) => (
                  <option key={period.code} value={period.code}>{period.label}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-zinc-200">
              Expected weekly return %
              <input className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none focus:border-emerald-300" defaultValue={String(defaultWeeklyReturnPercent)} min="0" max="25" name="expectedWeeklyReturnPercent" step="0.01" type="number" />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-zinc-200">
              Number of weeks
              <input className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none focus:border-emerald-300" defaultValue="12" min="1" max="260" name="numberOfWeeks" type="number" />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-zinc-200">
              Withdrawal frequency
              <select className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none focus:border-emerald-300" defaultValue="MONTHLY" name="withdrawalFrequency">
                <option value="NONE">No withdrawals</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="END_OF_TERM">End of term</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-zinc-200">
              Platform fee %
              <input className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none focus:border-emerald-300" defaultValue={String(defaultPlatformFeePercent)} min="0" max="50" name="platformFeePercent" step="0.01" type="number" />
            </label>
          </div>
          <label className="flex items-center gap-3 text-sm text-zinc-300">
            <input defaultChecked name="reinvest" type="checkbox" />
            Reinvest undistributed earnings
          </label>
          {error ? <p className="rounded-md bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
          <button className="w-full rounded-md bg-emerald-300 px-4 py-3 font-semibold text-zinc-950 transition hover:bg-emerald-200" disabled={busy} type="submit">
            {busy ? "Running simulation..." : "Run simulation"}
          </button>
        </form>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiniStat label="Net projected earnings" value={money(result?.netProjectedEarningsCents ?? 0)} />
            <MiniStat label="Projected balance" value={money(result?.totalProjectedBalanceCents ?? defaultAmountCents)} />
            <MiniStat label="Total distributions" value={money(result?.totalDistributionsCents ?? 0)} />
            <MiniStat label="Platform fees" value={money(result?.platformFeesCents ?? 0)} />
          </div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300">
            <p>{result?.simulationNotice ?? "Run a simulation to view placeholder projection results."}</p>
            <p className="mt-2 text-amber-100">{result?.riskWarning ?? "Returns are not guaranteed."}</p>
            <p className="mt-2 text-zinc-500">{result?.payoutNotice ?? "Final payout logic will be connected later through approved payment APIs."}</p>
          </div>
          <div className="max-h-72 overflow-auto rounded-md border border-zinc-800">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-zinc-950 text-xs uppercase tracking-[0.12em] text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Week</th>
                  <th className="px-3 py-2">Start</th>
                  <th className="px-3 py-2">Net earnings</th>
                  <th className="px-3 py-2">Distribution</th>
                  <th className="px-3 py-2">End balance</th>
                </tr>
              </thead>
              <tbody>
                {(result?.weeks ?? []).slice(0, 52).map((week) => (
                  <tr className="border-t border-zinc-800" key={week.week}>
                    <td className="px-3 py-2">{week.week}</td>
                    <td className="px-3 py-2">{money(week.startingBalanceCents)}</td>
                    <td className="px-3 py-2">{money(week.netEarningsCents)}</td>
                    <td className="px-3 py-2">{money(week.distributionCents)}</td>
                    <td className="px-3 py-2">{money(week.endingBalanceCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!result ? <p className="p-3 text-sm text-zinc-400">Simulation results will appear here.</p> : null}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function DistributionList({ distributions }: { distributions: InvestorDistribution[] }) {
  return (
    <div className="space-y-2">
      {distributions.map((distribution) => (
        <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3" key={distribution.id}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">{money(distribution.netDistributionCents)} - {distribution.status}</p>
              <p className="mt-1 text-sm text-zinc-400">
                {new Date(distribution.periodStart).toLocaleDateString()} to {new Date(distribution.periodEnd).toLocaleDateString()}
              </p>
            </div>
            <div className="text-sm text-zinc-400">
              <p>Capital {money(distribution.capitalBaseCents)}</p>
              <p>Return {distribution.returnRatePercent.toFixed(2)}%</p>
            </div>
          </div>
        </div>
      ))}
      {!distributions.length ? <p className="text-sm text-zinc-400">No distributions yet.</p> : null}
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

function EmptyState({ actionLabel, message, onAction }: { actionLabel?: string; message: string; onAction?: () => void }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
      <p>{message}</p>
      {actionLabel && onAction ? (
        <button
          className="mt-3 rounded-md border border-emerald-400/40 px-3 py-2 text-xs font-semibold text-emerald-200 hover:border-emerald-300 hover:text-emerald-100"
          type="button"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function money(cents: number) {
  const preferences = getStoredPreferences();
  const rates: Record<string, number> = {
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    UGX: 3700,
    KES: 130,
    TZS: 2600,
    NGN: 1500,
    ZAR: 18.2,
    CAD: 1.36,
    AUD: 1.52,
  };
  const currency = preferences.currency in rates ? preferences.currency : "USD";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: ["UGX", "KES", "TZS", "NGN"].includes(currency) ? 0 : 2,
  }).format((cents / 100) * rates[currency]);
}

function formatDateTime(value: string | Date) {
  const preferences = getStoredPreferences();
  return new Intl.DateTimeFormat(preferences.numberFormat || "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: preferences.timezone || "UTC",
  }).format(new Date(value));
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

function SelectField({
  label,
  name,
  options,
  value,
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  value: string;
}) {
  return (
    <label className="block text-sm font-medium text-zinc-200">
      {label}
      <select className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none transition focus:border-emerald-300" defaultValue={value} name={name}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
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

