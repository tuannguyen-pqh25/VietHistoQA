import type { ReactNode } from "react";

// ─── Divider ──────────────────────────────────────────────────────────────────
export function Divider({ className = "" }: { className?: string }) {
  return <div className={`h-px bg-[#E5E0D5] ${className}`} />;
}

// ─── Section Label ────────────────────────────────────────────────────────────
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p
      className="text-[10.5px] uppercase tracking-[0.12em] text-[#9CA3AF] font-medium mb-2"
      style={{ fontFamily: "var(--font-body)" }}
    >
      {children}
    </p>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
type BadgeVariant = "red" | "bronze" | "green" | "gray";

const BADGE_STYLES: Record<BadgeVariant, string> = {
  red: "bg-[#FDF0F0] text-[#8B0000] border border-[rgba(139,0,0,0.15)]",
  bronze: "bg-[#FBF5EB] text-[#92700A] border border-[rgba(193,154,107,0.3)]",
  green: "bg-[#F0FFF4] text-[#15803D] border border-[rgba(34,197,94,0.25)]",
  gray: "bg-[#F5F0E8] text-[#6B7280] border border-[#E5E0D5]",
};

export function Badge({
  children,
  variant = "bronze",
}: {
  children: ReactNode;
  variant?: BadgeVariant;
}) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${BADGE_STYLES[variant]}`}
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {children}
    </span>
  );
}

// ─── Bronze Drum Icon (SVG) ───────────────────────────────────────────────────
export function DrumIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="#C19A6B" strokeWidth="1.2" />
      <circle cx="12" cy="12" r="6" stroke="#C19A6B" strokeWidth="0.8" />
      <circle cx="12" cy="12" r="3" stroke="#C19A6B" strokeWidth="0.8" />
      <circle cx="12" cy="12" r="1.2" fill="#C19A6B" />
      <line x1="12" y1="3" x2="12" y2="21" stroke="#C19A6B" strokeWidth="0.5" strokeOpacity="0.5" />
      <line x1="3" y1="12" x2="21" y2="12" stroke="#C19A6B" strokeWidth="0.5" strokeOpacity="0.5" />
    </svg>
  );
}

// ─── Small Drum Icon (for chat avatar) ────────────────────────────────────────
export function DrumIconSmall() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="#C19A6B" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="4" stroke="#C19A6B" strokeWidth="1" />
      <circle cx="12" cy="12" r="1.5" fill="#C19A6B" />
    </svg>
  );
}
