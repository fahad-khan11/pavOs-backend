import "dotenv/config";

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const ENV = {
  PORT: Number(process.env.PORT ?? 5000),
  MONGO_URI: must("MONGO_URI"),
  WHOP_API_KEY: must("WHOP_API_KEY"),
  WHOP_APP_ID: process.env.WHOP_APP_ID || undefined,
  WHOP_COMPANY_ID: process.env.WHOP_COMPANY_ID || undefined,
};
