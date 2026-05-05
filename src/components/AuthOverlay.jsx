import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Flex,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  Text,
  VStack,
  useToast,
} from '@chakra-ui/react';
import { FiArrowRight, FiLock, FiMail } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabaseClient';
import AtlasGlobe from './AtlasGlobe';

const MotionBox = motion.create(Box);
const MotionText = motion.create(Text);

/* ── 파티클 캔버스 훅 ── */
function useParticleCanvas(canvasRef) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    const particles = [];
    const W = () => canvas.offsetWidth;
    const H = () => canvas.offsetHeight;

    const resize = () => {
      canvas.width = W();
      canvas.height = H();
    };
    resize();
    window.addEventListener('resize', resize);

    // 마우스 위치
    let mouse = { x: W() / 2, y: H() / 2 };
    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    window.addEventListener('mousemove', onMouseMove);

    // 파티클 초기화
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * W(),
        y: Math.random() * H(),
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 2.5 + 1,
        alpha: Math.random() * 0.5 + 0.2,
        color: Math.random() < 0.5 ? '49,130,246' : '124,58,237',
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, W(), H());

      particles.forEach((p, i) => {
        // 마우스 반발력
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0 && dist < 120) {
          p.vx -= (dx / dist) * 0.3;
          p.vy -= (dy / dist) * 0.3;
        }

        p.vx *= 0.99;
        p.vy *= 0.99;
        p.x += p.vx;
        p.y += p.vy;

        // 벽 반사
        if (p.x < 0 || p.x > W()) p.vx *= -1;
        if (p.y < 0 || p.y > H()) p.vy *= -1;
        p.x = Math.max(0, Math.min(W(), p.x));
        p.y = Math.max(0, Math.min(H(), p.y));

        // 연결선
        particles.slice(i + 1).forEach((q) => {
          const len = Math.hypot(p.x - q.x, p.y - q.y);
          if (len < 100) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(49,130,246,${0.15 * (1 - len / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });

        // 파티클 원
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color},${p.alpha})`;
        ctx.fill();
      });

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [canvasRef]);
}

/* ── 마그네틱 버튼 훅 ── */
function useMagneticEffect(ref) {
  useEffect(() => {
    const btn = ref.current;
    if (!btn) return;

    const onMove = (e) => {
      const rect = btn.getBoundingClientRect();
      const offsetX = e.clientX - rect.left - rect.width / 2;
      const offsetY = e.clientY - rect.top - rect.height / 2;

      const mx = ((e.clientX - rect.left) / rect.width) * 100;
      const my = ((e.clientY - rect.top) / rect.height) * 100;
      btn.style.setProperty('--mouse-x', `${mx}%`);
      btn.style.setProperty('--mouse-y', `${my}%`);
      btn.style.transform = `translate(${offsetX * 0.045}px, ${offsetY * 0.08}px)`;
    };

    const onLeave = () => {
      btn.style.transform = 'translate(0, 0)';
    };

    btn.addEventListener('mousemove', onMove);
    btn.addEventListener('mouseleave', onLeave);
    return () => {
      btn.removeEventListener('mousemove', onMove);
      btn.removeEventListener('mouseleave', onLeave);
    };
  }, [ref]);
}

export default function AuthOverlay({ isReady, onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const canvasRef = useRef(null);
  const btnRef = useRef(null);

  useParticleCanvas(canvasRef);
  useMagneticEffect(btnRef);

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast({ title: '모든 필드를 입력해주세요.', status: 'warning', duration: 2000 });
      return;
    }

    setLoading(true);
    let finalEmail = email.trim();
    if (!finalEmail.includes('@')) finalEmail = `${finalEmail}@test.com`;

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: finalEmail, password });
        if (error) throw error;
        toast({ title: '탐험 세션이 연결되었습니다.', status: 'success' });
      } else {
        const { error } = await supabase.auth.signUp({
          email: finalEmail,
          password,
          options: { data: { nickname: email.split('@')[0] } },
        });
        if (error) throw error;
        toast({ title: '가입 완료! 반갑습니다.', status: 'success' });
      }
      if (onAuthSuccess) onAuthSuccess();
    } catch (err) {
      toast({ title: '인증 실패', description: err.message, status: 'error', duration: 4000 });
    } finally {
      setLoading(false);
    }
  };

  if (isReady) return null;

  return (
    <Box
      className="atlas-auth-screen"
      position="fixed"
      inset={0}
      zIndex={100}
      bg="var(--atlas-card)"
      display="flex"
      flexDirection="column"
      overflow="hidden"
    >
      {/* 3D 파티클 캔버스 배경 */}
      <canvas
        className="atlas-auth-particles"
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      <Box className="atlas-auth-visual" display={{ base: 'block', md: 'block' }}>
        <AtlasGlobe className="atlas-auth-globe" size={360} intensity={0.92} />
        <span className="atlas-auth-orbit-label atlas-auth-orbit-label-one">SEOUL</span>
        <span className="atlas-auth-orbit-label atlas-auth-orbit-label-two">LIVE</span>
        <span className="atlas-auth-pin" />
        <span className="atlas-auth-pin" />
        <span className="atlas-auth-pin" />
      </Box>

      {/* 배경 그라디언트 오버레이 */}
      <Box
        position="absolute"
        inset={0}
        zIndex={1}
        bg="linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.7) 60%, white 100%)"
        pointerEvents="none"
      />

      {/* Top Section */}
      <Box flex="1" px={{ base: 6, md: 12 }} pt={{ base: 20, md: 28 }} position="relative" zIndex={2}>
        <AnimatePresence mode="wait">
          <MotionBox
            key={isLogin ? 'login' : 'signup'}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* LOCAL ATLAS 브랜드 */}
            <MotionText
              fontSize="xs"
              fontWeight="700"
              letterSpacing="0"
              color="var(--atlas-primary)"
              mb={4}
              display="flex"
              alignItems="center"
              gap={2}
            >
              <span className="live-dot" style={{ width: '6px', height: '6px' }} />
              LOCAL ATLAS
            </MotionText>

            <Text
              fontSize={{ base: '3xl', md: '4xl' }}
              fontWeight="800"
              lineHeight="1.16"
              letterSpacing="0"
              color="var(--atlas-text)"
              mb={4}
            >
              {isLogin ? (
                <>
                  <span className="gradient-text">내 동네 좌표</span>를<br />다시 열어보세요.
                </>
              ) : (
                <>
                  나만의 <span className="gradient-text">비밀 장소</span>를<br />남겨보세요.
                </>
              )}
            </Text>
            <MotionText color="var(--atlas-muted-text)" fontSize="lg" fontWeight="500" lineHeight="1.7">
              {isLogin
                ? '저장한 장소와 발견 기록을 이어서 확인하세요.'
                : '실제 위치에 닿았을 때만 열리는 로컬 캡슐을 만듭니다.'}
            </MotionText>
          </MotionBox>
        </AnimatePresence>
      </Box>

      {/* Bottom Section */}
      <Box
        className="atlas-auth-form-shell"
        position="relative"
        zIndex={2}
        pb="calc(env(safe-area-inset-bottom) + 40px)"
        mx="auto"
      >
        {/* 탭 스위처 */}
        <Flex p={1} mb={7} borderRadius="14px" bg="var(--atlas-bg)" boxShadow="inset 0 0 0 1px rgba(0,0,0,0.04)">
          {[true, false].map((isL) => (
            <Button
              key={String(isL)}
              flex="1"
              h="52px"
              bg={isLogin === isL ? 'white' : 'transparent'}
              color={isLogin === isL ? 'var(--atlas-text)' : 'var(--atlas-muted-text)'}
              boxShadow={isLogin === isL ? '0 2px 12px rgba(0,0,0,0.08)' : 'none'}
              _hover={{ bg: isLogin === isL ? 'white' : 'transparent' }}
              borderRadius="10px"
              fontWeight={isLogin === isL ? '700' : '600'}
              fontSize="md"
              onClick={() => setIsLogin(isL)}
              transition="all 0.25s cubic-bezier(0.34,1.56,0.64,1)"
            >
              {isL ? '로그인' : '가입하기'}
            </Button>
          ))}
        </Flex>

        <form onSubmit={handleAuth}>
          <VStack spacing={3}>
            {[
              { icon: FiMail, type: 'text', placeholder: '아이디 또는 이메일', value: email, onChange: setEmail },
              { icon: FiLock, type: 'password', placeholder: '비밀번호', value: password, onChange: setPassword },
            ].map(({ icon, type, placeholder, value, onChange }) => (
              <InputGroup key={type} size="lg">
                <InputLeftElement pointerEvents="none" h="62px" ml={1}>
                  <Icon as={icon} color="var(--atlas-faint-text)" w={5} h={5} />
                </InputLeftElement>
                <Input
                  h="62px"
                  type={type}
                  placeholder={placeholder}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  bg="var(--atlas-bg)"
                  border="1.5px solid transparent"
                  borderRadius="14px"
                  fontSize="lg"
                  color="var(--atlas-text)"
                  _placeholder={{ color: 'var(--atlas-faint-text)', fontWeight: 500 }}
                  _focus={{
                    bg: 'white',
                    borderColor: 'var(--atlas-primary)',
                    boxShadow: '0 0 0 3px rgba(49,130,246,0.15)',
                  }}
                  transition="all 0.2s"
                />
              </InputGroup>
            ))}

            {/* 마그네틱 CTA 버튼 */}
            <Box ref={btnRef} w="100%" mt={5} className="magnetic-btn" borderRadius="14px">
              <Button
                type="submit"
                w="100%"
                h="62px"
                bg="var(--atlas-primary)"
                color="white"
                borderRadius="14px"
                fontSize="lg"
                fontWeight="700"
                isLoading={loading}
                rightIcon={<FiArrowRight />}
                _hover={{ bg: 'var(--atlas-primary-hover)' }}
                _active={{ transform: 'scale(0.97)' }}
                boxShadow="0 8px 30px rgba(49, 130, 246, 0.35), 0 2px 8px rgba(49, 130, 246, 0.2)"
                transition="all 0.2s cubic-bezier(0, 0, 0.2, 1)"
              >
                {isLogin ? '다음' : '탐험 시작하기'}
              </Button>
            </Box>
          </VStack>
        </form>
      </Box>
    </Box>
  );
}
