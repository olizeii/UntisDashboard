import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppConfigProvider } from "@/components/app-config";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DEFAULT_TIMEZONE } from "@/lib/time";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Untis Dashboard",
    template: "%s · Untis Dashboard",
  },
  description: "Live-Übersicht über Lehrkräfte, Klassen, Räume und Vertretungen aus WebUntis.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AppConfigProvider timezone={process.env.UNTIS_TIMEZONE || DEFAULT_TIMEZONE}>
            <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
          </AppConfigProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
