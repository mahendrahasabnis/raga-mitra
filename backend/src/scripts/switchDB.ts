import fs from 'fs';
import path from 'path';

const envPath = path.join(__dirname, '../../../../.env');

const LOCAL_MONGODB_URI = 'mongodb://localhost:27017/raga-mitra';
const ATLAS_MONGODB_URI = 'mongodb+srv://admin_db_user:ocmruRUlwxQ0iRvl@cluster0.8clca7f.mongodb.net/raga-mitra?retryWrites=true&w=majority&appName=Cluster0';

const switchToAtlas = () => {
  try {
    let envContent = fs.readFileSync(envPath, 'utf8');
    envContent = envContent.replace(
      /MONGODB_URI=.*/,
      `MONGODB_URI=${ATLAS_MONGODB_URI}`
    );
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Switched to MongoDB Atlas');
    console.log('Connection: MongoDB Atlas Cloud');
  } catch (error) {
    console.error('❌ Error switching to Atlas:', error);
  }
};

const switchToLocal = () => {
  try {
    let envContent = fs.readFileSync(envPath, 'utf8');
    envContent = envContent.replace(
      /MONGODB_URI=.*/,
      `MONGODB_URI=${LOCAL_MONGODB_URI}`
    );
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Switched to Local MongoDB');
    console.log('Connection: Local MongoDB (localhost:27017)');
  } catch (error) {
    console.error('❌ Error switching to local:', error);
  }
};

const showCurrent = () => {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const mongoUriMatch = envContent.match(/MONGODB_URI=(.*)/);
    if (mongoUriMatch) {
      const uri = mongoUriMatch[1];
      if (uri.includes('mongodb+srv://')) {
        console.log('📍 Current: MongoDB Atlas (Cloud)');
        console.log('Cluster: cluster0.8clca7f.mongodb.net');
      } else if (uri.includes('localhost')) {
        console.log('📍 Current: Local MongoDB');
        console.log('Host: localhost:27017');
      } else {
        console.log('📍 Current: Custom MongoDB');
        console.log('URI:', uri);
      }
    }
  } catch (error) {
    console.error('❌ Error reading .env file:', error);
  }
};

const main = () => {
  const command = process.argv[2];

  switch (command) {
    case 'atlas':
      switchToAtlas();
      break;
    case 'local':
      switchToLocal();
      break;
    case 'status':
      showCurrent();
      break;
    default:
      console.log(`
🗄️  MongoDB Database Switcher

Usage:
  npm run switch-db atlas   - Switch to MongoDB Atlas (Cloud)
  npm run switch-db local   - Switch to Local MongoDB
  npm run switch-db status  - Show current database

Current status:`);
      showCurrent();
  }
};

main();
