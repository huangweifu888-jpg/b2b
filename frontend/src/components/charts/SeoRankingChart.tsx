import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const rankTrend = [
  { date: "04-20", pos: 8 },
  { date: "04-21", pos: 7 },
  { date: "04-22", pos: 6 },
  { date: "04-23", pos: 5 },
  { date: "04-24", pos: 5 },
  { date: "04-25", pos: 4 },
  { date: "04-26", pos: 3 },
];

export default function SeoRankingChart() {
  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-base">关键词排名趋势</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={rankTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
            <YAxis reversed domain={[1, 20]} stroke="#94a3b8" fontSize={12} />
            <Tooltip />
            <Line type="monotone" dataKey="pos" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
