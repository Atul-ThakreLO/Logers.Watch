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

interface VideoPlayerProps {
  videoId: string;
  poster?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoId, poster }) => {
  const { accessToken, isAuthenticated, user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<MediaPlayerClass | null>(null);
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

  // Billing WebSocket
  const {
    isConnected: isBillingConnected,
    pendingDeduction,
    effectiveBalance,
    connect: connectBilling,
    disconnect: disconnectBilling,
    startSession,
    endSession,
  } = useBillingWebSocket(accessToken, {
    onBalanceUpdate: (pending, balance) => {
      console.log(
        `[Billing] Balance update: pending=$${pending.toFixed(4)}, effective=$${balance.toFixed(2)}`,
      );
    },
    onSessionStarted: (session) => {
      console.log("[Billing] Session started:", session);
    },
    onSessionEnded: (settlement) => {
      console.log("[Billing] Session ended, settlement:", settlement);
    },
    onError: (error) => {
      console.error("[Billing] Error:", error);
      setBillingError(error);
    },
  });

  // Connect to billing WebSocket when authenticated
  useEffect(() => {
    if (isAuthenticated && accessToken) {
      connectBilling();
    }
    return () => {
      disconnectBilling();
    };
  }, [isAuthenticated, accessToken, connectBilling, disconnectBilling]);

  // Start billing session when video starts playing
  useEffect(() => {
    if (isPlaying && isBillingConnected && videoId) {
      startSession(videoId);
    }
  }, [isPlaying, isBillingConnected, videoId, startSession]);

  // End billing session when component unmounts or video stops
  useEffect(() => {
    return () => {
      if (isBillingConnected) {
        endSession();
      }
    };
  }, [isBillingConnected, endSession]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => setDuration(video.duration);
    const handleEnded = () => setIsPlaying(false);

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("ended", handleEnded);
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Build the streaming URL
  const streamingUrl = `${API_BASE}/api/v1/videos/stream/${videoId}/manifest.mpd`;

  useEffect(() => {
    if (videoRef.current && isAuthenticated) {
      // 1. Create a new dash.js MediaPlayer instance
      playerRef.current = MediaPlayer().create();

      playerRef.current?.updateSettings({
        streaming: {
          abr: {
            autoSwitchBitrate: { video: true },
            maxBitrate: { video: 200 },
          },
          buffer: {
            fastSwitchEnabled: true,
          },
        },
      });

      playerRef.current.setXHRWithCredentialsForType("MPD", true);
      playerRef.current.setXHRWithCredentialsForType("MediaSegment", true);
      playerRef.current.setXHRWithCredentialsForType(
        "InitializationSegment",
        true,
      );

      // 2. Initialize the player with the video element and the DASH manifest URL
      playerRef.current.initialize(videoRef.current, streamingUrl, false);

      // Optional: Add event listeners for error handling or monitoring
      playerRef.current.on(MediaPlayer.events.ERROR, (event) => {
        console.error("Dash.js error:", event.error);
        // Check for 402 Payment Required
        const errorObj = event.error;
        if (
          typeof errorObj === "object" &&
          errorObj !== null &&
          "message" in errorObj
        ) {
          const msg = (errorObj as { message: string }).message;
          if (msg.includes("402") || msg.includes("Insufficient balance")) {
            setBillingError(
              "Insufficient balance. Please add funds to continue watching.",
            );
          }
        }
      });
    }

    // 3. Clean up the player instance when the component unmounts
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [streamingUrl, isAuthenticated]);

  // Auto-hide controls
  useEffect(() => {
    const resetHideTimer = () => {
      setShowControls(true);
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
      hideControlsTimeoutRef.current = setTimeout(() => {
        if (isPlaying) {
          setShowControls(false);
        }
      }, 3000); // Hide after 3 seconds of inactivity
    };

    const handleMouseMove = () => resetHideTimer();
    const handleMouseLeave = () => {
      if (isPlaying) {
        hideControlsTimeoutRef.current = setTimeout(() => {
          setShowControls(false);
        }, 1000);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("mousemove", handleMouseMove);
      container.addEventListener("mouseleave", handleMouseLeave);
    }

    return () => {
      if (container) {
        container.removeEventListener("mousemove", handleMouseMove);
        container.removeEventListener("mouseleave", handleMouseLeave);
      }
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
    };
  }, [isPlaying]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default for specific keys
      if (
        [
          "Space",
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "KeyF",
          "KeyM",
        ].includes(e.code)
      ) {
        e.preventDefault();
      }

      switch (e.code) {
        case "Space":
          togglePlayPause();
          break;
        case "KeyK":
          togglePlayPause();
          break;
        case "ArrowLeft":
          skip(-5);
          break;
        case "ArrowRight":
          skip(5);
          break;
        case "KeyJ":
          skip(-10);
          break;
        case "KeyL":
          skip(10);
          break;
        case "ArrowUp":
          adjustVolume(0.1);
          break;
        case "ArrowDown":
          adjustVolume(-0.1);
          break;
        case "KeyM":
          toggleMute();
          break;
        case "KeyF":
          toggleFullscreen();
          break;
        case "Digit0":
        case "Digit1":
        case "Digit2":
        case "Digit3":
        case "Digit4":
        case "Digit5":
        case "Digit6":
        case "Digit7":
        case "Digit8":
        case "Digit9":
          const digit = parseInt(e.code.replace("Digit", ""));
          if (videoRef.current && duration) {
            videoRef.current.currentTime = (duration * digit) / 10;
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, duration]);

  const adjustVolume = (delta: number) => {
    const newVolume = Math.max(0, Math.min(1, volume + delta));
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      if (newVolume === 0) {
        setIsMuted(true);
      } else if (isMuted) {
        setIsMuted(false);
        videoRef.current.muted = false;
      }
    }
  };

  function setVideoQuality(bitrateKbps: number | "auto") {
    if (bitrateKbps === "auto") {
      playerRef.current?.updateSettings({
        streaming: {
          abr: {
            autoSwitchBitrate: { video: true },
            maxBitrate: { video: -1 }, // remove cap
          },
        },
      });
      return;
    }

    playerRef.current?.updateSettings({
      streaming: {
        abr: {
          autoSwitchBitrate: { video: true },
          maxBitrate: { video: 1500 },
        },
      },
    });
  }

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      if (newVolume === 0) {
        setIsMuted(true);
      } else if (isMuted) {
        setIsMuted(false);
      }
    }
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const skip = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime += seconds;
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00";
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);

    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black border-3 border-black shadow-[6px_6px_0px_0px_black] group"
      style={{ cursor: showControls ? "default" : "none" }}
    >
      <video
        ref={videoRef}
        poster={poster}
        className="w-full h-auto"
        onClick={togglePlayPause}
      />

      {/* Auth/Billing Error Overlay */}
      {!isAuthenticated && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center p-6 bg-back border-3 border-black shadow-[6px_6px_0px_0px_black]">
            <p className="text-lg font-bold mb-2">Please sign in to watch</p>
            <p className="text-sm text-gray-600">
              Authentication required for video playback
            </p>
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

      {/* Balance Indicator */}
      {isAuthenticated && showControls && (
        <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-black/70 border-2 border-primary text-back text-sm font-mono">
          <Wallet size={16} className="text-primary" />
          <span>
            ${effectiveBalance.toFixed(4)}
            {pendingDeduction > 0 && (
              <span className="text-yellow-400 ml-1">
                (-${pendingDeduction.toFixed(4)})
              </span>
            )}
          </span>
        </div>
      )}

      {/* Custom Controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-4 transition-all duration-300 ${
          showControls
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        {/* Progress Bar */}
        <div className="mb-3">
          <div className="relative h-2 bg-back/30 border-2 border-black">
            <div
              className="absolute h-full bg-primary transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
            <input
              type="range"
              min="0"
              max={duration}
              value={currentTime}
              onChange={handleProgressChange}
              className="absolute w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-back">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Play/Pause */}
            <button
              onClick={togglePlayPause}
              className="p-2 bg-primary border-2 border-black hover:bg-primary/80 transition-all hover:shadow-[3px_3px_0px_0px_black]"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause size={20} className="text-back" />
              ) : (
                <Play size={20} className="text-back" />
              )}
            </button>

            {/* Skip Back */}
            <button
              onClick={() => skip(-10)}
              className="p-2 bg-secondary border-2 border-black hover:bg-secondary/80 transition-all hover:shadow-[3px_3px_0px_0px_black]"
              aria-label="Skip back 10 seconds"
            >
              <div className="relative">
                <RotateCcw size={22} className="text-black" />
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-bold text-black">
                  10
                </span>
              </div>
            </button>

            {/* Skip Forward */}
            <button
              onClick={() => skip(10)}
              className="p-2 bg-secondary border-2 border-black hover:bg-secondary/80 transition-all hover:shadow-[3px_3px_0px_0px_black]"
              aria-label="Skip forward 10 seconds"
            >
              <div className="relative">
                <RotateCw size={22} className="text-black" />
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-bold text-black">
                  10
                </span>
              </div>
            </button>

            {/* Volume */}
            <div
              ref={volumeControlRef}
              className="relative flex items-center"
              onMouseEnter={() => setShowVolumeSlider(true)}
              onMouseLeave={() => setShowVolumeSlider(false)}
            >
              <button
                onClick={toggleMute}
                className="relative z-20 p-2 bg-tertiary border-2 border-black hover:bg-tertiary/80 transition-all hover:shadow-[3px_3px_0px_0px_black]"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX size={20} className="text-back" />
                ) : (
                  <Volume2 size={20} className="text-back" />
                )}
              </button>

              {/* Volume Slider */}
              {showVolumeSlider && (
                <div
                  className="absolute z-10 -bottom-4 left-0 mb-2 p-3 bg-black border-2 border-black shadow-[3px_3px_0px_0px_black]"
                  onMouseEnter={() => setShowVolumeSlider(true)}
                  onMouseLeave={() => setShowVolumeSlider(false)}
                >
                  <div className=" flex items-center justify-center">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={volume}
                      onChange={handleVolumeChange}
                      className="w-20 accent-tertiary cursor-pointer"
                      style={{
                        writingMode: "horizontal-tb",
                        direction: "ltr",
                      }}
                    />
                  </div>
                  <div className="text-center text-xs text-back ml-5 py-3">
                    {Math.round(volume * 100)}%
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-2 bg-primary border-2 border-black hover:bg-primary/80 transition-all hover:shadow-[3px_3px_0px_0px_black]"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <Minimize size={20} className="text-back" />
            ) : (
              <Maximize size={20} className="text-back" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
