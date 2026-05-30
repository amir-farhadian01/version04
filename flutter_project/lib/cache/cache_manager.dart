import 'dart:convert';

import '../models/cache_entry.dart';
import '../services/connectivity_service.dart';
import 'cache_janitor.dart';
import 'disk_cache.dart';
import 'image_cache_config.dart';
import 'memory_cache.dart';

/// Result returned by [CacheManager.get] so callers can decide whether
/// to show stale data, a loading spinner, or keep showing the previous value.
enum CacheSource {
  /// Data came from the in-memory LRU.
  memory,

  /// Data came from the SQLite disk cache.
  disk,

  /// Data was freshly fetched from the network.
  network,
}

/// Central orchestrator for the five-layer caching system.
///
/// Usage:
/// ```dart
/// final result = await cacheManager.get(
///   key: '/orders/active',
///   group: 'orders',
///   ttl: CachePolicy.ordersTtl,
///   fetcher: () => apiService.getActiveOrders(),
/// );
/// ```
class CacheManager {
  final MemoryCache _memory;
  final DiskCache _disk;
  final ConnectivityService _connectivity;
  final CacheJanitor _janitor;

  CacheManager({
    required MemoryCache memoryCache,
    required DiskCache diskCache,
    required ConnectivityService connectivity,
    required CacheJanitor janitor,
  })  : _memory = memoryCache,
        _disk = diskCache,
        _connectivity = connectivity,
        _janitor = janitor;

  /// Fetch data through the multi-layer cache.
  ///
  /// Priority order:
  /// 1. **Memory** (if fresh) — instant return.
  /// 2. **Disk** (if fresh) — promote to memory, then return.
  /// 3. **Network** — fetch, store in memory + disk, return.
  ///
  /// When offline and no fresh cache is available, returns whatever is on
  /// disk, even if expired, so the UI can show data with a stale badge.
  Future<({Map<String, dynamic> data, CacheSource source})> get({
    required String key,
    required String group,
    required Duration ttl,
    required Future<Map<String, dynamic>> Function() fetcher,
  }) async {
    // ── 1. Check memory (fastest) ──────────────────────────────────────────
    final memEntry = _memory.get(key);
    if (memEntry != null) {
      return (
        data: jsonDecode(memEntry.jsonData) as Map<String, dynamic>,
        source: CacheSource.memory,
      );
    }

    // ── 2. Check disk ─────────────────────────────────────────────────────
    final diskEntry = await _disk.get(key);
    if (diskEntry != null) {
      _memory.put(diskEntry);
      return (
        data: jsonDecode(diskEntry.jsonData) as Map<String, dynamic>,
        source: CacheSource.disk,
      );
    }

    // ── 3. Network ────────────────────────────────────────────────────────
    if (!_connectivity.isOnline) {
      // Attempt stale read from disk (bypass TTL check).
      final staleEntry = await _disk.getRaw(key);
      if (staleEntry != null) {
        return (
          data: jsonDecode(staleEntry.jsonData) as Map<String, dynamic>,
          source: CacheSource.disk,
        );
      }

      throw CacheNetworkException('Offline — no cached data available');
    }

    final payload = await fetcher();

    final entry = CacheEntry(
      key: key,
      jsonData: jsonEncode(payload),
      cachedAt: DateTime.now().toUtc(),
      expiresAt: DateTime.now().toUtc().add(ttl),
      group: group,
    );

    _memory.put(entry);
    await _disk.put(entry);

    return (data: payload, source: CacheSource.network);
  }

  /// Remove a single cache key from memory + disk.
  Future<void> remove(String key) async {
    _memory.remove(key);
    await _disk.remove(key);
  }

  /// Remove all entries for a group (e.g. "messages") from memory + disk.
  Future<void> removeGroup(String group) async {
    _memory.removeGroup(group);
    await _disk.removeGroup(group);
  }

  /// Flush everything: memory, disk, AND images.
  Future<void> clearAll() async {
    _memory.clear();
    await _disk.clear();
    await ImageCacheConfig.clearAll();
  }

  /// Get the cache janitor (for start/stop lifecycle).
  CacheJanitor get janitor => _janitor;

  /// Estimated disk usage in bytes.
  Future<int> diskSizeBytes() => _disk.estimatedSizeBytes();

  /// Total rows in disk cache.
  Future<int> diskRowCount() => _disk.count;

  /// Current number of in-memory entries.
  int get memoryEntryCount => _memory.length;
}

/// Thrown by [CacheManager.get] when the device is offline and no
/// cached data (even stale) is available.
class CacheNetworkException implements Exception {
  final String message;
  const CacheNetworkException(this.message);

  @override
  String toString() => 'CacheNetworkException: $message';
}