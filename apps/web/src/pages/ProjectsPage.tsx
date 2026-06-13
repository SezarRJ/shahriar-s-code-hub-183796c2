import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { useTranslation } from 'react-i18next';
import { useQuery } from 'react-query';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
} from '@mui/material';
import {
  Add,
  Search,
  ArrowForward,
  Apartment,
  Map,
  UploadFile,
} from '@mui/icons-material';
import { fetchProjects, createProject } from '../services/api';

export default function ProjectsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, refetch } = useQuery('projects', fetchProjects);
  const projects = data?.data?.data || [];

  useEffect(() => {
    document.title = `${t('appName')} — ${t('projects')}`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', t('projectsPageDescription') || 'Manage construction projects, zones and capture frequency');
    }
  }, [t]);

  const [search, setSearch] = useState('');

  const [openDialog, setOpenDialog] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [newProject, setNewProject] = useState({
    name: '',
    address: '',
    status: 'active',
    capture_frequency_hours: 24,
    report_language: 'ar',
  });

  const filtered = projects.filter((p: any) =>
    p.name?.toLowerCase().includes(search.toLowerCase())
  );

  const steps = ['معلومات المشروع', 'المناطق', 'نقاط التقاط', 'إنشاء'];

  const handleCreate = async () => {
    await createProject(newProject);
    setOpenDialog(false);
    refetch();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          {t('projects')}
        </Typography>
        <Fab color="primary" onClick={() => setOpenDialog(true)}>
          <Add />
        </Fab>
      </Box>


      <TextField
        fullWidth
        placeholder="بحث في المشاريع..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 3 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search />
            </InputAdornment>
          ),
        }}
      />

      <Grid container spacing={3}>
        {filtered.map((project: any) => (
          <Grid item xs={12} md={6} lg={4} key={project.id}>
            <Card
              sx={{
                cursor: 'pointer',
                transition: 'box-shadow 0.2s',
                '&:hover': { boxShadow: 4 },
              }}
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                  <Apartment color="primary" fontSize="large" />
                  <Chip
                    label={project.status === 'active' ? t('active') : project.status}
                    color={project.status === 'active' ? 'success' : 'default'}
                    size="small"
                  />
                </Box>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  {project.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {project.address || '—'}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(project.created_at).toLocaleDateString('ar-SA')}
                  </Typography>
                  <IconButton size="small">
                    <ArrowForward />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>إنشاء مشروع جديد</DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep} orientation="vertical" sx={{ mt: 2 }}>
            {steps.map((label, index) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
                <StepContent>
                  {index === 0 && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                      <TextField
                        label="اسم المشروع"
                        fullWidth
                        value={newProject.name}
                        onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                      />
                      <TextField
                        label="العنوان"
                        fullWidth
                        value={newProject.address}
                        onChange={(e) => setNewProject({ ...newProject, address: e.target.value })}
                      />
                      <FormControl fullWidth>
                        <InputLabel>لغة التقارير</InputLabel>
                        <Select
                          value={newProject.report_language}
                          onChange={(e) => setNewProject({ ...newProject, report_language: e.target.value })}
                          input={<OutlinedInput label="لغة التقارير" />}
                        >
                          <MenuItem value="ar">العربية</MenuItem>
                          <MenuItem value="en">English</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                  )}
                  {index === 1 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography color="text.secondary">
                        يمكنك إضافة المناطق والمستويات الهرمية بعد إنشاء المشروع.
                      </Typography>
                    </Box>
                  )}
                  {index === 2 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography color="text.secondary">
                        يمكن استيراد نقاط التقاط من ملف CSV بعد إنشاء المشروع.
                      </Typography>
                      <Button startIcon={<UploadFile />} sx={{ mt: 1 }}>
                        رفع نموذج CSV
                      </Button>
                    </Box>
                  )}
                  {index === 3 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography>تأكيد إنشاء المشروع</Typography>
                    </Box>
                  )}
                  <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                    <Button
                      variant="contained"
                      onClick={
                        index === steps.length - 1
                          ? handleCreate
                          : () => setActiveStep((prev) => prev + 1)
                      }
                    >
                      {index === steps.length - 1 ? 'إنشاء' : 'التالي'}
                    </Button>
                    {index > 0 && (
                      <Button onClick={() => setActiveStep((prev) => prev - 1)}>
                        السابق
                      </Button>
                    )}
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>إلغاء</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
