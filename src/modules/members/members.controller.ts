import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { MembersService } from "./members.service";

const listSchema = z.object({
  company_id: z.string().min(1),
  after: z.string().optional(),
  before: z.string().optional(),
  order: z.string().optional(),
  direction: z.string().optional(),
  query: z.string().optional(),
});

type DashboardMember = {
  id: string;
  name: string;
  email: string | null;
  status: string;
  access_level: string;
  joined_at: string | null;
  last_action: string | null;
  last_action_at: string | null;
  total_spent_usd: number;
};

export const MembersController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = listSchema.parse({
        ...req.query,
        company_id: (req.query.company_id as string) || req.whop!.companyId,
      });

      // Ensure user is only querying the company in their Whop context
      if (parsed.company_id !== req.whop!.companyId) {
        return res.status(403).json({ error: "company_id mismatch with Whop context." });
      }

      // Whop page response: { data: [...], page_info: {...} }
      const page = await MembersService.listMembers(parsed);

      const membersRaw = (page as any)?.data ?? [];
      const page_info = (page as any)?.page_info ?? null;

      // ---- 1) Build "members" array for UI ----
      const members: DashboardMember[] = membersRaw.map((m: any) => {
        const name =
          (m?.user?.name && String(m.user.name).trim()) ||
          (m?.user?.username && String(m.user.username).trim()) ||
          "Unknown User";

        const email = m?.user?.email ?? null;

        return {
          id: m.id,
          name,
          email,
          status: m.status ?? null,
          access_level: m.access_level ?? null,
          joined_at: m.joined_at ?? null,
          last_action: m.most_recent_action ?? null,
          last_action_at: m.most_recent_action_at ?? null,
          total_spent_usd: Number(m.usd_total_spent ?? 0),
        };
      });

      // ---- 2) Build "stats" for top cards ----
      // Whop doesn't return these as a separate object; we compute them.
      const total_members = members.length;

      const active_members = membersRaw.filter((m: any) => m?.status === "joined").length;
      const cancelled_members = membersRaw.filter((m: any) => m?.status === "left").length;
      const drafted_members = membersRaw.filter((m: any) => m?.status === "drafted").length;

      const total_revenue_usd = Number(
        membersRaw.reduce((sum: number, m: any) => sum + Number(m?.usd_total_spent ?? 0), 0).toFixed(2)
      );

      // ---- 3) Send clean response to frontend ----
      return res.json({
        stats: {
          total_members,
          active_members,
          cancelled_members,
          drafted_members,
          total_revenue_usd,
        },
        members,
        page_info,
      });
    } catch (err) {
      next(err);
    }
  },

  async retrieve(req: Request, res: Response, next: NextFunction) {
    try {
      const member = await MembersService.retrieveMember(req.params.id);
      const m: any = member;
  
      const response = {
        id: m.id,
        created_at: m.created_at ?? null,
        updated_at: m.updated_at ?? null,
        joined_at: m.joined_at ?? null,
  
        access_level: m.access_level ?? "no_access",
        status: m.status ?? null,
  
        most_recent_action: m.most_recent_action ?? null,
        most_recent_action_at: m.most_recent_action_at ?? null,
  
        user: {
          id: m?.user?.id ?? null,
          email: m?.user?.email ?? null,
          name: m?.user?.name ?? null,
          username: m?.user?.username ?? null,
        },
  
        phone: m?.phone ?? null,
  
        usd_total_spent: Number(m?.usd_total_spent ?? 0),
  
        company: {
          id: req.whop!.companyId, // always safe from Whop context
          title: m?.company?.title ?? null,
          route: m?.company?.route ?? null,
        },
      };
  
      return res.json(response);
    } catch (err) {
      next(err);
    }
  },  
};
