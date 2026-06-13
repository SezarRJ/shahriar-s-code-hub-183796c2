import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import 'dart:typed_data';

import '../../models/capture_model.dart';
import '../../services/capture_service.dart';

part 'capture_event.dart';
part 'capture_state.dart';

class CaptureBloc extends Bloc<CaptureEvent, CaptureState> {
  final CaptureService _captureService;

  CaptureBloc({required CaptureService captureService}) : _captureService = captureService, super(CaptureInitial()) {
    on<CapturePhotoRequested>(_onCapturePhotoRequested);
    on<CaptureQueueRequested>(_onCaptureQueueRequested);
  }

  Future<void> _onCapturePhotoRequested(CapturePhotoRequested event, Emitter<CaptureState> emit) async {
    emit(CaptureInProgress());
    try {
      final capture = await _captureService.capture(
        capturePointId: event.capturePointId,
        userId: event.userId,
        imageBytes: event.imageBytes,
        fileName: event.fileName,
        notes: event.notes,
      );
      emit(CaptureSuccess(capture: capture));
    } catch (e) {
      emit(CaptureFailure(error: e.toString()));
    }
  }

  Future<void> _onCaptureQueueRequested(CaptureQueueRequested event, Emitter<CaptureState> emit) async {
    final queueSize = await _captureService.getQueueSize();
    final oldestDate = await _captureService.getOldestUnsyncedDate();
    emit(CaptureQueueStatus(queueSize: queueSize, oldestDate: oldestDate));
  }
}
