const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export default function App() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-16">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">
            Phase 1 scaffold
          </p>
          <h1 className="mt-5 text-5xl font-bold tracking-normal text-white sm:text-6xl">
            Football Performance Fund
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            A clean foundation for the platform: React frontend, Express API,
            shared types, Prisma database package, Docker, and deployment-ready
            configuration.
          </p>
          <div className="mt-10 flex flex-col gap-4 text-sm text-slate-300 sm:flex-row">
            <div className="border-l-4 border-field pl-4">
              API health endpoint
              <span className="block font-mono text-white">{apiUrl}/health</span>
            </div>
            <div className="border-l-4 border-gold pl-4">
              Current scope
              <span className="block text-white">Foundation only</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
