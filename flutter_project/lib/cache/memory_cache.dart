import 'dart:collection';

import '../models/cache_entry.dart';
import 'cache_policy.dart';

/// In-memory LRU cache (L1) that sits closest to the UI.
///
/// Data stays in memory up to [CachePolicy.maxMemoryEntries] entries;
/// after that the least-recently-accessed entry is evicted.
class MemoryCache {
  final LinkedHashMap<String, CacheEntry> _store = LinkedHashMap();
  final _accessOrder = <String>[];

  /// Retrieve a cached entry by key. Returns `null` when the key is
  /// missing **or** the entry has expired.
  CacheEntry? get(String key) {
    final entry = _store[key];
    if (entry == null) return null;

    if (entry.isExpired) {
      _remove(key);
      return null;
    }

    // ✅ Access promotes the key to MRU position.
    _touch(key);
    return entry;
  }

  /// Store or update an entry. If the LRU is full the least-recently-used
  /// item is evicted before insertion.
  void put(CacheEntry entry) {
    if (_store.containsKey(entry.key)) {
      _remove(entry.key);
    }

    while (_store.length >= CachePolicy.maxMemoryEntries) {
      final lru = _accessOrder.first;
      _store.remove(lru);
      _accessOrder.removeAt(0);
    }

    _store[entry.key] = entry;
    _accessOrder.add(entry.key);
  }

  /// Remove a specific key from memory.
  void remove(String key) => _remove(key);

  /// Remove all entries belonging to a group (e.g. "messages").
  void removeGroup(String group) {
    final keys = _store.entries
        .where((e) => e.value.group == group)
        .map((e) => e.key)
        .toList();
    for (final k in keys) {
      _remove(k);
    }
  }

  /// Clear every entry in memory.
  void clear() {
    _store.clear();
    _accessOrder.clear();
  }

  /// Number of entries currently held.
  int get length => _store.length;

  /// Whether the in-memory cache is empty.
  bool get isEmpty => _store.isEmpty;

  void _remove(String key) {
    _store.remove(key);
    _accessOrder.remove(key);
  }

  void _touch(String key) {
    _accessOrder.remove(key);
    _accessOrder.add(key);
  }
}