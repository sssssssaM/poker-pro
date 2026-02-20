'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, OpponentType, EquityResult, HandRank, ComboEquity } from '@/lib/poker/pro-types';

// Worker 消息类型定义
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
  equityByCombo?: Record<string, ComboEquity> | null;
}

type WorkerResponse = ProgressUpdate | SimulationComplete;

// 扩展 EquityResult 以包含 RvR 数据
export interface ExtendedEquityResult extends EquityResult {
  equityByCombo?: Record<string, ComboEquity> | null;
}

// Hook 返回类型
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
    playerRange?: string[]
  ) => void;
  cancelSimulation: () => void;
  progressDetail: {
    wins: number;
    ties: number;
    losses: number;
    currentSimulations: number;
  } | null;
}

/**
 * Web Worker Hook - 蒙特卡洛模拟 (Range vs Range 版)
 *
 * 核心优化：
 * 1. 每次计算前强制 terminate 旧 Worker，防止丧尸任务排队
 * 2. UI 永不阻塞，Loading 动画流畅运行
 * 3. 实时进度更新，可随时取消
 * 4. 支持 playerRange 参数用于 RvR 模拟
 */
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

  // 清理函数
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  // 运行模拟
  const runSimulation = useCallback(
    (
      playerHand: Card[] | null,
      communityCards: Card[],
      opponentType: OpponentType,
      opponentCount: number,
      simulations: number,
      playerRange?: string[]
    ) => {
      // 每次计算前，一枪崩掉旧的 Worker
      if (workerRef.current) {
        workerRef.current.terminate();
      }

      const worker = new Worker('/simulation-worker.js');
      workerRef.current = worker;

      // 错误处理
      worker.onerror = (event) => {
        console.error('Worker error:', event);
        setError('模拟计算出错，请重试');
        setIsSimulating(false);
      };

      // 消息处理
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
            equityByCombo: data.equityByCombo
          });
          setIsSimulating(false);
          setProgress(100);
          setProgressDetail(null);
        }
      };

      // 验证输入：要么有固定手牌，要么有 range
      const hasRange = playerRange && playerRange.length > 0;
      const hasHand = playerHand && playerHand.length === 2;

      if (!hasRange && !hasHand) {
        setError('请选择手牌或范围');
        return;
      }

      // 重置状态
      setIsSimulating(true);
      setProgress(0);
      setError(null);
      setEquityResult(null);
      setProgressDetail(null);

      // 发送到 Worker
      worker.postMessage({
        type: 'simulate',
        playerHand: hasRange ? null : playerHand,
        playerRange: hasRange ? playerRange : null,
        communityCards: communityCards || [],
        opponentType,
        opponentCount,
        simulations
      });
    },
    []
  );

  // 取消模拟
  const cancelSimulation = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setIsSimulating(false);
    setProgress(0);
    setProgressDetail(null);
  }, []);

  return {
    equityResult,
    isSimulating,
    progress,
    error,
    runSimulation,
    cancelSimulation,
    progressDetail
  };
}
