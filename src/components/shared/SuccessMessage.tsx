import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

interface SuccessMessageProps {
  message: string;
  onClose?: () => void;
  className?: string;
}

const SuccessMessage: React.FC<SuccessMessageProps> = ({ 
  message, 
  onClose, 
  className = '' 
}) => {
  return (
    <div className={`flex items-center p-4 bg-green-50 border border-green-200 rounded-lg ${className}`}>
      <CheckCircle className="w-5 h-5 text-green-600" />
      <span className="ml-3 text-sm text-green-800">{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          className="ml-auto text-gray-400 hover:text-gray-600"
          aria-label="Close success message"
        >
          <XCircle className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default SuccessMessage;