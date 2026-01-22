import { Response } from 'express';
import { AuthRequest } from '../types/index.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { Lead, TelemetryEvent } from '../models/index.js';
import { CONSTANTS } from '../config/constants.js';

export const createLead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whopCompanyId = req.whopCompanyId!;
    const whopUserId = req.whopUserId!;
    const { email, name, productId, referrer, metadata } = req.body;

    if (!email || !name) {
      errorResponse(res, 'Email and name are required', 400);
      return;
    }

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
      throw new Error(error.message || 'Failed to create lead in Whop');
    }

    const whopLead: any = await whopResponse.json();

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
    }).catch(() => {});

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
    errorResponse(res, error.message || 'Failed to create lead', error.status || 500);
  }
};

export const getLeads = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whopCompanyId = req.whopCompanyId!;
    const { status, skip = 0, limit = 20 } = req.query;

    const [whopLeads, dbLeads] = await Promise.all([
      fetchFromWhopAPI(whopCompanyId).catch(() => []),
      fetchFromDatabase(whopCompanyId, status, skip, limit),
    ]);

    const mergedLeads = mergeLeadData(whopLeads, dbLeads);

    const sortedLeads = mergedLeads
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(Number(skip), Number(skip) + Number(limit));

    const total = mergedLeads.length;

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

async function fetchFromWhopAPI(companyId: string): Promise<any[]> {
  try {
    const url = new URL('https://api.whop.com/api/v1/leads');
    url.searchParams.set('company_id', companyId);

    const whopResponse = await fetch(url.toString(), {
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
    const leads = Array.isArray(data.data) ? data.data : data.data?.leads || [];
    return leads;
  } catch (error: any) {
    console.error('Whop API error:', error.message);
    throw error;
  }
}

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
      .lean();

    return leads.map((lead: any) => lead.toJSON());
  } catch (error: any) {
    console.error('Database error:', error.message);
    return [];
  }
}

function mergeLeadData(whopLeads: any[], dbLeads: any[]): any[] {
  const dbLeadsMap = new Map();
  dbLeads.forEach((lead: any) => {
    dbLeadsMap.set(lead.whopLeadId, lead);
  });

  const merged = whopLeads.map((whopLead: any) => {
    const dbLead = dbLeadsMap.get(whopLead.id);

    if (dbLead) {
      return {
        id: dbLead.id,
        whopLeadId: whopLead.id,
        whopCompanyId: whopLead.company_id,
        email: whopLead.user?.email || dbLead.email,
        name: whopLead.user?.name || dbLead.name,
        username: whopLead.user?.username || dbLead.username,
        productId: whopLead.product?.id || dbLead.productId,
        productTitle: whopLead.product?.title || dbLead.productTitle,
        referrer: whopLead.referrer || dbLead.referrer,
        status: dbLead.status || 'new',
        metadata: { ...whopLead.metadata, ...dbLead.metadata },
        memberId: whopLead.member?.id || dbLead.memberId,
        whopCreatedAt: whopLead.created_at,
        whopUpdatedAt: whopLead.updated_at,
        localCreatedAt: dbLead.createdAt,
        localUpdatedAt: dbLead.updatedAt,
        source: 'both',
      };
    } else {
      return {
        id: null,
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
        source: 'whop_only',
      };
    }
  });

  const dbOnlyLeads = dbLeads.filter((dbLead: any) => 
    !whopLeads.find((w: any) => w.id === dbLead.whopLeadId)
  );

  dbOnlyLeads.forEach((lead: any) => {
    merged.push({
      ...lead,
      source: 'db_only',
    });
  });

  return merged;
}

export default {
  createLead,
  getLeads,
};
