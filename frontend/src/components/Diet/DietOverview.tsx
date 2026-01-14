import React from "react";
import { Salad, Calendar, TrendingUp, Target, CheckCircle2 } from "lucide-react";

interface DietOverviewProps {
  todayMeals?: any[];
  progress: any;
  adherence?: number;
  macros?: any;
}

const DietOverview: React.FC<DietOverviewProps> = ({
  todayMeals = [],
  progress,
  adherence,
  macros,
}) => {
  const completionRate =
    progress?.stats?.total_count > 0
      ? Math.round((progress?.stats?.completed_count / progress?.stats?.total_count) * 100)
      : 0;

  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'];
  const mealLabels: { [key: string]: string } = {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snacks: 'Snacks',
  };

  return (
    <div className="space-y-4 overflow-x-hidden">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-400/30">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-emerald-200" />
            <p className="text-xs text-emerald-100/80">Adherence</p>
          </div>
          <p className="text-2xl font-semibold text-emerald-100">{adherence || completionRate}%</p>
          <p className="text-xs text-emerald-100/60">
            {progress?.stats?.completed_count || 0} / {progress?.stats?.total_count || 0} meals
          </p>
        </div>

        <div className="card p-4 bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-400/30">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-purple-200" />
            <p className="text-xs text-purple-100/80">Completed</p>
          </div>
          <p className="text-2xl font-semibold text-purple-100">{progress?.stats?.completed_count || 0}</p>
          <p className="text-xs text-purple-100/60">meals this week</p>
        </div>
      </div>

      {/* Today's Meals */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-5 w-5 text-rose-200" />
          <h3 className="text-md font-semibold">Today's Plan</h3>
        </div>
        {todayMeals.length === 0 ? (
          <p className="text-sm text-gray-400">No meals planned for today</p>
        ) : (
          <div className="space-y-2">
            {mealTypes.map((mealType) => {
              const meal = todayMeals.find((m) => m.meal_type === mealType);
              if (!meal) return null;
              
              return (
                <div key={mealType} className="p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">{mealLabels[mealType]}</h4>
                    {meal.completion_status === 'completed' && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    )}
                  </div>
                  {meal.items && meal.items.length > 0 && (
                    <div className="space-y-1">
                      {meal.items.slice(0, 3).map((item: any, idx: number) => (
                        <p key={idx} className="text-xs text-gray-400">
                          {item.food_name} {item.quantity && `(${item.quantity})`}
                        </p>
                      ))}
                      {meal.items.length > 3 && (
                        <p className="text-xs text-gray-500">+{meal.items.length - 3} more</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Macros Summary */}
      {macros && (macros.total_calories > 0 || macros.total_protein > 0) && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-5 w-5 text-blue-200" />
            <h3 className="text-md font-semibold">Weekly Macros</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-400">Calories</p>
              <p className="text-lg font-semibold">{Math.round(macros.total_calories || 0)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Protein</p>
              <p className="text-lg font-semibold">{Math.round(macros.total_protein || 0)}g</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Carbs</p>
              <p className="text-lg font-semibold">{Math.round(macros.total_carbs || 0)}g</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Fats</p>
              <p className="text-lg font-semibold">{Math.round(macros.total_fats || 0)}g</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DietOverview;
