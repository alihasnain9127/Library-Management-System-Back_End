import express from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { register, login, getMe } from '../controllers/authController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authLimiter, passwordResetLimiter, tokenRefreshLimiter } from '../middleware/rateLimiter.js';
import { config } from '../config/environment.js';

const router = express.Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', authenticate, (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
    });
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
    });
    res.status(200).json({
        status: 'success',
        message: 'Logged out successfully',
        timestamp: new Date().toISOString()
    });
});
router.get('/me', authenticate, getMe);

router.post('/password-reset-request', passwordResetLimiter, async (req: any, res: any) => {
    const { email } = req.body;
    const user = await User.findOne({ email });
    res.status(200).json({
        status: 'success',
        message: user
            ? 'If an account with that email exists, a password reset link has been sent.'
            : 'If an account with that email exists, a password reset link has been sent.',
        timestamp: new Date().toISOString()
    });
});

router.post('/password-reset', passwordResetLimiter, async (req: any, res: any) => {
    const { token, newPassword } = req.body;
    try {
        const decoded: any = jwt.verify(token, config.jwt.secret);
        const user = await User.findById(decoded.id);
        if (!user) {
            res.status(400);
            throw new Error('Invalid or expired reset token');
        }
        user.password = newPassword;
        await user.save();
        res.status(200).json({
            status: 'success',
            message: 'Password reset successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        res.status(400);
        throw new Error('Invalid or expired reset token');
    }
});

router.post('/token/refresh', tokenRefreshLimiter, async (req: any, res: any) => {
    const { refreshToken } = req.body;
    try {
        const decoded: any = jwt.verify(refreshToken, config.jwt.refreshSecret);
        const user = await User.findById(decoded.id).select('-password');
        if (!user || !user.isActive) {
            res.status(401);
            throw new Error('Invalid refresh token');
        }

        // Suspension check with auto-unsuspension
        if (user.isSuspended) {
            if (user.suspensionEndDate && new Date(user.suspensionEndDate) <= new Date()) {
                user.isSuspended = false;
                user.suspensionEndDate = null;
                await user.save();
            } else {
                return res.status(403).json({
                    success: false,
                    message: 'Your account is currently suspended',
                    suspensionDetails: {
                        suspensionReasons: user.suspensionReasons,
                        suspensionDate: user.suspensionDate,
                        suspensionEndDate: user.suspensionEndDate || null,
                        isIndefinite: !user.suspensionEndDate
                    }
                });
            }
        }

        const newAccessToken = jwt.sign(
            { id: user._id },
            config.jwt.secret,
            { expiresIn: config.jwt.accessExpirationDays as any }
        );
        const newRefreshToken = jwt.sign(
            { id: user._id },
            config.jwt.refreshSecret,
            { expiresIn: config.jwt.refreshExpirationDays as any }
        );
        res.status(200).json({
            status: 'success',
            message: 'Token refreshed successfully',
            data: {
                token: newAccessToken,
                refreshToken: newRefreshToken,
                expiresIn: 3600
            },
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        res.status(401);
        throw new Error('Invalid or expired refresh token');
    }
});

export default router;
