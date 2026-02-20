// ============================================
// 高级 EV 计算器 — 纯计算模块
//
// 含 Fold Equity 的 EV 计算
// 半诈唬 EV 计算
// UI 无关, 纯函数
// ============================================

import type { EVAdvancedResult, SemiBluffEVResult } from './pro-types';

/**
 * 高级 EV 计算 (含 fold equity)
 *
 * 公式:
 *   foldEV   = foldEquity × currentPot
 *   callEV   = (1 - foldEquity) × [equity × (pot + bet) - (1 - equity) × bet]
 *   totalEV  = foldEV + callEV
 *
 * @param equity hero 胜率 (0-100)
 * @param potSize 当前底池
 * @param betSize 下注/加注大小
 * @param foldEquity 对手弃牌概率 (0-100)
 * @returns EVAdvancedResult
 */
export function calculateEVAdvanced(
    equity: number,
    potSize: number,
    betSize: number,
    foldEquity: number
): EVAdvancedResult {
    const eq = equity / 100;
    const fe = foldEquity / 100;

    // Fold EV: 当对手弃牌时, hero 赢得当前底池
    const foldEV = fe * potSize;

    // Call EV: 当对手跟注时的期望值
    // 如果 hero 赢: 赢得 pot + villainBet
    // 如果 hero 输: 失去 heroBet
    const callEV = (1 - fe) * (eq * (potSize + betSize) - (1 - eq) * betSize);

    const totalEV = foldEV + callEV;

    // 底池赔率
    const potOdds = betSize > 0 ? (betSize / (potSize + betSize)) * 100 : 0;
    const breakEven = potOdds;

    // 计算最低弃牌率 (使 EV = 0)
    // 0 = fe * pot + (1-fe) * [eq * (pot+bet) - (1-eq) * bet]
    // 令 X = eq * (pot+bet) - (1-eq) * bet
    // 0 = fe * pot + X - fe * X
    // 0 = fe * (pot - X) + X
    // fe = -X / (pot - X)
    const X = eq * (potSize + betSize) - (1 - eq) * betSize;
    let minFoldEquity: number;
    if (potSize === X) {
        minFoldEquity = X >= 0 ? 0 : 100;
    } else {
        minFoldEquity = Math.max(0, Math.min(100, (-X / (potSize - X)) * 100));
    }

    // 行动建议
    let recommendation: string;
    if (totalEV > 0) {
        if (fe > 0.3) {
            recommendation = '✅ 强加注 — 可观的弃牌率 + 正期望';
        } else if (eq > breakEven / 100) {
            recommendation = '✅ 跟注有利 — 胜率超过盈亏平衡';
        } else {
            recommendation = '✅ 正期望操作';
        }
    } else if (totalEV === 0) {
        recommendation = '⚖️ 盈亏平衡 — 边际决策';
    } else {
        if (eq < (breakEven / 100) * 0.5) {
            recommendation = '❌ 弃牌 — 胜率严重不足';
        } else {
            recommendation = '⚠️ 负期望 — 考虑弃牌或调整下注';
        }
    }

    // 公式展示
    const formula = `EV = ${fe > 0 ? `${(fe * 100).toFixed(0)}%×${potSize}` : '0'} + ${((1 - fe) * 100).toFixed(0)}%×[${(eq * 100).toFixed(1)}%×${potSize + betSize} - ${((1 - eq) * 100).toFixed(1)}%×${betSize}] = ${totalEV > 0 ? '+' : ''}${totalEV.toFixed(2)}`;

    return {
        foldEV: round2(foldEV),
        callEV: round2(callEV),
        totalEV: round2(totalEV),
        minFoldEquity: round2(minFoldEquity),
        potOdds: round2(potOdds),
        breakEven: round2(breakEven),
        isPositiveEV: totalEV > 0,
        recommendation,
        formula
    };
}

/**
 * 半诈唬 EV 计算
 *
 * 综合考虑:
 *   1. 对手弃牌的 EV
 *   2. 被跟注后当前 equity 的 EV
 *   3. 被跟注后改进手牌 (outs) 的额外 EV
 *
 * @param equity 当前胜率 (0-100)
 * @param outs outs 数量
 * @param potSize 底池
 * @param betSize 下注额
 * @param foldEquity 弃牌率 (0-100)
 * @param street 当前街道 ('flop' | 'turn')
 */
export function calculateSemiBluffEV(
    equity: number,
    outs: number,
    potSize: number,
    betSize: number,
    foldEquity: number,
    street: 'flop' | 'turn' = 'turn'
): SemiBluffEVResult {
    const eq = equity / 100;
    const fe = foldEquity / 100;

    // 1. Fold EV
    const foldEV = fe * potSize;

    // 2. 被跟注时, 当前 equity 的 EV
    const callEquityEV = (1 - fe) * (eq * (potSize + betSize) - (1 - eq) * betSize);

    // 3. Outs 改进 EV (额外的提升)
    // outs 带来的额外胜率提升 (4-2 法则)
    const outsEquity = street === 'flop' ? outs * 4 : outs * 2;
    const improvementEV = (1 - fe) * (outsEquity / 100) * (potSize + betSize * 2);

    const totalEV = foldEV + callEquityEV + improvementEV;

    let recommendation: string;
    if (totalEV > betSize * 0.3) {
        recommendation = '🔥 强半诈唬 — 高 EV 攻击性操作';
    } else if (totalEV > 0) {
        recommendation = '✅ 可半诈唬 — 正期望';
    } else {
        recommendation = '⚠️ 消极 — 半诈唬亏损, 考虑过牌跟注';
    }

    return {
        totalEV: round2(totalEV),
        foldEV: round2(foldEV),
        callEquityEV: round2(callEquityEV),
        improvementEV: round2(improvementEV),
        recommendation
    };
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}
