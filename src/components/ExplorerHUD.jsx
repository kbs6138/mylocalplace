import { useMemo } from 'react';
import { Badge, Box, Button, Flex, HStack, Icon, Progress, Text, VStack } from '@chakra-ui/react';
import { FiAlertTriangle, FiCompass, FiLock, FiNavigation, FiZap } from 'react-icons/fi';
import { motion } from 'framer-motion';

const MotionBox = motion.create(Box);

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const earthRadius = 6371;
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

export default function ExplorerHUD({
  userLocation,
  targetCapsule,
  userProfile,
  visibleCapsuleCount,
  activeRegionLabel,
  onDashboardOpen,
  onShopOpen,
  onUnlockOpen,
  onReportCapsule,
}) {
  const distanceToTarget = useMemo(() => {
    if (!userLocation || !targetCapsule) {
      return null;
    }

    const distance = getDistanceFromLatLonInKm(
      userLocation.latitude,
      userLocation.longitude,
      targetCapsule.lat,
      targetCapsule.lng,
    );

    return distance < 1 ? `${(distance * 1000).toFixed(0)}m` : `${distance.toFixed(1)}km`;
  }, [userLocation, targetCapsule]);

  const energy = userProfile?.energy ?? 0;
  const masterKeys = userProfile?.master_keys ?? 0;
  const explorerName = userProfile?.nickname || 'Explorer';
  const targetCategory = targetCapsule?.category?.split(',')?.[0] || '아지트';
  const unlockRadius = targetCapsule?.unlock_radius_meters || 50;
  const accessLimit = targetCapsule?.access_limit || 0;
  const accessCount = targetCapsule?.access_count || 0;

  return (
    <Box position="absolute" inset={0} pointerEvents="none" zIndex={5}>
      <Box
        position="absolute"
        top="24px"
        right="16px"
        pointerEvents="auto"
        display={{ base: 'none', md: 'block' }}
      >
        <VStack
          spacing={3}
          align="stretch"
          w="320px"
        >
          <Box
            p={5}
            borderRadius="16px"
            bg="var(--toss-card)"
            boxShadow="var(--toss-shadow-float)"
            onClick={onDashboardOpen}
            cursor="pointer"
            transition="transform 0.1s"
            _active={{ transform: 'scale(0.98)' }}
            position="relative"
            overflow="hidden"
          >
            <HStack justify="space-between" align="start" mb={4}>
              <Box>
                <Text color="var(--toss-gray)" fontSize="xs" fontWeight="700">
                  내 정보
                </Text>
                <Text color="var(--toss-ink)" fontSize="xl" fontWeight="700" mt={1}>
                  {explorerName}
                </Text>
              </Box>
              <Badge
                px={3}
                py={1.5}
                borderRadius="8px"
                bg={userProfile?.is_pro ? 'rgba(255, 118, 87, 0.1)' : 'var(--toss-blue-light)'}
                color={userProfile?.is_pro ? '#ff5238' : 'var(--toss-blue)'}
                border="none"
                fontWeight="600"
              >
                {userProfile?.is_pro ? 'PRO' : 'FREE'}
              </Badge>
            </HStack>

            <VStack spacing={4} align="stretch">
              <Box
                onClick={onShopOpen}
                cursor="pointer"
                transition="all 0.2s"
                _active={{ transform: 'scale(0.98)' }}
              >
                <HStack justify="space-between" mb={2}>
                  <HStack>
                     <Text color="var(--toss-gray)" fontSize="sm" fontWeight="600">
                       에너지
                     </Text>
                     <Text color="var(--toss-ink)" fontSize="sm" fontWeight="700">
                       {energy}%
                     </Text>
                  </HStack>
                  <Text color="var(--toss-blue)" fontSize="sm" fontWeight="700" bg="var(--toss-blue-light)" px={2} py={0.5} borderRadius="md">
                    충전하기
                  </Text>
                </HStack>
                <Progress
                  value={energy}
                  h="8px"
                  borderRadius="full"
                  bg="var(--toss-gray-bg)"
                  colorScheme="blue"
                  sx={{
                    '& > div': {
                      backgroundColor: 'var(--toss-blue)',
                    },
                  }}
                />
              </Box>

              <Flex gap={3}>
                <Box
                  flex="1"
                  p={4}
                  borderRadius="16px"
                  bg="var(--toss-bg)"
                  onClick={onShopOpen}
                  cursor="pointer"
                  _active={{ transform: 'scale(0.96)' }}
                  transition="transform 0.1s"
                >
                  <HStack justify="space-between" mb={1}>
                    <Text color="var(--toss-gray)" fontSize="xs" fontWeight="600">
                      마스터 키
                    </Text>
                    <Icon as={FiZap} color="#ffaa00" />
                  </HStack>
                  <Text color="var(--toss-ink)" fontSize="xl" fontWeight="700">
                    {masterKeys}
                  </Text>
                </Box>
                <Box
                  flex="1"
                  p={4}
                  borderRadius="16px"
                  bg="var(--toss-bg)"
                >
                  <HStack justify="space-between" mb={1}>
                    <Text color="var(--toss-gray)" fontSize="xs" fontWeight="600">
                      표시 중
                    </Text>
                    <Icon as={FiCompass} color="var(--toss-blue)" />
                  </HStack>
                  <Text color="var(--toss-ink)" fontSize="xl" fontWeight="700">
                    {visibleCapsuleCount}
                  </Text>
                </Box>
              </Flex>
            </VStack>
          </Box>
        </VStack>
      </Box>

      <Box position="absolute" bottom="0" left="0" w="100%" pointerEvents="auto" zIndex={30} overflow="hidden">
        <MotionBox
          initial={{ y: 200, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 24, stiffness: 200 }}
          w={{ base: '100%', md: '480px' }}
          mx={{ base: 0, md: 'auto' }}
          mb={{ base: 0, md: 6 }}
          p={6}
          pb={{ base: "calc(env(safe-area-inset-bottom) + 90px)", md: 6 }}
          borderTopRadius="18px"
          borderBottomRadius={{ base: "0", md: "18px" }}
          bg="rgba(255, 255, 255, 0.94)"
          backdropFilter="blur(22px)"
          boxShadow="var(--atlas-shadow)"
          borderTop="1px solid rgba(255, 255, 255, 0.6)"
          position="relative"
          overflow="hidden"
        >
          <Box
            w="40px"
            h="4px"
            bg="var(--toss-gray-bg)"
            borderRadius="full"
            mx="auto"
            mb={5}
            display={{ base: 'block', md: 'none' }}
          />

          {targetCapsule && distanceToTarget ? (
            <VStack align="stretch" spacing={5}>
              <HStack justify="space-between" align="start">
                <Box>
                  <Text color="var(--toss-blue)" fontSize="xs" fontWeight="700">
                    목표 선택됨
                  </Text>
                  <Text color="var(--toss-ink)" fontSize="2xl" fontWeight="700" mt={1}>
                    {targetCapsule.title}
                  </Text>
                </Box>
                <Badge
                  px={3}
                  py={1.5}
                  borderRadius="8px"
                  bg="var(--toss-blue-light)"
                  color="var(--toss-blue)"
                  border="none"
                  fontSize="sm"
                  fontWeight="600"
                >
                  {distanceToTarget}
                </Badge>
              </HStack>

              <Text color="var(--toss-gray)" fontSize="sm" lineHeight="1.6">
                {targetCategory} · 반경 {unlockRadius}m 안에서 서버 검증 후 숨겨진 메시지를 열 수 있습니다.
              </Text>

              <Flex gap={2} wrap="wrap">
                <Badge
                  px={3}
                  py={1.5}
                  borderRadius="8px"
                  bg="var(--toss-bg)"
                  color="var(--toss-gray)"
                  border="none"
                  fontWeight="600"
                >
                  난이도 Lv.{targetCapsule.difficulty || 3}
                </Badge>
                <Badge
                  px={3}
                  py={1.5}
                  borderRadius="8px"
                  bg="var(--toss-bg)"
                  color="var(--toss-gray)"
                  border="none"
                  fontWeight="600"
                >
                  열람 {accessCount}/{accessLimit}
                </Badge>
              </Flex>

              <Button
                h="56px"
                bg="var(--toss-blue)"
                color="white"
                borderRadius="16px"
                fontSize="17px"
                fontWeight="600"
                leftIcon={<Icon as={FiLock} />}
                onClick={onUnlockOpen}
                _hover={{ bg: 'var(--toss-blue-hover)', transform: 'translateY(-1px)' }}
              >
                현장에서 열어보기
              </Button>

              <Button
                as="a"
                href={`https://map.kakao.com/link/to/${targetCapsule.title},${targetCapsule.lat},${targetCapsule.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                h="48px"
                bg="var(--toss-bg)"
                color="var(--toss-ink)"
                borderRadius="16px"
                fontSize="15px"
                fontWeight="600"
                leftIcon={<Icon as={FiNavigation} />}
                _hover={{ bg: 'var(--toss-gray-bg)' }}
              >
                카카오맵 길찾기
              </Button>

              <Button
                h="42px"
                bg="transparent"
                color="var(--toss-gray)"
                borderRadius="14px"
                fontSize="14px"
                fontWeight="600"
                leftIcon={<Icon as={FiAlertTriangle} />}
                onClick={onReportCapsule}
                _hover={{ bg: 'var(--toss-red-light)', color: 'var(--toss-red)' }}
              >
                장소 신고하기
              </Button>
            </VStack>
          ) : (
            <VStack align="stretch" spacing={4}>
              <Text color="var(--toss-gray)" fontSize="xs" fontWeight="700">
                지도 탐색 중
              </Text>
              <Text color="var(--toss-ink)" fontSize="xl" fontWeight="700">
                지도에서 마커를 눌러보세요
              </Text>
              <Text color="var(--toss-gray)" fontSize="sm" lineHeight="1.6">
                숨겨진 아지트를 선택하면 상세한 정보와 길찾기를 이용할 수 있습니다.
              </Text>
              <HStack spacing={2} flexWrap="wrap" mt={2}>
                <Badge
                  px={3}
                  py={1.5}
                  borderRadius="8px"
                  bg="var(--toss-blue-light)"
                  color="var(--toss-blue)"
                  border="none"
                  fontWeight="600"
                >
                  표시 중 {visibleCapsuleCount}개
                </Badge>
                <Badge
                  px={3}
                  py={1.5}
                  borderRadius="8px"
                  bg="var(--toss-bg)"
                  color="var(--toss-gray)"
                  border="none"
                  fontWeight="600"
                >
                  {activeRegionLabel}
                </Badge>
              </HStack>
            </VStack>
          )}
        </MotionBox>
      </Box>
    </Box>
  );
}
