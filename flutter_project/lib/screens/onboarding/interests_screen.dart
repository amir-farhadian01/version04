import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/api_service.dart';
import 'dart:convert';

/// Onboarding Screen 1: Interest selection (≥3 categories required).
/// Fetches category tree from GET /api/categories/tree.
class InterestsScreen extends StatefulWidget {
  final List<String> selectedInterests;
  final ValueChanged<List<String>> onInterestsChanged;

  const InterestsScreen({
    super.key,
    required this.selectedInterests,
    required this.onInterestsChanged,
  });

  @override
  State<InterestsScreen> createState() => _InterestsScreenState();
}

class _InterestsScreenState extends State<InterestsScreen> {
  List<CategoryNode> _categories = [];
  bool _isLoading = true;
  String? _error;

  final ApiService _api = ApiService();

  @override
  void initState() {
    super.initState();
    _loadCategories();
  }

  Future<void> _loadCategories() async {
    try {
      final response = await _api.get('/categories/tree');
      final List<dynamic> data = response['data'] as List<dynamic>? ?? [];
      setState(() {
        _categories = data.map((c) => CategoryNode.fromJson(c as Map<String, dynamic>)).toList();
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to load categories. Please try again.';
        _isLoading = false;
      });
    }
  }

  void _toggleInterest(String categoryId) {
    final updated = List<String>.from(widget.selectedInterests);
    if (updated.contains(categoryId)) {
      updated.remove(categoryId);
    } else {
      updated.add(categoryId);
    }
    widget.onInterestsChanged(updated);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Title
          const Text(
            'What are you\ninterested in?',
            style: TextStyle(
              fontFamily: 'Space Grotesk',
              fontSize: 24,
              fontWeight: FontWeight.w700,
              color: AppColors.text,
              height: 1.3,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Choose at least 3 categories to personalize your feed.',
            style: TextStyle(fontSize: 14, color: AppColors.text2, height: 1.5),
          ),
          const SizedBox(height: 8),
          Text(
            '${widget.selectedInterests.length} selected',
            style: TextStyle(
              fontSize: 13,
              color: widget.selectedInterests.length >= 3 ? AppColors.secondary : AppColors.warn,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 20),

          // Categories list with loading/error handling
          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: AppColors.primary),
                  )
                : _error != null
                    ? _buildErrorState()
                    : _buildCategoryList(),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.wifi_off_outlined, size: 48, color: AppColors.text3),
          const SizedBox(height: 16),
          Text(
            _error!,
            style: const TextStyle(color: AppColors.text2, fontSize: 14),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: () {
              setState(() {
                _isLoading = true;
                _error = null;
              });
              _loadCategories();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Retry', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryList() {
    return ListView.builder(
      itemCount: _categories.length,
      itemBuilder: (context, index) {
        final cat = _categories[index];
        final isSelected = widget.selectedInterests.contains(cat.id);

        // Main category chip
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: InkWell(
                onTap: () => _toggleInterest(cat.id),
                borderRadius: BorderRadius.circular(12),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: isSelected ? AppColors.primary.withOpacity(0.15) : AppColors.card,
                    border: Border.all(
                      color: isSelected ? AppColors.primary : AppColors.border2,
                      width: isSelected ? 1.5 : 1.0,
                    ),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      // Emoji/icon
                      Text(
                        cat.emoji,
                        style: const TextStyle(fontSize: 24),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          cat.name,
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: isSelected ? AppColors.primary : AppColors.text,
                          ),
                        ),
                      ),
                      // Checkbox indicator
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        width: 24,
                        height: 24,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: isSelected ? AppColors.primary : AppColors.border2,
                          border: Border.all(
                            color: isSelected ? AppColors.primary : AppColors.border2,
                          ),
                        ),
                        child: isSelected
                            ? const Icon(Icons.check, color: Colors.white, size: 16)
                            : null,
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // Subcategories (if any)
            if (cat.children.isNotEmpty && isSelected)
              Padding(
                padding: const EdgeInsets.only(left: 48),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: cat.children.map((sub) {
                    final subSelected = widget.selectedInterests.contains(sub.id);
                    return FilterChip(
                      selected: subSelected,
                      label: Text(sub.name),
                      onSelected: (_) => _toggleInterest(sub.id),
                      backgroundColor: AppColors.card,
                      selectedColor: AppColors.primary.withOpacity(0.25),
                      checkmarkColor: AppColors.primary,
                      labelStyle: TextStyle(
                        fontSize: 13,
                        color: subSelected ? AppColors.primary : AppColors.text2,
                        fontWeight: subSelected ? FontWeight.w600 : FontWeight.w400,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(20),
                        side: BorderSide(
                          color: subSelected ? AppColors.primary : AppColors.border2,
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),

            if (index < _categories.length - 1)
              const Divider(color: AppColors.border, height: 1),
          ],
        );
      },
    );
  }
}

/// Simple category tree node for the onboarding interests picker.
class CategoryNode {
  final String id;
  final String name;
  final String emoji;
  final List<CategoryNode> children;

  const CategoryNode({
    required this.id,
    required this.name,
    required this.emoji,
    this.children = const [],
  });

  factory CategoryNode.fromJson(Map<String, dynamic> json) {
    final List<dynamic> childrenJson = json['children'] as List<dynamic>? ?? [];
    return CategoryNode(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      emoji: json['icon'] as String? ?? json['emoji'] as String? ?? '📌',
      children: childrenJson
          .map((c) => CategoryNode.fromJson(c as Map<String, dynamic>))
          .toList(),
    );
  }
}