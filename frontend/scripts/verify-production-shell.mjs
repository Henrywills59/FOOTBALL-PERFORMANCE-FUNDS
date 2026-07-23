import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const app = readFileSync(join(root, "src", "App.tsx"), "utf8");
const primitives = readFileSync(join(root, "src", "components", "PremiumPrimitives.tsx"), "utf8");
const publicExperience = readFileSync(join(root, "src", "PublicExperience.tsx"), "utf8");
const sitemap = readFileSync(join(root, "public", "sitemap.xml"), "utf8");

const checks = [
  {
    name: "public auth panel does not display raw API URL diagnostics",
    pass: !app.includes("API URL:") && !app.includes("Test API connection"),
  },
  {
    name: "public registration excludes internal analyst role",
    pass: app.includes('PUBLIC_USER_ROLES.filter((role) => role !== "ANALYST")') && app.includes("publicRegistrationRoles.map"),
  },
  {
    name: "stored sessions are validated against the backend profile endpoint",
    pass: app.includes('apiGet<{ user: AuthUser }>("/users/me", session.token)'),
  },
  {
    name: "AI Intelligence Center is available inside the command shell",
    pass: app.includes("function AIIntelligenceCenterView") && app.includes('"AI Intelligence Center"'),
  },
  {
    name: "public analyst application route is not exposed in the public experience",
    pass: !publicExperience.includes("/analyst-applications") && !sitemap.includes("/analyst-applications"),
  },
  {
    name: "subscriber public copy does not expose company-only queues",
    pass: !publicExperience.includes("Company Bets Queue") && !publicExperience.includes("Betting Ledger"),
  },
  {
    name: "prototype launch language is removed from the production shell",
    pass: !app.includes("Welcome Wizard") && !app.includes("unified workspace is ready") && !app.includes("LaunchExperienceCenter"),
  },
  {
    name: "premium frontend primitives are wired into public and command surfaces",
    pass:
      primitives.includes("PremiumMetricGrid") &&
      publicExperience.includes("LiveDigitalPlatformSection") &&
      app.includes("AdminExecutiveOverview") &&
      app.includes("PremiumEmptyState"),
  },
  {
    name: "subscriber protected shell excludes company-only execution surfaces",
    pass:
      app.includes('session.user.role !== "INVESTOR" && session.user.role !== "ANALYST" && activeView === "Subscriber Home"') &&
      app.includes("Subscriber pages only receive approved FPF Intelligence") &&
      app.includes("company-only execution data remain hidden from subscribers"),
  },
  {
    name: "visible standalone analyst portal labels are removed from the app shell",
    pass:
      !app.includes("Analyst Dashboard") &&
      !app.includes("Analyst Applications") &&
      !app.includes("Analyst Academy") &&
      !app.includes("Analyst Treasury"),
  },
];

const failed = checks.filter((check) => !check.pass);

for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}`);
}

if (failed.length) {
  process.exitCode = 1;
}
