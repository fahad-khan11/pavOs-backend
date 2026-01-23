import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { PaymentsService } from "./payments.service";

const listSchema = z.object({
  after: z.string().optional(),
  before: z.string().optional(),
  first: z.coerce.number().int().positive().max(200).optional(),
  status: z.string().optional(),
  order: z.string().optional(),
  direction: z.string().optional(),
});

export const PaymentsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = listSchema.parse(req.query);

      // ✅ Always use company from Whop context (avoid mismatch)
      const company_id = req.whop!.companyId;

      // ✅ Call Whop directly
      const page = await PaymentsService.listPaymentsPage({
        company_id,
        ...parsed,
      } as any);

      // ✅ Return exactly what frontend wants (Whop shape)
      return res.json({
        data: (page as any)?.data ?? [],
        page_info: (page as any)?.page_info ?? {
          end_cursor: null,
          start_cursor: null,
          has_next_page: false,
          has_previous_page: false,
        },
      });
    } catch (err: any) {
      // Helpful message for Whop 403 (permissions/install/key)
      const msg = err?.message || String(err);
      if (msg.includes("not authorized") || msg.includes("forbidden") || err?.status === 403) {
        return res.status(403).json({
          error:
            "Whop 403 Forbidden for /payments. Fix: enable payment:basic:read permission on your Whop app AND reinstall the app on this company. Also confirm WHOP_API_KEY is the App API key.",
          details: msg,
        });
      }
      next(err);
    }
  },

  async retrieve(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = retrieveSchema.parse(req.params);

      const payment = await PaymentsService.retrievePayment(id);

      // ✅ send raw Whop response (same shape as docs)
      return res.json(payment);
    } catch (err: any) {
      // Helpful message for Whop 403
      const msg = err?.message || String(err);
      if (msg.includes("not authorized") || msg.includes("forbidden") || err?.status === 403) {
        return res.status(403).json({
          error:
            "Whop 403 Forbidden for retrieve payment. Fix: enable payment:basic:read permission (and related reads) and reinstall the app on the company. Confirm WHOP_API_KEY is an App API key.",
          details: msg,
        });
      }
      next(err);
    }
  },
};
