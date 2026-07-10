import type { Express } from "express";

type ServerlessRequest = Parameters<Express>[0];
type ServerlessResponse = Parameters<Express>[1];

let appPromise: Promise<Express> | null = null;

async function getApp() {
  appPromise ??= import("../backend/src/app.js").then(({ createApp }) =>
    createApp({
      startFootballJobs: false,
    }),
  );

  return appPromise;
}

export default async function handler(request: ServerlessRequest, response: ServerlessResponse) {
  const app = await getApp();
  return app(request, response);
}
