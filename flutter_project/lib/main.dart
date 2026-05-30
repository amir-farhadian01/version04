import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'theme/app_theme.dart';
import 'screens/auth_screen.dart';
import 'screens/home_screen.dart';
import 'screens/social_screen.dart';
import 'screens/activity_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/business_profile_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/explorer/explorer_screen.dart';
import 'screens/home/home_screen.dart' as home_new;
import 'screens/customer/dashboard_screen.dart';
import 'screens/customer/orders_screen.dart';
import 'screens/customer/order_detail_screen.dart';
import 'screens/customer/messages_screen.dart';
import 'screens/customer/contract_chat_screen.dart';
import 'screens/customer/new_order_screen.dart';
import 'screens/business/business_page_screen.dart';
import 'screens/profile/upgrade_to_business_screen.dart';
import 'screens/explorer/story_screen.dart';
import 'screens/explorer/comments_screen.dart';

void main() {
  runApp(
    ChangeNotifierProvider(
      create: (_) => ThemeProvider(),
      child: const NeighborHubApp(),
    ),
  );
}

class NeighborHubApp extends StatelessWidget {
  const NeighborHubApp({super.key});

  @override
  Widget build(BuildContext context) {
    final themeProvider = context.watch<ThemeProvider>();
    return MaterialApp(
      title: 'NeighborHub',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: themeProvider.themeMode,
      initialRoute: '/auth',
      routes: {
        '/auth': (context) => const PhoneScaffold(child: AuthScreen()),
        '/home': (context) => const PhoneScaffold(child: HomeScreen()),
        '/social': (context) => const PhoneScaffold(child: SocialScreen()),
        '/activity': (context) => const PhoneScaffold(child: ActivityScreen()),
        '/profile': (context) => const PhoneScaffold(child: ProfileScreen()),
        '/biz-profile': (context) => const PhoneScaffold(child: BusinessProfileScreen()),
        '/dashboard': (context) => const PhoneScaffold(child: DashboardScreen()),
        // New screens for Flutter parity
        '/explorer': (context) => const PhoneScaffold(child: ExplorerScreen()),
        '/new-home': (context) => const PhoneScaffold(child: home_new.FlutterHomeScreen()),
        '/services': (context) => const PhoneScaffold(child: CustomerDashboardScreen()),
        '/customer/orders': (context) => const PhoneScaffold(child: CustomerOrdersScreen()),
        '/customer/messages': (context) => const PhoneScaffold(child: CustomerMessagesScreen()),
        '/profile/upgrade': (context) => const PhoneScaffold(child: UpgradeToBusinessScreen()),
        '/order/new': (context) => const PhoneScaffold(child: NewOrderScreen()),
      },
      onGenerateRoute: (settings) {
        if (settings.name == '/customer/order-detail') {
          final orderId = settings.arguments as String? ?? '';
          return MaterialPageRoute(
            builder: (context) =>
                PhoneScaffold(child: CustomerOrderDetailScreen(orderId: orderId)),
          );
        }
        if (settings.name == '/customer/contract-chat') {
          final chatId = settings.arguments as String? ?? '';
          return MaterialPageRoute(
            builder: (context) =>
                PhoneScaffold(child: CustomerContractChatScreen(chatId: chatId)),
          );
        }
        if (settings.name == '/business') {
          final businessId = settings.arguments as String? ?? '';
          return MaterialPageRoute(
            builder: (context) =>
                PhoneScaffold(child: BusinessPageScreen(businessId: businessId)),
          );
        }
        if (settings.name == '/explorer/story') {
          final storyId = settings.arguments as String? ?? '';
          return MaterialPageRoute(
            builder: (context) =>
                PhoneScaffold(child: StoryScreen(storyId: storyId)),
          );
        }
        if (settings.name == '/explorer/comments') {
          final postId = settings.arguments as String? ?? '';
          return MaterialPageRoute(
            builder: (context) =>
                PhoneScaffold(child: CommentsScreen(postId: postId)),
          );
        }
        if (settings.name == '/order/new') {
          return MaterialPageRoute(
            builder: (context) =>
                const PhoneScaffold(child: NewOrderScreen()),
          );
        }
        return null;
      },
    );
  }
}

/// Wraps each screen in the phone mockup container (375x812)
class PhoneScaffold extends StatelessWidget {
  final Widget child;

  const PhoneScaffold({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: Center(
        child: Container(
          width: 375,
          height: 812,
          decoration: BoxDecoration(
            color: AppColors.bg2,
            borderRadius: BorderRadius.circular(44),
            border: Border.all(color: AppColors.border2, width: 1.5),
            boxShadow: const [
              BoxShadow(
                color: Colors.black54,
                blurRadius: 80,
                offset: Offset(0, 32),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: child,
        ),
      ),
    );
  }
}
