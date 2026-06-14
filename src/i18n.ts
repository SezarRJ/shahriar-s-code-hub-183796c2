import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      'dashboard.title': 'Project Dashboard',
      'dashboard.welcome': 'Welcome back, {{name}}',
      'projects.title': 'Construction Projects',
      'projects.create': 'Create New Project',
      'photos.upload': 'Upload Photo',
      'photos.capture': 'Capture Site Photo',
      'reports.title': 'Project Reports',
      'reports.generate': 'Generate Weekly Report',
      'settings.title': 'Platform Settings',
      'auth.login': 'Login',
      'auth.logout': 'Logout',
      'common.save': 'Save',
      'common.cancel': 'Cancel',
      'common.error': 'An error occurred',
      'common.success': 'Operation successful',
      'ai.analyzing': 'AI is analyzing image...',
      'ai.defect_found': 'Defect detected!',
      'ai.no_defect': 'No defects found',
    },
  },
  ar: {
    translation: {
      'dashboard.title': 'لوحة تحكم المشروع',
      'dashboard.welcome': 'مرحباً بك مجدداً، {{name}}',
      'projects.title': 'مشاريع البناء',
      'projects.create': 'إنشاء مشروع جديد',
      'photos.upload': 'رفع صورة',
      'photos.capture': 'التقاط صورة للموقع',
      'reports.title': 'تقارير المشروع',
      'reports.generate': 'إنشاء تقرير أسبوعي',
      'settings.title': 'إعدادات المنصة',
      'auth.login': 'تسجيل الدخول',
      'auth.logout': 'تسجيل الخروج',
      'common.save': 'حفظ',
      'common.cancel': 'إلغاء',
      'common.error': 'حدث خطأ ما',
      'common.success': 'تمت العملية بنجاح',
      'ai.analyzing': 'الذكاء الاصطناعي يقوم بتحليل الصورة...',
      'ai.defect_found': 'تم اكتشاف خلل!',
      'ai.no_defect': 'لم يتم اكتشاف أي خلل',
    },
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    detectionOptions: {
      order: ['localStorage', 'cookie', 'navigator'],
      caches: ['localStorage', 'cookie'],
    },
  });

export default i18n;
