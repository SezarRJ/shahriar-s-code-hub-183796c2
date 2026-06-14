import React, { useState, useEffect } from 'react';
import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from 'react-query';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { fetchProject } from '../apps/web/src/services/api';
import { useAuthStore } from '../apps/web/src/store/authStore';

export const Route = createFileRoute('/projects/$projectId')({
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
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  const { projectId } = Route.useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);

  useEffect(() => {
    document.title = `${t('appName')} — ${t('projectDetails') || 'Project Details'}`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', t('projectDetailPageDescription') || 'Detailed view of construction project progress, zones and capture points');
    }
  }, [t, projectId]);

  const { data, isLoading, isError } = useQuery(['project', projectId], () => fetchProject(projectId!));
  const project = data?.data?.data;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{t('apiError') || 'حدث خطأ أثناء تحميل تفاصيل المشروع'}</Alert>
        <Button startIcon={<ArrowBack />} onClick={() => navigate({ to: '/projects' })} sx={{ mt: 2 }}>
          {t('backToProjects') || 'العودة إلى المشاريع'}
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate({ to: '/projects' })}
        sx={{ mb: 2 }}
      >
        {t('backToProjects') || 'العودة إلى المشاريع'}
      </Button>

      <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
        {project?.name || t('project')}
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label={t('overview') || 'نظرة عامة'} />
        <Tab label={t('capturePoints') || 'نقاط التقاط'} />
        <Tab label={t('photos') || 'الصور'} />
        <Tab label={t('timeline') || 'الجدول الزمني'} />
      </Tabs>

      {tab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">{t('status')}</Typography>
                <Chip
                  label={project?.status === 'active' ? t('active') : project?.status}
                  color={project?.status === 'active' ? 'success' : 'default'}
                  sx={{ mt: 1 }}
                />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  {t('address')}
                </Typography>
                <Typography variant="body1">{project?.address || '—'}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">{t('completionRate') || 'نسبة الإنجاز'}</Typography>
                <LinearProgress variant="determinate" value={0} sx={{ mt: 1, height: 8, borderRadius: 4 }} />
                <Typography variant="h6" fontWeight="bold" sx={{ mt: 1 }}>0%</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">{t('overduePoints')}</Typography>
                <Typography variant="h6" fontWeight="bold" color="error" sx={{ mt: 1 }}>0</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {tab === 1 && (
        <Card>
          <CardContent>
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('point') || 'النقطة'}</TableCell>
                    <TableCell>{t('zone') || 'المنطقة'}</TableCell>
                    <TableCell>{t('expectedPhase') || 'المرحلة المتوقعة'}</TableCell>
                    <TableCell>{t('lastCapture') || 'آخر التقاط'}</TableCell>
                    <TableCell>{t('status')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={5} align="center">{t('noData')}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {tab === 2 && (
        <Card>
          <CardContent>
            <Typography color="text.secondary">{t('noPhotosYet') || 'لا توجد صور مسجلة بعد.'}</Typography>
          </CardContent>
        </Card>
      )}

      {tab === 3 && (
        <Card>
          <CardContent>
            <Typography color="text.secondary">{t('timelineUnderDevelopment') || 'الجدول الزمني قيد التطوير.'}</Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
