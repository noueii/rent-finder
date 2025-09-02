import { Inter } from "next/font/google";
import "~/styles/globals.css";
import { NavBar } from '~/components/NavBar';
import { Providers } from '~/components/Providers';

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: 'Tokyo Rent Finder',
  description: 'Find apartments in Tokyo by commute time',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen bg-gray-50">
            <NavBar />
            <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}