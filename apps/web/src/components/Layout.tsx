import { useNavigate, useLocation } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  Box,

  Drawer,
  AppBar,
  Toolbar,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  IconButton,
  Avatar,
  Divider,
  Badge,
} from '@mui/material';
import {
  Dashboard,
  Apartment,
  Assessment,
  Verified,
  People,
  Settings,
  Menu as MenuIcon,
  Notifications,
  Logout,
} from '@mui/icons-material';
import { useState } from 'react';
import { useAuthStore } from '../store/authStore';

const drawerWidth = 280;

const menuItems = [
  { path: '/', label: 'لوحة التحكم', icon: <Dashboard /> },
  { path: '/projects', label: 'المشاريع', icon: <Apartment /> },
  { path: '/reports', label: 'التقارير', icon: <Assessment /> },
  { path: '/evidence', label: 'الأدلة', icon: <Verified /> },
  { path: '/users', label: 'المستخدمون', icon: <People /> },
  { path: '/settings', label: 'الإعدادات', icon: <Settings /> },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const location = useLocation();
  const { user, logout } = useAuthStore();

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ justifyContent: 'center', gap: 1 }}>
        <Avatar sx={{ bgcolor: 'primary.main' }}>
          <Dashboard />
        </Avatar>
        <Typography variant="h6" fontWeight="bold" color="primary">
          شاهد
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ flexGrow: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => {
                navigate({ to: item.path });
                setMobileOpen(false);
              }}
              sx={{
                borderRadius: 2,
                mx: 1,
                mb: 0.5,
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': { bgcolor: 'primary.dark' },
                  '& .MuiListItemIcon-root': { color: 'primary.contrastText' },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <List>
        <ListItem disablePadding>
          <ListItemButton
            onClick={() => {
              logout();
              navigate({ to: '/login' });
            }}
            sx={{ borderRadius: 2, mx: 1, color: 'error.main' }}
          >
            <ListItemIcon sx={{ minWidth: 40, color: 'error.main' }}>
              <Logout />
            </ListItemIcon>
            <ListItemText primary="تسجيل الخروج" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'row-reverse' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mr: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="end"
            onClick={handleDrawerToggle}
            sx={{ display: { sm: 'none' }, ml: 2 }}
            aria-label={t('openMenu') || 'Open menu'}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {menuItems.find((i) => i.path === location.pathname)?.label || 'شاهد'}
          </Typography>
          <IconButton color="inherit" aria-label={t('notifications') || 'Notifications'}>
            <Badge badgeContent={4} color="error">
              <Notifications />
            </Badge>
          </IconButton>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
              {user?.name?.charAt(0) || 'U'}
            </Avatar>
            <Typography variant="body2" sx={{ display: { xs: 'none', md: 'block' } }}>
              {user?.name || 'مستخدم'}
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="navigation"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawerContent}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          bgcolor: 'background.default',
          minHeight: '100vh',
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
