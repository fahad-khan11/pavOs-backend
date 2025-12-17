import { Response } from 'express';
import { Contact, Activity, User } from '../models/index.js';
import { AuthRequest } from '../types/index.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';

/**
 * Get all contacts with search and filters
 * GET /api/v1/contacts?search=&status=&page=1&limit=20
 * 
 * ✅ REFACTORED: Uses whopCompanyId for tenant isolation
 */
export const getAllContacts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whopCompanyId = req.whopCompanyId!;
    const { search, status, page = 1, limit = 20 } = req.query;

    // ✅ REFACTORED: Build query with whopCompanyId (strict tenant boundary)
    const query: any = { whopCompanyId };

    // Search by name, email, or company
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
      ];
    }

    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    }

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Get contacts
    const contacts = await Contact.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Get total count
    const total = await Contact.countDocuments(query);

    paginatedResponse(res, contacts, pageNum, limitNum, total);
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to fetch contacts', 500);
  }
};

/**
 * Get contact by ID
 * GET /api/v1/contacts/:id
 * 
 * ✅ REFACTORED: Uses whopCompanyId for tenant isolation
 */
export const getContactById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whopCompanyId = req.whopCompanyId!;
    const { id } = req.params;

    // ✅ REFACTORED: Filter by whopCompanyId for security
    const contact = await Contact.findOne({ _id: id, whopCompanyId });

    if (!contact) {
      errorResponse(res, 'Contact not found', 404);
      return;
    }

    successResponse(res, contact.toJSON());
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to fetch contact', 500);
  }
};

/**
 * Create new contact
 * POST /api/v1/contacts
 * 
 * ✅ REFACTORED: Uses whopCompanyId and whopUserId
 */
export const createContact = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whopUserId = req.whopUserId!;
    const whopCompanyId = req.whopCompanyId!;
    const contactData = req.body;

    // ✅ REFACTORED: Resolve internal userId from Whop identifiers
    const user = await (User as any).findByWhopIdentifiers(whopUserId, whopCompanyId);
    if (!user) {
      errorResponse(res, 'User not found', 404);
      return;
    }

    // Create contact with whopCompanyId
    const contact = await Contact.create({
      ...contactData,
      userId: user._id.toString(),
      whopCompanyId,
    });

    // Log activity
    await Activity.create({
      userId: user._id.toString(),
      whopCompanyId,
      type: 'contact_created',
      title: 'Contact Created',
      description: `Created contact: ${contact.name}`,
      relatedEntityType: 'contact',
      relatedEntityId: contact._id.toString(),
    });

    successResponse(res, contact.toJSON(), 'Contact created successfully', 201);
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to create contact', 500);
  }
};

/**
 * Update contact
 * PUT /api/v1/contacts/:id
 * 
 * ✅ REFACTORED: Uses whopCompanyId for tenant isolation
 */
export const updateContact = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whopCompanyId = req.whopCompanyId!;
    const { id } = req.params;
    const updates = req.body;

    // ✅ REFACTORED: Filter by whopCompanyId for security
    const contact = await Contact.findOneAndUpdate(
      { _id: id, whopCompanyId },
      updates,
      { new: true, runValidators: true }
    );

    if (!contact) {
      errorResponse(res, 'Contact not found', 404);
      return;
    }

    successResponse(res, contact.toJSON(), 'Contact updated successfully');
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to update contact', 500);
  }
};

/**
 * Delete contact
 * DELETE /api/v1/contacts/:id
 * 
 * ✅ REFACTORED: Uses whopCompanyId for tenant isolation
 */
export const deleteContact = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whopCompanyId = req.whopCompanyId!;
    const { id } = req.params;

    // ✅ REFACTORED: Filter by whopCompanyId for security
    const contact = await Contact.findOneAndDelete({ _id: id, whopCompanyId });

    if (!contact) {
      errorResponse(res, 'Contact not found', 404);
      return;
    }

    successResponse(res, null, 'Contact deleted successfully');
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to delete contact', 500);
  }
};

export default {
  getAllContacts,
  getContactById,
  createContact,
  updateContact,
  deleteContact,
};
