import { Elysia, t } from "elysia";
import { billingService } from "./service";
import {
  userAuthMiddleware,
  type UserAuthContext,
} from "../../utils/middleware";
import {
  getTotalDepositedByUser,
  getTokenDecimals,
} from "../../utils/blockchain";
import { prisma, cache, CacheKeys } from "../../utils/db";
import { formatUnits, parseUnits } from "viem";

export const billingController = new Elysia({ prefix: "/billing" })
  .use(userAuthMiddleware)
  // Get billing status
  .get(
    "/status",
    async (ctx) => {
      const { userId, set } = ctx as typeof ctx & UserAuthContext;

      if (!userId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const status = await billingService.getBillingStatus(userId);
      if (!status) {
        set.status = 404;
        return { error: "User not found" };
      }

      return { status };
    },
    {
      detail: {
        summary: "Get billing status including pending deductions",
        tags: ["Billing"],
      },
    },
  )
  // Set user's wallet address
  .patch(
    "/wallet",
    async (ctx) => {
      const { body, userId, set } = ctx as typeof ctx &
        UserAuthContext & { body: { eoaAddress: string } };

      if (!userId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      // Validate address format
      if (!body.eoaAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        set.status = 400;
        return { error: "Invalid wallet address format" };
      }

      try {
        const user = await prisma.user.update({
          where: { id: userId },
          data: { eoaAddress: body.eoaAddress.toLowerCase() },
          select: {
            id: true,
            name: true,
            email: true,
            eoaAddress: true,
            balance: true,
          },
        });

        return { success: true, user };
      } catch (error: any) {
        if (error.code === "P2002") {
          set.status = 400;
          return {
            error: "This wallet address is already linked to another account",
          };
        }
        set.status = 500;
        return { error: "Failed to update wallet address" };
      }
    },
    {
      body: t.Object({
        eoaAddress: t.String(),
      }),
      detail: {
        summary: "Set user wallet address for on-chain deposits",
        tags: ["Billing"],
      },
    },
  )
  // Sync balance from on-chain
  .post(
    "/sync",
    async (ctx) => {
      const { userId, set } = ctx as typeof ctx & UserAuthContext;

      if (!userId) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      // Get user's wallet address
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          eoaAddress: true,
          balance: true,
          totalConsumed: true,
        },
      });

      if (!user) {
        set.status = 404;
        return { error: "User not found" };
      }

      if (!user.eoaAddress) {
        set.status = 400;
        return {
          error: "Wallet address not set. Please link your wallet first.",
        };
      }

      try {
        // Read on-chain balance
        const onChainBalance = await getTotalDepositedByUser(
          user.eoaAddress as `0x${string}`,
        );
        // Get token decimals from contract (USDC = 6, most tokens = 18)
        const tokenDecimals = await getTokenDecimals();
        const dbBalanceRaw = parseUnits(
          String(Math.max(user.balance, 0)),
          tokenDecimals,
        );
        const nextDepositedRaw =
          onChainBalance > dbBalanceRaw ? onChainBalance : dbBalanceRaw;
        const rechargeRaw =
          nextDepositedRaw > dbBalanceRaw
            ? nextDepositedRaw - dbBalanceRaw
            : 0n;
        const nextDepositedBalance = parseFloat(
          formatUnits(nextDepositedRaw, tokenDecimals),
        );
        const rechargeAmount = parseFloat(
          formatUnits(rechargeRaw, tokenDecimals),
        );
        const availableBalance = Math.max(
          nextDepositedBalance - user.totalConsumed,
          0,
        );

        if (rechargeAmount > 0) {
          const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
              balance: nextDepositedBalance,
              lastRechargeAmount: rechargeAmount,
            },
            select: {
              id: true,
              balance: true,
              totalConsumed: true,
              eoaAddress: true,
            },
          });

          await cache.del(CacheKeys.user(userId));
          await cache.del(CacheKeys.userByEmail(user.email));

          console.log(updatedUser);
        }

        return {
          success: true,
          balance: availableBalance,
          onChainBalance: onChainBalance.toString(),
          message:
            rechargeAmount > 0
              ? "Balance synced from on-chain"
              : "No new on-chain deposit found",
        };
      } catch (error: any) {
        console.error("Failed to sync balance:", error);
        set.status = 500;
        return { error: "Failed to sync balance from blockchain" };
      }
    },
    {
      detail: {
        summary: "Sync user balance from on-chain deposit",
        description:
          "Reads the user's deposited balance from the smart contract and updates the database",
        tags: ["Billing"],
      },
    },
  );

// NOTE: /recharge and /settle routes removed - now handled on-chain via LogersWatch contract
// Users deposit via smart contract deposit() function
// Creators claim via smart contract claim() function with merkle proof
