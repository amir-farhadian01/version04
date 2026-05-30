import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';

/// Handles authentication via the backend API.
/// Supports email+password login/register with optional phone.
class AuthService {
  static final AuthService _instance = AuthService._();
  factory AuthService() => _instance;
  AuthService._();

  final ApiService _api = ApiService();

  static const String _tokenKey = 'auth_access_token';
  static const String _userKey = 'auth_user_data';

  /// Login with username/email/phone + password.
  /// The [login] field can be: email, username (normalizedDisplayName), or phone.
  Future<Map<String, dynamic>> login(String login, String password) async {
    final response = await _api.post('/auth/login', body: {
      'login': login,
      'password': password,
    });

    if (response.containsKey('accessToken')) {
      final token = response['accessToken'] as String;
      _api.setToken(token);
      await _persistAuth(token, response['user'] as Map<String, dynamic>?);
    }

    return response;
  }

  /// Register a new user with email, password, displayName, and optional phone.
  /// Phone must be unique if provided.
  Future<Map<String, dynamic>> register({
    required String email,
    required String password,
    required String displayName,
    String? phone,
  }) async {
    final body = <String, dynamic>{
      'email': email,
      'password': password,
      'displayName': displayName,
    };
    if (phone != null && phone.isNotEmpty) {
      body['phone'] = phone;
    }

    final response = await _api.post('/auth/register', body: body);

    if (response.containsKey('accessToken')) {
      final token = response['accessToken'] as String;
      _api.setToken(token);
      await _persistAuth(token, response['user'] as Map<String, dynamic>?);
    }

    return response;
  }

  /// Try to restore a saved session.
  Future<bool> tryRestoreSession() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(_tokenKey);
    if (token == null) return false;

    _api.setToken(token);
    try {
      await _api.get('/auth/me');
      return true;
    } catch (_) {
      // Token expired — clear saved data
      await _clearAuth();
      return false;
    }
  }

  /// Check if user has a saved session (fast, no network call).
  Future<bool> hasSavedSession() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey) != null;
  }

  /// Get parsed user data Map.
  Future<Map<String, dynamic>?> getUserData() async {
    final prefs = await SharedPreferences.getInstance();
    final rawUser = prefs.getString(_userKey);
    if (rawUser == null) return null;
    try {
      return jsonDecode(rawUser) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  /// Get user role.
  Future<String?> getUserRole() async {
    final user = await getUserData();
    return user?['role'] as String?;
  }

  Future<void> _persistAuth(String token, Map<String, dynamic>? user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
    if (user != null) {
      await prefs.setString(_userKey, jsonEncode(user));
    }
  }

  Future<void> _clearAuth() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_userKey);
    _api.setToken(null);
  }

  Future<void> logout() async {
    try {
      await _api.post('/auth/logout');
    } catch (_) {
      // Best-effort server-side logout
    }
    await _clearAuth();
  }
}