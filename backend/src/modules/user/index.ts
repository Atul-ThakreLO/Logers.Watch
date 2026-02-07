import { Elysia, t } from "elysia";
import { userService } from "./service";
import { authMiddleware } from "../auth/service";

// Type for authenticated context
type AuthContext = {
  userId: string | null;
  userEmail: string | null;
  username: string | null;
};

export const userController = new Elysia({ prefix: "/users" })
  .use(authMiddleware)
  .get(
    "/me",
    async (ctx) => {
      const { userId, set } = ctx as typeof ctx & AuthContext;
      if (!userId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const user = await userService.getById(userId);
      if (!user) {
        set.status = 404;
        return { error: "User not found" };
      }

      return { user };
    },
    {
      detail: {
        summary: "Get current user profile",
        tags: ["User"],
      },
    },
  )
  .get(
    "/:id",
    async (ctx) => {
      // { params, set, body: { userId } }
      const { params, userId, set } = ctx as typeof ctx & AuthContext;
      if (!userId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const user = await userService.getById(params.id);
      if (!user) {
        set.status = 404;
        return { error: "User not found" };
      }

      return { user };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        summary: "Get user by ID",
        tags: ["User"],
      },
      //   body: t.Object({
      //     userId: t.String(),
      //   }),
    },
  )
  .patch(
    "/me",
    async (ctx) => {
      const { body, userId, set } = ctx as typeof ctx & AuthContext;
      if (!userId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const user = await userService.update(userId, body);
      if (!user) {
        set.status = 404;
        return { error: "User not found" };
      }

      return { user };
    },
    {
      body: t.Object({
        username: t.Optional(t.String({ minLength: 3, maxLength: 50 })),
      }),
      detail: {
        summary: "Update current user profile",
        tags: ["User"],
      },
    },
  )
  .delete(
    "/me",
    async (ctx) => {
      const { userId, set } = ctx as typeof ctx & AuthContext;
      if (!userId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const deleted = await userService.delete(userId);
      if (!deleted) {
        set.status = 404;
        return { error: "User not found" };
      }

      return { message: "User deleted successfully" };
    },
    {
      detail: {
        summary: "Delete current user",
        tags: ["User"],
      },
    },
  );
