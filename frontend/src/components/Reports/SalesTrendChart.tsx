import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { SalesTrendDataPoint } from '../../services/reports.service';

interface SalesTrendChartProps {
  data: SalesTrendDataPoint[];
}

const formatPKR = (val: number | undefined | null) => {
  if (val === undefined || val === null || isNaN(val)) return 'Rs. 0';
  if (Math.abs(val) >= 100000) {
    return `Rs. ${(val / 100000).toFixed(1)}L`;
  }
  if (Math.abs(val) >= 1000) {
    return `Rs. ${(val / 1000).toFixed(0)}k`;
  }
  return `Rs. ${val.toLocaleString('en-PK')}`;
};

const formatFullPKR = (val: number | undefined | null) => {
  if (val === undefined || val === null || isNaN(val)) return 'Rs. 0.00';
  return `Rs. ${Number(val).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const rev = payload.find((p: any) => p.dataKey === 'daily_revenue')?.value ?? 0;
    const marginObj = payload.find((p: any) => p.dataKey === 'margin_pct');
    const cogsObj = payload.find((p: any) => p.dataKey === 'daily_cogs');
    
    let marginPct = 0;
    if (marginObj !== undefined && marginObj.value !== undefined) {
      marginPct = Number(marginObj.value);
    } else if (rev > 0 && cogsObj !== undefined) {
      marginPct = ((rev - Number(cogsObj.value || 0)) / rev) * 100;
    }

    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-xl border border-slate-800 text-xs space-y-2 font-mono">
        <p className="font-bold text-slate-300 border-b border-slate-700 pb-1 font-sans text-sm">
          📅 Date: {label}
        </p>
        <div className="space-y-1.5 pt-0.5">
          <div className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-blue-400 font-medium">
              <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
              Revenue Volume:
            </span>
            <span className="font-bold tabular-nums text-white">{formatFullPKR(rev)}</span>
          </div>

          <div className="flex items-center justify-between gap-6 pt-1 border-t border-slate-800">
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
              Gross Margin:
            </span>
            <span className="font-black tabular-nums text-emerald-400">
              {Number(marginPct).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export const SalesTrendChart: React.FC<SalesTrendChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs font-medium">
        No daily trend data available for the selected period.
      </div>
    );
  }

  return (
    <div className="w-full h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

          <XAxis
            dataKey="date"
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
          />

          {/* Left YAxis: Revenue Volume (Currency) */}
          <YAxis
            yAxisId="left"
            orientation="left"
            tickFormatter={formatPKR}
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
          />

          {/* Right YAxis: Margin Efficiency (%) */}
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(val) => `${val}%`}
            tick={{ fill: '#10b981', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            domain={[0, 'auto']}
          />

          <Tooltip content={<CustomTooltip />} />

          <Legend
            wrapperStyle={{ paddingTop: 12, fontSize: 12 }}
            formatter={(value) => <span className="text-slate-700 font-semibold">{value}</span>}
          />

          {/* Layer 1: Revenue Volume Area */}
          <Area
            type="monotone"
            dataKey="daily_revenue"
            yAxisId="left"
            name="Revenue Volume"
            stroke="#3b82f6"
            strokeWidth={2.5}
            fill="url(#colorRevenue)"
            fillOpacity={1}
          />

          {/* Layer 2: Margin Efficiency Line */}
          <Line
            type="monotone"
            dataKey="margin_pct"
            yAxisId="right"
            name="Gross Margin %"
            stroke="#10b981"
            strokeWidth={3}
            dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#ffffff' }}
            activeDot={{ r: 6 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};
