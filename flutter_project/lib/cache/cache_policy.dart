/// Time-to-live policies for every cacheable resource group.
///
/// Each constant defines a TTL that the in-memory LRU and the disk cache
/// both respect.  Values are chosen so that volatile data (orders, messages)
/// expire quickly while static data (categories, settings) stays longer.
abstract final class CachePolicy {
  CachePolicy._();

  /// Messages / chat — frequent updates, keep fresh.
  static const Duration messagesTtl = Duration(minutes: 30);

  /// Orders — can change rapidly, short TTL with stale-while-revalidate.
  static const Duration ordersTtl = Duration(minutes: 5);

  /// Social feed posts — medium freshness.
  static const Duration feedTtl = Duration(minutes: 10);

  /// Business pages — rarely change, longer TTL.
  static const Duration businessPageTtl = Duration(minutes: 30);

  /// Categories / taxonomy — nearly static.
  static const Duration categoriesTtl = Duration(hours: 24);

  /// User settings — rarely change.
  static const Duration settingsTtl = Duration(hours: 1);

  /// Images — keep on disk for a week, then evict on access.
  static const Duration imageDiskTtl = Duration(days: 7);

  /// Maximum disk cache size in bytes (200 MB).
  static const int maxDiskCacheBytes = 200 * 1024 * 1024;

  /// Maximum in-memory LRU entries before eviction.
  static const int maxMemoryEntries = 500;

  /// How often the janitor sweeps expired disk entries.
  static const Duration janitorInterval = Duration(minutes: 15);
}