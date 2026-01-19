/**
 * PDF to Image Converter
 *
 * PDF 파일을 이미지로 변환
 * - Playwright를 사용한 PDF 렌더링
 * - 임시 파일로 저장
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { logger } from '../../../shared/logging/logger';

export interface PDF2ImageOptions {
  dpi?: number; // 해상도 (기본 150)
  format?: 'png' | 'jpeg';
  quality?: number; // JPEG quality (1-100)
  scale?: number; // 스케일 (1-2)
}

/**
 * PDF를 이미지로 변환
 */
export async function convertPDFToImages(
  pdfPath: string,
  options: PDF2ImageOptions = {}
): Promise<string[]> {
  const {
    dpi = 150,
    format = 'jpeg',
    quality = 90,
    scale = 1.5,
  } = options;

  const startTime = Date.now();

  try {
    logger.info({
      event: 'pdf2image_start',
      pdfPath,
      options,
    });

    // 임시 디렉토리 생성
    const tempDir = join(tmpdir(), `pdf2img-${randomUUID()}`);
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }

    // Playwright로 PDF 렌더링
    const browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    // PDF 로드
    await page.goto(`file://${pdfPath}`, {
      waitUntil: 'networkidle',
    });

    // PDF 페이지 수 추출 (JavaScript 실행)
    const pageCount = await page.evaluate(() => {
      // @ts-ignore
      return window.PDFViewerApplication?.pdfDocument?.numPages || 1;
    });

    logger.info({
      event: 'pdf_loaded',
      pageCount,
    });

    const imagePaths: string[] = [];

    // 각 페이지를 이미지로 변환
    for (let i = 1; i <= pageCount; i++) {
      // 페이지 이동
      await page.evaluate((pageNum) => {
        // @ts-ignore
        window.PDFViewerApplication?.pdfViewer?.currentPageNumber = pageNum;
      }, i);

      await page.waitForTimeout(500); // 렌더링 대기

      // 스크린샷
      const imagePath = join(tempDir, `page-${i}.${format}`);
      await page.screenshot({
        path: imagePath,
        type: format,
        quality: format === 'jpeg' ? quality : undefined,
        scale: scale === 2 ? 'device' : 'css',
      });

      imagePaths.push(imagePath);

      logger.info({
        event: 'page_converted',
        pageIndex: i,
        imagePath,
      });
    }

    await browser.close();

    const processingTime = Date.now() - startTime;

    logger.info({
      event: 'pdf2image_success',
      pageCount: imagePaths.length,
      processingTime,
      outputDir: tempDir,
    });

    return imagePaths;
  } catch (error) {
    const processingTime = Date.now() - startTime;

    logger.error({
      event: 'pdf2image_error',
      error: error as Error,
      processingTime,
    });

    throw error;
  }
}

/**
 * 간단한 PDF → Image 변환 (단일 페이지)
 */
export async function convertPDFToImage(
  pdfPath: string,
  pageIndex: number = 0,
  options: PDF2ImageOptions = {}
): Promise<string> {
  const images = await convertPDFToImages(pdfPath, options);

  if (pageIndex >= images.length) {
    throw new Error(`Page index ${pageIndex} out of range (total pages: ${images.length})`);
  }

  return images[pageIndex];
}
