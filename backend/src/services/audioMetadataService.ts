import { AudioFileMetadata } from './gridfsService';

export interface ParsedAudioMetadata {
  event: string;
  artist: string;
  raga: string;
  title: string;
  originalFilename: string;
  fileExtension: string;
}

export const parseAudioFilename = (filename: string): ParsedAudioMetadata | null => {
  try {
    // Remove file extension
    const fileExtension = filename.split('.').pop()?.toLowerCase() || '';
    const nameWithoutExtension = filename.replace(/\.[^/.]+$/, '');
    
    // Expected format: "event - Artist - raga - Title"
    // Split by " - " (space, dash, space)
    const parts = nameWithoutExtension.split(' - ');
    
    if (parts.length !== 4) {
      throw new Error(`Invalid filename format. Expected: "event - Artist - raga - Title.${fileExtension}"`);
    }
    
    const [event, artist, raga, title] = parts.map(part => part.trim());
    
    // Validate that all parts are non-empty
    if (!event || !artist || !raga || !title) {
      throw new Error('All parts of the filename must be non-empty');
    }
    
    return {
      event,
      artist,
      raga,
      title,
      originalFilename: filename,
      fileExtension
    };
  } catch (error) {
    console.error('Error parsing audio filename:', error);
    return null;
  }
};

export const validateAudioFile = (file: Express.Multer.File): { isValid: boolean; error?: string } => {
  // Check file type
  const allowedMimeTypes = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/m4a',
    'audio/aac',
    'audio/flac'
  ];
  
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return {
      isValid: false,
      error: `Unsupported file type: ${file.mimetype}. Allowed types: ${allowedMimeTypes.join(', ')}`
    };
  }
  
  // Check file size (max 100MB)
  const maxSize = 100 * 1024 * 1024; // 100MB
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size: 100MB`
    };
  }
  
  // Parse filename to validate format
  const parsed = parseAudioFilename(file.originalname);
  if (!parsed) {
    return {
      isValid: false,
      error: 'Invalid filename format. Expected: "event - Artist - raga - Title.xxx"'
    };
  }
  
  return { isValid: true };
};

export const createAudioFileMetadata = (
  file: Express.Multer.File,
  parsedMetadata: ParsedAudioMetadata,
  duration?: string,
  durationSeconds?: number
): AudioFileMetadata => {
  return {
    filename: file.originalname,
    originalName: file.originalname,
    contentType: file.mimetype,
    size: file.size,
    uploadDate: new Date(),
    event: parsedMetadata.event,
    artist: parsedMetadata.artist,
    raga: parsedMetadata.raga,
    title: parsedMetadata.title,
    duration,
    durationSeconds
  };
};

export const getAudioDuration = async (file: Express.Multer.File): Promise<{ duration: string; durationSeconds: number } | null> => {
  // This is a placeholder implementation
  // In a real implementation, you would use a library like node-ffmpeg or music-metadata
  // to extract the actual duration from the audio file
  
  // For now, return null to indicate duration extraction is not implemented
  // The frontend can handle this or we can implement it later
  return null;
};
