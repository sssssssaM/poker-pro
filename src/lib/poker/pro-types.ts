// ============================================
// 德州扑克计算器 Pro版 - 类型定义
// ============================================

// 扑克牌花色
export type Suit = 's' | 'h' | 'd' | 'c'; // spades, hearts, diamonds, clubs

// 扑克牌点数
export type Rank = 'A' | 'K' | 'Q' | 'J' | 'T' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';

// 完整的牌
export interface Card {
  rank: Rank;
  suit: Suit;
}

// 牌型
export type HandRank =
  | 'High Card' | 'Pair' | 'Two Pair' | 'Three of a Kind'
  | 'Straight' | 'Flush' | 'Full House' | 'Four of a Kind'
  | 'Straight Flush' | 'Royal Flush';

// 手牌组合（如 AKs, QQ, JTo）
export type HandCombo = string;

// Range 选择（矩阵中选中的 combo 集合）
export type RangeSelection = Set<HandCombo>;

// 每个 combo 的独立胜率（用于 RvR 分析）
export interface ComboEquity {
  wins: number;
  total: number;
  equity: number; // 百分比
}

// 手牌范围（Range）
export interface HandRange {
  combos: Set<HandCombo>;
  weight: number; // 权重 0-100
}

// 预设 Range
export const TOP_RANGE_PRESETS: Record<string, { label: string; combos: HandCombo[] }> = {
  'top5': {
    label: 'Top 5%',
    combos: ['AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AQs', 'AKo']
  },
  'top10': {
    label: 'Top 10%',
    combos: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', 'AKs', 'AQs', 'AJs', 'ATs', 'AKo', 'AQo', 'KQs']
  },
  'top20': {
    label: 'Top 20%',
    combos: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', 'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A5s', 'A4s', 'KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs', 'AKo', 'AQo', 'AJo', 'ATo', 'KQo', 'KJo']
  },
  'broadway': {
    label: 'Broadway',
    combos: ['AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AQs', 'AJs', 'ATs', 'KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs', 'AKo', 'AQo', 'AJo', 'ATo', 'KQo', 'KJo', 'KTo', 'QJo', 'QTo', 'JTo']
  },
  'pairs': {
    label: '对子',
    combos: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22']
  },
  'suitedConnectors': {
    label: '同花连牌',
    combos: ['AKs', 'KQs', 'QJs', 'JTs', 'T9s', '98s', '87s', '76s', '65s', '54s', '43s', '32s']
  }
};

// 对手类型
export type OpponentType =
  | 'random'        // 随机牌
  | 'tight'         // 紧凶 TAG
  | 'loose'         // 松凶 LAG
  | 'passive'       // 松被动
  | 'nit'           // 极紧
  | 'custom';       // 自定义范围

// 对手预设档案
export interface OpponentProfile {
  id: OpponentType;
  name: string;
  description: string;
  openRange: HandRange;      // 开池范围
  callRange: HandRange;      // 跟注范围
  threeBetRange: HandRange;  // 3Bet范围
}

// 游戏阶段
export type Street = 'preflop' | 'flop' | 'turn' | 'river';

// 游戏状态
export interface GameState {
  street: Street;
  playerHand: Card[];
  communityCards: Card[];
  potSize: number;
  stackSize: number;
  betSize: number;
  opponentCount: number;
  opponentType: OpponentType;
  opponentRange?: HandRange;
}

// 胜率结果
export interface EquityResult {
  win: number;           // 胜率
  tie: number;           // 平局率
  lose: number;          // 输率
  simulations: number;   // 模拟次数
  confidence: number;    // 置信度
  handRank?: HandRank;   // 当前牌力
  outs?: number;         // 出牌数
}

// EV计算结果
export interface EVResult {
  ev: number;            // 期望值
  potOdds: number;       // 底池赔率
  breakEven: number;     // 盈亏平衡胜率
  isPositiveEV: boolean; // 是否+EV
  formula: string;       // 公式展示
  recommendation: string; // 建议
}

// 完整计算结果
export interface CalculationResult {
  equity: EquityResult;
  ev: EVResult;
  rangeVsRange?: {
    equity: number;
    combos: number;
  };
}

// 花色符号
export const SUIT_SYMBOLS: Record<Suit, string> = {
  s: '♠', h: '♥', d: '♦', c: '♣'
};

// 花色颜色
export const SUIT_COLORS: Record<Suit, string> = {
  s: '#1a1a2e', h: '#dc2626', d: '#dc2626', c: '#1a1a2e'
};

// 点数顺序（从大到小）
export const RANKS: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

// 所有花色
export const SUITS: Suit[] = ['s', 'h', 'd', 'c'];

// 13x13矩阵位置
export interface MatrixPosition {
  row: number;
  col: number;
  type: 'pair' | 'suited' | 'offsuit';
  combo: HandCombo;
}

// 预设对手范围
export const OPPONENT_PROFILES: Record<OpponentType, Omit<OpponentProfile, 'openRange' | 'callRange' | 'threeBetRange'>> = {
  random: {
    id: 'random',
    name: '随机牌',
    description: 'Any Two Cards - 100%范围'
  },
  tight: {
    id: 'tight',
    name: '紧凶 (TAG)',
    description: '约15%开池范围，选择性3Bet'
  },
  loose: {
    id: 'loose',
    name: '松凶 (LAG)',
    description: '约35%开池范围，积极3Bet'
  },
  passive: {
    id: 'passive',
    name: '松被动',
    description: '约40%跟注范围，很少3Bet'
  },
  nit: {
    id: 'nit',
    name: '极紧 (Nit)',
    description: '约8%开池范围，仅玩强牌'
  },
  custom: {
    id: 'custom',
    name: '自定义',
    description: '用户自定义范围'
  }
};

// 默认开池范围（位置无关）
export const DEFAULT_OPEN_RANGES: Record<OpponentType, string[]> = {
  random: [], // 空表示全部
  tight: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', 'AKs', 'AQs', 'AJs', 'ATs', 'AKo', 'AQo', 'KQs'],
  loose: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', 'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs', 'T9s', 'AKo', 'AQo', 'AJo', 'ATo', 'KQo', 'KJo', 'QJo'],
  passive: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', 'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs', 'T9s', '98s', 'AKo', 'AQo', 'AJo', 'ATo', 'KQo'],
  nit: ['AA', 'KK', 'QQ', 'AKs', 'AKo'],
  custom: []
};

// 获取矩阵中的组合名称
export function getComboName(row: number, col: number): HandCombo {
  const ranks = RANKS;
  const rank1 = ranks[row];
  const rank2 = ranks[col];

  if (row === col) {
    return `${rank1}${rank2}`; // 对子
  } else if (row < col) {
    return `${rank1}${rank2}s`; // 同花
  } else {
    return `${rank2}${rank1}o`; // 非同花
  }
}

// 解析组合名称
export function parseCombo(combo: HandCombo): { rank1: Rank; rank2: Rank; suited: boolean } | null {
  const match = combo.match(/^([AKQJT98765432]{1,2})([so]?)$/);
  if (!match) return null;

  const ranks = match[1];
  const suffix = match[2];

  if (ranks.length === 2 && ranks[0] === ranks[1]) {
    return { rank1: ranks[0] as Rank, rank2: ranks[1] as Rank, suited: true };
  }

  return {
    rank1: ranks[0] as Rank,
    rank2: ranks[1] as Rank,
    suited: suffix === 's'
  };
}
