'use client';

import { useState, useCallback, useMemo } from 'react';
import { LayoutGrid, Plus, X, Type, Zap } from 'lucide-react';
import { Card, Rank, Suit, HandCombo, RANKS, SUITS, SUIT_SYMBOLS, getComboName, TOP_RANGE_PRESETS } from '@/lib/poker/pro-types';
import { parseRangeString, comboSetToString, countCombos, comboSpecificCount } from '@/lib/poker/range-parser';

// ============================================
// Range 选择器（矩阵多选模式）
// ============================================

interface RangeMatrixProps {
  onRangeChange: (selectedCombos: Set<HandCombo>, rangeString: string) => void;
  selectedRange: Set<HandCombo>;
  disabledCards?: Card[];
}

export function RangeMatrix({ onRangeChange, selectedRange, disabledCards = [] }: RangeMatrixProps) {
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);
  const [rangeText, setRangeText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'add' | 'remove'>('add');

  // 统计信息
  const stats = useMemo(() => {
    return countCombos(selectedRange, disabledCards);
  }, [selectedRange, disabledCards]);

  // 同步文本框（当选中变化时）
  const rangeString = useMemo(() => comboSetToString(selectedRange), [selectedRange]);

  // 处理矩阵 cell 点击：toggle combo
  const handleCellClick = useCallback((row: number, col: number) => {
    const combo = getComboName(row, col);
    const newRange = new Set(selectedRange);

    if (newRange.has(combo)) {
      newRange.delete(combo);
    } else {
      newRange.add(combo);
    }

    const str = comboSetToString(newRange);
    setRangeText(str);
    onRangeChange(newRange, str);
  }, [selectedRange, onRangeChange]);

  // 拖拽选择
  const handleCellMouseDown = useCallback((row: number, col: number) => {
    const combo = getComboName(row, col);
    const mode = selectedRange.has(combo) ? 'remove' : 'add';
    setIsDragging(true);
    setDragMode(mode);

    const newRange = new Set(selectedRange);
    if (mode === 'add') newRange.add(combo);
    else newRange.delete(combo);

    const str = comboSetToString(newRange);
    setRangeText(str);
    onRangeChange(newRange, str);
  }, [selectedRange, onRangeChange]);

  const handleCellMouseEnter = useCallback((row: number, col: number) => {
    setHoveredCell({ row, col });
    if (!isDragging) return;

    const combo = getComboName(row, col);
    const newRange = new Set(selectedRange);
    if (dragMode === 'add') newRange.add(combo);
    else newRange.delete(combo);

    const str = comboSetToString(newRange);
    setRangeText(str);
    onRangeChange(newRange, str);
  }, [isDragging, dragMode, selectedRange, onRangeChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 快捷预设按钮
  const handlePreset = useCallback((presetKey: string) => {
    const preset = TOP_RANGE_PRESETS[presetKey];
    if (!preset) return;
    const newRange = new Set<HandCombo>(preset.combos);
    const str = comboSetToString(newRange);
    setRangeText(str);
    onRangeChange(newRange, str);
  }, [onRangeChange]);

  // 全选 / 清空
  const handleSelectAll = useCallback(() => {
    const newRange = new Set<HandCombo>();
    for (let r = 0; r < 13; r++) {
      for (let c = 0; c < 13; c++) {
        newRange.add(getComboName(r, c));
      }
    }
    const str = comboSetToString(newRange);
    setRangeText(str);
    onRangeChange(newRange, str);
  }, [onRangeChange]);

  const handleClear = useCallback(() => {
    const newRange = new Set<HandCombo>();
    setRangeText('');
    onRangeChange(newRange, '');
  }, [onRangeChange]);

  // 文本框提交
  const handleTextSubmit = useCallback(() => {
    const parsed = parseRangeString(rangeText);
    const str = comboSetToString(parsed);
    setRangeText(str);
    onRangeChange(parsed, str);
  }, [rangeText, onRangeChange]);

  // 获取 cell 样式
  const getCellStyle = (row: number, col: number) => {
    const combo = getComboName(row, col);
    const isSelected = selectedRange.has(combo);
    const isHovered = hoveredCell?.row === row && hoveredCell?.col === col;
    const isPair = row === col;
    const isSuited = row < col;

    if (isSelected) {
      return {
        bg: 'bg-gradient-to-br from-emerald-500/80 to-teal-600/80',
        text: 'text-white',
        border: 'border-emerald-400/60'
      };
    }

    if (isHovered) {
      return {
        bg: 'bg-gray-600',
        text: 'text-white',
        border: 'border-gray-500'
      };
    }

    if (isPair) {
      return {
        bg: 'bg-gradient-to-br from-amber-500/20 to-orange-500/20',
        text: 'text-amber-300',
        border: 'border-gray-600'
      };
    }

    if (isSuited) {
      return {
        bg: 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20',
        text: 'text-cyan-300',
        border: 'border-gray-600'
      };
    }

    return {
      bg: 'bg-gradient-to-br from-gray-600 to-gray-700',
      text: 'text-gray-300',
      border: 'border-gray-600'
    };
  };

  return (
    <div
      className="bg-gray-800/50 rounded-2xl p-3 sm:p-4 backdrop-blur-sm border border-gray-700"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* 标题 */}
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <h3 className="text-white font-semibold flex items-center gap-2 text-sm sm:text-base">
          <LayoutGrid className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
          Range 选择器
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 text-xs font-mono">
            {stats.count} combos ({stats.percentage}%)
          </span>
        </div>
      </div>

      {/* 图例 */}
      <div className="flex items-center justify-center gap-3 text-xs mb-2">
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
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-emerald-500/60 rounded" />
          <span className="text-gray-400">已选</span>
        </div>
      </div>

      {/* 13x13 矩阵 */}
      <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
        <div
          className="inline-block min-w-fit origin-top-left
          transform scale-[0.72] sm:scale-[0.85] md:scale-100"
          style={{ transformOrigin: 'top left' }}
        >
          {/* 表头 */}
          <div className="flex select-none">
            <div className="w-8 h-8" />
            {RANKS.map(rank => (
              <div key={rank} className="w-9 h-8 flex items-center justify-center text-gray-400 text-sm font-medium">
                {rank}
              </div>
            ))}
          </div>

          {/* 行 */}
          {RANKS.map((rowRank, row) => (
            <div key={row} className="flex select-none">
              <div className="w-8 h-9 flex items-center justify-center text-gray-400 text-sm font-medium">
                {rowRank}
              </div>
              {RANKS.map((_, col) => {
                const style = getCellStyle(row, col);
                const combo = getComboName(row, col);
                const count = comboSpecificCount(combo);

                return (
                  <button
                    key={col}
                    onMouseDown={(e) => { e.preventDefault(); handleCellMouseDown(row, col); }}
                    onMouseEnter={() => handleCellMouseEnter(row, col)}
                    onMouseLeave={() => setHoveredCell(null)}
                    className={`
                      w-9 h-9 flex items-center justify-center text-xs font-bold
                      border transition-all duration-100 rounded cursor-pointer
                      ${style.bg} ${style.text} ${style.border}
                      hover:scale-110 hover:z-10 active:scale-95
                    `}
                    title={`${combo} (${count} combos)`}
                  >
                    {combo}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 快捷按钮 */}
      <div className="mt-3 pt-3 border-t border-gray-700">
        <div className="flex flex-wrap gap-1.5 justify-center">
          {Object.entries(TOP_RANGE_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => handlePreset(key)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all
                bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white active:scale-95"
            >
              {preset.label}
            </button>
          ))}
          <button
            onClick={handleSelectAll}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all
              bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 active:scale-95"
          >
            全选
          </button>
          <button
            onClick={handleClear}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all
              bg-red-500/20 text-red-300 hover:bg-red-500/30 active:scale-95"
          >
            清空
          </button>
        </div>
      </div>

      {/* Range 文本输入 */}
      <div className="mt-3 pt-3 border-t border-gray-700">
        <div className="flex items-center gap-2">
          <Type className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={rangeText}
            onChange={(e) => setRangeText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleTextSubmit(); }}
            onBlur={handleTextSubmit}
            placeholder="输入 range: AA, KK, AKs+, JJ-TT..."
            className="flex-1 bg-gray-700 text-white text-xs rounded-lg px-3 py-2 min-h-[36px] font-mono
              placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <button
            onClick={handleTextSubmit}
            className="px-3 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-medium
              hover:bg-emerald-500/30 active:scale-95 flex items-center gap-1"
          >
            <Zap className="w-3 h-3" />
            应用
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 公共牌选择矩阵（保持不变）
// ============================================

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

      {/* 已选公共牌 */}
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
        {Array.from({ length: maxCards - communityCards.length }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="w-14 h-[4.5rem] sm:w-12 sm:h-16 rounded-xl border-2 border-dashed border-gray-600 flex items-center justify-center text-gray-500"
          >
            <Plus className="w-5 h-5" />
          </div>
        ))}
      </div>

      {/* 点数选择 */}
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

      {/* 花色选择 */}
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
