import { createFileRoute, redirect } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from 'react-query';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Assessment,
  Download,
  ArrowForward,
} from '@mui/icons-material';
import { fetchReports, triggerReport, fetchProjects } from '../src/services/api';
import { useAuthStore } from '../src/store/authStore';

export const Route = createFileRoute('/reports')({
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
  component: ReportsPage,
});

function ReportsPage() {
  const { t } = useTranslation();
  const { data: reportsData, isLoading: reportsLoading, isError: reportsError, refetch } = useQuery('reports', fetchReports);
  const { data: projectsData } = useQuery('projects', fetchProjects);
  
  const reports = reportsData?.data?.data || [];
  const projects = projectsData?.data?.data || [];

  useEffect(() => {
    document.title = `${t('appName')} — ${t('reports')}`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', t('reportsPageDescription') || 'Generate and review weekly construction reports and delay analysis');
    }
  }, [t]);

  const [openDialog, setOpenDialog] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  
  const mutation = useMutation(triggerReport, {
    onSuccess: () => {
      setOpenDialog(false);
      refetch();
    },
  });

  const handleGenerate = async () => {
    mutation.mutate({ project_id: selectedProject });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          {t('reports')}
        </Typography>
        <Button variant="contained" startIcon={<Assessment />} onClick={() => setOpenDialog(true)}>
          {t('generateReport')}
        </Button>
      </Box>

      {reportsError && <Alert severity="error" sx={{ mb: 3 }}>{t('apiError') || 'حدث خطأ أثناء تحميل التقارير'}</Alert>}

      <Card>
        <CardContent>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('project') || 'المشروع'}</TableCell>
                  <TableCell>{t('period') || 'الفترة'}</TableCell>
                  <TableCell>{t('createdAt') || 'تاريخ الإنشاء'}</TableCell>
                  <TableCell>{t('triggeredBy') || 'المحفز'}</TableCell>
                  <TableCell>{t('status')}</TableCell>
                  <TableCell>{t('actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reportsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : reports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      {t('noData')}
                    </TableCell>
                  </TableRow>
                ) : (
                  reports.map((report: any) => (
                    <TableRow key={report.id} hover>
                      <TableCell>{report.project_id}</TableCell>
                      <TableCell>
                        {report.period_start} — {report.period_end}
                      </TableCell>
                      <TableCell>
                        {new Date(report.generated_at).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US')}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={report.triggered_by === 'auto' ? t('automatic') || 'تلقائي' : t('manual') || 'يدوي'}
                          size="small"
                          color={report.triggered_by === 'auto' ? 'info' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip label={t('ready') || 'جاهز'} color="success" size="small" />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small">
                          <Download />
                        </IconButton>
                        <IconButton size="small">
                          <ArrowForward />
                        </IconButton>
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
        <DialogTitle>{t('createNewReport') || 'إنشاء تقرير جديد'}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>{t('project')}</InputLabel>
            <Select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              label={t('project')}
            >
              <MenuItem value="">{t('allProjects') || 'جميع المشاريع'}</MenuItem>
              {projects.map((p: any) => (
                <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)} disabled={mutation.isLoading}>{t('cancel')}</Button>
          <Button variant="contained" onClick={handleGenerate} disabled={mutation.isLoading}>
            {mutation.isLoading ? <CircularProgress size={20} /> : t('create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
