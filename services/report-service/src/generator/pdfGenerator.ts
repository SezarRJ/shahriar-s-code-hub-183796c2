import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../utils/logger';

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
  },
  forcePathStyle: true,
});

const BUCKET = process.env.S3_BUCKET || 'shahid-reports';

/**
 * Simple template engine: replaces {{key}} with values.
 * Supports {{#array}}...{{/array}} loops and {{^empty}}...{{/empty}} inverse sections.
 */
function renderTemplate(template: string, data: Record<string, any>): string {
  let result = template;

  // Inverse sections: {{^key}}...{{/key}} — shown when falsy or empty array
  result = result.replace(/\{\{\^([\w]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_match, key, content) => {
    const val = data[key];
    if (!val || (Array.isArray(val) && val.length === 0)) {
      return content;
    }
    return '';
  });

  // Array sections: {{#array}}...{{/array}}
  result = result.replace(/\{\{\#([\w]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_match, key, content) => {
    const arr = data[key];
    if (!Array.isArray(arr)) return '';
    return arr.map((item: any, index: number) => {
      let itemContent = content;
      // Replace {{index}} with 1-based index
      itemContent = itemContent.replace(/\{\{\{?index\}?\}\}/g, String(index + 1));
      // Replace all other {{field}} with item values
      itemContent = itemContent.replace(/\{\{\{?([\w.]+)\}?\}\}/g, (_m: string, field: string) => {
        const val = item[field];
        if (val === undefined || val === null) return '';
        if (typeof val === 'boolean') return val ? 'نعم' : 'لا';
        return String(val);
      });
      return itemContent;
    }).join('');
  });

  // Simple variable replacement (remaining {{key}})
  result = result.replace(/\{\{\{?([\w.]+)\}?\}\}/g, (_match, key) => {
    const val = data[key];
    if (val === undefined || val === null) return '';
    if (typeof val === 'boolean') return val ? 'نعم' : 'لا';
    return String(val);
  });

  return result;
}

interface ReportData {
  project_id: string;
  project_name: string;
  project_address: string;
  period_start: string;
  period_end: string;
  generated_at: string;
  generated_by: string;
  total_capture_points: number;
  completion_percent: number;
  points_behind: number;
  photos_per_point: number;
  delayed_points: any[];
  capture_points: any[];
  photos: any[];
  report_hash: string;
}

export async function generateWeeklyReport(data: ReportData): Promise<{ fileUrl: string; fileSize: number }> {
  try {
    // 1. Load Arabic RTL template
    const templatePath = path.join(__dirname, '../../templates/weekly-report-ar.html');
    const template = await fs.readFile(templatePath, 'utf-8');

    // 2. Render HTML with data
    const html = renderTemplate(template, data);

    // 3. Launch Puppeteer and generate PDF
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      preferCSSPageSize: true,
    });

    await browser.close();

    // 4. Upload to S3/MinIO
    const key = `reports/${data.project_id}/${data.period_start}_${data.period_end}.pdf`;

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      Metadata: {
        'project-id': data.project_id,
        'period-start': data.period_start,
        'period-end': data.period_end,
        'generated-at': data.generated_at,
        'report-hash': data.report_hash,
      },
    }));

    const fileUrl = `${process.env.S3_ENDPOINT}/${BUCKET}/${key}`;
    logger.info({ message: 'Weekly report generated', projectId: data.project_id, key, fileSize: pdfBuffer.length });

    return { fileUrl, fileSize: pdfBuffer.length };
  } catch (err) {
    logger.error({ message: 'PDF generation failed', error: (err as Error).message, projectId: data.project_id });
    throw err;
  }
}
