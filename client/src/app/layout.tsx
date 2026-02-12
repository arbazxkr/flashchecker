import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlashChecker — Instant USDT Verification",
  description:
    "Verify USDT deposits instantly across Ethereum, BSC, Tron, and Solana.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  manifest: "/manifest.json",
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
      </head>
      <body>{children}</body>
    </html>
  );
}
