import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#171921",
};

export const metadata: Metadata = {
  title: {
    default: "CivicCircle",
    template: "%s | CivicCircle",
  },
  description: "City boards and live chat for your community.",
  applicationName: "CivicCircle",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "CivicCircle",
    statusBarStyle: "black-translucent",
  },
  metadataBase: new URL("https://civiccircle.in"),
  openGraph: {
    title: "CivicCircle — City boards and live chat",
    description: "Join your city, share posts, and talk with neighbors — no account needed.",
    type: "website",
    url: "https://civiccircle.in",
    siteName: "CivicCircle",
    images: [
      {
        url: "/icons/icon-512.png",
        width: 512,
        height: 512,
        alt: "CivicCircle",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CivicCircle — City boards and live chat",
    description: "Join your city, share posts, and talk with neighbors — no account needed.",
    images: ["/icons/icon-512.png"],
    creator: "@civiccircle",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={jakarta.className}>
      <body className="antialiased selection:bg-[var(--yellow)] selection:text-[var(--charcoal)]">
        {children}
      </body>
    </html>
  );
}
