"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import useBodyScrollLock from "@/app/use-body-scroll-lock";

/**
 * Renders modal content into document.body so a `position: fixed` overlay
 * escapes any transformed/filtered ancestor's stacking context (which would
 * otherwise let page chrome render on top and leak clicks through), and locks
 * background page scrolling while mounted.
 */
export default function ModalPortal({
  children,
  lockScroll = true
}: {
  children: React.ReactNode;
  lockScroll?: boolean;
}): JSX.Element | null {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useBodyScrollLock(mounted && lockScroll);

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  // React events bubble through the component tree, not the DOM tree — so without
  // this, clicks inside the portaled modal would bubble up to the host card's
  // onClick handlers (e.g. toggling a section behind the modal). Stopping
  // propagation at the portal root keeps handlers inside the modal working while
  // isolating it from the rest of the app. The wrapper has no layout footprint
  // (its children are position:fixed).
  return createPortal(
    <div
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
}
