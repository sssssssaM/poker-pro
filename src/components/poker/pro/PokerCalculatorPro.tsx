'use client';

import { useState, useCallback, useMemo } from 'react';
import { Drawer, DrawerContent, DrawerTrigger, DrawerTitle } from '@/components/ui/drawer';
import {
  Calculator,
  Users,
  Coins,
  Play,
  ChevronUp,
  TrendingUp,
  BarChart3,
  Target,
  Zap,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { Card, Street, OpponentType, HandCombo, OPPONENT_PROFILES, SUIT_SYMBOLS } from '@/lib/poker/pro-types';
import { RangeMatrix, CommunityCardMatrix } from './HandMatrix';
import { EquityChart } from './EquityChart';
import { useSimulationWorker } from '@/hooks/useSimulationWorker';
import { calculateEV, getHandRankName } from '@/lib/poker/pro-engine';

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

  // Range 变化时自动触发模拟
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

  // 计算 EV
  const evResult = equityResult ? calculateEV(equityResult.win, potSize, betSize) : null;

  // 获取胜率颜色
  const getEquityColor = (equity: number) => {
    if (equity >= 60) return 'text-emerald-400';
    if (equity >= 50) return 'text-lime-400';
    if (equity >= 40) return 'text-yellow-400';
    if (equity >= 30) return 'text-orange-400';
    return 'text-red-400';
  };

  const getEquityGradient = (equity: number) => {
    if (equity >= 60) return 'from-emerald-500 to-green-400';
    if (equity >= 50) return 'from-lime-500 to-emerald-400';
    if (equity >= 40) return 'from-yellow-500 to-lime-400';
    if (equity >= 30) return 'from-orange-500 to-yellow-400';
    return 'from-red-500 to-orange-400';
  };

  const getMaxCards = () => {
    if (street === 'flop') return 3;
    if (street === 'turn') return 4;
    if (street === 'river') return 5;
    return 0;
  };

  // ============================================
  // 结果面板渲染函数（复用于桌面和移动端）
  // ============================================
  const renderResultPanel = (compact = false) => {
    const titleSize = compact ? 'text-lg' : 'text-xl';
    const iconSize = compact ? 'w-5 h-5' : 'w-6 h-6';
    const statSize = compact ? 'text-lg' : 'text-2xl';
    const equitySize = compact ? 'text-3xl' : 'text-5xl';

    return (
      <div className="space-y-4">
        {/* 胜率展示 */}
        <div className="bg-gray-800/50 rounded-2xl p-4 sm:p-6 backdrop-blur-sm border border-gray-700">
          <h2 className={`${titleSize} font-bold text-white mb-4 flex items-center gap-2`}>
            <BarChart3 className={`${iconSize} text-emerald-400`} />
            Range 胜率分析
          </h2>

          {!hasRange ? (
            <div className="text-center py-8 sm:py-12 text-gray-400">
              <Target className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 opacity-50" />
              <p>请在左侧矩阵中选择你的 Range</p>
              <p className="text-xs mt-1 text-gray-500">点击 cell 或使用快捷按钮</p>
            </div>
          ) : isSimulating ? (
            <div className="text-center py-8 sm:py-12">
              <div className="relative w-24 h-24 sm:w-32 sm:h-32 mx-auto mb-4">
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
                  <span className="text-xl sm:text-2xl font-bold text-white">{Math.round(progress)}%</span>
                </div>
              </div>
              <p className="text-gray-400 text-sm mb-2">
                Range vs Range 模拟 {simulations.toLocaleString()} 次...
              </p>
              <p className="text-emerald-400 text-xs mb-3 flex items-center justify-center gap-1">
                <Zap className="w-3 h-3" /> Web Worker 后台计算
              </p>
              {progressDetail && (
                <div className="flex justify-center gap-4 sm:gap-6 text-sm mb-3">
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
            <div className="text-center py-8 sm:py-12">
              <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 text-red-400" />
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={() => runSimulation(null, communityCards, opponentType, opponentCount, simulations, Array.from(playerRange))}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm hover:bg-emerald-600 flex items-center gap-2 mx-auto"
              >
                <RotateCcw className="w-4 h-4" /> 重试
              </button>
            </div>
          ) : equityResult ? (
            <div className="space-y-4 sm:space-y-6">
              {/* Range 信息 */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-gray-400 text-sm mb-1">你的 Range</div>
                  <div className="text-white text-sm font-mono bg-gray-900/50 px-3 py-1.5 rounded-lg max-w-[220px] truncate">
                    {rangeString || '全部'}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`${equitySize} font-bold ${getEquityColor(equityResult.win)}`}>
                    {equityResult.win.toFixed(1)}%
                  </div>
                  <div className="text-gray-400 text-sm">胜率</div>
                </div>
              </div>

              {/* 进度条 */}
              <div className="relative">
                <div className="h-4 sm:h-6 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${getEquityGradient(equityResult.win)} transition-all duration-500`}
                    style={{ width: `${equityResult.win}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0%</span><span>50%</span><span>100%</span>
                </div>
              </div>

              {/* 统计卡片 */}
              <div className="grid grid-cols-4 gap-2 sm:gap-4">
                {[
                  { label: '胜', value: equityResult.win, color: 'text-emerald-400' },
                  { label: '平', value: equityResult.tie, color: 'text-yellow-400' },
                  { label: '负', value: equityResult.lose, color: 'text-red-400' },
                  { label: '模拟', value: equityResult.simulations, color: 'text-blue-400', isInt: true }
                ].map(item => (
                  <div key={item.label} className="bg-gray-900/50 rounded-xl p-2 sm:p-4 text-center">
                    <div className={`${item.color} ${statSize} font-bold`}>
                      {item.isInt ? item.value.toLocaleString() : `${item.value.toFixed(compact ? 0 : 1)}%`}
                    </div>
                    <div className="text-gray-400 text-xs">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Equity Chart (RvR only) */}
        {equityResult?.equityByCombo && Object.keys(equityResult.equityByCombo).length > 0 && (
          <EquityChart equityByCombo={equityResult.equityByCombo} />
        )}

        {/* EV 计算 */}
        {equityResult && evResult && (
          <div className="bg-gray-800/50 rounded-2xl p-4 sm:p-6 backdrop-blur-sm border border-gray-700">
            <h2 className={`${titleSize} font-bold text-white mb-4 flex items-center gap-2`}>
              <Calculator className={`${iconSize} text-blue-400`} />
              EV 计算
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-6 mb-3">
              <div className="bg-gray-900/50 rounded-xl p-3 sm:p-4 text-center">
                <div className="text-gray-400 text-xs">底池赔率</div>
                <div className="text-white text-lg sm:text-xl font-bold">{evResult.potOdds}%</div>
              </div>
              <div className="bg-gray-900/50 rounded-xl p-3 sm:p-4 text-center">
                <div className="text-gray-400 text-xs">盈亏平衡</div>
                <div className="text-white text-lg sm:text-xl font-bold">{evResult.breakEven}%</div>
              </div>
            </div>
            <div className={`rounded-xl p-3 sm:p-4 text-center ${evResult.isPositiveEV ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
              <div className={`text-2xl sm:text-4xl font-bold ${evResult.isPositiveEV ? 'text-emerald-400' : 'text-red-400'}`}>
                {evResult.ev > 0 ? '+' : ''}{evResult.ev.toFixed(2)}
              </div>
              <div className="text-gray-300 mt-1 flex items-center justify-center gap-1 text-sm">
                {evResult.isPositiveEV ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {evResult.isPositiveEV ? '正期望值 (+EV)' : '负期望值 (-EV)'}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 pb-20 lg:pb-0">
      {/* 顶部标题栏 */}
      <header className="bg-gray-900/80 border-b border-gray-700 sticky top-0 z-50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                <Calculator className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg lg:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
                  德州扑克计算器 Pro
                </h1>
                <p className="text-gray-400 text-xs hidden sm:block">
                  Range vs Range · Web Worker · Equity 分布
                </p>
              </div>
            </div>

            {/* 桌面端快捷设置 */}
            <div className="hidden lg:flex items-center gap-4">
              <div className="flex items-center gap-2">
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
              <div className="flex items-center gap-2">
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

      <main className="max-w-7xl mx-auto px-4 py-4 lg:py-6">
        <div className="grid lg:grid-cols-3 gap-4 lg:gap-6">
          {/* 左侧：输入区 */}
          <div className="lg:col-span-1 space-y-4">
            {/* Range 选择器 */}
            <RangeMatrix
              onRangeChange={handleRangeChange}
              selectedRange={playerRange}
              disabledCards={communityCards}
            />

            {/* 街道步进器 */}
            <div className="bg-gray-800/50 rounded-2xl p-4 backdrop-blur-sm border border-gray-700">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Play className="w-5 h-5 text-emerald-400" />
                游戏阶段
              </h3>
              <div className="flex gap-2">
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
                      flex-1 py-2 px-2 rounded-xl text-center transition-all
                      ${street === s.id
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg'
                        : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                      }
                      disabled:opacity-50 min-h-[44px]
                    `}
                  >
                    <div className="text-xs font-medium lg:text-sm">{s.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 公共牌选择 */}
            {street !== 'preflop' && (
              <CommunityCardMatrix
                onCardSelect={handleCommunityCardSelect}
                onCardRemove={handleCommunityCardRemove}
                communityCards={communityCards}
                disabledCards={[]}
                maxCards={getMaxCards()}
              />
            )}

            {/* 对手类型 */}
            <div className="bg-gray-800/50 rounded-2xl p-4 backdrop-blur-sm border border-gray-700">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" />
                对手模型
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {(['random', 'tight', 'loose', 'passive', 'nit', 'custom'] as OpponentType[]).map(type => {
                  const profile = OPPONENT_PROFILES[type];
                  const isActive = opponentType === type;
                  return (
                    <button
                      key={type}
                      onClick={() => handleOpponentTypeChange(type)}
                      disabled={isSimulating}
                      className={`
                        py-2 px-2 rounded-lg text-center transition-all text-xs font-medium min-h-[44px]
                        ${isActive
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }
                        disabled:opacity-50
                      `}
                    >
                      {profile.name}
                    </button>
                  );
                })}
              </div>

              {/* 移动端对手数量 */}
              <div className="lg:hidden mt-3 pt-3 border-t border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">对手数量</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        onClick={() => handleOpponentCountChange(n)}
                        disabled={isSimulating}
                        className={`
                          w-8 h-8 rounded-lg text-sm font-medium transition-all
                          ${opponentCount === n
                            ? 'bg-emerald-500 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }
                          disabled:opacity-50
                        `}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 筹码设置 */}
            <div className="bg-gray-800/50 rounded-2xl p-4 backdrop-blur-sm border border-gray-700">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Coins className="w-5 h-5 text-yellow-400" />
                筹码与赔率
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: '底池', value: potSize, setter: setPotSize },
                  { label: '下注', value: betSize, setter: setBetSize },
                  { label: '筹码', value: stackSize, setter: setStackSize }
                ].map(item => (
                  <div key={item.label}>
                    <label className="text-gray-400 text-xs">{item.label}</label>
                    <input
                      type="number"
                      value={item.value}
                      onChange={(e) => item.setter(Number(e.target.value))}
                      className="w-full bg-gray-700 text-white rounded-lg px-2 py-2 text-sm mt-1 min-h-[44px] text-base"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 桌面端右侧：结果区 */}
          <div className="hidden lg:block lg:col-span-2">
            {renderResultPanel(false)}
          </div>
        </div>
      </main>

      {/* 移动端底部悬浮栏 + Drawer */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40">
        <Drawer>
          <DrawerTrigger asChild>
            <button
              className="w-full bg-gray-900/95 backdrop-blur-lg border-t border-gray-700 px-4 py-3 flex items-center justify-between pb-[max(1rem,env(safe-area-inset-bottom))]"
              disabled={!hasRange}
            >
              <div className="flex items-center gap-3">
                {hasRange ? (
                  <span className="text-emerald-400 text-sm font-mono">{playerRange.size} combos</span>
                ) : (
                  <span className="text-gray-400 text-sm">请选择 Range</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isSimulating ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-gray-400 text-sm">{Math.round(progress)}%</span>
                  </div>
                ) : equityResult ? (
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <div className={`text-lg font-bold ${getEquityColor(equityResult.win)}`}>
                        {equityResult.win.toFixed(0)}%
                      </div>
                      <div className="text-gray-500 text-xs">胜</div>
                    </div>
                    <div className="text-gray-600">|</div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-yellow-400">
                        {equityResult.tie.toFixed(0)}%
                      </div>
                      <div className="text-gray-500 text-xs">平</div>
                    </div>
                    <div className="text-gray-600">|</div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-red-400">
                        {equityResult.lose.toFixed(0)}%
                      </div>
                      <div className="text-gray-500 text-xs">负</div>
                    </div>
                  </div>
                ) : (
                  <span className="text-gray-500 text-sm">等待计算</span>
                )}
                <ChevronUp className="w-5 h-5 text-gray-400 ml-2" />
              </div>
            </button>
          </DrawerTrigger>

          <DrawerContent className="bg-gray-900/98 backdrop-blur-lg border-t border-gray-700 max-h-[85vh]">
            <DrawerTitle className="sr-only">分析详情</DrawerTitle>
            <div className="overflow-y-auto max-h-[80vh] p-4">
              {renderResultPanel(true)}
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      {/* 桌面端底部说明 */}
      <footer className="hidden lg:block max-w-7xl mx-auto px-4 py-6 text-center text-gray-500 text-xs space-y-1">
        <p className="flex items-center justify-center gap-1">
          <Zap className="w-3 h-3" /> Range vs Range · Web Worker 后台计算 · UI 永不阻塞
        </p>
        <p>对手范围精确筛选 | Equity 分布直方图 | 支持 1326 combo 枚举</p>
      </footer>
    </div>
  );
}
