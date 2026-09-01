import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Building2 } from 'lucide-react';
import { getBookings, getProperties, getRooms, getAvailability, parseApiError } from '../../api';
import type { BookingOut, BookingStatus, PropertyOut } from '../../types';
import { useAuth } from '../../context/AuthContext';
import {
  PageHeader,
  Button,
  Select,
  Input,
  Table,
  Badge,
  ErrorState,
} from '../../components/ui';
import type { Column } from '../../components/ui';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getTodayString, getFutureDateString } from '../../utils/dates';

interface RoomMeta {
  roomId: number;
  roomNumber: string;
  roomType: string;
  propertyId: number;
  propertyName: string;
  propertyCity: string;
}

export const BookingsPage: React.FC = () => {
  const { isOwner } = useAuth();

  const [bookings, setBookings] = useState<BookingOut[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const [properties, setProperties] = useState<PropertyOut[]>([]);
  const [roomMap, setRoomMap] = useState<Record<number, RoomMeta>>({});

  // Filter States
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('-check_in');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load properties and room metadata for Property display
  useEffect(() => {
    const loadPropertiesAndRooms = async () => {
      try {
        const propRes = await getProperties(50, 0);
        setProperties(propRes.items);

        const newMap: Record<number, RoomMeta> = {};
        const today = getTodayString();
        const future = getFutureDateString(3, today);

        await Promise.all(
          propRes.items.map(async (prop) => {
            try {
              // Try staff getRooms first
              const roomsRes = await getRooms(prop.property_id, 100, 0);
              roomsRes.items.forEach((r) => {
                newMap[r.room_id] = {
                  roomId: r.room_id,
                  roomNumber: r.room_number,
                  roomType: r.room_type,
                  propertyId: prop.property_id,
                  propertyName: prop.name,
                  propertyCity: prop.city,
                };
              });
            } catch {
              // Fallback for guests via public availability endpoint
              try {
                const availRes = await getAvailability(prop.property_id, today, future);
                availRes.items.forEach((r) => {
                  newMap[r.room_id] = {
                    roomId: r.room_id,
                    roomNumber: r.room_number,
                    roomType: r.room_type,
                    propertyId: prop.property_id,
                    propertyName: prop.name,
                    propertyCity: prop.city,
                  };
                });
              } catch {
                // Ignore fallback error
              }
            }
          })
        );
        setRoomMap(newMap);
      } catch {
        // Handled gracefully
      }
    };

    loadPropertiesAndRooms();
  }, []);

  const fetchBookings = async (off: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const params: any = {
        limit,
        offset: off,
        sort: sortBy,
        ...(selectedStatus ? { status: selectedStatus as BookingStatus } : {}),
        ...(selectedPropertyId ? { property_id: Number(selectedPropertyId) } : {}),
        ...(fromDate ? { from: fromDate } : {}),
        ...(toDate ? { to: toDate } : {}),
      };

      const res = await getBookings(params);
      setBookings(res.items);
      setTotal(res.meta.total);
      setOffset(off);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings(0);
  }, [selectedStatus, selectedPropertyId, fromDate, toDate, sortBy]);

  const columns: Column<BookingOut>[] = [
    {
      header: 'Booking #',
      accessorKey: 'booking_id',
      cell: (b) => (
        <span className="font-mono font-bold text-slate-100">
          #{b.booking_id}
        </span>
      ),
    },
    {
      header: 'Property',
      cell: (b) => {
        const meta = roomMap[b.room_id];
        return (
          <div className="flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-brand-400 shrink-0" />
            <span className="font-semibold text-slate-200">
              {meta ? `${meta.propertyName} (${meta.propertyCity})` : 'Kaveri Stays'}
            </span>
          </div>
        );
      },
    },
    {
      header: 'Room',
      accessorKey: 'room_id',
      cell: (b) => {
        const meta = roomMap[b.room_id];
        return (
          <span className="font-medium text-slate-300">
            {meta ? `Room ${meta.roomNumber} (${meta.roomType})` : `Room #${b.room_id}`}
          </span>
        );
      },
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
      header: 'Guests',
      accessorKey: 'guests',
      cell: (b) => <span className="text-slate-300">{b.guests}</span>,
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
        <span className="font-semibold text-slate-100">
          {formatCurrency(b.total_amount)}
        </span>
      ),
    },
    {
      header: 'Actions',
      cell: (b) => (
        <Link to={`/bookings/${b.booking_id}`}>
          <Button variant="outline" size="sm">
            View Details
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservations Directory"
        subtitle="Manage hotel bookings, statuses, transitions, and payments"
        actions={
          <Link to="/bookings/new">
            <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
              Create Reservation
            </Button>
          </Link>
        }
      />

      {/* Filter Bar */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Select
            label="Status Filter"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'confirmed', label: 'Confirmed' },
              { value: 'checked_in', label: 'Checked In' },
              { value: 'checked_out', label: 'Checked Out' },
              { value: 'cancelled', label: 'Cancelled' },
              { value: 'no_show', label: 'No Show' },
            ]}
          />

          {isOwner && (
            <Select
              label="Property"
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              options={[
                { value: '', label: 'All Properties' },
                ...properties.map((p) => ({
                  value: p.property_id,
                  label: p.name,
                })),
              ]}
            />
          )}

          <Input
            label="Stay From"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />

          <Input
            label="Stay To"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />

          <Select
            label="Sort By"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            options={[
              { value: '-check_in', label: 'Check-In (Newest)' },
              { value: 'check_in', label: 'Check-In (Oldest)' },
              { value: '-created_at', label: 'Booking ID (Desc)' },
              { value: 'created_at', label: 'Booking ID (Asc)' },
              { value: '-total_amount', label: 'Total Amount (High to Low)' },
              { value: 'total_amount', label: 'Total Amount (Low to High)' },
            ]}
          />
        </div>
      </div>

      {/* Content */}
      {error ? (
        <ErrorState message={error} onRetry={() => fetchBookings(offset)} />
      ) : (
        <Table
          columns={columns}
          data={bookings}
          keyExtractor={(b) => b.booking_id}
          total={total}
          limit={limit}
          offset={offset}
          onPageChange={(newOffset) => fetchBookings(newOffset)}
          isLoading={isLoading}
          emptyMessage="No reservations match the selected filter criteria."
        />
      )}
    </div>
  );
};
