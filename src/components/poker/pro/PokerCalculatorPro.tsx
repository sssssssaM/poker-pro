'use client';

import { useState, useCallback, useMemo, lazy, Suspense } from 'react';
import {
  Calculator,
  Users,
  ChevronUp,
  ChevronDown,
  Target,
  Zap,
  RotateCcw,
  AlertCircle,
  LayoutGrid,
  SlidersHorizontal
} from 'lucide-react';
import { Card, Street, OpponentType, HandCombo } from '@/lib/poker/pro-types';
import { RangeMatrix, CommunityCardMatrix } from './HandMatrix';
import { AnalysisTabs } from './AnalysisTabs';
import { useSimulationWorker } from '@/hooks/useSimulationWorker';
import { calculatePotOdds } from '@/lib/poker/pot-odds';
import { calculateEVAdvanced } from '@/lib/poker/ev-calculator';

// Lazy load 重型分析模块
const loadOutsDetector = () => import('@/lib/poker/outs-detector');
const loadNutDetector = () => import('@/lib/poker/nut-detector');
const loadBlockerAnalysis = () => import('@/lib/poker/blocker-analysis');
const loadStreetEquity = () => import('@/lib/poker/street-equity');

// Lazy load 图表
const EquityChart = lazy(() => import('./EquityChart').then(m => ({ default: m.EquityChart })));

export function PokerCalculatorPro() {
  // ====== Range 状态 ======
  const [playerRange, setPlayerRange] = useState<Set<HandCombo>>(new Set());
  const [rangeString, setRangeString] = useState('');

  // ====== 游戏状态 ======
  const [communityCards, setCommunityCards] = useState<Card[]>([]);
  const [street, setStreet] = useState<Street>('preflop');

  // ====== 对手设置 ======
  const [opponentCount, setOpponentCount] = useState(1);
  const [opponentType, setOpponentType] = useState<OpponentType>('random');

  // ====== 筹码设置 ======
  const [potSize, setPotSize] = useState(100);
  const [betSize, setBetSize] = useState(50);
  const [stackSize, setStackSize] = useState(1000);

  // ====== 模拟次数 ======
  const [simulations, setSimulations] = useState(100000);

  // ====== UI 状态 ======
  const [rangeExpanded, setRangeExpanded] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [foldEquity, setFoldEquity] = useState(30);

  // ====== Phase 2 分析结果 ======
  const [outsResult, setOutsResult] = useState<Awaited<ReturnType<typeof import('@/lib/poker/outs-detector').detectOuts>> | null>(null);
  const [nutResult, setNutResult] = useState<Awaited<ReturnType<typeof import('@/lib/poker/nut-detector').detectNuts>> | null>(null);
  const [blockerResult, setBlockerResult] = useState<Awaited<ReturnType<typeof import('@/lib/poker/blocker-analysis').analyzeBlockers>> | null>(null);
  const [streetEquity, setStreetEquity] = useState<Awaited<ReturnType<typeof import('@/lib/poker/street-equity').calculateStreetEquityShift>> | null>(null);

  // ====== Worker Hook ======
  const {
    equityResult,
    isSimulating,
    progress,
    error,
    runSimulation,
    cancelSimulation,
    progressDetail
  } = useSimulationWorker();

  const hasRange = playerRange.size > 0;

  // 底池赔率
  const potOddsResult = useMemo(() =>
    calculatePotOdds(potSize, betSize),
    [potSize, betSize]
  );

  // EV 结果
  const evResult = useMemo(() => {
    if (!equityResult) return null;
    return calculateEVAdvanced(equityResult.win, potSize, betSize, foldEquity);
  }, [equityResult, potSize, betSize, foldEquity]);

  // Range 变化时触发模拟
  const handleRangeChange = useCallback((combos: Set<HandCombo>, str: string) => {
    setPlayerRange(combos);
    setRangeString(str);
    if (combos.size > 0) {
      setTimeout(() => {
        runSimulation(null, communityCards, opponentType, opponentCount, simulations, Array.from(combos));
      }, 50);
    }
  }, [communityCards, opponentType, opponentCount, simulations, runSimulation]);

  const updateStreetByCardCount = useCallback((cardCount: number) => {
    if (cardCount === 0) setStreet('preflop');
    else if (cardCount <= 3) setStreet('flop');
    else if (cardCount === 4) setStreet('turn');
    else setStreet('river');
  }, []);

  const handleCommunityCardSelect = useCallback((card: Card) => {
    setCommunityCards(prev => {
      const newCards = [...prev, card];
      updateStreetByCardCount(newCards.length);
      if (hasRange) {
        setTimeout(() => {
          runSimulation(null, newCards, opponentType, opponentCount, simulations, Array.from(playerRange));
        }, 50);
      }
      return newCards;
    });
  }, [hasRange, playerRange, opponentType, opponentCount, simulations, runSimulation, updateStreetByCardCount]);

  const handleCommunityCardRemove = useCallback((index: number) => {
    setCommunityCards(prev => {
      const newCards = prev.filter((_, i) => i !== index);
      updateStreetByCardCount(newCards.length);
      if (hasRange) {
        setTimeout(() => {
          runSimulation(null, newCards, opponentType, opponentCount, simulations, Array.from(playerRange));
        }, 50);
      }
      return newCards;
    });
  }, [hasRange, playerRange, opponentType, opponentCount, simulations, runSimulation, updateStreetByCardCount]);

  const handleOpponentTypeChange = useCallback((type: OpponentType) => {
    setOpponentType(type);
    if (hasRange) {
      runSimulation(null, communityCards, type, opponentCount, simulations, Array.from(playerRange));
    }
  }, [hasRange, playerRange, communityCards, opponentCount, simulations, runSimulation]);

  const handleOpponentCountChange = useCallback((count: number) => {
    setOpponentCount(count);
    if (hasRange) {
      runSimulation(null, communityCards, opponentType, count, simulations, Array.from(playerRange));
    }
  }, [hasRange, playerRange, communityCards, opponentType, simulations, runSimulation]);

  const handleStreetChange = useCallback((s: Street) => {
    setStreet(s);
    const cardCounts: Record<Street, number> = { preflop: 0, flop: 3, turn: 4, river: 5 };
    setCommunityCards(prev => prev.slice(0, cardCounts[s]));
  }, []);

  const getMaxCards = () => {
    if (street === 'flop') return 3;
    if (street === 'turn') return 4;
    if (street === 'river') return 5;
    return 0;
  };

  const getEquityColor = (equity: number) => {
    if (equity >= 60) return 'text-emerald-400';
    if (equity >= 50) return 'text-lime-400';
    if (equity >= 40) return 'text-yellow-400';
    if (equity >= 30) return 'text-orange-400';
    return 'text-red-400';
  };

  const OPPONENT_PILLS: { type: OpponentType; label: string; emoji: string }[] = [
    { type: 'random', label: '随机', emoji: '🎲' },
    { type: 'tight', label: 'TAG', emoji: '🎯' },
    { type: 'loose', label: 'LAG', emoji: '🔥' },
    { type: 'passive', label: '松被动', emoji: '🐢' },
    { type: 'nit', label: 'Nit', emoji: '🔒' },
    { type: 'custom', label: '自定义', emoji: '⚙️' },
  ];

  // ============================================
  // 渲染
  // ============================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* 顶部标题栏 */}
      <header className="bg-gray-900/80 border-b border-gray-700 sticky top-0 z-50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center">
                <Calculator className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-base lg:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
                  德州扑克 Pro
                </h1>
                <p className="text-gray-500 text-[10px] hidden sm:block">
                  Range vs Range · Structured Equity Analysis
                </p>
              </div>
            </div>

            {/* 桌面端快捷设置 */}
            <div className="hidden lg:flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <label className="text-gray-400 text-xs">模拟:</label>
                <select
                  value={simulations}
                  onChange={(e) => setSimulations(Number(e.target.value))}
                  disabled={isSimulating}
                  className="bg-gray-700 text-white text-sm rounded px-2 py-1 disabled:opacity-50 min-h-[36px]"
                >
                  <option value={10000}>10K</option>
                  <option value={50000}>50K</option>
                  <option value={100000}>100K</option>
                  <option value={200000}>200K</option>
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-gray-400 text-xs">对手:</label>
                <select
                  value={opponentCount}
                  onChange={(e) => handleOpponentCountChange(Number(e.target.value))}
                  disabled={isSimulating}
                  className="bg-gray-700 text-white text-sm rounded px-2 py-1 disabled:opacity-50 min-h-[36px]"
                >
                  {[1, 2, 3, 4, 5].map(n => (
                    <option key={n} value={n}>{n}人</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 py-3 lg:py-6">
        <div className="grid lg:grid-cols-3 gap-3 lg:gap-6">
          {/* ========== 左侧/移动端上方：输入区 ========== */}
          <div className="lg:col-span-1 space-y-3">

            {/* Range 编辑器 */}
            <div className="bg-gray-800/50 rounded-2xl backdrop-blur-sm border border-gray-700 overflow-hidden">
              <button
                onClick={() => setRangeExpanded(!rangeExpanded)}
                className="w-full flex items-center justify-between px-4 py-3 min-h-[48px]"
              >
                <div className="flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-emerald-400" />
                  <span className="text-white text-sm font-semibold">Range</span>
                  {hasRange && (
                    <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-0.5 rounded-full font-mono">
                      {playerRange.size} combos
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {hasRange && (
                    <span className="text-gray-400 text-xs font-mono truncate max-w-[120px]">{rangeString}</span>
                  )}
                  {rangeExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </button>

              {rangeExpanded && (
                <div className="px-2 pb-3 animate-in slide-in-from-top-2 duration-200">
                  <RangeMatrix
                    onRangeChange={handleRangeChange}
                    selectedRange={playerRange}
                    disabledCards={communityCards}
                  />
                </div>
              )}

              {!rangeExpanded && (
                <div className="px-3 pb-3 flex gap-1.5 overflow-x-auto no-scrollbar">
                  {[
                    { key: 'top5', label: 'Top 5%', combos: ['AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AQs', 'AKo'] },
                    { key: 'top10', label: 'Top 10%', combos: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', 'AKs', 'AQs', 'AJs', 'ATs', 'AKo', 'AQo', 'KQs'] },
                    { key: 'top20', label: 'Top 20%', combos: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', 'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A5s', 'A4s', 'KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs', 'AKo', 'AQo', 'AJo', 'ATo', 'KQo', 'KJo'] },
                    { key: 'pairs', label: '对子', combos: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22'] },
                  ].map(preset => (
                    <button
                      key={preset.key}
                      onClick={() => {
                        const combos = new Set<HandCombo>(preset.combos);
                        handleRangeChange(combos, preset.combos.join(', '));
                      }}
                      className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-medium bg-gray-700/60 text-gray-300 hover:bg-emerald-500/20 hover:text-emerald-400 transition-colors whitespace-nowrap min-h-[40px]"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 街道 + 公共牌 */}
            <div className="bg-gray-800/50 rounded-2xl p-3 backdrop-blur-sm border border-gray-700">
              <div className="flex gap-1.5 mb-2">
                {([
                  { id: 'preflop', label: '翻前' },
                  { id: 'flop', label: '翻牌' },
                  { id: 'turn', label: '转牌' },
                  { id: 'river', label: '河牌' }
                ] as const).map(s => (
                  <button
                    key={s.id}
                    onClick={() => handleStreetChange(s.id)}
                    disabled={isSimulating}
                    className={`
                      flex-1 py-2 rounded-xl text-center transition-all text-xs font-medium min-h-[44px]
                      ${street === s.id
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg'
                        : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                      }
                      disabled:opacity-50
                    `}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {street !== 'preflop' && (
                <CommunityCardMatrix
                  onCardSelect={handleCommunityCardSelect}
                  onCardRemove={handleCommunityCardRemove}
                  communityCards={communityCards}
                  disabledCards={[]}
                  maxCards={getMaxCards()}
                />
              )}
            </div>

            {/* 对手预设 + 对手数量 */}
            <div className="bg-gray-800/50 rounded-2xl p-3 backdrop-blur-sm border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white text-sm font-semibold flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-purple-400" />
                  对手
                </h3>
                {/* 对手数量 */}
                <div className="flex gap-1">
                  {[1, 2, 3].map(n => (
                    <button
                      key={n}
                      onClick={() => handleOpponentCountChange(n)}
                      disabled={isSimulating}
                      className={`
                        w-8 h-8 rounded-lg text-xs font-medium transition-all
                        ${opponentCount === n
                          ? 'bg-emerald-500 text-white'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        }
                        disabled:opacity-50
                      `}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {OPPONENT_PILLS.map(pill => (
                  <button
                    key={pill.type}
                    onClick={() => handleOpponentTypeChange(pill.type)}
                    disabled={isSimulating}
                    className={`
                      flex-shrink-0 flex items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-medium
                      transition-all min-h-[44px] whitespace-nowrap
                      ${opponentType === pill.type
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/20'
                        : 'bg-gray-700/60 text-gray-300 hover:bg-gray-600/60'
                      }
                      disabled:opacity-50
                    `}
                  >
                    <span>{pill.emoji}</span>
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 筹码设置 (可折叠) */}
            <div className="bg-gray-800/50 rounded-2xl backdrop-blur-sm border border-gray-700 overflow-hidden">
              <button
                onClick={() => setSettingsExpanded(!settingsExpanded)}
                className="w-full flex items-center justify-between px-4 py-3 min-h-[48px]"
              >
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-yellow-400" />
                  <span className="text-white text-sm font-semibold">筹码</span>
                  <span className="text-gray-400 text-xs">
                    底池 {potSize} · 下注 {betSize}
                  </span>
                </div>
                {settingsExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {settingsExpanded && (
                <div className="px-4 pb-3 animate-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: '底池', value: potSize, setter: setPotSize },
                      { label: '下注', value: betSize, setter: setBetSize },
                      { label: '筹码', value: stackSize, setter: setStackSize }
                    ].map(item => (
                      <div key={item.label}>
                        <label className="text-gray-400 text-[10px]">{item.label}</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={item.value}
                          onChange={(e) => item.setter(Number(e.target.value))}
                          className="w-full bg-gray-700 text-white rounded-lg px-2 py-2.5 text-sm mt-0.5 min-h-[44px] text-base"
                        />
                      </div>
                    ))}
                  </div>

                  {/* 模拟次数 */}
                  <div className="mt-2 pt-2 border-t border-gray-700/50">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-xs">模拟次数</span>
                      <div className="flex gap-1">
                        {[10000, 50000, 100000].map(n => (
                          <button
                            key={n}
                            onClick={() => setSimulations(n)}
                            disabled={isSimulating}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium min-h-[32px]
                              ${simulations === n ? 'bg-emerald-500 text-white' : 'bg-gray-700 text-gray-400'}
                              disabled:opacity-50`}
                          >
                            {n >= 1000 ? `${n / 1000}K` : n}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ========== 右侧/移动端下方：结果区（内联，所有视口都可见） ========== */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800/50 rounded-2xl p-4 lg:p-6 backdrop-blur-sm border border-gray-700">
              {!hasRange ? (
                <div className="text-center py-10 text-gray-400">
                  <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-medium">请选择你的 Range</p>
                  <p className="text-xs mt-1 text-gray-500">点击矩阵 cell 或使用快捷预设</p>
                </div>
              ) : isSimulating ? (
                <div className="text-center py-8">
                  <div className="relative w-24 h-24 lg:w-32 lg:h-32 mx-auto mb-4">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="#374151" strokeWidth="8" />
                      <circle
                        cx="50" cy="50" r="45" fill="none" stroke="url(#progressGrad)"
                        strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={`${progress * 2.83} 283`}
                        className="transition-all duration-300"
                      />
                      <defs>
                        <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#10b981" />
                          <stop offset="100%" stopColor="#14b8a6" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl lg:text-2xl font-bold text-white">{Math.round(progress)}%</span>
                    </div>
                  </div>
                  <p className="text-gray-400 text-sm mb-2">
                    Range vs Range · {simulations.toLocaleString()} 次模拟
                  </p>
                  <p className="text-emerald-400 text-xs mb-3 flex items-center justify-center gap-1">
                    <Zap className="w-3 h-3" /> Web Worker 后台计算
                  </p>
                  {progressDetail && (
                    <div className="flex justify-center gap-4 text-sm mb-3">
                      <span className="text-emerald-400">胜: {progressDetail.wins}</span>
                      <span className="text-yellow-400">平: {progressDetail.ties}</span>
                      <span className="text-red-400">负: {progressDetail.losses}</span>
                    </div>
                  )}
                  <button
                    onClick={cancelSimulation}
                    className="px-4 py-2.5 bg-red-500/20 text-red-400 rounded-xl text-sm hover:bg-red-500/30 flex items-center gap-2 mx-auto min-h-[44px]"
                  >
                    <RotateCcw className="w-4 h-4" /> 取消
                  </button>
                </div>
              ) : error ? (
                <div className="text-center py-10">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-400" />
                  <p className="text-red-400 mb-4">{error}</p>
                  <button
                    onClick={() => runSimulation(null, communityCards, opponentType, opponentCount, simulations, Array.from(playerRange))}
                    className="px-4 py-2.5 bg-emerald-500 text-white rounded-xl text-sm hover:bg-emerald-600 flex items-center gap-2 mx-auto min-h-[44px]"
                  >
                    <RotateCcw className="w-4 h-4" /> 重试
                  </button>
                </div>
              ) : equityResult ? (
                <AnalysisTabs
                  equityWin={equityResult.win}
                  equityTie={equityResult.tie}
                  equityLose={equityResult.lose}
                  simulations={equityResult.simulations}
                  rangeString={rangeString}
                  equityByCombo={equityResult.equityByCombo}
                  equityHistogram={equityResult.equityHistogram}
                  outsResult={outsResult}
                  potOddsResult={potOddsResult}
                  evResult={evResult}
                  blockerResult={blockerResult}
                  streetEquity={streetEquity}
                  nutResult={nutResult}
                  foldEquity={foldEquity}
                  onFoldEquityChange={setFoldEquity}
                  potSize={potSize}
                  betSize={betSize}
                />
              ) : null}
            </div>

            {/* Equity Chart (per combo) */}
            {equityResult?.equityByCombo && Object.keys(equityResult.equityByCombo).length > 0 && (
              <Suspense fallback={<div className="h-40 bg-gray-800/50 rounded-2xl mt-3 animate-pulse" />}>
                <div className="mt-3">
                  <EquityChart equityByCombo={equityResult.equityByCombo} />
                </div>
              </Suspense>
            )}
          </div>
        </div>
      </main>

      {/* 底部说明 */}
      <footer className="max-w-7xl mx-auto px-4 py-4 text-center text-gray-500 text-xs space-y-0.5">
        <p className="flex items-center justify-center gap-1">
          <Zap className="w-3 h-3" /> Range vs Range · Structured Equity · Histogram
        </p>
        <p>Web Worker · 100K sims · Mobile-First</p>
      </footer>
    </div>
  );
}
