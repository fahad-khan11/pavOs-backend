import type { Request, Response, NextFunction } from "express";
import { whopClient } from "../../config/whop";
import { ENV } from "../../config/env";

export const AccessController = {
  /**
   * GET /api/v1/payments/me/access
   * Check if current user has access to seller's product
   */
  async checkAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.whop!.userId;
      const sellerCompanyId = ENV.WHOP_COMPANY_ID;

      if (!sellerCompanyId) {
        res.status(500).json({ error: "WHOP_COMPANY_ID not configured" });
        return;
      }

      // Check if user has access to seller's company/product
      const access = await whopClient.users.checkAccess(sellerCompanyId, { id: userId });

      res.json({
        hasAccess: access?.has_access || false,
        accessLevel: access?.access_level,
        userId,
      });
    } catch (err) {
      next(err);
    }
  },
};
