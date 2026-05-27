import { useEffect, useState } from 'react';
import { Box, Flex, Spinner, Text, VStack, useDisclosure } from '@chakra-ui/react';
import ExplorerMap from './components/ExplorerMap';
import ExplorerDashboard from './components/ExplorerDashboard';
import AuthOverlay from './components/AuthOverlay';
import ShopOverlay from './components/ShopOverlay';
import { isSupabaseConfigured, supabase } from './supabaseClient';

const DEMO_AUTH_STORAGE_KEY = 'local-atlas-demo-auth';
const DEMO_SESSION = {
  user: {
    id: 'demo-admin',
    email: 'admin@test.com',
  },
};
const DEMO_PROFILE = {
  id: 'demo-admin',
  nickname: 'Admin',
  energy: 100,
  master_keys: 3,
  is_pro: true,
};

function getStoredDemoAuth() {
  return typeof window !== 'undefined' && window.localStorage.getItem(DEMO_AUTH_STORAGE_KEY) === 'true';
}

function AppBootSplash() {
  return (
    <Flex
      w="100vw"
      h="100vh"
      align="center"
      justify="center"
      px={6}
      bg="transparent"
    >
      <VStack
        className="atlas-card"
        spacing={5}
        w="full"
        maxW="360px"
        p={{ base: 8, md: 10 }}
        bg="var(--atlas-card)"
        textAlign="center"
      >
        <Text
          fontFamily="heading"
          fontSize={{ base: '2xl', md: '3xl' }}
          fontWeight="700"
          color="var(--atlas-text)"
          letterSpacing="0"
        >
          LOCAL ATLAS
        </Text>
        <Text color="var(--atlas-muted-text)" fontSize="sm" lineHeight="1.7">
          지도와 탐험 데이터를 불러오는 중입니다. 주변 캡슐과 개인 탐험 기록을 곧 연결합니다.
        </Text>
        <Spinner size="lg" color="var(--atlas-primary)" thickness="4px" speed="0.7s" />
      </VStack>
    </Flex>
  );
}

function AppConfigError() {
  return (
    <Flex
      w="100vw"
      h="100vh"
      align="center"
      justify="center"
      px={6}
      bg="transparent"
    >
      <VStack
        className="atlas-card"
        spacing={4}
        w="full"
        maxW="420px"
        p={{ base: 8, md: 10 }}
        bg="var(--atlas-card)"
        textAlign="center"
      >
        <Text
          fontFamily="heading"
          fontSize={{ base: '2xl', md: '3xl' }}
          fontWeight="700"
          color="var(--atlas-text)"
          letterSpacing="0"
        >
          설정이 필요합니다
        </Text>
        <Text color="var(--atlas-muted-text)" fontSize="sm" lineHeight="1.7">
          Vercel 환경변수에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 등록한 뒤 다시 배포하세요.
        </Text>
      </VStack>
    </Flex>
  );
}

function App() {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isDemoSession, setIsDemoSession] = useState(() => getStoredDemoAuth());
  const [session, setSession] = useState(() => (getStoredDemoAuth() ? DEMO_SESSION : null));
  const [profile, setProfile] = useState(() => (getStoredDemoAuth() ? DEMO_PROFILE : null));
  const [isAuthReady, setIsAuthReady] = useState(() => getStoredDemoAuth());
  const { isOpen: isDashboardOpen, onOpen: onDashboardOpen, onClose: onDashboardClose } = useDisclosure();
  const { isOpen: isShopOpen, onClose: onShopClose } = useDisclosure();

  useEffect(() => {
    if (!isSupabaseConfigured || isDemoSession) {
      return undefined;
    }

    let isMounted = true;

    const fetchProfile = async (userId) => {
      const { data, error } = await supabase
        .from('mlp_profiles')
        .select('id,nickname,avatar_url,energy,master_keys,is_pro,subscription_end')
        .eq('id', userId)
        .single();

      if (!isMounted) {
        return;
      }

      if (!error && data) {
        setProfile(data);
        return;
      }

      setProfile({
        id: userId,
        nickname: 'Explorer',
        energy: 100,
        master_keys: 3,
        is_pro: false,
      });
    };

    const syncSession = async (nextSession) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession);

      if (!nextSession) {
        setProfile(null);
        return;
      }

      await fetchProfile(nextSession.user.id);
    };

    void supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      await syncSession(currentSession);
      if (isMounted) {
        setIsAuthReady(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncSession(nextSession);
      if (isMounted) {
        setIsAuthReady(true);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [isDemoSession]);

  const handleDemoLogin = () => {
    window.localStorage.setItem(DEMO_AUTH_STORAGE_KEY, 'true');
    setIsDemoSession(true);
    setSession(DEMO_SESSION);
    setProfile(DEMO_PROFILE);
    setIsAuthReady(true);
    window.setTimeout(() => {
      window.location.reload();
    }, 0);
  };

  const handleLogout = async () => {
    if (!window.confirm('로그아웃 하시겠습니까?')) {
      return;
    }

    if (isDemoSession) {
      window.localStorage.removeItem(DEMO_AUTH_STORAGE_KEY);
      setIsDemoSession(false);
      setSession(null);
      setProfile(null);
      onDashboardClose();
      return;
    }

    await supabase.auth.signOut();
    onDashboardClose();
  };

  if (!isSupabaseConfigured && !isDemoSession && !session) {
    return <AuthOverlay onDemoLogin={handleDemoLogin} />;
  }

  if (!isSupabaseConfigured && !isDemoSession) {
    return <AppConfigError />;
  }

  if (!isAuthReady) {
    return <AppBootSplash />;
  }

  if (!session) {
    return <AuthOverlay onDemoLogin={handleDemoLogin} />;
  }

  return (
    <Box w="100vw" h="100vh" position="relative" overflow="hidden" bg="transparent">
      <ExplorerMap
        selectedLocation={selectedLocation}
        onMapClick={(coords) => setSelectedLocation(coords)}
        onDashboardOpen={onDashboardOpen}
        userProfile={profile}
      />

      <ExplorerDashboard isOpen={isDashboardOpen} onClose={onDashboardClose} onLogout={handleLogout} userProfile={profile} />
      <AuthOverlay session={session} isReady={isAuthReady} setUserProfile={setProfile} onDemoLogin={handleDemoLogin} />

      {/* MVP 이후 결제/아이템 상점 기능: 지도 화면에서는 상점 진입 버튼을 숨깁니다. */}
      <ShopOverlay isOpen={isShopOpen} onClose={onShopClose} />
    </Box>
  );
}

export default App;
