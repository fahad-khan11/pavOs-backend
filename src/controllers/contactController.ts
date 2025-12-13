import { Response } from 'express';
import { Contact, Activity } from '../models/index.js';
import { AuthRequest } from '../types/index.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';

/**
 * Get all contacts with search and filters
 * GET /api/v1/contacts?search=&status=&page=1&limit=20
 */
export const getAllContacts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { search, status, page = 1, limit = 20 } = req.query;

    // Build query
    const query: any = { userId };

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
 */
export const getContactById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const contact = await Contact.findOne({ _id: id, userId });

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
 */
export const createContact = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const contactData = req.body;

    // Create contact
    const contact = await Contact.create({
      ...contactData,
      userId,
    });

    // Log activity
    await Activity.create({
      userId,
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
 */
export const updateContact = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const updates = req.body;

    const contact = await Contact.findOneAndUpdate(
      { _id: id, userId },
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
 */
export const deleteContact = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const contact = await Contact.findOneAndDelete({ _id: id, userId });

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
