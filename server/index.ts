// IMPORTANT: Load environment variables before ANY other imports
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Try multiple potential .env file locations
const projectRoot = process.cwd();
const serverDir = path.dirname(new URL(import.meta.url).pathname);
const envPaths = [
  path.resolve(projectRoot, ".env"),
  path.resolve(serverDir, ".env"),
  path.resolve(projectRoot, "server/.env"),
];

// Try to load from different possible locations
let envLoaded = false;
for (const envPath of envPaths) {
  try {
    if (fs.existsSync(envPath)) {
      console.log(`Loading .env from: ${envPath}`);
      dotenv.config({ path: envPath });
      envLoaded = true;
      break;
    }
  } catch (err) {
    console.error(`Error checking .env at ${envPath}:`, err);
  }
}

if (!envLoaded) {
  console.warn("⚠️ No .env file found! Using environment variables from process.");
}

// Handle missing DATABASE_URL - this is critical, so we either provide a hard-coded
// value or exit if it's not available
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set in environment");
  console.log("Setting DATABASE_URL explicitly...");
  process.env.DATABASE_URL = 
    "postgres://avnadmin:AVNS_-Yo7LbzBA9ZS4fNDu93@transac-transac-database.g.aivencloud.com:15207/defaultdb?sslmode=require";
}

// Log diagnostics to help debug
console.log("Process CWD:", projectRoot);
console.log("DATABASE_URL is set:", !!process.env.DATABASE_URL);

// Now that environment variables are loaded, import other modules
import { fileURLToPath } from "url";
import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer, Server } from "http";
import { loadConfigFromFile, UserConfig, ViteDevServer } from "vite";
import { setupVite } from "./vite";
import authRouter from "./routes/auth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || "3000", 10);
const NODE_ENV = process.env.NODE_ENV || "development";
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

function applyGlobalMiddleware(app: Express): void {
  app.use(
    cors({ credentials: true, origin: CLIENT_ORIGIN }),
    express.json(),
    express.urlencoded({ extended: true }),
    cookieParser()
  );

  // Logging middleware for all incoming requests.
  app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`Incoming request: ${req.method} ${req.originalUrl}`);
    next();
  });
}

function setupAPIRoutes(app: Express): void {
  // Example API route for registration.
  app.post("/api/register", (req: Request, res: Response) => {
    console.log("API /api/register hit");
    res.json({ message: "Registration successful" });
  });
}

function configureProduction(app: Express): void {
  const staticDir = path.join(__dirname, "../../client/dist");
  app.use(express.static(staticDir));
  app.get("*", (req: Request, res: Response) => {
    // Prevent API and auth routes from falling here.
    if (req.path.startsWith("/api") || req.path.startsWith("/auth")) {
      res.status(404).json({ error: "API route not found" });
    } else {
      res.sendFile(path.join(staticDir, "index.html"));
    }
  });
}

async function configureDevelopment(app: Express, server: Server): Promise<void> {
  const viteConfigPath = path.resolve(__dirname, "../vite.config.ts");
  const loadedConfig = await loadConfigFromFile(
    { mode: NODE_ENV, command: "serve" },
    viteConfigPath
  );
  if (!loadedConfig?.config) {
    throw new Error(`🚨 Failed to load Vite config from "${viteConfigPath}"`);
  }
  const viteServer: ViteDevServer = await setupVite(app, server, loadedConfig.config as UserConfig);

  // Fallback middleware for HTML requests.
  app.use("*", async (req: Request, res: Response, next: NextFunction) => {
    // Only handle GET requests.
    if (req.method !== "GET") return next();
    // Bypass API and auth routes.
    if (req.originalUrl.startsWith("/api") || req.originalUrl.startsWith("/auth")) {
      console.log(`Bypassing fallback for API request: ${req.method} ${req.originalUrl}`);
      return next();
    }
    try {
      console.log(`Fallback triggered for: ${req.method} ${req.originalUrl}`);
      const clientTemplate = path.resolve(__dirname, "../client/index.html");
      const template = await fs.promises.readFile(clientTemplate, "utf-8");
      const page = await viteServer.transformIndexHtml(req.originalUrl, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (err) {
      console.error("Error in fallback middleware:", err);
      next(err);
    }
  });
}

function setupGracefulShutdown(server: Server): void {
  const signals = ["SIGINT", "SIGTERM"];
  signals.forEach((signal: string) => {
    process.on(signal, () => {
      console.log(`⚠️  [Shutdown] ${signal} received, initiating graceful shutdown.`);
      server.close((err) => {
        if (err) {
          console.error("❌ Error during graceful shutdown:", err);
          process.exit(1);
        }
        console.log("✅ Server shutdown gracefully.");
        process.exit(0);
      });
    });
  });
}

async function bootstrapApp(): Promise<{ app: Express; server: Server }> {
  const app: Express = express();
  const server: Server = createServer(app);

  applyGlobalMiddleware(app);
  setupAPIRoutes(app);

  // Mount auth routes before fallback middleware.
  app.use("/auth", authRouter);

  if (NODE_ENV === "production") {
    configureProduction(app);
  } else {
    await configureDevelopment(app, server);
  }

  // Global error handler.
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("❗️ [Server Error]:", err.stack || err);
    res.status(500).json({ error: "Internal Server Error" });
  });

  return { app, server };
}

async function main(): Promise<void> {
  try {
    const { app, server } = await bootstrapApp();
    server.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
    setupGracefulShutdown(server);
  } catch (err) {
    console.error("❌ Critical failure in application initialization:", err);
    process.exit(1);
  }
}

main();