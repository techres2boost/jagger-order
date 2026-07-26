import logoAsset from "@/assets/box-logo-transparent.png.asset.json";

// Logo Box Pizza El Manar — fond transparent pour s'intégrer au fond.
const LOGO_URL = logoAsset.url;

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
        alt="Logo Box Pizza El Manar"
        width={size}
        height={size}
        style={{ width: size, height: size, objectFit: "contain" }}
        draggable={false}
      />
      {showWordmark && (
        <span className="text-3xl font-black tracking-widest text-brand-dark">BOX PIZZA</span>
      )}
    </div>
  );
}

export const BOX_LOGO_URL = LOGO_URL;
