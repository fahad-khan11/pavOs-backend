import { Request, Response } from 'express';
import { whopService } from '../services/whopService.js';
import { Lead, User } from '../models/index.js';

/**
 * Manually fetch and import all members from Whop company
 * Useful for initial sync or when webhooks fail
 * 
 * GET /api/v1/whop/sync-members?companyId=biz_xxx
 */
export const syncWhopMembers = async (req: Request, res: Response) => {
  try {
    const whopCompanyId = (req.query.companyId as string) || (req.user as any)?.whopCompanyId;

    if (!whopCompanyId) {
      return res.status(400).json({
        success: false,
        message: 'Company ID is required',
      });
    }

    console.log(`🔄 Starting member sync for company: ${whopCompanyId}`);

    // Find the user who owns this company in our system
    const creator = await User.findOne({ whopCompanyId });

    if (!creator) {
      return res.status(404).json({
        success: false,
        message: `No PaveOS user found for company ${whopCompanyId}. Make sure company owner has logged into PaveOS.`,
      });
    }

    console.log(`👤 Found company owner: ${creator.email}`);

    // Fetch all memberships from Whop
    console.log('📡 Fetching memberships from Whop API...');
    const membershipsResponse = await whopService.whop.memberships.list({
      company_id: whopCompanyId,
    });

    const memberships = membershipsResponse.data || [];
    console.log(`✅ Found ${memberships.length} active memberships`);

    const results = {
      total: memberships.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Process each membership
    for (const membership of memberships) {
      try {
        const membershipData = membership as any;
        const user_id = membershipData.user_id || membershipData.user?.id;
        const membership_id = membershipData.id;

        if (!user_id) {
          console.warn(`⚠️  Membership ${membership_id} has no user_id, skipping`);
          results.skipped++;
          continue;
        }

        // Fetch user details
        let user_email, user_name;
        try {
          const whopUser = await whopService.whop.users.retrieve(user_id);
          user_email = (whopUser as any).email;
          user_name = (whopUser as any).username || (whopUser as any).name || `Whop Member`;
        } catch (userError) {
          console.warn(`⚠️  Could not fetch user ${user_id}:`, userError);
          user_name = `Whop Member`;
        }

        // Check if lead already exists
        const existingLead = await Lead.findOne({
          whopCompanyId,
          $or: [
            { whopMembershipId: membership_id },
            { whopCustomerId: user_id },
          ],
        });

        if (existingLead) {
          console.log(`✓ Lead exists: ${existingLead.name}`);
          results.updated++;
          
          // Update status to 'won' if not already
          if (existingLead.status !== 'won') {
            existingLead.status = 'won';
            if (!existingLead.wonAt) existingLead.wonAt = new Date();
            await existingLead.save();
          }
          continue;
        }

        // Create new lead
        const newLead = await Lead.create({
          userId: creator._id.toString(),
          whopCompanyId,
          name: user_name,
          email: user_email || `${user_id}@whop.user`,
          source: 'whop',
          status: 'won', // They already joined
          whopCustomerId: user_id,
          whopMembershipId: membership_id,
          wonAt: new Date(),
          tags: ['whop-sync'],
          notes: `Auto-imported from Whop on ${new Date().toISOString()}`,
        });

        console.log(`✅ Created lead: ${newLead.name}`);
        results.created++;

      } catch (memberError: any) {
        console.error(`❌ Error processing membership:`, memberError);
        results.errors.push(memberError.message);
      }
    }

    console.log(`\n📊 Sync completed:
      Total: ${results.total}
      Created: ${results.created}
      Updated: ${results.updated}
      Skipped: ${results.skipped}
      Errors: ${results.errors.length}
    `);

    return res.status(200).json({
      success: true,
      message: 'Member sync completed',
      results,
    });

  } catch (error: any) {
    console.error('❌ Error syncing members:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to sync members',
      error: error.message,
    });
  }
};
