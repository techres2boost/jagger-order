import logoUrl from "@/assets/box-logo-transparent.png";
import { useTheme } from "@/lib/theme-context";

// Logo Box Pizza El Manar — fond transparent pour s'intégrer au fond.
const LOGO_URL = logoUrl;

export function BoxLogo({
  size = 88,
  height,
  showWordmark = false,
  className = "",
}: {
  size?: number;
  height?: number;
  showWordmark?: boolean;
  className?: string;
}) {
  const { theme } = useTheme();
  const h = height ?? size;

  // Emplacement de logo neutre pour les restaurants clients (pas de vrai
  // logo BOX) : même gabarit, même position dans chaque écran — seul le
  // rendu change (cf. design system, section 4 "le même écran, trois clients").
  if (!theme.hasLogo) {
    return (
      <div className={`flex flex-col items-center gap-2 ${className}`}>
        <div
          style={{ height: h, minWidth: h * 1.6 }}
          className="flex items-center justify-center rounded-md border border-dashed border-current px-2 font-mono text-[9px] uppercase tracking-wide text-current opacity-70"
        >
          Logo client
        </div>
        {showWordmark && (
          <span
            className="text-3xl font-black tracking-widest"
            style={{ color: "var(--brand-dark)" }}
          >
            {theme.restaurantName.toUpperCase()}
          </span>
        )}
      </div>
    );
  }

  const img = height ? (
    <img
      src={LOGO_URL}
      alt="Logo Box Pizza El Manar"
      height={height}
      style={{ height, width: "auto", objectFit: "contain" }}
      draggable={false}
    />
  ) : (
    <img
      src={LOGO_URL}
      alt="Logo Box Pizza El Manar"
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: "contain" }}
      draggable={false}
    />
  );

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      {img}
      {showWordmark && (
        <span className="text-3xl font-black tracking-widest text-brand-dark">BOX PIZZA</span>
      )}
    </div>
  );
}

export const BOX_LOGO_URL = LOGO_URL;
