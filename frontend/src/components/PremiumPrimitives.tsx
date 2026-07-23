import type { ReactNode } from "react";

type PremiumMetric = {
  detail?: string;
  label: string;
  status?: "live" | "ready" | "warning" | "muted";
  value: ReactNode;
};

export function PremiumSectionHeader({
  eyebrow,
  title,
  children,
}: {
  children?: ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="premium-section-header">
      <p>{eyebrow}</p>
      <h2>{title}</h2>
      {children ? <div>{children}</div> : null}
    </div>
  );
}

export function PremiumMetricGrid({ metrics }: { metrics: PremiumMetric[] }) {
  return (
    <div className="premium-metric-grid">
      {metrics.map((metric) => (
        <article className="premium-metric-card" key={metric.label}>
          <div>
            <span className={`live-dot ${metric.status ?? "ready"}`} aria-hidden="true" />
            <p>{metric.label}</p>
          </div>
          <strong>{metric.value}</strong>
          {metric.detail ? <small>{metric.detail}</small> : null}
        </article>
      ))}
    </div>
  );
}

export function PremiumEmptyState({
  action,
  body,
  title,
}: {
  action?: ReactNode;
  body: string;
  title: string;
}) {
  return (
    <div className="premium-empty-state">
      <span className="live-dot muted" aria-hidden="true" />
      <h3>{title}</h3>
      <p>{body}</p>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function PremiumStatusBadge({ children, tone = "ready" }: { children: ReactNode; tone?: PremiumMetric["status"] }) {
  return <span className={`premium-status-badge ${tone}`}>{children}</span>;
}
