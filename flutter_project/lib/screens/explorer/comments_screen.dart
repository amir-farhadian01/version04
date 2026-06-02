import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../cache/image_cache_config.dart';
import '../../services/api_service.dart';

/// Instagram-style comments bottom sheet for a post.
///
/// Displays:
/// - Post media preview at top
/// - Post caption below media
/// - Scrollable top-level comments list (paginated)
/// - Threaded replies with expand/collapse
/// - Comment likes (heart toggle)
/// - Comment input bar at bottom
///
/// Route: /explorer/comments with postId as argument.
class CommentsScreen extends StatefulWidget {
  final String postId;

  const CommentsScreen({super.key, required this.postId});

  @override
  State<CommentsScreen> createState() => _CommentsScreenState();
}

class _CommentsScreenState extends State<CommentsScreen> {
  final ApiService _api = ApiService();
  final ScrollController _scrollController = ScrollController();
  final TextEditingController _commentCtrl = TextEditingController();
  final FocusNode _commentFocus = FocusNode();

  // Post data
  bool _loadingPost = true;
  Map<String, dynamic>? _post;
  String? _postError;

  // Comments data
  bool _loadingComments = true;
  List<Map<String, dynamic>> _comments = [];
  int _commentTotal = 0;
  int _commentPage = 1;
  bool _commentHasMore = false;
  String? _commentError;

  // Reply state per comment: commentId -> { expanded: bool, loading: bool, replies: List, total: int, page: int }
  final Map<String, _ReplyState> _replyStates = {};

  // Submit state
  bool _submitting = false;
  String? _replyToCommentId; // if set, the input is replying to this comment
  String? _replyToAuthor;

  // Like toggle guards
  final Set<String> _togglingCommentLikes = {};

  @override
  void initState() {
    super.initState();
    _loadPost();
    _loadComments();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    _commentCtrl.dispose();
    _commentFocus.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
            _scrollController.position.maxScrollExtent - 200 &&
        _commentHasMore &&
        !_loadingComments) {
      _loadMoreComments();
    }
  }

  Future<void> _loadPost() async {
    try {
      final result = await _api.getPost(widget.postId);
      final data = result['data'] as Map<String, dynamic>? ?? {};
      if (mounted) setState(() { _post = data; _loadingPost = false; });
    } catch (_) {
      if (mounted) setState(() { _postError = 'Could not load post'; _loadingPost = false; });
    }
  }

  Future<void> _loadComments() async {
    setState(() {
      _loadingComments = true;
      _commentError = null;
      _commentPage = 1;
    });
    try {
      final result = await _api.get('/social/posts/${widget.postId}/comments?page=1');
      final data = (result['data'] as List<dynamic>?)?.cast<Map<String, dynamic>>() ?? [];
      final total = result['total'] as int? ?? 0;
      if (mounted) {
        setState(() {
          _comments = data;
          _commentTotal = total;
          _commentHasMore = _comments.length < total;
          _loadingComments = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() { _commentError = 'Could not load comments'; _loadingComments = false; });
    }
  }

  Future<void> _loadMoreComments() async {
    if (!_commentHasMore) return;
    setState(() => _loadingComments = true);
    try {
      final nextPage = _commentPage + 1;
      final result = await _api.get('/social/posts/${widget.postId}/comments?page=$nextPage');
      final data = (result['data'] as List<dynamic>?)?.cast<Map<String, dynamic>>() ?? [];
      final total = result['total'] as int? ?? 0;
      if (mounted) {
        setState(() {
          _comments.addAll(data);
          _commentPage = nextPage;
          _commentHasMore = _comments.length < total;
          _commentTotal = total;
          _loadingComments = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingComments = false);
    }
  }

  // ─── Replies ──────────────────────────────────────────────────────────

  _ReplyState _getReplyState(String commentId) {
    return _replyStates.putIfAbsent(commentId, () => _ReplyState());
  }

  Future<void> _toggleReplies(String commentId) async {
    final state = _getReplyState(commentId);
    if (state.expanded) {
      setState(() => state.expanded = false);
      return;
    }
    // Load replies
    if (state.replies.isEmpty) {
      setState(() => state.loading = true);
      try {
        final List<Map<String, dynamic>> result = await _api.getReplies(widget.postId, commentId);
        final data = result;
        final int total = result.length;
        if (mounted) {
          setState(() {
            state.replies = data;
            state.total = total;
            state.loading = false;
            state.expanded = true;
          });
        }
      } catch (_) {
        if (mounted) setState(() => state.loading = false);
      }
    } else {
      setState(() => state.expanded = true);
    }
  }

  // ─── Like Actions ─────────────────────────────────────────────────────

  Future<void> _toggleCommentLike(String commentId) async {
    if (_togglingCommentLikes.contains(commentId)) return;
    // Find comment in list or reply states
    Map<String, dynamic>? targetComment;
    int commentIndex = -1;
    for (int i = 0; i < _comments.length; i++) {
      if (_comments[i]['id'] == commentId) {
        targetComment = _comments[i];
        commentIndex = i;
        break;
      }
    }
    if (targetComment == null) {
      // Check reply states
      for (final state in _replyStates.values) {
        for (int i = 0; i < state.replies.length; i++) {
          if (state.replies[i]['id'] == commentId) {
            targetComment = state.replies[i];
            break;
          }
        }
      }
    }
    if (targetComment == null) return;

    final prevLiked = targetComment['isLiked'] as bool? ?? false;
    final prevCount = targetComment['likeCount'] as int? ?? 0;

    setState(() {
      _togglingCommentLikes.add(commentId);
      targetComment!['isLiked'] = !prevLiked;
      targetComment['likeCount'] = prevCount + (prevLiked ? -1 : 1);
    });

    try {
      final result = await _api.toggleCommentLike(widget.postId, commentId);
      final liked = result['data']?['liked'] as bool? ?? !prevLiked;
      if (mounted) {
        setState(() {
          targetComment!['isLiked'] = liked;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          targetComment!['isLiked'] = prevLiked;
          targetComment['likeCount'] = prevCount;
        });
      }
    } finally {
      if (mounted) setState(() => _togglingCommentLikes.remove(commentId));
    }
  }

  // ─── Submit Comment / Reply ───────────────────────────────────────────

  Future<void> _submitComment() async {
    final text = _commentCtrl.text.trim();
    if (text.isEmpty) return;
    setState(() => _submitting = true);
    try {
      final body = <String, dynamic>{'text': text};
      if (_replyToCommentId != null) body['parentId'] = _replyToCommentId;
      final result = await _api.addComment(widget.postId, text, parentId: _replyToCommentId);
      final newComment = result['data'] as Map<String, dynamic>? ?? {};

      if (_replyToCommentId != null && _replyToCommentId!.isNotEmpty) {
        // Add to reply state
        final state = _getReplyState(_replyToCommentId!);
        state.replies.insert(0, {
          ...newComment,
          'author': {'id': 'me', 'displayName': 'You', 'avatarUrl': null},
          'isLiked': false,
        });
        state.total = (state.total) + 1;
        if (!state.expanded) {
          setState(() => state.expanded = true);
        }
        // Update parent reply count
        for (final c in _comments) {
          if (c['id'] == _replyToCommentId) {
            c['replyCount'] = (c['replyCount'] as int? ?? 0) + 1;
            break;
          }
        }
      } else {
        // Insert at top of comments list
        _comments.insert(0, {
          ...newComment,
          'author': {'id': 'me', 'displayName': 'You', 'avatarUrl': null},
          'isLiked': false,
          'replyCount': 0,
          'attachments': [],
        });
        _commentTotal++;
      }

      _cancelReply();
      _commentCtrl.clear();
      if (mounted) setState(() {});
    } catch (_) {
      // silently fail
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _startReply(String commentId, String authorName) {
    setState(() {
      _replyToCommentId = commentId;
      _replyToAuthor = authorName;
    });
    _commentFocus.requestFocus();
  }

  void _cancelReply() {
    setState(() {
      _replyToCommentId = null;
      _replyToAuthor = null;
    });
  }

  // ─── Build ────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? AppColors.bg : AppColorsLight.bg;
    final cardBg = isDark ? AppColors.card : AppColorsLight.card;
    final border = isDark ? AppColors.border : AppColorsLight.border;

    return Scaffold(
      backgroundColor: bg,
      appBar: AppBar(
        backgroundColor: bg,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.text),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Comments',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppColors.text),
        ),
        centerTitle: true,
        elevation: 0,
      ),
      body: Column(
        children: [
          // Scrollable content: post media + caption + comments
          Expanded(
            child: ListView(
              controller: _scrollController,
              padding: EdgeInsets.zero,
              children: [
                // Post media preview
                if (_post != null) _buildPostMedia(),
                if (_loadingPost) _buildSkeletonMedia(),
                if (_postError != null) _buildError(_postError!),

                // Comments section
                if (_commentError != null)
                  _buildError(_commentError!)
                else if (_loadingComments && _comments.isEmpty)
                  _buildCommentSkeletons()
                else if (_comments.isEmpty && !_loadingComments)
                  _buildEmptyComments()
                else
                  ..._comments.map((c) => _buildCommentTile(c)),

                // Load more indicator
                if (_commentHasMore)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    child: Center(
                      child: SizedBox(
                        width: 20, height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                      ),
                    ),
                  ),
                if (_loadingComments && _comments.isNotEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    child: Center(
                      child: SizedBox(
                        width: 20, height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                      ),
                    ),
                  ),
              ],
            ),
          ),

          // Bottom input bar
          _buildInputBar(border),
        ],
      ),
    );
  }

  Widget _buildPostMedia() {
    final post = _post!;
    final caption = post['caption'] as String? ?? '';
    final author = post['author'] as Map<String, dynamic>? ?? {};
    final authorName = author['displayName'] ?? 'User';
    final authorInitial = (authorName as String).characters.first.toUpperCase();
    final media = (post['media'] as List<dynamic>?) ?? [];
    final likeCount = post['likeCount'] ?? 0;
    final createdAt = post['publishedAt'] ?? post['createdAt'] ?? '';
    final timeAgo = _formatTimeAgo(createdAt is String ? createdAt : '');

    return Column(
      children: [
        // Media
        if (media.isNotEmpty)
          SizedBox(
            height: 280,
            width: double.infinity,
            child: CachedNetworkImage(
              imageUrl: (media.first as Map<String, dynamic>)['url'] as String? ?? '',
              fit: BoxFit.cover,
              cacheManager: ImageCacheConfig.manager,
              placeholder: (_, _) => const Center(
                child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
              ),
              errorWidget: (_, _, _) => const Center(
                child: Icon(Icons.broken_image, size: 40, color: AppColors.text3),
              ),
            ),
          ),

        // Caption + author info
        Container(
          padding: const EdgeInsets.all(14),
          decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: AppColors.border)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 32, height: 32,
                    decoration: BoxDecoration(
                      color: AppColors.accent,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Center(
                      child: Text(authorInitial,
                        style: const TextStyle(fontWeight: FontWeight.w700, color: Colors.white, fontSize: 14)),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(authorName,
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.text)),
                        Text(timeAgo,
                          style: const TextStyle(fontSize: 11, color: AppColors.text3)),
                      ],
                    ),
                  ),
                  // Like count badge
                  Row(
                    children: [
                      const Icon(Icons.favorite, size: 12, color: AppColors.red),
                      const SizedBox(width: 4),
                      Text('$likeCount',
                        style: const TextStyle(fontSize: 11, color: AppColors.text2)),
                    ],
                  ),
                ],
              ),
              if (caption.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(caption,
                  style: const TextStyle(fontSize: 13, color: AppColors.text, height: 1.5)),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSkeletonMedia() {
    return Column(
      children: [
        Container(
          height: 280,
          color: AppColors.border2.withValues(alpha: 0.3),
        ),
        Container(
          height: 60,
          padding: const EdgeInsets.all(14),
          color: AppColors.card,
          child: Row(
            children: [
              Container(
                width: 32, height: 32,
                decoration: BoxDecoration(color: AppColors.border2, borderRadius: BorderRadius.circular(8)),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  children: [
                    Container(height: 10, width: 120,
                      decoration: BoxDecoration(color: AppColors.border2, borderRadius: BorderRadius.circular(4))),
                    const SizedBox(height: 6),
                    Container(height: 8, width: 80,
                      decoration: BoxDecoration(color: AppColors.border2, borderRadius: BorderRadius.circular(4))),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildError(String msg) {
    return Padding(
      padding: const EdgeInsets.all(40),
      child: Column(
        children: [
          const Text('😕', style: TextStyle(fontSize: 40)),
          const SizedBox(height: 8),
          Text(msg, style: const TextStyle(fontSize: 13, color: AppColors.text2), textAlign: TextAlign.center),
          const SizedBox(height: 12),
          TextButton(
            onPressed: () { _loadPost(); _loadComments(); },
            child: const Text('Retry', style: TextStyle(color: AppColors.primary)),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyComments() {
    return const Padding(
      padding: EdgeInsets.all(40),
      child: Column(
        children: [
          Icon(Icons.chat_bubble_outline, size: 48, color: AppColors.text3),
          SizedBox(height: 12),
          Text('No comments yet',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.text2)),
          SizedBox(height: 6),
          Text('Be the first to comment!',
            style: TextStyle(fontSize: 12, color: AppColors.text3)),
        ],
      ),
    );
  }

  Widget _buildCommentSkeletons() {
    return Column(
      children: List.generate(3, (_) => Padding(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 0),
        child: Row(
          children: [
            Container(width: 36, height: 36,
              decoration: BoxDecoration(color: AppColors.border2, borderRadius: BorderRadius.circular(10))),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(height: 10, width: 100,
                    decoration: BoxDecoration(color: AppColors.border2, borderRadius: BorderRadius.circular(4))),
                  const SizedBox(height: 6),
                  Container(height: 8, width: 200,
                    decoration: BoxDecoration(color: AppColors.border2, borderRadius: BorderRadius.circular(4))),
                ],
              ),
            ),
          ],
        ),
      )),
    );
  }

  Widget _buildCommentTile(Map<String, dynamic> comment) {
    final author = comment['author'] as Map<String, dynamic>? ?? {};
    final authorName = author['displayName'] ?? 'User';
    final authorInitial = (authorName as String).characters.first.toUpperCase();
    final text = comment['text'] as String? ?? '';
    final likeCount = comment['likeCount'] as int? ?? 0;
    final replyCount = comment['replyCount'] as int? ?? 0;
    final isLiked = comment['isLiked'] as bool? ?? false;
    final commentId = comment['id'] as String? ?? '';
    final createdAt = comment['createdAt'] as String? ?? '';
    final timeAgo = _formatTimeAgo(createdAt);

    final replyState = _getReplyState(commentId);

    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Comment row
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Avatar
              Container(
                width: 36, height: 36,
                decoration: BoxDecoration(
                  color: AppColors.accent,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Center(
                  child: Text(authorInitial,
                    style: const TextStyle(fontWeight: FontWeight.w700, color: Colors.white, fontSize: 14)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(authorName,
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.text)),
                        const SizedBox(width: 8),
                        Text(timeAgo,
                          style: const TextStyle(fontSize: 11, color: AppColors.text3)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(text,
                      style: const TextStyle(fontSize: 13, color: AppColors.text, height: 1.4)),
                    const SizedBox(height: 6),
                    // Action row: like + reply
                    Row(
                      children: [
                        // Like button
                        GestureDetector(
                          onTap: () => _toggleCommentLike(commentId),
                          child: Row(
                            children: [
                              Icon(
                                isLiked ? Icons.favorite : Icons.favorite_border,
                                size: 12,
                                color: isLiked ? AppColors.red : AppColors.text3,
                              ),
                              if (likeCount > 0) ...[
                                const SizedBox(width: 4),
                                Text('$likeCount',
                                  style: TextStyle(fontSize: 11, color: isLiked ? AppColors.red : AppColors.text3)),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(width: 16),
                        // Reply button
                        GestureDetector(
                          onTap: () => _startReply(commentId, authorName),
                          child: const Text('Reply',
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.text3)),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),

          // View replies / Hide replies
          if (replyCount > 0 || replyState.expanded)
            Padding(
              padding: const EdgeInsets.only(left: 46, top: 4),
              child: GestureDetector(
                onTap: () => _toggleReplies(commentId),
                child: Row(
                  children: [
                    Container(width: 20, height: 1, color: AppColors.border),
                    const SizedBox(width: 8),
                    Text(
                      replyState.expanded
                          ? 'Hide replies'
                          : 'View ${replyCount > 0 ? '$replyCount ' : ''}replies',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.text3),
                    ),
                    if (replyState.loading)
                      const Padding(
                        padding: EdgeInsets.only(left: 8),
                        child: SizedBox(
                          width: 12, height: 12,
                          child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                        ),
                      ),
                  ],
                ),
              ),
            ),

          // Expanded replies
          if (replyState.expanded && replyState.replies.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(left: 46),
              child: Column(
                children: replyState.replies.map<Widget>((reply) {
                  return _buildReplyTile(reply);
                }).toList(),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildReplyTile(Map<String, dynamic> reply) {
    final author = reply['author'] as Map<String, dynamic>? ?? {};
    final authorName = author['displayName'] ?? 'User';
    final authorInitial = (authorName as String).characters.first.toUpperCase();
    final text = reply['text'] as String? ?? '';
    final likeCount = reply['likeCount'] as int? ?? 0;
    final isLiked = reply['isLiked'] as bool? ?? false;
    final replyId = reply['id'] as String? ?? '';
    final createdAt = reply['createdAt'] as String? ?? '';
    final timeAgo = _formatTimeAgo(createdAt);

    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 24, height: 24,
            decoration: BoxDecoration(
              color: AppColors.accent,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Center(
              child: Text(authorInitial,
                style: const TextStyle(fontWeight: FontWeight.w700, color: Colors.white, fontSize: 11)),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(authorName,
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.text)),
                    const SizedBox(width: 6),
                    Text(timeAgo,
                      style: const TextStyle(fontSize: 10, color: AppColors.text3)),
                  ],
                ),
                const SizedBox(height: 3),
                Text(text,
                  style: const TextStyle(fontSize: 12, color: AppColors.text, height: 1.4)),
                const SizedBox(height: 4),
                // Like button for reply
                GestureDetector(
                  onTap: () => _toggleCommentLike(replyId),
                  child: Row(
                    children: [
                      Icon(
                        isLiked ? Icons.favorite : Icons.favorite_border,
                        size: 10,
                        color: isLiked ? AppColors.red : AppColors.text3,
                      ),
                      if (likeCount > 0) ...[
                        const SizedBox(width: 4),
                        Text('$likeCount',
                          style: TextStyle(fontSize: 10, color: isLiked ? AppColors.red : AppColors.text3)),
                      ],
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

  Widget _buildInputBar(Color border) {
    final isReplying = _replyToCommentId != null;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        border: Border(top: BorderSide(color: border)),
      ),
      padding: EdgeInsets.fromLTRB(12, 8, 12, MediaQuery.of(context).padding.bottom + 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Reply indicator
          if (isReplying)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                children: [
                  const Icon(Icons.reply, size: 14, color: AppColors.text3),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text('Replying to $_replyToAuthor',
                      style: const TextStyle(fontSize: 11, color: AppColors.text3)),
                  ),
                  GestureDetector(
                    onTap: _cancelReply,
                    child: const Icon(Icons.close, size: 16, color: AppColors.text3),
                  ),
                ],
              ),
            ),
          // Input row
          Row(
            children: [
              Expanded(
                child: Container(
                  constraints: const BoxConstraints(maxHeight: 100),
                  decoration: BoxDecoration(
                    color: AppColors.bg2,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: TextField(
                    controller: _commentCtrl,
                    focusNode: _commentFocus,
                    maxLines: 3,
                    minLines: 1,
                    style: const TextStyle(fontSize: 13, color: AppColors.text),
                    decoration: InputDecoration(
                      hintText: isReplying ? 'Write a reply...' : 'Add a comment...',
                      hintStyle: const TextStyle(fontSize: 13, color: AppColors.text3),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      border: InputBorder.none,
                      isDense: true,
                    ),
                    onSubmitted: (_) => _submitComment(),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              // Send button
              GestureDetector(
                onTap: _submitting ? null : _submitComment,
                child: Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(
                    color: _submitting ? AppColors.border2 : AppColors.primary,
                    shape: BoxShape.circle,
                  ),
                  child: _submitting
                      ? const SizedBox(
                          width: 16, height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.send, size: 16, color: Colors.white),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _formatTimeAgo(String dateStr) {
    if (dateStr.isEmpty) return '';
    try {
      final dt = DateTime.parse(dateStr);
      final diff = DateTime.now().difference(dt);
      if (diff.inMinutes < 1) return 'just now';
      if (diff.inMinutes < 60) return '${diff.inMinutes}m';
      if (diff.inHours < 24) return '${diff.inHours}h';
      if (diff.inDays < 7) return '${diff.inDays}d';
      return '${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {
      return '';
    }
  }
}

/// Mutable state for replies to a specific comment.
class _ReplyState {
  bool expanded = false;
  bool loading = false;
  List<Map<String, dynamic>> replies = [];
  int total = 0;
}