export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100dvh] bg-[var(--canvas)]">{children}</div>;
}
