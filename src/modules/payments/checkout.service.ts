import { whopClient } from "../../config/whop";

export interface CreateCheckoutParams {
  plan_type: "one_time" | "renewal";
  initial_price: number;
  renewal_price?: number;
  currency?: string;
  metadata?: Record<string, any>;
  product_id?: string;
  billing_period?: number;
}

export const CheckoutService = {

  async createCheckoutConfig(params: CreateCheckoutParams) {
    const { 
      plan_type, 
      initial_price, 
      renewal_price, 
      currency = "usd", 
      metadata,
      product_id,
      billing_period,
    } = params;

    // IMPORTANT: Use SELLER company ID (from env) not buyer's company
    // This allows selling to users from ANY company
    const { ENV } = await import("../../config/env");
    const seller_company_id = ENV.WHOP_COMPANY_ID;

    if (!seller_company_id) {
      throw new Error("WHOP_COMPANY_ID (seller company) must be set in .env");
    }

    const checkoutConfig = await whopClient.checkoutConfigurations.create({
      plan: {
        companyId: seller_company_id, // ✅ Always use seller's company
        currency,
        initial_price,
        plan_type,
        ...(plan_type === "renewal" && renewal_price ? { renewal_price } : {}),
        ...(plan_type === "renewal" && billing_period ? { billing_period } : {}),
        ...(product_id ? { product_id } : {}),
      } as any,
      ...(metadata ? { metadata } : {}),
    } as any);

    return checkoutConfig;
  },

  async verifyPayment(paymentId: string) {
    const payment = await whopClient.payments.retrieve(paymentId);
    return payment;
  },
};
