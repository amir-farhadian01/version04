import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../theme/app_theme.dart';
import '../../providers/cache_provider.dart';
import '../../cache/cache_policy.dart';
import '../../services/api_service.dart';
import '../../widgets/service_search_delegate.dart';
import 'widgets/stories_row.dart';
import 'widgets/business_card.dart';
import 'widgets/post_card.dart';
import 'widgets/feed_skeleton.dart';

/// Canonical Feed Screen — merged from SocialScreen + ExplorerScreen.
///
/// Uses five-layer caching (CacheProvider + CachePolicy) from ExplorerScreen
/// and dynamic location loading from SocialScreen.
///
/// Tabs: Explorer (all posts + stories) | Business Hub (business posts + cards).
class FeedScreen extends StatefulWidget {
  const FeedScreen({super.key});

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  int _tabIndex = 0;
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

  // Business listings
  List<Map<String, dynamic>> _businesses = [];
  bool _loadingBiz = true;

  // Location (dynamic from SocialScreen)
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
    _fetchCurrentLocation();
    _loadFeed();
    _loadStories();
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  // ─── Infinite scroll ───
  void _onScroll() {
    if (_scrollController.position.pixels >=
            _scrollController.position.maxScrollExtent - 200 &&
        !_loadingMore &&
        _hasMore &&
        !_loadingFeed) {
      _loadMore();
    }
  }

  // ─── Location (dynamic, from SocialScreen) ───
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

  // ─── Feed loading (with five-layer caching from ExplorerScreen) ───
  Future<void> _loadFeed() async {
    setState(() {
      _loadingFeed = true;
      _errorMessage = null;
      _currentPage = 1;
    });

    try {
      final cache = context.read<CacheProvider>();
      final result = await cache.fetch(
        key: '/social/posts/feed?page=1',
        group: 'feed',
        ttl: CachePolicy.feedTtl,
        fetcher: () => _api.getFeedPosts(page: 1),
      );
      final data = (result.data['data'] as List<dynamic>?)
              ?.cast<Map<String, dynamic>>() ??
          [];
      final total = result.data['total'] as int? ?? 0;
      setState(() {
        _posts = data;
        _hasMore = _posts.length < total;
        _loadingFeed = false;
      });
      _loadFollowStatuses(_posts);
      _loadBusinesses();
      for (final p in _posts) {
        final pid = p['id'] as String? ?? '';
        if (pid.isNotEmpty) {
          _likedPosts[pid] = p['isLiked'] as bool? ?? false;
          _savedPosts[pid] = p['isSaved'] as bool? ?? false;
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

  // ─── Stories ───
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
          'initial': ((author['displayName'] ?? 'U') as String)
              .characters.first
              .toUpperCase(),
          'seen': false,
          'avatarUrl': author['avatarUrl'],
        });
      }
      _stories = flat;
    } catch (_) {}
    setState(() {});
  }

  // ─── Businesses (from posts) ───
  Future<void> _loadBusinesses() async {
    setState(() => _loadingBiz = true);
    try {
      final seenIds = <String>{};
      final bizList = <Map<String, dynamic>>[];
      for (final post in _posts) {
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

  // ─── Refresh ───
  Future<void> _onRefresh() async {
    // Clear cache for fresh data
    final cache = context.read<CacheProvider>();
    await cache.manager.removeGroup('feed');
    await _loadFeed();
    await _loadStories();
    await _loadBusinesses();
  }

  // ─── Filtered posts per tab ───
  List<Map<String, dynamic>> get _filteredPosts {
    if (_tabIndex == 1) {
      return _posts
          .where((p) => (p['isBusinessPost'] as bool?) ?? false)
          .toList();
    }
    return _posts;
  }

  // ─── Follow status batch ───
  Future<void> _loadFollowStatuses(List<Map<String, dynamic>> posts) async {
    final authorIds = <String>[];
    for (final p in posts) {
      final author = p['author'] as Map<String, dynamic>? ?? {};
      final id = author['id'];
      if (id is String && id.isNotEmpty) authorIds.add(id);
    }
    for (final id in authorIds.toSet()) {
      if (!_followStatus.containsKey(id)) {
        try {
          final isFollowing = await _api.getFollowStatus(id);
          if (mounted) setState(() => _followStatus[id] = isFollowing);
        } catch (_) {}
      }
    }
  }

  // ─── Interaction toggles ───
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
      if (mounted) setState(() => _followStatus[authorId] = following);
    } catch (_) {}
    finally {
      if (mounted) setState(() => _togglingFollow.remove(authorId));
    }
  }

  // ─── Build ───
  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? AppColors.bg : AppColorsLight.bg;
    final text3 = isDark ? AppColors.text3 : AppColorsLight.text3;
    final border = isDark ? AppColors.border : AppColorsLight.border;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Container(
        color: bg,
        child: Column(
          children: [
            // ── Tab bar ──
            _buildTabBar(bg, text3, border),
            // ── Location bar ──
            _buildLocationBar(),
            // ── Search + Filter ──
            _buildSearchBar(border),
            // ── Stories row (Explorer only) ──
            if (_tabIndex == 0)
              StoriesRow(
                stories: _stories,
                onAddStory: () => Navigator.pushNamed(context, '/create-story'),
              ),
            // ── Business Hub header + cards ──
            if (_tabIndex == 1) _buildBusinessSection(),
            // ── Posts feed ──
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
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          final created = await Navigator.pushNamed(context, '/create-post');
          if (created == true) _onRefresh();
        },
        backgroundColor: AppColors.primary,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }

  Widget _buildTabBar(Color bg, Color text3, Color border) {
    return Container(
      decoration: BoxDecoration(
        color: bg,
        border: Border(bottom: BorderSide(color: border)),
      ),
      child: Row(
        children: ['Explorer', 'Business Hub'].asMap().entries.map((e) {
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
    );
  }

  Widget _buildLocationBar() {
    return Padding(
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
    );
  }

  Widget _buildSearchBar(Color border) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 8, 14, 0),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () => showSearch(
                context: context,
                delegate: ServiceSearchDelegate(),
              ),
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
                        'Search in $_currentLocation...',
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
    );
  }

  Widget _buildBusinessSection() {
    if (_loadingBiz || _businesses.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
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
        SizedBox(
          height: 130,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(14, 8, 14, 8),
            itemCount: _businesses.length,
            itemBuilder: (_, i) => BusinessCard(business: _businesses[i]),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 4, 14, 0),
          child: const Row(
            children: [
              Icon(Icons.campaign, size: 16, color: AppColors.primary),
              SizedBox(width: 6),
              Text(
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
      ],
    );
  }

  Widget _buildFeedList() {
    if (_loadingFeed) {
      return ListView.builder(
        padding: EdgeInsets.zero,
        itemCount: 3,
        itemBuilder: (_, _) => const FeedSkeleton(),
      );
    }

    if (_errorMessage != null) {
      return ListView(
        padding: EdgeInsets.zero,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 40),
            child: _errorRetry(),
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
            child: _emptyState(),
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
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: AppColors.primary,
                ),
              ),
            ),
          );
        }

        final post = displayPosts[index];
        final postId = post['id'] as String? ?? '';
        final author = post['author'] as Map<String, dynamic>? ?? {};
        final authorId = author['id'] as String? ?? '';

        return PostCard(
          post: post,
          state: PostCardState(
            isLiked: _likedPosts[postId] ?? false,
            isSaved: _savedPosts[postId] ?? false,
            isFollowing: authorId.isNotEmpty
                ? (_followStatus[authorId] ?? false)
                : false,
            isTogglingLike: _togglingLike.contains(postId),
            isTogglingSave: _togglingSave.contains(postId),
            isTogglingFollow: _togglingFollow.contains(authorId),
          ),
          callbacks: PostCardCallbacks(
            onLike: () => _toggleLike(postId),
            onSave: () => _toggleSave(postId),
            onFollow: authorId.isNotEmpty ? () => _toggleFollow(authorId) : null,
            onComment: () => Navigator.pushNamed(
              context,
              '/comments',
              arguments: postId,
            ),
            onAuthorTap: authorId.isNotEmpty
                ? () => Navigator.pushNamed(
                      context,
                      '/business',
                      arguments: authorId,
                    )
                : null,
          ),
        );
      },
    );
  }

  Widget _errorRetry() {
    return Column(
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
    );
  }

  Widget _emptyState() {
    return Column(
      children: [
        const Text('📍', style: TextStyle(fontSize: 48)),
        const SizedBox(height: 12),
        const Text(
          'No content in your area',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: AppColors.text2,
          ),
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
    );
  }
}
