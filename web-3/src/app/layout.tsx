import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import { Header, Footer, Breadcrumbs } from "~/components/layout";
import { SessionProvider } from "~/components/auth";
import { auth } from "~/server/auth";
import { Toaster } from "~/components/ui/sonner";
import { SearchProvider, UserPreferencesProvider, ListManagementProvider } from "~/contexts";

export const metadata: Metadata = {
  title: "Tokyo Apartment Finder",
  description: "Find your perfect apartment in Tokyo based on commute time",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let session = null;
  try {
    session = await auth();
  } catch (error) {
    // Handle JWT error gracefully - this happens when the secret changes
    console.error("Auth error:", error);
  }
  
  return (
    <html lang="en" className={`${geist.variable}`}>
      <body className="flex min-h-screen flex-col w-100dvw">
        <SessionProvider session={session}>
          <TRPCReactProvider>
            <SearchProvider>
              <UserPreferencesProvider>
                <ListManagementProvider>
                  <div className=" w-full h-full flex flex-col">
                    <Header />
                    <div className="px-4 py-2">
                      <Breadcrumbs />
                    </div>
                    <main className="w-full h-full flex justify-center">{children}</main>
                    <Footer />
                    <Toaster />
                  </div>
                </ListManagementProvider>
              </UserPreferencesProvider>
            </SearchProvider>
          </TRPCReactProvider>
        </SessionProvider>
      </body>
    </html>
  );
}