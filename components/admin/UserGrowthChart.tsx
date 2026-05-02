"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface Props {
  data: { date: string; total: number }[];
}

export function UserGrowthChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "rgba(255,255,255,0.22)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval={4}
        />
        <YAxis
          tick={{ fill: "rgba(255,255,255,0.22)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{ background: "#111118", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 12 }}
          labelStyle={{ color: "rgba(255,255,255,0.4)" }}
          itemStyle={{ color: "#22d3ee" }}
          cursor={{ stroke: "rgba(255,255,255,0.06)" }}
        />
        <Area
          type="monotone"
          dataKey="total"
          name="Total users"
          stroke="#06b6d4"
          strokeWidth={2}
          fill="url(#growthGrad)"
          dot={false}
          activeDot={{ r: 4, fill: "#22d3ee", strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
