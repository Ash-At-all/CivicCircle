import Link from "next/link";

export default function RootPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#171921] px-4 text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 120 120"
        width={80}
        height={80}
        aria-hidden
        className="mb-6 drop-shadow-[0_0_24px_rgba(168,85,247,0.4)]"
      >
        <circle cx="60" cy="60" r="56" fill="#AD68F5" />
        <circle cx="60" cy="60" r="48" fill="#171921" />
        <path
          d="M38 72V48c0-12 10-22 22-22s22 10 22 22v24"
          stroke="#F8DC47"
          strokeWidth={6}
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="60" cy="60" r="6" fill="#F8DC47" />
        <circle cx="60" cy="82" r="5" fill="#F8DC47" opacity={0.7} />
        <circle cx="44" cy="82" r="4" fill="#F8DC47" opacity={0.5} />
        <circle cx="76" cy="82" r="4" fill="#F8DC47" opacity={0.5} />
      </svg>
      <h1 className="text-h1 text-[#FFFFFF]">Welcome to CivicCircle</h1>
      <p className="mt-3 max-w-[320px] text-[13px] text-[#8B8FA3]">
        City boards and live chat for your community. Join your city and start talking.
      </p>
      <Link
        href="/onboarding"
        className="mt-6 inline-flex items-center rounded-[16px] bg-[#F8DC47] px-6 py-3 text-[#171921] font-semibold text-base shadow-lg transition-all press-active"
      >
        <span>Get Started</span>
      </Link>
    </div>
  );
}