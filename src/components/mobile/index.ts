/**
 * MOB-1 to MOB-15 + MOB2-1 to MOB2-15 + MOB3-1 to MOB3-20 + MOB4-1 to MOB4-20 + MOB5-1 to MOB5-20: Mobile Experience Improvements
 * Barrel export for all mobile-specific components.
 */

// === MOB-1 to MOB-15 (Phase 1) ===
export { MobileBottomTabBar } from "./MobileBottomTabBar";
export { MobilePullToRefresh } from "./MobilePullToRefresh";
export { SwipeableCard } from "./SwipeableCard";
export { MobileWidgetCarousel } from "./MobileWidgetCarousel";
export { MobileCompactWidget } from "./MobileCompactWidget";
export { MobileKPIHeader } from "./MobileKPIHeader";
export { MobileFormWizard } from "./MobileFormWizard";
export type { WizardStep } from "./MobileFormWizard";
export { MobileNumericInput } from "./MobileNumericInput";
export { MobileVoiceInput } from "./MobileVoiceInput";
export { DashboardSkeleton, PropertyDetailSkeleton, TableSkeleton, WidgetSkeleton, FormSkeleton } from "./MobileSkeletonScreen";
export { MobileOfflineQueue, useOfflineQueue } from "./MobileOfflineQueue";
export type { OfflineAction } from "./MobileOfflineQueue";
export { MobileTouchSlider } from "./MobileTouchSlider";
export { MobileDocumentCamera } from "./MobileDocumentCamera";
export { MobileBottomSheet } from "./MobileBottomSheet";
export { MobileSearchOverlay } from "./MobileSearchOverlay";

// === MOB2-1 to MOB2-15 (Phase 2) ===
export { MobilePropertyDetailSheet } from "./MobilePropertyDetailSheet";
export { MobileSwipeableDealCard } from "./MobileSwipeableDealCard";
export { MobileQuickActionsFAB } from "./MobileQuickActionsFAB";
export { MobileFullscreenForm } from "./MobileFullscreenForm";
export type { FormField } from "./MobileFullscreenForm";
export { MobileSmartNumberPad } from "./MobileSmartNumberPad";
export { MobileVoiceNotes } from "./MobileVoiceNotes";
export { MobileDashboardCarousel } from "./MobileDashboardCarousel";
export { MobileCashflowTimeline } from "./MobileCashflowTimeline";
export type { CashflowEvent } from "./MobileCashflowTimeline";
export { MobilePagePullToRefresh } from "./MobilePagePullToRefresh";
export { DealsSkeleton, ContactsSkeleton, DocumentsSkeleton, MessagesSkeleton, CashForecastSkeleton, SettingsSkeleton } from "./MobilePageSkeletons";
export { MobileOfflineForm } from "./MobileOfflineForm";
export { useOptimisticUpdate, useOptimisticDelete } from "./MobileOptimisticUpdate";
export { MobileChatInterface } from "./MobileChatInterface";
export type { ChatMessage } from "./MobileChatInterface";
export { MobileDocumentScanner } from "./MobileDocumentScanner";
export { MobileBiometricQuickActions } from "./MobileBiometricQuickActions";

// === MOB3-1 to MOB3-20 (Phase 3) ===
export { MobileStickyActionBar } from "./MobileStickyActionBar";
export type { StickyAction } from "./MobileStickyActionBar";
export { MobileSectionNavigator } from "./MobileSectionNavigator";
export type { SectionItem } from "./MobileSectionNavigator";
export { MobileSwipeToAction } from "./MobileSwipeToAction";
export type { SwipeAction } from "./MobileSwipeToAction";
export { MobileQuickFilterChips } from "./MobileQuickFilterChips";
export type { FilterChip } from "./MobileQuickFilterChips";
export { MobileLongPressMenu } from "./MobileLongPressMenu";
export type { ContextMenuItem } from "./MobileLongPressMenu";
export { MobileDragHandle } from "./MobileDragHandle";
export { MobilePinchZoom } from "./MobilePinchZoom";
export { MobileDoubleTapEdit } from "./MobileDoubleTapEdit";
export { MobileCollapsibleCard } from "./MobileCollapsibleCard";
export { MobileKPIComparison } from "./MobileKPIComparison";
export type { KPIPeriod } from "./MobileKPIComparison";
export { MobileCondensedTable } from "./MobileCondensedTable";
export type { TableField, TableRow } from "./MobileCondensedTable";
export { MobileNotificationBadge, computeBadgeCounts } from "./MobileNotificationBadges";
export type { BadgeCounts } from "./MobileNotificationBadges";
export { CRMSkeleton, TodosSkeleton, BerichteSkeleton, WartungSkeleton, NewstickerSkeleton } from "./MobileAllPageSkeletons";
export { MobileOptimisticToggle } from "./MobileOptimisticToggle";
export { useHapticActions, WithHaptic } from "./MobileHapticSystem";
export type { HapticActions } from "./MobileHapticSystem";
export { MobileQuickAddSheet } from "./MobileQuickAddSheet";
export type { QuickAddOption } from "./MobileQuickAddSheet";
export { MobilePropertyDetailTabs } from "./MobilePropertyDetailTabs";
export type { PropertyTab } from "./MobilePropertyDetailTabs";
export { MobileCRMCallAction } from "./MobileCRMCallAction";
export type { CallLog } from "./MobileCRMCallAction";
export { MobileDashboardWidgetRearrange } from "./MobileDashboardWidgetRearrange";
export type { Widget } from "./MobileDashboardWidgetRearrange";
export { MobileOfflineBanner } from "./MobileOfflineBanner";

// === MOB4-1 to MOB4-20 (Phase 4) ===
export { MobileChartOptimizer } from "./MobileChartOptimizer";
export { MobilePageTransition } from "./MobilePageTransition";
export { MobilePhotoGallery, MobilePhotoThumbnails } from "./MobilePhotoGallery";
export { MobileSmartDatePicker } from "./MobileSmartDatePicker";
export { MobileBottomNavContext } from "./MobileBottomNavContext";
export type { NavContextAction } from "./MobileBottomNavContext";
export { MobileCardTable } from "./MobileCardTable";
export type { CardTableColumn } from "./MobileCardTable";
export { MobileShareSheet, useShare } from "./MobileShareSheet";
export type { ShareData } from "./MobileShareSheet";
export { MobileFloatingLabelInput, MobileFloatingLabelTextarea } from "./MobileFloatingLabelInput";
export { MobileScrollToTop } from "./MobileScrollToTop";
export { MobileInlineEdit } from "./MobileInlineEdit";
export { MobileGestureNavigation } from "./MobileGestureNavigation";
export { MobileAdaptiveFontScaling, useMobileAdaptiveFonts } from "./MobileAdaptiveFontScaling";
export { MobileDarkModeToggle, useMobileDarkMode } from "./MobileDarkMode";
export { MobileQuickStats } from "./MobileQuickStats";
export type { QuickStat } from "./MobileQuickStats";
export { MobilePDFViewer, MobilePDFPreview } from "./MobilePDFViewer";
export { MobileKeyboardAwareScroll, useKeyboardAwareScroll } from "./MobileKeyboardAwareScroll";
export { MobileBatchActions } from "./MobileBatchActions";
export type { BatchAction } from "./MobileBatchActions";
export { MobileConnectionIndicator, useConnectionSpeed } from "./MobileConnectionIndicator";
export { MobileAccessibilityToolbar, useAccessibilitySettings } from "./MobileAccessibilityToolbar";
export { MobileQuickPropertySwitcher } from "./MobileQuickPropertySwitcher";

// === MOB5-1 to MOB5-20 (Phase 5) ===
export { MobileTimelineView } from "./MobileTimelineView";
export type { TimelineEvent } from "./MobileTimelineView";
export { MobileRecentlyViewed, useRecentlyViewed } from "./MobileRecentlyViewed";
export type { RecentItem } from "./MobileRecentlyViewed";
export { MobileBreadcrumbNav } from "./MobileBreadcrumbNav";
export type { BreadcrumbItem } from "./MobileBreadcrumbNav";
export { MobileTabSwitcher } from "./MobileTabSwitcher";
export type { TabItem } from "./MobileTabSwitcher";
export { MobileGroupedList } from "./MobileGroupedList";
export type { GroupedListItem } from "./MobileGroupedList";
export { MobileInfiniteScroll, useInfiniteScroll } from "./MobileInfiniteScroll";
export { MobileMapPreview } from "./MobileMapPreview";
export { MobileCompactCalendar } from "./MobileCompactCalendar";
export type { CalendarEvent } from "./MobileCompactCalendar";
export { MobileSignaturePad } from "./MobileSignaturePad";
export { MobileQuickNote, useQuickNotes } from "./MobileQuickNote";
export type { QuickNote } from "./MobileQuickNote";
export { MobileColorPicker } from "./MobileColorPicker";
export { MobileAddressLookup } from "./MobileAddressLookup";
export type { AddressResult } from "./MobileAddressLookup";
export { MobileProgressTracker } from "./MobileProgressTracker";
export type { ProgressStage } from "./MobileProgressTracker";
export { MobileCountdownTimer } from "./MobileCountdownTimer";
export type { Deadline } from "./MobileCountdownTimer";
export { MobileConfirmSwipe } from "./MobileConfirmSwipe";
export { MobileAvatarGroup } from "./MobileAvatarGroup";
export type { AvatarPerson } from "./MobileAvatarGroup";
export { MobileHeatmapCalendar } from "./MobileHeatmapCalendar";
export type { HeatmapDataPoint } from "./MobileHeatmapCalendar";
export { MobileComparisonSlider } from "./MobileComparisonSlider";
export { MobileImageLazyLoad, generateColorPlaceholder } from "./MobileImageLazyLoad";
export { MobileAppUpdateBanner } from "./MobileAppUpdateBanner";
