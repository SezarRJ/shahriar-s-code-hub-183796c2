part of 'capture_bloc.dart';

abstract class CaptureEvent extends Equatable {
  const CaptureEvent();
  @override List<Object?> get props => [];
}

class CapturePhotoRequested extends CaptureEvent {
  final String capturePointId;
  final String userId;
  final Uint8List imageBytes;
  final String fileName;
  final String? notes;

  const CapturePhotoRequested({
    required this.capturePointId,
    required this.userId,
    required this.imageBytes,
    required this.fileName,
    this.notes,
  });

  @override
  List<Object?> get props => [capturePointId, userId, imageBytes, fileName, notes];
}

class CaptureQueueRequested extends CaptureEvent {}
