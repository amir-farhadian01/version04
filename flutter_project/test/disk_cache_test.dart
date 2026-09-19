import 'dart:io';

import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:neighborly_app/cache/disk_cache.dart';
import 'package:neighborly_app/cache/drift_database.dart';
import 'package:neighborly_app/models/cache_entry.dart';

void main() {
  test('disk cache survives reopening a native SQLite database', () async {
    final directory = await Directory.systemTemp.createTemp(
      'neighborly-cache-',
    );
    final databaseFile = File('${directory.path}/cache.sqlite');

    try {
      final firstDatabase = AppDatabase.forTesting(
        NativeDatabase(databaseFile),
      );
      final firstCache = DiskCache(db: firstDatabase);
      final now = DateTime.now().toUtc();
      await firstCache.put(
        CacheEntry(
          key: 'orders:1',
          jsonData: '{"id":"order-1"}',
          cachedAt: now,
          expiresAt: now.add(const Duration(hours: 1)),
          group: 'orders',
        ),
      );
      await firstDatabase.close();

      final secondDatabase = AppDatabase.forTesting(
        NativeDatabase(databaseFile),
      );
      final secondCache = DiskCache(db: secondDatabase);
      final restored = await secondCache.get('orders:1');

      expect(restored?.jsonData, '{"id":"order-1"}');
      await secondDatabase.close();
    } finally {
      await directory.delete(recursive: true);
    }
  });
}
