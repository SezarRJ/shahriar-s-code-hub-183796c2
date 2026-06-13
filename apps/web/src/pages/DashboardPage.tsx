import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Apartment,
  CameraAlt,
  Warning,
  BugReport,
  Assessment,
  ArrowForward,
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import { fetchProjects, fetchReports, fetchNotifications, api } from '../services/api';

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = `${t('appName')} — ${t('dashboard')}`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', t('dashboardPageDescription') || 'Project overview, KPI tracking and latest reports');
    }
  }, [t]);

  const { data: projectsData, isLoading: projectsLoading } = useQuery('projects', fetchProjects);

  const { data: reportsData, isLoading: reportsLoading } = useQuery('reports', fetchReports);
  const { data: notificationsData } = useQuery('notifications', fetchNotifications);
  const { data: kpiData, isLoading: kpiLoading } = useQuery(
    'dashboard-kpi',
    () => api.get('/dashboard/summary').then((r) => r.data),
    { refetchInterval: 300000 } // 5-minute auto-refresh (FR-4.7)
  );

  const kpi = kpiData?.data || {};
  const projects = projectsData?.data?.data || [];
  const reports = reportsData?.data?.data || [];
  const notifications = notificationsData?.data?.data || [];

  const activeProjects = projects.filter((p: any) => p.status === 'active').length;

  const kpiCards = [
    {
      title: t('activeProjects'),
      value: kpi.active_projects ?? activeProjects,
      icon: <Apartment />,
      color: 'primary' as const,
      link: '/projects',
    },
    {
      title: t('totalPhotos'),
      value: kpi.total_photos ?? 0,
      icon: <CameraAlt />,
      color: 'secondary' as const,
      link: '/projects',
    },
    {
      title: t('overduePoints'),
      value: kpi.overdue_points ?? 0,
      icon: <Warning />,
      color: 'warning' as const,
      link: '/projects',
    },
    {
      title: t('openSnags'),
      value: kpi.open_snags ?? 0,
      icon: <BugReport />,
      color: 'error' as const,
      link: '/evidence',
    },
  ];

  return (
    <Box>
      <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
        {t('dashboard')}
      </Typography>

      {kpiLoading && (

        <Box sx={{ mb: 2 }}>
          <LinearProgress />
        </Box>
      )}

      {kpi.overdue_points > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {`⚠️ ${kpi.overdue_points} نقاط التقاط متأخرة في المشاريع النشطة. راجع التفاصيل في المشاريع.`}
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {kpiCards.map((kpi) => (
          <Grid item xs={12} sm={6} lg={3} key={kpi.title}>
            <Card
              sx={{
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
              }}
              onClick={() => navigate(kpi.link)}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Avatar sx={{ bgcolor: `${kpi.color}.light`, color: `${kpi.color}.dark` }}>
                    {kpi.icon}
                  </Avatar>
                  <Button size="small" endIcon={<ArrowForward />} color={kpi.color}>
                    عرض
                  </Button>
                </Box>
                <Typography variant="h3" fontWeight="bold">
                  {kpi.value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {kpi.title}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight="bold">
                  {t('projects')}
                </Typography>
                <Button size="small" onClick={() => navigate('/projects')}>
                  عرض الكل
                </Button>
              </Box>
              {projectsLoading ? (
                <LinearProgress />
              ) : projects.length === 0 ? (
                <Typography color="text.secondary">{t('noData')}</Typography>
              ) : (
                <List>
                  {projects.slice(0, 5).map((project: any) => (
                    <ListItem key={project.id} divider>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'primary.light' }}>
                          <Apartment />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={project.name}
                        secondary={project.address || '—'}
                      />
                      <Chip
                        label={project.status === 'active' ? t('active') : t('paused')}
                        color={project.status === 'active' ? 'success' : 'default'}
                        size="small"
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight="bold">
                  {t('reports')}
                </Typography>
                <Button size="small" onClick={() => navigate('/reports')}>
                  عرض الكل
                </Button>
              </Box>
              {reportsLoading ? (
                <LinearProgress />
              ) : reports.length === 0 ? (
                <Typography color="text.secondary">{t('noData')}</Typography>
              ) : (
                <List>
                  {reports.slice(0, 5).map((report: any) => (
                    <ListItem key={report.id} divider>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'secondary.light' }}>
                          <Assessment />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={report.period_start ? `${report.period_start} — ${report.period_end}` : 'تقرير'}
                        secondary={new Date(report.generated_at).toLocaleDateString('ar-SA')}
                      />
                      <Button size="small" variant="outlined">
                        PDF
                      </Button>
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>

          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                {t('notifications')}
              </Typography>
              {notifications.length === 0 ? (
                <Typography color="text.secondary">لا توجد إشعارات جديدة</Typography>
              ) : (
                <List dense>
                  {notifications.slice(0, 5).map((n: any) => (
                    <ListItem key={n.id} divider>
                      <ListItemText
                        primary={n.payload?.title || 'إشعار'}
                        secondary={new Date(n.created_at).toLocaleDateString('ar-SA')}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
