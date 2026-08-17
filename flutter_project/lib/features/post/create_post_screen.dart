import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../services/api_service.dart';
import '../../theme/app_theme.dart';

/// CreatePostScreen — create a new neighbourhood post.
///
/// Reached via the '/create-post' route (opened from the FeedScreen FAB).
/// Supports an optional image (uploaded immediately after picking), a text
/// caption, a category selection, and a Community/Business post type.
class CreatePostScreen extends StatefulWidget {
  const CreatePostScreen({super.key});

  @override
  State<CreatePostScreen> createState() => _CreatePostScreenState();
}

class _CreatePostScreenState extends State<CreatePostScreen> {
  final ApiService _api = ApiService();
  final ImagePicker _picker = ImagePicker();
  final TextEditingController _contentController = TextEditingController();

  String _content = '';
  String? _selectedCategoryId;
  bool _isBusinessPost = false;
  String? _uploadedImageUrl;
  bool _uploadingImage = false;
  bool _submitting = false;
  List<Map<String, dynamic>> _categories = [];
  bool _loadingCategories = true;

  @override
  void initState() {
    super.initState();
    _loadCategories();
  }

  @override
  void dispose() {
    _contentController.dispose();
    super.dispose();
  }

  Future<void> _loadCategories() async {
    setState(() => _loadingCategories = true);
    try {
      final categories = await _api.getCategories();
      if (!mounted) return;
      setState(() {
        _categories = categories;
        _loadingCategories = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loadingCategories = false);
    }
  }

  Future<void> _pickImage() async {
    if (_uploadingImage || _submitting) return;
    final image = await _picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 1600,
      imageQuality: 85,
    );
    if (image == null) return;

    setState(() {
      _uploadingImage = true;
      _uploadedImageUrl = null;
    });

    try {
      final bytes = await image.readAsBytes();
      final url = await _api.uploadImageBytes(image.name, bytes);
      if (!mounted) return;
      setState(() {
        _uploadedImageUrl = url;
        _uploadingImage = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _uploadingImage = false);
      _showError('Image upload failed. Please try again.');
    }
  }

  void _removeImage() {
    if (_uploadingImage || _submitting) return;
    setState(() => _uploadedImageUrl = null);
  }

  Future<void> _submit() async {
    if (_submitting || _uploadingImage) return;
    if (_selectedCategoryId == null) {
      _showError('Please select a category.');
      return;
    }

    setState(() => _submitting = true);

    try {
      final hasImage =
          _uploadedImageUrl != null && _uploadedImageUrl!.isNotEmpty;
      final body = <String, dynamic>{
        // Backend POST /api/social/posts expects `caption` + `mediaUrls[]`
        // (the task refers to these as `content` + `imageUrl`).
        'caption': _content.trim(),
        'categoryId': _selectedCategoryId,
        'isBusinessPost': _isBusinessPost,
        'mediaUrls': hasImage ? [_uploadedImageUrl!] : <String>[],
        'mediaTypes': hasImage ? ['image'] : <String>[],
      };
      await _api.createPost(body);
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      final message = e is ApiException
          ? e.message
          : 'Failed to create post. Please try again.';
      _showError(message);
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? AppColors.bg : AppColorsLight.bg;
    final card = isDark ? AppColors.card : AppColorsLight.card;
    final border = isDark ? AppColors.border : AppColorsLight.border;
    final text = isDark ? AppColors.text : AppColorsLight.text;
    final text2 = isDark ? AppColors.text2 : AppColorsLight.text2;
    final text3 = isDark ? AppColors.text3 : AppColorsLight.text3;

    return Scaffold(
      backgroundColor: bg,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildImagePicker(card, border, text2),
              const SizedBox(height: 20),
              _sectionLabel('Content', text2),
              const SizedBox(height: 8),
              _buildContentField(card, border, text, text3),
              const SizedBox(height: 20),
              _sectionLabel('Category', text2),
              const SizedBox(height: 8),
              _buildCategoryChips(card, border, text2, text3),
              const SizedBox(height: 20),
              _sectionLabel('Post type', text2),
              const SizedBox(height: 8),
              _buildPostTypeToggle(card, border, text2),
              const SizedBox(height: 28),
              _buildSubmitButton(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _sectionLabel(String label, Color text2) {
    return Text(
      label,
      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: text2),
    );
  }

  Widget _buildImagePicker(Color card, Color border, Color text2) {
    return GestureDetector(
      onTap: (_uploadingImage || _submitting) ? null : _pickImage,
      child: Container(
        height: 200,
        width: double.infinity,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: card,
          borderRadius: BorderRadius.circular(10),
        ),
        child: _buildImageContent(border, text2),
      ),
    );
  }

  Widget _buildImageContent(Color border, Color text2) {
    if (_uploadingImage) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.primary),
      );
    }
    if (_uploadedImageUrl != null && _uploadedImageUrl!.isNotEmpty) {
      return Stack(
        fit: StackFit.expand,
        children: [
          Image.network(
            _uploadedImageUrl!,
            fit: BoxFit.cover,
            errorBuilder: (_, _, _) => Center(
              child: Icon(Icons.broken_image_outlined, color: text2, size: 32),
            ),
          ),
          Positioned(
            top: 8,
            right: 8,
            child: GestureDetector(
              onTap: _removeImage,
              child: Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.55),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.close, color: Colors.white, size: 16),
              ),
            ),
          ),
        ],
      );
    }
    return Stack(
      fit: StackFit.expand,
      children: [
        CustomPaint(painter: _DashedBorderPainter(color: border)),
        Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.add_photo_alternate_outlined, color: text2, size: 32),
              const SizedBox(height: 8),
              Text(
                'Add image (optional)',
                style: TextStyle(color: text2, fontSize: 13),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildContentField(Color card, Color border, Color text, Color text3) {
    return TextField(
      controller: _contentController,
      enabled: !_submitting,
      minLines: 3,
      maxLines: 7,
      maxLength: 500,
      onChanged: (value) => _content = value,
      style: TextStyle(color: text, fontSize: 14),
      decoration: InputDecoration(
        hintText: "What's happening in your neighbourhood?",
        hintStyle: TextStyle(color: text3, fontSize: 14),
        filled: true,
        fillColor: card,
        counterStyle: TextStyle(color: text3),
        contentPadding: const EdgeInsets.all(14),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: border),
        ),
      ),
    );
  }

  Widget _buildCategoryChips(
      Color card, Color border, Color text2, Color text3) {
    if (_loadingCategories) {
      return const SizedBox(
        height: 40,
        child: Center(
          child: CircularProgressIndicator(
            strokeWidth: 2,
            color: AppColors.primary,
          ),
        ),
      );
    }
    if (_categories.isEmpty) {
      return SizedBox(
        height: 40,
        child: Center(
          child: Text(
            'No categories available',
            style: TextStyle(color: text3, fontSize: 13),
          ),
        ),
      );
    }
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: _categories.map((category) {
          final id = (category['id'] ?? '').toString();
          final name = (category['name'] ?? '').toString();
          final icon = (category['icon'] ?? '').toString();
          final selected = _selectedCategoryId == id;
          final label = icon.isNotEmpty ? '$icon $name' : name;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              label: Text(label),
              selected: selected,
              onSelected: _submitting
                  ? null
                  : (_) => setState(() => _selectedCategoryId = id),
              selectedColor: AppColors.primary,
              backgroundColor: card,
              labelStyle: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: selected ? Colors.white : text2,
              ),
              side: BorderSide(color: selected ? AppColors.primary : border),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildPostTypeToggle(Color card, Color border, Color text2) {
    return Row(
      children: [
        Expanded(
          child: _buildTypeOption(card, border, text2,
              label: 'Community', isBusiness: false),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _buildTypeOption(card, border, text2,
              label: 'Business', isBusiness: true),
        ),
      ],
    );
  }

  Widget _buildTypeOption(
    Color card,
    Color border,
    Color text2, {
    required String label,
    required bool isBusiness,
  }) {
    final selected = _isBusinessPost == isBusiness;
    return GestureDetector(
      onTap: _submitting
          ? null
          : () => setState(() => _isBusinessPost = isBusiness),
      child: Container(
        height: 44,
        decoration: BoxDecoration(
          color: selected ? AppColors.primary.withValues(alpha: 0.12) : card,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: selected ? AppColors.primary : border),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              isBusiness ? Icons.business_outlined : Icons.people_outline,
              size: 16,
              color: selected ? AppColors.primary : text2,
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: selected ? AppColors.primary : text2,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSubmitButton() {
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: ElevatedButton(
        onPressed: (_submitting || _uploadingImage) ? null : _submit,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.5),
          disabledForegroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
        child: _submitting
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  color: Colors.white,
                ),
              )
            : const Text(
                'Post',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
      ),
    );
  }
}

/// Paints a dashed rounded-rectangle border for the empty image picker area.
class _DashedBorderPainter extends CustomPainter {
  _DashedBorderPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    final rect = Offset.zero & size;
    final rrect = RRect.fromRectAndRadius(rect, const Radius.circular(10));
    final path = Path()..addRRect(rrect);

    const dashLength = 6.0;
    const gapLength = 4.0;
    for (final metric in path.computeMetrics()) {
      double distance = 0.0;
      while (distance < metric.length) {
        final end = (distance + dashLength).clamp(0.0, metric.length).toDouble();
        canvas.drawPath(metric.extractPath(distance, end), paint);
        distance = end + gapLength;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedBorderPainter oldDelegate) =>
      oldDelegate.color != color;
}



