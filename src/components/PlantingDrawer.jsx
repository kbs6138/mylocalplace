import { useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  FormControl,
  FormLabel,
  Grid,
  GridItem,
  HStack,
  Input,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Text,
  Textarea,
  VStack,
  useToast,
} from '@chakra-ui/react';
import { FiLayers, FiMapPin, FiTarget, FiUsers } from 'react-icons/fi';
import { supabase } from '../supabaseClient';

const categories = [
  '☕️ 로컬 카페',
  '🍽️ 동네 숨은 맛집',
  '🌄 나만 아는 경관',
  '🌃 비밀 야경',
  '🎧 인디 음악/바',
  '🧩 기타 아지트',
];

const CAPSULE_RETURN_FIELDS = [
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

export default function PlantingDrawer({
  isOpen,
  onClose,
  userLocation,
  selectedLocation,
  onPlantSuccess,
  userProfile,
}) {
  const targetLocation = selectedLocation || userLocation;
  const isCustomLocation = Boolean(selectedLocation);

  const [difficulty, setDifficulty] = useState(3);
  const [accessCount, setAccessCount] = useState(5);
  const [title, setTitle] = useState('');
  const [hint, setHint] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  const handlePlant = async () => {
    if (!title.trim()) {
      toast({ title: '캡슐 제목을 입력해주세요.', status: 'warning', duration: 2000 });
      return;
    }

    if (!targetLocation) {
      toast({
        title: 'GPS 좌표를 기다리거나 지도에서 위치를 먼저 지정해주세요.',
        status: 'error',
        duration: 2000,
      });
      return;
    }

    if (selectedCategories.length === 0) {
      toast({ title: '카테고리를 하나 이상 선택해주세요.', status: 'warning', duration: 2000 });
      return;
    }

    setIsSubmitting(true);

    const { data, error } = await supabase
      .from('mlp_mylocalplace')
      .insert([
        {
          lat: targetLocation.latitude,
          lng: targetLocation.longitude,
          title,
          hint,
          category: selectedCategories.join(','),
          difficulty,
          access_limit: accessCount,
          user_id: userProfile?.id,
        },
      ])
      .select(CAPSULE_RETURN_FIELDS);

    setIsSubmitting(false);

    if (error) {
      toast({ title: '매설 실패', description: error.message, status: 'error', duration: 4000 });
      return;
    }

    toast({
      title: '캡슐 매설 완료',
      description: '좌표와 힌트가 저장되었습니다.',
      status: 'success',
      duration: 3000,
    });
    setTitle('');
    setHint('');
    setSelectedCategories([]);
    setDifficulty(3);
    setAccessCount(5);

    if (onPlantSuccess && data?.[0]) {
      onPlantSuccess(withCapsuleDefaults(data[0]));
    }

    onClose();
  };

  return (
    <Drawer placement="bottom" onClose={onClose} isOpen={isOpen} size="full">
      <DrawerOverlay bg="var(--drawer-overlay)" backdropFilter="blur(12px)" />
      <DrawerContent
        mt="auto"
        maxH={{ base: '92vh', md: '84vh' }}
        bg="white"
        borderTopRadius="18px"
        borderTop="1px solid"
        borderColor="rgba(24, 31, 51, 0.08)"
        boxShadow="float"
        overflow="hidden"
      >
        <DrawerCloseButton top={5} right={5} color="gray.500" />

        <DrawerHeader px={{ base: 5, md: 8 }} pt={6} pb={5} borderBottom="1px solid" borderColor="gray.100">
          <VStack align="stretch" spacing={3} pr={10}>
            <HStack spacing={2}>
              <Badge
                px={3}
                py={1}
                borderRadius="8px"
                bg="primary.50"
                color="primary.700"
                border="1px solid"
                borderColor="primary.100"
              >
                CAPSULE PLANTING
              </Badge>
              <Badge
                px={3}
                py={1}
                borderRadius="8px"
                bg="accent.50"
                color="accent.600"
                border="1px solid"
                borderColor="accent.100"
              >
                {isCustomLocation ? '직접 지정한 좌표' : '현재 위치 기준'}
              </Badge>
            </HStack>

            <Box>
              <Text color="ink.900" fontSize={{ base: '2xl', md: '3xl' }} fontWeight="700" letterSpacing="0">
                아지트 매설하기
              </Text>
              <Text color="gray.600" fontSize="sm" mt={2} lineHeight="1.8">
                제목, 힌트, 공개 범위를 정리하면 지도 위에 새 캡슐을 바로 남길 수 있습니다.
              </Text>
            </Box>
          </VStack>
        </DrawerHeader>

        <DrawerBody px={{ base: 5, md: 8 }} py={6}>
          <VStack spacing={6} align="stretch">
            <Grid templateColumns={{ base: '1fr', lg: '1.2fr 0.8fr' }} gap={6}>
              <GridItem>
                <VStack spacing={5} align="stretch">
                  <Box
                    className="interactive-card"
                    p={5}
                    borderRadius="14px"
                    bg="white"
                    border="1px solid"
                    borderColor="gray.100"
                    boxShadow="soft"
                  >
                    <Flex
                      direction={{ base: 'column', md: 'row' }}
                      gap={4}
                      justify="space-between"
                      align={{ base: 'stretch', md: 'center' }}
                    >
                      <Box>
                        <Text color="gray.500" fontSize="xs" fontWeight="700" letterSpacing="0" mb={2}>
                          TARGET COORDINATES
                        </Text>
                        <Text color="ink.900" fontSize="lg" fontWeight="700" mb={1}>
                          {isCustomLocation ? '선택한 지점에 매설' : '현재 위치에 매설'}
                        </Text>
                        <Text color="gray.600" fontSize="sm">
                          {targetLocation
                            ? `${targetLocation.latitude.toFixed(6)}, ${targetLocation.longitude.toFixed(6)}`
                            : '좌표를 불러오는 중입니다.'}
                        </Text>
                      </Box>
                      <Flex
                        align="center"
                        justify="center"
                        w={{ base: '56px', md: '64px' }}
                        h={{ base: '56px', md: '64px' }}
                        borderRadius="14px"
                        bg="primary.50"
                        color="primary.600"
                      >
                        <FiMapPin size={24} />
                      </Flex>
                    </Flex>
                  </Box>

                  <Box
                    className="interactive-card"
                    p={{ base: 5, md: 6 }}
                    borderRadius="14px"
                    bg="white"
                    border="1px solid"
                    borderColor="gray.100"
                    boxShadow="soft"
                  >
                    <VStack spacing={5} align="stretch">
                      <FormControl isRequired>
                        <FormLabel color="ink.900" fontSize="sm" fontWeight="700">
                          아지트 이름
                        </FormLabel>
                        <Input
                          h="54px"
                          placeholder="예: 골목 끝 2층 LP 카페"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          bg="gray.50"
                          border="1px solid"
                          borderColor="gray.100"
                          borderRadius="12px"
                          _focus={{ bg: 'white', borderColor: 'primary.500', boxShadow: 'outline' }}
                        />
                      </FormControl>

                      <FormControl isRequired>
                        <FormLabel color="ink.900" fontSize="sm" fontWeight="700">
                          장소 힌트
                        </FormLabel>
                        <Textarea
                          placeholder="다른 사람이 장소를 좁혀갈 수 있도록 감각적인 힌트를 남겨주세요."
                          value={hint}
                          onChange={(e) => setHint(e.target.value)}
                          bg="gray.50"
                          border="1px solid"
                          borderColor="gray.100"
                          borderRadius="12px"
                          minH="148px"
                          resize="vertical"
                          _focus={{ bg: 'white', borderColor: 'primary.500', boxShadow: 'outline' }}
                        />
                      </FormControl>

                      <FormControl isRequired>
                        <FormLabel color="ink.900" fontSize="sm" fontWeight="700">
                          카테고리
                        </FormLabel>
                        <Flex wrap="wrap" gap={2}>
                          {categories.map((category) => {
                            const isSelected = selectedCategories.includes(category);

                            return (
                              <Button
                                key={category}
                                h="40px"
                                px={4}
                                variant="outline"
                                borderRadius="12px"
                                bg={isSelected ? 'ink.900' : 'white'}
                                color={isSelected ? 'white' : 'gray.600'}
                                borderColor={isSelected ? 'ink.900' : 'gray.200'}
                                _hover={{ bg: isSelected ? 'ink.900' : 'gray.50' }}
                                onClick={() =>
                                  setSelectedCategories((prev) =>
                                    prev.includes(category)
                                      ? prev.filter((item) => item !== category)
                                      : [...prev, category],
                                  )
                                }
                              >
                                {category}
                              </Button>
                            );
                          })}
                        </Flex>
                      </FormControl>
                    </VStack>
                  </Box>
                </VStack>
              </GridItem>

              <GridItem>
                <VStack spacing={5} align="stretch">
                  <Box
                    className="interactive-card"
                    p={{ base: 5, md: 6 }}
                    borderRadius="14px"
                    bg="var(--panel-accent)"
                    border="1px solid"
                    borderColor="primary.100"
                  >
                    <Text color="primary.700" fontSize="xs" fontWeight="700" letterSpacing="0" mb={4}>
                      ACCESS DESIGN
                    </Text>

                    <VStack spacing={6} align="stretch">
                      <FormControl>
                        <Flex justify="space-between" align="center" mb={3}>
                          <FormLabel m={0} color="ink.900" fontSize="sm" fontWeight="700">
                            발견 난이도
                          </FormLabel>
                          <HStack
                            px={3}
                            py={1.5}
                            borderRadius="10px"
                            bg="white"
                            border="1px solid"
                            borderColor="gray.100"
                            spacing={2}
                          >
                            <FiTarget size={14} />
                            <Text color="ink.900" fontSize="sm" fontWeight="700">
                              Lv.{difficulty}
                            </Text>
                          </HStack>
                        </Flex>
                        <Slider min={1} max={5} step={1} value={difficulty} onChange={setDifficulty}>
                          <SliderTrack bg="white" h="10px">
                            <SliderFilledTrack
                              bg="linear-gradient(90deg, var(--chakra-colors-primary-500) 0%, var(--chakra-colors-accent-500) 100%)"
                            />
                          </SliderTrack>
                          <SliderThumb boxSize={6} border="2px solid white" boxShadow="md" />
                        </Slider>
                        <Flex justify="space-between" mt={2}>
                          <Text fontSize="xs" color="gray.500">
                            쉽게 찾힘
                          </Text>
                          <Text fontSize="xs" color="gray.500">
                            깊게 숨김
                          </Text>
                        </Flex>
                      </FormControl>

                      <FormControl>
                        <Flex justify="space-between" align="center" mb={3}>
                          <FormLabel m={0} color="ink.900" fontSize="sm" fontWeight="700">
                            열람 가능 인원
                          </FormLabel>
                          <HStack
                            px={3}
                            py={1.5}
                            borderRadius="10px"
                            bg="white"
                            border="1px solid"
                            borderColor="gray.100"
                            spacing={2}
                          >
                            <FiUsers size={14} />
                            <Text color="ink.900" fontSize="sm" fontWeight="700">
                              {accessCount}명
                            </Text>
                          </HStack>
                        </Flex>
                        <Slider min={1} max={10} step={1} value={accessCount} onChange={setAccessCount}>
                          <SliderTrack bg="white" h="10px">
                            <SliderFilledTrack bg="ink.900" />
                          </SliderTrack>
                          <SliderThumb boxSize={6} border="2px solid white" boxShadow="md" />
                        </Slider>
                        <Text mt={2} fontSize="xs" color="gray.500">
                          설정한 인원만 선착순으로 힌트와 메시지를 열람할 수 있습니다.
                        </Text>
                      </FormControl>
                    </VStack>
                  </Box>

                  <Box
                    className="interactive-card"
                    p={{ base: 5, md: 6 }}
                    borderRadius="14px"
                    bg="white"
                    border="1px solid"
                    borderColor="gray.100"
                    boxShadow="soft"
                  >
                    <Text color="gray.500" fontSize="xs" fontWeight="700" letterSpacing="0" mb={4}>
                      QUICK SUMMARY
                    </Text>
                    <VStack spacing={3} align="stretch">
                      <Flex justify="space-between" align="center">
                        <HStack spacing={2} color="gray.600">
                          <FiLayers size={15} />
                          <Text fontSize="sm">선택 카테고리</Text>
                        </HStack>
                        <Text color="ink.900" fontSize="sm" fontWeight="700">
                          {selectedCategories.length || 0}개
                        </Text>
                      </Flex>
                      <Flex justify="space-between" align="center">
                        <Text color="gray.600" fontSize="sm">
                          매설 위치
                        </Text>
                        <Text color="ink.900" fontSize="sm" fontWeight="700">
                          {isCustomLocation ? '수동 지정' : '현재 위치'}
                        </Text>
                      </Flex>
                      <Flex justify="space-between" align="center">
                        <Text color="gray.600" fontSize="sm">
                          작성 상태
                        </Text>
                        <Text color="ink.900" fontSize="sm" fontWeight="700">
                          {title.trim() && hint.trim() ? '입력 완료' : '작성 중'}
                        </Text>
                      </Flex>
                    </VStack>
                  </Box>
                </VStack>
              </GridItem>
            </Grid>
          </VStack>
        </DrawerBody>

        <DrawerFooter
          px={{ base: 5, md: 8 }}
          py={5}
          borderTop="1px solid"
          borderColor="gray.100"
          bg="white"
        >
          <Flex
            w="full"
            direction={{ base: 'column', md: 'row' }}
            gap={3}
            align={{ base: 'stretch', md: 'center' }}
            justify="space-between"
          >
            <Text color="gray.500" fontSize="sm">
              저장 후 지도에 즉시 반영됩니다.
            </Text>
            <HStack spacing={3}>
              <Button
                variant="outline"
                h="52px"
                px={6}
                borderRadius="14px"
                borderColor="gray.200"
                onClick={onClose}
              >
                닫기
              </Button>
              <Button
                className="cta-button interactive-card"
                h="52px"
                px={6}
                bg="ink.900"
                color="white"
                leftIcon={<FiTarget />}
                isLoading={isSubmitting}
                onClick={handlePlant}
                _hover={{ bg: 'primary.700', transform: 'translateY(-1px)' }}
              >
                기록 완료하기
              </Button>
            </HStack>
          </Flex>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
