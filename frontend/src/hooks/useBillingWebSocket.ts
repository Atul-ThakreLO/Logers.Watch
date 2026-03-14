"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const WS_URL = "ws://localhost:3000/ws/billing";
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

async function tryRefreshToken(): Promise<boolean> {
  try {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) return false;

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    if (data.accessToken) {
      localStorage.setItem("accessToken", data.accessToken);
      if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

interface WSMessage {
  type: string;
  data?: any;
  error?: string;
}

interface BillingStatus {
  userId: string;
  pendingDeduction: number;
  activeSession: {
    userId: string;
    videoId: string;
    creatorId: string;
    startTime: number;
    lastSettlementTime: number;
    totalRequests: number;
  } | null;
  dbBalance: number;
  effectiveBalance: number;
}

interface SettlementResult {
  userId: string;
  amountSettled: number;
  watchTimeSettled: number;
  creatorId: string;
  success: boolean;
}

interface UseBillingWebSocketOptions {
  onBalanceUpdate?: (pendingDeduction: number, effectiveBalance: number) => void;
  onSessionStarted?: (session: any) => void;
  onSessionEnded?: (settlement: SettlementResult | null) => void;
  onSettlementComplete?: (result: SettlementResult) => void;
  onError?: (error: string) => void;
}

interface UseBillingWebSocketReturn {
  isConnected: boolean;
  status: BillingStatus | null;
  pendingDeduction: number;
  effectiveBalance: number;
  connect: () => void;
  disconnect: () => void;
  startSession: (videoId: string) => void;
  endSession: () => void;
  getStatus: () => void;
}

export function useBillingWebSocket(
  accessToken: string | null,
  options: UseBillingWebSocketOptions = {},
): UseBillingWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [pendingDeduction, setPendingDeduction] = useState(0);
  const [effectiveBalance, setEffectiveBalance] = useState(0);

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
  }, []);

  const send = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const disconnect = useCallback(() => {
    clearTimers();
    if (wsRef.current) {
      // Remove handlers before closing so onclose doesn't trigger reconnect
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close(1000, "User disconnected");
      wsRef.current = null;
    }
    setIsConnected(false);
  }, [clearTimers]);

  const connect = useCallback(() => {
    // Already open or connecting — do nothing
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    const token = localStorage.getItem("accessToken") ?? accessToken;
    if (!token) {
      console.warn("[BillingWS] No access token, cannot connect");
      return;
    }

    // Clean up any stale socket first
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    console.log("[BillingWS] Connecting...");
    const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[BillingWS] Connected");
      setIsConnected(true);

      // Start ping interval
      pingTimerRef.current = setInterval(() => {
        send({ type: "ping" });
      }, 30_000);
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        const cb = optionsRef.current;

        switch (msg.type) {
          case "status_update":
            setStatus(msg.data);
            setPendingDeduction(msg.data?.pendingDeduction ?? 0);
            setEffectiveBalance(msg.data?.effectiveBalance ?? 0);
            break;

          case "balance_update":
            setPendingDeduction(msg.data?.pendingDeduction ?? 0);
            setEffectiveBalance(msg.data?.effectiveBalance ?? 0);
            cb.onBalanceUpdate?.(
              msg.data?.pendingDeduction ?? 0,
              msg.data?.effectiveBalance ?? 0,
            );
            break;

          case "session_started":
            cb.onSessionStarted?.(msg.data?.session);
            break;

          case "session_ended":
            cb.onSessionEnded?.(msg.data?.settlement);
            break;

          case "settlement_complete":
            cb.onSettlementComplete?.(msg.data);
            break;

          case "error":
            console.error("[BillingWS] Server error:", msg.error);
            cb.onError?.(msg.error ?? "Unknown error");
            // On auth error, try refreshing the token then reconnect once
            if (msg.error?.includes("token") || msg.error?.includes("auth")) {
              tryRefreshToken().then((ok) => {
                if (ok) {
                  console.log("[BillingWS] Token refreshed, reconnecting...");
                  reconnectTimerRef.current = setTimeout(() => connect(), 500);
                }
              });
            }
            break;

          case "pong":
            break;
        }
      } catch (err) {
        console.error("[BillingWS] Failed to parse message:", err);
      }
    };

    ws.onerror = () => {
      // onerror is always followed by onclose — let onclose handle reconnect
      optionsRef.current.onError?.("WebSocket connection error");
    };

    ws.onclose = (event) => {
      console.log("[BillingWS] Disconnected:", event.code, event.reason);
      setIsConnected(false);
      clearTimers();
      wsRef.current = null;

      // Reconnect automatically unless it was a clean close (1000) or auth failure
      if (event.code !== 1000) {
        console.log("[BillingWS] Scheduling reconnect in 3s...");
        reconnectTimerRef.current = setTimeout(() => connect(), 3_000);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, clearTimers, send]);

  // Disconnect on unmount
  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  const startSession = useCallback(
    (videoId: string) => send({ type: "start_session", videoId }),
    [send],
  );

  const endSession = useCallback(
    () => send({ type: "end_session" }),
    [send],
  );

  const getStatus = useCallback(
    () => send({ type: "get_status" }),
    [send],
  );

  return {
    isConnected,
    status,
    pendingDeduction,
    effectiveBalance,
    connect,
    disconnect,
    startSession,
    endSession,
    getStatus,
  };
}
