import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

/// Onboarding Screen 3: Profile photo (optional, can skip).
class PhotoScreen extends StatefulWidget {
  final ValueChanged<String?> onPhotoSet;
  final bool isCompleting;

  const PhotoScreen({
    super.key,
    required this.onPhotoSet,
    required this.isCompleting,
  });

  @override
  State<PhotoScreen> createState() => _PhotoScreenState();
}

class _PhotoScreenState extends State<PhotoScreen> {
  String? _imageUrl;
  bool _isPicking = false;

  Future<void> _pickFromGallery() async {
    setState(() => _isPicking = true);
    try {
      // In real app: pick from gallery using image_picker (already in pubspec.yaml)
      // final picker = ImagePicker();
      // final XFile? image = await picker.pickImage(source: ImageSource.gallery, maxWidth: 800);
      // if (image != null) { upload to backend, get URL }
      //
      // For now: simulate the pick with a placeholder
      await Future.delayed(const Duration(milliseconds: 800));
      if (!mounted) return;
      setState(() {
        _imageUrl = 'picked_from_gallery'; // Simulated URL
        _isPicking = false;
      });
      widget.onPhotoSet(_imageUrl);
    } catch (e) {
      if (!mounted) return;
      setState(() => _isPicking = false);
    }
  }

  Future<void> _takePhoto() async {
    setState(() => _isPicking = true);
    try {
      // In real app: capture from camera
      // final picker = ImagePicker();
      // final XFile? image = await picker.pickImage(source: ImageSource.camera, maxWidth: 800);
      await Future.delayed(const Duration(milliseconds: 800));
      if (!mounted) return;
      setState(() {
        _imageUrl = 'captured_from_camera'; // Simulated URL
        _isPicking = false;
      });
      widget.onPhotoSet(_imageUrl);
    } catch (e) {
      if (!mounted) return;
      setState(() => _isPicking = false);
    }
  }

  void _skip() {
    widget.onPhotoSet(null);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          const Text(
            'Add a profile\nphoto',
            style: TextStyle(
              fontFamily: 'Space Grotesk',
              fontSize: 24,
              fontWeight: FontWeight.w700,
              color: AppColors.text,
              height: 1.3,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Help others recognize you. You can skip and add later.',
            style: TextStyle(fontSize: 14, color: AppColors.text2, height: 1.5),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 32),

          // Avatar preview
          Center(
            child: GestureDetector(
              onTap: _isPicking ? null : _pickFromGallery,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                width: 140,
                height: 140,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.card,
                  border: Border.all(
                    color: _imageUrl != null ? AppColors.primary : AppColors.border2,
                    width: _imageUrl != null ? 3 : 1,
                  ),
                  boxShadow: _imageUrl != null
                      ? [
                          BoxShadow(
                            color: AppColors.primary.withOpacity(0.3),
                            blurRadius: 16,
                            offset: const Offset(0, 4),
                          ),
                        ]
                      : null,
                ),
                child: _isPicking
                    ? const Center(
                        child: CircularProgressIndicator(color: AppColors.primary),
                      )
                    : _imageUrl != null
                        ? const Icon(Icons.check_circle, color: AppColors.secondary, size: 48)
                        : Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.camera_alt_outlined,
                                  color: AppColors.text3, size: 36),
                              const SizedBox(height: 4),
                              Text(
                                'Add photo',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: AppColors.text3,
                                ),
                              ),
                            ],
                          ),
              ),
            ),
          ),
          const SizedBox(height: 32),

          // Photo options
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _isPicking ? null : _pickFromGallery,
                  icon: const Icon(Icons.photo_library_outlined, size: 18),
                  label: const Text('Gallery', style: TextStyle(fontSize: 13)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.text,
                    side: const BorderSide(color: AppColors.border2),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _isPicking ? null : _takePhoto,
                  icon: const Icon(Icons.camera_alt_outlined, size: 18),
                  label: const Text('Camera', style: TextStyle(fontSize: 13)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.text,
                    side: const BorderSide(color: AppColors.border2),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Skip button
          TextButton(
            onPressed: _isPicking ? null : _skip,
            child: Text(
              'Skip for now',
              style: TextStyle(
                fontSize: 14,
                color: AppColors.text2,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),

          const Spacer(),

          // Info chip
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline, color: AppColors.text3, size: 18),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Your photo helps build trust with providers. You can always update it later.',
                    style: TextStyle(fontSize: 12, color: AppColors.text3, height: 1.4),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}