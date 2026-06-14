import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from 'react-query';
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
} from '@mui/material';
import {
  Assessment,
  Refresh,
  Download,
  ArrowForward,
} from '@mui/icons-material';
import { fetchReports, triggerReport } from '../apps/web/src/services/api';

export const Route = createFileRoute('/reports')({
  component: ReportsPage,
});

function ReportsPage() {
  const { t } = useTranslation();
  const { data, isLoading, refetch } = useQuery('reports', fetchReports);
  const reports = data?.data?.data || [];

  useEffect(() => {
    document.title = `${t('appName')} — ${t('reports')}`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', t('reportsPageDescription') || 'Generate and review weekly construction reports and delay analysis');
    }
  }, [t]);

  const [openDialog, setOpenDialog] = useState(false);

  const [selectedProject, setSelectedProject] = useState('');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await triggerReport({ project_id: selectedProject });
      setOpenDialog(false);
      refetch();
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
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


      <Card>
        <CardContent>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>المشروع</TableCell>
                  <TableCell>الفترة</TableCell>
                  <TableCell>تاريخ الإنشاء</TableCell>
                  <TableCell>المحفز</TableCell>
                  <TableCell>الحالة</TableCell>
                  <TableCell>إجراءات</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
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
                        {new Date(report.generated_at).toLocaleDateString('ar-SA')}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={report.triggered_by === 'auto' ? 'تلقائي' : 'يدوي'}
                          size="small"
                          color={report.triggered_by === 'auto' ? 'info' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip label="جاهز" color="success" size="small" />
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
        <DialogTitle>إنشاء تقرير جديد</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>المشروع</InputLabel>
            <Select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              label="المشروع"
            >
              <MenuItem value="">جميع المشاريع</MenuItem>
              {/* Projects loaded dynamically */}
              <MenuItem value="demo">مشروع تجريبي</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>إلغاء</Button>
          <Button variant="contained" onClick={handleGenerate} disabled={generating}>
            {generating ? <CircularProgress size={20} /> : 'إنشاء'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
