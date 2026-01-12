import { useState, useEffect } from 'react';

/**
 * Hook personalizado para detectar si el usuario está en un dispositivo móvil
 * Considera móvil si el ancho de pantalla es menor a 1024px (lg breakpoint de Tailwind)
 */
export function useMobile(breakpoint: number = 1024) {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < breakpoint;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isMobile;
}
