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

// ============================================
// 5. 权重 Range 引擎 (Phase 1 新增)
// ============================================

import { CardIndex, makeCard, DeckMask, hasCard } from './card';

/** 权重 Range: combo → 权重 (0-100) */
export type WeightedRange = Map<HandCombo, number>;

/** 展开后的具体牌组合 (带权重, 使用 CardIndex) */
export interface WeightedCombo {
    card1: CardIndex;
    card2: CardIndex;
    combo: HandCombo;
    weight: number; // 0-100
}

// suit 字符到 index 的映射
const SUIT_INDEX: Record<string, number> = { 'c': 0, 'd': 1, 'h': 2, 's': 3 };

/**
 * 解析权重 Range 字符串
 * 支持: "AA:80, AKs:60+, JJ+, 22-55:50"
 * 冒号后面的数字是权重 (0-100)，不指定则默认 100
 */
export function parseWeightedRange(rangeStr: string): WeightedRange {
    const result: WeightedRange = new Map();
    if (!rangeStr || rangeStr.trim() === '') return result;

    const tokens = rangeStr
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

    for (const token of tokens) {
        // 分离权重后缀: "AA:80" → ["AA", "80"]
        // 也可能是 "JJ+:60" 或 "22-55:50"
        let comboStr = token;
        let weight = 100;

        const colonIdx = token.lastIndexOf(':');
        if (colonIdx > 0) {
            const weightStr = token.slice(colonIdx + 1);
            const parsed = parseInt(weightStr);
            if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
                weight = parsed;
                comboStr = token.slice(0, colonIdx);
            }
        }

        // 用旧解析器展开 combo
        const expanded = parseRangeString(comboStr);
        for (const combo of expanded) {
            // 如果已存在，取较大的权重
            const existing = result.get(combo);
            if (existing === undefined || weight > existing) {
                result.set(combo, weight);
            }
        }
    }

    return result;
}

/**
 * 将 WeightedRange 展开为具体的 CardIndex 牌组合
 * 排除 deadCards (已在公共牌中的牌)
 */
export function expandWeightedCombos(
    range: WeightedRange,
    deadMask?: DeckMask
): WeightedCombo[] {
    const results: WeightedCombo[] = [];

    for (const [combo, weight] of range) {
        if (weight <= 0) continue;

        if (combo.length === 2 && combo[0] === combo[1]) {
            // 对子: 6 combos
            const rankIdx = RANK_ORDER.indexOf(combo[0] as Rank);
            const r = 12 - rankIdx; // 转为 card.ts 的 rank (0=2, 12=A)
            for (let s1 = 0; s1 < 4; s1++) {
                for (let s2 = s1 + 1; s2 < 4; s2++) {
                    const c1 = makeCard(r, s1);
                    const c2 = makeCard(r, s2);
                    if (deadMask && (!hasCard(deadMask, c1) || !hasCard(deadMask, c2))) continue;
                    if (!deadMask) {
                        results.push({ card1: c1, card2: c2, combo, weight });
                    } else {
                        results.push({ card1: c1, card2: c2, combo, weight });
                    }
                }
            }
        } else if (combo.length === 3 && combo[2] === 's') {
            // 同花: 4 combos
            const r1 = 12 - RANK_ORDER.indexOf(combo[0] as Rank);
            const r2 = 12 - RANK_ORDER.indexOf(combo[1] as Rank);
            for (let s = 0; s < 4; s++) {
                const c1 = makeCard(r1, s);
                const c2 = makeCard(r2, s);
                if (deadMask && (!hasCard(deadMask, c1) || !hasCard(deadMask, c2))) continue;
                results.push({ card1: c1, card2: c2, combo, weight });
            }
        } else if (combo.length === 3 && combo[2] === 'o') {
            // 非同花: 12 combos
            const r1 = 12 - RANK_ORDER.indexOf(combo[0] as Rank);
            const r2 = 12 - RANK_ORDER.indexOf(combo[1] as Rank);
            for (let s1 = 0; s1 < 4; s1++) {
                for (let s2 = 0; s2 < 4; s2++) {
                    if (s1 === s2) continue;
                    const c1 = makeCard(r1, s1);
                    const c2 = makeCard(r2, s2);
                    if (deadMask && (!hasCard(deadMask, c1) || !hasCard(deadMask, c2))) continue;
                    results.push({ card1: c1, card2: c2, combo, weight });
                }
            }
        }
    }

    return results;
}

/**
 * 从展开的 combos 中按权重概率采样一个可用的 combo
 * 使用 rejection sampling: 随机选一个 combo, 然后以 weight/100 的概率接受
 * @param combos 展开的 combo 列表
 * @param deck 当前可用牌 (bitmask)
 * @returns 选中的 combo, 或 null 如果所有 combo 都被 block
 */
export function sampleWeightedCombo(
    combos: WeightedCombo[],
    deck: DeckMask
): WeightedCombo | null {
    if (combos.length === 0) return null;

    // 先过滤出可用的 combos
    const available: WeightedCombo[] = [];
    for (const c of combos) {
        if (hasCard(deck, c.card1) && hasCard(deck, c.card2)) {
            available.push(c);
        }
    }

    if (available.length === 0) return null;

    // Rejection sampling (最多尝试 100 次)
    for (let attempt = 0; attempt < 100; attempt++) {
        const idx = Math.floor(Math.random() * available.length);
        const candidate = available[idx];

        // 权重 100 直接接受, 否则按概率
        if (candidate.weight >= 100 || Math.random() * 100 < candidate.weight) {
            return candidate;
        }
    }

    // Fallback: 直接返回随机一个 (忽略权重)
    return available[Math.floor(Math.random() * available.length)];
}

/**
 * 将 WeightedRange 压缩为字符串 (带权重)
 */
export function weightedRangeToString(range: WeightedRange): string {
    if (range.size === 0) return '';

    const parts: string[] = [];
    for (const [combo, weight] of range) {
        if (weight >= 100) {
            parts.push(combo);
        } else {
            parts.push(`${combo}:${weight}`);
        }
    }
    return parts.join(', ');
}
