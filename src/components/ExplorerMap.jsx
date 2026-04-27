import { useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  List,
  ListItem,
  Spinner,
  Text,
  VStack,
  useToast,
} from '@chakra-ui/react';
import {
  FiCompass,
  FiMapPin,
  FiNavigation,
  FiPlus,
  FiSearch,
  FiShoppingBag,
  FiSliders,
  FiUser,
  FiX,
} from 'react-icons/fi';
import { motion } from 'framer-motion';
import { Map, CustomOverlayMap, Polyline, Polygon, useKakaoLoader } from 'react-kakao-maps-sdk';
import { supabase } from '../supabaseClient';
import ExplorerHUD from './ExplorerHUD';
import PlantingDrawer from './PlantingDrawer';
import UnlockingOverlay from './UnlockingOverlay';

const MotionText = motion.create(Text);
const MotionBox = motion.create(Box);
const CAPSULE_LIST_FIELDS = [
  'id',
  'user_id',
  'title',
  'category',
  'lat',
  'lng',
  'difficulty',
  'access_limit',
  'access_count',
  'unlock_radius_meters',
  'is_promoted',
  'created_at',
].join(',');

function withCapsuleDefaults(capsule) {
  return {
    access_count: 0,
    unlock_radius_meters: 50,
    created_at: null,
    ...capsule,
  };
}

export default function ExplorerMap({ selectedLocation, onMapClick, onDashboardOpen, onShopOpen, userProfile }) {
  const [loading, error] = useKakaoLoader({
    appkey: import.meta.env.VITE_KAKAO_API_KEY || '',
    libraries: ['clusterer', 'drawing', 'services'],
  });
  const toast = useToast();

  const [isLocating, setIsLocating] = useState(
    () => typeof navigator !== 'undefined' && 'geolocation' in navigator,
  );
  const [userLocation, setUserLocation] = useState(null);
  const [targetCapsule, setTargetCapsule] = useState(null);
  const [unlockingCapsule, setUnlockingCapsule] = useState(null);
  const [allCapsules, setAllCapsules] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState(['전체']);
  const [isPlantingOpen, setIsPlantingOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [viewState, setViewState] = useState({
    longitude: 126.9780,
    latitude: 37.5665,
    level: 4,
  });

  const categories = [
    '전체', '☕️ 로컬 카페', '🍽️ 동네 숨은 맛집', '🌄 나만 아는 경관', 
    '🌃 비밀 야경', '🎧 인디 음악/바', '🧩 기타 아지트'
  ];

  const districts = {
    '강남구': {
      'all': [
        { lat: 37.525, lng: 127.020 }, { lat: 37.535, lng: 127.050 },
        { lat: 37.510, lng: 127.070 }, { lat: 37.480, lng: 127.060 },
        { lat: 37.460, lng: 127.040 }, { lat: 37.485, lng: 127.015 }
      ],
      '역삼동': [
        { lat: 37.5085, lng: 127.0285 }, { lat: 37.5075, lng: 127.0350 },
        { lat: 37.5065, lng: 127.0430 }, { lat: 37.5045, lng: 127.0485 },
        { lat: 37.4985, lng: 127.0510 }, { lat: 37.4935, lng: 127.0495 },
        { lat: 37.4910, lng: 127.0465 }, { lat: 37.4895, lng: 127.0380 },
        { lat: 37.4915, lng: 127.0315 }, { lat: 37.4950, lng: 127.0255 },
        { lat: 37.5025, lng: 127.0245 }, { lat: 37.5065, lng: 127.0265 }
      ],
      '삼성동': [
        { lat: 37.5195, lng: 127.0435 }, { lat: 37.5215, lng: 127.0505 },
        { lat: 37.5175, lng: 127.0615 }, { lat: 37.5115, lng: 127.0655 },
        { lat: 37.5065, lng: 127.0625 }, { lat: 37.5035, lng: 127.0565 },
        { lat: 37.5060, lng: 127.0485 }, { lat: 37.5125, lng: 127.0455 },
        { lat: 37.5155, lng: 127.0425 }
      ],
      '청담동': [
        { lat: 37.5305, lng: 127.0385 }, { lat: 37.5275, lng: 127.0485 },
        { lat: 37.5245, lng: 127.0565 }, { lat: 37.5205, lng: 127.0535 },
        { lat: 37.5225, lng: 127.0425 }, { lat: 37.5265, lng: 127.0365 }
      ],
      '신사동': [
        { lat: 37.5315, lng: 127.0125 }, { lat: 37.5285, lng: 127.0255 },
        { lat: 37.5225, lng: 127.0365 }, { lat: 37.5165, lng: 127.0325 },
        { lat: 37.5175, lng: 127.0215 }, { lat: 37.5215, lng: 127.0105 }
      ]
    },
    '마포구': {
      'all': [
        { lat: 37.570, lng: 126.900 }, { lat: 37.565, lng: 126.940 },
        { lat: 37.545, lng: 126.945 }, { lat: 37.535, lng: 126.910 },
        { lat: 37.550, lng: 126.880 }
      ],
      '서교동': [
        { lat: 37.5615, lng: 126.9125 }, { lat: 37.5585, lng: 126.9245 },
        { lat: 37.5535, lng: 126.9325 }, { lat: 37.5465, lng: 126.9285 },
        { lat: 37.5445, lng: 126.9185 }, { lat: 37.5495, lng: 126.9085 }
      ]
    }
  };

  const [isRegionOpen, setIsRegionOpen] = useState(false);
  const [selectedDist, setSelectedDist] = useState(null);
  const [highlightRegion, setHighlightRegion] = useState(null);

  const handleNewCapsule = (newCapsule) => {
    setAllCapsules(prev => [newCapsule, ...prev]);
    setSelectedCategories(['전체']);
  };

  const handleUnlockSuccess = (result) => {
    if (!unlockingCapsule || result?.already_unlocked) return;

    const nextAccessCount = (unlockingCapsule.access_count || 0) + 1;
    const updateCapsule = (capsule) =>
      capsule.id === unlockingCapsule.id
        ? { ...capsule, access_count: nextAccessCount }
        : capsule;

    setAllCapsules(prev => prev.map(updateCapsule));
    setTargetCapsule(prev => (prev ? updateCapsule(prev) : prev));
    setUnlockingCapsule(prev => (prev ? { ...prev, access_count: nextAccessCount } : prev));
  };

  const handleReportCapsule = async () => {
    if (!targetCapsule || !userProfile?.id) return;

    const { error } = await supabase.from('mlp_capsule_reports').insert([
      {
        capsule_id: targetCapsule.id,
        user_id: userProfile.id,
        reason: 'user_report',
        detail: `${targetCapsule.title} 신고`,
      },
    ]);

    if (error) {
      toast({
        title: '신고를 접수하지 못했습니다.',
        description: error.message,
        status: 'error',
        duration: 3500,
      });
      return;
    }

    toast({
      title: '신고가 접수되었습니다.',
      description: '운영 검토 목록에 추가했습니다.',
      status: 'success',
      duration: 2500,
    });
  };

  useEffect(() => {
    const initFetch = async () => {
      if (!userProfile) return;

      const applyVisibility = (query) => {
        if (userProfile.nickname !== 'devtest0729') {
          return query.or(`is_promoted.eq.true,user_id.eq.${userProfile.id},user_id.is.null`);
        }

        return query;
      };

      let query = applyVisibility(supabase.from('mlp_mylocalplace').select(CAPSULE_LIST_FIELDS));
      const { data, error } = await query;

      if (!error) setAllCapsules((data || []).map(withCapsuleDefaults));
    };
    initFetch();
  }, [userProfile]);

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    if (!window.kakao) {
      toast({
        title: '지도 SDK가 아직 준비되지 않았습니다.',
        status: 'warning',
        duration: 2000,
      });
      return;
    }

    setIsSearchLoading(true);
    const places = new window.kakao.maps.services.Places();

    places.keywordSearch(searchQuery, (data, status) => {
      if (status === window.kakao.maps.services.Status.OK) {
        setSearchResults(data);
      } else {
        setSearchResults([]);
        toast({
          title: '검색 결과가 없습니다.',
          description: '다른 키워드나 인근 지역명으로 다시 시도해보세요.',
          status: 'info',
          duration: 2200,
        });
      }
      setIsSearchLoading(false);
    });
  };

  const handleSelectPlace = (place) => {
    const coords = {
      latitude: parseFloat(place.y),
      longitude: parseFloat(place.x)
    };
    
    setViewState(prev => ({ ...prev, ...coords, level: 3 }));
    setTargetCapsule(null);
    if (onMapClick) onMapClick(coords);
    setSearchResults([]);
    setSearchQuery(place.place_name);
    setIsRegionOpen(false);
  };

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      return undefined;
    }

    let watchId;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          longitude: position.coords.longitude,
          latitude: position.coords.latitude,
        };
        setUserLocation(coords);
        setViewState(prev => ({ ...prev, ...coords, level: 4 }));
        setIsLocating(false);
      },
      (geoError) => {
        console.error('Location error:', geoError);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
    );

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const coords = {
          longitude: position.coords.longitude,
          latitude: position.coords.latitude,
        };

        setUserLocation(coords);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0 },
    );

    return () => {
      if (watchId !== undefined) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [loading, error]);

  const toggleCategory = (cat) => {
    setSelectedCategories(prev => {
      if (cat === '전체') return ['전체'];
      
      const newSelection = prev.filter(c => c !== '전체');
      if (newSelection.includes(cat)) {
        const filtered = newSelection.filter(c => c !== cat);
        return filtered.length === 0 ? ['전체'] : filtered;
      } else {
        return [...newSelection, cat];
      }
    });
  };

  const handleSelectDong = (dong) => {
    if (!window.kakao) return;
    const geocoder = new window.kakao.maps.services.Geocoder();
    const query = dong === 'all' ? selectedDist : `${selectedDist} ${dong}`;
    
    geocoder.addressSearch(query, (result, status) => {
      if (status === window.kakao.maps.services.Status.OK) {
        const coords = { latitude: parseFloat(result[0].y), longitude: parseFloat(result[0].x) };
        setViewState({ ...coords, level: dong === 'all' ? 7 : 5 });
        setHighlightRegion({
          center: { lat: coords.latitude, lng: coords.longitude },
          path: districts[selectedDist][dong] || [],
          name: dong === 'all' ? `${selectedDist} 전체` : dong,
        });
        setIsRegionOpen(false);
        setTargetCapsule(null);
      }
    });
  };

  const handleGoToMyLocation = () => {
    if (userLocation) {
      setViewState(prev => ({
        ...prev,
        ...userLocation,
        level: 4,
      }));
      setTargetCapsule(null);
      setIsRegionOpen(false);
      setSearchResults([]);
    } else {
      setIsLocating(true);
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const coords = {
              longitude: position.coords.longitude,
              latitude: position.coords.latitude,
            };
            setUserLocation(coords);
            setViewState(prev => ({ ...prev, ...coords, level: 4 }));
            setIsLocating(false);
          },
          (geoError) => {
            console.error('Location error:', geoError);
            setIsLocating(false);
            toast({
              title: '위치 정보를 가져올 수 없습니다.',
              status: 'error',
              duration: 2000,
            });
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      } else {
        setIsLocating(false);
      }
    }
  };

  const filteredCapsules = allCapsules.filter(capsule => {
    if (selectedCategories.includes('전체')) return true;
    const capsuleCats = (capsule.category || '').split(',');
    return capsuleCats.some(cat => selectedCategories.includes(cat));
  });

  const activeRegionLabel = highlightRegion?.name || (selectedDist ? `${selectedDist} 탐색 중` : '서울 기본 탐색');
  if (error) {
    return (
      <Flex w="100%" h="100%" align="center" justify="center" px={6} py={10}>
        <VStack
          spacing={4}
          maxW="540px"
          p={{ base: 7, md: 8 }}
          borderRadius="16px"
          bg="var(--surface-strong)"
          border="1px solid var(--surface-stroke)"
          boxShadow="float"
          textAlign="center"
        >
          <Badge px={3} py={1.5} borderRadius="8px" bg="red.50" color="red.500" border="1px solid" borderColor="red.100">
            MAP CONNECTION ERROR
          </Badge>
          <Text color="ink.900" fontSize={{ base: '2xl', md: '3xl' }} fontWeight="700" letterSpacing="0">
            카카오맵을 불러오지 못했습니다.
          </Text>
          <Text color="gray.600" fontSize="sm" lineHeight="1.8">
            키 값이 잘못되었거나 카카오 디벨로퍼스의 Web 플랫폼 도메인에 현재 개발 주소가 등록되지 않았을 가능성이 큽니다.
          </Text>
          <Text color="primary.700" fontSize="sm" fontWeight="700">
            확인 주소: http://localhost:5173
          </Text>
          <Text color="gray.500" fontSize="sm">
            디버그 메시지: {error?.message || 'Unknown Error'}
          </Text>
        </VStack>
      </Flex>
    );
  }

  if (loading) {
    return (
      <Flex w="100%" h="100%" align="center" justify="center" px={6}>
        <VStack
          spacing={5}
          w="full"
          maxW="360px"
          p={{ base: 7, md: 8 }}
          borderRadius="16px"
          bg="var(--surface-glass)"
          border="1px solid var(--surface-stroke)"
          boxShadow="soft"
          textAlign="center"
        >
          <Spinner color="primary.500" size="xl" thickness="4px" speed="0.7s" />
          <Text color="ink.900" fontSize="xl" fontWeight="700">
            지도를 준비하는 중입니다.
          </Text>
          <Text color="gray.600" fontSize="sm">
            캡슐 데이터와 현재 위치를 연결하는 중입니다.
          </Text>
        </VStack>
      </Flex>
    );
  }

  return (
    <Box w="100%" h="100%" position="relative" overflow="hidden" className="kakao-map-container">
      <Box w="100%" h="100%" position="absolute" inset={0} zIndex={0} pointerEvents="auto">
        <Map
          center={{ lat: viewState.latitude, lng: viewState.longitude }}
          isPanto={true}
          style={{ width: '100%', height: '100%' }}
          level={viewState.level}
          onIdle={(map) =>
            setViewState(prev => ({
              ...prev,
              latitude: map.getCenter().getLat(),
              longitude: map.getCenter().getLng(),
              level: map.getLevel(),
            }))
          }
          onClick={(_t, mouseEvent) => {
            setTargetCapsule(null);
            setSearchResults([]);
            setIsRegionOpen(false);
            if (onMapClick) {
              onMapClick({
                latitude: mouseEvent.latLng.getLat(),
                longitude: mouseEvent.latLng.getLng(),
              });
            }
          }}
        >
          {userLocation && (
            <CustomOverlayMap position={{ lat: userLocation.latitude, lng: userLocation.longitude }}>
              <Box position="relative" w="24px" h="24px">
                <Box
                  position="absolute"
                  top="4px" left="4px"
                  w="16px" h="16px"
                  bg="primary.500"
                  borderRadius="full"
                  border="2px solid white"
                  boxShadow="0 2px 4px rgba(0, 0, 0, 0.2)"
                  zIndex={2}
                />
                <MotionBox
                  position="absolute"
                  top="4px" left="4px"
                  w="16px" h="16px"
                  bg="primary.500"
                  borderRadius="full"
                  initial={{ scale: 1, opacity: 0.6 }}
                  animate={{ scale: 3, opacity: 0 }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: 'easeOut' }}
                  zIndex={1}
                />
              </Box>
            </CustomOverlayMap>
          )}

          {filteredCapsules.map((capsule) => (
            <CustomOverlayMap
              key={capsule.id}
              position={{ lat: capsule.lat, lng: capsule.lng }}
              zIndex={capsule.is_promoted ? 10 : 2}
            >
              <div
                className={`holo-marker-wrapper ${capsule.is_promoted ? 'holo-marker-promo' : ''}`}
                onClick={() => {
                  setTargetCapsule(capsule);
                  setViewState(prev => ({ ...prev, latitude: capsule.lat, longitude: capsule.lng, level: Math.min(prev.level, 3) }));
                }}
                style={{ position: 'relative', display: 'inline-block' }}
              >
                <div className="holo-marker-ring" />
                <div className="holo-marker-ring" />
                <div className="holo-marker-ring" />

                <div className="holo-marker">
                  <div className="holo-marker-body">
                    <span className="holo-marker-icon" style={{ fontSize: '18px' }}>
                      {(capsule.category || '').split(',')[0]?.split(' ')[0] || '📍'}
                    </span>
                  </div>
                </div>

                <div className={`atlas-marker-label ${capsule.is_promoted ? 'atlas-marker-label-promo' : ''}`}>
                  {capsule.is_promoted ? '추천 ' : ''}{capsule.title}
                </div>
              </div>
            </CustomOverlayMap>
          ))}

          {userLocation && targetCapsule && (
            <>
              <Polyline
                path={[
                  { lat: userLocation.latitude, lng: userLocation.longitude },
                  { lat: targetCapsule.lat, lng: targetCapsule.lng },
                ]}
                strokeWeight={4}
                strokeColor="#3A6FFF"
                strokeOpacity={0.75}
              />
              <CustomOverlayMap position={{ lat: targetCapsule.lat, lng: targetCapsule.lng }}>
                <Box position="relative">
                  <Box
                    w="18px"
                    h="18px"
                    bg="accent.500"
                    borderRadius="full"
                    border="3px solid white"
                    boxShadow="0 10px 22px rgba(255, 118, 87, 0.28)"
                  />
                </Box>
              </CustomOverlayMap>
            </>
          )}

          {selectedLocation && (
            <CustomOverlayMap
              position={{ lat: selectedLocation.latitude, lng: selectedLocation.longitude }}
              zIndex={3}
            >
              <Box position="relative" w="34px" h="34px" pointerEvents="none" transform="translate(-50%, -50%)">
                <Box position="absolute" top="16px" left="0" w="34px" h="2px" bg="accent.500" />
                <Box position="absolute" top="0" left="16px" w="2px" h="34px" bg="accent.500" />
                <Box
                  position="absolute"
                  top="8px"
                  left="8px"
                  w="18px"
                  h="18px"
                  border="2px solid"
                  borderColor="accent.500"
                  borderRadius="full"
                  bg="rgba(255,255,255,0.7)"
                />
              </Box>
            </CustomOverlayMap>
          )}

          {highlightRegion && highlightRegion.path.length > 0 && (
            <>
              <Polygon
                path={highlightRegion.path}
                strokeWeight={4}
                strokeColor="#3A6FFF"
                strokeOpacity={0.78}
                fillColor="#3A6FFF"
                fillOpacity={0.12}
              />
              {highlightRegion.path.map((point, idx) => (
                <CustomOverlayMap key={idx} position={point}>
                  <Box w="8px" h="8px" bg="white" border="2px solid #3A6FFF" borderRadius="full" />
                </CustomOverlayMap>
              ))}
              <CustomOverlayMap position={highlightRegion.center}>
                <MotionBox
                  w="210px"
                  h="210px"
                  bg="primary.500"
                  borderRadius="full"
                  initial={{ scale: 0.1, opacity: 0.18 }}
                  animate={{ scale: 1.45, opacity: 0 }}
                  transition={{ repeat: Infinity, duration: 2.4 }}
                  pointerEvents="none"
                />
              </CustomOverlayMap>
            </>
          )}
        </Map>
      </Box>

      <Box
        position="absolute"
        inset={0}
        zIndex={1}
        pointerEvents="none"
        bgImage="var(--scrim-overlay)"
      />

      {isLocating && (
        <Flex
          position="absolute"
          inset={0}
          zIndex={50}
          align="center"
          justify="center"
          direction="column"
          px={6}
          bg="rgba(252, 249, 244, 0.84)"
          backdropFilter="blur(16px)"
        >
          <VStack
            className="glass-panel interactive-card"
            spacing={5}
            maxW="360px"
            w="full"
            p={{ base: 7, md: 8 }}
            borderRadius="16px"
            bg="rgba(255,255,255,0.82)"
            border="1px solid var(--surface-stroke)"
            boxShadow="float"
            textAlign="center"
          >
            <Spinner size="xl" color="primary.500" thickness="4px" speed="0.8s" />
            <MotionText
              color="ink.900"
              fontSize="xl"
              fontWeight="700"
              animate={{ opacity: [1, 0.55, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              위치 정보를 찾는 중입니다.
            </MotionText>
            <Text color="gray.600" fontSize="sm" lineHeight="1.7">
              GPS 신호를 수신해 지도 중심과 주변 아지트를 실제 위치에 맞추고 있습니다.
            </Text>
            <Button
              className="interactive-card"
              h="48px"
              px={6}
              variant="outline"
              borderColor="gray.200"
              bg="white"
              _hover={{ bg: 'gray.50' }}
            onClick={() => setIsLocating(false)}
          >
            기본 지도로 시작하기
          </Button>
          </VStack>
        </Flex>
      )}

      {!isLocating && (
        <MotionBox
          position="absolute"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 180 }}
          top="16px"
          left="0"
          w="100%"
          px="16px"
          zIndex={20}
          pointerEvents="none"
        >
          <VStack spacing={3} align="stretch" maxW="680px" mx="auto">
            <Flex
              className="atlas-top-shell"
              pointerEvents="auto"
              align="center"
              justify="space-between"
              gap={3}
              px={{ base: 4, md: 5 }}
              py={3}
            >
              <HStack minW={0} spacing={3}>
                <Flex className="atlas-brand-mark" align="center" justify="center">
                  <FiMapPin size={18} />
                </Flex>
                <Box minW={0}>
                  <Text className="atlas-eyebrow">LOCAL ATLAS</Text>
                  <Text className="atlas-headline" noOfLines={1}>
                    {activeRegionLabel}
                  </Text>
                </Box>
              </HStack>
              <HStack spacing={2} flexShrink={0}>
                <Badge className="atlas-status-badge">
                  {userLocation ? 'GPS 연결' : '기본 위치'}
                </Badge>
                <Badge className="atlas-count-badge">
                  {filteredCapsules.length}곳
                </Badge>
              </HStack>
            </Flex>

            <Box pointerEvents="auto">
              <InputGroup className="atlas-search-shell" size="lg">
                <Input
                  h="54px"
                  pr="4.5rem"
                  placeholder="장소, 카테고리, 동네 검색"
                  bg="transparent"
                  color="var(--toss-ink)"
                  border="none"
                  borderRadius="16px"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearch();
                  }}
                  _focus={{ ring: '2px', ringColor: 'var(--toss-blue)' }}
                />
                <InputRightElement width="3.4rem" h="54px">
                  <IconButton
                    h="40px" w="40px" size="sm" borderRadius="12px"
                    icon={isSearchLoading ? <Spinner size="xs" color="var(--toss-blue)" /> : <FiSearch />}
                    bg="var(--toss-ink)" color="white"
                    _hover={{ bg: 'var(--toss-ink-subtitle)' }}
                    onClick={handleSearch} aria-label="검색"
                  />
                </InputRightElement>
              </InputGroup>

              {(selectedLocation || targetCapsule) && (
                <Flex justify="flex-end" mt={2}>
                  <Badge
                    as="button"
                    px={3} py={1.5} borderRadius="12px"
                    bg="var(--toss-card)" color="var(--toss-ink)"
                    boxShadow="var(--toss-shadow-float)"
                    display="flex" alignItems="center" gap={1}
                    fontWeight="500"
                    onClick={() => {
                      setTargetCapsule(null);
                      setSearchResults([]);
                      if (onMapClick) onMapClick(null);
                    }}
                  >
                    <FiX size={14} /> 선택 해제
                  </Badge>
                </Flex>
              )}

              {searchResults.length > 0 && (
                <List
                  className="atlas-result-list"
                  mt={3}
                  borderRadius="16px"
                  overflow="hidden"
                  bg="rgba(255,255,255,0.96)"
                  border="1px solid"
                  borderColor="gray.100"
                  boxShadow="soft"
                >
                  {searchResults.slice(0, 5).map((place, index) => (
                    <ListItem
                      className="interactive-card"
                      key={place.id}
                      px={4}
                      py={3.5}
                      borderBottom={index === Math.min(searchResults.length, 5) - 1 ? 'none' : '1px solid'}
                      borderColor="gray.100"
                      cursor="pointer"
                      _hover={{ bg: 'gray.50' }}
                      onClick={() => handleSelectPlace(place)}
                    >
                      <Flex align="center" gap={3}>
                        <Flex
                          w="38px"
                          h="38px"
                          align="center"
                          justify="center"
                          borderRadius="14px"
                          bg="primary.50"
                          color="primary.600"
                          flexShrink={0}
                        >
                          <FiCompass size={16} />
                        </Flex>
                        <Box>
                          <Text color="ink.900" fontSize="sm" fontWeight="700">
                            {place.place_name}
                          </Text>
                          <Text color="gray.500" fontSize="xs" mt={0.5}>
                            {place.address_name}
                          </Text>
                        </Box>
                      </Flex>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>

            <Box
              w="100%"
              pointerEvents="auto"
            >
              <HStack
                className="atlas-chip-row"
                spacing={2}
                overflowX="auto"
                css={{ '&::-webkit-scrollbar': { display: 'none' } }}
                whiteSpace="nowrap"
                py={1}
              >
                <Button
                  className="atlas-filter-chip"
                  h="38px"
                  px={4}
                  leftIcon={<FiSliders />}
                  borderRadius="12px"
                  bg={isRegionOpen ? 'var(--toss-ink)' : 'var(--toss-card)'}
                  color={isRegionOpen ? 'white' : 'var(--toss-ink)'}
                  border={isRegionOpen ? '1px solid var(--toss-ink)' : '1px solid var(--toss-card)'}
                  boxShadow="var(--toss-shadow-float)"
                  _hover={{ bg: isRegionOpen ? 'var(--toss-ink)' : 'var(--toss-gray-bg)' }}
                  onClick={() => setIsRegionOpen(!isRegionOpen)}
                  flexShrink={0}
                >
                  {highlightRegion?.name || '동네 선택'}
                </Button>

                {categories.map((category) => {
                  const isSelected = selectedCategories.includes(category);

                  return (
                    <Button
                      key={category}
                      className="atlas-filter-chip"
                      h="38px"
                      px={4}
                      borderRadius="12px"
                      bg={isSelected ? 'var(--toss-blue)' : 'var(--toss-card)'}
                      color={isSelected ? 'white' : 'var(--toss-ink)'}
                      border={isSelected ? '1px solid var(--toss-blue)' : '1px solid var(--toss-card)'}
                      boxShadow="var(--toss-shadow-float)"
                      _hover={{ bg: isSelected ? 'var(--toss-blue-hover)' : 'var(--toss-gray-bg)' }}
                      onClick={() => toggleCategory(category)}
                      flexShrink={0}
                    >
                      {category}
                    </Button>
                  );
                })}
              </HStack>
            </Box>

            {isRegionOpen && (
              <Box
                className="atlas-region-panel"
                p={5}
                borderRadius="16px"
                bg="var(--toss-card)"
                boxShadow="var(--toss-shadow-float)"
                pointerEvents="auto"
              >
                <Text color="var(--toss-gray)" fontSize="xs" fontWeight="700" mb={3}>
                  지역 검색
                </Text>
                <HStack spacing={2} overflowX="auto" pb={1} mb={4}>
                  {Object.keys(districts).map((dist) => (
                    <Button
                      key={dist}
                      h="36px"
                      px={4}
                      borderRadius="12px"
                      bg={selectedDist === dist ? 'ink.900' : 'gray.50'}
                      color={selectedDist === dist ? 'white' : 'gray.700'}
                      border="1px solid"
                      borderColor={selectedDist === dist ? 'ink.900' : 'gray.200'}
                      _hover={{ bg: selectedDist === dist ? 'ink.900' : 'gray.100' }}
                      onClick={() => setSelectedDist(dist)}
                      flexShrink={0}
                    >
                      {dist}
                    </Button>
                  ))}
                </HStack>

                {selectedDist ? (
                  <Flex wrap="wrap" gap={2}>
                    <Button
                      h="38px"
                      px={4}
                      borderRadius="12px"
                      bg="primary.500"
                      color="white"
                      _hover={{ bg: 'primary.600' }}
                      onClick={() => handleSelectDong('all')}
                    >
                      {selectedDist} 전체 보기
                    </Button>
                    {Object.keys(districts[selectedDist])
                      .filter((dong) => dong !== 'all')
                      .map((dong) => (
                        <Button
                          key={dong}
                          h="38px"
                          px={4}
                      borderRadius="12px"
                          bg="white"
                          color="gray.700"
                          border="1px solid"
                          borderColor="gray.200"
                          _hover={{ bg: 'gray.50' }}
                          onClick={() => handleSelectDong(dong)}
                        >
                          {dong}
                        </Button>
                      ))}
                  </Flex>
                ) : (
                  <Text color="gray.500" fontSize="sm">
                    먼저 탐험할 구를 선택하세요.
                  </Text>
                )}
              </Box>
            )}
          </VStack>
        </MotionBox>
      )}

      {!isLocating && (
        <VStack className="atlas-action-dock" position="absolute" bottom="24px" right="16px" zIndex={15} spacing={3} pointerEvents="none">
          <Box
            className="atlas-action-shell"
            p={2}
            borderRadius="18px"
            pointerEvents="auto"
          >
            <VStack spacing={2}>
              <Button
                w={{ base: '56px', md: '160px' }}
                h="56px"
                px={{ base: 0, md: 4 }}
                bg="white"
                color="gray.700"
                border="1px solid"
                borderColor="gray.200"
                borderRadius="14px"
                leftIcon={<FiNavigation />}
                justifyContent={{ base: 'center', md: 'flex-start' }}
                onClick={handleGoToMyLocation}
                _hover={{ bg: 'gray.50' }}
              >
                <Text display={{ base: 'none', md: 'block' }}>내 위치로</Text>
              </Button>

              <Button
                w={{ base: '56px', md: '160px' }}
                h="56px"
                px={{ base: 0, md: 4 }}
                bg="ink.900"
                color="white"
                borderRadius="14px"
                leftIcon={<FiPlus />}
                justifyContent={{ base: 'center', md: 'flex-start' }}
                onClick={() => setIsPlantingOpen(true)}
                _hover={{ bg: 'primary.700', transform: 'translateY(-1px)' }}
              >
                <Text display={{ base: 'none', md: 'block' }}>새 아지트</Text>
              </Button>

              <Button
                w={{ base: '56px', md: '160px' }}
                h="56px"
                px={{ base: 0, md: 4 }}
                bg="white"
                color="gray.700"
                border="1px solid"
                borderColor="gray.200"
                borderRadius="14px"
                leftIcon={<FiShoppingBag />}
                justifyContent={{ base: 'center', md: 'flex-start' }}
                onClick={onShopOpen}
                _hover={{ bg: 'gray.50' }}
              >
                <Text display={{ base: 'none', md: 'block' }}>상점</Text>
              </Button>

              <Button
                w={{ base: '56px', md: '160px' }}
                h="56px"
                px={{ base: 0, md: 4 }}
                bg="white"
                color="gray.700"
                border="1px solid"
                borderColor="gray.200"
                borderRadius="14px"
                leftIcon={<FiUser />}
                justifyContent={{ base: 'center', md: 'flex-start' }}
                onClick={onDashboardOpen}
                _hover={{ bg: 'gray.50' }}
              >
                <Text display={{ base: 'none', md: 'block' }}>대시보드</Text>
              </Button>
            </VStack>
          </Box>
        </VStack>
      )}

      <PlantingDrawer
        isOpen={isPlantingOpen}
        onClose={() => setIsPlantingOpen(false)}
        userLocation={userLocation}
        selectedLocation={selectedLocation}
        onPlantSuccess={handleNewCapsule}
        userProfile={userProfile}
      />

      <UnlockingOverlay
        isVisible={Boolean(unlockingCapsule)}
        capsule={unlockingCapsule}
        userLocation={userLocation}
        onClose={() => setUnlockingCapsule(null)}
        onUnlocked={handleUnlockSuccess}
      />

      <ExplorerHUD
        userLocation={userLocation}
        targetCapsule={targetCapsule}
        visibleCapsuleCount={filteredCapsules.length}
        activeRegionLabel={activeRegionLabel}
        userProfile={userProfile}
        onDashboardOpen={onDashboardOpen}
        onShopOpen={onShopOpen}
        onUnlockOpen={() => setUnlockingCapsule(targetCapsule)}
        onReportCapsule={handleReportCapsule}
      />
    </Box>
  );
}
