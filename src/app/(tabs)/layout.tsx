import { BottomNav } from "@/components/bottom-nav";

export default function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mobile-container pb-[72px]">
      <main className="flex-1 flex flex-col w-full">{children}</main>
      <BottomNav />
    </div>
  );
}
