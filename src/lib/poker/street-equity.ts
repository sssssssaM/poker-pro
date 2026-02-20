// ============================================
// 街道 Equity 变化计算器 — 纯计算模块
//
// 给定完整 board, 分别计算 flop/turn/river 的 equity
// 用于 equity shift 可视化
// ============================================

import { CardIndex } from './card';
import { calculateEquity, ComboInput } from './equity-engine';
import type { StreetEquity, StreetEquityResult } from './pro-types';

/**
 * 计算 hero 在不同街道的 equity 变化
 *
 * @param heroCards hero 手牌 [card1, card2]
 * @param villainRange 对手 range (预展开的 combo 列表), null = 随机
 * @param board 完整公共牌 (3-5 张)
 * @param iterations Monte Carlo 迭代数 (用于 flop 等需要模拟的场景)
 * @returns StreetEquityResult 各街道 equity
 */
export function calculateStreetEquityShift(
    heroCards: [CardIndex, CardIndex],
    villainRange: ComboInput[] | null,
    board: CardIndex[],
    iterations: number = 20000
): StreetEquityResult {
    const result: StreetEquityResult = {};

    // Flop equity (前3张)
    if (board.length >= 3) {
        const flopBoard = board.slice(0, 3);
        const flopResult = calculateEquity({
            heroCards,
            villainRange,
            board: flopBoard,
            iterations
        });
        result.flop = {
            equity: round2(flopResult.winPercent + flopResult.tiePercent * 0.5),
            win: round2(flopResult.winPercent),
            tie: round2(flopResult.tiePercent)
        };
    }

    // Turn equity (前4张)
    if (board.length >= 4) {
        const turnBoard = board.slice(0, 4);
        const turnResult = calculateEquity({
            heroCards,
            villainRange,
            board: turnBoard,
            iterations
        });
        result.turn = {
            equity: round2(turnResult.winPercent + turnResult.tiePercent * 0.5),
            win: round2(turnResult.winPercent),
            tie: round2(turnResult.tiePercent)
        };
    }

    // River equity (全部5张)
    if (board.length >= 5) {
        const riverBoard = board.slice(0, 5);
        const riverResult = calculateEquity({
            heroCards,
            villainRange,
            board: riverBoard,
            iterations
        });
        result.river = {
            equity: round2(riverResult.winPercent + riverResult.tiePercent * 0.5),
            win: round2(riverResult.winPercent),
            tie: round2(riverResult.tiePercent)
        };
    }

    return result;
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}
