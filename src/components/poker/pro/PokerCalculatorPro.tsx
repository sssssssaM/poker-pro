'use client';

import { useState, useCallback, useMemo, useEffect, lazy, Suspense } from 'react';
import { Drawer } from 'vaul';
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
  SlidersHorizontal,
  X,
  TrendingUp
} from 'lucide-react';
import { Card, Street, OpponentType, HandCombo } from '@/lib/poker/pro-types';
import { parseRangeString } from '@/lib/poker/range-parser';
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

// ============================================
// Range Presets
// ============================================
const RANGE_PRESETS = [
  { key: 'top5', label: 'Top 5%', combos: ['AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AQs', 'AKo'] },
  { key: 'top10', label: 'Top 10%', combos: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', 'AKs', 'AQs', 'AJs', 'ATs', 'AKo', 'AQo', 'KQs'] },
  { key: 'top20', label: 'Top 20%', combos: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', 'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A5s', 'A4s', 'KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs', 'AKo', 'AQo', 'AJo', 'ATo', 'KQo', 'KJo'] },
  { key: 'pairs', label: '对子', combos: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22'] },
];

const OPPONENT_PILLS: { type: OpponentType; label: string; emoji: string }[] = [
  { type: 'random', label: '随机', emoji: '🎲' },
  { type: 'tight', label: 'TAG', emoji: '🎯' },
  { type: 'loose', label: 'LAG', emoji: '🔥' },
  { type: 'passive', label: '松被动', emoji: '🐢' },
  { type: 'nit', label: 'Nit', emoji: '🔒' },
  { type: 'custom', label: '自定义', emoji: '⚙️' },
];

const STREETS = [
  { id: 'preflop' as Street, label: '翻前' },
  { id: 'flop' as Street, label: '翻牌' },
  { id: 'turn' as Street, label: '转牌' },
  { id: 'river' as Street, label: '河牌' },
];

const RANK_TO_IDX: Record<Card['rank'], number> = {
  '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6,
  '9': 7, 'T': 8, 'J': 9, 'Q': 10, 'K': 11, 'A': 12
};

const SUIT_TO_IDX: Record<Card['suit'], number> = { 's': 0, 'h': 1, 'd': 2, 'c': 3 };

const cardToIdx = (card: Card) => RANK_TO_IDX[card.rank] * 4 + SUIT_TO_IDX[card.suit];

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
  const [villainRange, setVillainRange] = useState<Set<HandCombo>>(new Set());
  const [villainRangeStr, setVillainRangeStr] = useState('');
  const [activeEditor, setActiveEditor] = useState<'hero' | 'villain'>('hero');

  // ====== 筹码设置 ======
  const [potSize, setPotSize] = useState(100);
  const [betSize, setBetSize] = useState(50);
  const [stackSize, setStackSize] = useState(1000);

  // ====== 模拟次数 ======
  const [simulations, setSimulations] = useState(100000);

  // ====== UI 状态 ======
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  // 解析自定义 villain range (from Set)
  const getVillainRangeArray = useCallback(() => {
    if (opponentType !== 'custom' || villainRange.size === 0) return undefined;
    return Array.from(villainRange);
  }, [opponentType, villainRange]);

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

  const canRunAdvancedAnalysis = hasRange && communityCards.length >= 3;

  // ====== Phase 2: 延迟加载分析计算 ======
  useEffect(() => {
    if (!canRunAdvancedAnalysis) return;

    // 取 range 中第一个 combo 作为代表手牌
    const combos = Array.from(playerRange);
    const firstCombo = combos[0];
    if (!firstCombo) return;

    // 解析代表手牌为 [CardIndex, CardIndex]
    const r1 = RANK_TO_IDX[firstCombo[0]];
    const r2 = RANK_TO_IDX[firstCombo[1]];
    if (r1 === undefined || r2 === undefined) return;

    let heroCards: [number, number];
    if (firstCombo.length === 2 && firstCombo[0] === firstCombo[1]) {
      // Pocket pair: 取 spade + heart
      heroCards = [r1 * 4 + 0, r1 * 4 + 1];
    } else if (firstCombo[2] === 's') {
      // Suited: 两张同花 spade
      heroCards = [r1 * 4 + 0, r2 * 4 + 0];
    } else {
      // Offsuit: spade + heart
      heroCards = [r1 * 4 + 0, r2 * 4 + 1];
    }

    // 确保 hero 不与 board 冲突
    const boardIdx = communityCards.map(cardToIdx);
    const boardSet = new Set(boardIdx);
    if (boardSet.has(heroCards[0]) || boardSet.has(heroCards[1])) return;

    let cancelled = false;

    // Outs (flop/turn only, river 没有 outs)
    if (communityCards.length <= 4) {
      loadOutsDetector().then(m => {
        if (cancelled) return;
        try {
          setOutsResult(m.detectOuts(heroCards, boardIdx));
        } catch { setOutsResult(null); }
      });
    }

    // Nuts
    loadNutDetector().then(m => {
      if (cancelled) return;
      try {
        setNutResult(m.detectNuts(heroCards, boardIdx));
      } catch { setNutResult(null); }
    });

    // Blockers
    loadBlockerAnalysis().then(m => {
      if (cancelled) return;
      try {
        setBlockerResult(m.analyzeBlockers(heroCards, combos, boardIdx));
      } catch { setBlockerResult(null); }
    });

    // Street Equity
    loadStreetEquity().then(m => {
      if (cancelled) return;
      try {
        setStreetEquity(m.calculateStreetEquityShift(heroCards, null, boardIdx, 10000));
      } catch { setStreetEquity(null); }
    });

    return () => { cancelled = true; };
  }, [canRunAdvancedAnalysis, communityCards, playerRange]);

  // Hero Range 变化时触发模拟
  const handleRangeChange = useCallback((combos: Set<HandCombo>, str: string) => {
    setPlayerRange(combos);
    setRangeString(str);
    if (combos.size > 0) {
      const vr = getVillainRangeArray();
      setTimeout(() => {
        runSimulation(null, communityCards, opponentType, opponentCount, simulations, Array.from(combos), vr);
      }, 50);
    }
  }, [communityCards, opponentType, opponentCount, simulations, runSimulation, getVillainRangeArray]);

  // Villain Range 变化时触发模拟
  const handleVillainRangeChange = useCallback((combos: Set<HandCombo>, str: string) => {
    setVillainRange(combos);
    setVillainRangeStr(str);
    setOpponentType('custom');
    if (hasRange) {
      const vr = combos.size > 0 ? Array.from(combos) : undefined;
      setTimeout(() => {
        runSimulation(null, communityCards, 'custom', opponentCount, simulations, Array.from(playerRange), vr);
      }, 50);
    }
  }, [communityCards, hasRange, playerRange, opponentCount, simulations, runSimulation]);

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
        const vr = getVillainRangeArray();
        setTimeout(() => {
          runSimulation(null, newCards, opponentType, opponentCount, simulations, Array.from(playerRange), vr);
        }, 50);
      }
      return newCards;
    });
  }, [hasRange, playerRange, opponentType, opponentCount, simulations, runSimulation, updateStreetByCardCount, getVillainRangeArray]);

  const handleCommunityCardRemove = useCallback((index: number) => {
    setCommunityCards(prev => {
      const newCards = prev.filter((_, i) => i !== index);
      updateStreetByCardCount(newCards.length);
      if (hasRange) {
        const vr = getVillainRangeArray();
        setTimeout(() => {
          runSimulation(null, newCards, opponentType, opponentCount, simulations, Array.from(playerRange), vr);
        }, 50);
      }
      return newCards;
    });
  }, [hasRange, playerRange, opponentType, opponentCount, simulations, runSimulation, updateStreetByCardCount, getVillainRangeArray]);

  const handleOpponentTypeChange = useCallback((type: OpponentType) => {
    setOpponentType(type);
    if (hasRange) {
      const vr = type === 'custom' && villainRange.size > 0
        ? Array.from(villainRange) : undefined;
      runSimulation(null, communityCards, type, opponentCount, simulations, Array.from(playerRange), vr);
    }
  }, [hasRange, playerRange, communityCards, opponentCount, simulations, runSimulation, villainRange]);

  const handleOpponentCountChange = useCallback((count: number) => {
    setOpponentCount(count);
    if (hasRange) {
      const vr = getVillainRangeArray();
      runSimulation(null, communityCards, opponentType, count, simulations, Array.from(playerRange), vr);
    }
  }, [hasRange, playerRange, communityCards, opponentType, simulations, runSimulation, getVillainRangeArray]);

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
  // Shared Analysis Component
  // ============================================
  const renderAnalysis = () => {
    if (!hasRange) return (
      <div className="text-center py-10 text-gray-400">
        <Target className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">选择 Range 开始分析</p>
      </div>
    );
    if (isSimulating) return (
      <div className="text-center py-6">
        <div className="relative w-20 h-20 mx-auto mb-3">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#1f2937" strokeWidth="6" />
            <circle cx="50" cy="50" r="45" fill="none" stroke="#10b981"
              strokeWidth="6" strokeLinecap="round"
              strokeDasharray={`${progress * 2.83} 283`}
              className="transition-all duration-300"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-white">{Math.round(progress)}%</span>
          </div>
        </div>
        {progressDetail && (
          <div className="flex justify-center gap-3 text-xs mb-2">
            <span className="text-emerald-400">胜 {progressDetail.wins}</span>
            <span className="text-yellow-400">平 {progressDetail.ties}</span>
            <span className="text-red-400">负 {progressDetail.losses}</span>
          </div>
        )}
        <button onClick={cancelSimulation}
          className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs hover:bg-red-500/30 mx-auto flex items-center gap-1">
          <RotateCcw className="w-3 h-3" /> 取消
        </button>
      </div>
    );
    if (error) return (
      <div className="text-center py-8">
        <AlertCircle className="w-10 h-10 mx-auto mb-2 text-red-400" />
        <p className="text-red-400 text-sm mb-3">{error}</p>
        <button onClick={() => runSimulation(null, communityCards, opponentType, opponentCount, simulations, Array.from(playerRange), getVillainRangeArray())}
          className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs mx-auto flex items-center gap-1">
          <RotateCcw className="w-3 h-3" /> 重试
        </button>
      </div>
    );
    if (equityResult) return (
      <>
        <AnalysisTabs
          equityWin={equityResult.win}
          equityTie={equityResult.tie}
          equityLose={equityResult.lose}
          simulations={equityResult.simulations}
          rangeString={rangeString}
          equityByCombo={equityResult.equityByCombo}
          equityHistogram={equityResult.equityHistogram}
          outsResult={canRunAdvancedAnalysis && communityCards.length <= 4 ? outsResult : null}
          potOddsResult={potOddsResult}
          evResult={evResult}
          blockerResult={canRunAdvancedAnalysis ? blockerResult : null}
          streetEquity={canRunAdvancedAnalysis ? streetEquity : null}
          nutResult={canRunAdvancedAnalysis ? nutResult : null}
          foldEquity={foldEquity}
          onFoldEquityChange={setFoldEquity}
          potSize={potSize}
          betSize={betSize}
        />
        {equityResult.equityByCombo && Object.keys(equityResult.equityByCombo).length > 0 && (
          <Suspense fallback={<div className="h-32 bg-gray-800/30 rounded-xl mt-3 animate-pulse" />}>
            <div className="mt-3">
              <EquityChart equityByCombo={equityResult.equityByCombo} />
            </div>
          </Suspense>
        )}
      </>
    );
    return null;
  };

  // ============================================
  // 渲染
  // ============================================
  return (
    <div className="min-h-screen bg-gray-950 lg:bg-gradient-to-br lg:from-gray-900 lg:via-gray-800 lg:to-gray-900">

      {/* ====== STICKY HEADER: Logo + Street + Board ====== */}
      <header className="sticky top-0 z-50 bg-gray-950/95 backdrop-blur-md border-b border-white/5">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center">
              <Calculator className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-white">
              Poker Pro
            </span>
            {hasRange && (
              <span className="text-emerald-400 text-[10px] font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded">
                {playerRange.size}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Settings trigger */}
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 text-gray-400 hover:text-white transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            {/* Desktop sim/opponent selectors */}
            <div className="hidden lg:flex items-center gap-2">
              <select value={simulations} onChange={(e) => setSimulations(Number(e.target.value))}
                disabled={isSimulating} className="bg-white/5 text-white text-xs rounded-lg px-2 py-1.5 border-0 h-8">
                <option value={10000}>10K</option>
                <option value={50000}>50K</option>
                <option value={100000}>100K</option>
                <option value={200000}>200K</option>
              </select>
              <select value={opponentCount} onChange={(e) => handleOpponentCountChange(Number(e.target.value))}
                disabled={isSimulating} className="bg-white/5 text-white text-xs rounded-lg px-2 py-1.5 border-0 h-8">
                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}人</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Street selector (compact pill bar) */}
        <div className="flex px-3 pb-2 gap-1 lg:hidden">
          {STREETS.map(s => (
            <button key={s.id} onClick={() => handleStreetChange(s.id)} disabled={isSimulating}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all
                ${street === s.id
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white/5 text-gray-500 active:bg-white/10'
                } disabled:opacity-40`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Community cards (only when not preflop) */}
        {street !== 'preflop' && (
          <div className="px-3 pb-2">
            <CommunityCardMatrix
              onCardSelect={handleCommunityCardSelect}
              onCardRemove={handleCommunityCardRemove}
              communityCards={communityCards}
              disabledCards={[]}
              maxCards={getMaxCards()}
            />
          </div>
        )}
      </header>

      {/* ====== SETTINGS OVERLAY (mobile: slide-down, replaces modal) ====== */}
      {settingsOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSettingsOpen(false)} />
          <div className="absolute top-0 left-0 right-0 bg-gray-900 border-b border-white/10 rounded-b-2xl p-4 pt-3 animate-in slide-in-from-top duration-200 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white text-sm font-semibold">设置</h3>
              <button onClick={() => setSettingsOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Opponent type */}
            <div className="mb-3">
              <label className="text-gray-500 text-[10px] uppercase tracking-wider mb-1.5 block">对手类型</label>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                {OPPONENT_PILLS.map(pill => (
                  <button key={pill.type} onClick={() => handleOpponentTypeChange(pill.type)} disabled={isSimulating}
                    className={`flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap
                      ${opponentType === pill.type
                        ? 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/30'
                        : 'bg-white/5 text-gray-400'
                      } disabled:opacity-40`}
                  >
                    <span>{pill.emoji}</span>{pill.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Opponent count + simulations */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-gray-500 text-[10px] uppercase tracking-wider mb-1.5 block">对手数</label>
                <div className="flex gap-1">
                  {[1, 2, 3].map(n => (
                    <button key={n} onClick={() => handleOpponentCountChange(n)} disabled={isSimulating}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all
                        ${opponentCount === n ? 'bg-emerald-500 text-white' : 'bg-white/5 text-gray-400'}
                        disabled:opacity-40`}
                    >{n}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-gray-500 text-[10px] uppercase tracking-wider mb-1.5 block">模拟次数</label>
                <div className="flex gap-1">
                  {[10000, 50000, 100000].map(n => (
                    <button key={n} onClick={() => setSimulations(n)} disabled={isSimulating}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-medium transition-all
                        ${simulations === n ? 'bg-emerald-500 text-white' : 'bg-white/5 text-gray-400'}
                        disabled:opacity-40`}
                    >{n >= 1000 ? `${n / 1000}K` : n}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chips */}
            <div>
              <label className="text-gray-500 text-[10px] uppercase tracking-wider mb-1.5 block">筹码</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: '底池', value: potSize, setter: setPotSize },
                  { label: '下注', value: betSize, setter: setBetSize },
                  { label: '筹码', value: stackSize, setter: setStackSize },
                ].map(item => (
                  <div key={item.label}>
                    <label className="text-gray-500 text-[10px]">{item.label}</label>
                    <input type="number" inputMode="numeric" value={item.value}
                      onChange={(e) => item.setter(Number(e.target.value))}
                      className="w-full bg-white/5 text-white rounded-lg px-2 py-2 text-sm mt-0.5 border-0 focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====== MAIN CONTENT ====== */}
      <main className="max-w-7xl mx-auto lg:px-6 lg:py-6 pb-24 lg:pb-12">
        <div className="lg:grid lg:grid-cols-3 lg:gap-6">

          {/* ======= LEFT: Range Matrix (Mobile: full-width king) ======= */}
          <div className="lg:col-span-1 space-y-0 lg:space-y-4">

            {/* Range presets */}
            <div className="flex gap-1.5 px-3 py-2 overflow-x-auto no-scrollbar lg:px-0">
              {RANGE_PRESETS.map(preset => (
                <button key={preset.key}
                  onClick={() => {
                    const combos = new Set<HandCombo>(preset.combos);
                    handleRangeChange(combos, preset.combos.join(', '));
                  }}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-gray-400 hover:bg-emerald-500/20 hover:text-emerald-400 active:scale-95 transition-all whitespace-nowrap"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* 🎮 Hero/Villain 编辑器切换标签 */}
            <div className="flex gap-1 px-2 pb-1 lg:px-0">
              <button
                onClick={() => setActiveEditor('hero')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all
                  ${activeEditor === 'hero'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
              >
                🦸‍♂️ 我的 Range
                {playerRange.size > 0 && (
                  <span className="text-[10px] opacity-70">{playerRange.size}</span>
                )}
              </button>
              <button
                onClick={() => { setActiveEditor('villain'); setOpponentType('custom'); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all
                  ${activeEditor === 'villain'
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/20'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
              >
                🦹 对手 Range
                {villainRange.size > 0 && (
                  <span className="text-[10px] opacity-70">{villainRange.size}</span>
                )}
              </button>
            </div>

            {/* THE MATRIX — always visible on mobile */}
            <div className="px-2 pb-2 lg:px-0">
              <RangeMatrix
                onRangeChange={activeEditor === 'hero' ? handleRangeChange : handleVillainRangeChange}
                selectedRange={activeEditor === 'hero' ? playerRange : villainRange}
                disabledCards={communityCards}
                colorTheme={activeEditor === 'hero' ? 'emerald' : 'purple'}
              />
            </div>

            {/* Desktop: Street selector + community cards + opponents */}
            <div className="hidden lg:block space-y-4">
              {/* Street */}
              <div className="bg-gray-800/40 rounded-2xl p-3">
                <div className="flex gap-1.5 mb-2">
                  {STREETS.map(s => (
                    <button key={s.id} onClick={() => handleStreetChange(s.id)} disabled={isSimulating}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all
                        ${street === s.id
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg'
                          : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                        } disabled:opacity-50`}
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

              {/* Opponents (desktop) */}
              <div className="bg-gray-800/40 rounded-2xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-white text-sm font-semibold flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-purple-400" /> 对手
                  </h3>
                  <div className="flex gap-1">
                    {[1, 2, 3].map(n => (
                      <button key={n} onClick={() => handleOpponentCountChange(n)} disabled={isSimulating}
                        className={`w-7 h-7 rounded-lg text-xs font-medium transition-all
                          ${opponentCount === n ? 'bg-emerald-500 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}
                          disabled:opacity-50`}
                      >{n}</button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {OPPONENT_PILLS.map(pill => (
                    <button key={pill.type} onClick={() => handleOpponentTypeChange(pill.type)} disabled={isSimulating}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-all
                        ${opponentType === pill.type
                          ? 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/30'
                          : 'bg-gray-700/60 text-gray-300 hover:bg-gray-600/60'
                        } disabled:opacity-50`}
                    >
                      <span>{pill.emoji}</span>{pill.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chips (desktop) */}
              <div className="bg-gray-800/40 rounded-2xl p-3">
                <h3 className="text-white text-sm font-semibold flex items-center gap-1.5 mb-2">
                  <SlidersHorizontal className="w-4 h-4 text-yellow-400" /> 筹码
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '底池', value: potSize, setter: setPotSize },
                    { label: '下注', value: betSize, setter: setBetSize },
                    { label: '筹码', value: stackSize, setter: setStackSize },
                  ].map(item => (
                    <div key={item.label}>
                      <label className="text-gray-400 text-[10px]">{item.label}</label>
                      <input type="number" value={item.value}
                        onChange={(e) => item.setter(Number(e.target.value))}
                        className="w-full bg-gray-700 text-white rounded-lg px-2 py-2 text-sm mt-0.5"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ======= RIGHT: Results (Desktop only — inline) ======= */}
          <div className="hidden lg:block lg:col-span-2">
            <div className="bg-gray-800/40 rounded-2xl p-6 h-[calc(100vh-100px)] overflow-y-auto custom-scrollbar">
              {renderAnalysis()}
            </div>
          </div>
        </div>
      </main>

      {/* ====== MOBILE BOTTOM DRAWER (vaul) ====== */}
      <div className="lg:hidden">
        <Drawer.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
          {/* Floating trigger bar — always visible at bottom */}
          <Drawer.Trigger asChild>
            <button className="fixed bottom-0 left-0 right-0 z-40 bg-gray-900/95 backdrop-blur-md border-t border-white/10 px-4 py-3 flex items-center justify-between active:bg-gray-800/90 transition-colors safe-area-bottom">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                {equityResult ? (
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400 text-sm font-bold">{equityResult.win.toFixed(1)}%</span>
                    <span className="text-gray-600 text-xs">|</span>
                    <span className="text-yellow-400/80 text-xs">{equityResult.tie.toFixed(1)}%</span>
                    <span className="text-gray-600 text-xs">|</span>
                    <span className="text-red-400/80 text-xs">{equityResult.lose.toFixed(1)}%</span>
                  </div>
                ) : isSimulating ? (
                  <span className="text-gray-400 text-xs">模拟中 {Math.round(progress)}%...</span>
                ) : (
                  <span className="text-gray-500 text-xs">查看分析结果</span>
                )}
              </div>
              <ChevronUp className="w-4 h-4 text-gray-500" />
            </button>
          </Drawer.Trigger>

          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 bg-black/60 z-[70]" />
            <Drawer.Content className="fixed bottom-0 left-0 right-0 z-[80] bg-gray-950 rounded-t-2xl max-h-[85vh] outline-none">
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-white/20 rounded-full" />
              </div>

              {/* Drawer header */}
              <div className="flex items-center justify-between px-4 pb-2 border-b border-white/5">
                <Drawer.Title className="text-white text-sm font-semibold">分析结果</Drawer.Title>
                {equityResult && (
                  <span className="text-emerald-400 text-lg font-bold">{equityResult.win.toFixed(1)}%</span>
                )}
              </div>

              {/* Drawer body — scrollable */}
              <div className="overflow-y-auto px-4 pt-3 pb-8" style={{ maxHeight: 'calc(85vh - 80px)' }}>
                {renderAnalysis()}
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      </div>

      {/* Bottom safe area spacer for mobile (so content isn't hidden behind trigger bar) */}
      <div className="h-16 lg:hidden" />
    </div>
  );
}
