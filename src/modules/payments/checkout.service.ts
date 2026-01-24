import { whopClient } from "../../config/whop";

export interface CreateCheckoutParams {
  company_id: string;
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
      company_id, 
      plan_type, 
      initial_price, 
      renewal_price, 
      currency = "usd", 
      metadata,
      product_id,
      billing_period,
    } = params;

   
    const checkoutConfig = await whopClient.checkoutConfigurations.create({
      plan: {
        companyId: company_id,  
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
