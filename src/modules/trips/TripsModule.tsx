import { TripList } from './components/TripList';
import { CreateTripForm } from './components/CreateTripForm';
import { TripDetails } from './components/TripDetails';

interface TripsModuleProps {
    view: 'list' | 'create' | 'details' | 'edit';
    onNavigate?: (view: 'list' | 'create' | 'details' | 'edit', id?: string) => void;
    onBack?: () => void;
    tripId?: string;
}

export function TripsModule({ view, onNavigate, onBack, tripId }: TripsModuleProps) {
    switch (view) {
        case 'list':
            return (
                <TripList
                    onCreateClick={() => onNavigate?.('create')}
                    onTripClick={(id: string) => onNavigate?.('details', id)}
                />
            );
        case 'create':
            return (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold text-slate-900">Create New Trip</h1>
                        <button
                            onClick={onBack}
                            className="text-sm font-medium text-slate-500 hover:text-slate-800"
                        >
                            Back to Trips
                        </button>
                    </div>
                    <CreateTripForm onSuccess={() => onBack?.()} onCancel={onBack} />
                </div>
            );
        case 'edit':
            return (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold text-slate-900">Edit Trip</h1>
                        <button
                            onClick={onBack}
                            className="text-sm font-medium text-slate-500 hover:text-slate-800"
                        >
                            Back to Details
                        </button>
                    </div>
                    <CreateTripForm
                        tripId={tripId}
                        onSuccess={() => onBack?.()}
                        onCancel={onBack}
                    />
                </div>
            );
        case 'details':
            return (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold text-slate-900">Trip Details</h1>
                        <button
                            onClick={onBack}
                            className="text-sm font-medium text-slate-500 hover:text-slate-800"
                        >
                            Back to Trips
                        </button>
                    </div>
                    <TripDetails
                        tripId={tripId || ''}
                        onEdit={(id) => onNavigate?.('edit', id)}
                        onDeleteSuccess={() => onBack?.()}
                    />
                </div>
            );
        default:
            return <TripList onCreateClick={() => onNavigate?.('create')} onTripClick={(id: string) => onNavigate?.('details', id)} />;
    }
}
