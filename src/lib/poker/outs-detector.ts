// ============================================
// Outs 检测器 — 纯计算模块
//
// 枚举所有未见牌, 检测哪些能改进 hero 手牌
// 全部使用 CardIndex + bitmask, 零字符串操作
// ============================================

import {
    CardIndex, DeckMask,
    fullDeck, hasCard, removeCard, deckToArray,
    cardRank, cardSuit
} from './card';
import { evaluate7, handCategory, handCategoryName } from './evaluator';
import type { OutInfo, OutsResult, DrawBreakdown, DrawType } from './pro-types';

// 听牌类型中文标签
const DRAW_LABELS: Record<DrawType, string> = {
    'flush-draw': '同花听牌',
    'oesd': '两头顺子听牌',
    'gutshot': '卡顺听牌',
    'overcards': '超对牌',
    'pair-to-trips': '对子→三条',
    'pair-to-two-pair': '高牌→对子',
    'trips-to-full': '三条→葫芦',
    'two-pair-to-full': '两对→葫芦',
    'set-to-quads': '暗三→四条',
    'backdoor-flush': '后门同花',
    'backdoor-straight': '后门顺子',
    'runner-runner': '其他双跑'
};

/**
 * 检测 hero 手牌在下一张牌发出后的所有 outs
 * 
 * @param heroCards hero 手牌 [card1, card2]
 * @param board 公共牌 (3 或 4 张, 即 flop/turn)
 * @returns OutsResult 包含总 outs 数、详细列表和按类型分组
 */
export function detectOuts(
    heroCards: [CardIndex, CardIndex],
    board: CardIndex[]
): OutsResult {
    if (board.length < 3 || board.length > 4) {
        return { totalOuts: 0, outs: [], drawTypes: [] };
    }

    // 构建已用牌 mask
    const dead: DeckMask = fullDeck();
    removeCard(dead, heroCards[0]);
    removeCard(dead, heroCards[1]);
    for (const c of board) removeCard(dead, c);

    // 当前手牌评估
    const currentCards = [heroCards[0], heroCards[1], ...board];
    // 如果是 flop (3张), 我们需要 7 张牌来评估, 但这里我们只有 5 张
    // 对于 outs 检测, 我们评估 board+1 后的 6 或 7 张牌的最佳 5 张
    // flop: hero(2) + board(3) = 5张, 加新牌 = 6张, 需要枚举 C(6,5) = 6
    // turn: hero(2) + board(4) = 6张, 加新牌 = 7张, 直接用 evaluate7

    const currentValue = board.length === 4
        ? evaluate7([...currentCards, -1 as CardIndex].length === 7 ? currentCards as CardIndex[] : currentCards as CardIndex[])
        : evaluateBest(currentCards);

    const currentCategory = handCategory(currentValue);

    // 枚举所有剩余牌
    const remaining = deckToArray(dead);
    const outs: OutInfo[] = [];
    const seenCards = new Set<number>();

    for (const newCard of remaining) {
        const newHand = [...currentCards, newCard];
        let newValue: number;

        if (newHand.length === 7) {
            newValue = evaluate7(newHand);
        } else {
            // 6 张牌: 枚举所有 C(6,5) 取最大
            newValue = evaluateBest(newHand);
        }

        const newCategory = handCategory(newValue);

        // 牌力提升 = out
        if (newValue > currentValue && newCategory > currentCategory) {
            if (!seenCards.has(newCard)) {
                seenCards.add(newCard);
                const drawType = classifyDraw(
                    heroCards, board, newCard,
                    currentCategory, newCategory
                );
                outs.push({
                    card: newCard,
                    drawType,
                    improvesTo: handCategoryName(newValue)
                });
            }
        }
    }

    // 按类型分组
    const drawTypes = buildDrawBreakdown(outs);

    return {
        totalOuts: outs.length,
        outs,
        drawTypes
    };
}

/**
 * 评估 5-6 张牌中的最佳 5 张 (用于 flop)
 */
function evaluateBest(cards: CardIndex[]): number {
    if (cards.length <= 5) {
        // 不足 7 张: 填充 dummy 评估
        // 用 evaluate7 需要 7 张, 所以我们枚举所有 5 张的组合
        return evaluateBestOf(cards, 5);
    }
    if (cards.length === 6) {
        return evaluateBestOf(cards, 5);
    }
    return evaluate7(cards);
}

/**
 * 从 n 张牌中选最佳 k 张组合的评估值
 */
function evaluateBestOf(cards: CardIndex[], k: number): number {
    if (cards.length === k) {
        // 直接评估 5 张
        return evaluate5(cards);
    }
    if (cards.length === 7) {
        return evaluate7(cards);
    }
    // 枚举 C(n, k) 中 k=5
    let best = -1;
    const n = cards.length;
    for (let skip = 0; skip < n; skip++) {
        if (n - 1 < 5) continue;
        const sub: CardIndex[] = [];
        for (let i = 0; i < n; i++) {
            if (i !== skip) sub.push(cards[i]);
        }
        if (sub.length === 5) {
            const v = evaluate5(sub);
            if (v > best) best = v;
        } else if (sub.length > 5) {
            const v = evaluateBestOf(sub, 5);
            if (v > best) best = v;
        }
    }
    return best;
}

/**
 * 评估精确的 5 张牌 — 复用 evaluate7 的逻辑
 * 填充 2 张 dummy 牌 (不参与同花/顺子的超低值牌)
 * 实际上 evaluate7 会从 7 张中找最佳 5 张
 */
function evaluate5(cards: CardIndex[]): number {
    if (cards.length < 5) return -1;
    // 我们可以填充 2 张不会影响结果的 dummy
    // 使用 evaluate7 但需要 7 张, 所以用 dummy 
    // 更高效: 直接内联 5 张评估
    // 但为了复用, 我们用一个巧妙的方法:
    // 找两张不在 cards 中的最低牌作为 dummy
    const used = new Set(cards);
    const dummies: CardIndex[] = [];
    for (let i = 0; i < 52 && dummies.length < 2; i++) {
        if (!used.has(i)) dummies.push(i);
    }
    return evaluate7([...cards, ...dummies]);
}

/**
 * 分类听牌类型
 */
function classifyDraw(
    heroCards: [CardIndex, CardIndex],
    board: CardIndex[],
    newCard: CardIndex,
    fromCategory: number,
    toCategory: number
): DrawType {
    const FLUSH = 5;
    const STRAIGHT = 4;
    const THREE_KIND = 3;
    const TWO_PAIR = 2;
    const PAIR = 1;
    const FULL_HOUSE = 6;
    const FOUR_KIND = 7;

    // 同花判定: 检查 hero 手牌中是否有 >= 2 张与新牌同花色
    if (toCategory === FLUSH) {
        return 'flush-draw';
    }

    // 顺子判定
    if (toCategory === STRAIGHT) {
        // 区分 OESD 和 gutshot: 
        // 检查当前 board+hero 有多少顺子 outs
        const allCards = [heroCards[0], heroCards[1], ...board];
        const straightOuts = countStraightOuts(allCards);
        return straightOuts >= 8 ? 'oesd' : 'gutshot';
    }

    // 四条
    if (toCategory === FOUR_KIND) {
        return 'set-to-quads';
    }

    // 葫芦
    if (toCategory === FULL_HOUSE) {
        if (fromCategory === THREE_KIND) return 'trips-to-full';
        if (fromCategory === TWO_PAIR) return 'two-pair-to-full';
        return 'pair-to-trips';
    }

    // 三条
    if (toCategory === THREE_KIND) {
        return 'pair-to-trips';
    }

    // 两对
    if (toCategory === TWO_PAIR) {
        return 'pair-to-two-pair';
    }

    // 一对 (超对牌)
    if (toCategory === PAIR && fromCategory === 0) {
        // 检查新牌是否是 hero 的高牌配对
        const heroRanks = [cardRank(heroCards[0]), cardRank(heroCards[1])];
        const newRank = cardRank(newCard);
        if (heroRanks.includes(newRank)) {
            const boardMaxRank = Math.max(...board.map(c => cardRank(c)));
            if (newRank > boardMaxRank) return 'overcards';
        }
        return 'pair-to-two-pair';
    }

    return 'runner-runner';
}

/**
 * 计算顺子 outs 数量 (用于区分 OESD / gutshot)
 */
function countStraightOuts(cards: CardIndex[]): number {
    // 构建 rank bitmask
    let rankMask = 0;
    for (const c of cards) {
        rankMask |= (1 << cardRank(c));
    }

    // 枚举所有 13 种 rank, 检查加入后能否构成顺子
    let outs = 0;
    for (let r = 0; r < 13; r++) {
        if (rankMask & (1 << r)) continue; // 已有
        const newMask = rankMask | (1 << r);
        if (hasStraight(newMask)) outs++;
    }
    // 每个 rank 有 4 张牌
    return outs * 4;
}

/**
 * 检查 13-bit rank mask 是否包含顺子 (5 连续 bit)
 */
function hasStraight(mask: number): boolean {
    // 标准顺子检查
    const STRAIGHTS = [
        0b1111100000000, // A K Q J T
        0b0111110000000, // K Q J T 9
        0b0011111000000, // Q J T 9 8
        0b0001111100000, // J T 9 8 7
        0b0000111110000, // T 9 8 7 6
        0b0000011111000, // 9 8 7 6 5
        0b0000001111100, // 8 7 6 5 4
        0b0000000111110, // 7 6 5 4 3
        0b0000000011111, // 6 5 4 3 2
        0b1000000001111, // A 2 3 4 5 (Wheel)
    ];
    for (const s of STRAIGHTS) {
        if ((mask & s) === s) return true;
    }
    return false;
}

/**
 * 构建听牌类型分组
 */
function buildDrawBreakdown(outs: OutInfo[]): DrawBreakdown[] {
    const groups = new Map<DrawType, CardIndex[]>();

    for (const out of outs) {
        let arr = groups.get(out.drawType);
        if (!arr) { arr = []; groups.set(out.drawType, arr); }
        arr.push(out.card);
    }

    const result: DrawBreakdown[] = [];
    for (const [type, cards] of groups) {
        result.push({
            type,
            label: DRAW_LABELS[type] || type,
            count: cards.length,
            cards
        });
    }

    // 按 count 从大到小排序
    result.sort((a, b) => b.count - a.count);
    return result;
}
