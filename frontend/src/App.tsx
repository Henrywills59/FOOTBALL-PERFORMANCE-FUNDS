import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  AuthResponse,
  AuthUser,
  FootballFixtureDetail,
  FootballFixtureSummary,
  PublicUserRole,
} from "@fpf/shared";
import { PUBLIC_USER_ROLES } from "@fpf/shared";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const roleLabels: Record<PublicUserRole | "ADMIN", string> = {
  SUBSCRIBER: "Subscriber",
  INVESTOR: "Investor",
  ANALYST: "Analyst",
  ADMIN: "Admin",
};

const dashboardCopy: Record<AuthUser["role"], string> = {
  SUBSCRIBER: "Your subscriber workspace is ready for future performance insights.",
  INVESTOR: "Your investor workspace is ready for future portfolio views.",
  ANALYST: "Your analyst workspace is ready for future research tools.",
  ADMIN: "Your admin workspace is ready for future platform controls.",
};

type AuthMode = "login" | "register" | "forgot";

function getStoredSession() {
  const rawSession = localStorage.getItem("fpf_session") ?? sessionStorage.getItem("fpf_session");
  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as AuthResponse;
  } catch {
    return null;
  }
}

export default function App() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [session, setSession] = useState<AuthResponse | null>(() => getStoredSession());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fixtures, setFixtures] = useState<FootballFixtureSummary[]>([]);
  const [selectedFixture, setSelectedFixture] = useState<FootballFixtureDetail | null>(null);
  const [footballStatus, setFootballStatus] = useState("Loading fixtures");

  const dashboardTitle = useMemo(() => {
    if (!session) {
      return "";
    }

    return `${roleLabels[session.user.role]} Dashboard`;
  }, [session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    void loadFixtures(session.token);
  }, [session]);

  function storeSession(nextSession: AuthResponse, rememberMe: boolean) {
    const serialized = JSON.stringify(nextSession);
    sessionStorage.removeItem("fpf_session");
    localStorage.removeItem("fpf_session");

    if (rememberMe) {
      localStorage.setItem("fpf_session", serialized);
    } else {
      sessionStorage.setItem("fpf_session", serialized);
    }

    setSession(nextSession);
  }

  async function request(path: string, body: object) {
    const response = await fetch(`${apiUrl}/api${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? "Something went wrong");
    }

    return data;
  }

  async function apiGet<T>(path: string, token: string) {
    const response = await fetch(`${apiUrl}/api${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? "Request failed");
    }
    return data as T;
  }

  async function loadFixtures(token: string) {
    try {
      setFootballStatus("Loading fixtures");
      const data = await apiGet<{ fixtures: FootballFixtureSummary[] }>("/football/fixtures?limit=10", token);
      setFixtures(data.fixtures);
      setFootballStatus(data.fixtures.length ? "Fixtures loaded" : "No fixtures synced yet");
      if (data.fixtures[0]) {
        await loadFixtureDetail(data.fixtures[0].id, token);
      }
    } catch (caughtError) {
      setFootballStatus(caughtError instanceof Error ? caughtError.message : "Unable to load fixtures");
    }
  }

  async function loadFixtureDetail(id: string, token = session?.token) {
    if (!token) {
      return;
    }

    try {
      const data = await apiGet<{ fixture: FootballFixtureDetail }>(`/football/fixtures/${id}`, token);
      setSelectedFixture(data.fixture);
    } catch (caughtError) {
      setFootballStatus(caughtError instanceof Error ? caughtError.message : "Unable to load match details");
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const form = new FormData(event.currentTarget);
    const rememberMe = form.get("rememberMe") === "on";
    const data = (await request("/auth/login", {
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
    const data = (await request("/auth/register", {
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
    const data = (await request("/auth/forgot-password", {
      email: form.get("email"),
    })) as { message: string; resetToken?: string };

    setMessage(
      data.resetToken
        ? `${data.message} Temporary reset token: ${data.resetToken}`
        : data.message,
    );
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
  }

  if (session) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <section className="mx-auto grid min-h-screen w-full max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[1fr_340px] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">
              Football Performance Fund
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-normal sm:text-5xl">
              {dashboardTitle}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
              {dashboardCopy[session.user.role]}
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <DashboardTile label="Account" value={session.user.status} />
              <DashboardTile label="Role" value={roleLabels[session.user.role]} />
              <DashboardTile
                label="Created"
                value={new Date(session.user.createdAt).toLocaleDateString()}
              />
            </div>
            <section className="mt-8 grid gap-4 lg:grid-cols-[320px_1fr]">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">Live Fixtures</h2>
                  <button
                    className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 transition hover:border-emerald-300"
                    type="button"
                    onClick={() => void loadFixtures(session.token)}
                  >
                    Refresh
                  </button>
                </div>
                <p className="mt-2 text-sm text-zinc-400">{footballStatus}</p>
                <div className="mt-4 space-y-2">
                  {fixtures.map((fixture) => (
                    <button
                      className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-3 text-left transition hover:border-emerald-300"
                      key={fixture.id}
                      type="button"
                      onClick={() => void loadFixtureDetail(fixture.id)}
                    >
                      <span className="block text-xs uppercase tracking-[0.12em] text-zinc-500">
                        {fixture.leagueName}
                      </span>
                      <span className="mt-1 block font-semibold">
                        {fixture.homeTeamName} vs {fixture.awayTeamName}
                      </span>
                      <span className="mt-1 block text-sm text-zinc-400">
                        {fixture.status} · {fixture.homeScore ?? "-"}-{fixture.awayScore ?? "-"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <h2 className="text-lg font-semibold">Match Details</h2>
                {selectedFixture ? (
                  <div className="mt-4 space-y-4 text-sm text-zinc-300">
                    <p className="text-base font-semibold text-white">
                      {selectedFixture.homeTeamName} vs {selectedFixture.awayTeamName}
                    </p>
                    <p>{new Date(selectedFixture.kickoffAt).toLocaleString()}</p>
                    <p>{selectedFixture.venue ?? "Venue pending"}</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <DashboardTile label="Injuries" value={String(selectedFixture.injuries.length)} />
                      <DashboardTile label="Odds" value={String(selectedFixture.odds.length)} />
                      <DashboardTile label="Standings" value={String(selectedFixture.standings.length)} />
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-zinc-400">Select a fixture to see details.</p>
                )}
              </div>
            </section>
          </div>

          <aside className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 shadow-2xl shadow-black/20">
            <h2 className="text-xl font-semibold">Profile</h2>
            <dl className="mt-5 space-y-4 text-sm">
              <ProfileRow label="Name" value={session.user.name} />
              <ProfileRow label="Email" value={session.user.email} />
              <ProfileRow label="Role" value={roleLabels[session.user.role]} />
              <ProfileRow label="Status" value={session.user.status} />
            </dl>
            <button
              className="mt-6 w-full rounded-md bg-white px-4 py-3 font-semibold text-zinc-950 transition hover:bg-zinc-200"
              type="button"
              onClick={signOut}
            >
              Sign out
            </button>
          </aside>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <section className="mx-auto grid min-h-screen w-full max-w-6xl gap-10 px-6 py-10 lg:grid-cols-[1fr_420px] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">
            Secure access
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-normal sm:text-5xl">
            Football Performance Fund
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
            Create an account, choose the right role, and land in a simple dashboard
            prepared for the next product phase.
          </p>
        </div>

        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 shadow-2xl shadow-black/20">
          <div className="grid grid-cols-3 rounded-md bg-zinc-950 p-1 text-sm">
            <ModeButton active={mode === "login"} onClick={() => setMode("login")}>
              Login
            </ModeButton>
            <ModeButton active={mode === "register"} onClick={() => setMode("register")}>
              Register
            </ModeButton>
            <ModeButton active={mode === "forgot"} onClick={() => setMode("forgot")}>
              Reset
            </ModeButton>
          </div>

          {error ? <p className="mt-4 rounded-md bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
          {message ? (
            <p className="mt-4 rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-200">
              {message}
            </p>
          ) : null}

          {mode === "login" ? (
            <form className="mt-6 space-y-4" onSubmit={safelySubmit(handleLogin)}>
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
            <form className="mt-6 space-y-4" onSubmit={safelySubmit(handleRegister)}>
              <TextField label="Name" name="name" type="text" />
              <TextField label="Email" name="email" type="email" />
              <TextField label="Password" name="password" type="password" />
              <label className="block text-sm font-medium text-zinc-200">
                Role
                <select
                  className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none transition focus:border-emerald-300"
                  name="role"
                  defaultValue="SUBSCRIBER"
                >
                  {PUBLIC_USER_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </select>
              </label>
              <SubmitButton>Create account</SubmitButton>
            </form>
          ) : null}

          {mode === "forgot" ? (
            <form className="mt-6 space-y-4" onSubmit={safelySubmit(handleForgotPassword)}>
              <TextField label="Email" name="email" type="email" />
              <SubmitButton>Send reset link</SubmitButton>
            </form>
          ) : null}
        </section>
      </section>
    </main>
  );
}

function DashboardTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      <p className="mt-2 font-semibold text-white">{value}</p>
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
    <button
      className={`rounded px-3 py-2 font-medium transition ${
        active ? "bg-white text-zinc-950" : "text-zinc-400 hover:text-white"
      }`}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function TextField({
  label,
  name,
  type,
}: {
  label: string;
  name: string;
  type: string;
}) {
  return (
    <label className="block text-sm font-medium text-zinc-200">
      {label}
      <input
        className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none transition focus:border-emerald-300"
        name={name}
        required
        type={type}
      />
    </label>
  );
}

function SubmitButton({ children }: { children: string }) {
  return (
    <button
      className="w-full rounded-md bg-emerald-300 px-4 py-3 font-semibold text-zinc-950 transition hover:bg-emerald-200"
      type="submit"
    >
      {children}
    </button>
  );
}
