import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sales Asset Curator',
  description: 'Discover and analyze client-facing content for any company',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-gray-200 bg-white px-6 py-4">
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">
            Sales Asset Curator
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Discover and analyze client-facing content across the web, social, and YouTube
          </p>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </body>
    </html>
  );
}
