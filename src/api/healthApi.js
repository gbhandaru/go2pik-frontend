import { apiRequest } from './client.js';

export function fetchTwilioVerifyHealth() {
  return apiRequest('/health/twilio-verify', {
    auth: false,
  });
}
