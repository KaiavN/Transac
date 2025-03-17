// server/env.ts
import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  config({ path: envPath });
  console.log("Environment variables loaded from:", envPath);
} else {
  console.warn(".env file not found at:", envPath);
  config();
}
var requiredEnvVars = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
  "CLIENT_URL",
  "DATABASE_URL"
];
var missingVars = false;
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    missingVars = true;
  }
}
if (missingVars) {
  console.error("Please check your .env file and ensure all required variables are set.");
}

// server/index.ts
import express2 from "express";
import cookieParser from "cookie-parser";
import session from "express-session";

// server/routes.ts
var authCheck = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
};
async function registerRoutes(app2) {
  app2.get("/", authCheck, (req, res) => {
    res.json({ message: "Authenticated. Welcome!" });
  });
  app2.post("/login", (req, res) => {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: "Username required" });
    }
    req.session.user = username;
    res.json({ message: "Logged in", user: username });
  });
  app2.get("/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ error: "Logout failed" });
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out successfully" });
    });
  });
  app2.get("/session-info", (req, res) => {
    res.json({
      sessionID: req.sessionID,
      sessionUser: req.session.user
    });
  });
}

// server/vite.ts
import express from "express";
import fs2 from "fs";
import path3, { dirname as dirname2 } from "path";
import { fileURLToPath as fileURLToPath3 } from "url";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path2, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath as fileURLToPath2 } from "url";
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = dirname(__filename2);
var vite_config_default = defineConfig({
  plugins: [react(), runtimeErrorOverlay(), themePlugin()],
  resolve: {
    alias: {
      "@": path2.resolve(__dirname2, "client", "src"),
      "@shared": path2.resolve(__dirname2, "shared")
    }
  },
  root: path2.resolve(__dirname2, "client"),
  build: {
    outDir: path2.resolve(__dirname2, "dist/public"),
    emptyOutDir: true
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false
      }
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var __filename3 = fileURLToPath3(import.meta.url);
var __dirname3 = dirname2(__filename3);
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path3.resolve(
        __dirname3,
        "..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path3.resolve(__dirname3, "public");
  if (!fs2.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path3.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.set("trust proxy", 1);
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || "strong_default_secret",
  resave: false,
  saveUninitialized: true,
  // explicitly true for development purposes
  cookie: {
    httpOnly: true,
    secure: false,
    // false in development (true in production HTTPS)
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1e3
    // 1 day
  }
}));
app.use((req, res, next) => {
  if (!req.session) {
    return next(new Error("Session initialization failed."));
  }
  req.session.touch();
  log(`Session initialized (ID: ${req.sessionID}). Cookie header: ${req.headers.cookie}`);
  next();
});
app.use((req, res, next) => {
  const allowedOrigins = [
    process.env.CLIENT_URL,
    "http://localhost:5173",
    "http://localhost:3000"
  ].filter(Boolean);
  const origin = req.headers.origin;
  log(`CORS Origin: ${origin}; Allowed Origins: ${allowedOrigins.join(",")}`);
  if (origin && allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD");
    res.header("Access-Control-Allow-Headers", "Content-Type,Authorization,Origin,Accept,X-Requested-With");
    res.header("Access-Control-Expose-Headers", "Set-Cookie");
  } else {
    log(`Rejected CORS request: ${origin}`);
    return res.status(403).json({ error: "CORS origin denied" });
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use((req, res, next) => {
  const start = Date.now();
  const originalJsonFn = res.json.bind(res);
  res.json = (body) => {
    res.locals.capturedResponse = body;
    return originalJsonFn(body);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    const logMessage = [
      req.method,
      req.path,
      res.statusCode,
      `${duration}ms`,
      JSON.stringify(res.locals.capturedResponse || {})
    ].join(" | ");
    log(`[Response] ${logMessage}`);
    log(`[Set-Cookie Header]: ${res.getHeader("Set-Cookie")}`);
  });
  next();
});
(async () => {
  await registerRoutes(app);
  app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    log(`[Error Handler]: ${message} (Status: ${statusCode})`);
    res.status(statusCode).json({ error: message });
  });
  if (process.env.NODE_ENV === "production") {
    app.use(serveStatic());
  } else {
    await setupVite(app);
  }
  const PORT = process.env.PORT || 3e3;
  app.listen(PORT, () => {
    log(`[express] Server running on port ${PORT}`);
  });
})();
