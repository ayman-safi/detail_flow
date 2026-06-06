'use client';

import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import toast from 'react-hot-toast';
import api, { getApiErrorMessage } from '@/lib/api';
import { useBoardStore } from '@/store/boardStore';
import type { ServiceType, VehicleType, WorkOrderCard } from '@/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/i18n/I18nProvider';
import { getVehicleTypeKey, vehicleTypes } from '@/i18n/domain';

type WalkInForm = {
  customerName: string;
  customerPhone: string;
  vehiclePlate: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  vehicleType: VehicleType;
  serviceTypeId: string;
  notes: string;
};

const initialWalkInForm: WalkInForm = {
  customerName: '',
  customerPhone: '',
  vehiclePlate: '',
  vehicleMake: '',
  vehicleModel: '',
  vehicleColor: '',
  vehicleType: 'Sedan',
  serviceTypeId: '',
  notes: '',
};

const requiredFields = ['customerName', 'customerPhone', 'vehiclePlate', 'vehicleMake', 'vehicleModel', 'vehicleColor', 'serviceTypeId'] as const;

export function AddWalkInModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addCard = useBoardStore((state) => state.addCard);
  const { data: services = [] } = useQuery<ServiceType[]>({ queryKey: ['services'], queryFn: () => api.get<ServiceType[]>('/services').then((response) => response.data) });
  const [form, setForm] = useState<WalkInForm>(initialWalkInForm);
  const [submitted, setSubmitted] = useState(false);
  const { isRtl, t } = useI18n();
  const formId = useId();

  const setField = <K extends keyof WalkInForm>(key: K, value: WalkInForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const hasMissingFields = requiredFields.some((key) => !String(form[key]).trim());
  const selectClassName = `h-10 w-full min-w-0 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-muted)] aria-[invalid=true]:border-[var(--color-destructive)] ${isRtl ? 'text-right' : 'text-left'}`;

  const submit = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setSubmitted(true);
    try {
      if (hasMissingFields) {
        toast.error(t('board.toasts.walkInError'));
        return;
      }

      const { data } = await api.post<WorkOrderCard>('/work-orders', form);
      addCard(data);
      toast.success(t('board.toasts.walkInAdded'));
      setForm(initialWalkInForm);
      setSubmitted(false);
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('board.toasts.walkInError')));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('board.walkIn.title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {submitted && hasMissingFields && <p role="alert" className="text-sm text-[var(--color-destructive)]">{t('board.toasts.walkInError')}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`${formId}-phone`}>{t('common.labels.phone')}</Label>
              <Input id={`${formId}-phone`} autoComplete="tel" aria-invalid={submitted && !form.customerPhone.trim()} value={form.customerPhone} onChange={(event) => setField('customerPhone', event.target.value)} />
            </div>
            <div>
              <Label htmlFor={`${formId}-name`}>{t('common.labels.name')}</Label>
              <Input id={`${formId}-name`} autoComplete="name" aria-invalid={submitted && !form.customerName.trim()} value={form.customerName} onChange={(event) => setField('customerName', event.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor={`${formId}-service`}>{t('common.labels.service')}</Label>
              <select id={`${formId}-service`} className={selectClassName} aria-invalid={submitted && !form.serviceTypeId.trim()} value={form.serviceTypeId} onChange={(event) => setField('serviceTypeId', event.target.value)}>
                <option value="">{t('board.walkIn.servicePlaceholder')}</option>
                {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor={`${formId}-plate`}>{t('common.labels.plate')}</Label>
              <Input id={`${formId}-plate`} autoCapitalize="characters" aria-invalid={submitted && !form.vehiclePlate.trim()} value={form.vehiclePlate} onChange={(event) => setField('vehiclePlate', event.target.value.toUpperCase())} />
            </div>
            <div>
              <Label htmlFor={`${formId}-color`}>{t('common.labels.color')}</Label>
              <Input id={`${formId}-color`} aria-invalid={submitted && !form.vehicleColor.trim()} value={form.vehicleColor} onChange={(event) => setField('vehicleColor', event.target.value)} />
            </div>
            <div>
              <Label htmlFor={`${formId}-make`}>{t('common.labels.make')}</Label>
              <Input id={`${formId}-make`} aria-invalid={submitted && !form.vehicleMake.trim()} value={form.vehicleMake} onChange={(event) => setField('vehicleMake', event.target.value)} />
            </div>
            <div>
              <Label htmlFor={`${formId}-model`}>{t('common.labels.model')}</Label>
              <Input id={`${formId}-model`} aria-invalid={submitted && !form.vehicleModel.trim()} value={form.vehicleModel} onChange={(event) => setField('vehicleModel', event.target.value)} />
            </div>
            <div>
              <Label htmlFor={`${formId}-type`}>{t('common.labels.type')}</Label>
              <select id={`${formId}-type`} className={selectClassName} value={form.vehicleType} onChange={(event) => setField('vehicleType', event.target.value as VehicleType)}>
                {vehicleTypes.map((value) => <option key={value} value={value}>{t(getVehicleTypeKey(value))}</option>)}
              </select>
            </div>
          </div>
          <Button className="w-full" type="submit">{t('board.walkIn.submit')}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
