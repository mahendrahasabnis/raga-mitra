import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { Activity } from 'lucide-react';

interface ParameterDefinition {
  parameter_name: string;
  display_name?: string;
  unit?: string;
  default_normal_range_min?: number;
  default_normal_range_max?: number;
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

interface MultiParameterGraphProps {
  graphData: GraphData[];
  parameterDefinitions: Record<string, ParameterDefinition>;
  title?: string;
}

const COLORS = ['#3b82f6', '#10b981', '#06b6d4', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const MultiParameterGraph: React.FC<MultiParameterGraphProps> = ({
  graphData,
  parameterDefinitions,
  title
}) => {
  // Transform data for Recharts
  const chartData = useMemo(() => {
    try {
      if (!graphData || graphData.length === 0) return [];

      // Combine all data points by date
      const dateMap: Record<string, any> = {};

      graphData.forEach((paramData) => {
        if (!paramData || !paramData.data_points || !paramData.parameter_name) return;
        
        paramData.data_points.forEach((point) => {
          if (!point || !point.date) return;
          
          try {
            const dateKey = new Date(point.date).toISOString().split('T')[0];
            
            if (!dateMap[dateKey]) {
              const date = new Date(point.date);
              const day = date.getDate().toString().padStart(2, '0');
              const month = (date.getMonth() + 1).toString().padStart(2, '0');
              const year = date.getFullYear().toString().slice(-2);
              
              dateMap[dateKey] = {
                date: dateKey,
                dateLabel: `${day}/${month}/${year}`
              };
            }

            // Store value with parameter name as key
            dateMap[dateKey][paramData.parameter_name] = point.value;
            dateMap[dateKey][`${paramData.parameter_name}_abnormal`] = point.is_abnormal;
            
            // Store min/max for reference lines
            if (paramData.normal_range_min !== null && paramData.normal_range_min !== undefined) {
              dateMap[dateKey][`${paramData.parameter_name}_min`] = paramData.normal_range_min;
            }
            if (paramData.normal_range_max !== null && paramData.normal_range_max !== undefined) {
              dateMap[dateKey][`${paramData.parameter_name}_max`] = paramData.normal_range_max;
            }
          } catch (err) {
            console.error('Error processing data point:', err);
          }
        });
      });

      // Convert to array and sort by date
      return Object.values(dateMap).sort((a: any, b: any) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    } catch (error) {
      console.error('Error transforming chart data:', error);
      return [];
    }
  }, [graphData]);

  // Check if all parameters use the same unit
  const allUnits = useMemo(() => {
    try {
      if (!graphData || graphData.length === 0) return [];
      return graphData.map(g => g?.unit).filter(Boolean);
    } catch (error) {
      console.error('Error processing units:', error);
      return [];
    }
  }, [graphData]);

  const sameUnit = allUnits.length > 0 && allUnits.every(u => u === allUnits[0]);
  const primaryUnit = allUnits[0] || '';
  
  // Generate title from parameters
  const chartTitle = useMemo(() => {
    if (title) return title;
    if (graphData.length === 1 && graphData[0]) {
      const def = parameterDefinitions[graphData[0].parameter_name];
      const displayName = def?.display_name || graphData[0].parameter_name;
      const unit = graphData[0].unit || '';
      return `${displayName}${unit ? ` in ${unit}` : ''}`;
    }
    return graphData.map((g, idx) => {
      const def = parameterDefinitions[g.parameter_name];
      return def?.display_name || g.parameter_name;
    }).join(', ');
  }, [title, graphData, parameterDefinitions]);

  if (!graphData || graphData.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Activity className="w-12 h-12 mx-auto mb-2 text-gray-400" />
        <p>No parameters selected.</p>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Activity className="w-12 h-12 mx-auto mb-2 text-gray-400" />
        <p>No data points available for the selected parameters.</p>
      </div>
    );
  }

  try {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        {/* Chart Title */}
        {chartTitle && (
          <h3 className="text-lg font-semibold text-white mb-2 text-center">{chartTitle}</h3>
        )}
        
        {/* Graph */}
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af" opacity={0.3} />
              <XAxis 
                dataKey="dateLabel"
                tick={{ fontSize: 10, fill: '#e5e7eb', fontWeight: 500 }}
                angle={0}
                textAnchor="middle"
                height={30}
              />
              
              {/* Y-Axis for primary unit if all params use same unit */}
              {sameUnit ? (
                <YAxis 
                  tick={{ fontSize: 10, fill: '#e5e7eb', fontWeight: 500 }}
                  domain={['auto', 'auto']}
                  width={50}
                  label={{ 
                    value: primaryUnit, 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { fontSize: 10, fill: '#e5e7eb', fontWeight: 500 }
                  }}
                />
              ) : (
                /* Multiple Y-axes if different units */
                graphData.map((paramData, index) => {
                  if (!paramData || !paramData.unit) return null;
                  
                  return (
                    <YAxis
                      key={paramData.parameter_name}
                      yAxisId={paramData.parameter_name}
                      orientation={index % 2 === 0 ? 'left' : 'right'}
                      domain={['auto', 'auto']}
                      width={45}
                      tick={{ fontSize: 10, fill: COLORS[index % COLORS.length], fontWeight: 500 }}
                      label={{
                        value: paramData.unit,
                        angle: -90,
                        position: index % 2 === 0 ? 'insideLeft' : 'insideRight',
                        style: { fontSize: 10, fill: COLORS[index % COLORS.length], fontWeight: 500 }
                      }}
                    />
                  );
                })
              )}

              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: '#fff'
                }}
                itemStyle={{ color: '#fff' }}
                labelStyle={{ color: '#9ca3af' }}
                formatter={(value: any, name: string) => {
                  // Handle min/max reference lines
                  if (name.includes('_min') || name.includes('_max')) {
                    return [value, name.replace('_min', ' Min').replace('_max', ' Max')];
                  }
                  
                  const paramData = graphData.find(g => g.parameter_name === name);
                  if (!paramData) return [value, name];
                  
                  const def = parameterDefinitions[name];
                  const displayName = def?.display_name || name;
                  const unit = paramData.unit || '';
                  const isAbnormal = chartData.find((d: any) => d[name] === value)?.[`${name}_abnormal`];
                  
                  return [
                    <span key={name} className={isAbnormal ? 'text-red-400 font-bold' : 'text-white'}>
                      {displayName}: {value} {unit}
                      {isAbnormal && ' ⚠️'}
                    </span>,
                    ''
                  ];
                }}
              />
              
              <Legend 
                wrapperStyle={{ paddingTop: '10px' }}
                iconType="line"
                formatter={(value: string) => {
                  // Skip min/max in legend
                  if (value.includes('_min') || value.includes('_max')) return null;
                  const def = parameterDefinitions[value];
                  return def?.display_name || value;
                }}
              />

              {/* Reference lines for Min/Max */}
              {graphData.map((paramData, index) => {
                if (!paramData) return null;
                
                const yAxisId = sameUnit ? undefined : paramData.parameter_name;
                const lineColor = COLORS[index % COLORS.length];
                
                return (
                  <React.Fragment key={`ref-${paramData.parameter_name}`}>
                    {/* Min reference line */}
                    {paramData.normal_range_min !== null && paramData.normal_range_min !== undefined && (
                      <ReferenceLine
                        y={paramData.normal_range_min}
                        {...(yAxisId ? { yAxisId } : {})}
                        stroke="#10b981"
                        strokeDasharray="3 3"
                        strokeWidth={1.5}
                        label={{ 
                          value: 'Min', 
                          fontSize: 9, 
                          fill: '#10b981',
                          position: 'right'
                        }}
                      />
                    )}
                    {/* Max reference line */}
                    {paramData.normal_range_max !== null && paramData.normal_range_max !== undefined && (
                      <ReferenceLine
                        y={paramData.normal_range_max}
                        {...(yAxisId ? { yAxisId } : {})}
                        stroke="#06b6d4"
                        strokeDasharray="3 3"
                        strokeWidth={1.5}
                        label={{ 
                          value: 'Max', 
                          fontSize: 9, 
                          fill: '#06b6d4',
                          position: 'right'
                        }}
                      />
                    )}
                  </React.Fragment>
                );
              })}

              {/* Data lines for each parameter */}
              {graphData && graphData.length > 0 && graphData.map((paramData, index) => {
                if (!paramData || !paramData.parameter_name) return null;
                
                const yAxisId = sameUnit ? undefined : paramData.parameter_name;
                const lineColor = COLORS[index % COLORS.length];
                
                return (
                  <Line
                    key={paramData.parameter_name}
                    type="monotone"
                    dataKey={paramData.parameter_name}
                    {...(yAxisId ? { yAxisId } : {})}
                    stroke={lineColor}
                    strokeWidth={2}
                    dot={{ r: 4, fill: lineColor, strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6, fill: lineColor, strokeWidth: 2, stroke: '#fff' }}
                    name={paramData.parameter_name}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  } catch (error: any) {
    console.error('Error rendering graph:', error);
    return (
      <div className="text-center py-12 text-red-500">
        <Activity className="w-12 h-12 mx-auto mb-2 text-red-400" />
        <p>Error rendering graph. Please try again.</p>
        <p className="text-xs mt-2">{error?.message || String(error)}</p>
      </div>
    );
  }
};

export default MultiParameterGraph;
