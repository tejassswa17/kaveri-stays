import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Mail, ArrowLeft, Plus, BookmarkCheck } from 'lucide-react';
import { getGuest, getBookings, parseApiError } from '../../api';
import type { GuestOut, BookingOut } from '../../types';
import {
  PageHeader,
  Button,
  Table,
  Badge,
  LoadingSpinner,
  ErrorState,
} from '../../components/ui';
import type { Column } from '../../components/ui';
import { formatCurrency, formatDate } from '../../utils/formatters';

export const GuestDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const guestId = Number(id);

  const [guest, setGuest] = useState<GuestOut | null>(null);
  const [bookings, setBookings] = useState<BookingOut[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGuestData = async () => {
    if (!guestId || isNaN(guestId)) {
      setError('Invalid guest ID');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [gRes, bRes] = await Promise.all([
        getGuest(guestId),
        getBookings({ guest_id: guestId, limit: 50 }),
      ]);
      setGuest(gRes);
      setBookings(bRes.items);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGuestData();
  }, [guestId]);

  if (isLoading) {
    return <LoadingSpinner size="lg" label="Loading guest profile..." className="py-20" />;
  }

  if (error || !guest) {
    return <ErrorState message={error || 'Guest not found'} onRetry={fetchGuestData} />;
  }

  const bookingColumns: Column<BookingOut>[] = [
    {
      header: 'Booking #',
      accessorKey: 'booking_id',
      cell: (b) => <span className="font-mono font-bold text-slate-100">#{b.booking_id}</span>,
    },
    {
      header: 'Room',
      accessorKey: 'room_id',
      cell: (b) => <span className="text-slate-300">Room #{b.room_id}</span>,
    },
    {
      header: 'Check-In',
      accessorKey: 'check_in',
      cell: (b) => formatDate(b.check_in),
    },
    {
      header: 'Check-Out',
      accessorKey: 'check_out',
      cell: (b) => formatDate(b.check_out),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (b) => <Badge status={b.status} size="sm" />,
    },
    {
      header: 'Total Amount',
      accessorKey: 'total_amount',
      cell: (b) => (
        <span className="font-semibold text-slate-100">{formatCurrency(b.total_amount)}</span>
      ),
    },
    {
      header: 'Action',
      cell: (b) => (
        <Link to={`/bookings/${b.booking_id}`}>
          <Button variant="outline" size="sm">
            View
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Link to="/guests">
          <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Back to Guest Directory
          </Button>
        </Link>
      </div>

      <PageHeader
        title={guest.full_name}
        subtitle={`Registered Guest ID #${guest.guest_id}`}
        actions={
          <Link to={`/bookings/new?guest_id=${guest.guest_id}`}>
            <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
              Create Booking for Guest
            </Button>
          </Link>
        }
      />

      {/* Guest Profile Card */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 shadow-xl">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 pb-2 border-b border-slate-800">
          Profile Details
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
          <div>
            <span className="text-xs text-slate-400 block mb-1">Full Name</span>
            <span className="font-bold text-slate-100 text-base">{guest.full_name}</span>
          </div>

          <div>
            <span className="text-xs text-slate-400 block mb-1">Email Address</span>
            <span className="font-mono text-slate-200 flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-brand-400" />
              <span>{guest.email}</span>
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-400 block mb-1">Total Bookings</span>
            <span className="font-bold text-brand-400 text-base">{bookings.length} Stays</span>
          </div>
        </div>
      </div>

      {/* Reservation History */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <BookmarkCheck className="w-5 h-5 text-indigo-400" />
          <span>Stay & Reservation History</span>
        </h3>

        <Table
          columns={bookingColumns}
          data={bookings}
          keyExtractor={(b) => b.booking_id}
          emptyMessage="No reservations recorded for this guest."
        />
      </div>
    </div>
  );
};
