import Image from "next/image";

export function Logo({ size = 48 }: { size?: number }) {
  return (
    <Image
      src="/logo.png"
      alt="RakshaSetu"
      width={size}
      height={size}
      className="shrink-0 object-contain"
      priority
    />
  );
}
