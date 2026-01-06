import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { SharedUser, PlatformPrivilege } from '../models-shared';
import { DoctorProfile, ReceptionistProfile, Patient } from '../models-postgres';
import { Op } from 'sequelize';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';
const JWT_EXPIRES_IN = '7d';

// Generate random 4-digit PIN
function generateRandomPIN(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Register new user
export const register = async (req: Request, res: Response) => {
  try {
    const { phone, name, platform = 'aarogya-mitra', pin } = req.body;

    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    // Check if user already exists in shared database
    const existingUser = await SharedUser.findOne({ where: { phone } });
    if (existingUser) {
      // User exists - check and add platform privileges if missing
      console.log(`⚠️  [REGISTER] User ${phone} already exists, checking platform privileges...`);
      
      const existingPrivilege = await PlatformPrivilege.findOne({
        where: { user_id: existingUser.id, platform_name: platform }
      });

      if (existingPrivilege) {
        // Platform privilege exists - check if patient role is missing
        const roles = existingPrivilege.roles || [];
        const needsPatientRole = !roles.includes('patient');
        
        if (needsPatientRole) {
          roles.push('patient');
          existingPrivilege.roles = roles;
          
          // Add patient permissions if missing
          const permissions = existingPrivilege.permissions || [];
          const patientPermissions = [
            'view_own_data',
            'edit_own_profile',
            'book_appointment',
            'view_appointments',
            'cancel_appointment',
            'view_doctors',
            'view_clinics',
            'view_medical_records',
            'view_prescriptions'
          ];
          
          patientPermissions.forEach(perm => {
            if (!permissions.includes(perm)) {
              permissions.push(perm);
            }
          });
          
          existingPrivilege.permissions = permissions;
          existingPrivilege.is_active = true;
          await existingPrivilege.save();
          
          console.log(`✅ [REGISTER] Added patient role and permissions to existing user ${phone}`);
        } else {
          // Ensure privilege is active
          if (!existingPrivilege.is_active) {
            existingPrivilege.is_active = true;
            await existingPrivilege.save();
            console.log(`✅ [REGISTER] Activated platform privilege for user ${phone}`);
          } else {
            console.log(`✅ [REGISTER] User ${phone} already has patient role`);
          }
        }
      } else {
        // No platform privilege - create one with patient role
        await PlatformPrivilege.create({
          user_id: existingUser.id,
          platform_name: platform,
          roles: ['guest', 'patient'],
          permissions: [
            'view_own_data',
            'edit_own_profile',
            'book_appointment',
            'view_appointments',
            'cancel_appointment',
            'view_doctors',
            'view_clinics',
            'view_medical_records',
            'view_prescriptions'
          ],
          is_active: true
        });
        
        console.log(`✅ [REGISTER] Created platform privilege with patient role for existing user ${phone}`);
      }

      // Generate JWT token for existing user
      const updatedPrivilege = await PlatformPrivilege.findOne({
        where: { user_id: existingUser.id, platform_name: platform }
      });

      const token = jwt.sign(
        {
          userId: existingUser.id,
          phone: existingUser.phone,
          platform,
          roles: updatedPrivilege?.roles || ['patient'],
          permissions: updatedPrivilege?.permissions || []
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      // Transform platforms to privileges for frontend compatibility
      const privileges = updatedPrivilege ? [{
        platform: platform,
        roles: updatedPrivilege.roles,
        permissions: updatedPrivilege.permissions
      }] : [];

      return res.status(200).json({
        message: 'Platform access granted successfully',
        token,
        user: {
          id: existingUser.id,
          phone: existingUser.phone,
          name: existingUser.name || name || existingUser.phone,
          platform: platform,
          role: existingUser.global_role || 'user',
          credits: existingUser.credits || 5,
          privileges: privileges
        }
      });
    }

    // Use provided PIN or generate random one
    const userPIN = pin || generateRandomPIN();
    const pinHash = await bcrypt.hash(userPIN, 10);

    // Create user in shared database (platforms_99)
    const user = await SharedUser.create({
      phone,
      name: name || null,
      pin_hash: pinHash,
      global_role: 'user',
      phone_verified: true,
      is_active: true
    });

    // Create default privilege for platform with roles: guest, patient
    await PlatformPrivilege.create({
      user_id: user.id,
      platform_name: platform,
      roles: ['guest', 'patient'],
      permissions: ['view_own_data'],
      is_active: true
    });

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id,
        phone: user.phone,
        platform,
        roles: ['guest', 'patient'],
        permissions: ['view_own_data']
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    console.log(`✅ [REGISTER] New user created in platforms_99: ${phone} with roles: guest, patient`);

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        platform: platform,
        role: user.global_role,
        credits: user.credits,
        privileges: [{
          platform: platform,
          roles: ['guest', 'patient'],
          permissions: ['view_own_data']
        }]
      },
      pin: userPIN
    });
  } catch (error: any) {
    console.error('❌ [REGISTER] Error:', error);
    res.status(500).json({ message: 'Registration failed' });
  }
};

// Login
export const login = async (req: Request, res: Response) => {
  try {
    const { phone, pin, platform = 'aarogya-mitra' } = req.body;

    console.log(`🔐 [LOGIN] Attempt: ${phone}`);

    if (!phone || !pin) {
      return res.status(400).json({ message: 'Phone and PIN are required' });
    }

    // Find user in shared database
    const user = await SharedUser.findOne({ 
      where: { phone },
      include: [{ model: PlatformPrivilege, as: 'platforms' }]
    });

    if (!user) {
      console.log(`❌ [LOGIN] User not found: ${phone}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if account is locked
    if (user.locked_until && new Date() < user.locked_until) {
      return res.status(423).json({ 
        message: 'Account is temporarily locked. Please try again later.',
        lockedUntil: user.locked_until
      });
    }

    // Verify PIN
    const isValidPIN = await bcrypt.compare(pin, user.pin_hash);

    if (!isValidPIN) {
      // Increment login attempts
      user.login_attempts = (user.login_attempts || 0) + 1;
      user.last_login_attempt = new Date();

      // Lock account after 5 failed attempts
      if (user.login_attempts >= 5) {
        user.locked_until = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      }

      await user.save();

      console.log(`❌ [LOGIN] Invalid PIN for: ${phone}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Reset login attempts on successful login
    user.login_attempts = 0;
    user.last_login_attempt = new Date();
    user.locked_until = undefined;
    await user.save();

    // Get user privileges for platform
    const platformPrivileges = user.platforms?.find(p => p.platform_name === platform);

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        phone: user.phone,
        platform,
        roles: platformPrivileges?.roles || ['guest'],
        permissions: platformPrivileges?.permissions || []
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    console.log(`✅ [LOGIN] Successful login: ${phone}`);

    // Transform platforms to privileges for frontend compatibility
    const privileges = user.platforms?.map(p => ({
      platform: p.platform_name,
      roles: p.roles,
      permissions: p.permissions
    })) || [];

    // Get user's actual name from profile tables
    let userName = user.name;
    if (!userName) {
      // Check doctor profile
      const doctorProfile = await DoctorProfile.findOne({
        where: { user_id: user.id, is_active: true }
      });
      if (doctorProfile) {
        userName = doctorProfile.name;
      }

      // Check receptionist profile
      if (!userName) {
        const receptionistProfile = await ReceptionistProfile.findOne({
          where: { user_id: user.id, is_active: true }
        });
        if (receptionistProfile) {
          userName = receptionistProfile.name;
        }
      }

      // Check patient profile
      if (!userName) {
        const patient = await Patient.findOne({
          where: { user_id: user.id, is_active: true }
        });
        if (patient) {
          userName = patient.name;
        }
      }
    }

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        phone: user.phone,
        name: userName || user.phone,
        platform: platform,
        role: user.global_role,
        credits: user.credits,
        privileges: privileges
      }
    });
  } catch (error: any) {
    console.error('❌ [LOGIN] Error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
};

// Verify token
export const verifyToken = async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    const user = await SharedUser.findByPk(decoded.userId, {
      include: [{ model: PlatformPrivilege, as: 'platforms' }]
    });

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Transform platforms to privileges for frontend compatibility
    const privileges = user.platforms?.map(p => ({
      platform: p.platform_name,
      roles: p.roles,
      permissions: p.permissions
    })) || [];

    // Get user's actual name from profile tables
    let userName = user.name;
    if (!userName) {
      // Check doctor profile
      const doctorProfile = await DoctorProfile.findOne({
        where: { user_id: user.id, is_active: true }
      });
      if (doctorProfile) {
        userName = doctorProfile.name;
      }

      // Check receptionist profile
      if (!userName) {
        const receptionistProfile = await ReceptionistProfile.findOne({
          where: { user_id: user.id, is_active: true }
        });
        if (receptionistProfile) {
          userName = receptionistProfile.name;
        }
      }

      // Check patient profile
      if (!userName) {
        const patient = await Patient.findOne({
          where: { user_id: user.id, is_active: true }
        });
        if (patient) {
          userName = patient.name;
        }
      }
    }

    res.json({
      valid: true,
      user: {
        id: user.id,
        phone: user.phone,
        name: userName || user.phone,
        platform: 'aarogya-mitra',
        role: user.global_role,
        credits: user.credits,
        privileges: privileges
      }
    });
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Logout (client-side token removal)
export const logout = async (req: Request, res: Response) => {
  res.json({ message: 'Logout successful' });
};

