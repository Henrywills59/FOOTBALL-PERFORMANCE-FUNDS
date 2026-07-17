import { useEffect, useState, type ReactNode } from "react";
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
    image: "https://images.unsplash.com/photo-1556056504-5c7696c4c28d?auto=format&fit=crop&w=1800&q=82",
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
  ["How FPF Works", "/how-fpf-works", "how-fpf-works"],
  ["Subscribers", "/subscribers", "subscribers"],
  ["Performance Partners", "/investors", "performance-partners"],
  ["About", "/about", "what-fpf-is"],
  ["FAQ", "/faq", "faq"],
  ["Contact", "/contact", "contact"],
  ["Sign In", "/login", "auth"],
  ["Register", "/register", "auth"],
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
          <span>Football Performance Fund</span>
          <strong>FPF</strong>
        </button>
        <nav className="public-nav-links" aria-label="Public website navigation">
          {mobileNavItems.slice(0, 7).map(([label, path, id]) => (
            <button key={path} type="button" onClick={() => navigate(path, id)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="public-nav-actions">
          <ThemeSwitcher theme={theme} onChange={onThemeChange} />
          <button className="ghost-action desktop-auth-action" type="button" onClick={() => navigate("/login", "auth")}>Sign In</button>
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
          <PublicSection id="what-fpf-is" eyebrow="What FPF Is" title="A football intelligence platform built for disciplined members.">
            <div className="split-layout premium-split">
              <div className="feature-panel">
                <p>
                  Football Performance Fund combines advanced football intelligence, professional analyst review and disciplined operational controls to produce verified football insights.
                </p>
                <p>
                  The public website explains the model simply. Protected member workspaces remain behind authentication.
                </p>
              </div>
              <div className="value-grid compact">
                {["Advanced football intelligence", "Professional review", "Risk-aware publishing", "Member-only insights"].map((item) => <article key={item}>{item}</article>)}
              </div>
            </div>
          </PublicSection>
          <HowItWorks />
          <SubscriberMembership plans={plans} onNavigate={navigate} />
          <PerformancePartnerProgramme commercialStructure={{ ...publicCommercialFallback, ...publicCommercial }} experience={experience} onNavigate={navigate} />
          <TrustSection />
          <PerformancePreview experience={experience} />
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
          <p className="eyebrow">Football Performance Intelligence</p>
          <h1 id="public-hero-title">We Don't Chase Luck.<br />We Build Performance.</h1>
          <p className="hero-support">
            FPF combines advanced football intelligence, professional analyst review and disciplined operational controls to produce verified football insights.
          </p>
          <div className="hero-actions">
            <button type="button" onClick={() => onNavigate("/how-fpf-works", "how-fpf-works")}>Explore Intelligence</button>
            <button className="secondary" type="button" onClick={() => onNavigate("/pricing", "pricing")}>View Membership Plans</button>
            <button className="text-link-action" type="button" onClick={() => onNavigate("/investors", "performance-partners")}>Explore Performance Partnership</button>
          </div>
          <div className="hero-controls" aria-label="Hero slide indicators">
            {heroSlides.map((slide, index) => (
              <span className={index === activeSlide ? "active" : ""} key={slide.title}>
                {slide.caption}
              </span>
            ))}
          </div>
        </div>
        <aside className="hero-intelligence-card" aria-label="FPF intelligence preview">
          <StatusPill>Public Preview</StatusPill>
          <strong>Institutional match intelligence, reviewed before publication.</strong>
          <div className="preview-lines" aria-hidden="true"><i /><i /><i /></div>
          <div className="hero-card-grid">
            <div><span>Confidence</span><strong>Context-led</strong></div>
            <div><span>Risk</span><strong>Visible</strong></div>
            <div><span>Publishing</span><strong>Approved</strong></div>
            <div><span>Access</span><strong>Member-only</strong></div>
          </div>
          <p>No public page exposes private selections, provider keys, treasury data or analyst identities.</p>
        </aside>
      </div>
    </section>
  );
}

function PublicSignalBar({ experience }: { experience: PublicExperience | null }) {
  const results = experience?.performance?.liveVerifiedResults ?? [];
  const signals = [
    { label: "Public results", value: results.length ? `${results.length} verified` : "Awaiting first cycle" },
    { label: "Member intelligence", value: "Approved only" },
    { label: "Analyst model", value: "Private review" },
    { label: "Risk language", value: "No guarantees" },
    { label: "Updated", value: formatPublicDate(experience?.generatedAt) },
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

function PublicAuthPage({ authPanel }: { authPanel: ReactNode }) {
  return (
    <section className="public-auth-page" id="main-content">
      <div>
        <p className="eyebrow">Secure Access</p>
        <h1>Access your FPF workspace.</h1>
        <p>Login, register, or reset your password from one dedicated account page. Public diagnostics stay inside authorised portals.</p>
        <div className="auth-benefit-grid">
          <article><strong>One account</strong><span>Role-based routing after login</span></article>
          <article><strong>Protected access</strong><span>Private workspaces stay private</span></article>
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
            <button type="button" onClick={() => onNavigate("/register", "auth")}>Register Interest</button>
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
    <PublicSection id="security" eyebrow="Why Trust FPF" title="Built around discipline, privacy and clear member boundaries.">
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
