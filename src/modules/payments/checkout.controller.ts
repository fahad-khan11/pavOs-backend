import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { CheckoutService } from "./checkout.service";
import { ENV } from "../../config/env";

const createCheckoutSchema = z.object({
  plan_type: z.enum(["one_time", "renewal"]),
  initial_price: z.number().min(0), // Allow 0 for renewal plans with no setup fee
  renewal_price: z.number().positive().optional(),
  currency: z.string().optional().default("usd"),
  metadata: z.record(z.string(), z.any()).optional(),
  product_id: z.string().optional(), // e.g., "prod_xxxxx"
  billing_period: z.number().int().positive().optional(), // Days (30, 365, etc.)
}).refine(
  (data) => {
    // If plan_type is renewal, product_id, renewal_price,....... and billing_period are required
    if (data.plan_type === "renewal") {
      if (!data.product_id) return false;
      if (!data.renewal_price) return false;
      if (!data.billing_period) return false;
    }
    return true;
  },
  {
    message: "For renewal plans, product_id, renewal_price, and billing_period are required",
    path: ["product_id"],
  }
);

const verifyPaymentSchema = z.object({
  payment_id: z.string(),
});

export const CheckoutController = {
 
  async createCheckout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = createCheckoutSchema.parse(req.body);
      
      // No need for company_id - service uses seller company from ENV
      const checkoutConfig = await CheckoutService.createCheckoutConfig(body);

      res.json({
        success: true,
        session_id: checkoutConfig.id,
        checkout_config: checkoutConfig,
      });
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes("not authorized") || msg.includes("forbidden") || err?.status === 403) {
        res.status(403).json({
          error: "Whop 403 Forbidden. Ensure payment permissions are enabled in your Whop app and reinstalled.",
          details: msg,
        });
        return;
      }
      next(err);
    }
  },

  /**
   * POST /api/v1/payments/checkout/verify
   * Verify a payment after checkout completion (without webhooks)
   */
  async verifyPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { payment_id } = verifyPaymentSchema.parse(req.body);

      const payment = await CheckoutService.verifyPayment(payment_id);

      res.json({
        success: true,
        payment,
      });
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes("not authorized") || msg.includes("forbidden") || err?.status === 403) {
        res.status(403).json({
          error: "Whop 403 Forbidden. Ensure payment permissions are enabled.",
          details: msg,
        });
        return;
      }
      next(err);
    }
  },
};
