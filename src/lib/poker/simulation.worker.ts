// ============================================
// Monte Carlo 模拟 Web Worker
// 将计算从主线程剥离，避免 UI 阻塞
// ============================================

import { Card, Rank, Suit, HandRank, HandCombo, OpponentType, RANKS, SUITS } from './pro-types';

// 点数值
const RANK_VALUES: Record<Rank, number> = {
  'A': 14, 'K': 13, 'Q': 12, 'J': 11, 'T': 10,
  '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
};

// 创建完整牌组
function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

// Fisher-Yates 洗牌
function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// 从牌组中移除指定的牌
function removeCards(deck: Card[], cards: Card[]): Card[] {
  return deck.filter(card =>
    !cards.some(c => c.rank === card.rank && c.suit === card.suit)
  );
}

// 评估手牌强度
function evaluateHand(holeCards: Card[], communityCards: Card[]): { rank: HandRank; value: number } {
  const allCards = [...holeCards, ...communityCards];
  const ranks = allCards.map(c => RANK_VALUES[c.rank]);
  const suits = allCards.map(c => c.suit);

  // 统计点数出现次数
  const rankCounts = new Map<number, number>();
  ranks.forEach(r => rankCounts.set(r, (rankCounts.get(r) || 0) + 1));

  // 统计花色出现次数
  const suitCounts = new Map<Suit, number>();
  suits.forEach(s => suitCounts.set(s, (suitCounts.get(s) || 0) + 1));

  // 检查同花
  const flushSuit = [...suitCounts.entries()].find(([_, count]) => count >= 5)?.[0];
  const hasFlush = !!flushSuit;

  // 获取同花牌
  const flushCards = hasFlush ? allCards.filter(c => c.suit === flushSuit).map(c => RANK_VALUES[c.rank]).sort((a, b) => b - a) : [];

  // 检查顺子
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
  let hasStraight = false;
  let straightHigh = 0;

  // 检查A-5顺子（轮子）
  if (uniqueRanks.includes(14)) {
    uniqueRanks.push(1); // A作为1
  }

  for (let i = 0; i <= uniqueRanks.length - 5; i++) {
    let consecutive = true;
    for (let j = 0; j < 4; j++) {
      if (uniqueRanks[i + j] - uniqueRanks[i + j + 1] !== 1) {
        consecutive = false;
        break;
      }
    }
    if (consecutive) {
      hasStraight = true;
      straightHigh = uniqueRanks[i];
      break;
    }
  }

  // 获取牌型组成
  const counts = [...rankCounts.values()].sort((a, b) => b - a);
  const pairs = counts.filter(c => c === 2).length;
  const threes = counts.filter(c => c === 3).length;
  const fours = counts.filter(c => c === 4).length;

  // 判断牌型
  let rank: HandRank;
  let value = 0;

  // 同花顺检测
  if (hasFlush && hasStraight) {
    const flushRanks = new Set(flushCards);
    let sfHigh = 0;
    for (let i = 0; i <= flushCards.length - 5; i++) {
      let consecutive = true;
      for (let j = 0; j < 4; j++) {
        if (!flushRanks.has(flushCards[i + j] - 1)) {
          consecutive = false;
          break;
        }
      }
      if (consecutive) {
        sfHigh = flushCards[i];
        break;
      }
    }

    if (sfHigh > 0) {
      if (sfHigh === 14) {
        rank = 'Royal Flush';
      } else {
        rank = 'Straight Flush';
      }
      value = 9000000 + sfHigh;
    } else {
      rank = 'Flush';
      value = 5000000 + flushCards.slice(0, 5).reduce((sum, v, i) => sum + v * Math.pow(15, 4 - i), 0);
    }
  }
  // 四条
  else if (fours >= 1) {
    rank = 'Four of a Kind';
    const quadRank = [...rankCounts.entries()].find(([_, c]) => c === 4)![0];
    const kicker = Math.max(...[...rankCounts.entries()].filter(([r, _]) => r !== quadRank).map(([r, _]) => r));
    value = 7000000 + quadRank * 100 + kicker;
  }
  // 葫芦
  else if (threes >= 1 && pairs >= 1) {
    rank = 'Full House';
    const tripRank = [...rankCounts.entries()].filter(([_, c]) => c === 3).map(([r, _]) => r).sort((a, b) => b - a)[0];
    const pairRank = [...rankCounts.entries()].filter(([_, c]) => c === 2).map(([r, _]) => r).sort((a, b) => b - a)[0];
    value = 6000000 + tripRank * 100 + pairRank;
  }
  // 同花
  else if (hasFlush) {
    rank = 'Flush';
    value = 5000000 + flushCards.slice(0, 5).reduce((sum, v, i) => sum + v * Math.pow(15, 4 - i), 0);
  }
  // 顺子
  else if (hasStraight) {
    rank = 'Straight';
    value = 4000000 + straightHigh;
  }
  // 三条
  else if (threes >= 1) {
    rank = 'Three of a Kind';
    const tripRank = [...rankCounts.entries()].find(([_, c]) => c === 3)![0];
    value = 3000000 + tripRank * 100;
  }
  // 两对
  else if (pairs >= 2) {
    rank = 'Two Pair';
    const pairRanks = [...rankCounts.entries()].filter(([_, c]) => c === 2).map(([r, _]) => r).sort((a, b) => b - a);
    value = 2000000 + pairRanks[0] * 100 + pairRanks[1];
  }
  // 一对
  else if (pairs >= 1) {
    rank = 'Pair';
    const pairRank = [...rankCounts.entries()].find(([_, c]) => c === 2)![0];
    value = 1000000 + pairRank * 100;
  }
  // 高牌
  else {
    rank = 'High Card';
    const sortedRanks = ranks.sort((a, b) => b - a).slice(0, 5);
    value = sortedRanks.reduce((sum, v, i) => sum + v * Math.pow(15, 4 - i), 0);
  }

  return { rank, value };
}

// 对手范围定义
const OPPONENT_RANGES: Record<OpponentType, HandCombo[]> = {
  random: [],
  tight: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', 'AKs', 'AQs', 'AJs', 'ATs', 'AKo', 'AQo', 'KQs', 'KJs', 'QJs', 'JTs'],
  loose: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', 'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s', 'KQs', 'KJs', 'KTs', 'K9s', 'QJs', 'QTs', 'JTs', 'T9s', '98s', 'AKo', 'AQo', 'AJo', 'ATo', 'A9o', 'KQo', 'KJo', 'QJo', 'JTo'],
  passive: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', 'AKs', 'AQs', 'AJs', 'ATs', 'KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs', 'T9s', '98s', 'AKo', 'AQo', 'AJo', 'ATo', 'KQo', 'KJo', 'QJo'],
  nit: ['AA', 'KK', 'QQ', 'AKs', 'AKo'],
  custom: []
};

// 检查组合是否在牌组中可用
function isComboAvailable(combo: HandCombo, deck: Card[]): boolean {
  if (combo.length === 2 && combo[0] === combo[1]) {
    // 对子
    const rank = combo[0] as Rank;
    const availableCards = deck.filter(c => c.rank === rank);
    return availableCards.length >= 2;
  } else {
    const rank1 = combo[0] as Rank;
    const rank2 = combo[1] as Rank;
    const suited = combo[2] === 's';

    if (suited) {
      // 同花：找两张同花色的牌
      return SUITS.some(suit =>
        deck.some(c => c.rank === rank1 && c.suit === suit) &&
        deck.some(c => c.rank === rank2 && c.suit === suit)
      );
    } else {
      // 非同花：找两张不同花色的牌
      return SUITS.some(suit1 =>
        SUITS.some(suit2 =>
          suit1 !== suit2 &&
          deck.some(c => c.rank === rank1 && c.suit === suit1) &&
          deck.some(c => c.rank === rank2 && c.suit === suit2)
        )
      );
    }
  }
}

// 从范围中获取可用的组合列表
function getAvailableCombos(range: HandCombo[], deck: Card[]): HandCombo[] {
  return range.filter(combo => isComboAvailable(combo, deck));
}

// 组合解析为具体牌（从可用牌组中选择）
function comboToCards(combo: HandCombo, deck: Card[]): Card[] {
  if (combo.length === 2 && combo[0] === combo[1]) {
    // 对子
    const rank = combo[0] as Rank;
    const suitedCards = deck.filter(c => c.rank === rank);
    if (suitedCards.length >= 2) {
      return [suitedCards[0], suitedCards[1]];
    }
  } else {
    const rank1 = combo[0] as Rank;
    const rank2 = combo[1] as Rank;
    const suited = combo[2] === 's';

    if (suited) {
      for (const suit of SUITS) {
        const card1 = deck.find(c => c.rank === rank1 && c.suit === suit);
        const card2 = deck.find(c => c.rank === rank2 && c.suit === suit);
        if (card1 && card2) {
          return [card1, card2];
        }
      }
    } else {
      for (const suit1 of SUITS) {
        for (const suit2 of SUITS) {
          if (suit1 !== suit2) {
            const card1 = deck.find(c => c.rank === rank1 && c.suit === suit1);
            const card2 = deck.find(c => c.rank === rank2 && c.suit === suit2);
            if (card1 && card2) {
              return [card1, card2];
            }
          }
        }
      }
    }
  }
  return [];
}

// Worker 消息类型
interface SimulationRequest {
  type: 'simulate';
  playerHand: Card[] | null;
  playerRange?: HandCombo[];
  communityCards: Card[];
  opponentType: OpponentType;
  opponentCount: number;
  simulations: number;
}

interface ProgressUpdate {
  type: 'progress';
  progress: number;
  currentWins: number;
  currentTies: number;
  currentLosses: number;
  currentSimulations: number;
}

interface ComboEquityData {
  wins: number;
  total: number;
  equity: number;
}

interface HistogramBucket {
  rangeStart: number;
  rangeEnd: number;
  count: number;
}

interface SimulationResult {
  type: 'complete';
  win: number;
  tie: number;
  lose: number;
  simulations: number;
  confidence: number;
  handRank?: HandRank;
  outs?: number;
  equityByCombo?: Record<HandCombo, ComboEquityData>;
  equityHistogram?: HistogramBucket[];
}

type WorkerMessage = SimulationRequest;
type WorkerResponse = ProgressUpdate | SimulationResult;

// 主模拟函数（带进度报告）
function runSimulation(request: SimulationRequest): void {
  const { playerHand, playerRange, communityCards, opponentType, opponentCount, simulations } = request;

  // 判断是否使用 Range 模式
  const isRangeMode = playerRange && playerRange.length > 0;

  if (isRangeMode) {
    runRangeSimulation(playerRange!, communityCards, opponentType, opponentCount, simulations);
  } else if (playerHand && playerHand.length === 2) {
    runSingleHandSimulation(playerHand, communityCards, opponentType, opponentCount, simulations);
  }
}

// ============================================
// 🔥 HIGH-PERFORMANCE BITMASK ENGINE
// ============================================

// Suit → index mapping (s=0, h=1, d=2, c=3 — matches SUITS order)
const SUIT_IDX: Record<Suit, number> = { 's': 0, 'h': 1, 'd': 2, 'c': 3 };

// Rank char → 0-12 (2=0, 3=1, ..., A=12) for CardIndex encoding
const RANK_IDX: Record<string, number> = {
  '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6,
  '9': 7, 'T': 8, 'J': 9, 'Q': 10, 'K': 11, 'A': 12
};

// Pre-encoded hand: two card indices + split bitmask for O(1) conflict
interface FastHand {
  c1: number;    // CardIndex 0-51
  c2: number;    // CardIndex 0-51
  lo: number;    // bitmask bits 0-25 (cards 0-25)
  hi: number;    // bitmask bits 0-25 (cards 26-51)
  combo: string; // original combo name
}

function cardToIdx(card: Card): number {
  return (RANK_VALUES[card.rank] - 2) * 4 + SUIT_IDX[card.suit];
}

function bitLo(card: number): number { return card < 26 ? (1 << card) : 0; }
function bitHi(card: number): number { return card >= 26 ? (1 << (card - 26)) : 0; }

// Expand "AA", "AKs", "AKo" → all concrete [c1, c2] pairs
function expandCombo(combo: HandCombo): FastHand[] {
  const hands: FastHand[] = [];
  const r1 = RANK_IDX[combo[0]];
  if (r1 === undefined) return [];

  if (combo.length === 2 && combo[0] === combo[1]) {
    // Pocket pair: C(4,2) = 6 combos
    for (let s1 = 0; s1 < 4; s1++) {
      for (let s2 = s1 + 1; s2 < 4; s2++) {
        const c1 = r1 * 4 + s1, c2 = r1 * 4 + s2;
        hands.push({ c1, c2, lo: bitLo(c1) | bitLo(c2), hi: bitHi(c1) | bitHi(c2), combo });
      }
    }
  } else {
    const r2 = RANK_IDX[combo[1]];
    if (r2 === undefined) return [];
    const isSuited = combo[2] === 's';
    if (isSuited) {
      for (let s = 0; s < 4; s++) {
        const c1 = r1 * 4 + s, c2 = r2 * 4 + s;
        hands.push({ c1, c2, lo: bitLo(c1) | bitLo(c2), hi: bitHi(c1) | bitHi(c2), combo });
      }
    } else {
      // offsuit (also handles no-suffix non-pair)
      for (let s1 = 0; s1 < 4; s1++) {
        for (let s2 = 0; s2 < 4; s2++) {
          if (s1 !== s2) {
            const c1 = r1 * 4 + s1, c2 = r2 * 4 + s2;
            hands.push({ c1, c2, lo: bitLo(c1) | bitLo(c2), hi: bitHi(c1) | bitHi(c2), combo });
          }
        }
      }
    }
  }
  return hands;
}

// 7-card evaluator working directly on CardIndex (0-51)
// Returns numeric score: higher = better.  Properly ranks all hand types.
function evaluateFast7(indices: number[]): number {
  const rc = new Int8Array(13); // rank counts
  const sc = new Int8Array(4);  // suit counts
  const sr: number[][] = [[], [], [], []]; // ranks per suit

  for (let i = 0; i < indices.length; i++) {
    const r = indices[i] >> 2;   // rank = floor(idx/4)
    const s = indices[i] & 3;    // suit = idx % 4
    rc[r]++;
    sc[s]++;
    sr[s].push(r);
  }

  // Flush suit?
  let fSuit = -1;
  for (let s = 0; s < 4; s++) { if (sc[s] >= 5) { fSuit = s; break; } }

  // Straight detection (works on any set of ranks)
  function findStraightHigh(ranks: number[]): number {
    const has = new Uint8Array(14);
    for (const r of ranks) has[r] = 1;
    // Check A-high(12) down to 5-high(3), then wheel(A=low)
    for (let top = 12; top >= 3; top--) {
      if (has[top] && has[top - 1] && has[top - 2] && has[top - 3] && has[top === 3 ? 12 : top - 4]) {
        return top;
      }
    }
    return -1;
  }

  // Unique ranks present
  const uRanks: number[] = [];
  for (let r = 12; r >= 0; r--) { if (rc[r] > 0) uRanks.push(r); }

  const straightH = findStraightHigh(uRanks);

  // Straight flush check
  if (fSuit >= 0) {
    const sfH = findStraightHigh(sr[fSuit]);
    if (sfH >= 0) return sfH === 12 ? 9000014 : 8000000 + sfH;
  }

  // Count multiples
  let quads = -1, trips = -1, trips2 = -1;
  const pairR: number[] = [];
  for (let r = 12; r >= 0; r--) {
    if (rc[r] === 4) quads = r;
    else if (rc[r] === 3) { if (trips < 0) trips = r; else trips2 = r; }
    else if (rc[r] === 2) pairR.push(r);
  }

  if (quads >= 0) {
    const k = uRanks.find(r => r !== quads) || 0;
    return 7000000 + quads * 100 + k;
  }
  if (trips >= 0 && (pairR.length > 0 || trips2 >= 0)) {
    const p = trips2 >= 0 ? Math.max(trips2, pairR[0] ?? -1) : pairR[0];
    return 6000000 + trips * 100 + (p ?? 0);
  }
  if (fSuit >= 0) {
    const fr = sr[fSuit].sort((a, b) => b - a);
    return 5000000 + fr[0] * 50625 + fr[1] * 3375 + fr[2] * 225 + fr[3] * 15 + fr[4];
  }
  if (straightH >= 0) return 4000000 + straightH;
  if (trips >= 0) {
    const k = uRanks.filter(r => r !== trips);
    return 3000000 + trips * 10000 + (k[0] || 0) * 100 + (k[1] || 0);
  }
  if (pairR.length >= 2) {
    const k = uRanks.find(r => r !== pairR[0] && r !== pairR[1]) || 0;
    return 2000000 + pairR[0] * 10000 + pairR[1] * 100 + k;
  }
  if (pairR.length === 1) {
    const k = uRanks.filter(r => r !== pairR[0]);
    return 1000000 + pairR[0] * 1000000 + (k[0] || 0) * 10000 + (k[1] || 0) * 100 + (k[2] || 0);
  }
  // High card
  return uRanks[0] * 50625 + uRanks[1] * 3375 + uRanks[2] * 225 + uRanks[3] * 15 + uRanks[4];
}

// Pre-allocated deck buffer for zero-alloc per-iteration
const _deckBuf = new Int32Array(52);

function buildDeckExcluding(dLo: number, dHi: number): number {
  let n = 0;
  for (let i = 0; i < 26; i++) { if (!((dLo >>> i) & 1)) _deckBuf[n++] = i; }
  for (let i = 0; i < 26; i++) { if (!((dHi >>> i) & 1)) _deckBuf[n++] = i + 26; }
  return n;
}

// Partial Fisher-Yates (shuffle first k elements)
function partialShuffle(len: number, k: number): void {
  for (let i = 0; i < k && i < len - 1; i++) {
    const j = i + Math.floor(Math.random() * (len - i));
    const tmp = _deckBuf[i]; _deckBuf[i] = _deckBuf[j]; _deckBuf[j] = tmp;
  }
}

// 🔥 High-performance Range vs Range (single-layer MC, bitmask conflicts)
function runRangeSimulation(
  playerRange: HandCombo[],
  communityCards: Card[],
  opponentType: OpponentType,
  opponentCount: number,
  simulations: number
): void {
  // === PRE-ENCODE PHASE (one-time cost) ===
  const heroHands: FastHand[] = [];
  for (const combo of playerRange) heroHands.push(...expandCombo(combo));

  const oppRangeCombos = OPPONENT_RANGES[opponentType];
  const useOppRange = opponentType !== 'random' && oppRangeCombos.length > 0;
  const villainHands = useOppRange ? ([] as FastHand[]) : null;
  if (villainHands) {
    for (const combo of oppRangeCombos) villainHands.push(...expandCombo(combo));
  }

  // Board bitmask
  let boardLo = 0, boardHi = 0;
  const boardIdx: number[] = [];
  for (const c of communityCards) {
    const idx = cardToIdx(c);
    boardIdx.push(idx);
    boardLo |= bitLo(idx);
    boardHi |= bitHi(idx);
  }
  const cardsNeeded = 5 - boardIdx.length;

  // Per-combo tracking
  const comboStats: Record<string, { wins: number; ties: number; total: number }> = {};
  for (const combo of playerRange) comboStats[combo] = { wins: 0, ties: 0, total: 0 };

  let totalWins = 0, totalTies = 0, totalLosses = 0, validSims = 0;
  const progressInterval = Math.max(1000, Math.floor(simulations / 20));

  if (heroHands.length === 0) return;

  // === MAIN SIMULATION LOOP (single-layer MC) ===
  const eval7buf = new Array(7);

  for (let iter = 0; iter < simulations; iter++) {
    // 1. Sample random hero hand
    const hero = heroHands[Math.floor(Math.random() * heroHands.length)];
    if ((hero.lo & boardLo) || (hero.hi & boardHi)) continue; // board conflict

    let deadLo = hero.lo | boardLo;
    let deadHi = hero.hi | boardHi;

    // 2. Sample villain hand(s)
    let villainC1 = -1, villainC2 = -1;
    let valid = true;

    if (villainHands) {
      const v = villainHands[Math.floor(Math.random() * villainHands.length)];
      if ((v.lo & deadLo) || (v.hi & deadHi)) continue; // conflict
      villainC1 = v.c1; villainC2 = v.c2;
      deadLo |= v.lo; deadHi |= v.hi;
    } else {
      // Random opponent: deal from remaining deck
      const deckLen = buildDeckExcluding(deadLo, deadHi);
      if (deckLen < 2 + cardsNeeded) continue;
      partialShuffle(deckLen, 2 + cardsNeeded);
      villainC1 = _deckBuf[0]; villainC2 = _deckBuf[1];
      // Board cards come from _deckBuf[2..2+cardsNeeded]
      eval7buf[0] = hero.c1; eval7buf[1] = hero.c2;
      eval7buf[2] = villainC1; eval7buf[3] = villainC2; // temp for villain
      let bi = 0;
      for (; bi < boardIdx.length; bi++) eval7buf[2 + bi] = boardIdx[bi];
      for (let j = 0; j < cardsNeeded; j++) eval7buf[2 + bi + j] = _deckBuf[2 + j];

      // Evaluate — hero
      const heroCards7 = [hero.c1, hero.c2];
      for (let b = 0; b < boardIdx.length; b++) heroCards7.push(boardIdx[b]);
      for (let j = 0; j < cardsNeeded; j++) heroCards7.push(_deckBuf[2 + j]);
      const heroScore = evaluateFast7(heroCards7);

      const villCards7 = [villainC1, villainC2];
      for (let b = 0; b < boardIdx.length; b++) villCards7.push(boardIdx[b]);
      for (let j = 0; j < cardsNeeded; j++) villCards7.push(_deckBuf[2 + j]);
      const villScore = evaluateFast7(villCards7);

      if (heroScore > villScore) { totalWins++; comboStats[hero.combo].wins++; }
      else if (heroScore === villScore) { totalTies++; comboStats[hero.combo].ties++; }
      else { totalLosses++; }
      comboStats[hero.combo].total++;
      validSims++;

      if (validSims % progressInterval === 0) {
        self.postMessage({
          type: 'progress', progress: (validSims / simulations) * 100,
          currentWins: totalWins, currentTies: totalTies,
          currentLosses: totalLosses, currentSimulations: validSims
        } as ProgressUpdate);
      }
      continue;
    }

    // 3. Deal remaining board (ranged opponent path)
    const deckLen = buildDeckExcluding(deadLo, deadHi);
    if (deckLen < cardsNeeded) continue;
    partialShuffle(deckLen, cardsNeeded);

    const heroCards7 = [hero.c1, hero.c2, ...boardIdx];
    const villCards7 = [villainC1, villainC2, ...boardIdx];
    for (let j = 0; j < cardsNeeded; j++) {
      heroCards7.push(_deckBuf[j]);
      villCards7.push(_deckBuf[j]);
    }

    const heroScore = evaluateFast7(heroCards7);
    const villScore = evaluateFast7(villCards7);

    if (heroScore > villScore) { totalWins++; comboStats[hero.combo].wins++; }
    else if (heroScore === villScore) { totalTies++; comboStats[hero.combo].ties++; }
    else { totalLosses++; }
    comboStats[hero.combo].total++;
    validSims++;

    if (validSims % progressInterval === 0) {
      self.postMessage({
        type: 'progress', progress: (validSims / simulations) * 100,
        currentWins: totalWins, currentTies: totalTies,
        currentLosses: totalLosses, currentSimulations: validSims
      } as ProgressUpdate);
    }
  }

  // === OUTPUT PHASE ===
  const equityByCombo: Record<HandCombo, ComboEquityData> = {} as any;
  for (const combo of playerRange) {
    const s = comboStats[combo];
    equityByCombo[combo] = {
      wins: s.wins, total: s.total,
      equity: s.total > 0 ? (s.wins / s.total) * 100 : 0
    };
  }

  const histogram: HistogramBucket[] = [];
  for (let i = 0; i < 10; i++) histogram.push({ rangeStart: i * 10, rangeEnd: (i + 1) * 10, count: 0 });
  for (const combo of playerRange) {
    const bucket = Math.min(9, Math.floor(equityByCombo[combo].equity / 10));
    histogram[bucket].count++;
  }

  const confidence = validSims > 0
    ? 1.96 * Math.sqrt((totalWins / validSims * (1 - totalWins / validSims)) / validSims) * 100
    : 0;

  self.postMessage({
    type: 'complete',
    win: validSims > 0 ? (totalWins / validSims) * 100 : 0,
    tie: validSims > 0 ? (totalTies / validSims) * 100 : 0,
    lose: validSims > 0 ? (totalLosses / validSims) * 100 : 0,
    simulations: validSims,
    confidence: Math.round((1 - confidence / 100) * 1000) / 10,
    equityByCombo,
    equityHistogram: histogram
  } as SimulationResult);
}

// 单手牌模拟 (原有逻辑)
function runSingleHandSimulation(
  playerHand: Card[],
  communityCards: Card[],
  opponentType: OpponentType,
  opponentCount: number,
  simulations: number
): void {
  let wins = 0;
  let ties = 0;
  let losses = 0;
  let validSimulations = 0;
  let skippedSimulations = 0;
  const maxSkips = simulations * 2;

  const opponentRange = OPPONENT_RANGES[opponentType];
  const useRange = opponentType !== 'random' && opponentRange.length > 0;

  const progressInterval = Math.max(1000, Math.floor(simulations / 20));
  let lastProgressReport = 0;

  let currentHandRank: HandRank | undefined;
  if (communityCards.length >= 3) {
    const result = evaluateHand(playerHand, communityCards);
    currentHandRank = result.rank;
  }

  let outs: number | undefined;
  if (communityCards.length >= 3 && communityCards.length < 5) {
    outs = calculatePreciseOuts(playerHand, communityCards, opponentType, opponentCount);
  }

  while (validSimulations < simulations && skippedSimulations < maxSkips) {
    let deck = createDeck();
    deck = shuffleDeck(deck);
    deck = removeCards(deck, [...playerHand, ...communityCards]);

    const opponentHands: Card[][] = [];
    let validOpponents = true;

    for (let j = 0; j < opponentCount; j++) {
      let oppCards: Card[];
      if (useRange) {
        const availableCombos = getAvailableCombos(opponentRange, deck);
        if (availableCombos.length === 0) { validOpponents = false; skippedSimulations++; break; }
        const randomCombo = availableCombos[Math.floor(Math.random() * availableCombos.length)];
        oppCards = comboToCards(randomCombo, deck);
      } else {
        oppCards = [deck[0], deck[1]];
      }
      if (oppCards.length !== 2) { validOpponents = false; skippedSimulations++; break; }
      opponentHands.push(oppCards);
      deck = removeCards(deck, oppCards);
    }

    if (!validOpponents) continue;

    const remainingCommunity = 5 - communityCards.length;
    const runOut = deck.slice(0, remainingCommunity);
    const finalCommunity = [...communityCards, ...runOut];

    const playerResult = evaluateHand(playerHand, finalCommunity);
    const opponentResults = opponentHands.map(h => evaluateHand(h, finalCommunity));
    const bestOpponent = Math.max(...opponentResults.map(r => r.value));

    if (playerResult.value > bestOpponent) wins++;
    else if (playerResult.value === bestOpponent) ties++;
    else losses++;

    validSimulations++;

    if (validSimulations - lastProgressReport >= progressInterval) {
      lastProgressReport = validSimulations;
      self.postMessage({
        type: 'progress',
        progress: (validSimulations / simulations) * 100,
        currentWins: wins,
        currentTies: ties,
        currentLosses: losses,
        currentSimulations: validSimulations
      } as ProgressUpdate);
    }
  }

  const confidence = 1.96 * Math.sqrt((wins / validSimulations * (1 - wins / validSimulations)) / validSimulations) * 100;

  self.postMessage({
    type: 'complete',
    win: (wins / validSimulations) * 100,
    tie: (ties / validSimulations) * 100,
    lose: (losses / validSimulations) * 100,
    simulations: validSimulations,
    confidence: Math.round((1 - confidence / 100) * 1000) / 10,
    handRank: currentHandRank,
    outs
  } as SimulationResult);
}

// 精确计算 Outs（通过蒙特卡洛采样）
function calculatePreciseOuts(
  playerHand: Card[],
  communityCards: Card[],
  opponentType: OpponentType,
  opponentCount: number,
  samples: number = 1000
): number {
  if (communityCards.length >= 5) return 0;

  // 首先计算当前胜率
  let currentWins = 0;
  let currentSamples = 0;

  for (let i = 0; i < samples; i++) {
    let deck = createDeck();
    deck = shuffleDeck(deck);
    deck = removeCards(deck, [...playerHand, ...communityCards]);

    // 为对手发牌
    const opponentHands: Card[][] = [];
    let valid = true;

    for (let j = 0; j < opponentCount; j++) {
      const oppCards = [deck[0], deck[1]];
      opponentHands.push(oppCards);
      deck = removeCards(deck, oppCards);
    }

    if (!valid) continue;

    // 发完公共牌
    const remainingCommunity = 5 - communityCards.length;
    const runOut = deck.slice(0, remainingCommunity);
    const finalCommunity = [...communityCards, ...runOut];

    const playerResult = evaluateHand(playerHand, finalCommunity);
    const opponentResults = opponentHands.map(h => evaluateHand(h, finalCommunity));
    const bestOpponent = Math.max(...opponentResults.map(r => r.value));

    if (playerResult.value >= bestOpponent) {
      currentWins++;
    }
    currentSamples++;
  }

  const currentWinRate = currentSamples > 0 ? currentWins / currentSamples : 0;

  // 如果已经领先，不需要计算 outs
  if (currentWinRate > 0.5) {
    return 0;
  }

  // 统计每种剩余牌对胜率的提升
  const deck = createDeck();
  const remainingDeck = removeCards(deck, [...playerHand, ...communityCards]);
  const outsCards: Card[] = [];

  // 简化：只统计下一张牌（转牌或河牌）的 outs
  for (const nextCard of remainingDeck.slice(0, 20)) { // 采样前20张牌
    let improvedWins = 0;
    let improvedSamples = 0;

    for (let i = 0; i < samples / 10; i++) {
      let simDeck = removeCards(remainingDeck, [nextCard]);
      simDeck = shuffleDeck(simDeck);

      const opponentHands: Card[][] = [];
      for (let j = 0; j < opponentCount; j++) {
        opponentHands.push([simDeck[0], simDeck[1]]);
        simDeck = removeCards(simDeck, [simDeck[0], simDeck[1]]);
      }

      const newCommunity = [...communityCards, nextCard];
      const remainingCommunity = 5 - newCommunity.length;
      const runOut = simDeck.slice(0, remainingCommunity);
      const finalCommunity = [...newCommunity, ...runOut];

      const playerResult = evaluateHand(playerHand, finalCommunity);
      const opponentResults = opponentHands.map(h => evaluateHand(h, finalCommunity));
      const bestOpponent = Math.max(...opponentResults.map(r => r.value));

      if (playerResult.value >= bestOpponent) {
        improvedWins++;
      }
      improvedSamples++;
    }

    const improvedWinRate = improvedSamples > 0 ? improvedWins / improvedSamples : 0;

    // 如果这张牌能显著提升胜率（提升 5% 以上），算作 out
    if (improvedWinRate - currentWinRate > 0.05) {
      outsCards.push(nextCard);
    }
  }

  // 估算总 outs（根据采样比例推算）
  const estimatedOuts = Math.round(outsCards.length * (remainingDeck.length / 20));

  return Math.min(21, estimatedOuts); // 最大 21 张 outs
}

// Worker 消息监听
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  if (message.type === 'simulate') {
    runSimulation(message);
  }
};

export { };
