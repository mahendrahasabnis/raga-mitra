import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Raga from '../models/Raga';

dotenv.config();

const generateRagas = async () => {
  try {
    // Connect to MongoDB Atlas
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      console.error('MONGODB_URI environment variable is not set');
      console.error('Please configure MongoDB Atlas connection in your .env file');
      process.exit(1);
    }

    if (mongoURI.includes('localhost') || mongoURI.includes('127.0.0.1')) {
      console.error('Local MongoDB connection detected. Please use MongoDB Atlas only.');
      console.error('Update MONGODB_URI in your .env file to use MongoDB Atlas connection string');
      process.exit(1);
    }

    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB Atlas');

    // Clear existing ragas
    await Raga.deleteMany({});
    console.log('Cleared existing ragas');

    const ragas = [];
    const seasons = ['Vasant', 'Grishma', 'Varsha', 'Sharad', 'Hemant', 'Shishir'];
    const popularityLevels = ['highly listened', 'moderately listened', 'sparingly listened', 'rarely listened'];
    const timeSlots = [
      { hours: [6, 7, 8, 9], period: 'Morning' },
      { hours: [10, 11, 12, 13], period: 'Late Morning' },
      { hours: [14, 15, 16, 17], period: 'Afternoon' },
      { hours: [18, 19, 20, 21], period: 'Evening' },
      { hours: [22, 23, 0, 1], period: 'Night' },
      { hours: [2, 3, 4, 5], period: 'Late Night' }
    ];

    // Generate 200 unique ragas
    for (let i = 0; i < 200; i++) {
      const timeSlot = timeSlots[i % timeSlots.length];
      const season = seasons[i % seasons.length];
      const popularity = popularityLevels[i % popularityLevels.length];
      
      const raga = {
        name: `Raga ${i + 1}`,
        tags: [timeSlot.period, season, popularity],
        idealHours: timeSlot.hours,
        description: `A beautiful ${timeSlot.period.toLowerCase()} raga in ${season} season`,
        seasons: [season],
        popularity: popularity,
        isRecommended: popularity === 'highly listened',
        isActive: true
      };

      ragas.push(raga);
    }

    // Insert all ragas
    await Raga.insertMany(ragas);
    console.log(`Successfully created ${ragas.length} ragas`);

    // Verify count
    const count = await Raga.countDocuments();
    console.log(`Total ragas in database: ${count}`);

  } catch (error) {
    console.error('Error generating ragas:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

generateRagas();
