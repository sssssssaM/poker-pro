'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, OpponentType, EquityResult, HandRank, HandCombo } from '@/lib/poker/pro-types';

// 扩展 EquityResult 以支持 RvR 图表
export interface ExtendedEquityResult extends EquityResult {
  equityByCombo?: Record<HandCombo, { wins: number; total: number; equity: number }>;
  equityHistogram?: { rangeStart: number; rangeEnd: number; count: number }[];
}

interface ProgressUpdate {
  type: 'progress';
  progress: number;
  currentWins: number;
  currentTies: number;
  currentLosses: number;
  currentSimulations: number;
}

interface SimulationComplete {
  type: 'complete';
  win: number;
  tie: number;
  lose: number;
  simulations: number;
  confidence: number;
  handRank?: HandRank;
  outs?: number;
  equityByCombo?: Record<HandCombo, { wins: number; total: number; equity: number }>;
  equityHistogram?: { rangeStart: number; rangeEnd: number; count: number }[];
}

type WorkerResponse = ProgressUpdate | SimulationComplete;

interface UseSimulationWorkerReturn {
  equityResult: ExtendedEquityResult | null;
  isSimulating: boolean;
  progress: number;
  error: string | null;
  runSimulation: (
    playerHand: Card[] | null,
    communityCards: Card[],
    opponentType: OpponentType,
    opponentCount: number,
    simulations: number,
    playerRange?: HandCombo[]
  ) => void;
  cancelSimulation: () => void;
  progressDetail: {
    wins: number;
    ties: number;
    losses: number;
    currentSimulations: number;
  } | null;
}

export function useSimulationWorker(): UseSimulationWorkerReturn {
  const [equityResult, setEquityResult] = useState<ExtendedEquityResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [progressDetail, setProgressDetail] = useState<{
    wins: number;
    ties: number;
    losses: number;
    currentSimulations: number;
  } | null>(null);

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const runSimulation = useCallback(
    (
      playerHand: Card[] | null,
      communityCards: Card[],
      opponentType: OpponentType,
      opponentCount: number,
      simulations: number,
      playerRange?: HandCombo[]
    ) => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }

      const worker = new Worker('/simulation-worker.js');
      workerRef.current = worker;

      worker.onerror = (event) => {
        console.error('Worker error:', event);
        setError('模拟计算出错，请重试');
        setIsSimulating(false);
      };

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const data = event.data;

        if (data.type === 'progress') {
          setProgress(data.progress);
          setProgressDetail({
            wins: data.currentWins,
            ties: data.currentTies,
            losses: data.currentLosses,
            currentSimulations: data.currentSimulations
          });
        } else if (data.type === 'complete') {
          setEquityResult({
            win: data.win,
            tie: data.tie,
            lose: data.lose,
            simulations: data.simulations,
            confidence: data.confidence,
            handRank: data.handRank,
            outs: data.outs,
            equityByCombo: data.equityByCombo,
            equityHistogram: data.equityHistogram
          });
          setIsSimulating(false);
          setProgress(100);
          setProgressDetail(null);
        }
      };

      if (!playerRange?.length && (!playerHand || playerHand.length !== 2)) {
        setError('请选择手牌或范围');
        return;
      }

      setIsSimulating(true);
      setProgress(0);
      setError(null);
      setEquityResult(null);
      setProgressDetail(null);

      // 【关键修复】把 playerRange 发送给 Worker
      worker.postMessage({
        type: 'simulate',
        playerHand,
        playerRange,
        communityCards: communityCards || [],
        opponentType,
        opponentCount,
        simulations
      });
    },
    []
  );

  const cancelSimulation = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setIsSimulating(false);
    setProgress(0);
    setProgressDetail(null);
  }, []);

  return { equityResult, isSimulating, progress, error, runSimulation, cancelSimulation, progressDetail };
}