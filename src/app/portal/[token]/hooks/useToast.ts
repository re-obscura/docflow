'use client';

import { useCallback } from 'react';

export function useToast() {
    const showToast = useCallback((
        type: string,
        text: string,
        setToast: (val: { type: string; text: string } | null) => void
    ) => {
        setToast({ type, text });
        setTimeout(() => setToast(null), 3000);
    }, []);
    return showToast;
}
