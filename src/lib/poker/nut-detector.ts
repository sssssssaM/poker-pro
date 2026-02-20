// ============================================
// 坚果牌检测器 — 纯计算模块
//
// 检测当前/潜在坚果牌 (Nuts)
// 全部使用 CardIndex + bitmask, 零字符串操作
// ============================================

import {
    CardIndex, DeckMask,
    fullDeck, removeCard, hasCard, deckToArray,
    cardRank, cardSuit
} from './card';
import { evaluate7, handCategoryName } from './evaluator';
import type { NutResult, NutPotentialResult } from './pro-types';

/**
 * 检测当前 board 上的坚果牌, 以及 hero 的排名
 *
 * @param heroCards hero 手牌 [card1, card2]
 * @param board 公共牌 (3-5 张)
 * @returns NutResult
 */
export function detectNuts(
    heroCards: [CardIndex, CardIndex],
    board: CardIndex[]
): NutResult {
    if (board.length < 3) {
        return {
            currentNuts: '翻前无法判定',
            heroIsNuts: false,
            nutRank: 0,
            totalPossible: 0
        };
    }

    // 构建可用牌 mask (去掉 board)
    const available: DeckMask = fullDeck();
    for (const c of board) removeCard(available, c);

    // hero 手牌值
    const heroAll = board.length >= 5
        ? evaluate7([heroCards[0], heroCards[1], ...board])
        : evaluatePartial([heroCards[0], heroCards[1], ...board]);

    // 枚举所有可能的两张手牌组合
    const remainingCards = deckToArray(available);
    let bestValue = -1;
    let bestComboDesc = '';
    let rank = 1; // hero 排名 (1=最强)
    let totalPossible = 0;
    let heroChecked = false;

    const handValues: number[] = [];

    for (let i = 0; i < remainingCards.length; i++) {
        for (let j = i + 1; j < remainingCards.length; j++) {
            const c1 = remainingCards[i];
            const c2 = remainingCards[j];
            const allCards = [c1, c2, ...board];
            const value = allCards.length >= 7
                ? evaluate7(allCards)
                : evaluatePartial(allCards);

            handValues.push(value);
            totalPossible++;

            if (value > bestValue) {
                bestValue = value;
                bestComboDesc = handCategoryName(value);
            }
        }
    }

    // 计算 hero 排名
    let handsAboveHero = 0;
    for (const v of handValues) {
        if (v > heroAll) handsAboveHero++;
    }
    rank = handsAboveHero + 1;

    return {
        currentNuts: bestComboDesc,
        heroIsNuts: heroAll >= bestValue,
        nutRank: rank,
        totalPossible
    };
}

/**
 * 检查 hero 是否持有坚果牌
 */
export function isNutHand(
    heroCards: [CardIndex, CardIndex],
    board: CardIndex[]
): boolean {
    return detectNuts(heroCards, board).heroIsNuts;
}

/**
 * 坚果潜力: 下一张牌中有多少让 hero 成为坚果
 *
 * @param heroCards hero 手牌
 * @param board 公共牌 (3-4 张)
 * @returns NutPotentialResult
 */
export function nutPotentialOnNext(
    heroCards: [CardIndex, CardIndex],
    board: CardIndex[]
): NutPotentialResult {
    if (board.length < 3 || board.length > 4) {
        return { nutFraction: 0, nutCards: [], totalRemaining: 0 };
    }

    // 可用牌
    const available: DeckMask = fullDeck();
    removeCard(available, heroCards[0]);
    removeCard(available, heroCards[1]);
    for (const c of board) removeCard(available, c);

    const remaining = deckToArray(available);
    const nutCards: CardIndex[] = [];

    for (const nextCard of remaining) {
        const newBoard = [...board, nextCard];

        // 构建新 board 的可用牌 (去掉 hero + newBoard)
        const newAvail: DeckMask = fullDeck();
        removeCard(newAvail, heroCards[0]);
        removeCard(newAvail, heroCards[1]);
        for (const c of newBoard) removeCard(newAvail, c);

        // hero 值
        const heroAll = [heroCards[0], heroCards[1], ...newBoard];
        const heroValue = heroAll.length >= 7
            ? evaluate7(heroAll)
            : evaluatePartial(heroAll);

        // 能否找到比 hero 更好的手牌?
        const opponents = deckToArray(newAvail);
        let isNuts = true;

        for (let i = 0; i < opponents.length && isNuts; i++) {
            for (let j = i + 1; j < opponents.length && isNuts; j++) {
                const oppAll = [opponents[i], opponents[j], ...newBoard];
                const oppValue = oppAll.length >= 7
                    ? evaluate7(oppAll)
                    : evaluatePartial(oppAll);
                if (oppValue > heroValue) {
                    isNuts = false;
                }
            }
        }

        if (isNuts) {
            nutCards.push(nextCard);
        }
    }

    return {
        nutFraction: remaining.length > 0 ? nutCards.length / remaining.length : 0,
        nutCards,
        totalRemaining: remaining.length
    };
}

/**
 * 评估少于 7 张牌的最佳手牌 (用 dummy 填充到 7 张)
 */
function evaluatePartial(cards: CardIndex[]): number {
    if (cards.length >= 7) return evaluate7(cards.slice(0, 7));
    // 找不在 cards 中的最低 index 牌作为 dummy
    const used = new Set(cards);
    const padded = [...cards];
    for (let i = 0; i < 52 && padded.length < 7; i++) {
        if (!used.has(i)) {
            padded.push(i);
            used.add(i);
        }
    }
    return evaluate7(padded);
}
