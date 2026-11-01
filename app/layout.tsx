import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BSVAPI · AI, paid by the call in BSV",
  description: "Chat, images, video, music and transcription through one OpenAI-compatible API, paid per call in BSV. No card. No account needed.",
  metadataBase: new URL("https://bsvapi.com"),
  openGraph: { title: "BSVAPI · AI, paid by the call in BSV", description: "Chat, images, video, music and transcription, paid per call in BSV. No card. No account needed.", url: "/" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap"
        />
      </head>
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
