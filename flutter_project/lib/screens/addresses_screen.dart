import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';

/// Address management screen — list, add, edit, delete, set default.
class AddressesScreen extends StatefulWidget {
  const AddressesScreen({super.key});

  @override
  State<AddressesScreen> createState() => _AddressesScreenState();
}

class _AddressesScreenState extends State<AddressesScreen> {
  List<Map<String, dynamic>> _addresses = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadAddresses();
  }

  Future<void> _loadAddresses() async {
    setState(() => _loading = true);
    try {
      final items = await ApiService().getAddresses();
      setState(() {
        _addresses = items;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
      _showSnack('Failed to load addresses');
    }
  }

  Future<void> _deleteAddress(String id) async {
    try {
      await ApiService().deleteAddress(id);
      _showSnack('Address deleted');
      _loadAddresses();
    } catch (_) {
      _showSnack('Failed to delete address');
    }
  }

  Future<void> _setDefault(String id) async {
    try {
      await ApiService().setDefaultAddress(id);
      _showSnack('Default address updated');
      _loadAddresses();
    } catch (_) {
      _showSnack('Failed to set default');
    }
  }

  Future<void> _openAddressForm({Map<String, dynamic>? existing}) async {
    final updated = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => AddEditAddressScreen(existing: existing),
      ),
    );
    if (updated == true) {
      _loadAddresses();
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
        title: const Text('My Addresses',
            style: TextStyle(
                fontFamily: 'Space Grotesk',
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppColors.text)),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary))
          : _addresses.isEmpty
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.location_on_outlined,
                          size: 64, color: AppColors.text3),
                      const SizedBox(height: 16),
                      const Text('No addresses yet',
                          style: TextStyle(
                              color: AppColors.text2, fontSize: 15)),
                      const SizedBox(height: 24),
                      ElevatedButton.icon(
                        onPressed: () => _openAddressForm(),
                        icon:
                            const Icon(Icons.add, size: 18),
                        label: const Text('Add Address'),
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
                  itemCount: _addresses.length,
                  itemBuilder: (_, i) {
                    final addr = _addresses[i];
                    return _buildAddressCard(addr);
                  },
                ),
      floatingActionButton: _addresses.isNotEmpty
          ? FloatingActionButton(
              backgroundColor: AppColors.primary,
              onPressed: () => _openAddressForm(),
              child: const Icon(Icons.add, color: Colors.white),
            )
          : null,
    );
  }

  Widget _buildAddressCard(Map<String, dynamic> addr) {
    final isDefault = addr['isDefault'] == true;
    final id = addr['id'] as String;
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
              Icon(Icons.location_on_outlined,
                  size: 18,
                  color:
                      isDefault ? AppColors.primary : AppColors.text3),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  addr['label'] as String? ?? 'Address',
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
          const SizedBox(height: 6),
          Text(
            '${addr['street'] ?? ''}, ${addr['city'] ?? ''}, ${addr['province'] ?? ''} ${addr['postalCode'] ?? ''}',
            style:
                const TextStyle(fontSize: 13, color: AppColors.text3),
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
                onPressed: () => _openAddressForm(existing: addr),
                child: const Text('Edit',
                    style: TextStyle(
                        fontSize: 12, color: AppColors.text2)),
              ),
              TextButton(
                onPressed: () => _deleteAddress(id),
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

/// Add/Edit Address form screen.
class AddEditAddressScreen extends StatefulWidget {
  final Map<String, dynamic>? existing;
  const AddEditAddressScreen({super.key, this.existing});

  @override
  State<AddEditAddressScreen> createState() => _AddEditAddressScreenState();
}

class _AddEditAddressScreenState extends State<AddEditAddressScreen> {
  final _labelCtrl = TextEditingController();
  final _streetCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();
  final _provinceCtrl = TextEditingController();
  final _postalCtrl = TextEditingController();
  final _countryCtrl = TextEditingController(text: 'CA');

  bool _saving = false;

  bool get _isEdit => widget.existing != null;

  @override
  void initState() {
    super.initState();
    if (widget.existing != null) {
      final a = widget.existing!;
      _labelCtrl.text = a['label'] as String? ?? '';
      _streetCtrl.text = a['street'] as String? ?? '';
      _cityCtrl.text = a['city'] as String? ?? '';
      _provinceCtrl.text = a['province'] as String? ?? '';
      _postalCtrl.text = a['postalCode'] as String? ?? '';
      _countryCtrl.text = a['country'] as String? ?? 'CA';
    }
  }

  @override
  void dispose() {
    _labelCtrl.dispose();
    _streetCtrl.dispose();
    _cityCtrl.dispose();
    _provinceCtrl.dispose();
    _postalCtrl.dispose();
    _countryCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final label = _labelCtrl.text.trim();
    final street = _streetCtrl.text.trim();
    final city = _cityCtrl.text.trim();
    final province = _provinceCtrl.text.trim();
    final postal = _postalCtrl.text.trim();
    final country = _countryCtrl.text.trim();

    if (label.isEmpty || street.isEmpty || city.isEmpty ||
        province.isEmpty || postal.isEmpty) {
      _showSnack('All fields are required');
      return;
    }

    setState(() => _saving = true);
    try {
      final api = ApiService();
      final body = <String, dynamic>{
        'label': label,
        'street': street,
        'city': city,
        'province': province,
        'postalCode': postal,
        'country': country,
      };

      if (_isEdit) {
        await api.updateAddress(widget.existing!['id'] as String, body);
        _showSnack('Address updated');
      } else {
        await api.createAddress(body);
        _showSnack('Address added');
      }

      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      _showSnack('Failed to save address');
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
        title: Text(_isEdit ? 'Edit Address' : 'Add Address',
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
                hint: 'Label (e.g. Home, Work)',
                icon: Icons.label_outline),
            _field(
                controller: _streetCtrl,
                hint: 'Street Address',
                icon: Icons.home_outlined),
            _field(
                controller: _cityCtrl,
                hint: 'City',
                icon: Icons.location_city),
            _field(
                controller: _provinceCtrl,
                hint: 'Province / State',
                icon: Icons.map_outlined),
            _field(
                controller: _postalCtrl,
                hint: 'Postal Code',
                icon: Icons.markunread_mailbox_outlined),
            _field(
                controller: _countryCtrl,
                hint: 'Country (default: CA)',
                icon: Icons.public_outlined),
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
                child: Text(_isEdit ? 'Update Address' : 'Add Address',
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