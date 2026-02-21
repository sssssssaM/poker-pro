'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { LayoutGrid, Plus, X, Type, Zap } from 'lucide-react';
import { Card, Rank, Suit, HandCombo, RANKS, SUITS, SUIT_SYMBOLS, getComboName, TOP_RANGE_PRESETS } from '@/lib/poker/pro-types';
import { parseRangeString, comboSetToString, countCombos, comboSpecificCount } from '@/lib/poker/range-parser';

interface RangeMatrixProps {
  onRangeChange: (selectedCombos: Set<HandCombo>, rangeString: string) => void;
  selectedRange: Set<HandCombo>;
  disabledCards?: Card[];
  colorTheme?: 'emerald' | 'purple';
}

export function RangeMatrix({ onRangeChange, selectedRange, disabledCards = [], colorTheme = 'emerald' }: RangeMatrixProps) {
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);
  const [rangeText, setRangeText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'add' | 'remove'>('add');
  const matrixRef = useRef<HTMLDivElement>(null);

  const stats = useMemo(() => countCombos(selectedRange, disabledCards), [selectedRange, disabledCards]);
  const rangeString = useMemo(() => comboSetToString(selectedRange), [selectedRange]);

  // 电脑端：处理点击和鼠标拖拽
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
    setHoveredCell(null);
  }, []);

  // 📱 移动端：处理手指滑动涂抹 (Touch Events)
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;

    // 阻止页面滚动，让手指专心滑动选牌
    if (e.cancelable) e.preventDefault();

    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement;

    if (element && element.dataset.combo) {
      const combo = element.dataset.combo;
      const row = parseInt(element.dataset.row!);
      const col = parseInt(element.dataset.col!);

      // 防止在同一个格子上重复触发
      if (hoveredCell?.row === row && hoveredCell?.col === col) return;

      setHoveredCell({ row, col });
      const newRange = new Set(selectedRange);
      if (dragMode === 'add') newRange.add(combo);
      else newRange.delete(combo);

      const str = comboSetToString(newRange);
      setRangeText(str);
      onRangeChange(newRange, str);
    }
  }, [isDragging, dragMode, selectedRange, hoveredCell, onRangeChange]);

  const handleTouchStart = useCallback((row: number, col: number) => {
    handleCellMouseDown(row, col);
  }, [handleCellMouseDown]);

  const handleTouchEnd = useCallback(() => {
    handleMouseUp();
  }, [handleMouseUp]);

  // 全局防止鼠标/手指松开时状态未重置
  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchend', handleMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, [handleMouseUp]);

  // 快捷操作
  const handlePreset = useCallback((presetKey: string) => {
    const preset = TOP_RANGE_PRESETS[presetKey];
    if (!preset) return;
    const newRange = new Set<HandCombo>(preset.combos);
    setRangeText(comboSetToString(newRange));
    onRangeChange(newRange, comboSetToString(newRange));
  }, [onRangeChange]);

  const handleSelectAll = useCallback(() => {
    const newRange = new Set<HandCombo>();
    for (let r = 0; r < 13; r++) {
      for (let c = 0; c < 13; c++) newRange.add(getComboName(r, c));
    }
    setRangeText(comboSetToString(newRange));
    onRangeChange(newRange, comboSetToString(newRange));
  }, [onRangeChange]);

  const handleClear = useCallback(() => {
    setRangeText('');
    onRangeChange(new Set(), '');
  }, [onRangeChange]);

  const handleTextSubmit = useCallback(() => {
    const parsed = parseRangeString(rangeText);
    const str = comboSetToString(parsed);
    setRangeText(str);
    onRangeChange(parsed, str);
  }, [rangeText, onRangeChange]);

  const getCellStyle = (row: number, col: number) => {
    const combo = getComboName(row, col);
    const isSelected = selectedRange.has(combo);
    const isHovered = hoveredCell?.row === row && hoveredCell?.col === col;

    if (isSelected) {
      return colorTheme === 'purple'
        ? 'bg-gradient-to-br from-purple-500/80 to-pink-600/80 text-white border-purple-400/60'
        : 'bg-gradient-to-br from-emerald-500/80 to-teal-600/80 text-white border-emerald-400/60';
    }
    if (isHovered) return 'bg-gray-600 text-white border-gray-500';
    if (row === col) return 'bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-300 border-gray-600';
    if (row < col) return 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20 text-cyan-300 border-gray-600';
    return 'bg-gradient-to-br from-gray-600 to-gray-700 text-gray-300 border-gray-600';
  };

  return (
    <div
      className="bg-gray-800/50 rounded-2xl p-3 sm:p-4 backdrop-blur-sm border border-gray-700 select-none"
    >
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <h3 className="text-white font-semibold flex items-center gap-2 text-sm sm:text-base">
          <LayoutGrid className={`w-4 h-4 sm:w-5 sm:h-5 ${colorTheme === 'purple' ? 'text-purple-400' : 'text-emerald-400'}`} />
          Range 选择器
        </h3>
        <span className={`text-xs font-mono px-2 py-1 rounded ${colorTheme === 'purple'
          ? 'text-purple-400 bg-purple-500/10'
          : 'text-emerald-400 bg-emerald-500/10'
          }`}>
          {stats.count} combos ({stats.percentage}%)
        </span>
      </div>

      {/* 📱 居中且自适应的矩阵容器 */}
      <div className="w-full overflow-x-auto no-scrollbar pb-2">
        <div
          ref={matrixRef}
          className="inline-block origin-top-left scale-[0.70] sm:scale-[0.85] lg:scale-[0.82] xl:scale-100 touch-none"
          onTouchMove={handleTouchMove}
        >
          <div className="flex">
            <div className="w-8 h-8" />
            {RANKS.map(rank => (
              <div key={rank} className="w-9 h-8 flex items-center justify-center text-gray-400 text-sm font-medium">{rank}</div>
            ))}
          </div>

          {RANKS.map((rowRank, row) => (
            <div key={row} className="flex">
              <div className="w-8 h-9 flex items-center justify-center text-gray-400 text-sm font-medium">{rowRank}</div>
              {RANKS.map((_, col) => {
                const combo = getComboName(row, col);
                return (
                  <button
                    key={col}
                    data-combo={combo}
                    data-row={row}
                    data-col={col}
                    onMouseDown={(e) => { e.preventDefault(); handleCellMouseDown(row, col); }}
                    onMouseEnter={() => handleCellMouseEnter(row, col)}
                    onTouchStart={(e) => { e.preventDefault(); handleTouchStart(row, col); }}
                    onTouchEnd={handleTouchEnd}
                    className={`
                      w-9 h-9 flex items-center justify-center text-xs font-bold
                      border transition-all duration-75 rounded cursor-pointer
                      ${getCellStyle(row, col)}
                    `}
                  >
                    {combo}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 pt-3 border-t border-gray-700">
        <div className="flex flex-wrap gap-1.5 justify-center">
          {Object.entries(TOP_RANGE_PRESETS).map(([key, preset]) => (
            <button key={key} onClick={() => handlePreset(key)} className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 active:scale-95">
              {preset.label}
            </button>
          ))}
          <button onClick={handleSelectAll} className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-500/20 text-blue-300">全选</button>
          <button onClick={handleClear} className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-500/20 text-red-300">清空</button>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-700 flex items-center gap-2">
        <Type className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <input
          type="text"
          value={rangeText}
          onChange={(e) => setRangeText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleTextSubmit(); }}
          onBlur={handleTextSubmit}
          placeholder="输入: AA, KK, AKs+, JJ-TT..."
          className={`flex-1 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 min-h-[36px] font-mono border border-gray-700 focus:outline-none ${colorTheme === 'purple' ? 'focus:border-purple-500' : 'focus:border-emerald-500'
            }`}
        />
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

      {/* 点数选择 (compact for mobile) */}
      <div className="mb-3">
        <div className="flex flex-wrap gap-1 sm:gap-1.5 justify-center max-w-sm mx-auto">
          {RANKS.map(rank => (
            <button
              key={rank}
              onClick={() => setSelectedRank(selectedRank === rank ? null : rank)}
              className={`
                w-8 h-9 sm:w-9 sm:h-9 rounded-xl font-bold text-sm transition-all
                ${selectedRank === rank
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white scale-105 shadow-md'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 active:scale-95'
                }
              `}
            >
              {rank}
            </button>
          ))}
        </div>
      </div>

      {/* 花色选择 (compact) */}
      {selectedRank && (
        <div className="flex gap-2 justify-center pb-1">
          {SUITS.map(suit => {
            const disabled = isCardDisabled(selectedRank, suit);
            const isRed = suit === 'h' || suit === 'd';

            return (
              <button
                key={suit}
                onClick={() => handleCardSelect(selectedRank, suit)}
                disabled={disabled}
                className={`
                  w-14 h-12 sm:w-14 sm:h-12 rounded-xl text-2xl font-bold transition-all
                  active:scale-95 flex items-center justify-center
                  ${disabled
                    ? 'bg-gray-800 text-gray-600 cursor-not-allowed opacity-50'
                    : 'bg-gray-700 hover:bg-gray-600 shadow-md'
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
