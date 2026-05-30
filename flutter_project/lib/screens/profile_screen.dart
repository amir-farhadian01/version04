import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:image_picker/image_picker.dart';
import '../theme/app_theme.dart';
import '../widgets/status_bar.dart';
import '../widgets/bottom_nav.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';

/// Profile / Account screen — redesigned with General and Address & Cars tabs.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  Map<String, dynamic>? _userData;
  bool _loading = true;
  bool _upgrading = false;
  String? _error;
  String? _success;

  // Account edit controllers
  final _displayNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _bioController = TextEditingController();
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  // Address & Cars state
  List<Map<String, dynamic>> _addresses = [];
  List<Map<String, dynamic>> _cars = [];
  bool _addressesLoading = false;
  bool _carsLoading = false;

  // Address form controllers
  final _addrLabelCtrl = TextEditingController();
  final _addrStreetCtrl = TextEditingController();
  final _addrCityCtrl = TextEditingController();
  final _addrProvinceCtrl = TextEditingController();
  final _addrPostalCtrl = TextEditingController();

  // Car form controllers
  final _carLabelCtrl = TextEditingController();
  final _carMakeCtrl = TextEditingController();
  final _carModelCtrl = TextEditingController();
  final _carYearCtrl = TextEditingController();
  final _carColorCtrl = TextEditingController();
  final _carPlateCtrl = TextEditingController();

  bool _showBizTab = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadProfile();
    _checkRole();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _displayNameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _bioController.dispose();
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    _addrLabelCtrl.dispose();
    _addrStreetCtrl.dispose();
    _addrCityCtrl.dispose();
    _addrProvinceCtrl.dispose();
    _addrPostalCtrl.dispose();
    _carLabelCtrl.dispose();
    _carMakeCtrl.dispose();
    _carModelCtrl.dispose();
    _carYearCtrl.dispose();
    _carColorCtrl.dispose();
    _carPlateCtrl.dispose();
    super.dispose();
  }

  Future<void> _checkRole() async {
    final role = await AuthService().getUserRole();
    if (role != null &&
        (role.toLowerCase() == 'provider' ||
            role.toLowerCase() == 'owner' ||
            role.toLowerCase() == 'platform_admin')) {
      setState(() => _showBizTab = true);
    }
  }

  Future<void> _loadProfile() async {
    setState(() => _loading = true);
    final userData = await AuthService().getUserData();
    try {
      final api = ApiService();
      final fresh = await api.get('/auth/me');
      setState(() {
        _userData = fresh;
        _loading = false;
      });
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('auth_user_data', jsonEncode(fresh));
    } catch (_) {
      setState(() {
        _userData = userData;
        _loading = false;
      });
    }
  }

  Future<void> _loadAddresses() async {
    setState(() => _addressesLoading = true);
    try {
      final api = ApiService();
      final items = await api.getAddresses();
      setState(() {
        _addresses = items;
        _addressesLoading = false;
      });
    } catch (_) {
      setState(() => _addressesLoading = false);
    }
  }

  Future<void> _loadCars() async {
    setState(() => _carsLoading = true);
    try {
      final api = ApiService();
      final items = await api.getCars();
      setState(() {
        _cars = items;
        _carsLoading = false;
      });
    } catch (_) {
      setState(() => _carsLoading = false);
    }
  }

  String _getDisplayName() {
    if (_userData == null) return 'User';
    final displayName = _userData!['displayName'] as String?;
    if (displayName != null && displayName.isNotEmpty) return displayName;
    final firstName = _userData!['firstName'] as String? ?? '';
    final lastName = _userData!['lastName'] as String? ?? '';
    final fullName = '$firstName $lastName'.trim();
    return fullName.isNotEmpty ? fullName : 'User';
  }

  String _getEmail() => _userData?['email'] as String? ?? '';
  String _getPhone() => _userData?['phone'] as String? ?? '';
  String _getRole() => _userData?['role'] as String? ?? 'customer';
  String? _getAvatarUrl() => _userData?['avatarUrl'] as String?;
  bool _getMfaEnabled() => _userData?['mfaEnabled'] as bool? ?? false;

  bool _isProvider() {
    final role = _getRole().toLowerCase();
    return role == 'provider' ||
        role == 'owner' ||
        role == 'platform_admin';
  }

  String _getInitial() {
    final name = _getDisplayName();
    return name.isNotEmpty ? name[0].toUpperCase() : 'U';
  }

  String _getUsername() {
    final email = _getEmail();
    return email.isNotEmpty ? '@${email.split('@').first}' : '@user';
  }

  Future<void> _handleUpgrade() async {
    setState(() {
      _upgrading = true;
      _error = null;
      _success = null;
    });
    try {
      final api = ApiService();
      await api.post('/users/me/become-provider');
      if (_userData != null) {
        _userData!['role'] = 'provider';
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('auth_user_data', jsonEncode(_userData));
      }
      setState(() {
        _success =
            'Congratulations! Your account has been upgraded to a Business Provider.';
        _upgrading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Upgrade failed. Please ensure your KYC is verified.';
        _upgrading = false;
      });
    }
  }

  // ─── Avatar Picker ────────────────────────────────────────────────────────

  Future<void> _pickAndUploadAvatar() async {
    try {
      final picker = ImagePicker();
      final picked = await picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 512,
        maxHeight: 512,
      );
      if (picked == null) return;
      final bytes = await picked.readAsBytes();
      final api = ApiService();
      final url = await api.uploadImageBytes(picked.name, bytes);
      if (url.isNotEmpty) {
        await api.put('/auth/me', body: {'avatarUrl': url});
        setState(() => _userData!['avatarUrl'] = url);
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('auth_user_data', jsonEncode(_userData));
        _showSnack('Avatar updated successfully');
      }
    } catch (e) {
      _showSnack('Failed to upload avatar');
    }
  }

  // ─── Edit Display Name ────────────────────────────────────────────────────

  Future<void> _editDisplayName() async {
    _displayNameController.text = _getDisplayName();
    final result = await _showEditDialog(
      title: 'Display Name',
      controller: _displayNameController,
      hint: 'Enter your display name',
    );
    if (result != null && result.trim().length >= 2) {
      try {
        final api = ApiService();
        await api.put('/auth/me', body: {'displayName': result.trim()});
        setState(() => _userData!['displayName'] = result.trim());
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('auth_user_data', jsonEncode(_userData));
        _showSnack('Display name updated');
      } catch (e) {
        _showSnack('Failed to update display name');
      }
    }
  }

  // ─── Edit Phone ───────────────────────────────────────────────────────────

  Future<void> _editPhone() async {
    _phoneController.text = _getPhone();
    final result = await _showEditDialog(
      title: 'Phone Number',
      controller: _phoneController,
      hint: '+1 (647) 000-0000',
      keyboardType: TextInputType.phone,
    );
    if (result != null && result.trim().length >= 5) {
      try {
        final api = ApiService();
        final resp =
            await api.put('/auth/me/phone', body: {'phone': result.trim()});
        setState(() => _userData!['phone'] = resp['phone']);
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('auth_user_data', jsonEncode(_userData));
        _showSnack('Phone number updated');
      } catch (e) {
        _showSnack(e is ApiException ? e.message : 'Failed to update phone');
      }
    }
  }

  // ─── Edit Email ───────────────────────────────────────────────────────────

  Future<void> _editEmail() async {
    _emailController.text = _getEmail();
    final result = await _showEditDialog(
      title: 'Email Address',
      controller: _emailController,
      hint: 'your@email.com',
      keyboardType: TextInputType.emailAddress,
    );
    if (result != null && result.contains('@')) {
      try {
        final api = ApiService();
        final resp =
            await api.put('/auth/me/email', body: {'email': result.trim()});
        setState(() => _userData!['email'] = resp['email']);
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('auth_user_data', jsonEncode(_userData));
        _showSnack('Email updated');
      } catch (e) {
        _showSnack(e is ApiException ? e.message : 'Failed to update email');
      }
    }
  }

  // ─── Change Password ──────────────────────────────────────────────────────

  Future<void> _changePassword() async {
    _currentPasswordController.clear();
    _newPasswordController.clear();
    _confirmPasswordController.clear();
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: _cardColor(),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Change Password',
            style: TextStyle(color: AppColors.text, fontFamily: 'Space Grotesk')),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _dialogTextField(
              controller: _currentPasswordController,
              hint: 'Current password',
              obscure: true,
            ),
            const SizedBox(height: 12),
            _dialogTextField(
              controller: _newPasswordController,
              hint: 'New password (min 8 chars)',
              obscure: true,
            ),
            const SizedBox(height: 12),
            _dialogTextField(
              controller: _confirmPasswordController,
              hint: 'Confirm new password',
              obscure: true,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: AppColors.text3)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Change', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (result == true) {
      final current = _currentPasswordController.text;
      final newPw = _newPasswordController.text;
      final confirm = _confirmPasswordController.text;
      if (current.isEmpty || newPw.isEmpty || confirm.isEmpty) {
        _showSnack('All fields are required');
        return;
      }
      if (newPw.length < 8) {
        _showSnack('New password must be at least 8 characters');
        return;
      }
      if (newPw != confirm) {
        _showSnack('New passwords do not match');
        return;
      }
      try {
        final api = ApiService();
        await api.put('/auth/me/password', body: {
          'currentPassword': current,
          'newPassword': newPw,
        });
        _showSnack('Password changed. Please log in again.');
        AuthService().logout();
        if (mounted) {
          Navigator.pushNamedAndRemoveUntil(context, '/auth', (route) => false);
        }
      } catch (e) {
        _showSnack(e is ApiException ? e.message : 'Failed to change password');
      }
    }
  }

  // ─── Toggle 2FA ───────────────────────────────────────────────────────────

  Future<void> _toggleMfa(bool enabled) async {
    try {
      final api = ApiService();
      await api.put('/auth/me/mfa', body: {'enabled': enabled});
      setState(() => _userData!['mfaEnabled'] = enabled);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('auth_user_data', jsonEncode(_userData));
      _showSnack(enabled ? '2FA enabled' : '2FA disabled');
    } catch (e) {
      _showSnack('Failed to update 2FA setting');
    }
  }

  // ─── Address CRUD ─────────────────────────────────────────────────────────

  Future<void> _showAddressDialog({Map<String, dynamic>? existing}) async {
    _addrLabelCtrl.text = existing?['label'] ?? '';
    _addrStreetCtrl.text = existing?['street'] ?? '';
    _addrCityCtrl.text = existing?['city'] ?? '';
    _addrProvinceCtrl.text = existing?['province'] ?? '';
    _addrPostalCtrl.text = existing?['postalCode'] ?? '';

    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: _cardColor(),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(existing != null ? 'Edit Address' : 'Add Address',
            style: const TextStyle(color: AppColors.text, fontFamily: 'Space Grotesk')),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _dialogTextField(controller: _addrLabelCtrl, hint: 'Label (e.g. Home, Work)'),
              const SizedBox(height: 8),
              _dialogTextField(controller: _addrStreetCtrl, hint: 'Street'),
              const SizedBox(height: 8),
              _dialogTextField(controller: _addrCityCtrl, hint: 'City'),
              const SizedBox(height: 8),
              _dialogTextField(controller: _addrProvinceCtrl, hint: 'Province'),
              const SizedBox(height: 8),
              _dialogTextField(controller: _addrPostalCtrl, hint: 'Postal Code'),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: AppColors.text3)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Save', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (saved != true) return;

    final label = _addrLabelCtrl.text.trim();
    final street = _addrStreetCtrl.text.trim();
    final city = _addrCityCtrl.text.trim();
    final province = _addrProvinceCtrl.text.trim();
    final postal = _addrPostalCtrl.text.trim();

    if (label.isEmpty || street.isEmpty || city.isEmpty || province.isEmpty || postal.isEmpty) {
      _showSnack('All fields are required');
      return;
    }

    try {
      final api = ApiService();
      if (existing != null) {
        await api.updateAddress(existing['id'], {
          'label': label, 'street': street, 'city': city,
          'province': province, 'postalCode': postal,
        });
        _showSnack('Address updated');
      } else {
        await api.createAddress({
          'label': label, 'street': street, 'city': city,
          'province': province, 'postalCode': postal,
        });
        _showSnack('Address added');
      }
      _loadAddresses();
    } catch (e) {
      _showSnack('Failed to save address');
    }
  }

  Future<void> _deleteAddress(String id) async {
    try {
      await ApiService().deleteAddress(id);
      _showSnack('Address deleted');
      _loadAddresses();
    } catch (e) {
      _showSnack('Failed to delete address');
    }
  }

  Future<void> _setDefaultAddress(String id) async {
    try {
      await ApiService().setDefaultAddress(id);
      _showSnack('Default address updated');
      _loadAddresses();
    } catch (e) {
      _showSnack('Failed to set default');
    }
  }

  // ─── Car CRUD ─────────────────────────────────────────────────────────────

  Future<void> _showCarDialog({Map<String, dynamic>? existing}) async {
    _carLabelCtrl.text = existing?['label'] ?? '';
    _carMakeCtrl.text = existing?['make'] ?? '';
    _carModelCtrl.text = existing?['model'] ?? '';
    _carYearCtrl.text = existing?['year']?.toString() ?? '';
    _carColorCtrl.text = existing?['color'] ?? '';
    _carPlateCtrl.text = existing?['plate'] ?? '';

    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: _cardColor(),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(existing != null ? 'Edit Car' : 'Add Car',
            style: const TextStyle(color: AppColors.text, fontFamily: 'Space Grotesk')),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _dialogTextField(controller: _carLabelCtrl, hint: 'Label (e.g. My Civic, Family Car)'),
              const SizedBox(height: 8),
              _dialogTextField(controller: _carMakeCtrl, hint: 'Make (e.g. Honda)'),
              const SizedBox(height: 8),
              _dialogTextField(controller: _carModelCtrl, hint: 'Model (e.g. Civic)'),
              const SizedBox(height: 8),
              _dialogTextField(controller: _carYearCtrl, hint: 'Year (e.g. 2020)', keyboardType: TextInputType.number),
              const SizedBox(height: 8),
              _dialogTextField(controller: _carColorCtrl, hint: 'Color (optional)'),
              const SizedBox(height: 8),
              _dialogTextField(controller: _carPlateCtrl, hint: 'Plate (optional)'),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: AppColors.text3)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Save', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (saved != true) return;

    final label = _carLabelCtrl.text.trim();
    final make = _carMakeCtrl.text.trim();
    final model = _carModelCtrl.text.trim();

    if (label.isEmpty || make.isEmpty || model.isEmpty) {
      _showSnack('Label, Make, and Model are required');
      return;
    }

    try {
      final api = ApiService();
      final body = <String, dynamic>{
        'label': label, 'make': make, 'model': model,
      };
      if (_carYearCtrl.text.trim().isNotEmpty) {
        body['year'] = int.tryParse(_carYearCtrl.text.trim());
      }
      if (_carColorCtrl.text.trim().isNotEmpty) body['color'] = _carColorCtrl.text.trim();
      if (_carPlateCtrl.text.trim().isNotEmpty) body['plate'] = _carPlateCtrl.text.trim();

      if (existing != null) {
        await api.updateCar(existing['id'], body);
        _showSnack('Car updated');
      } else {
        await api.createCar(body);
        _showSnack('Car added');
      }
      _loadCars();
    } catch (e) {
      _showSnack('Failed to save car');
    }
  }

  Future<void> _deleteCar(String id) async {
    try {
      await ApiService().deleteCar(id);
      _showSnack('Car deleted');
      _loadCars();
    } catch (e) {
      _showSnack('Failed to delete car');
    }
  }

  Future<void> _setDefaultCar(String id) async {
    try {
      await ApiService().setDefaultCar(id);
      _showSnack('Default car updated');
      _loadCars();
    } catch (e) {
      _showSnack('Failed to set default');
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  Color _cardColor() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return isDark ? AppColors.card : AppColorsLight.card;
  }

  Color _bgColor() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return isDark ? AppColors.bg : AppColorsLight.bg;
  }

  Color _textColor() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return isDark ? AppColors.text : AppColorsLight.text;
  }

  Color _text2Color() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return isDark ? AppColors.text2 : AppColorsLight.text2;
  }

  Color _text3Color() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return isDark ? AppColors.text3 : AppColorsLight.text3;
  }

  Color _borderColor() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return isDark ? AppColors.border : AppColorsLight.border;
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: const TextStyle(color: Colors.white)),
        backgroundColor: _cardColor(),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  Future<String?> _showEditDialog({
    required String title,
    required TextEditingController controller,
    String? hint,
    TextInputType? keyboardType,
  }) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: _cardColor(),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(title,
            style: TextStyle(color: _textColor(), fontFamily: 'Space Grotesk')),
        content: _dialogTextField(
          controller: controller,
          hint: hint,
          keyboardType: keyboardType,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: AppColors.text3)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Save', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (result == true) return controller.text;
    return null;
  }

  Widget _dialogTextField({
    required TextEditingController controller,
    String? hint,
    bool obscure = false,
    TextInputType? keyboardType,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: _bgColor(),
        border: Border.all(color: _borderColor()),
        borderRadius: BorderRadius.circular(10),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
      child: TextField(
        controller: controller,
        obscureText: obscure,
        keyboardType: keyboardType,
        style: TextStyle(color: _textColor(), fontSize: 14),
        decoration: InputDecoration.collapsed(
          hintText: hint,
          hintStyle: TextStyle(color: _text3Color()),
        ),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILD
  // ═══════════════════════════════════════════════════════════════════════════

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Column(
          children: [
            const StatusBar(title: '9:41'),
            // Header with back arrow and tabs
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: _bgColor(),
                border: Border(bottom: BorderSide(color: _borderColor())),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      GestureDetector(
                        onTap: () => Navigator.pop(context),
                        child: Icon(Icons.arrow_back, size: 20, color: _text2Color()),
                      ),
                      const SizedBox(width: 12),
                      Text('Profile',
                          style: TextStyle(
                              fontFamily: 'Space Grotesk',
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: _textColor())),
                    ],
                  ),
                  const SizedBox(height: 10),
                  TabBar(
                    controller: _tabController,
                    indicator: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    indicatorSize: TabBarIndicatorSize.tab,
                    labelColor: Colors.white,
                    unselectedLabelColor: _text3Color(),
                    labelStyle: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                    unselectedLabelStyle: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                    dividerColor: Colors.transparent,
                    onTap: (index) {
                      if (index == 1) {
                        _loadAddresses();
                        _loadCars();
                      }
                    },
                    tabs: const [
                      Tab(text: 'General'),
                      Tab(text: 'Address & Cars'),
                    ],
                  ),
                ],
              ),
            ),
            Expanded(
              child: _loading
                  ? const Center(
                      child: CircularProgressIndicator(color: AppColors.primary))
                  : TabBarView(
                      controller: _tabController,
                      children: [
                        _buildGeneralTab(),
                        _buildAddressCarsTab(),
                      ],
                    ),
            ),
          ],
        ),
        // Floating bottom nav
        Positioned(
          left: 0,
          right: 0,
          bottom: 24,
          child: BottomNav(
            showBizTab: _showBizTab,
            onItemTap: (id) {
              if (id == 'home') Navigator.pushReplacementNamed(context, '/home');
              if (id == 'social') Navigator.pushReplacementNamed(context, '/social');
              if (id == 'activity') Navigator.pushReplacementNamed(context, '/activity');
              if (id == 'biz') Navigator.pushReplacementNamed(context, '/dashboard');
            },
            items: const [
              BottomNavItem(id: 'home', label: 'Home', icon: Icons.home),
              BottomNavItem(id: 'social', label: 'Social', icon: Icons.people),
              BottomNavItem(id: 'activity', label: 'Activity', icon: Icons.auto_awesome_motion),
              BottomNavItem(id: 'biz', label: 'Business', icon: Icons.business, isBiz: true),
            ],
          ),
        ),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 1: GENERAL
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildGeneralTab() {
    final themeProvider = context.watch<ThemeProvider>();

    return SingleChildScrollView(
      padding: const EdgeInsets.only(bottom: 100), // space for floating nav
      child: Column(
        children: [
          const SizedBox(height: 24),
          // Avatar (tappable to change)
          GestureDetector(
            onTap: _pickAndUploadAvatar,
            child: Stack(
              children: [
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: AppColors.primaryDim,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.primary, width: 3),
                    image: _getAvatarUrl() != null && _getAvatarUrl()!.isNotEmpty
                        ? DecorationImage(
                            image: NetworkImage(_getAvatarUrl()!),
                            fit: BoxFit.cover,
                          )
                        : null,
                  ),
                  child: _getAvatarUrl() == null || _getAvatarUrl()!.isEmpty
                      ? Center(
                          child: Text(_getInitial(),
                              style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.primary,
                                  fontSize: 32,
                                  fontFamily: 'Space Grotesk')),
                        )
                      : null,
                ),
                Positioned(
                  bottom: 0,
                  right: 0,
                  child: Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                      border: Border.all(color: _bgColor(), width: 2),
                    ),
                    child: const Icon(Icons.camera_alt, size: 14, color: Colors.white),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Text(_getDisplayName(),
              style: TextStyle(
                  fontFamily: 'Space Grotesk',
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: _textColor())),
          const SizedBox(height: 2),
          Text(_getUsername(),
              style: TextStyle(fontSize: 12, color: _text3Color())),
          const SizedBox(height: 6),
          Text('Role: ${_getRole()}',
              style: TextStyle(fontSize: 11, color: _text3Color())),
          const SizedBox(height: 20),

          // ── Account Settings Section ──
          _buildSectionHeader('Account Settings'),
          _buildSettingTile(
            icon: Icons.badge_outlined,
            title: 'Display Name',
            subtitle: _getDisplayName(),
            onTap: _editDisplayName,
          ),
          _buildSettingTile(
            icon: Icons.email_outlined,
            title: 'Email Address',
            subtitle: _getEmail().isNotEmpty ? _getEmail() : 'Not set — Tap to add',
            subtitleColor: _getEmail().isNotEmpty ? null : AppColors.warn,
            onTap: _editEmail,
          ),
          _buildSettingTile(
            icon: Icons.phone_outlined,
            title: 'Phone Number',
            subtitle: _getPhone().isNotEmpty ? _getPhone() : 'Not set — Tap to add',
            subtitleColor: _getPhone().isNotEmpty ? null : AppColors.warn,
            onTap: _editPhone,
          ),

          const SizedBox(height: 16),

          // ── Security Section ──
          _buildSectionHeader('Security'),
          _buildSettingTile(
            icon: Icons.lock_outline,
            title: 'Change Password',
            subtitle: 'Update your login password',
            onTap: _changePassword,
          ),
          _buildSwitchTile(
            icon: Icons.verified_user_outlined,
            title: 'Authenticator (2FA)',
            subtitle: _getMfaEnabled() ? 'Enabled' : 'Disabled',
            value: _getMfaEnabled(),
            onChanged: _toggleMfa,
          ),

          const SizedBox(height: 16),

          // ── Appearance Section ──
          _buildSectionHeader('Appearance'),
          _buildSwitchTile(
            icon: Icons.dark_mode,
            title: 'Dark Mode',
            subtitle: themeProvider.isDarkMode ? 'Active' : 'Off',
            value: themeProvider.isDarkMode,
            onChanged: (val) {
              if (val) themeProvider.setDarkMode();
            },
          ),
          _buildSwitchTile(
            icon: Icons.light_mode,
            title: 'Light Mode',
            subtitle: !themeProvider.isDarkMode ? 'Active' : 'Off',
            value: !themeProvider.isDarkMode,
            onChanged: (val) {
              if (val) themeProvider.setLightMode();
            },
          ),

          const SizedBox(height: 16),

          // ── Upgrade to Business ──
          if (!_isProvider()) ...[
            _buildSectionHeader('Account Type'),
            if (_error != null)
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 18),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.red.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.red, width: 1.5),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.warning, size: 16, color: AppColors.red),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(_error!,
                          style: const TextStyle(fontSize: 12, color: AppColors.red)),
                    ),
                  ],
                ),
              ),
            if (_success != null)
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 18),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.secondary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.secondary, width: 1.5),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.check_circle, size: 16, color: AppColors.secondary),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(_success!,
                          style: const TextStyle(fontSize: 12, color: AppColors.secondary)),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 12),
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 18),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0x1A2B6EFF), Color(0x0D0FC98A)],
                ),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Switch to Business Account',
                      style: TextStyle(
                          fontFamily: 'Space Grotesk',
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: _textColor())),
                  const SizedBox(height: 4),
                  Text(
                      'Get access to provider tools, manage services, and receive orders.',
                      style: TextStyle(fontSize: 12, color: _text3Color())),
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _upgrading ? null : _handleUpgrade,
                      icon: _upgrading
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.rocket_launch, size: 18),
                      label: Text(
                          _upgrading ? 'Upgrading...' : 'Upgrade Now'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10)),
                        textStyle: const TextStyle(
                            fontWeight: FontWeight.w600, fontSize: 14),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 24),

          // ── Logout ──
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 18),
            child: OutlinedButton.icon(
              onPressed: () async {
                await AuthService().logout();
                if (mounted) {
                  Navigator.pushNamedAndRemoveUntil(
                      context, '/auth', (route) => false);
                }
              },
              icon: const Icon(Icons.logout, size: 18, color: AppColors.red),
              label: const Text('Log Out',
                  style: TextStyle(color: AppColors.red)),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppColors.red),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ),

          const SizedBox(height: 40),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 2: ADDRESS & CARS
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildAddressCarsTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.only(bottom: 100),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 20),

          // ── Addresses Section ──
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Addresses',
                    style: TextStyle(
                        fontFamily: 'Space Grotesk',
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: _textColor())),
                GestureDetector(
                  onTap: () => _showAddressDialog(),
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.add, size: 16, color: Colors.white),
                        SizedBox(width: 4),
                        Text('Add',
                            style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: Colors.white)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          if (_addressesLoading)
            const Center(
                child: Padding(
              padding: EdgeInsets.all(20),
              child: CircularProgressIndicator(color: AppColors.primary),
            ))
          else if (_addresses.isEmpty)
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 18),
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: _cardColor(),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: _borderColor()),
              ),
              child: Center(
                child: Text('No addresses yet. Tap "Add" to add one.',
                    style: TextStyle(fontSize: 13, color: _text3Color())),
              ),
            )
          else
            ...List.generate(_addresses.length, (i) {
              final addr = _addresses[i];
              final isDefault = addr['isDefault'] == true;
              return Container(
                margin: const EdgeInsets.symmetric(horizontal: 18, vertical: 4),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: _cardColor(),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: isDefault ? AppColors.primary : _borderColor(),
                    width: isDefault ? 1.5 : 1,
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: isDefault
                            ? AppColors.primary.withValues(alpha: 0.15)
                            : _borderColor().withValues(alpha: 0.3),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(
                        addr['label']?.toString().toLowerCase().contains('work') == true
                            ? Icons.work_outline
                            : Icons.home_outlined,
                        size: 20,
                        color: isDefault ? AppColors.primary : _text3Color(),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                  addr['label']?.toString() ?? 'Address',
                                  style: TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14,
                                      color: _textColor())),
                              if (isDefault) ...[
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: AppColors.primary,
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: const Text('Default',
                                      style: TextStyle(
                                          fontSize: 9,
                                          fontWeight: FontWeight.w600,
                                          color: Colors.white)),
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${addr['street'] ?? ''}, ${addr['city'] ?? ''}',
                            style:
                                TextStyle(fontSize: 12, color: _text3Color()),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    PopupMenuButton<String>(
                      icon: Icon(Icons.more_vert, size: 18, color: _text3Color()),
                      color: _cardColor(),
                      onSelected: (val) {
                        if (val == 'edit') {
                          _showAddressDialog(existing: addr);
                        } else if (val == 'default') {
                          _setDefaultAddress(addr['id']);
                        } else if (val == 'delete') {
                          _deleteAddress(addr['id']);
                        }
                      },
                      itemBuilder: (_) => [
                        const PopupMenuItem(
                            value: 'edit',
                            child: Row(children: [
                              Icon(Icons.edit, size: 16),
                              SizedBox(width: 8),
                              Text('Edit')
                            ])),
                        if (!isDefault)
                          const PopupMenuItem(
                              value: 'default',
                              child: Row(children: [
                                Icon(Icons.star, size: 16),
                                SizedBox(width: 8),
                                Text('Set as Default')
                              ])),
                        const PopupMenuItem(
                            value: 'delete',
                            child: Row(children: [
                              Icon(Icons.delete, size: 16, color: AppColors.red),
                              SizedBox(width: 8),
                              Text('Delete',
                                  style: TextStyle(color: AppColors.red))
                            ])),
                      ],
                    ),
                  ],
                ),
              );
            }),

          const SizedBox(height: 24),

          // ── Cars Section ──
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Cars',
                    style: TextStyle(
                        fontFamily: 'Space Grotesk',
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: _textColor())),
                GestureDetector(
                  onTap: () => _showCarDialog(),
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.add, size: 16, color: Colors.white),
                        SizedBox(width: 4),
                        Text('Add',
                            style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: Colors.white)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          if (_carsLoading)
            const Center(
                child: Padding(
              padding: EdgeInsets.all(20),
              child: CircularProgressIndicator(color: AppColors.primary),
            ))
          else if (_cars.isEmpty)
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 18),
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: _cardColor(),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: _borderColor()),
              ),
              child: Center(
                child: Text('No cars yet. Tap "Add" to add one.',
                    style: TextStyle(fontSize: 13, color: _text3Color())),
              ),
            )
          else
            ...List.generate(_cars.length, (i) {
              final car = _cars[i];
              final isDefault = car['isDefault'] == true;
              return Container(
                margin: const EdgeInsets.symmetric(horizontal: 18, vertical: 4),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: _cardColor(),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: isDefault ? AppColors.primary : _borderColor(),
                    width: isDefault ? 1.5 : 1,
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: isDefault
                            ? AppColors.primary.withValues(alpha: 0.15)
                            : _borderColor().withValues(alpha: 0.3),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.directions_car_outlined,
                          size: 20, color: AppColors.primary),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(car['label']?.toString() ?? 'Car',
                                  style: TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14,
                                      color: _textColor())),
                              if (isDefault) ...[
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: AppColors.primary,
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: const Text('Default',
                                      style: TextStyle(
                                          fontSize: 9,
                                          fontWeight: FontWeight.w600,
                                          color: Colors.white)),
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${car['make'] ?? ''} ${car['model'] ?? ''}'
                            '${car['year'] != null ? ' · ${car['year']}' : ''}',
                            style:
                                TextStyle(fontSize: 12, color: _text3Color()),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    PopupMenuButton<String>(
                      icon: Icon(Icons.more_vert, size: 18, color: _text3Color()),
                      color: _cardColor(),
                      onSelected: (val) {
                        if (val == 'edit') {
                          _showCarDialog(existing: car);
                        } else if (val == 'default') {
                          _setDefaultCar(car['id']);
                        } else if (val == 'delete') {
                          _deleteCar(car['id']);
                        }
                      },
                      itemBuilder: (_) => [
                        const PopupMenuItem(
                            value: 'edit',
                            child: Row(children: [
                              Icon(Icons.edit, size: 16),
                              SizedBox(width: 8),
                              Text('Edit')
                            ])),
                        if (!isDefault)
                          const PopupMenuItem(
                              value: 'default',
                              child: Row(children: [
                                Icon(Icons.star, size: 16),
                                SizedBox(width: 8),
                                Text('Set as Default')
                              ])),
                        const PopupMenuItem(
                            value: 'delete',
                            child: Row(children: [
                              Icon(Icons.delete, size: 16, color: AppColors.red),
                              SizedBox(width: 8),
                              Text('Delete',
                                  style: TextStyle(color: AppColors.red))
                            ])),
                      ],
                    ),
                  ],
                ),
              );
            }),

          const SizedBox(height: 40),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REUSABLE WIDGETS
  // ═══════════════════════════════════════════════════════════════════════════

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
      child: Text(title,
          style: TextStyle(
              fontFamily: 'Space Grotesk',
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: _text3Color())),
    );
  }

  Widget _buildSettingTile({
    required IconData icon,
    required String title,
    required String subtitle,
    Color? subtitleColor,
    required VoidCallback onTap,
  }) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 18, vertical: 4),
      decoration: BoxDecoration(
        color: _cardColor(),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _borderColor()),
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            child: Row(
              children: [
                Icon(icon, size: 22, color: _text2Color()),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title,
                          style: TextStyle(
                              fontWeight: FontWeight.w500,
                              fontSize: 14,
                              color: _textColor())),
                      const SizedBox(height: 2),
                      Text(subtitle,
                          style: TextStyle(
                              fontSize: 12,
                              color: subtitleColor ?? _text3Color())),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right, size: 20, color: _text3Color()),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSwitchTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 18, vertical: 4),
      decoration: BoxDecoration(
        color: _cardColor(),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _borderColor()),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        child: Row(
          children: [
            Icon(icon, size: 22, color: _text2Color()),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: TextStyle(
                          fontWeight: FontWeight.w500,
                          fontSize: 14,
                          color: _textColor())),
                  const SizedBox(height: 2),
                  Text(subtitle,
                      style: TextStyle(fontSize: 12, color: _text3Color())),
                ],
              ),
            ),
            Switch(
              value: value,
              onChanged: onChanged,
              activeThumbColor: AppColors.primary,
            ),
          ],
        ),
      ),
    );
  }
}