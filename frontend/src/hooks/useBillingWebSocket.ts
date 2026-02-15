"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const WS_URL = "ws://localhost:3000/ws/billing";

// WebSocket message types
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
  onBalanceUpdate?: (
    pendingDeduction: number,
    effectiveBalance: number,
  ) => void;
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
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [pendingDeduction, setPendingDeduction] = useState(0);
  const [effectiveBalance, setEffectiveBalance] = useState(0);

  const {
    onBalanceUpdate,
    onSessionStarted,
    onSessionEnded,
    onSettlementComplete,
    onError,
  } = options;

  const connect = useCallback(() => {
    if (!accessToken) {
      console.warn("[BillingWS] No access token, cannot connect");
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("[BillingWS] Already connected");
      return;
    }

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket(`${WS_URL}?token=${accessToken}`);

    ws.onopen = () => {
      console.log("[BillingWS] Connected");
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        console.log("[BillingWS] Received:", msg.type, msg.data);

        switch (msg.type) {
          case "status_update":
            setStatus(msg.data);
            setPendingDeduction(msg.data?.pendingDeduction || 0);
            setEffectiveBalance(msg.data?.effectiveBalance || 0);
            break;

          case "balance_update":
            setPendingDeduction(msg.data?.pendingDeduction || 0);
            setEffectiveBalance(msg.data?.effectiveBalance || 0);
            onBalanceUpdate?.(
              msg.data?.pendingDeduction || 0,
              msg.data?.effectiveBalance || 0,
            );
            break;

          case "session_started":
            onSessionStarted?.(msg.data?.session);
            break;

          case "session_ended":
            onSessionEnded?.(msg.data?.settlement);
            break;

          case "settlement_complete":
            onSettlementComplete?.(msg.data);
            break;

          case "error":
            console.error("[BillingWS] Server error:", msg.error);
            onError?.(msg.error || "Unknown error");
            break;

          case "pong":
            // Heartbeat response
            break;

          default:
            console.log("[BillingWS] Unknown message type:", msg.type);
        }
      } catch (error) {
        console.error("[BillingWS] Failed to parse message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("[BillingWS] WebSocket error:", error);
      onError?.("WebSocket connection error");
    };

    ws.onclose = (event) => {
      console.log("[BillingWS] Disconnected:", event.code, event.reason);
      setIsConnected(false);

      // Auto-reconnect after 3 seconds if not intentionally closed
      if (event.code !== 1000) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log("[BillingWS] Attempting to reconnect...");
          connect();
        }, 3000);
      }
    };

    wsRef.current = ws;
  }, [
    accessToken,
    onBalanceUpdate,
    onSessionStarted,
    onSessionEnded,
    onSettlementComplete,
    onError,
  ]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, "User disconnected");
      wsRef.current = null;
    }

    setIsConnected(false);
  }, []);

  const send = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn("[BillingWS] Cannot send, WebSocket not connected");
    }
  }, []);

  const startSession = useCallback(
    (videoId: string) => {
      send({ type: "start_session", videoId });
    },
    [send],
  );

  const endSession = useCallback(() => {
    send({ type: "end_session" });
  }, [send]);

  const getStatus = useCallback(() => {
    send({ type: "get_status" });
  }, [send]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Ping/keepalive every 30 seconds
  useEffect(() => {
    if (!isConnected) return;

    const pingInterval = setInterval(() => {
      send({ type: "ping" });
    }, 30000);

    return () => clearInterval(pingInterval);
  }, [isConnected, send]);

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
