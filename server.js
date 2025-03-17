import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import express from 'express';
import session from 'express-session';
import dotenv from 'dotenv';

dotenv.config();

// Define __dirname correctly in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ---- REPLACE EVERYTHING BELOW THIS LINE (up to app.listen) ---- //

// Serve static files BEFORE auth middleware
app.use(express.static(join(__dirname, 'public')));

// Session middleware setup (required before authMiddleware if sessions are used)
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_dev_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        secure: false,
        httpOnly: true,
        sameSite: 'none'
    },
}));

// Authentication Middleware (updated)
const authMiddleware = (req, res, next) => {
    const publicPaths = [
        '/',
        '/session-test',
        '/favicon.ico'
    ];

    if (publicPaths.includes(req.path) || req.path.startsWith('/public')) {
        return next();
    }

    const isAuthenticated = Boolean(req.session?.user) || Boolean(req.headers['x-demo-auth']);
    if (!isAuthenticated) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
};

app.use(authMiddleware);

// Public Routes
app.get('/', (req, res) => {
    res.send(`
        <h1>Welcome</h1>
        <p>This is the home page. Try <a href="/session-test">/session-test</a></p>
    `);
});

app.get('/session-test', (req, res) => {
    req.session.views = (req.session.views || 0) + 1;
    res.json({ message: 'Session test endpoint', views: req.session.views });
});

// Catch-all for unrecognized paths
app.use((req, res, next) => {
    res.status(404).json({ error: 'Not Found' });
});

// ---- END HERE (Everything above app.listen()) ---- //

app.listen(PORT, () => {
    console.log(`[express] Server running: http://localhost:${PORT}`);
});