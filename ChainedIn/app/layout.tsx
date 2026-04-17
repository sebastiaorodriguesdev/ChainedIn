import type { Metadata } from "next";
import { Lexend } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { DevSwitcher } from "@/components/dev-switcher";
import { auth } from "@/auth";
import { SessionProvider } from "next-auth/react";

const lexend = Lexend({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Stacurity — Cyber Trust Network",
  description: "The platform where software companies prove they are secure — and where buyers can verify it before they commit.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="en">
      <body className={lexend.className}>
        <SessionProvider session={session}>
          <Nav />
          {children}
          {process.env.NODE_ENV === "development" && (
            <DevSwitcher currentEmail={session?.user?.email} />
          )}
        </SessionProvider>
      </body>
    </html>
  );
}
