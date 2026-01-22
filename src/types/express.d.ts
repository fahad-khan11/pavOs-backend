import type { AccessLevel } from "@whop/sdk"; // if available in SDK types

declare global {
  namespace Express {
    interface Request {
      whop?: {
        userId: string;
        companyId: string;
        access?: {
          has_access: boolean;
          access_level?: AccessLevel | string;
        };
      };
    }
  }
}

export {};
