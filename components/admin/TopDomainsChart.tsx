"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface Props {
  data: { domain: string; hours: number }[];
}

export function TopDomainsChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="domainGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.8} />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.8} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,0.04)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          unit="h"
        />
        <YAxis
          type="category"
          dataKey="domain"
          width={110}
          tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{ background: "#111118", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 12 }}
          labelStyle={{ color: "rgba(255,255,255,0.5)" }}
          itemStyle={{ color: "#a78bfa" }}
          formatter={(v) => [`${v}h`, "Total time"]}
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
        />
        <Bar dataKey="hours" fill="url(#domainGrad)" radius={[0, 4, 4, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}
