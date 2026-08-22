import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { RotateCw, MoveHorizontal, ArrowUpRight } from "lucide-react";
import jacketVideoAsset from "../assets/field-jacket-360.mp4";

export default function JacketVideoScrubber({ product }) {
  const boxRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [isLoaded, setIsLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);

  const framesRef = useRef([]);       // Array of pre-decoded ImageBitmap frames
  const totalFramesRef = useRef(0);
  const targetProgressRef = useRef(0);
  const dragStartXRef = useRef(0);
  const dragStartProgressRef = useRef(0);
  const isDraggingRef = useRef(false);

  const productData = product || {
    _id: "evermore-field-jacket",
    id: "evermore-field-jacket",
    name: "Field Jacket",
    price: 128,
  };

  // Draw a specific frame index to the visible canvas
  const drawFrameIndex = (index) => {
    const canvas = canvasRef.current;
    const frames = framesRef.current;
    if (!canvas || !frames.length) return;

    const safeIndex = Math.max(0, Math.min(index, frames.length - 1));
    const frame = frames[safeIndex];
    if (!frame) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (canvas.width !== frame.width || canvas.height !== frame.height) {
      canvas.width = frame.width;
      canvas.height = frame.height;
    }

    ctx.drawImage(frame, 0, 0);
  };

  // Pre-decode ALL video frames into an ImageBitmap array on load
  // This completely bypasses video.currentTime seeking
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;

    const extractFrames = async () => {
      // Wait for video metadata
      await new Promise((resolve) => {
        if (video.readyState >= 1) return resolve();
        video.addEventListener("loadedmetadata", resolve, { once: true });
      });

      const duration = video.duration;
      if (!duration || isNaN(duration)) return;

      // Estimate total frames (assume ~30fps, cap at 200 for safety)
      const fps = 30;
      const estimatedFrames = Math.min(Math.round(duration * fps), 200);
      const frames = [];

      // Create offscreen canvas for frame capture
      const offCanvas = document.createElement("canvas");
      const offCtx = offCanvas.getContext("2d");

      // Wait for enough data to seek
      await new Promise((resolve) => {
        if (video.readyState >= 2) return resolve();
        video.addEventListener("canplay", resolve, { once: true });
      });

      // iOS Safari unlock: play then immediately pause
      try {
        await video.play();
        video.pause();
      } catch (e) {
        // Autoplay blocked, that's fine — we just need it paused
      }

      // Extract each frame by seeking to it
      for (let i = 0; i < estimatedFrames; i++) {
        if (cancelled) return;

        const time = (i / estimatedFrames) * duration;

        // Seek and wait for the frame to actually decode
        video.currentTime = time;
        await new Promise((resolve) => {
          video.addEventListener("seeked", resolve, { once: true });
        });

        // Set canvas size on first frame
        if (i === 0) {
          offCanvas.width = video.videoWidth;
          offCanvas.height = video.videoHeight;
        }

        // Capture the decoded frame
        offCtx.drawImage(video, 0, 0, offCanvas.width, offCanvas.height);

        try {
          const bitmap = await createImageBitmap(offCanvas);
          frames.push(bitmap);
        } catch (e) {
          // Fallback: store as ImageData
          const imgData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
          frames.push(imgData);
        }

        setLoadProgress(Math.round(((i + 1) / estimatedFrames) * 100));
      }

      if (cancelled) return;

      framesRef.current = frames;
      totalFramesRef.current = frames.length;
      setIsLoaded(true);

      // Draw the first frame immediately
      drawFrameIndex(0);
    };

    extractFrames().catch((err) => {
      console.error("Frame extraction failed:", err);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Wheel handler: updates target progress, draws from pre-decoded frames
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    const handleWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const delta = e.deltaY * 0.0003; // Much slower rotation
      targetProgressRef.current += delta;

      let wrapped = targetProgressRef.current % 1;
      if (wrapped < 0) wrapped += 1;
      targetProgressRef.current = wrapped;

      setScrollProgress(wrapped);

      // Draw from pre-decoded frames array — instant, no seeking
      const totalFrames = totalFramesRef.current;
      if (totalFrames > 0) {
        const frameIndex = Math.round(wrapped * (totalFrames - 1));
        drawFrameIndex(frameIndex);
      }
    };

    box.addEventListener("wheel", handleWheel, { passive: false });
    return () => box.removeEventListener("wheel", handleWheel);
  }, []);

  // Mobile touch & mouse drag support
  const handlePointerDown = (e) => {
    isDraggingRef.current = true;
    const clientX =
      e.clientX !== undefined
        ? e.clientX
        : e.touches && e.touches[0]
        ? e.touches[0].clientX
        : 0;
    dragStartXRef.current = clientX;
    dragStartProgressRef.current = targetProgressRef.current;
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return;
    const box = boxRef.current;
    if (!box) return;

    if (e.touches) {
      e.preventDefault();
    }

    const clientX =
      e.clientX !== undefined
        ? e.clientX
        : e.touches && e.touches[0]
        ? e.touches[0].clientX
        : 0;
    const deltaX = clientX - dragStartXRef.current;
    const boxWidth = box.offsetWidth || 400;

    const deltaProgress = -deltaX / (boxWidth * 0.6);
    let wrapped = (dragStartProgressRef.current + deltaProgress) % 1;
    if (wrapped < 0) wrapped += 1;

    targetProgressRef.current = wrapped;
    setScrollProgress(wrapped);

    const totalFrames = totalFramesRef.current;
    if (totalFrames > 0) {
      const frameIndex = Math.round(wrapped * (totalFrames - 1));
      drawFrameIndex(frameIndex);
    }
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  useEffect(() => {
    const handleUp = () => {
      isDraggingRef.current = false;
    };
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchend", handleUp);
    return () => {
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchend", handleUp);
    };
  }, []);

  const degrees = Math.round(scrollProgress * 360);

  return (
    <div
      ref={boxRef}
      className="relative w-full aspect-square rounded-3xl bg-black border border-gold/30 flex flex-col items-center justify-center overflow-hidden shadow-2xl group select-none transition-all duration-300 hover:border-gold/60 cursor-grab active:cursor-grabbing"
      onMouseDown={handlePointerDown}
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onTouchStart={handlePointerDown}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}
    >
      {/* Top Header Bar */}
      <div className="absolute top-3.5 left-3.5 right-3.5 z-30 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/15 rounded-full px-3 py-1.5 shadow-lg text-xs font-mono-label text-white">
          <RotateCw size={13} className="text-gold animate-spin-slow" />
          <span className="tracking-wide">360° Interactive</span>
          <span className="bg-gold/20 text-gold font-semibold px-1.5 py-0.5 rounded text-[10px]">
            {`${degrees}°`}
          </span>
        </div>

        <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md border border-white/15 text-white text-[11px] px-3 py-1.5 rounded-full font-mono-label shadow opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <MoveHorizontal size={12} className="text-gold" />
          <span>Hover & Scroll</span>
        </div>
      </div>

      {/* Canvas Frame Display */}
      <div className="w-full h-full flex items-center justify-center bg-black relative">
        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain pointer-events-none transition-transform duration-300 group-hover:scale-105"
        />

        {/* Hidden video element for frame extraction only */}
        <video
          ref={videoRef}
          muted
          playsInline
          preload="auto"
          crossOrigin="anonymous"
          style={{
            position: "absolute",
            width: "1px",
            height: "1px",
            opacity: 0,
            pointerEvents: "none",
          }}
        >
          <source src={jacketVideoAsset} type="video/mp4" />
        </video>

        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-xs z-10">
            <div className="flex flex-col items-center gap-3">
              <RotateCw size={20} className="animate-spin text-gold" />
              <span className="text-xs font-mono-label text-gold">
                Loading 360° frames...
              </span>
              <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-gold via-amber-300 to-gold rounded-full transition-all duration-150"
                  style={{ width: `${loadProgress}%` }}
                />
              </div>
              <span className="text-[10px] font-mono-label text-white/50">
                {loadProgress}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Info Glass Card */}
      <div className="absolute bottom-3.5 left-3.5 right-3.5 z-30 pointer-events-auto">
        <Link
          to={`/product/${productData._id || productData.id}`}
          className="group/btn block bg-black/80 backdrop-blur-xl border border-white/15 hover:border-gold/50 rounded-2xl overflow-hidden shadow-2xl transition-all duration-200"
        >
          <div className="w-full h-1 bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-gold via-amber-300 to-gold transition-all duration-75"
              style={{ width: `${scrollProgress * 100}%` }}
            />
          </div>

          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-white leading-tight">{productData.name}</p>
                <span className="font-mono-label text-[10px] uppercase bg-gold/20 text-gold px-1.5 py-0.5 rounded">
                  3D View
                </span>
              </div>
              <p className="font-mono-label text-xs text-white/70 leading-tight mt-0.5">
                ${productData.price} USD
              </p>
            </div>

            <div className="flex items-center gap-1 text-xs font-mono-label text-gold font-medium bg-gold/10 group-hover/btn:bg-gold group-hover/btn:text-black px-3 py-1.5 rounded-full transition-all duration-200">
              <span>View Details</span>
              <ArrowUpRight size={13} />
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
