import 'dart:convert';
import 'package:http/http.dart' as http;

/// Centralized API service for the Flutter app.
/// Points to the backend at localhost:8080 (local dev).
class ApiService {
  // In production, this would come from environment/config.
  // For local dev, the backend runs on port 8080.
  static const String baseUrl = 'http://localhost:8080/api';

  static final ApiService _instance = ApiService._();
  factory ApiService() => _instance;
  ApiService._();

  String? _accessToken;

  void setToken(String? token) {
    _accessToken = token;
  }

  String? getToken() => _accessToken;

  Map<String, String> get _headers {
    final h = <String, String>{
      'Content-Type': 'application/json',
    };
    if (_accessToken != null) {
      h['Authorization'] = 'Bearer $_accessToken';
    }
    return h;
  }

  Future<Map<String, dynamic>> get(String path) async {
    final uri = Uri.parse('$baseUrl$path');
    final response = await http.get(uri, headers: _headers);
    return _handleResponse(response);
  }

  Future<Map<String, dynamic>> post(String path, {Map<String, dynamic>? body}) async {
    final uri = Uri.parse('$baseUrl$path');
    final response = await http.post(
      uri,
      headers: _headers,
      body: body != null ? jsonEncode(body) : null,
    );
    return _handleResponse(response);
  }

  Future<Map<String, dynamic>> put(String path, {Map<String, dynamic>? body}) async {
    final uri = Uri.parse('$baseUrl$path');
    final response = await http.put(
      uri,
      headers: _headers,
      body: body != null ? jsonEncode(body) : null,
    );
    return _handleResponse(response);
  }

  /// Get the user's saved location from their profile.
  Future<String> getMyLocation() async {
    final result = await get('/places/my-location');
    return result['location'] as String? ?? '';
  }

  /// Save the user's current location to their profile.
  Future<void> saveMyLocation(String location) async {
    await put('/places/my-location', body: {'location': location});
  }

  /// Reverse-geocode lat/lng to get a short location string (e.g. "Toronto, ON").
  /// Returns a map with: city, state, shortLocation, formattedAddress.
  Future<Map<String, dynamic>> getCurrentLocation(double lat, double lng) async {
    return await get('/places/current-location?lat=$lat&lng=$lng');
  }

  Map<String, dynamic> _handleResponse(http.Response response) {
    final body = response.body.isNotEmpty ? jsonDecode(response.body) as Map<String, dynamic> : <String, dynamic>{};
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body;
    }
    throw ApiException(
      statusCode: response.statusCode,
      message: body['error'] as String? ?? 'Request failed',
    );
  }
  /// Upload a file (image) to the server via multipart POST.
  /// Returns the URL of the uploaded file.
  Future<String> uploadFile(String filePath) async {
    final uri = Uri.parse('$baseUrl/upload');
    final request = http.MultipartRequest('POST', uri);
    if (_accessToken != null) {
      request.headers['Authorization'] = 'Bearer $_accessToken';
    }
    request.files.add(await http.MultipartFile.fromPath('file', filePath));
    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);
    final body = response.body.isNotEmpty ? jsonDecode(response.body) as Map<String, dynamic> : <String, dynamic>{};
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body['url'] as String? ?? body['path'] as String? ?? '';
    }
    throw ApiException(
      statusCode: response.statusCode,
      message: body['error'] as String? ?? 'Upload failed',
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USER ADDRESSES
  // ═══════════════════════════════════════════════════════════════════════════

  Future<List<Map<String, dynamic>>> getAddresses() async {
    final result = await get('/user-addresses');
    return (result['items'] as List<dynamic>?)
            ?.cast<Map<String, dynamic>>() ??
        [];
  }

  Future<Map<String, dynamic>> createAddress(Map<String, dynamic> body) async {
    return await post('/user-addresses', body: body);
  }

  Future<Map<String, dynamic>> updateAddress(
      String id, Map<String, dynamic> body) async {
    return await put('/user-addresses/$id', body: body);
  }

  Future<void> deleteAddress(String id) async {
    await _delete('/user-addresses/$id');
  }

  Future<Map<String, dynamic>> setDefaultAddress(String id) async {
    return await put('/user-addresses/$id/default');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USER CARS
  // ═══════════════════════════════════════════════════════════════════════════

  Future<List<Map<String, dynamic>>> getCars() async {
    final result = await get('/user-cars');
    return (result['items'] as List<dynamic>?)?.cast<Map<String, dynamic>>() ??
        [];
  }

  Future<Map<String, dynamic>> createCar(Map<String, dynamic> body) async {
    return await post('/user-cars', body: body);
  }

  Future<Map<String, dynamic>> updateCar(
      String id, Map<String, dynamic> body) async {
    return await put('/user-cars/$id', body: body);
  }

  Future<void> deleteCar(String id) async {
    await _delete('/user-cars/$id');
  }

  Future<Map<String, dynamic>> setDefaultCar(String id) async {
    return await put('/user-cars/$id/default');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SOCIAL FEED
  // ═══════════════════════════════════════════════════════════════════════════

  Future<Map<String, dynamic>> getFeedPosts({
    int page = 1,
    String? categoryId,
    double? lat,
    double? lng,
  }) async {
    final params = <String, String>{'page': page.toString()};
    if (categoryId != null) params['categoryId'] = categoryId;
    if (lat != null) params['lat'] = lat.toString();
    if (lng != null) params['lng'] = lng.toString();
    final query = params.entries.map((e) => '${e.key}=${e.value}').join('&');
    return await get('/social/posts/feed?$query');
  }

  Future<Map<String, dynamic>> createPost(Map<String, dynamic> body) async {
    return await post('/social/posts', body: body);
  }

  Future<Map<String, dynamic>> toggleLike(String postId) async {
    return await post('/social/posts/$postId/like');
  }

  Future<Map<String, dynamic>> toggleSave(String postId) async {
    return await post('/social/posts/$postId/save');
  }

  Future<List<Map<String, dynamic>>> getComments(String postId) async {
    final result = await get('/social/posts/$postId/comments');
    return (result['data'] as List<dynamic>?)
            ?.cast<Map<String, dynamic>>() ??
        (result['items'] as List<dynamic>?)
                ?.cast<Map<String, dynamic>>() ??
            [];
  }

  Future<Map<String, dynamic>> addComment(
      String postId, String text, {String? parentId}) async {
    final body = <String, dynamic>{'text': text};
    if (parentId != null) body['parentId'] = parentId;
    return await post('/social/posts/$postId/comments', body: body);
  }

  Future<List<Map<String, dynamic>>> getReplies(
      String postId, String commentId) async {
    final result = await get('/social/posts/$postId/comments/$commentId/replies');
    return (result['data'] as List<dynamic>?)
            ?.cast<Map<String, dynamic>>() ??
        [];
  }

  Future<Map<String, dynamic>> toggleCommentLike(
      String postId, String commentId) async {
    return await post('/social/posts/$postId/comments/$commentId/like');
  }

  Future<Map<String, dynamic>> getStories() async {
    return await get('/social/stories/feed');
  }

  Future<Map<String, dynamic>> createStory(
      String mediaUrl, String mediaType) async {
    return await post('/social/stories',
        body: {'mediaUrl': mediaUrl, 'mediaType': mediaType});
  }

  /// Toggle follow/unfollow for a user. Returns { following: true/false }.
  Future<Map<String, dynamic>> toggleFollow(String userId) async {
    return await post('/social/users/$userId/follow');
  }

  /// Legacy alias for toggleFollow.
  Future<Map<String, dynamic>> followUser(String userId) async {
    return await toggleFollow(userId);
  }

  /// Get follow status for a specific user. Returns { following: true/false }.
  Future<bool> getFollowStatus(String userId) async {
    final result = await get('/follow/status/$userId');
    return (result['following'] as bool?) ?? false;
  }

  Future<List<Map<String, dynamic>>> getFollowers(String userId) async {
    final result = await get('/follow/$userId/followers');
    return (result['data'] as List<dynamic>?)
            ?.cast<Map<String, dynamic>>() ??
        (result['items'] as List<dynamic>?)
                ?.cast<Map<String, dynamic>>() ??
            [];
  }

  Future<List<Map<String, dynamic>>> getFollowing(String userId) async {
    final result = await get('/follow/$userId/following');
    return (result['data'] as List<dynamic>?)
            ?.cast<Map<String, dynamic>>() ??
        (result['items'] as List<dynamic>?)
                ?.cast<Map<String, dynamic>>() ??
            [];
  }

  /// Get follower/following counts for a user.
  /// Returns { followers: number, following: number }.
  Future<Map<String, int>> getFollowCounts(String userId) async {
    final results = await Future.wait([
      getFollowers(userId),
      getFollowing(userId),
    ]);
    final followers = results[0];
    final following = results[1];
    return {
      'followers': followers.length,
      'following': following.length,
    };
  }

  Future<Map<String, dynamic>> getMyPosts() async {
    return await get('/social/posts/my');
  }

  Future<Map<String, dynamic>> getSavedPosts() async {
    return await get('/social/posts/saved');
  }

  Future<Map<String, dynamic>> getPost(String postId) async {
    return await get('/social/posts/$postId');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HOME SCREEN
  // ═══════════════════════════════════════════════════════════════════════════

  Future<Map<String, dynamic>> getHomeBanner() async {
    return await get('/home/banner');
  }

  Future<List<Map<String, dynamic>>> getHomeNews({String? category}) async {
    final path =
        category != null ? '/home/news?category=$category' : '/home/news';
    final result = await get(path);
    return (result['data'] as List<dynamic>?)
            ?.cast<Map<String, dynamic>>() ??
        (result['items'] as List<dynamic>?)
                ?.cast<Map<String, dynamic>>() ??
            [];
  }

  Future<Map<String, dynamic>> getWeather() async {
    return await get('/home/weather');
  }

  Future<List<Map<String, dynamic>>> getActiveAlerts() async {
    final result = await get('/home/alerts');
    return (result['data'] as List<dynamic>?)
            ?.cast<Map<String, dynamic>>() ??
        (result['items'] as List<dynamic>?)
                ?.cast<Map<String, dynamic>>() ??
            [];
  }

  Future<List<Map<String, dynamic>>> getUtilityLinks(String category) async {
    final result = await get('/home/utility-links?category=$category&pageSize=50');
    return (result['data'] as List<dynamic>?)
            ?.cast<Map<String, dynamic>>() ??
        [];
  }

  Future<void> trackUtilityClick(String linkId) async {
    await post('/home/utility-links/$linkId/click', body: {});
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROFILE / KYC
  // ═══════════════════════════════════════════════════════════════════════════

  Future<Map<String, dynamic>> getBusinessKycStatus() async {
    return await get('/kyc/status');
  }

  Future<Map<String, dynamic>> upgradeToBusiness(Map<String, dynamic> body) async {
    return await post('/users/me/become-provider', body: body);
  }

  Future<Map<String, dynamic>> getTrustScore() async {
    return await get('/users/me/trust-score');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ORDERS / CUSTOMER DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════

  Future<Map<String, dynamic>> getCustomerStats() async {
    return await get('/orders/stats');
  }

  Future<Map<String, dynamic>> getActiveOrders() async {
    return await get('/orders/active');
  }

  Future<Map<String, dynamic>> getCompletedOrders() async {
    return await get('/orders/completed');
  }

  Future<Map<String, dynamic>> getOrderDetail(String orderId) async {
    return await get('/orders/$orderId');
  }

  /// Create a draft order — Phase 1 (Intent Capture)
  /// Body: { serviceCatalogId, entryPoint, description?, address?, scheduledAt?, ... }
  Future<Map<String, dynamic>> createDraftOrder(Map<String, dynamic> body) async {
    return await post('/orders/draft', body: body);
  }

  /// Submit a draft order — Phase 2 (triggers matching engine)
  Future<Map<String, dynamic>> submitDraftOrder(String orderId, Map<String, dynamic> body) async {
    return await post('/orders/$orderId/submit-draft', body: body);
  }

  /// Get eligible providers preview for a draft order
  Future<Map<String, dynamic>> getMatchedProviders(String orderId) async {
    return await get('/orders/$orderId/matched-providers');
  }

  /// Walk-in booking — Mode 5 (skip matching)
  /// Body: { providerId, serviceCatalogId, packageId?, description, addressId, urgency? }
  Future<Map<String, dynamic>> createWalkInOrder(Map<String, dynamic> body) async {
    return await post('/orders/walk-in', body: body);
  }

  Future<Map<String, dynamic>> getInbox() async {
    return await get('/chat/inbox');
  }

  Future<Map<String, dynamic>> getChatMessages(String chatId) async {
    return await get('/chat/$chatId/messages');
  }

  Future<Map<String, dynamic>> sendMessage(
      String chatId, String text) async {
    return await post('/chat/$chatId/messages', body: {'text': text});
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUSINESS PAGE (PUBLIC)
  // ═══════════════════════════════════════════════════════════════════════════

  Future<Map<String, dynamic>> getBusinessProfile(String businessId) async {
    return await get('/business-page/$businessId');
  }

  Future<List<Map<String, dynamic>>> getBusinessServices(
      String businessId) async {
    final result = await get('/business-page/$businessId/services');
    return (result['data'] as List<dynamic>?)
            ?.cast<Map<String, dynamic>>() ??
        (result['items'] as List<dynamic>?)
                ?.cast<Map<String, dynamic>>() ??
            [];
  }

  Future<List<Map<String, dynamic>>> getBusinessReviews(
      String businessId) async {
    final result = await get('/business-page/$businessId/reviews');
    return (result['data'] as List<dynamic>?)
            ?.cast<Map<String, dynamic>>() ??
        (result['items'] as List<dynamic>?)
                ?.cast<Map<String, dynamic>>() ??
            [];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPLORER (SEARCH / CATEGORIES)
  // ═══════════════════════════════════════════════════════════════════════════

  Future<Map<String, dynamic>> searchServices(String query) async {
    return await get('/services/search?q=$query');
  }

  Future<List<Map<String, dynamic>>> getServicesByCategory(String categoryId) async {
    final result = await get('/services?categoryId=$categoryId');
    return (result['data'] as List<dynamic>?)
            ?.cast<Map<String, dynamic>>() ??
        (result['items'] as List<dynamic>?)
                ?.cast<Map<String, dynamic>>() ??
            [];
  }

  Future<List<Map<String, dynamic>>> getCategories() async {
    final result = await get('/categories');
    return (result['data'] as List<dynamic>?)
            ?.cast<Map<String, dynamic>>() ??
        (result['items'] as List<dynamic>?)
                ?.cast<Map<String, dynamic>>() ??
            [];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NEWS / EVENTS
  // ═══════════════════════════════════════════════════════════════════════════

  Future<List<Map<String, dynamic>>> getNews() async {
    final result = await get('/news');
    return (result['data'] as List<dynamic>?)
            ?.cast<Map<String, dynamic>>() ??
        (result['items'] as List<dynamic>?)
                ?.cast<Map<String, dynamic>>() ??
            [];
  }

  Future<List<Map<String, dynamic>>> getEvents() async {
    final result = await get('/events');
    return (result['data'] as List<dynamic>?)
            ?.cast<Map<String, dynamic>>() ??
        (result['items'] as List<dynamic>?)
                ?.cast<Map<String, dynamic>>() ??
            [];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INTERNAL HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  Future<Map<String, dynamic>> _delete(String path) async {
    final uri = Uri.parse('$baseUrl$path');
    final response = await http.delete(uri, headers: _headers);
    return _handleResponse(response);
  }

  Future<Map<String, dynamic>> _patch(String path, {Map<String, dynamic>? body}) async {
    final uri = Uri.parse('$baseUrl$path');
    final response = await http.patch(
      uri,
      headers: _headers,
      body: body != null ? jsonEncode(body) : null,
    );
    return _handleResponse(response);
  }

  /// Validate a username for availability.
  /// Returns { available: bool, suggestion?: string }
  Future<Map<String, dynamic>> validateUsername(String username) async {
    return await get('/users/validate-username?username=${Uri.encodeQueryComponent(username)}');
  }

  /// Update the current user's username.
  /// Returns { success: bool, newUsername: string, oldUsername?: string }
  Future<Map<String, dynamic>> updateUsername(String username) async {
    return await _patch('/users/username', body: {'username': username});
  }

  /// Upload image bytes directly.
  Future<String> uploadImageBytes(String fileName, List<int> bytes) async {
    final uri = Uri.parse('$baseUrl/upload');
    final request = http.MultipartRequest('POST', uri);
    if (_accessToken != null) {
      request.headers['Authorization'] = 'Bearer $_accessToken';
    }
    request.files.add(http.MultipartFile.fromBytes('file', bytes, filename: fileName));
    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);
    final body = response.body.isNotEmpty ? jsonDecode(response.body) as Map<String, dynamic> : <String, dynamic>{};
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body['url'] as String? ?? body['path'] as String? ?? '';
    }
    throw ApiException(
      statusCode: response.statusCode,
      message: body['error'] as String? ?? 'Upload failed',
    );
  }
}

class ApiException implements Exception {
  final int statusCode;
  final String message;

  ApiException({required this.statusCode, required this.message});

  @override
  String toString() => 'ApiException($statusCode): $message';
}
