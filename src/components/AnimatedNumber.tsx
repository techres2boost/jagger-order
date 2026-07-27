interface AnimatedNumberProps {
  value: string;
  className?: string;
}

const NBSP = " ";

// Affiche une valeur de compte à rebours en n'animant QUE les caractères qui
// changent : chaque position garde une key stable `${index}-${char}`. Quand un
// chiffre change, seule cette position est re-montée et rejoue `digit-roll` ; les
// autres restent immobiles. Purement présentational — la valeur et son calcul
// (interval, arrival_at, etc.) restent entièrement gérés par l'appelant.
export function AnimatedNumber({ value, className }: AnimatedNumberProps) {
  return (
    <div className={className} aria-label={value}>
      {value.split("").map((char, i) => {
        const isSpace = char === " ";
        return (
          <span
            key={`${i}-${char}`}
            aria-hidden="true"
            className={isSpace ? "inline-block" : "digit-roll inline-block"}
          >
            {isSpace ? NBSP : char}
          </span>
        );
      })}
    </div>
  );
}
