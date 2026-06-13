import { useState } from 'react';
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
import { exportEvidence, verifyPhoto } from '../services/api';

export default function EvidencePage() {
  const { t } = useTranslation();
  const [photoId, setPhotoId] = useState('');
  const [loading, setLoading] = useState(false);
  const [evidence, setEvidence] = useState<any>(null);
  const [verified, setVerified] = useState<boolean | null>(null);

  const handleExport = async () => {
    if (!photoId) return;
    setLoading(true);
    try {
      const res = await exportEvidence(photoId);
      setEvidence(res.data.data);
      setVerified(null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!photoId) return;
    setLoading(true);
    try {
      const res = await verifyPhoto(photoId);
      setVerified(res.data.data.verified);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        {t('evidenceExport')}
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <TextField
              fullWidth
              label="معرف الصورة (UUID)"
              value={photoId}
              onChange={(e) => setPhotoId(e.target.value)}
              placeholder="أدخل معرف الصورة للتحقق منها"
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

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {verified !== null && (
        <Alert severity={verified ? 'success' : 'error'} sx={{ mb: 3 }}>
          {verified
            ? '✅ التحقق من الصورة ناجح: تجزئة SHA-256 مطابقة.'
            : '❌ التحقق فشل: تجزئة SHA-256 غير متطابقة.'}
        </Alert>
      )}

      {evidence && (
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
                  {evidence.project?.name || 'مشروع'}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {evidence.project?.address || '—'}
                </Typography>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      نقطة التقاط
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {evidence.capture_point?.name || '—'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      المنطقة
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {evidence.capture_point?.zone || '—'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      التاريخ والوقت
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {new Date(evidence.capture?.captured_at).toLocaleString('ar-SA')}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      الجهاز
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {evidence.capture?.device_model || '—'}
                    </Typography>
                  </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    GPS
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
                    PDF
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
