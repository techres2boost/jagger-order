import logoUrl from "@/assets/box-logo-transparent.png";

// Logo BOX officiel — fond transparent pour s'intégrer au fond.
const LOGO_URL = logoUrl;

export function BoxLogo({
  size = 88,
  showWordmark = false,
  className = "",
}: {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <img
        src={LOGO_URL}
        alt="Logo BOX"
        width={size}
        height={size}
        style={{ width: size, height: size, objectFit: "contain" }}
        draggable={false}
      />
      {showWordmark && (
        <span className="text-3xl font-black tracking-widest text-brand-dark">BOX</span>
      )}
    </div>
  );
}

export const BOX_LOGO_URL = LOGO_URL;
