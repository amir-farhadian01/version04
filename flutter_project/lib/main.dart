import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'theme/app_theme.dart';
import 'providers/cache_provider.dart';
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
import 'widgets/responsive_scaffold.dart';

void main() {
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
        ChangeNotifierProvider(create: (_) => CacheProvider()),
      ],
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
        '/auth': (_) => const ResponsiveScaffold(child: AuthScreen()),
        '/home': (_) => const ResponsiveScaffold(child: HomeScreen()),
        '/social': (_) => const ResponsiveScaffold(child: SocialScreen()),
        '/activity': (_) => const ResponsiveScaffold(child: ActivityScreen()),
        '/profile': (_) => const ResponsiveScaffold(child: ProfileScreen()),
        '/biz-profile': (_) => const ResponsiveScaffold(child: BusinessProfileScreen()),
        '/dashboard': (_) => const ResponsiveScaffold(child: DashboardScreen(), expandOnDesktop: true),
        '/explorer': (_) => const ResponsiveScaffold(child: ExplorerScreen()),
        '/new-home': (_) => const ResponsiveScaffold(child: home_new.FlutterHomeScreen()),
        '/services': (_) => const ResponsiveScaffold(child: CustomerDashboardScreen(), expandOnDesktop: true),
        '/customer/orders': (_) => const ResponsiveScaffold(child: CustomerOrdersScreen(), expandOnDesktop: true),
        '/customer/messages': (_) => const ResponsiveScaffold(child: CustomerMessagesScreen(), expandOnDesktop: true),
        '/profile/upgrade': (_) => const ResponsiveScaffold(child: UpgradeToBusinessScreen()),
        '/order/new': (_) => const ResponsiveScaffold(child: NewOrderScreen()),
      },
      onGenerateRoute: (settings) {
        if (settings.name == '/customer/order-detail') {
          final orderId = settings.arguments as String? ?? '';
          return MaterialPageRoute(
            builder: (_) => ResponsiveScaffold(
              expandOnDesktop: true,
              child: CustomerOrderDetailScreen(orderId: orderId),
            ),
          );
        }
        if (settings.name == '/customer/contract-chat') {
          final chatId = settings.arguments as String? ?? '';
          return MaterialPageRoute(
            builder: (_) => ResponsiveScaffold(
              expandOnDesktop: true,
              child: CustomerContractChatScreen(chatId: chatId),
            ),
          );
        }
        if (settings.name == '/business') {
          final businessId = settings.arguments as String? ?? '';
          return MaterialPageRoute(
            builder: (_) => ResponsiveScaffold(
              child: BusinessPageScreen(businessId: businessId),
            ),
          );
        }
        if (settings.name == '/explorer/story') {
          final storyId = settings.arguments as String? ?? '';
          return MaterialPageRoute(
            builder: (_) => ResponsiveScaffold(
              child: StoryScreen(storyId: storyId),
            ),
          );
        }
        if (settings.name == '/explorer/comments') {
          final postId = settings.arguments as String? ?? '';
          return MaterialPageRoute(
            builder: (_) => ResponsiveScaffold(
              child: CommentsScreen(postId: postId),
            ),
          );
        }
        if (settings.name == '/order/new') {
          return MaterialPageRoute(
            builder: (_) => const ResponsiveScaffold(child: NewOrderScreen()),
          );
        }
        return null;
      },
    );
  }
}