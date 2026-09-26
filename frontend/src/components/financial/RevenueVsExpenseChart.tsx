import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { MonthlyData } from '../../services/reports.service';

const fmt = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function RevenueVsExpenseChart({ data }: { data: MonthlyData[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">Sem dados no período</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-base font-semibold text-gray-800 mb-4">Receita vs Despesa</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${v}`} />
          <Tooltip formatter={(value) => fmt(Number(value))} />
          <Legend />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#10B981"
            name="Receita"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="expense"
            stroke="#EF4444"
            name="Despesa"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
