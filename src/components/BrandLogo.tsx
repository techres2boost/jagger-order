import logoUrl from "@/assets/jagger-logo.png";
import { useTheme } from "@/lib/theme-context";

// Logo du restaurant (Jagger — food & drink).
const LOGO_URL = logoUrl;

export function BrandLogo({
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
  // logo fourni) : même gabarit, même position dans chaque écran — seul le
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

  const alt = `Logo ${theme.restaurantName}`;

  const img = height ? (
    <img
      src={LOGO_URL}
      alt={alt}
      height={height}
      style={{ height, width: "auto", objectFit: "contain" }}
      draggable={false}
    />
  ) : (
    <img
      src={LOGO_URL}
      alt={alt}
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
        <span className="text-3xl font-black tracking-widest text-brand-dark">
          {theme.restaurantName.toUpperCase()}
        </span>
      )}
    </div>
  );
}

export const BRAND_LOGO_URL = LOGO_URL;
