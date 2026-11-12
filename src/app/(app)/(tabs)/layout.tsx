import { BottomNav } from "@/components/layout/bottom-nav";
import { DesktopSidebar } from "@/components/layout/desktop-sidebar";

export default function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-[#171921] flex justify-center">
      <div className="w-full max-w-5xl flex flex-col md:flex-row min-h-[100dvh]">
        {/* Desktop Sidebar (hidden on mobile, visible on desktop >= 768px) */}
        <aside className="hidden md:flex md:w-64 flex-none border-r border-white/[0.08] sticky top-0 h-screen overflow-y-auto">
          <DesktopSidebar />
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 pb-[76px] md:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation (visible only below 768px) */}
      <BottomNav />
    </div>
  );
}
