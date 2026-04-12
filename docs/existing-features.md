# Existing Features Inventory

## Storefront Routes (`app/(store)`)
- `/` (Homepage)
- `/about`
- `/account` (User profile and settings)
- `/auth` (Authentication pages)
- `/blog` (Blog section)
- `/cart` (Shopping cart)
- `/categories` (Product categories)
- `/checkout` (Checkout process)
- `/contact` (Contact us page)
- `/faqs` (Frequently Asked Questions)
- `/help` (Help section)
- `/order-success` (Order success page)
- `/order-tracking` (Order tracking)
- `/pay` (Payment pages)
- `/privacy` (Privacy policy)
- `/product` (Product details)
- `/pwa-settings` (PWA application settings)
- `/returns` (Returns policy and forms)
- `/shipping` (Shipping information)
- `/shop` (Main shop page/catalog)
- `/support` (Customer support)
- `/terms` (Terms and conditions)
- `/wishlist` (User wishlist)

## Admin Routes (`app/admin`)
- (Multiple admin dashboard & CRUD logic folders - strictly preserved as-is)

## Components (`components/`)
### Layout & Header/Footer
- `Header.tsx` (Main navigation)
- `Footer.tsx` (Footer links & sections)
- `MobileBottomNav.tsx`
- `AnnouncementBar.tsx`
- `MobileSearchOverlay.tsx`

### Product UI
- `ProductCard.tsx` (List display)
- `ProductFilters.tsx` & `MobileFilterDrawer.tsx`
- `ProductSort.tsx`
- `ImageZoom.tsx` & `LazyImage.tsx`
- `ProductReviews.tsx`
- `QuickViewModal.tsx`
- `SizeGuideModal.tsx`
- `RecentlyViewed.tsx` & `SmartRecommendations.tsx`

### E-commerce Features
- `MiniCart.tsx` & `CartSuggestions.tsx` & `CartCountdown.tsx`
- `AdvancedCouponSystem.tsx`
- `AdvancedSearch.tsx`
- `CheckoutSteps.tsx`
- `OrderSummary.tsx` & `OrderBumpUpsell.tsx`
- `FlashSaleBanner.tsx`
- `FreeShippingBar.tsx`
- `StockNotification.tsx`

### UI & Global State
- `SkeletonLoader.tsx`
- `AnimatedSection.tsx`
- `PageHero.tsx`
- `ScrollToTop.tsx`
- `SocialShareButtons.tsx`

### Security/PWA/Compliance
- `CookieConsent.tsx`
- `FraudDetectionAlert.tsx`
- `PasswordStrengthMeter.tsx`
- `OfflineIndicator.tsx` & `NetworkStatusMonitor.tsx`
- `PWAInstaller.tsx`, `PWAPrompt.tsx`, `PWASplash.tsx`, `UpdatePrompt.tsx`, `PushNotificationManager.tsx`
- `SessionTimeoutWarning.tsx`
- `AccessibilityMenu.tsx`
- `InstallInstructions.tsx`
- `ErrorBoundary.tsx`
- `SEOHead.tsx`

## API & Backend Services
- Uses Next.js App Router for backend routes (`app/api/`)
- Likely integrated with Supabase/Supabase Storage (reference to `SUPABASE_STORAGE.md` & `SECURITY_RLS_SETUP.md`)
- Existing auth, cart, checkout, admin CRUD logic to remain functional.
