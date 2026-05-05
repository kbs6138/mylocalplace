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
  Icon,
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
import {
  FiActivity,
  FiArrowLeft,
  FiCompass,
  FiLogOut,
  FiMap,
  FiTarget,
  FiTrendingUp,
  FiZap,
} from 'react-icons/fi';
import { motion } from 'framer-motion';
import { supabase } from '../supabaseClient';
import AtlasGlobe from './AtlasGlobe';

const MotionBox = motion.create(Box);

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
      center: ['50%', '55%'],
      radius: '58%',
      axisName: {
        color: '#687181',
        fontSize: 11,
        fontWeight: 700,
      },
      splitArea: {
        areaStyle: {
          color: ['rgba(37,99,235,0.04)', 'rgba(31,157,104,0.035)'],
        },
      },
      axisLine: {
        lineStyle: { color: 'rgba(21,26,36,0.10)' },
      },
      splitLine: {
        lineStyle: { color: 'rgba(21,26,36,0.10)' },
      },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: [85, 90, 75, 60, 95],
            name: '탐험 패턴',
            areaStyle: { color: 'rgba(37, 99, 235, 0.18)' },
            lineStyle: { color: '#2563EB', width: 2 },
            itemStyle: { color: '#2563EB' },
          },
        ],
      },
    ],
  };

  const membershipLabel = userProfile?.is_pro ? 'Pro 탐험가' : '기본 탐험가';
  const energy = userProfile?.energy ?? 0;
  const masterKeys = userProfile?.master_keys ?? 0;
  const discoveryCount = discoveries.length;
  const capsuleCount = myCapsules.length;
  const nextAction = discoveryCount
    ? {
        title: '최근 발견 기록 확인',
        description: `${discoveryCount}개의 발견 로그가 저장되어 있습니다.`,
      }
    : capsuleCount
      ? {
          title: '내 아지트 반응 확인',
          description: `${capsuleCount}개의 아지트가 지도에 남아 있습니다.`,
        }
      : {
          title: '첫 아지트 만들기',
          description: '지도 화면에서 새 좌표를 지정해 시작할 수 있습니다.',
        };
  const heroStats = [
    { key: 'energy', label: '에너지', value: energy, suffix: '%', icon: FiZap, tone: 'blue' },
    { key: 'keys', label: '마스터 키', value: masterKeys, suffix: '개', icon: FiCompass, tone: 'gold' },
    { key: 'discoveries', label: '발견', value: discoveryCount, suffix: '개', icon: FiTarget, tone: 'mint' },
    { key: 'capsules', label: '내 아지트', value: capsuleCount, suffix: '개', icon: FiMap, tone: 'coral' },
  ];
  const analysisStats = [
    { label: '개척성', val: 85, color: '#2563eb' },
    { label: '도전성', val: 90, color: '#7457d9' },
    { label: '희소성', val: 75, color: '#14a0b8' },
    { label: '야행성', val: 95, color: '#ef8a22' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="full" scrollBehavior="inside">
      <ModalOverlay bg="rgba(0,0,0,0.3)" backdropFilter="blur(6px)" />
      <ModalContent
        m={0}
        borderRadius={0}
        bg="var(--atlas-bg)"
      >
        <ModalHeader
          display="flex"
          alignItems="center"
          gap={3}
          px={{ base: 3, md: 6 }}
          py={3}
          borderBottom="1px solid"
          borderColor="var(--atlas-divider)"
          bg="var(--atlas-card)"
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
            color="var(--atlas-text)"
            _hover={{ bg: 'var(--atlas-bg)' }}
            display="flex"
            alignItems="center"
            gap={1}
            aria-label="대시보드 닫기"
          >
            <FiArrowLeft size={24} />
          </Button>
          <HStack spacing={3}>
            <span className="live-dot" />
            <Text color="var(--atlas-text)" fontSize="xl" fontWeight="700">
              내 탐험 상태
            </Text>
          </HStack>
        </ModalHeader>

        <ModalBody className="atlas-dashboard-page" px={{ base: 5, md: 8 }} py={{ base: 6, md: 8 }}>
          <VStack spacing={5} align="stretch" maxW="1120px" mx="auto">
            <Grid templateColumns={{ base: '1fr', lg: 'minmax(0, 1.45fr) 360px' }} gap={5} alignItems="stretch">
              <GridItem minW={0}>
                <MotionBox
                  className="atlas-dashboard-card atlas-dashboard-hero"
                  p={{ base: 6, md: 7 }}
                  minH={{ base: 'auto', md: '286px' }}
                  initial={{ opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Box className="atlas-dashboard-hero-globe">
                    <AtlasGlobe size={250} intensity={0.78} />
                  </Box>
                  <VStack align="stretch" spacing={7} position="relative" zIndex={1}>
                    <Flex direction={{ base: 'column', md: 'row' }} gap={5} justify="space-between">
                      <HStack align="start" spacing={4} minW={0}>
                        <Avatar
                          size="xl"
                          name={userProfile?.nickname || 'Explorer'}
                          src={userProfile?.avatar_url || ''}
                          bg="var(--atlas-primary-soft)"
                          color="var(--atlas-primary)"
                          border="1px solid rgba(255,255,255,0.24)"
                        />
                        <Box minW={0}>
                          <HStack spacing={2} align="center" mb={1}>
                            <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="800" color="white" noOfLines={1}>
                              {userProfile?.nickname || 'Explorer'}
                            </Text>
                            <Badge
                              px={2.5}
                              py={1}
                              borderRadius="8px"
                              bg={userProfile?.is_pro ? 'rgba(239,106,85,0.18)' : 'rgba(255,255,255,0.12)'}
                              color={userProfile?.is_pro ? '#ffb3a5' : 'rgba(255,255,255,0.78)'}
                              fontSize="xs"
                            >
                              {membershipLabel}
                            </Badge>
                          </HStack>
                          <Text color="rgba(255,255,255,0.72)" fontSize="sm" lineHeight="1.6" maxW="520px">
                            {userProfile?.is_pro
                              ? `구독 활성화${userProfile?.subscription_end ? ` · ${new Date(userProfile.subscription_end).toLocaleDateString()}까지` : ''}`
                              : '무료 탐험가 모드로 주변 아지트를 탐색 중입니다.'}
                          </Text>
                        </Box>
                      </HStack>

                      <Box className="atlas-dashboard-energy" minW={{ base: 'auto', md: '220px' }} p={4}>
                        <Flex justify="space-between" align="center" mb={2}>
                          <Text color="rgba(255,255,255,0.62)" fontSize="xs" fontWeight="800">
                            현재 에너지
                          </Text>
                          <Icon as={FiActivity} color="#8ff0bd" />
                        </Flex>
                        <Text color="white" fontSize="3xl" fontWeight="800" mb={3}>
                          {energy}%
                        </Text>
                        <Progress
                          value={energy}
                          h="8px"
                          borderRadius="full"
                          bg="rgba(255,255,255,0.16)"
                          sx={{ '& > div': { background: 'linear-gradient(90deg, #78a6ff, #71ddb0)' } }}
                        />
                      </Box>
                    </Flex>

                    <Grid templateColumns={{ base: '1fr 1fr', md: 'repeat(4, 1fr)' }} gap={3}>
                      {heroStats.map((stat) => (
                        <GridItem
                          key={stat.key}
                          className={`atlas-dashboard-hero-stat atlas-dashboard-hero-stat-${stat.tone}`}
                          p={4}
                        >
                          <Flex justify="space-between" align="center" mb={3}>
                            <Text color="rgba(255,255,255,0.62)" fontSize="xs" fontWeight="800">
                              {stat.label}
                            </Text>
                            <Icon as={stat.icon} color="rgba(255,255,255,0.72)" />
                          </Flex>
                          <Text color="white" fontSize="2xl" fontWeight="800">
                            {stat.value}
                            <Text as="span" fontSize="sm" fontWeight="700" ml={1} color="rgba(255,255,255,0.72)">
                              {stat.suffix}
                            </Text>
                          </Text>
                        </GridItem>
                      ))}
                    </Grid>
                  </VStack>
                </MotionBox>
              </GridItem>

              <GridItem minW={0}>
                <VStack spacing={5} align="stretch" h="100%">
                  <Box className="atlas-dashboard-card atlas-dashboard-side-card" p={5}>
                    <HStack justify="space-between" mb={4}>
                      <Text color="var(--atlas-text)" fontSize="md" fontWeight="800">
                        상태 요약
                      </Text>
                      <Badge className="atlas-quiet-badge">{membershipLabel}</Badge>
                    </HStack>
                    <VStack spacing={3} align="stretch">
                      {[
                        ['이용 플랜', membershipLabel],
                        ['보유 키', `${masterKeys}개`],
                        ['에너지 상태', `${energy}% 충전`],
                      ].map(([label, value]) => (
                        <Flex key={label} justify="space-between" align="center" className="atlas-dashboard-info-row">
                          <Text color="var(--atlas-muted-text)" fontSize="sm" fontWeight="650">
                            {label}
                          </Text>
                          <Text color="var(--atlas-text)" fontSize="sm" fontWeight="800">
                            {value}
                          </Text>
                        </Flex>
                      ))}
                    </VStack>
                  </Box>

                  <Box className="atlas-dashboard-card atlas-dashboard-next-card" p={5} flex="1">
                    <HStack justify="space-between" mb={3}>
                      <Text color="var(--atlas-primary)" fontSize="xs" fontWeight="900">
                        NEXT
                      </Text>
                      <Icon as={FiTrendingUp} color="var(--atlas-primary)" />
                    </HStack>
                    <Text color="var(--atlas-text)" fontSize="lg" fontWeight="850" mb={2}>
                      {nextAction.title}
                    </Text>
                    <Text color="var(--atlas-muted-text)" fontSize="sm" lineHeight="1.6" mb={5}>
                      {nextAction.description}
                    </Text>
                    <Button
                      size="sm"
                      h="40px"
                      className="atlas-primary-button"
                      onClick={onClose}
                      borderRadius="12px"
                    >
                      지도로 돌아가기
                    </Button>
                  </Box>
                </VStack>
              </GridItem>
            </Grid>

            <Grid templateColumns={{ base: '1fr', lg: '1.05fr 0.95fr' }} gap={5}>
              <GridItem>
                <MotionBox
                  className="atlas-dashboard-card atlas-analysis-card"
                  p={{ base: 5, md: 6 }}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  position="relative"
                  overflow="hidden"
                >
                  <HStack justify="space-between" mb={5}>
                    <HStack>
                      <Text color="var(--atlas-text)" fontSize="lg" fontWeight="bold">
                        탐험 성향 분석
                      </Text>
                    </HStack>
                    <Badge px={2.5} py={1} borderRadius="8px" bg="var(--atlas-primary-soft)" color="var(--atlas-primary)" fontWeight="800">
                      AI Preview
                    </Badge>
                  </HStack>

                  <Grid templateColumns={{ base: '1fr', md: 'minmax(0, 1fr) 260px' }} gap={5} alignItems="center">
                    <VStack align="stretch" spacing={3}>
                      {analysisStats.map((stat) => (
                        <Box key={stat.label} w="100%">
                          <Flex justify="space-between" mb={1.5}>
                            <Text fontSize="xs" color="var(--atlas-muted-text)" fontWeight="750">{stat.label}</Text>
                            <Text fontSize="xs" color={stat.color} fontWeight="850">{stat.val}%</Text>
                          </Flex>
                          <Box h="7px" bg="rgba(21,26,36,0.07)" borderRadius="full" overflow="hidden">
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

                    <Box className="atlas-radar-frame" h={{ base: '220px', md: '240px' }}>
                      <ReactECharts option={radarOption} style={{ height: '100%', width: '100%' }} />
                    </Box>
                  </Grid>
                </MotionBox>
              </GridItem>

              <GridItem>
                <VStack spacing={5} align="stretch">
                  <Box className="atlas-dashboard-card" p={{ base: 5, md: 6 }}>
                    <HStack justify="space-between" mb={4}>
                      <Text color="var(--atlas-text)" fontSize="lg" fontWeight="bold">
                        발견한 캡슐
                      </Text>
                      <FiMap size={20} color="var(--atlas-primary)" />
                    </HStack>
                    {discoveries.length > 0 ? (
                      <VStack align="stretch" spacing={3}>
                        {discoveries.map((item) => (
                          <Flex
                            className="atlas-dashboard-list-row"
                            key={item.id}
                            justify="space-between"
                            gap={3}
                            p={4}
                          >
                            <Box minW={0}>
                              <Text color="var(--atlas-text)" fontSize="sm" fontWeight="800" noOfLines={1}>
                                {item.capsule?.title || '삭제된 아지트'}
                              </Text>
                              <Text color="var(--atlas-muted-text)" fontSize="xs" mt={1} noOfLines={1}>
                                {formatDate(item.created_at)} · {item.capsule?.category || '카테고리 없음'}
                              </Text>
                            </Box>
                            <Badge
                              alignSelf="center"
                              px={2}
                              py={1}
                              borderRadius="8px"
                              bg="var(--atlas-primary-soft)"
                              color="var(--atlas-primary)"
                              flexShrink={0}
                            >
                              {formatMeters(item.distance_meters)}
                            </Badge>
                          </Flex>
                        ))}
                      </VStack>
                    ) : (
                      <Flex
                        className="atlas-empty-state"
                        minH="180px"
                        align="center"
                        justify="center"
                        direction="column"
                        textAlign="center"
                        px={6}
                      >
                        <Flex className="atlas-empty-icon" align="center" justify="center" mb={3}>
                          <FiMap size={20} />
                        </Flex>
                        <Text color="var(--atlas-muted-text)" fontSize="md" fontWeight="600" mb={1}>
                          발견 내역이 없습니다.
                        </Text>
                        <Text color="var(--atlas-faint-text)" fontSize="sm">
                          지도를 탐색해 아지트를 찾아보세요.
                        </Text>
                      </Flex>
                    )}
                  </Box>

                  <Box className="atlas-dashboard-card" p={{ base: 5, md: 6 }}>
                    <HStack justify="space-between" mb={4}>
                      <Text color="var(--atlas-text)" fontSize="lg" fontWeight="bold">
                        내가 만든 아지트
                      </Text>
                      <Badge px={2} py={1} borderRadius="8px" bg="var(--atlas-bg)" color="var(--atlas-muted-text)">
                        {myCapsules.length}개
                      </Badge>
                    </HStack>
                    {myCapsules.length > 0 ? (
                      <VStack align="stretch" spacing={3}>
                        {myCapsules.map((capsule) => (
                          <Box key={capsule.id} className="atlas-dashboard-list-row" p={4}>
                            <HStack justify="space-between" align="start" gap={3}>
                              <Box minW={0}>
                                <Text color="var(--atlas-text)" fontSize="sm" fontWeight="800" noOfLines={1}>
                                  {capsule.title}
                                </Text>
                                <Text color="var(--atlas-muted-text)" fontSize="xs" mt={1} noOfLines={1}>
                                  {capsule.category} · {formatDate(capsule.created_at)}
                                </Text>
                              </Box>
                              <Badge
                                px={2}
                                py={1}
                                borderRadius="8px"
                                bg={capsule.is_promoted ? 'var(--atlas-primary-soft)' : 'var(--atlas-bg)'}
                                color={capsule.is_promoted ? 'var(--atlas-primary)' : 'var(--atlas-muted-text)'}
                                flexShrink={0}
                              >
                                {capsule.access_count || 0}/{capsule.access_limit || 0}
                              </Badge>
                            </HStack>
                          </Box>
                        ))}
                      </VStack>
                    ) : (
                      <Flex className="atlas-empty-state" minH="116px" align="center" justify="center" direction="column" textAlign="center" px={6}>
                        <Flex className="atlas-empty-icon" align="center" justify="center" mb={3}>
                          <FiTarget size={20} />
                        </Flex>
                        <Text color="var(--atlas-muted-text)" fontSize="sm" fontWeight="650" lineHeight="1.6">
                          아직 직접 매설한 아지트가 없습니다.
                        </Text>
                      </Flex>
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
                color="var(--atlas-muted-text)"
                _hover={{ bg: 'var(--atlas-bg)', color: 'var(--atlas-text)' }}
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
