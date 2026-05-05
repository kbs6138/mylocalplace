import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  List,
  ListItem,
  Select,
  Spinner,
  Text,
  VStack,
  useToast,
} from '@chakra-ui/react';
import {
  FiCompass,
  FiActivity,
  FiMenu,
  FiMapPin,
  FiNavigation,
  FiPlus,
  FiSearch,
  FiShoppingBag,
  FiSliders,
  FiUser,
  FiX,
} from 'react-icons/fi';
import { AnimatePresence, motion } from 'framer-motion';
import { Map, CustomOverlayMap, Polyline, Polygon, useKakaoLoader } from 'react-kakao-maps-sdk';
import { supabase } from '../supabaseClient';
import ExplorerHUD from './ExplorerHUD';
import PlantingDrawer from './PlantingDrawer';
import UnlockingOverlay from './UnlockingOverlay';

const MotionText = motion.create(Text);
const MotionBox = motion.create(Box);
const MotionButton = motion.create(Button);
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

function indexRegions(regions, byAddress) {
  regions.forEach((region) => {
    byAddress.set(region.address, region);
    if (region.children) indexRegions(region.children, byAddress);
  });
}

function createRegionCatalog(regions) {
  const byAddress = new globalThis.Map();
  indexRegions(regions, byAddress);
  return { roots: regions, byAddress, isLoaded: true };
}

function getRegionChildren(regionCatalog, path, level) {
  if (level === 0) return regionCatalog.roots;
  const parent = regionCatalog.byAddress.get(path[level - 1]);
  return parent?.children || [];
}

function getRegionPath(addressName, byAddress) {
  if (!addressName) return [];

  const parts = addressName.split(/\s+/).filter(Boolean);
  const path = [];
  let current = '';

  parts.forEach((part) => {
    const next = current ? `${current} ${part}` : part;
    if (byAddress.has(next)) {
      path.push(next);
      current = next;
    }
  });

  return path;
}

function getRegionColumnLabel(options, level) {
  if (level === 0) return '시/도';
  if (options.some((option) => /[시군구]$/.test(option.name))) return '시/군/구';
  if (options.some((option) => /[읍면동가로]$/.test(option.name))) return '읍/면/동';
  return '리';
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
  const [isHudSheetCollapsed, setIsHudSheetCollapsed] = useState(true);
  const [unlockingCapsule, setUnlockingCapsule] = useState(null);
  const [allCapsules, setAllCapsules] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState(['전체']);
  const [isPlantingOpen, setIsPlantingOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [mapInstance, setMapInstance] = useState(null);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const glideTimeoutRef = useRef(null);
  const glideSettleTimeoutRef = useRef(null);
  const hudCollapseSuppressTimeoutRef = useRef(null);
  const suppressHudCollapseRef = useRef(false);
  const lastRegionLookupRef = useRef(null);
  const [viewState, setViewState] = useState({
    longitude: 126.9780,
    latitude: 37.5665,
    level: 4,
  });
  const viewLevelRef = useRef(4);

  useEffect(() => {
    viewLevelRef.current = viewState.level;
  }, [viewState.level]);

  const categories = [
    '전체', '☕️ 로컬 카페', '🍽️ 동네 숨은 맛집', '🌄 나만 아는 경관', 
    '🌃 비밀 야경', '🎧 인디 음악/바', '🧩 기타 아지트'
  ];

  const [isRegionOpen, setIsRegionOpen] = useState(false);
  const [regionCatalog, setRegionCatalog] = useState(() => ({ roots: [], byAddress: new globalThis.Map(), isLoaded: false }));
  const [selectedRegionPath, setSelectedRegionPath] = useState([]);
  const [currentRegion, setCurrentRegion] = useState(null);
  const [highlightRegion, setHighlightRegion] = useState(null);

  const glideTo = useCallback(
    (coords, nextLevel, options = {}) => {
      const currentLevel = viewLevelRef.current;
      const targetLevel = nextLevel ?? currentLevel;

      if (glideTimeoutRef.current) {
        window.clearTimeout(glideTimeoutRef.current);
      }
      if (glideSettleTimeoutRef.current) {
        window.clearTimeout(glideSettleTimeoutRef.current);
      }

      if (hudCollapseSuppressTimeoutRef.current) {
        window.clearTimeout(hudCollapseSuppressTimeoutRef.current);
      }

      suppressHudCollapseRef.current = Boolean(options.keepHudOpen);
      hudCollapseSuppressTimeoutRef.current = window.setTimeout(() => {
        suppressHudCollapseRef.current = false;
      }, 900);

      if (mapInstance && window.kakao?.maps) {
        const targetLatLng = new window.kakao.maps.LatLng(coords.latitude, coords.longitude);
        const moveToTarget = () => {
          mapInstance.relayout();
          mapInstance.panTo(targetLatLng);
          setViewState(prev => ({
            ...prev,
            latitude: coords.latitude,
            longitude: coords.longitude,
            level: targetLevel,
          }));
          viewLevelRef.current = targetLevel;
        };

        const scheduleSettledFocus = () => {
          if (!options.visibleCenter) return;

          glideSettleTimeoutRef.current = window.setTimeout(() => {
            moveToTarget();
          }, 360);
        };

        if (targetLevel !== currentLevel) {
          mapInstance.panTo(targetLatLng);

          glideTimeoutRef.current = window.setTimeout(() => {
            mapInstance.setLevel(targetLevel, {
              anchor: targetLatLng,
              animate: { duration: 350 },
            });
            moveToTarget();
            scheduleSettledFocus();
          }, 140);

          return;
        }

        glideTimeoutRef.current = window.setTimeout(() => {
          moveToTarget();
          scheduleSettledFocus();
        }, targetLevel !== currentLevel ? 200 : 0);
      } else {
        // mapInstance 없을 때 fallback
        setViewState(prev => ({
          ...prev,
          latitude: coords.latitude,
          longitude: coords.longitude,
          level: targetLevel,
        }));
      }
    },
    [mapInstance],
  );

  useEffect(() => {
    return () => {
      if (glideTimeoutRef.current) {
        window.clearTimeout(glideTimeoutRef.current);
      }
      if (glideSettleTimeoutRef.current) {
        window.clearTimeout(glideSettleTimeoutRef.current);
      }
      if (hudCollapseSuppressTimeoutRef.current) {
        window.clearTimeout(hudCollapseSuppressTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    import('../data/koreaLegalRegions.json').then((module) => {
      if (!isMounted) return;
      setRegionCatalog(createRegionCatalog(module.default));
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!regionCatalog.isLoaded || !currentRegion?.addressName || currentRegion.path?.length > 0) return;

    const administrativePath = getRegionPath(currentRegion.addressName, regionCatalog.byAddress);
    const legalPath = getRegionPath(currentRegion.legalAddressName, regionCatalog.byAddress);
    const path = legalPath.length > administrativePath.length ? legalPath : administrativePath;

    if (path.length > 0) {
      setCurrentRegion((prev) => (prev ? { ...prev, path } : prev));
    }
  }, [currentRegion, regionCatalog]);

  const resolveCurrentRegion = useCallback((coords, syncSelection = false) => {
    if (!window.kakao?.maps?.services) return;

    const geocoder = new window.kakao.maps.services.Geocoder();

    geocoder.coord2RegionCode(coords.longitude, coords.latitude, (result, status) => {
      if (status !== window.kakao.maps.services.Status.OK || !result?.length) return;

      const administrativeRegion = result.find((region) => region.region_type === 'H');
      const legalRegion = result.find((region) => region.region_type === 'B') || result[0];
      const region = administrativeRegion || legalRegion;
      const administrativePath = getRegionPath(region.address_name, regionCatalog.byAddress);
      const legalPath = getRegionPath(legalRegion.address_name, regionCatalog.byAddress);
      const path = legalPath.length > administrativePath.length ? legalPath : administrativePath;

      setCurrentRegion({
        addressName: region.address_name,
        legalAddressName: legalRegion.address_name,
        code: region.code,
        path,
      });

      if (syncSelection && path.length > 0) {
        setSelectedRegionPath(path);
        setHighlightRegion({
          center: { lat: coords.latitude, lng: coords.longitude },
          path: [],
          name: region.address_name,
        });
      }
    });
  }, [regionCatalog.byAddress]);

  const maybeRefreshCurrentRegion = useCallback(
    (coords, syncSelection = false) => {
      const last = lastRegionLookupRef.current;
      const movedEnough = !last
        || Math.abs(last.latitude - coords.latitude) > 0.00025
        || Math.abs(last.longitude - coords.longitude) > 0.00025;

      if (!movedEnough && !syncSelection) return;

      lastRegionLookupRef.current = coords;
      resolveCurrentRegion(coords, syncSelection);
    },
    [resolveCurrentRegion],
  );

  const focusRegion = useCallback(
    (region, depth) => {
      if (!region || !window.kakao?.maps?.services) return;

      const geocoder = new window.kakao.maps.services.Geocoder();

      geocoder.addressSearch(region.address, (result, status) => {
        if (status !== window.kakao.maps.services.Status.OK || !result?.length) {
          toast({
            title: '선택한 지역의 지도 좌표를 찾지 못했습니다.',
            status: 'warning',
            duration: 2200,
          });
          return;
        }

        const coords = {
          latitude: parseFloat(result[0].y),
          longitude: parseFloat(result[0].x),
        };
        const nextLevel = depth <= 1 ? 10 : depth === 2 ? 7 : depth === 3 ? 5 : 4;

        glideTo(coords, nextLevel);
        setHighlightRegion({
          center: { lat: coords.latitude, lng: coords.longitude },
          path: [],
          name: region.address,
        });
        setTargetCapsule(null);
        setIsHudSheetCollapsed(true);
        setSearchResults([]);
      });
    },
    [glideTo, toast],
  );

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
    
    glideTo(coords, 3);
    setTargetCapsule(null);
    setIsHudSheetCollapsed(true);
    if (onMapClick) onMapClick(coords);
    setSearchResults([]);
    setSearchQuery(place.place_name);
    setIsRegionOpen(false);
  };

  useEffect(() => {
    if (loading || error || !('geolocation' in navigator)) {
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
        glideTo(coords, 4);
        maybeRefreshCurrentRegion(coords, true);
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
        maybeRefreshCurrentRegion(coords);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0 },
    );

    return () => {
      if (watchId !== undefined) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [loading, error, glideTo, maybeRefreshCurrentRegion]);

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

  const handleSelectRegion = (level, address) => {
    const nextPath = address ? [...selectedRegionPath.slice(0, level), address] : selectedRegionPath.slice(0, level);
    setSelectedRegionPath(nextPath);

    if (!address) {
      setHighlightRegion(null);
      setIsHudSheetCollapsed(true);
      return;
    }

    const region = regionCatalog.byAddress.get(address);
    focusRegion(region, level + 1);

    if (!region?.children?.length) {
      setIsRegionOpen(false);
    }
  };

  const handleGoToMyLocation = () => {
    if (userLocation) {
      glideTo(userLocation, 4);
      maybeRefreshCurrentRegion(userLocation, true);
      setTargetCapsule(null);
      setIsHudSheetCollapsed(true);
      setIsRegionOpen(false);
      setSearchResults([]);
      setIsActionMenuOpen(false);
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
            glideTo(coords, 4);
            maybeRefreshCurrentRegion(coords, true);
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

  const activeRegionLabel = highlightRegion?.name || currentRegion?.addressName || (userLocation ? '내 위치 탐색 중' : '국내 기본 탐색');
  const activeRegionSubline = currentRegion?.addressName
    ? `${currentRegion.addressName} 기준`
    : userLocation
      ? '실시간 위치 기반 탐색'
      : '국내 행정구역 선택 탐색';
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
          isPanto={false}
          style={{ width: '100%', height: '100%' }}
          level={viewState.level}
          draggable
          scrollwheel
          onCreate={(map) => setMapInstance(map)}
          onIdle={(map) =>
            setViewState(prev => ({
              ...prev,
              latitude: map.getCenter().getLat(),
              longitude: map.getCenter().getLng(),
              level: map.getLevel(),
            }))
          }
          onDragStart={() => setIsHudSheetCollapsed(true)}
          onZoomChanged={() => {
            if (!suppressHudCollapseRef.current) {
              setIsHudSheetCollapsed(true);
            }
          }}
          onClick={(_t, mouseEvent) => {
            setTargetCapsule(null);
            setIsHudSheetCollapsed(true);
            setSearchResults([]);
            setIsRegionOpen(false);
            setIsActionMenuOpen(false);
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
                onClick={(event) => {
                  event.stopPropagation();
                  setTargetCapsule(capsule);
                  setIsHudSheetCollapsed(false);
                  glideTo(
                    { latitude: capsule.lat, longitude: capsule.lng },
                    Math.min(viewLevelRef.current, 3),
                    { keepHudOpen: true },
                  );
                }}
                onMouseDown={(event) => event.stopPropagation()}
                onTouchStart={(event) => event.stopPropagation()}
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
          bg="rgba(247, 246, 241, 0.82)"
          backdropFilter="blur(16px)"
        >
          <VStack
            className="atlas-hud-card"
            spacing={5}
            maxW="360px"
            w="full"
            p={{ base: 7, md: 8 }}
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
                  <Text className="atlas-subline" noOfLines={1}>
                    {activeRegionSubline}
                  </Text>
                </Box>
              </HStack>
              <HStack spacing={2} flexShrink={0}>
                <Badge className="atlas-status-badge">
                  {userLocation ? 'GPS LIVE' : 'BASIC'}
                </Badge>
                <Badge className="atlas-count-badge">
                  {filteredCapsules.length}곳
                </Badge>
              </HStack>
            </Flex>

            <Box pointerEvents="auto">
              <InputGroup className="atlas-search-shell" size="lg">
                <InputLeftElement h="54px" pointerEvents="none">
                  <FiSearch color="var(--atlas-muted-text)" size={18} />
                </InputLeftElement>
                <Input
                  h="54px"
                  pl="3.1rem"
                  pr="4.5rem"
                  placeholder="장소, 카테고리, 동네 검색"
                  bg="transparent"
                  color="var(--atlas-text)"
                  border="none"
                  borderRadius="16px"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearch();
                  }}
                  _focus={{ ring: '2px', ringColor: 'var(--atlas-primary)' }}
                />
                <InputRightElement width="3.4rem" h="54px">
                  <IconButton
                    h="40px" w="40px" size="sm" borderRadius="12px"
                    icon={isSearchLoading ? <Spinner size="xs" color="white" /> : <FiActivity />}
                    bg="var(--atlas-text)" color="white"
                    _hover={{ bg: 'var(--atlas-text-subtle)' }}
                    onClick={handleSearch} aria-label="검색"
                  />
                </InputRightElement>
              </InputGroup>

              {(selectedLocation || targetCapsule) && (
                <Flex justify="flex-end" mt={2}>
                  <Badge
                    as="button"
                    px={3} py={1.5} borderRadius="12px"
                    bg="var(--atlas-card)" color="var(--atlas-text)"
                    boxShadow="var(--atlas-shadow-float)"
                    display="flex" alignItems="center" gap={1}
                    fontWeight="500"
                    onClick={() => {
                      setTargetCapsule(null);
                      setIsHudSheetCollapsed(true);
                      setSearchResults([]);
                      if (onMapClick) onMapClick(null);
                    }}
                  >
                    <FiX size={14} /> 선택 해제
                  </Badge>
                </Flex>
              )}

              <AnimatePresence>
                {searchResults.length > 0 && (
                  <MotionBox
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  >
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
                              className="atlas-result-icon"
                              w="38px"
                              h="38px"
                              align="center"
                              justify="center"
                              borderRadius="12px"
                              bg="primary.50"
                              color="primary.600"
                              flexShrink={0}
                            >
                              <FiCompass size={16} />
                            </Flex>
                            <Box minW={0}>
                              <Text color="ink.900" fontSize="sm" fontWeight="700" noOfLines={1}>
                                {place.place_name}
                              </Text>
                              <Text color="gray.500" fontSize="xs" mt={0.5} noOfLines={1}>
                                {place.address_name}
                              </Text>
                            </Box>
                          </Flex>
                        </ListItem>
                      ))}
                    </List>
                  </MotionBox>
                )}
              </AnimatePresence>
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
                  bg={isRegionOpen ? 'var(--atlas-text)' : 'var(--atlas-card)'}
                  color={isRegionOpen ? 'white' : 'var(--atlas-text)'}
                  border={isRegionOpen ? '1px solid var(--atlas-text)' : '1px solid var(--atlas-card)'}
                  boxShadow="var(--atlas-shadow-float)"
                  _hover={{ bg: isRegionOpen ? 'var(--atlas-text)' : 'var(--atlas-muted-bg)' }}
                  onClick={() => setIsRegionOpen(!isRegionOpen)}
                  flexShrink={0}
                >
                  {highlightRegion?.name || currentRegion?.addressName || '동네 선택'}
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
                      bg={isSelected ? 'var(--atlas-primary)' : 'var(--atlas-card)'}
                      color={isSelected ? 'white' : 'var(--atlas-text)'}
                      border={isSelected ? '1px solid var(--atlas-primary)' : '1px solid var(--atlas-card)'}
                      boxShadow="var(--atlas-shadow-float)"
                      _hover={{ bg: isSelected ? 'var(--atlas-primary-hover)' : 'var(--atlas-muted-bg)' }}
                      onClick={() => toggleCategory(category)}
                      flexShrink={0}
                    >
                      {category}
                    </Button>
                  );
                })}
              </HStack>
            </Box>

            <AnimatePresence>
              {isRegionOpen && (
                <MotionBox
                  className="atlas-region-panel"
                  p={5}
                  borderRadius="16px"
                  bg="var(--atlas-card)"
                  boxShadow="var(--atlas-shadow-float)"
                  pointerEvents="auto"
                  initial={{ opacity: 0, y: -12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.98 }}
                  transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                >
                <Flex align="center" justify="space-between" gap={3} mb={4}>
                  <Box>
                    <Text color="var(--atlas-muted-text)" fontSize="xs" fontWeight="800">
                      국내 동네 선택
                    </Text>
                  </Box>
                  {currentRegion?.path?.length > 0 && (
                    <Button
                      h="34px"
                      px={3}
                      borderRadius="10px"
                      bg="var(--atlas-mint-soft)"
                      color="var(--atlas-mint)"
                      fontSize="sm"
                      fontWeight="800"
                      _hover={{ bg: 'var(--atlas-mint-soft)' }}
                      onClick={() => {
                        setSelectedRegionPath(currentRegion.path);
                        focusRegion(regionCatalog.byAddress.get(currentRegion.path[currentRegion.path.length - 1]), currentRegion.path.length);
                      }}
                    >
                      현 위치 반영
                    </Button>
                  )}
                </Flex>

                <Flex gap={2.5} wrap={{ base: 'wrap', md: 'nowrap' }}>
                  {[0, 1, 2, 3, 4].map((level) => {
                    const options = getRegionChildren(regionCatalog, selectedRegionPath, level);
                    const isDisabled = level > 0 && !selectedRegionPath[level - 1];
                    const selectedValue = selectedRegionPath[level] || '';
                    const label = regionCatalog.isLoaded ? getRegionColumnLabel(options, level) : '불러오는 중';

                    return (
                      <Select
                        key={level}
                        className="atlas-region-select"
                        minW={{ base: 'calc(50% - 5px)', md: '0' }}
                        flex="1"
                        h="42px"
                        borderRadius="12px"
                        bg="white"
                        color={selectedValue ? 'gray.800' : 'gray.500'}
                        borderColor="gray.200"
                        fontSize="sm"
                        fontWeight="700"
                        value={selectedValue}
                        isDisabled={isDisabled || options.length === 0}
                        onChange={(event) => handleSelectRegion(level, event.target.value)}
                      >
                        <option value="">{label}</option>
                        {options.map((region) => (
                          <option key={region.address} value={region.address}>
                            {region.name}
                          </option>
                        ))}
                      </Select>
                    );
                  })}
                </Flex>

                {selectedRegionPath.length > 0 && (
                  <Flex align="center" justify="space-between" gap={3} mt={4}>
                    <Text color="gray.500" fontSize="sm" noOfLines={1}>
                      {selectedRegionPath[selectedRegionPath.length - 1]}
                    </Text>
                    <Button
                      h="36px"
                      px={4}
                      borderRadius="12px"
                      bg="var(--atlas-text)"
                      color="white"
                      fontSize="sm"
                      _hover={{ bg: 'var(--atlas-text-subtle)' }}
                      onClick={() => {
                        setSelectedRegionPath([]);
                        setHighlightRegion(null);
                        setIsHudSheetCollapsed(true);
                      }}
                    >
                      초기화
                    </Button>
                  </Flex>
                )}
                </MotionBox>
              )}
            </AnimatePresence>
          </VStack>
        </MotionBox>
      )}

      {/* 내 위치 바로가기 - 독립 플로팅 버튼 */}
      {!isLocating && (
        <MotionBox
          position="absolute"
          bottom={{ base: '200px', md: '120px' }}
          right="16px"
          zIndex={20}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 18, stiffness: 260, delay: 0.15 }}
        >
          <Button
            className="atlas-action-menu-button"
            w="52px"
            h="52px"
            p={0}
            bg="white"
            color="gray.700"
            border="1px solid"
            borderColor="gray.200"
            borderRadius="16px"
            boxShadow="0 4px 16px rgba(0,0,0,0.12)"
            onClick={handleGoToMyLocation}
            _hover={{ bg: 'gray.50', transform: 'scale(1.08)', boxShadow: '0 6px 20px rgba(0,0,0,0.18)' }}
            _active={{ transform: 'scale(0.95)' }}
            transition="all 0.18s ease"
            aria-label="내 위치로 이동"
          >
            <FiNavigation size={20} />
          </Button>
        </MotionBox>
      )}

      {/* 햄버거 액션 메뉴 */}
      {!isLocating && (
        <Box
          position="absolute"
          bottom={{ base: '136px', md: '48px' }}
          right="16px"
          zIndex={20}
          style={{ position: 'absolute' }}
        >
          {/* 펼쳐진 메뉴 아이템들 - 햄버거 버튼 위로 순서대로 */}
          <AnimatePresence>
          {isActionMenuOpen && [
            { icon: <FiUser size={20} />, label: '대시보드', onClick: () => { onDashboardOpen(); setIsActionMenuOpen(false); }, bg: 'white', color: 'gray.700' },
            { icon: <FiShoppingBag size={20} />, label: '상점', onClick: () => { onShopOpen(); setIsActionMenuOpen(false); }, bg: 'white', color: 'gray.700' },
            { icon: <FiPlus size={20} />, label: '새 아지트', onClick: () => { setIsPlantingOpen(true); setIsActionMenuOpen(false); }, bg: 'ink.900', color: 'white' },
          ].map((item, index) => (
            <MotionBox
              key={item.label}
              position="absolute"
              bottom={`${(index + 1) * 64}px`}
              right="0"
              initial={{ scale: 0.5, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 320, delay: index * 0.055 }}
              exit={{ scale: 0.8, opacity: 0, y: 12 }}
              display="flex"
              alignItems="center"
              gap="8px"
              justifyContent="flex-end"
              style={{ pointerEvents: 'auto' }}
            >
              {/* 레이블 툴팁 */}
              <MotionBox
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.055 + 0.1 }}
                bg="rgba(20,20,30,0.85)"
                backdropFilter="blur(10px)"
                color="white"
                fontSize="12px"
                fontWeight="700"
                px={3}
                py={1.5}
                borderRadius="10px"
                whiteSpace="nowrap"
                pointerEvents="none"
                boxShadow="0 2px 10px rgba(0,0,0,0.2)"
                letterSpacing="0.01em"
              >
                {item.label}
              </MotionBox>
              <Button
                className="atlas-action-menu-button"
                w="52px"
                h="52px"
                p={0}
                bg={item.bg}
                color={item.color}
                border={item.bg === 'white' ? '1px solid' : 'none'}
                borderColor="gray.200"
                borderRadius="16px"
                boxShadow="0 4px 18px rgba(0,0,0,0.15)"
                onClick={item.onClick}
                _hover={{ transform: 'scale(1.1)', boxShadow: '0 6px 24px rgba(0,0,0,0.22)' }}
                _active={{ transform: 'scale(0.93)' }}
                transition="all 0.16s ease"
              >
                {item.icon}
              </Button>
            </MotionBox>
          ))}
          </AnimatePresence>

          {/* 햄버거/닫기 토글 버튼 */}
          <Button
            className="atlas-action-menu-button"
            w="52px"
            h="52px"
            p={0}
            bg={isActionMenuOpen ? 'ink.900' : 'white'}
            color={isActionMenuOpen ? 'white' : 'gray.700'}
            border={isActionMenuOpen ? 'none' : '1px solid'}
            borderColor="gray.200"
            borderRadius="16px"
            boxShadow={isActionMenuOpen
              ? '0 8px 28px rgba(20,20,40,0.35)'
              : '0 4px 16px rgba(0,0,0,0.12)'}
            onClick={() => setIsActionMenuOpen(prev => !prev)}
            _hover={{ transform: 'scale(1.08)' }}
            _active={{ transform: 'scale(0.94)' }}
            transition="all 0.2s cubic-bezier(0.34,1.56,0.64,1)"
            aria-label={isActionMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
          >
            <MotionBox
              animate={{ rotate: isActionMenuOpen ? 135 : 0 }}
              transition={{ type: 'spring', damping: 18, stiffness: 280 }}
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              {isActionMenuOpen ? <FiX size={22} /> : <FiMenu size={22} />}
            </MotionBox>
          </Button>
        </Box>
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
        isSheetCollapsed={isHudSheetCollapsed}
        onSheetToggle={() => setIsHudSheetCollapsed((prev) => !prev)}
      />
    </Box>
  );
}
