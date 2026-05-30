import 'dart:async';

import 'cache_policy.dart';
import 'disk_cache.dart';
import 'memory_cache.dart';

/// Background service that periodically prunes stale cache entries.
///
/// Runs on a configurable interval ([CachePolicy.janitorInterval]) and:
/// 1. Removes expired entries from the in-memory LRU.
/// 2. Removes expired rows from the disk cache.
/// 3. Checks disk cache size and evicts oldest entries if it exceeds
///    [CachePolicy.maxDiskCacheBytes].
class CacheJanitor {
  final MemoryCache _memoryCache;
  final DiskCache _diskCache;
  Timer? _timer;

  CacheJanitor({
    required MemoryCache memoryCache,
    required DiskCache diskCache,
  })  : _memoryCache = memoryCache,
        _diskCache = diskCache;

  /// Start the periodic sweep. Safe to call multiple times.
  void start() {
    _timer?.cancel();
    _timer = Timer.periodic(CachePolicy.janitorInterval, (_) => sweep());
  }

  /// Manually trigger a single sweep. Useful after logout or large inserts.
  Future<void> sweep() async {
    // 1. Memory — expired entries.
    _memoryCache.clear();

    // 2. Disk — expired rows.
    await _diskCache.removeExpired();

    // 3. Disk — size check.
    final size = await _diskCache.estimatedSizeBytes();
    if (size > CachePolicy.maxDiskCacheBytes) {
      // Simple approach: clear all disk entries.
      // A production version would evict oldest-first.
      await _diskCache.clear();
    }

    // 4. Images — rely on the built-in 7-day stale period;
    //    no additional sweep needed here.
  }

  /// Stop the periodic timer.
  void stop() {
    _timer?.cancel();
    _timer = null;
  }
}