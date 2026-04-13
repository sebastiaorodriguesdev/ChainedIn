import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { DevSwitcher } from "@/components/dev-switcher";
import { auth } from "@/auth";
import { SessionProvider } from "next-auth/react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ChainedIn — Cyber Trust Network",
  description: "Track software vulnerabilities and build trusted dependency stacks",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="en">
      <body className={inter.className}>
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
