import { Whop } from '@whop/sdk';
import { CONSTANTS } from '../config/constants.js';

class WhopService {
  public whop: InstanceType<typeof Whop>; // Make public so controller can access members API

  constructor() {
    // Initialize Whop SDK with API key and App ID
    this.whop = new Whop({
      apiKey: CONSTANTS.WHOP_API_KEY || '',
      appID: CONSTANTS.WHOP_APP_ID || '',
    });

    // Log initialization for debugging (first 10 chars only)
    console.log('Whop Service initialized with API key:', CONSTANTS.WHOP_API_KEY?.substring(0, 10) + '...');
    console.log('Whop App ID:', CONSTANTS.WHOP_APP_ID);
    // Note: Company ID is now dynamic per user (multi-tenant)
  }

  /**
   * Test API connection
   * @param companyId - The company ID to test connection with
   */
  async testConnection(companyId: string) {
    try {
      console.log('Testing Whop API connection for company:', companyId);

      // Try to get company info
      const company = await this.whop.companies.retrieve(companyId);
      console.log('Whop API Response - Company:', company);
      return company;
    } catch (error: any) {
      console.error('Whop API Error Details:', {
        message: error.message,
        status: error.status,
        body: error.body,
      });
      throw error;
    }
  }

  /**
   * Get company/business information
   * ✅ MULTI-TENANT: Now accepts companyId parameter
   */
  async getCompanyInfo(companyId: string) {
    try {
      const company = await this.whop.companies.retrieve(companyId);
      return company;
    } catch (error: any) {
      console.error('Whop API Error - Get Company:', error.message);
      throw new Error('Failed to fetch company information from Whop');
    }
  }

  /**
   * Get all members (customers) for the company
   * Using members.list instead of memberships.list to get user data directly
   * ✅ MULTI-TENANT: Now accepts companyId parameter for proper tenant isolation
   */
  async getMemberships(companyId: string) {
    try {
      console.log('Fetching Whop members...');
      console.log('Company ID:', companyId);

      // Use the Whop SDK to list members (not memberships) with cursor-based pagination
      // This API returns user data directly embedded in the member object
      const members = [];
      for await (const member of this.whop.members.list({
        company_id: companyId,  // ✅ Dynamic company ID
      })) {
        members.push(member);
      }

      console.log(`Found ${members.length} members from Whop for company: ${companyId}`);
      return { data: members };
    } catch (error: any) {
      console.error('Whop API Error - Get Members:', {
        message: error.message,
        status: error.status,
        body: error.body,
        companyId,
      });

      // Return empty data instead of throwing to allow graceful handling
      console.log('Returning empty members due to error...');
      return { data: [] };
    }
  }

  /**
   * Get specific membership by ID
   */
  async getMembership(membershipId: string) {
    try {
      const membership = await this.whop.memberships.retrieve(membershipId);
      return membership;
    } catch (error: any) {
      console.error('Whop API Error - Get Membership:', error.message);
      throw new Error('Failed to fetch membership from Whop');
    }
  }

  /**
   * Get all products for the company
   * ✅ MULTI-TENANT: Now accepts companyId parameter
   */
  async getProducts(companyId: string) {
    try {
      const response = await this.whop.products.list({
        company_id: companyId,  // ✅ Dynamic company ID
      });
      return response;
    } catch (error: any) {
      console.error('Whop API Error - Get Products:', error.message);
      throw new Error('Failed to fetch products from Whop');
    }
  }

  /**
   * Get user information
   */
  async getUser(userId: string) {
    try {
      const user = await this.whop.users.retrieve(userId);
      return user;
    } catch (error: any) {
      console.error('Whop API Error - Get User:', error.message);
      throw new Error('Failed to fetch user from Whop');
    }
  }

  /**
   * Get authorized user information (includes role in company)
   * This fetches the team member's role for a specific company
   */
  async getAuthorizedUser(companyId: string, userId: string): Promise<{ id: string; role: string; user: any } | null> {
    try {
      // List all authorized users for the company
      const authorizedUsers = await this.whop.authorizedUsers.list({
        company_id: companyId,
      });

      // Find the authorized user matching the userId
      const authorizedUser = authorizedUsers.data.find((au: any) => au.user?.id === userId);
      
      if (authorizedUser) {
        console.log(`✅ Found authorized user role: ${authorizedUser.role} for user ${userId} in company ${companyId}`);
        return authorizedUser;
      }

      console.log(`⚠️  User ${userId} is not an authorized user in company ${companyId}`);
      return null;
    } catch (error: any) {
      console.error('Whop API Error - Get Authorized User:', {
        message: error.message,
        status: error.status,
        companyId,
        userId,
      });
      // Return null instead of throwing to allow graceful degradation
      return null;
    }
  }

  /**
   * Get payment information for the company
   * ✅ MULTI-TENANT: Now accepts companyId parameter
   */
  async getPayments(companyId: string, first = 100) {
    try {
      const payments = [];
      for await (const payment of this.whop.payments.list({
        company_id: companyId,  // ✅ Dynamic company ID
        first,
      })) {
        payments.push(payment);
      }
      return { data: payments };
    } catch (error: any) {
      console.error('Whop API Error - Get Payments:', error.message);
      return { data: [] };
    }
  }

  async getSupportChannel(userId: string, companyId: string) {
    try {
      const channels = await this.whop.supportChannels.list({
        company_id: companyId,  // ✅ Dynamic company ID
      });
      const userChannel = channels.data.find((ch: any) => ch.user_id === userId);
      return userChannel || null;
    } catch (error: any) {
      console.error('Whop API Error - Get Support Channel:', error.message);
      throw error;
    }
  }

  async createSupportChannel(userId: string, companyId: string) {
    try {
      const channel = await this.whop.supportChannels.create({
        user_id: userId,
        company_id: companyId,  // ✅ Dynamic company ID
      });
      return channel;
    } catch (error: any) {
      console.error('Whop API Error - Create Support Channel:', error.message);
      throw error;
    }
  }
  async sendSupportMessage(channelId: string, message: string) {
    try {
      // Use the required payload shape for Whop's Messages API (GraphQL):
      // { support_channel_id: string, text: string }
      const payload = {
        support_channel_id: channelId,
        text: message,
      } as any;

      const response = await this.whop.messages.create(payload);
      console.log('✅ Whop message sent successfully to support channel', channelId);
      return response;
    } catch (error: any) {
      console.error('❌ Whop API Error - Send Support Message:', {
        message: error.message,
        status: error.status,
        body: error.body || error.response?.data || null,
      });
      throw error;
    }
  }
}

export const whopService = new WhopService();
export default whopService;
