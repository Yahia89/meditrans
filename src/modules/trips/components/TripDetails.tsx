import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Trip, TripStatus } from '../types';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar, MapPin, User, Car, Clock, Phone, Mail, FileText, CheckCircle2, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { usePermissions } from '@/hooks/usePermissions';

interface TripDetailsProps {
    tripId: string;
    onEdit?: (id: string) => void;
}

export function TripDetails({ tripId, onEdit }: TripDetailsProps) {
    const { user } = useAuth();
    const { isAdmin, isOwner } = usePermissions();
    const queryClient = useQueryClient();

    const { data: trip, isLoading } = useQuery({
        queryKey: ['trip', tripId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('trips')
                .select(`
                    *,
                    patient:patients(id, full_name, phone, email, created_at, user_id),
                    driver:drivers(id, full_name, phone, email, user_id, vehicle_info)
                `)
                .eq('id', tripId)
                .single();
            if (error) throw error;
            return data as Trip;
        },
    });

    const updateStatusMutation = useMutation({
        mutationFn: async (newStatus: TripStatus) => {
            const { error } = await supabase
                .from('trips')
                .update({ status: newStatus })
                .eq('id', tripId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
            queryClient.invalidateQueries({ queryKey: ['trips'] });
        },
    });

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    if (!trip) return <div>Trip not found</div>;

    const isDesignatedDriver = trip.driver?.user_id === user?.id;
    const canManage = isAdmin || isOwner;
    const canAccept = isDesignatedDriver && trip.status === 'assigned';
    const canStart = isDesignatedDriver && trip.status === 'accepted';
    const canFinish = isDesignatedDriver && trip.status === 'in_progress';

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Details */}
            <div className="lg:col-span-2 space-y-8">
                {/* Trip Card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-8">
                        <div className="flex items-center justify-between mb-8">
                            <div className="space-y-1">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Trip Type</p>
                                <h2 className="text-xl font-bold text-slate-900">{trip.trip_type} Transportation</h2>
                            </div>
                            <div className="flex items-center gap-3">
                                {canManage && onEdit && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onEdit(tripId)}
                                        className="h-8 gap-2 rounded-lg"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                        Edit Details
                                    </Button>
                                )}
                                <div className={cn(
                                    "px-4 py-1.5 rounded-full text-sm font-bold border",
                                    trip.status === 'completed' ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700 border-emerald-100"
                                )}>
                                    {trip.status.toUpperCase()}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            <div className="space-y-6">
                                <div className="flex gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                                        <MapPin className="w-5 h-5 text-red-500" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold text-slate-400 uppercase">Pickup Location</p>
                                        <p className="text-sm font-medium text-slate-900 leading-relaxed">{trip.pickup_location}</p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
                                        <MapPin className="w-5 h-5 text-slate-400" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold text-slate-400 uppercase">Dropoff Location</p>
                                        <p className="text-sm font-medium text-slate-900 leading-relaxed">{trip.dropoff_location}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="flex gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                                        <Calendar className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold text-slate-400 uppercase">Scheduled Date</p>
                                        <p className="text-sm font-medium text-slate-900">
                                            {new Date(trip.pickup_time).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                                        <Clock className="w-5 h-5 text-orange-500" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Pickup Time</p>
                                        <p className="text-sm font-medium text-slate-900">
                                            {new Date(trip.pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {trip.notes && (
                            <div className="mt-12 p-6 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="flex items-center gap-2 mb-3">
                                    <FileText className="w-4 h-4 text-slate-400" />
                                    <span className="text-xs font-bold text-slate-500 uppercase">Special Instructions</span>
                                </div>
                                <p className="text-sm text-slate-600 leading-relaxed">{trip.notes}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Driver Actions */}
                {isDesignatedDriver && (
                    <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-8">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                            <div>
                                <h3 className="text-lg font-bold text-emerald-900">Driver Actions</h3>
                                <p className="text-sm text-emerald-700">Manage the current state of this trip.</p>
                            </div>
                            <div className="flex gap-4 w-full md:w-auto">
                                {canAccept && (
                                    <Button
                                        onClick={() => updateStatusMutation.mutate('accepted')}
                                        className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white"
                                    >
                                        Accept Trip
                                    </Button>
                                )}
                                {canStart && (
                                    <Button
                                        onClick={() => updateStatusMutation.mutate('in_progress')}
                                        className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white"
                                    >
                                        Start Trip
                                    </Button>
                                )}
                                {canFinish && (
                                    <Button
                                        onClick={() => updateStatusMutation.mutate('completed')}
                                        className="flex-1 md:flex-none bg-slate-900 hover:bg-slate-800 text-white"
                                    >
                                        Finish Trip
                                    </Button>
                                )}
                                {trip.status === 'completed' && (
                                    <div className="flex items-center gap-2 text-emerald-700 font-bold">
                                        <CheckCircle2 className="w-5 h-5" />
                                        Trip Completed
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Side Information */}
            <div className="space-y-6">
                {/* Patient Profile */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6" >Patient Profile</h3>
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                            <User className="text-blue-600" />
                        </div>
                        <div>
                            <p className="font-bold text-slate-900">{trip.patient?.full_name}</p>
                            <p className="text-xs text-slate-500">Member since {trip.patient?.created_at ? new Date(trip.patient.created_at).getFullYear() : 'N/A'}</p>
                        </div>
                    </div>
                    <div className="space-y-4 pt-4 border-t border-slate-50">
                        <div className="flex items-center gap-3 text-sm text-slate-600">
                            <Phone className="w-4 h-4 text-slate-400" />
                            {trip.patient?.phone}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-600">
                            <Mail className="w-4 h-4 text-slate-400" />
                            {trip.patient?.email}
                        </div>
                    </div>
                </div>

                {/* Driver Profile */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Assigned Driver</h3>
                    {trip.driver ? (
                        <>
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                                    <Car className="text-emerald-600" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900">{trip.driver?.full_name}</p>
                                    <p className="text-xs text-slate-500">Vehicle: {trip.driver?.vehicle_info || 'Unknown'}</p>
                                </div>
                            </div>
                            <div className="space-y-4 pt-4 border-t border-slate-50">
                                <div className="flex items-center gap-3 text-sm text-slate-600">
                                    <Phone className="w-4 h-4 text-slate-400" />
                                    {trip.driver?.phone}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-4">
                            <p className="text-sm text-slate-400">No driver assigned yet</p>
                            {canManage && (
                                <Button variant="link" className="text-xs text-blue-600 p-0 h-auto mt-2">
                                    Assign Now
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
