// ============================================
// GTO State Modeling & InfoSet Encoding
// 
// Memory-optimized structures for Game Tree traversal.
// Used for maintaining state without allocating objects
// repeatedly during CFR solving.
// ============================================

import { DeckMask, CardIndex, cardToString } from '../card';

/**
 * 结构化的动作类型 (离散化后)
 */
export enum ActionType {
    Fold = 0,
    CheckCall = 1,
    BetHalfPot = 2,
    BetPot = 3,
    AllIn = 4
}

/**
 * 定义一个可用的动作
 */
export interface Action {
    type: ActionType;
    amount: number; // 0 for fold/check; >0 for call/bet size
}

/**
 * 完整对局状态的轻量级表示
 * 传递给 TreeBuilder 生成节点时使用
 */
export interface GTOState {
    board: DeckMask;          // 当前公共牌 (Bitmask)
    pot: number;              // 当前底池大小
    stack0: number;           // Player 0 (OOP) 剩余筹码
    stack1: number;           // Player 1 (IP) 剩余筹码
    history: string;          // 行动历史轨迹 (用于生成 InfoSet)
}

// ============================================
// InfoSet 编码工具
// ============================================

/**
 * 为 StrategyMatrix 生成 Information Set (InfoSet) 的唯一键。
 * 
 * 公式: historyKey + "|" + commaSeparatedBoardCards
 * 
 * 只有公共信息（历史动作+公共牌）被编码进键中。
 * 具体的私有手牌 (Combo ID) 不是键的一部分，而是对应 Float32Array 的索引。
 * 
 * @param history 动作历史字符串 e.g., "0:Bet50,1:Call"
 * @param boardCards 公共牌数组
 */
export function encodeInfoSetKey(history: string, boardCards: CardIndex[]): string {
    if (boardCards.length === 0) {
        return history;
    }
    // "history|AhKdQs"
    const boardStr = boardCards.map(c => cardToString(c)).join('');
    return `${history}|${boardStr}`;
}
