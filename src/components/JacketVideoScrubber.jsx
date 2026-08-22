import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { RotateCw, MoveHorizontal, ArrowUpRight, Touchpad } from "lucide-react";
import jacketVideoAsset from "../assets/field-jacket-360.mp4";

export default function JacketVideoScrubber({ product }) {
  const boxRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [isLoaded, setIsLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);

  const framesRef = useRef([]); // Array of pre-decoded ImageBitmap frames
  const totalFramesRef = useRef(0);
  const targetProgressRef = useRef(0);
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
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
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;

    const extractFrames = async () => {
      await new Promise((resolve) => {
        if (video.readyState >= 1) return resolve();
        video.addEventListener("loadedmetadata", resolve, { once: true });
      });

      const duration = video.duration;
      if (!duration || isNaN(duration)) return;

      const fps = 30;
      const estimatedFrames = Math.min(Math.round(duration * fps), 200);
      const frames = [];

      const offCanvas = document.createElement("canvas");
      const offCtx = offCanvas.getContext("2d");

      await new Promise((resolve) => {
        if (video.readyState >= 2) return resolve();
        video.addEventListener("canplay", resolve, { once: true });
      });

      try {
        await video.play();
        video.pause();
      } catch (e) {
        // Autoplay policy fallback
      }

      for (let i = 0; i < estimatedFrames; i++) {
        if (cancelled) return;

        const time = (i / estimatedFrames) * duration;
        video.currentTime = time;

        await new Promise((resolve) => {
          video.addEventListener("seeked", resolve, { once: true });
        });

        if (i === 0) {
          offCanvas.width = video.videoWidth;
          offCanvas.height = video.videoHeight;
        }

        offCtx.drawImage(video, 0, 0, offCanvas.width, offCanvas.height);

        try {
          const bitmap = await createImageBitmap(offCanvas);
          frames.push(bitmap);
        } catch (e) {
          const imgData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
          frames.push(imgData);
        }

        setLoadProgress(Math.round(((i + 1) / estimatedFrames) * 100));
      }

      if (cancelled) return;

      framesRef.current = frames;
      totalFramesRef.current = frames.length;
      setIsLoaded(true);

      drawFrameIndex(0);
    };

    extractFrames().catch((err) => {
      console.error("Frame extraction failed:", err);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Wheel handler for desktop box scrolling
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    const handleWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const delta = e.deltaY * 0.0004; // Smooth tuned scroll sensitivity
      targetProgressRef.current += delta;

      let wrapped = targetProgressRef.current % 1;
      if (wrapped < 0) wrapped += 1;
      targetProgressRef.current = wrapped;

      setScrollProgress(wrapped);

      const totalFrames = totalFramesRef.current;
      if (totalFrames > 0) {
        const frameIndex = Math.round(wrapped * (totalFrames - 1));
        drawFrameIndex(frameIndex);
      }
    };

    box.addEventListener("wheel", handleWheel, { passive: false });
    return () => box.removeEventListener("wheel", handleWheel);
  }, []);

  // Mobile touch & mouse drag support optimized for touch screens
  const handlePointerDown = (e) => {
    isDraggingRef.current = true;
    const clientX =
      e.clientX !== undefined
        ? e.clientX
        : e.touches && e.touches[0]
        ? e.touches[0].clientX
        : 0;
    const clientY =
      e.clientY !== undefined
        ? e.clientY
        : e.touches && e.touches[0]
        ? e.touches[0].clientY
        : 0;

    dragStartXRef.current = clientX;
    dragStartYRef.current = clientY;
    dragStartProgressRef.current = targetProgressRef.current;
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return;
    const box = boxRef.current;
    if (!box) return;

    const clientX =
      e.clientX !== undefined
        ? e.clientX
        : e.touches && e.touches[0]
        ? e.touches[0].clientX
        : 0;
    const clientY =
      e.clientY !== undefined
        ? e.clientY
        : e.touches && e.touches[0]
        ? e.touches[0].clientY
        : 0;

    const deltaX = clientX - dragStartXRef.current;
    const deltaY = clientY - dragStartYRef.current;

    // Prevent page scroll only when touch gesture is predominantly horizontal
    if (e.touches && Math.abs(deltaX) > Math.abs(deltaY)) {
      e.preventDefault();
    }

    const boxWidth = box.offsetWidth || 350;
    // Mobile responsive drag sensitivity
    const deltaProgress = -deltaX / (boxWidth * 0.8);
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
      className="relative w-full aspect-square rounded-2xl sm:rounded-3xl bg-black border border-gold/30 flex flex-col items-center justify-center overflow-hidden shadow-2xl group select-none transition-all duration-300 hover:border-gold/60 cursor-grab active:cursor-grabbing"
      onMouseDown={handlePointerDown}
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onTouchStart={handlePointerDown}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}
    >
      {/* Top Header Bar - Optimized for Mobile & Desktop */}
      <div className="absolute top-2.5 sm:top-3.5 left-2.5 sm:left-3.5 right-2.5 sm:right-3.5 z-30 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-1.5 sm:gap-2 bg-black/75 backdrop-blur-md border border-white/15 rounded-full px-2.5 py-1 sm:px-3 sm:py-1.5 shadow-lg text-[11px] sm:text-xs font-mono-label text-white">
          <RotateCw size={12} className="text-gold animate-spin-slow shrink-0" />
          <span className="tracking-wide hidden sm:inline">360° Interactive</span>
          <span className="tracking-wide sm:hidden">360° View</span>
          <span className="bg-gold/20 text-gold font-semibold px-1.5 py-0.5 rounded text-[10px]">
            {`${degrees}°`}
          </span>
        </div>

        <div className="flex items-center gap-1.5 bg-black/75 sm:bg-white/10 backdrop-blur-md border border-white/15 text-white text-[10px] sm:text-[11px] px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full font-mono-label shadow">
          <MoveHorizontal size={11} className="text-gold shrink-0" />
          <span className="sm:hidden">Swipe / Scroll</span>
          <span className="hidden sm:inline">Hover & Scroll</span>
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
            <div className="flex flex-col items-center gap-2.5">
              <RotateCw size={18} className="animate-spin text-gold" />
              <span className="text-xs font-mono-label text-gold">
                Loading 360° model...
              </span>
              <div className="w-28 sm:w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
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

      {/* Bottom Info Glass Card - Mobile Optimized Padding & Layout */}
      <div className="absolute bottom-2.5 sm:bottom-3.5 left-2.5 sm:left-3.5 right-2.5 sm:right-3.5 z-30 pointer-events-auto">
        <Link
          to={`/product/${productData._id || productData.id}`}
          className="group/btn block bg-black/85 backdrop-blur-xl border border-white/15 hover:border-gold/50 rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl transition-all duration-200"
        >
          <div className="w-full h-1 bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-gold via-amber-300 to-gold transition-all duration-75"
              style={{ width: `${scrollProgress * 100}%` }}
            />
          </div>

          <div className="px-3 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between gap-2 sm:gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <p className="text-xs sm:text-sm font-semibold text-white truncate leading-tight">
                  {productData.name}
                </p>
                <span className="font-mono-label text-[9px] sm:text-[10px] uppercase bg-gold/20 text-gold px-1.5 py-0.5 rounded shrink-0">
                  3D View
                </span>
              </div>
              <p className="font-mono-label text-[11px] sm:text-xs text-white/70 leading-tight mt-0.5">
                ${productData.price} USD
              </p>
            </div>

            <div className="flex items-center gap-1 text-[11px] sm:text-xs font-mono-label text-gold font-medium bg-gold/10 group-hover/btn:bg-gold group-hover/btn:text-black px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full transition-all duration-200 shrink-0">
              <span>View</span>
              <ArrowUpRight size={12} />
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
