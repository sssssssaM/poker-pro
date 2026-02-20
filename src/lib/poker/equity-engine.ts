// ============================================
// Equity Engine — UI-Agnostic 纯计算模块
//
// 混合策略:
//   River (5 board): 精确枚举 (~990 opponent combos)
//   Turn  (4 board): 精确枚举 (~45 rivers × ~990 opponents)
//   Flop/Preflop:    Monte Carlo
//
// 全部基于 CardIndex + DeckMask, 零字符串操作
// ============================================

import {
    CardIndex, DeckMask,
    fullDeck, cloneDeck, hasCard, removeCard, drawRandom, popCount,
    makeCard, cardRank, deckToArray
} from './card';
import { evaluate7 } from './evaluator';

// ============================================
// Public Types (Data Contract)
// ============================================

/** 单个 combo 的权重信息 */
export interface ComboInput {
    card1: CardIndex;
    card2: CardIndex;
    combo: string;    // 抽象名 "AKs"
    weight: number;   // 0-100
}

/** 引擎输入 */
export interface EquityInput {
    /** 玩家手牌 (固定模式, 2 张) */
    heroCards?: [CardIndex, CardIndex];
    /** 玩家 Range (Range 模式) */
    heroRange?: ComboInput[];
    /** 对手 Range (预展开的 combo 列表). null = 随机 */
    villainRange?: ComboInput[] | null;
    /** 公共牌 (0-5 张) */
    board: CardIndex[];
    /** MC 迭代数 (仅 MC 模式使用) */
    iterations: number;
    /** 对手数量 (默认 1) */
    villainCount?: number;
}

/** 单个 combo 的拆分结果 */
export interface ComboBreakdown {
    combo: string;
    equity: number;   // 0-100 百分比
    wins: number;
    ties: number;
    total: number;
}

/** Equity 分布直方图桶 */
export interface HistogramBucket {
    rangeStart: number; // 百分比, 如 0
    rangeEnd: number;   // 百分比, 如 10
    count: number;      // 落入该区间的 combo 数量
}

/** 引擎输出 (结构化结果) */
export interface EquityOutput {
    winPercent: number;
    tiePercent: number;
    losePercent: number;
    comboBreakdown: ComboBreakdown[];
    equityDistributionHistogram: HistogramBucket[];
    runtimeMs: number;
    strategy: 'exact-river' | 'exact-turn' | 'monte-carlo';
    totalSimulations: number;
}

// ============================================
// Main Entry Point
// ============================================

/**
 * 计算 Equity — 自动选择最优策略
 */
export function calculateEquity(input: EquityInput): EquityOutput {
    const t0 = performance.now();
    const boardLen = input.board.length;
    const villainCount = input.villainCount ?? 1;
    const isRangeMode = !!(input.heroRange && input.heroRange.length > 0);

    let result: EquityOutput;

    // 策略选择
    if (boardLen === 5 && villainCount === 1 && !isRangeMode && input.heroCards) {
        // River + HU + 固定手牌 → 精确枚举
        result = exactRiver(input);
    } else if (boardLen === 4 && villainCount === 1 && !isRangeMode && input.heroCards) {
        // Turn + HU + 固定手牌 → 精确枚举
        result = exactTurn(input);
    } else {
        // 其他情况 → Monte Carlo
        result = monteCarlo(input);
    }

    result.runtimeMs = Math.round((performance.now() - t0) * 100) / 100;
    return result;
}

// ============================================
// Strategy 1: Exact River Enumeration
// ============================================

function exactRiver(input: EquityInput): EquityOutput {
    const hero = input.heroCards!;
    const board = input.board;
    const villainRange = input.villainRange;

    // 构建 dead cards mask
    const dead = fullDeck();
    for (const c of board) removeCard(dead, c);
    removeCard(dead, hero[0]);
    removeCard(dead, hero[1]);

    // 计算 hero 手牌值 (固定)
    const heroCards7 = [hero[0], hero[1], ...board];
    const heroValue = evaluate7(heroCards7);

    let wins = 0, ties = 0, losses = 0;
    const comboStats: Map<string, { wins: number; ties: number; total: number }> = new Map();

    if (villainRange && villainRange.length > 0) {
        // 枚举 villain range 中可用的 combos
        for (const vc of villainRange) {
            if (!hasCard(dead, vc.card1) || !hasCard(dead, vc.card2)) continue;

            const vCards7 = [vc.card1, vc.card2, ...board];
            const vValue = evaluate7(vCards7);

            const stat = getOrCreate(comboStats, vc.combo);
            stat.total++;

            if (heroValue > vValue) { wins++; stat.wins++; }
            else if (heroValue === vValue) { ties++; stat.ties++; }
            else { losses++; }
        }
    } else {
        // 随机对手: 枚举所有可能的两张牌
        const available = deckToArray(dead);
        for (let i = 0; i < available.length; i++) {
            for (let j = i + 1; j < available.length; j++) {
                const vCards7 = [available[i], available[j], ...board];
                const vValue = evaluate7(vCards7);

                if (heroValue > vValue) wins++;
                else if (heroValue === vValue) ties++;
                else losses++;
            }
        }
    }

    const total = wins + ties + losses;
    return buildOutput(wins, ties, losses, total, comboStats, 'exact-river');
}

// ============================================
// Strategy 2: Exact Turn Enumeration
// ============================================

function exactTurn(input: EquityInput): EquityOutput {
    const hero = input.heroCards!;
    const board = input.board; // 4 cards
    const villainRange = input.villainRange;

    // Dead mask (去掉 board + hero)
    const baseDead = fullDeck();
    for (const c of board) removeCard(baseDead, c);
    removeCard(baseDead, hero[0]);
    removeCard(baseDead, hero[1]);

    let wins = 0, ties = 0, losses = 0;
    const comboStats: Map<string, { wins: number; ties: number; total: number }> = new Map();

    // 枚举所有可能的 river card
    const remainingCards = deckToArray(baseDead);

    for (const riverCard of remainingCards) {
        const board5 = [...board, riverCard];
        const heroCards7 = [hero[0], hero[1], ...board5];
        const heroValue = evaluate7(heroCards7);

        if (villainRange && villainRange.length > 0) {
            for (const vc of villainRange) {
                if (vc.card1 === riverCard || vc.card2 === riverCard) continue;
                if (!hasCard(baseDead, vc.card1) || !hasCard(baseDead, vc.card2)) continue;

                const vCards7 = [vc.card1, vc.card2, ...board5];
                const vValue = evaluate7(vCards7);

                const stat = getOrCreate(comboStats, vc.combo);
                stat.total++;

                if (heroValue > vValue) { wins++; stat.wins++; }
                else if (heroValue === vValue) { ties++; stat.ties++; }
                else { losses++; }
            }
        } else {
            // 随机对手
            for (let i = 0; i < remainingCards.length; i++) {
                if (remainingCards[i] === riverCard) continue;
                for (let j = i + 1; j < remainingCards.length; j++) {
                    if (remainingCards[j] === riverCard) continue;

                    const vCards7 = [remainingCards[i], remainingCards[j], ...board5];
                    const vValue = evaluate7(vCards7);

                    if (heroValue > vValue) wins++;
                    else if (heroValue === vValue) ties++;
                    else losses++;
                }
            }
        }
    }

    const total = wins + ties + losses;
    return buildOutput(wins, ties, losses, total, comboStats, 'exact-turn');
}

// ============================================
// Strategy 3: Monte Carlo
// ============================================

function monteCarlo(input: EquityInput): EquityOutput {
    const iterations = input.iterations;
    const board = input.board;
    const villainCount = input.villainCount ?? 1;
    const isRangeMode = !!(input.heroRange && input.heroRange.length > 0);
    const heroRange = input.heroRange;
    const heroFixed = input.heroCards;
    const villainRange = input.villainRange;

    let wins = 0, ties = 0, losses = 0;
    const comboStats: Map<string, { wins: number; ties: number; total: number }> = new Map();
    let deadlockCounter = 0;

    for (let i = 0; i < iterations; i++) {
        // 初始化 deck
        const deck: DeckMask = fullDeck();
        for (const c of board) removeCard(deck, c);

        // Step A: Hero 手牌
        let heroCards: [CardIndex, CardIndex];
        let heroCombo: string | null = null;

        if (isRangeMode && heroRange) {
            const sampled = sampleCombo(heroRange, deck);
            if (!sampled) {
                deadlockCounter++;
                if (deadlockCounter > 50) {
                    const c1 = drawRandom(deck);
                    const c2 = drawRandom(deck);
                    if (c1 < 0 || c2 < 0) continue;
                    heroCards = [c1, c2];
                } else { i--; continue; }
            } else {
                deadlockCounter = 0;
                heroCards = [sampled.card1, sampled.card2];
                heroCombo = sampled.combo;
                removeCard(deck, sampled.card1);
                removeCard(deck, sampled.card2);
            }
        } else if (heroFixed) {
            heroCards = heroFixed;
            removeCard(deck, heroFixed[0]);
            removeCard(deck, heroFixed[1]);
        } else {
            continue; // 无效输入
        }

        // Step B: Villain 手牌
        const villainHands: [CardIndex, CardIndex][] = [];
        let valid = true;

        for (let j = 0; j < villainCount; j++) {
            if (villainRange && villainRange.length > 0) {
                const sampled = sampleCombo(villainRange, deck);
                if (!sampled) { valid = false; break; }
                villainHands.push([sampled.card1, sampled.card2]);
                removeCard(deck, sampled.card1);
                removeCard(deck, sampled.card2);
            } else {
                const c1 = drawRandom(deck);
                const c2 = drawRandom(deck);
                if (c1 < 0 || c2 < 0) { valid = false; break; }
                villainHands.push([c1, c2]);
            }
        }

        if (!valid) {
            deadlockCounter++;
            if (deadlockCounter > 50) deadlockCounter = 0;
            else { i--; continue; }
        }
        deadlockCounter = 0;

        // Step C: 补全 board
        const runout: CardIndex[] = [];
        for (let k = board.length; k < 5; k++) {
            const c = drawRandom(deck);
            if (c < 0) break;
            runout.push(c);
        }
        const fullBoard = board.concat(runout);
        if (fullBoard.length < 5) continue;

        // Step D: 评估
        const heroValue = evaluate7([heroCards[0], heroCards[1], ...fullBoard]);
        let bestVillain = -1;
        for (const vh of villainHands) {
            const v = evaluate7([vh[0], vh[1], ...fullBoard]);
            if (v > bestVillain) bestVillain = v;
        }

        if (heroValue > bestVillain) {
            wins++;
            if (heroCombo) { const s = getOrCreate(comboStats, heroCombo); s.wins++; s.total++; }
        } else if (heroValue === bestVillain) {
            ties++;
            if (heroCombo) { const s = getOrCreate(comboStats, heroCombo); s.wins += 0.5; s.ties++; s.total++; }
        } else {
            losses++;
            if (heroCombo) { const s = getOrCreate(comboStats, heroCombo); s.total++; }
        }
    }

    const total = wins + ties + losses;
    return buildOutput(wins, ties, losses, total, comboStats, 'monte-carlo');
}

// ============================================
// Shared Helpers
// ============================================

function sampleCombo(combos: ComboInput[], deck: DeckMask): ComboInput | null {
    // 过滤可用的
    const avail: ComboInput[] = [];
    for (const c of combos) {
        if (hasCard(deck, c.card1) && hasCard(deck, c.card2)) avail.push(c);
    }
    if (avail.length === 0) return null;

    // Rejection sampling (权重)
    for (let attempt = 0; attempt < 50; attempt++) {
        const c = avail[Math.floor(Math.random() * avail.length)];
        if (c.weight >= 100 || Math.random() * 100 < c.weight) return c;
    }
    return avail[Math.floor(Math.random() * avail.length)];
}

function getOrCreate(map: Map<string, { wins: number; ties: number; total: number }>, key: string) {
    let v = map.get(key);
    if (!v) { v = { wins: 0, ties: 0, total: 0 }; map.set(key, v); }
    return v;
}

function buildOutput(
    wins: number, ties: number, losses: number, total: number,
    comboStats: Map<string, { wins: number; ties: number; total: number }>,
    strategy: EquityOutput['strategy']
): EquityOutput {
    const winPct = total > 0 ? (wins / total) * 100 : 0;
    const tiePct = total > 0 ? (ties / total) * 100 : 0;
    const losePct = total > 0 ? (losses / total) * 100 : 0;

    // combo breakdown
    const comboBreakdown: ComboBreakdown[] = [];
    for (const [combo, stat] of comboStats) {
        const equity = stat.total > 0 ? ((stat.wins + stat.ties * 0.5) / stat.total) * 100 : 0;
        comboBreakdown.push({
            combo,
            equity: Math.round(equity * 10) / 10,
            wins: stat.wins,
            ties: stat.ties,
            total: stat.total
        });
    }
    comboBreakdown.sort((a, b) => b.equity - a.equity);

    // histogram (10 buckets: 0-10, 10-20, ... 90-100)
    const buckets: HistogramBucket[] = [];
    for (let i = 0; i < 10; i++) {
        buckets.push({ rangeStart: i * 10, rangeEnd: (i + 1) * 10, count: 0 });
    }
    for (const cb of comboBreakdown) {
        const idx = Math.min(9, Math.floor(cb.equity / 10));
        buckets[idx].count++;
    }

    return {
        winPercent: Math.round(winPct * 100) / 100,
        tiePercent: Math.round(tiePct * 100) / 100,
        losePercent: Math.round(losePct * 100) / 100,
        comboBreakdown,
        equityDistributionHistogram: buckets,
        runtimeMs: 0, // filled by caller
        strategy,
        totalSimulations: total
    };
}
