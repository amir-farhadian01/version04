import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';

/// Observable network state that UI layers can react to.
///
/// Reports whether the device currently has internet access.
/// Consumed by [CacheManager] to decide which cache layer to use.
class ConnectivityService extends ChangeNotifier {
  final Connectivity _connectivity;

  bool _isOnline = true;

  ConnectivityService({Connectivity? connectivity})
      : _connectivity = connectivity ?? Connectivity() {
    _connectivity.onConnectivityChanged.listen(_onStatusChanged);
    _checkInitial();
  }

  /// `true` when the device has network access.
  bool get isOnline => _isOnline;

  Future<void> _checkInitial() async {
    final result = await _connectivity.checkConnectivity();
    _updateFromResult(result);
  }

  void _onStatusChanged(List<ConnectivityResult> results) {
    _updateFromResult(results);
  }

  void _updateFromResult(dynamic result) {
    final wasOnline = _isOnline;
    if (result is List && result.isNotEmpty) {
      _isOnline = result.any((r) => r != ConnectivityResult.none);
    } else if (result is ConnectivityResult) {
      _isOnline = result != ConnectivityResult.none;
    }

    if (_isOnline != wasOnline) {
      notifyListeners();
    }
  }
}