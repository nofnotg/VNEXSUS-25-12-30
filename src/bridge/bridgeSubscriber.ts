import { PubSub } from '@google-cloud/pubsub';
import { handleOcrResult } from '../modules/ocrParser';
import { logger, logProcessingStart, logProcessingSuccess, logProcessingError } from '../shared/logging/logger';
import { BRIDGE_EVENTS } from '../shared/constants/logging';
import { maskObject } from '../shared/security/mask';

// 시작 로그
logger.info({ event: BRIDGE_EVENTS.BRIDGE_INIT, metadata: { mode: 'pubsub' } });
logger.info({ event: BRIDGE_EVENTS.BRIDGE_CLOUD_SETTINGS,
  metadata: {
    projectId: process.env.GCP_PROJECT_ID || 'medreport-vision-ocr',
    credentials: Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS)
  }
});

// PubSub 설정
const subId = process.env.PUBSUB_SUB_ID ?? 'ocr-result-sub';
const projectId = process.env.GCP_PROJECT_ID || 'medreport-vision-ocr';

try {
  logger.info({ event: BRIDGE_EVENTS.PUBSUB_CLIENT_INIT_START });
  const pubsub = new PubSub({ projectId });
  logger.info({ event: BRIDGE_EVENTS.PUBSUB_CLIENT_INIT_COMPLETE });

  logger.info({ event: BRIDGE_EVENTS.PUBSUB_SUBSCRIPTION_CONNECTING, metadata: { subId } });
  const sub = pubsub.subscription(subId);

  logger.info({ event: BRIDGE_EVENTS.PUBSUB_SUBSCRIPTION_CONNECTED, metadata: { subId } });
  logger.info({ event: BRIDGE_EVENTS.PUBSUB_WAITING_MESSAGES, metadata: { hint: 'Ctrl+C to exit' } });
  
  sub.on('message', async (m) => {
    logger.info({ event: BRIDGE_EVENTS.BRIDGE_MSG_RECEIVED, metadata: { id: m.id } });
    const t0 = Date.now();
    try {
      const payload = JSON.parse(m.data.toString());
      const inputSize = Buffer.byteLength(m.data);
      logProcessingStart(m.id, 'ocr_result_handle', inputSize);
      await handleOcrResult(payload);
      logProcessingSuccess(m.id, 'ocr_result_handle', Date.now() - t0);
      logger.info({ event: BRIDGE_EVENTS.MESSAGE_ACK, metadata: { id: m.id } });
    } catch (err) {
      logProcessingError(m.id, 'ocr_result_handle', err as Error, Date.now() - t0);
    } finally {
      m.ack();
    }
  });
  
  sub.on('error', (err) => {
    const e = err as Error;
    logger.error({ event: BRIDGE_EVENTS.PUBSUB_SUBSCRIPTION_ERROR, error: { name: e.name, message: e.message, stack: e.stack } });
  });
} catch (err) {
  const e = err as Error;
  logger.error({ event: BRIDGE_EVENTS.PUBSUB_INIT_ERROR, error: { name: e.name, message: e.message, stack: e.stack } });
}
