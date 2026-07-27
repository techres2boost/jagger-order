import { CheckCircle2, Clock, PackageCheck, Truck, PartyPopper } from "lucide-react";

export type ProgressStatus = "pending" | "accepted" | "ready" | "delivering" | "delivered";

export const STEPS: { key: ProgressStatus; label: string; Icon: typeof Clock }[] = [
  { key: "pending", label: "Reçue", Icon: Clock },
  { key: "accepted", label: "En préparation", Icon: CheckCircle2 },
  { key: "ready", label: "Prête", Icon: PackageCheck },
  { key: "delivering", label: "En livraison", Icon: Truck },
  { key: "delivered", label: "Livrée", Icon: PartyPopper },
];

interface OrderProgressRingProps {
  stepIndex: number;
  // "full" : page de détail ; "compact" : carte de la liste des commandes.
  variant?: "full" | "compact";
}

export function OrderProgressRing({ stepIndex, variant = "full" }: OrderProgressRingProps) {
  const compact = variant === "compact";
  const size = compact ? 72 : 220;
  const r = compact ? 28 : 90;
  const strokeWidth = compact ? 6 : 14;
  const center = size / 2;
  const circumference = 2 * Math.PI * r;
  const gapDeg = 6;
  const segDeg = 72 - gapDeg;
  const segLen = (segDeg / 360) * circumference;
  const dashArray = `${segLen} ${circumference - segLen}`;
  const current = STEPS[Math.max(0, stepIndex)];

  const gradientId = `box-progress-ring-${compact ? "compact" : "full"}`;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: "var(--primary)" }} />
            <stop offset="1" style={{ stopColor: "var(--accent-warm)" }} />
          </linearGradient>
        </defs>
        {STEPS.map((step, i) => {
          const filled = i <= stepIndex;
          const startAngle = i * 72 - 90 + gapDeg / 2;
          return (
            <circle
              key={step.key}
              cx={center}
              cy={center}
              r={r}
              fill="none"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={dashArray}
              transform={`rotate(${startAngle} ${center} ${center})`}
              className={filled && !compact && i === stepIndex ? "animate-pulse" : undefined}
              style={{ stroke: filled ? `url(#${gradientId})` : "var(--border)" }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <current.Icon
          className={compact ? "h-5 w-5" : "h-9 w-9"}
          style={{ color: "var(--primary)" }}
        />
        {!compact && <span className="text-sm font-bold">{current.label}</span>}
      </div>
    </div>
  );
}
