#!/usr/bin/env node

/**
 * Check and fix user roles for +919881255701
 * Usage: node check-user-roles.js
 */

const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Database connection
const sequelize = new Sequelize('platforms_99', 'mh', '', {
  host: 'localhost',
  dialect: 'postgres',
  logging: false
});

// Define models
const SharedUser = sequelize.define('users', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
    field: 'id'
  },
  phone: {
    type: DataTypes.STRING,
    field: 'phone'
  },
  name: {
    type: DataTypes.STRING,
    field: 'name'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    field: 'isActive'
  }
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
});

const PlatformPrivilege = sequelize.define('platform_privileges', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
    field: 'id'
  },
  user_id: {
    type: DataTypes.UUID,
    field: 'user_id'
  },
  platform_name: {
    type: DataTypes.STRING,
    field: 'platform_name'
  },
  roles: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    field: 'roles'
  },
  permissions: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    field: 'permissions'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    field: 'is_active'
  }
}, {
  tableName: 'platform_privileges',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Associate models
SharedUser.hasMany(PlatformPrivilege, { foreignKey: 'user_id', as: 'platforms' });
PlatformPrivilege.belongsTo(SharedUser, { foreignKey: 'user_id' });

const PHONE_NUMBER = '+919881255701';

async function main() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    // Check if user exists
    let user = await SharedUser.findOne({
      where: { phone: PHONE_NUMBER },
      include: [{
        model: PlatformPrivilege,
        as: 'platforms'
      }]
    });

    if (!user) {
      console.log(`\n❌ User with phone ${PHONE_NUMBER} not found in database`);
      console.log('💡 User needs to register first via the app');
      console.log('\n📋 Current users in database:');
      const allUsers = await SharedUser.findAll({
        include: [{
          model: PlatformPrivilege,
          as: 'platforms'
        }],
        limit: 10
      });
      
      allUsers.forEach(u => {
        console.log(`\n  Phone: ${u.phone}`);
        console.log(`  Name: ${u.name || 'N/A'}`);
        console.log(`  Active: ${u.isActive}`);
        const aarogyaPrivilege = u.platforms?.find(p => p.platform_name === 'aarogya-mitra');
        if (aarogyaPrivilege) {
          console.log(`  Roles: ${aarogyaPrivilege.roles.join(', ')}`);
          console.log(`  Permissions: ${aarogyaPrivilege.permissions.join(', ')}`);
        } else {
          console.log(`  No aarogya-mitra privileges`);
        }
      });
      
      process.exit(0);
    }

    console.log(`\n✅ User found: ${user.name || user.phone}`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Active: ${user.isActive}`);

    // Check aarogya-mitra privileges
    const aarogyaPrivilege = user.platforms?.find(p => p.platform_name === 'aarogya-mitra');

    if (!aarogyaPrivilege) {
      console.log('\n❌ No aarogya-mitra platform privileges found');
      console.log('🔧 Creating platform privileges with patient role...');
      
      await PlatformPrivilege.create({
        user_id: user.id,
        platform_name: 'aarogya-mitra',
        roles: ['patient'],
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
      
      console.log('✅ Created platform privileges with patient role');
    } else {
      console.log('\n📋 Current aarogya-mitra privileges:');
      console.log(`   Roles: ${aarogyaPrivilege.roles.join(', ')}`);
      console.log(`   Permissions: ${aarogyaPrivilege.permissions.length} total`);
      console.log(`   Active: ${aarogyaPrivilege.is_active}`);
      
      // Check if patient role exists
      if (!aarogyaPrivilege.roles.includes('patient')) {
        console.log('\n❌ Patient role not found in roles array');
        console.log('🔧 Adding patient role...');
        
        const updatedRoles = [...aarogyaPrivilege.roles, 'patient'];
        await aarogyaPrivilege.update({
          roles: updatedRoles,
          is_active: true
        });
        
        console.log(`✅ Updated roles: ${updatedRoles.join(', ')}`);
      } else {
        console.log('✅ Patient role exists');
      }
      
      // Ensure patient permissions exist
      const requiredPermissions = [
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
      
      const missingPermissions = requiredPermissions.filter(p => !aarogyaPrivilege.permissions.includes(p));
      
      if (missingPermissions.length > 0) {
        console.log(`\n🔧 Adding missing permissions: ${missingPermissions.join(', ')}`);
        const updatedPermissions = [...aarogyaPrivilege.permissions, ...missingPermissions];
        await aarogyaPrivilege.update({
          permissions: updatedPermissions
        });
        console.log(`✅ Updated permissions (total: ${updatedPermissions.length})`);
      } else {
        console.log('✅ All required patient permissions exist');
      }
    }

    // Re-fetch to verify
    user = await SharedUser.findOne({
      where: { phone: PHONE_NUMBER },
      include: [{
        model: PlatformPrivilege,
        as: 'platforms'
      }]
    });

    const finalPrivilege = user.platforms?.find(p => p.platform_name === 'aarogya-mitra');
    
    console.log('\n📊 Final Status:');
    console.log(`   Phone: ${user.phone}`);
    console.log(`   Name: ${user.name || 'N/A'}`);
    if (finalPrivilege) {
      console.log(`   Roles: ${finalPrivilege.roles.join(', ')}`);
      console.log(`   Permissions (${finalPrivilege.permissions.length}): ${finalPrivilege.permissions.slice(0, 5).join(', ')}${finalPrivilege.permissions.length > 5 ? '...' : ''}`);
      console.log(`   Active: ${finalPrivilege.is_active}`);
      
      if (finalPrivilege.roles.includes('patient')) {
        console.log('\n✅ Patient role is properly configured!');
        console.log('💡 User should be able to see patient dashboard after login');
      }
    }

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    await sequelize.close();
    process.exit(1);
  }
}

main();

