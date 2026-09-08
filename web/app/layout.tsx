import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { AppProviders } from "./providers";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "SETU-DRR: Resilience Through Data | Global Vulnerability Command Center",
  description: "Global Vulnerability Command Center & Hazard Relocation Decision Support Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plusJakarta.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('setu-drr-theme');var s=window.matchMedia('(prefers-color-scheme: dark)').matches;var isDark=t==='dark'||(t==='system'&&s);var cl=document.documentElement.classList;cl.remove('light','dark');cl.add(isDark?'dark':'light');document.documentElement.setAttribute('data-theme',isDark?'dark':'light');document.documentElement.style.colorScheme=isDark?'dark':'light';}catch(e){}})();`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-bg-base text-text-primary font-sans overflow-x-hidden select-none selection:bg-citron/30 selection:text-citron transition-colors duration-200"
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
