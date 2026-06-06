'use client';

import { useEffect, useId, useState } from 'react';
import api from '@/lib/api';
import type { Customer } from '@/types';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/utils';

export function CustomerSearchInput({
  onSelect,
  value,
  onChange,
  inputProps,
}: {
  onSelect: (customer: Pick<Customer, 'id' | 'fullName' | 'phone'>) => void;
  value?: string;
  onChange?: (value: string) => void;
  inputProps?: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onSelect' | 'role'>;
}) {
  const [term, setTerm] = useState(value ?? '');
  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = useId();
  const { isRtl, t } = useI18n();
  const { className, onKeyDown, ...restInputProps } = inputProps ?? {};

  useEffect(() => setTerm(value ?? ''), [value]);

  useEffect(() => {
    setActiveIndex(items.length > 0 ? 0 : -1);
  }, [items]);

  useEffect(() => {
    if (term.length < 2) {
      setItems([]);
      setOpen(false);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      setOpen(true);
      try {
        const { data } = await api.get('/customers', { params: { search: term, limit: 10 } });
        setItems(data.items ?? data);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [term]);

  const selectCustomer = (customer: Customer) => {
    onSelect(customer);
    setItems([]);
    setTerm(customer.phone);
    setOpen(false);
    setActiveIndex(-1);
  };

  const activeOptionId = open && activeIndex >= 0 && items[activeIndex] ? `${listId}-${items[activeIndex].id}` : undefined;

  return (
    <div className="relative">
      <Input
        {...restInputProps}
        className={className}
        value={term}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-activedescendant={activeOptionId}
        aria-expanded={open}
        onFocus={() => setOpen(term.length >= 2)}
        onBlur={() => window.setTimeout(() => {
          setOpen(false);
          setActiveIndex(-1);
        }, 120)}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;

          if (event.key === 'Escape') {
            setOpen(false);
            setActiveIndex(-1);
            return;
          }

          if (!open || loading || items.length === 0) return;

          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((index) => (index + 1) % items.length);
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((index) => (index <= 0 ? items.length - 1 : index - 1));
          }

          if (event.key === 'Enter' && activeIndex >= 0) {
            event.preventDefault();
            selectCustomer(items[activeIndex]);
          }
        }}
        onChange={(event) => {
          setTerm(event.target.value);
          onChange?.(event.target.value);
          setOpen(event.target.value.length >= 2);
        }}
      />
      {loading && <span aria-live="polite" className={`absolute top-2.5 text-xs text-[var(--color-text-muted)] ${isRtl ? 'left-3' : 'right-3'}`}>...</span>}
      {open && term.length >= 2 && (
        <div id={listId} role="listbox" className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl">
          {loading ? (
            <div className="p-3 text-sm text-[var(--color-text-muted)]">{t('common.states.loading')}</div>
          ) : items.length === 0 ? (
            <div className="p-3 text-sm text-[var(--color-text-muted)]">{t('bookings.customerSearchEmpty')}</div>
          ) : (
            items.map((customer, index) => (
              <button
                key={customer.id}
                id={`${listId}-${customer.id}`}
                type="button"
                role="option"
                aria-selected={activeIndex === index}
                className={cn(
                  'flex w-full items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-[var(--color-surface-hover)]',
                  activeIndex === index && 'bg-[var(--color-surface-hover)]',
                  isRtl ? 'text-right' : 'text-left',
                )}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectCustomer(customer)}
              >
                <span className="min-w-0">
                  {customer.fullName}
                  <span className="block text-xs text-[var(--color-text-muted)]">{customer.phone}</span>
                </span>
                <span className="rounded-full bg-[var(--color-primary-muted)] px-2 py-0.5 text-xs text-[var(--color-primary)]">{customer.totalVisits}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
