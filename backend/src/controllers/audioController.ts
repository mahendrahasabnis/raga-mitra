import { Request, Response } from 'express';
import multer from 'multer';
import { uploadAudioFile, getAudioFile, deleteAudioFile, listAudioFiles as listGridFSFiles, initGridFS } from '../services/gridfsService';
import { parseAudioFilename, validateAudioFile, createAudioFileMetadata } from '../services/audioMetadataService';
import Track from '../models/Track';
import Artist from '../models/Artist';
import Raga from '../models/Raga';
import Event from '../models/Event';

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

export const uploadAudio = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Validate the audio file
    const validation = validateAudioFile(req.file);
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.error });
    }

    // Parse metadata from filename
    const parsedMetadata = parseAudioFilename(req.file.originalname);
    if (!parsedMetadata) {
      return res.status(400).json({ 
        error: 'Invalid filename format. Expected: "event - Artist - raga - Title.xxx"' 
      });
    }

    // Check if artist exists, create if not
    let artist = await Artist.findOne({ name: parsedMetadata.artist });
    if (!artist) {
      artist = new Artist({
        name: parsedMetadata.artist,
        yearBorn: 1900, // Default value, should be updated manually
        specialty: 'Classical Music',
        bio: `Artist: ${parsedMetadata.artist}`,
        knownRagas: [parsedMetadata.raga]
      });
      await artist.save();
    } else {
      // Add raga to known ragas if not already present
      if (!artist.knownRagas.includes(parsedMetadata.raga)) {
        artist.knownRagas.push(parsedMetadata.raga);
        await artist.save();
      }
    }

    // Check if raga exists, create if not
    let raga = await Raga.findOne({ name: parsedMetadata.raga });
    if (!raga) {
      raga = new Raga({
        name: parsedMetadata.raga,
        tags: ['classical'],
        idealHours: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
        description: `Raga: ${parsedMetadata.raga}`,
        seasons: ['Vasant', 'Grishma', 'Varsha', 'Sharad', 'Hemant', 'Shishir'],
        marathiSeasons: ['वसंत', 'ग्रीष्म', 'वर्षा', 'शरद', 'हेमंत', 'शिशिर']
      });
      await raga.save();
    }

    // Check if event exists, create if not
    let event = await Event.findOne({ name: parsedMetadata.event });
    if (!event) {
      event = new Event({
        name: parsedMetadata.event,
        eventTag: parsedMetadata.event.toLowerCase().replace(/\s+/g, '-'),
        description: `Event: ${parsedMetadata.event}`
      });
      await event.save();
    }

    // Create audio file metadata
    const audioMetadata = createAudioFileMetadata(req.file, parsedMetadata);

    // Upload file to GridFS
    const fileId = await uploadAudioFile(req.file, audioMetadata);

    // Generate unique searchKey to avoid duplicates
    const baseSearchKey = `${parsedMetadata.raga}-${parsedMetadata.artist}-${parsedMetadata.title}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    let searchKey = baseSearchKey;
    let counter = 1;
    
    // Check if searchKey already exists and add counter if needed
    while (await Track.findOne({ searchKey })) {
      searchKey = `${baseSearchKey}-${counter}`;
      counter++;
    }

    // Create track record
    const track = new Track({
      raga: parsedMetadata.raga,
      artist: parsedMetadata.artist,
      title: parsedMetadata.title,
      url: `/api/audio/stream/${fileId}`,
      duration: '0:00', // Default duration, can be updated later
      durationSeconds: 0,
      likes: 0,
      isCurated: false,
      ratings: [],
      thumbnail: '', // Can be added later
      searchKey: searchKey
    });

    await track.save();

    // Add track URL to event
    if (!event.trackUrls.includes(track.url)) {
      event.trackUrls.push(track.url);
      await event.save();
    }

    res.status(201).json({
      message: 'Audio file uploaded successfully',
      track: {
        id: track._id,
        title: track.title,
        artist: track.artist,
        raga: track.raga,
        event: parsedMetadata.event,
        url: track.url,
        fileId
      }
    });

  } catch (error: any) {
    console.error('Error uploading audio file:', error);
    
    // Handle specific MongoDB duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({ 
        error: 'A track with similar metadata already exists. Please check the filename format or try a different file.',
        details: error.keyValue
      });
    }
    
    res.status(500).json({ error: 'Failed to upload audio file' });
  }
};

export const streamAudio = async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;

    const { stream, metadata } = await getAudioFile(fileId);

    // Set appropriate headers
    res.set({
      'Content-Type': metadata.contentType || 'audio/mpeg',
      'Content-Length': metadata.length,
      'Accept-Ranges': 'bytes'
    });

    // Handle range requests for audio streaming
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : metadata.length - 1;
      const chunksize = (end - start) + 1;

      res.status(206).set({
        'Content-Range': `bytes ${start}-${end}/${metadata.length}`,
        'Content-Length': chunksize.toString()
      });

      // Create a partial stream
      const partialStream = stream.pipe(require('stream').Transform({
        transform(chunk: any, encoding: any, callback: any) {
          // This is a simplified implementation
          // In production, you'd want to properly handle byte ranges
          callback(null, chunk);
        }
      }));

      partialStream.pipe(res);
    } else {
      stream.pipe(res);
    }

  } catch (error) {
    console.error('Error streaming audio file:', error);
    res.status(404).json({ error: 'Audio file not found' });
  }
};

export const deleteAudio = async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;

    // Find and delete the track record
    const track = await Track.findOne({ url: `/api/audio/stream/${fileId}` });
    if (track) {
      await track.deleteOne();
    }

    // Delete the file from GridFS
    await deleteAudioFile(fileId);

    res.json({ message: 'Audio file deleted successfully' });

  } catch (error) {
    console.error('Error deleting audio file:', error);
    res.status(500).json({ error: 'Failed to delete audio file' });
  }
};

export const listAudioFiles = async (req: Request, res: Response) => {
  try {
    const files = await listGridFSFiles();
    res.json({ files });
  } catch (error) {
    console.error('Error listing audio files:', error);
    res.status(500).json({ error: 'Failed to list audio files' });
  }
};

export const getAudioInfo = async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;

    const { metadata } = await getAudioFile(fileId);
    res.json({ metadata });
  } catch (error) {
    console.error('Error getting audio info:', error);
    res.status(404).json({ error: 'Audio file not found' });
  }
};

// Export multer middleware for use in routes
export { upload };
