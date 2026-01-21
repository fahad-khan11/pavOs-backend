import { Response } from 'express';
import { AuthRequest } from '../types/index.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { Lead, TelemetryEvent } from '../models/index.js';
import { CONSTANTS } from '../config/constants.js';

/**
 * Create a lead in Whop and save to local DB
 * POST /api/v1/leads
 * 
 * Request body:
 * {
 *   "email": "john@example.com",
 *   "name": "John Doe",
 *   "productId": "prod_xxx" (optional),
 *   "referrer": "https://..." (optional),
 *   "metadata": {} (optional)
 * }
 */
export const createLead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whopCompanyId = req.whopCompanyId!;
    const whopUserId = req.whopUserId!;
    const { email, name, productId, referrer, metadata } = req.body;

    // Validate required fields
    if (!email || !name) {
      errorResponse(res, 'Email and name are required', 400);
      return;
    }

    console.log(`📝 Creating lead in Whop for company ${whopCompanyId}:`, { email, name });

    // Call Whop Leads API directly via HTTP
    // The SDK doesn't expose the leads endpoint yet, so we use fetch
    const whopResponse = await fetch('https://api.whop.com/api/v1/leads', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONSTANTS.WHOP_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        company_id: whopCompanyId,
        product_id: productId || undefined,
        referrer: referrer || undefined,
        metadata: metadata || {},
      }),
    });

    if (!whopResponse.ok) {
      const error: any = await whopResponse.json();
      console.error('Whop API Error:', error);
      throw new Error(error.message || 'Failed to create lead in Whop');
    }

    const whopLead: any = await whopResponse.json();
    console.log(`✅ Lead created in Whop: ${whopLead.id}`);

    // Save lead to local DB
    const savedLead = await Lead.create({
      whopLeadId: whopLead.id,
      whopCompanyId,
      whopUserId,
      email: whopLead.user?.email || email,
      name: whopLead.user?.name || name,
      username: whopLead.user?.username,
      productId: whopLead.product?.id || productId,
      productTitle: whopLead.product?.title,
      referrer: whopLead.referrer,
      metadata: whopLead.metadata || metadata || {},
      memberId: whopLead.member?.id,
      whopCreatedAt: new Date(whopLead.created_at),
      whopUpdatedAt: new Date(whopLead.updated_at),
      status: 'new',
    });

    console.log(`💾 Lead saved to DB: ${savedLead._id}`);

    // Track telemetry event
    await TelemetryEvent.create({
      userId: whopUserId,
      whopCompanyId,
      eventType: 'lead_created',
      eventData: {
        whopLeadId: whopLead.id,
        email,
        name,
        productId,
      },
    }).catch((err) => console.error('Telemetry error:', err));

    successResponse(
      res,
      {
        id: savedLead._id,
        whopLeadId: savedLead.whopLeadId,
        email: savedLead.email,
        name: savedLead.name,
        status: savedLead.status,
        createdAt: savedLead.createdAt,
      },
      'Lead created successfully',
      201
    );
  } catch (error: any) {
    console.error('Failed to create lead:', error);
    const message = error.message || 'Failed to create lead';
    errorResponse(res, message, error.status || 500);
  }
};

/**
 * Get all leads for company - COMBINED from Whop API + Local DB
 * GET /api/v1/leads
 * 
 * Fetches from both Whop API (real-time) and MongoDB (local status/metadata)
 * Merges data for complete view
 */
export const getLeads = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whopCompanyId = req.whopCompanyId!;
    const { status, skip = 0, limit = 20 } = req.query;

    console.log(`📋 Fetching leads for company ${whopCompanyId}...`);

    // 🔄 PARALLEL: Fetch from both sources simultaneously
    const [whopLeads, dbLeads] = await Promise.all([
      // 1️⃣ Fetch from Whop API (official endpoint)
      fetchFromWhopAPI(whopCompanyId).catch((err) => {
        console.error('⚠️  Whop API error:', err.message);
        return []; // Fallback to empty if Whop fails
      }),
      // 2️⃣ Fetch from Local Database
      fetchFromDatabase(whopCompanyId, status, skip, limit),
    ]);

    console.log(`✅ Whop API returned ${whopLeads.length} leads`);
    console.log(`✅ Database has ${dbLeads.length} leads`);

    // 3️⃣ MERGE: Combine Whop data with local DB data
    const mergedLeads = mergeLeadData(whopLeads, dbLeads);

    // 4️⃣ SORT & PAGINATE: Apply sorting and pagination
    const sortedLeads = mergedLeads
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(Number(skip), Number(skip) + Number(limit));

    const total = mergedLeads.length;

    console.log(`📦 Returning ${sortedLeads.length} merged leads to frontend`);

    successResponse(res, {
      leads: sortedLeads,
      source: {
        whop: whopLeads.length,
        database: dbLeads.length,
        merged: mergedLeads.length,
      },
      pagination: {
        page: Math.floor(Number(skip) / Number(limit)) + 1,
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch leads:', error);
    errorResponse(res, error.message || 'Failed to fetch leads', 500);
  }
};

/**
 * Fetch leads from Whop API (official endpoint)
 */
async function fetchFromWhopAPI(companyId: string): Promise<any[]> {
  try {
    const whopResponse = await fetch('https://api.whop.com/api/v1/leads', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CONSTANTS.WHOP_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!whopResponse.ok) {
      throw new Error(`Whop API error: ${whopResponse.status}`);
    }

    const data: any = await whopResponse.json();
    
    // Filter to only this company's leads
    const leads = Array.isArray(data.data) ? data.data : data.data?.leads || [];
    return leads.filter((lead: any) => lead.company_id === companyId);
  } catch (error: any) {
    console.error('Whop API fetch error:', error.message);
    throw error;
  }
}

/**
 * Fetch leads from local MongoDB database
 */
async function fetchFromDatabase(
  companyId: string,
  status: any,
  skip: any,
  limit: any
): Promise<any[]> {
  try {
    const query: any = { whopCompanyId: companyId };
    if (status) query.status = status;

    const leads = await Lead.find(query)
      .sort({ createdAt: -1 })
      .lean(); // Use lean() for performance

    return leads.map((lead: any) => lead.toJSON());
  } catch (error: any) {
    console.error('Database fetch error:', error.message);
    return [];
  }
}

/**
 * MERGE: Combine Whop API data with local DB data
 * 
 * Priority: Local DB data takes precedence for status/metadata
 * Fills in Whop data for missing fields
 */
function mergeLeadData(whopLeads: any[], dbLeads: any[]): any[] {
  // Create a map of DB leads by whopLeadId for O(1) lookup
  const dbLeadsMap = new Map();
  dbLeads.forEach((lead: any) => {
    dbLeadsMap.set(lead.whopLeadId, lead);
  });

  // Merge: For each Whop lead, combine with DB data if exists
  const merged = whopLeads.map((whopLead: any) => {
    const dbLead = dbLeadsMap.get(whopLead.id);

    if (dbLead) {
      // 🔀 Combine: Use DB status/metadata, but update with latest Whop data
      return {
        id: dbLead.id, // MongoDB ID (for updates)
        whopLeadId: whopLead.id,
        whopCompanyId: whopLead.company_id,
        email: whopLead.user?.email || dbLead.email,
        name: whopLead.user?.name || dbLead.name,
        username: whopLead.user?.username || dbLead.username,
        productId: whopLead.product?.id || dbLead.productId,
        productTitle: whopLead.product?.title || dbLead.productTitle,
        referrer: whopLead.referrer || dbLead.referrer,
        // LOCAL STATUS & METADATA (highest priority)
        status: dbLead.status || 'new', // From local DB
        metadata: { ...whopLead.metadata, ...dbLead.metadata }, // Merge both
        memberId: whopLead.member?.id || dbLead.memberId,
        // Timestamps
        whopCreatedAt: whopLead.created_at,
        whopUpdatedAt: whopLead.updated_at,
        localCreatedAt: dbLead.createdAt,
        localUpdatedAt: dbLead.updatedAt,
        source: 'both', // Indicates merged from both sources
      };
    } else {
      // Lead in Whop but not in our DB - create minimal record
      return {
        id: null, // No local DB record
        whopLeadId: whopLead.id,
        whopCompanyId: whopLead.company_id,
        email: whopLead.user?.email,
        name: whopLead.user?.name,
        username: whopLead.user?.username,
        productId: whopLead.product?.id,
        productTitle: whopLead.product?.title,
        referrer: whopLead.referrer,
        status: 'new',
        metadata: whopLead.metadata || {},
        memberId: whopLead.member?.id,
        whopCreatedAt: whopLead.created_at,
        whopUpdatedAt: whopLead.updated_at,
        localCreatedAt: null,
        localUpdatedAt: null,
        source: 'whop_only', // Indicates only in Whop
      };
    }
  });

  // Also add DB-only leads (leads in our DB but not in Whop - shouldn't happen but safety check)
  const dbOnlyLeads = dbLeads.filter((dbLead: any) => 
    !whopLeads.find((w: any) => w.id === dbLead.whopLeadId)
  );

  dbOnlyLeads.forEach((lead: any) => {
    merged.push({
      ...lead,
      source: 'db_only', // Indicates only in our DB
    });
  });

  return merged;
}

export default {
  createLead,
  getLeads,
};
