import { useMemo, useState } from 'react';
import { Badge, Box, Button, Flex, Grid, HStack, Icon, Input, Text, VStack } from '@chakra-ui/react';
import {
  FiAlertTriangle,
  FiCheck,
  FiChevronDown,
  FiChevronUp,
  FiCompass,
  FiEdit3,
  FiLock,
  FiNavigation,
  FiX,
} from 'react-icons/fi';
import { AnimatePresence, motion } from 'framer-motion';
import { CAPSULE_CATEGORY_OPTIONS, getPrimaryCapsuleCategory } from '../utils/capsuleCategories';

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
  onUnlockOpen,
  onReportCapsule,
  onUpdateCapsule,
  isSheetCollapsed,
  onSheetToggle,
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

  const targetCategory = getPrimaryCapsuleCategory(targetCapsule?.category);
  const unlockRadius = targetCapsule?.unlock_radius_meters || 50;
  const accessLimit = targetCapsule?.access_limit || 0;
  const accessCount = targetCapsule?.access_count || 0;
  const remainingAccess = Math.max(accessLimit - accessCount, 0);
  const createdAtLabel = targetCapsule?.created_at
    ? new Date(targetCapsule.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
    : null;
  const hasTarget = Boolean(targetCapsule);
  const isOwner = Boolean(targetCapsule?.user_id && userProfile?.id && targetCapsule.user_id === userProfile.id);
  const [editingCapsuleId, setEditingCapsuleId] = useState(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftCategory, setDraftCategory] = useState(CAPSULE_CATEGORY_OPTIONS[0]);
  const [isSaving, setIsSaving] = useState(false);
  const isEditing = Boolean(targetCapsule?.id && editingCapsuleId === targetCapsule.id);

  const handleSaveEdit = async () => {
    if (!targetCapsule || !onUpdateCapsule) return;

    setIsSaving(true);
    const ok = await onUpdateCapsule(targetCapsule.id, {
      title: draftTitle.trim(),
      category: draftCategory,
    });
    setIsSaving(false);

    if (ok) {
      setEditingCapsuleId(null);
    }
  };

  return (
    <Box position="absolute" inset={0} pointerEvents="none" zIndex={5}>
      <Box position="absolute" bottom="0" left="0" w="100%" pointerEvents="none" zIndex={30}>
        <MotionBox
          initial={{ y: 200, opacity: 0 }}
          animate={isSheetCollapsed
            ? { y: 'calc(100% - 54px)', opacity: 1 }
            : { y: 0, opacity: 1 }
          }
          transition={{ type: 'spring', damping: 28, stiffness: 240 }}
          w={isSheetCollapsed ? { base: '100%', md: '480px' } : { base: 'calc(100% - 56px)', md: '480px' }}
          maxW={isSheetCollapsed ? { base: '100%', md: '480px' } : { base: '400px', md: '480px' }}
          mx="auto"
          mb={isSheetCollapsed ? { base: 0, md: 6 } : { base: '10px', md: 6 }}
          p={isSheetCollapsed ? 3 : { base: 3, md: 6 }}
          pb={isSheetCollapsed ? 3 : { base: "calc(env(safe-area-inset-bottom) + 12px)", md: 6 }}
          h="auto"
          maxH={isSheetCollapsed ? 'none' : { base: '56svh', md: '72vh' }}
          borderRadius={isSheetCollapsed ? { base: '18px 18px 0 0', md: '18px' } : '18px'}
          className="atlas-bottom-sheet"
          bg="rgba(255, 255, 255, 0.94)"
          backdropFilter="blur(22px)"
          boxShadow="var(--atlas-shadow)"
          borderTop="1px solid rgba(255, 255, 255, 0.6)"
          position="relative"
          overflowY={isSheetCollapsed ? 'hidden' : 'auto'}
          sx={{ overscrollBehavior: 'contain', '&::-webkit-scrollbar': { display: 'none' } }}
          pointerEvents="auto"
        >
          <Button
            w="100%"
            h={isSheetCollapsed ? '32px' : '22px'}
            minH={isSheetCollapsed ? '32px' : '22px'}
            mb={isSheetCollapsed ? 0 : 3}
            px={2}
            variant="ghost"
            color="var(--atlas-muted-text)"
            borderRadius="12px"
            onClick={onSheetToggle}
            _hover={{ bg: 'transparent', color: 'var(--atlas-text)' }}
            _active={{ bg: 'transparent' }}
            aria-label={isSheetCollapsed ? '장소 카드 펼치기' : '장소 카드 접기'}
          >
            <VStack spacing={1}>
              <Box
                w={isSheetCollapsed ? '32px' : '40px'}
                h="4px"
                bg={isSheetCollapsed ? 'var(--atlas-primary)' : 'var(--atlas-muted-bg)'}
                borderRadius="full"
                style={{ transition: 'all 0.25s ease' }}
              />
              {isSheetCollapsed && hasTarget && (
                <HStack spacing={1} color="var(--atlas-text)" fontSize="xs" fontWeight="800">
                  <Icon as={FiChevronUp} w={3.5} h={3.5} />
                  <Text maxW="240px" noOfLines={1}>{targetCapsule.title}</Text>
                </HStack>
              )}
              {isSheetCollapsed && !hasTarget && (
                <HStack spacing={1} fontSize="xs" fontWeight="800">
                  <Icon as={FiChevronUp} w={3.5} h={3.5} />
                  <Text>장소를 선택해보세요</Text>
                </HStack>
              )}
              {!isSheetCollapsed && (
                <Icon as={FiChevronDown} w={4} h={4} color="var(--atlas-faint-text)" />
              )}
            </VStack>
          </Button>

          <AnimatePresence initial={false} mode="wait">
            {!isSheetCollapsed && (
              <MotionBox
                key={hasTarget ? targetCapsule.id : 'empty-target'}
                initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              >
                {hasTarget ? (
              <VStack align="stretch" spacing={{ base: 2.5, md: 3 }}>
                <HStack justify="space-between" align="start" spacing={2.5}>
                  <HStack align="start" spacing={2.5} minW={0}>
                    <Flex
                      className="atlas-target-compass"
                      w={{ base: '40px', md: '42px' }}
                      h={{ base: '40px', md: '42px' }}
                      align="center"
                      justify="center"
                      borderRadius="14px"
                      flexShrink={0}
                    >
                      <Icon as={FiCompass} color="var(--atlas-primary)" w={5} h={5} />
                    </Flex>
                    <Box minW={0}>
                      <HStack spacing={1.5} mb={1} flexWrap="wrap">
                        {targetCapsule.is_promoted && (
                          <Badge bg="var(--atlas-gold-soft)" color="var(--atlas-gold)" borderRadius="8px" px={2} py={1}>
                            공식 추천 캡슐
                          </Badge>
                        )}
                        <Badge bg="var(--atlas-primary-soft)" color="var(--atlas-primary)" borderRadius="8px" px={2} py={1}>
                          {targetCategory}
                        </Badge>
                      </HStack>
                      {isEditing ? (
                        <Input
                          value={draftTitle}
                          onChange={(event) => setDraftTitle(event.target.value)}
                          h="44px"
                          mt={2}
                          bg="white"
                          borderColor="gray.200"
                          borderRadius="12px"
                          fontWeight="800"
                          _focus={{ borderColor: 'var(--atlas-primary)', boxShadow: '0 0 0 3px rgba(37,99,235,0.14)' }}
                        />
                      ) : (
                        <Text color="var(--atlas-text)" fontSize={{ base: 'xl', md: '2xl' }} fontWeight="800" mt={1} noOfLines={2}>
                          {targetCapsule.title}
                        </Text>
                      )}
                    </Box>
                  </HStack>
                  <VStack spacing={1.5} align="end" flexShrink={0}>
                    <Badge
                      px={3}
                      py={1.5}
                      borderRadius="8px"
                      bg="var(--atlas-primary-soft)"
                      color="var(--atlas-primary)"
                      border="none"
                      fontSize={{ base: 'xs', md: 'sm' }}
                      fontWeight="600"
                    >
                      {distanceToTarget || '위치 권한 필요'}
                    </Badge>
                    <HStack spacing={1.5}>
                    {isOwner && !isEditing && (
                      <Button
                        w="36px"
                        h="36px"
                        minW="36px"
                        p={0}
                        bg="var(--atlas-bg)"
                        color="var(--atlas-text)"
                        borderRadius="12px"
                        aria-label="이름/카테고리 수정"
                        onClick={() => {
                          // 수정 버튼을 누르는 순간 현재 캡슐 공개 정보를 폼에 복사합니다.
                          setDraftTitle(targetCapsule.title || '');
                          setDraftCategory(targetCategory);
                          setEditingCapsuleId(targetCapsule.id);
                        }}
                        _hover={{ bg: 'var(--atlas-muted-bg)' }}
                      >
                        <Icon as={FiEdit3} w={4} h={4} />
                      </Button>
                    )}
                    <Button
                      w="36px"
                      h="36px"
                      minW="36px"
                      p={0}
                      bg="var(--atlas-bg)"
                      color="var(--atlas-muted-text)"
                      borderRadius="12px"
                      aria-label="장소 신고하기"
                      onClick={onReportCapsule}
                      _hover={{ bg: 'var(--atlas-danger-soft)', color: 'var(--atlas-danger)' }}
                    >
                      <Icon as={FiAlertTriangle} w={4} h={4} />
                    </Button>
                    </HStack>
                  </VStack>
                </HStack>

                <Text color="var(--atlas-muted-text)" fontSize="sm" lineHeight="1.5">
                  도착하면 숨겨진 메시지가 열립니다.
                </Text>

                {isEditing && (
                  <Box className="atlas-stat-tile" p={3}>
                    <Text color="var(--atlas-muted-text)" fontSize="xs" fontWeight="800" mb={2}>
                      카테고리 수정
                    </Text>
                    <Flex gap={2} overflowX="auto" css={{ '&::-webkit-scrollbar': { display: 'none' } }}>
                      {CAPSULE_CATEGORY_OPTIONS.map((category) => {
                        const selected = draftCategory === category;

                        return (
                          <Button
                            key={category}
                            h="34px"
                            px={3}
                            flexShrink={0}
                            borderRadius="10px"
                            bg={selected ? 'var(--atlas-primary)' : 'white'}
                            color={selected ? 'white' : 'var(--atlas-text)'}
                            border="1px solid"
                            borderColor={selected ? 'var(--atlas-primary)' : 'gray.200'}
                            fontSize="sm"
                            onClick={() => setDraftCategory(category)}
                            _hover={{ bg: selected ? 'var(--atlas-primary-hover)' : 'gray.50' }}
                          >
                            {category}
                          </Button>
                        );
                      })}
                    </Flex>
                  </Box>
                )}

                {!userLocation && (
                  <Box bg="var(--atlas-gold-soft)" borderRadius="14px" px={4} py={3}>
                    <Text color="var(--atlas-gold)" fontSize="sm" fontWeight="700" lineHeight="1.5">
                      위치 권한이 필요합니다. 기본 탐색은 가능하지만 현장 인증은 현재 위치가 있어야 진행됩니다.
                    </Text>
                  </Box>
                )}

                <Grid templateColumns="repeat(2, 1fr)" gap={2}>
                  {[
                    ['현재 거리', distanceToTarget || '위치 필요'],
                    ['언락 반경', `${unlockRadius}m`],
                    ['탐험 난이도', `Lv.${targetCapsule.difficulty || 3}`],
                    ['남은 열람', `${remainingAccess}명`],
                  ].map(([label, value]) => (
                    <Box key={label} className="atlas-stat-tile" p={{ base: 2.25, md: 3 }}>
                      <Text color="var(--atlas-muted-text)" fontSize="xs" fontWeight="700" mb={1}>
                        {label}
                      </Text>
                      <Text color="var(--atlas-text)" fontSize="sm" fontWeight="800" lineHeight="1.25">
                        {value}
                      </Text>
                    </Box>
                  ))}
                </Grid>

                <HStack spacing={2} flexWrap="wrap">
                  <Badge className="atlas-quiet-badge" px={3} py={1.5} borderRadius="8px" border="none" fontWeight="600">
                    열람 {accessCount}/{accessLimit}
                  </Badge>
                  {createdAtLabel && (
                    <Badge className="atlas-quiet-badge" px={3} py={1.5} borderRadius="8px" border="none" fontWeight="600">
                      생성 {createdAtLabel}
                    </Badge>
                  )}
                </HStack>

                <Button
                  className="atlas-blue-button"
                  h={{ base: '48px', md: '56px' }}
                  borderRadius="16px"
                  fontSize="16px"
                  fontWeight="700"
                  leftIcon={<Icon as={FiLock} />}
                  onClick={onUnlockOpen}
                  _hover={{ bg: 'var(--atlas-primary-hover)', transform: 'translateY(-1px)' }}
                >
                  현장 인증하기
                </Button>

                {isOwner && (
                  isEditing ? (
                    <HStack spacing={2}>
                      <Button
                        flex="1"
                        h="44px"
                        borderRadius="14px"
                        leftIcon={<Icon as={FiCheck} />}
                        bg="var(--atlas-text)"
                        color="white"
                        isLoading={isSaving}
                        onClick={handleSaveEdit}
                        _hover={{ bg: 'var(--atlas-text-subtle)' }}
                      >
                        수정 저장
                      </Button>
                      <Button
                        h="44px"
                        px={4}
                        borderRadius="14px"
                        leftIcon={<Icon as={FiX} />}
                        bg="var(--atlas-bg)"
                        color="var(--atlas-muted-text)"
                        onClick={() => {
                          setDraftTitle(targetCapsule.title || '');
                          setDraftCategory(targetCategory);
                          setEditingCapsuleId(null);
                        }}
                        _hover={{ bg: 'var(--atlas-muted-bg)' }}
                      >
                        취소
                      </Button>
                    </HStack>
                  ) : null
                )}

                <HStack spacing={2}>
                  <Button
                    as="a"
                    flex="1"
                    href={`https://map.kakao.com/link/to/${targetCapsule.title},${targetCapsule.lat},${targetCapsule.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    h="40px"
                    bg="var(--atlas-bg)"
                    color="var(--atlas-text)"
                    borderRadius="14px"
                    fontSize="13px"
                    fontWeight="700"
                    leftIcon={<Icon as={FiNavigation} />}
                    _hover={{ bg: 'var(--atlas-muted-bg)' }}
                  >
                    길찾기
                  </Button>

                  <Button
                    flex="1"
                    h="40px"
                    bg="transparent"
                    color="var(--atlas-muted-text)"
                    borderRadius="14px"
                    fontSize="13px"
                    fontWeight="700"
                    leftIcon={<Icon as={FiAlertTriangle} />}
                    onClick={onReportCapsule}
                    _hover={{ bg: 'var(--atlas-danger-soft)', color: 'var(--atlas-danger)' }}
                  >
                    신고
                  </Button>
                </HStack>
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
                  숨겨진 로컬 캡슐을 선택하면 거리, 인증 반경, 남은 열람 수를 확인할 수 있습니다.
                </Text>
                <HStack spacing={2} flexWrap="wrap" mt={2}>
                  <Badge className="atlas-quiet-badge" px={3} py={1.5} borderRadius="8px" border="none" fontWeight="600">
                    표시 중 {visibleCapsuleCount}개
                  </Badge>
                  <Badge className="atlas-quiet-badge" px={3} py={1.5} borderRadius="8px" border="none" fontWeight="600">
                    {activeRegionLabel}
                  </Badge>
                </HStack>
              </VStack>
            )}
              </MotionBox>
            )}
          </AnimatePresence>
        </MotionBox>
      </Box>
    </Box>
  );
}
