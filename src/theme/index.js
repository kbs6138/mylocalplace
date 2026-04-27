import { extendTheme } from '@chakra-ui/react';

const config = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

const colors = {
  primary: {
    50: '#EEF4FF',
    100: '#DBE8FF',
    200: '#BDD1FF',
    300: '#97B6FF',
    400: '#6D93FF',
    500: '#3A6FFF',
    600: '#2558E0',
    700: '#1A43B0',
  },
  accent: {
    50: '#FFF1EB',
    100: '#FFDCD0',
    200: '#FFC1AE',
    300: '#FF9C7E',
    400: '#FF7B5D',
    500: '#FF7657',
    600: '#D95A3E',
  },
  sand: {
    50: '#FFF9F3',
    100: '#F8EDE1',
    200: '#F0DDC6',
    300: '#E4C39F',
  },
  ink: {
    900: '#181F33',
    800: '#212A44',
    700: '#34405D',
    600: '#4D5A79',
    500: '#707C99',
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
      '--chakra-colors-primary-500': '#3A6FFF',
      '--chakra-colors-accent-500': '#FF7657',
    },
    'html, body, #root': {
      minHeight: '100%',
    },
    body: {
      bg: 'sand.50',
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
