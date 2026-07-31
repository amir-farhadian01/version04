import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../../theme/app_theme.dart';
import '../../../cache/image_cache_config.dart';

/// Callbacks for post card interactions.
class PostCardCallbacks {
  final VoidCallback? onLike;
  final VoidCallback? onSave;
  final VoidCallback? onFollow;
  final VoidCallback? onComment;
  final VoidCallback? onAuthorTap;

  const PostCardCallbacks({
    this.onLike,
    this.onSave,
    this.onFollow,
    this.onComment,
    this.onAuthorTap,
  });
}

/// Interaction state for a single post card.
class PostCardState {
  final bool isLiked;
  final bool isSaved;
  final bool isFollowing;
  final bool isTogglingLike;
  final bool isTogglingSave;
  final bool isTogglingFollow;

  const PostCardState({
    this.isLiked = false,
    this.isSaved = false,
    this.isFollowing = false,
    this.isTogglingLike = false,
    this.isTogglingSave = false,
    this.isTogglingFollow = false,
  });
}

/// A single post card in the feed with author info, media, caption, and action bar.
class PostCard extends StatelessWidget {
  final Map<String, dynamic> post;
  final PostCardState state;
  final PostCardCallbacks callbacks;

  const PostCard({
    super.key,
    required this.post,
    required this.state,
    required this.callbacks,
  });

  @override
  Widget build(BuildContext context) {
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

    return Container(
      margin: const EdgeInsets.fromLTRB(14, 14, 14, 0),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          _buildHeader(
            context,
            authorName,
            authorInitial,
            authorId,
            categoryName,
            timeAgo,
            isBusiness,
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
          _buildActionBar(context, postId, authorId, likeCount, commentCount),
        ],
      ),
    );
  }

  Widget _buildHeader(
    BuildContext context,
    String authorName,
    String authorInitial,
    String authorId,
    String categoryName,
    String timeAgo,
    bool isBusiness,
  ) {
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          GestureDetector(
            onTap: callbacks.onAuthorTap ??
                (authorId.isNotEmpty
                    ? () => Navigator.pushNamed(context, '/business', arguments: authorId)
                    : null),
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
                        onTap: authorId.isNotEmpty
                            ? () => Navigator.pushNamed(context, '/business', arguments: authorId)
                            : null,
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
          // Follow/Unfollow button in header
          if (authorId.isNotEmpty)
            GestureDetector(
              onTap: callbacks.onFollow,
              child: state.isTogglingFollow
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.primary,
                      ),
                    )
                  : Icon(
                      state.isFollowing ? Icons.person_remove : Icons.person_add,
                      size: 18,
                      color: state.isFollowing ? AppColors.red : AppColors.primary,
                    ),
            ),
          if (authorId.isNotEmpty) const SizedBox(width: 8),
          GestureDetector(
            onTap: callbacks.onComment,
            child: const Text('···', style: TextStyle(fontSize: 20, color: AppColors.text3)),
          ),
        ],
      ),
    );
  }

  Widget _buildActionBar(BuildContext context, String postId, String authorId, int likeCount, int commentCount) {
    return Padding(
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
                // Like button
                GestureDetector(
                  onTap: callbacks.onLike,
                  child: state.isTogglingLike
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.primary,
                          ),
                        )
                      : _interactiveActionItem(
                          state.isLiked ? Icons.favorite : Icons.favorite_border,
                          likeCount.toString(),
                          state.isLiked ? AppColors.red : AppColors.text3,
                        ),
                ),
                const SizedBox(width: 16),
                // Comment button
                GestureDetector(
                  onTap: callbacks.onComment,
                  child: _actionItem(Icons.chat_bubble_outline, commentCount.toString()),
                ),
                const SizedBox(width: 16),
                // Save button
                GestureDetector(
                  onTap: callbacks.onSave,
                  child: state.isTogglingSave
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.primary,
                          ),
                        )
                      : _interactiveActionItem(
                          state.isSaved ? Icons.bookmark : Icons.bookmark_border,
                          '',
                          state.isSaved ? AppColors.warn : AppColors.text3,
                        ),
                ),
                const SizedBox(width: 16),
                _actionItem(Icons.share, 'Share'),
                const Spacer(),
                // Follow/unfollow action button in action bar
                if (authorId.isNotEmpty)
                  GestureDetector(
                    onTap: callbacks.onFollow,
                    child: state.isTogglingFollow
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: AppColors.primary,
                            ),
                          )
                        : Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: state.isFollowing
                                  ? AppColors.red.withValues(alpha: 0.1)
                                  : AppColors.primary.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(
                                color: state.isFollowing
                                    ? AppColors.red.withValues(alpha: 0.3)
                                    : AppColors.primary.withValues(alpha: 0.3),
                              ),
                            ),
                            child: Text(
                              state.isFollowing ? 'Following' : 'Follow',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: state.isFollowing ? AppColors.red : AppColors.primary,
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
