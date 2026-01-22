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

      const result = await MembersService.listMembers(parsed);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async retrieve(req: Request, res: Response, next: NextFunction) {
    try {
      const member = await MembersService.retrieveMember(req.params.id);
      res.json(member);
    } catch (err) {
      next(err);
    }
  },
};
