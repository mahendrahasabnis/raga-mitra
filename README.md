# Raga-Mitra: Classical Raga Music Web Player

A full-stack web application for discovering and playing classical Indian raga music with YouTube integration, credit system, and curated content.

## 🌟 Features

- **Music Discovery**: Browse ragas recommended for current time
- **Artist Selection**: Find artists known for specific ragas
- **YouTube Integration**: Play 30+ minute classical music videos
- **Credit System**: Phone-based authentication with credit management
- **NeoPlay Mode**: Curated tracks from prestigious music festivals
- **Rating System**: Rate and review tracks
- **Responsive Design**: Beautiful UI with Tailwind CSS

## 🏗️ Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Axios for API calls
- Lucide React for icons

### Backend
- Node.js with Express
- TypeScript
- MongoDB with Mongoose
- JWT authentication
- Azure Communication Services (OTP)

### Database
- MongoDB Atlas or Azure CosmosDB
- Collections: users, ragas, artists, tracks, events

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm 8+
- MongoDB instance (local or Atlas)
- Azure Communication Services account (for OTP)

### Installation

1. **Clone and install dependencies**
   ```bash
   git clone <repository-url>
   cd raga-mitra
   npm run install:all
   ```

2. **Environment Setup**
   ```bash
   cp env.example .env
   ```
   
   Update `.env` with your configuration:
   ```env
   # Backend
   MONGODB_URI=mongodb://localhost:27017/raga-mitra
   JWT_SECRET=your-super-secret-jwt-key
   
   # Azure Communication Services
   AZURE_COMMUNICATION_CONNECTION_STRING=your-connection-string
   AZURE_COMMUNICATION_PHONE_NUMBER=your-phone-number
   
   # YouTube API (optional)
   YOUTUBE_API_KEY=your-youtube-api-key
   
   # Admin
   ADMIN_EMAIL=admin@neoabhro.com
   ADMIN_PHONE=+1234567890
   ```

3. **Seed Database**
   ```bash
   cd backend
   npm run seed
   ```

4. **Start Development Servers**
   ```bash
   # From project root
   npm run dev
   ```

   This starts:
   - Backend API on http://localhost:5000
   - Frontend on http://localhost:5173

## 📱 Usage

### Default Credentials
- **Admin**: Phone: `+1234567890`, PIN: `1234` (unlimited credits)
- **Test User**: Phone: `+1234567891`, PIN: `1234` (10 credits)

### App Flow
1. **Login**: Enter phone number and 4-digit PIN
2. **Select Raga**: Choose from time-recommended ragas
3. **Pick Artist**: Browse artists known for the selected raga
4. **Surprise Me**: Find and play YouTube videos (uses 1 credit)
5. **NeoPlay**: Access curated festival recordings (uses 1 credit)
6. **Rate Tracks**: Star rate tracks you enjoy

## 🎵 Music Sources

- **YouTube Videos**: 30+ minute classical music performances
- **Curated Content**: Savai Gandharva, Saptak, and other prestigious festivals
- **Caching**: Search results are cached for faster subsequent access

## 🏗️ Project Structure

```
raga-mitra/
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── contexts/        # React contexts
│   │   ├── services/        # API services
│   │   └── types/           # TypeScript types
│   └── package.json
├── backend/                  # Node.js backend
│   ├── src/
│   │   ├── controllers/     # Route controllers
│   │   ├── models/          # MongoDB models
│   │   ├── routes/          # Express routes
│   │   ├── services/        # Business logic
│   │   └── scripts/         # Database seeds
│   └── package.json
├── package.json             # Monorepo configuration
└── README.md
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/send-otp` - Send OTP to phone
- `POST /api/auth/verify-otp` - Verify OTP
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/reset-pin` - Reset PIN with OTP

### Music
- `GET /api/ragas` - Get all ragas (with time recommendations)
- `GET /api/artists?raga=xyz` - Get artists for raga
- `GET /api/tracks/search?raga=xyz&artist=abc` - Search YouTube
- `GET /api/tracks/curated` - Get curated tracks
- `POST /api/tracks/:id/rate` - Rate track
- `POST /api/tracks/use-credit` - Use credit

## 🚀 Deployment

### Azure Static Web Apps (Frontend)
1. Connect repository to Azure Static Web Apps
2. Set build command: `npm run build:frontend`
3. Set output directory: `frontend/dist`

### Azure App Service (Backend)
1. Create Node.js App Service
2. Deploy backend folder
3. Set environment variables
4. Connect to MongoDB Atlas

### Environment Variables for Production
```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
JWT_SECRET=production-secret
AZURE_COMMUNICATION_CONNECTION_STRING=...
VITE_API_BASE_URL=https://your-api.azurewebsites.net/api
```

## 🎨 Customization

### Adding New Ragas
Edit `backend/src/scripts/seed.ts` and add to the ragas array:
```typescript
{
  name: 'Your Raga',
  tags: ['Evening', 'Romantic'],
  idealHours: [18, 19, 20],
  description: 'Description of the raga'
}
```

### Adding Curated Events
Add to the events array in seed.ts:
```typescript
{
  name: 'Your Festival',
  eventTag: 'your_festival',
  description: 'Festival description',
  trackUrls: ['youtube-url-1', 'youtube-url-2'],
  isActive: true
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support, email admin@neoabhro.com or create an issue in the repository.

---

**Built with ❤️ for classical music lovers**
