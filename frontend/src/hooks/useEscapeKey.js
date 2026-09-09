import { useEffect } from 'react';

export const useEscapeKey = (onClose, isOpen = true) => {
    useEffect(() => {
        if (!isOpen) return;

        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose, isOpen]);
};
