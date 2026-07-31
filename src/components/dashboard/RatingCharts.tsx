import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

// Bloc de graphiques des avis, extrait de `dashboard.tsx` pour être chargé en
// différé (React.lazy). Motif : `recharts` pèse ~515 ko et constituait
// l'essentiel du chunk de la route admin, alors que ces deux graphiques sont
// sous la ligne de flottaison et n'existent que si des avis ont été déposés.
// Le squelette de même hauteur côté appelant évite tout décalage de mise en page.

export interface RatingDistributionPoint {
  label: string;
  count: number;
}

export interface RatingTrendPoint {
  label: string;
  avg: number;
}

interface RatingChartsProps {
  distribution: RatingDistributionPoint[];
  trend: RatingTrendPoint[];
  /** Formatage à 1 décimale avec virgule décimale (convention FR). */
  formatRating: (value: number) => string;
}

const BRAND = "#B22222";
const AXIS_TICK = { fontSize: 12, fill: "currentColor" } as const;

export function RatingCharts({ distribution, trend, formatRating }: RatingChartsProps) {
  return (
    <>
      {/* Répartition des notes */}
      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Répartition des notes
        </h3>
        <div className="h-[220px] w-full text-muted-foreground">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={distribution} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                strokeOpacity={0.15}
                vertical={false}
              />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS_TICK} />
              <RechartsTooltip
                cursor={{ fill: BRAND, fillOpacity: 0.08 }}
                formatter={(value: number) => [value, "Avis"]}
                labelFormatter={(label: string) => `Note ${label}`}
              />
              <Bar dataKey="count" fill={BRAND} radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Évolution de la note moyenne dans le temps */}
      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Évolution de la note moyenne
        </h3>
        <div className="h-[220px] w-full text-muted-foreground">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                strokeOpacity={0.15}
                vertical={false}
              />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} />
              <YAxis
                domain={[0, 5]}
                ticks={[0, 1, 2, 3, 4, 5]}
                tickLine={false}
                axisLine={false}
                tick={AXIS_TICK}
              />
              <RechartsTooltip
                formatter={(value: number) => [formatRating(value), "Note moyenne"]}
              />
              <Line
                type="monotone"
                dataKey="avg"
                stroke={BRAND}
                strokeWidth={2}
                dot={{ r: 3, fill: BRAND }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

export default RatingCharts;
