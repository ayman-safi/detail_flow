import type { AppLocale } from '@/i18n/config';

export type Stage = 'Booked'|'Arrived'|'Washing'|'Detailing'|'Polishing'|'Ready'|'Delivered';
export type PaymentStatus = 'Pending'|'Paid'|'Refunded';
export type VehicleType = 'Sedan'|'SUV'|'Truck'|'Van'|'Motorcycle'|'Other';
export type TenantPlan = 'Free'|'Pro'|'Business';
export type TenantBillingStatus = 'Trial'|'Active'|'PastDue'|'Suspended'|'Manual';
export type TenantCurrency = 'SAR'|'USD'|'TRY'|'EUR'|'SYP';

export interface Customer {
  id: string;
  fullName: string | null;
  phone: string;
  totalVisits: number;
  createdAt: string;
  lastVisitAt?: string;
  recentWorkOrders?: { id: string; stage: Stage; createdAt: string; serviceName: string; vehiclePlate: string }[];
}
export interface Vehicle { id: string; plateNumber: string; make: string; model: string; color: string; vehicleType: VehicleType; }
export interface ServiceType { id: string; name: string; description?: string; basePrice: number; durationMinutes: number; isActive: boolean; sortOrder: number; imageUrl?: string | null; }
export interface WorkOrderCard {
  id: string; stage: Stage; trackingToken: string;
  customer: Pick<Customer, 'id'|'fullName'|'phone'>;
  vehicle: Pick<Vehicle, 'plateNumber'|'make'|'model'|'color'|'vehicleType'> | null;
  serviceName: string; serviceBasePrice: number;
  assignedStaff?: { id: string; fullName: string } | null;
  estimatedReadyAt?: string; actualPrice?: number; notes?: string;
  paymentStatus: PaymentStatus; photoCount: number;
  createdAt: string; updatedAt: string;
  bookingId?: string | null;
}
export interface BoardData { booked: WorkOrderCard[]; arrived: WorkOrderCard[]; washing: WorkOrderCard[]; detailing: WorkOrderCard[]; polishing: WorkOrderCard[]; ready: WorkOrderCard[]; delivered: WorkOrderCard[]; }
export interface WorkOrderPhoto { id: string; photoUrl: string; type: 'Before'|'After'; uploadedAt: string; }
export interface WorkOrderStageHistoryEntry { fromStage: Stage; toStage: Stage; changedByName: string; changedAt: string; }
export interface WorkOrderDetail {
  card: WorkOrderCard;
  photos: { before: WorkOrderPhoto[]; after: WorkOrderPhoto[] };
  stageHistory: WorkOrderStageHistoryEntry[];
}
export interface BoardStageChangedEvent { workOrderId: string; fromStage: Stage; toStage: Stage; workOrder: WorkOrderCard; }
export interface BoardWorkOrderEvent { workOrder: WorkOrderCard; }
export interface BoardWorkOrderRemovedEvent { workOrderId: string; }
export interface TrackingStageChangedEvent {
  workOrderId: string;
  fromStage: Stage;
  toStage: Stage;
  newStage: Stage;
  newStageName: string;
  estimatedReadyAt?: string;
  lastUpdatedAt?: string;
}
export interface Booking {
  id: string; scheduledAt: string; status: 'Pending'|'Confirmed'|'Cancelled';
  serviceName: string; durationMinutes: number;
  customer: Pick<Customer, 'id'|'fullName'|'phone'>;
  vehicle: Pick<Vehicle, 'id'|'plateNumber'|'make'|'model'|'color'|'vehicleType'> | null;
  workOrderId?: string; trackingToken?: string;
}
export interface BookingDetail {
  id: string;
  scheduledAt: string;
  status: Booking['status'];
  notes?: string | null;
  customer: Pick<Customer, 'id'|'fullName'|'phone'>;
  vehicle: Vehicle | null;
  serviceType: ServiceType;
  workOrder?: { id: string; stage: Stage; photosCount: number } | null;
}
export interface AvailabilitySlot { time: string; available: boolean; bookingCount: number; }
export type DayOfWeek = 'Sunday'|'Monday'|'Tuesday'|'Wednesday'|'Thursday'|'Friday'|'Saturday';
export interface WorkingDay {
  day: DayOfWeek;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}
export interface ClosurePeriod {
  from: string;
  to: string;
  reason?: string | null;
}
export interface TenantSettings {
  bayCapacity: number;
  currency: TenantCurrency;
  workingDays: WorkingDay[];
  closurePeriods: ClosurePeriod[];
}
export interface ReceiptCurrencyOption {
  currency: TenantCurrency;
  label: string;
  symbol: string;
}
export interface ReceiptSettings {
  currency: TenantCurrency;
  supportedCurrencies: ReceiptCurrencyOption[];
}
export interface BookingCreateResult {
  bookingId: string;
  workOrderId: string;
  trackingToken: string;
  trackingUrl: string;
  customer: Pick<Customer, 'id'|'fullName'|'phone'>;
  vehicle: Vehicle | null;
  scheduledAt: string;
  serviceName: string;
}
export interface TrackingInfo { customerName?: string | null; vehicleMake?: string | null; vehicleModel?: string | null; vehicleColor?: string | null; vehiclePlate?: string | null; stage: Stage; stageName: string; serviceName: string; estimatedReadyAt?: string; shopName: string; shopLogoUrl?: string; lastUpdatedAt: string; }
export interface StaffMember { id: string; fullName: string; email: string; phone?: string | null; role: 'Owner'|'Manager'|'Staff'; isActive: boolean; isInvitePending: boolean; completedJobsToday: number; }
export type NotificationEventType = 'ReadyForPickup'|'TrackingLink'|'StaffInvite'|'PasswordReset';
export interface WhatsAppShare { eventType: NotificationEventType; customerPhone: string; trackingUrl: string; receiptUrl: string; whatsAppText: string; }
export interface WhatsAppTemplateSettings {
  eventType: NotificationEventType;
  templateName: string;
  languageCode: string;
}
export interface WhatsAppSettings {
  isEnabled: boolean;
  businessPhoneNumberId: string;
  hasAccessToken: boolean;
  templates: WhatsAppTemplateSettings[];
  autoSendReady: boolean;
  updatedAt?: string;
}
export interface NotificationLogEntry {
  id: string;
  workOrderId?: string;
  channel: 'WhatsApp';
  eventType: NotificationEventType;
  dispatchType: 'Manual'|'Automatic';
  recipientPhone: string;
  providerMessageId?: string;
  status: 'Requested'|'Accepted'|'Sent'|'Delivered'|'Read'|'Failed';
  errorCode?: string;
  errorMessage?: string;
  requestedByUserId?: string;
  requestedByName?: string;
  createdAt: string;
  updatedAt: string;
}
export interface DashboardData {
  today: { totalBookings: number; completedJobs: number; activeVehicles: number; walkIns: number };
  range: { from: string; to: string; days: number };
  summary: { totalBookings: number; completedJobs: number; activeVehicles: number; totalWorkOrders: number; walkIns: number };
  comparison?: {
    previousFrom: string;
    previousTo: string;
    totalBookingsPercent: number | null;
    completedJobsPercent: number | null;
    walkInsPercent: number | null;
    repeatCustomersPercent: number | null;
  };
  topServices: { serviceName: string; count: number }[];
  repeatCustomers: number;
  jobsByDay: { date: string; count: number }[];
  recentActivity: { changedByName: string; vehiclePlate: string; fromStage: Stage; toStage: Stage; changedAt: string }[];
}
export interface PlanStatus {
  plan: TenantPlan;
  bookingsUsed: number;
  bookingsLimit: number;
  bookingsRemaining?: number | null;
  bookingWarningThreshold?: number | null;
  staffUsed: number;
  staffLimit: number;
  photosPerWorkOrder: number;
  whatsAppEnabled: boolean;
  whatsAppProviderSendEnabled: boolean;
  whatsAppMessagesIncluded: number;
  whatsAppMessagesAddon: number;
  whatsAppMessagesUsed: number;
  whatsAppMessagesLimit: number;
  whatsAppMessagesRemaining: number;
  analyticsEnabled: boolean;
  multiLocation: boolean;
}
export type AuthRole = 'Owner'|'Manager'|'Staff'|'SuperAdmin';
export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: AuthRole;
  tenantId?: string | null;
  tenantSlug?: string | null;
  dashboardLocale?: AppLocale;
  isPlatformAdmin?: boolean;
  isSupportSession?: boolean;
  supportTenantName?: string;
  supportExpiresAt?: string;
}

export interface PlatformTenantStats {
  staffAccounts: number;
  activeStaffAccounts: number;
  totalBookings: number;
  currentMonthBookings: number;
  totalWorkOrders: number;
  activeWorkOrders: number;
}

export interface PlatformOwner {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
}

export interface PlatformTenantSummary {
  id: string;
  name: string;
  slug: string;
  plan: TenantPlan;
  billingStatus: TenantBillingStatus;
  isActive: boolean;
  supportAccessEnabled: boolean;
  supportAccessExpiresAt?: string | null;
  createdAt: string;
  owner?: PlatformOwner | null;
  stats: PlatformTenantStats;
}

export interface PlatformTenantUser {
  id: string;
  fullName: string;
  email: string;
  role: 'Owner'|'Manager'|'Staff';
  isActive: boolean;
  isInvitePending: boolean;
  createdAt: string;
}

export interface PlatformTenantDetail {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  plan: TenantPlan;
  billingStatus: TenantBillingStatus;
  billingNotes?: string | null;
  whatsAppMonthlyAddonMessages: number;
  dashboardLocale: AppLocale;
  isActive: boolean;
  supportAccessEnabled: boolean;
  supportAccessExpiresAt?: string | null;
  createdAt: string;
  stats: PlatformTenantStats;
  users: PlatformTenantUser[];
}

export interface DashboardLanguageSettings {
  dashboardLocale: AppLocale;
  supportedLocales: AppLocale[];
}

export interface PlatformTenantList {
  items: PlatformTenantSummary[];
  page: number;
  pageSize: number;
  total: number;
}
