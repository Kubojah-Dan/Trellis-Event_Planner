/**
 * @trellis/config
 * Pure, safe configuration and registry for Trellis events and currencies.
 * Contains NO secrets or runtime framework dependencies.
 */

export interface CurrencyDefinition {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  minorUnitFactor: number;
}

export const SUPPORTED_CURRENCIES: Record<string, CurrencyDefinition> = {
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2, minorUnitFactor: 100 },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2, minorUnitFactor: 100 },
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£', decimals: 2, minorUnitFactor: 100 },
  INR: { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 2, minorUnitFactor: 100 },
  CAD: { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', decimals: 2, minorUnitFactor: 100 },
  AUD: { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimals: 2, minorUnitFactor: 100 },
  JPY: { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimals: 0, minorUnitFactor: 1 },
};

export const DEFAULT_CURRENCY = 'USD';

export type EventType = 'wedding' | 'birthday' | 'community' | 'custom';

export interface EventCapability {
  eventType: EventType;
  label: string;
  description: string;
  allowsSubEvents: boolean;
  requiresVolunteerManagement: boolean;
  requiresPermitTracking: boolean;
  requiresAccessibilityChecklist: boolean;
  defaultBudgetCategories: string[];
  defaultVendorCategories: string[];
  intakeFocusKeys: string[];
}

export const EVENT_CAPABILITY_REGISTRY: Record<EventType, EventCapability> = {
  wedding: {
    eventType: 'wedding',
    label: 'Wedding Celebration',
    description: 'Multi-part celebration with ceremony, reception, attire, and vendor coordination.',
    allowsSubEvents: true,
    requiresVolunteerManagement: false,
    requiresPermitTracking: false,
    requiresAccessibilityChecklist: true,
    defaultBudgetCategories: [
      'Venue & Rentals',
      'Catering & Bar',
      'Photography & Videography',
      'Attire & Beauty',
      'Florals & Decor',
      'Music & Entertainment',
      'Stationery & Favors',
      'Contingency',
    ],
    defaultVendorCategories: [
      'Venue',
      'Caterer',
      'Photographer',
      'Florist',
      'DJ / Live Music',
      'Hair & Makeup',
      'Officiant',
      'Baker',
    ],
    intakeFocusKeys: ['atmosphere', 'ceremonyType', 'guestCount', 'venueStyle', 'musicPreference'],
  },
  birthday: {
    eventType: 'birthday',
    label: 'Birthday Celebration',
    description: 'Personalized milestone or festive celebration focused on the guest of honor.',
    allowsSubEvents: false,
    requiresVolunteerManagement: false,
    requiresPermitTracking: false,
    requiresAccessibilityChecklist: false,
    defaultBudgetCategories: [
      'Venue & Space',
      'Food & Beverages',
      'Cake & Desserts',
      'Activities & Entertainment',
      'Decor & Atmosphere',
      'Favors & Keepsakes',
      'Contingency',
    ],
    defaultVendorCategories: [
      'Venue / Party Room',
      'Bakery',
      'Catering / Food Truck',
      'Entertainer / Performer',
      'Decor & Balloon Artist',
    ],
    intakeFocusKeys: ['honoreeInterests', 'ageGroup', 'activityStyle', 'theme', 'energyLevel'],
  },
  community: {
    eventType: 'community',
    label: 'Community Gathering & Fundraiser',
    description: 'Public or shared gathering requiring volunteer coordination, permits, and accessibility.',
    allowsSubEvents: true,
    requiresVolunteerManagement: true,
    requiresPermitTracking: true,
    requiresAccessibilityChecklist: true,
    defaultBudgetCategories: [
      'Permits & Licenses',
      'Venue / Park Reservation',
      'Sound & AV Equipment',
      'Signage & Accessibility',
      'Safety, First Aid & Security',
      'Waste & Cleanup',
      'Refreshments & Water',
      'Contingency',
    ],
    defaultVendorCategories: [
      'Venue / Municipal Authority',
      'AV & Stage Rentals',
      'Sanitation & Waste Services',
      'Security / First Aid',
      'Beverage / Food Vendors',
    ],
    intakeFocusKeys: ['communityObjective', 'expectedAttendance', 'volunteerCapacity', 'permitsNeeded', 'accessibilityNeeds'],
  },
  custom: {
    eventType: 'custom',
    label: 'Custom Celebration or Event',
    description: 'Flexible planning framework adapted to any unique celebration or assembly.',
    allowsSubEvents: true,
    requiresVolunteerManagement: false,
    requiresPermitTracking: false,
    requiresAccessibilityChecklist: true,
    defaultBudgetCategories: [
      'Venue & Location',
      'Hospitality & Catering',
      'Audio/Visual & Production',
      'Design & Atmosphere',
      'Logistics & Operations',
      'Contingency',
    ],
    defaultVendorCategories: [
      'Venue',
      'Caterer',
      'Equipment Rental',
      'Coordinator / Staff',
    ],
    intakeFocusKeys: ['purpose', 'experienceGoal', 'format', 'keyMilestones'],
  },
};

export const PROVENANCE_LABELS = {
  user_confirmed: 'Confirmed by you',
  ai_estimate: 'AI estimate',
  source_checked: 'Source checked',
  vendor_quote: 'Quote received',
  needs_confirmation: 'Needs confirmation',
  refresh_needed: 'Refresh needed',
} as const;

export type ProvenanceKind = keyof typeof PROVENANCE_LABELS;
