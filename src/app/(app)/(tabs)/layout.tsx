import { BottomNav } from "@/components/layout/bottom-nav";
import { DesktopSidebar } from "@/components/layout/desktop-sidebar";

export default function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-[var(--canvas)] flex justify-center">
      <div className="w-full max-w-6xl min-w-0 flex flex-col md:flex-row min-h-[100dvh] md:border-x md:border-[var(--hairline)]">
        {/* Desktop Sidebar (hidden on mobile, visible on desktop >= 768px) */}
        <aside className="hidden md:flex md:w-60 lg:w-64 flex-none border-r border-[var(--hairline)] bg-[var(--canvas)] sticky top-0 h-screen overflow-y-auto">
          <DesktopSidebar />
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 pb-[calc(84px+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation (visible only below 768px) */}
      <BottomNav />
    </div>
  );
}
