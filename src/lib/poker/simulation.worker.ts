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
  playerHand: Card[];
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
}

type WorkerMessage = SimulationRequest;
type WorkerResponse = ProgressUpdate | SimulationResult;

// 主模拟函数（带进度报告）
function runSimulation(request: SimulationRequest): void {
  const { playerHand, communityCards, opponentType, opponentCount, simulations } = request;

  let wins = 0;
  let ties = 0;
  let losses = 0;
  let validSimulations = 0;
  let skippedSimulations = 0;
  const maxSkips = simulations * 2; // 最大跳过次数，防止无限循环

  const opponentRange = OPPONENT_RANGES[opponentType];
  const useRange = opponentType !== 'random' && opponentRange.length > 0;

  // 进度报告间隔
  const progressInterval = Math.max(1000, Math.floor(simulations / 20));
  let lastProgressReport = 0;

  // 获取当前牌力
  let currentHandRank: HandRank | undefined;
  if (communityCards.length >= 3) {
    const result = evaluateHand(playerHand, communityCards);
    currentHandRank = result.rank;
  }

  // 计算 Outs（精确版）
  let outs: number | undefined;
  if (communityCards.length >= 3 && communityCards.length < 5) {
    outs = calculatePreciseOuts(playerHand, communityCards, opponentType, opponentCount);
  }

  while (validSimulations < simulations && skippedSimulations < maxSkips) {
    // 创建并洗牌
    let deck = createDeck();
    deck = shuffleDeck(deck);

    // 移除已知牌
    deck = removeCards(deck, [...playerHand, ...communityCards]);

    // 为对手发牌
    const opponentHands: Card[][] = [];
    let validOpponents = true;

    for (let j = 0; j < opponentCount; j++) {
      let oppCards: Card[];

      if (useRange) {
        // 获取当前可用范围内的组合
        const availableCombos = getAvailableCombos(opponentRange, deck);

        if (availableCombos.length === 0) {
          // 没有可用的组合，跳过这次模拟（不降级为随机）
          validOpponents = false;
          skippedSimulations++;
          break;
        }

        // 从可用组合中随机选择
        const randomCombo = availableCombos[Math.floor(Math.random() * availableCombos.length)];
        oppCards = comboToCards(randomCombo, deck);
      } else {
        // 随机发牌
        oppCards = [deck[0], deck[1]];
      }

      if (oppCards.length !== 2) {
        validOpponents = false;
        skippedSimulations++;
        break;
      }

      opponentHands.push(oppCards);
      deck = removeCards(deck, oppCards);
    }

    if (!validOpponents) continue;

    // 发完公共牌
    const remainingCommunity = 5 - communityCards.length;
    const runOut = deck.slice(0, remainingCommunity);
    const finalCommunity = [...communityCards, ...runOut];

    // 评估所有手牌
    const playerResult = evaluateHand(playerHand, finalCommunity);
    const opponentResults = opponentHands.map(h => evaluateHand(h, finalCommunity));

    // 比较结果
    const bestOpponent = Math.max(...opponentResults.map(r => r.value));

    if (playerResult.value > bestOpponent) {
      wins++;
    } else if (playerResult.value === bestOpponent) {
      ties++;
    } else {
      losses++;
    }

    validSimulations++;

    // 进度报告
    if (validSimulations - lastProgressReport >= progressInterval) {
      lastProgressReport = validSimulations;
      const progress = (validSimulations / simulations) * 100;

      self.postMessage({
        type: 'progress',
        progress,
        currentWins: wins,
        currentTies: ties,
        currentLosses: losses
      } as ProgressUpdate);
    }
  }

  // 计算置信度
  const confidence = 1.96 * Math.sqrt((wins / validSimulations * (1 - wins / validSimulations)) / validSimulations) * 100;

  // 返回结果
  const result: SimulationResult = {
    type: 'complete',
    win: (wins / validSimulations) * 100,
    tie: (ties / validSimulations) * 100,
    lose: (losses / validSimulations) * 100,
    simulations: validSimulations,
    confidence: Math.round((1 - confidence / 100) * 1000) / 10,
    handRank: currentHandRank,
    outs
  };

  self.postMessage(result);
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

export {};
