import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BRAND_FULL_NAME, BRAND_JARGON, BRAND_NAME } from "@/lib/brand";
import { MotionProvider } from "@/components/motion/motion-provider";
import { RegisterServiceWorker } from "@/components/navigation/register-service-worker";
import { SkipToContent } from "@/components/navigation/skip-to-content";

function resolveMetadataBase(): URL {
  const clean = (raw?: string) => (raw ?? '').trim().replace(/^['"]+|['"]+$/g, '').trim();
  const configured = clean(process.env.NEXT_PUBLIC_SITE_URL) || clean(process.env.NEXT_PUBLIC_APP_URL);
  const isLocalhost = configured ? /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(configured) : false;
  if (configured && !(process.env.VERCEL === '1' && isLocalhost)) {
    try {
      return new URL(configured);
    } catch {
      // Fallback below
    }
  }
  const prodVercel = clean(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (prodVercel) {
    return new URL(`https://${prodVercel.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`);
  }
  return new URL('https://sebakul.my.id');
}

const SHARE_TITLE = `${BRAND_NAME} - ${BRAND_FULL_NAME}`;
const SHARE_DESCRIPTION = `${BRAND_JARGON} Buku kerja operasional untuk pengelola sentra kuliner dan pemilik warung.`;
const OG_IMAGE_URL = '/images/og-sebakul.jpg?v=1';

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  applicationName: BRAND_NAME,
  title: {
    default: SHARE_TITLE,
    template: `%s | ${BRAND_NAME}`,
  },
  description: SHARE_DESCRIPTION,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    url: '/',
    siteName: BRAND_NAME,
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: SHARE_TITLE,
        type: 'image/jpeg',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    images: [OG_IMAGE_URL],
  },
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
      { url: "/icons/favicon-32x32.png?v=4", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-48x48.png?v=4", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-192x192.png?v=4", sizes: "192x192", type: "image/png" },
      { url: "/favicon.ico?v=4", sizes: "any" },
    ],
    shortcut: [{ url: "/favicon.ico?v=4", sizes: "any" }],
    apple: [{ url: "/apple-touch-icon.png?v=4", sizes: "180x180", type: "image/png" }],
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
