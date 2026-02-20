// ============================================
// 德州扑克专业引擎 — 牌编码系统
// ============================================
// CardIndex = rank * 4 + suit
// rank: 0='2', 1='3', ..., 12='A'
// suit: 0='s', 1='h', 2='d', 3='c'

import type { CardIndex } from './types';

export const RANK_CHARS = '23456789TJQKA';
export const SUIT_CHARS = 'shdc';

/** rank char → 0-12 */
const R: Record<string, number> = {};
for (let i = 0; i < 13; i++) R[RANK_CHARS[i]] = i;

/** suit char → 0-3 */
const S: Record<string, number> = {};
for (let i = 0; i < 4; i++) S[SUIT_CHARS[i]] = i;

/** 生成 CardIndex (0-51) */
export function cardIndex(rank: number, suit: number): CardIndex {
    return rank * 4 + suit;
}

/** 从字符串解析, e.g. "As" → 51, "2c" → 3 */
export function cardFromString(s: string): CardIndex {
    const rank = R[s[0]];
    const suit = S[s[1]];
    if (rank === undefined || suit === undefined) throw new Error(`Invalid card: ${s}`);
    return rank * 4 + suit;
}

/** CardIndex → 可读字符串, e.g. 51 → "As" */
export function cardToString(idx: CardIndex): string {
    return RANK_CHARS[idx >> 2] + SUIT_CHARS[idx & 3];
}

/** 获取牌的 rank (0-12) */
export function cardRank(idx: CardIndex): number {
    return idx >> 2;
}

/** 获取牌的 suit (0-3) */
export function cardSuit(idx: CardIndex): number {
    return idx & 3;
}

/** 所有 52 张牌的 CardIndex 数组 */
export const ALL_CARDS: CardIndex[] = [];
for (let i = 0; i < 52; i++) ALL_CARDS.push(i);

export { R as RANK_MAP, S as SUIT_MAP };
