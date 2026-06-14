import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from '@tanstack/react-router';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Avatar,
  Divider,
  Chip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  Apartment,
  Assessment,
  VerifiedUser,
  People,
  Settings,
  Logout,
  Notifications,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../src/store/authStore';

const DRAWER_WIDTH = 260;

const navItems = [
  { label: 'dashboard', path: '/', icon: <Dashboard /> },
  { label: 'projects', path: '/projects', icon: <Apartment /> },
  { label: 'reports', path: '/reports', icon: <Assessment /> },
  { label: 'evidenceExport', path: '/evidence', icon: <VerifiedUser /> },
  { label: 'users', path: '/users', icon: <People /> },
  { label: 'settings', path: '/settings', icon: <Settings /> },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { isAuthenticated, user, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  const handleLogout = () => {
    logout();
    navigate({ to: '/login' });
  };

  const toggleDrawer = () => {
    if (isMobile) {
      setMobileOpen(!mobileOpen);
    } else {
      setDrawerOpen(!drawerOpen);
    }
  };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
          <Apartment sx={{ fontSize: 24 }} />
        </Avatar>
        <Box>
          <Typography variant="subtitle1" fontWeight="bold" color="primary" noWrap>
            {t('appName') || 'SHAHID'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('appSubtitle') || 'شاهد'}
          </Typography>
        </Box>
      </Box>

      <Divider />

      <List sx={{ flex: 1, pt: 1 }}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <ListItem key={item.path} disablePadding sx={{ px: 1, mb: 0.5 }}>
              <ListItemButton
                selected={isActive}
                onClick={() => {
                  navigate({ to: item.path });
                  if (isMobile) setMobileOpen(false);
                }}
                sx={{
                  borderRadius: 2,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'white',
                    '&:hover': { bgcolor: 'primary.dark' },
                    '& .MuiListItemIcon-root': { color: 'white' },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={t(item.label)} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider />

      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main', fontSize: 14 }}>
            {user?.name?.charAt(0) || 'U'}
          </Avatar>
          <Box sx={{ overflow: 'hidden' }}>
            <Typography variant="body2" fontWeight="bold" noWrap>
              {user?.name || 'User'}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {user?.role || 'role'}
            </Typography>
          </Box>
        </Box>
        <ListItemButton
          onClick={handleLogout}
          sx={{ borderRadius: 2, mt: 1 }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}><Logout fontSize="small" /></ListItemIcon>
          <ListItemText primary={t('logout') || 'تسجيل الخروج'} />
        </ListItemButton>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Sidebar */}
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
          }}
        >
          {drawerContent}
        </Drawer>
      ) : (
        <Drawer
          variant="persistent"
          open={drawerOpen}
          sx={{
            width: drawerOpen ? DRAWER_WIDTH : 0,
            flexShrink: 0,
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Main content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <AppBar
          position="sticky"
          elevation={1}
          sx={{ bgcolor: 'background.paper', color: 'text.primary' }}
        >
          <Toolbar>
            <IconButton edge="start" onClick={toggleDrawer} sx={{ mr: 2 }}>
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
              {t('appName') || 'SHAHID'}
            </Typography>
            <Chip
              label={i18n.language === 'ar' ? 'العربية' : 'English'}
              size="small"
              variant="outlined"
              onClick={() => i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar')}
              sx={{ mr: 1, cursor: 'pointer' }}
            />
            <IconButton>
              <Notifications />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Box component="main" sx={{ flex: 1, p: 3, overflow: 'auto' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
