import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Building2, Users, ArrowRight } from 'lucide-react';
import { getProperties, getAvailability, parseApiError } from '../../api';
import type { PropertyOut, AvailabilityRoom } from '../../types';
import {
  PageHeader,
  Button,
  Input,
  Select,
  EmptyState,
} from '../../components/ui';
import { formatCurrency } from '../../utils/formatters';
import {
  getTodayString,
  getTomorrowString,
  getFutureDateString,
  calculateNights,
} from '../../utils/dates';

export const AvailabilityPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialPropertyId = searchParams.get('property_id') || '';

  const todayStr = getTodayString();
  const [properties, setProperties] = useState<PropertyOut[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(initialPropertyId);
  const [checkIn, setCheckIn] = useState<string>(todayStr);
  const [checkOut, setCheckOut] = useState<string>(getFutureDateString(3, todayStr));

  const [availableRooms, setAvailableRooms] = useState<AvailabilityRoom[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Load properties list
  useEffect(() => {
    getProperties(50, 0)
      .then((res) => {
        setProperties(res.items);
        if (!selectedPropertyId && res.items.length > 0) {
          setSelectedPropertyId(String(res.items[0].property_id));
        }
      })
      .catch((err) => setErrorMessage(parseApiError(err)));
  }, []);

  const handleCheckInChange = (newCheckIn: string) => {
    setCheckIn(newCheckIn);
    if (checkOut <= newCheckIn) {
      setCheckOut(getFutureDateString(3, newCheckIn));
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedPropertyId || !checkIn || !checkOut) return;

    if (checkIn < todayStr) {
      setErrorMessage('Check-in date cannot be in the past.');
      return;
    }

    if (checkOut <= checkIn) {
      setErrorMessage('Check-out date must be strictly after check-in date.');
      return;
    }

    setIsSearching(true);
    setErrorMessage(null);
    try {
      const res = await getAvailability(Number(selectedPropertyId), checkIn, checkOut);
      setAvailableRooms(res.items);
      setHasSearched(true);
    } catch (err) {
      setErrorMessage(parseApiError(err));
    } finally {
      setIsSearching(false);
    }
  };

  const nights = calculateNights(checkIn, checkOut);
  const selectedProperty = properties.find((p) => String(p.property_id) === selectedPropertyId);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Search Room Availability"
        subtitle="Live multi-night dynamic pricing and real-time room availability across properties"
      />

      {/* Filter / Search Bar */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 shadow-xl">
        <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Select
            label="Hotel Property"
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
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

          <div className="flex items-end">
            <Button
              type="submit"
              variant="primary"
              isLoading={isSearching}
              leftIcon={<Search className="w-4 h-4" />}
              className="w-full h-[42px]"
            >
              Search Available
            </Button>
          </div>
        </form>

        {errorMessage && (
          <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
            {errorMessage}
          </div>
        )}
      </div>

      {/* Search Results */}
      {hasSearched && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-brand-400" />
              <span>
                Available Rooms at {selectedProperty?.name || 'Selected Property'} ({nights} {nights === 1 ? 'Night' : 'Nights'})
              </span>
            </h2>
            <span className="text-xs text-slate-400 font-medium">
              {availableRooms.length} {availableRooms.length === 1 ? 'room' : 'rooms'} found
            </span>
          </div>

          {availableRooms.length === 0 ? (
            <EmptyState
              title="No Available Rooms"
              description="All rooms are reserved for the selected date range. Try adjusting your check-in/out dates or selecting another property."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableRooms.map((room) => (
                <div
                  key={room.room_id}
                  className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 shadow-xl flex flex-col justify-between hover:border-slate-700 transition"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-brand-400">
                          {room.room_type}
                        </span>
                        <h3 className="text-xl font-bold text-slate-100 mt-1">
                          Room {room.room_number}
                        </h3>
                      </div>
                      <span className="text-xs text-slate-300 font-semibold bg-slate-800/80 border border-slate-700/80 px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-brand-400" />
                        Max {room.max_occupancy}
                      </span>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-800 space-y-2">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Nightly Base Rate:</span>
                        <span className="font-semibold text-slate-200">
                          {formatCurrency(room.nightly_rate)}/night
                        </span>
                      </div>
                      <div className="flex justify-between text-sm font-bold text-slate-100 pt-1">
                        <span>Total Stay ({nights} nights):</span>
                        <span className="text-brand-400 font-extrabold text-base">
                          {formatCurrency(room.total_rate)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Link
                    to={`/bookings/new?property_id=${selectedPropertyId}&room_id=${room.room_id}&check_in=${checkIn}&check_out=${checkOut}`}
                    className="mt-6"
                  >
                    <Button
                      variant="primary"
                      rightIcon={<ArrowRight className="w-4 h-4" />}
                      className="w-full"
                    >
                      Book This Room
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
