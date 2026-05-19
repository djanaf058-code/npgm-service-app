import type { Metadata } from "next";
import { Inter, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { Analytics } from '@vercel/analytics/next';
import { GoogleAnalytics } from '@next/third-parties/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
// Cookie consent banner from Razikus removed in Sprint 1.7 — we don't drop
// non-essential cookies during the pilot phase (only Supabase auth session
// cookies, which are strictly necessary and don't require consent under
// most privacy laws). Will be re-added with proper text + UI in production.

// Inter — primary body font (default for everything except wordmark/headings).
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

// IBM Plex Sans — for headings and the wordmark; gives the app a serious,
// industrial typographic personality without being heavy.
const ibmPlex = IBM_Plex_Sans({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700"],
  variable: "--font-ibm-plex",
  display: "swap",
});

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_PRODUCTNAME,
  description:
    "B2B-платформа для подрядчиков по взрывным работам: сервис, ТО и техподдержка парка СЗМ и буровых станков НИПИГОРМАШа.",
  icons: {
    icon: [
      { url: "/logo-mark.svg", type: "image/svg+xml" },
    ],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = process.env.NEXT_PUBLIC_THEME || "theme-npgm";
  const gaID = process.env.NEXT_PUBLIC_GOOGLE_TAG;
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className={`${inter.variable} ${ibmPlex.variable}`}>
      <body className={`${theme} font-sans antialiased`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
        <Analytics />
        {gaID && <GoogleAnalytics gaId={gaID} />}
      </body>
    </html>
  );
}
