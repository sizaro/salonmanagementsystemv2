import { rateLimit } from "express-rate-limit";
import { randomUUID } from "crypto";
import { isTrustedOrigin } from "../config/environment.js";

export const attachRequestId = (req, res, next) => {
  req.requestId = randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
};

const response = (message) => (req, res) => res.status(429).json({
  error: message,
  requestId: req.requestId,
});

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: response("Too many requests. Please try again shortly."),
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: response("Too many authentication attempts. Please wait before trying again."),
});

export const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: response("Too many upload attempts. Please wait before trying again."),
});

/** Cookie-authenticated browser writes must originate from an approved UI. */
export const requireTrustedOrigin = (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin && !isTrustedOrigin(origin)) {
    return res.status(403).json({ error: "This request origin is not authorised", requestId: req.requestId });
  }
  next();
};

export const notFound = (req, res) => res.status(404).json({
  error: "Route not found",
  requestId: req.requestId,
});

export const errorHandler = (error, req, res, _next) => {
  const status = error.statusCode || error.status || (error.name === "MulterError" ? 400 : 500);
  if (status >= 500) {
    console.error("Request failed", { requestId: req.requestId, method: req.method, path: req.originalUrl, error: error.message });
  }
  res.status(status).json({
    error: status >= 500 ? "The request could not be completed" : error.message,
    requestId: req.requestId,
  });
};
