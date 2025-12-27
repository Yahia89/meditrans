import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Calendar, Clock, MapPin, User, Car } from 'lucide-react';
import type { Trip, TripStatus } from '../types';
import { cn } from '@/lib/utils';

interface TripListProps {
    onCreateClick?: () => void;
    onTripClick: (id: string) => void;
    patientId?: string;
    driverId?: string;
    hideHeader?: boolean;
}

const statusColors: Record<TripStatus, string> = {
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    assigned: 'bg-blue-100 text-blue-700 border-blue-200',
    accepted: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    in_progress: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    completed: 'bg-slate-100 text-slate-700 border-slate-200',
    cancelled: 'bg-red-100 text-red-700 border-red-200',
};

export function TripList({ onCreateClick, onTripClick, patientId, driverId, hideHeader = false }: TripListProps) {
    const { currentOrganization } = useOrganization();

    const { data: trips, isLoading } = useQuery({
        queryKey: ['trips', currentOrganization?.id, patientId, driverId],
        queryFn: async () => {
            let query = supabase
                .from('trips')
                .select(`
                    *,
                    patient:patients(id, full_name, phone, created_at),
                    driver:drivers(id, full_name, phone, user_id, vehicle_info)
                `)
                .eq('org_id', currentOrganization?.id)
                .order('pickup_time', { ascending: false });

            if (patientId) {
                query = query.eq('patient_id', patientId);
            }
            if (driverId) {
                query = query.eq('driver_id', driverId);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data as Trip[];
        },
        enabled: !!currentOrganization
    });

    if (isLoading) {
        return (
            <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    if (!trips?.length) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-dashed border-slate-300 gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-slate-50 border border-slate-100">
                    <Calendar className="w-6 h-6 text-slate-300" />
                </div>
                <div className="text-center">
                    <h3 className="text-base font-semibold text-slate-900">No trips found</h3>
                    <p className="text-sm text-slate-500">There are no trips scheduled for this record.</p>
                </div>
                {!patientId && !driverId && onCreateClick && (
                    <Button onClick={onCreateClick} className="bg-slate-900 hover:bg-slate-800 text-white shadow-sm rounded-xl">
                        <Plus className="w-4 h-4 mr-2" />
                        Create New Trip
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {!hideHeader && (
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Active Trips</h2>
                        <p className="text-sm text-slate-500">You have {trips.length} trips scheduled</p>
                    </div>
                    {onCreateClick && (
                        <Button onClick={onCreateClick} className="bg-[#3D5A3D] hover:bg-[#2E4A2E] text-white shadow-sm rounded-xl">
                            <Plus className="w-4 h-4 mr-2" />
                            New Trip
                        </Button>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {trips.map((trip) => (
                    <div
                        key={trip.id}
                        onClick={() => onTripClick(trip.id)}
                        className="group bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col"
                    >
                        {/* Status Header */}
                        <div className="p-4 border-b border-slate-50 flex items-center justify-between">
                            <span className={cn(
                                "px-2.5 py-0.5 rounded-full text-xs font-semibold border",
                                statusColors[trip.status]
                            )}>
                                {trip.status.replace('_', ' ').toUpperCase()}
                            </span>
                            <span className="text-xs font-medium text-slate-400">
                                {trip.trip_type}
                            </span>
                        </div>

                        <div className="p-5 space-y-4 flex-1">
                            {!patientId && (
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                                        <User className="w-4 h-4 text-slate-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-slate-900 truncate">
                                            {trip.patient?.full_name || 'Unknown Patient'}
                                        </p>
                                        <p className="text-xs text-slate-500">{trip.patient?.phone}</p>
                                    </div>
                                </div>
                            )}

                            {!driverId && (
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                                        <Car className="w-4 h-4 text-slate-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-slate-700 truncate">
                                            {trip.driver?.full_name || 'Awaiting Driver'}
                                        </p>
                                        <p className="text-xs text-slate-500">Assigned Driver</p>
                                    </div>
                                </div>
                            )}

                            <hr className="border-slate-50" />

                            {/* Trip Info */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-slate-600">
                                    <Clock className="w-4 h-4" />
                                    <span className="text-sm">
                                        {new Date(trip.pickup_time).toLocaleDateString()} at {new Date(trip.pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className="flex items-start gap-2 text-slate-600">
                                    <MapPin className="w-4 h-4 mt-1 flex-shrink-0 text-red-400" />
                                    <span className="text-sm line-clamp-1">{trip.pickup_location}</span>
                                </div>
                                <div className="flex items-start gap-2 text-slate-600">
                                    <MapPin className="w-4 h-4 mt-1 flex-shrink-0 text-slate-400" />
                                    <span className="text-sm line-clamp-1">{trip.dropoff_location}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
