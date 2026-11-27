import 'package:drift/drift.dart';
// ignore: deprecated_member_use
import 'package:drift/web.dart';

QueryExecutor openDriftConnection(String databaseName) {
  // ignore: deprecated_member_use
  return WebDatabase(databaseName);
}
