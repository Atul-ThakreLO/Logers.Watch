"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { videoService, VideoStatusResult } from "@/lib/api/video";
import {
  Loader2,
  Upload,
  Video as VideoIcon,
  AlertCircle,
  Check,
  File,
  X,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";

type UploadStage = "select" | "uploading" | "processing" | "complete" | "error";

export default function UploadVideoPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStatus, setProcessingStatus] =
    useState<VideoStatusResult | null>(null);
  const [stage, setStage] = useState<UploadStage>("select");
  const [error, setError] = useState("");
  const [videoId, setVideoId] = useState("");

  useEffect(() => {
    // Check for any pending videos when the component mounts
    let isMounted = true;

    const checkPendingVideos = async () => {
      try {
        const { videos } = await videoService.getPendingVideos();
        if (videos && videos.length > 0 && isMounted) {
          // If there's a pending video, resume tracking surface
          const pendingVideo = videos[0];

          // If queue says completed but DB hasn't reached READY yet,
          // don't keep showing a stuck completion state.
          if (
            pendingVideo.jobProgress?.state === "completed" &&
            pendingVideo.video.status !== "READY"
          ) {
            setStage("select");
            return;
          }

          setVideoId(pendingVideo.video.videoId);
          setTitle(pendingVideo.video.title || "");
          setStage("processing");

          if (pendingVideo.jobProgress) {
            setProcessingStatus(pendingVideo);
          }

          try {
            await videoService.pollVideoStatus(
              pendingVideo.video.videoId,
              (status) => {
                if (isMounted) setProcessingStatus(status);
              },
              2000,
              300,
            );

            if (isMounted) {
              setStage("complete");
              setTimeout(() => {
                if (isMounted) router.push("/creator/videos");
              }, 3000);
            }
          } catch (err: any) {
            if (isMounted) {
              setStage("error");
              setError(
                err.response?.data?.error || err.message || "Processing failed",
              );
            }
          }
        }
      } catch (err) {
        console.error("Failed to check pending videos:", err);
      }
    };

    checkPendingVideos();

    return () => {
      isMounted = false;
    };
  }, [router]);
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        // Validate file type
        const allowedTypes = [
          "video/mp4",
          "video/webm",
          "video/quicktime",
          "video/x-msvideo",
        ];
        if (!allowedTypes.includes(file.type)) {
          setError("Invalid file type. Allowed: MP4, WebM, MOV, AVI");
          return;
        }

        // Validate file size (2GB max)
        const maxSize = 2 * 1024 * 1024 * 1024;
        if (file.size > maxSize) {
          setError("File too large. Maximum size: 2GB");
          return;
        }

        setSelectedFile(file);
        setError("");
      }
    },
    [],
  );

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      const allowedTypes = [
        "video/mp4",
        "video/webm",
        "video/quicktime",
        "video/x-msvideo",
      ];
      if (!allowedTypes.includes(file.type)) {
        setError("Invalid file type. Allowed: MP4, WebM, MOV, AVI");
        return;
      }

      const maxSize = 2 * 1024 * 1024 * 1024;
      if (file.size > maxSize) {
        setError("File too large. Maximum size: 2GB");
        return;
      }

      setSelectedFile(file);
      setError("");
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const removeFile = useCallback(() => {
    setSelectedFile(null);
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select a video file");
      return;
    }

    setError("");
    setStage("uploading");
    setUploadProgress(0);

    try {
      // Upload the video
      const uploadResult = await videoService.uploadVideo(
        selectedFile,
        title || undefined,
        (progress) => setUploadProgress(progress),
      );

      // Ensure UI does not stay below 100% when upload request completes.
      setUploadProgress(100);

      setVideoId(uploadResult.video.videoId);
      setStage("processing");

      // Poll for processing status
      await videoService.pollVideoStatus(
        uploadResult.video.videoId,
        (status) => setProcessingStatus(status),
        2000,
        300,
      );

      setStage("complete");
      setTimeout(() => {
        router.push("/creator/videos");
      }, 3000);
    } catch (err: any) {
      setStage("error");
      setError(err.response?.data?.error || err.message || "Upload failed");
    }
  };

  // Render different stages
  const renderStage = () => {
    switch (stage) {
      case "uploading":
        return (
          <div className="text-center py-12">
            <Loader2 className="w-16 h-16 text-secondary animate-spin mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-white mb-2">
              Uploading Video
            </h2>
            <p className="text-gray-400 mb-6">Please don't close this page</p>
            <div className="max-w-md mx-auto">
              <div className="flex justify-between text-sm text-gray-400 mb-2">
                <span>Progress</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-4 bg-gray-700 border-2 border-gray-600 overflow-hidden">
                <div
                  className="h-full bg-secondary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          </div>
        );

      case "processing":
        const isReady = processingStatus?.video.status === "READY";
        const isFailed = processingStatus?.video.status === "FAILED";
        const state = isReady
          ? "completed"
          : (processingStatus?.jobProgress?.state ?? "waiting");
        const rawProgress = processingStatus?.jobProgress?.progress ?? 0;
        const progress = isReady
          ? 100
          : state === "waiting" || state === "delayed"
            ? Math.max(rawProgress, 5)
            : state === "active"
              ? Math.max(rawProgress, 10)
              : Math.min(rawProgress, 99);

        if (isFailed) {
          return (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-red-500/20 border-2 border-red-400 flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10 text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Processing Failed
              </h2>
              <p className="text-red-400 mb-6">
                {processingStatus?.video.errorMessage ||
                  "Video processing failed"}
              </p>
            </div>
          );
        }

        return (
          <div className="text-center py-12">
            <Clock className="w-16 h-16 text-blue-400 animate-pulse mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-white mb-2">
              Processing Video
            </h2>
            <p className="text-gray-400 mb-6">Converting to DASH format...</p>
            <div className="max-w-md mx-auto">
              <div className="flex justify-between text-sm text-gray-400 mb-2">
                <span className="capitalize">{state}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-4 bg-gray-700 border-2 border-gray-600 overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 mt-4">Video ID: {videoId}</p>
            </div>
          </div>
        );

      case "complete":
        return (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-green-500/20 border-2 border-green-400 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Upload Complete!
            </h2>
            <p className="text-gray-400 mb-4">
              Your video has been processed and is ready to stream.
            </p>
            <p className="text-sm text-gray-500">
              Redirecting to videos page...
            </p>
          </div>
        );

      case "error":
        return (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-red-500/20 border-2 border-red-400 flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Upload Failed
            </h2>
            <p className="text-red-400 mb-6">{error}</p>
            <button
              onClick={() => {
                setStage("select");
                setError("");
                setUploadProgress(0);
                setProcessingStatus(null);
              }}
              className="bg-secondary text-gray-900 px-6 py-3 border-2 border-black font-semibold hover:shadow-[4px_4px_0_0_#000] transition-all"
            >
              Try Again
            </button>
          </div>
        );

      default:
        return (
          <div className="space-y-6">
            {/* Title Input */}
            <div>
              <label
                htmlFor="title"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Video Title (Optional)
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My Awesome Video"
                className="w-full px-4 py-3 bg-gray-700 border-2 border-gray-600 text-white placeholder-gray-500 focus:ring-2 focus:ring-secondary focus:border-secondary"
              />
            </div>

            {/* Drop Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed p-12 text-center cursor-pointer transition-all ${
                selectedFile
                  ? "border-green-400 bg-green-500/10"
                  : "border-gray-600 hover:border-secondary bg-gray-900"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
                onChange={handleFileSelect}
                className="hidden"
              />

              {selectedFile ? (
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-green-500/20 border-2 border-green-400 flex items-center justify-center mb-4">
                    <VideoIcon className="w-8 h-8 text-green-400" />
                  </div>
                  <p className="text-white font-medium mb-1">
                    {selectedFile.name}
                  </p>
                  <p className="text-gray-400 text-sm mb-4">
                    {formatFileSize(selectedFile.size)}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile();
                    }}
                    className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm"
                  >
                    <X className="w-4 h-4" />
                    Remove file
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-white font-medium mb-2">
                    Drop your video file here
                  </p>
                  <p className="text-gray-400 text-sm mb-4">
                    or click to browse
                  </p>
                  <p className="text-gray-500 text-xs">
                    MP4, WebM, MOV, AVI up to 2GB
                  </p>
                </>
              )}
            </div>

            {error && (
              <div className="p-4 bg-red-500/20 border-2 border-red-500 text-red-400 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 shrink-0" />
                {error}
              </div>
            )}

            {/* Upload Button */}
            <button
              onClick={handleUpload}
              disabled={!selectedFile}
              className="w-full bg-secondary text-gray-900 py-4 border-2 border-black font-semibold hover:shadow-[4px_4px_0_0_#000] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Upload className="h-5 w-5" />
              Upload & Process Video
            </button>
          </div>
        );
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Upload Video</h1>
        <p className="text-gray-400 mt-1">
          Upload a video file to be processed and streamed
        </p>
      </div>

      {/* Main Content */}
      <div className="bg-gray-800 p-8 border-2 border-gray-600 hover:shadow-[4px_4px_0_0_#facc15] transition-shadow">
        {renderStage()}
      </div>

      {/* Info Section */}
      {stage === "select" && (
        <div className="bg-gray-800 p-6 border-2 border-gray-600">
          <h3 className="font-semibold text-white mb-4">How it works</h3>
          <div className="space-y-3 text-sm text-gray-400">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-secondary text-gray-900 font-bold flex items-center justify-center shrink-0">
                1
              </div>
              <p>Upload your video file (MP4, WebM, MOV, or AVI)</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-secondary text-gray-900 font-bold flex items-center justify-center shrink-0">
                2
              </div>
              <p>
                Our server converts it to DASH format for adaptive streaming
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-secondary text-gray-900 font-bold flex items-center justify-center shrink-0">
                3
              </div>
              <p>Your video becomes available for viewers to watch and earn</p>
            </div>
          </div>
        </div>
      )}

      {/* Processing Times Info */}
      {(stage === "uploading" || stage === "processing") && (
        <div className="bg-blue-500/10 border-2 border-blue-500 p-4 text-sm text-blue-300">
          <p>
            <strong>Note:</strong> Processing time depends on video length and
            resolution. A 10-minute video typically takes 2-5 minutes to
            process.
          </p>
        </div>
      )}
    </div>
  );
}
