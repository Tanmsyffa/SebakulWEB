import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BRAND_FULL_NAME, BRAND_JARGON, BRAND_NAME } from "@/lib/brand";
import { MotionProvider } from "@/components/motion/motion-provider";
import { RegisterServiceWorker } from "@/components/navigation/register-service-worker";
import { SkipToContent } from "@/components/navigation/skip-to-content";

export const metadata: Metadata = {
  applicationName: BRAND_NAME,
  title: {
    default: `${BRAND_NAME} - ${BRAND_FULL_NAME}`,
    template: `%s | ${BRAND_NAME}`,
  },
  description: `${BRAND_NAME} (${BRAND_FULL_NAME}) - ${BRAND_JARGON} Sistem manajemen operasional sentra kuliner digital.`,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: BRAND_NAME,
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192x192.png?v=3", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png?v=3", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FAF9F6",
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
