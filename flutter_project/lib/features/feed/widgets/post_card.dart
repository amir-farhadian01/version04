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
  final VoidCallback? onBookNow;
  final void Function(String action)? onMenuAction;

  const PostCardCallbacks({
    this.onLike,
    this.onSave,
    this.onFollow,
    this.onComment,
    this.onAuthorTap,
    this.onBookNow,
    this.onMenuAction,
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

/// Instagram-style post card with double-tap like animation,
/// comment sheet, save/bookmark, and Book Now CTA for business posts.
class PostCard extends StatefulWidget {
  final Map<String, dynamic> post;
  final PostCardState state;
  final PostCardCallbacks callbacks;
  // For comment sheet
  final List<Map<String, dynamic>> comments;
  final bool isLoadingComments;
  final VoidCallback? onLoadComments;
  final void Function(String text)? onSubmitComment;

  const PostCard({
    super.key,
    required this.post,
    required this.state,
    required this.callbacks,
    this.comments = const [],
    this.isLoadingComments = false,
    this.onLoadComments,
    this.onSubmitComment,
  });

  @override
  State<PostCard> createState() => _PostCardState();
}

class _PostCardState extends State<PostCard> with TickerProviderStateMixin {
  bool _showHeart = false;
  late AnimationController _heartFadeController;
  late AnimationController _heartScaleController;
  final TextEditingController _commentController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _heartFadeController = AnimationController(
      duration: const Duration(milliseconds: 900),
      vsync: this,
    );
    _heartScaleController = AnimationController(
      duration: const Duration(milliseconds: 400),
      vsync: this,
    );
  }

  @override
  void dispose() {
    _heartFadeController.dispose();
    _heartScaleController.dispose();
    _commentController.dispose();
    super.dispose();
  }

  void _triggerDoubleTapLike() {
    if (widget.state.isLiked || widget.state.isTogglingLike) return;

    setState(() => _showHeart = true);
    _heartScaleController.forward(from: 0.0);
    _heartFadeController.forward(from: 0.0);

    widget.callbacks.onLike?.call();

    Future.delayed(const Duration(milliseconds: 900), () {
      if (mounted) setState(() => _showHeart = false);
    });
  }

  void _showCommentSheet() {
    widget.onLoadComments?.call();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.bg2,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _buildCommentSheet(ctx),
    );
  }

  void _showPostMenu() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.bg2,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _buildPostMenu(ctx),
    );
  }

  @override
  Widget build(BuildContext context) {
    final author = widget.post['author'] as Map<String, dynamic>? ?? {};
    final authorId = author['id'] as String? ?? '';
    final authorName = (author['displayName'] ?? 'User') as String;
    final authorInitial = authorName.characters.first.toUpperCase();
    final avatarUrl = author['avatarUrl'] as String?;
    final category = widget.post['category'] as Map<String, dynamic>? ?? {};
    final categoryName = (category['name'] ?? 'General') as String;
    final caption = widget.post['caption'] as String? ?? '';
    final likeCount = (widget.post['likeCount'] ?? 0) as int;
    final commentCount = (widget.post['commentCount'] ?? 0) as int;
    final saveCount = (widget.post['saveCount'] ?? 0) as int;
    final media = (widget.post['media'] as List<dynamic>?) ?? [];
    final hasImage = media.isNotEmpty;
    final createdAt = widget.post['publishedAt'] ?? widget.post['createdAt'] ?? '';
    final postId = widget.post['id'] as String? ?? '';
    final timeAgo = _formatTimeAgo(createdAt is String ? createdAt : '');
    final isBusiness = (widget.post['isBusinessPost'] as bool?) ?? false;
    final linkedServiceId = widget.post['serviceCatalogId'] as String?;
    final isOwnPost = authorId == _currentUserId();

    return Stack(
      children: [
        Container(
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
                context, authorName, authorInitial, avatarUrl,
                authorId, categoryName, timeAgo, isBusiness, isOwnPost,
              ),

              // Media with double-tap
              if (hasImage)
                GestureDetector(
                  onDoubleTap: _triggerDoubleTapLike,
                  child: Container(
                    height: 240,
                    width: double.infinity,
                    color: AppColors.border2.withValues(alpha: 0.2),
                    child: _buildMedia(media.first as Map<String, dynamic>),
                  ),
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

              // Book Now CTA for business posts
              if (isBusiness && linkedServiceId != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
                  child: SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: widget.callbacks.onBookNow,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFFF7A2B),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.calendar_today, size: 16),
                          SizedBox(width: 8),
                          Text(
                            'Book Now',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),

              // Action bar
              _buildActionBar(context, postId, authorId, likeCount, commentCount, saveCount),
            ],
          ),
        ),

        // Double-tap heart animation overlay
        if (_showHeart)
          Positioned.fill(
            child: IgnorePointer(
              child: Center(
                child: AnimatedBuilder(
                  animation: Listenable.merge([_heartScaleController, _heartFadeController]),
                  builder: (context, child) {
                    final scale = 0.5 + (_heartScaleController.value * 0.7);
                    final opacity = 1.0 - _heartFadeController.value;
                    // Pulse: grow then shrink
                    final pulseScale = _heartScaleController.value < 0.5
                        ? 0.5 + (_heartScaleController.value * 1.0)
                        : 1.5 - (_heartScaleController.value * 1.0);
                    return Opacity(
                      opacity: opacity.clamp(0.0, 1.0),
                      child: Transform.scale(
                        scale: _heartScaleController.value < 0.5 ? pulseScale : 1.0,
                        child: const Icon(
                          Icons.favorite,
                          color: Colors.white,
                          size: 80,
                          shadows: [
                            Shadow(color: Colors.black26, blurRadius: 12),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildHeader(
    BuildContext context,
    String authorName,
    String authorInitial,
    String? avatarUrl,
    String authorId,
    String categoryName,
    String timeAgo,
    bool isBusiness,
    bool isOwnPost,
  ) {
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          // Avatar
          GestureDetector(
            onTap: () {
              if (widget.callbacks.onAuthorTap != null) {
                widget.callbacks.onAuthorTap!();
              }
            },
            child: CircleAvatar(
              radius: 16,
              backgroundColor: AppColors.border2,
              backgroundImage: avatarUrl != null && avatarUrl.isNotEmpty
                  ? CachedNetworkImageProvider(avatarUrl)
                  : null,
              child: avatarUrl == null || avatarUrl.isEmpty
                  ? Text(
                      authorInitial,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.accent,
                      ),
                    )
                  : null,
            ),
          ),
          const SizedBox(width: 10),
          // Author + meta
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                GestureDetector(
                  onTap: widget.callbacks.onAuthorTap,
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
                const SizedBox(height: 2),
                Row(
                  children: [
                    Text(
                      categoryName,
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.primary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    if (isBusiness) ...[
                      const SizedBox(width: 4),
                      const Icon(Icons.verified, size: 12, color: AppColors.primary),
                    ],
                    const SizedBox(width: 6),
                    Text(
                      timeAgo,
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.text3,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          // Three-dot menu
          GestureDetector(
            onTap: _showPostMenu,
            child: const Icon(Icons.more_horiz, color: AppColors.text2, size: 20),
          ),
        ],
      ),
    );
  }

  Widget _buildMedia(Map<String, dynamic> mediaItem) {
    final type = mediaItem['type'] as String? ?? 'image';
    final url = mediaItem['url'] as String? ?? '';
    if (url.isEmpty) return const SizedBox.shrink();

    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: CachedNetworkImage(
        imageUrl: url,
        fit: BoxFit.cover,
        width: double.infinity,
        height: double.infinity,
        memCacheWidth: ImageCacheConfig.postMediaCacheWidth,
        placeholder: (_, __) => Container(
          color: AppColors.border2.withValues(alpha: 0.1),
          child: const Center(
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: AppColors.primary,
            ),
          ),
        ),
        errorWidget: (_, __, ___) => Container(
          color: AppColors.border2.withValues(alpha: 0.1),
          child: const Center(
            child: Icon(Icons.broken_image_outlined, color: AppColors.text3, size: 32),
          ),
        ),
      ),
    );
  }

  Widget _buildActionBar(
    BuildContext context,
    String postId,
    String authorId,
    int likeCount,
    int commentCount,
    int saveCount,
  ) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
      child: Row(
        children: [
          // Like
          _buildActionButton(
            icon: widget.state.isLiked ? Icons.favorite : Icons.favorite_outline,
            color: widget.state.isLiked ? AppColors.red : AppColors.text2,
            count: likeCount,
            isLoading: widget.state.isTogglingLike,
            onTap: widget.callbacks.onLike,
          ),
          const SizedBox(width: 16),
          // Comment
          _buildActionButton(
            icon: Icons.chat_bubble_outline,
            color: AppColors.text2,
            count: commentCount,
            isLoading: false,
            onTap: _showCommentSheet,
          ),
          const SizedBox(width: 16),
          // Save / Bookmark
          _buildActionButton(
            icon: widget.state.isSaved ? Icons.bookmark : Icons.bookmark_outline,
            color: widget.state.isSaved ? AppColors.accent : AppColors.text2,
            count: saveCount,
            isLoading: widget.state.isTogglingSave,
            onTap: widget.callbacks.onSave,
          ),
          const Spacer(),
          // Order CTA for business (compact)
          if ((widget.post['isBusinessPost'] as bool?) == true &&
              widget.post['serviceCatalogId'] != null)
            GestureDetector(
              onTap: widget.callbacks.onBookNow,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFFF7A2B), Color(0xFFFF5722)],
                  ),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  'Book Now',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required Color color,
    required int count,
    required bool isLoading,
    VoidCallback? onTap,
  }) {
    return GestureDetector(
      onTap: isLoading ? null : onTap,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          isLoading
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.text3,
                  ),
                )
              : Icon(icon, size: 20, color: color),
          const SizedBox(width: 4),
          if (count > 0)
            Text(
              _formatCount(count),
              style: TextStyle(
                fontSize: 12,
                color: color,
                fontWeight: FontWeight.w500,
              ),
            ),
        ],
      ),
    );
  }

  // ── Comment Sheet ──
  Widget _buildCommentSheet(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      minChildSize: 0.3,
      maxChildSize: 0.9,
      expand: false,
      builder: (ctx, scrollController) {
        return Column(
          children: [
            // Handle bar
            Container(
              margin: const EdgeInsets.symmetric(vertical: 12),
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.text3,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            // Title
            const Padding(
              padding: EdgeInsets.only(bottom: 8),
              child: Text(
                'Comments',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.text,
                ),
              ),
            ),
            const Divider(color: AppColors.border, height: 1),
            // Comments list
            Expanded(
              child: widget.isLoadingComments
                  ? const Center(
                      child: CircularProgressIndicator(color: AppColors.primary),
                    )
                  : widget.comments.isEmpty
                      ? const Center(
                          child: Text(
                            'No comments yet.\nBe the first to comment!',
                            style: TextStyle(color: AppColors.text3, fontSize: 13),
                            textAlign: TextAlign.center,
                          ),
                        )
                      : ListView.builder(
                          controller: scrollController,
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          itemCount: widget.comments.length,
                          itemBuilder: (ctx, i) {
                            final comment = widget.comments[i];
                            final commentAuthor = comment['author'] as Map<String, dynamic>? ?? {};
                            final commentAuthorName = (commentAuthor['displayName'] ?? 'User') as String;
                            final commentText = comment['text'] as String? ?? '';
                            final commentAvatar = commentAuthor['avatarUrl'] as String?;
                            final commentTime = comment['createdAt'] as String? ?? '';
                            return Padding(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  CircleAvatar(
                                    radius: 14,
                                    backgroundColor: AppColors.border2,
                                    backgroundImage: commentAvatar != null
                                        ? CachedNetworkImageProvider(commentAvatar)
                                        : null,
                                    child: commentAvatar == null
                                        ? Text(
                                            commentAuthorName.characters.first.toUpperCase(),
                                            style: const TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w600,
                                              color: AppColors.accent,
                                            ),
                                          )
                                        : null,
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        RichText(
                                          text: TextSpan(
                                            style: const TextStyle(
                                              fontSize: 13,
                                              color: AppColors.text,
                                            ),
                                            children: [
                                              TextSpan(
                                                text: commentAuthorName,
                                                style: const TextStyle(
                                                  fontWeight: FontWeight.w600,
                                                ),
                                              ),
                                              const TextSpan(text: ' '),
                                              TextSpan(text: commentText),
                                            ],
                                          ),
                                        ),
                                        if (commentTime.isNotEmpty)
                                          Text(
                                            _formatTimeAgo(commentTime),
                                            style: const TextStyle(
                                              fontSize: 11,
                                              color: AppColors.text3,
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
            ),
            const Divider(color: AppColors.border, height: 1),
            // Comment input
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 16),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _commentController,
                      style: const TextStyle(color: AppColors.text, fontSize: 14),
                      decoration: InputDecoration(
                        hintText: 'Add a comment...',
                        hintStyle: const TextStyle(color: AppColors.text3, fontSize: 14),
                        filled: true,
                        fillColor: AppColors.card,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                          borderSide: BorderSide.none,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: () {
                      final text = _commentController.text.trim();
                      if (text.isNotEmpty) {
                        widget.onSubmitComment?.call(text);
                        _commentController.clear();
                      }
                    },
                    child: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(
                          colors: [AppColors.primary, AppColors.purple],
                        ),
                      ),
                      child: const Icon(
                        Icons.send_rounded,
                        color: Colors.white,
                        size: 18,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  // ── Post Menu (Report, Block, Edit, Delete) ──
  Widget _buildPostMenu(BuildContext context) {
    final isOwnPost = (widget.post['author'] as Map<String, dynamic>?)?['id'] == _currentUserId();
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 12),
          // Handle
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.text3,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 16),

          if (isOwnPost) ...[
            _buildMenuOption(Icons.edit_outlined, 'Edit Post', () {
              Navigator.pop(context);
              widget.callbacks.onMenuAction?.call('edit');
            }),
            _buildMenuOption(Icons.delete_outline, 'Delete', () {
              Navigator.pop(context);
              widget.callbacks.onMenuAction?.call('delete');
            }),
            _buildMenuOption(Icons.archive_outlined, 'Archive', () {
              Navigator.pop(context);
              widget.callbacks.onMenuAction?.call('archive');
            }),
          ] else ...[
            _buildMenuOption(Icons.flag_outlined, 'Report', () {
              Navigator.pop(context);
              widget.callbacks.onMenuAction?.call('report');
            }),
            _buildMenuOption(Icons.block, 'Block', () {
              Navigator.pop(context);
              widget.callbacks.onMenuAction?.call('block');
            }),
          ],

          const Divider(color: AppColors.border),
          _buildMenuOption(Icons.close, 'Cancel', () => Navigator.pop(context)),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  Widget _buildMenuOption(IconData icon, String label, VoidCallback onTap) {
    return ListTile(
      leading: Icon(icon, color: AppColors.text2, size: 22),
      title: Text(
        label,
        style: const TextStyle(color: AppColors.text, fontSize: 14),
      ),
      onTap: onTap,
      dense: true,
    );
  }

  String? _currentUserId() {
    // This would normally come from an AuthProvider — for now return null (viewer's posts unknown)
    return null;
  }

  // ── Helpers ──
  String _formatTimeAgo(String timestamp) {
    if (timestamp.isEmpty) return '';
    try {
      final dt = DateTime.parse(timestamp);
      final now = DateTime.now();
      final diff = now.difference(dt);
      if (diff.inMinutes < 1) return 'just now';
      if (diff.inMinutes < 60) return '${diff.inMinutes}m';
      if (diff.inHours < 24) return '${diff.inHours}h';
      if (diff.inDays < 7) return '${diff.inDays}d';
      return '${diff.inDays ~/ 7}w';
    } catch (_) {
      return '';
    }
  }

  String _formatCount(int count) {
    if (count >= 1000000) return '${(count / 1000000).toStringAsFixed(1)}M';
    if (count >= 1000) return '${(count / 1000).toStringAsFixed(1)}K';
    return count.toString();
  }
}