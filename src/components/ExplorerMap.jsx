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
import {
  CAPSULE_CATEGORY_FILTERS,
  getCapsuleCategories,
  getCapsuleCategoryIcon,
} from '../utils/capsuleCategories';

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
const GEOLOCATION_OPTIONS = { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 };
const LOCATION_ERROR_TOAST_ID = 'location-error';
const IP_LOCATION_TIMEOUT_MS = 6000;

function isGeolocationAvailable() {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

function getGeolocationErrorMessage(error) {
  if (!isGeolocationAvailable()) {
    return {
      title: '위치 기능을 사용할 수 없습니다.',
      description: 'HTTPS 환경이나 Android 앱에서 다시 시도해주세요.',
    };
  }

  if (error?.code === error?.PERMISSION_DENIED) {
    return {
      title: '위치 권한이 꺼져 있습니다.',
      description: '브라우저나 앱 설정에서 위치 권한을 허용한 뒤 다시 눌러주세요.',
    };
  }

  if (error?.code === error?.TIMEOUT) {
    return {
      title: '위치 신호를 찾지 못했습니다.',
      description: '기기의 위치 서비스가 켜져 있는지 확인하고 잠시 후 다시 시도해주세요.',
    };
  }

  return {
    title: '위치 정보를 가져올 수 없습니다.',
    description: '기기의 위치 서비스가 켜져 있는지 확인한 뒤 다시 시도해주세요.',
  };
}

async function fetchIpJson(url) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), IP_LOCATION_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch (ipError) {
    console.error('IP location lookup error:', ipError);
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function getIpLocationEstimate() {
  const ipApiResult = await fetchIpJson('https://ipapi.co/json/');
  const ipApiLatitude = Number(ipApiResult?.latitude);
  const ipApiLongitude = Number(ipApiResult?.longitude);

  if (Number.isFinite(ipApiLatitude) && Number.isFinite(ipApiLongitude)) {
    return {
      latitude: ipApiLatitude,
      longitude: ipApiLongitude,
      label: ipApiResult.city || ipApiResult.region || 'IP 기반 위치',
    };
  }

  const ipWhoisResult = await fetchIpJson('https://ipwho.is/');
  const ipWhoisLatitude = Number(ipWhoisResult?.latitude);
  const ipWhoisLongitude = Number(ipWhoisResult?.longitude);

  if (ipWhoisResult?.success !== false && Number.isFinite(ipWhoisLatitude) && Number.isFinite(ipWhoisLongitude)) {
    return {
      latitude: ipWhoisLatitude,
      longitude: ipWhoisLongitude,
      label: ipWhoisResult.city || ipWhoisResult.region || 'IP 기반 위치',
    };
  }

  return null;
}

function withCapsuleDefaults(capsule) {
  return {
    access_count: 0,
    unlock_radius_meters: 50,
    created_at: null,
    ...capsule,
  };
}

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

function getSheetFocusCenter(coords, level) {
  const zoomFactor = Math.max(1, 2 ** (level - 3));
  // 하단 카드가 열린 상태에서도 선택한 마커가 카드 위쪽 지도 영역에 남도록 중심을 살짝 아래로 둡니다.
  const latitudeOffset = Math.min(0.018, 0.0024 * zoomFactor);

  return {
    latitude: coords.latitude - latitudeOffset,
    longitude: coords.longitude,
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

function getCompactRegionLabel(addressName) {
  if (!addressName) return '동네';

  const parts = addressName.split(/\s+/).filter(Boolean);
  if (parts.length >= 4) return parts.slice(-2).join(' ');
  if (parts.length >= 2) return parts.slice(-2).join(' ');
  return addressName;
}

function getRegionColumnLabel(options, level) {
  if (level === 0) return '시/도';
  if (options.some((option) => /[시군구]$/.test(option.name))) return '시/군/구';
  if (options.some((option) => /[읍면동가로]$/.test(option.name))) return '읍/면/동';
  return '리';
}

export default function ExplorerMap({ selectedLocation, onMapClick, onDashboardOpen, userProfile }) {
  const [loading, error] = useKakaoLoader({
    appkey: import.meta.env.VITE_KAKAO_API_KEY || '',
    libraries: ['clusterer', 'drawing', 'services'],
  });
  const toast = useToast();

  const [isLocating, setIsLocating] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [targetCapsule, setTargetCapsule] = useState(null);
  const [isHudSheetCollapsed, setIsHudSheetCollapsed] = useState(true);
  const [unlockingCapsule, setUnlockingCapsule] = useState(null);
  const [allCapsules, setAllCapsules] = useState([]);
  const [isCapsuleLoading, setIsCapsuleLoading] = useState(true);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const [isLocationWatchActive, setIsLocationWatchActive] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState(['전체']);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
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

  const categories = CAPSULE_CATEGORY_FILTERS;
  const categorySummary = selectedCategories.includes('전체')
    ? '카테고리'
    : selectedCategories.length === 1
      ? selectedCategories[0]
      : `${selectedCategories[0]} 외 ${selectedCategories.length - 1}`;

  const [isRegionOpen, setIsRegionOpen] = useState(false);
  const [regionCatalog, setRegionCatalog] = useState(() => ({ roots: [], byAddress: new globalThis.Map(), isLoaded: false }));
  const [selectedRegionPath, setSelectedRegionPath] = useState([]);
  const [currentRegion, setCurrentRegion] = useState(null);
  const [highlightRegion, setHighlightRegion] = useState(null);

  const glideTo = useCallback(
    (coords, nextLevel, options = {}) => {
      const currentLevel = viewLevelRef.current;
      const targetLevel = nextLevel ?? currentLevel;
      const centerCoords = options.focusForSheet ? getSheetFocusCenter(coords, targetLevel) : coords;

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
        const centerLatLng = new window.kakao.maps.LatLng(centerCoords.latitude, centerCoords.longitude);
        const moveToTarget = () => {
          mapInstance.relayout();
          mapInstance.panTo(centerLatLng);
          setViewState(prev => ({
            ...prev,
            latitude: centerCoords.latitude,
            longitude: centerCoords.longitude,
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
          mapInstance.panTo(centerLatLng);

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
          latitude: centerCoords.latitude,
          longitude: centerCoords.longitude,
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
    // 새로 만든 캡슐은 즉시 지도에 반영해 사용자가 생성 결과를 바로 확인하게 합니다.
    setAllCapsules(prev => [newCapsule, ...prev]);
    setSelectedCategories(['전체']);
  };

  const handleUnlockSuccess = (result) => {
    if (!unlockingCapsule || result?.already_unlocked) return;

    // RPC 성공 이후에만 열람 수를 로컬 반영합니다. 숨김 메시지는 목록 데이터에 저장하지 않습니다.
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

  const handleUpdateCapsule = async (capsuleId, patch) => {
    if (!userProfile?.id) return false;

    const title = patch.title?.trim() || '';
    const category = patch.category?.trim() || '';

    // 사용자가 직접 만든 캡슐의 공개 정보만 수정합니다. 숨겨진 메시지와 좌표는 여기서 건드리지 않습니다.
    if (title.length < 2) {
      toast({
        title: '캡슐 이름은 2자 이상 입력해주세요.',
        status: 'warning',
        duration: 2200,
      });
      return false;
    }

    if (!category) {
      toast({
        title: '카테고리를 선택해주세요.',
        status: 'warning',
        duration: 2200,
      });
      return false;
    }

    const { data, error } = await supabase
      .from('mlp_mylocalplace')
      .update({ title, category })
      .eq('id', capsuleId)
      .eq('user_id', userProfile.id)
      .select(CAPSULE_LIST_FIELDS)
      .single();

    if (error) {
      toast({
        title: '캡슐 정보를 수정하지 못했습니다.',
        description: error.message,
        status: 'error',
        duration: 3500,
      });
      return false;
    }

    const updatedCapsule = withCapsuleDefaults(data);
    setAllCapsules(prev => prev.map(capsule => (capsule.id === capsuleId ? updatedCapsule : capsule)));
    setTargetCapsule(prev => (prev?.id === capsuleId ? updatedCapsule : prev));

    toast({
      title: '캡슐 정보가 수정되었습니다.',
      status: 'success',
      duration: 2200,
    });
    return true;
  };

  useEffect(() => {
    const initFetch = async () => {
      if (!userProfile) return;
      setIsCapsuleLoading(true);

      const applyVisibility = (query) => {
        if (userProfile.nickname !== 'devtest0729') {
          return query.or(`is_promoted.eq.true,user_id.eq.${userProfile.id},user_id.is.null`);
        }

        return query;
      };

      let query = applyVisibility(supabase.from('mlp_mylocalplace').select(CAPSULE_LIST_FIELDS));
      const { data, error } = await query;

      if (!error) setAllCapsules((data || []).map(withCapsuleDefaults));
      setIsCapsuleLoading(false);
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

  const applyUserPosition = useCallback(
    (position, options = {}) => {
      const coords = {
        longitude: position.coords.longitude,
        latitude: position.coords.latitude,
        source: 'gps',
      };

      setUserLocation(coords);
      setLocationPermissionDenied(false);
      setIsLocationWatchActive(true);

      if (options.centerMap) {
        glideTo(coords, 4);
      }

      maybeRefreshCurrentRegion(coords, Boolean(options.syncRegion));
      return coords;
    },
    [glideTo, maybeRefreshCurrentRegion],
  );

  const moveToIpLocationEstimate = useCallback(async () => {
    const estimatedLocation = await getIpLocationEstimate();
    if (!estimatedLocation) return false;

    const coords = {
      longitude: estimatedLocation.longitude,
      latitude: estimatedLocation.latitude,
      source: 'ip',
    };

    setUserLocation(coords);
    setIsLocationWatchActive(false);
    glideTo(coords, 4);
    maybeRefreshCurrentRegion(coords, true);
    setTargetCapsule(null);
    setIsHudSheetCollapsed(true);
    setIsRegionOpen(false);
    setSearchResults([]);
    setIsActionMenuOpen(false);

    toast({
      title: 'IP 기반 대략 위치로 이동했습니다.',
      description: `${estimatedLocation.label} 근처로 지도를 맞췄습니다. 현장 인증에는 GPS 위치 권한이 필요합니다.`,
      status: 'info',
      duration: 3600,
      isClosable: true,
    });

    return true;
  }, [glideTo, maybeRefreshCurrentRegion, toast]);

  useEffect(() => {
    if (loading || error || !isGeolocationAvailable() || !navigator.permissions?.query) {
      return undefined;
    }

    let isMounted = true;

    void navigator.permissions.query({ name: 'geolocation' }).then((permission) => {
      if (!isMounted || permission.state !== 'granted') return;

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!isMounted) return;
          applyUserPosition(position, { centerMap: true, syncRegion: true });
        },
        (geoError) => {
          console.error('Location error:', geoError);
          if (geoError?.code === geoError?.PERMISSION_DENIED) {
            setLocationPermissionDenied(true);
          }
        },
        GEOLOCATION_OPTIONS,
      );
    }).catch((geoError) => {
      console.error('Location permission query error:', geoError);
    });

    return () => {
      isMounted = false;
    };
  }, [loading, error, applyUserPosition]);

  useEffect(() => {
    if (loading || error || !isLocationWatchActive || !isGeolocationAvailable()) {
      return undefined;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        applyUserPosition(position);
      },
      (geoError) => {
        console.error('Watch position error:', geoError);
        if (geoError?.code === geoError?.PERMISSION_DENIED) {
          setLocationPermissionDenied(true);
          setIsLocationWatchActive(false);
        }
      },
      GEOLOCATION_OPTIONS,
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [loading, error, isLocationWatchActive, applyUserPosition]);

  const showLocationErrorToast = useCallback(
    (geoError) => {
      const message = getGeolocationErrorMessage(geoError);
      if (!toast.isActive(LOCATION_ERROR_TOAST_ID)) {
        toast({
          id: LOCATION_ERROR_TOAST_ID,
          ...message,
          status: 'error',
          duration: 3200,
          isClosable: true,
        });
      }
    },
    [toast],
  );

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
      return;
    }

    if (!isGeolocationAvailable()) {
      setLocationPermissionDenied(false);
      setIsLocating(true);
      void moveToIpLocationEstimate().then((didMove) => {
        setIsLocating(false);
        if (!didMove) {
          showLocationErrorToast();
        }
      });
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        applyUserPosition(position, { centerMap: true, syncRegion: true });
        setIsLocating(false);
        setTargetCapsule(null);
        setIsHudSheetCollapsed(true);
        setIsRegionOpen(false);
        setSearchResults([]);
        setIsActionMenuOpen(false);
      },
      async (geoError) => {
        console.error('Location error:', geoError);
        setLocationPermissionDenied(geoError?.code === geoError?.PERMISSION_DENIED);
        setIsLocationWatchActive(false);
        const didMove = await moveToIpLocationEstimate();
        setIsLocating(false);
        if (!didMove) {
          showLocationErrorToast(geoError);
        }
      },
      GEOLOCATION_OPTIONS,
    );
  };

  const filteredCapsules = allCapsules
    .filter(capsule => {
      if (selectedCategories.includes('전체')) return true;
      const capsuleCats = getCapsuleCategories(capsule.category);
      return capsuleCats.some(cat => selectedCategories.includes(cat));
    })
    .sort((a, b) => {
      // 공식 추천 캡슐을 먼저 보여주고, 위치가 있으면 가까운 순으로 정렬합니다.
      if (a.is_promoted !== b.is_promoted) return a.is_promoted ? -1 : 1;

      if (userLocation) {
        const aDistance = getDistanceFromLatLonInMeters(userLocation.latitude, userLocation.longitude, a.lat, a.lng);
        const bDistance = getDistanceFromLatLonInMeters(userLocation.latitude, userLocation.longitude, b.lat, b.lng);
        if (aDistance !== bDistance) return aDistance - bDistance;
      }

      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

  const selectedRegionLabel = highlightRegion?.name || currentRegion?.addressName;
  const activeRegionLabel = selectedRegionLabel || (userLocation ? '내 위치 탐색 중' : '국내 기본 탐색');
  const regionControlLabel = getCompactRegionLabel(selectedRegionLabel);
  const gpsUserLocation = userLocation?.source === 'ip' ? null : userLocation;
  const shouldShowMapControls = isHudSheetCollapsed || !targetCapsule;
  if (error) {
    return (
      <Box
        w="100%"
        h="100%"
        position="relative"
        overflow="hidden"
        bg="linear-gradient(135deg, #f7fbff 0%, #eef8f4 48%, #fff7ed 100%)"
        className="kakao-map-container"
      >
        <Box
          position="absolute"
          inset={0}
          opacity={0.6}
          bg="repeating-linear-gradient(0deg, rgba(37,99,235,0.12) 0 1px, transparent 1px 42px), repeating-linear-gradient(90deg, rgba(31,157,104,0.10) 0 1px, transparent 1px 42px)"
        />
        <Box position="absolute" inset={0} bg="radial-gradient(circle at 50% 45%, rgba(37,99,235,0.15), transparent 34%), radial-gradient(circle at 62% 56%, rgba(31,157,104,0.18), transparent 28%)" />

        {[
          { left: '48%', top: '36%', label: '성수 감성 루트' },
          { left: '58%', top: '45%', label: '한강 야경 캡슐' },
          { left: '43%', top: '54%', label: '골목 카페 힌트' },
        ].map((pin) => (
          <Box key={pin.label} position="absolute" left={pin.left} top={pin.top} transform="translate(-50%, -50%)">
            <Flex align="center" gap={2}>
              <Flex
                w="38px"
                h="38px"
                align="center"
                justify="center"
                borderRadius="14px 14px 14px 4px"
                transform="rotate(-45deg)"
                bg="var(--atlas-primary)"
                color="white"
                boxShadow="0 16px 34px rgba(37, 99, 235, 0.28)"
              >
                <Box transform="rotate(45deg)">
                  <FiMapPin size={18} />
                </Box>
              </Flex>
              <Badge px={3} py={1.5} borderRadius="999px" bg="whiteAlpha.900" color="var(--atlas-text)" boxShadow="sm">
                {pin.label}
              </Badge>
            </Flex>
          </Box>
        ))}

        <Flex position="absolute" inset="24px 24px auto 24px" justify="space-between" align="flex-start" gap={3}>
          <Box className="atlas-hud-card" p={4} maxW="360px">
            <Text className="atlas-eyebrow">LOCAL ATLAS</Text>
            <Text color="var(--atlas-text)" fontSize="2xl" fontWeight="800" lineHeight="1.2" mt={2}>
              데모 지도로 탐험을 시작합니다
            </Text>
            <Text color="var(--atlas-muted-text)" fontSize="sm" lineHeight="1.7" mt={3}>
              카카오맵 설정 전에도 포트폴리오 화면 흐름을 확인할 수 있습니다.
            </Text>
          </Box>

          <Button
            leftIcon={<FiUser />}
            h="48px"
            px={5}
            borderRadius="14px"
            bg="white"
            color="var(--atlas-text)"
            boxShadow="var(--atlas-shadow-soft)"
            onClick={onDashboardOpen}
            _hover={{ bg: 'var(--atlas-bg)' }}
          >
            내 상태
          </Button>
        </Flex>
      </Box>
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
                  if (onMapClick) onMapClick(null);
                  setIsHudSheetCollapsed(false);
                  setIsActionMenuOpen(false);
                  glideTo(
                    { latitude: capsule.lat, longitude: capsule.lng },
                    Math.min(viewLevelRef.current, 3),
                    { keepHudOpen: true, focusForSheet: true },
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
                      {getCapsuleCategoryIcon(capsule.category)}
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
              GPS 신호를 수신해 지도 중심과 주변 캡슐을 실제 위치에 맞추고 있습니다.
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

      {!isLocating && shouldShowMapControls && (
        <MotionBox
          className="atlas-map-controls"
          position="absolute"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 180 }}
          top={{ base: '8px', md: '18px' }}
          left="0"
          w="100%"
          px={{ base: '12px', sm: '16px', lg: '24px' }}
          zIndex={24}
          pointerEvents="none"
        >
          <VStack spacing={{ base: 2, md: 3 }} align="stretch" maxW={{ base: '100%', md: '704px', lg: '760px' }} mx="auto">
            <Box className="atlas-search-panel" pointerEvents="auto">
              <Flex className="atlas-discovery-bar" align="stretch" gap={{ base: 1.5, md: 2 }}>
                <InputGroup className="atlas-search-shell atlas-search-field" size="lg" flex="1" minW={0}>
                  <InputLeftElement h={{ base: '42px', md: '46px' }} pointerEvents="none">
                    <FiSearch color="var(--atlas-muted-text)" size={18} />
                  </InputLeftElement>
                  <Input
                    h={{ base: '42px', md: '46px' }}
                    pl="3.1rem"
                    pr={{ base: 3, md: 4 }}
                    placeholder="장소, 동네 검색"
                    bg="transparent"
                    color="var(--atlas-text)"
                    border="none"
                    borderRadius="14px"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSearch();
                    }}
                    _focus={{ boxShadow: 'none' }}
                  />
                </InputGroup>

                <HStack className="atlas-discovery-actions" spacing={2}>
                  <Button
                    className="atlas-control-pill atlas-region-pill"
                    h={{ base: '42px', md: '46px' }}
                    px={{ base: 3, md: 3.5 }}
                    leftIcon={<FiSliders />}
                    bg={isRegionOpen ? 'var(--atlas-text)' : 'var(--atlas-card)'}
                    color={isRegionOpen ? 'white' : 'var(--atlas-text)'}
                    onClick={() => {
                      setIsRegionOpen(!isRegionOpen);
                      setIsCategoryOpen(false);
                    }}
                    flex={{ base: 1, md: 'initial' }}
                    title={selectedRegionLabel || '동네 선택'}
                  >
                    <Text as="span" className="atlas-control-pill-label">
                      {regionControlLabel}
                    </Text>
                  </Button>
                  <Button
                    className="atlas-control-pill atlas-category-pill"
                    h={{ base: '42px', md: '46px' }}
                    px={{ base: 3, md: 3.5 }}
                    bg={isCategoryOpen ? 'var(--atlas-primary)' : 'var(--atlas-card)'}
                    color={isCategoryOpen ? 'white' : 'var(--atlas-text)'}
                    onClick={() => {
                      setIsCategoryOpen(!isCategoryOpen);
                      setIsRegionOpen(false);
                    }}
                    flex={{ base: 1, md: 'initial' }}
                  >
                    <Text as="span" className="atlas-control-pill-label">
                      {categorySummary}
                    </Text>
                  </Button>
                  <IconButton
                    className="atlas-search-submit"
                    h={{ base: '42px', md: '46px' }}
                    w={{ base: '42px', md: '46px' }}
                    icon={isSearchLoading ? <Spinner size="xs" color="white" /> : <FiActivity />}
                    bg="var(--atlas-text)"
                    color="white"
                    _hover={{ bg: 'var(--atlas-text-subtle)' }}
                    onClick={handleSearch}
                    aria-label="검색"
                  />
                </HStack>
              </Flex>

              <AnimatePresence>
                {isCategoryOpen && (
                  <MotionBox
                    className="atlas-category-tray"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <HStack
                      className="atlas-chip-row"
                      spacing={2}
                      overflowX="auto"
                      css={{ '&::-webkit-scrollbar': { display: 'none' } }}
                      whiteSpace="nowrap"
                      py={{ base: 1, md: 1.5 }}
                    >
                      {categories.map((category) => {
                        const isSelected = selectedCategories.includes(category);

                        return (
                          <Button
                            key={category}
                            className="atlas-filter-chip"
                            h="36px"
                            px={{ base: 3, md: 4 }}
                            borderRadius="12px"
                            bg={isSelected ? 'var(--atlas-primary)' : 'var(--atlas-card)'}
                            color={isSelected ? 'white' : 'var(--atlas-text)'}
                            border={isSelected ? '1px solid var(--atlas-primary)' : '1px solid var(--atlas-border)'}
                            boxShadow="none"
                            _hover={{ bg: isSelected ? 'var(--atlas-primary-hover)' : 'var(--atlas-muted-bg)' }}
                            onClick={() => toggleCategory(category)}
                            flexShrink={0}
                          >
                            {category}
                          </Button>
                        );
                      })}
                    </HStack>
                  </MotionBox>
                )}
              </AnimatePresence>

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

            {!isCapsuleLoading && filteredCapsules.length === 0 && !isRegionOpen && (
              <Box
                className="atlas-map-empty-state"
                pointerEvents="none"
              >
                <Text color="var(--atlas-text)" fontSize={{ base: 'sm', md: 'md' }} fontWeight="800" mb={1}>
                  아직 이 지역에 공개 캡슐이 없습니다.
                </Text>
                <Text color="var(--atlas-muted-text)" fontSize={{ base: 'xs', md: 'sm' }} lineHeight="1.6">
                  지도에서 다른 지역을 검색하거나 첫 캡슐을 만들어보세요.
                </Text>
              </Box>
            )}

            {isCapsuleLoading && (
              <HStack
                className="atlas-map-loading-state"
                pointerEvents="none"
              >
                <Spinner size="sm" color="primary.500" />
                <Text color="var(--atlas-muted-text)" fontSize="sm" fontWeight="700">
                  캡슐을 불러오는 중입니다.
                </Text>
              </HStack>
            )}
          </VStack>
        </MotionBox>
      )}

      {!isLocating && locationPermissionDenied && (
        <Box position="absolute" left="16px" right="16px" bottom={{ base: '206px', md: '122px' }} zIndex={19} pointerEvents="none">
          <Box
            maxW="520px"
            mx="auto"
            px={4}
            py={3}
            borderRadius="14px"
            bg="rgba(255,255,255,0.94)"
            boxShadow="var(--atlas-shadow-float)"
            border="1px solid var(--atlas-divider)"
          >
            <Text color="var(--atlas-text)" fontSize="sm" fontWeight="750" lineHeight="1.6">
              기본 지도에서 탐색할 수 있지만, 현장 인증에는 위치 권한이 필요합니다.
            </Text>
          </Box>
        </Box>
      )}

      {/* 내 위치 바로가기 - 독립 플로팅 버튼 */}
      {!isLocating && shouldShowMapControls && (
        <MotionBox
          className="atlas-location-action"
          position="absolute"
          bottom={{ base: 'calc(env(safe-area-inset-bottom) + 196px)', md: '112px', lg: '120px' }}
          right={{ base: '12px', md: '16px', lg: '20px' }}
          zIndex={22}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, y: isActionMenuOpen ? -128 : 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 300, delay: 0.05 }}
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
      {!isLocating && shouldShowMapControls && (
        <Box
          className="atlas-floating-action-menu"
          position="absolute"
          bottom={{ base: 'calc(env(safe-area-inset-bottom) + 128px)', md: '40px', lg: '48px' }}
          right={{ base: '12px', md: '16px', lg: '20px' }}
          zIndex={23}
          style={{ position: 'absolute' }}
        >
          {/* 펼쳐진 메뉴 아이템들 - 내 위치 버튼은 열릴 때 위로 이동합니다. */}
          <AnimatePresence>
          {isActionMenuOpen && [
            { icon: <FiUser size={20} />, label: '대시보드', onClick: () => { onDashboardOpen(); setIsActionMenuOpen(false); }, bg: 'white', color: 'gray.700' },
            { icon: <FiPlus size={20} />, label: '캡슐 만들기', onClick: () => { setIsPlantingOpen(true); setIsActionMenuOpen(false); }, bg: 'ink.900', color: 'white' },
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
        userLocation={gpsUserLocation}
        selectedLocation={selectedLocation}
        onPlantSuccess={handleNewCapsule}
        userProfile={userProfile}
      />

      <UnlockingOverlay
        isVisible={Boolean(unlockingCapsule)}
        capsule={unlockingCapsule}
        userLocation={gpsUserLocation}
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
        onUnlockOpen={() => setUnlockingCapsule(targetCapsule)}
        onReportCapsule={handleReportCapsule}
        onUpdateCapsule={handleUpdateCapsule}
        isSheetCollapsed={isHudSheetCollapsed}
        onSheetToggle={() => setIsHudSheetCollapsed((prev) => !prev)}
      />
    </Box>
  );
}
