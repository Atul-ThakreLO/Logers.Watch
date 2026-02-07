import { Elysia } from "elysia";
import { authController } from "./modules/auth";
import { userController } from "./modules/user";

const app = new Elysia()
  .get("/", () => ({ message: "Logers.Watch API", version: "1.0.0" }))
  .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))
  // API routes
  .group("/api/v1", (app) => app.use(authController).use(userController))
  .listen(3000);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
);
console.log(`📚 API Documentation: http://localhost:3000/api/v1/auth`);
console.log(`👤 User routes: http://localhost:3000/api/v1/users`);
