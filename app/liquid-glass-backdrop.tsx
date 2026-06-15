"use client";

// A drop-in "liquid glass" background layer derived from rdev/liquid-glass-react (MIT).
// Unlike the upstream <LiquidGlass> wrapper (which forces inline-flex/padding/font on
// its children and is sized for compact centered pills), this renders ONLY the glass
// effect as an absolutely-positioned layer behind a surface's own content — so the host
// element keeps its own layout, typography, and full width. Place it as the first child
// of a position:relative, transparent-background surface.
//
// The refraction/displacement is a Chrome capability (filter + backdrop-filter on the
// warp layer); Safari/Firefox gracefully fall back to the blur + shine only.

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { displacementMap } from "@/app/liquid-glass/utils";

type Props = {
  /** Strength of the edge refraction (px). */
  displacementScale?: number;
  /** Backdrop blur in px. */
  blurAmount?: number;
  /** Backdrop saturation in %. */
  saturation?: number;
  /** Chromatic aberration at the edges. */
  aberrationIntensity?: number;
  /** Border radius to match the host surface. */
  radius?: number | string;
  /** Stacking position of the layer. Use -1 to sit behind in-flow content
   *  without needing per-child z-index (e.g. inside modal panels). */
  zIndex?: number;
};

export default function LiquidGlassBackdrop({
  displacementScale = 48,
  blurAmount = 8,
  saturation = 170,
  aberrationIntensity = 2,
  radius = "inherit",
  zIndex = 0,
}: Props): JSX.Element {
  const rawId = useId();
  const filterId = `lg-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const isFirefox =
    typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("firefox");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = (): void => setSize({ width: el.offsetWidth, height: el.offsetHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layer: CSSProperties = { position: "absolute", inset: 0, borderRadius: radius, pointerEvents: "none" };

  return (
    <div ref={ref} aria-hidden="true" style={{ ...layer, overflow: "hidden", zIndex }}>
      <svg style={{ position: "absolute", width: size.width, height: size.height }} aria-hidden="true">
        <defs>
          <filter id={filterId} x="-35%" y="-35%" width="170%" height="170%" colorInterpolationFilters="sRGB">
            <feImage x="0" y="0" width="100%" height="100%" result="DISPLACEMENT_MAP" href={displacementMap} preserveAspectRatio="xMidYMid slice" />
            <feColorMatrix in="DISPLACEMENT_MAP" type="matrix" values="0.3 0.3 0.3 0 0 0.3 0.3 0.3 0 0 0.3 0.3 0.3 0 0 0 0 0 1 0" result="EDGE_INTENSITY" />
            <feComponentTransfer in="EDGE_INTENSITY" result="EDGE_MASK">
              <feFuncA type="discrete" tableValues={`0 ${aberrationIntensity * 0.05} 1`} />
            </feComponentTransfer>
            <feOffset in="SourceGraphic" dx="0" dy="0" result="CENTER_ORIGINAL" />
            <feDisplacementMap in="SourceGraphic" in2="DISPLACEMENT_MAP" scale={displacementScale * -1} xChannelSelector="R" yChannelSelector="B" result="RED_DISPLACED" />
            <feColorMatrix in="RED_DISPLACED" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="RED_CHANNEL" />
            <feDisplacementMap in="SourceGraphic" in2="DISPLACEMENT_MAP" scale={displacementScale * (-1 - aberrationIntensity * 0.05)} xChannelSelector="R" yChannelSelector="B" result="GREEN_DISPLACED" />
            <feColorMatrix in="GREEN_DISPLACED" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="GREEN_CHANNEL" />
            <feDisplacementMap in="SourceGraphic" in2="DISPLACEMENT_MAP" scale={displacementScale * (-1 - aberrationIntensity * 0.1)} xChannelSelector="R" yChannelSelector="B" result="BLUE_DISPLACED" />
            <feColorMatrix in="BLUE_DISPLACED" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="BLUE_CHANNEL" />
            <feBlend in="GREEN_CHANNEL" in2="BLUE_CHANNEL" mode="screen" result="GB_COMBINED" />
            <feBlend in="RED_CHANNEL" in2="GB_COMBINED" mode="screen" result="RGB_COMBINED" />
            <feGaussianBlur in="RGB_COMBINED" stdDeviation={Math.max(0.1, 0.5 - aberrationIntensity * 0.1)} result="ABERRATED_BLURRED" />
            <feComposite in="ABERRATED_BLURRED" in2="EDGE_MASK" operator="in" result="EDGE_ABERRATION" />
            <feComponentTransfer in="EDGE_MASK" result="INVERTED_MASK">
              <feFuncA type="table" tableValues="1 0" />
            </feComponentTransfer>
            <feComposite in="CENTER_ORIGINAL" in2="INVERTED_MASK" operator="in" result="CENTER_CLEAN" />
            <feComposite in="EDGE_ABERRATION" in2="CENTER_CLEAN" operator="over" />
          </filter>
        </defs>
      </svg>

      {/* Warp layer — blurs + refracts the backdrop (refraction is Chrome-only). */}
      <span
        style={{
          position: "absolute",
          inset: 0,
          backdropFilter: `blur(${blurAmount}px) saturate(${saturation}%)`,
          WebkitBackdropFilter: `blur(${blurAmount}px) saturate(${saturation}%)`,
          filter: isFirefox ? undefined : `url(#${filterId})`,
        }}
      />

      {/* Tint + top-center specular shine. */}
      <span
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 55%), linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.05))",
        }}
      />

      {/* Bright glass rim. */}
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: radius,
          boxShadow:
            "0 0 0 0.5px rgba(255,255,255,0.6) inset, 0 1px 3px rgba(255,255,255,0.4) inset",
        }}
      />
    </div>
  );
}
