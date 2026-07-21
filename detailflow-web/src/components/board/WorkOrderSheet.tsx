'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Car, CheckCircle, Copy, Download, Loader2, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { getApiErrorMessage } from '@/lib/api';
import { useTenantCurrency } from '@/hooks/useTenantCurrency';
import { useAuthStore } from '@/store/authStore';
import { useBoardStore } from '@/store/boardStore';
import type { NotificationEventType, PaymentStatus, Stage, StaffMember, VehicleType, WhatsAppShare, WorkOrderCard, WorkOrderDetail, WorkOrderStageHistoryEntry } from '@/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { StageBadge } from '@/components/shared/StageBadge';
import { PhotoGrid } from '@/components/photos/PhotoGrid';
import { PhotoUploader } from '@/components/photos/PhotoUploader';
import { useI18n } from '@/i18n/I18nProvider';
import { getStageKey, getVehicleTypeKey, stageSequence, vehicleTypes } from '@/i18n/domain';
import { cn } from '@/lib/utils';

const defaultTab = 'details';
const paymentStatuses: PaymentStatus[] = ['Pending', 'Paid', 'Refunded'];

export function WorkOrderSheet({ workOrderId, onClose }: { workOrderId: string | null; onClose: () => void }) {
  const [tab, setTab] = useState<'details' | 'photos' | 'history'>(defaultTab);
  const [actualPrice, setActualPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [savedDraft, setSavedDraft] = useState({ workOrderId: '', actualPrice: '', notes: '' });
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [whatsAppLoading, setWhatsAppLoading] = useState(false);
  const [whatsAppDialogOpen, setWhatsAppDialogOpen] = useState(false);
  const [whatsAppEventType, setWhatsAppEventType] = useState<NotificationEventType>('TrackingLink');
  const [whatsAppShare, setWhatsAppShare] = useState<WhatsAppShare | null>(null);
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);
  const [pendingNavigationHref, setPendingNavigationHref] = useState<string | null>(null);
  const [vehicleSaving, setVehicleSaving] = useState(false);
  const [vehicleDraft, setVehicleDraft] = useState({ plateNumber: '', make: '', model: '', color: '', vehicleType: 'Sedan' as VehicleType });
  const user = useAuthStore((state) => state.user);
  const updateCard = useBoardStore((state) => state.updateCard);
  const qc = useQueryClient();
  const router = useRouter();
  const managerOrOwner = user?.role === 'Owner' || user?.role === 'Manager';
  const { formatCurrency, formatRelativeTime, isRtl, locale, t } = useI18n();
  const currency = useTenantCurrency();

  const { data, isLoading, refetch } = useQuery<WorkOrderDetail>({
    queryKey: ['work-order', workOrderId],
    enabled: !!workOrderId,
    queryFn: () => api.get<WorkOrderDetail>(`/work-orders/${workOrderId}`).then((response) => response.data),
  });

  const { data: staff = [] } = useQuery<StaffMember[]>({
    queryKey: ['staff'],
    enabled: !!workOrderId && managerOrOwner,
    queryFn: () => api.get<StaffMember[]>('/staff').then((response) => response.data),
  });

  const card = data?.card;
  const assignableStaff = staff.filter((member) => member.isActive && !member.isInvitePending);
  const persistedActualPrice = useMemo(() => String(card?.actualPrice ?? card?.serviceBasePrice ?? ''), [card?.actualPrice, card?.serviceBasePrice]);
  const persistedNotes = card?.notes ?? '';
  const isDirty = !!card && (
    actualPrice !== savedDraft.actualPrice ||
    notes !== savedDraft.notes
  );

  useEffect(() => {
    setTab(defaultTab);

    if (workOrderId) return;
    setSavedDraft({ workOrderId: '', actualPrice: '', notes: '' });
    setActualPrice('');
    setNotes('');
    setPendingNavigationHref(null);
    setUnsavedDialogOpen(false);
  }, [workOrderId]);

  useEffect(() => {
    if (!card) return;
    if (savedDraft.workOrderId === card.id) return;
    setActualPrice(persistedActualPrice);
    setNotes(persistedNotes);
    setSavedDraft({ workOrderId: card.id, actualPrice: persistedActualPrice, notes: persistedNotes });
  }, [card, persistedActualPrice, persistedNotes, savedDraft.workOrderId]);

  useEffect(() => {
    if (!workOrderId || !isDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;

      const nextHref = `${url.pathname}${url.search}${url.hash}`;
      const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextHref === currentHref) return;

      event.preventDefault();
      setPendingNavigationHref(nextHref);
      setUnsavedDialogOpen(true);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleDocumentClick, true);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, [isDirty, workOrderId]);

  if (!workOrderId) return null;

  const refreshBoardCard = (updated: WorkOrderCard) => {
    if (updated) updateCard(updated);
    qc.invalidateQueries({ queryKey: ['board'] });
    refetch();
  };

  const closeDrawer = () => {
    setUnsavedDialogOpen(false);
    setPendingNavigationHref(null);
    onClose();
  };

  const requestClose = () => {
    if (!isDirty) {
      closeDrawer();
      return;
    }

    setPendingNavigationHref(null);
    setUnsavedDialogOpen(true);
  };

  const changeStage = async (stage: Stage) => {
    const { data: updated } = await api.patch<WorkOrderCard>(`/work-orders/${workOrderId}/stage`, { newStage: stage });
    refreshBoardCard(updated);
    toast.success(t('board.toasts.movedTo', { stage: t(getStageKey(stage)) }));
  };

  const assignStaff = async (staffUserId: string) => {
    const { data: updated } = await api.patch<WorkOrderCard>(`/work-orders/${workOrderId}/assign`, {
      staffUserId: staffUserId || null,
    });
    refreshBoardCard(updated);
    toast.success(staffUserId ? t('board.toasts.staffAssigned') : t('board.toasts.staffUnassigned'));
  };

  const savePriceAndNotes = async () => {
    if (!managerOrOwner) return false;
    const price = Number(actualPrice);
    if (!Number.isFinite(price) || price < 0) {
      toast.error(t('board.toasts.invalidPrice'));
      return false;
    }
    const { data: updated } = await api.patch<WorkOrderCard>(`/work-orders/${workOrderId}/price`, {
      actualPrice: price,
      notes,
    });
    setSavedDraft({
      workOrderId,
      actualPrice: String(updated.actualPrice ?? updated.serviceBasePrice ?? ''),
      notes: updated.notes ?? '',
    });
    refreshBoardCard(updated);
    toast.success(t('board.toasts.workOrderUpdated'));
    return true;
  };

  const updatePaymentStatus = async (status: PaymentStatus) => {
    const { data: updated } = await api.patch<WorkOrderCard>(`/work-orders/${workOrderId}/payment-status`, {
      status,
    });
    refreshBoardCard(updated);
    toast.success(t('board.toasts.paymentUpdated'));
  };

  const downloadReceipt = async () => {
    if (!card?.vehicle) return;
    setReceiptLoading(true);
    try {
      const response = await api.get(`/work-orders/${workOrderId}/receipt`, {
        params: { locale },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt-${card.vehicle.plateNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setReceiptLoading(false);
    }
  };

  const completeVehicle = async () => {
    if (!card?.bookingId || vehicleSaving) return;
    if (!vehicleDraft.plateNumber.trim() || !vehicleDraft.make.trim() || !vehicleDraft.model.trim() || !vehicleDraft.color.trim()) {
      toast.error(t('bookings.completeVehicle.required'));
      return;
    }
    setVehicleSaving(true);
    try {
      const { data: updated } = await api.patch<WorkOrderCard>(`/bookings/${card.bookingId}/vehicle`, {
        vehiclePlate: vehicleDraft.plateNumber,
        vehicleMake: vehicleDraft.make,
        vehicleModel: vehicleDraft.model,
        vehicleColor: vehicleDraft.color,
        vehicleType: vehicleDraft.vehicleType,
      });
      refreshBoardCard(updated);
      await Promise.all([refetch(), qc.invalidateQueries({ queryKey: ['bookings'] })]);
      toast.success(t('bookings.completeVehicle.saved'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('bookings.completeVehicle.failed')));
    } finally {
      setVehicleSaving(false);
    }
  };

  const deletePhoto = async (photoId: string) => {
    await api.delete(`/work-orders/${workOrderId}/photos/${photoId}`);
    toast.success(t('board.toasts.photoDeleted'));
    refetch();
  };

  const prepareWhatsAppShare = async (eventType?: NotificationEventType) => {
    if (!card) return;
    const selectedEventType = eventType ?? (card.stage === 'Ready' || card.stage === 'Delivered' ? 'ReadyForPickup' : 'TrackingLink');
    setWhatsAppEventType(selectedEventType);
    setWhatsAppLoading(true);
    try {
      const { data: share } = await api.post<WhatsAppShare>(`/work-orders/${workOrderId}/share/whatsapp`, null, {
        params: { eventType: selectedEventType, locale },
      });
      const recipient = String(share.customerPhone ?? '').replace(/\D/g, '');
      if (recipient.length < 7) {
        toast.error(t('board.toasts.whatsAppInvalidPhone'));
        return;
      }

      setWhatsAppShare(share);
      setWhatsAppDialogOpen(true);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('board.toasts.whatsAppFailed')));
    } finally {
      setWhatsAppLoading(false);
    }
  };

  const openPreparedWhatsApp = () => {
    if (!whatsAppShare) return;
    const recipient = String(whatsAppShare.customerPhone ?? '').replace(/\D/g, '');
    const whatsAppUrl = `https://wa.me/${recipient}?text=${encodeURIComponent(String(whatsAppShare.whatsAppText ?? ''))}`;
    window.open(whatsAppUrl, '_blank', 'noopener,noreferrer');
    toast.success(t('board.toasts.whatsAppOpened'));
  };

  const copyPreparedWhatsApp = async () => {
    if (!whatsAppShare) return;
    try {
      await navigator.clipboard.writeText(whatsAppShare.whatsAppText);
      toast.success(t('board.toasts.whatsAppCopied'));
    } catch {
      toast.error(t('board.toasts.whatsAppCopyFailed'));
    }
  };

  const sectionLabelClassName = 'text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-muted)]';
  const panelClassName = 'rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4';
  const selectClassName = cn(
    'h-11 w-full min-w-0 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-muted)]',
    isRtl ? 'text-right' : 'text-left',
  );
  const canUseWhatsApp = !!card && String(card.customer.phone ?? '').replace(/\D/g, '').length >= 7;
  const handleDiscardChanges = () => {
    if (pendingNavigationHref) {
      const href = pendingNavigationHref;
      setPendingNavigationHref(null);
      setUnsavedDialogOpen(false);
      onClose();
      router.push(href);
      return;
    }

    closeDrawer();
  };

  const handleSaveAndContinue = async () => {
    const saved = await savePriceAndNotes();
    if (!saved) return;

    if (pendingNavigationHref) {
      const href = pendingNavigationHref;
      setPendingNavigationHref(null);
      setUnsavedDialogOpen(false);
      onClose();
      router.push(href);
      return;
    }

    closeDrawer();
  };

  return (
    <>
      <Sheet open={!!workOrderId} onOpenChange={(open) => !open && requestClose()}>
        <SheetContent className={cn('overflow-y-auto p-0', isRtl ? 'text-right' : 'text-left')}>
        {isLoading || !card ? (
          <div className="space-y-3 px-5 pb-8 pt-5 sm:px-6">
            <SheetTitle className="sr-only">{t('board.workOrder.title')}</SheetTitle>
            <div className="skeleton h-8 w-48" />
            <div className="skeleton h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-5 px-5 pb-8 pt-5 sm:px-6">
            <header className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-5 pe-12">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <SheetTitle className="font-[var(--font-display)] text-[1.75rem] leading-none font-semibold">
                    {t('board.workOrder.title')}
                  </SheetTitle>
                  <div className="plate text-2xl">{card.vehicle?.plateNumber ?? t('common.states.vehiclePending')}</div>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {card.vehicle ? `${card.vehicle.make} ${card.vehicle.model}` : t('bookings.vehiclePendingHelp')}
                  </p>
                </div>
                <div className={cn('flex min-w-0 flex-col gap-3 sm:min-w-[140px]', isRtl ? 'items-start text-right' : 'items-start text-left sm:items-end sm:text-right')}>
                  <StageBadge stage={card.stage} size="md" />
                  <div className="space-y-1">
                    <p className={sectionLabelClassName}>{t('common.labels.service')}</p>
                    <p className="text-sm font-medium text-[var(--color-text)]">{card.serviceName}</p>
                  </div>
                </div>
              </div>
            </header>

            <Tabs dir={isRtl ? 'rtl' : 'ltr'} value={tab} onValueChange={(value) => setTab(value as 'details' | 'photos' | 'history')}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">{t('board.workOrder.tabs.details')}</TabsTrigger>
                <TabsTrigger value="photos">{t('board.workOrder.tabs.photos')}</TabsTrigger>
                <TabsTrigger value="history">{t('board.workOrder.tabs.history')}</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-5">
                {!card.vehicle && card.bookingId && (
                  <section className="rounded-[var(--radius-lg)] border border-[var(--color-primary)] bg-[var(--color-primary-muted)] p-4">
                    <h3 className="flex items-center gap-2 font-semibold text-[var(--color-primary)]"><Car size={18} />{t('bookings.completeVehicle.title')}</h3>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t('bookings.completeVehicle.description')}</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div><Label>{t('common.labels.plate')}</Label><Input value={vehicleDraft.plateNumber} onChange={(event) => setVehicleDraft((current) => ({ ...current, plateNumber: event.target.value.toUpperCase() }))} /></div>
                      <div><Label>{t('common.labels.make')}</Label><Input value={vehicleDraft.make} onChange={(event) => setVehicleDraft((current) => ({ ...current, make: event.target.value }))} /></div>
                      <div><Label>{t('common.labels.model')}</Label><Input value={vehicleDraft.model} onChange={(event) => setVehicleDraft((current) => ({ ...current, model: event.target.value }))} /></div>
                      <div><Label>{t('common.labels.color')}</Label><Input value={vehicleDraft.color} onChange={(event) => setVehicleDraft((current) => ({ ...current, color: event.target.value }))} /></div>
                      <div><Label>{t('common.labels.type')}</Label><select className={cn(selectClassName, 'mt-2')} value={vehicleDraft.vehicleType} onChange={(event) => setVehicleDraft((current) => ({ ...current, vehicleType: event.target.value as VehicleType }))}>{vehicleTypes.map((type) => <option key={type} value={type}>{t(getVehicleTypeKey(type))}</option>)}</select></div>
                    </div>
                    <Button className="mt-4 h-11 w-full sm:w-auto" disabled={vehicleSaving} onClick={() => void completeVehicle()}>{vehicleSaving && <Loader2 size={16} className="animate-spin" />}{t('bookings.completeVehicle.action')}</Button>
                  </section>
                )}
                <section className={cn('grid gap-4 sm:grid-cols-2', isRtl && 'sm:[direction:rtl]')}>
                  <div className={panelClassName}>
                    <p className={sectionLabelClassName}>{t('common.labels.customer')}</p>
                    <p className="mt-2 text-lg font-semibold">{card.customer.fullName ?? card.customer.phone}</p>
                    <a className="mt-1 inline-flex text-sm text-[var(--color-primary)]" href={`tel:${card.customer.phone}`}>
                      {card.customer.phone}
                    </a>
                  </div>
                  <div className={panelClassName}>
                    <p className={sectionLabelClassName}>{t('common.labels.vehicle')}</p>
                    <p className="mt-2 text-lg font-semibold">
                      {card.vehicle ? `${card.vehicle.color} ${t(getVehicleTypeKey(card.vehicle.vehicleType))}` : t('common.states.vehiclePending')}
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                      {card.vehicle ? `${card.vehicle.make} ${card.vehicle.model}` : t('bookings.vehiclePendingHelp')}
                    </p>
                  </div>
                </section>

                <section className={cn('grid gap-3 sm:grid-cols-2', isRtl && 'sm:[direction:rtl]')}>
                  <div>
                    <Label>{t('common.labels.actualPrice')}</Label>
                    <Input
                      className="mt-2 h-11 rounded-[var(--radius-md)] bg-[var(--color-surface-elevated)]"
                      type="number"
                      min="0"
                      step="0.01"
                      value={actualPrice}
                      disabled={!managerOrOwner}
                      onChange={(event) => setActualPrice(event.target.value)}
                    />
                  </div>
                  {managerOrOwner && (
                    <div>
                      <Label>{t('common.labels.assignedStaff')}</Label>
                      <select
                        className={cn(selectClassName, 'mt-2')}
                        value={card.assignedStaff?.id ?? ''}
                        onChange={(event) => assignStaff(event.target.value)}
                      >
                        <option value="">{t('common.states.unassigned')}</option>
                        {assignableStaff.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.fullName}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {managerOrOwner && (
                    <div>
                      <Label>{t('board.workOrder.paymentStatus')}</Label>
                      <select
                        className={cn(selectClassName, 'mt-2')}
                        value={card.paymentStatus}
                        onChange={(event) => updatePaymentStatus(event.target.value as PaymentStatus)}
                      >
                        {paymentStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </section>

                <section>
                  <Label>{t('common.labels.notes')}</Label>
                  <Textarea
                    className="mt-2 min-h-[110px] rounded-[var(--radius-md)] bg-[var(--color-surface-elevated)]"
                    value={notes}
                    disabled={!managerOrOwner}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder={t('board.workOrder.notesPlaceholder')}
                  />
                </section>

                <section className={panelClassName}>
                  <div className={cn('grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]', isRtl && managerOrOwner && 'sm:[direction:rtl]')}>
                    {managerOrOwner ? (
                      <div>
                        <Label>{t('common.labels.stage')}</Label>
                        <select
                          className={cn(selectClassName, 'mt-2')}
                          value={card.stage}
                          onChange={(event) => changeStage(event.target.value as Stage)}
                          disabled={!card.vehicle}
                        >
                          {stageSequence.map((stage) => (
                            <option key={stage} value={stage}>
                              {t(getStageKey(stage))}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                    <div className="flex flex-col justify-end">
                      <Button
                        className="mt-auto h-11 w-full rounded-[var(--radius-md)]"
                        variant="secondary"
                        onClick={downloadReceipt}
                        disabled={receiptLoading || !card.vehicle}
                      >
                        {receiptLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download size={16} />}
                        {t('common.actions.downloadReceipt')}
                      </Button>
                    </div>
                  </div>
                </section>

                <section className={cn(panelClassName, 'flex items-center justify-between gap-4')}>
                  <div>
                    <p className={sectionLabelClassName}>{t('common.labels.actualPrice')}</p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">
                      {formatCurrency(Number(actualPrice || card.serviceBasePrice || 0), currency)}
                    </p>
                  </div>
                  <div className={cn('rounded-full px-3 py-1 text-xs font-medium', 'bg-[var(--color-primary-muted)] text-[var(--color-primary)]')}>
                    {t(getStageKey(card.stage))}
                  </div>
                </section>

                <section className="space-y-3">
                  <section className={panelClassName}>
                      <p className={sectionLabelClassName}>{t('board.workOrder.customerCommunication')}</p>
                      <p className="mt-2 text-sm text-[var(--color-text-muted)]">{card.stage === 'Ready' ? t('board.workOrder.whatsAppDescription') : t('board.workOrder.whatsAppTrackingDescription')}</p>
                      <Button
                        className="mt-4 h-11 w-full rounded-[var(--radius-md)]"
                        onClick={() => void prepareWhatsAppShare()}
                        disabled={!canUseWhatsApp || whatsAppLoading}
                      >
                        {whatsAppLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle size={16} />}
                        {card.stage === 'Ready' ? t('board.workOrder.reSendReadyWhatsApp') : t('board.workOrder.reSendTrackingWhatsApp')}
                      </Button>
                  </section>

                  {managerOrOwner && (
                    <Button className="h-11 w-full rounded-[var(--radius-md)]" onClick={savePriceAndNotes}>
                      {t('common.actions.saveChanges')}
                    </Button>
                  )}

                  {card.stage === 'Ready' && (
                    <div className="space-y-2">
                      <Button
                        className="h-11 w-full rounded-[var(--radius-md)] bg-[var(--color-success)] hover:bg-[var(--color-success)]"
                        onClick={() => changeStage('Delivered')}
                        disabled={card.paymentStatus !== 'Paid'}
                      >
                        <CheckCircle size={16} />
                        {t('common.actions.markDelivered')}
                      </Button>
                      {card.paymentStatus !== 'Paid' && (
                        <p className="text-xs text-[var(--color-text-muted)]">{t('board.workOrder.paymentRequiredForDelivery')}</p>
                      )}
                    </div>
                  )}
                </section>
              </TabsContent>

              <TabsContent value="photos" className="grid gap-5">
                <section className={panelClassName}>
                  <p className="mb-3 text-sm text-[var(--color-text-muted)]">{t('board.workOrder.before')}</p>
                  <PhotoUploader workOrderId={workOrderId} type="Before" onUploaded={refetch} />
                  <div className="mt-3">
                    <PhotoGrid photos={data.photos?.before ?? []} onDelete={deletePhoto} />
                  </div>
                </section>
                <section className={panelClassName}>
                  <p className="mb-3 text-sm text-[var(--color-text-muted)]">{t('board.workOrder.after')}</p>
                  <PhotoUploader workOrderId={workOrderId} type="After" onUploaded={refetch} />
                  <div className="mt-3">
                    <PhotoGrid photos={data.photos?.after ?? []} onDelete={deletePhoto} />
                  </div>
                </section>
              </TabsContent>

              <TabsContent value="history" className="space-y-3">
                {data.stageHistory?.length ? (
                  data.stageHistory.map((history: WorkOrderStageHistoryEntry, index: number) => (
                    <section key={index} className={panelClassName}>
                      <div className="border-s border-[var(--color-border)] ps-3 text-sm">
                        <StageBadge stage={history.fromStage} />{' '}
                        <span className="text-[var(--color-text-muted)]">{t('board.workOrder.historyTo')}</span>{' '}
                        <StageBadge stage={history.toStage} />
                        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                          {t('board.workOrder.historyBy', {
                            name: history.changedByName,
                            time: formatRelativeTime(history.changedAt),
                          })}
                        </p>
                      </div>
                    </section>
                  ))
                ) : (
                  <p className="text-sm text-[var(--color-text-muted)]">{t('board.workOrder.historyEmpty')}</p>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
        </SheetContent>
      </Sheet>

      <Dialog open={unsavedDialogOpen} onOpenChange={(open) => {
        setUnsavedDialogOpen(open);
        if (!open) setPendingNavigationHref(null);
      }}>
        <DialogContent className={cn(isRtl ? 'text-right' : 'text-left')}>
          <DialogHeader>
            <DialogTitle>{t('board.workOrder.unsavedTitle')}</DialogTitle>
            <DialogDescription>
              {t('board.workOrder.unsavedDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className={cn('flex flex-col gap-2 sm:flex-row', isRtl ? 'sm:flex-row-reverse' : 'sm:justify-end')}>
            <Button variant="ghost" onClick={() => { setUnsavedDialogOpen(false); setPendingNavigationHref(null); }}>
              {t('common.actions.cancel')}
            </Button>
            <Button variant="secondary" onClick={handleDiscardChanges}>
              {t('board.workOrder.discardChanges')}
            </Button>
            <Button onClick={() => void handleSaveAndContinue()}>
              {t('board.workOrder.saveAndLeave')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={whatsAppDialogOpen} onOpenChange={setWhatsAppDialogOpen}>
        <DialogContent className={cn(isRtl ? 'text-right' : 'text-left')}>
          <DialogHeader>
            <DialogTitle>{t('board.workOrder.whatsAppDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('board.workOrder.whatsAppDialogDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('board.workOrder.whatsAppEventType')}</Label>
              <select
                className={cn(selectClassName, 'mt-2')}
                value={whatsAppEventType}
                disabled={whatsAppLoading}
                onChange={(event) => void prepareWhatsAppShare(event.target.value as NotificationEventType)}
              >
                <option value="TrackingLink">{t('settings.notifications.eventTypes.TrackingLink')}</option>
                <option value="ReadyForPickup">{t('settings.notifications.eventTypes.ReadyForPickup')}</option>
              </select>
            </div>
            <div>
              <Label>{t('board.workOrder.whatsAppPreview')}</Label>
              <Textarea
                readOnly
                className="mt-2 min-h-[130px] rounded-[var(--radius-md)] bg-[var(--color-surface-elevated)]"
                value={whatsAppShare?.whatsAppText ?? ''}
              />
            </div>
            <div className={cn('flex flex-col gap-2 sm:flex-row', isRtl ? 'sm:flex-row-reverse' : 'sm:justify-end')}>
              <Button variant="secondary" onClick={() => void copyPreparedWhatsApp()} disabled={!whatsAppShare}>
                <Copy size={16} />
                {t('board.workOrder.copyWhatsAppMessage')}
              </Button>
              <Button onClick={openPreparedWhatsApp} disabled={!whatsAppShare}>
                <MessageCircle size={16} />
                {t('board.workOrder.openWhatsApp')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
