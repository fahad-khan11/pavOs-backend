import type { Request, Response, NextFunction } from "express";

export function requireWhopContext(req: Request, res: Response, next: NextFunction) {
  const userId = req.header("x-whop-user-id");
  const companyId = req.header("x-whop-company-id");

  if (!userId || !companyId) {
    return res.status(401).json({
      error: "Missing Whop context headers (x-whop-user-id, x-whop-company-id).",
    });
  }

  req.whop = { userId, companyId };
  next();
}
