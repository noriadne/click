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

// 로컬 개발 서버(npm run dev)만 탭 제목에 [DEV] 를 붙인다.
// Vercel Preview 는 운영 DB 를 보며 운영과 동일한 화면을 미리 확인하는
// 용도이므로 Production 과 동일하게 표시한다.
const isLocalDev = process.env.NODE_ENV === "development";

export const metadata: Metadata = {
  title: isLocalDev ? "[DEV] Click 모임일정" : "Click 모임일정",
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
