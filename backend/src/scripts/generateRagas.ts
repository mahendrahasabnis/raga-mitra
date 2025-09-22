import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Raga from '../models/Raga';

dotenv.config();

const ragaNames = [
  // Morning Ragas
  'Ahir Bhairav', 'Bageshri', 'Bairagi', 'Basant', 'Bhairavi', 'Bilaskhani Todi', 'Bilawal', 'Bilawal-Durga',
  'Brindabani Sarang', 'Chandrakauns', 'Desh', 'Deshkar', 'Gaud Sarang', 'Gujri Todi', 'Hindol', 'Jaunpuri',
  'Jog', 'Kafi', 'Kalingada', 'Khamaj', 'Komal Rishabh Asavari', 'Lalit', 'Madhuvanti', 'Marwa',
  'Miyan Ki Malhar', 'Multani', 'Nata', 'Puriya', 'Puriya Dhanashri', 'Rageshri', 'Ramkali', 'Shree',
  'Shuddh Kalyan', 'Shuddh Sarang', 'Sohini', 'Todi', 'Vibhas', 'Yaman Kalyan',

  // Evening Ragas
  'Adana', 'Bageshri', 'Bahar', 'Basant Mukhari', 'Bhairavi', 'Bihag', 'Bihagda', 'Chandrakauns',
  'Chhayanat', 'Darbari', 'Desh', 'Deshkar', 'Durga', 'Gaud Malhar', 'Gujri Todi', 'Hameer',
  'Hindol', 'Jaunpuri', 'Jog', 'Kafi', 'Kalingada', 'Khamaj', 'Komal Rishabh Asavari', 'Lalit',
  'Madhuvanti', 'Malkauns', 'Marwa', 'Miyan Ki Malhar', 'Multani', 'Nata', 'Pahadi', 'Pilu',
  'Puriya', 'Puriya Dhanashri', 'Rageshri', 'Ramkali', 'Shree', 'Shuddh Kalyan', 'Shuddh Sarang',
  'Sohini', 'Todi', 'Vibhas', 'Yaman', 'Yaman Kalyan',

  // Night Ragas
  'Adana', 'Bageshri', 'Bahar', 'Basant Mukhari', 'Bhairavi', 'Bihag', 'Bihagda', 'Chandrakauns',
  'Chhayanat', 'Darbari', 'Desh', 'Deshkar', 'Durga', 'Gaud Malhar', 'Gujri Todi', 'Hameer',
  'Hindol', 'Jaunpuri', 'Jog', 'Kafi', 'Kalingada', 'Khamaj', 'Komal Rishabh Asavari', 'Lalit',
  'Madhuvanti', 'Malkauns', 'Marwa', 'Miyan Ki Malhar', 'Multani', 'Nata', 'Pahadi', 'Pilu',
  'Puriya', 'Puriya Dhanashri', 'Rageshri', 'Ramkali', 'Shree', 'Shuddh Kalyan', 'Shuddh Sarang',
  'Sohini', 'Todi', 'Vibhas', 'Yaman', 'Yaman Kalyan',

  // Additional Classical Ragas
  'Abhogi', 'Abhogi Kanada', 'Adbhut Kalyan', 'Ahir Lalat', 'Alhaiya Bilawal', 'Amrit Varshini',
  'Anand Bhairav', 'Anand Kalyan', 'Asavari', 'Bageshri Kanada', 'Bageshri Todi', 'Bahar',
  'Basant', 'Basant Mukhari', 'Bhairav', 'Bhairavi', 'Bhatiyar', 'Bhavani', 'Bhoop', 'Bhoopali',
  'Bihag', 'Bihagda', 'Bilaskhani Todi', 'Bilawal', 'Bilawal-Durga', 'Brindabani Sarang',
  'Chandrakauns', 'Chandrakauns Kanada', 'Chhayanat', 'Darbari', 'Darbari Kanada', 'Desh',
  'Deshkar', 'Durga', 'Gaud Malhar', 'Gaud Sarang', 'Gujri Todi', 'Gunakri', 'Hameer',
  'Hameer Kalyan', 'Hindol', 'Hindol Kalyan', 'Jaunpuri', 'Jog', 'Jog Kalyan', 'Kafi',
  'Kalingada', 'Kamod', 'Kedar', 'Khamaj', 'Komal Rishabh Asavari', 'Lalit', 'Madhuvanti',
  'Malkauns', 'Malkauns Kanada', 'Marwa', 'Miyan Ki Malhar', 'Multani', 'Nata', 'Pahadi',
  'Pilu', 'Puriya', 'Puriya Dhanashri', 'Rageshri', 'Ramkali', 'Shree', 'Shuddh Kalyan',
  'Shuddh Sarang', 'Sohini', 'Todi', 'Vibhas', 'Yaman', 'Yaman Kalyan',

  // More Ragas to reach 200
  'Abhogi Kanada', 'Adbhut Kalyan', 'Ahir Lalat', 'Alhaiya Bilawal', 'Amrit Varshini',
  'Anand Bhairav', 'Anand Kalyan', 'Asavari', 'Bageshri Kanada', 'Bageshri Todi',
  'Bahar', 'Basant', 'Basant Mukhari', 'Bhairav', 'Bhatiyar', 'Bhavani', 'Bhoop',
  'Bhoopali', 'Bilaskhani Todi', 'Bilawal', 'Bilawal-Durga', 'Brindabani Sarang',
  'Chandrakauns', 'Chandrakauns Kanada', 'Chhayanat', 'Darbari', 'Darbari Kanada',
  'Desh', 'Deshkar', 'Durga', 'Gaud Malhar', 'Gaud Sarang', 'Gujri Todi', 'Gunakri',
  'Hameer', 'Hameer Kalyan', 'Hindol', 'Hindol Kalyan', 'Jaunpuri', 'Jog', 'Jog Kalyan',
  'Kafi', 'Kalingada', 'Kamod', 'Kedar', 'Khamaj', 'Komal Rishabh Asavari', 'Lalit',
  'Madhuvanti', 'Malkauns', 'Malkauns Kanada', 'Marwa', 'Miyan Ki Malhar', 'Multani',
  'Nata', 'Pahadi', 'Pilu', 'Puriya', 'Puriya Dhanashri', 'Rageshri', 'Ramkali',
  'Shree', 'Shuddh Kalyan', 'Shuddh Sarang', 'Sohini', 'Todi', 'Vibhas', 'Yaman',
  'Yaman Kalyan', 'Abhogi', 'Adbhut Kalyan', 'Ahir Lalat', 'Alhaiya Bilawal',
  'Amrit Varshini', 'Anand Bhairav', 'Anand Kalyan', 'Asavari', 'Bageshri Kanada',
  'Bageshri Todi', 'Bahar', 'Basant', 'Basant Mukhari', 'Bhairav', 'Bhatiyar',
  'Bhavani', 'Bhoop', 'Bhoopali', 'Bilaskhani Todi', 'Bilawal', 'Bilawal-Durga',
  'Brindabani Sarang', 'Chandrakauns', 'Chandrakauns Kanada', 'Chhayanat', 'Darbari',
  'Darbari Kanada', 'Desh', 'Deshkar', 'Durga', 'Gaud Malhar', 'Gaud Sarang',
  'Gujri Todi', 'Gunakri', 'Hameer', 'Hameer Kalyan', 'Hindol', 'Hindol Kalyan',
  'Jaunpuri', 'Jog', 'Jog Kalyan', 'Kafi', 'Kalingada', 'Kamod', 'Kedar', 'Khamaj',
  'Komal Rishabh Asavari', 'Lalit', 'Madhuvanti', 'Malkauns', 'Malkauns Kanada',
  'Marwa', 'Miyan Ki Malhar', 'Multani', 'Nata', 'Pahadi', 'Pilu', 'Puriya',
  'Puriya Dhanashri', 'Rageshri', 'Ramkali', 'Shree', 'Shuddh Kalyan', 'Shuddh Sarang',
  'Sohini', 'Todi', 'Vibhas', 'Yaman', 'Yaman Kalyan'
];

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

    for (let i = 0; i < 200; i++) {
      const baseRagaName = ragaNames[i % ragaNames.length];
      const ragaName = i < ragaNames.length ? baseRagaName : `${baseRagaName} ${Math.floor(i / ragaNames.length) + 1}`;
      const timeSlot = timeSlots[i % timeSlots.length];
      const season = seasons[i % seasons.length];
      const popularity = popularityLevels[i % popularityLevels.length];
      
      const raga = {
        name: ragaName,
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
