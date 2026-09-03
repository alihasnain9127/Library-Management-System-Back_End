import { Request, Response } from 'express';
import { User } from '../models/User.js';

export const getUsers = async (req: Request, res: Response) => {
  const users = await User.find({}).select('-password');
  res.json({
    success: true,
    data: users
  });
};

export const suspendUser = async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (user.role === 'admin') {
    res.status(403);
    throw new Error('Cannot suspend an administrator account');
  }

  const { isSuspended, suspensionReason, suspensionEndDate } = req.body;

  if (isSuspended) {
    // Suspension flow
    if (!suspensionReason || typeof suspensionReason !== 'string' || suspensionReason.trim().length === 0) {
      res.status(400);
      throw new Error('A suspension reason is required when suspending a user');
    }

    const trimmedReason = suspensionReason.trim();

    // Check if user was previously suspended for the same reason (repeat offender escalation)
    const isRepeatOffense = user.suspensionReasons.some(
      (r) => r.toLowerCase() === trimmedReason.toLowerCase()
    );

    let finalEndDate: Date | null = null;
    if (suspensionEndDate) {
      const parsedDate = new Date(suspensionEndDate);
      if (isNaN(parsedDate.getTime()) || parsedDate <= new Date()) {
        res.status(400);
        throw new Error('suspensionEndDate must be a valid future date');
      }
      finalEndDate = parsedDate;

      // If repeat offense, double the suspension duration
      if (isRepeatOffense) {
        const now = new Date();
        const originalDurationMs = parsedDate.getTime() - now.getTime();
        finalEndDate = new Date(now.getTime() + originalDurationMs * 2);
      }
    }
    // If no suspensionEndDate provided → indefinite suspension (null)

    user.isSuspended = true;
    user.suspensionReasons.push(trimmedReason);
    user.suspensionDate = new Date();
    user.suspensionEndDate = finalEndDate;

    await user.save();

    res.json({
      success: true,
      message: `User suspended successfully${isRepeatOffense ? ' (repeat offense — duration escalated)' : ''}`,
      data: user
    });
  } else {
    // Unsuspension flow — preserve suspensionReasons for historical auditing
    user.isSuspended = false;
    user.suspensionEndDate = null;

    await user.save();

    res.json({
      success: true,
      message: 'User reactivated successfully',
      data: user
    });
  }
};

export const updateProfile = async (req: any, res: Response) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  const { name, phone, address } = req.body;

  // Validate required fields
  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    res.status(400);
    throw new Error('Name cannot be empty');
  }

  // Validate phone number format
  if (phone !== undefined && phone !== null && phone !== '') {
    const phoneRegex = /^\+?[0-9]{10,14}$/;
    if (!phoneRegex.test(phone)) {
      res.status(400);
      throw new Error('Invalid phone number format. Please use 10-14 digits with optional + prefix');
    }
  }

  // Update user data (allow empty string to clear field)
  if (name !== undefined) user.name = name.trim();
  if (phone !== undefined) user.phone = phone;
  if (address !== undefined) user.address = address;

  await user.save();

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      userId: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      address: user.address,
      profileImage: user.profileImage,
      isActive: user.isActive,
      isSuspended: user.isSuspended,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }
  });
};
