import React from "react";
import { Dumbbell, Calendar, TrendingUp, Target, Clock } from "lucide-react";

interface FitnessOverviewProps {
  progress: any;
  streak: number;
  nextSession?: any;
  weekStats?: any;
}

const FitnessOverview: React.FC<FitnessOverviewProps> = ({
  progress,
  streak,
  nextSession,
  weekStats,
}) => {
  const completionRate =
    progress?.stats?.total_count > 0
      ? Math.round((progress?.stats?.completed_count / progress?.stats?.total_count) * 100)
      : 0;

  return (
    <div className="space-y-4 overflow-x-hidden">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="fitness-stat-card fitness-stat-card--blue card p-4 bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-400/30">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-blue-200" />
            <p className="text-xs text-blue-100/80">Completion</p>
          </div>
          <p className="text-2xl font-semibold text-blue-100">{completionRate}%</p>
          <p className="text-xs text-blue-100/60">
            {progress?.stats?.completed_count || 0} / {progress?.stats?.total_count || 0}
          </p>
        </div>

        <div className="fitness-stat-card fitness-stat-card--emerald card p-4 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-400/30">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-emerald-200" />
            <p className="text-xs text-emerald-100/80">Streak</p>
          </div>
          <p className="text-2xl font-semibold text-emerald-100">{streak}</p>
          <p className="text-xs text-emerald-100/60">days in a row</p>
        </div>
      </div>

      {/* Next Session */}
      {nextSession && (
        <div className="card p-4 fitness-overview-section">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-5 w-5 text-blue-200 fitness-overview-section-icon" />
            <h3 className="text-md font-semibold">Next Session</h3>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{nextSession.session_name || "Session"}</p>
            {nextSession.date && (
              <p className="text-xs text-gray-400">
                {new Date(nextSession.date).toLocaleDateString()}
              </p>
            )}
            {nextSession.exercises && nextSession.exercises.length > 0 && (
              <p className="text-xs text-gray-400">
                {nextSession.exercises.length} exercise{nextSession.exercises.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Week Stats */}
      {weekStats && (
        <div className="card p-4 fitness-overview-section">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-5 w-5 text-purple-200 fitness-overview-section-icon" />
            <h3 className="text-md font-semibold">This Week</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-2xl font-semibold">{weekStats.completed || 0}</p>
              <p className="text-xs text-gray-400">Completed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold">{weekStats.partial || 0}</p>
              <p className="text-xs text-gray-400">Partial</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold">{weekStats.skipped || 0}</p>
              <p className="text-xs text-gray-400">Skipped</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FitnessOverview;
