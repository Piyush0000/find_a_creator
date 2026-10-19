import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EVOC Creator Network | UGC Ad Creators for D2C Brands',
  description: 'A Managed UGC Ad Creator Platform with UTM Attribution and Zero Disintermediation'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
