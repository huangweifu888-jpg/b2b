import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartDatum = Record<string, string | number>;

type CartesianSeries = {
  key: string;
  name: string;
  color: string;
};

type ReportChartProps = {
  kind: "area" | "bar" | "pie";
  data: ChartDatum[];
  height: number;
  xKey?: string;
  series?: CartesianSeries[];
  showLegend?: boolean;
};

/** Recharts lives behind this route-level boundary so report chrome and data
 * remain interactive while the visual layer streams in independently. */
export default function ReportChart({
  kind,
  data,
  height,
  xKey = "date",
  series = [],
  showLegend = true,
}: ReportChartProps) {
  if (kind === "pie") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={90}
            dataKey="value"
            label={({ name, value }) => `${String(name)} ${String(value)}%`}
          >
            {data.map((entry, index) => (
              <Cell key={`${String(entry.name)}-${index}`} fill={String(entry.color || "#2563eb")} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  const content = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
      <XAxis dataKey={xKey} stroke="#94a3b8" fontSize={xKey === "hour" ? 10 : 12} interval={xKey === "hour" ? 2 : undefined} />
      <YAxis stroke="#94a3b8" fontSize={12} />
      <Tooltip />
      {showLegend ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
      {series.map((item) => kind === "area" ? (
        <Area
          key={item.key}
          type="monotone"
          dataKey={item.key}
          stroke={item.color}
          fill={`${item.color}20`}
          strokeWidth={2}
          name={item.name}
        />
      ) : (
        <Bar key={item.key} dataKey={item.key} fill={item.color} radius={[4, 4, 0, 0]} name={item.name} />
      ))}
    </>
  );

  return (
    <ResponsiveContainer width="100%" height={height}>
      {kind === "area" ? <AreaChart data={data}>{content}</AreaChart> : <BarChart data={data}>{content}</BarChart>}
    </ResponsiveContainer>
  );
}
