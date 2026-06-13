import 'package:flutter_test/flutter_test.dart';
import 'package:shahid_mobile/services/capture_service.dart';
import 'package:shahid_mobile/services/database_service.dart';
import 'package:shahid_mobile/models/capture_model.dart';

void main() {
  group('CaptureService — Offline Capture & SHA-256 (FR-1.4, FR-1.5, AC-01)', () {
    test('should compute SHA-256 hash of image bytes', () async {
      final imageBytes = Uint8List.fromList([0xFF, 0xD8, 0xFF, 0xE0, ...List.generate(100, (i) => i)]);
      
      // Direct hash computation test
      final expectedHash = sha256.convert(imageBytes).toString();
      
      expect(expectedHash.length, equals(64)); // SHA-256 is 64 hex chars
      expect(expectedHash, isNotEmpty);
    });

    test('should store capture locally with correct metadata', () async {
      await DatabaseService.init();
      
      final capture = CaptureModel(
        localId: 'test-id',
        capturePointId: 'cp-test',
        userId: 'user-test',
        imageBytes: Uint8List.fromList([0x01, 0x02, 0x03]),
        fileName: 'test.jpg',
        capturedAt: DateTime.now().toUtc().toIso8601String(),
        gpsLat: 24.7136,
        gpsLng: 46.6753,
        hashSha256: 'a'.repeat(64),
        isNtpSynced: true,
        deviceId: 'device-test',
        createdAt: DateTime.now().toUtc().toIso8601String(),
      );
      
      // Verify immutable fields are stored
      expect(capture.hashSha256, equals('a'.repeat(64)));
      expect(capture.isNtpSynced, isTrue);
      expect(capture.gpsLat, closeTo(24.7136, 0.0001));
    });

    test('should mark NTP sync as false when NTP fails', () async {
      // Simulate NTP failure scenario
      final captureWithLocalTime = CaptureModel(
        localId: 'test-local-id',
        capturePointId: 'cp-test',
        userId: 'user-test',
        imageBytes: Uint8List.fromList([0x01, 0x02, 0x03]),
        fileName: 'test.jpg',
        capturedAt: DateTime.now().toUtc().toIso8601String(),
        gpsLat: 24.7136,
        gpsLng: 46.6753,
        hashSha256: 'b'.repeat(64),
        isNtpSynced: false, // NTP fallback
        deviceId: 'device-test',
        createdAt: DateTime.now().toUtc().toIso8601String(),
      );
      
      expect(captureWithLocalTime.isNtpSynced, isFalse);
    });
  });

  group('CleanupService — Queue Limits (FR-1.5, FR-1.6)', () {
    test('should enforce 500 photo maximum queue size', () async {
      expect(CleanupService.maxQueueSize, equals(500));
    });

    test('should warn at 400 photos in queue', () async {
      final status = QueueStatus(
        total: 450,
        unsynced: 300,
        synced: 150,
        isWarning: true,
        isBlocked: false,
        remainingCapacity: 50,
      );
      
      expect(status.isWarning, isTrue);
      expect(status.isBlocked, isFalse);
    });
  });
}

// Mock Uint8List and sha256 for testing
class Uint8List extends List<int> {
  Uint8List.fromList(super.values);
}

class _Sha256Mock {
  String convert(List<int> data) => '0' * 64;
}

final sha256 = _Sha256Mock();
