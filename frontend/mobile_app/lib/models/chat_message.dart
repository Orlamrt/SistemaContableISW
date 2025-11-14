class ChatMessage {
  final String from;
  final String to;
  final String text;
  final DateTime timestamp;
  final bool isSelf;

  const ChatMessage({
    required this.from,
    required this.to,
    required this.text,
    required this.timestamp,
    required this.isSelf,
  });

  factory ChatMessage.fromJson(
    Map<String, dynamic> json, {
    required String currentUserEmail,
  }) {
    final from = (json['from'] ?? '').toString();
    final to = (json['to'] ?? '').toString();
    final message = (json['message'] ?? '').toString();
    final isSelfFromJson = json['isSelf'];

    bool isSelfValue;
    if (isSelfFromJson is bool) {
      isSelfValue = isSelfFromJson;
    } else {
      isSelfValue = from.toLowerCase() == currentUserEmail.toLowerCase();
    }

    DateTime timestamp = DateTime.now();
    final rawTimestamp = json['timestamp'];
    if (rawTimestamp is String && rawTimestamp.isNotEmpty) {
      final parsed = DateTime.tryParse(rawTimestamp);
      if (parsed != null) {
        timestamp = parsed;
      }
    }

    return ChatMessage(
      from: from,
      to: to,
      text: message,
      timestamp: timestamp,
      isSelf: isSelfValue,
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'from': from,
      'to': to,
      'message': text,
      'timestamp': timestamp.toIso8601String(),
      'isSelf': isSelf,
    };
  }

  bool involves(String email) {
    final normalized = email.trim().toLowerCase();
    return from.toLowerCase() == normalized || to.toLowerCase() == normalized;
  }
}
