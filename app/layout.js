import "./globals.css";

export const metadata = {
  title: "Pitch — Card Game",
  description: "Play the classic trick-taking card game Pitch (High-Low-Jack) against AI opponents. Retro arcade style, no downloads.",
  openGraph: {
    title: "Pitch — High Low Jack Game",
    description: "Bid, pitch trump, take tricks. First team to 11 wins.",
    type: "website",
    siteName: "Pitch",
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
      <body className="bg-[#0a0a1a] overflow-hidden">{children}</body>
    </html>
  );
}
