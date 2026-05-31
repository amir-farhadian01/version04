import 'dart:async';

import 'package:drift/drift.dart';
import 'package:drift/web.dart';

part 'drift_database.g.dart';

/// Row definition for the cache_entries table.
class CacheRow extends Table {
  TextColumn get key => text()();
  TextColumn get jsonData => text()();
  DateTimeColumn get cachedAt => dateTime()();
  DateTimeColumn get expiresAt => dateTime()();
  TextColumn get group => text()();

  @override
  Set<Column> get primaryKey => {key};
}

@DriftDatabase(tables: [CacheRow])
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  @override
  int get schemaVersion => 1;

  Future<void> upsert(Insertable<CacheRowData> row) =>
      into(cacheRow).insertOnConflictUpdate(row);

  Future<CacheRowData?> getByKey(String key) {
    return (select(cacheRow)..where((t) => t.key.equals(key)))
        .getSingleOrNull();
  }

  Future<int> deleteByKey(String key) {
    return (delete(cacheRow)..where((t) => t.key.equals(key))).go();
  }

  Future<int> deleteByGroup(String group) {
    return (delete(cacheRow)..where((t) => t.group.equals(group))).go();
  }

  Future<int> deleteExpired() {
    return (delete(cacheRow)
          ..where(
              (t) => t.expiresAt.isSmallerThanValue(DateTime.now().toUtc())))
        .go();
  }

  Future<int> get rowCount =>
      cacheRow.count().getSingle().then((r) => r.toInt());

  Future<int> estimatedSizeBytes() async {
    final rows = await select(cacheRow).get();
    return rows.fold<int>(0, (sum, r) => sum + r.jsonData.length);
  }
}

QueryExecutor _openConnection() {
  return WebDatabase('neighborly_cache');
}
