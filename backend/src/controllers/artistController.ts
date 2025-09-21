import { Request, Response } from 'express';
import Artist from '../models/Artist';

export const getArtists = async (req: Request, res: Response) => {
  try {
    const { raga, filterByRaga } = req.query;
    
    let query = {};
    // Only filter by raga if explicitly requested (filterByRaga=true)
    if (raga && filterByRaga === 'true') {
      query = { knownRagas: { $in: [raga] } };
    }

    const artists = await Artist.find(query).sort({ rating: -1, name: 1 });
    res.json(artists);
  } catch (error) {
    console.error('Get artists error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getArtistById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const artist = await Artist.findById(id);
    
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    res.json(artist);
  } catch (error) {
    console.error('Get artist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createArtist = async (req: Request, res: Response) => {
  try {
    const { name, yearBorn, specialty, gharana, knownRagas, bio, imgUrl, rating, isActive } = req.body;

    if (!name || !yearBorn || !specialty || !bio) {
      return res.status(400).json({ message: 'Name, year born, specialty, and bio are required' });
    }

    // Check if artist already exists
    const existingArtist = await Artist.findOne({ name });
    if (existingArtist) {
      return res.status(400).json({ message: 'Artist with this name already exists' });
    }

    // Validate bio length (20 words max)
    const wordCount = bio.trim().split(/\s+/).length;
    if (wordCount > 20) {
      return res.status(400).json({ message: 'Bio must not exceed 20 words' });
    }

    const artist = new Artist({
      name,
      yearBorn,
      specialty,
      gharana,
      knownRagas: knownRagas || [],
      bio,
      imgUrl: imgUrl || '',
      rating: rating || 0,
      isActive: isActive !== undefined ? isActive : true
    });

    await artist.save();
    res.status(201).json(artist);
  } catch (error) {
    console.error('Create artist error:', error);
    res.status(500).json({ message: 'Server error', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const updateArtist = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, yearBorn, specialty, gharana, knownRagas, bio, imgUrl, rating, isActive } = req.body;

    if (!name || !yearBorn || !specialty || !bio) {
      return res.status(400).json({ message: 'Name, year born, specialty, and bio are required' });
    }

    // Check if artist exists
    const existingArtist = await Artist.findById(id);
    if (!existingArtist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    // Check if another artist with the same name exists (excluding current one)
    const duplicateArtist = await Artist.findOne({ name, _id: { $ne: id } });
    if (duplicateArtist) {
      return res.status(400).json({ message: 'Artist with this name already exists' });
    }

    // Validate bio length (20 words max)
    const wordCount = bio.trim().split(/\s+/).length;
    if (wordCount > 20) {
      return res.status(400).json({ message: 'Bio must not exceed 20 words' });
    }

    const artist = await Artist.findByIdAndUpdate(
      id,
      {
        name,
        yearBorn,
        specialty,
        gharana,
        knownRagas: knownRagas || [],
        bio,
        imgUrl: imgUrl || '',
        rating: rating || 0,
        isActive: isActive !== undefined ? isActive : true
      },
      { new: true, runValidators: true }
    );

    res.json(artist);
  } catch (error) {
    console.error('Update artist error:', error);
    res.status(500).json({ message: 'Server error', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const deleteArtist = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const artist = await Artist.findByIdAndDelete(id);
    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    res.json({ message: 'Artist deleted successfully' });
  } catch (error) {
    console.error('Delete artist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteAllArtists = async (req: Request, res: Response) => {
  try {
    const result = await Artist.deleteMany({});
    
    res.json({ 
      message: `Successfully deleted ${result.deletedCount} artists`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Delete all artists error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const batchImportArtists = async (req: Request, res: Response) => {
  try {
    const { artists } = req.body;

    if (!Array.isArray(artists)) {
      return res.status(400).json({ message: 'Artists must be an array' });
    }

    console.log(`\n=== ARTIST IMPORT DEBUG START ===`);
    console.log(`Total records to process: ${artists.length}`);
    console.log(`Sample record structure:`, JSON.stringify(artists[0], null, 2));

    const results = {
      successful: 0,
      failed: 0,
      duplicates: [] as string[],
      errors: [] as string[]
    };

    for (let i = 0; i < artists.length; i++) {
      const artistData = artists[i];
      
      console.log(`\n--- Processing Record ${i + 1}/${artists.length} ---`);
      console.log(`Artist Data:`, JSON.stringify(artistData, null, 2));
      
      try {
        // Validate required fields
        console.log(`Validating required fields...`);
        const missingFields = [];
        if (!artistData.name || artistData.name.trim() === '') missingFields.push('name');
        if (!artistData.yearBorn) missingFields.push('yearBorn');
        if (!artistData.specialty) missingFields.push('specialty');
        if (!artistData.bio || artistData.bio.trim() === '') missingFields.push('bio');
        
        console.log(`Missing fields check:`, missingFields);
        
        if (missingFields.length > 0) {
          console.log(`❌ FAILED: Missing required fields: ${missingFields.join(', ')}`);
          results.failed++;
          results.errors.push(`Row ${i + 1} (${artistData.name || 'No name'}): Missing required fields: ${missingFields.join(', ')}`);
          continue;
        }

        // Validate bio length
        console.log(`Validating bio length...`);
        const wordCount = artistData.bio.trim().split(/\s+/).length;
        console.log(`Bio word count: ${wordCount} (max: 20)`);
        if (wordCount > 20) {
          console.log(`❌ FAILED: Bio exceeds 20 words (${wordCount} words)`);
          results.failed++;
          results.errors.push(`Row ${i + 1} (${artistData.name}): Bio exceeds 20 words (${wordCount} words)`);
          continue;
        }

        // Check for duplicates
        console.log(`Checking for duplicates...`);
        const existingArtist = await Artist.findOne({ name: artistData.name });
        if (existingArtist) {
          console.log(`❌ FAILED: Duplicate name already exists`);
          results.duplicates.push(artistData.name);
          results.errors.push(`Row ${i + 1} (${artistData.name}): Duplicate name already exists`);
          continue;
        }

        // Create artist object
        console.log(`Creating artist object...`);
        const artist = new Artist({
          name: artistData.name,
          yearBorn: artistData.yearBorn,
          specialty: artistData.specialty,
          gharana: artistData.gharana,
          knownRagas: artistData.knownRagas || [],
          bio: artistData.bio,
          imgUrl: artistData.imgUrl || '',
          rating: artistData.rating || 0,
          isActive: artistData.isActive !== undefined ? artistData.isActive : true
        });

        console.log(`Artist object created:`, JSON.stringify(artist.toObject(), null, 2));

        // Save to database
        console.log(`Saving to database...`);
        await artist.save();
        console.log(`✅ SUCCESS: Artist saved with ID: ${artist._id}`);
        results.successful++;
      } catch (error) {
        console.log(`❌ FAILED: Database error occurred`);
        console.log(`Error details:`, error);
        results.failed++;
        const artistName = artistData.name || 'Unknown';
        let errorMessage = 'Unknown error';
        
        if (error instanceof Error) {
          console.log(`Error message: ${error.message}`);
          if (error.message.includes('yearBorn')) {
            errorMessage = `Invalid year born: must be between 1800 and ${new Date().getFullYear()}`;
          } else if (error.message.includes('specialty')) {
            errorMessage = 'Invalid specialty: must be "Vocal" or "Instrument"';
          } else if (error.message.includes('rating')) {
            errorMessage = 'Invalid rating: must be between 0 and 5';
          } else if (error.message.includes('bio')) {
            errorMessage = 'Bio too long: must be 200 characters or less';
          } else {
            errorMessage = error.message;
          }
        }
        
        console.log(`Final error message: ${errorMessage}`);
        results.errors.push(`Row ${i + 1} (${artistName}): ${errorMessage}`);
      }
    }

    console.log(`\n=== ARTIST IMPORT DEBUG END ===`);
    console.log(`Final results:`, results);
    
    // Summary of failed records
    if (results.failed > 0) {
      console.log(`\n=== FAILED RECORDS SUMMARY ===`);
      results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

    res.json({
      message: `Import completed. ${results.successful} successful, ${results.failed} failed, ${results.duplicates.length} duplicates skipped`,
      results
    });
  } catch (error) {
    console.error('Batch import artists error:', error);
    res.status(500).json({ message: 'Server error', details: error instanceof Error ? error.message : 'Unknown error' });
  }
};
