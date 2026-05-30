import 'package:flutter/material.dart';

/// A [ListView.builder] wrapper pre-configured with cache-friendly defaults.
///
/// * Uses `itemCount` to restrict rendering to only visible items.
/// * Adds the `addAutomaticKeepAlives` and `addRepaintBoundaries` optimizations
///   that Flutter applies by default, made explicit for clarity.
/// * Callers simply pass [itemBuilder] and [itemCount]; the widget handles the
///   rest through the standard [ListView.builder] constructor.
class CachedListView extends StatelessWidget {
  final int itemCount;
  final Widget Function(BuildContext context, int index) itemBuilder;
  final ScrollController? controller;
  final EdgeInsetsGeometry? padding;
  final ScrollPhysics? physics;
  final bool shrinkWrap;
  final Widget? emptyWidget;
  final Widget? loadingWidget;
  final bool isLoading;
  final Axis scrollDirection;
  final double? itemExtent;

  const CachedListView({
    super.key,
    required this.itemCount,
    required this.itemBuilder,
    this.controller,
    this.padding,
    this.physics,
    this.shrinkWrap = false,
    this.emptyWidget,
    this.loadingWidget,
    this.isLoading = false,
    this.scrollDirection = Axis.vertical,
    this.itemExtent,
  });

  @override
  Widget build(BuildContext context) {
    if (isLoading && loadingWidget != null) {
      return loadingWidget!;
    }

    if (itemCount == 0 && emptyWidget != null) {
      return emptyWidget!;
    }

    return ListView.builder(
      controller: controller,
      padding: padding ?? EdgeInsets.zero,
      physics: physics,
      shrinkWrap: shrinkWrap,
      scrollDirection: scrollDirection,
      itemCount: itemCount,
      itemExtent: itemExtent,
      // Flutter defaults both of these to true in the builder constructor,
      // but specifying them explicitly documents the performance intent.
      addAutomaticKeepAlives: true,
      addRepaintBoundaries: true,
      itemBuilder: itemBuilder,
    );
  }
}