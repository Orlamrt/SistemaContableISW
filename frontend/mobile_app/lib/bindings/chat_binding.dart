import 'package:get/get.dart';

import '../controllers/chat_controller.dart';

class ChatBinding extends Bindings {
  @override
  void dependencies() {
    if (!Get.isRegistered<ChatController>()) {
      Get.lazyPut<ChatController>(ChatController.new, fenix: true);
    }
  }
}
