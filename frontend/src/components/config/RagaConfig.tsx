import React, { useState, useEffect } from 'react';
import { ArrowLeft, Download, Upload, Plus, Edit, Trash2, Save, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getAllSeasons, formatSeasonDisplay } from '../../utils/marathiCalendar';

interface RagaConfigProps {
  onBack: () => void;
}

interface Raga {
  _id?: string;
  name: string;
  idealHours: number[];
  description: string;
  tags: string[];
  isActive: boolean;
  seasons: string[];
  popularity: 'highly listened' | 'moderately listened' | 'sparingly listened';
}

const RagaConfig: React.FC<RagaConfigProps> = ({ onBack }) => {
  const [ragas, setRagas] = useState<Raga[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRaga, setEditingRaga] = useState<Raga | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Raga>>({
    name: '',
    idealHours: [],
    description: '',
    tags: [],
    isActive: true,
    seasons: [],
    popularity: 'moderately listened'
  });
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [importProgress, setImportProgress] = useState<{
    isImporting: boolean;
    totalRecords: number;
    importedCount: number;
    currentRecord: string;
    step: string;
  }>({
    isImporting: false,
    totalRecords: 0,
    importedCount: 0,
    currentRecord: '',
    step: ''
  });

  // Auto-clear success and error messages after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError('');
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Check if token is valid
  const isTokenValid = () => {
    const token = localStorage.getItem('token');
    if (!token) return false;
    
    try {
      // Basic JWT token validation (check if it's not expired)
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      
      // If token has exp field, check expiration
      if (payload.exp) {
        return payload.exp > currentTime;
      }
      
      // If no exp field, assume token is valid (server will validate)
      return true;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  };

  // Handle authentication errors
  const handleAuthError = () => {
    setError('Your session has expired. Please log in again to continue.');
    // Clear invalid token
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Reload page to trigger login
    setTimeout(() => window.location.reload(), 2000);
  };

  // Load ragas on component mount
  useEffect(() => {
    loadRagas();
  }, []);

  const loadRagas = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/ragas', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRagas(data);
      }
    } catch (error) {
      console.error('Error loading ragas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const url = editingRaga 
        ? `http://localhost:3001/api/ragas/${editingRaga._id}`
        : 'http://localhost:3001/api/ragas';
      
      const method = editingRaga ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await loadRagas();
        setShowForm(false);
        setEditingRaga(null);
        setFormData({
          name: '',
          idealHours: [],
          description: '',
          tags: [],
          isActive: true,
          seasons: [],
          popularity: 'moderately listened'
        });
      }
    } catch (error) {
      console.error('Error saving raga:', error);
    }
  };

  const handleEdit = (raga: Raga) => {
    setEditingRaga(raga);
    setFormData(raga);
    setShowForm(true);
  };

  const handleDelete = async (ragaId: string) => {
    if (!confirm('Are you sure you want to delete this raga?')) return;
    
    try {
      const response = await fetch(`http://localhost:3001/api/ragas/${ragaId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        await loadRagas();
      }
    } catch (error) {
      console.error('Error deleting raga:', error);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm(`Are you sure you want to delete ALL ${ragas.length} ragas? This action cannot be undone!`)) return;
    
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/ragas', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        setSuccessMessage(result.message);
        await loadRagas();
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to delete all ragas');
      }
    } catch (error) {
      console.error('Error deleting all ragas:', error);
      setError('Error deleting all ragas');
    } finally {
      setLoading(false);
    }
  };

  const exportRagas = async () => {
    // Prepare data for Excel export
    const excelData = ragas.map(raga => ({
      'Raga Name': raga.name,
      'Description': raga.description,
      'Tags': raga.tags.join(', '),
      'Ideal Hours': raga.idealHours.join(', '),
      'Seasons': raga.seasons.join(', '),
      'Popularity': raga.popularity,
      'Active': raga.isActive ? 'Yes' : 'No'
    }));

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 15 }, // Raga Name
      { wch: 40 }, // Description
      { wch: 20 }, // Tags
      { wch: 15 }, // Ideal Hours
      { wch: 20 }, // Seasons
      { wch: 15 }, // Popularity
      { wch: 8 }   // Active
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Ragas');
    
    const fileName = `ragas_export_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    // Try File System Access API first (modern browsers)
    if ('showSaveFilePicker' in window) {
      try {
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: 'Excel files',
            accept: {
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            },
          }],
        });
        
        const writable = await fileHandle.createWritable();
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        await writable.write(new Uint8Array(wbout));
        await writable.close();
        return;
      } catch (err) {
        // User cancelled or error occurred, fall back to download
        console.log('File System Access API failed, falling back to download');
      }
    }
    
    // Fallback: Use XLSX.writeFile for browsers without File System Access API
    XLSX.writeFile(wb, fileName);
  };

  const importRagas = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if token exists
    const token = localStorage.getItem('token');
    console.log('Import: Token found:', !!token);
    if (!token) {
      console.log('Import: No token found, redirecting to login');
      handleAuthError();
      return;
    }

    // Reset progress and clear previous messages
    setImportProgress({
      isImporting: true,
      totalRecords: 0,
      importedCount: 0,
      currentRecord: '',
      step: 'Reading file...'
    });
    setError('');
    setSuccessMessage('');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        let importedRagas;

        // Check file extension to determine format
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          setImportProgress(prev => ({ ...prev, step: 'Parsing Excel file...' }));
          
          // Handle Excel files
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          
          console.log('Excel data sample:', jsonData.slice(0, 2));
          console.log('Available columns:', jsonData.length > 0 ? Object.keys(jsonData[0]) : 'No data');
          
          // Convert Excel data to raga format
          importedRagas = jsonData.map((row: any) => ({
            name: row['Raga Name'] || row['raga_name'] || row['name'] || row['Raga'] || '',
            description: row['Description'] || row['description'] || row['desc'] || '',
            tags: (row['Tags'] || row['tags'] || row['tag']) ? 
              (row['Tags'] || row['tags'] || row['tag']).split(',').map((tag: string) => tag.trim()) : [],
            idealHours: (row['Ideal Hours'] || row['ideal_hours'] || row['idealHours'] || row['hours']) ? 
              (row['Ideal Hours'] || row['ideal_hours'] || row['idealHours'] || row['hours']).split(',').map((hour: string) => parseInt(hour.trim())).filter((h: number) => !isNaN(h)) : [],
            seasons: (row['Seasons'] || row['seasons'] || row['season']) ? 
              (row['Seasons'] || row['seasons'] || row['season']).split(',').map((season: string) => season.trim()) : [],
            popularity: row['Popularity'] || row['popularity'] || 'moderately listened',
            isActive: (row['Active'] || row['active'] || row['isActive']) === 'Yes' || 
                     (row['Active'] || row['active'] || row['isActive']) === true ||
                     (row['Active'] || row['active'] || row['isActive']) === 'true'
          }));
        } else {
          setImportProgress(prev => ({ ...prev, step: 'Parsing JSON file...' }));
          
          // Handle JSON files (fallback)
          importedRagas = JSON.parse(data as string);
        }
        
        // Validate the imported data
        console.log('Imported ragas:', importedRagas);
        if (Array.isArray(importedRagas)) {
          const totalRecords = importedRagas.length;
          setImportProgress(prev => ({ 
            ...prev, 
            totalRecords,
            step: `Found ${totalRecords} records. Preparing batch import...`
          }));

          // Validate and prepare ragas for batch import
          const validatedRagas = importedRagas.map((ragaData, index) => {
            // Ensure all required fields are present with defaults
            return {
              name: ragaData.name || '',
              description: ragaData.description || '',
              tags: ragaData.tags || [],
              idealHours: ragaData.idealHours || [],
              seasons: ragaData.seasons || [],
              popularity: ragaData.popularity || 'moderately listened',
              isActive: ragaData.isActive !== undefined ? ragaData.isActive : true
            };
          });

          setImportProgress(prev => ({ 
            ...prev, 
            step: `Sending ${totalRecords} ragas for batch import...`
          }));

          try {
            const token = localStorage.getItem('token');
            console.log('Import: Making API call with token:', token ? 'Token exists' : 'No token');
            
            const response = await fetch('http://localhost:3001/api/ragas/batch-import', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ ragas: validatedRagas })
            });

            console.log('Import: API response status:', response.status);

            const result = await response.json();

            if (response.ok) {
              setImportProgress(prev => ({ 
                ...prev, 
                step: 'Refreshing raga list...'
              }));

              // Refresh the raga list
              await loadRagas();
              
              // Final status
              setImportProgress(prev => ({ 
                ...prev, 
                isImporting: false,
                step: 'Import completed!'
              }));

              const { results } = result;
              const successCount = results.successful;
              const errorCount = results.failed;
              const duplicateCount = results.duplicates.length;

              if (successCount > 0) {
                let message = `Successfully imported ${successCount} out of ${totalRecords} ragas!`;
                if (duplicateCount > 0) {
                  message += ` ${duplicateCount} duplicates were skipped.`;
                }
                if (errorCount > 0) {
                  message += ` ${errorCount} failed.`;
                }
                setSuccessMessage(message);
              } else {
                setError(`Failed to import any ragas. ${result.message}`);
              }

              // Log detailed results for debugging
              console.log('Batch import results:', results);
              if (results.errors.length > 0) {
                console.log('Import errors:', results.errors);
              }
              if (results.duplicates.length > 0) {
                console.log('Duplicates skipped:', results.duplicates);
              }

            } else {
              setImportProgress(prev => ({ 
                ...prev, 
                isImporting: false,
                step: 'Import failed!'
              }));
              
              // Handle authentication errors specifically
              if (response.status === 401) {
                handleAuthError();
              } else {
                setError(`Import failed: ${result.message || 'Unknown error'}`);
              }
            }

          } catch (error) {
            setImportProgress(prev => ({ 
              ...prev, 
              isImporting: false,
              step: 'Import failed!'
            }));
            console.error('Batch import error:', error);
            setError(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        } else {
          setImportProgress(prev => ({ 
            ...prev, 
            isImporting: false,
            step: 'Import failed!'
          }));
          setError('Invalid file format. Please ensure the file contains an array of raga objects.');
        }
      } catch (error) {
        console.error('Error importing ragas:', error);
        setImportProgress(prev => ({ 
          ...prev, 
          isImporting: false,
          step: 'Import failed!'
        }));
        setError('Error parsing the file. Please check the format and try again.');
      }
    };
    
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      reader.readAsBinaryString(file);
    } else {
      reader.readAsText(file);
    }
  };

  const addTag = (tag: string) => {
    if (tag && !formData.tags?.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), tag]
      }));
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter(tag => tag !== tagToRemove) || []
    }));
  };

  const addSeason = (season: string) => {
    if (season && !formData.seasons?.includes(season)) {
      setFormData(prev => ({
        ...prev,
        seasons: [...(prev.seasons || []), season]
      }));
    }
  };

  const removeSeason = (seasonToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      seasons: prev.seasons?.filter(season => season !== seasonToRemove) || []
    }));
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <span className="px-3 py-1 bg-blue-600/20 text-blue-300 text-sm rounded-full">
              {loading ? 'Loading...' : `${ragas.length} ragas`}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportRagas}
            className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
          <label className="flex items-center space-x-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>Import</span>
            <input
              type="file"
              accept=".xlsx,.xls,.json"
              onChange={importRagas}
              className="hidden"
            />
          </label>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center space-x-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add</span>
          </button>
          <button
            onClick={handleDeleteAll}
            className="flex items-center space-x-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete All</span>
          </button>
        </div>
      </div>

      {/* Import Progress and Messages */}
      {importProgress.isImporting && (
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mx-6 mb-4">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
            <div className="flex-1">
              <p className="text-blue-300 text-sm font-medium">{importProgress.step}</p>
              {importProgress.totalRecords > 0 && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-blue-400 mb-1">
                    <span>Progress: {importProgress.importedCount} / {importProgress.totalRecords}</span>
                    <span>{Math.round((importProgress.importedCount / importProgress.totalRecords) * 100)}%</span>
                  </div>
                  <div className="w-full bg-blue-900/30 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(importProgress.importedCount / importProgress.totalRecords) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}
              {importProgress.currentRecord && (
                <p className="text-blue-400 text-xs mt-1">Current: {importProgress.currentRecord}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 mx-6 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <p className="text-green-300 text-sm">{successMessage}</p>
            </div>
            <button
              onClick={() => setSuccessMessage('')}
              className="text-green-400 hover:text-green-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mx-6 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-red-300 text-sm">{error}</p>
                {error.includes('session has expired') && (
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                  >
                    Reload Page to Login
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={() => setError('')}
              className="text-red-400 hover:text-red-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        {showForm ? (
          /* Form */
          <div className="bg-gray-800 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-medium text-white">
                {editingRaga ? 'Edit Raga' : 'Add New Raga'}
              </h4>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingRaga(null);
                  setFormData({
                    name: '',
                    idealHours: [],
                    description: '',
                    tags: [],
                    isActive: true
                  });
                }}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Raga Name
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter raga name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Ideal Hours (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.idealHours?.join(', ') || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    idealHours: e.target.value.split(',').map(h => parseInt(h.trim())).filter(h => !isNaN(h))
                  }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 8, 9, 10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Description
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Enter raga description"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Tags
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.tags?.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 bg-blue-600 text-white text-sm rounded-full"
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="ml-1 hover:text-red-300"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    addTag(e.currentTarget.value);
                    e.currentTarget.value = '';
                  }
                }}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Type a tag and press Enter"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Seasons
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.seasons?.map((season, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 bg-green-600 text-white text-sm rounded-full"
                  >
                    {season}
                    <button
                      onClick={() => removeSeason(season)}
                      className="ml-1 hover:text-red-300"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <select
                onChange={(e) => {
                  if (e.target.value && !formData.seasons?.includes(e.target.value)) {
                    addSeason(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                defaultValue=""
              >
                <option value="">Select a season to add</option>
                {getAllSeasons().map((season) => (
                  <option key={season.english} value={season.english}>
                    {formatSeasonDisplay(season.english)} - {season.description}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Popularity
              </label>
              <select
                value={formData.popularity || 'moderately listened'}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  popularity: e.target.value as 'highly listened' | 'moderately listened' | 'sparingly listened'
                }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="highly listened">Highly Listened</option>
                <option value="moderately listened">Moderately Listened</option>
                <option value="sparingly listened">Sparingly Listened</option>
              </select>
            </div>

            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.isActive || false}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-white">Active</span>
              </label>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingRaga(null);
                  setFormData({
                    name: '',
                    idealHours: [],
                    description: '',
                    tags: [],
                    isActive: true
                  });
                }}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>Save</span>
              </button>
            </div>
          </div>
        ) : (
          /* Raga List */
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="text-white/60 mt-2">Loading ragas...</p>
              </div>
            ) : ragas.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-white/60">No ragas found. Add your first raga to get started.</p>
              </div>
            ) : (
              ragas.map((raga) => (
                <div
                  key={raga._id}
                  className="bg-gray-800 rounded-lg p-4 border border-gray-700"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="text-lg font-medium text-white">{raga.name}</h4>
                        {raga.isActive ? (
                          <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-600 text-white text-xs rounded-full">
                            Inactive
                          </span>
                        )}
                      </div>
                      
                      {raga.description && (
                        <p className="text-white/60 text-sm mb-2">{raga.description}</p>
                      )}
                      
                      <div className="flex flex-wrap gap-2 mb-2">
                        {raga.tags?.map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-blue-600/20 text-blue-300 text-xs rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      
                      {raga.seasons && raga.seasons.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {raga.seasons.map((season, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-green-600/20 text-green-300 text-xs rounded-full"
                            >
                              {season}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex items-center space-x-4 mb-2">
                        {raga.idealHours && raga.idealHours.length > 0 && (
                          <p className="text-white/60 text-sm">
                            Ideal hours: {raga.idealHours.join(', ')}
                          </p>
                        )}
                        {raga.popularity && (
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            raga.popularity === 'highly listened' 
                              ? 'bg-yellow-600/20 text-yellow-300'
                              : raga.popularity === 'moderately listened'
                              ? 'bg-blue-600/20 text-blue-300'
                              : 'bg-gray-600/20 text-gray-300'
                          }`}>
                            {raga.popularity.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={() => handleEdit(raga)}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4 text-blue-400" />
                      </button>
                      <button
                        onClick={() => raga._id && handleDelete(raga._id)}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RagaConfig;
