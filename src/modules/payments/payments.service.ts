import { whopClient } from "../../config/whop";

type ListPaymentsQuery = {
  company_id: string;
  after?: string;
  before?: string;
  first?: number;
  status?: string;
  order?: string;
  direction?: string;
};

type PaymentsPage = { data: any[]; page_info: any };

function isAsyncIterable(obj: any): obj is AsyncIterable<any> {
  return obj && typeof obj[Symbol.asyncIterator] === "function";
}

export const PaymentsService = {
  async listPaymentsPage(params: ListPaymentsQuery): Promise<PaymentsPage> {
    const result = await whopClient.payments.list(params as any);

    // If SDK returns an async iterable, return first page only
    if (isAsyncIterable(result)) {
      for await (const page of result) {
        return page as unknown as PaymentsPage;
      }
      return { data: [], page_info: { has_next_page: false, has_previous_page: false } };
    }

    return result as unknown as PaymentsPage;
  },

  async retrievePayment(paymentId: string) {
    // Whop SDK: client.payments.retrieve("pay_...") :contentReference[oaicite:2]{index=2}
    return await whopClient.payments.retrieve(paymentId);
  },
};
