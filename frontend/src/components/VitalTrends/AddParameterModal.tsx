import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { vitalParametersApi } from '../../services/api';

interface ParameterDefinition {
  id: string;
  parameter_name: string;
  display_name?: string;
  unit?: string;
  category: string;
  default_normal_range_min?: number;
  default_normal_range_max?: number;
}

interface AddParameterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  parameterDefinitions: Record<string, ParameterDefinition>;
}

const AddParameterModal: React.FC<AddParameterModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  parameterDefinitions
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    parameter_name: '',
    value: '',
    unit: '',
    recorded_date: new Date().toISOString().split('T')[0],
    recorded_time: '',
    normal_range_min: '',
    normal_range_max: '',
    category: 'general',
    notes: ''
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [showParameterSuggestions, setShowParameterSuggestions] = useState(false);
  const [selectedDefinition, setSelectedDefinition] = useState<ParameterDefinition | null>(null);

  const availableParameters = Object.values(parameterDefinitions);
  const filteredParameters = availableParameters.filter(def =>
    def.parameter_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    def.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    if (selectedDefinition) {
      setFormData(prev => ({
        ...prev,
        parameter_name: selectedDefinition.parameter_name,
        unit: selectedDefinition.unit || prev.unit,
        category: selectedDefinition.category || prev.category,
        normal_range_min: selectedDefinition.default_normal_range_min?.toString() || prev.normal_range_min,
        normal_range_max: selectedDefinition.default_normal_range_max?.toString() || prev.normal_range_max
      }));
      setShowParameterSuggestions(false);
    }
  }, [selectedDefinition]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const parameterData = {
        parameter_name: formData.parameter_name,
        value: parseFloat(formData.value),
        unit: formData.unit || undefined,
        recorded_date: formData.recorded_date,
        recorded_time: formData.recorded_time || undefined,
        normal_range_min: formData.normal_range_min ? parseFloat(formData.normal_range_min) : undefined,
        normal_range_max: formData.normal_range_max ? parseFloat(formData.normal_range_max) : undefined,
        category: formData.category,
        notes: formData.notes || undefined,
        source: 'manual_entry'
      };

      await vitalParametersApi.addParameter(parameterData);
      alert('Parameter added successfully!');
      onSuccess();
      onClose();
      resetForm();
    } catch (error: any) {
      console.error('Error adding parameter:', error);
      alert(error.response?.data?.message || 'Failed to add parameter');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      parameter_name: '',
      value: '',
      unit: '',
      recorded_date: new Date().toISOString().split('T')[0],
      recorded_time: '',
      normal_range_min: '',
      normal_range_max: '',
      category: 'general',
      notes: ''
    });
    setSelectedDefinition(null);
    setSearchTerm('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Add Vital Parameter</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Parameter Name with Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Parameter Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={formData.parameter_name}
                onChange={(e) => {
                  setFormData({ ...formData, parameter_name: e.target.value });
                  setSearchTerm(e.target.value);
                  setShowParameterSuggestions(true);
                }}
                onFocus={() => setShowParameterSuggestions(true)}
                placeholder="Type to search or enter custom parameter"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {showParameterSuggestions && filteredParameters.length > 0 && searchTerm && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredParameters.map((def) => (
                    <button
                      key={def.id}
                      type="button"
                      onClick={() => {
                        setSelectedDefinition(def);
                        setSearchTerm('');
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      <div className="font-medium">{def.display_name || def.parameter_name}</div>
                      {def.unit && (
                        <div className="text-sm text-gray-600">{def.unit} • {def.category}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Value */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Value <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter numeric value"
            />
          </div>

          {/* Unit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Unit
            </label>
            <input
              type="text"
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., kg, %, mg/dL, mmHg"
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                max={new Date().toISOString().split('T')[0]}
                value={formData.recorded_date}
                onChange={(e) => setFormData({ ...formData, recorded_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time (Optional)
              </label>
              <input
                type="time"
                value={formData.recorded_time}
                onChange={(e) => setFormData({ ...formData, recorded_time: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Normal Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Normal Range Min
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.normal_range_min}
                onChange={(e) => setFormData({ ...formData, normal_range_min: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Normal Range Max
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.normal_range_max}
                onChange={(e) => setFormData({ ...formData, normal_range_max: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="general">General</option>
              <option value="diabetes">Diabetes</option>
              <option value="hypertension">Hypertension</option>
              <option value="cardiac">Cardiac</option>
              <option value="respiratory">Respiratory</option>
              <option value="renal">Renal</option>
              <option value="liver">Liver</option>
              <option value="thyroid">Thyroid</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Additional notes..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Add Parameter
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddParameterModal;

