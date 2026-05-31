import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/bottom_nav.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';
import 'addresses_screen.dart';
import 'cars_screen.dart';

/// Redesigned Profile Screen — Dark Mode, Grouped Menu, Accordion, Share Dialog.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen>
    with SingleTickerProviderStateMixin {
  Map<String, dynamic>? _userData;
  bool _loading = true;
  bool _showBizTab = false;

  /// Follow counts
  int _followerCount = 0;
  int _followingCount = 0;

  /// Personal Info accordion
  bool _personalInfoOpen = false;


  /// Pulse animation
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  final _displayNameController = TextEditingController();
  final _emailController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    _pulseAnimation = Tween<double>(begin: 10, end: 28).animate(_pulseController);
    _loadProfile();
    _checkRole();
  }

  @override
  void dispose() {
    _pulseController.dispose();
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
      final userId = fresh['id'] as String? ?? '';
      setState(() {
        _userData = fresh;
        _loading = false;
      });
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('auth_user_data', jsonEncode(fresh));
      if (userId.isNotEmpty) {
        _loadFollowCounts(userId);
      }
    } catch (_) {
      setState(() {
        _userData = userData;
        _loading = false;
      });
    }
  }

  Future<void> _loadFollowCounts(String userId) async {
    try {
      final counts = await ApiService().getFollowCounts(userId);
      if (mounted) {
        setState(() {
          _followerCount = counts['followers'] ?? 0;
          _followingCount = counts['following'] ?? 0;
        });
      }
    } catch (_) {}
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
  String _getUserId() => _userData?['id'] as String? ?? '';

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
      imageCache.clear();
      imageCache.clearLiveImages();
      final prefs = await SharedPreferences.getInstance();
      final keysToKeep = {'auth_token', 'auth_user_data', 'dark_mode'};
      final allKeys = prefs.getKeys().toList();
      for (final key in allKeys) {
        if (!keysToKeep.contains(key)) {
          await prefs.remove(key);
        }
      }
      try {
        final tempDir = await getTemporaryDirectory();
        if (tempDir.existsSync()) {
          for (final entity in tempDir.listSync()) {
            if (entity is File) {
              await entity.delete();
            }
          }
        }
      } catch (_) {}
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

  // ─── Share Profile ───────────────────────────────────────────────────
  void _showShareDialog() {
    final profileLink = 'neighborly://user/${_getUserId()}';
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _ShareProfileSheet(
        profileLink: profileLink,
        displayName: _getDisplayName(),
        userId: _getUserId(),
      ),
    );
  }

  // ─── Helpers ─────────────────────────────────────────────────────────
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

  /// Stat helper
  Widget _followStat(IconData icon, String count, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: AppColors.text2),
        const SizedBox(width: 4),
        Text(
          count,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: AppColors.text,
            fontFamily: 'Space Grotesk',
          ),
        ),
        const SizedBox(width: 2),
        Text(
          label,
          style: const TextStyle(fontSize: 11, color: AppColors.text3),
        ),
      ],
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
                          const SizedBox(height: 32),
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

  // ─── Profile Header (centered, with glow) ───────────────────────────
  Widget _buildProfileHeader() {
    return AnimatedBuilder(
      animation: _pulseAnimation,
      builder: (context, child) {
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            children: [
              // Avatar with glow and share button
              Stack(
                clipBehavior: Clip.none,
                children: [
                  GestureDetector(
                    onTap: _pickAndUploadAvatar,
                    child: Container(
                      width: 96,
                      height: 96,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppColors.primaryDim,
                        border: Border.all(
                            color: AppColors.primary, width: 2),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.primary.withOpacity(0.25),
                            blurRadius: _pulseAnimation.value,
                            spreadRadius: 2,
                          ),
                        ],
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
                              child: Text(
                                _getInitial(),
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.primary,
                                  fontSize: 32,
                                  fontFamily: 'Space Grotesk',
                                ),
                              ),
                            )
                          : null,
                    ),
                  ),
                  // Camera badge
                  Positioned(
                    bottom: 0,
                    right: 0,
                    child: Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        shape: BoxShape.circle,
                        border: Border.all(
                            color: AppColors.bg, width: 2),
                      ),
                      child: const Icon(Icons.camera_alt,
                          size: 14, color: Colors.white),
                    ),
                  ),
                  // Share button
                  Positioned(
                    top: -4,
                    right: -4,
                    child: GestureDetector(
                      onTap: _showShareDialog,
                      child: Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: AppColors.card,
                          shape: BoxShape.circle,
                          border: Border.all(
                              color: AppColors.border, width: 1),
                        ),
                        child: const Icon(Icons.share,
                            size: 15, color: AppColors.text),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              // Name
              Text(
                _getDisplayName(),
                style: const TextStyle(
                  fontFamily: 'Space Grotesk',
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: AppColors.text,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 4),
              // Email
              Text(
                _getEmail(),
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.text3,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              // Follow counts
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _followStat(Icons.people_outline, '$_followerCount', 'followers'),
                  const SizedBox(width: 20),
                  _followStat(Icons.person_add_outlined, '$_followingCount', 'following'),
                ],
              ),
              const SizedBox(height: 12),
              // Edit profile button
              GestureDetector(
                onTap: _editProfile,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.primaryDim,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: const [
                      Icon(Icons.edit, size: 14, color: AppColors.primary),
                      SizedBox(width: 6),
                      Text(
                        'Edit Profile',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  // ─── Menu Section (3 grouped sections) ───────────────────────────────
  Widget _buildMenuSection() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18),
      child: Column(
        children: [
          // ═══ Section 1: MY SERVICES ═══
          _buildSectionHeader('MY SERVICES'),
          _buildSectionCard([
            _menuItem(
              icon: Icons.calendar_month_outlined,
              title: 'My Appointments',
              color: AppColors.primary,
              onTap: () {},
            ),
            _menuItem(
              icon: Icons.favorite_outline,
              title: 'Saved Businesses',
              color: AppColors.primary,
              onTap: () {},
            ),
            _menuItem(
              icon: Icons.account_balance_wallet_outlined,
              title: 'Payments & Wallet',
              color: AppColors.primary,
              onTap: () {},
            ),
          ]),

          const SizedBox(height: 20),

          // ═══ Section 2: PERSONAL INFO (Accordion) ═══
          _buildSectionHeader('PERSONAL INFO'),
          Container(
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              children: [
                // Accordion header
                GestureDetector(
                  onTap: () =>
                      setState(() => _personalInfoOpen = !_personalInfoOpen),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 14),
                    child: Row(
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: AppColors.purple.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(Icons.people_outline,
                              size: 22, color: AppColors.purple),
                        ),
                        const SizedBox(width: 14),
                        const Expanded(
                          child: Text(
                            'My Addresses & Cars',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                              color: AppColors.text,
                            ),
                          ),
                        ),
                        AnimatedRotation(
                          turns: _personalInfoOpen ? 0.5 : 0,
                          duration: const Duration(milliseconds: 300),
                          child: const Icon(Icons.keyboard_arrow_down,
                              size: 20, color: AppColors.text3),
                        ),
                      ],
                    ),
                  ),
                ),
                // Accordion content
                AnimatedCrossFade(
                  firstChild: const SizedBox(width: double.infinity),
                  secondChild: Column(
                    children: [
                      _divider(),
                      AnimatedOpacity(
                        opacity: _personalInfoOpen ? 1.0 : 0.0,
                        duration: const Duration(milliseconds: 200),
                        child: _menuItem(
                          icon: Icons.location_on_outlined,
                          title: 'My Addresses',
                          color: AppColors.purple,
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => const AddressesScreen()),
                          ),
                        ),
                      ),
                      _divider(),
                      AnimatedOpacity(
                        opacity: _personalInfoOpen ? 1.0 : 0.0,
                        duration: const Duration(milliseconds: 200),
                        child: _menuItem(
                          icon: Icons.directions_car_outlined,
                          title: 'My Cars',
                          color: AppColors.purple,
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => const CarsScreen()),
                          ),
                        ),
                      ),
                    ],
                  ),
                  crossFadeState: _personalInfoOpen
                      ? CrossFadeState.showSecond
                      : CrossFadeState.showFirst,
                  duration: const Duration(milliseconds: 300),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // ═══ Section 3: SETTINGS & SUPPORT ═══
          _buildSectionHeader('SETTINGS & SUPPORT'),
          _buildSectionCard([
            _menuItem(
              icon: Icons.notifications_outlined,
              title: 'Notifications',
              color: AppColors.primary,
              badge: '3',
              onTap: () {},
            ),
            _menuItem(
              icon: Icons.help_outline,
              title: 'Help & Support',
              color: AppColors.primary,
              onTap: () {},
            ),
            _menuItem(
              icon: Icons.delete_outline,
              title: 'Clear Cache',
              color: AppColors.red,
              onTap: _clearCache,
            ),
          ]),
        ],
      ),
    );
  }

  // ─── Section Header ───────────────────────────────────────────────────
  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: Color(0xFF888888),
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 4),
          Divider(
            height: 1,
            thickness: 1,
            color: AppColors.border.withOpacity(0.4),
          ),
        ],
      ),
    );
  }

  // ─── Section Card ─────────────────────────────────────────────────────
  Widget _buildSectionCard(List<Widget> items) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: _intersperse(items, _divider()),
      ),
    );
  }

  // ─── Menu Item ────────────────────────────────────────────────────────
  Widget _menuItem({
    required IconData icon,
    required String title,
    required Color color,
    String? badge,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: () {
        // Tap animation
        setState(() {});
        onTap();
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, size: 22, color: color),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: AppColors.text,
                ),
              ),
            ),
            if (badge != null)
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.red,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  badge,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            if (badge != null) const SizedBox(width: 8),
            const Icon(Icons.chevron_right,
                size: 20, color: AppColors.text3),
          ],
        ),
      ),
    );
  }

  // ─── Divider ──────────────────────────────────────────────────────────
  Widget _divider() {
    return Divider(
      height: 1,
      thickness: 0.5,
      color: AppColors.border.withOpacity(0.5),
      indent: 16 + 44 + 14, // padding + icon box + gap
      endIndent: 16,
    );
  }

  /// Interleave widgets with a divider between each
  List<Widget> _intersperse(List<Widget> items, Widget divider) {
    final result = <Widget>[];
    for (int i = 0; i < items.length; i++) {
      if (i > 0) result.add(divider);
      result.add(items[i]);
    }
    return result;
  }

  // ─── Bottom Section (Settings + Logout) ───────────────────────────────
  Widget _buildBottomSection() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18),
      child: Column(
        children: [
          Container(
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: _menuItem(
              icon: Icons.settings_outlined,
              title: 'Settings',
              color: AppColors.text2,
              onTap: () {},
            ),
          ),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: _logout,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                color: AppColors.red.withOpacity(0.05),
                border: Border.all(color: AppColors.red),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: const [
                  Icon(Icons.logout, size: 18, color: AppColors.red),
                  SizedBox(width: 8),
                  Text(
                    'Logout',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.red,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Share Profile Bottom Sheet
// ═══════════════════════════════════════════════════════════════════════════

class _ShareProfileSheet extends StatelessWidget {
  final String profileLink;
  final String displayName;
  final String userId;

  const _ShareProfileSheet({
    required this.profileLink,
    required this.displayName,
    required this.userId,
  });

  @override
  Widget build(BuildContext context) {
    final supportsShare =
        // Web Share API — just show it always; will gracefully fail on unsupported platforms
        true;

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.text3,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            'Share Profile',
            style: TextStyle(
              fontFamily: 'Space Grotesk',
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: AppColors.text,
            ),
          ),
          const SizedBox(height: 20),

          // QR Code placeholder
          Container(
            width: 160,
            height: 160,
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Center(
              child: _buildQrPlaceholder(),
            ),
          ),
          Text(
            profileLink,
            style: const TextStyle(fontSize: 11, color: AppColors.text3),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 20),

          // Copy Profile ID button
          _shareOption(
            icon: Icons.copy,
            label: 'Copy Profile ID',
            onTap: () {
              Clipboard.setData(ClipboardData(text: profileLink));
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: const Text('Copied!'),
                  backgroundColor: AppColors.card,
                  behavior: SnackBarBehavior.floating,
                ),
              );
            },
          ),
          const SizedBox(height: 8),

          // Native Share button
          if (supportsShare)
            _shareOption(
              icon: Icons.share,
              label: 'Share via...',
              onTap: () {
                // For Flutter web, this is limited. On mobile Flutter, share_plus would be used.
                // For now, we copy to clipboard and show the native share sheet if possible.
                Clipboard.setData(ClipboardData(
                    text:
                        'Add me on Neighborly! My profile: $profileLink'));
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: const Text('Profile link copied — share it with your friends!'),
                    backgroundColor: AppColors.card,
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              },
            ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _shareOption({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.bg,
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(icon, size: 20, color: AppColors.primary),
            const SizedBox(width: 12),
            Text(
              label,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: AppColors.text,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQrPlaceholder() {
    // Simple QR-like pattern
    return CustomPaint(
      size: const Size(140, 140),
      painter: _QrPlaceholderPainter(value: 0),
    );
  }
}

class _QrPlaceholderPainter extends CustomPainter {
  final int value;
  _QrPlaceholderPainter({required this.value});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.black;
    const cellCount = 7;
    final cellSize = size.width / cellCount;

    // Finder patterns (corners)
    for (final pos in [0, 4]) {
      final x = pos * cellSize;
      for (final yPos in [0, 4]) {
        final y = yPos * cellSize;
        canvas.drawRect(
          Rect.fromLTWH(x, y, 3 * cellSize, 3 * cellSize),
          paint,
        );
        canvas.drawRect(
          Rect.fromLTWH(x + cellSize, y + cellSize, cellSize, cellSize),
          Paint()..color = Colors.white,
        );
      }
    }

    // Data cells
    paint.color = Colors.black;
    for (int r = 0; r < cellCount; r++) {
      for (int c = 0; c < cellCount; c++) {
        if ((r + c) % 2 == 0 && !((r < 3 && c < 3) || (r < 3 && c > 3) || (r > 3 && c < 3))) {
          canvas.drawRect(
            Rect.fromLTWH(c * cellSize, r * cellSize, cellSize, cellSize),
            paint,
          );
        }
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}