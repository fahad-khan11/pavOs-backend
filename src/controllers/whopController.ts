import { Response } from 'express';
import { AuthRequest } from '../types/index.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { whopService } from '../services/whopService.js';
import { WhopConnection, Contact, User, TelemetryEvent, Lead, Payment } from '../models/index.js';

/**
 * Get Whop connection status
 * GET /api/v1/integrations/whop/status
 */
export const getConnectionStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const connection = await WhopConnection.findOne({ userId, isActive: true });

    if (!connection) {
      successResponse(res, {
        connected: false,
        message: 'Whop not connected',
      });
      return;
    }

    successResponse(res, {
      connected: true,
      companyId: connection.whopCompanyId,
      connectedAt: connection.connectedAt,
      lastSyncAt: connection.lastSyncAt,
      syncedCustomersCount: connection.syncedCustomersCount || 0,
    });
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to get Whop connection status', 500);
  }
};

/**
 * Connect Whop account (Auto-connects using user's Whop data)
 * POST /api/v1/integrations/whop/connect
 */
export const connectWhop = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    // Get user to retrieve Whop data
    const user = await User.findById(userId);
    if (!user) {
      errorResponse(res, 'User not found', 404);
      return;
    }

    // Check if user has Whop credentials
    if (!user.whopUserId || !user.whopCompanyId) {
      errorResponse(res, 'User is not authenticated via Whop. Please log in through Whop.', 400);
      return;
    }

    // ✅ MULTI-TENANT: Use user's company ID, not hardcoded value
    const companyInfo = await whopService.getCompanyInfo(user.whopCompanyId);

    // Check if connection already exists
    let connection = await WhopConnection.findOne({ userId });

    if (connection) {
      // Update existing connection
      connection.isActive = true;
      connection.connectedAt = new Date();
      connection.whopUserId = user.whopUserId;
      connection.whopCompanyId = user.whopCompanyId || companyInfo.id;
      await connection.save();
    } else {
      // Create new connection
      connection = await WhopConnection.create({
        userId,
        whopUserId: user.whopUserId,
        whopCompanyId: user.whopCompanyId || companyInfo.id,
        isActive: true,
        connectedAt: new Date(),
      });
    }

    // Track telemetry
    await TelemetryEvent.create({
      userId,
      eventType: 'whop_connected',
      eventData: {
        companyId: connection.whopCompanyId,
        whopUserId: user.whopUserId,
      },
    });

    successResponse(res, {
      connected: true,
      companyId: connection.whopCompanyId,
      companyName: companyInfo.title || 'Your Company',
      message: 'Successfully connected to Whop',
    }, 'Whop connected successfully', 201);
  } catch (error: any) {
    console.error('Whop connect error:', error);
    errorResponse(res, error.message || 'Failed to connect to Whop', 500);
  }
};

/**
 * Disconnect Whop account
 * POST /api/v1/integrations/whop/disconnect
 */
export const disconnectWhop = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const connection = await WhopConnection.findOne({ userId });

    if (!connection) {
      errorResponse(res, 'Whop connection not found', 404);
      return;
    }

    connection.isActive = false;
    await connection.save();

    successResponse(res, null, 'Whop disconnected successfully');
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to disconnect Whop', 500);
  }
};

/**
 * Sync customers from Whop
 * POST /api/v1/integrations/whop/sync
 */
export const syncWhopCustomers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    // Check connection
    const connection = await WhopConnection.findOne({ userId, isActive: true });
    if (!connection) {
      errorResponse(res, 'Whop not connected. Please connect first.', 400);
      return;
    }

    // ✅ MULTI-TENANT: Get user's company ID for proper tenant isolation
    const user = await User.findById(userId);
    if (!user || !user.whopCompanyId) {
      errorResponse(res, 'User company information not found', 400);
      return;
    }

    const userCompanyId = user.whopCompanyId;
    console.log(`Starting Whop sync for user: ${userId}, company: ${userCompanyId}`);

    // ✅ MULTI-TENANT: Fetch members from user's company (not hardcoded company)
    const membersData = await whopService.getMemberships(userCompanyId);
    const members = membersData.data || [];

    console.log(`Found ${members.length} members from Whop for company: ${userCompanyId}`);

    // Fetch payments from Whop
    let payments: any[] = [];
    try {
      const paymentsData = await whopService.getPayments(userCompanyId);
      payments = paymentsData.data || [];
      console.log(`Found ${payments.length} payments from Whop for company: ${userCompanyId}`);
    } catch (err) {
      console.log('Could not fetch payments, continuing without payment data');
    }

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let leadsMatchedCount = 0;
    let totalRevenue = 0;

    // Process each member
    for (const member of members) {
      // Get member ID outside try block so it's accessible in error handler
      const memberId = (member as any).id || '';

      try {
        // Log the full member object for debugging
        console.log('📦 Member data:', JSON.stringify(member, null, 2));

        // Get user details - members API returns user data directly
        let userName = 'Unknown';
        let userEmail = '';

        // Extract user info from member (members API structure)
        if ((member as any).user) {
          const user: any = (member as any).user;
          console.log('👤 User object:', JSON.stringify(user, null, 2));
          console.log('👤 Available user fields:', Object.keys(user));

          // Extract email - try multiple possible field names
          userEmail = user.email || user.email_address || user.emailAddress || '';

          // Try multiple fields for username - prioritize real names over usernames
          userName = user.name || 
                    user.display_name || 
                    user.displayName ||
                    user.full_name ||
                    user.fullName ||
                    user.username || 
                    (userEmail ? userEmail.split('@')[0] : '') ||
                    `User ${user.id}`;

          // If we still don't have email, try to fetch from Whop API
          if (!userEmail && user.id) {
            try {
              const { whopService } = await import('../services/whopService.js');
              const whopUser = await whopService.getUser(user.id);
              userEmail = (whopUser as any).email || (whopUser as any).email_address || '';
              if (!userName || userName.startsWith('User ')) {
                userName = (whopUser as any).name || 
                          (whopUser as any).display_name ||
                          (whopUser as any).username ||
                          userName;
              }
              console.log(`📧 Fetched email from Whop API: "${userEmail}"`);
            } catch (fetchError) {
              console.warn(`⚠️  Could not fetch user details from Whop API for user ${user.id}:`, fetchError);
            }
          }

          console.log(`📧 Extracted email: "${userEmail}"`);
          console.log(`👤 Extracted username: "${userName}"`);
          console.log(`✅ Processing user: ${userName} (${userEmail})`);
        } else {
          // User is null - member has no associated user account (license/anonymous purchase)
          console.log('⚠️  Member user field is null - creating name from member info');
          console.log('💡 This member has no associated user account (license key or anonymous purchase)');

          // Create a descriptive name using member ID and join date
          const joinDate = new Date((member as any).joined_at || (member as any).created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const companyName = (member as any).company?.title || 'paveOS';
          userName = `${companyName} Member (${joinDate})`;

          console.log(`✅ Created name for anonymous member: ${userName}`);
        }

        // Calculate payment amount - use member's usd_total_spent
        const paymentAmount = (member as any).usd_total_spent || 0;
        totalRevenue += paymentAmount;

        // Check if contact already exists
        const existingContact = await Contact.findOne({
          userId,
          $or: [
            { whopMembershipId: memberId },
            ...(userEmail ? [{ email: userEmail }] : []),
          ],
        });

        // Get company name from member data
        const companyName = (member as any).company?.title || 'Whop Customer';
        const memberStatus = (member as any).status || 'joined';

        const contactData = {
          userId,
          whopCompanyId: userCompanyId,  // ✅ Save company ID for tenant isolation
          name: userName,
          email: userEmail || '', // Leave empty if no email (Whop allows this for license members)
          phone: (member as any).phone || '', // Whop members may have phone
          company: companyName,
          position: 'Member',
          status: (memberStatus === 'joined') ? 'active' as const :
                  (memberStatus === 'left' || memberStatus === 'kicked' || memberStatus === 'banned') ? 'inactive' as const :
                  'prospect' as const,
          tags: ['Whop', companyName],
          notes: `Synced from Whop - Member ID: ${memberId}\nStatus: ${memberStatus}\nAccess Level: ${(member as any).access_level || 'customer'}`,
          whopMembershipId: memberId,
          whopMembershipStatus: memberStatus as any,
          whopPlan: companyName,
          whopJoinedAt: new Date((member as any).joined_at || (member as any).created_at),
          source: 'whop' as const,
          lastContact: new Date(),
        };

        let contact;
        if (existingContact) {
          // Update existing contact
          Object.assign(existingContact, contactData);
          await existingContact.save();
          contact = existingContact;
          updatedCount++;
          console.log('✅ Updated contact:', {
            name: contact.name,
            email: contact.email,
            whopMembershipId: contact.whopMembershipId
          });
        } else {
          // Create new contact
          contact = await Contact.create(contactData);
          createdCount++;
          console.log('✅ Created contact:', {
            name: contact.name,
            email: contact.email,
            whopMembershipId: contact.whopMembershipId
          });
        }

        // Try to match to existing lead or create new lead from Whop customer
        let matchedLead = null;

        // First check if lead already exists with this Whop member ID
        matchedLead = await Lead.findOne({
          userId,
          whopMembershipId: memberId,
        });

        // Match by Whop customer ID if not found
        if (!matchedLead && (member as any).user?.id) {
          matchedLead = await Lead.findOne({
            userId,
            whopCustomerId: (member as any).user.id,
          });
        }

        // Match by email if not found
        if (!matchedLead && userEmail) {
          matchedLead = await Lead.findOne({
            userId,
            email: userEmail.toLowerCase(),
          });
          if (matchedLead) {
            console.log(`🔍 Matched lead by email: ${userEmail}`);
          }
        }

        // If no existing lead found, create a new lead from Whop customer
        if (!matchedLead) {
          console.log(`📝 Creating new lead from Whop member: ${userName}`);
          matchedLead = await Lead.create({
            userId,
            whopCompanyId: userCompanyId,  // ✅ Save company ID for tenant isolation
            contactId: contact._id.toString(),
            name: userName,
            email: userEmail || undefined,
            source: 'whop',
            status: 'won', // Whop members are already paying customers
            tags: ['Whop Customer', companyName],
            notes: `Customer synced from Whop\nMember ID: ${memberId}\nJoined: ${new Date((member as any).joined_at || (member as any).created_at).toLocaleDateString()}`,
            whopMembershipId: memberId,
            whopCustomerId: ((member as any).user as any)?.id || undefined,
            actualValue: paymentAmount || 0,
            estimatedValue: paymentAmount || 0,
            wonAt: new Date((member as any).joined_at || (member as any).created_at),
            lastContactDate: new Date(),
          });
          leadsMatchedCount++;
          console.log(`✅ Created new lead:`, {
            name: matchedLead.name,
            email: matchedLead.email,
            actualValue: matchedLead.actualValue,
            whopMembershipId: matchedLead.whopMembershipId
          });
        } else {
          // Update existing lead to won status
          const wasAlreadyWon = matchedLead.status === 'won';

          matchedLead.status = 'won';
          matchedLead.whopMembershipId = memberId;
          matchedLead.whopCustomerId = ((member as any).user as any)?.id || undefined;
          matchedLead.actualValue = paymentAmount || matchedLead.estimatedValue || 0;
          matchedLead.contactId = contact._id.toString();

          if (!matchedLead.wonAt) {
            matchedLead.wonAt = new Date((member as any).joined_at || (member as any).created_at);
          }

          // Add Whop tags if not present
          if (!matchedLead.tags.includes('Whop Customer')) {
            matchedLead.tags.push('Whop Customer');
          }
          if (!matchedLead.tags.includes(companyName)) {
            matchedLead.tags.push(companyName);
          }

          await matchedLead.save();

          if (!wasAlreadyWon) {
            leadsMatchedCount++;
            console.log(`✅ Updated lead to won: ${matchedLead.name} - $${matchedLead.actualValue}`);
          } else {
            console.log(`✅ Refreshed existing won lead: ${matchedLead.name}`);
          }
        }

        // Track telemetry for new conversions
        if (matchedLead && matchedLead.status === 'won') {
          await TelemetryEvent.create({
            userId,
            eventType: 'deal_won',
            eventData: {
              leadId: matchedLead._id,
              leadName: matchedLead.name,
              value: matchedLead.actualValue,
              source: 'whop_sync',
            },
          });
        }

        // Create payment record if there's payment data
        if (matchedLead && paymentAmount > 0) {
          const existingPayment = await Payment.findOne({
            userId,
            whopPaymentId: memberId,
          });

          if (!existingPayment) {
            await Payment.create({
              userId,
              leadId: matchedLead._id.toString(),
              amount: paymentAmount,
              currency: 'usd',
              paymentStatus: 'paid',
              method: 'whop',
              whopPaymentId: memberId,
              paidDate: new Date((member as any).joined_at || (member as any).created_at),
              dueDate: new Date(),
              notes: `Whop member: ${companyName}`,
            });
            console.log(`💰 Created payment record: $${paymentAmount}`);
          }
        }
      } catch (error) {
        console.error('Error processing member:', memberId, error);
        skippedCount++;
      }
    }

    // Update connection sync status
    connection.lastSyncAt = new Date();
    connection.syncedCustomersCount = createdCount + updatedCount;
    await connection.save();

    console.log('Whop sync completed:', {
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
      leadsMatched: leadsMatchedCount,
      totalRevenue,
    });

    successResponse(res, {
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
      leadsMatched: leadsMatchedCount,
      totalRevenue,
      total: members.length,
      lastSyncAt: connection.lastSyncAt,
    }, `Successfully synced ${createdCount + updatedCount} customers from Whop. ${leadsMatchedCount} leads marked as won.`);
  } catch (error: any) {
    console.error('Whop sync error:', error);
    errorResponse(res, error.message || 'Failed to sync Whop customers', 500);
  }
};

export default {
  getConnectionStatus,
  connectWhop,
  disconnectWhop,
  syncWhopCustomers,
};
