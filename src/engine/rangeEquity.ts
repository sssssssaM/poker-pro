// ============================================
// 德州扑克专业引擎 — Range vs Range 公共 API
// ============================================
// 所有外部调用通过此模块, 不直接调用内部模块

import type { CardIndex, RangeEquityResult } from './types';
import { parseRangeFromCombos, OPPONENT_RANGES } from './rangeParser';
import { runMonteCarlo } from './monteCarlo';

/**
 * 🎯 Range vs Range Equity 计算 (公共 API)
 *
 * @param range1Combos - Hero range combo 字符串数组 ["AA","AKs"]
 * @param range2Combos - Villain range combo 字符串数组 (空 = random)
 * @param boardCards   - 公共牌 CardIndex[] (空 = preflop)
 * @param iterations   - 迭代次数 (默认 50000)
 * @param onProgress   - 进度回调
 * @returns RangeEquityResult
 */
export function calculateRangeEquity(
    range1Combos: string[],
    range2Combos: string[],
    boardCards: CardIndex[] = [],
    iterations: number = 50000,
    onProgress?: (pct: number, w: number, t: number, l: number, sims: number) => void
): RangeEquityResult {
    const heroHands = parseRangeFromCombos(range1Combos);
    const villainHands = range2Combos.length > 0
        ? parseRangeFromCombos(range2Combos)
        : null;

    return runMonteCarlo(heroHands, villainHands, boardCards, iterations, onProgress);
}

/**
 * Convenience: 使用对手类型字符串
 */
export function calculateRangeEquityVsType(
    range1Combos: string[],
    opponentType: string,
    boardCards: CardIndex[] = [],
    iterations: number = 50000,
    onProgress?: (pct: number, w: number, t: number, l: number, sims: number) => void
): RangeEquityResult {
    const oppCombos = OPPONENT_RANGES[opponentType] || [];
    return calculateRangeEquity(range1Combos, oppCombos, boardCards, iterations, onProgress);
}

// Re-export for convenience
export { parseRangeFromCombos, OPPONENT_RANGES } from './rangeParser';
export { cardFromString, cardToString, cardIndex } from './card';
export type { RangeEquityResult, CardIndex } from './types';
