'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminHeader } from '@/components/layout/AdminHeader';

type LedgerEntryView = {
  id: string;
  type: string;
  saleId: string | null;
  reference: string;
  amount: number;
  balance: number;
  note: string | null;
  createdAt: string;
  sale?: {
    total: number;
    amountReceived: number;
  };
};

type CustomerLedgerViewProps = {
  customer: {
    id: string;
    name: string;
    phone: string;
    balance: number;
  };
  entries: LedgerEntryView[];
  allowManualPayment?: boolean;
};

const formatCurrency = (value: number) =>
  `Rs. ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const classifyEntry = (entry: LedgerEntryView) => {
  if (entry.type === 'PAYMENT') return 'CREDIT';
  if (entry.type === 'OPENING_BALANCE') return entry.balance < 0 ? 'CREDIT' : 'DEBIT';
  return 'DEBIT';
};

export default function CustomerLedgerView({ customer, entries, allowManualPayment = true }: CustomerLedgerViewProps) {
  const router = useRouter();
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const totals = useMemo(() => {
    let totalBills = 0;
    let totalCashReceived = 0;

    for (const entry of entries) {
      if (entry.sale) {
        totalBills += entry.sale.total;
        totalCashReceived += entry.sale.amountReceived;
      } else if (entry.type === 'PAYMENT') {
        totalCashReceived += entry.amount;
      }
    }

    return { totalBills, totalCashReceived };
  }, [entries]);

  const handleManualPayment = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const amount = Number(paymentAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setSubmitError('Enter a valid amount greater than zero.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/customers/${customer.id}/ledger-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, note: paymentNote }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to save payment');

      setPaymentAmount('');
      setPaymentNote('');
      setIsPaymentOpen(false);
      router.refresh();
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to save payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <AdminHeader title="Customer Ledger" />

      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between rounded-xl border bg-white p-4 shadow-sm">
          <div>
            <p className="text-lg font-semibold tracking-tight">{customer.name}</p>
            <p className="text-sm text-slate-500">{customer.phone}</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center print:hidden">
            {allowManualPayment && (
              <button
                onClick={() => setIsPaymentOpen(true)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Add Manual Payment
              </button>
            )}
            <button
              onClick={() => window.print()}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Print Ledger
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Bills Amount</p>
            <p className="mt-2 text-2xl font-bold text-rose-600">{formatCurrency(totals.totalBills)}</p>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Cash Received</p>
            <p className="mt-2 text-2xl font-bold text-emerald-600">{formatCurrency(totals.totalCashReceived)}</p>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {customer.balance >= 0 ? 'Net Receivable' : 'Customer\'s Advance'}
            </p>
            {customer.balance >= 0 ? (
              <p className="mt-2 text-xl font-bold text-rose-600">{formatCurrency(customer.balance)}</p>
            ) : (
              <p className="mt-2 text-xl font-bold text-emerald-600">
                {formatCurrency(Math.abs(customer.balance))}
              </p>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="border-b px-4 sm:px-6 py-4">
            <h2 className="text-base font-semibold tracking-tight text-slate-900">Customer Ledger Statement</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-3">Date & Time</th>
                  <th className="px-6 py-3">Total Bill</th>
                  <th className="px-6 py-3">Cash Received</th>
                  <th className="px-6 py-3">Balance Added</th>
                  <th className="px-6 py-3 text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((entry) => {
                  const isDue = entry.balance >= 0;
                  const isBalanceAddedDue = true; // Simplified for clarity

                  let totalBill = '-';
                  let cashReceived = '-';
                  let balanceAdded = 0;

                  if (entry.sale) {
                    totalBill = formatCurrency(entry.sale.total);
                    cashReceived = formatCurrency(entry.sale.amountReceived);
                    balanceAdded = entry.sale.total - entry.sale.amountReceived;
                  } else if (entry.type === 'PAYMENT') {
                    cashReceived = formatCurrency(entry.amount);
                    balanceAdded = -entry.amount;
                  }

                  const balanceAddedClass = balanceAdded > 0 ? 'text-rose-600' : 'text-emerald-600';
                  
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/80">
                      <td className="whitespace-nowrap px-6 py-4 text-slate-700">
                        {new Date(entry.createdAt).toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 font-medium text-slate-900">
                        {totalBill}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-slate-600">
                        {cashReceived}
                      </td>
                      <td className={`whitespace-nowrap px-6 py-4 font-semibold ${balanceAddedClass}`}>
                        {typeof balanceAdded === 'number' ? formatCurrency(balanceAdded) : '-'}
                      </td>
                      <td
                        className={`whitespace-nowrap px-6 py-4 text-right font-bold ${
                          isDue ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {isDue ? `Due: ${formatCurrency(entry.balance)}` : `Advance: ${formatCurrency(Math.abs(entry.balance))}`}
                      </td>
                    </tr>
                  );
                })}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">
                      No ledger entries found for this customer.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {allowManualPayment && isPaymentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Record Manual Payment</h3>
            <p className="mt-1 text-sm text-slate-500">Use this for cash received without creating a new sale.</p>

            <form onSubmit={handleManualPayment} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-0 focus:border-emerald-500"
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Note (optional)</label>
                <textarea
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="h-20 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-0 focus:border-emerald-500"
                  placeholder="Payment note..."
                />
              </div>
              {submitError && <p className="text-sm font-medium text-rose-600">{submitError}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!isSubmitting) setIsPaymentOpen(false);
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Saving...' : 'Save Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
