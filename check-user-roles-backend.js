#!/usr/bin/env node

/**
 * Check user roles using backend database configuration
 * This script uses the same database connection as the backend
 */

require('dotenv').config({ path: '.env.integrated' });
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Use the same database configuration as backend
// Try to use environment variables, but fallback to local defaults
const dbHost = process.env.DB_HOST || process.env.SHARED_DB_HOST || 'localhost';
const dbPort = parseInt(process.env.DB_PORT || process.env.SHARED_DB_PORT || '5432');
const dbName = process.env.DB_NAME || process.env.SHARED_DB_NAME || 'platforms_99';
const dbUser = process.env.DB_USER || process.env.SHARED_DB_USER || process.env.USER || 'mh';
const dbPassword = process.env.DB_PASSWORD || process.env.SHARED_DB_PASSWORD || '';

console.log('🔍 Database Configuration:');
console.log(`   Host: ${dbHost}`);
console.log(`   Port: ${dbPort}`);
console.log(`   Database: ${dbName}`);
console.log(`   User: ${dbUser}`);
console.log('');

// Create database connection
const sequelize = new Sequelize(dbName, dbUser, dbPassword, {
  host: dbHost,
  port: dbPort,
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: process.env.DB_SSL === 'true' ? {
      require: true,
      rejectUnauthorized: false
    } : undefined
  }
});

const PHONE_NUMBER = '+919881255701';

async function main() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database\n');

    // Check user with exact phone match
    const userQuery = `
      SELECT 
        u.id, 
        u.phone, 
        u.name, 
        u."isActive",
        u."createdAt"
      FROM users u
      WHERE u.phone = $1 
         OR u.phone = $2
         OR u.phone = $3
         OR u.phone = $4
      ORDER BY u."createdAt" DESC
      LIMIT 1;
    `;
    
    const phoneVariations = [
      PHONE_NUMBER,
      PHONE_NUMBER.replace('+', ''),
      PHONE_NUMBER.replace('+91', ''),
      '91' + PHONE_NUMBER.replace('+91', '')
    ];

    const [users] = await sequelize.query(userQuery, {
      bind: phoneVariations,
      type: Sequelize.QueryTypes.SELECT
    });

    let user = Array.isArray(users) ? users[0] : users;

    // If not found, try with LIKE
    if (!user) {
      console.log(`⚠️  Exact match not found, trying LIKE search...`);
      const [usersLike] = await sequelize.query(
        `SELECT id, phone, name, "isActive", "createdAt" 
         FROM users 
         WHERE phone LIKE '%9881255701%' 
         ORDER BY "createdAt" DESC 
         LIMIT 1`
      );
      user = Array.isArray(usersLike) ? usersLike[0] : usersLike;
    }

    if (!user) {
      console.log(`❌ User with phone ${PHONE_NUMBER} not found`);
      console.log('\n📋 Searching all users...');
      
      const [allUsers] = await sequelize.query(
        `SELECT id, phone, name, "isActive" FROM users ORDER BY "createdAt" DESC LIMIT 10`
      );
      
      if (allUsers && allUsers.length > 0) {
        console.log('\nFound users:');
        allUsers.forEach(u => {
          console.log(`  - ${u.phone} (${u.name || 'N/A'})`);
        });
      }
      
      process.exit(1);
    }

    console.log(`✅ User found:`);
    console.log(`   ID: ${user.id}`);
      console.log(`   Phone: ${user.phone}`);
      console.log(`   Name: ${user.name || 'N/A'}`);
      console.log(`   Active: ${user.isActive}`);
    console.log(`   Created: ${user.createdAt}`);

    // Check platform privileges
    const [privileges] = await sequelize.query(
      `SELECT 
        pp.id,
        pp.platform_name,
        pp.roles,
        pp.permissions,
        pp.is_active,
        pp.created_at,
        pp.updated_at
      FROM platform_privileges pp
      WHERE pp.user_id = $1
      ORDER BY pp.platform_name`,
      {
        bind: [user.id],
        type: Sequelize.QueryTypes.SELECT
      }
    );

    const privilegeList = Array.isArray(privileges) ? privileges : (privileges ? [privileges] : []);

    if (privilegeList.length === 0) {
      console.log('\n❌ No platform privileges found for this user');
      console.log('💡 User needs platform privileges to access features');
      
      // Check if we should create one
      console.log('\n🔧 Would you like to create aarogya-mitra privilege with patient role?');
      console.log('   Run with --fix flag to auto-create: node check-user-roles-backend.js --fix');
      
      if (process.argv.includes('--fix')) {
        console.log('\n🔧 Creating platform privilege...');
        await sequelize.query(
          `INSERT INTO platform_privileges 
           (id, user_id, platform_name, roles, permissions, is_active, created_at, updated_at)
           VALUES 
           (gen_random_uuid(), $1, 'aarogya-mitra', $2, $3, true, NOW(), NOW())`,
          {
            bind: [
              user.id,
              ['patient'],
              ['view_own_data', 'edit_own_profile', 'book_appointment', 'view_appointments', 'cancel_appointment', 'view_doctors', 'view_clinics', 'view_medical_records', 'view_prescriptions']
            ]
          }
        );
        console.log('✅ Created platform privilege with patient role');
        
        // Re-fetch
        const [newPrivileges] = await sequelize.query(
          `SELECT platform_name, roles, permissions, is_active
           FROM platform_privileges
           WHERE user_id = $1 AND platform_name = 'aarogya-mitra'`,
          {
            bind: [user.id],
            type: Sequelize.QueryTypes.SELECT
          }
        );
        const newPriv = Array.isArray(newPrivileges) ? newPrivileges[0] : newPrivileges;
        if (newPriv) {
          console.log(`   Roles: ${newPriv.roles.join(', ')}`);
          console.log(`   Permissions: ${newPriv.permissions.length} total`);
        }
      }
    } else {
      console.log(`\n📋 Platform Privileges (${privilegeList.length}):`);
      
      const aarogyaPrivilege = privilegeList.find(p => p.platform_name === 'aarogya-mitra');
      
      privilegeList.forEach(pp => {
        console.log(`\n   Platform: ${pp.platform_name}`);
        console.log(`   Roles: ${pp.roles.join(', ')}`);
        console.log(`   Permissions (${pp.permissions.length}): ${pp.permissions.slice(0, 3).join(', ')}${pp.permissions.length > 3 ? '...' : ''}`);
        console.log(`   Active: ${pp.is_active}`);
        console.log(`   Updated: ${pp.updated_at}`);
      });

      if (aarogyaPrivilege) {
        console.log('\n✅ aarogya-mitra privilege found');
        
        if (!aarogyaPrivilege.roles.includes('patient')) {
          console.log('❌ Patient role NOT found in roles array');
          console.log(`   Current roles: ${aarogyaPrivilege.roles.join(', ')}`);
          
          if (process.argv.includes('--fix')) {
            console.log('\n🔧 Adding patient role...');
            const updatedRoles = [...aarogyaPrivilege.roles];
            if (!updatedRoles.includes('patient')) {
              updatedRoles.push('patient');
            }
            
            await sequelize.query(
              `UPDATE platform_privileges 
               SET roles = $1, updated_at = NOW()
               WHERE id = $2`,
              {
                bind: [updatedRoles, aarogyaPrivilege.id]
              }
            );
            
            console.log(`✅ Updated roles: ${updatedRoles.join(', ')}`);
          } else {
            console.log('\n💡 Run with --fix flag to add patient role:');
            console.log('   node check-user-roles-backend.js --fix');
          }
        } else {
          console.log('✅ Patient role exists!');
        }
        
        if (!aarogyaPrivilege.is_active) {
          console.log('⚠️  Platform privilege is INACTIVE');
          if (process.argv.includes('--fix')) {
            await sequelize.query(
              `UPDATE platform_privileges SET is_active = true, updated_at = NOW() WHERE id = $1`,
              { bind: [aarogyaPrivilege.id] }
            );
            console.log('✅ Activated platform privilege');
          }
        }
      } else {
        console.log('\n❌ No aarogya-mitra privilege found');
        if (process.argv.includes('--fix')) {
          console.log('\n🔧 Creating aarogya-mitra privilege...');
          await sequelize.query(
            `INSERT INTO platform_privileges 
             (id, user_id, platform_name, roles, permissions, is_active, created_at, updated_at)
             VALUES 
             (gen_random_uuid(), $1, 'aarogya-mitra', $2, $3, true, NOW(), NOW())`,
            {
              bind: [
                user.id,
                ['patient'],
                ['view_own_data', 'edit_own_profile', 'book_appointment', 'view_appointments', 'cancel_appointment', 'view_doctors', 'view_clinics', 'view_medical_records', 'view_prescriptions']
              ]
            }
          );
          console.log('✅ Created aarogya-mitra privilege with patient role');
        }
      }
    }

    // Summary
    console.log('\n📊 Summary:');
    console.log(`   User: ${user.phone} (${user.name || 'N/A'})`);
    if (aarogyaPrivilege || privilegeList.find(p => p.platform_name === 'aarogya-mitra')) {
      const priv = aarogyaPrivilege || privilegeList.find(p => p.platform_name === 'aarogya-mitra');
      console.log(`   Platform: aarogya-mitra`);
      console.log(`   Roles: ${priv.roles.join(', ')}`);
      console.log(`   Has Patient Role: ${priv.roles.includes('patient') ? '✅ YES' : '❌ NO'}`);
      console.log(`   Active: ${priv.is_active ? '✅ YES' : '❌ NO'}`);
    } else {
      console.log(`   Platform: aarogya-mitra - ❌ NOT CONFIGURED`);
    }

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.original) {
      console.error('   Original:', error.original.message);
    }
    console.error('\nStack:', error.stack);
    await sequelize.close();
    process.exit(1);
  }
}

main();

