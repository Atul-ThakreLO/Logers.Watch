import { Elysia } from "elysia";
import { dbDecorator } from "./utils/db";
import { authController } from "./modules/auth";
import { userController } from "./modules/user";
import { creatorController } from "./modules/creator";
import { videoController } from "./modules/video";
import { billingController } from "./modules/billing";
import { billingWebSocket } from "./modules/billing/websocket";
import { adminController } from "./modules/admin";
import { startCronJobs } from "./utils/cron";
import { startVideoWorker } from "./workers/video.worker";
import { cors } from "@elysiajs/cors";

const app = new Elysia()
  .use(
    cors({
      origin: "http://localhost:3001",
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Accept", "Range"],
      exposeHeaders: ["Content-Length", "Content-Range", "Accept-Ranges"],
    }),
  )
  // Database and Redis decorator
  .use(dbDecorator)
  .get("/", () => ({ message: "Logers.Watch API", version: "1.0.0" }))
  .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))
  // WebSocket routes (outside /api/v1 for cleaner URLs)
  .use(billingWebSocket)
  // API routes
  .group("/api/v1", (app) =>
    app
      .use(authController)
      .use(userController)
      .use(creatorController)
      .use(videoController)
      .use(billingController)
      .use(adminController),
  )
  .listen(3000);

startCronJobs();
startVideoWorker();

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
);
console.log(`📚 API Documentation: http://localhost:3000/api/v1/auth`);
console.log(`👤 User routes: http://localhost:3000/api/v1/users`);
console.log(`🎬 Creator routes: http://localhost:3000/api/v1/creators`);
console.log(`📹 Video routes: http://localhost:3000/api/v1/videos`);
console.log(`💰 Billing routes: http://localhost:3000/api/v1/billing`);
console.log(`🔌 Billing WebSocket: ws://localhost:3000/ws/billing?token=<jwt>`);
