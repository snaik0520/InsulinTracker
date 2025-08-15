import { useState } from 'react';
import { Medication } from '@/shared/types';
import { twMerge } from 'tailwind-merge';

interface MoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  medication: Medication | null;
  fromLocation: string;
  onMoved: () => void;
}

export default function MoveModal({
  isOpen,
  onClose,
  medication,
  fromLocation,
  onMoved,
}: MoveModalProps) {
  const [toLocation, setToLocation] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const maxQty = medication?.quantity ?? 1;

  if (!isOpen || !medication) return null;

  async function handleSubmit() {
    if (quantity < 1 || quantity > (medication.quantity ?? 0)) {
      alert(`Quantity must be between 1 and ${medication.quantity}`);
      return;
    }
    setLoading(true);
    try {
      await fetch('/api/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medicationId: medication.id,
          fromLocation,
          toLocation,
          quantity,
          comment,
        }),
      });
      onMoved();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to move medication');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={twMerge(
        'fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center',
        isOpen ? '' : 'hidden'
      )}
    >
      <div className="bg-white rounded-lg shadow-lg w-96 p-6 space-y-4">
        <h2 className="text-xl font-semibold">Move {medication.name}</h2>
        <div>
          <label className="block text-sm font-medium">From</label>
          <input
            readOnly
            value={fromLocation}
            className="mt-1 w-full border rounded px-2 py-1 bg-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">To</label>
          <input
            value={toLocation}
            onChange={(e) => setToLocation(e.target.value)}
            placeholder="Destination"
            className="mt-1 w-full border rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Quantity</label>
          <input
            type="number"
            min={1}
            max={maxQty}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="mt-1 w-full border rounded px-2 py-1"
          />
          <p className="text-xs text-gray-500">
            Available: {medication.quantity}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium">Comment</label>
          <textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional note"
            className="mt-1 w-full border rounded px-2 py-1"
          />
        </div>
        <div className="flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Moving…' : `Move ${quantity}`}
          </button>
        </div>
      </div>
    </div>
  );
}
