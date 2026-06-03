import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../widgets/status_bar.dart';
import '../widgets/bottom_nav.dart';
import '../widgets/service_search_delegate.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import '../cache/image_cache_config.dart';

/// Social Explorer screen — TAB 2 in the bottom nav.
/// Shows the General feed (all posts) and Business Hub (business posts + business listings).
/// Fetches real data from the same backend API that React uses.
class SocialScreen extends StatefulWidget {
  const SocialScreen({super.key});

  @override
  State<SocialScreen> createState() => _SocialScreenState();
}

class _SocialScreenState extends State<SocialScreen> {
  int _tabIndex = 0;
  bool _showBizTab = false;
  final ApiService _api = ApiService();
  final ScrollController _scrollController = ScrollController();

  // Feed state
  bool _loadingFeed = true;
  bool _loadingMore = false;
  bool _hasMore = true;
  int _currentPage = 1;
  List<Map<String, dynamic>> _posts = [];
  List<Map<String, dynamic>> _stories = [];
  String? _errorMessage;

  // Business listings state
  List<Map<String, dynamic>> _businesses = [];
  bool _loadingBiz = true;

  // Location
  String _currentLocation = 'Toronto, ON';
  String _neighbourhoodLocation = 'Toronto';
  bool _locationLoading = true;

  // Interaction state
  final Map<String, bool> _followStatus = {};
  final Set<String> _togglingFollow = {};
  final Map<String, bool> _likedPosts = {};
  final Map<String, bool> _savedPosts = {};
  final Set<String> _togglingLike = {};
  final Set<String> _togglingSave = {};

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _checkRole();
    _fetchCurrentLocation();
    _loadFeed();
    _loadStories();
    _loadBusinesses();
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
            _scrollController.position.maxScrollExtent - 200 &&
        !_loadingMore &&
        _hasMore &&
        !_loadingFeed) {
      _loadMore();
    }
  }

  Future<void> _checkRole() async {
    final role = await AuthService().getUserRole();
    if (role != null && role.toLowerCase() == 'provider') {
      setState(() => _showBizTab = true);
    }
  }

  Future<void> _fetchCurrentLocation() async {
    setState(() {
      _currentLocation = 'Toronto, ON';
      _neighbourhoodLocation = 'Toronto';
      _locationLoading = false;
    });
    try {
      final saved = await _api.getMyLocation();
      if (saved.isNotEmpty) {
        setState(() {
          _currentLocation = saved;
          _neighbourhoodLocation = saved;
        });
      }
    } catch (_) {}
  }

  Future<void> _loadFeed() async {
    setState(() {
      _loadingFeed = true;
      _errorMessage = null;
      _currentPage = 1;
    });

    try {
      final result = await _api.getFeedPosts(page: 1);
      final data = (result['data'] as List<dynamic>?)
              ?.cast<Map<String, dynamic>>() ??
          [];
      final total = result['total'] as int? ?? 0;
      setState(() {
        _posts = data;
        _hasMore = _posts.length < total;
        _loadingFeed = false;
      });
      _loadFollowStatuses(_posts);
      for (final p in _posts) {
        final pid = p['id'] as String? ?? '';
        final liked = p['isLiked'] as bool? ?? false;
        final saved = p['isSaved'] as bool? ?? false;
        if (pid.isNotEmpty) {
          _likedPosts[pid] = liked;
          _savedPosts[pid] = saved;
        }
      }
    } catch (e) {
      setState(() {
        _loadingFeed = false;
        _errorMessage = 'Could not load feed.\nCheck your connection and try again.';
      });
    }
  }

  Future<void> _loadMore() async {
    if (_loadingMore || !_hasMore) return;
    setState(() => _loadingMore = true);
    try {
      final nextPage = _currentPage + 1;
      final result = await _api.getFeedPosts(page: nextPage);
      final data = (result['data'] as List<dynamic>?)
              ?.cast<Map<String, dynamic>>() ??
          [];
      final total = result['total'] as int? ?? 0;
      setState(() {
        _currentPage = nextPage;
        _posts.addAll(data);
        _hasMore = _posts.length < total;
        _loadingMore = false;
      });
      _loadFollowStatuses(data);
    } catch (_) {
      setState(() => _loadingMore = false);
    }
  }

  Future<void> _loadStories() async {
    try {
      final result = await _api.getStories();
      final groups = (result['data'] as List<dynamic>?)
              ?.cast<Map<String, dynamic>>() ??
          [];
      final flat = <Map<String, dynamic>>[];
      for (final group in groups) {
        final author = group['author'] as Map<String, dynamic>? ?? {};
        flat.add({
          'id': author['id'] ?? '',
          'name': author['displayName'] ?? 'User',
          'initial':
              ((author['displayName'] ?? 'U') as String).characters.first.toUpperCase(),
          'seen': false,
          'avatarUrl': author['avatarUrl'],
        });
      }
      _stories = flat;
    } catch (_) {}
    setState(() {});
  }

  Future<void> _loadBusinesses() async {
    setState(() => _loadingBiz = true);
    try {
      // Fetch providers/businesses from the public API
      final feedResult = await _api.getFeedPosts(page: 1);
      final allPosts = (feedResult['data'] as List<dynamic>?)
              ?.cast<Map<String, dynamic>>() ??
          [];

      // Collect unique business authors from posts
      final seenIds = <String>{};
      final bizList = <Map<String, dynamic>>[];
      for (final post in allPosts) {
        final author = post['author'] as Map<String, dynamic>? ?? {};
        final authorId = author['id'] as String? ?? '';
        final isBiz = (post['isBusinessPost'] as bool?) ?? false;
        if (authorId.isNotEmpty && isBiz && !seenIds.contains(authorId)) {
          seenIds.add(authorId);
          bizList.add({
            'id': authorId,
            'name': author['displayName'] ?? 'Business',
            'avatarUrl': author['avatarUrl'],
            'slug': author['slug'] ?? authorId,
          });
        }
      }
      _businesses = bizList;
    } catch (_) {
      _businesses = [];
    }
    setState(() => _loadingBiz = false);
  }

  Future<void> _onRefresh() async {
    await _loadFeed();
    await _loadStories();
    await _loadBusinesses();
  }

  Future<void> _loadFollowStatuses(List<Map<String, dynamic>> posts) async {
    final authorIds = <String>[];
    for (final p in posts) {
      final author = p['author'] as Map<String, dynamic>? ?? {};
      final id = author['id'];
      if (id is String && id.isNotEmpty) {
        authorIds.add(id);
      }
    }
    final uniqueIds = authorIds.toSet().toList();
    for (final id in uniqueIds) {
      if (!_followStatus.containsKey(id)) {
        try {
          final isFollowing = await _api.getFollowStatus(id);
          if (mounted) {
            setState(() => _followStatus[id] = isFollowing);
          }
        } catch (_) {}
      }
    }
  }

  Future<void> _toggleLike(String postId) async {
    if (_togglingLike.contains(postId)) return;
    final prev = _likedPosts[postId] ?? false;
    setState(() {
      _likedPosts[postId] = !prev;
      _togglingLike.add(postId);
    });
    try {
      final result = await _api.toggleLike(postId);
      final liked = result['data']?['liked'] as bool? ?? !prev;
      if (mounted) setState(() => _likedPosts[postId] = liked);
    } catch (_) {
      if (mounted) setState(() => _likedPosts[postId] = prev);
    } finally {
      if (mounted) setState(() => _togglingLike.remove(postId));
    }
  }

  Future<void> _toggleSave(String postId) async {
    if (_togglingSave.contains(postId)) return;
    final prev = _savedPosts[postId] ?? false;
    setState(() {
      _savedPosts[postId] = !prev;
      _togglingSave.add(postId);
    });
    try {
      final result = await _api.toggleSave(postId);
      final saved = result['data']?['saved'] as bool? ?? !prev;
      if (mounted) setState(() => _savedPosts[postId] = saved);
    } catch (_) {
      if (mounted) setState(() => _savedPosts[postId] = prev);
    } finally {
      if (mounted) setState(() => _togglingSave.remove(postId));
    }
  }

  Future<void> _toggleFollow(String authorId) async {
    if (_togglingFollow.contains(authorId)) return;
    setState(() => _togglingFollow.add(authorId));
    try {
      final result = await _api.toggleFollow(authorId);
      final following = result['data']?['following'] as bool? ?? false;
      if (mounted) {
        setState(() => _followStatus[authorId] = following);
      }
    } catch (_) {} finally {
      if (mounted) setState(() => _togglingFollow.remove(authorId));
    }
  }

  /// Get filtered posts for the current tab
  List<Map<String, dynamic>> get _filteredPosts {
    if (_tabIndex == 1) {
      // Business Hub — show only business posts
      return _posts.where((p) => (p['isBusinessPost'] as bool?) ?? false).toList();
    }
    return _posts;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? AppColors.bg : AppColorsLight.bg;
    final text3 = isDark ? AppColors.text3 : AppColorsLight.text3;
    final border = isDark ? AppColors.border : AppColorsLight.border;

    return Stack(
      children: [
        Container(
          color: bg,
          child: Column(
            children: [
              const StatusBar(title: '9:41', showNotifDot: true),
              // Tabs: Explorer | Business Hub
              Container(
                decoration: BoxDecoration(
                  color: bg,
                  border: Border(bottom: BorderSide(color: border)),
                ),
                child: Row(
                  children: ['Explorer', 'Business Hub']
                      .asMap()
                      .entries
                      .map((e) {
                    final active = e.key == _tabIndex;
                    return Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() => _tabIndex = e.key),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          decoration: BoxDecoration(
                            border: Border(
                              bottom: BorderSide(
                                color: active ? AppColors.primary : Colors.transparent,
                                width: 2.5,
                              ),
                            ),
                          ),
                          child: Text(
                            e.value,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                              color: active ? AppColors.primary : text3,
                            ),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
              // Location bar
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 8, 14, 0),
                child: Row(
                  children: [
                    const Icon(Icons.location_on, size: 16, color: AppColors.primary),
                    const SizedBox(width: 6),
                    Text(
                      _locationLoading ? 'Detecting...' : _neighbourhoodLocation,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.primary,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      _locationLoading ? '' : _currentLocation,
                      style: const TextStyle(fontSize: 11, color: AppColors.text3),
                    ),
                  ],
                ),
              ),
              // Search
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 8, 14, 0),
                child: Row(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        onTap: () {
                          showSearch(
                            context: context,
                            delegate: ServiceSearchDelegate(),
                          );
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: AppColors.card,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: border),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.search, size: 14, color: AppColors.text3),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  _locationLoading
                                      ? 'Detecting location...'
                                      : 'Search in $_currentLocation...',
                                  style: const TextStyle(fontSize: 13, color: AppColors.text3),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: border),
                      ),
                      child: const Icon(Icons.filter_list, size: 16, color: AppColors.text2),
                    ),
                  ],
                ),
              ),
              // Stories row
              if (_tabIndex == 0)
                SizedBox(
                  height: _stories.isEmpty ? 0 : 90,
                  child: _stories.isEmpty
                      ? const SizedBox.shrink()
                      : ListView.builder(
                          scrollDirection: Axis.horizontal,
                          padding: const EdgeInsets.fromLTRB(14, 14, 14, 0),
                          itemCount: _stories.length,
                          itemBuilder: (ctx, i) {
                            final s = _stories[i];
                            return GestureDetector(
                              onTap: () => Navigator.pushNamed(
                                  context, '/explorer/story',
                                  arguments: s['id']),
                              child: Container(
                                width: 64,
                                margin: const EdgeInsets.only(right: 12),
                                child: Column(
                                  children: [
                                    Container(
                                      width: 58,
                                      height: 58,
                                      padding: const EdgeInsets.all(2),
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        gradient: const LinearGradient(
                                          colors: [AppColors.primary, AppColors.accent],
                                        ),
                                      ),
                                      child: Container(
                                        decoration: BoxDecoration(
                                          shape: BoxShape.circle,
                                          color: AppColors.card,
                                          border: Border.all(color: AppColors.bg2, width: 2),
                                        ),
                                        child: Center(
                                          child: Text(
                                            s['initial'] as String? ?? '?',
                                            style: const TextStyle(
                                              fontSize: 20,
                                              fontWeight: FontWeight.w700,
                                              color: AppColors.accent,
                                              fontFamily: 'Space Grotesk',
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      s['name'] as String? ?? '',
                                      style: const TextStyle(fontSize: 10, color: AppColors.text2),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                ),
              // Business Hub header
              if (_tabIndex == 1 && !_loadingBiz && _businesses.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.fromLTRB(14, 12, 14, 4),
                  child: Row(
                    children: [
                      const Icon(Icons.business, size: 16, color: AppColors.accent),
                      const SizedBox(width: 6),
                      Text(
                        '${_businesses.length} Businesses Near You',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.text,
                          fontFamily: 'Space Grotesk',
                        ),
                      ),
                    ],
                  ),
                ),
              // Business cards (Business Hub tab)
              if (_tabIndex == 1 && !_loadingBiz && _businesses.isNotEmpty)
                SizedBox(
                  height: 130,
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.fromLTRB(14, 8, 14, 8),
                    itemCount: _businesses.length,
                    itemBuilder: (ctx, i) {
                      final biz = _businesses[i];
                      return _businessCard(biz);
                    },
                  ),
                ),
              // Posts section label (Business Hub tab)
              if (_tabIndex == 1)
                Padding(
                  padding: const EdgeInsets.fromLTRB(14, 4, 14, 0),
                  child: Row(
                    children: [
                      const Icon(Icons.campaign, size: 16, color: AppColors.primary),
                      const SizedBox(width: 6),
                      const Text(
                        'Business Posts',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.text,
                          fontFamily: 'Space Grotesk',
                        ),
                      ),
                    ],
                  ),
                ),
              // Posts feed
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _onRefresh,
                  color: AppColors.primary,
                  child: _buildFeedList(),
                ),
              ),
            ],
          ),
        ),
        // Floating bottom nav
        Positioned(
          left: 0,
          right: 0,
          bottom: 24,
          child: BottomNav(
            showBizTab: _showBizTab,
            onItemTap: (id) {
              if (id == 'home') Navigator.pushReplacementNamed(context, '/home');
              if (id == 'social') Navigator.pushReplacementNamed(context, '/social');
              if (id == 'activity') Navigator.pushReplacementNamed(context, '/activity');
              if (id == 'biz') Navigator.pushReplacementNamed(context, '/dashboard');
            },
            items: const [
              BottomNavItem(id: 'home', label: 'Home', icon: Icons.home),
              BottomNavItem(id: 'social', label: 'Social', icon: Icons.people, active: true),
              BottomNavItem(id: 'activity', label: 'Activity', icon: Icons.auto_awesome_motion),
              BottomNavItem(id: 'biz', label: 'Business', icon: Icons.business, isBiz: true),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildFeedList() {
    if (_loadingFeed) {
      return ListView.builder(
        padding: EdgeInsets.zero,
        itemCount: 3,
        itemBuilder: (_, _) => _skeletonCard(),
      );
    }

    if (_errorMessage != null) {
      return ListView(
        padding: EdgeInsets.zero,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 40),
            child: Column(
              children: [
                const Text('😕', style: TextStyle(fontSize: 48)),
                const SizedBox(height: 12),
                Text(
                  _errorMessage!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 13, color: AppColors.text2),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: _onRefresh,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: const Text('Retry', style: TextStyle(fontWeight: FontWeight.w600)),
                ),
              ],
            ),
          ),
        ],
      );
    }

    final displayPosts = _filteredPosts;

    if (displayPosts.isEmpty) {
      return ListView(
        padding: EdgeInsets.zero,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 40),
            child: Column(
              children: [
                const Text('📍', style: TextStyle(fontSize: 48)),
                const SizedBox(height: 12),
                const Text(
                  'No content in your area',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text2),
                ),
                const SizedBox(height: 8),
                Text(
                  _tabIndex == 1
                      ? 'No business posts yet. Follow businesses to see their posts here!'
                      : 'Be the first to create a post in your neighbourhood!',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 12, color: AppColors.text3),
                ),
              ],
            ),
          ),
        ],
      );
    }

    return ListView.builder(
      controller: _scrollController,
      padding: EdgeInsets.zero,
      itemCount: displayPosts.length + (_hasMore ? 1 : 0),
      itemBuilder: (context, index) {
        if (index >= displayPosts.length) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 20),
            child: Center(
              child: SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
              ),
            ),
          );
        }
        return _postCard(displayPosts[index]);
      },
    );
  }

  Widget _businessCard(Map<String, dynamic> biz) {
    final name = biz['name'] as String? ?? 'Business';
    final avatarUrl = biz['avatarUrl'] as String?;
    final slug = biz['slug'] as String? ?? biz['id'] as String? ?? '';

    return GestureDetector(
      onTap: () => Navigator.pushNamed(context, '/business', arguments: slug),
      child: Container(
        width: 140,
        margin: const EdgeInsets.only(right: 12),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.accent.withValues(alpha: 0.15),
              ),
              child: avatarUrl != null
                  ? ClipOval(
                      child: CachedNetworkImage(
                        imageUrl: avatarUrl,
                        fit: BoxFit.cover,
                        cacheManager: ImageCacheConfig.manager,
                        errorWidget: (_, __, ___) => Center(
                          child: Text(
                            name.characters.first.toUpperCase(),
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w700,
                              color: AppColors.accent,
                              fontFamily: 'Space Grotesk',
                            ),
                          ),
                        ),
                      ),
                    )
                  : Center(
                      child: Text(
                        name.characters.first.toUpperCase(),
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w700,
                          color: AppColors.accent,
                          fontFamily: 'Space Grotesk',
                        ),
                      ),
                    ),
            ),
            const SizedBox(height: 8),
            Text(
              name,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.text),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 2),
            const Text(
              'View Profile',
              style: TextStyle(fontSize: 10, color: AppColors.primary),
            ),
          ],
        ),
      ),
    );
  }

  Widget _skeletonCard() {
    return Container(
      margin: const EdgeInsets.fromLTRB(14, 14, 14, 0),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.border2,
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        height: 12,
                        width: 140,
                        decoration: BoxDecoration(
                          color: AppColors.border2,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        height: 10,
                        width: 100,
                        decoration: BoxDecoration(
                          color: AppColors.border2,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Container(
            height: 180,
            decoration: BoxDecoration(
              color: AppColors.border2.withValues(alpha: 0.3),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  height: 12,
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 6),
                  decoration: BoxDecoration(
                    color: AppColors.border2,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                Container(
                  height: 12,
                  width: 200,
                  decoration: BoxDecoration(
                    color: AppColors.border2,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _postCard(Map<String, dynamic> post) {
    final author = post['author'] as Map<String, dynamic>? ?? {};
    final authorId = author['id'] as String? ?? '';
    final authorName = (author['displayName'] ?? 'User') as String;
    final authorInitial = authorName.characters.first.toUpperCase();
    final category = post['category'] as Map<String, dynamic>? ?? {};
    final categoryName = (category['name'] ?? 'General') as String;
    final caption = post['caption'] as String? ?? '';
    final likeCount = (post['likeCount'] ?? 0) as int;
    final commentCount = (post['commentCount'] ?? 0) as int;
    final media = (post['media'] as List<dynamic>?) ?? [];
    final hasImage = media.isNotEmpty;
    final createdAt = post['publishedAt'] ?? post['createdAt'] ?? '';
    final postId = post['id'] as String? ?? '';

    final timeAgo = _formatTimeAgo(createdAt is String ? createdAt : '');
    final isBusiness = (post['isBusinessPost'] as bool?) ?? false;
    final isFollowing = authorId.isNotEmpty ? (_followStatus[authorId] ?? false) : false;
    final isToggling = _togglingFollow.contains(authorId);
    final isLiked = _likedPosts[postId] ?? false;
    final isSaved = _savedPosts[postId] ?? false;
    final likeToggling = _togglingLike.contains(postId);
    final saveToggling = _togglingSave.contains(postId);

    return Container(
      margin: const EdgeInsets.fromLTRB(14, 14, 14, 0),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                GestureDetector(
                  onTap: () {
                    if (authorId.isNotEmpty) {
                      Navigator.pushNamed(context, '/business', arguments: authorId);
                    }
                  },
                  child: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: AppColors.accent,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Center(
                      child: Text(
                        authorInitial,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                          fontSize: 16,
                          fontFamily: 'Space Grotesk',
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: GestureDetector(
                              onTap: () {
                                if (authorId.isNotEmpty) {
                                  Navigator.pushNamed(context, '/business', arguments: authorId);
                                }
                              },
                              child: Text(
                                authorName,
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.text,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ),
                          if (isBusiness) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.accent.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text(
                                'BUSINESS',
                                style: TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.accent,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      Text(
                        '$categoryName · $timeAgo',
                        style: const TextStyle(fontSize: 11, color: AppColors.text3),
                      ),
                    ],
                  ),
                ),
                if (authorId.isNotEmpty)
                  GestureDetector(
                    onTap: () => _toggleFollow(authorId),
                    child: isToggling
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                          )
                        : Icon(
                            isFollowing ? Icons.person_remove : Icons.person_add,
                            size: 18,
                            color: isFollowing ? AppColors.red : AppColors.primary,
                          ),
                  ),
                if (authorId.isNotEmpty) const SizedBox(width: 8),
                GestureDetector(
                  onTap: () => Navigator.pushNamed(context, '/explorer/comments', arguments: postId),
                  child: const Text('···', style: TextStyle(fontSize: 20, color: AppColors.text3)),
                ),
              ],
            ),
          ),

          // Media
          if (hasImage)
            Container(
              height: 180,
              width: double.infinity,
              color: AppColors.border2.withValues(alpha: 0.2),
              child: _buildMedia(media.first as Map<String, dynamic>),
            ),

          // Caption
          if (caption.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$authorName ',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.text,
                    ),
                  ),
                  Expanded(
                    child: Text(
                      caption,
                      style: const TextStyle(fontSize: 13, color: AppColors.text, height: 1.6),
                    ),
                  ),
                ],
              ),
            ),

          // Action bar
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.only(top: 10),
                  decoration: const BoxDecoration(
                    border: Border(top: BorderSide(color: AppColors.border)),
                  ),
                  child: Row(
                    children: [
                      GestureDetector(
                        onTap: () => _toggleLike(postId),
                        child: likeToggling
                            ? const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                              )
                            : _interactiveActionItem(
                                isLiked ? Icons.favorite : Icons.favorite_border,
                                likeCount.toString(),
                                isLiked ? AppColors.red : AppColors.text3,
                              ),
                      ),
                      const SizedBox(width: 16),
                      GestureDetector(
                        onTap: () => Navigator.pushNamed(context, '/explorer/comments', arguments: postId),
                        child: _actionItem(Icons.chat_bubble_outline, commentCount.toString()),
                      ),
                      const SizedBox(width: 16),
                      GestureDetector(
                        onTap: () => _toggleSave(postId),
                        child: saveToggling
                            ? const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                              )
                            : _interactiveActionItem(
                                isSaved ? Icons.bookmark : Icons.bookmark_border,
                                '',
                                isSaved ? AppColors.warn : AppColors.text3,
                              ),
                      ),
                      const SizedBox(width: 16),
                      _actionItem(Icons.share, 'Share'),
                      const Spacer(),
                      if (authorId.isNotEmpty)
                        GestureDetector(
                          onTap: () => _toggleFollow(authorId),
                          child: isToggling
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                                )
                              : Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                  decoration: BoxDecoration(
                                    color: isFollowing
                                        ? AppColors.red.withValues(alpha: 0.1)
                                        : AppColors.primary.withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(6),
                                    border: Border.all(
                                      color: isFollowing
                                          ? AppColors.red.withValues(alpha: 0.3)
                                          : AppColors.primary.withValues(alpha: 0.3),
                                    ),
                                  ),
                                  child: Text(
                                    isFollowing ? 'Following' : 'Follow',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: isFollowing ? AppColors.red : AppColors.primary,
                                    ),
                                  ),
                                ),
                        ),
                      if (authorId.isNotEmpty) const SizedBox(width: 8),
                      GestureDetector(
                        onTap: () => Navigator.pushNamed(context, '/order/new'),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: AppColors.primary,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.shopping_bag, size: 12, color: Colors.white),
                              SizedBox(width: 4),
                              Text(
                                'Order Service',
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMedia(Map<String, dynamic> media) {
    final url = media['url'] as String? ?? '';
    if (url.isEmpty) {
      return const Center(child: Icon(Icons.image, size: 48, color: AppColors.text3));
    }
    return CachedNetworkImage(
      imageUrl: url,
      fit: BoxFit.cover,
      width: double.infinity,
      cacheManager: ImageCacheConfig.manager,
      placeholder: (context, url) => const Center(
        child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
      ),
      errorWidget: (context, url, error) => const Center(
        child: Icon(Icons.broken_image, size: 40, color: AppColors.text3),
      ),
    );
  }

  Widget _interactiveActionItem(IconData icon, String count, Color color) {
    return Row(
      children: [
        Icon(icon, size: 14, color: color),
        if (count.isNotEmpty) ...[
          const SizedBox(width: 5),
          Text(count, style: TextStyle(fontSize: 12, color: color)),
        ],
      ],
    );
  }

  Widget _actionItem(IconData icon, String count) {
    return Row(
      children: [
        Icon(icon, size: 14, color: AppColors.text3),
        const SizedBox(width: 5),
        Text(count, style: const TextStyle(fontSize: 12, color: AppColors.text3)),
      ],
    );
  }

  String _formatTimeAgo(String dateStr) {
    if (dateStr.isEmpty) return '';
    try {
      final dt = DateTime.parse(dateStr);
      final diff = DateTime.now().difference(dt);
      if (diff.inMinutes < 1) return 'just now';
      if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
      if (diff.inHours < 24) return '${diff.inHours}h ago';
      if (diff.inDays < 7) return '${diff.inDays}d ago';
      return '${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {
      return '';
    }
  }
}