import { Response, NextFunction } from 'express';
import { AuthRequest } from './authenticate.js';

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401);
      return next(new Error('Not authorized, no user found'));
    }
    
    if (!roles.includes(req.user.role)) {
      res.status(403);
      return next(new Error(`User role ${req.user.role} is not authorized to access this route`));
    }
    
    next();
  };
};
