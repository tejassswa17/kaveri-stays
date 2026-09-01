import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Mail, UserCheck } from 'lucide-react';
import { getGuests, parseApiError } from '../../api';
import type { GuestOut } from '../../types';
import {
  PageHeader,
  Button,
  Input,
  Table,
  ErrorState,
} from '../../components/ui';
import type { Column } from '../../components/ui';

export const GuestsPage: React.FC = () => {
  const [guests, setGuests] = useState<GuestOut[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const [searchEmail, setSearchEmail] = useState('');
  const [activeEmailFilter, setActiveEmailFilter] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGuests = async (off: number, email?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getGuests(email || undefined, limit, off);
      setGuests(res.items);
      setTotal(res.meta.total);
      setOffset(off);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGuests(0, activeEmailFilter);
  }, [activeEmailFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveEmailFilter(searchEmail.trim());
  };

  const handleClearSearch = () => {
    setSearchEmail('');
    setActiveEmailFilter('');
  };

  const columns: Column<GuestOut>[] = [
    {
      header: 'Guest ID',
      accessorKey: 'guest_id',
      cell: (g) => <span className="font-mono font-bold text-slate-100">#{g.guest_id}</span>,
    },
    {
      header: 'Full Name',
      accessorKey: 'full_name',
      cell: (g) => (
        <span className="font-semibold text-slate-200 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-brand-400" />
          <span>{g.full_name}</span>
        </span>
      ),
    },
    {
      header: 'Email Address',
      accessorKey: 'email',
      cell: (g) => (
        <span className="text-slate-300 flex items-center gap-1.5 font-mono text-xs">
          <Mail className="w-3.5 h-3.5 text-slate-500" />
          <span>{g.email}</span>
        </span>
      ),
    },
    {
      header: 'Actions',
      cell: (g) => (
        <div className="flex items-center gap-2">
          <Link to={`/guests/${g.guest_id}`}>
            <Button variant="outline" size="sm">
              View Profile
            </Button>
          </Link>
          <Link to={`/bookings/new?guest_id=${g.guest_id}`}>
            <Button variant="secondary" size="sm">
              Book Stay
            </Button>
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guest Directory"
        subtitle="Manage registered hotel guests and booking profiles (Staff / Manager / Owner only)"
      />

      {/* Search Bar */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-xl">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              type="email"
              placeholder="Search by exact email address..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" variant="primary">
              Search Email
            </Button>
            {activeEmailFilter && (
              <Button type="button" variant="secondary" onClick={handleClearSearch}>
                Clear
              </Button>
            )}
          </div>
        </form>
      </div>

      {/* Content Table */}
      {error ? (
        <ErrorState message={error} onRetry={() => fetchGuests(offset, activeEmailFilter)} />
      ) : (
        <Table
          columns={columns}
          data={guests}
          keyExtractor={(g) => g.guest_id}
          total={total}
          limit={limit}
          offset={offset}
          onPageChange={(newOffset) => fetchGuests(newOffset, activeEmailFilter)}
          isLoading={isLoading}
          emptyMessage="No guest records found matching the search criteria."
        />
      )}
    </div>
  );
};
