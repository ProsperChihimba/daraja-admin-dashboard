import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import StoreProvider from "@/store/provider";
import AuthBootstrap from "@/components/auth/AuthBootstrap";

export const metadata: Metadata = {
  title: "Ankara Control Center",
  description: "Internal operations dashboard for the Ankara platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <StoreProvider>
          <AuthBootstrap />
          {children}
          <Toaster />
        </StoreProvider>
      </body>
    </html>
  );
}
