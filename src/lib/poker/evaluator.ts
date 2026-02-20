// ============================================
// 高性能 7-card 手牌评估器
// 全部使用 CardIndex (0-51), 无 Map/Set 创建
// 返回 rank value: 越大越强
// ============================================

import { CardIndex, cardRank, cardSuit } from './card';

// 手牌等级
const HIGH_CARD = 0;
const PAIR = 1;
const TWO_PAIR = 2;
const THREE_KIND = 3;
const STRAIGHT = 4;
const FLUSH = 5;
const FULL_HOUSE = 6;
const FOUR_KIND = 7;
const STRAIGHT_FLUSH = 8;

// rank value = category * 1_000_000 + tiebreaker
// tiebreaker 使用 15 进制编码最多 5 个 kicker

/**
 * 评估 7 张牌中的最佳 5 张
 * @param cards 7 张 CardIndex 数组
 * @returns rank value (越大越强)
 */
export function evaluate7(cards: CardIndex[]): number {
    // 1. 统计 rank 和 suit
    const rankCount = new Int8Array(13); // 0-12, 每个 rank 出现次数
    const suitCount = new Int8Array(4);  // 0-3, 每个 suit 出现次数
    const suitCards: CardIndex[][] = [[], [], [], []]; // 按 suit 分组

    for (let i = 0; i < cards.length; i++) {
        const r = cardRank(cards[i]);
        const s = cardSuit(cards[i]);
        rankCount[r]++;
        suitCount[s]++;
        suitCards[s].push(cards[i]);
    }

    // 2. 检查同花
    let flushSuit = -1;
    for (let s = 0; s < 4; s++) {
        if (suitCount[s] >= 5) {
            flushSuit = s;
            break;
        }
    }

    // 3. 检查顺子 (在全部牌中)
    const straightHigh = findStraightHigh(rankCount);

    // 4. 同花顺检查
    if (flushSuit >= 0 && straightHigh >= 0) {
        // 用同花牌重新检查顺子
        const flushRankCount = new Int8Array(13);
        for (const c of suitCards[flushSuit]) {
            flushRankCount[cardRank(c)]++;
        }
        const sfHigh = findStraightHigh(flushRankCount);
        if (sfHigh >= 0) {
            return STRAIGHT_FLUSH * 1_000_000 + sfHigh;
        }
    }

    // 5. 四条
    const fourRank = findNOfAKind(rankCount, 4);
    if (fourRank >= 0) {
        const kicker = findBestKickers(rankCount, [fourRank], 1);
        return FOUR_KIND * 1_000_000 + fourRank * 15 + kicker[0];
    }

    // 6. 葫芦 (三条 + 一对)
    const threeRank = findNOfAKind(rankCount, 3);
    if (threeRank >= 0) {
        // 可能有两个三条 (7 张牌), 取最大的
        const secondThree = findNOfAKindExcluding(rankCount, 3, threeRank);
        const pairRank = findNOfAKindExcluding(rankCount, 2, threeRank);

        // 另一个三条也可以当对子用
        const bestPair = Math.max(secondThree, pairRank);
        if (bestPair >= 0) {
            return FULL_HOUSE * 1_000_000 + threeRank * 15 + bestPair;
        }
    }

    // 7. 同花
    if (flushSuit >= 0) {
        const flushRanks = suitCards[flushSuit]
            .map(c => cardRank(c))
            .sort((a, b) => b - a)
            .slice(0, 5);
        return FLUSH * 1_000_000 + encodeKickers(flushRanks);
    }

    // 8. 顺子
    if (straightHigh >= 0) {
        return STRAIGHT * 1_000_000 + straightHigh;
    }

    // 9. 三条 (无对子配成葫芦)
    if (threeRank >= 0) {
        const kickers = findBestKickers(rankCount, [threeRank], 2);
        return THREE_KIND * 1_000_000 + threeRank * 225 + encodeKickers(kickers);
    }

    // 10. 两对 / 一对 / 高牌
    const pairs = findAllPairs(rankCount);

    if (pairs.length >= 2) {
        // 两对 (取最大两对)
        const p1 = pairs[0]; // 最大
        const p2 = pairs[1]; // 次大
        const kicker = findBestKickers(rankCount, [p1, p2], 1);
        return TWO_PAIR * 1_000_000 + p1 * 225 + p2 * 15 + kicker[0];
    }

    if (pairs.length === 1) {
        const kickers = findBestKickers(rankCount, [pairs[0]], 3);
        return PAIR * 1_000_000 + pairs[0] * 3375 + encodeKickers(kickers);
    }

    // 高牌
    const kickers = findBestKickers(rankCount, [], 5);
    return HIGH_CARD * 1_000_000 + encodeKickers(kickers);
}

// ============================================
// 顺子检测 — 13-bit bitmask + 预计算表
// ============================================

// 预计算所有顺子的 bitmask 模式 (13 bits, bit 0 = rank 2, bit 12 = rank A)
// 每个顺子是 5 个连续 bit
const STRAIGHT_PATTERNS: { mask: number; high: number }[] = [
    { mask: 0b1111100000000, high: 14 }, // A K Q J T (Royal)
    { mask: 0b0111110000000, high: 13 }, // K Q J T 9
    { mask: 0b0011111000000, high: 12 }, // Q J T 9 8
    { mask: 0b0001111100000, high: 11 }, // J T 9 8 7
    { mask: 0b0000111110000, high: 10 }, // T 9 8 7 6
    { mask: 0b0000011111000, high: 9 },  // 9 8 7 6 5
    { mask: 0b0000001111100, high: 8 },  // 8 7 6 5 4
    { mask: 0b0000000111110, high: 7 },  // 7 6 5 4 3
    { mask: 0b0000000011111, high: 6 },  // 6 5 4 3 2
    { mask: 0b1000000001111, high: 5 },  // A 2 3 4 5 (Wheel)
];

/** 查找顺子最高牌值 (2-14), -1 = 无顺子. 使用 bitmask 查表 */
function findStraightHigh(rankCount: Int8Array): number {
    // 构建 13-bit bitmask: 哪些 rank 至少有 1 张
    let mask = 0;
    for (let r = 0; r < 13; r++) {
        if (rankCount[r] > 0) mask |= (1 << r);
    }

    // 查表
    for (const pat of STRAIGHT_PATTERNS) {
        if ((mask & pat.mask) === pat.mask) return pat.high;
    }

    return -1;
}

/** 查找 n 张相同的 rank (返回最大的一个), -1 = 未找到 */
function findNOfAKind(rankCount: Int8Array, n: number): number {
    for (let r = 12; r >= 0; r--) {
        if (rankCount[r] >= n) return r;
    }
    return -1;
}

/** 查找 n 张相同的 rank, 排除某个 rank */
function findNOfAKindExcluding(rankCount: Int8Array, n: number, excludeRank: number): number {
    for (let r = 12; r >= 0; r--) {
        if (r !== excludeRank && rankCount[r] >= n) return r;
    }
    return -1;
}

/** 查找所有对子 (按 rank 从大到小) */
function findAllPairs(rankCount: Int8Array): number[] {
    const pairs: number[] = [];
    for (let r = 12; r >= 0; r--) {
        if (rankCount[r] === 2) pairs.push(r);
    }
    return pairs;
}

/** 查找最大的 n 个 kicker (排除已用的 rank) */
function findBestKickers(rankCount: Int8Array, excludeRanks: number[], n: number): number[] {
    const kickers: number[] = [];
    for (let r = 12; r >= 0 && kickers.length < n; r--) {
        if (rankCount[r] > 0 && !excludeRanks.includes(r)) {
            kickers.push(r);
        }
    }
    return kickers;
}

/** 将最多 5 个 kicker 编码为单个数字 (15 进制) */
function encodeKickers(kickers: number[]): number {
    let v = 0;
    for (let i = 0; i < kickers.length; i++) {
        v = v * 15 + kickers[i];
    }
    return v;
}

// ============================================
// 导出常量 (供 UI 层使用)
// ============================================

export const HAND_RANK_NAMES: Record<number, string> = {
    [HIGH_CARD]: 'High Card',
    [PAIR]: 'Pair',
    [TWO_PAIR]: 'Two Pair',
    [THREE_KIND]: 'Three of a Kind',
    [STRAIGHT]: 'Straight',
    [FLUSH]: 'Flush',
    [FULL_HOUSE]: 'Full House',
    [FOUR_KIND]: 'Four of a Kind',
    [STRAIGHT_FLUSH]: 'Straight Flush',
};

export function handCategory(value: number): number {
    return Math.floor(value / 1_000_000);
}

export function handCategoryName(value: number): string {
    const cat = handCategory(value);
    return HAND_RANK_NAMES[cat] || 'Unknown';
}
