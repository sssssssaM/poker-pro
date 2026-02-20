// ============================================
// 德州扑克专业引擎 — Range 解析器
// ============================================
// 支持: AA, AKs, AKo, QQ+, AJs+, 76s, 98o
// 输出: EncodedHand[] (预编码位掩码)

import type { EncodedHand } from './types';
import { RANK_CHARS, RANK_MAP } from './card';
import { expandCombo } from './comboGenerator';

/** rank 降序: A=12, K=11, ..., 2=0 */
const RANKS_DESC = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

/**
 * 解析 Range 字符串为 EncodedHand[]
 *
 * 输入格式:
 *   - 逗号分隔: "AA,AKs,QQ+"
 *   - 单个 combo: "AKs"
 *   - + 表示更高: "QQ+" → QQ,KK,AA
 *   - + 表示更高: "AJs+" → AJs,AQs,AKs
 *
 * @returns 去重后的 EncodedHand[]
 */
export function parseRange(rangeStr: string): EncodedHand[] {
    if (!rangeStr || !rangeStr.trim()) return [];

    const parts = rangeStr.split(',').map(s => s.trim()).filter(Boolean);
    const combos = new Set<string>();

    for (const part of parts) {
        const expanded = expandRangeToken(part);
        for (const c of expanded) combos.add(c);
    }

    // 展开为具体手牌
    const all: EncodedHand[] = [];
    for (const combo of combos) {
        const hands = expandCombo(combo);
        for (const h of hands) all.push(h);
    }
    return all;
}

/**
 * 解析 combo 字符串数组为 EncodedHand[]
 */
export function parseRangeFromCombos(combos: string[]): EncodedHand[] {
    const all: EncodedHand[] = [];
    const seen = new Set<string>();
    for (const combo of combos) {
        if (seen.has(combo)) continue;
        seen.add(combo);
        const hands = expandCombo(combo);
        for (const h of hands) all.push(h);
    }
    return all;
}

/**
 * 展开单个 range token
 * "QQ+" → ["QQ","KK","AA"]
 * "AJs+" → ["AJs","AQs","AKs"]
 * "AKo" → ["AKo"]
 */
function expandRangeToken(token: string): string[] {
    const hasPlus = token.endsWith('+');
    const base = hasPlus ? token.slice(0, -1) : token;

    if (!hasPlus) return [base];

    const r1 = RANK_MAP[base[0]];
    const r2 = RANK_MAP[base[1]];
    if (r1 === undefined || r2 === undefined) return [base];

    const combos: string[] = [];

    if (r1 === r2) {
        // Pocket pair+: QQ+ → QQ,KK,AA
        for (let r = r1; r <= 12; r++) {
            combos.push(RANK_CHARS[r] + RANK_CHARS[r]);
        }
    } else {
        // Unpaired+: AJs+ → AJs, AQs, AKs
        const suffix = base.length >= 3 ? base[2] : 'o';
        const highRank = Math.max(r1, r2);
        const lowRank = Math.min(r1, r2);
        const highChar = RANK_CHARS[highRank];

        // + 表示 low rank 向上走到 highRank - 1
        for (let r = lowRank; r < highRank; r++) {
            combos.push(highChar + RANK_CHARS[r] + suffix);
        }
    }

    return combos;
}

/**
 * 预定义对手类型
 */
export const OPPONENT_RANGES: Record<string, string[]> = {
    random: [],
    tight: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', 'AKs', 'AQs', 'AJs', 'ATs', 'AKo', 'AQo', 'KQs', 'KJs', 'QJs', 'JTs'],
    loose: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55',
        'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
        'KQs', 'KJs', 'KTs', 'K9s', 'QJs', 'QTs', 'JTs', 'T9s', '98s',
        'AKo', 'AQo', 'AJo', 'ATo', 'A9o', 'KQo', 'KJo', 'QJo', 'JTo'],
    passive: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66',
        'AKs', 'AQs', 'AJs', 'ATs', 'KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs', 'T9s', '98s',
        'AKo', 'AQo', 'AJo', 'ATo', 'KQo', 'KJo', 'QJo'],
    nit: ['AA', 'KK', 'QQ', 'AKs', 'AKo'],
};
