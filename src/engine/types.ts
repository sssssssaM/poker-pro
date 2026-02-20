// ============================================
// 德州扑克专业引擎 — 核心类型
// ============================================

/** 牌索引 0-51. 编码: rank * 4 + suit */
export type CardIndex = number;

/**
 * 双 Number 位掩码.
 * [0] = bits 0-25 (cards 0-25)
 * [1] = bits 0-25 (cards 26-51)
 * 避免 BigInt 的 GC 开销, 纯栈运算.
 */
export type HandMask = [number, number];

/** 预编码手牌: 两张牌 + 位掩码 + 所属 combo 名 */
export interface EncodedHand {
    c1: CardIndex;
    c2: CardIndex;
    lo: number;
    hi: number;
    combo: string;
}

/** 单方胜率结果 */
export interface PlayerEquity {
    win: number;   // win count
    tie: number;   // tie count
    equity: number; // (win + tie/2) / total
}

/** Range vs Range 完整结果 */
export interface RangeEquityResult {
    player1: PlayerEquity;
    player2: PlayerEquity;
    totalSimulations: number;
    /** 每个 combo 的独立统计 */
    comboStats: Record<string, { wins: number; ties: number; total: number }>;
    /** 10 桶 equity 直方图 */
    histogram: { rangeStart: number; rangeEnd: number; count: number }[];
}

/** Worker 请求消息 */
export interface WorkerRequest {
    type: 'calculate';
    range1: string[];   // combo strings, e.g. ["AA","AKs"]
    range2: string[];   // opponent range (empty = random)
    board: CardIndex[];  // community cards as indices
    iterations: number;
}

/** Worker 进度消息 */
export interface WorkerProgress {
    type: 'progress';
    progress: number;
    wins: number;
    ties: number;
    losses: number;
    simulations: number;
}

/** Worker 完成消息 */
export interface WorkerComplete {
    type: 'complete';
    result: RangeEquityResult;
}

export type WorkerMessage = WorkerRequest;
export type WorkerResponse = WorkerProgress | WorkerComplete;
