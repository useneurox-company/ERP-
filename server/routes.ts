import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "./db";
// Trigger reload

// Import middleware
import { authenticate } from "./middleware/auth";
import { globalPriceFilter } from "./middleware/priceFilter";

// Import modular routes
import { router as salesRouter } from "./modules/sales/routes";
import { router as projectsRouter } from "./modules/projects/routes";
import { router as productionRouter } from "./modules/production/routes";
import { router as warehouseRouter } from "./modules/warehouse/routes";
import { router as financeRouter } from "./modules/finance/routes";
import { router as installationRouter } from "./modules/installation/routes";
import { router as tasksRouter } from "./modules/tasks/routes";
import { router as documentsRouter } from "./modules/documents/routes";
import { router as usersRouter } from "./modules/users/routes";
import { router as rolesRouter } from "./modules/roles/routes";
import { router as permissionsRouter } from "./modules/permissions/routes";
import { router as settingsRouter } from "./modules/settings/routes";
import { router as attachmentsRouter } from "./modules/attachments/routes";
import { router as customFieldsRouter } from "./modules/custom-fields/routes";
import { router as templatesRouter } from "./modules/templates/routes";
import salesPipelinesRouter from "./modules/sales-pipelines/routes";
import dealContactsRouter from "./modules/deal-contacts/routes";
import aiRouter from "./modules/ai/routes";
import assistantRouter from "./modules/assistant/routes";
import stageTypesRouter from "./modules/stage-types/routes";
import stageDocumentsRouter from "./modules/stage-documents/routes";
import stageMediaCommentsRouter from "./modules/stage-media-comments/routes";
import { router as authRouter } from "./modules/auth/routes";
import { procurementRouter } from "./modules/procurement/routes";
import { router as suppliersRouter } from "./modules/suppliers/routes";
import { router as clientsRouter } from "./modules/clients/routes";
import { router as installersRouter } from "./modules/installers/routes";
import { router as montageRouter } from "./modules/montage/routes";
import { router as boardRouter } from "./modules/board/routes";
// Browser Agent временно отключен
// import { router as browserAgentRouter } from "./modules/browser-agent";

export async function registerRoutes(app: Express): Promise<Server> {
  // Apply global middleware for all API routes
  app.use('/api', authenticate);      // Add user info from X-User-Id header
  app.use('/api', globalPriceFilter()); // Filter prices based on permissions

  // Health check endpoint
  app.get('/api/health', async (req, res) => {
    try {
      // Check database connection
      await db.execute('SELECT 1');

      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: 'Database connection failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Register all modular routes (они уже содержат префикс /api)
  app.use(authRouter);
  app.use(salesRouter);
  app.use(projectsRouter);
  app.use(productionRouter);
  app.use(warehouseRouter);
  app.use(financeRouter);
  app.use(installationRouter);
  app.use(tasksRouter);
  app.use(documentsRouter);
  app.use(usersRouter);
  app.use(rolesRouter);
  app.use(permissionsRouter);
  app.use(settingsRouter);
  app.use(attachmentsRouter);
  app.use(customFieldsRouter);
  app.use(templatesRouter);
  app.use('/api/sales-pipelines', salesPipelinesRouter);
  app.use(dealContactsRouter);
  app.use(aiRouter);
  app.use(assistantRouter);
  app.use(stageTypesRouter);
  app.use(stageDocumentsRouter);
  app.use(stageMediaCommentsRouter);
  app.use(procurementRouter);
  app.use(suppliersRouter);
  app.use(clientsRouter);
  app.use(installersRouter);
  app.use(montageRouter);
  app.use(boardRouter);
  // Browser Agent временно отключен
  // app.use(browserAgentRouter);

  const httpServer = createServer(app);

  return httpServer;
}
