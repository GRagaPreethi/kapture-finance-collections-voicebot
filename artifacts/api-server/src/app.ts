import express, { type Express, type ErrorRequestHandler } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { handleWebhookRequest } from "./routes/collections";

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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Vapi can call the webhook at the root path in local integrations, while
// the dashboard uses the shared /api namespace for all other endpoints.
app.post("/webhook", handleWebhookRequest);

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({
      error: "Malformed JSON request.",
      code: "INVALID_JSON",
    });
    return;
  }

  logger.error({ err: error }, "Unhandled API error");
  res.status(500).json({
    error: "Something went wrong while processing the request.",
    code: "INTERNAL_ERROR",
  });
};

app.use(errorHandler);

export default app;
