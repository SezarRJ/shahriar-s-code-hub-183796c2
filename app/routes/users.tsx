import { createFileRoute, redirect } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { fetchUsers, createUser } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';

export const Route = createFileRoute('/users')({
  beforeLoad: ({ location }) => {
    if (!useAuthStore.getState().isAuthenticated) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      });
    }
  },
  component: UsersPage,
});

function UsersPage() {
  const { t } = useTranslation();
  const { data: usersData, isLoading, isError, refetch } = useQuery('users', fetchUsers);
  const users = usersData?.data?.data || [];

  useEffect(() => {
    document.title = `${t('appName')} — ${t('users')}`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', t('usersPageDescription') || 'Manage system users, roles and MFA status');
    }
  }, [t]);

  const [openDialog, setOpenDialog] = useState(false);

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'field_operator',
    mfa_enabled: false,
  });

  const mutation = useMutation(createUser, {
    onSuccess: () => {
      setOpenDialog(false);
      refetch();
    },
  });

  const handleCreate = async () => {
    mutation.mutate(newUser);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          {t('users')}
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpenDialog(true)}>
          {t('addUser') || 'إضافة مستخدم'}
        </Button>
      </Box>

      {isError && <Alert severity="error" sx={{ mb: 3 }}>{t('apiError') || 'حدث خطأ أثناء تحميل المستخدمين'}</Alert>}

      <Card>
        <CardContent>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('name') || 'الاسم'}</TableCell>
                  <TableCell>{t('email')}</TableCell>
                  <TableCell>{t('role') || 'الدور'}</TableCell>
                  <TableCell>MFA</TableCell>
                  <TableCell>{t('status')}</TableCell>
                  <TableCell>{t('actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      {t('noData')}
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user: any) => (
                    <TableRow key={user.id} hover>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Chip
                          label={user.role}
                          color={user.role === 'super_admin' ? 'error' : user.role === 'tenant_admin' ? 'warning' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.mfa_enabled ? t('enabled') || 'مفعل' : t('disabled') || 'غير مفعل'}
                          color={user.mfa_enabled ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.is_active ? t('active') : t('disabled') || 'معطل'}
                          color={user.is_active ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small"><Edit /></IconButton>
                        <IconButton size="small" color="error"><Delete /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('addUserTitle') || 'إضافة مستخدم جديد'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label={t('name')}
              fullWidth
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            />
            <TextField
              label={t('email')}
              type="email"
              fullWidth
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            />
            <FormControl fullWidth>
              <InputLabel>{t('role')}</InputLabel>
              <Select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                label={t('role')}
              >
                <MenuItem value="tenant_admin">Tenant Admin</MenuItem>
                <MenuItem value="project_manager">Project Manager</MenuItem>
                <MenuItem value="site_supervisor">Site Supervisor</MenuItem>
                <MenuItem value="field_operator">Field Operator</MenuItem>
                <MenuItem value="read_only">Read Only</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)} disabled={mutation.isLoading}>{t('cancel')}</Button>
          <Button variant="contained" onClick={handleCreate} disabled={mutation.isLoading}>
            {mutation.isLoading ? <CircularProgress size={20} /> : t('create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
