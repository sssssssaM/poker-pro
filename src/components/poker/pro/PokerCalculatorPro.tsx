'use client';

import { useState, useCallback, useMemo, lazy, Suspense } from 'react';
import { Drawer, DrawerContent, DrawerTrigger, DrawerTitle } from '@/components/ui/drawer';
import {
  Calculator,
  Users,
  Coins,
  Play,
  ChevronUp,
  ChevronDown,
  TrendingUp,
  BarChart3,
  Target,
  Zap,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  LayoutGrid,
  SlidersHorizontal
} from 'lucide-react';
import { Card, Street, OpponentType, HandCombo, OPPONENT_PROFILES, SUIT_SYMBOLS } from '@/lib/poker/pro-types';
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

  // ====== UI 状态 (Phase 3) ======
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

  // 是否有选中 range
  const hasRange = playerRange.size > 0;

  // 底池赔率 (同步, 轻量)
  const potOddsResult = useMemo(() =>
    calculatePotOdds(potSize, betSize),
    [potSize, betSize]
  );

  // EV 结果 (含 fold equity)
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

  // 更新街道
  const updateStreetByCardCount = useCallback((cardCount: number) => {
    if (cardCount === 0) setStreet('preflop');
    else if (cardCount <= 3) setStreet('flop');
    else if (cardCount === 4) setStreet('turn');
    else setStreet('river');
  }, []);

  // 公共牌选择
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

  // 公共牌移除
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

  // 对手类型变化
  const handleOpponentTypeChange = useCallback((type: OpponentType) => {
    setOpponentType(type);
    if (hasRange) {
      runSimulation(null, communityCards, type, opponentCount, simulations, Array.from(playerRange));
    }
  }, [hasRange, playerRange, communityCards, opponentCount, simulations, runSimulation]);

  // 对手数量变化
  const handleOpponentCountChange = useCallback((count: number) => {
    setOpponentCount(count);
    if (hasRange) {
      runSimulation(null, communityCards, opponentType, count, simulations, Array.from(playerRange));
    }
  }, [hasRange, playerRange, communityCards, opponentType, simulations, runSimulation]);

  // 街道切换
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

  // ============================================
  // Equity 颜色
  // ============================================
  const getEquityColor = (equity: number) => {
    if (equity >= 60) return 'text-emerald-400';
    if (equity >= 50) return 'text-lime-400';
    if (equity >= 40) return 'text-yellow-400';
    if (equity >= 30) return 'text-orange-400';
    return 'text-red-400';
  };

  // ============================================
  // 对手预设 (Phase 3: 水平 pill 滚动条)
  // ============================================
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 pb-20 lg:pb-0">
      {/* 顶部标题栏 — 紧凑 */}
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
                  Range vs Range · Phase 2 Pro Analysis
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
          {/* 左侧：输入区 */}
          <div className="lg:col-span-1 space-y-3">

            {/* ========== Phase 3: 可折叠 Range 编辑器 ========== */}
            <div className="bg-gray-800/50 rounded-2xl backdrop-blur-sm border border-gray-700 overflow-hidden">
              {/* 折叠头部 — 始终可见 */}
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

              {/* Range 矩阵 — 可折叠 */}
              {rangeExpanded && (
                <div className="px-2 pb-3 animate-in slide-in-from-top-2 duration-200">
                  <RangeMatrix
                    onRangeChange={handleRangeChange}
                    selectedRange={playerRange}
                    disabledCards={communityCards}
                  />
                </div>
              )}

              {/* 收起时的快速 Range 预设 */}
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
                      className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-700/60 text-gray-300 hover:bg-emerald-500/20 hover:text-emerald-400 transition-colors whitespace-nowrap min-h-[32px]"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ========== 街道 + 公共牌 ========== */}
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
                      flex-1 py-2 rounded-xl text-center transition-all text-xs font-medium min-h-[40px]
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

            {/* ========== Phase 3: 对手预设 pill 滚动条 ========== */}
            <div className="bg-gray-800/50 rounded-2xl p-3 backdrop-blur-sm border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white text-sm font-semibold flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-purple-400" />
                  对手
                </h3>
                {/* 移动端对手数量 */}
                <div className="lg:hidden flex gap-1">
                  {[1, 2, 3].map(n => (
                    <button
                      key={n}
                      onClick={() => handleOpponentCountChange(n)}
                      disabled={isSimulating}
                      className={`
                        w-7 h-7 rounded-lg text-xs font-medium transition-all
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

              {/* 水平 pill 滚动 */}
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {OPPONENT_PILLS.map(pill => (
                  <button
                    key={pill.type}
                    onClick={() => handleOpponentTypeChange(pill.type)}
                    disabled={isSimulating}
                    className={`
                      flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium
                      transition-all min-h-[40px] whitespace-nowrap
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

            {/* ========== 筹码设置 (可折叠) ========== */}
            <div className="bg-gray-800/50 rounded-2xl backdrop-blur-sm border border-gray-700 overflow-hidden">
              <button
                onClick={() => setSettingsExpanded(!settingsExpanded)}
                className="w-full flex items-center justify-between px-4 py-3 min-h-[44px]"
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
                          value={item.value}
                          onChange={(e) => item.setter(Number(e.target.value))}
                          className="w-full bg-gray-700 text-white rounded-lg px-2 py-2 text-sm mt-0.5 min-h-[40px] text-base"
                        />
                      </div>
                    ))}
                  </div>

                  {/* 移动端模拟次数 */}
                  <div className="lg:hidden mt-2 pt-2 border-t border-gray-700/50">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-xs">模拟次数</span>
                      <div className="flex gap-1">
                        {[10000, 50000, 100000].map(n => (
                          <button
                            key={n}
                            onClick={() => setSimulations(n)}
                            disabled={isSimulating}
                            className={`px-2 py-1 rounded text-[10px] font-medium
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

          {/* ========== 桌面端右侧：结果区 ========== */}
          <div className="hidden lg:block lg:col-span-2">
            <div className="bg-gray-800/50 rounded-2xl p-6 backdrop-blur-sm border border-gray-700">
              {!hasRange ? (
                <div className="text-center py-12 text-gray-400">
                  <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>请在左侧选择你的 Range</p>
                  <p className="text-xs mt-1 text-gray-500">点击矩阵 cell 或使用快捷预设</p>
                </div>
              ) : isSimulating ? (
                <div className="text-center py-12">
                  <div className="relative w-32 h-32 mx-auto mb-4">
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
                      <span className="text-2xl font-bold text-white">{Math.round(progress)}%</span>
                    </div>
                  </div>
                  <p className="text-gray-400 text-sm mb-2">
                    Range vs Range 模拟 {simulations.toLocaleString()} 次...
                  </p>
                  <p className="text-emerald-400 text-xs mb-3 flex items-center justify-center gap-1">
                    <Zap className="w-3 h-3" /> Web Worker 后台计算
                  </p>
                  {progressDetail && (
                    <div className="flex justify-center gap-6 text-sm mb-3">
                      <span className="text-emerald-400">胜: {progressDetail.wins}</span>
                      <span className="text-yellow-400">平: {progressDetail.ties}</span>
                      <span className="text-red-400">负: {progressDetail.losses}</span>
                    </div>
                  )}
                  <button
                    onClick={cancelSimulation}
                    className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 flex items-center gap-2 mx-auto"
                  >
                    <RotateCcw className="w-4 h-4" /> 取消
                  </button>
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-400" />
                  <p className="text-red-400 mb-4">{error}</p>
                  <button
                    onClick={() => runSimulation(null, communityCards, opponentType, opponentCount, simulations, Array.from(playerRange))}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm hover:bg-emerald-600 flex items-center gap-2 mx-auto"
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

            {/* Equity Chart (桌面端 RvR) */}
            {equityResult?.equityByCombo && Object.keys(equityResult.equityByCombo).length > 0 && (
              <Suspense fallback={<div className="h-40 bg-gray-800/50 rounded-2xl mt-4 animate-pulse" />}>
                <div className="mt-4">
                  <EquityChart equityByCombo={equityResult.equityByCombo} />
                </div>
              </Suspense>
            )}
          </div>
        </div>
      </main>

      {/* ========== Phase 3: 移动端底部悬浮栏 + Drawer ========== */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40">
        <Drawer>
          <DrawerTrigger asChild>
            <button
              className="w-full bg-gray-900/95 backdrop-blur-lg border-t border-gray-700 px-4 py-3 flex items-center justify-between pb-[max(0.75rem,env(safe-area-inset-bottom))]"
              disabled={!hasRange}
            >
              <div className="flex items-center gap-2">
                {hasRange ? (
                  <span className="text-emerald-400 text-xs font-mono">{playerRange.size} combos</span>
                ) : (
                  <span className="text-gray-400 text-xs">请选择 Range</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isSimulating ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-gray-400 text-xs">{Math.round(progress)}%</span>
                  </div>
                ) : equityResult ? (
                  <div className="flex items-center gap-2">
                    <div className="text-center">
                      <div className={`text-base font-bold ${getEquityColor(equityResult.win)}`}>
                        {equityResult.win.toFixed(0)}%
                      </div>
                      <div className="text-gray-600 text-[9px]">胜</div>
                    </div>
                    <div className="text-gray-700">|</div>
                    <div className="text-center">
                      <div className="text-base font-bold text-yellow-400">
                        {equityResult.tie.toFixed(0)}%
                      </div>
                      <div className="text-gray-600 text-[9px]">平</div>
                    </div>
                    <div className="text-gray-700">|</div>
                    <div className="text-center">
                      <div className="text-base font-bold text-red-400">
                        {equityResult.lose.toFixed(0)}%
                      </div>
                      <div className="text-gray-600 text-[9px]">负</div>
                    </div>
                    {evResult && (
                      <>
                        <div className="text-gray-700">|</div>
                        <div className={`text-xs font-bold ${evResult.isPositiveEV ? 'text-emerald-400' : 'text-red-400'}`}>
                          {evResult.totalEV > 0 ? '+' : ''}{evResult.totalEV.toFixed(0)} EV
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <span className="text-gray-500 text-xs">等待计算</span>
                )}
                <ChevronUp className="w-4 h-4 text-gray-400 ml-1" />
              </div>
            </button>
          </DrawerTrigger>

          <DrawerContent className="bg-gray-900/98 backdrop-blur-lg border-t border-gray-700 max-h-[85vh]">
            <DrawerTitle className="sr-only">分析详情</DrawerTitle>
            <div className="overflow-y-auto max-h-[80vh] p-4">
              {isSimulating ? (
                <div className="text-center py-8">
                  <div className="relative w-24 h-24 mx-auto mb-4">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="#374151" strokeWidth="8" />
                      <circle
                        cx="50" cy="50" r="45" fill="none" stroke="url(#progressGradMobile)"
                        strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={`${progress * 2.83} 283`}
                        className="transition-all duration-300"
                      />
                      <defs>
                        <linearGradient id="progressGradMobile" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#10b981" />
                          <stop offset="100%" stopColor="#14b8a6" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-bold text-white">{Math.round(progress)}%</span>
                    </div>
                  </div>
                  <p className="text-gray-400 text-sm mb-2">模拟计算中...</p>
                  <button
                    onClick={cancelSimulation}
                    className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 flex items-center gap-2 mx-auto"
                  >
                    <RotateCcw className="w-4 h-4" /> 取消
                  </button>
                </div>
              ) : equityResult ? (
                <AnalysisTabs
                  equityWin={equityResult.win}
                  equityTie={equityResult.tie}
                  equityLose={equityResult.lose}
                  simulations={equityResult.simulations}
                  rangeString={rangeString}
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
                  compact
                />
              ) : null}
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      {/* 桌面端底部说明 */}
      <footer className="hidden lg:block max-w-7xl mx-auto px-4 py-4 text-center text-gray-500 text-xs space-y-0.5">
        <p className="flex items-center justify-center gap-1">
          <Zap className="w-3 h-3" /> Phase 2 Pro · Outs · Nuts · Blockers · EV + Fold Equity
        </p>
        <p>Range vs Range · Web Worker · 100K sims · Mobile-First</p>
      </footer>
    </div>
  );
}
