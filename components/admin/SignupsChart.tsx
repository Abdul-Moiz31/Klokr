"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface Props {
  data: { date: string; signups: number }[];
}

export function SignupsChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval={4}
        />
        <YAxis
          tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{ background: "#111118", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 12 }}
          labelStyle={{ color: "rgba(255,255,255,0.5)" }}
          itemStyle={{ color: "#a78bfa" }}
          cursor={{ stroke: "rgba(255,255,255,0.08)" }}
        />
        <Area
          type="monotone"
          dataKey="signups"
          stroke="#7c3aed"
          strokeWidth={2}
          fill="url(#signupGrad)"
          dot={false}
          activeDot={{ r: 4, fill: "#a78bfa", strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
