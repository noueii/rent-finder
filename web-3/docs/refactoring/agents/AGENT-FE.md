# Frontend Agent (FE) - Refactoring Tasks

**Agent Type**: Frontend (FE)
**Focus**: Component architecture and separation of concerns
**Start Date**: After BE-003 complete (Day 7-8)
**Critical Path**: Yes - Needed for integration

## 🎯 Your Mission

You are responsible for refactoring the UI layer to follow proper separation of concerns. The main issue is components like ApartmentCard that handle 7+ responsibilities. Your goal is to create focused, reusable components that only handle presentation logic, with business logic moved to services.

## 📋 Your Tasks

### Task FE-001: Split ApartmentCard ✅
**Duration**: 1 day
**Dependencies**: BE-003 (Need service interfaces)
**Blocks**: FE-002
**Completed**: 2025-01-24 by FE

Break apart the monolithic ApartmentCard:

**Current issues in apartment-card.tsx**:
- UI rendering (✅ keep)
- Price calculations (❌ extract) ✅ DONE
- Navigation logic (❌ extract) ✅ DONE
- Score calculation (❌ extract) ✅ DONE
- Image carousel (❌ extract) ✅ DONE
- External links (❌ extract) ✅ DONE
- Maps URL generation (❌ extract) ✅ DONE

**New structure**:
```
presentation/components/apartment/
├── ApartmentCard.tsx (main component, <100 lines) ✅
├── ApartmentPrice.tsx ✅
├── ApartmentScore.tsx ✅
├── ApartmentImages.tsx ✅
├── ApartmentActions.tsx ✅
└── index.ts ✅
```

**Acceptance Criteria**:
- [x] ApartmentCard < 100 lines (achieved)
- [x] Each sub-component single purpose
- [x] No business logic in components
- [x] Props properly typed
- [x] Maintains current functionality
- [x] Created presentation services layer
- [x] Backward compatibility maintained

### Task FE-002: Extract Services ⬜
**Duration**: 1 day
**Dependencies**: FE-001, BE-003
**Blocks**: FE-003

Move business logic to services:
```typescript
// src/presentation/services/
├── price-calculator.ts
├── navigation-builder.ts
├── score-display-formatter.ts
└── map-url-generator.ts
```

**Acceptance Criteria**:
- [ ] All calculations in services
- [ ] Services are pure functions
- [ ] Services well tested
- [ ] Components use services
- [ ] No logic duplication

### Task FE-003: Component Library ⬜
**Duration**: 1 day
**Dependencies**: FE-002
**Blocks**: FE-004

Create reusable UI primitives:
```
components/ui/
├── Card/
├── Badge/
├── Score/
├── Price/
├── ImageGallery/
└── ActionBar/
```

**Acceptance Criteria**:
- [ ] Consistent styling system
- [ ] Components use design tokens
- [ ] Proper TypeScript props
- [ ] Storybook stories (if exists)
- [ ] Accessibility considered

### Task FE-004: Form Components ⬜
**Duration**: 1 day
**Dependencies**: FE-003
**Blocks**: FE-005

Consolidate duplicate form patterns:

**Current issues**:
- Multiple similar form interfaces
- Repeated validation logic
- Inconsistent error handling

**New structure**:
```typescript
// src/presentation/components/forms/
export function useForm<T>() { }
export function FormField() { }
export function FormError() { }
```

**Acceptance Criteria**:
- [ ] Generic form components
- [ ] Consistent validation
- [ ] Reusable error display
- [ ] Type-safe forms
- [ ] Reduced duplication

### Task FE-005: Update Pages ⬜
**Duration**: 2 days
**Dependencies**: FE-004
**Blocks**: IN-004

Update all pages to use new components:
1. Search page
2. Apartment detail page
3. User preferences page
4. Lists page
5. Admin pages

**Acceptance Criteria**:
- [ ] All pages use new components
- [ ] No business logic in pages
- [ ] Consistent styling
- [ ] Performance maintained
- [ ] All features working

## 📁 Files You Own

```
src/
├── presentation/
│   ├── components/
│   │   ├── apartment/
│   │   ├── forms/
│   │   ├── layout/
│   │   └── ui/
│   ├── hooks/
│   │   ├── use-form.ts
│   │   ├── use-apartments.ts
│   │   └── use-auth.ts
│   ├── services/
│   │   ├── formatting/
│   │   └── calculations/
│   └── styles/
│       ├── tokens.css
│       └── components.css
├── app/ (Next.js pages)
└── components/ (refactor these)
```

## 🚫 Do NOT Touch

- Backend API logic
- Database queries
- Scraper code
- Server-side logic

## 📝 Progress Tracking

Track your progress:
1. Update REFACTOR-PROGRESS.md
2. Screenshot UI changes
3. Note any UX improvements
4. Commit format: `[FE] Task: Description`

## 🔧 Quick Commands

```bash
# Run component tests
npm test src/presentation/components

# Type check
npm run type-check

# Lint
npm run lint src/presentation

# Dev server
npm run dev

# Check bundle size
npm run analyze
```

## 💡 Refactoring Examples

### Before (BAD):
```typescript
// 200+ lines, doing everything
export function ApartmentCard({ apartment }: Props) {
  // Price calculations
  const monthlyPrice = apartment.price;
  const yearlyPrice = monthlyPrice * 12;
  const twoYearCost = calculateTotalCost(apartment);
  
  // Score calculation
  const scorer = useApartmentScorer();
  const score = scorer.calculate(apartment);
  
  // Navigation building
  const searchParams = new URLSearchParams();
  searchParams.set('from', apartment.nearestStation);
  // ... more logic
  
  return (
    <div>
      {/* Everything mixed together */}
    </div>
  );
}
```

### After (GOOD):
```typescript
// Clean, focused component
export function ApartmentCard({ apartment }: Props) {
  return (
    <Card>
      <ApartmentImages images={apartment.images} />
      <CardContent>
        <ApartmentTitle apartment={apartment} />
        <ApartmentPrice apartment={apartment} />
        <ApartmentScore apartmentId={apartment.id} />
      </CardContent>
      <ApartmentActions apartment={apartment} />
    </Card>
  );
}

// Price logic in service
export const priceCalculator = {
  getMonthly: (apt: Apartment) => apt.price,
  getYearly: (apt: Apartment) => apt.price * 12,
  getTwoYearTotal: (apt: Apartment) => {
    // Calculation logic here
  }
};
```

## 🎨 Design Guidelines

1. **Component Size**: Aim for < 100 lines
2. **Props**: Explicit, well-typed interfaces
3. **State**: Minimal, lifted when shared
4. **Effects**: Only for side effects
5. **Memo**: Only when measured necessary

## 🚨 Critical Reminders

- Don't break existing functionality
- Maintain current performance
- Keep accessibility in mind
- Test on mobile devices
- Preserve all current features

## 📊 Success Metrics

Your refactoring succeeds when:
- ApartmentCard < 100 lines
- No business logic in components
- 50% less component code
- Bundle size reduced
- Render performance maintained

## ⚡ Performance Tips

1. Lazy load heavy components
2. Memoize expensive calculations
3. Use React.memo sparingly
4. Virtualize long lists
5. Optimize images

## 📞 Communication

- **Blocked by BE?** Check service interface status
- **UI change?** Screenshot for team
- **Performance issue?** Measure and report
- **Design question?** Ask in progress file

### Task FE-006: Component Testing ✅
**Duration**: 1 day
**Dependencies**: FE-005
**Blocks**: FE-007
**Completed**: 2025-01-25 by FE

Add comprehensive tests for all components:

**Test Coverage**:
- UI components in `src/presentation/components/ui/__tests__/` ✅
- Form components in `src/presentation/components/forms/__tests__/` ✅
- Presentation services in `src/presentation/services/__tests__/` ✅

**Completed**:
- [x] Card, Badge, Score, Price, ImageGallery, ActionBar tests
- [x] Form, FormField, useForm hook tests
- [x] price-calculator, score-formatter, apartment-filters, list-manager tests
- [x] Jest configuration for React components (jest.react.config.js)
- [x] Test setup with proper mocks
- [x] React Testing Library scripts added to package.json

### Task FE-007: Update State Management ⬜
**Duration**: 1 day
**Dependencies**: FE-006
**Blocks**: FE-008

Improve state management patterns:
- Extract global state to contexts
- Remove prop drilling
- Implement proper data fetching patterns
- Add optimistic updates

### Task FE-008: Performance Optimization ⬜
**Duration**: 1 day
**Dependencies**: FE-007
**Blocks**: FE-009

Optimize component performance:
- Implement React.memo where beneficial
- Add lazy loading for routes
- Optimize bundle splitting
- Add performance monitoring

### Task FE-009: Container Pattern ⬜
**Duration**: 1 day
**Dependencies**: FE-008
**Blocks**: Integration

Implement container/presenter pattern:
- Create container components for data fetching
- Keep presentational components pure
- Separate concerns cleanly
- Document patterns

---
*Components should be like LEGO blocks - small, focused, and composable! 🧱*