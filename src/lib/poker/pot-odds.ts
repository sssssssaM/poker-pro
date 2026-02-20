// ============================================
// 底池赔率计算器 — 纯计算模块
//
// 提供底池赔率、隐含赔率、outs 转胜率等计算
// UI 无关, 纯函数
// ============================================

import type { PotOddsResult } from './pro-types';

/**
 * 计算底池赔率
 *
 * @param potSize 底池大小
 * @param betSize 需要跟注的大小
 * @returns PotOddsResult
 */
export function calculatePotOdds(
    potSize: number,
    betSize: number
): PotOddsResult {
    if (betSize <= 0) {
        return {
            potOdds: 0,
            potOddsRatio: '∞:1',
            breakEvenEquity: 0,
            isCallProfitable: true
        };
    }

    // 底池赔率 = 跟注额 / (底池 + 跟注额)
    const potOdds = (betSize / (potSize + betSize)) * 100;

    // 赔率比 = 底池 : 跟注
    const ratioValue = potSize / betSize;
    const potOddsRatio = formatRatio(ratioValue);

    return {
        potOdds: round2(potOdds),
        potOddsRatio,
        breakEvenEquity: round2(potOdds),
        isCallProfitable: false // 需配合 equity 使用, 此处默认 false
    };
}

/**
 * 计算底池赔率并判断跟注是否有利
 *
 * @param equity hero 胜率 (0-100)
 * @param potSize 底池大小
 * @param betSize 需要跟注的大小
 */
export function isCallProfitable(
    equity: number,
    potSize: number,
    betSize: number
): boolean {
    const odds = calculatePotOdds(potSize, betSize);
    return equity > odds.breakEvenEquity;
}

/**
 * 隐含赔率计算
 *
 * @param potSize 当前底池
 * @param betSize 跟注额
 * @param impliedWinnings 预期后续可赢取的额外筹码
 */
export function calculateImpliedOdds(
    potSize: number,
    betSize: number,
    impliedWinnings: number
): PotOddsResult {
    const effectivePot = potSize + impliedWinnings;
    const potOdds = betSize > 0 ? (betSize / (effectivePot + betSize)) * 100 : 0;
    const ratioValue = betSize > 0 ? effectivePot / betSize : Infinity;

    return {
        potOdds: round2(potOdds),
        potOddsRatio: formatRatio(ratioValue),
        breakEvenEquity: round2(potOdds),
        isCallProfitable: false
    };
}

/**
 * Outs 转换为胜率 — 4-2 法则
 *
 * @param outs outs 数量
 * @param street 当前街道 ('flop' 或 'turn')
 * @returns 估算胜率 (0-100)
 */
export function outsToEquityApprox(
    outs: number,
    street: 'flop' | 'turn'
): number {
    if (street === 'flop') {
        // 翻牌圈: outs × 4 (还剩 turn + river 两张牌)
        return Math.min(100, outs * 4);
    } else {
        // 转牌圈: outs × 2 (只剩 river 一张牌)
        return Math.min(100, outs * 2);
    }
}

/**
 * Outs 转换为胜率 — 精确二项式概率
 *
 * @param outs outs 数量
 * @param cardsRemaining 剩余未知牌数 (52 - board - hero)
 * @param cardsToCome 还要发的牌数 (flop=2, turn=1)
 * @returns 精确胜率 (0-100)
 */
export function outsToEquityExact(
    outs: number,
    cardsRemaining: number,
    cardsToCome: number
): number {
    if (cardsRemaining <= 0 || outs <= 0) return 0;
    if (outs >= cardsRemaining) return 100;

    if (cardsToCome === 1) {
        // P(hit) = outs / remaining
        return (outs / cardsRemaining) * 100;
    }

    if (cardsToCome === 2) {
        // P(hit at least once) = 1 - P(miss both)
        // P(miss both) = (remaining-outs)/remaining × (remaining-outs-1)/(remaining-1)
        const pMiss = ((cardsRemaining - outs) / cardsRemaining)
            * ((cardsRemaining - outs - 1) / (cardsRemaining - 1));
        return (1 - pMiss) * 100;
    }

    // 一般情况
    let pMiss = 1;
    for (let i = 0; i < cardsToCome; i++) {
        pMiss *= (cardsRemaining - outs - i) / (cardsRemaining - i);
    }
    return (1 - pMiss) * 100;
}

/**
 * 格式化赔率比 (e.g., 3:1, 2.5:1)
 */
function formatRatio(ratio: number): string {
    if (!isFinite(ratio)) return '∞:1';
    if (ratio >= 10) return `${Math.round(ratio)}:1`;
    return `${(Math.round(ratio * 10) / 10).toFixed(1)}:1`;
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}
