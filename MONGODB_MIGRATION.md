# MongoDB Database Migration Guide

This guide explains how to migrate your data from the old database (`deeptutor`) to the new database (`novusorbit`).

## Quick Start

```bash
# 1. Dry run to see what will be migrated (recommended first)
python scripts/migrate_mongodb.py --dry-run

# 2. Perform actual migration
python scripts/migrate_mongodb.py

# 3. Update your .env file (already done, but verify)
# DATABASE_URL should end with /novusorbit
```

## Migration Options

### Option 1: Using the Migration Script (Recommended)

The easiest and safest method using our automated script.

**Step 1: Preview the migration (Dry Run)**

```bash
python scripts/migrate_mongodb.py --dry-run
```

This shows:
- All collections that will be migrated
- Number of documents in each collection
- Total data size
- No actual changes are made

**Step 2: Run the actual migration**

```bash
python scripts/migrate_mongodb.py
```

The script will:
- ✓ Copy all collections from `deeptutor` to `novusorbit`
- ✓ Preserve all documents and indexes
- ✓ Show progress for each collection
- ✓ Provide a summary at the end

**Step 3: Verify the migration**

```bash
# Check the data in MongoDB Atlas or using mongosh
mongosh "your-connection-string/novusorbit"

# List collections
show collections

# Check document count for a collection
db.User.countDocuments()
db.Session.countDocuments()
```

**Step 4: Update your application**

Your `.env` file is already updated to point to `novusorbit`. Just restart your application:

```bash
# If using Docker
docker compose restart

# If running manually
# Stop the app (Ctrl+C) and restart:
python scripts/start_web.py
```

### Option 2: Using MongoDB Atlas UI

If you're using MongoDB Atlas:

1. **Login to MongoDB Atlas** → https://cloud.mongodb.com
2. **Navigate to your cluster** → Browse Collections
3. **Create new database**: 
   - Click "+ Create Database"
   - Database name: `novusorbit`
   - Collection name: `User` (or any collection name)
4. **Copy collections**:
   - Unfortunately, Atlas doesn't have a built-in "copy database" feature
   - Use Option 1 (migration script) or Option 3 (mongodump/restore) instead

### Option 3: Using mongodump and mongorestore

Using MongoDB's native tools:

**Step 1: Dump the old database**

```bash
# Get your connection details from .env
# Connection string format: mongodb+srv://user:pass@cluster.mongodb.net/

mongodump \
  --uri="mongodb+srv://user:pass@cluster.mongodb.net/deeptutor" \
  --out=/tmp/mongodb_backup
```

**Step 2: Restore to new database**

```bash
mongorestore \
  --uri="mongodb+srv://user:pass@cluster.mongodb.net/novusorbit" \
  --nsFrom="deeptutor.*" \
  --nsTo="novusorbit.*" \
  /tmp/mongodb_backup/deeptutor
```

**Step 3: Verify and cleanup**

```bash
# Verify data was restored
mongosh "mongodb+srv://user:pass@cluster.mongodb.net/novusorbit" --eval "db.stats()"

# Optional: Remove backup files
rm -rf /tmp/mongodb_backup
```

### Option 4: Rename Database (MongoDB Atlas Only)

**Note**: MongoDB doesn't support direct database renaming. You must use one of the copy methods above.

However, if you want to keep using `deeptutor` as the database name:

**Simply revert the changes in your .env file:**

```bash
# Change this line back:
DATABASE_URL=mongodb+srv://user:pass@cluster.mongodb.net/deeptutor
```

Then restart your application.

## Advanced Options

### Custom Source/Target Databases

```bash
# Migrate from different databases
python scripts/migrate_mongodb.py \
  --source-db old_database_name \
  --target-db new_database_name
```

### Drop Target Before Migration

**⚠️ CAUTION: This will delete all existing data in the target database!**

```bash
python scripts/migrate_mongodb.py --drop-target
```

Use this if:
- Target database has corrupted data
- You want a clean migration
- You're sure you want to overwrite existing data

## Troubleshooting

### Issue: "Source database 'deeptutor' does not exist"

**Solution**: Your old database might have a different name, or no data. Check available databases:

```bash
# Using mongosh
mongosh "your-connection-string"
show databases
```

### Issue: "Failed to connect to MongoDB"

**Solutions**:

1. **Check your DATABASE_URL** in `.env`:
   ```bash
   cat .env | grep DATABASE_URL
   ```

2. **Test connection**:
   ```bash
   mongosh "your-connection-string"
   ```

3. **Check network access** in MongoDB Atlas:
   - Go to Network Access in Atlas
   - Add your IP address or use `0.0.0.0/0` (less secure)

### Issue: "Collection XYZ failed to migrate"

**Solutions**:

1. **Check document size**: MongoDB has a 16MB document size limit
2. **Check indexes**: Some indexes might conflict
3. **Run migration again**: It will skip already migrated collections

### Issue: "Connection timeout"

**Solutions**:

1. **Large dataset**: The migration might take time, increase timeout in script
2. **Network issues**: Check your internet connection
3. **Atlas tier limits**: Free tier has connection limits

## Verification Checklist

After migration, verify:

- [ ] All collections are present in `novusorbit` database
- [ ] Document counts match between old and new database
- [ ] Application connects successfully
- [ ] User authentication works (NextAuth sessions)
- [ ] Chat history is accessible
- [ ] Knowledge bases are functional

**Verification Commands:**

```bash
# Using mongosh
mongosh "your-connection-string/novusorbit"

# Check collections
show collections

# Compare document counts
use novusorbit
db.User.countDocuments()
db.Session.countDocuments()
db.Account.countDocuments()

# Switch to old database and compare
use deeptutor
db.User.countDocuments()
db.Session.countDocuments()
```

## Data Cleanup

Once you've verified the migration and your application works correctly:

### Delete Old Database (Optional)

**⚠️ CAUTION: This is irreversible!**

```bash
# Using mongosh
mongosh "your-connection-string"
use deeptutor
db.dropDatabase()
```

Or in MongoDB Atlas:
1. Go to Browse Collections
2. Select `deeptutor` database
3. Click "..." → Delete Database

### Keep Both Databases

You can keep both databases as a backup. They won't interfere with each other.

To switch between them, just update `DATABASE_URL` in `.env`:

```bash
# Use new database
DATABASE_URL=mongodb+srv://user:pass@cluster.mongodb.net/novusorbit

# Or use old database
DATABASE_URL=mongodb+srv://user:pass@cluster.mongodb.net/deeptutor
```

## What Data is Migrated?

The migration script copies all MongoDB collections, typically including:

### NextAuth Collections:
- **User** - User accounts
- **Session** - Active sessions
- **Account** - OAuth provider accounts (Google, etc.)
- **VerificationToken** - Email verification tokens

### Application Data:
- Any other collections created by the application
- All documents, indexes, and metadata

### What is NOT Migrated:
- **File system data** (data/user/, data/knowledge_bases/)
  - These are stored locally, not in MongoDB
  - No migration needed
- System databases (admin, config, local)

## Common Migration Scenarios

### Scenario 1: Fresh Start (No Old Data)

If you don't have data in `deeptutor`:

```bash
# No migration needed
# Just start using the application with novusorbit database
python scripts/start_web.py
```

### Scenario 2: Preserving User Data

Most important for preserving:
- User accounts and profiles
- Authentication sessions
- Chat history
- Application settings

```bash
# Run full migration
python scripts/migrate_mongodb.py
```

### Scenario 3: Selective Migration

If you only want specific collections:

```python
# Edit scripts/migrate_mongodb.py
# In the migrate_database function, filter collections:

collections = source_db.list_collection_names()
# Add this line to filter:
collections = [c for c in collections if c in ['User', 'Session', 'Account']]
```

## Support

### Migration Script Help

```bash
python scripts/migrate_mongodb.py --help
```

### If Migration Fails

1. **Check logs** for specific error messages
2. **Use dry-run** to identify issues: `--dry-run`
3. **Try manual migration** with mongodump/restore
4. **Contact support** with error details

### Rollback

If something goes wrong:

1. **Revert .env**:
   ```bash
   # Change DATABASE_URL back to:
   DATABASE_URL=mongodb+srv://user:pass@cluster.mongodb.net/deeptutor
   ```

2. **Restart application**:
   ```bash
   docker compose restart
   # or
   python scripts/start_web.py
   ```

3. Your old data is still intact in `deeptutor` database

## Best Practices

1. **Always do a dry run first**: `--dry-run`
2. **Backup before migration**: Use mongodump
3. **Verify after migration**: Check document counts
4. **Test the application**: Ensure everything works
5. **Keep old database for a week**: As a backup
6. **Monitor application logs**: For any issues

## Summary

**Recommended approach:**

```bash
# 1. Dry run
python scripts/migrate_mongodb.py --dry-run

# 2. Actual migration
python scripts/migrate_mongodb.py

# 3. Verify
mongosh "your-connection-string/novusorbit" --eval "db.stats()"

# 4. Test application
python scripts/start_web.py

# 5. After 1 week, delete old database (optional)
mongosh "your-connection-string" --eval "use deeptutor; db.dropDatabase()"
```

That's it! Your data should now be migrated to the `novusorbit` database. 🎉
