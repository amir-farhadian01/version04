import 'package:flutter/foundation.dart';

import '../cache/cache_janitor.dart';
import '../cache/cache_manager.dart';
import '../cache/disk_cache.dart';
import '../cache/memory_cache.dart';
import '../services/connectivity_service.dart';

/// Singleton provider that creates and holds the global [CacheManager] instance.
///
/// Inject this via `Provider<CacheProvider>` so that any screen can access the
/// caching infrastructure.
class CacheProvider extends ChangeNotifier {
  late final CacheManager _manager;

  CacheProvider({
    MemoryCache? memoryCache,
    DiskCache? diskCache,
    ConnectivityService? connectivity,
  }) {
    final memory = memoryCache ?? MemoryCache();
    final disk = diskCache ?? DiskCache();
    final conn = connectivity ?? ConnectivityService();

    _manager = CacheManager(
      memoryCache: memory,
      diskCache: disk,
      connectivity: conn,
      janitor: CacheJanitor(memoryCache: memory, diskCache: disk),
    );

    _manager.janitor.start();
  }

  CacheManager get manager => _manager;

  /// Fetch data for a given cache group + key.
  Future<({Map<String, dynamic> data, CacheSource source})> fetch({
    required String key,
    required String group,
    required Duration ttl,
    required Future<Map<String, dynamic>> Function() fetcher,
  }) {
    return _manager.get(key: key, group: group, ttl: ttl, fetcher: fetcher);
  }

  /// Clear all cached data (memory + disk + images).
  Future<void> clearAll() => _manager.clearAll();

  @override
  void dispose() {
    _manager.janitor.stop();
    super.dispose();
  }
}