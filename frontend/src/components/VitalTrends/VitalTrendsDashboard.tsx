import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, Calendar, TrendingUp, Plus, RefreshCw,
  ChevronDown, ChevronUp, X
} from 'lucide-react';
import { vitalParametersApi } from '../../services/api';
import MultiParameterGraph from './MultiParameterGraph';
import AddParameterModal from './AddParameterModal';
import DateRangeSelector from './DateRangeSelector';

interface ParameterDefinition {
  id: string;
  parameter_name: string;
  display_name?: string;
  unit?: string;
  category: string;
  subcategory?: string;
  default_normal_range_min?: number;
  default_normal_range_max?: number;
}

interface CategoryData {
  category_name: string;
  parameter_names: string[];
  total_readings: number;
  latest_reading_date?: string;
}

interface GraphDataPoint {
  date: string;
  time?: string;
  value: number;
  is_abnormal: boolean;
}

interface GraphData {
  parameter_name: string;
  data_points: GraphDataPoint[];
  unit: string | null;
  normal_range_min: number | null;
  normal_range_max: number | null;
  category: string | null;
}

interface CategoryGraphData {
  [category: string]: {
    [parameterName: string]: GraphData;
  };
}

const VitalTrendsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Record<string, CategoryData>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [categoryGraphData, setCategoryGraphData] = useState<CategoryGraphData>({});
  const [parameterDefinitions, setParameterDefinitions] = useState<Record<string, ParameterDefinition>>({});
  const [loadingGraphs, setLoadingGraphs] = useState<Record<string, boolean>>({});
  
  // Multi-select state
  const [selectedParameters, setSelectedParameters] = useState<string[]>([]);
  const [combinedGraphData, setCombinedGraphData] = useState<GraphData[]>([]);
  const [showCombinedChart, setShowCombinedChart] = useState(false);
  
  // Date range state
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>(() => {
    const end = new Date();
    const start = new Date();
    start.setFullYear(start.getFullYear() - 1); // Default: 1 year
    return { start, end };
  });
  
  const [showDateRangeSelector, setShowDateRangeSelector] = useState(false);
  const [showAddParameterModal, setShowAddParameterModal] = useState(false);

  // Expose refresh function to parent components
  const refresh = React.useCallback(async () => {
    console.log('🔄 [VITAL TRENDS] Refreshing data...');
    setLoading(true);
    await loadCategories();
    await loadParameterDefinitions();
  }, []);

  // Make refresh available globally for manual refresh
  React.useEffect(() => {
    (window as any).refreshVitalTrends = refresh;
    return () => {
      delete (window as any).refreshVitalTrends;
    };
  }, [refresh]);

  useEffect(() => {
    loadCategories();
    loadParameterDefinitions();
  }, []);

  useEffect(() => {
    // Load graph data for all categories
    if (Object.keys(categories).length > 0) {
      loadAllCategoryGraphData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, dateRange]);

  // Listen for custom refresh event
  useEffect(() => {
    const handleRefresh = () => {
      console.log('🔄 [VITAL TRENDS] Refresh event received');
      refresh();
    };
    
    window.addEventListener('refreshVitalTrends', handleRefresh);
    return () => {
      window.removeEventListener('refreshVitalTrends', handleRefresh);
    };
  }, [refresh]);

  const loadCategories = async () => {
    try {
      const response = await vitalParametersApi.getParametersByCategory();
      const cats = response.data?.categories || response.categories || {};
      setCategories(cats);
      
      // Expand all categories by default
      const expanded: Record<string, boolean> = {};
      Object.keys(cats).forEach(cat => {
        expanded[cat] = true;
      });
      setExpandedCategories(expanded);
    } catch (error) {
      console.error('Error loading categories:', error);
      setCategories({});
    } finally {
      setLoading(false);
    }
  };

  const loadParameterDefinitions = async () => {
    try {
      const response = await vitalParametersApi.getParameterDefinitions();
      const defs = response.data?.definitions || response.definitions || [];
      const defsMap: Record<string, ParameterDefinition> = {};
      defs.forEach((def: ParameterDefinition) => {
        defsMap[def.parameter_name] = def;
      });
      setParameterDefinitions(defsMap);
    } catch (error) {
      console.error('Error loading parameter definitions:', error);
      setParameterDefinitions({});
    }
  };

  const loadAllCategoryGraphData = async () => {
    if (Object.keys(categories).length === 0) return;

    const loadingState: Record<string, boolean> = {};
    Object.keys(categories).forEach(cat => {
      loadingState[cat] = true;
    });
    setLoadingGraphs(loadingState);

    const graphDataMap: CategoryGraphData = {};

    // Load graph data for each category
    for (const categoryName of Object.keys(categories)) {
      const categoryData = categories[categoryName];
      if (!categoryData || !categoryData.parameter_names || categoryData.parameter_names.length === 0) {
        continue;
      }

      try {
        // Load data for all parameters in this category
        const response = await vitalParametersApi.getGraphData(
          categoryData.parameter_names,
          dateRange.start.toISOString().split('T')[0],
          dateRange.end.toISOString().split('T')[0]
        );
        const graphData = response.data?.graph_data || response.graph_data || [];
        
        // Group by parameter name
        const categoryDataMap: { [paramName: string]: GraphData } = {};
        graphData.forEach((data: GraphData) => {
          categoryDataMap[data.parameter_name] = data;
        });
        
        graphDataMap[categoryName] = categoryDataMap;
      } catch (error) {
        console.error(`Error loading graph data for category ${categoryName}:`, error);
        graphDataMap[categoryName] = {};
      }
    }

    setCategoryGraphData(graphDataMap);
    
    // Clear loading state
    const clearedLoadingState: Record<string, boolean> = {};
    Object.keys(categories).forEach(cat => {
      clearedLoadingState[cat] = false;
    });
    setLoadingGraphs(clearedLoadingState);
  };

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

  const handleDateRangeChange = (start: Date, end: Date) => {
    const now = new Date();
    const finalEnd = end > now ? now : end;
    setDateRange({ start, end: finalEnd });
    setShowDateRangeSelector(false);
  };

  const handleParameterToggle = (paramName: string) => {
    setSelectedParameters(prev => {
      if (prev.includes(paramName)) {
        return prev.filter(p => p !== paramName);
      } else {
        if (prev.length >= 5) {
          alert('Maximum 5 parameters can be compared at once');
          return prev;
        }
        return [...prev, paramName];
      }
    });
  };

  const loadCombinedGraphData = async () => {
    if (selectedParameters.length === 0) {
      setCombinedGraphData([]);
      setShowCombinedChart(false);
      return;
    }

    try {
      const response = await vitalParametersApi.getGraphData(
        selectedParameters,
        dateRange.start.toISOString().split('T')[0],
        dateRange.end.toISOString().split('T')[0]
      );
      const graphData = response.data?.graph_data || response.graph_data || [];
      setCombinedGraphData(graphData);
      setShowCombinedChart(true);
    } catch (error) {
      console.error('Error loading combined graph data:', error);
      setCombinedGraphData([]);
    }
  };

  useEffect(() => {
    if (selectedParameters.length > 0) {
      loadCombinedGraphData();
    } else {
      setShowCombinedChart(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedParameters, dateRange]);

  const categoryList = Object.keys(categories).sort();
  
  // Get all available parameters for selection
  const allAvailableParameters = useMemo(() => {
    const params: Array<{ name: string; category: string; def?: ParameterDefinition }> = [];
    categoryList.forEach(categoryName => {
      const categoryData = categories[categoryName];
      if (categoryData?.parameter_names) {
        categoryData.parameter_names.forEach(paramName => {
          params.push({
            name: paramName,
            category: categoryName,
            def: parameterDefinitions[paramName]
          });
        });
      }
    });
    return params;
  }, [categories, parameterDefinitions, categoryList]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-gray-600">Loading vital trends...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
      {/* Header with Actions */}
      <div className="flex items-center justify-between sticky top-0 bg-white z-10 pb-4 border-b">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Vital Trends</h2>
          <p className="text-gray-600 text-sm mt-1">All health parameters tracked over time</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowDateRangeSelector(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Date Range
          </button>
          <button
            onClick={() => setShowAddParameterModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Parameter
          </button>
        </div>
      </div>

      {/* Combined Chart Section */}
      {selectedParameters.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900">
              Combined Chart ({selectedParameters.length} parameter{selectedParameters.length > 1 ? 's' : ''})
            </h3>
            <button
              onClick={() => {
                setSelectedParameters([]);
                setShowCombinedChart(false);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {showCombinedChart && combinedGraphData.length > 0 ? (
            <MultiParameterGraph
              graphData={combinedGraphData}
              parameterDefinitions={parameterDefinitions}
            />
          ) : (
            <div className="text-center py-8 text-gray-500">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
              <p>Loading combined chart...</p>
            </div>
          )}
        </div>
      )}

      {/* Parameter Selection */}
      {allAvailableParameters.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900 mb-3">Select Parameters for Comparison</h3>
          <div className="flex flex-wrap gap-2">
            {allAvailableParameters.map(({ name, category, def }) => {
              const isSelected = selectedParameters.includes(name);
              return (
                <button
                  key={name}
                  onClick={() => handleParameterToggle(name)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {def?.display_name || name}
                  {def?.unit && (
                    <span className="text-xs ml-1 opacity-75">
                      ({def.unit})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {selectedParameters.length > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              {selectedParameters.length} / 5 selected. Click parameters above to add/remove.
            </p>
          )}
        </div>
      )}

      {/* Categories List */}
      {categoryList.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Vital Parameters Found</h3>
          <p className="text-gray-600 mb-4">
            Add vital parameters to start tracking your health trends.
          </p>
          <button
            onClick={() => setShowAddParameterModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add First Parameter
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {categoryList.map(categoryName => {
            const categoryData = categories[categoryName];
            const isExpanded = expandedCategories[categoryName];
            const categoryParams = categoryGraphData[categoryName] || {};
            const isLoading = loadingGraphs[categoryName];

            return (
              <div key={categoryName} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(categoryName)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-blue-600" />
                    <div className="text-left">
                      <h3 className="text-lg font-semibold text-gray-900 capitalize">
                        {categoryData.category_name || categoryName}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {categoryData.parameter_names?.length || 0} parameter(s) • {categoryData.total_readings || 0} reading(s)
                      </p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                {/* Category Content - Parameters */}
                {isExpanded && (
                  <div className="border-t border-gray-200 p-6 space-y-6">
                    {isLoading ? (
                      <div className="flex justify-center items-center py-8">
                        <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                      </div>
                    ) : categoryData.parameter_names && categoryData.parameter_names.length > 0 ? (
                      categoryData.parameter_names.map(paramName => {
                        const paramData = categoryParams[paramName];
                        const def = parameterDefinitions[paramName];

                        if (!paramData || !paramData.data_points || paramData.data_points.length === 0) {
                          return (
                            <div key={paramName} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-medium text-gray-900">
                                  {def?.display_name || paramName}
                                  {def?.unit && (
                                    <span className="text-sm text-gray-500 ml-2">({def.unit})</span>
                                  )}
                                </h4>
                              </div>
                              <p className="text-sm text-gray-500">No data available in the selected date range</p>
                            </div>
                          );
                        }

                        return (
                          <div key={paramName} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedParameters.includes(paramName)}
                                  onChange={() => handleParameterToggle(paramName)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <div>
                                  <h4 className="font-medium text-gray-900">
                                    {def?.display_name || paramName}
                                    {paramData.unit && (
                                      <span className="text-sm text-gray-500 ml-2">({paramData.unit})</span>
                                    )}
                                  </h4>
                                  {paramData.normal_range_min !== null && paramData.normal_range_max !== null && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      Normal Range: {paramData.normal_range_min} - {paramData.normal_range_max} {paramData.unit}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-gray-600">
                                  {paramData.data_points?.length || 0} reading(s)
                                </p>
                              </div>
                            </div>
                            <MultiParameterGraph
                              graphData={[paramData]}
                              parameterDefinitions={parameterDefinitions}
                            />
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p>No parameters found in this category</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Date Range Selector Modal */}
      {showDateRangeSelector && (
        <DateRangeSelector
          isOpen={showDateRangeSelector}
          onClose={() => setShowDateRangeSelector(false)}
          onConfirm={handleDateRangeChange}
          initialStart={dateRange.start}
          initialEnd={dateRange.end}
        />
      )}

      {/* Add Parameter Modal */}
      {showAddParameterModal && (
        <AddParameterModal
          isOpen={showAddParameterModal}
          onClose={() => setShowAddParameterModal(false)}
          onSuccess={() => {
            loadCategories();
            loadAllCategoryGraphData();
          }}
          parameterDefinitions={parameterDefinitions}
        />
      )}
    </div>
  );
};

export default VitalTrendsDashboard;
