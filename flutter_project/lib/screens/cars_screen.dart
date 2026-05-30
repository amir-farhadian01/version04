import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';

/// Car management screen — list, add, edit, delete, set default.
class CarsScreen extends StatefulWidget {
  const CarsScreen({super.key});

  @override
  State<CarsScreen> createState() => _CarsScreenState();
}

class _CarsScreenState extends State<CarsScreen> {
  List<Map<String, dynamic>> _cars = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadCars();
  }

  Future<void> _loadCars() async {
    setState(() => _loading = true);
    try {
      final items = await ApiService().getCars();
      setState(() {
        _cars = items;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
      _showSnack('Failed to load cars');
    }
  }

  Future<void> _deleteCar(String id) async {
    try {
      await ApiService().deleteCar(id);
      _showSnack('Car deleted');
      _loadCars();
    } catch (_) {
      _showSnack('Failed to delete car');
    }
  }

  Future<void> _setDefault(String id) async {
    try {
      await ApiService().setDefaultCar(id);
      _showSnack('Default car updated');
      _loadCars();
    } catch (_) {
      _showSnack('Failed to set default');
    }
  }

  Future<void> _openCarForm({Map<String, dynamic>? existing}) async {
    final updated = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => AddEditCarScreen(existing: existing),
      ),
    );
    if (updated == true) {
      _loadCars();
    }
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content:
            Text(message, style: const TextStyle(color: Colors.white)),
        backgroundColor: AppColors.card,
        behavior: SnackBarBehavior.floating,
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.text2),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('My Cars',
            style: TextStyle(
                fontFamily: 'Space Grotesk',
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppColors.text)),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary))
          : _cars.isEmpty
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.directions_car_outlined,
                          size: 64, color: AppColors.text3),
                      const SizedBox(height: 16),
                      const Text('No cars yet',
                          style: TextStyle(
                              color: AppColors.text2, fontSize: 15)),
                      const SizedBox(height: 24),
                      ElevatedButton.icon(
                        onPressed: () => _openCarForm(),
                        icon:
                            const Icon(Icons.add, size: 18),
                        label: const Text('Add Car'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(
                              horizontal: 24, vertical: 12),
                          shape: RoundedRectangleBorder(
                              borderRadius:
                                  BorderRadius.circular(10)),
                        ),
                      ),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _cars.length,
                  itemBuilder: (_, i) {
                    final car = _cars[i];
                    return _buildCarCard(car);
                  },
                ),
      floatingActionButton: _cars.isNotEmpty
          ? FloatingActionButton(
              backgroundColor: AppColors.primary,
              onPressed: () => _openCarForm(),
              child: const Icon(Icons.add, color: Colors.white),
            )
          : null,
    );
  }

  Widget _buildCarCard(Map<String, dynamic> car) {
    final isDefault = car['isDefault'] == true;
    final id = car['id'] as String;
    final make = car['make'] as String? ?? '';
    final model = car['model'] as String? ?? '';
    final year = car['year'];
    final color = car['color'] as String? ?? '';
    final plate = car['plate'] as String? ?? '';
    final label = car['label'] as String? ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
            color: isDefault ? AppColors.primary : AppColors.border,
            width: isDefault ? 1.5 : 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.directions_car_outlined,
                  size: 18,
                  color:
                      isDefault ? AppColors.primary : AppColors.text3),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '$make $model'.trim(),
                  style: const TextStyle(
                      fontFamily: 'Space Grotesk',
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                      color: AppColors.text),
                ),
              ),
              if (isDefault)
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text('Default',
                      style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primary)),
                ),
            ],
          ),
          if (label.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(label,
                style: const TextStyle(
                    fontSize: 12, color: AppColors.text2)),
          ],
          const SizedBox(height: 4),
          Text(
            [
              if (year != null) '$year',
              if (color.isNotEmpty) color,
              if (plate.isNotEmpty) plate,
            ].join(' · '),
            style:
                const TextStyle(fontSize: 12, color: AppColors.text3),
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              if (!isDefault)
                TextButton(
                  onPressed: () => _setDefault(id),
                  child: const Text('Set as Default',
                      style: TextStyle(
                          fontSize: 12, color: AppColors.primary)),
                ),
              const SizedBox(width: 4),
              TextButton(
                onPressed: () => _openCarForm(existing: car),
                child: const Text('Edit',
                    style: TextStyle(
                        fontSize: 12, color: AppColors.text2)),
              ),
              TextButton(
                onPressed: () => _deleteCar(id),
                child: const Text('Delete',
                    style: TextStyle(
                        fontSize: 12, color: AppColors.red)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Add/Edit Car form screen.
class AddEditCarScreen extends StatefulWidget {
  final Map<String, dynamic>? existing;
  const AddEditCarScreen({super.key, this.existing});

  @override
  State<AddEditCarScreen> createState() => _AddEditCarScreenState();
}

class _AddEditCarScreenState extends State<AddEditCarScreen> {
  final _labelCtrl = TextEditingController();
  final _makeCtrl = TextEditingController();
  final _modelCtrl = TextEditingController();
  final _yearCtrl = TextEditingController();
  final _colorCtrl = TextEditingController();
  final _plateCtrl = TextEditingController();

  bool _saving = false;

  bool get _isEdit => widget.existing != null;

  @override
  void initState() {
    super.initState();
    if (widget.existing != null) {
      final c = widget.existing!;
      _labelCtrl.text = c['label'] as String? ?? '';
      _makeCtrl.text = c['make'] as String? ?? '';
      _modelCtrl.text = c['model'] as String? ?? '';
      _yearCtrl.text = c['year']?.toString() ?? '';
      _colorCtrl.text = c['color'] as String? ?? '';
      _plateCtrl.text = c['plate'] as String? ?? '';
    }
  }

  @override
  void dispose() {
    _labelCtrl.dispose();
    _makeCtrl.dispose();
    _modelCtrl.dispose();
    _yearCtrl.dispose();
    _colorCtrl.dispose();
    _plateCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final label = _labelCtrl.text.trim();
    final make = _makeCtrl.text.trim();
    final model = _modelCtrl.text.trim();

    if (label.isEmpty || make.isEmpty || model.isEmpty) {
      _showSnack('Label, Make, and Model are required');
      return;
    }

    setState(() => _saving = true);
    try {
      final api = ApiService();
      final body = <String, dynamic>{
        'label': label,
        'make': make,
        'model': model,
      };

      final yearStr = _yearCtrl.text.trim();
      if (yearStr.isNotEmpty) {
        final year = int.tryParse(yearStr);
        if (year != null) body['year'] = year;
      }
      final color = _colorCtrl.text.trim();
      if (color.isNotEmpty) body['color'] = color;
      final plate = _plateCtrl.text.trim();
      if (plate.isNotEmpty) body['plate'] = plate;

      if (_isEdit) {
        await api.updateCar(widget.existing!['id'] as String, body);
        _showSnack('Car updated');
      } else {
        await api.createCar(body);
        _showSnack('Car added');
      }

      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      _showSnack('Failed to save car');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _showSnack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content:
            Text(message, style: const TextStyle(color: Colors.white)),
        backgroundColor: AppColors.card,
        behavior: SnackBarBehavior.floating,
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  Widget _field({
    required TextEditingController controller,
    required String hint,
    IconData? icon,
    TextInputType? keyboardType,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.bg,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(10),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: TextField(
        controller: controller,
        keyboardType: keyboardType,
        style: const TextStyle(color: AppColors.text, fontSize: 14),
        decoration: InputDecoration(
          border: InputBorder.none,
          hintText: hint,
          hintStyle: const TextStyle(color: AppColors.text3),
          prefixIcon: icon != null
              ? Icon(icon, size: 18, color: AppColors.text3)
              : null,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.text2),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(_isEdit ? 'Edit Car' : 'Add Car',
            style: const TextStyle(
                fontFamily: 'Space Grotesk',
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppColors.text)),
        actions: [
          TextButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: AppColors.primary),
                  )
                : const Text('Save',
                    style: TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w600)),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            _field(
                controller: _labelCtrl,
                hint: 'Label (e.g. My Civic, Family Car)',
                icon: Icons.label_outline),
            _field(
                controller: _makeCtrl,
                hint: 'Make (e.g. Honda)',
                icon: Icons.precision_manufacturing_outlined),
            _field(
                controller: _modelCtrl,
                hint: 'Model (e.g. Civic)',
                icon: Icons.directions_car_outlined),
            _field(
                controller: _yearCtrl,
                hint: 'Year (e.g. 2020)',
                icon: Icons.calendar_today_outlined,
                keyboardType: TextInputType.number),
            _field(
                controller: _colorCtrl,
                hint: 'Color (optional)',
                icon: Icons.palette_outlined),
            _field(
                controller: _plateCtrl,
                hint: 'License Plate (optional)',
                icon: Icons.confirmation_number_outlined),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _saving ? null : _save,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
                child: Text(_isEdit ? 'Update Car' : 'Add Car',
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 14)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}