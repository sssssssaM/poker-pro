// ============================================
// Range Parser — 标准扑克 Range 语法解析器
// 支持: "JJ+", "AQs+", "ATo-AJo", "22-55", 逗号分隔
// ============================================

import { Card, Suit, Rank, HandCombo, RANKS, SUITS } from './pro-types';

// 点数排序（从高到低的索引）
const RANK_ORDER: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

function rankIndex(r: Rank): number {
    return RANK_ORDER.indexOf(r);
}

// ============================================
// 1. parseRangeString — 解析 Range 字符串
// ============================================

/**
 * 解析标准 Range 语法字符串，返回 combo 集合
 *
 * 支持的语法：
 * - "AA", "AKs", "AKo"           — 单个 combo
 * - "JJ+"                         — 对子向上 (JJ, QQ, KK, AA)
 * - "ATs+"                        — 同花向上 (ATs, AJs, AQs, AKs)
 * - "KTo+"                        — 非同花向上 (KTo, KJo, KQo)
 * - "22-55"                       — 对子区间
 * - "A2s-A5s"                     — 同花/非同花区间
 * - 逗号分隔多组: "AA, KK, AKs+"
 */
export function parseRangeString(rangeStr: string): Set<HandCombo> {
    const result = new Set<HandCombo>();
    if (!rangeStr || rangeStr.trim() === '') return result;

    const tokens = rangeStr
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

    for (const token of tokens) {
        const combos = parseToken(token);
        for (const c of combos) {
            result.add(c);
        }
    }

    return result;
}

function parseToken(token: string): HandCombo[] {
    // 区间: "22-55", "A2s-A5s", "ATo-AJo"
    if (token.includes('-')) {
        const [start, end] = token.split('-').map(s => s.trim());
        return expandRange(start, end);
    }

    // 向上: "JJ+", "ATs+", "KTo+"
    if (token.endsWith('+')) {
        const base = token.slice(0, -1);
        return expandPlus(base);
    }

    // 单个 combo: "AA", "AKs", "AKo"
    if (isValidCombo(token)) {
        return [token];
    }

    return [];
}

function isValidCombo(combo: string): boolean {
    if (combo.length === 2) {
        // 对子: "AA", "KK"
        return RANK_ORDER.includes(combo[0] as Rank) && combo[0] === combo[1];
    }
    if (combo.length === 3) {
        // 同花/非同花: "AKs", "AKo"
        return (
            RANK_ORDER.includes(combo[0] as Rank) &&
            RANK_ORDER.includes(combo[1] as Rank) &&
            (combo[2] === 's' || combo[2] === 'o') &&
            combo[0] !== combo[1]
        );
    }
    return false;
}

/**
 * 展开 "+" 语法
 * - 对子 "JJ+" → JJ, QQ, KK, AA
 * - 同花 "ATs+" → ATs, AJs, AQs, AKs (第二张牌向上)
 * - 非同花 "KTo+" → KTo, KJo, KQo (第二张牌向上)
 */
function expandPlus(base: string): HandCombo[] {
    const results: HandCombo[] = [];

    if (base.length === 2 && base[0] === base[1]) {
        // 对子向上: "JJ+" → JJ, QQ, KK, AA
        const startIdx = rankIndex(base[0] as Rank);
        for (let i = startIdx; i >= 0; i--) {
            results.push(`${RANK_ORDER[i]}${RANK_ORDER[i]}`);
        }
    } else if (base.length === 3) {
        const rank1 = base[0] as Rank;
        const rank2 = base[1] as Rank;
        const suffix = base[2]; // 's' or 'o'
        const idx1 = rankIndex(rank1);
        const idx2 = rankIndex(rank2);

        // 第二张牌向上（index 减小 = 牌变大），但不超过第一张牌
        for (let i = idx2; i > idx1; i--) {
            results.push(`${rank1}${RANK_ORDER[i]}${suffix}`);
        }
    }

    return results;
}

/**
 * 展开区间语法
 * - "22-55" → 22, 33, 44, 55
 * - "A2s-A5s" → A2s, A3s, A4s, A5s
 */
function expandRange(startStr: string, endStr: string): HandCombo[] {
    const results: HandCombo[] = [];

    // 对子区间: "22-55"
    if (startStr.length === 2 && startStr[0] === startStr[1] && endStr.length === 2 && endStr[0] === endStr[1]) {
        const startIdx = rankIndex(startStr[0] as Rank);
        const endIdx = rankIndex(endStr[0] as Rank);
        const lo = Math.max(startIdx, endIdx);
        const hi = Math.min(startIdx, endIdx);
        for (let i = lo; i >= hi; i--) {
            results.push(`${RANK_ORDER[i]}${RANK_ORDER[i]}`);
        }
        return results;
    }

    // 同花/非同花区间: "A2s-A5s" or "ATo-AJo"
    if (startStr.length === 3 && endStr.length === 3 && startStr[0] === endStr[0] && startStr[2] === endStr[2]) {
        const rank1 = startStr[0] as Rank;
        const suffix = startStr[2];
        const startIdx = rankIndex(startStr[1] as Rank);
        const endIdx = rankIndex(endStr[1] as Rank);
        const lo = Math.max(startIdx, endIdx);
        const hi = Math.min(startIdx, endIdx);
        for (let i = lo; i >= hi; i--) {
            if (RANK_ORDER[i] !== rank1) {
                results.push(`${rank1}${RANK_ORDER[i]}${suffix}`);
            }
        }
        return results;
    }

    // 无法解析的区间，尝试当作独立 combo
    if (isValidCombo(startStr)) results.push(startStr);
    if (isValidCombo(endStr)) results.push(endStr);
    return results;
}

// ============================================
// 2. expandToSpecificCombos — 展开为具体牌组合
// ============================================

export interface SpecificCombo {
    card1: Card;
    card2: Card;
    comboName: HandCombo;
}

/**
 * 将抽象 combo（如 "AA", "AKs"）展开为具体的花色组合
 * - AA → 6 个具体组合 (AsAh, AsAd, AsAc, AhAd, AhAc, AdAc)
 * - AKs → 4 个具体组合 (AsKs, AhKh, AdKd, AcKc)
 * - AKo → 12 个具体组合
 *
 * @param deadCards 已被占用的牌（公共牌等），这些牌的组合会被排除
 */
export function expandToSpecificCombos(combos: Iterable<HandCombo>, deadCards: Card[] = []): SpecificCombo[] {
    const results: SpecificCombo[] = [];
    const deadSet = new Set(deadCards.map(c => `${c.rank}${c.suit}`));

    for (const combo of combos) {
        if (combo.length === 2 && combo[0] === combo[1]) {
            // 对子: 6 combos (C(4,2) = 6)
            const rank = combo[0] as Rank;
            for (let i = 0; i < SUITS.length; i++) {
                for (let j = i + 1; j < SUITS.length; j++) {
                    if (!deadSet.has(`${rank}${SUITS[i]}`) && !deadSet.has(`${rank}${SUITS[j]}`)) {
                        results.push({
                            card1: { rank, suit: SUITS[i] },
                            card2: { rank, suit: SUITS[j] },
                            comboName: combo
                        });
                    }
                }
            }
        } else if (combo.length === 3 && combo[2] === 's') {
            // 同花: 4 combos
            const rank1 = combo[0] as Rank;
            const rank2 = combo[1] as Rank;
            for (const suit of SUITS) {
                if (!deadSet.has(`${rank1}${suit}`) && !deadSet.has(`${rank2}${suit}`)) {
                    results.push({
                        card1: { rank: rank1, suit },
                        card2: { rank: rank2, suit },
                        comboName: combo
                    });
                }
            }
        } else if (combo.length === 3 && combo[2] === 'o') {
            // 非同花: 12 combos
            const rank1 = combo[0] as Rank;
            const rank2 = combo[1] as Rank;
            for (const suit1 of SUITS) {
                for (const suit2 of SUITS) {
                    if (suit1 !== suit2 && !deadSet.has(`${rank1}${suit1}`) && !deadSet.has(`${rank2}${suit2}`)) {
                        results.push({
                            card1: { rank: rank1, suit: suit1 },
                            card2: { rank: rank2, suit: suit2 },
                            comboName: combo
                        });
                    }
                }
            }
        }
    }

    return results;
}

// ============================================
// 3. comboSetToString — 压缩回 Range 字符串
// ============================================

/**
 * 将 combo 集合压缩为标准 Range 字符串
 * 优先使用 "+" 和 "-" 语法压缩
 */
export function comboSetToString(combos: Set<HandCombo>): string {
    if (combos.size === 0) return '';

    const pairs: HandCombo[] = [];
    const suited: HandCombo[] = [];
    const offsuit: HandCombo[] = [];

    for (const combo of combos) {
        if (combo.length === 2) pairs.push(combo);
        else if (combo.endsWith('s')) suited.push(combo);
        else if (combo.endsWith('o')) offsuit.push(combo);
    }

    const parts: string[] = [];

    // 压缩对子
    parts.push(...compressPairs(pairs));

    // 压缩同花
    parts.push(...compressNonPairs(suited, 's'));

    // 压缩非同花
    parts.push(...compressNonPairs(offsuit, 'o'));

    return parts.join(', ');
}

function compressPairs(pairs: HandCombo[]): string[] {
    if (pairs.length === 0) return [];

    const indices = pairs
        .map(p => rankIndex(p[0] as Rank))
        .sort((a, b) => a - b);

    const results: string[] = [];
    let i = 0;
    while (i < indices.length) {
        let j = i;
        while (j + 1 < indices.length && indices[j + 1] === indices[j] + 1) {
            j++;
        }

        if (indices[i] === 0) {
            // 包含 AA
            if (j > i) {
                // 连续到 AA: 用 "+"
                results.push(`${RANK_ORDER[indices[j]]}${RANK_ORDER[indices[j]]}+`);
            } else {
                results.push('AA');
            }
        } else if (j > i) {
            // 连续区间
            const hi = `${RANK_ORDER[indices[i]]}${RANK_ORDER[indices[i]]}`;
            const lo = `${RANK_ORDER[indices[j]]}${RANK_ORDER[indices[j]]}`;
            results.push(`${lo}-${hi}`);
        } else {
            results.push(`${RANK_ORDER[indices[i]]}${RANK_ORDER[indices[i]]}`);
        }

        i = j + 1;
    }

    return results;
}

function compressNonPairs(combos: HandCombo[], suffix: string): string[] {
    if (combos.length === 0) return [];

    // 按第一张牌分组
    const groups = new Map<Rank, Rank[]>();
    for (const combo of combos) {
        const rank1 = combo[0] as Rank;
        const rank2 = combo[1] as Rank;
        if (!groups.has(rank1)) groups.set(rank1, []);
        groups.get(rank1)!.push(rank2);
    }

    const results: string[] = [];

    for (const [rank1, rank2List] of groups) {
        const idx1 = rankIndex(rank1);
        const indices = rank2List.map(r => rankIndex(r)).sort((a, b) => a - b);

        let i = 0;
        while (i < indices.length) {
            let j = i;
            while (j + 1 < indices.length && indices[j + 1] === indices[j] + 1) {
                j++;
            }

            if (indices[i] === idx1 + 1) {
                // 紧邻第一张牌 = 最高可选 = 用 "+"
                if (j > i) {
                    results.push(`${rank1}${RANK_ORDER[indices[j]]}${suffix}+`);
                } else {
                    results.push(`${rank1}${RANK_ORDER[indices[i]]}${suffix}`);
                }
            } else if (j > i) {
                const hi = `${rank1}${RANK_ORDER[indices[i]]}${suffix}`;
                const lo = `${rank1}${RANK_ORDER[indices[j]]}${suffix}`;
                results.push(`${lo}-${hi}`);
            } else {
                results.push(`${rank1}${RANK_ORDER[indices[i]]}${suffix}`);
            }

            i = j + 1;
        }
    }

    return results;
}

// ============================================
// 4. countCombos — 计算统计信息
// ============================================

/**
 * 计算 combo 集的具体组合数量和占 1326 总组合的百分比
 */
export function countCombos(combos: Iterable<HandCombo>, deadCards: Card[] = []): { count: number; percentage: number } {
    const specific = expandToSpecificCombos(combos, deadCards);
    const count = specific.length;
    const percentage = (count / 1326) * 100;
    return { count, percentage: Math.round(percentage * 10) / 10 };
}

/**
 * 计算所有 169 个抽象 combo 对应的具体组合数
 */
export function comboSpecificCount(combo: HandCombo): number {
    if (combo.length === 2 && combo[0] === combo[1]) return 6;  // 对子
    if (combo.endsWith('s')) return 4;  // 同花
    if (combo.endsWith('o')) return 12; // 非同花
    return 0;
}
