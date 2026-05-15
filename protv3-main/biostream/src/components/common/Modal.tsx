import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Reusable Modal component.
 * Displays content in a centered overlay, with a close button.
 */
const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 z-10"
          aria-label="Close modal"
        >
          <X size={20} />
        </button>
        <div className="p-6 pt-10">{children}</div> {/* Added padding-top to avoid content under close button */}
      </div>
    </div>
  );
};

export default Modal;