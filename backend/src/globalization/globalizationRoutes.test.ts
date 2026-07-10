import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { InMemoryAdminRepository } from "../admin/inMemoryAdminRepository.js";
import { createApp } from "../app.js";
import { InMemoryUserRepository } from "../auth/inMemoryUserRepository.js";
import { InMemoryFootballRepository } from "../football/inMemoryFootballRepository.js";
import { InMemoryInvestorRepository } from "../investor/inMemoryInvestorRepository.js";
import { InMemoryPredictionRepository } from "../predictions/inMemoryPredictionRepository.js";
import { InMemoryWalletRepository } from "../wallet/inMemoryWalletRepository.js";

function seedUser(users: InMemoryUserRepository, role: "ADMIN" | "SUBSCRIBER") {
  const id = `${role.toLowerCase()}-global-user`;
  users.seedUser({
    id,
    name: `${role} User`,
    email: `${role.toLowerCase()}-global@example.com`,
    passwordHash: "not-used",
    role,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
  });
  return jwt.sign({ role, email: `${role.toLowerCase()}-global@example.com` }, "test-secret", {
    subject: id,
    expiresIn: "1d",
  });
}

function testApp() {
  const users = new InMemoryUserRepository();
  const adminRepository = new InMemoryAdminRepository();
  const app = createApp({
    userRepository: users,
    footballRepository: new InMemoryFootballRepository(),
    predictionRepository: new InMemoryPredictionRepository([]),
    adminRepository,
    investorRepository: new InMemoryInvestorRepository(),
    walletRepository: new InMemoryWalletRepository(),
    jwtSecret: "test-secret",
    startFootballJobs: false,
  });
  return { app, users };
}

describe("globalization routes", () => {
  it("returns public language, currency, and timezone catalogs", async () => {
    const { app } = testApp();

    const languages = await request(app).get("/api/settings/languages").expect(200);
    const currencies = await request(app).get("/api/settings/currencies").expect(200);
    const timezones = await request(app).get("/api/settings/timezones").expect(200);

    expect(languages.body.languages.map((item: { code: string }) => item.code)).toContain("ar");
    expect(currencies.body.currencies.map((item: { code: string }) => item.code)).toContain("UGX");
    expect(timezones.body.timezones.map((item: { id: string }) => item.id)).toContain("Africa/Kampala");
  });

  it("lets authenticated users update only their own global preferences", async () => {
    const { app, users } = testApp();
    const subscriberToken = seedUser(users, "SUBSCRIBER");

    await request(app).get("/api/settings/preferences").expect(401);

    const updated = await request(app)
      .put("/api/settings/preferences")
      .set("Authorization", `Bearer ${subscriberToken}`)
      .send({
        language: "fr",
        currency: "EUR",
        timezone: "Europe/Paris",
        country: "FR",
        region: "Europe",
        measurementSystem: "metric",
        dateFormat: "DD/MM/YYYY",
        numberFormat: "fr-FR",
      })
      .expect(200);

    expect(updated.body.preferences.language).toBe("fr");
    expect(updated.body.preferences.currency).toBe("EUR");
  });

  it("restricts global admin controls to admins", async () => {
    const { app, users } = testApp();
    const subscriberToken = seedUser(users, "SUBSCRIBER");
    const adminToken = seedUser(users, "ADMIN");

    await request(app)
      .post("/api/admin/globalization")
      .set("Authorization", `Bearer ${subscriberToken}`)
      .send({ enabledLanguages: ["en"], enabledCurrencies: ["USD"] })
      .expect(403);

    const response = await request(app)
      .post("/api/admin/globalization")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ enabledLanguages: ["en", "fr"], enabledCurrencies: ["USD", "EUR"], defaultLanguage: "en", defaultCurrency: "USD" })
      .expect(200);

    expect(response.body.enabledLanguages).toEqual(["en", "fr"]);
    expect(response.body.enabledCurrencies).toEqual(["USD", "EUR"]);
  });
});
