import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Building2,
  MapPin,
  Star,
  Search,
  ArrowRight,
  ArrowLeft,
  Users,
} from 'lucide-react';
import { getProperty, getRooms, getAvailability, parseApiError } from '../../api';
import { useAuth } from '../../context/AuthContext';
import type { PropertyOut, RoomOut, AvailabilityRoom } from '../../types';
import {
  PageHeader,
  Button,
  Input,
  LoadingSpinner,
  ErrorState,
  EmptyState,
} from '../../components/ui';
import { formatCurrency } from '../../utils/formatters';
import {
  getTodayString,
  getTomorrowString,
  getFutureDateString,
  calculateNights,
} from '../../utils/dates';

export const PropertyDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const propertyId = Number(id);
  const { isGuest } = useAuth();

  const [property, setProperty] = useState<PropertyOut | null>(null);
  const [rooms, setRooms] = useState<RoomOut[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Availability Search within Property
  const todayStr = getTodayString();
  const [checkIn, setCheckIn] = useState<string>(todayStr);
  const [checkOut, setCheckOut] = useState<string>(getFutureDateString(3, todayStr));
  const [availabilityResults, setAvailabilityResults] = useState<AvailabilityRoom[]>([]);
  const [isSearchingAvailability, setIsSearchingAvailability] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (!propertyId || isNaN(propertyId)) {
      setError('Invalid property ID');
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const propRes = await getProperty(propertyId);
        setProperty(propRes);

        // Room inventory catalog is only available to Staff/Manager/Owner
        if (!isGuest) {
          try {
            const roomsRes = await getRooms(propertyId, 100, 0);
            setRooms(roomsRes.items);
          } catch {
            setRooms([]);
          }
        }
      } catch (err) {
        setError(parseApiError(err));
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [propertyId, isGuest]);

  const handleCheckInChange = (newCheckIn: string) => {
    setCheckIn(newCheckIn);
    if (checkOut <= newCheckIn) {
      setCheckOut(getFutureDateString(3, newCheckIn));
    }
  };

  const handleSearchAvailability = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checkIn < todayStr) {
      setSearchError('Check-in date cannot be in the past.');
      return;
    }
    if (checkOut <= checkIn) {
      setSearchError('Check-out date must be strictly after check-in date.');
      return;
    }

    setIsSearchingAvailability(true);
    setSearchError(null);
    try {
      const res = await getAvailability(propertyId, checkIn, checkOut);
      setAvailabilityResults(res.items);
      setHasSearched(true);
    } catch (err) {
      setSearchError(parseApiError(err));
    } finally {
      setIsSearchingAvailability(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner size="lg" label="Loading property details..." className="py-20" />;
  }

  if (error || !property) {
    return <ErrorState message={error || 'Property not found'} onRetry={() => window.location.reload()} />;
  }

  const nights = calculateNights(checkIn, checkOut);

  return (
    <div className="space-y-10">
      {/* Back Link */}
      <div className="flex items-center gap-3">
        <Link to="/properties">
          <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Back to Properties
          </Button>
        </Link>
      </div>

      {/* Property Hero */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-8 sm:p-10 shadow-2xl relative overflow-hidden">
        <div className="max-w-3xl space-y-4">
          <div className="flex items-center gap-2 text-brand-400">
            <MapPin className="w-5 h-5" />
            <span className="font-semibold text-sm uppercase tracking-wider">{property.city}</span>
          </div>

          <PageHeader
            title={property.name}
            subtitle={`Explore accommodations, check real-time availability, and reserve your stay in ${property.city}.`}
          />

          <div className="flex items-center gap-6 pt-2 text-sm text-slate-300">
            <div className="flex items-center gap-1.5">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="font-bold text-slate-100">{property.star_rating}.0</span>
              <span className="text-slate-400">Star Hospitality</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-brand-400" />
              <span className="font-bold text-slate-100">{rooms.length}</span>
              <span className="text-slate-400">Configured Rooms</span>
            </div>
          </div>
        </div>
      </div>

      {/* Check Real-Time Availability Widget */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 shadow-xl space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Search className="w-5 h-5 text-brand-400" />
            <span>Search Room Availability for This Property</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Specify your stay dates to calculate live nightly rates and check room availability
          </p>
        </div>

        <form onSubmit={handleSearchAvailability} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

          <div className="flex items-end">
            <Button
              type="submit"
              variant="primary"
              isLoading={isSearchingAvailability}
              leftIcon={<Search className="w-4 h-4" />}
              className="w-full h-[42px]"
            >
              Check Availability
            </Button>
          </div>
        </form>

        {searchError && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
            {searchError}
          </div>
        )}

        {/* Availability Results */}
        {hasSearched && (
          <div className="pt-6 border-t border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                Available Rooms for {nights} {nights === 1 ? 'Night' : 'Nights'} ({formatCurrency(0).split('0')[0]} Live Dynamic Rates)
              </h3>
              <span className="text-xs text-slate-400">
                {availabilityResults.length} rooms ready to book
              </span>
            </div>

            {availabilityResults.length === 0 ? (
              <EmptyState
                title="No Rooms Available"
                description="All rooms at this property are booked for the selected dates. Please adjust your stay window."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availabilityResults.map((r) => (
                  <div
                    key={r.room_id}
                    className="rounded-xl bg-slate-800/80 border border-slate-700/80 p-5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-brand-400">
                            {r.room_type}
                          </span>
                          <h4 className="text-lg font-bold text-slate-100 mt-1">
                            Room {r.room_number}
                          </h4>
                        </div>
                        <span className="text-xs text-slate-300 bg-slate-900 px-2 py-1 rounded-md flex items-center gap-1">
                          <Users className="w-3 h-3 text-brand-400" />
                          Max {r.max_occupancy}
                        </span>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-700 space-y-1">
                        <div className="flex justify-between text-xs text-slate-400">
                          <span>Nightly Rate:</span>
                          <span className="font-semibold text-slate-200">
                            {formatCurrency(r.nightly_rate)}/night
                          </span>
                        </div>
                        <div className="flex justify-between text-sm font-bold text-slate-100">
                          <span>Total ({nights} nights):</span>
                          <span className="text-brand-400 font-extrabold">
                            {formatCurrency(r.total_rate)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <Link
                      to={`/bookings/new?property_id=${propertyId}&room_id=${r.room_id}&check_in=${checkIn}&check_out=${checkOut}`}
                      className="mt-4"
                    >
                      <Button
                        variant="primary"
                        size="sm"
                        rightIcon={<ArrowRight className="w-4 h-4" />}
                        className="w-full"
                      >
                        Book Room
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Property Room Inventory (Staff/Manager/Owner only) */}
      {!isGuest && rooms.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-brand-400" />
            <span>Room Inventory Catalog ({rooms.length} Rooms)</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {rooms.map((room) => (
              <div
                key={room.room_id}
                className="rounded-2xl bg-slate-900/70 border border-slate-800 p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-400">
                    {room.room_type}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">#{room.room_id}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-100">Room {room.room_number}</h3>
                <div className="text-xs text-slate-400 flex items-center gap-1.5 pt-2 border-t border-slate-800">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span>Accommodates up to {room.max_occupancy} guests</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
