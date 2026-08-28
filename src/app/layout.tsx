import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Archivo, Familjen_Grotesk, IBM_Plex_Mono } from "next/font/google";

import "./globals.css";

/**
 * Self-hosted via next/font/google — no runtime CDN link, no FOIT.
 * Latin + latin-ext subsets (complete Swedish diacritics å ä ö Å Ä Ö).
 *
 * Archivo is loaded as a VARIABLE font with the `wdth` axis requested explicitly
 * (it is not a default axis). Every display role drives wdth >= 112 — see the
 * `.t-h*` classes in tokens.css. If this axis ever fails to load the display
 * type collapses to a plain grotesque and the signage identity is lost.
 */
const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-archivo",
  fallback: ["Helvetica Neue", "Arial", "sans-serif"],
});

const grotesk = Familjen_Grotesk({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-grotesk",
  fallback: ["Helvetica Neue", "Arial", "sans-serif"],
});

const mono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-mono",
  fallback: ["ui-monospace", "SF Mono", "Menlo", "monospace"],
});

export const metadata: Metadata = {
  title: "AI Cooking App",
  description: "PLAN → SHOP → COOK for one meal.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang="sv"
      className={`${archivo.variable} ${grotesk.variable} ${mono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
