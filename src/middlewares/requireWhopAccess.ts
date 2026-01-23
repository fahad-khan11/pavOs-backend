import type { Request, Response, NextFunction } from "express";
import { whopClient } from "../config/whop";

export async function requireWhopAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, companyId } = req.whop!;

    const access = await whopClient.users.checkAccess(companyId, { id: userId });

    if (!access?.has_access) {
      res.status(403).json({
        error: "User does not have access to this company.",
        access_level: access?.access_level ?? "no_access",
      });
      return;
    }

    req.whop!.access = access;
    next();
  } catch (err) {
    next(err);
  }
}
