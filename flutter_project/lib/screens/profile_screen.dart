import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/status_bar.dart';
import '../widgets/bottom_nav.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import 'addresses_screen.dart';
import 'cars_screen.dart';

/// Redesigned Profile Screen — Dark Mode, Line Icons, Flat Menu List.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? _userData;
  bool _loading = true;
  bool _showBizTab = false;

  final _displayNameController = TextEditingController();
  final _emailController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadProfile();
    _checkRole();
  }

  @override
  void dispose() {
    _displayNameController.dispose();
    _emailController.dispose();
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
  String? _getAvatarUrl() => _userData?['avatarUrl'] as String?;

  String _getInitial() {
    final name = _getDisplayName();
    return name.isNotEmpty ? name[0].toUpperCase() : 'U';
  }

  // ─── Avatar Picker ────────────────────────────────────────────────────
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
        _showSnack('Avatar updated');
      }
    } catch (e) {
      _showSnack('Failed to upload avatar');
    }
  }

  // ─── Edit Profile Dialog ──────────────────────────────────────────────
  Future<void> _editProfile() async {
    _displayNameController.text = _getDisplayName();
    _emailController.text = _getEmail();

    final result = await showDialog<Map<String, String>>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Edit Profile',
            style: TextStyle(
                fontFamily: 'Space Grotesk',
                color: AppColors.text,
                fontWeight: FontWeight.w600)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _dialogField(
              controller: _displayNameController,
              hint: 'Display Name',
              icon: Icons.person_outline,
            ),
            const SizedBox(height: 12),
            _dialogField(
              controller: _emailController,
              hint: 'Email',
              icon: Icons.email_outlined,
              keyboardType: TextInputType.emailAddress,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel',
                style: TextStyle(color: AppColors.text3)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx, {
                'displayName': _displayNameController.text.trim(),
                'email': _emailController.text.trim(),
              });
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Save',
                style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (result == null) return;
    final displayName = result['displayName'] ?? '';
    final email = result['email'] ?? '';

    if (displayName.length >= 2) {
      try {
        final api = ApiService();
        await api.put('/auth/me', body: {'displayName': displayName});
        setState(() => _userData!['displayName'] = displayName);
        _showSnack('Display name updated');
      } catch (e) {
        _showSnack('Failed to update display name');
      }
    }

    if (email.isNotEmpty && email.contains('@')) {
      try {
        final api = ApiService();
        final resp = await api.put('/auth/me/email', body: {'email': email});
        setState(() => _userData!['email'] = resp['email']);
        _showSnack('Email updated');
      } catch (e) {
        _showSnack(
            e is ApiException ? e.message : 'Failed to update email');
      }
    }
  }

  // ─── Clear Cache ──────────────────────────────────────────────────────
  Future<void> _clearCache() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Clear Cache',
            style: TextStyle(
                fontFamily: 'Space Grotesk',
                color: AppColors.text,
                fontWeight: FontWeight.w600)),
        content: const Text(
            'Are you sure you want to clear the app cache?',
            style: TextStyle(color: AppColors.text2)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel',
                style: TextStyle(color: AppColors.text3)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.red,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Clear',
                style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      // Clear image cache
      imageCache.clear();
      imageCache.clearLiveImages();

      // Clear SharedPreferences caches (keep auth data)
      final prefs = await SharedPreferences.getInstance();
      final keysToKeep = {'auth_token', 'auth_user_data', 'dark_mode'};
      final allKeys = prefs.getKeys().toList();
      for (final key in allKeys) {
        if (!keysToKeep.contains(key)) {
          await prefs.remove(key);
        }
      }

      // Clear temp directory
      try {
        final tempDir = await getTemporaryDirectory();
        if (tempDir.existsSync()) {
          for (final entity in tempDir.listSync()) {
            if (entity is File) {
              await entity.delete();
            }
          }
        }
      } catch (_) {
        // Temp dir cleanup is best-effort
      }

      _showSnack('Cache cleared successfully');
    } catch (e) {
      _showSnack('Failed to clear cache');
    }
  }

  // ─── Logout ───────────────────────────────────────────────────────────
  Future<void> _logout() async {
    await AuthService().logout();
    if (mounted) {
      Navigator.pushNamedAndRemoveUntil(
          context, '/auth', (route) => false);
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────
  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message,
            style: const TextStyle(color: Colors.white)),
        backgroundColor: AppColors.card,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  Widget _dialogField({
    required TextEditingController controller,
    required String hint,
    IconData? icon,
    TextInputType? keyboardType,
  }) {
    return Container(
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

  // ═══════════════════════════════════════════════════════════════════════
  // BUILD
  // ═══════════════════════════════════════════════════════════════════════

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Column(
          children: [
            const StatusBar(title: '9:41'),
            // Header
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.bg,
                border: Border(
                    bottom: BorderSide(color: AppColors.border)),
              ),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: const Icon(Icons.arrow_back,
                        size: 20, color: AppColors.text2),
                  ),
                  const SizedBox(width: 12),
                  const Text('Profile',
                      style: TextStyle(
                          fontFamily: 'Space Grotesk',
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: AppColors.text)),
                ],
              ),
            ),
            // Body
            Expanded(
              child: _loading
                  ? const Center(
                      child: CircularProgressIndicator(
                          color: AppColors.primary))
                  : SingleChildScrollView(
                      padding: const EdgeInsets.only(bottom: 100),
                      child: Column(
                        children: [
                          const SizedBox(height: 24),
                          _buildProfileHeader(),
                          const SizedBox(height: 24),
                          _buildMenuSection(),
                          const SizedBox(height: 16),
                          _buildBottomSection(),
                          const SizedBox(height: 50),
                        ],
                      ),
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
              if (id == 'home') {
                Navigator.pushReplacementNamed(context, '/home');
              }
              if (id == 'social') {
                Navigator.pushReplacementNamed(context, '/social');
              }
              if (id == 'activity') {
                Navigator.pushReplacementNamed(context, '/activity');
              }
              if (id == 'biz') {
                Navigator.pushReplacementNamed(context, '/dashboard');
              }
            },
            items: const [
              BottomNavItem(
                  id: 'home', label: 'Home', icon: Icons.home),
              BottomNavItem(
                  id: 'social',
                  label: 'Social',
                  icon: Icons.people),
              BottomNavItem(
                  id: 'activity',
                  label: 'Activity',
                  icon: Icons.auto_awesome_motion),
              BottomNavItem(
                  id: 'biz',
                  label: 'Business',
                  icon: Icons.business,
                  isBiz: true),
            ],
          ),
        ),
      ],
    );
  }

  // ─── Profile Header ───────────────────────────────────────────────────
  Widget _buildProfileHeader() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          // Avatar
          GestureDetector(
            onTap: _pickAndUploadAvatar,
            child: Stack(
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.primaryDim,
                    border: Border.all(
                        color: AppColors.primary, width: 2),
                    image: _getAvatarUrl() != null &&
                            _getAvatarUrl()!.isNotEmpty
                        ? DecorationImage(
                            image: NetworkImage(_getAvatarUrl()!),
                            fit: BoxFit.cover,
                          )
                        : null,
                  ),
                  child: _getAvatarUrl() == null ||
                          _getAvatarUrl()!.isEmpty
                      ? Center(
                          child: Text(_getInitial(),
                              style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.primary,
                                  fontSize: 28,
                                  fontFamily: 'Space Grotesk')),
                        )
                      : null,
                ),
                Positioned(
                  bottom: 0,
                  right: 0,
                  child: Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                      border: Border.all(
                          color: AppColors.bg, width: 2),
                    ),
                    child: const Icon(Icons.camera_alt,
                        size: 12, color: Colors.white),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          // Name + Email + Edit
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_getDisplayName(),
                    style: const TextStyle(
                        fontFamily: 'Space Grotesk',
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        color: AppColors.text)),
                const SizedBox(height: 4),
                Text(_getEmail(),
                    style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.text3)),
              ],
            ),
          ),
          // Edit button
          GestureDetector(
            onTap: _editProfile,
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.primaryDim,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.edit_outlined,
                  size: 18, color: AppColors.primary),
            ),
          ),
        ],
      ),
    );
  }

  // ─── Menu Section ─────────────────────────────────────────────────────
  Widget _buildMenuSection() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 18),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          _buildMenuItem(
            icon: Icons.calendar_today_outlined,
            title: 'My Appointments',
            onTap: () {
              Navigator.pushNamed(context, '/appointments');
            },
          ),
          _buildDivider(),
          _buildMenuItem(
            icon: Icons.favorite_border,
            title: 'Saved Businesses',
            onTap: () {
              Navigator.pushNamed(context, '/saved');
            },
          ),
          _buildDivider(),
          _buildMenuItem(
            icon: Icons.account_balance_wallet_outlined,
            title: 'Payments & Wallet',
            onTap: () {
              Navigator.pushNamed(context, '/payments');
            },
          ),
          _buildDivider(),
          _buildMenuItem(
            icon: Icons.location_on_outlined,
            title: 'My Addresses',
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                    builder: (_) => const AddressesScreen()),
              );
            },
          ),
          _buildDivider(),
          _buildMenuItem(
            icon: Icons.directions_car_outlined,
            title: 'My Cars',
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                    builder: (_) => const CarsScreen()),
              );
            },
          ),
          _buildDivider(),
          _buildMenuItem(
            icon: Icons.notifications_outlined,
            title: 'Notifications',
            badge: '3',
            onTap: () {
              Navigator.pushNamed(context, '/notifications');
            },
          ),
          _buildDivider(),
          _buildMenuItem(
            icon: Icons.help_outline,
            title: 'Help & Support',
            onTap: () {
              Navigator.pushNamed(context, '/help');
            },
          ),
          _buildDivider(),
          _buildMenuItem(
            icon: Icons.delete_outline,
            title: 'Clear Cache',
            onTap: _clearCache,
          ),
        ],
      ),
    );
  }

  Widget _buildMenuItem({
    required IconData icon,
    required String title,
    String? badge,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Icon(icon, size: 22, color: AppColors.text2),
              const SizedBox(width: 14),
              Expanded(
                child: Text(title,
                    style: const TextStyle(
                        fontWeight: FontWeight.w500,
                        fontSize: 14,
                        color: AppColors.text)),
              ),
              if (badge != null) ...[
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.red,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(badge,
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.w700)),
                ),
                const SizedBox(width: 8),
              ],
              const Icon(Icons.chevron_right,
                  size: 20, color: AppColors.text3),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDivider() {
    return Divider(
      height: 1,
      thickness: 1,
      color: AppColors.border.withValues(alpha: 0.5),
      indent: 50,
      endIndent: 16,
    );
  }

  // ─── Bottom Section ───────────────────────────────────────────────────
  Widget _buildBottomSection() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18),
      child: Column(
        children: [
          // Settings
          Container(
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: _buildMenuItem(
              icon: Icons.settings_outlined,
              title: 'Settings',
              onTap: () {
                Navigator.pushNamed(context, '/settings');
              },
            ),
          ),
          const SizedBox(height: 12),
          // Logout
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _logout,
              icon:
                  const Icon(Icons.logout, size: 18, color: AppColors.red),
              label: const Text('Logout',
                  style: TextStyle(
                      color: AppColors.red,
                      fontWeight: FontWeight.w600,
                      fontSize: 14)),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppColors.red),
                padding:
                    const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
                backgroundColor:
                    AppColors.red.withValues(alpha: 0.05),
              ),
            ),
          ),
        ],
      ),
    );
  }
}