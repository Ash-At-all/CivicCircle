import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#0a0a0b",
};

export const metadata: Metadata = {
  title: {
    default: "VibeChat - Community posts, questions, and real-time chat",
    template: "%s | VibeChat",
  },
  description:
    "A community platform for sharing posts, asking questions, and real-time topic-based chat. Join conversations that matter to you.",
  applicationName: "VibeChat",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "VibeChat",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "VibeChat - Community posts, questions, and real-time chat",
    description: "Share posts, ask questions, and join topic-based conversations.",
    siteName: "VibeChat",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.className}>
      <body>{children}</body>
    </html>
  );
}
