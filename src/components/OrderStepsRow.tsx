import { STEPS } from "./OrderProgressRing";

interface OrderStepsRowProps {
  stepIndex: number;
}

// Rangée horizontale des 5 étapes (Reçue → Livrée) affichée sous l'anneau de
// progression. Toujours visible dès que la commande existe. Purement visuel :
// l'étape courante est déduite du statut (stepIndex) fourni par l'appelant.
export function OrderStepsRow({ stepIndex }: OrderStepsRowProps) {
  const last = STEPS.length - 1;
  // Rail : les icônes (h-9 = 36px) sont centrées dans des colonnes de largeur
  // égale (20% chacune) → centres à 10%, 30%, 50%, 70%, 90%. Le rail relie donc
  // 10% → 90%, et la portion "faite" va jusqu'à stepIndex.
  const filledWidth = last > 0 ? (Math.max(0, stepIndex) / last) * 80 : 0;

  return (
    <div className="relative mt-6">
      <div
        className="absolute left-[10%] right-[10%] top-[18px] h-0.5 -translate-y-1/2"
        style={{ background: "var(--border)" }}
      />
      <div
        className="absolute left-[10%] top-[18px] h-0.5 -translate-y-1/2 transition-[width] duration-500 ease-out"
        style={{ background: "var(--primary)", width: `${filledWidth}%` }}
      />
      <div className="relative flex justify-between">
        {STEPS.map((step, i) => {
          const reached = i <= stepIndex;
          const active = i === stepIndex;
          return (
            <div key={step.key} className="flex flex-1 flex-col items-center gap-1.5 text-center">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${
                  active ? "icon-swap" : ""
                }`}
                style={{
                  borderColor: reached ? "var(--primary)" : "var(--border)",
                  background: reached ? "var(--primary)" : "var(--card)",
                  color: reached ? "var(--primary-foreground)" : "var(--muted-foreground)",
                }}
              >
                <step.Icon className="h-4 w-4" />
              </div>
              <span
                className="text-[10px] font-semibold leading-tight"
                style={{ color: reached ? "var(--foreground)" : "var(--muted-foreground)" }}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
