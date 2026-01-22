import Whop from "@whop/sdk";
import { ENV } from "./env";

export const whopClient = new Whop({
  apiKey: ENV.WHOP_API_KEY,
  ...(ENV.WHOP_APP_ID ? { appID: ENV.WHOP_APP_ID } : {}),
});
