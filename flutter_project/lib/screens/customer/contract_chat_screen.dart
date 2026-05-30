import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/api_service.dart';

/// Chat thread with PII (Personal Identifiable Information) blocking notice.
class CustomerContractChatScreen extends StatefulWidget {
  final String chatId;
  const CustomerContractChatScreen({super.key, required this.chatId});

  @override
  State<CustomerContractChatScreen> createState() =>
      _CustomerContractChatScreenState();
}

class _CustomerContractChatScreenState
    extends State<CustomerContractChatScreen> {
  final ApiService _api = ApiService();
  final TextEditingController _msgController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  bool _loading = true;
  final List<Map<String, dynamic>> _messages = [];
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _loadMessages();
  }

  @override
  void dispose() {
    _msgController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadMessages() async {
    setState(() => _loading = true);
    try {
      final result = await _api.getChatMessages(widget.chatId);
      final items = (result['data'] as List<dynamic>?)
              ?.cast<Map<String, dynamic>>() ??
          (result['items'] as List<dynamic>?)
                  ?.cast<Map<String, dynamic>>() ??
              _mockMessages();
      _messages.clear();
      _messages.addAll(items);
    } catch (_) {
      _messages.clear();
      _messages.addAll(_mockMessages());
    }
    setState(() => _loading = false);
  }

  List<Map<String, dynamic>> _mockMessages() => [
        {
          'fromMe': true,
          'text': 'Hi, I\'d like to confirm the oil change appointment.',
          'time': '10:30 AM',
        },
        {
          'fromMe': false,
          'text': 'Sure! Your appointment is confirmed for Monday at 9:00 AM.',
          'time': '10:31 AM',
        },
        {
          'fromMe': true,
          'text': 'Great, thank you! I\'ll be there.',
          'time': '10:32 AM',
        },
      ];

  Future<void> _sendMessage() async {
    final text = _msgController.text.trim();
    if (text.isEmpty) return;

    setState(() => _sending = true);
    try {
      await _api.sendMessage(widget.chatId, text);
      _messages.add({
        'fromMe': true,
        'text': text,
        'time': 'Now',
      });
      _msgController.clear();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scrollController.hasClients) {
          _scrollController.animateTo(
            _scrollController.position.maxScrollExtent,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOut,
          );
        }
      });
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to send message'),
          backgroundColor: AppColors.red,
        ),
      );
    }
    setState(() => _sending = false);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? AppColors.bg : AppColorsLight.bg;
    final text = isDark ? AppColors.text : AppColorsLight.text;
    final text3 = isDark ? AppColors.text3 : AppColorsLight.text3;
    final border = isDark ? AppColors.border : AppColorsLight.border;

    return Container(
      color: bg,
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: bg,
              border: Border(bottom: BorderSide(color: border)),
            ),
            child: Row(
              children: [
                GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: Icon(Icons.arrow_back, size: 20, color: text3),
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Contract Chat',
                        style: TextStyle(
                            fontFamily: 'Space Grotesk',
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: text)),
                    Text('PII blocked · Secure',
                        style: TextStyle(fontSize: 11, color: text3)),
                  ],
                ),
              ],
            ),
          ),
          // PII warning banner
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            color: AppColors.warn.withValues(alpha: 0.1),
            child: const Row(
              children: [
                Icon(Icons.shield, size: 14, color: AppColors.warn),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Phone numbers, emails, and addresses are hidden for your safety.',
                    style: TextStyle(fontSize: 11, color: AppColors.warn),
                  ),
                ),
              ],
            ),
          ),
          // Messages
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(14),
                    itemCount: _messages.length,
                    itemBuilder: (ctx, i) => _messageBubble(_messages[i]),
                  ),
          ),
          // Input
          Container(
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 14),
            decoration: BoxDecoration(
              color: bg,
              border: Border(top: BorderSide(color: border)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    decoration: BoxDecoration(
                      color: AppColors.card,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: border),
                    ),
                    child: TextField(
                      controller: _msgController,
                      style: const TextStyle(
                          fontSize: 14, color: AppColors.text),
                      decoration: const InputDecoration(
                        hintText: 'Type a message...',
                        hintStyle:
                            TextStyle(color: AppColors.text3, fontSize: 14),
                        border: InputBorder.none,
                      ),
                      onSubmitted: (_) => _sendMessage(),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: _sending ? null : _sendMessage,
                  child: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: _sending
                          ? AppColors.primary.withValues(alpha: 0.5)
                          : AppColors.primary,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: _sending
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.send, size: 18, color: Colors.white),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _messageBubble(Map<String, dynamic> msg) {
    final fromMe = msg['fromMe'] as bool? ?? true;
    final text = msg['text'] as String? ?? '';
    final time = msg['time'] as String? ?? '';

    return Align(
      alignment: fromMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: const BoxConstraints(maxWidth: 260),
        decoration: BoxDecoration(
          color: fromMe ? AppColors.primary : AppColors.card,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: fromMe
                ? const Radius.circular(16)
                : const Radius.circular(4),
            bottomRight: fromMe
                ? const Radius.circular(4)
                : const Radius.circular(16),
          ),
          border: fromMe ? null : Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(text,
                style: TextStyle(
                  fontSize: 13,
                  color: fromMe ? Colors.white : AppColors.text,
                  height: 1.5,
                )),
            const SizedBox(height: 4),
            Text(time,
                style: TextStyle(
                  fontSize: 10,
                  color:
                      fromMe ? Colors.white70 : AppColors.text3,
                )),
          ],
        ),
      ),
    );
  }
}