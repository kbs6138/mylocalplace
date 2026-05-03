import { useMemo, useState } from 'react';
import { Badge, Box, Button, Flex, HStack, Icon, Progress, Text, VStack } from '@chakra-ui/react';
import { FiAlertTriangle, FiChevronRight, FiCompass, FiLock, FiMapPin, FiNavigation, FiZap } from 'react-icons/fi';
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
  const [isSheetCollapsed, setIsSheetCollapsed] = useState(false);
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
            className="atlas-hud-card atlas-entry-card"
            p={5}
            onClick={onDashboardOpen}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onDashboardOpen();
              }
            }}
            role="button"
            tabIndex={0}
            cursor="pointer"
            transition="transform 0.18s ease, box-shadow 0.18s ease"
            _hover={{ transform: 'translateY(-2px)' }}
            _active={{ transform: 'scale(0.98)' }}
            position="relative"
            overflow="hidden"
          >
            <HStack justify="space-between" align="start" mb={4}>
              <HStack spacing={3} minW={0} align="center">
                <Flex className="atlas-profile-mark" align="center" justify="center">
                  <Icon as={FiMapPin} w={5} h={5} />
                </Flex>
                <Box minW={0}>
                  <Text color="var(--atlas-muted-text)" fontSize="xs" fontWeight="800">
                    EXPLORER PASS
                  </Text>
                  <Text color="var(--atlas-text)" fontSize="xl" fontWeight="800" mt={1} noOfLines={1}>
                    {explorerName}
                  </Text>
                  <Text color="var(--atlas-muted-text)" fontSize="xs" fontWeight="650" mt={0.5} noOfLines={1}>
                    내 탐험 상태 보기
                  </Text>
                </Box>
              </HStack>
              <HStack spacing={2} flexShrink={0}>
                <Badge
                  px={2.5}
                  py={1.5}
                  borderRadius="8px"
                  bg={userProfile?.is_pro ? 'var(--atlas-coral-soft)' : 'var(--atlas-primary-soft)'}
                  color={userProfile?.is_pro ? 'var(--atlas-coral)' : 'var(--atlas-primary)'}
                  border="none"
                  fontWeight="800"
                >
                  {userProfile?.is_pro ? 'PRO' : 'FREE'}
                </Badge>
                <Flex className="atlas-entry-arrow" align="center" justify="center" aria-hidden="true">
                  <FiChevronRight size={16} />
                </Flex>
              </HStack>
            </HStack>

            <VStack spacing={4} align="stretch">
              <Box
                className="atlas-entry-energy"
                onClick={(event) => {
                  event.stopPropagation();
                  onShopOpen();
                }}
                cursor="pointer"
                transition="all 0.2s"
                _active={{ transform: 'scale(0.98)' }}
              >
                <HStack justify="space-between" mb={2}>
                  <HStack>
                     <Text color="var(--atlas-muted-text)" fontSize="sm" fontWeight="600">
                       에너지
                     </Text>
                     <Text color="var(--atlas-text)" fontSize="sm" fontWeight="700">
                       {energy}%
                     </Text>
                  </HStack>
                  <Text color="var(--atlas-primary)" fontSize="sm" fontWeight="800" bg="var(--atlas-primary-soft)" px={2} py={0.5} borderRadius="8px">
                    충전
                  </Text>
                </HStack>
                <Progress
                  value={energy}
                  h="8px"
                  borderRadius="full"
                  bg="var(--atlas-muted-bg)"
                  colorScheme="blue"
                  sx={{
                    '& > div': {
                      backgroundColor: 'var(--atlas-primary)',
                    },
                  }}
                />
              </Box>

              <Flex gap={3}>
                <Box
                  className="atlas-stat-tile"
                  flex="1"
                  p={4}
                  onClick={(event) => {
                    event.stopPropagation();
                    onShopOpen();
                  }}
                  cursor="pointer"
                  _active={{ transform: 'scale(0.96)' }}
                  transition="transform 0.1s"
                >
                  <HStack justify="space-between" align="center" mb={2}>
                    <Text color="var(--atlas-muted-text)" fontSize="xs" fontWeight="600">
                      마스터 키
                    </Text>
                    <Flex className="atlas-entry-mini-icon atlas-entry-mini-icon-gold" align="center" justify="center">
                      <Icon as={FiZap} w={3.5} h={3.5} />
                    </Flex>
                  </HStack>
                  <Text color="var(--atlas-text)" fontSize="xl" fontWeight="700">
                    {masterKeys}
                  </Text>
                </Box>
                <Box
                  className="atlas-stat-tile"
                  flex="1"
                  p={4}
                >
                  <HStack justify="space-between" align="center" mb={2}>
                    <Text color="var(--atlas-muted-text)" fontSize="xs" fontWeight="600">
                      표시 중
                    </Text>
                    <Flex className="atlas-entry-mini-icon atlas-entry-mini-icon-blue" align="center" justify="center">
                      <Icon as={FiCompass} w={3.5} h={3.5} />
                    </Flex>
                  </HStack>
                  <Text color="var(--atlas-text)" fontSize="xl" fontWeight="700">
                    {visibleCapsuleCount}
                  </Text>
                </Box>
              </Flex>
            </VStack>
          </Box>
        </VStack>
      </Box>

      <Box position="absolute" bottom="0" left="0" w="100%" pointerEvents="auto" zIndex={30}>
        <MotionBox
          initial={{ y: 200, opacity: 0 }}
          animate={isSheetCollapsed
            ? { y: 'calc(100% - 32px)', opacity: 1 }
            : { y: 0, opacity: 1 }
          }
          transition={{ type: 'spring', damping: 28, stiffness: 240 }}
          w={{ base: '100%', md: '480px' }}
          mx={{ base: 0, md: 'auto' }}
          mb={{ base: 0, md: 6 }}
          p={6}
          pb={{ base: "calc(env(safe-area-inset-bottom) + 90px)", md: 6 }}
          borderTopRadius="18px"
          borderBottomRadius={{ base: "0", md: "18px" }}
          className="atlas-bottom-sheet"
          bg="rgba(255, 255, 255, 0.94)"
          backdropFilter="blur(22px)"
          boxShadow="var(--atlas-shadow)"
          borderTop="1px solid rgba(255, 255, 255, 0.6)"
          position="relative"
          overflow="hidden"
        >
          {/* 드래그 핸들 - 클릭하면 접기/펼치기 */}
          <Box
            w="100%"
            pb={isSheetCollapsed ? 0 : 5}
            display={{ base: 'flex', md: 'none' }}
            justifyContent="center"
            cursor="pointer"
            onClick={() => setIsSheetCollapsed(prev => !prev)}
            pt={isSheetCollapsed ? 1 : 0}
          >
            <Box
              w={isSheetCollapsed ? '32px' : '40px'}
              h="4px"
              bg={isSheetCollapsed ? 'var(--atlas-primary)' : 'var(--atlas-muted-bg)'}
              borderRadius="full"
              style={{ transition: 'all 0.25s ease' }}
            />
          </Box>



          {targetCapsule && distanceToTarget ? (
            <VStack align="stretch" spacing={5}>
              <HStack justify="space-between" align="start" spacing={3}>
                <HStack align="start" spacing={3} minW={0}>
                  <Flex
                    className="atlas-target-compass"
                    w="46px"
                    h="46px"
                    align="center"
                    justify="center"
                    borderRadius="14px"
                    flexShrink={0}
                  >
                    <Icon as={FiCompass} color="var(--atlas-primary)" w={5} h={5} />
                  </Flex>
                  <Box minW={0}>
                    <Text color="var(--atlas-primary)" fontSize="xs" fontWeight="800">
                      TARGET LOCKED
                    </Text>
                    <Text color="var(--atlas-text)" fontSize="2xl" fontWeight="800" mt={1} noOfLines={2}>
                      {targetCapsule.title}
                    </Text>
                  </Box>
                </HStack>
                <Badge
                  px={3}
                  py={1.5}
                  borderRadius="8px"
                  bg="var(--atlas-primary-soft)"
                  color="var(--atlas-primary)"
                  border="none"
                  fontSize="sm"
                  fontWeight="600"
                >
                  {distanceToTarget}
                </Badge>
              </HStack>

              <Text color="var(--atlas-muted-text)" fontSize="sm" lineHeight="1.6">
                {targetCategory} · 반경 {unlockRadius}m · 현장 인증 필요
              </Text>

              <Flex gap={2} wrap="wrap">
                <Badge
                  className="atlas-quiet-badge"
                  px={3}
                  py={1.5}
                  borderRadius="8px"
                  border="none"
                  fontWeight="600"
                >
                  난이도 Lv.{targetCapsule.difficulty || 3}
                </Badge>
                <Badge
                  className="atlas-quiet-badge"
                  px={3}
                  py={1.5}
                  borderRadius="8px"
                  border="none"
                  fontWeight="600"
                >
                  열람 {accessCount}/{accessLimit}
                </Badge>
              </Flex>

              <Button
                className="atlas-blue-button"
                h="56px"
                borderRadius="16px"
                fontSize="17px"
                fontWeight="600"
                leftIcon={<Icon as={FiLock} />}
                onClick={onUnlockOpen}
                _hover={{ bg: 'var(--atlas-primary-hover)', transform: 'translateY(-1px)' }}
              >
                현장에서 열어보기
              </Button>

              <Button
                as="a"
                href={`https://map.kakao.com/link/to/${targetCapsule.title},${targetCapsule.lat},${targetCapsule.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                h="48px"
                bg="var(--atlas-bg)"
                color="var(--atlas-text)"
                borderRadius="16px"
                fontSize="15px"
                fontWeight="600"
                leftIcon={<Icon as={FiNavigation} />}
                _hover={{ bg: 'var(--atlas-muted-bg)' }}
              >
                카카오맵 길찾기
              </Button>

              <Button
                h="42px"
                bg="transparent"
                color="var(--atlas-muted-text)"
                borderRadius="14px"
                fontSize="14px"
                fontWeight="600"
                leftIcon={<Icon as={FiAlertTriangle} />}
                onClick={onReportCapsule}
                _hover={{ bg: 'var(--atlas-danger-soft)', color: 'var(--atlas-danger)' }}
              >
                장소 신고하기
              </Button>
            </VStack>
          ) : (
            <VStack align="stretch" spacing={4}>
              <Text color="var(--atlas-muted-text)" fontSize="xs" fontWeight="700">
                지도 탐색 중
              </Text>
              <Text color="var(--atlas-text)" fontSize="xl" fontWeight="700">
                지도에서 마커를 눌러보세요
              </Text>
              <Text color="var(--atlas-muted-text)" fontSize="sm" lineHeight="1.6">
                숨겨진 아지트를 선택하면 상세한 정보와 길찾기를 이용할 수 있습니다.
              </Text>
              <HStack spacing={2} flexWrap="wrap" mt={2}>
                <Badge
                  className="atlas-quiet-badge"
                  px={3}
                  py={1.5}
                  borderRadius="8px"
                  border="none"
                  fontWeight="600"
                >
                  표시 중 {visibleCapsuleCount}개
                </Badge>
                <Badge
                  className="atlas-quiet-badge"
                  px={3}
                  py={1.5}
                  borderRadius="8px"
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
