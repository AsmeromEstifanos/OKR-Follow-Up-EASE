"use client";

import dynamic from "next/dynamic";

// LiquidGlass uses WebGL/canvas + SVG displacement filters and reads the DOM,
// so it must never server-render. Load it client-only.
const LiquidGlassSurface = dynamic(() => import("@/app/liquid-glass"), {
  ssr: false,
});

export default LiquidGlassSurface;
