import { useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  HStack,
  Icon,
  Text,
  VStack,
  useToast,
} from '@chakra-ui/react';
import { FiCheck, FiCompass, FiX, FiZap } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

const MotionBox = motion.create(Box);

const shopItems = [
  {
    id: 'item_1',
    title: '마스터 키 10개',
    description: '부족할 때 가볍게 보충하는 기본 팩',
    price: '₩2,900',
    icon: FiCompass,
    iconBg: 'var(--atlas-primary)',
    isHot: false,
  },
  {
    id: 'item_2',
    title: '탐험가 스타터 팩',
    description: '키 25개 + 에너지 100% 즉시 충전',
    price: '₩5,900',
    icon: FiZap,
    iconBg: 'var(--atlas-gold)',
    isHot: true,
  },
  {
    id: 'item_3',
    title: 'PRO 탐험가 패스',
    description: '월간 키 60개 + 프로 탐험가 배지',
    price: '₩8,900/월',
    icon: FiCheck,
    iconBg: 'var(--atlas-green)',
    isHot: false,
  },
];

function ShopItemCard({ item, isSelected, onClick }) {
  return (
    <Box
      className={`atlas-shop-card ${isSelected ? 'atlas-shop-card-selected' : ''}`}
      onClick={onClick}
      p={5}
      borderRadius="14px"
      border="1px solid"
      borderColor={isSelected ? 'var(--atlas-primary)' : 'var(--atlas-border)'}
      bg={isSelected ? 'var(--atlas-primary-soft)' : 'var(--atlas-card)'}
      cursor="pointer"
      transition="border-color 0.2s ease, background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease"
      _hover={{ transform: 'translateY(-1px)', boxShadow: 'var(--atlas-shadow-soft)' }}
      boxShadow={isSelected ? 'var(--atlas-shadow-soft)' : 'none'}
    >
      <Flex justify="space-between" align="center" gap={4}>
        <HStack spacing={4}>
          <Flex
            w="48px"
            h="48px"
            bg={item.iconBg}
            borderRadius="12px"
            align="center"
            justify="center"
            flexShrink={0}
          >
            <Icon as={item.icon} color="white" w={6} h={6} />
          </Flex>
          <Box>
            <HStack spacing={2} mb={1}>
              <Text
                color={isSelected ? 'var(--atlas-primary)' : 'var(--atlas-text)'}
                fontSize="lg"
                fontWeight="700"
              >
                {item.title}
              </Text>
              {item.isHot && (
                <Box
                  bg="var(--atlas-danger-soft)"
                  color="var(--atlas-danger)"
                  px={2}
                  py={0.5}
                  borderRadius="8px"
                  fontSize="xs"
                  fontWeight="800"
                  letterSpacing="0"
                >
                  HOT
                </Box>
              )}
            </HStack>
            <Text color="var(--atlas-muted-text)" fontSize="sm">{item.description}</Text>
          </Box>
        </HStack>
        <Text
          color={isSelected ? 'var(--atlas-primary)' : 'var(--atlas-text)'}
          fontSize="xl"
          fontWeight="800"
          flexShrink={0}
        >
          {item.price}
        </Text>
      </Flex>
    </Box>
  );
}

export default function ShopOverlay({ isOpen, onClose }) {
  const [selectedItem, setSelectedItem] = useState(shopItems[1].id);
  const toast = useToast();

  const handlePayment = () => {
    toast({
      title: '테스트 결제가 완료되었습니다.',
      description: '실제 결제 없이 지급 시뮬레이션만 처리했습니다.',
      status: 'success',
      duration: 3000,
      position: 'top',
    });
    onClose();
  };

  return (
      <Drawer placement="bottom" onClose={onClose} isOpen={isOpen}>
        <DrawerOverlay bg="rgba(0,0,0,0.45)" backdropFilter="blur(6px)" />
        <DrawerContent
          borderTopRadius="18px"
          bg="white"
          maxH="88vh"
          maxW="600px"
          mx="auto"
          position="relative"
          overflow="hidden"
        >
          <Box
            w="40px" h="4px"
            bg="var(--atlas-divider)"
            borderRadius="full"
            mx="auto"
            mt={3} mb={1}
          />

          <DrawerHeader
            px={6} py={4}
            borderBottomWidth={0}
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Box>
              <HStack spacing={2} mb={1}>
                <Text color="var(--atlas-muted-text)" fontSize="xs" fontWeight="700" letterSpacing="0">
                  LOCAL ATLAS STORE
                </Text>
                <Badge borderRadius="8px" bg="var(--atlas-primary-soft)" color="var(--atlas-primary)">
                  TEST MODE
                </Badge>
              </HStack>
              <Text color="var(--atlas-text)" fontSize="xl" fontWeight="800">
                탐험 아이템 상점
              </Text>
            </Box>
            <Button variant="ghost" onClick={onClose} minW="auto" px={2}>
              <Icon as={FiX} w={6} h={6} color="var(--atlas-muted-text)" />
            </Button>
          </DrawerHeader>

          <DrawerBody px={6} pb="calc(env(safe-area-inset-bottom) + 130px)">
            <VStack spacing={3} align="stretch" mt={2}>
              <AnimatePresence>
                {shopItems.map((item, idx) => (
                  <MotionBox
                    key={item.id}
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.08, duration: 0.4, ease: [0.16,1,0.3,1] }}
                  >
                    <ShopItemCard
                      item={item}
                      isSelected={selectedItem === item.id}
                      onClick={() => setSelectedItem(item.id)}
                    />
                  </MotionBox>
                ))}
              </AnimatePresence>
            </VStack>
          </DrawerBody>

          <Box
            position="absolute"
            bottom={0} left={0} w="100%"
            px={6}
            pb="calc(env(safe-area-inset-bottom) + 28px)"
            pt={4}
            bg="linear-gradient(to top, white 60%, rgba(255,255,255,0) 100%)"
          >
            <Box className="magnetic-btn" borderRadius="14px">
              <Button
                className="atlas-blue-button"
                w="100%"
                h="60px"
                borderRadius="14px"
                fontSize="lg"
                fontWeight="700"
                onClick={handlePayment}
                _hover={{ bg: 'var(--atlas-primary-hover)' }}
                _active={{ transform: 'scale(0.97)' }}
                boxShadow="0 8px 32px rgba(49,130,246,0.35)"
              >
                테스트 결제 완료 처리
              </Button>
            </Box>
          </Box>
        </DrawerContent>
      </Drawer>
  );
}
