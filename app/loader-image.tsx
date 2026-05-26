"use client";

type Props = {
  size?: number;
  className?: string;
  src?: string; // kept for API compatibility (ignored — CSS spinner used instead)
};

export default function LoaderImage({ size = 64, className = "" }: Props): JSX.Element {
  return (
    <span
      className={`loader-spinner ${className}`.trim()}
      role="status"
      aria-label="Loading"
      style={{ width: size, height: size, borderWidth: Math.max(2, Math.round(size * 0.08)) }}
    />
  );
}
