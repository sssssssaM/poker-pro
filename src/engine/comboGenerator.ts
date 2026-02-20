// ============================================
// 德州扑克专业引擎 — Combo 生成器
// ============================================
// 将 "AA", "AKs", "AKo" 展开为所有具体牌组合

import type { EncodedHand } from './types';
import { RANK_MAP } from './card';
import { bitLo, bitHi } from './bitmask';

/**
 * 展开一个 combo 字符串为所有具体 EncodedHand
 *
 * "AA"  → 6 hands (C(4,2) pocket pairs)
 * "AKs" → 4 hands (4 suits)
 * "AKo" → 12 hands (4*3 offsuit)
 */
export function expandCombo(combo: string): EncodedHand[] {
    const hands: EncodedHand[] = [];
    const r1 = RANK_MAP[combo[0]];
    if (r1 === undefined) return [];

    if (combo.length === 2 && combo[0] === combo[1]) {
        // Pocket pair
        for (let s1 = 0; s1 < 4; s1++) {
            for (let s2 = s1 + 1; s2 < 4; s2++) {
                const c1 = r1 * 4 + s1, c2 = r1 * 4 + s2;
                hands.push({
                    c1, c2,
                    lo: bitLo(c1) | bitLo(c2),
                    hi: bitHi(c1) | bitHi(c2),
                    combo
                });
            }
        }
        return hands;
    }

    const r2 = RANK_MAP[combo[1]];
    if (r2 === undefined) return [];

    if (combo.length === 3 && combo[2] === 's') {
        // Suited
        for (let s = 0; s < 4; s++) {
            const c1 = r1 * 4 + s, c2 = r2 * 4 + s;
            hands.push({
                c1, c2,
                lo: bitLo(c1) | bitLo(c2),
                hi: bitHi(c1) | bitHi(c2),
                combo
            });
        }
    } else {
        // Offsuit (including 2-char non-pair without suffix)
        for (let s1 = 0; s1 < 4; s1++) {
            for (let s2 = 0; s2 < 4; s2++) {
                if (s1 !== s2) {
                    const c1 = r1 * 4 + s1, c2 = r2 * 4 + s2;
                    hands.push({
                        c1, c2,
                        lo: bitLo(c1) | bitLo(c2),
                        hi: bitHi(c1) | bitHi(c2),
                        combo
                    });
                }
            }
        }
    }

    return hands;
}

/**
 * 批量展开多个 combo → 合并 EncodedHand[]
 */
export function expandCombos(combos: string[]): EncodedHand[] {
    const all: EncodedHand[] = [];
    for (const c of combos) {
        const expanded = expandCombo(c);
        for (const h of expanded) all.push(h);
    }
    return all;
}
