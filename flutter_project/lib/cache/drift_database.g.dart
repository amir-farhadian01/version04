// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'drift_database.dart';

// ignore_for_file: type=lint
class $CacheRowTable extends CacheRow
    with TableInfo<$CacheRowTable, CacheRowData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CacheRowTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _keyMeta = const VerificationMeta('key');
  @override
  late final GeneratedColumn<String> key = GeneratedColumn<String>(
    'key',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _jsonDataMeta = const VerificationMeta(
    'jsonData',
  );
  @override
  late final GeneratedColumn<String> jsonData = GeneratedColumn<String>(
    'json_data',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _cachedAtMeta = const VerificationMeta(
    'cachedAt',
  );
  @override
  late final GeneratedColumn<DateTime> cachedAt = GeneratedColumn<DateTime>(
    'cached_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _expiresAtMeta = const VerificationMeta(
    'expiresAt',
  );
  @override
  late final GeneratedColumn<DateTime> expiresAt = GeneratedColumn<DateTime>(
    'expires_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _groupMeta = const VerificationMeta('group');
  @override
  late final GeneratedColumn<String> group = GeneratedColumn<String>(
    'group',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    key,
    jsonData,
    cachedAt,
    expiresAt,
    group,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cache_row';
  @override
  VerificationContext validateIntegrity(
    Insertable<CacheRowData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('key')) {
      context.handle(
        _keyMeta,
        key.isAcceptableOrUnknown(data['key']!, _keyMeta),
      );
    } else if (isInserting) {
      context.missing(_keyMeta);
    }
    if (data.containsKey('json_data')) {
      context.handle(
        _jsonDataMeta,
        jsonData.isAcceptableOrUnknown(data['json_data']!, _jsonDataMeta),
      );
    } else if (isInserting) {
      context.missing(_jsonDataMeta);
    }
    if (data.containsKey('cached_at')) {
      context.handle(
        _cachedAtMeta,
        cachedAt.isAcceptableOrUnknown(data['cached_at']!, _cachedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_cachedAtMeta);
    }
    if (data.containsKey('expires_at')) {
      context.handle(
        _expiresAtMeta,
        expiresAt.isAcceptableOrUnknown(data['expires_at']!, _expiresAtMeta),
      );
    } else if (isInserting) {
      context.missing(_expiresAtMeta);
    }
    if (data.containsKey('group')) {
      context.handle(
        _groupMeta,
        group.isAcceptableOrUnknown(data['group']!, _groupMeta),
      );
    } else if (isInserting) {
      context.missing(_groupMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {key};
  @override
  CacheRowData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CacheRowData(
      key: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}key'],
      )!,
      jsonData: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}json_data'],
      )!,
      cachedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}cached_at'],
      )!,
      expiresAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}expires_at'],
      )!,
      group: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}group'],
      )!,
    );
  }

  @override
  $CacheRowTable createAlias(String alias) {
    return $CacheRowTable(attachedDatabase, alias);
  }
}

class CacheRowData extends DataClass implements Insertable<CacheRowData> {
  final String key;
  final String jsonData;
  final DateTime cachedAt;
  final DateTime expiresAt;
  final String group;
  const CacheRowData({
    required this.key,
    required this.jsonData,
    required this.cachedAt,
    required this.expiresAt,
    required this.group,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['key'] = Variable<String>(key);
    map['json_data'] = Variable<String>(jsonData);
    map['cached_at'] = Variable<DateTime>(cachedAt);
    map['expires_at'] = Variable<DateTime>(expiresAt);
    map['group'] = Variable<String>(group);
    return map;
  }

  CacheRowCompanion toCompanion(bool nullToAbsent) {
    return CacheRowCompanion(
      key: Value(key),
      jsonData: Value(jsonData),
      cachedAt: Value(cachedAt),
      expiresAt: Value(expiresAt),
      group: Value(group),
    );
  }

  factory CacheRowData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CacheRowData(
      key: serializer.fromJson<String>(json['key']),
      jsonData: serializer.fromJson<String>(json['jsonData']),
      cachedAt: serializer.fromJson<DateTime>(json['cachedAt']),
      expiresAt: serializer.fromJson<DateTime>(json['expiresAt']),
      group: serializer.fromJson<String>(json['group']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'key': serializer.toJson<String>(key),
      'jsonData': serializer.toJson<String>(jsonData),
      'cachedAt': serializer.toJson<DateTime>(cachedAt),
      'expiresAt': serializer.toJson<DateTime>(expiresAt),
      'group': serializer.toJson<String>(group),
    };
  }

  CacheRowData copyWith({
    String? key,
    String? jsonData,
    DateTime? cachedAt,
    DateTime? expiresAt,
    String? group,
  }) => CacheRowData(
    key: key ?? this.key,
    jsonData: jsonData ?? this.jsonData,
    cachedAt: cachedAt ?? this.cachedAt,
    expiresAt: expiresAt ?? this.expiresAt,
    group: group ?? this.group,
  );
  CacheRowData copyWithCompanion(CacheRowCompanion data) {
    return CacheRowData(
      key: data.key.present ? data.key.value : this.key,
      jsonData: data.jsonData.present ? data.jsonData.value : this.jsonData,
      cachedAt: data.cachedAt.present ? data.cachedAt.value : this.cachedAt,
      expiresAt: data.expiresAt.present ? data.expiresAt.value : this.expiresAt,
      group: data.group.present ? data.group.value : this.group,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CacheRowData(')
          ..write('key: $key, ')
          ..write('jsonData: $jsonData, ')
          ..write('cachedAt: $cachedAt, ')
          ..write('expiresAt: $expiresAt, ')
          ..write('group: $group')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(key, jsonData, cachedAt, expiresAt, group);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CacheRowData &&
          other.key == this.key &&
          other.jsonData == this.jsonData &&
          other.cachedAt == this.cachedAt &&
          other.expiresAt == this.expiresAt &&
          other.group == this.group);
}

class CacheRowCompanion extends UpdateCompanion<CacheRowData> {
  final Value<String> key;
  final Value<String> jsonData;
  final Value<DateTime> cachedAt;
  final Value<DateTime> expiresAt;
  final Value<String> group;
  final Value<int> rowid;
  const CacheRowCompanion({
    this.key = const Value.absent(),
    this.jsonData = const Value.absent(),
    this.cachedAt = const Value.absent(),
    this.expiresAt = const Value.absent(),
    this.group = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CacheRowCompanion.insert({
    required String key,
    required String jsonData,
    required DateTime cachedAt,
    required DateTime expiresAt,
    required String group,
    this.rowid = const Value.absent(),
  }) : key = Value(key),
       jsonData = Value(jsonData),
       cachedAt = Value(cachedAt),
       expiresAt = Value(expiresAt),
       group = Value(group);
  static Insertable<CacheRowData> custom({
    Expression<String>? key,
    Expression<String>? jsonData,
    Expression<DateTime>? cachedAt,
    Expression<DateTime>? expiresAt,
    Expression<String>? group,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (key != null) 'key': key,
      if (jsonData != null) 'json_data': jsonData,
      if (cachedAt != null) 'cached_at': cachedAt,
      if (expiresAt != null) 'expires_at': expiresAt,
      if (group != null) 'group': group,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CacheRowCompanion copyWith({
    Value<String>? key,
    Value<String>? jsonData,
    Value<DateTime>? cachedAt,
    Value<DateTime>? expiresAt,
    Value<String>? group,
    Value<int>? rowid,
  }) {
    return CacheRowCompanion(
      key: key ?? this.key,
      jsonData: jsonData ?? this.jsonData,
      cachedAt: cachedAt ?? this.cachedAt,
      expiresAt: expiresAt ?? this.expiresAt,
      group: group ?? this.group,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (key.present) {
      map['key'] = Variable<String>(key.value);
    }
    if (jsonData.present) {
      map['json_data'] = Variable<String>(jsonData.value);
    }
    if (cachedAt.present) {
      map['cached_at'] = Variable<DateTime>(cachedAt.value);
    }
    if (expiresAt.present) {
      map['expires_at'] = Variable<DateTime>(expiresAt.value);
    }
    if (group.present) {
      map['group'] = Variable<String>(group.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CacheRowCompanion(')
          ..write('key: $key, ')
          ..write('jsonData: $jsonData, ')
          ..write('cachedAt: $cachedAt, ')
          ..write('expiresAt: $expiresAt, ')
          ..write('group: $group, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);
  $AppDatabaseManager get managers => $AppDatabaseManager(this);
  late final $CacheRowTable cacheRow = $CacheRowTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [cacheRow];
}

typedef $$CacheRowTableCreateCompanionBuilder =
    CacheRowCompanion Function({
      required String key,
      required String jsonData,
      required DateTime cachedAt,
      required DateTime expiresAt,
      required String group,
      Value<int> rowid,
    });
typedef $$CacheRowTableUpdateCompanionBuilder =
    CacheRowCompanion Function({
      Value<String> key,
      Value<String> jsonData,
      Value<DateTime> cachedAt,
      Value<DateTime> expiresAt,
      Value<String> group,
      Value<int> rowid,
    });

class $$CacheRowTableFilterComposer
    extends Composer<_$AppDatabase, $CacheRowTable> {
  $$CacheRowTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get key => $composableBuilder(
    column: $table.key,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get jsonData => $composableBuilder(
    column: $table.jsonData,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get cachedAt => $composableBuilder(
    column: $table.cachedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get expiresAt => $composableBuilder(
    column: $table.expiresAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get group => $composableBuilder(
    column: $table.group,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CacheRowTableOrderingComposer
    extends Composer<_$AppDatabase, $CacheRowTable> {
  $$CacheRowTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get key => $composableBuilder(
    column: $table.key,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get jsonData => $composableBuilder(
    column: $table.jsonData,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get cachedAt => $composableBuilder(
    column: $table.cachedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get expiresAt => $composableBuilder(
    column: $table.expiresAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get group => $composableBuilder(
    column: $table.group,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CacheRowTableAnnotationComposer
    extends Composer<_$AppDatabase, $CacheRowTable> {
  $$CacheRowTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get key =>
      $composableBuilder(column: $table.key, builder: (column) => column);

  GeneratedColumn<String> get jsonData =>
      $composableBuilder(column: $table.jsonData, builder: (column) => column);

  GeneratedColumn<DateTime> get cachedAt =>
      $composableBuilder(column: $table.cachedAt, builder: (column) => column);

  GeneratedColumn<DateTime> get expiresAt =>
      $composableBuilder(column: $table.expiresAt, builder: (column) => column);

  GeneratedColumn<String> get group =>
      $composableBuilder(column: $table.group, builder: (column) => column);
}

class $$CacheRowTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $CacheRowTable,
          CacheRowData,
          $$CacheRowTableFilterComposer,
          $$CacheRowTableOrderingComposer,
          $$CacheRowTableAnnotationComposer,
          $$CacheRowTableCreateCompanionBuilder,
          $$CacheRowTableUpdateCompanionBuilder,
          (
            CacheRowData,
            BaseReferences<_$AppDatabase, $CacheRowTable, CacheRowData>,
          ),
          CacheRowData,
          PrefetchHooks Function()
        > {
  $$CacheRowTableTableManager(_$AppDatabase db, $CacheRowTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CacheRowTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CacheRowTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CacheRowTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> key = const Value.absent(),
                Value<String> jsonData = const Value.absent(),
                Value<DateTime> cachedAt = const Value.absent(),
                Value<DateTime> expiresAt = const Value.absent(),
                Value<String> group = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CacheRowCompanion(
                key: key,
                jsonData: jsonData,
                cachedAt: cachedAt,
                expiresAt: expiresAt,
                group: group,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String key,
                required String jsonData,
                required DateTime cachedAt,
                required DateTime expiresAt,
                required String group,
                Value<int> rowid = const Value.absent(),
              }) => CacheRowCompanion.insert(
                key: key,
                jsonData: jsonData,
                cachedAt: cachedAt,
                expiresAt: expiresAt,
                group: group,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CacheRowTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $CacheRowTable,
      CacheRowData,
      $$CacheRowTableFilterComposer,
      $$CacheRowTableOrderingComposer,
      $$CacheRowTableAnnotationComposer,
      $$CacheRowTableCreateCompanionBuilder,
      $$CacheRowTableUpdateCompanionBuilder,
      (
        CacheRowData,
        BaseReferences<_$AppDatabase, $CacheRowTable, CacheRowData>,
      ),
      CacheRowData,
      PrefetchHooks Function()
    >;

class $AppDatabaseManager {
  final _$AppDatabase _db;
  $AppDatabaseManager(this._db);
  $$CacheRowTableTableManager get cacheRow =>
      $$CacheRowTableTableManager(_db, _db.cacheRow);
}
