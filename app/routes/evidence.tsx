import { createFileRoute, redirect } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  Divider,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Verified,
  Search,
  Download,
  Image as ImageIcon,
} from '@mui/icons-material';
import { exportEvidence, verifyPhoto } from '../src/services/api';
import { useAuthStore } from '../src/store/authStore';

export const Route = createFileRoute('/evidence')({
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
  component: EvidencePage,
});

function EvidencePage() {
  const { t } = useTranslation();
  const [photoId, setPhotoId] = useState('');
  const [loading, setLoading] = useState(false);
  const [evidence, setEvidence] = useState<any>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${t('appName')} — ${t('evidenceExport')}`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', t('evidencePageDescription') || 'Verify and export immutable photo evidence for construction projects');
    }
  }, [t]);

  const handleExport = async () => {
    if (!photoId) return;
    setLoading(true);
    setError(null);
    setVerified(null);
    try {
      const res = await exportEvidence(photoId);
      setEvidence(res.data.data);
    } catch (e: any) {
      setError(e.response?.data?.error || t('apiError'));
      setEvidence(null);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!photoId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await verifyPhoto(photoId);
      setVerified(res.data.data.verified);
    } catch (e: any) {
      setError(e.response?.data?.error || t('apiError'));
      setVerified(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
        {t('evidenceExport')}
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <TextField
              fullWidth
              label={t('photoIdLabel') || 'معرف الصورة (UUID)'}
              value={photoId}
              onChange={(e) => setPhotoId(e.target.value)}
              placeholder={t('photoIdPlaceholder') || 'أدخل معرف الصورة للتحقق منها'}
            />
            <Button
              variant="contained"
              startIcon={<Search />}
              onClick={handleExport}
              disabled={loading || !photoId}
            >
              {t('export')}
            </Button>
            <Button
              variant="outlined"
              startIcon={<Verified />}
              onClick={handleVerify}
              disabled={loading || !photoId}
            >
              {t('verifyHash')}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {verified !== null && !loading && (
        <Alert severity={verified ? 'success' : 'error'} sx={{ mb: 3 }}>
          {verified
            ? t('verifySuccess') || '✅ التحقق من الصورة ناجح: تجزئة SHA-256 مطابقة.'
            : t('verifyFailure') || '❌ التحقق فشل: تجزئة SHA-256 غير متطابقة.'}
        </Alert>
      )}

      {evidence && !loading && (
        <Card>
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Box
                  sx={{
                    width: '100%',
                    height: 300,
                    bgcolor: 'grey.100',
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ImageIcon sx={{ fontSize: 64, color: 'grey.400' }} />
                </Box>
              </Grid>
              <Grid item xs={12} md={8}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  {evidence.project?.name || t('project')}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {evidence.project?.address || '—'}
                </Typography>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('capturePoint')}
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {evidence.capture_point?.name || '—'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('zone')}
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {evidence.capture_point?.zone || '—'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('dateTime')}
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {new Date(evidence.capture?.captured_at).toLocaleString(i18n.language === 'ar' ? 'ar-SA' : 'en-US')}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('device')}
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {evidence.capture?.device_model || '—'}
                    </Typography>
                  </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {t('gps')}
                  </Typography>
                  <Typography variant="body1" fontWeight="bold">
                    {evidence.capture?.gps?.latitude?.toFixed(6)}, {evidence.capture?.gps?.longitude?.toFixed(6)}
                    {evidence.capture?.gps?.accuracy && ` (±${evidence.capture.gps.accuracy}m)`}
                  </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <Typography variant="caption" color="text.secondary">
                    SHA-256:
                  </Typography>
                  <Chip
                    label={evidence.integrity?.hash_sha256?.slice(0, 16) + '...'}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                  <Button size="small" startIcon={<Download />}>
                    {t('downloadPdf') || 'PDF'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
