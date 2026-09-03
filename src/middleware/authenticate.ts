import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment.js';
import { User, IUser } from '../models/User.js';

export interface AuthRequest extends Request {
  user?: IUser;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    res.status(401);
    return next(new Error('Not authorized, no token'));
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as unknown as { id: string };
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      res.status(401);
      return next(new Error('Not authorized, user not found'));
    }

    if (!user.isActive) {
      res.status(403);
      return next(new Error('Account is inactive'));
    }

    // Suspension check with automatic unsuspension for expired time-limited suspensions
    if (user.isSuspended) {
      if (user.suspensionEndDate && new Date(user.suspensionEndDate) <= new Date()) {
        // Suspension period has expired — auto-unsuspend
        user.isSuspended = false;
        user.suspensionEndDate = null;
        await user.save();
        // Allow request to proceed after auto-unsuspension
      } else {
        // Still suspended — block access with detailed info
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

    req.user = user;
    next();
  } catch (error) {
    res.status(401);
    next(new Error('Not authorized, token failed'));
  }
};
