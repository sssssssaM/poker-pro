'use client';

import { useState, useCallback } from 'react';
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
import { HandMatrix, CommunityCardMatrix } from './HandMatrix';
import { useSimulationWorker } from '@/hooks/useSimulationWorker';
import { calculateEV, getHandRankName } from '@/lib/poker/pro-engine';

export function PokerCalculatorPro() {
  // 游戏状态
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [playerCombo, setPlayerCombo] = useState<HandCombo>('');
  const [communityCards, setCommunityCards] = useState<Card[]>([]);
  const [street, setStreet] = useState<Street>('preflop');
  
  // 对手设置
  const [opponentCount, setOpponentCount] = useState(1);
  const [opponentType, setOpponentType] = useState<OpponentType>('random');
  
  // 筹码设置
  const [potSize, setPotSize] = useState(100);
  const [betSize, setBetSize] = useState(50);
  const [stackSize, setStackSize] = useState(1000);
  
  // 模拟次数
  const [simulations, setSimulations] = useState(100000);

  // 使用 Web Worker Hook (保持不变)
  const { 
    equityResult, 
    isSimulating, 
    progress, 
    error, 
    runSimulation, 
    cancelSimulation,
    progressDetail
  } = useSimulationWorker();

  // 更新街道（根据公共牌数量）
  const updateStreetByCardCount = useCallback((cardCount: number) => {
    if (cardCount === 0) setStreet('preflop');
    else if (cardCount <= 3) setStreet('flop');
    else if (cardCount === 4) setStreet('turn');
    else setStreet('river');
  }, []);

  // 处理手牌选择
  const handleHandSelect = useCallback((cards: Card[], combo: HandCombo) => {
    setPlayerHand(cards);
    setPlayerCombo(combo);
    
    if (cards.length === 2) {
      // 使用 setTimeout 延迟调用，避免在渲染周期内触发状态更新冲突
      setTimeout(() => {
        runSimulation(cards, communityCards, opponentType, opponentCount, simulations);
      }, 50);
    }
  }, [communityCards, opponentType, opponentCount, simulations, runSimulation]);

  // 处理公共牌选择
  const handleCommunityCardSelect = useCallback((card: Card) => {
    setCommunityCards(prev => {
      const newCards = [...prev, card];
      updateStreetByCardCount(newCards.length);
      
      if (playerHand.length === 2) {
        setTimeout(() => {
          runSimulation(playerHand, newCards, opponentType, opponentCount, simulations);
        }, 50);
      }
      
      return newCards;
    });
  }, [playerHand, opponentType, opponentCount, simulations, runSimulation, updateStreetByCardCount]);

  // 处理公共牌移除
  const handleCommunityCardRemove = useCallback((index: number) => {
    setCommunityCards(prev => {
      const newCards = prev.filter((_, i) => i !== index);
      updateStreetByCardCount(newCards.length);
      
      if (playerHand.length === 2) {
        setTimeout(() => {
          runSimulation(playerHand, newCards, opponentType, opponentCount, simulations);
        }, 50);
      }
      
      return newCards;
    });
  }, [playerHand, opponentType, opponentCount, simulations, runSimulation, updateStreetByCardCount]);

  // 对手类型变化
  const handleOpponentTypeChange = useCallback((type: OpponentType) => {
    setOpponentType(type);
    if (playerHand.length === 2) {
      runSimulation(playerHand, communityCards, type, opponentCount, simulations);
    }
  }, [playerHand, communityCards, opponentCount, simulations, runSimulation]);

  // 对手数量变化
  const handleOpponentCountChange = useCallback((count: number) => {
    setOpponentCount(count);
    if (playerHand.length === 2) {
      runSimulation(playerHand, communityCards, opponentType, count, simulations);
    }
  }, [playerHand, communityCards, opponentType, simulations, runSimulation]);

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

  // 获取进度条颜色
  const getEquityGradient = (equity: number) => {
    if (equity >= 60) return 'from-emerald-500 to-green-400';
    if (equity >= 50) return 'from-lime-500 to-emerald-400';
    if (equity >= 40) return 'from-yellow-500 to-lime-400';
    if (equity >= 30) return 'from-orange-500 to-yellow-400';
    return 'from-red-500 to-orange-400';
  };

  // 最大公共牌数
  const getMaxCards = () => {
    if (street === 'flop') return 3;
    if (street === 'turn') return 4;
    if (street === 'river') return 5;
    return 0;
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
                  Web Worker · 精确 Outs · 对手模型
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
          {/* 左侧/主内容区：输入区 */}
          <div className="lg:col-span-1 space-y-4">
            {/* 手牌矩阵 */}
            <HandMatrix
              onHandSelect={handleHandSelect}
              selectedCards={playerHand}
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
                  { id: 'preflop', label: '翻前', shortLabel: '前' },
                  { id: 'flop', label: '翻牌', shortLabel: '翻' },
                  { id: 'turn', label: '转牌', shortLabel: '转' },
                  { id: 'river', label: '河牌', shortLabel: '河' }
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
                disabledCards={playerHand}
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
              
              {/* 移动端对手数量选择 */}
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
          <div className="hidden lg:block lg:col-span-2 space-y-4">
            {/* 胜率展示 */}
            <div className="bg-gray-800/50 rounded-2xl p-6 backdrop-blur-sm border border-gray-700">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-emerald-400" />
                胜率分析
              </h2>

              {playerHand.length !== 2 ? (
                <div className="text-center py-12 text-gray-400">
                  <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>请在左侧矩阵中选择你的手牌</p>
                </div>
              ) : isSimulating ? (
                <div className="text-center py-12">
                  <div className="relative w-32 h-32 mx-auto mb-4">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="#374151" strokeWidth="8" />
                      <circle
                        cx="50" cy="50" r="45" fill="none" stroke="url(#progressGradient)"
                        strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={`${progress * 2.83} 283`}
                        className="transition-all duration-300"
                      />
                      <defs>
                        <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#10b981" />
                          <stop offset="100%" stopColor="#14b8a6" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">{Math.round(progress)}%</span>
                    </div>
                  </div>
                  
                  <p className="text-gray-400 mb-2">
                    正在后台线程运行 {simulations.toLocaleString()} 次模拟...
                  </p>
                  <p className="text-emerald-400 text-sm mb-4 flex items-center justify-center gap-1">
                    <Zap className="w-4 h-4" /> UI 完全不卡顿
                  </p>
                  
                  {progressDetail && (
                    <div className="flex justify-center gap-6 text-sm mb-4">
                      <span className="text-emerald-400">胜: {progressDetail.wins}</span>
                      <span className="text-yellow-400">平: {progressDetail.ties}</span>
                      <span className="text-red-400">负: {progressDetail.losses}</span>
                    </div>
                  )}
                  
                  <button
                    onClick={cancelSimulation}
                    className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 flex items-center gap-2 mx-auto"
                  >
                    <RotateCcw className="w-4 h-4" /> 取消计算
                  </button>
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-400" />
                  <p className="text-red-400 mb-4">{error}</p>
                  <button
                    onClick={() => runSimulation(playerHand, communityCards, opponentType, opponentCount, simulations)}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm hover:bg-emerald-600 flex items-center gap-2 mx-auto"
                  >
                    <RotateCcw className="w-4 h-4" /> 重试
                  </button>
                </div>
              ) : equityResult ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-gray-400 text-sm mb-1">你的手牌</div>
                      <div className="flex items-center gap-2">
                        {playerHand.map((card, i) => (
                          <span 
                            key={i}
                            className={`
                              text-2xl font-bold px-3 py-2 rounded-lg
                              ${card.suit === 'h' || card.suit === 'd' ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-white'}
                            `}
                          >
                            {card.rank}{SUIT_SYMBOLS[card.suit]}
                          </span>
                        ))}
                        <span className="text-gray-400 text-lg">({playerCombo})</span>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className={`text-5xl font-bold ${getEquityColor(equityResult.win)}`}>
                        {equityResult.win.toFixed(1)}%
                      </div>
                      <div className="text-gray-400 text-sm">胜率</div>
                    </div>
                  </div>

                  <div className="relative">
                    <div className="h-6 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${getEquityGradient(equityResult.win)} transition-all duration-500`}
                        style={{ width: `${equityResult.win}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>0%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { label: '胜', value: equityResult.win, color: 'text-emerald-400' },
                      { label: '平', value: equityResult.tie, color: 'text-yellow-400' },
                      { label: '负', value: equityResult.lose, color: 'text-red-400' },
                      { label: '模拟', value: equityResult.simulations, color: 'text-blue-400', isInt: true }
                    ].map(item => (
                      <div key={item.label} className="bg-gray-900/50 rounded-xl p-4 text-center">
                        <div className={`${item.color} text-2xl font-bold`}>
                          {item.isInt ? item.value.toLocaleString() : `${item.value.toFixed(1)}${item.label === '模拟' ? '' : '%'}`}
                        </div>
                        <div className="text-gray-400 text-xs">{item.label}</div>
                      </div>
                    ))}
                  </div>

                  {(equityResult.handRank || (equityResult.outs && equityResult.outs > 0)) && (
                    <div className="bg-gray-900/50 rounded-xl p-4">
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        {equityResult.handRank && (
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-emerald-400" />
                            <span className="text-gray-300">当前牌力:</span>
                            <span className="text-white font-bold text-lg">
                              {getHandRankName(equityResult.handRank)}
                            </span>
                          </div>
                        )}
                        {equityResult.outs !== null && equityResult.outs !== undefined && (
                          <div className="flex items-center gap-2">
                            <Target className="w-5 h-5 text-purple-400" />
                            <span className="text-gray-300">精确 Outs:</span>
                            <span className="text-white font-bold">{equityResult.outs}张</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* EV 计算 */}
            {equityResult && evResult && (
              <div className="bg-gray-800/50 rounded-2xl p-6 backdrop-blur-sm border border-gray-700">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Calculator className="w-6 h-6 text-blue-400" />
                  EV 计算
                </h2>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="bg-gray-900/50 rounded-xl p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-gray-400 text-xs">底池赔率</div>
                          <div className="text-white text-xl font-bold">{evResult.potOdds}%</div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-xs">盈亏平衡胜率</div>
                          <div className="text-white text-xl font-bold">{evResult.breakEven}%</div>
                        </div>
                      </div>
                    </div>

                    <div className={`rounded-xl p-4 ${evResult.isPositiveEV ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
                      <div className="text-center">
                        <div className={`text-4xl font-bold ${evResult.isPositiveEV ? 'text-emerald-400' : 'text-red-400'}`}>
                          {evResult.ev > 0 ? '+' : ''}{evResult.ev.toFixed(2)}
                        </div>
                        <div className="text-gray-300 mt-1 flex items-center justify-center gap-1">
                          {evResult.isPositiveEV ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                          {evResult.isPositiveEV ? '正期望值 (+EV)' : '负期望值 (-EV)'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-900/50 rounded-xl p-4">
                    <div className="text-gray-400 text-xs mb-3">期望值公式</div>
                    <div className="text-white font-mono text-sm space-y-2">
                      <div className="bg-gray-800 rounded p-2">EV = Win% × Pot - Lose% × Bet</div>
                      <div className="bg-gray-800 rounded p-2">
                        EV = {equityResult.win.toFixed(1)}% × {potSize} - {(100 - equityResult.win).toFixed(1)}% × {betSize}
                      </div>
                      <div className="bg-gray-800 rounded p-2">EV = {evResult.ev.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 对手分析 */}
            {equityResult && (
              <div className="bg-gray-800/50 rounded-2xl p-6 backdrop-blur-sm border border-gray-700">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Users className="w-6 h-6 text-purple-400" />
                  对手分析
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {(['random', 'tight', 'loose', 'passive', 'nit'] as OpponentType[]).map(type => {
                    const profile = OPPONENT_PROFILES[type];
                    const isActive = opponentType === type;
                    
                    return (
                      <button
                        key={type}
                        onClick={() => handleOpponentTypeChange(type)}
                        disabled={isSimulating}
                        className={`
                          p-3 rounded-xl text-left transition-all border
                          ${isActive 
                            ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/50' 
                            : 'bg-gray-900/50 border-gray-700 hover:border-gray-600'
                          }
                          disabled:opacity-50
                        `}
                      >
                        <div className="text-white font-medium text-sm">{profile.name}</div>
                        <div className="text-gray-500 text-xs mt-1">{profile.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 移动端底部悬浮栏 + Vaul 抽屉 */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40">
        <Drawer>
          <DrawerTrigger asChild>
            <button 
              className="w-full bg-gray-900/95 backdrop-blur-lg border-t border-gray-700 px-4 py-3 flex items-center justify-between pb-[max(1rem,env(safe-area-inset-bottom))]"
              disabled={playerHand.length !== 2}
            >
              <div className="flex items-center gap-3">
                {/* 手牌预览 */}
                {playerHand.length === 2 ? (
                  <div className="flex gap-1">
                    {playerHand.map((card, i) => (
                      <span 
                        key={i}
                        className={`
                          text-base font-bold px-2 py-1 rounded
                          ${card.suit === 'h' || card.suit === 'd' ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-white'}
                        `}
                      >
                        {card.rank}{SUIT_SYMBOLS[card.suit]}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-400 text-sm">请选择手牌</span>
                )}
              </div>

              {/* 胜率显示 */}
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
            <DrawerTitle className="sr-only">胜率详情</DrawerTitle>
            <div className="overflow-y-auto max-h-[80vh] p-4">
              {/* 移动端结果面板 */}
              <div className="space-y-4">
                {/* 胜率展示 */}
                <div className="bg-gray-800/50 rounded-2xl p-4 backdrop-blur-sm border border-gray-700">
                  <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-emerald-400" />
                    胜率分析
                  </h2>

                  {playerHand.length !== 2 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Target className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>请选择你的手牌</p>
                    </div>
                  ) : isSimulating ? (
                    <div className="text-center py-8">
                      <div className="relative w-24 h-24 mx-auto mb-4">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="40" fill="none" stroke="#374151" strokeWidth="8" />
                          <circle
                            cx="50" cy="50" r="40" fill="none" stroke="url(#progressGradientMobile)"
                            strokeWidth="8" strokeLinecap="round"
                            strokeDasharray={`${progress * 2.51} 251`}
                            className="transition-all duration-300"
                          />
                          <defs>
                            <linearGradient id="progressGradientMobile" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#10b981" />
                              <stop offset="100%" stopColor="#14b8a6" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xl font-bold text-white">{Math.round(progress)}%</span>
                        </div>
                      </div>
                      
                      <p className="text-gray-400 text-sm mb-2">
                        运行 {simulations.toLocaleString()} 次模拟...
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
                        className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30"
                      >
                        取消
                      </button>
                    </div>
                  ) : equityResult ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {playerHand.map((card, i) => (
                            <span 
                              key={i}
                              className={`
                                text-xl font-bold px-2 py-1 rounded
                                ${card.suit === 'h' || card.suit === 'd' ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-white'}
                              `}
                            >
                              {card.rank}{SUIT_SYMBOLS[card.suit]}
                            </span>
                          ))}
                          <span className="text-gray-400 text-sm">({playerCombo})</span>
                        </div>
                        
                        <div className={`text-3xl font-bold ${getEquityColor(equityResult.win)}`}>
                          {equityResult.win.toFixed(1)}%
                        </div>
                      </div>

                      <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${getEquityGradient(equityResult.win)} transition-all duration-500`}
                          style={{ width: `${equityResult.win}%` }}
                        />
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { label: '胜', value: equityResult.win, color: 'text-emerald-400' },
                          { label: '平', value: equityResult.tie, color: 'text-yellow-400' },
                          { label: '负', value: equityResult.lose, color: 'text-red-400' },
                          { label: '模拟', value: equityResult.simulations, color: 'text-blue-400', isInt: true }
                        ].map(item => (
                          <div key={item.label} className="bg-gray-900/50 rounded-lg p-2 text-center">
                            <div className={`${item.color} text-lg font-bold`}>
                              {item.isInt ? item.value.toLocaleString() : `${item.value.toFixed(0)}%`}
                            </div>
                            <div className="text-gray-500 text-xs">{item.label}</div>
                          </div>
                        ))}
                      </div>

                      {(equityResult.handRank || (equityResult.outs && equityResult.outs > 0)) && (
                        <div className="bg-gray-900/50 rounded-lg p-3">
                          <div className="flex items-center justify-between gap-2">
                            {equityResult.handRank && (
                              <div className="flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-emerald-400" />
                                <span className="text-white font-medium text-sm">
                                  {getHandRankName(equityResult.handRank)}
                                </span>
                              </div>
                            )}
                            {equityResult.outs !== null && equityResult.outs !== undefined && equityResult.outs > 0 && (
                              <div className="flex items-center gap-2">
                                <Target className="w-4 h-4 text-purple-400" />
                                <span className="text-white font-medium text-sm">
                                  Outs: {equityResult.outs}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                {/* EV 计算 */}
                {equityResult && evResult && (
                  <div className="bg-gray-800/50 rounded-2xl p-4 backdrop-blur-sm border border-gray-700">
                    <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                      <Calculator className="w-5 h-5 text-blue-400" />
                      EV 计算
                    </h2>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                        <div className="text-gray-400 text-xs">底池赔率</div>
                        <div className="text-white text-lg font-bold">{evResult.potOdds}%</div>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                        <div className="text-gray-400 text-xs">盈亏平衡</div>
                        <div className="text-white text-lg font-bold">{evResult.breakEven}%</div>
                      </div>
                    </div>

                    <div className={`rounded-lg p-3 text-center ${evResult.isPositiveEV ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                      <div className={`text-2xl font-bold ${evResult.isPositiveEV ? 'text-emerald-400' : 'text-red-400'}`}>
                        {evResult.ev > 0 ? '+' : ''}{evResult.ev.toFixed(2)}
                      </div>
                      <div className="text-gray-300 text-sm flex items-center justify-center gap-1">
                        {evResult.isPositiveEV ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        {evResult.isPositiveEV ? '正期望值' : '负期望值'}
                      </div>
                    </div>
                  </div>
                )}

                {/* 对手分析 */}
                {equityResult && (
                  <div className="bg-gray-800/50 rounded-2xl p-4 backdrop-blur-sm border border-gray-700">
                    <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                      <Users className="w-5 h-5 text-purple-400" />
                      切换对手模型
                    </h2>

                    <div className="grid grid-cols-2 gap-2">
                      {(['random', 'tight', 'loose', 'passive', 'nit'] as OpponentType[]).map(type => {
                        const profile = OPPONENT_PROFILES[type];
                        const isActive = opponentType === type;
                        
                        return (
                          <button
                            key={type}
                            onClick={() => handleOpponentTypeChange(type)}
                            disabled={isSimulating}
                            className={`
                              p-2 rounded-lg text-left transition-all border min-h-[44px]
                              ${isActive 
                                ? 'bg-purple-500/20 border-purple-500/50' 
                                : 'bg-gray-900/50 border-gray-700'
                              }
                              disabled:opacity-50
                            `}
                          >
                            <div className="text-white font-medium text-sm">{profile.name}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 模拟次数选择 */}
                <div className="bg-gray-800/50 rounded-2xl p-4 backdrop-blur-sm border border-gray-700">
                  <h3 className="text-white font-semibold mb-3 text-sm">模拟次数</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {[10000, 50000, 100000, 200000].map(n => (
                      <button
                        key={n}
                        onClick={() => setSimulations(n)}
                        disabled={isSimulating}
                        className={`
                          py-2 rounded-lg text-sm font-medium transition-all min-h-[44px]
                          ${simulations === n 
                            ? 'bg-emerald-500 text-white' 
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }
                          disabled:opacity-50
                        `}
                      >
                        {n >= 1000 ? `${n / 1000}K` : n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      {/* 桌面端底部说明 */}
      <footer className="hidden lg:block max-w-7xl mx-auto px-4 py-6 text-center text-gray-500 text-xs space-y-1">
        <p className="flex items-center justify-center gap-1">
          <Zap className="w-3 h-3" /> Web Worker 后台计算，UI 永不阻塞
        </p>
        <p>对手范围精确筛选 | Outs 遍历完整牌堆</p>
      </footer>


    </div>
  );
}
