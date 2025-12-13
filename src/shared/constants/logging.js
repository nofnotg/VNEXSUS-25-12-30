// Logging event constants centralized per team rules
export const LOG_EVENTS = {
  API_REQUEST: 'api_request',
  API_RESPONSE: 'api_response',
  PROCESSING_START: 'processing_start',
  PROCESSING_COMPLETE: 'processing_complete',
  PROCESSING_ERROR: 'processing_error',
  PERFORMANCE_METRIC: 'performance_metric',
  SECURITY_EVENT: 'security_event',
  BUSINESS_EVENT: 'business_event',
};

// Domain-specific business event keys (centralized to avoid magic strings)
export const REPORT_EVENTS = {
  REPORT_FILTER_COMPLETE: 'report_filter_complete',
  TIMELINE_BUILT: 'timeline_built',
  REPORT_PATH_READY: 'report_path_ready',
};

// Bridge/PubSub event keys
export const BRIDGE_EVENTS = {
  BRIDGE_INIT: 'bridge_init',
  BRIDGE_PROJECT_ID: 'bridge_project_id',
  BRIDGE_CLOUD_SETTINGS: 'bridge_cloud_settings',
  INIT_OUTPUT_DIR_CREATED: 'init_output_dir_created',
  BRIDGE_TEST_MODE: 'bridge_test_mode',
  BRIDGE_TEST_MESSAGE_SCHEDULE: 'bridge_test_message_schedule',
  BRIDGE_TEST_MSG_RECEIVE: 'bridge_test_msg_receive',
  BRIDGE_MSG_RECEIVED: 'bridge_msg_received',
  BRIDGE_OCR_TEXT_LENGTH: 'bridge_ocr_text_length',
  BRIDGE_PATIENT_INFO: 'bridge_patient_info',
  SAMPLE_REPORT_CREATED: 'sample_report_created',
  MESSAGE_ACK: 'message_ack',
  BRIDGE_TEST_MODE_COMPLETE: 'bridge_test_mode_complete',
  BRIDGE_PUBSUB_SETUP_HINT: 'bridge_pubsub_setup_hint',
  BRIDGE_SHUTDOWN: 'bridge_shutdown',
  BRIDGE_MESSAGE_PROCESS_ERROR: 'bridge_message_process_error',
  PUBSUB_CLIENT_INIT_START: 'pubsub_client_init_start',
  PUBSUB_CLIENT_INIT_COMPLETE: 'pubsub_client_init_complete',
  PUBSUB_SUBSCRIPTION_CONNECTING: 'pubsub_subscription_connecting',
  PUBSUB_SUBSCRIPTION_CONNECTED: 'pubsub_subscription_connected',
  PUBSUB_WAITING_MESSAGES: 'pubsub_waiting_messages',
  PUBSUB_SUBSCRIPTION_ERROR: 'pubsub_subscription_error',
  PUBSUB_INIT_ERROR: 'pubsub_init_error',
};
