import type { Metadata, Viewport } from "next";
import SWRegister from "@/components/SWRegister";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL('https://flashchecker.in'), // Replace with your actual domain if different
  title: "FlashChecker — Instant USDT Verification",
  description:
    "Verify USDT deposits instantly across Ethereum, BSC, Tron, and Solana.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/apple-icon.png",
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "FlashChecker — Instant USDT Verification",
    description: "Verify USDT deposits instantly across Ethereum, BSC, Tron, and Solana.",
    url: 'https://flashchecker.in',
    siteName: 'FlashChecker',
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: 'FlashChecker Preview',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "FlashChecker — Instant USDT Verification",
    description: "Verify USDT deposits instantly across Ethereum, BSC, Tron, and Solana.",
    images: ['/opengraph-image.png'],
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

// Inline script to handle chunk load errors after deploys
const chunkErrorHandler = `
(function() {
  window.addEventListener('error', function(e) {
    var msg = (e.message || '').toLowerCase();
    var isChunkError =
      msg.includes('loading chunk') ||
      msg.includes('loading css chunk') ||
      msg.includes('dynamically imported module') ||
      msg.includes('failed to fetch') ||
      msg.includes('mime type');
    if (isChunkError) {
      var key = '__chunk_reload';
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
      }
    }
  });
  // Clear the flag on successful load
  window.addEventListener('load', function() {
    sessionStorage.removeItem('__chunk_reload');
  });
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: chunkErrorHandler }} />
        <SWRegister />
      </head>
      <body>{children}</body>
    </html>
  );
}
