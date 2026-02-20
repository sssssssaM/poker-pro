'use client';

import { useState, useMemo } from 'react';
import {
    TrendingUp,
    Target,
    Calculator,
    Shield,
    Layers,
    Zap,
    ChevronRight,
    ArrowUp,
    ArrowDown,
    Minus
} from 'lucide-react';
import { CardIndex, cardToString } from '@/lib/poker/card';
import type {
    OutsResult,
    DrawBreakdown,
    PotOddsResult,
    EVAdvancedResult,
    BlockerComboInfo,
    BlockerResult,
    StreetEquityResult,
    NutResult
} from '@/lib/poker/pro-types';

// ============================================
// Tab 类型
// ============================================
export type AnalysisTab = 'equity' | 'outs' | 'ev' | 'blockers';

interface AnalysisTabsProps {
    // 基础 equity 数据 (外部传入)
    equityWin: number;
    equityTie: number;
    equityLose: number;
    simulations: number;
    rangeString: string;

    // Phase 2 分析数据 (可选, 按需加载后传入)
    outsResult?: OutsResult | null;
    potOddsResult?: PotOddsResult | null;
    evResult?: EVAdvancedResult | null;
    blockerResult?: BlockerResult | null;
    streetEquity?: StreetEquityResult | null;
    nutResult?: NutResult | null;

    // EV 控制
    foldEquity: number;
    onFoldEquityChange: (value: number) => void;
    potSize: number;
    betSize: number;

    // 紧凑模式
    compact?: boolean;
}

// ============================================
// Tab 定义
// ============================================
const TABS: { id: AnalysisTab; label: string; icon: React.ReactNode }[] = [
    { id: 'equity', label: 'Equity', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'outs', label: 'Outs', icon: <Target className="w-4 h-4" /> },
    { id: 'ev', label: 'EV', icon: <Calculator className="w-4 h-4" /> },
    { id: 'blockers', label: 'Blockers', icon: <Shield className="w-4 h-4" /> },
];

// ============================================
// 主组件
// ============================================
export function AnalysisTabs({
    equityWin, equityTie, equityLose, simulations, rangeString,
    outsResult, potOddsResult, evResult, blockerResult, streetEquity, nutResult,
    foldEquity, onFoldEquityChange, potSize, betSize,
    compact = false
}: AnalysisTabsProps) {
    const [activeTab, setActiveTab] = useState<AnalysisTab>('equity');

    return (
        <div className="space-y-3">
            {/* Tab 栏 — 水平滚动 pill bar */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                            flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium
                            whitespace-nowrap transition-all min-h-[36px] flex-shrink-0
                            ${activeTab === tab.id
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20'
                                : 'bg-gray-700/60 text-gray-400 hover:bg-gray-600/60 hover:text-gray-300'
                            }
                        `}
                    >
                        {tab.icon}
                        {tab.label}
                        {tab.id === 'outs' && outsResult && (
                            <span className="bg-white/20 px-1.5 py-0.5 rounded-md text-[10px]">
                                {outsResult.totalOuts}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab 内容 */}
            <div className="min-h-[200px]">
                {activeTab === 'equity' && (
                    <EquityPanel
                        win={equityWin} tie={equityTie} lose={equityLose}
                        simulations={simulations} rangeString={rangeString}
                        streetEquity={streetEquity} nutResult={nutResult}
                        compact={compact}
                    />
                )}
                {activeTab === 'outs' && (
                    <OutsPanel result={outsResult} compact={compact} />
                )}
                {activeTab === 'ev' && (
                    <EVPanel
                        evResult={evResult}
                        potOddsResult={potOddsResult}
                        foldEquity={foldEquity}
                        onFoldEquityChange={onFoldEquityChange}
                        potSize={potSize}
                        betSize={betSize}
                        compact={compact}
                    />
                )}
                {activeTab === 'blockers' && (
                    <BlockerPanel result={blockerResult} compact={compact} />
                )}
            </div>
        </div>
    );
}

// ============================================
// Equity 面板
// ============================================
function EquityPanel({
    win, tie, lose, simulations, rangeString,
    streetEquity, nutResult, compact
}: {
    win: number; tie: number; lose: number;
    simulations: number; rangeString: string;
    streetEquity?: StreetEquityResult | null;
    nutResult?: NutResult | null;
    compact?: boolean;
}) {
    const equityColor = getEquityColor(win);
    const gradientClass = getEquityGradient(win);

    return (
        <div className="space-y-3">
            {/* 主 Equity 显示 */}
            <div className="flex items-center justify-between">
                <div className="min-w-0">
                    <div className="text-gray-400 text-xs mb-0.5">你的 Range</div>
                    <div className="text-white text-xs font-mono bg-gray-900/50 px-2 py-1 rounded-lg truncate max-w-[160px]">
                        {rangeString || '全部'}
                    </div>
                </div>
                <div className="text-right flex-shrink-0">
                    <div className={`${compact ? 'text-3xl' : 'text-4xl'} font-bold ${equityColor}`}>
                        {win.toFixed(1)}%
                    </div>
                    <div className="text-gray-400 text-xs">胜率</div>
                </div>
            </div>

            {/* Equity 进度条 */}
            <div>
                <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full bg-gradient-to-r ${gradientClass} transition-all duration-500`}
                        style={{ width: `${win}%` }}
                    />
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
                    <span>0%</span><span>50%</span><span>100%</span>
                </div>
            </div>

            {/* 三项统计 */}
            <div className="grid grid-cols-4 gap-1.5">
                {[
                    { label: '胜', value: win, color: 'text-emerald-400' },
                    { label: '平', value: tie, color: 'text-yellow-400' },
                    { label: '负', value: lose, color: 'text-red-400' },
                    { label: '样本', value: simulations, color: 'text-blue-400', isInt: true }
                ].map(item => (
                    <div key={item.label} className="bg-gray-900/50 rounded-lg p-2 text-center">
                        <div className={`${item.color} text-sm font-bold`}>
                            {item.isInt ? (item.value >= 1000 ? `${(item.value / 1000).toFixed(0)}K` : item.value) : `${item.value.toFixed(compact ? 0 : 1)}%`}
                        </div>
                        <div className="text-gray-500 text-[10px]">{item.label}</div>
                    </div>
                ))}
            </div>

            {/* 街道 Equity 变化 */}
            {streetEquity && (
                <div className="bg-gray-900/30 rounded-xl p-3">
                    <div className="text-gray-400 text-xs mb-2 flex items-center gap-1">
                        <Layers className="w-3 h-3" /> Equity 走势
                    </div>
                    <div className="flex items-end justify-between gap-2">
                        {(['flop', 'turn', 'river'] as const).map((s, idx) => {
                            const data = streetEquity[s];
                            if (!data) return null;
                            const prev = idx > 0 ? streetEquity[(['flop', 'turn', 'river'] as const)[idx - 1]] : null;
                            const delta = prev ? data.equity - prev.equity : 0;
                            return (
                                <div key={s} className="flex-1 text-center">
                                    <div className={`text-lg font-bold ${getEquityColor(data.equity)}`}>
                                        {data.equity.toFixed(1)}%
                                    </div>
                                    {idx > 0 && (
                                        <div className={`text-[10px] flex items-center justify-center gap-0.5 ${delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                                            {delta > 0 ? <ArrowUp className="w-2.5 h-2.5" /> : delta < 0 ? <ArrowDown className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
                                            {Math.abs(delta).toFixed(1)}
                                        </div>
                                    )}
                                    <div className="text-gray-500 text-[10px] mt-0.5">
                                        {s === 'flop' ? '翻牌' : s === 'turn' ? '转牌' : '河牌'}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 坚果牌信息 */}
            {nutResult && (
                <div className={`rounded-xl p-3 ${nutResult.heroIsNuts ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-gray-900/30'}`}>
                    <div className="flex items-center justify-between">
                        <div className="text-gray-400 text-xs flex items-center gap-1">
                            <Zap className="w-3 h-3" /> 坚果排名
                        </div>
                        <div className={`text-sm font-bold ${nutResult.heroIsNuts ? 'text-emerald-400' : 'text-gray-300'}`}>
                            {nutResult.heroIsNuts ? '🥇 坚果牌!' : `#${nutResult.nutRank} / ${nutResult.totalPossible}`}
                        </div>
                    </div>
                    <div className="text-gray-500 text-[10px] mt-1">
                        当前坚果: {nutResult.currentNuts}
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================
// Outs 面板
// ============================================
function OutsPanel({ result, compact }: { result?: OutsResult | null; compact?: boolean }) {
    if (!result || result.totalOuts === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">暂无听牌 / 需要翻牌后分析</p>
                <p className="text-xs mt-1">请选择公共牌 (3-4 张)</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* 总 Outs */}
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl p-3 border border-amber-500/20">
                <div className="flex items-center justify-between">
                    <div className="text-amber-400 text-xs font-medium">总 Outs</div>
                    <div className="text-amber-400 text-2xl font-bold">{result.totalOuts}</div>
                </div>
            </div>

            {/* 听牌类型分组 */}
            <div className="space-y-2">
                {result.drawTypes.map(draw => (
                    <DrawTypeRow key={draw.type} draw={draw} />
                ))}
            </div>
        </div>
    );
}

function DrawTypeRow({ draw }: { draw: DrawBreakdown }) {
    const colors: Record<string, string> = {
        'flush-draw': 'text-blue-400 bg-blue-400/10',
        'oesd': 'text-purple-400 bg-purple-400/10',
        'gutshot': 'text-violet-400 bg-violet-400/10',
        'overcards': 'text-cyan-400 bg-cyan-400/10',
        'pair-to-trips': 'text-emerald-400 bg-emerald-400/10',
        'pair-to-two-pair': 'text-teal-400 bg-teal-400/10',
    };
    const colorClass = colors[draw.type] || 'text-gray-400 bg-gray-400/10';
    const [textColor, bgColor] = colorClass.split(' ');

    return (
        <div className={`${bgColor} rounded-lg p-2.5 border border-white/5`}>
            <div className="flex items-center justify-between mb-1.5">
                <span className={`${textColor} text-xs font-medium`}>{draw.label}</span>
                <span className={`${textColor} text-sm font-bold`}>{draw.count} outs</span>
            </div>
            <div className="flex flex-wrap gap-1">
                {draw.cards.slice(0, 12).map(card => (
                    <span
                        key={card}
                        className="text-[10px] bg-gray-800/80 text-gray-300 px-1.5 py-0.5 rounded font-mono"
                    >
                        {cardToString(card)}
                    </span>
                ))}
                {draw.cards.length > 12 && (
                    <span className="text-[10px] text-gray-500">+{draw.cards.length - 12}</span>
                )}
            </div>
        </div>
    );
}

// ============================================
// EV 面板
// ============================================
function EVPanel({
    evResult, potOddsResult, foldEquity, onFoldEquityChange,
    potSize, betSize, compact
}: {
    evResult?: EVAdvancedResult | null;
    potOddsResult?: PotOddsResult | null;
    foldEquity: number;
    onFoldEquityChange: (v: number) => void;
    potSize: number;
    betSize: number;
    compact?: boolean;
}) {
    return (
        <div className="space-y-3">
            {/* Pot Odds */}
            {potOddsResult && (
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-900/50 rounded-lg p-2.5 text-center">
                        <div className="text-white text-lg font-bold">{potOddsResult.potOddsRatio}</div>
                        <div className="text-gray-500 text-[10px]">底池赔率</div>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-2.5 text-center">
                        <div className="text-white text-lg font-bold">{potOddsResult.breakEvenEquity.toFixed(1)}%</div>
                        <div className="text-gray-500 text-[10px]">盈亏平衡</div>
                    </div>
                </div>
            )}

            {/* Fold Equity 滑块 */}
            <div className="bg-gray-900/30 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-xs">弃牌率 (Fold Equity)</span>
                    <span className="text-white text-sm font-bold">{foldEquity}%</span>
                </div>
                <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={foldEquity}
                    onChange={e => onFoldEquityChange(Number(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer
                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                        [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-full
                        [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-emerald-500/30"
                />
                <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                    <span>0%</span><span>50%</span><span>100%</span>
                </div>
            </div>

            {/* EV 结果 */}
            {evResult && (
                <>
                    <div className={`rounded-xl p-3 text-center ${evResult.isPositiveEV ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                        <div className={`text-3xl font-bold ${evResult.isPositiveEV ? 'text-emerald-400' : 'text-red-400'}`}>
                            {evResult.totalEV > 0 ? '+' : ''}{evResult.totalEV.toFixed(2)}
                        </div>
                        <div className="text-gray-400 text-xs mt-1">总期望值 (EV)</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-gray-900/50 rounded-lg p-2.5 text-center">
                            <div className="text-emerald-400 text-sm font-bold">+{evResult.foldEV.toFixed(1)}</div>
                            <div className="text-gray-500 text-[10px]">Fold EV</div>
                        </div>
                        <div className="bg-gray-900/50 rounded-lg p-2.5 text-center">
                            <div className={`text-sm font-bold ${evResult.callEV >= 0 ? 'text-lime-400' : 'text-red-400'}`}>
                                {evResult.callEV > 0 ? '+' : ''}{evResult.callEV.toFixed(1)}
                            </div>
                            <div className="text-gray-500 text-[10px]">Call EV</div>
                        </div>
                    </div>

                    {/* 建议 */}
                    <div className="bg-gray-900/30 rounded-xl p-3">
                        <div className="text-sm">{evResult.recommendation}</div>
                        {evResult.minFoldEquity > 0 && (
                            <div className="text-gray-500 text-[10px] mt-1">
                                最低弃牌率: {evResult.minFoldEquity.toFixed(1)}%
                            </div>
                        )}
                    </div>
                </>
            )}

            {!evResult && !potOddsResult && (
                <div className="text-center py-8 text-gray-500">
                    <Calculator className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">请先选择 Range 计算 Equity</p>
                </div>
            )}
        </div>
    );
}

// ============================================
// Blockers 面板
// ============================================
function BlockerPanel({ result, compact }: { result?: BlockerResult | null; compact?: boolean }) {
    if (!result || result.blockerDetails.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">需要指定手牌进行 Blocker 分析</p>
                <p className="text-xs mt-1">用于精确手牌 vs Range 的场景</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* 总体统计 */}
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl p-3 border border-purple-500/20">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-purple-400 text-xs">整体阻挡</div>
                        <div className="text-gray-400 text-[10px] mt-0.5">
                            {result.totalBlocked} / {result.totalRangeCombos} combos 被阻挡
                        </div>
                    </div>
                    <div className="text-purple-400 text-2xl font-bold">
                        {result.overallBlockPercent.toFixed(1)}%
                    </div>
                </div>
            </div>

            {/* Combo 列表 */}
            <div className="space-y-1 max-h-[250px] overflow-y-auto">
                {result.blockerDetails.slice(0, 15).map(info => (
                    <BlockerRow key={info.combo} info={info} />
                ))}
                {result.blockerDetails.length > 15 && (
                    <div className="text-center text-gray-500 text-xs py-1">
                        +{result.blockerDetails.length - 15} more combos
                    </div>
                )}
            </div>
        </div>
    );
}

function BlockerRow({ info }: { info: BlockerComboInfo }) {
    const barWidth = Math.min(100, info.blockPercent);
    const intensity = info.blockPercent > 50 ? 'text-purple-400' : info.blockPercent > 25 ? 'text-purple-300' : 'text-gray-400';

    return (
        <div className="flex items-center gap-2 bg-gray-900/30 rounded-lg px-2.5 py-1.5">
            <span className="text-white text-xs font-mono w-8 flex-shrink-0">{info.combo}</span>
            <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                    style={{ width: `${barWidth}%` }}
                />
            </div>
            <span className={`${intensity} text-xs font-bold w-10 text-right flex-shrink-0`}>
                {info.blockPercent.toFixed(0)}%
            </span>
            <span className="text-gray-600 text-[10px] w-8 text-right flex-shrink-0">
                {info.remainingCombos}/{info.totalCombos}
            </span>
        </div>
    );
}

// ============================================
// 工具函数
// ============================================
function getEquityColor(equity: number): string {
    if (equity >= 60) return 'text-emerald-400';
    if (equity >= 50) return 'text-lime-400';
    if (equity >= 40) return 'text-yellow-400';
    if (equity >= 30) return 'text-orange-400';
    return 'text-red-400';
}

function getEquityGradient(equity: number): string {
    if (equity >= 60) return 'from-emerald-500 to-green-400';
    if (equity >= 50) return 'from-lime-500 to-emerald-400';
    if (equity >= 40) return 'from-yellow-500 to-lime-400';
    if (equity >= 30) return 'from-orange-500 to-yellow-400';
    return 'from-red-500 to-orange-400';
}
