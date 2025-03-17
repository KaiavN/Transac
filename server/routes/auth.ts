import express, { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createSession } from '../middleware/auth';
import { db } from '../db';
import { users } from '@shared/organizations';
import { eq } from 'drizzle-orm';
import { generateSecureToken } from '../utils/encryption';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';

// Import sessions from auth middleware
import { sessions } from '../middleware/auth';

const router = Router();

// Use built-in JSON body parser (if not set globally)
router.use(express.json());
// Use cookie parser to read cookies in requests
router.use(cookieParser());

// Get the directory name using import.meta.url for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the certificate for secure authentication
const certPath = path.join(__dirname, '../certs/auth.cert');
const certificate = fs.readFileSync(certPath, 'utf8');

// Validate required environment variables at start
const requiredEnvVars = {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  CLIENT_URL: process.env.CLIENT_URL
};

for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    console.error(`Missing required environment variable: ${key}`);
  }
}

// Initialize OAuth client only if all required variables are present
let client: OAuth2Client | null = null;
try {
  if (Object.values(requiredEnvVars).every(Boolean)) {
    client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      process.env.GOOGLE_REDIRECT_URI!
    );
  }
} catch (error) {
  console.error('Failed to initialize OAuth client:', error);
}

// CORS middleware for the auth routes
router.use((req, res, next) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  res.setHeader('Access-Control-Allow-Origin', clientUrl);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-id, Origin, X-Requested-With');
  res.setHeader('Access-Control-Expose-Headers', 'x-session-id, Set-Cookie, X-Requested-With');
  res.setHeader('Vary', 'Origin, Accept-Encoding');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Login endpoint - returns JSON ensuring proper Content-Type header
router.post('/login', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { email, fullName, password, payment, organizationId } = req.body;
    if (!email || !fullName) {
      return res.status(400).json({ error: 'Email and full name are required' });
    }
    
    // Find or create user in the database
    let user = await db.query.users.findFirst({
      where: eq(users.email, email)
    });
    if (!user) {
      const newUser = {
        id: crypto.randomUUID(),
        username: email.split('@')[0],
        email,
        fullName,
        isBusinessAccount: !!organizationId,
        organizationId: organizationId || null,
        contracts: [],
        signatureKey: generateSecureToken(24),
        payment: payment || {
          type: 'paypal',
          token: generateSecureToken(16),
          receivePaymentsTo: 'paypal',
          receivePaymentsDetails: email
        },
        createdAt: new Date()
      };
      await db.insert(users).values(newUser);
      user = newUser;
    }
    
    // Create a session for the user
    const sessionId = createSession(user.id, req);
    res.cookie('session-id', sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    res.setHeader('x-session-id', sessionId);
    res.status(200).json({
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      isBusinessAccount: user.isBusinessAccount,
      organizationId: user.organizationId || undefined
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify endpoint
router.get('/verify', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const sessionId = req.cookies['session-id'] || req.headers['x-session-id'];
    if (!sessionId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const session = sessions.get(sessionId as string);
    if (!session || session.expiresAt < Date.now()) {
      if (session) sessions.delete(sessionId as string);
      return res.status(401).json({ error: 'Session expired' });
    }
    
    session.lastActivity = Date.now();
    session.expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    sessions.set(sessionId as string, session);
    
    res.cookie('session-id', sessionId, {
      httpOnly: true,
      path: '/'
    });
    res.setHeader('x-session-id', sessionId);
    
    const [user] = await db.select().from(users).where(eq(users.id, session.userId));
    if (!user) {
      sessions.delete(sessionId as string);
      return res.status(401).json({ error: 'User not found' });
    }
    
    res.status(200).json({
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      isBusinessAccount: user.isBusinessAccount,
      organizationId: user.organizationId || undefined
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Google OAuth callback - returns HTML for the popup flow
router.get('/google/callback', async (req, res) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const sanitizedClientUrl = clientUrl.replace(/[<>"']/g, '');
  
  if (!client) {
    console.error('OAuth client not initialized due to missing configuration');
    return res.status(500).send('Server configuration error');
  }
  
  const { code, state } = req.query;
  if (!code || typeof code !== 'string' || !state || typeof state !== 'string') {
    return res.status(400).send('Invalid authorization code or state');
  }
  
  if (!requiredEnvVars.GOOGLE_CLIENT_ID || !requiredEnvVars.GOOGLE_CLIENT_SECRET ||
      !requiredEnvVars.CLIENT_URL || !requiredEnvVars.GOOGLE_REDIRECT_URI) {
    console.error('Missing required environment variables');
    return res.status(500).send('Server configuration error');
  }
  
  try {
    const { tokens } = await client.getToken(code);
    if (!tokens || !tokens.id_token) {
      throw new Error('Failed to retrieve tokens from Google');
    }
    
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    if (!payload || !payload.email || !payload.name) {
      throw new Error('Invalid user data in token payload');
    }
    
    const sanitizedEmail = payload.email.replace(/[<>"']/g, '');
    const sanitizedName = payload.name.replace(/[<>"']/g, '');
    
    let user = await db.query.users.findFirst({
      where: eq(users.email, sanitizedEmail)
    });
    if (!user) {
      const newUser = {
        id: crypto.randomUUID(),
        username: sanitizedEmail.split('@')[0],
        email: sanitizedEmail,
        fullName: sanitizedName,
        isBusinessAccount: false,
        contracts: [],
        signatureKey: generateSecureToken(24),
        payment: {
          type: "paypal" as const,
          token: generateSecureToken(16),
          receivePaymentsTo: "paypal" as const,
          receivePaymentsDetails: sanitizedEmail
        },
        createdAt: new Date(),
        organizationId: null
      };
      await db.insert(users).values(newUser);
      user = newUser;
    }
    
    const sessionId = createSession(user.id, req);
    res.cookie('session-id', sessionId, {
      httpOnly: true,
      path: '/'
    });
    res.setHeader('x-session-id', sessionId);
    
    const htmlResponse = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authentication Successful</title>
          <script>
            if (window.opener) {
              try {
                window.opener.postMessage({
                  type: 'google-auth',
                  email: '${sanitizedEmail}',
                  fullName: '${sanitizedName}',
                  sessionId: '${sessionId}'
                }, '${sanitizedClientUrl}');
                localStorage.setItem('session-id', '${sessionId}');
                document.cookie = 'session-id=${sessionId}; path=/; max-age=${24 * 60 * 60};'
              } catch (error) {
                console.error('Failed to send auth data:', error);
              } finally {
                window.close();
              }
            } else {
              document.body.innerHTML = 'Authentication successful. You can close this window.';
            }
          </script>
        </head>
        <body>
          <p>Authentication successful. This window will close automatically.</p>
        </body>
      </html>
    `;
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'");
    res.send(htmlResponse);
    
  } catch (error) {
    console.error('Google authentication error:', error);
    res.status(400).send('Authentication failed');
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const sessionId = req.cookies['session-id'] || req.headers['x-session-id'];
    if (sessionId) {
      sessions.delete(sessionId as string);
      res.clearCookie('session-id', {
        path: '/',
        httpOnly: true
      });
    }
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;