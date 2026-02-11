import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlashChecker — Instant USDT Verification",
  description:
    "Verify USDT deposits instantly across Ethereum, BSC, Tron, and Solana.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
