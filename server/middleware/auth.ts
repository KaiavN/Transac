import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users } from '@shared/organizations';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { generateSecureToken } from '../utils/encryption';

// Session configuration
interface Session {
  id: string;
  userId: string;
  expiresAt: number;
  lastActivity: number;
  userAgent?: string;
  ipAddress?: string;
}

const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const INACTIVE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
export const sessions = new Map<string, Session>();

// Extend Express Request type to include user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        organizationId?: string;
        isBusinessAccount: boolean;
      };
    }
  }
}

/**
 * Authentication middleware
 * Checks for a valid session token and attaches the user to the request object
 */
// Create a new session
export const createSession = (userId: string, req?: Request): string => {
  const sessionId = generateSecureToken(32);
  const session: Session = {
    id: sessionId,
    userId,
    expiresAt: Date.now() + SESSION_DURATION,
    lastActivity: Date.now(),
    userAgent: req?.headers['user-agent'],
    ipAddress: req?.ip
  };
  sessions.set(sessionId, session);
  return sessionId;
};

// Clean up expired sessions
const cleanupSessions = () => {
  const now = Date.now();
  let cleanedCount = 0;
  // Use Array.from to convert Map entries to an array before iteration
  Array.from(sessions.entries()).forEach(([sessionId, session]) => {
    if (session.expiresAt < now || session.lastActivity + INACTIVE_TIMEOUT < now) {
      sessions.delete(sessionId);
      cleanedCount++;
    }
  });
  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} expired sessions`);
  }
};

// Run cleanup periodically
setInterval(cleanupSessions, 5 * 60 * 1000); // Every 5 minutes

// Enhanced authentication middleware with CORS support
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Add CORS headers with proper configuration
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.setHeader('Access-Control-Allow-Origin', clientUrl);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Origin, Accept, x-session-id, X-Requested-With, X-CSRF-Token');
    res.setHeader('Access-Control-Expose-Headers', 'Set-Cookie, x-session-id, X-Requested-With, X-CSRF-Token');
    res.setHeader('Vary', 'Origin, Accept-Encoding');
    res.setHeader('Access-Control-Max-Age', '86400');
  
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
  
    // Skip authentication for auth routes
    if (req.path.startsWith('/auth')) {
      return next();
    }
  
    // Check for session ID in cookies or headers with priority to cookies
    const sessionId = req.cookies?.['session-id'] || req.headers['x-session-id'];
    
    if (!sessionId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Ensure sessionId is a string
    const sessionIdStr = Array.isArray(sessionId) ? sessionId[0] : sessionId;

    const session = sessions.get(sessionIdStr);
    if (!session) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    
    if (session.expiresAt < Date.now()) {
      sessions.delete(sessionIdStr);
      return res.status(401).json({ error: 'Session expired' });
    }
    
    // Update last activity and extend session
    session.lastActivity = Date.now();
    session.expiresAt = Date.now() + SESSION_DURATION;
    sessions.set(sessionIdStr, session);
    
    // Set session cookie with basic settings
    res.cookie('session-id', sessionIdStr, {
      httpOnly: true,
      path: '/'
    });

    // Also set session ID in response header for client-side storage
    res.setHeader('x-session-id', sessionIdStr);
    
    // Find user in database
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.userId));
    
    if (!user) {
      sessions.delete(sessionIdStr);
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Attach user to request object
    req.user = {
      id: user.id,
      username: user.username,
      organizationId: user.organizationId || undefined,
      isBusinessAccount: user.isBusinessAccount
    };
    
    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};