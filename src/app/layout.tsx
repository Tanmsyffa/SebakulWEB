import type { Metadata, Viewport } from "next";
import "./globals.css";
import { MotionProvider } from "@/components/motion/motion-provider";
import { RegisterServiceWorker } from "@/components/navigation/register-service-worker";
import { SkipToContent } from "@/components/navigation/skip-to-content";

export const metadata: Metadata = {
  title: {
    default: "SEBAKUL",
    template: "%s | SEBAKUL",
  },
  description:
    "SEBAKUL: sistem manajemen sentra kuliner digital. Kelola lapak, tagihan, inventori, dan komunitas dalam satu platform.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0F766E",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="font-sans bg-canvas text-text-primary antialiased">
        <SkipToContent />
        <RegisterServiceWorker />
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
