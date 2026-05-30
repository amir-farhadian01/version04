import 'package:flutter/material.dart';

/// A [GridView.builder] wrapper pre-configured with cache-friendly defaults.
///
/// * Uses `itemCount` and `gridDelegate` to restrict rendering to only
///   visible items.
/// * Explicitly enables [addAutomaticKeepAlives] and [addRepaintBoundaries]
///   for runtime performance.
class CachedGridView extends StatelessWidget {
  final int itemCount;
  final Widget Function(BuildContext context, int index) itemBuilder;
  final SliverGridDelegate gridDelegate;
  final ScrollController? controller;
  final EdgeInsetsGeometry? padding;
  final ScrollPhysics? physics;
  final bool shrinkWrap;
  final Widget? emptyWidget;
  final Widget? loadingWidget;
  final bool isLoading;

  const CachedGridView({
    super.key,
    required this.itemCount,
    required this.itemBuilder,
    required this.gridDelegate,
    this.controller,
    this.padding,
    this.physics,
    this.shrinkWrap = false,
    this.emptyWidget,
    this.loadingWidget,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    if (isLoading && loadingWidget != null) {
      return loadingWidget!;
    }

    if (itemCount == 0 && emptyWidget != null) {
      return emptyWidget!;
    }

    return GridView.builder(
      controller: controller,
      padding: padding ?? EdgeInsets.zero,
      physics: physics,
      shrinkWrap: shrinkWrap,
      itemCount: itemCount,
      gridDelegate: gridDelegate,
      addAutomaticKeepAlives: true,
      addRepaintBoundaries: true,
      itemBuilder: itemBuilder,
    );
  }
}