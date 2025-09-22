import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';
import Raga from '../models/Raga';
import Artist from '../models/Artist';
import Track from '../models/Track';
import Event from '../models/Event';

dotenv.config();

const connectDB = async () => {
  try {
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
  } catch (error) {
    console.error('MongoDB Atlas connection error:', error);
    console.error('Please check your MongoDB Atlas connection string and network access');
    process.exit(1);
  }
};

// Function to list all users
export const listUsers = async () => {
  await connectDB();
  const users = await User.find({}).select('-pinHash');
  console.log('\n=== USERS ===');
  users.forEach(user => {
    console.log(`Phone: ${user.phone}, Credits: ${user.credits}, Role: ${user.role}`);
  });
  await mongoose.disconnect();
};

// Function to list all ragas
export const listRagas = async () => {
  await connectDB();
  const ragas = await Raga.find({});
  console.log('\n=== RAGAS ===');
  ragas.forEach(raga => {
    console.log(`Name: ${raga.name}, Tags: ${raga.tags.join(', ')}, Popularity: ${raga.popularity}`);
  });
  await mongoose.disconnect();
};

// Function to list all artists
export const listArtists = async () => {
  await connectDB();
  const artists = await Artist.find({});
  console.log('\n=== ARTISTS ===');
  artists.forEach(artist => {
    console.log(`Name: ${artist.name}, Known Ragas: ${artist.knownRagas.join(', ')}, Rating: ${artist.rating}`);
  });
  await mongoose.disconnect();
};

// Function to list all tracks
export const listTracks = async () => {
  await connectDB();
  const tracks = await Track.find({});
  console.log('\n=== TRACKS ===');
  tracks.forEach(track => {
    console.log(`Title: ${track.title}, Raga: ${track.raga}, Artist: ${track.artist}, Duration: ${track.duration}`);
  });
  await mongoose.disconnect();
};

// Function to add credits to a user
export const addCredits = async (phone: string, credits: number) => {
  await connectDB();
  const user = await User.findOne({ phone });
  if (user) {
    user.credits += credits;
    await user.save();
    console.log(`Added ${credits} credits to ${phone}. New balance: ${user.credits}`);
  } else {
    console.log(`User with phone ${phone} not found`);
  }
  await mongoose.disconnect();
};

// Function to create a new raga
export const createRaga = async (ragaData: any) => {
  await connectDB();
  try {
    const raga = new Raga(ragaData);
    await raga.save();
    console.log(`Created new raga: ${raga.name}`);
  } catch (error) {
    console.error('Error creating raga:', error);
  }
  await mongoose.disconnect();
};

// Function to create a new artist
export const createArtist = async (artistData: any) => {
  await connectDB();
  try {
    const artist = new Artist(artistData);
    await artist.save();
    console.log(`Created new artist: ${artist.name}`);
  } catch (error) {
    console.error('Error creating artist:', error);
  }
  await mongoose.disconnect();
};

// Function to delete a user
export const deleteUser = async (phone: string) => {
  await connectDB();
  const result = await User.deleteOne({ phone });
  if (result.deletedCount > 0) {
    console.log(`Deleted user with phone: ${phone}`);
  } else {
    console.log(`User with phone ${phone} not found`);
  }
  await mongoose.disconnect();
};

// Function to update raga popularity
export const updateRagaPopularity = async (ragaName: string, popularity: string) => {
  await connectDB();
  const raga = await Raga.findOne({ name: ragaName });
  if (raga) {
    raga.popularity = popularity as any;
    await raga.save();
    console.log(`Updated ${ragaName} popularity to: ${popularity}`);
  } else {
    console.log(`Raga ${ragaName} not found`);
  }
  await mongoose.disconnect();
};

// CLI interface
const main = async () => {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  switch (command) {
    case 'list-users':
      await listUsers();
      break;
    case 'list-ragas':
      await listRagas();
      break;
    case 'list-artists':
      await listArtists();
      break;
    case 'list-tracks':
      await listTracks();
      break;
    case 'add-credits':
      if (args.length < 2) {
        console.log('Usage: npm run data-manager add-credits <phone> <credits>');
        break;
      }
      await addCredits(args[0], parseInt(args[1]));
      break;
    case 'create-raga':
      if (args.length < 1) {
        console.log('Usage: npm run data-manager create-raga <raga-name>');
        break;
      }
      await createRaga({
        name: args[0],
        tags: ['classical'],
        idealHours: [6, 7, 8],
        description: 'A beautiful classical raga',
        isRecommended: true,
        isActive: true,
        seasons: ['Vasant'],
        popularity: 'moderately listened'
      });
      break;
    case 'create-artist':
      if (args.length < 1) {
        console.log('Usage: npm run data-manager create-artist <artist-name>');
        break;
      }
      await createArtist({
        name: args[0],
        knownRagas: ['Yaman', 'Bhairavi'],
        bio: 'Renowned classical musician',
        rating: 4.5,
        specialty: 'Classical',
        gharana: 'Unknown'
      });
      break;
    case 'delete-user':
      if (args.length < 1) {
        console.log('Usage: npm run data-manager delete-user <phone>');
        break;
      }
      await deleteUser(args[0]);
      break;
    case 'update-popularity':
      if (args.length < 2) {
        console.log('Usage: npm run data-manager update-popularity <raga-name> <popularity>');
        break;
      }
      await updateRagaPopularity(args[0], args[1]);
      break;
    default:
      console.log(`
MongoDB Data Manager

Available commands:
  list-users                    - List all users
  list-ragas                   - List all ragas
  list-artists                 - List all artists
  list-tracks                  - List all tracks
  add-credits <phone> <credits> - Add credits to user
  create-raga <name>           - Create new raga
  create-artist <name>         - Create new artist
  delete-user <phone>          - Delete user
  update-popularity <raga> <level> - Update raga popularity

Examples:
  npm run data-manager list-users
  npm run data-manager add-credits +1234567890 100
  npm run data-manager create-raga "Raga Kafi"
  npm run data-manager update-popularity "Yaman" "highly listened"
      `);
  }
};

if (require.main === module) {
  main().catch(console.error);
}
