import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Invalid request", details: err.errors });
  }

  const message = err instanceof Error ? err.message : "Server error";
  return res.status(500).json({ error: message });
}
