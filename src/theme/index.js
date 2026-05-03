import { extendTheme } from '@chakra-ui/react';

const config = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

const colors = {
  primary: {
    50: '#E7EFFF',
    100: '#D5E3FF',
    200: '#ABC6FF',
    300: '#7DA4F8',
    400: '#4D7EEA',
    500: '#2563EB',
    600: '#1749BD',
    700: '#123A93',
  },
  accent: {
    50: '#FFF0EC',
    100: '#FFE0D8',
    200: '#FFC6B8',
    300: '#F99E8A',
    400: '#F07E66',
    500: '#EF6A55',
    600: '#C94C3D',
  },
  sand: {
    50: '#FFF9F3',
    100: '#F8EDE1',
    200: '#F0DDC6',
    300: '#E4C39F',
  },
  ink: {
    900: '#151A24',
    800: '#1E2533',
    700: '#394354',
    600: '#536071',
    500: '#687181',
  },
  bg: {
    50: '#FFFCF8',
    100: '#FFFFFF',
  },
  gray: {
    50: '#F6F6FA',
    100: '#EAEDF7',
    200: '#D6DDED',
    300: '#B5BFD6',
    400: '#8C97B2',
    500: '#68748F',
    600: '#4D5871',
    700: '#394359',
    800: '#272F42',
    900: '#181D2C',
  },
};

const fonts = {
  heading: `'Space Grotesk', 'Pretendard Variable', sans-serif`,
  body: `'Pretendard Variable', 'Pretendard', sans-serif`,
  mono: `'JetBrains Mono', monospace`,
};

const styles = {
  global: {
    ':root': {
      '--chakra-colors-primary-500': '#2563EB',
      '--chakra-colors-accent-500': '#EF6A55',
    },
    'html, body, #root': {
      minHeight: '100%',
    },
    body: {
      bg: 'bg.50',
      color: 'ink.900',
      margin: 0,
      backgroundImage: 'var(--app-bg)',
      backgroundAttachment: 'fixed',
    },
    '#root': {
      minHeight: '100vh',
    },
    a: {
      color: 'inherit',
    },
    'button, input, textarea, select': {
      fontFamily: 'body',
    },
  },
};

const components = {
  Button: {
    baseStyle: {
      borderRadius: '14px',
      fontWeight: '600',
      transition:
        'transform 0.24s ease, box-shadow 0.24s ease, background 0.24s ease, border-color 0.24s ease, color 0.24s ease',
      _active: {
        transform: 'scale(0.95)',
        filter: 'brightness(1.06)',
      },
    },
  },
  Input: {
    defaultProps: {
      focusBorderColor: 'primary.500',
    },
  },
  Textarea: {
    defaultProps: {
      focusBorderColor: 'primary.500',
    },
  },
  Modal: {
    baseStyle: {
      dialog: {
        borderRadius: '18px',
      },
    },
  },
  Drawer: {
    baseStyle: {
      dialog: {
        borderTopRadius: '20px',
      },
    },
  },
};

const shadows = {
  outline: '0 0 0 3px rgba(58, 111, 255, 0.18)',
  soft: 'var(--shadow-soft)',
  float: 'var(--shadow-float)',
};

const theme = extendTheme({
  config,
  colors,
  fonts,
  styles,
  components,
  shadows,
});

export default theme;
