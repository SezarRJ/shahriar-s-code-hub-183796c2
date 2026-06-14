import { createRootRoute, Outlet, ScrollRestoration } from '@tanstack/react-router';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Layout from '../src/components/Layout';

// Import i18n configuration
import '../src/i18n';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
});

const theme = createTheme({
  typography: {
    fontFamily: '"Cairo", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  palette: {
    primary: {
      main: '#1E3A5F',
      light: '#3D5A80',
      dark: '#0F1F33',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#C8963E',
      light: '#D9B56E',
      dark: '#8A6A2A',
      contrastText: '#000000',
    },
    background: {
      default: '#F5F7FA',
      paper: '#FFFFFF',
    },
  },
});

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const { i18n } = useTranslation();

  useEffect(() => {
    const lang = i18n.language;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [i18n.language]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Layout>
          <Outlet />
        </Layout>
        <ScrollRestoration />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
