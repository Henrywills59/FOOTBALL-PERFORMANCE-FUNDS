import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { InMemoryUserRepository } from "./inMemoryUserRepository.js";
import { InMemoryFootballRepository } from "../football/inMemoryFootballRepository.js";
import { InMemoryPredictionRepository } from "../predictions/inMemoryPredictionRepository.js";

function testApp() {
  return createApp({
    userRepository: new InMemoryUserRepository(),
    footballRepository: new InMemoryFootballRepository(),
    predictionRepository: new InMemoryPredictionRepository([]),
    jwtSecret: "test-secret",
    startFootballJobs: false,
  });
}

const validRegistration = {
  name: "Taylor Williams",
  email: "taylor@example.com",
  password: "Password123",
  role: "SUBSCRIBER",
};

describe("auth routes", () => {
  it("registers a public user role and returns a JWT session", async () => {
    const response = await request(testApp())
      .post("/api/auth/register")
      .send(validRegistration)
      .expect(201);

    expect(response.body.user.email).toBe("taylor@example.com");
    expect(response.body.user.role).toBe("SUBSCRIBER");
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user.passwordHash).toBeUndefined();
  });

  it("does not allow Admin registration from the public form", async () => {
    const response = await request(testApp())
      .post("/api/auth/register")
      .send({ ...validRegistration, role: "ADMIN" })
      .expect(400);

    expect(response.body.error).toBe("Invalid request");
  });

  it("logs in with email and password", async () => {
    const app = testApp();
    await request(app).post("/api/auth/register").send(validRegistration).expect(201);

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: validRegistration.email,
        password: validRegistration.password,
        rememberMe: true,
      })
      .expect(200);

    expect(response.body.expiresIn).toBe("30d");
    expect(response.body.user.email).toBe(validRegistration.email);
  });

  it("routes users to the correct role dashboard", async () => {
    const app = testApp();
    const login = await request(app)
      .post("/api/auth/register")
      .send({ ...validRegistration, role: "INVESTOR" })
      .expect(201);

    const response = await request(app)
      .get("/api/dashboards/me")
      .set("Authorization", `Bearer ${login.body.token}`)
      .expect(200);

    expect(response.body.path).toBe("/dashboard/investor");
    expect(response.body.title).toBe("Investor Dashboard");
  });

  it("protects profile and dashboard routes", async () => {
    await request(testApp()).get("/api/users/me").expect(401);

    const app = testApp();
    const login = await request(app).post("/api/auth/register").send(validRegistration).expect(201);

    await request(app)
      .get("/api/dashboards/investor")
      .set("Authorization", `Bearer ${login.body.token}`)
      .expect(403);

    await request(app)
      .get("/api/dashboards/subscriber")
      .set("Authorization", `Bearer ${login.body.token}`)
      .expect(200);
  });

  it("creates and consumes a password reset token", async () => {
    const app = testApp();
    await request(app).post("/api/auth/register").send(validRegistration).expect(201);

    const reset = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: validRegistration.email })
      .expect(200);

    expect(reset.body.resetToken).toEqual(expect.any(String));

    await request(app)
      .post("/api/auth/reset-password")
      .send({ token: reset.body.resetToken, password: "NewPassword123" })
      .expect(200);

    await request(app)
      .post("/api/auth/login")
      .send({
        email: validRegistration.email,
        password: "NewPassword123",
        rememberMe: false,
      })
      .expect(200);
  });

  it("changes password for the signed-in user", async () => {
    const app = testApp();
    const registered = await request(app).post("/api/auth/register").send(validRegistration).expect(201);

    await request(app)
      .post("/api/users/me/password")
      .set("Authorization", `Bearer ${registered.body.token}`)
      .send({
        currentPassword: validRegistration.password,
        newPassword: "ChangedPassword123",
      })
      .expect(200);

    await request(app)
      .post("/api/auth/login")
      .send({
        email: validRegistration.email,
        password: "ChangedPassword123",
        rememberMe: false,
      })
      .expect(200);
  });
});
