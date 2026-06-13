import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

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
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { fetchProject } from '../services/api';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);

  useEffect(() => {
    document.title = `${t('appName')} — Project Details`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', t('projectDetailPageDescription') || 'Detailed view of construction project progress, zones and capture points');
    }
  }, [t]);

  const { data, isLoading } = useQuery(['project', id], () => fetchProject(id!));

  const project = data?.data?.data;

  return (
    <Box>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/projects')}
        sx={{ mb: 2 }}
      >
        العودة إلى المشاريع
      </Button>

      <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
        {isLoading ? 'جارٍ التحميل...' : project?.name || 'مشروع'}
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>

        <Tab label="نظرة عامة" />
        <Tab label="نقاط التقاط" />
        <Tab label="الصور" />
        <Tab label="الجدول الزمني" />
      </Tabs>

      {tab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">الحالة</Typography>
                <Chip
                  label={project?.status === 'active' ? 'نشط' : project?.status}
                  color={project?.status === 'active' ? 'success' : 'default'}
                  sx={{ mt: 1 }}
                />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  العنوان
                </Typography>
                <Typography variant="body1">{project?.address || '—'}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">نسبة الإنجاز</Typography>
                <LinearProgress variant="determinate" value={0} sx={{ mt: 1, height: 8, borderRadius: 4 }} />
                <Typography variant="h6" fontWeight="bold" sx={{ mt: 1 }}>0%</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">نقاط متأخرة</Typography>
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
                    <TableCell>النقطة</TableCell>
                    <TableCell>المنطقة</TableCell>
                    <TableCell>المرحلة المتوقعة</TableCell>
                    <TableCell>آخر التقاط</TableCell>
                    <TableCell>الحالة</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={5} align="center">لا توجد بيانات</TableCell>
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
            <Typography color="text.secondary">لا توجد صور مسجلة بعد.</Typography>
          </CardContent>
        </Card>
      )}

      {tab === 3 && (
        <Card>
          <CardContent>
            <Typography color="text.secondary">الجدول الزمني قيد التطوير.</Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}


