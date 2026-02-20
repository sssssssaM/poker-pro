'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { HandCombo } from '@/lib/poker/pro-types';

interface EquityChartProps {
    equityByCombo: Record<HandCombo, { wins: number; total: number; equity: number }>;
    className?: string;
}

function getEquityColor(equity: number): string {
    if (equity >= 60) return '#10b981';
    if (equity >= 50) return '#84cc16';
    if (equity >= 40) return '#eab308';
    if (equity >= 30) return '#f97316';
    return '#ef4444';
}

export function EquityChart({ equityByCombo, className = '' }: EquityChartProps) {
    const data = useMemo(() => {
        return Object.entries(equityByCombo)
            .filter(([, v]) => v.total > 0)
            .map(([combo, v]) => ({
                combo,
                equity: Math.round(v.equity * 10) / 10,
                total: v.total
            }))
            .sort((a, b) => b.equity - a.equity);
    }, [equityByCombo]);

    if (data.length === 0) return null;

    return (
        <div className={`bg-gray-800/50 rounded-2xl p-4 sm:p-6 backdrop-blur-sm border border-gray-700 ${className}`}>
            <h2 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                Equity 分布（按 Combo）
            </h2>

            <div className="w-full" style={{ height: Math.max(200, Math.min(400, data.length * 24)) }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                    >
                        <XAxis
                            type="number"
                            domain={[0, 100]}
                            tick={{ fill: '#9ca3af', fontSize: 11 }}
                            tickFormatter={(v) => `${v}%`}
                        />
                        <YAxis
                            dataKey="combo"
                            type="category"
                            tick={{ fill: '#d1d5db', fontSize: 11, fontWeight: 600 }}
                            width={45}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1f2937',
                                border: '1px solid #374151',
                                borderRadius: '8px',
                                color: '#fff',
                                fontSize: '13px'
                            }}
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            formatter={(value: number, _name: string, entry: any) => [
                                `${value}% (${entry?.payload?.total ?? 0} 样本)`,
                                'Equity'
                            ]}
                        />
                        <Bar dataKey="equity" radius={[0, 4, 4, 0]} maxBarSize={20}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={getEquityColor(entry.equity)} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* 摘要统计 */}
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="bg-gray-900/50 rounded-lg p-2">
                    <div className="text-emerald-400 text-sm font-bold">
                        {data.length > 0 ? data[0].combo : '-'}
                    </div>
                    <div className="text-gray-400 text-xs">最强 Combo</div>
                </div>
                <div className="bg-gray-900/50 rounded-lg p-2">
                    <div className="text-yellow-400 text-sm font-bold">
                        {data.length > 0 ? `${(data.reduce((s, d) => s + d.equity, 0) / data.length).toFixed(1)}%` : '-'}
                    </div>
                    <div className="text-gray-400 text-xs">平均 Equity</div>
                </div>
                <div className="bg-gray-900/50 rounded-lg p-2">
                    <div className="text-red-400 text-sm font-bold">
                        {data.length > 0 ? data[data.length - 1].combo : '-'}
                    </div>
                    <div className="text-gray-400 text-xs">最弱 Combo</div>
                </div>
            </div>
        </div>
    );
}
