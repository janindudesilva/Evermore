import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { RotateCw, MoveHorizontal, ArrowUpRight } from "lucide-react";

const TOTAL_FRAMES = 112;

export default function JacketVideoScrubber({ product }) {
  const boxRef = useRef(null);
  const canvasRef = useRef(null);
  const framesRef = useRef([]);

  const [framesLoaded, setFramesLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);

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

  // Step 2: Preload every frame image into memory on mount
  useEffect(() => {
    let loadedCount = 0;
    const images = [];

    for (let i = 1; i <= TOTAL_FRAMES; i++) {
      const img = new Image();
      const num = String(i).padStart(3, "0");
      img.src = `/assets/field-jacket-frames/frame_${num}.jpg`;

      img.onload = () => {
        loadedCount++;
        setLoadProgress(Math.round((loadedCount / TOTAL_FRAMES) * 100));
        if (loadedCount === TOTAL_FRAMES) {
          setFramesLoaded(true);
        }
      };

      img.onerror = () => {
        // Fallback progress if an image fails
        loadedCount++;
        setLoadProgress(Math.round((loadedCount / TOTAL_FRAMES) * 100));
        if (loadedCount === TOTAL_FRAMES) {
          setFramesLoaded(true);
        }
      };

      images.push(img);
    }

    framesRef.current = images;
  }, []);

  // Step 3: Draw current frame to canvas (instant, zero seek lag)
  const drawFrame = (index) => {
    const canvas = canvasRef.current;
    const img = framesRef.current[index];
    if (!canvas || !img || !img.complete) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
    }

    ctx.drawImage(img, 0, 0);
  };

  // Step 4: Animation loop for ultra-smooth rendering
  useEffect(() => {
    let animId;
    const tick = () => {
      if (framesLoaded) {
        let wrapped = targetProgressRef.current % 1;
        if (wrapped < 0) wrapped += 1;
        const frameIndex = Math.floor(wrapped * TOTAL_FRAMES) % TOTAL_FRAMES;
        drawFrame(frameIndex);
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [framesLoaded]);

  // Initial draw when all frames complete loading
  useEffect(() => {
    if (framesLoaded) {
      drawFrame(0);
    }
  }, [framesLoaded]);

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

      setScrollProgress(wrapped);
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
    const deltaProgress = -deltaX / (boxWidth * 0.8);
    let wrapped = (dragStartProgressRef.current + deltaProgress) % 1;
    if (wrapped < 0) wrapped += 1;

    targetProgressRef.current = wrapped;
    setScrollProgress(wrapped);
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
      {/* Top Header Bar */}
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

      {/* Step 5: Canvas Display & Loading State (No Video Element) */}
      <div className="w-full h-full flex items-center justify-center bg-black relative">
        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain pointer-events-none transition-transform duration-300 group-hover:scale-105"
        />

        {!framesLoaded && (
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

      {/* Bottom Info Glass Card */}
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
