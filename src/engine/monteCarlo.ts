// ============================================
// 德州扑克专业引擎 — 高性能 Monte Carlo
// ============================================
// 单层 MC, 位掩码冲突, 零堆分配热路径
// 目标: 50K iter < 150ms (桌面)

import type { CardIndex, EncodedHand, RangeEquityResult } from './types';
import { bitLo, bitHi, buildDeck, partialShuffle, deckCard } from './bitmask';
import { evaluate7 } from './evaluator';

/**
 * 🔥 高性能 Range vs Range Monte Carlo 引擎
 *
 * @param heroHands   - 预编码 hero 手牌数组
 * @param villainHands - 预编码 villain 手牌数组 (null = random)
 * @param boardCards  - 公共牌 CardIndex[]
 * @param iterations  - 迭代次数
 * @param onProgress  - 进度回调 (可选)
 * @returns RangeEquityResult
 */
export function runMonteCarlo(
    heroHands: EncodedHand[],
    villainHands: EncodedHand[] | null,
    boardCards: CardIndex[],
    iterations: number,
    onProgress?: (pct: number, w: number, t: number, l: number, sims: number) => void
): RangeEquityResult {
    if (heroHands.length === 0) {
        return _emptyResult();
    }

    // 公共牌位掩码
    let boardLo = 0, boardHi = 0;
    for (const c of boardCards) {
        boardLo |= bitLo(c);
        boardHi |= bitHi(c);
    }
    const cardsNeeded = 5 - boardCards.length;

    // Per-combo 统计
    const comboSet = new Set<string>();
    for (const h of heroHands) comboSet.add(h.combo);
    const comboStats: Record<string, { wins: number; ties: number; total: number }> = {};
    for (const c of comboSet) comboStats[c] = { wins: 0, ties: 0, total: 0 };

    let totalWins = 0, totalTies = 0, totalLosses = 0, validSims = 0;
    const progressInterval = Math.max(1000, Math.floor(iterations / 20));

    // 预分配 7-card 缓冲区
    const hero7 = new Array<number>(7);
    const vill7 = new Array<number>(7);

    const heroLen = heroHands.length;
    const villLen = villainHands ? villainHands.length : 0;

    for (let iter = 0; iter < iterations; iter++) {
        // 1. 随机 hero
        const hero = heroHands[Math.floor(Math.random() * heroLen)];
        if ((hero.lo & boardLo) || (hero.hi & boardHi)) continue;

        let deadLo = hero.lo | boardLo;
        let deadHi = hero.hi | boardHi;

        // 2. 随机 villain
        let vc1: number, vc2: number;

        if (villainHands) {
            const v = villainHands[Math.floor(Math.random() * villLen)];
            if ((v.lo & deadLo) || (v.hi & deadHi)) continue;
            vc1 = v.c1; vc2 = v.c2;
            deadLo |= v.lo; deadHi |= v.hi;
        } else {
            // Random: 从剩余牌组发 2 + board
            const n = buildDeck(deadLo, deadHi);
            if (n < 2 + cardsNeeded) continue;
            partialShuffle(n, 2 + cardsNeeded);
            vc1 = deckCard(0); vc2 = deckCard(1);

            // 构建 7-card arrays
            hero7[0] = hero.c1; hero7[1] = hero.c2;
            vill7[0] = vc1; vill7[1] = vc2;
            for (let b = 0; b < boardCards.length; b++) {
                hero7[2 + b] = boardCards[b];
                vill7[2 + b] = boardCards[b];
            }
            for (let j = 0; j < cardsNeeded; j++) {
                const card = deckCard(2 + j);
                hero7[2 + boardCards.length + j] = card;
                vill7[2 + boardCards.length + j] = card;
            }

            _compareAndRecord(hero7, vill7, hero.combo, comboStats);
            validSims++;
            if (validSims % progressInterval === 0 && onProgress) {
                onProgress((validSims / iterations) * 100, totalWins, totalTies, totalLosses, validSims);
            }
            // 更新 totals
            const s = comboStats[hero.combo];
            totalWins = 0; totalTies = 0; totalLosses = 0;
            for (const c of comboSet) {
                totalWins += comboStats[c].wins;
                totalTies += comboStats[c].ties;
                totalLosses += comboStats[c].total - comboStats[c].wins - comboStats[c].ties;
            }
            continue;
        }

        // 3. 发剩余 board (ranged opponent)
        const n = buildDeck(deadLo, deadHi);
        if (n < cardsNeeded) continue;
        partialShuffle(n, cardsNeeded);

        hero7[0] = hero.c1; hero7[1] = hero.c2;
        vill7[0] = vc1; vill7[1] = vc2;
        for (let b = 0; b < boardCards.length; b++) {
            hero7[2 + b] = boardCards[b];
            vill7[2 + b] = boardCards[b];
        }
        for (let j = 0; j < cardsNeeded; j++) {
            const card = deckCard(j);
            hero7[2 + boardCards.length + j] = card;
            vill7[2 + boardCards.length + j] = card;
        }

        _compareAndRecord(hero7, vill7, hero.combo, comboStats);
        validSims++;

        if (validSims % progressInterval === 0 && onProgress) {
            // 汇总
            totalWins = 0; totalTies = 0; totalLosses = 0;
            for (const c of comboSet) {
                totalWins += comboStats[c].wins;
                totalTies += comboStats[c].ties;
                totalLosses += comboStats[c].total - comboStats[c].wins - comboStats[c].ties;
            }
            onProgress((validSims / iterations) * 100, totalWins, totalTies, totalLosses, validSims);
        }
    }

    // 最终汇总
    totalWins = 0; totalTies = 0; totalLosses = 0;
    for (const c of comboSet) {
        totalWins += comboStats[c].wins;
        totalTies += comboStats[c].ties;
        totalLosses += comboStats[c].total - comboStats[c].wins - comboStats[c].ties;
    }
    const total = totalWins + totalTies + totalLosses;

    // 直方图
    const histogram: { rangeStart: number; rangeEnd: number; count: number }[] = [];
    for (let i = 0; i < 10; i++) {
        histogram.push({ rangeStart: i * 10, rangeEnd: (i + 1) * 10, count: 0 });
    }
    for (const c of comboSet) {
        const s = comboStats[c];
        const eq = s.total > 0 ? (s.wins / s.total) * 100 : 0;
        histogram[Math.min(9, Math.floor(eq / 10))].count++;
    }

    const p1Win = total > 0 ? totalWins / total : 0;
    const p1Tie = total > 0 ? totalTies / total : 0;

    return {
        player1: {
            win: totalWins,
            tie: totalTies,
            equity: p1Win + p1Tie / 2
        },
        player2: {
            win: totalLosses,
            tie: totalTies,
            equity: (total > 0 ? totalLosses / total : 0) + p1Tie / 2
        },
        totalSimulations: total,
        comboStats,
        histogram
    };
}

/** 评估对比 + 记录统计 */
function _compareAndRecord(
    hero7: number[], vill7: number[], combo: string,
    stats: Record<string, { wins: number; ties: number; total: number }>
): void {
    const hs = evaluate7(hero7);
    const vs = evaluate7(vill7);

    const s = stats[combo];
    s.total++;
    if (hs > vs) s.wins++;
    else if (hs === vs) s.ties++;
}

function _emptyResult(): RangeEquityResult {
    return {
        player1: { win: 0, tie: 0, equity: 0 },
        player2: { win: 0, tie: 0, equity: 0 },
        totalSimulations: 0,
        comboStats: {},
        histogram: []
    };
}
