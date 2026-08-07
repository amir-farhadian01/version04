import 'dart:io' show Platform;
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../widgets/status_bar.dart';
import '../services/auth_service.dart';
import '../services/api_service.dart';

/// Auth screen with Instagram-style design:
/// - Top: Logo + welcome text
/// - Middle: Google & Apple Sign-In buttons
/// - Divider: "or"
/// - Bottom: Email login/signup tabs (secondary)
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
  bool _isOAuthLoading = false;
  String? _errorMessage;
  bool _obscureLoginPassword = true;
  bool _obscureSignupPassword = true;

  final AuthService _authService = AuthService();

  // Only show Apple button on iOS/macOS
  bool get _showAppleButton => Platform.isIOS || Platform.isMacOS;

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

  // ── Google Sign-In ──
  Future<void> _handleGoogleSignIn() async {
    setState(() {
      _isOAuthLoading = true;
      _errorMessage = null;
    });

    try {
      // On web/mobile, use google_sign_in package for native flow
      // For now, this is a placeholder — the actual Google Sign-In flow
      // will be wired when google_sign_in package is configured with
      // client ID in native projects (ios/Runner/Info.plist, android/app/build.gradle)
      //
      // In development mode with Flutter web, users use email/password
      // until native OAuth is configured.
      //
      // When configured, the flow would be:
      //   1. GoogleSignIn _googleSignIn = GoogleSignIn();
      //   2. GoogleSignInAccount? account = await _googleSignIn.signIn();
      //   3. GoogleSignInAuthentication auth = await account!.authentication;
      //   4. result = await _authService.loginWithGoogle(auth.idToken!);
      //
      // For now, we show the buttons but they'll need native setup.
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Google Sign-In requires native project configuration.\nPlease use email login for now.'),
          duration: Duration(seconds: 4),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'Google Sign-In failed. Please try email login.';
      });
    } finally {
      if (mounted) {
        setState(() => _isOAuthLoading = false);
      }
    }
  }

  // ── Apple Sign-In ──
  Future<void> _handleAppleSignIn() async {
    setState(() {
      _isOAuthLoading = true;
      _errorMessage = null;
    });

    try {
      // Apple Sign-In requires native project configuration:
      // - Xcode: Add "Sign in with Apple" capability
      // - The sign_in_with_apple package handles the native flow
      //
      // When configured, the flow would be:
      //   1. AuthorizationCredentialAppleID credential = await SignInWithApple.getAppleIDCredential(...)
      //   2. result = await _authService.loginWithApple(
      //        credential.identityToken!,
      //        fullName: { 'givenName': credential.givenName, 'familyName': credential.familyName },
      //      );
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Apple Sign-In requires native project configuration.\nPlease use email login for now.'),
          duration: Duration(seconds: 4),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'Apple Sign-In failed. Please try email login.';
      });
    } finally {
      if (mounted) {
        setState(() => _isOAuthLoading = false);
      }
    }
  }

  // ── Navigate after successful login (checks onboarding status) ──
  void _navigateAfterLogin(Map<String, dynamic> result) {
    final user = result['user'] as Map<String, dynamic>?;
    final needsOnboarding = result['needsOnboarding'] == true;
    final onboardingCompleted = user?['onboardingCompletedAt'] != null;

    if (needsOnboarding || (!onboardingCompleted && user != null)) {
      Navigator.pushReplacementNamed(context, '/onboarding');
    } else {
      Navigator.pushReplacementNamed(context, '/home');
    }
  }

  // ── Email Login ──
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
      final result = await _authService.login(login, password);
      if (!mounted) return;
      _navigateAfterLogin(result);
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
      final result = await _authService.register(
        email: email.isNotEmpty ? email : '$displayName@neighborly.local',
        password: password,
        displayName: displayName,
        phone: phone.isNotEmpty ? phone : null,
      );
      if (!mounted) return;
      _navigateAfterLogin(result);
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
                // ── Logo + Welcome (same as before) ──
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
                const SizedBox(height: 28),

                // ── Google Sign-In Button ──
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: OutlinedButton(
                    onPressed: _isOAuthLoading ? null : _handleGoogleSignIn,
                    style: OutlinedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: Colors.black87,
                      side: const BorderSide(color: Color(0xFFDADCE0)),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      elevation: 0,
                    ),
                    child: _isOAuthLoading
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                          )
                        : Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              // Google 'G' logo
                              Container(
                                width: 20,
                                height: 20,
                                decoration: const BoxDecoration(
                                  image: DecorationImage(
                                    image: AssetImage('assets/icons/google_g.png'),
                                    fit: BoxFit.contain,
                                  ),
                                ),
                                // Fallback: colored 'G' text
                                child: const Center(
                                  child: Text(
                                    'G',
                                    style: TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFF4285F4),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              const Text(
                                'Continue with Google',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.black87,
                                  letterSpacing: 0.2,
                                ),
                              ),
                            ],
                          ),
                  ),
                ),

                // ── Apple Sign-In Button (iOS/macOS only) ──
                if (_showAppleButton) ...[
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: _isOAuthLoading ? null : _handleAppleSignIn,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.black,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        elevation: 0,
                      ),
                      child: _isOAuthLoading
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.apple, size: 22, color: Colors.white),
                                const SizedBox(width: 10),
                                const Text(
                                  'Continue with Apple',
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.white,
                                    letterSpacing: 0.2,
                                  ),
                                ),
                              ],
                            ),
                    ),
                  ),
                ],

                // ── "or" divider ──
                const SizedBox(height: 24),
                Row(
                  children: [
                    const Expanded(child: Divider(color: AppColors.border2, thickness: 1)),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Text(
                        'or',
                        style: TextStyle(
                          fontSize: 14,
                          color: AppColors.text3,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                    const Expanded(child: Divider(color: AppColors.border2, thickness: 1)),
                  ],
                ),
                const SizedBox(height: 24),

                // ── Tab bar for email login/signup (secondary) ──
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

                // ── Tab content ──
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

                // ── Error message ──
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
          if (suffixIcon != null) suffixIcon,
        ],
      ),
    );
  }
}