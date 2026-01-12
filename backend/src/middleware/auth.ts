import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    userId?: string;
    phone: string;
    role: string;
    isAdmin: boolean;
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Optimistic set from token
    req.user = {
      id: decoded.userId || decoded.id,
      userId: decoded.userId || decoded.id,
      phone: decoded.phone,
      role: Array.isArray(decoded.roles) ? decoded.roles[0] : decoded.role || 'user',
      isAdmin: decoded.roles?.includes?.('admin') || decoded.role === 'admin' || decoded.role === 'owner'
    };

    // Best-effort DB lookup to refresh user info, but do not fail if missing
    try {
      const { sharedSequelize } = await import('../config/database-integrated');
      const SharedUser = sharedSequelize.models.SharedUser as any;
      if (SharedUser && req.user?.id) {
        const user = await SharedUser.findByPk(req.user.id);
        if (user) {
          req.user = {
            id: user.id,
            userId: user.id,
            phone: user.phone,
            role: user.global_role || req.user.role,
            isAdmin: user.global_role === 'admin' || user.global_role === 'owner'
          };
        }
      }
    } catch (err) {
      console.warn('⚠️ [AUTH] DB lookup skipped:', (err as any)?.message || err);
    }

    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};
