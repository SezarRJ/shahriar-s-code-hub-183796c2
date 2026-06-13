part of 'capture_bloc.dart';

abstract class CaptureState extends Equatable {
  const CaptureState();
  @override List<Object?> get props => [];
}

class CaptureInitial extends CaptureState {}

class CaptureInProgress extends CaptureState {}

class CaptureSuccess extends CaptureState {
  final CaptureModel capture;
  const CaptureSuccess({required this.capture});
  @override List<Object?> get props => [capture];
}

class CaptureFailure extends CaptureState {
  final String error;
  const CaptureFailure({required this.error});
  @override List<Object?> get props => [error];
}

class CaptureQueueStatus extends CaptureState {
  final int queueSize;
  final DateTime? oldestDate;
  const CaptureQueueStatus({required this.queueSize, this.oldestDate});
  @override List<Object?> get props => [queueSize, oldestDate];
}
