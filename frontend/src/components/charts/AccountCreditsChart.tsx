import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const creditUsage = [
  { d: "04-20", used: 420 },
  { d: "04-21", used: 380 },
  { d: "04-22", used: 510 },
  { d: "04-23", used: 620 },
  { d: "04-24", used: 480 },
  { d: "04-25", used: 590 },
  { d: "04-26", used: 720 },
];

export default function AccountCreditsChart() {
  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-base">最近 7 天积分消耗</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={creditUsage}>
            <defs>
              <linearGradient id="account-credits-usage" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="d" stroke="#94a3b8" fontSize={12} />
            <YAxis stroke="#94a3b8" fontSize={12} />
            <Tooltip />
            <Area type="monotone" dataKey="used" stroke="#f59e0b" fill="url(#account-credits-usage)" strokeWidth={2} name="消耗" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
