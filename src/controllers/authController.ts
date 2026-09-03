import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { config } from '../config/environment.js';

const generateToken = (id: string): string => {
  return jwt.sign({ id }, config.jwt.secret, {
    expiresIn: config.jwt.accessExpirationDays as any,
  });
};

const generateRefreshToken = (id: string): string => {
  return jwt.sign({ id }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpirationDays as any,
  });
};

export const register = async (req: Request, res: Response) => {
  const { name, email, password, phone } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(409);
    throw new Error('Email already exists');
  }

  const user = await User.create({
    name,
    email,
    password,
    phone
  });

  if (user) {
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        userId: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (user && (await user.comparePassword(password))) {
    if (!user.isActive) {
      res.status(403);
      throw new Error('Account is inactive');
    }

    // Suspension check with automatic unsuspension for expired time-limited suspensions
    if (user.isSuspended) {
      if (user.suspensionEndDate && new Date(user.suspensionEndDate) <= new Date()) {
        // Suspension period has expired — auto-unsuspend
        user.isSuspended = false;
        user.suspensionEndDate = null;
        await user.save();
        // Proceed with login after auto-unsuspension
      } else {
        // Still suspended — block login with detailed info
        res.status(403).json({
          success: false,
          message: 'Your account is currently suspended',
          suspensionDetails: {
            suspensionReasons: user.suspensionReasons,
            suspensionDate: user.suspensionDate,
            suspensionEndDate: user.suspensionEndDate || null,
            isIndefinite: !user.suspensionEndDate
          }
        });
        return;
      }
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(String(user._id));
    const refreshToken = generateRefreshToken(String(user._id));

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        refreshToken,
        user: {
          userId: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          address: user.address,
          profileImage: user.profileImage,
          isActive: user.isActive,
          isSuspended: user.isSuspended,
          suspensionReasons: user.suspensionReasons,
          suspensionEndDate: user.suspensionEndDate
        },
        expiresIn: 3600
      },
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(401);
    throw new Error('Invalid credentials');
  }
};

export const getMe = async (req: any, res: Response) => {
  const user = await User.findById(req.user._id).select('-password');
  if (user) {
    res.json({
      success: true,
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
  } else {
    res.status(404);
    throw new Error('User not found');
  }
};
