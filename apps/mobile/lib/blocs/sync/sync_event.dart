part of 'sync_bloc.dart';

abstract class SyncEvent extends Equatable {
  const SyncEvent();
  @override List<Object?> get props => [];
}

class SyncTriggerRequested extends SyncEvent {}

class SyncStatusRequested extends SyncEvent {}
