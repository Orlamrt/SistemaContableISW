import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../controllers/chat_controller.dart';
import '../models/chat_message.dart';

class ChatPage extends GetView<ChatController> {
  const ChatPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Obx(() {
          final recipient = controller.currentRecipientEmail.value;
          final targetLabel = recipient?.isNotEmpty == true
              ? 'Conversación con $recipient'
              : 'Selecciona un destinatario';
          return Text(targetLabel);
        }),
        actions: [
          Obx(() {
            if (controller.isConnected.value) {
              return const Padding(
                padding: EdgeInsets.symmetric(horizontal: 16),
                child: Icon(Icons.cloud_done, color: Colors.green),
              );
            }
            if (controller.isConnecting.value) {
              return const Padding(
                padding: EdgeInsets.symmetric(horizontal: 16),
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              );
            }
            return IconButton(
              tooltip: 'Reconectar',
              icon: const Icon(Icons.refresh),
              onPressed: controller.reconnect,
            );
          }),
        ],
      ),
      body: Column(
        children: [
          _RecipientSelector(controller: controller),
          const Divider(height: 1),
          Expanded(
            child: Obx(() {
              final recipient = controller.currentRecipientEmail.value;
              final List<ChatMessage> items;
              if (recipient == null || recipient.isEmpty) {
                items = controller.messages.toList();
              } else {
                items = controller.messages
                    .where((message) => message.involves(recipient))
                    .toList();
              }

              if (items.isEmpty) {
                return const Center(
                  child: Text('No hay mensajes'),
                );
              }

              final userEmail = controller.userEmail.value;

              return ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: items.length,
                itemBuilder: (context, index) {
                  final message = items[index];
                  final normalizedUser = userEmail?.toLowerCase();
                  final isSelf = message.isSelf || (normalizedUser != null && message.from.toLowerCase() == normalizedUser);
                  return Align(
                    alignment:
                        isSelf ? Alignment.centerRight : Alignment.centerLeft,
                    child: Container(
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: isSelf
                            ? Theme.of(context).colorScheme.primaryContainer
                            : Theme.of(context).colorScheme.surfaceVariant,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            message.from,
                            style: Theme.of(context)
                                .textTheme
                                .labelSmall
                                ?.copyWith(fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            message.text,
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _formatTimestamp(message.timestamp),
                            style: Theme.of(context)
                                .textTheme
                                .labelSmall
                                ?.copyWith(color: Colors.black54),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              );
            }),
          ),
          _MessageComposer(controller: controller),
        ],
      ),
    );
  }

  String _formatTimestamp(DateTime timestamp) {
    final timeOfDay = TimeOfDay.fromDateTime(timestamp);
    final hour = timeOfDay.hourOfPeriod.toString().padLeft(2, '0');
    final minute = timeOfDay.minute.toString().padLeft(2, '0');
    final period = timeOfDay.period == DayPeriod.am ? 'a. m.' : 'p. m.';
    return '$hour:$minute $period';
  }
}

class _RecipientSelector extends StatelessWidget {
  const _RecipientSelector({required this.controller});

  final ChatController controller;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: controller.recipientCtrl,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                labelText: 'Correo del terapeuta (destinatario)',
                hintText: 'terapeuta@xpressatec.com',
              ),
              onSubmitted: controller.setRecipientEmail,
            ),
          ),
          const SizedBox(width: 8),
          ElevatedButton.icon(
            onPressed: () =>
                controller.setRecipientEmail(controller.recipientCtrl.text),
            icon: const Icon(Icons.search),
            label: const Text('Conectar'),
          ),
        ],
      ),
    );
  }
}

class _MessageComposer extends StatelessWidget {
  const _MessageComposer({required this.controller});

  final ChatController controller;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: controller.messageCtrl,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => controller.sendMessage(),
                decoration: const InputDecoration(
                  hintText: 'Escribe un mensaje',
                ),
              ),
            ),
            const SizedBox(width: 8),
            IconButton(
              icon: const Icon(Icons.send),
              color: Theme.of(context).colorScheme.primary,
              onPressed: controller.sendMessage,
            ),
          ],
        ),
      ),
    );
  }
}
