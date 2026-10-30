import AppShell from '@/components/AppShell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="SUPER_ADMIN">{children}</AppShell>;
}
