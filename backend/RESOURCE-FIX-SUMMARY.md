# Resource Add Database Fix

## Problem
Backend was returning "DB unavailable, stored in-memory" because of a sequelize-typescript compatibility issue:
- Error: `@Table annotation is missing on class "SharedUser"`
- database-integrated.ts imports Sequelize from 'sequelize-typescript' (expects decorators)
- But models use plain Sequelize (Model.init), causing validation errors

## Solution
Modified `resourcesController.ts` to create direct Sequelize instances as fallback when the database config import fails due to model validation errors. Since we're using raw SQL queries, we don't need the ORM models.

## Changes Made
1. Added fallback Sequelize instance creation in `getSharedSequelize()` and `getAppSequelize()`
2. Uses environment variables directly to create connections
3. Bypasses model validation issues while maintaining database access

## Next Steps
1. Deploy backend with these changes
2. Test adding a resource
3. Verify data appears in database
