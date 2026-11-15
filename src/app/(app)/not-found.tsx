import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mobile-container items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        <p className="text-label">404</p>
        <h2 className="mt-1 text-h1">Not found</h2>
        <p className="mt-1.5 text-[13px] text-[var(--mute)]">
          The page you are looking for does not exist.
        </p>
        <Link href="/home" className="btn btn-primary mt-6">
          Back to feed
        </Link>
      </div>
    </div>
  );
}
