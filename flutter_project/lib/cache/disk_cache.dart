import '../models/cache_entry.dart';
import 'drift_database.dart';

/// Disk-backed cache (L2) using SQLite via Drift.
///
/// Holds serialized API responses that can survive app restarts.
class DiskCache {
  final AppDatabase _db;

  DiskCache({AppDatabase? db}) : _db = db ?? AppDatabase();

  /// Retrieve a single entry by its key.
  /// Returns `null` when the key does not exist **or** the entry has expired.
  Future<CacheEntry?> get(String key) async {
    final row = await _db.getByKey(key);
    if (row == null) return null;

    final entry = CacheEntry(
      key: row.key,
      jsonData: row.jsonData,
      cachedAt: row.cachedAt,
      expiresAt: row.expiresAt,
      group: row.group,
    );

    if (entry.isExpired) {
      await _db.deleteByKey(key);
      return null;
    }

    return entry;
  }

  /// Store or update an entry.
  Future<void> put(CacheEntry entry) async {
    await _db.upsert(CacheRowCompanion.insert(
      key: entry.key,
      jsonData: entry.jsonData,
      cachedAt: entry.cachedAt,
      expiresAt: entry.expiresAt,
      group: entry.group,
    ));
  }

  /// Remove a single entry.
  Future<void> remove(String key) => _db.deleteByKey(key);

  /// Remove every entry that belongs to [group].
  Future<void> removeGroup(String group) => _db.deleteByGroup(group);

  /// Raw read that does NOT check TTL — returns whatever is on disk,
  /// expired or not. Used for offline fallback.
    Future<CacheEntry?> getRaw(String key) async {
    final row = await _db.getByKey(key);
    if (row == null) return null;

    return CacheEntry(
      key: row.key,
      jsonData: row.jsonData,
      cachedAt: row.cachedAt,
      expiresAt: row.expiresAt,
      group: row.group,
    );
  }

  /// Remove all entries whose [CacheEntry.expiresAt] is in the past.
  Future<void> removeExpired() => _db.deleteExpired();

  /// Wipe every entry from disk.
  Future<void> clear() async {
    final rows = await _db.select(_db.cacheRow).get();
    for (final row in rows) {
      await _db.deleteByKey(row.key);
    }
  }

  /// Estimated on-disk size of all cached responses in bytes.
  Future<int> estimatedSizeBytes() => _db.estimatedSizeBytes();

  /// Total number of rows in the cache table.
  Future<int> get count => _db.rowCount;
}