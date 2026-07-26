import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { CommercialStructure, PublicExperience, ThemePreference } from "./types";
import { historicalOperatingBaseline } from "./historicalOperatingBaseline";
import { PremiumAreaChart, PremiumCommandGrid } from "./components/PremiumPrimitives";

type PublicPageDefinition = {
  label: string;
  path: string;
  id: string;
  description: string;
};

type Props = {
  authPanel: ReactNode;
  commercialStructure: CommercialStructure;
  currentPath: string;
  experience: PublicExperience | null;
  onNavigate: (path: string, id?: string) => void;
  onThemeChange: (theme: ThemePreference) => void;
  publicPageDefinitions: PublicPageDefinition[];
  theme: ThemePreference;
};

const heroSlides = [
  {
    title: "Matchday Intelligence",
    image: "/hero/stadium.jpg",
    caption: "Global Matchday Intelligence",
  },
  {
    title: "AI-Verified Football Intelligence",
    image: "/hero/ai-pitch.jpg",
    caption: "AI-Verified Intelligence",
  },
  {
    title: "FPF Verified Performance",
    image: "/hero/striker.jpg",
    caption: "FPF Verified Intelligence",
  },
  {
    title: "Performance Discipline",
    image: "/hero/trophy.jpg",
    caption: "Performance Discipline",
  },
];

const publicCommercialFallback: CommercialStructure = {
  subscriberPlans: [
    {
      code: "STARTER",
      features: ["Basic match intelligence", "Limited daily opportunities", "Standard support"],
      highlighted: false,
      monthlyPriceCents: 1900,
      name: "Starter",
      yearlyPriceCents: 19000,
    },
    {
      code: "PRO",
      features: ["Full match intelligence", "Confidence and risk context", "Opportunity Centre", "Priority support"],
      highlighted: true,
      monthlyPriceCents: 4900,
      name: "Pro",
      yearlyPriceCents: 49000,
    },
    {
      code: "ELITE",
      features: ["Premium intelligence reports", "Advanced analytics", "Early feature access", "VIP support"],
      highlighted: false,
      monthlyPriceCents: 9900,
      name: "Elite",
      yearlyPriceCents: 99000,
    },
  ],
  investorLevels: [],
  investorPackages: [],
  participationPlans: [],
  lockPeriods: [],
  minimumInvestmentCents: 10000,
  notices: {
    contractualPayout: "Performance Partner participation is governed by approved agreements.",
    investmentRisk: "Capital is at risk. Returns are not guaranteed.",
    paymentPlaceholder: "Secure checkout is being activated.",
    performancePartnerCompatibility: "Performance Partner is the public participation model.",
    simulationOnly: "Simulation only.",
  },
  pricingRules: [],
  simulatorDefaults: { platformFeePercent: 10, weeklyReturnPercent: 1.25 },
};

const mobileNavItems = [
  ["Home", "/", "home"],
  ["Intelligence", "/how-fpf-works", "how-fpf-works"],
  ["Live In-Play", "/live-in-play", "war-room-preview"],
  ["Performance", "/performance", "performance"],
  ["Pricing", "/pricing", "subscribers"],
  ["About", "/about", "what-fpf-is"],
  ["Community", "/community", "community-preview"],
  ["Sign In", "/login", "auth"],
  ["Start 3-Day Preview", "/register", "auth"],
] as const;

function isAuthPath(path: string) {
  return ["/login", "/signin", "/sign-in", "/register", "/get-started", "/subscribe", "/become-an-investor", "/forgot-password", "/reset-password"].includes(path);
}

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatPublicDate(value: string | null | undefined) {
  if (!value) return "Awaiting first verified update";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

function formatPublicDateTime(value: string | null | undefined) {
  if (!value) return "Synchronisation pending";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function ThemeSwitcher({ onChange, theme }: { onChange: (theme: ThemePreference) => void; theme: ThemePreference }) {
  const [open, setOpen] = useState(false);
  const activeLabel = theme === "system" ? "System" : theme === "dark" ? "Dark" : "Light";

  function selectTheme(nextTheme: ThemePreference) {
    onChange(nextTheme);
    setOpen(false);
  }

  return (
    <div className="theme-switcher" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Theme preference: ${activeLabel}`}
        className="theme-toggle-button"
        title={`Theme: ${activeLabel}`}
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true">☾</span>
      </button>
      {open ? (
        <div className="theme-menu" role="menu" aria-label="Theme preference">
          {(["dark", "light", "system"] as ThemePreference[]).map((option) => (
            <button
              aria-pressed={theme === option}
              className={theme === option ? "active" : ""}
              key={option}
              role="menuitemradio"
              type="button"
              onClick={() => selectTheme(option)}
            >
              {option === "system" ? "System" : option === "dark" ? "Dark" : "Light"}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Mission21PublicExperience({
  authPanel,
  commercialStructure,
  currentPath,
  experience,
  onNavigate,
  onThemeChange,
  theme,
}: Props) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const authPage = isAuthPath(currentPath);
  const publicCommercial = commercialStructure ?? publicCommercialFallback;
  const experiencePlans = experience?.commercial?.subscriberPlans ?? [];
  const structurePlans = publicCommercial.subscriberPlans ?? [];
  const plans = experiencePlans.length ? experiencePlans : structurePlans.length ? structurePlans : publicCommercialFallback.subscriberPlans;

  useEffect(() => {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reducedMotion || authPage) return;
    const timer = window.setInterval(() => setActiveSlide((value) => (value + 1) % heroSlides.length), 7000);
    return () => window.clearInterval(timer);
  }, [authPage]);

  function navigate(path: string, id?: string) {
    setMobileMenuOpen(false);
    onNavigate(path, id);
  }

  return (
    <main className="fpf-public">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="public-nav">
        <button className="brand-block brand-button" type="button" onClick={() => navigate("/", "home")} aria-label="Football Performance Fund home">
          <img className="brand-logo official-logo-image" src="/fpf-official-logo.jpeg" alt="Football Performance Fund official logo" width="64" height="64" />
          <span className="brand-copy">
            <span>Football Performance Fund</span>
            <strong>FPF Global Intelligence</strong>
          </span>
        </button>
        <nav className="public-nav-links" aria-label="Public website navigation">
          {mobileNavItems.slice(0, 4).map(([label, path, id]) => (
            <button key={path} type="button" onClick={() => navigate(path, id)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="public-nav-actions">
          <ThemeSwitcher theme={theme} onChange={onThemeChange} />
          <button className="ghost-action desktop-auth-action" type="button" onClick={() => navigate("/login", "auth")}>Sign In</button>
          <button className="preview-nav-action" type="button" onClick={() => navigate("/register", "auth")}>Start 3-Day Preview</button>
          <button
            aria-controls="mobile-public-menu"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Close public navigation menu" : "Open public navigation menu"}
            className="mobile-menu-button"
            type="button"
            onClick={() => setMobileMenuOpen((current) => !current)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
        {mobileMenuOpen ? (
          <nav className="mobile-public-menu" id="mobile-public-menu" aria-label="Mobile public navigation">
            {mobileNavItems.map(([label, path, id]) => (
              <button key={path} type="button" onClick={() => navigate(path, id)}>
                {label}
              </button>
            ))}
          </nav>
        ) : null}
      </header>

      {authPage ? (
        <PublicAuthPage authPanel={authPanel} />
      ) : (
        <>
          <Hero activeSlide={activeSlide} onNavigate={navigate} />
          <HistoricalBaselineSection experience={experience} />
          <PublicSignalBar experience={experience} />
          <LiveDigitalPlatformSection experience={experience} onNavigate={navigate} />
          <GlobalCommandCenterSection />
          <HowItWorks />
          <LiveIntelligenceCenterSection experience={experience} />
          <SubscriberMembership plans={plans} onNavigate={navigate} />
          <PerformancePartnerProgramme commercialStructure={{ ...publicCommercialFallback, ...publicCommercial }} experience={experience} onNavigate={navigate} />
          <PerformancePreview experience={experience} />
          <TrustSection />
          <FAQSection />
          <ContactSection onNavigate={navigate} />
          <PublicFooter onNavigate={navigate} />
        </>
      )}
    </main>
  );
}

function Hero({ activeSlide, onNavigate }: { activeSlide: number; onNavigate: (path: string, id?: string) => void }) {
  return (
    <section className="public-hero" aria-labelledby="public-hero-title" id="home">
      <div className="hero-media" aria-hidden="true">
        {heroSlides.map((slide, index) => (
          <img
            alt=""
            className={index === activeSlide ? "active" : ""}
            decoding="async"
            key={slide.image}
            loading={index === 0 ? "eager" : "lazy"}
            src={slide.image}
          />
        ))}
      </div>
      <div className="hero-overlay" />
      <div className="hero-grid public-hero-grid" id="main-content">
        <div className="hero-copy">
          <p className="eyebrow hero-kicker">AI-Powered Football Intelligence</p>
          <h1 id="public-hero-title">We Don't Chase Luck.<br />We Build Performance.</h1>
          <p className="hero-support">
            AI-powered predictions, live in-play intelligence and proprietary FPF intelligence in one disciplined football operating system.
          </p>
          <div className="hero-actions">
            <button type="button" onClick={() => onNavigate("/register", "auth")}>Start 3-Day Preview</button>
            <button type="button" onClick={() => onNavigate("/how-fpf-works", "how-fpf-works")}>Explore Intelligence</button>
            <button className="secondary" type="button" onClick={() => onNavigate("/pricing", "pricing")}>View Membership Plans</button>
            <button className="text-link-action" type="button" onClick={() => onNavigate("/investors", "performance-partners")}>Explore Performance Partnership</button>
          </div>
          <div className="hero-controls" aria-label="Hero slide indicators">
            <span className="active">AI Verified<small>Every insight scored</small></span>
            <span>Performance Focused<small>Data over emotion</small></span>
            <span>Secure & Transparent<small>Role-protected access</small></span>
          </div>
        </div>
        <HeroOpportunityPanel onNavigate={onNavigate} />
      </div>
    </section>
  );
}

function HeroOpportunityPanel({ onNavigate }: { onNavigate: (path: string, id?: string) => void }) {
  const rows = [
    ["Member intelligence", "Protected", "After login", "Review"],
    ["Live opportunities", "Pending", "Provider data", "Queued"],
    ["Verified reports", "Available", "Eligible users", "Secure"],
  ];
  return (
    <aside className="hero-intelligence-card hero-opportunity-panel" aria-label="FPF intelligence preview">
      <div className="panel-title-row">
        <strong>Today's Top Opportunities</strong>
        <button type="button" onClick={() => onNavigate("/login", "auth")}>View All</button>
      </div>
      <div className="opportunity-preview-list">
        {rows.map(([match, status, kickoff, grade]) => (
          <article key={match}>
            <div className="club-mark" aria-hidden="true"><span /></div>
            <div>
              <strong>{match}</strong>
              <span>{kickoff}</span>
            </div>
            <b>{status}</b>
            <em>{grade}</em>
          </article>
        ))}
      </div>
      <button className="panel-action" type="button" onClick={() => onNavigate("/register", "auth")}>See All Intelligence</button>
      <div className="war-room-mini" id="war-room-preview">
        <div className="war-room-screen" aria-hidden="true"><i /><i /><i /><i /></div>
        <div>
          <span>FPF Intelligence Briefing</span>
          <strong>AI-verified football intelligence with FPF quality controls.</strong>
          <button type="button" onClick={() => onNavigate("/login", "auth")}>View Intelligence Briefing</button>
        </div>
      </div>
    </aside>
  );
}

function PublicSignalBar({ experience }: { experience: PublicExperience | null }) {
  const loading = !experience;
  const monitoredCompetitions = new Set((experience?.intelligencePreview?.fixtures ?? []).map((fixture) => fixture.league).filter(Boolean)).size;
  const signals = [
    { label: "AI Intelligence Engine", value: loading ? "Checking" : "Online" },
    { label: "Live Match Scanner", value: loading ? "Checking" : experience.activity.fixturesMonitored > 0 ? "Active" : "Awaiting data" },
    { label: "Competitions Monitored", value: loading ? "Loading" : experience.activity.leaguesCovered ? `${experience.activity.leaguesCovered} live` : monitoredCompetitions ? `${monitoredCompetitions} ready` : "Pending data" },
    { label: "Data Synchronisation", value: loading ? "Checking" : experience.activity.lastSuccessfulDataRefresh ? "Running" : "Pending provider cycle" },
    { label: "Intelligence Quality Layer", value: "Active" },
    { label: "Opportunity Engine", value: "Processing" },
    { label: "Platform Status", value: loading ? "Checking" : experience.activity.platformStatus === "OPERATIONAL" ? "Operational" : "Degraded" },
    { label: "Intelligence Cycle", value: "Live" },
    { label: "Subscriber Portal", value: "Online" },
    { label: "Performance Partner Portal", value: "Online" },
  ];
  return (
    <section className="activity-bar public-signal-bar" aria-label="Live digital platform metrics">
      <div className="metric-layer-heading">
        <span>Layer B</span>
        <strong>Live Digital Platform</strong>
      </div>
      <div className="activity-track">
        {signals.map((signal) => (
          <article className="live-operational-card" key={signal.label}>
            <i aria-hidden="true" />
            <span>{signal.label}</span>
            <strong>{signal.value}</strong>
          </article>
        ))}
      </div>
      <p className="public-data-freshness">Last public data refresh: {formatPublicDateTime(experience?.generatedAt)}</p>
    </section>
  );
}

function HistoricalBaselineSection({ experience }: { experience: PublicExperience | null }) {
  const baseline = historicalOperatingBaseline;
  const archive = experience?.historicalArchive?.operatingHistory ?? [];
  const disclosure = experience?.historicalArchive?.disclosure ??
    "Historical figures relate to FPF operations before automated digital tracking. Digital platform performance is recorded separately from the first settled production cycle.";
  const archiveValue = (metricKey: string, fallback: string) =>
    archive.find((record) => record.metricKey === metricKey)?.displayValue ?? fallback;
  const liveCycle = experience?.activity?.platformStatus === "OPERATIONAL" ? "Monitoring" : "Preparing";
  const liveReports = experience?.activity?.reportsPending ? String(experience.activity.reportsPending) : "Available after verification";

  return (
    <section className="historical-baseline-section" aria-labelledby="historical-baseline-title">
      <div className="metric-layer-heading">
        <span>Layer A</span>
        <strong>Historical FPF Operating Record</strong>
      </div>
      <div className="historical-baseline-grid">
        <article className="baseline-copy-card">
          <p className="eyebrow">FPF Operations Since {archiveValue("operations_established", String(baseline.operationsStartedYear))}</p>
          <h2 id="historical-baseline-title">Established intelligence methodology, now digitally verified.</h2>
          <p>FPF presents two reporting layers: a historical operating archive and a separate verified digital reporting cycle.</p>
          <p className="baseline-transparency-note">
            {disclosure}
          </p>
        </article>
        <div className="baseline-metric-grid">
          <article><span>{archiveValue("operations_established", String(baseline.operationsStartedYear))}</span><strong>FPF football intelligence operations established</strong></article>
          <article><span>{archiveValue("historical_community_reach", baseline.historicalSubscribersDisplay)}</span><strong>Historical community reach</strong></article>
          <article className="baseline-win-rate">
            <span>{archiveValue("historical_operating_win_rate", `${baseline.historicalOperatingWinRate}%`)}</span>
            <strong>Historical operating win rate</strong>
            <em>Historical archive only. Digital platform performance is recorded separately from the first settled production cycle.</em>
          </article>
          <article><span>{archiveValue("digital_platform_introduced", String(baseline.digitalPlatformLaunchYear))}</span><strong>Digital performance verification introduced</strong></article>
        </div>
      </div>
      <div className="growth-pulse-grid">
        <article className="growth-journey-card">
          <div className="panel-title-row">
            <strong>FPF Growth Journey</strong>
            <span>Milestone-based</span>
          </div>
          <div className="growth-timeline" aria-label="FPF milestone growth journey">
            <div className="growth-node">
              <span>{baseline.operationsStartedYear}</span>
              <strong>FPF operating history begins</strong>
              <small>Historical operating archive starts</small>
            </div>
            <div className="growth-line" aria-hidden="true"><i /></div>
            <div className="growth-node">
              <span>{baseline.historicalSubscribersDisplay}</span>
              <strong>Historical community reach</strong>
              <small>Pre-platform performance archive</small>
            </div>
            <div className="growth-line verified" aria-hidden="true"><i /></div>
            <div className="growth-node live">
              <span>{baseline.digitalPlatformLaunchYear}</span>
              <strong>Digital performance verification introduced</strong>
              <small>Live metrics extend from production system data</small>
            </div>
          </div>
        </article>
        <article className="platform-pulse-card">
          <div className="panel-title-row">
            <strong>Platform Pulse</strong>
            <span className="pulse-dot">Live layer</span>
          </div>
          <div className="pulse-grid">
            <span><b>{baseline.historicalSubscribersDisplay}</b>Historical community</span>
            <span><b>{baseline.operationsStartedYear}</b>Manual operations since</span>
            <span><b>Active</b>Digital system</span>
            <span><b>{liveCycle}</b>Current cycle</span>
            <span><b>Protected</b>Member intelligence</span>
            <span><b>{liveReports}</b>Reports</span>
          </div>
        </article>
      </div>
    </section>
  );
}

function LiveDigitalPlatformSection({ experience, onNavigate }: { experience: PublicExperience | null; onNavigate: (path: string, id?: string) => void }) {
  const fixtures = experience?.intelligencePreview?.fixtures ?? [];
  const visibleFixtures = fixtures.slice(0, 4);
  const results = experience?.performance?.liveVerifiedResults ?? [];
  const currentPeriod = experience?.performance?.currentReportingPeriod;
  const marketsCovered = new Set(results.map((item) => item.market).filter(Boolean)).size;
  const competitionsCovered = new Set(fixtures.map((fixture) => fixture.league).filter(Boolean)).size;
  const weeklyOperations = [
    { label: "Opportunities Published This Week", value: String(experience?.activity?.approvedOpportunities ?? 0), status: "Protected publication" },
    { label: "Opportunities Pending Review", value: String(experience?.activity?.pendingApproval ?? currentPeriod?.positionsPending ?? 0), status: "Intelligence queue" },
    { label: "Opportunities Approved", value: String(experience?.activity?.approvedOpportunities ?? 0), status: "Admin controlled" },
    { label: "Opportunities Settled", value: String(currentPeriod?.positionsSettled ?? results.length), status: results.length ? "Verified cycle" : "Awaiting first cycle" },
    { label: "Average Confidence", value: experience?.activity?.approvedOpportunities ? "Calculated in portal" : "Pending live data", status: "Model separated" },
    { label: "Markets Covered", value: String(marketsCovered), status: "Operational scope" },
    { label: "Competitions Covered", value: String(competitionsCovered), status: "Live scanner" },
    { label: "Intelligence Reviews Completed", value: String(experience?.activity?.intelligenceReviewsCompleted ?? experience?.activity?.analysisJobsCompletedToday ?? 0), status: "Intelligence governance" },
  ];
  const reportCards = [
    { title: "Daily Intelligence Briefing", date: "Today", status: "Available to Subscribers" },
    { title: "Weekly Performance Report", date: "This week", status: "Available to Subscribers" },
    { title: "Market Trends Report", date: "Current cycle", status: "Available to Subscribers" },
    { title: "League Performance Review", date: "Updated weekly", status: "Available to Subscribers" },
    { title: "Risk Analysis Report", date: "Active monitoring", status: "Available to Subscribers" },
    { title: "Confidence Distribution Report", date: "After verification", status: "Available to Subscribers" },
  ];
  return (
    <section className="public-command-grid" id="what-fpf-is">
      <article className="why-panel">
        <div className="panel-title-row"><strong>Why FPF?</strong><button type="button" onClick={() => onNavigate("/about", "what-fpf-is")}>Learn More</button></div>
        {[
            ["FPF Intelligence Verification", "Each opportunity passes FPF's proprietary intelligence verification process before member access."],
          ["Live In-Play Intelligence", "Signals are monitored without exposing internal model logic."],
          ["Performance Transparency", "Results and reports stay tied to verified records."],
        ].map(([title, body]) => (
          <div className="why-line" key={title}><span aria-hidden="true" /><div><strong>{title}</strong><p>{body}</p></div></div>
        ))}
      </article>
      <article className="weekly-panel">
        <div className="panel-title-row"><strong>This Week's Performance</strong><button type="button" onClick={() => onNavigate("/performance", "performance")}>View Report</button></div>
        <div className="operational-performance-grid">
          {weeklyOperations.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <em>{item.status}</em>
            </div>
          ))}
        </div>
        <p className="dashboard-integrity-note">
          Operational metrics come from the public FPF experience API. Verified betting performance starts only after digitally settled selections.
        </p>
        <p className="public-data-freshness">Updated: {formatPublicDateTime(experience?.generatedAt)}</p>
      </article>
      <article className="reports-panel">
        <div className="panel-title-row"><strong>Latest Performance Reports</strong><button type="button" onClick={() => onNavigate("/login", "auth")}>View All</button></div>
        {reportCards.map((report) => (
          <div className="report-row premium-report-row" key={report.title}>
            <span aria-hidden="true" />
            <div>
              <strong>{report.title}</strong>
              <small>{report.date}</small>
            </div>
            <em>{report.status}</em>
            <button type="button" onClick={() => onNavigate("/login", "auth")}>View Report</button>
          </div>
        ))}
      </article>
      <article className="community-panel" id="community-preview">
        <div className="panel-title-row"><strong>Community</strong><span>Coming Soon</span></div>
        <p>Community highlights stay hidden until the feature is active and approved for public display.</p>
      </article>
      <article className="fixtures-panel">
        <div className="panel-title-row"><strong>Upcoming Intelligence</strong><button type="button" onClick={() => onNavigate("/login", "auth")}>Protected</button></div>
        {visibleFixtures.length ? visibleFixtures.map((fixture) => (
          <div className="fixture-row" key={`${fixture.match}-${fixture.kickoffTime}`}>
            <div><strong>{fixture.match}</strong><span>{fixture.league} · {fixture.country}</span></div>
            <em>{fixture.publicationStatus}</em>
          </div>
        )) : <p className="empty-state">No public live fixtures are available yet. Member intelligence appears after verified publication.</p>}
      </article>
    </section>
  );
}

function PublicAuthPage({ authPanel }: { authPanel: ReactNode }) {
  return (
    <section className="public-auth-page" id="main-content">
      <div>
        <p className="eyebrow">Secure Access</p>
        <h1>Enter the FPF intelligence operating system.</h1>
        <p>One protected account gives eligible members access to the right private FPF workspace.</p>
        <div className="auth-benefit-grid">
          <article><strong>Secure session</strong><span>Token-based protected access</span></article>
          <article><strong>Private workspace</strong><span>Role-based routing after sign in</span></article>
          <article><strong>FPF verified</strong><span>Approved intelligence only</span></article>
          <article><strong>Preferences after login</strong><span>Personal settings live in Profile</span></article>
        </div>
      </div>
      <div className="public-auth-card" id="auth">{authPanel}</div>
    </section>
  );
}

function PublicSection({ children, eyebrow, id, title }: { children: ReactNode; eyebrow: string; id: string; title: string }) {
  return (
    <section className="public-section" id={id}>
      <div className="section-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function StatusPill({ children }: { children: ReactNode }) {
  return <span className="status-pill">{children}</span>;
}

function WhatFpfIs() {
  return (
    <PublicSection id="what-fpf-is" eyebrow="What FPF Is" title="A private football intelligence operating system.">
      <div className="split-layout premium-split">
        <div className="feature-panel feature-panel-lead">
          <StatusPill>Not a tips site</StatusPill>
          <p>
            Football Performance Fund turns football data, proprietary intelligence controls and disciplined publishing rules into member-ready intelligence.
          </p>
          <p>
            Public pages explain the model. The protected platform handles subscriptions, partner workspaces, reporting and operational controls.
          </p>
        </div>
        <div className="intelligence-stack" aria-label="FPF intelligence operating layers">
          {[
            ["01", "Football context", "Fixtures, form, markets and match signals are normalised."],
            ["02", "Intelligence review", "Confidence, risk and value are assessed before publication."],
            ["03", "Member workspace", "Only approved information reaches eligible authenticated users."],
          ].map(([step, title, body]) => (
            <article key={title}>
              <span>{step}</span>
              <strong>{title}</strong>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </div>
    </PublicSection>
  );
}

function HowItWorks() {
  const steps = [
    "Football data is collected",
    "Intelligence opportunities are identified",
    "Every opportunity passes FPF intelligence verification",
    "Approved intelligence is published to eligible members",
  ];
  return (
    <PublicSection id="how-fpf-works" eyebrow="How FPF Works" title="A simple public model with protected internal controls.">
      <div className="workflow-grid public-workflow-grid">
        {steps.map((step, index) => (
          <article key={step}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{step}</strong>
            <p>{["Normalized match context enters the platform.", "Signals are screened before publication.", "Multi-layer intelligence controls keep the process disciplined.", "Eligible members see only approved intelligence."][index]}</p>
          </article>
        ))}
      </div>
    </PublicSection>
  );
}

function SubscriberMembership({ onNavigate, plans }: { onNavigate: (path: string, id?: string) => void; plans: CommercialStructure["subscriberPlans"] }) {
  return (
    <PublicSection id="subscribers" eyebrow="Subscriber Membership" title="Member access to approved football intelligence.">
      <div className="value-grid">
        {["Match Intelligence", "Confidence and risk context", "Opportunity Center", "Performance reporting", "Alerts and briefings", "Responsible participation guidance"].map((item) => (
          <article key={item}><StatusPill>Included</StatusPill><strong>{item}</strong></article>
        ))}
      </div>
      <div className="pricing-grid public-pricing-preview" id="pricing">
        {plans.filter((plan) => plan.monthlyPriceCents > 0).slice(0, 3).map((plan) => (
          <article className={plan.highlighted ? "featured" : ""} key={plan.code}>
            {plan.highlighted ? <StatusPill>Most Selected</StatusPill> : null}
            <span>{plan.name}</span>
            <strong>{money(plan.monthlyPriceCents)}<small>/month</small></strong>
            <ul>{plan.features.slice(0, 5).map((feature) => <li key={feature}>{feature}</li>)}</ul>
            <button type="button" onClick={() => onNavigate("/register", "auth")}>{plan.highlighted ? "Start 3-Day Preview" : "Register Interest"}</button>
          </article>
        ))}
      </div>
    </PublicSection>
  );
}

function PerformancePartnerProgramme({
  commercialStructure,
  experience,
  onNavigate,
}: {
  commercialStructure: CommercialStructure;
  experience: PublicExperience | null;
  onNavigate: (path: string, id?: string) => void;
}) {
  return (
    <PublicSection id="performance-partners" eyebrow="Performance Partner Programme" title="A risk-aware partnership programme with clear separation from membership.">
      <div className="split-layout premium-split">
        <div className="feature-panel">
          <StatusPill>Risk First</StatusPill>
          <p>
            Performance Partners can explore participation options, reporting and simulator tools after account access. Licence fees, contributions and subscriber revenue are treated separately by the internal platform.
          </p>
          <p className="policy-note">Simulation only. Returns are not guaranteed. Final payment and payout workflows remain controlled inside protected systems.</p>
          <div className="partner-benefit-row">
            {["Season-based participation", "Private reporting", "Capital separation", "No guaranteed returns"].map((item) => <span key={item}>{item}</span>)}
          </div>
          <button className="inline-public-action" type="button" onClick={() => onNavigate("/register", "auth")}>Explore Performance Partnership</button>
        </div>
        <div className="signal-grid">
          <div><span>Minimum participation</span><strong>{money(experience?.commercial?.minimumInvestmentCents ?? commercialStructure.minimumInvestmentCents ?? publicCommercialFallback.minimumInvestmentCents)}</strong></div>
          <div><span>Plans</span><strong>Season-based</strong></div>
          <div><span>Reporting</span><strong>Member portal</strong></div>
          <div><span>Risk notice</span><strong>No guarantees</strong></div>
        </div>
      </div>
    </PublicSection>
  );
}

function TrustSection() {
  return (
    <PublicSection id="security" eyebrow="Security and Transparency" title="Premium intelligence with strict operating boundaries.">
      <div className="trust-grid public-trust-grid">
        {[
          ["Controlled publication", "Only approved intelligence reaches eligible members."],
          ["Privacy by design", "Public pages do not expose private selections, internal identities or member data."],
          ["Risk-first language", "FPF never guarantees outcomes or fixed returns."],
          ["One secure platform", "Role-based access keeps each workspace separated."],
        ].map(([title, body]) => (
          <article key={title}><StatusPill>FPF Control</StatusPill><strong>{title}</strong><p>{body}</p></article>
        ))}
      </div>
    </PublicSection>
  );
}

function PerformancePreview({ experience }: { experience: PublicExperience | null }) {
  const results = experience?.performance?.liveVerifiedResults ?? [];
  const digitalSummary = experience?.performance?.digitalSummary;
  const wins = results.filter((item) => item.result.toLowerCase().includes("win")).length;
  const total = results.length;
  const trend = results.slice(-3).map((item) => item.result).join(" / ");
  return (
    <PublicSection id="performance" eyebrow="Verified Digital Performance" title="Digital reporting begins from the first settled production cycle.">
      <div className="performance-grid public-performance-grid">
        <article><StatusPill>Digital</StatusPill><span>Total digitally settled selections</span><strong>{String(digitalSummary?.totalSettledSelections ?? total)}</strong></article>
        <article><StatusPill>Digital</StatusPill><span>Digital wins</span><strong>{String(digitalSummary?.digitalWins ?? wins)}</strong></article>
        <article><StatusPill>Digital</StatusPill><span>Digital losses / void</span><strong>{`${digitalSummary?.digitalLosses ?? 0} / ${digitalSummary?.voidSelections ?? 0}`}</strong></article>
        <article><StatusPill>Cycle</StatusPill><span>Latest verified update</span><strong>{digitalSummary?.latestVerifiedUpdate ? formatPublicDate(digitalSummary.latestVerifiedUpdate) : "Awaiting first settled cycle"}</strong></article>
      </div>
      <p className="policy-note">{digitalSummary?.message ?? "Digital tracking active. No digitally verified result published yet. Historical operating record is shown separately."}</p>
      {trend ? <p className="policy-note">Recent digital trend: {trend}. No result guarantees are made.</p> : null}
    </PublicSection>
  );
}

function FAQSection() {
  return (
    <PublicSection id="faq" eyebrow="FAQ" title="Clear answers before you join.">
      <div className="faq-grid">
        <article><strong>Does FPF guarantee outcomes?</strong><p>No. Football outcomes are never guaranteed.</p></article>
        <article><strong>What do subscribers receive?</strong><p>Eligible subscribers receive approved Match Intelligence with context, confidence and risk information.</p></article>
        <article><strong>Is FPF a public picks platform?</strong><p>No. FPF is a proprietary football intelligence operating system with controlled publication standards.</p></article>
        <article><strong>Are simulations real returns?</strong><p>No. Simulations are illustrative only and do not promise performance.</p></article>
      </div>
    </PublicSection>
  );
}

function ContactSection({ onNavigate }: { onNavigate: (path: string, id?: string) => void }) {
  return (
    <PublicSection id="contact" eyebrow="Contact" title="Start with the right FPF pathway.">
      <div className="split-layout premium-split">
        <div className="feature-panel">
          <p>For subscriber access, Performance Partner enquiries, media or official support, start with a secure FPF account or contact the team through the official channel.</p>
        </div>
        <div className="value-grid compact">
          <article><strong>Members</strong><span>Use Sign In</span></article>
          <article><strong>New users</strong><span>Register Interest</span></article>
          <article><strong>Partners</strong><span>Performance Partnership</span></article>
          <article><strong>Questions</strong><span>Review the FAQ first</span></article>
        </div>
      </div>
      <div className="section-actions">
        <button type="button" onClick={() => onNavigate("/login", "auth")}>Sign In</button>
        <button type="button" onClick={() => onNavigate("/register", "auth")}>Register</button>
      </div>
    </PublicSection>
  );
}

function GlobalCommandCenterSection() {
  const regions = [
    ["UEFA", "Europe"],
    ["CONMEBOL", "South America"],
    ["AFC", "Asia"],
    ["CAF", "Africa"],
    ["CONCACAF", "North America"],
    ["OFC", "Oceania"],
  ];

  return (
    <PublicSection id="global-command" eyebrow="Global Intelligence Network" title="Operational readiness across supported football regions.">
      <div className="global-command-section">
        <div className="global-network-orb" aria-label="Animated global football intelligence network showing readiness across supported regions">
          <span className="network-radar" />
          <span className="orb-core" />
          <span className="network-ring one" />
          <span className="network-ring two" />
          <span className="network-ring three" />
          {regions.map(([label], index) => (
            <span className="regional-node" key={label} style={{ "--node-index": index } as CSSProperties}>
              <b>{label}</b>
            </span>
          ))}
          {Array.from({ length: 24 }).map((_, index) => (
            <i className="data-particle" key={index} style={{ "--dot-index": index } as CSSProperties} />
          ))}
          <strong>FPF</strong>
        </div>
        <div className="global-command-copy">
          <StatusPill>Operational</StatusPill>
          <h3>GLOBAL INTELLIGENCE NETWORK</h3>
          <p className="network-status-line">Operational - monitoring supported football regions</p>
          <p>
            FPF is designed as a single football intelligence layer across competitions, territories and member workspaces. The animation represents network readiness and regional coverage, not a claim that a specific match or provider is currently active.
          </p>
          <div className="region-grid">
            {regions.map(([label, value]) => (
              <article key={label}>
                <strong>{label}</strong>
                <span>{value}</span>
              </article>
            ))}
          </div>
        </div>
      </div>
    </PublicSection>
  );
}

function LiveIntelligenceCenterSection({ experience }: { experience: PublicExperience | null }) {
  const syncStatus = experience?.activity?.lastSuccessfulDataRefresh ? "Running" : "Ready";
  const signals = [
    { label: "AI Decision Core", value: "Online", detail: "Structured outputs only", tone: "live" as const },
    { label: "Risk Analysis", value: "Running", detail: "No guaranteed outcomes", tone: "ready" as const },
    { label: "Match Intelligence", value: syncStatus, detail: "Provider-safe fallbacks", tone: "live" as const },
    { label: "Security Monitoring", value: "Active", detail: "Role-based access", tone: "ready" as const },
    { label: "Payment Controls", value: "Protected", detail: "Backend-only secrets", tone: "ready" as const },
    { label: "Report Engine", value: "Available", detail: "Subscriber gated", tone: "ready" as const },
  ];

  const chartPoints = [
    { label: "Scanner", value: experience?.activity?.fixturesMonitored ?? 0 },
    { label: "Review", value: experience?.activity?.pendingApproval ?? 0 },
    { label: "Approved", value: experience?.activity?.approvedOpportunities ?? 0 },
    { label: "Regions", value: experience?.activity?.leaguesCovered ?? 0 },
    { label: "Reports", value: experience?.activity?.reportsPending ?? 0 },
  ];

  return (
    <PublicSection id="live-intelligence-center" eyebrow="Live Intelligence Center" title="Every system, continuously observed.">
      <div className="live-intelligence-center-grid">
        <PremiumCommandGrid signals={signals} />
        <PremiumAreaChart title="Operational Pulse" points={chartPoints} />
      </div>
      <p className="dashboard-integrity-note">
        This section displays operational system status only. Verified performance statistics remain separate from current platform activity.
      </p>
    </PublicSection>
  );
}

function PublicFooter({ onNavigate }: { onNavigate: (path: string, id?: string) => void }) {
  return (
    <footer className="public-footer">
      <div className="public-footer-brand">
        <img src="/fpf-official-logo.jpeg" alt="Football Performance Fund official logo" width="48" height="48" />
        <span>
          <strong>Football Performance Fund</strong>
          <span>Global football intelligence, built for disciplined performance.</span>
        </span>
      </div>
      <div>
        <button type="button" onClick={() => onNavigate("/privacy-policy", "security")}>Privacy</button>
        <button type="button" onClick={() => onNavigate("/risk-disclosure", "performance")}>Risk Disclosure</button>
        <button type="button" onClick={() => onNavigate("/contact", "contact")}>Contact</button>
      </div>
    </footer>
  );
}
