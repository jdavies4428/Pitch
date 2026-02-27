import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

export const metadata = {
  title: "Pitch — Four Player Card Game",
  description: "Play Pitch (High-Low-Jack) online with friends or against AI. Bid, pitch trump, take tricks. First team to 11 wins!",
  openGraph: {
    title: "Pitch — Play Online With Friends",
    description: "The classic trick-taking card game. Bid, pitch trump, take tricks. Play solo or challenge a friend — each player gets an AI partner!",
    type: "website",
    siteName: "Pitch",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pitch — Play Online With Friends",
    description: "The classic trick-taking card game. Bid, pitch trump, take tricks. First team to 11 wins!",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Pitch",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0a0a1a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="bg-[#0a0a1a] overflow-hidden">{children}<Analytics /></body>
    </html>
  );
}
