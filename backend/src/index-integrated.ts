import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { sequelize, testConnection } from './config/database-integrated';

// Import PostgreSQL-specific routes (they'll work with integrated DB)
import authRoutes from './routes-postgres/auth';
import patientRoutes from './routes-postgres/patients';
import userRoutes from './routes-postgres/users';
import hcpRoutes from './routes-postgres/hcp';
import appointmentRoutes from './routes-postgres/appointments';
import repositoryRoutes from './routes-postgres/repository';
import pastVisitRoutes from './routes-postgres/pastVisits';
import repositoriesRoutes from './routes-postgres/repositories';
import medicalHistoryRoutes from './routes-postgres/medicalHistory';
import vitalParametersRoutes from './routes-postgres/vitalParameters';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.integrated') });

const app = express();
const PORT = process.env.PORT || 3002;

// Trust proxy for Cloud Run and CDN
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration
const corsOrigins = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);
if (corsOrigins.length === 0) {
  // Default CORS origins for development
  corsOrigins.push(
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174'
  );
}

app.use(cors({
  origin: corsOrigins,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000'),
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting
app.use((req, res, next) => {
  if (req.path.startsWith('/api/auth/')) {
    return authLimiter(req, res, next);
  }
  return limiter(req, res, next);
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'aarogya-mitra-backend-integrated',
    version: '2.1.0',
    database: 'PostgreSQL (Integrated with platforms_99)',
    mode: 'integrated'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/hcp', hcpRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/repository', repositoryRoutes); // Practice/specialization routes
app.use('/api/repositories', repositoriesRoutes); // Medical history repositories (doctors, pharmacies, diagnostics)
app.use('/api/past-visits', pastVisitRoutes);
app.use('/api/medical-history', medicalHistoryRoutes);
app.use('/api/vital-parameters', vitalParametersRoutes);

// 404 handler
app.use('*', (req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ message: 'Route not found' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Connect to PostgreSQL and start server
const startServer = async () => {
  try {
    console.log('════════════════════════════════════════════════════════════════');
    console.log('🚀 Aarogya Mitra Backend - Integrated with platforms_99');
    console.log('════════════════════════════════════════════════════════════════\n');

    // Test database connection
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Failed to connect to database');
    }

    // Sync database (safe mode - no data loss)
    console.log('\n🔄 Syncing database schema...');
    try {
      // Disable foreign key constraint checks during sync
      await sequelize.query('SET session_replication_role = replica;').catch(() => {});
      await sequelize.sync({ alter: false, force: false });
      await sequelize.query('SET session_replication_role = DEFAULT;').catch(() => {});
      console.log('✅ Database schema synchronized\n');
    } catch (error: any) {
      // If sync fails due to foreign key constraint, try to continue anyway
      if (error.message && error.message.includes('42830')) {
        console.warn('⚠️ Foreign key constraint error during sync (this is expected - relationships are logical)');
        console.warn('⚠️ Continuing startup - tables may already exist or will be created on first use');
        console.log('✅ Database schema check complete\n');
      } else {
        console.error('❌ Database sync error:', error.message);
        // Don't throw - allow server to start even if sync fails
        console.log('⚠️ Continuing with existing schema...\n');
      }
    }

    // Start Express server
    app.listen(PORT, () => {
      console.log('════════════════════════════════════════════════════════════════');
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`📊 Database: platforms_99 (Integrated Mode)`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔐 Platform: ${process.env.PLATFORM_NAME || 'aarogya-mitra'}`);
      console.log('════════════════════════════════════════════════════════════════');
      
      console.log('\n📋 Available endpoints:');
      console.log('   POST /api/auth/register - User registration');
      console.log('   POST /api/auth/login - User login');
      console.log('   POST /api/auth/verify - Verify JWT token');
      console.log('   GET  /api/hcp - List healthcare providers');
      console.log('   GET  /api/patients - List patients');
      console.log('   GET  /api/appointments - List appointments');
      console.log('   GET  /health - Health check\n');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer().catch(console.error);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⚠️  Shutting down gracefully...');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️  Shutting down gracefully...');
  await sequelize.close();
  process.exit(0);
});

