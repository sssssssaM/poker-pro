// ============================================
// Blocker 分析器 — 纯计算模块
//
// 分析 hero 手牌如何阻挡对手 range 中的 combo
// 全部使用 CardIndex + bitmask, 零字符串操作
// ============================================

import {
    CardIndex, DeckMask,
    fullDeck, removeCard, hasCard,
    cardRank, cardSuit, makeCard
} from './card';
import type { BlockerComboInfo, BlockerResult } from './pro-types';

// 抽象 combo 类型: 对子 / 同花 / 非同花
type ComboType = 'pair' | 'suited' | 'offsuit';

interface ParsedCombo {
    name: string;
    rank1: number;  // 0-12
    rank2: number;  // 0-12
    type: ComboType;
}

const RANK_CHARS = '23456789TJQKA';

/**
 * 分析 hero 手牌对 villain range 的阻挡效应
 *
 * @param heroCards hero 手牌 [card1, card2]
 * @param villainCombos villain range 中的抽象 combo 列表 (如 ["AA", "AKs", "KQo"])
 * @param board 公共牌
 * @returns BlockerResult
 */
export function analyzeBlockers(
    heroCards: [CardIndex, CardIndex],
    villainCombos: string[],
    board: CardIndex[]
): BlockerResult {
    // 构建 dead cards set (board + hero)
    const deadSet = new Set<CardIndex>();
    deadSet.add(heroCards[0]);
    deadSet.add(heroCards[1]);
    for (const c of board) deadSet.add(c);

    // board 作为 dead (不含 hero, 单独算 blocker)
    const boardSet = new Set<CardIndex>(board);

    const details: BlockerComboInfo[] = [];
    let totalRange = 0;
    let totalBlocked = 0;
    let totalRemaining = 0;

    for (const comboStr of villainCombos) {
        const parsed = parseComboString(comboStr);
        if (!parsed) continue;

        // 计算该抽象 combo 不考虑 hero 时的可用组合数 (只去掉 board)
        const totalWithoutHero = countSpecificCombos(parsed, boardSet);
        // 计算考虑 hero 后的可用组合数 (去掉 board + hero)
        const totalWithHero = countSpecificCombos(parsed, deadSet);

        const blocked = totalWithoutHero - totalWithHero;

        details.push({
            combo: comboStr,
            totalCombos: totalWithoutHero,
            blockedCombos: blocked,
            remainingCombos: totalWithHero,
            blockPercent: totalWithoutHero > 0
                ? Math.round((blocked / totalWithoutHero) * 1000) / 10
                : 0
        });

        totalRange += totalWithoutHero;
        totalBlocked += blocked;
        totalRemaining += totalWithHero;
    }

    // 按 blockPercent 从大到小排序
    details.sort((a, b) => b.blockPercent - a.blockPercent);

    return {
        blockerDetails: details,
        totalRangeCombos: totalRange,
        totalBlocked,
        totalRemaining,
        overallBlockPercent: totalRange > 0
            ? Math.round((totalBlocked / totalRange) * 1000) / 10
            : 0
    };
}

/**
 * 解析抽象 combo 字符串
 */
function parseComboString(combo: string): ParsedCombo | null {
    if (combo.length < 2 || combo.length > 3) return null;

    const r1 = RANK_CHARS.indexOf(combo[0]);
    const r2 = RANK_CHARS.indexOf(combo[1]);
    if (r1 === -1 || r2 === -1) return null;

    let type: ComboType;
    if (r1 === r2) {
        type = 'pair';
    } else if (combo.length === 3 && combo[2] === 's') {
        type = 'suited';
    } else {
        type = 'offsuit';
    }

    return { name: combo, rank1: r1, rank2: r2, type };
}

/**
 * 计算一个抽象 combo 在排除 dead cards 后的具体组合数
 */
function countSpecificCombos(parsed: ParsedCombo, deadCards: Set<CardIndex>): number {
    const { rank1, rank2, type } = parsed;
    let count = 0;

    if (type === 'pair') {
        // C(available suits, 2)
        for (let s1 = 0; s1 < 4; s1++) {
            for (let s2 = s1 + 1; s2 < 4; s2++) {
                const c1 = makeCard(rank1, s1);
                const c2 = makeCard(rank1, s2);
                if (!deadCards.has(c1) && !deadCards.has(c2)) {
                    count++;
                }
            }
        }
    } else if (type === 'suited') {
        // 同花: 4 种花色
        for (let s = 0; s < 4; s++) {
            const c1 = makeCard(rank1, s);
            const c2 = makeCard(rank2, s);
            if (!deadCards.has(c1) && !deadCards.has(c2)) {
                count++;
            }
        }
    } else {
        // 非同花: 4 × 4 - 4 (去掉同花) = 12
        for (let s1 = 0; s1 < 4; s1++) {
            for (let s2 = 0; s2 < 4; s2++) {
                if (s1 === s2) continue; // 跳过同花
                const c1 = makeCard(rank1, s1);
                const c2 = makeCard(rank2, s2);
                if (!deadCards.has(c1) && !deadCards.has(c2)) {
                    count++;
                }
            }
        }
    }

    return count;
}
