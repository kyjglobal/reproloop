import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { siteUrl } from "../lib/site-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "ReproLoop — 게임팀을 위한 Discord 버그 트리아지",
  description:
    "Discord 제보를 재현 가능한 버그 리포트로 바꾸고, 중복 정리부터 수정 알림까지 한 흐름으로 연결합니다.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "ReproLoop",
    title: "ReproLoop — Stop asking how to reproduce it.",
    description:
      "Discord bug triage for indie game teams. Try the complete loop in three minutes.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "ReproLoop product preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ReproLoop — Discord bug triage for indie games",
    description:
      "Turn scattered playtest feedback into actionable reports and return the fix.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#090b08",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
