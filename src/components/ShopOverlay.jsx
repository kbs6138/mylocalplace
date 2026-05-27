import {
  Box,
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  HStack,
  Icon,
  Text,
  VStack,
} from '@chakra-ui/react';
import { FiClock, FiX } from 'react-icons/fi';

export default function ShopOverlay({ isOpen, onClose }) {
  return (
    <Drawer placement="bottom" onClose={onClose} isOpen={isOpen}>
      <DrawerOverlay bg="rgba(0,0,0,0.45)" backdropFilter="blur(6px)" />
      <DrawerContent
        borderTopRadius="18px"
        bg="white"
        maxH="72vh"
        maxW="600px"
        mx="auto"
        position="relative"
        overflow="hidden"
      >
        <Box
          w="40px"
          h="4px"
          bg="var(--atlas-divider)"
          borderRadius="full"
          mx="auto"
          mt={3}
          mb={1}
        />

        <DrawerHeader
          px={6}
          py={4}
          borderBottomWidth={0}
          display="flex"
          justifyContent="space-between"
          alignItems="center"
        >
          <Box>
            <Text color="var(--atlas-muted-text)" fontSize="xs" fontWeight="700" letterSpacing="0" mb={1}>
              LOCAL ATLAS STORE
            </Text>
            <Text color="var(--atlas-text)" fontSize="xl" fontWeight="800">
              상점 준비 중
            </Text>
          </Box>
          <Button variant="ghost" onClick={onClose} minW="auto" px={2} aria-label="상점 닫기">
            <Icon as={FiX} w={6} h={6} color="var(--atlas-muted-text)" />
          </Button>
        </DrawerHeader>

        <DrawerBody px={6} pb="calc(env(safe-area-inset-bottom) + 32px)">
          {/* MVP 이후 결제/아이템 상점 기능: 실제 결제 서버 연동 전까지 상품과 결제 CTA를 노출하지 않습니다. */}
          <VStack spacing={5} align="stretch" textAlign="center" py={8}>
            <HStack
              mx="auto"
              w="64px"
              h="64px"
              borderRadius="16px"
              align="center"
              justify="center"
              bg="var(--atlas-primary-soft)"
              color="var(--atlas-primary)"
            >
              <Icon as={FiClock} w={8} h={8} />
            </HStack>
            <Box>
              <Text color="var(--atlas-text)" fontSize="lg" fontWeight="800" mb={2}>
                현재 MVP에서는 준비 중입니다.
              </Text>
              <Text color="var(--atlas-muted-text)" fontSize="sm" lineHeight="1.7">
                지금은 캡슐 발견, 현장 인증, 공유 경험에 집중하고 있습니다. 결제와 아이템 상점은 이후 버전에서 검토합니다.
              </Text>
            </Box>
            <Button className="atlas-blue-button" h="52px" borderRadius="14px" onClick={onClose}>
              지도로 돌아가기
            </Button>
          </VStack>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
