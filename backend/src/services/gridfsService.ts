import mongoose from 'mongoose';
import Grid from 'gridfs-stream';
import { GridFSBucket } from 'mongodb';

let gfs: Grid.Grid;
let gridFSBucket: GridFSBucket;

export const initGridFS = () => {
  const conn = mongoose.connection;
  if (conn.db) {
    gfs = Grid(conn.db, mongoose.mongo);
    gfs.collection('audiofiles');
    
    // Create GridFS bucket
    gridFSBucket = new GridFSBucket(conn.db, {
      bucketName: 'audiofiles'
    });
  }
};

export const getGridFS = () => gfs;
export const getGridFSBucket = () => gridFSBucket;

export interface AudioFileMetadata {
  filename: string;
  originalName: string;
  contentType: string;
  size: number;
  uploadDate: Date;
  event?: string;
  artist?: string;
  raga?: string;
  title?: string;
  duration?: string;
  durationSeconds?: number;
}

export const uploadAudioFile = async (
  file: Express.Multer.File,
  metadata: Partial<AudioFileMetadata>
): Promise<string> => {
  try {
    if (!gridFSBucket) {
      throw new Error('GridFS bucket not initialized');
    }

    const uploadStream = gridFSBucket.openUploadStream(file.originalname, {
      metadata: {
        ...metadata,
        originalName: file.originalname,
        contentType: file.mimetype,
        size: file.size,
        uploadDate: new Date()
      }
    });

    return new Promise((resolve, reject) => {
      uploadStream.on('error', (error) => {
        reject(error);
      });

      uploadStream.on('finish', () => {
        resolve(uploadStream.id.toString());
      });

      uploadStream.end(file.buffer);
    });
  } catch (error) {
    console.error('Error uploading audio file:', error);
    throw error;
  }
};

export const getAudioFile = async (fileId: string): Promise<{ stream: NodeJS.ReadableStream; metadata: any }> => {
  try {
    if (!gridFSBucket) {
      throw new Error('GridFS bucket not initialized');
    }

    // First try to find by filename (for uploaded files)
    let files = await gridFSBucket.find({ filename: fileId }).toArray();
    
    // If not found by filename, try as ObjectId (for backward compatibility)
    if (files.length === 0) {
      try {
        const objectId = new mongoose.Types.ObjectId(fileId);
        files = await gridFSBucket.find({ _id: objectId }).toArray();
      } catch (objectIdError) {
        // If it's not a valid ObjectId, continue with empty array
        files = [];
      }
    }
    
    if (files.length === 0) {
      throw new Error('File not found');
    }

    const file = files[0];
    const downloadStream = gridFSBucket.openDownloadStream(file._id);

    return {
      stream: downloadStream,
      metadata: file
    };
  } catch (error) {
    console.error('Error getting audio file:', error);
    throw error;
  }
};

export const deleteAudioFile = async (fileId: string): Promise<void> => {
  try {
    if (!gridFSBucket) {
      throw new Error('GridFS bucket not initialized');
    }

    // First try to find by filename (for uploaded files)
    let files = await gridFSBucket.find({ filename: fileId }).toArray();
    
    // If not found by filename, try as ObjectId (for backward compatibility)
    if (files.length === 0) {
      try {
        const objectId = new mongoose.Types.ObjectId(fileId);
        files = await gridFSBucket.find({ _id: objectId }).toArray();
      } catch (objectIdError) {
        // If it's not a valid ObjectId, continue with empty array
        files = [];
      }
    }
    
    if (files.length === 0) {
      throw new Error('File not found');
    }

    const file = files[0];
    await gridFSBucket.delete(file._id);
  } catch (error) {
    console.error('Error deleting audio file:', error);
    throw error;
  }
};

export const listAudioFiles = async (): Promise<AudioFileMetadata[]> => {
  try {
    if (!gridFSBucket) {
      throw new Error('GridFS bucket not initialized');
    }

    const files = await gridFSBucket.find({}).toArray();
    
    return files.map(file => ({
      _id: file._id.toString(),
      filename: file.filename,
      originalName: file.metadata?.originalName || file.filename,
      contentType: file.metadata?.contentType || file.contentType,
      size: file.metadata?.size || file.length,
      uploadDate: file.metadata?.uploadDate || file.uploadDate,
      event: file.metadata?.event,
      artist: file.metadata?.artist,
      raga: file.metadata?.raga,
      title: file.metadata?.title,
      duration: file.metadata?.duration,
      durationSeconds: file.metadata?.durationSeconds
    }));
  } catch (error) {
    console.error('Error listing audio files:', error);
    throw error;
  }
};
