import { BottomNav } from "@/components/layout/bottom-nav";
import { DesktopSidebar } from "@/components/layout/desktop-sidebar";

export default function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-[var(--canvas)] flex justify-center">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-[var(--radius-md)] focus:bg-[var(--primary)] focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-[var(--on-primary)]"
      >
        Skip to content
      </a>
      <div className="w-full max-w-6xl min-w-0 flex flex-col md:flex-row min-h-[100dvh] md:border-x md:border-[var(--hairline)]">
        {/* Desktop Sidebar (hidden on mobile, visible on desktop >= 768px) */}
        <aside className="hidden md:flex md:w-60 lg:w-64 flex-none border-r border-[var(--hairline)] bg-[var(--canvas)] sticky top-0 h-screen overflow-y-auto">
          <DesktopSidebar />
        </aside>

        {/* Main Content Area */}
        <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col min-w-0 pb-[calc(84px+env(safe-area-inset-bottom))] md:pb-0 outline-none">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation (visible only below 768px) */}
      <BottomNav />
    </div>
  );
}
