import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface AudioFileUploadProps {
  onUploadSuccess?: (track: any) => void;
  onUploadError?: (error: string) => void;
}

interface UploadProgress {
  file: File;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
  result?: any;
}

const AudioFileUpload: React.FC<AudioFileUploadProps> = ({ 
  onUploadSuccess, 
  onUploadError 
}) => {
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [existingFiles, setExistingFiles] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [deletingFiles, setDeletingFiles] = useState<Set<string>>(new Set());

  // Fetch existing audio files
  const fetchExistingFiles = async () => {
    if (!token) return;
    
    setLoadingFiles(true);
    try {
      const response = await fetch('http://localhost:3006/api/audio/files', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched files data:', data);
        setExistingFiles(data.files || []);
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch existing files:', response.status, errorText);
      }
    } catch (error) {
      console.error('Error fetching existing files:', error);
    } finally {
      setLoadingFiles(false);
    }
  };

  // Fetch files on component mount
  useEffect(() => {
    fetchExistingFiles();
  }, [token]);

  // Delete audio file
  const deleteAudioFile = async (fileId: string) => {
    if (!token) {
      alert('No authentication token available. Please log in again.');
      return;
    }

    if (!confirm('Are you sure you want to delete this audio file? This action cannot be undone.')) {
      return;
    }

    // Add to deleting files set
    setDeletingFiles(prev => new Set(prev).add(fileId));

    try {
      const response = await fetch(`http://localhost:3006/api/audio/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        console.log('File deleted successfully');
        // Refresh the file list
        fetchExistingFiles();
      } else {
        const errorText = await response.text();
        console.error('Failed to delete file:', response.status, errorText);
        alert('Failed to delete file. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Error deleting file. Please try again.');
    } finally {
      // Remove from deleting files set
      setDeletingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const audioFiles = files.filter(file => 
      file.type.startsWith('audio/') && 
      ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(
        file.name.split('.').pop()?.toLowerCase() || ''
      )
    );

    if (audioFiles.length !== files.length) {
      alert('Some files were skipped. Only audio files (mp3, wav, ogg, m4a, aac, flac) are allowed.');
    }

    setSelectedFiles(audioFiles);
  };

  const validateFilename = (filename: string): { isValid: boolean; error?: string } => {
    const parts = filename.split(' - ');
    if (parts.length !== 4) {
      return {
        isValid: false,
        error: 'Filename must follow format: "event - Artist - raga - Title.xxx"'
      };
    }
    return { isValid: true };
  };

  const uploadFile = async (file: File): Promise<any> => {
    console.log('Uploading file:', file.name, 'with token:', token ? 'Present' : 'Missing');
    
    if (!token) {
      throw new Error('No authentication token available. Please log in again.');
    }

    const formData = new FormData();
    formData.append('audio', file);

    const response = await fetch('http://localhost:3006/api/audio/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    console.log('Upload response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Upload error response:', errorText);
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }
      throw new Error(errorData.error || `Upload failed: ${response.status}`);
    }

    const result = await response.json();
    console.log('Upload successful:', result);
    return result;
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    const progress: UploadProgress[] = selectedFiles.map(file => ({
      file,
      progress: 0,
      status: 'uploading'
    }));
    setUploadProgress(progress);

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      
      // Validate filename format
      const filenameValidation = validateFilename(file.name);
      if (!filenameValidation.isValid) {
        setUploadProgress(prev => 
          prev.map((p, index) => 
            index === i 
              ? { ...p, status: 'error', error: filenameValidation.error }
              : p
          )
        );
        continue;
      }

      try {
        const result = await uploadFile(file);
        
        setUploadProgress(prev => 
          prev.map((p, index) => 
            index === i 
              ? { ...p, status: 'success', progress: 100, result }
              : p
          )
        );

        if (onUploadSuccess) {
          onUploadSuccess(result.track);
        }
        
        // Refresh the existing files list
        fetchExistingFiles();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        
        setUploadProgress(prev => 
          prev.map((p, index) => 
            index === i 
              ? { ...p, status: 'error', error: errorMessage }
              : p
          )
        );

        if (onUploadError) {
          onUploadError(errorMessage);
        }
      }
    }

    setIsUploading(false);
  };

  const clearFiles = () => {
    setSelectedFiles([]);
    setUploadProgress([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setUploadProgress(prev => prev.filter((_, i) => i !== index));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'uploading': return 'text-blue-600';
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploading': return '⏳';
      case 'success': return '✅';
      case 'error': return '❌';
      default: return '📁';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Audio File Upload</h2>
      
      {/* File Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Audio Files
        </label>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="audio/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Choose Files
          </button>
          <p className="text-sm text-gray-500 mt-2">
            Supported formats: MP3, WAV, OGG, M4A, AAC, FLAC
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Filename format: "event - Artist - raga - Title.xxx"
          </p>
        </div>
      </div>

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">
            Selected Files ({selectedFiles.length})
          </h3>
          <div className="space-y-2">
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-lg">🎵</span>
                  <div>
                    <p className="font-medium text-gray-800">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {uploadProgress[index] && (
                    <span className={`text-sm ${getStatusColor(uploadProgress[index].status)}`}>
                      {getStatusIcon(uploadProgress[index].status)}
                    </span>
                  )}
                  <button
                    onClick={() => removeFile(index)}
                    className="text-red-500 hover:text-red-700 text-sm"
                    disabled={isUploading}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {uploadProgress.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">Upload Progress</h3>
          <div className="space-y-2">
            {uploadProgress.map((progress, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-800">
                    {progress.file.name}
                  </span>
                  <span className={`text-sm ${getStatusColor(progress.status)}`}>
                    {getStatusIcon(progress.status)} {progress.status}
                  </span>
                </div>
                {progress.status === 'uploading' && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress.progress}%` }}
                    ></div>
                  </div>
                )}
                {progress.status === 'error' && progress.error && (
                  <p className="text-red-600 text-sm mt-1">{progress.error}</p>
                )}
                {progress.status === 'success' && progress.result && (
                  <p className="text-green-600 text-sm mt-1">
                    Uploaded successfully! Track ID: {progress.result.track.id}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Existing Files */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-700">
            Uploaded Files ({existingFiles.length})
          </h3>
          <button
            onClick={fetchExistingFiles}
            disabled={loadingFiles}
            className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
          >
            {loadingFiles ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        
        {loadingFiles ? (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <p className="text-sm text-gray-500 mt-2">Loading files...</p>
          </div>
        ) : existingFiles.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No audio files uploaded yet.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {existingFiles.map((file, index) => (
              <div key={file._id || index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-lg">🎵</span>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{file.originalName || file.filename || 'Unknown file'}</p>
                    <p className="text-sm text-gray-500">
                      {file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Size unknown'}
                    </p>
                    {file.raga && file.artist && (
                      <p className="text-xs text-blue-600">
                        {file.raga} - {file.artist}
                      </p>
                    )}
                    {file.uploadDate && (
                      <p className="text-xs text-gray-400">
                        Uploaded: {new Date(file.uploadDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-green-600 text-sm">✅ Uploaded</span>
                  <button
                    onClick={() => deleteAudioFile(file._id)}
                    disabled={deletingFiles.has(file._id)}
                    className="text-red-500 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed text-sm"
                  >
                    {deletingFiles.has(file._id) ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-4">
        <button
          onClick={handleUpload}
          disabled={selectedFiles.length === 0 || isUploading}
          className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition-colors"
        >
          {isUploading ? 'Uploading...' : `Upload ${selectedFiles.length} File${selectedFiles.length !== 1 ? 's' : ''}`}
        </button>
        <button
          onClick={clearFiles}
          disabled={isUploading}
          className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition-colors"
        >
          Clear All
        </button>
      </div>
    </div>
  );
};

export default AudioFileUpload;
