import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CalendarDays, Building2, User, ArrowLeft, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  getProperties,
  getAvailability,
  getGuests,
  createBooking,
  parseApiError,
} from '../../api';
import type { PropertyOut, AvailabilityRoom, GuestOut } from '../../types';
import {
  PageHeader,
  Button,
  Input,
  Select,
  LoadingSpinner,
} from '../../components/ui';
import { formatCurrency } from '../../utils/formatters';
import {
  getTodayString,
  getTomorrowString,
  getFutureDateString,
  calculateNights,
} from '../../utils/dates';

export const NewBookingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();
  const { success, error: toastError } = useToast();

  const todayStr = getTodayString();
  const initialPropertyId = searchParams.get('property_id') || '';
  const initialRoomId = searchParams.get('room_id') || '';
  const initialCheckIn = searchParams.get('check_in') || todayStr;
  const initialCheckOut = searchParams.get('check_out') || getFutureDateString(3, todayStr);

  // Form State
  const [properties, setProperties] = useState<PropertyOut[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState(initialPropertyId);
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [guestsCount, setGuestsCount] = useState<number>(1);
  const [selectedRoomId, setSelectedRoomId] = useState<string>(initialRoomId);
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [selectedGuestId, setSelectedGuestId] = useState<string>('');

  // Guests List for Staff/Manager/Owner
  const [guests, setGuests] = useState<GuestOut[]>([]);

  // Available Rooms for the selected dates
  const [availableRooms, setAvailableRooms] = useState<AvailabilityRoom[]>([]);
  const [isLoadingAvail, setIsLoadingAvail] = useState(false);

  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInitialLoaded, setIsInitialLoaded] = useState(false);

  // Load properties and guests
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const propRes = await getProperties(50, 0);
        setProperties(propRes.items);
        if (!selectedPropertyId && propRes.items.length > 0) {
          setSelectedPropertyId(String(propRes.items[0].property_id));
        }

        // If not a guest, fetch guests list for the dropdown
        if (!isGuest) {
          const guestRes = await getGuests(undefined, 100, 0);
          setGuests(guestRes.items);
          if (guestRes.items.length > 0) {
            setSelectedGuestId(String(guestRes.items[0].guest_id));
          }
        }
      } catch (err) {
        setErrorMessage(parseApiError(err));
      } finally {
        setIsInitialLoaded(true);
        setIsLoadingInitial(false);
      }
    };
    fetchInitialData();
  }, [isGuest]);

  const handleCheckInChange = (newCheckIn: string) => {
    setCheckIn(newCheckIn);
    if (checkOut <= newCheckIn) {
      setCheckOut(getFutureDateString(3, newCheckIn));
    }
  };

  // Fetch available rooms whenever property or dates change
  useEffect(() => {
    if (!isInitialLoaded || !selectedPropertyId || !checkIn || !checkOut) return;
    if (checkIn < todayStr || checkOut <= checkIn) return;

    const fetchRooms = async () => {
      setIsLoadingAvail(true);
      try {
        const res = await getAvailability(Number(selectedPropertyId), checkIn, checkOut);
        setAvailableRooms(res.items);
      } catch {
        // Handled silently
      } finally {
        setIsLoadingAvail(false);
      }
    };
    fetchRooms();
  }, [isInitialLoaded, selectedPropertyId, checkIn, checkOut, todayStr]);

  const selectedRoom = availableRooms.find((r) => String(r.room_id) === selectedRoomId);
  const nights = calculateNights(checkIn, checkOut);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checkIn < todayStr) {
      setErrorMessage('Check-in date cannot be in the past.');
      return;
    }

    if (checkOut <= checkIn) {
      setErrorMessage('Check-out date must be strictly after check-in date.');
      return;
    }

    if (!selectedRoomId) {
      setErrorMessage('Please select an available room.');
      return;
    }

    if (!isGuest && !selectedGuestId) {
      setErrorMessage('Staff/Manager bookings require selecting a guest.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload: any = {
        room_id: Number(selectedRoomId),
        check_in: checkIn,
        check_out: checkOut,
        guests: Number(guestsCount),
        ...(!isGuest && selectedGuestId ? { guest_id: Number(selectedGuestId) } : {}),
      };

      // Only staff/manager/owner can record desk deposits at booking creation
      if (!isGuest && depositAmount && parseFloat(depositAmount) > 0) {
        payload.deposit = depositAmount;
      }

      const res = await createBooking(payload);
      success('Booking Created!', `Reservation #${res.booking_id} confirmed.`);
      navigate(`/bookings/${res.booking_id}`);
    } catch (err: any) {
      const msg = parseApiError(err);
      setErrorMessage(msg);
      toastError('Booking Failed', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingInitial) {
    return <LoadingSpinner size="lg" label="Initializing booking wizard..." className="py-20" />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Link to="/bookings">
          <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Back to Bookings
          </Button>
        </Link>
      </div>

      <PageHeader
        title="Create New Reservation"
        subtitle="Book a room with real-time rate plan calculation and constraint verification"
      />

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Property & Dates */}
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex items-center gap-2 text-base font-bold text-slate-100 pb-3 border-b border-slate-800">
            <CalendarDays className="w-5 h-5 text-brand-400" />
            <h2>1. Select Property & Stay Dates</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Hotel Property"
              value={selectedPropertyId}
              onChange={(e) => {
                setSelectedPropertyId(e.target.value);
                setSelectedRoomId('');
              }}
              options={properties.map((p) => ({
                value: p.property_id,
                label: `${p.name} (${p.city})`,
              }))}
              required
            />

            <Input
              label="Check-In Date"
              type="date"
              min={todayStr}
              value={checkIn}
              onChange={(e) => handleCheckInChange(e.target.value)}
              required
            />

            <Input
              label="Check-Out Date"
              type="date"
              min={getTomorrowString(checkIn)}
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Step 2: Room Selection */}
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-base font-bold text-slate-100">
              <Building2 className="w-5 h-5 text-indigo-400" />
              <h2>2. Select Available Room ({nights} Nights)</h2>
            </div>
            {isLoadingAvail && (
              <span className="text-xs text-brand-400 animate-pulse">Checking availability...</span>
            )}
          </div>

          {availableRooms.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-slate-950/60 border border-dashed border-slate-800">
              <p className="text-sm text-slate-400">
                No rooms available for the selected dates. Please select another date range or hotel.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableRooms.map((room) => {
                const isSelected = String(room.room_id) === selectedRoomId;
                return (
                  <div
                    key={room.room_id}
                    onClick={() => setSelectedRoomId(String(room.room_id))}
                    className={`cursor-pointer p-4 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-brand-500/15 border-brand-400 ring-2 ring-brand-500/30'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-brand-400">
                        {room.room_type}
                      </span>
                      <span className="text-xs text-slate-400">Max {room.max_occupancy} guests</span>
                    </div>
                    <p className="text-lg font-bold text-slate-100 mt-1">Room {room.room_number}</p>
                    <div className="mt-3 pt-2 border-t border-slate-800 text-xs flex justify-between">
                      <span className="text-slate-400">Total:</span>
                      <span className="font-bold text-brand-400">
                        {formatCurrency(room.total_rate)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Step 3: Guest Info */}
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex items-center gap-2 text-base font-bold text-slate-100 pb-3 border-b border-slate-800">
            <User className="w-5 h-5 text-amber-400" />
            <h2>3. Guest Information {!isGuest && '& Advance Desk Deposit'}</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Number of Guests"
              type="number"
              min={1}
              max={selectedRoom ? selectedRoom.max_occupancy : 10}
              value={guestsCount}
              onChange={(e) => setGuestsCount(Number(e.target.value))}
              helperText={
                selectedRoom
                  ? `Max capacity for selected room: ${selectedRoom.max_occupancy}`
                  : undefined
              }
              required
            />

            {!isGuest ? (
              <Select
                label="Assign to Guest (Staff/Manager/Owner)"
                value={selectedGuestId}
                onChange={(e) => setSelectedGuestId(e.target.value)}
                options={guests.map((g) => ({
                  value: g.guest_id,
                  label: `${g.full_name} (${g.email}) - ID #${g.guest_id}`,
                }))}
                required
              />
            ) : (
              <Input
                label="Guest Account"
                type="text"
                value={`${user?.full_name || 'Guest'} (${user?.email})`}
                disabled
              />
            )}

            {/* Advance Desk Deposit is strictly for hotel staff/managers/owners recording cash collection */}
            {!isGuest && (
              <Input
                label="Advance Desk Deposit (₹ Cash Collected)"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="e.g. 2000.00"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                helperText="Optional cash deposit collected at reception desk during reservation"
              />
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-end gap-4 pt-4">
          <Link to="/bookings">
            <Button variant="secondary">Cancel</Button>
          </Link>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            disabled={!selectedRoomId || isSubmitting}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Confirm & Create Booking
          </Button>
        </div>
      </form>
    </div>
  );
};
