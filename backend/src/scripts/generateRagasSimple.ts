import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Raga from '../models/Raga';

dotenv.config();

const generateRagas = async () => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/raga-mitra';
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

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
