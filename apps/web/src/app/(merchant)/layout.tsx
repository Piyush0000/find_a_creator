import AppShell from '@/components/AppShell';

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="MERCHANT">{children}</AppShell>;
}
