import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { data, drafterColor } from "../data";

/**
 * Counted totals after each elimination. Rendered inside Standings once the
 * season starts; the drafter sheet passes `highlight` to fade the others.
 */
export default function Chart({ highlight, compact }: { highlight?: string; compact?: boolean }) {
  const { history, season } = data;
  const rows = history.map((h) => ({ name: h.step === 0 ? "Start" : `#${h.step}${h.episode ? ` (E${h.episode})` : ""}`, ...h.totals }));

  return (
    <div className={`card ${compact ? "p-2" : "p-2 sm:p-5"}`}>
      <div className="flex items-baseline justify-between px-1 mb-1">
        <h3 className={`font-display ${compact ? "text-xl" : "text-2xl sm:text-3xl"}`}>Points over time</h3>
        <div className="text-[11px] sm:text-sm text-sand-400">after each elimination</div>
      </div>
      <div className={compact ? "h-[200px]" : "h-[260px] sm:h-[400px]"}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "var(--color-sand-400)", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} interval="preserveStartEnd" />
            <YAxis tick={{ fill: "var(--color-sand-400)", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: "var(--color-night-800)", border: "1px solid var(--chart-grid)", borderRadius: 12, fontSize: 12 }}
              labelStyle={{ color: "var(--color-sand-100)" }}
            />
            {!compact && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {season.drafters.map((d) => {
              const faded = highlight !== undefined && d.id !== highlight;
              return (
                <Line
                  key={d.id}
                  type="monotone"
                  dataKey={d.id}
                  name={d.name}
                  stroke={drafterColor(d.id)}
                  strokeWidth={faded ? 1.5 : 2.5}
                  strokeOpacity={faded ? 0.25 : 1}
                  dot={faded ? false : { r: 2.5, strokeWidth: 0, fill: drafterColor(d.id) }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
