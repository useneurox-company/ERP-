import "dotenv/config"; // Loads environment variables
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { join } from "path";
// Browser Agent временно отключен
// import { browserAgentWebSocket } from "./modules/browser-agent";

const app = express();

// Simple log function
const log = (message: string) => {
  console.log(`${new Date().toLocaleTimeString()} [express] ${message}`);
};

// Security middleware - Helmet for production
if (process.env.NODE_ENV === 'production') {
  app.use(helmet({
    contentSecurityPolicy: false, // We'll configure this properly later
    crossOriginEmbedderPolicy: false,
  }));
}

// Set 500MB limit for JSON and URL-encoded payloads
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: false, limit: '500mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Production static file serving - BEFORE routes to ensure priority
const isProduction = process.env.NODE_ENV === "production";
if (isProduction) {
  const publicDir = join(process.cwd(), "dist", "public");
  log(`[STATIC] Production mode - serving static files from: ${publicDir}`);

  // Serve /assets with proper MIME types
  app.use('/assets', (req, res) => {
    const assetPath = req.path.startsWith('/') ? req.path.slice(1) : req.path;
    const fullPath = join(publicDir, 'assets', assetPath);

    // Set correct content type
    if (assetPath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
    } else if (assetPath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=UTF-8');
    }

    res.sendFile(fullPath, (err: any) => {
      if (err && !res.headersSent) {
        res.status(404).send('Asset not found');
      }
    });
  });

  // Serve other static files (favicon, logo, etc.)
  app.use(express.static(publicDir, {
    index: false // Don't serve index.html for directory requests
  }));
}

(async () => {
  const server = await registerRoutes(app);

  // Browser Agent WebSocket временно отключен
  // browserAgentWebSocket.initialize(server);

  // Serve AI-generated images from .local/generated directory
  const generatedDir = join(process.cwd(), ".local", "generated");
  app.use("/generated", express.static(generatedDir));
  log(`📸 [Static] Serving AI-generated images from ${generatedDir}`);

  // Error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  log(`Environment: ${process.env.NODE_ENV || 'not set'}, isProduction: ${isProduction}`);

  if (!isProduction) {
    // Development mode - use Vite
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    // Production mode - SPA fallback (static files already registered above)
    const publicDir = join(process.cwd(), "dist", "public");

    app.get("*", (req, res) => {
      // Don't serve index.html for static file requests that weren't found
      if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|map)$/)) {
        return res.status(404).send('Not found');
      }
      res.sendFile(join(publicDir, "index.html"));
    });
  }

  // Start server
  const port = 5000;
  const isWindows = process.platform === 'win32';

  const listenOptions: any = {
    port,
  };

  if (!isWindows) {
    listenOptions.reusePort = true;
  }

  server.listen(listenOptions, () => {
    log(`serving on port ${port}`);
  });
})();
