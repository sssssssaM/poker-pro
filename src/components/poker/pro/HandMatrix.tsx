'use client';

import { useState, useCallback } from 'react';
import { Target, LayoutGrid, Plus, X } from 'lucide-react';
import { Card, Rank, Suit, HandCombo, RANKS, SUITS, SUIT_SYMBOLS, getComboName } from '@/lib/poker/pro-types';

interface HandMatrixProps {
  onHandSelect: (cards: Card[], combo: HandCombo) => void;
  selectedCards?: Card[];
  disabledCards?: Card[];
  highlightRange?: Set<HandCombo>;
}

export function HandMatrix({ onHandSelect, selectedCards = [], disabledCards = [], highlightRange }: HandMatrixProps) {
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  // 检查某张牌是否被禁用
  const isCardDisabled = useCallback((rank: Rank, suit: Suit): boolean => {
    return disabledCards.some(c => c.rank === rank && c.suit === suit);
  }, [disabledCards]);

  // 检查某组合是否可用
  const canSelectCombo = useCallback((row: number, col: number): boolean => {
    const rank1 = RANKS[row];
    const rank2 = RANKS[col];
    
    if (row === col) {
      const availableSuits = SUITS.filter(s => !isCardDisabled(rank1, s));
      return availableSuits.length >= 2;
    } else if (row < col) {
      return SUITS.some(s => !isCardDisabled(rank1, s) && !isCardDisabled(rank2, s));
    } else {
      return SUITS.some(s1 => 
        SUITS.some(s2 => 
          s1 !== s2 && !isCardDisabled(rank1, s1) && !isCardDisabled(rank2, s2)
        )
      );
    }
  }, [isCardDisabled]);

  // 获取组合的具体牌
  const getComboCards = useCallback((row: number, col: number): Card[] => {
    const rank1 = RANKS[row];
    const rank2 = RANKS[col];
    
    if (row === col) {
      const availableSuits = SUITS.filter(s => !isCardDisabled(rank1, s));
      return [
        { rank: rank1, suit: availableSuits[0] },
        { rank: rank1, suit: availableSuits[1] }
      ];
    } else if (row < col) {
      const suit = SUITS.find(s => !isCardDisabled(rank1, s) && !isCardDisabled(rank2, s));
      return suit ? [
        { rank: rank1, suit },
        { rank: rank2, suit }
      ] : [];
    } else {
      for (const s1 of SUITS) {
        for (const s2 of SUITS) {
          if (s1 !== s2 && !isCardDisabled(rank1, s1) && !isCardDisabled(rank2, s2)) {
            return [
              { rank: rank1, suit: s1 },
              { rank: rank2, suit: s2 }
            ];
          }
        }
      }
      return [];
    }
  }, [isCardDisabled]);

  // 处理点击
  const handleCellClick = (row: number, col: number) => {
    if (!canSelectCombo(row, col)) return;
    
    const cards = getComboCards(row, col);
    const combo = getComboName(row, col);
    
    if (cards.length === 2) {
      onHandSelect(cards, combo);
    }
  };

  // 获取单元格样式
  const getCellStyle = (row: number, col: number) => {
    const combo = getComboName(row, col);
    const canSelect = canSelectCombo(row, col);
    const isInRange = highlightRange?.has(combo);
    const isSelected = selectedCards.length === 2 && 
      getComboName(RANKS.indexOf(selectedCards[0].rank), RANKS.indexOf(selectedCards[1].rank)) === combo;
    const isHovered = hoveredCell?.row === row && hoveredCell?.col === col;
    
    let bgColor = 'bg-gray-700';
    let textColor = 'text-gray-300';
    let borderColor = 'border-gray-600';
    
    if (!canSelect) {
      bgColor = 'bg-gray-800';
      textColor = 'text-gray-600';
      borderColor = 'border-gray-700';
    } else if (isSelected) {
      bgColor = 'bg-gradient-to-br from-emerald-500 to-teal-600';
      textColor = 'text-white';
      borderColor = 'border-emerald-400';
    } else if (isInRange) {
      bgColor = 'bg-gradient-to-br from-blue-500/30 to-purple-500/30';
      textColor = 'text-blue-300';
      borderColor = 'border-blue-400/50';
    } else if (isHovered) {
      bgColor = 'bg-gray-600';
      textColor = 'text-white';
    }
    
    // 对子（对角线）
    if (row === col) {
      if (canSelect && !isSelected && !isInRange) {
        bgColor = 'bg-gradient-to-br from-amber-500/20 to-orange-500/20';
        textColor = 'text-amber-300';
      }
    }
    // 同花（左上）
    else if (row < col) {
      if (canSelect && !isSelected && !isInRange) {
        bgColor = 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20';
        textColor = 'text-cyan-300';
      }
    }
    // 非同花（右下）
    else {
      if (canSelect && !isSelected && !isInRange) {
        bgColor = 'bg-gradient-to-br from-gray-600 to-gray-700';
        textColor = 'text-gray-300';
      }
    }
    
    return { bgColor, textColor, borderColor, canSelect };
  };

  return (
    <div className="bg-gray-800/50 rounded-2xl p-3 sm:p-4 backdrop-blur-sm border border-gray-700">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <h3 className="text-white font-semibold flex items-center gap-2 text-sm sm:text-base">
          <LayoutGrid className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
          手牌矩阵
        </h3>
        <div className="hidden sm:flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-amber-500/30 rounded" />
            <span className="text-gray-400">对子</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-cyan-500/30 rounded" />
            <span className="text-gray-400">同花</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-600 rounded" />
            <span className="text-gray-400">非同花</span>
          </div>
        </div>
      </div>

      {/* 13x13矩阵 - 移动端适配 */}
      <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
        <div 
          className="inline-block min-w-fit origin-top-left
          transform scale-[0.72] sm:scale-[0.85] md:scale-100"
          style={{ transformOrigin: 'top left' }}
        >
          {/* 表头 */}
          <div className="flex">
            <div className="w-8 h-8" />
            {RANKS.map(rank => (
              <div key={rank} className="w-9 h-8 flex items-center justify-center text-gray-400 text-sm font-medium">
                {rank}
              </div>
            ))}
          </div>
          
          {/* 行 */}
          {RANKS.map((rowRank, row) => (
            <div key={row} className="flex">
              {/* 行表头 */}
              <div className="w-8 h-9 flex items-center justify-center text-gray-400 text-sm font-medium">
                {rowRank}
              </div>
              
              {/* 单元格 */}
              {RANKS.map((colRank, col) => {
                const style = getCellStyle(row, col);
                const combo = getComboName(row, col);
                
                return (
                  <button
                    key={col}
                    onClick={() => handleCellClick(row, col)}
                    onMouseEnter={() => setHoveredCell({ row, col })}
                    onMouseLeave={() => setHoveredCell(null)}
                    disabled={!style.canSelect}
                    className={`
                      w-9 h-9 flex items-center justify-center text-xs font-bold
                      border transition-all duration-150 rounded
                      ${style.bgColor} ${style.textColor} ${style.borderColor}
                      ${style.canSelect ? 'cursor-pointer hover:scale-110 hover:z-10 active:scale-95' : 'cursor-not-allowed opacity-50'}
                    `}
                    title={`${combo} ${style.canSelect ? '' : '(不可用)'}`}
                  >
                    {combo}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 移动端图例 */}
      <div className="flex sm:hidden items-center justify-center gap-4 text-xs mt-2 pt-2 border-t border-gray-700">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 bg-amber-500/30 rounded" />
          <span className="text-gray-400">对子</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 bg-cyan-500/30 rounded" />
          <span className="text-gray-400">同花</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 bg-gray-600 rounded" />
          <span className="text-gray-400">非同花</span>
        </div>
      </div>

      {/* 当前选中 */}
      {selectedCards.length === 2 && (
        <div className="mt-2 sm:mt-3 p-2 bg-gray-900/50 rounded-lg flex items-center justify-center gap-2">
          <span className="text-gray-400 text-sm">已选:</span>
          <div className="flex gap-1">
            {selectedCards.map((card, i) => (
              <span 
                key={i}
                className={`
                  px-2 py-1 rounded font-bold text-sm
                  ${card.suit === 'h' || card.suit === 'd' ? 'text-red-400 bg-red-500/10' : 'text-gray-200 bg-gray-700'}
                `}
              >
                {card.rank}{SUIT_SYMBOLS[card.suit]}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 公共牌选择矩阵
interface CommunityCardMatrixProps {
  onCardSelect: (card: Card) => void;
  onCardRemove: (index: number) => void;
  communityCards: Card[];
  disabledCards: Card[];
  maxCards: number;
}

export function CommunityCardMatrix({ 
  onCardSelect, 
  onCardRemove, 
  communityCards, 
  disabledCards,
  maxCards 
}: CommunityCardMatrixProps) {
  const [selectedRank, setSelectedRank] = useState<Rank | null>(null);

  const isCardDisabled = (rank: Rank, suit: Suit): boolean => {
    return disabledCards.some(c => c.rank === rank && c.suit === suit) ||
           communityCards.some(c => c.rank === rank && c.suit === suit);
  };

  const handleCardSelect = (rank: Rank, suit: Suit) => {
    if (isCardDisabled(rank, suit)) return;
    if (communityCards.length >= maxCards) return;
    onCardSelect({ rank, suit });
    setSelectedRank(null);
  };

  return (
    <div className="bg-gray-800/50 rounded-2xl p-3 sm:p-4 backdrop-blur-sm border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold flex items-center gap-2 text-sm sm:text-base">
          <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
          公共牌 ({communityCards.length}/{maxCards})
        </h3>
        <span className="text-gray-500 text-xs hidden sm:inline">点击牌面移除</span>
      </div>

      {/* 已选公共牌 - 移动端友好的大面积点击区 */}
      <div className="flex gap-2 mb-4 flex-wrap justify-center">
        {communityCards.map((card, i) => (
          <button
            key={i}
            onClick={() => onCardRemove(i)}
            className={`
              w-14 h-[4.5rem] sm:w-12 sm:h-16 rounded-xl 
              flex flex-col items-center justify-center
              border-2 border-gray-600 hover:border-red-500 active:border-red-400
              transition-colors active:scale-95
              ${card.suit === 'h' || card.suit === 'd' ? 'bg-red-500/10' : 'bg-gray-700'}
            `}
            title="点击移除"
          >
            <span className={`text-lg font-bold ${card.suit === 'h' || card.suit === 'd' ? 'text-red-400' : 'text-white'}`}>
              {card.rank}
            </span>
            <span className={`text-base ${card.suit === 'h' || card.suit === 'd' ? 'text-red-400' : 'text-white'}`}>
              {SUIT_SYMBOLS[card.suit]}
            </span>
            <X className="w-3 h-3 text-gray-500 mt-1" />
          </button>
        ))}
        
        {/* 空位 */}
        {Array.from({ length: maxCards - communityCards.length }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="w-14 h-[4.5rem] sm:w-12 sm:h-16 rounded-xl border-2 border-dashed border-gray-600 flex items-center justify-center text-gray-500"
          >
            <Plus className="w-5 h-5" />
          </div>
        ))}
      </div>

      {/* 点数选择 - 移动端优化 */}
      <div className="mb-3">
        <div className="flex flex-wrap gap-1.5 sm:gap-1 justify-center">
          {RANKS.map(rank => (
            <button
              key={rank}
              onClick={() => setSelectedRank(selectedRank === rank ? null : rank)}
              className={`
                w-9 h-10 sm:w-9 sm:h-9 rounded-xl font-bold text-sm transition-all min-h-[44px] sm:min-h-0
                ${selectedRank === rank 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white scale-105' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 active:scale-95'
                }
              `}
            >
              {rank}
            </button>
          ))}
        </div>
      </div>

      {/* 花色选择 - 移动端优化 */}
      {selectedRank && (
        <div className="flex gap-2 justify-center">
          {SUITS.map(suit => {
            const disabled = isCardDisabled(selectedRank, suit);
            const isRed = suit === 'h' || suit === 'd';
            
            return (
              <button
                key={suit}
                onClick={() => handleCardSelect(selectedRank, suit)}
                disabled={disabled}
                className={`
                  w-16 h-14 sm:w-14 sm:py-3 rounded-xl text-2xl font-bold transition-all min-h-[56px] sm:min-h-0
                  active:scale-95
                  ${disabled 
                    ? 'bg-gray-800 text-gray-600 cursor-not-allowed opacity-50' 
                    : 'bg-gray-700 hover:bg-gray-600 active:bg-gray-600'
                  }
                  ${isRed && !disabled ? 'text-red-400' : !disabled ? 'text-white' : ''}
                `}
              >
                {SUIT_SYMBOLS[suit]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
