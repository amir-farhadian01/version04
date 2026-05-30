import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../widgets/status_bar.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';

/// Auth screen with Login and Sign Up tabs.
/// Login: username/email/phone + password
/// Sign Up: email or phone + password + displayName
class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  // ── Login fields ──
  final _loginController = TextEditingController();
  final _loginPasswordController = TextEditingController();

  // ── Sign Up fields ──
  final _signupEmailController = TextEditingController();
  final _signupPhoneController = TextEditingController();
  final _signupPasswordController = TextEditingController();
  final _signupDisplayNameController = TextEditingController();

  bool _isLoading = false;
  String? _errorMessage;
  bool _obscureLoginPassword = true;
  bool _obscureSignupPassword = true;

  final AuthService _authService = AuthService();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      if (_tabController.indexIsChanging) {
        setState(() {
          _errorMessage = null;
        });
      }
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _loginController.dispose();
    _loginPasswordController.dispose();
    _signupEmailController.dispose();
    _signupPhoneController.dispose();
    _signupPasswordController.dispose();
    _signupDisplayNameController.dispose();
    super.dispose();
  }

  // ── Login ──
  Future<void> _handleLogin() async {
    final login = _loginController.text.trim();
    final password = _loginPasswordController.text;

    if (login.isEmpty || password.isEmpty) {
      setState(() => _errorMessage = 'Please fill in all fields');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      await _authService.login(login, password);
      if (!mounted) return;
      Navigator.pushReplacementNamed(context, '/home');
    } on ApiException catch (e) {
      setState(() {
        _errorMessage = e.message;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Connection failed. Is the backend running?';
        _isLoading = false;
      });
    }
  }

  // ── Sign Up ──
  Future<void> _handleSignUp() async {
    final email = _signupEmailController.text.trim();
    final phone = _signupPhoneController.text.trim();
    final password = _signupPasswordController.text;
    final displayName = _signupDisplayNameController.text.trim();

    // Validate: at least email or phone must be provided
    if (email.isEmpty && phone.isEmpty) {
      setState(() => _errorMessage = 'Please enter an email or phone number');
      return;
    }
    if (password.isEmpty || password.length < 6) {
      setState(() => _errorMessage = 'Password must be at least 6 characters');
      return;
    }
    if (displayName.isEmpty || displayName.length < 2) {
      setState(() => _errorMessage = 'Display name must be at least 2 characters');
      return;
    }
    if (email.isNotEmpty && !_isValidEmail(email)) {
      setState(() => _errorMessage = 'Please enter a valid email address');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      await _authService.register(
        email: email.isNotEmpty ? email : '$displayName@neighborly.local',
        password: password,
        displayName: displayName,
        phone: phone.isNotEmpty ? phone : null,
      );
      if (!mounted) return;
      Navigator.pushReplacementNamed(context, '/home');
    } on ApiException catch (e) {
      setState(() {
        _errorMessage = e.message;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Registration failed. Is the backend running?';
        _isLoading = false;
      });
    }
  }

  bool _isValidEmail(String email) {
    return RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$').hasMatch(email);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const StatusBar(),
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Logo
                Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    color: AppColors.primaryDim,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: const Icon(Icons.public, color: AppColors.primary, size: 32),
                ),
                const SizedBox(height: 24),
                const Text(
                  'Welcome to\nNeighborHub',
                  style: TextStyle(
                    fontFamily: 'Space Grotesk',
                    fontSize: 26,
                    fontWeight: FontWeight.w700,
                    color: AppColors.text,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Discover local businesses, events, and connect with your neighborhood community.',
                  style: TextStyle(fontSize: 14, color: AppColors.text2, height: 1.6),
                ),
                const SizedBox(height: 24),

                // Tab bar
                Container(
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: TabBar(
                    controller: _tabController,
                    indicator: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    indicatorSize: TabBarIndicatorSize.tab,
                    labelColor: Colors.white,
                    unselectedLabelColor: AppColors.text2,
                    labelStyle: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                    unselectedLabelStyle: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                    dividerColor: Colors.transparent,
                    tabs: const [
                      Tab(text: 'Log In'),
                      Tab(text: 'Sign Up'),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Tab content
                SizedBox(
                  height: 420,
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      _buildLoginForm(),
                      _buildSignUpForm(),
                    ],
                  ),
                ),

                // Error message
                if (_errorMessage != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      _errorMessage!,
                      style: const TextStyle(color: Colors.redAccent, fontSize: 13),
                      textAlign: TextAlign.center,
                    ),
                  ),

                const SizedBox(height: 16),
                const Center(
                  child: Text(
                    'By continuing, you agree to our Terms of Service and Privacy Policy.',
                    style: TextStyle(fontSize: 12, color: AppColors.text3, height: 1.6),
                    textAlign: TextAlign.center,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildLoginForm() {
    final hasLogin = _loginController.text.trim().isNotEmpty;
    final hasPassword = _loginPasswordController.text.isNotEmpty;
    final canSubmit = hasLogin && hasPassword && !_isLoading;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'USERNAME, EMAIL, OR PHONE',
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.text2),
        ),
        const SizedBox(height: 6),
        _buildTextField(
          controller: _loginController,
          hintText: 'Enter your username, email, or phone',
          prefixIcon: Icons.person_outline,
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 16),
        const Text(
          'PASSWORD',
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.text2),
        ),
        const SizedBox(height: 6),
        _buildTextField(
          controller: _loginPasswordController,
          hintText: 'Enter your password',
          prefixIcon: Icons.lock_outline,
          obscureText: _obscureLoginPassword,
          suffixIcon: IconButton(
            icon: Icon(
              _obscureLoginPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
              color: AppColors.text3,
              size: 20,
            ),
            onPressed: () => setState(() => _obscureLoginPassword = !_obscureLoginPassword),
          ),
          onChanged: (_) => setState(() {}),
          onSubmitted: canSubmit ? (_) => _handleLogin() : null,
        ),
        const SizedBox(height: 24),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: canSubmit ? _handleLogin : null,
            style: ElevatedButton.styleFrom(
              backgroundColor: canSubmit ? AppColors.primary : AppColors.border2,
              disabledBackgroundColor: AppColors.border2,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: _isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Text('Log In',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
          ),
        ),
      ],
    );
  }

  Widget _buildSignUpForm() {
    final hasEmailOrPhone = _signupEmailController.text.trim().isNotEmpty ||
        _signupPhoneController.text.trim().isNotEmpty;
    final hasPassword = _signupPasswordController.text.isNotEmpty &&
        _signupPasswordController.text.length >= 6;
    final hasDisplayName =
        _signupDisplayNameController.text.trim().length >= 2;
    final canSubmit = hasEmailOrPhone && hasPassword && hasDisplayName && !_isLoading;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'EMAIL',
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.text2),
        ),
        const SizedBox(height: 6),
        _buildTextField(
          controller: _signupEmailController,
          hintText: 'your@email.com',
          prefixIcon: Icons.email_outlined,
          keyboardType: TextInputType.emailAddress,
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 12),
        const Text(
          'PHONE (OPTIONAL — MUST BE UNIQUE)',
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.text2),
        ),
        const SizedBox(height: 6),
        _buildTextField(
          controller: _signupPhoneController,
          hintText: '+1 (647) 000-0000',
          prefixIcon: Icons.phone_outlined,
          keyboardType: TextInputType.phone,
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 12),
        const Text(
          'DISPLAY NAME',
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.text2),
        ),
        const SizedBox(height: 6),
        _buildTextField(
          controller: _signupDisplayNameController,
          hintText: 'Your display name',
          prefixIcon: Icons.badge_outlined,
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 12),
        const Text(
          'PASSWORD',
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.text2),
        ),
        const SizedBox(height: 6),
        _buildTextField(
          controller: _signupPasswordController,
          hintText: 'At least 6 characters',
          prefixIcon: Icons.lock_outline,
          obscureText: _obscureSignupPassword,
          suffixIcon: IconButton(
            icon: Icon(
              _obscureSignupPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
              color: AppColors.text3,
              size: 20,
            ),
            onPressed: () => setState(() => _obscureSignupPassword = !_obscureSignupPassword),
          ),
          onChanged: (_) => setState(() {}),
          onSubmitted: canSubmit ? (_) => _handleSignUp() : null,
        ),
        const SizedBox(height: 24),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: canSubmit ? _handleSignUp : null,
            style: ElevatedButton.styleFrom(
              backgroundColor: canSubmit ? AppColors.primary : AppColors.border2,
              disabledBackgroundColor: AppColors.border2,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: _isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Text('Create Account',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
          ),
        ),
      ],
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hintText,
    IconData? prefixIcon,
    bool obscureText = false,
    Widget? suffixIcon,
    TextInputType? keyboardType,
    void Function(String)? onChanged,
    void Function(String)? onSubmitted,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        border: Border.all(color: AppColors.border2),
        borderRadius: BorderRadius.circular(12),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
      child: Row(
        children: [
          if (prefixIcon != null) ...[
            Icon(prefixIcon, color: AppColors.text3, size: 20),
            const SizedBox(width: 10),
          ],
          Expanded(
            child: TextField(
              controller: controller,
              obscureText: obscureText,
              keyboardType: keyboardType,
              style: const TextStyle(color: AppColors.text, fontSize: 15),
              decoration: InputDecoration.collapsed(
                hintText: hintText,
                hintStyle: const TextStyle(color: AppColors.text3),
              ),
              onChanged: onChanged,
              onSubmitted: onSubmitted,
            ),
          ),
          ?suffixIcon,
        ],
      ),
    );
  }
}
