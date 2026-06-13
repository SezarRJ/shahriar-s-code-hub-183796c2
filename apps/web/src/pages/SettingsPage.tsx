import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Divider,
  Alert,
} from '@mui/material';
import { Settings as SettingsIcon, Save } from '@mui/icons-material';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const [language, setLanguage] = useState(i18n.language || 'ar');
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [delayThreshold, setDelayThreshold] = useState('1');
  const [criticalThreshold, setCriticalThreshold] = useState('3');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    i18n.changeLanguage(language);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        {t('settings')}
      </Typography>

      {saved && (
        <Alert severity="success" sx={{ mb: 3 }}>
          تم حفظ الإعدادات بنجاح
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            <SettingsIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
            إعدادات الحساب
          </Typography>
          <Divider sx={{ my: 2 }} />

          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>اللغة</InputLabel>
            <Select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              label="اللغة"
            >
              <MenuItem value="ar">العربية</MenuItem>
              <MenuItem value="en">English</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={<Switch checked={darkMode} onChange={(e) => setDarkMode(e.target.checked)} />}
            label="الوضع الليلي (تجريبي)"
          />
          <FormControlLabel
            control={<Switch checked={notifications} onChange={(e) => setNotifications(e.target.checked)} />}
            label="تفعيل الإشعارات"
          />
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            إعدادات المشروع
          </Typography>
          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
            <TextField
              label="عتبة التأخير (أيام)"
              type="number"
              value={delayThreshold}
              onChange={(e) => setDelayThreshold(e.target.value)}
              helperText="الإشعار الأول عند تجاوز هذه المدة"
            />
            <TextField
              label="عتبة التأخير الحرج (أيام)"
              type="number"
              value={criticalThreshold}
              onChange={(e) => setCriticalThreshold(e.target.value)}
              helperText="إشعار حرج عند تجاوز هذه المدة"
            />
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            الأمان
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Button variant="outlined" color="primary">
            تفعيل المصادقة الثنائية (MFA)
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            مطلوب لدوري Tenant Admin و Project Manager
          </Typography>
        </CardContent>
      </Card>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          size="large"
          startIcon={<Save />}
          onClick={handleSave}
        >
          حفظ الإعدادات
        </Button>
      </Box>
    </Box>
  );
}
