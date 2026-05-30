import 'package:flutter_test/flutter_test.dart';
import 'package:neighborly_app/main.dart';

void main() {
  testWidgets('App renders auth screen', (WidgetTester tester) async {
    await tester.pumpWidget(const NeighborHubApp());
    // The auth screen title uses a newline, so we check for a substring
    expect(find.textContaining('Welcome to'), findsOneWidget);
  });
}
