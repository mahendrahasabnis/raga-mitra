import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import Raga from '../models/Raga';
import Artist from '../models/Artist';
import Track from '../models/Track';
import Event from '../models/Event';

dotenv.config();

const seedData = async () => {
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

    // Clear existing data
    await User.deleteMany({});
    await Raga.deleteMany({});
    await Artist.deleteMany({});
    await Track.deleteMany({});
    await Event.deleteMany({});

    // Create admin user
    const adminPinHash = await bcrypt.hash('1234', 10);
    const adminUser = new User({
      phone: process.env.ADMIN_PHONE || '+1234567890',
      pinHash: adminPinHash,
      credits: 999999,
      role: 'admin'
    });
    await adminUser.save();
    console.log('Admin user created');

    // Create test user
    const testPinHash = await bcrypt.hash('1234', 10);
    const testUser = new User({
      phone: '+1234567891',
      pinHash: testPinHash,
      credits: 10,
      role: 'user'
    });
    await testUser.save();
    console.log('Test user created');

    // Seed Ragas
    const ragas = [
      {
        name: 'Yaman',
        tags: ['Evening', 'Romantic', 'Popular'],
        idealHours: [18, 19, 20, 21],
        description: 'A beautiful evening raga known for its romantic appeal',
        seasons: ['Sharad', 'Hemant'],
        popularity: 'highly listened'
      },
      {
        name: 'Bhairavi',
        tags: ['Morning', 'Devotional', 'Classical'],
        idealHours: [6, 7, 8, 9],
        description: 'A morning raga with devotional character',
        seasons: ['Vasant', 'Grishma'],
        popularity: 'highly listened'
      },
      {
        name: 'Kafi',
        tags: ['Evening', 'Light', 'Popular'],
        idealHours: [19, 20, 21, 22],
        description: 'A light evening raga popular in semi-classical music',
        seasons: ['Varsha', 'Sharad'],
        popularity: 'moderately listened'
      },
      {
        name: 'Todi',
        tags: ['Morning', 'Serious', 'Classical'],
        idealHours: [7, 8, 9, 10],
        description: 'A serious morning raga with deep emotional content',
        seasons: ['Shishir', 'Vasant'],
        popularity: 'sparingly listened'
      },
      {
        name: 'Malkauns',
        tags: ['Night', 'Deep', 'Mystical'],
        idealHours: [22, 23, 0, 1],
        description: 'A deep night raga with mystical qualities',
        seasons: ['Shishir', 'Hemant'],
        popularity: 'moderately listened'
      },
      {
        name: 'Darbari',
        tags: ['Night', 'Serious', 'Royal'],
        idealHours: [21, 22, 23, 0],
        description: 'A royal night raga with serious character',
        seasons: ['Shishir', 'Hemant'],
        popularity: 'highly listened'
      },
      {
        name: 'Bageshri',
        tags: ['Evening', 'Romantic', 'Popular'],
        idealHours: [18, 19, 20, 21],
        description: 'A romantic evening raga with sweet melodies',
        seasons: ['Sharad', 'Hemant'],
        popularity: 'highly listened'
      },
      {
        name: 'Hamsadhwani',
        tags: ['Evening', 'Light', 'Popular'],
        idealHours: [18, 19, 20, 21],
        description: 'A light evening raga popular in Carnatic music',
        seasons: ['Varsha', 'Sharad'],
        popularity: 'moderately listened'
      }
    ];

    for (const ragaData of ragas) {
      const raga = new Raga(ragaData);
      await raga.save();
    }
    console.log('Ragas seeded');

    // Seed Artists
    const artists = [
      {
        name: 'Pandit Ravi Shankar',
        yearBorn: 1920,
        knownRagas: ['Yaman', 'Bhairavi', 'Todi', 'Darbari'],
        bio: 'Legendary sitar maestro and cultural ambassador',
        imgUrl: 'https://example.com/ravi-shankar.jpg',
        rating: 5.0,
        specialty: 'Sitar',
        gharana: 'Maihar Gharana'
      },
      {
        name: 'Ustad Vilayat Khan',
        yearBorn: 1928,
        knownRagas: ['Yaman', 'Bageshri', 'Kafi', 'Malkauns'],
        bio: 'Renowned sitar player known for his innovative style',
        imgUrl: 'https://example.com/vilayat-khan.jpg',
        rating: 4.9,
        specialty: 'Sitar',
        gharana: 'Imdadkhani Gharana'
      },
      {
        name: 'Pandit Hariprasad Chaurasia',
        yearBorn: 1938,
        knownRagas: ['Yaman', 'Bageshri', 'Kafi', 'Hamsadhwani'],
        bio: 'Master of the bansuri (bamboo flute)',
        imgUrl: 'https://example.com/hariprasad-chaurasia.jpg',
        rating: 4.8,
        specialty: 'Bansuri',
        gharana: 'Pannalal Ghosh Gharana'
      },
      {
        name: 'Ustad Amjad Ali Khan',
        yearBorn: 1945,
        knownRagas: ['Yaman', 'Bhairavi', 'Todi', 'Darbari'],
        bio: 'Legendary sarod player and composer',
        imgUrl: 'https://example.com/amjad-ali-khan.jpg',
        rating: 4.9,
        specialty: 'Sarod',
        gharana: 'Senia Gharana'
      },
      {
        name: 'Pandit Shivkumar Sharma',
        yearBorn: 1938,
        knownRagas: ['Yaman', 'Bageshri', 'Kafi', 'Malkauns'],
        bio: 'Master of the santoor, popularized the instrument',
        imgUrl: 'https://example.com/shivkumar-sharma.jpg',
        rating: 4.8,
        specialty: 'Santoor',
        gharana: 'Kashmiri Gharana'
      },
      {
        name: 'Ustad Zakir Hussain',
        yearBorn: 1951,
        knownRagas: ['Yaman', 'Bhairavi', 'Todi', 'Darbari'],
        bio: 'World-renowned tabla maestro',
        imgUrl: 'https://example.com/zakir-hussain.jpg',
        rating: 4.9,
        specialty: 'Tabla',
        gharana: 'Punjab Gharana'
      },
      {
        name: 'Pandit Jasraj',
        yearBorn: 1930,
        knownRagas: ['Yaman', 'Bhairavi', 'Todi', 'Malkauns'],
        bio: 'Legendary vocalist and composer',
        imgUrl: 'https://example.com/jasraj.jpg',
        rating: 4.7,
        specialty: 'Vocal',
        gharana: 'Mewati Gharana'
      },
      {
        name: 'Ustad Bismillah Khan',
        yearBorn: 1916,
        knownRagas: ['Yaman', 'Bhairavi', 'Kafi', 'Hamsadhwani'],
        bio: 'Legendary shehnai maestro',
        imgUrl: 'https://example.com/bismillah-khan.jpg',
        rating: 4.8,
        specialty: 'Instrument',
        gharana: 'Benaras Gharana'
      }
    ];

    for (const artistData of artists) {
      const artist = new Artist(artistData);
      await artist.save();
    }
    console.log('Artists seeded');

    // Seed some sample tracks
    const sampleTracks = [
      {
        raga: 'Yaman',
        artist: 'Pandit Ravi Shankar',
        title: 'Raga Yaman - Live Concert',
        url: 'https://www.youtube.com/watch?v=sample1',
        duration: '1:00:00',
        durationSeconds: 3600,
        likes: 15000,
        isCurated: true,
        thumbnail: 'https://example.com/thumbnail1.jpg',
        searchKey: 'yaman_pandit ravi shankar',
        ratings: []
      },
      {
        raga: 'Bhairavi',
        artist: 'Ustad Amjad Ali Khan',
        title: 'Raga Bhairavi - Morning Concert',
        url: 'https://www.youtube.com/watch?v=sample2',
        duration: '1:10:00',
        durationSeconds: 4200,
        likes: 12000,
        isCurated: true,
        thumbnail: 'https://example.com/thumbnail2.jpg',
        searchKey: 'bhairavi_ustad amjad ali khan',
        ratings: []
      }
    ];

    for (const trackData of sampleTracks) {
      const track = new Track(trackData);
      await track.save();
    }
    console.log('Sample tracks seeded');

    // Seed curated events
    const events = [
      {
        name: 'Savai Gandharva Music Festival',
        eventTag: 'savai_gandharva',
        description: 'Annual classical music festival featuring top artists',
        trackUrls: [
          'https://www.youtube.com/watch?v=savai1',
          'https://www.youtube.com/watch?v=savai2',
          'https://www.youtube.com/watch?v=savai3'
        ],
        isActive: true
      },
      {
        name: 'Saptak Music Festival',
        eventTag: 'saptak',
        description: 'Renowned classical music festival in Ahmedabad',
        trackUrls: [
          'https://www.youtube.com/watch?v=saptak1',
          'https://www.youtube.com/watch?v=saptak2'
        ],
        isActive: true
      }
    ];

    for (const eventData of events) {
      const event = new Event(eventData);
      await event.save();
    }
    console.log('Curated events seeded');

    console.log('Database seeded successfully!');
    console.log('Admin credentials:');
    console.log('Phone:', process.env.ADMIN_PHONE || '+1234567890');
    console.log('PIN: 1234');
    console.log('Test user credentials:');
    console.log('Phone: +1234567891');
    console.log('PIN: 1234');

  } catch (error) {
    console.error('Seeding error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

seedData();
