import type { Metadata, Viewport } from "next";
import "@fontsource/bricolage-grotesque/600.css";
import "@fontsource/bricolage-grotesque/700.css";
import "@fontsource/bricolage-grotesque/800.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title:
    "StoreDoctor — Find What Slows Down Your Shopify Store & Stop Renting Expensive Apps",
  description:
    "Check any Shopify store URL in seconds to spot speed bottlenecks, product page gaps, and expensive monthly apps you can replace with clean custom theme code.",
  openGraph: {
    title: "StoreDoctor — Shopify Store Health & App Savings",
    description:
      "See what slows down your Shopify store and how quickly custom theme features pay for themselves.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const themeInitScript = `(function(){try{var t=localStorage.getItem('sd-theme');var theme=(t==='dark'||t==='light')?t:'light';document.documentElement.dataset.theme=theme;}catch(e){document.documentElement.dataset.theme='light';}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen antialiased sd-hero-mesh">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
