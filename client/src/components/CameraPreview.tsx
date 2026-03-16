import { useRef, useEffect } from "react";
import { MicOff, Video } from "lucide-react";

interface CameraPreviewProps {
  stream: MediaStream | null;
  isMuted: boolean;
  isVideoOff?: boolean;
  position?: "bottom-right" | "bottom-left";
}

export function CameraPreview({
  stream,
  isMuted,
  isVideoOff = false,
  position = "bottom-right",
}: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // If no stream or video is off, show the video off indicator
  if (!stream || isVideoOff) {
    return (
      <div
        className={`absolute ${
          position === "bottom-right" ? "bottom-4 right-4" : "bottom-4 left-4"
        } z-20 flex h-[120px] w-[160px] items-center justify-center rounded-xl border-2 border-white/20 bg-card shadow-lg`}
      >
        <Video className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  const positionClasses =
    position === "bottom-right"
      ? "bottom-4 right-4"
      : "bottom-4 left-4";

  return (
    <div
      className={`absolute ${positionClasses} z-20 overflow-hidden rounded-xl border-2 border-white/20 shadow-lg`}
      style={{
        width: 160,
        height: 120,
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="h-full w-full object-cover"
        style={{ transform: "scaleX(-1)" }}
      />

      {/* Overlay indicators */}
      <div className="absolute bottom-1.5 left-1.5 flex gap-1">
        {isMuted ? (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500">
            <MicOff className="h-3 w-3 text-white" />
          </div>
        ) : (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500" />
        )}
      </div>
    </div>
  );
}
