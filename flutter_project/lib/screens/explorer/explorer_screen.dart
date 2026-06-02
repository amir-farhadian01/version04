import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../theme/app_theme.dart';
import '../../providers/cache_provider.dart';
import '../../cache/cache_policy.dart';
import '../../cache/image_cache_config.dart';
import '../../services/api_service.dart';
import '../../widgets/service_search_delegate.dart';

/// Explorer tab (TAB 2) with General and Business sub-tabs.
///
/// Uses the five-layer caching system with pull-to-refresh and infinite scroll.
/// Images are cached via [ImageCacheConfig].
class ExplorerScreen extends StatefulWidget {
  const ExplorerScreen({super.key});

  @override
  State<ExplorerScreen> createState() => _ExplorerScreenState();
}

class _ExplorerScreenState extends State<ExplorerScreen> {
  int _tabIndex = 0;
  final ApiService _api = ApiService();
  final ScrollController _scrollController = ScrollController();

  bool _loadingFeed = true;
  bool _loadingMore = false;
  bool _hasMore = true;
  int _currentPage = 1;
  List<Map<String, dynamic>> _posts = [];
  List<Map<String, dynamic>> _stories = [];

  String? _errorMessage;

  /// Tracks follow status for each author ID. true = following.
  final Map<String, bool> _followStatus = {};
  /// Author IDs currently being toggled (to show loading state).
  final Set<String> _togglingFollow = {};

  final String _currentLocation = 'Vaughan, ON';
  final String _neighbourhoodLocation = 'Vaughan';

  /// Tracks like status for each post ID. true = liked.
  final Map<String, bool> _likedPosts = {};
  /// Tracks save status for each post ID. true = saved.
  final Map<String, bool> _savedPosts = {};
  /// Posts currently being toggled (to show loading state).
  final Set<String> _togglingLike = {};
  final Set<String> _togglingSave = {};

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _loadFeed();
    _loadStories();
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

  Future<void> _loadFeed() async {
    setState(() {
      _loadingFeed = true;
      _errorMessage = null;
      _currentPage = 1;
    });

    final cache = context.read<CacheProvider>();

    try {
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
      // Batch-load follow statuses after feed loads
      _loadFollowStatuses(_posts);
      // Populate like/save state from feed data
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
        _errorMessage =
            'Could not load feed.\nCheck your connection and try again.';
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
      // Batch-load follow statuses for new posts
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
    } catch (_) {
      // Keep empty — fallback
    }
    setState(() {});
  }

  Future<void> _onRefresh() async {
    await _loadFeed();
    await _loadStories();
  }

  /// Batch-check follow status for all visible post authors.
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
        } catch (_) {
          // Silently ignore — UI just won't show follow state
        }
      }
    }
  }

  /// Toggle like/unlike with optimistic update
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

  /// Toggle save/unsave with optimistic update
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

  /// Toggle follow/unfollow for an author.
  Future<void> _toggleFollow(String authorId) async {
    if (_togglingFollow.contains(authorId)) return;
    setState(() => _togglingFollow.add(authorId));
    try {
      final result = await _api.toggleFollow(authorId);
      final following = result['data']?['following'] as bool? ?? false;
      if (mounted) {
        setState(() => _followStatus[authorId] = following);
      }
    } catch (_) {
      // Silently ignore toggle failures
    } finally {
      if (mounted) {
        setState(() => _togglingFollow.remove(authorId));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? AppColors.bg : AppColorsLight.bg;
    final text3 = isDark ? AppColors.text3 : AppColorsLight.text3;
    final border = isDark ? AppColors.border : AppColorsLight.border;

    return Container(
      color: bg,
      child: Column(
        children: [
          // Tab bar: General | Business
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
                            color:
                                active ? AppColors.primary : Colors.transparent,
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
                const Icon(Icons.location_on,
                    size: 16, color: AppColors.primary),
                const SizedBox(width: 6),
                Text(
                  _neighbourhoodLocation,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.primary,
                  ),
                ),
                const Spacer(),
                Text(
                  _currentLocation,
                  style: const TextStyle(fontSize: 11, color: AppColors.text3),
                ),
              ],
            ),
          ),

          // Search + Filter bar
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
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: border),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.search,
                              size: 14, color: AppColors.text3),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Search in $_currentLocation...',
                              style: const TextStyle(
                                  fontSize: 13, color: AppColors.text3),
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
                  child: const Icon(Icons.filter_list,
                      size: 16, color: AppColors.text2),
                ),
              ],
            ),
          ),

          // Stories row — horizontal ListView.builder for performance
          SizedBox(
            height: 90,
            child: _stories.isEmpty
                ? const SizedBox.shrink()
                : ListView.builder(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.fromLTRB(14, 14, 14, 0),
                    itemCount: _stories.length,
                    itemBuilder: (ctx, i) {
                      final s = _stories[i];
                      final seen = s['seen'] as bool? ?? false;
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
                                  gradient: seen
                                      ? null
                                      : const LinearGradient(
                                          colors: [
                                            AppColors.primary,
                                            AppColors.accent
                                          ],
                                        ),
                                  color:
                                      seen ? AppColors.border2 : null,
                                ),
                                child: Container(
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: AppColors.card,
                                    border: Border.all(
                                        color: AppColors.bg2, width: 2),
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
                                style: const TextStyle(
                                    fontSize: 10,
                                    color: AppColors.text2),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),

          // Posts feed with pull-to-refresh and infinite scroll
          Expanded(
            child: RefreshIndicator(
              onRefresh: _onRefresh,
              color: AppColors.primary,
              child: _buildFeedList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFeedList() {
    // Initial loading — skeleton cards
    if (_loadingFeed) {
      return ListView.builder(
        padding: EdgeInsets.zero,
        itemCount: 3,
        itemBuilder: (_, _) => _skeletonCard(),
      );
    }

    // Error state
    if (_errorMessage != null) {
      return ListView(
        padding: EdgeInsets.zero,
        children: [
          Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 40),
            child: Column(
              children: [
                const Text('😕', style: TextStyle(fontSize: 48)),
                const SizedBox(height: 12),
                Text(
                  _errorMessage!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.text2,
                  ),
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
                  child: const Text('Retry',
                      style: TextStyle(fontWeight: FontWeight.w600)),
                ),
              ],
            ),
          ),
        ],
      );
    }

    // Empty state
    if (_posts.isEmpty) {
      return ListView(
        padding: EdgeInsets.zero,
        children: [
          Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 40),
            child: Column(
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
                const Text(
                  'Be the first to create a post in your neighbourhood!',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 12, color: AppColors.text3),
                ),
              ],
            ),
          ),
        ],
      );
    }

    // Posts list with infinite scroll — GridView.builder approach for
    // masonry-like feel, or ListView.builder for single-column feed.
    return ListView.builder(
      controller: _scrollController,
      padding: EdgeInsets.zero,
      itemCount: _posts.length + (_hasMore ? 1 : 0),
      itemBuilder: (context, index) {
        if (index >= _posts.length) {
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
        return _postCard(_posts[index]);
      },
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
                Container(
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
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
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
                          if (isBusiness) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 5, vertical: 2),
                              decoration: BoxDecoration(
                                color:
                                    AppColors.accent.withValues(alpha: 0.15),
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
                        style: const TextStyle(
                            fontSize: 11, color: AppColors.text3),
                      ),
                    ],
                  ),
                ),
                // Follow/Unfollow button
                if (authorId.isNotEmpty)
                  GestureDetector(
                    onTap: () => _toggleFollow(authorId),
                    child: isToggling
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: AppColors.primary,
                            ),
                          )
                        : Icon(
                            isFollowing ? Icons.person_remove : Icons.person_add,
                            size: 18,
                            color: isFollowing ? AppColors.red : AppColors.primary,
                          ),
                  ),
                if (authorId.isNotEmpty) const SizedBox(width: 8),
                GestureDetector(
                  onTap: () => Navigator.pushNamed(
                      context, '/explorer/comments',
                      arguments: postId),
                  child: const Text(
                    '···',
                    style: TextStyle(fontSize: 20, color: AppColors.text3),
                  ),
                ),
              ],
            ),
          ),

          // Media — cached via ImageCacheConfig
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
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.text,
                        height: 1.6,
                      ),
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
                    border:
                        Border(top: BorderSide(color: AppColors.border)),
                  ),
                  child: Row(
                    children: [
                      // Like button
                      GestureDetector(
                        onTap: () => _toggleLike(postId),
                        child: likeToggling
                            ? const SizedBox(
                                width: 14, height: 14,
                                child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                              )
                            : _interactiveActionItem(
                                isLiked ? Icons.favorite : Icons.favorite_border,
                                likeCount.toString(),
                                isLiked ? AppColors.red : AppColors.text3,
                              ),
                      ),
                      const SizedBox(width: 16),
                      // Comment button
                      GestureDetector(
                        onTap: () => Navigator.pushNamed(
                            context, '/explorer/comments',
                            arguments: post['id']),
                        child: _actionItem(Icons.chat_bubble_outline,
                            commentCount.toString()),
                      ),
                      const SizedBox(width: 16),
                      // Save button
                      GestureDetector(
                        onTap: () => _toggleSave(postId),
                        child: saveToggling
                            ? const SizedBox(
                                width: 14, height: 14,
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
                      // Follow/unfollow action button in action bar
                      if (authorId.isNotEmpty)
                        GestureDetector(
                          onTap: () => _toggleFollow(authorId),
                          child: isToggling
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: AppColors.primary,
                                  ),
                                )
                              : Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 10, vertical: 5),
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
                                      color: isFollowing
                                          ? AppColors.red
                                          : AppColors.primary,
                                    ),
                                  ),
                                ),
                        ),
                      if (authorId.isNotEmpty) const SizedBox(width: 8),
                      GestureDetector(
                        onTap: () =>
                            Navigator.pushNamed(context, '/order/new'),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: AppColors.primary,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.shopping_bag,
                                  size: 12, color: Colors.white),
                              SizedBox(width: 4),
                              Text(
                                'Order Service',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white,
                                ),
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
      return const Center(
          child: Icon(Icons.image, size: 48, color: AppColors.text3));
    }
    return CachedNetworkImage(
      imageUrl: url,
      fit: BoxFit.cover,
      width: double.infinity,
      cacheManager: ImageCacheConfig.manager,
      placeholder: (context, url) => const Center(
        child: CircularProgressIndicator(
          strokeWidth: 2,
          color: AppColors.primary,
        ),
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
          Text(count,
              style: TextStyle(fontSize: 12, color: color)),
        ],
      ],
    );
  }

  Widget _actionItem(IconData icon, String count) {
    return Row(
      children: [
        Icon(icon, size: 14, color: AppColors.text3),
        const SizedBox(width: 5),
        Text(count,
            style:
                const TextStyle(fontSize: 12, color: AppColors.text3)),
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