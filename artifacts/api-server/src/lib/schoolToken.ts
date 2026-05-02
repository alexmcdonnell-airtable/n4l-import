import crypto from "crypto";
import type { Request } from "express";

export function generateAccessToken(): string {
  return crypto.randomBytes(16).toString("base64url");
}

export function hashAccessToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function buildAccessUrl(req: Request, token: string): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host =
    req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}/s/${token}`;
}
