import express from "express";
import cors from "cors";
import { router } from "./routes";
import { errorHandler, notFound } from "./middleware/error";
import { getAllowedOrigins } from "./config/env";

export function createApp() {
  const app = express();
  const allowedOrigins = getAllowedOrigins();

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          return callback(null, true);
        }
        const normalized = origin.replace(/\/+$/, "");
        if (allowedOrigins.includes(origin) || allowedOrigins.includes(normalized)) {
          return callback(null, true);
        }
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
      methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    })
  );

  app.use(express.json({ limit: "10mb" })); // CSV-derived recipient arrays get large
  app.use("/api", router);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
