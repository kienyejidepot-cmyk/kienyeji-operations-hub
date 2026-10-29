import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import authRouter from "./routes/auth";
import router from "./routes";
import { logger } from "./lib/logger";
import { requireSignedIn } from "./routes/common";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Public auth routes (no auth required)
app.use("/api/auth", authRouter);

// All other API routes require authentication
app.use("/api", requireSignedIn, router);

export default app;
