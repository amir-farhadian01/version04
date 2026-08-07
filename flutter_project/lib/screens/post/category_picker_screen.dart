import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/api_service.dart';

/// Category picker screen — MUST select a category before publishing.
/// Returns the selected category ID and name as "id::name".
class CategoryPickerScreen extends StatefulWidget {
  const CategoryPickerScreen({super.key});

  @override
  State<CategoryPickerScreen> createState() => _CategoryPickerScreenState();
}

class _CategoryPickerScreenState extends State<CategoryPickerScreen> {
  List<Map<String, dynamic>> _categories = [];
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
        _categories = data.cast<Map<String, dynamic>>();
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to load categories';
        _isLoading = false;
      });
    }
  }

  void _selectCategory(Map<String, dynamic> category) {
    final id = category['id'] as String? ?? '';
    final name = category['name'] as String? ?? 'General';
    Navigator.pop(context, '$id::$name');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        title: const Text(
          'Choose a Category',
          style: TextStyle(
            fontWeight: FontWeight.w700,
            color: AppColors.text,
          ),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.text),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_error!, style: const TextStyle(color: AppColors.text2)),
                      const SizedBox(height: 12),
                      ElevatedButton(
                        onPressed: () {
                          setState(() {
                            _isLoading = true;
                            _error = null;
                          });
                          _loadCategories();
                        },
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _categories.length,
                  itemBuilder: (ctx, i) {
                    final cat = _categories[i];
                    final name = cat['name'] as String? ?? '';
                    final icon = cat['icon'] as String? ?? '📌';
                    final children = cat['children'] as List<dynamic>? ?? [];

                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Main category
                        ListTile(
                          leading: Text(icon, style: const TextStyle(fontSize: 24)),
                          title: Text(
                            name,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: AppColors.text,
                            ),
                          ),
                          trailing: const Icon(
                            Icons.chevron_right,
                            color: AppColors.text3,
                          ),
                          onTap: () => _selectCategory(cat),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                          tileColor: AppColors.card,
                        ),
                        // Subcategories
                        if (children.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(left: 56, top: 4, bottom: 8),
                            child: Wrap(
                              spacing: 8,
                              runSpacing: 6,
                              children: children.map((sub) {
                                final subMap = sub as Map<String, dynamic>;
                                final subName = subMap['name'] as String? ?? '';
                                final subIcon = subMap['icon'] as String? ?? '📌';
                                return ActionChip(
                                  label: Text('$subIcon $subName'),
                                  onPressed: () => _selectCategory(subMap),
                                  backgroundColor: AppColors.card,
                                  labelStyle: const TextStyle(
                                    fontSize: 13,
                                    color: AppColors.text2,
                                  ),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(20),
                                    side: const BorderSide(color: AppColors.border2),
                                  ),
                                );
                              }).toList(),
                            ),
                          ),
                        if (i < _categories.length - 1)
                          const Divider(color: AppColors.border, height: 1),
                      ],
                    );
                  },
                ),
    );
  }
}