import { whopClient } from "../../config/whop";
import { MemberSnapshot } from "./memberSnapshot.model";
import type { ListMembersQuery } from "./members.types";

export const MembersService = {
  async listMembers(params: ListMembersQuery) {
    const page = await whopClient.members.list(params as any);

    // Optional analytics snapshot (don't block response)
    void saveSnapshots(page.data as any[], params.company_id);

    return page;
  },

  async retrieveMember(memberId: string) {
    const member = await whopClient.members.retrieve(memberId);
    return member;
  },
};

async function saveSnapshots(members: any[], companyId: string) {
  try {
    if (!Array.isArray(members) || members.length === 0) return;

    const ops = members.map((m) => ({
      updateOne: {
        filter: { companyId, memberId: m.id },
        update: {
          $set: {
            companyId,
            memberId: m.id,
            payload: m,
            lastSyncedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    await MemberSnapshot.bulkWrite(ops, { ordered: false });
  } catch {
    // ignore analytics write errors
  }
}
