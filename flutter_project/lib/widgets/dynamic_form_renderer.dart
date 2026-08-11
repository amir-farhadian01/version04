import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../services/api_service.dart';

/// Renders a dynamic order intake form based on a JSON field spec
/// from GET /api/service-catalog/:catalogId/form-template.
///
/// Falls back to catalog.dynamicFieldsSchema if no versioned template exists.

// ── JSON Spec Types ─────────────────────────────────────────────────────────

class DynamicFieldSpec {
  final String key;
  final String label;
  final String type; // text|textarea|number|currency|date|datetime|time|select|multiselect|boolean|photo|range|rating|location|file
  final bool required;
  final String? placeholder;
  final String? helpText;
  final Map<String, dynamic>? validation;
  final List<String>? options;
  final int? rangeMin;
  final int? rangeMax;
  final int? rangeStep;
  final String? rangeUnit;
  final int? maxPhotos;
  final ConditionalRule? conditionalOn;
  final int? sortOrder;

  DynamicFieldSpec({
    required this.key,
    required this.label,
    required this.type,
    this.required = false,
    this.placeholder,
    this.helpText,
    this.validation,
    this.options,
    this.rangeMin,
    this.rangeMax,
    this.rangeStep,
    this.rangeUnit,
    this.maxPhotos,
    this.conditionalOn,
    this.sortOrder,
  });

  factory DynamicFieldSpec.fromJson(Map<String, dynamic> json) {
    return DynamicFieldSpec(
      key: json['key']?.toString() ?? '',
      label: json['label']?.toString() ?? '',
      type: json['type']?.toString() ?? 'text',
      required: json['required'] == true,
      placeholder: json['placeholder']?.toString(),
      helpText: json['helpText']?.toString() ?? json['help_text']?.toString(),
      validation: json['validation'] is Map ? Map<String, dynamic>.from(json['validation']) : null,
      options: json['options'] is List ? List<String>.from(json['options'].map((o) => o.toString())) : null,
      rangeMin: json['rangeMin'] is num ? (json['rangeMin'] as num).toInt() : null,
      rangeMax: json['rangeMax'] is num ? (json['rangeMax'] as num).toInt() : null,
      rangeStep: json['rangeStep'] is num ? (json['rangeStep'] as num).toInt() : null,
      rangeUnit: json['rangeUnit']?.toString(),
      maxPhotos: json['maxPhotos'] is num ? (json['maxPhotos'] as num).toInt() : null,
      conditionalOn: json['conditionalOn'] is Map
          ? ConditionalRule.fromJson(Map<String, dynamic>.from(json['conditionalOn']))
          : null,
      sortOrder: json['sortOrder'] is num ? (json['sortOrder'] as num).toInt() : null,
    );
  }
}

class ConditionalRule {
  final String field;
  final String operator; // eq|neq|gt|lt|in
  final dynamic value;

  ConditionalRule({required this.field, required this.operator, this.value});

  factory ConditionalRule.fromJson(Map<String, dynamic> json) {
    return ConditionalRule(
      field: json['field']?.toString() ?? '',
      operator: json['operator']?.toString() ?? 'eq',
      value: json['value'],
    );
  }
}

// ── Widget ──────────────────────────────────────────────────────────────────

class DynamicFormRenderer extends StatefulWidget {
  final String catalogId;
  final Map<String, dynamic>? initialData;
  final void Function(Map<String, dynamic> answers)? onChanged;
  final bool enabled;

  const DynamicFormRenderer({
    super.key,
    required this.catalogId,
    this.initialData,
    this.onChanged,
    this.enabled = true,
  });

  @override
  State<DynamicFormRenderer> createState() => _DynamicFormRendererState();
}

class _DynamicFormRendererState extends State<DynamicFormRenderer> {
  List<DynamicFieldSpec>? _fields;
  bool _loading = true;
  String? _error;
  final Map<String, dynamic> _answers = {};
  final Map<String, List<String>> _photoUrls = {};
  final ImagePicker _picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    if (widget.initialData != null) {
      _answers.addAll(widget.initialData!);
    }
    _loadSchema();
  }

  Future<void> _loadSchema() async {
    try {
      final response = await ApiService().get('/service-catalog/${widget.catalogId}/form-template');
      final data = response['data'] as Map<String, dynamic>?;
      final schemaRaw = data?['schema'];

      List<dynamic> fieldList;
      if (schemaRaw is List) {
        fieldList = schemaRaw;
      } else if (schemaRaw is String) {
        fieldList = jsonDecode(schemaRaw) as List<dynamic>;
      } else {
        throw Exception('Invalid schema format');
      }

      if (mounted) {
        setState(() {
          _fields = fieldList
              .map((f) => DynamicFieldSpec.fromJson(f as Map<String, dynamic>))
              .toList();
          _fields!.sort((a, b) => (a.sortOrder ?? 0).compareTo(b.sortOrder ?? 0));
          _loading = false;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Failed to load form: $e';
          _loading = false;
        });
      }
    }
  }

  void _notifyChange() {
    widget.onChanged?.call(Map<String, dynamic>.from(_answers));
  }

  bool _isVisible(DynamicFieldSpec field) {
    if (field.conditionalOn == null) return true;
    final condition = field.conditionalOn!;
    final currentValue = _answers[condition.field];

    switch (condition.operator) {
      case 'eq':
        return currentValue?.toString() == condition.value?.toString();
      case 'neq':
        return currentValue?.toString() != condition.value?.toString();
      case 'gt':
        return (currentValue is num) && currentValue > (num.tryParse(condition.value.toString()) ?? 0);
      case 'lt':
        return (currentValue is num) && currentValue < (num.tryParse(condition.value.toString()) ?? 0);
      case 'in':
        if (condition.value == null) return false;
        final values = condition.value.toString().split(',');
        return values.contains(currentValue?.toString());
      default:
        return true;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Padding(
        padding: const EdgeInsets.all(16),
        child: Card(
          color: Colors.red.shade50,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                const Icon(Icons.error_outline, color: Colors.red),
                const SizedBox(width: 12),
                Expanded(child: Text(_error!, style: const TextStyle(color: Colors.red))),
                TextButton(
                  onPressed: () {
                    setState(() {
                      _loading = true;
                      _error = null;
                    });
                    _loadSchema();
                  },
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (_fields == null || _fields!.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(32),
        child: Center(child: Text('No form fields configured for this service.')),
      );
    }

    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      itemCount: _fields!.length,
      itemBuilder: (context, index) {
        final field = _fields![index];
        if (!_isVisible(field)) return const SizedBox.shrink();
        return _buildField(field);
      },
    );
  }

  Widget _buildField(DynamicFieldSpec field) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (field.label.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      field.label,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey.shade800,
                      ),
                    ),
                  ),
                  if (field.required)
                    Text(' *', style: TextStyle(color: Colors.red.shade600, fontSize: 14)),
                ],
              ),
            ),
          if (field.helpText != null && field.helpText!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text(
                field.helpText!,
                style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
              ),
            ),
          _buildFieldInput(field),
        ],
      ),
    );
  }

  Widget _buildFieldInput(DynamicFieldSpec field) {
    switch (field.type) {
      case 'textarea':
        return _buildTextareaField(field);
      case 'number':
      case 'currency':
        return _buildNumberField(field);
      case 'date':
      case 'datetime':
      case 'time':
        return _buildDateField(field);
      case 'select':
        return _buildSelectField(field, multi: false);
      case 'multiselect':
        return _buildSelectField(field, multi: true);
      case 'boolean':
        return _buildBooleanField(field);
      case 'photo':
        return _buildPhotoField(field);
      case 'range':
        return _buildRangeField(field);
      case 'rating':
        return _buildRatingField(field);
      default:
        return _buildTextField(field);
    }
  }

  // ── Text ─────────────────────────────────────────────────────────────────

  Widget _buildTextField(DynamicFieldSpec field) {
    return TextFormField(
      enabled: widget.enabled,
      initialValue: _answers[field.key]?.toString() ?? '',
      decoration: InputDecoration(
        hintText: field.placeholder,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        isDense: true,
      ),
      autovalidateMode: AutovalidateMode.onUserInteraction,
      validator: field.required ? (v) => (v == null || v.trim().isEmpty) ? '${field.label} is required' : null : null,
      onChanged: (v) {
        _answers[field.key] = v;
        _notifyChange();
      },
    );
  }

  Widget _buildTextareaField(DynamicFieldSpec field) {
    return TextFormField(
      enabled: widget.enabled,
      initialValue: _answers[field.key]?.toString() ?? '',
      maxLines: 4,
      decoration: InputDecoration(
        hintText: field.placeholder,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        isDense: true,
      ),
      autovalidateMode: AutovalidateMode.onUserInteraction,
      validator: field.required ? (v) => (v == null || v.trim().isEmpty) ? '${field.label} is required' : null : null,
      onChanged: (v) {
        _answers[field.key] = v;
        _notifyChange();
      },
    );
  }

  // ── Number / Currency ────────────────────────────────────────────────────

  Widget _buildNumberField(DynamicFieldSpec field) {
    return TextFormField(
      enabled: widget.enabled,
      initialValue: _answers[field.key]?.toString() ?? '',
      keyboardType: TextInputType.number,
      decoration: InputDecoration(
        hintText: field.placeholder,
        prefixText: field.type == 'currency' ? '\$' : null,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        isDense: true,
      ),
      autovalidateMode: AutovalidateMode.onUserInteraction,
      validator: field.required ? (v) => (v == null || v.trim().isEmpty) ? '${field.label} is required' : null : null,
      onChanged: (v) {
        final parsed = double.tryParse(v.replaceAll(',', ''));
        _answers[field.key] = parsed ?? v;
        _notifyChange();
      },
    );
  }

  // ── Date / Datetime / Time ───────────────────────────────────────────────

  Future<void> _pickDate(DynamicFieldSpec field) async {
    final now = DateTime.now();
    final initialDate = DateTime.tryParse(_answers[field.key]?.toString() ?? '') ?? now;

    if (field.type == 'time') {
      final time = await showTimePicker(
        context: context,
        initialTime: TimeOfDay.fromDateTime(initialDate),
      );
      if (time != null) {
        final t = initialDate.copyWith(hour: time.hour, minute: time.minute);
        _answers[field.key] = t.toIso8601String();
        _notifyChange();
        setState(() {});
      }
      return;
    }

    final date = await showDatePicker(
      context: context,
      initialDate: initialDate.isAfter(now) ? initialDate : now,
      firstDate: now,
      lastDate: now.add(const Duration(days: 365 * 2)),
    );
    if (date != null) {
      if (field.type == 'datetime') {
        if (!mounted) return;
        final time = await showTimePicker(
          context: context,
          initialTime: TimeOfDay.fromDateTime(initialDate),
        );
        if (time != null) {
          final dt = date.copyWith(hour: time.hour, minute: time.minute);
          _answers[field.key] = dt.toIso8601String();
        } else {
          _answers[field.key] = date.toIso8601String();
        }
      } else {
        _answers[field.key] = date.toIso8601String();
      }
      _notifyChange();
      setState(() {});
    }
  }

  Widget _buildDateField(DynamicFieldSpec field) {
    final value = _answers[field.key]?.toString();
    final displayText = value != null ? _formatDateDisplay(field.type, value) : null;

    return InkWell(
      onTap: widget.enabled ? () => _pickDate(field) : null,
      borderRadius: BorderRadius.circular(12),
      child: InputDecorator(
        decoration: InputDecoration(
          hintText: field.placeholder ?? 'Select ${field.label}',
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          isDense: true,
          suffixIcon: const Icon(Icons.calendar_today, size: 20),
        ),
        child: displayText != null
            ? Text(displayText)
            : Text(
                field.placeholder ?? 'Tap to select',
                style: TextStyle(color: Colors.grey.shade400),
              ),
      ),
    );
  }

  String _formatDateDisplay(String type, String iso) {
    final dt = DateTime.tryParse(iso);
    if (dt == null) return iso;
    if (type == 'time') {
      return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    }
    final dateStr = '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')}';
    if (type == 'datetime') {
      return '$dateStr ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    }
    return dateStr;
  }

  // ── Select / Multiselect ─────────────────────────────────────────────────

  Widget _buildSelectField(DynamicFieldSpec field, {required bool multi}) {
    final options = field.options ?? [];
    final currentValue = _answers[field.key];

    if (multi) {
      final selected = (currentValue is List) ? List<String>.from(currentValue.map((e) => e.toString())) : <String>[];
      return Wrap(
        spacing: 8,
        runSpacing: 8,
        children: options.map((option) {
          final isSelected = selected.contains(option);
          return FilterChip(
            label: Text(option, style: const TextStyle(fontSize: 13)),
            selected: isSelected,
            onSelected: widget.enabled
                ? (v) {
                    if (v) {
                      selected.add(option);
                    } else {
                      selected.remove(option);
                    }
                    _answers[field.key] = selected;
                    _notifyChange();
                    setState(() {});
                  }
                : null,
            selectedColor: Theme.of(context).colorScheme.primary.withOpacity(0.15),
            checkmarkColor: Theme.of(context).colorScheme.primary,
          );
        }).toList(),
      );
    }

    // Single select
    return DropdownButtonFormField<String>(
      value: currentValue?.toString().isNotEmpty == true && options.contains(currentValue?.toString())
          ? currentValue?.toString()
          : null,
      isExpanded: true,
      hint: Text(field.placeholder ?? 'Select ${field.label}'),
      decoration: InputDecoration(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        isDense: true,
      ),
      items: options
          .map((o) => DropdownMenuItem(value: o, child: Text(o, style: const TextStyle(fontSize: 14))))
          .toList(),
      onChanged: widget.enabled
          ? (v) {
              _answers[field.key] = v;
              _notifyChange();
              setState(() {});
            }
          : null,
      validator: field.required && multi
          ? (v) {
              final sel = _answers[field.key];
              if (sel is! List || sel.isEmpty) return '${field.label} is required';
              return null;
            }
          : field.required
              ? (v) => (v == null || v.isEmpty) ? '${field.label} is required' : null
              : null,
    );
  }

  // ── Boolean ─────────────────────────────────────────────────────────────

  Widget _buildBooleanField(DynamicFieldSpec field) {
    final value = _answers[field.key] == true;
    return SwitchListTile(
      value: value,
      title: Text(field.label, style: const TextStyle(fontSize: 14)),
      onChanged: widget.enabled
          ? (v) {
              _answers[field.key] = v;
              _notifyChange();
              setState(() {});
            }
          : null,
      contentPadding: EdgeInsets.zero,
    );
  }

  // ── Photo Upload ────────────────────────────────────────────────────────

  Future<void> _pickPhoto(DynamicFieldSpec field) async {
    final max = field.maxPhotos ?? 5;
    final current = _photoUrls[field.key] ?? <String>[];
    if (current.length >= max) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Maximum $max photos allowed')),
        );
      }
      return;
    }

    try {
      final picked = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
      if (picked != null) {
        final url = await ApiService().uploadFile(picked.path);
        if (url.isNotEmpty) {
          current.add(url);
          _photoUrls[field.key] = current;
          _answers[field.key] = current;
          _notifyChange();
          setState(() {});
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to upload photo: $e')),
        );
      }
    }
  }

  Widget _buildPhotoField(DynamicFieldSpec field) {
    final photos = _photoUrls[field.key] ?? <String>[];
    final max = field.maxPhotos ?? 5;

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        ...photos.map((url) => Stack(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Image.network(
                url.startsWith('http') ? url : '${ApiService.baseUrl.replaceFirst('/api', '')}$url',
                width: 80,
                height: 80,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade200,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.broken_image, color: Colors.grey),
                ),
              ),
            ),
            Positioned(
              top: 2,
              right: 2,
              child: GestureDetector(
                onTap: () {
                  photos.remove(url);
                  _photoUrls[field.key] = photos;
                  _answers[field.key] = photos;
                  _notifyChange();
                  setState(() {});
                },
                child: Container(
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    color: Colors.black54,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.close, size: 16, color: Colors.white),
                ),
              ),
            ),
          ],
        )),
        if (photos.length < max && widget.enabled)
          GestureDetector(
            onTap: () => _pickPhoto(field),
            child: Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                border: Border.all(color: Colors.grey.shade300, style: BorderStyle.solid),
                borderRadius: BorderRadius.circular(10),
                color: Colors.grey.shade50,
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.add_a_photo, size: 24, color: Colors.grey.shade500),
                  const SizedBox(height: 2),
                  Text('${photos.length}/$max',
                      style: TextStyle(fontSize: 10, color: Colors.grey.shade500)),
                ],
              ),
            ),
          ),
      ],
    );
  }

  // ── Range Slider ────────────────────────────────────────────────────────

  Widget _buildRangeField(DynamicFieldSpec field) {
    final min = (field.rangeMin ?? 0).toDouble();
    final max = (field.rangeMax ?? 100).toDouble();
    final steps = field.rangeStep ?? 1;
    final unit = field.rangeUnit ?? '';
    final currentValue = (_answers[field.key] is num)
        ? (_answers[field.key] as num).toDouble()
        : min;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Slider(
          value: currentValue.clamp(min, max),
          min: min,
          max: max,
          divisions: ((max - min) / steps).round().clamp(1, 100),
          label: '${currentValue.toStringAsFixed(0)} $unit',
          onChanged: widget.enabled
              ? (v) {
                  _answers[field.key] = v.round();
                  _notifyChange();
                  setState(() {});
                }
              : null,
        ),
        Align(
          alignment: Alignment.center,
          child: Text(
            '${currentValue.toStringAsFixed(0)} $unit',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.grey.shade700),
          ),
        ),
      ],
    );
  }

  // ── Rating ──────────────────────────────────────────────────────────────

  Widget _buildRatingField(DynamicFieldSpec field) {
    final rating = (_answers[field.key] is num) ? (_answers[field.key] as num).toInt() : 0;
    return Row(
      children: List.generate(5, (index) {
        return IconButton(
          onPressed: widget.enabled
              ? () {
                  _answers[field.key] = index + 1;
                  _notifyChange();
                  setState(() {});
                }
              : null,
          icon: Icon(
            index < rating ? Icons.star : Icons.star_border,
            color: index < rating ? Colors.amber : Colors.grey.shade300,
            size: 32,
          ),
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
        );
      }),
    );
  }
}