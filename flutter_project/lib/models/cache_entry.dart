/// Metadata for a cached API response stored in the local database.
///
/// Each row tracks when and why data was stored, so the cache layer can
/// enforce TTL expiration and support manual purge operations.
class CacheEntry {
  /// Unique key that identifies the cached resource (e.g. the API path).
  final String key;

  /// Serialized JSON body returned by the backend.
  final String jsonData;

  /// UTC timestamp when this entry was created or last refreshed.
  final DateTime cachedAt;

  /// Absolute point in time after which the entry is considered stale.
  final DateTime expiresAt;

  /// Human-readable label used for grouping entries (e.g. "messages", "orders").
  final String group;

  const CacheEntry({
    required this.key,
    required this.jsonData,
    required this.cachedAt,
    required this.expiresAt,
    required this.group,
  });

  /// Whether the entry has passed its expiration.
  bool get isExpired => DateTime.now().toUtc().isAfter(expiresAt);

  /// Remaining time before expiration. Returns [Duration.zero] when expired.
  Duration get remainingTtl {
    final now = DateTime.now().toUtc();
    return now.isBefore(expiresAt) ? expiresAt.difference(now) : Duration.zero;
  }

  Map<String, dynamic> toJson() => {
        'key': key,
        'jsonData': jsonData,
        'cachedAt': cachedAt.toIso8601String(),
        'expiresAt': expiresAt.toIso8601String(),
        'group': group,
      };

  factory CacheEntry.fromJson(Map<String, dynamic> json) => CacheEntry(
        key: json['key'] as String,
        jsonData: json['jsonData'] as String,
        cachedAt: DateTime.parse(json['cachedAt'] as String),
        expiresAt: DateTime.parse(json['expiresAt'] as String),
        group: json['group'] as String,
      );
}