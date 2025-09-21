import { Request, Response } from 'express';
import Raga from '../models/Raga';

export const getRagas = async (req: Request, res: Response) => {
  try {
    const currentHour = new Date().getHours();
    
    // Get all ragas and mark recommended ones
    const ragas = await Raga.find().sort({ name: 1 });
    
    const ragasWithRecommendation = ragas.map(raga => {
      // Check if current hour is within 2 hours of any ideal hour
      const isRecommended = raga.idealHours.some(hour => {
        const hourDiff = Math.abs(hour - currentHour);
        return hourDiff <= 2 || hourDiff >= 22; // Handle midnight crossover
      });
      
      // For testing, let's make Bageshri always recommended
      const isRecommendedForTesting = raga.name === 'Bageshri' || isRecommended;
      
      return {
        ...raga.toObject(),
        isRecommended: isRecommendedForTesting
      };
    });

    // Sort with recommended ragas first
    ragasWithRecommendation.sort((a, b) => {
      if (a.isRecommended && !b.isRecommended) return -1;
      if (!a.isRecommended && b.isRecommended) return 1;
      return 0;
    });

    res.json(ragasWithRecommendation);
  } catch (error) {
    console.error('Get ragas error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getRagaById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const raga = await Raga.findById(id);
    
    if (!raga) {
      return res.status(404).json({ message: 'Raga not found' });
    }

    res.json(raga);
  } catch (error) {
    console.error('Get raga error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createRaga = async (req: Request, res: Response) => {
  try {
    const { name, description, tags, idealHours, seasons, popularity, isActive } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Raga name is required' });
    }

    // Check if raga already exists
    const existingRaga = await Raga.findOne({ name });
    if (existingRaga) {
      return res.status(400).json({ message: 'Raga with this name already exists' });
    }

    const raga = new Raga({
      name,
      description: description || '',
      tags: tags || [],
      idealHours: idealHours || [],
      seasons: seasons || [],
      popularity: popularity || 'moderately listened',
      isActive: isActive !== undefined ? isActive : true
    });

    await raga.save();
    res.status(201).json(raga);
  } catch (error) {
    console.error('Create raga error:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
    }
    res.status(500).json({ message: 'Server error', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const updateRaga = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, tags, idealHours, seasons, popularity, isActive } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Raga name is required' });
    }

    // Check if raga exists
    const existingRaga = await Raga.findById(id);
    if (!existingRaga) {
      return res.status(404).json({ message: 'Raga not found' });
    }

    // Check if another raga with the same name exists (excluding current one)
    const duplicateRaga = await Raga.findOne({ name, _id: { $ne: id } });
    if (duplicateRaga) {
      return res.status(400).json({ message: 'Raga with this name already exists' });
    }

    const raga = await Raga.findByIdAndUpdate(
      id,
      {
        name,
        description: description || '',
        tags: tags || [],
        idealHours: idealHours || [],
        seasons: seasons || [],
        popularity: popularity || 'moderately listened',
        isActive: isActive !== undefined ? isActive : true
      },
      { new: true, runValidators: true }
    );

    res.json(raga);
  } catch (error) {
    console.error('Update raga error:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
    }
    res.status(500).json({ message: 'Server error', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const deleteRaga = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const raga = await Raga.findByIdAndDelete(id);
    if (!raga) {
      return res.status(404).json({ message: 'Raga not found' });
    }

    res.json({ message: 'Raga deleted successfully' });
  } catch (error) {
    console.error('Delete raga error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteAllRagas = async (req: Request, res: Response) => {
  try {
    const result = await Raga.deleteMany({});
    
    res.json({ 
      message: `Successfully deleted ${result.deletedCount} ragas`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Delete all ragas error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const batchImportRagas = async (req: Request, res: Response) => {
  try {
    const { ragas } = req.body;

    if (!Array.isArray(ragas)) {
      return res.status(400).json({ message: 'Ragas must be an array' });
    }

    if (ragas.length === 0) {
      return res.status(400).json({ message: 'No ragas provided' });
    }

    if (ragas.length > 1000) {
      return res.status(400).json({ message: 'Too many ragas. Maximum 1000 ragas per batch.' });
    }

    const results = {
      total: ragas.length,
      successful: 0,
      failed: 0,
      errors: [] as string[],
      created: [] as any[],
      duplicates: [] as string[]
    };

    // Process ragas in batches to avoid memory issues
    const batchSize = 50;
    for (let i = 0; i < ragas.length; i += batchSize) {
      const batch = ragas.slice(i, i + batchSize);
      
      for (const ragaData of batch) {
        try {
          // Validate required fields
          if (!ragaData.name || !ragaData.description) {
            results.failed++;
            results.errors.push(`Raga missing required fields: ${ragaData.name || 'Unknown'}`);
            continue;
          }

          // Check if raga already exists
          const existingRaga = await Raga.findOne({ name: ragaData.name });
          if (existingRaga) {
            results.duplicates.push(ragaData.name);
            continue;
          }

          // Create raga
          const raga = new Raga({
            name: ragaData.name,
            description: ragaData.description || '',
            tags: ragaData.tags || [],
            idealHours: ragaData.idealHours || [],
            seasons: ragaData.seasons || [],
            popularity: ragaData.popularity || 'moderately listened',
            isActive: ragaData.isActive !== undefined ? ragaData.isActive : true
          });

          await raga.save();
          results.successful++;
          results.created.push({
            id: raga._id,
            name: raga.name
          });

        } catch (error) {
          results.failed++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.errors.push(`${ragaData.name}: ${errorMessage}`);
          console.error('Error creating raga:', ragaData.name, error);
        }
      }
    }

    res.status(200).json({
      message: `Batch import completed. ${results.successful} successful, ${results.failed} failed, ${results.duplicates.length} duplicates skipped.`,
      results
    });

  } catch (error) {
    console.error('Batch import ragas error:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
    }
    res.status(500).json({ 
      message: 'Server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};
