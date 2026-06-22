// ============================================
// 德州扑克计算器 Pro版 - 工具函数
// 注意：蒙特卡洛模拟已移至 Web Worker (simulation.worker.ts)
// ============================================

import { HandRank } from './pro-types';

// 计算 EV 和底池赔率
export function calculateEV(
  equity: number,
  potSize: number,
  betSize: number
): { potOdds: number; breakEven: number; ev: number; isPositiveEV: boolean } {
  // 底池赔率 = 下注 / (底池 + 下注)
  const potOdds = (betSize / (potSize + betSize)) * 100;
  
  // 盈亏平衡胜率 = 底池赔率
  const breakEven = potOdds;
  
  // EV = (胜率% × 底池) - (输率% × 下注)
  const ev = (equity / 100) * potSize - ((100 - equity) / 100) * betSize;
  
  return {
    potOdds: Math.round(potOdds * 10) / 10,
    breakEven: Math.round(breakEven * 10) / 10,
    ev: Math.round(ev * 100) / 100,
    isPositiveEV: equity > breakEven
  };
}

// 获取牌力名称（中文）
export function getHandRankName(rank: HandRank): string {
  const names: Record<HandRank, string> = {
    'High Card': '高牌',
    'Pair': '一对',
    'Two Pair': '两对',
    'Three of a Kind': '三条',
    'Straight': '顺子',
    'Flush': '同花',
    'Full House': '葫芦',
    'Four of a Kind': '四条',
    'Straight Flush': '同花顺',
    'Royal Flush': '皇家同花顺'
  };
  return names[rank] || rank;
}

// 快速估算翻前胜率（用于即时显示，非精确）
export function estimatePreflopEquity(handCombo: string): number {
  // 翻前胜率估算表
  const preflopOdds: Record<string, number> = {
    'AA': 85.3, 'KK': 82.4, 'QQ': 79.9, 'JJ': 77.2, 'TT': 75.0,
    '99': 72.2, '88': 69.5, '77': 66.8, '66': 64.1, '55': 61.4,
    '44': 58.7, '33': 56.0, '22': 53.4,
    'AKs': 67.0, 'AQs': 66.2, 'AJs': 65.3, 'ATs': 64.5,
    'AKo': 65.4, 'AQo': 64.3, 'AJo': 63.2, 'ATo': 62.1,
    'KQs': 63.4, 'KJs': 62.2, 'KTs': 61.3,
    'KQo': 60.8, 'KJo': 59.2, 'KTo': 57.8,
    'QJs': 60.2, 'QTs': 59.0,
    'QJo': 57.2, 'QTo': 55.4,
    'JTs': 57.8, 'J9s': 54.1,
    'JTo': 54.3, 'J9o': 49.8,
  };
  
  return preflopOdds[handCombo] || 50;
}

// 计算 4-2 法则估算的胜率（用于快速估算，非精确）
// 翻牌圈: outs × 4 ≈ 胜率%
// 转牌圈: outs × 2 ≈ 胜率%
export function estimateEquityFromOuts(outs: number, street: 'flop' | 'turn'): number {
  if (street === 'flop') {
    // 4-2 法则：翻牌圈用 4 倍
    return Math.min(100, outs * 4);
  } else {
    // 转牌圈用 2 倍
    return Math.min(100, outs * 2);
  }
}

// 底池赔率转百分比
export function potOddsToPercentage(potOdds: number | string): number {
  // potOdds 格式: "2:1" 或 "3:2"
  if (typeof potOdds === 'string') {
    const [pot, bet] = potOdds.split(':').map(Number);
    return (bet / (pot + bet)) * 100;
  }
  return potOdds;
}

// 计算所需的最低胜率
export function calculateRequiredEquity(potSize: number, betSize: number): number {
  // 需要的胜率 = 下注 / (底池 + 下注)
  return (betSize / (potSize + betSize)) * 100;
}

// 判断是否为同花手牌
export function isSuitedHand(combo: string): boolean {
  return combo.endsWith('s');
}

// 判断是否为口袋对
export function isPocketPair(combo: string): boolean {
  return combo.length === 2 && combo[0] === combo[1];
}
