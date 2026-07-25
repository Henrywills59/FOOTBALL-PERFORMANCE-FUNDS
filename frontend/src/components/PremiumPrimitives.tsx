import type { ReactNode } from "react";

type PremiumMetric = {
  detail?: string;
  label: string;
  status?: "live" | "ready" | "warning" | "muted";
  value: ReactNode;
};

type PremiumCommandSignal = {
  detail?: string;
  label: string;
  tone?: "ready" | "live" | "warning" | "muted";
  value: string;
};

type PremiumAreaChartPoint = {
  label: string;
  value: number;
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

export function PremiumCommandGrid({ signals }: { signals: PremiumCommandSignal[] }) {
  return (
    <div className="premium-command-grid">
      {signals.map((signal, index) => (
        <article className="premium-command-tile" key={`${signal.label}-${index}`}>
          <div className="premium-command-tile-header">
            <span className={`live-dot ${signal.tone ?? "ready"}`} aria-hidden="true" />
            <p>{signal.label}</p>
          </div>
          <strong>{signal.value}</strong>
          {signal.detail ? <small>{signal.detail}</small> : null}
          <div className="premium-command-meter" aria-hidden="true">
            <i style={{ width: `${Math.max(18, Math.min(100, 58 + index * 7))}%` }} />
          </div>
        </article>
      ))}
    </div>
  );
}

export function PremiumAreaChart({ points, title }: { points: PremiumAreaChartPoint[]; title?: string }) {
  if (points.length < 2) {
    return (
      <div className="premium-area-chart empty">
        <span className="live-dot muted" aria-hidden="true" />
        <p>{title ?? "Chart"}</p>
        <small>Awaiting verified platform data.</small>
      </div>
    );
  }

  const width = 420;
  const height = 170;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points.map((point, index) => {
    const x = index * step;
    const y = height - ((point.value - min) / range) * (height - 28) - 14;
    return [x, y] as const;
  });
  const line = coords
    .map(([x, y], index) => {
      if (index === 0) return `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      const [previousX, previousY] = coords[index - 1];
      const controlX = (previousX + x) / 2;
      return `C ${controlX.toFixed(1)} ${previousY.toFixed(1)}, ${controlX.toFixed(1)} ${y.toFixed(1)}, ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;
  const gradientId = `premium-area-${title?.replace(/[^a-z0-9]/gi, "-").toLowerCase() || "chart"}`;

  return (
    <div className="premium-area-chart">
      {title ? (
        <div className="premium-area-chart-title">
          <span className="live-dot live" aria-hidden="true" />
          <strong>{title}</strong>
        </div>
      ) : null}
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title ?? "Performance chart"} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.42" />
            <stop offset="70%" stopColor="#34d399" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.22, 0.44, 0.66, 0.88].map((lineY) => (
          <line className="premium-chart-grid-line" key={lineY} x1="0" x2={width} y1={height * lineY} y2={height * lineY} />
        ))}
        <path d={area} fill={`url(#${gradientId})`} />
        <path className="premium-chart-line" d={line} fill="none" />
        {coords.map(([x, y], index) => (
          <circle className="premium-chart-point" cx={x} cy={y} key={`${x}-${index}`} r={index === coords.length - 1 ? 4 : 2.5} />
        ))}
      </svg>
      <div className="premium-area-chart-labels">
        <span>{points[0]?.label}</span>
        <strong>{points[points.length - 1]?.label}</strong>
      </div>
    </div>
  );
}

export function PremiumLoadingState({ label = "Loading FPF workspace" }: { label?: string }) {
  return (
    <div className="premium-loading-state" role="status" aria-live="polite">
      <span className="live-dot live" aria-hidden="true" />
      <p>{label}</p>
      <div aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}
