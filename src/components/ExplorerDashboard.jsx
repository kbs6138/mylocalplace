import { useEffect, useState } from 'react';
import {
  Avatar,
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  GridItem,
  HStack,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Progress,
  Text,
  VStack,
} from '@chakra-ui/react';
import ReactECharts from 'echarts-for-react';
import { FiCompass, FiLogOut, FiMap, FiZap } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { supabase } from '../supabaseClient';

const MotionBox = motion.create(Box);

const profileMetrics = [
  {
    key: 'energy',
    label: '에너지',
    suffix: '%',
    icon: FiZap,
  },
  {
    key: 'master_keys',
    label: '마스터 키',
    suffix: '개',
    icon: FiCompass,
  },
];

const MY_CAPSULE_FIELDS = 'id,title,category,access_count,access_limit,is_promoted,created_at';

function withCapsuleDefaults(capsule) {
  return {
    access_count: 0,
    created_at: null,
    ...capsule,
  };
}

function formatDate(dateValue) {
  if (!dateValue) return '';
  return new Date(dateValue).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  });
}

function formatMeters(value) {
  const distance = Number(value);
  if (!Number.isFinite(distance)) return '측정 전';
  return distance < 1000 ? `${Math.round(distance)}m` : `${(distance / 1000).toFixed(1)}km`;
}

export default function ExplorerDashboard({ isOpen, onClose, userProfile }) {
  const [myCapsules, setMyCapsules] = useState([]);
  const [discoveries, setDiscoveries] = useState([]);

  useEffect(() => {
    if (!isOpen || !userProfile?.id) {
      return undefined;
    }

    let isActive = true;

    async function loadActivity() {
      const [capsulesResult, discoveriesResult] = await Promise.all([
        supabase
          .from('mlp_mylocalplace')
          .select(MY_CAPSULE_FIELDS)
          .eq('user_id', userProfile.id)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('mlp_capsule_discoveries')
          .select('id,created_at,distance_meters,capsule:mlp_mylocalplace(title,category)')
          .eq('user_id', userProfile.id)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      if (!isActive) return;
      if (!capsulesResult.error) setMyCapsules((capsulesResult.data || []).map(withCapsuleDefaults));
      if (!discoveriesResult.error) setDiscoveries(discoveriesResult.data || []);
    }

    void loadActivity();

    return () => {
      isActive = false;
    };
  }, [isOpen, userProfile?.id]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onClose();
  };

  const radarOption = {
    backgroundColor: 'transparent',
    radar: {
      indicator: [
        { name: '개척성', max: 100 },
        { name: '도전성', max: 100 },
        { name: '희소성', max: 100 },
        { name: '반경', max: 100 },
        { name: '야행성', max: 100 },
      ],
      radius: '60%',
      axisName: {
        color: 'var(--toss-gray)',
        fontSize: 12,
      },
      splitArea: {
        areaStyle: {
          color: ['#f9fafb', '#ffffff'],
        },
      },
      axisLine: {
        lineStyle: { color: 'var(--toss-divider)' },
      },
      splitLine: {
        lineStyle: { color: 'var(--toss-divider)' },
      },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: [85, 90, 75, 60, 95],
            name: '탐험 패턴',
            areaStyle: { color: 'rgba(49, 130, 246, 0.15)' },
            lineStyle: { color: 'var(--toss-blue)', width: 2 },
            itemStyle: { color: 'var(--toss-blue)' },
          },
        ],
      },
    ],
  };

  const membershipLabel = userProfile?.is_pro ? 'Pro 탐험가' : '기본 탐험가';

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="full" scrollBehavior="inside">
      <ModalOverlay bg="rgba(0,0,0,0.3)" backdropFilter="blur(6px)" />
      <ModalContent
        m={0}
        borderRadius={0}
        bg="var(--toss-bg)"
      >
        <ModalHeader
          display="flex"
          alignItems="center"
          gap={3}
          px={{ base: 3, md: 6 }}
          py={3}
          borderBottom="1px solid"
          borderColor="var(--toss-divider)"
          bg="var(--toss-card)"
          position="sticky"
          top={0}
          zIndex={10}
        >
          <Button
            variant="ghost"
            onClick={onClose}
            px={2}
            minW="auto"
            h="48px"
            color="var(--toss-ink)"
            _hover={{ bg: 'var(--toss-bg)' }}
            display="flex"
            alignItems="center"
            gap={1}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Button>
          <HStack spacing={3}>
            <span className="live-dot" />
            <Text color="var(--toss-ink)" fontSize="xl" fontWeight="700">
              내 탐험 상태
            </Text>
          </HStack>
        </ModalHeader>

        <ModalBody px={{ base: 5, md: 8 }} py={{ base: 6, md: 8 }}>
          <VStack spacing={6} align="stretch" maxW="1240px" mx="auto">
            <Grid templateColumns={{ base: '1fr', xl: '1.2fr 0.8fr' }} gap={6}>
              <GridItem>
                <MotionBox
                  className="toss-card reveal-up"
                  p={{ base: 6, md: 8 }}
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                >
                  <VStack align="stretch" spacing={6}>
                    <Flex direction={{ base: 'column', md: 'row' }} gap={5} justify="space-between">
                      <HStack align="start" spacing={4}>
                        <Avatar
                          size="xl"
                          name={userProfile?.nickname || 'Explorer'}
                          src={userProfile?.avatar_url || ''}
                          bg="var(--toss-blue-light)"
                          color="var(--toss-blue)"
                        />
                        <Box>
                          <HStack spacing={2} align="center" mb={1}>
                            <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="bold" color="var(--toss-ink)">
                              {userProfile?.nickname || 'Explorer'}
                            </Text>
                            <Badge
                              px={2}
                              py={1}
                              borderRadius="8px"
                              bg={userProfile?.is_pro ? 'var(--toss-blue)' : 'var(--toss-bg)'}
                              color={userProfile?.is_pro ? 'white' : 'var(--toss-gray)'}
                              fontSize="xs"
                            >
                              {membershipLabel}
                            </Badge>
                          </HStack>
                          <Text color="var(--toss-gray)" fontSize="sm" lineHeight="1.6" maxW="480px">
                            {userProfile?.is_pro
                              ? `구독 상태가 활성화되어 있습니다${userProfile?.subscription_end ? ` · 만료일 ${new Date(userProfile.subscription_end).toLocaleDateString()}` : ''}.`
                              : '무료 탐험가 모드입니다.'}
                          </Text>
                        </Box>
                      </HStack>

                      <Box
                        minW={{ base: 'auto', md: '200px' }}
                        p={4}
                        borderRadius="16px"
                        bg="var(--toss-bg)"
                      >
                        <Text color="var(--toss-gray)" fontSize="xs" fontWeight="600" mb={1}>
                          현재 에너지
                        </Text>
                        <Text color="var(--toss-ink)" fontSize="3xl" fontWeight="bold" mb={2}>
                          {userProfile?.energy || 0}%
                        </Text>
                        <Progress
                          value={userProfile?.energy || 0}
                          h="8px"
                          borderRadius="full"
                          bg="white"
                          sx={{ '& > div': { background: 'var(--toss-blue)' } }}
                        />
                      </Box>
                    </Flex>

                    <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={4}>
                      {profileMetrics.map((metric) => (
                        <GridItem
                          key={metric.key}
                          p={4}
                          borderRadius="16px"
                          bg="var(--toss-bg)"
                        >
                          <Text color="var(--toss-gray)" fontSize="sm" fontWeight="600" mb={1}>
                            {metric.label}
                          </Text>
                          <Text color="var(--toss-ink)" fontSize="2xl" fontWeight="bold">
                            {userProfile?.[metric.key] ?? 0}
                            <Text as="span" fontSize="lg" fontWeight="normal" ml={1}>{metric.suffix}</Text>
                          </Text>
                        </GridItem>
                      ))}

                      <GridItem
                        p={4}
                        borderRadius="16px"
                        bg="var(--toss-bg)"
                      >
                        <Text color="var(--toss-gray)" fontSize="sm" fontWeight="600" mb={1}>
                          활동 상태
                        </Text>
                        <Text color="var(--toss-green)" fontSize="2xl" fontWeight="bold">
                          탐험 중
                        </Text>
                      </GridItem>
                    </Grid>
                  </VStack>
                </MotionBox>
              </GridItem>

              <GridItem>
                <VStack spacing={6} align="stretch">
                  <Box className="toss-card" p={{ base: 5, md: 6 }}>
                    <Text color="var(--toss-ink)" fontSize="lg" fontWeight="bold" mb={4}>
                      상태 요약
                    </Text>
                    <VStack spacing={4} align="stretch">
                      <Flex justify="space-between" align="center">
                        <Text color="var(--toss-gray)" fontSize="md" fontWeight="500">
                          이용 플랜
                        </Text>
                        <Text color="var(--toss-ink)" fontSize="md" fontWeight="600">
                          {membershipLabel}
                        </Text>
                      </Flex>
                      <Flex justify="space-between" align="center">
                        <Text color="var(--toss-gray)" fontSize="md" fontWeight="500">
                          보유 키
                        </Text>
                        <Text color="var(--toss-ink)" fontSize="md" fontWeight="600">
                          {userProfile?.master_keys || 0}개
                        </Text>
                      </Flex>
                      <Flex justify="space-between" align="center">
                        <Text color="var(--toss-gray)" fontSize="md" fontWeight="500">
                          에너지 상태
                        </Text>
                        <Text color="var(--toss-ink)" fontSize="md" fontWeight="600">
                          {userProfile?.energy || 0}% 충전
                        </Text>
                      </Flex>
                    </VStack>
                  </Box>

                  <Box className="toss-interactive-card" p={{ base: 5, md: 6 }}>
                    <Text color="var(--toss-blue)" fontSize="sm" fontWeight="bold" mb={1}>
                      새로운 목표
                    </Text>
                    <Text color="var(--toss-ink)" fontSize="lg" fontWeight="bold" mb={2}>
                      아직 발견 로그가 없습니다.
                    </Text>
                    <Text color="var(--toss-gray)" fontSize="sm" lineHeight="1.6">
                      첫 번째 아지트를 매설하거나 찾아보세요.
                    </Text>
                  </Box>
                </VStack>
              </GridItem>
            </Grid>

            <Grid templateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={6}>
              <GridItem>
                <MotionBox
                  className="toss-card"
                  p={{ base: 5, md: 6 }}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  position="relative"
                  overflow="hidden"
                >
                  <HStack justify="space-between" mb={5}>
                    <HStack>
                      <Text color="var(--toss-ink)" fontSize="lg" fontWeight="bold">
                        탐험 성향 분석
                      </Text>
                    </HStack>
                    <Badge px={2} py={1} borderRadius="8px" bg="var(--toss-blue-light)" color="var(--toss-blue)" fontWeight="700">
                      AI Preview
                    </Badge>
                  </HStack>

                  <Flex align="center" gap={4} mb={4} wrap="wrap">
                    <VStack align="stretch" spacing={2} flex="1">
                      {[
                        { label: '개척성', val: 85, color: '#3182f6' },
                        { label: '도전성', val: 90, color: '#7c3aed' },
                        { label: '희소성', val: 75, color: '#06b6d4' },
                        { label: '야행성', val: 95, color: '#f5a623' },
                      ].map((stat) => (
                        <Box key={stat.label} w="100%">
                          <Flex justify="space-between" mb={1}>
                            <Text fontSize="xs" color="var(--toss-gray)" fontWeight="600">{stat.label}</Text>
                            <Text fontSize="xs" color={stat.color} fontWeight="800">{stat.val}%</Text>
                          </Flex>
                          <Box h="4px" bg="var(--toss-divider)" borderRadius="full" overflow="hidden">
                            <MotionBox
                              h="100%"
                              bg={stat.color}
                              borderRadius="full"
                              initial={{ width: 0 }}
                              animate={{ width: `${stat.val}%` }}
                              transition={{ delay: 0.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                            />
                          </Box>
                        </Box>
                      ))}
                    </VStack>
                  </Flex>

                  <Box h={{ base: '220px', md: '240px' }}>
                    <ReactECharts option={radarOption} style={{ height: '100%', width: '100%' }} />
                  </Box>
                </MotionBox>
              </GridItem>

              <GridItem>
                <VStack spacing={6} align="stretch">
                  <Box className="toss-card" p={{ base: 5, md: 6 }}>
                    <HStack justify="space-between" mb={4}>
                      <Text color="var(--toss-ink)" fontSize="lg" fontWeight="bold">
                        발견한 캡슐
                      </Text>
                      <FiMap size={20} color="var(--toss-blue)" />
                    </HStack>
                    {discoveries.length > 0 ? (
                      <VStack align="stretch" spacing={3}>
                        {discoveries.map((item) => (
                          <Flex
                            key={item.id}
                            justify="space-between"
                            gap={3}
                            p={4}
                            borderRadius="16px"
                            bg="var(--toss-bg)"
                          >
                            <Box minW={0}>
                              <Text color="var(--toss-ink)" fontSize="sm" fontWeight="800" noOfLines={1}>
                                {item.capsule?.title || '삭제된 아지트'}
                              </Text>
                              <Text color="var(--toss-gray)" fontSize="xs" mt={1} noOfLines={1}>
                                {formatDate(item.created_at)} · {item.capsule?.category || '카테고리 없음'}
                              </Text>
                            </Box>
                            <Badge
                              alignSelf="center"
                              px={2}
                              py={1}
                              borderRadius="8px"
                              bg="var(--toss-blue-light)"
                              color="var(--toss-blue)"
                              flexShrink={0}
                            >
                              {formatMeters(item.distance_meters)}
                            </Badge>
                          </Flex>
                        ))}
                      </VStack>
                    ) : (
                      <Flex
                        minH="180px"
                        align="center"
                        justify="center"
                        direction="column"
                        borderRadius="16px"
                        bg="var(--toss-bg)"
                        textAlign="center"
                        px={6}
                      >
                        <Text color="var(--toss-gray)" fontSize="md" fontWeight="600" mb={1}>
                          발견 내역이 없습니다.
                        </Text>
                        <Text color="var(--toss-gray-light)" fontSize="sm">
                          지도를 탐색해 아지트를 찾아보세요.
                        </Text>
                      </Flex>
                    )}
                  </Box>

                  <Box className="toss-interactive-card" p={{ base: 5, md: 6 }}>
                    <HStack justify="space-between" mb={4}>
                      <Text color="var(--toss-ink)" fontSize="lg" fontWeight="bold">
                        내가 만든 아지트
                      </Text>
                      <Badge px={2} py={1} borderRadius="8px" bg="var(--toss-bg)" color="var(--toss-gray)">
                        {myCapsules.length}개
                      </Badge>
                    </HStack>
                    {myCapsules.length > 0 ? (
                      <VStack align="stretch" spacing={3}>
                        {myCapsules.map((capsule) => (
                          <Box key={capsule.id} p={4} borderRadius="16px" bg="white">
                            <HStack justify="space-between" align="start" gap={3}>
                              <Box minW={0}>
                                <Text color="var(--toss-ink)" fontSize="sm" fontWeight="800" noOfLines={1}>
                                  {capsule.title}
                                </Text>
                                <Text color="var(--toss-gray)" fontSize="xs" mt={1} noOfLines={1}>
                                  {capsule.category} · {formatDate(capsule.created_at)}
                                </Text>
                              </Box>
                              <Badge
                                px={2}
                                py={1}
                                borderRadius="8px"
                                bg={capsule.is_promoted ? 'var(--toss-blue-light)' : 'var(--toss-bg)'}
                                color={capsule.is_promoted ? 'var(--toss-blue)' : 'var(--toss-gray)'}
                                flexShrink={0}
                              >
                                {capsule.access_count || 0}/{capsule.access_limit || 0}
                              </Badge>
                            </HStack>
                          </Box>
                        ))}
                      </VStack>
                    ) : (
                      <Text color="var(--toss-gray)" fontSize="sm" lineHeight="1.6">
                        아직 직접 매설한 아지트가 없습니다.
                      </Text>
                    )}
                  </Box>
                </VStack>
              </GridItem>
            </Grid>

            <Flex justify={{ base: 'stretch', md: 'flex-end' }}>
              <Button
                h="52px"
                px={6}
                leftIcon={<FiLogOut />}
                variant="ghost"
                color="var(--toss-gray)"
                _hover={{ bg: 'var(--toss-bg)', color: 'var(--toss-ink)' }}
                onClick={handleLogout}
                borderRadius="12px"
                fontSize="md"
                fontWeight="600"
              >
                로그아웃
              </Button>
            </Flex>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
