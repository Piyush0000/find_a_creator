import AppShell from '@/components/AppShell';

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="CREATOR">{children}</AppShell>;
}
