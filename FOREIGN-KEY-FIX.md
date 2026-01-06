# Foreign Key Constraint Fix

## ❌ Issue
Backend container failed to start with database error:
```
code: '42830',
severity: 'ERROR',
```

The error was: Foreign key constraint violation when creating `past_prescriptions` table.

## 🔍 Root Cause
The models `PastPrescription`, `Receipt`, `PastTestResult`, and `MedicinePurchase` had `@ForeignKey(() => PastVisit)` decorators on their `appointment_id` columns, trying to create foreign key constraints. However:
1. `appointment_id` in `PastVisit` was not marked as unique
2. PostgreSQL requires foreign keys to reference unique columns or primary keys
3. The constraint creation failed, causing the container to exit

## ✅ Solution

### 1. Made `appointment_id` unique in `PastVisit`
```typescript
@Column({ type: DataType.STRING(100), unique: true })
appointment_id!: string;
```

### 2. Removed `@ForeignKey` decorators from appointment_id
Removed `@ForeignKey(() => PastVisit)` from:
- `PastPrescription.appointment_id`
- `Receipt.appointment_id`
- `PastTestResult.appointment_id`
- `MedicinePurchase.appointment_id`

### 3. Kept BelongsTo associations
Kept the `@BelongsTo(() => PastVisit)` associations for ORM usage - these don't create database constraints.

## 📋 Changes Made

### Files Modified:
1. `backend/src/models-postgres/PastVisit.ts` - Added unique constraint
2. `backend/src/models-postgres/PastPrescription.ts` - Removed @ForeignKey
3. `backend/src/models-postgres/Receipt.ts` - Removed @ForeignKey
4. `backend/src/models-postgres/PastTestResult.ts` - Removed @ForeignKey
5. `backend/src/models-postgres/MedicinePurchase.ts` - Removed @ForeignKey

## 🔗 Logical Relationships
The relationships are maintained logically via `appointment_id` (string matching), which is:
- ✅ Unique in `PastVisit` table
- ✅ Used as a logical key to link related records
- ✅ Not enforced as database foreign key (avoiding constraint issues)

## 🚀 Deployment

**Build Status**: In Progress

This fix should allow the backend to start successfully and create all tables without foreign key constraint errors.

