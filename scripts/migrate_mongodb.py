#!/usr/bin/env python3
"""
MongoDB Database Migration Script
==================================
Migrate data from old database (deeptutor) to new database (novusorbit)

This script connects to your MongoDB instance and copies all collections
from the source database to the target database.

Usage:
    python scripts/migrate_mongodb.py

Options:
    --source-db     Source database name (default: deeptutor)
    --target-db     Target database name (default: novusorbit)
    --dry-run       Show what would be migrated without doing it
    --drop-target   Drop target database before migration (CAUTION!)
"""

import os
import sys
import argparse
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure
from urllib.parse import urlparse, urlunparse

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Load environment variables
load_dotenv(project_root / ".env")


def parse_connection_string(connection_string: str, new_db_name: str) -> tuple[str, str]:
    """
    Parse MongoDB connection string and extract database name.
    Returns (modified_connection_string, original_db_name)
    """
    # Parse the URL
    parsed = urlparse(connection_string)
    
    # Extract database name from path (if present)
    original_db = parsed.path.lstrip('/').split('?')[0] if parsed.path else None
    
    # Reconstruct URL with new database name
    if new_db_name:
        # Remove old database from path
        path_parts = parsed.path.split('?')
        new_path = f'/{new_db_name}'
        if len(path_parts) > 1:
            new_path += '?' + path_parts[1]
        
        parsed = parsed._replace(path=new_path)
        new_connection_string = urlunparse(parsed)
    else:
        new_connection_string = connection_string
    
    return new_connection_string, original_db


def get_collection_stats(db, collection_name: str) -> dict:
    """Get statistics for a collection."""
    try:
        stats = db.command("collStats", collection_name)
        return {
            "count": stats.get("count", 0),
            "size": stats.get("size", 0),
            "indexes": stats.get("nindexes", 0)
        }
    except Exception as e:
        return {"count": 0, "size": 0, "indexes": 0, "error": str(e)}


def migrate_database(
    connection_string: str,
    source_db_name: str,
    target_db_name: str,
    dry_run: bool = False,
    drop_target: bool = False
) -> bool:
    """
    Migrate all collections from source database to target database.
    """
    print("=" * 80)
    print("MongoDB Database Migration")
    print("=" * 80)
    print(f"Source Database: {source_db_name}")
    print(f"Target Database: {target_db_name}")
    print(f"Dry Run: {dry_run}")
    print(f"Drop Target: {drop_target}")
    print("=" * 80)
    print()
    
    try:
        # Connect to MongoDB
        print("Connecting to MongoDB...")
        client = MongoClient(connection_string, serverSelectionTimeoutMS=5000)
        
        # Test connection
        client.admin.command('ping')
        print("✓ Connected successfully\n")
        
        # Get source and target databases
        source_db = client[source_db_name]
        target_db = client[target_db_name]
        
        # Check if source database exists
        if source_db_name not in client.list_database_names():
            print(f"❌ Error: Source database '{source_db_name}' does not exist")
            return False
        
        # Get list of collections from source
        collections = source_db.list_collection_names()
        
        if not collections:
            print(f"⚠️  Warning: Source database '{source_db_name}' has no collections")
            return False
        
        print(f"Found {len(collections)} collections to migrate:")
        print("-" * 80)
        
        # Show collection statistics
        total_docs = 0
        total_size = 0
        collection_stats = []
        
        for coll_name in collections:
            stats = get_collection_stats(source_db, coll_name)
            collection_stats.append((coll_name, stats))
            total_docs += stats["count"]
            total_size += stats["size"]
            
            print(f"  • {coll_name:30} {stats['count']:>8,} documents  "
                  f"{stats['size']:>12,} bytes  {stats['indexes']:>2} indexes")
        
        print("-" * 80)
        print(f"Total: {total_docs:,} documents, {total_size:,} bytes "
              f"({total_size / 1024 / 1024:.2f} MB)")
        print()
        
        if dry_run:
            print("🔍 DRY RUN MODE - No changes will be made")
            print()
            print("Migration plan:")
            for coll_name, stats in collection_stats:
                print(f"  • Copy {stats['count']:,} documents from "
                      f"{source_db_name}.{coll_name} → {target_db_name}.{coll_name}")
            print()
            print("To perform the actual migration, run without --dry-run flag")
            return True
        
        # Check if target database exists and has data
        if target_db_name in client.list_database_names():
            target_collections = target_db.list_collection_names()
            if target_collections and not drop_target:
                print(f"⚠️  Warning: Target database '{target_db_name}' already exists "
                      f"with {len(target_collections)} collections")
                print()
                response = input("Continue with migration? This may overwrite existing data. (yes/no): ")
                if response.lower() not in ['yes', 'y']:
                    print("Migration cancelled")
                    return False
        
        # Drop target database if requested
        if drop_target:
            print(f"Dropping target database '{target_db_name}'...")
            client.drop_database(target_db_name)
            print("✓ Target database dropped\n")
        
        # Migrate collections
        print("Starting migration...")
        print("-" * 80)
        
        migrated_count = 0
        failed_collections = []
        
        for coll_name, stats in collection_stats:
            try:
                source_collection = source_db[coll_name]
                target_collection = target_db[coll_name]
                
                doc_count = stats["count"]
                
                if doc_count == 0:
                    print(f"  • {coll_name:30} SKIP (empty)")
                    continue
                
                print(f"  • {coll_name:30} ", end="", flush=True)
                
                # Copy documents in batches
                batch_size = 1000
                documents = source_collection.find()
                
                batch = []
                inserted = 0
                
                for doc in documents:
                    batch.append(doc)
                    
                    if len(batch) >= batch_size:
                        target_collection.insert_many(batch, ordered=False)
                        inserted += len(batch)
                        batch = []
                        print(".", end="", flush=True)
                
                # Insert remaining documents
                if batch:
                    target_collection.insert_many(batch, ordered=False)
                    inserted += len(batch)
                
                # Copy indexes
                source_indexes = list(source_collection.list_indexes())
                for index in source_indexes:
                    if index['name'] != '_id_':  # Skip default _id index
                        try:
                            index_keys = list(index['key'].items())
                            target_collection.create_index(
                                index_keys,
                                name=index['name'],
                                unique=index.get('unique', False),
                                background=True
                            )
                        except Exception as e:
                            print(f"\n    ⚠️  Warning: Could not copy index '{index['name']}': {e}")
                
                print(f" ✓ {inserted:,} documents")
                migrated_count += 1
                
            except Exception as e:
                print(f" ❌ FAILED: {e}")
                failed_collections.append(coll_name)
        
        print("-" * 80)
        print()
        
        # Summary
        print("=" * 80)
        print("Migration Summary")
        print("=" * 80)
        print(f"✓ Successfully migrated: {migrated_count}/{len(collections)} collections")
        
        if failed_collections:
            print(f"❌ Failed collections: {', '.join(failed_collections)}")
            print()
            print("⚠️  Some collections failed to migrate. Please check the errors above.")
            return False
        
        print()
        print("🎉 Migration completed successfully!")
        print()
        print("Next steps:")
        print(f"  1. Verify data in target database: {target_db_name}")
        print(f"  2. Update your .env file: DATABASE_URL should point to /{target_db_name}")
        print(f"  3. Test your application with the new database")
        print(f"  4. Once verified, you can safely delete the old database: {source_db_name}")
        print()
        
        return True
        
    except ConnectionFailure as e:
        print(f"❌ Error: Failed to connect to MongoDB: {e}")
        return False
    except OperationFailure as e:
        print(f"❌ Error: MongoDB operation failed: {e}")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        if 'client' in locals():
            client.close()


def main():
    parser = argparse.ArgumentParser(
        description="Migrate MongoDB database from one name to another",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry run to see what would be migrated
  python scripts/migrate_mongodb.py --dry-run
  
  # Perform actual migration
  python scripts/migrate_mongodb.py
  
  # Migrate with custom database names
  python scripts/migrate_mongodb.py --source-db old_db --target-db new_db
  
  # Drop target database before migration (CAUTION!)
  python scripts/migrate_mongodb.py --drop-target
        """
    )
    
    parser.add_argument(
        "--source-db",
        default="deeptutor",
        help="Source database name (default: deeptutor)"
    )
    
    parser.add_argument(
        "--target-db",
        default="novusorbit",
        help="Target database name (default: novusorbit)"
    )
    
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show migration plan without executing it"
    )
    
    parser.add_argument(
        "--drop-target",
        action="store_true",
        help="Drop target database before migration (CAUTION!)"
    )
    
    args = parser.parse_args()
    
    # Get connection string from environment
    connection_string = os.getenv("DATABASE_URL")
    
    if not connection_string:
        print("❌ Error: DATABASE_URL not found in environment variables")
        print("Please set DATABASE_URL in your .env file")
        return 1
    
    # Parse connection string to ensure it's valid
    base_connection_string, detected_db = parse_connection_string(
        connection_string, 
        ""  # Don't modify the connection string
    )
    
    print(f"Detected database in connection string: {detected_db or 'none'}")
    
    if detected_db and detected_db != args.source_db and not args.dry_run:
        print(f"⚠️  Warning: Connection string points to '{detected_db}' "
              f"but source is '{args.source_db}'")
        response = input("Continue? (yes/no): ")
        if response.lower() not in ['yes', 'y']:
            print("Migration cancelled")
            return 1
    
    # Perform migration
    success = migrate_database(
        base_connection_string,
        args.source_db,
        args.target_db,
        args.dry_run,
        args.drop_target
    )
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
