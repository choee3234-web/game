"use client";

import React from "react";
import { Trophy, Medal, Award, Clock, RefreshCw } from "lucide-react";
import { LeaderboardEntry } from "@/types/game";

interface LeaderboardCardProps {
  top3: LeaderboardEntry[];
  loading?: boolean;
  onRefresh?: () => void;
  currentPlayerName?: string;
}

export function LeaderboardCard({
  top3,
  loading = false,
  onRefresh,
  currentPlayerName,
}: LeaderboardCardProps) {
  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shadow-sm border border-amber-300 dark:border-amber-700">
            <Trophy className="w-5 h-5 text-amber-500 fill-amber-400" />
          </div>
        );
      case 2:
        return (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm border border-slate-300 dark:border-slate-700">
            <Medal className="w-5 h-5 text-slate-500 dark:text-slate-400 fill-slate-300 dark:fill-slate-600" />
          </div>
        );
      case 3:
        return (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 shadow-sm border border-amber-600/30 dark:border-amber-700/50">
            <Award className="w-5 h-5 text-amber-700 dark:text-amber-400 fill-amber-600/50" />
          </div>
        );
      default:
        return null;
    }
  };

  const getRankBg = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-r from-amber-500/10 via-amber-200/20 to-transparent dark:from-amber-500/20 dark:via-amber-950/30 border-amber-300/80 dark:border-amber-600/50";
      case 2:
        return "bg-gradient-to-r from-slate-400/10 via-slate-200/20 to-transparent dark:from-slate-700/20 dark:via-slate-800/30 border-slate-300/80 dark:border-slate-700";
      case 3:
        return "bg-gradient-to-r from-amber-700/10 via-amber-600/10 to-transparent dark:from-amber-900/20 dark:via-amber-950/20 border-amber-600/30 dark:border-amber-700/40";
      default:
        return "bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700";
    }
  };

  return (
    <div className="w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-2xl p-4 sm:p-5 shadow-lg border border-sky-100 dark:border-slate-800 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900">
            <Trophy className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base flex items-center gap-1.5">
              Top 3 명예의 전당
              <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                최단 시간 순
              </span>
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
              미션을 가장 빠르게 클리어한 횃불이들
            </p>
          </div>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            title="기록 새로고침"
            className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>

      <div className="space-y-2.5">
        {top3.length === 0 ? (
          <div className="py-6 text-center text-xs sm:text-sm text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
            아직 등록된 기록이 없습니다. 첫 번째 영광의 주인공이 되어보세요!
          </div>
        ) : (
          top3.map((entry, index) => {
            const rank = index + 1;
            const isCurrent = currentPlayerName && entry.name === currentPlayerName;

            return (
              <div
                key={entry.id || index}
                className={`flex items-center justify-between px-3 sm:px-3.5 py-2.5 rounded-xl border transition-all ${getRankBg(
                  rank
                )} ${isCurrent ? "ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-slate-900 font-semibold" : ""}`}
              >
                <div className="flex items-center gap-2.5 sm:gap-3">
                  {getRankBadge(rank)}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                        {entry.name}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded-full">
                          나
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-400">
                      {entry.createdAt}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 bg-white/80 dark:bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs">
                  <Clock className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                  <span className="text-xs font-mono font-bold text-blue-700 dark:text-blue-300">
                    {entry.timeFormatted || `${entry.timeInSeconds.toFixed(2)}초`}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
