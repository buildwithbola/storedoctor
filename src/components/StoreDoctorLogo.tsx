import React from "react";

interface StoreDoctorLogoProps {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
}

export function StoreDoctorLogo({
  size = "md",
  showWordmark = true,
  className = "",
}: StoreDoctorLogoProps) {
  const iconDim = size === "sm" ? 28 : size === "lg" ? 40 : 34;
  const wordSize =
    size === "sm"
      ? "text-[18px]"
      : size === "lg"
      ? "text-[24px]"
      : "text-[20px]";

  return (
    <span className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <svg
        width={iconDim}
        height={iconDim}
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <path
          d="M23 20V16.5C23 11.8056 26.8056 8 31.5 8H32.5C37.1944 8 41 11.8056 41 16.5V20"
          stroke="var(--sd-ink)"
          strokeWidth="3.8"
          strokeLinecap="round"
        />
        <path
          d="M15 20H49L51 31.5H13L15 20Z"
          fill="var(--sd-ink)"
        />
        <path
          d="M12.5 36.5H31.5V54H14.5C12.35 54 10.68 52.1 11.02 49.97L12.5 36.5Z"
          fill="var(--sd-ink)"
        />
        <path
          d="M32.5 36.5H51.5L52.98 49.97C53.32 52.1 51.65 54 49.5 54H32.5V36.5Z"
          fill="var(--sd-emerald)"
        />
        <path
          d="M7 34H18.5L23 22L29.2 46L35.8 23.5L40.5 38L44.2 34H57"
          stroke="var(--sd-emerald)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {showWordmark && (
        <span
          className={`${wordSize} tracking-[-0.03em] leading-none text-[var(--sd-ink)]`}
        >
          <span className="font-medium">Store</span>
          <span className="font-extrabold">Doctor</span>
        </span>
      )}
    </span>
  );
}

export function StoreDoctorPulseIcon({
  className = "w-5 h-5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M8.5 8V6.8C8.5 4.97746 9.97746 3.5 11.8 3.5H12.2C14.0225 3.5 15.5 4.97746 15.5 6.8V8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M5 8.5H19L20.2 18.2C20.38 19.65 19.25 20.9 17.8 20.9H6.2C4.75 20.9 3.62 19.65 3.8 18.2L5 8.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 14.5H8.5L10.3 11.2L12.7 17.5L14.8 12.6L16.3 14.5H19.5"
        stroke="var(--sd-emerald)"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
