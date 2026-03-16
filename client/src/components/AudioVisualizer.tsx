import { useEffect, useRef, useCallback } from "react";

interface AudioVisualizerProps {
  audioLevel: number; // 0-1 normalized amplitude
  isActive: boolean; // Show when interview is active
  size?: number; // Diameter in pixels (default: 200)
}

export function AudioVisualizer({
  audioLevel,
  isActive,
  size = 200,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const smoothLevelRef = useRef(0);
  const animationRef = useRef<number | null>(null);
  const audioLevelRef = useRef(0);

  // Keep audioLevel fresh in ref for animation loop
  useEffect(() => {
    audioLevelRef.current = audioLevel;
  }, [audioLevel]);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, centerX: number, centerY: number) => {
      // Smooth the audio level
      const smoothingFactor = 0.2;
      smoothLevelRef.current =
        smoothLevelRef.current * (1 - smoothingFactor) +
        audioLevelRef.current * smoothingFactor;

      const level = smoothLevelRef.current;

      // Clear canvas
      ctx.clearRect(0, 0, size, size);

      if (!isActive) {
        // Draw subtle static circles when idle
        const baseRadius = size * 0.2;

        for (let i = 0; i < 3; i++) {
          const radius = baseRadius + i * (size * 0.1);
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(99, 102, 241, ${0.12 - i * 0.03})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Small center dot
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(99, 102, 241, 0.25)";
        ctx.fill();
        return;
      }

      // Draw circular pulse visualizer around the avatar
      const numRings = 4;
      const baseRadius = size * 0.25;

      for (let i = 0; i < numRings; i++) {
        const progress = i / numRings;
        const radius = baseRadius + progress * (size * 0.2);

        // Pulse effect - rings expand based on audio level
        const expansion = level * (size * 0.15) * progress;
        const alpha = Math.max(0, 0.5 - progress * 0.4) * (0.2 + level * 0.8);

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + expansion, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(139, 92, 246, ${alpha})`; // Violet color
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Draw outer glow
      const glowRadius = baseRadius * 1.8 * (1 + level * 0.3);
      const glowGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        baseRadius * 0.5,
        centerX,
        centerY,
        glowRadius
      );
      glowGradient.addColorStop(0, `rgba(139, 92, 246, ${0.15 * level})`);
      glowGradient.addColorStop(0.5, `rgba(139, 92, 246, ${0.05 * level})`);
      glowGradient.addColorStop(1, "rgba(139, 92, 246, 0)");

      ctx.beginPath();
      ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = glowGradient;
      ctx.fill();

      // Draw audio bars around the ring (like a waveform)
      const barCount = 24;
      const barRadius = baseRadius * 1.2;
      const maxBarLen = size * 0.12;

      for (let i = 0; i < barCount; i++) {
        const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
        // Create wave-like pattern
        const wave = Math.sin(Date.now() / 200 + i * 0.5) * 0.3 + 0.7;
        const barLength = maxBarLen * level * wave * (0.6 + Math.sin(i * 0.8) * 0.4);
        const x1 = centerX + Math.cos(angle) * barRadius;
        const y1 = centerY + Math.sin(angle) * barRadius;
        const x2 = centerX + Math.cos(angle) * (barRadius + barLength);
        const y2 = centerY + Math.sin(angle) * (barRadius + barLength);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = `rgba(139, 92, 246, ${0.3 + level * 0.5})`;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.stroke();
      }
    },
    [isActive, size]
  );

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size with device pixel ratio
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const centerX = size / 2;
    const centerY = size / 2;

    const animate = () => {
      draw(ctx, centerX, centerY);
      animationRef.current = requestAnimationFrame(animate);
    };

    // Start animation
    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [draw, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: size,
        height: size,
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      }}
      className="circular-visualizer pointer-events-none"
    />
  );
}
