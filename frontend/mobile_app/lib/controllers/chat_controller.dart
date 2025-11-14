import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import '../models/chat_message.dart';

class ChatController extends GetxController {
  static const _baseUrl = 'wss://xpressatec.online/ws/chat';

  final RxList<ChatMessage> messages = <ChatMessage>[].obs;
  final RxnString currentRecipientEmail = RxnString();
  final RxnString userEmail = RxnString();
  final RxBool isConnected = false.obs;
  final RxBool isConnecting = false.obs;

  late final TextEditingController messageCtrl;
  late final TextEditingController recipientCtrl;

  WebSocketChannel? _channel;
  StreamSubscription? _subscription;

  dynamic _authController;

  @override
  void onInit() {
    super.onInit();
    messageCtrl = TextEditingController();
    recipientCtrl = TextEditingController();
    _resolveAuthController();
    _connect();
  }

  @override
  void onClose() {
    _disconnect();
    messageCtrl.dispose();
    recipientCtrl.dispose();
    super.onClose();
  }

  void _resolveAuthController() {
    try {
      _authController = Get.find<dynamic>();
    } catch (_) {
      _authController = null;
    }
  }

  Future<void> _connect() async {
    final email = _readEmailFromAuthController();
    if (email == null || email.isEmpty) {
      Get.snackbar('Error', 'No se encontró un correo válido de usuario');
      return;
    }

    userEmail.value = email;

    _disconnect();

    final uri = Uri.parse(_baseUrl).replace(queryParameters: {'email': email});

    try {
      isConnecting.value = true;
      _channel = WebSocketChannel.connect(uri);
      _subscription = _channel!.stream.listen(
        _handleIncomingData,
        onDone: _handleDone,
        onError: _handleError,
        cancelOnError: true,
      );
      isConnected.value = true;
    } catch (error) {
      Get.snackbar('Error', 'No fue posible conectar al chat: $error');
      isConnected.value = false;
    } finally {
      isConnecting.value = false;
    }
  }

  void _disconnect() {
    isConnected.value = false;
    _subscription?.cancel();
    _subscription = null;
    _channel?.sink.close();
    _channel = null;
  }

  void reconnect() {
    _connect();
  }

  void _handleIncomingData(dynamic raw) {
    if (raw == null) {
      return;
    }

    try {
      final decoded = raw is String ? jsonDecode(raw) : raw;
      if (decoded is! Map<String, dynamic>) {
        return;
      }

      final type = decoded['type']?.toString();
      switch (type) {
        case 'connected':
          final message = decoded['message']?.toString();
          if (message != null && message.isNotEmpty) {
            Get.snackbar('Chat', message);
          }
          break;
        case 'message':
          final email = userEmail.value;
          if (email == null || email.isEmpty) {
            return;
          }
          final chatMessage = ChatMessage.fromJson(
            decoded,
            currentUserEmail: email,
          );
          messages.add(chatMessage);
          break;
        case 'error':
        case 'info':
          final message = decoded['message']?.toString();
          if (message != null && message.isNotEmpty) {
            Get.snackbar('Chat', message, snackPosition: SnackPosition.TOP);
          }
          break;
        default:
          break;
      }
    } catch (error) {
      Get.snackbar('Error', 'Mensaje inválido recibido: $error');
    }
  }

  void _handleDone() {
    isConnected.value = false;
    _subscription?.cancel();
    _subscription = null;
  }

  void _handleError(Object error) {
    isConnected.value = false;
    Get.snackbar('Error', 'El chat se desconectó: $error');
  }

  Future<void> sendMessage() async {
    final to = currentRecipientEmail.value?.trim();
    final text = messageCtrl.text.trim();

    if (to == null || to.isEmpty) {
      Get.snackbar('Error', 'Ingresa un correo de destinatario');
      return;
    }

    if (!GetUtils.isEmail(to)) {
      Get.snackbar('Error', 'Ingresa un correo de destinatario válido');
      return;
    }

    if (text.isEmpty) {
      return;
    }

    final channel = _channel;
    if (channel == null) {
      Get.snackbar('Error', 'El chat no está conectado');
      return;
    }

    final payload = <String, dynamic>{
      'to': to,
      'message': text,
    };

    try {
      channel.sink.add(jsonEncode(payload));
      messageCtrl.clear();
    } catch (error) {
      Get.snackbar('Error', 'No se pudo enviar el mensaje: $error');
    }
  }

  void setRecipientEmail(String email) {
    final trimmed = email.trim();
    if (!GetUtils.isEmail(trimmed)) {
      Get.snackbar('Error', 'Ingresa un correo válido');
      return;
    }
    currentRecipientEmail.value = trimmed;
    recipientCtrl.text = trimmed;
  }

  String? _readEmailFromAuthController() {
    final controller = _authController;
    if (controller == null) {
      return null;
    }

    try {
      final dynamic rxEmail = controller.userEmail;
      if (rxEmail is RxString) {
        final value = rxEmail.value.trim();
        if (value.isNotEmpty) {
          return value;
        }
      } else if (rxEmail is RxnString) {
        final value = rxEmail.value?.trim();
        if (value != null && value.isNotEmpty) {
          return value;
        }
      } else if (rxEmail is String) {
        final value = rxEmail.trim();
        if (value.isNotEmpty) {
          return value;
        }
      }
    } catch (_) {
      // Ignore and try other strategies
    }

    try {
      final dynamic currentUser = controller.currentUser;
      final dynamic email = currentUser?.email;
      if (email is String && email.trim().isNotEmpty) {
        return email.trim();
      }
    } catch (_) {
      // ignore
    }

    try {
      final dynamic email = controller.email;
      if (email is String && email.trim().isNotEmpty) {
        return email.trim();
      }
    } catch (_) {
      // ignore
    }

    return null;
  }
}
