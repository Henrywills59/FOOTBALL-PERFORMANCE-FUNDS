import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const app = readFileSync(join(root, "src", "App.tsx"), "utf8");
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
];

const failed = checks.filter((check) => !check.pass);

for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}`);
}

if (failed.length) {
  process.exitCode = 1;
}
