import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  CalendarDays,
  Building2,
  BookmarkCheck,
  Plus,
  ArrowRight,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getBookings,
  getProperties,
  getRooms,
  getOccupancyReport,
  parseApiError,
} from '../../api';
import type { BookingOut, PropertyOut, RoomOut, ReportRow } from '../../types';
import {
  Button,
  StatCard,
  Badge,
  Table,
  PageHeader,
  LoadingSpinner,
  ErrorState,
} from '../../components/ui';
import type { Column } from '../../components/ui';
import { formatCurrency, formatDate, formatPercent } from '../../utils/formatters';
import { getFirstDayOfYear, getLastDayOfYear } from '../../utils/dates';

export const DashboardPage: React.FC = () => {
  const { user, isGuest, isStaff, isManager, isOwner } = useAuth();

  // Defense in depth: Guest must never access or render operational dashboard
  if (isGuest) {
    return <Navigate to="/properties" replace />;
  }

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [bookings, setBookings] = useState<BookingOut[]>([]);
  const [totalBookings, setTotalBookings] = useState(0);
  const [properties, setProperties] = useState<PropertyOut[]>([]);
  const [rooms, setRooms] = useState<RoomOut[]>([]);
  const [occupancyData, setOccupancyData] = useState<ReportRow[]>([]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch recent bookings (authorized for staff/manager/owner)
      const bookingsRes = await getBookings({ limit: 5, sort: '-created_at' });
      setBookings(bookingsRes.items);
      setTotalBookings(bookingsRes.meta.total);

      // 2. Fetch properties list
      const propRes = await getProperties(10, 0);
      setProperties(propRes.items);

      // 3. For Staff & Manager: fetch rooms of assigned property
      if ((isStaff || isManager) && user?.property_id) {
        try {
          const roomRes = await getRooms(user.property_id, 100, 0);
          setRooms(roomRes.items);
        } catch {
          // Handled gracefully
        }
      }

      // 4. For Manager & Owner: fetch occupancy report
      if (isManager || isOwner) {
        try {
          const fromDate = getFirstDayOfYear();
          const toDate = getLastDayOfYear();
          const occRes = await getOccupancyReport(
            fromDate,
            toDate,
            isManager && user?.property_id ? user.property_id : undefined
          );
          setOccupancyData(occRes.items);
        } catch {
          // Handled gracefully
        }
      }
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isGuest && user) {
      loadDashboardData();
    }
  }, [user, isGuest]);

  if (isLoading) {
    return <LoadingSpinner size="lg" label="Loading dashboard metrics..." className="py-20" />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadDashboardData} className="my-10" />;
  }

  // Compute summary stats
  const activeBookings = bookings.filter(
    (b) => b.status === 'confirmed' || b.status === 'checked_in'
  );
  const latestOccupancy =
    occupancyData.length > 0
      ? occupancyData[occupancyData.length - 1].value
      : null;

  const bookingColumns: Column<BookingOut>[] = [
    {
      header: 'ID',
      accessorKey: 'booking_id',
      cell: (b) => <span className="font-mono font-semibold text-slate-200">#{b.booking_id}</span>,
    },
    {
      header: 'Room',
      accessorKey: 'room_id',
      cell: (b) => <span className="font-medium text-slate-300">Room #{b.room_id}</span>,
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
      header: 'Amount',
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
    <div className="space-y-8">
      {/* Welcome Header */}
      <PageHeader
        title={`Welcome back, ${user?.full_name || 'Staff'}`}
        subtitle={`Role: ${user?.role ? user.role.toUpperCase() : ''}${
          user?.property_id ? ` • Property Scope: #${user.property_id}` : ''
        }`}
        actions={
          <div className="flex items-center gap-3">
            <Link to="/availability">
              <Button variant="secondary" leftIcon={<CalendarDays className="w-4 h-4" />}>
                Check Availability
              </Button>
            </Link>
            <Link to="/bookings/new">
              <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
                New Booking
              </Button>
            </Link>
          </div>
        }
      />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          title="Total Bookings"
          value={totalBookings}
          subtitle="All recorded reservations"
          icon={<BookmarkCheck className="w-5 h-5" />}
          accentColor="brand"
        />

        <StatCard
          title="Active Stays"
          value={activeBookings.length}
          subtitle="Confirmed / Checked In"
          icon={<Clock className="w-5 h-5" />}
          accentColor="indigo"
        />

        {(isStaff || isManager) && (
          <StatCard
            title="Assigned Rooms"
            value={rooms.length > 0 ? rooms.length : '—'}
            subtitle={`Property #${user?.property_id || 'N/A'}`}
            icon={<Building2 className="w-5 h-5" />}
            accentColor="emerald"
          />
        )}

        {(isManager || isOwner) && (
          <StatCard
            title="Latest Occupancy"
            value={latestOccupancy ? formatPercent(latestOccupancy) : '—'}
            subtitle="Monthly Occupancy Rate"
            icon={<TrendingUp className="w-5 h-5" />}
            accentColor="amber"
          />
        )}

        {isOwner && (
          <StatCard
            title="Properties"
            value={properties.length}
            subtitle="Operational hotels"
            icon={<Building2 className="w-5 h-5" />}
            accentColor="purple"
          />
        )}
      </div>

      {/* Recent Activity & Properties Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bookings Table (2 cols on large) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <BookmarkCheck className="w-5 h-5 text-brand-400" />
              <span>Recent Bookings</span>
            </h2>
            <Link to="/bookings" className="text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <Table
            columns={bookingColumns}
            data={bookings}
            keyExtractor={(b) => b.booking_id}
            emptyMessage="No recent bookings found."
          />
        </div>

        {/* Properties Quick Cards */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-400" />
              <span>Properties</span>
            </h2>
            <Link to="/properties" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1">
              Explore <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {properties.slice(0, 3).map((prop) => (
              <Link
                key={prop.property_id}
                to={`/properties/${prop.property_id}`}
                className="block p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition hover:bg-slate-900 group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-200 group-hover:text-brand-400 transition">
                      {prop.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">{prop.city}</p>
                  </div>
                  <Badge variant="warning" size="sm">
                    ★ {prop.star_rating} Stars
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
