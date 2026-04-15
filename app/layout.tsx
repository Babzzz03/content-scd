import type { Metadata } from "next"
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { PostsProvider } from "@/lib/posts-context"
import { AIProviderProvider } from "@/lib/ai-provider-context"
import { AccountsProvider } from "@/lib/accounts-context"
import { UserProvider } from "@/lib/user-context"
import { TourProvider } from "@/lib/tour-context"
import { TourOverlay } from "@/components/tour/tour-overlay"

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "PostFlow — AI Content Studio",
  description: "AI-powered social media management for X, LinkedIn, and Instagram",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>
          <AIProviderProvider>
            <AccountsProvider>
              <UserProvider>
                <PostsProvider>
                  <TourProvider>
                    {children}
                    <TourOverlay />
                    <Toaster richColors position="top-right" />
                  </TourProvider>
                </PostsProvider>
              </UserProvider>
            </AccountsProvider>
          </AIProviderProvider>
        </TooltipProvider>
      </body>
    </html>
  )
}
