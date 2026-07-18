import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { CommercialStructure, PublicExperience, ThemePreference } from "./types";

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
    image: "https://images.unsplash.com/photo-1517747614396-d21a78b850e8?auto=format&fit=crop&w=1800&q=82",
    caption: "Matchday Intelligence",
  },
  {
    title: "Professional Analysis",
    image: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1800&q=82",
    caption: "Analyst Review",
  },
  {
    title: "Tactical Control",
    image: "https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=1800&q=82",
    caption: "Operational Discipline",
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
          <img className="brand-logo" src="/fpf-logo.svg" alt="" width="44" height="44" />
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
          <PublicSignalBar experience={experience} />
          <PublicDashboardPreview experience={experience} onNavigate={navigate} />
          <HowItWorks />
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
            AI-powered predictions, live in-play intelligence and professional analyst insight in one disciplined football operating system.
          </p>
          <div className="hero-actions">
            <button type="button" onClick={() => onNavigate("/register", "auth")}>Start 3-Day Preview</button>
            <button type="button" onClick={() => onNavigate("/how-fpf-works", "how-fpf-works")}>Explore Intelligence</button>
            <button className="secondary" type="button" onClick={() => onNavigate("/pricing", "pricing")}>View Membership Plans</button>
            <button className="text-link-action" type="button" onClick={() => onNavigate("/investors", "performance-partners")}>Explore Performance Partnership</button>
          </div>
          <div className="hero-controls" aria-label="Hero slide indicators">
            <span className="active">AI Verified<small>Every insight reviewed</small></span>
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
          <span>FPF Intelligence War Room</span>
          <strong>Real-time match analysis and internal review workspace.</strong>
          <button type="button" onClick={() => onNavigate("/login", "auth")}>Enter War Room</button>
        </div>
      </div>
    </aside>
  );
}

function PublicSignalBar({ experience }: { experience: PublicExperience | null }) {
  const results = experience?.performance?.liveVerifiedResults ?? [];
  const signals = [
    { label: "Win rate", value: results.length ? `${Math.round((results.filter((item) => item.netResultUnit > 0).length / results.length) * 100)}%` : "Awaiting verified data" },
    { label: "Monthly performance", value: "Awaiting verified data" },
    { label: "Active subscribers", value: "Available after audit" },
    { label: "System status", value: experience?.activity?.platformStatus === "OPERATIONAL" ? "Ready" : "Preparing" },
    { label: "Average odds", value: results.length ? (results.reduce((total, item) => total + item.publishedOdds, 0) / results.length).toFixed(2) : "Pending" },
    { label: "Model accuracy", value: "Verified records only" },
  ];
  return (
    <section className="activity-bar public-signal-bar" aria-label="FPF public signal summary">
      <div className="activity-track">
        {signals.map((signal) => (
          <article key={signal.label}>
            <span>{signal.label}</span>
            <strong>{signal.value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function PublicDashboardPreview({ experience, onNavigate }: { experience: PublicExperience | null; onNavigate: (path: string, id?: string) => void }) {
  const fixtures = experience?.intelligencePreview?.fixtures ?? [];
  const visibleFixtures = fixtures.slice(0, 4);
  return (
    <section className="public-command-grid" id="what-fpf-is">
      <article className="why-panel">
        <div className="panel-title-row"><strong>Why FPF?</strong><button type="button" onClick={() => onNavigate("/about", "what-fpf-is")}>Learn More</button></div>
        {[
          ["AI + Analyst Verification", "Every published opportunity is reviewed before member access."],
          ["Live In-Play Intelligence", "Signals are monitored without exposing internal model logic."],
          ["Performance Transparency", "Results and reports stay tied to verified records."],
        ].map(([title, body]) => (
          <div className="why-line" key={title}><span aria-hidden="true" /><div><strong>{title}</strong><p>{body}</p></div></div>
        ))}
      </article>
      <article className="weekly-panel">
        <div className="panel-title-row"><strong>This Week's Performance</strong><button type="button" onClick={() => onNavigate("/performance", "performance")}>View Report</button></div>
        <div className="chart-line" aria-label="Performance chart placeholder"><i /><i /><i /><i /><i /><i /><i /></div>
        <div className="mini-stat-row">
          <span><b>{experience?.performance?.currentReportingPeriod.positionsSettled ?? 0}</b>Settled</span>
          <span><b>{experience?.performance?.currentReportingPeriod.positionsPending ?? 0}</b>Pending</span>
          <span><b>{experience?.performance?.currentReportingPeriod.reportingCompletion ?? 0}%</b>Complete</span>
        </div>
      </article>
      <article className="reports-panel">
        <div className="panel-title-row"><strong>Latest Performance Reports</strong><button type="button" onClick={() => onNavigate("/login", "auth")}>View All</button></div>
        {["Daily Intelligence Briefing", "Weekly Performance Report", "Market Trends Report"].map((report) => (
          <div className="report-row" key={report}><span aria-hidden="true" /> <strong>{report}</strong><em>Protected</em></div>
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
        <h1>Enter the FPF operating system.</h1>
        <p>One secure account routes subscribers, Performance Partners, analysts, Country Partners and administrators into the correct protected workspace.</p>
        <div className="auth-benefit-grid">
          <article><strong>One account</strong><span>Role-based routing after login</span></article>
          <article><strong>Protected access</strong><span>Private workspaces stay private</span></article>
          <article><strong>Global preferences</strong><span>Language, currency and timezone support</span></article>
          <article><strong>Preview ready</strong><span>3-Day Preview flow prepared for activation</span></article>
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
            Football Performance Fund turns football data, analyst review and disciplined publishing rules into member-ready intelligence.
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
    "Professional analysts verify each opportunity",
    "Approved intelligence is published to eligible members",
  ];
  return (
    <PublicSection id="how-fpf-works" eyebrow="How FPF Works" title="A simple public model with protected internal controls.">
      <div className="workflow-grid public-workflow-grid">
        {steps.map((step, index) => (
          <article key={step}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{step}</strong>
            <p>{["Normalized match context enters the platform.", "Signals are screened before publication.", "Human review keeps the process disciplined.", "Eligible members see only approved intelligence."][index]}</p>
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
          ["Privacy by design", "Public pages do not expose private selections, analyst identities or member data."],
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
  const wins = results.filter((item) => item.result.toLowerCase().includes("win")).length;
  const total = results.length;
  const trend = results.slice(-3).map((item) => item.result).join(" / ");
  return (
    <PublicSection id="performance" eyebrow="Verified Performance" title="A public results preview without private model data.">
      <div className="performance-grid public-performance-grid">
        <article><StatusPill>Verified</StatusPill><span>Total verified selections</span><strong>{total ? String(total) : "No verified public results yet"}</strong></article>
        <article><StatusPill>Historical</StatusPill><span>Win rate</span><strong>{total ? `${Math.round((wins / total) * 100)}%` : "Pending verified results"}</strong></article>
        <article><StatusPill>Trend</StatusPill><span>Recent result trend</span><strong>{trend || "Awaiting first settled cycle"}</strong></article>
        <article><StatusPill>Updated</StatusPill><span>Last updated</span><strong>{formatPublicDate(experience?.generatedAt)}</strong></article>
      </div>
      <p className="policy-note">Performance information is historical and informational. It does not guarantee future outcomes, profit or payout timing.</p>
    </PublicSection>
  );
}

function FAQSection() {
  return (
    <PublicSection id="faq" eyebrow="FAQ" title="Clear answers before you join.">
      <div className="faq-grid">
        <article><strong>Does FPF guarantee outcomes?</strong><p>No. Football outcomes are never guaranteed.</p></article>
        <article><strong>What do subscribers receive?</strong><p>Eligible subscribers receive approved Match Intelligence with context, confidence and risk information.</p></article>
        <article><strong>Are analysts public tipsters?</strong><p>No. Analysts are internal professionals or approved contracted experts.</p></article>
        <article><strong>Are simulations real returns?</strong><p>No. Simulations are placeholders and do not promise performance.</p></article>
      </div>
    </PublicSection>
  );
}

function ContactSection({ onNavigate }: { onNavigate: (path: string, id?: string) => void }) {
  return (
    <PublicSection id="contact" eyebrow="Contact" title="Start with the right FPF pathway.">
      <div className="split-layout premium-split">
        <div className="feature-panel">
          <p>For subscriber access, partnership enquiries, media or analyst applications, start with a secure FPF account or contact the team through the official channel.</p>
        </div>
        <div className="value-grid compact">
          <article><strong>Members</strong><span>Use Sign In</span></article>
          <article><strong>New users</strong><span>Register Interest</span></article>
          <article><strong>Partners</strong><span>Performance Partnership</span></article>
          <article><strong>Questions</strong><span>FAQ first</span></article>
        </div>
      </div>
      <div className="section-actions">
        <button type="button" onClick={() => onNavigate("/login", "auth")}>Sign In</button>
        <button type="button" onClick={() => onNavigate("/register", "auth")}>Register</button>
      </div>
    </PublicSection>
  );
}

function PublicFooter({ onNavigate }: { onNavigate: (path: string, id?: string) => void }) {
  return (
    <footer className="public-footer">
      <div>
        <strong>Football Performance Fund</strong>
        <span>Global football intelligence, built for disciplined performance.</span>
      </div>
      <div>
        <button type="button" onClick={() => onNavigate("/privacy-policy", "security")}>Privacy</button>
        <button type="button" onClick={() => onNavigate("/risk-disclosure", "performance")}>Risk Disclosure</button>
        <button type="button" onClick={() => onNavigate("/contact", "contact")}>Contact</button>
      </div>
    </footer>
  );
}
