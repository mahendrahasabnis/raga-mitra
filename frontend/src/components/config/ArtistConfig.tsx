import React, { useState, useEffect } from 'react';
import { ArrowLeft, Download, Upload, Plus, Edit, Trash2, Save, X } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ArtistConfigProps {
  onBack: () => void;
}

interface Artist {
  _id?: string;
  name: string;
  yearBorn: number;
  specialty: 'Vocal' | 'Instrument' | 'Sarod' | 'Sitar' | 'Bansuri' | 'Santoor' | 'Tabla' | 'Veena' | 'Surbahar' | 'Surbaha- Sitar' | 'Vocal - Carnatic' | 'Vocal  -Carnatic' | 'Musicologist - Composer' | 'Gundecha Brothers' | 'Malladi Brothers';
  gharana: string;
  knownRagas: string[];
  bio: string;
  imgUrl: string;
  rating: number;
  isActive: boolean;
}

const ArtistConfig: React.FC<ArtistConfigProps> = ({ onBack }) => {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingArtist, setEditingArtist] = useState<Artist | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Artist>>({
    name: '',
    yearBorn: new Date().getFullYear() - 30,
    specialty: 'Vocal',
    gharana: '',
    knownRagas: [],
    bio: '',
    imgUrl: '',
    rating: 0,
    isActive: true
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

  // Auto-clear success and error messages
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Load artists on component mount
  useEffect(() => {
    loadArtists();
  }, []);

  const loadArtists = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3006/api/artists', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setArtists(data);
      }
    } catch (error) {
      console.error('Error loading artists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const url = editingArtist 
        ? `http://localhost:3006/api/artists/${editingArtist._id}`
        : 'http://localhost:3006/api/artists';
      
      const method = editingArtist ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await loadArtists();
        setShowForm(false);
        setEditingArtist(null);
        setFormData({
          name: '',
          yearBorn: new Date().getFullYear() - 30,
          specialty: 'Vocal',
          gharana: '',
          knownRagas: [],
          bio: '',
          imgUrl: '',
          rating: 0,
          isActive: true
        });
        setSuccessMessage(editingArtist ? 'Artist updated successfully!' : 'Artist created successfully!');
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Error saving artist');
      }
    } catch (error) {
      console.error('Error saving artist:', error);
      setError('Error saving artist');
    }
  };

  const handleEdit = (artist: Artist) => {
    setEditingArtist(artist);
    setFormData(artist);
    setShowForm(true);
  };

  const handleDelete = async (artistId: string) => {
    if (!confirm('Are you sure you want to delete this artist?')) return;
    
    try {
      const response = await fetch(`http://localhost:3006/api/artists/${artistId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        await loadArtists();
        setSuccessMessage('Artist deleted successfully!');
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Error deleting artist');
      }
    } catch (error) {
      console.error('Error deleting artist:', error);
      setError('Error deleting artist');
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm(`Are you sure you want to delete ALL ${artists.length} artists? This action cannot be undone!`)) return;
    
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3006/api/artists', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        setSuccessMessage(result.message);
        await loadArtists();
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to delete all artists');
      }
    } catch (error) {
      console.error('Error deleting all artists:', error);
      setError('Error deleting all artists');
    } finally {
      setLoading(false);
    }
  };

  const exportArtists = async () => {
    const excelData = artists.map(artist => ({
      'Name': artist.name,
      'Year Born': artist.yearBorn,
      'Specialty': artist.specialty,
      'Gharana': artist.gharana,
      'Known Ragas': artist.knownRagas.join(', '),
      'Bio': artist.bio,
      'Image URL': artist.imgUrl,
      'Rating': artist.rating,
      'Active': artist.isActive ? 'Yes' : 'No'
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    
    ws['!cols'] = [
      { wch: 20 }, // Name
      { wch: 10 }, // Year Born
      { wch: 12 }, // Specialty
      { wch: 20 }, // Gharana
      { wch: 30 }, // Known Ragas
      { wch: 50 }, // Bio
      { wch: 30 }, // Image URL
      { wch: 8 },  // Rating
      { wch: 8 }   // Active
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Artists');
    
    const fileName = `artists_export_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const importArtists = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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
        let importedArtists;

        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          setImportProgress(prev => ({ ...prev, step: 'Parsing Excel file...' }));
          
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          
          importedArtists = jsonData.map((row: any) => ({
            name: row['Name'] || row['name'] || '',
            yearBorn: parseInt(row['Year Born'] || row['yearBorn'] || row['year_born'] || '0'),
            specialty: row['Specialty'] || row['specialty'] || 'Vocal',
            gharana: row['Gharana'] || row['gharana'] || '',
            knownRagas: (row['Known Ragas'] || row['knownRagas'] || row['known_ragas'] || '') ? 
              (row['Known Ragas'] || row['knownRagas'] || row['known_ragas']).split(',').map((raga: string) => raga.trim()) : [],
            bio: row['Bio'] || row['bio'] || '',
            imgUrl: row['Image URL'] || row['imgUrl'] || row['image_url'] || '',
            rating: parseFloat(row['Rating'] || row['rating'] || '0'),
            isActive: (row['Active'] || row['active'] || row['isActive']) === 'Yes' || 
                     (row['Active'] || row['active'] || row['isActive']) === true ||
                     (row['Active'] || row['active'] || row['isActive']) === 'true'
          }));
        } else {
          setImportProgress(prev => ({ ...prev, step: 'Parsing JSON file...' }));
          importedArtists = JSON.parse(data as string);
        }
        
        if (Array.isArray(importedArtists)) {
          const totalRecords = importedArtists.length;
          setImportProgress(prev => ({ 
            ...prev, 
            totalRecords,
            step: `Found ${totalRecords} records. Preparing batch import...`
          }));

          const validatedArtists = importedArtists.map((artistData, index) => ({
            name: artistData.name || '',
            yearBorn: artistData.yearBorn || new Date().getFullYear() - 30,
            specialty: artistData.specialty || 'Vocal',
            gharana: artistData.gharana || '',
            knownRagas: artistData.knownRagas || [],
            bio: artistData.bio || '',
            imgUrl: artistData.imgUrl || '',
            rating: artistData.rating || 0,
            isActive: artistData.isActive !== undefined ? artistData.isActive : true
          }));

          console.log('=== FRONTEND IMPORT DEBUG ===');
          console.log('Total records to send:', validatedArtists.length);
          console.log('Sample validated record:', JSON.stringify(validatedArtists[0], null, 2));
          console.log('First 5 records:', validatedArtists.slice(0, 5).map((artist, idx) => ({
            row: idx + 1,
            name: artist.name,
            yearBorn: artist.yearBorn,
            specialty: artist.specialty,
            gharana: artist.gharana,
            bio: artist.bio?.substring(0, 50) + '...',
            hasAllFields: !!(artist.name && artist.yearBorn && artist.specialty && artist.gharana && artist.bio)
          })));

          setImportProgress(prev => ({ 
            ...prev, 
            step: `Sending ${totalRecords} artists for batch import...`
          }));

          try {
            const response = await fetch('http://localhost:3006/api/artists/batch-import', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({ artists: validatedArtists })
            });

            const result = await response.json();

            if (response.ok) {
              setImportProgress(prev => ({ 
                ...prev, 
                step: 'Refreshing artist list...'
              }));

              await loadArtists();
              
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
                let message = `Successfully imported ${successCount} out of ${totalRecords} artists!`;
                if (duplicateCount > 0) {
                  message += ` ${duplicateCount} duplicates were skipped.`;
                }
                if (errorCount > 0) {
                  message += ` ${errorCount} failed.`;
                  
                  // Show detailed failure information
                  if (results.errors && results.errors.length > 0) {
                    const failureDetails = results.errors.slice(0, 10).join('\n'); // Show first 10 errors
                    const remainingErrors = results.errors.length - 10;
                    const fullMessage = `${message}\n\nFailed artists:\n${failureDetails}${remainingErrors > 0 ? `\n... and ${remainingErrors} more errors` : ''}`;
                    setSuccessMessage(fullMessage);
                  } else {
                    setSuccessMessage(message);
                  }
                } else {
                  setSuccessMessage(message);
                }
              } else {
                let errorMessage = `Failed to import any artists. ${result.message}`;
                if (results.errors && results.errors.length > 0) {
                  const failureDetails = results.errors.slice(0, 10).join('\n');
                  const remainingErrors = results.errors.length - 10;
                  errorMessage += `\n\nFailed artists:\n${failureDetails}${remainingErrors > 0 ? `\n... and ${remainingErrors} more errors` : ''}`;
                }
                setError(errorMessage);
              }
            } else {
              setImportProgress(prev => ({ 
                ...prev, 
                isImporting: false,
                step: 'Import failed!'
              }));
              setError(`Import failed: ${result.message || 'Unknown error'}`);
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
          setError('Invalid file format. Please ensure the file contains an array of artist objects.');
        }
      } catch (error) {
        console.error('Error importing artists:', error);
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

  const addKnownRaga = (raga: string) => {
    if (raga && !formData.knownRagas?.includes(raga)) {
      setFormData(prev => ({
        ...prev,
        knownRagas: [...(prev.knownRagas || []), raga]
      }));
    }
  };

  const removeKnownRaga = (ragaToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      knownRagas: prev.knownRagas?.filter(raga => raga !== ragaToRemove) || []
    }));
  };

  const getWordCount = (text: string) => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
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
              {loading ? 'Loading...' : `${artists.length} artists`}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportArtists}
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
              onChange={importArtists}
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
          {artists.length > 0 && (
            <button
              onClick={handleDeleteAll}
              className="flex items-center space-x-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete All</span>
            </button>
          )}
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
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 mx-6 mb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-2 flex-1">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
              <div className="text-green-300 text-sm whitespace-pre-line">{successMessage}</div>
            </div>
            <button
              onClick={() => setSuccessMessage('')}
              className="text-green-400 hover:text-green-300 transition-colors flex-shrink-0 ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mx-6 mb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-2 flex-1">
              <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
              <div className="text-red-300 text-sm whitespace-pre-line">{error}</div>
            </div>
            <button
              onClick={() => setError('')}
              className="text-red-400 hover:text-red-300 transition-colors flex-shrink-0 ml-2"
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
                {editingArtist ? 'Edit Artist' : 'Add New Artist'}
              </h4>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingArtist(null);
                  setFormData({
                    name: '',
                    yearBorn: new Date().getFullYear() - 30,
                    specialty: 'Vocal',
                    gharana: '',
                    knownRagas: [],
                    bio: '',
                    imgUrl: '',
                    rating: 0,
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
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter artist name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Year Born *
                </label>
                <input
                  type="number"
                  value={formData.yearBorn || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, yearBorn: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1800"
                  max={new Date().getFullYear()}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Specialty *
                </label>
                <select
                  value={formData.specialty || 'Vocal'}
                  onChange={(e) => setFormData(prev => ({ ...prev, specialty: e.target.value as Artist['specialty'] }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Vocal">Vocal</option>
                  <option value="Instrument">Instrument</option>
                  <option value="Sarod">Sarod</option>
                  <option value="Sitar">Sitar</option>
                  <option value="Bansuri">Bansuri</option>
                  <option value="Santoor">Santoor</option>
                  <option value="Tabla">Tabla</option>
                  <option value="Veena">Veena</option>
                  <option value="Surbahar">Surbahar</option>
                  <option value="Surbaha- Sitar">Surbaha- Sitar</option>
                  <option value="Vocal - Carnatic">Vocal - Carnatic</option>
                  <option value="Vocal  -Carnatic">Vocal  -Carnatic</option>
                  <option value="Musicologist - Composer">Musicologist - Composer</option>
                  <option value="Gundecha Brothers">Gundecha Brothers</option>
                  <option value="Malladi Brothers">Malladi Brothers</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Gharana *
                </label>
                <input
                  type="text"
                  value={formData.gharana || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, gharana: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter gharana"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Known Ragas
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.knownRagas?.map((raga, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 bg-blue-600 text-white text-sm rounded-full"
                  >
                    {raga}
                    <button
                      onClick={() => removeKnownRaga(raga)}
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
                    addKnownRaga(e.currentTarget.value);
                    e.currentTarget.value = '';
                  }
                }}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Type a raga and press Enter"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Bio * (max 20 words)
                <span className="text-xs text-gray-400 ml-2">
                  {getWordCount(formData.bio || '')}/20 words
                </span>
              </label>
              <textarea
                value={formData.bio || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Enter brief bio (max 20 words)"
                maxLength={200}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Image URL
                </label>
                <input
                  type="url"
                  value={formData.imgUrl || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, imgUrl: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter image URL"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Rating (0-5)
                </label>
                <input
                  type="number"
                  value={formData.rating || 0}
                  onChange={(e) => setFormData(prev => ({ ...prev, rating: parseFloat(e.target.value) }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  max="5"
                  step="0.1"
                />
              </div>
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
                  setEditingArtist(null);
                  setFormData({
                    name: '',
                    yearBorn: new Date().getFullYear() - 30,
                    specialty: 'Vocal',
                    gharana: '',
                    knownRagas: [],
                    bio: '',
                    imgUrl: '',
                    rating: 0,
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
          /* Artist List */
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="text-white/60 mt-2">Loading artists...</p>
              </div>
            ) : artists.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-white/60">No artists found. Add your first artist to get started.</p>
              </div>
            ) : (
              artists.map((artist) => (
                <div
                  key={artist._id}
                  className="bg-gray-800 rounded-lg p-4 border border-gray-700"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="text-lg font-medium text-white">{artist.name}</h4>
                        <span className="px-2 py-1 bg-purple-600/20 text-purple-300 text-xs rounded-full">
                          {artist.specialty}
                        </span>
                        {artist.isActive ? (
                          <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-600 text-white text-xs rounded-full">
                            Inactive
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-4 mb-2">
                        <span className="text-white/60 text-sm">
                          Born: {artist.yearBorn}
                        </span>
                        <span className="px-2 py-1 bg-blue-600/20 text-blue-300 text-xs rounded-full">
                          {artist.gharana}
                        </span>
                        <span className="text-white/60 text-sm">
                          Rating: {artist.rating.toFixed(1)}/5
                        </span>
                      </div>
                      
                      {artist.bio && (
                        <p className="text-white/60 text-sm mb-2">{artist.bio}</p>
                      )}
                      
                      {artist.knownRagas && artist.knownRagas.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {artist.knownRagas.map((raga, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-blue-600/20 text-blue-300 text-xs rounded-full"
                            >
                              {raga}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={() => handleEdit(artist)}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4 text-blue-400" />
                      </button>
                      <button
                        onClick={() => artist._id && handleDelete(artist._id)}
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

export default ArtistConfig;