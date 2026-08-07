import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../theme/app_theme.dart';
import '../../services/api_service.dart';
import 'category_picker_screen.dart';

/// Create post flow: Media pick → Add caption → Category selection → Publish.
class CreatePostScreen extends StatefulWidget {
  const CreatePostScreen({super.key});

  @override
  State<CreatePostScreen> createState() => _CreatePostScreenState();
}

class _CreatePostScreenState extends State<CreatePostScreen> {
  final TextEditingController _captionController = TextEditingController();
  final ApiService _api = ApiService();

  List<String> _selectedMediaPaths = [];
  String? _selectedCategoryId;
  String? _selectedCategoryName;
  String? _linkedServiceId;
  bool _isBusinessAccount = false;
  bool _isUploading = false;
  String? _error;

  bool get _canPublish => _selectedMediaPaths.isNotEmpty && _selectedCategoryId != null;

  Future<void> _pickFromGallery() async {
    try {
      final picker = ImagePicker();
      final images = await picker.pickMultiImage(maxWidth: 1200);
      if (images.isNotEmpty) {
        setState(() {
          _selectedMediaPaths.addAll(images.map((x) => x.path));
        });
      }
    } catch (e) {
      setState(() => _error = 'Failed to access gallery');
    }
  }

  Future<void> _takePhoto() async {
    try {
      final picker = ImagePicker();
      final image = await picker.pickImage(source: ImageSource.camera, maxWidth: 1200);
      if (image != null) {
        setState(() {
          _selectedMediaPaths.add(image.path);
        });
      }
    } catch (e) {
      setState(() => _error = 'Failed to access camera');
    }
  }

  Future<void> _pickCategory() async {
    final result = await Navigator.push<String>(
      context,
      MaterialPageRoute(
        builder: (_) => const CategoryPickerScreen(),
      ),
    );
    if (result != null && mounted) {
      final parts = result.split('::');
      setState(() {
        _selectedCategoryId = parts[0];
        _selectedCategoryName = parts.length > 1 ? parts[1] : 'Selected';
      });
    }
  }

  Future<void> _publish() async {
    if (!_canPublish) return;

    setState(() {
      _isUploading = true;
      _error = null;
    });

    try {
      // In a fully wired app, this would upload via multipart form data to POST /api/social/posts
      // or POST /api/posts with media upload.
      // For now, we simulate a publish and navigate back to feed.
      await Future.delayed(const Duration(seconds: 2));

      if (!mounted) return;
      Navigator.pop(context, true); // true = post was created
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to publish. Please try again.';
        _isUploading = false;
      });
    }
  }

  @override
  void dispose() {
    _captionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        title: const Text(
          'New Post',
          style: TextStyle(
            fontWeight: FontWeight.w700,
            color: AppColors.text,
          ),
        ),
        leading: IconButton(
          icon: const Icon(Icons.close, color: AppColors.text),
          onPressed: _isUploading ? null : () => Navigator.pop(context),
        ),
        actions: [
          TextButton(
            onPressed: _canPublish && !_isUploading ? _publish : null,
            child: Text(
              'Share',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: _canPublish ? AppColors.primary : AppColors.text3,
              ),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Media picker area
            _buildMediaPicker(),
            const SizedBox(height: 20),

            // Category selection
            _buildCategorySelector(),
            const SizedBox(height: 16),

            // Caption field
            _buildCaptionField(),
            const SizedBox(height: 16),

            // Business: Link to service
            if (_isBusinessAccount) _buildServiceLinkToggle(),

            // Error
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(
                  _error!,
                  style: const TextStyle(color: AppColors.red, fontSize: 13),
                ),
              ),

            if (_isUploading)
              const Padding(
                padding: EdgeInsets.only(top: 20),
                child: Center(
                  child: Column(
                    children: [
                      CircularProgressIndicator(color: AppColors.primary),
                      SizedBox(height: 12),
                      Text(
                        'Publishing...',
                        style: TextStyle(color: AppColors.text2, fontSize: 14),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildMediaPicker() {
    if (_selectedMediaPaths.isEmpty) {
      return GestureDetector(
        onTap: _pickFromGallery,
        child: Container(
          height: 200,
          width: double.infinity,
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border2, style: BorderStyle.solid),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.add_photo_alternate_outlined,
                  color: AppColors.text2, size: 48),
              const SizedBox(height: 12),
              const Text(
                'Tap to add photos or video',
                style: TextStyle(color: AppColors.text2, fontSize: 14),
              ),
              const SizedBox(height: 8),
              TextButton.icon(
                onPressed: _takePhoto,
                icon: const Icon(Icons.camera_alt_outlined, color: AppColors.primary, size: 18),
                label: const Text(
                  'Take a photo',
                  style: TextStyle(color: AppColors.primary, fontSize: 13),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              '${_selectedMediaPaths.length} media selected',
              style: const TextStyle(
                fontSize: 13,
                color: AppColors.text2,
                fontWeight: FontWeight.w500,
              ),
            ),
            Row(
              children: [
                TextButton.icon(
                  onPressed: _pickFromGallery,
                  icon: const Icon(Icons.add, size: 16),
                  label: const Text('Add more'),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: 160,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            itemCount: _selectedMediaPaths.length,
            itemBuilder: (ctx, i) {
              return Stack(
                children: [
                  Container(
                    width: 140,
                    margin: const EdgeInsets.only(right: 8),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      color: AppColors.border2,
                      image: DecorationImage(
                        image: FileImage(File(_selectedMediaPaths[i])),
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                  Positioned(
                    top: 4,
                    right: 12,
                    child: GestureDetector(
                      onTap: () {
                        setState(() {
                          _selectedMediaPaths.removeAt(i);
                        });
                      },
                      child: Container(
                        width: 24,
                        height: 24,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.black54,
                        ),
                        child: const Icon(Icons.close, color: Colors.white, size: 16),
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildCategorySelector() {
    return GestureDetector(
      onTap: _pickCategory,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: _selectedCategoryId != null ? AppColors.primary : AppColors.border2,
          ),
        ),
        child: Row(
          children: [
            Icon(
              Icons.category_outlined,
              color: _selectedCategoryId != null ? AppColors.primary : AppColors.text3,
              size: 20,
            ),
            const SizedBox(width: 10),
            Text(
              _selectedCategoryName ?? 'Select a category *',
              style: TextStyle(
                fontSize: 14,
                color: _selectedCategoryName != null ? AppColors.text : AppColors.text3,
                fontWeight: _selectedCategoryName != null ? FontWeight.w500 : FontWeight.w400,
              ),
            ),
            const Spacer(),
            const Icon(Icons.chevron_right, color: AppColors.text3, size: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildCaptionField() {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border2),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: TextField(
        controller: _captionController,
        maxLines: 4,
        style: const TextStyle(color: AppColors.text, fontSize: 14),
        decoration: const InputDecoration(
          hintText: 'Write a caption...',
          hintStyle: TextStyle(color: AppColors.text3, fontSize: 14),
          border: InputBorder.none,
        ),
      ),
    );
  }

  Widget _buildServiceLinkToggle() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border2),
      ),
      child: Row(
        children: [
          const Icon(Icons.storefront_outlined, color: AppColors.primary, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Link to my service',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.text,
                  ),
                ),
                Text(
                  _linkedServiceId != null ? 'Service linked' : 'Customers can book directly',
                  style: const TextStyle(fontSize: 12, color: AppColors.text2),
                ),
              ],
            ),
          ),
          Switch(
            value: _linkedServiceId != null,
            onChanged: (val) {
              setState(() {
                _linkedServiceId = val ? 'linked' : null;
              });
            },
            activeColor: AppColors.primary,
          ),
        ],
      ),
    );
  }
}

