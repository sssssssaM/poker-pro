// ============================================
// 整数牌编码 & Bitmask 工具
// CardIndex = rank * 4 + suitIdx
// rank: 0=2, 1=3, ..., 12=A
// suit: 0=c, 1=d, 2=h, 3=s
// ============================================

/** 0-51 整数牌索引 */
export type CardIndex = number;

// 点数常量 (内部用 0-12)
export const RANK_2 = 0;
export const RANK_3 = 1;
export const RANK_4 = 2;
export const RANK_5 = 3;
export const RANK_6 = 4;
export const RANK_7 = 5;
export const RANK_8 = 6;
export const RANK_9 = 7;
export const RANK_T = 8;
export const RANK_J = 9;
export const RANK_Q = 10;
export const RANK_K = 11;
export const RANK_A = 12;

// 花色常量
export const SUIT_C = 0;
export const SUIT_D = 1;
export const SUIT_H = 2;
export const SUIT_S = 3;

// 映射表
const RANK_CHARS = '23456789TJQKA';
const SUIT_CHARS = 'cdhs';

// ============================================
// CardIndex ↔ rank/suit 转换
// ============================================

export function makeCard(rank: number, suit: number): CardIndex {
    return rank * 4 + suit;
}

export function cardRank(card: CardIndex): number {
    return (card >> 2);  // card / 4
}

export function cardSuit(card: CardIndex): number {
    return card & 3;     // card % 4
}

// ============================================
// 字符串 ↔ CardIndex 转换
// ============================================

/** "As" → CardIndex, "Kh" → CardIndex */
export function parseCard(str: string): CardIndex {
    const r = RANK_CHARS.indexOf(str[0]);
    const s = SUIT_CHARS.indexOf(str[1]);
    if (r === -1 || s === -1) return -1;
    return makeCard(r, s);
}

/** CardIndex → "As", "Kh" */
export function cardToString(card: CardIndex): string {
    return RANK_CHARS[cardRank(card)] + SUIT_CHARS[cardSuit(card)];
}

/** 旧 {rank, suit} 对象 → CardIndex */
export function cardObjToIndex(obj: { rank: string; suit: string }): CardIndex {
    const r = RANK_CHARS.indexOf(obj.rank);
    const s = SUIT_CHARS.indexOf(obj.suit);
    if (r === -1 || s === -1) return -1;
    return makeCard(r, s);
}

/** CardIndex → 旧 {rank, suit} 对象 */
export function cardIndexToObj(card: CardIndex): { rank: string; suit: string } {
    return {
        rank: RANK_CHARS[cardRank(card)],
        suit: SUIT_CHARS[cardSuit(card)]
    };
}

// ============================================
// 手牌评估用的 rank value (2=2 ... A=14)
// ============================================

export function rankValue(card: CardIndex): number {
    return cardRank(card) + 2;  // 0→2, 12→14
}

// ============================================
// Bitmask Deck (64-bit 用两个 32-bit 整数)
// 因为 JS 位运算只能 32-bit，我们用一对 [lo, hi]
// lo: bit 0-31 = cards 0-31
// hi: bit 0-19 = cards 32-51
// ============================================

/** 52 张牌的 bitmask deck */
export type DeckMask = [number, number]; // [lo32, hi20]

/** 创建满牌组 (全部 52 张) */
export function fullDeck(): DeckMask {
    return [0xFFFFFFFF, 0x000FFFFF]; // 32 bits + 20 bits = 52
}

/** 空牌组 */
export function emptyDeck(): DeckMask {
    return [0, 0];
}

/** 检查牌是否在 deck 中 */
export function hasCard(deck: DeckMask, card: CardIndex): boolean {
    if (card < 32) return (deck[0] & (1 << card)) !== 0;
    return (deck[1] & (1 << (card - 32))) !== 0;
}

/** 从 deck 中移除一张牌 */
export function removeCard(deck: DeckMask, card: CardIndex): void {
    if (card < 32) deck[0] &= ~(1 << card);
    else deck[1] &= ~(1 << (card - 32));
}

/** 向 deck 中添加一张牌 */
export function addCard(deck: DeckMask, card: CardIndex): void {
    if (card < 32) deck[0] |= (1 << card);
    else deck[1] |= (1 << (card - 32));
}

/** 计算 deck 中的牌数 */
export function popCount(deck: DeckMask): number {
    return popCount32(deck[0]) + popCount32(deck[1]);
}

function popCount32(n: number): number {
    n = n - ((n >> 1) & 0x55555555);
    n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
    return (((n + (n >> 4)) & 0x0F0F0F0F) * 0x01010101) >> 24;
}

/** 复制 deck */
export function cloneDeck(deck: DeckMask): DeckMask {
    return [deck[0], deck[1]];
}

/** 从 deck 中随机抽一张牌 (Fisher-Yates 单步) */
export function drawRandom(deck: DeckMask): CardIndex {
    const count = popCount(deck);
    if (count === 0) return -1;
    let target = Math.floor(Math.random() * count);

    // 先扫 lo
    let bits = deck[0];
    while (bits) {
        const lsb = bits & (-bits); // 最低位的 1
        if (target === 0) {
            const card = Math.clz32(lsb) ^ 31; // bit index
            removeCard(deck, card);
            return card;
        }
        target--;
        bits ^= lsb;
    }

    // 再扫 hi
    bits = deck[1];
    while (bits) {
        const lsb = bits & (-bits);
        if (target === 0) {
            const card = (Math.clz32(lsb) ^ 31) + 32;
            removeCard(deck, card);
            return card;
        }
        target--;
        bits ^= lsb;
    }

    return -1;
}

/** 从 deck 中随机抽 n 张牌 */
export function drawN(deck: DeckMask, n: number): CardIndex[] {
    const result: CardIndex[] = [];
    for (let i = 0; i < n; i++) {
        const c = drawRandom(deck);
        if (c === -1) break;
        result.push(c);
    }
    return result;
}

/** 将 deck mask 转为 CardIndex 数组 */
export function deckToArray(deck: DeckMask): CardIndex[] {
    const result: CardIndex[] = [];
    let bits = deck[0];
    while (bits) {
        const lsb = bits & (-bits);
        result.push(Math.clz32(lsb) ^ 31);
        bits ^= lsb;
    }
    bits = deck[1];
    while (bits) {
        const lsb = bits & (-bits);
        result.push((Math.clz32(lsb) ^ 31) + 32);
        bits ^= lsb;
    }
    return result;
}

// ============================================
// 全部 52 张牌的预计算表
// ============================================

/** 预计算的全部 52 张 CardIndex */
export const ALL_CARDS: CardIndex[] = Array.from({ length: 52 }, (_, i) => i);

/** 按 rank 分组的牌 (13 组，每组 4 张) */
export const CARDS_BY_RANK: CardIndex[][] = Array.from({ length: 13 }, (_, r) =>
    [makeCard(r, 0), makeCard(r, 1), makeCard(r, 2), makeCard(r, 3)]
);

/** 按 suit 分组的牌 (4 组，每组 13 张) */
export const CARDS_BY_SUIT: CardIndex[][] = Array.from({ length: 4 }, (_, s) =>
    Array.from({ length: 13 }, (_, r) => makeCard(r, s))
);
