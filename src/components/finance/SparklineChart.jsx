import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

export function SparklineChart({ data = [], color = 'text-primary' }) {
  const colorMap = {
    'text-emerald-600': '#10b981',
    'text-blue-600': '#3b82f6',
    'text-red-500': '#ef4444',
    'text-primary': '#b32240',
    'text-violet-600': '#7c3aed',
    'text-amber-500': '#f59e0b',
    'text-amber-600': '#d97706',
    'text-destructive': '#ef4444',
  };
  const stroke = colorMap[color] || '#6b7280';
  const chartData = data.map((v, i) => ({ v }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={stroke}
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 2, fill: stroke }}
        />
        <Tooltip
          contentStyle={{ display: 'none' }}
          cursor={{ stroke: stroke, strokeWidth: 1, strokeDasharray: '3 3' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}