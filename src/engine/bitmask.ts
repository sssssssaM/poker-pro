// ============================================
// 德州扑克专业引擎 — 位掩码操作
// ============================================
// 使用 [lo26, hi26] 双 Number 方案
// 比 BigInt 快 10-100x (纯栈运算, 无 GC)

import type { CardIndex, HandMask } from './types';

/** 空掩码 */
export const EMPTY_MASK: HandMask = [0, 0];

/** 52 张牌全集掩码 */
export const FULL_DECK: HandMask = [(1 << 26) - 1, (1 << 26) - 1];

/** 单张牌 → lo bit */
export function bitLo(card: CardIndex): number {
    return card < 26 ? (1 << card) : 0;
}

/** 单张牌 → hi bit */
export function bitHi(card: CardIndex): number {
    return card >= 26 ? (1 << (card - 26)) : 0;
}

/** 创建两张牌的手牌掩码 */
export function handMask(c1: CardIndex, c2: CardIndex): HandMask {
    return [bitLo(c1) | bitLo(c2), bitHi(c1) | bitHi(c2)];
}

/** 合并两个掩码 (OR) */
export function mergeMask(a: HandMask, b: HandMask): HandMask {
    return [a[0] | b[0], a[1] | b[1]];
}

/** O(1) 冲突检测: 两个掩码是否有重叠的牌 */
export function conflict(a: HandMask, b: HandMask): boolean {
    return ((a[0] & b[0]) !== 0) || ((a[1] & b[1]) !== 0);
}

/** 将单张牌加入掩码 */
export function addCard(mask: HandMask, card: CardIndex): HandMask {
    return [mask[0] | bitLo(card), mask[1] | bitHi(card)];
}

/** 检测单张牌是否在掩码中 */
export function hasCard(mask: HandMask, card: CardIndex): boolean {
    if (card < 26) return (mask[0] & (1 << card)) !== 0;
    return (mask[1] & (1 << (card - 26))) !== 0;
}

/** 从一组 CardIndex 构建掩码 */
export function maskFromCards(cards: CardIndex[]): HandMask {
    let lo = 0, hi = 0;
    for (const c of cards) {
        lo |= bitLo(c);
        hi |= bitHi(c);
    }
    return [lo, hi];
}

/** popcount: 掩码中的牌数 */
export function popCount(mask: HandMask): number {
    return popCount32(mask[0]) + popCount32(mask[1]);
}

function popCount32(n: number): number {
    n = n - ((n >>> 1) & 0x55555555);
    n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
    return (((n + (n >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24;
}

// ============================================
// 预分配 deck buffer: 零堆分配随机发牌
// ============================================
const _deckBuf = new Int32Array(52);

/**
 * 构建排除死牌后的剩余牌组 (写入 _deckBuf)
 * @returns 可用牌数量
 */
export function buildDeck(deadLo: number, deadHi: number): number {
    let n = 0;
    for (let i = 0; i < 26; i++) {
        if (!((deadLo >>> i) & 1)) _deckBuf[n++] = i;
    }
    for (let i = 0; i < 26; i++) {
        if (!((deadHi >>> i) & 1)) _deckBuf[n++] = i + 26;
    }
    return n;
}

/**
 * 部分 Fisher-Yates: 随机打乱前 k 张
 * O(k) 复杂度, 不动剩余元素
 */
export function partialShuffle(len: number, k: number): void {
    for (let i = 0; i < k && i < len - 1; i++) {
        const j = i + Math.floor(Math.random() * (len - i));
        const tmp = _deckBuf[i];
        _deckBuf[i] = _deckBuf[j];
        _deckBuf[j] = tmp;
    }
}

/** 获取 _deckBuf[i] (读取随机发出的牌) */
export function deckCard(i: number): CardIndex {
    return _deckBuf[i];
}
