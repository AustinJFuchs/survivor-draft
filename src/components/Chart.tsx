import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { data, drafterColor } from "../data";

/** Counted totals after each elimination. Rendered inside Standings once the season starts. */
export default function Chart() {
  const { history, season } = data;
  const rows = history.map((h) => ({ name: h.step === 0 ? "Start" : `#${h.step}${h.episode ? ` (E${h.episode})` : ""}`, ...h.totals }));

  return (
    <div className="card p-2 sm:p-5">
      <div className="flex items-baseline justify-between px-1 mb-1">
        <h3 className="font-display text-2xl sm:text-3xl">Points over time</h3>
        <div className="text-[11px] sm:text-sm text-sand-400">after each elimination</div>
      </div>
      <div className="h-[260px] sm:h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="rgba(236,217,179,0.08)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "#b99a5f", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "rgba(236,217,179,0.15)" }} interval="preserveStartEnd" />
            <YAxis tick={{ fill: "#b99a5f", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: "#10241f", border: "1px solid rgba(236,217,179,0.15)", borderRadius: 12, fontSize: 12 }}
              labelStyle={{ color: "#f7ecd6" }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {season.drafters.map((d) => (
              <Line
                key={d.id}
                type="monotone"
                dataKey={d.id}
                name={d.name}
                stroke={drafterColor(d.id)}
                strokeWidth={2.5}
                dot={{ r: 2.5, strokeWidth: 0, fill: drafterColor(d.id) }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
