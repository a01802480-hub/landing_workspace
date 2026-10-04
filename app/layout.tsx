import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppBoundary } from "@/components/AppBoundary";

export const metadata: Metadata = {
  title: "Protheon — Weightless protein analysis",
  description:
    "A unified workspace for protein sequence alignment, structural analysis and variant impact prediction. Antigravity UI, real structure rendering, comparative genomics.",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

/**
 * Clinical backdrop shared by every page: degraded-purple orbs drifting on
 * a transform-only keyframe (GPU-composited) at different Z depths via
 * perspective, so foreground glass panels visibly float in front of them.
 */
function BackgroundField() {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden" style={{ perspective: "1200px" }}>
      <div
        className="absolute -top-[20%] -right-[10%] h-[60vmax] w-[60vmax] rounded-full opacity-70 animate-drift"
        style={{
          background: "radial-gradient(closest-side, rgba(167,139,250,0.2), transparent 70%)",
          transform: "translateZ(-140px)",
          willChange: "transform",
        }}
      />
      <div
        className="absolute top-[30%] -left-[15%] h-[50vmax] w-[50vmax] rounded-full opacity-60 animate-drift"
        style={{
          background: "radial-gradient(closest-side, rgba(139,124,240,0.14), transparent 70%)",
          animationDelay: "-9s",
          transform: "translateZ(-80px)",
          willChange: "transform",
        }}
      />
      <div
        className="absolute -bottom-[25%] right-[15%] h-[45vmax] w-[45vmax] rounded-full opacity-50 animate-drift"
        style={{
          background: "radial-gradient(closest-side, rgba(196,181,253,0.2), transparent 70%)",
          animationDelay: "-17s",
          transform: "translateZ(-180px)",
          willChange: "transform",
        }}
      />
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <BackgroundField />
        <AppBoundary>{children}</AppBoundary>
      </body>
    </html>
  );
}
