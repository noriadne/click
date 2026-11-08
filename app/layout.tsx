import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { UserProvider } from "@/components/user-provider";
import AuthGate from "@/components/auth-gate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 개발 서버(npm run dev)와 Vercel Preview 는 탭 제목에 [DEV] 를 붙여
// 운영(Production) 배포와 혼동하지 않도록 한다.
const isDev =
  process.env.NODE_ENV === "development" ||
  process.env.VERCEL_ENV === "preview";

export const metadata: Metadata = {
  title: isDev ? "[DEV] 보드게임 모임 캘린더" : "보드게임 모임 캘린더",
  description: "보드게임 모임 일정을 관리하는 캘린더 앱",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-zinc-50 dark:bg-zinc-950"
      >
        <UserProvider>
          <AuthGate>{children}</AuthGate>
        </UserProvider>
      </body>
    </html>
  );
}
