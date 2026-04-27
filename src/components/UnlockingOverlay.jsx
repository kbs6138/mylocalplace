import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Flex, HStack, Icon, Text, useToast } from '@chakra-ui/react';
import { FiCheckCircle, FiLock } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { verifyAndUnlock } from '../supabaseClient';

const MotionBox = motion.create(Box);

function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const earthRadius = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return earthRadius * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function formatDistance(distance) {
  if (!Number.isFinite(distance)) return '측정 전';
  return distance < 1000 ? `${Math.round(distance)}m` : `${(distance / 1000).toFixed(1)}km`;
}

function EnergyCountdown({ isHacking }) {
  const R = 60;
  const C = 2 * Math.PI * R;

  return (
    <Box position="relative" w="160px" h="160px" mx="auto" mb={6}>
      <svg width="160" height="160" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={R} fill="none" stroke="var(--toss-divider)" strokeWidth="4" />
        <motion.circle
          cx="80" cy="80" r={R}
          fill="none"
          stroke="var(--toss-blue)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C}
          transform="rotate(-90 80 80)"
          animate={isHacking ? { strokeDashoffset: 0 } : { strokeDashoffset: C }}
          transition={{ duration: 2, ease: 'easeInOut' }}
        />
      </svg>

      <Flex
        position="absolute"
        inset={0}
        align="center"
        justify="center"
        direction="column"
        gap={1}
      >
        <Flex
          w="56px"
          h="56px"
          borderRadius="14px"
          bg={isHacking ? 'var(--toss-blue-light)' : 'var(--toss-bg)'}
          color={isHacking ? 'var(--toss-blue)' : 'var(--toss-gray)'}
          align="center"
          justify="center"
        >
          <Icon as={FiLock} w={7} h={7} />
        </Flex>
        <Text fontSize="xs" color={isHacking ? 'var(--toss-blue)' : 'var(--toss-gray)'} fontWeight="700">
          {isHacking ? '검증 중' : '잠김'}
        </Text>
      </Flex>
    </Box>
  );
}

export default function UnlockingOverlay({ isVisible, capsule, userLocation, onClose, onUnlocked }) {
  const [isHacking, setIsHacking] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockResult, setUnlockResult] = useState(null);
  const [unlockError, setUnlockError] = useState('');
  const toast = useToast();

  const distance = useMemo(() => {
    if (!userLocation || !capsule) return null;
    return getDistanceFromLatLonInMeters(
      userLocation.latitude,
      userLocation.longitude,
      capsule.lat,
      capsule.lng,
    );
  }, [capsule, userLocation]);

  useEffect(() => {
    if (!isVisible) return;
    setIsHacking(false);
    setIsUnlocked(false);
    setUnlockResult(null);
    setUnlockError('');
  }, [capsule?.id, isVisible]);

  const handleUnlock = async () => {
    if (!capsule?.id) {
      setUnlockError('선택한 아지트 정보가 올바르지 않습니다.');
      return;
    }

    if (!userLocation) {
      setUnlockError('현재 위치를 먼저 확인해야 합니다.');
      toast({
        title: '위치 정보가 필요합니다.',
        description: '브라우저 위치 권한을 허용한 뒤 다시 시도해주세요.',
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    setIsHacking(true);
    setUnlockError('');
    if (window.navigator.vibrate) window.navigator.vibrate([50, 100, 50]);

    try {
      const [result] = await Promise.all([
        verifyAndUnlock(userLocation.latitude, userLocation.longitude, capsule.id),
        new Promise((resolve) => {
          setTimeout(resolve, 900);
        }),
      ]);

      if (!result?.ok) {
        const message = result?.message || '아지트를 열 수 없습니다.';
        setUnlockError(message);
        toast({
          title: '잠금 해제 실패',
          description: message,
          status: result?.code === 'TOO_FAR' ? 'info' : 'warning',
          duration: 3500,
        });
        return;
      }

      setUnlockResult(result);
      setIsUnlocked(true);
      if (window.navigator.vibrate) window.navigator.vibrate([100, 50, 200]);
      if (onUnlocked) onUnlocked(result);
    } catch (err) {
      const message = err?.message || '서버 검증 중 문제가 발생했습니다.';
      setUnlockError(message);
      toast({
        title: '잠금 해제 오류',
        description: message,
        status: 'error',
        duration: 4000,
      });
    } finally {
      setIsHacking(false);
    }
  };

  if (!isVisible || !capsule) return null;

  const displayDistance = formatDistance(distance);
  const unlockRadius = capsule.unlock_radius_meters || 50;
  const rank = unlockResult?.rank || 1;

  return (
    <Box
      position="fixed" inset={0} zIndex={200}
      bg="rgba(0,0,0,0.6)"
      backdropFilter="blur(8px)"
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <Flex direction="column" align="center" justify="center" p={6} position="relative" zIndex={202}>
        <AnimatePresence mode="wait">
          {!isUnlocked && (
            <MotionBox
              key="lock"
              initial={{ y: 60, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -40, opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 20, stiffness: 200 }}
              className="toss-card"
              bg="white"
              borderRadius="16px"
              p={8}
              w={{ base: '340px', md: '380px' }}
              textAlign="center"
              position="relative"
              overflow="hidden"
            >
              <Text color="var(--toss-blue)" fontSize="xs" fontWeight="800" letterSpacing="0" mb={4}>
                현장 위치 인증
              </Text>

              <EnergyCountdown isHacking={isHacking} />

              {isHacking ? (
                <Text color="var(--toss-blue)" fontSize="sm" fontWeight="700">
                  서버에서 현재 위치를 확인하고 있습니다.
                </Text>
              ) : (
                <>
                  <Text color="var(--toss-ink)" fontSize="xl" fontWeight="800" mb={1}>
                    {capsule.title}
                  </Text>
                  <Text color="var(--toss-gray)" fontSize="sm" lineHeight="1.6" mb={5}>
                    반경 {unlockRadius}m 안에서 서버 위치 검증을 통과해야 숨겨진 메시지를 열 수 있습니다.
                  </Text>
                  <HStack justify="center" spacing={3} mb={unlockError ? 3 : 8}>
                    <Text color="var(--toss-gray)" fontSize="sm">현재 거리</Text>
                    <Text
                      color="var(--toss-blue)"
                      fontSize="sm"
                      fontWeight="800"
                      bg="var(--toss-blue-light)"
                      px={2}
                      py={0.5}
                      borderRadius="8px"
                    >
                      {displayDistance}
                    </Text>
                  </HStack>

                  {unlockError && (
                    <Box bg="var(--toss-red-light)" borderRadius="14px" px={4} py={3} mb={5}>
                      <Text color="var(--toss-red)" fontSize="sm" fontWeight="700" lineHeight="1.5">
                        {unlockError}
                      </Text>
                    </Box>
                  )}

                  <Button
                    w="100%"
                    h="56px"
                    bg="var(--toss-blue)"
                    color="white"
                    borderRadius="16px"
                    fontSize="lg"
                    fontWeight="700"
                    onClick={handleUnlock}
                    isLoading={isHacking}
                    loadingText="서버 검증 중"
                    _hover={{ bg: 'var(--toss-blue-hover)' }}
                    _active={{ transform: 'scale(0.97)' }}
                    boxShadow="0 8px 24px rgba(49,130,246,0.35)"
                    mb={2}
                  >
                    현장 위치 인증
                  </Button>
                  <Button
                    variant="ghost"
                    w="100%"
                    h="48px"
                    color="var(--toss-gray)"
                    borderRadius="16px"
                    onClick={onClose}
                  >
                    닫기
                  </Button>
                </>
              )}
            </MotionBox>
          )}

          {isUnlocked && (
            <MotionBox
              key="unlocked"
              initial={{ scale: 0.8, opacity: 0, rotateY: -15 }}
              animate={{ scale: 1, opacity: 1, rotateY: 0 }}
              transition={{ type: 'spring', bounce: 0.5, duration: 0.7 }}
              bg="white"
              borderRadius="16px"
              p={8}
              w={{ base: '340px', md: '380px' }}
              textAlign="center"
              boxShadow="var(--atlas-shadow)"
              position="relative"
              overflow="hidden"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', bounce: 0.6, delay: 0.1 }}
                style={{ display: 'block', marginBottom: '12px' }}
              >
                <Flex
                  w="64px"
                  h="64px"
                  borderRadius="16px"
                  bg="var(--atlas-green-light)"
                  color="var(--atlas-green)"
                  align="center"
                  justify="center"
                  mx="auto"
                >
                  <Icon as={FiCheckCircle} w={8} h={8} />
                </Flex>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Text color="var(--toss-blue)" fontSize="xs" fontWeight="800" letterSpacing="0" mb={2}>
                  인증 완료
                </Text>
                <Text color="var(--toss-ink)" fontSize="2xl" fontWeight="800" mb={3}>
                  숨겨진 메시지
                </Text>
                <Box
                  bg="var(--toss-blue-light)"
                  borderRadius="16px"
                  p={4}
                  mb={6}
                >
                  <Text color="var(--toss-blue)" fontSize="md" fontWeight="600" lineHeight="1.7">
                    {unlockResult?.hint || capsule.hint || '이곳에 도착한 탐험가님을 진심으로 환영합니다.'}
                  </Text>
                </Box>
                <Box w="100%" h="1px" bg="var(--toss-divider)" mb={5} />
                <Flex justify="space-between" align="center" mb={2}>
                  <Text color="var(--toss-gray)" fontSize="sm">발견 순서</Text>
                  <Text color="var(--toss-ink)" fontWeight="700">{rank}번째</Text>
                </Flex>
                <Flex justify="space-between" align="center" mb={7}>
                  <Text color="var(--toss-gray)" fontSize="sm">매설자와의 거리</Text>
                  <Text color="var(--toss-ink)" fontWeight="700">
                    {formatDistance(unlockResult?.distance_meters ?? distance)}
                  </Text>
                </Flex>
                <Button
                  w="100%"
                  h="56px"
                  bg="var(--toss-blue)"
                  color="white"
                  borderRadius="16px"
                  fontSize="lg"
                  fontWeight="700"
                  onClick={onClose}
                  _active={{ transform: 'scale(0.97)' }}
                  boxShadow="0 8px 24px rgba(49,130,246,0.3)"
                >
                  확인
                </Button>
              </motion.div>
            </MotionBox>
          )}
        </AnimatePresence>
      </Flex>
    </Box>
  );
}
