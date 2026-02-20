// ============================================
// Monte Carlo 模拟 Web Worker（独立线程）
// 彻底解决十万次循环阻塞主线程的问题
// + 死锁熔断机制防止无限循环
// ============================================

// 点数值映射
const RANK_VALUES = {
  'A': 14, 'K': 13, 'Q': 12, 'J': 11, 'T': 10,
  '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
};

// 花色和点数数组
const SUITS = ['s', 'h', 'd', 'c'];
const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

// ============================================
// 核心工具函数
// ============================================

// 创建完整52张牌组
function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

// Fisher-Yates 洗牌算法
function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// 从牌组中移除已知的牌
function removeCards(deck, cardsToRemove) {
  return deck.filter(card =>
    !cardsToRemove.some(c => c.rank === card.rank && c.suit === card.suit)
  );
}

// ============================================
// 手牌评估算法
// ============================================

function evaluateHand(holeCards, communityCards) {
  const allCards = [...holeCards, ...communityCards];
  const ranks = allCards.map(c => RANK_VALUES[c.rank]);
  const suits = allCards.map(c => c.suit);

  // 统计点数出现次数
  const rankCounts = new Map();
  ranks.forEach(r => rankCounts.set(r, (rankCounts.get(r) || 0) + 1));

  // 统计花色出现次数
  const suitCounts = new Map();
  suits.forEach(s => suitCounts.set(s, (suitCounts.get(s) || 0) + 1));

  // 检查同花（5张以上同花色）
  const flushSuit = [...suitCounts.entries()].find(([_, count]) => count >= 5)?.[0];
  const hasFlush = !!flushSuit;

  // 获取同花牌（按点数降序）
  const flushCards = hasFlush
    ? allCards.filter(c => c.suit === flushSuit).map(c => RANK_VALUES[c.rank]).sort((a, b) => b - a)
    : [];

  // 检查顺子
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);

  // A 可以作为 1（轮子顺子：A-2-3-4-5）
  if (uniqueRanks.includes(14)) {
    uniqueRanks.push(1);
  }

  let hasStraight = false;
  let straightHigh = 0;

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

  // 牌型统计
  const counts = [...rankCounts.values()].sort((a, b) => b - a);
  const pairs = counts.filter(c => c === 2).length;
  const threes = counts.filter(c => c === 3).length;
  const fours = counts.filter(c => c === 4).length;

  // 判断最终牌型
  let rank, value = 0;

  // 同花顺 / 皇家同花顺
  if (hasFlush && hasStraight) {
    const flushRanksSet = new Set(flushCards);
    let sfHigh = 0;

    for (let i = 0; i <= flushCards.length - 5; i++) {
      let consecutive = true;
      for (let j = 0; j < 4; j++) {
        if (!flushRanksSet.has(flushCards[i + j] - 1)) {
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
      rank = sfHigh === 14 ? 'Royal Flush' : 'Straight Flush';
      value = 9000000 + sfHigh;
    } else {
      rank = 'Flush';
      value = 5000000 + flushCards.slice(0, 5).reduce((sum, v, i) => sum + v * Math.pow(15, 4 - i), 0);
    }
  }
  // 四条
  else if (fours >= 1) {
    rank = 'Four of a Kind';
    const quadRank = [...rankCounts.entries()].find(([_, c]) => c === 4)[0];
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
    const tripRank = [...rankCounts.entries()].find(([_, c]) => c === 3)[0];
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
    const pairRank = [...rankCounts.entries()].find(([_, c]) => c === 2)[0];
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

// ============================================
// 对手范围定义
// ============================================

const OPPONENT_RANGES = {
  random: [],
  tight: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', 'AKs', 'AQs', 'AJs', 'ATs', 'AKo', 'AQo', 'KQs', 'KJs', 'QJs', 'JTs'],
  loose: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', 'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s', 'KQs', 'KJs', 'KTs', 'K9s', 'QJs', 'QTs', 'JTs', 'T9s', '98s', 'AKo', 'AQo', 'AJo', 'ATo', 'A9o', 'KQo', 'KJo', 'QJo', 'JTo'],
  passive: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', 'AKs', 'AQs', 'AJs', 'ATs', 'KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs', 'T9s', '98s', 'AKo', 'AQo', 'AJo', 'ATo', 'KQo', 'KJo', 'QJo'],
  nit: ['AA', 'KK', 'QQ', 'AKs', 'AKo'],
  custom: []
};

// ============================================
// 组合解析函数
// ============================================

// 检查组合是否在牌组中可用
function isComboAvailable(combo, deck) {
  if (combo.length === 2 && combo[0] === combo[1]) {
    const rank = combo[0];
    const availableCards = deck.filter(c => c.rank === rank);
    return availableCards.length >= 2;
  } else {
    const rank1 = combo[0];
    const rank2 = combo[1];
    const suited = combo[2] === 's';

    if (suited) {
      return SUITS.some(suit =>
        deck.some(c => c.rank === rank1 && c.suit === suit) &&
        deck.some(c => c.rank === rank2 && c.suit === suit)
      );
    } else {
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

// 从范围中筛选出可用的组合
function getAvailableCombos(range, deck) {
  return range.filter(combo => isComboAvailable(combo, deck));
}

// 将组合解析为具体牌
function comboToCards(combo, deck) {
  if (combo.length === 2 && combo[0] === combo[1]) {
    const rank = combo[0];
    const suitedCards = deck.filter(c => c.rank === rank);
    if (suitedCards.length >= 2) {
      return [suitedCards[0], suitedCards[1]];
    }
  } else {
    const rank1 = combo[0];
    const rank2 = combo[1];
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

// ============================================
// 精确计算 Outs（遍历完整牌堆 + 死锁熔断）
// ============================================

function calculatePreciseOuts(playerHand, communityCards, opponentType, opponentCount) {
  if (communityCards.length >= 5) {
    return 0;
  }

  const deck = createDeck();
  const remainingDeck = removeCards(deck, [...playerHand, ...communityCards]);

  // 先计算当前胜率
  let currentWins = 0;
  let currentSamples = 0;
  const sampleCount = 200;

  for (let i = 0; i < sampleCount; i++) {
    let simDeck = shuffleDeck(remainingDeck);
    const opponentHands = [];

    for (let j = 0; j < opponentCount; j++) {
      opponentHands.push([simDeck[0], simDeck[1]]);
      simDeck = removeCards(simDeck, [simDeck[0], simDeck[1]]);
    }

    const remainingCommunity = 5 - communityCards.length;
    const runOut = simDeck.slice(0, remainingCommunity);
    const finalCommunity = [...communityCards, ...runOut];

    const playerResult = evaluateHand(playerHand, finalCommunity);
    const opponentResults = opponentHands.map(h => evaluateHand(h, finalCommunity));
    const bestOpponent = Math.max(...opponentResults.map(r => r.value));

    if (playerResult.value > bestOpponent) {
      currentWins++;
    } else if (playerResult.value === bestOpponent) {
      currentWins += 0.5;
    }
    currentSamples++;
  }

  const currentWinRate = currentSamples > 0 ? currentWins / currentSamples : 0;

  if (currentWinRate > 0.55) {
    return 0;
  }

  // 遍历剩余牌堆
  let outs = 0;
  const opponentRange = OPPONENT_RANGES[opponentType];
  const useRange = opponentType !== 'random' && opponentRange.length > 0;

  for (const candidateCard of remainingDeck) {
    const newCommunity = [...communityCards, candidateCard];

    let winsWithThisCard = 0;
    let samplesWithThisCard = 0;
    const cardSampleCount = 50;

    // ============================================
    // 【防卡顿核心2】Outs 采样循环死锁熔断
    // ============================================
    let outsDeadlockCounter = 0;

    for (let i = 0; i < cardSampleCount; i++) {
      let simDeck = removeCards(remainingDeck, [candidateCard]);
      simDeck = shuffleDeck(simDeck);

      const opponentHands = [];
      let validOpponents = true;

      for (let j = 0; j < opponentCount; j++) {
        let oppCards;

        if (useRange) {
          const availableCombos = getAvailableCombos(opponentRange, simDeck);
          if (availableCombos.length === 0) {
            validOpponents = false;
            break;
          }
          const randomCombo = availableCombos[Math.floor(Math.random() * availableCombos.length)];
          oppCards = comboToCards(randomCombo, simDeck);
        } else {
          oppCards = [simDeck[0], simDeck[1]];
        }

        if (!oppCards || oppCards.length !== 2) {
          validOpponents = false;
          break;
        }

        opponentHands.push(oppCards);
        simDeck = removeCards(simDeck, oppCards);
      }

      // ============================================
      // 死锁熔断：连续失败则跳过本样本
      // ============================================
      if (!validOpponents) {
        outsDeadlockCounter++;
        if (outsDeadlockCounter > 20) {
          // 连续 20 次配不出合法手牌，跳过本次单卡采样
          break;
        }
        i--;
        continue;
      }
      outsDeadlockCounter = 0;

      const remainingCommunity = 5 - newCommunity.length;
      const runOut = simDeck.slice(0, remainingCommunity);
      const finalCommunity = [...newCommunity, ...runOut];

      const playerResult = evaluateHand(playerHand, finalCommunity);
      const opponentResults = opponentHands.map(h => evaluateHand(h, finalCommunity));
      const bestOpponent = Math.max(...opponentResults.map(r => r.value));

      if (playerResult.value > bestOpponent) {
        winsWithThisCard++;
      } else if (playerResult.value === bestOpponent) {
        winsWithThisCard += 0.5;
      }
      samplesWithThisCard++;
    }

    const winRateWithThisCard = samplesWithThisCard > 0 ? winsWithThisCard / samplesWithThisCard : 0;

    if (winRateWithThisCard - currentWinRate > 0.05) {
      outs++;
    }
  }

  return outs;
}

// ============================================
// 主模拟函数
// ============================================

self.onmessage = function(event) {
  const message = event.data;

  if (message.type === 'simulate') {
    const { playerHand, communityCards, opponentType, opponentCount, simulations } = message;

    let wins = 0;
    let ties = 0;
    let losses = 0;

    const opponentRange = OPPONENT_RANGES[opponentType];
    const useRange = opponentType !== 'random' && opponentRange.length > 0;

    const progressInterval = Math.max(1000, Math.floor(simulations / 20));
    let lastProgressReport = 0;

    let currentHandRank = null;
    if (communityCards.length >= 3) {
      const result = evaluateHand(playerHand, communityCards);
      currentHandRank = result.rank;
    }

    // ============================================
    // 【防卡顿核心2】主循环死锁熔断机制
    // ============================================
    let deadlockCounter = 0;

    for (let i = 0; i < simulations; i++) {
      let deck = createDeck();
      deck = shuffleDeck(deck);
      deck = removeCards(deck, [...playerHand, ...communityCards]);

      const opponentHands = [];
      let validOpponents = true;

      for (let j = 0; j < opponentCount; j++) {
        let oppCards = null;

        if (useRange) {
          const availableCombos = getAvailableCombos(opponentRange, deck);

          if (availableCombos.length === 0) {
            validOpponents = false;
            break;
          }

          const randomCombo = availableCombos[Math.floor(Math.random() * availableCombos.length)];
          oppCards = comboToCards(randomCombo, deck);
        } else {
          oppCards = [deck[0], deck[1]];
        }

        if (!oppCards || oppCards.length !== 2) {
          validOpponents = false;
          break;
        }

        opponentHands.push(oppCards);
        deck = removeCards(deck, oppCards);
      }

      // ============================================
      // 死锁熔断机制
      // ============================================
      if (!validOpponents) {
        deadlockCounter++;
        if (deadlockCounter > 50) {
          // 连续 50 次配不出合法手牌，说明遇到了"数学死锁"（范围互斥）
          // 强制降级本局为完全随机牌，防止 Worker 线程被无限循环卡死！
          opponentHands.length = 0;
          let fallbackDeck = shuffleDeck(removeCards(createDeck(), [...playerHand, ...communityCards]));
          for (let k = 0; k < opponentCount; k++) {
            if (fallbackDeck.length >= 2) {
              opponentHands.push([fallbackDeck[0], fallbackDeck[1]]);
              fallbackDeck = removeCards(fallbackDeck, [fallbackDeck[0], fallbackDeck[1]]);
            }
          }
          validOpponents = true;
        } else {
          i--;
          continue;
        }
      }
      deadlockCounter = 0;

      // 发完公共牌
      const remainingCommunity = 5 - communityCards.length;
      const runOut = deck.slice(0, remainingCommunity);
      const finalCommunity = [...communityCards, ...runOut];

      // 评估所有手牌
      const playerResult = evaluateHand(playerHand, finalCommunity);
      const opponentResults = opponentHands.map(h => evaluateHand(h, finalCommunity));
      const bestOpponent = Math.max(...opponentResults.map(r => r.value));

      if (playerResult.value > bestOpponent) {
        wins++;
      } else if (playerResult.value === bestOpponent) {
        ties++;
      } else {
        losses++;
      }

      // 进度报告
      if (i - lastProgressReport >= progressInterval) {
        lastProgressReport = i;
        const progress = ((i + 1) / simulations) * 100;

        self.postMessage({
          type: 'progress',
          progress: Math.round(progress * 10) / 10,
          currentWins: wins,
          currentTies: ties,
          currentLosses: losses,
          currentSimulations: i + 1
        });
      }
    }

    // 计算置信度
    const totalSimulations = wins + ties + losses;
    const winRate = totalSimulations > 0 ? wins / totalSimulations : 0;
    const confidence = 1.96 * Math.sqrt((winRate * (1 - winRate)) / totalSimulations) * 100;

    // 计算精确 Outs
    let preciseOuts = null;
    if (communityCards.length >= 3 && communityCards.length < 5) {
      preciseOuts = calculatePreciseOuts(playerHand, communityCards, opponentType, opponentCount);
    }

    // 返回最终结果
    self.postMessage({
      type: 'complete',
      win: totalSimulations > 0 ? (wins / totalSimulations) * 100 : 0,
      tie: totalSimulations > 0 ? (ties / totalSimulations) * 100 : 0,
      lose: totalSimulations > 0 ? (losses / totalSimulations) * 100 : 0,
      simulations: totalSimulations,
      confidence: Math.round((1 - confidence / 100) * 1000) / 10,
      handRank: currentHandRank,
      outs: preciseOuts
    });
  }
};
