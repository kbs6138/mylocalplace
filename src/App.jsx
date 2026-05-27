import { useEffect, useState } from 'react';
import { Box, Flex, Spinner, Text, VStack, useDisclosure } from '@chakra-ui/react';
import ExplorerMap from './components/ExplorerMap';
import ExplorerDashboard from './components/ExplorerDashboard';
import AuthOverlay from './components/AuthOverlay';
import ShopOverlay from './components/ShopOverlay';
import { supabase } from './supabaseClient';

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

function App() {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const { isOpen: isDashboardOpen, onOpen: onDashboardOpen, onClose: onDashboardClose } = useDisclosure();
  const { isOpen: isShopOpen, onClose: onShopClose } = useDisclosure();

  useEffect(() => {
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
  }, []);

  if (!isAuthReady) {
    return <AppBootSplash />;
  }

  if (!session) {
    return <AuthOverlay />;
  }

  return (
    <Box w="100vw" h="100vh" position="relative" overflow="hidden" bg="transparent">
      <ExplorerMap
        selectedLocation={selectedLocation}
        onMapClick={(coords) => setSelectedLocation(coords)}
        onDashboardOpen={onDashboardOpen}
        userProfile={profile}
      />

      <ExplorerDashboard isOpen={isDashboardOpen} onClose={onDashboardClose} userProfile={profile} />
      <AuthOverlay session={session} isReady={isAuthReady} setUserProfile={setProfile} />

      {/* MVP 이후 결제/아이템 상점 기능: 지도 화면에서는 상점 진입 버튼을 숨깁니다. */}
      <ShopOverlay isOpen={isShopOpen} onClose={onShopClose} />
    </Box>
  );
}

export default App;
