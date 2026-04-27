import { useEffect, useState } from 'react';
import { useToast } from '@chakra-ui/react';

export function useExplorerTools() {
  const [position, setPosition] = useState(null);
  const toast = useToast();

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      return undefined;
    }

    let watchId;

    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setPosition(pos);

          if (pos.coords.accuracy > 30 && !toast.isActive('gps-accuracy')) {
            toast({
              id: 'gps-accuracy',
              title: '위치 신호가 불안정합니다.',
              description: '탁 트인 곳으로 이동해주세요.',
              status: 'warning',
              duration: 5000,
              isClosable: true,
              position: 'top',
            });
          }
        },
        (err) => {
          console.error('Watch position error:', err);
        },
        { enableHighAccuracy: true, maximumAge: 0 },
      );
    } catch (e) {
      console.error('GPS Initialization Error', e);
    }

    return () => {
      if (watchId !== undefined) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [toast]);

  const trigger50mVibration = async () => window.navigator.vibrate?.(50);
  const trigger20mVibration = async () => window.navigator.vibrate?.([60, 80, 60]);
  const triggerSuccessVibration = async () => window.navigator.vibrate?.([100, 50, 200]);

  return { position, trigger50mVibration, trigger20mVibration, triggerSuccessVibration };
}
