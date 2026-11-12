import Image from "next/image";
import Link from "next/link";

export function SiteBrand() {
  return (
    <Link className="brand" href="/" aria-label="CivicCircle home">
      <Image
        src="/brand/logo.png"
        alt="CivicCircle logo"
        width={30}
        height={30}
        className="brand-logo"
        priority
      />
      <span>CivicCircle</span>
    </Link>
  );
}
