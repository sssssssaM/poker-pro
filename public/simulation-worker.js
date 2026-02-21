// ============================================
// Monte Carlo Web Worker v2
// 高性能引擎: CardIndex + Bitmask Deck
// 支持: 权重 Range, 多玩家独立 Range
// ============================================

// ============================================
// 1. 内联引擎 (Worker 不支持 ES import)
// ============================================

// --- card.ts 内联 ---
function makeCard(rank, suit) { return rank * 4 + suit; }
function cardRank(card) { return card >> 2; }
function cardSuit(card) { return card & 3; }

function fullDeck() { return [0xFFFFFFFF, 0x000FFFFF]; }
function hasCard(deck, card) {
  return card < 32 ? (deck[0] & (1 << card)) !== 0 : (deck[1] & (1 << (card - 32))) !== 0;
}
function removeCardFromDeck(deck, card) {
  if (card < 32) deck[0] &= ~(1 << card);
  else deck[1] &= ~(1 << (card - 32));
}
function cloneDeck(deck) { return [deck[0], deck[1]]; }

function popCount32(n) {
  n = n - ((n >> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
  return (((n + (n >> 4)) & 0x0F0F0F0F) * 0x01010101) >> 24;
}
function popCount(deck) { return popCount32(deck[0]) + popCount32(deck[1]); }

function drawRandom(deck) {
  const count = popCount(deck);
  if (count === 0) return -1;
  let target = Math.floor(Math.random() * count);
  let bits = deck[0];
  while (bits) {
    const lsb = bits & (-bits);
    if (target === 0) {
      const card = Math.clz32(lsb) ^ 31;
      removeCardFromDeck(deck, card);
      return card;
    }
    target--;
    bits ^= lsb;
  }
  bits = deck[1];
  while (bits) {
    const lsb = bits & (-bits);
    if (target === 0) {
      const card = (Math.clz32(lsb) ^ 31) + 32;
      removeCardFromDeck(deck, card);
      return card;
    }
    target--;
    bits ^= lsb;
  }
  return -1;
}

function drawN(deck, n) {
  const result = [];
  for (let i = 0; i < n; i++) {
    const c = drawRandom(deck);
    if (c === -1) break;
    result.push(c);
  }
  return result;
}

// --- evaluator.ts 内联 ---
const HIGH_CARD = 0, PAIR = 1, TWO_PAIR = 2, THREE_KIND = 3;
const STRAIGHT = 4, FLUSH = 5, FULL_HOUSE = 6, FOUR_KIND = 7, STRAIGHT_FLUSH = 8;

const HAND_RANK_NAMES = {
  0: 'High Card', 1: 'Pair', 2: 'Two Pair', 3: 'Three of a Kind',
  4: 'Straight', 5: 'Flush', 6: 'Full House', 7: 'Four of a Kind',
  8: 'Straight Flush'
};

function evaluate7(cards) {
  const rc = new Int8Array(13);
  const sc = new Int8Array(4);
  const suitCards = [[], [], [], []];

  for (let i = 0; i < cards.length; i++) {
    const r = cardRank(cards[i]);
    const s = cardSuit(cards[i]);
    rc[r]++;
    sc[s]++;
    suitCards[s].push(cards[i]);
  }

  let flushSuit = -1;
  for (let s = 0; s < 4; s++) { if (sc[s] >= 5) { flushSuit = s; break; } }

  const straightHigh = findStraightHigh(rc);

  // 同花顺
  if (flushSuit >= 0 && straightHigh >= 0) {
    const frc = new Int8Array(13);
    for (const c of suitCards[flushSuit]) frc[cardRank(c)]++;
    const sfHigh = findStraightHigh(frc);
    if (sfHigh >= 0) return STRAIGHT_FLUSH * 1000000 + sfHigh;
  }

  // 四条
  const fourR = findNOfAKind(rc, 4);
  if (fourR >= 0) {
    const k = findBestKickers(rc, fourR, -1, 1);
    return FOUR_KIND * 1000000 + fourR * 15 + k[0];
  }

  // 葫芦
  const threeR = findNOfAKind(rc, 3);
  if (threeR >= 0) {
    const secondThree = findNOfAKindExcl(rc, 3, threeR);
    const pairR = findNOfAKindExcl(rc, 2, threeR);
    const bestPair = Math.max(secondThree, pairR);
    if (bestPair >= 0) return FULL_HOUSE * 1000000 + threeR * 15 + bestPair;
  }

  // 同花
  if (flushSuit >= 0) {
    const fRanks = suitCards[flushSuit].map(c => cardRank(c)).sort((a, b) => b - a).slice(0, 5);
    return FLUSH * 1000000 + encKickers(fRanks);
  }

  // 顺子
  if (straightHigh >= 0) return STRAIGHT * 1000000 + straightHigh;

  // 三条
  if (threeR >= 0) {
    const k = findBestKickers(rc, threeR, -1, 2);
    return THREE_KIND * 1000000 + threeR * 225 + encKickers(k);
  }

  // 两对 / 一对
  const pairs = findAllPairs(rc);
  if (pairs.length >= 2) {
    const k = findBestKickers(rc, pairs[0], pairs[1], 1);
    return TWO_PAIR * 1000000 + pairs[0] * 225 + pairs[1] * 15 + k[0];
  }
  if (pairs.length === 1) {
    const k = findBestKickers(rc, pairs[0], -1, 3);
    return PAIR * 1000000 + pairs[0] * 3375 + encKickers(k);
  }

  // 高牌
  const k = findBestKickers(rc, -1, -1, 5);
  return HIGH_CARD * 1000000 + encKickers(k);
}

// 预计算顺子 bitmask 模式
const STRAIGHT_PATS = [
  { m: 0b1111100000000, h: 14 }, { m: 0b0111110000000, h: 13 },
  { m: 0b0011111000000, h: 12 }, { m: 0b0001111100000, h: 11 },
  { m: 0b0000111110000, h: 10 }, { m: 0b0000011111000, h: 9 },
  { m: 0b0000001111100, h: 8 }, { m: 0b0000000111110, h: 7 },
  { m: 0b0000000011111, h: 6 }, { m: 0b1000000001111, h: 5 }
];

function findStraightHigh(rc) {
  let mask = 0;
  for (let r = 0; r < 13; r++) { if (rc[r] > 0) mask |= (1 << r); }
  for (const p of STRAIGHT_PATS) { if ((mask & p.m) === p.m) return p.h; }
  return -1;
}

function findNOfAKind(rc, n) {
  for (let r = 12; r >= 0; r--) { if (rc[r] >= n) return r; }
  return -1;
}

function findNOfAKindExcl(rc, n, excl) {
  for (let r = 12; r >= 0; r--) { if (r !== excl && rc[r] >= n) return r; }
  return -1;
}

function findAllPairs(rc) {
  const p = [];
  for (let r = 12; r >= 0; r--) { if (rc[r] === 2) p.push(r); }
  return p;
}

function findBestKickers(rc, excl1, excl2, n) {
  const k = [];
  for (let r = 12; r >= 0 && k.length < n; r--) {
    if (rc[r] > 0 && r !== excl1 && r !== excl2) k.push(r);
  }
  return k;
}

function encKickers(k) {
  let v = 0;
  for (let i = 0; i < k.length; i++) v = v * 15 + k[i];
  return v;
}

// ============================================
// 2. Range 工具 (简化版: 接收预展开的 combos)
// ============================================

function sampleComboFromList(combos, deck) {
  // combos = [{ card1, card2, combo, weight }]
  // 先过滤可用的
  const avail = [];
  for (let i = 0; i < combos.length; i++) {
    if (hasCard(deck, combos[i].card1) && hasCard(deck, combos[i].card2)) {
      avail.push(combos[i]);
    }
  }
  if (avail.length === 0) return null;

  // Rejection sampling (权重)
  for (let attempt = 0; attempt < 50; attempt++) {
    const c = avail[Math.floor(Math.random() * avail.length)];
    if (c.weight >= 100 || Math.random() * 100 < c.weight) return c;
  }
  return avail[Math.floor(Math.random() * avail.length)];
}

// ============================================
// 3. 旧协议兼容 (Legacy)
// ============================================

const RANK_CHARS = '23456789TJQKA';
const SUIT_CHARS = 'cdhs';

function parseCardObj(obj) {
  const r = RANK_CHARS.indexOf(obj.rank);
  const s = SUIT_CHARS.indexOf(obj.suit);
  return makeCard(r, s);
}

// Legacy opponent ranges
const OPPONENT_RANGES = {
  random: [],
  tight: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', 'AKs', 'AQs', 'AJs', 'ATs', 'AKo', 'AQo', 'KQs', 'KJs', 'QJs', 'JTs'],
  loose: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', 'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s', 'KQs', 'KJs', 'KTs', 'K9s', 'QJs', 'QTs', 'JTs', 'T9s', '98s', 'AKo', 'AQo', 'AJo', 'ATo', 'A9o', 'KQo', 'KJo', 'QJo', 'JTo'],
  passive: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', 'AKs', 'AQs', 'AJs', 'ATs', 'KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs', 'T9s', '98s', 'AKo', 'AQo', 'AJo', 'ATo', 'KQo', 'KJo', 'QJo'],
  nit: ['AA', 'KK', 'QQ', 'AKs', 'AKo'],
  custom: []
};

const RANK_ORDER = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

// 将 legacy combo 名 (如 "AKs") 展开为 WeightedCombo[]
function expandLegacyCombo(comboName) {
  const combos = [];
  if (comboName.length === 2 && comboName[0] === comboName[1]) {
    const r = 12 - RANK_ORDER.indexOf(comboName[0]);
    for (let s1 = 0; s1 < 4; s1++) {
      for (let s2 = s1 + 1; s2 < 4; s2++) {
        combos.push({ card1: makeCard(r, s1), card2: makeCard(r, s2), combo: comboName, weight: 100 });
      }
    }
  } else if (comboName[2] === 's') {
    const r1 = 12 - RANK_ORDER.indexOf(comboName[0]);
    const r2 = 12 - RANK_ORDER.indexOf(comboName[1]);
    for (let s = 0; s < 4; s++) {
      combos.push({ card1: makeCard(r1, s), card2: makeCard(r2, s), combo: comboName, weight: 100 });
    }
  } else if (comboName[2] === 'o') {
    const r1 = 12 - RANK_ORDER.indexOf(comboName[0]);
    const r2 = 12 - RANK_ORDER.indexOf(comboName[1]);
    for (let s1 = 0; s1 < 4; s1++) {
      for (let s2 = 0; s2 < 4; s2++) {
        if (s1 !== s2) combos.push({ card1: makeCard(r1, s1), card2: makeCard(r2, s2), combo: comboName, weight: 100 });
      }
    }
  }
  return combos;
}

function expandLegacyRange(rangeNames) {
  const all = [];
  for (const name of rangeNames) all.push(...expandLegacyCombo(name));
  return all;
}

// ============================================
// 4. 主模拟函数
// ============================================

// ============================================
// 精确枚举 (River / Turn)
// ============================================

function deckToArray(deck) {
  const result = [];
  let bits = deck[0];
  while (bits) { const lsb = bits & (-bits); result.push(Math.clz32(lsb) ^ 31); bits ^= lsb; }
  bits = deck[1];
  while (bits) { const lsb = bits & (-bits); result.push((Math.clz32(lsb) ^ 31) + 32); bits ^= lsb; }
  return result;
}

function exactRiver(heroCards, boardCards, oppCombos) {
  const dead = fullDeck();
  for (const c of boardCards) removeCardFromDeck(dead, c);
  removeCardFromDeck(dead, heroCards[0]);
  removeCardFromDeck(dead, heroCards[1]);

  const heroValue = evaluate7([heroCards[0], heroCards[1], ...boardCards]);
  let wins = 0, ties = 0, losses = 0;

  if (oppCombos) {
    for (const vc of oppCombos) {
      if (!hasCard(dead, vc.card1) || !hasCard(dead, vc.card2)) continue;
      const vv = evaluate7([vc.card1, vc.card2, ...boardCards]);
      if (heroValue > vv) wins++; else if (heroValue === vv) ties++; else losses++;
    }
  } else {
    const avail = deckToArray(dead);
    for (let i = 0; i < avail.length; i++) {
      for (let j = i + 1; j < avail.length; j++) {
        const vv = evaluate7([avail[i], avail[j], ...boardCards]);
        if (heroValue > vv) wins++; else if (heroValue === vv) ties++; else losses++;
      }
    }
  }
  return { wins, ties, losses, total: wins + ties + losses };
}

function exactTurn(heroCards, boardCards, oppCombos) {
  const baseDead = fullDeck();
  for (const c of boardCards) removeCardFromDeck(baseDead, c);
  removeCardFromDeck(baseDead, heroCards[0]);
  removeCardFromDeck(baseDead, heroCards[1]);

  const remaining = deckToArray(baseDead);
  let wins = 0, ties = 0, losses = 0;

  for (const river of remaining) {
    const board5 = [...boardCards, river];
    const heroValue = evaluate7([heroCards[0], heroCards[1], ...board5]);

    if (oppCombos) {
      for (const vc of oppCombos) {
        if (vc.card1 === river || vc.card2 === river) continue;
        if (!hasCard(baseDead, vc.card1) || !hasCard(baseDead, vc.card2)) continue;
        const vv = evaluate7([vc.card1, vc.card2, ...board5]);
        if (heroValue > vv) wins++; else if (heroValue === vv) ties++; else losses++;
      }
    } else {
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i] === river) continue;
        for (let j = i + 1; j < remaining.length; j++) {
          if (remaining[j] === river) continue;
          const vv = evaluate7([remaining[i], remaining[j], ...board5]);
          if (heroValue > vv) wins++; else if (heroValue === vv) ties++; else losses++;
        }
      }
    }
  }
  return { wins, ties, losses, total: wins + ties + losses };
}

// ============================================
// 4. 主模拟函数 (混合策略)
// ============================================

self.onmessage = function (event) {
  const msg = event.data;
  if (msg.type !== 'simulate') return;

  const startTime = performance.now();
  const { playerHand, playerRange, communityCards, opponentType, opponentCount, simulations, villainRange } = msg;

  // --- 准备阶段 ---
  const boardCards = (communityCards || []).map(c => parseCardObj(c));
  const isRangeMode = playerRange && playerRange.length > 0;

  let playerCombos = null;
  let fixedPlayerCards = null;
  if (isRangeMode) {
    playerCombos = expandLegacyRange(playerRange);
  } else if (playerHand && playerHand.length === 2) {
    fixedPlayerCards = [parseCardObj(playerHand[0]), parseCardObj(playerHand[1])];
  }

  // 构建 opponent combos
  const oppRangeNames = opponentType === 'custom'
    ? (villainRange || [])
    : (OPPONENT_RANGES[opponentType] || []);
  const useOppRange = opponentType !== 'random' && oppRangeNames.length > 0;
  const oppCombos = useOppRange ? expandLegacyRange(oppRangeNames) : null;

  // 结果追踪
  let wins = 0, ties = 0, losses = 0;
  const equityByCombo = {};
  if (isRangeMode) {
    for (const name of playerRange) {
      equityByCombo[name] = { wins: 0, total: 0 };
    }
  }

  // ====== 混合策略: 精确枚举 vs MC ======
  let strategy = 'monte-carlo';

  if (!isRangeMode && fixedPlayerCards && (opponentCount || 1) === 1) {
    if (boardCards.length === 5) {
      // River: 精确枚举
      strategy = 'exact-river';
      const result = exactRiver(fixedPlayerCards, boardCards, oppCombos);
      const total = result.total;
      const runtimeMs = Math.round((performance.now() - startTime) * 100) / 100;

      let currentHandRank = null;
      const hv = evaluate7([fixedPlayerCards[0], fixedPlayerCards[1], ...boardCards]);
      currentHandRank = HAND_RANK_NAMES[Math.floor(hv / 1000000)] || null;

      self.postMessage({
        type: 'complete',
        win: total > 0 ? (result.wins / total) * 100 : 0,
        tie: total > 0 ? (result.ties / total) * 100 : 0,
        lose: total > 0 ? (result.losses / total) * 100 : 0,
        simulations: total,
        confidence: 100,
        handRank: currentHandRank,
        outs: null,
        equityByCombo: null,
        strategy: strategy,
        runtimeMs: runtimeMs
      });
      return;
    }

    if (boardCards.length === 4) {
      // Turn: 精确枚举
      strategy = 'exact-turn';
      const result = exactTurn(fixedPlayerCards, boardCards, oppCombos);
      const total = result.total;
      const runtimeMs = Math.round((performance.now() - startTime) * 100) / 100;

      let currentHandRank = null;
      const partialCards = [fixedPlayerCards[0], fixedPlayerCards[1], ...boardCards];
      if (partialCards.length >= 6) {
        const hv = evaluate7(partialCards.concat(new Array(7 - partialCards.length).fill(0)));
        currentHandRank = HAND_RANK_NAMES[Math.floor(hv / 1000000)] || null;
      }

      self.postMessage({
        type: 'complete',
        win: total > 0 ? (result.wins / total) * 100 : 0,
        tie: total > 0 ? (result.ties / total) * 100 : 0,
        lose: total > 0 ? (result.losses / total) * 100 : 0,
        simulations: total,
        confidence: 100,
        handRank: currentHandRank,
        outs: null,
        equityByCombo: null,
        strategy: strategy,
        runtimeMs: runtimeMs
      });
      return;
    }
  }

  // ====== Monte Carlo 路径 ======
  const progressInterval = Math.max(1000, Math.floor(simulations / 20));
  let lastProgress = 0;
  let deadlockCounter = 0;

  let currentHandRank = null;
  if (!isRangeMode && fixedPlayerCards && boardCards.length >= 3) {
    const allCards = [...fixedPlayerCards, ...boardCards];
    const val = evaluate7(allCards.length >= 7 ? allCards : allCards.concat(new Array(7 - allCards.length).fill(0)));
    currentHandRank = HAND_RANK_NAMES[Math.floor(val / 1000000)] || null;
  }

  // --- 主循环 ---
  for (let i = 0; i < simulations; i++) {
    // 初始化 deck (bitmask)
    const deck = fullDeck();
    for (const c of boardCards) removeCardFromDeck(deck, c);

    // Step A: 玩家手牌
    let heroCards;
    let heroCombo = null;

    if (isRangeMode) {
      const sampled = sampleComboFromList(playerCombos, deck);
      if (!sampled) {
        deadlockCounter++;
        if (deadlockCounter > 50) {
          // 强制随机
          const tmp = cloneDeck(deck);
          heroCards = drawN(tmp, 2);
          deck[0] = tmp[0]; deck[1] = tmp[1];
        } else {
          i--; continue;
        }
      } else {
        deadlockCounter = 0;
        heroCards = [sampled.card1, sampled.card2];
        heroCombo = sampled.combo;
        removeCardFromDeck(deck, sampled.card1);
        removeCardFromDeck(deck, sampled.card2);
      }
    } else {
      heroCards = fixedPlayerCards;
      removeCardFromDeck(deck, heroCards[0]);
      removeCardFromDeck(deck, heroCards[1]);
    }

    // Step B: 对手手牌
    const villainHands = [];
    let valid = true;

    for (let j = 0; j < opponentCount; j++) {
      if (oppCombos) {
        const sampled = sampleComboFromList(oppCombos, deck);
        if (!sampled) { valid = false; break; }
        villainHands.push([sampled.card1, sampled.card2]);
        removeCardFromDeck(deck, sampled.card1);
        removeCardFromDeck(deck, sampled.card2);
      } else {
        const drawn = drawN(deck, 2);
        if (drawn.length < 2) { valid = false; break; }
        villainHands.push(drawn);
      }
    }

    if (!valid) {
      deadlockCounter++;
      if (deadlockCounter > 50) {
        // Fallback: 随机发牌
        const fb = fullDeck();
        for (const c of boardCards) removeCardFromDeck(fb, c);
        removeCardFromDeck(fb, heroCards[0]);
        removeCardFromDeck(fb, heroCards[1]);
        villainHands.length = 0;
        for (let k = 0; k < opponentCount; k++) {
          const drawn = drawN(fb, 2);
          if (drawn.length >= 2) villainHands.push(drawn);
        }
        valid = true;
      } else {
        i--; continue;
      }
    }
    deadlockCounter = 0;

    // Step C: 公共牌补全
    const remainingBoard = 5 - boardCards.length;
    const runout = drawN(deck, remainingBoard);
    const fullBoard = boardCards.concat(runout);

    // Step D: 评估
    const heroValue = evaluate7(heroCards.concat(fullBoard));
    let bestVillain = -1;
    for (const vh of villainHands) {
      const v = evaluate7(vh.concat(fullBoard));
      if (v > bestVillain) bestVillain = v;
    }

    if (heroValue > bestVillain) {
      wins++;
      if (heroCombo && equityByCombo[heroCombo]) equityByCombo[heroCombo].wins++;
    } else if (heroValue === bestVillain) {
      ties++;
      if (heroCombo && equityByCombo[heroCombo]) equityByCombo[heroCombo].wins += 0.5;
    } else {
      losses++;
    }

    if (heroCombo && equityByCombo[heroCombo]) equityByCombo[heroCombo].total++;

    // 进度
    if (i - lastProgress >= progressInterval) {
      lastProgress = i;
      self.postMessage({
        type: 'progress',
        progress: Math.round(((i + 1) / simulations) * 1000) / 10,
        currentWins: wins,
        currentTies: ties,
        currentLosses: losses,
        currentSimulations: i + 1
      });
    }
  }

  // --- 结果 ---
  const total = wins + ties + losses;
  const winRate = total > 0 ? wins / total : 0;
  const confidence = 1.96 * Math.sqrt((winRate * (1 - winRate)) / Math.max(1, total)) * 100;

  const comboEquities = {};
  if (isRangeMode) {
    for (const [combo, data] of Object.entries(equityByCombo)) {
      comboEquities[combo] = {
        wins: data.wins,
        total: data.total,
        equity: data.total > 0 ? (data.wins / data.total) * 100 : 0
      };
    }
  }

  const runtimeMs = Math.round((performance.now() - startTime) * 100) / 100;

  self.postMessage({
    type: 'complete',
    win: total > 0 ? (wins / total) * 100 : 0,
    tie: total > 0 ? (ties / total) * 100 : 0,
    lose: total > 0 ? (losses / total) * 100 : 0,
    simulations: total,
    confidence: Math.round((1 - confidence / 100) * 1000) / 10,
    handRank: currentHandRank,
    outs: null,
    equityByCombo: isRangeMode ? comboEquities : null,
    strategy: strategy,
    runtimeMs: runtimeMs
  });
};
