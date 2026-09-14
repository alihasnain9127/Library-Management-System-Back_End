import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Category, STANDARD_CATEGORIES } from '../models/Category.js';

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

/**
 * Get all available categories (standard built-in categories + custom categories from DB)
 */
export const getCategories = async (_req: Request, res: Response): Promise<void> => {
  try {
    let customNames: string[] = [];
    if (mongoose.connection.readyState === 1) {
      const customDocs = await Category.find().sort({ name: 1 }).lean();
      customNames = customDocs.map((c) => c.name);
    }

    const seenLower = new Set<string>();
    const combined: string[] = [];

    // Add standard categories first
    for (const cat of STANDARD_CATEGORIES) {
      const lower = cat.toLowerCase();
      if (!seenLower.has(lower)) {
        seenLower.add(lower);
        combined.push(cat);
      }
    }

    // Append any custom categories saved in DB
    for (const name of customNames) {
      const lower = name.toLowerCase();
      if (!seenLower.has(lower)) {
        seenLower.add(lower);
        combined.push(name);
      }
    }

    res.json({
      success: true,
      data: combined,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch categories',
    });
  }
};

/**
 * Create a new custom category
 */
export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({
        success: false,
        message: 'Category name is required',
      });
      return;
    }

    const trimmed = name.trim();

    if (trimmed.length < 2 || trimmed.length > 50) {
      res.status(400).json({
        success: false,
        message: 'Category name must be between 2 and 50 characters',
      });
      return;
    }

    // Check against standard categories
    const isStandard = STANDARD_CATEGORIES.some(
      (c) => c.toLowerCase() === trimmed.toLowerCase()
    );
    if (isStandard) {
      res.status(409).json({
        success: false,
        message: `"${trimmed}" already exists as a standard category`,
      });
      return;
    }

    // Check against custom categories in DB
    const existing = await Category.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(trimmed)}$`, 'i') },
    });

    if (existing) {
      res.status(409).json({
        success: false,
        message: `Category "${trimmed}" already exists`,
      });
      return;
    }

    const created = await Category.create({
      name: trimmed,
      isStandard: false,
    });

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: {
        _id: created._id,
        name: created.name,
        isStandard: created.isStandard,
      },
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({
        success: false,
        message: 'Category already exists',
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create category',
    });
  }
};
