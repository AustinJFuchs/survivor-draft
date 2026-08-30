import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { data, drafterColor } from "../data";
import { SectionTitle } from "./ui";

export default function Chart() {
  const { history, season } = data;
  const rows = history.map((h) => ({ name: h.step === 0 ? "Start" : `#${h.step}${h.episode ? ` (E${h.episode})` : ""}`, ...h.totals }));

  return (
    <section>
      <SectionTitle sub="Counted totals after each elimination">Points over time</SectionTitle>
      {!data.seasonStarted ? (
        <div className="card p-6 text-sand-300">The chart draws itself once the first torch is snuffed.</div>
      ) : (
        <div className="card p-3 sm:p-5">
          <div className="h-[340px] sm:h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 10, right: 16, bottom: 0, left: -12 }}>
                <CartesianGrid stroke="rgba(236,217,179,0.08)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#b99a5f", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "rgba(236,217,179,0.15)" }} />
                <YAxis tick={{ fill: "#b99a5f", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
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
      )}
    </section>
  );
}
