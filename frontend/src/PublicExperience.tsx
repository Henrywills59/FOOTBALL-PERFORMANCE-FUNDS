import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { CommercialStructure, CurrencySetting, LanguageSetting, PublicExperience, ThemePreference, UserGlobalPreferences } from "./types";

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
    image: "https://images.unsplash.com/photo-1556056504-5c7696c4c28d?auto=format&fit=crop&w=1800&q=82",
    alt: "Football stadium under match lights",
  },
  {
    title: "Professional Analysis",
    image: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1800&q=82",
    alt: "Football players competing during a match",
  },
  {
    title: "Tactical Control",
    image: "https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=1800&q=82",
    alt: "Football stadium crowd and tactical atmosphere",
  },
];

function formatPublicDate(value: string | null | undefined) {
  if (!value) return "Awaiting verified update";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

export function ThemeSwitcher({ onChange, theme }: { onChange: (theme: ThemePreference) => void; theme: ThemePreference }) {
  return (
    <div className="theme-switcher" role="group" aria-label="Theme preference">
      {(["dark", "light", "system"] as ThemePreference[]).map((option) => (
        <button
          aria-pressed={theme === option}
          className={theme === option ? "active" : ""}
          key={option}
          type="button"
          onClick={() => onChange(option)}
        >
          {option === "system" ? "System" : option === "dark" ? "Dark" : "Light"}
        </button>
      ))}
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
  publicPageDefinitions,
  theme,
}: Props) {
  const [activeSlide, setActiveSlide] = useState(0);
  const reducedMotion = useMemo(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false, []);
  const plans = experience?.commercial.subscriberPlans.length ? experience.commercial.subscriberPlans : commercialStructure.subscriberPlans;
  const paymentConfigured = experience?.commercial.paymentConfigured ?? false;
  const publicNav = publicPageDefinitions.filter((page) => ["home", "how-fpf-works", "subscribers", "investors", "performance", "pricing", "security", "faq"].includes(page.id));

  useEffect(() => {
    if (reducedMotion) return;
    const timer = window.setInterval(() => setActiveSlide((value) => (value + 1) % heroSlides.length), 7000);
    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  return (
    <main className="fpf-public">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="public-nav">
        <div className="brand-block">
          <span>Football Performance Fund</span>
          <strong>FPF Global Intelligence</strong>
        </div>
        <nav className="public-nav-links" aria-label="Public website navigation">
          {publicNav.map((item) => (
            <button key={item.path} type="button" onClick={() => onNavigate(item.path, item.id)}>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="public-nav-actions">
          <ThemeSwitcher theme={theme} onChange={onThemeChange} />
          <button className="ghost-action" type="button" onClick={() => onNavigate("/login", "auth")}>Sign In</button>
        </div>
      </header>

      <section className="public-hero" aria-labelledby="public-hero-title">
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
        <div className="hero-grid" id="main-content">
          <div className="hero-copy">
            <p className="eyebrow">Institutional football intelligence</p>
            <h1 id="public-hero-title">We Don't Chase Luck.<br />We Build Performance.</h1>
            <p className="hero-support">
              AI-powered football intelligence, professional analyst review, disciplined capital controls, and transparent performance reporting in one global platform.
            </p>
            <div className="hero-actions">
              <button type="button" onClick={() => onNavigate("/ai-intelligence", "intelligence-preview")}>Explore Intelligence</button>
              <button type="button" onClick={() => onNavigate("/pricing", "pricing")}>View Membership Plans</button>
              <button type="button" onClick={() => onNavigate("/investors", "investor-transparency")}>Become an Investor</button>
              <button type="button" onClick={() => onNavigate("/login", "auth")}>Sign In</button>
              <button className="secondary" type="button" onClick={() => onNavigate("/analyst-applications", "analyst-academy")}>Apply as an Analyst</button>
            </div>
            <div className="hero-controls" aria-label="Hero slide controls">
              {heroSlides.map((slide, index) => (
                <button
                  aria-label={`Show ${slide.title}`}
                  aria-pressed={activeSlide === index}
                  className={activeSlide === index ? "active" : ""}
                  key={slide.title}
                  type="button"
                  onClick={() => setActiveSlide(index)}
                />
              ))}
            </div>
          </div>
          <aside className="auth-dock" id="auth" aria-label="Account access">
            {authPanel}
          </aside>
        </div>
      </section>

      <LiveActivityBar experience={experience} />
      <PublicSection id="intelligence-preview" eyebrow="Live football intelligence preview" title="Public preview, private selections protected.">
        <div className="split-layout">
          <div className="feature-panel">
            <StatusPill status={experience?.intelligencePreview.status ?? "PROVIDER_PENDING"} />
            <p>{experience?.intelligencePreview.message ?? "Live coverage begins after provider activation."}</p>
            <div className="fixture-preview">
              {experience?.intelligencePreview.fixtures.length ? (
                experience.intelligencePreview.fixtures.map((fixture) => (
                  <article key={`${fixture.match}-${fixture.kickoffTime}`}>
                    <strong>{fixture.match}</strong>
                    <span>{fixture.league} - {fixture.country}</span>
                    <small>{formatPublicDate(fixture.kickoffTime)} - {fixture.publicationStatus}</small>
                  </article>
                ))
              ) : (
                <article>
                  <strong>Coverage cycle preparing</strong>
                  <span>Provider connection pending</span>
                  <small>No paid selections are shown publicly.</small>
                </article>
              )}
            </div>
          </div>
          <div className="signal-grid">
            {["DATA_COLLECTION", "AI_ANALYSIS", "ANALYST_REVIEW", "ADMIN_REVIEW", "PUBLISHED_TO_MEMBERS"].map((stage) => (
              <div key={stage}>
                <span>{statusLabel(stage)}</span>
                <strong>{stage === experience?.intelligencePreview.status ? "Active" : "Ready"}</strong>
              </div>
            ))}
          </div>
        </div>
      </PublicSection>

      <PublicSection id="how-fpf-works" eyebrow="Operating model" title="How FPF operates">
        <div className="workflow-grid">
          {[
            "Football data collected",
            "AI intelligence generated",
            "Analysts review assigned fixtures",
            "Rules and odds policy enforced",
            "Admin approves final intelligence",
            "Subscribers receive approved opportunities",
            "Company capital allocation is controlled",
            "Results are settled and reconciled",
            "Reports are generated",
          ].map((step, index) => (
            <article key={step}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step}</strong>
            </article>
          ))}
        </div>
        <p className="policy-note">Suggested odds policy: minimum 1.60, maximum 2.00. Analyst work is internal, publication is Admin-controlled, and outcomes are never guaranteed.</p>
      </PublicSection>

      <PublicSection id="workspace-previews" eyebrow="Platform preview" title="One operating system, role-specific workspaces">
        <div className="preview-grid">
          {["Subscriber Intelligence Dashboard", "Investor Portfolio Dashboard", "Analyst Academy", "Intelligence War Room", "Executive Analytics", "Treasury Controls"].map((title) => (
            <article className="workspace-preview" key={title}>
              <span>Platform Preview</span>
              <strong>{title}</strong>
              <div className="preview-lines" aria-hidden="true"><i /><i /><i /></div>
            </article>
          ))}
        </div>
      </PublicSection>

      <PublicRouteCoverage onNavigate={onNavigate} />
      <PerformanceCenter experience={experience} />

      <PublicSection id="subscribers" eyebrow="Subscriber experience" title="Approved intelligence with confidence and risk context">
        <div className="value-grid">
          {["Approved intelligence only", "Confidence and risk context", "Live match intelligence", "Opportunity history", "Performance reporting", "Global language and currency support", "Notifications", "Responsible participation tools"].map((item) => (
            <article key={item}>{item}</article>
          ))}
        </div>
      </PublicSection>

      <PublicSection id="investor-transparency" eyebrow="Investor transparency" title="Capital separation, reporting, and risk-first controls">
        <div className="split-layout">
          <div className="feature-panel">
            <p>Investor capital is tracked separately from company operating funds. Weekly reporting and treasury reconciliation are designed for Admin approval before any payout process.</p>
            <p className="policy-note">Default profit-distribution policy: Company 50%, Analyst Pool 20%, Investor Pool 30%. Returns are not guaranteed.</p>
          </div>
          <div className="signal-grid">
            <div><span>Minimum investment</span><strong>{money(experience?.commercial.minimumInvestmentCents ?? commercialStructure.minimumInvestmentCents)}</strong></div>
            <div><span>Lock periods</span><strong>{(experience?.commercial.lockPeriods ?? commercialStructure.lockPeriods).map((item) => item.label).join(", ")}</strong></div>
            <div><span>Simulator</span><strong>Projection only</strong></div>
            <div><span>Reporting</span><strong>Weekly review</strong></div>
          </div>
        </div>
      </PublicSection>

      <TrustCenter experience={experience} />
      <MilestoneTimeline experience={experience} />
      <FoundingMembers experience={experience} />
      <PricingSection paymentConfigured={paymentConfigured} plans={plans} onNavigate={onNavigate} />
      <FAQSection />
      <LegalDisclosures />

      <footer className="public-footer">
        <div>
          <strong>Football Performance Fund</strong>
          <span>Global football intelligence, built for disciplined performance.</span>
        </div>
        <div>
          <button type="button" onClick={() => onNavigate("/privacy-policy", "legal")}>Privacy</button>
          <button type="button" onClick={() => onNavigate("/risk-disclosure", "risk-disclosure")}>Risk Disclosure</button>
          <button type="button" onClick={() => onNavigate("/contact", "contact")}>Contact</button>
        </div>
      </footer>
    </main>
  );
}

function LiveActivityBar({ experience }: { experience: PublicExperience | null }) {
  const activity = experience?.activity;
  const metrics = [
    { label: "Fixtures monitored", value: activity?.fixturesMonitored ?? 0, empty: "Monitoring cycle preparing" },
    { label: "Analyst reviews today", value: activity?.analystReviewsCompleted ?? 0, empty: "Intelligence desk online" },
    { label: "Pending approvals", value: activity?.pendingApproval ?? 0, empty: "Awaiting the next fixture cycle" },
    { label: "Covered leagues", value: activity?.leaguesCovered ?? 0, empty: "Coverage begins after provider activation" },
    { label: "Approved opportunities", value: activity?.approvedOpportunities ?? 0, empty: "Members-only publication queue preparing" },
  ];
  return (
    <section className="activity-bar" aria-label="Live FPF activity">
      <div className="activity-track">
        {metrics.map((metric) => (
          <article key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value > 0 ? metric.value : metric.empty}</strong>
          </article>
        ))}
      </div>
      <p>Last updated {formatPublicDate(experience?.generatedAt)} - {activity?.safeState ?? "Intelligence desk online"}</p>
    </section>
  );
}

function PublicSection({ children, eyebrow, id, title }: { children: ReactNode; eyebrow: string; id: string; title: string }) {
  return (
    <section className="public-section" id={id}>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`status-pill status-${status.toLowerCase().replace(/_/g, "-")}`}>{statusLabel(status)}</span>;
}

function PerformanceCenter({ experience }: { experience: PublicExperience | null }) {
  return (
    <PublicSection id="performance" eyebrow="Verified performance center" title="Verified results and simulations never mix">
      <div className="performance-grid">
        <article>
          <h3>Live verified results</h3>
          {experience?.performance.liveVerifiedResults.length ? (
            <p>Verified selections are available in the reporting ledger.</p>
          ) : (
            <p>First verified results will appear after official launch selections are published, settled, and reconciled.</p>
          )}
        </article>
        <article>
          <h3>Pre-launch model testing</h3>
          <p>{experience?.performance.preLaunchModelTesting.notice ?? "Simulation only. No real company capital deployed."}</p>
          <small>{experience?.performance.preLaunchModelTesting.methodology}</small>
        </article>
        <article>
          <h3>Current reporting period</h3>
          <p>{experience?.performance.currentReportingPeriod.reconciliationStatus ?? "Reporting cycle preparing."}</p>
          <small>Settled: {experience?.performance.currentReportingPeriod.positionsSettled ?? 0} - Pending: {experience?.performance.currentReportingPeriod.positionsPending ?? 0}</small>
        </article>
      </div>
    </PublicSection>
  );
}

function PublicRouteCoverage({ onNavigate }: { onNavigate: (path: string, id?: string) => void }) {
  const publicPages = [
    {
      id: "about",
      eyebrow: "About FPF",
      title: "A disciplined football intelligence company, not a public tipster feed",
      body: "FPF combines normalized football data, AI scoring, internal analyst workflow, admin approval, and transparent reporting. Production authentication, role permissions, payments, treasury, and monitoring remain connected to the existing backend.",
      action: ["How FPF Works", "/how-fpf-works", "how-fpf-works"],
    },
    {
      id: "platform",
      eyebrow: "Unified platform",
      title: "One website and operating system",
      body: "Guests, subscribers, investors, analysts, admins, and executives enter through one production app shell. Each role receives the correct protected workspace after login.",
      action: ["Sign In", "/login", "auth"],
    },
    {
      id: "technology",
      eyebrow: "Technology",
      title: "Built around the Intelligence Core",
      body: "Football data, scoring engines, decision outputs, reports, payments, notifications, and monitoring flow through production services rather than visual-only mock data.",
      action: ["Explore Intelligence", "/ai-intelligence", "intelligence-preview"],
    },
    {
      id: "ai-intelligence",
      eyebrow: "AI intelligence",
      title: "Explainable confidence, risk, value, and opportunity scoring",
      body: "FPF intelligence is designed to show why an opportunity is being considered, what changed, and what risks remain before publication.",
      action: ["View Pricing", "/pricing", "pricing"],
    },
    {
      id: "analyst-applications",
      eyebrow: "Analyst pathway",
      title: "Professional internal analysts, never public tipsters",
      body: "Analysts work inside a protected workspace with assignments, rulebooks, discipline metrics, War Room context, and admin-controlled publication.",
      action: ["Create Analyst Account", "/register", "auth"],
    },
    {
      id: "investor-packages",
      eyebrow: "Investor packages",
      title: "Investment education with risk-first placeholders",
      body: "Investor pages explain minimums, lock periods, simulator assumptions, weekly distributions, and reporting while real payment and treasury rules stay in production services.",
      action: ["Investor Overview", "/investors", "investor-transparency"],
    },
    {
      id: "blog",
      eyebrow: "Insights",
      title: "Launch updates and market education",
      body: "The publishing surface is ready for verified updates, market education, platform announcements, and operating notes without exposing private selections.",
      action: ["Media Center", "/media", "media"],
    },
    {
      id: "media",
      eyebrow: "Media",
      title: "Press, announcements, and public communication",
      body: "Public communication points to approved FPF messaging. Internal campaigns and approvals remain inside the Admin Media Command Center.",
      action: ["Contact", "/contact", "contact"],
    },
    {
      id: "careers",
      eyebrow: "Careers",
      title: "Analysts, operations, engineering, and support",
      body: "FPF is prepared for future hiring and contracted expert workflows without exposing internal analyst identities to subscribers.",
      action: ["Apply as Analyst", "/analyst-applications", "analyst-applications"],
    },
    {
      id: "contact",
      eyebrow: "Contact",
      title: "Support and partnership entry points",
      body: "Subscribers, investors, analysts, partners, and media can start from the public app and route into the correct authenticated workflow when needed.",
      action: ["Sign In", "/login", "auth"],
    },
  ] as const;

  return (
    <PublicSection id="public-route-center" eyebrow="Public website routes" title="Every public route resolves inside one production experience">
      <div className="route-grid">
        {publicPages.map((page) => (
          <article id={page.id} key={page.id}>
            <span>{page.eyebrow}</span>
            <strong>{page.title}</strong>
            <p>{page.body}</p>
            <button type="button" onClick={() => onNavigate(page.action[1], page.action[2])}>{page.action[0]}</button>
          </article>
        ))}
      </div>
    </PublicSection>
  );
}

function TrustCenter({ experience }: { experience: PublicExperience | null }) {
  const trust = experience?.trust;
  const rows = [
    ["Website", trust?.websiteStatus ?? "OPERATIONAL"],
    ["Backend", trust?.backendStatus ?? "OPERATIONAL"],
    ["Payments", trust?.paymentProviderStatus ?? "PREPARING"],
    ["Football data", trust?.footballDataStatus ?? "PROVIDER_PENDING"],
    ["Notifications", trust?.notificationProviderStatus ?? "PREPARING"],
    ["Treasury reconciliation", trust?.treasuryReconciliationStatus ?? "PREPARING"],
  ];
  return (
    <PublicSection id="security" eyebrow="Public trust center" title="Transparent status without exposing private operations">
      <div className="trust-grid">
        {rows.map(([label, status]) => (
          <article key={label}><span>{label}</span><StatusPill status={status} /></article>
        ))}
      </div>
      <div className="trust-copy">
        <p>{trust?.riskManagementPolicy}</p>
        <p>{trust?.responsibleParticipationPolicy}</p>
        <p>{trust?.privacySummary}</p>
        <small>Last platform update: {formatPublicDate(trust?.lastPlatformUpdate)}</small>
      </div>
    </PublicSection>
  );
}

function MilestoneTimeline({ experience }: { experience: PublicExperience | null }) {
  return (
    <PublicSection id="milestones" eyebrow="Verified development timeline" title="Platform milestones">
      <div className="timeline">
        {(experience?.milestones ?? []).map((milestone) => (
          <article key={milestone.title}>
            <StatusPill status={milestone.status} />
            <strong>{milestone.title}</strong>
            <span>{milestone.date ?? "Preparing"}</span>
          </article>
        ))}
      </div>
    </PublicSection>
  );
}

function FoundingMembers({ experience }: { experience: PublicExperience | null }) {
  return (
    <PublicSection id="founding-members" eyebrow="Founding members" title="Early access for launch-stage users">
      <div className="split-layout">
        <div className="feature-panel">
          <p>{experience?.foundingMembers.message ?? "Founding access is open while launch operations are prepared."}</p>
          <p className="policy-note">No scarcity counter is displayed unless Admin configures a real seat limit.</p>
        </div>
        <div className="value-grid compact">
          {(experience?.foundingMembers.benefits ?? []).map((benefit) => <article key={benefit}>{benefit}</article>)}
        </div>
      </div>
    </PublicSection>
  );
}

function PricingSection({ onNavigate, paymentConfigured, plans }: { onNavigate: (path: string, id?: string) => void; paymentConfigured: boolean; plans: CommercialStructure["subscriberPlans"] }) {
  return (
    <PublicSection id="pricing" eyebrow="Membership plans" title="Choose your intelligence access">
      <div className="pricing-grid">
        {plans.filter((plan) => plan.monthlyPriceCents > 0).slice(0, 4).map((plan) => (
          <article className={plan.highlighted ? "featured" : ""} key={plan.code}>
            <span>{plan.name}</span>
            <strong>{money(plan.monthlyPriceCents)}<small>/month</small></strong>
            <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
            <button type="button" onClick={() => onNavigate(paymentConfigured ? "/register" : "/get-started", "auth")}>
              {paymentConfigured ? "Create Account" : "Join Launch List"}
            </button>
          </article>
        ))}
      </div>
      {!paymentConfigured ? <p className="policy-note">Secure checkout is being activated. Join the launch list or create your account to receive access updates.</p> : null}
    </PublicSection>
  );
}

function FAQSection() {
  return (
    <PublicSection id="faq" eyebrow="Questions" title="Clear answers before you join">
      <div className="faq-grid">
        <article><strong>Does FPF guarantee outcomes?</strong><p>No. Football intelligence supports decisions, but outcomes are never guaranteed.</p></article>
        <article><strong>Are analysts public tipsters?</strong><p>No. Analysts are internal staff or approved contracted experts.</p></article>
        <article><strong>Are simulations real returns?</strong><p>No. Simulations are projection-only and separated from verified live results.</p></article>
        <article><strong>When are selections visible?</strong><p>Only Admin-approved intelligence is published to members.</p></article>
      </div>
    </PublicSection>
  );
}

function LegalDisclosures() {
  return (
    <section className="legal-strip" id="risk-disclosure">
      <strong>Legal and risk disclosures</strong>
      <p>FPF does not guarantee football outcomes, fixed returns, investor profits, or payout timing. Public pages do not show private selections, investor identities, analyst identities, treasury balances, API keys, or internal logs.</p>
      <div className="legal-route-grid">
        <article id="privacy-policy">
          <strong>Privacy Policy</strong>
          <p>FPF uses account, preference, security, and operational data only to run the platform experience and protected role workspaces.</p>
        </article>
        <article id="terms-and-conditions">
          <strong>Terms and Conditions</strong>
          <p>Membership, investor, analyst, and admin workflows are governed by platform rules, risk disclosures, and production authorization controls.</p>
        </article>
        <article id="responsible-participation">
          <strong>Responsible Participation</strong>
          <p>Football intelligence is informational. Users must manage risk responsibly and understand that outcomes are never guaranteed.</p>
        </article>
        <article id="cookie-policy">
          <strong>Cookie Policy</strong>
          <p>Theme, language, currency, timezone, and authenticated session preferences are used to keep the app consistent across visits.</p>
        </article>
      </div>
    </section>
  );
}
