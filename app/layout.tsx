import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BSVAPI — Pay-Per-Call API Gateway",
  description:
    "No accounts. No subscriptions. Just BSV. Access AI APIs with micropayments.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased">{children}</body>
    </html>
  );
}
