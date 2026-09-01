import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, CalendarDays, ArrowRight } from 'lucide-react';
import { getProperties, parseApiError } from '../../api';
import type { PropertyOut } from '../../types';
import { PageHeader, Button, Badge, LoadingSpinner, ErrorState, EmptyState } from '../../components/ui';

export const PropertiesPage: React.FC = () => {
  const [properties, setProperties] = useState<PropertyOut[]>([]);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProperties = async (off: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getProperties(limit, off);
      setProperties(res.items);
      setOffset(off);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties(0);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hotel Properties"
        subtitle="Explore our chain of boutique and luxury stays across South India"
        actions={
          <Link to="/availability">
            <Button variant="primary" leftIcon={<CalendarDays className="w-4 h-4" />}>
              Search Availability
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <LoadingSpinner size="lg" label="Loading properties..." className="py-20" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => fetchProperties(offset)} />
      ) : properties.length === 0 ? (
        <EmptyState title="No properties found" description="No hotel properties are currently registered." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property) => (
            <div
              key={property.property_id}
              className="flex flex-col justify-between rounded-2xl bg-slate-900/80 border border-slate-800/80 p-6 shadow-xl hover:border-slate-700 transition hover:bg-slate-900 group"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                    <MapPin className="w-4 h-4 text-brand-400" />
                    <span>{property.city}</span>
                  </div>
                  <Badge variant="warning" size="sm">
                    ★ {property.star_rating} Stars
                  </Badge>
                </div>

                <h3 className="text-xl font-bold text-slate-100 group-hover:text-brand-400 transition">
                  {property.name}
                </h3>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  Property #{property.property_id}
                </p>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-800/80 flex items-center justify-between gap-3">
                <Link to={`/availability?property_id=${property.property_id}`} className="flex-1">
                  <Button variant="secondary" size="sm" className="w-full">
                    Check Dates
                  </Button>
                </Link>
                <Link to={`/properties/${property.property_id}`} className="flex-1">
                  <Button
                    variant="primary"
                    size="sm"
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                    className="w-full"
                  >
                    View Details
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
