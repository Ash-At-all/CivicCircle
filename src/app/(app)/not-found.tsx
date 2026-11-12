import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mobile-container min-h-[100dvh] bg-[#171921] text-[#F2F0FA] flex flex-col items-center justify-center p-4">
      <h2 className="text-white font-semibold">Not found</h2>
      <p className="mt-1 text-sm text-[#8B8FA3]">The page you are looking for does not exist.</p>
      <Link
        href="/home"
        className="mt-6 inline-flex items-center rounded-button px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-purple to-[#9B5CF6] shadow-lg"
      >
        Back to feed
      </Link>
    </div>
  );
}
