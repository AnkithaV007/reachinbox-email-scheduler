import express from "express";
import cors from "cors";
import { router } from "./routes";
import { errorHandler, notFound } from "./middleware/error";
import { env } from "./config/env";

export function createApp() {
  const app = express();
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "10mb" })); // CSV-derived recipient arrays get large
  app.use("/api", router);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
