"use client";

import React, { useRef, useState, useEffect } from "react";
import { MediaPlayer, MediaPlayerClass } from "dashjs";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCw,
  RotateCcw,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useBillingWebSocket } from "@/hooks/useBillingWebSocket";

const API_BASE = "http://localhost:3000";
const SEGMENT_DURATION = 4; // seconds — match your manifest's segmentDuration
const PREFETCH_BEFORE_END_SECONDS = 2;

interface VideoPlayerProps {
  videoId: string;
  poster?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoId, poster }) => {
  const { accessToken, isAuthenticated } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  // Cast to `any` — the dashjs TypeScript types lag behind the actual v5 API.
  // getBitrateInfoListFor / setQualityFor were removed in v5 and replaced with
  // getRepresentationsByType / setRepresentationForTypeByIndex, which are not
  // yet reflected in MediaPlayerClass typings bundled with older @types/dashjs.
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const volumeControlRef = useRef<HTMLDivElement>(null);
  const hideControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [billingError, setBillingError] = useState<string | null>(null);

  // ─── Billing WebSocket ──────────────────────────────────────────────────────

  const {
    isConnected: isBillingConnected,
    pendingDeduction,
    effectiveBalance,
    connect: connectBilling,
    startSession,
    endSession,
  } = useBillingWebSocket(accessToken, {
    onBalanceUpdate: (pending, balance) => {
      console.log(`[Billing] pending=$${pending.toFixed(4)}, effective=$${balance.toFixed(2)}`);
    },
    onSessionStarted: (session) => console.log("[Billing] Session started:", session),
    onSessionEnded: (settlement) => console.log("[Billing] Session ended:", settlement),
    onError: (error) => {
      console.error("[Billing] Error:", error);
      setBillingError(error);
    },
  });

  useEffect(() => {
    if (isAuthenticated && accessToken) connectBilling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    if (isPlaying && isBillingConnected && videoId) startSession(videoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, isBillingConnected, videoId]);

  useEffect(() => () => endSession(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Dash.js setup ─────────────────────────────────────────────────────────

  const streamingUrl = `${API_BASE}/api/v1/videos/stream/${videoId}/manifest.mpd`;

  useEffect(() => {
    if (!videoRef.current || !isAuthenticated || !accessToken) return;

    const player = MediaPlayer().create();
    playerRef.current = player;

    player.updateSettings({
      streaming: {
        buffer: {
          // One segment ahead only — this is the key billing control.
          bufferTimeAtTopQuality: SEGMENT_DURATION,
          bufferTimeAtTopQualityLongForm: SEGMENT_DURATION,
          initialBufferLevel: SEGMENT_DURATION,
          bufferToKeep: SEGMENT_DURATION,
          bufferPruningInterval: 10,
          stallThreshold: 0.3,
          fastSwitchEnabled: false,
        },
        abr: {
          // Disable ABR — prevents parallel replacement-segment fetches.
          autoSwitchBitrate: { video: false, audio: false },
        },
        scheduling: {
          // Don't fetch segments while paused — saves bandwidth and billing.
          scheduleWhilePaused: false,
        },
      },
    });

    // ── v5 API: lock to lowest quality after stream initialises ────────────
    // dash.js v5 removed getBitrateInfoListFor() and setQualityFor().
    // Use getRepresentationsByType() and setRepresentationForTypeByIndex().
    player.on(MediaPlayer.events.STREAM_INITIALIZED, () => {
      try {
        const reps = player.getRepresentationsByType("video");
        if (reps?.length) {
          // Index 0 = lowest bitrate. Change to reps.length - 1 for highest.
          player.setRepresentationForTypeByIndex("video", 0, false);
          console.log(
            `[Player] Locked to quality index 0 (${reps[0].bitrateInKbit ?? "?"}kbps)`,
          );
        }
      } catch (e) {
        // Non-fatal — ABR is already disabled above via settings
        console.warn("[Player] Could not set initial quality:", e);
      }
    });

    // ── Auth headers on every XHR ──────────────────────────────────────────
    player.setXHRWithCredentialsForType("MPD", true);
    player.setXHRWithCredentialsForType("MediaSegment", true);
    player.setXHRWithCredentialsForType("InitializationSegment", true);

    player.extend(
      "RequestModifier",
      function () {
        return {
          modifyRequestHeader: function (xhr: XMLHttpRequest) {
            xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
            return xhr;
          },
        };
      },
      true,
    );

    // ── Segment fetch logging — confirm one-at-a-time ──────────────────────
    player.on(MediaPlayer.events.FRAGMENT_LOADING_STARTED, (e: any) => {
      if (e?.request?.mediaType === "video") {
        console.log(
          `[Player] Fetching video segment #${e.request.index} ` +
          `${e.request.startTime?.toFixed(2)}s–${e.request.endTime?.toFixed(2)}s`,
        );
      }
    });

    // ── Error handling ─────────────────────────────────────────────────────
    player.on(MediaPlayer.events.ERROR, (event: any) => {
      const msg = event?.error?.message ?? String(event?.error ?? "");
      if (msg.includes("402") || msg.includes("Insufficient balance")) {
        setBillingError("Insufficient balance. Please add funds to continue watching.");
      } else {
        console.error("[Player] dash.js error:", event.error);
      }
    });

    player.initialize(videoRef.current, streamingUrl, false);

    return () => {
      player.destroy();
      playerRef.current = null;
    };
  }, [streamingUrl, isAuthenticated, accessToken]);

  // ─── Buffer edge logging (diagnostic, safe to remove in production) ─────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTimeUpdate = () => {
      if (!video.buffered.length) return;
      const remaining = video.buffered.end(video.buffered.length - 1) - video.currentTime;
      if (remaining <= PREFETCH_BEFORE_END_SECONDS)
        console.log(`[Player] Buffer edge: ${remaining.toFixed(2)}s remaining`);
    };
    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, []);

  // ─── Standard video event listeners ────────────────────────────────────────

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onMetadata = () => setDuration(video.duration);
    const onEnded = () => setIsPlaying(false);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onMetadata);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onMetadata);
      video.removeEventListener("ended", onEnded);
    };
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // ─── Auto-hide controls ─────────────────────────────────────────────────────

  useEffect(() => {
    const resetTimer = () => {
      setShowControls(true);
      if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
      hideControlsTimeoutRef.current = setTimeout(() => {
        if (isPlaying) setShowControls(false);
      }, 3000);
    };
    const onLeave = () => {
      if (isPlaying)
        hideControlsTimeoutRef.current = setTimeout(() => setShowControls(false), 1000);
    };
    const el = containerRef.current;
    el?.addEventListener("mousemove", resetTimer);
    el?.addEventListener("mouseleave", onLeave);
    return () => {
      el?.removeEventListener("mousemove", resetTimer);
      el?.removeEventListener("mouseleave", onLeave);
      if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
    };
  }, [isPlaying]);

  // ─── Keyboard controls ──────────────────────────────────────────────────────

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (["Space","ArrowLeft","ArrowRight","ArrowUp","ArrowDown","KeyF","KeyM"].includes(e.code))
        e.preventDefault();
      switch (e.code) {
        case "Space": case "KeyK": togglePlayPause(); break;
        case "ArrowLeft": skip(-5); break;
        case "KeyJ": skip(-10); break;
        case "ArrowRight": skip(5); break;
        case "KeyL": skip(10); break;
        case "ArrowUp": adjustVolume(0.1); break;
        case "ArrowDown": adjustVolume(-0.1); break;
        case "KeyM": toggleMute(); break;
        case "KeyF": toggleFullscreen(); break;
        default:
          if (e.code.startsWith("Digit") && videoRef.current && duration)
            videoRef.current.currentTime = (duration * parseInt(e.code.replace("Digit", ""))) / 10;
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isPlaying, duration]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Playback helpers ───────────────────────────────────────────────────────

  const togglePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play();
    setIsPlaying((p) => !p);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted((m) => !m);
  };

  const adjustVolume = (delta: number) => {
    const next = Math.max(0, Math.min(1, volume + delta));
    setVolume(next);
    if (videoRef.current) {
      videoRef.current.volume = next;
      if (next === 0) setIsMuted(true);
      else if (isMuted) { setIsMuted(false); videoRef.current.muted = false; }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = parseFloat(e.target.value);
    setVolume(next);
    if (videoRef.current) {
      videoRef.current.volume = next;
      if (next === 0) setIsMuted(true);
      else if (isMuted) setIsMuted(false);
    }
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    setCurrentTime(t);
    if (videoRef.current) videoRef.current.currentTime = t;
  };

  const skip = (seconds: number) => {
    if (videoRef.current) videoRef.current.currentTime += seconds;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen();
    else document.exitFullscreen();
  };

  const formatTime = (t: number) => {
    if (isNaN(t)) return "00:00";
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = Math.floor(t % 60);
    if (h > 0)
      return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
    return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black border-3 border-black shadow-[6px_6px_0px_0px_black] group"
      style={{ cursor: showControls ? "default" : "none" }}
    >
      <video ref={videoRef} poster={poster} className="w-full h-auto" onClick={togglePlayPause} />

      {!isAuthenticated && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center p-6 bg-back border-3 border-black shadow-[6px_6px_0px_0px_black]">
            <p className="text-lg font-bold mb-2">Please sign in to watch</p>
            <p className="text-sm text-gray-600">Authentication required for video playback</p>
          </div>
        </div>
      )}

      {billingError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center p-6 bg-back border-3 border-black shadow-[6px_6px_0px_0px_red]">
            <p className="text-lg font-bold mb-2 text-red-600">Billing Error</p>
            <p className="text-sm">{billingError}</p>
          </div>
        </div>
      )}

      {isAuthenticated && showControls && (
        <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-black/70 border-2 border-primary text-back text-sm font-mono">
          <Wallet size={16} className="text-primary" />
          <span>
            ${effectiveBalance.toFixed(4)}
            {pendingDeduction > 0 && (
              <span className="text-yellow-400 ml-1">(-${pendingDeduction.toFixed(4)})</span>
            )}
          </span>
        </div>
      )}

      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-4 transition-all duration-300 ${
          showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <div className="mb-3">
          <div className="relative h-2 bg-back/30 border-2 border-black">
            <div className="absolute h-full bg-primary transition-all duration-100" style={{ width: `${progress}%` }} />
            <input type="range" min="0" max={duration} value={currentTime}
              onChange={handleProgressChange} className="absolute w-full h-full opacity-0 cursor-pointer" />
          </div>
          <div className="flex justify-between mt-1 text-xs text-back">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={togglePlayPause}
              className="p-2 bg-primary border-2 border-black hover:bg-primary/80 transition-all hover:shadow-[3px_3px_0px_0px_black]"
              aria-label={isPlaying ? "Pause" : "Play"}>
              {isPlaying ? <Pause size={20} className="text-back" /> : <Play size={20} className="text-back" />}
            </button>

            <button onClick={() => skip(-10)}
              className="p-2 bg-secondary border-2 border-black hover:bg-secondary/80 transition-all hover:shadow-[3px_3px_0px_0px_black]"
              aria-label="Skip back 10 seconds">
              <div className="relative">
                <RotateCcw size={22} className="text-black" />
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-bold text-black">10</span>
              </div>
            </button>

            <button onClick={() => skip(10)}
              className="p-2 bg-secondary border-2 border-black hover:bg-secondary/80 transition-all hover:shadow-[3px_3px_0px_0px_black]"
              aria-label="Skip forward 10 seconds">
              <div className="relative">
                <RotateCw size={22} className="text-black" />
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-bold text-black">10</span>
              </div>
            </button>

            <div ref={volumeControlRef} className="relative flex items-center"
              onMouseEnter={() => setShowVolumeSlider(true)}
              onMouseLeave={() => setShowVolumeSlider(false)}>
              <button onClick={toggleMute}
                className="relative z-20 p-2 bg-tertiary border-2 border-black hover:bg-tertiary/80 transition-all hover:shadow-[3px_3px_0px_0px_black]"
                aria-label={isMuted ? "Unmute" : "Mute"}>
                {isMuted || volume === 0
                  ? <VolumeX size={20} className="text-back" />
                  : <Volume2 size={20} className="text-back" />}
              </button>

              {showVolumeSlider && (
                <div className="absolute z-10 -bottom-4 left-0 mb-2 p-3 bg-black border-2 border-black shadow-[3px_3px_0px_0px_black]"
                  onMouseEnter={() => setShowVolumeSlider(true)}
                  onMouseLeave={() => setShowVolumeSlider(false)}>
                  <div className="flex items-center justify-center">
                    <input type="range" min="0" max="1" step="0.05" value={volume}
                      onChange={handleVolumeChange}
                      className="w-20 accent-tertiary cursor-pointer"
                      style={{ writingMode: "horizontal-tb", direction: "ltr" }} />
                  </div>
                  <div className="text-center text-xs text-back ml-5 py-3">{Math.round(volume * 100)}%</div>
                </div>
              )}
            </div>
          </div>

          <button onClick={toggleFullscreen}
            className="p-2 bg-primary border-2 border-black hover:bg-primary/80 transition-all hover:shadow-[3px_3px_0px_0px_black]"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
            {isFullscreen ? <Minimize size={20} className="text-back" /> : <Maximize size={20} className="text-back" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;