// ============================================
// Monte Carlo 模拟 Web Worker（独立线程）
// Range vs Range 升级版
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

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

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

  const rankCounts = new Map();
  ranks.forEach(r => rankCounts.set(r, (rankCounts.get(r) || 0) + 1));

  const suitCounts = new Map();
  suits.forEach(s => suitCounts.set(s, (suitCounts.get(s) || 0) + 1));

  const flushSuit = [...suitCounts.entries()].find(([_, count]) => count >= 5)?.[0];
  const hasFlush = !!flushSuit;

  const flushCards = hasFlush
    ? allCards.filter(c => c.suit === flushSuit).map(c => RANK_VALUES[c.rank]).sort((a, b) => b - a)
    : [];

  const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
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

  const counts = [...rankCounts.values()].sort((a, b) => b - a);
  const pairs = counts.filter(c => c === 2).length;
  const threes = counts.filter(c => c === 3).length;
  const fours = counts.filter(c => c === 4).length;

  let rank, value = 0;

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
  } else if (fours >= 1) {
    rank = 'Four of a Kind';
    const quadRank = [...rankCounts.entries()].find(([_, c]) => c === 4)[0];
    const kicker = Math.max(...[...rankCounts.entries()].filter(([r, _]) => r !== quadRank).map(([r, _]) => r));
    value = 7000000 + quadRank * 100 + kicker;
  } else if (threes >= 1 && pairs >= 1) {
    rank = 'Full House';
    const tripRank = [...rankCounts.entries()].filter(([_, c]) => c === 3).map(([r, _]) => r).sort((a, b) => b - a)[0];
    const pairRank = [...rankCounts.entries()].filter(([_, c]) => c === 2).map(([r, _]) => r).sort((a, b) => b - a)[0];
    value = 6000000 + tripRank * 100 + pairRank;
  } else if (hasFlush) {
    rank = 'Flush';
    value = 5000000 + flushCards.slice(0, 5).reduce((sum, v, i) => sum + v * Math.pow(15, 4 - i), 0);
  } else if (hasStraight) {
    rank = 'Straight';
    value = 4000000 + straightHigh;
  } else if (threes >= 1) {
    rank = 'Three of a Kind';
    const tripRank = [...rankCounts.entries()].find(([_, c]) => c === 3)[0];
    value = 3000000 + tripRank * 100;
  } else if (pairs >= 2) {
    rank = 'Two Pair';
    const pairRanks = [...rankCounts.entries()].filter(([_, c]) => c === 2).map(([r, _]) => r).sort((a, b) => b - a);
    value = 2000000 + pairRanks[0] * 100 + pairRanks[1];
  } else if (pairs >= 1) {
    rank = 'Pair';
    const pairRank = [...rankCounts.entries()].find(([_, c]) => c === 2)[0];
    value = 1000000 + pairRank * 100;
  } else {
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

function getAvailableCombos(range, deck) {
  return range.filter(combo => isComboAvailable(combo, deck));
}

// 随机采样：将 combo 解析为具体牌（随机选一个可用的花色组合）
function comboToCardsRandom(combo, deck) {
  const candidates = [];

  if (combo.length === 2 && combo[0] === combo[1]) {
    // 对子：枚举所有可用的花色对
    const rank = combo[0];
    const available = deck.filter(c => c.rank === rank);
    for (let i = 0; i < available.length; i++) {
      for (let j = i + 1; j < available.length; j++) {
        candidates.push([available[i], available[j]]);
      }
    }
  } else {
    const rank1 = combo[0];
    const rank2 = combo[1];
    const suited = combo[2] === 's';
    if (suited) {
      for (const suit of SUITS) {
        const card1 = deck.find(c => c.rank === rank1 && c.suit === suit);
        const card2 = deck.find(c => c.rank === rank2 && c.suit === suit);
        if (card1 && card2) candidates.push([card1, card2]);
      }
    } else {
      for (const suit1 of SUITS) {
        for (const suit2 of SUITS) {
          if (suit1 !== suit2) {
            const card1 = deck.find(c => c.rank === rank1 && c.suit === suit1);
            const card2 = deck.find(c => c.rank === rank2 && c.suit === suit2);
            if (card1 && card2) candidates.push([card1, card2]);
          }
        }
      }
    }
  }

  if (candidates.length === 0) return [];
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// ============================================
// 精确计算 Outs（遍历完整牌堆 + 死锁熔断）
// ============================================

function calculatePreciseOuts(playerHand, communityCards, opponentType, opponentCount) {
  if (communityCards.length >= 5) return 0;

  const deck = createDeck();
  const remainingDeck = removeCards(deck, [...playerHand, ...communityCards]);

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
    if (playerResult.value > bestOpponent) currentWins++;
    else if (playerResult.value === bestOpponent) currentWins += 0.5;
    currentSamples++;
  }

  const currentWinRate = currentSamples > 0 ? currentWins / currentSamples : 0;
  if (currentWinRate > 0.55) return 0;

  let outs = 0;
  const opponentRange = OPPONENT_RANGES[opponentType];
  const useRange = opponentType !== 'random' && opponentRange.length > 0;

  for (const candidateCard of remainingDeck) {
    const newCommunity = [...communityCards, candidateCard];
    let winsWithThisCard = 0;
    let samplesWithThisCard = 0;
    const cardSampleCount = 50;
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
          if (availableCombos.length === 0) { validOpponents = false; break; }
          const randomCombo = availableCombos[Math.floor(Math.random() * availableCombos.length)];
          oppCards = comboToCardsRandom(randomCombo, simDeck);
        } else {
          oppCards = [simDeck[0], simDeck[1]];
        }
        if (!oppCards || oppCards.length !== 2) { validOpponents = false; break; }
        opponentHands.push(oppCards);
        simDeck = removeCards(simDeck, oppCards);
      }

      // 死锁熔断
      if (!validOpponents) {
        outsDeadlockCounter++;
        if (outsDeadlockCounter > 20) break;
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
      if (playerResult.value > bestOpponent) winsWithThisCard++;
      else if (playerResult.value === bestOpponent) winsWithThisCard += 0.5;
      samplesWithThisCard++;
    }

    const winRateWithThisCard = samplesWithThisCard > 0 ? winsWithThisCard / samplesWithThisCard : 0;
    if (winRateWithThisCard - currentWinRate > 0.05) outs++;
  }

  return outs;
}

// ============================================
// 主模拟函数（支持 Range vs Range）
// ============================================

self.onmessage = function (event) {
  const message = event.data;

  if (message.type === 'simulate') {
    const { playerHand, playerRange, communityCards, opponentType, opponentCount, simulations } = message;

    // 判断模式：固定手牌 vs Range
    const isRangeMode = playerRange && playerRange.length > 0;

    let wins = 0;
    let ties = 0;
    let losses = 0;

    const opponentRange = OPPONENT_RANGES[opponentType];
    const useOppRange = opponentType !== 'random' && opponentRange.length > 0;

    const progressInterval = Math.max(1000, Math.floor(simulations / 20));
    let lastProgressReport = 0;

    // 当前牌力（仅固定手牌模式下有意义）
    let currentHandRank = null;
    if (!isRangeMode && communityCards.length >= 3 && playerHand && playerHand.length === 2) {
      const result = evaluateHand(playerHand, communityCards);
      currentHandRank = result.rank;
    }

    // Per-combo equity tracking (RvR mode)
    const equityByCombo = {};
    if (isRangeMode) {
      for (const combo of playerRange) {
        equityByCombo[combo] = { wins: 0, total: 0 };
      }
    }

    // ============================================
    // 【防卡顿核心】主循环死锁熔断机制
    // ============================================
    let deadlockCounter = 0;

    for (let i = 0; i < simulations; i++) {
      let deck = createDeck();
      deck = shuffleDeck(deck);
      deck = removeCards(deck, communityCards);

      // === Step A: 确定玩家手牌 ===
      let currentPlayerHand;
      let currentPlayerCombo = null;

      if (isRangeMode) {
        // Range 模式：从 playerRange 中采样
        const availablePlayerCombos = getAvailableCombos(playerRange, deck);
        if (availablePlayerCombos.length === 0) {
          deadlockCounter++;
          if (deadlockCounter > 50) {
            // 强制随机降级
            currentPlayerHand = [deck[0], deck[1]];
          } else {
            i--;
            continue;
          }
        } else {
          deadlockCounter = 0;
          currentPlayerCombo = availablePlayerCombos[Math.floor(Math.random() * availablePlayerCombos.length)];
          currentPlayerHand = comboToCardsRandom(currentPlayerCombo, deck);
          if (!currentPlayerHand || currentPlayerHand.length !== 2) {
            i--;
            continue;
          }
        }
      } else {
        // 固定手牌模式
        currentPlayerHand = playerHand;
      }

      // 从牌组中移除玩家手牌
      deck = removeCards(deck, currentPlayerHand);

      // === Step B: 为对手发牌 ===
      const opponentHands = [];
      let validOpponents = true;
      let oppDeadlockCounter = 0;

      for (let j = 0; j < opponentCount; j++) {
        let oppCards = null;

        if (useOppRange) {
          const availableCombos = getAvailableCombos(opponentRange, deck);
          if (availableCombos.length === 0) {
            validOpponents = false;
            break;
          }
          const randomCombo = availableCombos[Math.floor(Math.random() * availableCombos.length)];
          oppCards = comboToCardsRandom(randomCombo, deck);
        } else {
          if (deck.length >= 2) {
            oppCards = [deck[0], deck[1]];
          }
        }

        if (!oppCards || oppCards.length !== 2) {
          validOpponents = false;
          break;
        }

        opponentHands.push(oppCards);
        deck = removeCards(deck, oppCards);
      }

      // ============================================
      // 死锁熔断机制（对手）
      // ============================================
      if (!validOpponents) {
        deadlockCounter++;
        if (deadlockCounter > 50) {
          opponentHands.length = 0;
          let fallbackDeck = shuffleDeck(removeCards(createDeck(), [...currentPlayerHand, ...communityCards]));
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

      // === Step C: 发公共牌并评估 ===
      const remainingCommunity = 5 - communityCards.length;
      const runOut = deck.slice(0, remainingCommunity);
      const finalCommunity = [...communityCards, ...runOut];

      const playerResult = evaluateHand(currentPlayerHand, finalCommunity);
      const opponentResults = opponentHands.map(h => evaluateHand(h, finalCommunity));
      const bestOpponent = Math.max(...opponentResults.map(r => r.value));

      if (playerResult.value > bestOpponent) {
        wins++;
        if (currentPlayerCombo && equityByCombo[currentPlayerCombo]) {
          equityByCombo[currentPlayerCombo].wins++;
        }
      } else if (playerResult.value === bestOpponent) {
        ties++;
        // 平局算 0.5 胜
        if (currentPlayerCombo && equityByCombo[currentPlayerCombo]) {
          equityByCombo[currentPlayerCombo].wins += 0.5;
        }
      } else {
        losses++;
      }

      if (currentPlayerCombo && equityByCombo[currentPlayerCombo]) {
        equityByCombo[currentPlayerCombo].total++;
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
    const confidence = 1.96 * Math.sqrt((winRate * (1 - winRate)) / Math.max(1, totalSimulations)) * 100;

    // 计算精确 Outs（仅固定手牌模式）
    let preciseOuts = null;
    if (!isRangeMode && playerHand && playerHand.length === 2 && communityCards.length >= 3 && communityCards.length < 5) {
      preciseOuts = calculatePreciseOuts(playerHand, communityCards, opponentType, opponentCount);
    }

    // 计算每个 combo 的 equity
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

    // 返回最终结果
    self.postMessage({
      type: 'complete',
      win: totalSimulations > 0 ? (wins / totalSimulations) * 100 : 0,
      tie: totalSimulations > 0 ? (ties / totalSimulations) * 100 : 0,
      lose: totalSimulations > 0 ? (losses / totalSimulations) * 100 : 0,
      simulations: totalSimulations,
      confidence: Math.round((1 - confidence / 100) * 1000) / 10,
      handRank: currentHandRank,
      outs: preciseOuts,
      equityByCombo: isRangeMode ? comboEquities : null
    });
  }
};
