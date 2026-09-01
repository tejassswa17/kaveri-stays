import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  BookmarkCheck,
  ArrowLeft,
  Calendar,
  CreditCard,
  Star,
  DoorOpen,
  UserCheck,
  UserX,
  XCircle,
  Plus,
  Building2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  getBooking,
  checkInBooking,
  checkOutBooking,
  cancelBooking,
  noShowBooking,
  getPayments,
  recordPayment,
  createReview,
  getProperties,
  getRooms,
  getAvailability,
  parseApiError,
} from '../../api';
import type {
  BookingOut,
  PaymentListResponse,
  PaymentResponse,
  BookingStatus,
} from '../../types';
import {
  PageHeader,
  Button,
  Badge,
  Modal,
  Input,
  Select,
  Table,
  LoadingSpinner,
  ErrorState,
} from '../../components/ui';
import type { Column } from '../../components/ui';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getTodayString, getFutureDateString } from '../../utils/dates';

interface RoomPropertyInfo {
  propertyName: string;
  propertyCity: string;
  roomNumber: string;
  roomType: string;
}

export const BookingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const bookingId = Number(id);

  const { isGuest, isStaff, isManager, isOwner } = useAuth();
  const { success, error: toastError } = useToast();

  const [booking, setBooking] = useState<BookingOut | null>(null);
  const [paymentsData, setPaymentsData] = useState<PaymentListResponse | null>(null);
  const [propertyInfo, setPropertyInfo] = useState<RoomPropertyInfo | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  const fetchBookingData = async () => {
    if (!bookingId || isNaN(bookingId)) {
      setError('Invalid booking ID');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [bRes, pRes] = await Promise.all([
        getBooking(bookingId),
        getPayments(bookingId).catch(() => null),
      ]);
      setBooking(bRes);
      setPaymentsData(pRes);

      // Resolve Property & Room Name in parallel without sequential waterfalls or 403s
      try {
        const propList = await getProperties(50, 0);
        const today = getTodayString();
        const future = getFutureDateString(3, today);

        let resolvedInfo: RoomPropertyInfo | null = null;

        if (!isGuest) {
          // Staff, Manager, Owner: fetch rooms in parallel
          const roomsResults = await Promise.all(
            propList.items.map((prop) =>
              getRooms(prop.property_id, 100, 0)
                .then((res) => ({ prop, rooms: res.items }))
                .catch(() => ({ prop, rooms: [] }))
            )
          );

          for (const { prop, rooms } of roomsResults) {
            const matched = rooms.find((r) => r.room_id === bRes.room_id);
            if (matched) {
              resolvedInfo = {
                propertyName: prop.name,
                propertyCity: prop.city,
                roomNumber: matched.room_number,
                roomType: matched.room_type,
              };
              break;
            }
          }
        } else {
          // Guest: fetch availability in parallel
          const availResults = await Promise.all(
            propList.items.map((prop) =>
              getAvailability(prop.property_id, today, future)
                .then((res) => ({ prop, rooms: res.items }))
                .catch(() => ({ prop, rooms: [] }))
            )
          );

          for (const { prop, rooms } of availResults) {
            const matched = rooms.find((r) => r.room_id === bRes.room_id);
            if (matched) {
              resolvedInfo = {
                propertyName: prop.name,
                propertyCity: prop.city,
                roomNumber: matched.room_number,
                roomType: matched.room_type,
              };
              break;
            }
          }
        }

        if (resolvedInfo) {
          setPropertyInfo(resolvedInfo);
        }
      } catch {
        // Handled
      }
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBookingData();
  }, [bookingId]);

  // State Machine Actions
  const handleCheckIn = async () => {
    setActionLoading(true);
    try {
      const updated = await checkInBooking(bookingId);
      setBooking((prev) => (prev ? { ...prev, status: updated.status as BookingStatus } : null));
      success('Checked In', `Booking #${bookingId} is now checked in.`);
    } catch (err) {
      toastError('Check-in failed', parseApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setActionLoading(true);
    try {
      const updated = await checkOutBooking(bookingId);
      setBooking((prev) => (prev ? { ...prev, status: updated.status as BookingStatus } : null));
      success('Checked Out', `Booking #${bookingId} has checked out.`);
    } catch (err) {
      toastError('Check-out failed', parseApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this reservation?')) return;
    setActionLoading(true);
    try {
      const updated = await cancelBooking(bookingId);
      setBooking((prev) => (prev ? { ...prev, status: updated.status as BookingStatus } : null));
      success('Booking Cancelled', `Reservation #${bookingId} has been cancelled.`);
    } catch (err) {
      toastError('Cancellation failed', parseApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleNoShow = async () => {
    if (!window.confirm('Mark this booking as No-Show?')) return;
    setActionLoading(true);
    try {
      const updated = await noShowBooking(bookingId);
      setBooking((prev) => (prev ? { ...prev, status: updated.status as BookingStatus } : null));
      success('Marked No-Show', `Booking #${bookingId} marked as no-show.`);
    } catch (err) {
      toastError('Action failed', parseApiError(err));
    } finally {
      setActionLoading(false);
    }
  };

  // Payment Submission
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toastError('Invalid Amount', 'Payment amount must be greater than zero.');
      return;
    }

    const currentBalance = paymentsData ? parseFloat(paymentsData.balance) : 0;
    if (parseFloat(paymentAmount) > currentBalance) {
      toastError(
        'Exceeds Balance',
        `Payment cannot exceed the remaining balance of ${formatCurrency(currentBalance)}.`
      );
      return;
    }

    setIsSubmittingPayment(true);
    try {
      await recordPayment(bookingId, {
        amount: paymentAmount,
        method: paymentMethod,
      });
      success('Payment Recorded', `Payment of ${formatCurrency(paymentAmount)} recorded.`);
      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      const pRes = await getPayments(bookingId);
      setPaymentsData(pRes);
    } catch (err) {
      toastError('Payment Failed', parseApiError(err));
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Review Submission
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingReview(true);
    try {
      await createReview(bookingId, {
        rating,
        comment: reviewComment || undefined,
      });
      success('Review Submitted', 'Thank you for your rating and feedback!');
      setIsReviewModalOpen(false);
      setReviewSubmitted(true);
    } catch (err) {
      toastError('Review Submission Failed', parseApiError(err));
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner size="lg" label="Loading reservation details..." className="py-20" />;
  }

  if (error || !booking) {
    return <ErrorState message={error || 'Booking not found'} onRetry={fetchBookingData} />;
  }

  const isStaffOrAbove = isStaff || isManager || isOwner;

  const paymentColumns: Column<PaymentResponse>[] = [
    {
      header: 'Payment ID',
      accessorKey: 'payment_id',
      cell: (p) => <span className="font-mono text-slate-300">#{p.payment_id}</span>,
    },
    {
      header: 'Method',
      accessorKey: 'method',
      cell: (p) => (
        <span className="capitalize px-2 py-0.5 text-xs font-semibold rounded bg-slate-800 text-slate-300 border border-slate-700">
          {p.method}
        </span>
      ),
    },
    {
      header: 'Date & Time',
      accessorKey: 'created_at',
      cell: (p) => (
        <span className="text-xs text-slate-400">
          {new Date(p.created_at).toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </span>
      ),
    },
    {
      header: 'Amount',
      accessorKey: 'amount',
      cell: (p) => (
        <span className="font-semibold text-emerald-400">{formatCurrency(p.amount)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Back Link */}
      <div className="flex items-center gap-3">
        <Link to="/bookings">
          <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Back to Bookings
          </Button>
        </Link>
      </div>

      {/* Page Header */}
      <PageHeader
        title={`Reservation #${booking.booking_id}`}
        subtitle={
          propertyInfo
            ? `${propertyInfo.propertyName} (${propertyInfo.propertyCity}) • Room ${propertyInfo.roomNumber} (${propertyInfo.roomType})`
            : `Room #${booking.room_id}`
        }
        badge={<Badge status={booking.status} size="md" />}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status-dependent Action Buttons */}
            {booking.status === 'confirmed' && (
              <>
                {isStaffOrAbove && (
                  <Button
                    variant="success"
                    size="sm"
                    onClick={handleCheckIn}
                    isLoading={actionLoading}
                    leftIcon={<UserCheck className="w-4 h-4" />}
                  >
                    Check In Guest
                  </Button>
                )}

                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleCancel}
                  isLoading={actionLoading}
                  leftIcon={<XCircle className="w-4 h-4" />}
                >
                  Cancel Booking
                </Button>

                {isStaffOrAbove && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNoShow}
                    isLoading={actionLoading}
                    leftIcon={<UserX className="w-4 h-4" />}
                    className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                  >
                    Mark No-Show
                  </Button>
                )}
              </>
            )}

            {booking.status === 'checked_in' && isStaffOrAbove && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleCheckOut}
                isLoading={actionLoading}
                leftIcon={<DoorOpen className="w-4 h-4" />}
              >
                Check Out Guest
              </Button>
            )}

            {booking.status === 'checked_out' && isGuest && !reviewSubmitted && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsReviewModalOpen(true)}
                leftIcon={<Star className="w-4 h-4" />}
              >
                Submit Review
              </Button>
            )}
          </div>
        }
      />

      {/* Booking Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Dates & Stay Info */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
            <Calendar className="w-4 h-4 text-brand-400" />
            <h3>Stay Details</h3>
          </div>

          <div className="space-y-3 text-sm">
            {propertyInfo && (
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Hotel Property:</span>
                <span className="font-semibold text-slate-100 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-brand-400" />
                  {propertyInfo.propertyName} ({propertyInfo.propertyCity})
                </span>
              </div>
            )}
            <div className="flex justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400">Check-In Date:</span>
              <span className="font-semibold text-slate-100">{formatDate(booking.check_in)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400">Check-Out Date:</span>
              <span className="font-semibold text-slate-100">{formatDate(booking.check_out)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400">Guests Count:</span>
              <span className="font-semibold text-slate-100">{booking.guests} Guests</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400">Assigned Room:</span>
              <span className="font-semibold text-brand-400">
                {propertyInfo
                  ? `Room ${propertyInfo.roomNumber} (${propertyInfo.roomType})`
                  : `Room #${booking.room_id}`}
              </span>
            </div>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
            <CreditCard className="w-4 h-4 text-emerald-400" />
            <h3>Payment Summary</h3>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400">Calculated Total:</span>
              <span className="font-bold text-slate-100">
                {formatCurrency(booking.total_amount)}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400">Total Paid:</span>
              <span className="font-bold text-emerald-400">
                {formatCurrency(paymentsData?.total_paid || '0.00')}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400">Remaining Balance:</span>
              <span className="font-extrabold text-brand-400 text-base">
                {formatCurrency(paymentsData?.balance || booking.total_amount)}
              </span>
            </div>
          </div>
        </div>

        {/* Status & ID Summary */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
            <BookmarkCheck className="w-4 h-4 text-indigo-400" />
            <h3>Status & Records</h3>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400">Booking Status:</span>
              <Badge status={booking.status} size="sm" />
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400">Guest ID:</span>
              <span className="font-mono text-slate-200">#{booking.guest_id}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400">Booking ID:</span>
              <span className="font-mono text-slate-200">#{booking.booking_id}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payments Section */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-400" />
              <span>Payment Installments</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Idempotent payment transactions recorded for this reservation
            </p>
          </div>

          {/* Record Payment button is restricted to staff/manager/owner collecting payments */}
          {isStaffOrAbove && paymentsData && parseFloat(paymentsData.balance) > 0 && booking.status !== 'cancelled' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setPaymentAmount(paymentsData.balance);
                setIsPaymentModalOpen(true);
              }}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Record Desk Payment
            </Button>
          )}
        </div>

        <Table
          columns={paymentColumns}
          data={paymentsData?.items || []}
          keyExtractor={(p) => p.payment_id}
          emptyMessage="No payments have been recorded for this booking yet."
        />
      </div>

      {/* Record Payment Modal (Staff/Manager/Owner only) */}
      {isStaffOrAbove && (
        <Modal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          title="Record Payment Installment"
          description={`Booking #${booking.booking_id} • Remaining Balance: ${formatCurrency(
            paymentsData?.balance
          )}`}
        >
          <form onSubmit={handleRecordPayment} className="space-y-4">
            <Input
              label="Payment Amount (₹)"
              type="number"
              step="0.01"
              min="0.01"
              max={paymentsData ? paymentsData.balance : undefined}
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              required
              autoFocus
            />

            <Select
              label="Payment Method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              options={[
                { value: 'cash', label: 'Cash at Desk' },
                { value: 'card', label: 'Credit / Debit Card' },
                { value: 'upi', label: 'UPI / NetBanking' },
                { value: 'bank_transfer', label: 'Bank Transfer' },
              ]}
            />

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs text-slate-400">
              A unique <code className="text-brand-300">Idempotency-Key</code> header will be
              automatically attached to prevent duplicate charges.
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsPaymentModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={isSubmittingPayment}>
                Confirm Payment
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Review Modal */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        title="Submit Guest Stay Review"
        description="Share your stay experience and rating (1-5 stars)"
      >
        <form onSubmit={handleReviewSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 block mb-2">
              Star Rating (1 to 5)
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRating(star)}
                  className={`p-2 rounded-xl transition ${
                    rating >= star
                      ? 'text-amber-400 bg-amber-500/10'
                      : 'text-slate-600 hover:text-slate-400'
                  }`}
                >
                  <Star className="w-6 h-6 fill-current" />
                </button>
              ))}
              <span className="text-sm font-bold text-slate-200 ml-2">{rating} / 5</span>
            </div>
          </div>

          <div className="w-full flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Optional Comments / Feedback
            </label>
            <textarea
              className="w-full rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-sm p-3 outline-none focus:ring-2 focus:ring-brand-500 min-h-[100px]"
              placeholder="Tell us about your room, service, and stay..."
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsReviewModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmittingReview}>
              Submit Review
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
